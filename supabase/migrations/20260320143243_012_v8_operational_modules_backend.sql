begin;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'task_status_enum') then
    create type public.task_status_enum as enum ('pending', 'needs_reassignment', 'completed', 'overdue', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'task_cancel_reason_enum') then
    create type public.task_cancel_reason_enum as enum ('schedule_change', 'employment_change', 'template_deactivated', 'manual_cancel');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'task_reassignment_reason_enum') then
    create type public.task_reassignment_reason_enum as enum ('employment_change', 'procedure_conflict', 'shift_swap', 'manual_reassignment_required');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'task_recurrence_enum') then
    create type public.task_recurrence_enum as enum ('once', 'daily', 'weekly', 'specific_date', 'per_shift');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'task_due_rule_enum') then
    create type public.task_due_rule_enum as enum ('end_of_shift', 'end_of_day', 'manual_due');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'confirmation_mode_enum') then
    create type public.confirmation_mode_enum as enum ('role', 'employee');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'procedure_type_enum') then
    create type public.procedure_type_enum as enum ('vacation', 'sick_leave', 'justified_absence', 'absence');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'procedure_status_enum') then
    create type public.procedure_status_enum as enum ('requested', 'approved', 'rejected', 'cancelled', 'expired', 'reported', 'validated', 'closed', 'in_review', 'resolved');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'shift_swap_status_enum') then
    create type public.shift_swap_status_enum as enum ('pending_peer', 'pending_manager', 'approved', 'rejected_peer', 'rejected_manager', 'expired');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'incident_sensitivity_enum') then
    create type public.incident_sensitivity_enum as enum ('normal', 'restricted');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'incident_status_enum') then
    create type public.incident_status_enum as enum ('reported', 'in_review', 'resolved', 'closed');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'incident_category_enum') then
    create type public.incident_category_enum as enum ('operational', 'maintenance', 'hygiene', 'customer', 'security', 'stock', 'technology', 'personnel');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'incident_severity_enum') then
    create type public.incident_severity_enum as enum ('low', 'medium', 'high', 'critical');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'document_type_enum') then
    create type public.document_type_enum as enum ('employment_contract', 'contract_addendum', 'payroll', 'identity_document', 'medical_certificate', 'absence_justification', 'policy_document', 'internal_report', 'delivery_note');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'document_owner_type_enum') then
    create type public.document_owner_type_enum as enum ('person', 'employment_relationship', 'procedure', 'restaurant', 'delivery_note');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'document_visibility_enum') then
    create type public.document_visibility_enum as enum ('employee_visible', 'management_visible', 'restricted_management', 'administrative_only');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'document_status_enum') then
    create type public.document_status_enum as enum ('active', 'superseded', 'archived');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'notification_type_enum') then
    create type public.notification_type_enum as enum (
      'schedule_published',
      'schedule_updated',
      'schedule_lock_force_released',
      'task_assigned',
      'task_due_soon',
      'task_overdue',
      'task_needs_reassignment',
      'task_cancelled',
      'procedure_created',
      'procedure_approved',
      'procedure_rejected',
      'procedure_cancelled',
      'procedure_in_review',
      'procedure_derived',
      'procedure_dates_updated',
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
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'notification_delivery_enum') then
    create type public.notification_delivery_enum as enum ('in_app', 'push');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'supplier_scope_enum') then
    create type public.supplier_scope_enum as enum ('chain', 'restaurant');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'delivery_note_status_enum') then
    create type public.delivery_note_status_enum as enum ('uploaded', 'employee_reviewed', 'office_reviewing', 'confirmed', 'rejected');
  end if;
end $$;

create table if not exists public.restaurant_zones (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  operational_area text,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'zones'
  ) then
    insert into public.restaurant_zones (
      id,
      restaurant_id,
      name,
      operational_area,
      is_active,
      is_archived,
      created_at,
      updated_at
    )
    select
      z.zone_id,
      z.restaurant_id,
      z.name,
      z.operational_area,
      coalesce(z.is_active, true),
      coalesce(z.is_archived, false),
      coalesce(z.created_at, now()),
      coalesce(z.updated_at, now())
    from public.zones z
    on conflict (id) do update
    set
      restaurant_id = excluded.restaurant_id,
      name = excluded.name,
      operational_area = excluded.operational_area,
      is_active = excluded.is_active,
      is_archived = excluded.is_archived,
      updated_at = now();
  end if;
end $$;

