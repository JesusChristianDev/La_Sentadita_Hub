-- La Sentadita Hub — RLS Policies v1
-- IMPORTANT:
-- These are initial policies. They assume the app sets JWT claims:
-- - person_id
-- - system_role
-- More advanced scope-aware policies should be added after auth/context wiring.

alter table public.persons enable row level security;
alter table public.role_scope_assignments enable row level security;
alter table public.employment_relationships enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_instances enable row level security;
alter table public.procedures enable row level security;
alter table public.shift_swap_requests enable row level security;
alter table public.incidents enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.push_devices enable row level security;

-- ============================================================================
-- PERSONS
-- ============================================================================

drop policy if exists persons_select_self_or_admin on public.persons;
create policy persons_select_self_or_admin
on public.persons
for select
using (
  person_id = public.current_person_id()
  or public.is_platform_admin()
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
using (
  recipient_user_id = public.current_person_id()
  or public.is_platform_admin()
);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications
for update
using (
  recipient_user_id = public.current_person_id()
  or public.is_platform_admin()
)
with check (
  recipient_user_id = public.current_person_id()
  or public.is_platform_admin()
);

-- ============================================================================
-- PUSH DEVICES
-- ============================================================================

drop policy if exists push_devices_manage_own on public.push_devices;
create policy push_devices_manage_own
on public.push_devices
for all
using (
  person_id = public.current_person_id()
  or public.is_platform_admin()
)
with check (
  person_id = public.current_person_id()
  or public.is_platform_admin()
);

-- ============================================================================
-- DOCUMENTS
-- ============================================================================

drop policy if exists documents_select_initial on public.documents;
create policy documents_select_initial
on public.documents
for select
using (
  public.is_platform_admin()
  or
  (
    owner_type = 'person'
    and owner_id = public.current_person_id()
    and visibility = 'employee_visible'
  )
);

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

drop policy if exists audit_logs_admin_only on public.audit_logs;
create policy audit_logs_admin_only
on public.audit_logs
for select
using (public.is_platform_admin());

-- ============================================================================
-- SCHEDULES / ENTRIES
-- Initial conservative rules:
-- - admin can do everything
-- - everyone else should go through service-role backend until final scoped RLS
-- ============================================================================

drop policy if exists schedules_admin_all on public.schedules;
create policy schedules_admin_all
on public.schedules
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists schedule_entries_admin_all on public.schedule_entries;
create policy schedule_entries_admin_all
on public.schedule_entries
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- ============================================================================
-- TASKS / PROCEDURES / INCIDENTS
-- Conservative admin-only direct SQL policy; normal app access should go through
-- backend/service role until scoped RLS is finalized.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'task_templates',
    'task_instances',
    'procedures',
    'shift_swap_requests',
    'incidents',
    'employment_relationships',
    'role_scope_assignments'
  ]
  loop
    execute format('drop policy if exists %I_admin_all on public.%I', t, t);
    execute format(
      'create policy %I_admin_all on public.%I for all using (public.is_platform_admin()) with check (public.is_platform_admin())',
      t, t
    );
  end loop;
end $$;

