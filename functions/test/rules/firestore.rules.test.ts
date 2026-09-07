import test, { after, before, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where
} from "firebase/firestore";

let testEnv: RulesTestEnvironment | undefined;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "ulimvoice-phase2-2-test",
    firestore: {
      rules: readFileSync(join(process.cwd(), "..", "firestore.rules"), "utf8")
    }
  });
});

beforeEach(async () => {
  if (!testEnv) throw new Error("Rules test environment is not initialized");
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "legacyAccounts/legacy-safe-account"), { role: "student", studentUid: "s1", active: true, source: "legacy_gas" });
    await setDoc(doc(db, "users/firebaseS1"), { firebaseUid: "firebaseS1", role: "student", studentUid: "s1", active: true, authVersion: 1 });
    await setDoc(doc(db, "users/firebaseSInactive"), { firebaseUid: "firebaseSInactive", role: "student", studentUid: "s1", active: false, authVersion: 1 });
    await setDoc(doc(db, "users/firebaseSVersion2"), { firebaseUid: "firebaseSVersion2", role: "student", studentUid: "s1", active: true, authVersion: 2 });
    await setDoc(doc(db, "users/firebaseSRoleMismatch"), { firebaseUid: "firebaseSRoleMismatch", role: "teacher", studentUid: "s1", active: true, authVersion: 1 });
    await setDoc(doc(db, "users/firebaseSBoundMismatch"), { firebaseUid: "firebaseSBoundMismatch", role: "student", studentUid: "s2", active: true, authVersion: 1 });
    await setDoc(doc(db, "users/firebaseT1"), { firebaseUid: "firebaseT1", role: "teacher", teacherUid: "t1", active: true, authVersion: 1 });
    await setDoc(doc(db, "users/firebaseTBoundMismatch"), { firebaseUid: "firebaseTBoundMismatch", role: "teacher", teacherUid: "t2", active: true, authVersion: 1 });
    await setDoc(doc(db, "users/adminNoScope"), { firebaseUid: "adminNoScope", role: "admin", active: true, authVersion: 1 });
    await setDoc(doc(db, "users/adminScoped"), { firebaseUid: "adminScoped", role: "admin", active: true, authVersion: 1 });
    await setDoc(doc(db, "users/adminWithStaleStudent"), { firebaseUid: "adminWithStaleStudent", role: "admin", studentUid: "s1", active: true, authVersion: 1 });
    await setDoc(doc(db, "users/super1"), { firebaseUid: "super1", role: "superAdmin", active: true, authVersion: 1 });
    await setDoc(doc(db, "users/superInactive"), { firebaseUid: "superInactive", role: "superAdmin", active: false, authVersion: 1 });
    await setDoc(doc(db, "users/superVersion2"), { firebaseUid: "superVersion2", role: "superAdmin", active: true, authVersion: 2 });
    await setDoc(doc(db, "users/superRoleMismatch"), { firebaseUid: "superRoleMismatch", role: "admin", active: true, authVersion: 1 });
    await setDoc(doc(db, "users/superWithStaleTeacher"), { firebaseUid: "superWithStaleTeacher", role: "superAdmin", teacherUid: "t1", active: true, authVersion: 1 });
    await setDoc(doc(db, "attendance/a1"), { studentUid: "s1", classId: "c1", sessionDate: "2026-07-02", status: "present", active: true });
    await setDoc(doc(db, "attendance/a2"), { studentUid: "s2", classId: "c2", sessionDate: "2026-07-02", status: "present", active: true });
    await setDoc(doc(db, "attendance/a3"), { studentUid: "s1", classId: "c1", sessionDate: "2026-07-02", status: "absent", active: false });
    await setDoc(doc(db, "practiceLogs/p1"), { studentUid: "s1", classId: "c1", body: "mine" });
    await setDoc(doc(db, "practiceLogs/p2"), { studentUid: "s2", classId: "c2", body: "other" });
    await setDoc(doc(db, "students/s1"), { studentUid: "s1", classId: "c1", displayName: "Student 1" });
    await setDoc(doc(db, "studentPrivateContacts/s1"), { studentUid: "s1", classId: "c1", phone: "010", parentPhone: "010" });
    await setDoc(doc(db, "studentPrivateContacts/s3"), { studentUid: "s3", classId: "c3", phone: "010", parentPhone: "010" });
    await setDoc(doc(db, "teacherAssignments/t1/classes/c1"), { active: true });
    await setDoc(doc(db, "teacherAssignments/t1/classes/c3"), { active: false });
    await setDoc(doc(db, "adminAssignments/adminScoped/classes/c1"), { active: true });
    await setDoc(doc(db, "adminAssignments/adminScoped/classes/c3"), { active: false });
    await setDoc(doc(db, "classMembers/c1_s1"), {
      classId: "c1",
      studentUid: "s1",
      active: true,
      studentName: "Student 1",
      studentIdentityKey: "sid_s1",
      instructorUids: ["t1"],
      enrollmentStatus: "active",
      updatedAt: "2026-06-26T00:00:00.000Z",
      source: "test"
    });
    await setDoc(doc(db, "classMembers/c4_s1"), {
      classId: "c4",
      studentUid: "s1",
      active: true,
      studentName: "Student 1",
      studentIdentityKey: "sid_s1",
      instructorUids: ["t2"],
      enrollmentStatus: "active",
      updatedAt: "2026-06-26T00:00:00.000Z",
      source: "test"
    });
    await setDoc(doc(db, "classMembers/c1_s2"), {
      classId: "c1",
      studentUid: "s2",
      active: true,
      studentName: "Student 2",
      studentIdentityKey: "sid_s2",
      instructorUids: ["t1"],
      enrollmentStatus: "active",
      updatedAt: "2026-06-26T00:00:00.000Z",
      source: "test"
    });
    await setDoc(doc(db, "classMembers/c3_s3"), {
      classId: "c3",
      studentUid: "s3",
      active: true,
      studentName: "Student 3",
      studentIdentityKey: "sid_s3",
      instructorUids: ["t1"],
      enrollmentStatus: "active",
      updatedAt: "2026-06-26T00:00:00.000Z",
      source: "test"
    });
    await setDoc(doc(db, "classMembers/c1_s4_inactive"), {
      classId: "c1",
      studentUid: "s4",
      active: false,
      studentName: "Student 4",
      studentIdentityKey: "sid_s4",
      instructorUids: ["t1"],
      enrollmentStatus: "hold",
      updatedAt: "2026-06-26T00:00:00.000Z",
      source: "test"
    });
    await setDoc(doc(db, "roomAvailability/slot1"), { date: "2026-06-25", room: "A", slot: "10:00", available: true });
    await setDoc(doc(db, "roomReservations/r1"), { studentUid: "s1", classId: "c1", date: "2026-06-25", privateName: "Student 1" });
    await setDoc(doc(db, "roomReservations/r2"), { studentUid: "s2", classId: "c2", date: "2026-06-25", privateName: "Student 2" });
    await setDoc(doc(db, "classroomAvailability/room1"), { date: "2026-06-25", room: "A", occupied: true });
    await setDoc(doc(db, "mirrorState/attendance"), { lastRunAt: "2026-06-25T00:00:00.000Z" });
    await setDoc(doc(db, "syncOperations/req1"), { status: "pending" });
  });
});

