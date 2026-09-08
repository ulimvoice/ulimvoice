(function (global) {
  "use strict";

  const VERSION =
    "20260714.7-classid-authoritative-filter";

  global
    .__ULIM_FIRESTORE_ATTENDANCE_READER_VERSION__ =
    VERSION;

  function createFirestoreAttendanceReader(options) {
    options = options || {};
    const sdk = options.sdk || {};
    const db = options.db;
    const auth = options.auth;
    const maxAssignedClasses = Number(options.maxAssignedClasses || 100);
    const queryConcurrency = Math.max(1, Math.min(10, Number(options.queryConcurrency || 5)));

    if (!db) throw new Error("Firestore attendance reader requires db");
    for (const name of ["collection", "query", "where", "getDocs"]) {
      if (typeof sdk[name] !== "function") throw new Error("Firestore attendance reader missing SDK method: " + name);
    }

    function shouldForceServer(params) {
      params = params || {};
      return params.forceServer === true ||
        String(params.readSource || "").trim().toLowerCase() === "server";
    }

    function readSnapshot(queryRef, forceServer) {
      if (
        forceServer === true &&
        typeof sdk.getDocsFromServer === "function"
      ) {
        global.ULIM_FIRESTORE_ATTENDANCE_LAST_READ_SOURCE =
          "server";
        global
          .ULIM_FIRESTORE_ATTENDANCE_SERVER_READ_SUPPORTED =
          true;
        return sdk.getDocsFromServer(queryRef);
      }

      global.ULIM_FIRESTORE_ATTENDANCE_LAST_READ_SOURCE =
        forceServer === true
          ? "default_fallback"
          : "default";

      global
        .ULIM_FIRESTORE_ATTENDANCE_SERVER_READ_SUPPORTED =
        typeof sdk.getDocsFromServer === "function";

      return sdk.getDocs(queryRef);
    }

    async function getAttendanceSnapshot(params) {
      params = params || {};
      const forceServer = shouldForceServer(params);
      const requestedClassId =
        String(params.classId || "").trim();
      const date = String(params.date || params.sessionDate || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("attendance date must be YYYY-MM-DD");
      const identity = await currentIdentity();
      let documents = [];

      if (identity.role === "student") {
        if (!identity.studentUid) throw new Error("studentUid claim is required");
        const constraints = [
          sdk.where("active", "==", true),
          sdk.where("sessionDate", "==", date),
          sdk.where("studentUid", "==", identity.studentUid)
        ];

        if (requestedClassId) {
          constraints.push(
            sdk.where("classId", "==", requestedClassId)
          );
        }

        documents = await readAttendanceQuery(
          constraints,
          forceServer
        );
      } else if (identity.role === "teacher") {
        if (!identity.teacherUid) throw new Error("teacherUid claim is required");
        const assignments = await loadAssignments(
          "teacherAssignments",
          identity.teacherUid,
          forceServer,
          requestedClassId
        );
        documents = await readAssignedClasses(
          assignments,
          date,
          forceServer
        );
      } else if (identity.role === "admin") {
        const assignments = await loadAssignments(
          "adminAssignments",
          identity.firebaseUid,
          forceServer,
          requestedClassId
        );
        documents = await readAssignedClasses(
          assignments,
          date,
          forceServer
        );
      } else if (identity.role === "superAdmin") {
        const constraints = [
          sdk.where("active", "==", true),
          sdk.where("sessionDate", "==", date)
        ];

        if (requestedClassId) {
          constraints.push(
            sdk.where("classId", "==", requestedClassId)
          );
        }

        documents = await readAttendanceQuery(
          constraints,
          forceServer
        );
      } else {
        throw new Error("unsupported Firestore attendance role");
      }

      return applyCurrentUiFilters(documents.map(toLegacyRecord), params);
    }

    async function currentIdentity() {
      const user = auth && auth.currentUser;
      if (!user) throw new Error("Firebase authentication is required for attendance read");
      let tokenResult;
      if (typeof sdk.getIdTokenResult === "function") tokenResult = await sdk.getIdTokenResult(user);
      else if (typeof user.getIdTokenResult === "function") tokenResult = await user.getIdTokenResult();
      else throw new Error("Firebase token claims are unavailable");
      const claims = (tokenResult && tokenResult.claims) || {};
      return {
        firebaseUid: String(user.uid || "").trim(),
        role: String(claims.role || "").trim(),
        studentUid: String(claims.studentUid || "").trim(),
        teacherUid: String(claims.teacherUid || "").trim()
      };
    }

    async function loadAssignments(
      rootCollection,
      ownerId,
      forceServer,
      requestedClassId
    ) {
      if (!ownerId) throw new Error("assignment owner id is required");
      const ref = sdk.collection(db, rootCollection, ownerId, "classes");
      const queryRef = sdk.query(ref, sdk.where("active", "==", true));
      const snapshot = await readSnapshot(
        queryRef,
        forceServer
      );
      const assignments = snapshot.docs.map(function (document) {
        const data = document.data() || {};
        return {
          classId:
            String(
              document.id ||
              data.classId ||
              ""
            ).trim(),
          className:
            String(data.className || "").trim()
        };
      }).filter(function (item) {
        return !!item.classId &&
          (
            !requestedClassId ||
            item.classId === requestedClassId
          );
      });
      if (assignments.length > maxAssignedClasses) throw new Error("assigned class limit exceeded");
      return assignments;
    }

    async function readAssignedClasses(
      assignments,
      date,
      forceServer
    ) {
      const rows = await mapWithConcurrency(
        assignments,
        queryConcurrency,
        async function (assignment) {
          return readAttendanceQuery([
            sdk.where("active", "==", true),
            sdk.where("sessionDate", "==", date),
            sdk.where("classId", "==", assignment.classId)
          ], forceServer);
        }
      );
      return rows.flat();
    }

    async function readAttendanceQuery(
      constraints,
      forceServer
    ) {
      const ref = sdk.collection(db, "attendance");
      const queryRef = sdk.query.apply(
        null,
        [ref].concat(constraints)
      );
      const snapshot = await readSnapshot(
        queryRef,
        forceServer
      );
      return snapshot.docs.map(function (document) {
        return Object.assign({ id: document.id }, document.data() || {});
      });
    }

    return Object.freeze({ getAttendanceSnapshot });
  }

  async function mapWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length);
    let next = 0;
    async function run() {
      while (true) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await worker(items[index], index);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, run));
    return results;
  }

  function toLegacyRecord(data) {
    return {
      date: data.sessionDate || "",
      sessionDate: data.sessionDate || "",
      sessionId: data.sessionId || "",
      studentName: data.studentName || "",
      studentNo: data.studentNo || "",
      studentUid: data.studentUid || "",
      studentIdentityKey: data.studentIdentityKey || "",
      studentRowNumber: data.studentRowNumber,
      instructor: data.instructor || data.teacherName || "",
      teacherUid: data.teacherUid || "",
      teacherName: data.teacherName || "",
      classId: data.classId || "",
      className: data.className || "",
      classroom: data.classroom || "",
      startTime: data.sessionStartTime || "",
      endTime: data.sessionEndTime || "",
      status: data.uiStatus || data.status || "미체크",
      attendanceStatus: data.uiStatus || data.status || "미체크",
      specialStatus: data.specialStatus || "",
      enrollmentStatus: data.enrollmentStatus || "",
      studentStatus: data.studentStatus || "",
      memo: data.memo || "",
      note: data.memo || "",
      sourceSheet: data.legacy && data.legacy.sourceSheet || "",
      sourceRow: data.legacy && data.legacy.sourceRow,
      sourceCol: data.legacy && data.legacy.sourceCol,
      sourceCell: data.legacy && data.legacy.sourceCell || "",
      sourceKey: data.legacy && data.legacy.sourceKey || ""
    };
  }

  function normalize(value) {
    return String(value || "").normalize("NFC").replace(/\s+/g, "").toLowerCase();
  }

  function applyCurrentUiFilters(records, params) {
    const classId =
      String(params.classId || "").trim();
    const className = normalize(params.className);
    const keyword = normalize(params.keyword);
    const statusFilter = normalize(params.statusFilter);
    return records.filter(function (record) {
      if (
        classId &&
        String(record.classId || "").trim() !==
          classId
      ) {
        return false;
      }

      /*
       * 정확한 classId가 있으면 className은 표시값일 뿐이다.
       *
       * 같은 반이 "연기기초"와
       * "[김철수T] - 목요일 연기기초 19:00 ~ 22:00"
       * 형태로 표현돼도 classId가 같으면 같은 반이다.
       *
       * classId 조회 후 className을 다시 필터링하면
       * 서버 문서 6건을 읽고도 화면에서 0건으로 제거할 수 있다.
       */
      if (
        !classId &&
        className &&
        normalize(record.className) !==
          className
      ) {
        return false;
      }
      if (keyword && !normalize(record.studentName).includes(keyword) && !normalize(record.studentNo).includes(keyword)) return false;
      if (statusFilter) {
        const effective = normalize(record.specialStatus || record.status || record.attendanceStatus);
        if (effective !== statusFilter) return false;
      }
      return true;
    });
  }

  global.ULIM_CREATE_FIRESTORE_ATTENDANCE_READER = createFirestoreAttendanceReader;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createFirestoreAttendanceReader, applyCurrentUiFilters, toLegacyRecord };
  }
})(typeof window !== "undefined" ? window : globalThis);
