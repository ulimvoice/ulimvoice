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


export const UID_V2_CUTOVER_TOPOLOGY_PHASE4C30A_VERSION =
  "2026-07-29.716.86-phase4c30a-production-layout-auth-transition-binding-discovery-only";

const PHASE4C30A_CONTRACT_DIGEST =
  "0cd86c36e2ef0d7bb175caa071948eef150b58be7d01dac30b1a485d66dc1a03";

const PHASE4C30A_APPROVAL_PHRASE =
  "Phase 4C-30A 운영 Collection 레이아웃 및 Firebase Auth 전환 구조 탐색을 승인합니다. 실제 UID 변경과 Cutover는 실행하지 않습니다.";

const EXPECTED_PHASE4C29_CONTRACT_DIGEST =
  "10420b61deacaba064cbfe16871428805c696775fabc0231ffc27d3f52ed723e";

const EXPECTED_EXECUTION_AUTHORIZATION_DIGEST =
  "da8b05b5193414773181ec2ffcd0c8281d27f5f07c69a5c747eee6f2162b0b99";

const EXPECTED_EXECUTION_AUTHORIZATION_ID =
  "phase4c29r-ms4t2y9r-1ae789c95f2bdc8b74377a20";

const EXPECTED_EXECUTION_AUTHORIZATION_EXPIRES_AT_ISO =
  "2026-07-28T15:53:46.815Z";

const PHASE4C30A_DISCOVERY_DOCUMENT =
  "phase4c30a-71686";

const PHASE4C30A_DISCOVERY_VALIDITY_SECONDS =
  3600;

const PHASE4C30A_WRITE_OPERATIONS =
  5;

interface Phase4c30aCaptureInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly approvalPhrase?: unknown;
  readonly executionAuthorizationDigest?: unknown;
  readonly localScanEnvelope?: unknown;
  readonly confirmReadOnlyDiscovery?: unknown;
  readonly confirmAuthorizationRemainsUnused?: unknown;
  readonly confirmNoSheetWrite?: unknown;
  readonly confirmNoFirestoreMutation?: unknown;
  readonly confirmNoFirebaseAuthMutation?: unknown;
}

interface Phase4c30aInspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly topologyDiscoveryDigest?: unknown;
}

function phase4c30aDiscoveryRef(
  context: Context
): DocumentReference<DocumentData> {
  return context.runRef
    .collection(
      "rebaseProductionTopologyDiscoveries"
    )
    .doc(
      PHASE4C30A_DISCOVERY_DOCUMENT
    );
}

function safeLocalScan(
  value: unknown
): GenericRecord {
  const envelope =
    asRecord(
      value,
      "localScanEnvelope"
    );

  const scan =
    asRecord(
      envelope.scan,
      "localScanEnvelope.scan"
    );

  const scanDigest =
    text(
      envelope.scanDigest
    );

  const references =
    asArray(
      scan.collectionReferences,
      "localScan.collectionReferences"
    ).map(
      (item, index) =>
        asRecord(
          item,
          `localScan.collectionReferences[${index}]`
        )
    );

  const authReferences =
    asArray(
      scan.authReferences,
      "localScan.authReferences"
    ).map(
      (item, index) =>
        asRecord(
          item,
          `localScan.authReferences[${index}]`
        )
    );

  const checks:
    GenericRecord = {
  digest:
    scanDigest !==
      "" &&
    digestValue(
      scan
    ) ===
      scanDigest,
  version:
    text(
      scan.version
    ) ===
    "71686",
  fileCount:
    numberValue(
      scan.scannedFileCount
    ) >
    0,
  references:
    references.length >
    0,
  noSecrets:
    scan.secretValuesIncluded ===
    false
  };

  if (!allTrue(
    checks
  )) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-30A local source scan failed: ${
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
    scanDigest,
    projectRootDigest:
      text(
        scan.projectRootDigest
      ),
    scannedFileCount:
      numberValue(
        scan.scannedFileCount
      ),
    collectionReferences:
      references,
    authReferences
  };
}

function sanitizedUserProfile(
  user: UserRecord
): GenericRecord {
  const providers =
    user.providerData
      .map(
        (provider) => ({
          providerId:
            provider.providerId,
          emailPresent:
            !!provider.email,
          phonePresent:
            !!provider.phoneNumber,
          displayNamePresent:
            !!provider.displayName
        })
      )
      .sort(
        (
          left,
          right
        ) =>
          left.providerId.localeCompare(
            right.providerId
          )
      );

  return {
    uidDigest:
      digestValue(
        user.uid
      ),
    disabled:
      user.disabled,
    emailPresent:
      !!user.email,
    phonePresent:
      !!user.phoneNumber,
    displayNamePresent:
      !!user.displayName,
    photoUrlPresent:
      !!user.photoURL,
    providerData:
      providers,
    providerIds:
      providers.map(
        (provider) =>
          provider.providerId
      ),
    customClaimKeys:
      Object.keys(
        user.customClaims ||
        {}
      ).sort(),
    passwordHashIncluded:
      false,
    passwordSaltIncluded:
      false
  };
}

async function rootCollectionTopology(
  context: Context
): Promise<GenericRecord[]> {
  const roots =
    await (
      context.db as unknown as {
        listCollections: () => Promise<
          Array<{
            id: string;
            limit: (
              limit: number
            ) => {
              get: () => Promise<{
                empty: boolean;
                docs: Array<{
                  id: string;
                }>;
              }>;
            };
          }>
        >;
      }
    ).listCollections();

  const sorted =
    [...roots].sort(
      (
        left,
        right
      ) =>
        left.id.localeCompare(
          right.id
        )
    );

  const output:
    GenericRecord[] = [];

  for (
    const collection of
    sorted
  ) {
    const sample =
      await collection
        .limit(1)
        .get();

    output.push({
      collectionId:
        collection.id,
      empty:
        sample.empty,
      sampleDocumentIdDigest:
        sample.empty
          ? ""
          : digestValue(
              sample.docs[0].id
            )
    });
  }

  return output;
}

function publicPhase4c30aDiscovery(
  stored: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean
): GenericRecord {
  const core =
    asRecord(
      stored.discoveryCore,
      "topologyDiscovery.discoveryCore"
    );

  const expiresAtMillis =
    parseIsoMillis(
      core.discoveryExpiresAtIso,
      "topologyDiscovery.discoveryExpiresAtIso"
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
      UID_V2_CUTOVER_TOPOLOGY_PHASE4C30A_VERSION,
    phase:
      "Phase 4C-30A",
    mode:
      "rebase156_production_collection_layout_and_auth_transition_binding_discovery_only_no_uid_mutation_no_cutover",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    status:
      text(
        stored.status
      ),
    contractDigest:
      PHASE4C30A_CONTRACT_DIGEST,
    topologyDiscoveryDigest:
      text(
        stored.topologyDiscoveryDigest
      ),
    topologyDiscoveryCoreDigest:
      digestValue(
        core
      ),
    topologyDiscoveryId:
      core.topologyDiscoveryId,
    discoveryState:
      core.discoveryState,
    discoveryIssuedAtIso:
      core.discoveryIssuedAtIso,
    discoveryExpiresAtIso:
      core.discoveryExpiresAtIso,
    discoverySecondsRemaining:
      secondsRemaining,
    discoveryWithinValidity:
      secondsRemaining >
      0,
    executionAuthorizationDigest:
      core.executionAuthorizationDigest,
    authorizationWasValidAtDiscovery:
      core.authorizationWasValidAtDiscovery,
    authorizationUsed:
      core.authorizationUsed,
    rootCollections:
      core.rootCollections,
    localProjectScan:
      core.localProjectScan,
    stagedFanoutCounts:
      core.stagedFanoutCounts,
    stagedPathPreview:
      core.stagedPathPreview,
    firebaseAuthTransitionProfile:
      core.firebaseAuthTransitionProfile,
    collectionBindingCandidates:
      core.collectionBindingCandidates,
    authTransitionStrategyCandidates:
      core.authTransitionStrategyCandidates,
    blockingReasons:
      core.blockingReasons,
    bindingReady:
      core.bindingReady,
    productionExecutionLockOwned:
      core.productionExecutionLockOwned,
    productionMaintenanceWindowActive:
      core.productionMaintenanceWindowActive,
    uidMutationWrites:
      core.uidMutationWrites,
    actualCutoverWrites:
      core.actualCutoverWrites,
    verified,
    digestMatches:
      verified,
    safety: {
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
      authorizationConsumptionIncluded:
        false,
      cutoverExecutionCallableIncluded:
        false,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        "Phase 4C-30B bound-layout phased production cutover execution with Sheet apply and rollback receipts",
      allowed:
        verified &&
        secondsRemaining >
          0,
      requiresExactDiscoveryDigest:
        true,
      requiresResolvedCollectionLayout:
        true,
      requiresResolvedFirebaseAuthTransitionStrategy:
        true,
      requiresSheetApplyAndRollbackReceiptFunctions:
        true,
      requiresExactUnusedExecutionAuthorizationDigest:
        true,
      uidMutationAllowed:
        false,
      actualUidCutoverAllowed:
        false
    }
  };
}

