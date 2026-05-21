// Service Worker mínimo — Shark Green App
// Este arquivo é sobrescrito pelo VitePWA durante o build (src/sw.ts).
// Serve como fallback e para validação por ferramentas como PWA Builder.

const CACHE_NAME = 'sharkgreen-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first para navegação (sempre index.html atualizado)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/app/index.html'))
    );
    return;
  }

  // Network-first para chamadas ao Supabase
  if (url.hostname.includes('.supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first para assets estáticos com hash no nome
  if (
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    event.request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});
