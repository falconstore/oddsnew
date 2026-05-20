import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any[] }

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

// Network-first para HTML (navigation) — garante sempre o index.html atualizado
// evita tela branca quando o bundle JS muda de hash após rebuild
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'pages-cache', networkTimeoutSeconds: 3 })
)

// Stale-while-revalidate para assets JS/CSS (logo hashed, atualiza em bg)
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({ cacheName: 'assets-cache' })
)

// Network-first para chamadas ao Supabase
registerRoute(
  ({ url }) => url.hostname.includes('.supabase.co'),
  new NetworkFirst({ cacheName: 'supabase-cache', networkTimeoutSeconds: 5 })
)

precacheAndRoute(self.__WB_MANIFEST)

// ─── Push notification received ──────────────────────────────────────────────
self.addEventListener('push', (event: PushEvent) => {
  let payload: { title?: string; body?: string; tag?: string; data?: Record<string, string> } = {}
  try {
    if (event.data) {
      try { payload = event.data.json() }
      catch { payload = { title: '🦈 Shark Green', body: event.data.text() } }
    } else {
      payload = { title: '🦈 Shark Green', body: 'Nova atualização disponível!' }
    }
  } catch { payload = { title: '🦈 Shark Green', body: 'Nova atualização disponível!' } }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? '🦈 Shark Green', {
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