export const captureUidV2CutoverTopologyPhase4c30a =
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
              Phase4c30aCaptureInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C30A_CONTRACT_DIGEST ||
        text(
          input.approvalPhrase
        ) !==
          PHASE4C30A_APPROVAL_PHRASE ||
        text(
          input.executionAuthorizationDigest
        ) !==
          EXPECTED_EXECUTION_AUTHORIZATION_DIGEST ||
        input.confirmReadOnlyDiscovery !==
          true ||
        input.confirmAuthorizationRemainsUnused !==
          true ||
        input.confirmNoSheetWrite !==
          true ||
        input.confirmNoFirestoreMutation !==
          true ||
        input.confirmNoFirebaseAuthMutation !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-30A discovery gate failed."
        );
      }

      const localScan =
        safeLocalScan(
          input.localScanEnvelope
        );

      const context =
        buildContext(
          callerUid
        );

      const discoveryRef =
        phase4c30aDiscoveryRef(
          context
        );

      const authorizationRef =
        phase4c29AuthorizationRef(
          context
        );

      const existing =
        await discoveryRef.get();

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
            PHASE4C30A_CONTRACT_DIGEST
        ) {
          throw new HttpsError(
            "already-exists",
            "An incompatible Phase 4C-30A discovery exists."
          );
        }

        return publicPhase4c30aDiscovery(
          stored,
          true,
          0,
          false
        );
      }

      const [
        authorizationSnapshot,
        studentSnapshot,
        principalSnapshot,
        studentAliasSnapshot,
        principalAliasSnapshot,
        assignmentSnapshot,
        attendanceSnapshot,
        authTransitionSnapshot,
        roots,
        active
      ] = await Promise.all([
        authorizationRef.get(),
        context.runRef
          .collection(
            "rebaseFanoutStudents"
          )
          .get(),
        context.runRef
          .collection(
            "rebaseFanoutPrincipals"
          )
          .get(),
        context.runRef
          .collection(
            "rebaseFanoutStudentAliases"
          )
          .get(),
        context.runRef
          .collection(
            "rebaseFanoutPrincipalAliases"
          )
          .get(),
        context.runRef
          .collection(
            "rebaseFanoutAssignmentMappings"
          )
          .get(),
        context.runRef
          .collection(
            "rebaseFanoutAttendanceMappings"
          )
          .get(),
        context.runRef
          .collection(
            "rebaseFanoutAuthTransitions"
          )
          .get(),
        rootCollectionTopology(
          context
        ),
        activeDocuments(
          context
        )
      ]);

      if (!authorizationSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-29R authorization is missing."
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

      const authorizationChecks:
        GenericRecord = {
      contract:
        text(
          storedAuthorization.contractDigest
        ) ===
        EXPECTED_PHASE4C29_CONTRACT_DIGEST,
      digest:
        text(
          storedAuthorization.executionAuthorizationDigest
        ) ===
          EXPECTED_EXECUTION_AUTHORIZATION_DIGEST &&
        digestValue(
          authorizationCore
        ) ===
          EXPECTED_EXECUTION_AUTHORIZATION_DIGEST,
      identity:
        text(
          authorizationCore.executionAuthorizationId
        ) ===
          EXPECTED_EXECUTION_AUTHORIZATION_ID &&
        text(
          authorizationCore.authorizationExpiresAtIso
        ) ===
          EXPECTED_EXECUTION_AUTHORIZATION_EXPIRES_AT_ISO,
      valid:
        parseIsoMillis(
          authorizationCore.authorizationExpiresAtIso,
          "executionAuthorization.expiresAtIso"
        ) >
        Date.now(),
      unused:
        authorizationCore.authorizationUsed ===
          false &&
        numberValue(
          authorizationCore.authorizationUseCount
        ) ===
          0,
      rollback:
        authorizationCore.rollbackSnapshotVerificationPassed ===
          true,
      lock:
        text(
          active.lock.state
        ) ===
          "owned",
      maintenance:
        text(
          active.maintenance.state
        ) ===
          "active",
      noMutation:
        numberValue(
          authorizationCore.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          authorizationCore.actualCutoverWrites
        ) ===
          0
      };

      if (!allTrue(
        authorizationChecks
      )) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-30A authorization validation failed: ${
            Object.entries(
              authorizationChecks
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

      const fanoutCounts = {
        students:
          studentSnapshot.size,
        principals:
          principalSnapshot.size,
        studentAliases:
          studentAliasSnapshot.size,
        principalAliases:
          principalAliasSnapshot.size,
        assignmentMappings:
          assignmentSnapshot.size,
        attendanceMappings:
          attendanceSnapshot.size,
        firebaseAuthTransitions:
          authTransitionSnapshot.size
      };

      const countChecks:
        GenericRecord = {
      students:
        fanoutCounts.students ===
        156,
      principals:
        fanoutCounts.principals ===
        12,
      studentAliases:
        fanoutCounts.studentAliases ===
        85,
      principalAliases:
        fanoutCounts.principalAliases ===
        13,
      assignments:
        fanoutCounts.assignmentMappings ===
        14,
      attendance:
        fanoutCounts.attendanceMappings ===
        1,
      auth:
        fanoutCounts.firebaseAuthTransitions ===
        1
      };

      if (!allTrue(
        countChecks
      )) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-30A fan-out counts are incorrect."
        );
      }

      const assignmentPaths =
        assignmentSnapshot.docs
          .map(
            (document) => {
              const documentData =
                document.data() ||
                {};

              const data =
                asRecord(
                  documentData.data,
                  "assignment mapping"
                );

              return {
                oldPath:
                  text(
                    data.oldPath
                  ),
                newPath:
                  text(
                    data.newPath
                  )
              };
            }
          )
          .sort(
            (
              left,
              right
            ) =>
              left.oldPath.localeCompare(
                right.oldPath
              )
          );

      const attendancePaths =
        attendanceSnapshot.docs
          .map(
            (document) => {
              const documentData =
                document.data() ||
                {};

              const data =
                asRecord(
                  documentData.data,
                  "attendance mapping"
                );

              return {
                oldPath:
                  text(
                    data.oldPath
                  ),
                newPath:
                  text(
                    data.newPath
                  ),
                oldStudentUid:
                  text(
                    data.oldStudentUid
                  ),
                newStudentUid:
                  text(
                    data.newStudentUid
                  )
              };
            }
          );

      const transitionDocument =
        authTransitionSnapshot.docs[0];

      if (!transitionDocument) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-30A Firebase Auth transition mapping is missing."
        );
      }

      const transitionDocumentData =
        transitionDocument.data() ||
        {};

      const transition =
        asRecord(
          transitionDocumentData.data,
          "Firebase Auth transition"
        );

      const oldFirebaseUid =
        text(
          transition.oldFirebaseUid
        );

      const newFirebaseUid =
        text(
          transition.newFirebaseUid
        );

      const auth =
        getAuth(
          defaultAdminApp()
        );

      const oldUser =
        await auth.getUser(
          oldFirebaseUid
        );

      let targetExists =
        false;

      try {
        await auth.getUser(
          newFirebaseUid
        );

        targetExists =
          true;
      }
      catch (error) {
        const code =
          text(
            (
              error as {
                code?: unknown;
              }
            ).code
          );

        if (
          code !==
          "auth/user-not-found"
        ) {
          throw error;
        }
      }

      const collectionReferences =
        asArray(
          localScan.collectionReferences,
          "localScan.collectionReferences"
        ) as
          GenericRecord[];

      const referencedCollections =
        Array.from(
          new Set(
            collectionReferences
              .map(
                (item) =>
                  text(
                    item.collectionId
                  )
              )
              .filter(Boolean)
          )
        ).sort();

      const registryCandidates =
        referencedCollections.filter(
          (collectionId) =>
            /uid|identity|registry|alias/i.test(
              collectionId
            )
        );

      const authReferences =
        asArray(
          localScan.authReferences,
          "localScan.authReferences"
        ) as
          GenericRecord[];

      const authSymbols =
        Array.from(
          new Set(
            authReferences
              .map(
                (item) =>
                  text(
                    item.symbol
                  )
              )
              .filter(Boolean)
          )
        ).sort();

      const providerIds =
        oldUser.providerData
          .map(
            (provider) =>
              provider.providerId
          )
          .sort();

      const passwordProvider =
        providerIds.includes(
          "password"
        );

      const customTokenEvidence =
        authSymbols.some(
          (symbol) =>
            /signInWithCustomToken|createCustomToken/i.test(
              symbol
            )
        );

      const blockingReasons:
        string[] = [];

      if (
        registryCandidates.length <
        4
      ) {
        blockingReasons.push(
          "PRODUCTION_UID_REGISTRY_COLLECTIONS_NOT_EXACTLY_BOUND"
        );
      }

      if (targetExists) {
        blockingReasons.push(
          "TARGET_FIREBASE_AUTH_USER_ALREADY_EXISTS"
        );
      }

      if (
        passwordProvider &&
        !customTokenEvidence
      ) {
        blockingReasons.push(
          "PASSWORD_PROVIDER_TRANSITION_REQUIRES_EXPLICIT_LOGIN_BRIDGE_STRATEGY"
        );
      }

      const strategyCandidates:
        GenericRecord[] = [];

      if (customTokenEvidence) {
        strategyCandidates.push({
          strategy:
            "create_target_auth_and_custom_token_bridge",
          sourceEvidence:
            true,
          passwordMaterialRequired:
            false
        });
      }

      if (passwordProvider) {
        strategyCandidates.push({
          strategy:
            "firebase_auth_export_import_with_hash_configuration",
          sourceEvidence:
            false,
          passwordMaterialRequired:
            true,
          blockedByCurrentSafetyContract:
            true
        });
      }

      strategyCandidates.push({
        strategy:
          "preserve_old_auth_uid_and_bind_principal_uid_v2_claim",
        sourceEvidence:
          authSymbols.some(
            (symbol) =>
              /customClaims|setCustomUserClaims/i.test(
                symbol
              )
          ),
        passwordMaterialRequired:
          false
      });

      const issuedAtIso =
        new Date().toISOString();

      const discoveryExpiresAtIso =
        addSecondsIso(
          Date.parse(
            issuedAtIso
          ),
          PHASE4C30A_DISCOVERY_VALIDITY_SECONDS
        );

      const leaseExpiresAtIso =
        addSecondsIso(
          Date.parse(
            issuedAtIso
          ),
          7200
        );

      const topologyDiscoveryId =
        [
          "phase4c30a",
          Date.now().toString(36),
          randomBytes(12).toString("hex")
        ].join("-");

      const discoveryCore:
        GenericRecord = {
      version:
        UID_V2_CUTOVER_TOPOLOGY_PHASE4C30A_VERSION,
      phase:
        "Phase 4C-30A",
      mode:
        "rebase156_production_collection_layout_and_auth_transition_binding_discovery_only_no_uid_mutation_no_cutover",
      requestId:
        REQUEST_ID,
      contractDigest:
        PHASE4C30A_CONTRACT_DIGEST,
      topologyDiscoveryId,
      discoveryState:
        "captured_waiting_exact_layout_and_auth_strategy_binding",
      discoveryIssuedAtIso:
        issuedAtIso,
      discoveryExpiresAtIso,
      discoveryValiditySeconds:
        PHASE4C30A_DISCOVERY_VALIDITY_SECONDS,
      executionAuthorizationDigest:
        EXPECTED_EXECUTION_AUTHORIZATION_DIGEST,
      executionAuthorizationId:
        EXPECTED_EXECUTION_AUTHORIZATION_ID,
      authorizationWasValidAtDiscovery:
        true,
      authorizationUsed:
        false,
      authorizationUseCount:
        0,
      rootCollections:
        roots,
      localProjectScan:
        localScan,
      stagedFanoutCounts:
        fanoutCounts,
      stagedPathPreview: {
        assignmentMappings:
          assignmentPaths,
        attendanceMappings:
          attendancePaths
      },
      firebaseAuthTransitionProfile: {
        oldFirebaseUid,
        newFirebaseUid,
        oldUser:
          sanitizedUserProfile(
            oldUser
          ),
        targetExists,
        transitionRole:
          text(
            transition.role
          ),
        transitionAction:
          text(
            transition.action
          )
      },
      collectionBindingCandidates: {
        referencedCollections,
        registryCandidates
      },
      authTransitionStrategyCandidates:
        strategyCandidates,
      blockingReasons,
      bindingReady:
        blockingReasons.length ===
        0,
      productionExecutionLockOwned:
        true,
      productionMaintenanceWindowActive:
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
      actualCutoverWrites:
        0,
      actualUidCutoverAllowed:
        false
      };

      const topologyDiscoveryDigest =
        digestValue(
          discoveryCore
        );

      const stored:
        GenericRecord = {
      version:
        UID_V2_CUTOVER_TOPOLOGY_PHASE4C30A_VERSION,
      phase:
        "Phase 4C-30A",
      mode:
        "rebase156_production_collection_layout_and_auth_transition_binding_discovery_only_no_uid_mutation_no_cutover",
      requestId:
        REQUEST_ID,
      contractDigest:
        PHASE4C30A_CONTRACT_DIGEST,
      approvedByFirebaseUid:
        callerUid,
      topologyDiscoveryDigest,
      discoveryCore,
      status:
        "production_topology_and_auth_transition_discovery_captured_no_uid_mutation",
      createdAtIso:
        issuedAtIso
      };

      await context.db.runTransaction(
        async (transaction) => {
          const [
            currentDiscovery,
            currentAuthorization,
            currentRecovery,
            currentLock,
            currentMaintenance
          ] = await Promise.all([
            transaction.get(
              discoveryRef
            ),
            transaction.get(
              authorizationRef
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

          if (currentDiscovery.exists) {
            throw new HttpsError(
              "already-exists",
              "Phase 4C-30A create-only destination exists."
            );
          }

          if (
            !currentAuthorization.exists ||
            !currentRecovery.exists ||
            !currentLock.exists ||
            !currentMaintenance.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-30A active documents disappeared before commit."
            );
          }

          const currentAuthorizationStored =
            currentAuthorization.data() ||
            {};

          const currentAuthorizationCore =
            asRecord(
              currentAuthorizationStored.authorizationCore,
              "current.authorizationCore"
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
          authorization:
            text(
              currentAuthorizationStored.executionAuthorizationDigest
            ) ===
              EXPECTED_EXECUTION_AUTHORIZATION_DIGEST &&
            digestValue(
              currentAuthorizationCore
            ) ===
              EXPECTED_EXECUTION_AUTHORIZATION_DIGEST,
          valid:
            parseIsoMillis(
              currentAuthorizationCore.authorizationExpiresAtIso,
              "current.authorizationExpiresAtIso"
            ) >
            Date.now(),
          unused:
            currentAuthorizationCore.authorizationUsed ===
              false &&
            numberValue(
              currentAuthorizationCore.authorizationUseCount
            ) ===
              0,
          lock:
            text(
              lock.state
            ) ===
            "owned",
          maintenance:
            text(
              maintenance.state
            ) ===
            "active",
          lease:
            parseIsoMillis(
              lock.leaseExpiresAtIso,
              "lock.leaseExpiresAtIso"
            ) >
            Date.now()
          };

          if (!allTrue(
            commitChecks
          )) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-30A commit gate failed."
            );
          }

          transaction.set(
            discoveryRef,
            stored
          );

          transaction.set(
            authorizationRef,
            {
              ...currentAuthorizationStored,
              topologyDiscoveryDigest,
              topologyDiscoveryId,
              topologyDiscoveryExpiresAtIso:
                discoveryExpiresAtIso,
              authorizationUsed:
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
              topologyDiscoveryDigest,
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
              topologyDiscoveryDigest,
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
              topologyDiscoveryDigest,
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

      return publicPhase4c30aDiscovery(
        stored,
        false,
        PHASE4C30A_WRITE_OPERATIONS,
        false
      );
    }
  );

export const inspectUidV2CutoverTopologyPhase4c30a =
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
              Phase4c30aInspectInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C30A_CONTRACT_DIGEST ||
        text(
          input.topologyDiscoveryDigest
        ) ===
          ""
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-30A inspect gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const discoveryRef =
        phase4c30aDiscoveryRef(
          context
        );

      const authorizationRef =
        phase4c29AuthorizationRef(
          context
        );

      const [
        discoverySnapshot,
        authorizationSnapshot,
        recoverySnapshot,
        lockSnapshot,
        maintenanceSnapshot
      ] = await Promise.all([
        discoveryRef.get(),
        authorizationRef.get(),
        context.recoverySessionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get()
      ]);

      if (
        !discoverySnapshot.exists ||
        !authorizationSnapshot.exists ||
        !recoverySnapshot.exists ||
        !lockSnapshot.exists ||
        !maintenanceSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-30A linked documents are incomplete."
        );
      }

      const stored =
        discoverySnapshot.data() ||
        {};

      const core =
        asRecord(
          stored.discoveryCore,
          "topologyDiscovery.discoveryCore"
        );

      const authorizationStored =
        authorizationSnapshot.data() ||
        {};

      const authorizationCore =
        asRecord(
          authorizationStored.authorizationCore,
          "authorization.authorizationCore"
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

      const expectedDigest =
        text(
          input.topologyDiscoveryDigest
        );

      const checks:
        GenericRecord = {
      caller:
        text(
          stored.approvedByFirebaseUid
        ) ===
        callerUid,
      contract:
        text(
          stored.contractDigest
        ) ===
        PHASE4C30A_CONTRACT_DIGEST,
      digest:
        text(
          stored.topologyDiscoveryDigest
        ) ===
          expectedDigest &&
        digestValue(
          core
        ) ===
          expectedDigest,
      discoveryValid:
        parseIsoMillis(
          core.discoveryExpiresAtIso,
          "discovery.expiresAtIso"
        ) >
        Date.now(),
      authorization:
        text(
          authorizationStored.executionAuthorizationDigest
        ) ===
          EXPECTED_EXECUTION_AUTHORIZATION_DIGEST &&
        digestValue(
          authorizationCore
        ) ===
          EXPECTED_EXECUTION_AUTHORIZATION_DIGEST,
      authorizationUnused:
        authorizationCore.authorizationUsed ===
          false &&
        numberValue(
          authorizationCore.authorizationUseCount
        ) ===
          0,
      linked:
        text(
          authorizationStored.topologyDiscoveryDigest
        ) ===
          expectedDigest &&
        text(
          recovery.topologyDiscoveryDigest
        ) ===
          expectedDigest,
      lock:
        text(
          lock.state
        ) ===
          "owned" &&
        text(
          lock.topologyDiscoveryDigest
        ) ===
          expectedDigest &&
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
          maintenance.topologyDiscoveryDigest
        ) ===
          expectedDigest,
      counts:
        numberValue(
          asRecord(
            core.stagedFanoutCounts,
            "discovery.stagedFanoutCounts"
          ).students
        ) ===
          156 &&
        numberValue(
          asRecord(
            core.stagedFanoutCounts,
            "discovery.stagedFanoutCounts"
          ).principals
        ) ===
          12,
      noMutation:
        numberValue(
          core.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          core.actualCutoverWrites
        ) ===
          0 &&
        core.actualUidCutoverAllowed ===
          false
      };

      if (!allTrue(
        checks
      )) {
        throw new HttpsError(
          "data-loss",
          `Phase 4C-30A verification failed: ${
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

      return publicPhase4c30aDiscovery(
        stored,
        true,
        0,
        true
      );
    }
  );


export const UID_V2_EXECUTION_AUTH_REFRESH_PHASE4C29R_VERSION =
  "2026-07-29.716.87-phase4c29r-execution-authorization-refresh-bound-topology-only";

const PHASE4C29_REFRESH_CONTRACT_DIGEST =
  "d57675093df09aa2e9887bb130b663173b436a807c14e4224355ae5d65ab238d";

const PHASE4C29_REFRESH_APPROVAL_PHRASE =
  "Phase 4C-29R 실행 권한 갱신을 승인합니다. 4C-30A Discovery를 결합하고 실제 UID 변경과 Cutover는 이번 단계에서 실행하지 않습니다.";

const EXPECTED_PHASE4C30A_CONTRACT_DIGEST =
  "0cd86c36e2ef0d7bb175caa071948eef150b58be7d01dac30b1a485d66dc1a03";

const EXPECTED_TOPOLOGY_DISCOVERY_DIGEST =
  "b0e8cbe9be7190e9708998b9d39101f8fe07e853afb8dca31f8b4d49b8cae3ee";

const EXPECTED_TOPOLOGY_DISCOVERY_ID =
  "phase4c30a-ms4u0vga-56963b91859ad596b38a646a";

const EXPECTED_TOPOLOGY_DISCOVERY_EXPIRES_AT_ISO =
  "2026-07-28T16:50:09.465Z";

const EXPECTED_OLD_AUTH_CONTRACT_DIGEST =
  "10420b61deacaba064cbfe16871428805c696775fabc0231ffc27d3f52ed723e";

const EXPECTED_OLD_AUTHORIZATION_DIGEST =
  "da8b05b5193414773181ec2ffcd0c8281d27f5f07c69a5c747eee6f2162b0b99";

const EXPECTED_OLD_AUTHORIZATION_ID =
  "phase4c29r-ms4t2y9r-1ae789c95f2bdc8b74377a20";

const PHASE4C29_REFRESH_DOCUMENT =
  "phase4c29r-refresh-71687";

const PHASE4C29_REFRESH_VALIDITY_SECONDS =
  1800;

const PHASE4C29_REFRESH_LIVE_SETTLE_MILLISECONDS =
  5000;

const PHASE4C29_REFRESH_WRITE_OPERATIONS =
  5;

interface Phase4c29RefreshInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly approvalPhrase?: unknown;
  readonly topologyDiscoveryDigest?: unknown;
  readonly sheetEnvelope?: unknown;
  readonly confirmDiscoveryValid?: unknown;
  readonly confirmBindingReady?: unknown;
  readonly confirmOldAuthorizationUnused?: unknown;
  readonly confirmNoUidMutation?: unknown;
  readonly confirmAuthorizationOnly?: unknown;
}

interface Phase4c29RefreshInspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly refreshAuthorizationDigest?: unknown;
}

function phase4c29RefreshAuthorizationRef(
  context: Context
): DocumentReference<DocumentData> {
  return context.runRef
    .collection(
      "rebaseFinalExecutionAuthorizationRefreshes"
    )
    .doc(
      PHASE4C29_REFRESH_DOCUMENT
    );
}

function validatePhase4c29RefreshSheetEnvelope(
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
      "Phase 4C-29R Refresh Sheet wrapper digest mismatch."
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
      "Phase 4C-29R Refresh nested Sheet digest mismatch."
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
    UID_V2_EXECUTION_AUTH_REFRESH_PHASE4C29R_VERSION,
  phase:
    text(
      wrapper.phase
    ) ===
    "Phase 4C-29R Refresh",
  request:
    text(
      wrapper.requestId
    ) ===
    REQUEST_ID,
  contract:
    text(
      wrapper.contractDigest
    ) ===
    PHASE4C29_REFRESH_CONTRACT_DIGEST,
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
      `Phase 4C-29R Refresh Fresh Sheet validation failed: ${
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

function publicPhase4c29RefreshAuthorization(
  stored: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean
): GenericRecord {
  const core =
    asRecord(
      stored.authorizationCore,
      "refreshAuthorization.authorizationCore"
    );

  const expiresAtMillis =
    parseIsoMillis(
      core.authorizationExpiresAtIso,
      "refreshAuthorization.expiresAtIso"
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
      UID_V2_EXECUTION_AUTH_REFRESH_PHASE4C29R_VERSION,
    phase:
      "Phase 4C-29R Refresh",
    mode:
      "rebase156_execution_authorization_refresh_bound_to_phase4c30a_discovery_no_uid_mutation_no_cutover",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    status:
      text(
        stored.status
      ),
    contractDigest:
      PHASE4C29_REFRESH_CONTRACT_DIGEST,
    refreshAuthorizationDigest:
      text(
        stored.refreshAuthorizationDigest
      ),
    refreshAuthorizationCoreDigest:
      digestValue(
        core
      ),
    refreshAuthorizationId:
      core.refreshAuthorizationId,
    authorizationState:
      core.authorizationState,
    authorizationIssuedAtIso:
      core.authorizationIssuedAtIso,
    authorizationExpiresAtIso:
      core.authorizationExpiresAtIso,
    authorizationSecondsRemaining:
      secondsRemaining,
    authorizationWithinValidity:
      secondsRemaining >
      0,
    authorizationUsed:
      core.authorizationUsed,
    topologyDiscoveryDigest:
      core.topologyDiscoveryDigest,
    discoveryWasValidAtRefresh:
      core.discoveryWasValidAtRefresh,
    bindingReady:
      core.bindingReady,
    oldAuthorizationDigest:
      core.oldAuthorizationDigest,
    oldAuthorizationUsed:
      core.oldAuthorizationUsed,
    rollbackSnapshotVerification:
      core.rollbackSnapshotVerification,
    twoPassLiveRecheck:
      core.twoPassLiveRecheck,
    productionExecutionLockOwned:
      core.productionExecutionLockOwned,
    productionMaintenanceWindowActive:
      core.productionMaintenanceWindowActive,
    cutoverExecutionCallableIncluded:
      core.cutoverExecutionCallableIncluded,
    uidMutationWrites:
      core.uidMutationWrites,
    actualCutoverWrites:
      core.actualCutoverWrites,
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
        "Phase 4C-30B bound-layout phased production cutover execution with Sheet apply and rollback receipts",
      allowed:
        verified &&
        secondsRemaining >
          0 &&
        core.authorizationUsed ===
          false &&
        core.bindingReady ===
          true &&
        core.rollbackSnapshotVerificationPassed ===
          true,
      requiresExactRefreshAuthorizationDigest:
        true,
      requiresExactDiscoveryDigest:
        true,
      requiresFinalDestructiveApprovalPhrase:
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

export const refreshUidV2CutoverExecutionAuthPhase4c29r =
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
              Phase4c29RefreshInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C29_REFRESH_CONTRACT_DIGEST ||
        text(
          input.approvalPhrase
        ) !==
          PHASE4C29_REFRESH_APPROVAL_PHRASE ||
        text(
          input.topologyDiscoveryDigest
        ) !==
          EXPECTED_TOPOLOGY_DISCOVERY_DIGEST ||
        input.confirmDiscoveryValid !==
          true ||
        input.confirmBindingReady !==
          true ||
        input.confirmOldAuthorizationUnused !==
          true ||
        input.confirmNoUidMutation !==
          true ||
        input.confirmAuthorizationOnly !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-29R Refresh gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const refreshRef =
        phase4c29RefreshAuthorizationRef(
          context
        );

      const discoveryRef =
        phase4c30aDiscoveryRef(
          context
        );

      const oldAuthorizationRef =
        phase4c29AuthorizationRef(
          context
        );

      const existing =
        await refreshRef.get();

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
            PHASE4C29_REFRESH_CONTRACT_DIGEST
        ) {
          throw new HttpsError(
            "already-exists",
            "An incompatible Phase 4C-29R Refresh authorization exists."
          );
        }

        return publicPhase4c29RefreshAuthorization(
          stored,
          true,
          0,
          false
        );
      }

      const [
        discoverySnapshot,
        oldAuthorizationSnapshot
      ] = await Promise.all([
        discoveryRef.get(),
        oldAuthorizationRef.get()
      ]);

      if (
        !discoverySnapshot.exists ||
        !oldAuthorizationSnapshot.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-29R Refresh prerequisite documents are incomplete."
        );
      }

      const storedDiscovery =
        discoverySnapshot.data() ||
        {};

      const discoveryCore =
        asRecord(
          storedDiscovery.discoveryCore,
          "topologyDiscovery.discoveryCore"
        );

      const storedOldAuthorization =
        oldAuthorizationSnapshot.data() ||
        {};

      const oldAuthorizationCore =
        asRecord(
          storedOldAuthorization.authorizationCore,
          "oldAuthorization.authorizationCore"
        );

      const prechecks:
        GenericRecord = {
      discoveryContract:
        text(
          storedDiscovery.contractDigest
        ) ===
        EXPECTED_PHASE4C30A_CONTRACT_DIGEST,
      discoveryDigest:
        text(
          storedDiscovery.topologyDiscoveryDigest
        ) ===
          EXPECTED_TOPOLOGY_DISCOVERY_DIGEST &&
        digestValue(
          discoveryCore
        ) ===
          EXPECTED_TOPOLOGY_DISCOVERY_DIGEST,
      discoveryIdentity:
        text(
          discoveryCore.topologyDiscoveryId
        ) ===
          EXPECTED_TOPOLOGY_DISCOVERY_ID &&
        text(
          discoveryCore.discoveryExpiresAtIso
        ) ===
          EXPECTED_TOPOLOGY_DISCOVERY_EXPIRES_AT_ISO,
      discoveryValid:
        parseIsoMillis(
          discoveryCore.discoveryExpiresAtIso,
          "discovery.expiresAtIso"
        ) >
        Date.now(),
      bindingReady:
        discoveryCore.bindingReady ===
          true &&
        asArray(
          discoveryCore.blockingReasons,
          "discovery.blockingReasons"
        ).length ===
          0,
      oldAuthContract:
        text(
          storedOldAuthorization.contractDigest
        ) ===
        EXPECTED_OLD_AUTH_CONTRACT_DIGEST,
      oldAuthDigest:
        text(
          storedOldAuthorization.executionAuthorizationDigest
        ) ===
          EXPECTED_OLD_AUTHORIZATION_DIGEST &&
        digestValue(
          oldAuthorizationCore
        ) ===
          EXPECTED_OLD_AUTHORIZATION_DIGEST,
      oldAuthIdentity:
        text(
          oldAuthorizationCore.executionAuthorizationId
        ) ===
        EXPECTED_OLD_AUTHORIZATION_ID,
      oldAuthUnused:
        oldAuthorizationCore.authorizationUsed ===
          false &&
        numberValue(
          oldAuthorizationCore.authorizationUseCount
        ) ===
          0,
      noMutation:
        numberValue(
          discoveryCore.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          discoveryCore.actualCutoverWrites
        ) ===
          0 &&
        numberValue(
          oldAuthorizationCore.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          oldAuthorizationCore.actualCutoverWrites
        ) ===
          0
      };

      if (!allTrue(
        prechecks
      )) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-29R Refresh prerequisite validation failed: ${
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
        validatePhase4c29RefreshSheetEnvelope(
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
        PHASE4C29_REFRESH_LIVE_SETTLE_MILLISECONDS
      );

      const [
        activeB,
        liveB,
        discoverySnapshotB,
        oldAuthorizationSnapshotB
      ] = await Promise.all([
        activeDocuments(
          context
        ),
        liveRecheck(
          context,
          baseline.payload,
          sheet
        ),
        discoveryRef.get(),
        oldAuthorizationRef.get()
      ]);

      if (
        !discoverySnapshotB.exists ||
        !oldAuthorizationSnapshotB.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-29R Refresh documents disappeared during stability check."
        );
      }

      const discoveryStoredB =
        discoverySnapshotB.data() ||
        {};

      const discoveryCoreB =
        asRecord(
          discoveryStoredB.discoveryCore,
          "topologyDiscoveryB.discoveryCore"
        );

      const oldAuthorizationStoredB =
        oldAuthorizationSnapshotB.data() ||
        {};

      const oldAuthorizationCoreB =
        asRecord(
          oldAuthorizationStoredB.authorizationCore,
          "oldAuthorizationB.authorizationCore"
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
      discoveryStable:
        text(
          discoveryStoredB.topologyDiscoveryDigest
        ) ===
          EXPECTED_TOPOLOGY_DISCOVERY_DIGEST &&
        digestValue(
          discoveryCoreB
        ) ===
          EXPECTED_TOPOLOGY_DISCOVERY_DIGEST,
      discoveryStillValid:
        parseIsoMillis(
          discoveryCoreB.discoveryExpiresAtIso,
          "discoveryB.expiresAtIso"
        ) >
        Date.now(),
      bindingStillReady:
        discoveryCoreB.bindingReady ===
          true &&
        asArray(
          discoveryCoreB.blockingReasons,
          "discoveryB.blockingReasons"
        ).length ===
          0,
      oldAuthorizationStillUnused:
        text(
          oldAuthorizationStoredB.executionAuthorizationDigest
        ) ===
          EXPECTED_OLD_AUTHORIZATION_DIGEST &&
        digestValue(
          oldAuthorizationCoreB
        ) ===
          EXPECTED_OLD_AUTHORIZATION_DIGEST &&
        oldAuthorizationCoreB.authorizationUsed ===
          false &&
        numberValue(
          oldAuthorizationCoreB.authorizationUseCount
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
          `Phase 4C-29R Refresh stability validation failed: ${
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
          PHASE4C29_REFRESH_VALIDITY_SECONDS
        );

      const leaseExpiresAtIso =
        addSecondsIso(
          Date.parse(
            issuedAtIso
          ),
          7200
        );

      const refreshAuthorizationId =
        [
          "phase4c29r-refresh",
          Date.now().toString(36),
          randomBytes(12).toString("hex")
        ].join("-");

      const authorizationCore:
        GenericRecord = {
      version:
        UID_V2_EXECUTION_AUTH_REFRESH_PHASE4C29R_VERSION,
      phase:
        "Phase 4C-29R Refresh",
      mode:
        "rebase156_execution_authorization_refresh_bound_to_phase4c30a_discovery_no_uid_mutation_no_cutover",
      requestId:
        REQUEST_ID,
      contractDigest:
        PHASE4C29_REFRESH_CONTRACT_DIGEST,
      refreshAuthorizationId,
      authorizationState:
        "refreshed_authorized_waiting_bound_layout_cutover_execution",
      authorizationIssuedAtIso:
        issuedAtIso,
      authorizationExpiresAtIso,
      authorizationValiditySeconds:
        PHASE4C29_REFRESH_VALIDITY_SECONDS,
      authorizationUsed:
        false,
      authorizationUseCount:
        0,
      approvedByFirebaseUidDigest:
        digestValue(
          callerUid
        ),
      topologyDiscoveryDigest:
        EXPECTED_TOPOLOGY_DISCOVERY_DIGEST,
      topologyDiscoveryId:
        EXPECTED_TOPOLOGY_DISCOVERY_ID,
      discoveryWasValidAtRefresh:
        true,
      bindingReady:
        true,
      blockingReasons:
        [],
      oldAuthorizationDigest:
        EXPECTED_OLD_AUTHORIZATION_DIGEST,
      oldAuthorizationId:
        EXPECTED_OLD_AUTHORIZATION_ID,
      oldAuthorizationUsed:
        false,
      oldAuthorizationUseCount:
        0,
      sheetCaptureDigest:
        sheet.wrapperDigest,
      rollbackSnapshotVerification:
        rollbackVerification,
      rollbackSnapshotVerificationPassed:
        true,
      twoPassLiveRecheck: {
        settleMilliseconds:
          PHASE4C29_REFRESH_LIVE_SETTLE_MILLISECONDS,
        first:
          liveA,
        second:
          liveB,
        stableChecks
      },
      productionExecutionLockOwned:
        true,
      productionMaintenanceWindowActive:
        true,
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
        false
      };

      const refreshAuthorizationDigest =
        digestValue(
          authorizationCore
        );

      const stored:
        GenericRecord = {
      version:
        UID_V2_EXECUTION_AUTH_REFRESH_PHASE4C29R_VERSION,
      phase:
        "Phase 4C-29R Refresh",
      mode:
        "rebase156_execution_authorization_refresh_bound_to_phase4c30a_discovery_no_uid_mutation_no_cutover",
      requestId:
        REQUEST_ID,
      contractDigest:
        PHASE4C29_REFRESH_CONTRACT_DIGEST,
      approvedByFirebaseUid:
        callerUid,
      refreshAuthorizationDigest,
      authorizationCore,
      status:
        "execution_authorization_refreshed_bound_to_topology_no_uid_mutation",
      createdAtIso:
        issuedAtIso
      };

      await context.db.runTransaction(
        async (transaction) => {
          const [
            currentRefresh,
            currentDiscovery,
            currentOldAuthorization,
            currentRecovery,
            currentLock,
            currentMaintenance
          ] = await Promise.all([
            transaction.get(
              refreshRef
            ),
            transaction.get(
              discoveryRef
            ),
            transaction.get(
              oldAuthorizationRef
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

          if (currentRefresh.exists) {
            throw new HttpsError(
              "already-exists",
              "Phase 4C-29R Refresh create-only destination exists."
            );
          }

          if (
            !currentDiscovery.exists ||
            !currentOldAuthorization.exists ||
            !currentRecovery.exists ||
            !currentLock.exists ||
            !currentMaintenance.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-29R Refresh active documents disappeared before commit."
            );
          }

          const currentDiscoveryStored =
            currentDiscovery.data() ||
            {};

          const currentDiscoveryCore =
            asRecord(
              currentDiscoveryStored.discoveryCore,
              "current.discoveryCore"
            );

          const currentOldAuthorizationStored =
            currentOldAuthorization.data() ||
            {};

          const currentOldAuthorizationCore =
            asRecord(
              currentOldAuthorizationStored.authorizationCore,
              "current.oldAuthorizationCore"
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
          discovery:
            text(
              currentDiscoveryStored.topologyDiscoveryDigest
            ) ===
              EXPECTED_TOPOLOGY_DISCOVERY_DIGEST &&
            digestValue(
              currentDiscoveryCore
            ) ===
              EXPECTED_TOPOLOGY_DISCOVERY_DIGEST,
          discoveryValid:
            parseIsoMillis(
              currentDiscoveryCore.discoveryExpiresAtIso,
              "current.discoveryExpiresAtIso"
            ) >
            Date.now(),
          bindingReady:
            currentDiscoveryCore.bindingReady ===
            true,
          oldAuthorizationUnused:
            text(
              currentOldAuthorizationStored.executionAuthorizationDigest
            ) ===
              EXPECTED_OLD_AUTHORIZATION_DIGEST &&
            digestValue(
              currentOldAuthorizationCore
            ) ===
              EXPECTED_OLD_AUTHORIZATION_DIGEST &&
            currentOldAuthorizationCore.authorizationUsed ===
              false &&
            numberValue(
              currentOldAuthorizationCore.authorizationUseCount
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
              "Phase 4C-29R Refresh commit gate failed."
            );
          }

          transaction.set(
            refreshRef,
            stored
          );

          transaction.set(
            discoveryRef,
            {
              ...currentDiscoveryStored,
              refreshAuthorizationDigest,
              refreshAuthorizationId,
              refreshAuthorizationExpiresAtIso:
                authorizationExpiresAtIso,
              authorizationUsed:
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
              refreshAuthorizationDigest,
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
              refreshAuthorizationDigest,
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
              refreshAuthorizationDigest,
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

      return publicPhase4c29RefreshAuthorization(
        stored,
        false,
        PHASE4C29_REFRESH_WRITE_OPERATIONS,
        false
      );
    }
  );

export const inspectUidV2CutoverExecutionAuthRefreshPhase4c29r =
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
              Phase4c29RefreshInspectInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C29_REFRESH_CONTRACT_DIGEST ||
        text(
          input.refreshAuthorizationDigest
        ) ===
          ""
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-29R Refresh inspect gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const refreshRef =
        phase4c29RefreshAuthorizationRef(
          context
        );

      const discoveryRef =
        phase4c30aDiscoveryRef(
          context
        );

      const [
        refreshSnapshot,
        discoverySnapshot,
        recoverySnapshot,
        lockSnapshot,
        maintenanceSnapshot
      ] = await Promise.all([
        refreshRef.get(),
        discoveryRef.get(),
        context.recoverySessionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get()
      ]);

      if (
        !refreshSnapshot.exists ||
        !discoverySnapshot.exists ||
        !recoverySnapshot.exists ||
        !lockSnapshot.exists ||
        !maintenanceSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-29R Refresh linked documents are incomplete."
        );
      }

      const stored =
        refreshSnapshot.data() ||
        {};

      const core =
        asRecord(
          stored.authorizationCore,
          "refreshAuthorization.authorizationCore"
        );

      const discoveryStored =
        discoverySnapshot.data() ||
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

      const expectedDigest =
        text(
          input.refreshAuthorizationDigest
        );

      const rollbackChecks =
        asRecord(
          asRecord(
            core.rollbackSnapshotVerification,
            "refreshAuthorization.rollbackSnapshotVerification"
          ).checks,
          "refreshAuthorization.rollbackSnapshotVerification.checks"
        );

      const stableChecks =
        asRecord(
          asRecord(
            core.twoPassLiveRecheck,
            "refreshAuthorization.twoPassLiveRecheck"
          ).stableChecks,
          "refreshAuthorization.twoPassLiveRecheck.stableChecks"
        );

      const checks:
        GenericRecord = {
      caller:
        text(
          stored.approvedByFirebaseUid
        ) ===
        callerUid,
      contract:
        text(
          stored.contractDigest
        ) ===
        PHASE4C29_REFRESH_CONTRACT_DIGEST,
      digest:
        text(
          stored.refreshAuthorizationDigest
        ) ===
          expectedDigest &&
        digestValue(
          core
        ) ===
          expectedDigest,
      valid:
        parseIsoMillis(
          core.authorizationExpiresAtIso,
          "refreshAuthorization.expiresAtIso"
        ) >
        Date.now(),
      unused:
        core.authorizationUsed ===
          false &&
        numberValue(
          core.authorizationUseCount
        ) ===
          0,
      discovery:
        text(
          core.topologyDiscoveryDigest
        ) ===
          EXPECTED_TOPOLOGY_DISCOVERY_DIGEST &&
        text(
          discoveryStored.refreshAuthorizationDigest
        ) ===
          expectedDigest,
      binding:
        core.bindingReady ===
        true,
      oldAuthorizationUnused:
        core.oldAuthorizationUsed ===
          false &&
        numberValue(
          core.oldAuthorizationUseCount
        ) ===
          0,
      rollback:
        core.rollbackSnapshotVerificationPassed ===
          true &&
        allTrue(
          rollbackChecks
        ),
      live:
        allTrue(
          stableChecks
        ),
      recovery:
        text(
          recovery.refreshAuthorizationDigest
        ) ===
        expectedDigest,
      lock:
        text(
          lock.state
        ) ===
          "owned" &&
        text(
          lock.refreshAuthorizationDigest
        ) ===
          expectedDigest &&
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
          maintenance.refreshAuthorizationDigest
        ) ===
          expectedDigest,
      noExecution:
        core.cutoverExecutionCallableIncluded ===
          false &&
        core.authorizationConsumptionCallableIncluded ===
          false &&
        core.rollbackMutationCallableIncluded ===
          false &&
        core.actualMutationPayloadIncluded ===
          false,
      noMutation:
        numberValue(
          core.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          core.actualCutoverWrites
        ) ===
          0 &&
        core.uidMutationAllowed ===
          false &&
        core.actualUidCutoverAllowed ===
          false
      };

      if (!allTrue(
        checks
      )) {
        throw new HttpsError(
          "data-loss",
          `Phase 4C-29R Refresh verification failed: ${
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

      return publicPhase4c29RefreshAuthorization(
        stored,
        true,
        0,
        true
      );
    }
  );



/**
 * Phase 4C-30B A server receipt hotfix 71691.
 *
 * Phase 4C-19 snapshotDigest includes generatedAtIso and therefore changes
 * between content-identical captures. The validator does not use that
 * time-variant full digest as an equality gate. It still binds every one of
 * the 170 rollback cells, all before/applied state digests, the expected UID
 * sets, and all 12 Principal Auth anchors to the sealed rollback payload.
 */

/**
 * Phase 4C-30B A Assignment Drift serialization hotfix 71694.
 *
 * Firestore native values such as Timestamp and DocumentReference must be
 * serialized on both sides before exact rollback-source comparison.
 */
export const UID_V2_CUTOVER_PHASE4C30B_A_ASSIGNMENT_DRIFT_HOTFIX_VERSION =
  "71694";

export const UID_V2_CUTOVER_PHASE4C30B_A_RECEIPT_HOTFIX_VERSION =
  "71691";

export const UID_V2_CUTOVER_PHASE4C30B_A_VERSION =
  "2026-07-29.716.88-phase4c30b-a-bound-layout-phased-production-cutover-with-receipts";

const PHASE4C30B_A_CONTRACT_DIGEST =
  "67f6f02299f957bc0a0bce71cc5a68601f1ced03ebb3227e1bbba35b3dde5d36";

const PHASE4C30B_A_FINAL_APPROVAL_PHRASE =
  "Phase 4C-30B A 실제 운영 Cutover를 승인합니다. Sheet 170셀, Firestore 350건, 신규 Firebase Auth 생성 및 검증 후 기존 Auth 비활성화를 실행합니다.";

const PHASE4C30B_A_ROLLBACK_APPROVAL_PHRASE =
  "Phase 4C-30B A 운영 Rollback을 승인합니다. 신규 Auth와 Firestore 변경을 역순 복구하고 Sheet Rollback을 요구합니다.";

const EXPECTED_REFRESH_AUTHORIZATION_DIGEST_PHASE4C30B =
  "18e859db3e5d21d9081f0d123e07b015e922e9bf4131d1f26610a55e1afd2c47";

const EXPECTED_REFRESH_AUTHORIZATION_ID_PHASE4C30B =
  "phase4c29r-refresh-ms4ujyrh-a057904d82dbb9821c35d889";

const EXPECTED_TOPOLOGY_DISCOVERY_DIGEST_PHASE4C30B =
  "b0e8cbe9be7190e9708998b9d39101f8fe07e853afb8dca31f8b4d49b8cae3ee";

const EXPECTED_TOPOLOGY_DISCOVERY_ID_PHASE4C30B =
  "phase4c30a-ms4u0vga-56963b91859ad596b38a646a";

const PHASE4C30B_OLD_FIREBASE_UID =
  "legacy:superAdmin:4ab445c8458b4c48da06b780e5beb42fcdea343ab8a4bf0f";

const PHASE4C30B_NEW_FIREBASE_UID =
  "PRN2_01KY8PQY00FHMEBRWGJBR1EQJT";

const PHASE4C30B_EXECUTION_DOCUMENT =
  "phase4c30b-a-71688";

const PHASE4C30B_STUDENT_COLLECTION =
  "students";

const PHASE4C30B_PRINCIPAL_COLLECTION =
  "users";

const PHASE4C30B_ALIAS_COLLECTION =
  "identity_directory";

const PHASE4C30B_METADATA_PATH =
  "uidV2StagingRuns/phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca/rebaseProductionCutoverResults/phase4c30b-a-71688";

const PHASE4C30B_SHEET_RECEIPT_MAX_AGE_SECONDS =
  900;

const PHASE4C30B_FIRESTORE_OPERATIONAL_WRITES =
  350;

type Phase4c30bStagedItem = {
  readonly id: string;
  readonly data: GenericRecord;
  readonly recordDigest: string;
};

type Phase4c30bOperationalPlan = {
  readonly students: Phase4c30bStagedItem[];
  readonly principals: Phase4c30bStagedItem[];
  readonly studentAliases: Phase4c30bStagedItem[];
  readonly principalAliases: Phase4c30bStagedItem[];
  readonly assignments: Array<{
    readonly oldPath: string;
    readonly newPath: string;
    readonly sourceData: GenericRecord;
  }>;
  readonly attendanceClone: {
    readonly oldPath: string;
    readonly newPath: string;
    readonly oldStudentUid: string;
    readonly newStudentUid: string;
    readonly sourceData: GenericRecord;
  };
  readonly inPlacePlans: Array<{
    readonly sourcePath: string;
    readonly beforeData: GenericRecord;
    readonly patch: GenericRecord;
  }>;
  readonly authTransition: GenericRecord;
  readonly metadataRef: DocumentReference<DocumentData>;
};

interface Phase4c30bExecuteInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly approvalPhrase?: unknown;
  readonly refreshAuthorizationDigest?: unknown;
  readonly topologyDiscoveryDigest?: unknown;
  readonly sheetApplyReceiptEnvelope?: unknown;
  readonly confirmOperationalMaintenance?: unknown;
  readonly confirmSheetApplied?: unknown;
  readonly confirmFirestore350?: unknown;
  readonly confirmAuthStrategyA?: unknown;
  readonly confirmReverseRollback?: unknown;
}

interface Phase4c30bFinalizeInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly executionId?: unknown;
  readonly targetLoginReceipt?: unknown;
}

interface Phase4c30bRollbackInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly executionId?: unknown;
  readonly approvalPhrase?: unknown;
}

interface Phase4c30bInspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly executionId?: unknown;
}

