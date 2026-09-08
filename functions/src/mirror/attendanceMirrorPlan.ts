import { createHash } from "node:crypto";
import {
  mirrorWebAttendanceRows,
  type AttendanceMirrorDocument,
  type AttendanceMirrorError,
  type LegacyAttendanceRecord
} from "./attendanceMirror.js";
import { auditAttendanceMirrorPrivacy } from "./attendancePrivacy.js";

export const ATTENDANCE_MIRROR_VERSION = 1 as const;

export interface AttendanceMirrorScope {
  sessionDate: string;
  classId?: string;
}

export interface StoredAttendanceMirrorDocument extends AttendanceMirrorDocument {
  active: boolean;
  mirrorVersion: typeof ATTENDANCE_MIRROR_VERSION;
  mirrorRunId: string;
  scopeKey: string;
  payloadDigest: string;
  syncedAt: string;
  staleAt?: string;
}

export interface AttendanceMirrorPlanError {
  code: "conversion_error" | "sensitive_field" | "scope_mismatch" | "duplicate_document_id" | "suspicious_empty_snapshot";
  message: string;
  record?: LegacyAttendanceRecord;
  documentId?: string;
}

export interface AttendanceMirrorReconciliation {
  expectedCount: number;
  existingActiveCount: number;
  upsertCount: number;
  unchangedCount: number;
  staleCount: number;
  missingIds: string[];
  mismatchedIds: string[];
  extraActiveIds: string[];
}

