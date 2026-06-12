import { useEffect, useState } from 'react'
import type { Match } from '../domain/match'
import { supabase } from '../lib/supabase'
import { groupMatches as bundledMatches } from './worldcup'

// Live schedule source: reads public events from Supabase (RLS: visibility='public'),
// falling back to the bundled openfootball dataset when offline or unconfigured.
// Pages depend only on the Match shape, so swapping sources is invisible to the UI.

export type MatchSource = 'live' | 'local'

type LiveRow = {
  id: string
  title: string
  starts_at: string | null
  metadata: { round?: string; group?: string | null } | null
  home_competitor_id: string | null
  away_competitor_id: string | null
  venues: { name: string } | null
}

let cache: { matches: Match[]; source: MatchSource } | null = null
let inflight: Promise<{ matches: Match[]; source: MatchSource }> | null = null

async function fetchLiveMatches(): Promise<{ matches: Match[]; source: MatchSource }> {
  if (!supabase) return { matches: bundledMatches, source: 'local' }

  const { data, error } = await supabase
    .from('events')
    .select('id, title, starts_at, metadata, home_competitor_id, away_competitor_id, venues(name)')
    .eq('provider_key', 'worldcup_json')
    // Confirmed-team matches only (placeholder knockout slots have no competitors yet).
    .not('home_competitor_id', 'is', null)
    .not('away_competitor_id', 'is', null)
    .order('starts_at', { ascending: true })

  if (error || !data?.length) return { matches: bundledMatches, source: 'local' }

  const matches: Match[] = (data as unknown as LiveRow[])
    .filter((row) => row.starts_at && row.title.includes(' vs '))
    .map((row) => {
      const [team1, team2] = row.title.split(' vs ')
      const startsAt = new Date(row.starts_at!)
      return {
        round: row.metadata?.round ?? '',
        date: row.starts_at!.slice(0, 10),
        time: '',
        team1,
        team2,
        group: row.metadata?.group ?? undefined,
        ground: row.venues?.name ?? '',
        startsAt,
      }
    })

  return { matches, source: 'live' }
}

function loadMatches() {
  if (cache) return Promise.resolve(cache)
  inflight ??= fetchLiveMatches()
    .then((result) => {
      cache = result
      return result
    })
    .catch(() => {
      const fallback = { matches: bundledMatches, source: 'local' as const }
      cache = fallback
      return fallback
    })
  return inflight
}

export function useMatches(): { matches: Match[]; source: MatchSource } {
  const [state, setState] = useState(() => cache ?? { matches: bundledMatches, source: 'local' as MatchSource })

  useEffect(() => {
    let cancelled = false
    loadMatches().then((result) => {
      if (!cancelled) setState(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

export function filterMatchesForTeams(matches: Match[], selected: string[]): Match[] {
  if (selected.length === 0) return matches
  return matches
    .filter((match) => selected.includes(match.team1) || selected.includes(match.team2))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}

export function deriveTeams(matches: Match[]): string[] {
  return Array.from(new Set(matches.flatMap((match) => [match.team1, match.team2]))).sort((a, b) =>
    a.localeCompare(b),
  )
}
