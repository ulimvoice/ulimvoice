(function (global) {
  'use strict';

  if (global.__ULIM_STUDENT_FIREBASE_PRIMARY_AUTH_7355029__) return;

  const VERSION = '2026-08-08.7355029-r3-student-firebase-primary-auth-single-owner';
  const AUTO_LOGIN_KEY = 'ulimStudentAutoLogin';
  const EXPLICIT_LOGOUT_KEY = 'ULIM_EXPLICIT_LOGOUT_IN_PROGRESS';
  const MAX_LEGACY_TOKEN_LENGTH = 2048;
  const AUTH_RESTORE_TIMEOUT_MS = 3500;

  const state = {
    validated: false,
    profile: null,
    runtimePromise: null,
    establishPromise: null,
    restorePromise: null
  };

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function sameValue(left, right) {
    if (left == null || right == null) return false;
    return String(left) === String(right);
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

  function gasEndpoint() {
    try {
      const value = text(global.GET_API_URL || (typeof GET_API_URL !== 'undefined' ? GET_API_URL : ''));
      return value;
    } catch (_ignore) {
      return '';
    }
  }

  function cleanLegacyToken(value) {
    const token = text(value);
    if (!token || token.length > MAX_LEGACY_TOKEN_LENGTH) return '';
    return token;
  }

  async function runtime() {
    if (state.runtimePromise) return state.runtimePromise;
    state.runtimePromise = (async function () {
      const room = roomRealtime();
      if (!room || typeof room.preloadRuntime !== 'function') {
        throw new Error('학생 로그인 연결을 준비하지 못했습니다.');
      }
      const rt = await room.preloadRuntime();
      if (!rt || !rt.sdk || !rt.auth || !rt.db || !rt.functions) {
        throw new Error('학생 로그인 연결을 준비하지 못했습니다.');
      }
      return rt;
    })().catch(function (error) {
      state.runtimePromise = null;
      throw error;
    });
    return state.runtimePromise;
  }

  async function applyPersistenceToRuntime(rt) {
    if (!rt || !rt.sdk || !rt.auth || typeof rt.sdk.setPersistence !== 'function') return;
    const persistence = autoLoginEnabled()
      ? rt.sdk.browserLocalPersistence
      : rt.sdk.browserSessionPersistence;
    if (persistence) await rt.sdk.setPersistence(rt.auth, persistence);
  }

  async function applyPersistence() {
    const rt = await runtime();
    await applyPersistenceToRuntime(rt);
    return true;
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

  async function readValidatedStudentProfile(rt, expectedStudentUid) {
    const user = rt && rt.auth ? rt.auth.currentUser : null;
    if (!user) throw new Error('학생 로그인 상태를 확인하지 못했습니다.');

    const room = roomRealtime();
    if (room && typeof room.getStableIdToken === 'function') {
      await room.getStableIdToken(rt, false, 'student-primary-profile');
    }

    const tokenResult = await rt.sdk.getIdTokenResult(user, false);
    const claims = tokenResult && tokenResult.claims || {};
    const role = text(claims.role);
    const studentUid = text(claims.studentUid);
    const authVersion = claims.authVersion;

    if (role !== 'student' || !studentUid) {
      throw new Error('학생 계정으로 다시 로그인해주세요.');
    }
    if (expectedStudentUid && text(expectedStudentUid) !== studentUid) {
      throw new Error('학생 계정 정보가 일치하지 않습니다. 다시 로그인해주세요.');
    }

    const snapshot = await rt.sdk.getDoc(rt.sdk.doc(rt.db, 'users', user.uid));
    if (!snapshot || typeof snapshot.exists !== 'function' || !snapshot.exists()) {
      throw new Error('학생 계정 정보를 확인하지 못했습니다.');
    }
    const data = snapshot.data() || {};
    if (
      data.active !== true ||
      text(data.role) !== 'student' ||
      text(data.studentUid) !== studentUid ||
      !sameValue(data.authVersion, authVersion)
    ) {
      throw new Error('학생 계정 상태가 변경되었습니다. 다시 로그인해주세요.');
    }

    return {
      version: VERSION,
      role: 'student',
      firebaseAuthUid: text(user.uid),
      studentUid: studentUid,
      authVersion: authVersion
    };
  }

  function setValidatedProfile(profile) {
    state.profile = profile || null;
    state.validated = !!(profile && profile.role === 'student' && profile.firebaseAuthUid && profile.studentUid);
    if (state.validated) {
      try {
        global.dispatchEvent(new CustomEvent('ulim-student-firebase-auth-ready', {
          detail: {
            uid: profile.firebaseAuthUid,
            studentUid: profile.studentUid,
            version: VERSION
          }
        }));
      } catch (_ignore) {}
    }
    return state.profile;
  }

  function clearValidatedProfile() {
    state.validated = false;
    state.profile = null;
  }

  async function authenticateThroughSharedRuntime(rt, reason) {
    const room = roomRealtime();
    if (!room || typeof room.forceReauthenticate !== 'function') {
      throw new Error('학생 로그인 연결을 준비하지 못했습니다.');
    }

    /*
     * 0.29 R3 single-owner rule:
     * room-classroom-realtime already owns legacy proof issuance, one-time proof
     * consumption, server exchange and Firebase sign-in. The student
     * module must never run a second exchange path against the same Auth instance.
     */
    const authenticated = await room.forceReauthenticate(reason || 'student-primary-login');
    if (!authenticated || !authenticated.auth || !authenticated.auth.currentUser) {
      throw new Error('학생 로그인 연결을 완료하지 못했습니다.');
    }
    return authenticated;
  }

  async function establishFromLegacy(options) {
    options = options || {};
    if (state.establishPromise) return state.establishPromise;

    state.establishPromise = (async function () {
      if (explicitLogoutActive() && options.manual !== true) return null;
      const token = cleanLegacyToken(options.studentSessionToken);
      if (!token) throw new Error('학생 로그인 정보를 다시 확인해주세요.');

      const rt = await runtime();
      await applyPersistenceToRuntime(rt);
      clearValidatedProfile();

      /* A stale staff/other Firebase identity must not be accepted for a new
         student login. Sign it out before handing authentication to the one
         shared realtime owner. The realtime owner serializes concurrent auth
         work through its own state.signingIn promise. */
      if (rt.auth.currentUser) {
        try { await rt.sdk.signOut(rt.auth); } catch (_ignore) {}
      }

      const authenticated = await authenticateThroughSharedRuntime(rt, 'student-primary-login');

      try {
        const profile = await readValidatedStudentProfile(authenticated, options.expectedStudentUid || '');
        return setValidatedProfile(profile);
      } catch (error) {
        try { await authenticated.sdk.signOut(authenticated.auth); } catch (_ignore) {}
        clearValidatedProfile();
        throw error;
      }
    })().finally(function () {
      state.establishPromise = null;
    });

    return state.establishPromise;
  }

  async function restore(options) {
    options = options || {};
    if (state.restorePromise) return state.restorePromise;

    state.restorePromise = (async function () {
      if (explicitLogoutActive()) return null;
      const rt = await runtime();
      await applyPersistenceToRuntime(rt);
      await waitForInitialAuth(rt);

      const expectedStudentUid = text(options.expectedStudentUid || '');
      const legacyToken = cleanLegacyToken(options.studentSessionToken);

      if (rt.auth.currentUser) {
        try {
          const profile = await readValidatedStudentProfile(rt, expectedStudentUid);
          return setValidatedProfile(profile);
        } catch (_currentUserError) {
          clearValidatedProfile();
          if (!legacyToken) return null;
        }
      }

      if (!legacyToken) return null;
      return establishFromLegacy({
        studentSessionToken: legacyToken,
        expectedStudentUid: expectedStudentUid,
        manual: false
      });
    })().finally(function () {
      state.restorePromise = null;
    });

    return state.restorePromise;
  }

  async function signOutStudent(options) {
    options = options || {};
    const expectedFirebaseUid = text(options.expectedFirebaseUid || (state.profile && state.profile.firebaseAuthUid));
    try {
      const rt = await runtime();
      const current = rt && rt.auth ? rt.auth.currentUser : null;
      if (current && expectedFirebaseUid && text(current.uid) === expectedFirebaseUid) {
        await rt.sdk.signOut(rt.auth);
      } else if (current && state.validated && state.profile && text(current.uid) === text(state.profile.firebaseAuthUid)) {
        await rt.sdk.signOut(rt.auth);
      }
    } catch (_ignore) {
      // Explicit logout must continue clearing local app state even if the network is unavailable.
    }
    clearValidatedProfile();
    return true;
  }

  function hasValidatedSession() {
    return state.validated === true && !!(state.profile && state.profile.studentUid && state.profile.firebaseAuthUid);
  }

  function currentProfile() {
    return state.profile ? Object.assign({}, state.profile) : null;
  }

  const api = Object.freeze({
    version: VERSION,
    restore: restore,
    establishFromLegacy: establishFromLegacy,
    signOut: signOutStudent,
    applyPersistence: applyPersistence,
    hasValidatedSession: hasValidatedSession,
    currentProfile: currentProfile,
    clearValidatedState: clearValidatedProfile
  });

  global.__ULIM_STUDENT_FIREBASE_PRIMARY_AUTH_7355029__ = api;
})(typeof window !== 'undefined' ? window : globalThis);
