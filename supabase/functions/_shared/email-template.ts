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

/*
 * "Matchday Programme" palette: dark broadcast chrome (header/hero) over a light
 * program-paper body, per the site direction — dark surfaces are for live UI,
 * light paper is for reading, and an email is a reading surface.
 */
const FONT_SANS = "'Space Grotesk','Segoe UI',Arial,sans-serif"
const FONT_DISPLAY = "'Archivo Black','Arial Black',Arial,sans-serif"

const WATCH_BADGE_STYLES: Record<string, { label: string; bg: string; fg: string }> = {
  fox_sports: { label: 'FOX', bg: '#063c78', fg: '#ffffff' },
  telemundo: { label: 'TEL', bg: '#d71920', fg: '#ffffff' },
  ctv_tsn_rds: { label: 'TSN', bg: '#cc102d', fg: '#ffffff' },
  tsn: { label: 'TSN', bg: '#cc102d', fg: '#ffffff' },
  rds: { label: 'RDS', bg: '#d71920', fg: '#ffffff' },
  peacock: { label: 'PEA', bg: '#231f55', fg: '#ffffff' },
  fubo: { label: 'FUBO', bg: '#ff5a1f', fg: '#111111' },
  dazn: { label: 'DAZN', bg: '#f2ff00', fg: '#111111' },
  espn_plus: { label: 'ESPN', bg: '#c4001a', fg: '#ffffff' },
  nba_league_pass: { label: 'NBA', bg: '#1d428a', fg: '#ffffff' },
  max_tnt: { label: 'TNT', bg: '#111827', fg: '#ffffff' },
  sling: { label: 'SLING', bg: '#00a7e1', fg: '#081015' },
  movistar_plus: { label: 'MOV', bg: '#0b8f5a', fg: '#ffffff' },
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
  return { label: label || 'TV', bg: '#0b6f44', fg: '#fff3d7' }
}

function watchBadgeHtml(watch: WatchOption) {
  const style = watchBadgeStyle(watch)
  return `<a href="${escapeHtml(normalizeUrl(watch.url))}" title="${escapeHtml(watch.name)}" style="display:inline-block;text-decoration:none;margin:0 8px 8px 0;">
    <span class="watch-badge" style="display:inline-block;min-width:44px;text-align:center;background:${style.bg};color:${style.fg};border-radius:7px;padding:9px 11px;font:800 11px/1 ${FONT_SANS};letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(style.label)}</span>
  </a>`
}

