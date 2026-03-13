import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  Schedule,
  ScheduleConfig,
  ScheduleEntry,
  ScheduleEntryLog,
} from '../domain/scheduleTypes';
import {
  buildPublicationState,
  buildPublishedSnapshotEntries,
  buildPublishReview,
  type ScheduleIssueEmployee,
  type SchedulePublicationEmployee,
  summarizeScheduleIssues,
} from './scheduleCalculations';

const CONFIG: ScheduleConfig = {
  min_shift_duration_minutes: 240,
  min_split_break_minutes: 180,
  timezone: 'Europe/Madrid',
};

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
    source: 'manual',
    split_end_time: null,
    split_start_time: null,
    start_time: '09:00',
    version: 1,
    zone_id: 'zone-1',
    ...rest,
  };
}

test('summarizeScheduleIssues treats unscheduled cells as pending for required roles only', () => {
  const employees: ScheduleIssueEmployee[] = [
    { id: 'emp-1', role: 'employee' },
    { id: 'mgr-1', role: 'manager' },
  ];
  const entries: ScheduleEntry[] = [
    makeEntry({
      date: '2026-03-09',
      day_type: 'unscheduled',
      employee_id: 'emp-1',
      end_time: null,
      id: 'entry-1',
      start_time: null,
      zone_id: null,
    }),
  ];

  const issues = summarizeScheduleIssues({
    config: CONFIG,
    employees,
    entries,
    weekStart: '2026-03-09',
  });

  assert.equal(issues.empty_cells, 7);
  assert.equal(issues.invalid_cells, 0);
  assert.ok(issues.empty_keys.every((key) => key.startsWith('emp-1::')));
});

test('buildPublishedSnapshotEntries rebuilds the last published snapshot from logs', () => {
  const entries: ScheduleEntry[] = [
    makeEntry({
      date: '2026-03-09',
      employee_id: 'emp-1',
      end_time: '19:00',
      id: 'entry-1',
      start_time: '10:00',
    }),
  ];
  const logs: ScheduleEntryLog[] = [
    {
      change_source: 'manual',
      changed_at: '2026-03-13T12:00:00.000Z',
      changed_by: 'manager-1',
      id: 'log-1',
      new_day_type: 'work',
      new_end_time: '18:00',
      new_shift_template_id: null,
      new_split_end_time: null,
      new_split_start_time: null,
      new_start_time: '09:00',
      new_zone_id: 'zone-1',
      previous_day_type: 'work',
      previous_end_time: '17:00',
      previous_shift_template_id: null,
      previous_split_end_time: null,
      previous_split_start_time: null,
      previous_start_time: '08:00',
      previous_zone_id: 'zone-1',
      schedule_entry_id: 'entry-1',
    },
  ];

  const snapshot = buildPublishedSnapshotEntries({
    entries,
    logs,
    publishedAt: '2026-03-13T12:00:00.000Z',
  });

  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].start_time, '09:00');
  assert.equal(snapshot[0].end_time, '18:00');
});

test('buildPublishReview only flags changed employees during republication', () => {
  const employees: SchedulePublicationEmployee[] = [
    { full_name: 'Paula', id: 'emp-1' },
    { full_name: 'Nico', id: 'emp-2' },
  ];
  const schedule: Schedule = {
    created_by: 'manager-1',
    id: 'schedule-1',
    published_at: '2026-03-10T10:00:00.000Z',
    restaurant_id: 'restaurant-1',
    status: 'draft',
    week_start: '2026-03-09',
  };
  const currentEntries: ScheduleEntry[] = [
    makeEntry({
      date: '2026-03-09',
      employee_id: 'emp-1',
      end_time: '19:00',
      id: 'entry-1',
      start_time: '10:00',
    }),
    makeEntry({
      date: '2026-03-09',
      employee_id: 'emp-2',
      id: 'entry-2',
    }),
  ];
  const publishedEntries: ScheduleEntry[] = [
    makeEntry({
      date: '2026-03-09',
      employee_id: 'emp-1',
      end_time: '18:00',
      id: 'entry-1',
      start_time: '09:00',
    }),
    makeEntry({
      date: '2026-03-09',
      employee_id: 'emp-2',
      id: 'entry-2',
    }),
  ];

  const review = buildPublishReview({
    currentEntries,
    employees,
    issues: {
      empty_cells: 0,
      empty_keys: [],
      invalid_cells: 0,
      invalid_keys: [],
    },
    publishedEntries,
    schedule,
  });

  assert.equal(review.publication_kind, 'republish');
  assert.equal(review.has_changes, true);
  assert.deepEqual(review.affected_employee_ids, ['emp-1']);
  assert.equal(review.can_publish, true);
});

test('buildPublicationState disables publishing when there are no real changes', () => {
  const state = buildPublicationState({
    affected_employee_ids: [],
    can_publish: true,
    has_changes: false,
    publication_kind: 'republish',
  });

  assert.deepEqual(state, {
    affected_employee_count: 0,
    can_publish: false,
    has_changes: false,
    publication_kind: 'republish',
  });
});
