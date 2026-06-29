// Notification worker. Run on a cron schedule:
// 1. Materialize reminder and schedule-change rows.
// 2. Atomically claim due rows.
// 3. Dispatch each row through its selected channel.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { alertCopyFor } from '../_shared/alert-copy.ts'
import { renderSilboAlertEmail, type WatchOption } from '../_shared/email-template.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? Deno.env.get('RESENDAPI') ?? ''
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Silbo Sports <reminders@silbosports.app>'
const APP_URL = normalizeAppUrl(Deno.env.get('APP_URL') ?? 'https://silbosports.app')
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? `mailto:alerts@${new URL(APP_URL).hostname}`
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

type Delivery = {
  id: string
  user_id: string | null
  event_id: string | null
  channel: 'email' | 'push'
  kind: string
}

type EventForAlert = {
  title: string
  starts_at: string | null
  timezone: string | null
  league_id: string | null
  venues: { name: string | null } | null
  leagues: { name: string | null } | null
  sports: { key: string | null } | null
}

class SkipDelivery extends Error {}

// Some feeds (e.g. the openfootball World Cup dataset) carry knockout fixtures as slot-code
// placeholders that never resolve to real teams — "1E vs 3A/B/C/D/F", "1C vs 2F", "W49 vs W50".
// An alert built from one of these is the "scrambled matchup" users complained about, so we skip
// sending rather than mail a placeholder. Conservative: BOTH sides of "vs" must be pure slot codes
// (group rank like 1E/3A with optional alternates "/B/C", or Winner/Loser match refs Wn/Ln), so a
// real name that happens to contain a digit or letter — "Bayer 04", "Real Madrid" — never trips it.
const SLOT_CODE = /^(?:[1-4][A-L](?:\/[A-L])*|[WL]\d{1,3})$/i
function isUnresolvedPlaceholderTitle(title: string | null | undefined): boolean {
  if (!title) return false
  const sides = title.split(/\s+vs\.?\s+/i)
  if (sides.length !== 2) return false
  return sides.every((side) => SLOT_CODE.test(side.trim()))
}

function normalizeAppUrl(value: string) {
  try {
    return new URL(value).toString().replace(/\/$/, '')
  } catch (_) {
    return 'https://silbosports.app'
  }
}

function isEmail(value: string | null | undefined): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

function errorMessage(error: unknown, maxLength = 900) {
  const message = error instanceof Error ? error.message : String(error)
  return message.length > maxLength ? `${message.slice(0, maxLength)}...` : message
}

function resendTagValue(value: string | null | undefined) {
  return String(value ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'unknown'
}

async function resendError(response: Response) {
  const body = await response.text().catch(() => '')
  return `Email send failed: ${response.status} ${body.slice(0, 500)}`
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ISO → Google Calendar template format (YYYYMMDDTHHMMSSZ).
function toCalendarStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// One-tap "add to calendar" via the Google Calendar template URL (works inline in email, no hosting).
function buildCalendarUrl(title: string, startsAt: string | null, venue: string | null, eventUrl: string) {
  if (!startsAt) return null
  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toCalendarStamp(start)}/${toCalendarStamp(end)}`,
    details: `View on Silbo Sports: ${eventUrl}`,
  })
  if (venue) params.set('location', venue)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// Region for where-to-watch: profiles only stores locale + timezone, so mirror the app and derive
// the country from the locale (en-US → US), defaulting to US.
function regionFromLocale(locale: string | null | undefined) {
  const part = locale?.split('-')[1]
  return (part || 'US').toUpperCase()
}

// Official where-to-watch destinations from the DB (watch_links + watch_providers), scoped to the
// event/league/sport and filtered to the recipient's region. Mirrors the app's `db` tier; returns
// nothing (graceful) when a competition has no seeded rows.
async function fetchWatchOptions(
  eventId: string | null,
  leagueId: string | null,
  sportKey: string | null,
  region: string,
): Promise<WatchOption[]> {
  const { data } = await supabase
    .from('watch_links')
    .select('provider_key, label, country_codes, sport_keys, event_id, league_id, url, priority, watch_providers(name, direct_url)')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(200)
  if (!data) return []

  const sportAliases = sportKey === 'soccer' ? ['soccer', 'world_cup'] : sportKey ? [sportKey] : []
  const seen = new Set<string>()
  const out: WatchOption[] = []
  for (const row of data as unknown as Array<{
    label: string | null
    country_codes: string[] | null
    sport_keys: string[] | null
    event_id: string | null
    league_id: string | null
    url: string | null
    watch_providers: { name: string | null; direct_url: string | null } | null
    provider_key: string | null
  }>) {
    const inScope =
      (row.event_id && row.event_id === eventId) ||
      (row.league_id && row.league_id === leagueId) ||
      (!row.event_id && !row.league_id && (row.sport_keys ?? []).some((s) => sportAliases.includes(s)))
    if (!inScope) continue
    const countries = row.country_codes ?? []
    if (countries.length && !countries.includes(region)) continue
    const name = row.label ?? row.watch_providers?.name
    const url = row.url ?? row.watch_providers?.direct_url
    if (!name || !url) continue
    const dedupe = `${name}:${url}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    out.push({ name, url, providerKey: row.provider_key })
    if (out.length >= 3) break
  }
  return out
}