function phase4c30bExecutionRef(
  context: Context
): DocumentReference<DocumentData> {
  return context.runRef
    .collection(
      "rebaseProductionCutoverExecutions"
    )
    .doc(
      PHASE4C30B_EXECUTION_DOCUMENT
    );
}

function phase4c30bMetadataRef(
  context: Context
): DocumentReference<DocumentData> {
  return context.db.doc(
    PHASE4C30B_METADATA_PATH
  );
}

function phase4c30bRefreshRef(
  context: Context
): DocumentReference<DocumentData> {
  return phase4c29RefreshAuthorizationRef(
    context
  );
}

function phase4c30bDiscoveryRef(
  context: Context
): DocumentReference<DocumentData> {
  return phase4c30aDiscoveryRef(
    context
  );
}

function phase4c30bDeserialize(
  value: unknown,
  db: Firestore
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      (item) =>
        phase4c30bDeserialize(
          item,
          db
        )
    );
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    const record =
      value as GenericRecord;

    const type =
      text(
        record.__type
      );

    if (
      type ===
      "Timestamp"
    ) {
      return new Timestamp(
        numberValue(
          record.seconds
        ),
        numberValue(
          record.nanoseconds
        )
      );
    }

    if (
      type ===
      "DocumentReference"
    ) {
      const path =
        text(
          record.path
        );

      if (!path) {
        throw new HttpsError(
          "data-loss",
          "Rollback DocumentReference path is blank."
        );
      }

      return db.doc(
        path
      );
    }

    if (
      type ===
      "Bytes"
    ) {
      return Buffer.from(
        text(
          record.base64
        ),
        "base64"
      );
    }

    if (
      type ===
      "GeoPoint"
    ) {
      throw new HttpsError(
        "failed-precondition",
        "GeoPoint rollback requires an explicit production binding."
      );
    }

    const output:
      GenericRecord = {};

    for (
      const [
        key,
        nested
      ] of Object.entries(
        record
      )
    ) {
      output[key] =
        phase4c30bDeserialize(
          nested,
          db
        );
    }

    return output;
  }

  return value;
}

function phase4c30bExactValue(
  value: unknown
): unknown {
  return canonicalize(
    value
  );
}

function phase4c30bStagedItem(
  document:
    DocumentData,
  id: string,
  label: string
): Phase4c30bStagedItem {
  const record =
    asRecord(
      document,
      label
    );

  const data =
    asRecord(
      record.data,
      `${label}.data`
    );

  const recordDigest =
    text(
      record.recordDigest
    );

  if (
    recordDigest ===
      "" ||
    digestValue(
      data
    ) !==
      recordDigest
  ) {
    throw new HttpsError(
      "data-loss",
      `${label} staged digest mismatch.`
    );
  }

  return {
    id,
    data,
    recordDigest
  };
}

async function phase4c30bGetAll(
  db: Firestore,
  refs:
    DocumentReference<DocumentData>[]
): Promise<
  Array<{
    readonly exists: boolean;
    readonly path: string;
    readonly data: GenericRecord;
  }>
