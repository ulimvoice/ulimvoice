import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStableClassId,
  toAttendanceMirrorDocument,
  type LegacyAttendanceRecord
} from "../src/mirror/attendanceMirror.js";
import {
  ATTENDANCE_MIRROR_VERSION,
  attendancePayloadDigest,
  buildAttendanceMirrorPlan,
  type StoredAttendanceMirrorDocument
} from "../src/mirror/attendanceMirrorPlan.js";
import {
  runAttendanceMirror,
  UnsafeAttendanceMirrorPlanError
} from "../src/mirror/attendanceMirrorService.js";
import type {
  AttendanceMirrorCommitResult,
  AttendanceMirrorRepository
} from "../src/mirror/firestoreAttendanceMirrorRepository.js";

const base: LegacyAttendanceRecord = {
  date: "2026-07-02",
  className: "[이용우T] 목요일 연기기초 (19:00~21:00)",
  instructor: "이용우",
  studentName: "테스트학생",
  studentUid: "student-1",
  studentIdentityKey: "student-1",
  studentNo: "1234",
  status: "출석",
  sourceSheet: "이용우",
  sourceCell: "D10",
  sourceKey: "이용우|D10",
  startTime: "19:00",
  endTime: "21:00"
};

function stored(row: LegacyAttendanceRecord, active = true): StoredAttendanceMirrorDocument {
  const doc = toAttendanceMirrorDocument(row, new Date("2026-07-02T00:00:00.000Z"));
  return {
    ...doc,
    active,
    mirrorVersion: ATTENDANCE_MIRROR_VERSION,
    mirrorRunId: "old-run",
    scopeKey: "date_2026-07-02",
    payloadDigest: attendancePayloadDigest(doc),
    syncedAt: "2026-07-02T00:00:00.000Z"
  };
}

test("derives deterministic classId from current GAS className and instructor", () => {
  const first = buildStableClassId(base);
  const second = buildStableClassId({ ...base, className: `  ${base.className} ` });
  assert.match(first || "", /^legacy_[a-f0-9]{24}$/);
  assert.equal(first, second);
  const document = toAttendanceMirrorDocument(base);
  assert.equal(document.classId, first);
  assert.equal(document.sessionStartTime, "19:00");
  assert.equal(document.sessionEndTime, "21:00");
});

test("builds an upsert-only plan for a new date snapshot", () => {
  const plan = buildAttendanceMirrorPlan([base], [], { sessionDate: "2026-07-02" }, {
    runId: "run-1",
    now: new Date("2026-07-02T01:00:00.000Z")
  });
  assert.equal(plan.safeToCommit, true);
  assert.equal(plan.upserts.length, 1);
  assert.equal(plan.staleIds.length, 0);
  assert.equal(plan.reconciliation.missingIds.length, 1);
  assert.equal(plan.upserts[0]?.active, true);
  assert.equal("studentPhone" in (plan.upserts[0] || {}), false);
  assert.equal("parentPhone" in (plan.upserts[0] || {}), false);
});

test("unchanged records are not rewritten", () => {
  const current = stored(base);
  const plan = buildAttendanceMirrorPlan([base], [current], { sessionDate: "2026-07-02" }, {
    runId: "run-2",
    now: new Date("2026-07-02T02:00:00.000Z")
  });
  assert.equal(plan.upserts.length, 0);
  assert.deepEqual(plan.unchangedIds, [current.id]);
});

test("changed status is reconciled as a mismatched upsert", () => {
  const current = stored(base);
  const plan = buildAttendanceMirrorPlan([{ ...base, status: "결석" }], [current], { sessionDate: "2026-07-02" });
  assert.equal(plan.upserts.length, 1);
  assert.deepEqual(plan.reconciliation.mismatchedIds, [current.id]);
  assert.equal(plan.upserts[0]?.status, "absent");
});

