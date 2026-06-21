import { getSupabaseClient } from './supabase'

export const vapidPublicKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || ''

export function pushSupported() {
  return Boolean(vapidPublicKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)
}

function base64UrlToUint8Array(value: string) {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

async function readyRegistration() {
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

export async function enableBrowserPush(userId: string) {
  if (!pushSupported()) throw new Error('Browser push is not configured for this build.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')

  const registration = await readyRegistration()
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
  })
  const json = subscription.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!endpoint || !p256dh || !auth) throw new Error('Browser returned an incomplete push subscription.')

  const supabase = await getSupabaseClient()
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: userId, endpoint, p256dh, auth }, { onConflict: 'endpoint' })
  if (error) throw error
}

export async function disableBrowserPush() {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  const endpoint = subscription?.endpoint
  if (subscription) await subscription.unsubscribe()
  if (!endpoint) return

  const supabase = await getSupabaseClient()
  if (supabase) await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}
