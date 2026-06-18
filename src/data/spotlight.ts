import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabase'

export type SpotlightEvent = {
  title: string
  sportKey: string
  label: string
  detail: string
  href: string
  importance: number
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
    href: '/sports/f1',
    importance: 84,
  },
  {
    title: 'UFC / PFL fight cards',
    sportKey: 'combat',
    label: 'Model ready',
    detail: 'Main cards, prelims, fighters, and late changes.',
    href: '/sports/ufc',
    importance: 72,
  },
  {
    title: 'WNBA schedule tracking',
    sportKey: 'basketball',
    label: 'Source testing',
    detail: 'TheSportsDB premium, SportsDataIO, and Sportradar candidates.',
    href: '/sports/wnba',
    importance: 55,
  },
  {
    title: 'CFL and Grey Cup path',
    sportKey: 'football',
    label: 'Canada focus',
    detail: 'Canadian kickoff times and broadcast-region fit.',
    href: '/sports/cfl',
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
}

let cache: SpotlightEvent[] | null = null
let inflight: Promise<SpotlightEvent[]> | null = null

async function fetchSpotlights(): Promise<SpotlightEvent[]> {
  const supabase = await getSupabaseClient()
  if (!supabase) return fallbackSpotlightEvents

  const { data, error } = await supabase
    .from('spotlight_events')
    .select('title, sport_key, label, detail, href, global_importance')
    .eq('is_active', true)
    .order('global_importance', { ascending: false })
    .order('starts_at', { ascending: true, nullsFirst: false })
    .limit(16)

  if (error || !data?.length) return fallbackSpotlightEvents
  return (data as SpotlightRow[]).map((row) => ({
    title: row.title,
    sportKey: row.sport_key,
    label: row.label,
    detail: row.detail,
    href: row.href,
    importance: row.global_importance,
  }))
}

function loadSpotlights() {
  if (cache) return Promise.resolve(cache)
  inflight ??= fetchSpotlights()
    .then((events) => {
      cache = events
      return events
    })
    .catch(() => fallbackSpotlightEvents)
  return inflight
}

export function useSpotlightEvents() {
  const [events, setEvents] = useState(() => cache ?? fallbackSpotlightEvents)

  useEffect(() => {
    let cancelled = false
    loadSpotlights().then((next) => {
      if (!cancelled) setEvents(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return events
}
