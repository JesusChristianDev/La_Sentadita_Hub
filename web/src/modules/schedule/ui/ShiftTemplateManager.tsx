'use client';

import { Pencil, Plus, ScissorsLineDashed, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button, Notice, Select } from '@/shared/ui';

import type {
  ShiftTemplate,
  ShiftTemplateDraftInput,
  ShiftType,
} from '../domain/scheduleTypes';
import { buildTemplateText } from './scheduleCellHelpers';

type ShiftTemplateManagerProps = {
  canManage: boolean;
  isBusy: boolean;
  onCreateTemplate: (input: ShiftTemplateDraftInput) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onUpdateTemplate: (
    templateId: string,
    input: ShiftTemplateDraftInput,
  ) => Promise<void>;
  templates: ShiftTemplate[];
};

type TemplateEditorState =
  | {
      mode: 'create';
      templateId: null;
    }
  | {
      mode: 'edit';
      templateId: string;
    }
  | null;

type TemplateFormState = {
  end_time: string;
  name: string;
  split_end_time: string;
  split_start_time: string;
  start_time: string;
  type: ShiftType;
};

const EMPTY_FORM: TemplateFormState = {
  end_time: '',
  name: '',
  split_end_time: '',
  split_start_time: '',
  start_time: '',
  type: 'continuous',
};

function toFormState(template: ShiftTemplate | null): TemplateFormState {
  if (!template) return EMPTY_FORM;

  return {
    end_time: template.end_time.slice(0, 5),
    name: template.name,
    split_end_time: template.split_end_time?.slice(0, 5) ?? '',
    split_start_time: template.split_start_time?.slice(0, 5) ?? '',
    start_time: template.start_time.slice(0, 5),
    type: template.type,
  };
}

function toInputPayload(form: TemplateFormState): ShiftTemplateDraftInput {
  return {
    end_time: form.end_time,
    name: form.name.trim(),
    split_end_time: form.type === 'split' ? form.split_end_time || null : null,
    split_start_time: form.type === 'split' ? form.split_start_time || null : null,
    start_time: form.start_time,
    type: form.type,
  };
}

