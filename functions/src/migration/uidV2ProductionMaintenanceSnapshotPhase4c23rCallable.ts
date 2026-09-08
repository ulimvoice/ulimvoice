import {
  createHash,
  randomBytes
} from "node:crypto";
import {
  gzipSync,
  gunzipSync
} from "node:zlib";
import {
  App,
  getApp,
  getApps,
  initializeApp
} from "firebase-admin/app";
import {
  UserRecord,
  getAuth
} from "firebase-admin/auth";
import {
  DocumentData,
  DocumentReference,
  Firestore,
  Timestamp,
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION =
  "2026-07-28.716.78-phase4c23r-emergency-release-restart-lease-heartbeat-recovery-hotfix";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "80b7fc3a72736ecd400ed20baae3f4c69169b3f129b60e990084a47d63e6ad37";

const EXPECTED_PHASE4C22_CONTRACT_DIGEST =
  "c81b6c846a8daf61e9222a01cf43e257fc7c0656abb4e4b5ecdf79bd400d5c37";

const EXPECTED_PHASE4C22_CORE_DIGEST =
  "cc43a674096cbe0a6f9d8e7da6802f1a4302f74f2d5732f7660795eaf64e3bdc";

const EXPECTED_PHASE4C22_PACKAGE_DIGEST =
  "b04f10a39564a95f5a8f348888c2329d27e0b8e587825d208ed841eb53b2b619";

const EXPECTED_PHASE4C19_CONTRACT_DIGEST =
  "0bda4550515b1365ec3f727ad79d597b94cab52a0d1da189098f0367832304d3";

const EXPECTED_PHASE4C19_PLAN_DIGEST =
  "cdaccca3c1187ee31ff55abb563e3a284c2a70168efac64d9f7e64b3906ed8a9";

const EXPECTED_PHASE4C17_APPROVAL_TOKEN_DIGEST =
  "9bd8d4c752ef40d0333cc84bb95b19dfb3d1fb0f17aa1d0e2a8fb78a3bce0253";

const EXPECTED_LEGACY_CONTRACT_DIGEST =
  "4636f906c36c3437732ed3eb738318028ee3fc3ab3fcf1ab7a804aea183ffdfe";

const EXPECTED_LEGACY_CUTOVER_RUN_ID =
  "phase4c23r-ms4jgt4q-49515383ec29ca81";

const EXPECTED_EMERGENCY_RELEASE_RESULT_FILE_DIGEST =
  "fcdcb7087e64da54b348eca0865e987fde11ffe9e5a5149298bbad850ac3dc42";

const ACTIVATION_PHRASE =
  "Phase 4C-23R 복구 실행으로 운영 유지보수와 Fresh Rollback Snapshot 저장을 다시 실행합니다. UID 변경은 실행하지 않습니다.";

const RELEASE_PHRASE =
  "Phase 4C-23R 복구 유지보수를 해제합니다. UID 변경은 실행되지 않았습니다.";

const DRAIN_SECONDS =
  60;

const LEASE_SECONDS =
  7200;

const HEARTBEAT_SECONDS =
  120;

const FRESH_SNAPSHOT_AGE_LIMIT_SECONDS =
  600;

const MAXIMUM_CANONICAL_BYTES =
  8000000;

const MAXIMUM_CHUNK_BYTES =
  700000;

const REQUIRED_CURRENT_CHUNK_COUNT =
  1;

const ACTIVATION_WRITE_OPERATIONS =
  6;

const PERSISTENCE_WRITE_OPERATIONS =
  7;

const TOTAL_EXECUTION_WRITE_OPERATIONS =
  13;

const NEXT_GATE_PHASE =
  "Phase 4C-24R final live preflight and explicit final-arm challenge only";

type GenericRecord =
  Record<string, unknown>;

interface ActivationInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly activationPhrase?: unknown;
  readonly confirmMaintenanceGuardDeployed?: unknown;
  readonly confirmCurrentLowTrafficWindow?: unknown;
  readonly confirmNoUidMutation?: unknown;
  readonly confirmEmergencyReleaseUnderstood?: unknown;
}

interface PersistenceInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly cutoverRunId?: unknown;
  readonly activationPhrase?: unknown;
  readonly sheetEnvelope?: unknown;
  readonly confirmMaintenanceGuardDeployed?: unknown;
  readonly confirmFreshCaptureAfterMaintenanceActive?: unknown;
  readonly confirmNoUidMutation?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly cutoverRunId?: unknown;
}

interface HeartbeatInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly cutoverRunId?: unknown;
}

interface ReleaseInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly cutoverRunId?: unknown;
  readonly releasePhrase?: unknown;
  readonly confirmUidMutationsZero?: unknown;
  readonly confirmSnapshotMustBeRetained?: unknown;
}

interface ExecutionContext {
  readonly db:
    Firestore;
  readonly callerUid:
    string;
  readonly runRef:
    DocumentReference<DocumentData>;
  readonly sessionRef:
    DocumentReference<DocumentData>;
  readonly resultRef:
    DocumentReference<DocumentData>;
  readonly legacySessionRef:
    DocumentReference<DocumentData>;
  readonly legacyResultRef:
    DocumentReference<DocumentData>;
  readonly lockRef:
    DocumentReference<DocumentData>;
  readonly maintenanceRef:
    DocumentReference<DocumentData>;
  readonly phase4c13Plan:
    GenericRecord;
  readonly chainChecks:
    GenericRecord;
  readonly blockingReasons:
    string[];
}

interface SnapshotRefs {
  readonly metadataRef:
    DocumentReference<DocumentData>;
  readonly chunkRef:
    DocumentReference<DocumentData>;
  readonly verificationRef:
    DocumentReference<DocumentData>;
}

interface ValidSheetCapture {
  readonly wrapper:
    GenericRecord;
  readonly wrapperDigest:
    string;
  readonly sourceSnapshot:
    GenericRecord;
  readonly sourceSnapshotDigest:
    string;
  readonly cells:
    GenericRecord[];
  readonly anchors:
    GenericRecord[];
  readonly capturedAtIso:
    string;
}

interface CapturedPayload {
  readonly serializedPayload:
    GenericRecord;
  readonly canonicalText:
    string;
  readonly canonicalBytes:
    number;
  readonly compressed:
    Buffer;
  readonly compressedBytes:
    number;
  readonly encoded:
    string;
  readonly encodedBytes:
    number;
  readonly chunks:
    string[];
  readonly chunkDigests:
    string[];
  readonly canonicalSha256:
    string;
  readonly compressedSha256:
    string;
  readonly sheetSnapshotDigest:
    string;
  readonly firestoreSnapshotDigest:
    string;
  readonly firebaseAuthSnapshotDigest:
    string;
  readonly rollbackSnapshotDigest:
    string;
  readonly counts:
    GenericRecord;
}

function defaultAdminApp(): App {
  const current =
    getApps().find(
      (app: App) =>
        app.name === "[DEFAULT]"
    );

  return current
    ? getApp()
    : initializeApp();
}

function text(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function strings(
  value: unknown
): string[] {
  return Array.isArray(value)
    ? value.map(text).filter(Boolean)
    : [];
}

function numberValue(
  value: unknown
): number {
  return typeof value === "number"
    ? value
    : Number(value);
}

function asRecord(
  value: unknown,
  label: string
): GenericRecord {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new HttpsError(
      "failed-precondition",
      `${label} must be an object.`
    );
  }

  return value as GenericRecord;
}

function asArray(
  value: unknown,
  label: string
): unknown[] {
  if (!Array.isArray(value)) {
    throw new HttpsError(
      "failed-precondition",
      `${label} must be an array.`
    );
  }

  return value;
}

function requireSuperAdmin(
  auth:
    | {
        uid: string;
        token: GenericRecord;
      }
    | undefined
): string {
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "Firebase authentication is required."
    );
  }

  const roles =
    strings(auth.token.roles);

  const allowed =
    text(auth.token.role) ===
      "superAdmin" ||
    text(auth.token.ulimRole) ===
      "superAdmin" ||
    text(auth.token.accountRole) ===
      "superAdmin" ||
    roles.includes("superAdmin");

  if (!allowed) {
    throw new HttpsError(
      "permission-denied",
      "superAdmin claim is required."
    );
  }

  return auth.uid;
}

function canonicalize(
  value: unknown
): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const output:
      GenericRecord = {};

    for (
      const key of
      Object.keys(
        value as GenericRecord
      ).sort()
    ) {
      output[key] =
        canonicalize(
          (
            value as GenericRecord
          )[key]
        );
    }

    return output;
  }

  return value;
}

function canonicalText(
  value: unknown
): string {
  return JSON.stringify(
    canonicalize(value)
  );
}

function sha256Text(
  value: string
): string {
  return createHash("sha256")
    .update(
      value,
      "utf8"
    )
    .digest("hex");
}

