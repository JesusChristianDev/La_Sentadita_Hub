import assert from 'node:assert/strict';
import test from 'node:test';

import { updateEmploymentService } from './updateEmploymentService';

type IdentityInput = { email?: string; fullName: string; password?: string; personId: string };
type ProjectionInput = { personId: string; restaurantId: string; role: string; zoneId: string | null };

function buildDeps(overrides: Partial<{
  updatePersonIdentity: (input: IdentityInput) => Promise<void>;
  updateEmploymentProjection: (input: ProjectionInput) => Promise<void>;
}> = {}) {
  return {
    updatePersonIdentity: overrides.updatePersonIdentity ?? (async () => undefined),
    updateEmploymentProjection: overrides.updateEmploymentProjection ?? (async () => undefined),
  };
}

const baseInput = {
  userId: 'person-1',
  fullName: 'Ana Lopez',
  restaurantId: 'rest-1',
  role: 'employee' as const,
  zoneId: null,
};

test('updateEmploymentService: happy path completes without error', async () => {
  const update = updateEmploymentService(buildDeps());
  await assert.doesNotReject(() => update(baseInput));
});

test('updateEmploymentService: calls identity then projection in order', async () => {
  const calls: string[] = [];

  const update = updateEmploymentService(
    buildDeps({
      updatePersonIdentity: async () => { calls.push('identity'); },
      updateEmploymentProjection: async () => { calls.push('projection'); },
    }),
  );

  await update(baseInput);
  assert.deepEqual(calls, ['identity', 'projection']);
});

test('updateEmploymentService: passes userId as personId to both deps', async () => {
  let identityPersonId: string | undefined;
  let projectionPersonId: string | undefined;

  const update = updateEmploymentService(
    buildDeps({
      updatePersonIdentity: async ({ personId }) => { identityPersonId = personId; },
      updateEmploymentProjection: async ({ personId }) => { projectionPersonId = personId; },
    }),
  );

  await update({ ...baseInput, userId: 'person-42' });
  assert.equal(identityPersonId, 'person-42');
  assert.equal(projectionPersonId, 'person-42');
});

test('updateEmploymentService: maps known DB constraint to manager_exists', async () => {
  const update = updateEmploymentService(
    buildDeps({
      updateEmploymentProjection: async () => {
        throw new Error('manager_exists');
      },
    }),
  );

  await assert.rejects(() => update({ ...baseInput, role: 'manager' }), /manager_exists/);
});

test('updateEmploymentService: propagates unmapped errors as-is', async () => {
  const update = updateEmploymentService(
    buildDeps({
      updateEmploymentProjection: async () => {
        throw new Error('unexpected_db_error');
      },
    }),
  );

  await assert.rejects(() => update(baseInput), /unexpected_db_error/);
});

test('updateEmploymentService: identity failure propagates without calling projection', async () => {
  let projectionCalled = false;

  const update = updateEmploymentService(
    buildDeps({
      updatePersonIdentity: async () => {
        throw new Error('email_in_use');
      },
      updateEmploymentProjection: async () => {
        projectionCalled = true;
      },
    }),
  );

  await assert.rejects(() => update(baseInput), /email_in_use/);
  assert.equal(projectionCalled, false, 'projection no debe llamarse si identity falla');
});

// ─── Invariant I-004: area_lead sin zona ─────────────────────────
// La validación ocurre antes del servicio (validateUpdateEmployeeInput).
// Este test documenta que el servicio pasa zoneId directamente a la proyección.
test('updateEmploymentService: area_lead con zona llega correctamente a projection', async () => {
  let capturedRole: string | undefined;
  let capturedZone: string | null | undefined;

  const update = updateEmploymentService(
    buildDeps({
      updateEmploymentProjection: async ({ role, zoneId }) => {
        capturedRole = role;
        capturedZone = zoneId;
      },
    }),
  );

  await update({ ...baseInput, role: 'area_lead', zoneId: 'zone-5' });
  assert.equal(capturedRole, 'area_lead');
  assert.equal(capturedZone, 'zone-5');
});
