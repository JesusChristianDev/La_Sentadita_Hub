import type { AppRole } from '@/modules/auth_users';

export function canPickRestaurantHeader(role: AppRole): boolean {
  return role === 'admin' || role === 'office';
}

export function canSeeEmployeesInNav(role: AppRole): boolean {
  return role !== 'employee';
}
