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
  type AttendanceMirrorPlan,
  type StoredAttendanceMirrorDocument
} from "./attendanceMirrorPlan.js";
import {
  auditAttendancePhase3bScope,
  type AttendancePhase3bPreflightRepository
} from "./attendancePhase3bPreflight.js";

export const ATTENDANCE_PHASE3B2_PARK_SOYEON_CONTROLLED_VERSION =
  "20260716.1-phase3b2-park-soyeon-controlled-rollout-fixed-teacher-uid";

export const ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET = Object.freeze({
  rolloutId:
    "phase3b2-park-soyeon-saturday-youth-beginner-a-2026-07-18",
  date: "2026-07-18",
  className:
    "[박소연T] - 토요일 청소년 초급A 11:00 ~ 13:00",
  instructor: "박소연T",
  classId:
    "legacy_c62b2b8cfff6d58f937329f9",
  teacherUid:
    "ADM-20260610-2F79885A",
  teacherName: "박소연",
  expectedSourceCount: 5,
  expectedSourceKeys: [
    "박소연T|V7",
    "박소연T|V8",
    "박소연T|V9",
    "박소연T|V10",
    "박소연T|V11"
  ]
});

export interface AttendancePhase3b2ParkSoyeonTeacherCandidate {
  readonly teacherUid: string;
  readonly teacherName: string;
  readonly active: boolean;
  readonly source: string;
}

export interface AttendancePhase3b2ParkSoyeonAssignmentPresence {
  readonly admin: boolean;
  readonly teacher: boolean;
}

export interface AttendancePhase3b2ParkSoyeonControlledRepository
extends AttendancePhase3bPreflightRepository {
  resolveTeacherCandidates(
    canonicalInstructor: string,
    recordTeacherUids: readonly string[]
  ): Promise<AttendancePhase3b2ParkSoyeonTeacherCandidate[]>;

  detailedAssignmentPresence(
    operatorUid: string,
    teacherUid: string,
    classId: string
  ): Promise<AttendancePhase3b2ParkSoyeonAssignmentPresence>;
}

export interface AttendancePhase3b2ParkSoyeonControlledPlan {
  readonly version: string;
  readonly rolloutId: string;
  readonly mode: "controlled_plan";
  readonly date: string;
  readonly requestedClassName: string;
  readonly canonicalClassName: string;
  readonly canonicalInstructor: string;
  readonly canonicalClassId: string;
  readonly teacherUid: string;
  readonly teacherName: string;
  readonly sourceCount: number;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly sourceDigest: string;
  readonly planDigest: string;
  readonly safeToArm: boolean;
  readonly status:
    | "ready_initial_sync"
    | "ready_match"
    | "blocked";
  readonly reconciliation:
    AttendanceMirrorPlan["reconciliation"];
  readonly assignmentPresence:
    AttendancePhase3b2ParkSoyeonAssignmentPresence;
  readonly plannedWrites: {
    readonly attendanceUpserts: number;
    readonly attendanceStaleMarks: number;
    readonly adminAssignment: number;
    readonly teacherAssignment: number;
    readonly approval: number;
    readonly audit: number;
  };
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly mirrorPlan: AttendanceMirrorPlan;
  readonly authoritativeRecords:
    readonly LegacyAttendanceRecord[];
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

  if (!studentUid) return current;

  if (
    !current ||
    unsafeIdentityKey(current)
  ) {
    return `uid:${studentUid}`;
  }

  return current;
}

