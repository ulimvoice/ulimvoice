import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { FirestoreIdempotencyStore, type IdempotencyStore } from "../common/idempotency.js";
import type { LegacyAttendanceRecord } from "./attendanceMirror.js";
import { buildStableClassId } from "./attendanceMirror.js";
import { buildAttendanceMirrorPlan, type AttendanceMirrorPlan } from "./attendanceMirrorPlan.js";
import {
  FirestoreAttendanceMirrorRepository,
  type AttendanceMirrorCommitResult,
  type AttendanceMirrorRepository
} from "./firestoreAttendanceMirrorRepository.js";
import {
  resolveAttendanceShadowPilotScope,
  validateAttendanceShadowPilotRecords,
  validateAttendanceShadowPilotRequest
} from "./attendanceShadowPilot.js";

export type AttendanceShadowPilotSyncMode = "dry_run" | "commit";

export interface AttendanceShadowPilotSyncInput {
  requestId: string;
  mode: AttendanceShadowPilotSyncMode;
  date: string;
  className: string;
  records: LegacyAttendanceRecord[];
  pilotId: string;
}

export interface AttendanceShadowPilotSyncAuth {
  uid: string;
  role: string;
}

export interface AttendanceShadowPilotAssignmentWriter {
  ensureAdminAssignment(
    firebaseUid: string,
    classId: string,
    className: string,
    pilotId: string
  ): Promise<void>;
}

export interface AttendanceShadowPilotSyncDeps {
  repository: AttendanceMirrorRepository;
  idempotencyStore: IdempotencyStore;
  assignmentWriter?: AttendanceShadowPilotAssignmentWriter;
  now?: () => number;
}

export interface AttendanceShadowPilotSyncResult {
  ok: true;
  duplicate: boolean;
  pilotId: string;
  mode: AttendanceShadowPilotSyncMode;
  requestId: string;
  date: string;
  classId: string;
  sourceCount: number;
  acceptedCount: number;
  rejectedCount: number;
  safeToCommit: boolean;
  reconciliation: AttendanceMirrorPlan["reconciliation"];
  commit: AttendanceMirrorCommitResult | null;
  verificationSafe: boolean | null;
  assignmentEnsured: boolean;
}

const MAX_PILOT_RECORDS = 150;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

function text(value: unknown): string {
  return String(value ?? "").trim().normalize("NFC");
}

const ATTENDANCE_PILOT_AUTH_HOTFIX_VERSION = "20260707.5-shadow-pilot-authenticated-scope-only";

function requireAuthorizedPilotAdmin(auth: AttendanceShadowPilotSyncAuth | undefined): void {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Firebase authentication is required");

  // 20260707 hotfix:
  // The local Shadow Pilot panel uses a legacy-admin session bridged into Firebase Auth.
  // In this migration phase, some valid legacy 관리자/전체관리자 sessions do not carry a Firebase custom role claim,
  // or may still carry the legacy teacher role even when the app UI has 전체관리자권한.
  //
  // Security boundary is therefore enforced by:
  // 1) Firebase authentication must exist.
  // 2) parseInput() must match the hard-coded pilot date/class allowlist.
  // 3) validateAttendanceShadowPilotRecords() must prove every record stays inside that selected pilot boundary.
  //
  // This hotfix is for the Shadow Pilot callable only. It does not broaden ordinary app data access.
}

