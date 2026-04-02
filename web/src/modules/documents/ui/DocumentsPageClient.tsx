'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useMemo, useState, useTransition } from 'react';

import { Button } from '@/shared/ui';

import type { DocumentOwnerTarget, DocumentsPageViewModel } from '../application/buildDocumentsPageViewModel';
import type { DocumentRecord, DocumentType, DocumentVisibility } from '../domain/documentTypes';

type Props = DocumentsPageViewModel;

const DOCUMENT_TYPE_OPTIONS: Array<{ label: string; value: DocumentType }> = [
  { label: 'Contrato laboral', value: 'employment_contract' },
  { label: 'Anexo contractual', value: 'contract_addendum' },
  { label: 'Nomina', value: 'payroll' },
  { label: 'Documento de identidad', value: 'identity_document' },
  { label: 'Certificado medico', value: 'medical_certificate' },
  { label: 'Justificacion de ausencia', value: 'absence_justification' },
  { label: 'Politica interna', value: 'policy_document' },
  { label: 'Informe interno', value: 'internal_report' },
  { label: 'Albaran', value: 'delivery_note' },
];

const VISIBILITY_OPTIONS: Array<{ label: string; value: DocumentVisibility }> = [
  { label: 'Visible para empleado', value: 'employee_visible' },
  { label: 'Visible para gestion', value: 'management_visible' },
  { label: 'Solo gestion restringida', value: 'restricted_management' },
  { label: 'Solo administracion', value: 'administrative_only' },
];

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  }).then(async (response) => {
    const payload = (await response.json().catch(() => null)) as T | null;
    if (!response.ok) {
      throw new Error((payload as { error?: string } | null)?.error ?? 'REQUEST_FAILED');
    }
    return payload as T;
  });
}

function patchJson<T>(url: string): Promise<T> {
  return fetch(url, { method: 'PATCH' }).then(async (response) => {
    const payload = (await response.json().catch(() => null)) as T | null;
    if (!response.ok) {
      throw new Error((payload as { error?: string } | null)?.error ?? 'REQUEST_FAILED');
    }
    return payload as T;
  });
}

function ownerTargetLabel(target: DocumentOwnerTarget): string {
  return `${target.ownerType} - ${target.description}`;
}

