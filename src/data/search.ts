import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { sportRoutes } from '../domain/sports'
import { teams as worldCupTeams } from './worldcup'
import { isPublicLeagueName } from './liveSport'

// Global search across everything Silbo knows: sport families and World Cup nations resolve
// instantly from static data; leagues and players/competitors come from Supabase. Replaces the
// old World-Cup-teams-only suggestion box so a user can find any sport, league, or athlete from
// one field. Used by the Home and Explore search surfaces.

export type SearchResultKind = 'sport' | 'league' | 'competitor' | 'team'

export type SearchResult = {
  id: string
  kind: SearchResultKind
  label: string
  sublabel: string
  to: string
}

const PER_GROUP = 6

function localResults(query: string): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const out: SearchResult[] = []

  for (const sport of sportRoutes) {
    if (!sport.enabled) continue
    if (sport.label.toLowerCase().includes(q) || sport.flagshipLeague.toLowerCase().includes(q)) {
      out.push({ id: `sport:${sport.key}`, kind: 'sport', label: sport.label, sublabel: sport.flagshipLeague, to: `/sports/${sport.key}` })
    }
  }

  const teamHits: SearchResult[] = []
  for (const team of worldCupTeams) {
    if (team.toLowerCase().includes(q)) {
      teamHits.push({ id: `team:${team}`, kind: 'team', label: team, sublabel: 'World Cup', to: '/sports/soccer' })
    }
  }

  return [...out.slice(0, PER_GROUP), ...teamHits.slice(0, PER_GROUP)]
}

export function useGlobalSearch(query: string): { results: SearchResult[]; loading: boolean } {
  const local = useMemo(() => localResults(query), [query])
  const [remote, setRemote] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const q = query.trim()
    const current = ++seq.current
    // All setState happens inside the async timer callback — never synchronously in the effect body.
    const timer = window.setTimeout(async () => {
      if (q.length < 2) {
        if (current === seq.current) {
          setRemote([])
          setLoading(false)
        }
        return
      }
      setLoading(true)
      const supabase = await getSupabaseClient()
      if (!supabase) {
        if (current === seq.current) {
          setRemote([])
          setLoading(false)
        }
        return
      }
      const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`
      const [leagues, competitors] = await Promise.all([
        supabase.from('leagues').select('id, name').ilike('name', like).limit(8),
        supabase.from('competitors').select('id, name, country').ilike('name', like).limit(8),
      ])
      if (current !== seq.current) return
      const results: SearchResult[] = []
      for (const row of leagues.data ?? []) {
        if (!isPublicLeagueName(row.name as string)) continue
        results.push({ id: `league:${row.id}`, kind: 'league', label: row.name as string, sublabel: 'League', to: `/leagues/${row.id}` })
      }
      for (const row of competitors.data ?? []) {
        results.push({
          id: `competitor:${row.id}`,
          kind: 'competitor',
          label: row.name as string,
          sublabel: (row.country as string | null) ?? 'Competitor',
          to: `/teams/${row.id}`,
        })
      }
      setRemote(results.slice(0, PER_GROUP * 2))
      setLoading(false)
    }, 220)

    return () => window.clearTimeout(timer)
  }, [query])

  const results = useMemo(() => {
    // De-dupe by id, local first (instant, authoritative for sports/teams).
    const seen = new Set<string>()
    const merged: SearchResult[] = []
    for (const r of [...local, ...remote]) {
      if (seen.has(r.id)) continue
      seen.add(r.id)
      merged.push(r)
    }
    return merged
  }, [local, remote])

  return { results, loading }
}
