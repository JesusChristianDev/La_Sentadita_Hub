'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getCurrentUserContext, persistActiveScope } from '@/modules/auth_users';
import { can } from '@/modules/authz';

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

  if (!can(ctx.requestContext, 'restaurant_context.select')) redirect(returnPath);

  const allowedRestaurant = ctx.backendSession.visibleRestaurants.find(
    (restaurant) => restaurant.id === restaurantId && restaurant.isActive,
  );
  if (!allowedRestaurant) redirect(returnPath);

  await persistActiveScope(
    { scopeId: restaurantId, scopeType: 'restaurant' },
    restaurantId,
  );

  redirect(returnPath);
}
