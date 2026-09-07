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

export const UID_V2_CUTOVER_EXECUTION_CHALLENGE_PHASE4C26R_VERSION =
  "2026-07-28.716.81-phase4c26r-one-time-token-verification-explicit-cutover-execution-challenge-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "61737f3affd10428fcfccac64777b248ee326fd3db7794bfda0ca99e316965eb";

const APPROVAL_PHRASE =
  "Phase 4C-26R 일회성 Token 검증 및 Cutover 실행 Challenge 생성을 승인합니다. 실제 UID 변경과 Cutover는 실행하지 않습니다.";

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

const EXPECTED_PHASE4C25_RUNTIME_VERSION =
  "2026-07-28.716.80-phase4c25r-explicit-final-arm-token-issuance-live-recheck-only-no-uid-mutation";

const EXPECTED_PHASE4C25_CONTRACT_DIGEST =
  "fc461d86ba6f33739e4740a3f7c1b45e49b3782c56b8587c294c55a6610a6541";

const EXPECTED_FINAL_ARM_TOKEN_DIGEST =
  "8f987b7b94c25406886cf4211c8415bba95035a1f6183ffae48ddfa8fcd3d534";

const EXPECTED_FINAL_ARM_TOKEN_ID =
  "phase4c25r-ms4p19o7-44b18dd42cc29910ba62acc1";

const EXPECTED_FINAL_ARM_TOKEN_EXPIRES_AT_ISO =
  "2026-07-28T13:40:29.815Z";

const FINAL_SESSION_DOCUMENT =
  "phase4c24r-71679";

const FINAL_CHALLENGE_DOCUMENT =
  "phase4c24r-71679";

const FINAL_ARM_TOKEN_DOCUMENT =
  "phase4c25r-71680";

const EXECUTION_CHALLENGE_DOCUMENT =
  "phase4c26r-71681";

const RECOVERY_SESSION_DOCUMENT =
  "phase4c23r-71678";

const EXECUTION_CHALLENGE_VALIDITY_SECONDS =
  600;

const SHEET_CAPTURE_MAX_AGE_SECONDS =
  600;

const LEASE_SECONDS =
  7200;

const CREATE_WRITE_OPERATIONS =
  5;

const NEXT_GATE_PHASE =
  "Phase 4C-27R execution challenge verification and sealed cutover execution package only";

type GenericRecord =
  Record<string, unknown>;

