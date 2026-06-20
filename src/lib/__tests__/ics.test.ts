import { describe, expect, test } from 'vitest'
import { eventToVevent as serverEventToVevent } from '../../../supabase/functions/_shared/ics'
import { createIcsBlob, createMultiSportIcsBlob, escapeIcsText, foldIcsLine, sportEmoji } from '../ics'
import type { LiveEvent } from '../../data/liveSport'
import type { Match } from '../../domain/match'

function makeEvent(over: Partial<LiveEvent> = {}): LiveEvent {
  return {
    id: 'evt-1',
    title: 'Lakers vs Celtics',
    startsAt: new Date('2026-06-20T23:00:00Z'),
    startsAtTbd: false,
    status: 'scheduled',
    leagueId: 'lg-1',
    leagueName: 'NBA',
    sportKey: 'basketball',
    venue: 'Crypto.com Arena',
    ...over,
  }
}

describe('escapeIcsText (RFC 5545 §3.3.11)', () => {
  test('escapes backslash first, then structural characters', () => {
    expect(escapeIcsText('a\\b;c,d')).toBe('a\\\\b\\;c\\,d')
  })

  test('converts newlines to literal \\n', () => {
    expect(escapeIcsText('line1\nline2\r\nline3')).toBe('line1\\nline2\\nline3')
  })

  test('passes plain text through unchanged', () => {
    expect(escapeIcsText('Mexico vs South Africa')).toBe('Mexico vs South Africa')
  })

  test('venue names with commas no longer break LOCATION fields', () => {
    expect(escapeIcsText('Estadio Azteca, Mexico City')).toBe('Estadio Azteca\\, Mexico City')
  })
})

describe('foldIcsLine', () => {
  test('keeps generated ICS content lines within 75 bytes', () => {
    const folded = foldIcsLine(
      'SUMMARY:Silbo Sports confirmed schedule with a very long matchup title that should fold cleanly',
    )

    expect(folded).toContain('\r\n ')
    for (const line of folded.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })
})

describe('sportEmoji', () => {
  test('maps provider-backed secondary sports', () => {
    expect(sportEmoji('baseball')).toBe('BSB')
    expect(sportEmoji('cricket')).toBe('CRI')
  })

  test('maps known sports', () => {
    expect(sportEmoji('soccer')).toBe('⚽')
    expect(sportEmoji('combat_sports')).toBe('🥊')
  })
  test('falls back for unknown/null', () => {
    expect(sportEmoji(null)).toBe('📅')
    expect(sportEmoji('quidditch')).toBe('📅')
  })
})

describe('createMultiSportIcsBlob', () => {
  async function render(events: LiveEvent[], options?: { reminderMinutes?: number[] }) {
    return (await createMultiSportIcsBlob(events, options).text())
  }

  test('renders secondary provider sports with categories', async () => {
    const ics = await render([makeEvent({ sportKey: 'baseball', leagueName: 'MLB', title: 'Blue Jays vs Yankees' })])
    expect(ics).toContain('SUMMARY:BSB Blue Jays vs Yankees')
    expect(ics).toContain('CATEGORIES:Baseball,MLB')
  })

  test('prefixes the summary with the sport emoji and tags categories', async () => {
    const ics = await render([makeEvent()])
    expect(ics).toContain('SUMMARY:🏀 Lakers vs Celtics')
    expect(ics).toContain('CATEGORIES:Basketball,NBA')
    expect(ics).toContain('STATUS:CONFIRMED')
  })

  test('adds a VALARM for each reminder on timed events', async () => {
    const ics = await render([makeEvent()], { reminderMinutes: [60, 1440] })
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER:-PT60M')
    expect(ics).toContain('TRIGGER:-PT1440M')
  })

  test('renders TBD-time events as all-day with no alarm', async () => {
    const ics = await render([makeEvent({ startsAtTbd: true })], { reminderMinutes: [60] })
    expect(ics).toContain('DTSTART;VALUE=DATE:')
    expect(ics).not.toContain('BEGIN:VALARM')
  })

  test('marks cancelled events', async () => {
    const ics = await render([makeEvent({ status: 'cancelled' })])
    expect(ics).toContain('STATUS:CANCELLED')
  })

  test('skips events without a start time', async () => {
    const ics = await render([makeEvent({ startsAt: null })])
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})

describe('createIcsBlob', () => {
  async function render(matches: Match[]) {
    return createIcsBlob(matches, 'America/Toronto', 'en-CA', true).text()
  }

  test('renders a valid snapshot calendar with correct UTC time, title, venue, and description', async () => {
    const ics = await render([
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
    ])
    const unfolded = ics.replace(/\r\n /g, '')

    expect(unfolded).toContain('BEGIN:VCALENDAR')
    expect(unfolded).toContain('VERSION:2.0')
    expect(unfolded).toContain('CALSCALE:GREGORIAN')
    expect(unfolded).toContain('METHOD:PUBLISH')
    expect(unfolded).toContain('X-WR-CALNAME:Silbo Sports World Cup Schedule')
    expect(unfolded).toContain('BEGIN:VEVENT')
    expect(unfolded).toContain('DTSTART:20260611T190000Z')
    expect(unfolded).toContain('DTEND:20260611T210000Z')
    expect(unfolded).toContain('SUMMARY:Mexico vs South Africa')
    expect(unfolded).toContain('LOCATION:Estadio Azteca\\, Mexico City')
    expect(unfolded).toContain('DESCRIPTION:Round: Group stage\\nGroup: Group A\\nVenue: Estadio Azteca\\, Mexico City')
  })
})

describe('server live-feed ICS renderer', () => {
  test('uses stable UID, sequence, location, broadcast notes, and folded lines', () => {
    const vevent = serverEventToVevent({
      id: 'event-123',
      title:
        'A very long championship match title with many details that should not exceed the iCalendar line length limit',
      starts_at: '2026-07-14T01:30:00.000Z',
      starts_at_tbd: false,
      updated_at: '2026-07-01T12:00:00.000Z',
      version: 7,
      status: 'scheduled',
      venue_name: 'Rogers Centre, Toronto',
      sport_key: 'baseball',
      league_name: 'MLB',
      broadcasts: [{ country: 'CA', channel: 'Sportsnet', kind: 'tv', stream_url: 'https://example.test/watch' }],
    })
    const unfolded = vevent.replace(/\r\n /g, '')

    expect(unfolded).toContain('UID:event-123@silbosports.app')
    expect(unfolded).toContain('SEQUENCE:7')
    expect(unfolded).toContain('DTSTART:20260714T013000Z')
    expect(unfolded).toContain('LOCATION:Rogers Centre\\, Toronto')
    expect(unfolded).toContain('Where to watch: Sportsnet (CA): https://example.test/watch')

    for (const line of vevent.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })
})
