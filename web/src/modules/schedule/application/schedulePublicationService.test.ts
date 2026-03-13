import assert from 'node:assert/strict';
import test from 'node:test';

import type { EmployeeListItem } from '@/modules/employees';

import type {
  Schedule,
  ScheduleEntry,
  ScheduleIssueSummary,
  ScheduleWithEntries,
} from '../domain/scheduleTypes';
import { createSchedulePublicationService } from './schedulePublicationService';

function makeEmployee(overrides: Partial<EmployeeListItem>): EmployeeListItem {
  return {
    avatar_path: null,
    employee_code: 1,
    full_name: 'Empleado',
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

function makeSchedule(overrides: Partial<ScheduleWithEntries> = {}): ScheduleWithEntries {
  return {
    created_by: 'manager-1',
    id: 'schedule-1',
    restaurant_id: 'restaurant-1',
    schedule_entries: [],
    status: 'draft',
    week_start: '2026-03-09',
    ...overrides,
  };
}

test('loadPublishReview uses repository deps and scoped employees', async () => {
  const employees = [
    makeEmployee({ full_name: 'Paula', id: 'emp-1' }),
    makeEmployee({ full_name: 'Nico', id: 'emp-2', zone_id: 'zone-2' }),
  ];
  const schedule = makeSchedule({
    published_at: '2026-03-10T09:00:00.000Z',
    schedule_entries: [
      makeEntry({
        date: '2026-03-09',
        employee_id: 'emp-1',
        end_time: '19:00',
        id: 'entry-1',
        start_time: '10:00',
      }),
    ],
  });
  const capturedRestaurants: string[] = [];
  const capturedIssueEmployees: string[][] = [];

  const service = createSchedulePublicationService({
    buildIssueSummaryForSchedule: async (
      _restaurantId: string,
      _weekStart: string,
      _entries: ScheduleEntry[],
      issueEmployees: EmployeeListItem[],
    ): Promise<ScheduleIssueSummary> => {
      capturedIssueEmployees.push(issueEmployees.map((employee) => employee.id));
      return {
        empty_cells: 0,
        empty_keys: [],
        invalid_cells: 0,
        invalid_keys: [],
      };
    },
    getPublishedEntriesForSchedule: async () => [
      makeEntry({
        date: '2026-03-09',
        employee_id: 'emp-1',
        end_time: '18:00',
        id: 'entry-1',
        start_time: '09:00',
      }),
    ],
    listEmployees: async (restaurantId: string) => {
      capturedRestaurants.push(restaurantId);
      return employees;
    },
    publishScheduleWeek: async (input) =>
      ({
        ...input.schedule,
        published_at: '2026-03-13T10:00:00.000Z',
        status: 'published',
      }) as Schedule,
  });

  const review = await service.loadPublishReview({
    schedule,
    scopeEmployees: (listedEmployees) =>
      listedEmployees.filter((employee) => employee.zone_id === 'zone-1'),
  });

  assert.deepEqual(capturedRestaurants, ['restaurant-1']);
  assert.deepEqual(capturedIssueEmployees, [['emp-1']]);
  assert.deepEqual(review.affected_employee_ids, ['emp-1']);
});

test('publishSchedule delegates to publishScheduleWeek with affected employees', async () => {
  const schedule = makeSchedule({
    published_at: '2026-03-10T09:00:00.000Z',
    schedule_entries: [
      makeEntry({
        date: '2026-03-09',
        employee_id: 'emp-1',
        end_time: '19:00',
        id: 'entry-1',
        start_time: '10:00',
      }),
    ],
  });
  const publishCalls: Array<{
    actorUserId: string;
    affectedEmployeeIds: string[];
    comment?: string;
    schedule: ScheduleWithEntries;
  }> = [];

  const service = createSchedulePublicationService({
    buildIssueSummaryForSchedule: async () => ({
      empty_cells: 0,
      empty_keys: [],
      invalid_cells: 0,
      invalid_keys: [],
    }),
    getPublishedEntriesForSchedule: async () => [
      makeEntry({
        date: '2026-03-09',
        employee_id: 'emp-1',
        end_time: '18:00',
        id: 'entry-1',
        start_time: '09:00',
      }),
    ],
    listEmployees: async () => [makeEmployee({ full_name: 'Paula', id: 'emp-1' })],
    publishScheduleWeek: async (input) => {
      publishCalls.push(input);
      return {
        ...input.schedule,
        published_at: '2026-03-13T10:00:00.000Z',
        status: 'published',
      };
    },
  });

  const published = await service.publishSchedule({
    actorUserId: 'manager-1',
    comment: 'Listo para equipo',
    schedule,
  });

  assert.equal(publishCalls.length, 1);
  assert.deepEqual(publishCalls[0].affectedEmployeeIds, ['emp-1']);
  assert.equal(publishCalls[0].comment, 'Listo para equipo');
  assert.equal(published.status, 'published');
});

test('publishSchedule fails fast when there are no pending changes', async () => {
  const schedule = makeSchedule({
    published_at: '2026-03-10T09:00:00.000Z',
    schedule_entries: [
      makeEntry({
        date: '2026-03-09',
        employee_id: 'emp-1',
        id: 'entry-1',
      }),
    ],
  });

  const service = createSchedulePublicationService({
    buildIssueSummaryForSchedule: async () => ({
      empty_cells: 0,
      empty_keys: [],
      invalid_cells: 0,
      invalid_keys: [],
    }),
    getPublishedEntriesForSchedule: async () => [
      makeEntry({
        date: '2026-03-09',
        employee_id: 'emp-1',
        id: 'entry-1',
      }),
    ],
    listEmployees: async () => [makeEmployee({ full_name: 'Paula', id: 'emp-1' })],
    publishScheduleWeek: async () => {
      throw new Error('should not publish');
    },
  });

  await assert.rejects(
    () =>
      service.publishSchedule({
        actorUserId: 'manager-1',
        schedule,
      }),
    /PUBLISH_VALIDATION_ERROR: No hay cambios pendientes/i,
  );
});
