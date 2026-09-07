import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAttendanceLegacyCleanupPlan,
  canonicalCleanupScopes,
  type CleanupStoredDocument
} from "../src/mirror/attendanceLegacyCleanup.js";
import {
  handleAttendanceLegacyCleanup,
  type AttendanceLegacyCleanupArchiveResult,
  type AttendanceLegacyCleanupAssignmentRepairResult,
  type AttendanceLegacyCleanupRepository,
  type AttendanceLegacyCleanupRestoreResult
} from "../src/mirror/cleanupAttendanceShadowPilotLegacyCallable.js";

function attendance(
  id: string,
  data: Record<string, unknown>
): CleanupStoredDocument {
  return {
    path: `attendance/${id}`,
    id,
    kind: "attendance",
    data: { active: true, ...data }
  };
}

function assignment(
  path: string,
  data: Record<string, unknown>
): CleanupStoredDocument {
  return {
    path,
    id: path.split("/").at(-1) || "",
    kind: "assignment",
    data: { active: true, ...data }
  };
}

const scopes = canonicalCleanupScopes();

const sunday = scopes.find((scope) =>
  scope.pilotId ===
  "lee-yongwoo-2026-07-sunday-youth-intermediate-c"
)!;

const choi = scopes.find((scope) =>
  scope.pilotId ===
  "choi-hyunsik-2026-07-thursday-acting-basic"
)!;

const kim = scopes.find((scope) =>
  scope.pilotId ===
  "kim-cheolsu-2026-07-thursday-acting-basic"
)!;

test("duplicate noncanonical attendance is archive-ready only when canonical replacement exists", () => {
  const canonical = attendance("canonical", {
    sessionDate: "2026-07-12",
    classId: sunday.classId,
    className: "청소년 중급C",
    instructor: "이용우T",
    studentName: "백효은",
    studentUid: "STU-1",
    legacy: {
      sourceSheet: "이용우T",
      sourceKey: "이용우T|U106"
    }
  });

  const legacy = attendance("legacy", {
    sessionDate: "2026-07-12",
    classId:
      "legacy_ecf208092a43ec818932c97f",
    className:
      "[이용우T] - 일요일 청소년 중급C 13:00 ~ 15:00",
    instructor: "이용우T",
    studentName: "백효은",
    studentUid: "STU-1",
    legacy: {
      sourceSheet: "이용우T",
      sourceKey: "이용우T|U106"
    }
  });

  const plan =
    buildAttendanceLegacyCleanupPlan(
      [canonical, legacy],
      []
    );

  assert.equal(plan.archiveCandidates.length, 1);
  assert.equal(plan.blockedCandidates.length, 0);
  assert.equal(plan.safeToArchive, true);
  assert.ok(
    plan.archiveCandidates[0].reasons.includes(
      "canonical_replacement_exists"
    )
  );
});

test("noncanonical attendance without canonical replacement blocks archive", () => {
  const legacy = attendance(
    "legacy-kim-future",
    {
      sessionDate: "2026-07-16",
      classId:
        "legacy_3c6af9d5d902fd5ed0de7ea2",
      className:
        "[김철수T] - 목요일 연기기초 19:00 ~ 22:00",
      instructor: "김철수T",
      studentName: "이준안",
      studentUid: "STU-KIM",
      legacy: {
        sourceSheet: "김철수T",
        sourceKey: "김철수T!M7"
      }
    }
  );

  const plan =
    buildAttendanceLegacyCleanupPlan(
      [legacy],
      []
    );

  assert.equal(plan.archiveCandidates.length, 0);
  assert.equal(plan.blockedCandidates.length, 1);
  assert.equal(plan.blockedAttendanceCount, 1);
  assert.equal(plan.safeToArchive, false);
  assert.ok(
    plan.blockedCandidates[0].reasons.includes(
      "canonical_replacement_missing"
    )
  );
});

