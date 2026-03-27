export type SystemRole =
  | 'admin'
  | 'owner'
  | 'office'
  | 'manager'
  | 'area_lead'
  | 'employee';

export type ScopeType = 'organization' | 'company' | 'restaurant' | 'zone';

export const SYSTEM_ROLES: SystemRole[] = [
  'admin',
  'owner',
  'office',
  'manager',
  'area_lead',
  'employee',
];

export function isSystemRole(value: unknown): value is SystemRole {
  return typeof value === 'string' && SYSTEM_ROLES.includes(value as SystemRole);
}
