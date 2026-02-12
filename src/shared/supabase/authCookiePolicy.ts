export const REMEMBER_SESSION_COOKIE = 'remember_session';

type CookieOptions = {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: boolean | 'lax' | 'strict' | 'none';
  secure?: boolean;
};

export function shouldPersistSession(preference: string | undefined): boolean {
  if (preference === '0') return false;
  return true;
}

export function isSupabaseAuthCookie(name: string): boolean {
  return name.startsWith('sb-') && name.includes('-auth-token');
}

export function applySessionPersistenceToCookieOptions(
  name: string,
  options: CookieOptions | undefined,
  persistSession: boolean,
): CookieOptions | undefined {
  if (!options) return options;
  if (persistSession) return options;
  if (!isSupabaseAuthCookie(name)) return options;

  const sessionCookieOptions = { ...options };
  delete sessionCookieOptions.maxAge;
  delete sessionCookieOptions.expires;
  return sessionCookieOptions;
}
