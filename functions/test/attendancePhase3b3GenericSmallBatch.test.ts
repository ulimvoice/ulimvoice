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
  ATTENDANCE_PHASE3B3_GENERIC_BATCH_TARGETS,
  buildAttendancePhase3b3GenericBatchPlan,
  type AttendancePhase3b3AssignmentPresence,
  type AttendancePhase3b3BatchInputScope,
  type AttendancePhase3b3BatchTarget
} from "../src/mirror/attendancePhase3b3GenericSmallBatch.js";
import {
  handleAttendancePhase3b3GenericSmallBatch,
  type AttendancePhase3b3GenericBatchApproval,
  type AttendancePhase3b3GenericBatchApprovalStore,
  type AttendancePhase3b3GenericBatchAssignmentWriter,
  type AttendancePhase3b3GenericBatchAuditWriter
} from "../src/mirror/syncAttendancePhase3b3GenericSmallBatchCallable.js";

function rowForTarget(
  target:
    AttendancePhase3b3BatchTarget,
  sourceKey: string,
  index: number,
  overrides:
    Record<string, unknown> = {}
) {
  const sourceCell =
    sourceKey.split("|")[1];

  return {
    date:
      target.date,
    sessionDate:
      target.date,
    studentName:
      `학생${target.scopeId}-${index}`,
    studentNo:
      String(7000 + index),
    studentUid:
      `STU-TEST-${target.scopeId}-${index}`,
    studentIdentityKey:
      `UID_TEST_${target.scopeId}_${index}`,
    instructor:
      target.instructor,
    teacherUid: "",
    teacherName:
      target.instructor,
    className:
      target.className,
    classroom:
      "테스트강의실",
    status:
      "미체크",
    attendanceStatus:
      "미체크",
    sourceSheet:
      sourceKey.split("|")[0],
    sourceCell,
    sourceKey,
    ...overrides
  };
}

function scopeForTarget(
  target:
    AttendancePhase3b3BatchTarget,
  overrides:
    Partial<AttendancePhase3b3BatchInputScope> = {}
): AttendancePhase3b3BatchInputScope {
  return {
    scopeId:
      target.scopeId,
    requestedClassName:
      target.className,
    requestedTeacher:
      target.principalName,
    records:
      target.expectedSourceKeys.map(
        (sourceKey, index) =>
          rowForTarget(
            target,
            sourceKey,
            index + 1
          )
      ),
    ...overrides
  };
}

function batchScopes():
AttendancePhase3b3BatchInputScope[] {
  return ATTENDANCE_PHASE3B3_GENERIC_BATCH_TARGETS
    .map(
      (target) =>
        scopeForTarget(target)
    );
}

class FakeRepository {
  readonly documentsByClass =
    new Map<
      string,
      StoredAttendanceMirrorDocument[]
    >();

  readonly assignmentsByClass =
    new Map<
      string,
      AttendancePhase3b3AssignmentPresence
    >();

  async loadScope(
    scope: {
      sessionDate: string;
      classId?: string;
    }
  ) {
    return (
      this.documentsByClass.get(
        scope.classId || ""
      ) || []
    ).map(
      (document) => ({
        ...document
      })
    );
  }

  async assignmentPresence(
    _operatorUid: string,
    classId: string,
    canonicalInstructor: string
  ) {
    const target =
      ATTENDANCE_PHASE3B3_GENERIC_BATCH_TARGETS
        .find(
          (item) =>
            item.classId === classId
        );

    const assignment =
      this.assignmentsByClass.get(
        classId
      ) || {
        admin: false,
        principal: false
      };

    return {
      admin:
        assignment.admin,
      teacher:
        assignment.principal,
      principal: target
        ? {
            uid:
              target.principalUid,
            name:
              target.principalName,
            accountRole:
              target.principalRole,
            source: "test"
          }
        : {
            uid: "",
            name:
              canonicalInstructor,
            accountRole:
              "unknown" as const,
            source: ""
          }
    };
  }

  async detailedAssignmentPresence(
    _operatorUid: string,
    _principalUid: string,
    classId: string
  ) {
    return (
      this.assignmentsByClass.get(
        classId
      ) || {
        admin: false,
        principal: false
      }
    );
  }

