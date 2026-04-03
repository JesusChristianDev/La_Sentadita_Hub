import type { PersonProfile } from '@/modules/people';

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
  | SystemRole
  | UserContextLike
  | RequestContext
  | Pick<PersonProfile, 'id' | 'restaurant_id' | 'system_role' | 'zone_id'>;

export function deriveSystemRole(profile: PersonProfile): SystemRole {
  return coerceSystemRole(profile.system_role);
}

export function deriveScopeType(profile: PersonProfile, systemRole: SystemRole): ScopeType {
  if (systemRole === 'admin' || systemRole === 'owner' || systemRole === 'office') {
    return 'organization';
  }
  if (systemRole === 'manager') return 'restaurant';
  if (systemRole === 'area_lead') return 'zone';
  return 'self';
}

function buildDefaultActiveScope(
  profile: PersonProfile,
  systemRole: SystemRole,
  effectiveRestaurantId: string | null,
): ActiveScope {
  if (systemRole === 'admin' || systemRole === 'owner' || systemRole === 'office') {
    return { scopeId: null, scopeType: 'organization' };
  }

  if (systemRole === 'manager') {
    return {
      scopeId: effectiveRestaurantId ?? profile.restaurant_id ?? null,
      scopeType: 'restaurant',
    };
  }

  if (systemRole === 'area_lead') {
    return {
      scopeId: profile.zone_id ?? null,
      scopeType: 'zone',
    };
  }

  return { scopeId: profile.id, scopeType: 'self' };
}

export function deriveActiveScopes(
  profile: PersonProfile,
  systemRole: SystemRole,
  effectiveRestaurantId: string | null,
  activeScope: ActiveScope,
): ActiveScope[] {
  const scopes: ActiveScope[] = [];
  const pushScope = (scope: ActiveScope) => {
    if (
      scopes.some(
        (current) =>
          current.scopeType === scope.scopeType && current.scopeId === scope.scopeId,
      )
    ) {
      return;
    }

    scopes.push(scope);
  };

  pushScope(activeScope);

  if (systemRole === 'admin' || systemRole === 'owner' || systemRole === 'office') {
    if (
      activeScope.scopeType !== 'organization' &&
      activeScope.scopeType !== 'chain' &&
      activeScope.scopeType !== 'company' &&
      activeScope.scopeType !== 'restaurant' &&
      activeScope.scopeType !== 'self'
    ) {
      pushScope({ scopeId: null, scopeType: 'organization' });
    }

    if (effectiveRestaurantId) {
      pushScope({ scopeId: effectiveRestaurantId, scopeType: 'restaurant' });
    }

    return scopes;
  }

  if (systemRole === 'manager') {
    pushScope({
      scopeId: effectiveRestaurantId ?? profile.restaurant_id ?? null,
      scopeType: 'restaurant',
    });
    return scopes;
  }

  if (systemRole === 'area_lead') {
    pushScope({
      scopeId: effectiveRestaurantId ?? profile.restaurant_id ?? null,
      scopeType: 'restaurant',
    });
    pushScope({ scopeId: profile.zone_id ?? null, scopeType: 'zone' });
    return scopes;
  }

  return scopes;
}

export function buildRequestContextFromProfile(
  profile: PersonProfile,
  effectiveRestaurantId: string | null = profile.restaurant_id ?? null,
  activeScope?: ActiveScope,
): RequestContext {
  const systemRole = deriveSystemRole(profile);
  const resolvedActiveScope =
    activeScope ?? buildDefaultActiveScope(profile, systemRole, effectiveRestaurantId);
  const scopeType = resolvedActiveScope.scopeType;

  return {
    activeScopes: deriveActiveScopes(
      profile,
      systemRole,
      effectiveRestaurantId,
      resolvedActiveScope,
    ),
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
  activeScope?: ActiveScope,
): RequestContext {
  return buildRequestContextFromProfile(
    userContext.profile,
    effectiveRestaurantId,
    activeScope,
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
