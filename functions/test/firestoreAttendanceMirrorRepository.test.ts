import test from "node:test";
import assert from "node:assert/strict";
import type { Firestore } from "firebase-admin/firestore";
import type { LegacyAttendanceRecord } from "../src/mirror/attendanceMirror.js";
import {
  ATTENDANCE_MIRROR_VERSION,
  attendancePayloadDigest,
  buildAttendanceMirrorPlan,
  type StoredAttendanceMirrorDocument
} from "../src/mirror/attendanceMirrorPlan.js";
import { toAttendanceMirrorDocument } from "../src/mirror/attendanceMirror.js";
import { FirestoreAttendanceMirrorRepository } from "../src/mirror/firestoreAttendanceMirrorRepository.js";

interface RecordedWrite {
  path: string;
  data: unknown;
  options?: unknown;
}

class FakeBatch {
  readonly writes: RecordedWrite[] = [];
  committed = false;

  set(ref: { path: string }, data: unknown, options?: unknown): FakeBatch {
    this.writes.push({ path: ref.path, data, options });
    return this;
  }

  async commit(): Promise<void> {
    this.committed = true;
  }
}

class FakeFirestore {
  readonly batches: FakeBatch[] = [];

  collection(name: string): { doc: (id: string) => { path: string } } {
    return {
      doc: (id: string) => ({ path: `${name}/${id}` })
    };
  }

  batch(): FakeBatch {
    const batch = new FakeBatch();
    this.batches.push(batch);
    return batch;
  }
}

function row(index: number): LegacyAttendanceRecord {
  return {
    date: "2026-07-02",
    className: "[이용우T] 목요일 연기기초 (19:00~21:00)",
    instructor: "이용우",
    studentName: `학생${index}`,
    studentUid: `student-${index}`,
    studentIdentityKey: `student-${index}`,
    studentNo: String(1000 + index),
    status: "출석",
    sourceSheet: "이용우",
    sourceCell: `D${10 + index}`,
    sourceKey: `이용우|D${10 + index}`,
    startTime: "19:00",
    endTime: "21:00"
  };
}

function stored(record: LegacyAttendanceRecord): StoredAttendanceMirrorDocument {
  const document = toAttendanceMirrorDocument(record, new Date("2026-07-02T00:00:00.000Z"));
  return {
    ...document,
    active: true,
    mirrorVersion: ATTENDANCE_MIRROR_VERSION,
    mirrorRunId: "old-run",
    scopeKey: "date_2026-07-02",
    payloadDigest: attendancePayloadDigest(document),
    syncedAt: "2026-07-02T00:00:00.000Z"
  };
}

test("repository splits attendance writes into bounded batches and writes mirror state separately", async () => {
  const rows = Array.from({ length: 405 }, (_, index) => row(index));
  const staleRows = [stored(row(1000)), stored(row(1001))];
  const plan = buildAttendanceMirrorPlan(rows, staleRows, { sessionDate: "2026-07-02" }, {
    runId: "batch-run",
    now: new Date("2026-07-02T03:00:00.000Z")
  });
  assert.equal(plan.safeToCommit, true);
  assert.equal(plan.upserts.length, 405);
  assert.equal(plan.staleIds.length, 2);

  const fake = new FakeFirestore();
  const repository = new FirestoreAttendanceMirrorRepository(fake as unknown as Firestore, 400);
  const result = await repository.commit(plan);

  assert.equal(fake.batches.length, 3);
  assert.equal(fake.batches[0]?.writes.length, 400);
  assert.equal(fake.batches[1]?.writes.length, 7);
  assert.equal(fake.batches[2]?.writes.length, 2);
  assert.equal(fake.batches.every((batch) => batch.committed), true);
  assert.equal(result.written, 405);
  assert.equal(result.staleMarked, 2);

  const staleWrites = fake.batches
    .slice(0, 2)
    .flatMap((batch) => batch.writes)
    .filter((write) => (write.data as { active?: boolean }).active === false);
  assert.equal(staleWrites.length, 2);

  const statePaths = fake.batches[2]?.writes.map((write) => write.path).sort();
  assert.deepEqual(statePaths, ["mirrorState/attendance", `mirrorState/${result.stateDocumentId}`].sort());
});

test("repository rejects unsafe plans without issuing Firestore writes", async () => {
  const current = stored(row(1));
  const unsafe = buildAttendanceMirrorPlan([], [current], { sessionDate: "2026-07-02" });
  assert.equal(unsafe.safeToCommit, false);

  const fake = new FakeFirestore();
  const repository = new FirestoreAttendanceMirrorRepository(fake as unknown as Firestore);
  await assert.rejects(() => repository.commit(unsafe), /unsafe/);
  assert.equal(fake.batches.length, 0);
});


function findUndefinedPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findUndefinedPaths(item, `${prefix}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return item === undefined ? [path] : findUndefinedPaths(item, path);
    });
  }
  return [];
}

test("repository removes undefined optional fields before Firestore writes", async () => {
  const sparseRow: LegacyAttendanceRecord = {
    date: "2026-07-06",
    className: "[이용우T] - 월요일 연기기초 19:00 ~ 21:00",
    instructor: "이용우",
    studentName: "장은별",
    studentUid: "STU-20260704-E921B024",
    studentIdentityKey: "UID|STU-20260704-E921B024",
    studentNo: "8059",
    status: "미체크",
    sourceSheet: "이용우",
    sourceRow: 7,
    sourceCell: "D7",
    sourceKey: "이용우|D7"
  };
  const plan = buildAttendanceMirrorPlan([sparseRow], [], {
    sessionDate: "2026-07-06",
    classId: "legacy_test"
  }, {
    runId: "undefined-cleanup-run",
    now: new Date("2026-07-06T00:00:00.000Z")
  });

  // Use the classId generated by the row so the plan is in scope.
  const actualPlan = buildAttendanceMirrorPlan([sparseRow], [], {
    sessionDate: "2026-07-06",
    classId: plan.upserts[0]?.classId
  }, {
    runId: "undefined-cleanup-run",
    now: new Date("2026-07-06T00:00:00.000Z")
  });
  assert.equal(actualPlan.safeToCommit, true);

  const fake = new FakeFirestore();
  const repository = new FirestoreAttendanceMirrorRepository(fake as unknown as Firestore);
  await repository.commit(actualPlan);

  const allWrites = fake.batches.flatMap((batch) => batch.writes);
  for (const write of allWrites) {
    assert.deepEqual(findUndefinedPaths(write.data), [], `undefined Firestore value in ${write.path}`);
  }
});
