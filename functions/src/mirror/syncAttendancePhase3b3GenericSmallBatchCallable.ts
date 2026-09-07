import {
  randomBytes
} from "node:crypto";
import {
  getFirestore,
  type Firestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
  type CallableRequest
} from "firebase-functions/v2/https";
import {
  ULIM_FUNCTION_REGION
} from "../common/firebaseRegion.js";
import {
  getOrInitializeDefaultFirebaseAdminApp
} from "../common/firebaseAdminApp.js";
import {
  FirestoreIdempotencyStore,
  type IdempotencyStore
} from "../common/idempotency.js";
import type {
  LegacyAttendanceRecord
} from "./attendanceMirror.js";
import type {
  AttendanceMirrorCommitResult,
  AttendanceMirrorRepository
} from "./firestoreAttendanceMirrorRepository.js";
import {
  FirestoreAttendanceMirrorRepository
} from "./firestoreAttendanceMirrorRepository.js";
import {
  ATTENDANCE_PHASE3B3_GENERIC_BATCH_CONFIRMATION,
  ATTENDANCE_PHASE3B3_GENERIC_BATCH_ROLLOUT_ID,
  ATTENDANCE_PHASE3B3_GENERIC_BATCH_TARGETS,
  ATTENDANCE_PHASE3B3_GENERIC_BATCH_VERSION,
  attendancePhase3b3GenericBatchApprovalTokenHash,
  buildAttendancePhase3b3GenericBatchPlan,
  publicAttendancePhase3b3GenericBatchPlan,
  type AttendancePhase3b3AssignmentPresence,
  type AttendancePhase3b3BatchInputScope,
  type AttendancePhase3b3BatchPlan,
  type AttendancePhase3b3BatchRepository,
  type AttendancePhase3b3PrincipalRole
} from "./attendancePhase3b3GenericSmallBatch.js";

export type AttendancePhase3b3GenericBatchMode =
  | "dry_run"
  | "arm"
  | "commit"
  | "verify";

export interface AttendancePhase3b3GenericBatchInput {
  readonly requestId: string;
  readonly mode:
    AttendancePhase3b3GenericBatchMode;
  readonly scopes:
    readonly AttendancePhase3b3BatchInputScope[];
  readonly expectedPlanDigest?: string;
  readonly approvalId?: string;
  readonly approvalToken?: string;
}

export interface AttendancePhase3b3GenericBatchAuth {
  readonly uid: string;
  readonly role: string;
}

export interface AttendancePhase3b3GenericBatchApproval {
  readonly approvalId: string;
  readonly version: string;
  readonly rolloutId: string;
  readonly operatorUid: string;
  readonly planDigest: string;
  readonly sourceDigest: string;
  readonly targetCount: 3;
  readonly expectedAttendanceCount: 20;
  readonly tokenHash: string;
  readonly status:
    | "armed"
    | "committing"
    | "consumed"
    | "failed";
  readonly armedAt: string;
  readonly expiresAt: string;
  readonly commitRequestId?: string;
  readonly consumedAt?: string;
  readonly failedAt?: string;
  readonly lastError?: string;
}

export interface AttendancePhase3b3GenericBatchApprovalStore {
  create(
    approval:
      AttendancePhase3b3GenericBatchApproval
  ): Promise<void>;

  get(
    approvalId: string
  ): Promise<
    AttendancePhase3b3GenericBatchApproval |
    undefined
  >;

  claim(
    approvalId: string,
    checks: {
      readonly operatorUid: string;
      readonly planDigest: string;
      readonly tokenHash: string;
      readonly commitRequestId: string;
      readonly now: Date;
    }
  ): Promise<
    AttendancePhase3b3GenericBatchApproval
  >;

  complete(
    approvalId: string,
    completedAt: Date
  ): Promise<void>;

  fail(
    approvalId: string,
    error: string,
    failedAt: Date
  ): Promise<void>;
}

export interface AttendancePhase3b3GenericBatchAssignmentWriter {
  ensureAssignments(
    operatorUid: string,
    principalUid: string,
    principalRole:
      AttendancePhase3b3PrincipalRole,
    classId: string,
    className: string,
    instructor: string,
    rolloutId: string,
    now: Date
  ): Promise<{
    readonly adminWritten: number;
    readonly principalWritten: number;
  }>;
}

export interface AttendancePhase3b3GenericBatchAuditWriter {
  writeAudit(
    requestId: string,
    payload: Record<string, unknown>
  ): Promise<void>;
}

