begin;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'zones'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'restaurant_zones'
  ) then
    alter table public.zones rename to restaurant_zones;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'restaurant_zones'
      and column_name = 'zone_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'restaurant_zones'
      and column_name = 'id'
  ) then
    alter table public.restaurant_zones rename column zone_id to id;
  end if;
end $$;

create unique index if not exists idx_restaurant_zones_restaurant_name
  on public.restaurant_zones (restaurant_id, name);

drop trigger if exists trg_zones_updated_at on public.restaurant_zones;
drop trigger if exists trg_restaurant_zones_updated_at on public.restaurant_zones;
create trigger trg_restaurant_zones_updated_at
before update on public.restaurant_zones
for each row
execute function public.set_updated_at();

commit;
