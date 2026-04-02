begin;

create extension if not exists pgcrypto;
create schema if not exists extensions;

do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'btree_gist'
  ) then
    begin
      alter extension btree_gist set schema extensions;
    exception
      when others then null;
    end;
  else
    create extension if not exists btree_gist with schema extensions;
  end if;
end $$;

alter type public.scope_type_enum add value if not exists 'chain';
alter type public.scope_type_enum add value if not exists 'organization';

create or replace function public.inclusive_date_range(
  p_valid_from date,
  p_valid_to date
)
returns daterange
language sql
immutable
set search_path = public
as $$
  select daterange(
    p_valid_from,
    coalesce(p_valid_to + 1, 'infinity'::date),
    '[)'
  )
$$;

create table if not exists public.organizations (
  organization_id uuid primary key default gen_random_uuid(),
  name text not null,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.organizations (organization_id, name)
values ('00000000-0000-0000-0000-000000000003', 'Canonical Default Organization')
on conflict (organization_id) do update
set name = excluded.name;

alter table if exists public.chains
  add column if not exists organization_id uuid references public.organizations(organization_id) on delete restrict;

update public.chains
set organization_id = coalesce(
  organization_id,
  '00000000-0000-0000-0000-000000000003'::uuid
)
where organization_id is null;

alter table if exists public.chains
  alter column organization_id set not null;

create index if not exists idx_chains_organization_id
  on public.chains(organization_id);

alter table if exists public.companies
  add column if not exists organization_id uuid references public.organizations(organization_id) on delete restrict;

update public.companies c
set organization_id = coalesce(
  c.organization_id,
  ch.organization_id,
  '00000000-0000-0000-0000-000000000003'::uuid
)
from public.chains ch
where c.chain_id = ch.chain_id
  and c.organization_id is null;

update public.companies
set organization_id = '00000000-0000-0000-0000-000000000003'::uuid
where organization_id is null;

alter table if exists public.companies
  alter column organization_id set not null;

alter table if exists public.companies
  alter column chain_id drop not null;

create index if not exists idx_companies_organization_id
  on public.companies(organization_id);

create index if not exists idx_companies_chain_id
  on public.companies(chain_id);

drop function if exists public.validate_restaurant_chain_coherence() cascade;
drop function if exists public.validate_role_scope_assignment_scope_id() cascade;
drop function if exists public.sync_person_projection(uuid) cascade;
drop function if exists public.sync_schedule_entry_employment_id() cascade;
drop function if exists public.current_active_scope_type() cascade;
drop function if exists public.current_active_scope_id() cascade;
drop function if exists public.current_user_restaurant_id() cascade;
drop function if exists public.active_scope_matches_restaurant(uuid) cascade;
drop function if exists public.is_schedule_manager_or_office_for_restaurant(uuid) cascade;

drop policy if exists persons_select_by_scope on public.persons;
drop policy if exists employment_relationships_select_by_scope on public.employment_relationships;
drop policy if exists role_scope_assignments_select_by_scope on public.role_scope_assignments;

drop index if exists public.idx_persons_chain_id;
drop index if exists public.idx_persons_chain_identity_document_unique;

alter table if exists public.restaurants
  alter column company_id set not null;

create index if not exists idx_restaurants_company_id
  on public.restaurants(company_id);

alter table if exists public.restaurants
  drop column if exists chain_id cascade;

alter table if exists public.persons
  drop column if exists chain_id cascade;

create temporary table _legacy_sub_manager_persons as
select distinct er.person_id
from public.employment_relationships er
where er.job_title = 'sub_manager';

update public.employment_relationships
set job_title = 'manager'
where job_title = 'sub_manager';

alter table if exists public.employment_relationships
  add column if not exists valid_from date,
  add column if not exists valid_to date;

update public.employment_relationships
set valid_from = coalesce(valid_from, start_date, current_date),
    valid_to = coalesce(valid_to, end_date);

update public.employment_relationships
set valid_from = current_date
where valid_from is null;

alter table if exists public.employment_relationships
  alter column valid_from set default current_date,
  alter column valid_from set not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employment_relationships'
      and column_name = 'valid_during'
  ) then
    execute $sql$
      alter table public.employment_relationships
      add column valid_during daterange
      generated always as (public.inclusive_date_range(valid_from, valid_to)) stored
    $sql$;
  end if;
