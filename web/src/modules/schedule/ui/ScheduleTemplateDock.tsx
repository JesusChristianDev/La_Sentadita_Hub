'use client';

import { Check, Copy, Grip, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ShiftTemplate } from '../domain/scheduleTypes';
import { buildTemplateText } from './scheduleCellHelpers';

type ScheduleTemplateDockProps = {
  isLockedByMe: boolean;
  templates: ShiftTemplate[];
};

export function ScheduleTemplateDock({
  isLockedByMe,
  templates,
}: ScheduleTemplateDockProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedTemplateId) return;

    const timeoutId = window.setTimeout(() => {
      setCopiedTemplateId(null);
    }, 1400);

    return () => window.clearTimeout(timeoutId);
  }, [copiedTemplateId]);

  async function handleCopy(template: ShiftTemplate) {
    try {
      await navigator.clipboard.writeText(buildTemplateText(template));
      setCopiedTemplateId(template.id);
    } catch {
      setCopiedTemplateId(null);
    }
  }

  if (!templates.length) return null;

  return (
    <aside className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-4 z-50 w-[min(22rem,calc(100vw-1.5rem))] md:bottom-6 md:right-6">
      <section className="rounded-[1.4rem] border border-border/80 bg-[linear-gradient(180deg,rgba(28,29,34,0.98)_0%,rgba(15,16,19,0.99)_100%)] shadow-[0_28px_70px_-32px_rgba(0,0,0,0.9)] backdrop-blur">
        <button
          aria-expanded={!isCollapsed}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          onClick={() => setIsCollapsed((value) => !value)}
          type="button"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">Plantillas de turno</p>
            <p className="mt-1 text-xs text-muted">
              Click para copiar. {isLockedByMe ? 'Arrastra para aplicar.' : 'Entra en edicion para arrastrar.'}
            </p>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/20 text-muted">
            {isCollapsed ? (
              <PanelRightOpen className="h-4 w-4" />
            ) : (
              <PanelRightClose className="h-4 w-4" />
            )}
          </span>
        </button>

        {isCollapsed ? null : (
          <div className="grid max-h-[50dvh] gap-2 overflow-y-auto border-t border-border/70 px-3 py-3">
            {templates.map((template) => {
              const text = buildTemplateText(template);
              const isCopied = copiedTemplateId === template.id;

              return (
                <button
                  key={template.id}
                  className="rounded-[1.15rem] border border-border/70 bg-surface-muted/70 px-3 py-3 text-left transition-colors hover:border-accent/40 hover:bg-surface-muted"
                  draggable={isLockedByMe}
                  onClick={() => {
                    void handleCopy(template);
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      'application/x-schedule-template-text',
                      text,
                    );
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {template.name}
                      </span>
                      <span className="mt-1 block text-sm text-muted">{text}</span>
                    </div>
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/20 text-muted">
                      {isCopied ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-muted">
                    <span>{isCopied ? 'Copiada' : 'Copiar'}</span>
                    {isLockedByMe ? (
                      <span className="inline-flex items-center gap-1">
                        <Grip className="h-3.5 w-3.5" />
                        Arrastrar
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </aside>
  );
}
