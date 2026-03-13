'use client';

import { ArrowLeft, CalendarDays, MonitorSmartphone, Search } from 'lucide-react';
import type { RefObject } from 'react';

import type { EmployeeListItem } from '@/modules/employees';
import { ChipButton, Notice, Select } from '@/shared/ui';

import type {
  ScheduleEditorPayload,
  ScheduleLock,
  SchedulePublicationState,
} from '../domain/scheduleTypes';
import {
  formatWeekRange,
  type NoticeState,
  statusLabel,
} from './scheduleEditorHelpers';
import { ScheduleGrid, type ScheduleGridHandle } from './ScheduleGrid';
import type {
  ScheduleDayOption,
  ScheduleEditorMode,
  ScheduleGridHealth,
  ScheduleZoneFilter,
} from './scheduleUiModels';

type ScheduleQuickActionsWorkspaceProps = {
  dayOptions: ScheduleDayOption[];
  editorData: ScheduleEditorPayload<EmployeeListItem>;
  editorMode: ScheduleEditorMode;
  gridHealth: ScheduleGridHealth;
  gridRef: RefObject<ScheduleGridHandle | null>;
  isBusy: boolean;
  lockStatus: ScheduleLock | null;
  notice: NoticeState;
  onBack: () => void;
  onGridHealthChange: (health: ScheduleGridHealth) => void;
  onSaveCell: (employeeId: string, date: string, rawValue: string) => Promise<boolean>;
  onSearchValueChange: (value: string) => void;
  onSelectedDayIndexChange: (value: number) => void;
  onZoneFilterChange: (value: ScheduleZoneFilter) => void;
  publicationState: SchedulePublicationState;
  publishPulse: number;
  searchValue: string;
  selectedDayIndex: number;
  totalEmployees: number;
  visibleEmployees: EmployeeListItem[];
  zoneFilter: ScheduleZoneFilter;
};

export function ScheduleQuickActionsWorkspace({
  dayOptions,
  editorData,
  editorMode,
  gridHealth,
  gridRef,
  isBusy,
  lockStatus,
  notice,
  onBack,
  onGridHealthChange,
  onSaveCell,
  onSearchValueChange,
  onSelectedDayIndexChange,
  onZoneFilterChange,
  publicationState,
  publishPulse,
  searchValue,
  selectedDayIndex,
  totalEmployees,
  visibleEmployees,
  zoneFilter,
}: ScheduleQuickActionsWorkspaceProps) {
  const currentSchedule = editorData.schedule;
  const isViewMode = editorMode === 'view';
  const effectiveStatusLabel =
    currentSchedule.published_at && !publicationState.has_changes
      ? 'Publicado'
      : statusLabel(currentSchedule.status);
  const selectedDayLabel =
    dayOptions.find((option) => option.index === selectedDayIndex)?.label ??
    'Dia seleccionado';
  const lockLabel = isViewMode
    ? 'Solo lectura'
    : lockStatus?.acquired
      ? 'Bloqueo activo en tu sesion'
      : lockStatus?.locked_by_name
        ? `Editando ${lockStatus.locked_by_name}`
        : 'Bloqueo no disponible';

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="app-shell app-shell--workspace schedule-shell stack rise-in"
    >
      {notice ? <Notice tone={notice.tone}>{notice.message}</Notice> : null}

      <section className="panel stack min-w-0 overflow-hidden !p-4 sm:!p-5">
        <div className="rounded-[1.6rem] border border-border/70 bg-surface-muted/35 p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border/70 bg-background/25 px-3 text-sm font-medium text-muted transition hover:border-border hover:text-foreground"
                onClick={onBack}
                type="button"
              >
                <ArrowLeft className="h-4 w-4" />
                Horarios
              </button>
              <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
                Cambios rapidos
              </span>
              <span className="rounded-full border border-border/70 bg-background/25 px-3 py-1 text-xs font-medium text-muted">
                {effectiveStatusLabel}
              </span>
            </div>

            <div>
              <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">
                {formatWeekRange(currentSchedule.week_start)}
              </h1>
              <p className="mt-2 text-sm text-muted">
                {isViewMode
                  ? 'Vista movil para revisar el dia y consultar turnos concretos.'
                  : 'En movil solo se resuelven ajustes puntuales. La edicion completa, la publicacion y el PDF quedan en desktop.'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.2rem] border border-border/70 bg-background/25 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Dia activo
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {selectedDayLabel}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-border/70 bg-background/25 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Estado
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">{lockLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <label className="field">
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <CalendarDays className="h-4 w-4 text-accent-strong" />
                Dia
              </span>
              <Select
                onChange={(event) =>
                  onSelectedDayIndexChange(Number(event.target.value))
                }
                value={selectedDayIndex}
              >
                {dayOptions.map((option) => (
                  <option key={option.index} value={option.index}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="field">
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                <Search className="h-4 w-4 text-accent-strong" />
                Buscar persona
              </span>
              <input
                className="input"
                onChange={(event) => onSearchValueChange(event.target.value)}
                placeholder="Nombre del empleado"
                value={searchValue}
              />
            </label>
          </div>

          <div className="grid gap-2">
            <p className="text-sm font-semibold text-foreground">Zonas</p>
            <div className="chip-row overflow-x-auto pb-1">
              <ChipButton active={zoneFilter === 'all'} onClick={() => onZoneFilterChange('all')}>
                Todo ({totalEmployees})
              </ChipButton>
              {editorData.zones.map((zone) => {
                const count = editorData.employees.filter(
                  (employee) => employee.zone_id === zone.id,
                ).length;

                if (!count) return null;

                return (
                  <ChipButton
                    key={zone.id}
                    active={zoneFilter === zone.id}
                    onClick={() => onZoneFilterChange(zone.id)}
                  >
                    {zone.name} ({count})
                  </ChipButton>
                );
              })}
              {editorData.employees.some((employee) => !employee.zone_id) ? (
                <ChipButton
                  active={zoneFilter === 'unassigned'}
                  onClick={() => onZoneFilterChange('unassigned')}
                >
                  Sin zona
                </ChipButton>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-border/70 bg-background/25 px-3 py-1 text-xs text-muted">
              Mostrando {visibleEmployees.length} de {totalEmployees}
            </span>
            <span className="rounded-full border border-border/70 bg-background/25 px-3 py-1 text-xs text-muted">
              {gridHealth.emptyCount} pendientes
            </span>
            <span className="rounded-full border border-border/70 bg-background/25 px-3 py-1 text-xs text-muted">
              {gridHealth.invalidCount} errores
            </span>
            {isBusy ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent-strong">
                <MonitorSmartphone className="h-3.5 w-3.5" />
                Actualizando
              </span>
            ) : null}
          </div>
        </div>

        <ScheduleGrid
          allEmployees={editorData.employees}
          config={editorData.config}
          entries={editorData.schedule.schedule_entries}
          isLockedByMe={!isViewMode && Boolean(lockStatus?.acquired)}
          key={currentSchedule.id}
          mode="day"
          onSaveCell={onSaveCell}
          onStateChange={onGridHealthChange}
          publishPulse={publishPulse}
          ref={gridRef}
          selectedDayIndex={selectedDayIndex}
          shiftTemplates={editorData.shift_templates}
          visibleEmployees={visibleEmployees}
          weekStart={currentSchedule.week_start}
          zones={editorData.zones}
        />
      </section>
    </main>
  );
}
