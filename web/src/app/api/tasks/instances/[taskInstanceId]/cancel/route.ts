import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cancelTaskInstance } from '@/modules/tasks';

const cancelSchema = z.object({
  reason: z.enum(['schedule_change', 'employment_change', 'template_deactivated', 'manual_cancel']),
});

type Params = {
  params: Promise<{
    taskInstanceId: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const { taskInstanceId } = await params;
  const payload = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_TASK_CANCEL_PAYLOAD', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await cancelTaskInstance(taskInstanceId, payload.data.reason));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TASK_CANCEL_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
