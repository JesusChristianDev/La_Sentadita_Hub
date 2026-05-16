import type { EmployeeListItem } from '@/modules/employees';

import type {
  Schedule,
  ScheduleEntry,
  ScheduleIssueSummary,
  SchedulePublicationState,
  ScheduleSaveCellResult,
  ScheduleWithEntries,
} from '../domain/scheduleTypes';
import {
  hasMeaningfulDraftEntryChanges,
  parseDraftCellUpdates,
  resolveScheduleStatusAfterDraftSave,
  sanitizeDraftEntryPayload,
} from './scheduleDraftRules';

type ScopeEmployees = (employees: EmployeeListItem[]) => EmployeeListItem[];

export type PersistDraftEntryResult = {
  changed: boolean;
  entry: ScheduleEntry;
};

type ScheduleDraftServiceDeps = {
  buildIssueSummaryForSchedule: (
    restaurantId: string,
    weekStart: string,
    entries: ScheduleEntry[],
    employees: EmployeeListItem[],
  ) => Promise<ScheduleIssueSummary>;
  buildPublicationStateForSchedule: (params: {
    employees: EmployeeListItem[];
    issues: ScheduleIssueSummary;
    schedule: ScheduleWithEntries;
  }) => Promise<SchedulePublicationState>;
  getEntryByNaturalKey: (
    scheduleId: string,
    employeeId: string,
    date: string,
  ) => Promise<ScheduleEntry | null>;
  getScheduleConfig: (restaurantId: string) => Promise<{
    max_weekly_hours_employee: number | null;
    min_shift_duration_minutes: number;
    min_split_break_minutes: number;
    timezone: string;
  }>;
  listEmployees: (
    restaurantId: string,
    status?: 'active' | 'inactive' | 'all',
  ) => Promise<EmployeeListItem[]>;
  listScheduleEntries: (scheduleId: string) => Promise<ScheduleEntry[]>;
  markScheduleAsDraft: (scheduleId: string) => Promise<Schedule>;
  persistEntryAtomic: (params: {
    actorUserId: string | null;
    changeSource: 'manual' | 'auto';
    date: string;
    employeeId: string;
    existing: ScheduleEntry | null;
    payload: Partial<ScheduleEntry>;
    scheduleId: string;
  }) => Promise<ScheduleEntry>;
};

function identityScopeEmployees(employees: EmployeeListItem[]): EmployeeListItem[] {
  return employees;
}

export function createScheduleDraftService(deps: ScheduleDraftServiceDeps) {
  async function persistDraftEntry(params: {
    actorUserId: string;
    date: string;
    employeeId: string;
    scheduleId: string;
    updates: Partial<ScheduleEntry>;
    zoneId: string | null;
  }): Promise<PersistDraftEntryResult> {
    const existing = await deps.getEntryByNaturalKey(
      params.scheduleId,
      params.employeeId,
      params.date,
    );
    const payload = sanitizeDraftEntryPayload(existing, params.updates, params.zoneId);

    if (!hasMeaningfulDraftEntryChanges(existing, payload)) {
      return {
        changed: false,
        entry: existing as ScheduleEntry,
      };
    }

    const entry = await deps.persistEntryAtomic({
      actorUserId: params.actorUserId,
      changeSource: 'manual',
      date: params.date,
      employeeId: params.employeeId,
      existing,
      payload,
      scheduleId: params.scheduleId,
    });

    return {
      changed: true,
      entry,
    };
  }

  async function saveCellDraft(params: {
    actorUserId: string;
    date: string;
    employee: Pick<EmployeeListItem, 'id' | 'zone_id'>;
    rawValue: string;
    schedule: Schedule;
    scopeEmployees?: ScopeEmployees;
  }): Promise<ScheduleSaveCellResult> {
    const updates = parseDraftCellUpdates({
      config: params.rawValue.trim()
        ? await deps.getScheduleConfig(params.schedule.restaurant_id)
        : undefined,
      rawValue: params.rawValue,
      zoneId: params.employee.zone_id,
    });

    const persisted = await persistDraftEntry({
      actorUserId: params.actorUserId,
      date: params.date,
      employeeId: params.employee.id,
      scheduleId: params.schedule.id,
      updates,
      zoneId: params.employee.zone_id,
    });

    const scheduleStatus = resolveScheduleStatusAfterDraftSave(
      params.schedule.status,
      persisted.changed,
    );
    if (scheduleStatus !== params.schedule.status) {
      await deps.markScheduleAsDraft(params.schedule.id);
    }

    const employees = (params.scopeEmployees ?? identityScopeEmployees)(
      await deps.listEmployees(params.schedule.restaurant_id, 'active'),
    );
    const entries = await deps.listScheduleEntries(params.schedule.id);
    const issues = await deps.buildIssueSummaryForSchedule(
      params.schedule.restaurant_id,
      params.schedule.week_start,
      entries,
      employees,
    );
    const publication_state = await deps.buildPublicationStateForSchedule({
      employees,
      issues,
      schedule: {
        ...params.schedule,
        schedule_entries: entries,
        status: scheduleStatus,
      },
    });

    return {
      entry: persisted.entry,
      issues,
      publication_state,
      schedule_status: scheduleStatus,
    };
  }

  async function upsertCell(params: {
    actorUserId: string;
    date: string;
    employeeId: string;
    scheduleId: string;
    updates: Partial<ScheduleEntry>;
    zoneId: string | null;
  }): Promise<PersistDraftEntryResult> {
    return persistDraftEntry(params);
  }

  return {
    persistDraftEntry,
    saveCellDraft,
    upsertCell,
  };
}
