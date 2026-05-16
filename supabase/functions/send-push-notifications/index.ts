import { createClient } from 'jsr:@supabase/supabase-js@2';
// @ts-ignore — npm specifier resolved by Deno at runtime
import webpush from 'npm:web-push@3';

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

type OutboxRow = {
  outbox_id?: string;
  id?: string;
  recipient_person_id: string;
  title: string;
  body: string;
  notification_type: string;
  entity_type: string | null;
  entity_id: string | null;
  restaurant_id: string | null;
  send_after: string;
  max_attempts: number;
  attempts: number;
};

type PushDevice = {
  push_device_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
};

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return new Response(JSON.stringify({ error: 'VAPID not configured' }), { status: 503 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const now = new Date().toISOString();

  // Fetch pending outbox entries
  const { data: outboxRows, error: fetchError } = await supabase
    .from('notification_outbox')
    .select('*')
    .lte('send_after', now)
    .lt('attempts', MAX_ATTEMPTS)
    .is('failed_at', null)
    .order('send_after', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error('[send-push] Fetch error:', fetchError.message);
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  const rows = (outboxRows ?? []) as OutboxRow[];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, skipped: 0 }), { status: 200 });
  }

  // Collect unique recipient IDs
  const recipientIds = [...new Set(rows.map((r) => r.recipient_person_id))];

  // Load all push devices for these recipients in one query
  const { data: devicesData, error: devicesError } = await supabase
    .from('push_devices')
    .select('push_device_id, person_id, endpoint, p256dh, auth_key')
    .in('person_id', recipientIds);

  if (devicesError) {
    console.error('[send-push] Devices error:', devicesError.message);
    return new Response(JSON.stringify({ error: devicesError.message }), { status: 500 });
  }

  const devicesByPerson = new Map<string, PushDevice[]>();
  for (const device of (devicesData ?? []) as Array<PushDevice & { person_id: string }>) {
    const existing = devicesByPerson.get(device.person_id) ?? [];
    existing.push(device);
    devicesByPerson.set(device.person_id, existing);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const rowId = (row as Record<string, unknown>)['outbox_id'] ?? (row as Record<string, unknown>)['id'];
    const devices = devicesByPerson.get(row.recipient_person_id) ?? [];

    if (devices.length === 0) {
      skipped++;
      // No push devices registered — delete this outbox entry to avoid infinite retry
      if (rowId) {
        await supabase.from('notification_outbox').delete().eq('outbox_id', rowId).throwOnError();
      }
      continue;
    }

    const payload = JSON.stringify({
      body: row.body,
      data: {
        entity_id: row.entity_id,
        entity_type: row.entity_type,
        notification_type: row.notification_type,
        restaurant_id: row.restaurant_id,
        url: '/app',
      },
      title: row.title,
    });

    let anySent = false;
    const deadDeviceIds: string[] = [];

    for (const device of devices) {
      const subscription = {
        endpoint: device.endpoint,
        keys: {
          auth: device.auth_key,
          p256dh: device.p256dh,
        },
      };

      try {
        await webpush.sendNotification(subscription, payload);
        anySent = true;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404/410 = subscription expired/invalid — remove device
        if (statusCode === 404 || statusCode === 410) {
          deadDeviceIds.push(device.push_device_id);
        } else {
          console.warn(`[send-push] Push failed for device ${device.push_device_id}:`, err);
        }
      }
    }

    // Remove dead subscriptions
    if (deadDeviceIds.length > 0) {
      await supabase
        .from('push_devices')
        .delete()
        .in('push_device_id', deadDeviceIds);
    }

    if (anySent) {
      sent++;
      // Delete successfully processed outbox entry
      if (rowId) {
        await supabase.from('notification_outbox').delete().eq('outbox_id', rowId);
      }
    } else {
      failed++;
      const newAttempts = (row.attempts ?? 0) + 1;
      if (rowId) {
        await supabase
          .from('notification_outbox')
          .update({
            attempts: newAttempts,
            failed_at: newAttempts >= (row.max_attempts ?? MAX_ATTEMPTS) ? now : null,
            last_attempted_at: now,
          })
          .eq('outbox_id', rowId);
      }
    }
  }

  const result = { failed, sent, skipped };
  console.log('[send-push-notifications]', result);
  return new Response(JSON.stringify(result), { status: 200 });
});
