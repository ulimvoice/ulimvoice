const CACHE_NAME = "ulimvoice-cache-v1";
const STATIC_ASSETS = [
    "/",
    "/index.html",
    "/manifest.json",
    "/style.css",
    "/app.js",
    "/icons/icon-192.png",
    "/icons/icon-512.png"
];

// 앱 설치 후 캐싱
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
});

// 오프라인 동작
self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(resp => resp || fetch(event.request))
    );
});
