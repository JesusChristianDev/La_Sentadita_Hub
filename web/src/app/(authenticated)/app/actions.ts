'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getCurrentUserContext, persistActiveScope } from '@/modules/auth_users';
import { can } from '@/shared/authz';

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

const scopeFormSchema = z.object({
  scopeId: z.string().uuid().nullable(),
  scopeType: z.enum(['organization', 'chain', 'company', 'restaurant', 'zone', 'self']),
});

function coerceNullableScopeId(value: FormDataEntryValue | null): string | null {
  const parsed = String(value ?? '').trim();
  return parsed.length > 0 ? parsed : null;
}

export async function setActiveScope(formData: FormData) {
  const returnPath = await getReturnPath();
  const payload = scopeFormSchema.safeParse({
    scopeId: coerceNullableScopeId(formData.get('scopeId')),
    scopeType: String(formData.get('scopeType') ?? '').trim(),
  });

  if (!payload.success) redirect(returnPath);

  const ctx = await getCurrentUserContext();
  if (!ctx) redirect('/login');

  const nextScope = payload.data;
  const allowedScope = ctx.backendSession.availableScopes.find(
    (scope) =>
      scope.scopeType === nextScope.scopeType && scope.scopeId === nextScope.scopeId,
  );

  if (!allowedScope) redirect(returnPath);

  const effectiveRestaurantId =
    nextScope.scopeType === 'restaurant'
      ? nextScope.scopeId
      : nextScope.scopeType === 'zone'
        ? ctx.backendSession.currentEmployment?.zoneAssignments.find(
            (assignment) => assignment.isCurrent && assignment.zoneId === nextScope.scopeId,
          )?.restaurantId ?? null
        : null;

  await persistActiveScope(nextScope, effectiveRestaurantId);

  redirect(returnPath);
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

  const nextFormData = new FormData();
  nextFormData.set('scopeId', restaurantId);
  nextFormData.set('scopeType', 'restaurant');

  return setActiveScope(nextFormData);
}
