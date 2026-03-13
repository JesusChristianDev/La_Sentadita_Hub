import type { AppRole } from '@/modules/auth_users';

export function requiresScheduledCells(role: AppRole): boolean {
  return role !== 'manager' && role !== 'sub_manager';
}
