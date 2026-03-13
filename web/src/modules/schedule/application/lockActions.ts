import { acquireLock, releaseLock } from '../infrastructure/scheduleRepository';

export async function lockSchedule(scheduleId: string) {
  const result = await acquireLock(scheduleId);
  return result;
}

export async function unlockSchedule(scheduleId: string) {
  await releaseLock(scheduleId);
}
