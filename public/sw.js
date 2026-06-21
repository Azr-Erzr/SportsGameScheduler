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
