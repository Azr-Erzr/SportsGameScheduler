import type { AlertCopy, AlertCopyEvent } from './alert-copy.ts'

export type WatchOption = { name: string; url: string; providerKey?: string | null }

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
  /** The recipient's timezone (profiles.default_timezone) - the start time is shown in THIS zone. */
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

const WATCH_BADGE_STYLES: Record<string, { label: string; bg: string; fg: string; border: string }> = {
  fox_sports: { label: 'FOX', bg: '#063c78', fg: '#ffffff', border: '#3b82f6' },
  telemundo: { label: 'TEL', bg: '#d71920', fg: '#ffffff', border: '#ff6b6b' },
  ctv_tsn_rds: { label: 'TSN', bg: '#cc102d', fg: '#ffffff', border: '#ff8a8a' },
  tsn: { label: 'TSN', bg: '#cc102d', fg: '#ffffff', border: '#ff8a8a' },
  rds: { label: 'RDS', bg: '#d71920', fg: '#ffffff', border: '#ff8a8a' },
  peacock: { label: 'PEA', bg: '#231f55', fg: '#ffffff', border: '#7c6cff' },
  fubo: { label: 'FUBO', bg: '#ff5a1f', fg: '#111111', border: '#ffb199' },
  dazn: { label: 'DAZN', bg: '#f2ff00', fg: '#111111', border: '#f8ff7a' },
  espn_plus: { label: 'ESPN', bg: '#c4001a', fg: '#ffffff', border: '#ff7a8a' },
  nba_league_pass: { label: 'NBA', bg: '#1d428a', fg: '#ffffff', border: '#5b8def' },
  max_tnt: { label: 'TNT', bg: '#111827', fg: '#ffffff', border: '#4b5563' },
  sling: { label: 'SLING', bg: '#00a7e1', fg: '#081015', border: '#7ddcff' },
  movistar_plus: { label: 'MOV', bg: '#0b8f5a', fg: '#ffffff', border: '#83e1b7' },
}

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

function formatStartParts(startsAt?: string | null, timezone?: string | null, hour12?: boolean | null) {
  if (!startsAt) return null
  const date = new Date(startsAt)
  if (Number.isNaN(date.getTime())) return null

  try {
    const datePart = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: timezone || undefined,
    }).format(date)
    const timePart = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: hour12 ?? undefined,
      timeZone: timezone || undefined,
    }).format(date)
    const zonePart =
      new Intl.DateTimeFormat('en-US', {
        timeZoneName: 'short',
        timeZone: timezone || undefined,
      })
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName')?.value ?? 'UTC'

    return { datePart, timePart, zonePart, full: `${datePart}, ${timePart} ${zonePart}` }
  } catch (_) {
    const full = date.toUTCString()
    return { datePart: 'UTC', timePart: full, zonePart: '', full }
  }
}

// Human "starts in ..." relative to send time. Returns null once the event is in the past.
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

function watchBadgeStyle(watch: WatchOption) {
  const key = watch.providerKey?.toLowerCase() ?? ''
  const direct = WATCH_BADGE_STYLES[key]
  if (direct) return direct
  const normalized = watch.name.toLowerCase()
  if (normalized.includes('telemundo')) return WATCH_BADGE_STYLES.telemundo
  if (normalized.includes('tsn') || normalized.includes('ctv')) return WATCH_BADGE_STYLES.ctv_tsn_rds
  if (normalized.includes('sling')) return WATCH_BADGE_STYLES.sling
  if (normalized.includes('tnt') || normalized.includes('max')) return WATCH_BADGE_STYLES.max_tnt
  if (normalized.includes('movistar')) return WATCH_BADGE_STYLES.movistar_plus
  if (normalized.includes('fox')) return WATCH_BADGE_STYLES.fox_sports
  if (normalized.includes('nba')) return WATCH_BADGE_STYLES.nba_league_pass
  const label = watch.name
    .replace(/[^a-z0-9 ]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 4)
  return { label: label || 'TV', bg: '#101812', fg: '#dff7e6', border: '#2a4c34' }
}

function watchBadgeHtml(watch: WatchOption, compact = false) {
  const style = watchBadgeStyle(watch)
  return `<a href="${escapeHtml(normalizeUrl(watch.url))}" title="${escapeHtml(watch.name)}" style="display:inline-block;text-decoration:none;margin:0 7px 7px 0;">
    <span class="watch-badge" style="display:inline-block;min-width:${compact ? '34px' : '42px'};text-align:center;background:${style.bg};color:${style.fg};border:1px solid ${style.border};border-radius:6px;padding:${compact ? '6px 7px' : '8px 9px'};font:900 ${compact ? '10px' : '11px'}/1 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(style.label)}</span>
  </a>`
}

