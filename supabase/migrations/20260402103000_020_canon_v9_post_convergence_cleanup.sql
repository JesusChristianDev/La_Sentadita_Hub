begin;

-- ============================================================
-- 020_canon_v9_post_convergence_cleanup
-- Low-risk cleanup after live convergence:
-- - remove legacy/redundant permissive policies
-- - consolidate update policies with equivalent semantics
-- - add missing FK indexes
-- - drop duplicate indexes flagged by advisors
-- ============================================================

drop policy if exists zones_admin_all on public.restaurant_zones;
drop policy if exists persons_admin_all on public.persons;

create policy role_scope_assignments_admin_insert
on public.role_scope_assignments
for insert
to public
with check (
  public.is_admin_actor()
);

create policy role_scope_assignments_admin_update
on public.role_scope_assignments
for update
to public
using (
  public.is_admin_actor()
)
with check (
  public.is_admin_actor()
);

create policy role_scope_assignments_admin_delete
on public.role_scope_assignments
for delete
to public
using (
  public.is_admin_actor()
);

drop policy if exists role_scope_assignments_admin_all on public.role_scope_assignments;

drop policy if exists requests_update_review_canon on public.requests;
drop policy if exists requests_update_cancel_own_canon on public.requests;

create policy requests_update_canon
on public.requests
for update
to authenticated
using (
  public.current_user_can_view_request(request_id)
)
with check (
  public.current_user_can_review_request(
    request_id,
    employment_id,
    request_type,
    requested_by,
    reviewed_by,
    status,
    effective_start_date,
    effective_end_date
  )
  or public.current_user_can_cancel_request(
    request_id,
    employment_id,
    request_type,
    requested_by,
    reviewed_by,
    status,
    effective_start_date,
    effective_end_date
  )
);

drop policy if exists task_instances_update_management_canon on public.task_instances;
drop policy if exists task_instances_update_complete_canon on public.task_instances;

create policy task_instances_update_canon
on public.task_instances
for update
to authenticated
using (
  public.current_user_can_manage_task_restaurant(restaurant_id)
  or public.current_user_can_complete_task_instance_row(
    restaurant_id,
    assigned_zone_id,
    assigned_role,
    assigned_employee_id
  )
)
with check (
  public.current_user_can_manage_task_restaurant(restaurant_id)
  or public.current_user_can_complete_task_instance_update(
    task_instance_id,
    task_template_id,
    restaurant_id,
    task_date,
    shift_context,
    assigned_role,
    assigned_zone_id,
    assigned_employee_id,
    task_status,
    cancel_reason,
    reassignment_reason,
    due_at,
    completed_by,
    completed_at,
    requires_confirmation,
    confirmed_by,
    confirmed_at,
    confirmation_note,
    confirmation_photo_url
  )
);

