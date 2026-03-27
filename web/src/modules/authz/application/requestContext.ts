import type { AccessStatus } from '@/modules/people';

import type { ResponsibilityLevel } from '../domain/responsibilityLevel';
import { deriveResponsibilityLevel } from '../domain/responsibilityLevel';
import type { ScopeType, SystemRole } from '../domain/systemRoles';
import { isSystemRole } from '../domain/systemRoles';

export type ActiveScope = {
  scopeId: string | null;
  scopeType: ScopeType;
};

export type RequestContext = {
  accessStatus: AccessStatus;
  activeScopes: ActiveScope[];
  chainId: string | null;
  effectiveRestaurantId: string | null;
  now: Date;
  personId: string;
  responsibilityLevel: ResponsibilityLevel;
  restaurantId: string | null;
  scopeType: ScopeType;
  systemRole: SystemRole;
  traceId: string;
  userId: string;
  zoneId: string | null;
};

export type RequestContextSeed = {
  accessStatus?: AccessStatus;
  chainId?: string | null;
  effectiveRestaurantId?: string | null;
  personId: string;
  restaurantId?: string | null;
  systemRole: SystemRole;
  userId?: string;
  zoneId?: string | null;
};

export type UserContextLike = {
  requestContext: RequestContext;
  userId: string;
};

export type ActorLike = SystemRole | RequestContext | RequestContextSeed | UserContextLike;

export function deriveSystemRole(
  value: SystemRole | { role?: string | null; system_role?: string | null },
): SystemRole {
  if (typeof value === 'string') return value;

  const candidate = value.system_role ?? value.role;
  if (isSystemRole(candidate)) return candidate;

  return 'employee';
}

export function deriveScopeType(systemRole: SystemRole): ScopeType {
  if (systemRole === 'admin' || systemRole === 'owner' || systemRole === 'office') {
    return 'organization';
  }

  if (systemRole === 'manager' || systemRole === 'employee') {
    return 'restaurant';
  }

  return 'zone';
}

export function deriveActiveScopes(seed: {
  effectiveRestaurantId: string | null;
  personId: string;
  restaurantId: string | null;
  systemRole: SystemRole;
  zoneId: string | null;
}): ActiveScope[] {
  if (seed.systemRole === 'admin' || seed.systemRole === 'owner' || seed.systemRole === 'office') {
    return [
      { scopeId: null, scopeType: 'organization' },
      ...(seed.effectiveRestaurantId
        ? [{ scopeId: seed.effectiveRestaurantId, scopeType: 'restaurant' as const }]
        : []),
    ];
  }

  if (seed.systemRole === 'manager') {
    if (!seed.restaurantId && !seed.effectiveRestaurantId) {
      throw new Error('INVALID_AUTHZ_CONTEXT: manager requires restaurant scope.');
    }

    return [
      {
        scopeId: seed.effectiveRestaurantId ?? seed.restaurantId,
        scopeType: 'restaurant',
      },
    ];
  }

  if (seed.systemRole === 'area_lead') {
    if (!seed.zoneId) {
      throw new Error('INVALID_AUTHZ_CONTEXT: area_lead requires zone scope.');
    }

    return [
      ...(seed.effectiveRestaurantId || seed.restaurantId
        ? [
            {
              scopeId: seed.effectiveRestaurantId ?? seed.restaurantId,
              scopeType: 'restaurant' as const,
            },
          ]
        : []),
      { scopeId: seed.zoneId, scopeType: 'zone' },
    ];
  }

  // employee: contexto deriva de employment, sin scope personal estructural
  return seed.restaurantId
    ? [{ scopeId: seed.restaurantId, scopeType: 'restaurant' }]
    : [];
}

export function createRequestContext(seed: RequestContextSeed): RequestContext {
  const effectiveRestaurantId = seed.effectiveRestaurantId ?? seed.restaurantId ?? null;
  const restaurantId = seed.restaurantId ?? null;
  const zoneId = seed.zoneId ?? null;

  return {
    accessStatus: seed.accessStatus ?? 'active',
    activeScopes: deriveActiveScopes({
      effectiveRestaurantId,
      personId: seed.personId,
      restaurantId,
      systemRole: seed.systemRole,
      zoneId,
    }),
    chainId: seed.chainId ?? null,
    effectiveRestaurantId,
    now: new Date(),
    personId: seed.personId,
    responsibilityLevel: deriveResponsibilityLevel(seed.systemRole),
    restaurantId,
    scopeType: deriveScopeType(seed.systemRole),
    systemRole: seed.systemRole,
    traceId: crypto.randomUUID(),
    userId: seed.userId ?? seed.personId,
    zoneId,
  };
}

export function isRequestContext(value: unknown): value is RequestContext {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'systemRole' in value &&
      'activeScopes' in value &&
      'personId' in value &&
      'userId' in value,
  );
}
