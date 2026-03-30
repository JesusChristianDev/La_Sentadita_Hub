begin;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'access_status_enum'
  ) then
    create type public.access_status_enum as enum (
      'pending_activation',
      'active',
      'suspended',
      'archived',
      'blocked'
    );
  end if;
end $$;

alter table if exists public.persons
  add column if not exists access_status public.access_status_enum;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'persons'
      and column_name = 'onboarding_status'
  ) then
    execute $sql$
      update public.persons
      set access_status = case
        when access_status is not null then access_status
        when coalesce(is_archived, false) or deleted_at is not null
          then 'archived'::public.access_status_enum
        when onboarding_status::text = 'pending_activation'
          then 'pending_activation'::public.access_status_enum
        when onboarding_status::text = 'suspended'
          then 'suspended'::public.access_status_enum
        else 'active'::public.access_status_enum
      end
      where access_status is null
    $sql$;

    alter table public.persons
      drop column onboarding_status;
  else
    update public.persons
    set access_status = case
      when coalesce(is_archived, false) or deleted_at is not null
        then 'archived'::public.access_status_enum
      else 'active'::public.access_status_enum
    end
    where access_status is null;
  end if;
end $$;

update public.persons
set access_status = 'pending_activation'::public.access_status_enum
where access_status is null;

alter table if exists public.persons
  alter column access_status set default 'pending_activation'::public.access_status_enum,
  alter column access_status set not null;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'procedures'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'requests'
  ) then
    alter table public.procedures rename to requests;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'procedure_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'request_id'
  ) then
    alter table public.requests rename column procedure_id to request_id;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'procedure_type'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'request_type'
  ) then
    alter table public.requests rename column procedure_type to request_type;
  end if;
end $$;

alter table if exists public.requests enable row level security;

drop index if exists public.idx_procedures_employment_status;
create index if not exists idx_requests_employment_status
  on public.requests(employment_id, status);

drop policy if exists persons_select_self_or_admin on public.persons;
drop policy if exists persons_select_by_scope on public.persons;
drop policy if exists persons_admin_all on public.persons;

drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_admin_all on public.notifications;

drop policy if exists push_devices_manage_own on public.push_devices;
drop policy if exists documents_select_initial on public.documents;
drop policy if exists documents_admin_all on public.documents;
drop policy if exists audit_logs_admin_only on public.audit_logs;
drop policy if exists notification_preferences_manage_own on public.notification_preferences;

drop policy if exists employment_relationships_select_by_scope on public.employment_relationships;
drop policy if exists role_scope_assignments_select_by_scope on public.role_scope_assignments;
drop policy if exists schedules_select_by_scope on public.schedules;
drop policy if exists schedules_write_by_scope on public.schedules;
drop policy if exists shift_templates_select_by_scope on public.shift_templates;
drop policy if exists shift_templates_write_by_scope on public.shift_templates;
drop policy if exists schedule_entries_select_by_scope on public.schedule_entries;
drop policy if exists schedule_entries_write_by_scope on public.schedule_entries;
drop policy if exists schedule_entry_adjustments_select_by_scope on public.schedule_entry_adjustments;
drop policy if exists schedule_entry_logs_select_by_scope on public.schedule_entry_logs;
drop policy if exists schedule_lock_logs_select_by_scope on public.schedule_lock_logs;

