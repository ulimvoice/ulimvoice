import type {
  LegacyAttendanceRecord
} from "./attendanceMirror.js";
import {
  buildStableClassId
} from "./attendanceMirror.js";
import {
  buildAttendanceMirrorPlan,
  type StoredAttendanceMirrorDocument
} from "./attendanceMirrorPlan.js";
import {
  ATTENDANCE_SHADOW_PILOTS,
  resolveAttendanceShadowPilotScope,
  validateAttendanceShadowPilotRecords
} from "./attendanceShadowPilot.js";

export const ATTENDANCE_PHASE3B_PREFLIGHT_VERSION =
  "20260716.4-phase3b-rollout-preflight-admin-instructor-principal-map";

export type AttendancePhase3bScopeStatus =
  | "ready_match"
  | "ready_initial_sync"
  | "ready_resync"
  | "empty_source"
  | "blocked_invalid_date"
  | "blocked_ambiguous_class_identity"
  | "blocked_scope_mismatch"
  | "blocked_unresolved_instructor_principal"
  | "blocked_unsafe_records";

export interface AttendancePhase3bRequestedScope {
  readonly date: string;
  readonly requestedClassName: string;
  readonly requestedTeacher?: string;
  readonly records: readonly LegacyAttendanceRecord[];
}

export type AttendancePhase3bPrincipalRole =
  | "teacher"
  | "admin"
  | "superAdmin"
  | "unknown";

export interface AttendancePhase3bInstructorPrincipal {
  readonly uid: string;
  readonly name: string;
  readonly accountRole:
    AttendancePhase3bPrincipalRole;
  readonly source: string;
}

export interface AttendancePhase3bAssignmentPresence {
  readonly admin: boolean;
  readonly teacher: boolean;
  readonly principal?:
    AttendancePhase3bInstructorPrincipal;
}

