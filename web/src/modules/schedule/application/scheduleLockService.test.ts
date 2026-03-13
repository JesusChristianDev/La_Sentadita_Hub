import assert from 'node:assert/strict';
import test from 'node:test';

import { createScheduleLockService } from './scheduleLockService';

test('acquireOrReuseLock returns the active lock as acquired when it already belongs to the user', async () => {
  let acquireCalls = 0;

  const service = createScheduleLockService({
    acquireLock: async () => {
      acquireCalls += 1;
      return { acquired: true };
    },
    forceReleaseLock: async () => undefined,
    getActiveScheduleLock: async () => ({
      acquired: false,
      expires_at: '2026-03-13T12:00:00.000Z',
      locked_by: 'user-1',
      locked_by_name: 'Paula',
    }),
    getActorRank: () => 0,
    getLockOwnerActor: async () => null,
  });

  const result = await service.acquireOrReuseLock({
    scheduleId: 'schedule-1',
    userId: 'user-1',
  });

  assert.equal(acquireCalls, 0);
  assert.deepEqual(result, {
    acquired: true,
    expires_at: '2026-03-13T12:00:00.000Z',
    locked_by: 'user-1',
    locked_by_name: 'Paula',
  });
});

test('ensureLockOwnedByUser throws when the current user does not own the lock', async () => {
  const service = createScheduleLockService({
    acquireLock: async () => ({ acquired: true }),
    forceReleaseLock: async () => undefined,
    getActiveScheduleLock: async () => ({
      acquired: false,
      locked_by: 'user-2',
    }),
    getActorRank: () => 0,
    getLockOwnerActor: async () => null,
  });

  await assert.rejects(
    () =>
      service.ensureLockOwnedByUser({
        scheduleId: 'schedule-1',
        userId: 'user-1',
      }),
    /SCHEDULE_LOCK_REQUIRED/i,
  );
});

test('forceUnlock releases the lock only when actor rank is strictly higher', async () => {
  let released = false;

  const service = createScheduleLockService({
    acquireLock: async () => ({ acquired: true }),
    forceReleaseLock: async () => {
      released = true;
    },
    getActiveScheduleLock: async () => ({
      acquired: false,
      locked_by: 'user-2',
    }),
    getActorRank: (actor) => {
      if (actor.role === 'admin') return 50;
      if (actor.role === 'manager') return 40;
      return 10;
    },
    getLockOwnerActor: async () => ({
      id: 'user-2',
      is_area_lead: false,
      role: 'manager',
      zone_id: null,
    }),
  });

  await service.forceUnlock({
    actor: {
      id: 'user-1',
      is_area_lead: false,
      role: 'admin',
      zone_id: null,
    },
    scheduleId: 'schedule-1',
  });

  assert.equal(released, true);
});

test('forceUnlock rejects when actor rank is not higher than the lock owner', async () => {
  const service = createScheduleLockService({
    acquireLock: async () => ({ acquired: true }),
    forceReleaseLock: async () => undefined,
    getActiveScheduleLock: async () => ({
      acquired: false,
      locked_by: 'user-2',
    }),
    getActorRank: (actor) => {
      if (actor.role === 'manager') return 40;
      return 10;
    },
    getLockOwnerActor: async () => ({
      id: 'user-2',
      is_area_lead: false,
      role: 'manager',
      zone_id: null,
    }),
  });

  await assert.rejects(
    () =>
      service.forceUnlock({
        actor: {
          id: 'user-1',
          is_area_lead: false,
          role: 'manager',
          zone_id: null,
        },
        scheduleId: 'schedule-1',
      }),
    /Solo un rol superior puede forzar este bloqueo/i,
  );
});
