import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { readCache, retryRead, writeCache } from '../lib/resilience'

// Generic live read layer for any sport: leagues, upcoming events, and (for individual
// sports) the athlete roster — all from Supabase, gated by the public-read RLS policy.
// Keyed by CANONICAL sport key (soccer, basketball, motorsport, combat_sports, ...).

export type LiveLeague = { id: string; name: string; logoUrl: string | null }

export type LiveEvent = {
  id: string
  title: string
  startsAt: Date | null
  startsAtTbd: boolean
  status: string
  leagueId: string | null
  leagueName: string
  sportKey: string | null
  venue: string | null
}

export type LivePlayer = { id: string; name: string; country: string | null; logoUrl: string | null }

export type SportSchedule = {
  leagues: LiveLeague[]
  events: LiveEvent[]
  loading: boolean
  configured: boolean
  lastUpdated: Date | null
}

type EventRow = {
  id: string
  title: string
  starts_at: string | null
  starts_at_tbd: boolean
  status: string
  league_id: string | null
  updated_at: string | null
  venues: { name: string } | null
}

type ScheduleState = {
  forKey: string
  leagues: LiveLeague[]
  events: LiveEvent[]
  configured: boolean
  lastUpdated: Date | null
}

const SYSTEM_LEAGUE_NAME_PATTERNS = [
  /^_/,
  /\bdefunct\b/i,
  /\bdeprecated\b/i,
  /\bplaceholder\b/i,
  /\bunknown\b/i,
  /\btbd\b/i,
]

export function isPublicLeagueName(name: string | null | undefined) {
  const trimmed = name?.trim()
  if (!trimmed) return false
  return !SYSTEM_LEAGUE_NAME_PATTERNS.some((pattern) => pattern.test(trimmed))
}

function publicLeagueName(name: string | null | undefined) {
  return isPublicLeagueName(name) ? name!.trim() : ''
}

// Serializable mirror of LiveEvent for the localStorage cache (Date → ISO string round-trip).
type CachedEvent = Omit<LiveEvent, 'startsAt'> & { startsAt: string | null }
type CachedSchedule = { leagues: LiveLeague[]; events: CachedEvent[]; lastUpdated: string | null }

function toCachedEvent(e: LiveEvent): CachedEvent {
  return { ...e, startsAt: e.startsAt ? e.startsAt.toISOString() : null }
}
function fromCachedEvent(e: CachedEvent): LiveEvent {
  return { ...e, startsAt: e.startsAt ? new Date(e.startsAt) : null }
}

