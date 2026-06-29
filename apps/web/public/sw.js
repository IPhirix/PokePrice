// Minimal service worker — required for PWA installability on Chrome/Android.
// No caching strategy: network-only for all requests.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)))
