'use client';

import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  forwardRef,
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import type { EmployeeListItem } from '@/modules/employees';
import { roleLabel } from '@/shared/roleLabel';

import { requiresScheduledCells } from '../domain/scheduleRoleRules';
import type {
  RestaurantZone,
  ScheduleConfig,
  ScheduleEntry,
  ShiftTemplate,
} from '../domain/scheduleTypes';
import {
  ScheduleCellField,
  type ScheduleCellSuggestion,
} from './ScheduleCellField';
import { buildCellText, buildTemplateText, parseCellInput } from './scheduleCellHelpers';
import { parseScheduleLocalDate } from './scheduleEditorHelpers';
import type { ScheduleDisplayMode, ScheduleGridHealth } from './scheduleUiModels';

type CellStatus = 'error' | 'idle' | 'saving' | 'success';

type ScheduleGridProps = {
  allEmployees: EmployeeListItem[];
  config: ScheduleConfig;
  entries: ScheduleEntry[];
  healthScope?: 'all' | 'visible';
  isLockedByMe: boolean;
  mode: ScheduleDisplayMode;
  onStateChange: (health: ScheduleGridHealth) => void;
  onSaveCell: (employeeId: string, date: string, rawValue: string) => Promise<boolean>;
  publishPulse: number;
  selectedDayIndex: number;
  shiftTemplates: ShiftTemplate[];
  visibleEmployees: EmployeeListItem[];
  weekStart: string;
  zones: RestaurantZone[];
};

export type ScheduleGridHandle = {
  flushPendingEdits: () => Promise<boolean>;
};

function buildCellKey(employeeId: string, date: string): string {
  return `${employeeId}_${date}`;
}

function buildDayColumns(weekStart: string) {
  const startDate = parseScheduleLocalDate(weekStart);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startDate, index);
    return {
      date,
      index,
      iso: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEEE', { locale: es }),
      shortDate: format(date, 'dd/MM'),
      shortLabel: format(date, 'EEE', { locale: es }),
    };
  });
}

function getEntryHours(entry?: ScheduleEntry): number {
  if (!entry || entry.day_type !== 'work' || !entry.start_time || !entry.end_time) {
    return 0;
  }

  const toMinutes = (value: string) => {
    const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  };

  const diffMinutes = (start: string, end: string) => {
    const raw = toMinutes(end) - toMinutes(start);
    return raw <= 0 ? raw + 24 * 60 : raw;
  };

  const primary = diffMinutes(entry.start_time, entry.end_time);
  const split =
    entry.split_start_time && entry.split_end_time
      ? diffMinutes(entry.split_start_time, entry.split_end_time)
      : 0;

  return (primary + split) / 60;
}

function formatHours(hours: number): string {
  if (hours === 0) return '0 h';
  if (Number.isInteger(hours)) return `${hours} h`;
  return `${hours.toFixed(1)} h`;
}

function isRequiredCellPending(
  employee: Pick<EmployeeListItem, 'role'>,
  value: string,
  entry?: ScheduleEntry,
): boolean {
  if (!requiresScheduledCells(employee.role) || value.trim()) return false;
  return !entry || entry.day_type === 'unscheduled';
}

