import type { LegacyAttendanceRecord } from "./attendanceMirror.js";
import { compareAttendanceParity, type AttendanceParityResult } from "./attendanceParity.js";

export type AttendanceShadowDiagnosticCode =
  | "disabled"
  | "not_explicit_test_mode"
  | "match"
  | "timeout"
  | "permission_denied"
  | "unavailable"
  | "unauthenticated"
  | "empty_firestore_result"
  | "partial_or_mismatched_result"
  | "malformed_firestore_result"
  | "firestore_error";

export interface AttendanceGasResponse {
  records: LegacyAttendanceRecord[];
  [key: string]: unknown;
}

export interface AttendanceShadowDiagnostic {
  attempted: boolean;
  code: AttendanceShadowDiagnosticCode;
  message: string;
  parity?: AttendanceParityResult;
  firestoreDurationMs?: number;
}

export interface AttendanceShadowReadResult<T extends AttendanceGasResponse> {
  response: T;
  diagnostic: AttendanceShadowDiagnostic;
}

export interface AttendanceShadowReadOptions<T extends AttendanceGasResponse> {
  enabled: boolean;
  explicitTestMode: boolean;
  params: Record<string, unknown>;
  gasReader(params: Record<string, unknown>): Promise<T>;
  firestoreReader(params: Record<string, unknown>): Promise<LegacyAttendanceRecord[]>;
  timeoutMs?: number;
  now?: () => number;
}

class AttendanceShadowTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AttendanceShadowTimeoutError(`Firestore shadow read exceeded ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function classifyError(error: unknown): AttendanceShadowDiagnosticCode {
  if (error instanceof AttendanceShadowTimeoutError) return "timeout";
  const candidate = error as { code?: unknown; message?: unknown };
  const value = `${String(candidate?.code ?? "")} ${String(candidate?.message ?? error ?? "")}`.toLowerCase();
  if (value.includes("permission-denied") || value.includes("permission_denied")) return "permission_denied";
  if (value.includes("unauthenticated")) return "unauthenticated";
  if (value.includes("unavailable")) return "unavailable";
  return "firestore_error";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function runAttendanceShadowRead<T extends AttendanceGasResponse>(
  options: AttendanceShadowReadOptions<T>
): Promise<AttendanceShadowReadResult<T>> {
  const response = await options.gasReader(options.params);
  if (!Array.isArray(response.records)) throw new Error("GAS attendance response records must be an array");

  if (!options.enabled) {
    return {
      response,
      diagnostic: { attempted: false, code: "disabled", message: "shadow read is disabled; GAS response returned unchanged" }
    };
  }
  if (!options.explicitTestMode) {
    return {
      response,
      diagnostic: { attempted: false, code: "not_explicit_test_mode", message: "shadow read requires explicit test mode; GAS response returned unchanged" }
    };
  }

  const timeoutMs = Math.max(100, Math.min(30_000, Number(options.timeoutMs || 5_000)));
  const now = options.now || Date.now;
  const startedAt = now();
  try {
    const firestoreRecords = await withTimeout(Promise.resolve(options.firestoreReader(options.params)), timeoutMs);
    const duration = Math.max(0, now() - startedAt);
    if (!Array.isArray(firestoreRecords)) {
      return {
        response,
        diagnostic: {
          attempted: true,
          code: "malformed_firestore_result",
          message: "Firestore shadow result is not an array; GAS response returned unchanged",
          firestoreDurationMs: duration
        }
      };
    }
    if (response.records.length > 0 && firestoreRecords.length === 0) {
      return {
        response,
        diagnostic: {
          attempted: true,
          code: "empty_firestore_result",
          message: "Firestore shadow result is empty while GAS returned records; GAS response returned unchanged",
          firestoreDurationMs: duration,
          parity: compareAttendanceParity(response.records, firestoreRecords)
        }
      };
    }

    const parity = compareAttendanceParity(response.records, firestoreRecords);
    if (parity.invalidRecords.some((item) => item.side === "firestore")) {
      return {
        response,
        diagnostic: {
          attempted: true,
          code: "malformed_firestore_result",
          message: "Firestore shadow result contains malformed attendance documents; GAS response returned unchanged",
          firestoreDurationMs: duration,
          parity
        }
      };
    }
    if (!parity.parityPass) {
      return {
        response,
        diagnostic: {
          attempted: true,
          code: "partial_or_mismatched_result",
          message: "Firestore shadow result differs from GAS; GAS response returned unchanged",
          firestoreDurationMs: duration,
          parity
        }
      };
    }
    return {
      response,
      diagnostic: {
        attempted: true,
        code: "match",
        message: "Firestore shadow result matches GAS; GAS response remains authoritative",
        firestoreDurationMs: duration,
        parity
      }
    };
  } catch (error) {
    return {
      response,
      diagnostic: {
        attempted: true,
        code: classifyError(error),
        message: `${errorMessage(error)}; GAS response returned unchanged`,
        firestoreDurationMs: Math.max(0, now() - startedAt)
      }
    };
  }
}