export interface AttendancePhase3b3GenericBatchDeps {
  readonly repository:
    AttendancePhase3b3BatchRepository &
    AttendanceMirrorRepository;
  readonly approvalStore:
    AttendancePhase3b3GenericBatchApprovalStore;
  readonly assignmentWriter:
    AttendancePhase3b3GenericBatchAssignmentWriter;
  readonly auditWriter:
    AttendancePhase3b3GenericBatchAuditWriter;
  readonly idempotencyStore:
    IdempotencyStore;
  readonly now?: () => number;
  readonly tokenFactory?: () => string;
}

export interface AttendancePhase3b3ScopeCommitResult {
  readonly scopeId: string;
  readonly skippedReadyMatch: boolean;
  readonly result:
    AttendanceMirrorCommitResult | null;
}

export interface AttendancePhase3b3ScopeAssignmentWrites {
  readonly scopeId: string;
  readonly principalUid: string;
  readonly principalRole:
    AttendancePhase3b3PrincipalRole;
  readonly adminWritten: number;
  readonly principalWritten: number;
}

export interface AttendancePhase3b3GenericBatchResult {
  readonly ok: true;
  readonly version: string;
  readonly rolloutId: string;
  readonly mode:
    AttendancePhase3b3GenericBatchMode;
  readonly requestId: string;
  readonly duplicate: boolean;
  readonly writeOperations: number;
  readonly plan:
    ReturnType<
      typeof publicAttendancePhase3b3GenericBatchPlan
    >;
  readonly approval: null | {
    readonly approvalId: string;
    readonly approvalToken?: string;
    readonly expiresAt: string;
    readonly planDigest: string;
  };
  readonly commits:
    readonly AttendancePhase3b3ScopeCommitResult[];
  readonly assignmentWrites:
    readonly AttendancePhase3b3ScopeAssignmentWrites[];
  readonly assignmentWriteTotals: {
    readonly adminWritten: number;
    readonly principalWritten: number;
  };
  readonly verificationSafe:
    boolean | null;
}

const REQUEST_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

const APPROVAL_ID_PATTERN =
  /^phase3b3gb_[a-f0-9]{32}$/;

const MAX_SCOPES = 3;
const MAX_RECORDS_PER_SCOPE = 7;
const MAX_TOTAL_RECORDS = 20;
const ARM_TTL_MS =
  10 * 60 * 1000;

function text(value: unknown): string {
  return String(value ?? "")
    .trim()
    .normalize("NFC");
}

function integerOrUndefined(
  value: unknown
): number | undefined {
  const number = Number(value);

  return Number.isInteger(number)
    ? number
    : undefined;
}

function sanitizeRecord(
  value: unknown
): LegacyAttendanceRecord {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "each attendance record must be an object"
    );
  }

  const record =
    value as Record<string, unknown>;

  return {
    date:
      text(record.date),
    sessionDate:
      text(record.sessionDate),
    studentName:
      text(record.studentName),
    studentNo:
      text(record.studentNo),
    studentUid:
      text(record.studentUid),
    studentIdentityKey:
      text(
        record.studentIdentityKey
      ),
    studentRowNumber:
      integerOrUndefined(
        record.studentRowNumber
      ),
    instructor:
      text(record.instructor),
    teacherUid:
      text(record.teacherUid),
    teacherName:
      text(record.teacherName),
    className:
      text(record.className),
    classroom:
      text(record.classroom),
    startTime:
      text(record.startTime),
    endTime:
      text(record.endTime),
    status:
      text(record.status),
    attendanceStatus:
      text(
        record.attendanceStatus
      ),
    specialStatus:
      text(record.specialStatus),
    enrollmentStatus:
      text(
        record.enrollmentStatus
      ),
    studentStatus:
      text(record.studentStatus),
    memo:
      text(record.memo),
    note:
      text(record.note),
    sourceSheet:
      text(record.sourceSheet),
    sourceRow:
      integerOrUndefined(
        record.sourceRow
      ),
    sourceCol:
      integerOrUndefined(
        record.sourceCol
      ),
    sourceCell:
      text(record.sourceCell),
    sourceKey:
      text(record.sourceKey)
  };
}

