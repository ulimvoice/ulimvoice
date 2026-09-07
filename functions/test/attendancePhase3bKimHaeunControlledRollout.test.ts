import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryIdempotencyStore
} from "../src/common/idempotency.js";
import type {
  AttendanceMirrorCommitResult
} from "../src/mirror/firestoreAttendanceMirrorRepository.js";
import type {
  AttendanceMirrorPlan,
  StoredAttendanceMirrorDocument
} from "../src/mirror/attendanceMirrorPlan.js";
import {
  ATTENDANCE_PHASE3B2_KIM_HAEUN_TARGET,
  buildAttendancePhase3b2KimHaeunControlledPlan
} from "../src/mirror/attendancePhase3bKimHaeunControlledRollout.js";
import {
  handleAttendancePhase3b2KimHaeunControlledRollout,
  type AttendancePhase3b2KimHaeunApproval,
  type AttendancePhase3b2KimHaeunApprovalStore,
  type AttendancePhase3b2KimHaeunAssignmentWriter,
  type AttendancePhase3b2KimHaeunAuditWriter
} from "../src/mirror/syncAttendancePhase3bKimHaeunControlledRolloutCallable.js";

function targetRow(
  sourceCell: string,
  studentIndex: number,
  overrides: Record<string, unknown> = {}
) {
  return {
    date:
      ATTENDANCE_PHASE3B2_KIM_HAEUN_TARGET.date,
    sessionDate:
      ATTENDANCE_PHASE3B2_KIM_HAEUN_TARGET.date,
    studentName:
      `테스트학생${studentIndex}`,
    studentNo:
      String(9300 + studentIndex),
    studentUid:
      `STU-20260716-KH${studentIndex}`,
    studentIdentityKey:
      `UID_TEST_KH_${studentIndex}`,
    instructor:
      ATTENDANCE_PHASE3B2_KIM_HAEUN_TARGET
        .instructor,
    teacherName:
      ATTENDANCE_PHASE3B2_KIM_HAEUN_TARGET
        .instructor,
    className:
      ATTENDANCE_PHASE3B2_KIM_HAEUN_TARGET
        .className,
    status: "O",
    attendanceStatus: "O",
    sourceSheet: "김하은T",
    sourceCell,
    sourceKey:
      `김하은T|${sourceCell}`,
    ...overrides
  };
}

function targetRows() {
  return [
    targetRow("V21", 1),
    targetRow("V22", 2),
    targetRow("V23", 3),
    targetRow("V24", 4),
    targetRow("V25", 5),
    targetRow("V26", 6)
  ];
}

class FakeRepository {
  documents:
    StoredAttendanceMirrorDocument[] = [];

  adminAssignment = false;
  teacherAssignment = false;

  teacherCandidates: Array<{
    teacherUid: string;
    teacherName: string;
    active: boolean;
    source: string;
  }> = [];

  async loadScope() {
    return this.documents.map(
      (document) => ({
        ...document
      })
    );
  }

  async assignmentPresence() {
    return {
      admin:
        this.adminAssignment,
      teacher:
        this.teacherAssignment
    };
  }

  async detailedAssignmentPresence() {
    return {
      admin:
        this.adminAssignment,
      teacher:
        this.teacherAssignment
    };
  }

  async resolveTeacherCandidates() {
    return this.teacherCandidates;
  }

  async commit(
    plan: AttendanceMirrorPlan
  ): Promise<
    AttendanceMirrorCommitResult
  > {
    const byId = new Map(
      this.documents.map(
        (document) => [
          document.id,
          document
        ]
      )
    );

    for (
      const document of plan.upserts
    ) {
      byId.set(
        document.id,
        {
          ...document
        }
      );
    }

    for (
      const id of plan.staleIds
    ) {
      const current =
        byId.get(id);

      if (current) {
        byId.set(
          id,
          {
            ...current,
            active: false,
            staleAt:
              "2026-07-15T00:00:00.000Z"
          }
        );
      }
    }

    this.documents =
      [...byId.values()];

    return {
      runId: plan.runId,
      scopeKey: plan.scopeKey,
      written:
        plan.upserts.length,
      staleMarked:
        plan.staleIds.length,
      unchanged:
        plan.unchangedIds.length,
      stateDocumentId:
        "attendance__test"
    };
  }
}

