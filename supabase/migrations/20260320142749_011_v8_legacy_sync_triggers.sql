begin;

create or replace function public.legacy_profile_to_system_role(
  p_role public.app_role,
  p_is_area_lead boolean
)
returns public.system_role_enum
language sql
stable
set search_path = public
as $$
  select case
    when p_role = 'employee'::public.app_role and coalesce(p_is_area_lead, false)
      then 'area_lead'::public.system_role_enum
    else p_role::text::public.system_role_enum
  end
$$;

create or replace function public.sync_legacy_person_projection(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles%rowtype;
  v_chain_id uuid;
  v_email text;
  v_first_name text;
  v_last_name text;
begin
  select * into v_profile
  from public.profiles
  where id = p_profile_id;

  if not found then
    return;
  end if;

  select r.chain_id into v_chain_id
  from public.restaurants r
  where r.id = v_profile.restaurant_id;

  select u.email into v_email
  from auth.users u
  where u.id = p_profile_id;

  v_first_name := coalesce(
    nullif(split_part(trim(v_profile.full_name), ' ', 1), ''),
    'SinNombre'
  );
  v_last_name := coalesce(
    nullif(
      ltrim(
        substr(
          trim(v_profile.full_name),
          length(split_part(trim(v_profile.full_name), ' ', 1)) + 1
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
    avatar_url,
    system_role,
    is_archived,
    deleted_at,
    created_at,
    updated_at
  ) values (
    v_profile.id,
    coalesce(v_chain_id, '00000000-0000-0000-0000-000000000001'::uuid),
    v_first_name,
    v_last_name,
    v_email,
    v_profile.avatar_path,
    public.legacy_profile_to_system_role(v_profile.role, v_profile.is_area_lead),
    (not coalesce(v_profile.is_active, true)) or v_profile.deleted_at is not null,
    v_profile.deleted_at,
    coalesce(v_profile.created_at, now()),
    coalesce(v_profile.updated_at, v_profile.created_at, now())
  )
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
end;
$$;

create or replace function public.sync_legacy_employment_projection(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_company_id uuid;
  v_existing_employment_id uuid;
begin
  select * into v_profile
  from public.profiles
  where id = p_profile_id;

  if not found then
    return;
  end if;

  if v_profile.restaurant_id is null
     or v_profile.role not in ('employee', 'manager', 'sub_manager') then
    update public.employment_relationships
    set
      active_principal = false,
      is_archived = true,
      deleted_at = coalesce(deleted_at, now()),
      end_date = coalesce(end_date, current_date),
      updated_at = now()
    where person_id = p_profile_id
      and active_principal = true
      and is_archived = false;
    return;
  end if;

  select r.company_id into v_company_id
  from public.restaurants r
  where r.id = v_profile.restaurant_id;

  select er.employment_id into v_existing_employment_id
  from public.employment_relationships er
  where er.person_id = p_profile_id
    and er.active_principal = true
  order by er.created_at desc
  limit 1;

  if v_existing_employment_id is null then
    insert into public.employment_relationships (
      person_id,
      company_id,
      restaurant_id,
      job_title,
      requires_schedule,
      start_date,
      end_date,
      active_principal,
      is_archived,
      deleted_at,
      created_at,
      updated_at
    ) values (
      p_profile_id,
      coalesce(v_company_id, '00000000-0000-0000-0000-000000000002'::uuid),
      v_profile.restaurant_id,
      case
        when v_profile.role = 'employee' and coalesce(v_profile.is_area_lead, false)
          then 'area_lead'
        else v_profile.role::text
      end,
      true,
      coalesce(v_profile.start_date, current_date),
      v_profile.end_date,
      true,
      (not coalesce(v_profile.is_active, true)) or v_profile.deleted_at is not null,
      v_profile.deleted_at,
      coalesce(v_profile.created_at, now()),
      coalesce(v_profile.updated_at, v_profile.created_at, now())
    );
  else
    update public.employment_relationships
    set
      company_id = coalesce(v_company_id, '00000000-0000-0000-0000-000000000002'::uuid),
      restaurant_id = v_profile.restaurant_id,
      job_title = case
        when v_profile.role = 'employee' and coalesce(v_profile.is_area_lead, false)
          then 'area_lead'
        else v_profile.role::text
      end,
      requires_schedule = true,
      start_date = coalesce(v_profile.start_date, current_date),
      end_date = v_profile.end_date,
      active_principal = true,
      is_archived = (not coalesce(v_profile.is_active, true)) or v_profile.deleted_at is not null,
      deleted_at = v_profile.deleted_at,
      updated_at = now()
    where employment_id = v_existing_employment_id;
  end if;
end;
$$;

create or replace function public.sync_legacy_scope_projection(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_system_role public.system_role_enum;
  v_scope_type public.scope_type_enum;
  v_scope_id uuid;
begin
  select * into v_profile
  from public.profiles
  where id = p_profile_id;

  if not found then
    return;
  end if;

  delete from public.role_scope_assignments
  where person_id = p_profile_id;

  if (not coalesce(v_profile.is_active, true)) or v_profile.deleted_at is not null then
    return;
  end if;

  v_system_role := public.legacy_profile_to_system_role(v_profile.role, v_profile.is_area_lead);

  if v_system_role in ('admin', 'office') then
    v_scope_type := 'platform';
    v_scope_id := null;
  elsif v_system_role = 'area_lead' and v_profile.zone_id is not null then
    v_scope_type := 'zone';
    v_scope_id := v_profile.zone_id;
  elsif v_profile.restaurant_id is not null then
    v_scope_type := 'restaurant';
    v_scope_id := v_profile.restaurant_id;
  else
    return;
  end if;

  insert into public.role_scope_assignments (
    person_id,
    scope_type,
    scope_id,
    active,
    created_at,
    updated_at
  ) values (
    p_profile_id,
    v_scope_type,
    v_scope_id,
    true,
    now(),
    now()
  )
  on conflict do nothing;
end;
$$;

create or replace function public.sync_legacy_profile_projection()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.sync_legacy_person_projection(new.id);
  perform public.sync_legacy_scope_projection(new.id);
  perform public.sync_legacy_employment_projection(new.id);
  return new;
end;
$$;

create or replace function public.sync_schedule_entry_employment_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.employee_id is null or new.schedule_id is null then
    new.employment_id := null;
    return new;
  end if;

  select er.employment_id
  into new.employment_id
  from public.schedules s
  join public.employment_relationships er
    on er.restaurant_id = s.restaurant_id
   and er.person_id = new.employee_id
   and er.active_principal = true
   and er.is_archived = false
  where s.id = new.schedule_id
  limit 1;

  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_v8_projection on public.profiles;
create trigger trg_profiles_sync_v8_projection
after insert or update on public.profiles
for each row
execute function public.sync_legacy_profile_projection();

drop trigger if exists trg_schedule_entries_sync_employment_id on public.schedule_entries;
create trigger trg_schedule_entries_sync_employment_id
before insert or update on public.schedule_entries
for each row
execute function public.sync_schedule_entry_employment_id();

do $$
declare
  v_profile record;
begin
  for v_profile in select id from public.profiles
  loop
    perform public.sync_legacy_person_projection(v_profile.id);
    perform public.sync_legacy_scope_projection(v_profile.id);
    perform public.sync_legacy_employment_projection(v_profile.id);
  end loop;
end $$;

commit;
