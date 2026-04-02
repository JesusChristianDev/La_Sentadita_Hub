import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  createTaskTemplate,
  listTaskTemplates,
} from '@/modules/tasks';

const createTaskTemplateSchema = z.object({
  confirmationEmployeeId: z.string().uuid().optional().nullable(),
  confirmationMode: z.string().optional().nullable(),
  confirmationRole: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  dueRule: z.string().min(1),
  plannableInSchedule: z.boolean().optional(),
  recurrenceType: z.string().min(1),
  requiresConfirmation: z.boolean().optional(),
  restaurantId: z.string().uuid(),
  title: z.string().min(1),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get('restaurantId');

  if (!restaurantId) {
    return NextResponse.json({ error: 'MISSING_RESTAURANT_ID' }, { status: 400 });
  }

  try {
    return NextResponse.json(await listTaskTemplates(restaurantId));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TASK_TEMPLATES_LIST_FAILED';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const payload = createTaskTemplateSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_TASK_TEMPLATE_PAYLOAD', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await createTaskTemplate(payload.data), {
      status: 201,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TASK_TEMPLATE_CREATE_FAILED';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
