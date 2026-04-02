import 'server-only';

import { cookies } from 'next/headers';

import type { BackendActiveScope, BackendScopeType } from '../domain/backendSession';

export const ACTIVE_SCOPE_TYPE_COOKIE = 'active_scope_type';
export const ACTIVE_SCOPE_ID_COOKIE = 'active_scope_id';
export const ACTIVE_RESTAURANT_ID_COOKIE = 'active_restaurant_id';

const BACKEND_SCOPE_TYPES: BackendScopeType[] = [
  'organization',
  'chain',
  'company',
  'restaurant',
  'zone',
  'self',
];

function isBackendScopeType(value: string | undefined | null): value is BackendScopeType {
  return typeof value === 'string' && BACKEND_SCOPE_TYPES.includes(value as BackendScopeType);
}

function cookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

export async function readStoredActiveScope(): Promise<BackendActiveScope | null> {
  const store = await cookies();
  const scopeType = store.get(ACTIVE_SCOPE_TYPE_COOKIE)?.value ?? null;
  const scopeId = store.get(ACTIVE_SCOPE_ID_COOKIE)?.value ?? null;

  if (!isBackendScopeType(scopeType)) return null;

  return {
    scopeId: scopeId || null,
    scopeType,
  };
}

export async function readLegacyActiveRestaurantId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_RESTAURANT_ID_COOKIE)?.value ?? null;
}

export async function persistActiveScope(
  scope: BackendActiveScope,
  effectiveRestaurantId: string | null = null,
): Promise<void> {
  const store = await cookies();

  if (scope.scopeType === 'self' || !scope.scopeId) {
    store.delete(ACTIVE_SCOPE_TYPE_COOKIE);
    store.delete(ACTIVE_SCOPE_ID_COOKIE);
  } else {
    store.set(ACTIVE_SCOPE_TYPE_COOKIE, scope.scopeType, cookieOptions());
    store.set(ACTIVE_SCOPE_ID_COOKIE, scope.scopeId, cookieOptions());
  }

  const restaurantId =
    scope.scopeType === 'restaurant' ? scope.scopeId : effectiveRestaurantId;

  if (restaurantId) {
    store.set(ACTIVE_RESTAURANT_ID_COOKIE, restaurantId, cookieOptions());
  } else {
    store.delete(ACTIVE_RESTAURANT_ID_COOKIE);
  }
}

export async function clearStoredActiveScope(): Promise<void> {
  const store = await cookies();
  store.delete(ACTIVE_SCOPE_TYPE_COOKIE);
  store.delete(ACTIVE_SCOPE_ID_COOKIE);
  store.delete(ACTIVE_RESTAURANT_ID_COOKIE);
}
