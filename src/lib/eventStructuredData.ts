import { sportTiming } from './sportTiming'
import { SEO_ORIGIN } from './seo'

export type StructuredEventInput = {
  id: string
  title: string
  startsAt: Date
  status?: string | null
  sportKey?: string | null
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
  return kind === 'person' ? 'Person' : 'SportsTeam'
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
  const performers = (event.competitors ?? [])
    .filter((competitor) => competitor.name.trim())
    .map((competitor) => ({
      '@type': personOrTeamType(competitor.kind),
      name: competitor.name,
    }))

  const location = event.venue
    ? {
        '@type': 'Place',
        name: event.venue,
        address:
          event.venueCity || event.venueCountry
            ? {
                '@type': 'PostalAddress',
                ...(event.venueCity ? { addressLocality: event.venueCity } : {}),
                ...(event.venueCountry ? { addressCountry: event.venueCountry } : {}),
              }
            : event.venue,
      }
    : {
        '@type': 'VirtualLocation',
        url,
      }

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: event.title,
    description: eventDescription(event),
    image: [`${SEO_ORIGIN}/og-cover.png`],
    startDate: event.startsAt.toISOString(),
    endDate: endDate.toISOString(),
    eventStatus: eventStatusUrl(event.status),
    eventAttendanceMode: event.venue
      ? 'https://schema.org/OfflineEventAttendanceMode'
      : 'https://schema.org/MixedEventAttendanceMode',
    location,
    ...(performers.length ? { performer: performers, competitor: performers } : {}),
    ...(event.leagueName ? { organizer: { '@type': 'Organization', name: event.leagueName } } : {}),
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
