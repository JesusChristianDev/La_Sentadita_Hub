import type { AppRole } from '@/modules/auth_users';
import { createSupabaseAdminClient } from '@/shared/supabase/admin';
import { createSupabaseServerClient } from '@/shared/supabase/server';

import type {
  RestaurantZone,
  Schedule,
  ScheduleConfig,
  ScheduleEntry,
  ScheduleEntryLog,
  ScheduleLock,
  ScheduleWithEntries,
  ShiftTemplate,
  ShiftTemplateDraftInput,
} from '../domain/scheduleTypes';

type ScheduleQueryRow = Schedule & {
  schedule_entries?: ScheduleEntry[] | null;
};

type ScheduleConfigRow = {
  min_shift_duration: string | null;
  min_split_break: string | null;
  timezone: string | null;
};

type EntryGuardRow = {
  date: string;
  day_type: string;
  employee_id: string;
  end_time: string | null;
  id: string;
  schedule_id: string;
  shift_template_id: string | null;
  source: 'manual' | 'auto';
  split_end_time: string | null;
  split_start_time: string | null;
  start_time: string | null;
  version: number;
  zone_id: string | null;
  schedules:
    | {
        id: string;
        restaurant_id: string;
        status: 'draft' | 'published';
        week_start: string;
      }
    | {
        id: string;
        restaurant_id: string;
        status: 'draft' | 'published';
        week_start: string;
      }[]
    | null;
};

type ActiveLockRow = {
  expires_at: string;
  locked_by: string;
};

type LockOwnerProfileRow = {
  id: string;
  is_area_lead: boolean;
  role: AppRole;
  zone_id: string | null;
};

function intervalToMinutes(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;

  const pieces = value.split(':');
  if (pieces.length < 2) return fallback;

  const hours = Number(pieces[0]);
  const minutes = Number(pieces[1]);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
  return Math.max(1, hours * 60 + minutes);
}

function coerceScheduleWithEntries(row: ScheduleQueryRow): ScheduleWithEntries {
  return {
    ...row,
    schedule_entries: row.schedule_entries ?? [],
  };
}

function normalizeScheduleJoin(entry: EntryGuardRow) {
  const schedule = Array.isArray(entry.schedules) ? entry.schedules[0] : entry.schedules;
  return schedule ?? null;
}

function buildUpdateConflictError(message: string) {
  const error = new Error(message) as Error & { code?: string };
  error.code = 'SCHEDULE_UPDATE_CONFLICT';
  return error;
}

export async function getScheduleByWeek(
  restaurantId: string,
  weekStart: string,
): Promise<ScheduleWithEntries | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('schedules')
    .select('*, schedule_entries(*)')
    .eq('restaurant_id', restaurantId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return coerceScheduleWithEntries(data as ScheduleQueryRow);
}

