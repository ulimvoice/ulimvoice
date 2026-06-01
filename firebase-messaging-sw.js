/* 울림연기학원 PWA 푸시 알림용 Service Worker - 순수 Web Push 방식 */

self.addEventListener('install', (event) => {
  // 새 Service Worker가 설치되면 대기 상태를 줄입니다.
  // 실제 화면 새로고침은 index.html의 확인창에서 처리합니다.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {};
  }

  const data =
    (payload.data) ||
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
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/ulimvoice/') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
