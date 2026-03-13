import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateEmailChangeInput,
  validatePasswordChangeInput,
} from './selfProfileMutationRules';

test('validateEmailChangeInput trims the email and accepts valid credentials', () => {
  const result = validateEmailChangeInput({
    newEmail: '  paula@example.com  ',
    password: 'secret123',
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      newEmail: 'paula@example.com',
      password: 'secret123',
    },
  });
});

test('validateEmailChangeInput rejects missing or invalid email values', () => {
  assert.deepEqual(
    validateEmailChangeInput({
      newEmail: '',
      password: 'secret123',
    }),
    { ok: false, errorCode: 'missing' },
  );

  assert.deepEqual(
    validateEmailChangeInput({
      newEmail: 'bad-email',
      password: 'secret123',
    }),
    { ok: false, errorCode: 'invalid_email' },
  );
});

test('validatePasswordChangeInput rejects mismatch and weak passwords', () => {
  assert.deepEqual(
    validatePasswordChangeInput({
      confirm: 'secret124',
      currentPassword: 'secret123',
      newPassword: 'secret123',
    }),
    { ok: false, errorCode: 'password_mismatch' },
  );

  assert.deepEqual(
    validatePasswordChangeInput({
      confirm: 'short',
      currentPassword: 'secret123',
      newPassword: 'short',
    }),
    { ok: false, errorCode: 'weak_password' },
  );
});

test('validatePasswordChangeInput accepts a strong matching password', () => {
  const result = validatePasswordChangeInput({
    confirm: 'secret123',
    currentPassword: 'old-secret',
    newPassword: 'secret123',
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      currentPassword: 'old-secret',
      newPassword: 'secret123',
    },
  });
});
