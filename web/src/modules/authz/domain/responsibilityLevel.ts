import type { SystemRole } from './systemRoles';

export type ResponsibilityLevel = 0 | 10 | 20 | 40 | 45 | 48 | 50;

const RESPONSIBILITY_LEVEL_BY_ROLE: Record<SystemRole, ResponsibilityLevel> = {
  admin: 50,
  area_lead: 20,
  employee: 10,
  manager: 40,
  office: 45,
  owner: 48,
};

export function deriveResponsibilityLevel(role: SystemRole): ResponsibilityLevel {
  return RESPONSIBILITY_LEVEL_BY_ROLE[role];
}
