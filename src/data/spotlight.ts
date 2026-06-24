import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import { getSport } from '../domain/sports'

// Spotlight rows arrive with inconsistent sport keys (route keys like "combat" AND canonical keys
// like "combat_sports"). Collapse to the canonical key so dedupe treats them as one sport.
function canonicalKey(sportKey: string): string {
  return getSport(sportKey)?.canonicalSportKey ?? sportKey
}

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

// A spotlight is disqualified once its event has demonstrably passed. We only drop entries that
// carry a concrete end/start in the past — evergreen promos (no date) and still-running multi-day
// events (World Cup: started, but ends weeks out) stay. Keeps stale/finished competitions off the
// board even if the DB ranking hasn't caught up.
export function isSpotlightCurrent(event: SpotlightEvent, now = Date.now()): boolean {
  const cutoff = event.endsAt ?? event.startsAt
  if (!cutoff) return true
  const time = new Date(cutoff).getTime()
  if (Number.isNaN(time)) return true
  // 12h grace so an event finishing today doesn't vanish mid-day.
  return time >= now - 12 * 60 * 60 * 1000
}

// One card per sport on the board: a single sport showing twice (e.g. World Cup + Champions League)
// reads as a bug. Keep the highest-importance current entry for each sport, importance-ordered.
export function dedupeSpotlightBySport(events: SpotlightEvent[]): SpotlightEvent[] {
  const ranked = [...events].sort((a, b) => b.importance - a.importance)
  const seen = new Set<string>()
  const out: SpotlightEvent[] = []
  for (const event of ranked) {
    const key = canonicalKey(event.sportKey)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(event)
  }
  return out
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

  // Disqualify passed events regardless of the DB ranking; the site stays oriented to today's date.
  return events.filter((event) => isSpotlightCurrent(event))
}
