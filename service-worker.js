/* ULIM service worker retirement shim 7.35.5.0.58
 * The app's single active worker is firebase-messaging-sw.js.
 * This legacy filename only clears old app-shell caches and never intercepts fetches.
 */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(function (name) { return /^ulimvoice-cache-/i.test(String(name || '')); }).map(function (name) { return caches.delete(name); }));
    } catch (_ignore) {}
    await self.clients.claim();
  })());
});
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
