import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEmployeeProfilePayload,
  mapEmployeeMutationErrorCode,
  normalizeEmployeeAssignment,
  validateCreateEmployeeInput,
  validateScopedEmployeeManagement,
  validateUpdateEmployeeInput,
} from './employeeMutationRules';

test('normalizeEmployeeAssignment clears zone and area lead for management roles', () => {
  assert.deepEqual(normalizeEmployeeAssignment('manager', 'zone-1', true), {
    isAreaLead: false,
    zoneId: null,
  });
  assert.deepEqual(normalizeEmployeeAssignment('employee', 'zone-1', true), {
    isAreaLead: true,
    zoneId: 'zone-1',
  });
});

test('buildEmployeeProfilePayload reuses normalized assignment and optional password flag', () => {
  assert.deepEqual(
    buildEmployeeProfilePayload({
      fullName: 'Paula',
      isAreaLead: true,
      mustChangePassword: true,
      restaurantId: 'restaurant-1',
      role: 'manager',
      zoneId: 'zone-1',
    }),
    {
      full_name: 'Paula',
      is_area_lead: false,
      must_change_password: true,
      restaurant_id: 'restaurant-1',
      role: 'manager',
      zone_id: null,
    },
  );
});

test('validateCreateEmployeeInput rejects invalid area lead assignments and weak credentials', () => {
  assert.deepEqual(
    validateCreateEmployeeInput({
      email: 'bad-email',
      fullName: 'Paula',
      isAreaLead: false,
      password: '12345678',
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
      isAreaLead: true,
      password: '12345678',
      restaurantId: 'restaurant-1',
      roleRaw: 'manager',
      zoneId: 'zone-1',
    }),
    { ok: false, errorCode: 'area_lead_only_employee' },
  );
});

test('validateUpdateEmployeeInput rejects area lead changes for non-employee roles', () => {
  assert.deepEqual(
    validateUpdateEmployeeInput({
      email: '  ',
      fullName: 'Paula',
      isAreaLead: true,
      password: '',
      restaurantId: 'restaurant-1',
      roleRaw: 'sub_manager',
      zoneId: 'zone-1',
    }),
    { ok: false, errorCode: 'area_lead_only_employee' },
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
      actorRole: 'sub_manager',
      requestedRestaurantId: 'restaurant-1',
      requestedRole: 'manager',
      targetRole: 'employee',
    }),
    'invalid_role',
  );
});

test('mapEmployeeMutationErrorCode recognizes slot conflicts from service and database messages', () => {
  assert.equal(mapEmployeeMutationErrorCode(new Error('manager_exists')), 'manager_exists');
  assert.equal(
    mapEmployeeMutationErrorCode(
      new Error('duplicate key value violates unique constraint ux_profiles_one_sub_manager_per_restaurant'),
    ),
    'sub_manager_exists',
  );
  assert.equal(mapEmployeeMutationErrorCode(new Error('unknown')), null);
});
