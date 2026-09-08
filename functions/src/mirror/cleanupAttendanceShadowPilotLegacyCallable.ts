import { createHash } from "node:crypto";
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type Firestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
  type CallableRequest
} from "firebase-functions/v2/https";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import {
  ATTENDANCE_LEGACY_CLEANUP_VERSION,
  buildAttendanceLegacyCleanupPlan,
  canonicalCleanupScopes,
  type AttendanceLegacyCleanupPlan,
  type CleanupCandidate,
  type CleanupStoredDocument
} from "./attendanceLegacyCleanup.js";

export type AttendanceLegacyCleanupMode =
  | "dry_run"
  | "repair_assignments"
  | "archive"
  | "restore";

export interface AttendanceLegacyCleanupInput {
  requestId: string;
  mode: AttendanceLegacyCleanupMode;
  candidateDigest?: string;
  expectedCandidateCount?: number;
  cleanupBatchId?: string;
}

export interface AttendanceLegacyCleanupAuth {
  uid: string;
  role: string;
}

export interface AttendanceLegacyCleanupArchiveResult {
  cleanupBatchId: string;
  duplicate: boolean;
  archivedCount: number;
  attendanceArchived: number;
  assignmentsArchived: number;
  candidateDigest: string;
}

export interface AttendanceLegacyCleanupRestoreResult {
  cleanupBatchId: string;
  duplicate: boolean;
  restoredCount: number;
}

export interface AttendanceLegacyCleanupAssignmentRepairResult {
  assignmentRepairBatchId: string;
  duplicate: boolean;
  requestedCount: number;
  createdCount: number;
  existingCount: number;
  assignmentRepairDigest: string;
}

export interface AttendanceLegacyCleanupRepository {
  scan(): Promise<{
    attendance: CleanupStoredDocument[];
    assignments: CleanupStoredDocument[];
  }>;
  repairAssignments(
    requestId: string,
    plan: AttendanceLegacyCleanupPlan,
    authUid: string
  ): Promise<
    AttendanceLegacyCleanupAssignmentRepairResult
  >;
  archive(
    requestId: string,
    plan: AttendanceLegacyCleanupPlan,
    authUid: string
  ): Promise<AttendanceLegacyCleanupArchiveResult>;
  restore(
    requestId: string,
    cleanupBatchId: string,
    candidateDigest: string,
    authUid: string
  ): Promise<AttendanceLegacyCleanupRestoreResult>;
}

export interface AttendanceLegacyCleanupDeps {
  repository: AttendanceLegacyCleanupRepository;
}

export interface AttendanceLegacyCleanupResult {
  ok: true;
  version: string;
  mode: AttendanceLegacyCleanupMode;
  requestId: string;
  generatedAt: string;
  plan?: Omit<
    AttendanceLegacyCleanupPlan,
    "archiveCandidates" |
    "blockedCandidates"
  > & {
    archiveCandidates:
      Array<Omit<CleanupCandidate, "data">>;
    blockedCandidates:
      Array<Omit<CleanupCandidate, "data">>;
  };
  assignmentRepair?:
    AttendanceLegacyCleanupAssignmentRepairResult;
  archive?: AttendanceLegacyCleanupArchiveResult;
  restore?: AttendanceLegacyCleanupRestoreResult;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const BATCH_ID_PATTERN = /^phase3a_cleanup_[a-f0-9]{24}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

function text(value: unknown): string {
  return String(value ?? "").trim().normalize("NFC");
}

function requireSuperAdmin(
  auth: AttendanceLegacyCleanupAuth | undefined
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
      "legacy cleanup requires the superAdmin role"
    );
  }
}

