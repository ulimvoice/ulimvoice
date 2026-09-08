import {
  createHash
} from "node:crypto";
import type {
  LegacyAttendanceRecord
} from "./attendanceMirror.js";
import {
  buildStableClassId
} from "./attendanceMirror.js";
import {
  buildAttendanceMirrorPlan,
  sha256Canonical,
  type AttendanceMirrorPlan
} from "./attendanceMirrorPlan.js";
import {
  auditAttendancePhase3bScope,
  type AttendancePhase3bPreflightRepository
} from "./attendancePhase3bPreflight.js";

export const ATTENDANCE_PHASE3B3_GENERIC_BATCH_VERSION =
  "20260716.6-phase3b3-generic-small-batch-3classes-20-fixed-principals";

export const ATTENDANCE_PHASE3B3_GENERIC_BATCH_ROLLOUT_ID =
  "phase3b3-generic-small-batch-3classes-20-2026-07-18";

export const ATTENDANCE_PHASE3B3_GENERIC_BATCH_CONFIRMATION =
  "안전반 3개 20건 범용 동기화";

export type AttendancePhase3b3PrincipalRole =
  | "teacher"
  | "superAdmin";

export interface AttendancePhase3b3BatchTarget {
  readonly scopeId: string;
  readonly date: "2026-07-18";
  readonly className: string;
  readonly instructor: string;
  readonly classId: string;
  readonly principalUid: string;
  readonly principalName: string;
  readonly principalRole:
    AttendancePhase3b3PrincipalRole;
  readonly expectedSourceCount: number;
  readonly expectedSourceKeys:
    readonly string[];
}

export const ATTENDANCE_PHASE3B3_GENERIC_BATCH_TARGETS =
  Object.freeze([
    Object.freeze({
      scopeId:
        "kim-haeun-elementary-dubbing",
      date: "2026-07-18",
      className:
        "[김하은T] - 토요일 초등 더빙반 10:30 ~ 12:00",
      instructor: "김하은T",
      classId:
        "legacy_d8549fc39eb0865a5e703abb",
      principalUid:
        "ADM-20260610-0213CFC6",
      principalName: "김하은",
      principalRole:
        "teacher" as const,
      expectedSourceCount: 7,
      expectedSourceKeys: [
        "김하은T|V7",
        "김하은T|V8",
        "김하은T|V9",
        "김하은T|V10",
        "김하은T|V11",
        "김하은T|V12",
        "김하은T|V13"
      ]
    }),
    Object.freeze({
      scopeId:
        "lee-yongwoo-youth-intermediate-a",
      date: "2026-07-18",
      className:
        "[이용우T] - 토요일 청소년 중급A 15:00 ~ 17:00",
      instructor: "이용우T",
      classId:
        "legacy_894929dd08ff2ee580164a6a",
      principalUid:
        "ADM-20260604-90A754C4",
      principalName: "이용우",
      principalRole:
        "superAdmin" as const,
      expectedSourceCount: 6,
      expectedSourceKeys: [
        "이용우T|V78",
        "이용우T|V79",
        "이용우T|V80",
        "이용우T|V81",
        "이용우T|V82",
        "이용우T|V83"
      ]
    }),
    Object.freeze({
      scopeId:
        "lee-yongwoo-youth-beginner-b",
      date: "2026-07-18",
      className:
        "[이용우T] - 토요일 청소년 초급B 10:00 ~ 12:00",
      instructor: "이용우T",
      classId:
        "legacy_9f590f0a28e207544a278fda",
      principalUid:
        "ADM-20260604-90A754C4",
      principalName: "이용우",
      principalRole:
        "superAdmin" as const,
      expectedSourceCount: 7,
      expectedSourceKeys: [
        "이용우T|V49",
        "이용우T|V50",
        "이용우T|V51",
        "이용우T|V52",
        "이용우T|V53",
        "이용우T|V54",
        "이용우T|V55"
      ]
    })
  ] satisfies readonly AttendancePhase3b3BatchTarget[]);

