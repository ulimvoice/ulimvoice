(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_HOME_BOOTSTRAP_7355031__) return;

  const VERSION = '2026-08-09.7355031-student-home-bootstrap';
  const CACHE_KEY = 'ulimStudentHomeBootstrap7355031';
  const CACHE_TTL_MS = 30000;
  const REQUEST_TIMEOUT_MS = 5500;
  let data = null;
  let promise = null;
  let generation = 0;

  function text(value) { return String(value == null ? '' : value).trim(); }
  function directAuth() { return global.__ULIM_STUDENT_FIREBASE_DIRECT_AUTH_7355030__ || null; }
  function profile() {
    const auth = directAuth();
    if (!auth || typeof auth.currentProfile !== 'function') return null;
    return auth.currentProfile() || null;
  }
  function isStudent() {
    const auth = directAuth();
    return !!(auth && typeof auth.hasValidatedSession === 'function' && auth.hasValidatedSession() && profile() && text(profile().studentUid));
  }
  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_72917 || global.ULIM_ROOM_CLASSROOM_REALTIME_72916 || global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || null;
  }
  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('학생 화면을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('학생 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'student-home-bootstrap-7355031');
    return rt;
  }
  function withTimeout(promiseValue, timeoutMs) {
    let timer = 0;
    return Promise.race([
      Promise.resolve(promiseValue),
      new Promise(function (_resolve, reject) {
        timer = setTimeout(function () { reject(new Error('학생 화면 정보를 불러오는 데 시간이 오래 걸리고 있습니다.')); }, timeoutMs);
      })
    ]).finally(function () { if (timer) clearTimeout(timer); });
  }
  function normalize(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    return {
      ok: source.ok === true,
      studentUid: text(source.studentUid),
      student: source.student && typeof source.student === 'object' ? source.student : {},
      appNotice: source.appNotice && typeof source.appNotice === 'object' ? source.appNotice : {},
      courseApplication: source.courseApplication && typeof source.courseApplication === 'object' ? source.courseApplication : null,
      loadedAtMs: Date.now(),
      version: text(source.version) || VERSION
    };
  }
  function saveCache(value) {
    if (!value || !value.studentUid) return;
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), studentUid: value.studentUid, data: value })); } catch (_ignore) {}
  }
  function readCache() {
    const p = profile();
    const uid = text(p && p.studentUid);
    if (!uid) return null;
    try {
      const parsed = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (!parsed || text(parsed.studentUid) !== uid || Date.now() - Number(parsed.savedAt || 0) > CACHE_TTL_MS) return null;
      const cached = normalize(parsed.data || {});
      if (cached.studentUid !== uid) return null;
      return cached;
    } catch (_ignore) { return null; }
  }
  function dispatchReady(value, source) {
    try { global.dispatchEvent(new CustomEvent('ulim-student-home-bootstrap-ready', { detail: { studentUid: text(value && value.studentUid), source: text(source), version: VERSION } })); } catch (_ignore) {}
  }
  async function requestServer() {
    const rt = await runtime();
    const fn = rt.sdk.httpsCallable(rt.functions, 'getStudentHomeBootstrap7355031');
    const response = await withTimeout(fn({}), REQUEST_TIMEOUT_MS);
    return normalize(response && response.data || {});
  }
  async function load(force) {
    if (!isStudent()) return null;
    const p = profile();
    const uid = text(p && p.studentUid);
    if (!uid) return null;
    if (!force && data && data.studentUid === uid && Date.now() - Number(data.loadedAtMs || 0) < CACHE_TTL_MS) return data;
    if (!force && !data) {
      const cached = readCache();
      if (cached) {
        data = cached;
        dispatchReady(data, 'session-cache');
      }
    }
    if (promise) return promise;
    const currentGeneration = ++generation;
    promise = (async function () {
      let lastError = null;
      for (let attempt = 0; attempt < 1; attempt += 1) {
        try {
          const fresh = await requestServer();
          if (!fresh.ok || fresh.studentUid !== uid) throw new Error('학생 화면 정보를 확인하지 못했습니다.');
          if (currentGeneration !== generation || !isStudent()) return data;
          data = fresh;
          saveCache(data);
          dispatchReady(data, 'server');
          return data;
        } catch (error) {
          lastError = error;
        }
      }
      if (data && data.studentUid === uid) return data;
      throw lastError || new Error('학생 화면 정보를 불러오지 못했습니다.');
    })().finally(function () { promise = null; });
    return promise;
  }
  function peek() {
    const p = profile();
    const uid = text(p && p.studentUid);
    return data && data.studentUid === uid ? data : null;
  }
  function updateCourseApplication(courseApplication) {
    if (!data) return null;
    data = Object.assign({}, data, { courseApplication: courseApplication && typeof courseApplication === 'object' ? courseApplication : null, loadedAtMs: Date.now() });
    saveCache(data);
    dispatchReady(data, 'local-course-update');
    return data.courseApplication;
  }
  function reset() {
    generation += 1;
    data = null;
    promise = null;
    try { sessionStorage.removeItem(CACHE_KEY); } catch (_ignore) {}
  }
  function install() {
    if (isStudent()) load(false).catch(function () {});
  }

  global.__ULIM_STUDENT_HOME_BOOTSTRAP_7355031__ = Object.freeze({
    version: VERSION,
    load: load,
    peek: peek,
    updateCourseApplication: updateCourseApplication,
    reset: reset
  });

  global.addEventListener('ulim-firebase-auth-ready', function () { if (isStudent()) load(false).catch(function () {}); });
  global.addEventListener('pageshow', function () { if (isStudent()) load(false).catch(function () {}); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof window !== 'undefined' ? window : globalThis);
