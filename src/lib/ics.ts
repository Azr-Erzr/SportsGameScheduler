// One-time .ics snapshot export.
//
// Note: this is the "download a snapshot" path (Objective 6). The live subscribed-feed path
// is server-rendered from the database with stable UID/SEQUENCE and lives in
// supabase/functions/calendar-feed.

import type { Match } from '../domain/match'
import { brand } from '../domain/brand'
import type { LiveEvent } from '../data/liveSport'
import type { CustomLeague } from './store'
import { formatIcsDate, formatIcsDateOnly, formatLongDate, formatTime, slug } from './time'

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

// Per-sport emoji + label, mirrored from the server feed renderer so downloaded snapshots and
// the live feed read identically in a calendar app.
const SPORT_META: Record<string, { emoji: string; label: string }> = {
  soccer: { emoji: '⚽', label: 'Soccer' },
  basketball: { emoji: '🏀', label: 'Basketball' },
  american_football: { emoji: '🏈', label: 'American Football' },
  hockey: { emoji: '🏒', label: 'Hockey' },
  tennis: { emoji: '🎾', label: 'Tennis' },
  golf: { emoji: '⛳', label: 'Golf' },
  motorsport: { emoji: '🏁', label: 'Motorsport' },
  combat_sports: { emoji: '🥊', label: 'Combat Sports' },
  athletics: { emoji: '🏃', label: 'Track & Field' },
  olympic_sports: { emoji: '🏅', label: 'Olympic Sports' },
  custom: { emoji: '📅', label: 'Community' },
}

Object.assign(SPORT_META, {
  baseball: { emoji: 'BSB', label: 'Baseball' },
  cricket: { emoji: 'CRI', label: 'Cricket' },
  rugby: { emoji: 'RUG', label: 'Rugby' },
  volleyball: { emoji: 'VOL', label: 'Volleyball' },
  handball: { emoji: 'HBL', label: 'Handball' },
  cycling: { emoji: 'CYC', label: 'Cycling' },
  snooker: { emoji: 'SNO', label: 'Snooker' },
  darts: { emoji: 'DRT', label: 'Darts' },
})

export function sportEmoji(sportKey: string | null | undefined): string {
  return (sportKey && SPORT_META[sportKey]?.emoji) || '📅'
}

// One render path for any DB-backed event (multi-sport). Adds emoji titles, CATEGORIES, and
// optional VALARM reminders. Used by My Schedule + Exports for "every game in your calendar".
export function createMultiSportIcsBlob(
  events: LiveEvent[],
  options: { reminderMinutes?: number[] } = {},
): Blob {
  const body = events
    .filter((event) => event.startsAt)
    .map((event) => {
      const start = event.startsAt as Date
      const dateOnly = event.startsAtTbd
      const end = new Date(start.getTime() + (dateOnly ? 24 : 2) * 60 * 60 * 1000)
      const meta = event.sportKey ? SPORT_META[event.sportKey] : undefined
      const summary = meta ? `${meta.emoji} ${event.title}` : event.title
      const categories = [meta?.label, event.leagueName].filter(Boolean) as string[]
      const cancelled = event.status === 'cancelled'
      const tentative = !cancelled && (dateOnly || event.status === 'postponed')
      const alarms =
        !dateOnly && !cancelled
          ? (options.reminderMinutes ?? []).flatMap((m) => [
              'BEGIN:VALARM',
              'ACTION:DISPLAY',
              'DESCRIPTION:Reminder',
              `TRIGGER:-PT${Math.max(0, Math.round(m))}M`,
              'END:VALARM',
            ])
          : []

      return [
        'BEGIN:VEVENT',
        `UID:silbo-${event.id}@silbosports.app`,
        `DTSTAMP:${formatIcsDate(new Date())}`,
        dateOnly ? `DTSTART;VALUE=DATE:${formatIcsDateOnly(start)}` : `DTSTART:${formatIcsDate(start)}`,
        dateOnly ? `DTEND;VALUE=DATE:${formatIcsDateOnly(end)}` : `DTEND:${formatIcsDate(end)}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        categories.length ? `CATEGORIES:${categories.map(escapeIcsText).join(',')}` : '',
        cancelled ? 'STATUS:CANCELLED' : tentative ? 'STATUS:TENTATIVE' : 'STATUS:CONFIRMED',
        event.venue ? `LOCATION:${escapeIcsText(event.venue)}` : '',
        event.leagueName ? `DESCRIPTION:${escapeIcsText(`League: ${event.leagueName}`)}` : '',
        ...alarms,
        'END:VEVENT',
      ]
        .filter(Boolean)
        .join('\r\n')
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