drop policy if exists procedures_admin_all on public.requests;
drop policy if exists requests_admin_all on public.requests;
drop policy if exists zones_admin_all on public.restaurant_zones;
drop policy if exists chain_subscriptions_admin_all on public.chain_subscriptions;
drop policy if exists chains_admin_all on public.chains;
drop policy if exists companies_admin_all on public.companies;
drop policy if exists employment_relationships_admin_all on public.employment_relationships;
drop policy if exists role_scope_assignments_admin_all on public.role_scope_assignments;
drop policy if exists restaurant_zones_admin_all on public.restaurant_zones;
drop policy if exists task_templates_admin_all on public.task_templates;
drop policy if exists task_instances_admin_all on public.task_instances;
drop policy if exists shift_swap_requests_admin_all on public.shift_swap_requests;
drop policy if exists incidents_admin_all on public.incidents;
drop policy if exists suppliers_admin_all on public.suppliers;
drop policy if exists products_admin_all on public.products;
drop policy if exists supplier_product_aliases_admin_all on public.supplier_product_aliases;
drop policy if exists delivery_notes_admin_all on public.delivery_notes;
drop policy if exists delivery_note_lines_admin_all on public.delivery_note_lines;
drop policy if exists vacation_entitlements_admin_all on public.vacation_entitlements;
drop policy if exists time_records_admin_all on public.time_records;

drop function if exists public.insert_audit_log(
  text,
  uuid,
  public.audit_action_enum,
  public.scope_type_enum,
  uuid,
  jsonb,
  jsonb,
  text,
  uuid
);
drop function if exists public.current_system_role();
drop function if exists public.is_platform_admin();
drop function if exists public.is_admin_actor();
drop function if exists public.validate_role_scope_assignment_scope_id() cascade;
drop function if exists public.validate_supplier_scope_id() cascade;
drop function if exists public.validate_document_owner_id() cascade;
drop function if exists public.validate_no_self_approval_procedure() cascade;
drop function if exists public.validate_no_self_approval_request() cascade;
drop function if exists public.is_schedule_manager_or_office_for_restaurant(uuid);
drop function if exists public.sync_person_projection(uuid);
drop function if exists public.legacy_profile_to_system_role(public.app_role, boolean);
drop function if exists public.sync_legacy_person_projection(uuid);
drop function if exists public.sync_legacy_scope_projection(uuid);
drop function if exists public.sync_legacy_employment_projection(uuid);
drop function if exists public.sync_legacy_profile_projection();

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'system_role_enum_canon'
  ) then
    create type public.system_role_enum_canon as enum (
      'admin',
      'owner',
      'office',
      'manager',
      'area_lead',
      'employee'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'scope_type_enum_canon'
  ) then
    create type public.scope_type_enum_canon as enum (
      'organization',
      'company',
      'restaurant',
      'zone'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'supplier_scope_enum_canon'
  ) then
    create type public.supplier_scope_enum_canon as enum (
      'organization',
      'restaurant'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'audit_action_enum_canon'
  ) then
    create type public.audit_action_enum_canon as enum (
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
      'request_created',
      'request_status_changed',
      'request_derived',
      'request_applied_to_schedule',
      'request_dates_updated',
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

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'document_owner_type_enum_canon'
  ) then
    create type public.document_owner_type_enum_canon as enum (
      'person',
      'employment_relationship',
      'request',
      'restaurant',
      'delivery_note'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'notification_type_enum_canon'
  ) then
    create type public.notification_type_enum_canon as enum (
      'schedule_published',
      'schedule_updated',
      'schedule_lock_force_released',
      'task_assigned',
      'task_due_soon',
      'task_overdue',
      'task_needs_reassignment',
      'task_cancelled',
      'request_created',
      'request_approved',
      'request_rejected',
      'request_cancelled',
      'request_in_review',
      'request_derived',
      'request_dates_updated',
      'shift_swap_request',
      'shift_swap_accepted',
      'shift_swap_rejected',
      'shift_swap_pending_manager',
      'shift_swap_manager_approved',
      'shift_swap_manager_rejected',
      'shift_swap_expired',
      'incident_created',
      'incident_assigned',
      'incident_status_changed',
      'incident_resolved',
      'document_uploaded',
      'document_requires_signature',
      'document_superseded',
      'system_role_changed',
      'employment_terminated',
      'password_must_change',
      'push_device_registered',
      'delivery_note_submitted',
      'delivery_note_confirmed',
      'delivery_note_rejected'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'task_reassignment_reason_enum_canon'
  ) then
    create type public.task_reassignment_reason_enum_canon as enum (
      'employment_change',
      'request_conflict',
      'shift_swap',
      'manual_reassignment_required'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'request_type_enum'
  ) then
    create type public.request_type_enum as enum (
      'vacation',
      'sick_leave',
      'justified_absence',
      'absence'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'request_status_enum'
  ) then
    create type public.request_status_enum as enum (
      'requested',
      'approved',
      'rejected',
      'cancelled',
      'expired',
      'reported',
      'validated',
      'closed',
      'in_review',
      'resolved'
    );
  end if;