create table if not exists public.task_templates (
  task_template_id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title text not null,
  description text,
  recurrence_type public.task_recurrence_enum not null,
  due_rule public.task_due_rule_enum not null,
  requires_confirmation boolean not null default false,
  confirmation_mode public.confirmation_mode_enum,
  confirmation_role public.system_role_enum,
  confirmation_employee_id uuid references public.persons(person_id),
  plannable_in_schedule boolean not null default false,
  active boolean not null default true,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_instances (
  task_instance_id uuid primary key default gen_random_uuid(),
  task_template_id uuid references public.task_templates(task_template_id) on delete set null,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  task_date date not null,
  shift_context text,
  assigned_role public.system_role_enum,
  assigned_zone_id uuid references public.restaurant_zones(id) on delete set null,
  assigned_employee_id uuid references public.persons(person_id) on delete set null,
  task_status public.task_status_enum not null default 'pending',
  cancel_reason public.task_cancel_reason_enum,
  reassignment_reason public.task_reassignment_reason_enum,
  due_at timestamptz,
  completed_by uuid references public.persons(person_id),
  completed_at timestamptz,
  requires_confirmation boolean not null default false,
  confirmed_by uuid references public.persons(person_id),
  confirmed_at timestamptz,
  confirmation_note text,
  confirmation_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (assigned_role is not null or assigned_zone_id is not null or assigned_employee_id is not null)
);

create index if not exists idx_task_instances_restaurant_date_status
  on public.task_instances(restaurant_id, task_date, task_status);

create index if not exists idx_task_instances_assigned_employee
  on public.task_instances(assigned_employee_id);

create table if not exists public.procedures (
  procedure_id uuid primary key default gen_random_uuid(),
  employment_id uuid not null references public.employment_relationships(employment_id) on delete restrict,
  procedure_type public.procedure_type_enum not null,
  status public.procedure_status_enum not null,
  requested_by uuid not null references public.persons(person_id),
  reviewed_by uuid references public.persons(person_id),
  effective_start_date date,
  effective_end_date date,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    effective_start_date is null
    or effective_end_date is null
    or effective_end_date >= effective_start_date
  ),
  check (reviewed_by is null or requested_by <> reviewed_by)
);

create index if not exists idx_procedures_employment_status
  on public.procedures(employment_id, status);

create table if not exists public.shift_swap_requests (
  shift_swap_request_id uuid primary key default gen_random_uuid(),
  requester_employee_id uuid not null references public.persons(person_id) on delete restrict,
  target_employee_id uuid not null references public.persons(person_id) on delete restrict,
  requester_schedule_entry_id uuid not null references public.schedule_entries(id) on delete cascade,
  target_schedule_entry_id uuid not null references public.schedule_entries(id) on delete cascade,
  status public.shift_swap_status_enum not null default 'pending_peer',
  requested_at timestamptz not null default now(),
  peer_responded_at timestamptz,
  reviewed_by uuid references public.persons(person_id),
  reviewed_at timestamptz,
  reason text,
  check (requester_employee_id <> target_employee_id)
);

create index if not exists idx_shift_swap_requests_requester_status
  on public.shift_swap_requests(requester_employee_id, status);

create index if not exists idx_shift_swap_requests_target_status
  on public.shift_swap_requests(target_employee_id, status);

