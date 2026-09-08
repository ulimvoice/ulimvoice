import test from "node:test";
import assert from "node:assert/strict";
import {
  mirrorWebAttendanceRows,
  toAttendanceMirrorDocument,
  type LegacyAttendanceRecord
} from "../src/mirror/attendanceMirror.js";
import { auditAttendanceMirrorPrivacy } from "../src/mirror/attendancePrivacy.js";
import { buildAttendanceMirrorPlan } from "../src/mirror/attendanceMirrorPlan.js";
import { attendanceParityFixture } from "./fixtures/attendancePrevalidationFixture.js";

test("attendance mirror excludes UID-less and phone-derived identity records", () => {
  const missingUid = mirrorWebAttendanceRows([{ ...attendanceParityFixture[0], studentUid: "", studentIdentityKey: "이름|1234" }]);
  assert.equal(missingUid.documents.length, 0);
  assert.equal(missingUid.errors[0]?.code, "missing_identity");

  const phoneIdentity = mirrorWebAttendanceRows([{ ...attendanceParityFixture[0], studentIdentityKey: "phone|01012345678" }]);
  assert.equal(phoneIdentity.documents.length, 0);
  assert.equal(phoneIdentity.errors[0]?.code, "unsafe_identity");

  const nameAndLast4Identity = mirrorWebAttendanceRows([{
    ...attendanceParityFixture[0],
    studentUid: "VERIFIED-UID",
    studentIdentityKey: "홍길동|1234"
  }]);
  assert.equal(nameAndLast4Identity.documents.length, 0);
  assert.equal(nameAndLast4Identity.errors[0]?.code, "unsafe_identity");
});

test("attendance mirror fails closed on UID and identity-key conflicts", () => {
  const sameUidDifferentKey = mirrorWebAttendanceRows([
    attendanceParityFixture[0],
    { ...attendanceParityFixture[0], sessionId: "session-conflict-1", studentIdentityKey: "UID|OTHER" }
  ]);
  assert.equal(sameUidDifferentKey.errors.some((item) => item.code === "identity_conflict"), true);

  const sameKeyDifferentUid = mirrorWebAttendanceRows([
    attendanceParityFixture[0],
    { ...attendanceParityFixture[0], sessionId: "session-conflict-2", studentUid: "STU-OTHER" }
  ]);
  assert.equal(sameKeyDifferentUid.errors.some((item) => item.code === "identity_conflict"), true);
});

test("phone, parent, token, messaging, and private Drive fields cannot leak into mirror documents", () => {
  const source = {
    ...attendanceParityFixture[0],
    studentPhone: "010-0000-0000",
    parentPhone: "010-1111-1111",
    phoneLast4: "0000",
    gasSessionToken: "secret",
    firebaseProof: "secret",
    adminToken: "secret",
    solapiKey: "secret",
    privateDriveFileId: "private"
  } as LegacyAttendanceRecord;
  const document = toAttendanceMirrorDocument(source);
  assert.equal(auditAttendanceMirrorPrivacy([document]).length, 0);
  const serialized = JSON.stringify(document);
  for (const secret of ["010-0000-0000", "010-1111-1111", "secret", "private"]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("fixture mirror plan covers statuses, duplicate numbers, duplicate names, and multiple classes safely", () => {
  const plan = buildAttendanceMirrorPlan(attendanceParityFixture, [], { sessionDate: "2026-07-04" }, {
    runId: "prevalidation-fixture",
    now: new Date("2026-07-04T00:00:00.000Z")
  });
  assert.equal(plan.safeToCommit, true);
  assert.equal(plan.acceptedCount, attendanceParityFixture.length);
  assert.equal(new Set(plan.upserts.map((item) => item.id)).size, attendanceParityFixture.length);
  assert.deepEqual(new Set(plan.upserts.map((item) => item.status)), new Set(["present", "absent", "late", "unchecked", "hold"]));
  assert.equal(plan.upserts.filter((item) => item.studentName === "동명이인").length, 2);
  assert.equal(plan.upserts.filter((item) => item.studentUid === "STU-1").length, 2);
});