end $$;

alter table if exists public.persons
  alter column system_role type public.system_role_enum_canon
  using (
    case system_role::text
      when 'chain_owner' then 'owner'
      when 'sub_manager' then 'manager'
      else system_role::text
    end
  )::public.system_role_enum_canon;

alter table if exists public.audit_logs
  alter column actor_role type public.system_role_enum_canon
  using (
    case
      when actor_role is null then null
      when actor_role::text = 'chain_owner' then 'owner'
      when actor_role::text = 'sub_manager' then 'manager'
      else actor_role::text
    end
  )::public.system_role_enum_canon,
  alter column scope_type type public.scope_type_enum_canon
  using (
    case
      when scope_type is null then null
      when scope_type::text in ('platform', 'chain') then 'organization'
      else scope_type::text
    end
  )::public.scope_type_enum_canon,
  alter column action type public.audit_action_enum_canon
  using (
    case action::text
      when 'procedure_created' then 'request_created'
      when 'procedure_status_changed' then 'request_status_changed'
      when 'procedure_derived' then 'request_derived'
      when 'procedure_applied_to_schedule' then 'request_applied_to_schedule'
      when 'procedure_dates_updated' then 'request_dates_updated'
      else action::text
    end
  )::public.audit_action_enum_canon;

alter table if exists public.task_templates
  alter column confirmation_role type public.system_role_enum_canon
  using (
    case
      when confirmation_role is null then null
      when confirmation_role::text = 'chain_owner' then 'owner'
      when confirmation_role::text = 'sub_manager' then 'manager'
      else confirmation_role::text
    end
  )::public.system_role_enum_canon;

alter table if exists public.task_instances
  alter column assigned_role type public.system_role_enum_canon
  using (
    case
      when assigned_role is null then null
      when assigned_role::text = 'chain_owner' then 'owner'
      when assigned_role::text = 'sub_manager' then 'manager'
      else assigned_role::text
    end
  )::public.system_role_enum_canon,
  alter column reassignment_reason type public.task_reassignment_reason_enum_canon
  using (
    case
      when reassignment_reason is null then null
      when reassignment_reason::text = 'procedure_conflict' then 'request_conflict'
      else reassignment_reason::text
    end
  )::public.task_reassignment_reason_enum_canon;

alter table if exists public.role_scope_assignments
  alter column scope_type type public.scope_type_enum_canon
  using (
    case scope_type::text
      when 'platform' then 'organization'
      when 'chain' then 'organization'
      else scope_type::text
    end
  )::public.scope_type_enum_canon;

alter table if exists public.suppliers
  alter column scope_type type public.supplier_scope_enum_canon
  using (
    case scope_type::text
      when 'chain' then 'organization'
      else scope_type::text
    end
  )::public.supplier_scope_enum_canon;

alter table if exists public.documents
  alter column owner_type type public.document_owner_type_enum_canon
  using (
    case owner_type::text
      when 'procedure' then 'request'
      else owner_type::text
    end
  )::public.document_owner_type_enum_canon;

alter table if exists public.notifications
  alter column notification_type type public.notification_type_enum_canon
  using (
    case notification_type::text
      when 'procedure_created' then 'request_created'
      when 'procedure_approved' then 'request_approved'
      when 'procedure_rejected' then 'request_rejected'
      when 'procedure_cancelled' then 'request_cancelled'
      when 'procedure_in_review' then 'request_in_review'
      when 'procedure_derived' then 'request_derived'
      when 'procedure_dates_updated' then 'request_dates_updated'
      else notification_type::text
    end
  )::public.notification_type_enum_canon;

