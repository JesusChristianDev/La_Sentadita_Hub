import type { EmployeeListItem } from '@/modules/employees';

import {
  buildShiftTextFromEntry,
  validateShiftText,
} from '../application/shiftValidation';
import { requiresScheduledCells } from '../domain/scheduleRoleRules';
import type {
  ScheduleConfig,
  ScheduleEntry,
  ShiftTemplate,
} from '../domain/scheduleTypes';

type ParseCellInputResult =
  | {
      normalizedValue: string;
      ok: true;
      updates: Partial<ScheduleEntry>;
    }
  | {
      error: string;
      ok: false;
    };

export type ScheduleCellSelectionContext = {
  canAddSplit: boolean;
  hasSplit: boolean;
  rangeIndex: 0 | 1;
  segment: 'end' | 'start';
};

const REST_TOKENS = new Set(['D', 'DESCANSO', 'L', 'LIBRE']);
const VACATION_TOKENS = new Set(['V', 'VACACIONES', 'VACATION']);
const SICK_LEAVE_TOKENS = new Set(['B', 'BAJA', 'SICK', 'SICK_LEAVE']);
const ABSENT_TOKENS = new Set(['A', 'ABSENT', 'AUSENCIA', 'AUSENTE']);
const STATUS_CANONICAL_LABELS = {
  absent: 'Ausencia',
  rest: 'Libre',
  sick_leave: 'Baja',
  vacation: 'Vacaciones',
} as const;
const SHORT_STATUS_ALIASES: Record<string, string> = {
  a: STATUS_CANONICAL_LABELS.absent,
  ausencia: STATUS_CANONICAL_LABELS.absent,
  ausente: STATUS_CANONICAL_LABELS.absent,
  b: STATUS_CANONICAL_LABELS.sick_leave,
  baja: STATUS_CANONICAL_LABELS.sick_leave,
  d: STATUS_CANONICAL_LABELS.rest,
  descanso: STATUS_CANONICAL_LABELS.rest,
  l: STATUS_CANONICAL_LABELS.rest,
  libre: STATUS_CANONICAL_LABELS.rest,
  v: STATUS_CANONICAL_LABELS.vacation,
  vacacion: STATUS_CANONICAL_LABELS.vacation,
  vacaciones: STATUS_CANONICAL_LABELS.vacation,
};
const QUARTER_MINUTE_DIGITS: Record<string, string> = {
  '0': '00',
  '1': '15',
  '3': '30',
  '4': '45',
};

function normalizeDraftSeparators(rawValue: string): string {
  return rawValue.replace(/[\/,]+/g, ' ').replace(/\s+/g, ' ');
}

function clearShiftFields(): Partial<ScheduleEntry> {
  return {
    end_time: undefined,
    shift_template_id: undefined,
    split_end_time: undefined,
    split_start_time: undefined,
    start_time: undefined,
    zone_id: undefined,
  };
}

function compactTime(value: string | undefined): string {
  if (!value) return '';
  return value.slice(0, 5);
}

function toTwoDigits(value: string): string {
  return value.padStart(2, '0');
}

function formatThreeDigitTime(digits: string): string | null {
  const firstTwoHour = Number(digits.slice(0, 2));
  const quarterMinutes = QUARTER_MINUTE_DIGITS[digits[2]];

  if (Number.isFinite(firstTwoHour) && firstTwoHour <= 23 && quarterMinutes) {
    return `${digits.slice(0, 2)}:${quarterMinutes}`;
  }

  const firstHour = Number(digits[0]);
  const minutes = Number(digits.slice(1));

  if (
    Number.isFinite(firstHour) &&
    Number.isFinite(minutes) &&
    firstHour <= 23 &&
    minutes <= 59
  ) {
    return `${toTwoDigits(digits[0])}:${digits.slice(1)}`;
  }

  return null;
}

function formatFourDigitTime(digits: string): string | null {
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2, 4));

  if (
    Number.isFinite(hours) &&
    Number.isFinite(minutes) &&
    hours <= 23 &&
    minutes <= 59
  ) {
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  }

  return null;
}

