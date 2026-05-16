import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { AUDIT_ACTIONS, writeAuditLog } from '@/modules/audit';
import { getCurrentUserContext } from '@/modules/auth_users';
import { notifyPeople, notifyPerson } from '@/modules/notifications';
import {
  assertRestaurantAccess,
  assertRestaurantManagement,
  assertZoneAccess,
  coerceSystemRole,
  deriveResponsibilityLevel,
  type SystemRole,
} from '@/shared/authz';

import type {
  CreateRequestInput,
  CreateShiftSwapRequestInput,
  RequestRecord,
  ReviewRequestInput,
  ShiftSwapRequestRecord,
} from '../domain/requestTypes';

type EmploymentSnapshot = {
  company_id: string;
  employment_id: string;
  is_archived: boolean;
  job_title: string | null;
  person_id: string;
  restaurant_id: string | null;
  zone_id: string | null;
  system_role: SystemRole;
  valid_from: string;
  valid_to: string | null;
};

type ScheduleEntrySnapshot = {
  date: string;
  employment_id: string;
  id: string;
  restaurant_id: string;
};

type RestaurantAssignmentSnapshot = {
  employment_id: string;
  restaurant_id: string;
  valid_from: string;
  valid_to: string | null;
};

type RequestSnapshot = RequestRecord;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getRequestAnchorDate(request: Pick<RequestRecord, 'created_at' | 'effective_start_date'>): string {
  return request.effective_start_date ?? request.created_at.slice(0, 10);
}

function isDateWithinRange(
  date: string,
  validFrom: string,
  validTo: string | null,
): boolean {
  return validFrom <= date && (validTo === null || validTo >= date);
}

function isEmploymentActiveOnDate(employment: EmploymentSnapshot, date: string): boolean {
  if (employment.is_archived) return false;
  if (employment.valid_from > date) return false;
  if (employment.valid_to && employment.valid_to < date) return false;
  return true;
}

async function getRequiredCurrentUserContext() {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    throw new Error('Unauthorized');
  }

  return ctx;
}

async function loadEmploymentSnapshot(
  employmentId: string,
  anchorDate = todayIsoDate(),
): Promise<EmploymentSnapshot> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('employment_relationships')
    .select('employment_id, person_id, company_id, job_title, valid_from, valid_to, is_archived')
    .eq('employment_id', employmentId)
    .single();

  if (error) {
    throw new Error(`Failed to load employment relationship: ${error.message}`);
  }

  const { data: person, error: personError } = await admin
    .from('persons')
    .select('system_role')
    .eq('person_id', data.person_id)
    .single();

  if (personError) {
    throw new Error(`Failed to load employment system role: ${personError.message}`);
  }

  const { data: restaurantAssignment, error: assignmentError } = await admin
    .from('employment_restaurant_assignments')
    .select('employment_id, restaurant_id, valid_from, valid_to')
    .eq('employment_id', employmentId)
    .lte('valid_from', anchorDate)
    .or(`valid_to.is.null,valid_to.gte.${anchorDate}`)
    .order('valid_from', { ascending: false })
    .maybeSingle();

  if (assignmentError && assignmentError.code !== 'PGRST116') {
    throw new Error(`Failed to load employment restaurant assignment: ${assignmentError.message}`);
  }

  const { data: zoneAssignment, error: zoneError } = await admin
    .from('employment_zone_assignments')
    .select('employment_id, zone_id, valid_from, valid_to')
    .eq('employment_id', employmentId)
    .lte('valid_from', anchorDate)
    .or(`valid_to.is.null,valid_to.gte.${anchorDate}`)
    .order('valid_from', { ascending: false })
    .maybeSingle();

  if (zoneError && zoneError.code !== 'PGRST116') {
    throw new Error(`Failed to load employment zone assignment: ${zoneError.message}`);
  }

  return {
    ...(data as Omit<EmploymentSnapshot, 'restaurant_id' | 'system_role'>),
    restaurant_id:
      ((restaurantAssignment ?? null) as RestaurantAssignmentSnapshot | null)?.restaurant_id ?? null,
    zone_id:
      ((zoneAssignment ?? null) as { zone_id: string | null } | null)?.zone_id ?? null,
    system_role: coerceSystemRole(person.system_role as string),
  };
}

