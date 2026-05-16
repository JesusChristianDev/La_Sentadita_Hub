import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { AUDIT_ACTIONS, writeAuditLog } from '@/modules/audit';
import { getCurrentUserContext } from '@/modules/auth_users';
import { notifyPeople, notifyPerson } from '@/modules/notifications';
import {
  assertRestaurantAccess,
  assertRestaurantManagement,
  canAccessZone,
} from '@/shared/authz';

import type {
  CreateIncidentInput,
  IncidentCategory,
  IncidentRecord,
  IncidentSeverity,
  IncidentStatus,
} from '../domain/incidentTypes';
import {
  assertRoleAllowedToCreateCategory,
  assertRoleAllowedToMarkRestricted,
  assertValidIncidentTransition,
} from '../domain/incidentStatusRules';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isCurrentTemporalRow(
  row: { valid_from: string; valid_to: string | null },
  today = todayIsoDate(),
): boolean {
  return row.valid_from <= today && (row.valid_to === null || row.valid_to >= today);
}

async function getRequiredCurrentUserContext() {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    throw new Error('Unauthorized');
  }

  return ctx;
}

async function listRestaurantManagers(restaurantId: string): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const today = todayIsoDate();
  const { data: assignments, error: assignmentError } = await admin
    .from('role_scope_assignments')
    .select('person_id, valid_from, valid_to')
    .eq('scope_type', 'restaurant')
    .eq('scope_id', restaurantId);

  if (assignmentError) {
    throw new Error(`Failed to load restaurant scope assignments: ${assignmentError.message}`);
  }

  const personIds = [
    ...new Set(
      (assignments ?? [])
        .filter((row) =>
          isCurrentTemporalRow(
            row as { valid_from: string; valid_to: string | null },
            today,
          ),
        )
        .map((row) => row.person_id as string),
    ),
  ];
  if (personIds.length === 0) return [];

  const { data: people, error: peopleError } = await admin
    .from('persons')
    .select('person_id')
    .in('person_id', personIds)
    .eq('system_role', 'manager')
    .eq('is_archived', false);

  if (peopleError) {
    throw new Error(`Failed to load restaurant managers: ${peopleError.message}`);
  }

  return (people ?? []).map((row) => row.person_id as string);
}

async function loadIncident(incidentId: string): Promise<IncidentRecord> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('incidents')
    .select(
      'incident_id, restaurant_id, zone_id, category, sensitivity, title, description, severity, reported_by, primary_owner, status, created_at, updated_at',
    )
    .eq('incident_id', incidentId)
    .single();

  if (error) {
    throw new Error(`Failed to load incident: ${error.message}`);
  }

  return data as IncidentRecord;
}

