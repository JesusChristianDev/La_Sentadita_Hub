import { listEmploymentForRestaurantProjection } from '@/shared/db/employment';

import type { EmploymentListItem, EmploymentStatusFilter } from '../domain/employmentTypes';

export async function listEmploymentForRestaurant(
  restaurantId: string,
  status: EmploymentStatusFilter = 'active',
): Promise<EmploymentListItem[]> {
  return listEmploymentForRestaurantProjection(restaurantId, status);
}

export const listEmployees = listEmploymentForRestaurant;
