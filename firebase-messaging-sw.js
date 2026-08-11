/* 울림연기학원 PWA 푸시 알림용 Service Worker - 7.35.5.0.37 */

self.addEventListener('install', (event) => {
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
  } catch (_ignore) {
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
  const url = data.url || 'https://ulimvoice.github.io/ulimvoice/?open=admin-room';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/ulimvoice/appdata/logo.png',
      badge: '/ulimvoice/appdata/logo.png',
      tag: data.reservationId || 'ulim-room-reservation',
      data: {
        url,
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

  const data = event.notification.data || {};
  const url = data.url || 'https://ulimvoice.github.io/ulimvoice/?open=admin-room';

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if (!client.url.includes('/ulimvoice/') || !('focus' in client)) continue;
      if ('navigate' in client) {
        try {
          await client.navigate(url);
        } catch (_ignore) {
          try { client.postMessage({ type: 'ULIM_OPEN_ADMIN_ROOM', url, data }); } catch (_ignorePost) {}
        }
      }
      return client.focus();
    }
    return clients.openWindow(url);
  })());
});
