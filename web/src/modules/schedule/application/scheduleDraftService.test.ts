import assert from 'node:assert/strict';
import test from 'node:test';

import type { EmployeeListItem } from '@/modules/employees';

import type {
  Schedule,
  ScheduleEntry,
  ScheduleIssueSummary,
  SchedulePublicationState,
} from '../domain/scheduleTypes';
import { createScheduleDraftService } from './scheduleDraftService';

function makeEmployee(overrides: Partial<EmployeeListItem> = {}): EmployeeListItem {
  return {
    avatar_path: null,
    employee_code: 1,
    full_name: 'Paula',
    id: 'emp-1',
    is_area_lead: false,
    restaurant_id: 'restaurant-1',
    role: 'employee',
    zone_id: 'zone-1',
    ...overrides,
  };
}

function makeEntry(
  overrides: Partial<ScheduleEntry> & Pick<ScheduleEntry, 'date' | 'employee_id' | 'id'>,
): ScheduleEntry {
  const { date, employee_id, id, ...rest } = overrides;

  return {
    date,
    day_type: 'work',
    employee_id,
    end_time: '18:00',
    id,
    schedule_id: 'schedule-1',
    shift_template_id: null,
    source: 'manual',
    split_end_time: null,
    split_start_time: null,
    start_time: '09:00',
    version: 1,
    zone_id: 'zone-1',
    ...rest,
  };
}

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    created_by: 'manager-1',
    id: 'schedule-1',
    restaurant_id: 'restaurant-1',
    status: 'draft',
    week_start: '2026-03-09',
    ...overrides,
  };
}

function makeIssueSummary(): ScheduleIssueSummary {
  return {
    empty_cells: 0,
    empty_keys: [],
    invalid_cells: 0,
    invalid_keys: [],
  };
}

function makePublicationState(): SchedulePublicationState {
  return {
    affected_employee_count: 1,
    can_publish: true,
    has_changes: true,
    publication_kind: 'republish',
  };
}

test('persistDraftEntry returns unchanged entry when payload is effectively identical', async () => {
  const existing = makeEntry({
    date: '2026-03-09',
    employee_id: 'emp-1',
    id: 'entry-1',
  });
  let updated = false;
  let created = false;
  let logged = false;

  const service = createScheduleDraftService({
    buildIssueSummaryForSchedule: async () => makeIssueSummary(),
    buildPublicationStateForSchedule: async () => makePublicationState(),
    createScheduleEntry: async () => {
      created = true;
      return existing;
    },
    getEntryByNaturalKey: async () => existing,
    getScheduleConfig: async () => ({
      min_shift_duration_minutes: 240,
      min_split_break_minutes: 180,
      timezone: 'Europe/Madrid',
    }),
    insertScheduleEntryLog: async () => {
      logged = true;
    },
    listEmployees: async () => [makeEmployee()],
    listScheduleEntries: async () => [existing],
    markScheduleAsDraft: async () => makeSchedule(),
    updateEntry: async () => {
      updated = true;
      return existing;
    },
  });

  const result = await service.persistDraftEntry({
    actorUserId: 'manager-1',
    date: '2026-03-09',
    employeeId: 'emp-1',
    scheduleId: 'schedule-1',
    updates: {},
    zoneId: 'zone-1',
  });

  assert.equal(result.changed, false);
  assert.equal(result.entry, existing);
  assert.equal(updated, false);
  assert.equal(created, false);
  assert.equal(logged, false);
});

test('persistDraftEntry creates a new entry and audit log when the cell does not exist', async () => {
  const createdEntry = makeEntry({
    date: '2026-03-09',
    employee_id: 'emp-1',
    id: 'entry-new',
  });
  const logCalls: Array<{ previous: Partial<ScheduleEntry> | null; scheduleEntryId: string }> = [];

  const service = createScheduleDraftService({
    buildIssueSummaryForSchedule: async () => makeIssueSummary(),
    buildPublicationStateForSchedule: async () => makePublicationState(),
    createScheduleEntry: async () => createdEntry,
    getEntryByNaturalKey: async () => null,
    getScheduleConfig: async () => ({
      min_shift_duration_minutes: 240,
      min_split_break_minutes: 180,
      timezone: 'Europe/Madrid',
    }),
    insertScheduleEntryLog: async (params) => {
      logCalls.push({
        previous: params.previous,
        scheduleEntryId: params.scheduleEntryId,
      });
    },
    listEmployees: async () => [makeEmployee()],
    listScheduleEntries: async () => [createdEntry],
    markScheduleAsDraft: async () => makeSchedule(),
    updateEntry: async () => createdEntry,
  });

  const result = await service.persistDraftEntry({
    actorUserId: 'manager-1',
    date: '2026-03-09',
    employeeId: 'emp-1',
    scheduleId: 'schedule-1',
    updates: {
      day_type: 'work',
      end_time: '18:00',
      start_time: '09:00',
    },
    zoneId: 'zone-1',
  });

  assert.equal(result.changed, true);
  assert.equal(result.entry.id, 'entry-new');
  assert.deepEqual(logCalls, [
    {
      previous: null,
      scheduleEntryId: 'entry-new',
    },
  ]);
});

