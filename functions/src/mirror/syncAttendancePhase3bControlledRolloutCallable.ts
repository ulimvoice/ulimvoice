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
  type IdempotencyStore,
  type SyncOperation
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
  ATTENDANCE_PHASE3B2_CONTROLLED_VERSION,
  ATTENDANCE_PHASE3B2_TARGET,
  attendancePhase3b2ApprovalTokenHash,
  buildAttendancePhase3b2ControlledPlan,
  publicAttendancePhase3b2Plan,
  type AttendancePhase3b2ControlledPlan,
  type AttendancePhase3b2ControlledRepository,
  type AttendancePhase3b2TeacherCandidate
} from "./attendancePhase3bControlledRollout.js";

export type AttendancePhase3b2Mode =
  | "dry_run"
  | "arm"
  | "commit"
  | "verify";

export interface AttendancePhase3b2Input {
  readonly requestId: string;
  readonly mode: AttendancePhase3b2Mode;
  readonly records: readonly LegacyAttendanceRecord[];
  readonly expectedPlanDigest?: string;
  readonly approvalId?: string;
  readonly approvalToken?: string;
}

export interface AttendancePhase3b2Auth {
  readonly uid: string;
  readonly role: string;
}

export interface AttendancePhase3b2Approval {
  readonly approvalId: string;
  readonly version: string;
  readonly rolloutId: string;
  readonly operatorUid: string;
  readonly planDigest: string;
  readonly sourceDigest: string;
  readonly canonicalClassId: string;
  readonly teacherUid: string;
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

export interface AttendancePhase3b2ApprovalStore {
  create(
    approval: AttendancePhase3b2Approval
  ): Promise<void>;

  get(
    approvalId: string
  ): Promise<
    AttendancePhase3b2Approval |
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
  ): Promise<AttendancePhase3b2Approval>;

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

export interface AttendancePhase3b2AssignmentWriter {
  ensureAssignments(
    operatorUid: string,
    teacherUid: string,
    classId: string,
    className: string,
    instructor: string,
    rolloutId: string,
    now: Date
  ): Promise<{
    readonly adminWritten: number;
    readonly teacherWritten: number;
  }>;
}

export interface AttendancePhase3b2AuditWriter {
  writeAudit(
    requestId: string,
    payload: Record<string, unknown>
  ): Promise<void>;
}

export interface AttendancePhase3b2Deps {
  readonly repository:
    AttendancePhase3b2ControlledRepository &
    AttendanceMirrorRepository;
  readonly approvalStore:
    AttendancePhase3b2ApprovalStore;
  readonly assignmentWriter:
    AttendancePhase3b2AssignmentWriter;
  readonly auditWriter:
    AttendancePhase3b2AuditWriter;
  readonly idempotencyStore:
    IdempotencyStore;
  readonly now?: () => number;
  readonly tokenFactory?: () => string;
}

export interface AttendancePhase3b2Result {
  readonly ok: true;
  readonly version: string;
  readonly rolloutId: string;
  readonly mode: AttendancePhase3b2Mode;
  readonly requestId: string;
  readonly duplicate: boolean;
  readonly writeOperations: number;
  readonly plan:
    ReturnType<
      typeof publicAttendancePhase3b2Plan
    >;
  readonly approval: null | {
    readonly approvalId: string;
    readonly approvalToken?: string;
    readonly expiresAt: string;
    readonly planDigest: string;
  };
  readonly commit:
    AttendanceMirrorCommitResult | null;
  readonly assignmentWrites: {
    readonly adminWritten: number;
    readonly teacherWritten: number;
  };
  readonly verificationSafe:
    boolean | null;
}

const REQUEST_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

const APPROVAL_ID_PATTERN =
  /^phase3b2_[a-f0-9]{32}$/;

const MAX_RECORDS = 10;
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
    date: text(record.date),
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
): AttendancePhase3b2Input {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Phase 3B-2 input must be an object"
    );
  }

  const input =
    data as Record<string, unknown>;

  const allowed = new Set([
    "requestId",
    "mode",
    "records",
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
        `unexpected Phase 3B-2 field: ${key}`
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
      AttendancePhase3b2Mode;

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
    !Array.isArray(input.records) ||
    input.records.length < 1 ||
    input.records.length >
      MAX_RECORDS
  ) {
    throw new HttpsError(
      "invalid-argument",
      `records must contain 1-${MAX_RECORDS} rows`
    );
  }

  const expectedPlanDigest =
    text(input.expectedPlanDigest);
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
    records:
      input.records.map(
        sanitizeRecord
      ),
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
    AttendancePhase3b2Auth |
    undefined
): void {
  if (!auth?.uid) {
    throw new HttpsError(
      "unauthenticated",
      "Firebase authentication is required"
    );
  }

  if (auth.role !== "superAdmin") {
    throw new HttpsError(
      "permission-denied",
      "Phase 3B-2 controlled rollout requires superAdmin"
    );
  }
}

