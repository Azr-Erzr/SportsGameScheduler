-- API-Sports/API-Formula-1 pilot target.
--
-- API-Formula-1 exposes races by season, so this target is a season checkpoint
-- rather than a traditional league id. The hydrator stores normalized race events
-- under provider_key = 'apisports_formula1'.

insert into public.provider_targets
  (provider_key, provider_league_id, sport_key, expected_name, current_season, priority, is_active)
values
  ('apisports_formula1', 'f1', 'motorsport', 'Formula 1', '2024', 12, true)
on conflict (provider_key, provider_league_id) do update set
  sport_key = excluded.sport_key,
  expected_name = excluded.expected_name,
  current_season = excluded.current_season,
  priority = excluded.priority,
  is_active = excluded.is_active;