function parseInput(
  data: unknown
): AttendancePhase3b3GenericBatchInput {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Phase 3B-3 batch input must be an object"
    );
  }

  const input =
    data as Record<string, unknown>;

  const allowed =
    new Set([
      "requestId",
      "mode",
      "scopes",
      "expectedPlanDigest",
      "approvalId",
      "approvalToken"
    ]);

  for (
    const key of Object.keys(input)
  ) {
    if (!allowed.has(key)) {
      throw new HttpsError(
        "invalid-argument",
        `unexpected Phase 3B-3 field: ${key}`
      );
    }
  }

  const requestId =
    text(input.requestId);

  if (
    !REQUEST_ID_PATTERN.test(
      requestId
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "requestId format is invalid"
    );
  }

  const mode =
    text(input.mode) as
      AttendancePhase3b3GenericBatchMode;

  if (
    mode !== "dry_run" &&
    mode !== "arm" &&
    mode !== "commit" &&
    mode !== "verify"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "mode must be dry_run, arm, commit, or verify"
    );
  }

  if (
    !Array.isArray(input.scopes) ||
    input.scopes.length !==
      MAX_SCOPES
  ) {
    throw new HttpsError(
      "invalid-argument",
      `scopes must contain exactly ${MAX_SCOPES} items`
    );
  }

  let totalRecords = 0;

  const scopes =
    input.scopes.map(
      (value, index) => {
        if (
          !value ||
          typeof value !== "object" ||
          Array.isArray(value)
        ) {
          throw new HttpsError(
            "invalid-argument",
            `scopes[${index}] must be an object`
          );
        }

        const scope =
          value as Record<
            string,
            unknown
          >;

        if (
          !Array.isArray(
            scope.records
          ) ||
          scope.records.length < 1 ||
          scope.records.length >
            MAX_RECORDS_PER_SCOPE
        ) {
          throw new HttpsError(
            "invalid-argument",
            `scopes[${index}].records must contain 1-${MAX_RECORDS_PER_SCOPE} rows`
          );
        }

        totalRecords +=
          scope.records.length;

        return {
          scopeId:
            text(scope.scopeId),
          requestedClassName:
            text(
              scope.requestedClassName
            ),
          requestedTeacher:
            text(
              scope.requestedTeacher
            ),
          records:
            scope.records.map(
              sanitizeRecord
            )
        };
      }
    );

  if (
    totalRecords !==
    MAX_TOTAL_RECORDS
  ) {
    throw new HttpsError(
      "invalid-argument",
      `batch must contain exactly ${MAX_TOTAL_RECORDS} attendance rows`
    );
  }

  const expectedPlanDigest =
    text(
      input.expectedPlanDigest
    );
  const approvalId =
    text(input.approvalId);
  const approvalToken =
    text(input.approvalToken);

  if (
    mode === "arm" &&
    !/^[a-f0-9]{64}$/u.test(
      expectedPlanDigest
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "arm requires expectedPlanDigest"
    );
  }

  if (
    mode === "commit" &&
    (
      !APPROVAL_ID_PATTERN.test(
        approvalId
      ) ||
      approvalToken.length < 32
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "commit requires approvalId and approvalToken"
    );
  }

  return {
    requestId,
    mode,
    scopes,
    expectedPlanDigest:
      expectedPlanDigest ||
      undefined,
    approvalId:
      approvalId || undefined,
    approvalToken:
      approvalToken || undefined
  };
}

function requireSuperAdmin(
  auth:
    AttendancePhase3b3GenericBatchAuth |
    undefined
): void {
  if (!auth?.uid) {
    throw new HttpsError(
      "unauthenticated",
      "Firebase authentication is required"
    );
  }

  if (
    auth.role !== "superAdmin"
  ) {
    throw new HttpsError(
      "permission-denied",
      "Phase 3B-3 generic batch requires superAdmin"
    );
  }
}

function approvalId(): string {
  return (
    "phase3b3gb_" +
    randomBytes(16).toString("hex")
  );
}

function approvalToken(): string {
  return randomBytes(32)
    .toString("hex");
}

function operationName(): string {
  return [
    "attendance_phase3b3_generic_small_batch",
    ATTENDANCE_PHASE3B3_GENERIC_BATCH_ROLLOUT_ID,
    "2026-07-18",
    "3classes",
    "20records",
    "commit"
  ].join(":");
}

