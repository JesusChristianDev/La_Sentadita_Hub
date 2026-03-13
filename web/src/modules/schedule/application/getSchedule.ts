import type { ScheduleWithEntries } from '../domain/scheduleTypes';
import {
  createScheduleRecord,
  getScheduleByWeek,
} from '../infrastructure/scheduleRepository';

export async function getSchedule(
  restaurantId: string,
  weekStart: string,
): Promise<ScheduleWithEntries | null> {
  const schedule = await getScheduleByWeek(restaurantId, weekStart);
  if (!schedule) return null;

  return {
    ...schedule,
    schedule_entries: schedule.schedule_entries ?? [],
  };
}

export async function ensureScheduleDraft(
  restaurantId: string,
  weekStart: string,
  userId: string,
): Promise<ScheduleWithEntries> {
  const existing = await getSchedule(restaurantId, weekStart);
  if (existing) return existing;

  return createScheduleRecord(restaurantId, weekStart, userId);
}
