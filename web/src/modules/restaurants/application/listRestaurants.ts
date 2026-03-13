import { createSupabaseServerClient } from '@/shared/supabase/server';

import type { Restaurant } from '../domain/restaurant';

export async function listRestaurants(): Promise<Restaurant[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, is_active')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to list restaurants: ${error.message}`);
  }

  return (data ?? []) as Restaurant[];
}
