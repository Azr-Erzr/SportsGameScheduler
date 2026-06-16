// Time parsing and locale-aware formatting helpers.
// Formatting goes through Intl so it stays timezone- and locale-correct; do not hand-roll
// date strings in the UI or exports.

/** Resolved once; user-overridable later via profile settings (Objective 14.5). */
export function defaultLocale(): string {
  return typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US'
}

export type TimeFormatOptions = {
  locale?: string
  hour12?: boolean
}

export function displayTimeOptions(locale?: string | null, hour12?: boolean | null): TimeFormatOptions {
  return {
    locale: locale ?? undefined,
    hour12: hour12 ?? undefined,
  }
}

/**
 * Parse a kickoff from the dataset's `date` (YYYY-MM-DD) and `time` ("HH:MM UTC±H[:MM]")
 * into an absolute Date.
 *
 * Handles half-hour/45-minute offsets (e.g. "UTC+5:30", "UTC-3:30"). The original prototype
 * only matched whole-hour offsets, which silently mangled times outside the Americas.
 */
export function parseKickoff(date: string, time: string): Date {
  const match = time.match(/^(\d{1,2}):(\d{2}) UTC([+-]\d{1,2})(?::(\d{2}))?$/)
  if (!match) return new Date(`${date}T00:00:00Z`)

  const [, rawHour, rawMinute, rawOffsetHour, rawOffsetMinute] = match
  const [year, month, day] = date.split('-').map(Number)
  const hour = Number(rawHour)
  const minute = Number(rawMinute)

  const offsetSign = rawOffsetHour.startsWith('-') ? -1 : 1
  const offsetHours = Math.abs(Number(rawOffsetHour))
  const offsetMinutes = rawOffsetMinute ? Number(rawOffsetMinute) : 0
  const totalOffsetMinutes = offsetSign * (offsetHours * 60 + offsetMinutes)

  // Local clock time minus its UTC offset gives the absolute UTC instant.
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - totalOffsetMinutes * 60_000)
}

export function formatDate(date: Date, timeZone: string, opts: TimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(opts.locale ?? defaultLocale(), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(date)
}

export function formatTime(date: Date, timeZone: string, opts: TimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(opts.locale ?? defaultLocale(), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
    ...(opts.hour12 !== undefined ? { hour12: opts.hour12 } : {}),
  }).format(date)
}

/**
 * Structured time parts for renderers (e.g. the canvas poster) that lay out the clock time
 * and the zone label separately. Never string-split a formatted time — locale and 12/24h
 * settings change its shape.
 */
export function formatTimeParts(date: Date, timeZone: string, opts: TimeFormatOptions = {}) {
  const parts = new Intl.DateTimeFormat(opts.locale ?? defaultLocale(), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
    ...(opts.hour12 !== undefined ? { hour12: opts.hour12 } : {}),
  }).formatToParts(date)

  const zone = parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
  const clock = parts
    .filter((part) => part.type !== 'timeZoneName')
    .map((part) => part.value)
    .join('')
    .trim()
    .replace(/\s+$/, '')

  return { clock, zone }
}

export function formatLongDate(date: Date, timeZone: string, opts: TimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(opts.locale ?? defaultLocale(), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(date)
}

/** Format a Date as an iCalendar UTC timestamp (e.g. 20260611T130000Z). */
export function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Format a Date as an iCalendar all-day DATE value (e.g. 20260611), for TBD-time events. */
export function formatIcsDateOnly(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

export function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
