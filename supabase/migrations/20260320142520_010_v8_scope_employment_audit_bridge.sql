begin;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'audit_action_enum'
  ) then
    create type public.audit_action_enum as enum (
      'person_created',
      'person_archived',
      'person_identity_updated',
      'system_role_changed',
      'employment_relationship_created',
      'employment_relationship_updated',
      'employment_relationship_terminated',
      'role_scope_assignment_created',
      'role_scope_assignment_updated',
      'role_scope_assignment_deactivated',
      'move_company',
      'move_restaurant',
      'schedule_created',
      'schedule_entry_updated',
      'schedule_published',
      'schedule_republished',
      'schedule_lock_acquired',
      'schedule_lock_denied',
      'schedule_lock_expired',
      'schedule_lock_force_released',
      'task_created',
      'task_status_changed',
      'task_confirmed',
      'task_reassigned',
      'task_cancelled',
      'task_generated_from_schedule',
      'procedure_created',
      'procedure_status_changed',
      'procedure_derived',
      'procedure_applied_to_schedule',
      'procedure_dates_updated',
      'shift_swap_requested',
      'shift_swap_peer_accepted',
      'shift_swap_peer_rejected',
      'shift_swap_manager_approved',
      'shift_swap_manager_rejected',
      'shift_swap_expired',
      'shift_swap_applied',
      'incident_created',
      'incident_status_changed',
      'incident_assigned',
      'incident_restricted_marked',
      'document_uploaded',
      'document_viewed',
      'document_downloaded',
      'document_archived',
      'document_superseded',
      'delivery_note_uploaded',
      'delivery_note_employee_reviewed',
      'delivery_note_office_confirmed',
      'delivery_note_office_rejected',
      'supplier_created',
      'product_created',
      'notification_created',
      'notification_sent',
      'notification_sent_push',
      'notification_failed',
      'notification_read'
    );
  end if;
end $$;

create table if not exists public.role_scope_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(person_id) on delete cascade,
  scope_type public.scope_type_enum not null,
  scope_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_role_scope_active_unique
  on public.role_scope_assignments(
    person_id,
    scope_type,
    coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where active = true;

create table if not exists public.employment_relationships (
  employment_id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(person_id) on delete restrict,
  company_id uuid not null references public.companies(company_id) on delete restrict,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  job_title text not null,
  contract_type text,
  agreed_monthly_hours numeric(8,2),
  max_daily_hours numeric(6,2),
  requires_schedule boolean not null default true,
  availability_json jsonb,
  planning_notes text,
  start_date date not null default current_date,
  end_date date,
  active_principal boolean not null default true,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create unique index if not exists idx_employment_one_active_principal_per_person
  on public.employment_relationships(person_id)
  where active_principal = true and end_date is null and is_archived = false;

create index if not exists idx_employment_relationships_restaurant_id
  on public.employment_relationships(restaurant_id);

create index if not exists idx_employment_relationships_person_active
  on public.employment_relationships(person_id, active_principal)
  where active_principal = true;

create table if not exists public.audit_logs (
  audit_id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  action public.audit_action_enum not null,
  actor_user_id uuid references public.persons(person_id) on delete set null,
  actor_role public.system_role_enum,
  scope_type public.scope_type_enum,
  scope_id uuid,
  previous_value_json jsonb,
  new_value_json jsonb,
  reason text,
  trace_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity
  on public.audit_logs(entity_type, entity_id);

create index if not exists idx_audit_logs_trace
  on public.audit_logs(trace_id);

create index if not exists idx_audit_logs_actor
  on public.audit_logs(actor_user_id, created_at desc);

create or replace function public.current_person_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

create or replace function public.current_system_role()
returns public.system_role_enum
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.system_role
  from public.persons p
  where p.person_id = auth.uid()
  limit 1
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_system_role() = 'admin'::public.system_role_enum
$$;

create or replace function public.insert_audit_log(
  p_entity_type text,
  p_entity_id uuid,
  p_action public.audit_action_enum,
  p_scope_type public.scope_type_enum,
  p_scope_id uuid,
  p_previous_value jsonb,
  p_new_value jsonb,
  p_reason text,
  p_trace_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.audit_logs (
    entity_type,
    entity_id,
    action,
    actor_user_id,
    actor_role,
    scope_type,
    scope_id,
    previous_value_json,
    new_value_json,
    reason,
    trace_id
  )
  values (
    p_entity_type,
    p_entity_id,
    p_action,
    public.current_person_id(),
    public.current_system_role(),
    p_scope_type,
    p_scope_id,
    p_previous_value,
    p_new_value,
    p_reason,
    p_trace_id
  );
end;
$$;

grant execute on function public.current_person_id() to authenticated;
grant execute on function public.current_system_role() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.insert_audit_log(
  text,
  uuid,
  public.audit_action_enum,
  public.scope_type_enum,
  uuid,
  jsonb,
  jsonb,
  text,
  uuid
) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['role_scope_assignments', 'employment_relationships']
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t,
      t
    );
  end loop;
end $$;

commit;
