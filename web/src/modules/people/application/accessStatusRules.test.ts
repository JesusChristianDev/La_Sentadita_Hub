import assert from 'node:assert/strict';
import test from 'node:test';

import {
  reachableFrom,
  validateAccessStatusTransition,
} from './accessStatusRules';

// ─── D-028: transiciones válidas ─────────────────────────────────

test('pending_activation → active es la única salida del estado inicial', () => {
  assert.deepEqual(
    validateAccessStatusTransition('pending_activation', 'active'),
    { ok: true },
  );
  assert.deepEqual(reachableFrom('pending_activation'), ['active']);
});

test('active → suspended y active → archived son las salidas de active', () => {
  assert.deepEqual(validateAccessStatusTransition('active', 'suspended'), { ok: true });
  assert.deepEqual(validateAccessStatusTransition('active', 'archived'), { ok: true });
  assert.deepEqual(reachableFrom('active').sort(), ['archived', 'suspended']);
});

test('suspended puede reactivarse (→ active) o archivarse (→ archived)', () => {
  assert.deepEqual(validateAccessStatusTransition('suspended', 'active'), { ok: true });
  assert.deepEqual(validateAccessStatusTransition('suspended', 'archived'), { ok: true });
  assert.deepEqual(reachableFrom('suspended').sort(), ['active', 'archived']);
});

// ─── D-028: transiciones inválidas ───────────────────────────────

test('archived es estado terminal — ninguna transición desde él está permitida', () => {
  for (const next of ['pending_activation', 'active', 'suspended', 'blocked'] as const) {
    assert.deepEqual(
      validateAccessStatusTransition('archived', next),
      { ok: false, errorCode: 'invalid_transition' },
      `archived → ${next} debería estar bloqueado`,
    );
  }
  assert.deepEqual(reachableFrom('archived'), []);
});

test('blocked es estado terminal — ninguna transición está permitida', () => {
  for (const next of ['pending_activation', 'active', 'suspended', 'archived'] as const) {
    assert.deepEqual(
      validateAccessStatusTransition('blocked', next),
      { ok: false, errorCode: 'invalid_transition' },
      `blocked → ${next} debería estar bloqueado`,
    );
  }
  assert.deepEqual(reachableFrom('blocked'), []);
});

test('pending_activation no puede saltar a suspended o archived directamente', () => {
  assert.deepEqual(
    validateAccessStatusTransition('pending_activation', 'suspended'),
    { ok: false, errorCode: 'invalid_transition' },
  );
  assert.deepEqual(
    validateAccessStatusTransition('pending_activation', 'archived'),
    { ok: false, errorCode: 'invalid_transition' },
  );
});

test('active no puede volver a pending_activation ni a blocked', () => {
  assert.deepEqual(
    validateAccessStatusTransition('active', 'pending_activation'),
    { ok: false, errorCode: 'invalid_transition' },
  );
  assert.deepEqual(
    validateAccessStatusTransition('active', 'blocked'),
    { ok: false, errorCode: 'invalid_transition' },
  );
});

// ─── already_in_state ────────────────────────────────────────────

test('cualquier transición al mismo estado devuelve already_in_state', () => {
  for (const status of ['pending_activation', 'active', 'suspended', 'archived', 'blocked'] as const) {
    assert.deepEqual(
      validateAccessStatusTransition(status, status),
      { ok: false, errorCode: 'already_in_state' },
      `${status} → ${status} debería ser already_in_state`,
    );
  }
});
