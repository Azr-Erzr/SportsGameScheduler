-- Cron schedules (documented as SQL per plan Objective 12).
-- Requires the pg_cron + pg_net extensions; replace <project-ref> and the service key
-- secret before running. Times are UTC.

-- Sync the World Cup demo dataset every 6 hours.
select cron.schedule(
  'sync-worldcup-json',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/provider-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'providerKey', 'worldcup_json',
      'sportKey', 'soccer',
      'from', to_char(now() - interval '1 day', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'to', to_char(now() + interval '60 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );
  $$
);

-- Materialize + send notifications every 5 minutes.
select cron.schedule(
  'notifications-worker',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
