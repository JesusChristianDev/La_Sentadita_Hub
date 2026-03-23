import 'server-only';

import { AUDIT_ACTIONS, writeAuditLog } from '@/modules/audit';
import { getCurrentUserContext } from '@/modules/auth_users';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import type {
  NotificationRecord,
  NotifyPersonInput,
  PushDeviceRecord,
  RegisterPushDeviceInput,
} from '../domain/notificationTypes';

type NotificationInsertRow = Pick<
  NotificationRecord,
  'delivery_type' | 'entity_id' | 'entity_type' | 'notification_type' | 'recipient_user_id'
>;

type NotificationOutboxInsertRow = {
  body: string;
  employee_id: string;
  entity_id: string | null;
  entity_type: string;
  max_attempts: number;
  notification_type: NotificationRecord['notification_type'];
  recipient_person_id: string;
  send_after: string;
  title: string;
};

async function getRequiredCurrentUserContext() {
  const ctx = await getCurrentUserContext();
  if (!ctx) {
    throw new Error('Unauthorized');
  }

  return ctx;
}

export async function listMyNotifications(limit = 50): Promise<NotificationRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('notifications')
    .select(
      'notification_id, recipient_user_id, notification_type, entity_type, entity_id, delivery_type, created_at, read_at',
    )
    .eq('recipient_user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list notifications: ${error.message}`);
  }

  return (data ?? []) as NotificationRecord[];
}

export async function listMyPushDevices(): Promise<PushDeviceRecord[]> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('push_devices')
    .select(
      'push_device_id, person_id, endpoint, p256dh, auth_key, platform, last_seen_at, created_at',
    )
    .eq('person_id', ctx.userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list push devices: ${error.message}`);
  }

  return (data ?? []) as PushDeviceRecord[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const readAt = new Date().toISOString();
  const { data, error } = await admin
    .from('notifications')
    .update({ read_at: readAt })
    .eq('notification_id', notificationId)
    .eq('recipient_user_id', ctx.userId)
    .select('notification_id')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }

  if (!data) {
    throw new Error('NOTIFICATION_NOT_FOUND: La notificacion no existe o no es tuya.');
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.notificationRead,
    entityId: notificationId,
    entityType: 'notification',
    scopeId: ctx.requestContext.effectiveRestaurantId,
    scopeType: ctx.requestContext.effectiveRestaurantId ? 'restaurant' : null,
    traceId: ctx.requestContext.traceId,
  });
}

export async function notifyPerson(input: NotifyPersonInput): Promise<void> {
  const admin = createSupabaseAdminClient();
  const notificationPayload: NotificationInsertRow = {
    delivery_type: 'in_app',
    entity_id: input.entityId ?? null,
    entity_type: input.entityType,
    notification_type: input.notificationType,
    recipient_user_id: input.recipientPersonId,
  };

  const { data, error } = await admin
    .from('notifications')
    .insert(notificationPayload)
    .select('notification_id')
    .single();

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.notificationCreated,
    entityId: data.notification_id,
    entityType: 'notification',
    newValue: notificationPayload,
    scopeId: input.scopeId ?? null,
    scopeType: input.scopeType ?? null,
    traceId: input.traceId ?? null,
  });

  if (!input.sendPush) {
    return;
  }

  const outboxPayload: NotificationOutboxInsertRow = {
    body: input.body?.trim() || 'Tienes una nueva notificacion en La Sentadita Hub.',
    employee_id: input.recipientPersonId,
    entity_id: input.entityId ?? null,
    entity_type: input.entityType,
    max_attempts: input.maxAttempts ?? 5,
    notification_type: input.notificationType,
    recipient_person_id: input.recipientPersonId,
    send_after: input.sendAfter ?? new Date().toISOString(),
    title: input.title?.trim() || 'Nueva notificacion',
  };

  const { error: outboxError } = await admin.from('notification_outbox').insert(outboxPayload);
  if (outboxError) {
    throw new Error(`Failed to queue notification push: ${outboxError.message}`);
  }

  await writeAuditLog({
    action: AUDIT_ACTIONS.notificationSent,
    entityId: data.notification_id,
    entityType: 'notification',
    newValue: outboxPayload,
    scopeId: input.scopeId ?? null,
    scopeType: input.scopeType ?? null,
    traceId: input.traceId ?? null,
  });
}

export async function notifyPeople(input: NotifyPersonInput[]): Promise<void> {
  for (const notification of input) {
    await notifyPerson(notification);
  }
}

export async function registerPushDevice(
  input: RegisterPushDeviceInput,
): Promise<PushDeviceRecord> {
  const ctx = await getRequiredCurrentUserContext();
  const admin = createSupabaseAdminClient();
  const payload = {
    auth_key: input.authKey,
    endpoint: input.endpoint,
    last_seen_at: new Date().toISOString(),
    p256dh: input.p256dh,
    person_id: ctx.userId,
    platform: input.platform ?? null,
  };

  const { data, error } = await admin
    .from('push_devices')
    .upsert(payload, { onConflict: 'endpoint' })
    .select(
      'push_device_id, person_id, endpoint, p256dh, auth_key, platform, last_seen_at, created_at',
    )
    .single();

  if (error) {
    throw new Error(`Failed to register push device: ${error.message}`);
  }

  await notifyPerson({
    body: 'Tu dispositivo ya puede recibir notificaciones push.',
    entityId: data.push_device_id,
    entityType: 'push_device',
    notificationType: 'push_device_registered',
    recipientPersonId: ctx.userId,
    scopeId: ctx.requestContext.effectiveRestaurantId,
    scopeType: ctx.requestContext.effectiveRestaurantId ? 'restaurant' : null,
    title: 'Push activado',
    traceId: ctx.requestContext.traceId,
  });

  return data as PushDeviceRecord;
}
