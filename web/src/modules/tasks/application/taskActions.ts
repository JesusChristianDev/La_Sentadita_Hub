'use server';

import { revalidatePath } from 'next/cache';

import { CreateTaskInstanceSchema, ReassignTaskInstanceSchema } from '../domain/taskSchemas';
import {
  cancelTaskInstance,
  completeTaskInstance,
  confirmTaskInstance,
  createTaskInstance,
  reassignTaskInstance,
} from './taskService';

type ActionResult = { ok: true } | { ok: false; error: string };

function handleError(err: unknown, fallback: string): ActionResult {
  return { ok: false, error: err instanceof Error ? err.message : fallback };
}

export async function completeTaskAction(taskInstanceId: string): Promise<ActionResult> {
  try {
    await completeTaskInstance(taskInstanceId);
    revalidatePath('/tasks');
    return { ok: true };
  } catch (err: unknown) {
    console.error('[completeTaskAction] Error:', err);
    return handleError(err, 'Error al completar la tarea');
  }
}

export async function confirmTaskAction(
  taskInstanceId: string,
  note?: string | null,
): Promise<ActionResult> {
  try {
    await confirmTaskInstance(taskInstanceId, note);
    revalidatePath('/tasks');
    return { ok: true };
  } catch (err: unknown) {
    console.error('[confirmTaskAction] Error:', err);
    return handleError(err, 'Error al confirmar la tarea');
  }
}

export async function cancelTaskAction(
  taskInstanceId: string,
  reason: string,
): Promise<ActionResult> {
  const VALID_REASONS = ['schedule_change', 'employment_change', 'template_deactivated', 'manual_cancel'] as const;
  if (!VALID_REASONS.includes(reason as (typeof VALID_REASONS)[number])) {
    return { ok: false, error: 'Motivo de cancelación inválido' };
  }
  try {
    await cancelTaskInstance(taskInstanceId, reason as (typeof VALID_REASONS)[number]);
    revalidatePath('/tasks');
    return { ok: true };
  } catch (err: unknown) {
    console.error('[cancelTaskAction] Error:', err);
    return handleError(err, 'Error al cancelar la tarea');
  }
}

export async function reassignTaskAction(formData: FormData): Promise<ActionResult> {
  const rawData = {
    taskInstanceId: formData.get('taskInstanceId') as string,
    assignedEmployeeId: formData.get('assignedEmployeeId') as string || null,
    assignedRole: formData.get('assignedRole') as string || null,
    assignedZoneId: formData.get('assignedZoneId') as string || null,
    reason: formData.get('reason') as string,
  };
  const parsed = ReassignTaskInstanceSchema.safeParse(rawData);
  if (!parsed.success) {
    return { ok: false, error: 'Datos de reasignación inválidos' };
  }
  try {
    await reassignTaskInstance(parsed.data);
    revalidatePath('/tasks');
    return { ok: true };
  } catch (err: unknown) {
    console.error('[reassignTaskAction] Error:', err);
    return handleError(err, 'Error al reasignar la tarea');
  }
}

export async function createTaskAction(formData: FormData): Promise<ActionResult & { task?: unknown }> {
  const rawData = {
    restaurantId: formData.get('restaurantId') as string,
    taskDate: formData.get('taskDate') as string,
    assignedEmployeeId: formData.get('assignedEmployeeId') as string || null,
    assignedRole: formData.get('assignedRole') as string || null,
    assignedZoneId: formData.get('assignedZoneId') as string || null,
    shiftContext: formData.get('shiftContext') as string || null,
    requiresConfirmation: formData.get('requiresConfirmation') === 'true',
  };

  const parsed = CreateTaskInstanceSchema.safeParse(rawData);
  if (!parsed.success) {
    return { ok: false, error: 'Error de validación' };
  }

  try {
    const task = await createTaskInstance(parsed.data);
    revalidatePath('/tasks');
    return { ok: true, task };
  } catch (err: unknown) {
    console.error('[createTaskAction] Error:', err);
    return handleError(err, 'Error al crear la tarea');
  }
}