function approvalValid(
  approval:
    AttendancePhase3b3GenericBatchApproval |
    undefined,
  auth:
    AttendancePhase3b3GenericBatchAuth,
  input:
    AttendancePhase3b3GenericBatchInput,
  plan:
    AttendancePhase3b3BatchPlan,
  now: Date
): void {
  if (!approval) {
    throw new HttpsError(
      "failed-precondition",
      "Phase 3B-3 approval was not found"
    );
  }

  if (
    approval.status !== "armed"
  ) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 3B-3 approval is ${approval.status}`
    );
  }

  if (
    approval.operatorUid !==
    auth.uid
  ) {
    throw new HttpsError(
      "permission-denied",
      "Phase 3B-3 approval belongs to another operator"
    );
  }

  if (
    approval.planDigest !==
    plan.batchPlanDigest
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Phase 3B-3 source changed after approval"
    );
  }

  if (
    approval.tokenHash !==
    attendancePhase3b3GenericBatchApprovalTokenHash(
      input.approvalToken || ""
    )
  ) {
    throw new HttpsError(
      "permission-denied",
      "Phase 3B-3 approval token is invalid"
    );
  }

  if (
    Date.parse(
      approval.expiresAt
    ) <= now.getTime()
  ) {
    throw new HttpsError(
      "deadline-exceeded",
      "Phase 3B-3 approval expired"
    );
  }
}

function verificationSafe(
  plan:
    AttendancePhase3b3BatchPlan
): boolean {
  return !!(
    plan.status === "ready_match" &&
    plan.totals.upsertCount === 0 &&
    plan.totals.staleCount === 0 &&
    plan.totals.missingIdCount === 0 &&
    plan.totals.mismatchedIdCount === 0 &&
    plan.totals.extraActiveIdCount === 0 &&
    plan.scopes.every(
      (scope) =>
        scope.assignmentPresence
          .admin &&
        scope.assignmentPresence
          .principal
    ) &&
    plan.errors.length === 0
  );
}

function zeroAssignmentTotals() {
  return {
    adminWritten: 0,
    principalWritten: 0
  };
}

function duplicateResult(
  input:
    AttendancePhase3b3GenericBatchInput,
  plan:
    AttendancePhase3b3BatchPlan
): AttendancePhase3b3GenericBatchResult {
  return {
    ok: true,
    version:
      ATTENDANCE_PHASE3B3_GENERIC_BATCH_VERSION,
    rolloutId:
      ATTENDANCE_PHASE3B3_GENERIC_BATCH_ROLLOUT_ID,
    mode:
      input.mode,
    requestId:
      input.requestId,
    duplicate: true,
    writeOperations: 0,
    plan:
      publicAttendancePhase3b3GenericBatchPlan(
        plan
      ),
    approval: null,
    commits: [],
    assignmentWrites: [],
    assignmentWriteTotals:
      zeroAssignmentTotals(),
    verificationSafe:
      verificationSafe(plan)
  };
}

export async function handleAttendancePhase3b3GenericSmallBatch(
  data: unknown,
  auth:
    AttendancePhase3b3GenericBatchAuth |
    undefined,
  deps:
    AttendancePhase3b3GenericBatchDeps
): Promise<
  AttendancePhase3b3GenericBatchResult
> {
  requireSuperAdmin(auth);

  const input =
    parseInput(data);

  const now =
    new Date(
      deps.now?.() ??
      Date.now()
    );

  const plan =
    await buildAttendancePhase3b3GenericBatchPlan(
      input.scopes,
      auth!.uid,
      deps.repository,
      now
    );

  if (
    input.mode === "dry_run" ||
    input.mode === "verify"
  ) {
    return {
      ok: true,
      version:
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_VERSION,
      rolloutId:
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_ROLLOUT_ID,
      mode:
        input.mode,
      requestId:
        input.requestId,
      duplicate: false,
      writeOperations: 0,
      plan:
        publicAttendancePhase3b3GenericBatchPlan(
          plan
        ),
      approval: null,
      commits: [],
      assignmentWrites: [],
      assignmentWriteTotals:
        zeroAssignmentTotals(),
      verificationSafe:
        input.mode === "verify"
          ? verificationSafe(plan)
          : null
    };
  }

  if (!plan.safeToArm) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 3B-3 plan is unsafe: ${
        plan.errors.join("; ")
      }`
    );
  }

  if (
    input.mode === "arm"
  ) {
    if (
      input.expectedPlanDigest !==
      plan.batchPlanDigest
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Dry Run digest no longer matches the current source"
      );
    }

    const token =
      deps.tokenFactory?.() ||
      approvalToken();

    const newApprovalId =
      approvalId();

    const expiresAt =
      new Date(
        now.getTime() +
        ARM_TTL_MS
      );

    await deps.approvalStore.create({
      approvalId:
        newApprovalId,
      version:
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_VERSION,
      rolloutId:
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_ROLLOUT_ID,
      operatorUid:
        auth!.uid,
      planDigest:
        plan.batchPlanDigest,
      sourceDigest:
        plan.batchSourceDigest,
      targetCount: 3,
      expectedAttendanceCount: 20,
      tokenHash:
        attendancePhase3b3GenericBatchApprovalTokenHash(
          token
        ),
      status: "armed",
      armedAt:
        now.toISOString(),
      expiresAt:
        expiresAt.toISOString()
    });

    return {
      ok: true,
      version:
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_VERSION,
      rolloutId:
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_ROLLOUT_ID,
      mode:
        input.mode,
      requestId:
        input.requestId,
      duplicate: false,
      writeOperations: 1,
      plan:
        publicAttendancePhase3b3GenericBatchPlan(
          plan
        ),
      approval: {
        approvalId:
          newApprovalId,
        approvalToken:
          token,
        expiresAt:
          expiresAt.toISOString(),
        planDigest:
          plan.batchPlanDigest
      },
      commits: [],
      assignmentWrites: [],
      assignmentWriteTotals:
        zeroAssignmentTotals(),
      verificationSafe: null
    };
  }

  const operation =
    operationName();

  const existingOperation =
    await deps.idempotencyStore.get(
      input.requestId
    );

  if (existingOperation) {
    if (
      existingOperation.operation !==
      operation
    ) {
      throw new HttpsError(
        "already-exists",
        "requestId was used for another operation"
      );
    }

    if (
      existingOperation.status ===
      "firestore_synced"
    ) {
      const currentPlan =
        await buildAttendancePhase3b3GenericBatchPlan(
          input.scopes,
          auth!.uid,
          deps.repository,
          now
        );

      return duplicateResult(
        input,
        currentPlan
      );
    }

    throw new HttpsError(
      "failed-precondition",
      `duplicate request is ${
        existingOperation.status
      }`
    );
  }

  const approval =
    await deps.approvalStore.get(
      input.approvalId || ""
    );

  approvalValid(
    approval,
    auth!,
    input,
    plan,
    now
  );

  const begin =
    await deps.idempotencyStore.begin(
      input.requestId,
      operation,
      now
    );

  if (begin.duplicate) {
    if (
      begin.operation.operation !==
      operation
    ) {
      throw new HttpsError(
        "already-exists",
        "requestId was used for another operation"
      );
    }

    if (
      begin.operation.status ===
      "firestore_synced"
    ) {
      const currentPlan =
        await buildAttendancePhase3b3GenericBatchPlan(
          input.scopes,
          auth!.uid,
          deps.repository,
          now
        );

      return duplicateResult(
        input,
        currentPlan
      );
    }

    throw new HttpsError(
      "failed-precondition",
      `duplicate request is ${
        begin.operation.status
      }`
    );
  }

  let claimed = false;

  try {
    await deps.approvalStore.claim(
      input.approvalId || "",
      {
        operatorUid:
          auth!.uid,
        planDigest:
          plan.batchPlanDigest,
        tokenHash:
          attendancePhase3b3GenericBatchApprovalTokenHash(
            input.approvalToken || ""
          ),
        commitRequestId:
          input.requestId,
        now
      }
    );

    claimed = true;

    const commits:
      AttendancePhase3b3ScopeCommitResult[] =
      [];

    for (const scope of plan.scopes) {
      if (
        scope.mirrorPlan
          .upserts.length === 0 &&
        scope.mirrorPlan
          .staleIds.length === 0
      ) {
        commits.push({
          scopeId:
            scope.scopeId,
          skippedReadyMatch:
            true,
          result: null
        });
        continue;
      }

      const result =
        await deps.repository.commit(
          scope.mirrorPlan
        );

      commits.push({
        scopeId:
          scope.scopeId,
        skippedReadyMatch:
          false,
        result
      });
    }

    const assignmentWrites:
      AttendancePhase3b3ScopeAssignmentWrites[] =
      [];

    for (const scope of plan.scopes) {
      const writes =
        await deps.assignmentWriter
          .ensureAssignments(
            auth!.uid,
            scope.principalUid,
            scope.principalRole,
            scope.canonicalClassId,
            scope.canonicalClassName,
            scope.canonicalInstructor,
            plan.rolloutId,
            now
          );

      assignmentWrites.push({
        scopeId:
          scope.scopeId,
        principalUid:
          scope.principalUid,
        principalRole:
          scope.principalRole,
        adminWritten:
          writes.adminWritten,
        principalWritten:
          writes.principalWritten
      });
    }

    const after =
      await buildAttendancePhase3b3GenericBatchPlan(
        input.scopes,
        auth!.uid,
        deps.repository,
        now
      );

    const safe =
      verificationSafe(after);

    if (!safe) {
      throw new Error(
        "Phase 3B-3 post-write verification failed"
      );
    }

    const assignmentWriteTotals = {
      adminWritten:
        assignmentWrites.reduce(
          (total, item) =>
            total +
            item.adminWritten,
          0
        ),
      principalWritten:
        assignmentWrites.reduce(
          (total, item) =>
            total +
            item.principalWritten,
          0
        )
    };

    await deps.auditWriter.writeAudit(
      input.requestId,
      {
        version:
          ATTENDANCE_PHASE3B3_GENERIC_BATCH_VERSION,
        rolloutId:
          ATTENDANCE_PHASE3B3_GENERIC_BATCH_ROLLOUT_ID,
        requestId:
          input.requestId,
        operatorUid:
          auth!.uid,
        date: "2026-07-18",
        targetCount: 3,
        expectedAttendanceCount: 20,
        sourceDigest:
          plan.batchSourceDigest,
        planDigest:
          plan.batchPlanDigest,
        scopes:
          plan.scopes.map(
            (scope) => {
              const commit =
                commits.find(
                  (item) =>
                    item.scopeId ===
                    scope.scopeId
                );

              const assignment =
                assignmentWrites.find(
                  (item) =>
                    item.scopeId ===
                    scope.scopeId
                );

              return {
                scopeId:
                  scope.scopeId,
                classId:
                  scope.canonicalClassId,
                className:
                  scope.canonicalClassName,
                instructor:
                  scope.canonicalInstructor,
                principalUid:
                  scope.principalUid,
                principalRole:
                  scope.principalRole,
                sourceCount:
                  scope.sourceCount,
                attendanceWritten:
                  commit?.result
                    ?.written || 0,
                attendanceStaleMarked:
                  commit?.result
                    ?.staleMarked || 0,
                adminAssignmentWritten:
                  assignment
                    ?.adminWritten || 0,
                principalAssignmentWritten:
                  assignment
                    ?.principalWritten || 0
              };
            }
          ),
        verificationSafe:
          safe,
        completedAt:
          now.toISOString()
      }
    );

    await deps.approvalStore.complete(
      input.approvalId || "",
      now
    );

    await deps.idempotencyStore.update(
      input.requestId,
      {
        status:
          "firestore_synced",
        resultDigest:
          plan.batchPlanDigest,
        lastError:
          undefined
      }
    );

    const attendanceWritten =
      commits.reduce(
        (total, item) =>
          total +
          (
            item.result?.written ||
            0
          ) +
          (
            item.result
              ?.staleMarked ||
            0
          ),
        0
      );

    return {
      ok: true,
      version:
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_VERSION,
      rolloutId:
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_ROLLOUT_ID,
      mode:
        input.mode,
      requestId:
        input.requestId,
      duplicate: false,
      writeOperations:
        attendanceWritten +
        assignmentWriteTotals
          .adminWritten +
        assignmentWriteTotals
          .principalWritten +
        1,
      plan:
        publicAttendancePhase3b3GenericBatchPlan(
          after
        ),
      approval: {
        approvalId:
          input.approvalId || "",
        expiresAt:
          approval!.expiresAt,
        planDigest:
          plan.batchPlanDigest
      },
      commits,
      assignmentWrites,
      assignmentWriteTotals,
      verificationSafe:
        safe
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(
            0,
            500
          )
        : String(error).slice(
            0,
            500
          );

    if (claimed) {
      try {
        await deps.approvalStore.fail(
          input.approvalId || "",
          message,
          now
        );
      } catch (
        approvalError
      ) {
        console.error(
          "[phase3b3-generic-batch] approval failure recording failed",
          approvalError
        );
      }
    }

    try {
      await deps.idempotencyStore.update(
        input.requestId,
        {
          status: "failed",
          lastError: message
        }
      );
    } catch (
      idempotencyError
    ) {
      console.error(
        "[phase3b3-generic-batch] idempotency failure recording failed",
        idempotencyError
      );
    }

    if (
      error instanceof HttpsError
    ) {
      throw error;
    }

    console.error(
      "[phase3b3-generic-batch] controlled rollout failed",
      error
    );

    throw new HttpsError(
      "internal",
      "Phase 3B-3 generic small batch failed"
    );
  }
}

