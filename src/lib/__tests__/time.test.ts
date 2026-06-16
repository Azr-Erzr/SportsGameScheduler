import { describe, expect, test } from 'vitest'
import { formatTimeParts, parseKickoff, relativeTimeFromNow } from '../time'

describe('relativeTimeFromNow', () => {
  const now = new Date('2026-06-15T12:00:00Z').getTime()
  test('sub-minute reads as just now', () => {
    expect(relativeTimeFromNow(new Date('2026-06-15T11:59:30Z'), now)).toBe('just now')
  })
  test('minutes / hours / days', () => {
    expect(relativeTimeFromNow(new Date('2026-06-15T11:30:00Z'), now)).toBe('30m ago')
    expect(relativeTimeFromNow(new Date('2026-06-15T09:00:00Z'), now)).toBe('3h ago')
    expect(relativeTimeFromNow(new Date('2026-06-13T12:00:00Z'), now)).toBe('2d ago')
  })
})

describe('parseKickoff', () => {
  test('parses whole-hour offsets', () => {
    // 13:00 UTC-6 == 19:00 UTC
    expect(parseKickoff('2026-06-11', '13:00 UTC-6').toISOString()).toBe('2026-06-11T19:00:00.000Z')
  })

  test('parses positive offsets', () => {
    expect(parseKickoff('2026-06-11', '20:00 UTC+2').toISOString()).toBe('2026-06-11T18:00:00.000Z')
  })

  test('parses half-hour offsets (the original prototype bug)', () => {
    // 19:30 IST (UTC+5:30) == 14:00 UTC
    expect(parseKickoff('2026-06-11', '19:30 UTC+5:30').toISOString()).toBe('2026-06-11T14:00:00.000Z')
    // Newfoundland: 10:00 UTC-3:30 == 13:30 UTC
    expect(parseKickoff('2026-06-11', '10:00 UTC-3:30').toISOString()).toBe('2026-06-11T13:30:00.000Z')
  })

  test('falls back to midnight UTC for unparseable times', () => {
    expect(parseKickoff('2026-06-11', 'TBD').toISOString()).toBe('2026-06-11T00:00:00.000Z')
  })
})

describe('formatTimeParts', () => {
  test('separates clock from zone without string-splitting', () => {
    const date = new Date('2026-06-11T19:00:00Z')
    const { clock, zone } = formatTimeParts(date, 'America/Toronto', { locale: 'en-US' })
    expect(clock).toMatch(/3:00/)
    expect(zone).toMatch(/EDT/)
  })

  test('works for 24h locales where split(" ") would break', () => {
    const date = new Date('2026-06-11T19:00:00Z')
    const { clock, zone } = formatTimeParts(date, 'Europe/Paris', { locale: 'fr-FR' })
    expect(clock).toMatch(/21:00/)
    expect(zone.length).toBeGreaterThan(0)
  })
})
