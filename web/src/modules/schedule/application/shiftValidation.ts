import type {
  DayType,
  ParsedShift,
  ScheduleConfig,
  ScheduleEntry,
  ShiftValidationResult,
} from '../domain/scheduleTypes';

type ParsedRange = {
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  crossesMidnight: boolean;
};

const RANGE_PATTERN = /^([0-2]?\d(?::[0-5]\d)?)\s*-\s*([0-2]?\d(?::[0-5]\d)?)$/;
const MANUAL_DAY_TYPE_ALIASES: Record<string, Exclude<DayType, 'not_applicable' | 'end_of_contract'>> = {
  a: 'absent',
  ausencia: 'absent',
  b: 'sick_leave',
  baja: 'sick_leave',
  d: 'rest',
  descanso: 'rest',
  l: 'rest',
  libre: 'rest',
  v: 'vacation',
  vacaciones: 'vacation',
};

function normalizeTimeToken(token: string): string | null {
  const trimmed = token.trim();
  const pieces = trimmed.split(':');
  if (pieces.length > 2) return null;

  const hours = Number(pieces[0]);
  const minutes = pieces.length === 2 ? Number(pieces[1]) : 0;

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

function parseRange(token: string): ParsedRange | null {
  const matched = token.trim().match(RANGE_PATTERN);
  if (!matched) return null;

  const start = normalizeTimeToken(matched[1]);
  const end = normalizeTimeToken(matched[2]);
  if (!start || !end) return null;

  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  const crossesMidnight = endMinutes < startMinutes;
  const rawDuration = endMinutes - startMinutes;
  const durationMinutes = rawDuration <= 0 ? rawDuration + 24 * 60 : rawDuration;

  return {
    start,
    end,
    startMinutes,
    endMinutes,
    durationMinutes,
    crossesMidnight,
  };
}

function toResult(shift: ParsedShift): ShiftValidationResult {
  return { ok: true, shift };
}

function toError(error: string): ShiftValidationResult {
  return { ok: false, error };
}

function ensureMinDuration(range: ParsedRange, minShiftDurationMinutes: number): boolean {
  return range.durationMinutes >= minShiftDurationMinutes;
}

export function validateShiftText(
  shiftText: string,
  config: ScheduleConfig,
): ShiftValidationResult {
  const compact = shiftText.trim();
  if (!compact) {
    return toError('Introduce un turno valido (ejemplo: 9-18 o 11-17 19-23).');
  }

  const tokens = compact.split(/\s+/).filter(Boolean);
  if (tokens.length > 2) {
    return toError('Solo se permiten uno o dos tramos por celda.');
  }

  const ranges = tokens.map((token) => parseRange(token));
  if (ranges.some((range) => !range)) {
    return toError('Formato de hora invalido. Usa HH-MM o HH:MM-HH:MM.');
  }

  const typedRanges = ranges.filter((range): range is ParsedRange => Boolean(range));
  const minShiftDurationMinutes = config.min_shift_duration_minutes;
  const minSplitBreakMinutes = config.min_split_break_minutes;

  if (typedRanges.length === 1) {
    const range = typedRanges[0];

    if (range.durationMinutes <= 0) {
      return toError('El turno no puede tener duracion cero.');
    }

    if (!ensureMinDuration(range, minShiftDurationMinutes)) {
      return toError(
        `La duracion minima de turno es ${Math.ceil(minShiftDurationMinutes / 60)} hora(s).`,
      );
    }

    return toResult({
      start_time: range.start,
      end_time: range.end,
      split_start_time: null,
      split_end_time: null,
    });
  }

  const [firstOriginal, secondOriginal] = typedRanges;
  const ordered = [...typedRanges].sort((a, b) => a.startMinutes - b.startMinutes);
  const [first, second] = ordered;

  if (first.crossesMidnight || second.crossesMidnight) {
    return toError(
      'Los turnos partidos no permiten cruces de medianoche. Usa un turno continuo en ese caso.',
    );
  }

  if (!ensureMinDuration(firstOriginal, minShiftDurationMinutes)) {
    return toError(
      `Cada tramo debe durar al menos ${Math.ceil(minShiftDurationMinutes / 60)} hora(s).`,
    );
  }
  if (!ensureMinDuration(secondOriginal, minShiftDurationMinutes)) {
    return toError(
      `Cada tramo debe durar al menos ${Math.ceil(minShiftDurationMinutes / 60)} hora(s).`,
    );
  }

  if (first.endMinutes > second.startMinutes) {
    return toError('Las franjas de turno partido no pueden solaparse.');
  }

  const splitBreakMinutes = second.startMinutes - first.endMinutes;
  if (splitBreakMinutes < minSplitBreakMinutes) {
    return toError(
      `Debe existir un descanso minimo de ${Math.ceil(minSplitBreakMinutes / 60)} hora(s) entre franjas.`,
    );
  }

  return toResult({
    start_time: first.start,
    end_time: first.end,
    split_start_time: second.start,
    split_end_time: second.end,
  });
}

export type ScheduleCellParseResult =
  | {
      ok: true;
      value: {
        day_type: Exclude<DayType, 'not_applicable' | 'end_of_contract'>;
        end_time: string | null;
        split_end_time: string | null;
        split_start_time: string | null;
        start_time: string | null;
      };
    }
  | { ok: false; error: string };

type ParseScheduleCellInputOptions = {
  allowEmpty?: boolean;
};

export function parseScheduleCellInput(
  rawValue: string,
  config: ScheduleConfig,
  options?: ParseScheduleCellInputOptions,
): ScheduleCellParseResult {
  const compact = rawValue.trim();
  if (!compact) {
    if (options?.allowEmpty) {
      return {
        ok: true,
        value: {
          day_type: 'unscheduled',
          end_time: null,
          split_end_time: null,
          split_start_time: null,
          start_time: null,
        },
      };
    }

    return {
      ok: false,
      error: 'La celda no puede quedarse vacia. Usa un valor valido.',
    };
  }

  const alias = MANUAL_DAY_TYPE_ALIASES[compact.toLowerCase()];
  if (alias) {
    return {
      ok: true,
      value: {
        day_type: alias,
        end_time: null,
        split_end_time: null,
        split_start_time: null,
        start_time: null,
      },
    };
  }

  const validated = validateShiftText(compact, config);
  if (!validated.ok) {
    return validated;
  }

  return {
    ok: true,
    value: {
      day_type: 'work',
      end_time: validated.shift.end_time,
      split_end_time: validated.shift.split_end_time,
      split_start_time: validated.shift.split_start_time,
      start_time: validated.shift.start_time,
    },
  };
}

function compactTime(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 5);
}

export function buildShiftTextFromEntry(entry: ScheduleEntry): string {
  if (entry.day_type !== 'work') return '';
  if (!entry.start_time || !entry.end_time) return '';

  const firstRange = `${compactTime(entry.start_time)}-${compactTime(entry.end_time)}`;
  if (!entry.split_start_time || !entry.split_end_time) return firstRange;

  return `${firstRange} ${compactTime(entry.split_start_time)}-${compactTime(entry.split_end_time)}`;
}
