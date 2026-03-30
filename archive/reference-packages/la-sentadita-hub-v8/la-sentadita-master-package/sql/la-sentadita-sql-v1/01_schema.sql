-- ============================================================================
-- La Sentadita Hub — Schema v6
-- PostgreSQL / Supabase
-- Core Architecture Freeze v6
--
-- DECISIONES INTEGRADAS:
--   v4: person.system_role como fuente única del rol
--   v5: shift_templates, schedule_config, restaurant_hours, schedule_publish_events,
--       schedule_entry_adjustments, schedule_entry_logs, notification_outbox
--   v6: soft delete en todas las entidades principales
--       coherencia bidireccional chain/company/restaurant
--       hardening completo B-01 a B-10
--       schedule_entry_source_enum con 10 valores
--       publication_version sube siempre + publish_type en schedule_publish_events
--       procedure_dates_updated, move_restaurant, move_company en audit
--       I3 formalizado: no solapamiento + un restaurante por día
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================

do $$
begin

  if not exists (select 1 from pg_type where typname = 'system_role_enum') then
    create type public.system_role_enum as enum (
      'employee', 'area_lead', 'sub_manager', 'manager',
      'office', 'chain_owner', 'admin'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'scope_type_enum') then
    create type public.scope_type_enum as enum (
      'platform', 'chain', 'company', 'restaurant', 'zone'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'schedule_status_enum') then
    create type public.schedule_status_enum as enum ('draft', 'published');
  end if;

  if not exists (select 1 from pg_type where typname = 'publish_type_enum') then
    create type public.publish_type_enum as enum ('manual', 'auto');
  end if;

  if not exists (select 1 from pg_type where typname = 'day_type_enum') then
    create type public.day_type_enum as enum (
      'work', 'rest', 'unscheduled', 'vacation', 'sick_leave',
      'justified_absence', 'absent', 'not_applicable', 'end_of_contract'
    );
  end if;

  -- schedule_entry_source_enum: 10 valores específicos (v6)
  -- auto eliminado por ambiguo
  if not exists (select 1 from pg_type where typname = 'schedule_entry_source_enum') then
    create type public.schedule_entry_source_enum as enum (
      'manual',
      'procedure_vacation',
      'procedure_sick_leave',
      'procedure_justified_absence',
      'procedure_absence',
      'shift_swap',
      'generated_template',
      'generated_availability',
      'generated_copy',
      'import'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'shift_type_enum') then
    create type public.shift_type_enum as enum ('continuous', 'split');
  end if;

  if not exists (select 1 from pg_type where typname = 'task_status_enum') then
    create type public.task_status_enum as enum (
      'pending', 'needs_reassignment', 'completed', 'overdue', 'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'task_cancel_reason_enum') then
    create type public.task_cancel_reason_enum as enum (
      'schedule_change', 'employment_change',
      'template_deactivated', 'manual_cancel'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'task_reassignment_reason_enum') then
    create type public.task_reassignment_reason_enum as enum (
      'employment_change', 'procedure_conflict',
      'shift_swap', 'manual_reassignment_required'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'task_recurrence_enum') then
    create type public.task_recurrence_enum as enum (
      'once', 'daily', 'weekly', 'specific_date', 'per_shift'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'task_due_rule_enum') then
    create type public.task_due_rule_enum as enum (
      'end_of_shift', 'end_of_day', 'manual_due'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'confirmation_mode_enum') then
    create type public.confirmation_mode_enum as enum ('role', 'employee');
  end if;

  if not exists (select 1 from pg_type where typname = 'procedure_type_enum') then
    create type public.procedure_type_enum as enum (
      'vacation', 'sick_leave', 'justified_absence', 'absence'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'procedure_status_enum') then
    create type public.procedure_status_enum as enum (
      'requested', 'approved', 'rejected', 'cancelled', 'expired',
      'reported', 'validated', 'closed', 'in_review', 'resolved'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'shift_swap_status_enum') then
    create type public.shift_swap_status_enum as enum (
      'pending_peer', 'pending_manager', 'approved',
      'rejected_peer', 'rejected_manager', 'expired'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'incident_sensitivity_enum') then
    create type public.incident_sensitivity_enum as enum ('normal', 'restricted');
  end if;

  if not exists (select 1 from pg_type where typname = 'incident_status_enum') then
    create type public.incident_status_enum as enum (
      'reported', 'in_review', 'resolved', 'closed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'incident_category_enum') then
    create type public.incident_category_enum as enum (
      'operational', 'maintenance', 'hygiene', 'customer',
      'security', 'stock', 'technology', 'personnel'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'incident_severity_enum') then
    create type public.incident_severity_enum as enum (
      'low', 'medium', 'high', 'critical'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_type_enum') then
    create type public.document_type_enum as enum (
      'employment_contract', 'contract_addendum', 'payroll',
      'identity_document', 'medical_certificate', 'absence_justification',
      'policy_document', 'internal_report',
      'delivery_note'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_owner_type_enum') then
    create type public.document_owner_type_enum as enum (
      'person', 'employment_relationship', 'procedure', 'restaurant',
      'delivery_note'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_visibility_enum') then
    create type public.document_visibility_enum as enum (
      'employee_visible', 'management_visible',
      'restricted_management', 'administrative_only'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_status_enum') then
    create type public.document_status_enum as enum (
      'active', 'superseded', 'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_type_enum') then
    create type public.notification_type_enum as enum (
      -- scheduling
      'schedule_published', 'schedule_updated', 'schedule_lock_force_released',
      -- tasks
      'task_assigned', 'task_due_soon', 'task_overdue',
      'task_needs_reassignment', 'task_cancelled',
      -- procedures
      'procedure_created', 'procedure_approved', 'procedure_rejected',
      'procedure_cancelled', 'procedure_in_review', 'procedure_derived',
      'procedure_dates_updated',
      -- shift swap
      'shift_swap_request', 'shift_swap_accepted', 'shift_swap_rejected',
      'shift_swap_pending_manager', 'shift_swap_manager_approved',
      'shift_swap_manager_rejected', 'shift_swap_expired',
      -- incidents
      'incident_created', 'incident_assigned',
      'incident_status_changed', 'incident_resolved',
      -- documents
      'document_uploaded', 'document_requires_signature', 'document_superseded',
      -- people
      'system_role_changed', 'employment_terminated', 'password_must_change',
      -- system
      'push_device_registered',
      -- delivery notes
      'delivery_note_submitted',
      'delivery_note_confirmed',
      'delivery_note_rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_delivery_enum') then
    create type public.notification_delivery_enum as enum ('in_app', 'push');
  end if;

  if not exists (select 1 from pg_type where typname = 'lock_release_type_enum') then
    create type public.lock_release_type_enum as enum ('natural', 'timeout', 'forced');
  end if;

  if not exists (select 1 from pg_type where typname = 'audit_action_enum') then
    create type public.audit_action_enum as enum (
      -- people
      'person_created', 'person_identity_updated', 'person_archived',
      'system_role_changed',
      -- employment
      'employment_relationship_created', 'employment_relationship_updated',
      'employment_relationship_terminated',
      -- role scope
      'role_scope_assignment_created', 'role_scope_assignment_updated',
      'role_scope_assignment_deactivated',
      -- org operations (v6)
      'move_restaurant', 'move_company',
      -- scheduling
      'schedule_created', 'schedule_entry_updated',
      'schedule_published', 'schedule_republished',
      'schedule_lock_acquired', 'schedule_lock_denied',
      'schedule_lock_expired', 'schedule_lock_force_released',
      -- tasks
      'task_created', 'task_status_changed', 'task_confirmed',
      'task_reassigned', 'task_cancelled', 'task_generated_from_schedule',
      -- procedures
      'procedure_created', 'procedure_status_changed',
      'procedure_derived', 'procedure_applied_to_schedule',
      'procedure_dates_updated',
      -- shift swap
      'shift_swap_requested', 'shift_swap_peer_accepted',
      'shift_swap_peer_rejected', 'shift_swap_manager_approved',
      'shift_swap_manager_rejected', 'shift_swap_expired', 'shift_swap_applied',
      -- incidents
      'incident_created', 'incident_status_changed',
      'incident_restricted_marked', 'incident_assigned',
      -- documents
      'document_uploaded', 'document_viewed', 'document_downloaded',
      'document_archived', 'document_superseded',
      -- notifications
      'notification_created', 'notification_sent_push', 'notification_read',
      -- delivery notes
      'delivery_note_uploaded', 'delivery_note_employee_reviewed',
      'delivery_note_office_confirmed', 'delivery_note_office_rejected',
      'supplier_created', 'product_created'
    );
  end if;

end $$;

-- ============================================================================
-- JERARQUÍA ORGANIZATIVA
-- Chain → Company → Restaurant → Zone
-- Soft delete en chains, companies, restaurants, zones (v6)
-- ============================================================================

create table if not exists public.chains (
  chain_id    uuid primary key default gen_random_uuid(),
  name        text not null,
  is_archived boolean not null default false,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.companies (
  company_id       uuid primary key default gen_random_uuid(),
  chain_id         uuid not null references public.chains(chain_id) on delete restrict,
  name             text not null,
  legal_identifier text,
  is_archived      boolean not null default false,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.restaurants (
  restaurant_id uuid primary key default gen_random_uuid(),
  chain_id      uuid not null references public.chains(chain_id) on delete restrict,
  company_id    uuid not null references public.companies(company_id) on delete restrict,
  name          text not null,
  timezone      text not null default 'Europe/Madrid',
  is_active     boolean not null default true,
  is_archived   boolean not null default false,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.zones (
  zone_id          uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurants(restaurant_id) on delete cascade,
  name             text not null,
  operational_area text not null,
  is_active        boolean not null default true,
  is_archived      boolean not null default false,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (restaurant_id, name)
);

-- ============================================================================
-- TRIGGER: coherencia bidireccional chain/company/restaurant (v6)
-- Protege en insert/update de restaurants Y en update de companies
-- ============================================================================

create or replace function public.validate_restaurant_chain_coherence()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.companies c
    where c.company_id = new.company_id
      and c.chain_id   = new.chain_id
  ) then
    raise exception
      'restaurant.chain_id (%) must match companies.chain_id for company_id (%)',
      new.chain_id, new.company_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_restaurants_chain_coherence on public.restaurants;
create trigger trg_restaurants_chain_coherence
before insert or update on public.restaurants
for each row execute function public.validate_restaurant_chain_coherence();

-- Bloqueo amplio en companies.chain_id (v6 — Company Chain Reassignment Rule v1)
-- Bloquea si hay: restaurantes, empleados activos, documentos activos, procedures activos
-- Schedules, incidencias y tasks quedan cubiertas implícitamente por el bloqueo de restaurantes
create or replace function public.validate_company_chain_id_change()
returns trigger language plpgsql as $$
declare
  v_restaurants integer;
  v_employees   integer;
  v_documents   integer;
  v_procedures  integer;
begin
  if new.chain_id = old.chain_id then
    return new;
  end if;

  -- 1. Restaurantes asociados
  select count(*) into v_restaurants
  from public.restaurants
  where company_id = old.company_id and is_archived = false;

  if v_restaurants > 0 then
    raise exception
      'Company Chain Reassignment Rule v1: cannot change chain_id — company has % active restaurant(s). Archive them first.',
      v_restaurants;
  end if;

  -- 2. Relaciones laborales activas
  select count(*) into v_employees
  from public.employment_relationships
  where company_id = old.company_id
    and end_date is null
    and is_archived = false;

  if v_employees > 0 then
    raise exception
      'Company Chain Reassignment Rule v1: cannot change chain_id — company has % active employment relationship(s). Terminate them first.',
      v_employees;
  end if;

  -- 3. Documentos activos vinculados a relaciones laborales de esta empresa
  select count(*) into v_documents
  from public.documents d
  join public.employment_relationships er
    on er.employment_id = d.owner_id
   and d.owner_type = 'employment_relationship'
  where er.company_id = old.company_id
    and d.document_status = 'active';

  if v_documents > 0 then
    raise exception
      'Company Chain Reassignment Rule v1: cannot change chain_id — company has % active document(s) linked to its employment relationships.',
      v_documents;
  end if;

  -- 4. Procedimientos activos vinculados a relaciones laborales de esta empresa
  select count(*) into v_procedures
  from public.procedures p
  join public.employment_relationships er
    on er.employment_id = p.employment_id
  where er.company_id = old.company_id
    and p.status not in ('closed', 'cancelled', 'rejected');

  if v_procedures > 0 then
    raise exception
      'Company Chain Reassignment Rule v1: cannot change chain_id — company has % active procedure(s) linked to its employment relationships.',
      v_procedures;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_companies_chain_id_change on public.companies;
create trigger trg_companies_chain_id_change
before update on public.companies
for each row execute function public.validate_company_chain_id_change();

-- ============================================================================
-- CONFIGURACIÓN OPERATIVA
-- ============================================================================

create table if not exists public.restaurant_hours (
  restaurant_hours_id uuid primary key default gen_random_uuid(),
  restaurant_id       uuid not null references public.restaurants(restaurant_id) on delete cascade,
  day_of_week         smallint not null check (day_of_week >= 0 and day_of_week <= 6),
  is_open             boolean not null default true,
  open_time           time,
  close_time          time,
  crosses_midnight    boolean not null default false,
  unique (restaurant_id, day_of_week)
);

create table if not exists public.schedule_config (
  schedule_config_id uuid primary key default gen_random_uuid(),
  restaurant_id      uuid not null unique references public.restaurants(restaurant_id) on delete cascade,
  min_shift_duration interval not null default '01:00:00',
  min_split_break    interval not null default '01:00:00',
  timezone           text not null default 'Europe/Madrid',
  updated_by         uuid,
  updated_at         timestamptz not null default now()
);

-- ============================================================================
-- PERSONAS Y EMPLEO
-- persons.person_id = auth.users.id (v5 Decisión A)
-- system_role en persons como única fuente de verdad del rol
-- Soft delete en persons y employment_relationships (v6)
-- ============================================================================

create table if not exists public.persons (
  person_id         uuid primary key references auth.users(id) on delete cascade,
  chain_id          uuid not null references public.chains(chain_id) on delete restrict,
  first_name        text not null,
  last_name         text not null,
  phone             text,
  email             text,
  birth_date        date,
  identity_document text,
  avatar_url        text,
  system_role       public.system_role_enum not null,
  is_archived       boolean not null default false,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists idx_persons_chain_identity_document_unique
  on public.persons(chain_id, identity_document)
  where identity_document is not null and is_archived = false;

create index if not exists idx_persons_chain_id
  on public.persons(chain_id);

create table if not exists public.role_scope_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  person_id     uuid not null references public.persons(person_id) on delete cascade,
  scope_type    public.scope_type_enum not null,
  scope_id      uuid,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.employment_relationships (
  employment_id        uuid primary key default gen_random_uuid(),
  person_id            uuid not null references public.persons(person_id) on delete restrict,
  company_id           uuid not null references public.companies(company_id) on delete restrict,
  restaurant_id        uuid not null references public.restaurants(restaurant_id) on delete restrict,
  job_title            text not null,
  contract_type        text,
  agreed_monthly_hours numeric(8,2),
  max_daily_hours      numeric(6,2),
  requires_schedule    boolean not null default true,
  availability_json    jsonb,
  planning_notes       text,
  start_date           date not null,
  end_date             date,
  active_principal     boolean not null default true,
  is_archived          boolean not null default false,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
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

-- ============================================================================
-- TRIGGERS: integridad polimórfica (v6 — hardening B-05)
-- scope_id en role_scope_assignments validado por scope_type
-- ============================================================================

create or replace function public.validate_role_scope_assignment_scope_id()
returns trigger language plpgsql as $$
begin
  if new.scope_type = 'platform' then
    if new.scope_id is not null then
      raise exception 'scope_id must be NULL for scope_type = platform';
    end if;
    return new;
  end if;

  if new.scope_id is null then
    raise exception 'scope_id is required for scope_type = %', new.scope_type;
  end if;

  if new.scope_type = 'chain' then
    if not exists (select 1 from public.chains where chain_id = new.scope_id) then
      raise exception 'scope_id % does not exist in chains', new.scope_id;
    end if;
  elsif new.scope_type = 'company' then
    if not exists (select 1 from public.companies where company_id = new.scope_id) then
      raise exception 'scope_id % does not exist in companies', new.scope_id;
    end if;
  elsif new.scope_type = 'restaurant' then
    if not exists (select 1 from public.restaurants where restaurant_id = new.scope_id) then
      raise exception 'scope_id % does not exist in restaurants', new.scope_id;
    end if;
  elsif new.scope_type = 'zone' then
    if not exists (select 1 from public.zones where zone_id = new.scope_id) then
      raise exception 'scope_id % does not exist in zones', new.scope_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_role_scope_assignments_scope_fk on public.role_scope_assignments;
create trigger trg_role_scope_assignments_scope_fk
before insert or update on public.role_scope_assignments
for each row execute function public.validate_role_scope_assignment_scope_id();

-- ============================================================================
-- PLANTILLAS DE TURNO
-- ============================================================================

create table if not exists public.shift_templates (
  shift_template_id uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants(restaurant_id) on delete cascade,
  name              text not null,
  type              public.shift_type_enum not null,
  start_time        time not null,
  end_time          time not null,
  split_start_time  time,
  split_end_time    time,
  is_active         boolean not null default true,
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- hardening B-06: split times obligatorios si type = split
  constraint shift_templates_split_times_required check (
    type <> 'split'
    or (split_start_time is not null and split_end_time is not null)
  ),
  constraint shift_templates_split_times_coherent check (
    split_start_time is null
    or split_end_time is null
    or split_end_time > split_start_time
  )
);

-- ============================================================================
-- SCHEDULING
-- publication_version sube siempre (v6)
-- publish_type en schedule_publish_events (v6)
-- I3: UNIQUE (employment_id, entry_date) — hardening B-02
-- schedule_entry_source_enum con 10 valores (v6)
-- ============================================================================

create table if not exists public.schedules (
  schedule_id      uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurants(restaurant_id) on delete cascade,
  week_start       date not null check (extract(isodow from week_start) = 1),
  status           public.schedule_status_enum not null default 'draft',
  publication_version integer not null default 0,
  created_by       uuid not null references public.persons(person_id),
  published_by     uuid references public.persons(person_id),
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (restaurant_id, week_start)
);

-- Historial real de publicaciones con publish_type (v6)
create table if not exists public.schedule_publish_events (
  publish_event_id uuid primary key default gen_random_uuid(),
  schedule_id      uuid not null references public.schedules(schedule_id) on delete cascade,
  published_by     uuid not null references public.persons(person_id),
  publish_type     public.publish_type_enum not null default 'manual',
  published_at     timestamptz not null default now(),
  prev_published_at timestamptz,
  publication_version integer not null
);

create index if not exists idx_schedule_publish_events_schedule
  on public.schedule_publish_events(schedule_id, published_at desc);

create table if not exists public.schedule_entries (
  schedule_entry_id uuid primary key default gen_random_uuid(),
  schedule_id       uuid not null references public.schedules(schedule_id) on delete cascade,
  employment_id     uuid not null references public.employment_relationships(employment_id) on delete restrict,
  entry_date        date not null,
  day_type          public.day_type_enum not null,
  shift_template_id uuid references public.shift_templates(shift_template_id) on delete set null,
  start_time        time,
  end_time          time,
  split_start_time  time,
  split_end_time    time,
  zone_id           uuid references public.zones(zone_id) on delete set null,
  source            public.schedule_entry_source_enum not null default 'manual',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- I3a: un empleado no puede tener dos entradas el mismo día
  unique (employment_id, entry_date),
  check (
    (day_type = 'work' and start_time is not null and end_time is not null)
    or (day_type <> 'work')
  )
);

create index if not exists idx_schedule_entries_schedule_date
  on public.schedule_entries(schedule_id, entry_date);
create index if not exists idx_schedule_entries_employment_date
  on public.schedule_entries(employment_id, entry_date);

-- Ajustes manuales con razón obligatoria
create table if not exists public.schedule_entry_adjustments (
  adjustment_id              uuid primary key default gen_random_uuid(),
  schedule_entry_id          uuid not null references public.schedule_entries(schedule_entry_id) on delete cascade,
  adjusted_by                uuid not null references public.persons(person_id),
  adjusted_at                timestamptz not null default now(),
  reason                     text not null check (length(trim(reason)) > 0),
  previous_day_type          public.day_type_enum,
  new_day_type               public.day_type_enum,
  previous_start_time        time,
  new_start_time             time,
  previous_end_time          time,
  new_end_time               time,
  previous_split_start_time  time,
  new_split_start_time       time,
  previous_split_end_time    time,
  new_split_end_time         time,
  previous_zone_id           uuid references public.zones(zone_id),
  new_zone_id                uuid references public.zones(zone_id),
  previous_shift_template_id uuid references public.shift_templates(shift_template_id),
  new_shift_template_id      uuid references public.shift_templates(shift_template_id)
);

-- Log de todos los cambios incluyendo automáticos
create table if not exists public.schedule_entry_logs (
  log_id                     uuid primary key default gen_random_uuid(),
  schedule_entry_id          uuid not null references public.schedule_entries(schedule_entry_id) on delete cascade,
  changed_at                 timestamptz not null default now(),
  changed_by                 uuid references public.persons(person_id),
  change_source              public.schedule_entry_source_enum not null,
  previous_day_type          public.day_type_enum,
  new_day_type               public.day_type_enum,
  previous_start_time        time,
  new_start_time             time,
  previous_end_time          time,
  new_end_time               time,
  previous_split_start_time  time,
  new_split_start_time       time,
  previous_split_end_time    time,
  new_split_end_time         time,
  previous_zone_id           uuid references public.zones(zone_id),
  new_zone_id                uuid references public.zones(zone_id),
  previous_shift_template_id uuid references public.shift_templates(shift_template_id),
  new_shift_template_id      uuid references public.shift_templates(shift_template_id)
);

create index if not exists idx_schedule_entry_logs_entry
  on public.schedule_entry_logs(schedule_entry_id, changed_at desc);

-- ============================================================================
-- SCHEDULE LOCKS
-- ============================================================================

create table if not exists public.schedule_locks (
  schedule_lock_id uuid primary key default gen_random_uuid(),
  schedule_id      uuid not null unique references public.schedules(schedule_id) on delete cascade,
  lock_type        text not null check (lock_type in ('restaurant_total', 'zone_only')),
  zone_id          uuid references public.zones(zone_id) on delete cascade,
  holder_person_id uuid not null references public.persons(person_id) on delete cascade,
  holder_role      public.system_role_enum not null,
  acquired_at      timestamptz not null default now(),
  expires_at       timestamptz not null,
  released_at      timestamptz,
  release_reason   text
);

create index if not exists idx_schedule_locks_active
  on public.schedule_locks(schedule_id, expires_at)
  where released_at is null;

create table if not exists public.schedule_lock_logs (
  lock_log_id  uuid primary key default gen_random_uuid(),
  schedule_id  uuid not null references public.schedules(schedule_id) on delete cascade,
  locked_by    uuid not null references public.persons(person_id),
  locked_at    timestamptz not null,
  released_by  uuid references public.persons(person_id),
  release_type public.lock_release_type_enum not null,
  released_at  timestamptz not null default now()
);

-- ============================================================================
-- TASKS
-- ============================================================================

create table if not exists public.task_templates (
  task_template_id       uuid primary key default gen_random_uuid(),
  restaurant_id          uuid not null references public.restaurants(restaurant_id) on delete cascade,
  title                  text not null,
  description            text,
  recurrence_type        public.task_recurrence_enum not null,
  due_rule               public.task_due_rule_enum not null,
  requires_confirmation  boolean not null default false,
  confirmation_mode      public.confirmation_mode_enum,
  confirmation_role      public.system_role_enum,
  confirmation_employee_id uuid references public.persons(person_id),
  plannable_in_schedule  boolean not null default false,
  active                 boolean not null default true,
  is_archived            boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.task_instances (
  task_instance_id     uuid primary key default gen_random_uuid(),
  task_template_id     uuid references public.task_templates(task_template_id) on delete set null,
  restaurant_id        uuid not null references public.restaurants(restaurant_id) on delete cascade,
  task_date            date not null,
  shift_context        text,
  assigned_role        public.system_role_enum,
  assigned_zone_id     uuid references public.zones(zone_id) on delete set null,
  assigned_employee_id uuid references public.persons(person_id) on delete set null,
  task_status          public.task_status_enum not null default 'pending',
  cancel_reason        public.task_cancel_reason_enum,
  reassignment_reason  public.task_reassignment_reason_enum,
  due_at               timestamptz,
  completed_by         uuid references public.persons(person_id),
  completed_at         timestamptz,
  requires_confirmation boolean not null default false,
  confirmed_by         uuid references public.persons(person_id),
  confirmed_at         timestamptz,
  confirmation_note    text,
  confirmation_photo_url text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- I6: tarea siempre con al menos un responsable
  check (
    assigned_role is not null
    or assigned_zone_id is not null
    or assigned_employee_id is not null
  ),
  check (
    (task_status = 'cancelled' and cancel_reason is not null and reassignment_reason is null)
    or (task_status = 'needs_reassignment' and reassignment_reason is not null and cancel_reason is null)
    or (task_status in ('pending','completed','overdue') and cancel_reason is null and reassignment_reason is null)
  )
);

create index if not exists idx_task_instances_restaurant_date_status
  on public.task_instances(restaurant_id, task_date, task_status);
create index if not exists idx_task_instances_assigned_employee
  on public.task_instances(assigned_employee_id);

-- ============================================================================
-- PROCEDURES Y SHIFT SWAP
-- Soft delete implícito via status = closed/cancelled
-- Fechas obligatorias por tipo — hardening B-10
-- Edición de fechas permitida en requested/approved/in_review (v6)
-- ============================================================================

create table if not exists public.procedures (
  procedure_id         uuid primary key default gen_random_uuid(),
  employment_id        uuid not null references public.employment_relationships(employment_id) on delete restrict,
  procedure_type       public.procedure_type_enum not null,
  status               public.procedure_status_enum not null,
  requested_by         uuid not null references public.persons(person_id),
  reviewed_by          uuid references public.persons(person_id),
  effective_start_date date,
  effective_end_date   date,
  resolution_note      text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- hardening B-10: fechas obligatorias para vacation, sick_leave, justified_absence
  constraint procedures_dates_required_by_type check (
    procedure_type not in ('vacation', 'sick_leave', 'justified_absence')
    or (effective_start_date is not null and effective_end_date is not null)
  ),
  constraint procedures_dates_coherent check (
    effective_start_date is null
    or effective_end_date is null
    or effective_end_date >= effective_start_date
  ),
  -- I4: nadie autoaprueba
  constraint procedures_no_self_approval check (
    reviewed_by is null or requested_by <> reviewed_by
  )
);

create index if not exists idx_procedures_employment_status
  on public.procedures(employment_id, status);

create table if not exists public.shift_swap_requests (
  shift_swap_request_id        uuid primary key default gen_random_uuid(),
  requester_employee_id        uuid not null references public.persons(person_id) on delete restrict,
  target_employee_id           uuid not null references public.persons(person_id) on delete restrict,
  requester_schedule_entry_id  uuid not null references public.schedule_entries(schedule_entry_id) on delete cascade,
  target_schedule_entry_id     uuid not null references public.schedule_entries(schedule_entry_id) on delete cascade,
  status                       public.shift_swap_status_enum not null default 'pending_peer',
  requested_at                 timestamptz not null default now(),
  peer_responded_at            timestamptz,
  reviewed_by                  uuid references public.persons(person_id),
  reviewed_at                  timestamptz,
  reason                       text,
  check (requester_employee_id <> target_employee_id)
);

create index if not exists idx_shift_swap_requests_requester_status
  on public.shift_swap_requests(requester_employee_id, status);
create index if not exists idx_shift_swap_requests_target_status
  on public.shift_swap_requests(target_employee_id, status);

-- ============================================================================
-- INCIDENTS
-- ============================================================================

create table if not exists public.incidents (
  incident_id   uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(restaurant_id) on delete cascade,
  zone_id       uuid references public.zones(zone_id) on delete set null,
  category      public.incident_category_enum not null,
  sensitivity   public.incident_sensitivity_enum not null default 'normal',
  title         text not null,
  description   text not null,
  severity      public.incident_severity_enum,
  reported_by   uuid not null references public.persons(person_id),
  primary_owner uuid references public.persons(person_id),
  status        public.incident_status_enum not null default 'reported',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_incidents_restaurant_status
  on public.incidents(restaurant_id, status);

-- ============================================================================
-- DOCUMENTS
-- Soft delete via document_status = archived (ya existente)
-- Integridad polimórfica via trigger — hardening B-03
-- No borrado físico en v1 (I17)
-- ============================================================================

create table if not exists public.documents (
  document_id     uuid primary key default gen_random_uuid(),
  document_type   public.document_type_enum not null,
  owner_type      public.document_owner_type_enum not null,
  owner_id        uuid not null,
  visibility      public.document_visibility_enum not null,
  document_status public.document_status_enum not null default 'active',
  file_url        text not null,
  version         integer not null default 1,
  requires_reauth boolean not null default false,
  created_by      uuid not null references public.persons(person_id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_documents_owner
  on public.documents(owner_type, owner_id);

-- hardening B-03: integridad polimórfica de owner_id
create or replace function public.validate_document_owner_id()
returns trigger language plpgsql as $$
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
    if not exists (select 1 from public.restaurants where restaurant_id = new.owner_id) then
      raise exception 'owner_id % does not exist in restaurants', new.owner_id;
    end if;
  else
    raise exception 'unrecognized owner_type: %', new.owner_type;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_documents_owner_fk on public.documents;
create trigger trg_documents_owner_fk
before insert or update on public.documents
for each row execute function public.validate_document_owner_id();

-- ============================================================================
-- NOTIFICATIONS
-- In-app: tabla notifications
-- Push resiliente: notification_outbox con patrón outbox + dead letter (v6)
-- ============================================================================

create table if not exists public.notifications (
  notification_id  uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.persons(person_id) on delete cascade,
  notification_type public.notification_type_enum not null,
  entity_type      text not null,
  entity_id        uuid,
  delivery_type    public.notification_delivery_enum not null,
  created_at       timestamptz not null default now(),
  read_at          timestamptz
);

create index if not exists idx_notifications_recipient_created
  on public.notifications(recipient_user_id, created_at desc);

-- Patrón outbox con dead letter — hardening B-08
create table if not exists public.notification_outbox (
  outbox_id          uuid primary key default gen_random_uuid(),
  recipient_person_id uuid not null references public.persons(person_id) on delete cascade,
  notification_type  public.notification_type_enum not null,
  entity_type        text not null,
  entity_id          uuid,
  title              text not null,
  body               text not null,
  send_after         timestamptz not null default now(),
  processing_since   timestamptz,
  processed_at       timestamptz,
  failed_at          timestamptz,
  attempts           integer not null default 0,
  max_attempts       integer not null default 10,
  last_error         text,
  created_at         timestamptz not null default now(),
  constraint notification_outbox_attempts_within_limit check (attempts <= max_attempts)
);

create index if not exists idx_notification_outbox_pending
  on public.notification_outbox(send_after)
  where processed_at is null and failed_at is null;

create index if not exists idx_notification_outbox_attempts
  on public.notification_outbox(attempts)
  where processed_at is null and failed_at is null;

create index if not exists idx_notification_outbox_dead_letter
  on public.notification_outbox(created_at desc)
  where processed_at is null
    and failed_at is null
    and attempts >= max_attempts;

create table if not exists public.push_devices (
  push_device_id uuid primary key default gen_random_uuid(),
  person_id      uuid not null references public.persons(person_id) on delete cascade,
  endpoint       text not null,
  p256dh         text not null,
  auth_key       text not null,
  platform       text,
  last_seen_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (endpoint)
);

-- ============================================================================
-- AUDIT LOG
-- Append-only, inmutable (I18)
-- actor_user_id ON DELETE SET NULL — hardening B-07
-- ============================================================================

create table if not exists public.audit_logs (
  audit_id           uuid primary key default gen_random_uuid(),
  entity_type        text not null,
  entity_id          uuid,
  action             public.audit_action_enum not null,
  actor_user_id      uuid,
  actor_role         public.system_role_enum,
  scope_type         public.scope_type_enum,
  scope_id           uuid,
  previous_value_json jsonb,
  new_value_json     jsonb,
  reason             text,
  trace_id           uuid,
  created_at         timestamptz not null default now(),
  constraint audit_logs_actor_user_id_fkey
    foreign key (actor_user_id)
    references public.persons(person_id)
    on delete set null
);

create index if not exists idx_audit_logs_entity
  on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_trace
  on public.audit_logs(trace_id);
create index if not exists idx_audit_logs_actor
  on public.audit_logs(actor_user_id, created_at desc);

-- ============================================================================
-- schedule_config FK a persons (updated_by) — después de crear persons
-- ============================================================================

alter table public.schedule_config
  add column if not exists updated_by uuid references public.persons(person_id);

-- ============================================================================
-- UPDATED_AT TRIGGERS — todas las tablas mutables
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'chains', 'companies', 'restaurants', 'zones',
    'persons', 'role_scope_assignments', 'employment_relationships',
    'shift_templates', 'schedules', 'schedule_entries',
    'task_templates', 'task_instances',
    'procedures', 'incidents', 'documents'
  ]
  loop
    execute format(
      'drop trigger if exists trg_%I_updated_at on public.%I',
      t, t
    );
    execute format(
      'create trigger trg_%I_updated_at before update on public.%I
       for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ============================================================================
-- HELPER FUNCTIONS (hardening B-01)
-- current_person_id() usa auth.uid() nativo
-- current_system_role() con SECURITY DEFINER + search_path fijo
-- ============================================================================

create or replace function public.current_person_id()
returns uuid language sql stable as $$
  select auth.uid()
$$;

create or replace function public.current_system_role()
returns public.system_role_enum
language sql stable
security definer
set search_path = public
as $$
  select p.system_role
  from public.persons p
  where p.person_id = auth.uid()
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select public.current_system_role() = 'admin'::public.system_role_enum
$$;

-- ============================================================================
-- AUDIT HELPER
-- ============================================================================

create or replace function public.insert_audit_log(
  p_entity_type       text,
  p_entity_id         uuid,
  p_action            public.audit_action_enum,
  p_scope_type        public.scope_type_enum,
  p_scope_id          uuid,
  p_previous_value    jsonb,
  p_new_value         jsonb,
  p_reason            text,
  p_trace_id          uuid
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (
    entity_type, entity_id, action,
    actor_user_id, actor_role,
    scope_type, scope_id,
    previous_value_json, new_value_json,
    reason, trace_id
  ) values (
    p_entity_type, p_entity_id, p_action,
    public.current_person_id(), public.current_system_role(),
    p_scope_type, p_scope_id,
    p_previous_value, p_new_value,
    p_reason, p_trace_id
  );
end;
$$;

-- ============================================================================
-- TASK INSTANCE STATE VALIDATOR
-- ============================================================================

create or replace function public.validate_task_instance_state()
returns trigger language plpgsql as $$
begin
  if new.task_status = 'cancelled' and new.cancel_reason is null then
    raise exception 'cancel_reason is required when task_status = cancelled';
  end if;
  if new.task_status = 'needs_reassignment' and new.reassignment_reason is null then
    raise exception 'reassignment_reason is required when task_status = needs_reassignment';
  end if;
  if new.task_status in ('pending','completed','overdue')
     and (new.cancel_reason is not null or new.reassignment_reason is not null) then
    raise exception 'cancel_reason and reassignment_reason must be null for status %', new.task_status;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_instances_validate_state on public.task_instances;
create trigger trg_task_instances_validate_state
before insert or update on public.task_instances
for each row execute function public.validate_task_instance_state();


-- ============================================================================
-- MÓDULO ALBARANES (v7)
-- delivery_note es un document con document_type = delivery_note
-- El archivo vive en documents/Supabase Storage
-- Los datos estructurados viven en delivery_notes + delivery_note_lines
-- OCR: Mindee Invoice API
-- ============================================================================

-- Estados del albarán
-- uploaded            → empleado subió el documento, Mindee procesando
-- employee_reviewed   → empleado revisó extracción y envió a oficina
-- office_reviewing    → oficina lo tiene en cola
-- confirmed           → oficina confirmó, datos en BD oficiales
-- rejected            → oficina rechazó con razón

do $$
begin
  if not exists (select 1 from pg_type where typname = 'delivery_note_status_enum') then
    create type public.delivery_note_status_enum as enum (
      'uploaded',
      'employee_reviewed',
      'office_reviewing',
      'confirmed',
      'rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'supplier_scope_enum') then
    create type public.supplier_scope_enum as enum (
      'chain',
      'restaurant'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- SUPPLIERS — proveedores de cadena o de restaurante
-- ----------------------------------------------------------------------------

create table if not exists public.suppliers (
  supplier_id   uuid primary key default gen_random_uuid(),
  scope_type    public.supplier_scope_enum not null,
  scope_id      uuid not null,
  name          text not null,
  tax_id        text,
  contact_email text,
  contact_phone text,
  is_active     boolean not null default true,
  is_archived   boolean not null default false,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_suppliers_scope
  on public.suppliers(scope_type, scope_id)
  where is_archived = false;

-- Integridad referencial polimórfica para suppliers.scope_id
create or replace function public.validate_supplier_scope_id()
returns trigger language plpgsql as $$
begin
  if new.scope_type = 'chain' then
    if not exists (select 1 from public.chains where chain_id = new.scope_id) then
      raise exception 'supplier scope_id % does not exist in chains', new.scope_id;
    end if;
  elsif new.scope_type = 'restaurant' then
    if not exists (select 1 from public.restaurants where restaurant_id = new.scope_id) then
      raise exception 'supplier scope_id % does not exist in restaurants', new.scope_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_suppliers_scope_fk on public.suppliers;
create trigger trg_suppliers_scope_fk
before insert or update on public.suppliers
for each row execute function public.validate_supplier_scope_id();

-- ----------------------------------------------------------------------------
-- PRODUCTS — catálogo de productos por proveedor
-- ----------------------------------------------------------------------------

create table if not exists public.products (
  product_id  uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(supplier_id) on delete restrict,
  name        text not null,
  description text,
  unit        text,
  is_active   boolean not null default true,
  is_archived boolean not null default false,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_products_supplier
  on public.products(supplier_id)
  where is_archived = false;

-- ----------------------------------------------------------------------------
-- SUPPLIER PRODUCT ALIASES — aprendizaje del sistema
-- Registra cómo cada proveedor llama a cada producto en sus albaranes
-- Se enriquece cada vez que oficina confirma un albarán
-- ----------------------------------------------------------------------------

create table if not exists public.supplier_product_aliases (
  alias_id        uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references public.suppliers(supplier_id) on delete cascade,
  product_id      uuid not null references public.products(product_id) on delete cascade,
  raw_text        text not null,
  confidence      numeric(4,3) not null default 0.0
    check (confidence >= 0.0 and confidence <= 1.0),
  times_confirmed integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (supplier_id, raw_text)
);

create index if not exists idx_supplier_product_aliases_supplier
  on public.supplier_product_aliases(supplier_id, confidence desc);

-- ----------------------------------------------------------------------------
-- DELIVERY NOTES — albaranes
-- El archivo original vive en documents con document_type = delivery_note
-- document_id conecta ambos registros
-- ----------------------------------------------------------------------------

create table if not exists public.delivery_notes (
  delivery_note_id       uuid primary key default gen_random_uuid(),
  restaurant_id          uuid not null references public.restaurants(restaurant_id) on delete restrict,
  supplier_id            uuid references public.suppliers(supplier_id) on delete restrict,
  document_id            uuid references public.documents(document_id) on delete set null,
  document_number        text,
  delivery_date          date,
  status                 public.delivery_note_status_enum not null default 'uploaded',
  ocr_raw_json           jsonb,
  uploaded_by            uuid not null references public.persons(person_id),
  reviewed_by_employee   uuid references public.persons(person_id),
  employee_reviewed_at   timestamptz,
  reviewed_by_office     uuid references public.persons(person_id),
  office_reviewed_at     timestamptz,
  confirmed_at           timestamptz,
  rejection_reason       text,
  total_amount           numeric(12,2),
  tax_amount             numeric(12,2),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- no self-review: quien sube no puede confirmar como oficina
  check (uploaded_by <> reviewed_by_office or reviewed_by_office is null)
);

create index if not exists idx_delivery_notes_restaurant_status
  on public.delivery_notes(restaurant_id, status)
  where status not in ('confirmed', 'rejected');

create index if not exists idx_delivery_notes_supplier
  on public.delivery_notes(supplier_id);

-- ----------------------------------------------------------------------------
-- DELIVERY NOTE LINES — líneas del albarán
-- ----------------------------------------------------------------------------

create table if not exists public.delivery_note_lines (
  line_id          uuid primary key default gen_random_uuid(),
  delivery_note_id uuid not null references public.delivery_notes(delivery_note_id) on delete cascade,
  product_id       uuid references public.products(product_id) on delete set null,
  product_name_raw text not null,
  quantity         numeric(12,4) not null,
  unit             text,
  unit_price       numeric(12,4),
  tax_rate         numeric(5,2),
  tax_amount       numeric(12,2),
  line_total       numeric(12,2),
  is_new_product   boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_delivery_note_lines_note
  on public.delivery_note_lines(delivery_note_id);

create index if not exists idx_delivery_note_lines_product
  on public.delivery_note_lines(product_id);

-- updated_at triggers para nuevas tablas
do $$
declare t text;
begin
  foreach t in array array[
    'suppliers', 'products', 'supplier_product_aliases',
    'delivery_notes', 'delivery_note_lines'
  ]
  loop
    execute format(
      'drop trigger if exists trg_%I_updated_at on public.%I', t, t
    );
    execute format(
      'create trigger trg_%I_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t, t
    );
  end loop;
end $$;

-- Integridad polimórfica de documents: añadir delivery_note al trigger existente
create or replace function public.validate_document_owner_id()
returns trigger language plpgsql as $$
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
    if not exists (select 1 from public.restaurants where restaurant_id = new.owner_id) then
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
