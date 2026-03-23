begin;

create or replace function public.validate_role_scope_assignment_scope_id()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.scope_type = 'platform' then
    if new.scope_id is not null then
      raise exception 'scope_id must be null when scope_type = platform';
    end if;
  elsif new.scope_type = 'chain' then
    if new.scope_id is null or not exists (
      select 1 from public.chains where chain_id = new.scope_id
    ) then
      raise exception 'scope_id % does not exist in chains', new.scope_id;
    end if;
  elsif new.scope_type = 'company' then
    if new.scope_id is null or not exists (
      select 1 from public.companies where company_id = new.scope_id
    ) then
      raise exception 'scope_id % does not exist in companies', new.scope_id;
    end if;
  elsif new.scope_type = 'restaurant' then
    if new.scope_id is null or not exists (
      select 1 from public.restaurants where id = new.scope_id
    ) then
      raise exception 'scope_id % does not exist in restaurants', new.scope_id;
    end if;
  elsif new.scope_type = 'zone' then
    if new.scope_id is null or not exists (
      select 1 from public.zones where zone_id = new.scope_id
    ) then
      raise exception 'scope_id % does not exist in zones', new.scope_id;
    end if;
  else
    raise exception 'unrecognized scope_type: %', new.scope_type;
  end if;

  return new;
end;
$$;

drop policy if exists notification_outbox_select_self on public.notification_outbox;
create policy notification_outbox_select_self
on public.notification_outbox
for select
to authenticated
using (
  coalesce(recipient_person_id, employee_id) = public.current_person_id()
);

commit;
