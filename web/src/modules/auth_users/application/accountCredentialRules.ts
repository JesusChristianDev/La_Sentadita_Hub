const ACCOUNT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_ACCOUNT_PASSWORD_LENGTH = 8;

export function isValidAccountEmail(value: string): boolean {
  return ACCOUNT_EMAIL_PATTERN.test(value);
}

export function isStrongAccountPassword(value: string): boolean {
  return value.length >= MIN_ACCOUNT_PASSWORD_LENGTH;
}
