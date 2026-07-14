import { sportTiming } from './sportTiming'
import { SEO_ORIGIN } from './seo'

export type StructuredEventInput = {
  id: string
  title: string
  startsAt: Date
  status?: string | null
  sportKey?: string | null
  leagueId?: string | null
  leagueName?: string | null
  venue?: string | null
  venueCity?: string | null
  venueCountry?: string | null
  competitors?: Array<{ name: string; kind?: string | null }>
}

function eventStatusUrl(status?: string | null) {
  if (status === 'cancelled') return 'https://schema.org/EventCancelled'
  if (status === 'postponed') return 'https://schema.org/EventPostponed'
  return 'https://schema.org/EventScheduled'
}

function personOrTeamType(kind?: string | null) {
  return kind === 'person' ? 'Person' : 'PerformingGroup'
}

function inferredMatchPerformers(title: string) {
  const names = title
    .split(/\s+(?:vs\.?|versus|v\.?)\s+/i)
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length !== 2 || names.some((name) => /^(?:tbd|tbc|unknown)$/i.test(name))) return []
  return names.map((name) => ({ '@type': 'PerformingGroup', name }))
}

export function eventDescription(event: StructuredEventInput) {
  const parts = [
    event.title,
    event.leagueName ? `in ${event.leagueName}` : null,
    event.venue ? `at ${event.venue}` : null,
  ].filter(Boolean)
  return `${parts.join(' ')}. See the start time in your local timezone, find where to watch, and add it to your calendar with Silbo Sports.`
}

export function eventStructuredData(event: StructuredEventInput) {
  const url = `${SEO_ORIGIN}/events/${event.id}`
  const endDate = new Date(event.startsAt.getTime() + sportTiming(event.sportKey).typicalMin * 60_000)
  const explicitPerformers = (event.competitors ?? [])
    .filter((competitor) => competitor.name.trim())
    .map((competitor) => ({
      '@type': personOrTeamType(competitor.kind),
      name: competitor.name,
    }))
  const performers = explicitPerformers.length ? explicitPerformers : inferredMatchPerformers(event.title)

  // A SportsEvent is physical: it needs a real Place location. Without venue/city/country we can't
  // emit a valid one, so we skip the JSON-LD (null) rather than emit an invalid item Google flags.
  const location =
    event.venue || event.venueCity || event.venueCountry
      ? {
          '@type': 'Place',
          name: event.venue || event.venueCity || event.leagueName || 'Venue to be confirmed',
          address:
            event.venueCity || event.venueCountry
              ? {
                  '@type': 'PostalAddress',
                  ...(event.venueCity ? { addressLocality: event.venueCity } : {}),
                  ...(event.venueCountry ? { addressCountry: event.venueCountry } : {}),
                }
              : event.venue,
        }
      : null
  // Google recommends a named Person/PerformingGroup for Event markup. A match title can safely
  // supply both sides when provider links are missing; races/sessions without entrant data cannot.
  if (!location || !performers.length) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: event.title,
    description: eventDescription(event),
    image: [`${SEO_ORIGIN}/og-cover-2026-07.png`],
    startDate: event.startsAt.toISOString(),
    endDate: endDate.toISOString(),
    eventStatus: eventStatusUrl(event.status),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location,
    performer: performers,
    competitor: performers,
    organizer: {
      '@type': 'Organization',
      name: event.leagueName || 'Silbo Sports',
      url: event.leagueId ? `${SEO_ORIGIN}/leagues/${event.leagueId}` : SEO_ORIGIN,
    },
    offers: {
      '@type': 'Offer',
      name: 'Free Silbo Sports schedule page',
      url,
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      validFrom: new Date(0).toISOString(),
    },
    url,
  }
}
