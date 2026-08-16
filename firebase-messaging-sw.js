/* 울림연기학원 Push 전용 Service Worker 7.35.5.0.70
 * - navigation/fetch 캐시를 소유하지 않습니다.
 * - 연습일지 알림은 recordId/evaluationId를 보존하고 정확한 화면으로 딥링크합니다.
 */
const ULIM_SW_VERSION = '2026.08.16.7355070-push-deeplink';

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
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function text(value) {
  return String(value == null ? '' : value).trim();
}

function normalizePushData(payload) {
  const source =
    (payload && payload.data) ||
    (payload && payload.message && payload.message.data) ||
    payload ||
    {};
  const notification = payload && payload.notification || {};
  return {
    title: text(notification.title || source.title),
    body: text(notification.body || source.body),
    url: text(source.url) || 'https://ulimvoice.github.io/ulimvoice/',
    kind: text(source.kind),
    recordId: text(source.recordId),
    practiceDate: text(source.practiceDate || source.date),
    taskType: text(source.taskType),
    evaluationId: text(source.evaluationId),
    evaluatorKey: text(source.evaluatorKey),
    teacherUid: text(source.teacherUid),
    teacherName: text(source.teacherName),
    studentUid: text(source.studentUid),
    studentName: text(source.studentName),
    reservationId: text(source.reservationId),
    date: text(source.date || source.practiceDate),
    room: text(source.room),
    startTime: text(source.startTime),
    endTime: text(source.endTime)
  };
}

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_error) { payload = {}; }
  const data = normalizePushData(payload);
  const title = data.title || (data.kind === 'practice_feedback'
    ? `${data.teacherName || '선생님'}T의 코멘트 도착!`
    : data.kind === 'practice_upload'
      ? `${data.studentName || '학생'} 학생 연습 완료`
      : '울림 알림');
  const body = data.body || (data.kind === 'practice_feedback'
    ? '새로운 강사 평가와 코멘트를 확인해주세요.'
    : data.kind === 'practice_upload'
      ? '새로운 연습일지를 확인해주세요.'
      : `${data.studentName || '학생'} 학생이 ${data.room || ''} ${data.startTime || ''}~${data.endTime || ''}에 연습실 예약을 신청했습니다.`);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/ulimvoice/appdata/logo.png',
      badge: '/ulimvoice/appdata/logo.png',
      tag: data.recordId ? `${data.kind || 'practice'}:${data.recordId}:${data.evaluationId || ''}` : (data.reservationId || 'ulim-notification'),
      renotify: true,
      data
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = text(data.url) || 'https://ulimvoice.github.io/ulimvoice/';

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if (!client.url.includes('/ulimvoice/')) continue;
      try {
        client.postMessage({ type: 'ULIM_PUSH_DEEP_LINK', url, data });
      } catch (_ignoreMessage) {}
      try {
        if ('navigate' in client) await client.navigate(url);
      } catch (_ignoreNavigate) {}
      if ('focus' in client) return client.focus();
      return client;
    }
    return clients.openWindow(url);
  })());
});
