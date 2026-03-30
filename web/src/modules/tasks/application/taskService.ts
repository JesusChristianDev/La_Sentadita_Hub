import 'server-only';

import { AUDIT_ACTIONS, writeAuditLog } from '@/modules/audit';
import { getCurrentUserContext } from '@/modules/auth_users';
import {
  assertRestaurantAccess,
  assertRestaurantManagement,
  canManageRestaurant,
} from '@/modules/authz';
import { notifyPeople, notifyPerson } from '@/modules/notifications';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import type {
  CreateTaskInstanceInput,
  CreateTaskTemplateInput,
  ReassignTaskInstanceInput,
  TaskCancelReason,
  TaskInstanceRecord,
  TaskTemplateRecord,
} from '../domain/taskTypes';

async function getRequiredCurrentUserContext() {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    throw new Error('Unauthorized');
  }

  return ctx;
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
    .select('person_id')
    .in('person_id', personIds)
    .eq('system_role', 'manager');

  if (peopleError) {
    throw new Error(`Failed to load restaurant managers: ${peopleError.message}`);
  }

  return (people ?? []).map((row) => row.person_id as string);
}

function assertTaskHasResponsible(input: {
  assignedEmployeeId?: string | null;
  assignedRole?: string | null;
  assignedZoneId?: string | null;
}): void {
  if (input.assignedEmployeeId || input.assignedRole || input.assignedZoneId) {
    return;
  }

  throw new Error('TASK_RESPONSIBLE_REQUIRED: Toda tarea debe nacer con al menos un responsable.');
}

async function loadTaskInstance(taskInstanceId: string): Promise<TaskInstanceRecord> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('task_instances')
    .select(
      'task_instance_id, task_template_id, restaurant_id, task_date, shift_context, assigned_role, assigned_zone_id, assigned_employee_id, task_status, cancel_reason, reassignment_reason, due_at, completed_by, completed_at, requires_confirmation, confirmed_by, confirmed_at, confirmation_note, confirmation_photo_url, created_at, updated_at',
    )
    .eq('task_instance_id', taskInstanceId)
    .single();

  if (error) {
    throw new Error(`Failed to load task instance: ${error.message}`);
  }

  return data as TaskInstanceRecord;
}

export async function listTaskTemplates(
  restaurantId: string,
): Promise<TaskTemplateRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  assertRestaurantAccess(ctx.requestContext, restaurantId);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('task_templates')
    .select(
      'task_template_id, restaurant_id, title, description, recurrence_type, due_rule, requires_confirmation, confirmation_mode, confirmation_role, confirmation_employee_id, plannable_in_schedule, active, is_archived, created_at, updated_at',
    )
    .eq('restaurant_id', restaurantId)
    .order('title', { ascending: true });

  if (error) {
    throw new Error(`Failed to list task templates: ${error.message}`);
  }

  return (data ?? []) as TaskTemplateRecord[];
}