async function loadScheduleEntrySnapshot(entryId: string): Promise<ScheduleEntrySnapshot> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('schedule_entries')
    .select('id, entry_date, employment_id, schedules!inner(restaurant_id)')
    .eq('id', entryId)
    .single();

  if (error) {
    throw new Error(`Failed to load schedule entry: ${error.message}`);
  }

  const schedule = Array.isArray(data.schedules) ? data.schedules[0] : data.schedules;
  if (!schedule?.restaurant_id || !data.employment_id) {
    throw new Error('SHIFT_SWAP_INVALID_ENTRY: La celda no tiene restaurante o employment asociado.');
  }

  return {
    date: data.entry_date as string,
    employment_id: data.employment_id as string,
    id: data.id as string,
    restaurant_id: schedule.restaurant_id as string,
  };
}

async function listRestaurantManagers(restaurantId: string): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const { data: assignments, error: assignmentError } = await admin
    .from('role_scope_assignments')
    .select('person_id')
    .eq('scope_type', 'restaurant')
    .eq('scope_id', restaurantId)
    .lte('valid_from', todayIsoDate())
    .or(`valid_to.is.null,valid_to.gte.${todayIsoDate()}`);

  if (assignmentError) {
    throw new Error(`Failed to load restaurant scope assignments: ${assignmentError.message}`);
  }

  const personIds = [...new Set((assignments ?? []).map((row) => row.person_id as string))];
  if (personIds.length === 0) return [];

  const { data: people, error: peopleError } = await admin
    .from('persons')
    .select('person_id, system_role')
    .in('person_id', personIds)
    .eq('system_role', 'manager');

  if (peopleError) {
    throw new Error(`Failed to load restaurant managers: ${peopleError.message}`);
  }

  return (people ?? []).map((row) => row.person_id as string);
}

async function listRestaurantAssignmentsForEmployments(
  employmentIds: string[],
  restaurantId: string,
): Promise<Map<string, RestaurantAssignmentSnapshot[]>> {
  if (employmentIds.length === 0) return new Map();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('employment_restaurant_assignments')
    .select('employment_id, restaurant_id, valid_from, valid_to')
    .in('employment_id', employmentIds)
    .eq('restaurant_id', restaurantId);

  if (error) {
    throw new Error(`Failed to load restaurant assignments: ${error.message}`);
  }

  const assignments = (data ?? []) as RestaurantAssignmentSnapshot[];
  const assignmentsByEmploymentId = new Map<string, RestaurantAssignmentSnapshot[]>();

  for (const assignment of assignments) {
    const current = assignmentsByEmploymentId.get(assignment.employment_id) ?? [];
    current.push(assignment);
    assignmentsByEmploymentId.set(assignment.employment_id, current);
  }

  return assignmentsByEmploymentId;
}

async function listZoneAssignmentsForEmployments(
  employmentIds: string[],
  zoneId: string,
): Promise<Map<string, Array<{ valid_from: string; valid_to: string | null }>>> {
  if (employmentIds.length === 0) return new Map();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('employment_zone_assignments')
    .select('employment_id, valid_from, valid_to')
    .in('employment_id', employmentIds)
    .eq('zone_id', zoneId);

  if (error) {
    throw new Error(`Failed to load zone assignments: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    employment_id: string;
    valid_from: string;
    valid_to: string | null;
  }>;

  const assignmentsByEmploymentId = new Map<string, Array<{ valid_from: string; valid_to: string | null }>>();
  for (const row of rows) {
    const current = assignmentsByEmploymentId.get(row.employment_id) ?? [];
    current.push({ valid_from: row.valid_from, valid_to: row.valid_to });
    assignmentsByEmploymentId.set(row.employment_id, current);
  }

  return assignmentsByEmploymentId;
}

export async function listMyRequests(): Promise<RequestRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('requests')
    .select(
      'request_id, employment_id, request_type, status, requested_by, reviewed_by, effective_start_date, effective_end_date, resolution_note, created_at, updated_at',
    )
    .eq('requested_by', ctx.userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list requests: ${error.message}`);
  }

  return (data ?? []) as RequestRecord[];
}

