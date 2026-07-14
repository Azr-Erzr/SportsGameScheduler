import { describe, expect, it } from 'vitest'
import { eventStructuredData } from '../eventStructuredData'

describe('eventStructuredData', () => {
  it('fills Google recommended Event fields from real event data', () => {
    const data = eventStructuredData({
      id: 'event-1',
      title: 'Arsenal vs Barcelona',
      startsAt: new Date('2026-07-07T19:00:00Z'),
      status: 'scheduled',
      sportKey: 'soccer',
      leagueId: 'league-9',
      leagueName: 'UEFA Champions League',
      venue: 'Example Stadium',
      venueCity: 'London',
      venueCountry: 'GB',
      competitors: [
        { name: 'Arsenal', kind: 'team' },
        { name: 'Barcelona', kind: 'team' },
      ],
    })

    expect(data).toMatchObject({
      '@type': 'SportsEvent',
      name: 'Arsenal vs Barcelona',
      description: expect.stringContaining('UEFA Champions League'),
      image: ['https://silbosports.com/og-cover-2026-07.png'],
      startDate: '2026-07-07T19:00:00.000Z',
      endDate: '2026-07-07T20:55:00.000Z',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      organizer: {
        '@type': 'Organization',
        name: 'UEFA Champions League',
        url: 'https://silbosports.com/leagues/league-9',
      },
      location: {
        '@type': 'Place',
        name: 'Example Stadium',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'London',
          addressCountry: 'GB',
        },
      },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        url: 'https://silbosports.com/events/event-1',
      },
    })
    expect(data!.performer).toEqual([
      { '@type': 'PerformingGroup', name: 'Arsenal' },
      { '@type': 'PerformingGroup', name: 'Barcelona' },
    ])
  })

  it('keeps an address fallback when only the venue name is known', () => {
    const data = eventStructuredData({
      id: 'event-2',
      title: 'Vikingur Reykjavik vs Gyori ETO',
      startsAt: new Date('2026-07-07T19:00:00Z'),
      sportKey: 'soccer',
      leagueName: 'UEFA Champions League',
      venue: 'Vikingsvollur',
    })

    expect(data!.location).toMatchObject({
      '@type': 'Place',
      name: 'Vikingsvollur',
      address: 'Vikingsvollur',
    })
    expect(data!.performer).toEqual([
      { '@type': 'PerformingGroup', name: 'Vikingur Reykjavik' },
      { '@type': 'PerformingGroup', name: 'Gyori ETO' },
    ])
    // No leagueId → organizer url falls back to the site origin, still a valid absolute URL.
    expect(data!.organizer).toMatchObject({ name: 'UEFA Champions League', url: 'https://silbosports.com' })
  })

  it('marks person competitors as performers for individual sports', () => {
    const data = eventStructuredData({
      id: 'event-3',
      title: 'Fighter A vs Fighter B',
      startsAt: new Date('2026-08-01T02:00:00Z'),
      sportKey: 'combat_sports',
      venue: 'T-Mobile Arena',
      venueCity: 'Las Vegas',
      venueCountry: 'US',
      competitors: [
        { name: 'Fighter A', kind: 'person' },
        { name: 'Fighter B', kind: 'person' },
      ],
    })

    expect(data!.performer).toEqual([
      { '@type': 'Person', name: 'Fighter A' },
      { '@type': 'Person', name: 'Fighter B' },
    ])
    expect(data!.endDate).toBe('2026-08-01T07:00:00.000Z')
  })

  it('returns null (no invalid Event markup) when there is no location at all', () => {
    const data = eventStructuredData({
      id: 'event-4',
      title: 'TBD vs TBD',
      startsAt: new Date('2026-08-01T02:00:00Z'),
      sportKey: 'soccer',
      leagueName: 'FIFA World Cup',
    })
    expect(data).toBeNull()
  })

  it('returns null when a race has no real or safely inferred performers', () => {
    const data = eventStructuredData({
      id: 'event-5',
      title: 'Tokyo ePrix Qualifying',
      startsAt: new Date('2026-07-26T06:40:00Z'),
      sportKey: 'motorsport',
      leagueName: 'Formula E',
      venue: 'Tokyo Street Circuit',
    })
    expect(data).toBeNull()
  })
})