function normalizedInstructor(
  value: unknown
): string {
  return text(value)
    .replace(/\s+/gu, "")
    .replace(/(?:선생님|강사)$/u, "")
    .replace(/t$/iu, "")
    .toLowerCase();
}

function targetByClass(
  classId: string,
  canonicalInstructor: string
) {
  return ATTENDANCE_PHASE3B3_GENERIC_BATCH_TARGETS
    .find(
      (target) =>
        target.classId ===
          classId &&
        normalizedInstructor(
          target.instructor
        ) ===
        normalizedInstructor(
          canonicalInstructor
        )
    );
}

export class FirestoreAttendancePhase3b3GenericBatchRepository
implements AttendancePhase3b3BatchRepository,
AttendanceMirrorRepository {
  private readonly mirror:
    FirestoreAttendanceMirrorRepository;

  constructor(
    private readonly db: Firestore
  ) {
    this.mirror =
      new FirestoreAttendanceMirrorRepository(
        db
      );
  }

  loadScope(
    scope: {
      sessionDate: string;
      classId?: string;
    }
  ) {
    return this.mirror.loadScope(
      scope
    );
  }

  commit(
    plan: Parameters<
      AttendanceMirrorRepository["commit"]
    >[0]
  ) {
    return this.mirror.commit(
      plan
    );
  }

  async assignmentPresence(
    operatorUid: string,
    classId: string,
    canonicalInstructor: string
  ) {
    const target =
      targetByClass(
        classId,
        canonicalInstructor
      );

    const adminPromise =
      this.db.doc(
        `adminAssignments/${operatorUid}/classes/${classId}`
      ).get();

    const principalPromise =
      target
        ? this.db.doc(
            `teacherAssignments/${target.principalUid}/classes/${classId}`
          ).get()
        : Promise.resolve(null);

    const [
      admin,
      principal
    ] = await Promise.all([
      adminPromise,
      principalPromise
    ]);

    const adminReady =
      admin.exists &&
      admin.data()?.active !==
        false &&
      admin.data()?.readAllowed !==
        false;

    const principalReady =
      !!(
        principal &&
        principal.exists &&
        principal.data()?.active !==
          false &&
        principal.data()?.readAllowed !==
          false
      );

    return {
      admin:
        adminReady,
      teacher:
        principalReady,
      principal: target
        ? {
            uid:
              target.principalUid,
            name:
              target.principalName,
            accountRole:
              target.principalRole,
            source:
              "server_fixed_batch_target"
          }
        : {
            uid: "",
            name:
              normalizedInstructor(
                canonicalInstructor
              ),
            accountRole:
              "unknown" as const,
            source: ""
          }
    };
  }

  async detailedAssignmentPresence(
    operatorUid: string,
    principalUid: string,
    classId: string
  ): Promise<
    AttendancePhase3b3AssignmentPresence
  > {
    const [
      admin,
      principal
    ] = await Promise.all([
      this.db.doc(
        `adminAssignments/${operatorUid}/classes/${classId}`
      ).get(),
      this.db.doc(
        `teacherAssignments/${principalUid}/classes/${classId}`
      ).get()
    ]);

    return {
      admin:
        admin.exists &&
        admin.data()?.active !==
          false &&
        admin.data()?.readAllowed !==
          false,
      principal:
        principal.exists &&
        principal.data()?.active !==
          false &&
        principal.data()?.readAllowed !==
          false
    };
  }
}

