-- Provider hydration foundation (TheSportsDB).
-- 1. Reconcile the sport taxonomy to canonical families (leagues were stored AS sports).
-- 2. Add provider_targets: the curated league allowlist + per-league paced-sync checkpoints.
-- 3. Give venues a stable upsert key so hydration can dedupe by name.

-- 1. Taxonomy reconciliation. Only 'soccer' has dependent leagues/events today (WC2026),
--    so re-keying the unused league-shaped rows to real sport families is safe.
update public.sports set key = 'motorsport', name = 'Motorsport' where key = 'f1';
update public.sports set key = 'hockey', name = 'Hockey' where key = 'nhl';
update public.sports set key = 'basketball', name = 'Basketball' where key = 'nba';

insert into public.sports (key, name) values
  ('american_football', 'American Football'),
  ('combat_sports', 'Combat Sports'),
  ('athletics', 'Track & Field'),
  ('olympic_sports', 'Olympic Sports')
on conflict (key) do nothing;

-- 2. Hydration allowlist + checkpoints. Service-role only (no anon/auth read policies).
create table public.provider_targets (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null default 'thesportsdb',
  provider_league_id text not null,
  sport_key text not null references public.sports(key),
  expected_name text not null,
  current_season text,
  priority integer not null default 100,
  is_active boolean not null default true,
  -- paced-sync cursors: each cron tick advances the stalest step within budget
  verified_at timestamptz,
  teams_synced_at timestamptz,
  events_synced_at timestamptz,
  next_synced_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz not null default now(),
  unique (provider_key, provider_league_id)
);

alter table public.provider_targets enable row level security;

-- 3. Venues dedupe key for upserts during hydration.
create unique index if not exists venues_name_key on public.venues (name);

-- Seed the broad 15-league allowlist. IDs are best-known TheSportsDB league IDs; the
-- hydrator verifies each via lookupleague.php (sport must match) before writing any data,
-- so a wrong ID logs last_error instead of polluting tables. Lower priority = sync sooner.
insert into public.provider_targets (provider_league_id, sport_key, expected_name, current_season, priority) values
  ('4328', 'soccer', 'English Premier League', '2025-2026', 10),
  ('4480', 'soccer', 'UEFA Champions League', '2025-2026', 15),
  ('4335', 'soccer', 'Spanish La Liga', '2025-2026', 20),
  ('4370', 'motorsport', 'Formula 1', '2026', 22),
  ('4387', 'basketball', 'NBA', '2025-2026', 25),
  ('4443', 'combat_sports', 'UFC', '2026', 28),
  ('4331', 'soccer', 'German Bundesliga', '2025-2026', 30),
  ('4380', 'hockey', 'NHL', '2025-2026', 35),
  ('4332', 'soccer', 'Italian Serie A', '2025-2026', 40),
  ('4391', 'american_football', 'NFL', '2025-2026', 45),
  ('4334', 'soccer', 'French Ligue 1', '2025-2026', 50),
  ('4516', 'basketball', 'WNBA', '2026', 55),
  ('4346', 'soccer', 'American Major League Soccer', '2026', 60),
  ('4350', 'soccer', 'Mexican Primera League', '2025-2026', 70),
  ('4405', 'american_football', 'CFL', '2026', 80)
on conflict (provider_key, provider_league_id) do nothing;
