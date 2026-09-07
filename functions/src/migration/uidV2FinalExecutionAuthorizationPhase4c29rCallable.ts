import {
  createHash,
  randomBytes
} from "node:crypto";
import {
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

export const UID_V2_REFRESH_CHAIN_PHASE4C71682_VERSION =
  "2026-07-28.716.82-phase4c-refresh-expired-challenge-token-chain-live-recheck-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "c787384e74bf889a5b5aea16cb1571ce68ac64e5e0588a84f654b8041f75d67f";

const CHALLENGE_APPROVAL_PHRASE =
  "Phase 4C 갱신 1단계: Fresh Live 재검증과 새 Final Preflight Challenge 생성을 승인합니다. UID 변경은 실행하지 않습니다.";

const TOKEN_APPROVAL_PHRASE =
  "Phase 4C 갱신 2단계: 새 Challenge 검증과 일회성 Final Arm Token 발급을 승인합니다. UID 변경은 실행하지 않습니다.";

const EXECUTION_APPROVAL_PHRASE =
  "Phase 4C 갱신 3단계: 새 Token 검증과 Cutover 실행 Challenge 생성을 승인합니다. 실제 Cutover는 실행하지 않습니다.";

const EXPECTED_PHASE4C24_RUNTIME_VERSION =
  "2026-07-28.716.79-phase4c24r-final-live-preflight-fresh-snapshot-refresh-expiring-challenge-only";

const EXPECTED_PHASE4C24_CONTRACT_DIGEST =
  "441587279139d98a42a885c3135a1824f795151bbfe992844afe589f45548634";

const EXPECTED_CHALLENGE_DIGEST =
  "23dc7ae6268c3183f15ecc0bc91a51901fc63aae0f48dcdca29a65b1ab8dbab6";

const EXPECTED_PREFLIGHT_RUN_ID =
  "phase4c24r-ms4nvomb-93c665ae5d26eb22";

const EXPECTED_CUTOVER_RUN_ID =
  "phase4c23r-ms4lvf6s-91c84bbc03f64521";

const EXPECTED_FRESH_SNAPSHOT_PATH =
  "uidV2ProductionRollbackSnapshots/phase4c24r-ms4nvomb-93c665ae5d26eb22-snapshot";

const EXPECTED_METADATA_DIGEST =
  "eeb9d0b3d692c11d721edfae66f21fb409ae5f4aa95f30f782f5971805b179f7";

const EXPECTED_VERIFICATION_DIGEST =
  "a391e7cf6bca62664e9356836204377e46b7aab8a4864b8e936c06cc35022e92";

const EXPECTED_ROLLBACK_DIGEST =
  "a9bd1d73135048b73a9c702015570ad97193f4acad4dcbbae658daeca2360fc0";

const EXPECTED_CANONICAL_SHA256 =
  "a9bd1d73135048b73a9c702015570ad97193f4acad4dcbbae658daeca2360fc0";

const EXPECTED_COMPRESSED_SHA256 =
  "a21bcc6bd88bcda40b2e96037957e0c90bf5d9acfe019118e91a2ce3dd80e740";

const EXPECTED_CHUNK_DIGEST =
  "872364ab1ecb3a3b5dae3ec739b94a099c1b4cedd262502bc843cde63fa9d8ce";

const EXPECTED_CHALLENGE_EXPIRES_AT_ISO =
  "2026-07-28T13:35:02.431Z";

const EXPECTED_OLD_TOKEN_RUNTIME_VERSION =
  "2026-07-28.716.80-phase4c25r-explicit-final-arm-token-issuance-live-recheck-only-no-uid-mutation";

const EXPECTED_OLD_TOKEN_CONTRACT_DIGEST =
  "fc461d86ba6f33739e4740a3f7c1b45e49b3782c56b8587c294c55a6610a6541";

const EXPECTED_OLD_TOKEN_DIGEST =
  "8f987b7b94c25406886cf4211c8415bba95035a1f6183ffae48ddfa8fcd3d534";

const EXPECTED_OLD_TOKEN_ID =
  "phase4c25r-ms4p19o7-44b18dd42cc29910ba62acc1";

const EXPECTED_OLD_TOKEN_EXPIRES_AT_ISO =
  "2026-07-28T13:40:29.815Z";

const FINAL_SESSION_DOCUMENT =
  "phase4c24r-71679";

const FINAL_CHALLENGE_DOCUMENT =
  "phase4c24r-71679";

const FINAL_ARM_TOKEN_DOCUMENT =
  "phase4c25r-71680";

const OLD_EXECUTION_CHALLENGE_DOCUMENT =
  "phase4c26r-71681";

const REFRESH_SESSION_DOCUMENT =
  "phase4c-refresh-71682";

const REFRESH_CHALLENGE_DOCUMENT =
  "phase4c24r-refresh-71682";

const REFRESH_TOKEN_DOCUMENT =
  "phase4c25r-refresh-71682";

const REFRESH_EXECUTION_CHALLENGE_DOCUMENT =
  "phase4c26r-refresh-71682";

const RECOVERY_SESSION_DOCUMENT =
  "phase4c23r-71678";

const SHEET_CAPTURE_MAX_AGE_SECONDS =
  600;

const CHALLENGE_VALIDITY_SECONDS =
  1800;

const TOKEN_VALIDITY_SECONDS =
  1800;

const EXECUTION_CHALLENGE_VALIDITY_SECONDS =
  1800;

const LEASE_SECONDS =
  7200;

const STAGE_WRITE_OPERATIONS =
  5;

const NEXT_GATE_PHASE =
  "Phase 4C-27R execution challenge verification and sealed cutover execution package only";

type GenericRecord =
  Record<string, unknown>;

interface ChallengeInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly approvalPhrase?: unknown;
  readonly sheetEnvelope?: unknown;
  readonly confirmMaintenanceGuardDeployed?: unknown;
  readonly confirmOldTokenExpiredUnused?: unknown;
  readonly confirmNoUidMutation?: unknown;
}

interface TokenInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly approvalPhrase?: unknown;
  readonly refreshChallengeDigest?: unknown;
  readonly sheetEnvelope?: unknown;
  readonly confirmChallengeValid?: unknown;
  readonly confirmNoUidMutation?: unknown;
}

interface ExecutionInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly approvalPhrase?: unknown;
  readonly refreshTokenDigest?: unknown;
  readonly sheetEnvelope?: unknown;
  readonly confirmTokenValidUnused?: unknown;
  readonly confirmNoUidMutation?: unknown;
  readonly confirmNoCutover?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly stage?: unknown;
  readonly digest?: unknown;
}

interface Context {
  readonly db:
    Firestore;
  readonly callerUid:
    string;
  readonly runRef:
    DocumentReference<DocumentData>;
  readonly finalSessionRef:
    DocumentReference<DocumentData>;
  readonly challengeRef:
    DocumentReference<DocumentData>;
  readonly tokenRef:
    DocumentReference<DocumentData>;
  readonly oldExecutionChallengeRef:
    DocumentReference<DocumentData>;
  readonly refreshSessionRef:
    DocumentReference<DocumentData>;
  readonly refreshChallengeRef:
    DocumentReference<DocumentData>;
  readonly refreshTokenRef:
    DocumentReference<DocumentData>;
  readonly refreshExecutionChallengeRef:
    DocumentReference<DocumentData>;
  readonly recoverySessionRef:
    DocumentReference<DocumentData>;
  readonly lockRef:
    DocumentReference<DocumentData>;
  readonly maintenanceRef:
    DocumentReference<DocumentData>;
}

interface SnapshotBaseline {
  readonly metadata:
    GenericRecord;
  readonly chunk:
    GenericRecord;
  readonly verification:
    GenericRecord;
  readonly payload:
    GenericRecord;
}

interface ValidSheetCapture {
  readonly wrapperDigest:
    string;
  readonly cells:
    GenericRecord[];
  readonly anchors:
    GenericRecord[];
  readonly capturedAtIso:
    string;
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

function buildContext(
  callerUid: string
): Context {
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

  return {
    db,
    callerUid,
    runRef,
    finalSessionRef:
      runRef
        .collection(
          "rebaseFinalLivePreflightSessions"
        )
        .doc(
          FINAL_SESSION_DOCUMENT
        ),
    challengeRef:
      runRef
        .collection(
          "rebaseFinalLivePreflightChallenges"
        )
        .doc(
          FINAL_CHALLENGE_DOCUMENT
        ),
    tokenRef:
      runRef
        .collection(
          "rebaseFinalArmTokens"
        )
        .doc(
          FINAL_ARM_TOKEN_DOCUMENT
        ),
    oldExecutionChallengeRef:
      runRef
        .collection(
          "rebaseCutoverExecutionChallenges"
        )
        .doc(
          OLD_EXECUTION_CHALLENGE_DOCUMENT
        ),
    refreshSessionRef:
      runRef
        .collection(
          "rebaseRefreshChainSessions"
        )
        .doc(
          REFRESH_SESSION_DOCUMENT
        ),
    refreshChallengeRef:
      runRef
        .collection(
          "rebaseFinalLivePreflightChallenges"
        )
        .doc(
          REFRESH_CHALLENGE_DOCUMENT
        ),
    refreshTokenRef:
      runRef
        .collection(
          "rebaseFinalArmTokens"
        )
        .doc(
          REFRESH_TOKEN_DOCUMENT
        ),
    refreshExecutionChallengeRef:
      runRef
        .collection(
          "rebaseCutoverExecutionChallenges"
        )
        .doc(
          REFRESH_EXECUTION_CHALLENGE_DOCUMENT
        ),
    recoverySessionRef:
      runRef
        .collection(
          "rebaseProductionMaintenanceSnapshotExecutions"
        )
        .doc(
          RECOVERY_SESSION_DOCUMENT
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
      )
  };
}

async function loadSnapshotBaseline(
  context: Context
): Promise<SnapshotBaseline> {
  const metadataRef =
    context.db.doc(
      EXPECTED_FRESH_SNAPSHOT_PATH
    );

  const chunkRef =
    metadataRef
      .collection(
        "payloadChunks"
      )
      .doc(
        "chunk-000000"
      );

  const verificationRef =
    metadataRef
      .collection(
        "verificationEvents"
      )
      .doc(
        "event-000000"
      );

  const [
    metadataSnapshot,
    chunkSnapshot,
    verificationSnapshot
  ] = await Promise.all([
    metadataRef.get(),
    chunkRef.get(),
    verificationRef.get()
  ]);

  if (
    !metadataSnapshot.exists ||
    !chunkSnapshot.exists ||
    !verificationSnapshot.exists
  ) {
    throw new HttpsError(
      "data-loss",
      "Phase 4C-24R Fresh Snapshot is incomplete."
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
        "fresh rollback payload"
      );
  }
  catch {
    throw new HttpsError(
      "data-loss",
      "Phase 4C-24R Fresh Snapshot payload is invalid."
    );
  }

  const checks:
    GenericRecord = {
  metadataDigest:
    digestValue(
      metadata
    ) ===
    EXPECTED_METADATA_DIGEST,
  verificationDigest:
    digestValue(
      verification
    ) ===
    EXPECTED_VERIFICATION_DIGEST,
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
      EXPECTED_CHUNK_DIGEST &&
    text(
      chunk.payloadSegmentSha256
    ) ===
      EXPECTED_CHUNK_DIGEST,
  compressedDigest:
    sha256Buffer(
      compressed
    ) ===
      EXPECTED_COMPRESSED_SHA256,
  canonicalDigest:
    sha256Text(
      canonical
    ) ===
      EXPECTED_CANONICAL_SHA256,
  rollbackDigest:
    digestValue(
      payload
    ) ===
      EXPECTED_ROLLBACK_DIGEST,
  noMutation:
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
      `Phase 4C-24R Fresh Snapshot verification failed: ${
        Object.entries(checks)
          .filter(([, passed]) => passed !== true)
          .map(([key]) => key)
          .join(", ")
      }`
    );
  }

  return {
    metadata,
    chunk,
    verification,
    payload
  };
}

function validateSheetEnvelope(
  value: unknown,
  baselinePayload: GenericRecord,
  expectedPhase: string
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
      "Refresh Chain Sheet wrapper digest mismatch."
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

  if (
    text(
      sourceEnvelope.snapshotDigest
    ) !==
    digestValue(
      sourceSnapshot
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Refresh Chain nested Sheet digest mismatch."
    );
  }

  const cells =
    asArray(
      sourceSnapshot.rollbackCells,
      "rollbackCells"
    ).map(
      (item, index) =>
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
      (item, index) =>
        asRecord(
          item,
          `principalAnchor${index}`
        )
    );

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
      (item, index) =>
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
      (item, index) =>
        asRecord(
          item,
          `baselineAnchor${index}`
        )
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
    UID_V2_REFRESH_CHAIN_PHASE4C71682_VERSION,
  wrapperPhase:
    text(
      wrapper.phase
    ) ===
    expectedPhase,
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
  captureNotFuture:
    capturedAtMillis <=
    Date.now() +
    30000,
  captureFresh:
    ageSeconds >=
      0 &&
    ageSeconds <=
      SHEET_CAPTURE_MAX_AGE_SECONDS,
  cells:
    cells.length ===
      170 &&
    exactJson(
      sortRecords(cells),
      sortRecords(baselineCells)
    ),
  anchors:
    anchors.length ===
      12 &&
    exactJson(
      sortRecords(anchors),
      sortRecords(baselineAnchors)
    ),
  blank:
    cells.every(
      (cell) =>
        cell.targetCellBlank ===
          true &&
        blankCellState(
          cell.beforeState
        )
    ),
  noMutation:
    numberValue(
      asRecord(
        wrapper.safety,
        "wrapper.safety"
      ).uidMutationWrites
    ) ===
      0 &&
    asRecord(
      wrapper.safety,
      "wrapper.safety"
    ).actualUidCutoverAllowed ===
      false
  };

  if (!allTrue(
    checks
  )) {
    throw new HttpsError(
      "failed-precondition",
      `Refresh Chain Fresh Sheet validation failed: ${
        Object.entries(checks)
          .filter(([, passed]) => passed !== true)
          .map(([key]) => key)
          .join(", ")
      }`
    );
  }

  return {
    wrapperDigest,
    cells,
    anchors,
    capturedAtIso
  };
}