alter table if exists public.notification_outbox
  alter column notification_type type public.notification_type_enum_canon
  using (
    case
      when notification_type is null then null
      when notification_type::text = 'procedure_created' then 'request_created'
      when notification_type::text = 'procedure_approved' then 'request_approved'
      when notification_type::text = 'procedure_rejected' then 'request_rejected'
      when notification_type::text = 'procedure_cancelled' then 'request_cancelled'
      when notification_type::text = 'procedure_in_review' then 'request_in_review'
      when notification_type::text = 'procedure_derived' then 'request_derived'
      when notification_type::text = 'procedure_dates_updated' then 'request_dates_updated'
      else notification_type::text
    end
  )::public.notification_type_enum_canon;

alter table if exists public.notification_preferences
  alter column notification_type type public.notification_type_enum_canon
  using (
    case notification_type::text
      when 'procedure_created' then 'request_created'
      when 'procedure_approved' then 'request_approved'
      when 'procedure_rejected' then 'request_rejected'
      when 'procedure_cancelled' then 'request_cancelled'
      when 'procedure_in_review' then 'request_in_review'
      when 'procedure_derived' then 'request_derived'
      when 'procedure_dates_updated' then 'request_dates_updated'
      else notification_type::text
    end
  )::public.notification_type_enum_canon;

alter table if exists public.requests
  alter column request_type type public.request_type_enum
  using (request_type::text::public.request_type_enum),
  alter column status type public.request_status_enum
  using (status::text::public.request_status_enum);

do $$
begin
  if exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'system_role_enum'
  ) and exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'system_role_enum_canon'
  ) then
    alter type public.system_role_enum rename to system_role_enum_legacy;
    alter type public.system_role_enum_canon rename to system_role_enum;
  end if;

  if exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'scope_type_enum'
  ) and exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'scope_type_enum_canon'
  ) then
    alter type public.scope_type_enum rename to scope_type_enum_legacy;
    alter type public.scope_type_enum_canon rename to scope_type_enum;
  end if;

  if exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'supplier_scope_enum'
  ) and exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'supplier_scope_enum_canon'
  ) then
    alter type public.supplier_scope_enum rename to supplier_scope_enum_legacy;
    alter type public.supplier_scope_enum_canon rename to supplier_scope_enum;
  end if;

  if exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'audit_action_enum'
  ) and exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'audit_action_enum_canon'
  ) then
    alter type public.audit_action_enum rename to audit_action_enum_legacy;
    alter type public.audit_action_enum_canon rename to audit_action_enum;
  end if;

  if exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'document_owner_type_enum'
  ) and exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'document_owner_type_enum_canon'
  ) then
    alter type public.document_owner_type_enum rename to document_owner_type_enum_legacy;
    alter type public.document_owner_type_enum_canon rename to document_owner_type_enum;
  end if;

  if exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'notification_type_enum'
  ) and exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'notification_type_enum_canon'
  ) then
    alter type public.notification_type_enum rename to notification_type_enum_legacy;
    alter type public.notification_type_enum_canon rename to notification_type_enum;
  end if;

  if exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'task_reassignment_reason_enum'
  ) and exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'task_reassignment_reason_enum_canon'
  ) then
    alter type public.task_reassignment_reason_enum rename to task_reassignment_reason_enum_legacy;
    alter type public.task_reassignment_reason_enum_canon rename to task_reassignment_reason_enum;
  end if;
end $$;

drop type if exists public.system_role_enum_legacy;
drop type if exists public.scope_type_enum_legacy;
drop type if exists public.supplier_scope_enum_legacy;
drop type if exists public.audit_action_enum_legacy;
drop type if exists public.document_owner_type_enum_legacy;
drop type if exists public.notification_type_enum_legacy;
drop type if exists public.task_reassignment_reason_enum_legacy;
drop type if exists public.procedure_type_enum;
drop type if exists public.procedure_status_enum;

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

