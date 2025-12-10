// const BASE = "/ulimvoice/";
const BASE = "/"; // 깃허브 Pages의 경우, Service Worker는 보통 사이트 루트('/')에서 제어합니다.

const CACHE_NAME = "ulimvoice-cache-v1";
const STATIC_ASSETS = [
    // BASE는 '/'로 변경되었으므로, 파일명을 직접 지정합니다.
    BASE,
    BASE + "index.html",
    BASE + "manifest.json",
    // 깃허브에 없는 파일은 제거해야 404 오류를 피할 수 있습니다.
    // BASE + "style.css", // 깃허브에 없거나 경로가 다름
    // BASE + "app.js",   // 깃허브에 없거나 경로가 다름 
    
    // appdata 폴더의 파일을 캐시하려면 경로를 명시해야 합니다.
    BASE + "appdata/etude/data.js", 
    BASE + "appdata/vocalization/data.js", 
    BASE + "appdata/past_questions/data.js", 

    BASE + "icons/icon-192.png", // icons 폴더가 루트에 있다면 BASE + "icons/..."
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