export class FirestoreAttendancePhase3b3GenericBatchApprovalStore
implements AttendancePhase3b3GenericBatchApprovalStore {
  constructor(
    private readonly db: Firestore
  ) {}

  async create(
    approval:
      AttendancePhase3b3GenericBatchApproval
  ): Promise<void> {
    await this.db
      .collection(
        "phase3bRolloutApprovals"
      )
      .doc(
        approval.approvalId
      )
      .create(approval);
  }

  async get(
    approvalId: string
  ) {
    const snapshot =
      await this.db
        .collection(
          "phase3bRolloutApprovals"
        )
        .doc(approvalId)
        .get();

    return snapshot.exists
      ? snapshot.data() as
          AttendancePhase3b3GenericBatchApproval
      : undefined;
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
    const ref =
      this.db
        .collection(
          "phase3bRolloutApprovals"
        )
        .doc(approvalId);

    return this.db.runTransaction(
      async (transaction) => {
        const snapshot =
          await transaction.get(
            ref
          );

        if (!snapshot.exists) {
          throw new Error(
            "approval not found"
          );
        }

        const approval =
          snapshot.data() as
            AttendancePhase3b3GenericBatchApproval;

        if (
          approval.status !==
          "armed"
        ) {
          throw new Error(
            `approval is ${approval.status}`
          );
        }

        if (
          approval.operatorUid !==
            checks.operatorUid ||
          approval.planDigest !==
            checks.planDigest ||
          approval.tokenHash !==
            checks.tokenHash
        ) {
          throw new Error(
            "approval claim mismatch"
          );
        }

        if (
          Date.parse(
            approval.expiresAt
          ) <=
          checks.now.getTime()
        ) {
          throw new Error(
            "approval expired"
          );
        }

        const next = {
          ...approval,
          status:
            "committing" as const,
          commitRequestId:
            checks.commitRequestId
        };

        transaction.set(
          ref,
          next
        );

        return next;
      }
    );
  }

  async complete(
    approvalId: string,
    completedAt: Date
  ): Promise<void> {
    await this.db
      .collection(
        "phase3bRolloutApprovals"
      )
      .doc(approvalId)
      .set(
        {
          status: "consumed",
          consumedAt:
            completedAt.toISOString()
        },
        { merge: true }
      );
  }

  async fail(
    approvalId: string,
    error: string,
    failedAt: Date
  ): Promise<void> {
    await this.db
      .collection(
        "phase3bRolloutApprovals"
      )
      .doc(approvalId)
      .set(
        {
          status: "failed",
          failedAt:
            failedAt.toISOString(),
          lastError: error
        },
        { merge: true }
      );
  }
}

