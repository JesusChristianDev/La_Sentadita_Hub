import type { RequestContext } from './requestContext';

function hasActiveScope(
  ctx: RequestContext,
  scopeType: 'organization' | 'company' | 'restaurant' | 'zone' | 'self',
  scopeId: string | null,
): boolean {
  return ctx.activeScopes.some(
    (scope) => scope.scopeType === scopeType && scope.scopeId === scopeId,
  );
}

export function isGlobalSystemRole(ctx: RequestContext): boolean {
  return ctx.systemRole === 'admin' || ctx.systemRole === 'owner' || ctx.systemRole === 'office';
}

export function isRestaurantManagementRole(ctx: RequestContext): boolean {
  return ctx.systemRole === 'manager';
}

export function isManagementSystemRole(ctx: RequestContext): boolean {
  return isGlobalSystemRole(ctx) || isRestaurantManagementRole(ctx);
}

export function isAreaLeadSystemRole(ctx: RequestContext): boolean {
  return ctx.systemRole === 'area_lead';
}

export function isSelfScope(ctx: RequestContext, personId: string): boolean {
  return hasActiveScope(ctx, 'self', personId) || ctx.personId === personId;
}

export function canAccessRestaurant(
  ctx: RequestContext,
  restaurantId: string | null | undefined,
): boolean {
  if (!restaurantId) return false;
  if (isGlobalSystemRole(ctx)) return true;
  return hasActiveScope(ctx, 'restaurant', restaurantId);
}

export function canManageRestaurant(
  ctx: RequestContext,
  restaurantId: string | null | undefined,
): boolean {
  if (!restaurantId) return false;
  if (isGlobalSystemRole(ctx)) return true;
  return isRestaurantManagementRole(ctx) && canAccessRestaurant(ctx, restaurantId);
}

export function canAccessZone(
  ctx: RequestContext,
  restaurantId: string | null | undefined,
  zoneId: string | null | undefined,
): boolean {
  if (!restaurantId) return false;
  if (canManageRestaurant(ctx, restaurantId)) return true;
  if (!zoneId || !isAreaLeadSystemRole(ctx) || !canAccessRestaurant(ctx, restaurantId)) {
    return false;
  }

  return hasActiveScope(ctx, 'zone', zoneId);
}

export function assertRestaurantAccess(
  ctx: RequestContext,
  restaurantId: string | null | undefined,
  message = 'FORBIDDEN: No puedes acceder a recursos de otro restaurante.',
): void {
  if (!canAccessRestaurant(ctx, restaurantId)) {
    throw new Error(message);
  }
}

export function assertRestaurantManagement(
  ctx: RequestContext,
  restaurantId: string | null | undefined,
  message = 'FORBIDDEN: No puedes gestionar recursos de este restaurante.',
): void {
  if (!canManageRestaurant(ctx, restaurantId)) {
    throw new Error(message);
  }
}

export function assertZoneAccess(
  ctx: RequestContext,
  restaurantId: string | null | undefined,
  zoneId: string | null | undefined,
  message = 'FORBIDDEN: No puedes acceder a recursos de esta zona.',
): void {
  if (!canAccessZone(ctx, restaurantId, zoneId)) {
    throw new Error(message);
  }
}

export function assertSelfOrManagement(
  ctx: RequestContext,
  personId: string,
  message = 'FORBIDDEN: No puedes acceder a recursos de otra persona.',
): void {
  if (isSelfScope(ctx, personId) || isManagementSystemRole(ctx)) {
    return;
  }

  throw new Error(message);
}