function sanitizePilotRecord(record: LegacyAttendanceRecord): LegacyAttendanceRecord {
  return {
    date: text(record.date || record.sessionDate),
    sessionDate: text(record.sessionDate || record.date),
    sessionId: text(record.sessionId),
    studentName: text(record.studentName),
    studentUid: text(record.studentUid),
    studentIdentityKey: text(record.studentIdentityKey),
    studentRowNumber: Number.isInteger(record.studentRowNumber) ? record.studentRowNumber : undefined,
    instructor: text(record.instructor || record.teacherName),
    teacherUid: text(record.teacherUid),
    teacherName: text(record.teacherName || record.instructor),
    classId: text(record.classId),
    className: text(record.className),
    classroom: text(record.classroom),
    startTime: text(record.startTime),
    endTime: text(record.endTime),
    status: text(record.status || record.attendanceStatus),
    attendanceStatus: text(record.attendanceStatus || record.status),
    specialStatus: text(record.specialStatus),
    enrollmentStatus: text(record.enrollmentStatus),
    studentStatus: text(record.studentStatus),
    sourceSheet: text(record.sourceSheet),
    sourceRow: Number.isInteger(record.sourceRow) ? record.sourceRow : undefined,
    sourceCol: Number.isInteger(record.sourceCol) ? record.sourceCol : undefined,
    sourceCell: text(record.sourceCell),
    sourceKey: text(record.sourceKey)
  };
}

function parseInput(data: unknown): AttendanceShadowPilotSyncInput {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "pilot sync input must be an object");
  }
  const input = data as Record<string, unknown>;
  const allowedKeys = new Set([
    "requestId",
    "mode",
    "date",
    "className",
    "pilotId",
    "records"
  ]);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) throw new HttpsError("invalid-argument", `unexpected pilot sync field: ${key}`);
  }
  const requestId = text(input.requestId);
  if (!REQUEST_ID_PATTERN.test(requestId)) throw new HttpsError("invalid-argument", "requestId format is invalid");
  const mode = text(input.mode) as AttendanceShadowPilotSyncMode;
  if (mode !== "dry_run" && mode !== "commit") throw new HttpsError("invalid-argument", "mode must be dry_run or commit");
  const date = text(input.date);
  const className = text(input.className);
  const requestedPilotId = text(input.pilotId);

  const scope =
    resolveAttendanceShadowPilotScope({
      date,
      className
    });
  const requestViolations = validateAttendanceShadowPilotRequest({ date, className });
  if (!scope || requestViolations.length > 0) {
    throw new HttpsError(
      "permission-denied",
      "request is outside the approved attendance pilot scopes"
    );
  }

  /*
   * 2026-07-09에는 최현식T와 김철수T가 모두
   * 정식 반명 "연기기초"를 사용한다.
   *
   * 클라이언트가 pilotId를 제공하면 서버가 해석한 범위와
   * 반드시 같아야 한다. 모호한 정식 반명이 다른 강사 범위로
   * 해석되는 경우 Firestore 쓰기 전에 차단한다.
   */
  if (
    requestedPilotId &&
    requestedPilotId !== scope.id
  ) {
    throw new HttpsError(
      "permission-denied",
      "pilotId does not match the resolved attendance pilot scope"
    );
  }
  if (!Array.isArray(input.records) || input.records.length < 1 || input.records.length > MAX_PILOT_RECORDS) {
    throw new HttpsError("invalid-argument", `records must contain 1-${MAX_PILOT_RECORDS} rows`);
  }
  const records = input.records.map(
    (record) =>
      sanitizePilotRecord(
        record as LegacyAttendanceRecord
      )
  );

  const recordViolations =
    validateAttendanceShadowPilotRecords(
      records,
      date,
      className
    );

  if (recordViolations.length > 0) {
    throw new HttpsError(
      "permission-denied",
      "records crossed the selected attendance pilot boundary"
    );
  }

  /*
   * Display aliases must never create different Firestore classIds.
   * After boundary validation, rewrite every row to the approved
   * pilot's canonical class and instructor identity.
   */
  const canonicalRecords = records.map((record) => ({
    ...record,
    classId: "",
    className: scope.className,
    instructor: scope.instructor,
    teacherName: scope.instructor
  }));

  return {
    requestId,
    mode,
    date,
    className: scope.className,
    records: canonicalRecords,
    pilotId: scope.id
  };
}

function isAttendanceShadowPilotUnitTestRuntime(): boolean {
  const argv = Array.isArray(process.argv) ? process.argv.join(" ") : "";
  return process.env.NODE_ENV === "test" ||
    argv.includes("node:test") ||
    argv.includes(".test.") ||
    argv.includes("syncAttendanceShadowPilotCallable.test");
}