> {
  const output:
    Array<{
      readonly exists: boolean;
      readonly path: string;
      readonly data: GenericRecord;
    }> = [];

  for (
    let index = 0;
    index < refs.length;
    index += 100
  ) {
    const snapshots =
      await db.getAll(
        ...refs.slice(
          index,
          index +
          100
        )
      );

    for (
      const snapshot of
      snapshots
    ) {
      output.push({
        exists:
          snapshot.exists,
        path:
          snapshot.ref.path,
        data:
          snapshot.data() ||
          {}
      });
    }
  }

  return output;
}

function phase4c30bApplyDottedPatch(
  source: GenericRecord,
  patch: GenericRecord
): GenericRecord {
  const output =
    structuredClone(
      source
    );

  for (
    const [
      path,
      value
    ] of Object.entries(
      patch
    )
  ) {
    const parts =
      path.split(
        "."
      );

    let cursor:
      GenericRecord = output;

    for (
      let index = 0;
      index <
      parts.length -
      1;
      index +=
      1
    ) {
      const part =
        parts[index];

      if (!part) {
        throw new HttpsError(
          "data-loss",
          `Invalid dotted patch path: ${path}`
        );
      }

      const existing =
        cursor[part];

      if (
        !existing ||
        typeof existing !==
          "object" ||
        Array.isArray(
          existing
        )
      ) {
        cursor[part] =
          {};
      }

      cursor =
        cursor[part] as
          GenericRecord;
    }

    const finalPart =
      parts[
        parts.length -
        1
      ];

    if (!finalPart) {
      throw new HttpsError(
        "data-loss",
        `Invalid dotted patch path: ${path}`
      );
    }

    cursor[finalPart] =
      value;
  }

  return output;
}

function phase4c30bReplaceUid(
  value: unknown,
  oldUid: string,
  newUid: string
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      (item) =>
        phase4c30bReplaceUid(
          item,
          oldUid,
          newUid
        )
    );
  }

  if (
    typeof value ===
      "string"
  ) {
    return value
      .split(
        oldUid
      )
      .join(
        newUid
      );
  }

  if (
    value &&
    typeof value ===
      "object"
  ) {
    const output:
      GenericRecord = {};

    for (
      const [
        key,
        nested
      ] of Object.entries(
        value as
          GenericRecord
      )
    ) {
      output[key] =
        phase4c30bReplaceUid(
          nested,
          oldUid,
          newUid
        );
    }

    return output;
  }

  return value;
}

function phase4c30bTargetBody(
  type: string,
  data: GenericRecord,
  migratedAtIso: string
): GenericRecord {
  return {
    ...data,
    uidV2RecordType:
      type,
    uidV2Active:
      true,
    uidV2CutoverVersion:
      UID_V2_CUTOVER_PHASE4C30B_A_VERSION,
    uidV2CutoverRequestId:
      REQUEST_ID,
    uidV2MigratedAtIso:
      migratedAtIso
  };
}

function phase4c30bValidateSheetReceipt(
  value: unknown,
  studentUids: string[],
  principalUids: string[],
  baselinePayload: GenericRecord
): GenericRecord {
  const envelope =
    asRecord(
      value,
      "sheetApplyReceiptEnvelope"
    );

  const receipt =
    asRecord(
      envelope.receipt,
      "sheetApplyReceiptEnvelope.receipt"
    );

  const receiptDigest =
    text(
      envelope.receiptDigest
    );

  if (
    receiptDigest ===
      "" ||
    digestValue(
      receipt
    ) !==
      receiptDigest
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Phase 4C-30B Sheet Apply Receipt digest mismatch."
    );
  }

  const generatedAtMillis =
    parseIsoMillis(
      receipt.generatedAtIso,
      "sheetApplyReceipt.generatedAtIso"
    );

  const ageSeconds =
    (
      Date.now() -
      generatedAtMillis
    ) /
    1000;

  const baselineSheet =
    asRecord(
      baselinePayload.sheet,
      "rollbackBaseline.sheet"
    );

  const baselineCells =
    asArray(
      baselineSheet.rollbackCells,
      "rollbackBaseline.sheet.rollbackCells"
    ).map(
      (item, index) =>
        asRecord(
          item,
          `rollbackBaseline.sheet.rollbackCell${index}`
        )
    );

  const baselineAnchors =
    asArray(
      baselineSheet.principalAuthColumn9Anchors,
      "rollbackBaseline.sheet.principalAuthColumn9Anchors"
    ).map(
      (item, index) =>
        asRecord(
          item,
          `rollbackBaseline.sheet.principalAuthAnchor${index}`
        )
    );

  const baselineByPatchId =
    new Map<string, GenericRecord>();

  for (
    const cell of
    baselineCells
  ) {
    const patchId =
      text(
        cell.patchId
      );

    if (
      !patchId ||
      baselineByPatchId.has(
        patchId
      )
    ) {
      throw new HttpsError(
        "data-loss",
        `Invalid rollback baseline patch ID: ${patchId}`
      );
    }

    baselineByPatchId.set(
      patchId,
      cell
    );
  }

  const expectedAnchors =
    baselineAnchors
      .map(
        (anchor) => ({
          sheetId:
            numberValue(
              anchor.sheetId
            ),
          sheetName:
            text(
              anchor.sheetName
            ),
          rowNumber:
            numberValue(
              anchor.rowNumber
            ),
          columnNumber:
            numberValue(
              anchor.columnNumber
            ),
          a1:
            text(
              anchor.a1
            ),
          stateDigest:
            text(
              anchor.stateDigest
            )
        })
      )
      .sort(
        (
          left,
          right
        ) =>
          [
            left.sheetId,
            left.rowNumber,
            left.columnNumber
          ].join("|").localeCompare(
            [
              right.sheetId,
              right.rowNumber,
              right.columnNumber
            ].join("|")
          )
      );

  const receiptAnchorsBefore =
    asArray(
      receipt.principalAuthAnchorsBefore,
      "sheetApplyReceipt.principalAuthAnchorsBefore"
    ).map(
      (item, index) =>
        asRecord(
          item,
          `sheetApplyReceipt.principalAuthAnchorBefore${index}`
        )
    );

  const receiptAnchorsAfter =
    asArray(
      receipt.principalAuthAnchorsAfter,
      "sheetApplyReceipt.principalAuthAnchorsAfter"
    ).map(
      (item, index) =>
        asRecord(
          item,
          `sheetApplyReceipt.principalAuthAnchorAfter${index}`
        )
    );

  const patches =
    asArray(
      receipt.patches,
      "sheetApplyReceipt.patches"
    ).map(
      (item, index) =>
        asRecord(
          item,
          `sheetApplyReceipt.patch${index}`
        )
    );

  const seenCoordinates =
    new Set<string>();

  const seenPatchIds =
    new Set<string>();

  const studentTargets:
    string[] = [];

  const principalTargets:
    string[] = [];

  let headerCount =
    0;

  for (
    const patch of
    patches
  ) {
    const patchId =
      text(
        patch.patchId
      );

    const expected =
      baselineByPatchId.get(
        patchId
      );

    if (!expected) {
      throw new HttpsError(
        "failed-precondition",
        `Sheet receipt patch is not in the rollback baseline: ${patchId}`
      );
    }

    const coordinate =
      [
        numberValue(
          patch.sheetId
        ),
        numberValue(
          patch.rowNumber
        ),
        numberValue(
          patch.columnNumber
        )
      ].join("|");

    if (
      seenCoordinates.has(
        coordinate
      ) ||
      seenPatchIds.has(
        patchId
      )
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Duplicate Sheet receipt patch: ${patchId}`
      );
    }

    seenCoordinates.add(
      coordinate
    );

    seenPatchIds.add(
      patchId
    );

    const beforeState =
      asRecord(
        patch.beforeState,
        `sheetApplyReceipt.beforeState.${patchId}`
      );

    const appliedState =
      asRecord(
        patch.appliedState,
        `sheetApplyReceipt.appliedState.${patchId}`
      );

    const targetValue =
      text(
        patch.targetValue
      );

    const patchParts =
      patchId.split("|");

    const expectedTarget =
      patchParts[
        patchParts.length -
        1
      ] ||
      "";

    const exactPatch =
      text(
        patch.entityType
      ) ===
        text(
          expected.entityType
        ) &&
      numberValue(
        patch.sheetId
      ) ===
        numberValue(
          expected.sheetId
        ) &&
      text(
        patch.sheetName
      ) ===
        text(
          expected.sheetName
        ) &&
      numberValue(
        patch.rowNumber
      ) ===
        numberValue(
          expected.rowNumber
        ) &&
      numberValue(
        patch.columnNumber
      ) ===
        numberValue(
          expected.columnNumber
        ) &&
      text(
        patch.a1
      ) ===
        text(
          expected.a1
        ) &&
      targetValue ===
        expectedTarget &&
      text(
        patch.beforeStateDigest
      ) ===
        text(
          expected.beforeStateDigest
        ) &&
      digestValue(
        beforeState
      ) ===
        text(
          expected.beforeStateDigest
        ) &&
      blankCellState(
        beforeState
      ) &&
      text(
        appliedState.rawValue
      ) ===
        targetValue &&
      text(
        appliedState.formula
      ) ===
        "" &&
      text(
        patch.appliedStateDigest
      ) ===
        digestValue(
          appliedState
        );

    if (!exactPatch) {
      throw new HttpsError(
        "failed-precondition",
        `Unsafe or mismatched Sheet Apply Receipt patch: ${patchId}`
      );
    }

    const entityType =
      text(
        patch.entityType
      );

    if (
      entityType ===
      "schema"
    ) {
      headerCount +=
        1;
    }
    else if (
      entityType ===
      "student"
    ) {
      studentTargets.push(
        targetValue
      );
    }
    else if (
      entityType ===
      "principal"
    ) {
      principalTargets.push(
        targetValue
      );
    }
    else {
      throw new HttpsError(
        "failed-precondition",
        `Unexpected Sheet entity type: ${entityType}`
      );
    }
  }

  studentTargets.sort();
  principalTargets.sort();

  const expectedStudents =
    [...studentUids].sort();

  const expectedPrincipals =
    [...principalUids].sort();

  const normalizedBeforeAnchors =
    receiptAnchorsBefore
      .map(
        (anchor) => ({
          sheetId:
            numberValue(
              anchor.sheetId
            ),
          sheetName:
            text(
              anchor.sheetName
            ),
          rowNumber:
            numberValue(
              anchor.rowNumber
            ),
          columnNumber:
            numberValue(
              anchor.columnNumber
            ),
          a1:
            text(
              anchor.a1
            ),
          stateDigest:
            text(
              anchor.stateDigest
            )
        })
      )
      .sort(
        (
          left,
          right
        ) =>
          [
            left.sheetId,
            left.rowNumber,
            left.columnNumber
          ].join("|").localeCompare(
            [
              right.sheetId,
              right.rowNumber,
              right.columnNumber
            ].join("|")
          )
      );

  const normalizedAfterAnchors =
    receiptAnchorsAfter
      .map(
        (anchor) => ({
          sheetId:
            numberValue(
              anchor.sheetId
            ),
          sheetName:
            text(
              anchor.sheetName
            ),
          rowNumber:
            numberValue(
              anchor.rowNumber
            ),
          columnNumber:
            numberValue(
              anchor.columnNumber
            ),
          a1:
            text(
              anchor.a1
            ),
          stateDigest:
            text(
              anchor.stateDigest
            )
        })
      )
      .sort(
        (
          left,
          right
        ) =>
          [
            left.sheetId,
            left.rowNumber,
            left.columnNumber
          ].join("|").localeCompare(
            [
              right.sheetId,
              right.rowNumber,
              right.columnNumber
            ].join("|")
          )
      );

  const checks:
    GenericRecord = {
  version:
    text(
      receipt.version
    ) ===
    UID_V2_CUTOVER_PHASE4C30B_A_VERSION,
  phase:
    text(
      receipt.phase
    ) ===
    "Phase 4C-30B A",
  request:
    text(
      receipt.requestId
    ) ===
    REQUEST_ID,
  contract:
    text(
      receipt.contractDigest
    ) ===
    PHASE4C30B_A_CONTRACT_DIGEST,
  authorization:
    text(
      receipt.refreshAuthorizationDigest
    ) ===
    EXPECTED_REFRESH_AUTHORIZATION_DIGEST_PHASE4C30B,
  discovery:
    text(
      receipt.topologyDiscoveryDigest
    ) ===
    EXPECTED_TOPOLOGY_DISCOVERY_DIGEST_PHASE4C30B,
  baselineEvidence:
    text(
      receipt.freshBaselineSnapshotDigest
    ) !==
      "" &&
    baselineCells.length ===
      170 &&
    baselineAnchors.length ===
      12,
  baselineContentBound:
    seenPatchIds.size ===
      baselineByPatchId.size &&
    exactJson(
      normalizedBeforeAnchors,
      expectedAnchors
    ),
  fresh:
    ageSeconds >=
      0 &&
    ageSeconds <=
      PHASE4C30B_SHEET_RECEIPT_MAX_AGE_SECONDS,
  applied:
    receipt.applied ===
      true &&
    receipt.rolledBack ===
      false,
  counts:
    patches.length ===
      170 &&
    baselineCells.length ===
      170 &&
    seenPatchIds.size ===
      170 &&
    headerCount ===
      2 &&
    studentTargets.length ===
      156 &&
    principalTargets.length ===
      12,
  students:
    exactJson(
      studentTargets,
      expectedStudents
    ),
  principals:
    exactJson(
      principalTargets,
      expectedPrincipals
    ),
  anchorsBefore:
    exactJson(
      normalizedBeforeAnchors,
      expectedAnchors
    ),
  anchorsAfter:
    exactJson(
      normalizedAfterAnchors,
      expectedAnchors
    ),
  anchorDigests:
    text(
      receipt.principalAuthColumn9BeforeDigest
    ) ===
      digestValue(
        normalizedBeforeAnchors
      ) &&
    text(
      receipt.principalAuthColumn9AfterDigest
    ) ===
      digestValue(
        normalizedAfterAnchors
      ) &&
    text(
      receipt.principalAuthColumn9BeforeDigest
    ) ===
      text(
        receipt.principalAuthColumn9AfterDigest
      )
  };

  if (!allTrue(
    checks
  )) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-30B Sheet Apply Receipt validation failed: ${
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
    receiptDigest,
    generatedAtIso:
      text(
        receipt.generatedAtIso
      ),
    spreadsheetIdDigest:
      text(
        receipt.spreadsheetIdDigest
      ),
    freshBaselineSnapshotDigest:
      text(
        receipt.freshBaselineSnapshotDigest
      ),
    patchCount:
      patches.length
  };
}

async function phase4c30bLoadOperationalPlan(
  context: Context,
  baseline: SnapshotBaseline
): Promise<Phase4c30bOperationalPlan> {
  const [
    studentSnapshot,
    principalSnapshot,
    studentAliasSnapshot,
    principalAliasSnapshot,
    assignmentSnapshot,
    attendanceSnapshot,
    authTransitionSnapshot,
    inPlaceSnapshot
  ] = await Promise.all([
    context.runRef
      .collection(
        "rebaseFanoutStudents"
      )
      .get(),
    context.runRef
      .collection(
        "rebaseFanoutPrincipals"
      )
      .get(),
    context.runRef
      .collection(
        "rebaseFanoutStudentAliases"
      )
      .get(),
    context.runRef
      .collection(
        "rebaseFanoutPrincipalAliases"
      )
      .get(),
    context.runRef
      .collection(
        "rebaseFanoutAssignmentMappings"
      )
      .get(),
    context.runRef
      .collection(
        "rebaseFanoutAttendanceMappings"
      )
      .get(),
    context.runRef
      .collection(
        "rebaseFanoutAuthTransitions"
      )
      .get(),
    context.runRef
      .collection(
        "inPlaceAttendancePlans"
      )
      .get()
  ]);

  const students =
    studentSnapshot.docs
      .map(
        (document) =>
          phase4c30bStagedItem(
            document.data() || {},
            document.id,
            "staged student"
          )
      )
      .sort(
        (
          left,
          right
        ) =>
          text(
            left.data.newUid
          ).localeCompare(
            text(
              right.data.newUid
            )
          )
      );

  const principals =
    principalSnapshot.docs
      .map(
        (document) =>
          phase4c30bStagedItem(
            document.data() || {},
            document.id,
            "staged principal"
          )
      )
      .sort(
        (
          left,
          right
        ) =>
          text(
            left.data.newUid
          ).localeCompare(
            text(
              right.data.newUid
            )
          )
      );

  const studentAliases =
    studentAliasSnapshot.docs
      .map(
        (document) =>
          phase4c30bStagedItem(
            document.data() || {},
            document.id,
            "staged student alias"
          )
      );

  const principalAliases =
    principalAliasSnapshot.docs
      .map(
        (document) =>
          phase4c30bStagedItem(
            document.data() || {},
            document.id,
            "staged principal alias"
          )
      );

  if (
    students.length !==
      156 ||
    principals.length !==
      12 ||
    studentAliases.length !==
      85 ||
    principalAliases.length !==
      13 ||
    assignmentSnapshot.size !==
      14 ||
    attendanceSnapshot.size !==
      1 ||
    authTransitionSnapshot.size !==
      1 ||
    inPlaceSnapshot.size !==
      68
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Phase 4C-30B staged operational counts do not match."
    );
  }

  const rollbackAssignments =
    asArray(
      baseline.payload.assignments,
      "rollback assignments"
    ).map(
      (item, index) =>
        asRecord(
          item,
          `rollback assignment ${index}`
        )
    );

  const rollbackAttendance =
    asArray(
      baseline.payload.attendance,
      "rollback attendance"
    ).map(
      (item, index) =>
        asRecord(
          item,
          `rollback attendance ${index}`
        )
    );

  const rollbackAssignmentByPath =
    new Map(
      rollbackAssignments.map(
        (item) => [
          text(
            item.sourcePath
          ) ||
          text(
            item.oldPath
          ),
          item
        ]
      )
    );

  const rollbackAttendanceByPath =
    new Map(
      rollbackAttendance.map(
        (item) => [
          text(
            item.sourcePath
          ) ||
          text(
            item.path
          ),
          item
        ]
      )
    );

  const assignments:
    Array<{
      readonly oldPath: string;
      readonly newPath: string;
      readonly sourceData: GenericRecord;
    }> = [];

  for (
    const document of
    assignmentSnapshot.docs
  ) {
    const staged =
      phase4c30bStagedItem(
        document.data() || {},
        document.id,
        "staged assignment mapping"
      );

    const oldPath =
      text(
        staged.data.oldPath
      );

    const newPath =
      text(
        staged.data.newPath
      );

    const rollback =
      rollbackAssignmentByPath.get(
        oldPath
      );

    if (
      !oldPath ||
      !newPath ||
      !rollback
    ) {
      throw new HttpsError(
        "data-loss",
        `Assignment rollback binding is missing: ${oldPath}`
      );
    }

    const beforeData =
      asRecord(
        rollback.beforeData,
        `assignment rollback beforeData ${oldPath}`
      );

    assignments.push({
      oldPath,
      newPath,
      sourceData:
        phase4c30bDeserialize(
          beforeData,
          context.db
        ) as
          GenericRecord
    });
  }

  const attendanceDocument =
    attendanceSnapshot.docs[0];

  const authDocument =
    authTransitionSnapshot.docs[0];

  if (
    !attendanceDocument ||
    !authDocument
  ) {
    throw new HttpsError(
      "data-loss",
      "Attendance or Firebase Auth transition staging is missing."
    );
  }

  const attendanceStaged =
    phase4c30bStagedItem(
      attendanceDocument.data() || {},
      attendanceDocument.id,
      "staged attendance mapping"
    );

  const oldAttendancePath =
    text(
      attendanceStaged.data.oldPath
    );

  const newAttendancePath =
    text(
      attendanceStaged.data.newPath
    );

  const attendanceRollback =
    rollbackAttendanceByPath.get(
      oldAttendancePath
    );

  if (!attendanceRollback) {
    throw new HttpsError(
      "data-loss",
      "Attendance clone rollback source is missing."
    );
  }

  const attendanceClone = {
    oldPath:
      oldAttendancePath,
    newPath:
      newAttendancePath,
    oldStudentUid:
      text(
        attendanceStaged.data.oldStudentUid
      ),
    newStudentUid:
      text(
        attendanceStaged.data.newStudentUid
      ),
    sourceData:
      phase4c30bDeserialize(
        asRecord(
          attendanceRollback.beforeData,
          "attendance clone rollback beforeData"
        ),
        context.db
      ) as
        GenericRecord
  };

  const inPlaceByPath =
    new Map(
      rollbackAttendance.map(
        (item) => [
          text(
            item.sourcePath
          ) ||
          text(
            item.path
          ),
          item
        ]
      )
    );

  const inPlacePlans:
    Array<{
      readonly sourcePath: string;
      readonly beforeData: GenericRecord;
      readonly patch: GenericRecord;
    }> = [];

  for (
    const document of
    inPlaceSnapshot.docs
  ) {
    const staged =
      asRecord(
        document.data(),
        "staged in-place attendance plan"
      );

    const data =
      asRecord(
        staged.data ||
        staged,
        "staged in-place attendance plan data"
      );

    const sourcePath =
      text(
        data.sourcePath
      );

    const rollback =
      inPlaceByPath.get(
        sourcePath
      );

    if (!rollback) {
      throw new HttpsError(
        "data-loss",
        `In-place attendance rollback source missing: ${sourcePath}`
      );
    }

    const beforeData =
      phase4c30bDeserialize(
        asRecord(
          rollback.beforeData,
          `in-place attendance beforeData ${sourcePath}`
        ),
        context.db
      ) as
        GenericRecord;

    const serializedPatch =
      asRecord(
        data.patch,
        `in-place attendance serialized patch ${sourcePath}`
      );

    if (
      text(
        data.patchDigest
      ) !==
      digestValue(
        serializedPatch
      )
    ) {
      throw new HttpsError(
        "data-loss",
        `In-place attendance patch digest mismatch: ${sourcePath}`
      );
    }

    const patch =
      phase4c30bDeserialize(
        serializedPatch,
        context.db
      ) as
        GenericRecord;

    inPlacePlans.push({
      sourcePath,
      beforeData,
      patch
    });
  }

  const authStaged =
    phase4c30bStagedItem(
      authDocument.data() || {},
      authDocument.id,
      "staged Firebase Auth transition"
    );

  if (
    text(
      authStaged.data.oldFirebaseUid
    ) !==
      PHASE4C30B_OLD_FIREBASE_UID ||
    text(
      authStaged.data.newFirebaseUid
    ) !==
      PHASE4C30B_NEW_FIREBASE_UID ||
    text(
      authStaged.data.action
    ) !==
      "create_new_auth_verify_claims_then_disable_old"
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Phase 4C-30B Firebase Auth transition binding mismatch."
    );
  }

  return {
    students,
    principals,
    studentAliases,
    principalAliases,
    assignments:
      assignments.sort(
        (
          left,
          right
        ) =>
          left.oldPath.localeCompare(
            right.oldPath
          )
      ),
    attendanceClone,
    inPlacePlans:
      inPlacePlans.sort(
        (
          left,
          right
        ) =>
          left.sourcePath.localeCompare(
            right.sourcePath
          )
      ),
    authTransition:
      authStaged.data,
    metadataRef:
      phase4c30bMetadataRef(
        context
      )
  };
}

function phase4c30bOperationalRefs(
  context: Context,
  plan: Phase4c30bOperationalPlan
): DocumentReference<DocumentData>[] {
  const refs:
    DocumentReference<DocumentData>[] = [];

  for (
    const item of
    plan.students
  ) {
    refs.push(
      context.db
        .collection(
          PHASE4C30B_STUDENT_COLLECTION
        )
        .doc(
          text(
            item.data.newUid
          )
        )
    );
  }

  for (
    const item of
    plan.principals
  ) {
    refs.push(
      context.db
        .collection(
          PHASE4C30B_PRINCIPAL_COLLECTION
        )
        .doc(
          text(
            item.data.newUid
          )
        )
    );
  }

  for (
    const item of
    [
      ...plan.studentAliases,
      ...plan.principalAliases
    ]
  ) {
    refs.push(
      context.db
        .collection(
          PHASE4C30B_ALIAS_COLLECTION
        )
        .doc(
          text(
            item.data.oldUid
          )
        )
    );
  }

  for (
    const item of
    plan.assignments
  ) {
    refs.push(
      context.db.doc(
        item.newPath
      )
    );
  }

  refs.push(
    context.db.doc(
      plan.attendanceClone.newPath
    )
  );

  for (
    const item of
    plan.inPlacePlans
  ) {
    refs.push(
      context.db.doc(
        item.sourcePath
      )
    );
  }

  refs.push(
    plan.metadataRef
  );

  return refs;
}

async function phase4c30bAssertPreconditions(
  context: Context,
  plan: Phase4c30bOperationalPlan
): Promise<void> {
  const targetRefs =
    phase4c30bOperationalRefs(
      context,
      plan
    );

  const targetSnapshots =
    await phase4c30bGetAll(
      context.db,
      targetRefs
    );

  if (
    targetRefs.length !==
      PHASE4C30B_FIRESTORE_OPERATIONAL_WRITES ||
    new Set(
      targetRefs.map(
        (reference) =>
          reference.path
      )
    ).size !==
      targetRefs.length
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Phase 4C-30B operational document paths are not unique."
    );
  }

  const absentPrefixCount =
    156 +
    12 +
    85 +
    13 +
    14 +
    1;

  const absentPrefix =
    targetSnapshots.slice(
      0,
      absentPrefixCount
    );

  const inPlaceSnapshots =
    targetSnapshots.slice(
      absentPrefixCount,
      absentPrefixCount +
      68
    );

  const metadataSnapshot =
    targetSnapshots[
      targetSnapshots.length -
      1
    ];

  if (
    absentPrefix.some(
      (snapshot) =>
        snapshot.exists
    ) ||
    !metadataSnapshot ||
    metadataSnapshot.exists
  ) {
    throw new HttpsError(
      "already-exists",
      "A Phase 4C-30B create-only operational target already exists."
    );
  }

  if (
    inPlaceSnapshots.length !==
      68 ||
    inPlaceSnapshots.some(
      (snapshot) =>
        !snapshot.exists
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "An in-place attendance source document is missing."
    );
  }

  for (
    let index = 0;
    index <
    plan.inPlacePlans.length;
    index +=
    1
  ) {
    const snapshot =
      inPlaceSnapshots[index];

    const item =
      plan.inPlacePlans[index];

    if (
      !snapshot ||
      !item ||
      !exactJson(
        phase4c30bExactValue(
          serializeValue(
            snapshot.data
          )
        ),
        phase4c30bExactValue(
          serializeValue(
            item.beforeData
          )
        )
      )
    ) {
      throw new HttpsError(
        "failed-precondition",
        `In-place attendance drift detected: ${item?.sourcePath || index}`
      );
    }
  }

  const sourceRefs = [
    ...plan.assignments.map(
      (item) =>
        context.db.doc(
          item.oldPath
        )
    ),
    context.db.doc(
      plan.attendanceClone.oldPath
    )
  ];

  const sourceSnapshots =
    await phase4c30bGetAll(
      context.db,
      sourceRefs
    );

  if (
    sourceSnapshots.some(
      (snapshot) =>
        !snapshot.exists
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "An Assignment or Attendance clone source is missing."
    );
  }

  for (
    let index = 0;
    index <
    plan.assignments.length;
    index +=
    1
  ) {
    const snapshot =
      sourceSnapshots[index];

    const assignment =
      plan.assignments[index];

    if (
      !snapshot ||
      !assignment ||
      !exactJson(
        phase4c30bExactValue(
          serializeValue(
            snapshot.data
          )
        ),
        phase4c30bExactValue(
          serializeValue(
            assignment.sourceData
          )
        )
      )
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Assignment source drift detected: ${assignment?.oldPath || index}`
      );
    }
  }

  const attendanceSourceSnapshot =
    sourceSnapshots[
      plan.assignments.length
    ];

  if (
    !attendanceSourceSnapshot ||
    !exactJson(
      phase4c30bExactValue(
        serializeValue(
          attendanceSourceSnapshot.data
        )
      ),
      phase4c30bExactValue(
        serializeValue(
          plan.attendanceClone.sourceData
        )
      )
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Attendance clone source drift detected."
    );
  }

  const auth =
    getAuth(
      defaultAdminApp()
    );

  const oldUser =
    await auth.getUser(
      PHASE4C30B_OLD_FIREBASE_UID
    );

  if (
    oldUser.disabled ||
    text(
      oldUser.customClaims?.role
    ) !==
      "superAdmin"
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Legacy superAdmin Firebase Auth source is not active."
    );
  }

  try {
    await auth.getUser(
      PHASE4C30B_NEW_FIREBASE_UID
    );

    throw new HttpsError(
      "already-exists",
      "Target PRN2 Firebase Auth user already exists."
    );
  }
  catch (error) {
    if (
      error instanceof
        HttpsError
    ) {
      throw error;
    }

    const code =
      text(
        (
          error as {
            code?: unknown;
          }
        ).code
      );

    if (
      code !==
      "auth/user-not-found"
    ) {
      throw error;
    }
  }
}