export interface AttendancePhase3bScopeAudit {
  readonly date: string;
  readonly requestedClassName: string;
  readonly requestedTeacher: string;
  readonly canonicalClassName: string;
  readonly canonicalInstructor: string;
  readonly canonicalClassId: string;
  readonly matchedExistingPilotId: string;
  readonly status: AttendancePhase3bScopeStatus;
  readonly safeForControlledRollout: boolean;
  readonly sourceCount: number;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly missingStudentUidCount: number;
  readonly missingSourceKeyCount: number;
  readonly distinctIdentityCount: number;
  readonly existingActiveCount: number;
  readonly upsertCount: number;
  readonly unchangedCount: number;
  readonly staleCount: number;
  readonly missingIds: readonly string[];
  readonly mismatchedIds: readonly string[];
  readonly extraActiveIds: readonly string[];
  readonly assignmentPresence: AttendancePhase3bAssignmentPresence;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface AttendancePhase3bPreflightRepository {
  loadScope(
    scope: { sessionDate: string; classId: string }
  ): Promise<StoredAttendanceMirrorDocument[]>;
  assignmentPresence(
    operatorUid: string,
    classId: string,
    canonicalInstructor: string
  ): Promise<AttendancePhase3bAssignmentPresence>;
}

function text(value: unknown): string {
  return String(value ?? "").trim().normalize("NFC");
}

function compact(value: unknown): string {
  return text(value)
    .replace(/\s+/gu, "")
    .toLowerCase();
}

function normalizedInstructor(value: unknown): string {
  return compact(value)
    .replace(/(?:선생님|강사)$/u, "")
    .replace(/t$/u, "");
}

function isUnsafeStudentIdentityKey(
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

/*
 * 학생인증 UID가 확인된 뒤에도 GAS 응답에 과거 전화번호 기반
 * studentIdentityKey가 남아 있을 수 있다.
 *
 * - 기존 키가 안전하면 문서 ID 안정성을 위해 그대로 유지
 * - 기존 키가 비어 있거나 전화번호 기반이면 검증된 UID로 교체
 * - UID가 없으면 기존 키를 유지하여 mirror validation이 차단
 */
function canonicalStudentIdentityKey(
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
    isUnsafeStudentIdentityKey(current)
  ) {
    return `uid:${studentUid}`;
  }

  return current;
}

function recordDate(record: LegacyAttendanceRecord): string {
  return text(record.sessionDate || record.date);
}

function recordInstructor(record: LegacyAttendanceRecord): string {
  return text(
    record.teacherUid ||
    record.instructor ||
    record.teacherName
  );
}

function recordSourceKey(record: LegacyAttendanceRecord): string {
  return text(record.sourceKey || record.sourceCell);
}

function sanitizeAuthoritativeRecord(
  record: LegacyAttendanceRecord,
  date: string,
  classNameOverride?: string,
  instructorOverride?: string
): LegacyAttendanceRecord {
  const status = text(
    record.status || record.attendanceStatus
  );

  return {
    date,
    sessionDate: date,

    /*
     * 브라우저/GAS가 보낸 classId·sessionId를 신뢰하지 않는다.
     * 서버가 className+instructor+sourceKey로 다시 계산한다.
     */
    classId: undefined,
    sessionId: undefined,

    studentName: text(record.studentName),
    studentNo: text(record.studentNo),
    studentUid: text(record.studentUid),
    studentIdentityKey:
      canonicalStudentIdentityKey(record),
    studentRowNumber:
      Number.isInteger(record.studentRowNumber)
        ? record.studentRowNumber
        : undefined,

    instructor: text(
      instructorOverride ||
      record.instructor ||
      record.teacherName
    ),
    teacherUid: text(record.teacherUid),
    teacherName: text(
      instructorOverride ||
      record.teacherName ||
      record.instructor
    ),

    className: text(
      classNameOverride || record.className
    ),
    classroom: text(record.classroom),
    startTime: text(record.startTime),
    endTime: text(record.endTime),

    status,
    attendanceStatus: status,
    specialStatus: text(record.specialStatus),
    enrollmentStatus: text(record.enrollmentStatus),
    studentStatus: text(record.studentStatus),
    memo: text(record.memo || record.note),

    sourceSheet: text(record.sourceSheet),
    sourceRow: Number.isInteger(record.sourceRow)
      ? record.sourceRow
      : undefined,
    sourceCol: Number.isInteger(record.sourceCol)
      ? record.sourceCol
      : undefined,
    sourceCell: text(record.sourceCell),
    sourceKey: recordSourceKey(record)
  };
}

function identityKey(record: LegacyAttendanceRecord): string {
  return [
    compact(record.className),
    normalizedInstructor(recordInstructor(record))
  ].join("|");
}

function resolvePilotCanonical(
  date: string,
  records: readonly LegacyAttendanceRecord[]
): {
  pilotId: string;
  className: string;
  instructor: string;
} | undefined {
  for (const record of records) {
    const scope = resolveAttendanceShadowPilotScope({
      date,
      className: record.className
    });

    if (!scope) continue;

    const violations =
      validateAttendanceShadowPilotRecords(
        [record],
        date,
        scope.className
      );

    if (violations.length === 0) {
      return {
        pilotId: scope.id,
        className: scope.className,
        instructor: scope.instructor
      };
    }
  }

  return undefined;
}

function emptyAudit(
  input: AttendancePhase3bRequestedScope,
  status: AttendancePhase3bScopeStatus,
  errors: readonly string[] = []
): AttendancePhase3bScopeAudit {
  return {
    date: text(input.date),
    requestedClassName:
      text(input.requestedClassName),
    requestedTeacher:
      text(input.requestedTeacher),
    canonicalClassName: "",
    canonicalInstructor: "",
    canonicalClassId: "",
    matchedExistingPilotId: "",
    status,
    safeForControlledRollout: false,
    sourceCount: input.records.length,
    acceptedCount: 0,
    rejectedCount: errors.length,
    missingStudentUidCount:
      input.records.filter(
        (record) => !text(record.studentUid)
      ).length,
    missingSourceKeyCount:
      input.records.filter(
        (record) => !recordSourceKey(record)
      ).length,
    distinctIdentityCount: 0,
    existingActiveCount: 0,
    upsertCount: 0,
    unchangedCount: 0,
    staleCount: 0,
    missingIds: [],
    mismatchedIds: [],
    extraActiveIds: [],
    assignmentPresence: {
      admin: false,
      teacher: false,
      principal: {
        uid: "",
        name: text(input.requestedTeacher),
        accountRole: "unknown",
        source: ""
      }
    },
    errors,
    warnings: []
  };
}

export async function auditAttendancePhase3bScope(
  input: AttendancePhase3bRequestedScope,
  operatorUid: string,
  repository: AttendancePhase3bPreflightRepository,
  now = new Date()
): Promise<AttendancePhase3bScopeAudit> {
  const date = text(input.date);

  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    return emptyAudit(
      input,
      "blocked_invalid_date",
      ["date must be YYYY-MM-DD"]
    );
  }

