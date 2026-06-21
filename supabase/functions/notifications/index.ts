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
  _subscription: { endpoint: string; p256dh: string; auth: string },
  _delivery: Delivery,
): Promise<'ok' | 'gone'> {
  throw new SkipDelivery('Web Push not yet configured (VAPID keys pending)')
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