export function useSportSchedule(canonicalSportKey: string): SportSchedule {
  // Store the key the data was loaded for; derive `loading` instead of setting state
  // synchronously in the effect (which triggers cascading renders).
  const [state, setState] = useState<ScheduleState>({ forKey: '', leagues: [], events: [], configured: true, lastUpdated: null })

  useEffect(() => {
    let cancelled = false
    const cacheKey = `schedule:${canonicalSportKey}`

    // Stale-while-revalidate: paint the last good board immediately so a cold load or a transient
    // refresh failure is never a blank "no events" screen. The network result replaces it below.
    const cached = readCache<CachedSchedule>(cacheKey)
    if (cached) {
      setState({
        forKey: canonicalSportKey,
        leagues: cached.leagues,
        events: cached.events.map(fromCachedEvent),
        configured: true,
        lastUpdated: cached.lastUpdated ? new Date(cached.lastUpdated) : null,
      })
    }

    getSupabaseClient().then(async (supabase) => {
      if (!supabase) {
        if (!cancelled && !cached) setState({ forKey: canonicalSportKey, leagues: [], events: [], configured: false, lastUpdated: null })
        return
      }

      const nowIso = new Date(Date.now() - 3 * 3600_000).toISOString()
      let leaguesData: Array<{ id: string; name: string; logo_url: string | null }> | null
      let eventRows: EventRow[] | null
      try {
        ;[leaguesData, eventRows] = await Promise.all([
          retryRead(() =>
            supabase
              .from('leagues')
              .select('id, name, logo_url, sports!inner(key)')
              .eq('sports.key', canonicalSportKey)
              .eq('is_public', true)
              // Viewership/importance order (F1 before MotoGP, EPL before smaller leagues, …).
              .order('display_rank', { ascending: true })
              .order('name'),
          ) as Promise<Array<{ id: string; name: string; logo_url: string | null }> | null>,
          retryRead(() =>
            supabase
              .from('events')
              .select('id, title, starts_at, starts_at_tbd, status, league_id, updated_at, venues(name), sports!inner(key)')
              .eq('sports.key', canonicalSportKey)
              .eq('visibility', 'public')
              .gte('starts_at', nowIso)
              .order('starts_at', { ascending: true })
              .limit(250),
          ) as Promise<EventRow[] | null>,
        ])
      } catch {
        // Every retry failed. Keep whatever is on screen (cache/previous) rather than wiping it;
        // only fall back to an explicit empty board if we have literally nothing to show.
        if (!cancelled && !cached && state.forKey !== canonicalSportKey) {
          setState({ forKey: canonicalSportKey, leagues: [], events: [], configured: true, lastUpdated: null })
        }
        return
      }

      if (cancelled) return

      const allLeagues: LiveLeague[] = (leaguesData ?? [])
        .filter((l) => isPublicLeagueName(l.name))
        .map((l) => ({ id: l.id, name: l.name.trim(), logoUrl: l.logo_url }))
      const leagueNames = new Map(allLeagues.map((l) => [l.id, l.name]))
      const visibleLeagueIds = new Set(leagueNames.keys())

      const rows = (eventRows ?? []) as EventRow[]
      const events: LiveEvent[] = rows
        .filter((row) => !row.league_id || visibleLeagueIds.has(row.league_id))
        .map((row) => ({
          id: row.id,
          title: row.title,
          startsAt: row.starts_at ? new Date(row.starts_at) : null,
          startsAtTbd: row.starts_at_tbd,
          status: row.status,
          leagueId: row.league_id,
          leagueName: (row.league_id && leagueNames.get(row.league_id)) || '',
          sportKey: canonicalSportKey,
          venue: row.venues?.name ?? null,
        }))

      // Only surface leagues that actually have upcoming fixtures — no more "9 leagues, 0 events"
      // clutter where every chip dead-ends in an empty schedule. Fall back to the full list only if
      // the whole sport is between seasons (so the page still shows its league context).
      const leagueIdsWithEvents = new Set(events.map((e) => e.leagueId).filter(Boolean))
      const leaguesWithEvents = allLeagues.filter((l) => leagueIdsWithEvents.has(l.id))
      const leagues = leaguesWithEvents.length ? leaguesWithEvents : allLeagues

      // Freshness: the most recent change we ingested for this sport.
      let lastUpdated: Date | null = null
      for (const row of rows) {
        if (!row.updated_at) continue
        const t = new Date(row.updated_at)
        if (!lastUpdated || t > lastUpdated) lastUpdated = t
      }

      setState({ forKey: canonicalSportKey, leagues, events, configured: true, lastUpdated })
      // Cache only a real, non-empty result so a transient empty never poisons the fallback.
      if (events.length || leagues.length) {
        writeCache<CachedSchedule>(cacheKey, {
          leagues,
          events: events.map(toCachedEvent),
          lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
        })
      }
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalSportKey])

  const loading = state.forKey !== canonicalSportKey
  return {
    leagues: loading ? [] : state.leagues,
    events: loading ? [] : state.events,
    loading,
    configured: state.configured,
    lastUpdated: loading ? null : state.lastUpdated,
  }
}

type MyEventRow = {
  id: string
  title: string
  starts_at: string | null
  starts_at_tbd: boolean
  status: string
  league_id: string | null
  venues: { name: string } | null
  sports: { key: string } | null
  leagues: { name: string } | null
}

const MY_EVENT_SELECT =
  'id, title, starts_at, starts_at_tbd, status, league_id, venues(name), sports(key), leagues(name)'

function mapMyEvent(row: MyEventRow): LiveEvent {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at ? new Date(row.starts_at) : null,
    startsAtTbd: row.starts_at_tbd,
    status: row.status,
    leagueId: row.league_id,
    leagueName: publicLeagueName(row.leagues?.name),
    sportKey: row.sports?.key ?? null,
    venue: row.venues?.name ?? null,
  }
}

// The unified personal schedule: upcoming events across ALL sports for the leagues and
// competitors the user follows (DB uuid follows). World Cup team follows are handled separately
// by the planner. Returns a de-duplicated, time-sorted list.
export function useMyEvents(
  leagueIds: string[],
  competitorIds: string[],
): { events: LiveEvent[]; loading: boolean; configured: boolean } {
  const leagueKey = [...leagueIds].sort().join(',')
  const competitorKey = [...competitorIds].sort().join(',')
  const [state, setState] = useState<{ forKey: string; events: LiveEvent[]; configured: boolean }>({
    forKey: 'init',
    events: [],
    configured: true,
  })
  const queryKey = `${leagueKey}|${competitorKey}`

  useEffect(() => {
    let cancelled = false

    getSupabaseClient().then(async (supabase) => {
      if (cancelled) return
      // No follows yet: resolve to an empty schedule (async, never a synchronous setState).
      if (!leagueIds.length && !competitorIds.length) {
        setState({ forKey: queryKey, events: [], configured: true })
        return
      }
      if (!supabase) {
        setState({ forKey: queryKey, events: [], configured: false })
        return
      }
      const nowIso = new Date(Date.now() - 3 * 3600_000).toISOString()
      const byId = new Map<string, LiveEvent>()

      try {
        if (leagueIds.length) {
          const data = (await retryRead(() =>
            supabase
              .from('events')
              .select(MY_EVENT_SELECT)
              .in('league_id', leagueIds)
              .eq('visibility', 'public')
              .neq('status', 'finished')
              .gte('starts_at', nowIso)
              .order('starts_at', { ascending: true })
              .limit(300),
          )) as unknown as MyEventRow[] | null
          for (const row of data ?? []) byId.set(row.id, mapMyEvent(row))
        }

        if (competitorIds.length) {
          const links = (await retryRead(() =>
            supabase.from('event_competitors').select('event_id').in('competitor_id', competitorIds),
          )) as { event_id: string }[] | null
          const eventIds = [...new Set((links ?? []).map((l) => l.event_id))]
          for (let i = 0; i < eventIds.length; i += 200) {
            const data = (await retryRead(() =>
              supabase
                .from('events')
                .select(MY_EVENT_SELECT)
                .in('id', eventIds.slice(i, i + 200))
                .eq('visibility', 'public')
                .neq('status', 'finished')
                .gte('starts_at', nowIso)
                .order('starts_at', { ascending: true }),
            )) as unknown as MyEventRow[] | null
            for (const row of data ?? []) byId.set(row.id, mapMyEvent(row))
          }
        }
      } catch {
        // Every retry failed — leave the previously loaded schedule on screen rather than wiping
        // it to empty. The next follow change or revisit re-runs this effect.
        return
      }

      if (cancelled) return
      const events = [...byId.values()].sort(
        (a, b) => (a.startsAt?.getTime() ?? Infinity) - (b.startsAt?.getTime() ?? Infinity),
      )
      setState({ forKey: queryKey, events, configured: true })
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey])

  const loading = state.forKey !== queryKey
  return { events: loading ? [] : state.events, loading, configured: state.configured }
}

export type EventCompetitor = { id: string; name: string; country: string | null; role: string; logoUrl: string | null }
export type EventBroadcast = { country: string; channel: string; streamUrl: string | null; kind: string }
export type EventBout = {
  id: string
  order: number | null
  weightClass: string | null
  scheduledRounds: number | null
  estimatedStartAt: Date | null
  estimatedEndAt: Date | null
  status: string
  metadata: Record<string, unknown>
  redCorner: EventCompetitor | null
  blueCorner: EventCompetitor | null
}
export type EventDetail = LiveEvent & {
  leagueId: string | null
  venueCity: string | null
  venueCountry: string | null
  kind: string | null
  metadata: Record<string, unknown>
  competitors: EventCompetitor[]
  bouts: EventBout[]
  broadcasts: EventBroadcast[]
}

// Full single-event read for the event detail page (the target of calendar "View" links).
export function useEvent(eventId: string | undefined): { event: EventDetail | null; loading: boolean; configured: boolean } {
  const [state, setState] = useState<{ forKey: string; event: EventDetail | null; configured: boolean }>({
    forKey: 'init',
    event: null,
    configured: true,
  })

  useEffect(() => {
    let cancelled = false
    const key = eventId ?? ''

    getSupabaseClient().then(async (supabase) => {
      if (cancelled) return
      if (!eventId) {
        setState({ forKey: key, event: null, configured: true })
        return
      }
      if (!supabase) {
        setState({ forKey: key, event: null, configured: false })
        return
      }
      const [{ data: row }, { data: comps }, { data: casts }, boutsRes] = await Promise.all([
        supabase
          .from('events')
          .select(
            'id, title, starts_at, starts_at_tbd, status, league_id, kind, metadata, venues(name, city, country), sports(key), leagues(name)',
          )
          .eq('id', eventId)
          .maybeSingle(),
        supabase
          .from('event_competitors')
          .select('role, position, competitors(id, name, country, logo_url)')
          .eq('event_id', eventId)
          .order('position', { ascending: true }),
        supabase.from('broadcasts').select('country, channel, stream_url, kind').eq('event_id', eventId),
        supabase
          .from('event_bouts')
          .select(
            'id, bout_order, weight_class, red_corner_competitor_id, blue_corner_competitor_id, scheduled_rounds, est_start_window, status, metadata',
          )
          .eq('event_id', eventId)
          .order('bout_order', { ascending: true, nullsFirst: false }),
      ])
      if (cancelled) return
      if (!row) {
        setState({ forKey: key, event: null, configured: true })
        return
      }
      const r = row as unknown as {
        id: string
        title: string
        starts_at: string | null
        starts_at_tbd: boolean
        status: string
        league_id: string | null
        kind: string | null
        metadata: Record<string, unknown> | null
        venues: { name: string; city: string | null; country: string | null } | null
        sports: { key: string } | null
        leagues: { name: string } | null
      }
      const competitors: EventCompetitor[] = (comps ?? []).map((c) => {
        const person = (c as unknown as { competitors: { id: string; name: string; country: string | null; logo_url: string | null } }).competitors
        return {
          id: person.id,
          name: person.name,
          country: person.country,
          logoUrl: person.logo_url,
          role: (c as unknown as { role: string }).role,
        }
      })
      const rawBouts = (boutsRes.error ? [] : boutsRes.data ?? []) as unknown as Array<{
        id: string
        bout_order: number | null
        weight_class: string | null
        red_corner_competitor_id: string | null
        blue_corner_competitor_id: string | null
        scheduled_rounds: number | null
        est_start_window: string | null
        status: string
        metadata: Record<string, unknown> | null
      }>
      const boutCompetitorIds = [
        ...new Set(
          rawBouts.flatMap((b) => [b.red_corner_competitor_id, b.blue_corner_competitor_id]).filter((id): id is string => Boolean(id)),
        ),
      ]
      let boutCompetitors = new Map<string, EventCompetitor>()
      if (boutCompetitorIds.length) {
        const { data: people } = await supabase
          .from('competitors')
          .select('id, name, country, logo_url')
          .in('id', boutCompetitorIds)
        if (cancelled) return
        boutCompetitors = new Map(
          ((people ?? []) as unknown as Array<{ id: string; name: string; country: string | null; logo_url: string | null }>).map((person) => [
            person.id,
            { id: person.id, name: person.name, country: person.country, logoUrl: person.logo_url, role: 'fighter' },
          ]),
        )
      }
      const bouts: EventBout[] = rawBouts.map((bout) => {
        const [rangeStart, rangeEnd] = parsePostgresRange(bout.est_start_window)
        return {
          id: bout.id,
          order: bout.bout_order,
          weightClass: bout.weight_class,
          scheduledRounds: bout.scheduled_rounds,
          estimatedStartAt: rangeStart,
          estimatedEndAt: rangeEnd,
          status: bout.status,
          metadata: bout.metadata ?? {},
          redCorner: bout.red_corner_competitor_id ? boutCompetitors.get(bout.red_corner_competitor_id) ?? null : null,
          blueCorner: bout.blue_corner_competitor_id ? boutCompetitors.get(bout.blue_corner_competitor_id) ?? null : null,
        }
      })
      const broadcasts: EventBroadcast[] = (casts ?? []).map((b) => ({
        country: (b as unknown as { country: string }).country,
        channel: (b as unknown as { channel: string }).channel,
        streamUrl: (b as unknown as { stream_url: string | null }).stream_url,
        kind: (b as unknown as { kind: string }).kind,
      }))
      setState({
        forKey: key,
        configured: true,
        event: {
          id: r.id,
          title: r.title,
          startsAt: r.starts_at ? new Date(r.starts_at) : null,
          startsAtTbd: r.starts_at_tbd,
          status: r.status,
          leagueId: r.league_id,
          leagueName: publicLeagueName(r.leagues?.name),
          sportKey: r.sports?.key ?? null,
          venue: r.venues?.name ?? null,
          venueCity: r.venues?.city ?? null,
          venueCountry: r.venues?.country ?? null,
          kind: r.kind,
          metadata: r.metadata ?? {},
          competitors,
          bouts,
          broadcasts,
        },
      })
    })

    return () => {
      cancelled = true
    }
  }, [eventId])

  const loading = state.forKey !== (eventId ?? '')
  return { event: loading ? null : state.event, loading, configured: state.configured }
}

function parsePostgresRange(range: string | null): [Date | null, Date | null] {
  if (!range) return [null, null]
  const match = range.match(/^[[(]"?([^",)]*)"?,"?([^",)]*)"?[\])]$/)
  if (!match) return [null, null]
  const start = match[1] ? new Date(match[1]) : null
  const end = match[2] ? new Date(match[2]) : null
  return [start && Number.isFinite(start.getTime()) ? start : null, end && Number.isFinite(end.getTime()) ? end : null]
}

export type LeagueInfo = { id: string; name: string; sportKey: string | null; country: string | null; logoUrl: string | null }

// League detail: the league + its upcoming events (target of /leagues/:id).
export function useLeague(leagueId: string | undefined): {
  league: LeagueInfo | null
  events: LiveEvent[]
  loading: boolean
  configured: boolean
} {
  const [state, setState] = useState<{ forKey: string; league: LeagueInfo | null; events: LiveEvent[]; configured: boolean }>({
    forKey: 'init',
    league: null,
    events: [],
    configured: true,
  })

  useEffect(() => {
    let cancelled = false
    const key = leagueId ?? ''
    getSupabaseClient().then(async (supabase) => {
      if (cancelled) return
      if (!leagueId) {
        setState({ forKey: key, league: null, events: [], configured: true })
        return
      }
      if (!supabase) {
        setState({ forKey: key, league: null, events: [], configured: false })
        return
      }
      const nowIso = new Date(Date.now() - 3 * 3600_000).toISOString()
      const [{ data: leagueRow }, { data: eventRows }] = await Promise.all([
        supabase.from('leagues').select('id, name, country, logo_url, is_public, sports(key)').eq('id', leagueId).eq('is_public', true).maybeSingle(),
        supabase
          .from('events')
          .select(MY_EVENT_SELECT)
          .eq('league_id', leagueId)
          .eq('visibility', 'public')
          .neq('status', 'finished')
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true })
          .limit(200),
      ])
      if (cancelled) return
      if (!leagueRow) {
        setState({ forKey: key, league: null, events: [], configured: true })
        return
      }
      const r = leagueRow as unknown as { id: string; name: string; country: string | null; logo_url: string | null; sports: { key: string } | null }
      if (!isPublicLeagueName(r.name)) {
        setState({ forKey: key, league: null, events: [], configured: true })
        return
      }
      setState({
        forKey: key,
        configured: true,
        league: { id: r.id, name: r.name.trim(), sportKey: r.sports?.key ?? null, country: r.country, logoUrl: r.logo_url },
        events: ((eventRows ?? []) as unknown as MyEventRow[]).map(mapMyEvent),
      })
    })
    return () => {
      cancelled = true
    }
  }, [leagueId])

  const loading = state.forKey !== (leagueId ?? '')
  return { league: loading ? null : state.league, events: loading ? [] : state.events, loading, configured: state.configured }
}