create or replace function public.is_admin_actor()
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

create or replace function public.validate_role_scope_assignment_scope_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.scope_type = 'organization' then
    if new.scope_id is not null then
      raise exception 'scope_id must be null for scope_type = organization';
    end if;
    return new;
  end if;

  if new.scope_id is null then
    raise exception 'scope_id is required for scope_type = %', new.scope_type;
  end if;

  if new.scope_type = 'company' then
    if not exists (select 1 from public.companies where company_id = new.scope_id) then
      raise exception 'scope_id % does not exist in companies', new.scope_id;
    end if;
  elsif new.scope_type = 'restaurant' then
    if not exists (select 1 from public.restaurants where id = new.scope_id) then
      raise exception 'scope_id % does not exist in restaurants', new.scope_id;
    end if;
  elsif new.scope_type = 'zone' then
    if not exists (select 1 from public.restaurant_zones where id = new.scope_id) then
      raise exception 'scope_id % does not exist in restaurant_zones', new.scope_id;
    end if;
  else
    raise exception 'unrecognized scope_type: %', new.scope_type;
  end if;

  return new;
end;
$$;

create or replace function public.validate_supplier_scope_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.scope_type = 'organization' then
    if not exists (select 1 from public.chains where chain_id = new.scope_id) then
      raise exception 'supplier scope_id % does not exist in organization backing scope', new.scope_id;
    end if;
  elsif new.scope_type = 'restaurant' then
    if not exists (select 1 from public.restaurants where id = new.scope_id) then
      raise exception 'supplier scope_id % does not exist in restaurants', new.scope_id;
    end if;
  else
    raise exception 'unrecognized supplier scope_type: %', new.scope_type;
  end if;

  return new;
end;
$$;

create or replace function public.validate_document_owner_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.owner_type = 'person' then
    if not exists (select 1 from public.persons where person_id = new.owner_id) then
      raise exception 'owner_id % does not exist in persons', new.owner_id;
    end if;
  elsif new.owner_type = 'employment_relationship' then
    if not exists (select 1 from public.employment_relationships where employment_id = new.owner_id) then
      raise exception 'owner_id % does not exist in employment_relationships', new.owner_id;
    end if;
  elsif new.owner_type = 'request' then
    if not exists (select 1 from public.requests where request_id = new.owner_id) then
      raise exception 'owner_id % does not exist in requests', new.owner_id;
    end if;
  elsif new.owner_type = 'restaurant' then
    if not exists (select 1 from public.restaurants where id = new.owner_id) then
      raise exception 'owner_id % does not exist in restaurants', new.owner_id;
    end if;
  elsif new.owner_type = 'delivery_note' then
    if not exists (select 1 from public.delivery_notes where delivery_note_id = new.owner_id) then
      raise exception 'owner_id % does not exist in delivery_notes', new.owner_id;
    end if;
  else
    raise exception 'unrecognized owner_type: %', new.owner_type;
  end if;

  return new;
end;
$$;

create or replace function public.validate_no_self_approval_request()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reviewed_by is not null and new.requested_by = new.reviewed_by then
    raise exception 'self approval is not allowed';
  end if;

  return new;
end;
$$;

create or replace function public.is_schedule_manager_or_office_for_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_system_role() in (
    'manager'::public.system_role_enum,
    'office'::public.system_role_enum,
    'admin'::public.system_role_enum
  )
  and public.current_user_restaurant_id() = p_restaurant_id
$$;

