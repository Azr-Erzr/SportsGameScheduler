-- League display ordering by viewership/importance. Lower rank = shown first.
-- Backfilled from provider_targets.priority (the curated importance order), which already
-- ranks F1 (22) ahead of MotoGP/NASCAR, EPL/UCL ahead of smaller soccer leagues, etc.

alter table public.leagues add column if not exists display_rank integer not null default 500;

update public.leagues l
set display_rank = t.priority
from public.provider_targets t
where l.provider_key = 'thesportsdb'
  and t.provider_key = 'thesportsdb'
  and l.provider_league_id = t.provider_league_id;

-- Sources outside the allowlist: the openfootball World Cup is the marquee soccer event;
-- curated marquees (Olympics) sit just behind the live leagues.
update public.leagues set display_rank = 5 where provider_key = 'worldcup_json';
update public.leagues set display_rank = 40 where provider_key = 'curated';

create index if not exists leagues_rank_idx on public.leagues (sport_id, display_rank);