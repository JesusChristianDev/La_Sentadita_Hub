begin;

-- ============================================================
-- 018_canon_v9_schedule_request_rls_rewrite
-- Rewrites scheduling and labor-request RLS on top of the
-- canon-v9 scope/employment baseline from 017.
-- ============================================================

alter table if exists public.restaurant_zones enable row level security;
alter table if exists public.restaurant_hours enable row level security;
alter table if exists public.schedule_config enable row level security;
alter table if exists public.schedules enable row level security;
alter table if exists public.shift_templates enable row level security;
alter table if exists public.schedule_entries enable row level security;
alter table if exists public.schedule_entry_adjustments enable row level security;
alter table if exists public.schedule_entry_logs enable row level security;
alter table if exists public.schedule_lock_logs enable row level security;
alter table if exists public.schedule_publish_events enable row level security;
alter table if exists public.schedule_locks enable row level security;
alter table if exists public.requests enable row level security;

drop function if exists public.is_area_lead_for_restaurant(uuid);
drop function if exists public.is_schedule_editor_for_employee(uuid, uuid);

create or replace function public.current_user_employment_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select er.employment_id
  from public.employment_relationships er
  where er.person_id = auth.uid()
    and er.is_archived = false
    and er.deleted_at is null
    and current_date <@ er.valid_during
  order by er.valid_from desc, er.created_at desc
  limit 1
$$;

create or replace function public.current_user_zone_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when public.current_active_scope_type() = 'zone'::public.scope_type_enum
      then public.current_active_scope_id()
    else (
      select eza.zone_id
      from public.employment_relationships er
      join public.employment_zone_assignments eza
        on eza.employment_id = er.employment_id
      where er.person_id = auth.uid()
        and er.is_archived = false
        and er.deleted_at is null
        and current_date <@ er.valid_during
        and current_date <@ eza.valid_during
      order by eza.valid_from desc, eza.created_at desc
      limit 1
    )
  end
$$;

create or replace function public.current_scope_covers_company(
  p_company_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.role_scope_assignments rsa
    where rsa.person_id = auth.uid()
      and current_date <@ rsa.valid_during
      and (
        public.current_active_scope_type() is null
        or public.current_active_scope_id() is null
        or public.scope_contains(
          public.current_active_scope_type(),
          public.current_active_scope_id(),
          'company'::public.scope_type_enum,
          p_company_id
        )
      )
      and public.scope_contains(
        rsa.scope_type,
        rsa.scope_id,
        'company'::public.scope_type_enum,
        p_company_id
      )
  )
$$;

