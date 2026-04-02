'use client';

import { Bell, CheckCheck, Laptop2, Loader2, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Button, Notice } from '@/shared/ui';

import {
  markNotificationReadAction,
  registerPushDeviceAction,
} from '../application/notificationActions';
import type { NotificationRecord, PushDeviceRecord } from '../domain/notificationTypes';

type NotificationsPageClientProps = {
  canRegisterPushDevice: boolean;
  notifications: NotificationRecord[];
  pushDevices: PushDeviceRecord[];
  unreadCount: number;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

function notificationLabel(notificationType: string) {
  const labels: Record<string, string> = {
    delivery_note_confirmed: 'Albaran confirmado',
    delivery_note_rejected: 'Albaran rechazado',
    delivery_note_submitted: 'Albaran enviado',
    incident_assigned: 'Incidencia asignada',
    incident_created: 'Nueva incidencia',
    incident_resolved: 'Incidencia resuelta',
    incident_status_changed: 'Estado de incidencia',
    password_must_change: 'Cambio de contrasena',
    push_device_registered: 'Dispositivo registrado',
    request_approved: 'Solicitud aprobada',
    request_cancelled: 'Solicitud cancelada',
    request_created: 'Solicitud creada',
    request_in_review: 'Solicitud en revision',
    request_rejected: 'Solicitud rechazada',
    schedule_lock_force_released: 'Bloqueo liberado',
    schedule_published: 'Horario publicado',
    schedule_updated: 'Horario actualizado',
    shift_swap_accepted: 'Cambio de turno aceptado',
    shift_swap_manager_approved: 'Cambio de turno aprobado',
    shift_swap_manager_rejected: 'Cambio de turno rechazado',
    shift_swap_pending_manager: 'Cambio pendiente de gestion',
    shift_swap_rejected: 'Cambio de turno rechazado',
    shift_swap_request: 'Solicitud de cambio de turno',
  };

  return labels[notificationType] ?? notificationType.replaceAll('_', ' ');
}

function NotificationReadButton({ notificationId }: { notificationId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="small"
      variant="secondary"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await markNotificationReadAction(notificationId);
          if (!result.ok) {
            window.alert(result.error);
            return;
          }

          router.refresh();
        });
      }}
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
      Marcar leida
    </Button>
  );
}

