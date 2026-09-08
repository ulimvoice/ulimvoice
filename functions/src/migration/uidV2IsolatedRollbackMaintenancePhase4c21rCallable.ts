import { createHash, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { App, getApp, getApps, initializeApp } from "firebase-admin/app";
import {
  DocumentData,
  DocumentReference,
  Firestore,
  getFirestore
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

export const UID_V2_ISOLATED_ROLLBACK_MAINTENANCE_PHASE4C21R_VERSION =
  "2026-07-28.716.75-phase4c21r-isolated-rollback-persistence-maintenance-state-machine-rehearsal-only";

const REGION = "asia-northeast3";
const REQUEST_ID = "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";
const CONTRACT_DIGEST = "cfce476628ac743dea914e8b69e6d31beab043e13abbea32e484972fdfe2dad6";
const EXPECTED_PHASE4C20_CONTRACT_DIGEST = "360fec0965fbf74c89632effde291b3493c67e2256ada84a8beb110a4ac3ef45";
const EXPECTED_PHASE4C20_DESIGN_DIGEST = "48d2aeae006fb1f86fabf8501a53030d5ed9616a5663eb049ab9cb1da52d6939";
const EXPECTED_PHASE4C19_CONTRACT_DIGEST = "0bda4550515b1365ec3f727ad79d597b94cab52a0d1da189098f0367832304d3";
const EXPECTED_PHASE4C19_RESULT_DIGEST = "db00be2f2e15a973589b5e7f01e39e6bd853c3decbf3e1b7d1e48fff5179673a";
const EXPECTED_FRESH_ROLLBACK_DIGEST = "5bed375c09f83bad83c62135f5c9a34acc786b8778c86a897564f8d7d6d041f6";
const EXPECTED_APPROVAL_TOKEN_DIGEST = "9bd8d4c752ef40d0333cc84bb95b19dfb3d1fb0f17aa1d0e2a8fb78a3bce0253";

const SYNTHETIC_CANONICAL_BYTES = 230370;
const MAXIMUM_SNAPSHOT_BYTES = 8000000;
const MAXIMUM_CHUNK_BYTES = 700000;
const EXPECTED_CHUNK_COUNT = 1;
const EXPECTED_TOTAL_ISOLATED_WRITES = 22;
const NEXT_GATE_PHASE =
  "Phase 4C-22R production maintenance and rollback-snapshot execution package assembly only";

type GenericRecord = Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmSyntheticPayloadOnly?: unknown;
  readonly confirmIsolatedPersistenceOnly?: unknown;
  readonly confirmProductionWritesZero?: unknown;
  readonly confirmNoCutoverExecution?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
}

interface BuiltContext {
  readonly db: Firestore;
  readonly runRef: DocumentReference<DocumentData>;
  readonly resultRef: DocumentReference<DocumentData>;
  readonly callerUid: string;
  readonly chainChecks: GenericRecord;
  readonly blockingReasons: string[];
}

interface RehearsalRefs {
  readonly lockRef: DocumentReference<DocumentData>;
  readonly maintenanceRef: DocumentReference<DocumentData>;
  readonly snapshotRef: DocumentReference<DocumentData>;
  readonly chunkRef: DocumentReference<DocumentData>;
  readonly verificationRef: DocumentReference<DocumentData>;
}

interface SyntheticPayload {
  readonly canonicalText: string;
  readonly canonicalBytes: number;
  readonly compressed: Buffer;
  readonly compressedBytes: number;
  readonly encoded: string;
  readonly encodedBytes: number;
  readonly chunks: string[];
  readonly chunkDigests: string[];
  readonly rawCanonicalSha256: string;
  readonly compressedSha256: string;
}

function defaultAdminApp(): App {
  const current = getApps().find((app: App) => app.name === "[DEFAULT]");
  return current ? getApp() : initializeApp();
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function asRecord(value: unknown, label: string): GenericRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("failed-precondition", `${label} must be an object.`);
  }
  return value as GenericRecord;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new HttpsError("failed-precondition", `${label} must be an array.`);
  }
  return value;
}

function requireSuperAdmin(
  auth: { uid: string; token: GenericRecord } | undefined
): string {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Firebase authentication is required.");
  }
  const roles = strings(auth.token.roles);
  const allowed =
    text(auth.token.role) === "superAdmin" ||
    text(auth.token.ulimRole) === "superAdmin" ||
    text(auth.token.accountRole) === "superAdmin" ||
    roles.includes("superAdmin");
  if (!allowed) {
    throw new HttpsError("permission-denied", "superAdmin claim is required.");
  }
  return auth.uid;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const output: GenericRecord = {};
    for (const key of Object.keys(value as GenericRecord).sort()) {
      output[key] = canonicalize((value as GenericRecord)[key]);
    }
    return output;
  }
  return value;
}

