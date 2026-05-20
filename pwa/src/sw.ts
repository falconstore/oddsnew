import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any[] }

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Network-first para chamadas ao Supabase
registerRoute(
  ({ url }) => url.hostname.includes('.supabase.co'),
  new NetworkFirst({ cacheName: 'supabase-cache', networkTimeoutSeconds: 5 })
)

// ─── Push notification received ──────────────────────────────────────────────
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return
  let payload: { title?: string; body?: string; tag?: string; data?: Record<string, string> }
  try { payload = event.data.json() } catch { payload = { title: 'Shark Green', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Shark Green', {
      body: payload.body ?? '',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: payload.tag ?? 'sg',
      renotify: true,
      data: payload.data ?? {},
    } as NotificationOptions)
  )
})

// ─── Notification click — open or focus app ──────────────────────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url: string = (event.notification.data as any)?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.startsWith(self.registration.scope))
      if (existing) { existing.focus(); (existing as WindowClient).navigate(url) }
      else self.clients.openWindow(url)
    })
  )
})