export type CompetitorInfo = { id: string; name: string; sportKey: string | null; country: string | null; logoUrl: string | null; kind: string }

// Team/player detail: the competitor + their upcoming events (target of /teams/:id).
export function useCompetitor(competitorId: string | undefined): {
  competitor: CompetitorInfo | null
  events: LiveEvent[]
  loading: boolean
  configured: boolean
} {
  const [state, setState] = useState<{ forKey: string; competitor: CompetitorInfo | null; events: LiveEvent[]; configured: boolean }>({
    forKey: 'init',
    competitor: null,
    events: [],
    configured: true,
  })

  useEffect(() => {
    let cancelled = false
    const key = competitorId ?? ''
    getSupabaseClient().then(async (supabase) => {
      if (cancelled) return
      if (!competitorId) {
        setState({ forKey: key, competitor: null, events: [], configured: true })
        return
      }
      if (!supabase) {
        setState({ forKey: key, competitor: null, events: [], configured: false })
        return
      }
      const { data: row } = await supabase
        .from('competitors')
        .select('id, name, country, logo_url, kind, sports(key)')
        .eq('id', competitorId)
        .maybeSingle()
      if (cancelled) return
      if (!row) {
        setState({ forKey: key, competitor: null, events: [], configured: true })
        return
      }
      const c = row as unknown as { id: string; name: string; country: string | null; logo_url: string | null; kind: string; sports: { key: string } | null }

      const { data: links } = await supabase.from('event_competitors').select('event_id').eq('competitor_id', competitorId)
      const eventIds = [...new Set((links ?? []).map((l) => l.event_id as string))]
      const nowIso = new Date(Date.now() - 3 * 3600_000).toISOString()
      const byId = new Map<string, LiveEvent>()
      for (let i = 0; i < eventIds.length; i += 200) {
        const { data } = await supabase
          .from('events')
          .select(MY_EVENT_SELECT)
          .in('id', eventIds.slice(i, i + 200))
          .eq('visibility', 'public')
          .neq('status', 'finished')
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true })
        for (const e of (data ?? []) as unknown as MyEventRow[]) byId.set(e.id, mapMyEvent(e))
      }
      if (cancelled) return
      const events = [...byId.values()].sort((a, b) => (a.startsAt?.getTime() ?? Infinity) - (b.startsAt?.getTime() ?? Infinity))
      setState({
        forKey: key,
        configured: true,
        competitor: { id: c.id, name: c.name, sportKey: c.sports?.key ?? null, country: c.country, logoUrl: c.logo_url, kind: c.kind },
        events,
      })
    })
    return () => {
      cancelled = true
    }
  }, [competitorId])

  const loading = state.forKey !== (competitorId ?? '')
  return { competitor: loading ? null : state.competitor, events: loading ? [] : state.events, loading, configured: state.configured }
}

