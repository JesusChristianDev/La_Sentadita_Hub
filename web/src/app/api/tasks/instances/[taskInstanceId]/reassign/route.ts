import { NextResponse } from 'next/server';
import { z } from 'zod';

import { reassignTaskInstance } from '@/modules/tasks';

const reassignTaskInstanceSchema = z.object({
  assignedEmployeeId: z.string().uuid().optional().nullable(),
  assignedRole: z.string().optional().nullable(),
  assignedZoneId: z.string().uuid().optional().nullable(),
  reason: z.enum([
    'employment_change',
    'request_conflict',
    'shift_swap',
    'manual_reassignment_required',
  ]),
});

type Params = {
  params: Promise<{
    taskInstanceId: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const { taskInstanceId } = await params;
  const payload = reassignTaskInstanceSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_TASK_REASSIGN_PAYLOAD', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await reassignTaskInstance({ ...payload.data, taskInstanceId }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TASK_REASSIGN_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
