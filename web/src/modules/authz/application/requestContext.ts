import type { AppRole, PersonProfile } from '@/modules/people';

import type { ResponsibilityLevel } from '../domain/responsibilityLevel';
import { deriveResponsibilityLevel } from '../domain/responsibilityLevel';
import type { ScopeType, SystemRole } from '../domain/systemRoles';

export type ActiveScope = {
  scopeId: string | null;
  scopeType: ScopeType;
};

export type RequestContext = {
  activeScopes: ActiveScope[];
  chainId: string | null;          // v6 — cadena a la que pertenece el actor
  effectiveRestaurantId: string | null;
  appRole: AppRole;
  now: Date;
  personId: string;
  profile: PersonProfile;
  responsibilityLevel: ResponsibilityLevel;
  restaurantId: string | null;
  scopeType: ScopeType;
  systemRole: SystemRole;
  traceId: string;
  userId: string;
  zoneId: string | null;
};

export type UserContextLike = {
  profile: PersonProfile;
  userId: string;
};

export type ActorLike =
  | AppRole
  | UserContextLike
  | RequestContext
  | Pick<PersonProfile, 'id' | 'restaurant_id' | 'role' | 'zone_id'>;

export function deriveSystemRole(profile: PersonProfile): SystemRole {
  return profile.system_role ?? (profile.role as SystemRole);
}

export function deriveScopeType(profile: PersonProfile, systemRole: SystemRole): ScopeType {
  if (systemRole === 'admin' || systemRole === 'office') return 'platform';
  if (systemRole === 'manager' || systemRole === 'sub_manager') return 'restaurant';
  if (systemRole === 'area_lead') return 'zone';
  return 'self';
}

export function deriveActiveScopes(
  profile: PersonProfile,
  systemRole: SystemRole,
  effectiveRestaurantId: string | null,
): ActiveScope[] {
  if (systemRole === 'admin' || systemRole === 'office') {
    return [
      { scopeId: null, scopeType: 'platform' },
      ...(effectiveRestaurantId
        ? [{ scopeId: effectiveRestaurantId, scopeType: 'restaurant' as const }]
        : []),
    ];
  }

  if (systemRole === 'manager' || systemRole === 'sub_manager') {
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
  profile: PersonProfile,
  effectiveRestaurantId: string | null = profile.restaurant_id ?? null,
): RequestContext {
  const systemRole = deriveSystemRole(profile);
  const scopeType = deriveScopeType(profile, systemRole);

  return {
    activeScopes: deriveActiveScopes(profile, systemRole, effectiveRestaurantId),
    chainId: profile.chain_id ?? null,   // v6
    effectiveRestaurantId,
    appRole: profile.role,
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

// Bug fix: faltaba el cierre ) en el original
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
      'appRole' in value &&
      'profile' in value &&
      'userId' in value,
  );
}