test("cross-scope attendance without replacement is blocked", () => {
  const crossed = attendance("crossed", {
    sessionDate: "2026-07-09",
    classId: choi.classId,
    className: "연기기초",
    instructor: "김철수T",
    teacherName: "김철수T",
    studentName: "이준안",
    studentUid: "STU-KIM",
    legacy: {
      sourceSheet: "김철수T",
      sourceKey: "김철수T|L7"
    }
  });

  const plan =
    buildAttendanceLegacyCleanupPlan(
      [crossed],
      []
    );

  assert.equal(plan.archiveCandidates.length, 0);
  assert.equal(plan.blockedCandidates.length, 1);
  assert.equal(plan.safeToArchive, false);
  assert.equal(
    plan.blockedCandidates[0].canonicalClassId,
    kim.classId
  );
});

test("assignment requires canonical sibling for same owner", () => {
  const wrongAttendance = attendance("legacy", {
    sessionDate: "2026-07-09",
    classId: "legacy_bad_kim_scope",
    className:
      "[김철수T] - 목요일 연기기초 19:00 ~ 22:00",
    instructor: "김철수T",
    studentUid: "STU-KIM",
    legacy: {
      sourceSheet: "김철수T",
      sourceKey: "김철수T|L7"
    }
  });

  const wrongAssignment = assignment(
    "adminAssignments/admin-1/classes/legacy_bad_kim_scope",
    {
      classId: "legacy_bad_kim_scope",
      pilotId: kim.pilotId,
      className: "연기기초"
    }
  );

  const canonicalAssignment = assignment(
    `adminAssignments/admin-1/classes/${kim.classId}`,
    {
      classId: kim.classId,
      pilotId: kim.pilotId,
      className: "연기기초"
    }
  );

  const blocked =
    buildAttendanceLegacyCleanupPlan(
      [wrongAttendance],
      [wrongAssignment]
    );

  assert.equal(blocked.blockedAssignmentCount, 1);
  assert.equal(blocked.safeToArchive, false);

  const ready =
    buildAttendanceLegacyCleanupPlan(
      [wrongAttendance],
      [
        wrongAssignment,
        canonicalAssignment
      ]
    );

  assert.equal(ready.assignmentCandidateCount, 1);
  assert.equal(ready.blockedAssignmentCount, 0);
});

class FakeRepository
implements AttendanceLegacyCleanupRepository {
  public archived = false;
  public assignmentsRepaired = false;

  constructor(
    private readonly attendanceDocs:
      CleanupStoredDocument[],
    private readonly assignmentDocs:
      CleanupStoredDocument[] = []
  ) {}

  async scan() {
    return {
      attendance: this.attendanceDocs,
      assignments: this.assignmentDocs
    };
  }

  async repairAssignments(
    _requestId: string,
    plan:
      ReturnType<
        typeof buildAttendanceLegacyCleanupPlan
      >,
    _authUid: string
  ): Promise<
    AttendanceLegacyCleanupAssignmentRepairResult
  > {
    this.assignmentsRepaired = true;

    return {
      assignmentRepairBatchId:
        "phase3a_assignment_repair_aaaaaaaaaaaaaaaaaaaaaaaa",
      duplicate: false,
      requestedCount:
        plan.assignmentRepairCount,
      createdCount:
        plan.assignmentRepairCount,
      existingCount: 0,
      assignmentRepairDigest:
        plan.assignmentRepairDigest
    };
  }

  async archive(
    _requestId: string,
    plan:
      ReturnType<
        typeof buildAttendanceLegacyCleanupPlan
      >,
    _authUid: string
  ): Promise<
    AttendanceLegacyCleanupArchiveResult
  > {
    this.archived = true;
    return {
      cleanupBatchId:
        "phase3a_cleanup_aaaaaaaaaaaaaaaaaaaaaaaa",
      duplicate: false,
      archivedCount:
        plan.archiveCandidates.length,
      attendanceArchived:
        plan.attendanceCandidateCount,
      assignmentsArchived:
        plan.assignmentCandidateCount,
      candidateDigest:
        plan.candidateDigest
    };
  }

  async restore(
    _requestId: string,
    cleanupBatchId: string,
    _candidateDigest: string,
    _authUid: string
  ): Promise<
    AttendanceLegacyCleanupRestoreResult
  > {
    return {
      cleanupBatchId,
      duplicate: false,
      restoredCount: 1
    };
  }
}

