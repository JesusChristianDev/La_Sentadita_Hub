'use client';

import { addWeeks, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';

import { Button, Notice } from '@/shared/ui';

import type { EmployeeScheduleWeekView } from '../domain/scheduleTypes';
import {
  formatWeekRange,
  getEmployeeDayTone,
  type NoticeState,
  parseScheduleLocalDate,
  toWeekStartIso,
} from './scheduleEditorHelpers';

type ScheduleEmployeeViewProps = {
  actorName: string;
  currentWeekStart: string;
  employeeWeek: EmployeeScheduleWeekView | null;
  isBusy: boolean;
  notice: NoticeState;
  onLoadEmployeeWeek: (weekStart: string) => void;
  onWeekPickerChange: (value: string) => void;
  weekPickerValue: string;
};

export function ScheduleEmployeeView({
  actorName,
  currentWeekStart,
  employeeWeek,
  isBusy,
  notice,
  onLoadEmployeeWeek,
  onWeekPickerChange,
  weekPickerValue,
}: ScheduleEmployeeViewProps) {
  const shownWeek = employeeWeek?.week_start ?? currentWeekStart;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="app-shell app-shell--workspace schedule-shell stack rise-in"
    >
      <section className="page-intro schedule-page-intro">
        <div>
          <h1 className="page-title">Mi horario</h1>
          <p className="subtitle">Vista publicada para {actorName}.</p>
        </div>
        <div className="panel-actions">
          <input
            className="input w-auto min-w-44"
            onChange={(event) => onWeekPickerChange(event.target.value)}
            type="date"
            value={weekPickerValue}
          />
          <Button
            onClick={() => onLoadEmployeeWeek(toWeekStartIso(weekPickerValue))}
            variant="secondary"
          >
            <CalendarDays className="h-4 w-4" />
            Ir a semana
          </Button>
        </div>
      </section>

      {notice ? <Notice tone={notice.tone}>{notice.message}</Notice> : null}
      {isBusy ? <Notice>Cargando horario publicado...</Notice> : null}

      <section className="panel schedule-employee-panel stack overflow-hidden">
        <div className="schedule-employee-summary rounded-[1.75rem] border border-border/70 bg-surface-muted/40 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex w-fit items-center rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
                Semana publicada
              </span>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {formatWeekRange(shownWeek)}
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {employeeWeek?.status === 'published' ? 'Publicado' : 'Sin publicar'}{' '}
                  para {actorName}.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  onLoadEmployeeWeek(
                    format(addWeeks(parseScheduleLocalDate(shownWeek), -1), 'yyyy-MM-dd'),
                  )
                }
                variant="secondary"
              >
                Historial
              </Button>
              <Button
                onClick={() => onLoadEmployeeWeek(currentWeekStart)}
                variant="secondary"
              >
                Semana actual
              </Button>
            </div>
          </div>
        </div>

        <div className="schedule-employee-days grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(employeeWeek?.days ?? []).map((day) => {
            const date = parseScheduleLocalDate(day.date);

            return (
              <article
                key={day.date}
                className={`rounded-[1.5rem] border p-4 shadow-sm transition-transform duration-150 hover:-translate-y-0.5 ${getEmployeeDayTone(
                  day.day_type,
                )}`}
              >
                <p className="text-[11px] uppercase tracking-[0.26em] text-muted">
                  {format(date, 'EEEE', { locale: es })}
                </p>
                <p className="mt-3 text-base font-semibold text-foreground">
                  {day.shift_text}
                </p>
                <p className="mt-2 text-sm text-muted">Fecha: {format(date, 'dd/MM')}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
