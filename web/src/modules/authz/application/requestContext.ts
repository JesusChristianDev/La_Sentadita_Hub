import type { AppRole, Profile } from '@/modules/people';

import {
  deriveResponsibilityLevel,
  type ResponsibilityLevel,
} from '../domain/responsibilityLevel';
import {
  coerceSystemRole,
  type ScopeType,
  type SystemRole,
} from '../domain/systemRoles';

export type ActiveScope = {
  scopeId: string | null;
  scopeType: ScopeType;
};

export type RequestContext = {
  activeScopes: ActiveScope[];
  chainId: string | null;
  effectiveRestaurantId: string | null;
  now: Date;
  personId: string;
  profile: Profile;
  responsibilityLevel: ResponsibilityLevel;
  restaurantId: string | null;
  scopeType: ScopeType;
  systemRole: SystemRole;
  traceId: string;
  userId: string;
  zoneId: string | null;
};

export type UserContextLike = {
  profile: Profile;
  userId: string;
};

export type ActorLike =
  | AppRole
  | UserContextLike
  | RequestContext
  | Pick<Profile, 'id' | 'restaurant_id' | 'role' | 'system_role' | 'zone_id'>;

export function deriveSystemRole(profile: Profile): SystemRole {
  return coerceSystemRole(profile.system_role);
}

export function deriveScopeType(profile: Profile, systemRole: SystemRole): ScopeType {
  if (systemRole === 'admin' || systemRole === 'owner' || systemRole === 'office') {
    return 'organization';
  }
  if (systemRole === 'manager') return 'restaurant';
  if (systemRole === 'area_lead') return 'zone';
  return 'self';
}

export function deriveActiveScopes(
  profile: Profile,
  systemRole: SystemRole,
  effectiveRestaurantId: string | null,
): ActiveScope[] {
  if (systemRole === 'admin' || systemRole === 'owner' || systemRole === 'office') {
    return [
      { scopeId: null, scopeType: 'organization' },
      ...(effectiveRestaurantId
        ? [{ scopeId: effectiveRestaurantId, scopeType: 'restaurant' as const }]
        : []),
    ];
  }

  if (systemRole === 'manager') {
    return [
      {
        scopeId: effectiveRestaurantId ?? profile.restaurant_id ?? null,
        scopeType: 'restaurant',
      },
    ];
  }

  if (systemRole === 'area_lead') {
    return [
      {
        scopeId: effectiveRestaurantId ?? profile.restaurant_id ?? null,
        scopeType: 'restaurant',
      },
      { scopeId: profile.zone_id ?? null, scopeType: 'zone' },
    ];
  }

  return [{ scopeId: profile.id, scopeType: 'self' }];
}

export function buildRequestContextFromProfile(
  profile: Profile,
  effectiveRestaurantId: string | null = profile.restaurant_id ?? null,
): RequestContext {
  const systemRole = deriveSystemRole(profile);
  const scopeType = deriveScopeType(profile, systemRole);

  return {
    activeScopes: deriveActiveScopes(profile, systemRole, effectiveRestaurantId),
    chainId: profile.chain_id ?? null,
    effectiveRestaurantId,
    now: new Date(),
    personId: profile.id,
    profile,
    responsibilityLevel: deriveResponsibilityLevel(systemRole),
    restaurantId: profile.restaurant_id ?? null,
    scopeType,
    systemRole,
    traceId: crypto.randomUUID(),
    userId: profile.id,
    zoneId: profile.zone_id ?? null,
  };
}

export function buildRequestContextFromUserContext(
  userContext: UserContextLike,
  effectiveRestaurantId: string | null = userContext.profile.restaurant_id ?? null,
): RequestContext {
  return buildRequestContextFromProfile(
    userContext.profile,
    effectiveRestaurantId,
  );
}

export function isRequestContext(value: unknown): value is RequestContext {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'systemRole' in value &&
      'profile' in value &&
      'userId' in value,
  );
}
