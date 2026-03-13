begin;

-- ============================================================
-- 004_schedules_security_hardening
-- Tightens schedule-related RLS and fixes mutable search_path
-- warnings on schedule functions.
-- ============================================================

alter table public.area_leads enable row level security;
alter table public.employee_restaurant_assignments enable row level security;
alter table public.schedule_locks enable row level security;

create or replace function public.current_user_zone_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.zone_id
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function public.is_schedule_manager_or_office_for_restaurant(
  p_restaurant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_admin_or_office()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('manager', 'sub_manager')
        and p.restaurant_id = p_restaurant_id
    )
$$;

create or replace function public.is_area_lead_for_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'employee'
      and p.is_area_lead = true
      and p.restaurant_id = p_restaurant_id
      and p.zone_id is not null
  )
$$;

create or replace function public.is_schedule_editor_for_employee(
  p_schedule_id uuid,
  p_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.schedules s
      where s.id = p_schedule_id
        and public.is_schedule_manager_or_office_for_restaurant(s.restaurant_id)
    )
    or exists (
      select 1
      from public.schedules s
      join public.profiles actor
        on actor.id = auth.uid()
      join public.profiles employee
        on employee.id = p_employee_id
      where s.id = p_schedule_id
        and actor.role = 'employee'
        and actor.is_area_lead = true
        and actor.restaurant_id = s.restaurant_id
        and actor.zone_id is not null
        and employee.zone_id = actor.zone_id
    )
$$;

drop policy if exists restaurant_zones_select_authenticated
  on public.restaurant_zones;
create policy restaurant_zones_select_authenticated
  on public.restaurant_zones
  for select
  to authenticated
  using (
    public.is_admin_or_office()
    or restaurant_id = (select public.current_user_restaurant_id())
  );

drop policy if exists restaurant_zones_write_admin_manager
  on public.restaurant_zones;
create policy restaurant_zones_write_admin_manager
  on public.restaurant_zones
  for all
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  )
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

drop policy if exists schedules_select_authenticated
  on public.schedules;
create policy schedules_select_authenticated
  on public.schedules
  for select
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
    or public.is_area_lead_for_restaurant(restaurant_id)
    or (
      status = 'published'
      and restaurant_id = (select public.current_user_restaurant_id())
    )
  );

drop policy if exists schedules_write_admin_manager
  on public.schedules;
create policy schedules_write_admin_manager
  on public.schedules
  for all
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  )
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

drop policy if exists shift_templates_select_authenticated
  on public.shift_templates;
create policy shift_templates_select_authenticated
  on public.shift_templates
  for select
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
    or public.is_area_lead_for_restaurant(restaurant_id)
  );

drop policy if exists shift_templates_write_admin_manager
  on public.shift_templates;
create policy shift_templates_write_admin_manager
  on public.shift_templates
  for all
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  )
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

drop policy if exists schedule_entries_select_authenticated
  on public.schedule_entries;
create policy schedule_entries_select_authenticated
  on public.schedule_entries
  for select
  to authenticated
  using (
    public.is_schedule_editor_for_employee(schedule_id, employee_id)
    or (
      employee_id = auth.uid()
      and exists (
        select 1
        from public.schedules s
        where s.id = schedule_entries.schedule_id
          and s.status = 'published'
          and s.restaurant_id = (select public.current_user_restaurant_id())
      )
    )
  );

drop policy if exists schedule_entries_write_staff
  on public.schedule_entries;
create policy schedule_entries_write_staff
  on public.schedule_entries
  for all
  to authenticated
  using (
    public.is_schedule_editor_for_employee(schedule_id, employee_id)
  )
  with check (
    public.is_schedule_editor_for_employee(schedule_id, employee_id)
  );

drop policy if exists schedule_entry_logs_select_staff
  on public.schedule_entry_logs;
create policy schedule_entry_logs_select_staff
  on public.schedule_entry_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.schedule_entries se
      where se.id = schedule_entry_logs.schedule_entry_id
        and public.is_schedule_editor_for_employee(
          se.schedule_id,
          se.employee_id
        )
    )
  );

drop policy if exists schedule_lock_logs_select_staff
  on public.schedule_lock_logs;
create policy schedule_lock_logs_select_staff
  on public.schedule_lock_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.schedules s
      where s.id = schedule_lock_logs.schedule_id
        and (
          public.is_schedule_manager_or_office_for_restaurant(s.restaurant_id)
          or public.is_area_lead_for_restaurant(s.restaurant_id)
        )
    )
  );

drop policy if exists schedule_publish_events_select_authenticated
  on public.schedule_publish_events;
create policy schedule_publish_events_select_authenticated
  on public.schedule_publish_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.schedules s
      where s.id = schedule_publish_events.schedule_id
        and (
          public.is_schedule_manager_or_office_for_restaurant(s.restaurant_id)
          or public.is_area_lead_for_restaurant(s.restaurant_id)
        )
    )
  );

drop policy if exists schedule_locks_select_staff
  on public.schedule_locks;
create policy schedule_locks_select_staff
  on public.schedule_locks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.schedules s
      where s.id = schedule_locks.schedule_id
        and (
          public.is_schedule_manager_or_office_for_restaurant(s.restaurant_id)
          or public.is_area_lead_for_restaurant(s.restaurant_id)
        )
    )
  );

drop policy if exists area_leads_select_staff
  on public.area_leads;
create policy area_leads_select_staff
  on public.area_leads
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

drop policy if exists area_leads_write_admin_manager
  on public.area_leads;
create policy area_leads_write_admin_manager
  on public.area_leads
  for all
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  )
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

drop policy if exists employee_restaurant_assignments_select_staff
  on public.employee_restaurant_assignments;
create policy employee_restaurant_assignments_select_staff
  on public.employee_restaurant_assignments
  for select
  to authenticated
  using (
    employee_id = auth.uid()
    or public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

drop policy if exists employee_restaurant_assignments_write_admin_manager
  on public.employee_restaurant_assignments;
create policy employee_restaurant_assignments_write_admin_manager
  on public.employee_restaurant_assignments
  for all
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  )
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

alter function public.acquire_schedule_lock(uuid, integer) set search_path = '';
alter function public.release_schedule_lock(uuid) set search_path = '';
alter function public.force_release_schedule_lock(uuid) set search_path = '';
alter function public.proc_log_schedule_entry_change() set search_path = '';
alter function public.proc_increment_schedule_entry_version() set search_path = '';
alter function public.proc_validate_schedule_entry_timestamps() set search_path = '';
alter function public.touch_updated_at() set search_path = '';
alter function public.is_any_zone_lead(uuid) set search_path = '';

commit;
