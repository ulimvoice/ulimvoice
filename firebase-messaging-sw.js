/* 울림연기학원 관리자 PWA 푸시 알림용 Service Worker */
importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAW-sqtUQ_mJ6ZS_aV8pTOAKvHTSX-FXUM",
  authDomain: "ulim-7b09a.firebaseapp.com",
  projectId: "ulim-7b09a",
  storageBucket: "ulim-7b09a.firebasestorage.app",
  messagingSenderId: "364788231295",
  appId: "1:364788231295:web:b43fb49527bb6af1c6634a"
});

const messaging = firebase.messaging();

function showUlimNotification(payload) {
  const notification = payload.notification || {};
  const data = payload.data || {};

  const title =
    notification.title ||
    data.title ||
    '📢 연습실 예약 신청';

  const body =
    notification.body ||
    data.body ||
    `${data.studentName || '학생'} 학생이 ${data.room || ''} ${data.startTime || ''}~${data.endTime || ''}에 연습실 예약을 신청했습니다.`;

  return self.registration.showNotification(title, {
    body,
    icon: '/ulimvoice/appdata/logo.png',
    badge: '/ulimvoice/appdata/logo.png',
    data: {
      url: data.url || 'https://ulimvoice.github.io/ulimvoice/',
      reservationId: data.reservationId || '',
      studentName: data.studentName || '',
      date: data.date || '',
      room: data.room || '',
      startTime: data.startTime || '',
      endTime: data.endTime || ''
    }
  });
}

messaging.onBackgroundMessage((payload) => {
  return showUlimNotification(payload);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url =
    event.notification.data?.url ||
    'https://ulimvoice.github.io/ulimvoice/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/ulimvoice/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
      return null;
    })
  );
});
