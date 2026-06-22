-- Competition lifecycle automation for MP3 closeout.
--
-- The existing `spotlight_events` table is a useful card rail, but recurring sports moments
-- need a layer above flat event rows: reusable competition templates plus real competition
-- instances with lifecycle state, schedule-release dates, result holds, and design art keys.

create table if not exists public.competition_templates (
  template_slug text primary key,
  sport_key text not null references public.sports(key) on update cascade,
  name text not null,
  card_template text not null,
  banner_template text not null,
  default_href text not null,
  default_art_key text,
  annual_window text,
  copy jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.competition_templates enable row level security;

drop policy if exists "active competition templates are readable" on public.competition_templates;
create policy "active competition templates are readable" on public.competition_templates
  for select to anon, authenticated
  using (is_active = true);

create table if not exists public.competition_instances (
  id uuid primary key default gen_random_uuid(),
  template_slug text not null references public.competition_templates(template_slug) on update cascade,
  sport_key text not null references public.sports(key) on update cascade,
  official_name text not null,
  season_label text,
  starts_at timestamptz,
  ends_at timestamptz,
  schedule_release_expected_at timestamptz,
  next_expected_at timestamptz,
  result_hold_until timestamptz,
  status text not null default 'announced'
    check (status in (
      'announced',
      'schedule_pending',
      'schedule_live',
      'imminent',
      'active',
      'result_hold',
      'completed',
      'return_stub',
      'dormant'
    )),
  global_importance integer not null default 50 check (global_importance between 0 and 100),
  region_importance jsonb not null default '{}'::jsonb,
  source_confidence text not null default 'manual'
    check (source_confidence in ('official', 'provider', 'cached', 'manual', 'placeholder')),
  href text not null,
  label text,
  detail text not null,
  art_key text,
  copy_variant text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_slug, official_name, season_label)
);

create index if not exists competition_instances_active_rank_idx
  on public.competition_instances (is_active, global_importance desc, starts_at);
create index if not exists competition_instances_sport_idx
  on public.competition_instances (sport_key, status);
create index if not exists competition_instances_template_idx
  on public.competition_instances (template_slug);

alter table public.competition_instances enable row level security;

drop policy if exists "active competition instances are readable" on public.competition_instances;
create policy "active competition instances are readable" on public.competition_instances
  for select to anon, authenticated
  using (is_active = true);

create table if not exists public.competition_instance_sources (
  id uuid primary key default gen_random_uuid(),
  competition_instance_id uuid not null references public.competition_instances(id) on delete cascade,
  source_target_id uuid references public.source_targets(id) on delete set null,
  provider_target_id uuid references public.provider_targets(id) on delete set null,
  source_url text,
  source_type text not null default 'provider',
  source_confidence text not null default 'provider'
    check (source_confidence in ('official', 'provider', 'cached', 'manual', 'placeholder')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_target_id is not null or provider_target_id is not null or source_url is not null)
);

create index if not exists competition_instance_sources_instance_idx
  on public.competition_instance_sources (competition_instance_id);

alter table public.competition_instance_sources enable row level security;

-- Source rows can contain review/terms URLs and internal source-target references. Keep them
-- service-role/admin only; public users read the normalized competition instance instead.

create table if not exists public.competition_calendar_rules (
  id uuid primary key default gen_random_uuid(),
  template_slug text not null references public.competition_templates(template_slug) on update cascade,
  month_number integer not null check (month_number between 1 and 12),
  window_label text not null,
  planning_note text not null,
  action_note text not null,
  priority integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_slug, month_number, window_label)
);

create index if not exists competition_calendar_rules_month_idx
  on public.competition_calendar_rules (month_number, priority);

alter table public.competition_calendar_rules enable row level security;

drop policy if exists "active competition calendar rules are readable" on public.competition_calendar_rules;
create policy "active competition calendar rules are readable" on public.competition_calendar_rules
  for select to anon, authenticated
  using (is_active = true);

