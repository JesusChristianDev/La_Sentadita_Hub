import type { AppRole } from '@/modules/people';

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
  | 'requests.view'
  | 'requests.manage'
  | 'incidents.view'
  | 'incidents.manage'
  | 'documents.view'
  | 'documents.create'
  | 'documents.manage'
  | 'procurement.view'
  | 'procurement.manage'
  | 'notifications.view';

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
  return role === 'admin' || role === 'owner' || role === 'office';
}

function isScheduleAdminRole(role: RequestContext['systemRole']): boolean {
  return role === 'admin';
}

function canViewSchedule(role: RequestContext['systemRole']): boolean {
  return (
    role === 'admin' ||
    role === 'owner' ||
    role === 'office' ||
    role === 'manager' ||
    role === 'area_lead' ||
    role === 'employee'
  );
}

function isRestaurantWideRole(role: RequestContext['systemRole']): boolean {
  return role === 'admin' || role === 'owner' || role === 'manager';
}

function isAreaLead(role: RequestContext['systemRole']): boolean {
  return role === 'area_lead';
}

export function getActorScopeType(actor: ActorLike): ScopeType {
  if (typeof actor === 'string') {
    if (actor === 'admin' || actor === 'owner' || actor === 'office') {
      return 'organization';
    }
    if (actor === 'manager') return 'restaurant';
    if (actor === 'area_lead') return 'zone';
    return 'self';
  }

  if ('systemRole' in actor) return actor.scopeType;

  const profile = 'profile' in actor ? actor.profile : actor;
  const role = profile.role;

  if (role === 'admin' || role === 'owner' || role === 'office') {
    return 'organization';
  }
  if (role === 'manager') return 'restaurant';
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
    case 'employees.manage':
      return isGlobalRole(ctx.systemRole) || ctx.systemRole === 'manager';

    case 'employees.create':
      return isGlobalRole(ctx.systemRole);

    case 'employees.manage_target': {
      const targetRole = resource?.targetSystemRole ?? resource?.targetRole;
      if (isGlobalRole(ctx.systemRole)) return true;
      if (
        ctx.systemRole === 'manager' &&
        resource?.targetRestaurantId &&
        resource.targetRestaurantId === ctx.effectiveRestaurantId &&
        targetRole !== 'manager' &&
        targetRole !== 'admin' &&
        targetRole !== 'owner' &&
        targetRole !== 'office'
      ) {
        return true;
      }
      return false;
    }

    case 'schedule.view':
      return canViewSchedule(ctx.systemRole);

    case 'tasks.view':
    case 'incidents.view':
    case 'documents.view':
    case 'documents.create':
    case 'procurement.view':
    case 'notifications.view':
    case 'requests.view':
      return true;

    case 'tasks.manage':
    case 'requests.manage':
      return (
        isGlobalRole(ctx.systemRole) ||
        ctx.systemRole === 'manager' ||
        isAreaLead(ctx.systemRole)
      );

    case 'incidents.manage':
      return isGlobalRole(ctx.systemRole) || ctx.systemRole === 'manager';

    case 'documents.manage':
      return (
        isGlobalRole(ctx.systemRole) ||
        ctx.systemRole === 'manager'
      );

    case 'procurement.manage':
      return isScheduleAdminRole(ctx.systemRole) || ctx.systemRole === 'office';

    case 'schedule.edit_draft':
      return (
        isScheduleAdminRole(ctx.systemRole) ||
        ctx.systemRole === 'manager' ||
        isAreaLead(ctx.systemRole)
      );

    case 'schedule.manage_templates':
      return (
        isScheduleAdminRole(ctx.systemRole) ||
        ctx.systemRole === 'office' ||
        ctx.systemRole === 'manager'
      );
    case 'schedule.publish':
    case 'schedule.review':
      return isScheduleAdminRole(ctx.systemRole) || ctx.systemRole === 'manager';

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
    case 'incidents.view':
    case 'documents.view':
    case 'documents.create':
    case 'procurement.view':
    case 'notifications.view':
    case 'requests.view':
      return ['organization', 'restaurant', 'zone', 'self'];
    case 'schedule.edit_draft':
    case 'tasks.manage':
    case 'incidents.manage':
    case 'requests.manage':
      return ['organization', 'restaurant', 'zone'];
    case 'documents.manage':
      return ['organization', 'restaurant'];
    case 'procurement.manage':
      return ['organization', 'restaurant'];
    case 'schedule.manage_templates':
    case 'schedule.publish':
    case 'schedule.review':
      return ['organization', 'restaurant'];
    case 'schedule.edit_employee':
      return ['organization', 'restaurant', 'zone'];
    default:
      return ['organization', 'restaurant', 'zone', 'self'];
  }
}
