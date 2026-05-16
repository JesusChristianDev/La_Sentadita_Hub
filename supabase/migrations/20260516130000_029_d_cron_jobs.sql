-- D: Cron jobs for overdue tasks, expired requests, and expired shift swaps.
-- Requires pg_cron and pg_net extensions enabled on the project.

-- mark-overdue-tasks: every 15 minutes
SELECT cron.schedule(
  'mark-overdue-tasks',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_functions_url') || '/mark-overdue-tasks',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$
);

-- expire-pending-requests: once a day at 02:00 UTC
SELECT cron.schedule(
  'expire-pending-requests',
  '0 2 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_functions_url') || '/expire-pending-requests',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$
);

-- expire-shift-swaps: once a day at 02:15 UTC
SELECT cron.schedule(
  'expire-shift-swaps',
  '15 2 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_functions_url') || '/expire-shift-swaps',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.cron_secret'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$
);