export interface AttendancePhase3b3BatchInputScope {
  readonly scopeId: string;
  readonly requestedClassName: string;
  readonly requestedTeacher: string;
  readonly records:
    readonly LegacyAttendanceRecord[];
}

export interface AttendancePhase3b3AssignmentPresence {
  readonly admin: boolean;
  readonly principal: boolean;
}

export interface AttendancePhase3b3BatchRepository
extends AttendancePhase3bPreflightRepository {
  detailedAssignmentPresence(
    operatorUid: string,
    principalUid: string,
    classId: string
  ): Promise<AttendancePhase3b3AssignmentPresence>;
}

export interface AttendancePhase3b3ScopePlan {
  readonly scopeId: string;
  readonly date: string;
  readonly requestedClassName: string;
  readonly canonicalClassName: string;
  readonly canonicalInstructor: string;
  readonly canonicalClassId: string;
  readonly principalUid: string;
  readonly principalName: string;
  readonly principalRole:
    AttendancePhase3b3PrincipalRole;
  readonly sourceCount: number;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly sourceDigest: string;
  readonly scopePlanDigest: string;
  readonly status:
    | "ready_initial_sync"
    | "ready_match"
    | "blocked";
  readonly safe: boolean;
  readonly reconciliation:
    AttendanceMirrorPlan["reconciliation"];
  readonly assignmentPresence:
    AttendancePhase3b3AssignmentPresence;
  readonly plannedWrites: {
    readonly attendanceUpserts: number;
    readonly attendanceStaleMarks: number;
    readonly adminAssignment: number;
    readonly principalAssignment: number;
  };
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly mirrorPlan: AttendanceMirrorPlan;
  readonly authoritativeRecords:
    readonly LegacyAttendanceRecord[];
}

export interface AttendancePhase3b3PublicScopePlan
extends Omit<
  AttendancePhase3b3ScopePlan,
  "mirrorPlan" | "authoritativeRecords"
> {}

