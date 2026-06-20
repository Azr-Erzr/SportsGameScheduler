import type { Match } from '../domain/match'
import { formatLongDate, formatTime } from './time'

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export function createScheduleCsv(
  matches: Match[],
  timeZone: string,
  locale?: string | null,
  hour12?: boolean | null,
) {
  const timeOptions = { locale: locale ?? undefined, hour12: hour12 ?? undefined }
  const rows = [
    ['Date', 'Time', 'Team 1', 'Team 2', 'Round', 'Group', 'Venue', 'Timezone'],
    ...matches.map((match) => [
      formatLongDate(match.startsAt, timeZone, timeOptions),
      formatTime(match.startsAt, timeZone, timeOptions),
      match.team1,
      match.team2,
      match.round,
      match.group ?? '',
      match.ground,
      timeZone,
    ]),
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function exportCompletionMessage(kind: 'image' | 'images' | 'pdf' | 'ics' | 'csv' | 'notes' | 'share', count = 0) {
  if (kind === 'images') return `${count} readable pages downloaded - long schedules stay legible.`
  if (kind === 'image') return 'Schedule image downloaded.'
  if (kind === 'pdf') return count > 1 ? `${count} page PDF downloaded.` : 'Schedule PDF downloaded.'
  if (kind === 'ics') return 'Calendar snapshot downloaded. Use Silbo Sync for automatic updates.'
  if (kind === 'csv') return 'Spreadsheet-ready CSV downloaded.'
  if (kind === 'share') return 'Schedule opened in your share sheet.'
  return 'Plain-text schedule copied - paste it into Notes, Keep, Notion, or a group chat.'
}