async function sendReminderEmail(delivery: Delivery) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY/RESENDAPI not configured')
  if (!delivery.user_id || !delivery.event_id) throw new Error('Delivery missing user or event')

  const [{ data: user }, { data: event }, { data: profile }] = await Promise.all([
    supabase.auth.admin.getUserById(delivery.user_id),
    supabase
      .from('events')
      .select('title, starts_at, timezone, league_id, venues(name), leagues(name), sports(key)')
      .eq('id', delivery.event_id)
      .single(),
    supabase
      .from('profiles')
      .select('default_timezone, locale, hour12')
      .eq('user_id', delivery.user_id)
      .maybeSingle(),
  ])
  const email = user?.user?.email
  if (!isEmail(email)) throw new SkipDelivery('Missing or invalid recipient email')
  if (!event) throw new SkipDelivery('Missing event for delivery')

  const row = event as EventForAlert
  // Never mail an unresolved slot-code placeholder (e.g. "1E vs 3A/B/C/D/F"). The event is read
  // fresh here, so a resolved fixture always renders correctly; this only guards the never-resolving
  // skeleton rows. Skipped (not failed) so it doesn't churn retries.
  if (isUnresolvedPlaceholderTitle(row.title)) {
    throw new SkipDelivery(`Unresolved placeholder fixture title: ${row.title}`)
  }
  const prefs = (profile ?? {}) as { default_timezone: string | null; locale: string | null; hour12: boolean | null }
  const region = regionFromLocale(prefs.locale)
  const manageUrl = `${APP_URL}/settings/alerts`
  const eventUrl = `${APP_URL}/events/${delivery.event_id}`
  const watch = await fetchWatchOptions(delivery.event_id, row.league_id, row.sports?.key ?? null, region)
  const calendarUrl = buildCalendarUrl(row.title, row.starts_at, row.venues?.name ?? null, eventUrl)

  const copy = alertCopyFor(
    delivery.kind,
    {
      title: row.title,
      starts_at: row.starts_at,
      timezone: row.timezone,
      venue_name: row.venues?.name ?? null,
      league_name: row.leagues?.name ?? null,
    },
    manageUrl,
  )
  const emailBody = renderSilboAlertEmail({
    appUrl: APP_URL,
    brandName: 'Silbo Sports',
    copy,
    event: {
      title: row.title,
      starts_at: row.starts_at,
      timezone: row.timezone,
      venue_name: row.venues?.name ?? null,
      league_name: row.leagues?.name ?? null,
    },
    manageUrl,
    eventUrl,
    kind: delivery.kind,
    // Show the start time in the recipient's own timezone — the core promise — falling back to the
    // event's timezone, then UTC, inside the template.
    displayTimezone: prefs.default_timezone,
    hour12: prefs.hour12,
    region,
    watch,
    calendarUrl,
  })

  const request: RequestInit = {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [email],
      subject: emailBody.subject,
      text: emailBody.text,
      html: emailBody.html,
      tags: [
        { name: 'delivery_id', value: resendTagValue(delivery.id) },
        { name: 'kind', value: resendTagValue(delivery.kind) },
        { name: 'channel', value: 'email' },
      ],
    }),
  }
  let response = await fetch(RESEND_ENDPOINT, request)
  // Resend caps at 5 req/s; on a burst (many fixtures due at once) back off once and retry so an
  // alert is never silently dropped. The per-send throttle in the dispatch loop makes this rare.
  if (response.status === 429) {
    await sleep(1200)
    response = await fetch(RESEND_ENDPOINT, request)
  }
  if (!response.ok) throw new Error(await resendError(response))
}

