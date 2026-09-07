import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryIdempotencyStore } from "../src/common/idempotency.js";
import {
  buildStableClassId,
  type LegacyAttendanceRecord
} from "../src/mirror/attendanceMirror.js";
import type { AttendanceMirrorPlan, AttendanceMirrorScope, StoredAttendanceMirrorDocument } from "../src/mirror/attendanceMirrorPlan.js";
import type { AttendanceMirrorCommitResult, AttendanceMirrorRepository } from "../src/mirror/firestoreAttendanceMirrorRepository.js";
import { handleAttendanceShadowPilotSync } from "../src/mirror/syncAttendanceShadowPilotCallable.js";

class MemoryAttendanceRepository implements AttendanceMirrorRepository {
  documents = new Map<string, StoredAttendanceMirrorDocument>();
  commits = 0;

  async loadScope(scope: AttendanceMirrorScope): Promise<StoredAttendanceMirrorDocument[]> {
    return [...this.documents.values()].filter((item) => item.sessionDate === scope.sessionDate && (!scope.classId || item.classId === scope.classId));
  }

  async commit(plan: AttendanceMirrorPlan): Promise<AttendanceMirrorCommitResult> {
    this.commits += 1;
    for (const document of plan.upserts) this.documents.set(document.id, document);
    for (const id of plan.staleIds) {
      const current = this.documents.get(id);
      if (current) this.documents.set(id, { ...current, active: false, mirrorRunId: plan.runId });
    }
    return {
      runId: plan.runId,
      scopeKey: plan.scopeKey,
      written: plan.upserts.length,
      staleMarked: plan.staleIds.length,
      unchanged: plan.unchangedIds.length,
      stateDocumentId: "state-1"
    };
  }
}

function record(overrides: Partial<LegacyAttendanceRecord> = {}): LegacyAttendanceRecord {
  return {
    date: "2026-07-06",
    sessionDate: "2026-07-06",
    className: "연기기초반",
    instructor: "이용우T",
    teacherName: "이용우",
    studentUid: "STU-1",
    studentIdentityKey: "uid:STU-1",
    studentName: "학생1",
    status: "출석",
    attendanceStatus: "출석",
    sourceSheet: "이용우T 7월",
    sourceCell: "C10",
    sourceKey: "이용우T 7월|C10",
    classroom: "2강의실",
    startTime: "19:00",
    endTime: "22:00",
    ...overrides
  };
}

function input(mode: "dry_run" | "commit" = "dry_run") {
  return {
    requestId: `pilot-request-${mode}-0001`,
    mode,
    date: "2026-07-06",
    className: "연기기초반",
    records: [record()]
  };
}

test("pilot sync requires Firebase authentication", async () => {
  const repository = new MemoryAttendanceRepository();
  await assert.rejects(
    () => handleAttendanceShadowPilotSync(input(), undefined, { repository, idempotencyStore: new InMemoryIdempotencyStore() }),
    /authentication|required/i
  );
  assert.equal(repository.commits, 0);
});

test("pilot sync accepts authenticated legacy operators only inside the hard-coded pilot scope", async () => {
  const repository = new MemoryAttendanceRepository();
  const result = await handleAttendanceShadowPilotSync(input("dry_run"), { uid: "legacy-operator", role: "teacher" }, {
    repository,
    idempotencyStore: new InMemoryIdempotencyStore(),
    now: () => Date.parse("2026-07-04T00:00:00.000Z")
  });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "dry_run");
  assert.equal(result.safeToCommit, true);
  assert.equal(repository.commits, 0);
});

test("pilot sync rejects any date, class, or instructor outside the exact allowlist", async () => {
  const auth = { uid: "admin", role: "admin" };
  const cases = [
    { ...input(), date: "2026-07-07" },
    { ...input(), className: "성우기초반" },
    { ...input(), records: [record({ instructor: "다른강사", teacherName: "다른강사" })] }
  ];
  for (const item of cases) {
    const repository = new MemoryAttendanceRepository();
    await assert.rejects(
      () => handleAttendanceShadowPilotSync(item, auth, { repository, idempotencyStore: new InMemoryIdempotencyStore() })
    );
    assert.equal(repository.commits, 0);
  }
});