function sha256Buffer(
  value: Buffer
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function digestValue(
  value: unknown
): string {
  return sha256Text(
    canonicalText(value)
  );
}

function exactJson(
  left: unknown,
  right: unknown
): boolean {
  return canonicalText(left) ===
    canonicalText(right);
}

function allTrue(
  value: GenericRecord
): boolean {
  return Object.values(value)
    .every(
      (item) =>
        item === true
    );
}

function parseIsoMillis(
  value: unknown,
  label: string
): number {
  const parsed =
    Date.parse(
      text(value)
    );

  if (!Number.isFinite(parsed)) {
    throw new HttpsError(
      "failed-precondition",
      `${label} must be an ISO timestamp.`
    );
  }

  return parsed;
}

function addSecondsIso(
  baseMillis: number,
  seconds: number
): string {
  return new Date(
    baseMillis +
    seconds *
    1000
  ).toISOString();
}

function sleep(
  milliseconds: number
): Promise<void> {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

function expectedCounts():
  GenericRecord {
  return {
    sheetStudentRows:
      156,
    sheetPrincipalRows:
      12,
    sheetHeaderCells:
      2,
    sheetIdentityCells:
      168,
    sheetTotalTargetCells:
      170,
    principalAuthColumn9Anchors:
      12,
    attendanceDocuments:
      69,
    assignmentDocuments:
      14,
    firebaseAuthUsers:
      1,
    inPlaceAttendancePlans:
      68
  };
}

function correctedTotals():
  GenericRecord {
  return {
    sheetMutations:
      170,
    firestoreWrites:
      350,
    firebaseAuthWrites:
      1,
    logicalMutations:
      521
  };
}

function serializeValue(
  value: unknown
): unknown {
  if (value instanceof Timestamp) {
    return {
      __type:
        "Timestamp",
      seconds:
        value.seconds,
      nanoseconds:
        value.nanoseconds
    };
  }

  if (
    value instanceof
    DocumentReference
  ) {
    return {
      __type:
        "DocumentReference",
      path:
        value.path
    };
  }

  if (Buffer.isBuffer(value)) {
    return {
      __type:
        "Bytes",
      base64:
        (
          value as Buffer
        ).toString(
          "base64"
        )
    };
  }

  if (Array.isArray(value)) {
    return value.map(
      serializeValue
    );
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    const source =
      value as GenericRecord;

    if (
      typeof source.latitude ===
        "number" &&
      typeof source.longitude ===
        "number"
    ) {
      return {
        __type:
          "GeoPoint",
        latitude:
          source.latitude,
        longitude:
          source.longitude
      };
    }

    const output:
      GenericRecord = {};

    for (
      const [
        key,
        nested
      ] of
      Object.entries(
        source
      )
    ) {
      output[key] =
        serializeValue(
          nested
        );
    }

    return output;
  }

  return value;
}

function authSnapshot(
  user: UserRecord
): GenericRecord {
  return {
    uid:
      user.uid,
    disabled:
      user.disabled,
    email:
      user.email ||
      null,
    emailVerified:
      user.emailVerified,
    displayName:
      user.displayName ||
      null,
    phoneNumber:
      user.phoneNumber ||
      null,
    photoURL:
      user.photoURL ||
      null,
    customClaims:
      user.customClaims ||
      {},
    providerData:
      user.providerData.map(
        (provider) => ({
          uid:
            provider.uid,
          providerId:
            provider.providerId,
          email:
            provider.email ||
            null,
          displayName:
            provider.displayName ||
            null,
          phoneNumber:
            provider.phoneNumber ||
            null,
          photoURL:
            provider.photoURL ||
            null
        })
      ),
    stableMetadata: {
      creationTime:
        user.metadata.creationTime
    },
    tokensValidAfterTime:
      user.tokensValidAfterTime,
    passwordMaterialIncluded:
      false
  };
}

function blankCellState(
  value: unknown
): boolean {
  const state =
    asRecord(
      value,
      "cell state"
    );

  return (
    (
      state.rawValue ===
        "" ||
      state.rawValue ===
        null
    ) &&
    text(
      state.displayValue
    ) ===
      "" &&
    text(
      state.formula
    ) ===
      "" &&
    text(
      state.note
    ) ===
      ""
  );
}

function snapshotRefs(
  db: Firestore,
  cutoverRunId: string
): SnapshotRefs {
  const metadataRef =
    db.collection(
      "uidV2ProductionRollbackSnapshots"
    ).doc(
      cutoverRunId
    );

  return {
    metadataRef,
    chunkRef:
      metadataRef
        .collection(
          "payloadChunks"
        )
        .doc(
          "chunk-000000"
        ),
    verificationRef:
      metadataRef
        .collection(
          "verificationEvents"
        )
        .doc(
          "event-000000"
        )
  };
}

async function buildContext(
  callerUid: string
): Promise<ExecutionContext> {
  const db =
    getFirestore(
      defaultAdminApp()
    );

  const runRef =
    db.collection(
      "uidV2StagingRuns"
    ).doc(
      REQUEST_ID
    );

  const [
    phase4c22Snapshot,
    phase4c13Snapshot
  ] = await Promise.all([
    runRef
      .collection(
        "rebaseProductionExecutionBundleAssemblies"
      )
      .doc(
        "phase4c22r"
      )
      .get(),
    runRef
      .collection(
        "rebaseCellPatchPlans"
      )
      .doc(
        "phase4c13r-schema-c1"
      )
      .get()
  ]);

  if (
    !phase4c22Snapshot.exists ||
    !phase4c13Snapshot.exists
  ) {
    throw new HttpsError(
      "not-found",
      "Phase 4C-22R assembly or Phase 4C-13R patch plan is missing."
    );
  }

  const phase4c22Stored =
    phase4c22Snapshot.data() ||
    {};

  const phase4c22Core =
    asRecord(
      phase4c22Stored.assemblyCore,
      "phase4c22.assemblyCore"
    );

  const phase4c22Chain =
    asRecord(
      phase4c22Core.chainChecks,
      "phase4c22.chainChecks"
    );

  const phase4c22Blocking =
    asArray(
      phase4c22Core.blockingReasons,
      "phase4c22.blockingReasons"
    );

  const componentInventory =
    asRecord(
      phase4c22Core.componentInventory,
      "phase4c22.componentInventory"
    );

  const executionGate =
    asRecord(
      phase4c22Core.executionGate,
      "phase4c22.executionGate"
    );

  const priorEvidenceDigests =
    asRecord(
      phase4c22Core.priorEvidenceDigests,
      "phase4c22.priorEvidenceDigests"
    );

  const phase4c13Plan =
    phase4c13Snapshot.data() ||
    {};

  const chainChecks:
    GenericRecord = {
    phase4c22Status:
      text(
        phase4c22Stored.status
      ) ===
      "rebase_production_execution_bundle_assembly_staged",
    phase4c22Caller:
      text(
        phase4c22Stored.approvedByFirebaseUid
      ) ===
      callerUid,
    phase4c22Contract:
      text(
        phase4c22Stored.contractDigest
      ) ===
      EXPECTED_PHASE4C22_CONTRACT_DIGEST,
    phase4c22Core:
      text(
        phase4c22Stored.assemblyCoreDigest
      ) ===
      EXPECTED_PHASE4C22_CORE_DIGEST,
    phase4c22Package:
      text(
        phase4c22Stored.assemblyPackageDigest
      ) ===
      EXPECTED_PHASE4C22_PACKAGE_DIGEST,
    phase4c22StoredCore:
      digestValue(
        phase4c22Core
      ) ===
      EXPECTED_PHASE4C22_CORE_DIGEST,
    phase4c22Ready:
      phase4c22Core.assemblyReady ===
        true &&
      phase4c22Core.productionExecutionPackageAssembled ===
        true &&
      phase4c22Core.productionExecutionPackageExecutable ===
        false,
    phase4c22Chain:
      allTrue(
        phase4c22Chain
      ),
    phase4c22Blocking:
      phase4c22Blocking.length ===
      0,
    phase4c22NoExecutionComponents:
      componentInventory.productionLockControllerIncluded ===
        false &&
      componentInventory.maintenanceActivationControllerIncluded ===
        false &&
      componentInventory.freshCaptureExecutorIncluded ===
        false &&
      componentInventory.productionSnapshotPersistenceExecutorIncluded ===
        false &&
      componentInventory.finalLivePreflightExecutorIncluded ===
        false &&
      componentInventory.uidCutoverExecutorIncluded ===
        false &&
      componentInventory.rollbackExecutorIncluded ===
        false &&
      componentInventory.finalArmIssuerIncluded ===
        false,
    phase4c22NewConfirmationRequired:
      executionGate.newPhase4c23ExplicitExecutionConfirmationRequired ===
        true &&
      executionGate.phase4c23ExecutionConfirmationIssued ===
        false,
    phase4c22ApprovalToken:
      text(
        priorEvidenceDigests.phase4c17ApprovalTokenDigest
      ) ===
      EXPECTED_PHASE4C17_APPROVAL_TOKEN_DIGEST,
    phase4c22NoUidMutation:
      executionGate.uidMutationAllowedNow ===
        false &&
      executionGate.actualUidCutoverAllowed ===
        false &&
      phase4c22Core.actualUidCutoverAllowed ===
        false,
    phase4c13Status:
      text(
        phase4c13Plan.status
      ) ===
      "rebase_schema_corrected_cell_patch_plan_staged",
    phase4c13Caller:
      text(
        phase4c13Plan.approvedByFirebaseUid
      ) ===
      callerUid,
    phase4c13Plan:
      text(
        phase4c13Plan.planDigest
      ) ===
      EXPECTED_PHASE4C19_PLAN_DIGEST,
    phase4c13Count:
      asArray(
        phase4c13Plan.patches,
        "phase4c13.patches"
      ).length ===
      170
  };

  const blockingReasons =
    Object.entries(
      chainChecks
    )
      .filter(
        (
          [, passed]
        ) =>
          passed !== true
      )
      .map(
        (
          [key]
        ) =>
          key
      );

  if (
    blockingReasons.length >
    0
  ) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-23R chain validation failed: ${blockingReasons.join(", ")}`
    );
  }

  return {
    db,
    callerUid,
    runRef,
    sessionRef:
      runRef
        .collection(
          "rebaseProductionMaintenanceSnapshotExecutions"
        )
        .doc(
          "phase4c23r-71678"
        ),
    resultRef:
      runRef
        .collection(
          "rebaseProductionMaintenanceSnapshotExecutionResults"
        )
        .doc(
          "phase4c23r-71678"
        ),
    legacySessionRef:
      runRef
        .collection(
          "rebaseProductionMaintenanceSnapshotExecutions"
        )
        .doc(
          "phase4c23r"
        ),
    legacyResultRef:
      runRef
        .collection(
          "rebaseProductionMaintenanceSnapshotExecutionResults"
        )
        .doc(
          "phase4c23r"
        ),
    lockRef:
      db.collection(
        "uidV2CutoverExecutionLocks"
      ).doc(
        "phase4c17r-production"
      ),
    maintenanceRef:
      db.collection(
        "uidV2MaintenanceWindows"
      ).doc(
        "phase4c-production-cutover"
      ),
    phase4c13Plan,
    chainChecks,
    blockingReasons
  };
}

function validateSheetEnvelope(
  value: unknown,
  plan: GenericRecord,
  activeAtIso: string
): ValidSheetCapture {
  const envelope =
    asRecord(
      value,
      "sheetEnvelope"
    );

  const wrapper =
    asRecord(
      envelope.snapshot,
      "sheetEnvelope.snapshot"
    );

  const wrapperDigest =
    text(
      envelope.snapshotDigest
    );

  if (
    wrapperDigest !==
    digestValue(
      wrapper
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Phase 4C-23R wrapper digest mismatch."
    );
  }

  const sourceEnvelope =
    asRecord(
      wrapper.sourcePhase4c19Envelope,
      "sourcePhase4c19Envelope"
    );

  const sourceSnapshot =
    asRecord(
      sourceEnvelope.snapshot,
      "sourcePhase4c19Envelope.snapshot"
    );

  const sourceSnapshotDigest =
    text(
      sourceEnvelope.snapshotDigest
    );

  if (
    sourceSnapshotDigest !==
    digestValue(
      sourceSnapshot
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Nested Phase 4C-19R Sheet snapshot digest mismatch."
    );
  }

  const cells =
    asArray(
      sourceSnapshot.rollbackCells,
      "rollbackCells"
    ).map(
      (
        item,
        index
      ) =>
        asRecord(
          item,
          `rollbackCell${index}`
        )
    );

  const anchors =
    asArray(
      sourceSnapshot.principalAuthColumn9Anchors,
      "principalAuthColumn9Anchors"
    ).map(
      (
        item,
        index
      ) =>
        asRecord(
          item,
          `principalAnchor${index}`
        )
    );

  const planIds =
    asArray(
      plan.patches,
      "phase4c13.patches"
    )
      .map(
        (item) =>
          text(
            asRecord(
              item,
              "phase4c13.patch"
            ).patchId
          )
      )
      .sort();

  const capturedIds =
    cells
      .map(
        (item) =>
          text(
            item.patchId
          )
      )
      .sort();

  const seen =
    new Set<string>();

  for (
    const cell of
    cells
  ) {
    const coordinate =
      [
        cell.sheetId,
        cell.rowNumber,
        cell.columnNumber
      ].join("|");

    if (
      seen.has(
        coordinate
      ) ||
      cell.targetCellBlank !==
        true ||
      !blankCellState(
        cell.beforeState
      ) ||
      text(
        cell.beforeStateDigest
      ) !==
        digestValue(
          cell.beforeState
        )
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Unsafe Sheet rollback cell: ${text(cell.patchId)}`
      );
    }

    seen.add(
      coordinate
    );
  }

  const sourceCounts =
    asRecord(
      sourceSnapshot.counts,
      "sourceSnapshot.counts"
    );

  const sourceVerification =
    asRecord(
      sourceSnapshot.verification,
      "sourceSnapshot.verification"
    );

  const sourceSafety =
    asRecord(
      sourceSnapshot.safety,
      "sourceSnapshot.safety"
    );

  const wrapperSafety =
    asRecord(
      wrapper.safety,
      "wrapper.safety"
    );

  const capturedAtIso =
    text(
      wrapper.generatedAtIso
    );

  const capturedAtMillis =
    parseIsoMillis(
      capturedAtIso,
      "wrapper.generatedAtIso"
    );

  const activeAtMillis =
    parseIsoMillis(
      activeAtIso,
      "maintenance.activeAtIso"
    );

  const ageSeconds =
    (
      Date.now() -
      capturedAtMillis
    ) /
    1000;

  const checks:
    GenericRecord = {
    wrapperVersion:
      text(
        wrapper.version
      ) ===
      UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
    wrapperPhase:
      text(
        wrapper.phase
      ) ===
      "Phase 4C-23R",
    wrapperRequest:
      text(
        wrapper.requestId
      ) ===
      REQUEST_ID,
    wrapperContract:
      text(
        wrapper.contractDigest
      ) ===
      CONTRACT_DIGEST,
    sourceVersion:
      text(
        sourceSnapshot.version
      ) ===
      "2026-07-28.716.70-phase4c19r-fresh-live-baseline-rollback-snapshot-capture-rehearsal-only",
    sourcePhase:
      text(
        sourceSnapshot.phase
      ) ===
      "Phase 4C-19R",
    sourceRequest:
      text(
        sourceSnapshot.requestId
      ) ===
      REQUEST_ID,
    sourceContract:
      text(
        sourceSnapshot.contractDigest
      ) ===
      EXPECTED_PHASE4C19_CONTRACT_DIGEST,
    sourcePlan:
      text(
        sourceSnapshot.phase4c13PlanDigest
      ) ===
      EXPECTED_PHASE4C19_PLAN_DIGEST,
    sourceTimestampStable:
      text(
        sourceSnapshot.sourceFileLastUpdatedBeforeIso
      ) !==
        "" &&
      text(
        sourceSnapshot.sourceFileLastUpdatedBeforeIso
      ) ===
      text(
        sourceSnapshot.sourceFileLastUpdatedAfterIso
      ),
    captureAfterMaintenanceActive:
      capturedAtMillis >=
      activeAtMillis,
    captureNotFuture:
      capturedAtMillis <=
      Date.now() +
      30000,
    captureFresh:
      ageSeconds >=
        0 &&
      ageSeconds <=
        FRESH_SNAPSHOT_AGE_LIMIT_SECONDS,
    studentRows:
      numberValue(
        sourceCounts.studentRows
      ) ===
      156,
    principalRows:
      numberValue(
        sourceCounts.principalRows
      ) ===
      12,
    totalCells:
      numberValue(
        sourceCounts.totalTargetCells
      ) ===
      170,
    cells:
      cells.length ===
      170,
    anchors:
      anchors.length ===
      12,
    patchIds:
      exactJson(
        capturedIds,
        planIds
      ),
    targetCellsBlank:
      sourceVerification.targetCellsBlank ===
      true,
    appendColumnVerified:
      sourceVerification.appendColumnPreconditionVerified ===
      true,
    targetCellsUnique:
      sourceVerification.targetCellsUnique ===
      true,
    principalAuthCaptured:
      sourceVerification.principalAuthColumn9Captured ===
      true,
    sourceTimestampUnchanged:
      sourceVerification.sourceFileTimestampUnchanged ===
      true,
    sourceSheetWritesZero:
      numberValue(
        sourceSafety.sourceSheetWrites
      ) ===
      0,
    wrapperSheetWritesZero:
      numberValue(
        wrapperSafety.sourceSheetWrites
      ) ===
      0,
    wrapperNoUidMutation:
      numberValue(
        wrapperSafety.uidMutationWrites
      ) ===
        0 &&
      wrapperSafety.actualUidCutoverAllowed ===
        false
  };

  if (!allTrue(checks)) {
    const failed =
      Object.entries(
        checks
      )
        .filter(
          (
            [, passed]
          ) =>
            passed !== true
        )
        .map(
          (
            [key]
          ) =>
            key
        );

    throw new HttpsError(
      "failed-precondition",
      `Fresh Sheet capture validation failed: ${failed.join(", ")}`
    );
  }

  return {
    wrapper,
    wrapperDigest,
    sourceSnapshot,
    sourceSnapshotDigest,
    cells,
    anchors,
    capturedAtIso
  };
}

