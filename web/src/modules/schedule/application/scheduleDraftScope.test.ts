import assert from 'node:assert/strict';
import test from 'node:test';

import { filterEmployeesForDraftScope } from './scheduleDraftScope';

const employees = [
  { id: 'emp-1', zone_id: 'zone-a' },
  { id: 'emp-2', zone_id: 'zone-b' },
  { id: 'emp-3', zone_id: 'zone-a' },
  { id: 'emp-4', zone_id: null },
];

test('manager sees all employees regardless of zone', () => {
  const result = filterEmployeesForDraftScope(
    { systemRole: 'manager', zoneId: 'zone-a' },
    employees,
  );
  assert.equal(result.length, 4);
});

test('admin sees all employees', () => {
  const result = filterEmployeesForDraftScope(
    { systemRole: 'admin', zoneId: null },
    employees,
  );
  assert.equal(result.length, 4);
});

test('area_lead only sees employees in their zone', () => {
  const result = filterEmployeesForDraftScope(
    { systemRole: 'area_lead', zoneId: 'zone-a' },
    employees,
  );
  assert.deepEqual(
    result.map((e) => e.id),
    ['emp-1', 'emp-3'],
  );
});

test('area_lead with zone-b only sees zone-b employees', () => {
  const result = filterEmployeesForDraftScope(
    { systemRole: 'area_lead', zoneId: 'zone-b' },
    employees,
  );
  assert.deepEqual(
    result.map((e) => e.id),
    ['emp-2'],
  );
});

test('area_lead without a zone sees all employees', () => {
  const result = filterEmployeesForDraftScope(
    { systemRole: 'area_lead', zoneId: null },
    employees,
  );
  assert.equal(result.length, 4);
});
