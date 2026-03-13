import type {
  Schedule,
  ScheduleConfig,
  ScheduleEntry,
  SchedulePublishReview,
} from '../domain/scheduleTypes';
import { parseScheduleCellInput } from './shiftValidation';

type DraftEntryComparableKey =
  | 'day_type'
  | 'start_time'
  | 'end_time'
  | 'split_start_time'
  | 'split_end_time'
  | 'zone_id'
  | 'shift_template_id';

export function buildEmptyDraftCellValue(): Pick<
  ScheduleEntry,
  'day_type' | 'start_time' | 'end_time' | 'split_start_time' | 'split_end_time'
> {
  return {
    day_type: 'unscheduled',
    end_time: null,
    split_end_time: null,
    split_start_time: null,
    start_time: null,
  };
}

export function parseDraftCellUpdates(params: {
  config?: ScheduleConfig;
  rawValue: string;
  zoneId: string | null;
}): Partial<ScheduleEntry> {
  if (!params.rawValue.trim()) {
    return buildEmptyDraftCellValue();
  }

  if (!params.config) {
    throw new Error(
      'CELL_VALIDATION_ERROR: No se pudo validar la celda por falta de configuracion.',
    );
  }

  const parsed = parseScheduleCellInput(params.rawValue, params.config);
  if (!parsed.ok) {
    throw new Error(`CELL_VALIDATION_ERROR: ${parsed.error}`);
  }

  return {
    ...parsed.value,
    zone_id: parsed.value.day_type === 'work' ? params.zoneId ?? undefined : undefined,
  };
}

export function sanitizeDraftEntryPayload(
  existing: ScheduleEntry | null,
  updates: Partial<ScheduleEntry>,
  defaultZoneId: string | null,
): Record<string, unknown> {
  const nextDayType = updates.day_type ?? existing?.day_type;
  if (!nextDayType) {
    throw new Error(
      'INVALID_SCHEDULE_ENTRY: La celda necesita un tipo de dia explicito antes de guardarse.',
    );
  }

  if (nextDayType !== 'work') {
    return {
      day_type: nextDayType,
      end_time: null,
      shift_template_id: null,
      source: 'manual',
      split_end_time: null,
      split_start_time: null,
      start_time: null,
      zone_id: null,
    };
  }

  const nextStartTime = updates.start_time ?? existing?.start_time ?? null;
  const nextEndTime = updates.end_time ?? existing?.end_time ?? null;
  const nextSplitStartTime = updates.split_start_time ?? existing?.split_start_time ?? null;
  const nextSplitEndTime = updates.split_end_time ?? existing?.split_end_time ?? null;

  if (!nextStartTime || !nextEndTime) {
    throw new Error(
      'INVALID_SCHEDULE_ENTRY: Un turno de trabajo necesita hora de inicio y fin.',
    );
  }

  if (Boolean(nextSplitStartTime) !== Boolean(nextSplitEndTime)) {
    throw new Error(
      'INVALID_SCHEDULE_ENTRY: El turno partido necesita ambas horas del segundo tramo.',
    );
  }

  return {
    day_type: 'work',
    end_time: nextEndTime,
    shift_template_id: updates.shift_template_id ?? existing?.shift_template_id ?? null,
    source: 'manual',
    split_end_time: nextSplitEndTime,
    split_start_time: nextSplitStartTime,
    start_time: nextStartTime,
    zone_id: updates.zone_id ?? existing?.zone_id ?? defaultZoneId ?? null,
  };
}

function readComparableEntryField(
  payload: Record<string, unknown>,
  key: DraftEntryComparableKey,
): string | null {
  const value = payload[key];
  if (value === undefined || value === null) return null;
  return String(value);
}

export function hasMeaningfulDraftEntryChanges(
  existing: ScheduleEntry | null,
  payload: Record<string, unknown>,
): boolean {
  if (!existing) return true;

  return (
    existing.day_type !== readComparableEntryField(payload, 'day_type') ||
    (existing.start_time ?? null) !== readComparableEntryField(payload, 'start_time') ||
    (existing.end_time ?? null) !== readComparableEntryField(payload, 'end_time') ||
    (existing.split_start_time ?? null) !==
      readComparableEntryField(payload, 'split_start_time') ||
    (existing.split_end_time ?? null) !==
      readComparableEntryField(payload, 'split_end_time') ||
    (existing.zone_id ?? null) !== readComparableEntryField(payload, 'zone_id') ||
    (existing.shift_template_id ?? null) !==
      readComparableEntryField(payload, 'shift_template_id')
  );
}

export function resolveScheduleStatusAfterDraftSave(
  currentStatus: Schedule['status'],
  changed: boolean,
): Schedule['status'] {
  if (currentStatus === 'published' && changed) {
    return 'draft';
  }

  return currentStatus;
}

export function getPublishValidationError(
  review: Pick<SchedulePublishReview, 'can_publish' | 'has_changes'>,
): string | null {
  if (!review.has_changes) {
    return 'No hay cambios pendientes respecto a la ultima publicacion.';
  }

  if (!review.can_publish) {
    return 'El horario tiene celdas vacias o errores de validacion.';
  }

  return null;
}
