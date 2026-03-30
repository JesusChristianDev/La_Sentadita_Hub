import type { AppRole, Profile } from '@/modules/people';

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
  Profile,
  'id' | 'restaurant_id' | 'role' | 'system_role' | 'zone_id'
> {
  return typeof actor !== 'string' && !('systemRole' in actor) && 'role' in actor;
}

function normalizeActor(actor: ActorLike): RequestContext {
  if (isRequestContext(actor)) return actor;

  if (typeof actor === 'string') {
    return buildRequestContextFromProfile({
      access_status: 'active',
      avatar_path: null,
      employee_code: 0,
      full_name: '',
      id: '',
      restaurant_id: null,
      role: actor,
      system_role: actor,
      zone_id: null,
    });
  }

  if ('profile' in actor) {
    return buildRequestContextFromUserContext(actor);
  }

  if (isProfileLike(actor)) {
    return buildRequestContextFromProfile({
      access_status: 'active',
      avatar_path: null,
      employee_code: 0,
      full_name: '',
      id: actor.id,
      restaurant_id: actor.restaurant_id ?? null,
      role: actor.role,
      system_role: actor.system_role ?? actor.role,
      zone_id: actor.zone_id ?? null,
    });
  }

  const fallbackRole = (actor as { role: AppRole }).role;
  return buildRequestContextFromProfile({
    access_status: 'active',
    avatar_path: null,
    employee_code: 0,
    full_name: '',
    id: '',
    restaurant_id: null,
    role: fallbackRole,
    system_role: fallbackRole,
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
