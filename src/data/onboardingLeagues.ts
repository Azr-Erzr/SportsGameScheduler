import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { isPublicLeagueName } from './liveSport'

// Top leagues per sport, for the onboarding "follow a few leagues" step. League follows (unlike
// sport follows) carry real UUIDs, so they sync to the account AND drive get_my_schedule — this is
// what turns a sport pick into an actually-populated schedule. Ranked by leagues.display_rank.

export type OnboardingLeague = { id: string; name: string; sportKey: string }
export type LeagueGroup = { sportKey: string; sportLabel: string; leagues: OnboardingLeague[] }

type LeagueRow = { id: string; name: string; display_rank: number | null; sports: { key: string } | null }

const PER_SPORT = 3

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

      const bySport = new Map<string, OnboardingLeague[]>()
      const seenNames = new Map<string, Set<string>>()
      for (const row of (data ?? []) as unknown as LeagueRow[]) {
        const sportKey = row.sports?.key
        if (!sportKey || !isPublicLeagueName(row.name)) continue
        const names = seenNames.get(sportKey) ?? new Set<string>()
        const norm = row.name.trim().toLowerCase()
        if (names.has(norm)) continue
        const list = bySport.get(sportKey) ?? []
        if (list.length >= PER_SPORT) continue
        list.push({ id: row.id, name: row.name, sportKey })
        bySport.set(sportKey, list)
        names.add(norm)
        seenNames.set(sportKey, names)
      }

      const next: LeagueGroup[] = canonicalKeys
        .filter((k) => bySport.has(k))
        .map((k) => ({ sportKey: k, sportLabel: sportLabels[k] ?? k, leagues: bySport.get(k)! }))
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