export async function createTaskTemplate(
  input: CreateTaskTemplateInput,
): Promise<TaskTemplateRecord> {
  const ctx = await getRequiredCurrentUserContext();
  assertRestaurantManagement(ctx.requestContext, input.restaurantId);

  const admin = createSupabaseAdminClient();
  const payload = {
    active: true,
    confirmation_employee_id: input.confirmationEmployeeId ?? null,
    confirmation_mode: input.confirmationMode ?? null,
    confirmation_role: input.confirmationRole ?? null,
    description: input.description ?? null,
    due_rule: input.dueRule,
    plannable_in_schedule: input.plannableInSchedule ?? false,
    recurrence_type: input.recurrenceType,
    requires_confirmation: input.requiresConfirmation ?? false,
    restaurant_id: input.restaurantId,
    title: input.title,
  };
  const { data, error } = await admin
    .from('task_templates')
    .insert(payload)
    .select(
      'task_template_id, restaurant_id, title, description, recurrence_type, due_rule, requires_confirmation, confirmation_mode, confirmation_role, confirmation_employee_id, plannable_in_schedule, active, is_archived, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to create task template: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.taskCreated,
    entityId: data.task_template_id,
    entityType: 'task_template',
    newValue: payload,
    scopeId: input.restaurantId,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  return data as TaskTemplateRecord;
}

export async function listTaskInstances(
  restaurantId: string,
  taskDate?: string,
): Promise<TaskInstanceRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  assertRestaurantAccess(ctx.requestContext, restaurantId);

  const admin = createSupabaseAdminClient();
  let query = admin
    .from('task_instances')
    .select(
      'task_instance_id, task_template_id, restaurant_id, task_date, shift_context, assigned_role, assigned_zone_id, assigned_employee_id, task_status, cancel_reason, reassignment_reason, due_at, completed_by, completed_at, requires_confirmation, confirmed_by, confirmed_at, confirmation_note, confirmation_photo_url, created_at, updated_at',
    )
    .eq('restaurant_id', restaurantId)
    .order('task_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (taskDate) {
    query = query.eq('task_date', taskDate);
  }

  if (!canManageRestaurant(ctx.requestContext, restaurantId)) {
    query = query.or(
      `assigned_employee_id.eq.${ctx.userId},assigned_role.eq.${ctx.requestContext.systemRole}`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list task instances: ${error.message}`);
  }

  return (data ?? []) as TaskInstanceRecord[];
}

export async function createTaskInstance(
  input: CreateTaskInstanceInput,
): Promise<TaskInstanceRecord> {
  const ctx = await getRequiredCurrentUserContext();
  assertRestaurantManagement(ctx.requestContext, input.restaurantId);
  assertTaskHasResponsible(input);

  const admin = createSupabaseAdminClient();
  const payload = {
    assigned_employee_id: input.assignedEmployeeId ?? null,
    assigned_role: input.assignedRole ?? null,
    assigned_zone_id: input.assignedZoneId ?? null,
    due_at: input.dueAt ?? null,
    reassignment_reason: null,
    requires_confirmation: input.requiresConfirmation ?? false,
    restaurant_id: input.restaurantId,
    shift_context: input.shiftContext ?? null,
    task_date: input.taskDate,
    task_status: 'pending',
    task_template_id: input.taskTemplateId ?? null,
  };
  const { data, error } = await admin
    .from('task_instances')
    .insert(payload)
    .select(
      'task_instance_id, task_template_id, restaurant_id, task_date, shift_context, assigned_role, assigned_zone_id, assigned_employee_id, task_status, cancel_reason, reassignment_reason, due_at, completed_by, completed_at, requires_confirmation, confirmed_by, confirmed_at, confirmation_note, confirmation_photo_url, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to create task instance: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.taskCreated,
    entityId: data.task_instance_id,
    entityType: 'task_instance',
    newValue: payload,
    scopeId: input.restaurantId,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  if (input.assignedEmployeeId) {
    await notifyPerson({
      body: 'Se te ha asignado una nueva tarea.',
      entityId: data.task_instance_id,
      entityType: 'task_instance',
      notificationType: 'task_assigned',
      recipientPersonId: input.assignedEmployeeId,
      scopeId: input.restaurantId,
      scopeType: 'restaurant',
      sendPush: true,
      title: 'Nueva tarea',
      traceId: ctx.requestContext.traceId,
    });
  }

  return data as TaskInstanceRecord;
}

export async function completeTaskInstance(
  taskInstanceId: string,
): Promise<TaskInstanceRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const current = await loadTaskInstance(taskInstanceId);
  assertRestaurantAccess(ctx.requestContext, current.restaurant_id);

  const canComplete =
    canManageRestaurant(ctx.requestContext, current.restaurant_id) ||
    current.assigned_employee_id === ctx.userId ||
    current.assigned_role === ctx.requestContext.systemRole;

  if (!canComplete) {
    throw new Error('FORBIDDEN: No puedes completar esta tarea.');
  }

  const patch = {
    completed_at: new Date().toISOString(),
    completed_by: ctx.userId,
    task_status: 'completed',
  };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('task_instances')
    .update(patch)
    .eq('task_instance_id', taskInstanceId)
    .select(
      'task_instance_id, task_template_id, restaurant_id, task_date, shift_context, assigned_role, assigned_zone_id, assigned_employee_id, task_status, cancel_reason, reassignment_reason, due_at, completed_by, completed_at, requires_confirmation, confirmed_by, confirmed_at, confirmation_note, confirmation_photo_url, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to complete task instance: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.taskStatusChanged,
    entityId: taskInstanceId,
    entityType: 'task_instance',
    newValue: patch,
    previousValue: { task_status: current.task_status },
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  return data as TaskInstanceRecord;
}

export async function confirmTaskInstance(
  taskInstanceId: string,
  note?: string | null,
): Promise<TaskInstanceRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const current = await loadTaskInstance(taskInstanceId);
  assertRestaurantManagement(ctx.requestContext, current.restaurant_id);

  if (!current.requires_confirmation) {
    throw new Error('TASK_CONFIRMATION_NOT_REQUIRED: Esta tarea no requiere confirmacion.');
  }

  const patch = {
    confirmation_note: note ?? null,
    confirmed_at: new Date().toISOString(),
    confirmed_by: ctx.userId,
  };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('task_instances')
    .update(patch)
    .eq('task_instance_id', taskInstanceId)
    .select(
      'task_instance_id, task_template_id, restaurant_id, task_date, shift_context, assigned_role, assigned_zone_id, assigned_employee_id, task_status, cancel_reason, reassignment_reason, due_at, completed_by, completed_at, requires_confirmation, confirmed_by, confirmed_at, confirmation_note, confirmation_photo_url, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to confirm task instance: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.taskConfirmed,
    entityId: taskInstanceId,
    entityType: 'task_instance',
    newValue: patch,
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  return data as TaskInstanceRecord;
}

export async function cancelTaskInstance(
  taskInstanceId: string,
  reason: TaskCancelReason,
): Promise<TaskInstanceRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const current = await loadTaskInstance(taskInstanceId);
  assertRestaurantManagement(ctx.requestContext, current.restaurant_id);

  const patch = {
    cancel_reason: reason,
    reassignment_reason: null,
    task_status: 'cancelled',
  };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('task_instances')
    .update(patch)
    .eq('task_instance_id', taskInstanceId)
    .select(
      'task_instance_id, task_template_id, restaurant_id, task_date, shift_context, assigned_role, assigned_zone_id, assigned_employee_id, task_status, cancel_reason, reassignment_reason, due_at, completed_by, completed_at, requires_confirmation, confirmed_by, confirmed_at, confirmation_note, confirmation_photo_url, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to cancel task instance: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.taskCancelled,
    entityId: taskInstanceId,
    entityType: 'task_instance',
    newValue: patch,
    previousValue: { task_status: current.task_status },
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  if (current.assigned_employee_id) {
    await notifyPerson({
      body: 'Una tarea asignada a ti ha sido cancelada.',
      entityId: taskInstanceId,
      entityType: 'task_instance',
      notificationType: 'task_cancelled',
      recipientPersonId: current.assigned_employee_id,
      scopeId: current.restaurant_id,
      scopeType: 'restaurant',
      title: 'Tarea cancelada',
      traceId: ctx.requestContext.traceId,
    });
  }

  return data as TaskInstanceRecord;
}

export async function reassignTaskInstance(
  input: ReassignTaskInstanceInput,
): Promise<TaskInstanceRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const current = await loadTaskInstance(input.taskInstanceId);
  assertRestaurantManagement(ctx.requestContext, current.restaurant_id);
  assertTaskHasResponsible(input);

  const patch = {
    assigned_employee_id: input.assignedEmployeeId ?? null,
    assigned_role: input.assignedRole ?? null,
    assigned_zone_id: input.assignedZoneId ?? null,
    cancel_reason: null,
    reassignment_reason: input.reason,
    task_status: 'pending',
  };
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('task_instances')
    .update(patch)
    .eq('task_instance_id', input.taskInstanceId)
    .select(
      'task_instance_id, task_template_id, restaurant_id, task_date, shift_context, assigned_role, assigned_zone_id, assigned_employee_id, task_status, cancel_reason, reassignment_reason, due_at, completed_by, completed_at, requires_confirmation, confirmed_by, confirmed_at, confirmation_note, confirmation_photo_url, created_at, updated_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to reassign task instance: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.taskReassigned,
    entityId: input.taskInstanceId,
    entityType: 'task_instance',
    newValue: patch,
    previousValue: {
      assigned_employee_id: current.assigned_employee_id,
      assigned_role: current.assigned_role,
      assigned_zone_id: current.assigned_zone_id,
      task_status: current.task_status,
    },
    scopeId: current.restaurant_id,
    scopeType: 'restaurant',
    traceId: ctx.requestContext.traceId,
  });

  if (input.assignedEmployeeId) {
    await notifyPerson({
      body: 'Se te ha reasignado una tarea.',
      entityId: input.taskInstanceId,
      entityType: 'task_instance',
      notificationType: 'task_assigned',
      recipientPersonId: input.assignedEmployeeId,
      scopeId: current.restaurant_id,
      scopeType: 'restaurant',
      sendPush: true,
      title: 'Tarea reasignada',
      traceId: ctx.requestContext.traceId,
    });
  } else {
    const managers = await listRestaurantManagers(current.restaurant_id);
    if (managers.length > 0) {
      await notifyPeople(
        managers.map((recipientPersonId) => ({
          body: 'Una tarea necesita reasignacion manual.',
          entityId: input.taskInstanceId,
          entityType: 'task_instance',
          notificationType: 'task_needs_reassignment',
          recipientPersonId,
          scopeId: current.restaurant_id,
          scopeType: 'restaurant',
          title: 'Tarea sin responsable',
          traceId: ctx.requestContext.traceId,
        })),
      );
    }
  }

  return data as TaskInstanceRecord;
}
