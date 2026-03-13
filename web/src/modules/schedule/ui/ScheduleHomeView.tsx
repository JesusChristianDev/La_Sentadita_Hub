'use client';

import { CalendarDays, Clock3, Eye, PencilLine, Plus } from 'lucide-react';

import { Button, Notice, Select } from '@/shared/ui';

import type {
  ScheduleHomePayload,
  ScheduleWeekSummary,
  ShiftTemplateDraftInput,
} from '../domain/scheduleTypes';
import {
  formatWeekRange,
  type NoticeState,
  statusLabel,
  summarizeIssues,
} from './scheduleEditorHelpers';
import { ShiftTemplateManager } from './ShiftTemplateManager';

type ScheduleHomeViewProps = {
  busyLabel: string | null;
  homeData: ScheduleHomePayload;
  isMobileManagerExperience: boolean;
  isBusy: boolean;
  notice: NoticeState;
  onCreateTemplate: (input: ShiftTemplateDraftInput) => Promise<void>;
  onCreateWeek: (weekStart: string) => void;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onEditTemplate: (templateId: string, input: ShiftTemplateDraftInput) => Promise<void>;
  onEditWeek: (weekStart: string) => void;
  onHistoryWeek: (weekStart: string) => void;
  onViewWeek: (weekStart: string) => void;
  onWeekPickerChange: (value: string) => void;
  weekPickerValue: string;
};

type WeekPrimaryAction = {
  icon: typeof Plus | typeof PencilLine | typeof Eye;
  kind: 'create' | 'edit' | 'view';
  label: string;
};

type WeekSecondaryAction = {
  icon: typeof PencilLine | typeof Eye;
  kind: 'edit' | 'view';
  label: string;
};

function getWeekPrimaryAction(week: ScheduleWeekSummary): WeekPrimaryAction {
  if (week.status === 'missing') {
    return {
      icon: Plus,
      kind: 'create',
      label: 'Crear horario',
    };
  }

  if (week.status === 'published') {
    return {
      icon: Eye,
      kind: 'view',
      label: 'Ver horario',
    };
  }

  return {
    icon: PencilLine,
    kind: 'edit',
    label: 'Editar horario',
  };
}

function getWeekSecondaryAction(
  week: ScheduleWeekSummary,
): WeekSecondaryAction | null {
  if (week.status === 'missing') return null;

  if (week.status === 'published') {
    return {
      icon: PencilLine,
      kind: 'edit',
      label: 'Editar horario',
    };
  }

  if (week.has_published_version) {
    return {
      icon: Eye,
      kind: 'view',
      label: 'Ver horario',
    };
  }

  return null;
}

function getWeekSummary(week: ScheduleWeekSummary): string {
  if (week.status === 'missing') {
    return 'Todavia no existe horario para esta semana.';
  }

  if (week.status === 'published') {
    return 'Horario publicado sin cambios pendientes.';
  }

  if (week.has_published_version) {
    return 'Hay una version publicada y un borrador con cambios pendientes.';
  }

  if (!week.needs_review) {
    return 'Borrador listo para revisar o publicar.';
  }

  return summarizeIssues({
    empty_cells: week.missing_cells,
    empty_keys: [],
    invalid_cells: week.validation_issues,
    invalid_keys: [],
  });
}