test('saveCellDraft republishes to draft state and recalculates issue summary', async () => {
  const employees = [makeEmployee(), makeEmployee({ id: 'emp-2', zone_id: 'zone-2' })];
  const refreshedEntries = [
    makeEntry({
      date: '2026-03-09',
      employee_id: 'emp-1',
      end_time: '19:00',
      id: 'entry-1',
      start_time: '10:00',
    }),
  ];
  const scopedEmployeeCalls: string[][] = [];
  let markedDraft = false;

  const service = createScheduleDraftService({
    buildIssueSummaryForSchedule: async (
      _restaurantId,
      _weekStart,
      _entries,
      issueEmployees,
    ) => {
      scopedEmployeeCalls.push(issueEmployees.map((employee) => employee.id));
      return makeIssueSummary();
    },
    buildPublicationStateForSchedule: async () => makePublicationState(),
    createScheduleEntry: async () => refreshedEntries[0],
    getEntryByNaturalKey: async () =>
      makeEntry({
        date: '2026-03-09',
        employee_id: 'emp-1',
        id: 'entry-1',
      }),
    getScheduleConfig: async () => ({
      min_shift_duration_minutes: 240,
      min_split_break_minutes: 180,
      timezone: 'Europe/Madrid',
    }),
    insertScheduleEntryLog: async () => undefined,
    listEmployees: async () => employees,
    listScheduleEntries: async () => refreshedEntries,
    markScheduleAsDraft: async () => {
      markedDraft = true;
      return makeSchedule({ status: 'draft' });
    },
    updateEntry: async () => refreshedEntries[0],
  });

  const result = await service.saveCellDraft({
    actorUserId: 'manager-1',
    date: '2026-03-09',
    employee: makeEmployee(),
    rawValue: '10-19',
    schedule: makeSchedule({ published_at: '2026-03-10T10:00:00.000Z', status: 'published' }),
    scopeEmployees: (listedEmployees) =>
      listedEmployees.filter((employee) => employee.zone_id === 'zone-1'),
  });

  assert.equal(markedDraft, true);
  assert.equal(result.schedule_status, 'draft');
  assert.deepEqual(scopedEmployeeCalls, [['emp-1']]);
  assert.equal(result.entry.end_time, '19:00');
});

test('saveCellDraft allows clearing a cell without loading schedule config', async () => {
  let configCalls = 0;

  const service = createScheduleDraftService({
    buildIssueSummaryForSchedule: async () => makeIssueSummary(),
    buildPublicationStateForSchedule: async () => makePublicationState(),
    createScheduleEntry: async () =>
      makeEntry({
        date: '2026-03-09',
        day_type: 'unscheduled',
        employee_id: 'emp-1',
        end_time: null,
        id: 'entry-cleared',
        start_time: null,
        zone_id: null,
      }),
    getEntryByNaturalKey: async () => null,
    getScheduleConfig: async () => {
      configCalls += 1;
      return {
        min_shift_duration_minutes: 240,
        min_split_break_minutes: 180,
        timezone: 'Europe/Madrid',
      };
    },
    insertScheduleEntryLog: async () => undefined,
    listEmployees: async () => [makeEmployee()],
    listScheduleEntries: async () => [],
    markScheduleAsDraft: async () => makeSchedule(),
    updateEntry: async () =>
      makeEntry({
        date: '2026-03-09',
        day_type: 'unscheduled',
        employee_id: 'emp-1',
        end_time: null,
        id: 'entry-cleared',
        start_time: null,
        zone_id: null,
      }),
  });

  await service.saveCellDraft({
    actorUserId: 'manager-1',
    date: '2026-03-09',
    employee: makeEmployee(),
    rawValue: '',
    schedule: makeSchedule(),
  });

  assert.equal(configCalls, 0);
});
