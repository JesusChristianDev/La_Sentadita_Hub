-- G: Push notification outbox retry tracking.
-- Add attempt counter and timestamps needed by the send-push-notifications worker.

ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS attempts       integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at      timestamptz;

-- Index to efficiently poll: unprocessed entries ready to send
CREATE INDEX IF NOT EXISTS idx_notification_outbox_ready
  ON public.notification_outbox (send_after, attempts)
  WHERE failed_at IS NULL;

-- G: Document RLS — add policies for management_visible, restricted_management,
-- and administrative_only visibility levels so application-layer access control
-- is backed by database enforcement.

-- management_visible: managers and above at the owning restaurant can see
CREATE POLICY IF NOT EXISTS documents_select_management_visible
  ON public.documents
  FOR SELECT
  USING (
    visibility = 'management_visible'::public.document_visibility_enum
    AND (
      -- Platform-wide roles bypass
      public.current_system_role() IN ('admin'::public.system_role_enum, 'owner'::public.system_role_enum, 'office'::public.system_role_enum)
      -- Restaurant managers see management-visible docs for their restaurant
      OR (
        public.current_system_role() = 'manager'::public.system_role_enum
        AND owner_type = 'restaurant'::public.document_owner_type_enum
        AND EXISTS (
          SELECT 1 FROM public.role_scope_assignments rsa
          WHERE rsa.person_id = auth.uid()
            AND rsa.scope_type = 'restaurant'
            AND rsa.scope_id = owner_id
            AND rsa.valid_from <= CURRENT_DATE
            AND (rsa.valid_to IS NULL OR rsa.valid_to >= CURRENT_DATE)
        )
      )
    )
  );

-- restricted_management: only office and above
CREATE POLICY IF NOT EXISTS documents_select_restricted_management
  ON public.documents
  FOR SELECT
  USING (
    visibility = 'restricted_management'::public.document_visibility_enum
    AND public.current_system_role() IN (
      'admin'::public.system_role_enum,
      'owner'::public.system_role_enum,
      'office'::public.system_role_enum
    )
  );

-- administrative_only: only admin and owner
CREATE POLICY IF NOT EXISTS documents_select_administrative_only
  ON public.documents
  FOR SELECT
  USING (
    visibility = 'administrative_only'::public.document_visibility_enum
    AND public.current_system_role() IN (
      'admin'::public.system_role_enum,
      'owner'::public.system_role_enum
    )
  );
