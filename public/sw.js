self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('silbo-app-shell-v1').then((cache) =>
      cache.addAll(['/', '/site.webmanifest', '/favicon.svg', '/apple-touch-icon.png', '/pwa-192x192.png']),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== 'silbo-app-shell-v1').map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open('silbo-app-shell-v1').then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/') || Response.error()),
    )
    return
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)))
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = payload.title || 'Silbo Sports alert'
  const options = {
    body: payload.body || 'A schedule you follow has an update.',
    icon: '/apple-touch-icon.png',
    badge: '/favicon-32x32.png',
    data: { url: payload.url || '/settings/alerts' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/settings/alerts'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow(target)
    }),
  )
})
