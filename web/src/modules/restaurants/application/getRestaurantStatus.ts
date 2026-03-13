import { createSupabaseServerClient } from '@/shared/supabase/server';

export type RestaurantStatus = {
  id: string;
  is_active: boolean;
};

export async function getRestaurantStatus(id: string): Promise<RestaurantStatus | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('restaurants')
    .select('id, is_active')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return data as RestaurantStatus;
}
