-- Cron schedules (documented as SQL per plan Objective 12).
-- Requires the pg_cron + pg_net extensions; replace <project-ref> and the service key
-- secret before running. Times are UTC.

-- RETIRED: the worldcup_json demo/fallback sync. The openfootball dataset it ingested carries
-- knockout fixtures as slot-code placeholders ("1E vs 3A/B/C/D/F") that never resolve to real
-- teams, which duplicated the live TheSportsDB "FIFA World Cup" league (resolved teams) and caused
-- scrambled-looking schedule-alert emails. TheSportsDB is now the single World Cup source; the
-- skeleton league was hidden (is_public=false) and its events deleted in prod. Do not re-add this
-- job. (The adapter still exists at provider-sync/providers/worldcup-json.ts for local demos only.)

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

-- PandaScore esports hydration hourly (at :21, offset from the other hydrators). One
-- upcoming-matches call per game per tick (LoL/Dota2/CS/COD/R6), well under the ~1k req/hour
-- Schedules-plan limit. Esports schedules rarely move intra-hour, so hourly keeps freshness while
-- halving the DB write footprint. Requires the PANDASCORE_TOKEN edge-function secret.
select cron.schedule(
  'provider-hydrate-pandascore',
  '21 * * * *',
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

-- OpenF1 Formula 1 schedule/session hydration once daily. This is the current-season F1
-- second-source lane because API-Sports Formula-1 free access is limited to older seasons on
-- the current account. Live production job: 'provider-hydrate-openf1' at 07:42 UTC.
select cron.schedule(
  'provider-hydrate-openf1',
  '42 7 * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/provider-hydrate-openf1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('year', extract(year from now())::int),
    timeout_milliseconds := 150000
  );
  $$
);