  if (input.records.length === 0) {
    return emptyAudit(input, "empty_source");
  }

  const dateViolations = input.records
    .map((record, index) => ({
      index,
      date: recordDate(record)
    }))
    .filter((item) => item.date !== date)
    .map(
      (item) =>
        `record[${item.index}] date ${item.date || "(empty)"} does not match ${date}`
    );

  if (dateViolations.length > 0) {
    return emptyAudit(
      input,
      "blocked_scope_mismatch",
      dateViolations
    );
  }

  const pilot = resolvePilotCanonical(
    date,
    input.records
  );

  const preCanonicalRecords = input.records.map(
    (record) =>
      sanitizeAuthoritativeRecord(
        record,
        date,
        pilot?.className,
        pilot?.instructor
      )
  );

  const identities = new Set(
    preCanonicalRecords
      .map(identityKey)
      .filter(Boolean)
  );

  if (identities.size !== 1) {
    return {
      ...emptyAudit(
        input,
        "blocked_ambiguous_class_identity",
        [
          `records resolved to ${identities.size} class/instructor identities`
        ]
      ),
      distinctIdentityCount: identities.size
    };
  }

  const canonicalClassName = text(
    pilot?.className ||
    preCanonicalRecords[0]?.className ||
    input.requestedClassName
  );

  const canonicalInstructor = text(
    pilot?.instructor ||
    recordInstructor(preCanonicalRecords[0]) ||
    input.requestedTeacher
  );

  const authoritativeRecords =
    preCanonicalRecords.map((record) =>
      sanitizeAuthoritativeRecord(
        record,
        date,
        canonicalClassName,
        canonicalInstructor
      )
    );

  const classIds = new Set(
    authoritativeRecords
      .map((record) => buildStableClassId(record))
      .filter(
        (value): value is string => !!value
      )
  );

  if (classIds.size !== 1) {
    return {
      ...emptyAudit(
        input,
        "blocked_ambiguous_class_identity",
        [
          `server recomputation produced ${classIds.size} classIds`
        ]
      ),
      canonicalClassName,
      canonicalInstructor,
      matchedExistingPilotId:
        pilot?.pilotId || "",
      distinctIdentityCount: identities.size
    };
  }

  const canonicalClassId = [...classIds][0];
  const existing = await repository.loadScope({
    sessionDate: date,
    classId: canonicalClassId
  });

  const plan = buildAttendanceMirrorPlan(
    authoritativeRecords,
    existing,
    {
      sessionDate: date,
      classId: canonicalClassId
    },
    {
      runId: `phase3b_preflight_${date}_${canonicalClassId}`,
      now,
      allowEmptySnapshot: false
    }
  );

  const assignmentPresence =
    await repository.assignmentPresence(
      operatorUid,
      canonicalClassId,
      canonicalInstructor
    );

