-- Core public sports-schedule schema (plan Objective 3, with review corrections).
-- Public-read data only; user-private tables live in later migrations with their own RLS.

create table public.sports (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  default_theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id),
  provider_key text,
  provider_league_id text,
  name text not null,
  short_name text,
  country text,
  logo_url text,
  theme jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  unique (provider_key, provider_league_id)
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id),
  label text not null,
  starts_on date,
  ends_on date,
  provider_season_id text,
  is_current boolean not null default false
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  region text,
  country text,
  timezone text,
  latitude double precision,
  longitude double precision
);

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id),
  league_id uuid references public.leagues(id),
  kind text not null check (kind in ('team', 'person', 'constructor', 'custom_team')),
  name text not null,
  short_name text,
  country text,
  logo_url text,
  theme jsonb not null default '{}'::jsonb,
  provider_key text,
  provider_competitor_id text,
  unique (provider_key, provider_competitor_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id),
  league_id uuid references public.leagues(id),
  season_id uuid references public.seasons(id),
  venue_id uuid references public.venues(id),
  provider_key text,
  provider_event_id text,
  kind text not null,
  status text not null default 'scheduled',
  title text not null,
  short_title text,
  starts_at timestamptz,
  starts_at_tbd boolean not null default false,
  timezone text,
  -- Optional 1v1 convenience only. Source of truth is public.event_competitors.
  home_competitor_id uuid references public.competitors(id),
  away_competitor_id uuid references public.competitors(id),
  -- Gates the public read policy. Custom-league events are 'private'; the FK to
  -- custom_leagues is added in 0004 to avoid a forward reference.
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  custom_league_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_key, provider_event_id)
);

-- N-ary participation: a soccer match has 2 rows, an F1 race ~20, a golf round a field.
create table public.event_competitors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  role text not null check (role in ('home', 'away', 'driver', 'player', 'field', 'participant')),
  position integer,
  unique (event_id, competitor_id)
);

-- Where-to-watch: first-class wedge data, not metadata.
create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  country text not null,
  channel text not null,
  stream_url text,
  kind text not null default 'tv' check (kind in ('tv', 'stream', 'radio')),
  created_at timestamptz not null default now(),
  unique (event_id, country, channel)
);

create table public.event_status_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  old_status text,
  new_status text,
  old_starts_at timestamptz,
  new_starts_at timestamptz,
  changed_at timestamptz not null default now(),
  source text not null
);

create table public.provider_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  sport_key text not null,
  league_id uuid references public.leagues(id),
  status text not null check (status in ('running', 'success', 'failed')),
  fetched_count integer not null default 0,
  changed_count integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Schedule-query indexes.
create index events_starts_at_idx on public.events (starts_at);
create index events_league_starts_idx on public.events (league_id, starts_at);
create index events_home_idx on public.events (home_competitor_id, starts_at);
create index events_away_idx on public.events (away_competitor_id, starts_at);
create index event_competitors_competitor_idx on public.event_competitors (competitor_id);
create index event_competitors_event_idx on public.event_competitors (event_id);
create index broadcasts_event_idx on public.broadcasts (event_id);
create index event_status_history_event_idx on public.event_status_history (event_id, changed_at);

-- RLS: everything exposed, reads gated. Writes happen only via service-role (sync functions),
-- which bypasses RLS, so no insert/update policies are defined here.
alter table public.sports enable row level security;
alter table public.leagues enable row level security;
alter table public.seasons enable row level security;
alter table public.venues enable row level security;
alter table public.competitors enable row level security;
alter table public.events enable row level security;
alter table public.event_competitors enable row level security;
alter table public.broadcasts enable row level security;
alter table public.event_status_history enable row level security;
alter table public.provider_sync_runs enable row level security;

create policy "sports are readable" on public.sports
  for select to anon, authenticated using (true);

create policy "public leagues are readable" on public.leagues
  for select to anon, authenticated using (is_public = true);

create policy "seasons of public leagues are readable" on public.seasons
  for select to anon, authenticated
  using (exists (select 1 from public.leagues l where l.id = seasons.league_id and l.is_public));

create policy "venues are readable" on public.venues
  for select to anon, authenticated using (true);

create policy "competitors are readable" on public.competitors
  for select to anon, authenticated using (kind <> 'custom_team');

-- CRITICAL: gated on visibility, never `using (true)` — private custom-league events share
-- this table. Member read access to private events is granted in 0004.
create policy "public events are readable" on public.events
  for select to anon, authenticated using (visibility = 'public');

create policy "competitors of public events are readable" on public.event_competitors
  for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_competitors.event_id and e.visibility = 'public'));

create policy "broadcasts of public events are readable" on public.broadcasts
  for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = broadcasts.event_id and e.visibility = 'public'));

-- status history and sync runs are internal: no anon/authenticated read policies.
