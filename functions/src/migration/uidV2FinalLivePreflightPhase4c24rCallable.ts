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

export const UID_V2_FINAL_LIVE_PREFLIGHT_PHASE4C24R_VERSION =
  "2026-07-28.716.79-phase4c24r-final-live-preflight-fresh-snapshot-refresh-expiring-challenge-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "441587279139d98a42a885c3135a1824f795151bbfe992844afe589f45548634";

const APPROVAL_PHRASE =
  "Phase 4C-24R 최종 Live Preflight와 Fresh Snapshot 갱신 및 Final Arm Challenge 생성을 실행합니다. UID 변경은 실행하지 않습니다.";

const EXPECTED_PHASE4C23_RUNTIME_VERSION =
  "2026-07-28.716.78-phase4c23r-emergency-release-restart-lease-heartbeat-recovery-hotfix";

const EXPECTED_PHASE4C23_CONTRACT_DIGEST =
  "80b7fc3a72736ecd400ed20baae3f4c69169b3f129b60e990084a47d63e6ad37";

const EXPECTED_PHASE4C23_RESULT_DIGEST =
  "c1bb8a2399ed2c010299834c9d8af940ab68593e84763baa76de9887c8f8cd6c";

const EXPECTED_PHASE4C23_CUTOVER_RUN_ID =
  "phase4c23r-ms4lvf6s-91c84bbc03f64521";

const EXPECTED_PHASE4C23_SNAPSHOT_PATH =
  "uidV2ProductionRollbackSnapshots/phase4c23r-ms4lvf6s-91c84bbc03f64521";

const EXPECTED_PHASE4C23_SNAPSHOT_METADATA_DIGEST =
  "f851a5b79f41f54fbbd479359b73f5e88ce3b447c8cb13438125435911b9f461";

const EXPECTED_PHASE4C23_SNAPSHOT_VERIFICATION_DIGEST =
  "f09ddfcb28c80dcc150721bb0e6fd44aca06f15fe8093ca41d6919244dde1c36";

const EXPECTED_PHASE4C23_FRESH_ROLLBACK_DIGEST =
  "3aff2f8b956fbe74a8aec6865086bdae0be1d56d617a5c62786449a338d0615b";

const EXPECTED_PHASE4C23_CANONICAL_SHA256 =
  "3aff2f8b956fbe74a8aec6865086bdae0be1d56d617a5c62786449a338d0615b";

const EXPECTED_PHASE4C23_COMPRESSED_SHA256 =
  "4f4eca1ad69ccae07d8d5e8922db6372158e18989b1e723d8e6acebb933167fa";

const EXPECTED_PHASE4C23_CHUNK_DIGEST =
  "6a5d27cda70baab062cb33a3e77b3bd48cfe348e8bbd1837e3ec7db699c42c33";

const EXPECTED_PHASE4C22_CONTRACT_DIGEST =
  "c81b6c846a8daf61e9222a01cf43e257fc7c0656abb4e4b5ecdf79bd400d5c37";

const EXPECTED_PHASE4C22_CORE_DIGEST =
  "cc43a674096cbe0a6f9d8e7da6802f1a4302f74f2d5732f7660795eaf64e3bdc";

const EXPECTED_PHASE4C22_PACKAGE_DIGEST =
  "b04f10a39564a95f5a8f348888c2329d27e0b8e587825d208ed841eb53b2b619";

const EXPECTED_PHASE4C13_PLAN_DIGEST =
  "cdaccca3c1187ee31ff55abb563e3a284c2a70168efac64d9f7e64b3906ed8a9";

const EXPECTED_PHASE4C19_CONTRACT_DIGEST =
  "0bda4550515b1365ec3f727ad79d597b94cab52a0d1da189098f0367832304d3";

const RECOVERY_SESSION_DOCUMENT =
  "phase4c23r-71678";

const RECOVERY_RESULT_DOCUMENT =
  "phase4c23r-71678";

const FINAL_SESSION_DOCUMENT =
  "phase4c24r-71679";

const FINAL_CHALLENGE_DOCUMENT =
  "phase4c24r-71679";

const LEASE_SECONDS =
  7200;

const CAPTURE_WINDOW_SECONDS =
  600;

const CHALLENGE_VALIDITY_SECONDS =
  1800;

const MAXIMUM_CANONICAL_BYTES =
  8000000;

const MAXIMUM_CHUNK_BYTES =
  700000;

const REQUIRED_CHUNK_COUNT =
  1;

const PREPARE_WRITE_OPERATIONS =
  4;

const FINALIZE_WRITE_OPERATIONS =
  8;

const NEXT_GATE_PHASE =
  "Phase 4C-25R explicit final-arm approval and one-time arm-token issuance only";

type GenericRecord =
  Record<string, unknown>;

interface PrepareInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly approvalPhrase?: unknown;
  readonly confirmMaintenanceGuardDeployed?: unknown;
  readonly confirmProductionLockOwned?: unknown;
  readonly confirmNoUidMutation?: unknown;
  readonly confirmFreshSnapshotRefresh?: unknown;
}

interface FinalizeInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly approvalPhrase?: unknown;
  readonly preflightRunId?: unknown;
  readonly sheetEnvelope?: unknown;
  readonly confirmMaintenanceGuardDeployed?: unknown;
  readonly confirmFreshCaptureAfterPrepare?: unknown;
  readonly confirmNoUidMutation?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly preflightRunId?: unknown;
}

interface Context {
  readonly db:
    Firestore;
  readonly callerUid:
    string;
  readonly runRef:
    DocumentReference<DocumentData>;
  readonly recoverySessionRef:
    DocumentReference<DocumentData>;
  readonly recoveryResultRef:
    DocumentReference<DocumentData>;
  readonly finalSessionRef:
    DocumentReference<DocumentData>;
  readonly challengeRef:
    DocumentReference<DocumentData>;
  readonly lockRef:
    DocumentReference<DocumentData>;
  readonly maintenanceRef:
    DocumentReference<DocumentData>;
  readonly phase4c13Plan:
    GenericRecord;
  readonly recoverySession:
    GenericRecord;
  readonly recoveryResultStored:
    GenericRecord;
  readonly recoveryResult:
    GenericRecord;
  readonly chainChecks:
    GenericRecord;
  readonly blockingReasons:
    string[];
}

