'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { type AppRole, getCurrentUserContext } from '@/modules/auth_users';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

function isAdminOrOffice(role: AppRole): boolean {
  return role === 'admin' || role === 'office';
}

async function getReturnPath(): Promise<string> {
  const h = await headers();
  const referer = h.get('referer');
  if (!referer) return '/app';

  try {
    const url = new URL(referer);
    const path = `${url.pathname}${url.search}`;
    if (!path.startsWith('/')) return '/app';
    if (path.startsWith('//')) return '/app';
    return path;
  } catch {
    return '/app';
  }
}

export async function setActiveRestaurant(formData: FormData) {
  const returnPath = await getReturnPath();
  const restaurantId = String(formData.get('restaurantId') ?? '').trim();
  if (!restaurantId) redirect(returnPath);

  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  if (!isAdminOrOffice(ctx.profile.role)) redirect(returnPath);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('restaurants')
    .select('id, is_active')
    .eq('id', restaurantId)
    .single();

  if (error || !data || !data.is_active) redirect(returnPath);

  const store = await cookies();
  store.set('active_restaurant_id', restaurantId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });

  redirect(returnPath);
}
