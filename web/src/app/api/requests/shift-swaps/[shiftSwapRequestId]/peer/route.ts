import { NextResponse } from 'next/server';
import { z } from 'zod';

import { respondToShiftSwapPeer } from '@/modules/requests';

const peerResponseSchema = z.object({
  accept: z.boolean(),
});

type Params = {
  params: Promise<{
    shiftSwapRequestId: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const { shiftSwapRequestId } = await params;
  const payload = peerResponseSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_SHIFT_SWAP_PEER_PAYLOAD', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await respondToShiftSwapPeer(shiftSwapRequestId, payload.data.accept),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SHIFT_SWAP_PEER_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
