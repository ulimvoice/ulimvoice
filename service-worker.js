const CACHE_NAME = "ulimvoice-cache-v57-stability-7355019";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest-index.json",
  "./manifest-tablet.json",
  "./tablet.html",
  "./appdata/etude/data.js",
  "./appdata/vocalization/data.js",
  "./appdata/past_questions/data.js",
  "./appdata/logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(
        STATIC_ASSETS.map(async url => {
          try {
            const request = new Request(url, { cache: "reload" });
            const response = await fetch(request);
            if (response.ok) await cache.put(request, response.clone());
          } catch (_error) {}
        })
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isShellRequest_(request, url) {
  if (request.mode === "navigate") return true;
  return /\/(?:index|tablet)\.html$/i.test(url.pathname);
}

async function networkFirst_(request, url) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(new Request(request, { cache: "no-store" }));
    if (response && response.ok) {
      await cache.put(request, response.clone());
      if (/\/tablet\.html$/i.test(url.pathname)) {
        await cache.put("./tablet.html", response.clone());
      } else if (/\/index\.html$/i.test(url.pathname) || url.pathname.endsWith("/ulimvoice/")) {
        await cache.put("./index.html", response.clone());
      }
    }
    return response;
  } catch (_error) {
    const exact = await cache.match(request);
    if (exact) return exact;
    if (/\/tablet\.html$/i.test(url.pathname)) {
      return cache.match("./tablet.html");
    }
    return cache.match("./index.html");
  }
}

async function cacheThenRefresh_(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async response => {
      if (response && response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || refresh;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isShellRequest_(request, url)) {
    event.respondWith(networkFirst_(request, url));
    return;
  }

  event.respondWith(cacheThenRefresh_(request));
});
