// Shared iCalendar rendering for the live feed function (RFC 5545).

export type FeedEvent = {
  id: string
  title: string
  starts_at: string | null
  updated_at: string
  version: number
  status: string
  certainty?: 'confirmed' | 'provisional' | 'watch_only'
  starts_at_precision?: 'exact' | 'date' | 'month' | 'window' | 'unknown'
  decision_note?: string | null
  venue_name?: string | null
  description?: string | null
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

export function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function formatIcsDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

/** Fold long content lines at 75 octets per RFC 5545 §3.1. */
export function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let rest = line
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75))
    rest = ' ' + rest.slice(75)
  }
  parts.push(rest)
  return parts.join('\r\n')
}

export function eventToVevent(event: FeedEvent): string {
  if (!event.starts_at || event.certainty === 'watch_only') return ''

  const start = new Date(event.starts_at)
  const dateOnly = event.starts_at_precision !== undefined && event.starts_at_precision !== 'exact'
  const end = dateOnly
    ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const cancelled = event.status === 'cancelled'
  const tentative = !cancelled && (event.certainty === 'provisional' || event.status === 'time_tbd' || dateOnly)
  const description = [event.description, event.decision_note].filter(Boolean).join('\n')

  const lines = [
    'BEGIN:VEVENT',
    // Stable UID + SEQUENCE from the version column: calendar clients update in place
    // instead of duplicating, and only re-notify when version actually bumped.
    `UID:${event.id}@matchpulse.app`,
    `SEQUENCE:${event.version}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `LAST-MODIFIED:${formatIcsDate(new Date(event.updated_at))}`,
    dateOnly ? `DTSTART;VALUE=DATE:${formatIcsDateOnly(start)}` : `DTSTART:${formatIcsDate(start)}`,
    dateOnly ? `DTEND;VALUE=DATE:${formatIcsDateOnly(end)}` : `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    cancelled ? 'STATUS:CANCELLED' : tentative ? 'STATUS:TENTATIVE' : 'STATUS:CONFIRMED',
    dateOnly ? 'TRANSP:TRANSPARENT' : '',
    event.venue_name ? `LOCATION:${escapeIcsText(event.venue_name)}` : '',
    description ? `DESCRIPTION:${escapeIcsText(description)}` : '',
    'END:VEVENT',
  ]

  return lines.filter(Boolean).map(foldLine).join('\r\n')
}

export function renderCalendar(name: string, events: FeedEvent[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MatchPulse//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeIcsText(name)}`),
    ...events.map(eventToVevent).filter(Boolean),
    'END:VCALENDAR',
  ].join('\r\n')
}