export async function listSchedulesByWeeks(
  restaurantId: string,
  weekStarts: string[],
): Promise<Schedule[]> {
  if (weekStarts.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .in('week_start', weekStarts);

  if (error) throw error;
  return (data ?? []) as Schedule[];
}

export async function listScheduleHistoryWeeks(
  restaurantId: string,
  limit = 20,
): Promise<Schedule[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('week_start', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Schedule[];
}

export async function getScheduleById(scheduleId: string): Promise<Schedule | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', scheduleId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return data as Schedule;
}

export async function getScheduleWithEntriesById(
  scheduleId: string,
): Promise<ScheduleWithEntries | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('schedules')
    .select('*, schedule_entries(*)')
    .eq('id', scheduleId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return coerceScheduleWithEntries(data as ScheduleQueryRow);
}

export async function createScheduleRecord(
  restaurantId: string,
  weekStart: string,
  userId: string,
): Promise<ScheduleWithEntries> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('schedules')
    .insert({
      restaurant_id: restaurantId,
      week_start: weekStart,
      created_by: userId,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw error;

  return {
    ...(data as Schedule),
    schedule_entries: [],
  };
}

export async function markScheduleAsDraft(scheduleId: string): Promise<Schedule> {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('schedules')
    .update({
      status: 'draft',
      updated_at: now,
    })
    .eq('id', scheduleId)
    .select()
    .single();

  if (error) throw error;
  return data as Schedule;
}

export async function listScheduleEntries(scheduleId: string): Promise<ScheduleEntry[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('schedule_entries')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ScheduleEntry[];
}

export async function getEntryWithSchedule(entryId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('schedule_entries')
    .select(
      'id, schedule_id, employee_id, date, day_type, start_time, end_time, split_start_time, split_end_time, zone_id, shift_template_id, source, version, schedules(id, status, restaurant_id, week_start)',
    )
    .eq('id', entryId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const typed = data as EntryGuardRow;
  return {
    date: typed.date,
    day_type: typed.day_type,
    employee_id: typed.employee_id,
    end_time: typed.end_time,
    id: typed.id,
    schedule: normalizeScheduleJoin(typed),
    schedule_id: typed.schedule_id,
    shift_template_id: typed.shift_template_id,
    source: typed.source,
    split_end_time: typed.split_end_time,
    split_start_time: typed.split_start_time,
    start_time: typed.start_time,
    version: typed.version,
    zone_id: typed.zone_id,
  };
}

export async function getEntryByNaturalKey(
  scheduleId: string,
  employeeId: string,
  date: string,
): Promise<ScheduleEntry | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('schedule_entries')
    .select('*')
    .eq('schedule_id', scheduleId)
    .eq('employee_id', employeeId)
    .eq('date', date)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return data as ScheduleEntry;
}

export async function createScheduleEntry(
  entry: Record<string, unknown>,
): Promise<ScheduleEntry> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('schedule_entries')
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return data as ScheduleEntry;
}

export async function upsertScheduleEntries(
  entries: Record<string, unknown>[],
): Promise<ScheduleEntry[]> {
  if (entries.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('schedule_entries')
    .upsert(entries, { onConflict: 'schedule_id,employee_id,date' })
    .select();

  if (error) throw error;
  return (data ?? []) as ScheduleEntry[];
}

export async function updateSingleEntry(
  id: string,
  version: number,
  updates: Record<string, unknown>,
): Promise<ScheduleEntry> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('schedule_entries')
    .update({
      ...updates,
      version: version + 1,
    })
    .eq('id', id)
    .eq('version', version)
    .eq('source', 'manual')
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw buildUpdateConflictError(
      'La celda fue actualizada por otro usuario o es de solo lectura.',
    );
  }

  return data as ScheduleEntry;
}