async function phase4c30bCommitFirestore(
  context: Context,
  plan: Phase4c30bOperationalPlan,
  executionId: string,
  sheetReceiptDigest: string
): Promise<void> {
  const batch =
    context.db.batch();

  const migratedAtIso =
    new Date().toISOString();

  let writes =
    0;

  for (
    const item of
    plan.students
  ) {
    const newUid =
      text(
        item.data.newUid
      );

    batch.create(
      context.db
        .collection(
          PHASE4C30B_STUDENT_COLLECTION
        )
        .doc(
          newUid
        ),
      phase4c30bTargetBody(
        "student_registry",
        {
          ...item.data,
          uid:
            newUid,
          studentUid:
            newUid
        },
        migratedAtIso
      )
    );

    writes +=
      1;
  }

  for (
    const item of
    plan.principals
  ) {
    const newUid =
      text(
        item.data.newUid
      );

    batch.create(
      context.db
        .collection(
          PHASE4C30B_PRINCIPAL_COLLECTION
        )
        .doc(
          newUid
        ),
      phase4c30bTargetBody(
        "principal_registry",
        {
          ...item.data,
          uid:
            newUid,
          firebaseAuthUid:
            newUid,
          authVersion:
            "uidv2"
        },
        migratedAtIso
      )
    );

    writes +=
      1;
  }

  for (
    const [
      entityType,
      items
    ] of [
      [
        "student",
        plan.studentAliases
      ],
      [
        "principal",
        plan.principalAliases
      ]
    ] as const
  ) {
    for (
      const item of
      items
    ) {
      const oldUid =
        text(
          item.data.oldUid
        );

      batch.create(
        context.db
          .collection(
            PHASE4C30B_ALIAS_COLLECTION
          )
          .doc(
            oldUid
          ),
        phase4c30bTargetBody(
          `${entityType}_uid_alias`,
          {
            ...item.data,
            aliasUid:
              oldUid,
            canonicalUid:
              text(
                item.data.newUid
              ),
            entityType
          },
          migratedAtIso
        )
      );

      writes +=
        1;
    }
  }

  for (
    const item of
    plan.assignments
  ) {
    batch.create(
      context.db.doc(
        item.newPath
      ),
      {
        ...item.sourceData,
        uidV2MigratedFromPath:
          item.oldPath,
        uidV2CutoverExecutionId:
          executionId,
        uidV2MigratedAtIso:
          migratedAtIso
      }
    );

    writes +=
      1;
  }

  for (
    const item of
    plan.inPlacePlans
  ) {
    batch.update(
      context.db.doc(
        item.sourcePath
      ),
      item.patch as any
    );

    writes +=
      1;
  }

  const attendanceCloneData =
    phase4c30bReplaceUid(
      plan.attendanceClone.sourceData,
      plan.attendanceClone.oldStudentUid,
      plan.attendanceClone.newStudentUid
    ) as
      GenericRecord;

  batch.create(
    context.db.doc(
      plan.attendanceClone.newPath
    ),
    {
      ...attendanceCloneData,
      uidV2MigratedFromPath:
        plan.attendanceClone.oldPath,
      uidV2CutoverExecutionId:
        executionId,
      uidV2MigratedAtIso:
        migratedAtIso
    }
  );

  writes +=
    1;

  batch.create(
    plan.metadataRef,
    {
      version:
        UID_V2_CUTOVER_PHASE4C30B_A_VERSION,
      phase:
        "Phase 4C-30B A",
      requestId:
        REQUEST_ID,
      contractDigest:
        PHASE4C30B_A_CONTRACT_DIGEST,
      executionId,
      refreshAuthorizationDigest:
        EXPECTED_REFRESH_AUTHORIZATION_DIGEST_PHASE4C30B,
      topologyDiscoveryDigest:
        EXPECTED_TOPOLOGY_DISCOVERY_DIGEST_PHASE4C30B,
      sheetApplyReceiptDigest:
        sheetReceiptDigest,
      state:
        "firestore_committed_waiting_target_auth_verification",
      operationalWrites:
        PHASE4C30B_FIRESTORE_OPERATIONAL_WRITES,
      createdAtIso:
        migratedAtIso
    }
  );

  writes +=
    1;

  if (
    writes !==
    PHASE4C30B_FIRESTORE_OPERATIONAL_WRITES
  ) {
    throw new HttpsError(
      "internal",
      `Phase 4C-30B Firestore write count mismatch: ${writes}`
    );
  }

  await batch.commit();
}

async function phase4c30bVerifyFirestore(
  context: Context,
  plan: Phase4c30bOperationalPlan
): Promise<GenericRecord> {
  const refs =
    phase4c30bOperationalRefs(
      context,
      plan
    );

  const snapshots =
    await phase4c30bGetAll(
      context.db,
      refs
    );

  if (
    snapshots.length !==
      PHASE4C30B_FIRESTORE_OPERATIONAL_WRITES ||
    snapshots.some(
      (snapshot) =>
        !snapshot.exists
    )
  ) {
    throw new HttpsError(
      "data-loss",
      "Phase 4C-30B Firestore post-commit target count mismatch."
    );
  }

  const inPlaceStart =
    156 +
    12 +
    85 +
    13 +
    14 +
    1;

  for (
    let index = 0;
    index <
    plan.inPlacePlans.length;
    index +=
    1
  ) {
    const item =
      plan.inPlacePlans[index];

    const snapshot =
      snapshots[
        inPlaceStart +
        index
      ];

    if (
      !item ||
      !snapshot
    ) {
      throw new HttpsError(
        "data-loss",
        "In-place post-commit verification index mismatch."
      );
    }

    const expected =
      phase4c30bApplyDottedPatch(
        item.beforeData,
        item.patch
      );

    if (
      !exactJson(
        phase4c30bExactValue(
          serializeValue(
            snapshot.data
          )
        ),
        phase4c30bExactValue(
          serializeValue(
            expected
          )
        )
      )
    ) {
      throw new HttpsError(
        "data-loss",
        `In-place attendance verification failed: ${item.sourcePath}`
      );
    }
  }

  return {
    verified:
      true,
    documentCount:
      snapshots.length,
    targetDigest:
      digestValue(
        snapshots.map(
          (snapshot) => ({
            path:
              snapshot.path,
            data:
              phase4c30bExactValue(
                snapshot.data
              )
          })
        )
      )
  };
}

async function phase4c30bRollbackFirestore(
  context: Context,
  plan: Phase4c30bOperationalPlan
): Promise<GenericRecord> {
  const batch =
    context.db.batch();

  let writes =
    0;

  for (
    const item of
    plan.students
  ) {
    batch.delete(
      context.db
        .collection(
          PHASE4C30B_STUDENT_COLLECTION
        )
        .doc(
          text(
            item.data.newUid
          )
        )
    );

    writes +=
      1;
  }

  for (
    const item of
    plan.principals
  ) {
    batch.delete(
      context.db
        .collection(
          PHASE4C30B_PRINCIPAL_COLLECTION
        )
        .doc(
          text(
            item.data.newUid
          )
        )
    );

    writes +=
      1;
  }

  for (
    const item of
    [
      ...plan.studentAliases,
      ...plan.principalAliases
    ]
  ) {
    batch.delete(
      context.db
        .collection(
          PHASE4C30B_ALIAS_COLLECTION
        )
        .doc(
          text(
            item.data.oldUid
          )
        )
    );

    writes +=
      1;
  }

  for (
    const item of
    plan.assignments
  ) {
    batch.delete(
      context.db.doc(
        item.newPath
      )
    );

    writes +=
      1;
  }

  for (
    const item of
    plan.inPlacePlans
  ) {
    batch.set(
      context.db.doc(
        item.sourcePath
      ),
      item.beforeData
    );

    writes +=
      1;
  }

  batch.delete(
    context.db.doc(
      plan.attendanceClone.newPath
    )
  );

  writes +=
    1;

  batch.delete(
    plan.metadataRef
  );

  writes +=
    1;

  if (
    writes !==
    PHASE4C30B_FIRESTORE_OPERATIONAL_WRITES
  ) {
    throw new HttpsError(
      "internal",
      `Phase 4C-30B rollback write count mismatch: ${writes}`
    );
  }

  await batch.commit();

  return {
    completed:
      true,
    writeOperations:
      writes
  };
}

async function phase4c30bDeleteTargetAuthIfPresent(): Promise<boolean> {
  const auth =
    getAuth(
      defaultAdminApp()
    );

  try {
    await auth.getUser(
      PHASE4C30B_NEW_FIREBASE_UID
    );

    await auth.deleteUser(
      PHASE4C30B_NEW_FIREBASE_UID
    );

    return true;
  }
  catch (error) {
    const code =
      text(
        (
          error as {
            code?: unknown;
          }
        ).code
      );

    if (
      code ===
      "auth/user-not-found"
    ) {
      return false;
    }

    throw error;
  }
}

async function phase4c30bEnableLegacyAuth(): Promise<boolean> {
  const auth =
    getAuth(
      defaultAdminApp()
    );

  const user =
    await auth.getUser(
      PHASE4C30B_OLD_FIREBASE_UID
    );

  if (!user.disabled) {
    return false;
  }

  await auth.updateUser(
    PHASE4C30B_OLD_FIREBASE_UID,
    {
      disabled:
        false
    }
  );

  return true;
}

function phase4c30bPublicExecution(
  data: GenericRecord,
  includeToken: boolean
): GenericRecord {
  const result:
    GenericRecord = {
    ok:
      data.ok !==
      false,
    version:
      UID_V2_CUTOVER_PHASE4C30B_A_VERSION,
    phase:
      "Phase 4C-30B A",
    mode:
      "rebase156_bound_layout_phased_production_cutover_a_custom_token_bridge_with_reverse_rollback",
    requestId:
      REQUEST_ID,
    status:
      data.status,
    executionId:
      data.executionId,
    state:
      data.state,
    contractDigest:
      PHASE4C30B_A_CONTRACT_DIGEST,
    refreshAuthorizationDigest:
      EXPECTED_REFRESH_AUTHORIZATION_DIGEST_PHASE4C30B,
    topologyDiscoveryDigest:
      EXPECTED_TOPOLOGY_DISCOVERY_DIGEST_PHASE4C30B,
    sheetApplyReceiptDigest:
      data.sheetApplyReceiptDigest,
    firestoreVerification:
      data.firestoreVerification,
    targetFirebaseUid:
      PHASE4C30B_NEW_FIREBASE_UID,
    legacyFirebaseUid:
      PHASE4C30B_OLD_FIREBASE_UID,
    targetAuthCreated:
      data.targetAuthCreated ===
      true,
    targetLoginVerified:
      data.targetLoginVerified ===
      true,
    legacyAuthDisabled:
      data.legacyAuthDisabled ===
      true,
    authorizationConsumed:
      data.authorizationConsumed ===
      true,
    rollbackCompleted:
      data.rollbackCompleted ===
      true,
    sheetRollbackRequired:
      data.sheetRollbackRequired ===
      true,
    operationalWrites:
      data.operationalWrites ||
      {
        sheet:
          170,
        firestore:
          data.firestoreCommitted ===
            true
            ? 350
            : 0,
        firebaseAuth:
          data.targetAuthCreated ===
            true
            ? 1
            : 0
      },
    safety: {
      rawCustomTokenPersisted:
        false,
      sourceAssignmentDocumentsDeleted:
        false,
      sourceAttendanceCloneDocumentDeleted:
        false,
      oldAuthDisabledBeforeTargetLoginVerification:
        false
    }
  };

  if (
    includeToken &&
    text(
      data.customToken
    )
  ) {
    result.customToken =
      data.customToken;
  }

  return result;
}