export const ScheduleGrid = forwardRef<ScheduleGridHandle, ScheduleGridProps>(function ScheduleGrid({
  allEmployees,
  config,
  entries,
  healthScope = 'all',
  isLockedByMe,
  mode,
  onStateChange,
  onSaveCell,
  publishPulse,
  selectedDayIndex,
  shiftTemplates,
  visibleEmployees,
  weekStart,
  zones,
}, ref) {
  const dayColumns = useMemo(() => buildDayColumns(weekStart), [weekStart]);
  const visibleColumns = useMemo(
    () =>
      mode === 'day'
        ? dayColumns.filter((column) => column.index === selectedDayIndex)
        : dayColumns,
    [dayColumns, mode, selectedDayIndex],
  );

  const entriesMap = useMemo(() => {
    const map = new Map<string, ScheduleEntry>();
    entries.forEach((entry) => {
      map.set(buildCellKey(entry.employee_id, entry.date), entry);
    });
    return map;
  }, [entries]);

  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [cellStatuses, setCellStatuses] = useState<Record<string, CellStatus>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});

  const gridHealth = useMemo(() => {
    let emptyCount = 0;
    let invalidCount = 0;
    const healthEmployees = healthScope === 'visible' ? visibleEmployees : allEmployees;
    const healthColumns = healthScope === 'visible' ? visibleColumns : dayColumns;

    healthEmployees.forEach((employee) => {
      healthColumns.forEach((column) => {
        const key = buildCellKey(employee.id, column.iso);
        const value = draftValues[key] ?? buildCellText(entriesMap.get(key));
        const entry = entriesMap.get(key);

        if (isRequiredCellPending(employee, value, entry)) {
          emptyCount += 1;
        }

        if (cellStatuses[key] === 'error') {
          invalidCount += 1;
        }
      });
    });

    return { emptyCount, invalidCount };
  }, [
    allEmployees,
    cellStatuses,
    dayColumns,
    draftValues,
    entriesMap,
    healthScope,
    visibleColumns,
    visibleEmployees,
  ]);
  const { emptyCount, invalidCount } = gridHealth;

  useEffect(() => {
    onStateChange({ emptyCount, invalidCount });
  }, [emptyCount, invalidCount, onStateChange]);

  const rowHoursByEmployee = useMemo(() => {
    const totals = new Map<string, number>();

    allEmployees.forEach((employee) => {
      const totalHours = visibleColumns.reduce((sum, column) => {
        return sum + getEntryHours(entriesMap.get(buildCellKey(employee.id, column.iso)));
      }, 0);

      totals.set(employee.id, totalHours);
    });

    return totals;
  }, [allEmployees, entriesMap, visibleColumns]);

  const groupedVisibleEmployees = useMemo(() => {
    const buckets: Record<string, EmployeeListItem[]> = {};

    visibleEmployees.forEach((employee) => {
      const key = employee.zone_id ?? 'other';
      if (!buckets[key]) {
        buckets[key] = [];
      }
      buckets[key].push(employee);
    });

    return buckets;
  }, [visibleEmployees]);

  const autocompleteSuggestions = useMemo<ScheduleCellSuggestion[]>(() => {
    const statusSuggestions: ScheduleCellSuggestion[] = [
      { hint: 'Atajo L', label: 'Libre', value: 'Libre' },
      { hint: 'Atajo V', label: 'Vacaciones', value: 'Vacaciones' },
      { hint: 'Atajo B', label: 'Baja', value: 'Baja' },
      { hint: 'Atajo A', label: 'Ausencia', value: 'Ausencia' },
    ];

    const templateSuggestions = shiftTemplates.map((template) => ({
      hint: buildTemplateText(template),
      label: template.name,
      value: buildTemplateText(template),
    }));

    return [...templateSuggestions, ...statusSuggestions].filter(
      (suggestion, index, array) =>
        array.findIndex((candidate) => candidate.value === suggestion.value) === index,
    );
  }, [shiftTemplates]);

  const commitCell = useCallback(async (
    employee: EmployeeListItem,
    date: string,
    nextRawValue?: string,
  ): Promise<boolean> => {
    const key = buildCellKey(employee.id, date);
    const rawValue =
      nextRawValue ?? draftValues[key] ?? buildCellText(entriesMap.get(key));
    const existingEntry = entriesMap.get(key);

    if (!rawValue.trim()) {
      if (!existingEntry) {
        setCellErrors((prev) => ({ ...prev, [key]: '' }));
        setCellStatuses((prev) => ({ ...prev, [key]: 'idle' }));
        return true;
      }

      setCellStatuses((prev) => ({ ...prev, [key]: 'saving' }));
      setCellErrors((prev) => ({ ...prev, [key]: '' }));

      const saved = await onSaveCell(employee.id, date, '');

      if (!saved) {
        setCellErrors((prev) => ({
          ...prev,
          [key]: 'No se pudo limpiar esta celda. Vuelve a intentarlo.',
        }));
        setCellStatuses((prev) => ({ ...prev, [key]: 'error' }));
        return false;
      }

      setDraftValues((prev) => ({ ...prev, [key]: '' }));
      setCellStatuses((prev) => ({ ...prev, [key]: 'success' }));

      setTimeout(() => {
        setCellStatuses((prev) =>
          prev[key] === 'success' ? { ...prev, [key]: 'idle' } : prev,
        );
      }, 1800);

      return true;
    }

    const parsed = parseCellInput(rawValue, employee, config);
    if (!parsed.ok) {
      setCellErrors((prev) => ({ ...prev, [key]: parsed.error }));
      setCellStatuses((prev) => ({ ...prev, [key]: 'error' }));
      return false;
    }

    setCellStatuses((prev) => ({ ...prev, [key]: 'saving' }));
    setCellErrors((prev) => ({ ...prev, [key]: '' }));

    const saved = await onSaveCell(employee.id, date, parsed.normalizedValue);

    if (!saved) {
      setCellErrors((prev) => ({
        ...prev,
        [key]: 'No se pudo guardar esta celda. Vuelve a intentarlo.',
      }));
      setCellStatuses((prev) => ({ ...prev, [key]: 'error' }));
      return false;
    }

    setDraftValues((prev) => ({ ...prev, [key]: parsed.normalizedValue }));
    setCellStatuses((prev) => ({ ...prev, [key]: 'success' }));

    setTimeout(() => {
      setCellStatuses((prev) =>
        prev[key] === 'success' ? { ...prev, [key]: 'idle' } : prev,
      );
    }, 1800);

    return true;
  }, [config, draftValues, entriesMap, onSaveCell]);

  useImperativeHandle(
    ref,
    () => ({
      async flushPendingEdits() {
        let allSaved = true;

        for (const employee of allEmployees) {
          for (const column of dayColumns) {
            const key = buildCellKey(employee.id, column.iso);
            const entry = entriesMap.get(key);
            const draftValue = draftValues[key];

            if (entry?.source === 'auto' || draftValue === undefined) continue;
            if (draftValue === buildCellText(entry)) continue;

            const saved = await commitCell(employee, column.iso, draftValue);
            if (!saved) {
              allSaved = false;
            }
          }
        }

        return allSaved;
      },
    }),
    [allEmployees, commitCell, dayColumns, draftValues, entriesMap],
  );

  const handleDropTemplate = async (
    employee: EmployeeListItem,
    date: string,
    templateText: string,
  ) => {
    if (!isLockedByMe) return;

    const key = buildCellKey(employee.id, date);
    setDraftValues((prev) => ({ ...prev, [key]: templateText }));
    await commitCell(employee, date, templateText);
  };

  const getCellClasses = (key: string, isEmptyPending: boolean) => {
    const status = cellStatuses[key] ?? 'idle';

    if (status === 'saving') {
      return 'border-blue-400 bg-blue-500/10 text-foreground';
    }

    if (status === 'success') {
      return 'border-emerald-500 bg-emerald-500/10 text-foreground';
    }

    if (status === 'error') {
      return 'border-red-500 bg-red-500/10 text-foreground';
    }

    if (isEmptyPending) {
      return 'border-orange-400 bg-orange-500/10 text-foreground';
    }

    return 'border-border bg-surface text-foreground';
  };

  const updateDraftValue = (key: string, nextValue: string) => {
    setDraftValues((prev) => ({ ...prev, [key]: nextValue }));

    if (cellStatuses[key] === 'error') {
      setCellStatuses((prev) => ({ ...prev, [key]: 'idle' }));
      setCellErrors((prev) => ({ ...prev, [key]: '' }));
    }
  };

  const resetCellState = (key: string, entry?: ScheduleEntry) => {
    setDraftValues((prev) => ({
      ...prev,
      [key]: buildCellText(entry),
    }));
    setCellErrors((prev) => ({ ...prev, [key]: '' }));
    setCellStatuses((prev) => ({ ...prev, [key]: 'idle' }));
  };

  const singleDayColumn = visibleColumns.length === 1 ? visibleColumns[0] : null;

  if (!visibleEmployees.length) {
    return (
      <div className="flex min-h-[18rem] items-center justify-center rounded-[1.2rem] border border-dashed border-border bg-surface/40 p-6 text-center">
        <div className="max-w-md space-y-2">
          <p className="text-base font-semibold text-foreground">
            No hay empleados para esos filtros
          </p>
          <p className="text-sm text-muted">
            Ajusta la busqueda o limpia alguno de los filtros para volver a ver el grid.
          </p>
        </div>
      </div>
    );
  }

  if (singleDayColumn) {
    const renderEmployeeCard = (employee: EmployeeListItem) => {
      const key = buildCellKey(employee.id, singleDayColumn.iso);
      const entry = entriesMap.get(key);
      const value = draftValues[key] ?? buildCellText(entry);
      const error = cellErrors[key];
      const isReadOnlyCell = entry?.source === 'auto' || !isLockedByMe;
      const isEmptyPending =
        publishPulse > 0 &&
        isRequiredCellPending(employee, value, entry) &&
        cellStatuses[key] !== 'error';

      return (
        <article
          key={employee.id}
          className="rounded-[1.3rem] border border-border bg-surface-muted/55 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {employee.full_name}
              </p>
              <p className="mt-1 text-xs text-muted">
                {roleLabel(employee.role)}
                {employee.is_area_lead ? ' / Encargado de zona' : ''}
              </p>
            </div>
            <span className="rounded-full border border-border/70 bg-background/25 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              {singleDayColumn.shortLabel} {singleDayColumn.shortDate}
            </span>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_5.5rem] sm:items-start">
            <ScheduleCellField
              autoTag={entry?.source === 'auto'}
              employeeName={employee.full_name}
              error={error}
              isEmptyPending={isEmptyPending}
              isLockedByMe={isLockedByMe}
              isReadOnlyCell={isReadOnlyCell}
              label={singleDayColumn.label}
              onCommit={(nextRawValue) => {
                if (!isLockedByMe || entry?.source === 'auto') return;
                void commitCell(employee, singleDayColumn.iso, nextRawValue);
              }}
              onDropTemplate={(templateText) => {
                if (!isLockedByMe || entry?.source === 'auto') return;
                void handleDropTemplate(employee, singleDayColumn.iso, templateText);
              }}
              onReset={() => resetCellState(key, entry)}
              onValueChange={(nextValue) => updateDraftValue(key, nextValue)}
              placeholder={isReadOnlyCell ? '-' : '9-17 o Libre o Vacaciones o Baja'}
              statusClassName={`${getCellClasses(
                key,
                isEmptyPending,
              )} ${isReadOnlyCell ? 'cursor-default opacity-80' : 'focus-visible:border-accent-strong focus-visible:ring-2 focus-visible:ring-accent-strong/30'}`}
              suggestions={autocompleteSuggestions}
              value={value}
            />

            <div className="rounded-[1.05rem] border border-border/70 bg-background/25 px-3 py-2 text-center">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                Horas del dia
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {formatHours(rowHoursByEmployee.get(employee.id) ?? 0)}
              </p>
            </div>
          </div>
        </article>
      );
    };

    return (
      <div className="grid gap-4">
        {zones.map((zone) => {
          const zoneEmployees = groupedVisibleEmployees[zone.id] ?? [];
          if (!zoneEmployees.length) return null;

          return (
            <section key={zone.id} className="grid gap-3">
              <div className="rounded-[1.1rem] border border-border/70 bg-background/20 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
                  {zone.name}
                </p>
              </div>
              <div className="grid gap-3">{zoneEmployees.map(renderEmployeeCard)}</div>
            </section>
          );
        })}

        {(groupedVisibleEmployees.other ?? []).length > 0 ? (
          <section className="grid gap-3">
            <div className="rounded-[1.1rem] border border-border/70 bg-background/20 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
                Sin zona asignada
              </p>
            </div>
            <div className="grid gap-3">
              {groupedVisibleEmployees.other.map(renderEmployeeCard)}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="schedule-table-container flex-1 text-sm">
      <table className="schedule-table">
        <thead>
          <tr>
            <th className="sticky-col w-36 min-w-36 text-left sm:w-40 sm:min-w-40 xl:w-44 xl:min-w-44">
              Empleado
            </th>
            {visibleColumns.map((column) => (
              <th
                key={column.iso}
                className="w-20 min-w-20 sm:w-24 sm:min-w-24 xl:w-28 xl:min-w-28"
              >
                <div className="day-header">
                  <span className="day-header-name capitalize">{column.shortLabel}</span>
                  <span className="day-header-date">{column.shortDate}</span>
                </div>
              </th>
            ))}
            <th className="sticky-right-col w-16 text-center sm:w-20">Horas</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((zone) => {
            const zoneEmployees = groupedVisibleEmployees[zone.id] ?? [];
            if (!zoneEmployees.length) return null;

            return (
              <Fragment key={zone.id}>
                <tr className="bg-surface-muted/80">
                  <td
                    className="px-4 py-3 text-xs font-bold uppercase tracking-[0.24em] text-muted"
                    colSpan={visibleColumns.length + 2}
                  >
                    {zone.name}
                  </td>
                </tr>
                {zoneEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-surface-muted/50">
                    <td className="sticky-col align-top">
                      <div className="flex flex-col gap-1 py-1.5">
                        <span className="font-semibold text-foreground">
                          {employee.full_name}
                        </span>
                        <span className="text-xs text-muted">
                          {roleLabel(employee.role)}
                          {employee.is_area_lead ? ' / Encargado de zona' : ''}
                        </span>
                      </div>
                    </td>
                    {visibleColumns.map((column) => {
                      const key = buildCellKey(employee.id, column.iso);
                      const entry = entriesMap.get(key);
                      const value = draftValues[key] ?? buildCellText(entry);
                      const error = cellErrors[key];
                      const isReadOnlyCell = entry?.source === 'auto' || !isLockedByMe;
                      const isEmptyPending =
                        publishPulse > 0 &&
                        isRequiredCellPending(employee, value, entry) &&
                        cellStatuses[key] !== 'error';

                      return (
                        <td key={column.iso} className="align-top">
                          <div className="py-1">
                            <ScheduleCellField
                              autoTag={entry?.source === 'auto'}
                              compact
                              employeeName={employee.full_name}
                              error={error}
                              isEmptyPending={isEmptyPending}
                              isLockedByMe={isLockedByMe}
                              isReadOnlyCell={isReadOnlyCell}
                              label={column.label}
                              onCommit={(nextRawValue) => {
                                if (!isLockedByMe || entry?.source === 'auto') return;
                                void commitCell(employee, column.iso, nextRawValue);
                              }}
                              onDropTemplate={(templateText) => {
                                if (!isLockedByMe || entry?.source === 'auto') return;
                                void handleDropTemplate(
                                  employee,
                                  column.iso,
                                  templateText,
                                );
                              }}
                              onReset={() => resetCellState(key, entry)}
                              onValueChange={(nextValue) => updateDraftValue(key, nextValue)}
                              placeholder={isReadOnlyCell ? '-' : '9-17 o Libre o Vacaciones o Baja'}
                              statusClassName={`${getCellClasses(
                                key,
                                isEmptyPending,
                              )} ${isReadOnlyCell ? 'cursor-default opacity-80' : 'focus-visible:border-accent-strong focus-visible:ring-2 focus-visible:ring-accent-strong/30'}`}
                              suggestions={autocompleteSuggestions}
                              value={value}
                            />
                          </div>
                        </td>
                      );
                    })}
                    <td className="sticky-right-col bg-surface-muted/80 text-center font-semibold text-foreground">
                      {formatHours(rowHoursByEmployee.get(employee.id) ?? 0)}
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}

          {(groupedVisibleEmployees.other ?? []).length > 0 ? (
            <Fragment>
              <tr className="bg-surface-muted/80">
                <td
                  className="px-4 py-3 text-xs font-bold uppercase tracking-[0.24em] text-muted"
                  colSpan={visibleColumns.length + 2}
                >
                  Sin zona asignada
                </td>
              </tr>
              {groupedVisibleEmployees.other.map((employee) => (
                <tr key={employee.id}>
                  <td className="sticky-col">
                    <div className="flex flex-col gap-1 py-1.5">
                      <span className="font-semibold text-foreground">
                        {employee.full_name}
                      </span>
                      <span className="text-xs text-muted">
                        {roleLabel(employee.role)}
                      </span>
                    </div>
                  </td>
                  {visibleColumns.map((column) => {
                    const key = buildCellKey(employee.id, column.iso);
                    const entry = entriesMap.get(key);
                    const isEmptyPending =
                      publishPulse > 0 &&
                      isRequiredCellPending(
                        employee,
                        draftValues[key] ?? buildCellText(entry),
                        entry,
                      ) &&
                      cellStatuses[key] !== 'error';

                    return (
                      <td key={column.iso}>
                        <input
                          aria-label={`${employee.full_name}, ${column.label}`}
                          className={`min-h-10 w-full rounded-2xl border px-3 py-2 text-sm font-semibold shadow-sm outline-none transition ${getCellClasses(
                            key,
                            isEmptyPending,
                          )}`}
                          disabled
                          placeholder="-"
                          readOnly
                          value={draftValues[key] ?? buildCellText(entry)}
                        />
                      </td>
                    );
                  })}
                  <td className="sticky-right-col bg-surface-muted/80 text-center font-semibold text-foreground">
                    {formatHours(rowHoursByEmployee.get(employee.id) ?? 0)}
                  </td>
                </tr>
              ))}
            </Fragment>
          ) : null}
        </tbody>
      </table>
    </div>
  );
});