function approvalId(): string {
  return (
    "phase3b2_" +
    randomBytes(16).toString("hex")
  );
}

function token(): string {
  return randomBytes(32)
    .toString("hex");
}

function operationName(): string {
  return [
    "attendance_phase3b2_controlled",
    ATTENDANCE_PHASE3B2_TARGET
      .rolloutId,
    ATTENDANCE_PHASE3B2_TARGET.date,
    ATTENDANCE_PHASE3B2_TARGET
      .classId,
    "commit"
  ].join(":");
}

function approvalValid(
  approval:
    AttendancePhase3b2Approval |
    undefined,
  auth: AttendancePhase3b2Auth,
  input: AttendancePhase3b2Input,
  plan:
    AttendancePhase3b2ControlledPlan,
  now: Date
): void {
  if (!approval) {
    throw new HttpsError(
      "failed-precondition",
      "Phase 3B-2 approval was not found"
    );
  }

  if (
    approval.status !== "armed"
  ) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 3B-2 approval is ${approval.status}`
    );
  }

  if (
    approval.operatorUid !==
    auth.uid
  ) {
    throw new HttpsError(
      "permission-denied",
      "Phase 3B-2 approval belongs to another operator"
    );
  }

  if (
    approval.planDigest !==
    plan.planDigest
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Phase 3B-2 source changed after approval"
    );
  }

  if (
    approval.tokenHash !==
    attendancePhase3b2ApprovalTokenHash(
      input.approvalToken || ""
    )
  ) {
    throw new HttpsError(
      "permission-denied",
      "Phase 3B-2 approval token is invalid"
    );
  }

  if (
    Date.parse(
      approval.expiresAt
    ) <= now.getTime()
  ) {
    throw new HttpsError(
      "deadline-exceeded",
      "Phase 3B-2 approval expired"
    );
  }
}

function verificationSafe(
  plan:
    AttendancePhase3b2ControlledPlan
): boolean {
  return !!(
    plan.status === "ready_match" &&
    plan.reconciliation
      .upsertCount === 0 &&
    plan.reconciliation
      .staleCount === 0 &&
    plan.assignmentPresence.admin &&
    plan.assignmentPresence.teacher &&
    plan.errors.length === 0
  );
}

function duplicateResult(
  input: AttendancePhase3b2Input,
  plan:
    AttendancePhase3b2ControlledPlan
): AttendancePhase3b2Result {
  return {
    ok: true,
    version:
      ATTENDANCE_PHASE3B2_CONTROLLED_VERSION,
    rolloutId:
      ATTENDANCE_PHASE3B2_TARGET
        .rolloutId,
    mode: input.mode,
    requestId:
      input.requestId,
    duplicate: true,
    writeOperations: 0,
    plan:
      publicAttendancePhase3b2Plan(
        plan
      ),
    approval: null,
    commit: null,
    assignmentWrites: {
      adminWritten: 0,
      teacherWritten: 0
    },
    verificationSafe:
      verificationSafe(plan)
  };
}

export async function handleAttendancePhase3b2ControlledRollout(
  data: unknown,
  auth:
    AttendancePhase3b2Auth |
    undefined,
  deps: AttendancePhase3b2Deps
): Promise<AttendancePhase3b2Result> {
  requireSuperAdmin(auth);
  const input = parseInput(data);
  const now =
    new Date(
      deps.now?.() ??
      Date.now()
    );

  const plan =
    await buildAttendancePhase3b2ControlledPlan(
      input.records,
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
        ATTENDANCE_PHASE3B2_CONTROLLED_VERSION,
      rolloutId:
        ATTENDANCE_PHASE3B2_TARGET
          .rolloutId,
      mode: input.mode,
      requestId:
        input.requestId,
      duplicate: false,
      writeOperations: 0,
      plan:
        publicAttendancePhase3b2Plan(
          plan
        ),
      approval: null,
      commit: null,
      assignmentWrites: {
        adminWritten: 0,
        teacherWritten: 0
      },
      verificationSafe:
        input.mode === "verify"
          ? verificationSafe(plan)
          : null
    };
  }

  if (!plan.safeToArm) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 3B-2 plan is unsafe: ${
        plan.errors.join("; ")
      }`
    );
  }

  if (input.mode === "arm") {
    if (
      input.expectedPlanDigest !==
      plan.planDigest
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Dry Run digest no longer matches the current source"
      );
    }

    const approvalToken =
      deps.tokenFactory?.() ||
      token();
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
        ATTENDANCE_PHASE3B2_CONTROLLED_VERSION,
      rolloutId:
        ATTENDANCE_PHASE3B2_TARGET
          .rolloutId,
      operatorUid:
        auth!.uid,
      planDigest:
        plan.planDigest,
      sourceDigest:
        plan.sourceDigest,
      canonicalClassId:
        plan.canonicalClassId,
      teacherUid:
        plan.teacherUid,
      tokenHash:
        attendancePhase3b2ApprovalTokenHash(
          approvalToken
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
        ATTENDANCE_PHASE3B2_CONTROLLED_VERSION,
      rolloutId:
        ATTENDANCE_PHASE3B2_TARGET
          .rolloutId,
      mode: input.mode,
      requestId:
        input.requestId,
      duplicate: false,
      writeOperations: 1,
      plan:
        publicAttendancePhase3b2Plan(
          plan
        ),
      approval: {
        approvalId:
          newApprovalId,
        approvalToken,
        expiresAt:
          expiresAt.toISOString(),
        planDigest:
          plan.planDigest
      },
      commit: null,
      assignmentWrites: {
        adminWritten: 0,
        teacherWritten: 0
      },
      verificationSafe: null
    };
  }

  const operation =
    operationName();

  /*
   * 완료된 같은 requestId의 재전송은 승인 토큰이 이미 소비됐어도
   * 부작용 없이 duplicate 결과를 반환해야 한다.
   */
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
        await buildAttendancePhase3b2ControlledPlan(
          input.records,
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
        await buildAttendancePhase3b2ControlledPlan(
          input.records,
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
          plan.planDigest,
        tokenHash:
          attendancePhase3b2ApprovalTokenHash(
            input.approvalToken || ""
          ),
        commitRequestId:
          input.requestId,
        now
      }
    );

    claimed = true;

    const commit =
      await deps.repository.commit(
        plan.mirrorPlan
      );

    const assignmentWrites =
      await deps.assignmentWriter
        .ensureAssignments(
          auth!.uid,
          plan.teacherUid,
          plan.canonicalClassId,
          plan.canonicalClassName,
          plan.canonicalInstructor,
          plan.rolloutId,
          now
        );

    const after =
      await buildAttendancePhase3b2ControlledPlan(
        input.records,
        auth!.uid,
        deps.repository,
        now
      );

    const safe =
      verificationSafe(after);

    if (!safe) {
      throw new Error(
        "Phase 3B-2 post-write verification failed"
      );
    }

    await deps.auditWriter.writeAudit(
      input.requestId,
      {
        version:
          ATTENDANCE_PHASE3B2_CONTROLLED_VERSION,
        rolloutId:
          plan.rolloutId,
        requestId:
          input.requestId,
        operatorUid:
          auth!.uid,
        date:
          plan.date,
        classId:
          plan.canonicalClassId,
        className:
          plan.canonicalClassName,
        instructor:
          plan.canonicalInstructor,
        teacherUid:
          plan.teacherUid,
        sourceDigest:
          plan.sourceDigest,
        planDigest:
          plan.planDigest,
        sourceCount:
          plan.sourceCount,
        attendanceWritten:
          commit.written,
        attendanceStaleMarked:
          commit.staleMarked,
        adminAssignmentWritten:
          assignmentWrites
            .adminWritten,
        teacherAssignmentWritten:
          assignmentWrites
            .teacherWritten,
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
          plan.planDigest,
        lastError:
          undefined
      }
    );

    return {
      ok: true,
      version:
        ATTENDANCE_PHASE3B2_CONTROLLED_VERSION,
      rolloutId:
        plan.rolloutId,
      mode: input.mode,
      requestId:
        input.requestId,
      duplicate: false,
      writeOperations:
        commit.written +
        commit.staleMarked +
        assignmentWrites
          .adminWritten +
        assignmentWrites
          .teacherWritten +
        1,
      plan:
        publicAttendancePhase3b2Plan(
          after
        ),
      approval: {
        approvalId:
          input.approvalId || "",
        expiresAt:
          approval!.expiresAt,
        planDigest:
          plan.planDigest
      },
      commit,
      assignmentWrites,
      verificationSafe:
        safe
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 500)
        : String(error).slice(0, 500);

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
          "[phase3b2] approval failure recording failed",
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
        "[phase3b2] idempotency failure recording failed",
        idempotencyError
      );
    }

    if (error instanceof HttpsError) {
      throw error;
    }

    console.error(
      "[phase3b2] controlled rollout failed",
      error
    );

    throw new HttpsError(
      "internal",
      "Phase 3B-2 controlled rollout failed"
    );
  }
}

