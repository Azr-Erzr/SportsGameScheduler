import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'

export type SpotlightEvent = {
  title: string
  sportKey: string
  label: string
  detail: string
  href: string
  importance: number
  lifecycle?: string
  templateSlug?: string | null
  artKey?: string | null
  startsAt?: string | null
  endsAt?: string | null
  resultHoldUntil?: string | null
  scheduleReleaseExpectedAt?: string | null
  sourceConfidence?: string | null
}

// Fallback mirrors the seeded DB rows so the homepage still has a complete board offline.
export const fallbackSpotlightEvents: SpotlightEvent[] = [
  {
    title: 'FIFA World Cup 2026',
    sportKey: 'soccer',
    label: 'Live now',
    detail: 'Follow countries, bracket slots, and kickoff changes.',
    href: '/sports/soccer',
    importance: 100,
  },
  {
    title: 'Formula 1 race weekends',
    sportKey: 'motorsport',
    label: 'Staged',
    detail: 'Practice, qualifying, sprint, and race sessions.',
    href: '/sports/motorsport',
    importance: 84,
    lifecycle: 'schedule_live',
    templateSlug: 'race-weekend',
  },
  {
    title: 'UFC / PFL fight cards',
    sportKey: 'combat',
    label: 'Model ready',
    detail: 'Main cards, prelims, fighters, and late changes.',
    href: '/sports/combat',
    importance: 72,
    lifecycle: 'schedule_live',
    templateSlug: 'fight-card',
  },
  {
    title: 'WNBA schedule tracking',
    sportKey: 'basketball',
    label: 'Source testing',
    detail: 'TheSportsDB premium, SportsDataIO, and Sportradar candidates.',
    href: '/sports/basketball',
    importance: 55,
  },
  {
    title: 'CFL and Grey Cup path',
    sportKey: 'football',
    label: 'Canada focus',
    detail: 'Canadian kickoff times and broadcast-region fit.',
    href: '/sports/football',
    importance: 45,
  },
  {
    title: 'NHL and world hockey nights',
    sportKey: 'hockey',
    label: 'Model ready',
    detail: 'Puck drops, IIHF windows, and playoff calendar testing.',
    href: '/sports/hockey',
    importance: 42,
  },
  {
    title: 'Grand slam watch windows',
    sportKey: 'tennis',
    label: 'Template ready',
    detail: 'Player follows, court order, and day/night session exports.',
    href: '/sports/tennis',
    importance: 39,
  },
  {
    title: 'Major golf weekend board',
    sportKey: 'golf',
    label: 'Template ready',
    detail: 'Rounds, tee sheets, cuts, and final-day broadcast windows.',
    href: '/sports/golf',
    importance: 36,
  },
  {
    title: 'Diamond League and trials',
    sportKey: 'track',
    label: 'Source testing',
    detail: 'Heats, finals, start lists, and athlete-follow scheduling.',
    href: '/sports/track',
    importance: 32,
  },
  {
    title: 'Olympic sports capsule',
    sportKey: 'olympic',
    label: 'Source testing',
    detail: 'Swimming, gymnastics, medal events, and federation feeds.',
    href: '/sports/olympic',
    importance: 30,
  },
  {
    title: 'Community league schedules',
    sportKey: 'custom',
    label: 'On air',
    detail: 'Create local schedules for families, teams, and clubs.',
    href: '/custom-leagues',
    importance: 24,
  },
]

type SpotlightRow = {
  title: string
  sport_key: string
  label: string
  detail: string
  href: string
  global_importance: number
  ranking_score?: number
  lifecycle?: string
  template_slug?: string | null
  art_key?: string | null
  starts_at?: string | null
  ends_at?: string | null
  result_hold_until?: string | null
  schedule_release_expected_at?: string | null
  source_confidence?: string | null
}

const cache = new Map<string, SpotlightEvent[]>()
const inflight = new Map<string, Promise<SpotlightEvent[]>>()

async function fetchSpotlights(regionCode?: string | null): Promise<SpotlightEvent[]> {
  const supabase = await getSupabaseClient()
  if (!supabase) return fallbackSpotlightEvents

  const { data, error } = await supabase.rpc('spotlight_ranked', {
    region: regionCode?.toUpperCase() ?? null,
    limit_count: 16,
  })

  if (error || !data?.length) return fallbackSpotlightEvents
  return (data as SpotlightRow[]).map((row) => ({
    title: row.title,
    sportKey: row.sport_key,
    label: row.label,
    detail: row.detail,
    href: row.href,
    importance: row.ranking_score ?? row.global_importance,
    lifecycle: row.lifecycle,
    templateSlug: row.template_slug,
    artKey: row.art_key,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    resultHoldUntil: row.result_hold_until,
    scheduleReleaseExpectedAt: row.schedule_release_expected_at,
    sourceConfidence: row.source_confidence,
  }))
}

function loadSpotlights(regionCode?: string | null) {
  const key = regionCode?.toUpperCase() ?? 'GLOBAL'
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)
  if (inflight.has(key)) return inflight.get(key)!
  const promise = fetchSpotlights(regionCode)
    .then((events) => {
      cache.set(key, events)
      return events
    })
    .catch(() => fallbackSpotlightEvents)
    .finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}

export function useSpotlightEvents(regionCode?: string | null) {
  const key = regionCode?.toUpperCase() ?? 'GLOBAL'
  const [events, setEvents] = useState(() => cache.get(key) ?? fallbackSpotlightEvents)

  useEffect(() => {
    let cancelled = false
    loadSpotlights(regionCode).then((next) => {
      if (!cancelled) setEvents(next)
    })
    return () => {
      cancelled = true
    }
  }, [regionCode])

  return events
}