end $$;

alter table if exists public.employment_relationships
  drop constraint if exists employment_relationships_valid_dates_chk;

alter table if exists public.employment_relationships
  add constraint employment_relationships_valid_dates_chk
  check (valid_to is null or valid_to >= valid_from);

create temporary table _role_scope_assignments_legacy as
select
  rsa.assignment_id,
  rsa.person_id,
  rsa.scope_type::text as scope_type_text,
  rsa.scope_id,
  rsa.active,
  rsa.created_at,
  rsa.updated_at,
  p.system_role,
  exists (
    select 1
    from _legacy_sub_manager_persons sm
    where sm.person_id = rsa.person_id
  ) as was_sub_manager,
  (
    select er.job_title
    from public.employment_relationships er
    where er.person_id = rsa.person_id
      and coalesce(er.is_archived, false) = false
      and er.deleted_at is null
    order by coalesce(er.valid_from, er.start_date, current_date) desc, er.created_at desc
    limit 1
  ) as job_title
from public.role_scope_assignments rsa
join public.persons p
  on p.person_id = rsa.person_id;

drop table if exists public.role_scope_assignments cascade;

create table public.role_scope_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(person_id) on delete cascade,
  scope_type public.scope_type_enum not null,
  scope_id uuid not null,
  valid_from date not null default current_date,
  valid_to date,
  valid_during daterange generated always as (public.inclusive_date_range(valid_from, valid_to)) stored,
  authority_tier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  check (authority_tier in ('primary', 'secondary') or authority_tier is null)
);

insert into public.role_scope_assignments (
  assignment_id,
  person_id,
  scope_type,
  scope_id,
  valid_from,
  valid_to,
  authority_tier,
  created_at,
  updated_at
)
select
  l.assignment_id,
  l.person_id,
  case
    when l.scope_type_text = 'organization' then 'organization'::public.scope_type_enum
    when l.scope_type_text = 'chain' then 'chain'::public.scope_type_enum
    when l.scope_type_text = 'company' then 'company'::public.scope_type_enum
    when l.scope_type_text = 'restaurant' then 'restaurant'::public.scope_type_enum
    when l.scope_type_text = 'zone' then 'zone'::public.scope_type_enum
    when l.scope_type_text = 'platform' and l.system_role = 'admin'::public.system_role_enum
      then 'organization'::public.scope_type_enum
    else null
  end,
  case
    when l.scope_type_text = 'platform' and l.system_role = 'admin'::public.system_role_enum
      then '00000000-0000-0000-0000-000000000003'::uuid
    else l.scope_id
  end,
  coalesce(l.created_at::date, current_date),
  case
    when coalesce(l.active, true) = false then coalesce(l.updated_at::date, l.created_at::date, current_date)
    else null
  end,
  case
    when l.system_role = 'manager'::public.system_role_enum and l.was_sub_manager then 'secondary'
    when l.system_role = 'manager'::public.system_role_enum then 'primary'
    else null
  end,
  coalesce(l.created_at, now()),
  coalesce(l.updated_at, coalesce(l.created_at, now()))
from _role_scope_assignments_legacy l
where l.system_role <> 'employee'::public.system_role_enum
  and (
    l.scope_id is not null
    or (l.scope_type_text = 'platform' and l.system_role = 'admin'::public.system_role_enum)
  )
  and case
    when l.system_role = 'admin'::public.system_role_enum then l.scope_type_text in ('organization', 'platform')
    when l.system_role = 'owner'::public.system_role_enum then l.scope_type_text in ('organization', 'chain', 'company')
    when l.system_role = 'office'::public.system_role_enum then l.scope_type_text in ('organization', 'chain', 'company', 'restaurant')
    when l.system_role = 'manager'::public.system_role_enum then l.scope_type_text = 'restaurant'
    when l.system_role = 'area_lead'::public.system_role_enum then l.scope_type_text = 'zone'
    else false
  end;