export class FirestoreAttendancePhase3b3GenericBatchAssignmentWriter
implements AttendancePhase3b3GenericBatchAssignmentWriter {
  constructor(
    private readonly db: Firestore
  ) {}

  async ensureAssignments(
    operatorUid: string,
    principalUid: string,
    principalRole:
      AttendancePhase3b3PrincipalRole,
    classId: string,
    className: string,
    instructor: string,
    rolloutId: string,
    now: Date
  ) {
    const adminRef =
      this.db.doc(
        `adminAssignments/${operatorUid}/classes/${classId}`
      );

    const principalRef =
      this.db.doc(
        `teacherAssignments/${principalUid}/classes/${classId}`
      );

    const [
      admin,
      principal
    ] = await Promise.all([
      adminRef.get(),
      principalRef.get()
    ]);

    const adminReady =
      admin.exists &&
      admin.data()?.active !== false &&
      admin.data()?.readAllowed !== false;

    const principalReady =
      principal.exists &&
      principal.data()?.active !== false &&
      principal.data()?.readAllowed !== false;

    const batch =
      this.db.batch();

    let adminWritten = 0;
    let principalWritten = 0;

    if (!adminReady) {
      batch.set(
        adminRef,
        {
          active: true,
          readAllowed: true,
          adminUid:
            operatorUid,
          classId,
          className,
          instructor,
          rolloutId,
          source:
            "phase3b3_generic_small_batch",
          updatedAt:
            now.toISOString(),
          createdAt:
            admin.exists
              ? admin.data()
                  ?.createdAt ||
                now.toISOString()
              : now.toISOString()
        },
        { merge: true }
      );

      adminWritten = 1;
    }

    if (!principalReady) {
      batch.set(
        principalRef,
        {
          active: true,
          readAllowed: true,
          teacherUid:
            principalUid,
          principalUid,
          principalRole,
          classId,
          className,
          instructor,
          rolloutId,
          source:
            "phase3b3_generic_small_batch",
          updatedAt:
            now.toISOString(),
          createdAt:
            principal.exists
              ? principal.data()
                  ?.createdAt ||
                now.toISOString()
              : now.toISOString()
        },
        { merge: true }
      );

      principalWritten = 1;
    }

    if (
      adminWritten ||
      principalWritten
    ) {
      await batch.commit();
    }

    return {
      adminWritten,
      principalWritten
    };
  }
}