create table if not exists public.team_assets (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references public.competitors(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete cascade,
  sport_key text references public.sports(key) on update cascade,
  asset_type text not null
    check (asset_type in ('logo', 'mascot', 'headshot', 'kit', 'venue', 'color_palette', 'poster_art', 'broadcast_mark')),
  url text,
  storage_path text,
  source_url text,
  license_status text not null default 'manual_review'
    check (license_status in ('allowed', 'provider_allowed', 'manual_review', 'blocked')),
  valid_from timestamptz,
  valid_until timestamptz,
  dominant_colors jsonb not null default '{}'::jsonb,
  contrast_notes text,
  metadata jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (competitor_id is not null or league_id is not null or sport_key is not null)
);

create index if not exists team_assets_competitor_idx on public.team_assets (competitor_id, asset_type);
create index if not exists team_assets_league_idx on public.team_assets (league_id, asset_type);
create index if not exists team_assets_sport_idx on public.team_assets (sport_key, asset_type);

alter table public.team_assets enable row level security;

drop policy if exists "non-blocked team assets are readable" on public.team_assets;
create policy "non-blocked team assets are readable" on public.team_assets
  for select to anon, authenticated
  using (license_status <> 'blocked');

create table if not exists public.competition_art_kits (
  id uuid primary key default gen_random_uuid(),
  template_slug text not null references public.competition_templates(template_slug) on update cascade,
  art_key text not null,
  surface_mode text not null check (surface_mode in ('broadcast', 'program', 'export', 'email')),
  storage_path text,
  source_url text,
  license_status text not null default 'manual_review'
    check (license_status in ('allowed', 'provider_allowed', 'manual_review', 'blocked')),
  valid_from timestamptz,
  valid_until timestamptz,
  fallback_art_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_slug, art_key, surface_mode)
);

create index if not exists competition_art_kits_template_idx
  on public.competition_art_kits (template_slug, surface_mode);

alter table public.competition_art_kits enable row level security;

drop policy if exists "non-blocked competition art kits are readable" on public.competition_art_kits;
create policy "non-blocked competition art kits are readable" on public.competition_art_kits
  for select to anon, authenticated
  using (license_status <> 'blocked');

alter table public.spotlight_events
  add column if not exists competition_instance_id uuid references public.competition_instances(id) on delete set null,
  add column if not exists template_slug text references public.competition_templates(template_slug) on update cascade,
  add column if not exists result_hold_until timestamptz,
  add column if not exists schedule_release_expected_at timestamptz;

alter table public.spotlight_events
  drop constraint if exists spotlight_events_lifecycle_check,
  add constraint spotlight_events_lifecycle_check
    check (lifecycle in (
      'draft',
      'scheduled',
      'live',
      'completed',
      'expired',
      'source_testing',
      'model_ready',
      'announced',
      'schedule_pending',
      'schedule_live',
      'imminent',
      'active',
      'result_hold',
      'return_stub',
      'dormant'
    ));

create index if not exists spotlight_events_competition_instance_idx
  on public.spotlight_events (competition_instance_id);

grant select on public.competition_templates to anon, authenticated;
grant select on public.competition_instances to anon, authenticated;
grant select on public.competition_calendar_rules to anon, authenticated;
grant select on public.team_assets to anon, authenticated;
grant select on public.competition_art_kits to anon, authenticated;

insert into public.competition_templates
  (template_slug, sport_key, name, card_template, banner_template, default_href, default_art_key, annual_window, copy)
values
  ('world-cup-tournament', 'soccer', 'World Cup tournament', 'world-cup-tournament', 'world-cup-route-map', '/sports/soccer', 'world-cup-route-map-v1', 'June-July in tournament years', '{"returnStub":"{competitionName} returns {nextWindow}. We will let you know when the schedule drops."}'::jsonb),
  ('uefa-champions-league', 'soccer', 'UEFA Champions League', 'knockout-cup', 'ucl-night-board', '/sports/soccer', 'ucl-night-board-v1', 'Qualifying July-August; league/knockouts August-June', '{"schedulePending":"Qualifying and draw windows are opening. Fixtures will move here as they publish."}'::jsonb),
  ('multi-sport-games', 'olympic_sports', 'Multi-sport games', 'multi-sport-games', 'olympic-session-board', '/sports/olympic', 'olympics-session-board-v1', 'Summer/Winter games on the Olympic cycle', '{"schedulePending":"We will let you know when the detailed session schedule drops."}'::jsonb),
  ('league-season', 'basketball', 'League season', 'league-season', 'season-board', '/sports/basketball', 'league-season-board-v1', 'Varies by league', '{}'::jsonb),
  ('race-weekend', 'motorsport', 'Race weekend', 'race-weekend', 'circuit-board', '/sports/motorsport', 'race-weekend-board-v1', 'Mostly February-November', '{}'::jsonb),
  ('fight-card', 'combat_sports', 'Fight card', 'fight-card', 'fight-card-poster', '/sports/combat', 'fight-card-poster-v1', 'Year-round weekly/monthly cards', '{}'::jsonb),
  ('baseball-season', 'baseball', 'Baseball season', 'league-season', 'baseball-season-board', '/sports/baseball', 'baseball-season-board-v1', 'March/April-October/November', '{}'::jsonb),
  ('hockey-season', 'hockey', 'Hockey season', 'league-season', 'ice-season-board', '/sports/hockey', 'hockey-season-board-v1', 'Preseason September; season October-June', '{}'::jsonb)