class FakeApprovalStore
implements AttendancePhase3b2KimHaeunApprovalStore {
  readonly records =
    new Map<
      string,
      AttendancePhase3b2KimHaeunApproval
    >();

  async create(
    approval:
      AttendancePhase3b2KimHaeunApproval
  ) {
    this.records.set(
      approval.approvalId,
      approval
    );
  }

  async get(
    approvalId: string
  ) {
    return this.records.get(
      approvalId
    );
  }

  async claim(
    approvalId: string,
    checks: {
      operatorUid: string;
      planDigest: string;
      tokenHash: string;
      commitRequestId: string;
      now: Date;
    }
  ) {
    const current =
      this.records.get(
        approvalId
      );

    if (!current) {
      throw new Error(
        "approval not found"
      );
    }

    if (
      current.status !== "armed" ||
      current.operatorUid !==
        checks.operatorUid ||
      current.planDigest !==
        checks.planDigest ||
      current.tokenHash !==
        checks.tokenHash ||
      Date.parse(
        current.expiresAt
      ) <= checks.now.getTime()
    ) {
      throw new Error(
        "approval mismatch"
      );
    }

    const next = {
      ...current,
      status:
        "committing" as const,
      commitRequestId:
        checks.commitRequestId
    };

    this.records.set(
      approvalId,
      next
    );

    return next;
  }

  async complete(
    approvalId: string,
    completedAt: Date
  ) {
    const current =
      this.records.get(
        approvalId
      );

    if (!current) return;

    this.records.set(
      approvalId,
      {
        ...current,
        status: "consumed",
        consumedAt:
          completedAt.toISOString()
      }
    );
  }

  async fail(
    approvalId: string,
    error: string,
    failedAt: Date
  ) {
    const current =
      this.records.get(
        approvalId
      );

    if (!current) return;

    this.records.set(
      approvalId,
      {
        ...current,
        status: "failed",
        failedAt:
          failedAt.toISOString(),
        lastError: error
      }
    );
  }
}

class FakeAssignmentWriter
implements AttendancePhase3b2KimHaeunAssignmentWriter {
  constructor(
    private readonly repository:
      FakeRepository
  ) {}

  async ensureAssignments() {
    const adminWritten =
      this.repository
        .adminAssignment
        ? 0
        : 1;

    const teacherWritten =
      this.repository
        .teacherAssignment
        ? 0
        : 1;

    this.repository
      .adminAssignment = true;

    this.repository
      .teacherAssignment = true;

    return {
      adminWritten,
      teacherWritten
    };
  }
}

class FakeAuditWriter
implements AttendancePhase3b2KimHaeunAuditWriter {
  readonly rows:
    Array<Record<string, unknown>> =
    [];

  async writeAudit(
    _requestId: string,
    payload:
      Record<string, unknown>
  ) {
    this.rows.push(payload);
  }
}

function deps() {
  const repository =
    new FakeRepository();
  const approvalStore =
    new FakeApprovalStore();
  const auditWriter =
    new FakeAuditWriter();

  return {
    repository,
    approvalStore,
    auditWriter,
    assignmentWriter:
      new FakeAssignmentWriter(
        repository
      ),
    idempotencyStore:
      new InMemoryIdempotencyStore(),
    now: () =>
      Date.parse(
        "2026-07-15T11:30:00.000Z"
      ),
    tokenFactory: () =>
      "a".repeat(64)
  };
}

const auth = {
  uid: "firebase-super-admin",
  role: "superAdmin"
};

test("fixed six-record Kim Haeun target produces safe initial plan", async () => {
  const testDeps = deps();

  const plan =
    await buildAttendancePhase3b2KimHaeunControlledPlan(
      targetRows(),
      auth.uid,
      testDeps.repository,
      new Date(
        "2026-07-15T11:30:00.000Z"
      )
    );

  assert.equal(
    plan.safeToArm,
    true
  );

  assert.equal(
    plan.status,
    "ready_initial_sync"
  );

  assert.equal(
    plan.canonicalClassId,
    ATTENDANCE_PHASE3B2_KIM_HAEUN_TARGET
      .classId
  );

  assert.equal(
    plan.sourceCount,
    6
  );

  assert.equal(
    plan.reconciliation
      .upsertCount,
    6
  );

  assert.equal(
    plan.teacherUid,
    "ADM-20260610-0213CFC6"
  );

  assert.equal(
    plan.teacherName,
    "김하은"
  );

  assert.match(
    plan.warnings.join("\n"),
    /server-fixed teacherUid/u
  );

  assert.match(
    plan.planDigest,
    /^[a-f0-9]{64}$/u
  );
});

