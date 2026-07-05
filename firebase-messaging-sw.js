/* 울림연기학원 PWA Service Worker 7.06
 * - 기존 순수 Web Push 기능 유지
 * - 앱 화면(index/navigation)만 네트워크 우선으로 조회
 * - 최신 index.html을 우선 사용하고, 네트워크 실패 시 마지막 정상 화면 사용
 * - GAS/API/이미지/음성/data.js 요청은 가로채지 않음
 */

const ULIM_SW_VERSION = '2026.07.06.706.03';
const ULIM_NAV_CACHE = 'ulim-navigation-70603';
const ULIM_APP_SHELL_URL = '/ulimvoice/index.html';

self.addEventListener('install', () => {
  // 새 Service Worker를 즉시 대기 해제합니다.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // 이전 버전의 화면 캐시만 정리합니다.
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith('ulim-navigation-') &&
                key !== ULIM_NAV_CACHE
            )
            .map((key) => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/*
 * 앱 문서만 네트워크 우선으로 처리합니다.
 * - /ulimvoice/
 * - /ulimvoice/index.html
 * - PWA 화면 이동(request.mode === navigate)
 *
 * 쿼리스트링이 계속 바뀌어도 캐시는 ULIM_APP_SHELL_URL 하나만 사용하므로
 * 버전 확인/로고 새로고침 때 캐시 항목이 무한 증가하지 않습니다.
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (!request || request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const isAppDocument =
    sameOrigin &&
    (
      request.mode === 'navigate' ||
      request.destination === 'document' ||
      url.pathname === '/ulimvoice/' ||
      url.pathname === '/ulimvoice/index.html'
    );

  if (!isAppDocument) return;

  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then(async (response) => {
        if (response && response.ok) {
          try {
            const cache = await caches.open(ULIM_NAV_CACHE);
            await cache.put(ULIM_APP_SHELL_URL, response.clone());
          } catch (cacheError) {
            // 캐시 저장 실패가 화면 로딩을 막지 않도록 합니다.
          }
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(ULIM_APP_SHELL_URL, {
          ignoreSearch: true
        });

        if (cached) return cached;

        throw new Error('울림앱 화면을 불러올 수 없습니다.');
      })
  );
});

/* 기존 Web Push 알림 기능 유지 */
self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {};
  }

  const data =
    payload.data ||
    (payload.message && payload.message.data) ||
    payload ||
    {};

  const title = data.title || '📢 연습실 예약 신청';

  const body =
    data.body ||
    `${data.studentName || '학생'} 학생이 ${data.room || ''} ${data.startTime || ''}~${data.endTime || ''}에 연습실 예약을 신청했습니다.`;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/ulimvoice/appdata/logo.png',
      badge: '/ulimvoice/appdata/logo.png',
      tag: data.reservationId || 'ulim-room-reservation',
      data: {
        url: data.url || 'https://ulimvoice.github.io/ulimvoice/',
        reservationId: data.reservationId || '',
        studentName: data.studentName || '',
        date: data.date || '',
        room: data.room || '',
        startTime: data.startTime || '',
        endTime: data.endTime || ''
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url =
    (event.notification.data && event.notification.data.url) ||
    'https://ulimvoice.github.io/ulimvoice/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/ulimvoice/') && 'focus' in client) {
            return client.focus();
          }
        }

        return clients.openWindow(url);
      })
  );
});
