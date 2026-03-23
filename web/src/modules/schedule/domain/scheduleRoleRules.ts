import type { SystemRole } from '@/modules/authz';

export function requiresScheduledCells(role: SystemRole): boolean {
  return role !== 'manager' && role !== 'sub_manager';
}