interface CreateInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly approvalPhrase?: unknown;
  readonly tokenDigest?: unknown;
  readonly sheetEnvelope?: unknown;
  readonly confirmMaintenanceGuardDeployed?: unknown;
  readonly confirmTokenStillValid?: unknown;
  readonly confirmNoUidMutation?: unknown;
  readonly confirmChallengeDoesNotExecuteCutover?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly executionChallengeDigest?: unknown;
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
  readonly executionChallengeRef:
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
    executionChallengeRef:
      runRef
        .collection(
          "rebaseCutoverExecutionChallenges"
        )
        .doc(
          EXECUTION_CHALLENGE_DOCUMENT
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
      "Phase 4C-26R Sheet wrapper digest mismatch."
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
      "Phase 4C-26R nested Sheet digest mismatch."
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
    UID_V2_CUTOVER_EXECUTION_CHALLENGE_PHASE4C26R_VERSION,
  wrapperPhase:
    text(
      wrapper.phase
    ) ===
    "Phase 4C-26R",
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
  generatedAfterChallenge:
    capturedAtMillis >=
    parseIsoMillis(
      EXPECTED_CHALLENGE_EXPIRES_AT_ISO,
      "challengeExpiresAtIso"
    ) -
    1800000,
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
      `Phase 4C-26R Fresh Sheet validation failed: ${
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
      `Phase 4C-26R live recheck failed: ${
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


function publicExecutionChallenge(
  storedChallenge: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean
): GenericRecord {
  const challengeCore =
    asRecord(
      storedChallenge.challengeCore,
      "executionChallenge.challengeCore"
    );

  const expiresAtMillis =
    parseIsoMillis(
      challengeCore.executionChallengeExpiresAtIso,
      "executionChallenge.expiresAtIso"
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
      UID_V2_CUTOVER_EXECUTION_CHALLENGE_PHASE4C26R_VERSION,
    phase:
      "Phase 4C-26R",
    mode:
      "rebase156_one_time_final_arm_token_verification_and_explicit_cutover_execution_challenge_only_no_uid_mutation",
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
    tokenDigest:
      challengeCore.tokenDigest,
    tokenId:
      challengeCore.tokenId,
    tokenWasValidAtIssuance:
      challengeCore.tokenWasValidAtIssuance,
    tokenUsed:
      challengeCore.tokenUsed,
    executionChallengeDigest:
      text(
        storedChallenge.executionChallengeDigest
      ),
    executionChallengeCoreDigest:
      digestValue(
        challengeCore
      ),
    executionChallengeId:
      challengeCore.executionChallengeId,
    executionChallengeState:
      challengeCore.executionChallengeState,
    executionChallengeIssuedAtIso:
      challengeCore.executionChallengeIssuedAtIso,
    executionChallengeExpiresAtIso:
      challengeCore.executionChallengeExpiresAtIso,
    executionChallengeSecondsRemaining:
      secondsRemaining,
    executionChallengeWithinValidity:
      secondsRemaining >
      0,
    liveRecheck:
      challengeCore.liveRecheck,
    productionExecutionLockOwned:
      challengeCore.productionExecutionLockOwned,
    productionMaintenanceWindowActive:
      challengeCore.productionMaintenanceWindowActive,
    uidMutationWrites:
      challengeCore.uidMutationWrites,
    actualCutoverWrites:
      challengeCore.actualCutoverWrites,
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
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        NEXT_GATE_PHASE,
      allowed:
        verified &&
        secondsRemaining >
          0 &&
        challengeCore.tokenUsed ===
          false,
      requiresExactExecutionChallengeDigest:
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

export const createUidV2CutoverExecutionChallengePhase4c26r =
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
              CreateInput
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
          input.tokenDigest
        ) !==
          EXPECTED_FINAL_ARM_TOKEN_DIGEST ||
        input.confirmMaintenanceGuardDeployed !==
          true ||
        input.confirmTokenStillValid !==
          true ||
        input.confirmNoUidMutation !==
          true ||
        input.confirmChallengeDoesNotExecuteCutover !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-26R creation gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const existingChallenge =
        await context.executionChallengeRef.get();

      if (existingChallenge.exists) {
        const stored =
          existingChallenge.data() ||
          {};

        if (
          text(
            stored.approvedByFirebaseUid
          ) !==
            callerUid ||
          text(
            stored.contractDigest
          ) !==
            CONTRACT_DIGEST
        ) {
          throw new HttpsError(
            "already-exists",
            "An incompatible Phase 4C-26R execution challenge exists."
          );
        }

        return publicExecutionChallenge(
          stored,
          true,
          0,
          false
        );
      }

      const [
        tokenSnapshot,
        finalChallengeSnapshot,
        recoverySessionSnapshot,
        lockSnapshot,
        maintenanceSnapshot
      ] = await Promise.all([
        context.tokenRef.get(),
        context.challengeRef.get(),
        context.recoverySessionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get()
      ]);

      if (
        !tokenSnapshot.exists ||
        !finalChallengeSnapshot.exists ||
        !recoverySessionSnapshot.exists ||
        !lockSnapshot.exists ||
        !maintenanceSnapshot.exists
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-26R prerequisite documents are incomplete."
        );
      }

      const storedToken =
        tokenSnapshot.data() ||
        {};

      const tokenCore =
        asRecord(
          storedToken.tokenCore,
          "token.tokenCore"
        );

      const finalChallenge =
        finalChallengeSnapshot.data() ||
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

      const tokenExpiresAtMillis =
        parseIsoMillis(
          tokenCore.tokenExpiresAtIso,
          "token.tokenExpiresAtIso"
        );

      const prechecks:
        GenericRecord = {
      tokenVersion:
        text(
          storedToken.version
        ) ===
        EXPECTED_PHASE4C25_RUNTIME_VERSION,
      tokenContract:
        text(
          storedToken.contractDigest
        ) ===
        EXPECTED_PHASE4C25_CONTRACT_DIGEST,
      tokenDigest:
        text(
          storedToken.tokenDigest
        ) ===
          EXPECTED_FINAL_ARM_TOKEN_DIGEST &&
        digestValue(
          tokenCore
        ) ===
          EXPECTED_FINAL_ARM_TOKEN_DIGEST,
      tokenIdentity:
        text(
          tokenCore.tokenId
        ) ===
          EXPECTED_FINAL_ARM_TOKEN_ID &&
        text(
          tokenCore.tokenExpiresAtIso
        ) ===
          EXPECTED_FINAL_ARM_TOKEN_EXPIRES_AT_ISO,
      tokenState:
        text(
          tokenCore.tokenState
        ) ===
        "armed_waiting_explicit_cutover_execution_challenge",
      tokenUnused:
        tokenCore.tokenUsed ===
          false &&
        numberValue(
          tokenCore.tokenUseCount
        ) ===
          0,
      tokenValid:
        tokenExpiresAtMillis >
        Date.now(),
      linkedChallenge:
        text(
          tokenCore.challengeDigest
        ) ===
          EXPECTED_CHALLENGE_DIGEST &&
        text(
          finalChallenge.challengeDigest
        ) ===
          EXPECTED_CHALLENGE_DIGEST,
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
      noMutation:
        numberValue(
          tokenCore.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          tokenCore.actualCutoverWrites
        ) ===
          0 &&
        tokenCore.tokenContainsMutationPayload ===
          false &&
        tokenCore.tokenConsumptionCallableIncluded ===
          false &&
        tokenCore.uidMutationAllowed ===
          false &&
        tokenCore.actualUidCutoverAllowed ===
          false
      };

      if (!allTrue(
        prechecks
      )) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-26R token precheck failed: ${
            Object.entries(prechecks)
              .filter(([, passed]) => passed !== true)
              .map(([key]) => key)
              .join(", ")
          }`
        );
      }

      const baseline =
        await loadSnapshotBaseline(
          context
        );

      const sheet =
        validateSheetEnvelope(
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

      const executionChallengeExpiresAtIso =
        addSecondsIso(
          Date.parse(issuedAtIso),
          EXECUTION_CHALLENGE_VALIDITY_SECONDS
        );

      const leaseExpiresAtIso =
        addSecondsIso(
          Date.parse(issuedAtIso),
          LEASE_SECONDS
        );

      const executionChallengeId =
        [
          "phase4c26r",
          Date.now().toString(36),
          randomBytes(12).toString("hex")
        ].join("-");

      const challengeCore:
        GenericRecord = {
      version:
        UID_V2_CUTOVER_EXECUTION_CHALLENGE_PHASE4C26R_VERSION,
      phase:
        "Phase 4C-26R",
      mode:
        "rebase156_one_time_final_arm_token_verification_and_explicit_cutover_execution_challenge_only_no_uid_mutation",
      requestId:
        REQUEST_ID,
      contractDigest:
        CONTRACT_DIGEST,
      executionChallengeId,
      executionChallengeState:
        "issued_waiting_sealed_cutover_execution_package",
      executionChallengeIssuedAtIso:
        issuedAtIso,
      executionChallengeExpiresAtIso,
      executionChallengeValiditySeconds:
        EXECUTION_CHALLENGE_VALIDITY_SECONDS,
      approvedByFirebaseUidDigest:
        digestValue(
          callerUid
        ),
      tokenDigest:
        EXPECTED_FINAL_ARM_TOKEN_DIGEST,
      tokenId:
        EXPECTED_FINAL_ARM_TOKEN_ID,
      tokenWasValidAtIssuance:
        tokenExpiresAtMillis >
        Date.parse(issuedAtIso),
      tokenUsed:
        false,
      tokenUseCount:
        0,
      phase4c24ChallengeDigest:
        EXPECTED_CHALLENGE_DIGEST,
      cutoverRunId:
        EXPECTED_CUTOVER_RUN_ID,
      freshSnapshotPath:
        EXPECTED_FRESH_SNAPSHOT_PATH,
      freshRollbackSnapshotDigest:
        EXPECTED_ROLLBACK_DIGEST,
      sheetCaptureDigest:
        sheet.wrapperDigest,
      liveRecheck:
        live,
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
      tokenConsumptionCallableIncluded:
        false,
      cutoverExecutionCallableIncluded:
        false,
      challengeContainsMutationPayload:
        false,
      uidMutationAllowed:
        false,
      actualUidCutoverAllowed:
        false,
      nextGate: {
        phase:
          NEXT_GATE_PHASE,
        requiresExactExecutionChallengeDigest:
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

      const executionChallengeDigest =
        digestValue(
          challengeCore
        );

      const storedExecutionChallenge:
        GenericRecord = {
      version:
        UID_V2_CUTOVER_EXECUTION_CHALLENGE_PHASE4C26R_VERSION,
      phase:
        "Phase 4C-26R",
      mode:
        "rebase156_one_time_final_arm_token_verification_and_explicit_cutover_execution_challenge_only_no_uid_mutation",
      requestId:
        REQUEST_ID,
      contractDigest:
        CONTRACT_DIGEST,
      approvedByFirebaseUid:
        callerUid,
      executionChallengeDigest,
      challengeCore,
      status:
        "cutover_execution_challenge_issued_no_uid_mutation",
      createdAtIso:
        issuedAtIso
      };

      await context.db.runTransaction(
        async (transaction) => {
          const [
            currentExecutionChallenge,
            currentToken,
            currentRecovery,
            currentLock,
            currentMaintenance
          ] = await Promise.all([
            transaction.get(
              context.executionChallengeRef
            ),
            transaction.get(
              context.tokenRef
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

          if (currentExecutionChallenge.exists) {
            throw new HttpsError(
              "already-exists",
              "Phase 4C-26R execution challenge destination exists."
            );
          }

          if (
            !currentToken.exists ||
            !currentRecovery.exists ||
            !currentLock.exists ||
            !currentMaintenance.exists
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-26R documents disappeared before commit."
            );
          }

          const currentStoredToken =
            currentToken.data() ||
            {};

          const currentTokenCore =
            asRecord(
              currentStoredToken.tokenCore,
              "current.tokenCore"
            );

          const currentRecoveryData =
            currentRecovery.data() ||
            {};

          const currentLockData =
            currentLock.data() ||
            {};

          const currentMaintenanceData =
            currentMaintenance.data() ||
            {};

          const commitChecks:
            GenericRecord = {
          tokenDigest:
            text(
              currentStoredToken.tokenDigest
            ) ===
              EXPECTED_FINAL_ARM_TOKEN_DIGEST &&
            digestValue(
              currentTokenCore
            ) ===
              EXPECTED_FINAL_ARM_TOKEN_DIGEST,
          tokenUnused:
            currentTokenCore.tokenUsed ===
              false &&
            numberValue(
              currentTokenCore.tokenUseCount
            ) ===
              0,
          tokenValid:
            parseIsoMillis(
              currentTokenCore.tokenExpiresAtIso,
              "token.tokenExpiresAtIso"
            ) >
            Date.now(),
          recoveryState:
            text(
              currentRecoveryData.state
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
          leaseValid:
            parseIsoMillis(
              currentLockData.leaseExpiresAtIso,
              "lock.leaseExpiresAtIso"
            ) >
            Date.now(),
          noMutation:
            numberValue(
              currentRecoveryData.uidMutationWrites
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
              `Phase 4C-26R commit gate failed: ${
                Object.entries(commitChecks)
                  .filter(([, passed]) => passed !== true)
                  .map(([key]) => key)
                  .join(", ")
              }`
            );
          }

          transaction.set(
            context.executionChallengeRef,
            storedExecutionChallenge
          );

          transaction.set(
            context.tokenRef,
            {
              ...currentStoredToken,
              executionChallengeDigest,
              executionChallengeId,
              executionChallengeIssued:
                true,
              executionChallengeExpiresAtIso,
              tokenUsed:
                false,
              updatedAtIso:
                issuedAtIso
            }
          );

          transaction.set(
            context.recoverySessionRef,
            {
              ...currentRecoveryData,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              executionChallengeDigest,
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
              ...currentLockData,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              executionChallengeDigest,
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
              ...currentMaintenanceData,
              heartbeatAtIso:
                issuedAtIso,
              leaseExpiresAtIso,
              executionChallengeDigest,
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

      return publicExecutionChallenge(
        storedExecutionChallenge,
        false,
        CREATE_WRITE_OPERATIONS,
        false
      );
    }
  );

export const inspectUidV2CutoverExecutionChallengePhase4c26r =
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
          input.executionChallengeDigest
        ) ===
          ""
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-26R inspect gate failed."
        );
      }

      const context =
        buildContext(
          callerUid
        );

      const [
        executionChallengeSnapshot,
        tokenSnapshot,
        recoverySnapshot,
        lockSnapshot,
        maintenanceSnapshot
      ] = await Promise.all([
        context.executionChallengeRef.get(),
        context.tokenRef.get(),
        context.recoverySessionRef.get(),
        context.lockRef.get(),
        context.maintenanceRef.get()
      ]);

      if (
        !executionChallengeSnapshot.exists ||
        !tokenSnapshot.exists ||
        !recoverySnapshot.exists ||
        !lockSnapshot.exists ||
        !maintenanceSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-26R linked documents are incomplete."
        );
      }

      const storedChallenge =
        executionChallengeSnapshot.data() ||
        {};

      const challengeCore =
        asRecord(
          storedChallenge.challengeCore,
          "executionChallenge.challengeCore"
        );

      const storedToken =
        tokenSnapshot.data() ||
        {};

      const tokenCore =
        asRecord(
          storedToken.tokenCore,
          "token.tokenCore"
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

      const executionChallengeDigest =
        text(
          input.executionChallengeDigest
        );

      const checks:
        GenericRecord = {
      status:
        text(
          storedChallenge.status
        ) ===
        "cutover_execution_challenge_issued_no_uid_mutation",
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
          storedChallenge.executionChallengeDigest
        ) ===
          executionChallengeDigest &&
        digestValue(
          challengeCore
        ) ===
          executionChallengeDigest,
      challengeValid:
        parseIsoMillis(
          challengeCore.executionChallengeExpiresAtIso,
          "executionChallenge.expiresAtIso"
        ) >
        Date.now(),
      tokenLink:
        text(
          challengeCore.tokenDigest
        ) ===
          EXPECTED_FINAL_ARM_TOKEN_DIGEST &&
        text(
          storedToken.executionChallengeDigest
        ) ===
          executionChallengeDigest,
      tokenUnused:
        tokenCore.tokenUsed ===
          false &&
        numberValue(
          tokenCore.tokenUseCount
        ) ===
          0,
      tokenWasValidAtIssuance:
        challengeCore.tokenWasValidAtIssuance ===
        true,
      recovery:
        text(
          recovery.executionChallengeDigest
        ) ===
        executionChallengeDigest,
      lock:
        text(
          lock.state
        ) ===
          "owned" &&
        text(
          lock.executionChallengeDigest
        ) ===
          executionChallengeDigest &&
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
          maintenance.executionChallengeDigest
        ) ===
          executionChallengeDigest,
      liveRecheck:
        allTrue(
          asRecord(
            asRecord(
              challengeCore.liveRecheck,
              "challenge.liveRecheck"
            ).checks,
            "challenge.liveRecheck.checks"
          )
        ),
      noMutation:
        numberValue(
          challengeCore.uidMutationWrites
        ) ===
          0 &&
        numberValue(
          challengeCore.actualCutoverWrites
        ) ===
          0 &&
        challengeCore.tokenConsumptionCallableIncluded ===
          false &&
        challengeCore.cutoverExecutionCallableIncluded ===
          false &&
        challengeCore.challengeContainsMutationPayload ===
          false &&
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
          `Phase 4C-26R verification failed: ${
            Object.entries(checks)
              .filter(([, passed]) => passed !== true)
              .map(([key]) => key)
              .join(", ")
          }`
        );
      }

      return publicExecutionChallenge(
        storedChallenge,
        true,
        0,
        true
      );
    }
  );
