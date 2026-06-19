-- API-Sports/API-Football pilot target.
--
-- Free plan pacing note: API-Sports allows a small daily request budget per API
-- product, so keep this provider limited to the World Cup/priority soccer until
-- usage proves stable or the subscription changes.

insert into public.provider_targets
  (provider_key, provider_league_id, sport_key, expected_name, current_season, priority, is_active)
values
  ('apisports_football', '1', 'soccer', 'FIFA World Cup', '2026', 6, true)
on conflict (provider_key, provider_league_id) do update set
  sport_key = excluded.sport_key,
  expected_name = excluded.expected_name,
  current_season = excluded.current_season,
  priority = excluded.priority,
  is_active = excluded.is_active;
