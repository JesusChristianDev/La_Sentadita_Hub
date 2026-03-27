import { listEmploymentForRestaurant } from '@/shared/db/employment';

import type { EmploymentListItem, EmploymentStatusFilter } from '../domain/employmentTypes';

export async function listEmploymentForRestaurant(
  restaurantId: string,
  status: EmploymentStatusFilter = 'active',
): Promise<EmploymentListItem[]> {
  return listEmploymentForRestaurant(restaurantId, status);
}

export const listEmployees = listEmploymentForRestaurant;
