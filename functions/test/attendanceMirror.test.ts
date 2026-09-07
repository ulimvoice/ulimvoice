import test from "node:test";
import assert from "node:assert/strict";
import {
  mirrorWebAttendanceRows,
  normalizeAttendanceStatus,
  normalizeForCurrentAttendanceUi,
  readAttendanceSnapshot,
  toAttendanceMirrorDocument
} from "../src/mirror/attendanceMirror.js";

const gasSample = {
  date: "2026-06-25",
  sessionDate: "2026-06-25",
  studentName: "Sample Student",
  studentNo: "12",
  studentUid: "stu_001",
  studentIdentityKey: "uid_stu_001",
  studentRowNumber: 42,
  instructor: "Teacher A",
  teacherUid: "teacher_a",
  classId: "class_a",
  className: "Class A",
  classroom: "Room 1",
  status: "\uCD9C\uC11D",
  attendanceStatus: "\uCD9C\uC11D",
  specialStatus: "",
  enrollmentStatus: "\uC7AC\uC6D0",
  studentStatus: "\uC7AC\uC6D0",
  memo: "memo",
  sourceSheet: "6\uC6D4",
  sourceRow: 10,
  sourceCol: 4,
  sourceCell: "D10",
  sourceKey: "block-0900"
};

test("normalizes legacy attendance statuses into internal enum", () => {
  assert.equal(normalizeAttendanceStatus("O"), "present");
  assert.equal(normalizeAttendanceStatus("X"), "absent");
  assert.equal(normalizeAttendanceStatus("\uBCF4\uAC15\uC608\uC815"), "makeup");
  assert.equal(normalizeAttendanceStatus(""), "unchecked");
});

test("maps legacy GAS attendance row to Firestore document without phone fields", () => {
  const doc = toAttendanceMirrorDocument(gasSample, new Date("2026-06-25T00:00:00.000Z"));
  assert.equal(doc.id, "2026-06-25__class_a__block-0900__teacher_a_uid_stu_001");
  assert.equal(doc.status, "present");
  assert.equal(doc.uiStatus, "\uCD9C\uC11D");
  assert.equal(doc.legacy.sourceRow, 10);
  assert.equal("studentPhone" in doc, false);
  assert.equal("parentPhone" in doc, false);
});

test("normalizeForCurrentAttendanceUi returns current GAS contract field names", () => {
  const doc = toAttendanceMirrorDocument(gasSample);
  const [ui] = normalizeForCurrentAttendanceUi([doc]);
  assert.deepEqual(
    {
      date: ui?.date,
      studentName: ui?.studentName,
      studentNo: ui?.studentNo,
      studentUid: ui?.studentUid,
      studentIdentityKey: ui?.studentIdentityKey,
      studentRowNumber: ui?.studentRowNumber,
      instructor: ui?.instructor,
      className: ui?.className,
      classroom: ui?.classroom,
      status: ui?.status,
      attendanceStatus: ui?.attendanceStatus,
      enrollmentStatus: ui?.enrollmentStatus,
      sourceSheet: ui?.sourceSheet,
      sourceRow: ui?.sourceRow,
      sourceCol: ui?.sourceCol,
      sourceCell: ui?.sourceCell,
      sourceKey: ui?.sourceKey
    },
    {
      date: "2026-06-25",
      studentName: "Sample Student",
      studentNo: "12",
      studentUid: "stu_001",
      studentIdentityKey: "uid_stu_001",
      studentRowNumber: 42,
      instructor: "Teacher A",
      className: "Class A",
      classroom: "Room 1",
      status: "\uCD9C\uC11D",
      attendanceStatus: "\uCD9C\uC11D",
      enrollmentStatus: "\uC7AC\uC6D0",
      sourceSheet: "6\uC6D4",
      sourceRow: 10,
      sourceCol: 4,
      sourceCell: "D10",
      sourceKey: "block-0900"
    }
  );
});

test("mirror conversion excludes missing stable identity and reports errors", () => {
  const result = mirrorWebAttendanceRows([{ ...gasSample, studentUid: "", studentIdentityKey: "" }]);
  assert.equal(result.documents.length, 0);
  assert.equal(result.errors[0]?.code, "missing_identity");
});

test("mirror conversion rejects guessed session ids", () => {
  const result = mirrorWebAttendanceRows([{ ...gasSample, sessionId: "", sourceKey: "", sourceCell: "" }]);
  assert.equal(result.documents.length, 0);
  assert.equal(result.errors[0]?.code, "missing_session_key");
});

test("same class can have multiple daily sessions without id collision", () => {
  const first = toAttendanceMirrorDocument({ ...gasSample, sourceKey: "block-0900" });
  const second = toAttendanceMirrorDocument({ ...gasSample, sourceKey: "block-1300" });
  assert.notEqual(first.id, second.id);
});

test("duplicate names and duplicate student numbers require stable identity keys", () => {
  const first = toAttendanceMirrorDocument({ ...gasSample, studentName: "Same", studentNo: "7", studentIdentityKey: "uid-a", studentUid: "uid-a" });
  const second = toAttendanceMirrorDocument({ ...gasSample, studentName: "Same", studentNo: "7", studentIdentityKey: "uid-b", studentUid: "uid-b" });
  assert.notEqual(first.id, second.id);
});

test("feature flag false uses GAS fallback without Firestore read", async () => {
  const snapshot = await readAttendanceSnapshot(
    {
      useFirestoreAttendanceRead: false,
      firestore: {
        async getAttendanceSnapshot() {
          throw new Error("should not be called");
        }
      },
      gas: {
        async request() {
          return { ok: true, source: "gas" as const, records: [{ studentUid: "s1" }] } as never;
        }
      }
    },
    { date: "2026-06-25" }
  );
  assert.equal(snapshot.source, "gas");
  assert.equal(snapshot.records[0]?.studentUid, "s1");
});

test("Firestore failure falls back to GAS", async () => {
  const snapshot = await readAttendanceSnapshot(
    {
      useFirestoreAttendanceRead: true,
      firestore: {
        async getAttendanceSnapshot() {
          throw new Error("emulated outage");
        }
      },
      gas: {
        async request() {
          return { ok: true, source: "gas" as const, records: [{ studentUid: "fallback" }] } as never;
        }
      }
    },
    {}
  );
  assert.equal(snapshot.source, "gas");
  assert.equal(snapshot.records[0]?.studentUid, "fallback");
});


test("malformed Firestore attendance records fall back to GAS instead of returning a partial mirror", async () => {
  const snapshot = await readAttendanceSnapshot(
    {
      useFirestoreAttendanceRead: true,
      firestore: {
        async getAttendanceSnapshot() {
          return [{ ...gasSample, studentUid: "", studentIdentityKey: "" }];
        }
      },
      gas: {
        async request() {
          return { ok: true, source: "gas" as const, records: [{ studentUid: "safe-gas" }] } as never;
        }
      }
    },
    { date: "2026-06-25" }
  );
  assert.equal(snapshot.source, "gas");
  assert.equal(snapshot.records[0]?.studentUid, "safe-gas");
});