on conflict (template_slug) do update
set
  sport_key = excluded.sport_key,
  name = excluded.name,
  card_template = excluded.card_template,
  banner_template = excluded.banner_template,
  default_href = excluded.default_href,
  default_art_key = excluded.default_art_key,
  annual_window = excluded.annual_window,
  copy = excluded.copy,
  is_active = true,
  updated_at = now();

insert into public.competition_instances
  (
    template_slug,
    sport_key,
    official_name,
    season_label,
    starts_at,
    ends_at,
    schedule_release_expected_at,
    next_expected_at,
    result_hold_until,
    status,
    global_importance,
    region_importance,
    source_confidence,
    href,
    label,
    detail,
    art_key,
    copy_variant,
    metadata
  )
values
  (
    'world-cup-tournament',
    'soccer',
    'FIFA World Cup 2026',
    '2026',
    '2026-06-11 00:00:00+00',
    '2026-07-19 23:59:59+00',
    null,
    '2030-06-01 12:00:00+00',
    '2026-07-21 23:59:59+00',
    'active',
    100,
    '{"CA":12,"US":10,"MX":10,"GB":5}'::jsonb,
    'provider',
    '/sports/soccer',
    'Live now',
    'Follow countries, bracket slots, kickoff changes, and local-time alerts.',
    'world-cup-route-map-v1',
    'tournament-active',
    '{"host_region":"North America","template_note":"Reusable World Cup route-map planner."}'::jsonb
  ),
  (
    'uefa-champions-league',
    'soccer',
    'UEFA Champions League',
    '2026-27',
    '2026-07-07 12:00:00+00',
    '2027-06-05 23:59:59+00',
    '2026-06-16 12:00:00+00',
    '2027-07-01 12:00:00+00',
    '2027-06-06 23:59:59+00',
    'schedule_live',
    88,
    '{"GB":12,"FR":10,"ES":10,"IT":10,"DE":10,"CA":4,"US":4}'::jsonb,
    'official',
    '/sports/soccer',
    'Schedule live',
    'Qualifying starts in July; Silbo can promote UCL without a manual homepage rewrite.',
    'ucl-night-board-v1',
    'qualifying-window',
    '{"official_anchor":"UEFA qualifying begins July 7, 2026 and concludes August 26, 2026."}'::jsonb
  ),
  (
    'multi-sport-games',
    'olympic_sports',
    'LA 2028 Olympic Games',
    '2028',
    '2028-07-14 12:00:00+00',
    '2028-07-30 23:59:59+00',
    '2028-01-01 12:00:00+00',
    '2028-07-14 12:00:00+00',
    '2028-08-01 23:59:59+00',
    'announced',
    96,
    '{"US":18,"CA":8,"MX":6}'::jsonb,
    'official',
    '/sports/olympic',
    'Dates announced',
    'Olympic dates are official. We will let you know when detailed session schedules drop.',
    'olympics-session-board-v1',
    'schedule-drop-watch',
    '{"host_city":"Los Angeles","official_dates":"July 14-30, 2028"}'::jsonb
  ),
  (
    'hockey-season',
    'hockey',
    'NHL preseason',
    '2026-27',
    '2026-09-19 12:00:00+00',
    '2026-10-08 23:59:59+00',
    '2026-08-15 12:00:00+00',
    '2026-09-19 12:00:00+00',
    null,
    'return_stub',
    54,
    '{"CA":14,"US":8}'::jsonb,
    'manual',
    '/sports/hockey',
    'Returning soon',
    'Hockey is between schedule windows; show the preseason return stub until fixtures fill in.',
    'hockey-season-board-v1',
    'season-return',
    '{}'::jsonb
  ),
  (
    'baseball-season',
    'baseball',
    'MLB regular season',
    '2026',
    '2026-03-26 12:00:00+00',
    '2026-10-04 23:59:59+00',
    null,
    '2026-10-01 12:00:00+00',
    null,
    'schedule_live',
    64,
    '{"US":12,"CA":8,"JP":6,"KR":6}'::jsonb,
    'provider',
    '/sports/baseball',
    'On air',
    'MLB, NPB, KBO, spring training, and World Baseball Classic lanes are hydrated.',
    'baseball-season-board-v1',
    'season-live',
    '{}'::jsonb
  ),
  (
    'race-weekend',
    'motorsport',
    'Formula 1 race weekends',
    '2026',
    '2026-03-06 12:00:00+00',
    '2026-12-06 23:59:59+00',
    null,
    '2027-02-01 12:00:00+00',
    null,
    'schedule_live',
    78,
    '{"GB":8,"CA":8,"US":6,"AU":6,"IT":6,"ES":6}'::jsonb,
    'provider',
    '/sports/motorsport',
    'Race weekends',
    'Practice, qualifying, sprint, and race sessions can share one race-weekend template.',
    'race-weekend-board-v1',
    'season-live',
    '{}'::jsonb
  ),
  (
    'fight-card',
    'combat_sports',
    'UFC and PFL fight cards',
    '2026',
    '2026-01-01 12:00:00+00',
    '2026-12-31 23:59:59+00',
    null,
    '2027-01-01 12:00:00+00',
    null,
    'schedule_live',
    72,
    '{"US":10,"CA":8,"GB":6,"BR":6}'::jsonb,
    'provider',
    '/sports/combat',
    'Fight cards',
    'Main cards, prelims, fighters, and late changes should flow into the fight-card template.',
    'fight-card-poster-v1',
    'season-live',
    '{}'::jsonb
  )