  async commit(
    plan: AttendanceMirrorPlan
  ): Promise<
    AttendanceMirrorCommitResult
  > {
    const classId =
      plan.scope.classId || "";

    const current =
      this.documentsByClass.get(
        classId
      ) || [];

    const byId =
      new Map(
        current.map(
          (document) => [
            document.id,
            document
          ]
        )
      );

    for (
      const document of
      plan.upserts
    ) {
      byId.set(
        document.id,
        {
          ...document
        }
      );
    }

    for (
      const id of
      plan.staleIds
    ) {
      const existing =
        byId.get(id);

      if (existing) {
        byId.set(
          id,
          {
            ...existing,
            active: false,
            staleAt:
              "2026-07-16T00:00:00.000Z"
          }
        );
      }
    }

    this.documentsByClass.set(
      classId,
      [...byId.values()]
    );

    return {
      runId:
        plan.runId,
      scopeKey:
        plan.scopeKey,
      written:
        plan.upserts.length,
      staleMarked:
        plan.staleIds.length,
      unchanged:
        plan.unchangedIds.length,
      stateDocumentId:
        `attendance__${classId}`
    };
  }
}

class FakeApprovalStore
implements AttendancePhase3b3GenericBatchApprovalStore {
  readonly records =
    new Map<
      string,
      AttendancePhase3b3GenericBatchApproval
    >();

  async create(
    approval:
      AttendancePhase3b3GenericBatchApproval
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
        lastError:
          error
      }
    );
  }
}

class FakeAssignmentWriter
implements AttendancePhase3b3GenericBatchAssignmentWriter {
  constructor(
    private readonly repository:
      FakeRepository
  ) {}

  async ensureAssignments(
    _operatorUid: string,
    _principalUid: string,
    _principalRole:
      "teacher" | "superAdmin",
    classId: string
  ) {
    const current =
      this.repository
        .assignmentsByClass
        .get(classId) || {
          admin: false,
          principal: false
        };

    const writes = {
      adminWritten:
        current.admin
          ? 0
          : 1,
      principalWritten:
        current.principal
          ? 0
          : 1
    };

    this.repository
      .assignmentsByClass
      .set(
        classId,
        {
          admin: true,
          principal: true
        }
      );

    return writes;
  }
}

class FakeAuditWriter
implements AttendancePhase3b3GenericBatchAuditWriter {
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
        "2026-07-15T19:30:00.000Z"
      ),
    tokenFactory: () =>
      "b".repeat(64)
  };
}

const auth = {
  uid: "firebase-super-admin",
  role: "superAdmin"
};

