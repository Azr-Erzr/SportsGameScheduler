-- Scale-up: broaden the TheSportsDB allowlist to every sport family, add curated marquee
-- events for competitions without a usable live feed (Olympics), and prepare the schema for
-- per-player (roster) hydration.

-- 1. Player-readiness. Players are stored as competitors (kind='person') linked to their
--    team via parent_competitor_id; players_synced_at is the per-team roster cursor.
alter table public.competitors
  add column if not exists parent_competitor_id uuid references public.competitors(id) on delete set null,
  add column if not exists players_synced_at timestamptz;

create index if not exists competitors_parent_idx on public.competitors (parent_competitor_id);

-- 2. Curated marquee events. Some competitions (Olympics) have no schedule feed worth
--    syncing yet — we hand-enter the next occurrence + host so they still appear.
insert into public.venues (name) values
  ('Los Angeles, USA'), ('French Alps, France'), ('Brisbane, Australia')
on conflict (name) do nothing;

insert into public.leagues (sport_id, provider_key, provider_league_id, name, country, is_public)
select id, 'curated', 'olympics', 'Olympic Games', 'International', true
from public.sports where key = 'olympic_sports'
on conflict (provider_key, provider_league_id) do nothing;

insert into public.events (sport_id, league_id, venue_id, provider_key, provider_event_id, kind,
  status, title, short_title, starts_at, visibility, metadata)
select s.id, l.id, v.id, 'curated', e.pid, 'event', 'scheduled', e.title, e.short,
  e.starts::timestamptz, 'public', jsonb_build_object('location', e.loc, 'curated', true)
from (values
  ('olympics-la-2028', 'LA 2028 Summer Olympics', 'LA 2028', '2028-07-14T00:00:00Z', 'Los Angeles, USA'),
  ('olympics-french-alps-2030', 'French Alps 2030 Winter Olympics', 'Alps 2030', '2030-02-01T00:00:00Z', 'French Alps, France'),
  ('olympics-brisbane-2032', 'Brisbane 2032 Summer Olympics', 'Brisbane 2032', '2032-07-23T00:00:00Z', 'Brisbane, Australia')
) as e(pid, title, short, starts, loc)
join public.sports s on s.key = 'olympic_sports'
join public.leagues l on l.provider_key = 'curated' and l.provider_league_id = 'olympics'
left join public.venues v on v.name = e.loc
on conflict (provider_key, provider_event_id) do nothing;

-- 3. Broaden the allowlist. Confirmed IDs from discovery + high-confidence marquee candidates;
--    the hydrator verifies each (sport must match) and self-deactivates wrong IDs.
insert into public.provider_targets (provider_league_id, sport_key, expected_name, current_season, priority) values
  ('4429', 'soccer', 'FIFA World Cup', '2026', 5),
  ('4458', 'basketball', 'EuroLeague', '2025-2026', 88),
  ('4464', 'tennis', 'ATP World Tour', '2026', 90),
  ('4517', 'tennis', 'WTA Tour', '2026', 92),
  ('4581', 'tennis', 'Laver Cup', '2026', 140),
  ('5872', 'tennis', 'United Cup', '2026', 142),
  ('4425', 'golf', 'PGA Tour', '2026', 95),
  ('4758', 'golf', 'European Challenge Tour', '2026', 150),
  ('4761', 'golf', 'PGA Tour of Australasia', '2026', 152),
  ('4407', 'motorsport', 'MotoGP', '2026', 96),
  ('4393', 'motorsport', 'NASCAR Cup Series', '2026', 98),
  ('4422', 'motorsport', 'IndyCar Series', '2026', 100),
  ('4489', 'motorsport', 'V8 Supercars', '2026', 154),
  ('4372', 'motorsport', 'BTCC', '2026', 156),
  ('4445', 'combat_sports', 'Boxing', '2026', 102),
  ('5358', 'combat_sports', 'PFL', '2026', 104),
  ('5341', 'combat_sports', 'TKO MMA', '2026', 158),
  ('5702', 'combat_sports', 'Oktagon MMA', '2026', 160),
  ('5007', 'athletics', 'World Athletics Championships', '2026', 110),
  ('5008', 'athletics', 'Commonwealth Games Athletics', '2026', 162),
  ('5788', 'athletics', 'World Athletics Ultimate', '2026', 164),
  ('5785', 'athletics', 'World Athletics Indoor Tour', '2026', 166),
  ('5286', 'athletics', 'European Athletics Indoor', '2026', 168)
on conflict (provider_key, provider_league_id) do nothing;