create or replace function public.current_employment_restaurant_id(
  p_employment_id uuid,
  p_anchor_date date default current_date
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select era.restaurant_id
  from public.employment_restaurant_assignments era
  where era.employment_id = p_employment_id
    and coalesce(p_anchor_date, current_date) <@ era.valid_during
  order by era.valid_from desc, era.created_at desc
  limit 1
$$;

create or replace function public.current_user_operationally_covers_restaurant(
  p_restaurant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.employment_relationships er
    join public.employment_restaurant_assignments era
      on era.employment_id = er.employment_id
    where er.person_id = auth.uid()
      and er.is_archived = false
      and er.deleted_at is null
      and current_date <@ er.valid_during
      and current_date <@ era.valid_during
      and era.restaurant_id = p_restaurant_id
  )
$$;

create or replace function public.current_user_operationally_covers_zone(
  p_zone_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.employment_relationships er
    join public.employment_zone_assignments eza
      on eza.employment_id = er.employment_id
    where er.person_id = auth.uid()
      and er.is_archived = false
      and er.deleted_at is null
      and current_date <@ er.valid_during
      and current_date <@ eza.valid_during
      and eza.zone_id = p_zone_id
  )
$$;

create or replace function public.current_user_can_view_restaurant(
  p_restaurant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case public.current_system_role()::public.system_role_enum
    when 'admin'::public.system_role_enum then true
    when 'owner'::public.system_role_enum then public.current_scope_covers_restaurant(p_restaurant_id)
    when 'office'::public.system_role_enum then public.current_scope_covers_restaurant(p_restaurant_id)
    when 'manager'::public.system_role_enum then public.current_scope_covers_restaurant(p_restaurant_id)
    when 'area_lead'::public.system_role_enum then public.current_user_operationally_covers_restaurant(p_restaurant_id)
    when 'employee'::public.system_role_enum then public.current_user_operationally_covers_restaurant(p_restaurant_id)
    else false
  end
$$;

create or replace function public.current_user_can_manage_restaurant_setup(
  p_restaurant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin_actor()
    or (
      public.current_system_role()::public.system_role_enum in (
        'office'::public.system_role_enum,
        'manager'::public.system_role_enum
      )
      and public.current_scope_covers_restaurant(p_restaurant_id)
    )
$$;

create or replace function public.current_user_can_supervise_restaurant(
  p_restaurant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin_actor()
    or (
      public.current_system_role()::public.system_role_enum in (
        'owner'::public.system_role_enum,
        'office'::public.system_role_enum,
        'manager'::public.system_role_enum
      )
      and public.current_scope_covers_restaurant(p_restaurant_id)
    )
$$;

create or replace function public.current_user_can_operate_schedule_restaurant(
  p_restaurant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin_actor()
    or (
      public.current_system_role()::public.system_role_enum = 'manager'::public.system_role_enum
      and public.current_scope_covers_restaurant(p_restaurant_id)
    )
$$;

create or replace function public.is_schedule_manager_or_office_for_restaurant(
  p_restaurant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin_actor()
    or (
      public.current_system_role()::public.system_role_enum in (
        'office'::public.system_role_enum,
        'manager'::public.system_role_enum
      )
      and public.current_scope_covers_restaurant(p_restaurant_id)
    )
$$;

create or replace function public.current_user_can_read_schedule_row(
  p_schedule_id uuid,
  p_restaurant_id uuid,
  p_status public.schedule_status_enum
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when public.is_admin_actor() then true
    when public.current_system_role()::public.system_role_enum in (
      'owner'::public.system_role_enum,
      'office'::public.system_role_enum,
      'manager'::public.system_role_enum
    ) then public.current_scope_covers_restaurant(p_restaurant_id)
    when public.current_system_role()::public.system_role_enum = 'area_lead'::public.system_role_enum then (
      public.current_user_zone_id() is not null
      and exists (
        select 1
        from public.schedule_entries se
        where se.schedule_id = p_schedule_id
          and se.zone_id = public.current_user_zone_id()
      )
    )
    when public.current_system_role()::public.system_role_enum = 'employee'::public.system_role_enum then (
      p_status = 'published'::public.schedule_status_enum
      and exists (
        select 1
        from public.schedule_entries se
        where se.schedule_id = p_schedule_id
          and se.employment_id is not null
          and se.employment_id = public.current_user_employment_id()
      )
    )
    else false
  end
$$;

create or replace function public.current_user_can_write_schedule_entry(
  p_schedule_id uuid,
  p_zone_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  with schedule_target as (
    select s.restaurant_id, s.status
    from public.schedules s
    where s.id = p_schedule_id
  )
  select exists (
    select 1
    from schedule_target st
    where st.status <> 'published'::public.schedule_status_enum
      and (
        public.is_admin_actor()
        or (
          public.current_system_role()::public.system_role_enum = 'manager'::public.system_role_enum
          and public.current_scope_covers_restaurant(st.restaurant_id)
        )
        or (
          public.current_system_role()::public.system_role_enum = 'area_lead'::public.system_role_enum
          and p_zone_id is not null
          and p_zone_id = public.current_user_zone_id()
          and exists (
            select 1
            from public.restaurant_zones rz
            where rz.id = p_zone_id
              and rz.restaurant_id = st.restaurant_id
          )
        )
      )
  )
$$;

create or replace function public.current_user_can_read_schedule_entry_row(
  p_schedule_id uuid,
  p_zone_id uuid,
  p_employment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  with schedule_target as (
    select s.restaurant_id, s.status
    from public.schedules s
    where s.id = p_schedule_id
  )
  select exists (
    select 1
    from schedule_target st
    where
      public.is_admin_actor()
      or (
        public.current_system_role()::public.system_role_enum in (
          'owner'::public.system_role_enum,
          'office'::public.system_role_enum,
          'manager'::public.system_role_enum
        )
        and public.current_scope_covers_restaurant(st.restaurant_id)
      )
      or (
        public.current_system_role()::public.system_role_enum = 'area_lead'::public.system_role_enum
        and p_zone_id is not null
        and p_zone_id = public.current_user_zone_id()
      )
      or (
        public.current_system_role()::public.system_role_enum = 'employee'::public.system_role_enum
        and st.status = 'published'::public.schedule_status_enum
        and p_employment_id is not null
        and p_employment_id = public.current_user_employment_id()
      )
  )
$$;

create or replace function public.current_user_can_read_schedule_audit(
  p_schedule_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_system_role()::public.system_role_enum <> 'employee'::public.system_role_enum
    and exists (
      select 1
      from public.schedules s
      where s.id = p_schedule_id
        and public.current_user_can_read_schedule_row(
          s.id,
          s.restaurant_id,
          s.status
        )
    )
$$;

create or replace function public.current_user_can_read_schedule_entry_audit(
  p_schedule_entry_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_system_role()::public.system_role_enum <> 'employee'::public.system_role_enum
    and exists (
      select 1
      from public.schedule_entries se
      where se.id = p_schedule_entry_id
        and public.current_user_can_read_schedule_entry_row(
          se.schedule_id,
          se.zone_id,
          se.employment_id
        )
    )
$$;

create or replace function public.current_user_can_view_request(
  p_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  with request_target as (
    select
      r.request_id,
      r.requested_by,
      r.effective_start_date,
      er.company_id,
      public.current_employment_restaurant_id(
        r.employment_id,
        coalesce(r.effective_start_date, current_date)
      ) as restaurant_id
    from public.requests r
    join public.employment_relationships er
      on er.employment_id = r.employment_id
    where r.request_id = p_request_id
  )
  select case
    when public.is_admin_actor() then true
    when exists (
      select 1
      from request_target rt
      where rt.requested_by = auth.uid()
    ) then true
    when public.current_system_role()::public.system_role_enum in (
      'owner'::public.system_role_enum,
      'office'::public.system_role_enum
    ) then exists (
      select 1
      from request_target rt
      where public.current_scope_covers_company(rt.company_id)
         or (
           rt.restaurant_id is not null
           and public.current_scope_covers_restaurant(rt.restaurant_id)
         )
    )
    when public.current_system_role()::public.system_role_enum = 'manager'::public.system_role_enum then exists (
      select 1
      from request_target rt
      where rt.restaurant_id is not null
        and public.current_scope_covers_restaurant(rt.restaurant_id)
    )
    else false
  end
$$;

create or replace function public.current_user_can_insert_request(
  p_employment_id uuid,
  p_requested_by uuid,
  p_reviewed_by uuid,
  p_status public.request_status_enum
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  with employment_target as (
    select
      er.person_id,
      er.company_id,
      public.current_employment_restaurant_id(er.employment_id, current_date) as restaurant_id
    from public.employment_relationships er
    where er.employment_id = p_employment_id
      and er.is_archived = false
      and er.deleted_at is null
      and current_date <@ er.valid_during
  )
  select
    p_requested_by = auth.uid()
    and p_reviewed_by is null
    and p_status = 'pending'::public.request_status_enum
    and exists (
      select 1
      from employment_target et
      where
        public.is_admin_actor()
        or et.person_id = auth.uid()
        or (
          public.current_system_role()::public.system_role_enum = 'office'::public.system_role_enum
          and (
            public.current_scope_covers_company(et.company_id)
            or (
              et.restaurant_id is not null
              and public.current_scope_covers_restaurant(et.restaurant_id)
            )
          )
        )
        or (
          public.current_system_role()::public.system_role_enum = 'manager'::public.system_role_enum
          and et.restaurant_id is not null
          and public.current_scope_covers_restaurant(et.restaurant_id)
        )
    )
$$;

create or replace function public.current_user_can_review_request(
  p_request_id uuid,
  p_employment_id uuid,
  p_request_type public.request_type_enum,
  p_requested_by uuid,
  p_reviewed_by uuid,
  p_status public.request_status_enum,
  p_effective_start_date date,
  p_effective_end_date date
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  with request_target as (
    select
      r.request_id,
      r.employment_id,
      r.request_type,
      r.requested_by,
      r.reviewed_by,
      r.status as current_status,
      r.effective_start_date,
      r.effective_end_date,
      er.company_id,
      public.current_employment_restaurant_id(
        r.employment_id,
        coalesce(r.effective_start_date, current_date)
      ) as restaurant_id
    from public.requests r
    join public.employment_relationships er
      on er.employment_id = r.employment_id
    where r.request_id = p_request_id
  )
  select exists (
    select 1
    from request_target rt
    where rt.employment_id = p_employment_id
      and rt.request_type = p_request_type
      and rt.requested_by = p_requested_by
      and rt.effective_start_date is not distinct from p_effective_start_date
      and rt.effective_end_date is not distinct from p_effective_end_date
      and rt.requested_by <> auth.uid()
      and p_reviewed_by = auth.uid()
      and (
        (
          p_status = 'approved'::public.request_status_enum
          and (
            public.is_admin_actor()
            or (
              public.current_system_role()::public.system_role_enum = 'office'::public.system_role_enum
              and (
                public.current_scope_covers_company(rt.company_id)
                or (
                  rt.restaurant_id is not null
                  and public.current_scope_covers_restaurant(rt.restaurant_id)
                )
              )
            )
            or (
              public.current_system_role()::public.system_role_enum = 'manager'::public.system_role_enum
              and p_request_type in (
                'justified_absence'::public.request_type_enum,
                'absence'::public.request_type_enum
              )
              and rt.restaurant_id is not null
              and public.current_scope_covers_restaurant(rt.restaurant_id)
            )
          )
        )
        or (
          p_status = 'rejected'::public.request_status_enum
          and (
            public.is_admin_actor()
            or (
              public.current_system_role()::public.system_role_enum = 'office'::public.system_role_enum
              and (
                public.current_scope_covers_company(rt.company_id)
                or (
                  rt.restaurant_id is not null
                  and public.current_scope_covers_restaurant(rt.restaurant_id)
                )
              )
            )
            or (
              public.current_system_role()::public.system_role_enum = 'manager'::public.system_role_enum
              and rt.restaurant_id is not null
              and public.current_scope_covers_restaurant(rt.restaurant_id)
            )
          )
        )
        or (
          p_status = 'in_review'::public.request_status_enum
          and (
            public.is_admin_actor()
            or (
              public.current_system_role()::public.system_role_enum = 'office'::public.system_role_enum
              and (
                public.current_scope_covers_company(rt.company_id)
                or (
                  rt.restaurant_id is not null
                  and public.current_scope_covers_restaurant(rt.restaurant_id)
                )
              )
            )
            or (
              public.current_system_role()::public.system_role_enum = 'manager'::public.system_role_enum
              and rt.restaurant_id is not null
              and public.current_scope_covers_restaurant(rt.restaurant_id)
            )
          )
        )
      )
  )
$$;

create or replace function public.current_user_can_cancel_request(
  p_request_id uuid,
  p_employment_id uuid,
  p_request_type public.request_type_enum,
  p_requested_by uuid,
  p_reviewed_by uuid,
  p_status public.request_status_enum,
  p_effective_start_date date,
  p_effective_end_date date
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  with request_target as (
    select
      r.request_id,
      r.employment_id,
      r.request_type,
      r.requested_by,
      r.reviewed_by,
      r.status as current_status,
      r.effective_start_date,
      r.effective_end_date
    from public.requests r
    where r.request_id = p_request_id
  )
  select exists (
    select 1
    from request_target rt
    where rt.employment_id = p_employment_id
      and rt.request_type = p_request_type
      and rt.requested_by = p_requested_by
      and rt.effective_start_date is not distinct from p_effective_start_date
      and rt.effective_end_date is not distinct from p_effective_end_date
      and rt.requested_by = auth.uid()
      and p_status = 'cancelled'::public.request_status_enum
      and rt.current_status in (
        'pending'::public.request_status_enum,
        'in_review'::public.request_status_enum
      )
      and p_reviewed_by is not distinct from rt.reviewed_by
  )
$$;

drop policy if exists restaurant_zones_select_authenticated on public.restaurant_zones;
drop policy if exists restaurant_zones_write_admin_manager on public.restaurant_zones;
drop policy if exists restaurant_zones_insert_admin_manager on public.restaurant_zones;
drop policy if exists restaurant_zones_update_admin_manager on public.restaurant_zones;
drop policy if exists restaurant_zones_delete_admin_manager on public.restaurant_zones;
drop policy if exists restaurant_zones_admin_all on public.restaurant_zones;

create policy restaurant_zones_select_canon
on public.restaurant_zones
for select
to authenticated
using (
  public.current_user_can_view_restaurant(restaurant_id)
);

create policy restaurant_zones_insert_canon
on public.restaurant_zones
for insert
to authenticated
with check (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
);

create policy restaurant_zones_update_canon
on public.restaurant_zones
for update
to authenticated
using (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
)
with check (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
);

create policy restaurant_zones_delete_canon
on public.restaurant_zones
for delete
to authenticated
using (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
);

drop policy if exists restaurant_hours_select_authenticated on public.restaurant_hours;
drop policy if exists restaurant_hours_write_admin_manager on public.restaurant_hours;
drop policy if exists restaurant_hours_insert_admin_manager on public.restaurant_hours;
drop policy if exists restaurant_hours_update_admin_manager on public.restaurant_hours;
drop policy if exists restaurant_hours_delete_admin_manager on public.restaurant_hours;

create policy restaurant_hours_select_canon
on public.restaurant_hours
for select
to authenticated
using (
  public.current_user_can_view_restaurant(restaurant_id)
);

create policy restaurant_hours_insert_canon
on public.restaurant_hours
for insert
to authenticated
with check (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
);

create policy restaurant_hours_update_canon
on public.restaurant_hours
for update
to authenticated
using (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
)
with check (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
);

create policy restaurant_hours_delete_canon
on public.restaurant_hours
for delete
to authenticated
using (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
);

drop policy if exists schedule_config_select_authenticated on public.schedule_config;
drop policy if exists schedule_config_write_admin_manager on public.schedule_config;
drop policy if exists schedule_config_insert_admin_manager on public.schedule_config;
drop policy if exists schedule_config_update_admin_manager on public.schedule_config;
drop policy if exists schedule_config_delete_admin_manager on public.schedule_config;

create policy schedule_config_select_canon
on public.schedule_config
for select
to authenticated
using (
  public.current_user_can_view_restaurant(restaurant_id)
);

create policy schedule_config_insert_canon
on public.schedule_config
for insert
to authenticated
with check (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
);

create policy schedule_config_update_canon
on public.schedule_config
for update
to authenticated
using (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
)
with check (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
);

create policy schedule_config_delete_canon
on public.schedule_config
for delete
to authenticated
using (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
);

drop policy if exists schedules_select_authenticated on public.schedules;
drop policy if exists schedules_write_admin_manager on public.schedules;
drop policy if exists schedules_insert_admin_manager on public.schedules;
drop policy if exists schedules_update_admin_manager on public.schedules;
drop policy if exists schedules_delete_admin_manager on public.schedules;
drop policy if exists schedules_select_by_scope on public.schedules;
drop policy if exists schedules_write_by_scope on public.schedules;

create policy schedules_select_canon
on public.schedules
for select
to authenticated
using (
  public.current_user_can_read_schedule_row(
    id,
    restaurant_id,
    status
  )
);

create policy schedules_insert_canon
on public.schedules
for insert
to authenticated
with check (
  public.current_user_can_operate_schedule_restaurant(restaurant_id)
);

create policy schedules_update_canon
on public.schedules
for update
to authenticated
using (
  public.current_user_can_operate_schedule_restaurant(restaurant_id)
)
with check (
  public.current_user_can_operate_schedule_restaurant(restaurant_id)
);

create policy schedules_delete_canon
on public.schedules
for delete
to authenticated
using (
  public.current_user_can_operate_schedule_restaurant(restaurant_id)
);

drop policy if exists shift_templates_select_authenticated on public.shift_templates;
drop policy if exists shift_templates_write_admin_manager on public.shift_templates;
drop policy if exists shift_templates_insert_admin_manager on public.shift_templates;
drop policy if exists shift_templates_update_admin_manager on public.shift_templates;
drop policy if exists shift_templates_delete_admin_manager on public.shift_templates;
drop policy if exists shift_templates_select_by_scope on public.shift_templates;
drop policy if exists shift_templates_write_by_scope on public.shift_templates;

create policy shift_templates_select_canon
on public.shift_templates
for select
to authenticated
using (
  public.current_user_can_view_restaurant(restaurant_id)
);

create policy shift_templates_insert_canon
on public.shift_templates
for insert
to authenticated
with check (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
);

create policy shift_templates_update_canon
on public.shift_templates
for update
to authenticated
using (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
)
with check (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
);

create policy shift_templates_delete_canon
on public.shift_templates
for delete
to authenticated
using (
  public.current_user_can_manage_restaurant_setup(restaurant_id)
);

drop policy if exists schedule_entries_select_authenticated on public.schedule_entries;
drop policy if exists schedule_entries_write_staff on public.schedule_entries;
drop policy if exists schedule_entries_select_by_scope on public.schedule_entries;
drop policy if exists schedule_entries_write_by_scope on public.schedule_entries;

create policy schedule_entries_select_canon
on public.schedule_entries
for select
to authenticated
using (
  public.current_user_can_read_schedule_entry_row(
    schedule_id,
    zone_id,
    employment_id
  )
);

create policy schedule_entries_insert_canon
on public.schedule_entries
for insert
to authenticated
with check (
  public.current_user_can_write_schedule_entry(
    schedule_id,
    zone_id
  )
);

create policy schedule_entries_update_canon
on public.schedule_entries
for update
to authenticated
using (
  public.current_user_can_write_schedule_entry(
    schedule_id,
    zone_id
  )
)
with check (
  public.current_user_can_write_schedule_entry(
    schedule_id,
    zone_id
  )
);

create policy schedule_entries_delete_canon
on public.schedule_entries
for delete
to authenticated
using (
  public.current_user_can_write_schedule_entry(
    schedule_id,
    zone_id
  )
);

drop policy if exists schedule_entry_adjustments_select_by_scope on public.schedule_entry_adjustments;

create policy schedule_entry_adjustments_select_canon
on public.schedule_entry_adjustments
for select
to authenticated
using (
  public.current_user_can_read_schedule_entry_audit(schedule_entry_id)
);

drop policy if exists schedule_entry_logs_select_staff on public.schedule_entry_logs;
drop policy if exists schedule_entry_logs_select_by_scope on public.schedule_entry_logs;

create policy schedule_entry_logs_select_canon
on public.schedule_entry_logs
for select
to authenticated
using (
  public.current_user_can_read_schedule_entry_audit(schedule_entry_id)
);

drop policy if exists schedule_lock_logs_select_staff on public.schedule_lock_logs;
drop policy if exists schedule_lock_logs_select_by_scope on public.schedule_lock_logs;

create policy schedule_lock_logs_select_canon
on public.schedule_lock_logs
for select
to authenticated
using (
  public.current_user_can_read_schedule_audit(schedule_id)
);

drop policy if exists schedule_publish_events_select_authenticated on public.schedule_publish_events;

create policy schedule_publish_events_select_canon
on public.schedule_publish_events
for select
to authenticated
using (
  public.current_user_can_read_schedule_audit(schedule_id)
);

drop policy if exists schedule_locks_select_staff on public.schedule_locks;

create policy schedule_locks_select_canon
on public.schedule_locks
for select
to authenticated
using (
  public.current_user_can_read_schedule_audit(schedule_id)
);

drop policy if exists procedures_admin_all on public.requests;
drop policy if exists requests_admin_all on public.requests;
drop policy if exists requests_select_canon on public.requests;
drop policy if exists requests_insert_canon on public.requests;
drop policy if exists requests_update_review_canon on public.requests;
drop policy if exists requests_update_cancel_own_canon on public.requests;

create policy requests_select_canon
on public.requests
for select
to authenticated
using (
  public.current_user_can_view_request(request_id)
);

create policy requests_insert_canon
on public.requests
for insert
to authenticated
with check (
  public.current_user_can_insert_request(
    employment_id,
    requested_by,
    reviewed_by,
    status
  )
);

create policy requests_update_review_canon
on public.requests
for update
to authenticated
using (
  public.current_user_can_view_request(request_id)
)
with check (
  public.current_user_can_review_request(
    request_id,
    employment_id,
    request_type,
    requested_by,
    reviewed_by,
    status,
    effective_start_date,
    effective_end_date
  )
);

create policy requests_update_cancel_own_canon
on public.requests
for update
to authenticated
using (
  public.current_user_can_view_request(request_id)
)
with check (
  public.current_user_can_cancel_request(
    request_id,
    employment_id,
    request_type,
    requested_by,
    reviewed_by,
    status,
    effective_start_date,
    effective_end_date
  )
);

grant execute on function public.current_user_employment_id() to authenticated;
grant execute on function public.current_user_zone_id() to authenticated;
grant execute on function public.current_scope_covers_company(uuid) to authenticated;
grant execute on function public.current_employment_restaurant_id(uuid, date) to authenticated;
grant execute on function public.current_user_operationally_covers_restaurant(uuid) to authenticated;
grant execute on function public.current_user_operationally_covers_zone(uuid) to authenticated;
grant execute on function public.current_user_can_view_restaurant(uuid) to authenticated;
grant execute on function public.current_user_can_manage_restaurant_setup(uuid) to authenticated;
grant execute on function public.current_user_can_supervise_restaurant(uuid) to authenticated;
grant execute on function public.current_user_can_operate_schedule_restaurant(uuid) to authenticated;
grant execute on function public.is_schedule_manager_or_office_for_restaurant(uuid) to authenticated;
grant execute on function public.current_user_can_read_schedule_row(uuid, uuid, public.schedule_status_enum) to authenticated;
grant execute on function public.current_user_can_write_schedule_entry(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_read_schedule_entry_row(uuid, uuid, uuid) to authenticated;
grant execute on function public.current_user_can_read_schedule_audit(uuid) to authenticated;
grant execute on function public.current_user_can_read_schedule_entry_audit(uuid) to authenticated;
grant execute on function public.current_user_can_view_request(uuid) to authenticated;
grant execute on function public.current_user_can_insert_request(uuid, uuid, uuid, public.request_status_enum) to authenticated;
grant execute on function public.current_user_can_review_request(
  uuid,
  uuid,
  public.request_type_enum,
  uuid,
  uuid,
  public.request_status_enum,
  date,
  date
) to authenticated;
grant execute on function public.current_user_can_cancel_request(
  uuid,
  uuid,
  public.request_type_enum,
  uuid,
  uuid,
  public.request_status_enum,
  date,
  date
) to authenticated;

commit;