create or replace function public.sync_person_projection(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_chain_id uuid;
  v_email text;
  v_first_name text;
  v_full_name text;
  v_last_name text;
begin
  select
    u.email,
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      'SinNombre'
    )
  into v_email, v_full_name
  from auth.users u
  where u.id = p_profile_id;

  if not found then
    return;
  end if;

  select p.chain_id
  into v_chain_id
  from public.persons p
  where p.person_id = p_profile_id;

  if v_chain_id is null then
    select r.chain_id
    into v_chain_id
    from public.employment_relationships er
    join public.restaurants r
      on r.id = er.restaurant_id
    where er.person_id = p_profile_id
      and er.active_principal = true
      and er.is_archived = false
    order by er.created_at desc
    limit 1;
  end if;

  v_first_name := coalesce(
    nullif(split_part(trim(v_full_name), ' ', 1), ''),
    'SinNombre'
  );
  v_last_name := coalesce(
    nullif(
      ltrim(
        substr(
          trim(v_full_name),
          length(split_part(trim(v_full_name), ' ', 1)) + 1
        )
      ),
      ''
    ),
    ''
  );

  insert into public.persons (
    person_id,
    chain_id,
    first_name,
    last_name,
    email,
    system_role,
    access_status,
    is_archived,
    deleted_at,
    created_at,
    updated_at
  )
  values (
    p_profile_id,
    coalesce(v_chain_id, '00000000-0000-0000-0000-000000000001'::uuid),
    v_first_name,
    v_last_name,
    v_email,
    'employee'::public.system_role_enum,
    'active'::public.access_status_enum,
    false,
    null,
    now(),
    now()
  )
  on conflict (person_id) do update
  set
    chain_id = coalesce(public.persons.chain_id, excluded.chain_id),
    email = coalesce(public.persons.email, excluded.email),
    first_name = coalesce(nullif(public.persons.first_name, ''), excluded.first_name),
    last_name = coalesce(public.persons.last_name, excluded.last_name),
    updated_at = now();
end;
$$;

grant execute on function public.current_system_role() to authenticated;
grant execute on function public.is_admin_actor() to authenticated;
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
grant execute on function public.sync_person_projection(uuid) to authenticated;

drop trigger if exists trg_role_scope_assignments_scope_fk on public.role_scope_assignments;
create trigger trg_role_scope_assignments_scope_fk
before insert or update on public.role_scope_assignments
for each row
execute function public.validate_role_scope_assignment_scope_id();

drop trigger if exists trg_suppliers_scope_validation on public.suppliers;
drop trigger if exists trg_suppliers_scope_fk on public.suppliers;
create trigger trg_suppliers_scope_fk
before insert or update on public.suppliers
for each row
execute function public.validate_supplier_scope_id();

drop trigger if exists trg_documents_owner_fk on public.documents;
create trigger trg_documents_owner_fk
before insert or update on public.documents
for each row
execute function public.validate_document_owner_id();

drop trigger if exists trg_procedures_no_self_approval on public.requests;
drop trigger if exists trg_requests_no_self_approval on public.requests;
create trigger trg_requests_no_self_approval
before insert or update on public.requests
for each row
execute function public.validate_no_self_approval_request();

create policy persons_select_self_or_admin
on public.persons
for select
using (
  person_id = public.current_person_id()
  or public.is_admin_actor()
);

create policy persons_select_by_scope
on public.persons
for select
using (
  public.is_admin_actor()
  or person_id = public.current_person_id()
  or (
    public.current_system_role() = any (
      array[
        'manager'::public.system_role_enum,
        'area_lead'::public.system_role_enum,
        'office'::public.system_role_enum
      ]
    )
    and person_id in (
      select er.person_id
      from public.employment_relationships er
      where er.restaurant_id = public.current_user_restaurant_id()
        and er.is_archived = false
    )
  )
);

create policy persons_admin_all
on public.persons
for all
using (public.is_admin_actor())
with check (public.is_admin_actor());

create policy notifications_select_own
on public.notifications
for select
using (
  recipient_user_id = public.current_person_id()
  or public.is_admin_actor()
);

create policy notifications_update_own
on public.notifications
for update
using (
  recipient_user_id = public.current_person_id()
  or public.is_admin_actor()
)
with check (
  recipient_user_id = public.current_person_id()
  or public.is_admin_actor()
);

create policy notifications_admin_all
on public.notifications
for all
using (public.is_admin_actor())
with check (public.is_admin_actor());

