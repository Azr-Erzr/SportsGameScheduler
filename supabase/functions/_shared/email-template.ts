import type { AlertCopy, AlertCopyEvent } from './alert-copy.ts'

export type WatchOption = { name: string; url: string }

type RenderAlertEmailOptions = {
  appUrl: string
  brandName?: string
  copy: AlertCopy
  event: AlertCopyEvent
  manageUrl: string
  /** Deep link to the specific event; the primary CTA points here (falls back to appUrl). */
  eventUrl?: string
  /** The alert kind, so the countdown only shows for still-upcoming alerts. */
  kind?: string
  /** The recipient's timezone (profiles.default_timezone) — the start time is shown in THIS zone. */
  displayTimezone?: string | null
  hour12?: boolean | null
  /** Region used to resolve where-to-watch, shown as a label. */
  region?: string | null
  /** Up to a few official where-to-watch destinations for the recipient's region. */
  watch?: WatchOption[]
  /** One-tap "add to calendar" link (Google Calendar template URL). */
  calendarUrl?: string | null
}

// Countdown is only meaningful for alerts about an event that hasn't started yet.
const UPCOMING_KINDS = new Set(['reminder', 'time_change', 'time_set', 'new_event', 'participant_update', 'venue_change'])

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeUrl(url: string) {
  try {
    return new URL(url).toString().replace(/\/$/, '')
  } catch (_) {
    return 'https://silbosports.com'
  }
}

function formatStart(startsAt?: string | null, timezone?: string | null, hour12?: boolean | null) {
  if (!startsAt) return null
  const date = new Date(startsAt)
  if (Number.isNaN(date.getTime())) return null

  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: hour12 ?? undefined,
      timeZoneName: 'short',
      timeZone: timezone || undefined,
    }).format(date)
  } catch (_) {
    return date.toUTCString()
  }
}

// Human "starts in …" relative to send time. Returns null once the event is in the past.
function countdownLabel(startsAt?: string | null) {
  if (!startsAt) return null
  const ms = new Date(startsAt).getTime() - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) return null
  const minutes = Math.round(ms / 60000)
  if (minutes < 90) return `Starts in about ${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.round(minutes / 60)
  if (hours < 36) return `Starts in about ${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  return `Starts in about ${days} day${days === 1 ? '' : 's'}`
}

function detailRow(label: string, value: string | null | undefined) {
  if (!value) return ''
  return `
    <tr>
      <td style="padding:10px 0;color:#7d877f;font:700 11px/1.2 Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;color:#f3efe2;font:700 14px/1.4 Arial,sans-serif;text-align:right;">${escapeHtml(value)}</td>
    </tr>`
}

export function renderSilboAlertEmail(options: RenderAlertEmailOptions) {
  const brandName = options.brandName || 'Silbo Sports'
  const appUrl = normalizeUrl(options.appUrl)
  const eventUrl = options.eventUrl ? normalizeUrl(options.eventUrl) : appUrl
  const tz = options.displayTimezone || options.event.timezone || 'UTC'
  const start = formatStart(options.event.starts_at, tz, options.hour12)
  const countdown = options.kind && UPCOMING_KINDS.has(options.kind) ? countdownLabel(options.event.starts_at) : null
  const watch = options.watch ?? []

  const textLines = [
    options.copy.lead,
    countdown ?? '',
    '',
    options.event.league_name ? `League: ${options.event.league_name}` : '',
    start ? `Start: ${start}` : '',
    options.event.venue_name ? `Venue: ${options.event.venue_name}` : '',
    watch.length ? `Where to watch${options.region ? ` (${options.region})` : ''}: ${watch.map((w) => w.name).join(', ')}` : '',
    '',
    `View event: ${eventUrl}`,
    options.calendarUrl ? `Add to calendar: ${options.calendarUrl}` : '',
    `Manage alerts: ${options.manageUrl}`,
  ].filter((line) => line !== '')
  const text = textLines.join('\n')

  const countdownHtml = countdown
    ? `<p style="margin:14px 0 0;"><span style="display:inline-block;background:#13251a;color:#28f070;font:800 12px/1 Arial,sans-serif;padding:8px 13px;border-radius:999px;text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(countdown)}</span></p>`
    : ''

  const watchHtml = watch.length
    ? `
            <tr>
              <td style="padding:2px 24px 18px;">
                <div style="color:#7d877f;font:700 11px/1.2 Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">Where to watch${options.region ? ` (${escapeHtml(options.region)})` : ''}</div>
                ${watch
                  .map(
                    (w) =>
                      `<a href="${escapeHtml(normalizeUrl(w.url))}" style="display:inline-block;margin:0 8px 8px 0;border:1px solid #1c3a28;color:#cfe9d8;text-decoration:none;font:700 12px/1 Arial,sans-serif;padding:9px 13px;border-radius:6px;">${escapeHtml(w.name)}</a>`,
                  )
                  .join('')}
              </td>
            </tr>`
    : ''

  const calendarButton = options.calendarUrl
    ? `<a href="${escapeHtml(options.calendarUrl)}" style="display:inline-block;border:1px solid #2c5a3c;color:#9be7b4;text-decoration:none;font:800 13px/1 Arial,sans-serif;padding:12px 16px;border-radius:6px;margin-left:10px;">Add to calendar</a>`
    : ''

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(options.copy.subject)}</title>
  </head>
  <body style="margin:0;background:#070908;color:#f3efe2;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">
      ${escapeHtml(options.copy.lead)}${countdown ? ` · ${escapeHtml(countdown)}` : ''}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070908;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #16351f;background:#0b0f0d;">
            <tr>
              <td style="padding:22px 24px 12px;border-bottom:1px solid #16351f;">
                <div style="color:#28f070;font:900 18px/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(brandName)}</div>
                <div style="margin-top:7px;color:#a8b2aa;font:700 11px/1.4 Arial,sans-serif;text-transform:uppercase;letter-spacing:.12em;">Schedule alert</div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 24px 10px;">
                <h1 style="margin:0;color:#f6f0df;font:900 28px/1.04 Arial,sans-serif;letter-spacing:0;">${escapeHtml(options.copy.subject)}</h1>
                <p style="margin:14px 0 0;color:#c4cabf;font:600 15px/1.55 Arial,sans-serif;">${escapeHtml(options.copy.lead)}</p>
                ${countdownHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #18251d;border-bottom:1px solid #18251d;">
                  ${detailRow('Event', options.event.title)}
                  ${detailRow('League', options.event.league_name)}
                  ${detailRow('Start', start)}
                  ${detailRow('Venue', options.event.venue_name)}
                </table>
              </td>
            </tr>
            ${watchHtml}
            <tr>
              <td style="padding:2px 24px 28px;">
                <a href="${escapeHtml(eventUrl)}" style="display:inline-block;background:#28f070;color:#061008;text-decoration:none;font:900 14px/1 Arial,sans-serif;padding:13px 18px;border-radius:6px;">View event</a>
                ${calendarButton}
                <a href="${escapeHtml(options.manageUrl)}" style="display:inline-block;color:#9be7b4;text-decoration:none;font:700 13px/1 Arial,sans-serif;margin-left:14px;">Manage alerts</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 22px;border-top:1px solid #16351f;color:#7f8a83;font:12px/1.5 Arial,sans-serif;">
                You are receiving this because alerts are enabled for something you follow on ${escapeHtml(brandName)}.
                Change preferences any time from <a href="${escapeHtml(options.manageUrl)}" style="color:#9be7b4;">alert settings</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject: options.copy.subject, text, html }
}
