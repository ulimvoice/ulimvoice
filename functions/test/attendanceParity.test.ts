import test from "node:test";
import assert from "node:assert/strict";
import {
  mirrorWebAttendanceRows,
  normalizeForCurrentAttendanceUi,
  type LegacyAttendanceRecord
} from "../src/mirror/attendanceMirror.js";
import { compareAttendanceParity } from "../src/mirror/attendanceParity.js";
import { attendanceParityFixture } from "./fixtures/attendancePrevalidationFixture.js";

test("GAS and Firestore attendance parity ignores ordering and covers all operational statuses", () => {
  const converted = mirrorWebAttendanceRows(attendanceParityFixture, new Date("2026-07-04T00:00:00.000Z"));
  assert.equal(converted.errors.length, 0);
  const firestore = normalizeForCurrentAttendanceUi(converted.documents).reverse();
  const result = compareAttendanceParity(attendanceParityFixture, firestore);
  assert.equal(result.parityPass, true);
  assert.equal(result.gasCount, attendanceParityFixture.length);
  assert.equal(result.missingInFirestore.length, 0);
  assert.equal(result.mismatches.length, 0);
});

test("parity reports missing, extra, and field-level mismatches", () => {
  const converted = mirrorWebAttendanceRows(attendanceParityFixture);
  const firestore = normalizeForCurrentAttendanceUi(converted.documents);
  const changed = firestore.map((record) => ({ ...record }));
  changed.splice(0, 1);
  changed[0] = { ...changed[0], attendanceStatus: "출석", status: "출석" };
  changed.push({
    ...changed[0],
    studentUid: "STU-EXTRA",
    studentIdentityKey: "UID|STU-EXTRA",
    sessionId: "session-extra"
  } as LegacyAttendanceRecord);
  const result = compareAttendanceParity(attendanceParityFixture, changed);
  assert.equal(result.parityPass, false);
  assert.equal(result.missingInFirestore.length, 1);
  assert.equal(result.extraInFirestore.length, 1);
  assert.equal(result.mismatches.some((item) => item.fields.includes("status")), true);
});

test("parity rejects UID-less and unstable-session records instead of guessing identity", () => {
  const result = compareAttendanceParity(
    [{ ...attendanceParityFixture[0], studentUid: "" }],
    [{ ...attendanceParityFixture[0], sessionId: "", sourceKey: "", sourceCell: "" }]
  );
  assert.equal(result.parityPass, false);
  assert.deepEqual(result.invalidRecords.map((item) => item.side).sort(), ["firestore", "gas"]);
});