create policy push_devices_manage_own
on public.push_devices
for all
using (
  person_id = public.current_person_id()
  or public.is_admin_actor()
)
with check (
  person_id = public.current_person_id()
  or public.is_admin_actor()
);

create policy documents_select_initial
on public.documents
for select
using (
  public.is_admin_actor()
  or (
    visibility = 'employee_visible'::public.document_visibility_enum
    and (
      (owner_type = 'person'::public.document_owner_type_enum and owner_id = public.current_person_id())
      or (
        owner_type = 'employment_relationship'::public.document_owner_type_enum
        and exists (
          select 1
          from public.employment_relationships er
          where er.employment_id = documents.owner_id
            and er.person_id = public.current_person_id()
            and er.is_archived = false
        )
      )
      or (
        owner_type = 'request'::public.document_owner_type_enum
        and exists (
          select 1
          from public.requests r
          join public.employment_relationships er
            on er.employment_id = r.employment_id
          where r.request_id = documents.owner_id
            and er.person_id = public.current_person_id()
            and er.is_archived = false
        )
      )
    )
  )
);

create policy documents_admin_all
on public.documents
for all
using (public.is_admin_actor())
with check (public.is_admin_actor());

create policy audit_logs_admin_only
on public.audit_logs
for select
using (public.is_admin_actor());

create policy notification_preferences_manage_own
on public.notification_preferences
for all
using (
  person_id = public.current_person_id()
  or public.is_admin_actor()
)
with check (
  person_id = public.current_person_id()
  or public.is_admin_actor()
);

create policy employment_relationships_select_by_scope
on public.employment_relationships
for select
using (
  public.is_admin_actor()
  or (
    public.current_system_role() = any (
      array[
        'manager'::public.system_role_enum,
        'area_lead'::public.system_role_enum,
        'office'::public.system_role_enum
      ]
    )
    and restaurant_id = public.current_user_restaurant_id()
  )
  or (
    public.current_system_role() = 'employee'::public.system_role_enum
    and person_id = public.current_person_id()
  )
  or (
    public.current_system_role() = 'owner'::public.system_role_enum
    and company_id in (
      select c.company_id
      from public.companies c
      join public.persons p
        on p.chain_id = c.chain_id
      where p.person_id = public.current_person_id()
    )
  )
);

create policy role_scope_assignments_select_by_scope
on public.role_scope_assignments
for select
using (
  public.is_admin_actor()
  or person_id = public.current_person_id()
  or (
    public.current_system_role() = any (
      array[
        'manager'::public.system_role_enum,
        'office'::public.system_role_enum,
        'owner'::public.system_role_enum
      ]
    )
    and person_id in (
      select er.person_id
      from public.employment_relationships er
      where er.restaurant_id = public.current_user_restaurant_id()
        and er.is_archived = false
    )
  )
);

create policy schedules_select_by_scope
on public.schedules
for select
using (
  public.is_admin_actor()
  or (
    public.current_system_role() = any (
      array[
        'manager'::public.system_role_enum,
        'area_lead'::public.system_role_enum,
        'office'::public.system_role_enum
      ]
    )
    and restaurant_id = public.current_user_restaurant_id()
  )
  or (
    public.current_system_role() = 'employee'::public.system_role_enum
    and restaurant_id = public.current_user_restaurant_id()
    and status = 'published'::public.schedule_status_enum
  )
);

create policy schedules_write_by_scope
on public.schedules
for all
using (
  public.is_admin_actor()
  or (
    public.current_system_role() = 'manager'::public.system_role_enum
    and restaurant_id = public.current_user_restaurant_id()
  )
)
with check (
  public.is_admin_actor()
  or (
    public.current_system_role() = 'manager'::public.system_role_enum
    and restaurant_id = public.current_user_restaurant_id()
  )
);

create policy shift_templates_select_by_scope
on public.shift_templates
for select
using (
  public.is_admin_actor()
  or restaurant_id = public.current_user_restaurant_id()
);

