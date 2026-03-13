import type { EmployeeListItem } from '@/modules/employees';
import {
  canAccessScheduleEditor,
  canManageShiftTemplates,
  canPublishSchedules,
  canReviewSchedules,
  hasRestaurantWideScheduleAccess,
  isAreaLead,
} from '@/shared/schedulePolicy';

import type {
  DayType,
  EmployeeScheduleDayView,
  EmployeeScheduleWeekView,
  Schedule,
  ScheduleActorPermissions,
  ScheduleConfig,
  ScheduleEntry,
  ScheduleHomeStatus,
  ScheduleWeekSummary,
} from '../domain/scheduleTypes';
import {
  buildPublicationState,
  buildPublishedSnapshotEntries,
  buildPublishReview,
  summarizeScheduleIssues,
} from './scheduleCalculations';
import {
  getCurrentAndNextWeekStarts,
  getWeekDates,
  getWeekEnd,
  getWeekRangeLabel,
  getWeekStart,
} from './scheduleDates';
import { buildShiftTextFromEntry } from './shiftValidation';

const SPECIAL_DAY_LABEL: Record<Exclude<DayType, 'work'>, string> = {
  absent: 'Ausencia',
  end_of_contract: 'Fin de contrato',
  not_applicable: 'No aplica',
  rest: 'Libre',
  sick_leave: 'Baja',
  unscheduled: 'Sin horario',
  vacation: 'Vacaciones',
};

export {
  buildPublicationState,
  buildPublishedSnapshotEntries,
  buildPublishReview,
  getCurrentAndNextWeekStarts,
  getWeekDates,
  getWeekEnd,
  getWeekRangeLabel,
  getWeekStart,
  summarizeScheduleIssues,
};

export function buildSchedulePermissions(
  actor: Parameters<typeof canAccessScheduleEditor>[0],
): ScheduleActorPermissions {
  const role = typeof actor === 'string' ? actor : actor.role;

  return {
    can_manage: canAccessScheduleEditor(actor),
    can_manage_templates: canManageShiftTemplates(actor),
    can_publish: canPublishSchedules(actor),
    can_review: canReviewSchedules(actor),
    is_area_lead: isAreaLead(actor),
    is_employee_view: role === 'employee' && !isAreaLead(actor),
    view_scope: hasRestaurantWideScheduleAccess(actor)
      ? 'restaurant'
      : isAreaLead(actor)
        ? 'zone'
        : 'self',
  };
}

export function buildWeekSummary(params: {
  config: ScheduleConfig;
  displayStatus?: ScheduleHomeStatus;
  employees: Array<Pick<EmployeeListItem, 'id' | 'role'>>;
  schedule: Schedule | null;
  scheduleEntries: ScheduleEntry[];
  weekStart: string;
}): ScheduleWeekSummary {
  const issues = summarizeScheduleIssues({
    config: params.config,
    employees: params.employees,
    entries: params.scheduleEntries,
    weekStart: params.weekStart,
  });

  return {
    has_published_version: Boolean(params.schedule?.published_at),
    label: params.weekStart === getCurrentAndNextWeekStarts().currentWeekStart
      ? 'Semana actual'
      : 'Proxima semana',
    missing_cells: issues.empty_cells,
    needs_review: Boolean(issues.empty_cells || issues.invalid_cells),
    range_label: getWeekRangeLabel(params.weekStart),
    schedule_id: params.schedule?.id ?? null,
    status: params.displayStatus ?? params.schedule?.status ?? 'missing',
    validation_issues: issues.invalid_cells,
    week_end: getWeekEnd(params.weekStart),
    week_start: params.weekStart,
  };
}

function buildEmployeeDayView(
  entry: ScheduleEntry | null | undefined,
  date: string,
): EmployeeScheduleDayView {
  if (!entry) {
    return {
      date,
      day_type: 'unassigned',
      is_published: false,
      shift_text: 'Sin publicar',
      tasks: [],
    };
  }

  if (entry.day_type === 'work') {
    return {
      date,
      day_type: 'work',
      is_published: true,
      shift_text: buildShiftTextFromEntry(entry),
      tasks: [],
    };
  }

  return {
    date,
    day_type: entry.day_type,
    is_published: true,
    shift_text: SPECIAL_DAY_LABEL[entry.day_type],
    tasks: [],
  };
}

export function buildEmployeeWeekView(params: {
  employeeId: string;
  publishedEntries: ScheduleEntry[];
  schedule: Schedule | null;
  weekStart: string;
}): EmployeeScheduleWeekView {
  if (!params.schedule || params.schedule.status !== 'published') {
    return {
      days: getWeekDates(params.weekStart).map((date) =>
        buildEmployeeDayView(null, date),
      ),
      published_at: null,
      range_label: getWeekRangeLabel(params.weekStart),
      schedule_id: params.schedule?.id ?? null,
      status: 'unpublished',
      week_end: getWeekEnd(params.weekStart),
      week_start: params.weekStart,
    };
  }

  return {
    days: getWeekDates(params.weekStart).map((date) => {
      const entry =
        params.publishedEntries.find(
          (candidate) =>
            candidate.employee_id === params.employeeId && candidate.date === date,
        ) ?? null;

      return buildEmployeeDayView(entry, date);
    }),
    published_at: params.schedule.published_at ?? null,
    range_label: getWeekRangeLabel(params.weekStart),
    schedule_id: params.schedule.id,
    status: 'published',
    week_end: getWeekEnd(params.weekStart),
    week_start: params.weekStart,
  };
}