function parseInput(data: unknown): AttendanceLegacyCleanupInput {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "cleanup input must be an object");
  }
  const input = data as Record<string, unknown>;
  const allowed = new Set([
    "requestId",
    "mode",
    "candidateDigest",
    "expectedCandidateCount",
    "cleanupBatchId"
  ]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      throw new HttpsError("invalid-argument", `unexpected cleanup field: ${key}`);
    }
  }
  const requestId = text(input.requestId);
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    throw new HttpsError("invalid-argument", "requestId format is invalid");
  }
  const mode = text(input.mode) as AttendanceLegacyCleanupMode;
  if (
    ![
      "dry_run",
      "repair_assignments",
      "archive",
      "restore"
    ].includes(mode)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "mode must be dry_run, repair_assignments, archive, or restore"
    );
  }
  const candidateDigest = text(input.candidateDigest);
  const cleanupBatchId = text(input.cleanupBatchId);
  const expectedCandidateCount = Number(input.expectedCandidateCount);

  if (
    mode === "archive" ||
    mode === "repair_assignments"
  ) {
    if (!DIGEST_PATTERN.test(candidateDigest)) {
      throw new HttpsError(
        "invalid-argument",
        `${mode} requires the exact dry-run digest`
      );
    }
    if (
      !Number.isInteger(
        expectedCandidateCount
      ) ||
      expectedCandidateCount < 1
    ) {
      throw new HttpsError(
        "invalid-argument",
        `${mode} requires expectedCandidateCount >= 1`
      );
    }
  }
  if (mode === "restore") {
    if (!BATCH_ID_PATTERN.test(cleanupBatchId)) {
      throw new HttpsError("invalid-argument", "restore cleanupBatchId format is invalid");
    }
    if (!DIGEST_PATTERN.test(candidateDigest)) {
      throw new HttpsError("invalid-argument", "restore requires the archived candidateDigest");
    }
  }
  return {
    requestId,
    mode,
    candidateDigest: candidateDigest || undefined,
    expectedCandidateCount: Number.isInteger(expectedCandidateCount)
      ? expectedCandidateCount
      : undefined,
    cleanupBatchId: cleanupBatchId || undefined
  };
}

function publicPlan(
  plan: AttendanceLegacyCleanupPlan
): AttendanceLegacyCleanupResult["plan"] {
  return {
    ...plan,
    archiveCandidates:
      plan.archiveCandidates.map(
        ({ data: _data, ...candidate }) =>
          candidate
      ),
    blockedCandidates:
      plan.blockedCandidates.map(
        ({ data: _data, ...candidate }) =>
          candidate
      )
  };
}

export async function handleAttendanceLegacyCleanup(
  data: unknown,
  auth: AttendanceLegacyCleanupAuth | undefined,
  deps: AttendanceLegacyCleanupDeps
): Promise<AttendanceLegacyCleanupResult> {
  requireSuperAdmin(auth);
  const input = parseInput(data);
  const generatedAt = new Date().toISOString();

  if (input.mode === "restore") {
    const restore = await deps.repository.restore(
      input.requestId,
      input.cleanupBatchId!,
      input.candidateDigest!,
      auth!.uid
    );
    return {
      ok: true,
      version: ATTENDANCE_LEGACY_CLEANUP_VERSION,
      mode: input.mode,
      requestId: input.requestId,
      generatedAt,
      restore
    };
  }

  const scanned = await deps.repository.scan();
  const plan = buildAttendanceLegacyCleanupPlan(
    scanned.attendance,
    scanned.assignments
  );

  if (input.mode === "dry_run") {
    return {
      ok: true,
      version: ATTENDANCE_LEGACY_CLEANUP_VERSION,
      mode: input.mode,
      requestId: input.requestId,
      generatedAt,
      plan: publicPlan(plan)
    };
  }

  if (
    input.mode === "repair_assignments"
  ) {
    if (!plan.safeToRepairAssignments) {
      throw new HttpsError(
        "failed-precondition",
        "assignment repair is not safe; resolve blocked attendance first"
      );
    }

    if (
      input.candidateDigest !==
      plan.assignmentRepairDigest
    ) {
      throw new HttpsError(
        "failed-precondition",
        "assignment repair candidates changed after dry run; run dry_run again"
      );
    }

    if (
      input.expectedCandidateCount !==
      plan.assignmentRepairCount
    ) {
      throw new HttpsError(
        "failed-precondition",
        "assignment repair candidate count changed after dry run"
      );
    }

    const assignmentRepair =
      await deps.repository
        .repairAssignments(
          input.requestId,
          plan,
          auth!.uid
        );

    return {
      ok: true,
      version:
        ATTENDANCE_LEGACY_CLEANUP_VERSION,
      mode: input.mode,
      requestId: input.requestId,
      generatedAt,
      plan: publicPlan(plan),
      assignmentRepair
    };
  }

  if (!plan.safeToArchive) {
    throw new HttpsError(
      "failed-precondition",
      `cleanup plan is not safe to archive: ${plan.warnings.join("; ")}`
    );
  }
  if (input.candidateDigest !== plan.candidateDigest) {
    throw new HttpsError(
      "failed-precondition",
      "cleanup candidates changed after dry run; run dry_run again"
    );
  }
  if (input.expectedCandidateCount !== plan.archiveCandidates.length) {
    throw new HttpsError(
      "failed-precondition",
      "cleanup candidate count changed after dry run; run dry_run again"
    );
  }

  const archive = await deps.repository.archive(
    input.requestId,
    plan,
    auth!.uid
  );
  return {
    ok: true,
    version: ATTENDANCE_LEGACY_CLEANUP_VERSION,
    mode: input.mode,
    requestId: input.requestId,
    generatedAt,
    plan: publicPlan(plan),
    archive
  };
}

