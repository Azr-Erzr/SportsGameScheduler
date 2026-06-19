// Paced API-Sports/API-Formula-1 hydrator.
//
// Uses the shared APISPORTS_KEY secret. The free plan is enough for a low-frequency
// F1 schedule pilot: one races-by-season call hydrates the current Formula 1 calendar.

import { createClient } from 'npm:@supabase/supabase-js@2'

const PROVIDER_KEY = 'apisports_formula1'
const API_KEY = Deno.env.get('APISPORTS_KEY') ?? ''
const BASE = Deno.env.get('APISPORTS_FORMULA1_BASE_URL') ?? 'https://v1.formula-1.api-sports.io'
const CALL_BUDGET = Number(Deno.env.get('APISPORTS_F1_CALL_BUDGET') ?? 3)
const CALL_SPACING_MS = Number(Deno.env.get('APISPORTS_F1_SPACING_MS') ?? 1200)
const EVENTS_TTL_MS = Number(Deno.env.get('APISPORTS_F1_EVENTS_TTL_HOURS') ?? 24) * 3600_000

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

class RateLimited extends Error {}
class BudgetSpent extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Counters = { calls: number; targets: number; races: number; changed: number }
type Target = {
  id: string
  provider_league_id: string
  sport_key: string
  expected_name: string
  current_season: string | null
  events_synced_at: string | null
}

type ApiRace = {
  id: number
  competition?: {
    id?: number | null
    name?: string | null
    location?: { country?: string | null; city?: string | null }
  }
  circuit?: { id?: number | null; name?: string | null; image?: string | null }
  season?: number | string | null
  type?: string | null
  laps?: { current?: number | null; total?: number | null }
  distance?: string | null
  timezone?: string | null
  date?: string | null
  weather?: string | null
  status?: string | null
}