test("source cell outside V21-V26 allowlist is blocked", async () => {
  const testDeps = deps();

  const plan =
    await buildAttendancePhase3b2KimHaeunControlledPlan(
      [
        ...targetRows().slice(0, 5),
        targetRow(
          "V27",
          6,
          {
            sourceKey:
              "김하은T|V27"
          }
        )
      ],
      auth.uid,
      testDeps.repository
    );

  assert.equal(
    plan.safeToArm,
    false
  );

  assert.equal(
    plan.status,
    "blocked"
  );

  assert.match(
    plan.errors.join("\n"),
    /sourceKey/u
  );
});

test("dry run is read-only", async () => {
  const testDeps = deps();

  const result =
    await handleAttendancePhase3b2KimHaeunControlledRollout(
      {
        requestId:
          "phase3b2kh-dry-run-test-0001",
        mode: "dry_run",
        records: targetRows()
      },
      auth,
      testDeps
    );

  assert.equal(
    result.writeOperations,
    0
  );

  assert.equal(
    result.plan.safeToArm,
    true
  );

  assert.equal(
    testDeps.approvalStore
      .records.size,
    0
  );

  assert.equal(
    testDeps.auditWriter
      .rows.length,
    0
  );

  assert.equal(
    testDeps.repository
      .documents.length,
    0
  );
});

test("arm stores a ten-minute digest approval only", async () => {
  const testDeps = deps();

  const dry =
    await handleAttendancePhase3b2KimHaeunControlledRollout(
      {
        requestId:
          "phase3b2kh-dry-run-test-0002",
        mode: "dry_run",
        records: targetRows()
      },
      auth,
      testDeps
    );

  const armed =
    await handleAttendancePhase3b2KimHaeunControlledRollout(
      {
        requestId:
          "phase3b2kh-arm-test-0001",
        mode: "arm",
        records: targetRows(),
        expectedPlanDigest:
          dry.plan.planDigest
      },
      auth,
      testDeps
    );

  assert.equal(
    armed.writeOperations,
    1
  );

  assert.ok(
    armed.approval?.approvalId
  );

  assert.equal(
    armed.approval
      ?.approvalToken,
    "a".repeat(64)
  );

  assert.equal(
    testDeps.repository
      .documents.length,
    0
  );

  assert.equal(
    Date.parse(
      armed.approval
        ?.expiresAt || ""
    ) -
    Date.parse(
      "2026-07-15T11:30:00.000Z"
    ),
    10 * 60 * 1000
  );
});

test("approved commit writes attendance and both assignments then verifies", async () => {
  const testDeps = deps();

  const dry =
    await handleAttendancePhase3b2KimHaeunControlledRollout(
      {
        requestId:
          "phase3b2kh-dry-run-test-0003",
        mode: "dry_run",
        records: targetRows()
      },
      auth,
      testDeps
    );

  const armed =
    await handleAttendancePhase3b2KimHaeunControlledRollout(
      {
        requestId:
          "phase3b2kh-arm-test-0002",
        mode: "arm",
        records: targetRows(),
        expectedPlanDigest:
          dry.plan.planDigest
      },
      auth,
      testDeps
    );

  const result =
    await handleAttendancePhase3b2KimHaeunControlledRollout(
      {
        requestId:
          "phase3b2kh-commit-test-0001",
        mode: "commit",
        records: targetRows(),
        approvalId:
          armed.approval
            ?.approvalId,
        approvalToken:
          armed.approval
            ?.approvalToken
      },
      auth,
      testDeps
    );

  assert.equal(
    result.verificationSafe,
    true
  );

  assert.equal(
    result.commit?.written,
    6
  );

  assert.deepEqual(
    result.assignmentWrites,
    {
      adminWritten: 1,
      teacherWritten: 1
    }
  );

  assert.equal(
    result.plan.status,
    "ready_match"
  );

  assert.equal(
    result.plan
      .assignmentPresence.admin,
    true
  );

  assert.equal(
    result.plan
      .assignmentPresence.teacher,
    true
  );

  assert.equal(
    testDeps.auditWriter
      .rows.length,
    1
  );

  assert.equal(
    testDeps.approvalStore
      .records.get(
        armed.approval
          ?.approvalId || ""
      )?.status,
    "consumed"
  );
});

