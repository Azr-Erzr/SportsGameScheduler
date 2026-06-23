import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { isPublicLeagueName } from './liveSport'

// Top leagues per sport, for the onboarding "follow a few leagues" step. League follows (unlike
// sport follows) carry real UUIDs, so they sync to the account AND drive get_my_schedule — this is
// what turns a sport pick into an actually-populated schedule. Ranked by leagues.display_rank.

export type OnboardingLeague = { id: string; name: string; sportKey: string }
export type LeagueGroup = { sportKey: string; sportLabel: string; leagues: OnboardingLeague[] }

type LeagueRow = { id: string; name: string; display_rank: number | null; sports: { key: string } | null }

const PER_SPORT = 4

// Collapse near-duplicate league names that differ only by an edition year, e.g.
// "FIFA World Cup" vs "FIFA World Cup 2026" — one offer, not two.
function baseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
function editionYear(name: string): number {
  const m = name.match(/\b(19|20)\d{2}\b/)
  return m ? Number(m[0]) : 0
}

export function useTopLeaguesForSports(
  canonicalKeys: string[],
  sportLabels: Record<string, string>,
  enabled: boolean,
): { groups: LeagueGroup[]; loading: boolean } {
  const [groups, setGroups] = useState<LeagueGroup[]>([])
  const [loading, setLoading] = useState(false)
  const key = canonicalKeys.slice().sort().join(',')

  useEffect(() => {
    let cancelled = false
    // All setState runs inside the async callback — never synchronously in the effect body.
    getSupabaseClient().then(async (supabase) => {
      if (cancelled) return
      if (!enabled || !key || !supabase) {
        setGroups([])
        setLoading(false)
        return
      }
      setLoading(true)
      const { data } = await supabase
        .from('leagues')
        .select('id, name, display_rank, sports!inner(key)')
        .in('sports.key', key.split(','))
        .eq('is_public', true)
        .order('display_rank', { ascending: true, nullsFirst: false })
        .limit(canonicalKeys.length * 12)
      if (cancelled) return

      // Gather public candidates per sport (rows arrive ordered by display_rank).
      type Candidate = { id: string; name: string; rank: number; base: string; year: number }
      const candidates = new Map<string, Candidate[]>()
      for (const row of (data ?? []) as unknown as LeagueRow[]) {
        const sportKey = row.sports?.key
        if (!sportKey || !isPublicLeagueName(row.name)) continue
        const name = row.name.trim()
        const list = candidates.get(sportKey) ?? []
        list.push({ id: row.id, name, rank: row.display_rank ?? 9999, base: baseName(name), year: editionYear(name) })
        candidates.set(sportKey, list)
      }

      const next: LeagueGroup[] = []
      for (const k of canonicalKeys) {
        const list = candidates.get(k)
        if (!list) continue
        // Collapse by base name, preferring the dated edition (the active one with fixtures).
        const byBase = new Map<string, Candidate>()
        for (const c of list) {
          const current = byBase.get(c.base)
          if (!current || c.year > current.year || (c.year === current.year && c.rank < current.rank)) {
            byBase.set(c.base, c)
          }
        }
        const leagues = [...byBase.values()]
          .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
          .slice(0, PER_SPORT)
          .map((c) => ({ id: c.id, name: c.name, sportKey: k }))
        if (leagues.length) next.push({ sportKey: k, sportLabel: sportLabels[k] ?? k, leagues })
      }
      setGroups(next)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  return { groups, loading }
}
