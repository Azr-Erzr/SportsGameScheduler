import { describe, expect, test } from 'vitest'
import { createMultiSportIcsBlob, escapeIcsText, sportEmoji } from '../ics'
import type { LiveEvent } from '../../data/liveSport'

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
