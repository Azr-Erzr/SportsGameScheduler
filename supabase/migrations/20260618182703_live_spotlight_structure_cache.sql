-- Live-compatible structure + cache + spotlight layer.
-- This intentionally avoids the older event_change_log/certainty rewrite. Production currently
-- uses event_status_history for notification materialization, so this migration stays additive.

-- Provider cache maturity: distinguish "checked" from "changed", and avoid churn once the
-- hydrator starts short-circuiting unchanged payloads.
alter table public.events
  add column if not exists payload_hash text,
  add column if not exists last_checked_at timestamptz,
  add column if not exists source_confidence text not null default 'provider';

alter table public.events
  drop constraint if exists events_source_confidence_check,
  add constraint events_source_confidence_check
    check (source_confidence in ('official', 'provider', 'cached', 'manual', 'placeholder'));

create index if not exists events_last_checked_idx on public.events (last_checked_at);
create index if not exists events_source_confidence_idx on public.events (source_confidence);

update public.events
set
  source_confidence = case
    when provider_key = 'curated' then 'manual'
    when provider_key is null then 'placeholder'
    else 'provider'
  end,
  last_checked_at = coalesce(last_checked_at, updated_at, created_at),
  payload_hash = coalesce(
    payload_hash,
    md5(concat_ws('|', provider_key, provider_event_id, title, status, starts_at::text, starts_at_tbd::text, version::text))
  );

-- Generic ordered child groups for cards, sessions, and structured exports.
create table if not exists public.event_segments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  segment_key text not null,
  title text not null,
  position integer not null default 0,
  starts_at timestamptz,
  status text not null default 'scheduled',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, segment_key)
);

create index if not exists event_segments_event_position_idx
  on public.event_segments (event_id, position);

alter table public.event_segments enable row level security;

drop policy if exists "segments of public events are readable" on public.event_segments;
create policy "segments of public events are readable" on public.event_segments
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_segments.event_id and e.visibility = 'public'
    )
  );

create table if not exists public.event_bouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  segment_id uuid references public.event_segments(id) on delete set null,
  weight_class text,
  red_corner_competitor_id uuid references public.competitors(id) on delete set null,
  blue_corner_competitor_id uuid references public.competitors(id) on delete set null,
  bout_order integer,
  scheduled_rounds integer,
  est_start_window tstzrange,
  status text not null default 'scheduled',
  result jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_bouts_event_order_idx
  on public.event_bouts (event_id, bout_order);
create index if not exists event_bouts_segment_order_idx
  on public.event_bouts (segment_id, bout_order);

alter table public.event_bouts enable row level security;

drop policy if exists "bouts of public events are readable" on public.event_bouts;
create policy "bouts of public events are readable" on public.event_bouts
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_bouts.event_id and e.visibility = 'public'
    )
  );

create table if not exists public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  parent_event_id uuid not null references public.events(id) on delete cascade,
  child_event_id uuid references public.events(id) on delete set null,
  session_key text not null,
  title text not null,
  session_type text not null,
  position integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'scheduled',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_event_id, session_key)
);

create index if not exists event_sessions_parent_position_idx
  on public.event_sessions (parent_event_id, position);
create index if not exists event_sessions_starts_idx
  on public.event_sessions (starts_at);

alter table public.event_sessions enable row level security;

drop policy if exists "sessions of public events are readable" on public.event_sessions;
create policy "sessions of public events are readable" on public.event_sessions
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_sessions.parent_event_id and e.visibility = 'public'
    )
  );

create table if not exists public.bracket_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  stage text not null,
  slot_key text not null,
  position integer not null default 0,
  source_event_id uuid references public.events(id) on delete set null,
  source_rule text,
  resolved_competitor_id uuid references public.competitors(id) on delete set null,
  label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, slot_key)
);

create index if not exists bracket_slots_event_position_idx
  on public.bracket_slots (event_id, position);

alter table public.bracket_slots enable row level security;

drop policy if exists "bracket slots of public events are readable" on public.bracket_slots;
create policy "bracket slots of public events are readable" on public.bracket_slots
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = bracket_slots.event_id and e.visibility = 'public'
    )
  );

