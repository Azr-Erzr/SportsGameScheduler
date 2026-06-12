// One-time .ics snapshot export.
//
// Note: this is the "download a snapshot" path (Objective 6). The live subscribed-feed path
// is server-rendered from the database with stable UID/SEQUENCE and lives in
// supabase/functions/calendar-feed.

import type { Match } from '../domain/match'
import { brand } from '../domain/brand'
import type { CustomLeague } from './store'
import { formatIcsDate, formatLongDate, formatTime, slug } from './time'

/**
 * Escape text for iCalendar TEXT fields per RFC 5545 §3.3.11.
 * Backslash first, then structural characters; newlines become literal \n.
 */
export function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

export function createIcsBlob(filteredMatches: Match[], timeZone: string, locale?: string, hour12?: boolean | null) {
  const timeOptions = { locale, hour12: hour12 ?? undefined }
  const body = filteredMatches
    .map((match, index) => {
      const end = new Date(match.startsAt.getTime() + 2 * 60 * 60 * 1000)
      const title = `${match.team1} vs ${match.team2}`
      const description = `${match.round}${match.group ? `, ${match.group}` : ''}. Local kickoff: ${formatLongDate(
        match.startsAt,
        timeZone,
        timeOptions,
      )} at ${formatTime(match.startsAt, timeZone, timeOptions)}.`

      return [
        'BEGIN:VEVENT',
        `UID:silbo-${match.date}-${slug(match.team1)}-${slug(match.team2)}-${index}@local`,
        `DTSTAMP:${formatIcsDate(new Date())}`,
        `DTSTART:${formatIcsDate(match.startsAt)}`,
        `DTEND:${formatIcsDate(end)}`,
        `SUMMARY:${escapeIcsText(title)}`,
        `LOCATION:${escapeIcsText(match.ground)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        'END:VEVENT',
      ].join('\r\n')
    })
    .join('\r\n')

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${brand.appName}//Sports Scheduler//EN`,
    body,
    'END:VCALENDAR',
  ].join('\r\n')

  return new Blob([calendar], { type: 'text/calendar;charset=utf-8' })
}

export function createCustomLeagueIcsBlob(league: CustomLeague) {
  const body = league.events
    .filter((event) => event.status !== 'cancelled')
    .map((event) => {
      const start = new Date(event.startsAt)
      const end = new Date(start.getTime() + 90 * 60 * 1000)
      const detailParts = [
        event.opponent ? `vs ${event.opponent}` : '',
        event.arriveEarlyMinutes ? `Arrive ${event.arriveEarlyMinutes} min early` : '',
        event.uniformColor ? `Uniform: ${event.uniformColor}` : '',
        league.includeNotesInShare ? event.notes ?? '' : '',
      ].filter(Boolean)

      return [
        'BEGIN:VEVENT',
        `UID:silbo-custom-${event.id}@local`,
        `DTSTAMP:${formatIcsDate(new Date())}`,
        `DTSTART:${formatIcsDate(start)}`,
        `DTEND:${formatIcsDate(end)}`,
        `SUMMARY:${escapeIcsText(`${league.name}: ${event.title}`)}`,
        event.venue ? `LOCATION:${escapeIcsText(event.venue)}` : '',
        `DESCRIPTION:${escapeIcsText(detailParts.join(' | '))}`,
        'END:VEVENT',
      ]
        .filter(Boolean)
        .join('\r\n')
    })
    .join('\r\n')

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${brand.appName}//Community League//EN`,
    body,
    'END:VCALENDAR',
  ].join('\r\n')

  return new Blob([calendar], { type: 'text/calendar;charset=utf-8' })
}
