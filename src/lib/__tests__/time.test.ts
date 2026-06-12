import { describe, expect, test } from 'vitest'
import { formatTimeParts, parseKickoff } from '../time'

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
