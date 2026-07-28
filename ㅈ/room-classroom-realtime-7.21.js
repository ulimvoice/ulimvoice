(function (global) {
  "use strict";

  if (global.__ULIM_ROOM_CLASSROOM_REALTIME_72101__) return;
  global.__ULIM_ROOM_CLASSROOM_REALTIME_72101__ = true;

  const VERSION = "2026-07-29.721.01";
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
  const APP_NAME = "ulim-room-classroom-realtime-721";
  const SESSION_FINGERPRINT_KEY = "ulimRealtimeLegacySessionFingerprint721";
  const REQUEST_PREFIX = "RT721";

  const state = {
    started: false,
    ready: false,
    signingIn: null,
    runtime: null,
    sessionFingerprint: "",
    classroomDate: "",
    classroomUnsubscribe: null,
    roomMonth: "",
    roomUnsubscribe: null,
    roomMonthData: null,
    roomIndexWrapped: false,
    wrappersInstalled: false,
    lastError: "",
    authPollTimer: null
  };

  function safeConsole(method) {
    try {
      const args = Array.prototype.slice.call(arguments, 1);
      (console[method] || console.log).apply(console, args);
    } catch (_ignore) {}
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
        localStorage.getItem("studentSessionToken") ||
        sessionStorage.getItem("studentSessionToken") ||
        ""
      ).trim();
    } catch (_ignore) {}

    if (student) return { type: "student", payload: { studentSessionToken: student }, token: student };
    return null;
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
    const sdk = await loadFirebaseSdk();
    let app;
    try {
      app = sdk.getApp(APP_NAME);
    } catch (_ignore) {
      app = sdk.initializeApp(FIREBASE_CONFIG, APP_NAME);
    }

    const auth = sdk.getAuth(app);
    await sdk.setPersistence(auth, sdk.browserLocalPersistence);
    const functions = sdk.getFunctions(app, FUNCTIONS_REGION);
    const db = sdk.getFirestore(app);

    state.runtime = {
      sdk: sdk,
      app: app,
      auth: auth,
      functions: functions,
      db: db,
      exchange: sdk.httpsCallable(functions, "exchangeLegacySession"),
      syncClassroom: sdk.httpsCallable(functions, "syncClassroomRealtimeSnapshot"),
      syncRoom: sdk.httpsCallable(functions, "syncRoomRealtimeSnapshot")
    };
    return state.runtime;
  }

  async function requestFreshProof(session) {
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

  async function ensureAuthenticated() {
    if (!ENABLED) return null;
    if (state.signingIn) return state.signingIn;

    state.signingIn = (async function () {
      const session = currentLegacySession();
      if (!session) {
        setStatus("waiting", "실시간: 로그인 대기");
        return null;
      }

      const fingerprint = await sha256(session.type + "|" + session.token);
      const runtime = await createRuntime();
      let storedFingerprint = "";
      try { storedFingerprint = localStorage.getItem(SESSION_FINGERPRINT_KEY) || ""; } catch (_ignore) {}

      if (runtime.auth.currentUser && storedFingerprint === fingerprint) {
        state.ready = true;
        state.sessionFingerprint = fingerprint;
        setStatus("ready", "실시간 연결됨");
        return runtime;
      }

      if (runtime.auth.currentUser) {
        await runtime.sdk.signOut(runtime.auth);
      }

      setStatus("connecting", "실시간 인증 중...");
      const proof = await requestFreshProof(session);
      const exchangeResult = await runtime.exchange({ proof: proof });
      const customToken = exchangeResult && exchangeResult.data && exchangeResult.data.customToken;
      if (!customToken) throw new Error("Firebase custom token 발급 실패");
      await runtime.sdk.signInWithCustomToken(runtime.auth, customToken);

      try { localStorage.setItem(SESSION_FINGERPRINT_KEY, fingerprint); } catch (_ignore) {}
      state.ready = true;
      state.sessionFingerprint = fingerprint;
      setStatus("ready", "실시간 연결됨");
      return runtime;
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

  async function subscribeClassroom(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return;
    const runtime = await ensureAuthenticated();
    if (!runtime) return;
    if (state.classroomDate === date && state.classroomUnsubscribe) return;
    if (state.classroomUnsubscribe) state.classroomUnsubscribe();
    state.classroomDate = date;

    const ref = runtime.sdk.doc(runtime.db, "realtimeClassroomDays", date);
    state.classroomUnsubscribe = runtime.sdk.onSnapshot(ref, function (snapshot) {
      if (!snapshot.exists()) return;
      if (dateKeyFromClassroom() !== date) return;
      const data = snapshot.data() || {};
      if (!Array.isArray(data.records)) return;
      try {
        adminClassroomUsageRows = data.records.map(function (record) { return Object.assign({}, record); });
        adminClassroomUsageLoadedDate = date;
        if (typeof adminClassroomReconcilePending718_ === "function") adminClassroomReconcilePending718_();
        if (typeof adminRenderClassroomUsageTable === "function") adminRenderClassroomUsageTable();
        const summary = document.getElementById("adminClassroomUsageSummary");
        if (summary) summary.textContent = "다른 강사의 강의실 변경사항이 실시간 반영됐습니다.";
        setStatus("ready", "실시간 연결됨");
      } catch (error) {
        safeConsole("warn", "[ULIM classroom realtime render]", error);
      }
    }, function (error) {
      setStatus("error", "실시간 수신 실패 · 기존 조회 유지");
      safeConsole("warn", "[ULIM classroom realtime listener]", error);
    });
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

  async function publishClassroomSnapshot(reason) {
    const date = dateKeyFromClassroom();
    if (!date) return;
    const runtime = await ensureAuthenticated();
    if (!runtime) return;
    const records = sanitizeClassroomRecords(
      typeof adminClassroomUsageRows !== "undefined" ? adminClassroomUsageRows : [],
      date
    );
    try {
      await runtime.syncClassroom({
        date: date,
        records: records,
        observedAtMs: Date.now(),
        requestId: makeRequestId("CLASSROOM-" + String(reason || "SYNC"))
      });
    } catch (error) {
      safeConsole("warn", "[ULIM classroom realtime publish]", error);
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
      const originalLoadClassroom = global.adminLoadClassroomUsage;
      global.adminLoadClassroomUsage = async function () {
        const result = await originalLoadClassroom.apply(this, arguments);
        await subscribeClassroom(dateKeyFromClassroom());
        return result;
      };
    }

    if (typeof global.adminSaveClassroomUsageFromForm === "function") {
      const originalSaveClassroom = global.adminSaveClassroomUsageFromForm;
      global.adminSaveClassroomUsageFromForm = async function () {
        const before = recordsSignature(typeof adminClassroomUsageRows !== "undefined" ? adminClassroomUsageRows : []);
        const result = await originalSaveClassroom.apply(this, arguments);
        const after = recordsSignature(typeof adminClassroomUsageRows !== "undefined" ? adminClassroomUsageRows : []);
        if (before !== after) await publishClassroomSnapshot("SAVE");
        await subscribeClassroom(dateKeyFromClassroom());
        return result;
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

    global.addEventListener("ulimReliableWrite614", function (event) {
      const detail = event && event.detail || {};
      const job = detail.job || {};
      if (detail.state === "complete" && job.operation === "classroomRelease") {
        setTimeout(function () { publishClassroomSnapshot("RELEASE"); }, 200);
      }
    });
  }

  async function start() {
    if (!ENABLED || state.started) return;
    state.started = true;
    installWrappers();
    setStatus("connecting", "실시간 준비 중...");
    await ensureAuthenticated();

    const date = dateKeyFromClassroom();
    if (date) subscribeClassroom(date);
    subscribeRoomMonth(roomMonthKey());

    state.authPollTimer = setInterval(async function () {
      const session = currentLegacySession();
      if (!session) {
        if (state.runtime && state.runtime.auth.currentUser) {
          try { await state.runtime.sdk.signOut(state.runtime.auth); } catch (_ignore) {}
        }
        state.ready = false;
        setStatus("waiting", "실시간: 로그인 대기");
        return;
      }
      const fingerprint = await sha256(session.type + "|" + session.token);
      if (!state.ready || fingerprint !== state.sessionFingerprint) {
        await ensureAuthenticated();
        const classroomDate = dateKeyFromClassroom();
        if (classroomDate) subscribeClassroom(classroomDate);
        subscribeRoomMonth(roomMonthKey());
      }
    }, 2500);
  }

  global.ULIM_ROOM_CLASSROOM_REALTIME_721 = Object.freeze({
    version: VERSION,
    start: start,
    ensureAuthenticated: ensureAuthenticated,
    subscribeClassroom: subscribeClassroom,
    subscribeRoomMonth: subscribeRoomMonth,
    publishClassroomSnapshot: publishClassroomSnapshot,
    publishRoomSnapshot: publishRoomSnapshot,
    status: function () {
      return {
        version: VERSION,
        enabled: ENABLED,
        ready: state.ready,
        classroomDate: state.classroomDate,
        roomMonth: state.roomMonth,
        lastError: state.lastError
      };
    }
  });

  const style = document.createElement("style");
  style.id = "ulim-room-classroom-realtime-style-721";
  style.textContent = [
    ".ulim-realtime-status-721{display:inline-flex;align-items:center;margin:4px 0 10px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe}",
    ".ulim-realtime-status-721[data-state='ready']{background:#ecfdf5;color:#047857;border-color:#a7f3d0}",
    ".ulim-realtime-status-721[data-state='error']{background:#fff7ed;color:#c2410c;border-color:#fed7aa}",
    ".ulim-realtime-status-721[data-state='waiting']{background:#f8fafc;color:#64748b;border-color:#e2e8f0}"
  ].join("");
  document.head.appendChild(style);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  safeConsole("info", "[ULIM 7.21 realtime module]", VERSION);
})(typeof window !== "undefined" ? window : globalThis);
