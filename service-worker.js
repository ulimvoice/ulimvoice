const BASE = "/ulimvoice/";

const CACHE_NAME = "ulimvoice-cache-v1";
const STATIC_ASSETS = [
    BASE,
    BASE + "index.html",
    BASE + "manifest.json",
    BASE + "style.css",
    BASE + "app.js",
    BASE + "icons/icon-192.png",
    BASE + "icons/icon-512.png"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(resp => resp || fetch(event.request))
    );
});