async function captureProductionPayload(
  context: ExecutionContext,
  sheet: ValidSheetCapture
): Promise<CapturedPayload> {
  const [
    attendanceIndex,
    assignmentIndex,
    authIndex,
    inPlaceIndex,
    rollbackMeta
  ] = await Promise.all([
    context.runRef
      .collection(
        "rollbackAttendanceDocuments"
      )
      .get(),
    context.runRef
      .collection(
        "rollbackAssignmentDocuments"
      )
      .get(),
    context.runRef
      .collection(
        "rollbackFirebaseAuthUsers"
      )
      .get(),
    context.runRef
      .collection(
        "inPlaceAttendancePlans"
      )
      .get(),
    context.runRef
      .collection(
        "rollbackMeta"
      )
      .doc(
        "snapshot"
      )
      .get()
  ]);

  if (
    attendanceIndex.size !==
      69 ||
    assignmentIndex.size !==
      14 ||
    authIndex.size !==
      1 ||
    inPlaceIndex.size !==
      68 ||
    !rollbackMeta.exists
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Rollback index count validation failed."
    );
  }

  const attendanceEntries =
    attendanceIndex.docs
      .map(
        (document) =>
          asRecord(
            document.data(),
            "attendance index"
          )
      )
      .sort(
        (
          left,
          right
        ) =>
          text(
            left.sourcePath
          ).localeCompare(
            text(
              right.sourcePath
            )
          )
      );

  const assignmentEntries =
    assignmentIndex.docs
      .map(
        (document) =>
          asRecord(
            document.data(),
            "assignment index"
          )
      )
      .sort(
        (
          left,
          right
        ) =>
          text(
            left.sourcePath
          ).localeCompare(
            text(
              right.sourcePath
            )
          )
      );

  const inPlacePlans =
    inPlaceIndex.docs
      .map(
        (document) => ({
          id:
            document.id,
          data:
            document.data()
        })
      )
      .sort(
        (
          left,
          right
        ) =>
          left.id.localeCompare(
            right.id
          )
      );

  const attendanceRefs =
    attendanceEntries.map(
      (entry) =>
        context.db.doc(
          text(
            entry.sourcePath
          )
        )
    );

  const assignmentSourceRefs =
    assignmentEntries.map(
      (entry) =>
        context.db.doc(
          text(
            entry.sourcePath
          )
        )
    );

  const assignmentTargetRefs =
    assignmentEntries.map(
      (entry) =>
        context.db.doc(
          text(
            entry.targetPath
          )
        )
    );

  const [
    attendanceSnapshots,
    assignmentSourceSnapshots,
    assignmentTargetSnapshots
  ] = await Promise.all([
    Promise.all(
      attendanceRefs.map(
        (reference) =>
          reference.get()
      )
    ),
    Promise.all(
      assignmentSourceRefs.map(
        (reference) =>
          reference.get()
      )
    ),
    Promise.all(
      assignmentTargetRefs.map(
        (reference) =>
          reference.get()
      )
    )
  ]);

  const attendance =
    attendanceSnapshots.map(
      (
        snapshot,
        index
      ) => {
        if (!snapshot.exists) {
          throw new HttpsError(
            "failed-precondition",
            `Missing attendance document: ${attendanceRefs[index].path}`
          );
        }

        const beforeData =
          serializeValue(
            snapshot.data() ||
            {}
          );

        return {
          sourcePath:
            attendanceRefs[index].path,
          beforeData,
          beforeDigest:
            digestValue(
              beforeData
            )
        };
      }
    );

  const assignments =
    assignmentSourceSnapshots.map(
      (
        snapshot,
        index
      ) => {
        if (!snapshot.exists) {
          throw new HttpsError(
            "failed-precondition",
            `Missing assignment document: ${assignmentSourceRefs[index].path}`
          );
        }

        if (
          assignmentTargetSnapshots[
            index
          ].exists
        ) {
          throw new HttpsError(
            "failed-precondition",
            `Assignment target already exists: ${assignmentTargetRefs[index].path}`
          );
        }

        const beforeData =
          serializeValue(
            snapshot.data() ||
            {}
          );

        return {
          sourcePath:
            assignmentSourceRefs[
              index
            ].path,
          targetPath:
            assignmentTargetRefs[
              index
            ].path,
          beforeData,
          beforeDigest:
            digestValue(
              beforeData
            )
        };
      }
    );

  const authEntry =
    asRecord(
      authIndex.docs[0].data(),
      "firebase auth rollback index"
    );

  const sourceFirebaseUid =
    text(
      authEntry.sourceFirebaseUid
    );

  const targetFirebaseUid =
    text(
      authEntry.targetFirebaseUid
    );

  const auth =
    getAuth(
      defaultAdminApp()
    );

  const sourceUser =
    await auth.getUser(
      sourceFirebaseUid
    );

  let targetExists =
    false;

  try {
    await auth.getUser(
      targetFirebaseUid
    );

    targetExists =
      true;
  }
  catch (error) {
    if (
      text(
        (
          error as {
            code?: unknown;
          }
        ).code
      ) !==
      "auth/user-not-found"
    ) {
      throw error;
    }
  }

  if (targetExists) {
    throw new HttpsError(
      "failed-precondition",
      "Target Firebase Auth user already exists."
    );
  }

  const authBeforeData =
    authSnapshot(
      sourceUser
    );

  const firebaseAuth =
    {
      sourceFirebaseUid,
      targetFirebaseUid,
      beforeData:
        authBeforeData,
      beforeDigest:
        digestValue(
          authBeforeData
        )
    };

  const payload =
    {
      version:
        UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
      phase:
        "Phase 4C-23R",
      mode:
        "production_fresh_rollback_snapshot_payload",
      requestId:
        REQUEST_ID,
      containsSensitiveProductionData:
        true,
      passwordMaterialIncluded:
        false,
      sheet: {
        phase4c23WrapperDigest:
          sheet.wrapperDigest,
        sourcePhase4c19SnapshotDigest:
          sheet.sourceSnapshotDigest,
        capturedAtIso:
          sheet.capturedAtIso,
        rollbackCells:
          sheet.cells,
        principalAuthColumn9Anchors:
          sheet.anchors
      },
      attendance,
      assignments,
      firebaseAuth,
      inPlaceAttendancePlans:
        inPlacePlans
    };

  const serializedPayload =
    serializeValue(
      payload
    ) as GenericRecord;

  const canonical =
    canonicalText(
      serializedPayload
    );

  const canonicalBytes =
    Buffer.byteLength(
      canonical,
      "utf8"
    );

  if (
    canonicalBytes >
    MAXIMUM_CANONICAL_BYTES
  ) {
    throw new HttpsError(
      "resource-exhausted",
      `Fresh Rollback Snapshot exceeds the 8 MB limit: ${canonicalBytes}`
    );
  }

  const compressed =
    gzipSync(
      Buffer.from(
        canonical,
        "utf8"
      ),
      {
        level:
          9
      }
    );

  const encoded =
    compressed.toString(
      "base64"
    );

  const chunks:
    string[] = [];

  for (
    let offset = 0;
    offset <
    encoded.length;
    offset +=
    MAXIMUM_CHUNK_BYTES
  ) {
    chunks.push(
      encoded.slice(
        offset,
        offset +
        MAXIMUM_CHUNK_BYTES
      )
    );
  }

  if (
    chunks.length !==
    REQUIRED_CURRENT_CHUNK_COUNT
  ) {
    throw new HttpsError(
      "resource-exhausted",
      `Phase 4C-23R requires exactly one current chunk; found ${chunks.length}.`
    );
  }

  const firestoreSnapshot =
    {
      attendance,
      assignments,
      inPlaceAttendancePlans:
        inPlacePlans
    };

  return {
    serializedPayload,
    canonicalText:
      canonical,
    canonicalBytes,
    compressed,
    compressedBytes:
      compressed.byteLength,
    encoded,
    encodedBytes:
      Buffer.byteLength(
        encoded,
        "utf8"
      ),
    chunks,
    chunkDigests:
      chunks.map(
        sha256Text
      ),
    canonicalSha256:
      sha256Text(
        canonical
      ),
    compressedSha256:
      sha256Buffer(
        compressed
      ),
    sheetSnapshotDigest:
      sheet.wrapperDigest,
    firestoreSnapshotDigest:
      digestValue(
        firestoreSnapshot
      ),
    firebaseAuthSnapshotDigest:
      digestValue(
        firebaseAuth
      ),
    rollbackSnapshotDigest:
      digestValue(
        serializedPayload
      ),
    counts:
      expectedCounts()
  };
}

function resultSafety():
  GenericRecord {
  return {
    sourceSheetWrites:
      0,
    activeUidRegistryWrites:
      0,
    attendanceWrites:
      0,
    assignmentWrites:
      0,
    firebaseAuthWrites:
      0,
    sessionAuthChanges:
      0,
    uidMutationWrites:
      0,
    finalArmTokenWrites:
      0,
    cutoverExecutionCallableIncluded:
      false,
    rollbackMutationCallableIncluded:
      false,
    actualUidCutoverAllowed:
      false
  };
}