function detailLine(value: string | null | undefined) {
  if (!value) return ''
  return `<div style="margin-top:7px;color:#111611;font:700 14px/1.35 Arial,sans-serif;"><span style="display:inline-block;width:6px;height:6px;border-radius:999px;background:#0f8a45;margin-right:7px;vertical-align:2px;"></span>${escapeHtml(value)}</div>`
}

export function renderSilboAlertEmail(options: RenderAlertEmailOptions) {
  const brandName = options.brandName || 'Silbo Sports'
  const appUrl = normalizeUrl(options.appUrl)
  const eventUrl = options.eventUrl ? normalizeUrl(options.eventUrl) : appUrl
  const emailLockupUrl = `${appUrl}/assets/brand/silbo-email-lockup.png`
  const tz = options.displayTimezone || options.event.timezone || 'UTC'
  const start = formatStartParts(options.event.starts_at, tz, options.hour12)
  const countdown = options.kind && UPCOMING_KINDS.has(options.kind) ? countdownLabel(options.event.starts_at) : null
  const watch = options.watch ?? []

  const textLines = [
    options.copy.lead,
    countdown ?? '',
    '',
    options.event.league_name ? `League: ${options.event.league_name}` : '',
    start ? `Start: ${start.full}` : '',
    options.event.venue_name ? `Venue: ${options.event.venue_name}` : '',
    watch.length ? `Where to watch${options.region ? ` (${options.region})` : ''}: ${watch.map((w) => w.name).join(', ')}` : '',
    '',
    `View event: ${eventUrl}`,
    options.calendarUrl ? `Add to calendar: ${options.calendarUrl}` : '',
    `Manage alerts: ${options.manageUrl}`,
  ].filter((line) => line !== '')
  const text = textLines.join('\n')

  const countdownHtml = countdown
    ? `<div class="pill" style="display:inline-block;background:#13251a;color:#28f070;font:900 13px/1 Arial,sans-serif;padding:9px 14px;border-radius:999px;margin-top:14px;">${escapeHtml(countdown)}</div>`
    : ''
  const watchHtml = watch.length
    ? `<tr>
          <td class="section-pad" style="padding:0 24px 20px;">
            <div class="label" style="color:#8ba091;font:800 10px/1.2 Arial,sans-serif;text-transform:uppercase;letter-spacing:.16em;margin-bottom:10px;">Where to watch${options.region ? ` - ${escapeHtml(options.region)}` : ''}</div>
            ${watch.map((w) => watchBadgeHtml(w)).join('')}
          </td>
        </tr>`
    : ''
  const calendarButton = options.calendarUrl
    ? `<a class="secondary-button" href="${escapeHtml(options.calendarUrl)}" style="display:inline-block;border:1px solid #2c5a3c;color:#9be7b4;text-decoration:none;font:900 14px/1 Arial,sans-serif;padding:14px 18px;border-radius:8px;margin:8px 0 0 8px;">Add to calendar</a>`
    : ''

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="dark light">
    <meta name="supported-color-schemes" content="dark light">
    <title>${escapeHtml(options.copy.subject)}</title>
    <style>
      @media (prefers-color-scheme: light) {
        body, .email-bg { background:#f4ead8 !important; color:#17130e !important; }
        .panel { background:#fff8e8 !important; border-color:#d8c9ad !important; }
        .header { background:#fff8e8 !important; border-color:#d8c9ad !important; }
        .hero { background:#07110c !important; color:#fff6df !important; }
        .brand, .accent { color:#0d7a3f !important; }
        .hero .label { color:#6dff9a !important; }
        .title { color:#fff6df !important; }
        .muted, .label { color:#685f50 !important; }
        .pill { background:#dff5dc !important; color:#0d7a3f !important; }
        .ticket-main { background:#fffdf4 !important; color:#17130e !important; }
        .footer { background:#f4ead8 !important; border-color:#d8c9ad !important; color:#675d4e !important; }
        .secondary-button { color:#0d7a3f !important; border-color:#b8d0ae !important; }
      }
      @media only screen and (max-width: 480px) {
        .email-bg { padding:8px 0 !important; }
        .panel { width:100% !important; max-width:100% !important; border-left:0 !important; border-right:0 !important; border-radius:0 !important; }
        .header { padding:18px 16px !important; }
        .header td { display:block !important; width:100% !important; text-align:left !important; }
        .brand-lockup { width:220px !important; max-width:100% !important; height:auto !important; }
        .hero { padding:22px 16px !important; }
        .hero .label { margin-top:42px !important; }
        .title { font-size:25px !important; line-height:1.08 !important; }
        .section-pad { padding-left:16px !important; padding-right:16px !important; }
        .ticket-shell { border-spacing:0 !important; }
        .ticket-time, .ticket-main { display:block !important; width:auto !important; border-radius:7px !important; }
        .ticket-time { padding:16px !important; }
        .ticket-main { margin-top:0 !important; padding:16px !important; }
        .primary-button, .secondary-button { display:block !important; box-sizing:border-box !important; width:100% !important; margin:8px 0 0 !important; text-align:center !important; }
        .watch-badge { min-width:0 !important; }
      }
      a { color:inherit; }
    </style>
  </head>
  <body style="margin:0;background:#070908;color:#f3efe2;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">
      ${escapeHtml(options.copy.lead)}${countdown ? ` - ${escapeHtml(countdown)}` : ''}
    </div>
    <table class="email-bg" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070908;padding:24px 10px;">
      <tr>
        <td align="center">
          <table class="panel" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border:1px solid #16351f;background:#0a0d0b;border-radius:8px;overflow:hidden;">
            <tr>
              <td class="header" style="padding:20px 24px;border-bottom:1px solid #16351f;background:#070908;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <img class="brand-lockup" src="${escapeHtml(emailLockupUrl)}" width="258" height="58" alt="${escapeHtml(brandName)}" style="display:block;width:258px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;">
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="hero" style="padding:24px;background:#07110c;background-image:linear-gradient(90deg,#07110c 0%,#0b2215 72%,#0f3a20 100%);">
                <div class="pill" style="display:inline-block;background:#28f070;color:#061008;font:900 10px/1 Arial,sans-serif;padding:9px 13px;border-radius:999px;text-transform:uppercase;letter-spacing:.16em;">${escapeHtml(options.kind ?? 'alert')}</div>
                <div class="label" style="margin-top:58px;color:#6dff9a;font:900 10px/1.2 Arial,sans-serif;text-transform:uppercase;letter-spacing:.18em;">${escapeHtml(options.event.league_name ?? 'Schedule')}</div>
                <h1 class="title" style="margin:10px 0 0;color:#fff6df;font:900 30px/1.05 Arial,sans-serif;letter-spacing:-.01em;">${escapeHtml(options.event.title)}</h1>
                ${countdownHtml}
              </td>
            </tr>
            <tr>
              <td class="section-pad" style="padding:24px 24px 10px;">
                <table class="ticket-shell" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;">
                  <tr>
                    <td class="ticket-time" style="width:118px;background:#0e5c3f;color:#e9fff1;border-radius:7px 0 0 7px;padding:18px 14px;vertical-align:middle;">
                      <div style="font:900 10px/1 Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#bfffd2;">${escapeHtml(start?.datePart ?? 'Time')}</div>
                      <div style="margin-top:7px;font:900 25px/1 Arial,sans-serif;color:#ffffff;">${escapeHtml(start?.timePart ?? 'TBD')}</div>
                      <div style="margin-top:5px;font:800 10px/1 Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#bfffd2;">${escapeHtml(start?.zonePart ?? '')}</div>
                    </td>
                    <td class="ticket-main" style="background:#f4ead8;color:#111611;border-radius:0 7px 7px 0;padding:18px 18px;vertical-align:middle;">
                      <div class="label" style="font:900 10px/1 Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#776c5b;">${escapeHtml(options.event.league_name ?? 'Event')}</div>
                      ${detailLine(options.event.venue_name)}
                      <div style="margin-top:7px;color:#565045;font:13px/1.45 Arial,sans-serif;">Shown in your local time${tz ? ` - ${escapeHtml(tz)}` : ''}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${watchHtml}
            <tr>
              <td style="padding:8px 24px 28px;">
                <a class="primary-button" href="${escapeHtml(eventUrl)}" style="display:inline-block;background:#28f070;color:#061008;text-decoration:none;font:900 14px/1 Arial,sans-serif;padding:15px 20px;border-radius:8px;">View event</a>
                ${calendarButton}
              </td>
            </tr>
            <tr>
              <td class="footer" style="padding:17px 24px 22px;border-top:1px solid #16351f;background:#070908;color:#8ba091;font:12px/1.5 Arial,sans-serif;">
                <div class="brand" style="color:#28f070;font:900 15px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;margin-bottom:7px;">${escapeHtml(brandName)}</div>
                You follow ${escapeHtml(options.event.league_name ?? 'a Silbo schedule')}. <a href="${escapeHtml(options.manageUrl)}" style="color:#9be7b4;text-decoration:none;font-weight:800;">Manage alerts</a> or change preferences any time.
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
