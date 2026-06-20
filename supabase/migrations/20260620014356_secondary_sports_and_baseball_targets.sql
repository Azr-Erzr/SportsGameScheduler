-- Provider-backed secondary sport expansion.
--
-- Keep the primary app switcher focused, but let /other-sports route to DB-backed sport
-- pages as current provider coverage proves useful. The hydrator verifies each target
-- against TheSportsDB's reported sport before any league/event rows are written.

insert into public.sports (key, name) values
  ('baseball', 'Baseball'),
  ('cricket', 'Cricket'),
  ('rugby', 'Rugby'),
  ('volleyball', 'Volleyball'),
  ('handball', 'Handball'),
  ('cycling', 'Cycling'),
  ('snooker', 'Snooker'),
  ('darts', 'Darts')
on conflict (key) do update
set name = excluded.name;

insert into public.provider_targets
  (provider_key, provider_league_id, sport_key, expected_name, current_season, priority, is_active)
select 'thesportsdb', v.lid, v.sk, v.nm, v.season, v.pri, true
from (values
  -- Baseball: directly requested page plus international/pro leagues visible in TheSportsDB.
  ('4424', 'baseball', 'MLB', '2026', 24),
  ('4591', 'baseball', 'Nippon Baseball League', '2026', 62),
  ('4830', 'baseball', 'Korean KBO League', '2026', 64),
  ('5755', 'baseball', 'World Baseball Classic', '2026', 118),
  ('5863', 'baseball', 'MLB Spring Training', '2026', 170),

  -- Secondary sports surfaced on /other-sports. Start small; cron/checkpoints absorb more.
  ('4460', 'cricket', 'Indian Premier League', '2026', 180),
  ('4461', 'cricket', 'Australian Big Bash League', '2026-2027', 182),
  ('4714', 'rugby', 'Six Nations Championship', '2026', 184),
  ('4574', 'rugby', 'Rugby World Cup', '2027', 186),
  ('5083', 'volleyball', 'FIVB Volleyball Mens Nations League', '2026', 188),
  ('4465', 'cycling', 'UCI World Tour', '2026', 190),
  ('5312', 'cycling', 'UCI Womens World Tour', '2026', 192),
  ('5330', 'cycling', 'UCI ProSeries', '2026', 194),
  ('4533', 'handball', 'German Handball-Bundesliga', '2025-2026', 196),
  ('4980', 'handball', 'EHF Champions League', '2026-2027', 198),
  ('4555', 'snooker', 'World Snooker', '2026', 200),
  ('4554', 'darts', 'PDC Darts', '2026', 202)
) as v(lid, sk, nm, season, pri)
where not exists (
  select 1 from public.provider_targets t
  where t.provider_key = 'thesportsdb' and t.provider_league_id = v.lid
);

insert into public.spotlight_events
  (title, sport_key, label, detail, href, global_importance, lifecycle, source_confidence, art_key)
values
  ('MLB and global baseball', 'baseball', 'On air', 'MLB, NPB, KBO, spring training, and World Baseball Classic provider targets.', '/sports/baseball', 58, 'source_testing', 'provider', 'baseball'),
  ('Cricket league windows', 'cricket', 'Source testing', 'IPL and Big Bash are queued first, with other cricket leagues held for provider QA.', '/sports/cricket', 38, 'source_testing', 'provider', 'custom'),
  ('Rugby tournament path', 'rugby', 'Source testing', 'Six Nations and Rugby World Cup routes are queued for schedule hydration.', '/sports/rugby', 36, 'source_testing', 'provider', 'football'),
  ('Volleyball Nations League', 'volleyball', 'Source testing', 'FIVB Nations League is queued as the first volleyball schedule lane.', '/sports/volleyball', 28, 'source_testing', 'provider', 'basketball'),
  ('Cycling race calendars', 'cycling', 'Source testing', 'UCI World Tour, Womens World Tour, and ProSeries targets are queued.', '/sports/cycling', 28, 'source_testing', 'provider', 'motorsport')
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
