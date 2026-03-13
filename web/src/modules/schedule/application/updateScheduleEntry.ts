import type { ScheduleEntry } from '../domain/scheduleTypes';
import { updateSingleEntry } from '../infrastructure/scheduleRepository';

function readErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const maybeCode = (error as { code?: unknown }).code;
  return typeof maybeCode === 'string' ? maybeCode : null;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function updateEntry(
  id: string,
  version: number,
  updates: Record<string, unknown>,
): Promise<ScheduleEntry> {
  try {
    return await updateSingleEntry(id, version, updates);
  } catch (error: unknown) {
    const code = readErrorCode(error);
    const message = readErrorMessage(error);

    if (code === 'PGRST116' || code === 'SCHEDULE_UPDATE_CONFLICT' || message.includes('0 rows')) {
      throw new Error('CONCURRENCY_ERROR: Alguien mas actualizo esta celda. Recarga el horario.');
    }

    throw error;
  }
}
