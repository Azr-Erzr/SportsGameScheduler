// OpenF1 schedule/session hydrator.
//
// OpenF1 gives us F1 meetings and sessions with no key for historical/schedule data.
// Realtime timing feeds are intentionally not used here because OpenF1 gates realtime
// access behind a paid subscription and those endpoints are too high-volume for this job.

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  findCandidateEvent,
  findLinkedEvent,
  linkExternalId,
  payloadHash,
  upsertProviderEventSource,
} from '../_shared/provider-reconcile.ts'

const PROVIDER_KEY = 'openf1'
const SPORT_KEY = 'motorsport'
const PROVIDER_LEAGUE_ID = 'f1'
const BASE = Deno.env.get('OPENF1_BASE_URL') ?? 'https://api.openf1.org/v1'
const CALL_BUDGET = Number(Deno.env.get('OPENF1_CALL_BUDGET') ?? 6)
const CALL_SPACING_MS = Number(Deno.env.get('OPENF1_SPACING_MS') ?? 250)
const EVENTS_TTL_MS = Number(Deno.env.get('OPENF1_EVENTS_TTL_HOURS') ?? 24) * 3600_000

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

class BudgetSpent extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Counters = {
  calls: number
  targets: number
  meetings: number
  sessions: number
  inserted: number
  linked: number
  changed: number
  drivers: number
}

type Target = {
  id: string
  current_season: string | null
  events_synced_at: string | null
}

type OpenF1Meeting = {
  meeting_key: number
  meeting_name?: string | null
  meeting_official_name?: string | null
  location?: string | null
  country_code?: string | null
  country_name?: string | null
  country_flag?: string | null
  circuit_key?: number | null
  circuit_short_name?: string | null
  circuit_type?: string | null
  circuit_info_url?: string | null
  circuit_image?: string | null
  gmt_offset?: string | null
  date_start?: string | null
  date_end?: string | null
  year?: number | null
  is_cancelled?: boolean | null
}

type OpenF1Session = {
  session_key: number
  session_type?: string | null
  session_name?: string | null
  date_start?: string | null
  date_end?: string | null
  meeting_key?: number | null
  circuit_key?: number | null
  circuit_short_name?: string | null
  country_code?: string | null
  country_name?: string | null
  location?: string | null
  gmt_offset?: string | null
  year?: number | null
  is_cancelled?: boolean | null
}

type OpenF1Driver = {
  driver_number: number
  broadcast_name?: string | null
  first_name?: string | null
  full_name?: string | null
  headshot_url?: string | null
  last_name?: string | null
  name_acronym?: string | null
  team_colour?: string | null
  team_name?: string | null
  session_key?: number | string | null
}

function stale(ts: string | null, ttl: number, now: number) {
  return !ts || now - new Date(ts).getTime() > ttl
}

async function api<T>(path: string, counters: Counters): Promise<T> {
  if (counters.calls >= CALL_BUDGET) throw new BudgetSpent()
  await sleep(CALL_SPACING_MS)
  counters.calls += 1
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`OpenF1 ${path} -> ${res.status}`)
  return (await res.json()) as T
}

function toIso(value: string | null | undefined) {
  return value ? new Date(value).toISOString() : null
}

function statusFor(session: OpenF1Session, now = Date.now()) {
  if (session.is_cancelled) return 'cancelled'
  const end = session.date_end ? new Date(session.date_end).getTime() : null
  const start = session.date_start ? new Date(session.date_start).getTime() : null
  if (end && end < now) return 'finished'
  if (start && end && start <= now && end >= now) return 'live'
  return 'scheduled'
}

function titleFor(session: OpenF1Session, meeting?: OpenF1Meeting) {
  const meetingName = meeting?.meeting_name?.trim() || session.country_name?.trim() || 'Formula 1'
  const sessionName = session.session_name?.trim() || session.session_type?.trim() || 'Session'
  return `${meetingName} - ${sessionName}`
}