drop table if exists public.employment_restaurant_assignments cascade;

create table public.employment_restaurant_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  employment_id uuid not null references public.employment_relationships(employment_id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  valid_from date not null default current_date,
  valid_to date,
  valid_during daterange generated always as (public.inclusive_date_range(valid_from, valid_to)) stored,
  transfer_reason text,
  created_by uuid references public.persons(person_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);

insert into public.employment_restaurant_assignments (
  employment_id,
  restaurant_id,
  valid_from,
  valid_to,
  transfer_reason,
  created_at,
  updated_at
)
select
  er.employment_id,
  er.restaurant_id,
  er.valid_from,
  er.valid_to,
  'legacy_backfill',
  er.created_at,
  er.updated_at
from public.employment_relationships er
where er.restaurant_id is not null;

drop table if exists public.employment_zone_assignments cascade;

create table public.employment_zone_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  employment_id uuid not null references public.employment_relationships(employment_id) on delete cascade,
  zone_id uuid not null references public.restaurant_zones(id) on delete restrict,
  valid_from date not null default current_date,
  valid_to date,
  valid_during daterange generated always as (public.inclusive_date_range(valid_from, valid_to)) stored,
  created_by uuid references public.persons(person_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);

insert into public.employment_zone_assignments (
  employment_id,
  zone_id,
  valid_from,
  valid_to
)
select
  er.employment_id,
  rsa.scope_id,
  rsa.valid_from,
  rsa.valid_to
from public.role_scope_assignments rsa
join public.employment_relationships er
  on er.person_id = rsa.person_id
join public.persons p
  on p.person_id = rsa.person_id
where p.system_role = 'area_lead'::public.system_role_enum
  and rsa.scope_type = 'zone'::public.scope_type_enum;

drop index if exists public.idx_employment_one_active_principal_per_person;
drop index if exists public.idx_employment_relationships_restaurant_id;
drop index if exists public.idx_employment_relationships_person_active;

alter table if exists public.employment_relationships
  drop column if exists restaurant_id cascade,
  drop column if exists start_date cascade,
  drop column if exists end_date cascade,
  drop column if exists active_principal cascade;

create index if not exists idx_employment_relationships_person_id
  on public.employment_relationships(person_id);

create index if not exists idx_employment_relationships_company_id
  on public.employment_relationships(company_id);

create index if not exists idx_employment_relationships_valid_during
  on public.employment_relationships using gist (valid_during);

create index if not exists idx_role_scope_assignments_person_id
  on public.role_scope_assignments(person_id);

create index if not exists idx_role_scope_assignments_scope_target
  on public.role_scope_assignments(scope_type, scope_id);

create index if not exists idx_role_scope_assignments_valid_during
  on public.role_scope_assignments using gist (valid_during);

create index if not exists idx_employment_restaurant_assignments_employment_id
  on public.employment_restaurant_assignments(employment_id);

create index if not exists idx_employment_restaurant_assignments_restaurant_id
  on public.employment_restaurant_assignments(restaurant_id);

create index if not exists idx_employment_restaurant_assignments_valid_during
  on public.employment_restaurant_assignments using gist (valid_during);

create index if not exists idx_employment_zone_assignments_employment_id
  on public.employment_zone_assignments(employment_id);

create index if not exists idx_employment_zone_assignments_zone_id
  on public.employment_zone_assignments(zone_id);

create index if not exists idx_employment_zone_assignments_valid_during
  on public.employment_zone_assignments using gist (valid_during);

alter table if exists public.employment_relationships
  drop constraint if exists employment_relationships_one_active_period;

alter table if exists public.employment_relationships
  add constraint employment_relationships_one_active_period
  exclude using gist (
    person_id with =,
    valid_during with &&
  )
  where (is_archived = false and deleted_at is null);

alter table if exists public.role_scope_assignments
  drop constraint if exists role_scope_assignments_no_exact_overlap;

alter table if exists public.role_scope_assignments
  add constraint role_scope_assignments_no_exact_overlap
  exclude using gist (
    person_id with =,
    scope_type with =,
    scope_id with =,
    valid_during with &&
  );

alter table if exists public.employment_restaurant_assignments
  drop constraint if exists employment_restaurant_assignments_no_exact_overlap;

alter table if exists public.employment_restaurant_assignments
  add constraint employment_restaurant_assignments_no_exact_overlap
  exclude using gist (
    employment_id with =,
    restaurant_id with =,
    valid_during with &&
  );

create or replace function public.current_active_scope_type()
returns public.scope_type_enum
language sql
stable
security definer
set search_path = public, auth
as $$
  select nullif(auth.jwt() ->> 'active_scope_type', '')::public.scope_type_enum
$$;

create or replace function public.current_active_scope_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select nullif(auth.jwt() ->> 'active_scope_id', '')::uuid
$$;

create or replace function public.current_user_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when public.current_active_scope_type() = 'restaurant'::public.scope_type_enum
      then public.current_active_scope_id()
    when public.current_active_scope_type() = 'zone'::public.scope_type_enum
      then (
        select rz.restaurant_id
        from public.restaurant_zones rz
        where rz.id = public.current_active_scope_id()
        limit 1
      )
    else (
      select era.restaurant_id
      from public.employment_relationships er
      join public.employment_restaurant_assignments era
        on era.employment_id = er.employment_id
      where er.person_id = auth.uid()
        and er.is_archived = false
        and er.deleted_at is null
        and current_date <@ er.valid_during
        and current_date <@ era.valid_during
      order by era.valid_from desc, era.created_at desc
      limit 1
    )
  end
$$;

create or replace function public.scope_entity_exists(
  p_scope_type public.scope_type_enum,
  p_scope_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when p_scope_type = 'organization'::public.scope_type_enum then exists (
      select 1
      from public.organizations o
      where o.organization_id = p_scope_id
    )
    when p_scope_type = 'chain'::public.scope_type_enum then exists (
      select 1
      from public.chains c
      where c.chain_id = p_scope_id
    )
    when p_scope_type = 'company'::public.scope_type_enum then exists (
      select 1
      from public.companies c
      where c.company_id = p_scope_id
    )
    when p_scope_type = 'restaurant'::public.scope_type_enum then exists (
      select 1
      from public.restaurants r
      where r.id = p_scope_id
    )
    when p_scope_type = 'zone'::public.scope_type_enum then exists (
      select 1
      from public.restaurant_zones z
      where z.id = p_scope_id
    )
    else false
  end
$$;

create or replace function public.scope_contains(
  p_parent_type public.scope_type_enum,
  p_parent_id uuid,
  p_child_type public.scope_type_enum,
  p_child_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when p_parent_type = p_child_type and p_parent_id = p_child_id then true
    when p_parent_type = 'organization'::public.scope_type_enum and p_child_type = 'chain'::public.scope_type_enum then exists (
      select 1
      from public.chains ch
      where ch.chain_id = p_child_id
        and ch.organization_id = p_parent_id
    )
    when p_parent_type = 'organization'::public.scope_type_enum and p_child_type = 'company'::public.scope_type_enum then exists (
      select 1
      from public.companies c
      where c.company_id = p_child_id
        and c.organization_id = p_parent_id
    )
    when p_parent_type = 'organization'::public.scope_type_enum and p_child_type = 'restaurant'::public.scope_type_enum then exists (
      select 1
      from public.restaurants r
      join public.companies c
        on c.company_id = r.company_id
      where r.id = p_child_id
        and c.organization_id = p_parent_id
    )
    when p_parent_type = 'organization'::public.scope_type_enum and p_child_type = 'zone'::public.scope_type_enum then exists (
      select 1
      from public.restaurant_zones z
      join public.restaurants r
        on r.id = z.restaurant_id
      join public.companies c
        on c.company_id = r.company_id
      where z.id = p_child_id
        and c.organization_id = p_parent_id
    )
    when p_parent_type = 'chain'::public.scope_type_enum and p_child_type = 'company'::public.scope_type_enum then exists (
      select 1
      from public.companies c
      where c.company_id = p_child_id
        and c.chain_id = p_parent_id
    )
    when p_parent_type = 'chain'::public.scope_type_enum and p_child_type = 'restaurant'::public.scope_type_enum then exists (
      select 1
      from public.restaurants r
      join public.companies c
        on c.company_id = r.company_id
      where r.id = p_child_id
        and c.chain_id = p_parent_id
    )
    when p_parent_type = 'chain'::public.scope_type_enum and p_child_type = 'zone'::public.scope_type_enum then exists (
      select 1
      from public.restaurant_zones z
      join public.restaurants r
        on r.id = z.restaurant_id
      join public.companies c
        on c.company_id = r.company_id
      where z.id = p_child_id
        and c.chain_id = p_parent_id
    )
    when p_parent_type = 'company'::public.scope_type_enum and p_child_type = 'restaurant'::public.scope_type_enum then exists (
      select 1
      from public.restaurants r
      where r.id = p_child_id
        and r.company_id = p_parent_id
    )
    when p_parent_type = 'company'::public.scope_type_enum and p_child_type = 'zone'::public.scope_type_enum then exists (
      select 1
      from public.restaurant_zones z
      join public.restaurants r
        on r.id = z.restaurant_id
      where z.id = p_child_id
        and r.company_id = p_parent_id
    )
    when p_parent_type = 'restaurant'::public.scope_type_enum and p_child_type = 'zone'::public.scope_type_enum then exists (
      select 1
      from public.restaurant_zones z
      where z.id = p_child_id
        and z.restaurant_id = p_parent_id
    )
    else false
  end
$$;

create or replace function public.current_scope_covers_restaurant(
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
    from public.role_scope_assignments rsa
    where rsa.person_id = auth.uid()
      and current_date <@ rsa.valid_during
      and (
        public.current_active_scope_type() is null
        or public.current_active_scope_id() is null
        or public.scope_contains(
          public.current_active_scope_type(),
          public.current_active_scope_id(),
          'restaurant'::public.scope_type_enum,
          p_restaurant_id
        )
      )
      and public.scope_contains(
        rsa.scope_type,
        rsa.scope_id,
        'restaurant'::public.scope_type_enum,
        p_restaurant_id
      )
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
  select public.current_system_role()::public.system_role_enum in (
    'admin'::public.system_role_enum,
    'office'::public.system_role_enum,
    'manager'::public.system_role_enum
  )
  and (
    public.current_scope_covers_restaurant(p_restaurant_id)
    or public.current_user_restaurant_id() = p_restaurant_id
  )
$$;

create or replace function public.validate_role_scope_assignment_canon()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role public.system_role_enum;
  v_new_range daterange;
begin
  select p.system_role
  into v_role
  from public.persons p
  where p.person_id = new.person_id;

  if v_role is null then
    raise exception 'person_id % does not exist in persons', new.person_id;
  end if;

  if new.valid_to is not null and new.valid_to < new.valid_from then
    raise exception 'valid_to (%) must be >= valid_from (%)', new.valid_to, new.valid_from;
  end if;

  if not public.scope_entity_exists(new.scope_type, new.scope_id) then
    raise exception 'scope target % (%) does not exist', new.scope_type, new.scope_id;
  end if;

  if v_role = 'employee'::public.system_role_enum then
    raise exception 'employee cannot have role_scope_assignments';
  elsif v_role = 'admin'::public.system_role_enum and new.scope_type <> 'organization'::public.scope_type_enum then
    raise exception 'admin only admits organization scope';
  elsif v_role = 'owner'::public.system_role_enum and new.scope_type not in (
    'organization'::public.scope_type_enum,
    'chain'::public.scope_type_enum,
    'company'::public.scope_type_enum
  ) then
    raise exception 'owner only admits organization, chain or company scope';
  elsif v_role = 'office'::public.system_role_enum and new.scope_type not in (
    'organization'::public.scope_type_enum,
    'chain'::public.scope_type_enum,
    'company'::public.scope_type_enum,
    'restaurant'::public.scope_type_enum
  ) then
    raise exception 'office only admits organization, chain, company or restaurant scope';
  elsif v_role = 'manager'::public.system_role_enum and new.scope_type <> 'restaurant'::public.scope_type_enum then
    raise exception 'manager only admits restaurant scope';
  elsif v_role = 'area_lead'::public.system_role_enum and new.scope_type <> 'zone'::public.scope_type_enum then
    raise exception 'area_lead only admits zone scope';
  end if;

  if v_role = 'manager'::public.system_role_enum then
    if new.authority_tier is null then
      raise exception 'manager requires authority_tier';
    end if;
  elsif new.authority_tier is not null then
    raise exception 'authority_tier only applies to manager';
  end if;

  v_new_range := public.inclusive_date_range(new.valid_from, new.valid_to);

  if exists (
    select 1
    from public.role_scope_assignments rsa
    where rsa.person_id = new.person_id
      and rsa.assignment_id is distinct from new.assignment_id
      and rsa.valid_during && v_new_range
      and (
        public.scope_contains(rsa.scope_type, rsa.scope_id, new.scope_type, new.scope_id)
        or public.scope_contains(new.scope_type, new.scope_id, rsa.scope_type, rsa.scope_id)
      )
  ) then
    raise exception 'redundant role scope assignment for person_id %', new.person_id;
  end if;

  return new;
end;
$$;

create or replace function public.validate_employment_restaurant_assignment_canon()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role public.system_role_enum;
  v_company_id uuid;
  v_restaurant_company_id uuid;
  v_new_range daterange;
begin
  select p.system_role, er.company_id
  into v_role, v_company_id
  from public.employment_relationships er
  join public.persons p
    on p.person_id = er.person_id
  where er.employment_id = new.employment_id;

  if v_role is null then
    raise exception 'employment_id % does not exist', new.employment_id;
  end if;

  if v_role not in (
    'employee'::public.system_role_enum,
    'manager'::public.system_role_enum,
    'area_lead'::public.system_role_enum
  ) then
    raise exception 'employment_restaurant_assignments only apply to employee, manager or area_lead';
  end if;

  select r.company_id
  into v_restaurant_company_id
  from public.restaurants r
  where r.id = new.restaurant_id;

  if v_restaurant_company_id is distinct from v_company_id then
    raise exception 'restaurant % belongs to another company', new.restaurant_id;
  end if;

  if new.valid_to is not null and new.valid_to < new.valid_from then
    raise exception 'valid_to (%) must be >= valid_from (%)', new.valid_to, new.valid_from;
  end if;

  v_new_range := public.inclusive_date_range(new.valid_from, new.valid_to);

  if v_role in ('employee'::public.system_role_enum, 'area_lead'::public.system_role_enum)
     and exists (
       select 1
       from public.employment_restaurant_assignments era
       where era.employment_id = new.employment_id
         and era.assignment_id is distinct from new.assignment_id
         and era.valid_during && v_new_range
     ) then
    raise exception '% cannot have overlapping restaurant assignments', v_role;
  end if;

  return new;
end;
$$;

create or replace function public.validate_employment_zone_assignment_canon()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role public.system_role_enum;
  v_zone_restaurant_id uuid;
  v_new_range daterange;
begin
  select p.system_role
  into v_role
  from public.employment_relationships er
  join public.persons p
    on p.person_id = er.person_id
  where er.employment_id = new.employment_id;

  if v_role is null then
    raise exception 'employment_id % does not exist', new.employment_id;
  end if;

  if v_role <> 'area_lead'::public.system_role_enum then
    raise exception 'employment_zone_assignments only apply to area_lead';
  end if;

  select z.restaurant_id
  into v_zone_restaurant_id
  from public.restaurant_zones z
  where z.id = new.zone_id;

  if v_zone_restaurant_id is null then
    raise exception 'zone_id % does not exist in restaurant_zones', new.zone_id;
  end if;

  if new.valid_to is not null and new.valid_to < new.valid_from then
    raise exception 'valid_to (%) must be >= valid_from (%)', new.valid_to, new.valid_from;
  end if;

  v_new_range := public.inclusive_date_range(new.valid_from, new.valid_to);

  if exists (
    select 1
    from public.employment_zone_assignments eza
    where eza.employment_id = new.employment_id
      and eza.assignment_id is distinct from new.assignment_id
      and eza.valid_during && v_new_range
  ) then
    raise exception 'area_lead cannot have overlapping zone assignments';
  end if;

  if not exists (
    select 1
    from public.employment_restaurant_assignments era
    where era.employment_id = new.employment_id
      and era.restaurant_id = v_zone_restaurant_id
      and era.valid_during @> v_new_range
  ) then
    raise exception 'zone assignment must be contained inside an active restaurant assignment for the same restaurant';
  end if;

  return new;
end;
$$;

create or replace function public.sync_schedule_entry_employment_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  if new.schedule_id is null then
    return new;
  end if;

  if new.entry_date is null then
    raise exception 'schedule entry requires entry_date';
  end if;

  if new.employment_id is null then
    raise exception 'schedule entry requires employment_id';
  end if;

  select s.restaurant_id
  into v_restaurant_id
  from public.schedules s
  where s.id = new.schedule_id;

  if v_restaurant_id is null then
    raise exception 'schedule not found for schedule entry';
  end if;

  if new.zone_id is not null and not exists (
    select 1
    from public.restaurant_zones rz
    where rz.id = new.zone_id
      and rz.restaurant_id = v_restaurant_id
  ) then
    raise exception 'schedule entry zone must belong to the schedule restaurant';
  end if;

  if not exists (
    select 1
    from public.employment_relationships er
    join public.employment_restaurant_assignments era
      on era.employment_id = er.employment_id
    where er.employment_id = new.employment_id
      and er.is_archived = false
      and er.deleted_at is null
      and new.entry_date <@ er.valid_during
      and era.restaurant_id = v_restaurant_id
      and new.entry_date <@ era.valid_during
  ) then
    raise exception 'schedule entry employment must be active for the schedule restaurant on entry_date';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_role_scope_assignments_updated_at on public.role_scope_assignments;
create trigger trg_role_scope_assignments_updated_at
before update on public.role_scope_assignments
for each row
execute function public.set_updated_at();

drop trigger if exists trg_role_scope_assignments_validate_canon on public.role_scope_assignments;
create trigger trg_role_scope_assignments_validate_canon
before insert or update on public.role_scope_assignments
for each row
execute function public.validate_role_scope_assignment_canon();

drop trigger if exists trg_employment_relationships_updated_at on public.employment_relationships;
create trigger trg_employment_relationships_updated_at
before update on public.employment_relationships
for each row
execute function public.set_updated_at();

drop trigger if exists trg_employment_restaurant_assignments_updated_at on public.employment_restaurant_assignments;
create trigger trg_employment_restaurant_assignments_updated_at
before update on public.employment_restaurant_assignments
for each row
execute function public.set_updated_at();

drop trigger if exists trg_employment_restaurant_assignments_validate_canon on public.employment_restaurant_assignments;
create trigger trg_employment_restaurant_assignments_validate_canon
before insert or update on public.employment_restaurant_assignments
for each row
execute function public.validate_employment_restaurant_assignment_canon();

drop trigger if exists trg_employment_zone_assignments_updated_at on public.employment_zone_assignments;
create trigger trg_employment_zone_assignments_updated_at
before update on public.employment_zone_assignments
for each row
execute function public.set_updated_at();

drop trigger if exists trg_employment_zone_assignments_validate_canon on public.employment_zone_assignments;
create trigger trg_employment_zone_assignments_validate_canon
before insert or update on public.employment_zone_assignments
for each row
execute function public.validate_employment_zone_assignment_canon();

drop trigger if exists trg_schedule_entries_sync_employment_id on public.schedule_entries;
create trigger trg_schedule_entries_sync_employment_id
before insert or update on public.schedule_entries
for each row
execute function public.sync_schedule_entry_employment_id();

alter table if exists public.organizations enable row level security;
alter table if exists public.chains enable row level security;
alter table if exists public.companies enable row level security;
alter table if exists public.persons enable row level security;
alter table if exists public.employment_relationships enable row level security;
alter table if exists public.role_scope_assignments enable row level security;
alter table if exists public.employment_restaurant_assignments enable row level security;
alter table if exists public.employment_zone_assignments enable row level security;

drop policy if exists organizations_admin_all on public.organizations;
create policy organizations_admin_all
on public.organizations
for all
using (public.is_admin_actor())
with check (public.is_admin_actor());

drop policy if exists chains_admin_all on public.chains;
create policy chains_admin_all
on public.chains
for all
using (public.is_admin_actor())
with check (public.is_admin_actor());

drop policy if exists companies_admin_all on public.companies;
create policy companies_admin_all
on public.companies
for all
using (public.is_admin_actor())
with check (public.is_admin_actor());

drop policy if exists persons_select_self_or_admin on public.persons;
create policy persons_select_self_or_admin
on public.persons
for select
using (
  person_id = public.current_person_id()
  or public.is_admin_actor()
);

drop policy if exists persons_admin_all on public.persons;
create policy persons_admin_all
on public.persons
for all
using (public.is_admin_actor())
with check (public.is_admin_actor());

drop policy if exists employment_relationships_select_self_or_admin on public.employment_relationships;
create policy employment_relationships_select_self_or_admin
on public.employment_relationships
for select
using (
  person_id = public.current_person_id()
  or public.is_admin_actor()
);

drop policy if exists employment_relationships_admin_all on public.employment_relationships;
create policy employment_relationships_admin_all
on public.employment_relationships
for all
using (public.is_admin_actor())
with check (public.is_admin_actor());

drop policy if exists role_scope_assignments_select_self_or_admin on public.role_scope_assignments;
create policy role_scope_assignments_select_self_or_admin
on public.role_scope_assignments
for select
using (
  person_id = public.current_person_id()
  or public.is_admin_actor()
);

drop policy if exists role_scope_assignments_admin_all on public.role_scope_assignments;
create policy role_scope_assignments_admin_all
on public.role_scope_assignments
for all
using (public.is_admin_actor())
with check (public.is_admin_actor());

drop policy if exists employment_restaurant_assignments_select_self_or_admin on public.employment_restaurant_assignments;
create policy employment_restaurant_assignments_select_self_or_admin
on public.employment_restaurant_assignments
for select
using (
  public.is_admin_actor()
  or employment_id in (
    select er.employment_id
    from public.employment_relationships er
    where er.person_id = public.current_person_id()
  )
);

drop policy if exists employment_restaurant_assignments_admin_all on public.employment_restaurant_assignments;
create policy employment_restaurant_assignments_admin_all
on public.employment_restaurant_assignments
for all
using (public.is_admin_actor())
with check (public.is_admin_actor());

drop policy if exists employment_zone_assignments_select_self_or_admin on public.employment_zone_assignments;
create policy employment_zone_assignments_select_self_or_admin
on public.employment_zone_assignments
for select
using (
  public.is_admin_actor()
  or employment_id in (
    select er.employment_id
    from public.employment_relationships er
    where er.person_id = public.current_person_id()
  )
);

drop policy if exists employment_zone_assignments_admin_all on public.employment_zone_assignments;
create policy employment_zone_assignments_admin_all
on public.employment_zone_assignments
for all
using (public.is_admin_actor())
with check (public.is_admin_actor());

grant execute on function public.inclusive_date_range(date, date) to authenticated;
grant execute on function public.current_active_scope_type() to authenticated;
grant execute on function public.current_active_scope_id() to authenticated;
grant execute on function public.current_user_restaurant_id() to authenticated;
grant execute on function public.scope_entity_exists(public.scope_type_enum, uuid) to authenticated;
grant execute on function public.scope_contains(public.scope_type_enum, uuid, public.scope_type_enum, uuid) to authenticated;
grant execute on function public.current_scope_covers_restaurant(uuid) to authenticated;
grant execute on function public.is_schedule_manager_or_office_for_restaurant(uuid) to authenticated;

commit;