test("dry run validates the one-class plan without writing", async () => {
  const repository = new MemoryAttendanceRepository();
  const result = await handleAttendanceShadowPilotSync(input("dry_run"), { uid: "admin", role: "admin" }, {
    repository,
    idempotencyStore: new InMemoryIdempotencyStore(),
    now: () => Date.parse("2026-07-04T00:00:00.000Z")
  });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "dry_run");
  assert.equal(result.safeToCommit, true);
  assert.equal(result.acceptedCount, 1);
  assert.equal(repository.commits, 0);
  assert.equal(repository.documents.size, 0);
});

test("commit writes only the pilot scope and verifies the mirror", async () => {
  const repository = new MemoryAttendanceRepository();
  const result = await handleAttendanceShadowPilotSync(input("commit"), { uid: "owner", role: "superAdmin" }, {
    repository,
    idempotencyStore: new InMemoryIdempotencyStore(),
    now: () => Date.parse("2026-07-04T00:00:00.000Z")
  });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "commit");
  assert.equal(result.verificationSafe, true);
  assert.equal(repository.commits, 1);
  assert.equal(repository.documents.size, 1);
  const stored = [...repository.documents.values()][0];
  assert.equal(stored.sessionDate, "2026-07-06");
  assert.equal(stored.className, "연기기초반");
  assert.equal(stored.instructor, "이용우T");
  assert.equal(stored.studentNo, undefined);
  assert.equal(stored.memo, undefined);
});

test("duplicate requestId never repeats the write", async () => {
  const repository = new MemoryAttendanceRepository();
  const idempotencyStore = new InMemoryIdempotencyStore();
  const first = await handleAttendanceShadowPilotSync(input("commit"), { uid: "owner", role: "superAdmin" }, {
    repository,
    idempotencyStore
  });
  const second = await handleAttendanceShadowPilotSync(input("commit"), { uid: "owner", role: "superAdmin" }, {
    repository,
    idempotencyStore
  });
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(repository.commits, 1);
});

test("admin commit creates only the selected class assignment for client-side Firestore read", async () => {
  const repository = new MemoryAttendanceRepository();
  const assignments: Array<Record<string, string>> = [];
  const result = await handleAttendanceShadowPilotSync(
    { ...input("commit"), requestId: "pilot-request-admin-commit-0001" },
    { uid: "admin-firebase-uid", role: "admin" },
    {
      repository,
      idempotencyStore: new InMemoryIdempotencyStore(),
      assignmentWriter: {
        async ensureAdminAssignment(firebaseUid, classId, className, pilotId) {
          assignments.push({ firebaseUid, classId, className, pilotId });
        }
      }
    }
  );
  assert.equal(result.assignmentEnsured, true);
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0]?.firebaseUid, "admin-firebase-uid");
  assert.equal(assignments[0]?.className, "연기기초반");
  assert.equal(assignments[0]?.pilotId, "lee-yongwoo-2026-07-monday-acting-basic");
});



