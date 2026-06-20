import { describe, expect, test } from 'vitest'
import { createScheduleCsv, exportCompletionMessage } from '../scheduleExports'

describe('createScheduleCsv', () => {
  test('quotes headers and escapes commas/quotes for spreadsheet imports', () => {
    const csv = createScheduleCsv(
      [
        {
          date: '2026-06-11',
          time: '13:00 UTC-6',
          startsAt: new Date('2026-06-11T19:00:00Z'),
          team1: 'Mexico',
          team2: 'South Africa',
          group: 'Group A',
          round: 'Group stage',
          ground: 'Estadio "Azteca", Mexico City',
        },
      ],
      'America/Toronto',
      'en-CA',
      true,
    )

    expect(csv).toContain('"Date","Time","Team 1","Team 2","Round","Group","Venue","Timezone"')
    expect(csv).toContain('"Estadio ""Azteca"", Mexico City"')
  })
})

describe('exportCompletionMessage', () => {
  test('keeps one-time calendar copy honest about live updates', () => {
    expect(exportCompletionMessage('ics')).toContain('Use Silbo Sync for automatic updates')
  })
})