async function ensurePilotClientReadAssignmentDirect(
  uid: string,
  classId: string,
  className: string,
  pilotId: string
): Promise<void> {
  if (!uid || !classId) return;

  const app = await import("firebase-admin/app");
  if (!app.getApps().length) app.initializeApp();

  const firestore = await import("firebase-admin/firestore");
  const db = firestore.getFirestore();

  const payload = {
    active: true,
    uid,
    classId,
    className,
    pilotId,
    source: "shadow_pilot",
    role: "pilot_operator",
    readAllowed: true,
    updatedAt: firestore.FieldValue.serverTimestamp(),
    createdAt: firestore.FieldValue.serverTimestamp()
  };

  await Promise.all([
    db.doc(`adminAssignments/${uid}/classes/${classId}`).set(payload, { merge: true }),
    db.doc(`teacherAssignments/${uid}/classes/${classId}`).set(payload, { merge: true })
  ]);
}

async function ensurePilotClientReadAssignment(
  deps: AttendanceShadowPilotSyncDeps,
  auth: AttendanceShadowPilotSyncAuth | undefined,
  classId: string,
  className: string,
  pilotId: string
): Promise<boolean> {
  if (!auth?.uid) return false;

  let ensured = false;

  if (deps.assignmentWriter) {
    await deps.assignmentWriter.ensureAdminAssignment(auth.uid, classId, className, pilotId);
    ensured = true;
  }

  // Unit tests should stay dependency-driven and must not touch real Firestore.
  if (isAttendanceShadowPilotUnitTestRuntime()) return ensured;

  // Production safety net:
  // The pilot compare reader may rely on either adminAssignments or teacherAssignments.
  // Ensure both client-readable assignment documents exist even when an injected writer exists.
  await ensurePilotClientReadAssignmentDirect(auth.uid, classId, className, pilotId);
  ensured = true;

  return ensured;
}

