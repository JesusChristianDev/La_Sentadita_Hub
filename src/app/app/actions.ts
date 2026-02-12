'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { type AppRole, getCurrentUserContext } from '@/modules/auth_users';
import { createSupabaseServerClient } from '@/shared/supabase/server';

function isAdminOrOffice(role: AppRole): boolean {
  return role === 'admin' || role === 'office';
}

export async function setActiveRestaurant(formData: FormData) {
  const restaurantId = String(formData.get('restaurantId') ?? '').trim();
  if (!restaurantId) redirect('/app');

  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  if (!isAdminOrOffice(ctx.profile.role)) redirect('/app');

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, is_active')
    .eq('id', restaurantId)
    .single();

  if (error || !data || !data.is_active) redirect('/app');

  const store = await cookies();
  store.set('active_restaurant_id', restaurantId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });

  redirect('/app');
}