export function ShiftTemplateManager({
  canManage,
  isBusy,
  onCreateTemplate,
  onDeleteTemplate,
  onUpdateTemplate,
  templates,
}: ShiftTemplateManagerProps) {
  const [editorState, setEditorState] = useState<TemplateEditorState>(null);
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);
  const [localError, setLocalError] = useState<string | null>(null);

  const editingTemplate = useMemo(
    () =>
      editorState?.mode === 'edit'
        ? templates.find((template) => template.id === editorState.templateId) ?? null
        : null,
    [editorState, templates],
  );

  const openCreate = () => {
    setEditorState({ mode: 'create', templateId: null });
    setForm(EMPTY_FORM);
    setLocalError(null);
  };

  const openEdit = (template: ShiftTemplate) => {
    setEditorState({ mode: 'edit', templateId: template.id });
    setForm(toFormState(template));
    setLocalError(null);
  };

  const closeEditor = () => {
    setEditorState(null);
    setForm(EMPTY_FORM);
    setLocalError(null);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setLocalError('La plantilla necesita un nombre.');
      return;
    }

    if (!form.start_time || !form.end_time) {
      setLocalError('Debes definir el horario principal.');
      return;
    }

    if (form.type === 'split' && (!form.split_start_time || !form.split_end_time)) {
      setLocalError('El turno partido necesita el segundo tramo completo.');
      return;
    }

    const payload = toInputPayload(form);

    try {
      setLocalError(null);

      if (editorState?.mode === 'edit' && editorState.templateId) {
        await onUpdateTemplate(editorState.templateId, payload);
      } else {
        await onCreateTemplate(payload);
      }

      closeEditor();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'No se pudo guardar.');
    }
  };

  const handleDelete = async (template: ShiftTemplate) => {
    if (!window.confirm(`Eliminar la plantilla "${template.name}"?`)) return;

    try {
      setLocalError(null);
      await onDeleteTemplate(template.id);

      if (editorState?.mode === 'edit' && editorState.templateId === template.id) {
        closeEditor();
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'No se pudo eliminar.');
    }
  };

  return (
    <section className="panel schedule-templates-home-panel stack">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="panel-title">Plantillas de turno</h2>
          <p className="panel-subtitle">
            Crea patrones continuos o partidos para reutilizarlos luego en la edicion
            semanal.
          </p>
        </div>
        {canManage ? (
          <Button disabled={isBusy} onClick={openCreate} variant="secondary">
            <Plus className="h-4 w-4" />
            Nueva plantilla
          </Button>
        ) : null}
      </div>

      {localError ? <Notice tone="error">{localError}</Notice> : null}

      {editorState ? (
        <div className="rounded-[1.6rem] border border-border/70 bg-surface-muted/65 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {editorState.mode === 'edit' ? 'Editar plantilla' : 'Nueva plantilla'}
              </p>
              <p className="mt-1 text-sm text-muted">
                Define el tramo principal y, si hace falta, un segundo tramo para turno
                partido.
              </p>
            </div>
            <Button onClick={closeEditor} variant="secondary">
              <X className="h-4 w-4" />
              Cerrar
            </Button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="field">
              <span className="text-sm font-semibold">Nombre</span>
              <input
                className="input"
                maxLength={80}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Ej. Apertura cocina"
                value={form.name}
              />
            </label>

            <label className="field">
              <span className="text-sm font-semibold">Tipo</span>
              <Select
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    split_end_time:
                      event.target.value === 'split' ? current.split_end_time : '',
                    split_start_time:
                      event.target.value === 'split' ? current.split_start_time : '',
                    type: event.target.value as ShiftType,
                  }))
                }
                value={form.type}
              >
                <option value="continuous">Continuo</option>
                <option value="split">Partido</option>
              </Select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="field">
              <span className="text-sm font-semibold">Inicio</span>
              <input
                className="input"
                onChange={(event) =>
                  setForm((current) => ({ ...current, start_time: event.target.value }))
                }
                type="time"
                value={form.start_time}
              />
            </label>

            <label className="field">
              <span className="text-sm font-semibold">Fin</span>
              <input
                className="input"
                onChange={(event) =>
                  setForm((current) => ({ ...current, end_time: event.target.value }))
                }
                type="time"
                value={form.end_time}
              />
            </label>
          </div>

          {form.type === 'split' ? (
            <div className="mt-4 rounded-[1.35rem] border border-border/70 bg-background/25 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <ScissorsLineDashed className="h-4 w-4 text-accent-strong" />
                Segundo tramo
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="field">
                  <span className="text-sm font-semibold">Inicio tramo 2</span>
                  <input
                    className="input"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        split_start_time: event.target.value,
                      }))
                    }
                    type="time"
                    value={form.split_start_time}
                  />
                </label>

                <label className="field">
                  <span className="text-sm font-semibold">Fin tramo 2</span>
                  <input
                    className="input"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        split_end_time: event.target.value,
                      }))
                    }
                    type="time"
                    value={form.split_end_time}
                  />
                </label>
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button onClick={closeEditor} variant="secondary">
              Cancelar
            </Button>
            <Button disabled={isBusy} onClick={() => void handleSubmit()}>
              {isBusy ? 'Guardando...' : editorState.mode === 'edit' ? 'Guardar cambios' : 'Crear plantilla'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        {templates.length ? (
          templates.map((template) => {
            const isEditing = editingTemplate?.id === template.id;

            return (
              <article
                key={template.id}
                className="rounded-[1.5rem] border border-border/70 bg-surface-muted/55 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">
                        {template.name}
                      </h3>
                      <span className="rounded-full border border-border/70 bg-background/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                        {template.type === 'split' ? 'Partido' : 'Continuo'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{buildTemplateText(template)}</p>
                  </div>

                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={isBusy}
                        onClick={() => openEdit(template)}
                        variant={isEditing ? 'primary' : 'secondary'}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        disabled={isBusy}
                        onClick={() => void handleDelete(template)}
                        variant="danger"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-border bg-surface/40 p-5 text-sm text-muted">
            Aun no hay plantillas. Crea una continua o partida para reutilizarla en la
            edicion del horario.
          </div>
        )}
      </div>
    </section>
  );
}