test("handler rejects archive while blocked candidates remain", async () => {
  const legacy = attendance("legacy", {
    sessionDate: "2026-07-16",
    classId:
      "legacy_3c6af9d5d902fd5ed0de7ea2",
    className: "연기기초",
    instructor: "김철수T",
    studentUid: "STU-1",
    legacy: {
      sourceSheet: "김철수T",
      sourceKey: "김철수T!M7"
    }
  });

  const repository =
    new FakeRepository([legacy]);

  const dry =
    await handleAttendanceLegacyCleanup(
      {
        requestId:
          "phase3a-cleanup-dry-0001",
        mode: "dry_run"
      },
      {
        uid: "admin",
        role: "superAdmin"
      },
      { repository }
    );

  assert.equal(dry.plan?.safeToArchive, false);

  await assert.rejects(
    () =>
      handleAttendanceLegacyCleanup(
        {
          requestId:
            "phase3a-cleanup-archive-0001",
          mode: "archive",
          candidateDigest:
            dry.plan?.candidateDigest,
          expectedCandidateCount: 1
        },
        {
          uid: "admin",
          role: "superAdmin"
        },
        { repository }
      ),
    /not safe to archive/
  );

  assert.equal(repository.archived, false);
});

test("handler archives only after canonical replacement exists", async () => {
  const canonical = attendance("canonical", {
    sessionDate: "2026-07-12",
    classId: sunday.classId,
    className: "청소년 중급C",
    instructor: "이용우T",
    studentUid: "STU-1",
    legacy: {
      sourceSheet: "이용우T",
      sourceKey: "이용우T|U106"
    }
  });

  const legacy = attendance("legacy", {
    sessionDate: "2026-07-12",
    classId:
      "legacy_ecf208092a43ec818932c97f",
    className: "청소년 중급C",
    instructor: "이용우T",
    studentUid: "STU-1",
    legacy: {
      sourceSheet: "이용우T",
      sourceKey: "이용우T|U106"
    }
  });

  const repository =
    new FakeRepository([canonical, legacy]);

  const dry =
    await handleAttendanceLegacyCleanup(
      {
        requestId:
          "phase3a-cleanup-dry-0002",
        mode: "dry_run"
      },
      {
        uid: "admin",
        role: "superAdmin"
      },
      { repository }
    );

  assert.equal(dry.plan?.safeToArchive, true);
  assert.equal(
    dry.plan?.archiveCandidates.length,
    1
  );

  const archived =
    await handleAttendanceLegacyCleanup(
      {
        requestId:
          "phase3a-cleanup-archive-0002",
        mode: "archive",
        candidateDigest:
          dry.plan?.candidateDigest,
        expectedCandidateCount: 1
      },
      {
        uid: "admin",
        role: "superAdmin"
      },
      { repository }
    );

  assert.equal(
    archived.archive?.archivedCount,
    1
  );
  assert.equal(repository.archived, true);
});

test("handler rejects non-superAdmin cleanup", async () => {
  const repository = new FakeRepository([]);

  await assert.rejects(
    () =>
      handleAttendanceLegacyCleanup(
        {
          requestId:
            "phase3a-cleanup-dry-0003",
          mode: "dry_run"
        },
        {
          uid: "teacher",
          role: "teacher"
        },
        { repository }
      ),
    /superAdmin/
  );
});

test("cleanup sourceKey treats exclamation and pipe separators as the same source cell", () => {
  const canonical = attendance(
    "canonical-kim-m7",
    {
      sessionDate: "2026-07-16",
      classId: kim.classId,
      className: "연기기초",
      instructor: "김철수T",
      studentName: "이준안",
      studentUid:
        "STU-20260707-DBE84132",
      legacy: {
        sourceSheet: "김철수T",
        sourceKey: "김철수T|M7"
      }
    }
  );

  const legacy = attendance(
    "legacy-kim-m7",
    {
      sessionDate: "2026-07-16",
      classId:
        "legacy_3c6af9d5d902fd5ed0de7ea2",
      className:
        "[김철수T] - 목요일 연기기초 19:00 ~ 22:00",
      instructor: "김철수T",
      studentName: "이준안",
      studentUid:
        "STU-20260707-DBE84132",
      legacy: {
        sourceSheet: "김철수T",
        sourceKey: "김철수T!M7"
      }
    }
  );

  const cleanupPlan =
    buildAttendanceLegacyCleanupPlan(
      [canonical, legacy],
      []
    );

  assert.equal(
    cleanupPlan.archiveCandidates.length,
    1
  );

  assert.equal(
    cleanupPlan.blockedAttendanceCount,
    0
  );

  assert.ok(
    cleanupPlan.archiveCandidates[0]
      .reasons.includes(
        "canonical_replacement_exists"
      )
  );
});