async function promoteArmingSession(
  context: ExecutionContext,
  callerUid: string,
  cutoverRunId: string,
  drainUntilIso: string
): Promise<GenericRecord> {
  const remainingMilliseconds =
    Math.max(
      0,
      parseIsoMillis(
        drainUntilIso,
        "session.drainUntilIso"
      ) -
      Date.now() +
      1000
    );

  if (
    remainingMilliseconds >
    0
  ) {
    await sleep(
      remainingMilliseconds
    );
  }

  const beforePromotion =
    await context.sessionRef.get();

  if (beforePromotion.exists) {
    const current =
      beforePromotion.data() ||
      {};

    if (
      [
        "maintenance_active_waiting_sheet_capture",
        "snapshot_retained_waiting_final_preflight"
      ].includes(
        text(
          current.state
        )
      )
    ) {
      return current;
    }
  }

  const activeAtIso =
    new Date().toISOString();

  const captureDeadlineIso =
    addSecondsIso(
      Date.parse(
        activeAtIso
      ),
      FRESH_SNAPSHOT_AGE_LIMIT_SECONDS
    );

  await context.db.runTransaction(
    async (transaction) => {
      const [
        sessionSnapshot,
        lockSnapshot,
        maintenanceSnapshot
      ] = await Promise.all([
        transaction.get(
          context.sessionRef
        ),
        transaction.get(
          context.lockRef
        ),
        transaction.get(
          context.maintenanceRef
        )
      ]);

      if (
        !sessionSnapshot.exists ||
        !lockSnapshot.exists ||
        !maintenanceSnapshot.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-23R arming documents disappeared during drain."
        );
      }

      const session =
        sessionSnapshot.data() ||
        {};

      const lock =
        lockSnapshot.data() ||
        {};

      const maintenance =
        maintenanceSnapshot.data() ||
        {};

      if (
        [
          "maintenance_active_waiting_sheet_capture",
          "snapshot_retained_waiting_final_preflight"
        ].includes(
          text(
            session.state
          )
        )
      ) {
        return;
      }

      const checks:
        GenericRecord = {
      sessionState:
        text(
          session.state
        ) ===
        "arming",
      maintenanceState:
        text(
          maintenance.state
        ) ===
        "arming",
      lockState:
        text(
          lock.state
        ) ===
        "owned",
      sessionCaller:
        text(
          session.approvedByFirebaseUid
        ) ===
        callerUid,
      lockCaller:
        text(
          lock.approvedByFirebaseUid
        ) ===
        callerUid,
      maintenanceCaller:
        text(
          maintenance.approvedByFirebaseUid
        ) ===
        callerUid,
      cutoverRunId:
        text(
          session.cutoverRunId
        ) ===
          cutoverRunId &&
        text(
          lock.cutoverRunId
        ) ===
          cutoverRunId &&
        text(
          maintenance.cutoverRunId
        ) ===
          cutoverRunId,
      drainElapsed:
        parseIsoMillis(
          session.drainUntilIso,
          "session.drainUntilIso"
        ) <=
        Date.now(),
      leaseValid:
        parseIsoMillis(
          lock.leaseExpiresAtIso,
          "lock.leaseExpiresAtIso"
        ) >
        Date.now()
      };

      if (!allTrue(
        checks
      )) {
        throw new HttpsError(
          "failed-precondition",
          `Maintenance activation after drain failed: ${
            Object.entries(checks)
              .filter(
                (
                  [, passed]
                ) =>
                  passed !==
                  true
              )
              .map(
                (
                  [key]
                ) =>
                  key
              )
              .join(", ")
          }`
        );
      }

      transaction.set(
        context.lockRef,
        {
          ...lock,
          state:
            "owned",
          heartbeatAtIso:
            activeAtIso,
          updatedAtIso:
            activeAtIso
        }
      );

      transaction.set(
        context.maintenanceRef,
        {
          ...maintenance,
          state:
            "active",
          activeAtIso,
          heartbeatAtIso:
            activeAtIso,
          writeFreezeConfirmed:
            true,
          drainCompleted:
            true,
          productionRollbackSnapshotPersisted:
            false,
          uidMutationWrites:
            0,
          updatedAtIso:
            activeAtIso
        }
      );

      transaction.set(
        context.sessionRef,
        {
          ...session,
          state:
            "maintenance_active_waiting_sheet_capture",
          maintenanceState:
            "active",
          activeAtIso,
          captureDeadlineIso,
          productionExecutionLockOwned:
            true,
          productionMaintenanceWindowActive:
            true,
          productionRollbackSnapshotPersisted:
            false,
          uidMutationWrites:
            0,
          updatedAtIso:
            activeAtIso
        }
      );
    }
  );

  const activeSessionSnapshot =
    await context.sessionRef.get();

  if (!activeSessionSnapshot.exists) {
    throw new HttpsError(
      "data-loss",
      "Phase 4C-23R active session is missing after promotion."
    );
  }

  return activeSessionSnapshot.data() ||
    {};
}

function publicActivation(
  session: GenericRecord,
  duplicate: boolean,
  writeOperations: number
): GenericRecord {
  return {
    ok:
      true,
    version:
      UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
    phase:
      "Phase 4C-23R",
    mode:
      "rebase156_production_maintenance_fresh_snapshot_recovery_new_session_after_emergency_release_no_uid_mutation",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    contractDigest:
      CONTRACT_DIGEST,
    cutoverRunId:
      text(
        session.cutoverRunId
      ),
    state:
      text(
        session.state
      ),
    maintenanceState:
      text(
        session.maintenanceState
      ),
    activeAtIso:
      text(
        session.activeAtIso
      ),
    captureDeadlineIso:
      text(
        session.captureDeadlineIso
      ),
    leaseExpiresAtIso:
      text(
        session.leaseExpiresAtIso
      ),
    operatorAttestation: {
      maintenanceGuardVerificationMode:
        "operator_attestation_only",
      maintenanceGuardDeployed:
        session.maintenanceGuardDeployed ===
        true,
      lowTrafficWindowConfirmed:
        session.lowTrafficWindowConfirmed ===
        true
    },
    productionExecutionLockOwned:
      true,
    productionMaintenanceWindowActive:
      text(
        session.maintenanceState
      ) ===
      "active",
    productionRollbackSnapshotPersisted:
      session.productionRollbackSnapshotPersisted ===
      true,
    uidMutationWrites:
      0,
    actualUidCutoverAllowed:
      false,
    nextAction:
      "Run u156ProductionRollbackCaptureFile(), select the JSON in the Phase 4C-23R panel, and persist the snapshot."
  };
}

function publicResult(
  stored: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean,
  snapshotAgeSeconds: number
): GenericRecord {
  const result =
    asRecord(
      stored.result,
      "stored.result"
    );

  return {
    ok:
      true,
    version:
      UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
    phase:
      "Phase 4C-23R",
    mode:
      "rebase156_production_maintenance_fresh_snapshot_recovery_new_session_after_emergency_release_no_uid_mutation",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    status:
      text(
        stored.status
      ),
    contractDigest:
      CONTRACT_DIGEST,
    resultDigest:
      text(
        stored.resultDigest
      ),
    cutoverRunId:
      result.cutoverRunId,
    snapshotPath:
      result.snapshotPath,
    snapshotMetadataDigest:
      result.snapshotMetadataDigest,
    snapshotVerificationDigest:
      result.snapshotVerificationDigest,
    freshSheetSnapshotDigest:
      result.freshSheetSnapshotDigest,
    freshFirestoreSnapshotDigest:
      result.freshFirestoreSnapshotDigest,
    freshFirebaseAuthSnapshotDigest:
      result.freshFirebaseAuthSnapshotDigest,
    freshRollbackSnapshotDigest:
      result.freshRollbackSnapshotDigest,
    canonicalSha256:
      result.canonicalSha256,
    compressedSha256:
      result.compressedSha256,
    chunkDigests:
      result.chunkDigests,
    canonicalBytes:
      result.canonicalBytes,
    compressedBytes:
      result.compressedBytes,
    encodedBytes:
      result.encodedBytes,
    chunkCount:
      result.chunkCount,
    counts:
      result.counts,
    correctedProjectedTotals:
      result.correctedProjectedTotals,
    chainChecks:
      result.chainChecks,
    blockingReasons:
      result.blockingReasons,
    maintenanceGuardVerificationMode:
      result.maintenanceGuardVerificationMode,
    productionExecutionLockOwned:
      result.productionExecutionLockOwned,
    productionMaintenanceWindowActive:
      result.productionMaintenanceWindowActive,
    productionRollbackSnapshotPersisted:
      result.productionRollbackSnapshotPersisted,
    productionRollbackSnapshotSealed:
      result.productionRollbackSnapshotSealed,
    productionRollbackSnapshotRetained:
      result.productionRollbackSnapshotRetained,
    sourceSheetWrites:
      result.sourceSheetWrites,
    activeUidRegistryWrites:
      result.activeUidRegistryWrites,
    attendanceWrites:
      result.attendanceWrites,
    assignmentWrites:
      result.assignmentWrites,
    firebaseAuthWrites:
      result.firebaseAuthWrites,
    sessionAuthChanges:
      result.sessionAuthChanges,
    uidMutationWrites:
      result.uidMutationWrites,
    finalArmTokenIssued:
      result.finalArmTokenIssued,
    actualExecutionWrites:
      result.actualExecutionWrites,
    snapshotCapturedAtIso:
      result.snapshotCapturedAtIso,
    snapshotAgeSeconds,
    snapshotWithinFinalGateAgeLimit:
      snapshotAgeSeconds >=
        0 &&
      snapshotAgeSeconds <=
        FRESH_SNAPSHOT_AGE_LIMIT_SECONDS,
    verified,
    digestMatches:
      verified,
    safety: {
      inspectWrites:
        writeOperations,
      sourceSheetWrites:
        0,
      activeUidRegistryWrites:
        0,
      attendanceWrites:
        0,
      assignmentWrites:
        0,
      firebaseAuthWrites:
        0,
      sessionAuthChanges:
        0,
      uidMutationWrites:
        0,
      finalArmTokenWrites:
        0,
      cutoverExecutionCallableIncluded:
        false,
      rollbackMutationCallableIncluded:
        false,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        NEXT_GATE_PHASE,
      allowed:
        verified &&
        snapshotAgeSeconds >=
          0 &&
        snapshotAgeSeconds <=
          FRESH_SNAPSHOT_AGE_LIMIT_SECONDS,
      maintenanceMustRemainActive:
        true,
      productionLockMustRemainOwned:
        true,
      uidMutationAllowed:
        false,
      actualUidCutoverAllowed:
        false
    }
  };
}

