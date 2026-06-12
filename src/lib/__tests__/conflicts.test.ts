import { describe, expect, test } from 'vitest'
import { findConflicts } from '../conflicts'

const at = (iso: string) => ({ startsAt: new Date(iso) })

describe('findConflicts', () => {
  test('flags simultaneous kickoffs', () => {
    const items = [at('2026-06-24T19:00:00Z'), at('2026-06-24T19:00:00Z'), at('2026-06-25T19:00:00Z')]
    const conflicts = findConflicts(items)
    expect(conflicts.has(0)).toBe(true)
    expect(conflicts.has(1)).toBe(true)
    expect(conflicts.has(2)).toBe(false)
  })

  test('flags overlaps within the default 2h window', () => {
    const conflicts = findConflicts([at('2026-06-24T19:00:00Z'), at('2026-06-24T20:30:00Z')])
    expect(conflicts.size).toBe(2)
  })

  test('back-to-back events do not conflict', () => {
    const conflicts = findConflicts([at('2026-06-24T17:00:00Z'), at('2026-06-24T19:00:00Z')])
    expect(conflicts.size).toBe(0)
  })

  test('handles unsorted input', () => {
    const conflicts = findConflicts([at('2026-06-24T20:30:00Z'), at('2026-06-24T19:00:00Z')])
    expect(conflicts.size).toBe(2)
  })

  test('empty input', () => {
    expect(findConflicts([]).size).toBe(0)
  })
})