export async function listVisibleIncidents(
  restaurantId: string,
): Promise<IncidentRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  assertRestaurantAccess(ctx.requestContext, restaurantId);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('incidents')
    .select(
      'incident_id, restaurant_id, zone_id, category, sensitivity, title, description, severity, reported_by, primary_owner, status, created_at, updated_at',
    )
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list incidents: ${error.message}`);
  }

  const incidents = (data ?? []) as IncidentRecord[];

  if (
    ctx.requestContext.systemRole === 'admin' ||
    ctx.requestContext.systemRole === 'owner' ||
    ctx.requestContext.systemRole === 'office'
  ) {
    return incidents;
  }

  if (ctx.requestContext.systemRole === 'manager') {
    return incidents;
  }

  if (ctx.requestContext.systemRole === 'area_lead') {
    return incidents.filter((incident) => {
      if (incident.reported_by === ctx.userId) {
        return true;
      }

      if (incident.sensitivity === 'restricted') {
        return false;
      }

      return canAccessZone(
        ctx.requestContext,
        incident.restaurant_id,
        incident.zone_id,
      );
    });
  }

  return incidents.filter((incident) => incident.reported_by === ctx.userId);
}

export async function createIncident(input: CreateIncidentInput): Promise<IncidentRecord> {
  const ctx = await getRequiredCurrentUserContext();
  assertRestaurantAccess(ctx.requestContext, input.restaurantId);
  assertRoleAllowedToCreateCategory(ctx.requestContext.systemRole, input.category);
  assertRoleAllowedToMarkRestricted(ctx.requestContext.systemRole, input.sensitivity ?? 'normal');

  const admin = createSupabaseAdminClient();
  const payload = {
    category: input.category,
    description: input.description,
    primary_owner: null,
    reported_by: ctx.userId,
    restaurant_id: input.restaurantId,
    sensitivity: input.sensitivity ?? 'normal',
    severity: input.severity ?? null,
    status: 'reported',
    title: input.title,
    zone_id: input.zoneId ?? null,
  };
  const { data, error } = await admin
    .from('incidents')
    .insert(payload)
    .select(
      'incident_id, restaurant_id, zone_id, category, sensitivity, title, description, severity, reported_by, primary_owner, status, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to create incident: ${error.message}`);
  }

  await writeAuditLog({
    action:
      payload.sensitivity === 'restricted'
        ? AUDIT_ACTIONS.incidentRestrictedMarked
        : AUDIT_ACTIONS.incidentCreated,
    entityId: data.incident_id,
    entityType: 'incident',
    newValue: payload,
    scopeId: input.restaurantId,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  const managers = await listRestaurantManagers(input.restaurantId);
  if (managers.length > 0) {
    await notifyPeople(
      managers.map((recipientPersonId) => ({
        body: 'Se ha reportado una nueva incidencia en tu restaurante.',
        entityId: data.incident_id as string,
        entityType: 'incident',
        notificationType: 'incident_created',
        recipientPersonId,
        scopeId: input.restaurantId,
        scopeType: 'restaurant',
        sendPush: true,
        title: 'Nueva incidencia',
        traceId: ctx.requestContext.traceId,
      })),
    );
  }

  return data as IncidentRecord;
}

export async function updateIncidentStatus(
  incidentId: string,
  status: IncidentStatus,
): Promise<IncidentRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const current = await loadIncident(incidentId);
  assertRestaurantManagement(ctx.requestContext, current.restaurant_id);
  assertValidIncidentTransition(current.status, status);

  const patch = { status };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('incidents')
    .update(patch)
    .eq('incident_id', incidentId)
    .select(
      'incident_id, restaurant_id, zone_id, category, sensitivity, title, description, severity, reported_by, primary_owner, status, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to update incident status: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.incidentStatusChanged,
    entityId: incidentId,
    entityType: 'incident',
    newValue: patch,
    previousValue: { status: current.status },
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  await notifyPerson({
    body:
      status === 'resolved'
        ? 'Tu incidencia ha sido resuelta.'
        : 'Tu incidencia ha cambiado de estado.',
    entityId: incidentId,
    entityType: 'incident',
    notificationType: status === 'resolved' ? 'incident_resolved' : 'incident_status_changed',
    recipientPersonId: current.reported_by,
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    title: 'Actualizacion de incidencia',
    traceId: ctx.requestContext.traceId,
  });

  return data as IncidentRecord;
}

async function assertPersonActiveAtRestaurant(
  personId: string,
  restaurantId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const today = todayIsoDate();

  const { data: person, error: personError } = await admin
    .from('persons')
    .select('person_id, is_archived')
    .eq('person_id', personId)
    .single();

  if (personError || !person) {
    throw new Error('OWNER_NOT_FOUND: La persona no existe.');
  }

  if (person.is_archived) {
    throw new Error('OWNER_ARCHIVED: La persona está archivada y no puede ser asignada.');
  }

  const { data: assignments, error: assignError } = await admin
    .from('employment_restaurant_assignments')
    .select('employment_id, valid_from, valid_to')
    .eq('restaurant_id', restaurantId);

  if (assignError) {
    throw new Error(`Failed to load restaurant assignments: ${assignError.message}`);
  }

  const employmentIds = (assignments ?? [])
    .filter((a) => isCurrentTemporalRow(a as { valid_from: string; valid_to: string | null }, today))
    .map((a) => a.employment_id as string);

  if (employmentIds.length === 0) {
    throw new Error('OWNER_NOT_IN_RESTAURANT: La persona no tiene empleo activo en este restaurante.');
  }

  const { data: employments, error: empError } = await admin
    .from('employment_relationships')
    .select('person_id')
    .in('employment_id', employmentIds)
    .eq('person_id', personId)
    .eq('is_archived', false);

  if (empError) {
    throw new Error(`Failed to validate owner employment: ${empError.message}`);
  }

  if (!employments || employments.length === 0) {
    throw new Error('OWNER_NOT_IN_RESTAURANT: La persona no tiene empleo activo en este restaurante.');
  }
}

export async function assignIncidentOwner(
  incidentId: string,
  ownerPersonId: string,
): Promise<IncidentRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const current = await loadIncident(incidentId);
  assertRestaurantManagement(ctx.requestContext, current.restaurant_id);
  await assertPersonActiveAtRestaurant(ownerPersonId, current.restaurant_id);

  const patch = { primary_owner: ownerPersonId };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('incidents')
    .update(patch)
    .eq('incident_id', incidentId)
    .select(
      'incident_id, restaurant_id, zone_id, category, sensitivity, title, description, severity, reported_by, primary_owner, status, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to assign incident owner: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.incidentAssigned,
    entityId: incidentId,
    entityType: 'incident',
    newValue: patch,
    previousValue: { primary_owner: current.primary_owner },
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  await notifyPerson({
    body: 'Se te ha asignado una incidencia.',
    entityId: incidentId,
    entityType: 'incident',
    notificationType: 'incident_assigned',
    recipientPersonId: ownerPersonId,
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    sendPush: true,
    title: 'Incidencia asignada',
    traceId: ctx.requestContext.traceId,
  });

  return data as IncidentRecord;
}

export type EditIncidentDetailsInput = {
  category?: IncidentCategory;
  description?: string;
  severity?: IncidentSeverity;
  title?: string;
};

export async function editIncidentDetails(
  incidentId: string,
  input: EditIncidentDetailsInput,
): Promise<IncidentRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const current = await loadIncident(incidentId);
  assertRestaurantManagement(ctx.requestContext, current.restaurant_id);

  if (current.status === 'closed') {
    throw new Error('INCIDENT_CLOSED: No se pueden editar los detalles de una incidencia cerrada.');
  }

  if (input.category !== undefined) {
    assertRoleAllowedToCreateCategory(ctx.requestContext.systemRole, input.category);
  }

  const patch: Partial<Pick<IncidentRecord, 'category' | 'description' | 'severity' | 'title'>> = {};
  if (input.category !== undefined) patch.category = input.category;
  if (input.description !== undefined) patch.description = input.description;
  if (input.severity !== undefined) patch.severity = input.severity;
  if (input.title !== undefined) patch.title = input.title;

  if (Object.keys(patch).length === 0) {
    return current;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('incidents')
    .update(patch)
    .eq('incident_id', incidentId)
    .select(
      'incident_id, restaurant_id, zone_id, category, sensitivity, title, description, severity, reported_by, primary_owner, status, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to edit incident details: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.incidentStatusChanged,
    entityId: incidentId,
    entityType: 'incident',
    newValue: patch,
    previousValue: {
      category: current.category,
      description: current.description,
      severity: current.severity,
      title: current.title,
    },
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  return data as IncidentRecord;
}
