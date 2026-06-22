import { describe, expect, test } from 'vitest'
import { parseCustomLeagueEventsCsv } from '../customLeagueImport'

describe('parseCustomLeagueEventsCsv', () => {
  test('imports natural spreadsheet columns into custom events', () => {
    let id = 0
    const result = parseCustomLeagueEventsCsv(
      [
        'Date,Time,Event,Opponent,Location,Arrive,Uniform,Notes',
        '2026-07-04,18:30,Practice,Eagles,"Maple Arena, Rink 2",30,White,"Bring water, tape"',
      ].join('\n'),
      { makeId: () => `event-${(id += 1)}` },
    )

    expect(result.errors).toEqual([])
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({
      id: 'event-1',
      title: 'Practice',
      opponent: 'Eagles',
      venue: 'Maple Arena, Rink 2',
      arriveEarlyMinutes: 30,
      uniformColor: 'White',
      notes: 'Bring water, tape',
      status: 'scheduled',
    })
    expect(result.events[0].startsAt).toBe(new Date('2026-07-04T18:30:00').toISOString())
  })

  test('reports skipped rows without failing the whole import', () => {
    const result = parseCustomLeagueEventsCsv(
      ['date,time,title', '2026-07-04,18:30,', 'bad-date,12:00,Valid title'].join('\n'),
      { makeId: () => 'event-1' },
    )

    expect(result.events).toEqual([])
    expect(result.errors).toEqual(['Row 2: missing title.', 'Row 3: missing or invalid date/time.'])
  })

  test('accepts explicit startsAt and status fields', () => {
    const result = parseCustomLeagueEventsCsv(
      ['startsAt,title,status', '2026-08-10T20:00:00Z,Semifinal,postponed'].join('\n'),
      { makeId: () => 'event-1' },
    )

    expect(result.errors).toEqual([])
    expect(result.events[0].startsAt).toBe('2026-08-10T20:00:00.000Z')
    expect(result.events[0].status).toBe('postponed')
  })
})
