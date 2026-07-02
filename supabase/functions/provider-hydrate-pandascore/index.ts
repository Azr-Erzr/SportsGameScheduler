// PandaScore esports hydrator (League of Legends, Dota 2, CS, Call of Duty, Rainbow Six Siege).
//
// PandaScore's "Schedules" plan is rate-limited to ~1k requests/hour, so this is intentionally
// frugal: one upcoming-matches call per game per tick (a handful total), paced and budgeted. It
// upserts the same way the other hydrators do — leagues, team competitors, events, participants —
// keyed on provider ids so re-runs are idempotent and only real changes bump a version.
//
// Security: PANDASCORE_TOKEN is read from Supabase secrets and never sent to clients.
// Docs: https://developers.pandascore.co  (auth: Authorization: Bearer <token>)

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const PROVIDER_KEY = 'pandascore'
const SPORT_KEY = 'esports'
const TOKEN = Deno.env.get('PANDASCORE_TOKEN') ?? ''
const BASE = Deno.env.get('PANDASCORE_BASE_URL') ?? 'https://api.pandascore.co'
// PandaScore path slugs. CS2 data is still served under the historical "csgo" path; COD is "codmw".
const GAMES = (Deno.env.get('PANDASCORE_GAMES') ?? 'lol,dota2,csgo,codmw,r6siege').split(',').map((g) => g.trim()).filter(Boolean)
const PER_PAGE = Number(Deno.env.get('PANDASCORE_PER_PAGE') ?? 50)
const CALL_SPACING_MS = Number(Deno.env.get('PANDASCORE_SPACING_MS') ?? 400)
const CALL_BUDGET = Number(Deno.env.get('PANDASCORE_CALL_BUDGET') ?? GAMES.length)

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

class RateLimited extends Error {}
class BudgetSpent extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Counters = { calls: number; games: number; matches: number; changed: number }

type PsTeam = { id: number | null; name: string | null; acronym: string | null; image_url: string | null }
type PsOpponent = { type?: string; opponent?: PsTeam | null }
type PsMatch = {
  id: number
  name: string | null
  scheduled_at: string | null
  begin_at: string | null
  status: string | null
  number_of_games?: number | null
  opponents?: PsOpponent[] | null
  league?: { id?: number | null; name?: string | null; image_url?: string | null; slug?: string | null } | null
  serie?: { id?: number | null; full_name?: string | null; name?: string | null } | null
  tournament?: { id?: number | null; name?: string | null } | null
  videogame?: { id?: number | null; name?: string | null; slug?: string | null } | null
  streams_list?: Array<{ raw_url?: string | null; main?: boolean | null; language?: string | null }> | null
}

async function payloadHash(value: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(value))
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function normalizeStatus(raw: string | null | undefined): string {
  switch ((raw ?? '').toLowerCase()) {
    case 'running':
      return 'live'
    case 'finished':
      return 'finished'
    case 'canceled':
    case 'cancelled':
      return 'cancelled'
    case 'postponed':
      return 'postponed'
    default:
      return 'scheduled'
  }
}

function teamsOf(match: PsMatch): PsTeam[] {
  return (match.opponents ?? [])
    .map((o) => o.opponent)
    .filter((t): t is PsTeam => Boolean(t && t.id && t.name))
}

function titleFor(match: PsMatch): string {
  const teams = teamsOf(match)
  if (teams.length >= 2) return `${teams[0].name} vs ${teams[1].name}`
  if (match.name && match.name.trim()) return match.name.trim()
  return match.league?.name ?? 'Esports match'
}

function startsAtFor(match: PsMatch): { iso: string | null; tbd: boolean } {
  const when = match.begin_at ?? match.scheduled_at
  if (!when) return { iso: null, tbd: true }
  const d = new Date(when)
  return Number.isNaN(d.getTime()) ? { iso: null, tbd: true } : { iso: d.toISOString(), tbd: false }
}

async function api(path: string, counters: Counters): Promise<PsMatch[]> {
  if (counters.calls >= CALL_BUDGET) throw new BudgetSpent()
  await sleep(CALL_SPACING_MS)
  counters.calls += 1
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  })
  if (res.status === 429) throw new RateLimited()
  if (!res.ok) throw new Error(`PandaScore ${path} -> ${res.status}`)
  return (await res.json()) as PsMatch[]
}

async function ensureSportId(): Promise<string> {
  const { data } = await supabase.from('sports').select('id').eq('key', SPORT_KEY).single()
  if (!data) throw new Error(`Sport "${SPORT_KEY}" not seeded — run the esports migration first`)
  return data.id as string
}

