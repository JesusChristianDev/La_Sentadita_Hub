import type { AppRole } from '@/modules/people';

import type { ScopeType, SystemRole } from '../domain/systemRoles';
import type { LegacyActorLike, RequestContext } from './requestContext';

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
  targetRole?: AppRole;
  targetSystemRole?: SystemRole;
  targetUserId?: string | null;
  targetZoneId?: string | null;
  zoneId?: string | null;
};

function isGlobalRole(role: RequestContext['systemRole']): boolean {
  return role === 'admin' || role === 'office' || role === 'chain_owner';
}

function isRestaurantWideRole(role: RequestContext['systemRole']): boolean {
  return role === 'admin' || role === 'manager' || role === 'sub_manager';
}

function isAreaLead(role: RequestContext['systemRole']): boolean {
  return role === 'area_lead';
}

export function getActorScopeType(actor: LegacyActorLike): ScopeType {
  if (typeof actor === 'string') {
    return actor === 'admin' || actor === 'office' || actor === 'chain_owner'
      ? 'platform'
      : actor === 'manager' || actor === 'sub_manager'
        ? 'restaurant'
        : 'self';
  }

  if ('systemRole' in actor) return actor.scopeType;

  const profile = 'profile' in actor ? actor.profile : actor;
  const role = profile.role;

  if (role === 'admin' || role === 'office' || role === 'chain_owner') return 'platform';
  if (role === 'manager' || role === 'sub_manager') return 'restaurant';
  if (role === 'area_lead') return 'zone';
  return 'self';
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
      return (
        isGlobalRole(ctx.systemRole) ||
        ctx.systemRole === 'manager' ||
        ctx.systemRole === 'sub_manager'
      );

    case 'employees.create':
      return isGlobalRole(ctx.systemRole);

    case 'employees.manage':
      return (
        isGlobalRole(ctx.systemRole) ||
        ctx.systemRole === 'manager' ||
        ctx.systemRole === 'sub_manager'
      );

    case 'employees.manage_target':
      const targetRole = resource?.targetSystemRole ?? resource?.targetRole;
      if (isGlobalRole(ctx.systemRole)) return true;
      if (
        (ctx.systemRole === 'manager' || ctx.systemRole === 'sub_manager') &&
        resource?.targetRestaurantId &&
        resource.targetRestaurantId === ctx.effectiveRestaurantId &&
        targetRole !== 'manager' &&
        targetRole !== 'admin' &&
        targetRole !== 'office' &&
        targetRole !== 'chain_owner'
      ) {
        return true;
      }
      return false;

    case 'schedule.view':
    case 'tasks.view':
    case 'procedures.view':
      return true;

    case 'tasks.manage':
    case 'procedures.manage':
      return (
        isGlobalRole(ctx.systemRole) ||
        ctx.systemRole === 'manager' ||
        ctx.systemRole === 'sub_manager' ||
        isAreaLead(ctx.systemRole)
      );

    case 'schedule.edit_draft':
      return (
        isGlobalRole(ctx.systemRole) ||
        ctx.systemRole === 'manager' ||
        ctx.systemRole === 'sub_manager' ||
        isAreaLead(ctx.systemRole)
      );

    case 'schedule.manage_templates':
      return (
        isGlobalRole(ctx.systemRole) ||
        ctx.systemRole === 'manager' ||
        ctx.systemRole === 'sub_manager'
      );

    case 'schedule.publish':
      return (
        isGlobalRole(ctx.systemRole) ||
        ctx.systemRole === 'manager' ||
        ctx.systemRole === 'sub_manager'
      );

    case 'schedule.review':
      return (
        isGlobalRole(ctx.systemRole) ||
        ctx.systemRole === 'manager' ||
        ctx.systemRole === 'sub_manager'
      );

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
      return ['platform'];
    case 'employees.view':
    case 'employees.create':
    case 'employees.manage':
    case 'employees.manage_target':
      return ['platform', 'restaurant'];
    case 'schedule.view':
    case 'tasks.view':
    case 'procedures.view':
      return ['platform', 'restaurant', 'zone', 'self'];
    case 'schedule.edit_draft':
    case 'tasks.manage':
    case 'procedures.manage':
      return ['platform', 'restaurant', 'zone'];
    case 'schedule.manage_templates':
    case 'schedule.publish':
    case 'schedule.review':
      return ['platform', 'restaurant'];
    case 'schedule.edit_employee':
      return ['platform', 'restaurant', 'zone'];
    default:
      return ['platform', 'restaurant', 'zone', 'self'];
  }
}
