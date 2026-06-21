// Notification worker. Run on a cron schedule:
// 1. Materialize reminder and schedule-change rows.
// 2. Atomically claim due rows.
// 3. Dispatch each row through its selected channel.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { alertCopyFor } from '../_shared/alert-copy.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Silbo Sports <reminders@silbosports.app>'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://silbosports.app'
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? `mailto:alerts@${new URL(APP_URL).hostname}`

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
  venues: { name: string | null } | null
  leagues: { name: string | null } | null
}

class SkipDelivery extends Error {}

async function sendReminderEmail(delivery: Delivery) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured')
  if (!delivery.user_id || !delivery.event_id) throw new Error('Delivery missing user or event')

  const [{ data: user }, { data: event }] = await Promise.all([
    supabase.auth.admin.getUserById(delivery.user_id),
    supabase
      .from('events')
      .select('title, starts_at, timezone, venues(name), leagues(name)')
      .eq('id', delivery.event_id)
      .single(),
  ])
  const email = user?.user?.email
  if (!email || !event) throw new Error('Missing recipient or event')

  const row = event as EventForAlert
  const copy = alertCopyFor(
    delivery.kind,
    {
      title: row.title,
      starts_at: row.starts_at,
      timezone: row.timezone,
      venue_name: row.venues?.name ?? null,
      league_name: row.leagues?.name ?? null,
    },
    `${APP_URL}/settings/alerts`,
  )

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: email,
      subject: copy.subject,
      text: copy.body,
    }),
  })
  if (!response.ok) throw new Error(`Email send failed: ${response.status} ${await response.text()}`)
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

  for (const delivery of (claimed ?? []) as Delivery[]) {
    try {
      if (delivery.channel === 'push') {
        await sendPushNotification(delivery)
      } else {
        await sendReminderEmail(delivery)
      }
      await supabase
        .from('notification_deliveries')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', delivery.id)
      sent += 1
    } catch (error) {
      const isSkip = error instanceof SkipDelivery
      await supabase
        .from('notification_deliveries')
        .update({ status: isSkip ? 'skipped' : 'failed', error: String(error) })
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