export async function listRestaurantRequests(
  restaurantId: string,
): Promise<RequestRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  const isAreaLead = ctx.requestContext.systemRole === 'area_lead';
  if (isAreaLead) {
    if (!ctx.requestContext.zoneId) {
      throw new Error('FORBIDDEN: area_lead requiere zone activa.');
    }
    // El manejo es por zona para area_lead, pero el recurso principal sigue siendo el restaurante.
    assertRestaurantAccess(ctx.requestContext, restaurantId);
    assertZoneAccess(ctx.requestContext, restaurantId, ctx.requestContext.zoneId);
  } else {
    assertRestaurantManagement(ctx.requestContext, restaurantId);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('requests')
    .select(
      'request_id, employment_id, request_type, status, requested_by, reviewed_by, effective_start_date, effective_end_date, resolution_note, created_at, updated_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list restaurant requests: ${error.message}`);
  }

  const requests = (data ?? []) as RequestSnapshot[];
  const assignmentsByEmploymentId = await listRestaurantAssignmentsForEmployments(
    [...new Set(requests.map((request) => request.employment_id))],
    restaurantId,
  );

  const zoneAssignmentsByEmploymentId = isAreaLead
    ? await listZoneAssignmentsForEmployments(
        [...new Set(requests.map((request) => request.employment_id))],
        ctx.requestContext.zoneId as string,
      )
    : new Map<string, Array<{ valid_from: string; valid_to: string | null }>>();

  return requests.filter((request) => {
    const anchorDate = getRequestAnchorDate(request);
    const assignments = assignmentsByEmploymentId.get(request.employment_id) ?? [];
    const zoneAssignments = zoneAssignmentsByEmploymentId.get(request.employment_id) ?? [];

    const inRestaurant = assignments.some((assignment) =>
      isDateWithinRange(anchorDate, assignment.valid_from, assignment.valid_to),
    );

    if (!inRestaurant) return false;

    if (isAreaLead) {
      return zoneAssignments.some((assignment) =>
        isDateWithinRange(anchorDate, assignment.valid_from, assignment.valid_to),
      );
    }

    return true;
  });
}

export async function createRequest(input: CreateRequestInput): Promise<RequestRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const anchorDate = input.effectiveStartDate ?? todayIsoDate();
  const employment = await loadEmploymentSnapshot(input.employmentId, anchorDate);

  if (!employment.restaurant_id) {
    throw new Error('REQUEST_EMPLOYMENT_RESTAURANT_NOT_FOUND: El empleo no tiene restaurante operativo para esa fecha.');
  }

  if (ctx.userId !== employment.person_id) {
    if (ctx.requestContext.systemRole === 'area_lead') {
      if (!employment.zone_id) {
        throw new Error('FORBIDDEN: El empleo no tiene zona asignada en esa fecha.');
      }
      assertRestaurantAccess(ctx.requestContext, employment.restaurant_id);
      assertZoneAccess(ctx.requestContext, employment.restaurant_id, employment.zone_id);
    } else {
      assertRestaurantManagement(ctx.requestContext, employment.restaurant_id);
    }
  }

  const admin = createSupabaseAdminClient();
  const payload = {
    effective_end_date: input.effectiveEndDate ?? null,
    effective_start_date: input.effectiveStartDate ?? null,
    employment_id: input.employmentId,
    request_type: input.requestType,
    requested_by: ctx.userId,
    status: 'pending',
  };
  const { data, error } = await admin
    .from('requests')
    .insert(payload)
    .select(
      'request_id, employment_id, request_type, status, requested_by, reviewed_by, effective_start_date, effective_end_date, resolution_note, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to create request: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.requestCreated,
    entityId: data.request_id,
    entityType: 'request',
    newValue: payload,
    scopeId: employment.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  const managers = await listRestaurantManagers(employment.restaurant_id);
  if (managers.length > 0) {
    await notifyPeople(
      managers.map((recipientPersonId) => ({
        body: 'Hay una solicitud pendiente de revision en tu restaurante.',
        entityId: data.request_id as string,
        entityType: 'request',
        notificationType: 'request_created',
        recipientPersonId,
        scopeId: employment.restaurant_id,
        scopeType: 'restaurant',
        sendPush: true,
        title: 'Nueva solicitud',
        traceId: ctx.requestContext.traceId,
      })),
    );
  }

  return data as RequestRecord;
}