test("display alias and canonical class name resolve to one canonical classId", async () => {
  const canonicalRepository =
    new MemoryAttendanceRepository();

  const aliasRepository =
    new MemoryAttendanceRepository();

  const canonicalResult =
    await handleAttendanceShadowPilotSync(
      {
        requestId:
          "pilot-request-canonical-classid-0001",
        mode: "commit" as const,
        date: "2026-07-12",
        className: "청소년 중급C",
        records: [
          record({
            date: "2026-07-12",
            sessionDate: "2026-07-12",
            className: "청소년 중급C",
            startTime: "13:00",
            endTime: "15:00"
          })
        ]
      },
      { uid: "owner", role: "superAdmin" },
      {
        repository: canonicalRepository,
        idempotencyStore:
          new InMemoryIdempotencyStore()
      }
    );

  const aliasResult =
    await handleAttendanceShadowPilotSync(
      {
        requestId:
          "pilot-request-display-alias-0001",
        mode: "commit" as const,
        date: "2026-07-12",
        className:
          "[이용우T] - 일요일 청소년 중급C 13:00 ~ 15:00",
        records: [
          record({
            date: "2026-07-12",
            sessionDate: "2026-07-12",
            className:
              "[이용우T] - 일요일 청소년 중급C 13:00 ~ 15:00",
            startTime: "13:00",
            endTime: "15:00"
          })
        ]
      },
      { uid: "owner", role: "superAdmin" },
      {
        repository: aliasRepository,
        idempotencyStore:
          new InMemoryIdempotencyStore()
      }
    );

  assert.equal(
    canonicalResult.classId,
    aliasResult.classId
  );

  assert.equal(
    canonicalResult.classId,
    "legacy_b6fad49fff01b4faec699a11"
  );

  const aliasStored =
    [...aliasRepository.documents.values()][0];

  assert.equal(
    aliasStored?.className,
    "청소년 중급C"
  );

  assert.equal(
    aliasStored?.instructor,
    "이용우T"
  );
});

