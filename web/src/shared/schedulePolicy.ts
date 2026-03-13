import type { AppRole, Profile } from '@/modules/auth_users';
import type { EmployeeListItem } from '@/modules/employees';

type NormalizedScheduleActor = {
  id: string | null;
  is_area_lead: boolean;
  role: AppRole;
  zone_id: string | null;
};

type ScheduleActor =
  | AppRole
  | NormalizedScheduleActor
  | Pick<Profile, 'id' | 'role' | 'is_area_lead' | 'zone_id'>
  | Pick<EmployeeListItem, 'id' | 'role' | 'is_area_lead' | 'zone_id'>;

function normalizeActor(actor: ScheduleActor): NormalizedScheduleActor {
  if (typeof actor === 'string') {
    return {
      id: null,
      is_area_lead: false,
      role: actor,
      zone_id: null,
    };
  }

  return {
    id: actor.id,
    is_area_lead: Boolean(actor.is_area_lead),
    role: actor.role,
    zone_id: actor.zone_id ?? null,
  };
}

export function isAreaLead(actor: ScheduleActor): boolean {
  const normalized = normalizeActor(actor);
  return normalized.role === 'employee' && normalized.is_area_lead;
}

export function canAccessSchedulesModule(actor: ScheduleActor): boolean {
  return Boolean(normalizeActor(actor));
}

export function canAccessScheduleEditor(actor: ScheduleActor): boolean {
  const normalized = normalizeActor(actor);
  return (
    normalized.role === 'admin' ||
    normalized.role === 'manager' ||
    normalized.role === 'sub_manager' ||
    isAreaLead(normalized)
  );
}

export function canPublishSchedules(actor: ScheduleActor): boolean {
  const normalized = normalizeActor(actor);
  return (
    normalized.role === 'admin' ||
    normalized.role === 'manager' ||
    normalized.role === 'sub_manager'
  );
}

export function canManageShiftTemplates(actor: ScheduleActor): boolean {
  const normalized = normalizeActor(actor);
  return (
    normalized.role === 'admin' ||
    normalized.role === 'office' ||
    normalized.role === 'manager' ||
    normalized.role === 'sub_manager'
  );
}

export function canReviewSchedules(actor: ScheduleActor): boolean {
  const normalized = normalizeActor(actor);
  return (
    normalized.role === 'admin' ||
    normalized.role === 'office' ||
    normalized.role === 'manager' ||
    normalized.role === 'sub_manager'
  );
}

export function hasRestaurantWideScheduleAccess(actor: ScheduleActor): boolean {
  const normalized = normalizeActor(actor);
  return (
    normalized.role === 'admin' ||
    normalized.role === 'manager' ||
    normalized.role === 'sub_manager'
  );
}

export function canEditEmployeeSchedule(
  actor: ScheduleActor,
  employee: Pick<EmployeeListItem, 'id' | 'zone_id'>,
): boolean {
  const normalized = normalizeActor(actor);

  if (hasRestaurantWideScheduleAccess(normalized)) return true;
  if (!isAreaLead(normalized)) return false;
  if (!normalized.zone_id) return false;

  return employee.zone_id === normalized.zone_id;
}

export function canViewEmployeeScheduleDraft(
  actor: ScheduleActor,
  employee: Pick<EmployeeListItem, 'id' | 'zone_id'>,
): boolean {
  return canEditEmployeeSchedule(actor, employee);
}

export function getScheduleActorRank(actor: ScheduleActor): number {
  const normalized = normalizeActor(actor);

  if (normalized.role === 'admin') return 50;
  if (normalized.role === 'manager') return 40;
  if (normalized.role === 'sub_manager') return 30;
  if (isAreaLead(normalized)) return 20;
  if (normalized.role === 'employee') return 10;

  return 0;
}