on conflict (template_slug, official_name, season_label) do update
set
  sport_key = excluded.sport_key,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  schedule_release_expected_at = excluded.schedule_release_expected_at,
  next_expected_at = excluded.next_expected_at,
  result_hold_until = excluded.result_hold_until,
  status = excluded.status,
  global_importance = excluded.global_importance,
  region_importance = excluded.region_importance,
  source_confidence = excluded.source_confidence,
  href = excluded.href,
  label = excluded.label,
  detail = excluded.detail,
  art_key = excluded.art_key,
  copy_variant = excluded.copy_variant,
  metadata = excluded.metadata,
  is_active = true,
  updated_at = now();

insert into public.competition_calendar_rules
  (template_slug, month_number, window_label, planning_note, action_note, priority, metadata)
values
  ('uefa-champions-league', 2, 'UCL knockouts restart', 'Champions League knockout football returns in February.', 'Switch UCL cards from season mode to knockout mode and raise European/regional boosts.', 20, '{}'::jsonb),
  ('league-season', 3, 'March Madness and playoff races', 'NCAA brackets, NBA/NHL playoff races, and spring basketball windows peak.', 'Promote bracket/finals templates and verify college/team art cache.', 25, '{}'::jsonb),
  ('baseball-season', 3, 'MLB Opening Day', 'Baseball season starts in late March or early April.', 'Refresh MLB teams, colors, venues, and season spotlight cards.', 30, '{}'::jsonb),
  ('world-cup-tournament', 6, 'Global soccer tournament window', 'World Cups, Euros, Copa America, and summer international soccer often sit in June/July.', 'Promote tournament template, schedule drops, country follows, and knockout TBD watches.', 10, '{}'::jsonb),
  ('multi-sport-games', 7, 'Olympics and summer games window', 'Summer Olympics/Commonwealth/Pan Am windows usually live in July/August when scheduled.', 'Show return/reminder stubs years ahead; switch to schedule-live once sessions publish.', 12, '{}'::jsonb),
  ('uefa-champions-league', 7, 'UCL qualifying starts', 'Champions League qualifying begins in July.', 'Show schedule-pending/qualifying lifecycle without manual frontend changes.', 16, '{}'::jsonb),
  ('hockey-season', 9, 'Hockey preseason return', 'NHL/PWHL/IIHF lanes begin returning around September.', 'Show return stubs until fixtures hydrate, then switch to schedule-live.', 34, '{}'::jsonb),
  ('baseball-season', 10, 'Baseball postseason', 'MLB postseason and World Series windows peak in October.', 'Use playoff/final/result-hold spotlight copy and schedule-add CTAs.', 14, '{}'::jsonb),
  ('league-season', 10, 'NBA and NHL season launch', 'Basketball and hockey seasons start in October.', 'Refresh team assets and promote season launch cards.', 22, '{}'::jsonb),
  ('race-weekend', 11, 'F1 title run', 'F1 title scenarios and final races usually happen in November/early December.', 'Boost race-weekend template and title-scenario copy when provider data supports it.', 24, '{}'::jsonb)
