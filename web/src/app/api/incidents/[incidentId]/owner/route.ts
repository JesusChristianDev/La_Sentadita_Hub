import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assignIncidentOwner } from '@/modules/incidents';

const incidentOwnerSchema = z.object({
  ownerPersonId: z.string().min(1),
});

type Params = {
  params: Promise<{
    incidentId: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const { incidentId } = await params;
  const payload = incidentOwnerSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_INCIDENT_OWNER_PAYLOAD', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await assignIncidentOwner(incidentId, payload.data.ownerPersonId));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INCIDENT_OWNER_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
