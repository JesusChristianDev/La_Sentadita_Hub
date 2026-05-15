import assert from 'node:assert/strict';
import test from 'node:test';

import { createRelationshipService } from './createRelationshipService';

type Calls = { created: boolean; archived: boolean; projected: boolean };

type ArchiveInput = { personId: string; soft?: boolean };
type UpdateInput = { personId: string; restaurantId: string; role: string; zoneId: string | null };

function buildDeps(overrides: Partial<{
  createPerson: (input: unknown) => Promise<string>;
  archivePerson: (input: ArchiveInput) => Promise<void>;
  updateEmploymentProjection: (input: UpdateInput) => Promise<void>;
}> = {}) {
  return {
    createPerson: overrides.createPerson ?? (async () => 'person-1'),
    archivePerson: overrides.archivePerson ?? (async () => undefined),
    updateEmploymentProjection: overrides.updateEmploymentProjection ?? (async () => undefined),
  };
}

const baseInput = {
  email: 'ana@example.com',
  fullName: 'Ana Lopez',
  phone: '123456789',
  identityDocument: '12345678A',
  restaurantId: 'rest-1',
  role: 'employee' as const,
  zoneId: null,
};

test('createRelationshipService: happy path returns the new personId', async () => {
  const create = createRelationshipService(buildDeps());
  const result = await create(baseInput);
  assert.equal(result, 'person-1');
});

test('createRelationshipService: calls createPerson then updateEmploymentProjection', async () => {
  const calls: string[] = [];

  const create = createRelationshipService(
    buildDeps({
      createPerson: async () => {
        calls.push('createPerson');
        return 'person-42';
      },
      updateEmploymentProjection: async () => {
        calls.push('updateProjection');
      },
    }),
  );

  await create(baseInput);
  assert.deepEqual(calls, ['createPerson', 'updateProjection']);
});

test('createRelationshipService: rolls back (archives person) when projection fails', async () => {
  const calls: Calls = { created: false, archived: false, projected: false };

  const create = createRelationshipService(
    buildDeps({
      createPerson: async () => {
        calls.created = true;
        return 'person-99';
      },
      updateEmploymentProjection: async () => {
        calls.projected = true;
        throw new Error('projection_failure');
      },
      archivePerson: async ({ personId }) => {
        assert.equal(personId, 'person-99');
        calls.archived = true;
      },
    }),
  );

  await assert.rejects(() => create(baseInput));
  assert.ok(calls.created, 'createPerson should have been called');
  assert.ok(calls.projected, 'updateEmploymentProjection should have been called');
  assert.ok(calls.archived, 'archivePerson (rollback) should have been called');
});

test('createRelationshipService: does NOT rollback when createPerson fails (no personId yet)', async () => {
  let archived = false;

  const create = createRelationshipService(
    buildDeps({
      createPerson: async () => {
        throw new Error('duplicate_identity');
      },
      archivePerson: async () => {
        archived = true;
      },
    }),
  );

  await assert.rejects(() => create(baseInput), /duplicate_identity/);
  assert.equal(archived, false, 'should NOT archive when createPerson fails');
});

test('createRelationshipService: maps known DB constraint errors to error codes', async () => {
  const create = createRelationshipService(
    buildDeps({
      updateEmploymentProjection: async () => {
        throw new Error('manager_exists');
      },
    }),
  );

  await assert.rejects(() => create({ ...baseInput, role: 'manager' }), /manager_exists/);
});

// ─── Invariant I-002: un solo empleo activo por persona ──────────
// La proyección en DB lanza un error si hay solapamiento.
// Aquí validamos que el error se propaga correctamente.
test('createRelationshipService: propagates I-002 violation (duplicate active employment)', async () => {
  const create = createRelationshipService(
    buildDeps({
      updateEmploymentProjection: async () => {
        throw new Error('duplicate key value violates unique constraint employment_active');
      },
    }),
  );

  await assert.rejects(() => create(baseInput));
});

// ─── Invariant I-004: area_lead sin zona lanzada antes de crear ──
// (la validación ocurre en validateCreateEmployeeInput, antes de llamar al servicio)
// Este test documenta que el servicio no añade lógica duplicada.
test('createRelationshipService: area_lead with zone passes through to projection', async () => {
  let projectedRole: string | undefined;
  let projectedZone: string | null | undefined;

  const create = createRelationshipService(
    buildDeps({
      updateEmploymentProjection: async (input) => {
        projectedRole = input.role;
        projectedZone = input.zoneId;
      },
    }),
  );

  await create({ ...baseInput, role: 'area_lead', zoneId: 'zone-3' });
  assert.equal(projectedRole, 'area_lead');
  assert.equal(projectedZone, 'zone-3');
});
