// Service Worker for Web Push Notifications
// Handles background push events even when the app is closed

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'إشعار جديد', body: event.data.text() };
  }

  const title = data.title || 'صنايعي';
  const options = {
    body: data.body || '',
    icon: '/assets/images/__________________24_-1790287739442.png',
    badge: '/assets/images/__________________24_-1790287739442.png',
    dir: 'rtl',
    lang: 'ar',
    tag: data.tag || 'sanaei-notification',
    data: {
      url: data.url || '/home-screen',
      orderId: data.orderId || null,
    },
    actions: data.actions || [],
    requireInteraction: false,
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