export const executeUidV2CutoverPhase4c30bA =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        540,
      memory:
        "2GiB",
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

      if (
        callerUid !==
        PHASE4C30B_OLD_FIREBASE_UID
      ) {
        throw new HttpsError(
          "permission-denied",
          "Phase 4C-30B execution must start from the legacy superAdmin session."
        );
      }

      const input =
        request.data &&
        typeof request.data ===
          "object"
          ? request.data as
              Phase4c30bExecuteInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C30B_A_CONTRACT_DIGEST ||
        text(
          input.approvalPhrase
        ) !==
          PHASE4C30B_A_FINAL_APPROVAL_PHRASE ||
        text(
          input.refreshAuthorizationDigest
        ) !==
          EXPECTED_REFRESH_AUTHORIZATION_DIGEST_PHASE4C30B ||
        text(
          input.topologyDiscoveryDigest
        ) !==
          EXPECTED_TOPOLOGY_DISCOVERY_DIGEST_PHASE4C30B ||
        input.confirmOperationalMaintenance !==
          true ||
        input.confirmSheetApplied !==
          true ||
        input.confirmFirestore350 !==
          true ||
        input.confirmAuthStrategyA !==
          true ||
        input.confirmReverseRollback !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-30B final destructive approval gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const executionRef =
        phase4c30bExecutionRef(
          context
        );

      const refreshRef =
        phase4c30bRefreshRef(
          context
        );

      const discoveryRef =
        phase4c30bDiscoveryRef(
          context
        );

      const existing =
        await executionRef.get();

      if (existing.exists) {
        const data =
          existing.data() ||
          {};

        if (
          text(
            data.approvedByFirebaseUid
          ) !==
            callerUid ||
          text(
            data.contractDigest
          ) !==
            PHASE4C30B_A_CONTRACT_DIGEST
        ) {
          throw new HttpsError(
            "already-exists",
            "A conflicting Phase 4C-30B execution exists."
          );
        }

        if (
          text(
            data.state
          ) ===
            "completed"
        ) {
          const recoveryToken =
            await getAuth(
              defaultAdminApp()
            ).createCustomToken(
              PHASE4C30B_NEW_FIREBASE_UID
            );

          return phase4c30bPublicExecution(
            {
              ...data,
              customToken:
                recoveryToken
            },
            true
          );
        }

        if (
          text(
            data.state
          ) ===
            "target_auth_created_waiting_login_verification"
        ) {
          const token =
            await getAuth(
              defaultAdminApp()
            ).createCustomToken(
              PHASE4C30B_NEW_FIREBASE_UID,
              {
                role:
                  "superAdmin",
                principalUidV2:
                  PHASE4C30B_NEW_FIREBASE_UID,
                uidV2CutoverExecutionId:
                  text(
                    data.executionId
                  )
              }
            );

          return phase4c30bPublicExecution(
            {
              ...data,
              customToken:
                token
            },
            true
          );
        }

        return phase4c30bPublicExecution(
          data,
          false
        );
      }

      const [
        refreshSnapshot,
        discoverySnapshot
      ] = await Promise.all([
        refreshRef.get(),
        discoveryRef.get()
      ]);

      if (
        !refreshSnapshot.exists ||
        !discoverySnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-30B authorization or discovery is missing."
        );
      }

      const refreshStored =
        refreshSnapshot.data() ||
        {};

      const refreshCore =
        asRecord(
          refreshStored.authorizationCore,
          "refresh authorization core"
        );

      const discoveryStored =
        discoverySnapshot.data() ||
        {};

      const discoveryCore =
        asRecord(
          discoveryStored.discoveryCore,
          "topology discovery core"
        );

      const refreshConsumption =
        refreshStored.consumption &&
        typeof refreshStored.consumption ===
          "object"
          ? refreshStored.consumption as
              GenericRecord
          : {};

      const active =
        await activeDocuments(
          context
        );

      const prerequisiteChecks:
        GenericRecord = {
      refreshDigest:
        text(
          refreshStored.refreshAuthorizationDigest
        ) ===
          EXPECTED_REFRESH_AUTHORIZATION_DIGEST_PHASE4C30B &&
        digestValue(
          refreshCore
        ) ===
          EXPECTED_REFRESH_AUTHORIZATION_DIGEST_PHASE4C30B,
      refreshIdentity:
        text(
          refreshCore.refreshAuthorizationId
        ) ===
        EXPECTED_REFRESH_AUTHORIZATION_ID_PHASE4C30B,
      refreshUnused:
        refreshCore.authorizationUsed ===
          false &&
        numberValue(
          refreshCore.authorizationUseCount
        ) ===
          0 &&
        refreshConsumption.used !==
          true,
      discoveryDigest:
        text(
          discoveryStored.topologyDiscoveryDigest
        ) ===
          EXPECTED_TOPOLOGY_DISCOVERY_DIGEST_PHASE4C30B &&
        digestValue(
          discoveryCore
        ) ===
          EXPECTED_TOPOLOGY_DISCOVERY_DIGEST_PHASE4C30B,
      discoveryIdentity:
        text(
          discoveryCore.topologyDiscoveryId
        ) ===
        EXPECTED_TOPOLOGY_DISCOVERY_ID_PHASE4C30B,
      binding:
        discoveryCore.bindingReady ===
          true &&
        asArray(
          discoveryCore.blockingReasons,
          "discovery blockingReasons"
        ).length ===
          0,
      lock:
        text(
          active.lock.state
        ) ===
        "owned",
      maintenance:
        text(
          active.maintenance.state
        ) ===
        "active",
      leaseValid:
        parseIsoMillis(
          active.lock.leaseExpiresAtIso,
          "lock.leaseExpiresAtIso"
        ) >
        Date.now(),
      noPriorMutation:
        numberValue(
          active.recovery.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          active.lock.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          active.maintenance.uidMutationWrites
        ) ===
          0
      };

      if (!allTrue(
        prerequisiteChecks
      )) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-30B prerequisite validation failed: ${
            Object.entries(
              prerequisiteChecks
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

      const baseline =
        await loadSnapshotBaseline(
          context
        );

      const plan =
        await phase4c30bLoadOperationalPlan(
          context,
          baseline
        );

      const studentUids =
        plan.students.map(
          (item) =>
            text(
              item.data.newUid
            )
        );

      const principalUids =
        plan.principals.map(
          (item) =>
            text(
              item.data.newUid
            )
        );

      const sheetReceipt =
        phase4c30bValidateSheetReceipt(
          input.sheetApplyReceiptEnvelope,
          studentUids,
          principalUids,
          baseline.payload
        );

      await phase4c30bAssertPreconditions(
        context,
        plan
      );

      const executionId =
        [
          "phase4c30b-a",
          Date.now().toString(36),
          randomBytes(12).toString("hex")
        ].join("-");

      const startedAtIso =
        new Date().toISOString();

      await context.db.runTransaction(
        async (transaction) => {
          const [
            currentExecution,
            currentRefresh,
            currentLock,
            currentMaintenance
          ] = await Promise.all([
            transaction.get(
              executionRef
            ),
            transaction.get(
              refreshRef
            ),
            transaction.get(
              context.lockRef
            ),
            transaction.get(
              context.maintenanceRef
            )
          ]);

          if (currentExecution.exists) {
            throw new HttpsError(
              "already-exists",
              "Phase 4C-30B execution already exists."
            );
          }

          if (
            !currentRefresh.exists ||
            !currentLock.exists ||
            !currentMaintenance.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-30B control documents disappeared."
            );
          }

          const currentRefreshData =
            currentRefresh.data() ||
            {};

          const currentConsumption =
            currentRefreshData.consumption &&
            typeof currentRefreshData.consumption ===
              "object"
              ? currentRefreshData.consumption as
                  GenericRecord
              : {};

          if (
            text(
              currentRefreshData.refreshAuthorizationDigest
            ) !==
              EXPECTED_REFRESH_AUTHORIZATION_DIGEST_PHASE4C30B ||
            currentConsumption.used ===
              true ||
            text(
              (
                currentLock.data() ||
                {}
              ).state
            ) !==
              "owned" ||
            text(
              (
                currentMaintenance.data() ||
                {}
              ).state
            ) !==
              "active" ||
            parseIsoMillis(
              (
                currentLock.data() ||
                {}
              ).leaseExpiresAtIso,
              "transaction.lock.leaseExpiresAtIso"
            ) <=
              Date.now()
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-30B transaction gate failed."
            );
          }

          transaction.create(
            executionRef,
            {
              version:
                UID_V2_CUTOVER_PHASE4C30B_A_VERSION,
              phase:
                "Phase 4C-30B A",
              mode:
                "rebase156_bound_layout_phased_production_cutover_a_custom_token_bridge_with_reverse_rollback",
              requestId:
                REQUEST_ID,
              contractDigest:
                PHASE4C30B_A_CONTRACT_DIGEST,
              executionId,
              approvedByFirebaseUid:
                callerUid,
              state:
                "authorization_consumed_waiting_firestore_commit",
              status:
                "phase4c30b_execution_started",
              refreshAuthorizationDigest:
                EXPECTED_REFRESH_AUTHORIZATION_DIGEST_PHASE4C30B,
              topologyDiscoveryDigest:
                EXPECTED_TOPOLOGY_DISCOVERY_DIGEST_PHASE4C30B,
              sheetApplyReceiptDigest:
                sheetReceipt.receiptDigest,
              authorizationConsumed:
                true,
              firestoreCommitted:
                false,
              targetAuthCreated:
                false,
              targetLoginVerified:
                false,
              legacyAuthDisabled:
                false,
              rollbackCompleted:
                false,
              sheetRollbackRequired:
                false,
              startedAtIso
            }
          );

          transaction.set(
            refreshRef,
            {
              ...currentRefreshData,
              consumption: {
                used:
                  true,
                useCount:
                  1,
                executionId,
                consumedAtIso:
                  startedAtIso,
                contractDigest:
                  PHASE4C30B_A_CONTRACT_DIGEST
              },
              updatedAtIso:
                startedAtIso
            }
          );

          transaction.set(
            context.lockRef,
            {
              ...(
                currentLock.data() ||
                {}
              ),
              cutoverExecutionId:
                executionId,
              cutoverState:
                "executing",
              updatedAtIso:
                startedAtIso
            }
          );

          transaction.set(
            context.maintenanceRef,
            {
              ...(
                currentMaintenance.data() ||
                {}
              ),
              cutoverExecutionId:
                executionId,
              cutoverState:
                "executing",
              updatedAtIso:
                startedAtIso
            }
          );
        }
      );

      let firestoreCommitted =
        false;

      let targetAuthCreated =
        false;

      try {
        await phase4c30bCommitFirestore(
          context,
          plan,
          executionId,
          text(
            sheetReceipt.receiptDigest
          )
        );

        firestoreCommitted =
          true;

        const firestoreVerification =
          await phase4c30bVerifyFirestore(
            context,
            plan
          );

        const auth =
          getAuth(
            defaultAdminApp()
          );

        const oldUser =
          await auth.getUser(
            PHASE4C30B_OLD_FIREBASE_UID
          );

        const claims = {
          ...(
            oldUser.customClaims ||
            {}
          ),
          role:
            "superAdmin",
          authVersion:
            "uidv2",
          principalUidV2:
            PHASE4C30B_NEW_FIREBASE_UID,
          uidV2CutoverExecutionId:
            executionId
        };

        await auth.createUser({
          uid:
            PHASE4C30B_NEW_FIREBASE_UID,
          disabled:
            false
        });

        targetAuthCreated =
          true;

        await auth.setCustomUserClaims(
          PHASE4C30B_NEW_FIREBASE_UID,
          claims
        );

        const customToken =
          await auth.createCustomToken(
            PHASE4C30B_NEW_FIREBASE_UID,
            {
              role:
                "superAdmin",
              authVersion:
                "uidv2",
              principalUidV2:
                PHASE4C30B_NEW_FIREBASE_UID,
              uidV2CutoverExecutionId:
                executionId
            }
          );

        const updated = {
          ...((
            await executionRef.get()
          ).data() ||
          {}),
          ok:
            true,
          executionId,
          state:
            "target_auth_created_waiting_login_verification",
          status:
            "firestore_committed_target_auth_created_waiting_login_verification",
          firestoreCommitted:
            true,
          firestoreVerification,
          targetAuthCreated:
            true,
          targetLoginVerified:
            false,
          legacyAuthDisabled:
            false,
          authorizationConsumed:
            true,
          operationalWrites: {
            sheet:
              170,
            firestore:
              350,
            firebaseAuthCreate:
              1,
            firebaseAuthClaims:
              1,
            firebaseAuthLegacyDisable:
              0
          },
          updatedAtIso:
            new Date().toISOString()
        };

        await executionRef.set(
          updated
        );

        return phase4c30bPublicExecution(
          {
            ...updated,
            customToken
          },
          true
        );
      }
      catch (error) {
        let authRollbackCompleted =
          false;

        let firestoreRollbackCompleted =
          false;

        let rollbackError =
          "";

        try {
          if (
            targetAuthCreated
          ) {
            await phase4c30bDeleteTargetAuthIfPresent();
          }

          authRollbackCompleted =
            true;

          if (
            firestoreCommitted
          ) {
            await phase4c30bRollbackFirestore(
              context,
              plan
            );
          }

          firestoreRollbackCompleted =
            true;
        }
        catch (rollbackFailure) {
          rollbackError =
            rollbackFailure instanceof
              Error
              ? rollbackFailure.message
              : String(
                  rollbackFailure
                );
        }

        const failed = {
          ...((
            await executionRef.get()
          ).data() ||
          {}),
          ok:
            false,
          executionId,
          state:
            rollbackError
              ? "automatic_rollback_failed"
              : "automatic_server_rollback_completed_sheet_rollback_required",
          status:
            "phase4c30b_execution_failed",
          failureMessage:
            error instanceof
              Error
              ? error.message
              : String(
                  error
                ),
          authRollbackCompleted,
          firestoreRollbackCompleted,
          rollbackError,
          firestoreCommitted:
            false,
          targetAuthCreated:
            false,
          targetLoginVerified:
            false,
          legacyAuthDisabled:
            false,
          rollbackCompleted:
            !rollbackError,
          sheetRollbackRequired:
            true,
          updatedAtIso:
            new Date().toISOString()
        };

        await executionRef.set(
          failed
        );

        return phase4c30bPublicExecution(
          failed,
          false
        );
      }
    }
  );