export const activateUidV2MaintenanceSnapshotPhase4c23r =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        240,
      memory:
        "512MiB",
      enforceAppCheck:
        false
    },
    async (request) => {
      const callerUid =
        requireSuperAdmin(
          request.auth as
            | {
                uid: string;
                token: GenericRecord;
              }
            | undefined
        );

      const input =
        request.data &&
        typeof request.data ===
          "object"
          ? request.data as
              ActivationInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          CONTRACT_DIGEST ||
        text(
          input.activationPhrase
        ) !==
          ACTIVATION_PHRASE ||
        input.confirmMaintenanceGuardDeployed !==
          true ||
        input.confirmCurrentLowTrafficWindow !==
          true ||
        input.confirmNoUidMutation !==
          true ||
        input.confirmEmergencyReleaseUnderstood !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-23R explicit activation gate failed."
        );
      }

      const context =
        await buildContext(
          callerUid
        );

      const existingSession =
        await context.sessionRef.get();

      if (existingSession.exists) {
        const session =
          existingSession.data() ||
          {};

        const duplicateChecks:
          GenericRecord = {
        caller:
          text(
            session.approvedByFirebaseUid
          ) ===
          callerUid,
        contract:
          text(
            session.contractDigest
          ) ===
          CONTRACT_DIGEST,
        supportedState:
          [
            "arming",
            "maintenance_active_waiting_sheet_capture",
            "snapshot_retained_waiting_final_preflight"
          ].includes(
            text(
              session.state
            )
          ),
        noUidMutation:
          numberValue(
            session.uidMutationWrites
          ) ===
          0
        };

        if (!allTrue(
          duplicateChecks
        )) {
          throw new HttpsError(
            "already-exists",
            "An incompatible Phase 4C-23R execution session already exists."
          );
        }

        if (
          text(
            session.state
          ) ===
          "arming"
        ) {
          const promoted =
            await promoteArmingSession(
              context,
              callerUid,
              text(
                session.cutoverRunId
              ),
              text(
                session.drainUntilIso
              )
            );

          return publicActivation(
            promoted,
            true,
            3
          );
        }

        return publicActivation(
          session,
          true,
          0
        );
      }

      const legacySessionPreflight =
        await context.legacySessionRef.get();

      if (!legacySessionPreflight.exists) {
        throw new HttpsError(
          "failed-precondition",
          "The released Phase 4C-23R legacy session was not found."
        );
      }

      const legacySessionData =
        legacySessionPreflight.data() ||
        {};

      const legacyCutoverRunId =
        text(
          legacySessionData.cutoverRunId
        );

      if (
        legacyCutoverRunId !==
        EXPECTED_LEGACY_CUTOVER_RUN_ID
      ) {
        throw new HttpsError(
          "failed-precondition",
          "The released Phase 4C-23R cutoverRunId does not match the recovery evidence."
        );
      }

      const legacySnapshotRef =
        context.db
          .collection(
            "uidV2ProductionRollbackSnapshots"
          )
          .doc(
            legacyCutoverRunId
          );

      const nowMillis =
        Date.now();

      const cutoverRunId =
        [
          "phase4c23r",
          nowMillis.toString(36),
          randomBytes(8).toString("hex")
        ].join("-");

      const armingAtIso =
        new Date(
          nowMillis
        ).toISOString();

      const drainUntilIso =
        addSecondsIso(
          nowMillis,
          DRAIN_SECONDS
        );

      const leaseExpiresAtIso =
        addSecondsIso(
          nowMillis,
          LEASE_SECONDS
        );

      await context.db.runTransaction(
        async (transaction) => {
          const [
            currentSession,
            currentResult,
            currentLock,
            currentMaintenance,
            legacySession,
            legacyResult,
            legacySnapshot
          ] = await Promise.all([
            transaction.get(
              context.sessionRef
            ),
            transaction.get(
              context.resultRef
            ),
            transaction.get(
              context.lockRef
            ),
            transaction.get(
              context.maintenanceRef
            ),
            transaction.get(
              context.legacySessionRef
            ),
            transaction.get(
              context.legacyResultRef
            ),
            transaction.get(
              legacySnapshotRef
            )
          ]);

          if (
            currentSession.exists ||
            currentResult.exists
          ) {
            throw new HttpsError(
              "already-exists",
              "A Phase 4C-23R recovery session or result already exists."
            );
          }

          if (currentLock.exists) {
            throw new HttpsError(
              "already-exists",
              "The production UID cutover lock is already owned."
            );
          }

          if (
            !currentMaintenance.exists ||
            text(
              (
                currentMaintenance.data() ||
                {}
              ).state
            ) !==
            "inactive"
          ) {
            throw new HttpsError(
              "failed-precondition",
              "The production maintenance window is not inactive after emergency release."
            );
          }

          if (
            !legacySession.exists ||
            legacyResult.exists ||
            legacySnapshot.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Legacy recovery artifacts are not in the expected released-without-snapshot state."
            );
          }

          const legacy =
            legacySession.data() ||
            {};

          const legacyChecks:
            GenericRecord = {
          state:
            text(
              legacy.state
            ) ===
            "emergency_released",
          maintenanceState:
            text(
              legacy.maintenanceState
            ) ===
            "inactive",
          contract:
            text(
              legacy.contractDigest
            ) ===
            EXPECTED_LEGACY_CONTRACT_DIGEST,
          cutoverRunId:
            text(
              legacy.cutoverRunId
            ) ===
            EXPECTED_LEGACY_CUTOVER_RUN_ID,
          noLock:
            legacy.productionExecutionLockOwned ===
            false,
          noMaintenance:
            legacy.productionMaintenanceWindowActive ===
            false,
          noUidMutation:
            numberValue(
              legacy.uidMutationWrites
            ) ===
            0
          };

          if (!allTrue(
            legacyChecks
          )) {
            throw new HttpsError(
              "failed-precondition",
              `Emergency-release recovery validation failed: ${
                Object.entries(
                  legacyChecks
                )
                  .filter(
                    (
                      [, passed]
                    ) =>
                      passed !==
                      true
                  )
                  .map(
                    (
                      [key]
                    ) =>
                      key
                  )
                  .join(", ")
              }`
            );
          }

          transaction.set(
            context.lockRef,
            {
              version:
                UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
              phase:
                "Phase 4C-23R",
              requestId:
                REQUEST_ID,
              contractDigest:
                CONTRACT_DIGEST,
              cutoverRunId,
              state:
                "owned",
              approvedByFirebaseUid:
                callerUid,
              acquiredAtIso:
                armingAtIso,
              heartbeatAtIso:
                armingAtIso,
              leaseExpiresAtIso,
              leaseSeconds:
                LEASE_SECONDS,
              heartbeatSeconds:
                HEARTBEAT_SECONDS,
              recoveryHotfixVersion:
                "71678",
              recoveredFromCutoverRunId:
                EXPECTED_LEGACY_CUTOVER_RUN_ID,
              emergencyReleaseEvidenceDigest:
                EXPECTED_EMERGENCY_RELEASE_RESULT_FILE_DIGEST,
              uidMutationWrites:
                0,
              actualUidCutoverAllowed:
                false
            }
          );

          transaction.set(
            context.maintenanceRef,
            {
              version:
                UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
              phase:
                "Phase 4C-23R",
              requestId:
                REQUEST_ID,
              contractDigest:
                CONTRACT_DIGEST,
              cutoverRunId,
              state:
                "arming",
              failureState:
                "failed_closed",
              approvedByFirebaseUid:
                callerUid,
              armingAtIso,
              drainUntilIso,
              leaseExpiresAtIso,
              drainSeconds:
                DRAIN_SECONDS,
              leaseSeconds:
                LEASE_SECONDS,
              heartbeatSeconds:
                HEARTBEAT_SECONDS,
              automaticDeactivationOnLeaseExpiry:
                false,
              readAvailability:
                true,
              maintenanceGuardVerificationMode:
                "operator_attestation_only",
              maintenanceGuardDeployed:
                true,
              lowTrafficWindowConfirmed:
                true,
              recoveryHotfixVersion:
                "71678",
              recoveredFromCutoverRunId:
                EXPECTED_LEGACY_CUTOVER_RUN_ID,
              emergencyReleaseEvidenceDigest:
                EXPECTED_EMERGENCY_RELEASE_RESULT_FILE_DIGEST,
              uidMutationWrites:
                0,
              actualUidCutoverAllowed:
                false
            }
          );

          transaction.set(
            context.sessionRef,
            {
              version:
                UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
              phase:
                "Phase 4C-23R",
              mode:
                "rebase156_production_maintenance_fresh_snapshot_recovery_new_session_after_emergency_release_no_uid_mutation",
              requestId:
                REQUEST_ID,
              contractDigest:
                CONTRACT_DIGEST,
              phase4c22AssemblyCoreDigest:
                EXPECTED_PHASE4C22_CORE_DIGEST,
              phase4c22AssemblyPackageDigest:
                EXPECTED_PHASE4C22_PACKAGE_DIGEST,
              approvedByFirebaseUid:
                callerUid,
              cutoverRunId,
              state:
                "arming",
              maintenanceState:
                "arming",
              armingAtIso,
              drainUntilIso,
              leaseExpiresAtIso,
              maintenanceGuardVerificationMode:
                "operator_attestation_only",
              maintenanceGuardDeployed:
                true,
              lowTrafficWindowConfirmed:
                true,
              emergencyReleaseUnderstood:
                true,
              recoveryHotfixVersion:
                "71678",
              recoveredFromCutoverRunId:
                EXPECTED_LEGACY_CUTOVER_RUN_ID,
              legacyReleasedSessionDocument:
                "phase4c23r",
              legacyResultWasAbsent:
                true,
              legacySnapshotWasAbsent:
                true,
              emergencyReleaseEvidenceDigest:
                EXPECTED_EMERGENCY_RELEASE_RESULT_FILE_DIGEST,
              productionExecutionLockOwned:
                true,
              productionRollbackSnapshotPersisted:
                false,
              uidMutationWrites:
                0,
              chainChecks:
                context.chainChecks,
              blockingReasons:
                context.blockingReasons,
              actualUidCutoverAllowed:
                false,
              createdAtIso:
                armingAtIso,
              updatedAtIso:
                armingAtIso
            }
          );
        }
      );

      const activeSession =
        await promoteArmingSession(
          context,
          callerUid,
          cutoverRunId,
          drainUntilIso
        );

      return publicActivation(
        activeSession,
        false,
        ACTIVATION_WRITE_OPERATIONS
      );
    }
  );

export const heartbeatUidV2MaintenanceSnapshotPhase4c23r =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        120,
      memory:
        "512MiB",
      enforceAppCheck:
        false
    },
    async (request) => {
      const callerUid =
        requireSuperAdmin(
          request.auth as
            | {
                uid: string;
                token: GenericRecord;
              }
            | undefined
        );

      const input =
        request.data &&
        typeof request.data ===
          "object"
          ? request.data as
              HeartbeatInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          CONTRACT_DIGEST ||
        text(
          input.cutoverRunId
        ) ===
          ""
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-23R recovery heartbeat gate failed."
        );
      }

      const context =
        await buildContext(
          callerUid
        );

      const cutoverRunId =
        text(
          input.cutoverRunId
        );

      const heartbeatAtIso =
        new Date().toISOString();

      const leaseExpiresAtIso =
        addSecondsIso(
          Date.parse(
            heartbeatAtIso
          ),
          LEASE_SECONDS
        );

      await context.db.runTransaction(
        async (transaction) => {
          const [
            sessionSnapshot,
            lockSnapshot,
            maintenanceSnapshot
          ] = await Promise.all([
            transaction.get(
              context.sessionRef
            ),
            transaction.get(
              context.lockRef
            ),
            transaction.get(
              context.maintenanceRef
            )
          ]);

          if (
            !sessionSnapshot.exists ||
            !lockSnapshot.exists ||
            !maintenanceSnapshot.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-23R recovery heartbeat documents are missing."
            );
          }

          const session =
            sessionSnapshot.data() ||
            {};

          const lock =
            lockSnapshot.data() ||
            {};

          const maintenance =
            maintenanceSnapshot.data() ||
            {};

          const heartbeatChecks:
            GenericRecord = {
          caller:
            text(
              session.approvedByFirebaseUid
            ) ===
              callerUid &&
            text(
              lock.approvedByFirebaseUid
            ) ===
              callerUid &&
            text(
              maintenance.approvedByFirebaseUid
            ) ===
              callerUid,
          cutoverRunId:
            text(
              session.cutoverRunId
            ) ===
              cutoverRunId &&
            text(
              lock.cutoverRunId
            ) ===
              cutoverRunId &&
            text(
              maintenance.cutoverRunId
            ) ===
              cutoverRunId,
          sessionState:
            [
              "maintenance_active_waiting_sheet_capture",
              "snapshot_retained_waiting_final_preflight"
            ].includes(
              text(
                session.state
              )
            ),
          lockOwned:
            text(
              lock.state
            ) ===
            "owned",
          maintenanceActive:
            text(
              maintenance.state
            ) ===
            "active",
          leaseNotExpired:
            parseIsoMillis(
              lock.leaseExpiresAtIso,
              "lock.leaseExpiresAtIso"
            ) >
            Date.now(),
          noUidMutation:
            numberValue(
              session.uidMutationWrites
            ) ===
              0 &&
            numberValue(
              lock.uidMutationWrites
            ) ===
              0 &&
            numberValue(
              maintenance.uidMutationWrites
            ) ===
              0
          };

          if (!allTrue(
            heartbeatChecks
          )) {
            throw new HttpsError(
              "failed-precondition",
              `Phase 4C-23R recovery heartbeat validation failed: ${
                Object.entries(
                  heartbeatChecks
                )
                  .filter(
                    (
                      [, passed]
                    ) =>
                      passed !==
                      true
                  )
                  .map(
                    (
                      [key]
                    ) =>
                      key
                  )
                  .join(", ")
              }`
            );
          }

          transaction.set(
            context.sessionRef,
            {
              ...session,
              heartbeatAtIso,
              leaseExpiresAtIso,
              heartbeatSeconds:
                HEARTBEAT_SECONDS,
              updatedAtIso:
                heartbeatAtIso
            }
          );

          transaction.set(
            context.lockRef,
            {
              ...lock,
              heartbeatAtIso,
              leaseExpiresAtIso,
              heartbeatSeconds:
                HEARTBEAT_SECONDS,
              updatedAtIso:
                heartbeatAtIso
            }
          );

          transaction.set(
            context.maintenanceRef,
            {
              ...maintenance,
              heartbeatAtIso,
              leaseExpiresAtIso,
              heartbeatSeconds:
                HEARTBEAT_SECONDS,
              updatedAtIso:
                heartbeatAtIso
            }
          );
        }
      );

      return {
        ok:
          true,
        version:
          UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
        phase:
          "Phase 4C-23R Recovery",
        mode:
          "lease_heartbeat_no_uid_mutation",
        requestId:
          REQUEST_ID,
        contractDigest:
          CONTRACT_DIGEST,
        cutoverRunId,
        writeOperations:
          3,
        heartbeatAtIso,
        leaseExpiresAtIso,
        leaseSeconds:
          LEASE_SECONDS,
        heartbeatSeconds:
          HEARTBEAT_SECONDS,
        productionExecutionLockOwned:
          true,
        productionMaintenanceWindowActive:
          true,
        uidMutationWrites:
          0,
        actualUidCutoverAllowed:
          false
      };
    }
  );