export interface AttendancePhase3b3BatchPlan {
  readonly version: string;
  readonly rolloutId: string;
  readonly mode: "controlled_batch_plan";
  readonly date: "2026-07-18";
  readonly targetCount: 3;
  readonly expectedAttendanceCount: 20;
  readonly sourceCount: number;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly batchSourceDigest: string;
  readonly batchPlanDigest: string;
  readonly safeToArm: boolean;
  readonly status:
    | "ready_initial_sync"
    | "ready_match"
    | "blocked";
  readonly scopes:
    readonly AttendancePhase3b3ScopePlan[];
  readonly totals: {
    readonly existingActiveCount: number;
    readonly upsertCount: number;
    readonly unchangedCount: number;
    readonly staleCount: number;
    readonly missingIdCount: number;
    readonly mismatchedIdCount: number;
    readonly extraActiveIdCount: number;
    readonly adminAssignments: number;
    readonly principalAssignments: number;
  };
  readonly plannedWrites: {
    readonly attendanceUpserts: number;
    readonly attendanceStaleMarks: number;
    readonly adminAssignments: number;
    readonly principalAssignments: number;
    readonly approval: number;
    readonly audit: number;
  };
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface AttendancePhase3b3PublicBatchPlan
extends Omit<
  AttendancePhase3b3BatchPlan,
  "scopes"
> {
  readonly scopes:
    readonly AttendancePhase3b3PublicScopePlan[];
}

function text(value: unknown): string {
  return String(value ?? "")
    .trim()
    .normalize("NFC");
}

function compact(value: unknown): string {
  return text(value)
    .replace(/\s+/gu, "")
    .toLowerCase();
}

function normalizedInstructor(
  value: unknown
): string {
  return compact(value)
    .replace(/(?:선생님|강사)$/u, "")
    .replace(/t$/u, "");
}

function normalizedSourceKey(
  value: unknown
): string {
  return text(value)
    .replace(/[!｜¦]/gu, "|")
    .replace(/\s+/gu, "")
    .toLowerCase();
}

function unsafeIdentityKey(
  value: unknown
): boolean {
  const compactValue = text(value)
    .replace(
      /[^0-9a-zA-Z가-힣|:_-]/gu,
      ""
    );

  if (!compactValue) return true;

  if (
    /^\d{4}$/u.test(compactValue) ||
    /^\d{10,11}$/u.test(compactValue)
  ) {
    return true;
  }

  if (
    /^(?!uid(?:entity)?[|:_-]|stu(?:dent)?[|:_-])[a-zA-Z가-힣]{2,30}[|:_-]\d{4}$/iu.test(
      compactValue
    )
  ) {
    return true;
  }

  return /(?:phone|mobile|tel|전화|휴대폰)/iu
    .test(compactValue);
}

function canonicalIdentityKey(
  record: LegacyAttendanceRecord
): string {
  const studentUid = text(record.studentUid);
  const current = text(
    record.studentIdentityKey
  );

  if (!studentUid) {
    return current;
  }

  if (
    !current ||
    unsafeIdentityKey(current)
  ) {
    return `uid:${studentUid}`;
  }

  return current;
}

function authoritativeRecord(
  target: AttendancePhase3b3BatchTarget,
  record: LegacyAttendanceRecord
): LegacyAttendanceRecord {
  const status = text(
    record.status ||
    record.attendanceStatus
  );

  return {
    date: target.date,
    sessionDate: target.date,
    classId: undefined,
    sessionId: undefined,
    studentName:
      text(record.studentName),
    studentNo:
      text(record.studentNo),
    studentUid:
      text(record.studentUid),
    studentIdentityKey:
      canonicalIdentityKey(record),
    studentRowNumber:
      Number.isInteger(
        record.studentRowNumber
      )
        ? record.studentRowNumber
        : undefined,
    instructor:
      target.instructor,
    teacherUid: undefined,
    teacherName:
      target.instructor,
    className:
      target.className,
    classroom:
      text(record.classroom),
    startTime:
      text(record.startTime),
    endTime:
      text(record.endTime),
    status,
    attendanceStatus: status,
    specialStatus:
      text(record.specialStatus),
    enrollmentStatus:
      text(record.enrollmentStatus),
    studentStatus:
      text(record.studentStatus),
    memo:
      text(
        record.memo ||
        record.note
      ),
    sourceSheet:
      text(record.sourceSheet),
    sourceRow:
      Number.isInteger(
        record.sourceRow
      )
        ? record.sourceRow
        : undefined,
    sourceCol:
      Number.isInteger(
        record.sourceCol
      )
        ? record.sourceCol
        : undefined,
    sourceCell:
      text(record.sourceCell),
    sourceKey:
      text(
        record.sourceKey ||
        record.sourceCell
      )
  };
}

function uniqueStrings(
  values: readonly string[]
): string[] {
  return [...new Set(
    values
      .map(text)
      .filter(Boolean)
  )];
}

function targetByScopeId(
  scopeId: string
): AttendancePhase3b3BatchTarget |
undefined {
  return ATTENDANCE_PHASE3B3_GENERIC_BATCH_TARGETS
    .find(
      (target) =>
        target.scopeId === scopeId
    );
}

function publicErrors(
  values: readonly string[]
): string[] {
  return uniqueStrings(values);
}

export function attendancePhase3b3GenericBatchApprovalTokenHash(
  token: string
): string {
  return createHash("sha256")
    .update(text(token), "utf8")
    .digest("hex");
}

export function publicAttendancePhase3b3GenericBatchPlan(
  plan: AttendancePhase3b3BatchPlan
): AttendancePhase3b3PublicBatchPlan {
  const {
    scopes,
    ...batch
  } = plan;

  return {
    ...batch,
    scopes: scopes.map(
      (scope) => {
        const {
          mirrorPlan: _mirrorPlan,
          authoritativeRecords:
            _authoritativeRecords,
          ...publicScope
        } = scope;

        return publicScope;
      }
    )
  };
}

async function buildScopePlan(
  target: AttendancePhase3b3BatchTarget,
  input:
    AttendancePhase3b3BatchInputScope,
  operatorUid: string,
  repository:
    AttendancePhase3b3BatchRepository,
  now: Date
): Promise<AttendancePhase3b3ScopePlan> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceRecords = [
    ...input.records
  ];