after(async () => {
  await testEnv?.cleanup();
});

function authedDb(uid: string, token: Record<string, unknown>) {
  if (!testEnv) throw new Error("Rules test environment is not initialized");
  return testEnv.authenticatedContext(uid, token).firestore();
}

function token(value: Record<string, unknown>): Record<string, unknown> {
  return { authVersion: 1, ...value };
}

test("student can query own attendance and practiceLogs only", async () => {
  const db = authedDb("firebaseS1", token({ role: "student", studentUid: "s1" }));
  await assertSucceeds(getDoc(doc(db, "attendance/a1")));
  await assertFails(getDoc(doc(db, "attendance/a2")));
  await assertSucceeds(getDocs(query(collection(db, "attendance"), where("studentUid", "==", "s1"), where("active", "==", true))));
  await assertFails(getDocs(collection(db, "attendance")));
  await assertFails(getDocs(query(collection(db, "attendance"), where("studentUid", "==", "s2"), where("active", "==", true))));
  await assertSucceeds(getDoc(doc(db, "practiceLogs/p1")));
  await assertFails(getDoc(doc(db, "practiceLogs/p2")));
  await assertSucceeds(getDocs(query(collection(db, "practiceLogs"), where("studentUid", "==", "s1"))));
  await assertFails(getDocs(query(collection(db, "practiceLogs"), where("studentUid", "==", "s2"))));
});


