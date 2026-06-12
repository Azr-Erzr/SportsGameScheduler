// Generates supabase/seed.sql from the bundled WC2026 dataset as ONE set-based statement
// (jsonb_to_recordset), so it stays compact and idempotent.
// Run: node scripts/generate-seed.mjs

import { readFileSync, writeFileSync } from 'node:fs'

const data = JSON.parse(readFileSync(new URL('../src/data/worldcup2026.json', import.meta.url), 'utf8'))

const placeholderPattern = /^(?:\d[A-L]|W\d+|L\d+|\d[A-L]\/|3[A-L])/
const isKnownTeam = (t) => !placeholderPattern.test(t)

function parseKickoff(date, time) {
  const m = time.match(/^(\d{1,2}):(\d{2}) UTC([+-]\d{1,2})(?::(\d{2}))?$/)
  if (!m) return null
  const [, h, min, oh, om] = m
  const [y, mo, d] = date.split('-').map(Number)
  const sign = oh.startsWith('-') ? -1 : 1
  const offsetMin = sign * (Math.abs(Number(oh)) * 60 + (om ? Number(om) : 0))
  return new Date(Date.UTC(y, mo - 1, d, Number(h), Number(min)) - offsetMin * 60_000).toISOString()
}

// Array index, not m.num: the dataset omits num on some knockout rows, which produced a
// duplicate id (third-place collided with semi-final 102) and would break the upsert.
const rows = data.matches.map((m, i) => ({
  pid: `wc2026-${i}`,
  title: `${m.team1} vs ${m.team2}`,
  starts_at: parseKickoff(m.date, m.time),
  ground: m.ground,
  t1: isKnownTeam(m.team1) ? m.team1 : null,
  t2: isKnownTeam(m.team2) ? m.team2 : null,
  round: m.round,
  grp: m.group ?? null,
}))

const payload = JSON.stringify(rows).replace(/'/g, "''")

const sql = `-- Seed: sports catalog, WC2026 league, venues, competitors, fixtures. Idempotent.
insert into public.sports (key, name) values
  ('soccer', 'Soccer'), ('f1', 'Formula 1'), ('nhl', 'NHL'), ('nba', 'NBA'),
  ('tennis', 'Tennis'), ('golf', 'Golf'), ('custom', 'Custom')
on conflict (key) do nothing;

insert into public.leagues (sport_id, provider_key, provider_league_id, name, short_name)
select s.id, 'worldcup_json', 'wc2026', 'FIFA World Cup 2026', 'WC 2026'
from public.sports s where s.key = 'soccer'
on conflict (provider_key, provider_league_id) do nothing;

with raw as (
  select * from jsonb_to_recordset('${payload}'::jsonb)
    as r(pid text, title text, starts_at timestamptz, ground text, t1 text, t2 text, round text, grp text)
),
ctx as (
  select s.id as sport_id, l.id as league_id
  from public.sports s
  join public.leagues l on l.provider_key = 'worldcup_json' and l.provider_league_id = 'wc2026'
  where s.key = 'soccer'
),
ins_venues as (
  insert into public.venues (name)
  select distinct ground from raw
  on conflict do nothing
  returning id, name
),
ins_competitors as (
  insert into public.competitors (sport_id, league_id, kind, name, provider_key, provider_competitor_id)
  select ctx.sport_id, ctx.league_id, 'team', team, 'worldcup_json', team
  from ctx, (
    select distinct t1 as team from raw where t1 is not null
    union
    select distinct t2 from raw where t2 is not null
  ) teams
  on conflict (provider_key, provider_competitor_id) do nothing
  returning id, provider_competitor_id
),
venues_all as (
  select id, name from ins_venues
  union select id, name from public.venues
),
competitors_all as (
  select id, provider_competitor_id from ins_competitors
  union select id, provider_competitor_id from public.competitors where provider_key = 'worldcup_json'
),
ins_events as (
  insert into public.events (sport_id, league_id, venue_id, provider_key, provider_event_id, kind,
    status, title, short_title, starts_at, starts_at_tbd, visibility, metadata,
    home_competitor_id, away_competitor_id)
  select ctx.sport_id, ctx.league_id, v.id, 'worldcup_json', raw.pid, 'match',
    'scheduled', raw.title, raw.title, raw.starts_at, raw.starts_at is null, 'public',
    jsonb_build_object('round', raw.round, 'group', raw.grp),
    c1.id, c2.id
  from raw
  cross join ctx
  left join venues_all v on v.name = raw.ground
  left join competitors_all c1 on c1.provider_competitor_id = raw.t1
  left join competitors_all c2 on c2.provider_competitor_id = raw.t2
  on conflict (provider_key, provider_event_id) do nothing
  returning id, provider_event_id, home_competitor_id, away_competitor_id
)
insert into public.event_competitors (event_id, competitor_id, role)
select id, home_competitor_id, 'home' from ins_events where home_competitor_id is not null
union all
select id, away_competitor_id, 'away' from ins_events where away_competitor_id is not null
on conflict do nothing;
`

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql)
console.log(`Wrote supabase/seed.sql (${sql.length} chars, ${rows.length} fixtures)`)
