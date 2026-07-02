// Paced API-Sports/API-Football hydrator.
//
// First target: soccer fixtures from API-Football (v3), used as a second opinion for
// World Cup and other high-value soccer schedules. The free API-Sports plan is small
// enough that this function intentionally does one fixture call per active target and
// is meant to run daily/low-frequency until the plan is upgraded.
//
// Security: APISPORTS_KEY is read from Supabase secrets and is never sent to clients.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const PROVIDER_KEY = 'apisports_football'
const API_KEY = Deno.env.get('APISPORTS_KEY') ?? ''
const BASE = Deno.env.get('APISPORTS_FOOTBALL_BASE_URL') ?? 'https://v3.football.api-sports.io'
const CALL_BUDGET = Number(Deno.env.get('APISPORTS_CALL_BUDGET') ?? 6)
const CALL_SPACING_MS = Number(Deno.env.get('APISPORTS_SPACING_MS') ?? 1200)
const FIXTURE_NEXT_LIMIT = Number(Deno.env.get('APISPORTS_FIXTURE_NEXT_LIMIT') ?? 80)
const EVENTS_TTL_MS = Number(Deno.env.get('APISPORTS_EVENTS_TTL_HOURS') ?? 24) * 3600_000

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

class RateLimited extends Error {}
class BudgetSpent extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Counters = { calls: number; targets: number; fixtures: number; changed: number }
type Target = {
  id: string
  provider_league_id: string
  sport_key: string
  expected_name: string
  current_season: string | null
  events_synced_at: string | null
}

type ApiTeam = { id: number | null; name: string | null; logo: string | null }
type ApiFixture = {
  fixture: {
    id: number
    date: string | null
    timezone: string | null
    timestamp?: number | null
    status?: { long?: string | null; short?: string | null; elapsed?: number | null }
    venue?: { id?: number | null; name?: string | null; city?: string | null }
  }
  league?: {
    id?: number | null
    name?: string | null
    country?: string | null
    logo?: string | null
    season?: number | string | null
    round?: string | null
  }
  teams?: {
    home?: ApiTeam
    away?: ApiTeam
  }
  goals?: { home?: number | null; away?: number | null }
  score?: Record<string, unknown>
}

function stale(ts: string | null, ttl: number, now: number) {
  return !ts || now - new Date(ts).getTime() > ttl
}

async function payloadHash(value: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(value))
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function normalizeStatus(short?: string | null, long?: string | null): string {
  const status = `${short ?? ''} ${long ?? ''}`.toLowerCase()
  if (/\b(ft|aet|pen)\b|match finished|finished/.test(status)) return 'finished'
  if (/\b(pst)\b|postponed/.test(status)) return 'postponed'
  if (/\b(canc|abd)\b|cancelled|abandoned/.test(status)) return 'cancelled'
  if (/\b(1h|2h|et|bt|p|int|live|ht|susp)\b|in play|halftime/.test(status)) return 'live'
  return 'scheduled'
}

function startsAtFor(fixture: ApiFixture['fixture']) {
  if (fixture.date) return { iso: new Date(fixture.date).toISOString(), tbd: false }
  if (fixture.timestamp) return { iso: new Date(fixture.timestamp * 1000).toISOString(), tbd: false }
  return { iso: null, tbd: true }
}

function titleFor(fixture: ApiFixture) {
  const home = fixture.teams?.home?.name ?? ''
  const away = fixture.teams?.away?.name ?? ''
  return home && away ? `${home} vs ${away}` : fixture.league?.name ?? 'Soccer fixture'
}

async function api(path: string, counters: Counters): Promise<Record<string, unknown>> {
  if (counters.calls >= CALL_BUDGET) throw new BudgetSpent()
  await sleep(CALL_SPACING_MS)
  counters.calls += 1
  const res = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': API_KEY } })
  if (res.status === 429) throw new RateLimited()
  if (!res.ok) throw new Error(`API-Sports ${path} -> ${res.status}`)
  return (await res.json()) as Record<string, unknown>
}

async function ensureSportId(sportKey: string): Promise<string> {
  const { data } = await supabase.from('sports').select('id').eq('key', sportKey).single()
  if (!data) throw new Error(`Unknown sport key ${sportKey}`)
  return data.id
}