function canonicalText(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sha256Buffer(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function digestValue(value: unknown): string {
  return sha256Text(canonicalText(value));
}

function exactJson(left: unknown, right: unknown): boolean {
  return canonicalText(left) === canonicalText(right);
}

function allTrue(value: GenericRecord): boolean {
  return Object.values(value).every((item) => item === true);
}

function deterministicAscii(seed: string, length: number): string {
  let output = "";
  let counter = 0;
  while (output.length < length) {
    output += createHash("sha256")
      .update(`${seed}|${counter}`, "utf8")
      .digest("hex");
    counter += 1;
  }
  return output.slice(0, length);
}

function expectedCounts(): GenericRecord {
  return {
    sheetStudentRows: 156,
    sheetPrincipalRows: 12,
    sheetHeaderCells: 2,
    sheetIdentityCells: 168,
    sheetTotalTargetCells: 170,
    principalAuthColumn9Anchors: 12,
    attendanceDocuments: 69,
    assignmentDocuments: 14,
    firebaseAuthUsers: 1,
    inPlaceAttendancePlans: 68
  };
}

function correctedTotals(): GenericRecord {
  return {
    sheetMutations: 170,
    firestoreWrites: 350,
    firebaseAuthWrites: 1,
    logicalMutations: 521
  };
}

function maintenanceSequence(): string[] {
  return ["inactive", "arming", "active", "failed_closed", "releasing", "inactive"];
}

function snapshotSequence(): string[] {
  return ["capturing", "captured", "sealing", "sealed", "verified", "retained", "released"];
}

function blockedScenarios(): string[] {
  return [
    "maintenance_activation_without_lock",
    "snapshot_capture_before_maintenance_active",
    "invalid_maintenance_active_to_inactive_transition",
    "snapshot_metadata_overwrite",
    "payload_chunk_overwrite",
    "snapshot_release_before_post_cutover_signoff"
  ];
}

function writeBudget(): GenericRecord {
  return {
    executionLockWrites: 2,
    maintenanceStateWrites: 7,
    snapshotMetadataWrites: 8,
    payloadChunkWrites: 2,
    verificationEventWrites: 2,
    resultManifestWrites: 1,
    maximumTotalIsolatedWrites: EXPECTED_TOTAL_ISOLATED_WRITES
  };
}

function safetyContract(): GenericRecord {
  return {
    isolatedRehearsalOnly: true,
    syntheticPayloadOnly: true,
    productionRollbackSnapshotWrites: 0,
    productionMaintenanceModeChanges: 0,
    productionExecutionLockWrites: 0,
    sourceSheetWrites: 0,
    activeUidRegistryWrites: 0,
    attendanceWrites: 0,
    assignmentWrites: 0,
    firebaseAuthWrites: 0,
    sessionChanges: 0,
    finalArmTokenWrites: 0,
    isolatedWritesMaximum: EXPECTED_TOTAL_ISOLATED_WRITES,
    commitCallableIncluded: false,
    cutoverExecutionCallableIncluded: false,
    rollbackExecutionCallableIncluded: false,
    productionSnapshotPersistenceCallableIncluded: false,
    productionMaintenanceActivationCallableIncluded: false,
    actualUidCutoverAllowed: false
  };
}

function makeSyntheticPayload(callerUid: string): SyntheticPayload {
  const base: GenericRecord = {
    version: UID_V2_ISOLATED_ROLLBACK_MAINTENANCE_PHASE4C21R_VERSION,
    phase: "Phase 4C-21R",
    mode: "isolated_synthetic_rollback_payload",
    requestId: REQUEST_ID,
    generatedForCallerUidDigest: sha256Text(callerUid),
    containsProductionRawData: false,
    deterministicSyntheticOnly: true,
    priorEvidence: {
      phase4c20DesignDigest: EXPECTED_PHASE4C20_DESIGN_DIGEST,
      phase4c19ResultDigest: EXPECTED_PHASE4C19_RESULT_DIGEST,
      freshRollbackSnapshotDigest: EXPECTED_FRESH_ROLLBACK_DIGEST,
      approvalTokenDigest: EXPECTED_APPROVAL_TOKEN_DIGEST
    },
    expectedCounts: expectedCounts(),
    correctedProjectedTotals: correctedTotals(),
    requiredPayloadSections: [
      { section: "sheet", targetCells: 170, principalAuthColumn9Anchors: 12 },
      { section: "attendance", documents: 69 },
      { section: "assignments", documents: 14 },
      { section: "firebaseAuth", users: 1, passwordMaterialIncluded: false },
      { section: "inPlaceAttendancePlans", plans: 68 }
    ],
    syntheticPadding: ""
  };

  const emptyBytes = Buffer.byteLength(canonicalText(base), "utf8");
  const paddingLength = SYNTHETIC_CANONICAL_BYTES - emptyBytes;
  if (paddingLength < 0) {
    throw new HttpsError("resource-exhausted", "Synthetic base exceeds target size.");
  }

  base.syntheticPadding = deterministicAscii(
    `${REQUEST_ID}|${EXPECTED_FRESH_ROLLBACK_DIGEST}`,
    paddingLength
  );

  const finalText = canonicalText(base);
  const canonicalBytes = Buffer.byteLength(finalText, "utf8");

  if (canonicalBytes !== SYNTHETIC_CANONICAL_BYTES) {
    throw new HttpsError(
      "internal",
      `Synthetic canonical byte target mismatch: ${canonicalBytes}`
    );
  }
  if (canonicalBytes > MAXIMUM_SNAPSHOT_BYTES) {
    throw new HttpsError("resource-exhausted", "Synthetic payload is too large.");
  }

  const compressed = gzipSync(Buffer.from(finalText, "utf8"), { level: 9 });
  const encoded = compressed.toString("base64");
  const chunks: string[] = [];

  for (let offset = 0; offset < encoded.length; offset += MAXIMUM_CHUNK_BYTES) {
    chunks.push(encoded.slice(offset, offset + MAXIMUM_CHUNK_BYTES));
  }

  if (chunks.length !== EXPECTED_CHUNK_COUNT) {
    throw new HttpsError(
      "failed-precondition",
      `Unexpected synthetic chunk count: ${chunks.length}`
    );
  }

  return {
    canonicalText: finalText,
    canonicalBytes,
    compressed,
    compressedBytes: compressed.byteLength,
    encoded,
    encodedBytes: Buffer.byteLength(encoded, "utf8"),
    chunks,
    chunkDigests: chunks.map(sha256Text),
    rawCanonicalSha256: sha256Text(finalText),
    compressedSha256: sha256Buffer(compressed)
  };
}

async function buildContext(callerUid: string): Promise<BuiltContext> {
  const db = getFirestore(defaultAdminApp());
  const runRef = db.collection("uidV2StagingRuns").doc(REQUEST_ID);

  const [designSnap, captureSnap] = await Promise.all([
    runRef.collection("rebaseProductionRollbackPersistenceMaintenanceDesigns")
      .doc("phase4c20r").get(),
    runRef.collection("rebaseFreshRollbackCaptureRehearsals")
      .doc("phase4c19r").get()
  ]);

  if (!designSnap.exists || !captureSnap.exists) {
    throw new HttpsError("not-found", "Phase 4C-20R or 4C-19R evidence is missing.");
  }

  const designStored = designSnap.data() || {};
  const design = asRecord(designStored.design, "phase4c20.design");
  const persistence = asRecord(
    design.rollbackSnapshotPersistenceDesign,
    "phase4c20.persistence"
  );
  const storage = asRecord(persistence.storageModel, "phase4c20.storage");
  const maintenance = asRecord(
    design.maintenanceWindowActivationDesign,
    "phase4c20.maintenance"
  );
  const finalArm = asRecord(design.finalArmGate, "phase4c20.finalArmGate");
  const designChain = asRecord(design.chainChecks, "phase4c20.chainChecks");
  const designBlocking = asArray(design.blockingReasons, "phase4c20.blockingReasons");
  const designSafety = asRecord(design.safety, "phase4c20.safety");

  const captureStored = captureSnap.data() || {};
  const capture = asRecord(captureStored.result, "phase4c19.result");
  const captureSafety = asRecord(capture.safety, "phase4c19.safety");

  const chainChecks: GenericRecord = {
    phase4c20Status:
      text(designStored.status) ===
      "rebase_production_rollback_persistence_maintenance_design_staged",
    phase4c20Caller: text(designStored.approvedByFirebaseUid) === callerUid,
    phase4c20Contract:
      text(designStored.contractDigest) === EXPECTED_PHASE4C20_CONTRACT_DIGEST,
    phase4c20Design:
      text(designStored.designDigest) === EXPECTED_PHASE4C20_DESIGN_DIGEST,
    phase4c20StoredDesign:
      digestValue(design) === EXPECTED_PHASE4C20_DESIGN_DIGEST,
    phase4c20Ready:
      design.designReady === true &&
      design.rollbackPersistenceDesignReady === true &&
      design.maintenanceActivationDesignReady === true,
    phase4c20Chain: allTrue(designChain),
    phase4c20Blocking: designBlocking.length === 0,
    phase4c20FreshCapture:
      persistence.phase4c19RawPayloadReusableForProduction === false &&
      persistence.freshCaptureRequiredAfterMaintenanceActive === true,
    phase4c20Encoding:
      text(storage.payloadEncoding) === "canonical_json_gzip_base64" &&
      Number(storage.maximumChunkPayloadBytes) === MAXIMUM_CHUNK_BYTES &&
      storage.perChunkSha256Required === true &&
      storage.wholeSnapshotSha256Required === true &&
      storage.createOnly === true &&
      storage.overwriteForbidden === true,
    phase4c20SnapshotStates:
      exactJson(
        persistence.stateMachine,
        ["absent", ...snapshotSequence()]
      ),
    phase4c20MaintenanceStates:
      exactJson(
        maintenance.stateMachine,
        ["inactive", "arming", "active", "releasing", "inactive"]
      ),
    phase4c20FailClosed:
      text(maintenance.failureState) === "failed_closed" &&
      maintenance.failClosedOnLeaseExpiry === true &&
      maintenance.automaticDeactivationOnLeaseExpiry === false,
    phase4c20NoExecution:
      design.productionRollbackSnapshotPersisted === false &&
      design.maintenanceWindowActivated === false &&
      design.productionExecutionLockAcquired === false &&
      design.finalArmTokenIssued === false &&
      persistence.actualPersistenceIncludedInThisPhase === false &&
      maintenance.activationIncludedInThisPhase === false &&
      finalArm.finalArmTokenIssued === false &&
      finalArm.actualCutoverAllowed === false &&
      design.actualUidCutoverAllowed === false &&
      designSafety.actualUidCutoverAllowed === false,

    phase4c19Status:
      text(captureStored.status) ===
      "rebase_fresh_live_baseline_rollback_capture_rehearsal_staged",
    phase4c19Caller: text(captureStored.approvedByFirebaseUid) === callerUid,
    phase4c19Contract:
      text(captureStored.contractDigest) === EXPECTED_PHASE4C19_CONTRACT_DIGEST,
    phase4c19Result:
      text(captureStored.resultDigest) === EXPECTED_PHASE4C19_RESULT_DIGEST,
    phase4c19StoredResult:
      digestValue(capture) === EXPECTED_PHASE4C19_RESULT_DIGEST,
    phase4c19FreshRollback:
      text(capture.freshRollbackSnapshotDigest) === EXPECTED_FRESH_ROLLBACK_DIGEST,
    phase4c19RawNotPersisted: capture.rawRollbackPayloadPersisted === false,
    phase4c19NoCutover: captureSafety.actualUidCutoverAllowed === false
  };

  const blockingReasons = Object.entries(chainChecks)
    .filter(([, passed]) => passed !== true)
    .map(([key]) => key);

  if (blockingReasons.length) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-21R prior-chain validation failed: ${blockingReasons.join(", ")}`
    );
  }

  return {
    db,
    runRef,
    resultRef: runRef.collection("rebaseIsolatedRollbackMaintenanceRehearsals")
      .doc("phase4c21r"),
    callerUid,
    chainChecks,
    blockingReasons
  };
}

function makeRefs(context: BuiltContext, runId: string): RehearsalRefs {
  const root = context.runRef.collection("rebaseIsolatedRollbackMaintenanceRuns")
    .doc(runId);
  return {
    lockRef: root.collection("executionLock").doc("current"),
    maintenanceRef: root.collection("maintenanceState").doc("control"),
    snapshotRef: root.collection("rollbackSnapshots").doc("snapshot"),
    chunkRef: root.collection("payloadChunks").doc("chunk-000000"),
    verificationRef: root.collection("verificationEvents").doc("event-000000")
  };
}

async function expectBlocked(
  marker: string,
  operation: () => Promise<void>
): Promise<boolean> {
  try {
    await operation();
    return false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes(`BLOCK:${marker}`);
  }
}

async function transitionState(
  db: Firestore,
  ref: DocumentReference<DocumentData>,
  expectedState: string,
  nextState: string,
  patch: GenericRecord
): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) {
      throw new HttpsError("failed-precondition", `Missing state doc: ${ref.path}`);
    }
    const current = snap.data() || {};
    if (text(current.state) !== expectedState) {
      throw new HttpsError(
        "failed-precondition",
        `Invalid transition ${text(current.state)} -> ${nextState}`
      );
    }
    transaction.set(ref, {
      ...current,
      ...patch,
      state: nextState,
      updatedAtIso: new Date().toISOString()
    });
  });
}

async function cleanupExisting(ref: DocumentReference<DocumentData>): Promise<number> {
  const snap = await ref.get();
  if (!snap.exists) return 0;
  await ref.delete();
  return 1;
}

async function runIsolatedRehearsal(context: BuiltContext): Promise<GenericRecord> {
  const payload = makeSyntheticPayload(context.callerUid);
  const runId = [
    "phase4c21r",
    Date.now().toString(36),
    randomBytes(8).toString("hex")
  ].join("-");
  const refs = makeRefs(context, runId);
  const ownerToken = sha256Text(`${context.callerUid}|${runId}|owner`);

  let writes = 0;
  let cleanupWrites = 0;
  let resultBuilt = false;
  const blocked: GenericRecord = {};
  const maintenanceStates: string[] = [];
  const snapshotStates: string[] = [];

  try {
    blocked.maintenanceActivationWithoutLock = await expectBlocked(
      "maintenance_without_lock",
      async () => {
        await context.db.runTransaction(async (transaction) => {
          const lock = await transaction.get(refs.lockRef);
          if (!lock.exists) {
            throw new HttpsError(
              "failed-precondition",
              "BLOCK:maintenance_without_lock"
            );
          }
        });
      }
    );

    await context.db.runTransaction(async (transaction) => {
      const current = await transaction.get(refs.lockRef);
      if (current.exists) {
        throw new HttpsError("already-exists", "Isolated lock already exists.");
      }
      transaction.set(refs.lockRef, {
        state: "owned",
        ownerToken,
        callerUidDigest: sha256Text(context.callerUid),
        runIdDigest: sha256Text(runId),
        isolated: true,
        createdAtIso: new Date().toISOString()
      });
    });
    writes += 1;

    await context.db.runTransaction(async (transaction) => {
      const [lock, maintenance] = await Promise.all([
        transaction.get(refs.lockRef),
        transaction.get(refs.maintenanceRef)
      ]);
      if (!lock.exists || text((lock.data() || {}).ownerToken) !== ownerToken) {
        throw new HttpsError("failed-precondition", "Owned lock required.");
      }
      if (maintenance.exists) {
        throw new HttpsError("already-exists", "Maintenance doc already exists.");
      }
      transaction.set(refs.maintenanceRef, {
        state: "inactive",
        ownerToken,
        stateHistory: ["inactive"],
        automaticDeactivation: false,
        isolated: true,
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString()
      });
    });
    writes += 1;
    maintenanceStates.push("inactive");

    await transitionState(context.db, refs.maintenanceRef, "inactive", "arming", {
      ownerToken,
      drainSeconds: 60,
      stateHistory: ["inactive", "arming"]
    });
    writes += 1;
    maintenanceStates.push("arming");

    blocked.snapshotCaptureBeforeMaintenanceActive = await expectBlocked(
      "snapshot_before_active",
      async () => {
        await context.db.runTransaction(async (transaction) => {
          const maintenance = await transaction.get(refs.maintenanceRef);
          if (text((maintenance.data() || {}).state) !== "active") {
            throw new HttpsError(
              "failed-precondition",
              "BLOCK:snapshot_before_active"
            );
          }
        });
      }
    );

    await transitionState(context.db, refs.maintenanceRef, "arming", "active", {
      ownerToken,
      writeFreezeConfirmed: true,
      drainCompleted: true,
      leaseSeconds: 1800,
      heartbeatSeconds: 300,
      stateHistory: ["inactive", "arming", "active"]
    });
    writes += 1;
    maintenanceStates.push("active");

    blocked.invalidMaintenanceActiveToInactive = await expectBlocked(
      "active_to_inactive",
      async () => {
        await context.db.runTransaction(async (transaction) => {
          const maintenance = await transaction.get(refs.maintenanceRef);
          if (text((maintenance.data() || {}).state) === "active") {
            throw new HttpsError("failed-precondition", "BLOCK:active_to_inactive");
          }
        });
      }
    );

    await context.db.runTransaction(async (transaction) => {
      const [lock, maintenance, snapshot] = await Promise.all([
        transaction.get(refs.lockRef),
        transaction.get(refs.maintenanceRef),
        transaction.get(refs.snapshotRef)
      ]);
      if (!lock.exists || text((lock.data() || {}).ownerToken) !== ownerToken) {
        throw new HttpsError("failed-precondition", "Owned lock required.");
      }
      if (text((maintenance.data() || {}).state) !== "active") {
        throw new HttpsError("failed-precondition", "Active maintenance required.");
      }
      if (snapshot.exists) {
        throw new HttpsError("already-exists", "Snapshot already exists.");
      }
      transaction.set(refs.snapshotRef, {
        state: "capturing",
        ownerToken,
        encoding: "canonical_json_gzip_base64",
        canonicalBytes: payload.canonicalBytes,
        maximumAllowedBytes: MAXIMUM_SNAPSHOT_BYTES,
        maximumChunkBytes: MAXIMUM_CHUNK_BYTES,
        expectedChunkCount: EXPECTED_CHUNK_COUNT,
        containsProductionRawData: false,
        deterministicSyntheticOnly: true,
        isolated: true,
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString()
      });
    });
    writes += 1;
    snapshotStates.push("capturing");

    blocked.snapshotMetadataOverwrite = await expectBlocked(
      "snapshot_metadata_overwrite",
      async () => {
        await context.db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(refs.snapshotRef);
          if (snapshot.exists) {
            throw new HttpsError(
              "already-exists",
              "BLOCK:snapshot_metadata_overwrite"
            );
          }
        });
      }
    );

    await context.db.runTransaction(async (transaction) => {
      const current = await transaction.get(refs.chunkRef);
      if (current.exists) {
        throw new HttpsError("already-exists", "Chunk already exists.");
      }
      transaction.set(refs.chunkRef, {
        chunkIndex: 0,
        totalChunks: payload.chunks.length,
        payloadSegment: payload.chunks[0],
        payloadSegmentBytes: Buffer.byteLength(payload.chunks[0], "utf8"),
        payloadSegmentSha256: payload.chunkDigests[0],
        encoding: "base64_segment",
        isolated: true,
        createdAtIso: new Date().toISOString()
      });
    });
    writes += 1;

    blocked.payloadChunkOverwrite = await expectBlocked(
      "payload_chunk_overwrite",
      async () => {
        await context.db.runTransaction(async (transaction) => {
          const chunk = await transaction.get(refs.chunkRef);
          if (chunk.exists) {
            throw new HttpsError(
              "already-exists",
              "BLOCK:payload_chunk_overwrite"
            );
          }
        });
      }
    );

    await transitionState(context.db, refs.snapshotRef, "capturing", "captured", {
      chunkCount: payload.chunks.length,
      encodedBytes: payload.encodedBytes,
      compressedBytes: payload.compressedBytes,
      rawCanonicalSha256: payload.rawCanonicalSha256,
      compressedSha256: payload.compressedSha256,
      chunkDigests: payload.chunkDigests
    });
    writes += 1;
    snapshotStates.push("captured");

    await transitionState(context.db, refs.snapshotRef, "captured", "sealing", {
      sealRequirements: [
        "isolated_maintenance_active",
        "isolated_execution_lock_owned",
        "synthetic_payload_only",
        "chunk_digests_match",
        "whole_snapshot_digest_matches",
        "approval_token_digest_bound"
      ]
    });
    writes += 1;
    snapshotStates.push("sealing");

    const chunkSnap = await refs.chunkRef.get();
    if (!chunkSnap.exists) {
      throw new HttpsError("data-loss", "Persisted chunk is missing.");
    }
    const chunk = chunkSnap.data() || {};
    const segment = text(chunk.payloadSegment);
    const reconstructedCompressed = Buffer.from(segment, "base64");
    const reconstructedText = gunzipSync(reconstructedCompressed).toString("utf8");

    const verification: GenericRecord = {
      chunkCount: Number(chunk.totalChunks) === EXPECTED_CHUNK_COUNT,
      chunkIndex: Number(chunk.chunkIndex) === 0,
      chunkBytesWithinLimit:
        Number(chunk.payloadSegmentBytes) <= MAXIMUM_CHUNK_BYTES,
      chunkDigest:
        text(chunk.payloadSegmentSha256) === sha256Text(segment),
      compressedDigest:
        sha256Buffer(reconstructedCompressed) === payload.compressedSha256,
      canonicalDigest:
        sha256Text(reconstructedText) === payload.rawCanonicalSha256,
      canonicalBytes:
        Buffer.byteLength(reconstructedText, "utf8") === SYNTHETIC_CANONICAL_BYTES,
      canonicalExact: reconstructedText === payload.canonicalText,
      productionRawDataAbsent:
        !reconstructedText.includes("phoneNumber") &&
        !reconstructedText.includes("passwordHash")
    };

    if (!allTrue(verification)) {
      const failed = Object.entries(verification)
        .filter(([, passed]) => passed !== true)
        .map(([key]) => key);
      throw new HttpsError(
        "data-loss",
        `Isolated payload verification failed: ${failed.join(", ")}`
      );
    }

    await context.db.runTransaction(async (transaction) => {
      const current = await transaction.get(refs.verificationRef);
      if (current.exists) {
        throw new HttpsError("already-exists", "Verification event exists.");
      }
      transaction.set(refs.verificationRef, {
        state: "verified",
        verification,
        rawCanonicalSha256: payload.rawCanonicalSha256,
        compressedSha256: payload.compressedSha256,
        chunkDigests: payload.chunkDigests,
        isolated: true,
        createdAtIso: new Date().toISOString()
      });
    });
    writes += 1;

    await transitionState(context.db, refs.snapshotRef, "sealing", "sealed", {
      sealed: true,
      sealedByUidDigest: sha256Text(context.callerUid),
      approvalTokenDigest: EXPECTED_APPROVAL_TOKEN_DIGEST,
      wholeSnapshotSha256: payload.rawCanonicalSha256,
      wholeCompressedSha256: payload.compressedSha256
    });
    writes += 1;
    snapshotStates.push("sealed");

    await transitionState(context.db, refs.snapshotRef, "sealed", "verified", {
      verificationPassed: true,
      verificationEventDigest: digestValue({
        verification,
        rawCanonicalSha256: payload.rawCanonicalSha256,
        compressedSha256: payload.compressedSha256,
        chunkDigests: payload.chunkDigests
      })
    });
    writes += 1;
    snapshotStates.push("verified");

    await transitionState(context.db, refs.snapshotRef, "verified", "retained", {
      minimumRetentionDays: 30,
      manualReleaseRequired: true,
      postCutoverSignoff: false
    });
    writes += 1;
    snapshotStates.push("retained");

    blocked.snapshotReleaseBeforePostCutoverSignoff = await expectBlocked(
      "release_before_signoff",
      async () => {
        await context.db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(refs.snapshotRef);
          const data = snapshot.data() || {};
          if (
            text(data.state) === "retained" &&
            data.postCutoverSignoff !== true
          ) {
            throw new HttpsError(
              "failed-precondition",
              "BLOCK:release_before_signoff"
            );
          }
        });
      }
    );

    await transitionState(context.db, refs.snapshotRef, "retained", "released", {
      postCutoverSignoff: true,
      releaseMode: "isolated_rehearsal_only",
      productionSnapshotReleased: false
    });
    writes += 1;
    snapshotStates.push("released");

    await transitionState(context.db, refs.maintenanceRef, "active", "failed_closed", {
      leaseExpiredSimulation: true,
      automaticDeactivation: false,
      writesRemainFrozen: true,
      stateHistory: ["inactive", "arming", "active", "failed_closed"]
    });
    writes += 1;
    maintenanceStates.push("failed_closed");

    const failedClosedSnap = await refs.maintenanceRef.get();
    const failedClosed = failedClosedSnap.data() || {};
    const failClosedVerified =
      text(failedClosed.state) === "failed_closed" &&
      failedClosed.automaticDeactivation === false &&
      failedClosed.writesRemainFrozen === true;

    if (!failClosedVerified) {
      throw new HttpsError("data-loss", "Fail-closed verification failed.");
    }

    await transitionState(
      context.db,
      refs.maintenanceRef,
      "failed_closed",
      "releasing",
      {
        explicitRelease: true,
        unresolvedOperationalMutations: 0,
        stateHistory: [
          "inactive", "arming", "active", "failed_closed", "releasing"
        ]
      }
    );
    writes += 1;
    maintenanceStates.push("releasing");

    await transitionState(context.db, refs.maintenanceRef, "releasing", "inactive", {
      writeFreezeReleased: true,
      stateHistory: maintenanceSequence()
    });
    writes += 1;
    maintenanceStates.push("inactive");

    if (!exactJson(maintenanceStates, maintenanceSequence())) {
      throw new HttpsError("data-loss", "Maintenance state sequence mismatch.");
    }
    if (!exactJson(snapshotStates, snapshotSequence())) {
      throw new HttpsError("data-loss", "Snapshot state sequence mismatch.");
    }
    if (!allTrue(blocked)) {
      throw new HttpsError("data-loss", "A blocked scenario did not block.");
    }

    await refs.chunkRef.delete(); writes += 1; cleanupWrites += 1;
    await refs.verificationRef.delete(); writes += 1; cleanupWrites += 1;
    await refs.snapshotRef.delete(); writes += 1; cleanupWrites += 1;
    await refs.maintenanceRef.delete(); writes += 1; cleanupWrites += 1;
    await refs.lockRef.delete(); writes += 1; cleanupWrites += 1;

    const [chunkEnd, verificationEnd, snapshotEnd, maintenanceEnd, lockEnd] =
      await Promise.all([
        refs.chunkRef.get(),
        refs.verificationRef.get(),
        refs.snapshotRef.get(),
        refs.maintenanceRef.get(),
        refs.lockRef.get()
      ]);

    const ephemeralArtifactsAbsent =
      !chunkEnd.exists &&
      !verificationEnd.exists &&
      !snapshotEnd.exists &&
      !maintenanceEnd.exists &&
      !lockEnd.exists;

    if (!ephemeralArtifactsAbsent) {
      throw new HttpsError("data-loss", "Isolated artifacts remain after cleanup.");
    }
    if (writes !== EXPECTED_TOTAL_ISOLATED_WRITES - 1) {
      throw new HttpsError(
        "data-loss",
        `Unexpected pre-result write count: ${writes}`
      );
    }

    const result: GenericRecord = {
      version: UID_V2_ISOLATED_ROLLBACK_MAINTENANCE_PHASE4C21R_VERSION,
      phase: "Phase 4C-21R",
      mode: "rebase156_isolated_rollback_payload_persistence_and_maintenance_state_machine_rehearsal_only",
      requestId: REQUEST_ID,
      approvedByFirebaseUid: context.callerUid,
      contractDigest: CONTRACT_DIGEST,
      generatedAtIso: new Date().toISOString(),
      rehearsalRunIdDigest: sha256Text(runId),
      priorEvidence: {
        phase4c20ContractDigest: EXPECTED_PHASE4C20_CONTRACT_DIGEST,
        phase4c20DesignDigest: EXPECTED_PHASE4C20_DESIGN_DIGEST,
        phase4c19ContractDigest: EXPECTED_PHASE4C19_CONTRACT_DIGEST,
        phase4c19ResultDigest: EXPECTED_PHASE4C19_RESULT_DIGEST,
        freshRollbackSnapshotDigest: EXPECTED_FRESH_ROLLBACK_DIGEST,
        phase4c17ApprovalTokenDigest: EXPECTED_APPROVAL_TOKEN_DIGEST
      },
      expectedCounts: expectedCounts(),
      correctedProjectedTotals: correctedTotals(),
      syntheticPayload: {
        containsProductionRawData: false,
        canonicalBytes: payload.canonicalBytes,
        compressedBytes: payload.compressedBytes,
        encodedBytes: payload.encodedBytes,
        chunkCount: payload.chunks.length,
        maximumChunkBytes: MAXIMUM_CHUNK_BYTES,
        rawCanonicalSha256: payload.rawCanonicalSha256,
        compressedSha256: payload.compressedSha256,
        chunkDigests: payload.chunkDigests,
        rawPayloadReturnedToClient: false,
        rawPayloadLogged: false,
        passwordMaterialIncluded: false
      },
      persistenceRehearsal: {
        passed: true,
        metadataCreateOnlyBlocked: blocked.snapshotMetadataOverwrite,
        chunkCreateOnlyBlocked: blocked.payloadChunkOverwrite,
        chunkDigestVerified: verification.chunkDigest,
        wholeCompressedDigestVerified: verification.compressedDigest,
        rawCanonicalDigestVerified: verification.canonicalDigest,
        reconstructedPayloadExact: verification.canonicalExact,
        snapshotSequence: snapshotStates,
        releaseBeforeSignoffBlocked:
          blocked.snapshotReleaseBeforePostCutoverSignoff,
        releasedAfterIsolatedSignoff: true,
        ephemeralArtifactsAbsent
      },
      maintenanceRehearsal: {
        passed: true,
        activationWithoutLockBlocked:
          blocked.maintenanceActivationWithoutLock,
        captureBeforeActiveBlocked:
          blocked.snapshotCaptureBeforeMaintenanceActive,
        invalidActiveToInactiveBlocked:
          blocked.invalidMaintenanceActiveToInactive,
        stateSequence: maintenanceStates,
        failClosedVerified,
        automaticDeactivation: false,
        finalStateBeforeCleanup: "inactive",
        ephemeralArtifactsAbsent
      },
      blockedScenarios: blockedScenarios(),
      blockedScenarioChecks: blocked,
      chainChecks: context.chainChecks,
      blockingReasons: context.blockingReasons,
      writeBudget: writeBudget(),
      actualWrites: {
        preResultIsolatedWrites: writes,
        cleanupWrites,
        resultManifestWrites: 1,
        totalIsolatedWrites: writes + 1
      },
      rehearsalPassed: true,
      isolatedRollbackPersistencePassed: true,
      maintenanceStateMachinePassed: true,
      isolatedArtifactsCleaned: true,
      productionRollbackSnapshotPersisted: false,
      productionMaintenanceWindowActivated: false,
      productionExecutionLockAcquired: false,
      finalArmTokenIssued: false,
      safety: safetyContract(),
      actualUidCutoverAllowed: false,
      nextGate: {
        phase: NEXT_GATE_PHASE,
        allowed: true,
        actualUidCutoverAllowed: false
      }
    };

    resultBuilt = true;
    return result;
  } finally {
    if (!resultBuilt) {
      await cleanupExisting(refs.chunkRef);
      await cleanupExisting(refs.verificationRef);
      await cleanupExisting(refs.snapshotRef);
      await cleanupExisting(refs.maintenanceRef);
      await cleanupExisting(refs.lockRef);
    }
  }
}

function verifyStoredResult(
  stored: GenericRecord,
  callerUid: string
): GenericRecord {
  const result = asRecord(stored.result, "stored.result");
  const priorEvidence = asRecord(result.priorEvidence, "result.priorEvidence");
  const synthetic = asRecord(result.syntheticPayload, "result.syntheticPayload");
  const persistence = asRecord(
    result.persistenceRehearsal,
    "result.persistenceRehearsal"
  );
  const maintenance = asRecord(
    result.maintenanceRehearsal,
    "result.maintenanceRehearsal"
  );
  const blocked = asRecord(
    result.blockedScenarioChecks,
    "result.blockedScenarioChecks"
  );
  const chainChecks = asRecord(result.chainChecks, "result.chainChecks");
  const blockingReasons = asArray(result.blockingReasons, "result.blockingReasons");
  const actualWrites = asRecord(result.actualWrites, "result.actualWrites");
  const safety = asRecord(result.safety, "result.safety");

  return {
    status:
      text(stored.status) ===
      "rebase_isolated_rollback_maintenance_rehearsal_staged",
    caller: text(stored.approvedByFirebaseUid) === callerUid,
    contract: text(stored.contractDigest) === CONTRACT_DIGEST,
    resultDigest: text(stored.resultDigest) === digestValue(result),
    phase4c20:
      text(priorEvidence.phase4c20DesignDigest) ===
      EXPECTED_PHASE4C20_DESIGN_DIGEST,
    phase4c19:
      text(priorEvidence.phase4c19ResultDigest) ===
      EXPECTED_PHASE4C19_RESULT_DIGEST,
    freshRollback:
      text(priorEvidence.freshRollbackSnapshotDigest) ===
      EXPECTED_FRESH_ROLLBACK_DIGEST,
    counts: exactJson(result.expectedCounts, expectedCounts()),
    totals: exactJson(result.correctedProjectedTotals, correctedTotals()),
    synthetic:
      synthetic.containsProductionRawData === false &&
      Number(synthetic.canonicalBytes) === SYNTHETIC_CANONICAL_BYTES &&
      Number(synthetic.chunkCount) === EXPECTED_CHUNK_COUNT &&
      synthetic.rawPayloadReturnedToClient === false &&
      synthetic.rawPayloadLogged === false &&
      synthetic.passwordMaterialIncluded === false,
    persistence:
      persistence.passed === true &&
      persistence.metadataCreateOnlyBlocked === true &&
      persistence.chunkCreateOnlyBlocked === true &&
      persistence.chunkDigestVerified === true &&
      persistence.wholeCompressedDigestVerified === true &&
      persistence.rawCanonicalDigestVerified === true &&
      persistence.reconstructedPayloadExact === true &&
      persistence.releaseBeforeSignoffBlocked === true &&
      persistence.releasedAfterIsolatedSignoff === true &&
      persistence.ephemeralArtifactsAbsent === true &&
      exactJson(persistence.snapshotSequence, snapshotSequence()),
    maintenance:
      maintenance.passed === true &&
      maintenance.activationWithoutLockBlocked === true &&
      maintenance.captureBeforeActiveBlocked === true &&
      maintenance.invalidActiveToInactiveBlocked === true &&
      maintenance.failClosedVerified === true &&
      maintenance.automaticDeactivation === false &&
      text(maintenance.finalStateBeforeCleanup) === "inactive" &&
      maintenance.ephemeralArtifactsAbsent === true &&
      exactJson(maintenance.stateSequence, maintenanceSequence()),
    blocked: allTrue(blocked),
    blockedNames: exactJson(result.blockedScenarios, blockedScenarios()),
    chainChecks: allTrue(chainChecks),
    blockingReasons: blockingReasons.length === 0,
    writeBudget: exactJson(result.writeBudget, writeBudget()),
    actualWrites:
      Number(actualWrites.preResultIsolatedWrites) === 21 &&
      Number(actualWrites.cleanupWrites) === 5 &&
      Number(actualWrites.resultManifestWrites) === 1 &&
      Number(actualWrites.totalIsolatedWrites) === EXPECTED_TOTAL_ISOLATED_WRITES,
    passed:
      result.rehearsalPassed === true &&
      result.isolatedRollbackPersistencePassed === true &&
      result.maintenanceStateMachinePassed === true &&
      result.isolatedArtifactsCleaned === true,
    productionUntouched:
      result.productionRollbackSnapshotPersisted === false &&
      result.productionMaintenanceWindowActivated === false &&
      result.productionExecutionLockAcquired === false &&
      result.finalArmTokenIssued === false,
    safety: exactJson(safety, safetyContract()),
    noCutover: result.actualUidCutoverAllowed === false
  };
}

function publicResult(
  stored: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean
): GenericRecord {
  const result = asRecord(stored.result, "stored.result");
  return {
    ok: true,
    version: UID_V2_ISOLATED_ROLLBACK_MAINTENANCE_PHASE4C21R_VERSION,
    phase: "Phase 4C-21R",
    mode: "rebase156_isolated_rollback_payload_persistence_and_maintenance_state_machine_rehearsal_only",
    requestId: REQUEST_ID,
    duplicate,
    writeOperations,
    status: text(stored.status),
    contractDigest: CONTRACT_DIGEST,
    resultDigest: text(stored.resultDigest),
    priorEvidence: result.priorEvidence,
    expectedCounts: result.expectedCounts,
    correctedProjectedTotals: result.correctedProjectedTotals,
    syntheticPayload: result.syntheticPayload,
    persistenceRehearsal: result.persistenceRehearsal,
    maintenanceRehearsal: result.maintenanceRehearsal,
    blockedScenarios: result.blockedScenarios,
    blockedScenarioChecks: result.blockedScenarioChecks,
    chainChecks: result.chainChecks,
    blockingReasons: result.blockingReasons,
    writeBudget: result.writeBudget,
    actualWrites: result.actualWrites,
    rehearsalPassed: result.rehearsalPassed,
    isolatedRollbackPersistencePassed: result.isolatedRollbackPersistencePassed,
    maintenanceStateMachinePassed: result.maintenanceStateMachinePassed,
    isolatedArtifactsCleaned: result.isolatedArtifactsCleaned,
    productionRollbackSnapshotPersisted:
      result.productionRollbackSnapshotPersisted,
    productionMaintenanceWindowActivated:
      result.productionMaintenanceWindowActivated,
    productionExecutionLockAcquired:
      result.productionExecutionLockAcquired,
    finalArmTokenIssued: result.finalArmTokenIssued,
    verified,
    digestMatches: verified,
    safety: {
      isolatedWrites: writeOperations,
      productionRollbackSnapshotWrites: 0,
      productionMaintenanceModeChanges: 0,
      productionExecutionLockWrites: 0,
      sourceSheetWrites: 0,
      activeUidRegistryWrites: 0,
      attendanceWrites: 0,
      assignmentWrites: 0,
      firebaseAuthWrites: 0,
      sessionChanges: 0,
      finalArmTokenWrites: 0,
      commitCallableIncluded: false,
      cutoverExecutionCallableIncluded: false,
      rollbackExecutionCallableIncluded: false,
      productionSnapshotPersistenceCallableIncluded: false,
      productionMaintenanceActivationCallableIncluded: false,
      actualUidCutoverAllowed: false
    },
    nextGate: {
      phase: NEXT_GATE_PHASE,
      allowed: true,
      actualUidCutoverAllowed: false
    }
  };
}

export const stageUidV2IsolatedRollbackMaintenancePhase4c21r = onCall(
  {
    region: REGION,
    timeoutSeconds: 540,
    memory: "1GiB",
    enforceAppCheck: false
  },
  async (request) => {
    const callerUid = requireSuperAdmin(
      request.auth as { uid: string; token: GenericRecord } | undefined
    );
    const input =
      request.data && typeof request.data === "object"
        ? (request.data as StageInput)
        : {};

    if (
      text(input.requestId) !== REQUEST_ID ||
      text(input.contractDigest) !== CONTRACT_DIGEST ||
      input.confirmSyntheticPayloadOnly !== true ||
      input.confirmIsolatedPersistenceOnly !== true ||
      input.confirmProductionWritesZero !== true ||
      input.confirmNoCutoverExecution !== true
    ) {
      throw new HttpsError("failed-precondition", "Phase 4C-21R input gate failed.");
    }

    const context = await buildContext(callerUid);
    const existing = await context.resultRef.get();

    if (existing.exists) {
      const stored = existing.data() || {};
      const checks = verifyStoredResult(stored, callerUid);
      if (!allTrue(checks)) {
        throw new HttpsError("data-loss", "Existing Phase 4C-21R result is invalid.");
      }
      return publicResult(stored, true, 0, false);
    }

    const result = await runIsolatedRehearsal(context);
    const resultDigest = digestValue(result);
    const stored: GenericRecord = {
      version: UID_V2_ISOLATED_ROLLBACK_MAINTENANCE_PHASE4C21R_VERSION,
      phase: "Phase 4C-21R",
      mode: "rebase156_isolated_rollback_payload_persistence_and_maintenance_state_machine_rehearsal_only",
      requestId: REQUEST_ID,
      approvedByFirebaseUid: callerUid,
      contractDigest: CONTRACT_DIGEST,
      resultDigest,
      result,
      status: "rebase_isolated_rollback_maintenance_rehearsal_staged",
      createdAtIso: new Date().toISOString()
    };

    await context.db.runTransaction(async (transaction) => {
      const current = await transaction.get(context.resultRef);
      if (current.exists) {
        throw new HttpsError(
          "already-exists",
          "A Phase 4C-21R result was created concurrently."
        );
      }
      transaction.set(context.resultRef, stored);
    });

    return publicResult(stored, false, EXPECTED_TOTAL_ISOLATED_WRITES, false);
  }
);

export const inspectUidV2IsolatedRollbackMaintenancePhase4c21r = onCall(
  {
    region: REGION,
    timeoutSeconds: 300,
    memory: "512MiB",
    enforceAppCheck: false
  },
  async (request) => {
    const callerUid = requireSuperAdmin(
      request.auth as { uid: string; token: GenericRecord } | undefined
    );
    const input =
      request.data && typeof request.data === "object"
        ? (request.data as InspectInput)
        : {};

    if (
      text(input.requestId) !== REQUEST_ID ||
      text(input.contractDigest) !== CONTRACT_DIGEST
    ) {
      throw new HttpsError("failed-precondition", "Phase 4C-21R inspect gate failed.");
    }

    const context = await buildContext(callerUid);
    const snapshot = await context.resultRef.get();

    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Phase 4C-21R result was not found.");
    }

    const stored = snapshot.data() || {};
    const checks = verifyStoredResult(stored, callerUid);

    if (!allTrue(checks)) {
      const failed = Object.entries(checks)
        .filter(([, passed]) => passed !== true)
        .map(([key]) => key);
      throw new HttpsError(
        "data-loss",
        `Phase 4C-21R result verification failed: ${failed.join(", ")}`
      );
    }

    return publicResult(stored, true, 0, true);
  }
);
