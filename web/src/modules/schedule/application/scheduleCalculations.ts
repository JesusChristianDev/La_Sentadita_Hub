import { requiresScheduledCells } from '../domain/scheduleRoleRules';
import type {
  Schedule,
  ScheduleConfig,
  ScheduleEntry,
  ScheduleEntryLog,
  ScheduleIssueSummary,
  SchedulePublicationState,
  SchedulePublishReview,
} from '../domain/scheduleTypes';
import { getWeekDates, getWeekEnd, getWeekRangeLabel } from './scheduleDates';
import { buildShiftTextFromEntry, validateShiftText } from './shiftValidation';

type SchedulableRole = Parameters<typeof requiresScheduledCells>[0];

export type ScheduleIssueEmployee = {
  id: string;
  role: SchedulableRole;
};

export type SchedulePublicationEmployee = {
  full_name: string | null;
  id: string;
};

export function summarizeScheduleIssues(params: {
  config: ScheduleConfig;
  employees: ScheduleIssueEmployee[];
  entries: ScheduleEntry[];
  weekStart: string;
}): ScheduleIssueSummary {
  const expectedKeys = new Set<string>();
  const invalidKeys = new Set<string>();
  const presentKeys = new Set<string>();
  const requiredEmployeeIds = new Set<string>();

  for (const employee of params.employees) {
    if (!requiresScheduledCells(employee.role)) continue;

    requiredEmployeeIds.add(employee.id);
    for (const date of getWeekDates(params.weekStart)) {
      expectedKeys.add(`${employee.id}::${date}`);
    }
  }

  for (const entry of params.entries) {
    const key = `${entry.employee_id}::${entry.date}`;
    const isRequiredEmployee = requiredEmployeeIds.has(entry.employee_id);

    if (entry.day_type === 'unscheduled' && isRequiredEmployee) {
      continue;
    }

    presentKeys.add(key);

    if (entry.day_type === 'work') {
      if (!entry.start_time || !entry.end_time) {
        invalidKeys.add(key);
        continue;
      }

      const shiftText = buildShiftTextFromEntry(entry);
      const validation = validateShiftText(shiftText, params.config);
      if (!validation.ok) {
        invalidKeys.add(key);
      }
    }
  }

  const emptyKeys = Array.from(expectedKeys).filter((key) => !presentKeys.has(key));

  return {
    empty_cells: emptyKeys.length,
    empty_keys: emptyKeys,
    invalid_cells: invalidKeys.size,
    invalid_keys: Array.from(invalidKeys),
  };
}

function serializeEntry(entry: ScheduleEntry | null | undefined): string {
  if (!entry) return 'empty';

  return [
    entry.day_type,
    entry.start_time ?? '',
    entry.end_time ?? '',
    entry.split_start_time ?? '',
    entry.split_end_time ?? '',
    entry.zone_id ?? '',
  ].join('|');
}

function normalizeEntryFromLog(
  entry: ScheduleEntry,
  log: ScheduleEntryLog,
): ScheduleEntry | null {
  if (!log.new_day_type) return null;

  return {
    ...entry,
    day_type: log.new_day_type,
    end_time: log.new_end_time ?? undefined,
    shift_template_id: log.new_shift_template_id ?? undefined,
    split_end_time: log.new_split_end_time ?? undefined,
    split_start_time: log.new_split_start_time ?? undefined,
    start_time: log.new_start_time ?? undefined,
    zone_id: log.new_zone_id ?? undefined,
  };
}

export function buildPublishedSnapshotEntries(params: {
  entries: ScheduleEntry[];
  logs: ScheduleEntryLog[];
  publishedAt: string | null | undefined;
}): ScheduleEntry[] {
  if (!params.publishedAt) return [];
  if (params.logs.length === 0) return params.entries;

  const latestLogByEntryId = new Map<string, ScheduleEntryLog>();

  for (const log of params.logs) {
    if (!latestLogByEntryId.has(log.schedule_entry_id)) {
      latestLogByEntryId.set(log.schedule_entry_id, log);
    }
  }

  const publishedEntries: ScheduleEntry[] = [];

  for (const entry of params.entries) {
    const log = latestLogByEntryId.get(entry.id);
    if (!log) continue;

    const normalized = normalizeEntryFromLog(entry, log);
    if (normalized) {
      publishedEntries.push(normalized);
    }
  }

  return publishedEntries;
}

export function buildPublishReview(params: {
  currentEntries: ScheduleEntry[];
  employees: SchedulePublicationEmployee[];
  issues: ScheduleIssueSummary;
  publishedEntries: ScheduleEntry[];
  schedule: Schedule;
}): SchedulePublishReview {
  const publicationKind = params.schedule.published_at ? 'republish' : 'initial';
  const affectedEmployees =
    publicationKind === 'initial'
      ? params.employees
      : params.employees.filter((employee) => {
          for (const date of getWeekDates(params.schedule.week_start)) {
            const current = params.currentEntries.find(
              (entry) => entry.employee_id === employee.id && entry.date === date,
            );
            const published = params.publishedEntries.find(
              (entry) => entry.employee_id === employee.id && entry.date === date,
            );

            if (serializeEntry(current) !== serializeEntry(published)) {
              return true;
            }
          }

          return false;
        });

  return {
    affected_employee_ids: affectedEmployees.map((employee) => employee.id),
    affected_employee_names: affectedEmployees.map(
      (employee) => employee.full_name || '(sin nombre)',
    ),
    affected_employees: affectedEmployees.map((employee) => ({
      full_name: employee.full_name || '(sin nombre)',
      id: employee.id,
    })),
    can_publish: params.issues.empty_cells === 0 && params.issues.invalid_cells === 0,
    has_changes:
      publicationKind === 'initial'
        ? params.currentEntries.length > 0
        : affectedEmployees.length > 0,
    missing_cells: params.issues.empty_cells,
    publication_kind: publicationKind,
    range_label: getWeekRangeLabel(params.schedule.week_start),
    schedule_id: params.schedule.id,
    validation_issues: params.issues.invalid_cells,
    week_end: getWeekEnd(params.schedule.week_start),
    week_start: params.schedule.week_start,
  };
}

export function buildPublicationState(
  review: Pick<
    SchedulePublishReview,
    'affected_employee_ids' | 'can_publish' | 'has_changes' | 'publication_kind'
  >,
): SchedulePublicationState {
  return {
    affected_employee_count: review.affected_employee_ids.length,
    can_publish: review.can_publish && review.has_changes,
    has_changes: review.has_changes,
    publication_kind: review.publication_kind,
  };
}
