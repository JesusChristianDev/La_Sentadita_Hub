import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createIncident, listVisibleIncidents } from '@/modules/incidents';

const createIncidentSchema = z.object({
  category: z.enum([
    'operational',
    'maintenance',
    'hygiene',
    'customer',
    'security',
    'stock',
    'technology',
    'personnel',
  ]),
  description: z.string().min(1),
  restaurantId: z.string().uuid(),
  sensitivity: z.enum(['normal', 'restricted']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).nullable().optional(),
  title: z.string().min(1),
  zoneId: z.string().uuid().optional().nullable(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get('restaurantId');

  if (!restaurantId) {
    return NextResponse.json({ error: 'MISSING_RESTAURANT_ID' }, { status: 400 });
  }

  try {
    return NextResponse.json(await listVisibleIncidents(restaurantId));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INCIDENTS_LIST_FAILED';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const payload = createIncidentSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_INCIDENT_PAYLOAD', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await createIncident(payload.data), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INCIDENT_CREATE_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