function documentTypeLabel(value: DocumentType): string {
  return (
    DOCUMENT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

function visibilityLabel(value: DocumentVisibility): string {
  return (
    VISIBILITY_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

function statusBadge(value: DocumentRecord['document_status']): string {
  switch (value) {
    case 'active':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'superseded':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    case 'archived':
      return 'border-slate-500/30 bg-slate-500/10 text-slate-200';
    default:
      return 'border-border bg-surface text-foreground';
  }
}

function fmtDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value));
}

export function DocumentsPageClient(props: Props) {
  const {
    activeScopeLabel,
    canArchiveDocument,
    canCreateDocument,
    canSupersedeDocument,
    createDefaults,
    documents,
    mode,
    ownerTargets,
    summary,
  } = props;

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const defaultOwnerTarget = useMemo(() => ownerTargets[0] ?? null, [ownerTargets]);
  const [ownerTargetValue, setOwnerTargetValue] = useState(
    defaultOwnerTarget ? `${defaultOwnerTarget.ownerType}:${defaultOwnerTarget.ownerId}` : '',
  );
  const [documentType, setDocumentType] = useState(createDefaults.documentType);
  const [visibility, setVisibility] = useState(createDefaults.visibility);
  const [requiresReauth, setRequiresReauth] = useState(createDefaults.requiresReauth);
  const [fileUrl, setFileUrl] = useState('');
  const [replacementDocumentId, setReplacementDocumentId] = useState('');

  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null);

  const ownerTarget = useMemo(() => {
    if (!ownerTargetValue) return defaultOwnerTarget;
    const [ownerType, ownerId] = ownerTargetValue.split(':');
    return ownerTargets.find(
      (target) => target.ownerType === ownerType && target.ownerId === ownerId,
    ) ?? defaultOwnerTarget;
  }, [defaultOwnerTarget, ownerTargetValue, ownerTargets]);

  const replacementTarget = useMemo(
    () => documents.find((document) => document.document_id === replacementDocumentId) ?? null,
    [documents, replacementDocumentId],
  );

  const refreshWithMessage = (message: string) => {
    setFeedback(message);
    router.refresh();
  };

  const submitDocument = () => {
    if (!ownerTarget) {
      setFeedback('Selecciona un destino valido para el documento.');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          documentType,
          fileUrl,
          ownerId: ownerTarget.ownerId,
          ownerType: ownerTarget.ownerType,
          requiresReauth,
          visibility,
        };

        if (replacementTarget) {
          await postJson<{ next: DocumentRecord; previous: DocumentRecord }>(
            `/api/documents/${replacementTarget.document_id}`,
            payload,
          );
          setReplacementDocumentId('');
          refreshWithMessage('Documento versionado.');
          return;
        }

        await postJson<{ document: DocumentRecord }>('/api/documents', payload);
        refreshWithMessage('Documento creado.');
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'No se pudo guardar el documento.');
      }
    });
  };

  const archiveDocument = (documentId: string) => {
    startTransition(async () => {
      try {
        setArchiveBusyId(documentId);
        await patchJson<{ document: DocumentRecord }>(`/api/documents/${documentId}`);
        refreshWithMessage('Documento archivado.');
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'No se pudo archivar el documento.');
      } finally {
        setArchiveBusyId(null);
      }
    });
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Contexto" value={activeScopeLabel} />
        <Stat label="Documentos" value={String(summary.total)} />
        <Stat label="Activos" value={String(summary.active)} />
        <Stat label="Archivados" value={String(summary.archived + summary.superseded)} />
      </section>

      {feedback ? (
        <div className="rounded-2xl border border-border bg-surface/70 px-4 py-3 text-sm text-foreground">
          {feedback}
        </div>
      ) : null}

      {mode === 'forbidden' ? (
        <div className="rounded-3xl border border-border/60 bg-surface/70 p-6 text-sm text-muted">
          No tienes acceso a documentos en este contexto.
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="Documentos visibles"
          description="Documentos ordenados por fecha de creacion y filtrados por tu alcance."
        >
          <DataTable
            emptyLabel="No hay documentos visibles."
            headers={[
              'Tipo',
              'Destino',
              'Visibilidad',
              'Estado',
              'Version',
              'Reauth',
              'Creado',
              'Archivo',
              'Acciones',
            ]}
            rows={documents.map((document) => [
              documentTypeLabel(document.document_type),
              ownerLabel(document, ownerTargets),
              visibilityLabel(document.visibility),
              <span
                key={`${document.document_id}-status`}
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadge(document.document_status)}`}
                >
                  {document.document_status}
                </span>,
              `v${document.version}`,
              document.requires_reauth ? 'Si' : 'No',
              fmtDate(document.created_at),
              <a
                key={`${document.document_id}-file`}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                href={document.file_url}
                rel="noreferrer"
                target="_blank"
              >
                Abrir
              </a>,
              canArchiveDocument ? (
                <div key={`${document.document_id}-actions`} className="flex flex-wrap gap-2">
                  <Button
                    disabled={isPending || archiveBusyId === document.document_id}
                    type="button"
                    variant="secondary"
                    onClick={() => archiveDocument(document.document_id)}
                  >
                    Archivar
                  </Button>
                </div>
              ) : (
                <span key={`${document.document_id}-locked`} className="text-xs text-muted">
                  Solo lectura
                </span>
              ),
            ])}
          />
        </Panel>

        <Panel
          title={canSupersedeDocument ? 'Nuevo documento o nueva version' : 'Nuevo documento'}
          description="Crea documentos personales, de empleo o de restaurante segun tu alcance."
        >
          {canCreateDocument ? (
            <form
              className="grid gap-3 rounded-3xl border border-border/70 bg-background/50 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                submitDocument();
              }}
            >
              <label className="grid gap-1 text-sm">
                <span className="text-muted">Destino</span>
                <select
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  value={ownerTargetValue}
                  onChange={(event) => setOwnerTargetValue(event.target.value)}
                  required
                >
                  {ownerTargets.map((target) => (
                    <option key={target.value} value={target.value}>
                      {ownerTargetLabel(target)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-muted">Tipo de documento</span>
                <select
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value as DocumentType)}
                >
                  {DOCUMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-muted">Visibilidad</span>
                <select
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as DocumentVisibility)}
                >
                  {VISIBILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-muted">URL del archivo</span>
                <input
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                  onChange={(event) => setFileUrl(event.target.value)}
                  required
                  value={fileUrl}
                />
              </label>

              {canSupersedeDocument ? (
                <label className="grid gap-1 text-sm">
                  <span className="text-muted">Sustituye a (opcional)</span>
                  <select
                    className="rounded-2xl border border-border bg-background px-3 py-2 text-foreground"
                    value={replacementDocumentId}
                    onChange={(event) => setReplacementDocumentId(event.target.value)}
                  >
                    <option value="">Crear documento nuevo</option>
                    {documents
                      .filter((document) => document.document_status === 'active')
                      .map((document) => (
                        <option key={document.document_id} value={document.document_id}>
                          {documentTypeLabel(document.document_type)} - v{document.version}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}

              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  checked={requiresReauth}
                  onChange={(event) => setRequiresReauth(event.target.checked)}
                  type="checkbox"
                />
                Requiere reautenticacion
              </label>

              <Button disabled={isPending} type="submit">
                {replacementTarget ? 'Guardar nueva version' : 'Crear documento'}
              </Button>
            </form>
          ) : (
            <div className="rounded-3xl border border-border/70 bg-background/50 p-4 text-sm text-muted">
              No tienes permisos para crear documentos desde este contexto.
            </div>
          )}

          <div className="mt-4 rounded-3xl border border-border/70 bg-surface/50 p-4">
            <h3 className="text-sm font-semibold text-foreground">Destinos disponibles</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {ownerTargets.map((target) => (
                <span
                  key={target.value}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted"
                >
                  {ownerTargetLabel(target)}
                </span>
              ))}
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function ownerLabel(document: DocumentRecord, ownerTargets: DocumentOwnerTarget[]): string {
  const match = ownerTargets.find(
    (target) => target.ownerId === document.owner_id && target.ownerType === document.owner_type,
  );

  if (match) {
    return ownerTargetLabel(match);
  }

  return `${document.owner_type} · ${document.owner_id.slice(0, 8)}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-border bg-surface/70 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </article>
  );
}

function Panel({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-surface/70 p-4 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.6)]">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

function DataTable({
  headers,
  rows,
  emptyLabel,
}: {
  headers: string[];
  rows: ReactNode[][];
  emptyLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="py-8 text-center text-sm text-muted">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