on conflict (template_slug, month_number, window_label) do update
set
  planning_note = excluded.planning_note,
  action_note = excluded.action_note,
  priority = excluded.priority,
  metadata = excluded.metadata,
  is_active = true,
  updated_at = now();

insert into public.competition_art_kits
  (template_slug, art_key, surface_mode, storage_path, source_url, license_status, fallback_art_key, metadata)
values
  ('world-cup-tournament', 'world-cup-route-map-v1', 'broadcast', null, null, 'allowed', 'soccer', '{"note":"Code-native route-map motif; no official marks."}'::jsonb),
  ('world-cup-tournament', 'world-cup-route-map-v1', 'program', null, null, 'allowed', 'soccer', '{"note":"Paper/atlas variant for program mode."}'::jsonb),
  ('uefa-champions-league', 'ucl-night-board-v1', 'broadcast', null, null, 'manual_review', 'soccer', '{"note":"Use generic European night-football art unless marks are licensed."}'::jsonb),
  ('multi-sport-games', 'olympics-session-board-v1', 'broadcast', null, null, 'manual_review', 'olympic', '{"note":"Use generic multi-sport rings/venue motifs unless official marks are licensed."}'::jsonb),
  ('race-weekend', 'race-weekend-board-v1', 'broadcast', null, null, 'allowed', 'motorsport', '{"note":"Generic circuit board art."}'::jsonb),
  ('fight-card', 'fight-card-poster-v1', 'broadcast', null, null, 'allowed', 'combat', '{"note":"Generic fight-card typography/poster art."}'::jsonb),
  ('baseball-season', 'baseball-season-board-v1', 'broadcast', null, null, 'allowed', 'baseball', '{"note":"Generic baseball season board art."}'::jsonb)
on conflict (template_slug, art_key, surface_mode) do update
set
  storage_path = excluded.storage_path,
  source_url = excluded.source_url,
  license_status = excluded.license_status,
  fallback_art_key = excluded.fallback_art_key,
  metadata = excluded.metadata,
  updated_at = now();

drop function if exists public.competition_lifecycle_ranked(text, int);

create function public.competition_lifecycle_ranked(region text default null, limit_count int default 16)
returns table (
  competition_instance_id uuid,
  template_slug text,
  title text,
  sport_key text,
  label text,
  detail text,
  href text,
  lifecycle text,
  starts_at timestamptz,
  ends_at timestamptz,
  result_hold_until timestamptz,
  schedule_release_expected_at timestamptz,
  global_importance integer,
  ranking_score integer,
  art_key text,
  source_confidence text
)
language sql
stable
security invoker
set search_path = public
as $$
  with scored as (
    select
      ci.id as competition_instance_id,
      ci.template_slug,
      ci.official_name as title,
      ci.sport_key,
      coalesce(
        ci.label,
        case
          when ci.status = 'return_stub' then 'Returning soon'
          when ci.status = 'schedule_pending' then 'Schedule pending'
          when ci.status = 'schedule_live' then 'Schedule live'
          when ci.status = 'announced' then 'Dates announced'
          else initcap(replace(ci.status, '_', ' '))
        end
      ) as label,
      ci.detail,
      ci.href,
      case
        when ci.ends_at is not null
          and now() > ci.ends_at
          and now() <= coalesce(ci.result_hold_until, ci.ends_at + interval '24 hours')
          then 'result_hold'
        when ci.ends_at is not null
          and now() > coalesce(ci.result_hold_until, ci.ends_at + interval '24 hours')
          then 'completed'
        when ci.starts_at is not null
          and ci.starts_at <= now()
          and (ci.ends_at is null or ci.ends_at >= now())
          then 'active'
        when ci.starts_at is not null
          and ci.starts_at > now()
          and ci.starts_at <= now() + interval '72 hours'
          then 'imminent'
        else ci.status
      end as lifecycle,
      ci.starts_at,
      ci.ends_at,
      ci.result_hold_until,
      ci.schedule_release_expected_at,
      ci.global_importance,
      ci.art_key,
      ci.source_confidence,
      coalesce(nullif(ci.region_importance ->> upper(coalesce(region, '')), '')::integer, 0) as region_boost
    from public.competition_instances ci
    where ci.is_active
  )
  select
    scored.competition_instance_id,
    scored.template_slug,
    scored.title,
    scored.sport_key,
    scored.label,
    scored.detail,
    scored.href,
    scored.lifecycle,
    scored.starts_at,
    scored.ends_at,
    scored.result_hold_until,
    scored.schedule_release_expected_at,
    scored.global_importance,
    scored.global_importance
      + scored.region_boost
      + case scored.lifecycle
          when 'active' then 30
          when 'imminent' then 25
          when 'schedule_live' then 18
          when 'result_hold' then 12
          when 'schedule_pending' then 10
          when 'announced' then 6
          when 'return_stub' then 4
          when 'completed' then -40
          when 'dormant' then -60
          else 0
        end as ranking_score,
    scored.art_key,
    scored.source_confidence
  from scored
  where scored.lifecycle <> 'dormant'
    and scored.lifecycle <> 'completed'
  order by ranking_score desc, starts_at asc nulls last, title asc
  limit greatest(1, least(coalesce(limit_count, 16), 32));