export async function reviewRequest(input: ReviewRequestInput): Promise<RequestRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin
    .from('requests')
    .select(
      'request_id, employment_id, request_type, status, requested_by, reviewed_by, effective_start_date, effective_end_date, resolution_note, created_at, updated_at',
    )
    .eq('request_id', input.requestId)
    .single();

  if (currentError) {
    throw new Error(`Failed to load request: ${currentError.message}`);
  }

  const anchorDate =
    (current.effective_start_date as string | null) ??
    (current.created_at as string).slice(0, 10);
  const employment = await loadEmploymentSnapshot(current.employment_id as string, anchorDate);

  if (!employment.restaurant_id) {
    throw new Error(
      'REQUEST_EMPLOYMENT_RESTAURANT_NOT_FOUND: La solicitud ya no tiene un restaurante operativo resoluble.',
    );
  }
  if (ctx.requestContext.systemRole === 'area_lead') {
    if (!employment.zone_id) {
      throw new Error('FORBIDDEN: La solicitud no tiene zona asignada resoluble para este empleo.');
    }
    assertZoneAccess(ctx.requestContext, employment.restaurant_id, employment.zone_id);
  } else {
    assertRestaurantManagement(ctx.requestContext, employment.restaurant_id);
  }

  if (current.requested_by === ctx.userId) {
    throw new Error('REQUEST_SELF_APPROVAL_FORBIDDEN: No puedes autorizar tu propia solicitud.');
  }

  const TERMINAL_REQUEST_STATUSES = new Set(['approved', 'rejected', 'cancelled', 'expired']);
  if (TERMINAL_REQUEST_STATUSES.has(current.status as string)) {
    throw new Error(`REQUEST_INVALID_TRANSITION: No se puede cambiar una solicitud en estado '${current.status}'.`);
  }

  const patch = {
    resolution_note: input.resolutionNote ?? null,
    reviewed_by: ctx.userId,
    status: input.status,
  };
  const { data, error } = await admin
    .from('requests')
    .update(patch)
    .eq('request_id', input.requestId)
    .select(
      'request_id, employment_id, request_type, status, requested_by, reviewed_by, effective_start_date, effective_end_date, resolution_note, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to review request: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.requestStatusChanged,
    entityId: input.requestId,
    entityType: 'request',
    newValue: patch,
    previousValue: {
      resolution_note: current.resolution_note,
      reviewed_by: current.reviewed_by,
      status: current.status,
    },
    scopeId: employment.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  const notificationType =
    input.status === 'approved'
      ? 'request_approved'
      : input.status === 'rejected'
        ? 'request_rejected'
        : 'request_in_review';

  await notifyPerson({
    body:
      input.status === 'approved'
        ? 'Tu solicitud ha sido aprobada.'
        : input.status === 'rejected'
          ? 'Tu solicitud ha sido rechazada.'
          : 'Tu solicitud ha cambiado de estado.',
    entityId: input.requestId,
    entityType: 'request',
    notificationType,
    recipientPersonId: current.requested_by as string,
    scopeId: employment.restaurant_id,
    scopeType: 'restaurant',
    sendPush: input.status === 'approved' || input.status === 'rejected',
    title: 'Actualizacion de solicitud',
    traceId: ctx.requestContext.traceId,
  });

  return data as RequestRecord;
}

