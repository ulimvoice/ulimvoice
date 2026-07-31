(function (global) {
  'use strict';

  if (global.__ULIM_STAFF_LOGIN_FIREBASE_PRIMARY_7324__) return;
  global.__ULIM_STAFF_LOGIN_FIREBASE_PRIMARY_7324__ = true;

  const VERSION = '2026-07-31.732.04';
  const PROFILE_KEY = 'ulimFirebaseStaffProfile7320';
  const EXPLICIT_LOGOUT_KEY = 'ULIM_STAFF_EXPLICIT_LOGOUT_7322';
  const ADMIN_AUTO_KEY = 'ulimAdminAutoLogin';
  const LOGIN_EMAIL_DOMAIN = 'auth.ulimvoice.app';
  const STAFF_ROLES = ['teacher', 'admin', 'superAdmin'];
  let loginPromise = null;
  let legacyCompatibilityPromise = null;
  let manualLoginInProgress = false;
  let primaryCredentialReady = false;
  let lastLoginId = '';
  let originalPasswordChange = null;
  let restoreListenerInstalled = false;
  const domReadyPromise = document.readyState === 'loading'
    ? new Promise(function (resolve) { document.addEventListener('DOMContentLoaded', resolve, { once: true }); })
    : Promise.resolve();

  function safeConsole(level) {
    try {
      const args = Array.prototype.slice.call(arguments, 1);
      (console[level] || console.log).apply(console, args);
    } catch (_ignore) {}
  }

  function text(value) { return String(value == null ? '' : value).trim(); }
  function normalizeLoginId(value) { return text(value).normalize('NFKC').toLowerCase(); }

  function explicitLogoutActive() {
    try {
      return global.__ULIM_STAFF_EXPLICIT_LOGOUT_ACTIVE__ === true ||
        sessionStorage.getItem(EXPLICIT_LOGOUT_KEY) === 'Y' ||
        localStorage.getItem(EXPLICIT_LOGOUT_KEY) === 'Y';
    } catch (_ignore) {
      return global.__ULIM_STAFF_EXPLICIT_LOGOUT_ACTIVE__ === true;
    }
  }

  function beginExplicitLogout(reason) {
    let legacyToken = '';
    try {
      legacyToken = text(
        (typeof adminToken !== 'undefined' && adminToken) ||
        global.adminToken ||
        sessionStorage.getItem('adminToken') ||
        localStorage.getItem('adminToken')
      );
    } catch (_ignore) {}

    /* 세션을 먼저 지워 재인증을 막되, 서버 세션 폐기 요청은 보존한 토큰으로 별도 전송합니다. */
    if (legacyToken) {
      try {
        const endpoint = text(global.GET_API_URL || (typeof GET_API_URL !== 'undefined' ? GET_API_URL : ''));
        if (endpoint) {
          const query = new URLSearchParams();
          query.set('action', 'logoutAdminSession');
          query.set('adminToken', legacyToken);
          query.set('_', Date.now());
          fetch(endpoint + '?' + query.toString(), { method: 'GET', cache: 'no-store', keepalive: true }).catch(function () {});
        }
      } catch (_ignore) {}
    }

    global.__ULIM_STAFF_EXPLICIT_LOGOUT_ACTIVE__ = true;
    try { sessionStorage.setItem(EXPLICIT_LOGOUT_KEY, 'Y'); } catch (_ignore) {}
    try { localStorage.setItem(EXPLICIT_LOGOUT_KEY, 'Y'); } catch (_ignore) {}
    try { localStorage.removeItem(PROFILE_KEY); } catch (_ignore) {}
    try { localStorage.removeItem('ulimLastMode'); } catch (_ignore) {}
    clearLegacySession();
    try {
      global.dispatchEvent(new CustomEvent('ulim-staff-logout-start', {
        detail: { reason: reason || 'manual', version: VERSION }
      }));
    } catch (_ignore) {}
  }

  function clearExplicitLogoutForManualLogin() {
    global.__ULIM_STAFF_EXPLICIT_LOGOUT_ACTIVE__ = false;
    try { sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY); } catch (_ignore) {}
    try { localStorage.removeItem(EXPLICIT_LOGOUT_KEY); } catch (_ignore) {}
  }

  function adminAutoLoginEnabled() {
    try { return localStorage.getItem(ADMIN_AUTO_KEY) !== 'N'; } catch (_ignore) { return true; }
  }

  async function applyAdminFirebasePersistence(rt) {
    if (!rt || !rt.sdk || !rt.auth || typeof rt.sdk.setPersistence !== 'function') return;
    const persistence = adminAutoLoginEnabled()
      ? rt.sdk.browserLocalPersistence
      : rt.sdk.browserSessionPersistence;
    if (persistence) await rt.sdk.setPersistence(rt.auth, persistence);
  }

  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_728 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_727 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }

  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') {
      throw new Error('Firebase 로그인 모듈을 준비하지 못했습니다.');
    }
    const rt = await room.preloadRuntime();
    if (!rt || !rt.sdk || !rt.auth || !rt.db || !rt.functions) {
      throw new Error('Firebase 로그인 모듈 초기화에 실패했습니다.');
    }
    return rt;
  }

  function bytesToBase64Url(bytes) {
    let binary = '';
    bytes.forEach(function (value) { binary += String.fromCharCode(value); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  async function deriveLoginEmail(loginId) {
    const normalized = normalizeLoginId(loginId);
    if (!normalized) throw new Error('교직원 ID가 필요합니다.');
    if (!global.crypto || !global.crypto.subtle || typeof TextEncoder === 'undefined') {
      throw new Error('현재 브라우저에서는 안전한 Firebase 로그인을 사용할 수 없습니다.');
    }
    const input = new TextEncoder().encode('ulimvoice-staff-password-v1\u001f' + normalized);
    const digest = await global.crypto.subtle.digest('SHA-256', input);
    return 'u_' + bytesToBase64Url(new Uint8Array(digest)) + '@' + LOGIN_EMAIL_DOMAIN;
  }

  function roleLabel(role) {
    if (role === 'superAdmin') return '전체관리자';
    if (role === 'admin') return '관리자';
    return '강사';
  }

  function sameAuthVersion(left, right) {
    if (left == null || right == null) return false;
    return String(left) === String(right);
  }

  async function readCurrentStaffProfile(rt, fallbackId) {
    const user = rt.auth.currentUser;
    if (!user) throw new Error('Firebase 로그인 사용자가 없습니다.');
    const room = roomRealtime();
    if (room && typeof room.getStableIdToken === 'function') {
      await room.getStableIdToken(rt, false, 'staff-profile');
    }
    const tokenResult = await rt.sdk.getIdTokenResult(user, false);
    const claims = tokenResult && tokenResult.claims || {};
    const role = text(claims.role);
    if (STAFF_ROLES.indexOf(role) < 0) throw new Error('교직원 계정이 아닙니다.');

    const snapshot = await rt.sdk.getDoc(rt.sdk.doc(rt.db, 'users', user.uid));
    if (!snapshot.exists()) throw new Error('교직원 계정 정보를 찾지 못했습니다.');
    const data = snapshot.data() || {};
    if (data.active !== true || text(data.role) !== role || !sameAuthVersion(data.authVersion, claims.authVersion)) {
      throw new Error('계정 또는 권한이 변경되었습니다. 다시 로그인해주세요.');
    }
    if (role === 'teacher' && (!claims.teacherUid || text(data.teacherUid) !== text(claims.teacherUid))) {
      throw new Error('강사 계정 정보가 일치하지 않습니다.');
    }

    const id = text(data.adminId || data.legacyAdminId || data.loginId || fallbackId);
    const name = text(data.name || data.displayName || data.teacherName || data.adminName || id);
    return {
      id: id,
      name: name,
      role: roleLabel(role),
      firebaseRole: role,
      phone: text(data.phone || ''),
      mustChangePassword: data.mustChangePassword === true,
      accountUid: text(data.accountUid || data.teacherUid || user.uid),
      principalUidV2: text(data.principalUidV2 || user.uid),
      firebaseAuthUid: user.uid,
      permissions: data.permissions || null,
      passwordLoginEnabled: data.passwordLoginEnabled === true
    };
  }

  function clearLegacySession() {
    ['adminToken', 'adminInfo'].forEach(function (key) {
      try { localStorage.removeItem(key); } catch (_ignore) {}
      try { sessionStorage.removeItem(key); } catch (_ignore) {}
    });
    try { adminToken = ''; adminInfo = null; adminModeActive = false; } catch (_ignore) {}
    try { global.adminToken = ''; global.adminInfo = null; } catch (_ignore) {}
  }

  function saveFirebaseProfile(admin) {
    try {
      adminInfo = admin || {};
      adminModeActive = true;
      global.adminInfo = adminInfo;
      global.adminModeActive = true;
    } catch (_ignore) {}
    try { localStorage.setItem('adminInfo', JSON.stringify(admin || {})); } catch (_ignore) {}
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(admin || {})); } catch (_ignore) {}
    try { localStorage.setItem('ulimLastMode', 'admin'); } catch (_ignore) {}
  }

  function saveLegacySession(data) {
    if (typeof global.setAdminSecureSession_ === 'function') {
      global.setAdminSecureSession_(data);
    } else {
      const token = text(data && data.adminToken);
      const info = data && data.admin || {};
      try { adminToken = token; adminInfo = info; adminModeActive = !!token; } catch (_ignore) {}
      try { global.adminToken = token; global.adminInfo = info; } catch (_ignore) {}
      if (token) try { localStorage.setItem('adminToken', token); } catch (_ignore) {}
      try { localStorage.setItem('adminInfo', JSON.stringify(info)); } catch (_ignore) {}
    }
    try { localStorage.setItem('ulimLastMode', 'admin'); } catch (_ignore) {}
  }

  function showStaffShell() {
    try { adminModeActive = true; global.adminModeActive = true; } catch (_ignore) {}
    try { document.body.classList.add('admin-mode'); } catch (_ignore) {}
    try { if (typeof global.applyAdminPermissions === 'function') global.applyAdminPermissions(); } catch (_ignore) {}

    /*
     * 7.32.4: 기존 UI 패치들은 adminToken이 생길 때까지 교직원 탭을 잠급니다.
     * Firebase 주 로그인에서는 GAS 호환 세션을 기다리지 않고 교직원 화면을 직접 엽니다.
     * 보호 데이터 권한은 Firebase Auth/Callable/Rules에서 계속 검사합니다.
     */
    const overlay = document.getElementById('loginOverlay');
    const wrapper = document.querySelector('.wrapper');
    const adminTab = document.querySelector('.tab[data-tab="tabAdmin"]');
    const adminContent = document.getElementById('tabAdmin');
    const loginBox = document.getElementById('adminLoginBox');
    const dashboard = document.getElementById('adminDashboard');

    if (overlay) overlay.style.display = 'none';
    if (wrapper) {
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.width = '95%';
      wrapper.style.maxWidth = '1200px';
      wrapper.style.margin = '0 auto';
      wrapper.style.padding = '20px 0';
    }
    document.querySelectorAll('.tab').forEach(function (node) { node.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (node) { node.classList.remove('active'); });
    if (adminTab) {
      adminTab.style.display = '';
      adminTab.style.opacity = '1';
      adminTab.style.pointerEvents = 'auto';
      adminTab.classList.add('active', 'admin-only-tab');
    }
    if (adminContent) adminContent.classList.add('active');
    if (loginBox) loginBox.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';
    try { localStorage.setItem('ulimActiveTabId', 'tabAdmin'); } catch (_ignore) {}
  }

  function setCompatibilityStatus(message, state) {
    try {
      const dashboard = document.getElementById('adminDashboard');
      if (!dashboard) return;
      let chip = document.getElementById('ulimStaffCompatibilityStatus7320');
      if (!chip) {
        chip = document.createElement('div');
        chip.id = 'ulimStaffCompatibilityStatus7320';
        chip.style.cssText = 'margin:8px 0 12px;padding:8px 10px;border-radius:8px;font-size:12px;';
        dashboard.insertBefore(chip, dashboard.firstChild);
      }
      chip.textContent = message || '';
      chip.style.display = message ? 'block' : 'none';
      chip.style.background = state === 'ready' ? '#ecfdf5' : state === 'error' ? '#fff7ed' : '#eff6ff';
      chip.style.color = state === 'ready' ? '#166534' : state === 'error' ? '#9a3412' : '#1e40af';
    } catch (_ignore) {}
  }

  function dispatchAuthReady(rt, reason) {
    try {
      global.dispatchEvent(new CustomEvent('ulim-firebase-auth-ready', {
        detail: {
          uid: rt && rt.auth && rt.auth.currentUser ? text(rt.auth.currentUser.uid) : '',
          reason: reason || 'firebase-primary',
          version: VERSION
        }
      }));
    } catch (_ignore) {}
  }

  function activateFirestoreStaffData(rt, reason) {
    /* 화면 전환은 showStaffShell()에서 직접 처리합니다. 기존 openAdminPage()는
       GAS adminToken을 기다리므로 Firebase 주 로그인 속도를 다시 4초대로 늦춥니다. */
    dispatchAuthReady(rt, reason);
  }

  function api() {
    return global.adminApi || (typeof adminApi === 'function' ? adminApi : null);
  }

  function verifyLegacyResponseOwner(data, firebaseUid, loginId) {
    const admin = data && data.admin || {};
    const expectedUid = text(admin.firebaseAuthUid || admin.principalUidV2);
    if (expectedUid && expectedUid !== firebaseUid) {
      throw new Error('GAS 계정과 Firebase 계정의 UID가 일치하지 않습니다.');
    }
    const returnedId = normalizeLoginId(admin.id || '');
    if (returnedId && returnedId !== normalizeLoginId(loginId)) {
      throw new Error('GAS 계정과 Firebase 로그인 ID가 일치하지 않습니다.');
    }
  }

  async function migratePasswordCredential(rt, loginId, password, migrationProof) {
    if (!migrationProof) throw new Error('최근 비밀번호 확인 proof를 받지 못했습니다. GAS 새 버전 배포를 확인해주세요.');
    const callable = rt.sdk.httpsCallable(rt.functions, 'migrateCurrentStaffPasswordCredential');
    const result = await callable({ loginId: loginId, password: password, migrationProof: migrationProof });
    const data = result && result.data || {};
    if (!data.ok) throw new Error('Firebase 비밀번호 로그인 전환에 실패했습니다.');

    const email = await deriveLoginEmail(loginId);
    try { await rt.sdk.signOut(rt.auth); } catch (_ignore) {}
    const credential = await rt.sdk.signInWithEmailAndPassword(rt.auth, email, password);
    {
      const room = roomRealtime();
      if (room && typeof room.resetStableTokenGuard === 'function') room.resetStableTokenGuard(credential.user.uid);
      if (room && typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'password-signin');
      else await rt.sdk.getIdToken(credential.user, false);
    }
    primaryCredentialReady = true;
    safeConsole('info', '[ULIM 7.32.4 password credential migrated]', {
      uid: credential.user.uid,
      version: data.version || VERSION
    });
    dispatchAuthReady(rt, 'password-credential-migrated');
    return data;
  }

  async function startLegacyCompatibilitySession(loginId, password, firebaseUid, startedAt) {
    if (legacyCompatibilityPromise) return legacyCompatibilityPromise;
    const adminApiFn = api();
    if (!adminApiFn) return false;

    setCompatibilityStatus('연습일지·연습실 예약 호환 세션 준비 중...', 'loading');
    legacyCompatibilityPromise = Promise.resolve()
      .then(function () {
        return adminApiFn('adminLogin', {
          adminId: loginId,
          adminPw: password,
          noCache: 1,
          loginFastVersion: VERSION
        });
      })
      .then(async function (data) {
        verifyLegacyResponseOwner(data, firebaseUid, loginId);
        saveLegacySession(data);
        setCompatibilityStatus('연습일지·연습실 예약 호환 연결됨', 'ready');
        try {
          if (typeof global.adminLoadInitialData === 'function') {
            await Promise.resolve(global.adminLoadInitialData());
          }
        } catch (error) {
          safeConsole('warn', '[ULIM 7.32.4 legacy initial data]', error);
        }
        try {
          if (typeof global.registerRoomPushTokenAfterAdminLogin === 'function') {
            Promise.resolve(global.registerRoomPushTokenAfterAdminLogin()).catch(function () {});
          }
        } catch (_ignore) {}
        safeConsole('info', '[ULIM 7.32.4 GAS compatibility ready]', {
          elapsedMs: Date.now() - startedAt,
          serverTiming: data && data.loginTiming || null
        });
        return data;
      })
      .catch(function (error) {
        setCompatibilityStatus('연습일지·연습실 예약 연결 실패 · 다시 로그인해주세요.', 'error');
        safeConsole('warn', '[ULIM 7.32.4 GAS compatibility failed]', error);
        throw error;
      })
      .finally(function () { legacyCompatibilityPromise = null; });
    return legacyCompatibilityPromise;
  }

  function feedBundledProof(data) {
    const proof = text(data && data.firebaseLoginProof);
    const token = text(data && data.adminToken);
    const expiresAt = Number(data && data.firebaseProofExpiresAt || 0);
    if (!proof || !token || !expiresAt) return false;
    const room = roomRealtime();
    if (!room || typeof room.acceptLoginProof !== 'function') return false;
    return room.acceptLoginProof({ proof: proof, expiresAt: expiresAt, sessionType: 'admin', sessionToken: token });
  }

  function isDisabledError(error) {
    return text(error && error.code).toLowerCase().indexOf('user-disabled') >= 0;
  }

  function mayUseLegacyFallback(error) {
    const code = text(error && error.code).toLowerCase();
    return code.indexOf('invalid-credential') >= 0 ||
      code.indexOf('user-not-found') >= 0 ||
      code.indexOf('wrong-password') >= 0 ||
      code.indexOf('invalid-email') >= 0 ||
      code.indexOf('operation-not-allowed') >= 0;
  }

  function friendlyLoginError(error) {
    const code = text(error && error.code).toLowerCase();
    if (code.indexOf('user-disabled') >= 0) return '사용 중지된 계정입니다. 관리자에게 문의해주세요.';
    if (code.indexOf('too-many-requests') >= 0) return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.';
    if (code.indexOf('network-request-failed') >= 0) return 'Firebase 연결에 실패했습니다. 인터넷 연결을 확인해주세요.';
    if (code.indexOf('operation-not-allowed') >= 0) return 'Firebase 이메일/비밀번호 로그인이 아직 활성화되지 않았습니다.';
    return error && error.message ? error.message : '교직원 로그인에 실패했습니다.';
  }

  async function directFirebaseLogin(rt, loginId, password, startedAt) {
    if (explicitLogoutActive()) throw new Error('로그아웃 상태입니다. 다시 로그인 버튼을 눌러주세요.');
    await applyAdminFirebasePersistence(rt);
    const email = await deriveLoginEmail(loginId);
    if (rt.auth.currentUser) {
      try { await rt.sdk.signOut(rt.auth); } catch (_ignore) {}
    }
    const credential = await rt.sdk.signInWithEmailAndPassword(rt.auth, email, password);
    {
      const room = roomRealtime();
      if (room && typeof room.resetStableTokenGuard === 'function') room.resetStableTokenGuard(credential.user.uid);
      if (room && typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'password-signin');
      else await rt.sdk.getIdToken(credential.user, false);
    }
    const profile = await readCurrentStaffProfile(rt, loginId);
    primaryCredentialReady = true;
    lastLoginId = profile.id || loginId;
    saveFirebaseProfile(profile);
    await domReadyPromise;
    showStaffShell();
    setCompatibilityStatus('출석부·일일평가·강의실 Firebase 연결됨', 'ready');
    activateFirestoreStaffData(rt, 'firebase-password-login');
    try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_ignore) {}

    safeConsole('info', '[ULIM 7.32.4 Firebase-primary shell displayed]', {
      elapsedMs: Date.now() - startedAt,
      uid: credential.user.uid,
      role: profile.firebaseRole
    });

    startLegacyCompatibilitySession(loginId, password, credential.user.uid, startedAt).catch(function () {});
    return true;
  }

  async function legacyFirstLogin(rt, loginId, password, startedAt) {
    if (explicitLogoutActive()) throw new Error('로그아웃 상태입니다. 다시 로그인 버튼을 눌러주세요.');
    await applyAdminFirebasePersistence(rt);
    const adminApiFn = api();
    if (!adminApiFn) throw new Error('기존 로그인 서버를 찾지 못했습니다.');
    const data = await adminApiFn('adminLogin', {
      adminId: loginId,
      adminPw: password,
      noCache: 1,
      loginFastVersion: VERSION
    });
    saveLegacySession(data);
    feedBundledProof(data);

    const room = roomRealtime();
    const authenticated = room && typeof room.forceReauthenticate === 'function'
      ? await room.forceReauthenticate('firebase-primary-first-migration')
      : rt;
    if (!authenticated || !authenticated.auth || !authenticated.auth.currentUser) {
      throw new Error('Firebase 교직원 인증에 실패했습니다.');
    }

    const profile = await readCurrentStaffProfile(authenticated, loginId);
    lastLoginId = profile.id || loginId;
    saveFirebaseProfile(Object.assign({}, data.admin || {}, profile));
    await domReadyPromise;
    showStaffShell();
    setCompatibilityStatus('기존 계정 확인 완료 · Firebase 빠른 로그인 전환 중...', 'loading');
    activateFirestoreStaffData(authenticated, 'legacy-first-login');
    try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_ignore) {}

    safeConsole('info', '[ULIM 7.32.4 legacy first shell displayed]', {
      elapsedMs: Date.now() - startedAt,
      serverTiming: data && data.loginTiming || null
    });

    if (data && data.admin && data.admin.mustChangePassword) {
      setTimeout(function () {
        if (typeof global.promptAdminPasswordChangeIfNeeded_ === 'function') {
          Promise.resolve(global.promptAdminPasswordChangeIfNeeded_(password)).catch(function () {});
        }
      }, 100);
    } else {
      setTimeout(function () {
        migratePasswordCredential(authenticated, loginId, password, text(data && data.firebasePasswordMigrationProof))
          .then(function () { setCompatibilityStatus('Firebase 빠른 로그인 전환 완료', 'ready'); })
          .catch(function (error) {
            setCompatibilityStatus('로그인은 정상 · 빠른 로그인 전환은 비밀번호 변경 후 완료됩니다.', 'error');
            safeConsole('warn', '[ULIM 7.32.4 credential migration deferred]', error);
          });
      }, 0);
    }

    try {
      if (typeof global.adminLoadInitialData === 'function') {
        Promise.resolve(global.adminLoadInitialData()).catch(function () {});
      }
    } catch (_ignore) {}
    return true;
  }

  async function firebasePrimaryAdminLogin() {
    if (loginPromise) return loginPromise;
    const idEl = document.getElementById('adminIdInput');
    const pwEl = document.getElementById('adminPwInput');
    const loginId = idEl ? text(idEl.value) : '';
    const password = pwEl ? String(pwEl.value || '') : '';
    if (!loginId || !password) {
      alert('ID와 비밀번호를 입력해주세요.');
      return false;
    }

    /* 명시적 로그아웃 표시는 실제 ID/비밀번호 입력 후 로그인 버튼을 눌렀을 때만 해제합니다. */
    clearExplicitLogoutForManualLogin();
    const startedAt = Date.now();
    manualLoginInProgress = true;
    loginPromise = (async function () {
      clearLegacySession();
      try { if (typeof global.clearAdminSensitiveScreen_ === 'function') global.clearAdminSensitiveScreen_('firebase-primary-login-start'); } catch (_ignore) {}
      try { if (typeof global.showLoading === 'function') global.showLoading('Firebase 로그인 확인 중...'); } catch (_ignore) {}
      const rt = await runtime();

      try {
        return await directFirebaseLogin(rt, loginId, password, startedAt);
      } catch (firebaseError) {
        if (isDisabledError(firebaseError) || !mayUseLegacyFallback(firebaseError)) throw firebaseError;
        safeConsole('info', '[ULIM 7.32.4 legacy migration fallback]', text(firebaseError && firebaseError.code));
        try { if (rt.auth.currentUser) await rt.sdk.signOut(rt.auth); } catch (_ignore) {}
        return legacyFirstLogin(rt, loginId, password, startedAt);
      }
    })().catch(function (error) {
      try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_ignore) {}
      const loginBox = document.getElementById('adminLoginBox');
      const dashboard = document.getElementById('adminDashboard');
      if (loginBox) loginBox.style.display = 'block';
      if (dashboard) dashboard.style.display = 'none';
      alert(friendlyLoginError(error));
      return false;
    }).finally(function () {
      manualLoginInProgress = false;
      loginPromise = null;
    });
    return loginPromise;
  }

  async function firebasePrimaryPasswordChange(force, knownCurrentPassword) {
    const rt = await runtime().catch(function () { return null; });
    if (!rt || !rt.auth.currentUser) {
      return originalPasswordChange ? originalPasswordChange(force, knownCurrentPassword) : false;
    }

    const loginId = text((global.adminInfo || {}).id || lastLoginId);
    if (!loginId) {
      alert('교직원 ID를 확인하지 못했습니다. 다시 로그인해주세요.');
      return false;
    }

    const currentPassword = knownCurrentPassword || prompt('현재 비밀번호를 입력해주세요.');
    if (!currentPassword) return false;
    const newPassword = prompt('새 비밀번호를 입력해주세요.\n6자 이상으로 설정해주세요.');
    if (!newPassword) return false;
    if (String(newPassword).length < 6) {
      alert('새 비밀번호는 6자 이상으로 설정해주세요.');
      return false;
    }
    if (String(currentPassword) === String(newPassword)) {
      alert('새 비밀번호는 현재 비밀번호와 다르게 설정해주세요.');
      return false;
    }
    const confirmPassword = prompt('새 비밀번호를 한 번 더 입력해주세요.');
    if (newPassword !== confirmPassword) {
      alert('새 비밀번호가 서로 다릅니다.');
      return false;
    }

    try {
      if (typeof global.showLoading === 'function') global.showLoading('비밀번호 변경 중...');

      if (primaryCredentialReady) {
        const email = await deriveLoginEmail(loginId);
        const credential = rt.sdk.EmailAuthProvider.credential(email, currentPassword);
        await rt.sdk.reauthenticateWithCredential(rt.auth.currentUser, credential);
      }

      let legacyToken = '';
      try { legacyToken = text(typeof adminToken !== 'undefined' && adminToken || localStorage.getItem('adminToken')); } catch (_ignore) {}
      if (!legacyToken) {
        await startLegacyCompatibilitySession(loginId, currentPassword, rt.auth.currentUser.uid, Date.now());
        try { legacyToken = text(typeof adminToken !== 'undefined' && adminToken || localStorage.getItem('adminToken')); } catch (_ignore) {}
      }
      if (!legacyToken) throw new Error('Google Sheets 호환 세션을 준비하지 못했습니다.');

      const data = await api()('changeAdminPassword', {
        adminToken: legacyToken,
        currentPassword: currentPassword,
        newPassword: newPassword,
        noCache: 1
      });
      if (!data || data.status !== 'success') throw new Error(data && data.message || '기존 비밀번호 기록을 변경하지 못했습니다.');
      saveLegacySession(data);

      await migratePasswordCredential(rt, loginId, newPassword, text(data && data.firebasePasswordMigrationProof));
      const profile = await readCurrentStaffProfile(rt, loginId);
      profile.mustChangePassword = false;
      saveFirebaseProfile(Object.assign({}, data.admin || {}, profile));
      setCompatibilityStatus('비밀번호와 Firebase 로그인이 함께 갱신되었습니다.', 'ready');
      if (typeof global.hideLoading === 'function') global.hideLoading();
      alert('비밀번호가 변경되었습니다.');
      return true;
    } catch (error) {
      try { if (typeof global.hideLoading === 'function') global.hideLoading(); } catch (_ignore) {}
      alert(error && error.message ? error.message : '비밀번호 변경에 실패했습니다.');
      return false;
    }
  }

  function installLogoutWrapper() {
    const original = global.adminLogout;
    if (typeof original !== 'function' || original.__ulim7322Wrapped) return;
    const wrapped = async function () {
      /* Firebase signOut보다 먼저 보호 플래그와 GAS 세션을 제거해야
         다른 실시간 모듈이 남아 있던 세션으로 즉시 재로그인하지 않습니다. */
      beginExplicitLogout('admin-logout');
      primaryCredentialReady = false;
      lastLoginId = '';
      let signOutCompleted = false;
      try {
        const rt = await runtime();
        await applyAdminFirebasePersistence(rt).catch(function () {});
        if (rt.auth.currentUser) await rt.sdk.signOut(rt.auth);
        signOutCompleted = true;
      } catch (error) {
        safeConsole('warn', '[ULIM 7.32.4 Firebase signOut delayed]', error);
      }
      try {
        return await original.apply(this, arguments);
      } finally {
        /* signOut가 네트워크 오류로 지연돼도 자동복원은 로그아웃 플래그로 계속 차단됩니다. */
        safeConsole('info', '[ULIM 7.32.4 explicit staff logout]', { signOutCompleted: signOutCompleted });
      }
    };
    wrapped.__ulim7322Wrapped = true;
    global.adminLogout = wrapped;
    try { adminLogout = global.adminLogout; } catch (_ignore) {}

    /* onclick 실행 전 캡처 단계에서 플래그를 먼저 세워 복원 콜백과의 경쟁을 차단합니다. */
    if (!global.__ULIM_STAFF_LOGOUT_CAPTURE_7322__) {
      global.__ULIM_STAFF_LOGOUT_CAPTURE_7322__ = true;
      document.addEventListener('click', function (event) {
        const node = event && event.target && event.target.closest
          ? event.target.closest('[onclick*="adminLogout"],button')
          : null;
        if (!node) return;
        const onclick = text(node.getAttribute && node.getAttribute('onclick'));
        const label = text(node.textContent);
        if (onclick.indexOf('adminLogout') >= 0 || (label === '로그아웃' && node.closest('#tabAdmin'))) {
          beginExplicitLogout('logout-click-capture');
        }
      }, true);
    }
  }

  async function validateStoredLegacySessionQuietly() {
    let legacyToken = '';
    try { legacyToken = text(typeof adminToken !== 'undefined' && adminToken || localStorage.getItem('adminToken')); } catch (_ignore) {}
    if (!legacyToken) return false;
    const adminApiFn = api();
    if (!adminApiFn) return false;
    try {
      const data = await adminApiFn('adminGetSession', { adminToken: legacyToken, noCache: 1, firebasePrimaryRestore: VERSION });
      if (data && data.status === 'success') {
        try { global.dispatchEvent(new CustomEvent('ulim-legacy-session-ready', { detail: { version: VERSION, source: 'stored-token-validated' } })); } catch (_ignore) {}
        return true;
      }
    } catch (error) {
      const message = text(error && error.message || error);
      if (/세션.*(만료|유효하지)|로그인.*필요|다시.*로그인|토큰.*(만료|유효하지)/i.test(message)) {
        clearLegacySession();
        setCompatibilityStatus('Firebase 로그인 정상 · 연습일지·연습실 예약 호환 연결은 다음 수동 로그인 때 복구됩니다.', 'error');
        try { global.dispatchEvent(new CustomEvent('ulim-legacy-session-expired', { detail: { version: VERSION, source: 'stored-token-validation' } })); } catch (_ignore) {}
        return false;
      }
      if (!(error && error.silent)) safeConsole('warn', '[ULIM 7.32.4 stored GAS session check delayed]', error);
    }
    return false;
  }

  async function restoreFirebaseStaffSession() {
    if (restoreListenerInstalled) return;
    restoreListenerInstalled = true;
    const restoreStartedAt = Date.now();
    try {
      const rt = await runtime();
      rt.sdk.onAuthStateChanged(rt.auth, async function (user) {
        if (!user || manualLoginInProgress) return;
        if (explicitLogoutActive()) {
          try { await rt.sdk.signOut(rt.auth); } catch (_ignore) {}
          return;
        }
        const restoringUid = text(user.uid);
        try {
          const profile = await readCurrentStaffProfile(rt, '');
          if (explicitLogoutActive() || !rt.auth.currentUser || text(rt.auth.currentUser.uid) !== restoringUid) return;
          primaryCredentialReady = profile.passwordLoginEnabled === true;
          lastLoginId = profile.id || '';
          saveFirebaseProfile(profile);
          await domReadyPromise;
          if (explicitLogoutActive() || !rt.auth.currentUser || text(rt.auth.currentUser.uid) !== restoringUid) return;
          showStaffShell();
          setCompatibilityStatus('Firebase 로그인 자동 복원됨', 'ready');
          activateFirestoreStaffData(rt, 'firebase-password-restore');
          validateStoredLegacySessionQuietly().catch(function () {});
          safeConsole('info', '[ULIM 7.32.4 Firebase-primary restored]', {
            uid: user.uid,
            role: profile.firebaseRole,
            restoreElapsedMs: Date.now() - restoreStartedAt,
            navigationToShellMs: Math.round((global.performance && global.performance.now ? global.performance.now() : 0))
          });
        } catch (error) {
          safeConsole('warn', '[ULIM 7.32.4 stored Firebase session rejected]', error);
          try { await rt.sdk.signOut(rt.auth); } catch (_ignore) {}
        }
      });
    } catch (error) {
      restoreListenerInstalled = false;
      safeConsole('warn', '[ULIM 7.32.4 restore unavailable]', error);
    }
  }

  let invalidTokenHandling7324 = false;
  async function handleInvalidFirebaseToken7324(event) {
    if (invalidTokenHandling7324 || explicitLogoutActive()) return;
    invalidTokenHandling7324 = true;
    beginExplicitLogout('firebase-token-invalid');
    primaryCredentialReady = false;
    lastLoginId = '';
    try {
      const rt = await runtime().catch(function () { return null; });
      if (rt && rt.auth && rt.auth.currentUser) {
        try { await rt.sdk.signOut(rt.auth); } catch (_ignore) {}
      }
    } finally {
      try {
        const loginBox = document.getElementById('adminLoginBox');
        const dashboard = document.getElementById('adminDashboard');
        if (loginBox) loginBox.style.display = 'block';
        if (dashboard) dashboard.style.display = 'none';
        document.body.classList.remove('admin-mode');
      } catch (_ignore) {}
      try {
        if (!global.__ULIM_TOKEN_INVALID_ALERT_7324__) {
          global.__ULIM_TOKEN_INVALID_ALERT_7324__ = true;
          alert('Firebase 로그인 세션이 만료되었거나 폐기되었습니다. 다시 로그인해주세요.');
          setTimeout(function () { global.__ULIM_TOKEN_INVALID_ALERT_7324__ = false; }, 1000);
        }
      } catch (_ignore) {}
      invalidTokenHandling7324 = false;
    }
  }

  function install() {
    originalPasswordChange = typeof global.changeAdminPasswordByPrompt === 'function'
      ? global.changeAdminPasswordByPrompt
      : null;
    global.adminLogin = firebasePrimaryAdminLogin;
    global.changeAdminPasswordByPrompt = firebasePrimaryPasswordChange;
    try { adminLogin = global.adminLogin; } catch (_ignore) {}
    try { changeAdminPasswordByPrompt = global.changeAdminPasswordByPrompt; } catch (_ignore) {}
    installLogoutWrapper();
    if (!global.__ULIM_FIREBASE_TOKEN_INVALID_LISTENER_7324__) {
      global.__ULIM_FIREBASE_TOKEN_INVALID_LISTENER_7324__ = true;
      global.addEventListener('ulim-firebase-token-invalid', handleInvalidFirebaseToken7324);
    }
    if (!global.__ULIM_LEGACY_SESSION_STATUS_7324__) {
      global.__ULIM_LEGACY_SESSION_STATUS_7324__ = true;
      global.addEventListener('ulim-legacy-session-expired', function () {
        setCompatibilityStatus('Firebase 로그인 정상 · 연습일지·연습실 예약 호환 세션만 만료됨', 'error');
      });
      global.addEventListener('ulim-legacy-session-ready', function () {
        setCompatibilityStatus('연습일지·연습실 예약 호환 연결됨', 'ready');
      });
    }
    safeConsole('info', '[ULIM 7.32.4 Firebase-primary staff login installed]', VERSION);
  }

  /* Firebase Auth 복원은 HTML 전체(1MB+) 파싱이 끝나기 전에 시작합니다. */
  restoreFirebaseStaffSession();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  global.__ULIM_STAFF_LOGIN_FIREBASE_PRIMARY_7324_API__ = Object.freeze({
    version: VERSION,
    login: firebasePrimaryAdminLogin,
    deriveLoginEmail: deriveLoginEmail,
    restore: restoreFirebaseStaffSession
  });
})(typeof window !== 'undefined' ? window : globalThis);