export async function insertScheduleEntryLog(params: {
  changedBy: string | null;
  changeSource: 'manual' | 'auto';
  next: Partial<ScheduleEntry> | null;
  previous: Partial<ScheduleEntry> | null;
  scheduleEntryId: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('schedule_entry_logs').insert({
    changed_by: params.changedBy,
    change_source: params.changeSource,
    new_day_type: params.next?.day_type ?? null,
    new_end_time: params.next?.end_time ?? null,
    new_shift_template_id: params.next?.shift_template_id ?? null,
    new_split_end_time: params.next?.split_end_time ?? null,
    new_split_start_time: params.next?.split_start_time ?? null,
    new_start_time: params.next?.start_time ?? null,
    new_zone_id: params.next?.zone_id ?? null,
    previous_day_type: params.previous?.day_type ?? null,
    previous_end_time: params.previous?.end_time ?? null,
    previous_shift_template_id: params.previous?.shift_template_id ?? null,
    previous_split_end_time: params.previous?.split_end_time ?? null,
    previous_split_start_time: params.previous?.split_start_time ?? null,
    previous_start_time: params.previous?.start_time ?? null,
    previous_zone_id: params.previous?.zone_id ?? null,
    schedule_entry_id: params.scheduleEntryId,
  });

  if (error) throw error;
}

export async function listScheduleEntryLogs(
  entryIds: string[],
  options?: { upToChangedAt?: string },
): Promise<ScheduleEntryLog[]> {
  if (entryIds.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('schedule_entry_logs')
    .select('*')
    .in('schedule_entry_id', entryIds)
    .order('changed_at', { ascending: false });

  if (options?.upToChangedAt) {
    query = query.lte('changed_at', options.upToChangedAt);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as ScheduleEntryLog[];
}

export async function listShiftTemplates(restaurantId: string): Promise<ShiftTemplate[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('shift_templates')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ShiftTemplate[];
}

export async function createShiftTemplateRecord(
  restaurantId: string,
  input: ShiftTemplateDraftInput,
): Promise<ShiftTemplate> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('shift_templates')
    .insert({
      end_time: input.end_time,
      name: input.name,
      restaurant_id: restaurantId,
      split_end_time: input.split_end_time ?? null,
      split_start_time: input.split_start_time ?? null,
      start_time: input.start_time,
      type: input.type,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ShiftTemplate;
}

export async function updateShiftTemplateRecord(
  templateId: string,
  restaurantId: string,
  input: ShiftTemplateDraftInput,
): Promise<ShiftTemplate> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('shift_templates')
    .update({
      end_time: input.end_time,
      name: input.name,
      split_end_time: input.split_end_time ?? null,
      split_start_time: input.split_start_time ?? null,
      start_time: input.start_time,
      type: input.type,
    })
    .eq('id', templateId)
    .eq('restaurant_id', restaurantId)
    .select()
    .single();

  if (error) throw error;
  return data as ShiftTemplate;
}

export async function deactivateShiftTemplateRecord(
  templateId: string,
  restaurantId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('shift_templates')
    .update({ is_active: false })
    .eq('id', templateId)
    .eq('restaurant_id', restaurantId);

  if (error) throw error;
}

export async function listRestaurantZones(restaurantId: string): Promise<RestaurantZone[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('restaurant_zones')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as RestaurantZone[];
}

export async function getScheduleConfig(restaurantId: string): Promise<ScheduleConfig> {
  const supabase = createSupabaseAdminClient();
  const fallback: ScheduleConfig = {
    min_shift_duration_minutes: 60,
    min_split_break_minutes: 60,
    timezone: 'Europe/Madrid',
  };

  const { data, error } = await supabase
    .from('schedule_config')
    .select('min_shift_duration, min_split_break, timezone')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return fallback;
    throw error;
  }

  if (!data) return fallback;

  const typed = data as ScheduleConfigRow;
  return {
    min_shift_duration_minutes: intervalToMinutes(typed.min_shift_duration, 60),
    min_split_break_minutes: intervalToMinutes(typed.min_split_break, 60),
    timezone: typed.timezone || fallback.timezone,
  };
}

export async function acquireLock(scheduleId: string): Promise<ScheduleLock> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('acquire_schedule_lock', {
    p_schedule_id: scheduleId,
  });

  if (error) throw error;

  const payload = Array.isArray(data) ? data[0] : data;
  if (!payload) return { acquired: false };

  return payload as ScheduleLock;
}

export async function releaseLock(scheduleId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('release_schedule_lock', {
    p_schedule_id: scheduleId,
  });

  if (error) throw error;
}

export async function getActiveScheduleLock(
  scheduleId: string,
): Promise<(ScheduleLock & { locked_by: string | null }) | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('schedule_locks')
    .select('locked_by, expires_at')
    .eq('schedule_id', scheduleId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;

  const typed = data as ActiveLockRow;
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', typed.locked_by)
    .maybeSingle();

  return {
    acquired: false,
    expires_at: typed.expires_at,
    locked_by: typed.locked_by,
    locked_by_name: (profile?.full_name as string | undefined) ?? null,
  };
}

export async function getScheduleLockOwnerActor(
  userId: string,
): Promise<LockOwnerProfileRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, zone_id, is_area_lead')
    .eq('id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;

  return data as LockOwnerProfileRow;
}

export async function forceReleaseLock(scheduleId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('schedule_locks')
    .delete()
    .eq('schedule_id', scheduleId);

  if (error) throw error;
}