export class FirestoreAttendancePhase3b3GenericBatchAuditWriter
implements AttendancePhase3b3GenericBatchAuditWriter {
  constructor(
    private readonly db: Firestore
  ) {}

  async writeAudit(
    requestId: string,
    payload:
      Record<string, unknown>
  ): Promise<void> {
    await this.db
      .collection(
        "phase3bRolloutAudits"
      )
      .doc(requestId)
      .set(payload);
  }
}

export const syncAttendancePhase3b3GenericSmallBatchCallable =
  onCall(
    {
      region:
        ULIM_FUNCTION_REGION,
      cors: true,
      timeoutSeconds: 180,
      memory: "512MiB",
      maxInstances: 1
    },
    async (
      request:
        CallableRequest<unknown>
    ) => {
      const app =
        getOrInitializeDefaultFirebaseAdminApp();

      const db =
        getFirestore(app);

      return handleAttendancePhase3b3GenericSmallBatch(
        request.data,
        request.auth
          ? {
              uid:
                request.auth.uid,
              role:
                text(
                  request.auth
                    .token?.role
                )
            }
          : undefined,
        {
          repository:
            new FirestoreAttendancePhase3b3GenericBatchRepository(
              db
            ),
          approvalStore:
            new FirestoreAttendancePhase3b3GenericBatchApprovalStore(
              db
            ),
          assignmentWriter:
            new FirestoreAttendancePhase3b3GenericBatchAssignmentWriter(
              db
            ),
          auditWriter:
            new FirestoreAttendancePhase3b3GenericBatchAuditWriter(
              db
            ),
          idempotencyStore:
            new FirestoreIdempotencyStore(
              db
            )
        }
      );
    }
  );

export {
  ATTENDANCE_PHASE3B3_GENERIC_BATCH_CONFIRMATION
};