  const missingStudentUidCount =
    authoritativeRecords.filter(
      (record) => !text(record.studentUid)
    ).length;

  const missingSourceKeyCount =
    authoritativeRecords.filter(
      (record) => !recordSourceKey(record)
    ).length;

  const errors = plan.errors.map(
    (error) => `${error.code}: ${error.message}`
  );

  const warnings: string[] = [];

  if (!canonicalInstructor) {
    warnings.push(
      "canonical instructor is empty"
    );
  }

  const principalResolved =
    !!text(
      assignmentPresence.principal?.uid
    );

  if (!principalResolved) {
    warnings.push(
      "instructor principal UID is unresolved"
    );
  }

  if (
    input.requestedTeacher &&
    canonicalInstructor &&
    normalizedInstructor(
      input.requestedTeacher
    ) !== normalizedInstructor(
      canonicalInstructor
    )
  ) {
    warnings.push(
      `requested teacher ${text(input.requestedTeacher)} differs from records ${canonicalInstructor}`
    );
  }

  let status: AttendancePhase3bScopeStatus;

  if (!plan.safeToCommit) {
    status = "blocked_unsafe_records";
  } else if (!principalResolved) {
    status =
      "blocked_unresolved_instructor_principal";
  } else if (
    plan.reconciliation.existingActiveCount === 0
  ) {
    status = "ready_initial_sync";
  } else if (
    plan.reconciliation.upsertCount === 0 &&
    plan.reconciliation.staleCount === 0
  ) {
    status = "ready_match";
  } else {
    status = "ready_resync";
  }

  return {
    date,
    requestedClassName:
      text(input.requestedClassName),
    requestedTeacher:
      text(input.requestedTeacher),
    canonicalClassName,
    canonicalInstructor,
    canonicalClassId,
    matchedExistingPilotId:
      pilot?.pilotId || "",
    status,
    safeForControlledRollout:
      plan.safeToCommit &&
      principalResolved &&
      missingStudentUidCount === 0 &&
      missingSourceKeyCount === 0,
    sourceCount: authoritativeRecords.length,
    acceptedCount: plan.acceptedCount,
    rejectedCount: plan.rejectedCount,
    missingStudentUidCount,
    missingSourceKeyCount,
    distinctIdentityCount: identities.size,
    existingActiveCount:
      plan.reconciliation.existingActiveCount,
    upsertCount:
      plan.reconciliation.upsertCount,
    unchangedCount:
      plan.reconciliation.unchangedCount,
    staleCount:
      plan.reconciliation.staleCount,
    missingIds:
      plan.reconciliation.missingIds,
    mismatchedIds:
      plan.reconciliation.mismatchedIds,
    extraActiveIds:
      plan.reconciliation.extraActiveIds,
    assignmentPresence,
    errors,
    warnings
  };
}

export function summarizeAttendancePhase3bAudits(
  audits: readonly AttendancePhase3bScopeAudit[]
): Record<string, number> {
  const summary: Record<string, number> = {
    total: audits.length,
    ready: 0,
    blocked: 0,
    empty: 0,
    readyMatch: 0,
    readyInitialSync: 0,
    readyResync: 0
  };

  for (const audit of audits) {
    if (audit.status === "empty_source") {
      summary.empty += 1;
      continue;
    }

    if (audit.safeForControlledRollout) {
      summary.ready += 1;
    } else {
      summary.blocked += 1;
    }

    if (audit.status === "ready_match") {
      summary.readyMatch += 1;
    }
    if (audit.status === "ready_initial_sync") {
      summary.readyInitialSync += 1;
    }
    if (audit.status === "ready_resync") {
      summary.readyResync += 1;
    }
  }

  return summary;
}

export function attendancePhase3bKnownPilotIds(): string[] {
  return ATTENDANCE_SHADOW_PILOTS.map(
    (scope) => scope.id
  );
}