function batchIdForRequest(requestId: string): string {
  const digest = createHash("sha256").update(requestId).digest("hex").slice(0, 24);
  return `phase3a_cleanup_${digest}`;
}

function assignmentRepairBatchIdForRequest(
  requestId: string
): string {
  const digest = createHash("sha256")
    .update(requestId)
    .digest("hex")
    .slice(0, 24);

  return `phase3a_assignment_repair_${digest}`;
}

function canonicalAssignmentTargetPath(
  sourcePath: string,
  canonicalClassId: string
): string {
  const parts = sourcePath.split("/");

  if (
    parts.length !== 4 ||
    parts[2] !== "classes"
  ) {
    throw new HttpsError(
      "failed-precondition",
      `invalid assignment path: ${sourcePath}`
    );
  }

  return [
    parts[0],
    parts[1],
    "classes",
    canonicalClassId
  ].join("/");
}

function cloneFirestoreData(data: DocumentData): Record<string, unknown> {
  return { ...data } as Record<string, unknown>;
}

class FirestoreAttendanceLegacyCleanupRepository
implements AttendanceLegacyCleanupRepository {
  constructor(private readonly db: Firestore) {}

  async scan(): Promise<{
    attendance: CleanupStoredDocument[];
    assignments: CleanupStoredDocument[];
  }> {
    const dates = [...new Set(
      canonicalCleanupScopes().flatMap((scope) => [...scope.sessionDates])
    )];
    const attendance: CleanupStoredDocument[] = [];
    for (const date of dates) {
      const snapshot = await this.db
        .collection("attendance")
        .where("sessionDate", "==", date)
        .get();
      for (const document of snapshot.docs) {
        attendance.push({
          path: document.ref.path,
          id: document.id,
          kind: "attendance",
          data: cloneFirestoreData(document.data())
        });
      }
    }

    const assignments: CleanupStoredDocument[] = [];
    const assignmentSnapshot = await this.db.collectionGroup("classes").get();
    for (const document of assignmentSnapshot.docs) {
      if (!/^(adminAssignments|teacherAssignments)\//.test(document.ref.path)) continue;
      assignments.push({
        path: document.ref.path,
        id: document.id,
        kind: "assignment",
        data: cloneFirestoreData(document.data())
      });
    }
    return { attendance, assignments };
  }

  async repairAssignments(
    requestId: string,
    plan: AttendanceLegacyCleanupPlan,
    authUid: string
  ): Promise<
    AttendanceLegacyCleanupAssignmentRepairResult
  > {
    const candidates =
      plan.blockedCandidates.filter(
        (candidate) =>
          candidate.kind === "assignment"
      );

    if (
      candidates.length !==
      plan.assignmentRepairCount
    ) {
      throw new HttpsError(
        "failed-precondition",
        "assignment repair candidate count is inconsistent"
      );
    }

    const assignmentRepairBatchId =
      assignmentRepairBatchIdForRequest(
        requestId
      );

    const manifestRef = this.db
      .collection(
        "cleanupAssignmentRepairBatches"
      )
      .doc(assignmentRepairBatchId);

    const existingManifest =
      await manifestRef.get();

    if (existingManifest.exists) {
      const data =
        existingManifest.data() || {};

      if (
        text(data.assignmentRepairDigest) !==
        plan.assignmentRepairDigest
      ) {
        throw new HttpsError(
          "already-exists",
          "assignment repair requestId was used for another candidate set"
        );
      }

      return {
        assignmentRepairBatchId,
        duplicate: true,
        requestedCount:
          Number(data.requestedCount || 0),
        createdCount:
          Number(data.createdCount || 0),
        existingCount:
          Number(data.existingCount || 0),
        assignmentRepairDigest:
          plan.assignmentRepairDigest
      };
    }

    const scopes =
      canonicalCleanupScopes();

    const repairs: Array<{
      candidate: CleanupCandidate;
      targetPath: string;
      targetExists: boolean;
      targetData?: DocumentData;
    }> = [];

    for (const candidate of candidates) {
      const sourceRef =
        this.db.doc(candidate.path);

      const source =
        await sourceRef.get();

      if (
        !source.exists ||
        source.data()?.active === false
      ) {
        throw new HttpsError(
          "failed-precondition",
          `assignment repair source changed: ${candidate.path}`
        );
      }

      const targetPath =
        canonicalAssignmentTargetPath(
          candidate.path,
          candidate.canonicalClassId
        );

      const target =
        await this.db
          .doc(targetPath)
          .get();

      if (target.exists) {
        const data = target.data() || {};

        if (
          text(data.classId) !==
            candidate.canonicalClassId ||
          text(data.pilotId) !==
            candidate.pilotId ||
          data.active === false
        ) {
          throw new HttpsError(
            "failed-precondition",
            `canonical assignment path is occupied by conflicting data: ${targetPath}`
          );
        }
      }

      repairs.push({
        candidate,
        targetPath,
        targetExists: target.exists,
        targetData: target.data()
      });
    }

    const batch = this.db.batch();
    const repairedAt =
      FieldValue.serverTimestamp();

    let createdCount = 0;
    let existingCount = 0;

    for (const repair of repairs) {
      const candidate = repair.candidate;
      const itemId = createHash("sha256")
        .update(candidate.path)
        .digest("hex")
        .slice(0, 40);

      batch.create(
        manifestRef
          .collection("items")
          .doc(itemId),
        {
          sourcePath: candidate.path,
          targetPath: repair.targetPath,
          pilotId: candidate.pilotId,
          currentClassId:
            candidate.currentClassId,
          canonicalClassId:
            candidate.canonicalClassId,
          targetAlreadyExisted:
            repair.targetExists,
          createdAt: repairedAt
        }
      );

      if (repair.targetExists) {
        existingCount += 1;
        continue;
      }

      const scope = scopes.find(
        (item) =>
          item.pilotId ===
          candidate.pilotId
      );

      if (!scope) {
        throw new HttpsError(
          "failed-precondition",
          `canonical cleanup scope not found: ${candidate.pilotId}`
        );
      }

      batch.create(
        this.db.doc(repair.targetPath),
        {
          ...candidate.data,
          classId:
            candidate.canonicalClassId,
          canonicalClassId:
            candidate.canonicalClassId,
          pilotId:
            candidate.pilotId,
          className:
            scope.className,
          active: true,
          readAllowed: true,
          archived: false,
          source:
            "phase3a_cleanup_assignment_repair",
          migratedFromClassId:
            candidate.currentClassId,
          migratedFromPath:
            candidate.path,
          assignmentRepairBatchId,
          repairedBy: authUid,
          createdAt: repairedAt,
          updatedAt: repairedAt
        }
      );

      createdCount += 1;
    }

    batch.create(
      manifestRef,
      {
        version:
          ATTENDANCE_LEGACY_CLEANUP_VERSION,
        requestId,
        status: "repaired",
        assignmentRepairDigest:
          plan.assignmentRepairDigest,
        requestedCount:
          candidates.length,
        createdCount,
        existingCount,
        repairedAt,
        repairedBy: authUid
      }
    );

    await batch.commit();

    return {
      assignmentRepairBatchId,
      duplicate: false,
      requestedCount:
        candidates.length,
      createdCount,
      existingCount,
      assignmentRepairDigest:
        plan.assignmentRepairDigest
    };
  }

  async archive(
    requestId: string,
    plan: AttendanceLegacyCleanupPlan,
    authUid: string
  ): Promise<AttendanceLegacyCleanupArchiveResult> {
    const cleanupBatchId = batchIdForRequest(requestId);
    const manifestRef = this.db.collection("cleanupBatches").doc(cleanupBatchId);
    const existing = await manifestRef.get();
    if (existing.exists) {
      const data = existing.data() || {};
      if (text(data.candidateDigest) !== plan.candidateDigest) {
        throw new HttpsError("already-exists", "cleanup requestId was used for another candidate set");
      }
      return {
        cleanupBatchId,
        duplicate: true,
        archivedCount: Number(data.archivedCount || 0),
        attendanceArchived: Number(data.attendanceArchived || 0),
        assignmentsArchived: Number(data.assignmentsArchived || 0),
        candidateDigest: plan.candidateDigest
      };
    }

    const batch = this.db.batch();
    const archivedAt = FieldValue.serverTimestamp();
    for (const candidate of plan.archiveCandidates) {
      const targetRef = this.db.doc(candidate.path);
      const backupId = createHash("sha256").update(candidate.path).digest("hex").slice(0, 40);
      const backupRef = manifestRef.collection("items").doc(backupId);
      batch.create(backupRef, {
        targetPath: candidate.path,
        kind: candidate.kind,
        pilotId: candidate.pilotId,
        currentClassId: candidate.currentClassId,
        canonicalClassId: candidate.canonicalClassId,
        reasons: [...candidate.reasons],
        originalData: candidate.data,
        createdAt: archivedAt
      });
      batch.set(targetRef, {
        active: false,
        archived: true,
        cleanupBatchId,
        cleanupCandidateDigest: plan.candidateDigest,
        archiveReason: candidate.reasons.join(","),
        canonicalClassId: candidate.canonicalClassId,
        archivedAt,
        archivedBy: authUid,
        ...(candidate.kind === "assignment" ? { readAllowed: false } : {})
      }, { merge: true });
    }

    const attendanceArchived = plan.archiveCandidates.filter((item) => item.kind === "attendance").length;
    const assignmentsArchived = plan.archiveCandidates.length - attendanceArchived;
    batch.create(manifestRef, {
      version: ATTENDANCE_LEGACY_CLEANUP_VERSION,
      requestId,
      status: "archived",
      candidateDigest: plan.candidateDigest,
      archivedCount: plan.archiveCandidates.length,
      attendanceArchived,
      assignmentsArchived,
      canonicalScopes: plan.canonicalScopes,
      archivedAt,
      archivedBy: authUid
    });
    await batch.commit();
    return {
      cleanupBatchId,
      duplicate: false,
      archivedCount: plan.archiveCandidates.length,
      attendanceArchived,
      assignmentsArchived,
      candidateDigest: plan.candidateDigest
    };
  }

  async restore(
    _requestId: string,
    cleanupBatchId: string,
    candidateDigest: string,
    authUid: string
  ): Promise<AttendanceLegacyCleanupRestoreResult> {
    const manifestRef = this.db.collection("cleanupBatches").doc(cleanupBatchId);
    const manifest = await manifestRef.get();
    if (!manifest.exists) {
      throw new HttpsError("not-found", "cleanup batch was not found");
    }
    const manifestData = manifest.data() || {};
    if (text(manifestData.candidateDigest) !== candidateDigest) {
      throw new HttpsError("failed-precondition", "restore candidateDigest does not match the cleanup batch");
    }
    if (text(manifestData.status) === "restored") {
      return {
        cleanupBatchId,
        duplicate: true,
        restoredCount: Number(manifestData.restoredCount || manifestData.archivedCount || 0)
      };
    }

    const items = await manifestRef.collection("items").get();
    if (items.empty) {
      throw new HttpsError("failed-precondition", "cleanup batch has no backup items");
    }
    const batch = this.db.batch();
    for (const item of items.docs) {
      const data = item.data();
      const targetPath = text(data.targetPath);
      const originalData = data.originalData;
      if (!targetPath || !originalData || typeof originalData !== "object" || Array.isArray(originalData)) {
        throw new HttpsError("failed-precondition", `cleanup backup item ${item.id} is invalid`);
      }
      const targetRef = this.db.doc(targetPath);
      const current = await targetRef.get();
      if (!current.exists || text(current.data()?.cleanupBatchId) !== cleanupBatchId) {
        throw new HttpsError(
          "failed-precondition",
          `cleanup target changed after archive: ${targetPath}`
        );
      }
      batch.set(targetRef, originalData as DocumentData);
      batch.set(item.ref, {
        restoredAt: FieldValue.serverTimestamp(),
        restoredBy: authUid
      }, { merge: true });
    }
    batch.set(manifestRef, {
      status: "restored",
      restoredCount: items.size,
      restoredAt: FieldValue.serverTimestamp(),
      restoredBy: authUid
    }, { merge: true });
    await batch.commit();
    return {
      cleanupBatchId,
      duplicate: false,
      restoredCount: items.size
    };
  }
}

export const cleanupAttendanceShadowPilotLegacyCallable = onCall(
  {
    region: ULIM_FUNCTION_REGION,
    timeoutSeconds: 120,
    memory: "512MiB",
    maxInstances: 1
  },
  async (request: CallableRequest<unknown>) => {
    const app = getOrInitializeDefaultFirebaseAdminApp();
    const db = getFirestore(app);
    const role = text(request.auth?.token?.role);
    return handleAttendanceLegacyCleanup(
      request.data,
      request.auth ? { uid: request.auth.uid, role } : undefined,
      { repository: new FirestoreAttendanceLegacyCleanupRepository(db) }
    );
  }
);
