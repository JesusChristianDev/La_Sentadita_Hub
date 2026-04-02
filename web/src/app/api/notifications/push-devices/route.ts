import { z } from 'zod';

import {
  listMyPushDevices,
  registerPushDevice,
  type RegisterPushDeviceInput,
} from '@/modules/notifications';

import { jsonOk, parseJsonBody } from '../../_routeUtils';

const pushDeviceSchema = z.object({
  authKey: z.string().trim().min(1),
  endpoint: z.string().trim().url(),
  p256dh: z.string().trim().min(1),
  platform: z.string().trim().nullable().optional(),
});

export async function GET() {
  const devices = await listMyPushDevices();
  return jsonOk({ devices });
}

export async function POST(request: Request) {
  const body = await parseJsonBody<RegisterPushDeviceInput>(request, pushDeviceSchema);
  const device = await registerPushDevice(body);
  return jsonOk({ device }, { status: 201 });
}