export interface AttendanceMirrorPlan {
  scope: AttendanceMirrorScope;
  scopeKey: string;
  runId: string;
  sourceDigest: string;
  sourceCount: number;
  acceptedCount: number;
  rejectedCount: number;
  upserts: StoredAttendanceMirrorDocument[];
  unchangedIds: string[];
  staleIds: string[];
  conversionErrors: AttendanceMirrorError[];
  errors: AttendanceMirrorPlanError[];
  reconciliation: AttendanceMirrorReconciliation;
  safeToCommit: boolean;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeAttendanceMirrorScope(scope: AttendanceMirrorScope): AttendanceMirrorScope {
  const sessionDate = clean(scope.sessionDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) throw new Error("attendance mirror scope sessionDate must be YYYY-MM-DD");
  const classId = clean(scope.classId);
  return classId ? { sessionDate, classId } : { sessionDate };
}

export function attendanceMirrorScopeKey(scope: AttendanceMirrorScope): string {
  const normalized = normalizeAttendanceMirrorScope(scope);
  return normalized.classId
    ? `date_${normalized.sessionDate}__class_${normalized.classId}`.replace(/[^\w.-]+/g, "_")
    : `date_${normalized.sessionDate}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    return Object.keys(input)
      .sort()
      .reduce<Record<string, unknown>>((out, key) => {
        const next = input[key];
        if (next !== undefined) out[key] = canonicalize(next);
        return out;
      }, {});
  }
  return value;
}

export function attendancePayloadForDigest(document: AttendanceMirrorDocument): Record<string, unknown> {
  return {
    id: document.id,
    sessionId: document.sessionId,
    sessionDate: document.sessionDate,
    classId: document.classId,
    className: document.className,
    sessionStartTime: document.sessionStartTime,
    sessionEndTime: document.sessionEndTime,
    attendanceBlockId: document.attendanceBlockId,
    studentUid: document.studentUid,
    studentIdentityKey: document.studentIdentityKey,
    studentNo: document.studentNo,
    studentRowNumber: document.studentRowNumber,
    studentName: document.studentName,
    instructor: document.instructor,
    teacherUid: document.teacherUid,
    teacherName: document.teacherName,
    classroom: document.classroom,
    status: document.status,
    uiStatus: document.uiStatus,
    specialStatus: document.specialStatus,
    enrollmentStatus: document.enrollmentStatus,
    studentStatus: document.studentStatus,
    memo: document.memo,
    legacy: document.legacy
  };
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export function attendancePayloadDigest(document: AttendanceMirrorDocument): string {
  return sha256Canonical(attendancePayloadForDigest(document));
}

export function buildAttendanceMirrorRunId(scope: AttendanceMirrorScope, now = new Date()): string {
  const key = attendanceMirrorScopeKey(scope);
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "");
  return `${key}__${stamp}`;
}

function existingDigest(document: StoredAttendanceMirrorDocument): string {
  /*
   * Stored payloadDigest can be stale. Recompute from real fields.
   */
  return attendancePayloadDigest(document);
}

export function buildAttendanceMirrorPlan(
  rows: LegacyAttendanceRecord[],
  existing: StoredAttendanceMirrorDocument[],
  scopeInput: AttendanceMirrorScope,
  options: { runId?: string; now?: Date; allowEmptySnapshot?: boolean } = {}
): AttendanceMirrorPlan {
  const scope = normalizeAttendanceMirrorScope(scopeInput);
  const scopeKey = attendanceMirrorScopeKey(scope);
  const now = options.now ?? new Date();
  const runId = clean(options.runId) || buildAttendanceMirrorRunId(scope, now);
  const conversion = mirrorWebAttendanceRows(rows, now);
  const errors: AttendanceMirrorPlanError[] = conversion.errors.map((error) => ({
    code: "conversion_error",
    message: error.message,
    record: error.record
  }));
  for (const violation of auditAttendanceMirrorPrivacy(conversion.documents)) {
    errors.push({
      code: "sensitive_field",
      message: `${violation.reason}: ${violation.path}`
    });
  }

  const existingActiveCount = existing.filter((document) => document.active === true).length;
  if (rows.length === 0 && existingActiveCount > 0 && options.allowEmptySnapshot !== true) {
    errors.push({
      code: "suspicious_empty_snapshot",
      message: `authoritative attendance snapshot is empty while ${existingActiveCount} active mirror document(s) exist; explicit allowEmptySnapshot is required`
    });
  }

  const expectedById = new Map<string, StoredAttendanceMirrorDocument>();
  for (const document of conversion.documents) {
    if (document.sessionDate !== scope.sessionDate || (scope.classId && document.classId !== scope.classId)) {
      errors.push({
        code: "scope_mismatch",
        message: `attendance document ${document.id} is outside mirror scope ${scopeKey}`,
        documentId: document.id
      });
      continue;
    }
    if (expectedById.has(document.id)) {
      errors.push({
        code: "duplicate_document_id",
        message: `duplicate attendance document id: ${document.id}`,
        documentId: document.id
      });
      continue;
    }
    const payloadDigest = attendancePayloadDigest(document);
    expectedById.set(document.id, {
      ...document,
      active: true,
      mirrorVersion: ATTENDANCE_MIRROR_VERSION,
      mirrorRunId: runId,
      scopeKey,
      payloadDigest,
      syncedAt: now.toISOString()
    });
  }

  const existingById = new Map(existing.map((document) => [document.id, document]));
  const upserts: StoredAttendanceMirrorDocument[] = [];
  const unchangedIds: string[] = [];
  const missingIds: string[] = [];
  const mismatchedIds: string[] = [];

  for (const [id, document] of expectedById) {
    const current = existingById.get(id);
    if (!current) {
      missingIds.push(id);
      upserts.push(document);
      continue;
    }
    if (current.active !== true || existingDigest(current) !== document.payloadDigest) {
      mismatchedIds.push(id);
      upserts.push(document);
      continue;
    }
    unchangedIds.push(id);
  }

  const staleIds = existing
    .filter((document) => document.active === true && !expectedById.has(document.id))
    .map((document) => document.id)
    .sort();

  const sourceDigest = sha256Canonical(
    Array.from(expectedById.values())
      .map((document) => [document.id, document.payloadDigest])
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
  );

  const reconciliation: AttendanceMirrorReconciliation = {
    expectedCount: expectedById.size,
    existingActiveCount,
    upsertCount: upserts.length,
    unchangedCount: unchangedIds.length,
    staleCount: staleIds.length,
    missingIds: missingIds.sort(),
    mismatchedIds: mismatchedIds.sort(),
    extraActiveIds: staleIds
  };

  return {
    scope,
    scopeKey,
    runId,
    sourceDigest,
    sourceCount: rows.length,
    acceptedCount: expectedById.size,
    rejectedCount: errors.length,
    upserts,
    unchangedIds: unchangedIds.sort(),
    staleIds,
    conversionErrors: conversion.errors,
    errors,
    reconciliation,
    safeToCommit: errors.length === 0
  };
}
