import { describe, expect, it } from 'vitest'
import { getLoopingScrollProgress } from '../scrollMotion'

describe('getLoopingScrollProgress', () => {
  it('travels out and returns smoothly instead of freezing at the end', () => {
    expect(getLoopingScrollProgress(0, 800)).toBe(0)
    expect(getLoopingScrollProgress(700, 800)).toBeCloseTo(0.5)
    expect(getLoopingScrollProgress(1400, 800)).toBe(1)
    expect(getLoopingScrollProgress(2100, 800)).toBeCloseTo(0.5)
    expect(getLoopingScrollProgress(2800, 800)).toBe(0)
  })

  it('continues looping across very long scroll distances', () => {
    expect(getLoopingScrollProgress(3500, 800)).toBeCloseTo(0.5)
    expect(getLoopingScrollProgress(4200, 800)).toBe(1)
    expect(getLoopingScrollProgress(5600, 800)).toBe(0)
  })

  it('clamps invalid or negative positions to the start', () => {
    expect(getLoopingScrollProgress(-500, 800)).toBe(0)
    expect(getLoopingScrollProgress(Number.NaN, 800)).toBe(0)
  })
})
