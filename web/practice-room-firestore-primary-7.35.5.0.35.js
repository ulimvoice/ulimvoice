(function (global) {
  'use strict';
  if (global.__ULIM_PRACTICE_ROOM_FIRESTORE_PRIMARY_7355035__) return;

  const VERSION = '2026-08-11.7355035-practice-room-decision-notification';
  const API = {};

  function text(value) { return String(value == null ? '' : value).trim(); }
  function normalizeRole(value) { return text(value).normalize('NFKC').toLowerCase().replace(/[\s_-]+/g, ''); }
  function sharedRuntimeOwner() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_72918 || global.ULIM_ROOM_CLASSROOM_REALTIME_72917 || global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || null;
  }
  async function runtime() {
    const owner = sharedRuntimeOwner();
    if (!owner || typeof owner.preloadRuntime !== 'function') throw new Error('연습실 예약 기능을 준비하지 못했습니다.');
    const rt = await owner.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('로그인 후 이용해주세요.');
    if (typeof owner.getStableIdToken === 'function') await owner.getStableIdToken(rt, false, 'practice-room-7355033');
    else if (typeof rt.sdk.getIdToken === 'function') await rt.sdk.getIdToken(rt.auth.currentUser, false);
    return rt;
  }
  async function call(name, payload) {
    const rt = await runtime();
    const fn = rt.sdk.httpsCallable(rt.functions, name);
    const response = await fn(payload || {});
    return response && response.data || {};
  }
  function currentActorSnapshot() {
    try {
      const studentAuth = global.__ULIM_STUDENT_FIREBASE_DIRECT_AUTH_7355030__;
      if (studentAuth && typeof studentAuth.currentProfile === 'function') {
        const p = studentAuth.currentProfile();
        if (p && p.studentUid) {
          return { authenticated:true, type:'student', studentUid:text(p.studentUid), firebaseUid:text(p.firebaseUid || p.uid), name:text(p.name || p.studentName || global.studentName || localStorage.getItem('studentName')), identity:'student_'+text(p.studentUid) };
        }
      }
    } catch (_ignore) {}
    try {
      let info = {};
      try { info = JSON.parse(localStorage.getItem('ulimFirebaseStaffProfile7320') || 'null') || {}; } catch (_ignoreProfile) {}
      if (!info || typeof info !== 'object' || !Object.keys(info).length) info = global.adminInfo && typeof global.adminInfo === 'object' ? global.adminInfo : JSON.parse(localStorage.getItem('adminInfo') || '{}');
      const role = normalizeRole(info.firebaseRole || info.role || info.permission);
      if (['teacher','admin','superadmin','전체관리자','전체관리','원장'].includes(role)) {
        const uid = text(info.firebaseUid || info.principalUidV2 || info.principalUid || info.uid || info.accountUid);
        const name = text(info.name || info.adminName || info.instructorName || info.id || info.adminId || '교직원');
        return { authenticated:true, type:'staff', firebaseUid:uid, name:name, instructorName:name, identity:'staff_'+(uid || name) };
      }
    } catch (_ignore2) {}
    return { authenticated:false, type:'', firebaseUid:'', studentUid:'', name:'', identity:'public' };
  }
  function requestId(prefix) {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return prefix + '-' + global.crypto.randomUUID();
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
  API.version = VERSION;
  API.currentActorSnapshot = currentActorSnapshot;
  API.getMonth = function (year, month) {
    return call('getPracticeRoomMonth7355033', { year:Number(year), month:Number(month), requestId:requestId('room-month-7355033') });
  };
  API.createReservation = function (date, room, startHour) {
    return call('createPracticeRoomReservation7355033', { date:text(date), room:text(room), startHour:Number(startHour), endHour:Number(startHour)+1, requestId:requestId('room-create-7355033') });
  };
  API.cancelReservation = function (reservationId, date) {
    return call('cancelPracticeRoomReservation7355033', { reservationId:text(reservationId), date:text(date), requestId:requestId('room-cancel-7355033') });
  };
  API.adminDecision = function (reservationId, actionType, option) {
    option = option || {};
    return call('decidePracticeRoomReservationAdmin7355033', {
      reservationId:text(reservationId),
      actionType:text(actionType),
      reason:text(option.reason),
      doorPassword:text(option.doorPassword),
      newDate:text(option.newDate),
      newRoom:text(option.newRoom),
      newTime:text(option.newTime),
      targets:Array.isArray(option.targets) ? option.targets.slice(0, 2) : [],
      requestId:requestId('room-decision-7355035')
    });
  };
  API.listAdmin = function (date) {
    return call('listRoomReservationsAdmin73550', { date:text(date), requestId:requestId('room-admin-list-7355033') });
  };
  API.saveAdminPushToken = function (token, deviceInfo) {
    return call('savePracticeRoomAdminPushToken7355033', { token:text(token), deviceInfo:text(deviceInfo), requestId:requestId('room-push-token-7355033') });
  };
  API.processAdminReservationRecord = async function (row, actionType, option, silent) {
    row = row || {};
    const reservationId = text(row.id || row.reservationId || (row.raw && row.raw.reservationId));
    if (!reservationId) throw new Error('예약 식별정보가 없습니다.');
    const decision = await API.adminDecision(reservationId, actionType, option || {});
    if (!silent && decision && decision.notification && decision.notification.ok === false) {
      alert('예약 상태는 반영되었지만 알림톡 발송 결과를 확인해주세요.');
    }
    return decision;
  };
  API.processAdminReservation = async function (index, actionType, option, silent) {
    const row = typeof global.ulimGetAdminRoomReservation7355035 === 'function'
      ? global.ulimGetAdminRoomReservation7355035(index)
      : null;
    if (!row) throw new Error('예약 정보를 찾지 못했습니다.');
    return API.processAdminReservationRecord(row, actionType, option, silent);
  };

  global.__ULIM_PRACTICE_ROOM_FIRESTORE_PRIMARY_7355035__ = true;
  global.__ULIM_PRACTICE_ROOM_FIRESTORE_PRIMARY_7355033__ = Object.freeze(API);
})(typeof window !== 'undefined' ? window : globalThis);
