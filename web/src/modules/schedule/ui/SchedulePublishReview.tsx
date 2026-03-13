'use client';

import { ArrowLeft, CalendarDays, MessageSquare, Send, Users } from 'lucide-react';

type SchedulePublishReviewProps = {
  affectedEmployees: number;
  comment: string;
  isPublishing: boolean;
  isRepublish: boolean;
  onBack: () => void;
  onCommentChange: (value: string) => void;
  onConfirm: () => void;
  rangeLabel: string;
  weekLabel: string;
};

export function SchedulePublishReview({
  affectedEmployees,
  comment,
  isPublishing,
  isRepublish,
  onBack,
  onCommentChange,
  onConfirm,
  rangeLabel,
  weekLabel,
}: SchedulePublishReviewProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="app-shell schedule-shell stack rise-in"
    >
      <section className="page-intro schedule-page-intro">
        <div>
          <h1 className="page-title">
            {isRepublish ? 'Revisar republicacion' : 'Revisar publicacion'}
          </h1>
          <p className="subtitle">
            Confirma la semana, valida el impacto y deja contexto para el equipo si hace
            falta.
          </p>
        </div>
        <button className="button secondary" onClick={onBack} type="button">
          <ArrowLeft className="h-4 w-4" />
          Volver al editor
        </button>
      </section>

      <section className="panel schedule-review-panel stack">
        <div className="schedule-review-summary rounded-[1.75rem] border border-border/70 bg-surface-muted/40 p-4 sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex w-fit items-center rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
                {isRepublish ? 'Republicacion' : 'Publicacion inicial'}
              </span>
              <div>
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {weekLabel}
                </p>
                <p className="mt-2 text-sm text-muted">{rangeLabel}</p>
              </div>
            </div>
            <div className="rounded-[1.35rem] border border-border/70 bg-background/30 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                Impacto
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {affectedEmployees}
              </p>
              <p className="mt-1 text-sm text-muted">empleados afectados</p>
            </div>
          </div>
        </div>

        <div className="schedule-review-grid grid gap-3 md:grid-cols-2">
          <article className="rounded-[1.5rem] border border-border/70 bg-surface-muted/70 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Semana</p>
            <div className="mt-3 flex items-start gap-3">
              <CalendarDays className="mt-1 h-5 w-5 text-accent-strong" />
              <div>
                <p className="font-semibold text-foreground">{weekLabel}</p>
                <p className="text-sm text-muted">{rangeLabel}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-border/70 bg-surface-muted/70 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">
              Impacto de la publicacion
            </p>
            <div className="mt-3 flex items-start gap-3">
              <Users className="mt-1 h-5 w-5 text-accent-strong" />
              <div>
                <p className="font-semibold text-foreground">
                  {affectedEmployees} empleado(s) afectados
                </p>
                <p className="text-sm text-muted">
                  {isRepublish
                    ? 'Se avisara solo a quienes hayan cambiado respecto a la ultima version.'
                    : 'La primera publicacion avisa a todos los empleados con horario.'}
                </p>
              </div>
            </div>
          </article>
        </div>

        <label className="field">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="h-4 w-4 text-accent-strong" />
            Comentario opcional
          </span>
          <textarea
            className="input min-h-36 resize-y"
            maxLength={500}
            name="publishComment"
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Anade un comentario para esta publicacion si necesitas contexto extra."
            value={comment}
          />
          <span className="text-xs text-muted">{comment.length}/500 caracteres</span>
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <p className="text-sm text-muted">
            {isRepublish
              ? 'Solo se notificara a quienes tengan cambios respecto a la ultima version.'
              : 'La primera publicacion avisara a todo el equipo con horario asignado.'}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="button secondary" onClick={onBack} type="button">
              Seguir revisando
            </button>
            <button
              className="button gap-2"
              disabled={isPublishing}
              onClick={onConfirm}
              type="button"
            >
              <Send className="h-4 w-4" />
              {isPublishing
                ? 'Publicando...'
                : isRepublish
                  ? 'Confirmar republicacion'
                  : 'Confirmar publicacion'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
