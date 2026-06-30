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
      image: ['https://silbosports.com/og-cover.png'],
      startDate: '2026-07-07T19:00:00.000Z',
      endDate: '2026-07-07T20:55:00.000Z',
      organizer: { '@type': 'Organization', name: 'UEFA Champions League' },
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
    expect(data.performer).toEqual([
      { '@type': 'SportsTeam', name: 'Arsenal' },
      { '@type': 'SportsTeam', name: 'Barcelona' },
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

    expect(data.location).toMatchObject({
      '@type': 'Place',
      name: 'Vikingsvollur',
      address: 'Vikingsvollur',
    })
  })

  it('marks person competitors as performers for individual sports', () => {
    const data = eventStructuredData({
      id: 'event-3',
      title: 'Fighter A vs Fighter B',
      startsAt: new Date('2026-08-01T02:00:00Z'),
      sportKey: 'combat_sports',
      competitors: [
        { name: 'Fighter A', kind: 'person' },
        { name: 'Fighter B', kind: 'person' },
      ],
    })

    expect(data.performer).toEqual([
      { '@type': 'Person', name: 'Fighter A' },
      { '@type': 'Person', name: 'Fighter B' },
    ])
    expect(data.endDate).toBe('2026-08-01T07:00:00.000Z')
  })
})
