/* Кристалл — Service Worker: precache + cache-first с фолбэком в сеть */
const SW_VERSION = 'crystal-v1.4.3';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/i18n.js',
  './js/db.js',
  './js/store.js',
  './js/notify.js',
  './js/views.js',
  './js/app.js',
  './env/config.js',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/theme-collage.jpg',
  './assets/collage/1-robot.png',
  './assets/collage/2-flowers.png',
  './assets/collage/3-butterfly.png',
  './assets/collage/4-sphere.png',
  './assets/collage/5-eye.png',
  './assets/collage/6-hummingbird.png',
  './assets/collage/7-path.png',
  './assets/collage/8-chameleon.png',
  './assets/collage/9-skull.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SW_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        // Кэшируем успешные same-origin ответы на лету
        if (resp && resp.ok && new URL(req.url).origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(SW_VERSION).then((cache) => cache.put(req, copy));
        }
        return resp;
      }).catch(() => {
        // Офлайн-фолбэк: для навигации отдаём index.html
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
