import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { isPublicLeagueName } from './liveSport'

// Events in the next 7 days for the homepage ticker tape. Pulls the soonest upcoming public
// events, then round-robins across sports so the tape is a varied "what's on this week" crawl
// rather than a wall of whichever sport happens to play most. Each item links to its event page.

export type TickerEvent = {
  id: string
  title: string
  startsAt: Date
  sportKey: string | null
  leagueName: string
}

type Row = {
  id: string
  title: string
  starts_at: string | null
  sports: { key: string } | null
  leagues: { name: string | null } | null
}

const WINDOW_DAYS = 7
const MAX_ITEMS = 30
const FETCH_LIMIT = 120

// Interleave by sport so no single sport dominates the head of the tape.
function roundRobinBySport(events: TickerEvent[], max: number): TickerEvent[] {
  const bySport = new Map<string, TickerEvent[]>()
  for (const e of events) {
    const key = e.sportKey ?? 'other'
    const list = bySport.get(key) ?? []
    list.push(e)
    bySport.set(key, list)
  }
  const queues = [...bySport.values()]
  const out: TickerEvent[] = []
  let added = true
  while (added && out.length < max) {
    added = false
    for (const queue of queues) {
      const next = queue.shift()
      if (next) {
        out.push(next)
        added = true
        if (out.length >= max) break
      }
    }
  }
  return out
}

export function useTickerEvents(): { events: TickerEvent[]; loading: boolean } {
  const [events, setEvents] = useState<TickerEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getSupabaseClient().then(async (supabase) => {
      if (cancelled) return
      if (!supabase) {
        setEvents([])
        setLoading(false)
        return
      }
      const now = new Date()
      const end = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000)
      const { data } = await supabase
        .from('events')
        .select('id, title, starts_at, sports(key), leagues(name)')
        .eq('visibility', 'public')
        .neq('status', 'finished')
        .gte('starts_at', now.toISOString())
        .lte('starts_at', end.toISOString())
        .order('starts_at', { ascending: true })
        .limit(FETCH_LIMIT)
      if (cancelled) return

      const mapped: TickerEvent[] = []
      for (const row of (data ?? []) as unknown as Row[]) {
        if (!row.starts_at) continue
        const leagueName = row.leagues?.name ?? ''
        if (leagueName && !isPublicLeagueName(leagueName)) continue
        mapped.push({
          id: row.id,
          title: row.title,
          startsAt: new Date(row.starts_at),
          sportKey: row.sports?.key ?? null,
          leagueName,
        })
      }
      setEvents(roundRobinBySport(mapped, MAX_ITEMS))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { events, loading }
}
