import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { matchStudentIdentityForTest735414, matchClassIdentityForTest735414, operationalDocumentIdsForTest735414, classOperationalDatesForTest735414 } from "../src/admin/dataAuthorityMigration735414.js";

test("student uid exact match", () => {
  const result = matchStudentIdentityForTest735414([{ studentUid: "S1", name: "김하은" }], { studentUid: "S1" });
  assert.equal(result.state, "matched"); assert.equal(result.id, "S1");
});
test("student phone unique match", () => {
  const result = matchStudentIdentityForTest735414([{ studentUid: "S1", name: "김하은", studentPhone: "010-1111-2222" }], { name: "다른표기", phone: "01011112222" });
  assert.equal(result.state, "matched"); assert.equal(result.id, "S1");
});
test("homonym without corroboration is ambiguous", () => {
  const result = matchStudentIdentityForTest735414([{ studentUid: "S1", name: "김민수" }, { studentUid: "S2", name: "김민수" }], { name: "김민수" });
  assert.equal(result.state, "ambiguous");
});
test("name alone never auto matches", () => {
  const result = matchStudentIdentityForTest735414([{ studentUid: "S1", name: "김민수" }], { name: "김민수" });
  assert.equal(result.state, "unmatched");
});
test("name and birth uniquely match", () => {
  const result = matchStudentIdentityForTest735414([{ studentUid: "S1", name: "김민수", birthDate: "2010-01-02" }], { name: "김민수", birthDate: "2010.1.2" });
  assert.equal(result.state, "matched"); assert.equal(result.id, "S1");
});
test("class id exact match", () => {
  const result = matchClassIdentityForTest735414([{ classId: "C1", className: "성우기초" }], { classId: "C1" });
  assert.equal(result.state, "matched");
});
test("class and teacher uniquely match", () => {
  const result = matchClassIdentityForTest735414([{ classId: "C1", className: "성우기초", instructorName: "김하은" }, { classId: "C2", className: "성우기초", instructorName: "박소연" }], { className: "성우기초", instructorName: "김하은T" });
  assert.equal(result.state, "matched"); assert.equal(result.id, "C1");
});
test("duplicate class name without teacher is ambiguous", () => {
  const result = matchClassIdentityForTest735414([{ classId: "C1", className: "성우기초", instructorName: "김하은" }, { classId: "C2", className: "성우기초", instructorName: "박소연" }], { className: "성우기초" });
  assert.equal(result.state, "ambiguous");
});

function sha(prefix: string, ...parts: string[]): string {
  return `${prefix}_${createHash("sha256").update(parts.join("\u001f"), "utf8").digest("hex").slice(0, 40)}`;
}
test("reconciliation uses existing enrollment and attendance document IDs", () => {
  const ids = operationalDocumentIdsForTest735414("2026-08-08", "CLASS1", "STUDENT1");
  assert.equal(ids.enrollmentId, sha("ENR", "STUDENT1", "CLASS1"));
  assert.equal(ids.attendanceId, sha("ATT", "2026-08-08", "CLASS1", "STUDENT1"));
  const memberDigest = createHash("sha256").update("CLASS1|STUDENT1", "utf8").digest("hex").slice(0, 40);
  assert.equal(ids.classMemberId, `member_${memberDigest}`);
});
test("explicit class dates are preferred over generated weekday dates", () => {
  const dates = classOperationalDatesForTest735414({ weekday: 6, dates: ["2099-01-10", "2099-01-17"] }, "2099-01-01");
  assert.deepEqual(dates, ["2099-01-10", "2099-01-17"]);
});