function normalizedTeacherName(
  value: unknown
): string {
  return text(value)
    .replace(/\s+/gu, "")
    .replace(/(?:선생님|강사)$/u, "")
    .replace(/t$/iu, "")
    .toLowerCase();
}

export class FirestoreAttendancePhase3b2Repository
implements AttendancePhase3b2ControlledRepository,
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
    return this.mirror.commit(plan);
  }

  async assignmentPresence(
    uid: string,
    classId: string
  ) {
    const [admin, teacher] =
      await Promise.all([
        this.db.doc(
          `adminAssignments/${uid}/classes/${classId}`
        ).get(),
        this.db.doc(
          `teacherAssignments/${uid}/classes/${classId}`
        ).get()
      ]);

    return {
      admin:
        admin.exists &&
        admin.data()?.active !== false &&
        admin.data()?.readAllowed !== false,
      teacher:
        teacher.exists &&
        teacher.data()?.active !== false &&
        teacher.data()?.readAllowed !== false
    };
  }

  async detailedAssignmentPresence(
    operatorUid: string,
    teacherUid: string,
    classId: string
  ) {
    const [admin, teacher] =
      await Promise.all([
        this.db.doc(
          `adminAssignments/${operatorUid}/classes/${classId}`
        ).get(),
        this.db.doc(
          `teacherAssignments/${teacherUid}/classes/${classId}`
        ).get()
      ]);

    return {
      admin:
        admin.exists &&
        admin.data()?.active !== false &&
        admin.data()?.readAllowed !== false,
      teacher:
        teacher.exists &&
        teacher.data()?.active !== false &&
        teacher.data()?.readAllowed !== false
    };
  }

  async resolveTeacherCandidates(
    canonicalInstructor: string,
    recordTeacherUids:
      readonly string[]
  ): Promise<
    AttendancePhase3b2TeacherCandidate[]
  > {
    const byUid = new Map<
      string,
      AttendancePhase3b2TeacherCandidate
    >();

    for (
      const teacherUid of
      [...new Set(
        recordTeacherUids
          .map(text)
          .filter(Boolean)
      )]
    ) {
      const snapshot =
        await this.db.doc(
          `teachers/${teacherUid}`
        ).get();

      if (!snapshot.exists) {
        continue;
      }

      const data =
        snapshot.data() || {};

      const teacherName =
        text(
          data.teacherName ||
          data.name
        );

      if (
        data.active === false ||
        normalizedTeacherName(
          teacherName
        ) !==
        normalizedTeacherName(
          canonicalInstructor
        )
      ) {
        continue;
      }

      byUid.set(
        teacherUid,
        {
          teacherUid,
          teacherName,
          active: true,
          source:
            "record_teacher_uid"
        }
      );
    }

    const snapshot =
      await this.db
        .collection("teachers")
        .where("active", "==", true)
        .get();

    for (
      const document of
      snapshot.docs
    ) {
      const data =
        document.data() || {};

      const teacherUid =
        text(
          data.teacherUid ||
          document.id
        );

      const teacherName =
        text(
          data.teacherName ||
          data.name
        );

      if (
        !teacherUid ||
        normalizedTeacherName(
          teacherName
        ) !==
        normalizedTeacherName(
          canonicalInstructor
        )
      ) {
        continue;
      }

      byUid.set(
        teacherUid,
        {
          teacherUid,
          teacherName,
          active: true,
          source:
            "teachers_collection"
        }
      );
    }

    return [...byUid.values()];
  }
}

