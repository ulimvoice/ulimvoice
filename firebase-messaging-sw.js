/* 울림연기학원 Push 전용 Service Worker 7.35.5.0.10
 * - 앱 화면(index/navigation)을 가로채거나 캐시하지 않습니다.
 * - 과거 ulim-navigation-* 화면 캐시를 활성화 시 모두 삭제합니다.
 * - 기존 Web Push 알림 기능만 유지합니다.
 */

const ULIM_SW_VERSION = '2026.08.07.7350510-push-only';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('ulim-navigation-'))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/*
 * 중요:
 * fetch 이벤트를 등록하지 않습니다.
 * index.html과 화면 이동 요청은 브라우저가 항상 네트워크에서 직접 받습니다.
 */

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (_error) {
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
