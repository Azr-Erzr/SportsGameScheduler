-- Bridge provider adapters.
--
-- These sources are admitted as low-risk enrichment/dry-run lanes first. They write
-- evidence rows, aliases, and verification results without promoting weak data into
-- canonical public schedules.

insert into public.sports (key, name) values
  ('cricket', 'Cricket')
on conflict (key) do nothing;

create table if not exists public.competitor_aliases (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references public.competitors(id) on delete cascade,
  provider_key text not null,
  provider_competitor_id text,
  alias text not null,
  normalized_alias text not null,
  source_confidence text not null default 'provider'
    check (source_confidence in ('official', 'provider', 'cached', 'manual', 'placeholder')),
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (provider_key, provider_competitor_id, normalized_alias)
);

create index if not exists competitor_aliases_competitor_idx
  on public.competitor_aliases (competitor_id) where competitor_id is not null;

create index if not exists competitor_aliases_lookup_idx
  on public.competitor_aliases (provider_key, normalized_alias);

alter table public.competitor_aliases enable row level security;

insert into public.source_providers
  (provider_key, name, source_type, homepage_url, terms_url, notes, is_active)
values
  (
    'world_athletics_calendar',
    'World Athletics Calendar',
    'api',
    'https://worldathletics.org/competition/calendar-results',
    'https://worldathletics.org/terms-and-conditions',
    'Bridge/dry-run source for athletics meet windows. Writes provider_event_sources only until source terms and event granularity are reviewed.',
    true
  ),
  (
    'tfrrs',
    'TFRRS Results Search',
    'curated',
    'https://www.tfrrs.org/results_search.html',
    'https://www.tfrrs.org/',
    'Bridge/dry-run source for US college track result pages. Stores result-page evidence only; not a future fixture source.',
    true
  ),
  (
    'cricsheet',
    'Cricsheet',
    'api',
    'https://cricsheet.org/',
    'https://cricsheet.org/terms/',
    'Open cricket scorecard data and people-name registers. Used first for player identity and alias reconciliation.',
    true
  ),
  (
    'apisports_mma',
    'API-Sports MMA',
    'api',
    'https://api-sports.io/sports/mma',
    'https://api-sports.io/terms',
    'Keyed MMA feed verifier. Server-side only; first pass records endpoint shape and quota safety before undercard ingestion.',
    true
  )
on conflict (provider_key) do update set
  name = excluded.name,
  source_type = excluded.source_type,
  homepage_url = excluded.homepage_url,
  terms_url = excluded.terms_url,
  notes = excluded.notes,
  is_active = true,
  updated_at = now();

insert into public.provider_targets
  (provider_key, provider_league_id, sport_key, expected_name, current_season, priority, is_active, last_status)
values
  ('world_athletics_calendar', 'global-calendar', 'athletics', 'World Athletics calendar', extract(year from now())::text, 61, true, 'dry_run_source_only'),
  ('tfrrs', 'results-search', 'athletics', 'TFRRS results search', extract(year from now())::text, 62, true, 'dry_run_source_only'),
  ('cricsheet', 'people-register', 'cricket', 'Cricsheet people register', null, 63, true, 'identity_alias_batch'),
  ('apisports_mma', 'mma', 'combat_sports', 'API-Sports MMA verifier', extract(year from now())::text, 29, true, 'verifier_only')
on conflict (provider_key, provider_league_id) do update set
  sport_key = excluded.sport_key,
  expected_name = excluded.expected_name,
  current_season = excluded.current_season,
  priority = excluded.priority,
  is_active = excluded.is_active,
  last_status = excluded.last_status;
