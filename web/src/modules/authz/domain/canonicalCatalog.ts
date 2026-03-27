/**
 * Catálogo canónico de autorización.
 *
 * Nota de migración:
 * - Este archivo define el target canónico.
 * - systemRoles.ts mantiene compatibilidad temporal durante la migración.
 */
export type CanonicalSystemRole =
  | 'admin'
  | 'owner'
  | 'office'
  | 'manager'
  | 'area_lead'
  | 'employee';

export type CanonicalScopeType =
  | 'organization'
  | 'company'
  | 'restaurant'
  | 'zone';

export const CANONICAL_SYSTEM_ROLES: CanonicalSystemRole[] = [
  'admin',
  'owner',
  'office',
  'manager',
  'area_lead',
  'employee',
];

export const CANONICAL_SCOPE_TYPES: CanonicalScopeType[] = [
  'organization',
  'company',
  'restaurant',
  'zone',
];

export function isCanonicalSystemRole(value: unknown): value is CanonicalSystemRole {
  return (
    typeof value === 'string' &&
    CANONICAL_SYSTEM_ROLES.includes(value as CanonicalSystemRole)
  );
}

export function isCanonicalScopeType(value: unknown): value is CanonicalScopeType {
  return (
    typeof value === 'string' &&
    CANONICAL_SCOPE_TYPES.includes(value as CanonicalScopeType)
  );
}