test("inactive attendance mirror documents are denied to every client role", async () => {
  const studentDb = authedDb("firebaseS1", token({ role: "student", studentUid: "s1" }));
  const teacherDb = authedDb("firebaseT1", token({ role: "teacher", teacherUid: "t1" }));
  const adminDb = authedDb("adminScoped", token({ role: "admin" }));
  const superDb = authedDb("super1", token({ role: "superAdmin" }));
  for (const db of [studentDb, teacherDb, adminDb, superDb]) {
    await assertFails(getDoc(doc(db, "attendance/a3")));
  }
});

test("student can read own class memberships but not other student memberships", async () => {
  const db = authedDb("firebaseS1", token({ role: "student", studentUid: "s1" }));
  await assertSucceeds(getDocs(query(collection(db, "classMembers"), where("studentUid", "==", "s1"), where("active", "==", true))));
  await assertFails(getDocs(query(collection(db, "classMembers"), where("studentUid", "==", "s2"), where("active", "==", true))));
  await assertFails(getDocs(query(collection(db, "classMembers"), where("studentUid", "==", "s1"))));
});

test("teacher can query active assigned class and cannot read inactive or missing assignments", async () => {
  const db = authedDb("firebaseT1", token({ role: "teacher", teacherUid: "t1" }));
  await assertSucceeds(getDocs(query(collection(db, "attendance"), where("classId", "==", "c1"), where("active", "==", true))));
  await assertFails(getDoc(doc(db, "attendance/a2")));
  await assertFails(getDocs(query(collection(db, "attendance"), where("classId", "==", "c2"), where("active", "==", true))));
  await assertFails(getDocs(query(collection(db, "attendance"), where("classId", "==", "c3"), where("active", "==", true))));
  await assertSucceeds(getDocs(query(collection(db, "classMembers"), where("classId", "==", "c1"), where("active", "==", true))));
  await assertFails(getDocs(query(collection(db, "classMembers"), where("classId", "==", "c3"), where("active", "==", true))));
  await assertFails(getDocs(query(collection(db, "classMembers"), where("classId", "==", "c1"), where("active", "==", false))));
});

test("admin without assignment scope cannot read arbitrary class data", async () => {
  const db = authedDb("adminNoScope", token({ role: "admin" }));
  await assertFails(getDoc(doc(db, "attendance/a1")));
  await assertFails(getDocs(query(collection(db, "attendance"), where("classId", "==", "c1"), where("active", "==", true))));
});

