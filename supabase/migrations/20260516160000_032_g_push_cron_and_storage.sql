-- G: Push notification cron + documents storage bucket.

-- send-push-notifications: every minute
SELECT cron.schedule(
  'send-push-notifications',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_functions_url') || '/send-push-notifications',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$
);

-- Create documents storage bucket (private, server-signed URLs only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  20971520, -- 20 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS for documents bucket: only service_role can read/write (uploads go through API route)
CREATE POLICY IF NOT EXISTS "documents_bucket_service_role_only"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');
