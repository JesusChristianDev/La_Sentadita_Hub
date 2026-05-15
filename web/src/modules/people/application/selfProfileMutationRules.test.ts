import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateEmailChangeInput,
  validatePasswordChangeInput,
} from './selfProfileMutationRules';

// ─── validateEmailChangeInput ─────────────────────────────────────

test('validateEmailChangeInput accepts valid email and password', () => {
  const result = validateEmailChangeInput({
    newEmail: 'nuevo@example.com',
    password: 'cualquierCosa',
  });
  assert.deepEqual(result, {
    ok: true,
    value: { newEmail: 'nuevo@example.com', password: 'cualquierCosa' },
  });
});

test('validateEmailChangeInput trims the email', () => {
  const result = validateEmailChangeInput({
    newEmail: '  espacios@example.com  ',
    password: 'p',
  });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.value.newEmail, 'espacios@example.com');
  }
});

test('validateEmailChangeInput rejects missing email', () => {
  assert.deepEqual(validateEmailChangeInput({ newEmail: '', password: 'p' }), {
    ok: false,
    errorCode: 'missing',
  });
});

test('validateEmailChangeInput rejects missing password', () => {
  assert.deepEqual(
    validateEmailChangeInput({ newEmail: 'ok@example.com', password: '' }),
    { ok: false, errorCode: 'missing' },
  );
});

test('validateEmailChangeInput rejects malformed email', () => {
  assert.deepEqual(
    validateEmailChangeInput({ newEmail: 'no-es-un-email', password: 'p' }),
    { ok: false, errorCode: 'invalid_email' },
  );
});

// ─── validatePasswordChangeInput ──────────────────────────────────

test('validatePasswordChangeInput accepts matching strong password', () => {
  const result = validatePasswordChangeInput({
    currentPassword: 'OldPass1!',
    newPassword: 'NewPass1!',
    confirm: 'NewPass1!',
  });
  assert.deepEqual(result, {
    ok: true,
    value: { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' },
  });
});

test('validatePasswordChangeInput rejects missing current password', () => {
  assert.deepEqual(
    validatePasswordChangeInput({
      currentPassword: '',
      newPassword: 'NewPass1!',
      confirm: 'NewPass1!',
    }),
    { ok: false, errorCode: 'missing' },
  );
});

test('validatePasswordChangeInput rejects mismatched confirmation', () => {
  assert.deepEqual(
    validatePasswordChangeInput({
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
      confirm: 'OtroPass1!',
    }),
    { ok: false, errorCode: 'password_mismatch' },
  );
});

test('validatePasswordChangeInput rejects weak new password', () => {
  const result = validatePasswordChangeInput({
    currentPassword: 'OldPass1!',
    newPassword: 'abc',
    confirm: 'abc',
  });
  assert.deepEqual(result, { ok: false, errorCode: 'weak_password' });
});
