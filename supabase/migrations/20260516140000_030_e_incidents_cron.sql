-- E: Cron job for stale incident escalation.
-- Requires pg_cron and pg_net extensions.

-- escalate-stale-incidents: every day at 03:00 UTC
SELECT cron.schedule(
  'escalate-stale-incidents',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_functions_url') || '/escalate-stale-incidents',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$
);
