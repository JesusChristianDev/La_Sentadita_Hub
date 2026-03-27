import type { ScopeType, SystemRole } from '../domain/systemRoles';
import type { ActorLike, RequestContext } from './requestContext';

export type AuthzAction =
  | 'restaurant_context.select'
  | 'employees.view'
  | 'employees.create'
  | 'employees.manage'
  | 'employees.manage_target'
  | 'schedule.view'
  | 'schedule.edit_draft'
  | 'schedule.manage_templates'
  | 'schedule.publish'
  | 'schedule.review'
  | 'schedule.edit_employee'
  | 'tasks.view'
  | 'tasks.manage'
  | 'procedures.view'
  | 'procedures.manage';

export type AuthzResource = {
  restaurantId?: string | null;
  targetRestaurantId?: string | null;
  targetSystemRole?: SystemRole;
  targetUserId?: string | null;
  targetZoneId?: string | null;
  zoneId?: string | null;
};

function isGlobalRole(role: RequestContext['systemRole']): boolean {
  return role === 'admin' || role === 'owner' || role === 'office';
}

function isRestaurantWideRole(role: RequestContext['systemRole']): boolean {
  return isGlobalRole(role) || role === 'manager';
}

function isAreaLead(role: RequestContext['systemRole']): boolean {
  return role === 'area_lead';
}

export function getActorScopeType(actor: ActorLike): ScopeType {
  if (typeof actor === 'string') {
    return actor === 'admin' || actor === 'owner' || actor === 'office'
      ? 'organization'
      : actor === 'manager' || actor === 'employee'
        ? 'restaurant'
        : 'zone';
  }

  if ('systemRole' in actor) return actor.scopeType;

  if ('requestContext' in actor) return actor.requestContext.scopeType;

  if (actor.systemRole === 'admin' || actor.systemRole === 'owner' || actor.systemRole === 'office') {
    return 'organization';
  }

  if (actor.systemRole === 'manager' || actor.systemRole === 'employee') {
    return 'restaurant';
  }

  return 'zone';
}

export function can(
  ctx: RequestContext,
  action: AuthzAction,
  resource?: AuthzResource,
): boolean {
  switch (action) {
    case 'restaurant_context.select':
      return isGlobalRole(ctx.systemRole);

    case 'employees.view':
      return isRestaurantWideRole(ctx.systemRole);

    case 'employees.create':
      return isGlobalRole(ctx.systemRole);

    case 'employees.manage':
      return isRestaurantWideRole(ctx.systemRole);

    case 'employees.manage_target': {
      const targetRole = resource?.targetSystemRole;
      if (isGlobalRole(ctx.systemRole)) return true;
      if (
        ctx.systemRole === 'manager' &&
        resource?.targetRestaurantId &&
        resource.targetRestaurantId === ctx.effectiveRestaurantId &&
        targetRole !== 'manager' &&
        targetRole !== 'admin' &&
        targetRole !== 'office' &&
        targetRole !== 'owner'
      ) {
        return true;
      }
      return false;
    }

    case 'schedule.view':
    case 'tasks.view':
    case 'procedures.view':
      return true;

    case 'tasks.manage':
    case 'procedures.manage':
      return isRestaurantWideRole(ctx.systemRole) || isAreaLead(ctx.systemRole);

    case 'schedule.edit_draft':
      return isRestaurantWideRole(ctx.systemRole) || isAreaLead(ctx.systemRole);

    case 'schedule.manage_templates':
    case 'schedule.publish':
    case 'schedule.review':
      return isRestaurantWideRole(ctx.systemRole);

    case 'schedule.edit_employee':
      if (isRestaurantWideRole(ctx.systemRole)) return true;
      if (!isAreaLead(ctx.systemRole)) return false;
      if (!ctx.zoneId) return false;
      return (resource?.targetZoneId ?? resource?.zoneId ?? null) === ctx.zoneId;
  }
}

export function getAllowedScopeForAction(action: AuthzAction): ScopeType[] {
  switch (action) {
    case 'restaurant_context.select':
      return ['organization'];
    case 'employees.view':
    case 'employees.create':
    case 'employees.manage':
    case 'employees.manage_target':
      return ['organization', 'restaurant'];
    case 'schedule.view':
    case 'tasks.view':
    case 'procedures.view':
      return ['organization', 'company', 'restaurant', 'zone'];
    case 'schedule.edit_draft':
    case 'tasks.manage':
    case 'procedures.manage':
      return ['organization', 'restaurant', 'zone'];
    case 'schedule.manage_templates':
    case 'schedule.publish':
    case 'schedule.review':
      return ['organization', 'restaurant'];
    case 'schedule.edit_employee':
      return ['organization', 'restaurant', 'zone'];
    default:
      return ['organization', 'company', 'restaurant', 'zone'];
  }
}
