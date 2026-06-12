import { describe, expect, test } from 'vitest'
import { paginateEvents } from '../paginate'

describe('paginateEvents', () => {
  const makeEvents = (count: number) => Array.from({ length: count }, (_, index) => ({ id: index }))

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
