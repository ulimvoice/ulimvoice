import type { LegacyAttendanceRecord } from "./attendanceMirror.js";
import {
  runAttendanceShadowRead,
  type AttendanceGasResponse,
  type AttendanceShadowDiagnostic,
  type AttendanceShadowReadResult
} from "./attendanceShadowRead.js";

export interface AttendanceShadowPilotScope {
  readonly id: string;
  readonly label: string;
  readonly yearMonth: string;
  readonly weekday: number;
  readonly weekdayLabel: string;
  readonly className: string;
  readonly instructor: string;
  readonly sessionDates: readonly string[];
  readonly classAliases: readonly string[];
  readonly instructorAliases: readonly string[];
}

const MONDAY_ACTING_BASIC_PILOT: AttendanceShadowPilotScope = Object.freeze({
  id: "lee-yongwoo-2026-07-monday-acting-basic",
  label: "이용우T / 2026년 7월 / 월요일 / 연기기초반",
  yearMonth: "2026-07",
  weekday: 1,
  weekdayLabel: "월요일",
  className: "연기기초반",
  instructor: "이용우T",
  sessionDates: Object.freeze([
    "2026-07-06",
    "2026-07-13",
    "2026-07-20",
    "2026-07-27"
  ]),
  classAliases: Object.freeze([
    "연기기초반",
    "연기기초",
    "월요일 연기기초반",
    "월요일 연기기초",
    "월요일연기기초반",
    "월요일연기기초",
    "연기기초반월요일",
    "연기기초반(월)",
    "[이용우T] - 월요일 연기기초 19:00 ~ 21:00"
  ]),
  instructorAliases: Object.freeze([
    "이용우",
    "이용우T",
    "이용우선생님",
    "이용우강사"
  ])
});

const SUNDAY_YOUTH_INTERMEDIATE_C_PILOT: AttendanceShadowPilotScope = Object.freeze({
  id: "lee-yongwoo-2026-07-sunday-youth-intermediate-c",
  label: "이용우T / 2026년 7월 / 일요일 / 청소년 중급C",
  yearMonth: "2026-07",
  weekday: 0,
  weekdayLabel: "일요일",
  className: "청소년 중급C",
  instructor: "이용우T",
  sessionDates: Object.freeze([
    "2026-07-05",
    "2026-07-12",
    "2026-07-19",
    "2026-07-26"
  ]),
  classAliases: Object.freeze([
    "청소년 중급C",
    "청소년중급C",
    "청소년 중급 C",
    "청소년중급 C",
    "청소년 중급C반",
    "청소년중급C반",
    "일요일 청소년 중급C",
    "일요일청소년중급C",
    "청소년 중급C 일요일",
    "청소년중급C일요일",
    "[이용우T] - 일요일 청소년 중급C 13:00 ~ 15:00"
  ]),
  instructorAliases: Object.freeze([
    "이용우",
    "이용우T",
    "이용우선생님",
    "이용우강사"
  ])
});


const THURSDAY_ACTING_BASIC_CHOI_PILOT: AttendanceShadowPilotScope = Object.freeze({
  id: "choi-hyunsik-2026-07-thursday-acting-basic",
  label: "최현식T / 2026년 7월 / 목요일 / 연기기초",
  yearMonth: "2026-07",
  weekday: 4,
  weekdayLabel: "목요일",
  className: "연기기초",
  instructor: "최현식T",
  sessionDates: Object.freeze([
    "2026-07-09",
    "2026-07-16",
    "2026-07-23",
    "2026-07-30"
  ]),
  classAliases: Object.freeze([
    "연기기초",
    "연기기초반",
    "목요일 연기기초",
    "목요일 연기기초반",
    "목요일연기기초",
    "목요일연기기초반",
    "연기기초 목요일",
    "연기기초반 목요일",
    "연기기초목요일",
    "연기기초반목요일",
    "[최현식T] - 목요일 연기기초 19:00 ~ 22:00",
    "[최현식T] - 목요일 연기기초 19:00~22:00",
    "[최현식] - 목요일 연기기초 19:00 ~ 22:00"
  ]),
  instructorAliases: Object.freeze([
    "최현식",
    "최현식T",
    "최현식선생님",
    "최현식강사"
  ])
});


