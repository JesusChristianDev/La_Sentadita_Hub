'use server';

import { revalidatePath } from 'next/cache';

import { CreateTaskInstanceSchema } from '../domain/taskSchemas';
import {
  completeTaskInstance,
  createTaskInstance,
} from './taskService';

export async function completeTaskAction(taskInstanceId: string) {
  try {
    await completeTaskInstance(taskInstanceId);
    revalidatePath('/tasks');
    return { ok: true as const };
  } catch (err: unknown) {
    console.error('[completeTaskAction] Error:', err);
    return { ok: false as const, error: err instanceof Error ? err.message : 'Error al completar la tarea' };
  }
}

export async function createTaskAction(formData: FormData) {
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
    return {
      ok: false as const,
      error: 'Error de validación',
      issues: parsed.error.issues,
    };
  }

  try {
    const task = await createTaskInstance(parsed.data);
    revalidatePath('/tasks');
    return { ok: true as const, task };
  } catch (err: unknown) {
    console.error('[createTaskAction] Error:', err);
    return { ok: false as const, error: err instanceof Error ? err.message : 'Error al crear la tarea' };
  }
}