  if (
    compact(
      input.requestedClassName
    ) !==
    compact(target.className)
  ) {
    errors.push(
      "requested className crossed the fixed batch target"
    );
  }

  if (
    normalizedInstructor(
      input.requestedTeacher
    ) !==
    normalizedInstructor(
      target.instructor
    )
  ) {
    errors.push(
      "requested teacher crossed the fixed batch target"
    );
  }

  if (
    sourceRecords.length !==
    target.expectedSourceCount
  ) {
    errors.push(
      `target requires exactly ${
        target.expectedSourceCount
      } source record(s); received ${
        sourceRecords.length
      }`
    );
  }

  const sourceKeys =
    sourceRecords.map(
      (record) =>
        normalizedSourceKey(
          record.sourceKey ||
          record.sourceCell
        )
    );

  const allowedSourceKeys =
    target.expectedSourceKeys
      .map(normalizedSourceKey)
      .sort();

  const actualSourceKeys =
    [...sourceKeys].sort();

  if (
    actualSourceKeys.length !==
      allowedSourceKeys.length ||
    actualSourceKeys.some(
      (value, index) =>
        value !==
        allowedSourceKeys[index]
    ) ||
    new Set(actualSourceKeys).size !==
      actualSourceKeys.length
  ) {
    errors.push(
      "record sourceKey set does not match the fixed batch allowlist"
    );
  }

  if (
    sourceRecords.some(
      (record) =>
        text(
          record.sessionDate ||
          record.date
        ) !== target.date
    )
  ) {
    errors.push(
      "record date crossed the fixed batch target"
    );
  }

  if (
    sourceRecords.some(
      (record) =>
        compact(record.className) !==
        compact(target.className)
    )
  ) {
    errors.push(
      "record className crossed the fixed batch target"
    );
  }

  if (
    sourceRecords.some(
      (record) =>
        normalizedInstructor(
          record.instructor ||
          record.teacherName
        ) !==
        normalizedInstructor(
          target.instructor
        )
    )
  ) {
    errors.push(
      "record instructor crossed the fixed batch target"
    );
  }

  const recordPrincipalUids =
    uniqueStrings(
      sourceRecords
        .map(
          (record) =>
            text(record.teacherUid)
        )
    );

  if (
    recordPrincipalUids.some(
      (uid) =>
        uid !==
        target.principalUid
    )
  ) {
    errors.push(
      "source record teacherUid conflicts with the server-fixed principalUid"
    );
  }

  /*
   * teacherUid는 Assignment Principal 식별값이지 classId 구성값이 아니다.
   * 고정 UID가 원본에 포함되어도 반 ID가 달라지지 않도록 audit 입력에서는
   * className·instructor를 서버 고정값으로 정규화하고 teacherUid를 제거한다.
   * 원본 혼입 여부는 위의 독립 검증에서 이미 차단한다.
   */
  const auditRecords =
    sourceRecords.map(
      (record) => ({
        ...record,
        classId: undefined,
        sessionId: undefined,
        className:
          target.className,
        instructor:
          target.instructor,
        teacherUid:
          undefined,
        teacherName:
          target.instructor
      })
    );

  const audit =
    await auditAttendancePhase3bScope(
      {
        date: target.date,
        requestedClassName:
          target.className,
        requestedTeacher:
          target.instructor,
        records:
          auditRecords
      },
      operatorUid,
      repository,
      now
    );

  if (
    !audit.safeForControlledRollout
  ) {
    errors.push(
      ...audit.errors,
      `preflight status is ${audit.status}`
    );
  }

  if (
    audit.canonicalClassId !==
    target.classId
  ) {
    errors.push(
      `server classId mismatch: ${
        audit.canonicalClassId ||
        "(empty)"
      }`
    );
  }

