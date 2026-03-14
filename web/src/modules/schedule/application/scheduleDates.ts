import { addDays, addWeeks, format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

import { parseScheduleLocalDate } from './scheduleLocalDate';

function toIsoDate(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

export function getWeekStart(reference = new Date()): Date {
  return startOfWeek(reference, { weekStartsOn: 1 });
}

export function getCurrentAndNextWeekStarts(reference = new Date()) {
  const currentWeek = getWeekStart(reference);
  return {
    currentWeekStart: toIsoDate(currentWeek),
    nextWeekStart: toIsoDate(addWeeks(currentWeek, 1)),
  };
}

export function getWeekDates(weekStart: string): string[] {
  const start = parseScheduleLocalDate(weekStart);
  return Array.from({ length: 7 }).map((_, index) => toIsoDate(addDays(start, index)));
}

export function getWeekEnd(weekStart: string): string {
  return getWeekDates(weekStart)[6];
}

export function getWeekRangeLabel(weekStart: string): string {
  const start = parseScheduleLocalDate(weekStart);
  const end = addDays(start, 6);
  return `${format(start, "d MMM", { locale: es })} - ${format(end, "d MMM", { locale: es })}`;
}