test("three fixed scopes produce a safe 20-record initial batch", async () => {
  const testDeps = deps();

  const plan =
    await buildAttendancePhase3b3GenericBatchPlan(
      batchScopes(),
      auth.uid,
      testDeps.repository,
      new Date(
        "2026-07-15T19:30:00.000Z"
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
    plan.sourceCount,
    20
  );

  assert.equal(
    plan.acceptedCount,
    20
  );

  assert.equal(
    plan.totals.upsertCount,
    20
  );

  assert.equal(
    plan.scopes.length,
    3
  );

  assert.deepEqual(
    plan.scopes.map(
      (scope) =>
        scope.principalRole
    ),
    [
      "teacher",
      "superAdmin",
      "superAdmin"
    ]
  );

  assert.match(
    plan.batchPlanDigest,
    /^[a-f0-9]{64}$/u
  );
});

test("sourceKey outside a fixed allowlist blocks the whole batch", async () => {
  const testDeps = deps();
  const scopes =
    batchScopes();

  const first =
    scopes[0];

  scopes[0] = {
    ...first,
    records: [
      ...first.records.slice(
        0,
        -1
      ),
      rowForTarget(
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_TARGETS[0],
        "김하은T|V14",
        7
      )
    ]
  };

  const plan =
    await buildAttendancePhase3b3GenericBatchPlan(
      scopes,
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

test("duplicate scopeId blocks the whole batch", async () => {
  const testDeps = deps();
  const scopes =
    batchScopes();

  scopes[2] = {
    ...scopes[2],
    scopeId:
      scopes[1].scopeId
  };

  const plan =
    await buildAttendancePhase3b3GenericBatchPlan(
      scopes,
      auth.uid,
      testDeps.repository
    );

  assert.equal(
    plan.safeToArm,
    false
  );

  assert.match(
    plan.errors.join("\n"),
    /duplicate batch scopeId|missing batch scopeId/u
  );
});

test("source teacherUid equal to fixed principal is accepted without changing classId", async () => {
  const testDeps = deps();
  const scopes =
    batchScopes();

  scopes[1] = {
    ...scopes[1],
    records:
      scopes[1].records.map(
        (record) => ({
          ...record,
          teacherUid:
            "ADM-20260604-90A754C4"
        })
      )
  };

  const plan =
    await buildAttendancePhase3b3GenericBatchPlan(
      scopes,
      auth.uid,
      testDeps.repository
    );

  assert.equal(
    plan.safeToArm,
    true
  );

  assert.equal(
    plan.scopes[1]
      .canonicalClassId,
    "legacy_894929dd08ff2ee580164a6a"
  );
});

test("source teacherUid conflicting with fixed principal blocks the batch", async () => {
  const testDeps = deps();
  const scopes =
    batchScopes();

  scopes[1] = {
    ...scopes[1],
    records:
      scopes[1].records.map(
        (record, index) =>
          index === 0
            ? {
                ...record,
                teacherUid:
                  "ADM-CONFLICT"
              }
            : record
      )
  };

  const plan =
    await buildAttendancePhase3b3GenericBatchPlan(
      scopes,
      auth.uid,
      testDeps.repository
    );

  assert.equal(
    plan.safeToArm,
    false
  );

  assert.match(
    plan.errors.join("\n"),
    /principalUid/u
  );
});

test("dry run is read-only", async () => {
  const testDeps = deps();

  const result =
    await handleAttendancePhase3b3GenericSmallBatch(
      {
        requestId:
          "phase3b3-batch-dry-run-0001",
        mode: "dry_run",
        scopes:
          batchScopes()
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
      .documentsByClass.size,
    0
  );
});

test("arm creates only one ten-minute batch approval", async () => {
  const testDeps = deps();

  const dry =
    await handleAttendancePhase3b3GenericSmallBatch(
      {
        requestId:
          "phase3b3-batch-dry-run-0002",
        mode: "dry_run",
        scopes:
          batchScopes()
      },
      auth,
      testDeps
    );

  const armed =
    await handleAttendancePhase3b3GenericSmallBatch(
      {
        requestId:
          "phase3b3-batch-arm-0001",
        mode: "arm",
        scopes:
          batchScopes(),
        expectedPlanDigest:
          dry.plan.batchPlanDigest
      },
      auth,
      testDeps
    );

  assert.equal(
    armed.writeOperations,
    1
  );

  assert.ok(
    armed.approval
      ?.approvalId
  );

  assert.equal(
    armed.approval
      ?.approvalToken,
    "b".repeat(64)
  );

  assert.equal(
    Date.parse(
      armed.approval
        ?.expiresAt || ""
    ) -
    Date.parse(
      "2026-07-15T19:30:00.000Z"
    ),
    10 * 60 * 1000
  );

  assert.equal(
    testDeps.repository
      .documentsByClass.size,
    0
  );
});

test("approved commit writes 20 attendance rows and six assignments then verifies", async () => {
  const testDeps = deps();

  const dry =
    await handleAttendancePhase3b3GenericSmallBatch(
      {
        requestId:
          "phase3b3-batch-dry-run-0003",
        mode: "dry_run",
        scopes:
          batchScopes()
      },
      auth,
      testDeps
    );

  const armed =
    await handleAttendancePhase3b3GenericSmallBatch(
      {
        requestId:
          "phase3b3-batch-arm-0002",
        mode: "arm",
        scopes:
          batchScopes(),
        expectedPlanDigest:
          dry.plan.batchPlanDigest
      },
      auth,
      testDeps
    );

  const result =
    await handleAttendancePhase3b3GenericSmallBatch(
      {
        requestId:
          "phase3b3-batch-commit-0001",
        mode: "commit",
        scopes:
          batchScopes(),
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
    result.writeOperations,
    27
  );

  assert.equal(
    result.commits.reduce(
      (total, item) =>
        total +
        (
          item.result
            ?.written || 0
        ),
      0
    ),
    20
  );

  assert.deepEqual(
    result.assignmentWriteTotals,
    {
      adminWritten: 3,
      principalWritten: 3
    }
  );

  assert.equal(
    result.plan.status,
    "ready_match"
  );

  assert.equal(
    result.plan.totals
      .unchangedCount,
    20
  );

  assert.equal(
    result.plan.scopes.every(
      (scope) =>
        scope.assignmentPresence
          .admin &&
        scope.assignmentPresence
          .principal
    ),
    true
  );

  assert.equal(
    testDeps.auditWriter
      .rows.length,
    1
  );
});

test("verify after commit is read-only ready_match", async () => {
  const testDeps = deps();

  const initial =
    await buildAttendancePhase3b3GenericBatchPlan(
      batchScopes(),
      auth.uid,
      testDeps.repository,
      new Date(
        "2026-07-15T19:30:00.000Z"
      )
    );

  for (
    const scope of
    initial.scopes
  ) {
    await testDeps.repository
      .commit(
        scope.mirrorPlan
      );

    testDeps.repository
      .assignmentsByClass
      .set(
        scope.canonicalClassId,
        {
          admin: true,
          principal: true
        }
      );
  }

  const result =
    await handleAttendancePhase3b3GenericSmallBatch(
      {
        requestId:
          "phase3b3-batch-verify-0001",
        mode: "verify",
        scopes:
          batchScopes()
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
      handleAttendancePhase3b3GenericSmallBatch(
        {
          requestId:
            "phase3b3-batch-dry-run-0004",
          mode: "dry_run",
          scopes:
            batchScopes()
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

test("same successful commit requestId is idempotent after approval consumption", async () => {
  const testDeps = deps();

  const dry =
    await handleAttendancePhase3b3GenericSmallBatch(
      {
        requestId:
          "phase3b3-batch-dry-run-0005",
        mode: "dry_run",
        scopes:
          batchScopes()
      },
      auth,
      testDeps
    );

  const armed =
    await handleAttendancePhase3b3GenericSmallBatch(
      {
        requestId:
          "phase3b3-batch-arm-0003",
        mode: "arm",
        scopes:
          batchScopes(),
        expectedPlanDigest:
          dry.plan.batchPlanDigest
      },
      auth,
      testDeps
    );

  const input = {
    requestId:
      "phase3b3-batch-commit-duplicate-0001",
    mode: "commit" as const,
    scopes:
      batchScopes(),
    approvalId:
      armed.approval
        ?.approvalId,
    approvalToken:
      armed.approval
        ?.approvalToken
  };

  const first =
    await handleAttendancePhase3b3GenericSmallBatch(
      input,
      auth,
      testDeps
    );

  const second =
    await handleAttendancePhase3b3GenericSmallBatch(
      input,
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

test("source change after approval invalidates commit", async () => {
  const testDeps = deps();

  const original =
    batchScopes();

  const dry =
    await handleAttendancePhase3b3GenericSmallBatch(
      {
        requestId:
          "phase3b3-batch-dry-run-0006",
        mode: "dry_run",
        scopes:
          original
      },
      auth,
      testDeps
    );

  const armed =
    await handleAttendancePhase3b3GenericSmallBatch(
      {
        requestId:
          "phase3b3-batch-arm-0004",
        mode: "arm",
        scopes:
          original,
        expectedPlanDigest:
          dry.plan.batchPlanDigest
      },
      auth,
      testDeps
    );

  const changed =
    batchScopes();

  changed[0] = {
    ...changed[0],
    records:
      changed[0].records.map(
        (record, index) =>
          index === 0
            ? {
                ...record,
                status: "O",
                attendanceStatus:
                  "O"
              }
            : record
      )
  };

  await assert.rejects(
    () =>
      handleAttendancePhase3b3GenericSmallBatch(
        {
          requestId:
            "phase3b3-batch-commit-changed-0001",
          mode: "commit",
          scopes:
            changed,
          approvalId:
            armed.approval
              ?.approvalId,
          approvalToken:
            armed.approval
              ?.approvalToken
        },
        auth,
        testDeps
      ),
    /source changed after approval/u
  );
});

test("one already matched scope remains safe and only remaining rows are planned", async () => {
  const testDeps = deps();

  const firstOnly =
    await buildAttendancePhase3b3GenericBatchPlan(
      batchScopes(),
      auth.uid,
      testDeps.repository,
      new Date(
        "2026-07-15T19:30:00.000Z"
      )
    );

  await testDeps.repository
    .commit(
      firstOnly.scopes[0]
        .mirrorPlan
    );

  testDeps.repository
    .assignmentsByClass
    .set(
      firstOnly.scopes[0]
        .canonicalClassId,
      {
        admin: true,
        principal: true
      }
    );

  const next =
    await buildAttendancePhase3b3GenericBatchPlan(
      batchScopes(),
      auth.uid,
      testDeps.repository,
      new Date(
        "2026-07-15T19:31:00.000Z"
      )
    );

  assert.equal(
    next.safeToArm,
    true
  );

  assert.equal(
    next.status,
    "ready_initial_sync"
  );

  assert.equal(
    next.scopes[0].status,
    "ready_match"
  );

  assert.equal(
    next.totals.upsertCount,
    13
  );

  assert.equal(
    next.totals.adminAssignments,
    2
  );

  assert.equal(
    next.totals.principalAssignments,
    2
  );
});

test("stale active attendance document blocks the batch", async () => {
  const testDeps = deps();

  const initial =
    await buildAttendancePhase3b3GenericBatchPlan(
      batchScopes(),
      auth.uid,
      testDeps.repository,
      new Date(
        "2026-07-15T19:30:00.000Z"
      )
    );

  const first =
    initial.scopes[0];

  await testDeps.repository
    .commit(first.mirrorPlan);

  const current =
    testDeps.repository
      .documentsByClass
      .get(
        first.canonicalClassId
      ) || [];

  testDeps.repository
    .documentsByClass
    .set(
      first.canonicalClassId,
      [
        ...current,
        {
          ...current[0],
          id:
            `${current[0].id}_extra`,
          sessionId:
            `${current[0].sessionId}_extra`,
          studentUid:
            "STU-EXTRA",
          studentIdentityKey:
            "UID_EXTRA",
          studentName:
            "추가학생",
          payloadDigest:
            "extra-digest",
          active: true
        }
      ]
    );

  const plan =
    await buildAttendancePhase3b3GenericBatchPlan(
      batchScopes(),
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
    /stale attendance/u
  );
});

test("administrator instructors remain superAdmin principals", async () => {
  const testDeps = deps();

  const plan =
    await buildAttendancePhase3b3GenericBatchPlan(
      batchScopes(),
      auth.uid,
      testDeps.repository
    );

  const leeScopes =
    plan.scopes.filter(
      (scope) =>
        scope.principalName ===
        "이용우"
    );

  assert.equal(
    leeScopes.length,
    2
  );

  assert.equal(
    leeScopes.every(
      (scope) =>
        scope.principalRole ===
        "superAdmin"
    ),
    true
  );

  assert.equal(
    leeScopes.every(
      (scope) =>
        scope.principalUid ===
        "ADM-20260604-90A754C4"
    ),
    true
  );
});

test("commit input must contain exactly three scopes and 20 rows", async () => {
  const testDeps = deps();

  await assert.rejects(
    () =>
      handleAttendancePhase3b3GenericSmallBatch(
        {
          requestId:
            "phase3b3-batch-dry-run-invalid-count",
          mode: "dry_run",
          scopes:
            batchScopes().slice(
              0,
              2
            )
        },
        auth,
        testDeps
      ),
    /exactly 3/u
  );
});
