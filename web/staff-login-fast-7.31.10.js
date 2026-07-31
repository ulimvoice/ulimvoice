(function (global) {
  'use strict';

  if (global.__ULIM_STAFF_LOGIN_FAST_73110__) return;
  global.__ULIM_STAFF_LOGIN_FAST_73110__ = true;

  const VERSION = '2026-07-31.731.10';
  const WARM_KEY = 'ulimStaffLoginWarm73110At';
  const WARM_TTL_MS = 10 * 60 * 1000;
  let warmPromise = null;
  let loginPromise = null;

  function safeConsole(level) {
    try {
      const args = Array.prototype.slice.call(arguments, 1);
      (console[level] || console.log).apply(console, args);
    } catch (_ignore) {}
  }

  function addPreconnect(href, crossOrigin) {
    try {
      if (document.querySelector('link[data-ulim-login-preconnect="' + href + '"]')) return;
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = href;
      link.dataset.ulimLoginPreconnect = href;
      if (crossOrigin) link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    } catch (_ignore) {}
  }

  function installNetworkHints() {
    addPreconnect('https://script.google.com', true);
    addPreconnect('https://script.googleusercontent.com', true);
    addPreconnect('https://www.gstatic.com', true);
    addPreconnect('https://asia-northeast3-ulim-7b09a.cloudfunctions.net', true);
  }

  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_728 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_727 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }

  function preloadFirebaseRuntime() {
    try {
      const room = roomRealtime();
      if (room && typeof room.preloadRuntime === 'function') {
        return Promise.resolve(room.preloadRuntime()).catch(function (error) {
          safeConsole('warn', '[ULIM 7.31.10 Firebase preload delayed]', error);
          return null;
        });
      }
    } catch (_ignore) {}
    return Promise.resolve(null);
  }

  function shouldWarm(force) {
    if (force) return true;
    try {
      const last = Number(sessionStorage.getItem(WARM_KEY) || 0);
      return !last || Date.now() - last > WARM_TTL_MS;
    } catch (_ignore) {
      return true;
    }
  }

  function prewarmLoginServer(force) {
    if (!shouldWarm(force)) return Promise.resolve(true);
    if (warmPromise) return warmPromise;
    const api = global.adminApi || (typeof adminApi === 'function' ? adminApi : null);
    if (!api) return Promise.resolve(false);

    warmPromise = Promise.resolve()
      .then(function () {
        return api('adminLoginWarmup7319', {
          noCache: 1,
          clientVersion: VERSION
        });
      })
      .then(function (data) {
        try { sessionStorage.setItem(WARM_KEY, String(Date.now())); } catch (_ignore) {}
        safeConsole('info', '[ULIM 7.31.10 login server warmed]', data && data.elapsedMs);
        return true;
      })
      .catch(function (error) {
        safeConsole('warn', '[ULIM 7.31.10 login prewarm skipped]', error);
        return false;
      })
      .finally(function () { warmPromise = null; });
    return warmPromise;
  }

  function clearOldAdminSession() {
    ['adminToken', 'adminInfo'].forEach(function (key) {
      try { localStorage.removeItem(key); } catch (_ignore) {}
      try { sessionStorage.removeItem(key); } catch (_ignore) {}
    });
    try {
      if (localStorage.getItem('ulimLastMode') === 'admin') localStorage.removeItem('ulimLastMode');
      if (sessionStorage.getItem('ulimLastMode') === 'admin') sessionStorage.removeItem('ulimLastMode');
    } catch (_ignore) {}
    try { adminToken = ''; adminInfo = null; adminModeActive = false; } catch (_ignore) {}
  }

  function saveSession(data) {
    if (typeof global.setAdminSecureSession_ === 'function') {
      global.setAdminSecureSession_(data);
    } else {
      const token = String(data && data.adminToken || '').trim();
      const info = data && data.admin || null;
      try { adminToken = token; adminInfo = info; adminModeActive = !!token; } catch (_ignore) {}
      if (token) {
        try { localStorage.setItem('adminToken', token); } catch (_ignore) {}
      }
      if (info) {
        try { localStorage.setItem('adminInfo', JSON.stringify(info)); } catch (_ignore) {}
      }
    }
    try { localStorage.setItem('ulimLastMode', 'admin'); } catch (_ignore) {}
  }

  function feedBundledProof(data) {
    const proof = String(data && data.firebaseLoginProof || '').trim();
    const token = String(data && data.adminToken || '').trim();
    const expiresAt = Number(data && data.firebaseProofExpiresAt || 0);
    if (!proof || !token || !expiresAt) return false;
    try {
      const room = roomRealtime();
      if (room && typeof room.acceptLoginProof === 'function') {
        return room.acceptLoginProof({
          proof: proof,
          expiresAt: expiresAt,
          sessionType: 'admin',
          sessionToken: token
        });
      }
    } catch (_ignore) {}
    return false;
  }

  function showStaffShellImmediately() {
    try { adminModeActive = true; } catch (_ignore) {}
    try { document.body.classList.add('admin-mode'); } catch (_ignore) {}
    try { if (typeof global.setAdminTabVisibility === 'function') global.setAdminTabVisibility(); } catch (_ignore) {}
    try { if (typeof global.adminEnableAllTabsForAdminMode === 'function') global.adminEnableAllTabsForAdminMode(); } catch (_ignore) {}
    try { if (typeof global.applyAdminPermissions === 'function') global.applyAdminPermissions(); } catch (_ignore) {}

    const loginBox = document.getElementById('adminLoginBox');
    const dashboard = document.getElementById('adminDashboard');
    if (loginBox) loginBox.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';
  }

  function activateStaffDataAfterAuth() {
    try {
      if (typeof global.ulimActivateTab566_ === 'function') global.ulimActivateTab566_('tabAdmin', true);
      else if (typeof global.openAdminPage === 'function') global.openAdminPage();
    } catch (_ignore) {}
  }

  function startPostLoginBackground(data, enteredPassword, startedAt) {
    setTimeout(function () {
      (async function () {
        let firebaseReady = false;
        try {
          const room = roomRealtime();
          if (room && typeof room.forceReauthenticate === 'function') {
            const rt = await room.forceReauthenticate('staff-login-bundled-proof');
            firebaseReady = !!(rt && rt.auth && rt.auth.currentUser);
          }
        } catch (error) {
          safeConsole('warn', '[ULIM 7.31.10 Firebase login background]', error);
        }

        /*
         * 보호 데이터 조회는 Firebase Auth가 준비된 뒤 시작합니다.
         * 로그인 직후 발생하던 401/permission-denied 재시도 경쟁을 제거합니다.
         */
        if (firebaseReady) {
          activateStaffDataAfterAuth();
          try {
            if (typeof global.adminLoadInitialData === 'function') {
              await Promise.resolve(global.adminLoadInitialData());
            }
          } catch (error) {
            safeConsole('warn', '[ULIM 7.31.10 staff initial background]', error);
          }
        }

        try {
          if (typeof global.registerRoomPushTokenAfterAdminLogin === 'function') {
            Promise.resolve(global.registerRoomPushTokenAfterAdminLogin()).catch(function () {});
          }
        } catch (_ignore) {}

        if (data && data.admin && data.admin.mustChangePassword && typeof global.promptAdminPasswordChangeIfNeeded_ === 'function') {
          setTimeout(function () {
            Promise.resolve(global.promptAdminPasswordChangeIfNeeded_(enteredPassword)).catch(function () {});
          }, 120);
        }

        safeConsole('info', '[ULIM 7.31.10 staff auth/data ready]', {
          elapsedMs: Date.now() - startedAt,
          bundledProof: !!(data && data.firebaseLoginProof),
          serverVersion: data && data.loginFastVersion || '',
          serverTiming: data && data.loginTiming || null,
          firebaseReady: firebaseReady
        });
      })();
    }, 0);
  }

  async function fastAdminLogin() {
    if (loginPromise) return loginPromise;

    const idEl = document.getElementById('adminIdInput');
    const pwEl = document.getElementById('adminPwInput');
    const id = idEl ? String(idEl.value || '').trim() : '';
    const pw = pwEl ? String(pwEl.value || '').trim() : '';
    if (!id || !pw) {
      alert('ID와 비밀번호를 입력해주세요.');
      return false;
    }

    const api = global.adminApi || (typeof adminApi === 'function' ? adminApi : null);
    if (!api) {
      alert('로그인 서버 연결을 준비하지 못했습니다. 새로고침 후 다시 시도해주세요.');
      return false;
    }

    const startedAt = Date.now();
    loginPromise = (async function () {
      clearOldAdminSession();
      try {
        if (typeof global.clearAdminSensitiveScreen_ === 'function') global.clearAdminSensitiveScreen_('login-start-73110');
      } catch (_ignore) {}
      try { if (typeof global.showLoading === 'function') global.showLoading('로그인 정보 확인 중...'); } catch (_ignore) {}

      const runtimePreload = preloadFirebaseRuntime();
      const data = await api('adminLogin', {
        adminId: id,
        adminPw: pw,
        noCache: 1,
        loginFastVersion: VERSION
      });

      saveSession(data);
      feedBundledProof(data);
      showStaffShellImmediately();
      try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_ignore) {}

      safeConsole('info', '[ULIM 7.31.10 staff shell displayed]', {
        elapsedMs: Date.now() - startedAt,
        serverVersion: data && data.loginFastVersion || '',
        serverTiming: data && data.loginTiming || null
      });

      runtimePreload.catch(function () {});
      startPostLoginBackground(data, pw, startedAt);
      return true;
    })().catch(function (error) {
      try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_ignore) {}
      const loginBox = document.getElementById('adminLoginBox');
      const dashboard = document.getElementById('adminDashboard');
      if (loginBox) loginBox.style.display = 'block';
      if (dashboard) dashboard.style.display = 'none';
      alert(error && error.message ? error.message : '로그인 처리 중 문제가 발생했습니다.');
      return false;
    }).finally(function () {
      loginPromise = null;
    });

    return loginPromise;
  }

  function installOpenAdminPrewarm() {
    const original = global.openAdminPage;
    if (typeof original !== 'function' || original.__ulim7319Wrapped) return;
    const wrapped = function () {
      installNetworkHints();
      prewarmLoginServer(false);
      preloadFirebaseRuntime();
      return original.apply(this, arguments);
    };
    wrapped.__ulim7319Wrapped = true;
    global.openAdminPage = wrapped;
    try { openAdminPage = global.openAdminPage; } catch (_ignore) {}
  }

  function install() {
    installNetworkHints();
    installOpenAdminPrewarm();
    global.adminLogin = fastAdminLogin;
    try { adminLogin = global.adminLogin; } catch (_ignore) {}

    const loginBox = document.getElementById('adminLoginBox');
    if (loginBox) {
      loginBox.addEventListener('pointerenter', function () {
        prewarmLoginServer(false);
        preloadFirebaseRuntime();
      }, { once: true });
      loginBox.addEventListener('focusin', function () {
        prewarmLoginServer(false);
        preloadFirebaseRuntime();
      }, { once: true });
    }

    const hasSavedStaff = (function () {
      try {
        return !!((localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken')) &&
          (localStorage.getItem('adminInfo') || sessionStorage.getItem('adminInfo')));
      } catch (_ignore) { return false; }
    })();

    if (hasSavedStaff) {
      preloadFirebaseRuntime().then(function () {
        const room = roomRealtime();
        if (room && typeof room.ensureAuthenticated === 'function') room.ensureAuthenticated().catch(function () {});
      });
    }

    safeConsole('info', '[ULIM 7.31.10 staff login final acceleration installed]', VERSION);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  global.__ULIM_STAFF_LOGIN_FAST_73110_API__ = Object.freeze({
    version: VERSION,
    prewarm: prewarmLoginServer,
    preloadFirebase: preloadFirebaseRuntime,
    login: fastAdminLogin
  });
})(typeof window !== 'undefined' ? window : globalThis);