export type LeagueTeam = { id: string; name: string; country: string | null }

// Teams that belong to a league (competitors.league_id), for the "follow your team" pills that
// appear under the league selector. Mirrors the roster read but scoped to one league's teams.
export function useLeagueTeams(leagueId: string | null): { teams: LeagueTeam[]; loading: boolean } {
  const [state, setState] = useState<{ forKey: string; teams: LeagueTeam[] }>({ forKey: '', teams: [] })

  useEffect(() => {
    let cancelled = false
    const key = leagueId ?? ''
    if (!leagueId) {
      setState({ forKey: '', teams: [] })
      return
    }

    getSupabaseClient().then(async (supabase) => {
      if (!supabase || cancelled) return
      try {
        const data = (await retryRead(() =>
          supabase
            .from('competitors')
            .select('id, name, country')
            .eq('league_id', leagueId)
            .eq('kind', 'team')
            .order('name')
            .limit(100),
        )) as LeagueTeam[] | null
        if (cancelled) return
        setState({ forKey: key, teams: data ?? [] })
      } catch {
        // Keep any previously loaded teams rather than clearing the pills on a transient failure.
        if (!cancelled && state.forKey !== key) setState({ forKey: key, teams: [] })
      }
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId])

  const loading = Boolean(leagueId) && state.forKey !== (leagueId ?? '')
  return { teams: loading ? [] : state.teams, loading }
}

export function useSportRoster(canonicalSportKey: string, enabled: boolean): { players: LivePlayer[]; loading: boolean } {
  const [state, setState] = useState<{ forKey: string; players: LivePlayer[] }>({ forKey: '', players: [] })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    getSupabaseClient().then(async (supabase) => {
      if (!supabase) {
        if (!cancelled) setState({ forKey: canonicalSportKey, players: [] })
        return
      }
      const { data } = await supabase
        .from('competitors')
        .select('id, name, country, logo_url, sports!inner(key)')
        .eq('sports.key', canonicalSportKey)
        .eq('kind', 'person')
        .order('name')
        .limit(500)
      if (cancelled) return
      const players: LivePlayer[] = (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        country: (p as unknown as { country: string | null }).country,
        logoUrl: (p as unknown as { logo_url: string | null }).logo_url,
      }))
      setState({ forKey: canonicalSportKey, players })
    })

    return () => {
      cancelled = true
    }
  }, [canonicalSportKey, enabled])

  const loading = enabled && state.forKey !== canonicalSportKey
  return { players: loading ? [] : state.players, loading }
}
