import { NextResponse } from 'next/server';
import { z } from 'zod';

import { reviewShiftSwapRequest } from '@/modules/requests';

const managerReviewSchema = z.object({
  approve: z.boolean(),
});

type Params = {
  params: Promise<{
    shiftSwapRequestId: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const { shiftSwapRequestId } = await params;
  const payload = managerReviewSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_SHIFT_SWAP_REVIEW_PAYLOAD', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await reviewShiftSwapRequest(shiftSwapRequestId, payload.data.approve),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SHIFT_SWAP_REVIEW_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