interface BaselineSnapshot {
  readonly metadata:
    GenericRecord;
  readonly chunk:
    GenericRecord;
  readonly verification:
    GenericRecord;
  readonly payload:
    GenericRecord;
  readonly canonicalText:
    string;
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

interface FreshPayload {
  readonly payload:
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
  readonly freshRollbackSnapshotDigest:
    string;
  readonly freshSheetSnapshotDigest:
    string;
  readonly freshFirestoreSnapshotDigest:
    string;
  readonly freshFirebaseAuthSnapshotDigest:
    string;
  readonly driftChecks:
    GenericRecord;
}

interface SnapshotRefs {
  readonly metadataRef:
    DocumentReference<DocumentData>;
  readonly chunkRef:
    DocumentReference<DocumentData>;
  readonly verificationRef:
    DocumentReference<DocumentData>;
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

function digestValue(
  value: unknown
): string {
  return createHash("sha256")
    .update(
      canonicalText(value),
      "utf8"
    )
    .digest("hex");
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

function sortRecords(
  values: GenericRecord[]
): GenericRecord[] {
  return [...values].sort(
    (
      left,
      right
    ) =>
      canonicalText(left)
        .localeCompare(
          canonicalText(right)
        )
  );
}

function snapshotRefs(
  db: Firestore,
  snapshotPath: string
): SnapshotRefs {
  const metadataRef =
    db.doc(
      snapshotPath
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
): Promise<Context> {
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

  const recoverySessionRef =
    runRef
      .collection(
        "rebaseProductionMaintenanceSnapshotExecutions"
      )
      .doc(
        RECOVERY_SESSION_DOCUMENT
      );

  const recoveryResultRef =
    runRef
      .collection(
        "rebaseProductionMaintenanceSnapshotExecutionResults"
      )
      .doc(
        RECOVERY_RESULT_DOCUMENT
      );

  const finalSessionRef =
    runRef
      .collection(
        "rebaseFinalLivePreflightSessions"
      )
      .doc(
        FINAL_SESSION_DOCUMENT
      );

  const challengeRef =
    runRef
      .collection(
        "rebaseFinalLivePreflightChallenges"
      )
      .doc(
        FINAL_CHALLENGE_DOCUMENT
      );

  const lockRef =
    db.collection(
      "uidV2CutoverExecutionLocks"
    ).doc(
      "phase4c17r-production"
    );

  const maintenanceRef =
    db.collection(
      "uidV2MaintenanceWindows"
    ).doc(
      "phase4c-production-cutover"
    );

  const [
    recoverySessionSnapshot,
    recoveryResultSnapshot,
    phase4c13Snapshot
  ] = await Promise.all([
    recoverySessionRef.get(),
    recoveryResultRef.get(),
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
    !recoverySessionSnapshot.exists ||
    !recoveryResultSnapshot.exists ||
    !phase4c13Snapshot.exists
  ) {
    throw new HttpsError(
      "not-found",
      "Phase 4C-23R recovery evidence or Phase 4C-13R patch plan is missing."
    );
  }

  const recoverySession =
    recoverySessionSnapshot.data() ||
    {};

  const recoveryResultStored =
    recoveryResultSnapshot.data() ||
    {};

  const recoveryResult =
    asRecord(
      recoveryResultStored.result,
      "phase4c23.result"
    );

  const recoveryChain =
    asRecord(
      recoveryResult.chainChecks,
      "phase4c23.chainChecks"
    );

  const recoveryBlocking =
    asArray(
      recoveryResult.blockingReasons,
      "phase4c23.blockingReasons"
    );

  const phase4c13Plan =
    phase4c13Snapshot.data() ||
    {};

  const chainChecks:
    GenericRecord = {
    recoveryVersion:
      text(
        recoveryResultStored.version
      ) ===
      EXPECTED_PHASE4C23_RUNTIME_VERSION,
    recoveryStatus:
      text(
        recoveryResultStored.status
      ) ===
      "rebase_production_maintenance_snapshot_execution_completed",
    recoveryCaller:
      text(
        recoveryResultStored.approvedByFirebaseUid
      ) ===
      callerUid,
    recoveryContract:
      text(
        recoveryResultStored.contractDigest
      ) ===
      EXPECTED_PHASE4C23_CONTRACT_DIGEST,
    recoveryResultDigest:
      text(
        recoveryResultStored.resultDigest
      ) ===
      EXPECTED_PHASE4C23_RESULT_DIGEST,
    recoveryStoredResult:
      digestValue(
        recoveryResult
      ) ===
      EXPECTED_PHASE4C23_RESULT_DIGEST,
    recoveryCutoverRunId:
      text(
        recoveryResult.cutoverRunId
      ) ===
        EXPECTED_PHASE4C23_CUTOVER_RUN_ID &&
      text(
        recoverySession.cutoverRunId
      ) ===
        EXPECTED_PHASE4C23_CUTOVER_RUN_ID,
    recoverySnapshotPath:
      text(
        recoveryResult.snapshotPath
      ) ===
      EXPECTED_PHASE4C23_SNAPSHOT_PATH,
    recoverySnapshotDigests:
      text(
        recoveryResult.snapshotMetadataDigest
      ) ===
        EXPECTED_PHASE4C23_SNAPSHOT_METADATA_DIGEST &&
      text(
        recoveryResult.snapshotVerificationDigest
      ) ===
        EXPECTED_PHASE4C23_SNAPSHOT_VERIFICATION_DIGEST &&
      text(
        recoveryResult.freshRollbackSnapshotDigest
      ) ===
        EXPECTED_PHASE4C23_FRESH_ROLLBACK_DIGEST,
    recoveryReady:
      recoveryResult.productionExecutionLockOwned ===
        true &&
      recoveryResult.productionMaintenanceWindowActive ===
        true &&
      recoveryResult.productionRollbackSnapshotPersisted ===
        true &&
      recoveryResult.productionRollbackSnapshotSealed ===
        true &&
      recoveryResult.productionRollbackSnapshotRetained ===
        true,
    recoverySessionState:
      text(
        recoverySession.state
      ) ===
      "snapshot_retained_waiting_final_preflight",
    recoverySessionMaintenance:
      text(
        recoverySession.maintenanceState
      ) ===
      "active",
    recoveryChain:
      allTrue(
        recoveryChain
      ),
    recoveryBlocking:
      recoveryBlocking.length ===
      0,
    recoveryNoUidMutation:
      numberValue(
        recoveryResult.uidMutationWrites
      ) ===
        0 &&
      numberValue(
        recoverySession.uidMutationWrites
      ) ===
        0 &&
      recoveryResult.finalArmTokenIssued ===
        false &&
      recoveryResult.actualUidCutoverAllowed ===
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
      EXPECTED_PHASE4C13_PLAN_DIGEST,
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
      `Phase 4C-24R chain validation failed: ${blockingReasons.join(", ")}`
    );
  }

  return {
    db,
    callerUid,
    runRef,
    recoverySessionRef,
    recoveryResultRef,
    finalSessionRef,
    challengeRef,
    lockRef,
    maintenanceRef,
    phase4c13Plan,
    recoverySession,
    recoveryResultStored,
    recoveryResult,
    chainChecks,
    blockingReasons
  };
}

async function loadBaselineSnapshot(
  context: Context
): Promise<BaselineSnapshot> {
  const refs =
    snapshotRefs(
      context.db,
      EXPECTED_PHASE4C23_SNAPSHOT_PATH
    );

  const [
    metadataSnapshot,
    chunkSnapshot,
    verificationSnapshot
  ] = await Promise.all([
    refs.metadataRef.get(),
    refs.chunkRef.get(),
    refs.verificationRef.get()
  ]);

  if (
    !metadataSnapshot.exists ||
    !chunkSnapshot.exists ||
    !verificationSnapshot.exists
  ) {
    throw new HttpsError(
      "data-loss",
      "The sealed Phase 4C-23R rollback snapshot is incomplete."
    );
  }

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

  const canonical =
    gunzipSync(
      compressed
    ).toString(
      "utf8"
    );

  let payload:
    GenericRecord;

  try {
    payload =
      asRecord(
        JSON.parse(
          canonical
        ),
        "baseline payload"
      );
  }
  catch {
    throw new HttpsError(
      "data-loss",
      "The sealed Phase 4C-23R rollback payload is not valid JSON."
    );
  }

  const checks:
    GenericRecord = {
  metadataDigest:
    digestValue(
      metadata
    ) ===
    EXPECTED_PHASE4C23_SNAPSHOT_METADATA_DIGEST,
  verificationDigest:
    digestValue(
      verification
    ) ===
    EXPECTED_PHASE4C23_SNAPSHOT_VERIFICATION_DIGEST,
  metadataState:
    text(
      metadata.state
    ) ===
      "retained" &&
    metadata.createOnly ===
      true &&
    metadata.overwriteForbidden ===
      true,
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
    sha256Text(
      encoded
    ) ===
      EXPECTED_PHASE4C23_CHUNK_DIGEST &&
    text(
      chunk.payloadSegmentSha256
    ) ===
      EXPECTED_PHASE4C23_CHUNK_DIGEST,
  compressedDigest:
    sha256Buffer(
      compressed
    ) ===
      EXPECTED_PHASE4C23_COMPRESSED_SHA256 &&
    text(
      metadata.compressedSha256
    ) ===
      EXPECTED_PHASE4C23_COMPRESSED_SHA256,
  canonicalDigest:
    sha256Text(
      canonical
    ) ===
      EXPECTED_PHASE4C23_CANONICAL_SHA256 &&
    text(
      metadata.canonicalSha256
    ) ===
      EXPECTED_PHASE4C23_CANONICAL_SHA256,
  rollbackDigest:
    digestValue(
      payload
    ) ===
      EXPECTED_PHASE4C23_FRESH_ROLLBACK_DIGEST &&
    text(
      metadata.freshRollbackSnapshotDigest
    ) ===
      EXPECTED_PHASE4C23_FRESH_ROLLBACK_DIGEST,
  uidMutationZero:
    numberValue(
      metadata.uidMutationWrites
    ) ===
      0 &&
    metadata.finalArmTokenIssued ===
      false &&
    metadata.actualUidCutoverAllowed ===
      false
  };

  if (!allTrue(
    checks
  )) {
    throw new HttpsError(
      "data-loss",
      `Phase 4C-23R baseline snapshot verification failed: ${
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
          )
          .join(", ")
      }`
    );
  }

  return {
    metadata,
    chunk,
    verification,
    payload,
    canonicalText:
      canonical
  };
}

function validateFreshSheetEnvelope(
  value: unknown,
  plan: GenericRecord,
  preparedAtIso: string
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
      "Phase 4C-24R wrapper digest mismatch."
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

  const counts =
    asRecord(
      sourceSnapshot.counts,
      "sourceSnapshot.counts"
    );

  const verification =
    asRecord(
      sourceSnapshot.verification,
      "sourceSnapshot.verification"
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

  const preparedAtMillis =
    parseIsoMillis(
      preparedAtIso,
      "preflight.preparedAtIso"
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
    UID_V2_FINAL_LIVE_PREFLIGHT_PHASE4C24R_VERSION,
  wrapperPhase:
    text(
      wrapper.phase
    ) ===
    "Phase 4C-24R",
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
    EXPECTED_PHASE4C13_PLAN_DIGEST,
  generatedAfterPrepare:
    capturedAtMillis >=
    preparedAtMillis,
  captureNotFuture:
    capturedAtMillis <=
    Date.now() +
    30000,
  captureFresh:
    ageSeconds >=
      0 &&
    ageSeconds <=
      CAPTURE_WINDOW_SECONDS,
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
  counts:
    numberValue(
      counts.studentRows
    ) ===
      156 &&
    numberValue(
      counts.principalRows
    ) ===
      12 &&
    numberValue(
      counts.totalTargetCells
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
    verification.targetCellsBlank ===
    true,
  appendColumnVerified:
    verification.appendColumnPreconditionVerified ===
    true,
  targetCellsUnique:
    verification.targetCellsUnique ===
    true,
  principalAuthCaptured:
    verification.principalAuthColumn9Captured ===
    true,
  timestampUnchanged:
    verification.sourceFileTimestampUnchanged ===
    true,
  sourceSheetWritesZero:
    numberValue(
      wrapperSafety.sourceSheetWrites
    ) ===
      0,
  uidMutationZero:
    numberValue(
      wrapperSafety.uidMutationWrites
    ) ===
      0 &&
    wrapperSafety.actualUidCutoverAllowed ===
      false
  };

  if (!allTrue(
    checks
  )) {
    throw new HttpsError(
      "failed-precondition",
      `Fresh Sheet capture validation failed: ${
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
          )
          .join(", ")
      }`
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

async function captureAndCompareLiveState(
  context: Context,
  baseline: BaselineSnapshot,
  sheet: ValidSheetCapture
): Promise<FreshPayload> {
  const baselinePayload =
    baseline.payload;

  const baselineSheet =
    asRecord(
      baselinePayload.sheet,
      "baseline.sheet"
    );

  const baselineCells =
    asArray(
      baselineSheet.rollbackCells,
      "baseline.sheet.rollbackCells"
    ).map(
      (
        item,
        index
      ) =>
        asRecord(
          item,
          `baselineCell${index}`
        )
    );

  const baselineAnchors =
    asArray(
      baselineSheet.principalAuthColumn9Anchors,
      "baseline.sheet.principalAuthColumn9Anchors"
    ).map(
      (
        item,
        index
      ) =>
        asRecord(
          item,
          `baselineAnchor${index}`
        )
    );

  const baselineAttendance =
    asArray(
      baselinePayload.attendance,
      "baseline.attendance"
    ).map(
      (
        item,
        index
      ) =>
        asRecord(
          item,
          `baselineAttendance${index}`
        )
    );

  const baselineAssignments =
    asArray(
      baselinePayload.assignments,
      "baseline.assignments"
    ).map(
      (
        item,
        index
      ) =>
        asRecord(
          item,
          `baselineAssignment${index}`
        )
    );

  const baselineAuth =
    asRecord(
      baselinePayload.firebaseAuth,
      "baseline.firebaseAuth"
    );

  const baselineInPlace =
    asArray(
      baselinePayload.inPlaceAttendancePlans,
      "baseline.inPlaceAttendancePlans"
    ).map(
      (
        item,
        index
      ) =>
        asRecord(
          item,
          `baselineInPlace${index}`
        )
    );

  const attendanceRefs =
    baselineAttendance.map(
      (entry) =>
        context.db.doc(
          text(
            entry.sourcePath
          )
        )
    );

  const assignmentSourceRefs =
    baselineAssignments.map(
      (entry) =>
        context.db.doc(
          text(
            entry.sourcePath
          )
        )
    );

  const assignmentTargetRefs =
    baselineAssignments.map(
      (entry) =>
        context.db.doc(
          text(
            entry.targetPath
          )
        )
    );

  const inPlaceRefs =
    baselineInPlace.map(
      (entry) =>
        context.runRef
          .collection(
            "inPlaceAttendancePlans"
          )
          .doc(
            text(
              entry.id
            )
          )
    );

  const [
    attendanceSnapshots,
    assignmentSourceSnapshots,
    assignmentTargetSnapshots,
    inPlaceSnapshots
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
    ),
    Promise.all(
      inPlaceRefs.map(
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

  const inPlaceAttendancePlans =
    inPlaceSnapshots.map(
      (
        snapshot,
        index
      ) => {
        if (!snapshot.exists) {
          throw new HttpsError(
            "failed-precondition",
            `Missing in-place attendance plan: ${inPlaceRefs[index].path}`
          );
        }

        return {
          id:
            text(
              baselineInPlace[index].id
            ),
          data:
            serializeValue(
              snapshot.data() ||
              {}
            )
        };
      }
    );

  const sourceFirebaseUid =
    text(
      baselineAuth.sourceFirebaseUid
    );

  const targetFirebaseUid =
    text(
      baselineAuth.targetFirebaseUid
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

  const driftChecks:
    GenericRecord = {
  sheetRollbackCells:
    exactJson(
      sortRecords(
        sheet.cells
      ),
      sortRecords(
        baselineCells
      )
    ),
  principalAuthAnchors:
    exactJson(
      sortRecords(
        sheet.anchors
      ),
      sortRecords(
        baselineAnchors
      )
    ),
  attendanceDocuments:
    exactJson(
      attendance,
      baselineAttendance
    ),
  assignmentDocuments:
    exactJson(
      assignments,
      baselineAssignments
    ),
  inPlaceAttendancePlans:
    exactJson(
      inPlaceAttendancePlans,
      baselineInPlace
    ),
  firebaseAuthSource:
    exactJson(
      firebaseAuth,
      baselineAuth
    ),
  assignmentTargetsAbsent:
    assignmentTargetSnapshots.every(
      (snapshot) =>
        !snapshot.exists
    ),
  targetFirebaseAuthAbsent:
    targetExists ===
    false,
  sourceSheetTargetCellsBlank:
    sheet.cells.every(
      (cell) =>
        cell.targetCellBlank ===
          true &&
        blankCellState(
          cell.beforeState
        )
    ),
  counts:
    attendance.length ===
      69 &&
    assignments.length ===
      14 &&
    inPlaceAttendancePlans.length ===
      68 &&
    sheet.cells.length ===
      170 &&
    sheet.anchors.length ===
      12
  };

  if (!allTrue(
    driftChecks
  )) {
    throw new HttpsError(
      "failed-precondition",
      `Final live drift validation failed: ${
        Object.entries(
          driftChecks
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

  const firestoreSnapshot =
    {
      attendance,
      assignments,
      inPlaceAttendancePlans
    };

  const payload =
    {
      version:
        UID_V2_FINAL_LIVE_PREFLIGHT_PHASE4C24R_VERSION,
      phase:
        "Phase 4C-24R",
      mode:
        "final_live_preflight_fresh_rollback_snapshot",
      requestId:
        REQUEST_ID,
      containsSensitiveProductionData:
        true,
      passwordMaterialIncluded:
        false,
      priorRollbackSnapshotPath:
        EXPECTED_PHASE4C23_SNAPSHOT_PATH,
      priorRollbackSnapshotDigest:
        EXPECTED_PHASE4C23_FRESH_ROLLBACK_DIGEST,
      sheet: {
        phase4c24WrapperDigest:
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
      inPlaceAttendancePlans
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
      `Phase 4C-24R Fresh Snapshot exceeds the 8 MB limit: ${canonicalBytes}`
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
    REQUIRED_CHUNK_COUNT
  ) {
    throw new HttpsError(
      "resource-exhausted",
      `Phase 4C-24R requires exactly one current chunk; found ${chunks.length}.`
    );
  }

  return {
    payload:
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
    freshRollbackSnapshotDigest:
      digestValue(
        serializedPayload
      ),
    freshSheetSnapshotDigest:
      sheet.wrapperDigest,
    freshFirestoreSnapshotDigest:
      digestValue(
        firestoreSnapshot
      ),
    freshFirebaseAuthSnapshotDigest:
      digestValue(
        firebaseAuth
      ),
    driftChecks
  };
}

function publicPrepare(
  session: GenericRecord,
  duplicate: boolean,
  writeOperations: number
): GenericRecord {
  return {
    ok:
      true,
    version:
      UID_V2_FINAL_LIVE_PREFLIGHT_PHASE4C24R_VERSION,
    phase:
      "Phase 4C-24R",
    mode:
      "rebase156_final_live_preflight_fresh_snapshot_refresh_and_expiring_final_arm_challenge_only_no_uid_mutation",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    contractDigest:
      CONTRACT_DIGEST,
    preflightRunId:
      text(
        session.preflightRunId
      ),
    phase4c24SnapshotId:
      text(
        session.phase4c24SnapshotId
      ),
    state:
      text(
        session.state
      ),
    preparedAtIso:
      text(
        session.preparedAtIso
      ),
    captureDeadlineIso:
      text(
        session.captureDeadlineIso
      ),
    leaseExpiresAtIso:
      text(
        session.leaseExpiresAtIso
      ),
    priorSnapshotPath:
      EXPECTED_PHASE4C23_SNAPSHOT_PATH,
    priorSnapshotVerified:
      true,
    freshReplacementSnapshotRequired:
      true,
    productionExecutionLockOwned:
      true,
    productionMaintenanceWindowActive:
      true,
    uidMutationWrites:
      0,
    finalArmTokenIssued:
      false,
    actualUidCutoverAllowed:
      false,
    nextAction:
      "Run u156FinalPreflightCaptureFile71679(), select the new JSON, and finalize Phase 4C-24R."
  };
}

function publicFinalResult(
  storedChallenge: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean
): GenericRecord {
  const challengeCore =
    asRecord(
      storedChallenge.challengeCore,
      "challenge.challengeCore"
    );

  const challengeExpiresAtMillis =
    parseIsoMillis(
      challengeCore.challengeExpiresAtIso,
      "challenge.challengeExpiresAtIso"
    );

  const challengeSecondsRemaining =
    Math.max(
      0,
      (
        challengeExpiresAtMillis -
        Date.now()
      ) /
      1000
    );

  return {
    ok:
      true,
    version:
      UID_V2_FINAL_LIVE_PREFLIGHT_PHASE4C24R_VERSION,
    phase:
      "Phase 4C-24R",
    mode:
      "rebase156_final_live_preflight_fresh_snapshot_refresh_and_expiring_final_arm_challenge_only_no_uid_mutation",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    status:
      text(
        storedChallenge.status
      ),
    contractDigest:
      CONTRACT_DIGEST,
    challengeDigest:
      text(
        storedChallenge.challengeDigest
      ),
    challengeCoreDigest:
      digestValue(
        challengeCore
      ),
    preflightRunId:
      challengeCore.preflightRunId,
    cutoverRunId:
      challengeCore.cutoverRunId,
    priorSnapshotPath:
      challengeCore.priorSnapshotPath,
    freshSnapshotPath:
      challengeCore.freshSnapshotPath,
    freshSnapshotMetadataDigest:
      challengeCore.freshSnapshotMetadataDigest,
    freshSnapshotVerificationDigest:
      challengeCore.freshSnapshotVerificationDigest,
    freshRollbackSnapshotDigest:
      challengeCore.freshRollbackSnapshotDigest,
    freshSheetSnapshotDigest:
      challengeCore.freshSheetSnapshotDigest,
    freshFirestoreSnapshotDigest:
      challengeCore.freshFirestoreSnapshotDigest,
    freshFirebaseAuthSnapshotDigest:
      challengeCore.freshFirebaseAuthSnapshotDigest,
    canonicalSha256:
      challengeCore.canonicalSha256,
    compressedSha256:
      challengeCore.compressedSha256,
    chunkDigests:
      challengeCore.chunkDigests,
    canonicalBytes:
      challengeCore.canonicalBytes,
    compressedBytes:
      challengeCore.compressedBytes,
    encodedBytes:
      challengeCore.encodedBytes,
    chunkCount:
      challengeCore.chunkCount,
    expectedCounts:
      challengeCore.expectedCounts,
    correctedProjectedTotals:
      challengeCore.correctedProjectedTotals,
    liveDriftChecks:
      challengeCore.liveDriftChecks,
    chainChecks:
      challengeCore.chainChecks,
    blockingReasons:
      challengeCore.blockingReasons,
    challengeIssuedAtIso:
      challengeCore.challengeIssuedAtIso,
    challengeExpiresAtIso:
      challengeCore.challengeExpiresAtIso,
    challengeSecondsRemaining,
    challengeWithinValidity:
      challengeSecondsRemaining >
      0,
    productionExecutionLockOwned:
      challengeCore.productionExecutionLockOwned,
    productionMaintenanceWindowActive:
      challengeCore.productionMaintenanceWindowActive,
    freshRollbackSnapshotPersisted:
      challengeCore.freshRollbackSnapshotPersisted,
    freshRollbackSnapshotSealed:
      challengeCore.freshRollbackSnapshotSealed,
    freshRollbackSnapshotRetained:
      challengeCore.freshRollbackSnapshotRetained,
    finalLivePreflightPassed:
      challengeCore.finalLivePreflightPassed,
    sourceSheetWrites:
      challengeCore.sourceSheetWrites,
    activeUidRegistryWrites:
      challengeCore.activeUidRegistryWrites,
    attendanceWrites:
      challengeCore.attendanceWrites,
    assignmentWrites:
      challengeCore.assignmentWrites,
    firebaseAuthWrites:
      challengeCore.firebaseAuthWrites,
    sessionAuthChanges:
      challengeCore.sessionAuthChanges,
    uidMutationWrites:
      challengeCore.uidMutationWrites,
    finalArmTokenIssued:
      challengeCore.finalArmTokenIssued,
    actualUidCutoverAllowed:
      challengeCore.actualUidCutoverAllowed,
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
      uidCutoverCallableIncluded:
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
        challengeSecondsRemaining >
          0,
      requiresExactChallengeDigest:
        true,
      requiresNewExplicitApproval:
        true,
      mustRerunLiveStateChecks:
        true,
      uidMutationAllowed:
        false,
      actualUidCutoverAllowed:
        false
    }
  };
}

export const prepareUidV2FinalPreflightPhase4c24r =
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
              PrepareInput
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
          input.approvalPhrase
        ) !==
          APPROVAL_PHRASE ||
        input.confirmMaintenanceGuardDeployed !==
          true ||
        input.confirmProductionLockOwned !==
          true ||
        input.confirmNoUidMutation !==
          true ||
        input.confirmFreshSnapshotRefresh !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-24R prepare gate failed."
        );
      }

      const context =
        await buildContext(
          callerUid
        );

      await loadBaselineSnapshot(
        context
      );

      const existingSession =
        await context.finalSessionRef.get();

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
            "capture_window_open",
            "challenge_issued_waiting_explicit_final_arm_approval"
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
            "An incompatible Phase 4C-24R session already exists."
          );
        }

        return publicPrepare(
          session,
          true,
          0
        );
      }

      const nowMillis =
        Date.now();

      const preparedAtIso =
        new Date(
          nowMillis
        ).toISOString();

      const captureDeadlineIso =
        addSecondsIso(
          nowMillis,
          CAPTURE_WINDOW_SECONDS
        );

      const leaseExpiresAtIso =
        addSecondsIso(
          nowMillis,
          LEASE_SECONDS
        );

      const preflightRunId =
        [
          "phase4c24r",
          nowMillis.toString(36),
          randomBytes(8).toString("hex")
        ].join("-");

      const phase4c24SnapshotId =
        [
          preflightRunId,
          "snapshot"
        ].join("-");

      await context.db.runTransaction(
        async (transaction) => {
          const [
            currentFinalSession,
            currentChallenge,
            currentRecoverySession,
            currentLock,
            currentMaintenance
          ] = await Promise.all([
            transaction.get(
              context.finalSessionRef
            ),
            transaction.get(
              context.challengeRef
            ),
            transaction.get(
              context.recoverySessionRef
            ),
            transaction.get(
              context.lockRef
            ),
            transaction.get(
              context.maintenanceRef
            )
          ]);

          if (
            currentFinalSession.exists ||
            currentChallenge.exists
          ) {
            throw new HttpsError(
              "already-exists",
              "A Phase 4C-24R session or challenge already exists."
            );
          }

          if (
            !currentRecoverySession.exists ||
            !currentLock.exists ||
            !currentMaintenance.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Active production maintenance documents are missing."
            );
          }

          const recoverySession =
            currentRecoverySession.data() ||
            {};

          const lock =
            currentLock.data() ||
            {};

          const maintenance =
            currentMaintenance.data() ||
            {};

          const activeChecks:
            GenericRecord = {
          recoveryState:
            text(
              recoverySession.state
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
          maintenanceActive:
            text(
              maintenance.state
            ) ===
              "active" &&
            text(
              maintenance.approvedByFirebaseUid
            ) ===
              callerUid,
          cutoverRunId:
            text(
              recoverySession.cutoverRunId
            ) ===
              EXPECTED_PHASE4C23_CUTOVER_RUN_ID &&
            text(
              lock.cutoverRunId
            ) ===
              EXPECTED_PHASE4C23_CUTOVER_RUN_ID &&
            text(
              maintenance.cutoverRunId
            ) ===
              EXPECTED_PHASE4C23_CUTOVER_RUN_ID,
          leaseValid:
            parseIsoMillis(
              lock.leaseExpiresAtIso,
              "lock.leaseExpiresAtIso"
            ) >
            Date.now(),
          noUidMutation:
            numberValue(
              recoverySession.uidMutationWrites
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
            activeChecks
          )) {
            throw new HttpsError(
              "failed-precondition",
              `Phase 4C-24R active-state validation failed: ${
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

          transaction.set(
            context.finalSessionRef,
            {
              version:
                UID_V2_FINAL_LIVE_PREFLIGHT_PHASE4C24R_VERSION,
              phase:
                "Phase 4C-24R",
              mode:
                "rebase156_final_live_preflight_fresh_snapshot_refresh_and_expiring_final_arm_challenge_only_no_uid_mutation",
              requestId:
                REQUEST_ID,
              contractDigest:
                CONTRACT_DIGEST,
              approvedByFirebaseUid:
                callerUid,
              preflightRunId,
              phase4c24SnapshotId,
              cutoverRunId:
                EXPECTED_PHASE4C23_CUTOVER_RUN_ID,
              state:
                "capture_window_open",
              preparedAtIso,
              captureDeadlineIso,
              leaseExpiresAtIso,
              priorSnapshotPath:
                EXPECTED_PHASE4C23_SNAPSHOT_PATH,
              priorSnapshotDigest:
                EXPECTED_PHASE4C23_FRESH_ROLLBACK_DIGEST,
              chainChecks:
                context.chainChecks,
              blockingReasons:
                context.blockingReasons,
              productionExecutionLockOwned:
                true,
              productionMaintenanceWindowActive:
                true,
              freshRollbackSnapshotPersisted:
                false,
              finalLivePreflightPassed:
                false,
              finalArmTokenIssued:
                false,
              uidMutationWrites:
                0,
              actualUidCutoverAllowed:
                false,
              createdAtIso:
                preparedAtIso,
              updatedAtIso:
                preparedAtIso
            }
          );

          transaction.set(
            context.lockRef,
            {
              ...lock,
              heartbeatAtIso:
                preparedAtIso,
              leaseExpiresAtIso,
              phase4c24PreflightRunId:
                preflightRunId,
              uidMutationWrites:
                0,
              updatedAtIso:
                preparedAtIso
            }
          );

          transaction.set(
            context.maintenanceRef,
            {
              ...maintenance,
              heartbeatAtIso:
                preparedAtIso,
              leaseExpiresAtIso,
              phase4c24PreflightRunId:
                preflightRunId,
              uidMutationWrites:
                0,
              updatedAtIso:
                preparedAtIso
            }
          );

          transaction.set(
            context.recoverySessionRef,
            {
              ...recoverySession,
              heartbeatAtIso:
                preparedAtIso,
              leaseExpiresAtIso,
              phase4c24PreflightRunId:
                preflightRunId,
              uidMutationWrites:
                0,
              updatedAtIso:
                preparedAtIso
            }
          );
        }
      );

      const preparedSnapshot =
        await context.finalSessionRef.get();

      return publicPrepare(
        preparedSnapshot.data() ||
        {},
        false,
        PREPARE_WRITE_OPERATIONS
      );
    }
  );

export const finalizeUidV2FinalPreflightPhase4c24r =
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
              FinalizeInput
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
          input.approvalPhrase
        ) !==
          APPROVAL_PHRASE ||
        text(
          input.preflightRunId
        ) ===
          "" ||
        input.confirmMaintenanceGuardDeployed !==
          true ||
        input.confirmFreshCaptureAfterPrepare !==
          true ||
        input.confirmNoUidMutation !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-24R finalize gate failed."
        );
      }

      const context =
        await buildContext(
          callerUid
        );

      const existingChallenge =
        await context.challengeRef.get();

      if (existingChallenge.exists) {
        const stored =
          existingChallenge.data() ||
          {};

        const challengeCore =
          asRecord(
            stored.challengeCore,
            "existing.challengeCore"
          );

        if (
          text(
            challengeCore.preflightRunId
          ) !==
          text(
            input.preflightRunId
          )
        ) {
          throw new HttpsError(
            "already-exists",
            "A different Phase 4C-24R challenge already exists."
          );
        }

        return publicFinalResult(
          stored,
          true,
          0,
          false
        );
      }

      const [
        finalSessionSnapshot,
        recoverySessionSnapshot,
        lockSnapshot,
        maintenanceSnapshot
      ] = await Promise.all([
        context.finalSessionRef.get(),
        context.recoverySessionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get()
      ]);

      if (
        !finalSessionSnapshot.exists ||
        !recoverySessionSnapshot.exists ||
        !lockSnapshot.exists ||
        !maintenanceSnapshot.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-24R active documents are incomplete."
        );
      }

      const finalSession =
        finalSessionSnapshot.data() ||
        {};

      const recoverySession =
        recoverySessionSnapshot.data() ||
        {};

      const lock =
        lockSnapshot.data() ||
        {};

      const maintenance =
        maintenanceSnapshot.data() ||
        {};

      const preflightRunId =
        text(
          input.preflightRunId
        );

      const activeChecks:
        GenericRecord = {
      caller:
        text(
          finalSession.approvedByFirebaseUid
        ) ===
          callerUid &&
        text(
          recoverySession.approvedByFirebaseUid
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
      preflightRunId:
        text(
          finalSession.preflightRunId
        ) ===
        preflightRunId,
      sessionState:
        text(
          finalSession.state
        ) ===
        "capture_window_open",
      captureWindow:
        parseIsoMillis(
          finalSession.captureDeadlineIso,
          "finalSession.captureDeadlineIso"
        ) >
        Date.now(),
      recoveryState:
        text(
          recoverySession.state
        ) ===
        "snapshot_retained_waiting_final_preflight",
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
      cutoverRunId:
        text(
          finalSession.cutoverRunId
        ) ===
          EXPECTED_PHASE4C23_CUTOVER_RUN_ID &&
        text(
          recoverySession.cutoverRunId
        ) ===
          EXPECTED_PHASE4C23_CUTOVER_RUN_ID &&
        text(
          lock.cutoverRunId
        ) ===
          EXPECTED_PHASE4C23_CUTOVER_RUN_ID &&
        text(
          maintenance.cutoverRunId
        ) ===
          EXPECTED_PHASE4C23_CUTOVER_RUN_ID,
      leaseValid:
        parseIsoMillis(
          lock.leaseExpiresAtIso,
          "lock.leaseExpiresAtIso"
        ) >
        Date.now(),
      noUidMutation:
        numberValue(
          finalSession.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          recoverySession.uidMutationWrites
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
        activeChecks
      )) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-24R active-state validation failed: ${
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

      const baseline =
        await loadBaselineSnapshot(
          context
        );

      const sheet =
        validateFreshSheetEnvelope(
          input.sheetEnvelope,
          context.phase4c13Plan,
          text(
            finalSession.preparedAtIso
          )
        );

      const fresh =
        await captureAndCompareLiveState(
          context,
          baseline,
          sheet
        );

      const phase4c24SnapshotId =
        text(
          finalSession.phase4c24SnapshotId
        );

      const freshSnapshotPath =
        [
          "uidV2ProductionRollbackSnapshots",
          phase4c24SnapshotId
        ].join("/");

      const refs =
        snapshotRefs(
          context.db,
          freshSnapshotPath
        );

      const finalizedAtIso =
        new Date().toISOString();

      const leaseExpiresAtIso =
        addSecondsIso(
          Date.parse(
            finalizedAtIso
          ),
          LEASE_SECONDS
        );

      const metadata:
        GenericRecord = {
      version:
        UID_V2_FINAL_LIVE_PREFLIGHT_PHASE4C24R_VERSION,
      phase:
        "Phase 4C-24R",
      mode:
        "final_live_preflight_fresh_rollback_snapshot",
      requestId:
        REQUEST_ID,
      contractDigest:
        CONTRACT_DIGEST,
      preflightRunId,
      cutoverRunId:
        EXPECTED_PHASE4C23_CUTOVER_RUN_ID,
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
      priorSnapshotPath:
        EXPECTED_PHASE4C23_SNAPSHOT_PATH,
      priorSnapshotDigest:
        EXPECTED_PHASE4C23_FRESH_ROLLBACK_DIGEST,
      encoding:
        "canonical_json_gzip_base64",
      canonicalBytes:
        fresh.canonicalBytes,
      compressedBytes:
        fresh.compressedBytes,
      encodedBytes:
        fresh.encodedBytes,
      chunkCount:
        fresh.chunks.length,
      maximumChunkBytes:
        MAXIMUM_CHUNK_BYTES,
      canonicalSha256:
        fresh.canonicalSha256,
      compressedSha256:
        fresh.compressedSha256,
      chunkDigests:
        fresh.chunkDigests,
      freshSheetSnapshotDigest:
        fresh.freshSheetSnapshotDigest,
      freshFirestoreSnapshotDigest:
        fresh.freshFirestoreSnapshotDigest,
      freshFirebaseAuthSnapshotDigest:
        fresh.freshFirebaseAuthSnapshotDigest,
      freshRollbackSnapshotDigest:
        fresh.freshRollbackSnapshotDigest,
      liveDriftChecks:
        fresh.driftChecks,
      counts:
        expectedCounts(),
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
        finalizedAtIso,
      createdAtIso:
        finalizedAtIso,
      updatedAtIso:
        finalizedAtIso
      };

      const freshSnapshotMetadataDigest =
        digestValue(
          metadata
        );

      const verification:
        GenericRecord = {
      version:
        UID_V2_FINAL_LIVE_PREFLIGHT_PHASE4C24R_VERSION,
      phase:
        "Phase 4C-24R",
      preflightRunId,
      cutoverRunId:
        EXPECTED_PHASE4C23_CUTOVER_RUN_ID,
      state:
        "verified",
      metadataDigest:
        freshSnapshotMetadataDigest,
      canonicalSha256:
        fresh.canonicalSha256,
      compressedSha256:
        fresh.compressedSha256,
      chunkDigests:
        fresh.chunkDigests,
      canonicalBytes:
        fresh.canonicalBytes,
      compressedBytes:
        fresh.compressedBytes,
      encodedBytes:
        fresh.encodedBytes,
      chunkCount:
        fresh.chunks.length,
      liveDriftChecks:
        fresh.driftChecks,
      createOnlyVerified:
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
        finalizedAtIso
      };

      const freshSnapshotVerificationDigest =
        digestValue(
          verification
        );

      const challengeIssuedAtIso =
        finalizedAtIso;

      const challengeExpiresAtIso =
        addSecondsIso(
          Date.parse(
            challengeIssuedAtIso
          ),
          CHALLENGE_VALIDITY_SECONDS
        );

      const challengeCore:
        GenericRecord = {
      version:
        UID_V2_FINAL_LIVE_PREFLIGHT_PHASE4C24R_VERSION,
      phase:
        "Phase 4C-24R",
      mode:
        "rebase156_final_live_preflight_fresh_snapshot_refresh_and_expiring_final_arm_challenge_only_no_uid_mutation",
      requestId:
        REQUEST_ID,
      contractDigest:
        CONTRACT_DIGEST,
      preflightRunId,
      cutoverRunId:
        EXPECTED_PHASE4C23_CUTOVER_RUN_ID,
      approvedByFirebaseUidDigest:
        digestValue(
          callerUid
        ),
      priorSnapshotPath:
        EXPECTED_PHASE4C23_SNAPSHOT_PATH,
      priorSnapshotDigest:
        EXPECTED_PHASE4C23_FRESH_ROLLBACK_DIGEST,
      freshSnapshotPath,
      freshSnapshotMetadataDigest,
      freshSnapshotVerificationDigest,
      freshRollbackSnapshotDigest:
        fresh.freshRollbackSnapshotDigest,
      freshSheetSnapshotDigest:
        fresh.freshSheetSnapshotDigest,
      freshFirestoreSnapshotDigest:
        fresh.freshFirestoreSnapshotDigest,
      freshFirebaseAuthSnapshotDigest:
        fresh.freshFirebaseAuthSnapshotDigest,
      canonicalSha256:
        fresh.canonicalSha256,
      compressedSha256:
        fresh.compressedSha256,
      chunkDigests:
        fresh.chunkDigests,
      canonicalBytes:
        fresh.canonicalBytes,
      compressedBytes:
        fresh.compressedBytes,
      encodedBytes:
        fresh.encodedBytes,
      chunkCount:
        fresh.chunks.length,
      expectedCounts:
        expectedCounts(),
      correctedProjectedTotals:
        correctedTotals(),
      liveDriftChecks:
        fresh.driftChecks,
      chainChecks:
        context.chainChecks,
      blockingReasons:
        context.blockingReasons,
      phase4c22ContractDigest:
        EXPECTED_PHASE4C22_CONTRACT_DIGEST,
      phase4c22AssemblyCoreDigest:
        EXPECTED_PHASE4C22_CORE_DIGEST,
      phase4c22AssemblyPackageDigest:
        EXPECTED_PHASE4C22_PACKAGE_DIGEST,
      challengeNonce:
        randomBytes(24).toString("hex"),
      challengeIssuedAtIso,
      challengeExpiresAtIso,
      challengeValiditySeconds:
        CHALLENGE_VALIDITY_SECONDS,
      challengeState:
        "challenge_issued_waiting_explicit_final_arm_approval",
      productionExecutionLockOwned:
        true,
      productionMaintenanceWindowActive:
        true,
      freshRollbackSnapshotPersisted:
        true,
      freshRollbackSnapshotSealed:
        true,
      freshRollbackSnapshotRetained:
        true,
      finalLivePreflightPassed:
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
      uidMutationAllowed:
        false,
      actualUidCutoverAllowed:
        false,
      nextGate: {
        phase:
          NEXT_GATE_PHASE,
        requiresExactChallengeDigest:
          true,
        requiresNewExplicitApproval:
          true,
        mustRerunLiveStateChecks:
          true,
        uidMutationAllowed:
          false,
        actualUidCutoverAllowed:
          false
      }
      };

      const challengeDigest =
        digestValue(
          challengeCore
        );

      const storedChallenge:
        GenericRecord = {
      version:
        UID_V2_FINAL_LIVE_PREFLIGHT_PHASE4C24R_VERSION,
      phase:
        "Phase 4C-24R",
      mode:
        "rebase156_final_live_preflight_fresh_snapshot_refresh_and_expiring_final_arm_challenge_only_no_uid_mutation",
      requestId:
        REQUEST_ID,
      approvedByFirebaseUid:
        callerUid,
      contractDigest:
        CONTRACT_DIGEST,
      challengeDigest,
      challengeCore,
      status:
        "final_live_preflight_passed_challenge_issued",
      createdAtIso:
        finalizedAtIso
      };

      await context.db.runTransaction(
        async (transaction) => {
          const [
            currentFinalSession,
            currentChallenge,
            currentRecoverySession,
            currentLock,
            currentMaintenance,
            currentMetadata,
            currentChunk,
            currentVerification
          ] = await Promise.all([
            transaction.get(
              context.finalSessionRef
            ),
            transaction.get(
              context.challengeRef
            ),
            transaction.get(
              context.recoverySessionRef
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
            )
          ]);

          if (
            !currentFinalSession.exists ||
            !currentRecoverySession.exists ||
            !currentLock.exists ||
            !currentMaintenance.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-24R active documents disappeared before commit."
            );
          }

          if (
            currentChallenge.exists ||
            currentMetadata.exists ||
            currentChunk.exists ||
            currentVerification.exists
          ) {
            throw new HttpsError(
              "already-exists",
              "Phase 4C-24R create-only destination already exists."
            );
          }

          const currentFinalSessionData =
            currentFinalSession.data() ||
            {};

          const currentRecoverySessionData =
            currentRecoverySession.data() ||
            {};

          const currentLockData =
            currentLock.data() ||
            {};

          const currentMaintenanceData =
            currentMaintenance.data() ||
            {};

          const commitChecks:
            GenericRecord = {
          finalSessionState:
            text(
              currentFinalSessionData.state
            ) ===
            "capture_window_open",
          preflightRunId:
            text(
              currentFinalSessionData.preflightRunId
            ) ===
            preflightRunId,
          recoveryState:
            text(
              currentRecoverySessionData.state
            ) ===
            "snapshot_retained_waiting_final_preflight",
          lockOwned:
            text(
              currentLockData.state
            ) ===
            "owned",
          maintenanceActive:
            text(
              currentMaintenanceData.state
            ) ===
            "active",
          caller:
            text(
              currentFinalSessionData.approvedByFirebaseUid
            ) ===
              callerUid &&
            text(
              currentRecoverySessionData.approvedByFirebaseUid
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
          leaseValid:
            parseIsoMillis(
              currentLockData.leaseExpiresAtIso,
              "lock.leaseExpiresAtIso"
            ) >
            Date.now(),
          noUidMutation:
            numberValue(
              currentFinalSessionData.uidMutationWrites
            ) ===
              0 &&
            numberValue(
              currentRecoverySessionData.uidMutationWrites
            ) ===
              0 &&
            numberValue(
              currentLockData.uidMutationWrites
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
              `Phase 4C-24R commit gate failed: ${
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
            metadata
          );

          transaction.set(
            refs.chunkRef,
            {
              version:
                UID_V2_FINAL_LIVE_PREFLIGHT_PHASE4C24R_VERSION,
              phase:
                "Phase 4C-24R",
              preflightRunId,
              cutoverRunId:
                EXPECTED_PHASE4C23_CUTOVER_RUN_ID,
              chunkIndex:
                0,
              totalChunks:
                fresh.chunks.length,
              encoding:
                "base64_segment",
              payloadSegment:
                fresh.chunks[0],
              payloadSegmentBytes:
                Buffer.byteLength(
                  fresh.chunks[0],
                  "utf8"
                ),
              payloadSegmentSha256:
                fresh.chunkDigests[0],
              containsSensitiveProductionData:
                true,
              plaintextLoggingForbidden:
                true,
              createdAtIso:
                finalizedAtIso
            }
          );

          transaction.set(
            refs.verificationRef,
            verification
          );

          transaction.set(
            context.finalSessionRef,
            {
              ...currentFinalSessionData,
              state:
                "challenge_issued_waiting_explicit_final_arm_approval",
              freshSnapshotPath,
              freshSnapshotMetadataDigest,
              freshSnapshotVerificationDigest,
              freshRollbackSnapshotDigest:
                fresh.freshRollbackSnapshotDigest,
              challengeDigest,
              challengeIssuedAtIso,
              challengeExpiresAtIso,
              finalLivePreflightPassed:
                true,
              freshRollbackSnapshotPersisted:
                true,
              freshRollbackSnapshotSealed:
                true,
              freshRollbackSnapshotRetained:
                true,
              leaseExpiresAtIso,
              uidMutationWrites:
                0,
              updatedAtIso:
                finalizedAtIso
            }
          );

          transaction.set(
            context.lockRef,
            {
              ...currentLockData,
              heartbeatAtIso:
                finalizedAtIso,
              leaseExpiresAtIso,
              phase4c24PreflightRunId:
                preflightRunId,
              activeRollbackSnapshotPath:
                freshSnapshotPath,
              activeRollbackSnapshotDigest:
                fresh.freshRollbackSnapshotDigest,
              uidMutationWrites:
                0,
              updatedAtIso:
                finalizedAtIso
            }
          );

          transaction.set(
            context.maintenanceRef,
            {
              ...currentMaintenanceData,
              heartbeatAtIso:
                finalizedAtIso,
              leaseExpiresAtIso,
              phase4c24PreflightRunId:
                preflightRunId,
              activeRollbackSnapshotPath:
                freshSnapshotPath,
              activeRollbackSnapshotDigest:
                fresh.freshRollbackSnapshotDigest,
              finalLivePreflightPassed:
                true,
              uidMutationWrites:
                0,
              updatedAtIso:
                finalizedAtIso
            }
          );

          transaction.set(
            context.recoverySessionRef,
            {
              ...currentRecoverySessionData,
              heartbeatAtIso:
                finalizedAtIso,
              leaseExpiresAtIso,
              phase4c24PreflightRunId:
                preflightRunId,
              activeRollbackSnapshotPath:
                freshSnapshotPath,
              activeRollbackSnapshotDigest:
                fresh.freshRollbackSnapshotDigest,
              finalLivePreflightPassed:
                true,
              uidMutationWrites:
                0,
              updatedAtIso:
                finalizedAtIso
            }
          );

          transaction.set(
            context.challengeRef,
            storedChallenge
          );
        }
      );

      return publicFinalResult(
        storedChallenge,
        false,
        FINALIZE_WRITE_OPERATIONS,
        false
      );
    }
  );

export const inspectUidV2FinalPreflightPhase4c24r =
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
          CONTRACT_DIGEST ||
        text(
          input.preflightRunId
        ) ===
          ""
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-24R inspect gate failed."
        );
      }

      const context =
        await buildContext(
          callerUid
        );

      const [
        finalSessionSnapshot,
        challengeSnapshot,
        recoverySessionSnapshot,
        lockSnapshot,
        maintenanceSnapshot
      ] = await Promise.all([
        context.finalSessionRef.get(),
        context.challengeRef.get(),
        context.recoverySessionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get()
      ]);

      if (
        !finalSessionSnapshot.exists ||
        !challengeSnapshot.exists ||
        !recoverySessionSnapshot.exists ||
        !lockSnapshot.exists ||
        !maintenanceSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-24R finalized documents are incomplete."
        );
      }

      const finalSession =
        finalSessionSnapshot.data() ||
        {};

      const storedChallenge =
        challengeSnapshot.data() ||
        {};

      const challengeCore =
        asRecord(
          storedChallenge.challengeCore,
          "challenge.challengeCore"
        );

      const recoverySession =
        recoverySessionSnapshot.data() ||
        {};

      const lock =
        lockSnapshot.data() ||
        {};

      const maintenance =
        maintenanceSnapshot.data() ||
        {};

      const preflightRunId =
        text(
          input.preflightRunId
        );

      const freshSnapshotPath =
        text(
          challengeCore.freshSnapshotPath
        );

      const refs =
        snapshotRefs(
          context.db,
          freshSnapshotPath
        );

      const [
        metadataSnapshot,
        chunkSnapshot,
        verificationSnapshot
      ] = await Promise.all([
        refs.metadataRef.get(),
        refs.chunkRef.get(),
        refs.verificationRef.get()
      ]);

      if (
        !metadataSnapshot.exists ||
        !chunkSnapshot.exists ||
        !verificationSnapshot.exists
      ) {
        throw new HttpsError(
          "data-loss",
          "Phase 4C-24R Fresh Snapshot documents are incomplete."
        );
      }

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

      const canonical =
        gunzipSync(
          compressed
        ).toString(
          "utf8"
        );

      const challengeExpiresAtMillis =
        parseIsoMillis(
          challengeCore.challengeExpiresAtIso,
          "challenge.challengeExpiresAtIso"
        );

      const checks:
        GenericRecord = {
      status:
        text(
          storedChallenge.status
        ) ===
        "final_live_preflight_passed_challenge_issued",
      caller:
        text(
          storedChallenge.approvedByFirebaseUid
        ) ===
        callerUid,
      contract:
        text(
          storedChallenge.contractDigest
        ) ===
        CONTRACT_DIGEST,
      challengeDigest:
        text(
          storedChallenge.challengeDigest
        ) ===
        digestValue(
          challengeCore
        ),
      preflightRunId:
        text(
          challengeCore.preflightRunId
        ) ===
          preflightRunId &&
        text(
          finalSession.preflightRunId
        ) ===
          preflightRunId,
      sessionState:
        text(
          finalSession.state
        ) ===
        "challenge_issued_waiting_explicit_final_arm_approval",
      recoveryState:
        text(
          recoverySession.state
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
      maintenanceActive:
        text(
          maintenance.state
        ) ===
          "active" &&
        text(
          maintenance.approvedByFirebaseUid
        ) ===
          callerUid,
      leaseValid:
        parseIsoMillis(
          lock.leaseExpiresAtIso,
          "lock.leaseExpiresAtIso"
        ) >
        Date.now(),
      challengeValid:
        challengeExpiresAtMillis >
        Date.now(),
      metadataDigest:
        digestValue(
          metadata
        ) ===
        text(
          challengeCore.freshSnapshotMetadataDigest
        ),
      verificationDigest:
        digestValue(
          verification
        ) ===
        text(
          challengeCore.freshSnapshotVerificationDigest
        ),
      snapshotState:
        text(
          metadata.state
        ) ===
          "retained" &&
        metadata.createOnly ===
          true &&
        metadata.overwriteForbidden ===
          true,
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
        sha256Text(
          encoded
        ) ===
          text(
            asArray(
              challengeCore.chunkDigests,
              "challenge.chunkDigests"
            )[0]
          ) &&
        text(
          chunk.payloadSegmentSha256
        ) ===
          text(
            asArray(
              challengeCore.chunkDigests,
              "challenge.chunkDigests"
            )[0]
          ),
      compressedDigest:
        sha256Buffer(
          compressed
        ) ===
        text(
          challengeCore.compressedSha256
        ),
      canonicalDigest:
        sha256Text(
          canonical
        ) ===
        text(
          challengeCore.canonicalSha256
        ),
      rollbackDigest:
        digestValue(
          asRecord(
            JSON.parse(
              canonical
            ),
            "fresh rollback payload"
          )
        ) ===
        text(
          challengeCore.freshRollbackSnapshotDigest
        ),
      driftChecks:
        allTrue(
          asRecord(
            challengeCore.liveDriftChecks,
            "challenge.liveDriftChecks"
          )
        ),
      chainChecks:
        allTrue(
          asRecord(
            challengeCore.chainChecks,
            "challenge.chainChecks"
          )
        ),
      blockingReasons:
        asArray(
          challengeCore.blockingReasons,
          "challenge.blockingReasons"
        ).length ===
        0,
      preflightPassed:
        challengeCore.finalLivePreflightPassed ===
          true &&
        challengeCore.freshRollbackSnapshotPersisted ===
          true &&
        challengeCore.freshRollbackSnapshotSealed ===
          true &&
        challengeCore.freshRollbackSnapshotRetained ===
          true,
      noOperationalMutation:
        numberValue(
          challengeCore.sourceSheetWrites
        ) ===
          0 &&
        numberValue(
          challengeCore.activeUidRegistryWrites
        ) ===
          0 &&
        numberValue(
          challengeCore.attendanceWrites
        ) ===
          0 &&
        numberValue(
          challengeCore.assignmentWrites
        ) ===
          0 &&
        numberValue(
          challengeCore.firebaseAuthWrites
        ) ===
          0 &&
        numberValue(
          challengeCore.sessionAuthChanges
        ) ===
          0 &&
        numberValue(
          challengeCore.uidMutationWrites
        ) ===
          0,
      noFinalArm:
        challengeCore.finalArmTokenIssued ===
        false,
      noCutover:
        challengeCore.uidMutationAllowed ===
          false &&
        challengeCore.actualUidCutoverAllowed ===
          false
      };

      if (!allTrue(
        checks
      )) {
        throw new HttpsError(
          "data-loss",
          `Phase 4C-24R verification failed: ${
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
              )
              .join(", ")
          }`
        );
      }

      return publicFinalResult(
        storedChallenge,
        true,
        0,
        true
      );
    }
  );
