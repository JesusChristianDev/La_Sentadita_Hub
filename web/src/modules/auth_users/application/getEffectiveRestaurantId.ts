import { cookies } from 'next/headers';

import { deriveSystemRole } from '@/modules/authz';
import type { PersonProfile } from '@/modules/people';

/**
 * Resolves the effective restaurant ID for a given user profile.
 * - For employees/managers assigned to a specific restaurant, it uses their profile's restaurant_id.
 * - For admin/owner/office users (global roles), it attempts to read the 'active_restaurant_id' cookie.
 */
export async function getEffectiveRestaurantId(profile: PersonProfile): Promise<string | null> {
  if (profile.restaurant_id) {
    return profile.restaurant_id;
  }

  const systemRole = deriveSystemRole(profile);
  if (systemRole === 'admin' || systemRole === 'owner' || systemRole === 'office') {
    const store = await cookies();
    return store.get('active_restaurant_id')?.value ?? null;
  }

  return null;
}
