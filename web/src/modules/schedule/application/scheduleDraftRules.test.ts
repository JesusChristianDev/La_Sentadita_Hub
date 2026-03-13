import assert from 'node:assert/strict';
import test from 'node:test';

import type { ScheduleConfig, ScheduleEntry } from '../domain/scheduleTypes';
import {
  buildEmptyDraftCellValue,
  getPublishValidationError,
  hasMeaningfulDraftEntryChanges,
  parseDraftCellUpdates,
  resolveScheduleStatusAfterDraftSave,
  sanitizeDraftEntryPayload,
} from './scheduleDraftRules';

const CONFIG: ScheduleConfig = {
  min_shift_duration_minutes: 240,
  min_split_break_minutes: 180,
  timezone: 'Europe/Madrid',
};

function makeEntry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    date: '2026-03-09',
    day_type: 'work',
    employee_id: 'emp-1',
    end_time: '18:00',
    id: 'entry-1',
    schedule_id: 'schedule-1',
    shift_template_id: null,
    source: 'manual',
    split_end_time: null,
    split_start_time: null,
    start_time: '09:00',
    version: 1,
    zone_id: 'zone-1',
    ...overrides,
  };
}

test('buildEmptyDraftCellValue creates an unscheduled cell without times', () => {
  assert.deepEqual(buildEmptyDraftCellValue(), {
    day_type: 'unscheduled',
    end_time: null,
    split_end_time: null,
    split_start_time: null,
    start_time: null,
  });
});

test('parseDraftCellUpdates keeps empty cells as unscheduled instead of failing', () => {
  assert.deepEqual(
    parseDraftCellUpdates({
      config: CONFIG,
      rawValue: '',
      zoneId: 'zone-1',
    }),
    buildEmptyDraftCellValue(),
  );
});

test('parseDraftCellUpdates assigns zone only for work shifts', () => {
  const work = parseDraftCellUpdates({
    config: CONFIG,
    rawValue: '9-18',
    zoneId: 'zone-1',
  });
  const rest = parseDraftCellUpdates({
    config: CONFIG,
    rawValue: 'Libre',
    zoneId: 'zone-1',
  });

  assert.equal(work.zone_id, 'zone-1');
  assert.equal(rest.zone_id, undefined);
});

test('sanitizeDraftEntryPayload clears times and zone for non-work days', () => {
  const existing = makeEntry();
  const payload = sanitizeDraftEntryPayload(existing, { day_type: 'vacation' }, 'zone-1');

  assert.deepEqual(payload, {
    day_type: 'vacation',
    end_time: null,
    shift_template_id: null,
    source: 'manual',
    split_end_time: null,
    split_start_time: null,
    start_time: null,
    zone_id: null,
  });
});

test('sanitizeDraftEntryPayload rejects incomplete split shifts', () => {
  assert.throws(
    () =>
      sanitizeDraftEntryPayload(
        null,
        {
          day_type: 'work',
          end_time: '13:00',
          split_start_time: '17:00',
          start_time: '09:00',
        },
        'zone-1',
      ),
    /turno partido necesita ambas horas/i,
  );
});

test('hasMeaningfulDraftEntryChanges ignores identical payloads', () => {
  const existing = makeEntry();
  const payload = sanitizeDraftEntryPayload(existing, {}, 'zone-1');

  assert.equal(hasMeaningfulDraftEntryChanges(existing, payload), false);
});

test('resolveScheduleStatusAfterDraftSave sends published weeks back to draft when changed', () => {
  assert.equal(resolveScheduleStatusAfterDraftSave('published', true), 'draft');
  assert.equal(resolveScheduleStatusAfterDraftSave('published', false), 'published');
  assert.equal(resolveScheduleStatusAfterDraftSave('draft', true), 'draft');
});

test('getPublishValidationError prioritizes no-changes over generic invalid publication', () => {
  assert.equal(
    getPublishValidationError({
      can_publish: true,
      has_changes: false,
    }),
    'No hay cambios pendientes respecto a la ultima publicacion.',
  );
  assert.equal(
    getPublishValidationError({
      can_publish: false,
      has_changes: true,
    }),
    'El horario tiene celdas vacias o errores de validacion.',
  );
  assert.equal(
    getPublishValidationError({
      can_publish: true,
      has_changes: true,
    }),
    null,
  );
});
