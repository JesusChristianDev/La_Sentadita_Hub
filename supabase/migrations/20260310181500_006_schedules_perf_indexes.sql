begin;

-- ============================================================
-- 006_schedules_perf_indexes
-- Adds covering indexes for schedule-related foreign keys and
-- the support tables touched by the schedule module.
-- ============================================================

create index if not exists idx_profiles_zone_id
  on public.profiles (zone_id);

create index if not exists idx_area_leads_user_id
  on public.area_leads (user_id);

create index if not exists idx_area_leads_assigned_by
  on public.area_leads (assigned_by);

create index if not exists idx_era_restaurant_id
  on public.employee_restaurant_assignments (restaurant_id);

create index if not exists idx_era_assigned_by
  on public.employee_restaurant_assignments (assigned_by);

create index if not exists idx_shift_templates_restaurant_id
  on public.shift_templates (restaurant_id);

create index if not exists idx_schedules_created_by
  on public.schedules (created_by);

create index if not exists idx_schedules_published_by
  on public.schedules (published_by);

create index if not exists idx_schedule_config_updated_by
  on public.schedule_config (updated_by);

create index if not exists idx_schedule_locks_locked_by
  on public.schedule_locks (locked_by);

create index if not exists idx_schedule_lock_logs_locked_by
  on public.schedule_lock_logs (locked_by);

create index if not exists idx_schedule_lock_logs_released_by
  on public.schedule_lock_logs (released_by);

create index if not exists idx_schedule_entries_shift_template_id
  on public.schedule_entries (shift_template_id);

create index if not exists idx_schedule_entries_zone_id
  on public.schedule_entries (zone_id);

create index if not exists idx_schedule_entry_logs_changed_by
  on public.schedule_entry_logs (changed_by);

create index if not exists idx_schedule_entry_logs_previous_zone_id
  on public.schedule_entry_logs (previous_zone_id);

create index if not exists idx_schedule_entry_logs_new_zone_id
  on public.schedule_entry_logs (new_zone_id);

create index if not exists idx_schedule_entry_logs_previous_shift_template_id
  on public.schedule_entry_logs (previous_shift_template_id);

create index if not exists idx_schedule_entry_logs_new_shift_template_id
  on public.schedule_entry_logs (new_shift_template_id);

create index if not exists idx_schedule_entry_adjustments_adjusted_by
  on public.schedule_entry_adjustments (adjusted_by);

create index if not exists idx_schedule_entry_adjustments_previous_zone_id
  on public.schedule_entry_adjustments (previous_zone_id);

create index if not exists idx_schedule_entry_adjustments_new_zone_id
  on public.schedule_entry_adjustments (new_zone_id);

create index if not exists idx_schedule_entry_adjustments_previous_shift_template_id
  on public.schedule_entry_adjustments (previous_shift_template_id);

create index if not exists idx_schedule_entry_adjustments_new_shift_template_id
  on public.schedule_entry_adjustments (new_shift_template_id);

create index if not exists idx_schedule_publish_events_published_by
  on public.schedule_publish_events (published_by);

create index if not exists idx_notification_outbox_employee_id
  on public.notification_outbox (employee_id);

create index if not exists idx_notification_outbox_schedule_id
  on public.notification_outbox (schedule_id);

commit;