test("empty authoritative snapshots fail closed when active mirror rows exist", () => {
  const current = stored(base);
  const plan = buildAttendanceMirrorPlan([], [current], { sessionDate: "2026-07-02" });
  assert.equal(plan.safeToCommit, false);
  assert.equal(plan.errors[0]?.code, "suspicious_empty_snapshot");
  assert.deepEqual(plan.staleIds, [current.id]);
  assert.deepEqual(plan.reconciliation.extraActiveIds, [current.id]);
});

test("an explicitly confirmed empty snapshot may mark prior rows stale", () => {
  const current = stored(base);
  const plan = buildAttendanceMirrorPlan([], [current], { sessionDate: "2026-07-02" }, {
    allowEmptySnapshot: true
  });
  assert.equal(plan.safeToCommit, true);
  assert.deepEqual(plan.staleIds, [current.id]);
});

test("invalid rows and rows outside the scope fail closed", () => {
  const invalid = buildAttendanceMirrorPlan([{ ...base, studentUid: "", studentIdentityKey: "" }], [], { sessionDate: "2026-07-02" });
  assert.equal(invalid.safeToCommit, false);
  assert.equal(invalid.errors[0]?.code, "conversion_error");

  const wrongDate = buildAttendanceMirrorPlan([{ ...base, date: "2026-07-03" }], [], { sessionDate: "2026-07-02" });
  assert.equal(wrongDate.safeToCommit, false);
  assert.equal(wrongDate.errors[0]?.code, "scope_mismatch");
});

class MemoryRepository implements AttendanceMirrorRepository {
  data: StoredAttendanceMirrorDocument[] = [];
  commits = 0;

  async loadScope(): Promise<StoredAttendanceMirrorDocument[]> {
    return this.data;
  }

  async commit(plan: ReturnType<typeof buildAttendanceMirrorPlan>): Promise<AttendanceMirrorCommitResult> {
    this.commits += 1;
    const stale = new Set(plan.staleIds);
    this.data = this.data
      .map((document) => stale.has(document.id) ? { ...document, active: false } : document)
      .filter((document) => !plan.upserts.some((upsert) => upsert.id === document.id))
      .concat(plan.upserts);
    return {
      runId: plan.runId,
      scopeKey: plan.scopeKey,
      written: plan.upserts.length,
      staleMarked: plan.staleIds.length,
      unchanged: plan.unchangedIds.length,
      stateDocumentId: "mirror-state"
    };
  }
}

test("mirror service supports dry-run and post-write verification", async () => {
  const repository = new MemoryRepository();
  const source = { async fetchAttendance() { return [base]; } };
  const dryRun = await runAttendanceMirror({ source, repository, scope: { sessionDate: "2026-07-02" }, dryRun: true });
  assert.equal(dryRun.plan.upserts.length, 1);
  assert.equal(repository.commits, 0);

  const completed = await runAttendanceMirror({ source, repository, scope: { sessionDate: "2026-07-02" }, verifyAfterWrite: true });
  assert.equal(repository.commits, 1);
  assert.equal(completed.verification?.upserts.length, 0);
  assert.equal(completed.verification?.staleIds.length, 0);
});

test("mirror service rejects unsafe source data before repository commit", async () => {
  const repository = new MemoryRepository();
  const source = { async fetchAttendance() { return [{ ...base, sourceKey: "", sourceCell: "" }]; } };
  await assert.rejects(
    () => runAttendanceMirror({ source, repository, scope: { sessionDate: "2026-07-02" } }),
    UnsafeAttendanceMirrorPlanError
  );
  assert.equal(repository.commits, 0);
});

test("mirror service requires an explicit override before committing a populated scope as empty", async () => {
  const repository = new MemoryRepository();
  repository.data = [stored(base)];
  const source = { async fetchAttendance() { return []; } };

  await assert.rejects(
    () => runAttendanceMirror({ source, repository, scope: { sessionDate: "2026-07-02" } }),
    UnsafeAttendanceMirrorPlanError
  );
  assert.equal(repository.commits, 0);

  const completed = await runAttendanceMirror({
    source,
    repository,
    scope: { sessionDate: "2026-07-02" },
    allowEmptySnapshot: true
  });
  assert.equal(completed.commit?.staleMarked, 1);
  assert.equal(repository.commits, 1);
});