export async function listMyShiftSwapRequests(): Promise<ShiftSwapRequestRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('shift_swap_requests')
    .select(
      'shift_swap_request_id, requester_employee_id, target_employee_id, requester_schedule_entry_id, target_schedule_entry_id, status, requested_at, peer_responded_at, reviewed_by, reviewed_at, reason',
    )
    .or(`requester_employee_id.eq.${ctx.userId},target_employee_id.eq.${ctx.userId}`)
    .order('requested_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list shift swap requests: ${error.message}`);
  }

  return (data ?? []) as ShiftSwapRequestRecord[];
}

export async function createShiftSwapRequest(
  input: CreateShiftSwapRequestInput,
): Promise<ShiftSwapRequestRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const requesterEntry = await loadScheduleEntrySnapshot(input.requesterScheduleEntryId);
  const targetEntry = await loadScheduleEntrySnapshot(input.targetScheduleEntryId);

  if (requesterEntry.date !== targetEntry.date) {
    throw new Error('SHIFT_SWAP_DATE_MISMATCH: El intercambio debe ser en la misma fecha.');
  }

  if (requesterEntry.restaurant_id !== targetEntry.restaurant_id) {
    throw new Error('SHIFT_SWAP_RESTAURANT_MISMATCH: El intercambio debe ser en el mismo restaurante.');
  }

  const requesterEmployment = await loadEmploymentSnapshot(
    requesterEntry.employment_id,
    requesterEntry.date,
  );
  const targetEmployment = await loadEmploymentSnapshot(
    targetEntry.employment_id,
    targetEntry.date,
  );

  if (requesterEmployment.person_id !== ctx.userId) {
    throw new Error('SHIFT_SWAP_FORBIDDEN: Solo puedes solicitar intercambio sobre tu propio turno.');
  }

  if (!isEmploymentActiveOnDate(requesterEmployment, requesterEntry.date)) {
    throw new Error('SHIFT_SWAP_INACTIVE_REQUESTER: Tu relacion laboral no esta activa en esa fecha.');
  }

  if (!isEmploymentActiveOnDate(targetEmployment, targetEntry.date)) {
    throw new Error('SHIFT_SWAP_INACTIVE_TARGET: La otra relacion laboral no esta activa en esa fecha.');
  }

  if ((requesterEmployment.job_title ?? '') !== (targetEmployment.job_title ?? '')) {
    throw new Error('SHIFT_SWAP_JOB_TITLE_MISMATCH: Los puestos no son compatibles.');
  }

  if (
    deriveResponsibilityLevel(requesterEmployment.system_role) !==
    deriveResponsibilityLevel(targetEmployment.system_role)
  ) {
    throw new Error('SHIFT_SWAP_RESPONSIBILITY_MISMATCH: El nivel de responsabilidad no es compatible.');
  }

  const admin = createSupabaseAdminClient();
  const payload = {
    reason: input.reason ?? null,
    requester_employee_id: requesterEmployment.person_id,
    requester_schedule_entry_id: requesterEntry.id,
    status: 'pending_peer',
    target_employee_id: targetEmployment.person_id,
    target_schedule_entry_id: targetEntry.id,
  };
  const { data, error } = await admin
    .from('shift_swap_requests')
    .insert(payload)
    .select(
      'shift_swap_request_id, requester_employee_id, target_employee_id, requester_schedule_entry_id, target_schedule_entry_id, status, requested_at, peer_responded_at, reviewed_by, reviewed_at, reason',
    )
    .single();

  if (error) {
    throw new Error(`Failed to create shift swap request: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.shiftSwapRequested,
    entityId: data.shift_swap_request_id,
    entityType: 'shift_swap_request',
    newValue: payload,
    scopeId: requesterEntry.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  await notifyPerson({
    body: 'Tienes una nueva solicitud de intercambio de turno.',
    entityId: data.shift_swap_request_id as string,
    entityType: 'shift_swap_request',
    notificationType: 'shift_swap_request',
    recipientPersonId: targetEmployment.person_id,
    scopeId: requesterEntry.restaurant_id,
    scopeType: 'restaurant',
    sendPush: true,
    title: 'Solicitud de intercambio',
    traceId: ctx.requestContext.traceId,
  });

  return data as ShiftSwapRequestRecord;
}

export async function respondToShiftSwapPeer(
  shiftSwapRequestId: string,
  accept: boolean,
): Promise<ShiftSwapRequestRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin
    .from('shift_swap_requests')
    .select(
      'shift_swap_request_id, requester_employee_id, target_employee_id, requester_schedule_entry_id, target_schedule_entry_id, status, requested_at, peer_responded_at, reviewed_by, reviewed_at, reason',
    )
    .eq('shift_swap_request_id', shiftSwapRequestId)
    .single();

  if (currentError) {
    throw new Error(`Failed to load shift swap request: ${currentError.message}`);
  }

  if (current.target_employee_id !== ctx.userId) {
    throw new Error('SHIFT_SWAP_FORBIDDEN: Solo la persona destino puede responder esta solicitud.');
  }

  const requesterEntry = await loadScheduleEntrySnapshot(
    current.requester_schedule_entry_id as string,
  );
  const nextStatus = accept ? 'pending_manager' : 'rejected_peer';
  const patch = {
    peer_responded_at: new Date().toISOString(),
    status: nextStatus,
  };
  const { data, error } = await admin
    .from('shift_swap_requests')
    .update(patch)
    .eq('shift_swap_request_id', shiftSwapRequestId)
    .select(
      'shift_swap_request_id, requester_employee_id, target_employee_id, requester_schedule_entry_id, target_schedule_entry_id, status, requested_at, peer_responded_at, reviewed_by, reviewed_at, reason',
    )
    .single();

  if (error) {
    throw new Error(`Failed to respond shift swap request: ${error.message}`);
  }

  await writeAuditLog({
    action: accept ? AUDIT_ACTIONS.shiftSwapPeerAccepted : AUDIT_ACTIONS.shiftSwapPeerRejected,
    entityId: shiftSwapRequestId,
    entityType: 'shift_swap_request',
    newValue: patch,
    previousValue: { status: current.status },
    scopeId: requesterEntry.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  await notifyPerson({
    body: accept
      ? 'Tu solicitud de intercambio ya esta pendiente de revision de manager.'
      : 'Tu solicitud de intercambio fue rechazada por la otra persona.',
    entityId: shiftSwapRequestId,
    entityType: 'shift_swap_request',
    notificationType: accept ? 'shift_swap_accepted' : 'shift_swap_rejected',
    recipientPersonId: current.requester_employee_id as string,
    scopeId: requesterEntry.restaurant_id,
    scopeType: 'restaurant',
    sendPush: true,
    title: 'Actualizacion de intercambio',
    traceId: ctx.requestContext.traceId,
  });

  if (accept) {
    const managers = await listRestaurantManagers(requesterEntry.restaurant_id);
    if (managers.length > 0) {
      await notifyPeople(
        managers.map((recipientPersonId) => ({
          body: 'Hay un intercambio de turno pendiente de aprobacion.',
          entityId: shiftSwapRequestId,
          entityType: 'shift_swap_request',
          notificationType: 'shift_swap_pending_manager',
          recipientPersonId,
          scopeId: requesterEntry.restaurant_id,
          scopeType: 'restaurant',
          title: 'Intercambio pendiente',
          traceId: ctx.requestContext.traceId,
        })),
      );
    }
  }

  return data as ShiftSwapRequestRecord;
}

export async function cancelRequest(requestId: string): Promise<RequestRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin
    .from('requests')
    .select(
      'request_id, employment_id, request_type, status, requested_by, reviewed_by, effective_start_date, effective_end_date, resolution_note, created_at, updated_at',
    )
    .eq('request_id', requestId)
    .single();

  if (currentError) {
    throw new Error(`Failed to load request: ${currentError.message}`);
  }

  if (current.requested_by !== ctx.userId) {
    throw new Error('REQUEST_CANCEL_FORBIDDEN: Solo el solicitante puede cancelar su propia solicitud.');
  }

  const CANCELLABLE_STATUSES = new Set(['pending', 'in_review']);
  if (!CANCELLABLE_STATUSES.has(current.status as string)) {
    throw new Error(`REQUEST_INVALID_TRANSITION: No se puede cancelar una solicitud en estado '${current.status}'.`);
  }

  const patch = { resolution_note: null, reviewed_by: null, status: 'cancelled' };
  const { data, error } = await admin
    .from('requests')
    .update(patch)
    .eq('request_id', requestId)
    .select(
      'request_id, employment_id, request_type, status, requested_by, reviewed_by, effective_start_date, effective_end_date, resolution_note, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to cancel request: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.requestStatusChanged,
    entityId: requestId,
    entityType: 'request',
    newValue: patch,
    previousValue: { status: current.status },
    scopeId: null,
    scopeType: null,
    traceId: ctx.requestContext.traceId,
  });

  return data as RequestRecord;
}

export async function cancelShiftSwapRequest(
  shiftSwapRequestId: string,
): Promise<ShiftSwapRequestRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin
    .from('shift_swap_requests')
    .select(
      'shift_swap_request_id, requester_employee_id, target_employee_id, requester_schedule_entry_id, target_schedule_entry_id, status, requested_at, peer_responded_at, reviewed_by, reviewed_at, reason',
    )
    .eq('shift_swap_request_id', shiftSwapRequestId)
    .single();

  if (currentError) {
    throw new Error(`Failed to load shift swap request: ${currentError.message}`);
  }

  if (current.requester_employee_id !== ctx.userId) {
    throw new Error('SHIFT_SWAP_CANCEL_FORBIDDEN: Solo el solicitante puede cancelar su intercambio.');
  }

  if ((current.status as string) !== 'pending_peer') {
    throw new Error(`SHIFT_SWAP_INVALID_TRANSITION: Solo se puede cancelar un intercambio en estado 'pending_peer'. Estado actual: '${current.status}'.`);
  }

  const patch = { status: 'expired' };
  const { data, error } = await admin
    .from('shift_swap_requests')
    .update(patch)
    .eq('shift_swap_request_id', shiftSwapRequestId)
    .select(
      'shift_swap_request_id, requester_employee_id, target_employee_id, requester_schedule_entry_id, target_schedule_entry_id, status, requested_at, peer_responded_at, reviewed_by, reviewed_at, reason',
    )
    .single();

  if (error) {
    throw new Error(`Failed to cancel shift swap request: ${error.message}`);
  }

  const requesterEntry = await loadScheduleEntrySnapshot(
    current.requester_schedule_entry_id as string,
  );

  await writeAuditLog({
    action: AUDIT_ACTIONS.shiftSwapManagerRejected,
    entityId: shiftSwapRequestId,
    entityType: 'shift_swap_request',
    newValue: patch,
    previousValue: { status: current.status },
    scopeId: requesterEntry.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  await notifyPerson({
    body: 'Tu solicitud de intercambio ha sido cancelada.',
    entityId: shiftSwapRequestId,
    entityType: 'shift_swap_request',
    notificationType: 'shift_swap_rejected',
    recipientPersonId: current.target_employee_id as string,
    scopeId: requesterEntry.restaurant_id,
    scopeType: 'restaurant',
    title: 'Intercambio cancelado',
    traceId: ctx.requestContext.traceId,
  });

  return data as ShiftSwapRequestRecord;
}

export async function reviewShiftSwapRequest(
  shiftSwapRequestId: string,
  approve: boolean,
): Promise<ShiftSwapRequestRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin
    .from('shift_swap_requests')
    .select(
      'shift_swap_request_id, requester_employee_id, target_employee_id, requester_schedule_entry_id, target_schedule_entry_id, status, requested_at, peer_responded_at, reviewed_by, reviewed_at, reason',
    )
    .eq('shift_swap_request_id', shiftSwapRequestId)
    .single();

  if (currentError) {
    throw new Error(`Failed to load shift swap request: ${currentError.message}`);
  }

  if ((current.status as string) !== 'pending_manager') {
    throw new Error(`SHIFT_SWAP_INVALID_TRANSITION: Solo se puede revisar un intercambio en estado 'pending_manager'. Estado actual: '${current.status}'.`);
  }

  const requesterEntry = await loadScheduleEntrySnapshot(
    current.requester_schedule_entry_id as string,
  );
  assertRestaurantManagement(ctx.requestContext, requesterEntry.restaurant_id);

  const patch = {
    reviewed_at: new Date().toISOString(),
    reviewed_by: ctx.userId,
    status: approve ? 'approved' : 'rejected_manager',
  };
  const { data, error } = await admin
    .from('shift_swap_requests')
    .update(patch)
    .eq('shift_swap_request_id', shiftSwapRequestId)
    .select(
      'shift_swap_request_id, requester_employee_id, target_employee_id, requester_schedule_entry_id, target_schedule_entry_id, status, requested_at, peer_responded_at, reviewed_by, reviewed_at, reason',
    )
    .single();

  if (error) {
    throw new Error(`Failed to review shift swap request: ${error.message}`);
  }

  if (approve) {
    const targetEntry = await loadScheduleEntrySnapshot(
      current.target_schedule_entry_id as string,
    );
    const requesterEmploymentId = requesterEntry.employment_id;
    const targetEmploymentId = targetEntry.employment_id;

    const { error: swapRequesterError } = await admin
      .from('schedule_entries')
      .update({ employment_id: targetEmploymentId })
      .eq('id', requesterEntry.id);
    if (swapRequesterError) {
      throw new Error(`Failed to swap requester entry: ${swapRequesterError.message}`);
    }

    const { error: swapTargetError } = await admin
      .from('schedule_entries')
      .update({ employment_id: requesterEmploymentId })
      .eq('id', targetEntry.id);
    if (swapTargetError) {
      throw new Error(`Failed to swap target entry: ${swapTargetError.message}`);
    }
  }

  await writeAuditLog({
    action: approve
      ? AUDIT_ACTIONS.shiftSwapManagerApproved
      : AUDIT_ACTIONS.shiftSwapManagerRejected,
    entityId: shiftSwapRequestId,
    entityType: 'shift_swap_request',
    newValue: patch,
    previousValue: { reviewed_by: current.reviewed_by, status: current.status },
    scopeId: requesterEntry.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  await notifyPeople([
    {
      body: approve
        ? 'Tu intercambio de turno fue aprobado.'
        : 'Tu intercambio de turno fue rechazado.',
      entityId: shiftSwapRequestId,
      entityType: 'shift_swap_request',
      notificationType: approve
        ? 'shift_swap_manager_approved'
        : 'shift_swap_manager_rejected',
      recipientPersonId: current.requester_employee_id as string,
      scopeId: requesterEntry.restaurant_id,
      scopeType: 'restaurant',
      sendPush: true,
      title: 'Revision de intercambio',
      traceId: ctx.requestContext.traceId,
    },
    {
      body: approve
        ? 'Tu intercambio de turno fue aprobado.'
        : 'Tu intercambio de turno fue rechazado.',
      entityId: shiftSwapRequestId,
      entityType: 'shift_swap_request',
      notificationType: approve
        ? 'shift_swap_manager_approved'
        : 'shift_swap_manager_rejected',
      recipientPersonId: current.target_employee_id as string,
      scopeId: requesterEntry.restaurant_id,
      scopeType: 'restaurant',
      sendPush: true,
      title: 'Revision de intercambio',
      traceId: ctx.requestContext.traceId,
    },
  ]);

  return data as ShiftSwapRequestRecord;
}