test("admin with explicit Firestore scope can read scoped class only", async () => {
  const db = authedDb("adminScoped", token({ role: "admin" }));
  await assertSucceeds(getDoc(doc(db, "attendance/a1")));
  await assertSucceeds(getDocs(query(collection(db, "attendance"), where("classId", "==", "c1"), where("active", "==", true))));
  await assertFails(getDoc(doc(db, "attendance/a2")));
  await assertFails(getDocs(query(collection(db, "attendance"), where("classId", "==", "c3"), where("active", "==", true))));
  await assertSucceeds(getDocs(query(collection(db, "classMembers"), where("classId", "==", "c1"), where("active", "==", true))));
  await assertFails(getDocs(query(collection(db, "classMembers"), where("classId", "==", "c3"), where("active", "==", true))));
});

test("superAdmin can read allowed management collections", async () => {
  const db = authedDb("super1", token({ role: "superAdmin" }));
  await assertSucceeds(getDoc(doc(db, "mirrorState/attendance")));
  await assertSucceeds(getDoc(doc(db, "studentPrivateContacts/s1")));
});

test("student private contacts are limited to superAdmin and active scoped admin", async () => {
  const superAdminDb = authedDb("super1", token({ role: "superAdmin" }));
  const activeAdminDb = authedDb("adminScoped", token({ role: "admin" }));
  const inactiveAdminDb = authedDb("adminScoped", token({ role: "admin" }));
  const unscopedAdminDb = authedDb("adminNoScope", token({ role: "admin" }));
  const teacherDb = authedDb("firebaseT1", token({ role: "teacher", teacherUid: "t1" }));
  const studentDb = authedDb("firebaseS1", token({ role: "student", studentUid: "s1" }));

  await assertSucceeds(getDoc(doc(superAdminDb, "studentPrivateContacts/s1")));
  await assertSucceeds(getDoc(doc(activeAdminDb, "studentPrivateContacts/s1")));
  await assertFails(getDoc(doc(inactiveAdminDb, "studentPrivateContacts/s3")));
  await assertFails(getDoc(doc(unscopedAdminDb, "studentPrivateContacts/s1")));
  await assertFails(getDoc(doc(teacherDb, "studentPrivateContacts/s1")));
  await assertFails(getDoc(doc(studentDb, "studentPrivateContacts/s1")));
  await assertFails(setDoc(doc(superAdminDb, "studentPrivateContacts/s1"), { classId: "c1" }));
});

test("student cannot read other student's private room reservation details", async () => {
  const db = authedDb("firebaseS1", token({ role: "student", studentUid: "s1" }));
  await assertSucceeds(getDoc(doc(db, "roomReservations/r1")));
  await assertFails(getDoc(doc(db, "roomReservations/r2")));
  await assertSucceeds(getDocs(query(collection(db, "roomReservations"), where("studentUid", "==", "s1"))));
  await assertFails(getDocs(collection(db, "roomReservations")));
  await assertFails(getDocs(query(collection(db, "roomReservations"), where("studentUid", "==", "s2"))));
  await assertSucceeds(getDoc(doc(db, "roomAvailability/slot1")));
});

test("all final mirror collections reject client writes", async () => {
  const db = authedDb("super1", token({ role: "superAdmin" }));
  await assertFails(setDoc(doc(db, "attendance/new"), { studentUid: "s1", classId: "c1" }));
  await assertFails(setDoc(doc(db, "practiceLogs/new"), { studentUid: "s1", classId: "c1" }));
  await assertFails(setDoc(doc(db, "dailyEvaluations/new"), { studentUid: "s1", classId: "c1" }));
  await assertFails(setDoc(doc(db, "teacherEvaluations/new"), { studentUid: "s1", classId: "c1" }));
  await assertFails(setDoc(doc(db, "roomReservations/new"), { studentUid: "s1", classId: "c1" }));
});

test("syncOperations and mirrorState reject normal client access", async () => {
  const db = authedDb("firebaseS1", token({ role: "student", studentUid: "s1" }));
  await assertFails(getDoc(doc(db, "syncOperations/req1")));
  await assertFails(setDoc(doc(db, "syncOperations/req2"), { status: "pending" }));
  await assertFails(getDoc(doc(db, "mirrorState/attendance")));
});

