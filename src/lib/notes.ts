// Plain-text "copy for Notes" export. Kept deliberately clean so it pastes well into Apple
// Notes, Google Keep, Notion, email, or a group chat.

import type { Match } from '../domain/match'
import { brand } from '../domain/brand'
import { formatLongDate, formatTime } from './time'
import { sportEmoji } from './ics'

export type NotesScheduleEvent = {
  title: string
  startsAt: Date | null
  startsAtTbd?: boolean
  sportKey?: string | null
  leagueName?: string | null
  venue?: string | null
  status?: string | null
}

export function createNotesText(
  filteredMatches: Match[],
  selectedTeams: string[],
  timeZone: string,
  cityLabel: string,
  locale?: string,
  hour12?: boolean | null,
) {
  const timeOptions = { locale, hour12: hour12 ?? undefined }
  const teamLine = selectedTeams.length ? selectedTeams.join(', ') : 'All confirmed group-stage teams'
  const lines = filteredMatches.map((match, index) => {
    return [
      `${index + 1}. ${match.team1} vs ${match.team2}`,
      `   ${formatLongDate(match.startsAt, timeZone, timeOptions)} at ${formatTime(match.startsAt, timeZone, timeOptions)}`,
      `   ${match.group ?? ''} - ${match.round} - ${match.ground}`,
    ].join('\n')
  })

  return [
    `${brand.appName} - World Cup 2026 schedule`,
    `${cityLabel} local time - ${timeZone}`,
    `Teams: ${teamLine}`,
    '',
    ...lines,
  ].join('\n')
}

export function createMultiSportNotesText(
  events: NotesScheduleEvent[],
  timeZone: string,
  cityLabel: string,
  locale?: string,
  hour12?: boolean | null,
) {
  const timeOptions = { locale, hour12: hour12 ?? undefined }
  const lines = events.map((event, index) => {
    const when = event.startsAt
      ? event.startsAtTbd
        ? `${formatLongDate(event.startsAt, timeZone, timeOptions)} - time TBD`
        : `${formatLongDate(event.startsAt, timeZone, timeOptions)} at ${formatTime(event.startsAt, timeZone, timeOptions)}`
      : 'Date/time TBD'
    const details = [event.leagueName, event.venue, event.status && event.status !== 'scheduled' ? event.status : '']
      .filter(Boolean)
      .join(' - ')

    return [
      `${index + 1}. ${sportEmoji(event.sportKey)} ${event.title}`,
      `   ${when}`,
      details ? `   ${details}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  })

  return [
    `${brand.appName} - all-sports schedule`,
    `${cityLabel} local time - ${timeZone}`,
    `Events: ${events.length}`,
    '',
    ...lines,
  ].join('\n')
}
