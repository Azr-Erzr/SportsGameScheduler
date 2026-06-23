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

-- Calendar-feed ingestion every 6 hours. Only allowlisted rows in source_targets are fetched,
-- and rows default to dry_run=true until a source has been reviewed for rights/quality.
select cron.schedule(
  'ics-feed-ingest',
  '17 */6 * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/ics-feed-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('limit', 5)
  );
  $$
);

-- PandaScore esports hydration every 30 minutes. One upcoming-matches call per game per tick
-- (LoL/Dota2/CS/COD/R6), well under the ~1k req/hour Schedules-plan limit. Requires the
-- PANDASCORE_TOKEN edge-function secret.
select cron.schedule(
  'provider-hydrate-pandascore',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/provider-hydrate-pandascore',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Delete finished events once a day (retention 2 days). Pure SQL — no edge function/HTTP needed.
-- The function is defined in migration 20260622210000_cleanup_past_events.sql. There is no results
-- or archive feature, so past events are storage cost only; TBD placeholder rows (null starts_at)
-- are preserved.
select cron.schedule(
  'cleanup-past-events',
  '30 4 * * *',
  $$ select public.cleanup_past_events(interval '2 days'); $$
);
