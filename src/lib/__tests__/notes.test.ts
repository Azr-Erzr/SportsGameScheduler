import { describe, expect, test } from 'vitest'
import { createMultiSportNotesText, createNotesText } from '../notes'
import { sportEmoji } from '../ics'

describe('createNotesText', () => {
  test('keeps the World Cup snapshot export readable', () => {
    const text = createNotesText(
      [
        {
          date: '2026-06-11',
          time: '13:00 UTC-6',
          startsAt: new Date('2026-06-11T19:00:00Z'),
          team1: 'Mexico',
          team2: 'South Africa',
          group: 'Group A',
          round: 'Group stage',
          ground: 'Estadio Azteca, Mexico City',
        },
      ],
      ['Mexico'],
      'America/Toronto',
      'Toronto',
      'en-CA',
      true,
    )

    expect(text).toContain('World Cup 2026 schedule')
    expect(text).toContain('Mexico vs South Africa')
    expect(text).toContain('Estadio Azteca, Mexico City')
  })
})

describe('createMultiSportNotesText', () => {
  test('renders sport, league, venue, and local time for DB-backed events', () => {
    const text = createMultiSportNotesText(
      [
        {
          title: 'Lakers vs Celtics',
          startsAt: new Date('2026-06-20T23:00:00Z'),
          sportKey: 'basketball',
          leagueName: 'NBA',
          venue: 'Crypto.com Arena',
          status: 'scheduled',
        },
      ],
      'America/Toronto',
      'Toronto',
      'en-CA',
      true,
    )

    expect(text).toContain('all-sports schedule')
    expect(text).toContain(`${sportEmoji('basketball')} Lakers vs Celtics`)
    expect(text).toContain('NBA - Crypto.com Arena')
    expect(text).toContain('Toronto local time - America/Toronto')
  })

  test('labels uncertain live events without inventing a kickoff time', () => {
    const text = createMultiSportNotesText(
      [
        {
          title: 'Semifinal winner TBD',
          startsAt: new Date('2026-07-10T00:00:00Z'),
          startsAtTbd: true,
          sportKey: 'soccer',
          leagueName: 'FIFA World Cup',
          status: 'postponed',
        },
        {
          title: 'Draw pending',
          startsAt: null,
          sportKey: null,
          leagueName: 'Tennis',
        },
      ],
      'America/Toronto',
      'Toronto',
      'en-CA',
      null,
    )

    expect(text).toContain('time TBD')
    expect(text).toContain('postponed')
    expect(text).toContain('Date/time TBD')
    expect(text).toContain(`${sportEmoji(null)} Draw pending`)
  })
})