async function ensureLeague(sportId: string, match: PsMatch): Promise<string | null> {
  const league = match.league
  if (!league?.id) return null
  const name = league.name ?? match.serie?.full_name ?? 'Esports'
  const { data, error } = await supabase
    .from('leagues')
    .upsert(
      {
        sport_id: sportId,
        provider_key: PROVIDER_KEY,
        provider_league_id: String(league.id),
        name,
        logo_url: league.image_url ?? null,
        is_public: true,
      },
      { onConflict: 'provider_key,provider_league_id' },
    )
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

async function ensureCompetitors(sportId: string, leagueId: string | null, matches: PsMatch[]) {
  const teams = new Map<number, PsTeam>()
  for (const match of matches) for (const team of teamsOf(match)) teams.set(team.id!, team)
  const map = new Map<number, string>()
  if (!teams.size) return map
  await supabase.from('competitors').upsert(
    [...teams.values()].map((team) => ({
      sport_id: sportId,
      league_id: leagueId,
      kind: 'team',
      name: team.name!,
      logo_url: team.image_url ?? null,
      provider_key: PROVIDER_KEY,
      provider_competitor_id: String(team.id),
    })),
    { onConflict: 'provider_key,provider_competitor_id' },
  )
  const ids = [...teams.keys()].map(String)
  const { data } = await supabase
    .from('competitors')
    .select('id, provider_competitor_id')
    .eq('provider_key', PROVIDER_KEY)
    .in('provider_competitor_id', ids)
  for (const row of data ?? []) map.set(Number(row.provider_competitor_id), row.id)
  return map
}

async function replaceParticipants(db: SupabaseClient, eventId: string, homeId?: string, awayId?: string) {
  await db.from('event_competitors').delete().eq('event_id', eventId)
  const rows = []
  if (homeId) rows.push({ event_id: eventId, competitor_id: homeId, role: 'home' })
  if (awayId) rows.push({ event_id: eventId, competitor_id: awayId, role: 'away' })
  if (rows.length) await db.from('event_competitors').insert(rows)
}

async function upsertMatches(sportId: string, game: string, matches: PsMatch[], counters: Counters) {
  if (!matches.length) return
  // Group by league so each event points at the right league row.
  const leagueCache = new Map<string, string | null>()
  const providerIds = matches.map((m) => String(m.id))
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

  // Resolve competitors once across all matches in this game batch.
  const competitorMap = await ensureCompetitors(sportId, null, matches)

  for (const match of matches) {
    const leagueKey = String(match.league?.id ?? '')
    if (!leagueCache.has(leagueKey)) leagueCache.set(leagueKey, await ensureLeague(sportId, match))
    const leagueId = leagueCache.get(leagueKey) ?? null

    const providerEventId = String(match.id)
    const { iso, tbd } = startsAtFor(match)
    const status = normalizeStatus(match.status)
    const title = titleFor(match)
    const teams = teamsOf(match)
    const homeId = teams[0]?.id ? competitorMap.get(teams[0].id!) : undefined
    const awayId = teams[1]?.id ? competitorMap.get(teams[1].id!) : undefined
    const checkedAt = new Date().toISOString()
    const metadata = {
      source: PROVIDER_KEY,
      videogame: match.videogame?.slug ?? game,
      videogame_name: match.videogame?.name ?? null,
      serie: match.serie?.full_name ?? match.serie?.name ?? null,
      tournament: match.tournament?.name ?? null,
      best_of: match.number_of_games ?? null,
      stream: match.streams_list?.find((s) => s.main)?.raw_url ?? match.streams_list?.[0]?.raw_url ?? null,
    }
    const hash = await payloadHash({ title, status, starts_at: iso, starts_at_tbd: tbd, leagueId, homeId, awayId, metadata })
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
          provider_key: PROVIDER_KEY,
          provider_event_id: providerEventId,
          kind: 'match',
          status,
          title,
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
      league_id: leagueId,
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
  if (!TOKEN) return Response.json({ ok: false, error: 'PANDASCORE_TOKEN not configured' }, { status: 500 })

  const body = req.method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {}
  const onlyGames = Array.isArray(body.games) ? (body.games as string[]) : GAMES
  const counters: Counters = { calls: 0, games: 0, matches: 0, changed: 0 }

  const { data: run } = await supabase
    .from('provider_sync_runs')
    .insert({ provider_key: PROVIDER_KEY, sport_key: SPORT_KEY, status: 'running' })
    .select('id')
    .single()

  let stopped: 'budget' | 'rate_limited' | 'done' = 'done'

  try {
    const sportId = await ensureSportId()
    for (const game of onlyGames) {
      try {
        const matches = await api(
          `/${encodeURIComponent(game)}/matches/upcoming?sort=begin_at&per_page=${PER_PAGE}&page=1`,
          counters,
        )
        await upsertMatches(sportId, game, matches, counters)
        counters.games += 1
        counters.matches += matches.length
      } catch (gameError) {
        if (gameError instanceof RateLimited || gameError instanceof BudgetSpent) throw gameError
        // One bad game slug shouldn't abort the rest.
        console.error(`pandascore ${game} failed:`, gameError)
      }
    }
  } catch (error) {
    if (error instanceof RateLimited) stopped = 'rate_limited'
    else if (error instanceof BudgetSpent) stopped = 'budget'
    else {
      await supabase
        .from('provider_sync_runs')
        .update({ status: 'failed', error: String(error), fetched_count: counters.matches, changed_count: counters.changed, finished_at: new Date().toISOString() })
        .eq('id', run!.id)
      return Response.json({ ok: false, error: String(error), counters }, { status: 500 })
    }
  }

  await supabase
    .from('provider_sync_runs')
    .update({
      status: 'success',
      fetched_count: counters.matches,
      changed_count: counters.changed,
      error: stopped === 'done' ? null : `stopped: ${stopped}`,
      finished_at: new Date().toISOString(),
    })
    .eq('id', run!.id)

  return Response.json({ ok: true, stopped, counters })
})
