'use client';

import { addDays, format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

import { matchesMobileViewport } from '@/shared/responsive';

import type {
  EmployeeScheduleDayView,
  ScheduleEntry,
  ScheduleHomeStatus,
  ScheduleIssueSummary,
} from '../domain/scheduleTypes';
import type { ScheduleDisplayMode } from './scheduleUiModels';

export type NoticeState = {
  message: string;
  tone: 'error' | 'ok' | 'warning';
} | null;

export function toWeekStartIso(value: string): string {
  return format(
    startOfWeek(new Date(`${value}T00:00:00`), { weekStartsOn: 1 }),
    'yyyy-MM-dd',
  );
}

export function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return `${format(start, "d 'de' MMM", { locale: es })} - ${format(end, "d 'de' MMM", {
    locale: es,
  })}`;
}

export function statusLabel(status: ScheduleHomeStatus): string {
  if (status === 'missing') return 'Sin crear';
  if (status === 'published') return 'Publicado';
  return 'Borrador';
}

export function summarizeIssues(issues: ScheduleIssueSummary): string {
  if (!issues.empty_cells && !issues.invalid_cells) return 'Todo listo';

  const parts: string[] = [];
  if (issues.empty_cells) parts.push(`${issues.empty_cells} celdas pendientes`);
  if (issues.invalid_cells) parts.push(`${issues.invalid_cells} errores`);
  return parts.join(' / ');
}

function extractStructuredErrorMessage(rawMessage: string): string | null {
  const messageMatch =
    rawMessage.match(/message:\s*'([^']+)'/i) ??
    rawMessage.match(/message:\s*"([^"]+)"/i) ??
    rawMessage.match(/"message"\s*:\s*"([^"]+)"/i);

  if (messageMatch?.[1]) {
    return messageMatch[1].trim();
  }

  if (rawMessage.includes('23502')) {
    return 'Falta un dato obligatorio para guardar el horario. Revisa la semana e intentalo otra vez.';
  }

  return null;
}

export function sanitizeActionError(error: unknown): string {
  if (!(error instanceof Error)) return 'No se pudo completar la accion.';

  if (error.message === 'Unauthorized') {
    return 'Tu sesion ha expirado. Vuelve a iniciar sesion.';
  }

  const structuredMessage = extractStructuredErrorMessage(error.message);
  if (structuredMessage) return structuredMessage;

  const separator = error.message.indexOf(':');
  if (separator > -1) {
    const prefix = error.message.slice(0, separator);
    if (prefix.toUpperCase() === prefix) {
      return error.message.slice(separator + 1).trim();
    }
  }

  return error.message;
}

export function buildProblemEmployeeIds(issues: ScheduleIssueSummary): Set<string> {
  const ids = new Set<string>();

  [...issues.empty_keys, ...issues.invalid_keys].forEach((key) => {
    const [employeeId] = key.split('::');
    if (employeeId) ids.add(employeeId);
  });

  return ids;
}

export function buildEmployeeHours(entries: ScheduleEntry[], scopeDates?: string[]) {
  const totals = new Map<string, number>();
  const scopedDateSet = scopeDates?.length ? new Set(scopeDates) : null;

  const toMinutes = (value: string) => {
    const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  };

  const diffMinutes = (start: string, end: string) => {
    const raw = toMinutes(end) - toMinutes(start);
    return raw <= 0 ? raw + 24 * 60 : raw;
  };

  entries.forEach((entry) => {
    if (scopedDateSet && !scopedDateSet.has(entry.date)) return;
    if (entry.day_type !== 'work' || !entry.start_time || !entry.end_time) return;

    const primary = diffMinutes(entry.start_time, entry.end_time);
    const split =
      entry.split_start_time && entry.split_end_time
        ? diffMinutes(entry.split_start_time, entry.split_end_time)
        : 0;

    totals.set(
      entry.employee_id,
      (totals.get(entry.employee_id) ?? 0) + (primary + split) / 60,
    );
  });

  return totals;
}

export function upsertEntry<TEntry extends { date: string; employee_id: string; id: string }>(
  entries: TEntry[],
  nextEntry: TEntry,
): TEntry[] {
  const nextEntries = [...entries];
  const byId = nextEntries.findIndex((entry) => entry.id === nextEntry.id);

  if (byId > -1) {
    nextEntries[byId] = nextEntry;
    return nextEntries;
  }

  const byNaturalKey = nextEntries.findIndex(
    (entry) =>
      entry.employee_id === nextEntry.employee_id && entry.date === nextEntry.date,
  );

  if (byNaturalKey > -1) nextEntries[byNaturalKey] = nextEntry;
  else nextEntries.push(nextEntry);

  return nextEntries;
}

export function getEmployeeDayTone(day: EmployeeScheduleDayView['day_type']): string {
  if (day === 'work') return 'border-emerald-500/30 bg-emerald-500/10';
  if (day === 'rest') return 'border-sky-500/30 bg-sky-500/10';
  if (day === 'vacation') return 'border-amber-500/30 bg-amber-500/10';
  if (day === 'sick_leave' || day === 'absent') {
    return 'border-rose-500/30 bg-rose-500/10';
  }

  return 'border-border bg-surface';
}

export function formatDayOptionLabel(weekStart: string, index: number): string {
  const date = addDays(new Date(`${weekStart}T00:00:00`), index);
  return `${format(date, 'EEE', { locale: es })} ${format(date, 'dd/MM')}`;
}

export function getPreferredDisplayMode(): ScheduleDisplayMode {
  return matchesMobileViewport() ? 'day' : 'week';
}
