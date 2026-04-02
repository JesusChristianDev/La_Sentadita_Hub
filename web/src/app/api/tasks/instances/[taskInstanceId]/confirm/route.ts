import { NextResponse } from 'next/server';
import { z } from 'zod';

import { confirmTaskInstance } from '@/modules/tasks';

const confirmSchema = z.object({
  note: z.string().optional().nullable(),
});

type Params = {
  params: Promise<{
    taskInstanceId: string;
  }>;
};

export async function POST(request: Request, { params }: Params) {
  const { taskInstanceId } = await params;
  const payload = confirmSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_TASK_CONFIRM_PAYLOAD', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await confirmTaskInstance(taskInstanceId, payload.data.note));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TASK_CONFIRM_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
