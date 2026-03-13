import type { ProfileErrorCode } from '@/shared/feedbackMessages';

import {
  isStrongAccountPassword,
  isValidAccountEmail,
} from './accountCredentialRules';

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errorCode: ProfileErrorCode };

export type EmailChangeDraftInput = {
  newEmail: string;
  password: string;
};

export type EmailChangeValidatedInput = {
  newEmail: string;
  password: string;
};

export type PasswordChangeDraftInput = {
  confirm: string;
  currentPassword: string;
  newPassword: string;
};

export type PasswordChangeValidatedInput = {
  currentPassword: string;
  newPassword: string;
};

export function validateEmailChangeInput(
  input: EmailChangeDraftInput,
): ValidationResult<EmailChangeValidatedInput> {
  const newEmail = input.newEmail.trim();
  const password = input.password;

  if (!newEmail || !password) {
    return { ok: false, errorCode: 'missing' };
  }

  if (!isValidAccountEmail(newEmail)) {
    return { ok: false, errorCode: 'invalid_email' };
  }

  return {
    ok: true,
    value: {
      newEmail,
      password,
    },
  };
}

export function validatePasswordChangeInput(
  input: PasswordChangeDraftInput,
): ValidationResult<PasswordChangeValidatedInput> {
  const currentPassword = input.currentPassword;
  const newPassword = input.newPassword;
  const confirm = input.confirm;

  if (!currentPassword || !newPassword || !confirm) {
    return { ok: false, errorCode: 'missing' };
  }

  if (newPassword !== confirm) {
    return { ok: false, errorCode: 'password_mismatch' };
  }

  if (!isStrongAccountPassword(newPassword)) {
    return { ok: false, errorCode: 'weak_password' };
  }

  return {
    ok: true,
    value: {
      currentPassword,
      newPassword,
    },
  };
}
