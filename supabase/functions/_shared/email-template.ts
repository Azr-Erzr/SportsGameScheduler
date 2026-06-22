import type { AlertCopy, AlertCopyEvent } from './alert-copy.ts'

type RenderAlertEmailOptions = {
  appUrl: string
  brandName?: string
  copy: AlertCopy
  event: AlertCopyEvent
  manageUrl: string
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

function formatStart(startsAt?: string | null, timezone?: string | null) {
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
      timeZoneName: 'short',
      timeZone: timezone || undefined,
    }).format(date)
  } catch (_) {
    return date.toUTCString()
  }
}

function textDetails(event: AlertCopyEvent) {
  return [
    event.league_name ? `League: ${event.league_name}` : '',
    formatStart(event.starts_at, event.timezone) ? `Start: ${formatStart(event.starts_at, event.timezone)}` : '',
    event.venue_name ? `Venue: ${event.venue_name}` : '',
  ].filter(Boolean)
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
  const start = formatStart(options.event.starts_at, options.event.timezone)
  const details = textDetails(options.event)
  const text = [
    options.copy.lead,
    '',
    ...details,
    '',
    `Open schedule: ${appUrl}`,
    `Manage alerts: ${options.manageUrl}`,
  ].join('\n')

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(options.copy.subject)}</title>
  </head>
  <body style="margin:0;background:#070908;color:#f3efe2;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">
      ${escapeHtml(options.copy.lead)}
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
            <tr>
              <td style="padding:2px 24px 28px;">
                <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#28f070;color:#061008;text-decoration:none;font:900 14px/1 Arial,sans-serif;padding:13px 18px;border-radius:6px;">Open schedule</a>
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
