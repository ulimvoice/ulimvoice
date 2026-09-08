import {
  getFirestore
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
import type {
  LegacyAttendanceRecord
} from "./attendanceMirror.js";
import {
  FirestoreAttendanceMirrorRepository
} from "./firestoreAttendanceMirrorRepository.js";
import {
  ATTENDANCE_PHASE3B_PREFLIGHT_VERSION,
  auditAttendancePhase3bScope,
  summarizeAttendancePhase3bAudits,
  type AttendancePhase3bPreflightRepository,
  type AttendancePhase3bRequestedScope,
  type AttendancePhase3bScopeAudit
} from "./attendancePhase3bPreflight.js";

const REQUEST_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

const MAX_SCOPES = 30;
const MAX_RECORDS_PER_SCOPE = 150;
const MAX_TOTAL_RECORDS = 1500;

interface ParsedInput {
  requestId: string;
  scopes: AttendancePhase3bRequestedScope[];
}

export interface AttendancePhase3bPreflightResult {
  ok: true;
  version: string;
  mode: "read_only_preflight";
  requestId: string;
  generatedAt: string;
  writeOperations: 0;
  summary: Record<string, number>;
  instructorPrincipals: ReturnType<
    typeof attendancePhase3bPublicInstructorPrincipals
  >;
  audits: AttendancePhase3bScopeAudit[];
}

function text(value: unknown): string {
  return String(value ?? "").trim().normalize("NFC");
}

export interface AttendancePhase3bInstructorPrincipalMapEntry {
  readonly uid: string;
  readonly name: string;
  readonly accountRole:
    | "teacher"
    | "admin"
    | "superAdmin";
  readonly source:
    "gas_admin_auth_server_verified";
}

export const ATTENDANCE_PHASE3B_INSTRUCTOR_PRINCIPAL_BY_NAME =
  Object.freeze({
    "김하은": {
      uid: "ADM-20260610-0213CFC6",
      name: "김하은",
      accountRole: "teacher",
      source: "gas_admin_auth_server_verified"
    },
    "박소연": {
      uid: "ADM-20260610-2F79885A",
      name: "박소연",
      accountRole: "teacher",
      source: "gas_admin_auth_server_verified"
    },
    "안수현": {
      uid: "ADM-20260617-2939B288",
      name: "안수현",
      accountRole: "teacher",
      source: "gas_admin_auth_server_verified"
    },
    "박성광": {
      uid: "ADM-20260623-4E3CFB75",
      name: "박성광",
      accountRole: "teacher",
      source: "gas_admin_auth_server_verified"
    },
    "이용우": {
      uid: "ADM-20260604-90A754C4",
      name: "이용우",
      accountRole: "superAdmin",
      source: "gas_admin_auth_server_verified"
    },
    "양슬기": {
      uid: "ADM-20260606-DAD09658",
      name: "양슬기",
      accountRole: "superAdmin",
      source: "gas_admin_auth_server_verified"
    }
  } as const satisfies Record<
    string,
    AttendancePhase3bInstructorPrincipalMapEntry
  >);

function normalizedTeacherName(
  value: unknown
): string {
  return text(value)
    .replace(/\s+/gu, "")
    .replace(/(?:선생님|강사)$/u, "")
    .replace(/t$/iu, "");
}

export function resolveAttendancePhase3bInstructorPrincipal(
  canonicalInstructor: string
): AttendancePhase3bInstructorPrincipalMapEntry |
undefined {
  const key =
    normalizedTeacherName(
      canonicalInstructor
    ) as keyof typeof
      ATTENDANCE_PHASE3B_INSTRUCTOR_PRINCIPAL_BY_NAME;

  return (
    ATTENDANCE_PHASE3B_INSTRUCTOR_PRINCIPAL_BY_NAME[
      key
    ]
  );
}

/*
 * 기존 코드·테스트 호환용 별칭이다.
 * 계정 역할이 관리자여도 수업 담당 UID로 사용할 수 있다.
 */
export function resolveAttendancePhase3bTeacherUid(
  canonicalInstructor: string
): string {
  return (
    resolveAttendancePhase3bInstructorPrincipal(
      canonicalInstructor
    )?.uid || ""
  );
}

export function attendancePhase3bPublicInstructorPrincipals() {
  return Object.values(
    ATTENDANCE_PHASE3B_INSTRUCTOR_PRINCIPAL_BY_NAME
  ).map((principal) => ({
    uid: principal.uid,
    name: principal.name,
    accountRole: principal.accountRole,
    source: principal.source,
    assignmentCollection:
      "teacherAssignments"
  }));
}

function integerOrUndefined(value: unknown): number | undefined {
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

  const record = value as Record<string, unknown>;

  return {
    date: text(record.date),
    sessionDate: text(record.sessionDate),
    studentName: text(record.studentName),
    studentNo: text(record.studentNo),
    studentUid: text(record.studentUid),
    studentIdentityKey: text(
      record.studentIdentityKey
    ),
    studentRowNumber:
      integerOrUndefined(
        record.studentRowNumber
      ),
    instructor: text(record.instructor),
    teacherUid: text(record.teacherUid),
    teacherName: text(record.teacherName),
    className: text(record.className),
    classroom: text(record.classroom),
    startTime: text(record.startTime),
    endTime: text(record.endTime),
    status: text(record.status),
    attendanceStatus: text(
      record.attendanceStatus
    ),
    specialStatus: text(
      record.specialStatus
    ),
    enrollmentStatus: text(
      record.enrollmentStatus
    ),
    studentStatus: text(
      record.studentStatus
    ),
    memo: text(record.memo),
    note: text(record.note),
    sourceSheet: text(record.sourceSheet),
    sourceRow: integerOrUndefined(
      record.sourceRow
    ),
    sourceCol: integerOrUndefined(
      record.sourceCol
    ),
    sourceCell: text(record.sourceCell),
    sourceKey: text(record.sourceKey)
  };
}

function parseInput(data: unknown): ParsedInput {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Phase 3B preflight input must be an object"
    );
  }

  const input = data as Record<string, unknown>;
  const requestId = text(input.requestId);

  if (!REQUEST_ID_PATTERN.test(requestId)) {
    throw new HttpsError(
      "invalid-argument",
      "requestId format is invalid"
    );
  }

  if (
    !Array.isArray(input.scopes) ||
    input.scopes.length < 1 ||
    input.scopes.length > MAX_SCOPES
  ) {
    throw new HttpsError(
      "invalid-argument",
      `scopes must contain 1-${MAX_SCOPES} items`
    );
  }

  let totalRecords = 0;

  const scopes = input.scopes.map(
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

      const scope = value as Record<string, unknown>;
      const date = text(scope.date);
      const requestedClassName = text(
        scope.requestedClassName
      );
      const requestedTeacher = text(
        scope.requestedTeacher
      );

      if (!requestedClassName) {
        throw new HttpsError(
          "invalid-argument",
          `scopes[${index}].requestedClassName is required`
        );
      }

      if (!Array.isArray(scope.records)) {
        throw new HttpsError(
          "invalid-argument",
          `scopes[${index}].records must be an array`
        );
      }

      if (
        scope.records.length >
        MAX_RECORDS_PER_SCOPE
      ) {
        throw new HttpsError(
          "invalid-argument",
          `scopes[${index}] exceeds ${MAX_RECORDS_PER_SCOPE} records`
        );
      }

      totalRecords += scope.records.length;

      return {
        date,
        requestedClassName,
        requestedTeacher,
        records: scope.records.map(sanitizeRecord)
      };
    }
  );

  if (totalRecords > MAX_TOTAL_RECORDS) {
    throw new HttpsError(
      "invalid-argument",
      `total records exceed ${MAX_TOTAL_RECORDS}`
    );
  }

  return {
    requestId,
    scopes
  };
}

