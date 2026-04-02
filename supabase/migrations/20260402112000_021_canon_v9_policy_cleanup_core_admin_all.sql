begin;

-- ============================================================
-- 021_canon_v9_policy_cleanup_core_admin_all
-- Removes remaining legacy admin_all policies from core tables
-- once equivalent explicit policies exist.
-- ============================================================

create policy organizations_admin_select
on public.organizations
for select
to public
using (
  public.is_admin_actor()
);

drop policy if exists organizations_admin_all on public.organizations;

drop policy if exists employment_relationships_admin_all on public.employment_relationships;

create policy employment_restaurant_assignments_admin_insert
on public.employment_restaurant_assignments
for insert
to public
with check (
  public.is_admin_actor()
);

create policy employment_restaurant_assignments_admin_update
on public.employment_restaurant_assignments
for update
to public
using (
  public.is_admin_actor()
)
with check (
  public.is_admin_actor()
);

create policy employment_restaurant_assignments_admin_delete
on public.employment_restaurant_assignments
for delete
to public
using (
  public.is_admin_actor()
);

drop policy if exists employment_restaurant_assignments_admin_all on public.employment_restaurant_assignments;

create policy employment_zone_assignments_admin_insert
on public.employment_zone_assignments
for insert
to public
with check (
  public.is_admin_actor()
);

create policy employment_zone_assignments_admin_update
on public.employment_zone_assignments
for update
to public
using (
  public.is_admin_actor()
)
with check (
  public.is_admin_actor()
);

create policy employment_zone_assignments_admin_delete
on public.employment_zone_assignments
for delete
to public
using (
  public.is_admin_actor()
);

drop policy if exists employment_zone_assignments_admin_all on public.employment_zone_assignments;

commit;