export function ScheduleHomeView({
  busyLabel,
  homeData,
  isMobileManagerExperience,
  isBusy,
  notice,
  onCreateTemplate,
  onCreateWeek,
  onDeleteTemplate,
  onEditTemplate,
  onEditWeek,
  onHistoryWeek,
  onViewWeek,
  onWeekPickerChange,
  weekPickerValue,
}: ScheduleHomeViewProps) {
  const selectedHistoryWeek =
    homeData.history_weeks.find((week) => week.week_start === weekPickerValue)?.week_start ??
    homeData.history_weeks[0]?.week_start ??
    '';

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="app-shell app-shell--workspace schedule-shell stack rise-in"
    >
      <section className="page-intro schedule-page-intro">
        <div>
          <h1 className="page-title">Horarios</h1>
          <p className="subtitle">
            {isMobileManagerExperience
              ? 'Revision diaria y cambios puntuales desde el movil.'
              : 'Semanas activas y herramientas reales del modulo.'}
          </p>
        </div>
      </section>

      {notice ? <Notice tone={notice.tone}>{notice.message}</Notice> : null}
      {busyLabel ? <Notice>{busyLabel}</Notice> : null}

      <section className="schedule-home-layout grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,24rem)]">
        <div className="schedule-home-grid grid gap-4 lg:grid-cols-2">
          {[homeData.current_week, homeData.next_week].map((week, index) => {
            const primaryAction = getWeekPrimaryAction(week);
            const secondaryAction = getWeekSecondaryAction(week);
            const EffectivePrimaryIcon = isMobileManagerExperience
              ? week.status === 'missing'
                ? Plus
                : PencilLine
              : primaryAction.icon;
            const primaryLabel = isMobileManagerExperience
              ? week.status === 'missing'
                ? 'Crear borrador'
                : 'Cambios rapidos'
              : primaryAction.label;
            const mobileSecondaryAction =
              week.status === 'published' || week.has_published_version
                ? {
                    icon: Eye,
                    kind: 'view' as const,
                    label: 'Ver publicado',
                  }
                : null;
            const effectiveSecondaryAction = isMobileManagerExperience
              ? mobileSecondaryAction
              : secondaryAction;
            const EffectiveSecondaryIcon = effectiveSecondaryAction?.icon;

            return (
              <article
                key={week.week_start}
                className="schedule-home-card rounded-[2rem] border border-border/75 bg-surface p-5 shadow-sm transition-transform duration-150 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-muted">
                      {index === 0 ? 'Semana actual' : 'Proxima semana'}
                    </p>
                    <h2 className="mt-3 text-xl font-semibold text-foreground">
                      {formatWeekRange(week.week_start)}
                    </h2>
                  </div>
                  <span className="rounded-full border border-border/70 bg-background/30 px-3 py-1 text-xs font-medium text-muted">
                    {statusLabel(week.status)}
                  </span>
                </div>

                <p className="mt-5 text-sm font-medium text-foreground">
                  {getWeekSummary(week)}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {isMobileManagerExperience
                    ? week.status === 'missing'
                      ? 'Prepara el borrador de la semana para poder resolver ajustes desde el movil.'
                      : 'Abre cambios rapidos para corregir turnos puntuales. La planificacion completa se hace en desktop.'
                    : week.status === 'missing'
                      ? 'Crea la semana cuando toque planificarla.'
                      : week.status === 'published'
                        ? 'Puedes revisar la version publicada o abrir una nueva edicion.'
                        : week.has_published_version
                          ? 'Sigue trabajando el borrador o consulta la ultima version publicada.'
                          : 'Continua afinando el borrador compartido.'}
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button
                    disabled={!homeData.permissions.can_manage || isBusy}
                    onClick={() => {
                      if (isMobileManagerExperience && week.status !== 'missing') {
                        onEditWeek(week.week_start);
                        return;
                      }

                      if (primaryAction.kind === 'create') {
                        onCreateWeek(week.week_start);
                        return;
                      }

                      if (primaryAction.kind === 'view') {
                        onViewWeek(week.week_start);
                        return;
                      }

                      onEditWeek(week.week_start);
                    }}
                  >
                    <EffectivePrimaryIcon className="h-4 w-4" />
                    {primaryLabel}
                  </Button>

                  {effectiveSecondaryAction ? (
                    <Button
                      disabled={!homeData.permissions.can_manage || isBusy}
                      onClick={() => {
                        if (effectiveSecondaryAction.kind === 'view') {
                          onViewWeek(week.week_start);
                          return;
                        }

                        onEditWeek(week.week_start);
                      }}
                      variant="secondary"
                    >
                      {EffectiveSecondaryIcon ? (
                        <EffectiveSecondaryIcon className="h-4 w-4" />
                      ) : null}
                      {effectiveSecondaryAction.label}
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <aside className="grid gap-4">
          <section className="panel stack">
            <div>
              <h2 className="panel-title">
                {isMobileManagerExperience ? 'Otras semanas' : 'Historial'}
              </h2>
              <p className="panel-subtitle">
                {isMobileManagerExperience
                  ? 'Consulta otras semanas sin entrar en el editor completo.'
                  : 'Solo muestra semanas ya creadas para no navegar fechas inutiles.'}
              </p>
            </div>

            {homeData.history_weeks.length ? (
              <>
                <label className="field">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <CalendarDays className="h-4 w-4 text-accent-strong" />
                    Semana disponible
                  </span>
                  <Select
                    aria-label="Selecciona una semana del historial"
                    onChange={(event) => onWeekPickerChange(event.target.value)}
                    value={selectedHistoryWeek}
                  >
                    {homeData.history_weeks.map((week) => (
                      <option key={week.week_start} value={week.week_start}>
                        {week.range_label}
                      </option>
                    ))}
                  </Select>
                </label>

                <Button
                  disabled={
                    !homeData.permissions.can_manage || !selectedHistoryWeek || isBusy
                  }
                  onClick={() => onHistoryWeek(selectedHistoryWeek)}
                  variant="secondary"
                >
                  <Clock3 className="h-4 w-4" />
                  {isMobileManagerExperience ? 'Abrir semana' : 'Ir a semana'}
                </Button>
              </>
            ) : (
              <p className="rounded-[1.4rem] border border-dashed border-border bg-background/20 p-4 text-sm text-muted">
                Aun no hay semanas adicionales creadas fuera de la actual y la proxima.
              </p>
            )}
          </section>
        </aside>
      </section>

      {!isMobileManagerExperience ? (
        <ShiftTemplateManager
          canManage={homeData.permissions.can_manage_templates}
          isBusy={isBusy}
          onCreateTemplate={onCreateTemplate}
          onDeleteTemplate={onDeleteTemplate}
          onUpdateTemplate={onEditTemplate}
          templates={homeData.shift_templates}
        />
      ) : null}
    </main>
  );
}
