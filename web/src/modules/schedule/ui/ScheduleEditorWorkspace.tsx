'use client';

import { type RefObject,useEffect, useMemo, useState } from 'react';

import type { AppRole } from '@/modules/auth_users';
import type { EmployeeListItem } from '@/modules/employees';
import { Notice } from '@/shared/ui';

import type {
  RestaurantZone,
  ScheduleEditorPayload,
  ScheduleLock,
  SchedulePublicationState,
} from '../domain/scheduleTypes';
import { ScheduleEditorFiltersPanel } from './ScheduleEditorFiltersPanel';
import {
  formatWeekRange,
  type NoticeState,
  statusLabel,
} from './scheduleEditorHelpers';
import { ScheduleEditorToolbar } from './ScheduleEditorToolbar';
import { ScheduleGrid, type ScheduleGridHandle } from './ScheduleGrid';
import {
  buildSchedulePdfDocument,
  createSchedulePdfFileName,
} from './schedulePdf';
import { SchedulePdfModal } from './SchedulePdfModal';
import { ScheduleTemplateDock } from './ScheduleTemplateDock';
import type {
  ScheduleCellTypeFilter,
  ScheduleDayOption,
  ScheduleDisplayMode,
  ScheduleEditorMode,
  ScheduleGridHealth,
  ScheduleProblemFilter,
  ScheduleZoneFilter,
} from './scheduleUiModels';

type ScheduleEditorWorkspaceProps = {
  cellTypeFilter: ScheduleCellTypeFilter;
  dayOptions: ScheduleDayOption[];
  displayMode: ScheduleDisplayMode;
  editorMode: ScheduleEditorMode;
  editorData: ScheduleEditorPayload<EmployeeListItem>;
  gridHealth: ScheduleGridHealth;
  gridRef: RefObject<ScheduleGridHandle | null>;
  isBusy: boolean;
  lockStatus: ScheduleLock | null;
  maxHoursFilter: string;
  minHoursFilter: string;
  notice: NoticeState;
  onBack: () => void;
  onCellTypeFilterChange: (value: ScheduleCellTypeFilter) => void;
  onDisplayModeChange: (value: ScheduleDisplayMode) => void;
  onGridHealthChange: (health: ScheduleGridHealth) => void;
  onMaxHoursFilterChange: (value: string) => void;
  onMinHoursFilterChange: (value: string) => void;
  onProblemFilterChange: (value: ScheduleProblemFilter) => void;
  onReviewPublish: () => void;
  onRoleFilterChange: (value: 'all' | AppRole) => void;
  onSaveCell: (employeeId: string, date: string, rawValue: string) => Promise<boolean>;
  onSearchValueChange: (value: string) => void;
  onSelectedDayIndexChange: (value: number) => void;
  onZoneFilterChange: (value: ScheduleZoneFilter) => void;
  problemFilter: ScheduleProblemFilter;
  publicationState: SchedulePublicationState;
  publishPulse: number;
  roleFilter: 'all' | AppRole;
  searchValue: string;
  selectedDayIndex: number;
  totalEmployees: number;
  visibleEmployees: EmployeeListItem[];
  zoneFilter: ScheduleZoneFilter;
};

type SchedulePdfScope = 'all' | 'unassigned' | string;

function buildPdfScopeOptions(
  zones: RestaurantZone[],
  employees: EmployeeListItem[],
): Array<{ label: string; value: SchedulePdfScope }> {
  const options: Array<{ label: string; value: SchedulePdfScope }> = [
    { label: 'Completo', value: 'all' },
  ];

  zones.forEach((zone) => {
    const count = employees.filter((employee) => employee.zone_id === zone.id).length;
    if (!count) return;

    options.push({
      label: `${zone.name} (${count})`,
      value: zone.id,
    });
  });

  const unassignedCount = employees.filter((employee) => !employee.zone_id).length;
  if (unassignedCount) {
    options.push({
      label: `Sin zona (${unassignedCount})`,
      value: 'unassigned',
    });
  }

  return options;
}

function getEmployeesForPdfScope(params: {
  employees: EmployeeListItem[];
  scope: SchedulePdfScope;
}) {
  const filtered =
    params.scope === 'all'
      ? params.employees
      : params.scope === 'unassigned'
        ? params.employees.filter((employee) => !employee.zone_id)
        : params.employees.filter((employee) => employee.zone_id === params.scope);

  return [...filtered].sort((left, right) =>
    left.full_name.localeCompare(right.full_name, 'es'),
  );
}

