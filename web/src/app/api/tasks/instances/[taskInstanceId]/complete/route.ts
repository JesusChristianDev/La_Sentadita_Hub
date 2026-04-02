import { NextResponse } from 'next/server';

import { completeTaskInstance } from '@/modules/tasks';

type Params = {
  params: Promise<{
    taskInstanceId: string;
  }>;
};

export async function POST(_: Request, { params }: Params) {
  const { taskInstanceId } = await params;

  try {
    return NextResponse.json(await completeTaskInstance(taskInstanceId));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TASK_COMPLETE_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
