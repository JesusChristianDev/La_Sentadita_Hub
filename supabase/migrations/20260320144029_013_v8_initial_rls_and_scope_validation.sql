begin;

create or replace function public.validate_role_scope_assignment_scope_id()
returns trigger
language plpgsql
as $$
begin
  if new.scope_type = 'platform' then
    if new.scope_id is not null then
      raise exception 'scope_id must be null for scope_type = platform';
    end if;
    return new;
  end if;

  if new.scope_id is null then
    raise exception 'scope_id is required for scope_type = %', new.scope_type;
  end if;

  if new.scope_type = 'chain' then
    if not exists (select 1 from public.chains where chain_id = new.scope_id) then
      raise exception 'scope_id % does not exist in chains', new.scope_id;
    end if;
  elsif new.scope_type = 'company' then
    if not exists (select 1 from public.companies where company_id = new.scope_id) then
      raise exception 'scope_id % does not exist in companies', new.scope_id;
    end if;
  elsif new.scope_type = 'restaurant' then
    if not exists (select 1 from public.restaurants where id = new.scope_id) then
      raise exception 'scope_id % does not exist in restaurants', new.scope_id;
    end if;
  elsif new.scope_type = 'zone' then
    if not exists (select 1 from public.zones where zone_id = new.scope_id) then
      raise exception 'scope_id % does not exist in zones', new.scope_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_role_scope_assignments_scope_fk on public.role_scope_assignments;
create trigger trg_role_scope_assignments_scope_fk
before insert or update on public.role_scope_assignments
for each row
execute function public.validate_role_scope_assignment_scope_id();

alter table if exists public.persons enable row level security;
alter table if exists public.role_scope_assignments enable row level security;
alter table if exists public.employment_relationships enable row level security;
alter table if exists public.task_templates enable row level security;
alter table if exists public.task_instances enable row level security;
alter table if exists public.procedures enable row level security;
alter table if exists public.shift_swap_requests enable row level security;
alter table if exists public.incidents enable row level security;
alter table if exists public.documents enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.audit_logs enable row level security;
alter table if exists public.push_devices enable row level security;
alter table if exists public.suppliers enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.supplier_product_aliases enable row level security;
alter table if exists public.delivery_notes enable row level security;
alter table if exists public.delivery_note_lines enable row level security;

drop policy if exists persons_select_self_or_admin on public.persons;
create policy persons_select_self_or_admin
on public.persons
for select
using (
  person_id = public.current_person_id()
  or public.is_platform_admin()
);

drop policy if exists persons_admin_all on public.persons;
create policy persons_admin_all
on public.persons
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

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

drop policy if exists notifications_admin_all on public.notifications;
create policy notifications_admin_all
on public.notifications
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

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

drop policy if exists documents_select_initial on public.documents;
create policy documents_select_initial
on public.documents
for select
using (
  public.is_platform_admin()
  or (
    visibility = 'employee_visible'
    and (
      (owner_type = 'person' and owner_id = public.current_person_id())
      or (
        owner_type = 'employment_relationship'
        and exists (
          select 1
          from public.employment_relationships er
          where er.employment_id = documents.owner_id
            and er.person_id = public.current_person_id()
            and er.is_archived = false
        )
      )
      or (
        owner_type = 'procedure'
        and exists (
          select 1
          from public.procedures p
          join public.employment_relationships er
            on er.employment_id = p.employment_id
          where p.procedure_id = documents.owner_id
            and er.person_id = public.current_person_id()
            and er.is_archived = false
        )
      )
    )
  )
);

drop policy if exists documents_admin_all on public.documents;
create policy documents_admin_all
on public.documents
for all
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists audit_logs_admin_only on public.audit_logs;
create policy audit_logs_admin_only
on public.audit_logs
for select
using (public.is_platform_admin());

do $$
declare
  t text;
begin
  foreach t in array array[
    'role_scope_assignments',
    'employment_relationships',
    'task_templates',
    'task_instances',
    'procedures',
    'shift_swap_requests',
    'incidents',
    'suppliers',
    'products',
    'supplier_product_aliases',
    'delivery_notes',
    'delivery_note_lines'
  ]
  loop
    execute format('drop policy if exists %I_admin_all on public.%I', t, t);
    execute format(
      'create policy %I_admin_all on public.%I for all using (public.is_platform_admin()) with check (public.is_platform_admin())',
      t,
      t
    );
  end loop;
end $$;

drop policy if exists notification_outbox_select_self on public.notification_outbox;
create policy notification_outbox_select_self
  on public.notification_outbox
  for select
  to authenticated
  using (
    coalesce(recipient_person_id, employee_id) = public.current_person_id()
  );

commit;
