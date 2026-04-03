import { type ActorLike, assertCan } from '@/shared/authz';

import { acquireLock, releaseLock } from '../infrastructure/scheduleRepository';

export async function lockSchedule(actor: ActorLike, scheduleId: string) {
  assertCan(actor, 'schedule.edit_draft');
  const result = await acquireLock(scheduleId);
  return result;
}

export async function unlockSchedule(actor: ActorLike, scheduleId: string) {
  assertCan(actor, 'schedule.edit_draft');
  await releaseLock(scheduleId);
}
