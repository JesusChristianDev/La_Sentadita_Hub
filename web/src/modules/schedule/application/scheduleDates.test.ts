import assert from 'node:assert/strict';
import test from 'node:test';

import { format } from 'date-fns';

import { getWeekDates, getWeekEnd, getWeekRangeLabel } from './scheduleDates';
import { parseScheduleLocalDate } from './scheduleLocalDate';

function withTimezone<T>(timezone: string, run: () => T): T {
  const previousTimezone = process.env.TZ;
  process.env.TZ = timezone;

  try {
    return run();
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
}

test('parseScheduleLocalDate keeps the intended calendar day in America/Los_Angeles', () => {
  withTimezone('America/Los_Angeles', () => {
    const parsed = parseScheduleLocalDate('2026-03-09');
    const bare = new Date('2026-03-09');

    assert.equal(format(parsed, 'yyyy-MM-dd'), '2026-03-09');
    assert.equal(format(bare, 'yyyy-MM-dd'), '2026-03-08');
  });
});

test('getWeekDates stays aligned across monitored DST weeks', () => {
  const cases = [
    {
      expectedDates: [
        '2026-03-02',
        '2026-03-03',
        '2026-03-04',
        '2026-03-05',
        '2026-03-06',
        '2026-03-07',
        '2026-03-08',
      ],
      timezone: 'America/Los_Angeles',
      weekStart: '2026-03-02',
    },
    {
      expectedDates: [
        '2026-03-23',
        '2026-03-24',
        '2026-03-25',
        '2026-03-26',
        '2026-03-27',
        '2026-03-28',
        '2026-03-29',
      ],
      timezone: 'Europe/Madrid',
      weekStart: '2026-03-23',
    },
  ];

  cases.forEach(({ expectedDates, timezone, weekStart }) => {
    withTimezone(timezone, () => {
      assert.deepEqual(getWeekDates(weekStart), expectedDates);
      assert.equal(getWeekEnd(weekStart), expectedDates[6]);
      assert.match(getWeekRangeLabel(weekStart), /^\d{1,2} \w+ - \d{1,2} \w+$/);
    });
  });
});
