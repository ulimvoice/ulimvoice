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

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || '울림 연습실 예약 알림';
  const body = notification.body || data.body || '새 연습실 예약이 접수되었습니다.';

  self.registration.showNotification(title, {
    body,
    icon: './appdata/logo.png',
    badge: './appdata/logo.png',
    data: {
      url: data.url || './',
      reservationId: data.reservationId || '',
      date: data.date || '',
      room: data.room || ''
    }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
      return null;
    })
  );
});
