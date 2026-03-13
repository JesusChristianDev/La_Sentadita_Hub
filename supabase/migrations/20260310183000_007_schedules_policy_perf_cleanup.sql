begin;

-- ============================================================
-- 007_schedules_policy_perf_cleanup
-- Reduces per-row auth re-evaluation in RLS and removes the
-- SELECT + ALL pattern from schedule-related tables.
-- ============================================================

drop policy if exists profiles_select_self_admin_office_or_manager_restaurant
  on public.profiles;
create policy profiles_select_self_admin_office_or_manager_restaurant
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or public.is_admin_or_office()
    or (
      public.is_manager()
      and not (
        restaurant_id is distinct from public.current_user_restaurant_id()
      )
    )
  );

drop policy if exists profiles_update_admin_office
  on public.profiles;
drop policy if exists profiles_update_self
  on public.profiles;
create policy profiles_update_self_or_admin_office
  on public.profiles
  for update
  to authenticated
  using (
    public.is_admin_or_office()
    or id = (select auth.uid())
  )
  with check (
    public.is_admin_or_office()
    or id = (select auth.uid())
  );

drop policy if exists push_subscriptions_all_self
  on public.push_subscriptions;
create policy push_subscriptions_all_self
  on public.push_subscriptions
  for all
  to authenticated
  using (
    employee_id = (select auth.uid())
  )
  with check (
    employee_id = (select auth.uid())
  );

drop policy if exists notification_outbox_select_self
  on public.notification_outbox;
create policy notification_outbox_select_self
  on public.notification_outbox
  for select
  to authenticated
  using (
    employee_id = (select auth.uid())
  );

drop policy if exists restaurant_hours_select_authenticated
  on public.restaurant_hours;
create policy restaurant_hours_select_authenticated
  on public.restaurant_hours
  for select
  to authenticated
  using (
    public.is_admin_or_office()
    or restaurant_id = (select public.current_user_restaurant_id())
  );

drop policy if exists restaurant_hours_write_admin_manager
  on public.restaurant_hours;
create policy restaurant_hours_insert_admin_manager
  on public.restaurant_hours
  for insert
  to authenticated
  with check (
    public.is_admin_or_office()
    or (
      public.is_manager()
      and restaurant_id = public.current_user_restaurant_id()
    )
  );
create policy restaurant_hours_update_admin_manager
  on public.restaurant_hours
  for update
  to authenticated
  using (
    public.is_admin_or_office()
    or (
      public.is_manager()
      and restaurant_id = public.current_user_restaurant_id()
    )
  )
  with check (
    public.is_admin_or_office()
    or (
      public.is_manager()
      and restaurant_id = public.current_user_restaurant_id()
    )
  );
create policy restaurant_hours_delete_admin_manager
  on public.restaurant_hours
  for delete
  to authenticated
  using (
    public.is_admin_or_office()
    or (
      public.is_manager()
      and restaurant_id = public.current_user_restaurant_id()
    )
  );

drop policy if exists schedule_config_select_authenticated
  on public.schedule_config;
create policy schedule_config_select_authenticated
  on public.schedule_config
  for select
  to authenticated
  using (
    public.is_admin_or_office()
    or restaurant_id = (select public.current_user_restaurant_id())
  );

drop policy if exists schedule_config_write_admin_manager
  on public.schedule_config;
create policy schedule_config_insert_admin_manager
  on public.schedule_config
  for insert
  to authenticated
  with check (
    public.is_admin_or_office()
    or (
      public.is_manager()
      and restaurant_id = public.current_user_restaurant_id()
    )
  );
create policy schedule_config_update_admin_manager
  on public.schedule_config
  for update
  to authenticated
  using (
    public.is_admin_or_office()
    or (
      public.is_manager()
      and restaurant_id = public.current_user_restaurant_id()
    )
  )
  with check (
    public.is_admin_or_office()
    or (
      public.is_manager()
      and restaurant_id = public.current_user_restaurant_id()
    )
  );
