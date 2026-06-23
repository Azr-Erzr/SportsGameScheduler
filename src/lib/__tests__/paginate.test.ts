import { describe, expect, test } from 'vitest'
import { paginateEvents, paginateEventsForPoster } from '../paginate'

const makeEvents = (count: number) => Array.from({ length: count }, (_, index) => ({ id: index }))

describe('paginateEvents', () => {

  test('paginates long schedules into readable pages (plan Objective 13 example)', () => {
    const pages = paginateEvents(makeEvents(31), 'poster')
    expect(pages).toHaveLength(4)
    expect(pages[0]).toHaveLength(9)
    expect(pages[3]).toHaveLength(4)
  })

  test('single short schedule stays on one page', () => {
    expect(paginateEvents(makeEvents(5), 'story')).toHaveLength(1)
  })

  test('empty schedule produces no pages', () => {
    expect(paginateEvents([], 'compact')).toHaveLength(0)
  })

  test('family template fits fewer events per page', () => {
    const pages = paginateEvents(makeEvents(13), 'family')
    expect(pages).toHaveLength(3)
    expect(pages[0]).toHaveLength(6)
  })
})

describe('paginateEventsForPoster', () => {
  test('first and last pages keep the base count; interior pages carry one extra', () => {
    const pages = paginateEventsForPoster(makeEvents(28), 'poster') // base 9
    expect(pages.map((p) => p.length)).toEqual([9, 10, 9]) // 3 pages instead of 4
    expect(pages.reduce((n, p) => n + p.length, 0)).toBe(28)
  })

  test('short schedules stay on a single page', () => {
    expect(paginateEventsForPoster(makeEvents(9), 'poster')).toHaveLength(1)
    expect(paginateEventsForPoster([], 'poster')).toHaveLength(0)
  })

  test('two-page schedules get no interior bonus', () => {
    expect(paginateEventsForPoster(makeEvents(15), 'poster').map((p) => p.length)).toEqual([9, 6])
  })
})
