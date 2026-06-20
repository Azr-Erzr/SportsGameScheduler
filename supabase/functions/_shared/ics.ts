// Shared iCalendar rendering for the live feed function (RFC 5545).
//
// Matches the current `events` schema: time certainty is expressed by `starts_at_tbd`
// (a TBD-time event renders all-day + tentative) and `status`; there is no separate
// certainty/precision taxonomy. Adds Silbo polish: per-sport emoji in the title,
// CATEGORIES, optional VALARM reminders, and a link back to the event.

export type FeedEvent = {
  id: string
  title: string
  starts_at: string | null
  starts_at_tbd?: boolean
  updated_at: string
  version: number
  status: string
  venue_name?: string | null
  sport_key?: string | null
  league_name?: string | null
  description?: string | null
  broadcasts?: Array<{
    country?: string | null
    channel?: string | null
    kind?: string | null
    stream_url?: string | null
  }>
}

export type RenderOptions = {
  /** Reminder lead times in minutes (each becomes a VALARM). Empty = no alarms. */
  reminderMinutes?: number[]
  /** Absolute base URL for "view event" links, e.g. https://silbosports.app */
  appUrl?: string
}

// Per-sport emoji + human label, keyed by canonical sport key. Emoji render in
// Apple/Google/Outlook event titles; the label feeds CATEGORIES.
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
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  for (const char of Array.from(line)) {
    const next = current + char
    if (encoder.encode(next).length > 75) {
      parts.push(current)
      current = ` ${char}`
    } else {
      current = next
    }
  }
  if (current) parts.push(current)
  return parts.join('\r\n')
}

function valarm(minutes: number): string[] {
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    `TRIGGER:-PT${Math.max(0, Math.round(minutes))}M`,
    'END:VALARM',
  ]
}

export function eventToVevent(event: FeedEvent, options: RenderOptions = {}): string {
  if (!event.starts_at) return ''

  const start = new Date(event.starts_at)
  // No confirmed time → render as an all-day, tentative entry.
  const dateOnly = Boolean(event.starts_at_tbd)
  const end = dateOnly
    ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const cancelled = event.status === 'cancelled'
  const tentative = !cancelled && (dateOnly || event.status === 'postponed' || event.status === 'time_tbd')

  const meta = event.sport_key ? SPORT_META[event.sport_key] : undefined
  const summary = meta ? `${meta.emoji} ${event.title}` : event.title

  const categories = [meta?.label, event.league_name].filter(Boolean) as string[]
  const broadcastNotes = (event.broadcasts ?? [])
    .map((broadcast) => {
      const label = [broadcast.channel, broadcast.country ? `(${broadcast.country})` : ''].filter(Boolean).join(' ')
      return broadcast.stream_url ? `${label}: ${broadcast.stream_url}` : label
    })
    .filter(Boolean)
  const descParts = [
    event.description,
    event.league_name ? `League: ${event.league_name}` : '',
    event.venue_name ? `Venue: ${event.venue_name}` : '',
    broadcastNotes.length ? `Where to watch: ${broadcastNotes.join(', ')}` : '',
    'Times shown in your calendar’s timezone.',
    options.appUrl ? `View: ${options.appUrl}/events/${event.id}` : '',
  ].filter(Boolean)

  const lines = [
    'BEGIN:VEVENT',
    // Stable UID + SEQUENCE from the version column: calendar clients update in place
    // instead of duplicating, and only re-notify when version actually bumped.
    `UID:${event.id}@silbosports.app`,
    `SEQUENCE:${event.version}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `LAST-MODIFIED:${formatIcsDate(new Date(event.updated_at))}`,
    dateOnly ? `DTSTART;VALUE=DATE:${formatIcsDateOnly(start)}` : `DTSTART:${formatIcsDate(start)}`,
    dateOnly ? `DTEND;VALUE=DATE:${formatIcsDateOnly(end)}` : `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    categories.length ? `CATEGORIES:${categories.map(escapeIcsText).join(',')}` : '',
    cancelled ? 'STATUS:CANCELLED' : tentative ? 'STATUS:TENTATIVE' : 'STATUS:CONFIRMED',
    dateOnly ? 'TRANSP:TRANSPARENT' : '',
    event.venue_name ? `LOCATION:${escapeIcsText(event.venue_name)}` : '',
    descParts.length ? `DESCRIPTION:${escapeIcsText(descParts.join('\n'))}` : '',
    // Reminders: only on timed, non-cancelled events (alarms on all-day TBD entries are noise).
    ...(!dateOnly && !cancelled ? (options.reminderMinutes ?? []).flatMap(valarm) : []),
    'END:VEVENT',
  ]

  return lines.filter(Boolean).map(foldLine).join('\r\n')
}

export function renderCalendar(name: string, events: FeedEvent[], options: RenderOptions = {}): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Silbo Sports//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeIcsText(name)}`),
    ...events.map((event) => eventToVevent(event, options)).filter(Boolean),
    'END:VCALENDAR',
  ].join('\r\n')
}