create policy schedule_config_delete_admin_manager
  on public.schedule_config
  for delete
  to authenticated
  using (
    public.is_admin_or_office()
    or (
      public.is_manager()
      and restaurant_id = public.current_user_restaurant_id()
    )
  );

drop policy if exists restaurant_zones_write_admin_manager
  on public.restaurant_zones;
create policy restaurant_zones_insert_admin_manager
  on public.restaurant_zones
  for insert
  to authenticated
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );
create policy restaurant_zones_update_admin_manager
  on public.restaurant_zones
  for update
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  )
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );
create policy restaurant_zones_delete_admin_manager
  on public.restaurant_zones
  for delete
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

drop policy if exists schedules_write_admin_manager
  on public.schedules;
create policy schedules_insert_admin_manager
  on public.schedules
  for insert
  to authenticated
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );
create policy schedules_update_admin_manager
  on public.schedules
  for update
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  )
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );
create policy schedules_delete_admin_manager
  on public.schedules
  for delete
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

drop policy if exists shift_templates_write_admin_manager
  on public.shift_templates;
create policy shift_templates_insert_admin_manager
  on public.shift_templates
  for insert
  to authenticated
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );
create policy shift_templates_update_admin_manager
  on public.shift_templates
  for update
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  )
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );
create policy shift_templates_delete_admin_manager
  on public.shift_templates
  for delete
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

drop policy if exists schedule_entries_select_authenticated
  on public.schedule_entries;
create policy schedule_entries_select_authenticated
  on public.schedule_entries
  for select
  to authenticated
  using (
    public.is_schedule_editor_for_employee(schedule_id, employee_id)
    or (
      employee_id = (select auth.uid())
      and exists (
        select 1
        from public.schedules s
        where s.id = schedule_entries.schedule_id
          and s.status = 'published'
          and s.restaurant_id = (select public.current_user_restaurant_id())
      )
    )
  );

drop policy if exists schedule_entries_write_staff
  on public.schedule_entries;
create policy schedule_entries_insert_staff
  on public.schedule_entries
  for insert
  to authenticated
  with check (
    public.is_schedule_editor_for_employee(schedule_id, employee_id)
  );
create policy schedule_entries_update_staff
  on public.schedule_entries
  for update
  to authenticated
  using (
    public.is_schedule_editor_for_employee(schedule_id, employee_id)
  )
  with check (
    public.is_schedule_editor_for_employee(schedule_id, employee_id)
  );
create policy schedule_entries_delete_staff
  on public.schedule_entries
  for delete
  to authenticated
  using (
    public.is_schedule_editor_for_employee(schedule_id, employee_id)
  );

drop policy if exists area_leads_select_staff
  on public.area_leads;
create policy area_leads_select_staff
  on public.area_leads
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

drop policy if exists area_leads_write_admin_manager
  on public.area_leads;
create policy area_leads_insert_admin_manager
  on public.area_leads
  for insert
  to authenticated
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );
create policy area_leads_update_admin_manager
  on public.area_leads
  for update
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  )
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );
create policy area_leads_delete_admin_manager
  on public.area_leads
  for delete
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

drop policy if exists employee_restaurant_assignments_select_staff
  on public.employee_restaurant_assignments;
create policy employee_restaurant_assignments_select_staff
  on public.employee_restaurant_assignments
  for select
  to authenticated
  using (
    employee_id = (select auth.uid())
    or public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

drop policy if exists employee_restaurant_assignments_write_admin_manager
  on public.employee_restaurant_assignments;
create policy employee_restaurant_assignments_insert_admin_manager
  on public.employee_restaurant_assignments
  for insert
  to authenticated
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );
create policy employee_restaurant_assignments_update_admin_manager
  on public.employee_restaurant_assignments
  for update
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  )
  with check (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );
create policy employee_restaurant_assignments_delete_admin_manager
  on public.employee_restaurant_assignments
  for delete
  to authenticated
  using (
    public.is_schedule_manager_or_office_for_restaurant(restaurant_id)
  );

commit;