create or replace function public.current_user_can_update_shift_swap_row(
  p_requester_schedule_entry_id uuid,
  p_target_employee_id uuid,
  p_status public.shift_swap_status_enum
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_admin_actor()
    or (
      public.current_system_role()::public.system_role_enum = 'employee'::public.system_role_enum
      and p_target_employee_id = auth.uid()
      and p_status = 'pending_peer'::public.shift_swap_status_enum
    )
    or (
      public.current_system_role()::public.system_role_enum = 'manager'::public.system_role_enum
      and p_status = 'pending_manager'::public.shift_swap_status_enum
      and exists (
        select 1
        from public.schedule_entries se
        join public.schedules s
          on s.id = se.schedule_id
        where se.id = p_requester_schedule_entry_id
          and public.current_scope_covers_restaurant(s.restaurant_id)
      )
    )
$$;

drop policy if exists shift_swap_requests_update_peer_canon on public.shift_swap_requests;
drop policy if exists shift_swap_requests_update_manager_canon on public.shift_swap_requests;

create policy shift_swap_requests_update_canon
on public.shift_swap_requests
for update
to authenticated
using (
  public.current_user_can_update_shift_swap_row(
    requester_schedule_entry_id,
    target_employee_id,
    status
  )
)
with check (
  public.current_user_can_peer_update_shift_swap(
    shift_swap_request_id,
    requester_employee_id,
    target_employee_id,
    requester_schedule_entry_id,
    target_schedule_entry_id,
    status,
    requested_at,
    peer_responded_at,
    reviewed_by,
    reviewed_at,
    reason
  )
  or public.current_user_can_manager_review_shift_swap(
    shift_swap_request_id,
    requester_employee_id,
    target_employee_id,
    requester_schedule_entry_id,
    target_schedule_entry_id,
    status,
    requested_at,
    peer_responded_at,
    reviewed_by,
    reviewed_at,
    reason
  )
);

grant execute on function public.current_user_can_update_shift_swap_row(
  uuid,
  uuid,
  public.shift_swap_status_enum
) to authenticated;

create index if not exists idx_delivery_notes_document_id
  on public.delivery_notes(document_id);
create index if not exists idx_delivery_notes_reviewed_by_employee
  on public.delivery_notes(reviewed_by_employee);
create index if not exists idx_delivery_notes_reviewed_by_office
  on public.delivery_notes(reviewed_by_office);
create index if not exists idx_delivery_notes_uploaded_by
  on public.delivery_notes(uploaded_by);

create index if not exists idx_documents_created_by
  on public.documents(created_by);

create index if not exists idx_employment_restaurant_assignments_created_by
  on public.employment_restaurant_assignments(created_by);
create index if not exists idx_employment_zone_assignments_created_by
  on public.employment_zone_assignments(created_by);

create index if not exists idx_incidents_zone_id
  on public.incidents(zone_id);
create index if not exists idx_incidents_reported_by
  on public.incidents(reported_by);
create index if not exists idx_incidents_primary_owner
  on public.incidents(primary_owner);

create index if not exists idx_notification_outbox_recipient_person_id
  on public.notification_outbox(recipient_person_id);
create index if not exists idx_notification_outbox_restaurant_id
  on public.notification_outbox(restaurant_id);

create index if not exists idx_notifications_restaurant_id
  on public.notifications(restaurant_id);

create index if not exists idx_push_devices_person_id
  on public.push_devices(person_id);

create index if not exists idx_requests_requested_by
  on public.requests(requested_by);
create index if not exists idx_requests_reviewed_by
  on public.requests(reviewed_by);

create index if not exists idx_shift_swap_requests_requester_schedule_entry_id
  on public.shift_swap_requests(requester_schedule_entry_id);
create index if not exists idx_shift_swap_requests_target_schedule_entry_id
  on public.shift_swap_requests(target_schedule_entry_id);
create index if not exists idx_shift_swap_requests_reviewed_by
  on public.shift_swap_requests(reviewed_by);

create index if not exists idx_supplier_product_aliases_product_id
  on public.supplier_product_aliases(product_id);

create index if not exists idx_task_instances_assigned_zone_id
  on public.task_instances(assigned_zone_id);
create index if not exists idx_task_instances_task_template_id
  on public.task_instances(task_template_id);
create index if not exists idx_task_instances_completed_by
  on public.task_instances(completed_by);
create index if not exists idx_task_instances_confirmed_by
  on public.task_instances(confirmed_by);

create index if not exists idx_task_templates_restaurant_id
  on public.task_templates(restaurant_id);
create index if not exists idx_task_templates_confirmation_employee_id
  on public.task_templates(confirmation_employee_id);

create index if not exists idx_time_records_schedule_entry_id
  on public.time_records(schedule_entry_id);
create index if not exists idx_time_records_validated_by
  on public.time_records(validated_by);

alter table if exists public.restaurant_hours
  drop constraint if exists restaurant_hours_unique_day;
drop index if exists public.idx_restaurant_zones_restaurant_name;

commit;