async function ensureSportId(): Promise<string> {
  const { data } = await supabase.from('sports').select('id').eq('key', SPORT_KEY).single()
  if (!data) throw new Error(`Unknown sport key ${SPORT_KEY}`)
  return data.id
}

async function ensureLeague(sportId: string): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from('leagues')
    .select('id')
    .eq('sport_id', sportId)
    .or('name.eq.Formula 1,short_name.eq.F1')
    .order('display_rank', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing?.id) return existing.id

  const { data, error } = await supabase
    .from('leagues')
    .upsert(
      {
        sport_id: sportId,
        provider_key: PROVIDER_KEY,
        provider_league_id: PROVIDER_LEAGUE_ID,
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

async function ensureVenues(sessions: OpenF1Session[], meetings: Map<number, OpenF1Meeting>) {
  const venueRows = new Map<string, { name: string; city: string | null; country: string | null; timezone: string | null }>()
  for (const session of sessions) {
    const meeting = session.meeting_key ? meetings.get(session.meeting_key) : undefined
    const name = session.circuit_short_name ?? meeting?.circuit_short_name
    if (!name) continue
    venueRows.set(name, {
      name,
      city: session.location ?? meeting?.location ?? null,
      country: session.country_name ?? meeting?.country_name ?? null,
      timezone: session.gmt_offset ?? meeting?.gmt_offset ?? null,
    })
  }

  const map = new Map<string, string>()
  if (!venueRows.size) return map

  const { error: upsertError } = await supabase.from('venues').upsert([...venueRows.values()], { onConflict: 'name' })
  if (upsertError) throw upsertError
  const { data, error } = await supabase.from('venues').select('id, name').in('name', [...venueRows.keys()])
  if (error) throw error
  for (const venue of data ?? []) map.set(venue.name, venue.id)
  return map
}

async function hydrateDrivers(latestSessionKey: number | string | null, sportId: string, leagueId: string, counters: Counters) {
  if (!latestSessionKey) return
  const drivers = await api<OpenF1Driver[]>(
    `/drivers?session_key=${encodeURIComponent(String(latestSessionKey))}`,
    counters,
  )
  if (!drivers.length) return

  const { error } = await supabase.from('competitors').upsert(
    drivers
      .filter((driver) => driver.driver_number && (driver.full_name || driver.broadcast_name))
      .map((driver) => ({
        sport_id: sportId,
        league_id: leagueId,
        kind: 'person',
        name: driver.full_name ?? driver.broadcast_name!,
        short_name: driver.name_acronym ?? null,
        logo_url: driver.headshot_url ?? null,
        provider_key: PROVIDER_KEY,
        provider_competitor_id: String(driver.driver_number),
        theme: {
          source: PROVIDER_KEY,
          team_name: driver.team_name ?? null,
          team_colour: driver.team_colour ?? null,
          image_rights: 'provider_url',
        },
      })),
    { onConflict: 'provider_key,provider_competitor_id' },
  )
  if (error) throw error
  counters.drivers += drivers.length
}

async function upsertSessions(
  target: Target,
  sessions: OpenF1Session[],
  meetings: Map<number, OpenF1Meeting>,
  counters: Counters,
) {
  if (!sessions.length) return
  const sportId = await ensureSportId()
  const leagueId = await ensureLeague(sportId)
  const venueMap = await ensureVenues(sessions, meetings)
  const now = Date.now()

  for (const session of sessions) {
    const externalId = String(session.session_key)
    const meeting = session.meeting_key ? meetings.get(session.meeting_key) : undefined
    const title = titleFor(session, meeting)
    const status = statusFor(session, now)
    const startsAt = toIso(session.date_start)
    const venueId = session.circuit_short_name ? venueMap.get(session.circuit_short_name) ?? null : null
    const metadata = {
      source: PROVIDER_KEY,
      provider_league_id: PROVIDER_LEAGUE_ID,
      session_key: session.session_key,
      session_name: session.session_name ?? null,
      session_type: session.session_type ?? null,
      meeting_key: session.meeting_key ?? null,
      meeting_name: meeting?.meeting_name ?? null,
      meeting_official_name: meeting?.meeting_official_name ?? null,
      circuit_key: session.circuit_key ?? meeting?.circuit_key ?? null,
      circuit_short_name: session.circuit_short_name ?? meeting?.circuit_short_name ?? null,
      circuit_type: meeting?.circuit_type ?? null,
      circuit_info_url: meeting?.circuit_info_url ?? null,
      circuit_image: meeting?.circuit_image ?? null,
      country_code: session.country_code ?? meeting?.country_code ?? null,
      country_name: session.country_name ?? meeting?.country_name ?? null,
      country_flag: meeting?.country_flag ?? null,
      date_end: toIso(session.date_end),
      gmt_offset: session.gmt_offset ?? meeting?.gmt_offset ?? null,
      is_cancelled: session.is_cancelled ?? false,
      year: session.year ?? meeting?.year ?? target.current_season,
    }
    const hash = await payloadHash({ title, status, startsAt, venueId, metadata })
    const linked = await findLinkedEvent(supabase, PROVIDER_KEY, externalId)
    const candidate =
      linked ??
      (await findCandidateEvent(supabase, {
        sportId,
        leagueId,
        venueId,
        title,
        startsAt,
        windowHours: 14,
        metadataNeedles: [
          session.session_name,
          session.session_type,
          session.circuit_short_name,
          session.country_name,
          meeting?.meeting_name,
        ],
      }))

    if (!candidate) {
      if (startsAt && new Date(startsAt).getTime() < Date.now() - 30 * 24 * 3600_000) continue
      const { data: inserted, error } = await supabase
        .from('events')
        .insert({
          sport_id: sportId,
          league_id: leagueId,
          venue_id: venueId,
          provider_key: PROVIDER_KEY,
          provider_event_id: externalId,
          kind: 'race',
          status,
          title,
          starts_at: startsAt,
          starts_at_tbd: !startsAt,
          timezone: session.gmt_offset ?? meeting?.gmt_offset ?? null,
          visibility: 'public',
          metadata,
          payload_hash: hash,
          last_checked_at: new Date().toISOString(),
          source_confidence: 'provider',
        })
        .select('id')
        .single()
      if (error) throw error
      await linkExternalId(supabase, {
        eventId: inserted.id,
        providerKey: PROVIDER_KEY,
        externalId,
        rawUid: session.meeting_key ? String(session.meeting_key) : null,
        payloadHash: hash,
        metadata,
      })
      await upsertProviderEventSource(supabase, {
        eventId: inserted.id,
        providerKey: PROVIDER_KEY,
        externalId,
        sportKey: SPORT_KEY,
        providerLeagueId: PROVIDER_LEAGUE_ID,
        title,
        startsAt,
        status,
        payloadHash: hash,
        rawPayload: session,
        metadata,
      })
      counters.inserted += 1
      counters.changed += 1
      continue
    }

    await linkExternalId(supabase, {
      eventId: candidate.id,
      providerKey: PROVIDER_KEY,
      externalId,
      rawUid: session.meeting_key ? String(session.meeting_key) : null,
      matchConfidence: candidate.matchConfidence,
      payloadHash: hash,
      metadata,
    })
    await upsertProviderEventSource(supabase, {
      eventId: candidate.id,
      providerKey: PROVIDER_KEY,
      externalId,
      sportKey: SPORT_KEY,
      providerLeagueId: PROVIDER_LEAGUE_ID,
      title,
      startsAt,
      status,
      matchConfidence: candidate.matchConfidence,
      payloadHash: hash,
      rawPayload: session,
      metadata,
    })

    if (candidate.provider_key === PROVIDER_KEY && candidate.payload_hash !== hash) {
      const visibleChange = candidate.title !== title || candidate.status !== status || candidate.starts_at !== startsAt
      const updatePayload: Record<string, unknown> = {
        title,
        status,
        starts_at: startsAt,
        starts_at_tbd: !startsAt,
        timezone: session.gmt_offset ?? meeting?.gmt_offset ?? null,
        venue_id: venueId,
        metadata,
        payload_hash: hash,
        last_checked_at: new Date().toISOString(),
        version: visibleChange ? candidate.version + 1 : candidate.version,
      }
      if (visibleChange) updatePayload.updated_at = new Date().toISOString()
      const { error: updateError } = await supabase.from('events').update(updatePayload).eq('id', candidate.id)
      if (updateError) throw updateError
      if (visibleChange) {
        await supabase.from('event_status_history').insert({
          event_id: candidate.id,
          old_status: candidate.status,
          new_status: status,
          old_starts_at: candidate.starts_at,
          new_starts_at: startsAt,
          source: PROVIDER_KEY,
        })
      }
      counters.changed += 1
    } else {
      await supabase
        .from('events')
        .update({
          last_checked_at: new Date().toISOString(),
          metadata: {
            ...(candidate.metadata ?? {}),
            openf1: metadata,
          },
        })
        .eq('id', candidate.id)
      counters.linked += 1
    }
  }

  const latestSession = [...sessions]
    .filter((session) => session.date_start && new Date(session.date_start).getTime() <= now)
    .sort((a, b) => new Date(b.date_start!).getTime() - new Date(a.date_start!).getTime())[0]
  await hydrateDrivers(latestSession?.session_key ?? 'latest', sportId, leagueId, counters)
}

Deno.serve(async (req) => {
  const body = req.method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {}
  const force = body.force === true
  const seasonOverride =
    typeof body.year === 'number' || typeof body.year === 'string' ? String(body.year) : null
  const counters: Counters = {
    calls: 0,
    targets: 0,
    meetings: 0,
    sessions: 0,
    inserted: 0,
    linked: 0,
    changed: 0,
    drivers: 0,
  }
  const now = Date.now()
  const { data: run } = await supabase
    .from('provider_sync_runs')
    .insert({ provider_key: PROVIDER_KEY, sport_key: SPORT_KEY, status: 'running' })
    .select('id')
    .single()

  let stopped: 'budget' | 'done' = 'done'
  try {
    const { data: targets, error } = await supabase
      .from('provider_targets')
      .select('id, current_season, events_synced_at')
      .eq('provider_key', PROVIDER_KEY)
      .eq('is_active', true)
      .order('priority', { ascending: true })
    if (error) throw error

    for (const target of (targets ?? []) as Target[]) {
      if (!force && !stale(target.events_synced_at, EVENTS_TTL_MS, now)) continue
      const year = seasonOverride ?? target.current_season ?? new Date().getUTCFullYear().toString()
      const meetings = await api<OpenF1Meeting[]>(`/meetings?year=${encodeURIComponent(year)}`, counters)
      const sessions = await api<OpenF1Session[]>(`/sessions?year=${encodeURIComponent(year)}`, counters)
      const meetingMap = new Map(meetings.map((meeting) => [meeting.meeting_key, meeting]))
      await upsertSessions(target, sessions, meetingMap, counters)
      counters.meetings += meetings.length
      counters.sessions += sessions.length
      counters.targets += 1
      await supabase
        .from('provider_targets')
        .update({
          events_synced_at: new Date().toISOString(),
          next_synced_at: new Date().toISOString(),
          last_status: `openf1:${year}:meetings:${meetings.length}:sessions:${sessions.length}:drivers:${counters.drivers}`,
          last_error: null,
        })
        .eq('id', target.id)
    }
  } catch (error) {
    if (error instanceof BudgetSpent) stopped = 'budget'
    else {
      await supabase
        .from('provider_sync_runs')
        .update({
          status: 'failed',
          error: String(error),
          fetched_count: counters.sessions,
          changed_count: counters.changed + counters.inserted + counters.linked,
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
      fetched_count: counters.sessions,
      changed_count: counters.changed + counters.inserted + counters.linked,
      error: stopped === 'done' ? null : `stopped: ${stopped}`,
      finished_at: new Date().toISOString(),
    })
    .eq('id', run!.id)

  return Response.json({ ok: true, stopped, counters })
})
