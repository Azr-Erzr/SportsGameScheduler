import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'

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

export type SportSchedule = { leagues: LiveLeague[]; events: LiveEvent[]; loading: boolean; configured: boolean }

type EventRow = {
  id: string
  title: string
  starts_at: string | null
  starts_at_tbd: boolean
  status: string
  league_id: string | null
  venues: { name: string } | null
}

type ScheduleState = { forKey: string; leagues: LiveLeague[]; events: LiveEvent[]; configured: boolean }

export function useSportSchedule(canonicalSportKey: string): SportSchedule {
  // Store the key the data was loaded for; derive `loading` instead of setting state
  // synchronously in the effect (which triggers cascading renders).
  const [state, setState] = useState<ScheduleState>({ forKey: '', leagues: [], events: [], configured: true })

  useEffect(() => {
    let cancelled = false

    getSupabaseClient().then(async (supabase) => {
      if (!supabase) {
        if (!cancelled) setState({ forKey: canonicalSportKey, leagues: [], events: [], configured: false })
        return
      }

      const nowIso = new Date(Date.now() - 3 * 3600_000).toISOString()
      const [leaguesRes, eventsRes] = await Promise.all([
        supabase
          .from('leagues')
          .select('id, name, logo_url, sports!inner(key)')
          .eq('sports.key', canonicalSportKey)
          .eq('is_public', true)
          // Viewership/importance order (F1 before MotoGP, EPL before smaller leagues, …).
          .order('display_rank', { ascending: true })
          .order('name'),
        supabase
          .from('events')
          .select('id, title, starts_at, starts_at_tbd, status, league_id, venues(name), sports!inner(key)')
          .eq('sports.key', canonicalSportKey)
          .eq('visibility', 'public')
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true })
          .limit(120),
      ])

      if (cancelled) return

      const leagues: LiveLeague[] = (leaguesRes.data ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        logoUrl: (l as unknown as { logo_url: string | null }).logo_url,
      }))
      const leagueNames = new Map(leagues.map((l) => [l.id, l.name]))

      const events: LiveEvent[] = ((eventsRes.data ?? []) as unknown as EventRow[]).map((row) => ({
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

      setState({ forKey: canonicalSportKey, leagues, events, configured: true })
    })

    return () => {
      cancelled = true
    }
  }, [canonicalSportKey])

  const loading = state.forKey !== canonicalSportKey
  return {
    leagues: loading ? [] : state.leagues,
    events: loading ? [] : state.events,
    loading,
    configured: state.configured,
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
    leagueName: row.leagues?.name ?? '',
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

      if (leagueIds.length) {
        const { data } = await supabase
          .from('events')
          .select(MY_EVENT_SELECT)
          .in('league_id', leagueIds)
          .eq('visibility', 'public')
          .neq('status', 'finished')
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true })
          .limit(300)
        for (const row of (data ?? []) as unknown as MyEventRow[]) byId.set(row.id, mapMyEvent(row))
      }

      if (competitorIds.length) {
        const { data: links } = await supabase
          .from('event_competitors')
          .select('event_id')
          .in('competitor_id', competitorIds)
        const eventIds = [...new Set((links ?? []).map((l) => l.event_id as string))]
        for (let i = 0; i < eventIds.length; i += 200) {
          const { data } = await supabase
            .from('events')
            .select(MY_EVENT_SELECT)
            .in('id', eventIds.slice(i, i + 200))
            .eq('visibility', 'public')
            .neq('status', 'finished')
            .gte('starts_at', nowIso)
            .order('starts_at', { ascending: true })
          for (const row of (data ?? []) as unknown as MyEventRow[]) byId.set(row.id, mapMyEvent(row))
        }
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
