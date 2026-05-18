'use client';

import { AlertTriangle, Loader2, ShieldAlert, UserCog } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Button, Notice, Select } from '@/shared/ui';

import type { IncidentOwnerOption } from '../application/buildIncidentsPageViewModel';
import {
  assignIncidentOwnerAction,
  createIncidentAction,
  updateIncidentStatusAction,
} from '../application/incidentActions';
import type { IncidentRecord } from '../domain/incidentTypes';

type IncidentZone = {
  id: string;
  name: string;
};

type IncidentsPageClientProps = {
  canCreate: boolean;
  canManage: boolean;
  currentRestaurantId: string;
  currentRestaurantName: string | null;
  incidents: IncidentRecord[];
  ownerOptions: IncidentOwnerOption[];
  zones: IncidentZone[];
};

const categoryLabels: Record<string, string> = {
  customer: 'Cliente',
  hygiene: 'Higiene',
  maintenance: 'Mantenimiento',
  operational: 'Operativa',
  personnel: 'Personal',
  security: 'Seguridad',
  stock: 'Stock',
  technology: 'Tecnologia',
};

const severityLabels: Record<string, string> = {
  critical: 'Critica',
  high: 'Alta',
  low: 'Baja',
  medium: 'Media',
};

const statusLabels: Record<IncidentRecord['status'], string> = {
  closed: 'Cerrada',
  in_review: 'En revision',
  reported: 'Reportada',
  resolved: 'Resuelta',
};

const nextStatuses: IncidentRecord['status'][] = ['in_review', 'resolved', 'closed'];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusTone(status: IncidentRecord['status']) {
  switch (status) {
    case 'reported':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
    case 'in_review':
      return 'border-blue-500/20 bg-blue-500/10 text-blue-200';
    case 'resolved':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';
    case 'closed':
      return 'border-slate-500/20 bg-slate-500/10 text-slate-200';
  }
}

function severityTone(severity: string | null) {
  switch (severity) {
    case 'critical':
      return 'border-red-500/20 bg-red-500/10 text-red-200';
    case 'high':
      return 'border-orange-500/20 bg-orange-500/10 text-orange-200';
    case 'medium':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
    case 'low':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';
    default:
      return 'border-border/60 bg-surface-muted/40 text-muted';
  }
}

function categoryTone(category: string) {
  switch (category) {
    case 'maintenance':
    case 'technology':
      return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200';
    case 'hygiene':
    case 'security':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-200';
    case 'customer':
      return 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200';
    default:
      return 'border-border/60 bg-surface-muted/40 text-muted';
  }
}

function IncidentStatusButtons({
  incidentId,
  status,
}: {
  incidentId: string;
  status: IncidentRecord['status'];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2">
      {nextStatuses
        .filter((nextStatus) => nextStatus !== status)
        .map((nextStatus) => (
          <Button
            key={nextStatus}
            size="small"
            variant="secondary"
            disabled={isPending}
            onClick={() => {
              const formData = new FormData();
              formData.append('incidentId', incidentId);
              formData.append('status', nextStatus);

              startTransition(async () => {
                const result = await updateIncidentStatusAction(formData);
                if (!result.ok) {
                  console.error('Failed to update incident status', result.error);
                  return;
                }

                router.refresh();
              });
            }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {statusLabels[nextStatus]}
          </Button>
        ))}
    </div>
  );
}

function IncidentOwnerForm({
  incidentId,
  ownerOptions,
}: {
  incidentId: string;
  ownerOptions: IncidentOwnerOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  if (ownerOptions.length === 0) {
    return null;
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        formData.set('incidentId', incidentId);

        startTransition(async () => {
          setErrorMsg(null);
          const result = await assignIncidentOwnerAction(formData);
          if (!result.ok) {
            setErrorMsg(result.error);
            return;
          }

          form.reset();
          router.refresh();
        });
      }}
    >
      <label className="sr-only" htmlFor={`owner-${incidentId}`}>
        Responsable
      </label>
      <Select
        id={`owner-${incidentId}`}
        name="ownerPersonId"
        defaultValue=""
        className="h-10 min-w-[15rem]"
      >
        <option value="" disabled>
          Responsable...
        </option>
        {ownerOptions.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.label} · {owner.role}
          </option>
        ))}
      </Select>
      <Button size="small" variant="secondary" type="submit" disabled={isPending}>
        <UserCog className="h-4 w-4" />
        Asignar
      </Button>
      {errorMsg ? <Notice tone="error">{errorMsg}</Notice> : null}
    </form>
  );
}