test("second Sunday youth intermediate C scope supports dry run without writing", async () => {
  const repository = new MemoryAttendanceRepository();
  const sundayInput = {
    requestId: "pilot-request-sunday-dry-run-0001",
    mode: "dry_run" as const,
    date: "2026-07-05",
    className: "청소년 중급C",
    records: [record({
      date: "2026-07-05",
      sessionDate: "2026-07-05",
      className: "청소년 중급C",
      startTime: "13:00",
      endTime: "15:00"
    })]
  };
  const result = await handleAttendanceShadowPilotSync(
    sundayInput,
    { uid: "owner", role: "superAdmin" },
    {
      repository,
      idempotencyStore: new InMemoryIdempotencyStore(),
      now: () => Date.parse("2026-07-05T00:00:00.000Z")
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.pilotId, "lee-yongwoo-2026-07-sunday-youth-intermediate-c");
  assert.equal(result.acceptedCount, 1);
  assert.equal(repository.commits, 0);
});

test("callable rejects cross-paired approved date and class", async () => {
  const repository = new MemoryAttendanceRepository();
  const unsafe = {
    ...input("dry_run"),
    requestId: "pilot-request-cross-pair-0001",
    date: "2026-07-05",
    className: "연기기초반",
    records: [record({ date: "2026-07-05", sessionDate: "2026-07-05" })]
  };
  await assert.rejects(
    () => handleAttendanceShadowPilotSync(
      unsafe,
      { uid: "owner", role: "superAdmin" },
      { repository, idempotencyStore: new InMemoryIdempotencyStore() }
    )
  );
  assert.equal(repository.commits, 0);
});


test("third Choi Hyunsik Thursday acting-basic scope supports dry run without writing", async () => {
  const repository = new MemoryAttendanceRepository();
  const thursdayInput = {
    requestId: "pilot-request-choi-thursday-dry-run-0001",
    mode: "dry_run" as const,
    date: "2026-07-09",
    className: "목요일 연기기초",
    records: [record({
      date: "2026-07-09",
      sessionDate: "2026-07-09",
      className: "[최현식T] - 목요일 연기기초 19:00 ~ 22:00",
      instructor: "최현식T",
      teacherName: "최현식",
      sourceSheet: "최현식T 7월",
      sourceCell: "C10",
      sourceKey: "최현식T 7월|C10",
      startTime: "19:00",
      endTime: "22:00"
    })]
  };

  const result = await handleAttendanceShadowPilotSync(
    thursdayInput,
    { uid: "owner", role: "superAdmin" },
    {
      repository,
      idempotencyStore: new InMemoryIdempotencyStore(),
      now: () => Date.parse("2026-07-09T00:00:00.000Z")
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.pilotId, "choi-hyunsik-2026-07-thursday-acting-basic");
  assert.equal(result.acceptedCount, 1);
  assert.equal(repository.commits, 0);
});

test("callable rejects a Choi Thursday date paired with another approved class", async () => {
  const repository = new MemoryAttendanceRepository();
  const unsafe = {
    requestId: "pilot-request-choi-cross-pair-0001",
    mode: "dry_run" as const,
    date: "2026-07-09",
    className: "청소년 중급C",
    records: [record({
      date: "2026-07-09",
      sessionDate: "2026-07-09",
      className: "청소년 중급C",
      instructor: "최현식T",
      teacherName: "최현식"
    })]
  };

  await assert.rejects(
    () => handleAttendanceShadowPilotSync(
      unsafe,
      { uid: "owner", role: "superAdmin" },
      { repository, idempotencyStore: new InMemoryIdempotencyStore() }
    )
  );
  assert.equal(repository.commits, 0);
});



test("Kim Cheolsu exact alias and pilotId resolve the Kim scope, not Choi", async () => {
  const repository =
    new MemoryAttendanceRepository();

  const result =
    await handleAttendanceShadowPilotSync(
      {
        requestId:
          "pilot-request-kim-exact-scope-0001",
        mode: "dry_run" as const,
        date: "2026-07-09",
        className:
          "[김철수T] - 목요일 연기기초 19:00 ~ 22:00",
        pilotId:
          "kim-cheolsu-2026-07-thursday-acting-basic",
        records: [
          record({
            date: "2026-07-09",
            sessionDate: "2026-07-09",
            className: "연기기초",
            instructor: "김철수T",
            teacherName: "김철수T",
            studentName: "이준안",
            studentUid:
              "STU-20260707-EE34D89E",
            studentIdentityKey:
              "uid:STU-20260707-EE34D89E",
            sourceSheet: "김철수T",
            sourceCell: "L7",
            sourceKey: "김철수T|L7"
          })
        ]
      },
      {
        uid: "owner",
        role: "superAdmin"
      },
      {
        repository,
        idempotencyStore:
          new InMemoryIdempotencyStore()
      }
    );

  assert.equal(
    result.pilotId,
    "kim-cheolsu-2026-07-thursday-acting-basic"
  );

  const expectedClassId =
    buildStableClassId(
      record({
        date: "2026-07-09",
        sessionDate: "2026-07-09",
        classId: "",
        className: "연기기초",
        instructor: "김철수T",
        teacherName: "김철수T",
        studentName: "이준안",
        studentUid:
          "STU-20260707-EE34D89E",
        studentIdentityKey:
          "uid:STU-20260707-EE34D89E",
        sourceSheet: "김철수T",
        sourceCell: "L7",
        sourceKey: "김철수T|L7"
      })
    );

  assert.equal(
    result.classId,
    expectedClassId
  );

  assert.match(
    result.classId,
    /^legacy_[a-f0-9]{24}$/
  );
});

test("server rejects a pilotId that disagrees with the resolved teacher scope", async () => {
  const repository =
    new MemoryAttendanceRepository();

  await assert.rejects(
    () =>
      handleAttendanceShadowPilotSync(
        {
          requestId:
            "pilot-request-kim-wrong-id-0001",
          mode: "dry_run" as const,
          date: "2026-07-09",
          className:
            "[김철수T] - 목요일 연기기초 19:00 ~ 22:00",
          pilotId:
            "choi-hyunsik-2026-07-thursday-acting-basic",
          records: [
            record({
              date: "2026-07-09",
              sessionDate: "2026-07-09",
              className: "연기기초",
              instructor: "김철수T",
              teacherName: "김철수T",
              studentUid:
                "STU-20260707-EE34D89E",
              sourceSheet: "김철수T",
              sourceCell: "L7",
              sourceKey: "김철수T|L7"
            })
          ]
        },
        {
          uid: "owner",
          role: "superAdmin"
        },
        {
          repository,
          idempotencyStore:
            new InMemoryIdempotencyStore()
        }
      ),
    /pilotId|scope/i
  );

  assert.equal(repository.commits, 0);
});

test("fourth Kim Cheolsu Thursday acting-basic scope supports reinforcement and transfer rows", async () => {
  const repository = new MemoryAttendanceRepository();
  const specialInput = {
    requestId: "pilot-request-kim-cheolsu-special-0001",
    mode: "dry_run" as const,
    date: "2026-07-09",
    className: "[김철수T] - 목요일 연기기초 19:00 ~ 22:00",
    records: [
      record({
        date: "2026-07-09",
        sessionDate: "2026-07-09",
        className: "[김철수T] - 목요일 연기기초 19:00 ~ 22:00",
        instructor: "김철수T",
        teacherName: "김철수",
        studentName: "보강학생",
        studentUid: "STU-20260706-SPECIAL01",
        studentIdentityKey: "uid:STU-20260706-SPECIAL01",
        status: "보강",
        attendanceStatus: "보강",
        specialStatus: "보강",
        sourceCell: "C10",
        sourceKey: "김철수T 7월|C10",
        note: "보강"
      }),
      record({
        date: "2026-07-09",
        sessionDate: "2026-07-09",
        className: "[김철수T] - 목요일 연기기초 19:00 ~ 22:00",
        instructor: "김철수T",
        teacherName: "김철수",
        studentName: "반이동학생",
        studentUid: "STU-20260706-SPECIAL02",
        studentIdentityKey: "uid:STU-20260706-SPECIAL02",
        status: "반이동",
        attendanceStatus: "반이동",
        specialStatus: "반이동",
        sourceCell: "D10",
        sourceKey: "김철수T 7월|D10",
        note: "반이동"
      })
    ]
  };

  const result = await handleAttendanceShadowPilotSync(
    specialInput,
    { uid: "owner", role: "superAdmin" },
    { repository, idempotencyStore: new InMemoryIdempotencyStore(), now: () => Date.parse("2026-07-09T00:00:00.000Z") }
  );

  assert.equal(result.ok, true);
  assert.equal(result.pilotId, "kim-cheolsu-2026-07-thursday-acting-basic");
  assert.equal(result.acceptedCount, 2);
  assert.equal(repository.commits, 0);
});

test("callable rejects a Kim Cheolsu Thursday date paired with another approved class", async () => {
  const repository = new MemoryAttendanceRepository();
  const unsafe = {
    requestId: "pilot-request-kim-cheolsu-cross-pair-0001",
    mode: "dry_run" as const,
    date: "2026-07-09",
    className: "청소년 중급C",
    records: [record({
      date: "2026-07-09",
      sessionDate: "2026-07-09",
      className: "청소년 중급C",
      instructor: "김철수T",
      teacherName: "김철수"
    })]
  };

  await assert.rejects(() => handleAttendanceShadowPilotSync(unsafe, { uid: "owner", role: "superAdmin" }, { repository, idempotencyStore: new InMemoryIdempotencyStore() }));
  assert.equal(repository.commits, 0);
});


test("duplicate commit can create missing assignment for client-side read", async () => {
  const repository = new MemoryAttendanceRepository();
  const idempotencyStore = new InMemoryIdempotencyStore();
  const assignmentCalls: Array<{ uid: string; classId: string; className: string; pilotId: string }> = [];

  const first = await handleAttendanceShadowPilotSync(input("commit"), { uid: "legacy-admin", role: "teacher" }, {
    repository,
    idempotencyStore,
    assignmentWriter: {
      async ensureAdminAssignment(uid, classId, className, pilotId) {
        assignmentCalls.push({ uid, classId, className, pilotId });
      }
    },
    now: () => Date.parse("2026-07-04T00:00:00.000Z")
  });

  assert.equal(first.ok, true);
  assert.equal(first.mode, "commit");
  assert.equal(assignmentCalls.length, 1);

  const second = await handleAttendanceShadowPilotSync(input("commit"), { uid: "legacy-admin", role: "teacher" }, {
    repository,
    idempotencyStore,
    assignmentWriter: {
      async ensureAdminAssignment(uid, classId, className, pilotId) {
        assignmentCalls.push({ uid, classId, className, pilotId });
      }
    },
    now: () => Date.parse("2026-07-04T00:00:01.000Z")
  });

  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.assignmentEnsured, true);
  assert.equal(assignmentCalls.length, 2);
});