async function ensureLeague(target: Target, sportId: string, fixture?: ApiFixture) {
  const league = fixture?.league
  const { data, error } = await supabase
    .from('leagues')
    .upsert(
      {
        sport_id: sportId,
        provider_key: PROVIDER_KEY,
        provider_league_id: target.provider_league_id,
        name: league?.name ?? target.expected_name,
        country: league?.country ?? null,
        logo_url: league?.logo ?? null,
        is_public: true,
      },
      { onConflict: 'provider_key,provider_league_id' },
    )
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

async function ensureVenues(fixtures: ApiFixture[]) {
  const names = [
    ...new Set(fixtures.map((fixture) => fixture.fixture.venue?.name).filter((name): name is string => Boolean(name))),
  ]
  const map = new Map<string, string>()
  if (!names.length) return map
  await supabase.from('venues').upsert(
    names.map((name) => {
      const venue = fixtures.find((fixture) => fixture.fixture.venue?.name === name)?.fixture.venue
      return { name, city: venue?.city ?? null }
    }),
    { onConflict: 'name' },
  )
  const { data } = await supabase.from('venues').select('id, name').in('name', names)
  for (const venue of data ?? []) map.set(venue.name, venue.id)
  return map
}

async function ensureCompetitors(sportId: string, leagueId: string, fixtures: ApiFixture[]) {
  const teams = new Map<number, ApiTeam>()
  for (const fixture of fixtures) {
    const home = fixture.teams?.home
    const away = fixture.teams?.away
    if (home?.id && home.name) teams.set(home.id, home)
    if (away?.id && away.name) teams.set(away.id, away)
  }
  const map = new Map<number, string>()
  if (!teams.size) return map
  await supabase.from('competitors').upsert(
    [...teams.entries()].map(([id, team]) => ({
      sport_id: sportId,
      league_id: leagueId,
      kind: 'team',
      name: team.name!,
      logo_url: team.logo ?? null,
      provider_key: PROVIDER_KEY,
      provider_competitor_id: String(id),
    })),
    { onConflict: 'provider_key,provider_competitor_id' },
  )
  const ids = [...teams.keys()].map(String)
  const { data } = await supabase
    .from('competitors')
    .select('id, provider_competitor_id')
    .eq('provider_key', PROVIDER_KEY)
    .in('provider_competitor_id', ids)
  for (const team of data ?? []) map.set(Number(team.provider_competitor_id), team.id)
  return map
}

async function replaceParticipants(db: SupabaseClient, eventId: string, homeId?: string, awayId?: string) {
  await db.from('event_competitors').delete().eq('event_id', eventId)
  const rows = []
  if (homeId) rows.push({ event_id: eventId, competitor_id: homeId, role: 'home' })
  if (awayId) rows.push({ event_id: eventId, competitor_id: awayId, role: 'away' })
  if (rows.length) await db.from('event_competitors').insert(rows)
}

async function upsertFixtures(target: Target, fixtures: ApiFixture[], counters: Counters) {
  if (!fixtures.length) return
  const sportId = await ensureSportId(target.sport_key)
  const leagueId = await ensureLeague(target, sportId, fixtures[0])
  const venueMap = await ensureVenues(fixtures)
  const competitorMap = await ensureCompetitors(sportId, leagueId, fixtures)
  const providerIds = fixtures.map((fixture) => String(fixture.fixture.id))

  const existing = new Map<
    string,
    { id: string; title: string; status: string; starts_at: string | null; version: number; payload_hash: string | null }
  >()
  const { data: existingRows } = await supabase
    .from('events')
    .select('id, provider_event_id, title, status, starts_at, version, payload_hash')
    .eq('provider_key', PROVIDER_KEY)
    .in('provider_event_id', providerIds)
  for (const row of existingRows ?? []) existing.set(row.provider_event_id, row)

  for (const fixture of fixtures) {
    const providerEventId = String(fixture.fixture.id)
    const { iso, tbd } = startsAtFor(fixture.fixture)
    const status = normalizeStatus(fixture.fixture.status?.short, fixture.fixture.status?.long)
    const title = titleFor(fixture)
    const homeProviderId = fixture.teams?.home?.id ?? null
    const awayProviderId = fixture.teams?.away?.id ?? null
    const homeId = homeProviderId ? competitorMap.get(homeProviderId) : undefined
    const awayId = awayProviderId ? competitorMap.get(awayProviderId) : undefined
    const checkedAt = new Date().toISOString()
    const metadata = {
      source: PROVIDER_KEY,
      round: fixture.league?.round ?? null,
      season: fixture.league?.season ?? target.current_season,
      status_short: fixture.fixture.status?.short ?? null,
      status_long: fixture.fixture.status?.long ?? null,
      goals: fixture.goals ?? null,
      score: fixture.score ?? null,
    }
    const hash = await payloadHash({
      title,
      status,
      starts_at: iso,
      starts_at_tbd: tbd,
      timezone: fixture.fixture.timezone ?? null,
      venue: fixture.fixture.venue ?? null,
      home_provider_id: homeProviderId,
      away_provider_id: awayProviderId,
      metadata,
    })
    const prior = existing.get(providerEventId)

    if (!prior) {
      // Never create brand-new rows for long-past events: cleanup_past_events prunes at 90 days,
      // and re-inserting pruned fixtures with fresh ids breaks permalinks and churns nightly.
      if (iso && new Date(iso).getTime() < Date.now() - 30 * 24 * 3600_000) continue
      const { data: inserted, error } = await supabase
        .from('events')
        .insert({
          sport_id: sportId,
          league_id: leagueId,
          venue_id: fixture.fixture.venue?.name ? venueMap.get(fixture.fixture.venue.name) ?? null : null,
          provider_key: PROVIDER_KEY,
          provider_event_id: providerEventId,
          kind: 'match',
          status,
          title,
          starts_at: iso,
          starts_at_tbd: tbd,
          timezone: fixture.fixture.timezone ?? null,
          visibility: 'public',
          home_competitor_id: homeId ?? null,
          away_competitor_id: awayId ?? null,
          metadata,
          payload_hash: hash,
          last_checked_at: checkedAt,
          source_confidence: 'provider',
        })
        .select('id')
        .single()
      if (error) throw error
      await replaceParticipants(supabase, inserted.id, homeId, awayId)
      counters.changed += 1
      continue
    }

    if (prior.payload_hash === hash) {
      await supabase.from('events').update({ last_checked_at: checkedAt }).eq('id', prior.id)
      continue
    }

    const visibleChange = prior.title !== title || prior.status !== status || prior.starts_at !== iso
    const updatePayload: Record<string, unknown> = {
      title,
      status,
      starts_at: iso,
      starts_at_tbd: tbd,
      timezone: fixture.fixture.timezone ?? null,
      venue_id: fixture.fixture.venue?.name ? venueMap.get(fixture.fixture.venue.name) ?? null : null,
      home_competitor_id: homeId ?? null,
      away_competitor_id: awayId ?? null,
      metadata,
      version: visibleChange ? prior.version + 1 : prior.version,
      last_checked_at: checkedAt,
      payload_hash: hash,
      source_confidence: 'provider',
    }
    if (visibleChange) updatePayload.updated_at = checkedAt

    await supabase.from('events').update(updatePayload).eq('id', prior.id)
    await replaceParticipants(supabase, prior.id, homeId, awayId)
    if (prior.starts_at !== iso || prior.status !== status) {
      await supabase.from('event_status_history').insert({
        event_id: prior.id,
        old_status: prior.status,
        new_status: status,
        old_starts_at: prior.starts_at,
        new_starts_at: iso,
        source: PROVIDER_KEY,
      })
    }
    counters.changed += 1
  }
}

Deno.serve(async (req) => {
  if (!API_KEY) return Response.json({ ok: false, error: 'APISPORTS_KEY not configured' }, { status: 500 })

  const body = req.method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {}
  const onlyLeagueId = typeof body.leagueId === 'string' ? body.leagueId : null
  const force = body.force === true
  const now = Date.now()
  const counters: Counters = { calls: 0, targets: 0, fixtures: 0, changed: 0 }

  const { data: run } = await supabase
    .from('provider_sync_runs')
    .insert({ provider_key: PROVIDER_KEY, sport_key: 'soccer', status: 'running' })
    .select('id')
    .single()

  let stopped: 'budget' | 'rate_limited' | 'done' = 'done'

  try {
    let query = supabase
      .from('provider_targets')
      .select('id, provider_league_id, sport_key, expected_name, current_season, events_synced_at')
      .eq('provider_key', PROVIDER_KEY)
      .eq('is_active', true)
      .order('priority', { ascending: true })
    if (onlyLeagueId) query = query.eq('provider_league_id', onlyLeagueId)
    const { data: targets, error } = await query
    if (error) throw error

    for (const target of (targets ?? []) as Target[]) {
      if (!force && !stale(target.events_synced_at, EVENTS_TTL_MS, now)) continue
      try {
        const season = target.current_season ?? new Date().getUTCFullYear().toString()
        const json = await api(
          `/fixtures?league=${encodeURIComponent(target.provider_league_id)}&season=${encodeURIComponent(season)}&next=${FIXTURE_NEXT_LIMIT}`,
          counters,
        )
        const fixtures = (json.response as ApiFixture[] | null) ?? []
        await upsertFixtures(target, fixtures, counters)
        counters.targets += 1
        counters.fixtures += fixtures.length
        await supabase
          .from('provider_targets')
          .update({
            events_synced_at: new Date().toISOString(),
            next_synced_at: new Date().toISOString(),
            last_status: `apisports_fixtures:${fixtures.length}`,
            last_error: null,
          })
          .eq('id', target.id)
      } catch (targetError) {
        if (targetError instanceof RateLimited || targetError instanceof BudgetSpent) throw targetError
        await supabase
          .from('provider_targets')
          .update({ last_status: 'apisports_error', last_error: String(targetError) })
          .eq('id', target.id)
      }
    }
  } catch (error) {
    if (error instanceof RateLimited) stopped = 'rate_limited'
    else if (error instanceof BudgetSpent) stopped = 'budget'
    else {
      await supabase
        .from('provider_sync_runs')
        .update({
          status: 'failed',
          error: String(error),
          fetched_count: counters.fixtures,
          changed_count: counters.changed,
          finished_at: new Date().toISOString(),
        })
        .eq('id', run!.id)
      return Response.json({ ok: false, error: String(error), counters }, { status: 500 })
    }
  }

  await supabase
    .from('provider_sync_runs')
    .update({
      status: 'success',
      fetched_count: counters.fixtures,
      changed_count: counters.changed,
      error: stopped === 'done' ? null : `stopped: ${stopped}`,
      finished_at: new Date().toISOString(),
    })
    .eq('id', run!.id)

  return Response.json({ ok: true, stopped, counters })
})