  if (
    compact(
      audit.canonicalClassName
    ) !==
    compact(target.className)
  ) {
    errors.push(
      "server canonical className mismatch"
    );
  }

  if (
    normalizedInstructor(
      audit.canonicalInstructor
    ) !==
    normalizedInstructor(
      target.instructor
    )
  ) {
    errors.push(
      "server canonical instructor mismatch"
    );
  }

  const auditPrincipal =
    audit.assignmentPresence
      .principal;

  if (
    !auditPrincipal ||
    auditPrincipal.uid !==
      target.principalUid ||
    auditPrincipal.accountRole !==
      target.principalRole
  ) {
    errors.push(
      "server instructor principal does not match the fixed batch target"
    );
  }

  const authoritativeRecords =
    sourceRecords.map(
      (record) =>
        authoritativeRecord(
          target,
          record
        )
    );

  const classIds =
    new Set(
      authoritativeRecords
        .map(buildStableClassId)
        .filter(
          (value):
            value is string =>
            !!value
        )
    );

  if (
    classIds.size !== 1 ||
    [...classIds][0] !==
      target.classId
  ) {
    errors.push(
      "authoritative records did not resolve to the fixed classId"
    );
  }

  const existing =
    await repository.loadScope({
      sessionDate:
        target.date,
      classId:
        target.classId
    });

  const mirrorPlan =
    buildAttendanceMirrorPlan(
      authoritativeRecords,
      existing,
      {
        sessionDate:
          target.date,
        classId:
          target.classId
      },
      {
        runId:
          `phase3b3_batch_${target.scopeId}_${now.getTime()}`,
        now,
        allowEmptySnapshot: false
      }
    );

  errors.push(
    ...mirrorPlan.errors.map(
      (error) =>
        `${error.code}: ${error.message}`
    )
  );

  if (
    mirrorPlan.sourceCount !==
      target.expectedSourceCount ||
    mirrorPlan.acceptedCount !==
      target.expectedSourceCount ||
    mirrorPlan.rejectedCount !== 0
  ) {
    errors.push(
      `mirror plan did not resolve to exactly ${
        target.expectedSourceCount
      } accepted records`
    );
  }

  if (
    mirrorPlan.staleIds.length !== 0
  ) {
    errors.push(
      "generic first batch refuses stale attendance documents"
    );
  }

  if (
    mirrorPlan.reconciliation
      .mismatchedIds.length !== 0
  ) {
    errors.push(
      "generic first batch refuses mismatched existing documents"
    );
  }

  if (
    mirrorPlan.upserts.length >
      target.expectedSourceCount
  ) {
    errors.push(
      "generic first batch exceeds the fixed attendance count"
    );
  }

  const assignmentPresence =
    await repository
      .detailedAssignmentPresence(
        operatorUid,
        target.principalUid,
        target.classId
      );

  if (
    audit.warnings.length > 0
  ) {
    warnings.push(
      ...audit.warnings
    );
  }

  const uniqueErrors =
    publicErrors(errors);
  const uniqueWarnings =
    publicErrors(warnings);

  let status:
    AttendancePhase3b3ScopePlan["status"];

  if (uniqueErrors.length > 0) {
    status = "blocked";
  } else if (
    mirrorPlan.reconciliation
      .upsertCount === 0 &&
    mirrorPlan.reconciliation
      .staleCount === 0
  ) {
    status = "ready_match";
  } else {
    status =
      "ready_initial_sync";
  }

  const scopePlanDigest =
    sha256Canonical({
      version:
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_VERSION,
      rolloutId:
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_ROLLOUT_ID,
      operatorUid,
      target,
      sourceDigest:
        mirrorPlan.sourceDigest,
      reconciliation:
        mirrorPlan.reconciliation,
      assignmentPresence
    });

