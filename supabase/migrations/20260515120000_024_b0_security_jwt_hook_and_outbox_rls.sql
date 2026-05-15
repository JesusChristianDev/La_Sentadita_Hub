-- Migration 024: B0 security fixes
-- 1. Custom access token hook — injects system_role into JWT so all RLS
--    policies using current_system_role() / is_platform_admin() work.
-- 2. Explicit notification_outbox write policies (admin-only, defense-in-depth).
--
-- IMPORTANT: After applying this migration, register the hook in the
-- Supabase dashboard under:
--   Authentication → Hooks → Custom Access Token Hook
--   → Select function: public.custom_access_token_hook

-- ─────────────────────────────────────────────────
-- 1. Custom access token hook
-- ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claims      jsonb;
  v_system_role text;
BEGIN
  SELECT system_role::text
    INTO v_system_role
    FROM public.persons
   WHERE person_id = (event ->> 'user_id')::uuid;

  v_claims := event -> 'claims';

  IF v_system_role IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{system_role}', to_jsonb(v_system_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$;

-- supabase_auth_admin must execute the hook; others must not.
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, PUBLIC;

-- ─────────────────────────────────────────────────
-- 2. notification_outbox — explicit admin-only write policies
--    (service role already bypasses RLS; these prevent any
--    authenticated/anon session from writing directly)
-- ─────────────────────────────────────────────────

CREATE POLICY "notification_outbox_admin_insert"
  ON public.notification_outbox
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "notification_outbox_admin_update"
  ON public.notification_outbox
  FOR UPDATE
  TO authenticated
  USING  (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "notification_outbox_admin_delete"
  ON public.notification_outbox
  FOR DELETE
  TO authenticated
  USING (public.is_platform_admin());