test("operational reads require active user document and matching authVersion and role", async () => {
  const activeDb = authedDb("firebaseS1", token({ role: "student", studentUid: "s1" }));
  const inactiveDb = authedDb("firebaseSInactive", token({ role: "student", studentUid: "s1" }));
  const versionMismatchDb = authedDb("firebaseSVersion2", token({ role: "student", studentUid: "s1" }));
  const roleMismatchDb = authedDb("firebaseSRoleMismatch", token({ role: "student", studentUid: "s1" }));

  await assertSucceeds(getDoc(doc(activeDb, "attendance/a1")));
  await assertFails(getDoc(doc(inactiveDb, "attendance/a1")));
  await assertFails(getDoc(doc(versionMismatchDb, "attendance/a1")));
  await assertFails(getDoc(doc(roleMismatchDb, "attendance/a1")));
});

test("superAdmin reads require active user document and matching authVersion and role", async () => {
  const activeDb = authedDb("super1", token({ role: "superAdmin" }));
  const inactiveDb = authedDb("superInactive", token({ role: "superAdmin" }));
  const versionMismatchDb = authedDb("superVersion2", token({ role: "superAdmin" }));
  const roleMismatchDb = authedDb("superRoleMismatch", token({ role: "superAdmin" }));

  await assertSucceeds(getDoc(doc(activeDb, "students/s1")));
  await assertSucceeds(getDoc(doc(activeDb, "studentPrivateContacts/s1")));
  await assertSucceeds(getDocs(query(collection(activeDb, "classes"), where("active", "==", true))));
  await assertSucceeds(getDocs(query(collection(activeDb, "classMembers"), where("active", "==", true))));
  await assertSucceeds(getDoc(doc(activeDb, "mirrorState/attendance")));

  for (const deniedDb of [inactiveDb, versionMismatchDb, roleMismatchDb]) {
    await assertFails(getDoc(doc(deniedDb, "students/s1")));
    await assertFails(getDoc(doc(deniedDb, "studentPrivateContacts/s1")));
    await assertFails(getDocs(query(collection(deniedDb, "classes"), where("active", "==", true))));
    await assertFails(getDocs(query(collection(deniedDb, "classMembers"), where("active", "==", true))));
    await assertFails(getDoc(doc(deniedDb, "mirrorState/attendance")));
  }
});

test("active user document must match token identifiers and forbid stale role uid fields", async () => {
  const studentMismatchDb = authedDb("firebaseSBoundMismatch", token({ role: "student", studentUid: "s1" }));
  const teacherMismatchDb = authedDb("firebaseTBoundMismatch", token({ role: "teacher", teacherUid: "t1" }));
  const adminWithStudentDb = authedDb("adminWithStaleStudent", token({ role: "admin" }));
  const superWithTeacherDb = authedDb("superWithStaleTeacher", token({ role: "superAdmin" }));

  await assertFails(getDoc(doc(studentMismatchDb, "attendance/a1")));
  await assertFails(getDocs(query(collection(teacherMismatchDb, "attendance"), where("classId", "==", "c1"))));
  await assertFails(getDoc(doc(adminWithStudentDb, "attendance/a1")));
  await assertFails(getDoc(doc(superWithTeacherDb, "mirrorState/attendance")));
});


test("legacy source account documents are server-only for every client role", async () => {
  const databases = [
    authedDb("firebaseS1", token({ role: "student", studentUid: "s1" })),
    authedDb("firebaseT1", token({ role: "teacher", teacherUid: "t1" })),
    authedDb("adminScoped", token({ role: "admin" })),
    authedDb("super1", token({ role: "superAdmin" }))
  ];
  for (const db of databases) {
    await assertFails(getDoc(doc(db, "legacyAccounts/legacy-safe-account")));
    await assertFails(setDoc(doc(db, "legacyAccounts/legacy-safe-account"), { active: false }));
  }
});
