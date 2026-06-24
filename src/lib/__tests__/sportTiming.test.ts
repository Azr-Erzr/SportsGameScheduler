import { describe, expect, it } from 'vitest'
import { findConflictTiers, overlapTier, sportTiming } from '../sportTiming'

const at = (iso: string) => ({ start: new Date(iso).getTime(), sportKey: 'soccer' })

describe('sportTiming', () => {
  it('resolves route and canonical keys', () => {
    expect(sportTiming('soccer').typicalMin).toBe(115)
    expect(sportTiming('combat').typicalMin).toBe(sportTiming('combat_sports').typicalMin)
    expect(sportTiming('unknown').typicalMin).toBe(120) // default
  })
})

describe('overlapTier', () => {
  it('flags same start time as a true overlap', () => {
    expect(overlapTier(at('2026-06-24T19:00:00Z'), at('2026-06-24T19:00:00Z'))).toBe('overlap')
  })

  it('flags soccer matches well inside full-time as overlap', () => {
    // 60 min apart, soccer runs ~115 → deep overlap
    expect(overlapTier(at('2026-06-24T19:00:00Z'), at('2026-06-24T20:00:00Z'))).toBe('overlap')
  })

  it('flags a near-full-time gap as close (the ~110-min soccer case)', () => {
    // 125 min apart: soccer ends ~115, next starts 10 min later → within the ±20 margin
    expect(overlapTier(at('2026-06-24T19:00:00Z'), at('2026-06-24T21:05:00Z'))).toBe('close')
  })

  it('does not flag clearly separated events', () => {
    // 3h apart, soccer ~115 → ~65 min of clear air
    expect(overlapTier(at('2026-06-24T15:00:00Z'), at('2026-06-24T18:00:00Z'))).toBeNull()
  })

  it('softens an all-day sport clash with a different sport to close', () => {
    const golf = { start: new Date('2026-06-24T16:00:00Z').getTime(), sportKey: 'golf' }
    const soccer = { start: new Date('2026-06-24T17:00:00Z').getTime(), sportKey: 'soccer' }
    expect(overlapTier(golf, soccer)).toBe('close')
  })
})

describe('findConflictTiers', () => {
  it('marks two simultaneous matches as overlap and leaves a distant one clear', () => {
    const tiers = findConflictTiers([
      { startsAt: new Date('2026-06-24T19:00:00Z'), sportKey: 'soccer' },
      { startsAt: new Date('2026-06-24T19:00:00Z'), sportKey: 'soccer' },
      { startsAt: new Date('2026-06-24T23:30:00Z'), sportKey: 'soccer' },
    ])
    expect(tiers.get(0)).toBe('overlap')
    expect(tiers.get(1)).toBe('overlap')
    expect(tiers.get(2)).toBeUndefined()
  })
})
