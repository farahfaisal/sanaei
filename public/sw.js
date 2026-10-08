// Service Worker for Web Push Notifications + PWA
//
// Caching rules (important):
//  - NEVER cache API/data requests (Supabase etc.) — caching them made chats and
//    orders show old data (new messages "disappeared" from the history).
//  - Static build files and images: cache-first (they never change).
//  - Pages: network-first, cached copy only when offline.
// Bumping CACHE_NAME deletes every older cache on activation.

const CACHE_NAME = 'herafi-static-v3';
const STATIC_ASSETS = [
  '/assets/images/app_logo.png',
  '/icons/herafi-192.png',
  '/icons/herafi-512.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Other origins (Supabase API, realtime, fonts, analytics): always go to the network.
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
  }
  // Anything else (same-origin API routes, RSC data): network only.
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'إشعار جديد', body: event.data.text() };
  }

  const title = data.title || 'حِرَفي';
  const options = {
    body: data.body || '',
    icon: '/icons/herafi-192.png',
    badge: '/icons/herafi-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: data.tag || 'herafi-notification',
    data: {
      url: data.url || '/home-screen',
      orderId: data.orderId || null,
    },
    actions: data.actions || [],
    requireInteraction: false,
    renotify: true,          // alert again when a newer update replaces the same tag
    vibrate: [100, 50, 100],
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/home-screen';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