function PushDeviceForm({ canRegisterPushDevice }: { canRegisterPushDevice: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);

        startTransition(async () => {
          setErrorMsg(null);
          const result = await registerPushDeviceAction(formData);
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
        <span>Endpoint</span>
        <input
          name="endpoint"
          type="url"
          className="input"
          placeholder="https://push.example.com/..."
          required
        />
      </label>

      <label className="field">
        <span>Clave auth</span>
        <input name="authKey" className="input" placeholder="auth key" required />
      </label>

      <label className="field">
        <span>Clave p256dh</span>
        <input name="p256dh" className="input" placeholder="p256dh" required />
      </label>

      <label className="field">
        <span>Plataforma</span>
        <input name="platform" className="input" placeholder="desktop, mobile..." />
      </label>

      <Button
        type="submit"
        disabled={isPending || !canRegisterPushDevice}
        className="w-full sm:w-fit"
      >
        {isPending ? 'Registrando...' : 'Registrar dispositivo'}
      </Button>
    </form>
  );
}

export function NotificationsPageClient({
  canRegisterPushDevice,
  notifications,
  pushDevices,
  unreadCount,
}: NotificationsPageClientProps) {
  const [tab, setTab] = useState<'notifications' | 'devices'>('notifications');
  const visibleNotifications = useMemo(() => notifications, [notifications]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 lg:p-6">
      <section className="dashboard-message-hero">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
              Bandeja personal
            </p>
            <h1 className="dashboard-message-title">Notificaciones</h1>
            <p className="dashboard-message-body">
              Revisa eventos del sistema, incidencias y confirmaciones operativas.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <article className="meta-item">
              <p className="meta-label">Total</p>
              <p className="meta-value">{visibleNotifications.length}</p>
            </article>
            <article className="meta-item">
              <p className="meta-label">Sin leer</p>
              <p className="meta-value">{unreadCount}</p>
            </article>
            <article className="meta-item">
              <p className="meta-label">Dispositivos</p>
              <p className="meta-value">{pushDevices.length}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-border/70 bg-surface-muted/60 text-cyan-300">
            <Bell className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="panel-title">Control de notificaciones</h2>
            <p className="panel-subtitle">
              Tus avisos quedan agrupados aqui con soporte para lectura y push devices.
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-border/50 pb-1">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === 'notifications'
                ? 'bg-accent/15 text-foreground'
                : 'text-muted hover:bg-surface-muted/50 hover:text-foreground'
            }`}
            onClick={() => setTab('notifications')}
          >
            Notificaciones
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === 'devices'
                ? 'bg-accent/15 text-foreground'
                : 'text-muted hover:bg-surface-muted/50 hover:text-foreground'
            }`}
            onClick={() => setTab('devices')}
          >
            Dispositivos
          </button>
        </div>

        {tab === 'notifications' ? (
          <div className="grid gap-3">
            {visibleNotifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-surface-muted/30 p-8 text-center text-muted">
                No tienes notificaciones todavia.
              </div>
            ) : (
              visibleNotifications.map((notification) => {
                const isUnread = notification.read_at === null;
                return (
                  <article
                    key={notification.notification_id}
                    className={`rounded-2xl border p-4 transition ${
                      isUnread
                        ? 'border-cyan-500/20 bg-cyan-500/5'
                        : 'border-border/50 bg-surface-muted/25'
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-border/60 bg-surface-muted/50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                            {notificationLabel(notification.notification_type)}
                          </span>
                          <span className="rounded-full border border-border/60 bg-surface-muted/50 px-2.5 py-1 text-xs text-muted">
                            {notification.delivery_type}
                          </span>
                          {isUnread ? (
                            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">
                              Sin leer
                            </span>
                          ) : null}
                        </div>

                        <p className="text-sm text-muted">
                          {notification.entity_type}
                          {notification.entity_id ? ` - ${notification.entity_id}` : ''}
                        </p>

                        <p className="text-sm text-foreground">{formatDate(notification.created_at)}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {isUnread ? (
                          <NotificationReadButton notificationId={notification.notification_id} />
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)]">
            <article className="rounded-3xl border border-border/50 bg-surface-muted/25 p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-border/70 bg-surface-muted/60 text-amber-300">
                  <Smartphone className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Registrar push device</h3>
                  <p className="mt-1 text-sm text-muted">
                    Cada dispositivo queda asociado a tu persona y puede recibir avisos push.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <PushDeviceForm canRegisterPushDevice={canRegisterPushDevice} />
              </div>
            </article>

            <article className="rounded-3xl border border-border/50 bg-surface-muted/25 p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-border/70 bg-surface-muted/60 text-emerald-300">
                  <Laptop2 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Dispositivos activos</h3>
                  <p className="mt-1 text-sm text-muted">
                    El ultimo registro de cada endpoint sirve para depurar entregas push.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {pushDevices.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-surface-muted/30 p-6 text-center text-sm text-muted">
                    No hay dispositivos registrados.
                  </div>
                ) : (
                  pushDevices.map((device) => (
                    <article
                      key={device.push_device_id}
                      className="rounded-2xl border border-border/50 bg-background/40 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {device.platform ?? 'Plataforma desconocida'}
                          </p>
                          <p className="mt-1 break-all text-xs text-muted">{device.endpoint}</p>
                        </div>
                        <span className="rounded-full border border-border/60 bg-surface-muted/50 px-2.5 py-1 text-xs text-muted">
                          {formatDate(device.last_seen_at)}
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </article>
          </div>
        )}
      </section>
    </div>
  );
}