async function liveRecheck(
  context: Context,
  baselinePayload: GenericRecord,
  sheet: ValidSheetCapture
): Promise<GenericRecord> {
  const baselineAttendance =
    asArray(
      baselinePayload.attendance,
      "baseline.attendance"
    ).map(
      (item, index) =>
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
      (item, index) =>
        asRecord(
          item,
          `baselineAssignment${index}`
        )
    );

  const baselineInPlace =
    asArray(
      baselinePayload.inPlaceAttendancePlans,
      "baseline.inPlaceAttendancePlans"
    ).map(
      (item, index) =>
        asRecord(
          item,
          `baselineInPlace${index}`
        )
    );

  const baselineAuth =
    asRecord(
      baselinePayload.firebaseAuth,
      "baseline.firebaseAuth"
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
      (snapshot, index) => {
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
      (snapshot, index) => {
        if (!snapshot.exists) {
          throw new HttpsError(
            "failed-precondition",
            `Missing assignment document: ${assignmentSourceRefs[index].path}`
          );
        }

        if (
          assignmentTargetSnapshots[index].exists
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
            assignmentSourceRefs[index].path,
          targetPath:
            assignmentTargetRefs[index].path,
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
      (snapshot, index) => {
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

  const checks:
    GenericRecord = {
  sheetRollbackCells:
    sheet.cells.length ===
    170,
  principalAuthAnchors:
    sheet.anchors.length ===
    12,
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
  counts:
    attendance.length ===
      69 &&
    assignments.length ===
      14 &&
    inPlaceAttendancePlans.length ===
      68
  };

  if (!allTrue(
    checks
  )) {
    throw new HttpsError(
      "failed-precondition",
      `Refresh Chain live recheck failed: ${
        Object.entries(checks)
          .filter(([, passed]) => passed !== true)
          .map(([key]) => key)
          .join(", ")
      }`
    );
  }

  return {
    checks,
    sheetCaptureDigest:
      sheet.wrapperDigest,
    attendanceDigest:
      digestValue(attendance),
    assignmentDigest:
      digestValue(assignments),
    inPlaceAttendanceDigest:
      digestValue(inPlaceAttendancePlans),
    firebaseAuthDigest:
      digestValue(firebaseAuth)
  };
}

function expirySeconds(
  value: unknown
): number {
  return Math.max(
    0,
    (
      parseIsoMillis(
        value,
        "expiresAtIso"
      ) -
      Date.now()
    ) /
    1000
  );
}

function liveChecksPassed(
  value: unknown
): boolean {
  return allTrue(
    asRecord(
      asRecord(
        value,
        "liveRecheck"
      ).checks,
      "liveRecheck.checks"
    )
  );
}

function publicStage(
  stage: string,
  stored: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean
): GenericRecord {
  const core =
    asRecord(
      stored.core,
      `${stage}.core`
    );

  const digest =
    text(
      stored.digest
    );

  const expiresAtIso =
    text(
      core.expiresAtIso
    );

  const secondsRemaining =
    expirySeconds(
      expiresAtIso
    );

  return {
    ok: true,
    version: UID_V2_REFRESH_CHAIN_PHASE4C71682_VERSION,
    phase: "Phase 4C Refresh Chain",
    mode: "rebase156_expired_challenge_token_refresh_chain_live_recheck_only_no_uid_mutation_no_cutover",
    requestId: REQUEST_ID,
    stage,
    duplicate,
    writeOperations,
    status: text(stored.status),
    contractDigest: CONTRACT_DIGEST,
    digest,
    coreDigest: digestValue(core),
    id: core.id,
    state: core.state,
    issuedAtIso: core.issuedAtIso,
    expiresAtIso,
    secondsRemaining,
    withinValidity: secondsRemaining > 0,
    challengeDigest: core.challengeDigest || null,
    tokenDigest: core.tokenDigest || null,
    executionChallengeDigest: core.executionChallengeDigest || null,
    tokenUsed: core.tokenUsed === true,
    liveRecheck: core.liveRecheck,
    productionExecutionLockOwned: core.productionExecutionLockOwned,
    productionMaintenanceWindowActive: core.productionMaintenanceWindowActive,
    uidMutationWrites: core.uidMutationWrites,
    actualCutoverWrites: core.actualCutoverWrites,
    verified,
    digestMatches: verified,
    safety: {
      sourceSheetWrites: 0, activeUidRegistryWrites: 0, attendanceWrites: 0,
      assignmentWrites: 0, firebaseAuthWrites: 0, sessionAuthChanges: 0,
      uidMutationWrites: 0, actualCutoverWrites: 0,
      tokenConsumptionCallableIncluded: false, cutoverExecutionCallableIncluded: false,
      actualUidCutoverAllowed: false
    },
    nextGate: core.nextGate
  };
}

async function activeDocuments(
  context: Context
): Promise<{
    recovery: GenericRecord;
    lock: GenericRecord;
    maintenance: GenericRecord;
  }> {
  const [recoverySnapshot, lockSnapshot, maintenanceSnapshot] =
    await Promise.all([
      context.recoverySessionRef.get(),
      context.lockRef.get(),
      context.maintenanceRef.get()
    ]);

  if (!recoverySnapshot.exists || !lockSnapshot.exists || !maintenanceSnapshot.exists) {
    throw new HttpsError("failed-precondition", "Active maintenance documents are missing.");
  }

  const recovery = recoverySnapshot.data() || {};
  const lock = lockSnapshot.data() || {};
  const maintenance = maintenanceSnapshot.data() || {};

  const checks: GenericRecord = {
    recoveryState: text(recovery.state) === "snapshot_retained_waiting_final_preflight",
    lockOwned: text(lock.state) === "owned" && text(lock.approvedByFirebaseUid) === context.callerUid,
    maintenanceActive: text(maintenance.state) === "active" && text(maintenance.approvedByFirebaseUid) === context.callerUid,
    cutoverRunId: text(recovery.cutoverRunId) === EXPECTED_CUTOVER_RUN_ID && text(lock.cutoverRunId) === EXPECTED_CUTOVER_RUN_ID && text(maintenance.cutoverRunId) === EXPECTED_CUTOVER_RUN_ID,
    leaseValid: parseIsoMillis(lock.leaseExpiresAtIso, "lock.leaseExpiresAtIso") > Date.now(),
    noMutation: numberValue(recovery.uidMutationWrites) === 0 && numberValue(lock.uidMutationWrites) === 0 && numberValue(maintenance.uidMutationWrites) === 0
  };

  if (!allTrue(checks)) {
    throw new HttpsError("failed-precondition", `Maintenance validation failed: ${Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k).join(", ")}`);
  }

  return {recovery, lock, maintenance};
}

export const refreshUidV2FinalPreflightChallengePhase4c71682 = onCall(
  {region: REGION, timeoutSeconds: 540, memory: "1GiB", enforceAppCheck: false},
  async (request) => {
    const callerUid = requireSuperAdmin(request.auth as {uid:string;token:GenericRecord}|undefined);
    const input = request.data && typeof request.data === "object" ? request.data as ChallengeInput : {};
    if (text(input.requestId)!==REQUEST_ID || text(input.contractDigest)!==CONTRACT_DIGEST || text(input.approvalPhrase)!==CHALLENGE_APPROVAL_PHRASE || input.confirmMaintenanceGuardDeployed!==true || input.confirmOldTokenExpiredUnused!==true || input.confirmNoUidMutation!==true) {
      throw new HttpsError("failed-precondition", "Refresh challenge approval gate failed.");
    }
    const context=buildContext(callerUid);
    const existing=await context.refreshChallengeRef.get();
    if(existing.exists) return publicStage("challenge",existing.data()||{},true,0,false);

    const [oldChallengeSnapshot,oldTokenSnapshot,oldExecutionSnapshot,finalSessionSnapshot]=await Promise.all([context.challengeRef.get(),context.tokenRef.get(),context.oldExecutionChallengeRef.get(),context.finalSessionRef.get()]);
    if(!oldChallengeSnapshot.exists||!oldTokenSnapshot.exists||!finalSessionSnapshot.exists) throw new HttpsError("failed-precondition","Expired chain evidence is incomplete.");
    const oldChallenge=oldChallengeSnapshot.data()||{}; const oldChallengeCore=asRecord(oldChallenge.challengeCore,"oldChallenge.core");
    const oldToken=oldTokenSnapshot.data()||{}; const oldTokenCore=asRecord(oldToken.tokenCore,"oldToken.core");
    const finalSession=finalSessionSnapshot.data()||{};
    const oldExecution=oldExecutionSnapshot.exists?(oldExecutionSnapshot.data()||{}):null;
    let oldExecutionSafe=true;
    if(oldExecution){
      const oldCore=asRecord(oldExecution.challengeCore,"oldExecution.core");
      oldExecutionSafe=parseIsoMillis(oldCore.executionChallengeExpiresAtIso,"oldExecution.expiresAtIso")<=Date.now() && numberValue(oldCore.uidMutationWrites)===0 && numberValue(oldCore.actualCutoverWrites)===0;
    }
    const priorChecks:GenericRecord={
      oldChallengeVersion:text(oldChallenge.version)===EXPECTED_PHASE4C24_RUNTIME_VERSION && text(oldChallenge.contractDigest)===EXPECTED_PHASE4C24_CONTRACT_DIGEST,
      oldChallengeIdentity:text(oldChallengeCore.preflightRunId)===EXPECTED_PREFLIGHT_RUN_ID && text(oldChallengeCore.challengeExpiresAtIso)===EXPECTED_CHALLENGE_EXPIRES_AT_ISO,
      oldChallengeDigest:text(oldChallenge.challengeDigest)===EXPECTED_CHALLENGE_DIGEST && digestValue(oldChallengeCore)===EXPECTED_CHALLENGE_DIGEST,
      oldChallengeExpired:parseIsoMillis(oldChallengeCore.challengeExpiresAtIso,"oldChallenge.expiresAtIso")<=Date.now(),
      oldTokenVersion:text(oldToken.version)===EXPECTED_OLD_TOKEN_RUNTIME_VERSION && text(oldToken.contractDigest)===EXPECTED_OLD_TOKEN_CONTRACT_DIGEST,
      oldTokenDigest:text(oldToken.tokenDigest)===EXPECTED_OLD_TOKEN_DIGEST && digestValue(oldTokenCore)===EXPECTED_OLD_TOKEN_DIGEST,
      oldTokenIdentity:text(oldTokenCore.tokenId)===EXPECTED_OLD_TOKEN_ID && text(oldTokenCore.tokenExpiresAtIso)===EXPECTED_OLD_TOKEN_EXPIRES_AT_ISO,
      oldTokenExpired:parseIsoMillis(oldTokenCore.tokenExpiresAtIso,"oldToken.expiresAtIso")<=Date.now(),
      oldTokenUnused:oldTokenCore.tokenUsed===false && numberValue(oldTokenCore.tokenUseCount)===0,
      oldExecutionSafe,
      finalSessionNoMutation:numberValue(finalSession.uidMutationWrites)===0 && finalSession.actualUidCutoverAllowed===false
    };
    if(!allTrue(priorChecks)) throw new HttpsError("failed-precondition",`Expired chain validation failed: ${Object.entries(priorChecks).filter(([,v])=>v!==true).map(([k])=>k).join(", ")}`);

    const active=await activeDocuments(context);
    const baseline=await loadSnapshotBaseline(context);
    const sheet=validateSheetEnvelope(input.sheetEnvelope,baseline.payload,"Phase 4C-24R Refresh");
    const live=await liveRecheck(context,baseline.payload,sheet);
    const issuedAtIso=new Date().toISOString(); const expiresAtIso=addSecondsIso(Date.parse(issuedAtIso),CHALLENGE_VALIDITY_SECONDS); const leaseExpiresAtIso=addSecondsIso(Date.parse(issuedAtIso),LEASE_SECONDS);
    const id=["phase4c24r-refresh",Date.now().toString(36),randomBytes(10).toString("hex")].join("-");
    const core:GenericRecord={version:UID_V2_REFRESH_CHAIN_PHASE4C71682_VERSION,phase:"Phase 4C-24R Refresh",mode:"rebase156_expired_challenge_token_refresh_chain_live_recheck_only_no_uid_mutation_no_cutover",requestId:REQUEST_ID,contractDigest:CONTRACT_DIGEST,id,state:"refresh_challenge_issued_waiting_new_final_arm_token",issuedAtIso,expiresAtIso,validitySeconds:CHALLENGE_VALIDITY_SECONDS,baselineSnapshotPath:EXPECTED_FRESH_SNAPSHOT_PATH,baselineRollbackDigest:EXPECTED_ROLLBACK_DIGEST,oldChallengeDigest:EXPECTED_CHALLENGE_DIGEST,oldTokenDigest:EXPECTED_OLD_TOKEN_DIGEST,liveRecheck:live,productionExecutionLockOwned:true,productionMaintenanceWindowActive:true,tokenUsed:false,uidMutationWrites:0,actualCutoverWrites:0,containsMutationPayload:false,actualUidCutoverAllowed:false,nextGate:{stage:"token",requiresExactChallengeDigest:true,requiresFreshLiveRecheck:true,uidMutationAllowed:false,actualUidCutoverAllowed:false}};
    const stageDigest=digestValue(core); const stored:GenericRecord={version:UID_V2_REFRESH_CHAIN_PHASE4C71682_VERSION,phase:"Phase 4C-24R Refresh",requestId:REQUEST_ID,contractDigest:CONTRACT_DIGEST,approvedByFirebaseUid:callerUid,digest:stageDigest,core,status:"refresh_final_preflight_challenge_issued_no_uid_mutation",createdAtIso:issuedAtIso};
    await context.db.runTransaction(async transaction=>{
      const [dest,session,recovery,lock,maintenance]=await Promise.all([transaction.get(context.refreshChallengeRef),transaction.get(context.refreshSessionRef),transaction.get(context.recoverySessionRef),transaction.get(context.lockRef),transaction.get(context.maintenanceRef)]);
      if(dest.exists) throw new HttpsError("already-exists","Refresh challenge exists.");
      const r=recovery.data()||active.recovery,l=lock.data()||active.lock,m=maintenance.data()||active.maintenance,s=session.data()||{};
      transaction.set(context.refreshChallengeRef,stored);
      transaction.set(context.refreshSessionRef,{...s,version:UID_V2_REFRESH_CHAIN_PHASE4C71682_VERSION,requestId:REQUEST_ID,contractDigest:CONTRACT_DIGEST,approvedByFirebaseUid:callerUid,state:"refresh_challenge_issued",challengeDigest:stageDigest,challengeExpiresAtIso:expiresAtIso,uidMutationWrites:0,actualUidCutoverAllowed:false,updatedAtIso:issuedAtIso});
      transaction.set(context.recoverySessionRef,{...r,heartbeatAtIso:issuedAtIso,leaseExpiresAtIso,refreshChallengeDigest:stageDigest,uidMutationWrites:0,actualUidCutoverAllowed:false,updatedAtIso:issuedAtIso});
      transaction.set(context.lockRef,{...l,heartbeatAtIso:issuedAtIso,leaseExpiresAtIso,refreshChallengeDigest:stageDigest,uidMutationWrites:0,actualUidCutoverAllowed:false,updatedAtIso:issuedAtIso});
      transaction.set(context.maintenanceRef,{...m,heartbeatAtIso:issuedAtIso,leaseExpiresAtIso,refreshChallengeDigest:stageDigest,uidMutationWrites:0,actualUidCutoverAllowed:false,updatedAtIso:issuedAtIso});
    });
    return publicStage("challenge",stored,false,STAGE_WRITE_OPERATIONS,false);
  }
);

export const refreshUidV2FinalArmTokenPhase4c71682 = onCall(
  {region: REGION, timeoutSeconds: 540, memory: "1GiB", enforceAppCheck: false},
  async (request) => {
    const callerUid=requireSuperAdmin(request.auth as {uid:string;token:GenericRecord}|undefined);
    const input=request.data&&typeof request.data==="object"?request.data as TokenInput:{};
    if(text(input.requestId)!==REQUEST_ID||text(input.contractDigest)!==CONTRACT_DIGEST||text(input.approvalPhrase)!==TOKEN_APPROVAL_PHRASE||text(input.refreshChallengeDigest)===""||input.confirmChallengeValid!==true||input.confirmNoUidMutation!==true) throw new HttpsError("failed-precondition","Refresh token approval gate failed.");
    const context=buildContext(callerUid); const existing=await context.refreshTokenRef.get(); if(existing.exists)return publicStage("token",existing.data()||{},true,0,false);
    const [challengeSnapshot,sessionSnapshot]=await Promise.all([context.refreshChallengeRef.get(),context.refreshSessionRef.get()]);
    if(!challengeSnapshot.exists||!sessionSnapshot.exists)throw new HttpsError("failed-precondition","Refresh challenge/session missing.");
    const challenge=challengeSnapshot.data()||{},challengeCore=asRecord(challenge.core,"refreshChallenge.core"),session=sessionSnapshot.data()||{};
    const checks:GenericRecord={digest:text(challenge.digest)===text(input.refreshChallengeDigest)&&digestValue(challengeCore)===text(input.refreshChallengeDigest),valid:parseIsoMillis(challengeCore.expiresAtIso,"challenge.expiresAtIso")>Date.now(),state:text(challengeCore.state)==="refresh_challenge_issued_waiting_new_final_arm_token",session:text(session.challengeDigest)===text(input.refreshChallengeDigest),noMutation:numberValue(challengeCore.uidMutationWrites)===0&&challengeCore.actualUidCutoverAllowed===false}; if(!allTrue(checks))throw new HttpsError("failed-precondition",`Refresh challenge validation failed: ${Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k).join(", ")}`);
    const active=await activeDocuments(context); const baseline=await loadSnapshotBaseline(context); const sheet=validateSheetEnvelope(input.sheetEnvelope,baseline.payload,"Phase 4C-25R Refresh"); const live=await liveRecheck(context,baseline.payload,sheet);
    const issuedAtIso=new Date().toISOString(),expiresAtIso=addSecondsIso(Date.parse(issuedAtIso),TOKEN_VALIDITY_SECONDS),leaseExpiresAtIso=addSecondsIso(Date.parse(issuedAtIso),LEASE_SECONDS),id=["phase4c25r-refresh",Date.now().toString(36),randomBytes(10).toString("hex")].join("-");
    const core:GenericRecord={version:UID_V2_REFRESH_CHAIN_PHASE4C71682_VERSION,phase:"Phase 4C-25R Refresh",mode:"rebase156_expired_challenge_token_refresh_chain_live_recheck_only_no_uid_mutation_no_cutover",requestId:REQUEST_ID,contractDigest:CONTRACT_DIGEST,id,state:"refresh_final_arm_token_issued_waiting_execution_challenge",issuedAtIso,expiresAtIso,validitySeconds:TOKEN_VALIDITY_SECONDS,challengeDigest:text(input.refreshChallengeDigest),baselineSnapshotPath:EXPECTED_FRESH_SNAPSHOT_PATH,baselineRollbackDigest:EXPECTED_ROLLBACK_DIGEST,liveRecheck:live,productionExecutionLockOwned:true,productionMaintenanceWindowActive:true,tokenUsed:false,tokenUseCount:0,uidMutationWrites:0,actualCutoverWrites:0,containsMutationPayload:false,tokenConsumptionCallableIncluded:false,actualUidCutoverAllowed:false,nextGate:{stage:"executionChallenge",requiresExactTokenDigest:true,requiresFreshLiveRecheck:true,uidMutationAllowed:false,actualUidCutoverAllowed:false}}; const stageDigest=digestValue(core); const stored:GenericRecord={version:UID_V2_REFRESH_CHAIN_PHASE4C71682_VERSION,phase:"Phase 4C-25R Refresh",requestId:REQUEST_ID,contractDigest:CONTRACT_DIGEST,approvedByFirebaseUid:callerUid,digest:stageDigest,core,status:"refresh_one_time_final_arm_token_issued_no_uid_mutation",createdAtIso:issuedAtIso};
    await context.db.runTransaction(async transaction=>{const [dest,sess,recovery,lock,maintenance]=await Promise.all([transaction.get(context.refreshTokenRef),transaction.get(context.refreshSessionRef),transaction.get(context.recoverySessionRef),transaction.get(context.lockRef),transaction.get(context.maintenanceRef)]);if(dest.exists)throw new HttpsError("already-exists","Refresh token exists.");const s=sess.data()||session,r=recovery.data()||active.recovery,l=lock.data()||active.lock,m=maintenance.data()||active.maintenance;transaction.set(context.refreshTokenRef,stored);transaction.set(context.refreshSessionRef,{...s,state:"refresh_token_issued",tokenDigest:stageDigest,tokenExpiresAtIso:expiresAtIso,uidMutationWrites:0,actualUidCutoverAllowed:false,updatedAtIso:issuedAtIso});transaction.set(context.recoverySessionRef,{...r,heartbeatAtIso:issuedAtIso,leaseExpiresAtIso,refreshTokenDigest:stageDigest,uidMutationWrites:0,actualUidCutoverAllowed:false,updatedAtIso:issuedAtIso});transaction.set(context.lockRef,{...l,heartbeatAtIso:issuedAtIso,leaseExpiresAtIso,refreshTokenDigest:stageDigest,uidMutationWrites:0,actualUidCutoverAllowed:false,updatedAtIso:issuedAtIso});transaction.set(context.maintenanceRef,{...m,heartbeatAtIso:issuedAtIso,leaseExpiresAtIso,refreshTokenDigest:stageDigest,uidMutationWrites:0,actualUidCutoverAllowed:false,updatedAtIso:issuedAtIso});}); return publicStage("token",stored,false,STAGE_WRITE_OPERATIONS,false);
  }
);

export const refreshUidV2CutoverExecutionChallengePhase4c71682 = onCall(
  {region: REGION, timeoutSeconds: 540, memory: "1GiB", enforceAppCheck: false},
  async (request) => {
    const callerUid=requireSuperAdmin(request.auth as {uid:string;token:GenericRecord}|undefined); const input=request.data&&typeof request.data==="object"?request.data as ExecutionInput:{};
    if(text(input.requestId)!==REQUEST_ID||text(input.contractDigest)!==CONTRACT_DIGEST||text(input.approvalPhrase)!==EXECUTION_APPROVAL_PHRASE||text(input.refreshTokenDigest)===""||input.confirmTokenValidUnused!==true||input.confirmNoUidMutation!==true||input.confirmNoCutover!==true)throw new HttpsError("failed-precondition","Refresh execution challenge approval gate failed.");
    const context=buildContext(callerUid);const existing=await context.refreshExecutionChallengeRef.get();if(existing.exists)return publicStage("executionChallenge",existing.data()||{},true,0,false);
    const [tokenSnapshot,sessionSnapshot]=await Promise.all([context.refreshTokenRef.get(),context.refreshSessionRef.get()]);if(!tokenSnapshot.exists||!sessionSnapshot.exists)throw new HttpsError("failed-precondition","Refresh token/session missing.");const token=tokenSnapshot.data()||{},tokenCore=asRecord(token.core,"refreshToken.core"),session=sessionSnapshot.data()||{};
    const checks:GenericRecord={digest:text(token.digest)===text(input.refreshTokenDigest)&&digestValue(tokenCore)===text(input.refreshTokenDigest),valid:parseIsoMillis(tokenCore.expiresAtIso,"token.expiresAtIso")>Date.now(),unused:tokenCore.tokenUsed===false&&numberValue(tokenCore.tokenUseCount)===0,state:text(tokenCore.state)==="refresh_final_arm_token_issued_waiting_execution_challenge",session:text(session.tokenDigest)===text(input.refreshTokenDigest),noMutation:numberValue(tokenCore.uidMutationWrites)===0&&numberValue(tokenCore.actualCutoverWrites)===0&&tokenCore.actualUidCutoverAllowed===false};if(!allTrue(checks))throw new HttpsError("failed-precondition",`Refresh token validation failed: ${Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k).join(", ")}`);
    const active=await activeDocuments(context);const baseline=await loadSnapshotBaseline(context);const sheet=validateSheetEnvelope(input.sheetEnvelope,baseline.payload,"Phase 4C-26R Refresh");const live=await liveRecheck(context,baseline.payload,sheet);
    const issuedAtIso=new Date().toISOString(),expiresAtIso=addSecondsIso(Date.parse(issuedAtIso),EXECUTION_CHALLENGE_VALIDITY_SECONDS),leaseExpiresAtIso=addSecondsIso(Date.parse(issuedAtIso),LEASE_SECONDS),id=["phase4c26r-refresh",Date.now().toString(36),randomBytes(10).toString("hex")].join("-");
    const core:GenericRecord={version:UID_V2_REFRESH_CHAIN_PHASE4C71682_VERSION,phase:"Phase 4C-26R Refresh",mode:"rebase156_expired_challenge_token_refresh_chain_live_recheck_only_no_uid_mutation_no_cutover",requestId:REQUEST_ID,contractDigest:CONTRACT_DIGEST,id,state:"refresh_execution_challenge_issued_waiting_sealed_package",issuedAtIso,expiresAtIso,validitySeconds:EXECUTION_CHALLENGE_VALIDITY_SECONDS,tokenDigest:text(input.refreshTokenDigest),challengeDigest:tokenCore.challengeDigest,baselineSnapshotPath:EXPECTED_FRESH_SNAPSHOT_PATH,baselineRollbackDigest:EXPECTED_ROLLBACK_DIGEST,liveRecheck:live,productionExecutionLockOwned:true,productionMaintenanceWindowActive:true,tokenUsed:false,uidMutationWrites:0,actualCutoverWrites:0,containsMutationPayload:false,tokenConsumptionCallableIncluded:false,cutoverExecutionCallableIncluded:false,actualUidCutoverAllowed:false,nextGate:{phase:NEXT_GATE_PHASE,requiresExactExecutionChallengeDigest:true,requiresNewExplicitApproval:true,mustRerunLiveStateChecks:true,uidMutationAllowed:false,actualUidCutoverAllowed:false}};const stageDigest=digestValue(core);const stored:GenericRecord={version:UID_V2_REFRESH_CHAIN_PHASE4C71682_VERSION,phase:"Phase 4C-26R Refresh",requestId:REQUEST_ID,contractDigest:CONTRACT_DIGEST,approvedByFirebaseUid:callerUid,digest:stageDigest,core,status:"refresh_cutover_execution_challenge_issued_no_uid_mutation",createdAtIso:issuedAtIso};
    await context.db.runTransaction(async transaction=>{const [dest,sess,recovery,lock,maintenance]=await Promise.all([transaction.get(context.refreshExecutionChallengeRef),transaction.get(context.refreshSessionRef),transaction.get(context.recoverySessionRef),transaction.get(context.lockRef),transaction.get(context.maintenanceRef)]);if(dest.exists)throw new HttpsError("already-exists","Refresh execution challenge exists.");const s=sess.data()||session,r=recovery.data()||active.recovery,l=lock.data()||active.lock,m=maintenance.data()||active.maintenance;transaction.set(context.refreshExecutionChallengeRef,stored);transaction.set(context.refreshSessionRef,{...s,state:"refresh_execution_challenge_issued",executionChallengeDigest:stageDigest,executionChallengeExpiresAtIso:expiresAtIso,uidMutationWrites:0,actualUidCutoverAllowed:false,updatedAtIso:issuedAtIso});transaction.set(context.recoverySessionRef,{...r,heartbeatAtIso:issuedAtIso,leaseExpiresAtIso,refreshExecutionChallengeDigest:stageDigest,uidMutationWrites:0,actualUidCutoverAllowed:false,updatedAtIso:issuedAtIso});transaction.set(context.lockRef,{...l,heartbeatAtIso:issuedAtIso,leaseExpiresAtIso,refreshExecutionChallengeDigest:stageDigest,uidMutationWrites:0,actualUidCutoverAllowed:false,updatedAtIso:issuedAtIso});transaction.set(context.maintenanceRef,{...m,heartbeatAtIso:issuedAtIso,leaseExpiresAtIso,refreshExecutionChallengeDigest:stageDigest,uidMutationWrites:0,actualUidCutoverAllowed:false,updatedAtIso:issuedAtIso});});return publicStage("executionChallenge",stored,false,STAGE_WRITE_OPERATIONS,false);
  }
);

export const inspectUidV2RefreshChainPhase4c71682 = onCall(
  {region: REGION, timeoutSeconds: 300, memory: "1GiB", enforceAppCheck: false},
  async (request) => {
    const callerUid=requireSuperAdmin(request.auth as {uid:string;token:GenericRecord}|undefined);const input=request.data&&typeof request.data==="object"?request.data as InspectInput:{};const stage=text(input.stage),expectedDigest=text(input.digest);if(text(input.requestId)!==REQUEST_ID||text(input.contractDigest)!==CONTRACT_DIGEST||!["challenge","token","executionChallenge"].includes(stage)||expectedDigest==="")throw new HttpsError("failed-precondition","Refresh inspect gate failed.");const context=buildContext(callerUid);const ref=stage==="challenge"?context.refreshChallengeRef:stage==="token"?context.refreshTokenRef:context.refreshExecutionChallengeRef;const [snapshot,sessionSnapshot,recoverySnapshot,lockSnapshot,maintenanceSnapshot]=await Promise.all([ref.get(),context.refreshSessionRef.get(),context.recoverySessionRef.get(),context.lockRef.get(),context.maintenanceRef.get()]);if(!snapshot.exists||!sessionSnapshot.exists||!recoverySnapshot.exists||!lockSnapshot.exists||!maintenanceSnapshot.exists)throw new HttpsError("not-found","Refresh stage documents missing.");const stored=snapshot.data()||{},core=asRecord(stored.core,"stage.core"),session=sessionSnapshot.data()||{},recovery=recoverySnapshot.data()||{},lock=lockSnapshot.data()||{},maintenance=maintenanceSnapshot.data()||{};const field=stage==="challenge"?"challengeDigest":stage==="token"?"tokenDigest":"executionChallengeDigest";const operationalField=stage==="challenge"?"refreshChallengeDigest":stage==="token"?"refreshTokenDigest":"refreshExecutionChallengeDigest";const checks:GenericRecord={caller:text(stored.approvedByFirebaseUid)===callerUid,contract:text(stored.contractDigest)===CONTRACT_DIGEST,digest:text(stored.digest)===expectedDigest&&digestValue(core)===expectedDigest,valid:parseIsoMillis(core.expiresAtIso,"stage.expiresAtIso")>Date.now(),session:text(session[field])===expectedDigest,recovery:text(recovery[operationalField])===expectedDigest,lock:text(lock.state)==="owned"&&text(lock[operationalField])===expectedDigest&&parseIsoMillis(lock.leaseExpiresAtIso,"lock.leaseExpiresAtIso")>Date.now(),maintenance:text(maintenance.state)==="active"&&text(maintenance[operationalField])===expectedDigest,live:liveChecksPassed(core.liveRecheck),noMutation:numberValue(core.uidMutationWrites)===0&&numberValue(core.actualCutoverWrites)===0&&core.actualUidCutoverAllowed===false};if(!allTrue(checks))throw new HttpsError("data-loss",`Refresh ${stage} verification failed: ${Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k).join(", ")}`);return publicStage(stage,stored,true,0,true);
  }
);


export const UID_V2_SEALED_CUTOVER_PACKAGE_PHASE4C27R_VERSION =
  "2026-07-28.716.83-phase4c27r-execution-challenge-verification-sealed-cutover-package-only";

const PHASE4C27_CONTRACT_DIGEST =
  "322cfd74fc4bfc77fd992372fae7f9fd90ad67ed60e2d8d81e84527e437bf48a";

const PHASE4C27_APPROVAL_PHRASE =
  "Phase 4C-27R 실행 Challenge 검증 및 봉인된 Cutover 실행 패키지 조립을 승인합니다. UID 변경과 실제 Cutover는 실행하지 않습니다.";

const EXPECTED_REFRESH_EXECUTION_CHALLENGE_DIGEST =
  "b0f700e738c05dd44aa36e6f83ff0e1960f9ed85f58f2f38f8eb0831816c0bc6";

const EXPECTED_REFRESH_EXECUTION_CHALLENGE_ID =
  "phase4c26r-refresh-ms4qjhv6-8321f8df4e23f26d36ae";

const EXPECTED_REFRESH_EXECUTION_CHALLENGE_EXPIRES_AT_ISO =
  "2026-07-28T14:42:39.858Z";

const EXPECTED_REFRESH_TOKEN_DIGEST =
  "15868175fdfdcf8d42722e190f885703487e87e7a5e3ee2747a7328a3cff6c04";

const EXPECTED_REFRESH_CHALLENGE_DIGEST =
  "136a5323a64aa8895afb443cc7ab46157c3978cfd9fef1c93350f4e302513ea2";

const EXPECTED_PHASE4C22_CONTRACT_DIGEST =
  "c81b6c846a8daf61e9222a01cf43e257fc7c0656abb4e4b5ecdf79bd400d5c37";

const EXPECTED_PHASE4C22_ASSEMBLY_CORE_DIGEST =
  "cc43a674096cbe0a6f9d8e7da6802f1a4302f74f2d5732f7660795eaf64e3bdc";

const EXPECTED_PHASE4C22_ASSEMBLY_PACKAGE_DIGEST =
  "b04f10a39564a95f5a8f348888c2329d27e0b8e587825d208ed841eb53b2b619";

const PHASE4C27_PACKAGE_DOCUMENT =
  "phase4c27r-71683";

const PHASE4C27_PACKAGE_VALIDITY_SECONDS =
  1800;

const PHASE4C27_ASSEMBLE_WRITE_OPERATIONS =
  5;

const PHASE4C27_NEXT_GATE =
  "Phase 4C-28R explicit production cutover approval and final quiescence gate only";

interface Phase4c27AssembleInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly approvalPhrase?: unknown;
  readonly executionChallengeDigest?: unknown;
  readonly sheetEnvelope?: unknown;
  readonly confirmMaintenanceGuardDeployed?: unknown;
  readonly confirmExecutionChallengeValid?: unknown;
  readonly confirmTokenRemainsUnused?: unknown;
  readonly confirmNoUidMutation?: unknown;
  readonly confirmPackageNotExecutable?: unknown;
}

interface Phase4c27InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly sealedPackageDigest?: unknown;
}

function phase4c27PackageRef(
  context: Context
): DocumentReference<DocumentData> {
  return context.runRef
    .collection(
      "rebaseSealedCutoverExecutionPackages"
    )
    .doc(
      PHASE4C27_PACKAGE_DOCUMENT
    );
}

function validatePhase4c27SheetEnvelope(
  value: unknown,
  baselinePayload: GenericRecord
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
      "Phase 4C-27R Sheet wrapper digest mismatch."
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

  if (
    text(
      sourceEnvelope.snapshotDigest
    ) !==
    digestValue(
      sourceSnapshot
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Phase 4C-27R nested Sheet digest mismatch."
    );
  }

  const cells =
    asArray(
      sourceSnapshot.rollbackCells,
      "rollbackCells"
    ).map(
      (item, index) =>
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
      (item, index) =>
        asRecord(
          item,
          `principalAnchor${index}`
        )
    );

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
      (item, index) =>
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
      (item, index) =>
        asRecord(
          item,
          `baselineAnchor${index}`
        )
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

  const ageSeconds =
    (
      Date.now() -
      capturedAtMillis
    ) /
    1000;

  const safety =
    asRecord(
      wrapper.safety,
      "wrapper.safety"
    );

  const checks:
    GenericRecord = {
  wrapperVersion:
    text(
      wrapper.version
    ) ===
    UID_V2_SEALED_CUTOVER_PACKAGE_PHASE4C27R_VERSION,
  wrapperPhase:
    text(
      wrapper.phase
    ) ===
    "Phase 4C-27R",
  wrapperRequest:
    text(
      wrapper.requestId
    ) ===
    REQUEST_ID,
  wrapperContract:
    text(
      wrapper.contractDigest
    ) ===
    PHASE4C27_CONTRACT_DIGEST,
  captureFresh:
    ageSeconds >=
      0 &&
    ageSeconds <=
      600,
  captureNotFuture:
    capturedAtMillis <=
    Date.now() +
    30000,
  cells:
    cells.length ===
      170 &&
    exactJson(
      sortRecords(cells),
      sortRecords(baselineCells)
    ),
  anchors:
    anchors.length ===
      12 &&
    exactJson(
      sortRecords(anchors),
      sortRecords(baselineAnchors)
    ),
  blank:
    cells.every(
      (cell) =>
        cell.targetCellBlank ===
          true &&
        blankCellState(
          cell.beforeState
        )
    ),
  noMutation:
    numberValue(
      safety.uidMutationWrites
    ) ===
      0 &&
    numberValue(
      safety.actualCutoverWrites
    ) ===
      0 &&
    safety.actualUidCutoverAllowed ===
      false
  };

  if (!allTrue(
    checks
  )) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-27R Fresh Sheet validation failed: ${
        Object.entries(
          checks
        )
          .filter(
            ([, passed]) =>
              passed !==
              true
          )
          .map(
            ([key]) =>
              key
          )
          .join(", ")
      }`
    );
  }

  return {
    wrapperDigest,
    cells,
    anchors,
    capturedAtIso
  };
}

function publicPhase4c27Package(
  storedPackage: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean
): GenericRecord {
  const packageCore =
    asRecord(
      storedPackage.packageCore,
      "sealedPackage.packageCore"
    );

  const expiresAtMillis =
    parseIsoMillis(
      packageCore.packageExpiresAtIso,
      "sealedPackage.packageExpiresAtIso"
    );

  const secondsRemaining =
    Math.max(
      0,
      (
        expiresAtMillis -
        Date.now()
      ) /
      1000
    );

  return {
    ok:
      true,
    version:
      UID_V2_SEALED_CUTOVER_PACKAGE_PHASE4C27R_VERSION,
    phase:
      "Phase 4C-27R",
    mode:
      "rebase156_execution_challenge_verification_and_sealed_cutover_execution_package_only_no_uid_mutation_no_cutover",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    status:
      text(
        storedPackage.status
      ),
    contractDigest:
      PHASE4C27_CONTRACT_DIGEST,
    sealedPackageDigest:
      text(
        storedPackage.sealedPackageDigest
      ),
    sealedPackageCoreDigest:
      digestValue(
        packageCore
      ),
    sealedPackageId:
      packageCore.sealedPackageId,
    sealedPackageState:
      packageCore.sealedPackageState,
    packageIssuedAtIso:
      packageCore.packageIssuedAtIso,
    packageExpiresAtIso:
      packageCore.packageExpiresAtIso,
    packageSecondsRemaining:
      secondsRemaining,
    packageWithinValidity:
      secondsRemaining >
      0,
    executionChallengeDigest:
      packageCore.executionChallengeDigest,
    tokenDigest:
      packageCore.tokenDigest,
    refreshChallengeDigest:
      packageCore.refreshChallengeDigest,
    phase4c22AssemblyPackageDigest:
      packageCore.phase4c22AssemblyPackageDigest,
    executionPlan:
      packageCore.executionPlan,
    liveRecheck:
      packageCore.liveRecheck,
    productionExecutionLockOwned:
      packageCore.productionExecutionLockOwned,
    productionMaintenanceWindowActive:
      packageCore.productionMaintenanceWindowActive,
    refreshTokenUsed:
      packageCore.refreshTokenUsed,
    sealedPackageExecutable:
      packageCore.sealedPackageExecutable,
    uidMutationWrites:
      packageCore.uidMutationWrites,
    actualCutoverWrites:
      packageCore.actualCutoverWrites,
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
      actualCutoverWrites:
        0,
      tokenConsumptionCallableIncluded:
        false,
      cutoverExecutionCallableIncluded:
        false,
      rollbackMutationCallableIncluded:
        false,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        PHASE4C27_NEXT_GATE,
      allowed:
        verified &&
        secondsRemaining >
          0 &&
        packageCore.refreshTokenUsed ===
          false &&
        packageCore.sealedPackageExecutable ===
          false,
      requiresExactSealedPackageDigest:
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

export const assembleUidV2SealedCutoverPackagePhase4c27r =
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
              Phase4c27AssembleInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C27_CONTRACT_DIGEST ||
        text(
          input.approvalPhrase
        ) !==
          PHASE4C27_APPROVAL_PHRASE ||
        text(
          input.executionChallengeDigest
        ) !==
          EXPECTED_REFRESH_EXECUTION_CHALLENGE_DIGEST ||
        input.confirmMaintenanceGuardDeployed !==
          true ||
        input.confirmExecutionChallengeValid !==
          true ||
        input.confirmTokenRemainsUnused !==
          true ||
        input.confirmNoUidMutation !==
          true ||
        input.confirmPackageNotExecutable !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-27R assembly gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const packageRef =
        phase4c27PackageRef(
          context
        );

      const existing =
        await packageRef.get();

      if (existing.exists) {
        const stored =
          existing.data() ||
          {};

        if (
          text(
            stored.approvedByFirebaseUid
          ) !==
            callerUid ||
          text(
            stored.contractDigest
          ) !==
            PHASE4C27_CONTRACT_DIGEST
        ) {
          throw new HttpsError(
            "already-exists",
            "An incompatible Phase 4C-27R package exists."
          );
        }

        return publicPhase4c27Package(
          stored,
          true,
          0,
          false
        );
      }

      const [
        executionSnapshot,
        tokenSnapshot,
        bundleSnapshot
      ] = await Promise.all([
        context.refreshExecutionChallengeRef.get(),
        context.refreshTokenRef.get(),
        context.runRef
          .collection(
            "rebaseProductionExecutionBundleAssemblies"
          )
          .doc(
            "phase4c22r"
          )
          .get()
      ]);

      if (
        !executionSnapshot.exists ||
        !tokenSnapshot.exists ||
        !bundleSnapshot.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-27R prerequisite documents are incomplete."
        );
      }

      const executionStored =
        executionSnapshot.data() ||
        {};

      const executionCore =
        asRecord(
          executionStored.core,
          "executionChallenge.core"
        );

      const tokenStored =
        tokenSnapshot.data() ||
        {};

      const tokenCore =
        asRecord(
          tokenStored.core,
          "refreshToken.core"
        );

      const bundleStored =
        bundleSnapshot.data() ||
        {};

      const executionChecks:
        GenericRecord = {
      digest:
        text(
          executionStored.digest
        ) ===
          EXPECTED_REFRESH_EXECUTION_CHALLENGE_DIGEST &&
        digestValue(
          executionCore
        ) ===
          EXPECTED_REFRESH_EXECUTION_CHALLENGE_DIGEST,
      identity:
        text(
          executionCore.id
        ) ===
          EXPECTED_REFRESH_EXECUTION_CHALLENGE_ID &&
        text(
          executionCore.expiresAtIso
        ) ===
          EXPECTED_REFRESH_EXECUTION_CHALLENGE_EXPIRES_AT_ISO,
      state:
        text(
          executionCore.state
        ) ===
        "refresh_execution_challenge_issued_waiting_sealed_package",
      valid:
        parseIsoMillis(
          executionCore.expiresAtIso,
          "executionChallenge.expiresAtIso"
        ) >
        Date.now(),
      links:
        text(
          executionCore.tokenDigest
        ) ===
          EXPECTED_REFRESH_TOKEN_DIGEST &&
        text(
          executionCore.challengeDigest
        ) ===
          EXPECTED_REFRESH_CHALLENGE_DIGEST,
      tokenDigest:
        text(
          tokenStored.digest
        ) ===
          EXPECTED_REFRESH_TOKEN_DIGEST &&
        digestValue(
          tokenCore
        ) ===
          EXPECTED_REFRESH_TOKEN_DIGEST,
      tokenUnused:
        tokenCore.tokenUsed ===
          false &&
        numberValue(
          tokenCore.tokenUseCount
        ) ===
          0,
      live:
        liveChecksPassed(
          executionCore.liveRecheck
        ),
      noMutation:
        numberValue(
          executionCore.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          executionCore.actualCutoverWrites
        ) ===
          0 &&
        executionCore.cutoverExecutionCallableIncluded ===
          false &&
        executionCore.actualUidCutoverAllowed ===
          false,
      phase4c22:
        text(
          bundleStored.contractDigest
        ) ===
          EXPECTED_PHASE4C22_CONTRACT_DIGEST &&
        text(
          bundleStored.assemblyCoreDigest
        ) ===
          EXPECTED_PHASE4C22_ASSEMBLY_CORE_DIGEST &&
        text(
          bundleStored.assemblyPackageDigest
        ) ===
          EXPECTED_PHASE4C22_ASSEMBLY_PACKAGE_DIGEST
      };

      if (!allTrue(
        executionChecks
      )) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-27R execution challenge validation failed: ${
            Object.entries(
              executionChecks
            )
              .filter(
                ([, passed]) =>
                  passed !==
                  true
              )
              .map(
                ([key]) =>
                  key
              )
              .join(", ")
          }`
        );
      }

      const active =
        await activeDocuments(
          context
        );

      const baseline =
        await loadSnapshotBaseline(
          context
        );

      const sheet =
        validatePhase4c27SheetEnvelope(
          input.sheetEnvelope,
          baseline.payload
        );

      const live =
        await liveRecheck(
          context,
          baseline.payload,
          sheet
        );

      const issuedAtIso =
        new Date().toISOString();

      const packageExpiresAtIso =
        addSecondsIso(
          Date.parse(
            issuedAtIso
          ),
          PHASE4C27_PACKAGE_VALIDITY_SECONDS
        );

      const leaseExpiresAtIso =
        addSecondsIso(
          Date.parse(
            issuedAtIso
          ),
          7200
        );

      const sealedPackageId =
        [
          "phase4c27r",
          Date.now().toString(36),
          randomBytes(12).toString("hex")
        ].join("-");

      const packageCore:
        GenericRecord = {
      version:
        UID_V2_SEALED_CUTOVER_PACKAGE_PHASE4C27R_VERSION,
      phase:
        "Phase 4C-27R",
      mode:
        "rebase156_execution_challenge_verification_and_sealed_cutover_execution_package_only_no_uid_mutation_no_cutover",
      requestId:
        REQUEST_ID,
      contractDigest:
        PHASE4C27_CONTRACT_DIGEST,
      sealedPackageId,
      sealedPackageState:
        "sealed_waiting_explicit_production_cutover_approval",
      packageIssuedAtIso:
        issuedAtIso,
      packageExpiresAtIso,
      packageValiditySeconds:
        PHASE4C27_PACKAGE_VALIDITY_SECONDS,
      approvedByFirebaseUidDigest:
        digestValue(
          callerUid
        ),
      executionChallengeDigest:
        EXPECTED_REFRESH_EXECUTION_CHALLENGE_DIGEST,
      executionChallengeId:
        EXPECTED_REFRESH_EXECUTION_CHALLENGE_ID,
      tokenDigest:
        EXPECTED_REFRESH_TOKEN_DIGEST,
      refreshChallengeDigest:
        EXPECTED_REFRESH_CHALLENGE_DIGEST,
      cutoverRunId:
        "phase4c23r-ms4lvf6s-91c84bbc03f64521",
      freshSnapshotPath:
        "uidV2ProductionRollbackSnapshots/phase4c24r-ms4nvomb-93c665ae5d26eb22-snapshot",
      freshRollbackSnapshotDigest:
        "a9bd1d73135048b73a9c702015570ad97193f4acad4dcbbae658daeca2360fc0",
      phase4c22ContractDigest:
        EXPECTED_PHASE4C22_CONTRACT_DIGEST,
      phase4c22AssemblyCoreDigest:
        EXPECTED_PHASE4C22_ASSEMBLY_CORE_DIGEST,
      phase4c22AssemblyPackageDigest:
        EXPECTED_PHASE4C22_ASSEMBLY_PACKAGE_DIGEST,
      sheetCaptureDigest:
        sheet.wrapperDigest,
      liveRecheck:
        live,
      executionPlan: {
        forwardOrder: [
          "sheet170",
          "firestore350",
          "firebaseAuth1"
        ],
        rollbackOrder: [
          "firebaseAuth1",
          "firestore350",
          "sheet170"
        ],
        expectedCounts:
          {"sheetStudentRows":156,"sheetPrincipalRows":12,"sheetHeaderCells":2,"sheetIdentityCells":168,"sheetTotalTargetCells":170,"principalAuthColumn9Anchors":12,"attendanceDocuments":69,"assignmentDocuments":14,"firebaseAuthUsers":1,"inPlaceAttendancePlans":68},
        correctedProjectedTotals:
          {"sheetMutations":170,"firestoreWrites":350,"firebaseAuthWrites":1,"logicalMutations":521}
      },
      productionExecutionLockOwned:
        true,
      productionMaintenanceWindowActive:
        true,
      refreshTokenUsed:
        false,
      refreshTokenUseCount:
        0,
      sealedPackageContainsRawMutationPayload:
        false,
      sealedPackageExecutable:
        false,
      tokenConsumptionCallableIncluded:
        false,
      cutoverExecutionCallableIncluded:
        false,
      rollbackMutationCallableIncluded:
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
      actualCutoverWrites:
        0,
      uidMutationAllowed:
        false,
      actualUidCutoverAllowed:
        false,
      nextGate: {
        phase:
          PHASE4C27_NEXT_GATE,
        requiresExactSealedPackageDigest:
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

      const sealedPackageDigest =
        digestValue(
          packageCore
        );

      const storedPackage:
        GenericRecord = {
      version:
        UID_V2_SEALED_CUTOVER_PACKAGE_PHASE4C27R_VERSION,
      phase:
        "Phase 4C-27R",
      mode:
        "rebase156_execution_challenge_verification_and_sealed_cutover_execution_package_only_no_uid_mutation_no_cutover",
      requestId:
        REQUEST_ID,
      contractDigest:
        PHASE4C27_CONTRACT_DIGEST,
      approvedByFirebaseUid:
        callerUid,
      sealedPackageDigest,
      packageCore,
      status:
        "sealed_cutover_execution_package_assembled_no_uid_mutation",
      createdAtIso:
        issuedAtIso
      };

      await context.db.runTransaction(
        async (transaction) => {
          const [
            currentPackage,
            currentExecution,
            currentRecovery,
            currentLock,
            currentMaintenance
          ] = await Promise.all([
            transaction.get(
              packageRef
            ),
            transaction.get(
              context.refreshExecutionChallengeRef
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

          if (currentPackage.exists) {
            throw new HttpsError(
              "already-exists",
              "Phase 4C-27R create-only destination exists."
            );
          }

          if (
            !currentExecution.exists ||
            !currentRecovery.exists ||
            !currentLock.exists ||
            !currentMaintenance.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-27R active documents disappeared before commit."
            );
          }

          const currentExecutionStored =
            currentExecution.data() ||
            {};

          const currentExecutionCore =
            asRecord(
              currentExecutionStored.core,
              "current.executionCore"
            );

          const recovery =
            currentRecovery.data() ||
            active.recovery;

          const lock =
            currentLock.data() ||
            active.lock;

          const maintenance =
            currentMaintenance.data() ||
            active.maintenance;

          const commitChecks:
            GenericRecord = {
          execution:
            text(
              currentExecutionStored.digest
            ) ===
              EXPECTED_REFRESH_EXECUTION_CHALLENGE_DIGEST &&
            digestValue(
              currentExecutionCore
            ) ===
              EXPECTED_REFRESH_EXECUTION_CHALLENGE_DIGEST,
          executionValid:
            parseIsoMillis(
              currentExecutionCore.expiresAtIso,
              "executionChallenge.expiresAtIso"
            ) >
            Date.now(),
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
          leaseValid:
            parseIsoMillis(
              lock.leaseExpiresAtIso,
              "lock.leaseExpiresAtIso"
            ) >
            Date.now(),
          noMutation:
            numberValue(
              recovery.uidMutationWrites
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
            commitChecks
          )) {
            throw new HttpsError(
              "failed-precondition",
              `Phase 4C-27R commit gate failed: ${
                Object.entries(
                  commitChecks
                )
                  .filter(
                    ([, passed]) =>
                      passed !==
                      true
                  )
                  .map(
                    ([key]) =>
                      key
                  )
                  .join(", ")
              }`
            );
          }

          transaction.set(
            packageRef,
            storedPackage
          );

          transaction.set(
            context.refreshExecutionChallengeRef,
            {
              ...currentExecutionStored,
              state:
                "sealed_package_assembled_waiting_explicit_cutover_approval",
              sealedPackageDigest,
              sealedPackageId,
              sealedPackageExpiresAtIso:
                packageExpiresAtIso,
              tokenUsed:
                false,
              uidMutationWrites:
                0,
              actualCutoverWrites:
                0,
              updatedAtIso:
                issuedAtIso
            }
          );

          transaction.set(
            context.recoverySessionRef,
            {
              ...recovery,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              sealedPackageDigest,
              uidMutationWrites:
                0,
              actualUidCutoverAllowed:
                false,
              updatedAtIso:
                issuedAtIso
            }
          );

          transaction.set(
            context.lockRef,
            {
              ...lock,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              sealedPackageDigest,
              uidMutationWrites:
                0,
              actualUidCutoverAllowed:
                false,
              updatedAtIso:
                issuedAtIso
            }
          );

          transaction.set(
            context.maintenanceRef,
            {
              ...maintenance,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              sealedPackageDigest,
              uidMutationWrites:
                0,
              actualUidCutoverAllowed:
                false,
              updatedAtIso:
                issuedAtIso
            }
          );
        }
      );

      return publicPhase4c27Package(
        storedPackage,
        false,
        PHASE4C27_ASSEMBLE_WRITE_OPERATIONS,
        false
      );
    }
  );

export const inspectUidV2SealedCutoverPackagePhase4c27r =
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
              Phase4c27InspectInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C27_CONTRACT_DIGEST ||
        text(
          input.sealedPackageDigest
        ) ===
          ""
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-27R inspect gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const packageRef =
        phase4c27PackageRef(
          context
        );

      const [
        packageSnapshot,
        executionSnapshot,
        tokenSnapshot,
        recoverySnapshot,
        lockSnapshot,
        maintenanceSnapshot
      ] = await Promise.all([
        packageRef.get(),
        context.refreshExecutionChallengeRef.get(),
        context.refreshTokenRef.get(),
        context.recoverySessionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get()
      ]);

      if (
        !packageSnapshot.exists ||
        !executionSnapshot.exists ||
        !tokenSnapshot.exists ||
        !recoverySnapshot.exists ||
        !lockSnapshot.exists ||
        !maintenanceSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-27R linked documents are incomplete."
        );
      }

      const storedPackage =
        packageSnapshot.data() ||
        {};

      const packageCore =
        asRecord(
          storedPackage.packageCore,
          "sealedPackage.packageCore"
        );

      const executionStored =
        executionSnapshot.data() ||
        {};

      const tokenStored =
        tokenSnapshot.data() ||
        {};

      const tokenCore =
        asRecord(
          tokenStored.core,
          "refreshToken.core"
        );

      const recovery =
        recoverySnapshot.data() ||
        {};

      const lock =
        lockSnapshot.data() ||
        {};

      const maintenance =
        maintenanceSnapshot.data() ||
        {};

      const sealedPackageDigest =
        text(
          input.sealedPackageDigest
        );

      const checks:
        GenericRecord = {
      status:
        text(
          storedPackage.status
        ) ===
        "sealed_cutover_execution_package_assembled_no_uid_mutation",
      caller:
        text(
          storedPackage.approvedByFirebaseUid
        ) ===
        callerUid,
      contract:
        text(
          storedPackage.contractDigest
        ) ===
        PHASE4C27_CONTRACT_DIGEST,
      digest:
        text(
          storedPackage.sealedPackageDigest
        ) ===
          sealedPackageDigest &&
        digestValue(
          packageCore
        ) ===
          sealedPackageDigest,
      packageValid:
        parseIsoMillis(
          packageCore.packageExpiresAtIso,
          "sealedPackage.packageExpiresAtIso"
        ) >
        Date.now(),
      executionLink:
        text(
          packageCore.executionChallengeDigest
        ) ===
          EXPECTED_REFRESH_EXECUTION_CHALLENGE_DIGEST &&
        text(
          executionStored.sealedPackageDigest
        ) ===
          sealedPackageDigest,
      tokenLink:
        text(
          packageCore.tokenDigest
        ) ===
          EXPECTED_REFRESH_TOKEN_DIGEST &&
        tokenCore.tokenUsed ===
          false &&
        numberValue(
          tokenCore.tokenUseCount
        ) ===
          0,
      bundleLink:
        text(
          packageCore.phase4c22AssemblyCoreDigest
        ) ===
          EXPECTED_PHASE4C22_ASSEMBLY_CORE_DIGEST &&
        text(
          packageCore.phase4c22AssemblyPackageDigest
        ) ===
          EXPECTED_PHASE4C22_ASSEMBLY_PACKAGE_DIGEST,
      recovery:
        text(
          recovery.sealedPackageDigest
        ) ===
        sealedPackageDigest,
      lock:
        text(
          lock.state
        ) ===
          "owned" &&
        text(
          lock.sealedPackageDigest
        ) ===
          sealedPackageDigest &&
        parseIsoMillis(
          lock.leaseExpiresAtIso,
          "lock.leaseExpiresAtIso"
        ) >
          Date.now(),
      maintenance:
        text(
          maintenance.state
        ) ===
          "active" &&
        text(
          maintenance.sealedPackageDigest
        ) ===
          sealedPackageDigest,
      live:
        liveChecksPassed(
          packageCore.liveRecheck
        ),
      packageNotExecutable:
        packageCore.sealedPackageExecutable ===
          false &&
        packageCore.sealedPackageContainsRawMutationPayload ===
          false &&
        packageCore.tokenConsumptionCallableIncluded ===
          false &&
        packageCore.cutoverExecutionCallableIncluded ===
          false &&
        packageCore.rollbackMutationCallableIncluded ===
          false,
      noMutation:
        numberValue(
          packageCore.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          packageCore.actualCutoverWrites
        ) ===
          0 &&
        packageCore.uidMutationAllowed ===
          false &&
        packageCore.actualUidCutoverAllowed ===
          false
      };

      if (!allTrue(
        checks
      )) {
        throw new HttpsError(
          "data-loss",
          `Phase 4C-27R package verification failed: ${
            Object.entries(
              checks
            )
              .filter(
                ([, passed]) =>
                  passed !==
                  true
              )
              .map(
                ([key]) =>
                  key
              )
              .join(", ")
          }`
        );
      }

      return publicPhase4c27Package(
        storedPackage,
        true,
        0,
        true
      );
    }
  );


export const UID_V2_FINAL_QUIESCENCE_GATE_PHASE4C28R_VERSION =
  "2026-07-28.716.84-phase4c28r-explicit-production-cutover-approval-final-quiescence-gate-only";

const PHASE4C28_CONTRACT_DIGEST =
  "aeff51fae3b11d48ad4889ac3e778aa398eb4cb44d1709d03642e1d7d55ee051";

const PHASE4C28_APPROVAL_PHRASE =
  "Phase 4C-28R 운영 Cutover 승인 기록 및 최종 Quiescence Gate 실행을 승인합니다. 이번 단계에서는 UID 변경과 실제 Cutover를 실행하지 않습니다.";

const EXPECTED_PHASE4C27_CONTRACT_DIGEST =
  "322cfd74fc4bfc77fd992372fae7f9fd90ad67ed60e2d8d81e84527e437bf48a";

const EXPECTED_SEALED_PACKAGE_DIGEST =
  "c5096c4f28b14fdfadb29fcb06226cd446493f128bee50782b159188ae8a81c5";

const EXPECTED_SEALED_PACKAGE_ID =
  "phase4c27r-ms4r43by-141f5e5c0387aca491a22794";

const EXPECTED_SEALED_PACKAGE_EXPIRES_AT_ISO =
  "2026-07-28T14:58:40.798Z";

const EXPECTED_EXECUTION_CHALLENGE_DIGEST =
  "b0f700e738c05dd44aa36e6f83ff0e1960f9ed85f58f2f38f8eb0831816c0bc6";

const EXPECTED_REFRESH_TOKEN_DIGEST_PHASE4C28R =
  "15868175fdfdcf8d42722e190f885703487e87e7a5e3ee2747a7328a3cff6c04";

const EXPECTED_REFRESH_CHALLENGE_DIGEST_PHASE4C28R =
  "136a5323a64aa8895afb443cc7ab46157c3978cfd9fef1c93350f4e302513ea2";

const EXPECTED_PHASE4C22_ASSEMBLY_PACKAGE_DIGEST_PHASE4C28R =
  "b04f10a39564a95f5a8f348888c2329d27e0b8e587825d208ed841eb53b2b619";

const PHASE4C28_QUIESCENCE_DOCUMENT =
  "phase4c28r-71684";

const PHASE4C28_VALIDITY_SECONDS =
  1800;

const PHASE4C28_SETTLE_MILLISECONDS =
  5000;

const PHASE4C28_WRITE_OPERATIONS =
  5;

const PHASE4C28_NEXT_GATE =
  "Phase 4C-29R final execution authorization and one-time atomic cutover callable";

interface Phase4c28ApproveInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly approvalPhrase?: unknown;
  readonly sealedPackageDigest?: unknown;
  readonly sheetEnvelope?: unknown;
  readonly confirmMaintenanceGuardDeployed?: unknown;
  readonly confirmSealedPackageValid?: unknown;
  readonly confirmTokenRemainsUnused?: unknown;
  readonly confirmNoUidMutation?: unknown;
  readonly confirmNoExecutionAuthorization?: unknown;
}

