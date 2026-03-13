import assert from 'node:assert/strict';
import test from 'node:test';

import type { ScheduleEntry } from '../domain/scheduleTypes';
import {
  buildShiftTextFromEntry,
  parseScheduleCellInput,
  validateShiftText,
} from './shiftValidation';

const CONFIG = {
  min_shift_duration_minutes: 240,
  min_split_break_minutes: 180,
  timezone: 'Europe/Madrid',
} as const;

test('validateShiftText normalizes a continuous shift', () => {
  const result = validateShiftText('9-18', CONFIG);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.shift, {
    end_time: '18:00',
    split_end_time: null,
    split_start_time: null,
    start_time: '09:00',
  });
});

test('validateShiftText accepts split shifts with enough break', () => {
  const result = validateShiftText('9-13 17-21', CONFIG);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.shift, {
    end_time: '13:00',
    split_end_time: '21:00',
    split_start_time: '17:00',
    start_time: '09:00',
  });
});

test('validateShiftText rejects split shifts with a short break', () => {
  const result = validateShiftText('9-13 15-19', CONFIG);

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.match(result.error, /descanso minimo/i);
});

test('parseScheduleCellInput allows empty cells when explicitly enabled', () => {
  const result = parseScheduleCellInput('', CONFIG, { allowEmpty: true });

  assert.deepEqual(result, {
    ok: true,
    value: {
      day_type: 'unscheduled',
      end_time: null,
      split_end_time: null,
      split_start_time: null,
      start_time: null,
    },
  });
});

test('parseScheduleCellInput maps special aliases to canonical day types', () => {
  const rest = parseScheduleCellInput('Libre', CONFIG);
  const vacation = parseScheduleCellInput('V', CONFIG);

  assert.deepEqual(rest, {
    ok: true,
    value: {
      day_type: 'rest',
      end_time: null,
      split_end_time: null,
      split_start_time: null,
      start_time: null,
    },
  });
  assert.deepEqual(vacation, {
    ok: true,
    value: {
      day_type: 'vacation',
      end_time: null,
      split_end_time: null,
      split_start_time: null,
      start_time: null,
    },
  });
});

test('buildShiftTextFromEntry rebuilds split shifts for validation and display', () => {
  const entry: ScheduleEntry = {
    date: '2026-03-09',
    day_type: 'work',
    employee_id: 'emp-1',
    end_time: '13:00:00',
    id: 'entry-1',
    schedule_id: 'schedule-1',
    source: 'manual',
    split_end_time: '21:00:00',
    split_start_time: '17:00:00',
    start_time: '09:00:00',
    version: 1,
    zone_id: 'zone-1',
  };

  assert.equal(buildShiftTextFromEntry(entry), '09:00-13:00 17:00-21:00');
});