create policy shift_templates_write_by_scope
on public.shift_templates
for all
using (
  public.is_admin_actor()
  or (
    public.current_system_role() = 'manager'::public.system_role_enum
    and restaurant_id = public.current_user_restaurant_id()
  )
)
with check (
  public.is_admin_actor()
  or (
    public.current_system_role() = 'manager'::public.system_role_enum
    and restaurant_id = public.current_user_restaurant_id()
  )
);

create policy schedule_entries_select_by_scope
on public.schedule_entries
for select
using (
  public.is_admin_actor()
  or (
    public.current_system_role() = any (
      array[
        'manager'::public.system_role_enum,
        'area_lead'::public.system_role_enum,
        'office'::public.system_role_enum
      ]
    )
    and schedule_id in (
      select s.id
      from public.schedules s
      where s.restaurant_id = public.current_user_restaurant_id()
    )
  )
  or (
    public.current_system_role() = 'employee'::public.system_role_enum
    and employment_id in (
      select er.employment_id
      from public.employment_relationships er
      where er.person_id = public.current_person_id()
        and er.is_archived = false
    )
    and schedule_id in (
      select s.id
      from public.schedules s
      where s.restaurant_id = public.current_user_restaurant_id()
        and s.status = 'published'::public.schedule_status_enum
    )
  )
);

create policy schedule_entries_write_by_scope
on public.schedule_entries
for all
using (
  public.is_admin_actor()
  or (
    public.current_system_role() = 'manager'::public.system_role_enum
    and schedule_id in (
      select s.id
      from public.schedules s
      where s.restaurant_id = public.current_user_restaurant_id()
    )
  )
)
with check (
  public.is_admin_actor()
  or (
    public.current_system_role() = 'manager'::public.system_role_enum
    and schedule_id in (
      select s.id
      from public.schedules s
      where s.restaurant_id = public.current_user_restaurant_id()
    )
  )
);

create policy schedule_entry_adjustments_select_by_scope
on public.schedule_entry_adjustments
for select
using (
  public.is_admin_actor()
  or (
    public.current_system_role() = any (
      array[
        'manager'::public.system_role_enum,
        'area_lead'::public.system_role_enum,
        'office'::public.system_role_enum
      ]
    )
    and schedule_entry_id in (
      select se.id
      from public.schedule_entries se
      join public.schedules s
        on s.id = se.schedule_id
      where s.restaurant_id = public.current_user_restaurant_id()
    )
  )
);

create policy schedule_entry_logs_select_by_scope
on public.schedule_entry_logs
for select
using (
  public.is_admin_actor()
  or (
    public.current_system_role() = any (
      array[
        'manager'::public.system_role_enum,
        'area_lead'::public.system_role_enum,
        'office'::public.system_role_enum
      ]
    )
    and schedule_entry_id in (
      select se.id
      from public.schedule_entries se
      join public.schedules s
        on s.id = se.schedule_id
      where s.restaurant_id = public.current_user_restaurant_id()
    )
  )
);

create policy schedule_lock_logs_select_by_scope
on public.schedule_lock_logs
for select
using (
  public.is_admin_actor()
  or (
    public.current_system_role() = any (
      array[
        'manager'::public.system_role_enum,
        'office'::public.system_role_enum
      ]
    )
    and schedule_id in (
      select s.id
      from public.schedules s
      where s.restaurant_id = public.current_user_restaurant_id()
    )
  )
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'chain_subscriptions',
    'chains',
    'companies',
    'employment_relationships',
    'role_scope_assignments',
    'restaurant_zones',
    'task_templates',
    'task_instances',
    'requests',
    'shift_swap_requests',
    'incidents',
    'suppliers',
    'products',
    'supplier_product_aliases',
    'delivery_notes',
    'delivery_note_lines',
    'vacation_entitlements',
    'time_records'
  ]
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = t
    ) then
      execute format(
        'create policy %I_admin_all on public.%I for all using (public.is_admin_actor()) with check (public.is_admin_actor())',
        t,
        t
      );
    end if;
  end loop;
end $$;

commit;
