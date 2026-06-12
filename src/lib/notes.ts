// Plain-text "copy for Notes" export. Kept deliberately clean so it pastes well into Apple
// Notes, Google Keep, Notion, email, or a group chat.

import type { Match } from '../domain/match'
import { brand } from '../domain/brand'
import { formatLongDate, formatTime } from './time'

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
