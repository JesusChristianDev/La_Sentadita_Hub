import type {
  ActorLike,
  RequestContext,
  SystemRole,
} from '@/modules/authz';
import {
  can,
  isRequestContext,
  toRequestContext,
} from '@/modules/authz';
import type { EmployeeListItem } from '@/modules/employees';
import type { PersonProfile } from '@/modules/people';

type ScheduleActor =
  | SystemRole
  | RequestContext
  | (Pick<PersonProfile, 'id' | 'role' | 'zone_id'> & {
      restaurant_id?: string | null;
    })
  | (Pick<EmployeeListItem, 'id' | 'system_role' | 'zone_id'> & {
      restaurant_id?: string | null;
    })
  | ({
      id: string;
      system_role: SystemRole;
      zone_id: string | null;
    } & {
      restaurant_id?: string | null;
    });

function normalizeActor(actor: ScheduleActor): ActorLike {
  if (typeof actor === 'string' || isRequestContext(actor)) {
    return actor as ActorLike;
  }

  const systemRole = 'system_role' in actor ? actor.system_role : actor.role;

  return {
    id: actor.id,
    restaurant_id: actor.restaurant_id ?? null,
    role: systemRole,
    system_role: systemRole,
    zone_id: actor.zone_id ?? null,
  };
}

export function canAccessSchedulesModule(actor: ScheduleActor): boolean {
  return can(normalizeActor(actor), 'schedule.view');
}

export function canAccessScheduleEditor(actor: ScheduleActor): boolean {
  return can(normalizeActor(actor), 'schedule.edit_draft');
}

export function canPublishSchedules(actor: ScheduleActor): boolean {
  return can(normalizeActor(actor), 'schedule.publish');
}

export function canManageShiftTemplates(actor: ScheduleActor): boolean {
  return can(normalizeActor(actor), 'schedule.manage_templates');
}

export function canReviewSchedules(actor: ScheduleActor): boolean {
  return can(normalizeActor(actor), 'schedule.review');
}

export function hasRestaurantWideScheduleAccess(actor: ScheduleActor): boolean {
  const requestContext = getScheduleRequestContext(actor);
  return (
    requestContext.systemRole === 'admin' ||
    requestContext.systemRole === 'owner' ||
    requestContext.systemRole === 'manager'
  );
}

export function getScheduleRequestContext(actor: ScheduleActor): RequestContext {
  return toRequestContext(normalizeActor(actor));
}

export function canEditEmployeeSchedule(
  actor: ScheduleActor,
  employee: Pick<EmployeeListItem, 'id' | 'zone_id'>,
): boolean {
  return can(normalizeActor(actor), 'schedule.edit_employee', {
    targetUserId: employee.id,
    targetZoneId: employee.zone_id,
    zoneId: employee.zone_id,
  });
}

export function canViewEmployeeScheduleDraft(
  actor: ScheduleActor,
  employee: Pick<EmployeeListItem, 'id' | 'zone_id'>,
): boolean {
  return canEditEmployeeSchedule(actor, employee);
}
