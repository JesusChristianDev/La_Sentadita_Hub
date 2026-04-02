begin;

-- ============================================================
-- 022_canon_v9_structure_procurement_rls
-- Canonical RLS for chains/companies and procurement modules:
-- suppliers, products, supplier aliases, delivery notes.
-- ============================================================

alter table if exists public.chains enable row level security;
alter table if exists public.companies enable row level security;
alter table if exists public.suppliers enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.supplier_product_aliases enable row level security;
alter table if exists public.delivery_notes enable row level security;
alter table if exists public.delivery_note_lines enable row level security;

create or replace function public.current_scope_covers_target(
  p_target_type public.scope_type_enum,
  p_target_id uuid
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
          p_target_type,
          p_target_id
        )
      )
      and public.scope_contains(
        rsa.scope_type,
        rsa.scope_id,
        p_target_type,
        p_target_id
      )
  )
$$;

create or replace function public.current_scope_covers_organization(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_scope_covers_target(
    'organization'::public.scope_type_enum,
    p_organization_id
  )
$$;

create or replace function public.current_scope_covers_chain(
  p_chain_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_scope_covers_target(
    'chain'::public.scope_type_enum,
    p_chain_id
  )
$$;

create or replace function public.current_scope_covers_company(
  p_company_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_scope_covers_target(
    'company'::public.scope_type_enum,
    p_company_id
  )
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
  select public.current_scope_covers_target(
    'restaurant'::public.scope_type_enum,
    p_restaurant_id
  )
$$;

create or replace function public.current_user_can_view_chain(
  p_chain_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin_actor()
    or (
      public.current_system_role()::public.system_role_enum in (
        'owner'::public.system_role_enum,
        'office'::public.system_role_enum
      )
      and public.current_scope_covers_chain(p_chain_id)
    )
$$;

create or replace function public.current_user_can_view_company(
  p_company_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin_actor()
    or (
      public.current_system_role()::public.system_role_enum in (
        'owner'::public.system_role_enum,
        'office'::public.system_role_enum
      )
      and public.current_scope_covers_company(p_company_id)
    )
$$;

create or replace function public.current_user_can_manage_company()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin_actor()
$$;

create or replace function public.current_user_can_manage_chain()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin_actor()
$$;

create or replace function public.current_user_can_operate_delivery_note_restaurant(
  p_restaurant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case public.current_system_role()::public.system_role_enum
    when 'admin'::public.system_role_enum then true
    when 'office'::public.system_role_enum then public.current_scope_covers_restaurant(p_restaurant_id)
    when 'manager'::public.system_role_enum then public.current_scope_covers_restaurant(p_restaurant_id)
    when 'area_lead'::public.system_role_enum then public.current_user_operationally_covers_restaurant(p_restaurant_id)
    when 'employee'::public.system_role_enum then public.current_user_operationally_covers_restaurant(p_restaurant_id)
    else false
  end
$$;

create or replace function public.current_user_can_view_supplier_scope(
  p_scope_type public.supplier_scope_enum,
  p_scope_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when public.is_admin_actor() then true
    when p_scope_type = 'restaurant'::public.supplier_scope_enum then (
      public.current_user_can_view_restaurant(p_scope_id)
      or public.current_user_operationally_covers_restaurant(p_scope_id)
    )
    when p_scope_type = 'organization'::public.supplier_scope_enum then exists (
      select 1
      from public.restaurants r
      join public.companies c
        on c.company_id = r.company_id
      where c.organization_id = p_scope_id
        and (
          public.current_user_can_view_restaurant(r.id)
          or public.current_user_operationally_covers_restaurant(r.id)
        )
    )
    else false
  end
$$;

create or replace function public.current_user_can_manage_supplier_scope(
  p_scope_type public.supplier_scope_enum,
  p_scope_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when public.is_admin_actor() then true
    when public.current_system_role()::public.system_role_enum <> 'office'::public.system_role_enum then false
    when p_scope_type = 'restaurant'::public.supplier_scope_enum then public.current_scope_covers_restaurant(p_scope_id)
    when p_scope_type = 'organization'::public.supplier_scope_enum then public.current_scope_covers_organization(p_scope_id)
    else false
  end
$$;

create or replace function public.current_user_can_view_delivery_note_row(
  p_restaurant_id uuid,
  p_uploaded_by uuid,
  p_reviewed_by_employee uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when public.is_admin_actor() then true
    when public.current_system_role()::public.system_role_enum in (
      'owner'::public.system_role_enum,
      'office'::public.system_role_enum,
      'manager'::public.system_role_enum
    ) then public.current_user_can_view_restaurant(p_restaurant_id)
    when public.current_system_role()::public.system_role_enum in (
      'area_lead'::public.system_role_enum,
      'employee'::public.system_role_enum
    ) then (
      public.current_user_operationally_covers_restaurant(p_restaurant_id)
      and auth.uid() in (p_uploaded_by, coalesce(p_reviewed_by_employee, p_uploaded_by))
    )
    else false
  end
$$;

create or replace function public.current_user_can_insert_delivery_note_row(
  p_restaurant_id uuid,
  p_uploaded_by uuid,
  p_status public.delivery_note_status_enum,
  p_reviewed_by_employee uuid,
  p_employee_reviewed_at timestamptz,
  p_reviewed_by_office uuid,
  p_office_reviewed_at timestamptz,
  p_confirmed_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p_uploaded_by = auth.uid()
    and p_status = 'uploaded'::public.delivery_note_status_enum
    and p_reviewed_by_employee is null
    and p_employee_reviewed_at is null
    and p_reviewed_by_office is null
    and p_office_reviewed_at is null
    and p_confirmed_at is null
    and public.current_user_can_operate_delivery_note_restaurant(p_restaurant_id)
$$;

create or replace function public.current_user_can_confirm_delivery_note_extraction(
  p_delivery_note_id uuid,
  p_restaurant_id uuid,
  p_status public.delivery_note_status_enum,
  p_uploaded_by uuid,
  p_reviewed_by_employee uuid,
  p_employee_reviewed_at timestamptz,
  p_reviewed_by_office uuid,
  p_office_reviewed_at timestamptz,
  p_confirmed_at timestamptz,
  p_rejection_reason text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.delivery_notes dn
    where dn.delivery_note_id = p_delivery_note_id
      and public.current_user_can_operate_delivery_note_restaurant(dn.restaurant_id)
      and dn.restaurant_id = p_restaurant_id
      and dn.uploaded_by = p_uploaded_by
      and dn.reviewed_by_office is null
      and dn.office_reviewed_at is null
      and dn.confirmed_at is null
      and dn.rejection_reason is null
      and dn.status in (
        'uploaded'::public.delivery_note_status_enum,
        'employee_reviewed'::public.delivery_note_status_enum
      )
      and p_status = 'employee_reviewed'::public.delivery_note_status_enum
      and p_reviewed_by_employee = auth.uid()
      and p_employee_reviewed_at is not null
      and p_reviewed_by_office is null
      and p_office_reviewed_at is null
      and p_confirmed_at is null
      and p_rejection_reason is null
  )
$$;

create or replace function public.current_user_can_validate_delivery_note(
  p_delivery_note_id uuid,
  p_restaurant_id uuid,
  p_status public.delivery_note_status_enum,
  p_uploaded_by uuid,
  p_reviewed_by_office uuid,
  p_office_reviewed_at timestamptz,
  p_confirmed_at timestamptz,
  p_rejection_reason text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.delivery_notes dn
    where dn.delivery_note_id = p_delivery_note_id
      and (
        public.is_admin_actor()
        or (
          public.current_system_role()::public.system_role_enum = 'office'::public.system_role_enum
          and public.current_scope_covers_restaurant(dn.restaurant_id)
        )
      )
      and dn.restaurant_id = p_restaurant_id
      and dn.uploaded_by = p_uploaded_by
      and dn.uploaded_by <> auth.uid()
      and dn.status in (
        'employee_reviewed'::public.delivery_note_status_enum,
        'office_reviewing'::public.delivery_note_status_enum
      )
      and p_reviewed_by_office = auth.uid()
      and p_office_reviewed_at is not null
      and (
        (p_status = 'office_reviewing'::public.delivery_note_status_enum and p_confirmed_at is null)
        or (p_status = 'confirmed'::public.delivery_note_status_enum and p_confirmed_at is not null and p_rejection_reason is null)
        or (p_status = 'rejected'::public.delivery_note_status_enum and p_confirmed_at is null and nullif(trim(coalesce(p_rejection_reason, '')), '') is not null)
      )
  )
$$;

create or replace function public.current_user_can_edit_delivery_note_lines(
  p_delivery_note_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.delivery_notes dn
    where dn.delivery_note_id = p_delivery_note_id
      and (
        public.is_admin_actor()
        or (
          public.current_system_role()::public.system_role_enum = 'office'::public.system_role_enum
          and public.current_scope_covers_restaurant(dn.restaurant_id)
          and dn.status in (
            'uploaded'::public.delivery_note_status_enum,
            'employee_reviewed'::public.delivery_note_status_enum,
            'office_reviewing'::public.delivery_note_status_enum
          )
        )
        or (
          public.current_system_role()::public.system_role_enum = 'manager'::public.system_role_enum
          and public.current_scope_covers_restaurant(dn.restaurant_id)
          and dn.status in (
            'uploaded'::public.delivery_note_status_enum,
            'employee_reviewed'::public.delivery_note_status_enum
          )
        )
        or (
          public.current_system_role()::public.system_role_enum in (
            'area_lead'::public.system_role_enum,
            'employee'::public.system_role_enum
          )
          and public.current_user_operationally_covers_restaurant(dn.restaurant_id)
          and dn.status in (
            'uploaded'::public.delivery_note_status_enum,
            'employee_reviewed'::public.delivery_note_status_enum
          )
          and auth.uid() in (dn.uploaded_by, coalesce(dn.reviewed_by_employee, dn.uploaded_by))
        )
      )
  )
$$;

drop policy if exists chains_admin_all on public.chains;
drop policy if exists companies_admin_all on public.companies;

create policy chains_select_canon
on public.chains
for select
to authenticated
using (
  public.current_user_can_view_chain(chain_id)
);

create policy chains_insert_canon
on public.chains
for insert
to public
with check (
  public.current_user_can_manage_chain()
);

create policy chains_update_canon
on public.chains
for update
to public
using (
  public.current_user_can_manage_chain()
)
with check (
  public.current_user_can_manage_chain()
);

create policy chains_delete_canon
on public.chains
for delete
to public
using (
  public.current_user_can_manage_chain()
);

create policy companies_select_canon
on public.companies
for select
to authenticated
using (
  public.current_user_can_view_company(company_id)
);

create policy companies_insert_canon
on public.companies
for insert
to public
with check (
  public.current_user_can_manage_company()
);

create policy companies_update_canon
on public.companies
for update
to public
using (
  public.current_user_can_manage_company()
)
with check (
  public.current_user_can_manage_company()
);

create policy companies_delete_canon
on public.companies
for delete
to public
using (
  public.current_user_can_manage_company()
);

drop policy if exists suppliers_admin_all on public.suppliers;
drop policy if exists products_admin_all on public.products;
drop policy if exists supplier_product_aliases_admin_all on public.supplier_product_aliases;
drop policy if exists delivery_notes_admin_all on public.delivery_notes;
drop policy if exists delivery_note_lines_admin_all on public.delivery_note_lines;

create policy suppliers_select_canon
on public.suppliers
for select
to authenticated
using (
  public.current_user_can_view_supplier_scope(scope_type, scope_id)
);

create policy suppliers_insert_canon
on public.suppliers
for insert
to authenticated
with check (
  public.current_user_can_manage_supplier_scope(scope_type, scope_id)
);

create policy suppliers_update_canon
on public.suppliers
for update
to authenticated
using (
  public.current_user_can_manage_supplier_scope(scope_type, scope_id)
)
with check (
  public.current_user_can_manage_supplier_scope(scope_type, scope_id)
);

create policy suppliers_delete_canon
on public.suppliers
for delete
to authenticated
using (
  public.current_user_can_manage_supplier_scope(scope_type, scope_id)
);

create policy products_select_canon
on public.products
for select
to authenticated
using (
  exists (
    select 1
    from public.suppliers s
    where s.supplier_id = products.supplier_id
      and public.current_user_can_view_supplier_scope(s.scope_type, s.scope_id)
  )
);

create policy products_insert_canon
on public.products
for insert
to authenticated
with check (
  exists (
    select 1
    from public.suppliers s
    where s.supplier_id = products.supplier_id
      and public.current_user_can_manage_supplier_scope(s.scope_type, s.scope_id)
  )
);

create policy products_update_canon
on public.products
for update
to authenticated
using (
  exists (
    select 1
    from public.suppliers s
    where s.supplier_id = products.supplier_id
      and public.current_user_can_manage_supplier_scope(s.scope_type, s.scope_id)
  )
)
with check (
  exists (
    select 1
    from public.suppliers s
    where s.supplier_id = products.supplier_id
      and public.current_user_can_manage_supplier_scope(s.scope_type, s.scope_id)
  )
);

create policy products_delete_canon
on public.products
for delete
to authenticated
using (
  exists (
    select 1
    from public.suppliers s
    where s.supplier_id = products.supplier_id
      and public.current_user_can_manage_supplier_scope(s.scope_type, s.scope_id)
  )
);

create policy supplier_product_aliases_select_canon
on public.supplier_product_aliases
for select
to authenticated
using (
  exists (
    select 1
    from public.suppliers s
    where s.supplier_id = supplier_product_aliases.supplier_id
      and public.current_user_can_view_supplier_scope(s.scope_type, s.scope_id)
  )
);

create policy supplier_product_aliases_insert_canon
on public.supplier_product_aliases
for insert
to authenticated
with check (
  exists (
    select 1
    from public.suppliers s
    where s.supplier_id = supplier_product_aliases.supplier_id
      and public.current_user_can_manage_supplier_scope(s.scope_type, s.scope_id)
  )
);

create policy supplier_product_aliases_update_canon
on public.supplier_product_aliases
for update
to authenticated
using (
  exists (
    select 1
    from public.suppliers s
    where s.supplier_id = supplier_product_aliases.supplier_id
      and public.current_user_can_manage_supplier_scope(s.scope_type, s.scope_id)
  )
)
with check (
  exists (
    select 1
    from public.suppliers s
    where s.supplier_id = supplier_product_aliases.supplier_id
      and public.current_user_can_manage_supplier_scope(s.scope_type, s.scope_id)
  )
);

create policy supplier_product_aliases_delete_canon
on public.supplier_product_aliases
for delete
to authenticated
using (
  exists (
    select 1
    from public.suppliers s
    where s.supplier_id = supplier_product_aliases.supplier_id
      and public.current_user_can_manage_supplier_scope(s.scope_type, s.scope_id)
  )
);

create policy delivery_notes_select_canon
on public.delivery_notes
for select
to authenticated
using (
  public.current_user_can_view_delivery_note_row(
    restaurant_id,
    uploaded_by,
    reviewed_by_employee
  )
);

create policy delivery_notes_insert_canon
on public.delivery_notes
for insert
to authenticated
with check (
  public.current_user_can_insert_delivery_note_row(
    restaurant_id,
    uploaded_by,
    status,
    reviewed_by_employee,
    employee_reviewed_at,
    reviewed_by_office,
    office_reviewed_at,
    confirmed_at
  )
);

create policy delivery_notes_update_confirm_extraction_canon
on public.delivery_notes
for update
to authenticated
using (
  public.current_user_can_view_delivery_note_row(
    restaurant_id,
    uploaded_by,
    reviewed_by_employee
  )
)
with check (
  public.current_user_can_confirm_delivery_note_extraction(
    delivery_note_id,
    restaurant_id,
    status,
    uploaded_by,
    reviewed_by_employee,
    employee_reviewed_at,
    reviewed_by_office,
    office_reviewed_at,
    confirmed_at,
    rejection_reason
  )
);

create policy delivery_notes_update_validate_canon
on public.delivery_notes
for update
to authenticated
using (
  public.current_user_can_view_delivery_note_row(
    restaurant_id,
    uploaded_by,
    reviewed_by_employee
  )
)
with check (
  public.current_user_can_validate_delivery_note(
    delivery_note_id,
    restaurant_id,
    status,
    uploaded_by,
    reviewed_by_office,
    office_reviewed_at,
    confirmed_at,
    rejection_reason
  )
);

create policy delivery_note_lines_select_canon
on public.delivery_note_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.delivery_notes dn
    where dn.delivery_note_id = delivery_note_lines.delivery_note_id
      and public.current_user_can_view_delivery_note_row(
        dn.restaurant_id,
        dn.uploaded_by,
        dn.reviewed_by_employee
      )
  )
);

create policy delivery_note_lines_insert_canon
on public.delivery_note_lines
for insert
to authenticated
with check (
  public.current_user_can_edit_delivery_note_lines(delivery_note_id)
);

create policy delivery_note_lines_update_canon
on public.delivery_note_lines
for update
to authenticated
using (
  public.current_user_can_edit_delivery_note_lines(delivery_note_id)
)
with check (
  public.current_user_can_edit_delivery_note_lines(delivery_note_id)
);

create policy delivery_note_lines_delete_canon
on public.delivery_note_lines
for delete
to authenticated
using (
  public.current_user_can_edit_delivery_note_lines(delivery_note_id)
);

grant execute on function public.current_scope_covers_target(public.scope_type_enum, uuid) to authenticated;
grant execute on function public.current_scope_covers_organization(uuid) to authenticated;
grant execute on function public.current_scope_covers_chain(uuid) to authenticated;
grant execute on function public.current_scope_covers_company(uuid) to authenticated;
grant execute on function public.current_scope_covers_restaurant(uuid) to authenticated;
grant execute on function public.current_user_can_view_chain(uuid) to authenticated;
grant execute on function public.current_user_can_view_company(uuid) to authenticated;
grant execute on function public.current_user_can_manage_company() to authenticated;
grant execute on function public.current_user_can_manage_chain() to authenticated;
grant execute on function public.current_user_can_operate_delivery_note_restaurant(uuid) to authenticated;
grant execute on function public.current_user_can_view_supplier_scope(public.supplier_scope_enum, uuid) to authenticated;
grant execute on function public.current_user_can_manage_supplier_scope(public.supplier_scope_enum, uuid) to authenticated;
grant execute on function public.current_user_can_view_delivery_note_row(uuid, uuid, uuid) to authenticated;
grant execute on function public.current_user_can_insert_delivery_note_row(
  uuid,
  uuid,
  public.delivery_note_status_enum,
  uuid,
  timestamptz,
  uuid,
  timestamptz,
  timestamptz
) to authenticated;
grant execute on function public.current_user_can_confirm_delivery_note_extraction(
  uuid,
  uuid,
  public.delivery_note_status_enum,
  uuid,
  uuid,
  timestamptz,
  uuid,
  timestamptz,
  timestamptz,
  text
) to authenticated;
grant execute on function public.current_user_can_validate_delivery_note(
  uuid,
  uuid,
  public.delivery_note_status_enum,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text
) to authenticated;
grant execute on function public.current_user_can_edit_delivery_note_lines(uuid) to authenticated;

commit;
