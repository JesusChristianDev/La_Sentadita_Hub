import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertValidDeliveryNoteTransition,
  isTerminalDeliveryNoteStatus,
  isValidDeliveryNoteTransition,
} from './deliveryNoteStatusRules';

// --- Valid transitions ---

test('uploaded → employee_reviewed is valid', () => {
  assert.equal(isValidDeliveryNoteTransition('uploaded', 'employee_reviewed'), true);
});

test('uploaded → office_reviewing is valid (office skips employee review)', () => {
  assert.equal(isValidDeliveryNoteTransition('uploaded', 'office_reviewing'), true);
});

test('employee_reviewed → office_reviewing is valid', () => {
  assert.equal(isValidDeliveryNoteTransition('employee_reviewed', 'office_reviewing'), true);
});

test('office_reviewing → confirmed is valid', () => {
  assert.equal(isValidDeliveryNoteTransition('office_reviewing', 'confirmed'), true);
});

test('office_reviewing → rejected is valid', () => {
  assert.equal(isValidDeliveryNoteTransition('office_reviewing', 'rejected'), true);
});

// --- Invalid transitions ---

test('confirmed is terminal', () => {
  assert.equal(isValidDeliveryNoteTransition('confirmed', 'uploaded'), false);
  assert.equal(isValidDeliveryNoteTransition('confirmed', 'employee_reviewed'), false);
  assert.equal(isValidDeliveryNoteTransition('confirmed', 'office_reviewing'), false);
  assert.equal(isValidDeliveryNoteTransition('confirmed', 'rejected'), false);
});

test('rejected is terminal', () => {
  assert.equal(isValidDeliveryNoteTransition('rejected', 'uploaded'), false);
  assert.equal(isValidDeliveryNoteTransition('rejected', 'confirmed'), false);
  assert.equal(isValidDeliveryNoteTransition('rejected', 'office_reviewing'), false);
});

test('no backwards transitions', () => {
  assert.equal(isValidDeliveryNoteTransition('employee_reviewed', 'uploaded'), false);
  assert.equal(isValidDeliveryNoteTransition('office_reviewing', 'uploaded'), false);
  assert.equal(isValidDeliveryNoteTransition('office_reviewing', 'employee_reviewed'), false);
});

test('same-state transitions are invalid', () => {
  assert.equal(isValidDeliveryNoteTransition('uploaded', 'uploaded'), false);
  assert.equal(isValidDeliveryNoteTransition('confirmed', 'confirmed'), false);
});

test('uploaded cannot go directly to confirmed', () => {
  assert.equal(isValidDeliveryNoteTransition('uploaded', 'confirmed'), false);
});

test('assertValidDeliveryNoteTransition throws on invalid transition', () => {
  assert.throws(
    () => assertValidDeliveryNoteTransition('confirmed', 'uploaded'),
    /DELIVERY_NOTE_INVALID_TRANSITION/,
  );
});

test('assertValidDeliveryNoteTransition does not throw on valid transition', () => {
  assert.doesNotThrow(() => assertValidDeliveryNoteTransition('uploaded', 'employee_reviewed'));
});

// --- Terminal status ---

test('confirmed and rejected are terminal', () => {
  assert.equal(isTerminalDeliveryNoteStatus('confirmed'), true);
  assert.equal(isTerminalDeliveryNoteStatus('rejected'), true);
});

test('other statuses are not terminal', () => {
  assert.equal(isTerminalDeliveryNoteStatus('uploaded'), false);
  assert.equal(isTerminalDeliveryNoteStatus('employee_reviewed'), false);
  assert.equal(isTerminalDeliveryNoteStatus('office_reviewing'), false);
});
