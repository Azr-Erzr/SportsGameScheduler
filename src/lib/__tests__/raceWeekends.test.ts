import { describe, expect, it } from 'vitest'
import {
  classifyRaceSession,
  groupRaceWeekends,
  parseRaceWeekendTitle,
  type RaceEventInput,
} from '../raceWeekends'

function ev(title: string, iso: string | null, extra: Partial<RaceEventInput> = {}): RaceEventInput {
  return {
    id: title,
    title,
    startsAt: iso ? new Date(iso) : null,
    startsAtTbd: iso === null,
    leagueName: 'Formula 1',
    venue: null,
    ...extra,
  }
}

describe('parseRaceWeekendTitle', () => {
  it('splits weekend from session on the last separator', () => {
    expect(parseRaceWeekendTitle('Monaco Grand Prix - Practice 1')).toEqual({
      weekend: 'Monaco Grand Prix',
      label: 'Practice 1',
    })
  })

  it('treats a separator-less title as the race itself', () => {
    expect(parseRaceWeekendTitle('Bahrain Grand Prix')).toEqual({ weekend: 'Bahrain Grand Prix', label: 'Race' })
  })
})

describe('classifyRaceSession', () => {
  it('classifies the standard session types', () => {
    expect(classifyRaceSession('Practice 1')).toBe('practice')
    expect(classifyRaceSession('Free Practice 3')).toBe('practice')
    expect(classifyRaceSession('Qualifying')).toBe('qualifying')
    expect(classifyRaceSession('Sprint')).toBe('sprint')
    expect(classifyRaceSession('Sprint Qualifying')).toBe('sprint_qualifying')
    expect(classifyRaceSession('Sprint Shootout')).toBe('sprint_qualifying')
    expect(classifyRaceSession('Race')).toBe('race')
  })

  it('does not misread sprint qualifying as plain qualifying', () => {
    expect(classifyRaceSession('Sprint Qualifying')).not.toBe('qualifying')
  })
})

describe('groupRaceWeekends', () => {
  it('groups a flat session list into one weekend, session-ordered, with the race flagged', () => {
    const events = [
      ev('Monaco Grand Prix - Race', '2026-05-24T13:00:00Z', { venue: 'Circuit de Monaco' }),
      ev('Monaco Grand Prix - Practice 1', '2026-05-22T11:30:00Z'),
      ev('Monaco Grand Prix - Qualifying', '2026-05-23T14:00:00Z'),
    ]
    const weekends = groupRaceWeekends(events)
    expect(weekends).toHaveLength(1)
    const monaco = weekends[0]
    expect(monaco.name).toBe('Monaco Grand Prix')
    expect(monaco.sessions.map((s) => s.kind)).toEqual(['practice', 'qualifying', 'race'])
    expect(monaco.race?.event.title).toBe('Monaco Grand Prix - Race')
    expect(monaco.venue).toBe('Circuit de Monaco') // inherited from whichever session carries it
    expect(monaco.start?.toISOString()).toBe('2026-05-22T11:30:00.000Z')
    expect(monaco.end?.toISOString()).toBe('2026-05-24T13:00:00.000Z')
  })

  it('keeps separate Grands Prix apart and orders weekends chronologically', () => {
    const events = [
      ev('Spanish Grand Prix - Race', '2026-06-07T13:00:00Z'),
      ev('Monaco Grand Prix - Race', '2026-05-24T13:00:00Z'),
    ]
    const weekends = groupRaceWeekends(events)
    expect(weekends.map((w) => w.name)).toEqual(['Monaco Grand Prix', 'Spanish Grand Prix'])
  })

  it('sinks undated weekends to the bottom', () => {
    const events = [ev('Future Grand Prix - Race', null), ev('Monaco Grand Prix - Race', '2026-05-24T13:00:00Z')]
    const weekends = groupRaceWeekends(events)
    expect(weekends[0].name).toBe('Monaco Grand Prix')
    expect(weekends[1].name).toBe('Future Grand Prix')
  })
})
