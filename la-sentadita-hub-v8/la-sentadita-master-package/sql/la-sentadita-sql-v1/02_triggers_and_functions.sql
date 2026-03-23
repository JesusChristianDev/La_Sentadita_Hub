-- La Sentadita Hub — Triggers and Functions v1

-- ============================================================================
-- UPDATED_AT
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'chains',
    'companies',
    'restaurants',
    'zones',
    'persons',
    'role_scope_assignments',
    'employment_relationships',
    'schedules',
    'schedule_entries',
    'task_templates',
    'task_instances',
    'procedures',
    'incidents',
    'documents'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================================
-- HELPERS FOR AUTH / CONTEXT
-- ============================================================================

create or replace function public.current_person_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.person_id', true), '')::uuid
$$;

create or replace function public.current_system_role()
returns public.system_role_enum
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.system_role', true), '')::public.system_role_enum
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select public.current_system_role() = 'admin'::public.system_role_enum
$$;

-- ============================================================================
-- AUDIT HELPER
-- ============================================================================

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

-- ============================================================================
-- BASIC VALIDATION HELPERS
-- ============================================================================

create or replace function public.validate_task_instance_state()
returns trigger
language plpgsql
as $$
begin
  if new.task_status = 'cancelled' and new.cancel_reason is null then
    raise exception 'cancel_reason is required when task_status = cancelled';
  end if;

  if new.task_status = 'needs_reassignment' and new.reassignment_reason is null then
    raise exception 'reassignment_reason is required when task_status = needs_reassignment';
  end if;

  if new.task_status in ('pending','completed','overdue') and (new.cancel_reason is not null or new.reassignment_reason is not null) then
    raise exception 'cancel_reason and reassignment_reason must be null for status %', new.task_status;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_task_instances_validate_state on public.task_instances;
create trigger trg_task_instances_validate_state
before insert or update on public.task_instances
for each row execute function public.validate_task_instance_state();

create or replace function public.validate_no_self_approval_procedure()
returns trigger
language plpgsql
as $$
begin
  if new.reviewed_by is not null and new.requested_by = new.reviewed_by then
    raise exception 'self approval is not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_procedures_no_self_approval on public.procedures;
create trigger trg_procedures_no_self_approval
before insert or update on public.procedures
for each row execute function public.validate_no_self_approval_procedure();

-- ============================================================================
-- PLACEHOLDER NOTE
-- ============================================================================

-- NOTE:
-- Overlap prevention and one-restaurant-per-day rules are best enforced with
-- service-layer logic and/or additional generated-range strategy once final
-- schedule time modeling is fully fixed. This package leaves those as
-- application invariants plus future DB hardening.
