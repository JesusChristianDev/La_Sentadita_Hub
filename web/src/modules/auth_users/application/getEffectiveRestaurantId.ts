import { cookies } from 'next/headers';

import type { Profile } from '../domain/profile';

/**
 * Resolves the effective restaurant ID for a given user profile.
 * - For employees/managers assigned to a specific restaurant, it uses their profile's restaurant_id.
 * - For admin/office users (global roles), it attempts to read the 'active_restaurant_id' cookie.
 */
export async function getEffectiveRestaurantId(profile: Profile): Promise<string | null> {
  // If the profile has a fixed restaurant_id, it always takes precedence.
  if (profile.restaurant_id) {
    return profile.restaurant_id;
  }

  // Otherwise, if the user is a global role (admin/office), check the cookie.
  const isGlobalRole = profile.role === 'admin' || profile.role === 'office';
  if (isGlobalRole) {
    const store = await cookies();
    return store.get('active_restaurant_id')?.value ?? null;
  }

  return null;
}
