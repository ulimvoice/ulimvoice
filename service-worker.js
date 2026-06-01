const CACHE_NAME = "ulimvoice-cache-v33-whisper-gas-stt";

// GitHub Pages 프로젝트 경로에서는 상대경로가 가장 안전합니다.
// service-worker.js가 /ulimvoice/service-worker.js에 있다면 ./ 는 /ulimvoice/ 기준입니다.
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
            .then(cache => {
                return Promise.allSettled(
                    STATIC_ASSETS.map(async url => {
                        try {
                            const request = new Request(url, { cache: "reload" });
                            const response = await fetch(request);

                            if (!response.ok) {
                                console.warn("[SW] 캐시 제외:", url, response.status);
                                return;
                            }

                            await cache.put(request, response);
                        } catch (err) {
                            console.warn("[SW] 캐시 실패:", url, err);
                        }
                    })
                );
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => {
                return Promise.all(
                    keys
                        .filter(key => key !== CACHE_NAME)
                        .map(key => caches.delete(key))
                );
            })
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    // POST 요청은 절대 서비스워커가 건드리지 않게 함
    // 일일평가 저장, GAS 전송 같은 기능 보호
    if (request.method !== "GET") {
        return;
    }

    // GAS, 외부 CDN, 외부 이미지 등은 캐시하지 않고 브라우저 기본 처리
    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) {
                return cached;
            }

            return fetch(request)
                .then(response => {
                    return response;
                })
                .catch(() => {
                    // 페이지 새로고침 오프라인 fallback
                    if (request.mode === "navigate") {
                        return caches.match("./index.html");
                    }
                });
        })
    );
});