function requireSuperAdmin(
  request: CallableRequest<unknown>
): string {
  const uid = text(request.auth?.uid);
  const role = text(request.auth?.token?.role);

  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "Firebase authentication is required"
    );
  }

  if (role !== "superAdmin") {
    throw new HttpsError(
      "permission-denied",
      "Phase 3B rollout preflight requires superAdmin"
    );
  }

  return uid;
}

export class FirestoreAttendancePhase3bPreflightRepository
implements AttendancePhase3bPreflightRepository {
  private readonly mirrorRepository:
    FirestoreAttendanceMirrorRepository;

  constructor(
    private readonly db = getFirestore()
  ) {
    this.mirrorRepository =
      new FirestoreAttendanceMirrorRepository(
        db
      );
  }

  loadScope(
    scope: {
      sessionDate: string;
      classId: string;
    }
  ) {
    return this.mirrorRepository
      .loadScope(scope);
  }

  async assignmentPresence(
    operatorUid: string,
    classId: string,
    canonicalInstructor: string
  ) {
    const principal =
      resolveAttendancePhase3bInstructorPrincipal(
        canonicalInstructor
      );

    const adminPromise =
      this.db.doc(
        `adminAssignments/${operatorUid}/classes/${classId}`
      ).get();

    const teacherPromise =
      principal?.uid
        ? this.db.doc(
            `teacherAssignments/${principal.uid}/classes/${classId}`
          ).get()
        : Promise.resolve(null);

    const [admin, teacher] =
      await Promise.all([
        adminPromise,
        teacherPromise
      ]);

    return {
      admin:
        admin.exists &&
        admin.data()?.active !== false &&
        admin.data()?.readAllowed !== false,
      teacher:
        !!(
          teacher &&
          teacher.exists &&
          teacher.data()?.active !== false &&
          teacher.data()?.readAllowed !== false
        ),
      principal: principal
        ? {
            uid: principal.uid,
            name: principal.name,
            accountRole:
              principal.accountRole,
            source: principal.source
          }
        : {
            uid: "",
            name:
              normalizedTeacherName(
                canonicalInstructor
              ),
            accountRole:
              "unknown" as const,
            source: ""
          }
    };
  }
}