export class FirestoreAttendancePhase3b2ApprovalStore
implements AttendancePhase3b2ApprovalStore {
  constructor(
    private readonly db: Firestore
  ) {}

  async create(
    approval: AttendancePhase3b2Approval
  ): Promise<void> {
    await this.db
      .collection(
        "phase3bRolloutApprovals"
      )
      .doc(approval.approvalId)
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
          AttendancePhase3b2Approval
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
          await transaction.get(ref);

        if (!snapshot.exists) {
          throw new Error(
            "approval not found"
          );
        }

        const approval =
          snapshot.data() as
            AttendancePhase3b2Approval;

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
          ) <= checks.now.getTime()
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

export class FirestoreAttendancePhase3b2AssignmentWriter
implements AttendancePhase3b2AssignmentWriter {
  constructor(
    private readonly db: Firestore
  ) {}

  async ensureAssignments(
    operatorUid: string,
    teacherUid: string,
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

    const teacherRef =
      this.db.doc(
        `teacherAssignments/${teacherUid}/classes/${classId}`
      );

    const [admin, teacher] =
      await Promise.all([
        adminRef.get(),
        teacherRef.get()
      ]);

    const adminReady =
      admin.exists &&
      admin.data()?.active !== false &&
      admin.data()?.readAllowed !== false;

    const teacherReady =
      teacher.exists &&
      teacher.data()?.active !== false &&
      teacher.data()?.readAllowed !== false;

    const batch =
      this.db.batch();

    let adminWritten = 0;
    let teacherWritten = 0;

    if (!adminReady) {
      batch.set(
        adminRef,
        {
          active: true,
          readAllowed: true,
          adminUid: operatorUid,
          classId,
          className,
          instructor,
          rolloutId,
          source:
            "phase3b_controlled_rollout",
          updatedAt:
            now.toISOString(),
          createdAt:
            admin.exists
              ? admin.data()?.createdAt ||
                now.toISOString()
              : now.toISOString()
        },
        { merge: true }
      );

      adminWritten = 1;
    }

    if (!teacherReady) {
      batch.set(
        teacherRef,
        {
          active: true,
          readAllowed: true,
          teacherUid,
          classId,
          className,
          instructor,
          rolloutId,
          source:
            "phase3b_controlled_rollout",
          updatedAt:
            now.toISOString(),
          createdAt:
            teacher.exists
              ? teacher.data()?.createdAt ||
                now.toISOString()
              : now.toISOString()
        },
        { merge: true }
      );

      teacherWritten = 1;
    }

    if (
      adminWritten ||
      teacherWritten
    ) {
      await batch.commit();
    }

    return {
      adminWritten,
      teacherWritten
    };
  }
}

export class FirestoreAttendancePhase3b2AuditWriter
implements AttendancePhase3b2AuditWriter {
  constructor(
    private readonly db: Firestore
  ) {}

  async writeAudit(
    requestId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.db
      .collection(
        "phase3bRolloutAudits"
      )
      .doc(requestId)
      .set(payload);
  }
}

export const syncAttendancePhase3bControlledRolloutCallable =
  onCall(
    {
      region:
        ULIM_FUNCTION_REGION,
      cors: true,
      timeoutSeconds: 120,
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

      return handleAttendancePhase3b2ControlledRollout(
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
            new FirestoreAttendancePhase3b2Repository(
              db
            ),
          approvalStore:
            new FirestoreAttendancePhase3b2ApprovalStore(
              db
            ),
          assignmentWriter:
            new FirestoreAttendancePhase3b2AssignmentWriter(
              db
            ),
          auditWriter:
            new FirestoreAttendancePhase3b2AuditWriter(
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
