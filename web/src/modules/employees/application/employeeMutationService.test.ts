import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmployeeMutationService } from './employeeMutationService';

test('createEmployeeFromDraft validates effective restaurant and role slots before creating', async () => {
  const calls: string[] = [];

  const service = createEmployeeMutationService({
    createEmployee: async () => {
      calls.push('create');
      return 'user-1';
    },
    getRestaurantStatus: async () => ({ id: 'restaurant-1', is_active: true }),
    getRoleSlotConflictCode: async () => {
      calls.push('slot');
      return null;
    },
    updateEmployee: async () => undefined,
  });

  const result = await service.createEmployeeFromDraft({
    effectiveRestaurantId: 'restaurant-1',
    input: {
      email: 'paula@example.com',
      fullName: 'Paula',
      isAreaLead: false,
      password: '12345678',
      restaurantId: 'restaurant-1',
      roleRaw: 'manager',
      zoneId: 'zone-1',
    },
  });

  assert.deepEqual(calls, ['slot', 'create']);
  assert.deepEqual(result, { ok: true, value: 'user-1' });
});

test('createEmployeeFromDraft rejects when restaurant context is missing or mismatched', async () => {
  const service = createEmployeeMutationService({
    createEmployee: async () => 'user-1',
    getRestaurantStatus: async () => ({ id: 'restaurant-1', is_active: true }),
    getRoleSlotConflictCode: async () => null,
    updateEmployee: async () => undefined,
  });

  const missing = await service.createEmployeeFromDraft({
    effectiveRestaurantId: null,
    input: {
      email: 'paula@example.com',
      fullName: 'Paula',
      isAreaLead: false,
      password: '12345678',
      restaurantId: 'restaurant-1',
      roleRaw: 'employee',
      zoneId: 'zone-1',
    },
  });

  const mismatch = await service.createEmployeeFromDraft({
    effectiveRestaurantId: 'restaurant-2',
    input: {
      email: 'paula@example.com',
      fullName: 'Paula',
      isAreaLead: false,
      password: '12345678',
      restaurantId: 'restaurant-1',
      roleRaw: 'employee',
      zoneId: 'zone-1',
    },
  });

  assert.deepEqual(missing, { ok: false, errorCode: 'no_effective_restaurant' });
  assert.deepEqual(mismatch, { ok: false, errorCode: 'restaurant_mismatch' });
});

test('updateEmployeeFromDraft enforces manager scope restrictions before updating', async () => {
  let updated = false;

  const service = createEmployeeMutationService({
    createEmployee: async () => 'user-1',
    getRestaurantStatus: async () => ({ id: 'restaurant-1', is_active: true }),
    getRoleSlotConflictCode: async () => null,
    updateEmployee: async () => {
      updated = true;
    },
  });

  const blocked = await service.updateEmployeeFromDraft({
    actorRestaurantId: 'restaurant-1',
    actorRole: 'manager',
    input: {
      email: 'user@example.com',
      fullName: 'Paula',
      isAreaLead: false,
      password: '',
      restaurantId: 'restaurant-2',
      roleRaw: 'employee',
      zoneId: 'zone-1',
    },
    targetRole: 'employee',
    userId: 'user-1',
  });

  assert.deepEqual(blocked, { ok: false, errorCode: 'restaurant_mismatch' });
  assert.equal(updated, false);
});

test('updateEmployeeFromDraft rejects area lead changes for non-employee roles', async () => {
  const service = createEmployeeMutationService({
    createEmployee: async () => 'user-1',
    getRestaurantStatus: async () => ({ id: 'restaurant-1', is_active: true }),
    getRoleSlotConflictCode: async () => null,
    updateEmployee: async () => undefined,
  });

  const result = await service.updateEmployeeFromDraft({
    actorRestaurantId: null,
    actorRole: 'admin',
    input: {
      email: 'paula@example.com',
      fullName: 'Paula',
      isAreaLead: true,
      password: '',
      restaurantId: 'restaurant-1',
      roleRaw: 'manager',
      zoneId: 'zone-1',
    },
    targetRole: 'manager',
    userId: 'user-1',
  });

  assert.deepEqual(result, { ok: false, errorCode: 'area_lead_only_employee' });
});

test('updateEmployeeFromDraft normalizes payload and checks slot conflicts for employee updates', async () => {
  const captured: Array<Record<string, unknown>> = [];

  const service = createEmployeeMutationService({
    createEmployee: async () => 'user-1',
    getRestaurantStatus: async () => ({ id: 'restaurant-1', is_active: true }),
    getRoleSlotConflictCode: async () => null,
    updateEmployee: async (input) => {
      captured.push(input);
    },
  });

  const result = await service.updateEmployeeFromDraft({
    actorRestaurantId: null,
    actorRole: 'admin',
    input: {
      email: 'paula@example.com',
      fullName: 'Paula',
      isAreaLead: true,
      password: '',
      restaurantId: 'restaurant-1',
      roleRaw: 'employee',
      zoneId: 'zone-1',
    },
    targetRole: 'employee',
    userId: 'user-1',
  });

  assert.deepEqual(result, { ok: true, value: undefined });
  assert.deepEqual(captured, [
    {
      email: 'paula@example.com',
      fullName: 'Paula',
      isAreaLead: true,
      restaurantId: 'restaurant-1',
      role: 'employee',
      userId: 'user-1',
      zoneId: 'zone-1',
    },
  ]);
});
