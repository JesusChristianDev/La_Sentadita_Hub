import type { AppRole } from '@/modules/auth_users';

import type { ScheduleLock } from '../domain/scheduleTypes';

type LockRankActor = {
  id: string;
  is_area_lead: boolean;
  role: AppRole;
  zone_id: string | null;
};

type ScheduleLockServiceDeps = {
  acquireLock: (scheduleId: string) => Promise<ScheduleLock>;
  forceReleaseLock: (scheduleId: string) => Promise<void>;
  getActiveScheduleLock: (
    scheduleId: string,
  ) => Promise<(ScheduleLock & { locked_by: string | null }) | null>;
  getActorRank: (actor: LockRankActor) => number;
  getLockOwnerActor: (userId: string) => Promise<LockRankActor | null>;
};

export function createScheduleLockService(deps: ScheduleLockServiceDeps) {
  async function ensureLockOwnedByUser(params: {
    scheduleId: string;
    userId: string;
  }): Promise<void> {
    const lock = await deps.getActiveScheduleLock(params.scheduleId);
    if (!lock || lock.locked_by !== params.userId) {
      throw new Error(
        'SCHEDULE_LOCK_REQUIRED: Debes adquirir el bloqueo antes de editar o publicar.',
      );
    }
  }

  async function acquireOrReuseLock(params: {
    scheduleId: string;
    userId: string;
  }): Promise<ScheduleLock> {
    const existing = await deps.getActiveScheduleLock(params.scheduleId);
    if (existing && existing.locked_by === params.userId) {
      return {
        ...existing,
        acquired: true,
      };
    }

    return deps.acquireLock(params.scheduleId);
  }

  async function forceUnlock(params: {
    actor: LockRankActor;
    scheduleId: string;
  }): Promise<void> {
    const lock = await deps.getActiveScheduleLock(params.scheduleId);
    if (!lock?.locked_by) return;

    const lockedActor = await deps.getLockOwnerActor(lock.locked_by);
    const actorRank = deps.getActorRank(params.actor);
    const targetRank = lockedActor ? deps.getActorRank(lockedActor) : -1;

    if (actorRank <= targetRank) {
      throw new Error('FORBIDDEN: Solo un rol superior puede forzar este bloqueo.');
    }

    await deps.forceReleaseLock(params.scheduleId);
  }

  return {
    acquireOrReuseLock,
    ensureLockOwnedByUser,
    forceUnlock,
  };
}