function IncidentCreateCard({
  canCreate,
  currentRestaurantId,
  zones,
}: {
  canCreate: boolean;
  currentRestaurantId: string;
  zones: IncidentZone[];
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canCreate) {
          return;
        }

        const form = event.currentTarget;
        const formData = new FormData(form);
        formData.set('restaurantId', currentRestaurantId);

        startTransition(async () => {
          setErrorMsg(null);
          const result = await createIncidentAction(formData);
          if (!result.ok) {
            setErrorMsg(result.error);
            return;
          }

          form.reset();
          router.refresh();
        });
      }}
    >
      {errorMsg ? <Notice tone="error">{errorMsg}</Notice> : null}

      <label className="field">
        <span>Titulo</span>
        <input name="title" className="input" placeholder="Ej. Fuga en lavavajillas" required />
      </label>

      <label className="field">
        <span>Descripcion</span>
        <textarea
          name="description"
          className="input min-h-[6rem]"
          placeholder="Describe lo ocurrido con el maximo contexto posible."
          required
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">
          <span>Categoria</span>
          <Select name="category" defaultValue="operational" required>
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </label>

        <label className="field">
          <span>Zona</span>
          <Select name="zoneId" defaultValue="">
            <option value="">Sin zona</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="field">
          <span>Severidad</span>
          <Select name="severity" defaultValue="">
            <option value="">Sin priorizar</option>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="critical">Critica</option>
          </Select>
        </label>

        <label className="field">
          <span>Sensibilidad</span>
          <Select name="sensitivity" defaultValue="normal">
            <option value="normal">Normal</option>
            <option value="restricted">Restringida</option>
          </Select>
        </label>
      </div>

      <Button type="submit" disabled={isPending || !canCreate} className="w-full sm:w-fit">
        {isPending ? 'Creando...' : 'Crear incidencia'}
      </Button>
    </form>
  );
}

export function IncidentsPageClient({
  canCreate,
  canManage,
  currentRestaurantId,
  currentRestaurantName,
  incidents,
  ownerOptions,
  zones,
}: IncidentsPageClientProps) {
  const counts = useMemo(
    () =>
      incidents.reduce(
        (acc, incident) => {
          acc.all += 1;
          acc[incident.status] += 1;
          return acc;
        },
        {
          all: 0,
          closed: 0,
          in_review: 0,
          reported: 0,
          resolved: 0,
        },
      ),
    [incidents],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 lg:p-6">
      <section className="dashboard-message-hero">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300/80">
              Operacion de incidencias
            </p>
            <h2 className="dashboard-message-title">Incidencias</h2>
            <p className="dashboard-message-body">
              {currentRestaurantName
                ? `Gestiona incidencias del restaurante ${currentRestaurantName}.`
                : 'Gestiona incidencias del restaurante activo.'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="meta-item">
              <p className="meta-label">Total</p>
              <p className="meta-value">{counts.all}</p>
            </article>
            <article className="meta-item">
              <p className="meta-label">Reportadas</p>
              <p className="meta-value">{counts.reported}</p>
            </article>
            <article className="meta-item">
              <p className="meta-label">En revision</p>
              <p className="meta-value">{counts.in_review}</p>
            </article>
            <article className="meta-item">
              <p className="meta-label">Resueltas</p>
              <p className="meta-value">{counts.resolved}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <article className="panel stack">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-border/70 bg-surface-muted/60 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="panel-title">Nueva incidencia</h2>
              <p className="panel-subtitle">
                Registra una incidencia con contexto, categoria y zona opcional.
              </p>
            </div>
          </div>

          <IncidentCreateCard
            canCreate={canCreate}
            currentRestaurantId={currentRestaurantId}
            zones={zones}
          />
        </article>

        <article className="panel stack">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-border/70 bg-surface-muted/60 text-cyan-300">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="panel-title">Bandeja operativa</h2>
              <p className="panel-subtitle">
                Las incidencias se ordenan por fecha de creacion, de mas reciente a mas antigua.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/50">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-surface-muted/50 text-xs uppercase tracking-[0.18em] text-muted">
                <tr>
                  <th className="px-4 py-3">Titulo</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Zona</th>
                  <th className="px-4 py-3">Severidad</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted">
                      No hay incidencias para mostrar.
                    </td>
                  </tr>
                ) : (
                  incidents.map((incident) => (
                    <tr
                      key={incident.incident_id}
                      className="align-top transition hover:bg-surface-muted/30"
                    >
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{incident.title}</p>
                          <p className="line-clamp-2 max-w-[30rem] text-xs text-muted">
                            {incident.description}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${categoryTone(incident.category)}`}
                        >
                          {categoryLabels[incident.category] ?? incident.category}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(incident.status)}`}
                        >
                          {statusLabels[incident.status]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-muted">
                        {incident.zone_id ?? 'Sin zona'}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityTone(incident.severity)}`}
                        >
                          {incident.severity ? severityLabels[incident.severity] : 'Sin severidad'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-muted">{formatDate(incident.created_at)}</td>
                      <td className="px-4 py-4">
                        {canManage ? (
                          <div className="flex flex-col gap-3">
                            <IncidentStatusButtons
                              incidentId={incident.incident_id}
                              status={incident.status}
                            />
                            <IncidentOwnerForm
                              incidentId={incident.incident_id}
                              ownerOptions={ownerOptions}
                            />
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-muted">
            Vista sobre {zones.length} zona{zones.length === 1 ? '' : 's'} disponible
            {canManage ? ', con acciones de gestion activas.' : '.'}
          </p>
        </article>
      </section>
    </div>
  );
}
