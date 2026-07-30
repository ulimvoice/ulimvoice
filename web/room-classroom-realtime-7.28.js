(function (global) {
  "use strict";

  if (global.__ULIM_ROOM_CLASSROOM_REALTIME_72801__) return;
  global.__ULIM_ROOM_CLASSROOM_REALTIME_72801__ = true;

  const VERSION = "2026-07-30.728.01";
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
  const APP_NAME = "ulim-room-classroom-realtime-728";
  const SESSION_FINGERPRINT_KEY = "ulimRealtimeLegacySessionFingerprint721";
  const REQUEST_PREFIX = "RT728";

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
    selectedClassroomRecordId: ""
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
      syncRoom: sdk.httpsCallable(functions, "syncRoomRealtimeSnapshot"),
      commitClassroom: sdk.httpsCallable(functions, "commitClassroomUsageFirestoreFirst"),
      releaseClassroom: sdk.httpsCallable(functions, "releaseClassroomUsageFirestoreFirst"),
      updateClassroom: sdk.httpsCallable(functions, "updateClassroomUsageSlotFirestoreFirst"),
      listClassroomSheetJobs: sdk.httpsCallable(functions, "listPendingClassroomSheetSyncJobs"),
      completeClassroomSheetJob: sdk.httpsCallable(functions, "completeClassroomSheetSyncJob"),
      noteClassroomSheetFailure: sdk.httpsCallable(functions, "noteClassroomSheetSyncFailure")
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
      state.classroomBaselineReady[date] = true;
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
        requestId: makeRequestId("CLASSROOM-" + String(reason || "SYNC"))
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

  function collectClassroomRequest727() {
    if (typeof adminInitClassroomUsagePanel === "function") {
      adminInitClassroomUsagePanel();
    }

    const date = dateKeyFromClassroom();
    const assignedInstructor = String(
      document.getElementById("adminClassroomUsageInstructor")?.value ||
      currentAdminDisplayName727() ||
      ""
    ).trim();
    const className = String(
      document.getElementById("adminClassroomUsageClass")?.value || ""
    ).trim();
    const memo = String(
      document.getElementById("adminClassroomUsageMemo")?.value || ""
    ).trim();

    let selectedSlots = [];
    if (typeof adminClassroomPendingSlots718_ === "function") {
      selectedSlots = adminClassroomPendingSlots718_(date).slice();
    }

    if (!selectedSlots.length) {
      const room = String(
        document.getElementById("adminClassroomUsageRoom")?.value || ""
      ).trim();
      const startHour = Number(
        document.getElementById("adminClassroomUsageStart")?.value || 0
      );
      const endHour = Number(
        document.getElementById("adminClassroomUsageEnd")?.value || 0
      );

      if (!date || !room || !startHour || !endHour) {
        throw new Error("표에서 사용할 시간을 선택하거나 사용일·강의실·시간을 확인해주세요.");
      }
      if (endHour <= startHour) {
        throw new Error("종료시간은 시작시간보다 늦어야 합니다.");
      }
      for (let hour = startHour; hour < endHour; hour += 1) {
        selectedSlots.push({ date: date, room: room, hour: hour });
      }
    }

    const groups = typeof adminClassroomBuildGroups718_ === "function"
      ? adminClassroomBuildGroups718_(selectedSlots)
      : [];
    if (!groups.length) throw new Error("저장할 사용 시간을 선택해주세요.");

    return {
      date: date,
      assignedInstructor: assignedInstructor,
      className: className,
      memo: memo,
      selectedSlots: selectedSlots,
      groups: groups.map(function (group) {
        return {
          room: String(group.room || ""),
          startHour: Number(group.startHour),
          endHour: Number(group.endHour)
        };
      })
    };
  }

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
    const completedGroups = accepted.concat(conflicts).map(function (item) {
      return {
        room: item.room,
        startHour: Number(item.startHour),
        endHour: Number(item.endHour)
      };
    });

    if (typeof adminClassroomRemovePendingSlots718_ === "function") {
      adminClassroomRemovePendingSlots718_(
        classroomGroupsToSlots727(date, completedGroups)
      );
    }
    if (typeof adminClassroomReconcilePending718_ === "function") {
      adminClassroomReconcilePending718_();
    }
    if (typeof adminRenderClassroomUsageTable === "function") {
      adminRenderClassroomUsageTable();
    }

    const summary = document.getElementById("adminClassroomUsageSummary");
    if (summary) {
      summary.textContent =
        "시간칸 확정 " + accepted.length + "건" +
        (conflicts.length ? " · 먼저 확정된 칸 " + conflicts.length + "건 제외" : "") +
        (accepted.length ? " · 시트 백그라운드 동기화 중" : "");
    }

    if (!conflicts.length && typeof adminClearClassroomUsageForm === "function") {
      adminClearClassroomUsageForm(true);
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
        "먼저 확정된 시간칸은 그대로 유지했습니다.\n\n" + detail +
        (accepted.length ? "\n\n나머지 시간칸은 정상 확정됐습니다." : "")
      );
    }
  }

  async function fallbackLegacyClassroomSave727(silentConfirm, forceOverride, error) {
    safeConsole("warn", "[ULIM classroom 7.27 fallback to GAS]", error);
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

  async function saveClassroomFirestoreFirst727(silentConfirm, forceOverride) {
    if (state.classroomPrimarySaving) return;
    if (global.ULIM_CLASSROOM_FIRESTORE_FIRST_ENABLED === false) {
      return state.legacyClassroomSave.apply(this, arguments);
    }
    if (!currentAdminToken727()) {
      return alert("로그인이 필요합니다.");
    }

    let request;
    try {
      request = collectClassroomRequest727();
    } catch (error) {
      return alert(callableMessage727(error) || "강의실 사용정보를 확인해주세요.");
    }

    if (forceOverride) {
      const selected = (typeof adminClassroomUsageRows !== "undefined" ? adminClassroomUsageRows : [])
        .find(function (record) {
          return String(record.recordId || "") === String(state.selectedClassroomRecordId || "");
        });
      const group = request.groups.length === 1 ? request.groups[0] : null;
      const sameHourlySlot = !!selected && !!group &&
        Number(selected.endHour) === Number(selected.startHour) + 1 &&
        Number(group.endHour) === Number(group.startHour) + 1 &&
        String(selected.room || "").replace(/\\s+/g, "") === String(group.room || "").replace(/\\s+/g, "") &&
        Number(selected.startHour) === Number(group.startHour);

      if (!sameHourlySlot) {
        return state.legacyClassroomSave.apply(this, arguments);
      }

      if (!silentConfirm && !confirm(
        selected.room + " " + selected.startHour + ":00~" + selected.endHour + ":00\n\n이 한 시간 칸의 배정/용도를 변경할까요?"
      )) return;

      state.classroomPrimarySaving = true;
      try {
        if (typeof showLoading === "function") showLoading("한 시간 칸 수정 중...");
        const runtime = await ensureAuthenticated();
        if (!runtime) throw new Error("Firebase 실시간 인증이 준비되지 않았습니다.");
        const response = await runtime.updateClassroom({
          date: request.date,
          room: group.room,
          startHour: group.startHour,
          endHour: group.endHour,
          assignedInstructor: request.assignedInstructor,
          className: request.className,
          memo: request.memo,
          requestId: makeRequestId("CLASSROOM-UPDATE")
        });
        const result = callableData727(response) || {};
        if (Array.isArray(result.records)) {
          adminClassroomUsageRows = result.records.map(function (record) { return Object.assign({}, record); });
          adminClassroomUsageLoadedDate = request.date;
          if (typeof adminRenderClassroomUsageTable === "function") adminRenderClassroomUsageTable();
        }
        state.selectedClassroomRecordId = "";
        const summary = document.getElementById("adminClassroomUsageSummary");
        if (summary) summary.textContent = "선택한 한 시간 칸을 수정했습니다. · 시트 백그라운드 동기화 중";
        setTimeout(flushClassroomSheetSync727, 0);
        return result;
      } catch (error) {
        alert(callableMessage727(error) || "한 시간 칸 수정에 실패했습니다.");
        return;
      } finally {
        try { if (typeof hideLoading === "function") hideLoading(); } catch (_ignore) {}
        state.classroomPrimarySaving = false;
      }
    }

    if (!silentConfirm) {
      const lines = request.groups.map(function (group) {
        const start = typeof adminFormatClassroomHour_ === "function"
          ? adminFormatClassroomHour_(group.startHour)
          : String(group.startHour) + ":00";
        const end = typeof adminFormatClassroomHour_ === "function"
          ? adminFormatClassroomHour_(group.endHour)
          : String(group.endHour) + ":00";
        return group.room + " " + start + "~" + end;
      });
      if (!confirm([
        request.date,
        "",
        ...lines,
        "",
        "Firestore에 즉시 확정하고 시트는 백그라운드로 동기화할까요?"
      ].join("\n"))) return;
    }

    state.classroomPrimarySaving = true;
    let firestoreCommitted = false;
    let committedResult = null;
    const saveButton = document.getElementById("adminClassroomUsageSaveButton");
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Firestore 즉시 확정 중...";
    }

    try {
      if (typeof showLoading === "function") showLoading("강의실 사용 즉시 확정 중...");
      const runtime = await ensureAuthenticated();
      if (!runtime) throw new Error("Firebase 실시간 인증이 준비되지 않았습니다.");
      await ensureClassroomBaseline727(request.date);

      const response = await runtime.commitClassroom({
        date: request.date,
        groups: request.groups,
        assignedInstructor: request.assignedInstructor,
        className: request.className,
        memo: request.memo,
        forceOverride: false,
        requestId: makeRequestId("CLASSROOM-PRIMARY")
      });
      const result = callableData727(response) || {};
      if (!result.ok) throw new Error(result.message || "Firestore 저장에 실패했습니다.");

      firestoreCommitted = true;
      committedResult = result;
      applyClassroomCommitResult727(request.date, request, result);
      setStatus("ready", "실시간 연결됨 · 빠른 저장");
      setTimeout(flushClassroomSheetSync727, 0);
      return result;
    } catch (error) {
      try { if (typeof hideLoading === "function") hideLoading(); } catch (_ignore) {}
      if (firestoreCommitted) {
        safeConsole("warn", "[ULIM classroom 7.27 committed but UI refresh failed]", error);
        setStatus("ready", "Firestore 확정 완료 · 화면 갱신 대기");
        setTimeout(function () {
          subscribeClassroom(request.date);
          flushClassroomSheetSync727();
        }, 0);
        return committedResult || { ok: true, uiRefreshPending: true };
      }
      return fallbackLegacyClassroomSave727(true, forceOverride, error);
    } finally {
      try { if (typeof hideLoading === "function") hideLoading(); } catch (_ignore) {}
      state.classroomPrimarySaving = false;
      if (saveButton) saveButton.disabled = false;
      if (typeof adminClassroomUpdatePendingSummary718_ === "function") {
        adminClassroomUpdatePendingSummary718_();
      }
    }
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

  async function processClassroomSheetJob727(runtime, job) {
    if (!job || !job.jobId || state.sheetSyncInFlight.has(job.jobId)) return;
    if (typeof global.ulimDirectAdminWrite704_ !== "function") return;
    state.sheetSyncInFlight.add(job.jobId);

    try {
      const operation = String(job.operation || "save");
      const gasOperation = operation === "release"
        ? "classroomReleaseSlot"
        : "classroomSave";
      const payload = Object.assign({}, job.payload || {});
      if (operation === "update") payload.override = "1";
      const result = await global.ulimDirectAdminWrite704_(
        gasOperation,
        payload,
        {
          background: true,
          requestId: job.requestId || job.jobId,
          timeoutMs: 90000
        }
      );
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
      setStatus("ready", "실시간 연결됨 · 시트 동기화 완료");
    } catch (error) {
      safeConsole("warn", "[ULIM classroom 7.27 sheet sync]", error);
      try {
        await runtime.noteClassroomSheetFailure({
          jobId: job.jobId,
          message: callableMessage727(error).slice(0, 500)
        });
      } catch (_ignore) {}
      setStatus("ready", "Firestore 확정 · 시트 재전송 대기");
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
      if (!runtime || typeof global.ulimDirectAdminWrite704_ !== "function") return;
      const response = await runtime.listClassroomSheetJobs({ limit: 8 });
      const data = callableData727(response) || {};
      const jobs = Array.isArray(data.jobs) ? data.jobs : [];
      for (const job of jobs) {
        await processClassroomSheetJob727(runtime, job);
      }
    } catch (error) {
      safeConsole("warn", "[ULIM classroom 7.27 pending sheet jobs]", error);
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
      const originalLoadClassroom = global.adminLoadClassroomUsage;
      global.adminLoadClassroomUsage = async function () {
        const result = await originalLoadClassroom.apply(this, arguments);
        const date = dateKeyFromClassroom();
        let loadedForDate = false;
        try {
          loadedForDate =
            typeof adminClassroomUsageLoadedDate !== "undefined" &&
            String(adminClassroomUsageLoadedDate || "") === String(date || "");
        } catch (_ignore) {}
        if (date && loadedForDate) {
          state.classroomBaselineReady[date] = false;
          const baselinePromise = publishClassroomSnapshot("LOAD-BASELINE", {
            date: date,
            strict: true
          }).then(function () {
            state.classroomBaselineReady[date] = true;
            return true;
          }).catch(function (error) {
            safeConsole("warn", "[ULIM classroom 7.27 baseline]", error);
            return false;
          }).finally(function () {
            delete state.classroomBaselinePromises[date];
          });
          state.classroomBaselinePromises[date] = baselinePromise;
          await subscribeClassroom(date);
        }
        setTimeout(flushClassroomSheetSync727, 0);
        return result;
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
        if (!record) return state.legacyClassroomRelease.apply(this, arguments);
        const startHour = Number(record.startHour);
        const endHour = Number(record.endHour);
        if (!Number.isInteger(startHour) || endHour !== startHour + 1) {
          return state.legacyClassroomRelease.apply(this, arguments);
        }
        if (!confirm(
          String(record.room || "") + " " + startHour + ":00~" + endHour + ":00\n\n이 한 시간 칸만 해제할까요?"
        )) return;

        try {
          const runtime = await ensureAuthenticated();
          if (!runtime) throw new Error("Firebase 실시간 인증이 준비되지 않았습니다.");
          const response = await runtime.releaseClassroom({
            date: dateKeyFromClassroom(),
            room: record.room,
            startHour: startHour,
            endHour: endHour,
            recordId: record.recordId,
            requestId: makeRequestId("CLASSROOM-RELEASE")
          });
          const result = callableData727(response) || {};
          if (Array.isArray(result.records)) {
            adminClassroomUsageRows = result.records.map(function (item) { return Object.assign({}, item); });
            adminClassroomUsageLoadedDate = dateKeyFromClassroom();
            if (typeof adminRenderClassroomUsageTable === "function") adminRenderClassroomUsageTable();
          }
          const summary = document.getElementById("adminClassroomUsageSummary");
          if (summary) summary.textContent = "선택한 한 시간 칸을 즉시 해제했습니다. · 시트 백그라운드 동기화 중";
          setTimeout(flushClassroomSheetSync727, 0);
          return result;
        } catch (error) {
          const message = callableMessage727(error);
          if (/기존 시트 기록은 기존 해제 방식/.test(message)) {
            return state.legacyClassroomRelease.call(this, recordId);
          }
          alert(message || "한 시간 칸 해제에 실패했습니다.");
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
    setTimeout(flushClassroomSheetSync727, 300);
    if (!state.sheetSyncTimer) {
      state.sheetSyncTimer = setInterval(flushClassroomSheetSync727, 30000);
    }
    global.addEventListener("online", flushClassroomSheetSync727);

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

  const publicApi728 = Object.freeze({
    version: VERSION,
    start: start,
    ensureAuthenticated: ensureAuthenticated,
    subscribeClassroom: subscribeClassroom,
    subscribeRoomMonth: subscribeRoomMonth,
    publishClassroomSnapshot: publishClassroomSnapshot,
    publishRoomSnapshot: publishRoomSnapshot,
    flushClassroomSheetSync: flushClassroomSheetSync727,
    status: function () {
      return {
        version: VERSION,
        enabled: ENABLED,
        ready: state.ready,
        classroomDate: state.classroomDate,
        roomMonth: state.roomMonth,
        sheetSyncRunning: state.sheetSyncRunning,
        sheetSyncInFlight: state.sheetSyncInFlight.size,
        lastError: state.lastError
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
    ".ulim-realtime-status-721[data-state='waiting']{background:#f8fafc;color:#64748b;border-color:#e2e8f0}"
  ].join("");
  document.head.appendChild(style);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  safeConsole("info", "[ULIM 7.28 hourly-slot classroom module]", VERSION);
})(typeof window !== "undefined" ? window : globalThis);
