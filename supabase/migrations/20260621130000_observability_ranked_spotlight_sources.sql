-- MP4 observability + reviewed source feed seeds.
-- New public RPCs/tables get explicit grants for post-April-2026 Supabase Data API behavior.

create or replace function public.spotlight_ranked(region text default null, limit_count int default 16)
returns table (
  title text,
  sport_key text,
  label text,
  detail text,
  href text,
  global_importance integer,
  ranking_score integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.title,
    s.sport_key,
    s.label,
    s.detail,
    s.href,
    s.global_importance,
    s.global_importance
      + coalesce(nullif(s.region_importance ->> upper(coalesce(region, '')), '')::integer, 0) as ranking_score
  from public.spotlight_events s
  where s.is_active
  order by
    s.global_importance
      + coalesce(nullif(s.region_importance ->> upper(coalesce(region, '')), '')::integer, 0) desc,
    s.starts_at asc nulls last,
    s.title asc
  limit greatest(1, least(coalesce(limit_count, 16), 32));
$$;

grant execute on function public.spotlight_ranked(text, int) to anon, authenticated;

insert into public.source_providers
  (provider_key, name, source_type, homepage_url, terms_url, notes, is_active)
values
  (
    'nba_team_calendar',
    'NBA team calendar feeds',
    'webcal',
    'https://www.nba.com/schedule',
    'https://www.nba.com/termsofuse',
    'Official NBA/team schedule download pages expose webcal and .ics URLs. Keep dry-run until redistribution/rewrite terms are cleared.',
    true
  ),
  (
    'formula1_calendar',
    'Formula 1 official calendar',
    'webcal',
    'https://calendar.formula1.com/',
    'https://www.formula1.com/en/information/terms-and-conditions',
    'Official F1 sync landing page confirmed; direct feed URL still needs capture/review before adding a source target.',
    true
  )
on conflict (provider_key) do update
set
  name = excluded.name,
  source_type = excluded.source_type,
  homepage_url = excluded.homepage_url,
  terms_url = excluded.terms_url,
  notes = excluded.notes,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.source_targets
  (
    source_provider_id,
    target_key,
    source_type,
    url,
    sport_key,
    expected_name,
    source_confidence,
    is_active,
    dry_run,
    priority,
    cadence_minutes,
    terms_note,
    metadata
  )
select
  p.id,
  x.target_key,
  x.source_type,
  x.url,
  x.sport_key,
  x.expected_name,
  'official',
  true,
  true,
  x.priority,
  1440,
  x.terms_note,
  x.metadata
from public.source_providers p
join (
  values
    (
      'nba_celtics_official_webcal',
      'webcal',
      'webcal://cdn.celtics.com/schedule/ics/2025_celtics_schedule.ics',
      'basketball',
      'Boston Celtics official calendar feed',
      100,
      'Official NBA team page says the schedule updates about every 24 hours; keep dry-run pending redistribution review.',
      '{"league_hint":"NBA","team":"Boston Celtics","review_state":"needs_terms_review","source_page":"https://www.nba.com/celtics/schedule/download"}'::jsonb
    ),
    (
      'nba_bulls_official_ics',
      'ics',
      'https://chibullsdigital.com/schedule/ics/bulls_calendar.ics',
      'basketball',
      'Chicago Bulls official calendar feed',
      110,
      'Official NBA team page exposes both webcal and direct .ics links; keep dry-run pending redistribution review.',
      '{"league_hint":"NBA","team":"Chicago Bulls","review_state":"needs_terms_review","source_page":"https://www.nba.com/bulls/schedule/download"}'::jsonb
    )
) as x(target_key, source_type, url, sport_key, expected_name, priority, terms_note, metadata)
  on p.provider_key = 'nba_team_calendar'
on conflict (target_key) do update
set
  source_type = excluded.source_type,
  url = excluded.url,
  sport_key = excluded.sport_key,
  expected_name = excluded.expected_name,
  source_confidence = excluded.source_confidence,
  is_active = excluded.is_active,
  dry_run = excluded.dry_run,
  priority = excluded.priority,
  cadence_minutes = excluded.cadence_minutes,
  terms_note = excluded.terms_note,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.watch_providers
  (key, name, network, affiliate_status, regions, sports, direct_url, affiliate_url, notes, priority, is_active)
values
  ('mlb_tv', 'MLB.TV', 'direct', 'pending', array['US','CA','GB','AU','JP'], array['baseball'], 'https://www.mlb.com/live-stream-games', null, 'Official MLB streaming destination; blackout rules vary by region.', 16, true),
  ('nba_league_pass', 'NBA League Pass', 'direct', 'pending', array['US','CA','GB','AU','IN'], array['basketball'], 'https://www.nba.com/watch/league-pass-stream', null, 'Official NBA out-of-market streaming product.', 18, true),
  ('formula1_tv', 'F1 TV', 'direct', 'pending', array['US','CA','GB','AU','IN','ZA','ES'], array['motorsport','f1'], 'https://f1tv.formula1.com/', null, 'Official F1 live/replay product; availability varies by market.', 14, true),
  ('apple_tv', 'Apple TV', 'direct', 'pending', array['US','CA','GB','AU'], array['soccer','baseball'], 'https://tv.apple.com/', null, 'MLS Season Pass and select baseball packages by region.', 36, true)
on conflict (key) do update
set
  name = excluded.name,
  network = excluded.network,
  affiliate_status = excluded.affiliate_status,
  regions = excluded.regions,
  sports = excluded.sports,
  direct_url = excluded.direct_url,
  affiliate_url = excluded.affiliate_url,
  notes = excluded.notes,
  priority = excluded.priority,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.watch_links
  (rule_key, provider_key, label, country_codes, sport_keys, link_kind, source_confidence, priority, notes, is_active)
values
  ('baseball_us_mlb_tv', 'mlb_tv', 'MLB.TV', array['US'], array['baseball'], 'official', 'manual', 12, 'Official MLB streaming destination; blackout caveats apply.', true),
  ('baseball_ca_sportsnet', 'sportsnet_plus', 'Sportsnet+', array['CA'], array['baseball'], 'official', 'manual', 10, 'Primary Canada baseball streaming route where rights apply.', true),
  ('baseball_us_apple', 'apple_tv', 'Apple TV', array['US'], array['baseball'], 'official', 'manual', 38, 'Useful for baseball packages where available.', true),
  ('basketball_global_nba_lp', 'nba_league_pass', 'NBA League Pass', array['US','CA','GB','AU','IN'], array['basketball'], 'official', 'manual', 18, 'Official NBA out-of-market route.', true),
  ('motorsport_global_f1_tv', 'formula1_tv', 'F1 TV', array['US','CA','GB','AU','IN','ZA','ES'], array['motorsport','f1'], 'official', 'manual', 12, 'Official F1 live/replay route where available.', true),
  ('hockey_us_espn_plus', 'espn_plus', 'ESPN+', array['US'], array['hockey'], 'official', 'manual', 14, 'US hockey streaming route where ESPN holds rights.', true)
on conflict (rule_key) do update
set
  provider_key = excluded.provider_key,
  label = excluded.label,
  country_codes = excluded.country_codes,
  sport_keys = excluded.sport_keys,
  link_kind = excluded.link_kind,
  source_confidence = excluded.source_confidence,
  priority = excluded.priority,
  notes = excluded.notes,
  is_active = excluded.is_active,
  updated_at = now();

create or replace function public.admin_overview()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'events', (select count(*) from events),
      'upcoming_events', (select count(*) from events where starts_at >= now() and status <> 'finished'),
      'leagues', (select count(*) from leagues),
      'competitors', (select count(*) from competitors),
      'custom_leagues', (select count(*) from custom_leagues),
      'calendar_feeds', (select count(*) from calendar_feeds),
      'user_follows', (select count(*) from user_follows),
      'source_targets', (select count(*) from source_targets),
      'watch_links', (select count(*) from watch_links where is_active)
    ),
    'sports', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object(
          'sport', s.key,
          'leagues', count(distinct l.id),
          'events', count(distinct e.id),
          'upcoming', count(distinct e.id) filter (where e.starts_at >= now() and e.status <> 'finished')
        ) as x
        from sports s
        left join leagues l on l.sport_id = s.id
        left join events e on e.sport_id = s.id
        group by s.key
        order by count(distinct e.id) desc
      ) t
    ),
    'targets', (
      select jsonb_build_object(
        'active', count(*) filter (where is_active),
        'inactive', count(*) filter (where not is_active),
        'errored', count(*) filter (where last_status ilike '%fail%' or last_status = 'error' or last_status ilike '%error%'),
        'stale', count(*) filter (
          where is_active
            and coalesce(next_synced_at, events_synced_at, teams_synced_at, verified_at) < now() - interval '36 hours'
        )
      ) from provider_targets
    ),
    'provider_targets', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object(
          'provider_key', provider_key,
          'active', count(*) filter (where is_active),
          'errored', count(*) filter (where last_status ilike '%fail%' or last_status = 'error' or last_status ilike '%error%'),
          'stale', count(*) filter (
            where is_active
              and coalesce(next_synced_at, events_synced_at, teams_synced_at, verified_at) < now() - interval '36 hours'
          ),
          'last_checked_at', max(coalesce(next_synced_at, events_synced_at, teams_synced_at, verified_at)),
          'last_error', max(last_error) filter (where last_error is not null)
        ) as x
        from provider_targets
        group by provider_key
        order by provider_key
      ) t_provider
    ),
    'source_targets', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where is_active),
        'dry_run', count(*) filter (where dry_run),
        'errored', count(*) filter (where last_status ilike '%fail%' or last_status = 'error' or last_error is not null),
        'recent', coalesce((
          select jsonb_agg(r) from (
            select jsonb_build_object(
              'target_key', target_key,
              'sport_key', sport_key,
              'dry_run', dry_run,
              'last_status', last_status,
              'last_checked_at', last_checked_at,
              'last_error', last_error
            ) as r
            from source_targets
            order by coalesce(last_checked_at, created_at) desc
            limit 8
          ) recent_rows
        ), '[]'::jsonb)
      )
      from source_targets
    ),
    'watch', (
      select jsonb_build_object(
        'providers', (select count(*) from watch_providers where is_active),
        'active_links', (select count(*) from watch_links where is_active),
        'pending_affiliates', (select count(*) from watch_providers where is_active and affiliate_status = 'pending'),
        'approved_affiliates', (select count(*) from watch_providers where is_active and affiliate_status = 'approved')
      )
    ),
    'recent_runs', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select jsonb_build_object(
          'provider_key', provider_key,
          'sport_key', sport_key,
          'status', status,
          'fetched', fetched_count,
          'changed', changed_count,
          'finished_at', finished_at,
          'error', error
        ) as r
        from provider_sync_runs
        order by coalesce(finished_at, started_at) desc
        limit 10
      ) t2
    )
  );
$$;
