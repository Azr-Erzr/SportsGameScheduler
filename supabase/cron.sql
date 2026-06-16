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

-- Paced TheSportsDB hydration every 15 minutes. The function is internally rate-limited and
-- checkpointed: each tick spends a bounded call budget and resumes via provider_targets
-- cursors, so a cold hydrate completes in ~1 tick and steady-state just refreshes deltas.
--
-- LIVE BOOTSTRAP (gcnbgdpicgeahxscpsfc): the deployed schedule authenticates with the public
-- ANON JWT instead of the service-role key below. The anon key already ships in the frontend
-- bundle (so storing it in a cron job leaks nothing) and satisfies the function's verify_jwt.
-- Swap to the service-role pattern below if/when these functions need elevated DB rights.
select cron.schedule(
  'provider-hydrate-thesportsdb',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/provider-hydrate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Materialize + send notifications every 5 minutes.
-- LIVE (gcnbgdpicgeahxscpsfc): deployed as job 'notifications-dispatch' using the anon JWT
-- (same bootstrap pattern as provider-hydrate above).
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