function authoritativeRecord(
  record: LegacyAttendanceRecord
): LegacyAttendanceRecord {
  const status = text(
    record.status ||
    record.attendanceStatus
  );

  return {
    date:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET.date,
    sessionDate:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET.date,

    /*
     * 브라우저가 보낸 classId/sessionId는 폐기한다.
     * 서버가 고정 allowlist 반명·강사명으로 다시 계산한다.
     */
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

    /*
     * 이 첫 확대 반은 강사 UID가 아닌 canonical 강사명으로
     * classId를 계산한다. 실제 teacher assignment UID는
     * teachers 컬렉션에서 별도로 단일 확정한다.
     */
    instructor:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .instructor,
    teacherUid: undefined,
    teacherName:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .instructor,

    className:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .className,
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

function teacherCandidateDigest(
  candidate:
    AttendancePhase3b2ParkSoyeonTeacherCandidate
): Record<string, unknown> {
  return {
    teacherUid:
      candidate.teacherUid,
    teacherName:
      candidate.teacherName,
    active:
      candidate.active
  };
}

function publicErrors(
  values: readonly string[]
): string[] {
  return [...new Set(
    values
      .map(text)
      .filter(Boolean)
  )];
}

export function attendancePhase3b2ParkSoyeonApprovalTokenHash(
  token: string
): string {
  return createHash("sha256")
    .update(text(token), "utf8")
    .digest("hex");
}

export function publicAttendancePhase3b2ParkSoyeonPlan(
  plan: AttendancePhase3b2ParkSoyeonControlledPlan
): Omit<
  AttendancePhase3b2ParkSoyeonControlledPlan,
  "mirrorPlan" | "authoritativeRecords"
> {
  const {
    mirrorPlan: _mirrorPlan,
    authoritativeRecords:
      _authoritativeRecords,
    ...result
  } = plan;

  return result;
}

export async function buildAttendancePhase3b2ParkSoyeonControlledPlan(
  records: readonly LegacyAttendanceRecord[],
  operatorUid: string,
  repository:
    AttendancePhase3b2ParkSoyeonControlledRepository,
  now = new Date()
): Promise<AttendancePhase3b2ParkSoyeonControlledPlan> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceRecords = [...records];

  if (
    sourceRecords.length !==
    ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
      .expectedSourceCount
  ) {
    errors.push(
      `target requires exactly ${
        ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
          .expectedSourceCount
      } source record(s); received ${
        sourceRecords.length
      }`
    );
  }

  const recordDates =
    sourceRecords.map(
      (record) =>
        text(
          record.sessionDate ||
          record.date
        )
    );

  if (
    recordDates.some(
      (date) =>
        date !==
        ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET.date
    )
  ) {
    errors.push(
      "record date crossed the fixed Phase 3B-2 target"
    );
  }

  const recordClassNames =
    sourceRecords.map(
      (record) =>
        compact(record.className)
    );

  if (
    recordClassNames.some(
      (className) =>
        className !==
        compact(
          ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
            .className
        )
    )
  ) {
    errors.push(
      "record className crossed the fixed Phase 3B-2 target"
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
    new Set(
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .expectedSourceKeys
        .map(normalizedSourceKey)
    );

  if (
    sourceKeys.some(
      (sourceKey) =>
        !sourceKey ||
        !allowedSourceKeys.has(sourceKey)
    )
  ) {
    errors.push(
      "record sourceKey crossed the fixed Phase 3B-2 source cell allowlist"
    );
  }

  const audit =
    await auditAttendancePhase3bScope(
      {
        date:
          ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
            .date,
        requestedClassName:
          ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
            .className,
        requestedTeacher:
          ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
            .instructor,
        records: sourceRecords
      },
      operatorUid,
      repository,
      now
    );

  if (!audit.safeForControlledRollout) {
    errors.push(
      ...audit.errors,
      `preflight status is ${audit.status}`
    );
  }

  if (
    audit.canonicalClassId !==
    ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET.classId
  ) {
    errors.push(
      `server classId mismatch: ${
        audit.canonicalClassId ||
        "(empty)"
      }`
    );
  }

  if (
    compact(audit.canonicalClassName) !==
    compact(
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .className
    )
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
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .instructor
    )
  ) {
    errors.push(
      "server canonical instructor mismatch"
    );
  }

  const authoritativeRecords =
    sourceRecords.map(
      authoritativeRecord
    );

  const classIds = new Set(
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
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .classId
  ) {
    errors.push(
      "authoritative records did not resolve to the fixed classId"
    );
  }

  const existing =
    await repository.loadScope({
      sessionDate:
        ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
          .date,
      classId:
        ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
          .classId
    });

  const mirrorPlan =
    buildAttendanceMirrorPlan(
      authoritativeRecords,
      existing,
      {
        sessionDate:
          ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
            .date,
        classId:
          ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
            .classId
      },
      {
        runId:
          `phase3b2_park_soyeon_plan_${now.getTime()}`,
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
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .expectedSourceCount ||
    mirrorPlan.acceptedCount !==
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .expectedSourceCount ||
    mirrorPlan.rejectedCount !== 0
  ) {
    errors.push(
      `mirror plan did not resolve to exactly ${
        ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
          .expectedSourceCount
      } accepted records`
    );
  }

  if (
    mirrorPlan.staleIds.length !== 0
  ) {
    errors.push(
      "controlled initial rollout refuses stale attendance documents"
    );
  }

  if (
    mirrorPlan.upserts.length >
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .expectedSourceCount
  ) {
    errors.push(
      `controlled initial rollout exceeds ${
        ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
          .expectedSourceCount
      } attendance upserts`
    );
  }

  if (
    mirrorPlan.reconciliation
      .mismatchedIds.length > 0
  ) {
    errors.push(
      "controlled initial rollout refuses mismatched existing documents"
    );
  }

  const fixedTeacherUid =
    ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
      .teacherUid;

  const fixedTeacherName =
    ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
      .teacherName;

  /*
   * 박성광 강사 UID는 GAS 관리자인증 원본을 읽기 전용으로
   * 진단한 결과(715.05)를 서버 allowlist에 고정한다.
   *
   * 브라우저 record.teacherUid 또는 선택 가능한 teachers
   * 디렉터리를 권한 결정의 기준으로 사용하지 않는다.
   */
  const recordTeacherUids =
    [...new Set(
      sourceRecords
        .map(
          (record) =>
            text(record.teacherUid)
        )
        .filter(Boolean)
    )];

  const conflictingRecordTeacherUids =
    recordTeacherUids.filter(
      (teacherUid) =>
        teacherUid !==
        fixedTeacherUid
    );

  if (
    conflictingRecordTeacherUids
      .length > 0
  ) {
    errors.push(
      "source record teacherUid conflicts with the server-fixed teacherUid"
    );
  }

  const directoryTeacherCandidates =
    await repository
      .resolveTeacherCandidates(
        ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
          .instructor,
        recordTeacherUids
      );

  const activeDirectoryCandidates =
    [...new Map(
      directoryTeacherCandidates
        .filter(
          (candidate) =>
            candidate.active &&
            text(candidate.teacherUid)
        )
        .map(
          (candidate) => [
            text(candidate.teacherUid),
            candidate
          ]
        )
    ).values()];

  const conflictingDirectoryCandidates =
    activeDirectoryCandidates.filter(
      (candidate) =>
        text(candidate.teacherUid) !==
        fixedTeacherUid
    );

  if (
    conflictingDirectoryCandidates
      .length > 0
  ) {
    errors.push(
      "teachers directory contains an active UID that conflicts with the server-fixed teacherUid"
    );
  }

  const fixedDirectoryCandidate =
    activeDirectoryCandidates.find(
      (candidate) =>
        text(candidate.teacherUid) ===
        fixedTeacherUid
    );

  if (
    fixedDirectoryCandidate &&
    normalizedInstructor(
      fixedDirectoryCandidate
        .teacherName
    ) !==
    normalizedInstructor(
      fixedTeacherName
    )
  ) {
    errors.push(
      "teachers directory name does not match the server-fixed teacher"
    );
  }

  if (!fixedDirectoryCandidate) {
    warnings.push(
      "teachers directory has no fixed teacher record; using GAS read-only diagnosed server-fixed teacherUid"
    );
  }

  const teacher = {
    teacherUid:
      fixedTeacherUid,
    teacherName:
      fixedTeacherName,
    active: true,
    source:
      fixedDirectoryCandidate
        ? "server_fixed_uid_and_teachers_directory"
        : "server_fixed_gas_diagnosis_71505"
  };

  const assignmentPresence =
    teacher.teacherUid
      ? await repository
          .detailedAssignmentPresence(
            operatorUid,
            teacher.teacherUid,
            ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
              .classId
          )
      : {
          admin: false,
          teacher: false
        };

  if (
    audit.status ===
    "ready_resync"
  ) {
    errors.push(
      "ready_resync is outside the first controlled rollout"
    );
  }

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
    AttendancePhase3b2ParkSoyeonControlledPlan["status"];

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
    status = "ready_initial_sync";
  }

  const digestPayload = {
    version:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_CONTROLLED_VERSION,
    rolloutId:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .rolloutId,
    operatorUid,
    date:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET.date,
    canonicalClassId:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .classId,
    canonicalClassName:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .className,
    canonicalInstructor:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .instructor,
    sourceDigest:
      mirrorPlan.sourceDigest,
    sourceCount:
      mirrorPlan.sourceCount,
    reconciliation:
      mirrorPlan.reconciliation,
    teacher:
      teacherCandidateDigest(teacher),
    assignmentPresence
  };

  const planDigest =
    sha256Canonical(digestPayload);

  return {
    version:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_CONTROLLED_VERSION,
    rolloutId:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .rolloutId,
    mode: "controlled_plan",
    date:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET.date,
    requestedClassName:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .className,
    canonicalClassName:
      audit.canonicalClassName ||
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .className,
    canonicalInstructor:
      audit.canonicalInstructor ||
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .instructor,
    canonicalClassId:
      audit.canonicalClassId ||
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .classId,
    teacherUid:
      teacher.teacherUid,
    teacherName:
      teacher.teacherName,
    sourceCount:
      mirrorPlan.sourceCount,
    acceptedCount:
      mirrorPlan.acceptedCount,
    rejectedCount:
      mirrorPlan.rejectedCount,
    sourceDigest:
      mirrorPlan.sourceDigest,
    planDigest,
    safeToArm:
      uniqueErrors.length === 0 &&
      (
        status ===
          "ready_initial_sync" ||
        status ===
          "ready_match"
      ),
    status,
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
      teacherAssignment:
        assignmentPresence.teacher
          ? 0
          : 1,
      approval: 1,
      audit: 1
    },
    errors: uniqueErrors,
    warnings: uniqueWarnings,
    mirrorPlan,
    authoritativeRecords
  };
}

export function attendancePhase3b2ParkSoyeonDigestForApproval(
  value: {
    readonly operatorUid: string;
    readonly planDigest: string;
    readonly approvalId: string;
    readonly tokenHash: string;
    readonly expiresAt: string;
  }
): string {
  return sha256Canonical({
    version:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_CONTROLLED_VERSION,
    rolloutId:
      ATTENDANCE_PHASE3B2_PARK_SOYEON_TARGET
        .rolloutId,
    ...value
  });
}

export function attendancePhase3b2ParkSoyeonStoredAttendanceIds(
  documents:
    readonly StoredAttendanceMirrorDocument[]
): string[] {
  return documents
    .map(
      (document) => document.id
    )
    .sort();
}
