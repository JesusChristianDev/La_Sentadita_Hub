begin;

-- ============================================================
-- 019_canon_v9_tasks_swaps_incidents_rls_rewrite
-- Canonical RLS for tasks, shift swaps and incidents on top of
-- the v9 scope/employment helpers introduced in 017 and 018.
-- ============================================================

alter table if exists public.task_templates enable row level security;
alter table if exists public.task_instances enable row level security;
alter table if exists public.shift_swap_requests enable row level security;
alter table if exists public.incidents enable row level security;

create or replace function public.current_user_can_read_task_templates(
  p_restaurant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_user_can_supervise_restaurant(p_restaurant_id)
$$;

create or replace function public.current_user_can_manage_task_restaurant(
  p_restaurant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_user_can_manage_restaurant_setup(p_restaurant_id)
$$;

create or replace function public.current_user_can_view_task_instance_row(
  p_restaurant_id uuid,
  p_assigned_zone_id uuid,
  p_assigned_role public.system_role_enum,
  p_assigned_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when public.current_user_can_supervise_restaurant(p_restaurant_id) then true
    when p_assigned_employee_id = auth.uid() then public.current_user_can_view_restaurant(p_restaurant_id)
    when public.current_system_role()::public.system_role_enum = 'area_lead'::public.system_role_enum then (
      public.current_user_operationally_covers_restaurant(p_restaurant_id)
      and (
        (p_assigned_zone_id is not null and p_assigned_zone_id = public.current_user_zone_id())
        or p_assigned_role = 'area_lead'::public.system_role_enum
      )
    )
    when public.current_system_role()::public.system_role_enum = 'employee'::public.system_role_enum then (
      public.current_user_operationally_covers_restaurant(p_restaurant_id)
      and p_assigned_role = 'employee'::public.system_role_enum
    )
    else false
  end
$$;

create or replace function public.current_user_can_complete_task_instance_row(
  p_restaurant_id uuid,
  p_assigned_zone_id uuid,
  p_assigned_role public.system_role_enum,
  p_assigned_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when public.current_user_can_manage_task_restaurant(p_restaurant_id) then true
    when
      p_assigned_employee_id = auth.uid()
      and public.current_system_role()::public.system_role_enum in (
        'area_lead'::public.system_role_enum,
        'employee'::public.system_role_enum
      )
    then public.current_user_can_view_restaurant(p_restaurant_id)
    when public.current_system_role()::public.system_role_enum = 'area_lead'::public.system_role_enum then (
      public.current_user_operationally_covers_restaurant(p_restaurant_id)
      and (
        (p_assigned_zone_id is not null and p_assigned_zone_id = public.current_user_zone_id())
        or p_assigned_role = 'area_lead'::public.system_role_enum
      )
    )
    when public.current_system_role()::public.system_role_enum = 'employee'::public.system_role_enum then (
      public.current_user_operationally_covers_restaurant(p_restaurant_id)
      and p_assigned_role = 'employee'::public.system_role_enum
    )
    else false
  end
$$;

create or replace function public.current_user_can_complete_task_instance_update(
  p_task_instance_id uuid,
  p_task_template_id uuid,
  p_restaurant_id uuid,
  p_task_date date,
  p_shift_context text,
  p_assigned_role public.system_role_enum,
  p_assigned_zone_id uuid,
  p_assigned_employee_id uuid,
  p_task_status public.task_status_enum,
  p_cancel_reason public.task_cancel_reason_enum,
  p_reassignment_reason public.task_reassignment_reason_enum,
  p_due_at timestamptz,
  p_completed_by uuid,
  p_completed_at timestamptz,
  p_requires_confirmation boolean,
  p_confirmed_by uuid,
  p_confirmed_at timestamptz,
  p_confirmation_note text,
  p_confirmation_photo_url text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.task_instances ti
    where ti.task_instance_id = p_task_instance_id
      and public.current_user_can_complete_task_instance_row(
        ti.restaurant_id,
        ti.assigned_zone_id,
        ti.assigned_role,
        ti.assigned_employee_id
      )
      and ti.task_template_id is not distinct from p_task_template_id
      and ti.task_status in (
        'pending'::public.task_status_enum,
        'needs_reassignment'::public.task_status_enum,
        'overdue'::public.task_status_enum
      )
      and ti.restaurant_id = p_restaurant_id
      and ti.task_date is not distinct from p_task_date
      and ti.shift_context is not distinct from p_shift_context
      and ti.assigned_role is not distinct from p_assigned_role
      and ti.assigned_zone_id is not distinct from p_assigned_zone_id
      and ti.assigned_employee_id is not distinct from p_assigned_employee_id
      and ti.cancel_reason is not distinct from p_cancel_reason
      and ti.reassignment_reason is not distinct from p_reassignment_reason
      and ti.due_at is not distinct from p_due_at
      and p_task_status = 'completed'::public.task_status_enum
      and ti.completed_by is null
      and ti.completed_at is null
      and p_completed_by = auth.uid()
      and p_completed_at is not null
      and ti.requires_confirmation is not distinct from p_requires_confirmation
      and ti.confirmed_by is not distinct from p_confirmed_by
      and ti.confirmed_at is not distinct from p_confirmed_at
      and ti.confirmation_note is not distinct from p_confirmation_note
      and ti.confirmation_photo_url is not distinct from p_confirmation_photo_url
  )
$$;

create or replace function public.current_user_can_view_incident_row(
  p_restaurant_id uuid,
  p_zone_id uuid,
  p_sensitivity public.incident_sensitivity_enum,
  p_reported_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when public.current_user_can_supervise_restaurant(p_restaurant_id) then true
    when public.current_system_role()::public.system_role_enum = 'area_lead'::public.system_role_enum then (
      public.current_user_operationally_covers_restaurant(p_restaurant_id)
      and
      p_sensitivity <> 'restricted'::public.incident_sensitivity_enum
      and (
        p_reported_by = auth.uid()
        or (
          p_zone_id is not null
          and p_zone_id = public.current_user_zone_id()
        )
      )
    )
    when public.current_system_role()::public.system_role_enum = 'employee'::public.system_role_enum then (
      public.current_user_operationally_covers_restaurant(p_restaurant_id)
      and
      p_reported_by = auth.uid()
    )
    else false
  end
$$;

create or replace function public.current_user_can_insert_incident_row(
  p_restaurant_id uuid,
  p_zone_id uuid,
  p_reported_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p_reported_by = auth.uid()
    and public.current_user_can_view_restaurant(p_restaurant_id)
    and (
      p_zone_id is null
      or exists (
        select 1
        from public.restaurant_zones rz
        where rz.id = p_zone_id
          and rz.restaurant_id = p_restaurant_id
          and (
            public.current_scope_covers_restaurant(p_restaurant_id)
            or public.current_user_operationally_covers_zone(p_zone_id)
          )
      )
    )
$$;

create or replace function public.current_user_can_manage_incident_category(
  p_restaurant_id uuid,
  p_category public.incident_category_enum
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when public.is_admin_actor() then true
    when public.current_system_role()::public.system_role_enum = 'office'::public.system_role_enum then (
      public.current_scope_covers_restaurant(p_restaurant_id)
      and p_category in (
        'maintenance'::public.incident_category_enum,
        'security'::public.incident_category_enum,
        'technology'::public.incident_category_enum,
        'personnel'::public.incident_category_enum,
        'stock'::public.incident_category_enum
      )
    )
    when public.current_system_role()::public.system_role_enum = 'manager'::public.system_role_enum then (
      public.current_scope_covers_restaurant(p_restaurant_id)
      and p_category in (
        'operational'::public.incident_category_enum,
        'hygiene'::public.incident_category_enum,
        'customer'::public.incident_category_enum,
        'stock'::public.incident_category_enum
      )
    )
    else false
  end
$$;

create or replace function public.current_user_can_update_incident_row(
  p_incident_id uuid,
  p_restaurant_id uuid,
  p_zone_id uuid,
  p_category public.incident_category_enum,
  p_sensitivity public.incident_sensitivity_enum,
  p_title text,
  p_description text,
  p_severity public.incident_severity_enum,
  p_reported_by uuid,
  p_primary_owner uuid,
  p_status public.incident_status_enum
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.incidents i
    where i.incident_id = p_incident_id
      and public.current_user_can_manage_incident_category(
        i.restaurant_id,
        i.category
      )
      and i.restaurant_id = p_restaurant_id
      and i.zone_id is not distinct from p_zone_id
      and i.category = p_category
      and i.sensitivity = p_sensitivity
      and i.title = p_title
      and i.description = p_description
      and i.severity is not distinct from p_severity
      and i.reported_by = p_reported_by
      and (
        i.primary_owner is distinct from p_primary_owner
        or i.status is distinct from p_status
      )
  )
$$;

create or replace function public.current_user_can_view_shift_swap_row(
  p_requester_employee_id uuid,
  p_target_employee_id uuid,
  p_requester_schedule_entry_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when public.is_admin_actor() then true
    when auth.uid() in (p_requester_employee_id, p_target_employee_id) then true
    when public.current_system_role()::public.system_role_enum in (
      'owner'::public.system_role_enum,
      'office'::public.system_role_enum,
      'manager'::public.system_role_enum
    ) then exists (
      select 1
      from public.schedule_entries se
      join public.schedules s
        on s.id = se.schedule_id
      where se.id = p_requester_schedule_entry_id
        and public.current_scope_covers_restaurant(s.restaurant_id)
    )
    else false
  end
$$;

create or replace function public.current_user_can_insert_shift_swap(
  p_requester_employee_id uuid,
  p_target_employee_id uuid,
  p_requester_schedule_entry_id uuid,
  p_target_schedule_entry_id uuid,
  p_status public.shift_swap_status_enum,
  p_peer_responded_at timestamptz,
  p_reviewed_by uuid,
  p_reviewed_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  with requester_entry as (
    select er.person_id as employee_id, s.restaurant_id
    from public.schedule_entries se
    join public.employment_relationships er
      on er.employment_id = se.employment_id
    join public.schedules s
      on s.id = se.schedule_id
    where se.id = p_requester_schedule_entry_id
  ),
  target_entry as (
    select er.person_id as employee_id, s.restaurant_id
    from public.schedule_entries se
    join public.employment_relationships er
      on er.employment_id = se.employment_id
    join public.schedules s
      on s.id = se.schedule_id
    where se.id = p_target_schedule_entry_id
  )
  select exists (
    select 1
    from requester_entry re
    join target_entry te
      on te.restaurant_id = re.restaurant_id
    where re.employee_id = p_requester_employee_id
      and te.employee_id = p_target_employee_id
      and p_requester_employee_id <> p_target_employee_id
      and p_status = 'pending_peer'::public.shift_swap_status_enum
      and p_peer_responded_at is null
      and p_reviewed_by is null
      and p_reviewed_at is null
      and (
        public.is_admin_actor()
        or (
          public.current_system_role()::public.system_role_enum = 'employee'::public.system_role_enum
          and p_requester_employee_id = auth.uid()
          and public.current_user_operationally_covers_restaurant(re.restaurant_id)
        )
      )
  )
$$;

create or replace function public.current_user_can_peer_update_shift_swap(
  p_shift_swap_request_id uuid,
  p_requester_employee_id uuid,
  p_target_employee_id uuid,
  p_requester_schedule_entry_id uuid,
  p_target_schedule_entry_id uuid,
  p_status public.shift_swap_status_enum,
  p_requested_at timestamptz,
  p_peer_responded_at timestamptz,
  p_reviewed_by uuid,
  p_reviewed_at timestamptz,
  p_reason text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.shift_swap_requests ssr
    where ssr.shift_swap_request_id = p_shift_swap_request_id
      and (
        public.is_admin_actor()
        or (
          public.current_system_role()::public.system_role_enum = 'employee'::public.system_role_enum
          and ssr.target_employee_id = auth.uid()
        )
      )
      and ssr.status = 'pending_peer'::public.shift_swap_status_enum
      and ssr.requester_employee_id = p_requester_employee_id
      and ssr.target_employee_id = p_target_employee_id
      and ssr.requester_schedule_entry_id = p_requester_schedule_entry_id
      and ssr.target_schedule_entry_id = p_target_schedule_entry_id
      and ssr.requested_at is not distinct from p_requested_at
      and ssr.reason is not distinct from p_reason
      and ssr.peer_responded_at is null
      and ssr.reviewed_by is null
      and ssr.reviewed_at is null
      and p_status in (
        'pending_manager'::public.shift_swap_status_enum,
        'rejected_peer'::public.shift_swap_status_enum
      )
      and p_peer_responded_at is not null
      and p_reviewed_by is null
      and p_reviewed_at is null
  )
$$;

create or replace function public.current_user_can_manager_review_shift_swap(
  p_shift_swap_request_id uuid,
  p_requester_employee_id uuid,
  p_target_employee_id uuid,
  p_requester_schedule_entry_id uuid,
  p_target_schedule_entry_id uuid,
  p_status public.shift_swap_status_enum,
  p_requested_at timestamptz,
  p_peer_responded_at timestamptz,
  p_reviewed_by uuid,
  p_reviewed_at timestamptz,
  p_reason text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.shift_swap_requests ssr
    join public.schedule_entries se
      on se.id = ssr.requester_schedule_entry_id
    join public.schedules s
      on s.id = se.schedule_id
    where ssr.shift_swap_request_id = p_shift_swap_request_id
      and (
        public.is_admin_actor()
        or (
          public.current_system_role()::public.system_role_enum = 'manager'::public.system_role_enum
          and public.current_scope_covers_restaurant(s.restaurant_id)
        )
      )
      and ssr.status = 'pending_manager'::public.shift_swap_status_enum
      and ssr.requester_employee_id = p_requester_employee_id
      and ssr.target_employee_id = p_target_employee_id
      and ssr.requester_schedule_entry_id = p_requester_schedule_entry_id
      and ssr.target_schedule_entry_id = p_target_schedule_entry_id
      and ssr.requested_at is not distinct from p_requested_at
      and ssr.reason is not distinct from p_reason
      and ssr.reviewed_by is null
      and ssr.reviewed_at is null
      and p_status in (
        'approved'::public.shift_swap_status_enum,
        'rejected_manager'::public.shift_swap_status_enum
      )
      and p_peer_responded_at is not null
      and p_reviewed_by = auth.uid()
      and p_reviewed_at is not null
  )
$$;

drop policy if exists task_templates_admin_all on public.task_templates;
drop policy if exists task_templates_select_canon on public.task_templates;
drop policy if exists task_templates_insert_canon on public.task_templates;
drop policy if exists task_templates_update_canon on public.task_templates;
drop policy if exists task_templates_delete_canon on public.task_templates;

create policy task_templates_select_canon
on public.task_templates
for select
to authenticated
using (
  public.current_user_can_read_task_templates(restaurant_id)
);

create policy task_templates_insert_canon
on public.task_templates
for insert
to authenticated
with check (
  public.current_user_can_manage_task_restaurant(restaurant_id)
);

create policy task_templates_update_canon
on public.task_templates
for update
to authenticated
using (
  public.current_user_can_manage_task_restaurant(restaurant_id)
)
with check (
  public.current_user_can_manage_task_restaurant(restaurant_id)
);

drop policy if exists task_instances_admin_all on public.task_instances;
drop policy if exists task_instances_select_canon on public.task_instances;
drop policy if exists task_instances_insert_canon on public.task_instances;
drop policy if exists task_instances_update_management_canon on public.task_instances;
drop policy if exists task_instances_update_complete_canon on public.task_instances;

create policy task_instances_select_canon
on public.task_instances
for select
to authenticated
using (
  public.current_user_can_view_task_instance_row(
    restaurant_id,
    assigned_zone_id,
    assigned_role,
    assigned_employee_id
  )
);

create policy task_instances_insert_canon
on public.task_instances
for insert
to authenticated
with check (
  public.current_user_can_manage_task_restaurant(restaurant_id)
);

create policy task_instances_update_management_canon
on public.task_instances
for update
to authenticated
using (
  public.current_user_can_manage_task_restaurant(restaurant_id)
)
with check (
  public.current_user_can_manage_task_restaurant(restaurant_id)
);

create policy task_instances_update_complete_canon
on public.task_instances
for update
to authenticated
using (
  public.current_user_can_complete_task_instance_row(
    restaurant_id,
    assigned_zone_id,
    assigned_role,
    assigned_employee_id
  )
)
with check (
  public.current_user_can_complete_task_instance_update(
    task_instance_id,
    task_template_id,
    restaurant_id,
    task_date,
    shift_context,
    assigned_role,
    assigned_zone_id,
    assigned_employee_id,
    task_status,
    cancel_reason,
    reassignment_reason,
    due_at,
    completed_by,
    completed_at,
    requires_confirmation,
    confirmed_by,
    confirmed_at,
    confirmation_note,
    confirmation_photo_url
  )
);

drop policy if exists incidents_admin_all on public.incidents;
drop policy if exists incidents_select_canon on public.incidents;
drop policy if exists incidents_insert_canon on public.incidents;
drop policy if exists incidents_update_canon on public.incidents;

create policy incidents_select_canon
on public.incidents
for select
to authenticated
using (
  public.current_user_can_view_incident_row(
    restaurant_id,
    zone_id,
    sensitivity,
    reported_by
  )
);

create policy incidents_insert_canon
on public.incidents
for insert
to authenticated
with check (
  public.current_user_can_insert_incident_row(
    restaurant_id,
    zone_id,
    reported_by
  )
);

create policy incidents_update_canon
on public.incidents
for update
to authenticated
using (
  public.current_user_can_manage_incident_category(restaurant_id, category)
)
with check (
  public.current_user_can_update_incident_row(
    incident_id,
    restaurant_id,
    zone_id,
    category,
    sensitivity,
    title,
    description,
    severity,
    reported_by,
    primary_owner,
    status
  )
);

drop policy if exists shift_swap_requests_admin_all on public.shift_swap_requests;
drop policy if exists shift_swap_requests_select_canon on public.shift_swap_requests;
drop policy if exists shift_swap_requests_insert_canon on public.shift_swap_requests;
drop policy if exists shift_swap_requests_update_peer_canon on public.shift_swap_requests;
drop policy if exists shift_swap_requests_update_manager_canon on public.shift_swap_requests;

create policy shift_swap_requests_select_canon
on public.shift_swap_requests
for select
to authenticated
using (
  public.current_user_can_view_shift_swap_row(
    requester_employee_id,
    target_employee_id,
    requester_schedule_entry_id
  )
);

create policy shift_swap_requests_insert_canon
on public.shift_swap_requests
for insert
to authenticated
with check (
  public.current_user_can_insert_shift_swap(
    requester_employee_id,
    target_employee_id,
    requester_schedule_entry_id,
    target_schedule_entry_id,
    status,
    peer_responded_at,
    reviewed_by,
    reviewed_at
  )
);

create policy shift_swap_requests_update_peer_canon
on public.shift_swap_requests
for update
to authenticated
using (
  public.is_admin_actor()
  or (
    public.current_system_role()::public.system_role_enum = 'employee'::public.system_role_enum
    and target_employee_id = auth.uid()
    and status = 'pending_peer'::public.shift_swap_status_enum
  )
)
with check (
  public.current_user_can_peer_update_shift_swap(
    shift_swap_request_id,
    requester_employee_id,
    target_employee_id,
    requester_schedule_entry_id,
    target_schedule_entry_id,
    status,
    requested_at,
    peer_responded_at,
    reviewed_by,
    reviewed_at,
    reason
  )
);

create policy shift_swap_requests_update_manager_canon
on public.shift_swap_requests
for update
to authenticated
using (
  public.is_admin_actor()
  or (
    public.current_system_role()::public.system_role_enum = 'manager'::public.system_role_enum
    and exists (
      select 1
      from public.schedule_entries se
      join public.schedules s
        on s.id = se.schedule_id
      where se.id = shift_swap_requests.requester_schedule_entry_id
        and public.current_scope_covers_restaurant(s.restaurant_id)
    )
    and status = 'pending_manager'::public.shift_swap_status_enum
  )
)
with check (
  public.current_user_can_manager_review_shift_swap(
    shift_swap_request_id,
    requester_employee_id,
    target_employee_id,
    requester_schedule_entry_id,
    target_schedule_entry_id,
    status,
    requested_at,
    peer_responded_at,
    reviewed_by,
    reviewed_at,
    reason
  )
);

grant execute on function public.current_user_can_read_task_templates(uuid) to authenticated;
grant execute on function public.current_user_can_manage_task_restaurant(uuid) to authenticated;
grant execute on function public.current_user_can_view_task_instance_row(uuid, uuid, public.system_role_enum, uuid) to authenticated;
grant execute on function public.current_user_can_complete_task_instance_row(uuid, uuid, public.system_role_enum, uuid) to authenticated;
grant execute on function public.current_user_can_complete_task_instance_update(
  uuid,
  uuid,
  uuid,
  date,
  text,
  public.system_role_enum,
  uuid,
  uuid,
  public.task_status_enum,
  public.task_cancel_reason_enum,
  public.task_reassignment_reason_enum,
  timestamptz,
  uuid,
  timestamptz,
  boolean,
  uuid,
  timestamptz,
  text,
  text
) to authenticated;
grant execute on function public.current_user_can_view_incident_row(uuid, uuid, public.incident_sensitivity_enum, uuid) to authenticated;
grant execute on function public.current_user_can_insert_incident_row(uuid, uuid, uuid) to authenticated;
grant execute on function public.current_user_can_manage_incident_category(uuid, public.incident_category_enum) to authenticated;
grant execute on function public.current_user_can_update_incident_row(
  uuid,
  uuid,
  uuid,
  public.incident_category_enum,
  public.incident_sensitivity_enum,
  text,
  text,
  public.incident_severity_enum,
  uuid,
  uuid,
  public.incident_status_enum
) to authenticated;
grant execute on function public.current_user_can_view_shift_swap_row(uuid, uuid, uuid) to authenticated;
grant execute on function public.current_user_can_insert_shift_swap(
  uuid,
  uuid,
  uuid,
  uuid,
  public.shift_swap_status_enum,
  timestamptz,
  uuid,
  timestamptz
) to authenticated;
grant execute on function public.current_user_can_peer_update_shift_swap(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  public.shift_swap_status_enum,
  timestamptz,
  timestamptz,
  uuid,
  timestamptz,
  text
) to authenticated;
grant execute on function public.current_user_can_manager_review_shift_swap(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  public.shift_swap_status_enum,
  timestamptz,
  timestamptz,
  uuid,
  timestamptz,
  text
) to authenticated;

commit;
