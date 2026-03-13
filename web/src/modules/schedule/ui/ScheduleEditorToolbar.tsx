'use client';

import { ArrowLeft, CalendarDays, Download, LayoutGrid, Send } from 'lucide-react';

import { Button, Select } from '@/shared/ui';

import type {
  ScheduleDayOption,
  ScheduleDisplayMode,
  ScheduleGridHealth,
} from './scheduleUiModels';

type ScheduleEditorToolbarProps = {
  canManagePublish: boolean;
  dayOptions: ScheduleDayOption[];
  displayMode: ScheduleDisplayMode;
  effectiveStatusLabel: string;
  gridHealth: ScheduleGridHealth;
  isBackReady: boolean;
  isBusy: boolean;
  isViewMode: boolean;
  lockLabel: string;
  onBack: () => void;
  onDisplayModeChange: (value: ScheduleDisplayMode) => void;
  onOpenPdfModal: () => void;
  onReviewPublish: () => void;
  onSelectedDayIndexChange: (value: number) => void;
  primaryActionDisabled: boolean;
  primaryActionLabel: string;
  primaryActionTitle?: string;
  selectedDayIndex: number;
  statusExplanation: string;
  totalEmployees: number;
  viewBadgeLabel: string;
  visibleCount: number;
  weekLabel: string;
  zoneFilterLabel: string;
  changesLabel?: string;
};

export function ScheduleEditorToolbar({
  canManagePublish,
  dayOptions,
  displayMode,
  effectiveStatusLabel,
  gridHealth,
  isBackReady,
  isBusy,
  isViewMode,
  lockLabel,
  onBack,
  onDisplayModeChange,
  onOpenPdfModal,
  onReviewPublish,
  onSelectedDayIndexChange,
  primaryActionDisabled,
  primaryActionLabel,
  primaryActionTitle,
  selectedDayIndex,
  statusExplanation,
  totalEmployees,
  viewBadgeLabel,
  visibleCount,
  weekLabel,
  zoneFilterLabel,
  changesLabel,
}: ScheduleEditorToolbarProps) {
  return (
    <div className="schedule-week-hero rounded-[1.4rem] border border-border/70 bg-surface-muted/35 p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`inline-flex h-9 items-center gap-2 rounded-full border border-border/70 bg-background/25 px-3 text-sm font-medium text-muted transition hover:border-border hover:text-foreground ${
                isBackReady ? '' : 'pointer-events-none opacity-55'
              }`}
              onClick={onBack}
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
              Horarios
            </button>
            <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
              {viewBadgeLabel}
            </span>
            <span className="rounded-full border border-border/70 bg-background/25 px-3 py-1 text-xs text-muted">
              {zoneFilterLabel}
            </span>
          </div>

          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-[1.8rem]">
              {weekLabel}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Mostrando {visibleCount} de {totalEmployees} personas. {statusExplanation}
            </p>
          </div>
        </div>

        <div className="w-full xl:max-w-[35rem]">
          <div className="rounded-[1.2rem] border border-border/70 bg-background/22 p-3.5 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="rounded-full border border-border/70 bg-background/35 px-3 py-1 text-sm font-semibold text-foreground">
                  {effectiveStatusLabel}
                </span>
                {!isViewMode ? (
                  <span className="text-sm text-muted">{lockLabel}</span>
                ) : null}
                <span
                  className={`text-sm font-medium ${
                    gridHealth.emptyCount > 0 ? 'text-foreground' : 'text-muted'
                  }`}
                >
                  {gridHealth.emptyCount} pendientes
                </span>
                <span
                  className={`text-sm font-medium ${
                    gridHealth.invalidCount > 0 ? 'text-rose-200' : 'text-muted'
                  }`}
                >
                  {gridHealth.invalidCount} errores
                </span>
                {!isViewMode && changesLabel ? (
                  <span className="text-sm text-muted">{changesLabel}</span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-full border border-border/70 bg-background/25 p-1">
                  <button
                    className={
                      displayMode === 'week'
                        ? 'hidden items-center gap-2 rounded-full bg-accent px-3.5 py-2 text-sm font-semibold text-background md:inline-flex'
                        : 'hidden items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground md:inline-flex'
                    }
                    onClick={() => onDisplayModeChange('week')}
                    type="button"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Semana
                  </button>
                  <button
                    className={
                      displayMode === 'day'
                        ? 'inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-2 text-sm font-semibold text-background'
                        : 'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground'
                    }
                    onClick={() => onDisplayModeChange('day')}
                    type="button"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Dia
                  </button>
                </div>

                {displayMode === 'day' ? (
                  <Select
                    className="min-w-44 sm:min-w-52"
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
                ) : null}

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {isViewMode ? (
                    <Button disabled={isBusy} onClick={onOpenPdfModal}>
                      <Download className="h-4 w-4" />
                      Descargar PDF
                    </Button>
                  ) : null}
                  {!isViewMode && canManagePublish ? (
                    <Button
                      disabled={primaryActionDisabled}
                      onClick={onReviewPublish}
                      title={primaryActionTitle}
                    >
                      <Send className="h-4 w-4" />
                      {primaryActionLabel}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
