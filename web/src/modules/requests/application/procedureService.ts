import 'server-only';

import { AUDIT_ACTIONS, writeAuditLog } from '@/modules/audit';
import { getCurrentUserContext } from '@/modules/auth_users';
import {
  assertRestaurantManagement,
  deriveResponsibilityLevel,
} from '@/modules/authz';
import type { SystemRole } from '@/modules/authz/domain/systemRoles';
import { notifyPeople, notifyPerson } from '@/modules/notifications';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import type {
  CreateProcedureInput,
  CreateShiftSwapRequestInput,
  ProcedureRecord,
  ReviewProcedureInput,
  ShiftSwapRequestRecord,
} from '../domain/procedureTypes';

type EmploymentSnapshot = {
  active_principal: boolean;
  employment_id: string;
  end_date: string | null;
  is_archived: boolean;
  job_title: string | null;
  person_id: string;
  restaurant_id: string;
  start_date: string | null;
  system_role: SystemRole;
};

type ScheduleEntrySnapshot = {
  date: string;
  employment_id: string;
  id: string;
  restaurant_id: string;
};

function isEmploymentActiveOnDate(employment: EmploymentSnapshot, date: string): boolean {
  if (employment.is_archived) return false;
  if (employment.start_date && employment.start_date > date) return false;
  if (employment.end_date && employment.end_date < date) return false;
  return true;
}

async function getRequiredCurrentUserContext() {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    throw new Error('Unauthorized');
  }

  return ctx;
}

async function loadEmploymentSnapshot(employmentId: string): Promise<EmploymentSnapshot> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('employment_relationships')
    .select('employment_id, person_id, restaurant_id, job_title, start_date, end_date, active_principal, is_archived')
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

  return {
    ...(data as Omit<EmploymentSnapshot, 'system_role'>),
    system_role: person.system_role as EmploymentSnapshot['system_role'],
  };
}

async function loadScheduleEntrySnapshot(entryId: string): Promise<ScheduleEntrySnapshot> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('schedule_entries')
    .select('id, date, employment_id, schedules!inner(restaurant_id)')
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
    date: data.date as string,
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
    .eq('active', true);

  if (assignmentError) {
    throw new Error(`Failed to load restaurant scope assignments: ${assignmentError.message}`);
  }

  const personIds = [...new Set((assignments ?? []).map((row) => row.person_id as string))];
  if (personIds.length === 0) return [];

  const { data: people, error: peopleError } = await admin
    .from('persons')
    .select('person_id, system_role')
    .in('person_id', personIds)
    .in('system_role', ['manager', 'sub_manager']);

  if (peopleError) {
    throw new Error(`Failed to load restaurant managers: ${peopleError.message}`);
  }

  return (people ?? []).map((row) => row.person_id as string);
}

