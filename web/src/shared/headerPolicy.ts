import type { AppRole } from '@/modules/auth_users';
import { canAccessSchedulesModule } from '@/shared/schedulePolicy';

export function canPickRestaurantHeader(role: AppRole): boolean {
  return role === 'admin' || role === 'office';
}

export function canSeeEmployeesInNav(role: AppRole): boolean {
  return role !== 'employee';
}

export function canSeeSchedulesInNav(role: AppRole): boolean {
  return canAccessSchedulesModule(role);
}