const THURSDAY_ACTING_BASIC_KIM_CHEOLSU_PILOT: AttendanceShadowPilotScope = Object.freeze({
  id: "kim-cheolsu-2026-07-thursday-acting-basic",
  label: "김철수T / 2026년 7월 / 목요일 / 연기기초",
  yearMonth: "2026-07",
  weekday: 4,
  weekdayLabel: "목요일",
  className: "연기기초",
  instructor: "김철수T",
  sessionDates: Object.freeze([
    "2026-07-09",
    "2026-07-16",
    "2026-07-23",
    "2026-07-30"
  ]),
  classAliases: Object.freeze([
    "연기기초",
    "연기기초반",
    "목요일 연기기초",
    "목요일 연기기초반",
    "목요일연기기초",
    "목요일연기기초반",
    "연기기초 목요일",
    "연기기초반 목요일",
    "연기기초목요일",
    "연기기초반목요일",
    "[김철수T] - 목요일 연기기초 19:00 ~ 22:00",
    "[김철수T] - 목요일 연기기초 19:00~22:00",
    "[김철수] - 목요일 연기기초 19:00 ~ 22:00"
  ]),
  instructorAliases: Object.freeze([
    "김철수",
    "김철수T",
    "김철수선생님",
    "김철수강사"
  ])
});

/** Backward-compatible export for the first completed scope. */
export const ATTENDANCE_SHADOW_PILOT = MONDAY_ACTING_BASIC_PILOT;

export const ATTENDANCE_SHADOW_PILOTS: readonly AttendanceShadowPilotScope[] = Object.freeze([
  MONDAY_ACTING_BASIC_PILOT,
  SUNDAY_YOUTH_INTERMEDIATE_C_PILOT,
  THURSDAY_ACTING_BASIC_CHOI_PILOT,
  THURSDAY_ACTING_BASIC_KIM_CHEOLSU_PILOT
]);

export type AttendanceShadowPilotDiagnosticCode =
  | AttendanceShadowDiagnostic["code"]
  | "pilot_request_outside_scope"
  | "gas_scope_mismatch"
  | "firestore_scope_mismatch";

export interface AttendanceShadowPilotDiagnostic extends Omit<AttendanceShadowDiagnostic, "code"> {
  code: AttendanceShadowPilotDiagnosticCode;
  pilotId: string;
  scopeViolations?: string[];
}

export interface AttendanceShadowPilotResult<T extends AttendanceGasResponse>
  extends Omit<AttendanceShadowReadResult<T>, "diagnostic"> {
  diagnostic: AttendanceShadowPilotDiagnostic;
}

export interface AttendanceShadowPilotOptions<T extends AttendanceGasResponse> {
  enabled: boolean;
  explicitTestMode: boolean;
  params: Record<string, unknown>;
  gasReader(params: Record<string, unknown>): Promise<T>;
  firestoreReader(params: Record<string, unknown>): Promise<LegacyAttendanceRecord[]>;
  timeoutMs?: number;
  now?: () => number;
}

class FirestorePilotScopeError extends Error {
  constructor(public readonly violations: string[]) {
    super(`firestore pilot scope rejected: ${violations.join("; ")}`);
  }
}

function text(value: unknown): string {
  return String(value ?? "").trim().normalize("NFC");
}

function compact(value: unknown): string {
  return text(value).replace(/\s+/g, "").toLowerCase();
}

function normalizedInstructor(value: unknown): string {
  return compact(value).replace(/(?:선생님|강사)$/u, "").replace(/t$/u, "");
}

function dateFrom(value: Record<string, unknown> | LegacyAttendanceRecord): string {
  return text((value as Record<string, unknown>).date || (value as Record<string, unknown>).sessionDate);
}

function scopeHasDate(scope: AttendanceShadowPilotScope, value: unknown): boolean {
  return scope.sessionDates.includes(text(value));
}

function scopeHasClass(scope: AttendanceShadowPilotScope, value: unknown): boolean {
  const target = compact(value);
  return scope.classAliases.some((alias) => compact(alias) === target);
}

function scopeHasInstructor(scope: AttendanceShadowPilotScope, value: unknown): boolean {
  const target = normalizedInstructor(value);
  return scope.instructorAliases.some((alias) => normalizedInstructor(alias) === target);
}

export function resolveAttendanceShadowPilotScope(
  params: Record<string, unknown>
): AttendanceShadowPilotScope | undefined {
  const date = dateFrom(params);
  return ATTENDANCE_SHADOW_PILOTS.find(
    (scope) => scopeHasDate(scope, date) && scopeHasClass(scope, params.className)
  );
}

export function isAttendanceShadowPilotDate(value: unknown): boolean {
  return ATTENDANCE_SHADOW_PILOTS.some((scope) => scopeHasDate(scope, value));
}

export function isAttendanceShadowPilotClass(value: unknown): boolean {
  return ATTENDANCE_SHADOW_PILOTS.some((scope) => scopeHasClass(scope, value));
}

export function isAttendanceShadowPilotInstructor(value: unknown): boolean {
  return ATTENDANCE_SHADOW_PILOTS.some((scope) => scopeHasInstructor(scope, value));
}