$$;

grant execute on function public.competition_lifecycle_ranked(text, int) to anon, authenticated;

drop function if exists public.spotlight_ranked(text, int);

create function public.spotlight_ranked(region text default null, limit_count int default 16)
returns table (
  title text,
  sport_key text,
  label text,
  detail text,
  href text,
  global_importance integer,
  ranking_score integer,
  lifecycle text,
  template_slug text,
  art_key text,
  starts_at timestamptz,
  ends_at timestamptz,
  competition_instance_id uuid,
  source_confidence text,
  result_hold_until timestamptz,
  schedule_release_expected_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with competition_cards as (
    select
      c.title,
      c.sport_key,
      c.label,
      c.detail,
      c.href,
      c.global_importance,
      c.ranking_score,
      c.lifecycle,
      c.template_slug,
      c.art_key,
      c.starts_at,
      c.ends_at,
      c.competition_instance_id,
      c.source_confidence,
      c.result_hold_until,
      c.schedule_release_expected_at
    from public.competition_lifecycle_ranked(region, 32) c
  ),
  static_cards as (
    select
      s.title,
      s.sport_key,
      s.label,
      s.detail,
      s.href,
      s.global_importance,
      s.global_importance
        + coalesce(nullif(s.region_importance ->> upper(coalesce(region, '')), '')::integer, 0) as ranking_score,
      s.lifecycle,
      s.template_slug,
      s.art_key,
      s.starts_at,
      s.ends_at,
      s.competition_instance_id,
      s.source_confidence,
      s.result_hold_until,
      s.schedule_release_expected_at
    from public.spotlight_events s
    where s.is_active
      and not exists (
        select 1
        from competition_cards c
        where c.title = s.title
          or (s.competition_instance_id is not null and s.competition_instance_id = c.competition_instance_id)
      )
  )
  select
    ranked.title,
    ranked.sport_key,
    ranked.label,
    ranked.detail,
    ranked.href,
    ranked.global_importance,
    ranked.ranking_score,
    ranked.lifecycle,
    ranked.template_slug,
    ranked.art_key,
    ranked.starts_at,
    ranked.ends_at,
    ranked.competition_instance_id,
    ranked.source_confidence,
    ranked.result_hold_until,
    ranked.schedule_release_expected_at
  from (
    select * from competition_cards
    union all
    select * from static_cards
  ) ranked
  order by
    ranked.ranking_score desc,
    ranked.starts_at asc nulls last,
    ranked.title asc
  limit greatest(1, least(coalesce(limit_count, 16), 32));
$$;

grant execute on function public.spotlight_ranked(text, int) to anon, authenticated;

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
      'watch_links', (select count(*) from watch_links where is_active),
      'competition_instances', (select count(*) from competition_instances where is_active)
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
    'spotlight', (
      select jsonb_build_object(
        'competition_instances', (select count(*) from competition_instances where is_active),
        'static_cards', (select count(*) from spotlight_events where is_active),
        'top', coalesce((
          select jsonb_agg(r) from (
            select jsonb_build_object(
              'title', title,
              'sport_key', sport_key,
              'label', label,
              'lifecycle', lifecycle,
              'template_slug', template_slug,
              'ranking_score', ranking_score
            ) as r
            from spotlight_ranked(null, 8)
          ) spotlight_rows
        ), '[]'::jsonb)
      )
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

grant execute on function public.admin_overview() to authenticated;