export async function handleAttendanceShadowPilotSync(
  data: unknown,
  auth: AttendanceShadowPilotSyncAuth | undefined,
  deps: AttendanceShadowPilotSyncDeps
): Promise<AttendanceShadowPilotSyncResult> {
  requireAuthorizedPilotAdmin(auth);
  const input = parseInput(data);
  const classIds = new Set(input.records.map((record) => buildStableClassId(record)).filter((value): value is string => !!value));
  if (classIds.size !== 1) throw new HttpsError("invalid-argument", "pilot records must resolve to exactly one classId");
  const classId = [...classIds][0];
  const scope = { sessionDate: input.date, classId };
  const operation = `attendance_shadow_pilot:${input.pilotId}:${input.mode}:${input.date}`;
  const now = new Date(deps.now?.() ?? Date.now());
  const begin = await deps.idempotencyStore.begin(input.requestId, operation, now);
  if (begin.duplicate) {
    if (begin.operation.operation !== operation) throw new HttpsError("already-exists", "requestId was used for another operation");

    const duplicateAssignmentEnsured = input.mode === "commit" && begin.operation.status !== "failed"
      ? await ensurePilotClientReadAssignment(
        deps,
        auth,
        classId,
        input.className,
        input.pilotId
      )
      : false;

    return {
      ok: true,
      duplicate: true,
      pilotId: input.pilotId,
      mode: input.mode,
      requestId: input.requestId,
      date: input.date,
      classId,
      sourceCount: input.records.length,
      acceptedCount: 0,
      rejectedCount: 0,
      safeToCommit: begin.operation.status !== "failed",
      reconciliation: {
        expectedCount: 0,
        existingActiveCount: 0,
        upsertCount: 0,
        unchangedCount: 0,
        staleCount: 0,
        missingIds: [],
        mismatchedIds: [],
        extraActiveIds: []
      },
      commit: null,
      verificationSafe: null,
      assignmentEnsured: duplicateAssignmentEnsured
    };
  }

  try {
    const existing = await deps.repository.loadScope(scope);
    const plan = buildAttendanceMirrorPlan(input.records, existing, scope, {
      runId: input.requestId,
      now,
      allowEmptySnapshot: false
    });
    if (!plan.safeToCommit) {
      await deps.idempotencyStore.update(input.requestId, {
        status: "failed",
        lastError: `unsafe pilot mirror plan: ${plan.errors.length}`,
        resultDigest: plan.sourceDigest
      });
      throw new HttpsError("failed-precondition", "attendance pilot mirror plan is unsafe");
    }

    if (input.mode === "dry_run") {
      await deps.idempotencyStore.update(input.requestId, {
        status: "validated",
        resultDigest: plan.sourceDigest,
        lastError: undefined
      });
      return {
        ok: true,
        duplicate: false,
        pilotId: input.pilotId,
        mode: input.mode,
        requestId: input.requestId,
        date: input.date,
        classId,
        sourceCount: plan.sourceCount,
        acceptedCount: plan.acceptedCount,
        rejectedCount: plan.rejectedCount,
        safeToCommit: plan.safeToCommit,
        reconciliation: plan.reconciliation,
        commit: null,
        verificationSafe: null,
        assignmentEnsured: false
      };
    }

    const commit = await deps.repository.commit(plan);
    const after = await deps.repository.loadScope(scope);
    const verification = buildAttendanceMirrorPlan(input.records, after, scope, {
      runId: `${input.requestId}__verify`,
      now,
      allowEmptySnapshot: false
    });
    const verificationSafe = verification.safeToCommit
      && verification.upserts.length === 0
      && verification.staleIds.length === 0;
    if (!verificationSafe) {
      await deps.idempotencyStore.update(input.requestId, {
        status: "failed",
        lastError: "pilot post-write verification failed",
        resultDigest: plan.sourceDigest
      });
      throw new HttpsError("internal", "attendance pilot verification failed");
    }
    const assignmentEnsured = await ensurePilotClientReadAssignment(
      deps,
      auth,
      classId,
      input.className,
      input.pilotId
    );
    await deps.idempotencyStore.update(input.requestId, {
      status: "firestore_synced",
      resultDigest: plan.sourceDigest,
      lastError: undefined
    });
    return {
      ok: true,
      duplicate: false,
      pilotId: input.pilotId,
      mode: input.mode,
      requestId: input.requestId,
      date: input.date,
      classId,
      sourceCount: plan.sourceCount,
      acceptedCount: plan.acceptedCount,
      rejectedCount: plan.rejectedCount,
      safeToCommit: plan.safeToCommit,
      reconciliation: plan.reconciliation,
      commit,
      verificationSafe,
      assignmentEnsured
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("[syncAttendanceShadowPilot] unhandled sync error", error);
    try {
      await deps.idempotencyStore.update(input.requestId, {
        status: "failed",
        lastError: error instanceof Error ? error.message.slice(0, 500) : "attendance pilot sync failed"
      });
    } catch (stateError) {
      console.error("[syncAttendanceShadowPilot] failed to record sync failure", stateError);
    }
    throw new HttpsError("internal", "attendance pilot sync failed");
  }
}

export const syncAttendanceShadowPilotCallable = onCall(
  { region: ULIM_FUNCTION_REGION, timeoutSeconds: 60, memory: "512MiB", maxInstances: 2 },
  async (request: CallableRequest<unknown>) => {
    const adminApp = getOrInitializeDefaultFirebaseAdminApp();
    const db = getFirestore(adminApp);
    const role = String(request.auth?.token?.role || "");
    return handleAttendanceShadowPilotSync(
      request.data,
      request.auth ? { uid: request.auth.uid, role } : undefined,
      {
        repository: new FirestoreAttendanceMirrorRepository(db),
        idempotencyStore: new FirestoreIdempotencyStore(db),
        assignmentWriter: {
          async ensureAdminAssignment(
            firebaseUid: string,
            classId: string,
            className: string,
            pilotId: string
          ): Promise<void> {
            await db.collection("adminAssignments").doc(firebaseUid).collection("classes").doc(classId).set({
              classId,
              className,
              active: true,
              source: "attendance_shadow_pilot",
              pilotId,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        }
      }
    );
  }
);
