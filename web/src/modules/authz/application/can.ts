import type { AuthzAction, AuthzResource } from './aclRules';
import { can as canAgainstContext } from './aclRules';
import {
  type ActorLike,
  createRequestContext,
  deriveSystemRole,
  isRequestContext,
  type RequestContext,
} from './requestContext';

function normalizeActor(actor: ActorLike): RequestContext {
  if (isRequestContext(actor)) return actor;

  if (typeof actor === 'string') {
    return createRequestContext({
      personId: '',
      systemRole: deriveSystemRole(actor),
    });
  }

  if ('requestContext' in actor) {
    return actor.requestContext;
  }

  return createRequestContext({
    accessStatus: actor.accessStatus,
    chainId: actor.chainId,
    effectiveRestaurantId: actor.effectiveRestaurantId,
    personId: actor.personId,
    restaurantId: actor.restaurantId,
    systemRole: deriveSystemRole(actor.systemRole),
    userId: actor.userId,
    zoneId: actor.zoneId,
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