type ApiEnvelope = Record<string, unknown> & {
  errors?: unknown
  results?: number
  response?: ApiRace[] | null
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

function normalizeStatus(raw?: string | null): string {
  const status = (raw ?? '').toLowerCase()
  if (/completed|finished|final|ended/.test(status)) return 'finished'
  if (/cancel|abandon/.test(status)) return 'cancelled'
  if (/postpon/.test(status)) return 'postponed'
  if (/live|progress|running/.test(status)) return 'live'
  return 'scheduled'
}

function titleFor(race: ApiRace) {
  const name = race.competition?.name?.trim()
  const eventName = name ? (/grand prix|gp/i.test(name) ? name : `${name} Grand Prix`) : 'Formula 1 race'
  const sessionType = race.type?.trim()
  return sessionType ? `${eventName} - ${sessionType}` : eventName
}

async function api(path: string, counters: Counters): Promise<Record<string, unknown>> {
  if (counters.calls >= CALL_BUDGET) throw new BudgetSpent()
  await sleep(CALL_SPACING_MS)
  counters.calls += 1
  const res = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': API_KEY } })
  if (res.status === 429) throw new RateLimited()
  if (!res.ok) throw new Error(`API-Sports F1 ${path} -> ${res.status}`)
  return (await res.json()) as Record<string, unknown>
}

function apiErrors(value: unknown): string | null {
  if (!value) return null
  if (Array.isArray(value) && value.length === 0) return null
  if (typeof value === 'object' && Object.keys(value).length === 0) return null
  return JSON.stringify(value)
}

async function ensureSportId(): Promise<string> {
  const { data } = await supabase.from('sports').select('id').eq('key', 'motorsport').single()
  if (!data) throw new Error('Unknown sport key motorsport')
  return data.id
}

async function ensureLeague(sportId: string) {
  const { data, error } = await supabase
    .from('leagues')
    .upsert(
      {
        sport_id: sportId,
        provider_key: PROVIDER_KEY,
        provider_league_id: 'f1',
        name: 'Formula 1',
        short_name: 'F1',
        is_public: true,
      },
      { onConflict: 'provider_key,provider_league_id' },
    )
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

async function ensureVenues(races: ApiRace[]) {
  const names = [
    ...new Set(races.map((race) => race.circuit?.name).filter((name): name is string => Boolean(name))),
  ]
  const map = new Map<string, string>()
  if (!names.length) return map
  await supabase.from('venues').upsert(
    names.map((name) => {
      const race = races.find((candidate) => candidate.circuit?.name === name)
      return {
        name,
        city: race?.competition?.location?.city ?? null,
        country: race?.competition?.location?.country ?? null,
        timezone: race?.timezone ?? null,
      }
    }),
    { onConflict: 'name' },
  )
  const { data } = await supabase.from('venues').select('id, name').in('name', names)
  for (const venue of data ?? []) map.set(venue.name, venue.id)
  return map
}

async function upsertRaces(target: Target, races: ApiRace[], counters: Counters) {
  if (!races.length) return
  const sportId = await ensureSportId()
  const leagueId = await ensureLeague(sportId)
  const venueMap = await ensureVenues(races)
  const providerIds = races.map((race) => String(race.id))

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

  for (const race of races) {
    const providerEventId = String(race.id)
    const title = titleFor(race)
    const status = normalizeStatus(race.status)
    const startsAt = race.date ? new Date(race.date).toISOString() : null
    const checkedAt = new Date().toISOString()
    const metadata = {
      source: PROVIDER_KEY,
      season: race.season ?? target.current_season,
      type: race.type ?? null,
      competition: race.competition ?? null,
      circuit: race.circuit ?? null,
      laps: race.laps ?? null,
      distance: race.distance ?? null,
      weather: race.weather ?? null,
    }
    const hash = await payloadHash({
      title,
      status,
      starts_at: startsAt,
      timezone: race.timezone ?? null,
      venue: race.circuit?.name ?? null,
      metadata,
    })
    const prior = existing.get(providerEventId)

    if (!prior) {
      const { error } = await supabase.from('events').insert({
        sport_id: sportId,
        league_id: leagueId,
        venue_id: race.circuit?.name ? venueMap.get(race.circuit.name) ?? null : null,
        provider_key: PROVIDER_KEY,
        provider_event_id: providerEventId,
        kind: 'race',
        status,
        title,
        starts_at: startsAt,
        starts_at_tbd: !startsAt,
        timezone: race.timezone ?? null,
        visibility: 'public',
        metadata,
        payload_hash: hash,
        last_checked_at: checkedAt,
        source_confidence: 'provider',
      })
      if (error) throw error
      counters.changed += 1
      continue
    }

    if (prior.payload_hash === hash) {
      await supabase.from('events').update({ last_checked_at: checkedAt }).eq('id', prior.id)
      continue
    }

    const visibleChange = prior.title !== title || prior.status !== status || prior.starts_at !== startsAt
    const updatePayload: Record<string, unknown> = {
      title,
      status,
      starts_at: startsAt,
      starts_at_tbd: !startsAt,
      timezone: race.timezone ?? null,
      venue_id: race.circuit?.name ? venueMap.get(race.circuit.name) ?? null : null,
      metadata,
      version: visibleChange ? prior.version + 1 : prior.version,
      last_checked_at: checkedAt,
      payload_hash: hash,
      source_confidence: 'provider',
    }
    if (visibleChange) updatePayload.updated_at = checkedAt

    await supabase.from('events').update(updatePayload).eq('id', prior.id)
    if (prior.starts_at !== startsAt || prior.status !== status) {
      await supabase.from('event_status_history').insert({
        event_id: prior.id,
        old_status: prior.status,
        new_status: status,
        old_starts_at: prior.starts_at,
        new_starts_at: startsAt,
        source: PROVIDER_KEY,
      })
    }
    counters.changed += 1
  }
}

Deno.serve(async (req) => {
  if (!API_KEY) return Response.json({ ok: false, error: 'APISPORTS_KEY not configured' }, { status: 500 })

  const body = req.method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {}
  const force = body.force === true
  const seasonOverride = typeof body.season === 'string' ? body.season : null
  const counters: Counters = { calls: 0, targets: 0, races: 0, changed: 0 }
  const now = Date.now()

  const { data: run } = await supabase
    .from('provider_sync_runs')
    .insert({ provider_key: PROVIDER_KEY, sport_key: 'motorsport', status: 'running' })
    .select('id')
    .single()

  let stopped: 'budget' | 'rate_limited' | 'done' = 'done'

  try {
    const { data: targets, error } = await supabase
      .from('provider_targets')
      .select('id, provider_league_id, sport_key, expected_name, current_season, events_synced_at')
      .eq('provider_key', PROVIDER_KEY)
      .eq('is_active', true)
      .order('priority', { ascending: true })
    if (error) throw error

    for (const target of (targets ?? []) as Target[]) {
      if (!force && !stale(target.events_synced_at, EVENTS_TTL_MS, now)) continue
      try {
        const season = seasonOverride ?? target.current_season ?? new Date().getUTCFullYear().toString()
        const seasons = [season]
        const previousSeason = String(Number(season) - 1)
        if (!seasonOverride && Number.isFinite(Number(previousSeason))) seasons.push(previousSeason)

        let races: ApiRace[] = []
        let usedSeason = season
        let providerError: string | null = null
        let providerResults: number | null = null

        for (const candidateSeason of seasons) {
          const json = (await api(`/races?season=${encodeURIComponent(candidateSeason)}`, counters)) as ApiEnvelope
          providerError = apiErrors(json.errors)
          providerResults = typeof json.results === 'number' ? json.results : null
          if (providerError) throw new Error(`API-Sports F1 error: ${providerError}`)
          races = json.response ?? []
          usedSeason = candidateSeason
          if (races.length || seasonOverride) break
        }

        await upsertRaces(target, races, counters)
        counters.targets += 1
        counters.races += races.length
        await supabase
          .from('provider_targets')
          .update({
            events_synced_at: new Date().toISOString(),
            next_synced_at: new Date().toISOString(),
            last_status: `apisports_f1_races:${usedSeason}:${races.length}:results:${providerResults ?? 'unknown'}`,
            last_error: null,
          })
          .eq('id', target.id)
      } catch (targetError) {
        if (targetError instanceof RateLimited || targetError instanceof BudgetSpent) throw targetError
        await supabase
          .from('provider_targets')
          .update({ last_status: 'apisports_f1_error', last_error: String(targetError) })
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
          fetched_count: counters.races,
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
      fetched_count: counters.races,
      changed_count: counters.changed,
      error: stopped === 'done' ? null : `stopped: ${stopped}`,
      finished_at: new Date().toISOString(),
    })
    .eq('id', run!.id)

  return Response.json({ ok: true, stopped, counters })
})