async function sendPushNotification(delivery: Delivery) {
  if (!delivery.user_id) throw new Error('Delivery missing user')
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', delivery.user_id)
  if (!subscriptions?.length) throw new SkipDelivery('No push subscriptions for user')

  for (const subscription of subscriptions) {
    const result = await deliverWebPush(subscription, delivery)
    if (result === 'gone') {
      await supabase.from('push_subscriptions').delete().eq('id', subscription.id)
    }
  }
}

async function deliverWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  delivery: Delivery,
): Promise<'ok' | 'gone'> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new SkipDelivery('VAPID keys not configured')
  const aud = new URL(subscription.endpoint).origin
  const jwt = await createVapidJwt(aud)
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
      ttl: '3600',
      urgency: delivery.kind === 'reminder' ? 'normal' : 'high',
    },
  })
  if (response.status === 404 || response.status === 410) return 'gone'
  if (!response.ok) throw new Error(`Web Push failed: ${response.status} ${await response.text()}`)
  return 'ok'
}

function base64UrlToBytes(value: string) {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

function bytesToBase64Url(bytes: Uint8Array) {
  let raw = ''
  for (const byte of bytes) raw += String.fromCharCode(byte)
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function jsonToBase64Url(value: Record<string, unknown>) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)))
}

async function createVapidJwt(aud: string) {
  const publicBytes = base64UrlToBytes(VAPID_PUBLIC_KEY)
  const privateBytes = base64UrlToBytes(VAPID_PRIVATE_KEY)
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) throw new Error('Invalid VAPID public key')
  if (privateBytes.length !== 32) throw new Error('Invalid VAPID private key')

  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: bytesToBase64Url(publicBytes.slice(1, 33)),
      y: bytesToBase64Url(publicBytes.slice(33, 65)),
      d: bytesToBase64Url(privateBytes),
      ext: false,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const header = jsonToBase64Url({ typ: 'JWT', alg: 'ES256' })
  const payload = jsonToBase64Url({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  })
  const input = `${header}.${payload}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(input),
  )
  return `${input}.${bytesToBase64Url(new Uint8Array(signature))}`
}

Deno.serve(async () => {
  const { data: materialized, error: materializeError } = await supabase.rpc('materialize_reminders')
  if (materializeError) {
    return Response.json({ ok: false, error: String(materializeError.message) }, { status: 500 })
  }

  const { data: materializedChanges, error: changeMaterializeError } = await supabase.rpc(
    'materialize_change_notifications',
  )
  if (changeMaterializeError) {
    return Response.json({ ok: false, error: String(changeMaterializeError.message) }, { status: 500 })
  }

  const { data: claimed, error: claimError } = await supabase.rpc('claim_due_notifications')
  if (claimError) {
    return Response.json({ ok: false, error: String(claimError.message) }, { status: 500 })
  }

  let sent = 0
  let failed = 0
  let skipped = 0

  let emailsSent = 0
  for (const delivery of (claimed ?? []) as Delivery[]) {
    try {
      if (delivery.channel === 'push') {
        await sendPushNotification(delivery)
      } else {
        // Stay under Resend's 5/s cap when a batch of email alerts comes due together.
        if (emailsSent > 0) await sleep(220)
        emailsSent += 1
        await sendReminderEmail(delivery)
      }
      await supabase
        .from('notification_deliveries')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
        .eq('id', delivery.id)
      sent += 1
    } catch (error) {
      const isSkip = error instanceof SkipDelivery
      await supabase
        .from('notification_deliveries')
        .update({ status: isSkip ? 'skipped' : 'failed', error: errorMessage(error) })
        .eq('id', delivery.id)
      if (isSkip) skipped += 1
      else failed += 1
    }
  }

  return Response.json({
    ok: true,
    materialized,
    materializedChanges,
    claimed: claimed?.length ?? 0,
    sent,
    failed,
    skipped,
  })
})
