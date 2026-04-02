import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  createScheduleDraftAction,
  forceUnlockScheduleAction,
  loadEmployeeScheduleWeekAction,
  loadPublishedScheduleDataAction,
  loadScheduleDataAction,
  loadScheduleHomeAction,
  lockScheduleAction,
  publishScheduleAction,
  unlockScheduleAction,
} from '@/modules/schedule/application/serverActions';

import { jsonError } from '../_routeUtils';

const homeQuerySchema = z.object({
  restaurantId: z.string().uuid().optional().nullable(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  view: z.enum(['home', 'draft', 'published', 'employee']).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = homeQuerySchema.safeParse({
    restaurantId: url.searchParams.get('restaurantId') || null,
    view: url.searchParams.get('view') ?? 'home',
    weekStart: url.searchParams.get('weekStart') || null,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_SCHEDULE_QUERY', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.view === 'draft') {
      if (!parsed.data.restaurantId || !parsed.data.weekStart) {
        return NextResponse.json({ error: 'MISSING_SCHEDULE_PARAMS' }, { status: 400 });
      }
      return NextResponse.json(
        await loadScheduleDataAction(parsed.data.restaurantId, parsed.data.weekStart),
      );
    }

    if (parsed.data.view === 'published') {
      if (!parsed.data.restaurantId || !parsed.data.weekStart) {
        return NextResponse.json({ error: 'MISSING_SCHEDULE_PARAMS' }, { status: 400 });
      }
      return NextResponse.json(
        await loadPublishedScheduleDataAction(parsed.data.restaurantId, parsed.data.weekStart),
      );
    }

    if (parsed.data.view === 'employee') {
      if (!parsed.data.weekStart) {
        return NextResponse.json({ error: 'MISSING_SCHEDULE_PARAMS' }, { status: 400 });
      }
      return NextResponse.json(
        await loadEmployeeScheduleWeekAction(parsed.data.weekStart, parsed.data.restaurantId ?? undefined),
      );
    }

    return NextResponse.json(await loadScheduleHomeAction(parsed.data.restaurantId ?? undefined));
  } catch (error) {
    return jsonError('SCHEDULE_QUERY_FAILED', 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create-draft'),
    restaurantId: z.string().uuid().optional().nullable(),
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    action: z.literal('lock'),
    scheduleId: z.string().min(1),
  }),
  z.object({
    action: z.literal('unlock'),
    scheduleId: z.string().min(1),
  }),
  z.object({
    action: z.literal('force-unlock'),
    scheduleId: z.string().min(1),
  }),
  z.object({
    action: z.literal('publish'),
    comment: z.string().optional().nullable(),
    scheduleId: z.string().min(1),
  }),
]);

export async function POST(request: Request) {
  const payload = actionSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json(
      { error: 'INVALID_SCHEDULE_ACTION', issues: payload.error.issues },
      { status: 400 },
    );
  }

  try {
    switch (payload.data.action) {
      case 'create-draft':
        return NextResponse.json(
          await createScheduleDraftAction(
            payload.data.weekStart,
            payload.data.restaurantId ?? undefined,
          ),
          { status: 201 },
        );
      case 'lock':
        return NextResponse.json(await lockScheduleAction(payload.data.scheduleId));
      case 'unlock':
        await unlockScheduleAction(payload.data.scheduleId);
        return NextResponse.json({ ok: true });
      case 'force-unlock':
        await forceUnlockScheduleAction(payload.data.scheduleId);
        return NextResponse.json({ ok: true });
      case 'publish':
        return NextResponse.json(
          await publishScheduleAction(payload.data.scheduleId, payload.data.comment ?? undefined),
        );
    }
  } catch (error) {
    return jsonError('SCHEDULE_ACTION_FAILED', 400, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