test("verify after commit is read-only ready_match", async () => {
  const testDeps = deps();
  testDeps.repository
    .adminAssignment = true;
  testDeps.repository
    .teacherAssignment = true;

  const initial =
    await buildAttendancePhase3b2KimHaeunControlledPlan(
      targetRows(),
      auth.uid,
      testDeps.repository,
      new Date(
        "2026-07-15T11:30:00.000Z"
      )
    );

  await testDeps.repository.commit(
    initial.mirrorPlan
  );

  const result =
    await handleAttendancePhase3b2KimHaeunControlledRollout(
      {
        requestId:
          "phase3b2kh-verify-test-0001",
        mode: "verify",
        records: targetRows()
      },
      auth,
      testDeps
    );

  assert.equal(
    result.writeOperations,
    0
  );

  assert.equal(
    result.verificationSafe,
    true
  );

  assert.equal(
    result.plan.status,
    "ready_match"
  );
});

test("non-superAdmin is rejected", async () => {
  const testDeps = deps();

  await assert.rejects(
    () =>
      handleAttendancePhase3b2KimHaeunControlledRollout(
        {
          requestId:
            "phase3b2kh-dry-run-test-0004",
          mode: "dry_run",
          records: targetRows()
        },
        {
          uid: "teacher",
          role: "teacher"
        },
        testDeps
      ),
    /superAdmin/u
  );
});

test("same successful commit requestId is idempotent after approval is consumed", async () => {
  const testDeps = deps();

  const dry =
    await handleAttendancePhase3b2KimHaeunControlledRollout(
      {
        requestId:
          "phase3b2kh-dry-run-test-0005",
        mode: "dry_run",
        records: targetRows()
      },
      auth,
      testDeps
    );

  const armed =
    await handleAttendancePhase3b2KimHaeunControlledRollout(
      {
        requestId:
          "phase3b2kh-arm-test-0003",
        mode: "arm",
        records: targetRows(),
        expectedPlanDigest:
          dry.plan.planDigest
      },
      auth,
      testDeps
    );

  const commitInput = {
    requestId:
      "phase3b2kh-commit-test-duplicate-0001",
    mode: "commit" as const,
    records: targetRows(),
    approvalId:
      armed.approval?.approvalId,
    approvalToken:
      armed.approval?.approvalToken
  };

  const first =
    await handleAttendancePhase3b2KimHaeunControlledRollout(
      commitInput,
      auth,
      testDeps
    );

  const second =
    await handleAttendancePhase3b2KimHaeunControlledRollout(
      commitInput,
      auth,
      testDeps
    );

  assert.equal(
    first.duplicate,
    false
  );

  assert.equal(
    second.duplicate,
    true
  );

  assert.equal(
    second.writeOperations,
    0
  );

  assert.equal(
    second.verificationSafe,
    true
  );

  assert.equal(
    testDeps.auditWriter
      .rows.length,
    1
  );
});

test("active conflicting teachers directory UID blocks the fixed rollout", async () => {
  const testDeps = deps();

  testDeps.repository.teacherCandidates = [
    {
      teacherUid:
        "ADM-CONFLICTING-TEACHER",
      teacherName: "김하은",
      active: true,
      source: "test_conflict"
    }
  ];

  const plan =
    await buildAttendancePhase3b2KimHaeunControlledPlan(
      targetRows(),
      auth.uid,
      testDeps.repository
    );

  assert.equal(
    plan.safeToArm,
    false
  );

  assert.equal(
    plan.status,
    "blocked"
  );

  assert.match(
    plan.errors.join("\n"),
    /teachers directory contains an active UID that conflicts/u
  );
});

test("source record teacherUid conflicting with fixed UID is blocked", async () => {
  const testDeps = deps();

  const plan =
    await buildAttendancePhase3b2KimHaeunControlledPlan(
      [
        targetRow(
          "V7",
          1,
          {
            teacherUid:
              "ADM-CONFLICTING-SOURCE"
          }
        ),
        ...targetRows().slice(1)
      ],
      auth.uid,
      testDeps.repository
    );

  assert.equal(
    plan.safeToArm,
    false
  );

  assert.equal(
    plan.status,
    "blocked"
  );

  assert.match(
    plan.errors.join("\n"),
    /source record teacherUid conflicts/u
  );
});

