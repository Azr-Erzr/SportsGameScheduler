import { describe, expect, test } from 'vitest'
import { buildExportAdvice, exportAdviceThresholds } from '../exportAdvice'

describe('buildExportAdvice', () => {
  test('warns when a static visual export is more than three pages', () => {
    const advice = buildExportAdvice({
      method: 'pdf',
      eventCount: 37,
      pageCount: exportAdviceThresholds.longExportPageLimit + 1,
    })

    expect(advice?.tone).toBe('warn')
    expect(advice?.title).toBe('This export will be long')
    expect(advice?.body).toContain('4 pages')
    expect(advice?.body).toContain('ICS file')
  })

  test('nudges dense CSV exports toward calendar tracking', () => {
    const advice = buildExportAdvice({
      method: 'csv',
      eventCount: exportAdviceThresholds.denseEventLimit,
    })

    expect(advice?.tone).toBe('info')
    expect(advice?.body).toContain('ICS is better')
  })

  test('confirms live feeds are best for changing schedules', () => {
    const advice = buildExportAdvice({
      method: 'live',
      eventCount: 12,
      liveEventCount: 12,
    })

    expect(advice?.tone).toBe('good')
    expect(advice?.title).toContain('changing schedules')
  })
})