export const finalizeUidV2CutoverPhase4c30bA =
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

      if (
        callerUid !==
        PHASE4C30B_NEW_FIREBASE_UID
      ) {
        throw new HttpsError(
          "permission-denied",
          "Phase 4C-30B finalization requires the verified target PRN2 session."
        );
      }

      const input =
        request.data &&
        typeof request.data ===
          "object"
          ? request.data as
              Phase4c30bFinalizeInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C30B_A_CONTRACT_DIGEST ||
        text(
          input.executionId
        ) ===
          ""
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-30B finalization gate failed."
        );
      }

      const loginReceipt =
        asRecord(
          input.targetLoginReceipt,
          "targetLoginReceipt"
        );

      const executionId =
        text(
          input.executionId
        );

      if (
        text(
          loginReceipt.uid
        ) !==
          PHASE4C30B_NEW_FIREBASE_UID ||
        text(
          loginReceipt.executionId
        ) !==
          executionId ||
        text(
          loginReceipt.role
        ) !==
          "superAdmin" ||
        text(
          loginReceipt.principalUidV2
        ) !==
          PHASE4C30B_NEW_FIREBASE_UID
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Target login receipt is invalid."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const executionRef =
        phase4c30bExecutionRef(
          context
        );

      const snapshot =
        await executionRef.get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-30B execution state is missing."
        );
      }

      const data =
        snapshot.data() ||
        {};

      if (
        text(
          data.executionId
        ) !==
          executionId
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-30B execution ID mismatch."
        );
      }

      if (
        text(
          data.state
        ) ===
          "completed"
      ) {
        const token =
          await getAuth(
            defaultAdminApp()
          ).createCustomToken(
            PHASE4C30B_NEW_FIREBASE_UID
          );

        return {
          ...phase4c30bPublicExecution(
            data,
            false
          ),
          primaryCustomToken:
            token
        };
      }

      if (
        text(
          data.state
        ) !==
          "target_auth_created_waiting_login_verification"
      ) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-30B cannot finalize from state: ${text(data.state)}`
        );
      }

      const auth =
        getAuth(
          defaultAdminApp()
        );

      const targetUser =
        await auth.getUser(
          PHASE4C30B_NEW_FIREBASE_UID
        );

      if (
        targetUser.disabled ||
        text(
          targetUser.customClaims?.role
        ) !==
          "superAdmin" ||
        text(
          targetUser.customClaims?.principalUidV2
        ) !==
          PHASE4C30B_NEW_FIREBASE_UID ||
        text(
          targetUser.customClaims?.uidV2CutoverExecutionId
        ) !==
          executionId
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Target Firebase Auth claims verification failed."
        );
      }

      const primaryCustomToken =
        await auth.createCustomToken(
          PHASE4C30B_NEW_FIREBASE_UID
        );

      const completedAtIso =
        new Date().toISOString();

      const completed = {
        ...data,
        ok:
          true,
        state:
          "completed",
        status:
          "phase4c30b_a_cutover_completed",
        targetLoginVerified:
          true,
        legacyAuthDisabled:
          true,
        rollbackCompleted:
          false,
        sheetRollbackRequired:
          false,
        completedAtIso,
        updatedAtIso:
          completedAtIso,
        operationalWrites: {
          sheet:
            170,
          firestore:
            350,
          firebaseAuthCreate:
            1,
          firebaseAuthClaims:
            1,
          firebaseAuthLegacyDisable:
            1
        }
      };

      let legacyDisabledNow =
        false;

      try {
        await auth.updateUser(
          PHASE4C30B_OLD_FIREBASE_UID,
          {
            disabled:
              true
          }
        );

        legacyDisabledNow =
          true;

        await context.db.runTransaction(
          async (transaction) => {
            const [
              currentExecution,
              currentLock,
              currentMaintenance
            ] = await Promise.all([
              transaction.get(
                executionRef
              ),
              transaction.get(
                context.lockRef
              ),
              transaction.get(
                context.maintenanceRef
              )
            ]);

            if (
              !currentExecution.exists ||
              text(
                (
                  currentExecution.data() ||
                  {}
                ).state
              ) !==
                "target_auth_created_waiting_login_verification"
            ) {
              throw new HttpsError(
                "failed-precondition",
                "Phase 4C-30B execution changed during finalization."
              );
            }

            transaction.set(
              executionRef,
              completed
            );

            transaction.set(
              context.lockRef,
              {
                ...(
                  currentLock.data() ||
                  {}
                ),
                cutoverState:
                  "completed",
                cutoverCompletedAtIso:
                  completedAtIso,
                updatedAtIso:
                  completedAtIso
              }
            );

            transaction.set(
              context.maintenanceRef,
              {
                ...(
                  currentMaintenance.data() ||
                  {}
                ),
                cutoverState:
                  "completed_waiting_explicit_maintenance_release",
                cutoverCompletedAtIso:
                  completedAtIso,
                updatedAtIso:
                  completedAtIso
              }
            );
          }
        );
      }
      catch (error) {
        if (legacyDisabledNow) {
          try {
            await auth.updateUser(
              PHASE4C30B_OLD_FIREBASE_UID,
              {
                disabled:
                  false
              }
            );
          }
          catch {
            // The explicit rollback callable remains available from the target session.
          }
        }

        throw error;
      }

      return {
        ...phase4c30bPublicExecution(
          completed,
          false
        ),
        primaryCustomToken
      };
    }
  );

export const rollbackUidV2CutoverPhase4c30bA =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        540,
      memory:
        "2GiB",
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

      if (
        callerUid !==
          PHASE4C30B_OLD_FIREBASE_UID &&
        callerUid !==
          PHASE4C30B_NEW_FIREBASE_UID
      ) {
        throw new HttpsError(
          "permission-denied",
          "Phase 4C-30B rollback requires the legacy or target superAdmin session."
        );
      }

      const input =
        request.data &&
        typeof request.data ===
          "object"
          ? request.data as
              Phase4c30bRollbackInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C30B_A_CONTRACT_DIGEST ||
        text(
          input.approvalPhrase
        ) !==
          PHASE4C30B_A_ROLLBACK_APPROVAL_PHRASE ||
        text(
          input.executionId
        ) ===
          ""
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-30B rollback gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const executionRef =
        phase4c30bExecutionRef(
          context
        );

      const snapshot =
        await executionRef.get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-30B execution state is missing."
        );
      }

      const data =
        snapshot.data() ||
        {};

      const executionId =
        text(
          input.executionId
        );

      if (
        text(
          data.executionId
        ) !==
          executionId
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-30B rollback execution ID mismatch."
        );
      }

      if (
        text(
          data.state
        ) ===
          "rolled_back"
      ) {
        return phase4c30bPublicExecution(
          data,
          false
        );
      }

      const baseline =
        await loadSnapshotBaseline(
          context
        );

      const plan =
        await phase4c30bLoadOperationalPlan(
          context,
          baseline
        );

      const legacyReEnabled =
        await phase4c30bEnableLegacyAuth();

      const targetDeleted =
        await phase4c30bDeleteTargetAuthIfPresent();

      let firestoreRollback:
        GenericRecord = {
          completed:
            true,
          writeOperations:
            0
        };

      if (
        data.firestoreCommitted ===
          true ||
        text(
          data.state
        ) ===
          "completed"
      ) {
        firestoreRollback =
          await phase4c30bRollbackFirestore(
            context,
            plan
          );
      }

      const rolledBackAtIso =
        new Date().toISOString();

      const rolledBack = {
        ...data,
        ok:
          true,
        state:
          "rolled_back",
        status:
          "phase4c30b_a_server_rollback_completed_sheet_rollback_required",
        targetAuthCreated:
          false,
        targetLoginVerified:
          false,
        legacyAuthDisabled:
          false,
        firestoreCommitted:
          false,
        rollbackCompleted:
          true,
        sheetRollbackRequired:
          true,
        rollback: {
          legacyReEnabled,
          targetDeleted,
          firestoreRollback
        },
        rolledBackAtIso,
        updatedAtIso:
          rolledBackAtIso
      };

      await executionRef.set(
        rolledBack
      );

      return phase4c30bPublicExecution(
        rolledBack,
        false
      );
    }
  );

export const inspectUidV2CutoverPhase4c30bA =
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
              Phase4c30bInspectInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C30B_A_CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-30B inspect gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const executionRef =
        phase4c30bExecutionRef(
          context
        );

      const snapshot =
        await executionRef.get();

      if (!snapshot.exists) {
        return {
          ok:
            true,
          version:
            UID_V2_CUTOVER_PHASE4C30B_A_VERSION,
          phase:
            "Phase 4C-30B A",
          contractDigest:
            PHASE4C30B_A_CONTRACT_DIGEST,
          state:
            "not_started",
          operationalWrites: {
            sheet:
              0,
            firestore:
              0,
            firebaseAuth:
              0
          }
        };
      }

      const data =
        snapshot.data() ||
        {};

      if (
        text(
          input.executionId
        ) &&
        text(
          input.executionId
        ) !==
          text(
            data.executionId
          )
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-30B inspect execution ID mismatch."
        );
      }

      return phase4c30bPublicExecution(
        data,
        false
      );
    }
  );



/**
 * Phase 4C-31A execution-document UID field hotfix 71696.
 *
 * The persisted Phase 4C-30B execution document can omit targetFirebaseUid
 * and legacyFirebaseUid. Missing fields are accepted only because the
 * subsequent Auth/session smoke validates the exact target UID, exact legacy
 * UID, claims, execution ID, and legacy disabled state. A non-empty mismatch
 * still fails.
 */
export const UID_V2_POST_CUTOVER_SMOKE_UID_FIELD_HOTFIX_VERSION =
  "71696";

export const UID_V2_POST_CUTOVER_SMOKE_RELEASE_PHASE4C31_VERSION =
  "2026-07-29.716.95-phase4c31-post-cutover-smoke-and-explicit-maintenance-release";

const PHASE4C31_CONTRACT_DIGEST =
  "e03a1fa7a3da907885634400ca24af7e6874c63156ed64b8996bd5255701d0cb";

const PHASE4C31_EXECUTION_ID =
  "phase4c30b-a-ms4yhg3i-b6b58d155a6b9bfe53bcd12c";

const PHASE4C31_CUTOVER_CONTRACT_DIGEST =
  "67f6f02299f957bc0a0bce71cc5a68601f1ced03ebb3227e1bbba35b3dde5d36";

const PHASE4C31_SHEET_APPLY_RECEIPT_DIGEST =
  "20f8e4c35721104682012da441db9f88d02eff34738adf78b9591217db57d640";

const PHASE4C31_FIRESTORE_TARGET_DIGEST =
  "f676a1e8d8b4d24eb32e9d534b4ae09cf804a36a3cc98e5923b85ca80ff859b4";

const PHASE4C31_TARGET_FIREBASE_UID =
  "PRN2_01KY8PQY00FHMEBRWGJBR1EQJT";

const PHASE4C31_LEGACY_FIREBASE_UID =
  "legacy:superAdmin:4ab445c8458b4c48da06b780e5beb42fcdea343ab8a4bf0f";

const PHASE4C31_RELEASE_PHRASE =
  "Phase 4C-31B 사후 Smoke Test 통과 결과를 확인했으며 운영 유지보수와 Lock 해제를 승인합니다. Rollback Snapshot은 보존합니다.";

const PHASE4C31_SMOKE_DOCUMENT =
  "phase4c31a-71695";

const PHASE4C31_SMOKE_VALIDITY_SECONDS =
  900;

const PHASE4C31_LEASE_EXTENSION_SECONDS =
  1800;

interface Phase4c31SmokeInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly executionId?: unknown;
  readonly sheetReceiptEnvelope?: unknown;
  readonly confirmPrimaryPrn2Session?: unknown;
  readonly confirmAdminUiLoaded?: unknown;
  readonly confirmNoFatalClientErrors?: unknown;
  readonly confirmNoRollbackInvoked?: unknown;
}

interface Phase4c31ReleaseInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly executionId?: unknown;
  readonly smokeDigest?: unknown;
  readonly releasePhrase?: unknown;
  readonly confirmSmokePassed?: unknown;
  readonly confirmTargetSessionActive?: unknown;
  readonly confirmLegacyAuthDisabled?: unknown;
  readonly confirmRollbackSnapshotRetained?: unknown;
  readonly confirmMaintenanceRelease?: unknown;
}

interface Phase4c31InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly executionId?: unknown;
}

function phase4c31SmokeRef(
  context: Context
): DocumentReference<DocumentData> {
  return context.runRef
    .collection(
      "rebasePostCutoverSmokeTests"
    )
    .doc(
      PHASE4C31_SMOKE_DOCUMENT
    );
}

async function phase4c31VerifySourcePreservation(
  context: Context,
  plan: Phase4c30bOperationalPlan
): Promise<GenericRecord> {
  const refs = [
    ...plan.assignments.map(
      (item) =>
        context.db.doc(
          item.oldPath
        )
    ),
    context.db.doc(
      plan.attendanceClone.oldPath
    )
  ];

  const snapshots =
    await phase4c30bGetAll(
      context.db,
      refs
    );

  if (
    snapshots.length !==
      15 ||
    snapshots.some(
      (snapshot) =>
        !snapshot.exists
    )
  ) {
    throw new HttpsError(
      "data-loss",
      "Phase 4C-31 source preservation count mismatch."
    );
  }

  for (
    let index = 0;
    index <
      plan.assignments.length;
    index +=
      1
  ) {
    const snapshot =
      snapshots[index];

    const assignment =
      plan.assignments[index];

    if (
      !snapshot ||
      !assignment ||
      snapshot.path !==
        assignment.oldPath ||
      !exactJson(
        phase4c30bExactValue(
          serializeValue(
            snapshot.data
          )
        ),
        phase4c30bExactValue(
          serializeValue(
            assignment.sourceData
          )
        )
      )
    ) {
      throw new HttpsError(
        "data-loss",
        `Phase 4C-31 Assignment source preservation failed: ${
          assignment?.oldPath ||
          index
        }`
      );
    }
  }

  const attendanceSnapshot =
    snapshots[
      snapshots.length -
      1
    ];

  if (
    !attendanceSnapshot ||
    attendanceSnapshot.path !==
      plan.attendanceClone.oldPath ||
    !exactJson(
      phase4c30bExactValue(
        serializeValue(
          attendanceSnapshot.data
        )
      ),
      phase4c30bExactValue(
        serializeValue(
          plan.attendanceClone.sourceData
        )
      )
    )
  ) {
    throw new HttpsError(
      "data-loss",
      "Phase 4C-31 Attendance clone source preservation failed."
    );
  }

  const normalized =
    snapshots.map(
      (snapshot) => ({
        path:
          snapshot.path,
        data:
          phase4c30bExactValue(
            serializeValue(
              snapshot.data
            )
          )
      })
    );

  return {
    verified:
      true,
    assignmentDocuments:
      14,
    attendanceCloneDocuments:
      1,
    sourceDocumentCount:
      normalized.length,
    sourceDigest:
      digestValue(
        normalized
      )
  };
}

async function phase4c31VerifyAuthAndSession(
  callerUid: string,
  callerToken: GenericRecord,
  executionId: string
): Promise<GenericRecord> {
  const auth =
    getAuth(
      defaultAdminApp()
    );

  const [
    targetUser,
    legacyUser
  ] = await Promise.all([
    auth.getUser(
      PHASE4C31_TARGET_FIREBASE_UID
    ),
    auth.getUser(
      PHASE4C31_LEGACY_FIREBASE_UID
    )
  ]);

  const checks:
    GenericRecord = {
  callerUid:
    callerUid ===
      PHASE4C31_TARGET_FIREBASE_UID,
  callerRole:
    text(
      callerToken.role
    ) ===
      "superAdmin",
  callerPrincipal:
    text(
      callerToken.principalUidV2
    ) ===
      PHASE4C31_TARGET_FIREBASE_UID,
  targetActive:
    targetUser.disabled ===
      false,
  targetRole:
    text(
      targetUser.customClaims?.role
    ) ===
      "superAdmin",
  targetPrincipal:
    text(
      targetUser.customClaims?.principalUidV2
    ) ===
      PHASE4C31_TARGET_FIREBASE_UID,
  targetExecution:
    text(
      targetUser.customClaims?.uidV2CutoverExecutionId
    ) ===
      executionId,
  legacyDisabled:
    legacyUser.disabled ===
      true
  };

  if (!allTrue(
    checks
  )) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-31 Auth/session smoke failed: ${
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
    verified:
      true,
    checks,
    targetFirebaseUid:
      PHASE4C31_TARGET_FIREBASE_UID,
    targetDisabled:
      targetUser.disabled,
    legacyFirebaseUid:
      PHASE4C31_LEGACY_FIREBASE_UID,
    legacyDisabled:
      legacyUser.disabled,
    targetClaimsDigest:
      digestValue(
        targetUser.customClaims ||
        {}
      )
  };
}

function phase4c31ExecutionChecks(
  execution: GenericRecord
): GenericRecord {
  const verification =
    asRecord(
      execution.firestoreVerification,
      "phase4c31.execution.firestoreVerification"
    );

  const writes =
    asRecord(
      execution.operationalWrites,
      "phase4c31.execution.operationalWrites"
    );

  return {
    state:
      text(
        execution.state
      ) ===
        "completed",
    status:
      text(
        execution.status
      ) ===
        "phase4c30b_a_cutover_completed",
    executionId:
      text(
        execution.executionId
      ) ===
        PHASE4C31_EXECUTION_ID,
    contract:
      text(
        execution.contractDigest
      ) ===
        PHASE4C31_CUTOVER_CONTRACT_DIGEST,
    sheetReceipt:
      text(
        execution.sheetApplyReceiptDigest
      ) ===
        PHASE4C31_SHEET_APPLY_RECEIPT_DIGEST,
    firestoreVerified:
      verification.verified ===
        true &&
      numberValue(
        verification.documentCount
      ) ===
        350 &&
      text(
        verification.targetDigest
      ) ===
        PHASE4C31_FIRESTORE_TARGET_DIGEST,
        targetUid:
      text(
        execution.targetFirebaseUid
      ) ===
        "" ||
      text(
        execution.targetFirebaseUid
      ) ===
        PHASE4C31_TARGET_FIREBASE_UID,
    legacyUid:
      text(
        execution.legacyFirebaseUid
      ) ===
        "" ||
      text(
        execution.legacyFirebaseUid
      ) ===
        PHASE4C31_LEGACY_FIREBASE_UID,
    auth:
      execution.targetAuthCreated ===
        true &&
      execution.targetLoginVerified ===
        true &&
      execution.legacyAuthDisabled ===
        true,
    authorization:
      execution.authorizationConsumed ===
        true,
    noRollback:
      execution.rollbackCompleted ===
        false &&
      execution.sheetRollbackRequired ===
        false,
    writes:
      numberValue(
        writes.sheet
      ) ===
        170 &&
      numberValue(
        writes.firestore
      ) ===
        350 &&
      numberValue(
        writes.firebaseAuthCreate
      ) ===
        1 &&
      numberValue(
        writes.firebaseAuthClaims
      ) ===
        1 &&
      numberValue(
        writes.firebaseAuthLegacyDisable
      ) ===
        1
  };
}

function phase4c31PublicSmoke(
  stored: GenericRecord,
  duplicate: boolean,
  writeOperations: number
): GenericRecord {
  const core =
    asRecord(
      stored.smokeCore,
      "phase4c31.smokeCore"
    );

  const expiresAtMillis =
    parseIsoMillis(
      core.smokeExpiresAtIso,
      "phase4c31.smokeExpiresAtIso"
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
      UID_V2_POST_CUTOVER_SMOKE_RELEASE_PHASE4C31_VERSION,
    phase:
      "Phase 4C-31A",
    mode:
      "post_cutover_full_smoke_waiting_explicit_maintenance_release",
    requestId:
      REQUEST_ID,
    contractDigest:
      PHASE4C31_CONTRACT_DIGEST,
    duplicate,
    writeOperations,
    status:
      stored.status,
    state:
      core.state,
    executionId:
      core.executionId,
    smokeDigest:
      stored.smokeDigest,
    smokeIssuedAtIso:
      core.smokeIssuedAtIso,
    smokeExpiresAtIso:
      core.smokeExpiresAtIso,
    smokeSecondsRemaining:
      secondsRemaining,
    smokeWithinValidity:
      secondsRemaining >
      0,
    sheetVerification:
      core.sheetVerification,
    firestoreVerification:
      core.firestoreVerification,
    sourcePreservation:
      core.sourcePreservation,
    authVerification:
      core.authVerification,
    controlVerification:
      core.controlVerification,
    allChecksPassed:
      core.allChecksPassed,
    productionExecutionLockOwned:
      true,
    productionMaintenanceWindowActive:
      true,
    rollbackSnapshotRetained:
      true,
    operationalWrites: {
      sheet:
        0,
      firestore:
        0,
      firebaseAuth:
        0,
      uidMutation:
        0
    },
    nextGate: {
      phase:
        "Phase 4C-31B explicit normal maintenance and lock release",
      allowed:
        core.allChecksPassed ===
          true &&
        secondsRemaining >
          0 &&
        text(
          core.state
        ) ===
          "passed_waiting_explicit_maintenance_release",
      requiresExactSmokeDigest:
        true,
      requiresExplicitReleasePhrase:
        true
    }
  };
}

async function phase4c31InspectState(
  context: Context,
  callerUid: string,
  callerToken: GenericRecord
): Promise<GenericRecord> {
  const smokeRef =
    phase4c31SmokeRef(
      context
    );

  const executionRef =
    phase4c30bExecutionRef(
      context
    );

  const [
    smokeSnapshot,
    executionSnapshot,
    lockSnapshot,
    maintenanceSnapshot,
    recoverySnapshot
  ] = await Promise.all([
    smokeRef.get(),
    executionRef.get(),
    context.lockRef.get(),
    context.maintenanceRef.get(),
    context.recoverySessionRef.get()
  ]);

  const smoke =
    smokeSnapshot.data() ||
    {};

  const smokeCore =
    smokeSnapshot.exists
      ? asRecord(
          smoke.smokeCore,
          "phase4c31.inspect.smokeCore"
        )
      : {};

  const execution =
    executionSnapshot.data() ||
    {};

  const maintenance =
    maintenanceSnapshot.data() ||
    {};

  const recovery =
    recoverySnapshot.data() ||
    {};

  const auth =
    await phase4c31VerifyAuthAndSession(
      callerUid,
      callerToken,
      PHASE4C31_EXECUTION_ID
    );

  const released =
    !lockSnapshot.exists &&
    text(
      maintenance.state
    ) ===
      "inactive" &&
    maintenance.productionExecutionLockOwned ===
      false &&
    maintenance.productionMaintenanceWindowActive ===
      false &&
    execution.maintenanceReleased ===
      true &&
    text(
      smoke.releaseState
    ) ===
      "released" &&
    text(
      recovery.state
    ) ===
      "post_cutover_released";

  return {
    ok:
      true,
    version:
      UID_V2_POST_CUTOVER_SMOKE_RELEASE_PHASE4C31_VERSION,
    phase:
      "Phase 4C-31",
    requestId:
      REQUEST_ID,
    contractDigest:
      PHASE4C31_CONTRACT_DIGEST,
    executionId:
      PHASE4C31_EXECUTION_ID,
    executionState:
      execution.state,
    smokeExists:
      smokeSnapshot.exists,
    smokeState:
      smoke.releaseState ||
      smokeCore.state ||
      "not_started",
    smokeDigest:
      smoke.smokeDigest ||
      "",
    maintenanceState:
      maintenance.state ||
      "missing",
    productionExecutionLockOwned:
      lockSnapshot.exists,
    productionMaintenanceWindowActive:
      text(
        maintenance.state
      ) ===
        "active",
    recoverySessionState:
      recovery.state ||
      "missing",
    targetSessionVerified:
      auth.verified,
    legacyAuthDisabled:
      auth.legacyDisabled,
    rollbackSnapshotRetained:
      true,
    released,
    operationalWrites: {
      sheet:
        0,
      firestore:
        0,
      firebaseAuth:
        0,
      uidMutation:
        0
    }
  };
}

export const runUidV2PostCutoverSmokePhase4c31a =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        540,
      memory:
        "2GiB",
      enforceAppCheck:
        false
    },
    async (request) => {
      const authContext =
        request.auth as
          | {
              uid: string;
              token: GenericRecord;
            }
          | undefined;

      const callerUid =
        requireSuperAdmin(
          authContext
        );

      if (
        callerUid !==
          PHASE4C31_TARGET_FIREBASE_UID
      ) {
        throw new HttpsError(
          "permission-denied",
          "Phase 4C-31 smoke test requires the target PRN2 superAdmin session."
        );
      }

      const input =
        request.data &&
        typeof request.data ===
          "object"
          ? request.data as
              Phase4c31SmokeInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C31_CONTRACT_DIGEST ||
        text(
          input.executionId
        ) !==
          PHASE4C31_EXECUTION_ID ||
        input.confirmPrimaryPrn2Session !==
          true ||
        input.confirmAdminUiLoaded !==
          true ||
        input.confirmNoFatalClientErrors !==
          true ||
        input.confirmNoRollbackInvoked !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-31A smoke test gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const smokeRef =
        phase4c31SmokeRef(
          context
        );

      const executionRef =
        phase4c30bExecutionRef(
          context
        );

      const [
        executionSnapshot,
        lockSnapshot,
        maintenanceSnapshot,
        recoverySnapshot
      ] = await Promise.all([
        executionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get(),
        context.recoverySessionRef.get()
      ]);

      if (
        !executionSnapshot.exists ||
        !lockSnapshot.exists ||
        !maintenanceSnapshot.exists ||
        !recoverySnapshot.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-31A required execution or maintenance documents are missing."
        );
      }

      const execution =
        executionSnapshot.data() ||
        {};

      const lock =
        lockSnapshot.data() ||
        {};

      const maintenance =
        maintenanceSnapshot.data() ||
        {};

      const recovery =
        recoverySnapshot.data() ||
        {};

      const executionChecks =
        phase4c31ExecutionChecks(
          execution
        );

      const controlChecks:
        GenericRecord = {
      lock:
        text(
          lock.state
        ) ===
          "owned" &&
        [
          "completed",
          "post_cutover_smoke_passed_waiting_release"
        ].includes(
          text(
            lock.cutoverState
          )
        ),
      maintenance:
        text(
          maintenance.state
        ) ===
          "active" &&
        [
          "completed_waiting_explicit_maintenance_release",
          "post_cutover_smoke_passed_waiting_release"
        ].includes(
          text(
            maintenance.cutoverState
          )
        ),
      recovery:
        text(
          recovery.snapshotPath
        ) !==
          "" &&
        recovery.productionRollbackSnapshotRetained ===
          true
      };

      if (
        !allTrue(
          executionChecks
        ) ||
        !allTrue(
          controlChecks
        )
      ) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-31A execution/control validation failed: ${
            [
              ...Object.entries(
                executionChecks
              ),
              ...Object.entries(
                controlChecks
              )
            ]
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

      const baseline =
        await loadSnapshotBaseline(
          context
        );

      const plan =
        await phase4c30bLoadOperationalPlan(
          context,
          baseline
        );

      const studentUids =
        plan.students.map(
          (item) =>
            text(
              item.data.newUid
            )
        );

      const principalUids =
        plan.principals.map(
          (item) =>
            text(
              item.data.newUid
            )
        );

      const sheetVerification =
        phase4c30bValidateSheetReceipt(
          input.sheetReceiptEnvelope,
          studentUids,
          principalUids,
          baseline.payload
        );

      const firestoreVerification =
        await phase4c30bVerifyFirestore(
          context,
          plan
        );

      if (
        firestoreVerification.verified !==
          true ||
        numberValue(
          firestoreVerification.documentCount
        ) !==
          350 ||
        text(
          firestoreVerification.targetDigest
        ) !==
          PHASE4C31_FIRESTORE_TARGET_DIGEST
      ) {
        throw new HttpsError(
          "data-loss",
          "Phase 4C-31A Firestore target verification mismatch."
        );
      }

      const sourcePreservation =
        await phase4c31VerifySourcePreservation(
          context,
          plan
        );

      const authVerification =
        await phase4c31VerifyAuthAndSession(
          callerUid,
          authContext?.token ||
          {},
          PHASE4C31_EXECUTION_ID
        );

      const issuedAtIso =
        new Date().toISOString();

      const smokeExpiresAtIso =
        addSecondsIso(
          Date.parse(
            issuedAtIso
          ),
          PHASE4C31_SMOKE_VALIDITY_SECONDS
        );

      const leaseExpiresAtIso =
        addSecondsIso(
          Date.parse(
            issuedAtIso
          ),
          PHASE4C31_LEASE_EXTENSION_SECONDS
        );

      const smokeCore = {
        version:
          UID_V2_POST_CUTOVER_SMOKE_RELEASE_PHASE4C31_VERSION,
        phase:
          "Phase 4C-31A",
        requestId:
          REQUEST_ID,
        contractDigest:
          PHASE4C31_CONTRACT_DIGEST,
        executionId:
          PHASE4C31_EXECUTION_ID,
        state:
          "passed_waiting_explicit_maintenance_release",
        smokeIssuedAtIso:
          issuedAtIso,
        smokeExpiresAtIso,
        sheetVerification,
        firestoreVerification,
        sourcePreservation,
        authVerification,
        controlVerification: {
          checks:
            controlChecks,
          rollbackSnapshotPath:
            recovery.snapshotPath,
          rollbackSnapshotRetained:
            true,
          lockState:
            lock.state,
          maintenanceState:
            maintenance.state
        },
        allChecksPassed:
          true,
        operatorAttestations: {
          primaryPrn2Session:
            true,
          adminUiLoaded:
            true,
          noFatalClientErrors:
            true,
          noRollbackInvoked:
            true
        },
        operationalWrites: {
          sheet:
            0,
          firestore:
            0,
          firebaseAuth:
            0,
          uidMutation:
            0
        }
      };

      const smokeDigest =
        digestValue(
          smokeCore
        );

      await context.db.runTransaction(
        async (transaction) => {
          const [
            currentSmoke,
            currentExecution,
            currentLock,
            currentMaintenance,
            currentRecovery
          ] = await Promise.all([
            transaction.get(
              smokeRef
            ),
            transaction.get(
              executionRef
            ),
            transaction.get(
              context.lockRef
            ),
            transaction.get(
              context.maintenanceRef
            ),
            transaction.get(
              context.recoverySessionRef
            )
          ]);

          if (
            !currentExecution.exists ||
            !currentLock.exists ||
            !currentMaintenance.exists ||
            !currentRecovery.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-31A control documents disappeared."
            );
          }

          const currentSmokeData =
            currentSmoke.data() ||
            {};

          if (
            currentSmoke.exists &&
            text(
              (
                currentSmokeData.smokeCore as
                  GenericRecord
              )?.state
            ) ===
              "released"
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-31 maintenance was already released."
            );
          }

          const currentExecutionData =
            currentExecution.data() ||
            {};

          const currentLockData =
            currentLock.data() ||
            {};

          const currentMaintenanceData =
            currentMaintenance.data() ||
            {};

          const currentRecoveryData =
            currentRecovery.data() ||
            {};

          if (
            !allTrue(
              phase4c31ExecutionChecks(
                currentExecutionData
              )
            ) ||
            text(
              currentLockData.state
            ) !==
              "owned" ||
            text(
              currentMaintenanceData.state
            ) !==
              "active"
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-31A transaction recheck failed."
            );
          }

          transaction.set(
            smokeRef,
            {
              version:
                UID_V2_POST_CUTOVER_SMOKE_RELEASE_PHASE4C31_VERSION,
              phase:
                "Phase 4C-31A",
              requestId:
                REQUEST_ID,
              contractDigest:
                PHASE4C31_CONTRACT_DIGEST,
              status:
                "post_cutover_smoke_passed_waiting_explicit_release",
              approvedByFirebaseUid:
                callerUid,
              smokeDigest,
              smokeCore,
              updatedAtIso:
                issuedAtIso
            }
          );

          transaction.set(
            context.recoverySessionRef,
            {
              ...currentRecoveryData,
              preCutoverApprovedByFirebaseUid:
                currentRecoveryData.preCutoverApprovedByFirebaseUid ||
                currentRecoveryData.approvedByFirebaseUid,
              approvedByFirebaseUid:
                callerUid,
              state:
                "post_cutover_smoke_passed_waiting_release",
              postCutoverExecutionId:
                PHASE4C31_EXECUTION_ID,
              postCutoverSmokeDigest:
                smokeDigest,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              productionRollbackSnapshotRetained:
                true,
              updatedAtIso:
                issuedAtIso
            }
          );

          transaction.set(
            context.lockRef,
            {
              ...currentLockData,
              preCutoverApprovedByFirebaseUid:
                currentLockData.preCutoverApprovedByFirebaseUid ||
                currentLockData.approvedByFirebaseUid,
              approvedByFirebaseUid:
                callerUid,
              cutoverState:
                "post_cutover_smoke_passed_waiting_release",
              postCutoverExecutionId:
                PHASE4C31_EXECUTION_ID,
              postCutoverSmokeDigest:
                smokeDigest,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              updatedAtIso:
                issuedAtIso
            }
          );

          transaction.set(
            context.maintenanceRef,
            {
              ...currentMaintenanceData,
              preCutoverApprovedByFirebaseUid:
                currentMaintenanceData.preCutoverApprovedByFirebaseUid ||
                currentMaintenanceData.approvedByFirebaseUid,
              approvedByFirebaseUid:
                callerUid,
              cutoverState:
                "post_cutover_smoke_passed_waiting_release",
              postCutoverExecutionId:
                PHASE4C31_EXECUTION_ID,
              postCutoverSmokeDigest:
                smokeDigest,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              productionRollbackSnapshotRetained:
                true,
              updatedAtIso:
                issuedAtIso
            }
          );
        }
      );

      return phase4c31PublicSmoke(
        {
          status:
            "post_cutover_smoke_passed_waiting_explicit_release",
          smokeDigest,
          smokeCore
        },
        false,
        4
      );
    }
  );

export const releaseUidV2MaintenancePhase4c31b =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        540,
      memory:
        "2GiB",
      enforceAppCheck:
        false
    },
    async (request) => {
      const authContext =
        request.auth as
          | {
              uid: string;
              token: GenericRecord;
            }
          | undefined;

      const callerUid =
        requireSuperAdmin(
          authContext
        );

      if (
        callerUid !==
          PHASE4C31_TARGET_FIREBASE_UID
      ) {
        throw new HttpsError(
          "permission-denied",
          "Phase 4C-31B release requires the target PRN2 superAdmin session."
        );
      }

      const input =
        request.data &&
        typeof request.data ===
          "object"
          ? request.data as
              Phase4c31ReleaseInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C31_CONTRACT_DIGEST ||
        text(
          input.executionId
        ) !==
          PHASE4C31_EXECUTION_ID ||
        text(
          input.releasePhrase
        ) !==
          PHASE4C31_RELEASE_PHRASE ||
        text(
          input.smokeDigest
        ) ===
          "" ||
        input.confirmSmokePassed !==
          true ||
        input.confirmTargetSessionActive !==
          true ||
        input.confirmLegacyAuthDisabled !==
          true ||
        input.confirmRollbackSnapshotRetained !==
          true ||
        input.confirmMaintenanceRelease !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-31B explicit release gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const smokeRef =
        phase4c31SmokeRef(
          context
        );

      const executionRef =
        phase4c30bExecutionRef(
          context
        );

      const [
        smokeSnapshot,
        executionSnapshot,
        lockSnapshot,
        maintenanceSnapshot,
        recoverySnapshot
      ] = await Promise.all([
        smokeRef.get(),
        executionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get(),
        context.recoverySessionRef.get()
      ]);

      if (
        !smokeSnapshot.exists ||
        !executionSnapshot.exists ||
        !maintenanceSnapshot.exists ||
        !recoverySnapshot.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-31B smoke or control documents are missing."
        );
      }

      const smoke =
        smokeSnapshot.data() ||
        {};

      const smokeCore =
        asRecord(
          smoke.smokeCore,
          "phase4c31.release.smokeCore"
        );

      const execution =
        executionSnapshot.data() ||
        {};

      const maintenance =
        maintenanceSnapshot.data() ||
        {};

      const recovery =
        recoverySnapshot.data() ||
        {};

      if (
        !lockSnapshot.exists &&
        text(
          maintenance.state
        ) ===
          "inactive" &&
        execution.maintenanceReleased ===
          true &&
        text(
          smoke.releaseState
        ) ===
          "released" &&
        text(
          smoke.smokeDigest
        ) ===
          text(
            input.smokeDigest
          ) &&
        digestValue(
          smokeCore
        ) ===
          text(
            input.smokeDigest
          )
      ) {
        return {
          ok:
            true,
          version:
            UID_V2_POST_CUTOVER_SMOKE_RELEASE_PHASE4C31_VERSION,
          phase:
            "Phase 4C-31B",
          requestId:
            REQUEST_ID,
          contractDigest:
            PHASE4C31_CONTRACT_DIGEST,
          executionId:
            PHASE4C31_EXECUTION_ID,
          duplicate:
            true,
          writeOperations:
            0,
          state:
            "released",
          maintenanceState:
            "inactive",
          productionExecutionLockOwned:
            false,
          productionMaintenanceWindowActive:
            false,
          targetSessionVerified:
            true,
          legacyAuthDisabled:
            true,
          rollbackSnapshotDeleted:
            false,
          rollbackSnapshotRetained:
            true,
          operationalWrites: {
            sheet:
              0,
            firestore:
              0,
            firebaseAuth:
              0,
            uidMutation:
              0
          }
        };
      }

      if (!lockSnapshot.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-31B production lock is unexpectedly missing."
        );
      }

      const lock =
        lockSnapshot.data() ||
        {};

      const smokeChecks:
        GenericRecord = {
      digest:
        text(
          smoke.smokeDigest
        ) ===
          text(
            input.smokeDigest
          ) &&
        digestValue(
          smokeCore
        ) ===
          text(
            input.smokeDigest
          ),
      state:
        text(
          smokeCore.state
        ) ===
          "passed_waiting_explicit_maintenance_release" &&
        smokeCore.allChecksPassed ===
          true,
      valid:
        parseIsoMillis(
          smokeCore.smokeExpiresAtIso,
          "phase4c31.release.smokeExpiresAtIso"
        ) >
          Date.now(),
      execution:
        allTrue(
          phase4c31ExecutionChecks(
            execution
          )
        ),
      lock:
        text(
          lock.state
        ) ===
          "owned" &&
        text(
          lock.cutoverState
        ) ===
          "post_cutover_smoke_passed_waiting_release" &&
        text(
          lock.postCutoverSmokeDigest
        ) ===
          text(
            input.smokeDigest
          ),
      maintenance:
        text(
          maintenance.state
        ) ===
          "active" &&
        text(
          maintenance.cutoverState
        ) ===
          "post_cutover_smoke_passed_waiting_release" &&
        text(
          maintenance.postCutoverSmokeDigest
        ) ===
          text(
            input.smokeDigest
          ),
      recovery:
        text(
          recovery.state
        ) ===
          "post_cutover_smoke_passed_waiting_release" &&
        text(
          recovery.postCutoverSmokeDigest
        ) ===
          text(
            input.smokeDigest
          ) &&
        recovery.productionRollbackSnapshotRetained ===
          true
      };

      if (!allTrue(
        smokeChecks
      )) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-31B release validation failed: ${
            Object.entries(
              smokeChecks
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

      const baseline =
        await loadSnapshotBaseline(
          context
        );

      const plan =
        await phase4c30bLoadOperationalPlan(
          context,
          baseline
        );

      const firestoreVerification =
        await phase4c30bVerifyFirestore(
          context,
          plan
        );

      if (
        firestoreVerification.verified !==
          true ||
        text(
          firestoreVerification.targetDigest
        ) !==
          PHASE4C31_FIRESTORE_TARGET_DIGEST
      ) {
        throw new HttpsError(
          "data-loss",
          "Phase 4C-31B final Firestore verification failed."
        );
      }

      const sourcePreservation =
        await phase4c31VerifySourcePreservation(
          context,
          plan
        );

      const authVerification =
        await phase4c31VerifyAuthAndSession(
          callerUid,
          authContext?.token ||
          {},
          PHASE4C31_EXECUTION_ID
        );

      const releasedAtIso =
        new Date().toISOString();

      await context.db.runTransaction(
        async (transaction) => {
          const [
            currentSmoke,
            currentExecution,
            currentLock,
            currentMaintenance,
            currentRecovery
          ] = await Promise.all([
            transaction.get(
              smokeRef
            ),
            transaction.get(
              executionRef
            ),
            transaction.get(
              context.lockRef
            ),
            transaction.get(
              context.maintenanceRef
            ),
            transaction.get(
              context.recoverySessionRef
            )
          ]);

          if (
            !currentSmoke.exists ||
            !currentExecution.exists ||
            !currentLock.exists ||
            !currentMaintenance.exists ||
            !currentRecovery.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-31B release documents disappeared."
            );
          }

          const currentSmokeData =
            currentSmoke.data() ||
            {};

          const currentSmokeCore =
            asRecord(
              currentSmokeData.smokeCore,
              "phase4c31.release.transaction.smokeCore"
            );

          const currentExecutionData =
            currentExecution.data() ||
            {};

          const currentLockData =
            currentLock.data() ||
            {};

          const currentMaintenanceData =
            currentMaintenance.data() ||
            {};

          const currentRecoveryData =
            currentRecovery.data() ||
            {};

          if (
            text(
              currentSmokeData.smokeDigest
            ) !==
              text(
                input.smokeDigest
              ) ||
            digestValue(
              currentSmokeCore
            ) !==
              text(
                input.smokeDigest
              ) ||
            text(
              currentSmokeCore.state
            ) !==
              "passed_waiting_explicit_maintenance_release" ||
            !allTrue(
              phase4c31ExecutionChecks(
                currentExecutionData
              )
            ) ||
            text(
              currentLockData.state
            ) !==
              "owned" ||
            text(
              currentMaintenanceData.state
            ) !==
              "active" ||
            text(
              currentRecoveryData.state
            ) !==
              "post_cutover_smoke_passed_waiting_release"
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-31B atomic release recheck failed."
            );
          }

          transaction.set(
            executionRef,
            {
              ...currentExecutionData,
              maintenanceReleased:
                true,
              maintenanceReleaseVersion:
                UID_V2_POST_CUTOVER_SMOKE_RELEASE_PHASE4C31_VERSION,
              maintenanceReleaseSmokeDigest:
                input.smokeDigest,
              maintenanceReleasedAtIso:
                releasedAtIso,
              updatedAtIso:
                releasedAtIso
            }
          );

          transaction.set(
            smokeRef,
            {
              ...currentSmokeData,
              status:
                "post_cutover_smoke_passed_maintenance_released",
              releaseState:
                "released",
              releasedAtIso,
              updatedAtIso:
                releasedAtIso
            }
          );

          transaction.set(
            context.maintenanceRef,
            {
              ...currentMaintenanceData,
              state:
                "inactive",
              cutoverState:
                "released",
              productionExecutionLockOwned:
                false,
              productionMaintenanceWindowActive:
                false,
              productionRollbackSnapshotDeleted:
                false,
              productionRollbackSnapshotRetained:
                true,
              postCutoverSmokeDigest:
                input.smokeDigest,
              releasedByFirebaseUid:
                callerUid,
              releasedAtIso,
              updatedAtIso:
                releasedAtIso
            }
          );

          transaction.set(
            context.recoverySessionRef,
            {
              ...currentRecoveryData,
              state:
                "post_cutover_released",
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
              postCutoverSmokeDigest:
                input.smokeDigest,
              releasedByFirebaseUid:
                callerUid,
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

      const post =
        await phase4c31InspectState(
          context,
          callerUid,
          authContext?.token ||
          {}
        );

      if (
        post.released !==
          true ||
        post.productionExecutionLockOwned !==
          false ||
        post.productionMaintenanceWindowActive !==
          false
      ) {
        throw new HttpsError(
          "data-loss",
          "Phase 4C-31B post-release verification failed."
        );
      }

      return {
        ok:
          true,
        version:
          UID_V2_POST_CUTOVER_SMOKE_RELEASE_PHASE4C31_VERSION,
        phase:
          "Phase 4C-31B",
        mode:
          "explicit_normal_maintenance_and_lock_release_after_post_cutover_smoke",
        requestId:
          REQUEST_ID,
        contractDigest:
          PHASE4C31_CONTRACT_DIGEST,
        executionId:
          PHASE4C31_EXECUTION_ID,
        duplicate:
          false,
        writeOperations:
          5,
        state:
          "released",
        smokeDigest:
          input.smokeDigest,
        releasedAtIso,
        firestoreVerification,
        sourcePreservation,
        authVerification,
        maintenanceState:
          "inactive",
        productionExecutionLockOwned:
          false,
        productionMaintenanceWindowActive:
          false,
        targetSessionVerified:
          true,
        legacyAuthDisabled:
          true,
        rollbackSnapshotDeleted:
          false,
        rollbackSnapshotRetained:
          true,
        postReleaseVerification:
          post,
        operationalWrites: {
          sheet:
            0,
          firestore:
            0,
          firebaseAuth:
            0,
          uidMutation:
            0
        },
        nextAction:
          "Reload the ULIM application and perform a normal target-UID login check."
      };
    }
  );

export const inspectUidV2PostCutoverReleasePhase4c31 =
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
      const authContext =
        request.auth as
          | {
              uid: string;
              token: GenericRecord;
            }
          | undefined;

      const callerUid =
        requireSuperAdmin(
          authContext
        );

      if (
        callerUid !==
          PHASE4C31_TARGET_FIREBASE_UID
      ) {
        throw new HttpsError(
          "permission-denied",
          "Phase 4C-31 inspect requires the target PRN2 superAdmin session."
        );
      }

      const input =
        request.data &&
        typeof request.data ===
          "object"
          ? request.data as
              Phase4c31InspectInput
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          PHASE4C31_CONTRACT_DIGEST ||
        text(
          input.executionId
        ) !==
          PHASE4C31_EXECUTION_ID
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-31 inspect gate failed."
        );
      }

      return phase4c31InspectState(
        buildContext(
          callerUid
        ),
        callerUid,
        authContext?.token ||
        {}
      );
    }
  );