test("cleanup sourceKey normalization keeps different source cells separate", () => {
  const canonical = attendance(
    "canonical-kim-m8",
    {
      sessionDate: "2026-07-16",
      classId: kim.classId,
      className: "연기기초",
      instructor: "김철수T",
      studentName: "장은별",
      studentUid: "STU-1",
      legacy: {
        sourceSheet: "김철수T",
        sourceKey: "김철수T|M8"
      }
    }
  );

  const legacy = attendance(
    "legacy-kim-m9",
    {
      sessionDate: "2026-07-16",
      classId:
        "legacy_3c6af9d5d902fd5ed0de7ea2",
      className: "연기기초",
      instructor: "김철수T",
      studentName: "장은별",
      studentUid: "STU-1",
      legacy: {
        sourceSheet: "김철수T",
        sourceKey: "김철수T!M9"
      }
    }
  );

  const cleanupPlan =
    buildAttendanceLegacyCleanupPlan(
      [canonical, legacy],
      []
    );

  assert.equal(
    cleanupPlan.archiveCandidates.length,
    0
  );

  assert.equal(
    cleanupPlan.blockedAttendanceCount,
    1
  );
});

test("student UID alias is accepted only for one canonical row with the same date sourceKey and name", () => {
  const canonical = attendance(
    "canonical-current-uid",
    {
      sessionDate: "2026-07-16",
      classId: kim.classId,
      className: "연기기초",
      instructor: "김철수T",
      studentName: "이준안",
      studentUid:
        "STU-20260707-EE34D89E",
      legacy: {
        sourceSheet: "김철수T",
        sourceKey: "김철수T|M7"
      }
    }
  );

  const historical = attendance(
    "legacy-old-uid",
    {
      sessionDate: "2026-07-16",
      classId:
        "legacy_3c6af9d5d902fd5ed0de7ea2",
      className: "연기기초",
      instructor: "김철수T",
      studentName: "이준안",
      studentUid:
        "STU-20260707-DBE84132",
      legacy: {
        sourceSheet: "김철수T",
        sourceKey: "김철수T!M7"
      }
    }
  );

  const cleanupPlan =
    buildAttendanceLegacyCleanupPlan(
      [canonical, historical],
      []
    );

  assert.equal(
    cleanupPlan.blockedAttendanceCount,
    0
  );

  assert.equal(
    cleanupPlan.archiveCandidates.length,
    1
  );

  assert.ok(
    cleanupPlan.archiveCandidates[0]
      .reasons.includes(
        "student_uid_alias_detected"
      )
  );
});

test("student UID alias fallback rejects a different student name on the same row", () => {
  const canonical = attendance(
    "canonical-other-student",
    {
      sessionDate: "2026-07-16",
      classId: kim.classId,
      className: "연기기초",
      instructor: "김철수T",
      studentName: "다른학생",
      studentUid:
        "STU-CURRENT",
      legacy: {
        sourceSheet: "김철수T",
        sourceKey: "김철수T|M7"
      }
    }
  );

  const historical = attendance(
    "legacy-old-uid",
    {
      sessionDate: "2026-07-16",
      classId:
        "legacy_3c6af9d5d902fd5ed0de7ea2",
      className: "연기기초",
      instructor: "김철수T",
      studentName: "이준안",
      studentUid:
        "STU-OLD",
      legacy: {
        sourceSheet: "김철수T",
        sourceKey: "김철수T!M7"
      }
    }
  );

  const cleanupPlan =
    buildAttendanceLegacyCleanupPlan(
      [canonical, historical],
      []
    );

  assert.equal(
    cleanupPlan.blockedAttendanceCount,
    1
  );
});