export function validateAttendanceShadowPilotRequest(params: Record<string, unknown>): string[] {
  const violations: string[] = [];
  const date = dateFrom(params);
  const className = text(params.className);

  if (!isAttendanceShadowPilotDate(date)) {
    violations.push(`date ${date || "(empty)"} is outside the approved pilot dates`);
  }
  if (!isAttendanceShadowPilotClass(className)) {
    violations.push(`className ${className || "(empty)"} is outside the approved pilot classes`);
  }
  if (!resolveAttendanceShadowPilotScope(params)) {
    violations.push(`date/class pair ${date || "(empty)"} / ${className || "(empty)"} is outside the approved pilot scopes`);
  }
  return violations;
}

export function validateAttendanceShadowPilotRecords(
  records: readonly LegacyAttendanceRecord[],
  expectedDate: string,
  expectedClassName?: string
): string[] {
  const violations: string[] = [];
  const scope = resolveAttendanceShadowPilotScope({
    date: expectedDate,
    className: expectedClassName || records[0]?.className || ""
  });

  if (!scope) {
    return ["expected date/class pair is outside the approved pilot scopes"];
  }

  records.forEach((record, index) => {
    const date = dateFrom(record);
    if (date !== expectedDate || !scopeHasDate(scope, date)) {
      violations.push(`record[${index}] date is outside pilot scope ${scope.id}`);
    }
    if (!scopeHasClass(scope, record.className)) {
      violations.push(`record[${index}] className is outside pilot scope ${scope.id}`);
    }
    if (!scopeHasInstructor(scope, record.instructor || record.teacherName)) {
      violations.push(`record[${index}] instructor is outside pilot scope ${scope.id}`);
    }
  });
  return violations;
}

function pilotDiagnostic(
  diagnostic: AttendanceShadowDiagnostic,
  scope: AttendanceShadowPilotScope | undefined,
  code: AttendanceShadowPilotDiagnosticCode = diagnostic.code,
  scopeViolations?: string[]
): AttendanceShadowPilotDiagnostic {
  return {
    ...diagnostic,
    code,
    pilotId: scope?.id || ATTENDANCE_SHADOW_PILOT.id,
    ...(scopeViolations?.length ? { scopeViolations } : {})
  };
}

export async function runAttendanceShadowPilot<T extends AttendanceGasResponse>(
  options: AttendanceShadowPilotOptions<T>
): Promise<AttendanceShadowPilotResult<T>> {
  const response = await options.gasReader(options.params);
  if (!Array.isArray(response.records)) throw new Error("GAS attendance response records must be an array");

  const scope = resolveAttendanceShadowPilotScope(options.params);
  const requestViolations = validateAttendanceShadowPilotRequest(options.params);
  if (!scope || requestViolations.length > 0) {
    return {
      response,
      diagnostic: pilotDiagnostic({
        attempted: false,
        code: "disabled",
        message: "request is outside the approved attendance shadow pilots; GAS response returned unchanged"
      }, scope, "pilot_request_outside_scope", requestViolations)
    };
  }

  const expectedDate = dateFrom(options.params);
  const expectedClassName = text(options.params.className);
  const gasViolations = validateAttendanceShadowPilotRecords(
    response.records,
    expectedDate,
    expectedClassName
  );
  if (gasViolations.length > 0) {
    return {
      response,
      diagnostic: pilotDiagnostic({
        attempted: false,
        code: "disabled",
        message: "GAS records crossed the selected pilot boundary; Firestore was not queried"
      }, scope, "gas_scope_mismatch", gasViolations)
    };
  }

  const result = await runAttendanceShadowRead({
    enabled: options.enabled,
    explicitTestMode: options.explicitTestMode,
    params: options.params,
    timeoutMs: options.timeoutMs,
    now: options.now,
    gasReader: async () => response,
    firestoreReader: async (params) => {
      const records = await options.firestoreReader(params);
      const violations = validateAttendanceShadowPilotRecords(
        records,
        expectedDate,
        expectedClassName
      );
      if (violations.length > 0) throw new FirestorePilotScopeError(violations);
      return records;
    }
  });

  if (result.diagnostic.code === "firestore_error" && result.diagnostic.message.includes("firestore pilot scope rejected")) {
    const violationText = result.diagnostic.message
      .replace(/^.*firestore pilot scope rejected:\s*/u, "")
      .replace(/; GAS response returned unchanged$/u, "");
    return {
      response: result.response,
      diagnostic: pilotDiagnostic(
        result.diagnostic,
        scope,
        "firestore_scope_mismatch",
        violationText.split("; ").filter(Boolean)
      )
    };
  }

  return {
    response: result.response,
    diagnostic: pilotDiagnostic(result.diagnostic, scope)
  };
}