function formatCommittedTimeToken(rawValue: string): string {
  const raw = rawValue.trim();
  if (!raw) return '';

  if (raw.includes(':')) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 1) return digits ? `0${digits}:` : '';
    if (digits.length === 2) return `${digits}:`;
    if (digits.length === 3) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  }

  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (!digits) return raw;

  if (digits.length === 1) return `${toTwoDigits(digits)}:00`;
  if (digits.length === 2) return Number(digits) <= 23 ? `${digits}:00` : raw;
  if (digits.length === 3) return formatThreeDigitTime(digits) ?? raw;
  return formatFourDigitTime(digits) ?? raw;
}

function formatPendingRangeToken(rawValue: string, options?: { commit?: boolean }): string {
  const raw = rawValue.trim();
  if (!raw) return '';

  if (options?.commit) {
    const committed = formatCommittedTimeToken(raw);
    return committed.includes(':') ? `${committed}-` : committed;
  }

  if (raw.includes(':')) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 1) return raw;
    if (digits.length === 2) return raw;
    if (digits.length === 3) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}-`;
  }

  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (!digits) return raw;
  if (digits.length <= 2) return raw;
  if (digits.length === 3) {
    const formatted = formatThreeDigitTime(digits) ?? raw;
    return formatted.includes(':') ? `${formatted}-` : formatted;
  }

  const formatted = formatFourDigitTime(digits) ?? raw;
  return formatted.includes(':') ? `${formatted}-` : formatted;
}

function formatEndToken(rawValue: string): string {
  const raw = rawValue.trim();
  if (!raw) return '';

  if (raw.includes(':')) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    if (digits.length === 3) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  }

  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  if (digits.length === 3) return formatThreeDigitTime(digits) ?? raw;
  return formatFourDigitTime(digits) ?? raw;
}

function formatRangeDraftInput(
  rawValue: string,
  options?: { commitWithoutDash?: boolean; rangeIndex?: number },
): string {
  const raw = rawValue.trim();
  if (!raw) return '';

  const dashIndex = raw.indexOf('-');
  if (dashIndex === -1) {
    return formatPendingRangeToken(raw, { commit: options?.commitWithoutDash });
  }

  const startRaw = raw.slice(0, dashIndex);
  const endRaw = raw.slice(dashIndex + 1);
  const startValue = formatCommittedTimeToken(startRaw);
  const endValue = formatEndToken(endRaw);

  return `${startValue}-${endValue}`;
}

function normalizeStatusToken(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed || !/^[A-Za-z]+$/.test(trimmed)) return null;

  return SHORT_STATUS_ALIASES[trimmed.toLowerCase()] ?? null;
}

function findEmbeddedStatusToken(rawValue: string): string | null {
  const letterTokens = rawValue.match(/[A-Za-z]+/g) ?? [];

  for (const token of letterTokens) {
    const normalized = normalizeStatusToken(token);
    if (normalized) return normalized;
  }

  return null;
}

export function formatCellDraftInput(rawValue: string): string {
  const hasTrailingSpace = /\s$/.test(rawValue);
  const raw = normalizeDraftSeparators(rawValue);
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const embeddedStatus = findEmbeddedStatusToken(trimmed);
  if (embeddedStatus) return embeddedStatus;

  const parts = trimmed.split(' ').filter(Boolean);
  const formatted = parts
    .slice(0, 2)
    .map((part, index) =>
      formatRangeDraftInput(part, {
        commitWithoutDash: hasTrailingSpace && index === parts.length - 1,
        rangeIndex: index,
      }),
    )
    .join(' ');

  if (hasTrailingSpace && parts.length < 2 && !formatted.endsWith('-')) {
    return `${formatted} `;
  }

  return formatted;
}

export function splitCellDraftValue(value: string): {
  primary: string;
  secondary: string;
} {
  const parts = normalizeDraftSeparators(value).trim().split(' ').filter(Boolean);

  return {
    primary: parts[0] ?? '',
    secondary: parts[1] ?? '',
  };
}

export function isStatusCellDraftValue(value: string): boolean {
  return Boolean(normalizeStatusToken(value));
}

export function buildCellDraftValue(params: {
  primary: string;
  secondary?: string;
}, options?: { preserveRaw?: boolean }): string {
  const rawPrimary = normalizeDraftSeparators(params.primary).trim();
  const rawSecondary = normalizeDraftSeparators(params.secondary ?? '').trim();

  if (options?.preserveRaw) {
    if (!rawPrimary) return '';
    if (!rawSecondary) return rawPrimary;
    return `${rawPrimary} ${rawSecondary}`;
  }

  const primaryStatus =
    normalizeStatusToken(params.primary) ?? findEmbeddedStatusToken(params.primary);
  if (primaryStatus) return primaryStatus;

  const secondaryStatus =
    normalizeStatusToken(params.secondary ?? '') ??
    findEmbeddedStatusToken(params.secondary ?? '');
  if (secondaryStatus) return secondaryStatus;

  const primary = formatRangeDraftInput(params.primary);
  if (!primary) return '';

  const secondary = formatRangeDraftInput(params.secondary ?? '');
  if (!secondary) return primary;

  return `${primary} ${secondary}`;
}

export function canAddSplitToCellDraft(value: string): boolean {
  const { primary, secondary } = splitCellDraftValue(value);
  if (!primary || secondary) return false;
  return !isStatusCellDraftValue(primary);
}

export function removeSplitFromCellDraft(value: string): string {
  return splitCellDraftValue(value).primary;
}

export function resolveCellSelectionContext(
  value: string,
  caretPosition: number | null,
): ScheduleCellSelectionContext {
  const normalized = value.replace(/\s+/g, ' ');
  const safeCaret = Math.max(0, Math.min(caretPosition ?? normalized.length, normalized.length));
  const separatorIndex = normalized.indexOf(' ');
  const hasSplit = separatorIndex > -1;

  if (!hasSplit) {
    const dashIndex = normalized.indexOf('-');
    return {
      canAddSplit: normalized.trim().length > 0 && !normalized.trim().endsWith('-'),
      hasSplit: false,
      rangeIndex: 0,
      segment: dashIndex === -1 || safeCaret <= dashIndex ? 'start' : 'end',
    };
  }

  const secondRange = normalized.slice(separatorIndex + 1);
  const isSecondRange = safeCaret > separatorIndex;
  const activeRange = isSecondRange ? secondRange : normalized.slice(0, separatorIndex);
  const localCaret = isSecondRange
    ? Math.max(0, safeCaret - separatorIndex - 1)
    : safeCaret;
  const dashIndex = activeRange.indexOf('-');

  return {
    canAddSplit: false,
    hasSplit: true,
    rangeIndex: isSecondRange ? 1 : 0,
    segment: dashIndex === -1 || localCaret <= dashIndex ? 'start' : 'end',
  };
}

export function appendSplitDraftInput(value: string): {
  nextCaret: number;
  nextValue: string;
} {
  const trimmed = value.trimEnd();

  if (!trimmed || trimmed.includes(' ') || trimmed.endsWith('-')) {
    return {
      nextCaret: trimmed.length,
      nextValue: trimmed,
    };
  }

  const nextValue = `${trimmed} `;
  return {
    nextCaret: nextValue.length,
    nextValue,
  };
}

function sanitizeDeletedRange(rawValue: string): string {
  if (!rawValue) return '';
  if (rawValue.startsWith('-')) return rawValue.slice(1);
  return rawValue;
}

export function deleteCellDraftContent(params: {
  direction: 'backward' | 'forward';
  selectionEnd: number;
  selectionStart: number;
  value: string;
}): {
  nextCaret: number;
  nextValue: string;
} {
  const { direction, selectionEnd, selectionStart, value } = params;

  const deleteStart =
    selectionStart === selectionEnd
      ? direction === 'backward'
        ? Math.max(0, selectionStart - 1)
        : selectionStart
      : selectionStart;
  const deleteEnd =
    selectionStart === selectionEnd
      ? direction === 'backward'
        ? selectionStart
        : Math.min(value.length, selectionEnd + 1)
      : selectionEnd;

  const rawNextValue = `${value.slice(0, deleteStart)}${value.slice(deleteEnd)}`;
  const normalized = rawNextValue.replace(/\s+/g, ' ');
  const pieces = normalized.split(' ').slice(0, 2).map(sanitizeDeletedRange).filter(Boolean);
  const nextValue = pieces.join(' ').trimStart();

  return {
    nextCaret: Math.min(deleteStart, nextValue.length),
    nextValue,
  };
}

export function buildCellText(entry?: ScheduleEntry): string {
  if (!entry) return '';

  if (entry.day_type === 'work') {
    return buildShiftTextFromEntry(entry);
  }

  if (entry.day_type === 'unscheduled') return '';
  if (entry.day_type === 'rest') return STATUS_CANONICAL_LABELS.rest;
  if (entry.day_type === 'vacation') return STATUS_CANONICAL_LABELS.vacation;
  if (entry.day_type === 'sick_leave') return STATUS_CANONICAL_LABELS.sick_leave;
  if (entry.day_type === 'absent') return STATUS_CANONICAL_LABELS.absent;

  return '';
}

export function buildTemplateText(template: ShiftTemplate): string {
  const mainRange = `${compactTime(template.start_time)}-${compactTime(template.end_time)}`;

  if (!template.split_start_time || !template.split_end_time) {
    return mainRange;
  }

  return `${mainRange} ${compactTime(template.split_start_time)}-${compactTime(template.split_end_time)}`;
}

export function parseCellInput(
  rawValue: string,
  employee: EmployeeListItem,
  config: ScheduleConfig,
): ParseCellInputResult {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    if (!requiresScheduledCells(employee.role)) {
      return {
        normalizedValue: '',
        ok: true,
        updates: {
          ...clearShiftFields(),
          day_type: 'unscheduled',
        },
      };
    }

    return { error: 'La celda necesita un valor valido antes de guardarse.', ok: false };
  }

  const upper = trimmed.toUpperCase();

  if (REST_TOKENS.has(upper)) {
    return {
      normalizedValue: STATUS_CANONICAL_LABELS.rest,
      ok: true,
      updates: {
        ...clearShiftFields(),
        day_type: 'rest',
      },
    };
  }

  if (VACATION_TOKENS.has(upper)) {
    return {
      normalizedValue: STATUS_CANONICAL_LABELS.vacation,
      ok: true,
      updates: {
        ...clearShiftFields(),
        day_type: 'vacation',
      },
    };
  }

  if (SICK_LEAVE_TOKENS.has(upper)) {
    return {
      normalizedValue: STATUS_CANONICAL_LABELS.sick_leave,
      ok: true,
      updates: {
        ...clearShiftFields(),
        day_type: 'sick_leave',
      },
    };
  }

  if (ABSENT_TOKENS.has(upper)) {
    return {
      normalizedValue: STATUS_CANONICAL_LABELS.absent,
      ok: true,
      updates: {
        ...clearShiftFields(),
        day_type: 'absent',
      },
    };
  }

  if (!employee.zone_id) {
    return {
      error: 'El empleado necesita una zona asignada para tener turno de trabajo.',
      ok: false,
    };
  }

  const validated = validateShiftText(trimmed, config);
  if (!validated.ok) {
    return { error: validated.error, ok: false };
  }

  const normalizedValue = validated.shift.split_start_time
    ? `${compactTime(validated.shift.start_time)}-${compactTime(validated.shift.end_time)} ${compactTime(validated.shift.split_start_time)}-${compactTime(validated.shift.split_end_time ?? undefined)}`
    : `${compactTime(validated.shift.start_time)}-${compactTime(validated.shift.end_time)}`;

  return {
    normalizedValue,
    ok: true,
    updates: {
      day_type: 'work',
      end_time: validated.shift.end_time,
      shift_template_id: undefined,
      split_end_time: validated.shift.split_end_time ?? undefined,
      split_start_time: validated.shift.split_start_time ?? undefined,
      start_time: validated.shift.start_time,
      zone_id: employee.zone_id,
    },
  };
}
