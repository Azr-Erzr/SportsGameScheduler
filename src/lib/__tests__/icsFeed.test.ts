import { describe, expect, test } from 'vitest'
import { externalIcsId, hashIcsEvent, parseIcsFeed } from '../../../supabase/functions/_shared/ics-feed'

const sample = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'X-WR-CALNAME:Official Test Feed',
  'BEGIN:VEVENT',
  'UID:event-1@example.test',
  'SEQUENCE:4',
  'DTSTART:20260714T013000Z',
  'DTEND:20260714T033000Z',
  'SUMMARY:Blue Jays vs Yankees',
  'DESCRIPTION:Line one\\nline two with comma\\, and semi\\;',
  'LOCATION:Rogers Centre',
  'STATUS:CONFIRMED',
  'URL:https://example.test/events/1',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:event-2@example.test',
  'DTSTART;VALUE=DATE:20260715',
  'SUMMARY:Folded long title',
  ' continuing here',
  'STATUS:CANCELLED',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('parseIcsFeed', () => {
  test('normalizes VEVENT fields, folded lines, escaping, and statuses', () => {
    const feed = parseIcsFeed(sample)

    expect(feed.title).toBe('Official Test Feed')
    expect(feed.events).toHaveLength(2)
    expect(feed.events[0]).toMatchObject({
      uid: 'event-1@example.test',
      sequence: 4,
      summary: 'Blue Jays vs Yankees',
      description: 'Line one\nline two with comma, and semi;',
      location: 'Rogers Centre',
      startsAt: '2026-07-14T01:30:00.000Z',
      endsAt: '2026-07-14T03:30:00.000Z',
      allDay: false,
      timezone: 'UTC',
      status: 'scheduled',
      url: 'https://example.test/events/1',
    })
    expect(feed.events[1]).toMatchObject({
      uid: 'event-2@example.test',
      summary: 'Folded long titlecontinuing here',
      startsAt: '2026-07-15T00:00:00.000Z',
      allDay: true,
      status: 'cancelled',
    })
  })

  test('uses stable hashes and target-scoped external IDs', async () => {
    const feed = parseIcsFeed(sample)
    const hash = await hashIcsEvent(feed.events[0])

    expect(hash).toHaveLength(64)
    expect(await hashIcsEvent(feed.events[0])).toBe(hash)
    expect(externalIcsId('mlb-official', feed.events[0].uid)).toBe('mlb-official:event-1@example.test')
  })
})