function detailLine(value: string | null | undefined) {
  if (!value) return ''
  return `<div style="margin-top:8px;color:#1d1812;font:700 15px/1.35 ${FONT_SANS};"><span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:#0b6f44;margin-right:8px;vertical-align:2px;"></span>${escapeHtml(value)}</div>`
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
  const kindLabel = (options.kind ?? 'alert').replace(/_/g, ' ')

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
    ? `<div style="display:inline-block;background:rgba(84,255,159,.12);border:1px solid rgba(84,255,159,.4);color:#54ff9f;font:700 13px/1 ${FONT_SANS};padding:9px 14px;border-radius:999px;margin-top:16px;">${escapeHtml(countdown)}</div>`
    : ''
  const watchHtml = watch.length
    ? `<tr>
          <td class="section-pad" style="padding:20px 28px 4px;">
            <div style="color:#8a7c63;font:700 11px/1.2 ${FONT_SANS};text-transform:uppercase;letter-spacing:.16em;margin-bottom:12px;">Where to watch${options.region ? ` - ${escapeHtml(options.region)}` : ''}</div>
            ${watch.map((w) => watchBadgeHtml(w)).join('')}
          </td>
        </tr>`
    : ''
  const calendarButton = options.calendarUrl
    ? `<a class="secondary-button" href="${escapeHtml(options.calendarUrl)}" style="display:inline-block;border:2px solid #0b6f44;color:#0b6f44;text-decoration:none;font:700 14px/1 ${FONT_SANS};padding:13px 20px;border-radius:9px;margin:0 0 0 10px;">Add to calendar</a>`
    : ''

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escapeHtml(options.copy.subject)}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;500;700&display=swap');
      body { -webkit-font-smoothing: antialiased; }
      /* The panel body is already program-paper; light mode just lightens the outer field.
         The header/hero stay dark on purpose — that block carries the broadcast branding
         and the lockup art is drawn for a dark background. */
      @media (prefers-color-scheme: light) {
        body, .email-bg { background:#e9ddc3 !important; }
        .panel { border:1px solid #d8c9ad !important; }
      }
      @media only screen and (max-width: 480px) {
        .email-bg { padding:8px 0 !important; }
        .panel { width:100% !important; max-width:100% !important; border-radius:0 !important; }
        .header { padding:18px 16px !important; }
        .brand-lockup { width:210px !important; max-width:100% !important; height:auto !important; }
        .hero { padding:24px 16px 26px !important; }
        .title { font-size:26px !important; line-height:1.08 !important; }
        .section-pad { padding-left:16px !important; padding-right:16px !important; }
        .ticket-stub, .ticket-main { display:block !important; width:auto !important; }
        .ticket-stub { padding:16px !important; border-radius:10px 10px 0 0 !important; }
        .ticket-main { margin-top:0 !important; padding:16px !important; border-left:0 !important; border-top:2px dashed #cbbfa4 !important; border-radius:0 0 10px 10px !important; }
        .primary-button, .secondary-button { display:block !important; box-sizing:border-box !important; width:100% !important; margin:10px 0 0 !important; text-align:center !important; }
        .watch-badge { min-width:0 !important; }
      }
      a { color:inherit; }
    </style>
  </head>
  <body style="margin:0;background:#0b0a08;color:#1d1812;font-family:'Space Grotesk','Segoe UI',Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">
      ${escapeHtml(options.copy.lead)}${countdown ? ` - ${escapeHtml(countdown)}` : ''}
    </div>
    <table class="email-bg" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0a08;padding:28px 10px;">
      <tr>
        <td align="center">
          <table class="panel" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#f4ead8;border-radius:12px;overflow:hidden;">
            <tr>
              <td class="header" style="padding:22px 28px;background:#0b0a08;">
                <img class="brand-lockup" src="${escapeHtml(emailLockupUrl)}" width="240" height="54" alt="${escapeHtml(brandName)}" style="display:block;width:240px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td class="hero" style="padding:28px 28px 30px;background:#0b0a08;background-image:linear-gradient(135deg,#0b0a08 0%,#0d1f14 62%,#12351f 100%);border-bottom:4px solid #54ff9f;">
                <div style="display:inline-block;background:#54ff9f;color:#0b0a08;font:800 11px/1 ${FONT_SANS};padding:8px 13px;border-radius:999px;text-transform:uppercase;letter-spacing:.14em;">${escapeHtml(kindLabel)}</div>
                <div style="margin-top:26px;color:#54ff9f;font:700 11px/1.2 ${FONT_SANS};text-transform:uppercase;letter-spacing:.2em;">${escapeHtml(options.event.league_name ?? 'Schedule')}</div>
                <h1 class="title" style="margin:10px 0 0;color:#f4ead8;font:400 32px/1.05 ${FONT_DISPLAY};letter-spacing:-.01em;text-transform:uppercase;">${escapeHtml(options.event.title)}</h1>
                ${countdownHtml}
              </td>
            </tr>
            <tr>
              <td class="section-pad" style="padding:26px 28px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;">
                  <tr>
                    <td class="ticket-stub" style="width:128px;background:#0b6f44;color:#fff3d7;border-radius:10px 0 0 10px;padding:20px 16px;vertical-align:middle;">
                      <div style="font:700 10px/1 ${FONT_SANS};letter-spacing:.18em;text-transform:uppercase;color:#a8e8c3;">${escapeHtml(start?.datePart ?? 'Time')}</div>
                      <div style="margin-top:8px;font:400 26px/1 ${FONT_DISPLAY};color:#ffffff;">${escapeHtml(start?.timePart ?? 'TBD')}</div>
                      <div style="margin-top:6px;font:700 10px/1 ${FONT_SANS};letter-spacing:.18em;text-transform:uppercase;color:#a8e8c3;">${escapeHtml(start?.zonePart ?? '')}</div>
                    </td>
                    <td class="ticket-main" style="background:#fffdf4;color:#1d1812;border-left:2px dashed #cbbfa4;border-radius:0 10px 10px 0;padding:20px 20px;vertical-align:middle;">
                      <div style="font:700 10px/1 ${FONT_SANS};letter-spacing:.18em;text-transform:uppercase;color:#8a7c63;">${escapeHtml(options.event.league_name ?? 'Event')}</div>
                      ${detailLine(options.event.venue_name)}
                      <div style="margin-top:8px;color:#5f5544;font:400 13px/1.45 ${FONT_SANS};">Shown in your local time${tz ? ` - ${escapeHtml(tz)}` : ''}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${watchHtml}
            <tr>
              <td class="section-pad" style="padding:16px 28px 30px;">
                <a class="primary-button" href="${escapeHtml(eventUrl)}" style="display:inline-block;background:#0b6f44;color:#fff3d7;text-decoration:none;font:700 14px/1 ${FONT_SANS};padding:15px 22px;border-radius:9px;">View event</a>
                ${calendarButton}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 24px;border-top:1px solid #d8c9ad;background:#efe3cd;color:#5f5544;font:400 12.5px/1.55 ${FONT_SANS};">
                <div style="color:#0b6f44;font:400 14px/1 ${FONT_DISPLAY};letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(brandName)}</div>
                You follow ${escapeHtml(options.event.league_name ?? 'a Silbo schedule')}. <a href="${escapeHtml(options.manageUrl)}" style="color:#0b6f44;text-decoration:underline;font-weight:700;">Manage alerts</a> or change preferences any time.
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
