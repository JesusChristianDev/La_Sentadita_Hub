import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertRoleAllowedToCreateCategory,
  assertRoleAllowedToMarkRestricted,
  assertValidIncidentTransition,
  isRoleAllowedToCreateCategory,
  isValidIncidentTransition,
} from './incidentStatusRules';

// --- Status transitions ---

test('valid transitions: reported → in_review, resolved, closed', () => {
  assert.equal(isValidIncidentTransition('reported', 'in_review'), true);
  assert.equal(isValidIncidentTransition('reported', 'resolved'), true);
  assert.equal(isValidIncidentTransition('reported', 'closed'), true);
});

test('valid transitions: in_review → resolved, closed', () => {
  assert.equal(isValidIncidentTransition('in_review', 'resolved'), true);
  assert.equal(isValidIncidentTransition('in_review', 'closed'), true);
});

test('valid transition: resolved → closed', () => {
  assert.equal(isValidIncidentTransition('resolved', 'closed'), true);
});

test('invalid: closed is terminal', () => {
  assert.equal(isValidIncidentTransition('closed', 'reported'), false);
  assert.equal(isValidIncidentTransition('closed', 'in_review'), false);
  assert.equal(isValidIncidentTransition('closed', 'resolved'), false);
});

test('invalid: no backwards transitions', () => {
  assert.equal(isValidIncidentTransition('in_review', 'reported'), false);
  assert.equal(isValidIncidentTransition('resolved', 'reported'), false);
  assert.equal(isValidIncidentTransition('resolved', 'in_review'), false);
});

test('invalid: same-state transition', () => {
  assert.equal(isValidIncidentTransition('reported', 'reported'), false);
  assert.equal(isValidIncidentTransition('in_review', 'in_review'), false);
});

test('assertValidIncidentTransition throws on invalid transition', () => {
  assert.throws(
    () => assertValidIncidentTransition('closed', 'reported'),
    /INCIDENT_INVALID_TRANSITION/,
  );
});

test('assertValidIncidentTransition does not throw on valid transition', () => {
  assert.doesNotThrow(() => assertValidIncidentTransition('reported', 'in_review'));
});

// --- Category allowlist ---

test('employee can create operational, hygiene, customer', () => {
  assert.equal(isRoleAllowedToCreateCategory('employee', 'operational'), true);
  assert.equal(isRoleAllowedToCreateCategory('employee', 'hygiene'), true);
  assert.equal(isRoleAllowedToCreateCategory('employee', 'customer'), true);
});

test('employee cannot create security, technology, personnel, maintenance', () => {
  assert.equal(isRoleAllowedToCreateCategory('employee', 'security'), false);
  assert.equal(isRoleAllowedToCreateCategory('employee', 'technology'), false);
  assert.equal(isRoleAllowedToCreateCategory('employee', 'personnel'), false);
  assert.equal(isRoleAllowedToCreateCategory('employee', 'maintenance'), false);
});

test('manager can create operational, hygiene, customer, stock, maintenance, personnel', () => {
  assert.equal(isRoleAllowedToCreateCategory('manager', 'operational'), true);
  assert.equal(isRoleAllowedToCreateCategory('manager', 'stock'), true);
  assert.equal(isRoleAllowedToCreateCategory('manager', 'maintenance'), true);
  assert.equal(isRoleAllowedToCreateCategory('manager', 'personnel'), true);
});

test('manager cannot create security or technology', () => {
  assert.equal(isRoleAllowedToCreateCategory('manager', 'security'), false);
  assert.equal(isRoleAllowedToCreateCategory('manager', 'technology'), false);
});

test('admin can create any category', () => {
  const categories = ['operational','maintenance','hygiene','customer','security','stock','technology','personnel'] as const;
  for (const cat of categories) {
    assert.equal(isRoleAllowedToCreateCategory('admin', cat), true);
  }
});

test('assertRoleAllowedToCreateCategory throws for disallowed role/category', () => {
  assert.throws(
    () => assertRoleAllowedToCreateCategory('employee', 'security'),
    /INCIDENT_CATEGORY_FORBIDDEN/,
  );
});

// --- Restricted sensitivity ---

test('manager can mark restricted', () => {
  assert.doesNotThrow(() => assertRoleAllowedToMarkRestricted('manager', 'restricted'));
});

test('area_lead cannot mark restricted', () => {
  assert.throws(
    () => assertRoleAllowedToMarkRestricted('area_lead', 'restricted'),
    /INCIDENT_SENSITIVITY_FORBIDDEN/,
  );
});

test('employee cannot mark restricted', () => {
  assert.throws(
    () => assertRoleAllowedToMarkRestricted('employee', 'restricted'),
    /INCIDENT_SENSITIVITY_FORBIDDEN/,
  );
});

test('any role can use normal sensitivity', () => {
  assert.doesNotThrow(() => assertRoleAllowedToMarkRestricted('employee', 'normal'));
  assert.doesNotThrow(() => assertRoleAllowedToMarkRestricted('area_lead', 'normal'));
});
