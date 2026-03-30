import type { SystemRole } from '@/modules/authz';

export function requiresScheduledCells(role: SystemRole): boolean {
  return role === 'employee' || role === 'area_lead';
}
