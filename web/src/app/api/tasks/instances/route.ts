import { NextResponse } from 'next/server';

import {
  createTaskInstance,
  listTaskInstances,
} from '@/modules/tasks';
import { CreateTaskInstanceSchema } from '@/modules/tasks/domain/taskSchemas';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get('restaurantId');
  const taskDate = url.searchParams.get('taskDate') ?? undefined;

  if (!restaurantId) {
    return NextResponse.json({ error: 'MISSING_RESTAURANT_ID' }, { status: 400 });
  }

  try {
    return NextResponse.json(await listTaskInstances(restaurantId, taskDate));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TASKS_LIST_FAILED';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const payload = CreateTaskInstanceSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_TASK_INSTANCE_PAYLOAD', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await createTaskInstance(payload.data), {
      status: 201,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TASK_CREATE_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