export async function listMyProcedures(): Promise<ProcedureRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('procedures')
    .select(
      'procedure_id, employment_id, procedure_type, status, requested_by, reviewed_by, effective_start_date, effective_end_date, resolution_note, created_at, updated_at',
    )
    .eq('requested_by', ctx.userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list procedures: ${error.message}`);
  }

  return (data ?? []) as ProcedureRecord[];
}

export async function listRestaurantProcedures(
  restaurantId: string,
): Promise<ProcedureRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  assertRestaurantManagement(ctx.requestContext, restaurantId);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('procedures')
    .select(
      'procedure_id, employment_id, procedure_type, status, requested_by, reviewed_by, effective_start_date, effective_end_date, resolution_note, created_at, updated_at, employment_relationships!inner(restaurant_id)',
    )
    .eq('employment_relationships.restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list restaurant procedures: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    created_at: row.created_at as string,
    effective_end_date: row.effective_end_date as string | null,
    effective_start_date: row.effective_start_date as string | null,
    employment_id: row.employment_id as string,
    procedure_id: row.procedure_id as string,
    procedure_type: row.procedure_type as ProcedureRecord['procedure_type'],
    requested_by: row.requested_by as string,
    resolution_note: row.resolution_note as string | null,
    reviewed_by: row.reviewed_by as string | null,
    status: row.status as ProcedureRecord['status'],
    updated_at: row.updated_at as string,
  }));
}

export async function createProcedure(input: CreateProcedureInput): Promise<ProcedureRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const employment = await loadEmploymentSnapshot(input.employmentId);

  if (ctx.userId !== employment.person_id) {
    assertRestaurantManagement(ctx.requestContext, employment.restaurant_id);
  }

  const admin = createSupabaseAdminClient();
  const payload = {
    effective_end_date: input.effectiveEndDate ?? null,
    effective_start_date: input.effectiveStartDate ?? null,
    employment_id: input.employmentId,
    procedure_type: input.procedureType,
    requested_by: ctx.userId,
    status: 'requested',
  };
  const { data, error } = await admin
    .from('procedures')
    .insert(payload)
    .select(
      'procedure_id, employment_id, procedure_type, status, requested_by, reviewed_by, effective_start_date, effective_end_date, resolution_note, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to create procedure: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.procedureCreated,
    entityId: data.procedure_id,
    entityType: 'procedure',
    newValue: payload,
    scopeId: employment.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  const managers = await listRestaurantManagers(employment.restaurant_id);
  if (managers.length > 0) {
    await notifyPeople(
      managers.map((recipientPersonId) => ({
        body: 'Hay un tramite pendiente de revision en tu restaurante.',
        entityId: data.procedure_id as string,
        entityType: 'procedure',
        notificationType: 'procedure_created',
        recipientPersonId,
        scopeId: employment.restaurant_id,
        scopeType: 'restaurant',
        sendPush: true,
        title: 'Nuevo tramite',
        traceId: ctx.requestContext.traceId,
      })),
    );
  }

  return data as ProcedureRecord;
}

export async function reviewProcedure(input: ReviewProcedureInput): Promise<ProcedureRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin
    .from('procedures')
    .select(
      'procedure_id, employment_id, procedure_type, status, requested_by, reviewed_by, effective_start_date, effective_end_date, resolution_note, created_at, updated_at',
    )
    .eq('procedure_id', input.procedureId)
    .single();

  if (currentError) {
    throw new Error(`Failed to load procedure: ${currentError.message}`);
  }

  const employment = await loadEmploymentSnapshot(current.employment_id as string);
  assertRestaurantManagement(ctx.requestContext, employment.restaurant_id);

  if (current.requested_by === ctx.userId) {
    throw new Error('PROCEDURE_SELF_APPROVAL_FORBIDDEN: No puedes autoaprobar tu propio tramite.');
  }

  const patch = {
    resolution_note: input.resolutionNote ?? null,
    reviewed_by: ctx.userId,
    status: input.status,
  };
  const { data, error } = await admin
    .from('procedures')
    .update(patch)
    .eq('procedure_id', input.procedureId)
    .select(
      'procedure_id, employment_id, procedure_type, status, requested_by, reviewed_by, effective_start_date, effective_end_date, resolution_note, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to review procedure: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.procedureStatusChanged,
    entityId: input.procedureId,
    entityType: 'procedure',
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
      ? 'procedure_approved'
      : input.status === 'rejected'
        ? 'procedure_rejected'
        : 'procedure_in_review';

  await notifyPerson({
    body:
      input.status === 'approved'
        ? 'Tu tramite ha sido aprobado.'
        : input.status === 'rejected'
          ? 'Tu tramite ha sido rechazado.'
          : 'Tu tramite ha cambiado de estado.',
    entityId: input.procedureId,
    entityType: 'procedure',
    notificationType,
    recipientPersonId: current.requested_by as string,
    scopeId: employment.restaurant_id,
    scopeType: 'restaurant',
    sendPush: input.status === 'approved' || input.status === 'rejected',
    title: 'Actualizacion de tramite',
    traceId: ctx.requestContext.traceId,
  });

  return data as ProcedureRecord;
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

  const requesterEmployment = await loadEmploymentSnapshot(requesterEntry.employment_id);
  const targetEmployment = await loadEmploymentSnapshot(targetEntry.employment_id);

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
