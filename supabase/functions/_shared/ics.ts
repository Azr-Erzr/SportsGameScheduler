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
  /** Real end time when the source feed provided one; otherwise duration is per-sport. */
  ends_at?: string | null
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
  /** Absolute base URL for "view event" links, e.g. https://silbosports.com */
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
  baseball: { emoji: '⚾', label: 'Baseball' },
  cricket: { emoji: '🏏', label: 'Cricket' },
  rugby: { emoji: '🏉', label: 'Rugby' },
  volleyball: { emoji: '🏐', label: 'Volleyball' },
  handball: { emoji: '🤾', label: 'Handball' },
  cycling: { emoji: '🚴', label: 'Cycling' },
  snooker: { emoji: '🎱', label: 'Snooker' },
  darts: { emoji: '🎯', label: 'Darts' },
  esports: { emoji: '🎮', label: 'Esports' },
}

// Realistic per-sport blocked time (minutes) so a calendar shows how long the event actually
// occupies — an MLB game is not a 2-hour block and an NFL game runs well past 3. Events whose
// source feed supplied a real end time (metadata ends_at, surfaced as FeedEvent.ends_at) use
// that instead. Unknown sports fall back to 2 hours.
const SPORT_DURATION_MINUTES: Record<string, number> = {
  soccer: 120,
  basketball: 150,
  american_football: 210,
  hockey: 160,
  tennis: 180,
  golf: 360,
  motorsport: 120,
  combat_sports: 240,
  athletics: 180,
  olympic_sports: 150,
  baseball: 180,
  cricket: 240,
  rugby: 120,
  volleyball: 120,
  handball: 120,
  cycling: 300,
  snooker: 180,
  darts: 180,
  esports: 120,
  custom: 120,
}
const DEFAULT_DURATION_MINUTES = 120

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
  // Prefer the source feed's real end time; sanity-cap at 24h so one bad row can't produce a
  // week-long block. Otherwise block a realistic per-sport duration.
  const providedEnd = event.ends_at ? new Date(event.ends_at) : null
  const validProvidedEnd =
    providedEnd &&
    !Number.isNaN(providedEnd.getTime()) &&
    providedEnd.getTime() > start.getTime() &&
    providedEnd.getTime() - start.getTime() <= 24 * 60 * 60 * 1000
      ? providedEnd
      : null
  const durationMinutes = SPORT_DURATION_MINUTES[event.sport_key ?? ''] ?? DEFAULT_DURATION_MINUTES
  const end = dateOnly
    ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
    : validProvidedEnd ?? new Date(start.getTime() + durationMinutes * 60 * 1000)
  const cancelled = event.status === 'cancelled'
  const tentative = !cancelled && (dateOnly || event.status === 'postponed' || event.status === 'time_tbd')

  const meta = event.sport_key ? SPORT_META[event.sport_key] : undefined
  // STATUS:CANCELLED rendering varies wildly across clients (some strike through, some ignore
  // it) — say it in the title so a cancellation is unmissable everywhere.
  const baseTitle = cancelled ? `Cancelled: ${event.title}` : event.title
  const summary = meta ? `${meta.emoji} ${baseTitle}` : baseTitle

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
    `UID:${event.id}@silbosports.com`,
    `SEQUENCE:${event.version}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `LAST-MODIFIED:${formatIcsDate(new Date(event.updated_at))}`,
    dateOnly ? `DTSTART;VALUE=DATE:${formatIcsDateOnly(start)}` : `DTSTART:${formatIcsDate(start)}`,
    dateOnly ? `DTEND;VALUE=DATE:${formatIcsDateOnly(end)}` : `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    categories.length ? `CATEGORIES:${categories.map(escapeIcsText).join(',')}` : '',
    cancelled ? 'STATUS:CANCELLED' : tentative ? 'STATUS:TENTATIVE' : 'STATUS:CONFIRMED',
    dateOnly ? 'TRANSP:TRANSPARENT' : '',
    options.appUrl ? `URL:${options.appUrl}/events/${event.id}` : '',
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