interface Phase4c28InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly quiescenceApprovalDigest?: unknown;
}

function phase4c28ApprovalRef(
  context: Context
): DocumentReference<DocumentData> {
  return context.runRef
    .collection(
      "rebaseFinalQuiescenceApprovals"
    )
    .doc(
      PHASE4C28_QUIESCENCE_DOCUMENT
    );
}

function phase4c28Pause(
  milliseconds: number
): Promise<void> {
  return new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

function validatePhase4c28SheetEnvelope(
  value: unknown,
  baselinePayload: GenericRecord
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
      "Phase 4C-28R Sheet wrapper digest mismatch."
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

  if (
    text(
      sourceEnvelope.snapshotDigest
    ) !==
    digestValue(
      sourceSnapshot
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Phase 4C-28R nested Sheet digest mismatch."
    );
  }

  const cells =
    asArray(
      sourceSnapshot.rollbackCells,
      "rollbackCells"
    ).map(
      (item, index) =>
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
      (item, index) =>
        asRecord(
          item,
          `principalAnchor${index}`
        )
    );

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
      (item, index) =>
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
      (item, index) =>
        asRecord(
          item,
          `baselineAnchor${index}`
        )
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

  const ageSeconds =
    (
      Date.now() -
      capturedAtMillis
    ) /
    1000;

  const safety =
    asRecord(
      wrapper.safety,
      "wrapper.safety"
    );

  const checks:
    GenericRecord = {
  version:
    text(
      wrapper.version
    ) ===
    UID_V2_FINAL_QUIESCENCE_GATE_PHASE4C28R_VERSION,
  phase:
    text(
      wrapper.phase
    ) ===
    "Phase 4C-28R",
  request:
    text(
      wrapper.requestId
    ) ===
    REQUEST_ID,
  contract:
    text(
      wrapper.contractDigest
    ) ===
    PHASE4C28_CONTRACT_DIGEST,
  captureFresh:
    ageSeconds >=
      0 &&
    ageSeconds <=
      600,
  captureNotFuture:
    capturedAtMillis <=
    Date.now() +
    30000,
  cells:
    cells.length ===
      170 &&
    exactJson(
      sortRecords(cells),
      sortRecords(baselineCells)
    ),
  anchors:
    anchors.length ===
      12 &&
    exactJson(
      sortRecords(anchors),
      sortRecords(baselineAnchors)
    ),
  targetsBlank:
    cells.every(
      (cell) =>
        cell.targetCellBlank ===
          true &&
        blankCellState(
          cell.beforeState
        )
    ),
  noMutation:
    numberValue(
      safety.uidMutationWrites
    ) ===
      0 &&
    numberValue(
      safety.actualCutoverWrites
    ) ===
      0 &&
    safety.actualUidCutoverAllowed ===
      false
  };

  if (!allTrue(
    checks
  )) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-28R Fresh Sheet validation failed: ${
        Object.entries(
          checks
        )
          .filter(
            ([, passed]) =>
              passed !==
              true
          )
          .map(
            ([key]) =>
              key
          )
          .join(", ")
      }`
    );
  }

  return {
    wrapperDigest,
    cells,
    anchors,
    capturedAtIso
  };
}

function publicPhase4c28Approval(
  storedApproval: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean
): GenericRecord {
  const approvalCore =
    asRecord(
      storedApproval.approvalCore,
      "quiescenceApproval.approvalCore"
    );

  const expiresAtMillis =
    parseIsoMillis(
      approvalCore.approvalExpiresAtIso,
      "quiescenceApproval.approvalExpiresAtIso"
    );

  const secondsRemaining =
    Math.max(
      0,
      (
        expiresAtMillis -
        Date.now()
      ) /
      1000
    );

  return {
    ok:
      true,
    version:
      UID_V2_FINAL_QUIESCENCE_GATE_PHASE4C28R_VERSION,
    phase:
      "Phase 4C-28R",
    mode:
      "rebase156_explicit_production_cutover_approval_and_final_quiescence_gate_only_no_uid_mutation_no_cutover",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    status:
      text(
        storedApproval.status
      ),
    contractDigest:
      PHASE4C28_CONTRACT_DIGEST,
    quiescenceApprovalDigest:
      text(
        storedApproval.quiescenceApprovalDigest
      ),
    quiescenceApprovalCoreDigest:
      digestValue(
        approvalCore
      ),
    quiescenceApprovalId:
      approvalCore.quiescenceApprovalId,
    quiescenceState:
      approvalCore.quiescenceState,
    approvalIssuedAtIso:
      approvalCore.approvalIssuedAtIso,
    approvalExpiresAtIso:
      approvalCore.approvalExpiresAtIso,
    approvalSecondsRemaining:
      secondsRemaining,
    approvalWithinValidity:
      secondsRemaining >
      0,
    sealedPackageDigest:
      approvalCore.sealedPackageDigest,
    packageWasValidAtApproval:
      approvalCore.packageWasValidAtApproval,
    explicitProductionCutoverApprovalRecorded:
      approvalCore.explicitProductionCutoverApprovalRecorded,
    finalQuiescenceGatePassed:
      approvalCore.finalQuiescenceGatePassed,
    twoPassLiveRecheck:
      approvalCore.twoPassLiveRecheck,
    productionExecutionLockOwned:
      approvalCore.productionExecutionLockOwned,
    productionMaintenanceWindowActive:
      approvalCore.productionMaintenanceWindowActive,
    refreshTokenUsed:
      approvalCore.refreshTokenUsed,
    sealedPackageExecutable:
      approvalCore.sealedPackageExecutable,
    executionAuthorizationIssued:
      approvalCore.executionAuthorizationIssued,
    uidMutationWrites:
      approvalCore.uidMutationWrites,
    actualCutoverWrites:
      approvalCore.actualCutoverWrites,
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
      actualCutoverWrites:
        0,
      tokenConsumptionCallableIncluded:
        false,
      cutoverExecutionCallableIncluded:
        false,
      rollbackMutationCallableIncluded:
        false,
      executionAuthorizationIssued:
        false,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        PHASE4C28_NEXT_GATE,
      allowed:
        verified &&
        secondsRemaining >
          0 &&
        approvalCore.finalQuiescenceGatePassed ===
          true &&
        approvalCore.refreshTokenUsed ===
          false &&
        approvalCore.executionAuthorizationIssued ===
          false,
      requiresExactQuiescenceApprovalDigest:
        true,
      requiresNewIrreversibleExecutionApproval:
        true,
      mustRerunLiveStateChecks:
        true,
      mustVerifyRollbackSnapshot:
        true,
      uidMutationAllowed:
        false,
      actualUidCutoverAllowed:
        false
    }
  };
}

export const approveUidV2ProductionCutoverGatePhase4c28r =
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
              Phase4c28ApproveInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C28_CONTRACT_DIGEST ||
        text(
          input.approvalPhrase
        ) !==
          PHASE4C28_APPROVAL_PHRASE ||
        text(
          input.sealedPackageDigest
        ) !==
          EXPECTED_SEALED_PACKAGE_DIGEST ||
        input.confirmMaintenanceGuardDeployed !==
          true ||
        input.confirmSealedPackageValid !==
          true ||
        input.confirmTokenRemainsUnused !==
          true ||
        input.confirmNoUidMutation !==
          true ||
        input.confirmNoExecutionAuthorization !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-28R approval gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const approvalRef =
        phase4c28ApprovalRef(
          context
        );

      const packageRef =
        phase4c27PackageRef(
          context
        );

      const existingApproval =
        await approvalRef.get();

      if (existingApproval.exists) {
        const stored =
          existingApproval.data() ||
          {};

        if (
          text(
            stored.approvedByFirebaseUid
          ) !==
            callerUid ||
          text(
            stored.contractDigest
          ) !==
            PHASE4C28_CONTRACT_DIGEST
        ) {
          throw new HttpsError(
            "already-exists",
            "An incompatible Phase 4C-28R approval exists."
          );
        }

        return publicPhase4c28Approval(
          stored,
          true,
          0,
          false
        );
      }

      const [
        packageSnapshot,
        tokenSnapshot,
        executionSnapshot
      ] = await Promise.all([
        packageRef.get(),
        context.refreshTokenRef.get(),
        context.refreshExecutionChallengeRef.get()
      ]);

      if (
        !packageSnapshot.exists ||
        !tokenSnapshot.exists ||
        !executionSnapshot.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-28R prerequisite documents are incomplete."
        );
      }

      const storedPackage =
        packageSnapshot.data() ||
        {};

      const packageCore =
        asRecord(
          storedPackage.packageCore,
          "sealedPackage.packageCore"
        );

      const tokenStored =
        tokenSnapshot.data() ||
        {};

      const tokenCore =
        asRecord(
          tokenStored.core,
          "refreshToken.core"
        );

      const executionStored =
        executionSnapshot.data() ||
        {};

      const initialChecks:
        GenericRecord = {
      packageContract:
        text(
          storedPackage.contractDigest
        ) ===
        EXPECTED_PHASE4C27_CONTRACT_DIGEST,
      packageDigest:
        text(
          storedPackage.sealedPackageDigest
        ) ===
          EXPECTED_SEALED_PACKAGE_DIGEST &&
        digestValue(
          packageCore
        ) ===
          EXPECTED_SEALED_PACKAGE_DIGEST,
      packageIdentity:
        text(
          packageCore.sealedPackageId
        ) ===
          EXPECTED_SEALED_PACKAGE_ID &&
        text(
          packageCore.packageExpiresAtIso
        ) ===
          EXPECTED_SEALED_PACKAGE_EXPIRES_AT_ISO,
      packageState:
        text(
          packageCore.sealedPackageState
        ) ===
        "sealed_waiting_explicit_production_cutover_approval",
      packageValid:
        parseIsoMillis(
          packageCore.packageExpiresAtIso,
          "sealedPackage.packageExpiresAtIso"
        ) >
        Date.now(),
      packageLinks:
        text(
          packageCore.executionChallengeDigest
        ) ===
          EXPECTED_EXECUTION_CHALLENGE_DIGEST &&
        text(
          packageCore.tokenDigest
        ) ===
          EXPECTED_REFRESH_TOKEN_DIGEST_PHASE4C28R &&
        text(
          packageCore.refreshChallengeDigest
        ) ===
          EXPECTED_REFRESH_CHALLENGE_DIGEST_PHASE4C28R &&
        text(
          packageCore.phase4c22AssemblyPackageDigest
        ) ===
          EXPECTED_PHASE4C22_ASSEMBLY_PACKAGE_DIGEST_PHASE4C28R,
      packageNotExecutable:
        packageCore.sealedPackageExecutable ===
          false &&
        packageCore.sealedPackageContainsRawMutationPayload ===
          false &&
        packageCore.tokenConsumptionCallableIncluded ===
          false &&
        packageCore.cutoverExecutionCallableIncluded ===
          false &&
        packageCore.rollbackMutationCallableIncluded ===
          false,
      tokenDigest:
        text(
          tokenStored.digest
        ) ===
          EXPECTED_REFRESH_TOKEN_DIGEST_PHASE4C28R &&
        digestValue(
          tokenCore
        ) ===
          EXPECTED_REFRESH_TOKEN_DIGEST_PHASE4C28R,
      tokenUnused:
        tokenCore.tokenUsed ===
          false &&
        numberValue(
          tokenCore.tokenUseCount
        ) ===
          0,
      executionPackageLink:
        text(
          executionStored.sealedPackageDigest
        ) ===
          EXPECTED_SEALED_PACKAGE_DIGEST,
      noMutation:
        numberValue(
          packageCore.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          packageCore.actualCutoverWrites
        ) ===
          0 &&
        packageCore.uidMutationAllowed ===
          false &&
        packageCore.actualUidCutoverAllowed ===
          false
      };

      if (!allTrue(
        initialChecks
      )) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-28R sealed package validation failed: ${
            Object.entries(
              initialChecks
            )
              .filter(
                ([, passed]) =>
                  passed !==
                  true
              )
              .map(
                ([key]) =>
                  key
              )
              .join(", ")
          }`
        );
      }

      const activeA =
        await activeDocuments(
          context
        );

      const baseline =
        await loadSnapshotBaseline(
          context
        );

      const sheet =
        validatePhase4c28SheetEnvelope(
          input.sheetEnvelope,
          baseline.payload
        );

      const liveA =
        await liveRecheck(
          context,
          baseline.payload,
          sheet
        );

      await phase4c28Pause(
        PHASE4C28_SETTLE_MILLISECONDS
      );

      const [
        activeB,
        liveB,
        packageSnapshotB,
        tokenSnapshotB
      ] = await Promise.all([
        activeDocuments(
          context
        ),
        liveRecheck(
          context,
          baseline.payload,
          sheet
        ),
        packageRef.get(),
        context.refreshTokenRef.get()
      ]);

      if (
        !packageSnapshotB.exists ||
        !tokenSnapshotB.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-28R documents disappeared during quiescence check."
        );
      }

      const packageStoredB =
        packageSnapshotB.data() ||
        {};

      const packageCoreB =
        asRecord(
          packageStoredB.packageCore,
          "sealedPackageB.packageCore"
        );

      const tokenStoredB =
        tokenSnapshotB.data() ||
        {};

      const tokenCoreB =
        asRecord(
          tokenStoredB.core,
          "refreshTokenB.core"
        );

      const stableChecks:
        GenericRecord = {
      livePassA:
        liveChecksPassed(
          liveA
        ),
      livePassB:
        liveChecksPassed(
          liveB
        ),
      sheetStable:
        text(
          liveA.sheetCaptureDigest
        ) ===
        text(
          liveB.sheetCaptureDigest
        ),
      attendanceStable:
        text(
          liveA.attendanceDigest
        ) ===
        text(
          liveB.attendanceDigest
        ),
      assignmentsStable:
        text(
          liveA.assignmentDigest
        ) ===
        text(
          liveB.assignmentDigest
        ),
      inPlaceStable:
        text(
          liveA.inPlaceAttendanceDigest
        ) ===
        text(
          liveB.inPlaceAttendanceDigest
        ),
      authStable:
        text(
          liveA.firebaseAuthDigest
        ) ===
        text(
          liveB.firebaseAuthDigest
        ),
      packageStable:
        text(
          packageStoredB.sealedPackageDigest
        ) ===
          EXPECTED_SEALED_PACKAGE_DIGEST &&
        digestValue(
          packageCoreB
        ) ===
          EXPECTED_SEALED_PACKAGE_DIGEST,
      packageStillValid:
        parseIsoMillis(
          packageCoreB.packageExpiresAtIso,
          "sealedPackageB.packageExpiresAtIso"
        ) >
        Date.now(),
      tokenStillUnused:
        text(
          tokenStoredB.digest
        ) ===
          EXPECTED_REFRESH_TOKEN_DIGEST_PHASE4C28R &&
        digestValue(
          tokenCoreB
        ) ===
          EXPECTED_REFRESH_TOKEN_DIGEST_PHASE4C28R &&
        tokenCoreB.tokenUsed ===
          false &&
        numberValue(
          tokenCoreB.tokenUseCount
        ) ===
          0,
      lockStable:
        text(
          activeA.lock.state
        ) ===
          "owned" &&
        text(
          activeB.lock.state
        ) ===
          "owned",
      maintenanceStable:
        text(
          activeA.maintenance.state
        ) ===
          "active" &&
        text(
          activeB.maintenance.state
        ) ===
          "active",
      noMutation:
        numberValue(
          activeA.recovery.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          activeA.lock.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          activeA.maintenance.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          activeB.recovery.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          activeB.lock.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          activeB.maintenance.uidMutationWrites
        ) ===
          0
      };

      if (!allTrue(
        stableChecks
      )) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-28R final quiescence validation failed: ${
            Object.entries(
              stableChecks
            )
              .filter(
                ([, passed]) =>
                  passed !==
                  true
              )
              .map(
                ([key]) =>
                  key
              )
              .join(", ")
          }`
        );
      }

      const issuedAtIso =
        new Date().toISOString();

      const approvalExpiresAtIso =
        addSecondsIso(
          Date.parse(
            issuedAtIso
          ),
          PHASE4C28_VALIDITY_SECONDS
        );

      const leaseExpiresAtIso =
        addSecondsIso(
          Date.parse(
            issuedAtIso
          ),
          7200
        );

      const quiescenceApprovalId =
        [
          "phase4c28r",
          Date.now().toString(36),
          randomBytes(12).toString("hex")
        ].join("-");

      const approvalCore:
        GenericRecord = {
      version:
        UID_V2_FINAL_QUIESCENCE_GATE_PHASE4C28R_VERSION,
      phase:
        "Phase 4C-28R",
      mode:
        "rebase156_explicit_production_cutover_approval_and_final_quiescence_gate_only_no_uid_mutation_no_cutover",
      requestId:
        REQUEST_ID,
      contractDigest:
        PHASE4C28_CONTRACT_DIGEST,
      quiescenceApprovalId,
      quiescenceState:
        "final_quiescence_passed_waiting_irreversible_execution_approval",
      approvalIssuedAtIso:
        issuedAtIso,
      approvalExpiresAtIso,
      approvalValiditySeconds:
        PHASE4C28_VALIDITY_SECONDS,
      approvedByFirebaseUidDigest:
        digestValue(
          callerUid
        ),
      sealedPackageDigest:
        EXPECTED_SEALED_PACKAGE_DIGEST,
      sealedPackageId:
        EXPECTED_SEALED_PACKAGE_ID,
      packageWasValidAtApproval:
        true,
      executionChallengeDigest:
        EXPECTED_EXECUTION_CHALLENGE_DIGEST,
      refreshTokenDigest:
        EXPECTED_REFRESH_TOKEN_DIGEST_PHASE4C28R,
      refreshChallengeDigest:
        EXPECTED_REFRESH_CHALLENGE_DIGEST_PHASE4C28R,
      phase4c22AssemblyPackageDigest:
        EXPECTED_PHASE4C22_ASSEMBLY_PACKAGE_DIGEST_PHASE4C28R,
      sheetCaptureDigest:
        sheet.wrapperDigest,
      twoPassLiveRecheck: {
        settleMilliseconds:
          PHASE4C28_SETTLE_MILLISECONDS,
        first:
          liveA,
        second:
          liveB,
        stableChecks
      },
      explicitProductionCutoverApprovalRecorded:
        true,
      finalQuiescenceGatePassed:
        true,
      productionExecutionLockOwned:
        true,
      productionMaintenanceWindowActive:
        true,
      refreshTokenUsed:
        false,
      refreshTokenUseCount:
        0,
      sealedPackageExecutable:
        false,
      executionAuthorizationIssued:
        false,
      tokenConsumptionCallableIncluded:
        false,
      cutoverExecutionCallableIncluded:
        false,
      rollbackMutationCallableIncluded:
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
      actualCutoverWrites:
        0,
      uidMutationAllowed:
        false,
      actualUidCutoverAllowed:
        false,
      nextGate: {
        phase:
          PHASE4C28_NEXT_GATE,
        requiresExactQuiescenceApprovalDigest:
          true,
        requiresNewIrreversibleExecutionApproval:
          true,
        mustRerunLiveStateChecks:
          true,
        mustVerifyRollbackSnapshot:
          true,
        uidMutationAllowed:
          false,
        actualUidCutoverAllowed:
          false
      }
      };

      const quiescenceApprovalDigest =
        digestValue(
          approvalCore
        );

      const storedApproval:
        GenericRecord = {
      version:
        UID_V2_FINAL_QUIESCENCE_GATE_PHASE4C28R_VERSION,
      phase:
        "Phase 4C-28R",
      mode:
        "rebase156_explicit_production_cutover_approval_and_final_quiescence_gate_only_no_uid_mutation_no_cutover",
      requestId:
        REQUEST_ID,
      contractDigest:
        PHASE4C28_CONTRACT_DIGEST,
      approvedByFirebaseUid:
        callerUid,
      quiescenceApprovalDigest,
      approvalCore,
      status:
        "explicit_production_cutover_approval_recorded_final_quiescence_passed_no_uid_mutation",
      createdAtIso:
        issuedAtIso
      };

      await context.db.runTransaction(
        async (transaction) => {
          const [
            currentApproval,
            currentPackage,
            currentToken,
            currentRecovery,
            currentLock,
            currentMaintenance
          ] = await Promise.all([
            transaction.get(
              approvalRef
            ),
            transaction.get(
              packageRef
            ),
            transaction.get(
              context.refreshTokenRef
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

          if (currentApproval.exists) {
            throw new HttpsError(
              "already-exists",
              "Phase 4C-28R create-only destination exists."
            );
          }

          if (
            !currentPackage.exists ||
            !currentToken.exists ||
            !currentRecovery.exists ||
            !currentLock.exists ||
            !currentMaintenance.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-28R active documents disappeared before commit."
            );
          }

          const currentPackageStored =
            currentPackage.data() ||
            {};

          const currentPackageCore =
            asRecord(
              currentPackageStored.packageCore,
              "current.packageCore"
            );

          const currentTokenStored =
            currentToken.data() ||
            {};

          const currentTokenCore =
            asRecord(
              currentTokenStored.core,
              "current.tokenCore"
            );

          const recovery =
            currentRecovery.data() ||
            activeB.recovery;

          const lock =
            currentLock.data() ||
            activeB.lock;

          const maintenance =
            currentMaintenance.data() ||
            activeB.maintenance;

          const commitChecks:
            GenericRecord = {
          package:
            text(
              currentPackageStored.sealedPackageDigest
            ) ===
              EXPECTED_SEALED_PACKAGE_DIGEST &&
            digestValue(
              currentPackageCore
            ) ===
              EXPECTED_SEALED_PACKAGE_DIGEST,
          packageValid:
            parseIsoMillis(
              currentPackageCore.packageExpiresAtIso,
              "current.packageExpiresAtIso"
            ) >
            Date.now(),
          packageNotExecutable:
            currentPackageCore.sealedPackageExecutable ===
              false,
          tokenUnused:
            text(
              currentTokenStored.digest
            ) ===
              EXPECTED_REFRESH_TOKEN_DIGEST_PHASE4C28R &&
            digestValue(
              currentTokenCore
            ) ===
              EXPECTED_REFRESH_TOKEN_DIGEST_PHASE4C28R &&
            currentTokenCore.tokenUsed ===
              false &&
            numberValue(
              currentTokenCore.tokenUseCount
            ) ===
              0,
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
          leaseValid:
            parseIsoMillis(
              lock.leaseExpiresAtIso,
              "lock.leaseExpiresAtIso"
            ) >
            Date.now(),
          noMutation:
            numberValue(
              recovery.uidMutationWrites
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
            commitChecks
          )) {
            throw new HttpsError(
              "failed-precondition",
              `Phase 4C-28R commit gate failed: ${
                Object.entries(
                  commitChecks
                )
                  .filter(
                    ([, passed]) =>
                      passed !==
                      true
                  )
                  .map(
                    ([key]) =>
                      key
                  )
                  .join(", ")
              }`
            );
          }

          transaction.set(
            approvalRef,
            storedApproval
          );

          transaction.set(
            packageRef,
            {
              ...currentPackageStored,
              quiescenceApprovalDigest,
              quiescenceApprovalId,
              finalQuiescenceGatePassed:
                true,
              executionAuthorizationIssued:
                false,
              updatedAtIso:
                issuedAtIso
            }
          );

          transaction.set(
            context.recoverySessionRef,
            {
              ...recovery,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              quiescenceApprovalDigest,
              uidMutationWrites:
                0,
              actualUidCutoverAllowed:
                false,
              updatedAtIso:
                issuedAtIso
            }
          );

          transaction.set(
            context.lockRef,
            {
              ...lock,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              quiescenceApprovalDigest,
              uidMutationWrites:
                0,
              actualUidCutoverAllowed:
                false,
              updatedAtIso:
                issuedAtIso
            }
          );

          transaction.set(
            context.maintenanceRef,
            {
              ...maintenance,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              quiescenceApprovalDigest,
              uidMutationWrites:
                0,
              actualUidCutoverAllowed:
                false,
              updatedAtIso:
                issuedAtIso
            }
          );
        }
      );

      return publicPhase4c28Approval(
        storedApproval,
        false,
        PHASE4C28_WRITE_OPERATIONS,
        false
      );
    }
  );

export const inspectUidV2ProductionCutoverGatePhase4c28r =
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
              Phase4c28InspectInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C28_CONTRACT_DIGEST ||
        text(
          input.quiescenceApprovalDigest
        ) ===
          ""
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-28R inspect gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const approvalRef =
        phase4c28ApprovalRef(
          context
        );

      const packageRef =
        phase4c27PackageRef(
          context
        );

      const [
        approvalSnapshot,
        packageSnapshot,
        tokenSnapshot,
        recoverySnapshot,
        lockSnapshot,
        maintenanceSnapshot
      ] = await Promise.all([
        approvalRef.get(),
        packageRef.get(),
        context.refreshTokenRef.get(),
        context.recoverySessionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get()
      ]);

      if (
        !approvalSnapshot.exists ||
        !packageSnapshot.exists ||
        !tokenSnapshot.exists ||
        !recoverySnapshot.exists ||
        !lockSnapshot.exists ||
        !maintenanceSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-28R linked documents are incomplete."
        );
      }

      const storedApproval =
        approvalSnapshot.data() ||
        {};

      const approvalCore =
        asRecord(
          storedApproval.approvalCore,
          "quiescenceApproval.approvalCore"
        );

      const storedPackage =
        packageSnapshot.data() ||
        {};

      const tokenStored =
        tokenSnapshot.data() ||
        {};

      const tokenCore =
        asRecord(
          tokenStored.core,
          "refreshToken.core"
        );

      const recovery =
        recoverySnapshot.data() ||
        {};

      const lock =
        lockSnapshot.data() ||
        {};

      const maintenance =
        maintenanceSnapshot.data() ||
        {};

      const quiescenceApprovalDigest =
        text(
          input.quiescenceApprovalDigest
        );

      const stableChecks =
        asRecord(
          asRecord(
            approvalCore.twoPassLiveRecheck,
            "approval.twoPassLiveRecheck"
          ).stableChecks,
          "approval.stableChecks"
        );

      const checks:
        GenericRecord = {
      status:
        text(
          storedApproval.status
        ) ===
        "explicit_production_cutover_approval_recorded_final_quiescence_passed_no_uid_mutation",
      caller:
        text(
          storedApproval.approvedByFirebaseUid
        ) ===
        callerUid,
      contract:
        text(
          storedApproval.contractDigest
        ) ===
        PHASE4C28_CONTRACT_DIGEST,
      digest:
        text(
          storedApproval.quiescenceApprovalDigest
        ) ===
          quiescenceApprovalDigest &&
        digestValue(
          approvalCore
        ) ===
          quiescenceApprovalDigest,
      approvalValid:
        parseIsoMillis(
          approvalCore.approvalExpiresAtIso,
          "approval.approvalExpiresAtIso"
        ) >
        Date.now(),
      approvalState:
        text(
          approvalCore.quiescenceState
        ) ===
        "final_quiescence_passed_waiting_irreversible_execution_approval",
      packageLink:
        text(
          approvalCore.sealedPackageDigest
        ) ===
          EXPECTED_SEALED_PACKAGE_DIGEST &&
        text(
          storedPackage.quiescenceApprovalDigest
        ) ===
          quiescenceApprovalDigest,
      packageWasValid:
        approvalCore.packageWasValidAtApproval ===
        true,
      quiescence:
        approvalCore.explicitProductionCutoverApprovalRecorded ===
          true &&
        approvalCore.finalQuiescenceGatePassed ===
          true &&
        allTrue(
          stableChecks
        ),
      tokenUnused:
        text(
          tokenStored.digest
        ) ===
          EXPECTED_REFRESH_TOKEN_DIGEST_PHASE4C28R &&
        digestValue(
          tokenCore
        ) ===
          EXPECTED_REFRESH_TOKEN_DIGEST_PHASE4C28R &&
        tokenCore.tokenUsed ===
          false &&
        numberValue(
          tokenCore.tokenUseCount
        ) ===
          0,
      recovery:
        text(
          recovery.quiescenceApprovalDigest
        ) ===
        quiescenceApprovalDigest,
      lock:
        text(
          lock.state
        ) ===
          "owned" &&
        text(
          lock.quiescenceApprovalDigest
        ) ===
          quiescenceApprovalDigest &&
        parseIsoMillis(
          lock.leaseExpiresAtIso,
          "lock.leaseExpiresAtIso"
        ) >
          Date.now(),
      maintenance:
        text(
          maintenance.state
        ) ===
          "active" &&
        text(
          maintenance.quiescenceApprovalDigest
        ) ===
          quiescenceApprovalDigest,
      noExecution:
        approvalCore.sealedPackageExecutable ===
          false &&
        approvalCore.executionAuthorizationIssued ===
          false &&
        approvalCore.tokenConsumptionCallableIncluded ===
          false &&
        approvalCore.cutoverExecutionCallableIncluded ===
          false &&
        approvalCore.rollbackMutationCallableIncluded ===
          false,
      noMutation:
        numberValue(
          approvalCore.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          approvalCore.actualCutoverWrites
        ) ===
          0 &&
        approvalCore.uidMutationAllowed ===
          false &&
        approvalCore.actualUidCutoverAllowed ===
          false
      };

      if (!allTrue(
        checks
      )) {
        throw new HttpsError(
          "data-loss",
          `Phase 4C-28R verification failed: ${
            Object.entries(
              checks
            )
              .filter(
                ([, passed]) =>
                  passed !==
                  true
              )
              .map(
                ([key]) =>
                  key
              )
              .join(", ")
          }`
        );
      }

      return publicPhase4c28Approval(
        storedApproval,
        true,
        0,
        true
      );
    }
  );


export const UID_V2_FINAL_EXECUTION_AUTH_PHASE4C29R_VERSION =
  "2026-07-29.716.85-phase4c29r-final-execution-authorization-rollback-verified-only";

const PHASE4C29_CONTRACT_DIGEST =
  "10420b61deacaba064cbfe16871428805c696775fabc0231ffc27d3f52ed723e";

const PHASE4C29_APPROVAL_PHRASE =
  "Phase 4C-29R 일회성 최종 실행 권한 발급을 승인합니다. 실제 UID 변경과 Cutover는 이번 단계에서 실행하지 않습니다.";

const EXPECTED_PHASE4C28_CONTRACT_DIGEST =
  "aeff51fae3b11d48ad4889ac3e778aa398eb4cb44d1709d03642e1d7d55ee051";

const EXPECTED_QUIESCENCE_APPROVAL_DIGEST =
  "1d2b7a436936ea3aefda4f7d35807aed4df4093c65e9484d2df9f20d71ff7612";

const EXPECTED_QUIESCENCE_APPROVAL_ID =
  "phase4c28r-ms4s2b8i-1b4af7c66b003382f50e54c4";

const EXPECTED_QUIESCENCE_APPROVAL_EXPIRES_AT_ISO =
  "2026-07-28T15:25:17.346Z";

const EXPECTED_SEALED_PACKAGE_DIGEST_PHASE4C29R =
  "c5096c4f28b14fdfadb29fcb06226cd446493f128bee50782b159188ae8a81c5";

const EXPECTED_FRESH_METADATA_DIGEST_PHASE4C29R =
  "eeb9d0b3d692c11d721edfae66f21fb409ae5f4aa95f30f782f5971805b179f7";

const EXPECTED_FRESH_VERIFICATION_DIGEST_PHASE4C29R =
  "a391e7cf6bca62664e9356836204377e46b7aab8a4864b8e936c06cc35022e92";

const EXPECTED_FRESH_ROLLBACK_DIGEST_PHASE4C29R =
  "a9bd1d73135048b73a9c702015570ad97193f4acad4dcbbae658daeca2360fc0";

const EXPECTED_FRESH_CANONICAL_SHA256_PHASE4C29R =
  "a9bd1d73135048b73a9c702015570ad97193f4acad4dcbbae658daeca2360fc0";

const EXPECTED_FRESH_COMPRESSED_SHA256_PHASE4C29R =
  "a21bcc6bd88bcda40b2e96037957e0c90bf5d9acfe019118e91a2ce3dd80e740";

const EXPECTED_FRESH_CHUNK_DIGEST_PHASE4C29R =
  "872364ab1ecb3a3b5dae3ec739b94a099c1b4cedd262502bc843cde63fa9d8ce";

const PHASE4C29_AUTHORIZATION_DOCUMENT =
  "phase4c29r-71685";

const PHASE4C29_AUTHORIZATION_VALIDITY_SECONDS =
  1800;

const PHASE4C29_LIVE_SETTLE_MILLISECONDS =
  5000;

const PHASE4C29_WRITE_OPERATIONS =
  5;

const PHASE4C29_NEXT_GATE =
  "Phase 4C-30R one-time phased production cutover execution with automatic reverse-order rollback";

interface Phase4c29AuthorizeInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly approvalPhrase?: unknown;
  readonly quiescenceApprovalDigest?: unknown;
  readonly sheetEnvelope?: unknown;
  readonly confirmMaintenanceGuardDeployed?: unknown;
  readonly confirmQuiescenceApprovalValid?: unknown;
  readonly confirmRollbackSnapshotVerified?: unknown;
  readonly confirmNoUidMutation?: unknown;
  readonly confirmAuthorizationOnly?: unknown;
}

interface Phase4c29InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly executionAuthorizationDigest?: unknown;
}

function phase4c29AuthorizationRef(
  context: Context
): DocumentReference<DocumentData> {
  return context.runRef
    .collection(
      "rebaseFinalExecutionAuthorizations"
    )
    .doc(
      PHASE4C29_AUTHORIZATION_DOCUMENT
    );
}

function phase4c29Pause(
  milliseconds: number
): Promise<void> {
  return new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

function validatePhase4c29SheetEnvelope(
  value: unknown,
  baselinePayload: GenericRecord
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
      "Phase 4C-29R Sheet wrapper digest mismatch."
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

  if (
    text(
      sourceEnvelope.snapshotDigest
    ) !==
    digestValue(
      sourceSnapshot
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Phase 4C-29R nested Sheet digest mismatch."
    );
  }

  const cells =
    asArray(
      sourceSnapshot.rollbackCells,
      "rollbackCells"
    ).map(
      (item, index) =>
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
      (item, index) =>
        asRecord(
          item,
          `principalAnchor${index}`
        )
    );

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
      (item, index) =>
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
      (item, index) =>
        asRecord(
          item,
          `baselineAnchor${index}`
        )
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

  const ageSeconds =
    (
      Date.now() -
      capturedAtMillis
    ) /
    1000;

  const safety =
    asRecord(
      wrapper.safety,
      "wrapper.safety"
    );

  const checks:
    GenericRecord = {
  version:
    text(
      wrapper.version
    ) ===
    UID_V2_FINAL_EXECUTION_AUTH_PHASE4C29R_VERSION,
  phase:
    text(
      wrapper.phase
    ) ===
    "Phase 4C-29R",
  request:
    text(
      wrapper.requestId
    ) ===
    REQUEST_ID,
  contract:
    text(
      wrapper.contractDigest
    ) ===
    PHASE4C29_CONTRACT_DIGEST,
  captureFresh:
    ageSeconds >=
      0 &&
    ageSeconds <=
      600,
  captureNotFuture:
    capturedAtMillis <=
    Date.now() +
    30000,
  cells:
    cells.length ===
      170 &&
    exactJson(
      sortRecords(cells),
      sortRecords(baselineCells)
    ),
  anchors:
    anchors.length ===
      12 &&
    exactJson(
      sortRecords(anchors),
      sortRecords(baselineAnchors)
    ),
  targetsBlank:
    cells.every(
      (cell) =>
        cell.targetCellBlank ===
          true &&
        blankCellState(
          cell.beforeState
        )
    ),
  noMutation:
    numberValue(
      safety.uidMutationWrites
    ) ===
      0 &&
    numberValue(
      safety.actualCutoverWrites
    ) ===
      0 &&
    safety.actualUidCutoverAllowed ===
      false
  };

  if (!allTrue(
    checks
  )) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-29R Fresh Sheet validation failed: ${
        Object.entries(
          checks
        )
          .filter(
            ([, passed]) =>
              passed !==
              true
          )
          .map(
            ([key]) =>
              key
          )
          .join(", ")
      }`
    );
  }

  return {
    wrapperDigest,
    cells,
    anchors,
    capturedAtIso
  };
}

