import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { CreateShiftSwapRequestInput } from '@/modules/requests';
import { createShiftSwapRequest, listMyShiftSwapRequests } from '@/modules/requests';

const createShiftSwapSchema = z.object({
  reason: z.string().optional().nullable(),
  requesterScheduleEntryId: z.string().min(1),
  targetScheduleEntryId: z.string().min(1),
});

export async function GET() {
  try {
    return NextResponse.json(await listMyShiftSwapRequests());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SHIFT_SWAP_LIST_FAILED';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const payload = createShiftSwapSchema.safeParse((await request.json().catch(() => null)) as CreateShiftSwapRequestInput | null);
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_SHIFT_SWAP_PAYLOAD', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await createShiftSwapRequest(payload.data), {
      status: 201,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SHIFT_SWAP_CREATE_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
