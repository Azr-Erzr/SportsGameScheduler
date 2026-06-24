import { describe, expect, it } from 'vitest'
import { dedupeSpotlightBySport, isSpotlightCurrent, type SpotlightEvent } from '../spotlight'

const base: SpotlightEvent = { title: '', sportKey: 'soccer', label: '', detail: '', href: '', importance: 0 }
const ev = (over: Partial<SpotlightEvent>): SpotlightEvent => ({ ...base, ...over })

const NOW = new Date('2026-06-23T12:00:00Z').getTime()
const day = 24 * 60 * 60 * 1000

describe('isSpotlightCurrent', () => {
  it('keeps evergreen entries with no date', () => {
    expect(isSpotlightCurrent(ev({}), NOW)).toBe(true)
  })

  it('keeps a still-running multi-day event (started, ends later)', () => {
    expect(isSpotlightCurrent(ev({ startsAt: '2026-06-11', endsAt: '2026-07-19' }), NOW)).toBe(true)
  })

  it('disqualifies an event whose end has passed', () => {
    expect(isSpotlightCurrent(ev({ startsAt: '2026-05-01', endsAt: '2026-06-01' }), NOW)).toBe(false)
  })

  it('disqualifies a single past event with only a start', () => {
    expect(isSpotlightCurrent(ev({ startsAt: '2026-06-20' }), NOW + day)).toBe(false)
  })
})

describe('dedupeSpotlightBySport', () => {
  it('keeps the highest-importance entry per sport', () => {
    const out = dedupeSpotlightBySport([
      ev({ title: 'World Cup', sportKey: 'soccer', importance: 100 }),
      ev({ title: 'Champions League', sportKey: 'soccer', importance: 60 }),
      ev({ title: 'F1', sportKey: 'motorsport', importance: 80 }),
    ])
    expect(out.map((e) => e.title)).toEqual(['World Cup', 'F1'])
  })

  it('collapses route and canonical keys for the same sport (combat vs combat_sports)', () => {
    const out = dedupeSpotlightBySport([
      ev({ title: 'UFC (db)', sportKey: 'combat_sports', importance: 72 }),
      ev({ title: 'UFC (fallback)', sportKey: 'combat', importance: 70 }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('UFC (db)')
  })
})
