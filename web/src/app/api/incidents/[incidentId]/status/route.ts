import { NextResponse } from 'next/server';
import { z } from 'zod';

import { updateIncidentStatus } from '@/modules/incidents';

const incidentStatusSchema = z.object({
  status: z.enum(['reported', 'in_review', 'resolved', 'closed']),
});

type Params = {
  params: Promise<{
    incidentId: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const { incidentId } = await params;
  const payload = incidentStatusSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_INCIDENT_STATUS_PAYLOAD', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await updateIncidentStatus(incidentId, payload.data.status));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INCIDENT_STATUS_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
