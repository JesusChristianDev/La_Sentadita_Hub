import { createSupabaseAdminClient } from '@/shared/supabase/admin';

import type { Schedule, ScheduleWithEntries } from '../domain/scheduleTypes';

type PublishScheduleInput = {
  actorUserId: string;
  affectedEmployeeIds: string[];
  comment?: string;
  schedule: ScheduleWithEntries;
};

type PublishEventRow = {
  id: string;
  published_at: string;
};

export async function publishScheduleWeek(
  input: PublishScheduleInput,
): Promise<Schedule> {
  const supabase = createSupabaseAdminClient();
  const fallbackPublishedAt = new Date().toISOString();

  if (input.schedule.schedule_entries.length === 0) {
    throw new Error('PUBLISH_VALIDATION_ERROR: El horario no tiene celdas.');
  }
  let publishEvent: PublishEventRow | null = null;

  const { data: publishEventData, error: eventError } = await supabase
    .from('schedule_publish_events')
    .insert({
      prev_published_at: input.schedule.published_at ?? null,
      published_by: input.actorUserId,
      schedule_id: input.schedule.id,
    })
    .select('id, published_at')
    .single();

  if (eventError) {
    console.error('Failed to create schedule_publish_event', eventError);
  } else {
    publishEvent = (publishEventData ?? null) as PublishEventRow | null;
  }

  const publishedAt = publishEvent?.published_at ?? fallbackPublishedAt;
  const { data: updated, error: updateError } = await supabase
    .from('schedules')
    .update({
      published_at: publishedAt,
      published_by: input.actorUserId,
      status: 'published',
      updated_at: publishedAt,
    })
    .eq('id', input.schedule.id)
    .select()
    .single();

  if (updateError) {
    if (publishEvent?.id) {
      await supabase.from('schedule_publish_events').delete().eq('id', publishEvent.id);
    }
    throw updateError;
  }

  if (input.affectedEmployeeIds.length > 0) {
    const isUpdate = Boolean(input.schedule.published_at);
    const title = isUpdate ? 'Horario actualizado' : 'Nuevo horario publicado';
    const suffix = input.comment?.trim()
      ? ` Comentario: ${input.comment.trim()}`
      : '';
    const body = `Se publico tu horario de la semana ${input.schedule.week_start}.${suffix}`;

    const outboxPayload = input.affectedEmployeeIds.map((employeeId) => ({
      body,
      employee_id: employeeId,
      publish_event_id: publishEvent?.id ?? null,
      schedule_id: input.schedule.id,
      title,
    }));

    const { error: outboxError } = await supabase
      .from('notification_outbox')
      .upsert(outboxPayload, { onConflict: 'publish_event_id,employee_id' });

    if (outboxError) {
      console.error('Failed to insert notification_outbox rows', outboxError);
    }
  }

  return updated as Schedule;
}
