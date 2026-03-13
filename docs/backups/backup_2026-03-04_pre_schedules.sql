-- ================================================================
-- BACKUP: La Sentadita HUB — Pre-Schedule Module
-- Date: 2026-03-04T10:29+01:00
-- Project: kswuejdlfimajdkncgkw
-- ================================================================

-- ========================
-- ENUMS
-- ========================
CREATE TYPE public.app_role AS ENUM ('employee', 'manager', 'office', 'admin', 'sub_manager');
CREATE TYPE public.work_area AS ENUM ('barra', 'sala', 'cocina');

-- ========================
-- TABLES
-- ========================

-- restaurants
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  employee_code bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  full_name text NOT NULL DEFAULT '',
  role app_role NOT NULL DEFAULT 'employee',
  restaurant_id uuid REFERENCES public.restaurants(id),
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  avatar_path text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- area_leads
CREATE TABLE public.area_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  zone text NOT NULL CHECK (zone = ANY (ARRAY['kitchen', 'floor', 'bar'])),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  lead_slot smallint NOT NULL CHECK (lead_slot = ANY (ARRAY[1, 2])),
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles(id),
  revoked_at timestamptz
);

-- ========================
-- FUNCTIONS
-- ========================

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_office() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','office')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS app_role LANGUAGE sql SECURITY DEFINER AS $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_restaurant_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  select p.restaurant_id
  from public.profiles p
  where p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_manager() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  select public.current_user_role() = 'manager'
$$;

-- ========================
-- TRIGGERS
-- ========================

CREATE TRIGGER trg_profiles_touch
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- handle_new_user trigger is on auth.users (not public schema)

-- ========================
-- RLS POLICIES
-- ========================

-- restaurants
CREATE POLICY restaurants_select_authenticated ON public.restaurants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY restaurants_write_admin_office ON public.restaurants
  FOR ALL TO authenticated
  USING (is_admin_or_office())
  WITH CHECK (is_admin_or_office());

-- profiles
CREATE POLICY profiles_select_self_admin_office_or_manager_restaurant ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (id = auth.uid())
    OR is_admin_or_office()
    OR (is_manager() AND (NOT (restaurant_id IS DISTINCT FROM current_user_restaurant_id())))
  );

CREATE POLICY profiles_update_admin_office ON public.profiles
  FOR UPDATE TO authenticated
  USING (is_admin_or_office())
  WITH CHECK (is_admin_or_office());

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ========================
-- DATA
-- ========================

-- restaurants (2 rows)
INSERT INTO public.restaurants (id, name, is_active, created_at) VALUES
  ('9ea0de86-2cba-4b79-ad1d-5ea5689fbd42', 'Tango Arenal —  DEMO', true, '2026-02-05 12:10:04.924391+00'),
  ('a81e6558-7ee5-4fbb-a5af-3ab948871e04', 'EL Chiringuito — DEMO', true, '2026-02-05 10:55:24.012871+00');

-- profiles (5 rows) — NOTE: profiles are created via auth.users trigger,
-- these INSERTs are for reference only
-- id | employee_code | full_name | role | restaurant_id
-- 48ba2704... | 1 | BOSS           | admin       | NULL
-- e7b54de2... | 3 | Jesus Christian | employee    | a81e6558...
-- 640e6d38... | 8 | Paula           | manager     | a81e6558...
-- f555fab7... | 9 | Nico Larese     | sub_manager | a81e6558...
-- cb4d070f... | 11| YANI            | employee    | a81e6558...

-- area_leads (2 rows)
INSERT INTO public.area_leads (id, restaurant_id, zone, user_id, lead_slot, is_active, assigned_at, assigned_by) VALUES
  ('1bf85101-7714-4150-9d64-468a6be965ab', 'a81e6558-7ee5-4fbb-a5af-3ab948871e04', 'floor', 'cb4d070f-58d6-41cd-8646-e19c9807d401', 1, true, '2026-02-28 00:22:00.615429+00', '48ba2704-0f5f-4fc8-b74a-1db6ad70222e'),
  ('6cde115f-21ae-45ea-a645-96bc796a43fa', 'a81e6558-7ee5-4fbb-a5af-3ab948871e04', 'floor', 'e7b54de2-11ba-46f0-856e-0df2d36e8184', 2, true, '2026-03-02 09:07:32.096164+00', '48ba2704-0f5f-4fc8-b74a-1db6ad70222e');
