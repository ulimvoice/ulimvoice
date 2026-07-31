(function (global) {
  "use strict";

  if (global.__ULIM_ROOM_CLASSROOM_REALTIME_72915__) return;
  global.__ULIM_ROOM_CLASSROOM_REALTIME_72915__ = true;

  const VERSION = "2026-07-31.729.15";
  const ENABLED = global.ULIM_ROOM_CLASSROOM_REALTIME_ENABLED !== false;
  const FIREBASE_CONFIG = Object.freeze({
    apiKey: "AIzaSyAW-sqtUQ_mJ6ZS_aV8pTOAKvHTSX-FXUM",
    authDomain: "ulim-7b09a.firebaseapp.com",
    projectId: "ulim-7b09a",
    storageBucket: "ulim-7b09a.firebasestorage.app",
    messagingSenderId: "364788231295",
    appId: "1:364788231295:web:b43fb49527bb6af1c6634a"
  });
  const FUNCTIONS_REGION = "asia-northeast3";
  const APP_NAME = "ulim-room-classroom-realtime-7297";
  const SESSION_FINGERPRINT_KEY = "ulimRealtimeLegacySessionFingerprint721";
  const STAFF_EXPLICIT_LOGOUT_KEY = "ULIM_STAFF_EXPLICIT_LOGOUT_7322";
  const REQUEST_PREFIX = "RT7297";
  const CLASSROOM_FAST_CACHE_PREFIX_7297 = "ulimClassroomCanonicalCache7297:";
  const CLASSROOM_FAST_CACHE_INDEX_7297 = "ulimClassroomCanonicalCacheIndex7297";
  const CLASSROOM_FAST_CACHE_MAX_DATES_7297 = 16;
  const CLASSROOM_FIRST_SNAPSHOT_WAIT_MS_7297 = 1400;

  const state = {
    started: false,
    ready: false,
    signingIn: null,
    runtime: null,
    runtimePromise: null,
    preissuedProof: null,
    sessionFingerprint: "",
    classroomDate: "",
    classroomUnsubscribe: null,
    classroomClaimsUnsubscribe: null,
    confirmedClassroomByDate: Object.create(null),
    remoteClaimsByDate: Object.create(null),
    localClaimsByDate: Object.create(null),
    pendingSlotStateByDate: Object.create(null),
    lastSheetRevisionByDate: Object.create(null),
    revisionPollInFlight: false,
    roomMonth: "",
    roomUnsubscribe: null,
    roomMonthData: null,
    roomIndexWrapped: false,
    wrappersInstalled: false,
    lastError: "",
    authPollTimer: null,
    classroomBaselineReady: Object.create(null),
    classroomBaselinePromises: Object.create(null),
    sheetSyncRunning: false,
    sheetSyncTimer: null,
    sheetSyncInFlight: new Set(),
    sheetSyncRerunRequested: false,
    legacyClassroomSave: null,
    legacyClassroomRelease: null,
    classroomPrimarySaving: false,
    selectedClassroomRecordId: "",
    savingClassroomSlots: new Set(),
    sheetAuthorityLoading: Object.create(null),
    sheetAuthorityPromises: Object.create(null),
    lastSheetSignatureByDate: Object.create(null),
    sheetPollTimer: null,
    suppressRealtimeSummaryUntil: 0,
    classroomFirstSnapshotByDate: Object.create(null),
    fastClassroomLoadPromises: Object.create(null),
    classroomCacheHydratedByDate: Object.create(null),
    firestorePersistentCacheEnabled: false
  };

  /*
   * 7.29.15 stable token guard
   * - cached ID token is preferred for ordinary reads/callables;
   * - only one refresh request is allowed at a time;
   * - a failed refresh is cooled down so multiple modules cannot flood
   *   securetoken.googleapis.com;
   * - terminal refresh-token failures are surfaced once to the login module.
   */
  const tokenGuard72915 = {
    uid: "",
    promise: null,
    lastError: null,
    lastErrorAt: 0,
    lastForceAt: 0,
    invalidEventUid: ""
  };

  function resetStableTokenGuard72915(uid) {
    tokenGuard72915.uid = String(uid || "");
    tokenGuard72915.promise = null;
    tokenGuard72915.lastError = null;
    tokenGuard72915.lastErrorAt = 0;
    tokenGuard72915.lastForceAt = 0;
    tokenGuard72915.invalidEventUid = "";
  }

  function terminalTokenError72915(error) {
    const code = String(error && (error.code || error.name) || "").toLowerCase();
    const message = String(error && error.message || "").toLowerCase();
    return code.indexOf("invalid-user-token") >= 0 ||
      code.indexOf("user-token-expired") >= 0 ||
      code.indexOf("user-disabled") >= 0 ||
      code.indexOf("user-not-found") >= 0 ||
      message.indexOf("invalid refresh token") >= 0 ||
      message.indexOf("token has been revoked") >= 0;
  }

  async function getStableIdToken72915(runtime, forceRefresh, reason) {
    if (!runtime || !runtime.auth || !runtime.auth.currentUser || !runtime.sdk) {
      throw new Error("Firebase 로그인 사용자가 없습니다.");
    }
    const user = runtime.auth.currentUser;
    const uid = String(user.uid || "");
    if (tokenGuard72915.uid !== uid) resetStableTokenGuard72915(uid);

    const now = Date.now();
    const cooldownMs = terminalTokenError72915(tokenGuard72915.lastError) ? 60000 : 12000;
    if (tokenGuard72915.lastError && now - tokenGuard72915.lastErrorAt < cooldownMs) {
      throw tokenGuard72915.lastError;
    }
    if (tokenGuard72915.promise) return tokenGuard72915.promise;

    let force = forceRefresh === true;
    if (force && now - tokenGuard72915.lastForceAt < 15000) force = false;
    if (force) tokenGuard72915.lastForceAt = now;

    tokenGuard72915.promise = Promise.resolve()
      .then(function () { return runtime.sdk.getIdToken(user, force); })
      .then(function (token) {
        tokenGuard72915.lastError = null;
        tokenGuard72915.lastErrorAt = 0;
        return token;
      })
      .catch(function (error) {
        tokenGuard72915.lastError = error;
        tokenGuard72915.lastErrorAt = Date.now();
        if (terminalTokenError72915(error) && tokenGuard72915.invalidEventUid !== uid) {
          tokenGuard72915.invalidEventUid = uid;
          try {
            global.dispatchEvent(new CustomEvent("ulim-firebase-token-invalid", {
              detail: {
                uid: uid,
                reason: String(reason || "token-refresh"),
                code: String(error && error.code || ""),
                version: VERSION
              }
            }));
          } catch (_ignore) {}
        }
        throw error;
      })
      .finally(function () {
        tokenGuard72915.promise = null;
      });

    return tokenGuard72915.promise;
  }

  async function getStableIdTokenResult72915(runtime, forceRefresh, reason) {
    await getStableIdToken72915(runtime, forceRefresh === true, reason || "token-result");
    return runtime.sdk.getIdTokenResult(runtime.auth.currentUser, false);
  }

  function safeConsole(method) {
    try {
      const args = Array.prototype.slice.call(arguments, 1);
      (console[method] || console.log).apply(console, args);
    } catch (_ignore) {}
  }

  function staffExplicitLogoutActive72913() {
    try {
      return global.__ULIM_STAFF_EXPLICIT_LOGOUT_ACTIVE__ === true ||
        sessionStorage.getItem(STAFF_EXPLICIT_LOGOUT_KEY) === "Y" ||
        localStorage.getItem(STAFF_EXPLICIT_LOGOUT_KEY) === "Y";
    } catch (_ignore) {
      return global.__ULIM_STAFF_EXPLICIT_LOGOUT_ACTIVE__ === true;
    }
  }

  function stopRealtimeListener72913(key) {
    const unsubscribe = state[key];
    state[key] = null;
    if (typeof unsubscribe === "function") {
      try { unsubscribe(); } catch (_ignore) {}
    }
  }

  function resetRealtimeForStaffLogout72913() {
    state.ready = false;
    resetStableTokenGuard72915("");
    state.preissuedProof = null;
    state.sessionFingerprint = "";
    stopRealtimeListener72913("classroomUnsubscribe");
    stopRealtimeListener72913("classroomClaimsUnsubscribe");
    stopRealtimeListener72913("roomUnsubscribe");
    try { localStorage.removeItem(SESSION_FINGERPRINT_KEY); } catch (_ignore) {}
    setStatus("waiting", "실시간: 로그아웃됨");
  }

  global.addEventListener("ulim-staff-logout-start", function () {
    resetRealtimeForStaffLogout72913();
    if (state.runtime && state.runtime.auth && state.runtime.auth.currentUser) {
      Promise.resolve(state.runtime.sdk.signOut(state.runtime.auth)).catch(function () {});
    }
  });

  global.addEventListener("storage", function (event) {
    if (!event || event.key !== STAFF_EXPLICIT_LOGOUT_KEY || event.newValue !== "Y") return;
    resetRealtimeForStaffLogout72913();
    if (state.runtime && state.runtime.auth && state.runtime.auth.currentUser) {
      Promise.resolve(state.runtime.sdk.signOut(state.runtime.auth)).catch(function () {});
    }
  });

  function preferredAuthPersistence72913(sdk) {
    let lastMode = "";
    let adminAuto = true;
    let studentAuto = true;
    try {
      lastMode = sessionStorage.getItem("ulimLastMode") || localStorage.getItem("ulimLastMode") || "";
      adminAuto = localStorage.getItem("ulimAdminAutoLogin") !== "N";
      studentAuto = localStorage.getItem("ulimStudentAutoLogin") !== "N";
    } catch (_ignore) {}
    const persistent = lastMode === "student" ? studentAuto : lastMode === "admin" ? adminAuto : true;
    return persistent ? sdk.browserLocalPersistence : sdk.browserSessionPersistence;
  }


  function classroomFastCacheKey7297(date) {
    return CLASSROOM_FAST_CACHE_PREFIX_7297 + String(date || "");
  }

  function rememberClassroomFastCacheDate7297(date) {
    try {
      const key = CLASSROOM_FAST_CACHE_INDEX_7297;
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      const dates = [String(date || "")].concat(Array.isArray(raw) ? raw : [])
        .filter(function (value, index, list) { return value && list.indexOf(value) === index; })
        .slice(0, CLASSROOM_FAST_CACHE_MAX_DATES_7297);
      localStorage.setItem(key, JSON.stringify(dates));
      const keep = new Set(dates);
      Object.keys(localStorage).forEach(function (storageKey) {
        if (storageKey.indexOf(CLASSROOM_FAST_CACHE_PREFIX_7297) !== 0) return;
        const cachedDate = storageKey.slice(CLASSROOM_FAST_CACHE_PREFIX_7297.length);
        if (!keep.has(cachedDate)) localStorage.removeItem(storageKey);
      });
    } catch (_ignore) {}
  }

  function writeClassroomFastCache7297(date, records, revision) {
    date = String(date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(records)) return;
    try {
      const normalized = sanitizeClassroomRecords(records, date);
      localStorage.setItem(classroomFastCacheKey7297(date), JSON.stringify({
        version: 1,
        date: date,
        records: normalized,
        revision: String(revision || ""),
        savedAtMs: Date.now()
      }));
      rememberClassroomFastCacheDate7297(date);
    } catch (_ignore) {}
  }

  function hydrateClassroomFastCache7297(date) {
    date = String(date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    if (state.classroomCacheHydratedByDate[date]) {
      return Array.isArray(state.confirmedClassroomByDate[date]);
    }
    state.classroomCacheHydratedByDate[date] = true;
    try {
      const parsed = JSON.parse(localStorage.getItem(classroomFastCacheKey7297(date)) || "null");
      if (!parsed || parsed.date !== date || !Array.isArray(parsed.records)) return false;
      const records = sanitizeClassroomRecords(parsed.records, date);
      state.confirmedClassroomByDate[date] = records.map(function (record) {
        return Object.assign({}, record);
      });
      if (parsed.revision) state.lastSheetRevisionByDate[date] = String(parsed.revision);
      state.lastSheetSignatureByDate[date] = recordsSignature(records);
      state.classroomBaselineReady[date] = true;
      renderMergedClassroom7296(date, "최근 시트 확정 현황을 즉시 표시했습니다 · 최신 여부 확인 중");
      setStatus("connecting", "빠른 현황 표시 · Google Sheets 최신 여부 확인 중");
      return true;
    } catch (_ignore) {
      return false;
    }
  }

  function classroomFirstSnapshotEntry7297(date) {
    date = String(date || "");
    let entry = state.classroomFirstSnapshotByDate[date];
    if (entry) return entry;
    let resolve;
    const promise = new Promise(function (done) { resolve = done; });
    entry = { promise: promise, resolve: resolve, settled: false };
    state.classroomFirstSnapshotByDate[date] = entry;
    return entry;
  }

  function settleClassroomFirstSnapshot7297(date, value) {
    const entry = classroomFirstSnapshotEntry7297(date);
    if (entry.settled) return;
    entry.settled = true;
    entry.resolve(value || { exists: false });
  }

  function hasClassroomDisplayData7297(date) {
    return Array.isArray(state.confirmedClassroomByDate[String(date || "")]);
  }

  function timeoutResult7297(ms) {
    return new Promise(function (resolve) {
      setTimeout(function () { resolve({ timeout: true }); }, Math.max(0, Number(ms) || 0));
    });
  }

  function currentGasEndpoint() {
    try {
      if (typeof GET_API_URL !== "undefined" && GET_API_URL) return String(GET_API_URL);
    } catch (_ignore) {}
    return "https://script.google.com/macros/s/AKfycbyS3QUvrjNbwvaw92_g-QKQyN3Yito8DAdpAjxUzfnsuVf3Ce7ccuaXIv651U7FnYF4/exec";
  }

  function currentLegacySession() {
    let admin = "";
    let student = "";

    try {
      admin = String(
        (typeof adminToken !== "undefined" && adminToken) ||
        global.adminToken ||
        localStorage.getItem("adminToken") ||
        sessionStorage.getItem("adminToken") ||
        ""
      ).trim();
    } catch (_ignore) {}

    if (admin) return { type: "admin", payload: { adminToken: admin }, token: admin };

    try {
      student = String(
        (typeof getStudentSessionToken_ === "function" && getStudentSessionToken_()) ||
        (typeof studentSessionToken !== "undefined" && studentSessionToken) ||
        global.studentSessionToken ||
        localStorage.getItem("studentSessionToken") ||
        sessionStorage.getItem("studentSessionToken") ||
        ""
      ).trim();
    } catch (_ignore) {}

    if (student) return { type: "student", payload: { studentSessionToken: student }, token: student };
    return null;
  }

  function sleepAuth72909(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, Math.max(0, Number(ms) || 0)); });
  }

  async function waitForLegacySession72909(timeoutMs) {
    const deadline = Date.now() + Math.max(0, Number(timeoutMs) || 0);
    let session = currentLegacySession();
    while (!session && Date.now() < deadline) {
      await sleepAuth72909(80);
      session = currentLegacySession();
    }
    return session;
  }

  function notifyAuthReady72909(runtime, reason) {
    setTimeout(function () {
      try {
        const user = runtime && runtime.auth && runtime.auth.currentUser;
        global.dispatchEvent(new CustomEvent("ulim-firebase-auth-ready", {
          detail: {
            uid: user ? String(user.uid || "") : "",
            reason: String(reason || "authenticated"),
            version: VERSION
          }
        }));
      } catch (_ignore) {}

      try {
        const date = dateKeyFromClassroom();
        if (date) subscribeClassroom(date).catch(function () {});
        subscribeRoomMonth(roomMonthKey()).catch(function () {});
      } catch (_ignore) {}
    }, 0);
  }

  async function sha256(value) {
    if (!global.crypto || !global.crypto.subtle) return String(value.length) + ":legacy";
    const bytes = new TextEncoder().encode(String(value));
    const digest = await global.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
  }

  function makeRequestId(dataset) {
    const random = Math.random().toString(36).slice(2, 10);
    return [REQUEST_PREFIX, dataset, Date.now(), random].join("-");
  }

  function setStatus(kind, message) {
    state.lastError = kind === "error" ? String(message || "") : "";
    const text = String(message || "");
    const targets = [
      ["adminPanelClassroomUsage", "ulimClassroomRealtimeStatus721"],
      ["tabRoom", "ulimRoomRealtimeStatus721"]
    ];

    targets.forEach(function (pair) {
      const container = document.getElementById(pair[0]);
      if (!container) return;
      let chip = document.getElementById(pair[1]);
      if (!chip) {
        chip = document.createElement("span");
        chip.id = pair[1];
        chip.className = "ulim-realtime-status-721";
        const firstHeading = container.querySelector("h2,h3,.admin-subtitle,.section-title");
        if (firstHeading && firstHeading.parentNode) {
          firstHeading.parentNode.insertBefore(chip, firstHeading.nextSibling);
        } else {
          container.insertBefore(chip, container.firstChild);
        }
      }
      chip.dataset.state = kind;
      chip.textContent = text;
    });
  }

  async function loadFirebaseSdk() {
    const appSdk = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js");
    const authSdk = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js");
    const functionsSdk = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-functions.js");
    const firestoreSdk = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
    return Object.assign({}, appSdk, authSdk, functionsSdk, firestoreSdk);
  }

  async function createRuntime() {
    if (state.runtime) return state.runtime;
    if (state.runtimePromise) return state.runtimePromise;

    state.runtimePromise = (async function () {
      const sdk = await loadFirebaseSdk();
      let app;
      try {
        app = sdk.getApp(APP_NAME);
      } catch (_ignore) {
        app = sdk.initializeApp(FIREBASE_CONFIG, APP_NAME);
      }

      const auth = sdk.getAuth(app);
      await sdk.setPersistence(auth, preferredAuthPersistence72913(sdk));
      const functions = sdk.getFunctions(app, FUNCTIONS_REGION);
      let db;
      try {
        if (typeof sdk.initializeFirestore === "function" &&
            typeof sdk.persistentLocalCache === "function" &&
            typeof sdk.persistentMultipleTabManager === "function") {
          db = sdk.initializeFirestore(app, {
            localCache: sdk.persistentLocalCache({
              tabManager: sdk.persistentMultipleTabManager()
            })
          });
          state.firestorePersistentCacheEnabled = true;
        } else {
          db = sdk.getFirestore(app);
        }
      } catch (error) {
        safeConsole("warn", "[ULIM classroom 7.29.10 persistent cache fallback]", error);
        db = sdk.getFirestore(app);
        state.firestorePersistentCacheEnabled = false;
      }

      state.runtime = {
        sdk: sdk,
        app: app,
        auth: auth,
        functions: functions,
        db: db,
        exchange: sdk.httpsCallable(functions, "exchangeLegacySession"),
        syncClassroom: sdk.httpsCallable(functions, "syncClassroomRealtimeSnapshot"),
        syncRoom: sdk.httpsCallable(functions, "syncRoomRealtimeSnapshot"),
        commitClassroom: sdk.httpsCallable(functions, "commitClassroomUsageFirestoreFirst"),
        releaseClassroom: sdk.httpsCallable(functions, "releaseClassroomUsageFirestoreFirst"),
        updateClassroom: sdk.httpsCallable(functions, "updateClassroomUsageSlotFirestoreFirst"),
        listClassroomSheetJobs: sdk.httpsCallable(functions, "listPendingClassroomSheetSyncJobs"),
        completeClassroomSheetJob: sdk.httpsCallable(functions, "completeClassroomSheetSyncJob"),
        noteClassroomSheetFailure: sdk.httpsCallable(functions, "noteClassroomSheetSyncFailure"),
        beginCanonicalClassroomMutation: sdk.httpsCallable(functions, "beginClassroomSheetCanonicalMutation"),
        finalizeCanonicalClassroomMutation: sdk.httpsCallable(functions, "finalizeClassroomSheetCanonicalMutation"),
        abortCanonicalClassroomMutation: sdk.httpsCallable(functions, "abortClassroomSheetCanonicalMutation")
      };
      return state.runtime;
    })();

    try {
      return await state.runtimePromise;
    } finally {
      state.runtimePromise = null;
    }
  }

  function acceptLoginProof72911(bundle) {
    if (staffExplicitLogoutActive72913()) return false;
    bundle = bundle && typeof bundle === "object" ? bundle : {};
    const proof = String(bundle.proof || bundle.firebaseLoginProof || "").trim();
    const expiresAt = Number(bundle.expiresAt || bundle.firebaseProofExpiresAt || 0);
    const sessionType = String(bundle.sessionType || "admin").trim();
    const sessionToken = String(bundle.sessionToken || bundle.adminToken || "").trim();
    if (!proof || !sessionToken || !expiresAt || expiresAt * 1000 <= Date.now() + 5000) return false;
    state.preissuedProof = {
      proof: proof,
      expiresAt: expiresAt,
      sessionType: sessionType,
      sessionToken: sessionToken
    };
    return true;
  }

  function consumeLoginProof72911(session) {
    const bundle = state.preissuedProof;
    if (!bundle || !session) return "";
    if (Number(bundle.expiresAt || 0) * 1000 <= Date.now() + 3000) {
      state.preissuedProof = null;
      return "";
    }
    if (String(bundle.sessionType || "") !== String(session.type || "")) return "";
    const token = String(session.token || "").trim();
    if (!token || token !== String(bundle.sessionToken || "")) return "";
    state.preissuedProof = null;
    return String(bundle.proof || "");
  }

  async function requestFreshProof(session) {
    const bundledProof = consumeLoginProof72911(session);
    if (bundledProof) return bundledProof;

    const response = await fetch(currentGasEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ action: "issueFirebaseLoginProof" }, session.payload)),
      credentials: "omit",
      cache: "no-store"
    });
    const data = await response.json();
    if (!data || data.status !== "success" || !data.proof) {
      throw new Error((data && data.message) || "Firebase 인증 proof 발급 실패");
    }
    return String(data.proof);
  }


  async function signInLegacySessionFresh(reason) {
    if (staffExplicitLogoutActive72913()) {
      resetRealtimeForStaffLogout72913();
      return null;
    }
    const session = await waitForLegacySession72909(8000);
    if (staffExplicitLogoutActive72913()) {
      resetRealtimeForStaffLogout72913();
      return null;
    }
    if (!session) throw new Error("교직원 로그인 세션 복원이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.");
    const fingerprint = await sha256(session.type + "|" + session.token);
    const runtime = await createRuntime();

    try {
      if (runtime.auth.currentUser) await runtime.sdk.signOut(runtime.auth);
    } catch (_ignore) {}
    try { localStorage.removeItem(SESSION_FINGERPRINT_KEY); } catch (_ignore) {}

    setStatus("connecting", "실시간 인증 갱신 중...");
    const proof = await requestFreshProof(session);
    const exchangeResult = await runtime.exchange({ proof: proof });
    const customToken = exchangeResult && exchangeResult.data && exchangeResult.data.customToken;
    if (!customToken) throw new Error("Firebase custom token 발급 실패");
    const credential = await runtime.sdk.signInWithCustomToken(runtime.auth, customToken);
    if (!credential || !credential.user) throw new Error("Firebase 교직원 로그인 실패");
    await getStableIdToken72915(runtime, false, "custom-token-signin");

    try { localStorage.setItem(SESSION_FINGERPRINT_KEY, fingerprint); } catch (_ignore) {}
    state.ready = true;
    state.sessionFingerprint = fingerprint;
    setStatus("ready", "실시간 연결됨");
    safeConsole("info", "[ULIM realtime auth refreshed]", reason || "manual", credential.user.uid);
    notifyAuthReady72909(runtime, reason || "manual");
    return runtime;
  }

  function primaryClaimsReady72912(tokenResult) {
    const claims = tokenResult && tokenResult.claims || {};
    const role = String(claims.role || "");
    const authVersion = claims.authVersion;
    if (!["student", "teacher", "admin", "superAdmin"].includes(role)) return false;
    if (!(typeof authVersion === "number" || (typeof authVersion === "string" && authVersion.length > 0))) return false;
    if (role === "teacher" && !String(claims.teacherUid || "")) return false;
    if (role === "student" && !String(claims.studentUid || "")) return false;
    return true;
  }

  async function acceptExistingFirebaseSession72912(runtime, reason, forceRefresh) {
    if (!runtime || !runtime.auth || !runtime.auth.currentUser) return null;
    const user = runtime.auth.currentUser;
    const tokenResult = await getStableIdTokenResult72915(runtime, forceRefresh === true, reason || "accept-existing");
    if (!primaryClaimsReady72912(tokenResult)) {
      const error = new Error("Firebase 계정 권한 토큰 갱신을 기다리는 중입니다.");
      error.code = "ULIM_PRIMARY_CLAIMS_NOT_READY";
      throw error;
    }
    resetStableTokenGuard72915(user.uid);
    state.ready = true;
    state.sessionFingerprint = "firebase-primary:" + String(user.uid || "");
    setStatus("ready", "실시간 연결됨");
    notifyAuthReady72909(runtime, reason || "firebase-primary");
    return runtime;
  }

  async function forceReauthenticate(reason) {
    if (staffExplicitLogoutActive72913()) {
      resetRealtimeForStaffLogout72913();
      return null;
    }
    if (state.signingIn) {
      try {
        const existing = await state.signingIn;
        if (existing && existing.auth && existing.auth.currentUser) {
          return await acceptExistingFirebaseSession72912(existing, reason || "forced-existing", true);
        }
      } catch (_ignore) {}
    }

    const runtime = await createRuntime();
    if (runtime.auth.currentUser) {
      try {
        return await acceptExistingFirebaseSession72912(runtime, reason || "forced-primary", true);
      } catch (primaryError) {
        safeConsole("warn", "[ULIM 7.29.13 primary token refresh failed]", primaryError);
      }
    }

    const pending = signInLegacySessionFresh(reason || "forced");
    state.signingIn = pending;
    try {
      return await pending;
    } finally {
      if (state.signingIn === pending) state.signingIn = null;
    }
  }

  async function ensureAuthenticated() {
    if (!ENABLED) return null;
    if (staffExplicitLogoutActive72913()) {
      resetRealtimeForStaffLogout72913();
      return null;
    }
    if (state.signingIn) return state.signingIn;

    state.signingIn = (async function () {
      /*
       * 7.29.13 Firebase-primary login:
       * Firebase Auth persistence is now checked before the legacy GAS session.
       * This lets Firestore-backed staff features open immediately while the
       * GAS compatibility session is prepared in the background.
       */
      if (staffExplicitLogoutActive72913()) return null;
      const runtime = await createRuntime();
      if (staffExplicitLogoutActive72913()) return null;
      if (runtime.auth.currentUser) {
        try {
          return await acceptExistingFirebaseSession72912(runtime, "ensure-primary", false);
        } catch (primaryError) {
          if (primaryError && primaryError.code === "ULIM_PRIMARY_CLAIMS_NOT_READY") {
            setStatus("connecting", "Firebase 권한 토큰 갱신 중...");
            return null;
          }
          safeConsole("warn", "[ULIM 7.29.13 primary session rejected]", primaryError);
          try { await runtime.sdk.signOut(runtime.auth); } catch (_ignore) {}
        }
      }

      const session = await waitForLegacySession72909(8000);
      if (!session) {
        setStatus("waiting", "실시간: 로그인 세션 복원 대기");
        return null;
      }

      const fingerprint = await sha256(session.type + "|" + session.token);
      let storedFingerprint = "";
      try { storedFingerprint = localStorage.getItem(SESSION_FINGERPRINT_KEY) || ""; } catch (_ignore) {}

      if (runtime.auth.currentUser && storedFingerprint === fingerprint) {
        try {
          await getStableIdToken72915(runtime, false, "legacy-existing");
          state.ready = true;
          state.sessionFingerprint = fingerprint;
          setStatus("ready", "실시간 연결됨");
          notifyAuthReady72909(runtime, "ensure-legacy-existing");
          return runtime;
        } catch (tokenError) {
          safeConsole("warn", "[ULIM realtime stale token refresh]", tokenError);
        }
      }

      return signInLegacySessionFresh("ensure-authenticated");
    })().catch(function (error) {
      state.ready = false;
      setStatus("error", "실시간 연결 실패 · 기존 조회 유지");
      safeConsole("warn", "[ULIM realtime auth]", error);
      return null;
    }).finally(function () {
      state.signingIn = null;
    });

    return state.signingIn;
  }

  async function waitUntilAuthenticated72909(timeoutMs) {
    const deadline = Date.now() + Math.max(1000, Number(timeoutMs) || 12000);
    let lastRuntime = null;
    while (Date.now() < deadline) {
      try {
        lastRuntime = await ensureAuthenticated();
        if (lastRuntime && lastRuntime.auth && lastRuntime.auth.currentUser) {
          await getStableIdToken72915(lastRuntime, false, "wait-until-authenticated");
          return lastRuntime;
        }
      } catch (_ignore) {}
      await sleepAuth72909(120);
    }
    return lastRuntime;
  }

  function dateKeyFromClassroom() {
    try {
      if (typeof adminClassroomUsageDate_ === "function") return String(adminClassroomUsageDate_() || "");
    } catch (_ignore) {}
    const input = document.getElementById("adminClassroomUsageDate");
    return input ? String(input.value || "") : "";
  }

  function roomMonthKey() {
    try {
      if (typeof roomCurrentDate !== "undefined" && roomCurrentDate instanceof Date) {
        return roomCurrentDate.getFullYear() + "-" + String(roomCurrentDate.getMonth() + 1).padStart(2, "0");
      }
    } catch (_ignore) {}
    const now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  }

  function normalizeClassroomClaim7296(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    const startHour = Number(raw.startHour);
    const endHour = Number(raw.endHour);
    const expiresAtMs = Number(raw.expiresAtMs || 0);
    return {
      date: String(raw.date || ""),
      room: String(raw.room || ""),
      startHour: startHour,
      endHour: endHour,
      slotKey: String(raw.slotKey || ""),
      mutationId: String(raw.mutationId || ""),
      operation: String(raw.operation || "save"),
      requestedInstructor: String(raw.requestedInstructor || ""),
      className: String(raw.className || ""),
      memo: String(raw.memo || ""),
      createdByFirebaseUid: String(raw.createdByFirebaseUid || ""),
      createdByRole: String(raw.createdByRole || ""),
      createdAtMs: Number(raw.createdAtMs || 0),
      expiresAtMs: expiresAtMs
    };
  }

  function activeClassroomClaims7296(date) {
    const now = Date.now();
    const merged = Object.create(null);
    const remote = state.remoteClaimsByDate[date] || Object.create(null);
    const local = state.localClaimsByDate[date] || Object.create(null);
    Object.keys(remote).forEach(function (slotKey) {
      const claim = normalizeClassroomClaim7296(remote[slotKey]);
      if (claim.slotKey && claim.expiresAtMs > now) merged[slotKey] = claim;
    });
    Object.keys(local).forEach(function (slotKey) {
      const claim = normalizeClassroomClaim7296(local[slotKey]);
      if (claim.slotKey && claim.expiresAtMs > now) merged[slotKey] = claim;
    });
    return merged;
  }

  function renderMergedClassroom7296(date, summaryText) {
    if (dateKeyFromClassroom() !== date) return;
    const confirmed = sanitizeClassroomRecords(state.confirmedClassroomByDate[date] || [], date);
    const bySlot = Object.create(null);
    confirmed.forEach(function (record) {
      bySlot[classroomSlotSavingKey729(date, record.room, record.startHour)] = Object.assign({}, record);
    });

    const claims = activeClassroomClaims7296(date);
    state.pendingSlotStateByDate[date] = claims;
    Object.keys(claims).forEach(function (slotKey) {
      const claim = claims[slotKey];
      const key = classroomSlotSavingKey729(date, claim.room, claim.startHour);
      const existing = bySlot[key] || null;
      if (claim.operation === "release") {
        if (existing) {
          bySlot[key] = Object.assign({}, existing, {
            pendingRealtime: true,
            pendingOperation: "release",
            pendingMutationId: claim.mutationId
          });
        }
        return;
      }
      bySlot[key] = {
        recordId: "PENDING|" + claim.mutationId + "|" + claim.startHour,
        date: date,
        room: claim.room,
        startHour: claim.startHour,
        endHour: claim.endHour,
        instructor: claim.requestedInstructor,
        className: claim.className,
        purpose: claim.className,
        status: "사용중",
        memo: claim.memo,
        sheetName: "",
        pendingRealtime: true,
        pendingOperation: claim.operation,
        pendingMutationId: claim.mutationId
      };
    });

    try {
      adminClassroomUsageRows = Object.keys(bySlot).map(function (key) { return bySlot[key]; });
      adminClassroomUsageLoadedDate = date;
      if (typeof adminRenderClassroomUsageTable === "function") adminRenderClassroomUsageTable();
      const summary = document.getElementById("adminClassroomUsageSummary");
      if (summary && summaryText) summary.textContent = summaryText;
    } catch (error) {
      safeConsole("warn", "[ULIM classroom 7.29.6 merged render]", error);
    }
  }

  function putLocalClaims7296(date, claims) {
    if (!state.localClaimsByDate[date]) state.localClaimsByDate[date] = Object.create(null);
    (claims || []).forEach(function (claim) {
      const normalized = normalizeClassroomClaim7296(claim);
      state.localClaimsByDate[date][normalized.slotKey] = normalized;
    });
    renderMergedClassroom7296(date);
  }

  function removeLocalClaims7296(date, mutationId) {
    const local = state.localClaimsByDate[date] || Object.create(null);
    Object.keys(local).forEach(function (slotKey) {
      if (String(local[slotKey] && local[slotKey].mutationId || "") === String(mutationId || "")) {
        delete local[slotKey];
      }
    });
    renderMergedClassroom7296(date);
  }

  global.ulimClassroomPendingState7296_ = function (date, room, hour) {
    const claims = state.pendingSlotStateByDate[String(date || "")] || Object.create(null);
    return claims[classroomSlotSavingKey729(date, room, hour)] || null;
  };

  async function subscribeClassroom(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return { exists: false };
    hydrateClassroomFastCache7297(date);
    const runtime = await ensureAuthenticated();
    if (!runtime) return { exists: false };
    const firstEntry = classroomFirstSnapshotEntry7297(date);
    if (state.classroomDate === date && state.classroomUnsubscribe && state.classroomClaimsUnsubscribe) {
      return firstEntry.promise;
    }
    if (state.classroomUnsubscribe) state.classroomUnsubscribe();
    if (state.classroomClaimsUnsubscribe) state.classroomClaimsUnsubscribe();
    state.classroomDate = date;

    const ref = runtime.sdk.doc(runtime.db, "realtimeClassroomDays", date);
    state.classroomUnsubscribe = runtime.sdk.onSnapshot(
      ref,
      { includeMetadataChanges: true },
      function (snapshot) {
        const fromCache = !!(snapshot.metadata && snapshot.metadata.fromCache);
        if (!snapshot.exists()) {
          if (!fromCache) settleClassroomFirstSnapshot7297(date, { exists: false, fromCache: false });
          return;
        }
        const data = snapshot.data() || {};
        if (!Array.isArray(data.records)) {
          if (!fromCache) settleClassroomFirstSnapshot7297(date, { exists: false, fromCache: false });
          return;
        }
        state.confirmedClassroomByDate[date] = data.records.map(function (record) {
          return Object.assign({}, record);
        });
        if (data.sheetRevision) state.lastSheetRevisionByDate[date] = String(data.sheetRevision);
        state.lastSheetSignatureByDate[date] = recordsSignature(data.records);
        state.classroomBaselineReady[date] = true;
        writeClassroomFastCache7297(date, data.records, data.sheetRevision);
        renderMergedClassroom7296(
          date,
          Date.now() >= state.suppressRealtimeSummaryUntil
            ? (fromCache
              ? "최근 시트 확정 현황을 즉시 표시했습니다 · 서버 확인 중"
              : "시트 확정값과 진행 중 작업이 실시간 반영됐습니다.")
            : ""
        );
        setStatus(
          fromCache ? "connecting" : "ready",
          fromCache
            ? "빠른 현황 표시 · 서버 최신값 확인 중"
            : "Google Sheets 원본 · 실시간 연결됨"
        );
        settleClassroomFirstSnapshot7297(date, {
          exists: true,
          fromCache: fromCache,
          revision: String(data.sheetRevision || "")
        });
      },
      function (error) {
        settleClassroomFirstSnapshot7297(date, { exists: hasClassroomDisplayData7297(date), error: error });
        setStatus("error", "실시간 수신 실패 · 시트 조회 유지");
        safeConsole("warn", "[ULIM classroom realtime listener]", error);
      }
    );

    const claimsRef = runtime.sdk.collection(runtime.db, "classroomSlotClaims");
    const claimsQuery = runtime.sdk.query(claimsRef, runtime.sdk.where("date", "==", date));
    state.classroomClaimsUnsubscribe = runtime.sdk.onSnapshot(claimsQuery, function (snapshot) {
      const claims = Object.create(null);
      let nearestExpiry = 0;
      snapshot.docs.forEach(function (docSnapshot) {
        const claim = normalizeClassroomClaim7296(docSnapshot.data() || {});
        if (!claim.slotKey) return;
        claims[claim.slotKey] = claim;
        if (claim.expiresAtMs > Date.now() && (!nearestExpiry || claim.expiresAtMs < nearestExpiry)) {
          nearestExpiry = claim.expiresAtMs;
        }
      });
      state.remoteClaimsByDate[date] = claims;
      renderMergedClassroom7296(date);
      if (nearestExpiry) {
        setTimeout(function () { renderMergedClassroom7296(date); }, Math.max(50, nearestExpiry - Date.now() + 50));
      }
    }, function (error) {
      safeConsole("warn", "[ULIM classroom claim listener]", error);
    });

    return firstEntry.promise;
  }

  async function subscribeRoomMonth(month) {
    if (!/^\d{4}-\d{2}$/.test(String(month || ""))) return;
    const runtime = await ensureAuthenticated();
    if (!runtime) return;
    if (state.roomMonth === month && state.roomUnsubscribe) return;
    if (state.roomUnsubscribe) state.roomUnsubscribe();
    state.roomMonth = month;

    const ref = runtime.sdk.doc(runtime.db, "realtimeRoomMonths", month);
    state.roomUnsubscribe = runtime.sdk.onSnapshot(ref, function (snapshot) {
      state.roomMonthData = snapshot.exists() ? (snapshot.data() || {}) : null;
      try {
        if (typeof buildRoomReservationIndexes === "function") buildRoomReservationIndexes();
        if (typeof renderCurrentRoomReservationView === "function") renderCurrentRoomReservationView();
        setStatus("ready", "실시간 연결됨");
      } catch (error) {
        safeConsole("warn", "[ULIM room realtime render]", error);
      }
    }, function (error) {
      setStatus("error", "실시간 수신 실패 · 기존 조회 유지");
      safeConsole("warn", "[ULIM room realtime listener]", error);
    });
  }

  function applyRoomRealtimeOverlay() {
    const data = state.roomMonthData;
    if (!data) return;

    const reservations = Array.isArray(data.reservations) ? data.reservations : [];
    const classroomByDate = data.classroomByDate && typeof data.classroomByDate === "object" ? data.classroomByDate : {};
    const counted = new Set();

    reservations.forEach(function (record) {
      const date = String(record.date || "");
      const room = String(record.room || "");
      const start = Number(record.startHour);
      const end = Number(record.endHour);
      if (!date || !room || !Number.isInteger(start) || !Number.isInteger(end) || end <= start) return;

      let added = false;
      for (let hour = start; hour < end; hour += 1) {
        const key = getRoomSlotKey(date, room, hour);
        if (!roomReservationMap[key]) {
          roomReservationMap[key] = {
            id: "",
            date: date,
            room: room,
            startHour: hour,
            endHour: hour + 1,
            status: "예약완료",
            mine: false,
            pending: false,
            realtime: true
          };
          added = true;
        }
      }
      const countKey = String(record.id || [date, room, start, end].join("|"));
      if (added && !counted.has(countKey)) {
        counted.add(countKey);
        roomReservationCountByDate[date] = Number(roomReservationCountByDate[date] || 0) + 1;
      }
    });

    Object.keys(classroomByDate).forEach(function (date) {
      const records = Array.isArray(classroomByDate[date]) ? classroomByDate[date] : [];
      records.forEach(function (record) {
        const room = String(record.room || "");
        const start = Number(record.startHour);
        const end = Number(record.endHour);
        if (!room || !Number.isInteger(start) || !Number.isInteger(end) || end <= start) return;
        for (let hour = start; hour < end; hour += 1) {
          const key = getRoomSlotKey(date, room, hour);
          roomBlockedMap[key] = {
            date: date,
            room: room,
            startHour: hour,
            endHour: hour + 1,
            reason: "수업중",
            realtime: true
          };
        }
      });
    });
  }

  function wrapRoomIndexBuilder() {
    if (state.roomIndexWrapped || typeof buildRoomReservationIndexes !== "function") return;
    const original = buildRoomReservationIndexes;
    buildRoomReservationIndexes = function () {
      const result = original.apply(this, arguments);
      applyRoomRealtimeOverlay();
      return result;
    };
    state.roomIndexWrapped = true;
  }

  function sanitizeClassroomRecords(records, date) {
    return (Array.isArray(records) ? records : []).map(function (record) {
      return {
        recordId: String(record.recordId || ""),
        date: date,
        room: String(record.room || ""),
        startHour: Number(record.startHour),
        endHour: Number(record.endHour),
        instructor: String(record.instructor || record.adminName || ""),
        className: String(record.className || record.purpose || ""),
        purpose: String(record.purpose || record.className || ""),
        status: "사용중",
        memo: String(record.memo || ""),
        sheetName: String(record.sheetName || "")
      };
    }).filter(function (record) {
      return record.room && Number.isInteger(record.startHour) && Number.isInteger(record.endHour) && record.endHour > record.startHour;
    });
  }

  function sanitizeRoomReservations(records, month) {
    return (Array.isArray(records) ? records : []).map(function (record) {
      return {
        id: String(record.id || record.reservationId || ""),
        date: String(record.date || ""),
        room: String(record.room || ""),
        startHour: Number(record.startHour),
        endHour: Number(record.endHour),
        status: String(record.status || "예약완료")
      };
    }).filter(function (record) {
      const status = record.status.replace(/\s+/g, "");
      return record.date.indexOf(month + "-") === 0 && record.room && Number.isInteger(record.startHour) && Number.isInteger(record.endHour) && record.endHour > record.startHour && status !== "취소" && status !== "사용완료";
    });
  }

  async function publishClassroomSnapshot(reason, options) {
    options = options || {};
    const date = String(options.date || dateKeyFromClassroom() || "");
    if (!date) return null;
    const runtime = await ensureAuthenticated();
    if (!runtime) {
      if (options.strict) throw new Error("Firebase 실시간 인증이 준비되지 않았습니다.");
      return null;
    }
    const sourceRecords = options.records ||
      (typeof adminClassroomUsageRows !== "undefined" ? adminClassroomUsageRows : []);
    const records = sanitizeClassroomRecords(sourceRecords, date);
    try {
      const response = await runtime.syncClassroom({
        date: date,
        records: records,
        observedAtMs: Date.now(),
        requestId: makeRequestId("CLASSROOM-" + String(reason || "SYNC")),
        sheetRevision: String(options.revision || state.lastSheetRevisionByDate[date] || "")
      });
      state.classroomBaselineReady[date] = true;
      return response && response.data || null;
    } catch (error) {
      safeConsole("warn", "[ULIM classroom realtime publish]", error);
      if (options.strict) throw error;
      return null;
    }
  }

  async function publishRoomSnapshot(reason) {
    const month = roomMonthKey();
    const runtime = await ensureAuthenticated();
    if (!runtime) return;
    const reservations = sanitizeRoomReservations(
      typeof roomReservations !== "undefined" ? roomReservations : [],
      month
    );
    try {
      await runtime.syncRoom({
        month: month,
        reservations: reservations,
        observedAtMs: Date.now(),
        requestId: makeRequestId("ROOM-" + String(reason || "SYNC"))
      });
    } catch (error) {
      safeConsole("warn", "[ULIM room realtime publish]", error);
    }
  }

  function currentAdminToken727() {
    try {
      if (typeof adminToken !== "undefined" && String(adminToken || "").trim()) {
        return String(adminToken || "").trim();
      }
    } catch (_ignore) {}
    try {
      return String(
        localStorage.getItem("adminToken") ||
        sessionStorage.getItem("adminToken") ||
        ""
      ).trim();
    } catch (_ignore) {
      return "";
    }
  }

  function currentAdminDisplayName727() {
    try {
      if (typeof adminInfo !== "undefined" && adminInfo) {
        return String(adminInfo.name || adminInfo.id || "").trim();
      }
    } catch (_ignore) {}
    return "";
  }

  function callableData727(response) {
    return response && response.data ? response.data : response;
  }

  function callableMessage727(error) {
    const message = error && (error.message || error.details && error.details.message);
    return String(message || "").replace(/^FirebaseError:\s*/i, "").trim();
  }

  function classroomGroupsToSlots727(date, groups) {
    const slots = [];
    (groups || []).forEach(function (group) {
      for (let hour = Number(group.startHour); hour < Number(group.endHour); hour += 1) {
        slots.push({ date: date, room: group.room, hour: hour });
      }
    });
    return slots;
  }

  function collectClassroomRequest729() {
    if (typeof adminInitClassroomUsagePanel === "function") {
      adminInitClassroomUsagePanel();
    }

    const date = dateKeyFromClassroom();
    const room = String(document.getElementById("adminClassroomUsageRoom")?.value || "").trim();
    const startHour = Number(document.getElementById("adminClassroomUsageStart")?.value || 0);
    const endHour = Number(document.getElementById("adminClassroomUsageEnd")?.value || 0);
    const assignedInstructor = String(
      document.getElementById("adminClassroomUsageInstructor")?.value ||
      currentAdminDisplayName727() || ""
    ).trim();
    const className = String(document.getElementById("adminClassroomUsageClass")?.value || "").trim();
    const memo = String(document.getElementById("adminClassroomUsageMemo")?.value || "").trim();

    if (!date || !room || !Number.isInteger(startHour) || !Number.isInteger(endHour)) {
      throw new Error("사용일·강의실·시간을 확인해주세요.");
    }
    if (endHour <= startHour) throw new Error("종료시간은 시작시간보다 늦어야 합니다.");

    return {
      date,
      assignedInstructor,
      className,
      memo,
      selectedSlots: Array.from({ length: endHour - startHour }, (_, index) => ({
        date, room, hour: startHour + index
      })),
      groups: [{ room, startHour, endHour }]
    };
  }

  function classroomSlotSavingKey729(date, room, hour) {
    return [
      String(date || ""),
      String(room || "").replace(/\s+/g, ""),
      String(Number(hour))
    ].join("|");
  }

  function isClassroomSlotSaving729(date, room, hour) {
    const key = classroomSlotSavingKey729(date, room, hour);
    const pending = state.pendingSlotStateByDate[String(date || "")] || Object.create(null);
    return state.savingClassroomSlots.has(key) || !!pending[key];
  }

  global.ulimIsClassroomSlotSaving729_ = isClassroomSlotSaving729;

  async function ensureClassroomBaseline727(date) {
    let loadedDate = "";
    try {
      loadedDate = typeof adminClassroomUsageLoadedDate !== "undefined"
        ? String(adminClassroomUsageLoadedDate || "")
        : "";
    } catch (_ignore) {}
    if (loadedDate !== String(date || "")) {
      throw new Error("강의실 최신 현황을 먼저 불러와야 합니다.");
    }
    if (state.classroomBaselineReady[date]) return true;
    if (state.classroomBaselinePromises[date]) {
      await state.classroomBaselinePromises[date];
      return !!state.classroomBaselineReady[date];
    }

    const promise = publishClassroomSnapshot("BASELINE", {
      date: date,
      strict: true
    }).then(function () {
      state.classroomBaselineReady[date] = true;
      return true;
    }).finally(function () {
      delete state.classroomBaselinePromises[date];
    });

    state.classroomBaselinePromises[date] = promise;
    await promise;
    return true;
  }

  function applyClassroomCommitResult727(date, request, result) {
    if (Array.isArray(result.records)) {
      try {
        adminClassroomUsageRows = result.records.map(function (record) {
          return Object.assign({}, record);
        });
        adminClassroomUsageLoadedDate = date;
      } catch (_ignore) {}
    }

    const accepted = Array.isArray(result.accepted) ? result.accepted : [];
    const conflicts = Array.isArray(result.conflicts) ? result.conflicts : [];
    if (typeof adminRenderClassroomUsageTable === "function") {
      adminRenderClassroomUsageTable();
    }

    const summary = document.getElementById("adminClassroomUsageSummary");
    if (summary) {
      summary.textContent =
        "시간칸 저장 " + accepted.length + "건" +
        (conflicts.length ? " · 다른 사용자가 먼저 저장한 칸 " + conflicts.length + "건 제외" : "") +
        (accepted.length ? " · 시트 백그라운드 동기화 중" : "");
    }


    if (conflicts.length) {
      const detail = conflicts.map(function (item) {
        const start = typeof adminFormatClassroomHour_ === "function"
          ? adminFormatClassroomHour_(item.startHour)
          : String(item.startHour) + ":00";
        const end = typeof adminFormatClassroomHour_ === "function"
          ? adminFormatClassroomHour_(item.endHour)
          : String(item.endHour) + ":00";
        return item.room + " " + start + "~" + end;
      }).join("\n");
      alert(
        "다른 사용자가 먼저 저장한 시간칸은 그대로 유지했습니다.\n\n" + detail +
        (accepted.length ? "\n\n나머지 시간칸은 정상 저장됐습니다." : "")
      );
    }
  }

  async function fallbackLegacyClassroomSave727(silentConfirm, forceOverride, error) {
    safeConsole("warn", "[ULIM classroom 7.29.5 fallback to GAS]", error);
    setStatus("connecting", "빠른 저장 전환 실패 · 기존 저장 사용");
    if (typeof state.legacyClassroomSave !== "function") {
      throw error || new Error("기존 강의실 저장 함수를 찾지 못했습니다.");
    }
    const result = await state.legacyClassroomSave.call(global, true, !!forceOverride);
    await publishClassroomSnapshot("LEGACY-FALLBACK");
    await subscribeClassroom(dateKeyFromClassroom());
    setStatus("ready", "실시간 연결됨");
    return result;
  }


  function classroomSheetConflict7295(result) {
    const outcome = String(result && result.outcome || "");
    return !!(result && result.conflict) ||
      outcome === "occupied_by_other" ||
      /이미\s*사용|다른\s*강사.*먼저|중복\s*체크/i.test(String(result && result.message || ""));
  }

  function applyAuthoritativeClassroomRows7295(date, records, summaryText) {
    const normalized = sanitizeClassroomRecords(records, date);
    state.confirmedClassroomByDate[date] = normalized.map(function (record) {
      return Object.assign({}, record);
    });
    state.lastSheetSignatureByDate[date] = recordsSignature(normalized);
    state.classroomBaselineReady[date] = true;
    writeClassroomFastCache7297(date, normalized, state.lastSheetRevisionByDate[date]);
    try {
      renderMergedClassroom7296(date, summaryText || "");
    } catch (_ignore) {}
    return normalized;
  }

  async function mirrorSheetAuthorityToFirestore7295(date, records, reason, revision) {
    state.suppressRealtimeSummaryUntil = Date.now() + 1500;
    const result = await publishClassroomSnapshot(reason || "SHEET-AUTHORITY", {
      date: date,
      records: records,
      strict: true,
      revision: String(revision || state.lastSheetRevisionByDate[date] || "")
    });
    if (result && result.accepted === false) {
      throw new Error("시트 기준 Firestore 반영이 최신 요청과 충돌했습니다. 다시 동기화합니다.");
    }
    state.classroomBaselineReady[date] = true;
    return result;
  }

  async function refreshClassroomFromSheet7295(date, options) {
    options = options || {};
    date = String(date || dateKeyFromClassroom() || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !currentAdminToken727()) return null;
    if (state.sheetAuthorityPromises[date]) return state.sheetAuthorityPromises[date];

    const promise = (async function () {
      state.sheetAuthorityLoading[date] = true;
      if (options.showOverlay && typeof showLoading === "function") {
        showLoading(options.loadingMessage || "Google Sheets 기준 현황 불러오는 중...");
      }

      try {
        let optionsPromise = null;
        if (options.loadOptions !== false && typeof global.adminLoadClassroomUsageOptions === "function") {
          try {
            optionsPromise = Promise.resolve(global.adminLoadClassroomUsageOptions(!!options.forceOptions));
            optionsPromise.catch(function () {});
          } catch (_ignore) {}
        }

        if (typeof global.adminApi !== "function") {
          throw new Error("Google Sheets 조회 API를 찾지 못했습니다.");
        }

        const data = await global.adminApi("adminGetClassroomUsage", {
          adminToken: currentAdminToken727(),
          date: date,
          noCache: "1",
          forceRefresh: "1",
          _: Date.now()
        });

        const records = sanitizeClassroomRecords(
          Array.isArray(data && data.records) ? data.records : [],
          date
        );
        if (data && data.revision) {
          state.lastSheetRevisionByDate[date] = String(data.revision);
        }
        const signature = recordsSignature(records);
        const changed = signature !== String(state.lastSheetSignatureByDate[date] || "");

        applyAuthoritativeClassroomRows7295(
          date,
          records,
          options.summaryText ||
            (data && data.message) ||
            (date + " · Google Sheets 기준 " + records.length + "건")
        );

        let mirrorError = null;
        if (options.forceMirror || changed || !state.classroomBaselineReady[date]) {
          try {
            await mirrorSheetAuthorityToFirestore7295(
              date,
              records,
              options.reason || "SHEET-REFRESH",
              data && data.revision
            );
          } catch (error) {
            mirrorError = error;
            state.classroomBaselineReady[date] = false;
            safeConsole("warn", "[ULIM classroom 7.29.5 sheet authority mirror]", error);
            setStatus("error", "시트 조회 완료 · 실시간 반영 재시도");
          }
        }

        await subscribeClassroom(date);
        if (!mirrorError) setStatus("ready", "Google Sheets 기준 · 실시간 연결됨");
        return { data: data, records: records, changed: changed, mirrorError: mirrorError };
      } finally {
        state.sheetAuthorityLoading[date] = false;
        if (options.showOverlay && typeof hideLoading === "function") {
          try { hideLoading(); } catch (_ignore) {}
        }
      }
    })().finally(function () {
      delete state.sheetAuthorityPromises[date];
    });

    state.sheetAuthorityPromises[date] = promise;
    return promise;
  }

  async function fastInitialClassroomLoad7297(date, options) {
    options = options || {};
    date = String(date || dateKeyFromClassroom() || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !currentAdminToken727()) return null;
    if (options.forceSheet === true) {
      return refreshClassroomFromSheet7295(date, {
        showOverlay: options.showOverlay !== false,
        forceMirror: true,
        forceOptions: true,
        reason: options.reason || "SHEET-MANUAL-LOAD"
      });
    }
    if (state.fastClassroomLoadPromises[date]) return state.fastClassroomLoadPromises[date];

    const promise = (async function () {
      const cached = hydrateClassroomFastCache7297(date);
      const alreadyDisplayed = cached || hasClassroomDisplayData7297(date);
      let overlayShown = false;
      if (options.showOverlay && !alreadyDisplayed && typeof showLoading === "function") {
        showLoading(options.loadingMessage || "강의실 빠른 현황 불러오는 중...");
        overlayShown = true;
      }

      try {
        if (typeof global.adminLoadClassroomUsageOptions === "function") {
          try {
            Promise.resolve(global.adminLoadClassroomUsageOptions(false)).catch(function () {});
          } catch (_ignore) {}
        }

        const firstSnapshotPromise = subscribeClassroom(date);

        if (alreadyDisplayed && String(state.lastSheetRevisionByDate[date] || "")) {
          checkClassroomSheetRevision7296(date).catch(function (error) {
            if (!(error && error.silent)) safeConsole("warn", "[ULIM classroom 7.29.14 fast revision check]", error);
          });
          return { source: cached ? "local-cache" : "memory", displayed: true };
        }

        const first = await Promise.race([
          firstSnapshotPromise,
          timeoutResult7297(CLASSROOM_FIRST_SNAPSHOT_WAIT_MS_7297)
        ]);

        if ((first && first.exists) || hasClassroomDisplayData7297(date)) {
          checkClassroomSheetRevision7296(date).catch(function (error) {
            if (!(error && error.silent)) safeConsole("warn", "[ULIM classroom 7.29.14 first revision check]", error);
          });
          return { source: first && first.fromCache ? "firestore-cache" : "firestore", displayed: true };
        }

        return await refreshClassroomFromSheet7295(date, {
          showOverlay: false,
          forceMirror: true,
          loadOptions: false,
          reason: options.reason || "SHEET-FIRST-SEED"
        });
      } finally {
        if (overlayShown && typeof hideLoading === "function") {
          try { hideLoading(); } catch (_ignore) {}
        }
      }
    })().finally(function () {
      delete state.fastClassroomLoadPromises[date];
    });

    state.fastClassroomLoadPromises[date] = promise;
    return promise;
  }

  function buildClassroomMutationSlots7296(date, room, startHour, endHour) {
    const slots = [];
    for (let hour = Number(startHour); hour < Number(endHour); hour += 1) {
      slots.push({
        date: date,
        room: room,
        startHour: hour,
        endHour: hour + 1,
        slotKey: classroomSlotSavingKey729(date, room, hour)
      });
    }
    return slots;
  }

  function mutationOperation7296(operation, payload) {
    if (String(operation || "") === "classroomReleaseSlot") return "release";
    if (String(payload && payload.override || "") === "1") return "update";
    return "save";
  }

  function makeLocalMutationClaims7296(mutationId, operation, payload, slots) {
    const now = Date.now();
    return slots.map(function (slot) {
      return {
        date: slot.date,
        room: slot.room,
        startHour: slot.startHour,
        endHour: slot.endHour,
        slotKey: slot.slotKey,
        mutationId: mutationId,
        operation: operation,
        requestedInstructor: String(payload.assignedInstructor || payload.instructor || ""),
        className: String(payload.className || payload.purpose || ""),
        memo: String(payload.memo || ""),
        createdAtMs: now,
        expiresAtMs: now + 65000
      };
    });
  }

  async function retryFinalizeCanonicalClassroom7296(runtime, request, attempts) {
    let lastError = null;
    for (let index = 0; index < attempts; index += 1) {
      try {
        return callableData727(await runtime.finalizeCanonicalClassroomMutation(request));
      } catch (error) {
        lastError = error;
        if (index + 1 < attempts) {
          await sleepClassroomSheet7294([250, 650, 1400][index] || 1800);
        }
      }
    }
    throw lastError || new Error("Firestore 최종 반영에 실패했습니다.");
  }

  function canonicalConflictMessage7296(error) {
    const details = error && error.details;
    const conflicts = details && Array.isArray(details.conflicts) ? details.conflicts : [];
    if (!conflicts.length) return callableMessage727(error);
    const first = conflicts[0] || {};
    const owner = String(first.occupiedBy || "다른 사용자");
    return String(first.room || "강의실") + " " + String(first.startHour || "") +
      ":00 시간 칸을 " + owner + "님이 처리 중입니다. 잠시 후 다시 시도해주세요.";
  }

  async function writeClassroomSheetFirst7295(operation, payload, date, reason) {
    payload = payload || {};
    date = String(date || payload.date || dateKeyFromClassroom() || "");
    const room = String(payload.room || "").trim();
    const startHour = Number(payload.startHour);
    const endHour = Number(payload.endHour);
    const canonicalOperation = mutationOperation7296(operation, payload);
    const mutationId = makeRequestId("SHEET-CANONICAL");
    const slots = buildClassroomMutationSlots7296(date, room, startHour, endHour);
    if (!slots.length) throw new Error("처리할 강의실 시간 칸이 없습니다.");

    const runtime = await ensureAuthenticated();
    if (!runtime) throw new Error("Firebase 실시간 인증이 준비되지 않았습니다.");

    const localClaims = makeLocalMutationClaims7296(mutationId, canonicalOperation, payload, slots);
    slots.forEach(function (slot) { state.savingClassroomSlots.add(slot.slotKey); });
    putLocalClaims7296(date, localClaims);
    const summary = document.getElementById("adminClassroomUsageSummary");
    if (summary) summary.textContent = "화면 반영 완료 · Google Sheets 최종 확인 중";

    let claimAccepted = false;
    let sheetResult = null;
    try {
      const begin = callableData727(await runtime.beginCanonicalClassroomMutation({
        mutationId: mutationId,
        date: date,
        operation: canonicalOperation,
        slots: slots,
        assignedInstructor: String(payload.assignedInstructor || payload.instructor || ""),
        className: String(payload.className || payload.purpose || ""),
        memo: String(payload.memo || ""),
        override: canonicalOperation === "update"
      }));
      claimAccepted = !!(begin && begin.ok);
      if (begin && begin.expiresAtMs) {
        localClaims.forEach(function (claim) { claim.expiresAtMs = Number(begin.expiresAtMs); });
        putLocalClaims7296(date, localClaims);
      }

      if (typeof global.adminApi !== "function") {
        throw new Error("Google Sheets 저장 API를 찾지 못했습니다.");
      }
      sheetResult = await global.adminApi("adminMutateClassroomSlotsFast", {
        adminToken: currentAdminToken727(),
        requestId: mutationId,
        operation: canonicalOperation,
        date: date,
        room: room,
        startHour: startHour,
        endHour: endHour,
        assignedInstructor: String(payload.assignedInstructor || payload.instructor || ""),
        className: String(payload.className || payload.purpose || ""),
        memo: String(payload.memo || ""),
        override: canonicalOperation === "update" ? "1" : "0",
        noCache: "1",
        _: Date.now()
      });
      if (!sheetResult || !Array.isArray(sheetResult.slots) || !sheetResult.receipt) {
        throw new Error(String(sheetResult && sheetResult.message || "Google Sheets 최종값을 확인하지 못했습니다."));
      }

      const finalized = await retryFinalizeCanonicalClassroom7296(runtime, {
        mutationId: mutationId,
        date: date,
        receipt: String(sheetResult.receipt)
      }, 3);
      const records = applyAuthoritativeClassroomRows7295(
        date,
        finalized && Array.isArray(finalized.records) ? finalized.records : [],
        classroomSheetConflict7295(sheetResult)
          ? "Google Sheets의 기존 기록을 우선 반영했습니다."
          : "Google Sheets 저장 완료 · 실시간 확정 완료"
      );
      if (sheetResult.revision) {
        state.lastSheetRevisionByDate[date] = String(sheetResult.revision);
      }
      setStatus("ready", "Google Sheets 원본 · 실시간 연결됨");
      return { result: sheetResult, records: records, mirrorError: null };
    } catch (error) {
      safeConsole("warn", "[ULIM classroom 7.29.6 canonical mutation]", error);
      if (claimAccepted) {
        /* A network error can occur after the sheet write. Re-read the canonical
         * sheet before releasing the claim so a completed write is never lost. */
        try {
          await refreshClassroomFromSheet7295(date, {
            showOverlay: false,
            forceMirror: true,
            loadOptions: false,
            reason: "CANONICAL-RECOVERY",
            summaryText: "Google Sheets 기준으로 복구 동기화했습니다."
          });
        } catch (refreshError) {
          safeConsole("warn", "[ULIM classroom 7.29.6 recovery refresh]", refreshError);
        }
        try {
          await runtime.abortCanonicalClassroomMutation({
            mutationId: mutationId,
            date: date,
            slots: slots
          });
        } catch (_ignore) {}
      }
      const code = String(error && error.code || "");
      if (/already-exists/i.test(code)) {
        throw new Error(canonicalConflictMessage7296(error) || "다른 사용자가 같은 시간 칸을 처리 중입니다.");
      }
      throw error;
    } finally {
      removeLocalClaims7296(date, mutationId);
      slots.forEach(function (slot) { state.savingClassroomSlots.delete(slot.slotKey); });
      renderMergedClassroom7296(date);
    }
  }

  function hasActiveClassroomMutation7296(date) {
    if (state.savingClassroomSlots.size) return true;
    return Object.keys(activeClassroomClaims7296(date)).length > 0;
  }

  async function checkClassroomSheetRevision7296(date) {
    date = String(date || dateKeyFromClassroom() || "");
    if (!date || !currentAdminToken727() || state.revisionPollInFlight) return null;
    if (hasActiveClassroomMutation7296(date)) return null;
    if (typeof global.adminApi !== "function") return null;
    state.revisionPollInFlight = true;
    try {
      const data = await global.adminApi("adminGetClassroomUsageRevision", {
        adminToken: currentAdminToken727(),
        date: date,
        noCache: "1",
        _: Date.now()
      });
      const revision = String(data && data.revision || "");
      if (!revision) return data;
      const previous = String(state.lastSheetRevisionByDate[date] || "");
      if (!previous) {
        state.lastSheetRevisionByDate[date] = revision;
        return data;
      }
      if (revision !== previous) {
        await refreshClassroomFromSheet7295(date, {
          showOverlay: false,
          forceMirror: true,
          loadOptions: false,
          reason: "SHEET-REVISION-CHANGED",
          summaryText: "Google Sheets 직접 수정사항을 실시간 반영했습니다."
        });
      }
      return data;
    } finally {
      state.revisionPollInFlight = false;
    }
  }

  async function saveClassroomFirestoreFirst727(silentConfirm, forceOverride) {
    if (state.classroomPrimarySaving) return;
    if (!currentAdminToken727()) return alert("로그인이 필요합니다.");

    let request;
    try {
      request = collectClassroomRequest729();
    } catch (error) {
      return alert(callableMessage727(error) || "강의실 사용정보를 확인해주세요.");
    }

    const group = request.groups && request.groups[0];
    if (!group) return alert("강의실과 시간을 확인해주세요.");

    if (!silentConfirm) {
      const actionText = forceOverride ? "배정/용도를 변경" : "사용 체크";
      if (!confirm([
        request.date,
        group.room + " " + group.startHour + ":00~" + group.endHour + ":00",
        "",
        "앱 화면에 즉시 " + actionText + "하고",
        "Google Sheets 최종값으로 자동 확정할까요?"
      ].join("\n"))) return;
    }

    state.classroomPrimarySaving = true;
    try {
      const output = await writeClassroomSheetFirst7295(
        "classroomSave",
        {
          date: request.date,
          room: group.room,
          startHour: group.startHour,
          endHour: group.endHour,
          assignedInstructor: request.assignedInstructor,
          className: request.className,
          memo: request.memo,
          override: forceOverride ? "1" : "0"
        },
        request.date,
        forceOverride ? "SHEET-ADMIN-UPDATE" : "SHEET-FORM-SAVE"
      );

      const result = output.result || {};
      const summary = document.getElementById("adminClassroomUsageSummary");
      if (classroomSheetConflict7295(result)) {
        if (summary) summary.textContent = "시트 기준 기존 사용자를 유지하고 앱 현황을 바로잡았습니다.";
        alert(result.message || "Google Sheets에 이미 사용 기록이 있어 기존 기록을 우선 반영했습니다.");
      } else if (summary) {
        summary.textContent = output.mirrorError
          ? "Google Sheets 저장 완료 · Firestore 실시간 반영 재시도 중"
          : "Google Sheets 저장 완료 · Firestore 실시간 반영 완료";
      }

      state.selectedClassroomRecordId = "";
      return result;
    } catch (error) {
      const message = callableMessage727(error) || "Google Sheets 저장에 실패했습니다.";
      const summary = document.getElementById("adminClassroomUsageSummary");
      if (summary) summary.textContent = "시트 저장 실패 · Firestore에는 기록하지 않았습니다.";
      safeConsole("warn", "[ULIM classroom 7.29.5 sheet-first form save]", error);
      alert(message);
      return null;
    } finally {
      state.classroomPrimarySaving = false;
    }
  }

  async function commitSingleClassroomSlot729(room, hour) {
    if (!currentAdminToken727()) return alert("로그인이 필요합니다.");

    const date = dateKeyFromClassroom();
    const numericHour = Number(hour);
    const normalizedRoom = String(room || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !normalizedRoom || !Number.isInteger(numericHour)) {
      return alert("사용일·강의실·시간을 확인해주세요.");
    }

    const savingKey = classroomSlotSavingKey729(date, normalizedRoom, numericHour);
    if (state.savingClassroomSlots.has(savingKey)) return;

    const assignedInstructor = String(
      document.getElementById("adminClassroomUsageInstructor")?.value ||
      currentAdminDisplayName727() || ""
    ).trim();
    const className = String(document.getElementById("adminClassroomUsageClass")?.value || "").trim();
    const memo = String(document.getElementById("adminClassroomUsageMemo")?.value || "").trim();

    state.savingClassroomSlots.add(savingKey);
    if (typeof adminRenderClassroomUsageTable === "function") adminRenderClassroomUsageTable();
    const summary = document.getElementById("adminClassroomUsageSummary");
    if (summary) {
      summary.textContent =
        normalizedRoom + " " + numericHour + ":00~" + (numericHour + 1) +
        ":00 · 화면 즉시 반영 · 시트 최종 확인 중";
    }

    try {
      const output = await writeClassroomSheetFirst7295(
        "classroomSave",
        {
          date: date,
          room: normalizedRoom,
          startHour: numericHour,
          endHour: numericHour + 1,
          assignedInstructor: assignedInstructor,
          className: className,
          memo: memo,
          override: "0"
        },
        date,
        "SHEET-QUICK-SAVE"
      );

      const result = output.result || {};
      if (classroomSheetConflict7295(result)) {
        if (summary) summary.textContent = "시트에 먼저 기록된 사용자를 우선 반영했습니다.";
        alert(result.message || "Google Sheets에 이미 사용 기록이 있습니다. 시트의 기존 기록을 반영했습니다.");
      } else if (summary) {
        summary.textContent = output.mirrorError
          ? "Google Sheets 저장 완료 · Firestore 반영 재시도 중"
          : "Google Sheets 저장 완료 · 다른 사용자 화면에 실시간 반영 완료";
      }
      setStatus("ready", "Google Sheets 기준 · 실시간 연결됨");
      return result;
    } catch (error) {
      const message = callableMessage727(error) || "Google Sheets 저장에 실패했습니다.";
      if (summary) summary.textContent = "시트 저장 실패 · Firestore에는 기록하지 않았습니다.";
      safeConsole("warn", "[ULIM classroom 7.29.5 sheet-first immediate save]", error);
      alert(message);
      await refreshClassroomFromSheet7295(date, {
        showOverlay: false,
        forceMirror: true,
        reason: "SHEET-SAVE-FAIL-REFRESH"
      }).catch(function () {});
      return null;
    } finally {
      state.savingClassroomSlots.delete(savingKey);
      if (typeof adminRenderClassroomUsageTable === "function") adminRenderClassroomUsageTable();
    }
  }

  global.ulimCommitClassroomSlot729_ = commitSingleClassroomSlot729;

  function scheduleKnownClassroomSheetJobs7294(runtime, jobs) {
    const queue = Array.isArray(jobs) ? jobs.filter(function (job) {
      return job && job.jobId;
    }) : [];
    if (!queue.length) {
      setTimeout(flushClassroomSheetSync727, 0);
      return;
    }
    setTimeout(async function () {
      for (const job of queue) {
        await processClassroomSheetJob727(runtime, job);
      }
      await flushClassroomSheetSync727();
    }, 0);
  }

  async function loadAuthoritativeClassroomRows727(date, result) {
    if (result && Array.isArray(result.records)) return result.records;
    if (typeof global.adminApi !== "function") {
      throw new Error("시트 최신 현황 조회 함수를 찾지 못했습니다.");
    }
    const data = await global.adminApi("adminGetClassroomUsage", {
      adminToken: currentAdminToken727(),
      date: date,
      forceRefresh: "Y",
      noCache: "Y"
    });
    return Array.isArray(data && data.records) ? data.records : [];
  }

  function sleepClassroomSheet7294(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function runClassroomSheetWrite7294(job, operation, payload) {
    if (typeof global.adminApi !== "function") {
      throw new Error("Google Sheets 저장 API를 찾지 못했습니다.");
    }

    const token = currentAdminToken727();
    if (!token) throw new Error("교직원 로그인이 필요합니다.");
    const requestId = String(job.requestId || job.jobId || makeRequestId("SHEET"));
    const requestFields = {
      adminToken: token,
      requestId: requestId,
      operation: operation,
      payloadJson: JSON.stringify(payload || {}),
      forceRetry: "0",
      noCache: "1",
      forceRefresh: "1"
    };

    /*
     * 7.29.4: 강의실 시트 기록은 숨은 iframe POST를 사용하지 않습니다.
     * 작은 강의실 payload는 GAS JSONP 경로로 직접 실행하여
     * script.googleusercontent.com 403 콘솔 오류와 POST 후 상태확인 지연을 제거합니다.
     */
    const direct = await global.adminApi("adminReliableWrite", requestFields);
    const directState = String(direct && direct.state || "");
    if (directState === "complete") return direct.result || {};
    if (directState === "failed") {
      throw new Error(String(direct.message || direct.result?.message || "Google Sheets 저장에 실패했습니다."));
    }

    /* 동일 requestId가 이미 처리 중인 드문 경우에만 완료 상태를 짧게 확인합니다. */
    const startedAt = Date.now();
    while (Date.now() - startedAt < 60000) {
      const statusData = await global.adminApi("adminGetReliableWriteStatus", {
        adminToken: token,
        requestIds: JSON.stringify([requestId]),
        noCache: "1",
        forceRefresh: "1"
      });
      const status = Array.isArray(statusData && statusData.jobs) ? statusData.jobs[0] : null;
      const stateValue = String(status && status.state || "");
      if (stateValue === "complete") return status.result || {};
      if (stateValue === "failed") {
        throw new Error(String(status.message || status.result?.message || "Google Sheets 저장에 실패했습니다."));
      }
      if (stateValue === "owner_mismatch") {
        throw new Error("저장 요청 계정과 현재 로그인 계정이 다릅니다. 다시 로그인해주세요.");
      }
      await sleepClassroomSheet7294(stateValue === "processing" ? 450 : 700);
    }
    throw new Error("Google Sheets 저장 완료 확인 시간이 초과되었습니다.");
  }

  async function processClassroomSheetJob727(runtime, job) {
    if (!job || !job.jobId || state.sheetSyncInFlight.has(job.jobId)) return;
    if (typeof global.adminApi !== "function") return;
    state.sheetSyncInFlight.add(job.jobId);

    try {
      const operation = String(job.operation || "save");
      const gasOperation = operation === "release"
        ? "classroomReleaseSlot"
        : "classroomSave";
      const payload = Object.assign({}, job.payload || {});
      if (operation === "update") payload.override = "1";
      const result = await runClassroomSheetWrite7294(job, gasOperation, payload);
      const records = await loadAuthoritativeClassroomRows727(job.date, result);
      const completed = await runtime.completeClassroomSheetJob({
        jobId: job.jobId,
        date: job.date,
        records: records,
        observedAtMs: Date.now()
      });
      const completedData = callableData727(completed) || {};
      if (job.date === dateKeyFromClassroom() && Array.isArray(completedData.records)) {
        try {
          adminClassroomUsageRows = completedData.records.map(function (record) {
            return Object.assign({}, record);
          });
          adminClassroomUsageLoadedDate = job.date;
          if (typeof adminRenderClassroomUsageTable === "function") {
            adminRenderClassroomUsageTable();
          }
        } catch (_ignore) {}
      }
      state.sheetSyncRerunRequested = true;
      const summary = document.getElementById("adminClassroomUsageSummary");
      if (summary && String(job.date || "") === String(dateKeyFromClassroom() || "")) {
        summary.textContent = "Firestore 및 Google Sheets 저장 완료";
      }
      setStatus("ready", "실시간 연결됨 · 시트 동기화 완료");
    } catch (error) {
      safeConsole("warn", "[ULIM classroom 7.29.5 sheet sync]", error);
      try {
        await runtime.noteClassroomSheetFailure({
          jobId: job.jobId,
          message: callableMessage727(error).slice(0, 500)
        });
      } catch (_ignore) {}
      const summary = document.getElementById("adminClassroomUsageSummary");
      if (summary && String(job.date || "") === String(dateKeyFromClassroom() || "")) {
        summary.textContent = "Firestore 저장 완료 · Google Sheets 재전송 대기";
      }
      setStatus("ready", "Firestore 저장 · 시트 재전송 대기");
    } finally {
      state.sheetSyncInFlight.delete(job.jobId);
    }
  }

  async function flushClassroomSheetSync727() {
    if (state.sheetSyncRunning || !navigator.onLine || !currentAdminToken727()) return;
    state.sheetSyncRunning = true;
    state.sheetSyncRerunRequested = false;
    try {
      const runtime = await ensureAuthenticated();
      if (!runtime || typeof global.adminApi !== "function") return;
      const response = await runtime.listClassroomSheetJobs({ limit: 8 });
      const data = callableData727(response) || {};
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      for (const job of jobs) {
        await processClassroomSheetJob727(runtime, job);
      }
    } catch (error) {
      safeConsole("warn", "[ULIM classroom 7.29.5 pending sheet jobs]", error);
    } finally {
      const rerun = state.sheetSyncRerunRequested;
      state.sheetSyncRerunRequested = false;
      state.sheetSyncRunning = false;
      if (rerun) setTimeout(flushClassroomSheetSync727, 0);
    }
  }

  function recordsSignature(value) {
    try {
      return JSON.stringify(value || []);
    } catch (_ignore) {
      return String(Date.now());
    }
  }

  function installWrappers() {
    if (state.wrappersInstalled) return;
    state.wrappersInstalled = true;
    wrapRoomIndexBuilder();

    if (typeof global.adminLoadClassroomUsage === "function") {
      state.legacyClassroomLoad = global.adminLoadClassroomUsage;
      global.adminLoadClassroomUsage = async function (showOverlay, forceSheet) {
        const date = dateKeyFromClassroom();
        return fastInitialClassroomLoad7297(date, {
          showOverlay: showOverlay !== false,
          forceSheet: forceSheet === true,
          reason: forceSheet === true ? "SHEET-MANUAL-LOAD" : "FAST-PANEL-LOAD"
        });
      };
    }

    if (typeof global.adminSaveClassroomUsageFromForm === "function") {
      state.legacyClassroomSave = global.adminSaveClassroomUsageFromForm;
      global.adminSaveClassroomUsageFromForm = saveClassroomFirestoreFirst727;
    }

    if (typeof global.adminSelectClassroomUsageRecord === "function") {
      const originalSelectClassroom = global.adminSelectClassroomUsageRecord;
      global.adminSelectClassroomUsageRecord = function (recordId) {
        state.selectedClassroomRecordId = String(recordId || "");
        return originalSelectClassroom.apply(this, arguments);
      };
    }

    if (typeof global.adminReleaseClassroomUsage === "function") {
      state.legacyClassroomRelease = global.adminReleaseClassroomUsage;
      global.adminReleaseClassroomUsage = async function (recordId) {
        const rows = typeof adminClassroomUsageRows !== "undefined" ? adminClassroomUsageRows : [];
        const record = (rows || []).find(function (item) {
          return String(item.recordId || "") === String(recordId || "");
        });
        if (!record) {
          await refreshClassroomFromSheet7295(dateKeyFromClassroom(), {
            showOverlay: false,
            forceMirror: true,
            reason: "SHEET-RELEASE-MISSING-REFRESH"
          }).catch(function () {});
          return alert("시트 기준 해제할 기록을 찾지 못했습니다. 현황을 새로고침했습니다.");
        }

        const startHour = Number(record.startHour);
        const endHour = Number(record.endHour);
        if (!Number.isInteger(startHour) || endHour !== startHour + 1) {
          return alert("강의실 해제는 한 시간 칸씩 처리합니다.");
        }
        if (!confirm(
          String(record.room || "") + " " + startHour + ":00~" + endHour +
          ":00\n\nGoogle Sheets에서 이 한 시간 칸을 먼저 해제할까요?"
        )) return;

        state.classroomPrimarySaving = true;
        try {
          const output = await writeClassroomSheetFirst7295(
            "classroomReleaseSlot",
            {
              date: dateKeyFromClassroom(),
              room: record.room,
              startHour: startHour,
              endHour: endHour
            },
            dateKeyFromClassroom(),
            "SHEET-RELEASE"
          );
          const summary = document.getElementById("adminClassroomUsageSummary");
          if (summary) {
            summary.textContent = output.mirrorError
              ? "Google Sheets 해제 완료 · Firestore 반영 재시도 중"
              : "Google Sheets 해제 완료 · Firestore 실시간 반영 완료";
          }
          return output.result;
        } catch (error) {
          const summary = document.getElementById("adminClassroomUsageSummary");
          if (summary) summary.textContent = "시트 해제 실패 · Firestore에는 변경하지 않았습니다.";
          alert(callableMessage727(error) || "Google Sheets 해제에 실패했습니다.");
          return null;
        } finally {
          state.classroomPrimarySaving = false;
        }
      };
    }

    if (typeof global.loadRoomReservations === "function") {
      const originalLoadRoom = global.loadRoomReservations;
      global.loadRoomReservations = async function () {
        const result = await originalLoadRoom.apply(this, arguments);
        await subscribeRoomMonth(roomMonthKey());
        return result;
      };
    }

    if (typeof global.changeRoomMonth === "function") {
      const originalChangeRoomMonth = global.changeRoomMonth;
      global.changeRoomMonth = function () {
        const result = originalChangeRoomMonth.apply(this, arguments);
        setTimeout(function () { subscribeRoomMonth(roomMonthKey()); }, 0);
        return result;
      };
    }

    if (typeof global.reserveRoomSlot === "function") {
      const originalReserveRoom = global.reserveRoomSlot;
      global.reserveRoomSlot = async function () {
        const before = recordsSignature(typeof roomReservations !== "undefined" ? roomReservations : []);
        const result = await originalReserveRoom.apply(this, arguments);
        const after = recordsSignature(typeof roomReservations !== "undefined" ? roomReservations : []);
        if (before !== after) await publishRoomSnapshot("RESERVE");
        await subscribeRoomMonth(roomMonthKey());
        return result;
      };
    }

    if (typeof global.cancelRoomReservation === "function") {
      const originalCancelRoom = global.cancelRoomReservation;
      global.cancelRoomReservation = async function () {
        const before = recordsSignature(typeof roomReservations !== "undefined" ? roomReservations : []);
        const result = await originalCancelRoom.apply(this, arguments);
        const after = recordsSignature(typeof roomReservations !== "undefined" ? roomReservations : []);
        if (before !== after) await publishRoomSnapshot("CANCEL");
        await subscribeRoomMonth(roomMonthKey());
        return result;
      };
    }
  }

  async function start() {
    if (!ENABLED || state.started) return;
    state.started = true;
    installWrappers();
    setStatus("connecting", "실시간 준비 중...");
    await ensureAuthenticated();

    const date = dateKeyFromClassroom();
    if (date) {
      hydrateClassroomFastCache7297(date);
      fastInitialClassroomLoad7297(date, {
        showOverlay: false,
        forceSheet: false,
        reason: "FAST-INITIAL-PREWARM"
      }).catch(function (error) {
        safeConsole("warn", "[ULIM classroom 7.29.7 initial fast load]", error);
      });
    }
    subscribeRoomMonth(roomMonthKey());

    try {
      if (global.ulimReliableWrite614 && typeof global.ulimReliableWrite614.removeOperations === "function") {
        global.ulimReliableWrite614.removeOperations([
          "classroomSave", "classroomRelease", "classroomReleaseSlot"
        ]);
      }
    } catch (_ignore) {}

    if (!state.sheetPollTimer) {
      state.sheetPollTimer = setInterval(function () {
        if (document.visibilityState !== "visible" || state.classroomPrimarySaving) return;
        const classroomPanel = document.getElementById("adminPanelClassroomUsage");
        if (!classroomPanel || !classroomPanel.classList.contains("active")) return;
        const currentDate = dateKeyFromClassroom();
        if (!currentDate || !currentAdminToken727()) return;
        checkClassroomSheetRevision7296(currentDate).catch(function (error) {
          safeConsole("warn", "[ULIM classroom 7.29.6 revision poll]", error);
        });
      }, 4000);
    }

    global.addEventListener("online", function () {
      const currentDate = dateKeyFromClassroom();
      if (!currentDate) return;
      fastInitialClassroomLoad7297(currentDate, {
        showOverlay: false,
        forceSheet: false,
        reason: "FAST-ONLINE"
      }).then(function () {
        return checkClassroomSheetRevision7296(currentDate);
      }).catch(function () {});
    });

    state.authPollTimer = setInterval(async function () {
      if (staffExplicitLogoutActive72913()) {
        resetRealtimeForStaffLogout72913();
        return;
      }
      const session = currentLegacySession();
      if (!session) {
        if (state.runtime && state.runtime.auth.currentUser) {
          try {
            const user = state.runtime.auth.currentUser;
            const tokenResult = await state.runtime.sdk.getIdTokenResult(user, false);
            if (primaryClaimsReady72912(tokenResult)) {
              const fingerprint = "firebase-primary:" + String(user.uid || "");
              if (!state.ready || state.sessionFingerprint !== fingerprint) {
                await acceptExistingFirebaseSession72912(state.runtime, "auth-poll-primary", false);
              }
              return;
            }
            /* Firebase 주 로그인 직후 claims refresh가 끝나기 전에는 로그아웃하지 않습니다. */
            setStatus("connecting", "Firebase 권한 토큰 갱신 중...");
            return;
          } catch (primaryError) {
            safeConsole("warn", "[ULIM 7.29.13 auth poll primary]", primaryError);
            return;
          }
        }
        state.ready = false;
        setStatus("waiting", "실시간: 로그인 대기");
        return;
      }
      const fingerprint = await sha256(session.type + "|" + session.token);
      if (!state.ready || fingerprint !== state.sessionFingerprint) {
        await ensureAuthenticated();
        const classroomDate = dateKeyFromClassroom();
        if (classroomDate) {
          fastInitialClassroomLoad7297(classroomDate, {
            showOverlay: false,
            forceSheet: false,
            reason: "FAST-AUTH-READY"
          }).catch(function () {});
        }
        subscribeRoomMonth(roomMonthKey());
      }
    }, 2500);
  }

  const publicApi728 = Object.freeze({
    version: VERSION,
    start: start,
    ensureAuthenticated: ensureAuthenticated,
    waitUntilAuthenticated: waitUntilAuthenticated72909,
    forceReauthenticate: forceReauthenticate,
    getStableIdToken: getStableIdToken72915,
    resetStableTokenGuard: resetStableTokenGuard72915,
    preloadRuntime: createRuntime,
    acceptLoginProof: acceptLoginProof72911,
    resetForStaffLogout: resetRealtimeForStaffLogout72913,
    subscribeClassroom: subscribeClassroom,
    subscribeRoomMonth: subscribeRoomMonth,
    publishClassroomSnapshot: publishClassroomSnapshot,
    publishRoomSnapshot: publishRoomSnapshot,
    flushClassroomSheetSync: function () { return refreshClassroomFromSheet7295(dateKeyFromClassroom(), { showOverlay: false, forceMirror: true, reason: "SHEET-PUBLIC-REFRESH" }); },
    refreshClassroomFromSheet: refreshClassroomFromSheet7295,
    fastLoadClassroom: fastInitialClassroomLoad7297,
    checkSheetRevision: checkClassroomSheetRevision7296,
    status: function () {
      return {
        version: VERSION,
        enabled: ENABLED,
        ready: state.ready,
        classroomDate: state.classroomDate,
        roomMonth: state.roomMonth,
        sheetSyncRunning: state.sheetSyncRunning,
        sheetSyncInFlight: state.sheetSyncInFlight.size,
        lastError: state.lastError,
        persistentCache: state.firestorePersistentCacheEnabled
      };
    }
  });
  global.ULIM_ROOM_CLASSROOM_REALTIME_728 = publicApi728;
  global.ULIM_ROOM_CLASSROOM_REALTIME_727 = publicApi728;
  global.ULIM_ROOM_CLASSROOM_REALTIME_721 = publicApi728;

  const style = document.createElement("style");
  style.id = "ulim-room-classroom-realtime-style-721";
  style.textContent = [
    ".ulim-realtime-status-721{display:inline-flex;align-items:center;margin:4px 0 10px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe}",
    ".ulim-realtime-status-721[data-state='ready']{background:#ecfdf5;color:#047857;border-color:#a7f3d0}",
    ".ulim-realtime-status-721[data-state='error']{background:#fff7ed;color:#c2410c;border-color:#fed7aa}",
    ".ulim-realtime-status-721[data-state='waiting']{background:#f8fafc;color:#64748b;border-color:#e2e8f0}",
    ".classroom-pending-7296{display:inline-flex;margin-top:3px;padding:2px 6px;border-radius:999px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;font-size:9px;font-weight:800}"
  ].join("");
  document.head.appendChild(style);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  safeConsole("info", "[ULIM 7.29.13 Firebase-primary-preserving sheet-canonical realtime module]", VERSION);
})(typeof window !== "undefined" ? window : globalThis);
