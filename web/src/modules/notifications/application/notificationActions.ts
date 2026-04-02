'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { markNotificationRead, registerPushDevice } from './notificationService';

const registerPushDeviceSchema = z.object({
  authKey: z.string().trim().min(1),
  endpoint: z.string().trim().url(),
  p256dh: z.string().trim().min(1),
  platform: z.string().trim().nullable().optional(),
});

export async function markNotificationReadAction(notificationId: string) {
  try {
    await markNotificationRead(notificationId);
    revalidatePath('/notifications');
    revalidatePath('/app');
    return { ok: true as const };
  } catch (error: unknown) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : 'No se pudo marcar la notificacion como leida',
    };
  }
}

export async function registerPushDeviceAction(formData: FormData) {
  const parsed = registerPushDeviceSchema.safeParse({
    authKey: formData.get('authKey'),
    endpoint: formData.get('endpoint'),
    p256dh: formData.get('p256dh'),
    platform: formData.get('platform') || undefined,
  });

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.message };
  }

  try {
    const device = await registerPushDevice(parsed.data);
    revalidatePath('/notifications');
    revalidatePath('/app');
    return { ok: true as const, device };
  } catch (error: unknown) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'No se pudo registrar el dispositivo',
    };
  }
}