  return {
    scopeId:
      target.scopeId,
    date:
      target.date,
    requestedClassName:
      target.className,
    canonicalClassName:
      audit.canonicalClassName ||
      target.className,
    canonicalInstructor:
      audit.canonicalInstructor ||
      target.instructor,
    canonicalClassId:
      audit.canonicalClassId ||
      target.classId,
    principalUid:
      target.principalUid,
    principalName:
      target.principalName,
    principalRole:
      target.principalRole,
    sourceCount:
      mirrorPlan.sourceCount,
    acceptedCount:
      mirrorPlan.acceptedCount,
    rejectedCount:
      mirrorPlan.rejectedCount,
    sourceDigest:
      mirrorPlan.sourceDigest,
    scopePlanDigest,
    status,
    safe:
      uniqueErrors.length === 0 &&
      (
        status ===
          "ready_initial_sync" ||
        status ===
          "ready_match"
      ),
    reconciliation:
      mirrorPlan.reconciliation,
    assignmentPresence,
    plannedWrites: {
      attendanceUpserts:
        mirrorPlan.upserts.length,
      attendanceStaleMarks:
        mirrorPlan.staleIds.length,
      adminAssignment:
        assignmentPresence.admin
          ? 0
          : 1,
      principalAssignment:
        assignmentPresence.principal
          ? 0
          : 1
    },
    errors:
      uniqueErrors,
    warnings:
      uniqueWarnings,
    mirrorPlan,
    authoritativeRecords
  };
}