export function ScheduleEditorWorkspace({
  cellTypeFilter,
  dayOptions,
  displayMode,
  editorMode,
  editorData,
  gridHealth,
  gridRef,
  isBusy,
  lockStatus,
  maxHoursFilter,
  minHoursFilter,
  notice,
  onBack,
  onCellTypeFilterChange,
  onDisplayModeChange,
  onGridHealthChange,
  onMaxHoursFilterChange,
  onMinHoursFilterChange,
  onProblemFilterChange,
  onReviewPublish,
  onRoleFilterChange,
  onSaveCell,
  onSearchValueChange,
  onSelectedDayIndexChange,
  onZoneFilterChange,
  problemFilter,
  publicationState,
  publishPulse,
  roleFilter,
  searchValue,
  selectedDayIndex,
  totalEmployees,
  visibleEmployees,
  zoneFilter,
}: ScheduleEditorWorkspaceProps) {
  const currentSchedule = editorData.schedule;
  const permissions = editorData.permissions;
  const isViewMode = editorMode === 'view';
  const effectiveStatusLabel =
    currentSchedule.published_at && !publicationState.has_changes
      ? 'Publicado'
      : statusLabel(currentSchedule.status);
  const zoneFilterLabel =
    zoneFilter === 'all'
      ? 'Todo el equipo'
      : zoneFilter === 'unassigned'
        ? 'Sin zona asignada'
        : editorData.zones.find((zone) => zone.id === zoneFilter)?.name ?? 'Zona';
  const unassignedCount = editorData.employees.filter(
    (employee) => !employee.zone_id,
  ).length;
  const [pdfScope, setPdfScope] = useState<SchedulePdfScope>('all');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const backReadyKey = `${currentSchedule.id}:${editorMode}`;
  const [armedBackKey, setArmedBackKey] = useState<string | null>(null);
  const pdfScopeOptions = useMemo(
    () => buildPdfScopeOptions(editorData.zones, editorData.employees),
    [editorData.employees, editorData.zones],
  );
  const effectivePdfScope = pdfScopeOptions.some((option) => option.value === pdfScope)
    ? pdfScope
    : pdfScopeOptions[0]?.value ?? 'all';
  const pdfEmployees = useMemo(
    () =>
      getEmployeesForPdfScope({
        employees: editorData.employees,
        scope: effectivePdfScope,
      }),
    [effectivePdfScope, editorData.employees],
  );
  const selectedPdfScopeLabel =
    pdfScopeOptions.find((option) => option.value === effectivePdfScope)?.label ??
    'Completo';
  const selectedDayLabel = dayOptions.find((option) => option.index === selectedDayIndex)?.label;
  const statusExplanation = isViewMode
    ? `Modo lectura. Puedes revisar la publicacion y descargar el PDF por ${selectedPdfScopeLabel.toLowerCase()}.`
    : !publicationState.has_changes
      ? 'No hay cambios pendientes respecto a la ultima publicacion.'
      : publicationState.can_publish
        ? 'Hay cambios reales y el horario esta listo para publicarse.'
        : 'Hay cambios, pero todavia faltan correcciones antes de publicar.';
  const toolbarDescription = isViewMode
    ? 'Lectura de la ultima publicacion.'
    : displayMode === 'day' && selectedDayLabel
      ? `Vista centrada en ${selectedDayLabel}. El bloqueo de edicion se gestiona automaticamente.`
      : 'El bloqueo de edicion se gestiona automaticamente.';
  const lockLabel = isViewMode
    ? 'Sin bloqueo activo'
    : lockStatus?.acquired
      ? 'Bloqueo en tu sesion'
      : lockStatus?.locked_by_name
        ? `Editando ${lockStatus.locked_by_name}`
        : 'Bloqueo no adquirido';
  const isBackReady = armedBackKey === backReadyKey;
  const publishDisabledReason = !lockStatus?.acquired
    ? 'Necesitas adquirir el bloqueo de edicion para publicar.'
    : !publicationState.has_changes
      ? 'No hay cambios pendientes respecto a la ultima publicacion.'
      : !publicationState.can_publish
        ? 'Completa las celdas pendientes y corrige los errores antes de publicar.'
        : null;
  const publishButtonLabel = publishDisabledReason
    ? !publicationState.has_changes
      ? 'Sin cambios'
      : !publicationState.can_publish
        ? 'Requiere revision'
        : 'Bloqueado'
    : publicationState.has_changes
      ? 'Revisar publicacion'
      : 'Publicar';

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setArmedBackKey(backReadyKey);
    }, 240);

    return () => window.clearTimeout(timeoutId);
  }, [backReadyKey]);

  function handleDownloadPdf() {
    if (typeof window === 'undefined' || !pdfEmployees.length) return;

    const pdfBytes = buildSchedulePdfDocument({
      employees: pdfEmployees,
      entries: editorData.schedule.schedule_entries,
      scopeLabel: selectedPdfScopeLabel,
      weekStart: currentSchedule.week_start,
      zones: editorData.zones,
    });
    const fileName = createSchedulePdfFileName({
      scopeLabel: selectedPdfScopeLabel,
      weekStart: currentSchedule.week_start,
    });
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setIsPdfModalOpen(false);
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="app-shell app-shell--workspace schedule-shell stack rise-in"
    >
      {notice ? <Notice tone={notice.tone}>{notice.message}</Notice> : null}

      <section className="grid gap-5">
        <div className="panel schedule-editor-panel stack min-w-0 overflow-hidden !p-4 sm:!p-5 xl:!p-6">
          <ScheduleEditorToolbar
            canManagePublish={permissions.can_publish}
            changesLabel={
              !isViewMode
                ? publicationState.has_changes
                  ? 'Con cambios pendientes'
                  : 'Sin cambios pendientes'
                : undefined
            }
            dayOptions={dayOptions}
            displayMode={displayMode}
            effectiveStatusLabel={effectiveStatusLabel}
            gridHealth={gridHealth}
            isBackReady={isBackReady}
            isBusy={isBusy || !pdfScopeOptions.length}
            isViewMode={isViewMode}
            lockLabel={lockLabel}
            onBack={onBack}
            onDisplayModeChange={onDisplayModeChange}
            onOpenPdfModal={() => setIsPdfModalOpen(true)}
            onReviewPublish={onReviewPublish}
            onSelectedDayIndexChange={onSelectedDayIndexChange}
            primaryActionDisabled={
              isBusy ||
              isViewMode ||
              !lockStatus?.acquired ||
              !publicationState.can_publish
            }
            primaryActionLabel={publishButtonLabel}
            primaryActionTitle={publishDisabledReason ?? undefined}
            selectedDayIndex={selectedDayIndex}
            statusExplanation={`${toolbarDescription} ${statusExplanation}`}
            totalEmployees={totalEmployees}
            viewBadgeLabel={
              isViewMode
                ? 'Vista publicada'
                : permissions.view_scope === 'zone'
                  ? 'Edicion por zona'
                  : 'Semana operativa'
            }
            visibleCount={visibleEmployees.length}
            weekLabel={formatWeekRange(currentSchedule.week_start)}
            zoneFilterLabel={zoneFilterLabel}
          />

          <ScheduleEditorFiltersPanel
            cellTypeFilter={cellTypeFilter}
            displayMode={displayMode}
            employees={editorData.employees}
            maxHoursFilter={maxHoursFilter}
            minHoursFilter={minHoursFilter}
            onCellTypeFilterChange={onCellTypeFilterChange}
            onMaxHoursFilterChange={onMaxHoursFilterChange}
            onMinHoursFilterChange={onMinHoursFilterChange}
            onProblemFilterChange={onProblemFilterChange}
            onRoleFilterChange={onRoleFilterChange}
            onSearchValueChange={onSearchValueChange}
            onZoneFilterChange={onZoneFilterChange}
            problemFilter={problemFilter}
            roleFilter={roleFilter}
            searchValue={searchValue}
            totalEmployees={totalEmployees}
            unassignedCount={unassignedCount}
            zoneFilter={zoneFilter}
            zones={editorData.zones}
          />

          <div className="-mx-1 sm:-mx-2 xl:-mx-3">
            <ScheduleGrid
              allEmployees={editorData.employees}
              config={editorData.config}
              entries={editorData.schedule.schedule_entries}
              isLockedByMe={!isViewMode && Boolean(lockStatus?.acquired)}
              key={currentSchedule.id}
              mode={displayMode}
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
          </div>
        </div>
      </section>

      {!isViewMode ? (
        <ScheduleTemplateDock
          isLockedByMe={!isViewMode && Boolean(lockStatus?.acquired)}
          templates={editorData.shift_templates}
        />
      ) : null}

      <SchedulePdfModal
        employeesCount={pdfEmployees.length}
        isBusy={isBusy}
        onClose={() => setIsPdfModalOpen(false)}
        onConfirm={handleDownloadPdf}
        onScopeChange={setPdfScope}
        open={isViewMode && isPdfModalOpen}
        scopeLabel={selectedPdfScopeLabel}
        scopeOptions={pdfScopeOptions}
        selectedScope={effectivePdfScope}
      />
    </main>
  );
}
