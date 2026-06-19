import { useEffect, useState } from 'react'
import { WATCH_PROVIDERS, watchLinkFor } from '../lib/ads'
import { getSupabaseClient } from '../lib/supabase'

export type WatchOption = {
  key: string
  name: string
  href: string
  affiliate: boolean
  network?: string
  source: 'db' | 'fallback'
  priority: number
}

type ProviderRow = {
  key: string
  name: string
  network: string
  affiliate_status: 'none' | 'pending' | 'approved' | 'paused' | 'rejected'
  direct_url: string
  affiliate_url: string | null
  priority: number
}

type WatchLinkRow = {
  provider_key: string
  label: string | null
  event_id: string | null
  league_id: string | null
  country_codes: string[]
  sport_keys: string[]
  link_kind: 'official' | 'affiliate' | 'sponsored' | 'free'
  url: string | null
  affiliate_url: string | null
  priority: number
  watch_providers: ProviderRow | null
}

type WatchQuery = {
  eventId?: string | null
  leagueId?: string | null
  sportKey?: string | null
  regionCode?: string | null
  limit?: number
}

function sportAliases(sportKey: string | null | undefined) {
  const key = sportKey?.toLowerCase()
  if (!key) return []
  const aliases: Record<string, string[]> = {
    combat_sports: ['combat_sports', 'combat', 'mma', 'boxing'],
    american_football: ['american_football', 'football', 'nfl', 'cfl'],
    athletics: ['athletics', 'track', 'track_field'],
    olympic_sports: ['olympic_sports', 'olympic'],
    motorsport: ['motorsport', 'f1'],
  }
  return aliases[key] ?? [key]
}

function includesOrGlobal(values: string[] | null | undefined, value: string | null | undefined) {
  if (!values?.length) return true
  if (!value) return false
  return values.includes(value.toUpperCase()) || values.includes(value.toLowerCase())
}

function includesSportOrGlobal(values: string[] | null | undefined, sportKey: string | null | undefined) {
  if (!values?.length) return true
  return sportAliases(sportKey).some((alias) => values.includes(alias))
}

export function fallbackWatchOptions(regionCode?: string | null, sportKey?: string | null, limit = 5): WatchOption[] {
  const region = (regionCode ?? 'US').toUpperCase()
  const exact = WATCH_PROVIDERS.filter(
    (p) =>
      p.regions.includes(region) &&
      includesSportOrGlobal(p.sports, sportKey),
  )
  const regional = WATCH_PROVIDERS.filter((p) => p.regions.includes(region))
  const providers = (exact.length ? exact : regional.length ? regional : WATCH_PROVIDERS).slice(0, limit)

  return providers.flatMap((provider, index) => {
    const link = watchLinkFor(provider.key)
    if (!link) return []
    return [{
      key: provider.key,
      name: link.name,
      href: link.href,
      affiliate: link.affiliate,
      network: provider.network,
      source: 'fallback' as const,
      priority: index + 100,
    }]
  })
}

function mapRows(rows: WatchLinkRow[], query: WatchQuery): WatchOption[] {
  const region = (query.regionCode ?? 'US').toUpperCase()
  const seen = new Set<string>()

  return rows
    .filter((row) => {
      if (!row.watch_providers) return false
      if (row.event_id && row.event_id !== query.eventId) return false
      if (row.league_id && row.league_id !== query.leagueId) return false
      if (!includesOrGlobal(row.country_codes, region)) return false
      if (!includesSportOrGlobal(row.sport_keys, query.sportKey)) return false
      return true
    })
    .map((row) => {
      const provider = row.watch_providers!
      const affiliateHref =
        provider.affiliate_status === 'approved'
          ? row.affiliate_url ?? provider.affiliate_url
          : null
      const href = affiliateHref ?? row.url ?? provider.direct_url
      const exactBoost = row.event_id ? -1000 : row.league_id ? -500 : 0
      const affiliate = Boolean(affiliateHref) || row.link_kind === 'affiliate' || row.link_kind === 'sponsored'
      return {
        key: `${row.provider_key}:${href}`,
        name: row.label ?? provider.name,
        href,
        affiliate,
        network: provider.network,
        source: 'db' as const,
        priority: row.priority + provider.priority + exactBoost + (affiliate ? -10 : 0),
      }
    })
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    .filter((option) => {
      const dedupeKey = `${option.name}:${option.href}`
      if (seen.has(dedupeKey)) return false
      seen.add(dedupeKey)
      return true
    })
}

export function useWatchOptions(query: WatchQuery): { links: WatchOption[]; loading: boolean; configured: boolean } {
  const limit = query.limit ?? 5
  const fallback = fallbackWatchOptions(query.regionCode, query.sportKey, limit)
  const [state, setState] = useState<{
    key: string
    links: WatchOption[]
    configured: boolean
  }>({ key: '', links: fallback, configured: true })
  const key = [
    query.eventId ?? '',
    query.leagueId ?? '',
    query.sportKey ?? '',
    query.regionCode ?? '',
    limit,
  ].join('|')

  useEffect(() => {
    let cancelled = false
    getSupabaseClient().then(async (supabase) => {
      if (!supabase) {
        if (!cancelled) setState({ key, links: fallback, configured: false })
        return
      }

      const { data, error } = await supabase
        .from('watch_links')
        .select(
          'provider_key, label, event_id, league_id, country_codes, sport_keys, link_kind, url, affiliate_url, priority, watch_providers(key, name, network, affiliate_status, direct_url, affiliate_url, priority)',
        )
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .limit(100)

      if (cancelled) return
      if (error) {
        setState({ key, links: fallback, configured: true })
        return
      }

      const links = mapRows((data ?? []) as unknown as WatchLinkRow[], query).slice(0, limit)
      setState({ key, links: links.length ? links : fallback, configured: true })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const loading = state.key !== key
  return {
    links: loading ? fallback : state.links,
    loading,
    configured: state.configured,
  }
}
