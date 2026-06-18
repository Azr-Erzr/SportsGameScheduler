// Paced TheSportsDB hydrator (MP3 data-source work; plan Objective 4).
//
// Cron-driven, checkpointed, rate-limit-safe. Each invocation:
//   1. Loads active provider_targets by priority.
//   2. For each, performs the next needed step (verify -> teams -> season events ->
//      next-events delta), spending a bounded API-call budget with fixed spacing.
//   3. Advances that target's cursor columns and records a provider_sync_runs row.
//   4. On HTTP 429 it stops cleanly and resumes on the next tick — never hammers.
//
// Security: the key is read from the THESPORTSDB_API_KEY secret. It never reaches the client.
// Idempotency: every write upserts on provider IDs, so re-runs update, never duplicate.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const API_KEY = Deno.env.get('THESPORTSDB_API_KEY') ?? ''
const BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`

// Premium tier = 100 req/min. ~60 calls/run at 750ms spacing ≈ 80/min ceiling, ~45s wall.
const CALL_BUDGET = Number(Deno.env.get('HYDRATE_CALL_BUDGET') ?? 60)
const CALL_SPACING_MS = Number(Deno.env.get('HYDRATE_SPACING_MS') ?? 750)

const TEAMS_TTL_MS = 7 * 24 * 3600_000
const EVENTS_TTL_MS = 24 * 3600_000
const NEXT_TTL_MS = 60 * 60_000
const VERIFY_TTL_MS = 30 * 24 * 3600_000

const SPORT_FROM_TSDB: Record<string, string> = {
  Soccer: 'soccer',
  Basketball: 'basketball',
  'Ice Hockey': 'hockey',
  'American Football': 'american_football',
  Motorsport: 'motorsport',
  Fighting: 'combat_sports',
  Tennis: 'tennis',
  Golf: 'golf',
  Athletics: 'athletics',
}

function kindForSport(sportKey: string): string {
  if (sportKey === 'motorsport') return 'race'
  if (sportKey === 'combat_sports') return 'fight_card'
  return 'match'
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

class RateLimited extends Error {}
class BudgetSpent extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Counters = { calls: number; leaguesVerified: number; teams: number; events: number; changed: number }

function makeApi(counters: Counters) {
  return async function api(path: string): Promise<Record<string, unknown>> {
    if (counters.calls >= CALL_BUDGET) throw new BudgetSpent()
    await sleep(CALL_SPACING_MS)
    counters.calls += 1
    const res = await fetch(`${BASE}/${path}`)
    if (res.status === 429) throw new RateLimited()
    if (!res.ok) throw new Error(`TheSportsDB ${path} -> ${res.status}`)
    return (await res.json()) as Record<string, unknown>
  }
}

// ---- normalization -------------------------------------------------------

type RawEvent = Record<string, string | null>

function normalizeStatus(raw: string | null | undefined): string {
  const s = (raw ?? '').toLowerCase()
  if (/finish|full time|\bft\b|\baet\b|ended|final/.test(s)) return 'finished'
  if (/postpon/.test(s)) return 'postponed'
  if (/cancel|abandon/.test(s)) return 'cancelled'
  if (/live|in play|1st|2nd|half|quarter|\bq[1-4]\b|\bht\b/.test(s)) return 'live'
  return 'scheduled'
}

function startsAtFor(ev: RawEvent): { iso: string | null; tbd: boolean } {
  if (ev.strTimestamp) return { iso: new Date(ev.strTimestamp).toISOString(), tbd: false }
  if (ev.dateEvent) {
    const time = ev.strTime && ev.strTime !== '00:00:00' ? ev.strTime : '00:00:00'
    const tbd = !ev.strTime || ev.strTime === '00:00:00'
    return { iso: new Date(`${ev.dateEvent}T${time}Z`).toISOString(), tbd }
  }
  return { iso: null, tbd: true }
}

async function payloadHash(value: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(value))
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

// ---- per-step hydration --------------------------------------------------

type Ctx = { sportId: string; sportKey: string; leagueId: string; leagueName: string; targetId: string }

async function ensureSportId(sportKey: string): Promise<string> {
  const { data } = await supabase.from('sports').select('id').eq('key', sportKey).single()
  if (!data) throw new Error(`Unknown sport key ${sportKey}`)
  return data.id
}

async function verifyAndUpsertLeague(
  api: ReturnType<typeof makeApi>,
  target: Target,
  counters: Counters,
): Promise<Ctx | null> {
  const json = await api(`lookupleague.php?id=${target.provider_league_id}`)
  const league = (json.leagues as RawEvent[] | null)?.[0]
  if (!league) {
    await supabase
      .from('provider_targets')
      .update({ last_status: 'verify_failed', last_error: 'lookupleague returned no league', is_active: false })
      .eq('id', target.id)
    return null
  }
  const mappedSport = SPORT_FROM_TSDB[String(league.strSport)]
  if (mappedSport !== target.sport_key) {
    await supabase
      .from('provider_targets')
      .update({
        last_status: 'verify_failed',
        last_error: `sport mismatch: api='${league.strSport}' expected='${target.sport_key}'`,
        is_active: false,
      })
      .eq('id', target.id)
    return null
  }

  const sportId = await ensureSportId(target.sport_key)
  const leagueName = String(league.strLeague ?? target.expected_name)
  const { data: upserted, error } = await supabase
    .from('leagues')
    .upsert(
      {
        sport_id: sportId,
        provider_key: 'thesportsdb',
        provider_league_id: target.provider_league_id,
        name: leagueName,
        short_name: (league.strLeagueAlternate as string) ?? null,
        country: (league.strCountry as string) ?? null,
        logo_url: (league.strBadge as string) ?? (league.strLogo as string) ?? null,
        is_public: true,
      },
      { onConflict: 'provider_key,provider_league_id' },
    )
    .select('id')
    .single()
  if (error) throw error

  counters.leaguesVerified += 1
  await supabase
    .from('provider_targets')
    .update({ verified_at: new Date().toISOString(), last_status: 'verified', last_error: null })
    .eq('id', target.id)
  return { sportId, sportKey: target.sport_key, leagueId: upserted.id, leagueName, targetId: target.id }
}

async function loadCtx(target: Target): Promise<Ctx | null> {
  const { data: league } = await supabase
    .from('leagues')
    .select('id, sport_id, name')
    .eq('provider_key', 'thesportsdb')
    .eq('provider_league_id', target.provider_league_id)
    .maybeSingle()
  if (!league) return null
  return { sportId: league.sport_id, sportKey: target.sport_key, leagueId: league.id, leagueName: league.name, targetId: target.id }
}

async function ensureCompetitors(ctx: Ctx, rows: Array<{ id: string; name: string; badge?: string | null; country?: string | null }>) {
  if (!rows.length) return new Map<string, string>()
  const payload = rows.map((r) => ({
    sport_id: ctx.sportId,
    league_id: ctx.leagueId,
    kind: 'team',
    name: r.name,
    logo_url: r.badge ?? null,
    country: r.country ?? null,
    provider_key: 'thesportsdb',
    provider_competitor_id: r.id,
  }))
  await supabase.from('competitors').upsert(payload, { onConflict: 'provider_key,provider_competitor_id' })
  const ids = rows.map((r) => r.id)
  const map = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from('competitors')
      .select('id, provider_competitor_id')
      .eq('provider_key', 'thesportsdb')
      .in('provider_competitor_id', ids.slice(i, i + 200))
    for (const c of data ?? []) map.set(c.provider_competitor_id, c.id)
  }
  return map
}

async function ensureVenues(names: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(names.filter(Boolean))]
  const map = new Map<string, string>()
  if (!unique.length) return map
  await supabase.from('venues').upsert(unique.map((name) => ({ name })), { onConflict: 'name' })
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await supabase.from('venues').select('id, name').in('name', unique.slice(i, i + 200))
    for (const v of data ?? []) map.set(v.name, v.id)
  }
  return map
}

async function upsertEvents(ctx: Ctx, raw: RawEvent[], counters: Counters) {
  if (!raw.length) return

  const teamRows = new Map<string, { id: string; name: string }>()
  for (const ev of raw) {
    if (ev.idHomeTeam && ev.strHomeTeam) teamRows.set(ev.idHomeTeam, { id: ev.idHomeTeam, name: ev.strHomeTeam })
    if (ev.idAwayTeam && ev.strAwayTeam) teamRows.set(ev.idAwayTeam, { id: ev.idAwayTeam, name: ev.strAwayTeam })
  }
  const competitorMap = await ensureCompetitors(ctx, [...teamRows.values()])
  const venueMap = await ensureVenues(raw.map((ev) => ev.strVenue ?? '').filter(Boolean) as string[])

  const pids = raw.map((ev) => ev.idEvent!).filter(Boolean)
  const existing = new Map<
    string,
    { id: string; title: string; status: string; starts_at: string | null; version: number; payload_hash: string | null }
  >()
  for (let i = 0; i < pids.length; i += 200) {
    const { data } = await supabase
      .from('events')
      .select('id, provider_event_id, title, status, starts_at, version, payload_hash')
      .eq('provider_key', 'thesportsdb')
      .in('provider_event_id', pids.slice(i, i + 200))
    for (const e of data ?? []) existing.set(e.provider_event_id, e)
  }

  const kind = kindForSport(ctx.sportKey)
  const toInsert: Array<Record<string, unknown>> = []
  const inserts: Array<{ pid: string; home?: string; away?: string }> = []

  for (const ev of raw) {
    if (!ev.idEvent) continue
    const { iso, tbd } = startsAtFor(ev)
    const status = normalizeStatus(ev.strStatus ?? ev.strPostponed)
    const title = ev.strEvent ?? `${ev.strHomeTeam ?? ''} vs ${ev.strAwayTeam ?? ''}`.trim()
    const prior = existing.get(ev.idEvent)
    const homeId = ev.idHomeTeam ? competitorMap.get(ev.idHomeTeam) : undefined
    const awayId = ev.idAwayTeam ? competitorMap.get(ev.idAwayTeam) : undefined
    const metadata = { round: ev.intRound ?? null, season: ev.strSeason ?? null, source: 'thesportsdb' }
    const checkedAt = new Date().toISOString()
    const hash = await payloadHash({
      title,
      status,
      starts_at: iso,
      starts_at_tbd: tbd,
      venue: ev.strVenue ?? null,
      home_provider_id: ev.idHomeTeam ?? null,
      away_provider_id: ev.idAwayTeam ?? null,
      metadata,
    })

    if (!prior) {
      toInsert.push({
        sport_id: ctx.sportId,
        league_id: ctx.leagueId,
        venue_id: ev.strVenue ? venueMap.get(ev.strVenue) ?? null : null,
        provider_key: 'thesportsdb',
        provider_event_id: ev.idEvent,
        kind,
        status,
        title,
        short_title: (ev.strEventAlternate as string) ?? null,
        starts_at: iso,
        starts_at_tbd: tbd,
        visibility: 'public',
        home_competitor_id: homeId ?? null,
        away_competitor_id: awayId ?? null,
        metadata,
        payload_hash: hash,
        last_checked_at: checkedAt,
        source_confidence: 'provider',
      })
      inserts.push({ pid: ev.idEvent, home: homeId, away: awayId })
      counters.events += 1
    } else {
      if (prior.payload_hash === hash) {
        await supabase.from('events').update({ last_checked_at: checkedAt }).eq('id', prior.id)
        continue
      }
      const visibleChange = prior.title !== title || prior.status !== status || prior.starts_at !== iso
      if (!visibleChange) {
        await supabase
          .from('events')
          .update({
            payload_hash: hash,
            last_checked_at: checkedAt,
            metadata,
            venue_id: ev.strVenue ? venueMap.get(ev.strVenue) ?? null : null,
          })
          .eq('id', prior.id)
        continue
      }
      const timingChange = prior.starts_at !== iso || prior.status !== status
      await supabase
        .from('events')
        .update({
          title,
          status,
          starts_at: iso,
          starts_at_tbd: tbd,
          venue_id: ev.strVenue ? venueMap.get(ev.strVenue) ?? null : null,
          version: prior.version + 1,
          updated_at: checkedAt,
          last_checked_at: checkedAt,
          payload_hash: hash,
          source_confidence: 'provider',
          metadata,
        })
        .eq('id', prior.id)
      if (timingChange) {
        await supabase.from('event_status_history').insert({
          event_id: prior.id,
          old_status: prior.status,
          new_status: status,
          old_starts_at: prior.starts_at,
          new_starts_at: iso,
          source: 'thesportsdb',
        })
      }
      counters.changed += 1
    }
  }

  // Batch-insert new events, then their participation rows.
  for (let i = 0; i < toInsert.length; i += 250) {
    const chunk = toInsert.slice(i, i + 250)
    const { data, error } = await supabase.from('events').insert(chunk).select('id, provider_event_id')
    if (error) throw error
    const idByPid = new Map((data ?? []).map((e) => [e.provider_event_id, e.id]))
    const links: Array<Record<string, unknown>> = []
    for (const ins of inserts) {
      const eventId = idByPid.get(ins.pid)
      if (!eventId) continue
      if (ins.home) links.push({ event_id: eventId, competitor_id: ins.home, role: 'home' })
      if (ins.away) links.push({ event_id: eventId, competitor_id: ins.away, role: 'away' })
    }
    for (let j = 0; j < links.length; j += 500) {
      await supabase.from('event_competitors').insert(links.slice(j, j + 500))
    }
  }
}

// ---- target / run types --------------------------------------------------

type Target = {
  id: string
  provider_league_id: string
  sport_key: string
  expected_name: string
  current_season: string | null
  verified_at: string | null
  teams_synced_at: string | null
  events_synced_at: string | null
  next_synced_at: string | null
}

function stale(ts: string | null, ttl: number, now: number) {
  return !ts || now - new Date(ts).getTime() > ttl
}

Deno.serve(async () => {
  if (!API_KEY) {
    return Response.json({ ok: false, error: 'THESPORTSDB_API_KEY not configured' }, { status: 500 })
  }

  const counters: Counters = { calls: 0, leaguesVerified: 0, teams: 0, events: 0, changed: 0 }
  const api = makeApi(counters)
  const now = Date.now()

  const { data: run } = await supabase
    .from('provider_sync_runs')
    .insert({ provider_key: 'thesportsdb', sport_key: 'multi', status: 'running' })
    .select('id')
    .single()

  const { data: targets } = await supabase
    .from('provider_targets')
    .select('id, provider_league_id, sport_key, expected_name, current_season, verified_at, teams_synced_at, events_synced_at, next_synced_at')
    .eq('provider_key', 'thesportsdb')
    .eq('is_active', true)
    .order('priority', { ascending: true })

  let stopped: 'budget' | 'rate_limited' | 'done' = 'done'

  try {
    for (const target of (targets ?? []) as Target[]) {
     try {
      // 1. Verify + upsert league.
      let ctx: Ctx | null
      if (stale(target.verified_at, VERIFY_TTL_MS, now)) {
        ctx = await verifyAndUpsertLeague(api, target, counters)
        if (!ctx) continue // verify failed; deactivated, move on
      } else {
        ctx = await loadCtx(target)
        if (!ctx) {
          ctx = await verifyAndUpsertLeague(api, target, counters)
          if (!ctx) continue
        }
      }

      // 2. Teams + badges + stadiums. Current API uses search_all_teams.php?l={leagueName}
      // (the id-based lookup_all_teams.php 404s); we have the verified name from step 1.
      if (stale(target.teams_synced_at, TEAMS_TTL_MS, now)) {
        const json = await api(`search_all_teams.php?l=${encodeURIComponent(ctx.leagueName)}`)
        const teams = (json.teams as RawEvent[] | null) ?? []
        await ensureCompetitors(
          ctx,
          teams.filter((t) => t.idTeam && t.strTeam).map((t) => ({
            id: t.idTeam!,
            name: t.strTeam!,
            badge: t.strBadge,
            country: t.strCountry,
          })),
        )
        await ensureVenues(teams.map((t) => t.strStadium ?? '').filter(Boolean) as string[])
        counters.teams += teams.length
        await supabase
          .from('provider_targets')
          .update({ teams_synced_at: new Date().toISOString(), last_status: 'teams_synced' })
          .eq('id', target.id)
      }

      // 3. Full season events (the bulk; one API call per league-season).
      if (stale(target.events_synced_at, EVENTS_TTL_MS, now)) {
        const season = target.current_season ?? ''
        const json = await api(`eventsseason.php?id=${target.provider_league_id}&s=${encodeURIComponent(season)}`)
        const events = (json.events as RawEvent[] | null) ?? []
        if (events.length) {
          await upsertEvents(ctx, events, counters)
          await supabase
            .from('provider_targets')
            .update({ events_synced_at: new Date().toISOString(), last_status: `season_synced:${events.length}` })
            .eq('id', target.id)
        } else {
          // Season string empty/wrong — fall back to upcoming-events delta so the league
          // still gets data, and mark it so we don't loop on the empty season.
          const nextJson = await api(`eventsnextleague.php?id=${target.provider_league_id}`)
          const nextEvents = (nextJson.events as RawEvent[] | null) ?? []
          await upsertEvents(ctx, nextEvents, counters)
          await supabase
            .from('provider_targets')
            .update({
              events_synced_at: new Date().toISOString(),
              next_synced_at: new Date().toISOString(),
              last_status: `season_empty_used_next:${nextEvents.length}`,
            })
            .eq('id', target.id)
        }
      } else if (stale(target.next_synced_at, NEXT_TTL_MS, now)) {
        // 4. Warm delta: just the next upcoming fixtures (cheap, catches time/status changes).
        const json = await api(`eventsnextleague.php?id=${target.provider_league_id}`)
        const events = (json.events as RawEvent[] | null) ?? []
        await upsertEvents(ctx, events, counters)
        await supabase
          .from('provider_targets')
          .update({ next_synced_at: new Date().toISOString(), last_status: `next_synced:${events.length}` })
          .eq('id', target.id)
      }
     } catch (targetError) {
       // One league's bad endpoint/data must not abort the whole batch — record and move on.
       if (targetError instanceof RateLimited || targetError instanceof BudgetSpent) throw targetError
       await supabase
         .from('provider_targets')
         .update({ last_status: 'error', last_error: String(targetError) })
         .eq('id', target.id)
     }
    }
  } catch (error) {
    if (error instanceof RateLimited) stopped = 'rate_limited'
    else if (error instanceof BudgetSpent) stopped = 'budget'
    else {
      await supabase
        .from('provider_sync_runs')
        .update({ status: 'failed', error: String(error), fetched_count: counters.events, changed_count: counters.changed, finished_at: new Date().toISOString() })
        .eq('id', run!.id)
      return Response.json({ ok: false, error: String(error), counters }, { status: 500 })
    }
  }

  await supabase
    .from('provider_sync_runs')
    .update({
      status: 'success',
      fetched_count: counters.events,
      changed_count: counters.changed,
      error: stopped === 'done' ? null : `stopped: ${stopped}`,
      finished_at: new Date().toISOString(),
    })
    .eq('id', run!.id)

  return Response.json({ ok: true, stopped, counters })
})
