begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'system_role_enum'
  ) then
    create type public.system_role_enum as enum (
      'admin',
      'office',
      'manager',
      'sub_manager',
      'area_lead',
      'employee'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'scope_type_enum'
  ) then
    create type public.scope_type_enum as enum (
      'platform',
      'chain',
      'company',
      'restaurant',
      'zone'
    );
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.chains (
  chain_id uuid primary key default gen_random_uuid(),
  name text not null,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  company_id uuid primary key default gen_random_uuid(),
  chain_id uuid references public.chains(chain_id) on delete restrict,
  name text not null,
  legal_identifier text,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.chains (chain_id, name)
values ('00000000-0000-0000-0000-000000000001', 'Legacy Migrated Chain')
on conflict (chain_id) do update
set name = excluded.name;

insert into public.companies (company_id, chain_id, name)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Legacy Migrated Company'
)
on conflict (company_id) do update
set
  chain_id = excluded.chain_id,
  name = excluded.name;

create or replace function public.validate_restaurant_chain_coherence()
returns trigger
language plpgsql
as $$
begin
  if new.company_id is null or new.chain_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.companies c
    where c.company_id = new.company_id
      and c.chain_id = new.chain_id
  ) then
    raise exception
      'restaurants.chain_id (%) must match companies.chain_id for company_id (%)',
      new.chain_id,
      new.company_id;
  end if;

  return new;
end;
$$;

alter table if exists public.restaurants
  add column if not exists chain_id uuid references public.chains(chain_id) on delete restrict,
  add column if not exists company_id uuid references public.companies(company_id) on delete restrict,
  add column if not exists timezone text not null default 'Europe/Madrid',
  add column if not exists is_archived boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.restaurants r
set chain_id = coalesce(
      r.chain_id,
      '00000000-0000-0000-0000-000000000001'::uuid
    ),
    company_id = coalesce(
      r.company_id,
      '00000000-0000-0000-0000-000000000002'::uuid
    )
where r.chain_id is null
   or r.company_id is null;

drop trigger if exists trg_restaurants_chain_coherence on public.restaurants;
create trigger trg_restaurants_chain_coherence
before insert or update on public.restaurants
for each row
execute function public.validate_restaurant_chain_coherence();

create table if not exists public.persons (
  person_id uuid primary key references auth.users(id) on delete cascade,
  chain_id uuid not null references public.chains(chain_id) on delete restrict,
  first_name text not null,
  last_name text not null default '',
  phone text,
  email text,
  birth_date date,
  identity_document text,
  avatar_url text,
  system_role public.system_role_enum not null,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_persons_chain_id
  on public.persons(chain_id);

create unique index if not exists idx_persons_chain_identity_document_unique
  on public.persons(chain_id, identity_document)
  where identity_document is not null and is_archived = false;

do $$
declare
  t text;
begin
  foreach t in array array['chains', 'companies', 'restaurants', 'persons']
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t,
      t
    );
  end loop;
end $$;

insert into public.persons (
  person_id,
  chain_id,
  first_name,
  last_name,
  email,
  avatar_url,
  system_role,
  is_archived,
  deleted_at,
  created_at,
  updated_at
)
select
  p.id,
  coalesce(
    r.chain_id,
    '00000000-0000-0000-0000-000000000001'::uuid
  ) as chain_id,
  coalesce(
    nullif(split_part(trim(p.full_name), ' ', 1), ''),
    'SinNombre'
  ) as first_name,
  coalesce(
    nullif(
      ltrim(
        substr(
          trim(p.full_name),
          length(split_part(trim(p.full_name), ' ', 1)) + 1
        )
      ),
      ''
    ),
    ''
  ) as last_name,
  au.email,
  p.avatar_path,
  case
    when p.role = 'employee' and coalesce(p.is_area_lead, false)
      then 'area_lead'::public.system_role_enum
    else p.role::text::public.system_role_enum
  end as system_role,
  (not coalesce(p.is_active, true)) or p.deleted_at is not null,
  p.deleted_at,
  coalesce(p.created_at, now()),
  coalesce(p.updated_at, p.created_at, now())
from public.profiles p
left join public.restaurants r
  on r.id = p.restaurant_id
left join auth.users au
  on au.id = p.id
on conflict (person_id) do update
set
  chain_id = excluded.chain_id,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  email = excluded.email,
  avatar_url = excluded.avatar_url,
  system_role = excluded.system_role,
  is_archived = excluded.is_archived,
  deleted_at = excluded.deleted_at,
  updated_at = now();

commit;