function verifyPhase4c29RollbackSnapshot(
  baseline: SnapshotBaseline
): GenericRecord {
  const metadata =
    baseline.metadata;

  const verification =
    baseline.verification;

  const chunk =
    baseline.chunk;

  const payload =
    baseline.payload;

  const sheet =
    asRecord(
      payload.sheet,
      "rollbackPayload.sheet"
    );

  const attendance =
    asArray(
      payload.attendance,
      "rollbackPayload.attendance"
    );

  const assignments =
    asArray(
      payload.assignments,
      "rollbackPayload.assignments"
    );

  const auth =
    asRecord(
      payload.firebaseAuth,
      "rollbackPayload.firebaseAuth"
    );

  const inPlace =
    asArray(
      payload.inPlaceAttendancePlans,
      "rollbackPayload.inPlaceAttendancePlans"
    );

  const rollbackCells =
    asArray(
      sheet.rollbackCells,
      "rollbackPayload.sheet.rollbackCells"
    );

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

  const checks:
    GenericRecord = {
  metadataDigest:
    digestValue(
      metadata
    ) ===
    EXPECTED_FRESH_METADATA_DIGEST_PHASE4C29R,
  verificationDigest:
    digestValue(
      verification
    ) ===
    EXPECTED_FRESH_VERIFICATION_DIGEST_PHASE4C29R,
  rollbackDigest:
    digestValue(
      payload
    ) ===
    EXPECTED_FRESH_ROLLBACK_DIGEST_PHASE4C29R,
  canonicalSha:
    sha256Text(
      canonical
    ) ===
    EXPECTED_FRESH_CANONICAL_SHA256_PHASE4C29R,
  compressedSha:
    sha256Buffer(
      compressed
    ) ===
    EXPECTED_FRESH_COMPRESSED_SHA256_PHASE4C29R,
  chunkDigest:
    sha256Text(
      encoded
    ) ===
      EXPECTED_FRESH_CHUNK_DIGEST_PHASE4C29R &&
    text(
      chunk.payloadSegmentSha256
    ) ===
      EXPECTED_FRESH_CHUNK_DIGEST_PHASE4C29R,
  verificationLoaded:
    Object.keys(
      verification
    ).length >
    0,
  sheetCount:
    rollbackCells.length ===
    170,
  attendanceCount:
    attendance.length ===
    69,
  assignmentCount:
    assignments.length ===
    14,
  authCount:
    text(
      auth.sourceFirebaseUid
    ) !==
      "" &&
    text(
      auth.targetFirebaseUid
    ) !==
      "",
  inPlaceCount:
    inPlace.length ===
    68
  };

  if (!allTrue(
    checks
  )) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-29R rollback snapshot verification failed: ${
        Object.entries(
          checks
        )
          .filter(
            ([, passed]) =>
              passed !==
              true
          )
          .map(
            ([key]) =>
              key
          )
          .join(", ")
      }`
    );
  }

  return {
    checks,
    metadataDigest:
      EXPECTED_FRESH_METADATA_DIGEST_PHASE4C29R,
    verificationDigest:
      EXPECTED_FRESH_VERIFICATION_DIGEST_PHASE4C29R,
    rollbackSnapshotDigest:
      EXPECTED_FRESH_ROLLBACK_DIGEST_PHASE4C29R,
    canonicalSha256:
      EXPECTED_FRESH_CANONICAL_SHA256_PHASE4C29R,
    compressedSha256:
      EXPECTED_FRESH_COMPRESSED_SHA256_PHASE4C29R,
    chunkDigest:
      EXPECTED_FRESH_CHUNK_DIGEST_PHASE4C29R,
    counts: {
      sheetTargetCells:
        rollbackCells.length,
      attendanceDocuments:
        attendance.length,
      assignmentDocuments:
        assignments.length,
      firebaseAuthUsers:
        1,
      inPlaceAttendancePlans:
        inPlace.length
    }
  };
}

function publicPhase4c29Authorization(
  storedAuthorization: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean
): GenericRecord {
  const authorizationCore =
    asRecord(
      storedAuthorization.authorizationCore,
      "executionAuthorization.authorizationCore"
    );

  const expiresAtMillis =
    parseIsoMillis(
      authorizationCore.authorizationExpiresAtIso,
      "executionAuthorization.expiresAtIso"
    );

  const secondsRemaining =
    Math.max(
      0,
      (
        expiresAtMillis -
        Date.now()
      ) /
      1000
    );

  return {
    ok:
      true,
    version:
      UID_V2_FINAL_EXECUTION_AUTH_PHASE4C29R_VERSION,
    phase:
      "Phase 4C-29R",
    mode:
      "rebase156_final_execution_authorization_and_rollback_snapshot_verification_only_no_uid_mutation_no_cutover",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    status:
      text(
        storedAuthorization.status
      ),
    contractDigest:
      PHASE4C29_CONTRACT_DIGEST,
    executionAuthorizationDigest:
      text(
        storedAuthorization.executionAuthorizationDigest
      ),
    executionAuthorizationCoreDigest:
      digestValue(
        authorizationCore
      ),
    executionAuthorizationId:
      authorizationCore.executionAuthorizationId,
    authorizationState:
      authorizationCore.authorizationState,
    authorizationIssuedAtIso:
      authorizationCore.authorizationIssuedAtIso,
    authorizationExpiresAtIso:
      authorizationCore.authorizationExpiresAtIso,
    authorizationSecondsRemaining:
      secondsRemaining,
    authorizationWithinValidity:
      secondsRemaining >
      0,
    authorizationUsed:
      authorizationCore.authorizationUsed,
    quiescenceApprovalDigest:
      authorizationCore.quiescenceApprovalDigest,
    quiescenceWasValidAtAuthorization:
      authorizationCore.quiescenceWasValidAtAuthorization,
    sealedPackageDigest:
      authorizationCore.sealedPackageDigest,
    rollbackSnapshotVerification:
      authorizationCore.rollbackSnapshotVerification,
    twoPassLiveRecheck:
      authorizationCore.twoPassLiveRecheck,
    productionExecutionLockOwned:
      authorizationCore.productionExecutionLockOwned,
    productionMaintenanceWindowActive:
      authorizationCore.productionMaintenanceWindowActive,
    refreshTokenUsed:
      authorizationCore.refreshTokenUsed,
    cutoverExecutionCallableIncluded:
      authorizationCore.cutoverExecutionCallableIncluded,
    uidMutationWrites:
      authorizationCore.uidMutationWrites,
    actualCutoverWrites:
      authorizationCore.actualCutoverWrites,
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
      actualCutoverWrites:
        0,
      authorizationConsumptionCallableIncluded:
        false,
      cutoverExecutionCallableIncluded:
        false,
      rollbackMutationCallableIncluded:
        false,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        PHASE4C29_NEXT_GATE,
      allowed:
        verified &&
        secondsRemaining >
          0 &&
        authorizationCore.authorizationUsed ===
          false &&
        authorizationCore.rollbackSnapshotVerificationPassed ===
          true,
      requiresExactExecutionAuthorizationDigest:
        true,
      requiresFinalDestructiveApprovalPhrase:
        true,
      requiresBoundProductionCollectionLayout:
        true,
      requiresSheetApplyAndRollbackReceipts:
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

export const authorizeUidV2CutoverExecutionPhase4c29r =
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
              Phase4c29AuthorizeInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C29_CONTRACT_DIGEST ||
        text(
          input.approvalPhrase
        ) !==
          PHASE4C29_APPROVAL_PHRASE ||
        text(
          input.quiescenceApprovalDigest
        ) !==
          EXPECTED_QUIESCENCE_APPROVAL_DIGEST ||
        input.confirmMaintenanceGuardDeployed !==
          true ||
        input.confirmQuiescenceApprovalValid !==
          true ||
        input.confirmRollbackSnapshotVerified !==
          true ||
        input.confirmNoUidMutation !==
          true ||
        input.confirmAuthorizationOnly !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-29R authorization gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const authorizationRef =
        phase4c29AuthorizationRef(
          context
        );

      const approvalRef =
        phase4c28ApprovalRef(
          context
        );

      const packageRef =
        phase4c27PackageRef(
          context
        );

      const existing =
        await authorizationRef.get();

      if (existing.exists) {
        const stored =
          existing.data() ||
          {};

        if (
          text(
            stored.approvedByFirebaseUid
          ) !==
            callerUid ||
          text(
            stored.contractDigest
          ) !==
            PHASE4C29_CONTRACT_DIGEST
        ) {
          throw new HttpsError(
            "already-exists",
            "An incompatible Phase 4C-29R authorization exists."
          );
        }

        return publicPhase4c29Authorization(
          stored,
          true,
          0,
          false
        );
      }

      const [
        approvalSnapshot,
        packageSnapshot,
        tokenSnapshot
      ] = await Promise.all([
        approvalRef.get(),
        packageRef.get(),
        context.refreshTokenRef.get()
      ]);

      if (
        !approvalSnapshot.exists ||
        !packageSnapshot.exists ||
        !tokenSnapshot.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-29R prerequisite documents are incomplete."
        );
      }

      const storedApproval =
        approvalSnapshot.data() ||
        {};

      const approvalCore =
        asRecord(
          storedApproval.approvalCore,
          "quiescenceApproval.approvalCore"
        );

      const storedPackage =
        packageSnapshot.data() ||
        {};

      const tokenStored =
        tokenSnapshot.data() ||
        {};

      const tokenCore =
        asRecord(
          tokenStored.core,
          "refreshToken.core"
        );

      const quiescenceExpiresMillis =
        parseIsoMillis(
          approvalCore.approvalExpiresAtIso,
          "quiescenceApproval.expiresAtIso"
        );

      const prechecks:
        GenericRecord = {
      approvalContract:
        text(
          storedApproval.contractDigest
        ) ===
        EXPECTED_PHASE4C28_CONTRACT_DIGEST,
      approvalDigest:
        text(
          storedApproval.quiescenceApprovalDigest
        ) ===
          EXPECTED_QUIESCENCE_APPROVAL_DIGEST &&
        digestValue(
          approvalCore
        ) ===
          EXPECTED_QUIESCENCE_APPROVAL_DIGEST,
      approvalIdentity:
        text(
          approvalCore.quiescenceApprovalId
        ) ===
          EXPECTED_QUIESCENCE_APPROVAL_ID &&
        text(
          approvalCore.approvalExpiresAtIso
        ) ===
          EXPECTED_QUIESCENCE_APPROVAL_EXPIRES_AT_ISO,
      approvalState:
        text(
          approvalCore.quiescenceState
        ) ===
        "final_quiescence_passed_waiting_irreversible_execution_approval",
      approvalValid:
        quiescenceExpiresMillis >
        Date.now(),
      quiescencePassed:
        approvalCore.explicitProductionCutoverApprovalRecorded ===
          true &&
        approvalCore.finalQuiescenceGatePassed ===
          true,
      sealedPackage:
        text(
          approvalCore.sealedPackageDigest
        ) ===
          EXPECTED_SEALED_PACKAGE_DIGEST_PHASE4C29R &&
        text(
          storedPackage.sealedPackageDigest
        ) ===
          EXPECTED_SEALED_PACKAGE_DIGEST_PHASE4C29R &&
        text(
          storedPackage.quiescenceApprovalDigest
        ) ===
          EXPECTED_QUIESCENCE_APPROVAL_DIGEST,
      tokenUnused:
        tokenCore.tokenUsed ===
          false &&
        numberValue(
          tokenCore.tokenUseCount
        ) ===
          0,
      noExistingAuthorization:
        approvalCore.executionAuthorizationIssued ===
          false &&
        storedPackage.executionAuthorizationIssued !==
          true,
      noMutation:
        numberValue(
          approvalCore.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          approvalCore.actualCutoverWrites
        ) ===
          0 &&
        approvalCore.actualUidCutoverAllowed ===
          false
      };

      if (!allTrue(
        prechecks
      )) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-29R approval validation failed: ${
            Object.entries(
              prechecks
            )
              .filter(
                ([, passed]) =>
                  passed !==
                  true
              )
              .map(
                ([key]) =>
                  key
              )
              .join(", ")
          }`
        );
      }

      const activeA =
        await activeDocuments(
          context
        );

      const baseline =
        await loadSnapshotBaseline(
          context
        );

      const rollbackVerification =
        verifyPhase4c29RollbackSnapshot(
          baseline
        );

      const sheet =
        validatePhase4c29SheetEnvelope(
          input.sheetEnvelope,
          baseline.payload
        );

      const liveA =
        await liveRecheck(
          context,
          baseline.payload,
          sheet
        );

      await phase4c29Pause(
        PHASE4C29_LIVE_SETTLE_MILLISECONDS
      );

      const [
        activeB,
        liveB,
        approvalSnapshotB,
        tokenSnapshotB
      ] = await Promise.all([
        activeDocuments(
          context
        ),
        liveRecheck(
          context,
          baseline.payload,
          sheet
        ),
        approvalRef.get(),
        context.refreshTokenRef.get()
      ]);

      if (
        !approvalSnapshotB.exists ||
        !tokenSnapshotB.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-29R documents disappeared during final authorization check."
        );
      }

      const approvalStoredB =
        approvalSnapshotB.data() ||
        {};

      const approvalCoreB =
        asRecord(
          approvalStoredB.approvalCore,
          "quiescenceApprovalB.approvalCore"
        );

      const tokenStoredB =
        tokenSnapshotB.data() ||
        {};

      const tokenCoreB =
        asRecord(
          tokenStoredB.core,
          "refreshTokenB.core"
        );

      const stableChecks:
        GenericRecord = {
      livePassA:
        liveChecksPassed(
          liveA
        ),
      livePassB:
        liveChecksPassed(
          liveB
        ),
      sheetStable:
        text(
          liveA.sheetCaptureDigest
        ) ===
        text(
          liveB.sheetCaptureDigest
        ),
      attendanceStable:
        text(
          liveA.attendanceDigest
        ) ===
        text(
          liveB.attendanceDigest
        ),
      assignmentsStable:
        text(
          liveA.assignmentDigest
        ) ===
        text(
          liveB.assignmentDigest
        ),
      inPlaceStable:
        text(
          liveA.inPlaceAttendanceDigest
        ) ===
        text(
          liveB.inPlaceAttendanceDigest
        ),
      authStable:
        text(
          liveA.firebaseAuthDigest
        ) ===
        text(
          liveB.firebaseAuthDigest
        ),
      approvalStable:
        text(
          approvalStoredB.quiescenceApprovalDigest
        ) ===
          EXPECTED_QUIESCENCE_APPROVAL_DIGEST &&
        digestValue(
          approvalCoreB
        ) ===
          EXPECTED_QUIESCENCE_APPROVAL_DIGEST,
      approvalStillValid:
        parseIsoMillis(
          approvalCoreB.approvalExpiresAtIso,
          "quiescenceApprovalB.expiresAtIso"
        ) >
        Date.now(),
      tokenStillUnused:
        tokenCoreB.tokenUsed ===
          false &&
        numberValue(
          tokenCoreB.tokenUseCount
        ) ===
          0,
      lockStable:
        text(
          activeA.lock.state
        ) ===
          "owned" &&
        text(
          activeB.lock.state
        ) ===
          "owned",
      maintenanceStable:
        text(
          activeA.maintenance.state
        ) ===
          "active" &&
        text(
          activeB.maintenance.state
        ) ===
          "active",
      noMutation:
        numberValue(
          activeA.recovery.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          activeA.lock.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          activeA.maintenance.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          activeB.recovery.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          activeB.lock.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          activeB.maintenance.uidMutationWrites
        ) ===
          0
      };

      if (!allTrue(
        stableChecks
      )) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-29R final authorization stability failed: ${
            Object.entries(
              stableChecks
            )
              .filter(
                ([, passed]) =>
                  passed !==
                  true
              )
              .map(
                ([key]) =>
                  key
              )
              .join(", ")
          }`
        );
      }

      const issuedAtIso =
        new Date().toISOString();

      const authorizationExpiresAtIso =
        addSecondsIso(
          Date.parse(
            issuedAtIso
          ),
          PHASE4C29_AUTHORIZATION_VALIDITY_SECONDS
        );

      const leaseExpiresAtIso =
        addSecondsIso(
          Date.parse(
            issuedAtIso
          ),
          7200
        );

      const executionAuthorizationId =
        [
          "phase4c29r",
          Date.now().toString(36),
          randomBytes(12).toString("hex")
        ].join("-");

      const authorizationCore:
        GenericRecord = {
      version:
        UID_V2_FINAL_EXECUTION_AUTH_PHASE4C29R_VERSION,
      phase:
        "Phase 4C-29R",
      mode:
        "rebase156_final_execution_authorization_and_rollback_snapshot_verification_only_no_uid_mutation_no_cutover",
      requestId:
        REQUEST_ID,
      contractDigest:
        PHASE4C29_CONTRACT_DIGEST,
      executionAuthorizationId,
      authorizationState:
        "authorized_waiting_one_time_phased_cutover_execution",
      authorizationIssuedAtIso:
        issuedAtIso,
      authorizationExpiresAtIso,
      authorizationValiditySeconds:
        PHASE4C29_AUTHORIZATION_VALIDITY_SECONDS,
      authorizationUsed:
        false,
      authorizationUseCount:
        0,
      approvedByFirebaseUidDigest:
        digestValue(
          callerUid
        ),
      quiescenceApprovalDigest:
        EXPECTED_QUIESCENCE_APPROVAL_DIGEST,
      quiescenceApprovalId:
        EXPECTED_QUIESCENCE_APPROVAL_ID,
      quiescenceWasValidAtAuthorization:
        true,
      sealedPackageDigest:
        EXPECTED_SEALED_PACKAGE_DIGEST_PHASE4C29R,
      sheetCaptureDigest:
        sheet.wrapperDigest,
      rollbackSnapshotVerification:
        rollbackVerification,
      rollbackSnapshotVerificationPassed:
        true,
      twoPassLiveRecheck: {
        settleMilliseconds:
          PHASE4C29_LIVE_SETTLE_MILLISECONDS,
        first:
          liveA,
        second:
          liveB,
        stableChecks
      },
      projectedCutover: {
        forwardOrder: [
          "sheet170",
          "firestore350",
          "firebaseAuth1"
        ],
        rollbackOrder: [
          "firebaseAuth1",
          "firestore350",
          "sheet170"
        ],
        projectedTotals:
          {"sheetMutations":170,"firestoreWrites":350,"firebaseAuthWrites":1,"logicalMutations":521},
        crossSystemAtomicity:
          false,
        phasedSagaRequired:
          true
      },
      productionExecutionLockOwned:
        true,
      productionMaintenanceWindowActive:
        true,
      refreshTokenUsed:
        false,
      refreshTokenUseCount:
        0,
      cutoverExecutionCallableIncluded:
        false,
      authorizationConsumptionCallableIncluded:
        false,
      rollbackMutationCallableIncluded:
        false,
      actualMutationPayloadIncluded:
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
      actualCutoverWrites:
        0,
      uidMutationAllowed:
        false,
      actualUidCutoverAllowed:
        false,
      nextGate: {
        phase:
          PHASE4C29_NEXT_GATE,
        requiresExactExecutionAuthorizationDigest:
          true,
        requiresFinalDestructiveApprovalPhrase:
          true,
        requiresBoundProductionCollectionLayout:
          true,
        requiresSheetApplyAndRollbackReceipts:
          true,
        mustRerunLiveStateChecks:
          true,
        uidMutationAllowed:
          false,
        actualUidCutoverAllowed:
          false
      }
      };

      const executionAuthorizationDigest =
        digestValue(
          authorizationCore
        );

      const storedAuthorization:
        GenericRecord = {
      version:
        UID_V2_FINAL_EXECUTION_AUTH_PHASE4C29R_VERSION,
      phase:
        "Phase 4C-29R",
      mode:
        "rebase156_final_execution_authorization_and_rollback_snapshot_verification_only_no_uid_mutation_no_cutover",
      requestId:
        REQUEST_ID,
      contractDigest:
        PHASE4C29_CONTRACT_DIGEST,
      approvedByFirebaseUid:
        callerUid,
      executionAuthorizationDigest,
      authorizationCore,
      status:
        "final_execution_authorization_issued_rollback_verified_no_uid_mutation",
      createdAtIso:
        issuedAtIso
      };

      await context.db.runTransaction(
        async (transaction) => {
          const [
            currentAuthorization,
            currentApproval,
            currentPackage,
            currentRecovery,
            currentLock,
            currentMaintenance
          ] = await Promise.all([
            transaction.get(
              authorizationRef
            ),
            transaction.get(
              approvalRef
            ),
            transaction.get(
              packageRef
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

          if (currentAuthorization.exists) {
            throw new HttpsError(
              "already-exists",
              "Phase 4C-29R create-only destination exists."
            );
          }

          if (
            !currentApproval.exists ||
            !currentPackage.exists ||
            !currentRecovery.exists ||
            !currentLock.exists ||
            !currentMaintenance.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-29R active documents disappeared before commit."
            );
          }

          const currentApprovalStored =
            currentApproval.data() ||
            {};

          const currentApprovalCore =
            asRecord(
              currentApprovalStored.approvalCore,
              "current.approvalCore"
            );

          const recovery =
            currentRecovery.data() ||
            activeB.recovery;

          const lock =
            currentLock.data() ||
            activeB.lock;

          const maintenance =
            currentMaintenance.data() ||
            activeB.maintenance;

          const commitChecks:
            GenericRecord = {
          approval:
            text(
              currentApprovalStored.quiescenceApprovalDigest
            ) ===
              EXPECTED_QUIESCENCE_APPROVAL_DIGEST &&
            digestValue(
              currentApprovalCore
            ) ===
              EXPECTED_QUIESCENCE_APPROVAL_DIGEST,
          approvalValid:
            parseIsoMillis(
              currentApprovalCore.approvalExpiresAtIso,
              "current.approvalExpiresAtIso"
            ) >
            Date.now(),
          authorizationNotIssued:
            currentApprovalCore.executionAuthorizationIssued ===
              false,
          package:
            text(
              (
                currentPackage.data() ||
                {}
              ).sealedPackageDigest
            ) ===
            EXPECTED_SEALED_PACKAGE_DIGEST_PHASE4C29R,
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
          leaseValid:
            parseIsoMillis(
              lock.leaseExpiresAtIso,
              "lock.leaseExpiresAtIso"
            ) >
            Date.now(),
          noMutation:
            numberValue(
              recovery.uidMutationWrites
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
            commitChecks
          )) {
            throw new HttpsError(
              "failed-precondition",
              `Phase 4C-29R commit gate failed: ${
                Object.entries(
                  commitChecks
                )
                  .filter(
                    ([, passed]) =>
                      passed !==
                      true
                  )
                  .map(
                    ([key]) =>
                      key
                  )
                  .join(", ")
              }`
            );
          }

          transaction.set(
            authorizationRef,
            storedAuthorization
          );

          transaction.set(
            approvalRef,
            {
              ...currentApprovalStored,
              executionAuthorizationDigest,
              executionAuthorizationId,
              executionAuthorizationIssued:
                true,
              executionAuthorizationExpiresAtIso:
                authorizationExpiresAtIso,
              updatedAtIso:
                issuedAtIso
            }
          );

          transaction.set(
            context.recoverySessionRef,
            {
              ...recovery,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              executionAuthorizationDigest,
              uidMutationWrites:
                0,
              actualUidCutoverAllowed:
                false,
              updatedAtIso:
                issuedAtIso
            }
          );

          transaction.set(
            context.lockRef,
            {
              ...lock,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              executionAuthorizationDigest,
              uidMutationWrites:
                0,
              actualUidCutoverAllowed:
                false,
              updatedAtIso:
                issuedAtIso
            }
          );

          transaction.set(
            context.maintenanceRef,
            {
              ...maintenance,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              executionAuthorizationDigest,
              uidMutationWrites:
                0,
              actualUidCutoverAllowed:
                false,
              updatedAtIso:
                issuedAtIso
            }
          );
        }
      );

      return publicPhase4c29Authorization(
        storedAuthorization,
        false,
        PHASE4C29_WRITE_OPERATIONS,
        false
      );
    }
  );

export const inspectUidV2CutoverExecutionAuthPhase4c29r =
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
              Phase4c29InspectInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C29_CONTRACT_DIGEST ||
        text(
          input.executionAuthorizationDigest
        ) ===
          ""
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-29R inspect gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const authorizationRef =
        phase4c29AuthorizationRef(
          context
        );

      const approvalRef =
        phase4c28ApprovalRef(
          context
        );

      const [
        authorizationSnapshot,
        approvalSnapshot,
        recoverySnapshot,
        lockSnapshot,
        maintenanceSnapshot
      ] = await Promise.all([
        authorizationRef.get(),
        approvalRef.get(),
        context.recoverySessionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get()
      ]);

      if (
        !authorizationSnapshot.exists ||
        !approvalSnapshot.exists ||
        !recoverySnapshot.exists ||
        !lockSnapshot.exists ||
        !maintenanceSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-29R linked documents are incomplete."
        );
      }

      const storedAuthorization =
        authorizationSnapshot.data() ||
        {};

      const authorizationCore =
        asRecord(
          storedAuthorization.authorizationCore,
          "executionAuthorization.authorizationCore"
        );

      const approvalStored =
        approvalSnapshot.data() ||
        {};

      const recovery =
        recoverySnapshot.data() ||
        {};

      const lock =
        lockSnapshot.data() ||
        {};

      const maintenance =
        maintenanceSnapshot.data() ||
        {};

      const executionAuthorizationDigest =
        text(
          input.executionAuthorizationDigest
        );

      const rollbackChecks =
        asRecord(
          asRecord(
            authorizationCore.rollbackSnapshotVerification,
            "authorization.rollbackSnapshotVerification"
          ).checks,
          "authorization.rollbackSnapshotVerification.checks"
        );

      const stableChecks =
        asRecord(
          asRecord(
            authorizationCore.twoPassLiveRecheck,
            "authorization.twoPassLiveRecheck"
          ).stableChecks,
          "authorization.twoPassLiveRecheck.stableChecks"
        );

      const checks:
        GenericRecord = {
      status:
        text(
          storedAuthorization.status
        ) ===
        "final_execution_authorization_issued_rollback_verified_no_uid_mutation",
      caller:
        text(
          storedAuthorization.approvedByFirebaseUid
        ) ===
        callerUid,
      contract:
        text(
          storedAuthorization.contractDigest
        ) ===
        PHASE4C29_CONTRACT_DIGEST,
      digest:
        text(
          storedAuthorization.executionAuthorizationDigest
        ) ===
          executionAuthorizationDigest &&
        digestValue(
          authorizationCore
        ) ===
          executionAuthorizationDigest,
      authorizationValid:
        parseIsoMillis(
          authorizationCore.authorizationExpiresAtIso,
          "authorization.expiresAtIso"
        ) >
        Date.now(),
      authorizationUnused:
        authorizationCore.authorizationUsed ===
          false &&
        numberValue(
          authorizationCore.authorizationUseCount
        ) ===
          0,
      approvalLink:
        text(
          authorizationCore.quiescenceApprovalDigest
        ) ===
          EXPECTED_QUIESCENCE_APPROVAL_DIGEST &&
        text(
          approvalStored.executionAuthorizationDigest
        ) ===
          executionAuthorizationDigest,
      rollbackVerified:
        authorizationCore.rollbackSnapshotVerificationPassed ===
          true &&
        allTrue(
          rollbackChecks
        ),
      liveStable:
        allTrue(
          stableChecks
        ),
      recovery:
        text(
          recovery.executionAuthorizationDigest
        ) ===
        executionAuthorizationDigest,
      lock:
        text(
          lock.state
        ) ===
          "owned" &&
        text(
          lock.executionAuthorizationDigest
        ) ===
          executionAuthorizationDigest &&
        parseIsoMillis(
          lock.leaseExpiresAtIso,
          "lock.leaseExpiresAtIso"
        ) >
          Date.now(),
      maintenance:
        text(
          maintenance.state
        ) ===
          "active" &&
        text(
          maintenance.executionAuthorizationDigest
        ) ===
          executionAuthorizationDigest,
      noExecution:
        authorizationCore.cutoverExecutionCallableIncluded ===
          false &&
        authorizationCore.authorizationConsumptionCallableIncluded ===
          false &&
        authorizationCore.rollbackMutationCallableIncluded ===
          false &&
        authorizationCore.actualMutationPayloadIncluded ===
          false,
      noMutation:
        numberValue(
          authorizationCore.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          authorizationCore.actualCutoverWrites
        ) ===
          0 &&
        authorizationCore.uidMutationAllowed ===
          false &&
        authorizationCore.actualUidCutoverAllowed ===
          false
      };

      if (!allTrue(
        checks
      )) {
        throw new HttpsError(
          "data-loss",
          `Phase 4C-29R verification failed: ${
            Object.entries(
              checks
            )
              .filter(
                ([, passed]) =>
                  passed !==
                  true
              )
              .map(
                ([key]) =>
                  key
              )
              .join(", ")
          }`
        );
      }

      return publicPhase4c29Authorization(
        storedAuthorization,
        true,
        0,
        true
      );
    }
  );