export async function buildAttendancePhase3b3GenericBatchPlan(
  inputScopes:
    readonly AttendancePhase3b3BatchInputScope[],
  operatorUid: string,
  repository:
    AttendancePhase3b3BatchRepository,
  now = new Date()
): Promise<AttendancePhase3b3BatchPlan> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (
    inputScopes.length !==
    ATTENDANCE_PHASE3B3_GENERIC_BATCH_TARGETS
      .length
  ) {
    errors.push(
      `batch requires exactly ${
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_TARGETS.length
      } scope(s); received ${
        inputScopes.length
      }`
    );
  }

  const inputByScopeId =
    new Map<
      string,
      AttendancePhase3b3BatchInputScope
    >();

  for (const scope of inputScopes) {
    const scopeId =
      text(scope.scopeId);

    if (
      !targetByScopeId(scopeId)
    ) {
      errors.push(
        `unknown batch scopeId: ${
          scopeId || "(empty)"
        }`
      );
      continue;
    }

    if (
      inputByScopeId.has(scopeId)
    ) {
      errors.push(
        `duplicate batch scopeId: ${scopeId}`
      );
      continue;
    }

    inputByScopeId.set(
      scopeId,
      scope
    );
  }

  const scopePlans:
    AttendancePhase3b3ScopePlan[] =
    [];

  for (
    const target of
    ATTENDANCE_PHASE3B3_GENERIC_BATCH_TARGETS
  ) {
    const input =
      inputByScopeId.get(
        target.scopeId
      );

    if (!input) {
      errors.push(
        `missing batch scopeId: ${target.scopeId}`
      );
      continue;
    }

    const scopePlan =
      await buildScopePlan(
        target,
        input,
        operatorUid,
        repository,
        now
      );

    scopePlans.push(
      scopePlan
    );

    errors.push(
      ...scopePlan.errors.map(
        (error) =>
          `${target.scopeId}: ${error}`
      )
    );

    warnings.push(
      ...scopePlan.warnings.map(
        (warning) =>
          `${target.scopeId}: ${warning}`
      )
    );
  }

  const sourceCount =
    scopePlans.reduce(
      (total, scope) =>
        total +
        scope.sourceCount,
      0
    );

  const acceptedCount =
    scopePlans.reduce(
      (total, scope) =>
        total +
        scope.acceptedCount,
      0
    );

  const rejectedCount =
    scopePlans.reduce(
      (total, scope) =>
        total +
        scope.rejectedCount,
      0
    );

  if (
    sourceCount !== 20 ||
    acceptedCount !== 20 ||
    rejectedCount !== 0
  ) {
    errors.push(
      "batch did not resolve to exactly 20 accepted attendance records"
    );
  }

  const totals = {
    existingActiveCount:
      scopePlans.reduce(
        (total, scope) =>
          total +
          scope.reconciliation
            .existingActiveCount,
        0
      ),
    upsertCount:
      scopePlans.reduce(
        (total, scope) =>
          total +
          scope.reconciliation
            .upsertCount,
        0
      ),
    unchangedCount:
      scopePlans.reduce(
        (total, scope) =>
          total +
          scope.reconciliation
            .unchangedCount,
        0
      ),
    staleCount:
      scopePlans.reduce(
        (total, scope) =>
          total +
          scope.reconciliation
            .staleCount,
        0
      ),
    missingIdCount:
      scopePlans.reduce(
        (total, scope) =>
          total +
          scope.reconciliation
            .missingIds.length,
        0
      ),
    mismatchedIdCount:
      scopePlans.reduce(
        (total, scope) =>
          total +
          scope.reconciliation
            .mismatchedIds.length,
        0
      ),
    extraActiveIdCount:
      scopePlans.reduce(
        (total, scope) =>
          total +
          scope.reconciliation
            .extraActiveIds.length,
        0
      ),
    adminAssignments:
      scopePlans.reduce(
        (total, scope) =>
          total +
          (
            scope.assignmentPresence
              .admin
              ? 0
              : 1
          ),
        0
      ),
    principalAssignments:
      scopePlans.reduce(
        (total, scope) =>
          total +
          (
            scope.assignmentPresence
              .principal
              ? 0
              : 1
          ),
        0
      )
  };

  const uniqueErrors =
    publicErrors(errors);
  const uniqueWarnings =
    publicErrors(warnings);

  let status:
    AttendancePhase3b3BatchPlan["status"];

  if (
    uniqueErrors.length > 0 ||
    scopePlans.length !== 3 ||
    scopePlans.some(
      (scope) =>
        !scope.safe
    )
  ) {
    status = "blocked";
  } else if (
    scopePlans.every(
      (scope) =>
        scope.status ===
        "ready_match"
    )
  ) {
    status = "ready_match";
  } else {
    status =
      "ready_initial_sync";
  }

  const batchSourceDigest =
    sha256Canonical(
      scopePlans.map(
        (scope) => ({
          scopeId:
            scope.scopeId,
          sourceDigest:
            scope.sourceDigest
        })
      )
    );

  const batchPlanDigest =
    sha256Canonical({
      version:
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_VERSION,
      rolloutId:
        ATTENDANCE_PHASE3B3_GENERIC_BATCH_ROLLOUT_ID,
      operatorUid,
      batchSourceDigest,
      scopePlans:
        scopePlans.map(
          (scope) => ({
            scopeId:
              scope.scopeId,
            scopePlanDigest:
              scope.scopePlanDigest,
            reconciliation:
              scope.reconciliation,
            assignmentPresence:
              scope.assignmentPresence
          })
        )
    });

  return {
    version:
      ATTENDANCE_PHASE3B3_GENERIC_BATCH_VERSION,
    rolloutId:
      ATTENDANCE_PHASE3B3_GENERIC_BATCH_ROLLOUT_ID,
    mode:
      "controlled_batch_plan",
    date: "2026-07-18",
    targetCount: 3,
    expectedAttendanceCount: 20,
    sourceCount,
    acceptedCount,
    rejectedCount,
    batchSourceDigest,
    batchPlanDigest,
    safeToArm:
      status !== "blocked" &&
      uniqueErrors.length === 0,
    status,
    scopes:
      scopePlans,
    totals,
    plannedWrites: {
      attendanceUpserts:
        totals.upsertCount,
      attendanceStaleMarks:
        totals.staleCount,
      adminAssignments:
        totals.adminAssignments,
      principalAssignments:
        totals.principalAssignments,
      approval: 1,
      audit: 1
    },
    errors:
      uniqueErrors,
    warnings:
      uniqueWarnings
  };
}
