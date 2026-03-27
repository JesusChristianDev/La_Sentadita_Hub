import type { AppRole, PersonProfile } from '@/modules/people';

import type { AuthzAction, AuthzResource } from './aclRules';
import { can as canAgainstContext } from './aclRules';
import {
  type ActorLike,
  buildRequestContextFromProfile,
  buildRequestContextFromUserContext,
  isRequestContext,
  type RequestContext,
} from './requestContext';

function isProfileLike(actor: ActorLike): actor is Pick<
  PersonProfile,
  'id' | 'restaurant_id' | 'role' | 'zone_id'
> {
  return typeof actor !== 'string' && !('systemRole' in actor) && 'role' in actor;
}

function normalizeActor(actor: ActorLike): RequestContext {
  if (isRequestContext(actor)) return actor;

  if (typeof actor === 'string') {
    return buildRequestContextFromProfile({
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
    return buildRequestContextFromUserContext(actor);
  }

  if (isProfileLike(actor)) {
    return buildRequestContextFromProfile({
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
  return buildRequestContextFromProfile({
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
  actor: ActorLike,
  action: AuthzAction,
  resource?: AuthzResource,
): boolean {
  return canAgainstContext(normalizeActor(actor), action, resource);
}

export function isAreaLead(actor: ActorLike): boolean {
  return normalizeActor(actor).systemRole === 'area_lead';
}

export function assertCan(
  actor: ActorLike,
  action: AuthzAction,
  resource?: AuthzResource,
): void {
  if (can(actor, action, resource)) return;
  throw new Error(`FORBIDDEN: No tienes permisos para ${action}.`);
}

export function toRequestContext(actor: ActorLike): RequestContext {
  return normalizeActor(actor);
}