test("handler repairs missing canonical assignment siblings after attendance blockers are resolved", async () => {
  const canonicalAttendance = attendance(
    "canonical",
    {
      sessionDate: "2026-07-09",
      classId: kim.classId,
      className: "연기기초",
      instructor: "김철수T",
      studentName: "이준안",
      studentUid: "STU-1",
      legacy: {
        sourceSheet: "김철수T",
        sourceKey: "김철수T|L7"
      }
    }
  );

  const wrongAttendance = attendance(
    "legacy",
    {
      sessionDate: "2026-07-09",
      classId: "legacy_bad_kim_scope",
      className: "연기기초",
      instructor: "김철수T",
      studentName: "이준안",
      studentUid: "STU-1",
      legacy: {
        sourceSheet: "김철수T",
        sourceKey: "김철수T|L7"
      }
    }
  );

  const wrongAssignment = assignment(
    "teacherAssignments/teacher-1/classes/legacy_bad_kim_scope",
    {
      classId: "legacy_bad_kim_scope",
      pilotId: kim.pilotId,
      className: "연기기초",
      readAllowed: true
    }
  );

  const repository =
    new FakeRepository(
      [
        canonicalAttendance,
        wrongAttendance
      ],
      [wrongAssignment]
    );

  const dry =
    await handleAttendanceLegacyCleanup(
      {
        requestId:
          "phase3a-cleanup-dry-repair-0001",
        mode: "dry_run"
      },
      {
        uid: "admin",
        role: "superAdmin"
      },
      { repository }
    );

  assert.equal(
    dry.plan?.blockedAttendanceCount,
    0
  );

  assert.equal(
    dry.plan?.assignmentRepairCount,
    1
  );

  assert.equal(
    dry.plan?.safeToRepairAssignments,
    true
  );

  const repaired =
    await handleAttendanceLegacyCleanup(
      {
        requestId:
          "phase3a-cleanup-repair-assignments-0001",
        mode: "repair_assignments",
        candidateDigest:
          dry.plan?.assignmentRepairDigest,
        expectedCandidateCount: 1
      },
      {
        uid: "admin",
        role: "superAdmin"
      },
      { repository }
    );

  assert.equal(
    repaired.assignmentRepair
      ?.createdCount,
    1
  );

  assert.equal(
    repository.assignmentsRepaired,
    true
  );
});

test("handler blocks assignment repair while attendance blockers remain", async () => {
  const wrongAttendance = attendance(
    "legacy-only",
    {
      sessionDate: "2026-07-16",
      classId:
        "legacy_3c6af9d5d902fd5ed0de7ea2",
      className: "연기기초",
      instructor: "김철수T",
      studentName: "이준안",
      studentUid: "STU-OLD",
      legacy: {
        sourceSheet: "김철수T",
        sourceKey: "김철수T|M7"
      }
    }
  );

  const wrongAssignment = assignment(
    "teacherAssignments/teacher-1/classes/legacy_3c6af9d5d902fd5ed0de7ea2",
    {
      classId:
        "legacy_3c6af9d5d902fd5ed0de7ea2",
      pilotId: kim.pilotId,
      className: "연기기초"
    }
  );

  const repository =
    new FakeRepository(
      [wrongAttendance],
      [wrongAssignment]
    );

  const dry =
    await handleAttendanceLegacyCleanup(
      {
        requestId:
          "phase3a-cleanup-dry-repair-0002",
        mode: "dry_run"
      },
      {
        uid: "admin",
        role: "superAdmin"
      },
      { repository }
    );

  assert.equal(
    dry.plan?.safeToRepairAssignments,
    false
  );

  await assert.rejects(
    () =>
      handleAttendanceLegacyCleanup(
        {
          requestId:
            "phase3a-cleanup-repair-assignments-0002",
          mode: "repair_assignments",
          candidateDigest:
            dry.plan
              ?.assignmentRepairDigest,
          expectedCandidateCount: 1
        },
        {
          uid: "admin",
          role: "superAdmin"
        },
        { repository }
      ),
    /not safe/
  );
});