export const persistUidV2RollbackSnapshotPhase4c23r =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        540,
      memory:
        "1GiB",
      enforceAppCheck:
        false
    },
    async (request) => {
      const callerUid =
        requireSuperAdmin(
          request.auth as
            | {
                uid: string;
                token: GenericRecord;
              }
            | undefined
        );

      const input =
        request.data &&
        typeof request.data ===
          "object"
          ? request.data as
              PersistenceInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          CONTRACT_DIGEST ||
        text(
          input.activationPhrase
        ) !==
          ACTIVATION_PHRASE ||
        input.confirmMaintenanceGuardDeployed !==
          true ||
        input.confirmFreshCaptureAfterMaintenanceActive !==
          true ||
        input.confirmNoUidMutation !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-23R snapshot persistence gate failed."
        );
      }

      const context =
        await buildContext(
          callerUid
        );

      const existingResult =
        await context.resultRef.get();

      if (existingResult.exists) {
        const stored =
          existingResult.data() ||
          {};

        const result =
          asRecord(
            stored.result,
            "existing result"
          );

        if (
          text(
            result.cutoverRunId
          ) !==
          text(
            input.cutoverRunId
          )
        ) {
          throw new HttpsError(
            "already-exists",
            "A different Phase 4C-23R result already exists."
          );
        }

        return publicResult(
          stored,
          true,
          0,
          false,
          (
            Date.now() -
            parseIsoMillis(
              result.snapshotCapturedAtIso,
              "result.snapshotCapturedAtIso"
            )
          ) /
          1000
        );
      }

      const [
        sessionSnapshot,
        lockSnapshot,
        maintenanceSnapshot
      ] = await Promise.all([
        context.sessionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get()
      ]);

      if (
        !sessionSnapshot.exists ||
        !lockSnapshot.exists ||
        !maintenanceSnapshot.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-23R active maintenance session is missing."
        );
      }

      const session =
        sessionSnapshot.data() ||
        {};

      const lock =
        lockSnapshot.data() ||
        {};

      const maintenance =
        maintenanceSnapshot.data() ||
        {};

      const cutoverRunId =
        text(
          input.cutoverRunId
        );

      const activeChecks:
        GenericRecord = {
      sessionCaller:
        text(
          session.approvedByFirebaseUid
        ) ===
        callerUid,
      lockCaller:
        text(
          lock.approvedByFirebaseUid
        ) ===
        callerUid,
      maintenanceCaller:
        text(
          maintenance.approvedByFirebaseUid
        ) ===
        callerUid,
      cutoverRunId:
        cutoverRunId !==
          "" &&
        text(
          session.cutoverRunId
        ) ===
          cutoverRunId &&
        text(
          lock.cutoverRunId
        ) ===
          cutoverRunId &&
        text(
          maintenance.cutoverRunId
        ) ===
          cutoverRunId,
      sessionState:
        text(
          session.state
        ) ===
        "maintenance_active_waiting_sheet_capture",
      lockState:
        text(
          lock.state
        ) ===
        "owned",
      maintenanceState:
        text(
          maintenance.state
        ) ===
        "active",
      guardAttested:
        session.maintenanceGuardDeployed ===
          true &&
        maintenance.maintenanceGuardDeployed ===
          true,
      leaseValid:
        parseIsoMillis(
          lock.leaseExpiresAtIso,
          "lock.leaseExpiresAtIso"
        ) >
        Date.now(),
      noUidMutation:
        numberValue(
          session.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          maintenance.uidMutationWrites
        ) ===
          0
      };

      if (!allTrue(
        activeChecks
      )) {
        throw new HttpsError(
          "failed-precondition",
          `Active maintenance validation failed: ${
            Object.entries(
              activeChecks
            )
              .filter(
                (
                  [, passed]
                ) =>
                  passed !==
                  true
              )
              .map(
                (
                  [key]
                ) =>
                  key
              )
              .join(", ")
          }`
        );
      }

      const sheet =
        validateSheetEnvelope(
          input.sheetEnvelope,
          context.phase4c13Plan,
          text(
            maintenance.activeAtIso
          )
        );

      const payload =
        await captureProductionPayload(
          context,
          sheet
        );

      const refs =
        snapshotRefs(
          context.db,
          cutoverRunId
        );

      const snapshotCapturedAtIso =
        new Date().toISOString();

      const snapshotMetadata:
        GenericRecord = {
      version:
        UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
      phase:
        "Phase 4C-23R",
      mode:
        "production_fresh_rollback_snapshot_persistence",
      requestId:
        REQUEST_ID,
      contractDigest:
        CONTRACT_DIGEST,
      cutoverRunId,
      approvedByFirebaseUid:
        callerUid,
      state:
        "retained",
      stateHistory: [
        "capturing",
        "captured",
        "sealing",
        "sealed",
        "verified",
        "retained"
      ],
      encoding:
        "canonical_json_gzip_base64",
      canonicalBytes:
        payload.canonicalBytes,
      compressedBytes:
        payload.compressedBytes,
      encodedBytes:
        payload.encodedBytes,
      chunkCount:
        payload.chunks.length,
      maximumChunkBytes:
        MAXIMUM_CHUNK_BYTES,
      canonicalSha256:
        payload.canonicalSha256,
      compressedSha256:
        payload.compressedSha256,
      chunkDigests:
        payload.chunkDigests,
      freshSheetSnapshotDigest:
        payload.sheetSnapshotDigest,
      freshFirestoreSnapshotDigest:
        payload.firestoreSnapshotDigest,
      freshFirebaseAuthSnapshotDigest:
        payload.firebaseAuthSnapshotDigest,
      freshRollbackSnapshotDigest:
        payload.rollbackSnapshotDigest,
      counts:
        payload.counts,
      correctedProjectedTotals:
        correctedTotals(),
      containsSensitiveProductionData:
        true,
      passwordMaterialIncluded:
        false,
      plaintextPayloadLoggingForbidden:
        true,
      browserPayloadDownloadForbidden:
        true,
      createOnly:
        true,
      overwriteForbidden:
        true,
      minimumRetentionDays:
        30,
      manualReleaseRequired:
        true,
      postCutoverSignoff:
        false,
      sourceSheetWrites:
        0,
      activeUidRegistryWrites:
        0,
      attendanceWrites:
        0,
      assignmentWrites:
        0,
      firebaseAuthWrites:
        0,
      sessionAuthChanges:
        0,
      uidMutationWrites:
        0,
      finalArmTokenIssued:
        false,
      actualUidCutoverAllowed:
        false,
      capturedAtIso:
        snapshotCapturedAtIso,
      createdAtIso:
        snapshotCapturedAtIso,
      updatedAtIso:
        snapshotCapturedAtIso
      };

      const snapshotMetadataDigest =
        digestValue(
          snapshotMetadata
        );

      const verificationEvent:
        GenericRecord = {
      version:
        UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
      phase:
        "Phase 4C-23R",
      cutoverRunId,
      state:
        "verified",
      metadataDigest:
        snapshotMetadataDigest,
      canonicalSha256:
        payload.canonicalSha256,
      compressedSha256:
        payload.compressedSha256,
      chunkDigests:
        payload.chunkDigests,
      canonicalBytes:
        payload.canonicalBytes,
      compressedBytes:
        payload.compressedBytes,
      encodedBytes:
        payload.encodedBytes,
      chunkCount:
        payload.chunks.length,
      createOnlyVerified:
        true,
      overwriteForbidden:
        true,
      sourceSnapshotFresh:
        true,
      maintenanceActive:
        true,
      productionLockOwned:
        true,
      uidMutationWrites:
        0,
      actualUidCutoverAllowed:
        false,
      verifiedAtIso:
        snapshotCapturedAtIso
      };

      const snapshotVerificationDigest =
        digestValue(
          verificationEvent
        );

      const result:
        GenericRecord = {
      version:
        UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
      phase:
        "Phase 4C-23R",
      mode:
        "rebase156_production_maintenance_fresh_snapshot_recovery_new_session_after_emergency_release_no_uid_mutation",
      requestId:
        REQUEST_ID,
      approvedByFirebaseUid:
        callerUid,
      contractDigest:
        CONTRACT_DIGEST,
      cutoverRunId,
      snapshotPath:
        refs.metadataRef.path,
      snapshotMetadataDigest,
      snapshotVerificationDigest,
      freshSheetSnapshotDigest:
        payload.sheetSnapshotDigest,
      freshFirestoreSnapshotDigest:
        payload.firestoreSnapshotDigest,
      freshFirebaseAuthSnapshotDigest:
        payload.firebaseAuthSnapshotDigest,
      freshRollbackSnapshotDigest:
        payload.rollbackSnapshotDigest,
      canonicalSha256:
        payload.canonicalSha256,
      compressedSha256:
        payload.compressedSha256,
      chunkDigests:
        payload.chunkDigests,
      canonicalBytes:
        payload.canonicalBytes,
      compressedBytes:
        payload.compressedBytes,
      encodedBytes:
        payload.encodedBytes,
      chunkCount:
        payload.chunks.length,
      counts:
        payload.counts,
      correctedProjectedTotals:
        correctedTotals(),
      chainChecks:
        context.chainChecks,
      blockingReasons:
        context.blockingReasons,
      maintenanceGuardVerificationMode:
        "operator_attestation_only",
      productionExecutionLockOwned:
        true,
      productionMaintenanceWindowActive:
        true,
      productionRollbackSnapshotPersisted:
        true,
      productionRollbackSnapshotSealed:
        true,
      productionRollbackSnapshotRetained:
        true,
      sourceSheetWrites:
        0,
      activeUidRegistryWrites:
        0,
      attendanceWrites:
        0,
      assignmentWrites:
        0,
      firebaseAuthWrites:
        0,
      sessionAuthChanges:
        0,
      uidMutationWrites:
        0,
      finalArmTokenIssued:
        false,
      actualExecutionWrites: {
        activationWrites:
          ACTIVATION_WRITE_OPERATIONS,
        persistenceWrites:
          PERSISTENCE_WRITE_OPERATIONS,
        totalWrites:
          TOTAL_EXECUTION_WRITE_OPERATIONS,
        productionExecutionLockWrites:
          3,
        productionMaintenanceWrites:
          3,
        productionRollbackSnapshotWrites:
          3,
        stagingExecutionSessionWrites:
          3,
        resultManifestWrites:
          1,
        uidMutationWrites:
          0
      },
      snapshotCapturedAtIso,
      safety:
        resultSafety(),
      actualUidCutoverAllowed:
        false,
      nextGate: {
        phase:
          NEXT_GATE_PHASE,
        allowed:
          true,
        maintenanceMustRemainActive:
          true,
        productionLockMustRemainOwned:
          true,
        freshSnapshotAgeLimitSeconds:
          FRESH_SNAPSHOT_AGE_LIMIT_SECONDS,
        uidMutationAllowed:
          false,
        actualUidCutoverAllowed:
          false
      }
      };

      const resultDigest =
        digestValue(
          result
        );

      const stored:
        GenericRecord = {
      version:
        UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
      phase:
        "Phase 4C-23R",
      mode:
        "rebase156_production_maintenance_fresh_snapshot_recovery_new_session_after_emergency_release_no_uid_mutation",
      requestId:
        REQUEST_ID,
      approvedByFirebaseUid:
        callerUid,
      contractDigest:
        CONTRACT_DIGEST,
      resultDigest,
      result,
      status:
        "rebase_production_maintenance_snapshot_execution_completed",
      createdAtIso:
        snapshotCapturedAtIso
      };

      await context.db.runTransaction(
        async (transaction) => {
          const [
            currentSession,
            currentLock,
            currentMaintenance,
            currentMetadata,
            currentChunk,
            currentVerification,
            currentResult
          ] = await Promise.all([
            transaction.get(
              context.sessionRef
            ),
            transaction.get(
              context.lockRef
            ),
            transaction.get(
              context.maintenanceRef
            ),
            transaction.get(
              refs.metadataRef
            ),
            transaction.get(
              refs.chunkRef
            ),
            transaction.get(
              refs.verificationRef
            ),
            transaction.get(
              context.resultRef
            )
          ]);

          if (
            !currentSession.exists ||
            !currentLock.exists ||
            !currentMaintenance.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Maintenance session disappeared before snapshot commit."
            );
          }

          if (
            currentMetadata.exists ||
            currentChunk.exists ||
            currentVerification.exists ||
            currentResult.exists
          ) {
            throw new HttpsError(
              "already-exists",
              "Create-only Rollback Snapshot destination already exists."
            );
          }

          const currentSessionData =
            currentSession.data() ||
            {};

          const currentLockData =
            currentLock.data() ||
            {};

          const currentMaintenanceData =
            currentMaintenance.data() ||
            {};

          const commitChecks:
            GenericRecord = {
          sessionState:
            text(
              currentSessionData.state
            ) ===
            "maintenance_active_waiting_sheet_capture",
          lockState:
            text(
              currentLockData.state
            ) ===
            "owned",
          maintenanceState:
            text(
              currentMaintenanceData.state
            ) ===
            "active",
          caller:
            text(
              currentSessionData.approvedByFirebaseUid
            ) ===
              callerUid &&
            text(
              currentLockData.approvedByFirebaseUid
            ) ===
              callerUid &&
            text(
              currentMaintenanceData.approvedByFirebaseUid
            ) ===
              callerUid,
          cutoverRunId:
            text(
              currentSessionData.cutoverRunId
            ) ===
              cutoverRunId &&
            text(
              currentLockData.cutoverRunId
            ) ===
              cutoverRunId &&
            text(
              currentMaintenanceData.cutoverRunId
            ) ===
              cutoverRunId,
          leaseValid:
            parseIsoMillis(
              currentLockData.leaseExpiresAtIso,
              "lock.leaseExpiresAtIso"
            ) >
            Date.now(),
          noUidMutation:
            numberValue(
              currentSessionData.uidMutationWrites
            ) ===
              0 &&
            numberValue(
              currentMaintenanceData.uidMutationWrites
            ) ===
              0
          };

          if (!allTrue(
            commitChecks
          )) {
            throw new HttpsError(
              "failed-precondition",
              `Snapshot commit gate failed: ${
                Object.entries(
                  commitChecks
                )
                  .filter(
                    (
                      [, passed]
                    ) =>
                      passed !==
                      true
                  )
                  .map(
                    (
                      [key]
                    ) =>
                      key
                  )
                  .join(", ")
              }`
            );
          }

          transaction.set(
            refs.metadataRef,
            snapshotMetadata
          );

          transaction.set(
            refs.chunkRef,
            {
              version:
                UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
              phase:
                "Phase 4C-23R",
              cutoverRunId,
              chunkIndex:
                0,
              totalChunks:
                payload.chunks.length,
              encoding:
                "base64_segment",
              payloadSegment:
                payload.chunks[0],
              payloadSegmentBytes:
                Buffer.byteLength(
                  payload.chunks[0],
                  "utf8"
                ),
              payloadSegmentSha256:
                payload.chunkDigests[0],
              containsSensitiveProductionData:
                true,
              plaintextLoggingForbidden:
                true,
              createdAtIso:
                snapshotCapturedAtIso
            }
          );

          transaction.set(
            refs.verificationRef,
            verificationEvent
          );

          transaction.set(
            context.sessionRef,
            {
              ...currentSessionData,
              state:
                "snapshot_retained_waiting_final_preflight",
              maintenanceState:
                "active",
              snapshotPath:
                refs.metadataRef.path,
              snapshotMetadataDigest,
              snapshotVerificationDigest,
              freshRollbackSnapshotDigest:
                payload.rollbackSnapshotDigest,
              productionRollbackSnapshotPersisted:
                true,
              productionRollbackSnapshotSealed:
                true,
              productionRollbackSnapshotRetained:
                true,
              uidMutationWrites:
                0,
              snapshotCapturedAtIso,
              updatedAtIso:
                snapshotCapturedAtIso
            }
          );

          transaction.set(
            context.lockRef,
            {
              ...currentLockData,
              state:
                "owned",
              heartbeatAtIso:
                snapshotCapturedAtIso,
              snapshotPath:
                refs.metadataRef.path,
              freshRollbackSnapshotDigest:
                payload.rollbackSnapshotDigest,
              uidMutationWrites:
                0,
              updatedAtIso:
                snapshotCapturedAtIso
            }
          );

          transaction.set(
            context.maintenanceRef,
            {
              ...currentMaintenanceData,
              state:
                "active",
              heartbeatAtIso:
                snapshotCapturedAtIso,
              productionRollbackSnapshotPersisted:
                true,
              productionRollbackSnapshotSealed:
                true,
              productionRollbackSnapshotRetained:
                true,
              snapshotPath:
                refs.metadataRef.path,
              freshRollbackSnapshotDigest:
                payload.rollbackSnapshotDigest,
              uidMutationWrites:
                0,
              updatedAtIso:
                snapshotCapturedAtIso
            }
          );

          transaction.set(
            context.resultRef,
            stored
          );
        }
      );

      return publicResult(
        stored,
        false,
        PERSISTENCE_WRITE_OPERATIONS,
        false,
        0
      );
    }
  );

