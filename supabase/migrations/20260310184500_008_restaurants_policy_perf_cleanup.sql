begin;

-- ============================================================
-- 008_restaurants_policy_perf_cleanup
-- Removes the SELECT + ALL pattern from restaurants.
-- ============================================================

drop policy if exists restaurants_write_admin_office
  on public.restaurants;

create policy restaurants_insert_admin_office
  on public.restaurants
  for insert
  to authenticated
  with check (
    public.is_admin_or_office()
  );

create policy restaurants_update_admin_office
  on public.restaurants
  for update
  to authenticated
  using (
    public.is_admin_or_office()
  )
  with check (
    public.is_admin_or_office()
  );

create policy restaurants_delete_admin_office
  on public.restaurants
  for delete
  to authenticated
  using (
    public.is_admin_or_office()
  );

commit;
