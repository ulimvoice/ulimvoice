(function (global) {
  'use strict';

  if (global.__ULIM_STUDENT_FIREBASE_DIRECT_AUTH_7355030__) return;

  const VERSION = '2026-08-15.7355030-r8-alias-canonical-status-fix';
  const AUTO_LOGIN_KEY = 'ulimStudentAutoLogin';
  const EXPLICIT_LOGOUT_KEY = 'ULIM_EXPLICIT_LOGOUT_IN_PROGRESS';
  const AUTH_RESTORE_TIMEOUT_MS = 3500;
  const MAX_PASSWORD_LENGTH = 64;

  const state = {
    runtimePromise: null,
    loginPromise: null,
    restorePromise: null,
    profile: null,
    credential: null
  };

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeName(value) {
    return text(value).normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  }

  function roomRealtime() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_728 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_727 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null;
  }

  function autoLoginEnabled() {
    try { return global.localStorage.getItem(AUTO_LOGIN_KEY) !== 'N'; } catch (_ignore) { return true; }
  }

  function explicitLogoutActive() {
    try { return global.sessionStorage.getItem(EXPLICIT_LOGOUT_KEY) === 'Y'; } catch (_ignore) { return false; }
  }

  async function runtime() {
    if (state.runtimePromise) return state.runtimePromise;
    state.runtimePromise = (async function () {
      const room = roomRealtime();
      if (!room || typeof room.preloadRuntime !== 'function') throw new Error('학생 로그인 연결을 준비하지 못했습니다.');
      const rt = await room.preloadRuntime();
      if (!rt || !rt.sdk || !rt.auth || !rt.db || !rt.functions) throw new Error('학생 로그인 연결을 준비하지 못했습니다.');
      return rt;
    })().catch(function (error) {
      state.runtimePromise = null;
      throw error;
    });
    return state.runtimePromise;
  }

  async function applyPersistenceToRuntime(rt) {
    if (!rt || !rt.sdk || !rt.auth || typeof rt.sdk.setPersistence !== 'function') return;
    const persistence = autoLoginEnabled() ? rt.sdk.browserLocalPersistence : rt.sdk.browserSessionPersistence;
    if (persistence) await rt.sdk.setPersistence(rt.auth, persistence);
  }

  async function waitForInitialAuth(rt) {
    if (!rt || !rt.auth || !rt.sdk) return null;
    if (rt.auth.currentUser) return rt.auth.currentUser;
    if (typeof rt.sdk.onAuthStateChanged !== 'function') return null;
    return new Promise(function (resolve) {
      let settled = false;
      let unsubscribe = null;
      const finish = function (user) {
        if (settled) return;
        settled = true;
        try { if (unsubscribe) unsubscribe(); } catch (_ignore) {}
        resolve(user || null);
      };
      const timer = setTimeout(function () { finish(rt.auth.currentUser || null); }, AUTH_RESTORE_TIMEOUT_MS);
      try {
        unsubscribe = rt.sdk.onAuthStateChanged(rt.auth, function (user) {
          clearTimeout(timer);
          finish(user);
        }, function () {
          clearTimeout(timer);
          finish(null);
        });
      } catch (_ignore) {
        clearTimeout(timer);
        finish(rt.auth.currentUser || null);
      }
    });
  }

  function bytesToBase64Url(bytes) {
    let binary = '';
    bytes.forEach(function (value) { binary += String.fromCharCode(value); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  async function deriveFirebasePassword(salt, rawPassword) {
    const cleanSalt = text(salt);
    const password = String(rawPassword == null ? '' : rawPassword);
    if (!cleanSalt) throw new Error('학생 로그인 계정 정보가 올바르지 않습니다.');
    if (password.length < 4 || password.length > MAX_PASSWORD_LENGTH) throw new Error('비밀번호는 4자리 이상 입력해주세요.');
    if (!global.crypto || !global.crypto.subtle || typeof TextEncoder === 'undefined') {
      throw new Error('현재 브라우저에서는 안전한 학생 로그인을 사용할 수 없습니다.');
    }
    const input = new TextEncoder().encode('ulimvoice-student-password-v1\u001f' + cleanSalt + '\u001f' + password);
    const digest = await global.crypto.subtle.digest('SHA-256', input);
    return 'U1!' + bytesToBase64Url(new Uint8Array(digest));
  }

  function callableData(response) {
    return response && response.data ? response.data : response;
  }

  async function resolveCandidates(rt, name) {
    const callable = rt.sdk.httpsCallable(rt.functions, 'resolveStudentFirebaseLogin7355030');
    const data = callableData(await callable({ name: text(name) })) || {};
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    return candidates.map(function (item) {
      return {
        key: text(item && item.key),
        email: text(item && item.email),
        salt: text(item && item.salt)
      };
    }).filter(function (item) { return item.email && item.salt; });
  }

  async function readProfile(rt) {
    const user = rt && rt.auth ? rt.auth.currentUser : null;
    if (!user) throw new Error('학생 로그인 상태를 확인하지 못했습니다.');
    const tokenResult = await rt.sdk.getIdTokenResult(user, false);
    const claims = tokenResult && tokenResult.claims || {};
    const role = text(claims.role);
    const studentUid = text(claims.studentUid);
    const authVersion = claims.authVersion;
    if (role !== 'student' || !studentUid || authVersion == null) throw new Error('학생 계정이 아닙니다.');

    const callable = rt.sdk.httpsCallable(rt.functions, 'getStudentFirebaseProfile7355030');
    const profile = callableData(await callable({})) || {};
    if (!profile.ok || text(profile.studentUid) !== studentUid || text(profile.firebaseAuthUid) !== text(user.uid)) {
      throw new Error('학생 계정 정보를 확인하지 못했습니다.');
    }
    const salt = text(profile.loginCredentialSalt);
    const email = text(profile.loginEmail || user.email);
    if (!salt || !email) throw new Error('학생 로그인 계정 정보가 준비되지 않았습니다.');

    state.credential = { email: email, salt: salt };
    state.profile = {
      version: VERSION,
      role: 'student',
      firebaseAuthUid: text(user.uid),
      studentUid: studentUid,
      authVersion: authVersion,
      name: text(profile.name),
      attendanceNo: text(profile.attendanceNo),
      instructorNames: Array.isArray(profile.instructorNames) ? profile.instructorNames.map(text).filter(Boolean) : [],
      enrollmentStatus: text(profile.enrollmentStatus),
      mustChangePassword: profile.mustChangePassword === true,
      loginEmail: email,
      loginCredentialSalt: salt
    };
    return Object.assign({}, state.profile);
  }

  function isCredentialError(error) {
    const code = text(error && error.code).toLowerCase();
    return code.indexOf('auth/invalid-credential') >= 0 ||
      code.indexOf('auth/wrong-password') >= 0 ||
      code.indexOf('auth/user-not-found') >= 0 ||
      code.indexOf('auth/user-disabled') >= 0 ||
      code.indexOf('auth/invalid-login-credentials') >= 0;
  }

  async function login(name, rawPassword) {
    if (state.loginPromise) return state.loginPromise;
    state.loginPromise = (async function () {
      const cleanName = text(name);
      const password = String(rawPassword == null ? '' : rawPassword);
      if (!cleanName || !password) throw new Error('학생 이름과 비밀번호를 입력해주세요.');
      if (!normalizeName(cleanName)) throw new Error('학생 이름을 확인해주세요.');
      if (password.length < 4) throw new Error('비밀번호는 4자리 이상 입력해주세요.');
      try { global.sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY); } catch (_ignore) {}

      const rt = await runtime();
      await applyPersistenceToRuntime(rt);
      if (rt.auth.currentUser) {
        try { await rt.sdk.signOut(rt.auth); } catch (_ignore) {}
      }
      state.profile = null;
      state.credential = null;

      const candidates = await resolveCandidates(rt, cleanName);
      if (!candidates.length) throw new Error('학생 이름 또는 비밀번호가 일치하지 않습니다.');

      if (candidates.length === 1) {
        const candidate = candidates[0];
        const internalPassword = await deriveFirebasePassword(candidate.salt, password);
        try {
          await rt.sdk.signInWithEmailAndPassword(rt.auth, candidate.email, internalPassword);
          state.credential = { email: candidate.email, salt: candidate.salt };
          return await readProfile(rt);
        } catch (error) {
          if (rt.auth.currentUser) {
            try { await rt.sdk.signOut(rt.auth); } catch (_ignore) {}
          }
          state.profile = null;
          state.credential = null;
          if (isCredentialError(error)) throw new Error('학생 이름 또는 비밀번호가 일치하지 않습니다.');
          throw error;
        }
      }

      /*
       * Same-name students are valid. We therefore test every candidate before
       * choosing an identity. Never accept the first success: if two candidates
       * share the same visible password, the input is ambiguous and login must
       * fail instead of opening the wrong student's account.
       */
      const matchedCandidates = [];
      let lastCredentialError = null;
      for (const candidate of candidates) {
        const internalPassword = await deriveFirebasePassword(candidate.salt, password);
        try {
          const signedIn = await rt.sdk.signInWithEmailAndPassword(rt.auth, candidate.email, internalPassword);
          const user = signedIn && signedIn.user ? signedIn.user : rt.auth.currentUser;
          if (!user) throw new Error('학생 로그인 상태를 확인하지 못했습니다.');
          const tokenResult = await rt.sdk.getIdTokenResult(user, false);
          const claims = tokenResult && tokenResult.claims || {};
          if (text(claims.role) !== 'student' || !text(claims.studentUid) || claims.authVersion == null) {
            throw new Error('학생 계정이 아닙니다.');
          }
          matchedCandidates.push(candidate);
        } catch (error) {
          if (!isCredentialError(error)) throw error;
          lastCredentialError = error;
        } finally {
          if (rt.auth.currentUser) {
            try { await rt.sdk.signOut(rt.auth); } catch (_ignore) {}
          }
          state.profile = null;
          state.credential = null;
        }
      }

      if (matchedCandidates.length > 1) {
        throw new Error('동일한 이름과 비밀번호를 사용하는 학생이 2명 이상입니다. 관리자에게 문의해주세요.');
      }
      if (matchedCandidates.length !== 1) {
        if (lastCredentialError) throw new Error('학생 이름 또는 비밀번호가 일치하지 않습니다.');
        throw new Error('학생 로그인을 완료하지 못했습니다.');
      }

      const selected = matchedCandidates[0];
      const selectedInternalPassword = await deriveFirebasePassword(selected.salt, password);
      await rt.sdk.signInWithEmailAndPassword(rt.auth, selected.email, selectedInternalPassword);
      state.credential = { email: selected.email, salt: selected.salt };
      return await readProfile(rt);
    })().finally(function () {
      state.loginPromise = null;
    });
    return state.loginPromise;
  }

  async function restore() {
    if (state.restorePromise) return state.restorePromise;
    state.restorePromise = (async function () {
      if (explicitLogoutActive()) return null;
      const rt = await runtime();
      await applyPersistenceToRuntime(rt);
      await waitForInitialAuth(rt);
      const user = rt.auth.currentUser;
      if (!user) return null;
      try {
        const tokenResult = await rt.sdk.getIdTokenResult(user, false);
        if (text(tokenResult && tokenResult.claims && tokenResult.claims.role) !== 'student') return null;
        return await readProfile(rt);
      } catch (_error) {
        try { await rt.sdk.signOut(rt.auth); } catch (_ignore) {}
        state.profile = null;
        state.credential = null;
        return null;
      }
    })().finally(function () {
      state.restorePromise = null;
    });
    return state.restorePromise;
  }

  async function changePassword(currentRawPassword, newRawPassword) {
    const currentPassword = String(currentRawPassword == null ? '' : currentRawPassword);
    const newPassword = String(newRawPassword == null ? '' : newRawPassword);
    if (currentPassword.length < 4) throw new Error('현재 비밀번호를 정확히 입력해주세요.');
    if (newPassword.length < 4) throw new Error('새 비밀번호는 4자리 이상 입력해주세요.');
    if (newPassword.length > MAX_PASSWORD_LENGTH) throw new Error('새 비밀번호가 너무 깁니다.');
    if (currentPassword === newPassword) throw new Error('현재 비밀번호와 다른 새 비밀번호를 입력해주세요.');

    const rt = await runtime();
    if (!rt.auth.currentUser) throw new Error('학생 로그인이 필요합니다.');
    const profile = state.profile || await readProfile(rt);
    const email = text((state.credential && state.credential.email) || profile.loginEmail || rt.auth.currentUser.email);
    const salt = text((state.credential && state.credential.salt) || profile.loginCredentialSalt);
    if (!email || !salt) throw new Error('학생 로그인 계정 정보를 확인하지 못했습니다.');

    const currentInternal = await deriveFirebasePassword(salt, currentPassword);
    const newInternal = await deriveFirebasePassword(salt, newPassword);
    const credential = rt.sdk.EmailAuthProvider.credential(email, currentInternal);
    await rt.sdk.reauthenticateWithCredential(rt.auth.currentUser, credential);
    await rt.sdk.updatePassword(rt.auth.currentUser, newInternal);
    const confirmCallable = rt.sdk.httpsCallable(rt.functions, 'confirmStudentFirebasePasswordChanged7355030');
    await confirmCallable({});
    state.profile = Object.assign({}, profile, { mustChangePassword: false });
    return currentProfile();
  }

  async function signOut() {
    try {
      const rt = await runtime();
      if (rt.auth.currentUser) await rt.sdk.signOut(rt.auth);
    } catch (_ignore) {}
    state.profile = null;
    state.credential = null;
    return true;
  }

  function hasValidatedSession() {
    return !!(state.profile && state.profile.role === 'student' && state.profile.firebaseAuthUid && state.profile.studentUid);
  }

  function currentProfile() {
    return state.profile ? Object.assign({}, state.profile) : null;
  }

  global.__ULIM_STUDENT_FIREBASE_DIRECT_AUTH_7355030__ = Object.freeze({
    version: VERSION,
    login: login,
    restore: restore,
    changePassword: changePassword,
    signOut: signOut,
    hasValidatedSession: hasValidatedSession,
    currentProfile: currentProfile,
    applyPersistence: async function () { const rt = await runtime(); await applyPersistenceToRuntime(rt); return true; }
  });
})(typeof window !== 'undefined' ? window : globalThis);