export async function handleAttendancePhase3bPreflight(
  data: unknown,
  auth: {
    uid?: string;
    role?: string;
  } | undefined,
  repository: AttendancePhase3bPreflightRepository,
  now = new Date()
): Promise<AttendancePhase3bPreflightResult> {
  if (!auth?.uid) {
    throw new HttpsError(
      "unauthenticated",
      "Firebase authentication is required"
    );
  }

  if (auth.role !== "superAdmin") {
    throw new HttpsError(
      "permission-denied",
      "Phase 3B rollout preflight requires superAdmin"
    );
  }

  const input = parseInput(data);
  const audits: AttendancePhase3bScopeAudit[] = [];

  /*
   * 의도적으로 순차 조회한다. 첫 전체반 확장 단계에서
   * Firestore 동시 질의를 제한하고 결과 순서를 고정한다.
   */
  for (const scope of input.scopes) {
    audits.push(
      await auditAttendancePhase3bScope(
        scope,
        auth.uid,
        repository,
        now
      )
    );
  }

  return {
    ok: true,
    version:
      ATTENDANCE_PHASE3B_PREFLIGHT_VERSION,
    mode: "read_only_preflight",
    requestId: input.requestId,
    generatedAt: now.toISOString(),
    writeOperations: 0,
    summary:
      summarizeAttendancePhase3bAudits(
        audits
      ),
    instructorPrincipals:
      attendancePhase3bPublicInstructorPrincipals(),
    audits
  };
}

export const auditAttendancePhase3bRolloutCallable =
  onCall(
    {
      region: ULIM_FUNCTION_REGION,
      cors: true,
      timeoutSeconds: 120,
      memory: "512MiB"
    },
    async (request) => {
      await getOrInitializeDefaultFirebaseAdminApp();
      const uid = requireSuperAdmin(request);
      const role = text(
        request.auth?.token?.role
      );

      return handleAttendancePhase3bPreflight(
        request.data,
        { uid, role },
        new FirestoreAttendancePhase3bPreflightRepository(),
        new Date()
      );
    }
  );
