import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

interface Constraint { field: string; op: string; value: unknown }
interface FakeDoc { id: string; data(): Record<string, unknown> }

function fakeSdk(attendance: Array<Record<string, unknown>>, assignments: Record<string, Array<Record<string, unknown>>>) {
  return {
    collection(_db: unknown, ...segments: string[]) { return { path: segments.join("/") }; },
    where(field: string, op: string, value: unknown): Constraint { return { field, op, value }; },
    query(ref: { path: string }, ...constraints: Constraint[]) { return { ref, constraints }; },
    async getDocs(queryRef: { ref: { path: string }; constraints: Constraint[] }) {
      const path = queryRef.ref.path;
      let rows: Array<Record<string, unknown>>;
      if (path === "attendance") rows = attendance;
      else rows = assignments[path] || [];
      const filtered = rows.filter((row) => queryRef.constraints.every((constraint) => {
        if (constraint.op !== "==") throw new Error("unsupported fake operator");
        return row[constraint.field] === constraint.value;
      }));
      return {
        docs: filtered.map((row, index): FakeDoc => ({
          id: String(row.id || row.classId || index),
          data: () => ({ ...row })
        }))
      };
    },
    async getIdTokenResult(user: { claims: Record<string, unknown> }) { return { claims: user.claims }; }
  };
}

async function loadReader() {
  const url = pathToFileURL(join(process.cwd(), "..", "web", "firestore-attendance-reader.js")).href;
  return await import(`${url}?v=${Date.now()}-${Math.random()}`) as {
    createFirestoreAttendanceReader(options: Record<string, unknown>): { getAttendanceSnapshot(params: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
  };
}

const attendance = [
  { id: "a1", active: true, sessionDate: "2026-07-02", classId: "c1", className: "A반", studentUid: "s1", studentName: "학생1", uiStatus: "출석", legacy: {} },
  { id: "a2", active: true, sessionDate: "2026-07-02", classId: "c2", className: "B반", studentUid: "s2", studentName: "학생2", uiStatus: "결석", legacy: {} },
  { id: "a3", active: false, sessionDate: "2026-07-02", classId: "c1", className: "A반", studentUid: "s1", studentName: "과거", uiStatus: "결석", legacy: {} },
  { id: "a4", active: true, sessionDate: "2026-07-03", classId: "c1", className: "A반", studentUid: "s1", studentName: "다음날", uiStatus: "출석", legacy: {} }
];

test("student reader queries only active own attendance for the requested date", async () => {
  const module = await loadReader();
  const sdk = fakeSdk(attendance, {});
  const reader = module.createFirestoreAttendanceReader({
    sdk,
    db: {},
    auth: { currentUser: { uid: "firebase-s1", claims: { role: "student", studentUid: "s1" } } }
  });
  const rows = await reader.getAttendanceSnapshot({ date: "2026-07-02" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.studentUid, "s1");
  assert.equal(rows[0]?.status, "출석");
});

test("teacher reader loads active assignments and never queries unassigned classes", async () => {
  const module = await loadReader();
  const sdk = fakeSdk(attendance, {
    "teacherAssignments/t1/classes": [
      { id: "c1", classId: "c1", active: true },
      { id: "c2", classId: "c2", active: false }
    ]
  });
  const reader = module.createFirestoreAttendanceReader({
    sdk,
    db: {},
    auth: { currentUser: { uid: "firebase-t1", claims: { role: "teacher", teacherUid: "t1" } } }
  });
  const rows = await reader.getAttendanceSnapshot({ date: "2026-07-02" });
  assert.deepEqual(rows.map((row) => row.classId), ["c1"]);
});

test("superAdmin reader applies current class, keyword, and status filters", async () => {
  const module = await loadReader();
  const sdk = fakeSdk(attendance, {});
  const reader = module.createFirestoreAttendanceReader({
    sdk,
    db: {},
    auth: { currentUser: { uid: "super", claims: { role: "superAdmin" } } }
  });
  const rows = await reader.getAttendanceSnapshot({ date: "2026-07-02", className: "B반", keyword: "학생2", statusFilter: "결석" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.studentUid, "s2");
});

test("reader refuses unauthenticated and malformed-date requests", async () => {
  const module = await loadReader();
  const sdk = fakeSdk(attendance, {});
  const reader = module.createFirestoreAttendanceReader({ sdk, db: {}, auth: { currentUser: null } });
  await assert.rejects(() => reader.getAttendanceSnapshot({ date: "2026/07/02" }), /YYYY-MM-DD/);
  await assert.rejects(() => reader.getAttendanceSnapshot({ date: "2026-07-02" }), /authentication/);
});

test("unassigned teacher, scope-less admin, and inactive assignments return no attendance", async () => {
  const module = await loadReader();
  const sdk = fakeSdk(attendance, {
    "teacherAssignments/t-none/classes": [],
    "teacherAssignments/t-inactive/classes": [{ id: "c1", classId: "c1", active: false }],
    "adminAssignments/firebase-admin/classes": []
  });

  const teacher = module.createFirestoreAttendanceReader({
    sdk,
    db: {},
    auth: { currentUser: { uid: "firebase-t-none", claims: { role: "teacher", teacherUid: "t-none" } } }
  });
  assert.deepEqual(await teacher.getAttendanceSnapshot({ date: "2026-07-02" }), []);

  const inactiveTeacher = module.createFirestoreAttendanceReader({
    sdk,
    db: {},
    auth: { currentUser: { uid: "firebase-t-inactive", claims: { role: "teacher", teacherUid: "t-inactive" } } }
  });
  assert.deepEqual(await inactiveTeacher.getAttendanceSnapshot({ date: "2026-07-02" }), []);

  const admin = module.createFirestoreAttendanceReader({
    sdk,
    db: {},
    auth: { currentUser: { uid: "firebase-admin", claims: { role: "admin" } } }
  });
  assert.deepEqual(await admin.getAttendanceSnapshot({ date: "2026-07-02" }), []);
});

test("superAdmin reads all active records for the requested date only", async () => {
  const module = await loadReader();
  const sdk = fakeSdk(attendance, {});
  const reader = module.createFirestoreAttendanceReader({
    sdk,
    db: {},
    auth: { currentUser: { uid: "super", claims: { role: "superAdmin" } } }
  });
  const rows = await reader.getAttendanceSnapshot({ date: "2026-07-02" });
  assert.deepEqual(rows.map((row) => row.studentUid).sort(), ["s1", "s2"]);
});
