import type { AppRole, Profile } from '@/modules/people';

import type { AuthzAction, AuthzResource } from './aclRules';
import { can as canAgainstContext } from './aclRules';
import {
  buildRequestContextFromLegacyProfile,
  buildRequestContextFromLegacyUserContext,
  isRequestContext,
  type LegacyActorLike,
  type RequestContext,
} from './requestContext';

function isProfileLike(actor: LegacyActorLike): actor is Pick<
  Profile,
  'id' | 'restaurant_id' | 'role' | 'zone_id'
> {
  return typeof actor !== 'string' && !('systemRole' in actor) && 'role' in actor;
}

function normalizeActor(actor: LegacyActorLike): RequestContext {
  if (isRequestContext(actor)) return actor;

  if (typeof actor === 'string') {
    return buildRequestContextFromLegacyProfile({
      avatar_path: null,
      employee_code: 0,
      full_name: '',
      id: '',
      is_active: true,
      must_change_password: false,
      restaurant_id: null,
      role: actor,
      zone_id: null,
    });
  }

  if ('profile' in actor) {
    return buildRequestContextFromLegacyUserContext(actor);
  }

  if (isProfileLike(actor)) {
    return buildRequestContextFromLegacyProfile({
      avatar_path: null,
      employee_code: 0,
      full_name: '',
      id: actor.id,
      is_active: true,
      must_change_password: false,
      restaurant_id: actor.restaurant_id ?? null,
      role: actor.role,
      zone_id: actor.zone_id ?? null,
    });
  }

  const fallbackRole = (actor as { role: AppRole }).role;
  return buildRequestContextFromLegacyProfile({
    avatar_path: null,
    employee_code: 0,
    full_name: '',
    id: '',
    is_active: true,
    must_change_password: false,
    restaurant_id: null,
    role: fallbackRole,
    zone_id: null,
  });
}

export function can(
  actor: LegacyActorLike,
  action: AuthzAction,
  resource?: AuthzResource,
): boolean {
  return canAgainstContext(normalizeActor(actor), action, resource);
}

export function isAreaLead(actor: LegacyActorLike): boolean {
  return normalizeActor(actor).systemRole === 'area_lead';
}

export function assertCan(
  actor: LegacyActorLike,
  action: AuthzAction,
  resource?: AuthzResource,
): void {
  if (can(actor, action, resource)) return;
  throw new Error(`FORBIDDEN: No tienes permisos para ${action}.`);
}

export function toRequestContext(actor: LegacyActorLike): RequestContext {
  return normalizeActor(actor);
}
