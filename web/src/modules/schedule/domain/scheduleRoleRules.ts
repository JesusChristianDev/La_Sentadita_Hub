import type { SystemRole } from '@/shared/authz';

export function requiresScheduledCells(role: SystemRole): boolean {
  return role === 'employee' || role === 'area_lead';
}
