import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mapEmployeeMutationErrorCode,
  normalizeEmployeeAssignment,
  validateCreateEmployeeInput,
  validateScopedEmployeeManagement,
  validateUpdateEmployeeInput,
} from './employeeMutationRules';

test('normalizeEmployeeAssignment maps system_role into simplified assignment payload', () => {
  assert.deepEqual(normalizeEmployeeAssignment('manager', 'zone-1'), {
    systemRole: 'manager',
    zoneId: null,
  });
  assert.deepEqual(normalizeEmployeeAssignment('area_lead', 'zone-1'), {
    systemRole: 'area_lead',
    zoneId: 'zone-1',
  });
});

test('validateCreateEmployeeInput rejects invalid area lead assignments and missing fields', () => {
  assert.deepEqual(
    validateCreateEmployeeInput({
      email: 'bad-email',
      fullName: 'Paula',
      phone: '123456789',
      identityDocument: '12345678A',
      restaurantId: 'restaurant-1',
      roleRaw: 'employee',
      zoneId: 'zone-1',
    }),
    { ok: false, errorCode: 'invalid_email' },
  );

  assert.deepEqual(
    validateCreateEmployeeInput({
      email: 'paula@example.com',
      fullName: 'Paula',
      phone: '123456789',
      identityDocument: '12345678A',
      restaurantId: 'restaurant-1',
      roleRaw: 'area_lead',
      zoneId: '',
    }),
    { ok: false, errorCode: 'area_lead_requires_zone' },
  );
});

test('validateUpdateEmployeeInput rejects area lead changes without a zone assignment', () => {
  assert.deepEqual(
    validateUpdateEmployeeInput({
      fullName: 'Paula',
      restaurantId: 'restaurant-1',
      roleRaw: 'area_lead',
      zoneId: '',
    }),
    { ok: false, errorCode: 'area_lead_requires_zone' },
  );
});

test('validateScopedEmployeeManagement blocks restaurant hopping and role changes for manager scope', () => {
  assert.equal(
    validateScopedEmployeeManagement({
      actorRestaurantId: 'restaurant-1',
      actorRole: 'manager',
      requestedRestaurantId: 'restaurant-2',
      requestedRole: 'employee',
      targetRole: 'employee',
    }),
    'restaurant_mismatch',
  );

  assert.equal(
    validateScopedEmployeeManagement({
      actorRestaurantId: 'restaurant-1',
      actorRole: 'manager',
      requestedRestaurantId: 'restaurant-1',
      requestedRole: 'manager',
      targetRole: 'area_lead',
    }),
    'invalid_role',
  );
});

test('validateCreateEmployeeInput rejects non canonical roles', () => {
  const result = validateCreateEmployeeInput({
    email: 'paula@example.com',
    fullName: 'Paula',
    phone: '123456789',
    identityDocument: '12345678A',
    restaurantId: 'restaurant-1',
    roleRaw: 'unsupported_role',
    zoneId: '',
  });

  assert.deepEqual(result, { ok: false, errorCode: 'invalid_role' });
});

test('mapEmployeeMutationErrorCode recognizes slot conflicts and v6 unique indices', () => {
  assert.equal(mapEmployeeMutationErrorCode(new Error('manager_exists')), 'manager_exists');
  assert.equal(
    mapEmployeeMutationErrorCode(
      new Error('duplicate key value violates unique constraint idx_persons_chain_identity_document_unique'),
    ),
    'duplicate_identity',
  );
  assert.equal(
    mapEmployeeMutationErrorCode(
      new Error('duplicate key value violates unique constraint idx_persons_agora_employee_id'),
    ),
    'duplicate_employee_code',
  );
  assert.equal(
    mapEmployeeMutationErrorCode(new Error('area_lead_zone_full')),
    'area_lead_zone_full',
  );
  assert.equal(mapEmployeeMutationErrorCode(new Error('unknown')), null);
});