-- DB-backed homepage/world-board cards. These are intentionally independent from events so
-- source-testing and launch/editorial cards can coexist with true event cards.
create table if not exists public.spotlight_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  sport_key text not null,
  label text not null,
  detail text not null,
  href text not null,
  event_id uuid references public.events(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  global_importance integer not null default 50 check (global_importance between 0 and 100),
  region_importance jsonb not null default '{}'::jsonb,
  lifecycle text not null default 'scheduled'
    check (lifecycle in ('draft', 'scheduled', 'live', 'completed', 'expired', 'source_testing', 'model_ready')),
  art_key text,
  source_confidence text not null default 'manual'
    check (source_confidence in ('official', 'provider', 'cached', 'manual', 'placeholder')),
  is_active boolean not null default true,
  editorial_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title, href)
);

create index if not exists spotlight_events_active_rank_idx
  on public.spotlight_events (is_active, global_importance desc, starts_at);
create index if not exists spotlight_events_sport_idx
  on public.spotlight_events (sport_key);

alter table public.spotlight_events enable row level security;

drop policy if exists "active spotlight events are readable" on public.spotlight_events;
create policy "active spotlight events are readable" on public.spotlight_events
  for select to anon, authenticated
  using (is_active = true);

grant select on public.event_segments to anon, authenticated;
grant select on public.event_bouts to anon, authenticated;
grant select on public.event_sessions to anon, authenticated;
grant select on public.bracket_slots to anon, authenticated;
grant select on public.spotlight_events to anon, authenticated;

insert into public.spotlight_events
  (title, sport_key, label, detail, href, global_importance, lifecycle, source_confidence, art_key)
values
  ('FIFA World Cup 2026', 'soccer', 'Live now', 'Follow countries, bracket slots, and kickoff changes.', '/sports/soccer', 100, 'live', 'provider', 'soccer'),
  ('Formula 1 race weekends', 'motorsport', 'Staged', 'Practice, qualifying, sprint, and race sessions.', '/sports/f1', 84, 'model_ready', 'provider', 'motorsport'),
  ('UFC / PFL fight cards', 'combat', 'Model ready', 'Main cards, prelims, fighters, and late changes.', '/sports/ufc', 72, 'model_ready', 'provider', 'combat'),
  ('WNBA schedule tracking', 'basketball', 'Source testing', 'TheSportsDB premium, SportsDataIO, and Sportradar candidates.', '/sports/wnba', 55, 'source_testing', 'provider', 'basketball'),
  ('CFL and Grey Cup path', 'football', 'Canada focus', 'Canadian kickoff times and broadcast-region fit.', '/sports/cfl', 45, 'source_testing', 'provider', 'football'),
  ('NHL and world hockey nights', 'hockey', 'Model ready', 'Puck drops, IIHF windows, and playoff calendar testing.', '/sports/hockey', 42, 'model_ready', 'provider', 'hockey'),
  ('Grand slam watch windows', 'tennis', 'Template ready', 'Player follows, court order, and day/night session exports.', '/sports/tennis', 39, 'model_ready', 'provider', 'tennis'),
  ('Major golf weekend board', 'golf', 'Template ready', 'Rounds, tee sheets, cuts, and final-day broadcast windows.', '/sports/golf', 36, 'model_ready', 'provider', 'golf'),
  ('Diamond League and trials', 'track', 'Source testing', 'Heats, finals, start lists, and athlete-follow scheduling.', '/sports/track', 32, 'source_testing', 'placeholder', 'track'),
  ('Olympic sports capsule', 'olympic', 'Source testing', 'Swimming, gymnastics, medal events, and federation feeds.', '/sports/olympic', 30, 'source_testing', 'manual', 'olympic'),
  ('Community league schedules', 'custom', 'On air', 'Create local schedules for families, teams, and clubs.', '/custom-leagues', 24, 'scheduled', 'manual', 'custom')
on conflict (title, href) do update
set
  sport_key = excluded.sport_key,
  label = excluded.label,
  detail = excluded.detail,
  global_importance = excluded.global_importance,
  lifecycle = excluded.lifecycle,
  source_confidence = excluded.source_confidence,
  art_key = excluded.art_key,
  is_active = true,
  updated_at = now();