export const inspectUidV2MaintenanceSnapshotPhase4c23r =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        300,
      memory:
        "1GiB",
      enforceAppCheck:
        false
    },
    async (request) => {
      const callerUid =
        requireSuperAdmin(
          request.auth as
            | {
                uid: string;
                token: GenericRecord;
              }
            | undefined
        );

      const input =
        request.data &&
        typeof request.data ===
          "object"
          ? request.data as
              InspectInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-23R inspect gate failed."
        );
      }

      const context =
        await buildContext(
          callerUid
        );

      const resultSnapshot =
        await context.resultRef.get();

      if (!resultSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-23R execution result was not found."
        );
      }

      const stored =
        resultSnapshot.data() ||
        {};

      const result =
        asRecord(
          stored.result,
          "stored.result"
        );

      const cutoverRunId =
        text(
          input.cutoverRunId
        );

      if (
        cutoverRunId ===
          "" ||
        cutoverRunId !==
          text(
            result.cutoverRunId
          )
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-23R cutoverRunId mismatch."
        );
      }

      const refs =
        snapshotRefs(
          context.db,
          cutoverRunId
        );

      const [
        sessionSnapshot,
        lockSnapshot,
        maintenanceSnapshot,
        metadataSnapshot,
        chunkSnapshot,
        verificationSnapshot
      ] = await Promise.all([
        context.sessionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get(),
        refs.metadataRef.get(),
        refs.chunkRef.get(),
        refs.verificationRef.get()
      ]);

      if (
        !sessionSnapshot.exists ||
        !lockSnapshot.exists ||
        !maintenanceSnapshot.exists ||
        !metadataSnapshot.exists ||
        !chunkSnapshot.exists ||
        !verificationSnapshot.exists
      ) {
        throw new HttpsError(
          "data-loss",
          "Phase 4C-23R persisted documents are incomplete."
        );
      }

      const session =
        sessionSnapshot.data() ||
        {};

      const lock =
        lockSnapshot.data() ||
        {};

      const maintenance =
        maintenanceSnapshot.data() ||
        {};

      const metadata =
        metadataSnapshot.data() ||
        {};

      const chunk =
        chunkSnapshot.data() ||
        {};

      const verification =
        verificationSnapshot.data() ||
        {};

      const encoded =
        text(
          chunk.payloadSegment
        );

      const compressed =
        Buffer.from(
          encoded,
          "base64"
        );

      const reconstructedCanonical =
        gunzipSync(
          compressed
        ).toString(
          "utf8"
        );

      const snapshotAgeSeconds =
        (
          Date.now() -
          parseIsoMillis(
            result.snapshotCapturedAtIso,
            "result.snapshotCapturedAtIso"
          )
        ) /
        1000;

      const resultSafetyRecord =
        asRecord(
          result.safety,
          "result.safety"
        );

      const actualWrites =
        asRecord(
          result.actualExecutionWrites,
          "result.actualExecutionWrites"
        );

      const checks:
        GenericRecord = {
      status:
        text(
          stored.status
        ) ===
        "rebase_production_maintenance_snapshot_execution_completed",
      caller:
        text(
          stored.approvedByFirebaseUid
        ) ===
        callerUid,
      contract:
        text(
          stored.contractDigest
        ) ===
        CONTRACT_DIGEST,
      resultDigest:
        text(
          stored.resultDigest
        ) ===
        digestValue(
          result
        ),
      cutoverRunId:
        text(
          session.cutoverRunId
        ) ===
          cutoverRunId &&
        text(
          lock.cutoverRunId
        ) ===
          cutoverRunId &&
        text(
          maintenance.cutoverRunId
        ) ===
          cutoverRunId,
      sessionState:
        text(
          session.state
        ) ===
        "snapshot_retained_waiting_final_preflight",
      lockOwned:
        text(
          lock.state
        ) ===
          "owned" &&
        text(
          lock.approvedByFirebaseUid
        ) ===
          callerUid,
      leaseValid:
        parseIsoMillis(
          lock.leaseExpiresAtIso,
          "lock.leaseExpiresAtIso"
        ) >
        Date.now(),
      maintenanceActive:
        text(
          maintenance.state
        ) ===
          "active" &&
        text(
          maintenance.approvedByFirebaseUid
        ) ===
          callerUid,
      snapshotState:
        text(
          metadata.state
        ) ===
          "retained" &&
        exactJson(
          metadata.stateHistory,
          [
            "capturing",
            "captured",
            "sealing",
            "sealed",
            "verified",
            "retained"
          ]
        ),
      metadataDigest:
        text(
          result.snapshotMetadataDigest
        ) ===
        digestValue(
          metadata
        ),
      verificationDigest:
        text(
          result.snapshotVerificationDigest
        ) ===
        digestValue(
          verification
        ),
      chunkCount:
        numberValue(
          metadata.chunkCount
        ) ===
          1 &&
        numberValue(
          chunk.totalChunks
        ) ===
          1 &&
        numberValue(
          chunk.chunkIndex
        ) ===
          0,
      chunkDigest:
        text(
          chunk.payloadSegmentSha256
        ) ===
          sha256Text(
            encoded
          ) &&
        exactJson(
          metadata.chunkDigests,
          [
            sha256Text(
              encoded
            )
          ]
        ),
      compressedDigest:
        text(
          metadata.compressedSha256
        ) ===
        sha256Buffer(
          compressed
        ),
      canonicalDigest:
        text(
          metadata.canonicalSha256
        ) ===
        sha256Text(
          reconstructedCanonical
        ),
      canonicalBytes:
        numberValue(
          metadata.canonicalBytes
        ) ===
        Buffer.byteLength(
          reconstructedCanonical,
          "utf8"
        ),
      createOnly:
        metadata.createOnly ===
          true &&
        metadata.overwriteForbidden ===
          true,
      retained:
        metadata.manualReleaseRequired ===
          true &&
        numberValue(
          metadata.minimumRetentionDays
        ) ===
          30,
      chainChecks:
        allTrue(
          asRecord(
            result.chainChecks,
            "result.chainChecks"
          )
        ),
      blockingReasons:
        asArray(
          result.blockingReasons,
          "result.blockingReasons"
        ).length ===
        0,
      productionState:
        result.productionExecutionLockOwned ===
          true &&
        result.productionMaintenanceWindowActive ===
          true &&
        result.productionRollbackSnapshotPersisted ===
          true &&
        result.productionRollbackSnapshotSealed ===
          true &&
        result.productionRollbackSnapshotRetained ===
          true,
      expectedCounts:
        exactJson(
          result.counts,
          expectedCounts()
        ),
      correctedTotals:
        exactJson(
          result.correctedProjectedTotals,
          correctedTotals()
        ),
      writeBudget:
        numberValue(
          actualWrites.activationWrites
        ) ===
          ACTIVATION_WRITE_OPERATIONS &&
        numberValue(
          actualWrites.persistenceWrites
        ) ===
          PERSISTENCE_WRITE_OPERATIONS &&
        numberValue(
          actualWrites.totalWrites
        ) ===
          TOTAL_EXECUTION_WRITE_OPERATIONS &&
        numberValue(
          actualWrites.uidMutationWrites
        ) ===
          0,
      sourceUntouched:
        numberValue(
          result.sourceSheetWrites
        ) ===
          0 &&
        numberValue(
          result.activeUidRegistryWrites
        ) ===
          0 &&
        numberValue(
          result.attendanceWrites
        ) ===
          0 &&
        numberValue(
          result.assignmentWrites
        ) ===
          0 &&
        numberValue(
          result.firebaseAuthWrites
        ) ===
          0 &&
        numberValue(
          result.sessionAuthChanges
        ) ===
          0 &&
        numberValue(
          result.uidMutationWrites
        ) ===
          0,
      safety:
        exactJson(
          resultSafetyRecord,
          resultSafety()
        ),
      noFinalArm:
        result.finalArmTokenIssued ===
        false,
      noCutover:
        result.actualUidCutoverAllowed ===
        false,
      snapshotAgeNonNegative:
        snapshotAgeSeconds >=
        0
      };

      if (!allTrue(
        checks
      )) {
        const failed =
          Object.entries(
            checks
          )
            .filter(
              (
                [, passed]
              ) =>
                passed !==
                true
            )
            .map(
              (
                [key]
              ) =>
                key
            );

        throw new HttpsError(
          "data-loss",
          `Phase 4C-23R verification failed: ${failed.join(", ")}`
        );
      }

      return publicResult(
        stored,
        true,
        0,
        true,
        snapshotAgeSeconds
      );
    }
  );

