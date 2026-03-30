# 14) RLS `profiles` (SELECT/UPDATE) - script SQL

Objetivo:
- `admin` y `office`: ver/editar perfiles operativos.
- `manager` y `sub_manager`: ver perfiles de su restaurante.
- `manager` y `sub_manager`: **NO** pueden editar usuarios con `role='manager'`.
- `employee`: solo puede verse a si mismo (sin permisos de edicion operativa).

## Supuestos
- Tabla: `public.profiles`
- Columnas minimas: `id`, `role`, `restaurant_id`
- `id = auth.uid()`
- Roles: `employee | sub_manager | manager | office | admin`

## SQL (idempotente)

```sql
begin;

-- 1) RLS ON
alter table public.profiles enable row level security;

-- 2) Helpers para evitar recursion de policies sobre profiles
create schema if not exists authz;

create or replace function authz.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role::text
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function authz.current_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.restaurant_id
  from public.profiles p
  where p.id = auth.uid()
$$;

grant usage on schema authz to authenticated;
grant execute on function authz.current_role() to authenticated;
grant execute on function authz.current_restaurant_id() to authenticated;

-- 3) Reemplazar policies objetivo (si existian)
drop policy if exists profiles_select_policy on public.profiles;
drop policy if exists profiles_update_policy on public.profiles;

-- 4) SELECT policy
create policy profiles_select_policy
on public.profiles
for select
to authenticated
using (
  authz.current_role() in ('admin', 'office')
  or (
    authz.current_role() in ('manager', 'sub_manager')
    and authz.current_restaurant_id() = profiles.restaurant_id
  )
  or (
    authz.current_role() = 'employee'
    and profiles.id = auth.uid()
  )
);

-- 5) UPDATE policy
-- Manager/Subgerente:
-- - solo su restaurante
-- - no pueden tocar filas que sean manager
-- - ni convertir filas a manager
create policy profiles_update_policy
on public.profiles
for update
to authenticated
using (
  authz.current_role() in ('admin', 'office')
  or (
    authz.current_role() in ('manager', 'sub_manager')
    and authz.current_restaurant_id() = profiles.restaurant_id
    and profiles.role <> 'manager'
  )
)
with check (
  authz.current_role() in ('admin', 'office')
  or (
    authz.current_role() in ('manager', 'sub_manager')
    and authz.current_restaurant_id() = profiles.restaurant_id
    and profiles.role <> 'manager'
  )
);

commit;
```

## Rollback rapido

```sql
begin;

drop policy if exists profiles_select_policy on public.profiles;
drop policy if exists profiles_update_policy on public.profiles;

drop function if exists authz.current_restaurant_id();
drop function if exists authz.current_role();
drop schema if exists authz;

commit;
```

## Nota de consistencia con app
- En app ya se aplico guard server-side para que solo `admin/office` editen `manager`.
- Este SQL alinea la capa DB con la misma regla.