create table if not exists public.incidents (
  incident_id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  zone_id uuid references public.restaurant_zones(id) on delete set null,
  category public.incident_category_enum not null,
  sensitivity public.incident_sensitivity_enum not null default 'normal',
  title text not null,
  description text not null,
  severity public.incident_severity_enum,
  reported_by uuid not null references public.persons(person_id),
  primary_owner uuid references public.persons(person_id),
  status public.incident_status_enum not null default 'reported',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_incidents_restaurant_status
  on public.incidents(restaurant_id, status);

create table if not exists public.documents (
  document_id uuid primary key default gen_random_uuid(),
  document_type public.document_type_enum not null,
  owner_type public.document_owner_type_enum not null,
  owner_id uuid not null,
  visibility public.document_visibility_enum not null,
  document_status public.document_status_enum not null default 'active',
  file_url text not null,
  version integer not null default 1,
  requires_reauth boolean not null default false,
  created_by uuid not null references public.persons(person_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_owner
  on public.documents(owner_type, owner_id);

create table if not exists public.notifications (
  notification_id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.persons(person_id) on delete cascade,
  notification_type public.notification_type_enum not null,
  entity_type text not null,
  entity_id uuid,
  delivery_type public.notification_delivery_enum not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_notifications_recipient_created
  on public.notifications(recipient_user_id, created_at desc);

create table if not exists public.push_devices (
  push_device_id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(person_id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  platform text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  supplier_id uuid primary key default gen_random_uuid(),
  scope_type public.supplier_scope_enum not null,
  scope_id uuid not null,
  name text not null,
  tax_id text,
  contact_email text,
  contact_phone text,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_suppliers_scope
  on public.suppliers(scope_type, scope_id)
  where is_archived = false;

create table if not exists public.products (
  product_id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(supplier_id) on delete cascade,
  name text not null,
  description text,
  unit text,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_supplier
  on public.products(supplier_id)
  where is_archived = false;

create table if not exists public.supplier_product_aliases (
  alias_id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(supplier_id) on delete cascade,
  product_id uuid not null references public.products(product_id) on delete cascade,
  raw_text text not null,
  confidence numeric not null default 0.0 check (confidence >= 0.0 and confidence <= 1.0),
  times_confirmed integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_notes (
  delivery_note_id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_id uuid references public.suppliers(supplier_id) on delete set null,
  document_id uuid references public.documents(document_id) on delete set null,
  document_number text,
  delivery_date date,
  status public.delivery_note_status_enum not null default 'uploaded',
  ocr_raw_json jsonb,
  uploaded_by uuid not null references public.persons(person_id),
  reviewed_by_employee uuid references public.persons(person_id),
  employee_reviewed_at timestamptz,
  reviewed_by_office uuid references public.persons(person_id),
  office_reviewed_at timestamptz,
  confirmed_at timestamptz,
  rejection_reason text,
  total_amount numeric,
  tax_amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_delivery_notes_restaurant_status
  on public.delivery_notes(restaurant_id, status)
  where status not in ('confirmed', 'rejected');

create index if not exists idx_delivery_notes_supplier
  on public.delivery_notes(supplier_id);

create table if not exists public.delivery_note_lines (
  line_id uuid primary key default gen_random_uuid(),
  delivery_note_id uuid not null references public.delivery_notes(delivery_note_id) on delete cascade,
  product_id uuid references public.products(product_id) on delete set null,
  product_name_raw text not null,
  quantity numeric not null,
  unit text,
  unit_price numeric,
  tax_rate numeric,
  tax_amount numeric,
  line_total numeric,
  is_new_product boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.schedule_entries
  add column if not exists employment_id uuid references public.employment_relationships(employment_id) on delete set null;

alter table if exists public.notification_outbox
  add column if not exists recipient_person_id uuid references public.persons(person_id) on delete cascade,
  add column if not exists notification_type public.notification_type_enum,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists max_attempts integer not null default 10;

create or replace function public.sync_notification_outbox_recipient_bridge()
returns trigger
language plpgsql
as $$
begin
  if new.recipient_person_id is null and new.employee_id is not null then
    new.recipient_person_id = new.employee_id;
  end if;
  if new.employee_id is null and new.recipient_person_id is not null then
    new.employee_id = new.recipient_person_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notification_outbox_recipient_bridge on public.notification_outbox;
create trigger trg_notification_outbox_recipient_bridge
before insert or update on public.notification_outbox
for each row
execute function public.sync_notification_outbox_recipient_bridge();

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
  if new.task_status in ('pending', 'completed', 'overdue')
     and (new.cancel_reason is not null or new.reassignment_reason is not null) then
    raise exception 'cancel_reason and reassignment_reason must be null for status %', new.task_status;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_instances_validate_state on public.task_instances;
create trigger trg_task_instances_validate_state
before insert or update on public.task_instances
for each row
execute function public.validate_task_instance_state();

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
for each row
execute function public.validate_no_self_approval_procedure();

create or replace function public.validate_document_owner_id()
returns trigger
language plpgsql
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
  elsif new.owner_type = 'procedure' then
    if not exists (select 1 from public.procedures where procedure_id = new.owner_id) then
      raise exception 'owner_id % does not exist in procedures', new.owner_id;
    end if;
  elsif new.owner_type = 'restaurant' then
    if not exists (select 1 from public.restaurants where id = new.owner_id) then
      raise exception 'owner_id % does not exist in restaurants', new.owner_id;
    end if;
  elsif new.owner_type = 'delivery_note' then
    if not exists (select 1 from public.delivery_notes where delivery_note_id = new.owner_id) then
      raise exception 'owner_id % does not exist in delivery_notes', new.owner_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_documents_owner_fk on public.documents;
create trigger trg_documents_owner_fk
before insert or update on public.documents
for each row
execute function public.validate_document_owner_id();

create or replace function public.validate_supplier_scope_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.scope_type = 'chain' then
    if not exists (select 1 from public.chains where chain_id = new.scope_id) then
      raise exception 'supplier scope_id % does not exist in chains', new.scope_id;
    end if;
  elsif new.scope_type = 'restaurant' then
    if not exists (select 1 from public.restaurants where id = new.scope_id) then
      raise exception 'supplier scope_id % does not exist in restaurants', new.scope_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_suppliers_scope_validation on public.suppliers;
create trigger trg_suppliers_scope_validation
before insert or update on public.suppliers
for each row
execute function public.validate_supplier_scope_id();

do $$
declare
  t text;
begin
  foreach t in array array[
    'restaurant_zones',
    'task_templates',
    'task_instances',
    'procedures',
    'incidents',
    'documents',
    'suppliers',
    'products',
    'supplier_product_aliases',
    'delivery_notes',
    'delivery_note_lines'
  ]
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