export const releaseUidV2MaintenanceSnapshotPhase4c23r =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        180,
      memory:
        "512MiB",
      enforceAppCheck:
        false
    },
    async (request) => {
      const callerUid =
        requireSuperAdmin(
          request.auth as
            | {
                uid: string;
                token: GenericRecord;
              }
            | undefined
        );

      const input =
        request.data &&
        typeof request.data ===
          "object"
          ? request.data as
              ReleaseInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          CONTRACT_DIGEST ||
        text(
          input.releasePhrase
        ) !==
          RELEASE_PHRASE ||
        input.confirmUidMutationsZero !==
          true ||
        input.confirmSnapshotMustBeRetained !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-23R emergency release gate failed."
        );
      }

      const context =
        await buildContext(
          callerUid
        );

      const cutoverRunId =
        text(
          input.cutoverRunId
        );

      const [
        releaseSessionPreflight,
        releaseLockPreflight,
        releaseMaintenancePreflight
      ] = await Promise.all([
        context.sessionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get()
      ]);

      if (
        releaseSessionPreflight.exists &&
        !releaseLockPreflight.exists &&
        releaseMaintenancePreflight.exists
      ) {
        const releasedSession =
          releaseSessionPreflight.data() ||
          {};

        const releasedMaintenance =
          releaseMaintenancePreflight.data() ||
          {};

        if (
          text(
            releasedSession.state
          ) ===
            "emergency_released" &&
          text(
            releasedSession.cutoverRunId
          ) ===
            cutoverRunId &&
          text(
            releasedMaintenance.state
          ) ===
            "inactive" &&
          numberValue(
            releasedSession.uidMutationWrites
          ) ===
            0 &&
          numberValue(
            releasedMaintenance.uidMutationWrites
          ) ===
            0
        ) {
          return {
            ok:
              true,
            version:
              UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
            phase:
              "Phase 4C-23R Recovery",
            mode:
              "emergency_release_already_completed_no_uid_mutation",
            requestId:
              REQUEST_ID,
            contractDigest:
              CONTRACT_DIGEST,
            cutoverRunId,
            duplicate:
              true,
            writeOperations:
              0,
            maintenanceState:
              "inactive",
            productionExecutionLockOwned:
              false,
            productionMaintenanceWindowActive:
              false,
            productionRollbackSnapshotDeleted:
              false,
            productionRollbackSnapshotRetained:
              true,
            uidMutationWrites:
              0,
            actualUidCutoverAllowed:
              false
          };
        }
      }

      await context.db.runTransaction(
        async (transaction) => {
          const [
            sessionSnapshot,
            lockSnapshot,
            maintenanceSnapshot,
            resultSnapshot
          ] = await Promise.all([
            transaction.get(
              context.sessionRef
            ),
            transaction.get(
              context.lockRef
            ),
            transaction.get(
              context.maintenanceRef
            ),
            transaction.get(
              context.resultRef
            )
          ]);

          if (
            !sessionSnapshot.exists ||
            !lockSnapshot.exists ||
            !maintenanceSnapshot.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Active Phase 4C-23R maintenance documents are missing."
            );
          }

          const session =
            sessionSnapshot.data() ||
            {};

          const lock =
            lockSnapshot.data() ||
            {};

          const maintenance =
            maintenanceSnapshot.data() ||
            {};

          let resultUidMutationWrites =
            0;

          if (resultSnapshot.exists) {
            const stored =
              resultSnapshot.data() ||
              {};

            const result =
              asRecord(
                stored.result,
                "release result"
              );

            resultUidMutationWrites =
              numberValue(
                result.uidMutationWrites
              );
          }

          const releaseChecks:
            GenericRecord = {
          caller:
            text(
              session.approvedByFirebaseUid
            ) ===
              callerUid &&
            text(
              lock.approvedByFirebaseUid
            ) ===
              callerUid &&
            text(
              maintenance.approvedByFirebaseUid
            ) ===
              callerUid,
          cutoverRunId:
            cutoverRunId !==
              "" &&
            text(
              session.cutoverRunId
            ) ===
              cutoverRunId &&
            text(
              lock.cutoverRunId
            ) ===
              cutoverRunId &&
            text(
              maintenance.cutoverRunId
            ) ===
              cutoverRunId,
          activeState:
            text(
              lock.state
            ) ===
              "owned" &&
            [
              "arming",
              "active",
              "failed_closed"
            ].includes(
              text(
                maintenance.state
              )
            ),
          uidMutationsZero:
            numberValue(
              session.uidMutationWrites
            ) ===
              0 &&
            numberValue(
              maintenance.uidMutationWrites
            ) ===
              0 &&
            resultUidMutationWrites ===
              0
          };

          if (!allTrue(
            releaseChecks
          )) {
            throw new HttpsError(
              "failed-precondition",
              `Emergency release validation failed: ${
                Object.entries(
                  releaseChecks
                )
                  .filter(
                    (
                      [, passed]
                    ) =>
                      passed !==
                      true
                  )
                  .map(
                    (
                      [key]
                    ) =>
                      key
                  )
                  .join(", ")
              }`
            );
          }

          const releasingAtIso =
            new Date().toISOString();

          transaction.set(
            context.sessionRef,
            {
              ...session,
              state:
                "emergency_releasing",
              maintenanceState:
                "releasing",
              emergencyReleaseRequested:
                true,
              uidMutationWrites:
                0,
              updatedAtIso:
                releasingAtIso
            }
          );

          transaction.set(
            context.maintenanceRef,
            {
              ...maintenance,
              state:
                "releasing",
              emergencyReleaseRequested:
                true,
              uidMutationWrites:
                0,
              updatedAtIso:
                releasingAtIso
            }
          );

          transaction.set(
            context.lockRef,
            {
              ...lock,
              state:
                "releasing",
              heartbeatAtIso:
                releasingAtIso,
              uidMutationWrites:
                0,
              updatedAtIso:
                releasingAtIso
            }
          );
        }
      );

      const releasedAtIso =
        new Date().toISOString();

      await context.db.runTransaction(
        async (transaction) => {
          const [
            sessionSnapshot,
            lockSnapshot,
            maintenanceSnapshot
          ] = await Promise.all([
            transaction.get(
              context.sessionRef
            ),
            transaction.get(
              context.lockRef
            ),
            transaction.get(
              context.maintenanceRef
            )
          ]);

          if (
            !sessionSnapshot.exists ||
            !lockSnapshot.exists ||
            !maintenanceSnapshot.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Emergency release documents disappeared."
            );
          }

          const session =
            sessionSnapshot.data() ||
            {};

          const maintenance =
            maintenanceSnapshot.data() ||
            {};

          if (
            text(
              session.state
            ) !==
              "emergency_releasing" ||
            text(
              maintenance.state
            ) !==
              "releasing"
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Emergency release state transition mismatch."
            );
          }

          transaction.set(
            context.sessionRef,
            {
              ...session,
              state:
                "emergency_released",
              maintenanceState:
                "inactive",
              productionExecutionLockOwned:
                false,
              productionMaintenanceWindowActive:
                false,
              uidMutationWrites:
                0,
              releasedAtIso,
              updatedAtIso:
                releasedAtIso
            }
          );

          transaction.set(
            context.maintenanceRef,
            {
              ...maintenance,
              state:
                "inactive",
              productionExecutionLockOwned:
                false,
              productionMaintenanceWindowActive:
                false,
              uidMutationWrites:
                0,
              releasedAtIso,
              updatedAtIso:
                releasedAtIso
            }
          );

          transaction.delete(
            context.lockRef
          );
        }
      );

      return {
        ok:
          true,
        version:
          UID_V2_PRODUCTION_MAINTENANCE_SNAPSHOT_PHASE4C23R_VERSION,
        phase:
          "Phase 4C-23R",
        mode:
          "emergency_release_no_uid_mutation",
        requestId:
          REQUEST_ID,
        contractDigest:
          CONTRACT_DIGEST,
        cutoverRunId,
        writeOperations:
          6,
        maintenanceState:
          "inactive",
        productionExecutionLockOwned:
          false,
        productionMaintenanceWindowActive:
          false,
        productionRollbackSnapshotDeleted:
          false,
        productionRollbackSnapshotRetained:
          true,
        uidMutationWrites:
          0,
        actualUidCutoverAllowed:
          false,
        nextAction:
          "Do not continue to Phase 4C-24R. A new maintenance and fresh snapshot execution is required."
      };
    }
  );
