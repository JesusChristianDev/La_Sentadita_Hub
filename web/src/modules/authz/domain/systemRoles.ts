export type SystemRole =
  | 'admin'
  | 'office'
  | 'chain_owner'
  | 'manager'
  | 'sub_manager'
  | 'area_lead'
  | 'employee';

export type ScopeType = 'platform' | 'restaurant' | 'zone' | 'self';

export const SYSTEM_ROLES: SystemRole[] = [
  'admin',
  'office',
  'chain_owner',
  'manager',
  'sub_manager',
  'area_lead',
  'employee',
];

export function isSystemRole(value: unknown): value is SystemRole {
  return typeof value === 'string' && SYSTEM_ROLES.includes(value as SystemRole);
}
