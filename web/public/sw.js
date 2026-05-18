const CACHE_VERSION = 'v1.0.9';
const STATIC_CACHE = `la-sentadita-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `la-sentadita-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

const STATIC_ASSETS = [
  '/',
  '/offline',
  '/icons/pwa-192-20260212.png',
  '/icons/pwa-512-20260212.png',
  '/icons/pwa-maskable-20260212.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'La Sentadita Hub', body: event.data.text() };
  }

  const title = payload.title || 'La Sentadita Hub';
  const options = {
    badge: '/icons/pwa-192-20260212.png',
    body: payload.body || 'Tienes una nueva notificación.',
    data: payload.data || {},
    icon: '/icons/pwa-192-20260212.png',
    tag: payload.data?.notification_type || 'default',
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/app';

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    // Use the URL string (not the request object) so the SW doesn't re-issue a
    // navigate-mode fetch, which Chrome rejects after form-POST redirects and
    // would otherwise serve the offline page into the app shell, causing a
    // React hydration "application error".
    event.respondWith(fetch(request.url).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  const isStaticAsset =
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'worker' ||
    url.pathname.startsWith('/icons/');

  if (!isStaticAsset) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => Response.error());
    }),
  );
});
