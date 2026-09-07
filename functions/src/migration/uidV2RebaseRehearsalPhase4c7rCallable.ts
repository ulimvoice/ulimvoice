import { createHash } from "node:crypto";
import {
  App,
  getApp,
  getApps,
  initializeApp
} from "firebase-admin/app";
import {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  WriteBatch,
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_V2_REBASE_REHEARSAL_PHASE4C7R_VERSION =
  "2026-07-27.716.47-phase4c7r-isolated-delete-restore-rehearsal";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "658dc5f19b1b6036c9b995607e1be305d239b74e67e47566e8472efb0be04135";

const EXPECTED_PHASE4C6R_CONTRACT_DIGEST =
  "07c2862a8a173ba11e592855ba3fe4cf415d0fba9f58f8527bfad83d257127c6";

const EXPECTED_SNAPSHOT_DIGEST =
  "7e17dc767d85178a94148674d7f05b1f29e085af92ffcf12b1d9877f1f9b6bd8";

const EXPECTED_SNAPSHOT_SET_DIGEST =
  "6e2cd04e8f7fb82c16b825c373d27efb2abc44dc6356469085f39df2076c1840";

const EXPECTED_RESTORE_PLAN_DIGEST =
  "3e44e8da376fe61f04d2cef8f29d4f98bb4b39dfce74b170aaee095564c7af23";

const EXPECTED_SOURCE_DOCUMENTS =
  284;

const EXPECTED_COLLECTION_COUNTS =
  {"rebaseFanoutAssignmentMappings":14,"rebaseFanoutAttendanceMappings":1,"rebaseFanoutAuthTransitions":1,"rebaseFanoutExclusions":1,"rebaseFanoutMetadata":1,"rebaseFanoutPrincipalAliases":13,"rebaseFanoutPrincipals":12,"rebaseFanoutStudentAliases":85,"rebaseFanoutStudents":156} as const;

const EXPECTED_DELETE_WRITES =
  284;

const EXPECTED_RESTORE_WRITES =
  284;

const EXPECTED_TARGET_REHEARSAL_WRITES =
  568;

const EXPECTED_RESULT_WRITES =
  1;

const EXPECTED_TOTAL_PHYSICAL_WRITES =
  569;

const SOURCE_COLLECTIONS =
  ["rebaseFanoutAssignmentMappings","rebaseFanoutAttendanceMappings","rebaseFanoutAuthTransitions","rebaseFanoutExclusions","rebaseFanoutMetadata","rebaseFanoutPrincipalAliases","rebaseFanoutPrincipals","rebaseFanoutStudentAliases","rebaseFanoutStudents"] as const;

type GenericRecord =
  Record<string, unknown>;

interface ExecuteInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmDeleteWrites?: unknown;
  readonly confirmRestoreWrites?: unknown;
  readonly confirmIsolatedCollectionsOnly?: unknown;
  readonly confirmEmergencyRestore?: unknown;
  readonly confirmNoOperationalWrites?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
}

interface SnapshotEntry {
  readonly collectionName: string;
  readonly documentId: string;
  readonly pathSuffix: string;
  readonly dataDigest: string;
  readonly data: unknown;
}

function defaultAdminApp(): App {
  const existing =
    getApps().find(
      (app) =>
        app.name === "[DEFAULT]"
    );

  return existing
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
    text(auth.token.role) === "superAdmin" ||
    text(auth.token.ulimRole) === "superAdmin" ||
    text(auth.token.accountRole) === "superAdmin" ||
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

function sha256(
  value: string
): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function digestValue(
  value: unknown
): string {
  return sha256(
    JSON.stringify(
      canonicalize(value)
    )
  );
}

function sameJson(
  left: unknown,
  right: unknown
): boolean {
  return (
    JSON.stringify(
      canonicalize(left)
    ) ===
    JSON.stringify(
      canonicalize(right)
    )
  );
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

function snapshotCore(
  data: GenericRecord
) {
  return {
    version:
      data.version,
    phase:
      data.phase,
    mode:
      data.mode,
    requestId:
      data.requestId,
    approvedByFirebaseUid:
      data.approvedByFirebaseUid,
    contractDigest:
      data.contractDigest,
    phase4c5rContractDigest:
      data.phase4c5rContractDigest,
    payloadDigest:
      data.payloadDigest,
    fanoutDesignDigest:
      data.fanoutDesignDigest,
    sourceRecordSetDigest:
      data.sourceRecordSetDigest,
    sourceMetadataDigest:
      data.sourceMetadataDigest,
    sourceDocumentCount:
      data.sourceDocumentCount,
    collectionCounts:
      data.collectionCounts,
    snapshotEntries:
      data.snapshotEntries,
    snapshotSetDigest:
      data.snapshotSetDigest,
    status:
      data.status,
    safety:
      data.safety
  };
}

function planCore(
  data: GenericRecord
) {
  return {
    version:
      data.version,
    phase:
      data.phase,
    mode:
      data.mode,
    requestId:
      data.requestId,
    approvedByFirebaseUid:
      data.approvedByFirebaseUid,
    contractDigest:
      data.contractDigest,
    snapshotDigest:
      data.snapshotDigest,
    snapshotSetDigest:
      data.snapshotSetDigest,
    sourceDocumentCount:
      data.sourceDocumentCount,
    plannedDeleteWrites:
      data.plannedDeleteWrites,
    plannedRestoreWrites:
      data.plannedRestoreWrites,
    plannedRehearsalTotalWrites:
      data.plannedRehearsalTotalWrites,
    deleteStrategy:
      data.deleteStrategy,
    restoreStrategy:
      data.restoreStrategy,
    verificationStrategy:
      data.verificationStrategy,
    status:
      data.status,
    safety:
      data.safety
  };
}

function resultCore(
  data: GenericRecord
) {
  return {
    version:
      data.version,
    phase:
      data.phase,
    mode:
      data.mode,
    requestId:
      data.requestId,
    approvedByFirebaseUid:
      data.approvedByFirebaseUid,
    contractDigest:
      data.contractDigest,
    snapshotDigest:
      data.snapshotDigest,
    snapshotSetDigest:
      data.snapshotSetDigest,
    restorePlanDigest:
      data.restorePlanDigest,
    beforeSetDigest:
      data.beforeSetDigest,
    afterSetDigest:
      data.afterSetDigest,
    sourceDocumentCount:
      data.sourceDocumentCount,
    preDeleteVerified:
      data.preDeleteVerified,
    postDeleteDocumentCount:
      data.postDeleteDocumentCount,
    postDeleteVerified:
      data.postDeleteVerified,
    restoredDocumentCount:
      data.restoredDocumentCount,
    postRestoreVerified:
      data.postRestoreVerified,
    deleteWrites:
      data.deleteWrites,
    restoreWrites:
      data.restoreWrites,
    targetRehearsalWrites:
      data.targetRehearsalWrites,
    resultRecordWrites:
      data.resultRecordWrites,
    totalPhysicalWrites:
      data.totalPhysicalWrites,
    collectionCounts:
      data.collectionCounts,
    status:
      data.status,
    safety:
      data.safety
  };
}

function normalizeEntries(
  snapshot: GenericRecord
): SnapshotEntry[] {
  const raw =
    asArray(
      snapshot.snapshotEntries,
      "snapshot.snapshotEntries"
    );

  const allowed =
    new Set<string>(
      SOURCE_COLLECTIONS
    );

  const entries =
    raw.map(
      (value, index) => {
        const entry =
          asRecord(
            value,
            `snapshotEntries[${index}]`
          );

        const collectionName =
          text(
            entry.collectionName
          );

        const documentId =
          text(
            entry.documentId
          );

        const pathSuffix =
          text(
            entry.pathSuffix
          );

        const dataDigest =
          text(
            entry.dataDigest
          );

        if (
          !allowed.has(
            collectionName
          ) ||
          !documentId ||
          documentId.includes("/") ||
          pathSuffix !==
            `${collectionName}/${documentId}` ||
          !/^[a-f0-9]{64}$/.test(
            dataDigest
          ) ||
          digestValue(
            entry.data
          ) !==
            dataDigest
        ) {
          throw new HttpsError(
            "failed-precondition",
            `Invalid rollback snapshot entry at index ${index}.`
          );
        }

        return {
          collectionName,
          documentId,
          pathSuffix,
          dataDigest,
          data:
            canonicalize(
              entry.data
            )
        };
      }
    );

  entries.sort(
    (left, right) =>
      left.pathSuffix.localeCompare(
        right.pathSuffix
      )
  );

  const unique =
    new Set(
      entries.map(
        (entry) =>
          entry.pathSuffix
      )
    );

  if (
    entries.length !==
      EXPECTED_SOURCE_DOCUMENTS ||
    unique.size !==
      entries.length
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Rollback snapshot paths are incomplete or duplicated."
    );
  }

  const counts:
    GenericRecord = {};

  for (const entry of entries) {
    counts[
      entry.collectionName
    ] =
      Number(
        counts[
          entry.collectionName
        ] ||
        0
      ) + 1;
  }

  if (
    !sameJson(
      counts,
      EXPECTED_COLLECTION_COUNTS
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Rollback snapshot collection counts do not match."
    );
  }

  const setDigest =
    digestValue(
      entries.map(
        (entry) => ({
          pathSuffix:
            entry.pathSuffix,
          dataDigest:
            entry.dataDigest
        })
      )
    );

  if (
    setDigest !==
    EXPECTED_SNAPSHOT_SET_DIGEST
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Rollback snapshot set digest does not match."
    );
  }

  return entries;
}

async function readAllSourceDocuments(
  db: Firestore
): Promise<DocumentSnapshot[]> {
  const runRef =
    db.collection(
      "uidV2StagingRuns"
    ).doc(
      REQUEST_ID
    );

  const snapshots =
    await Promise.all(
      SOURCE_COLLECTIONS.map(
        (collectionName) =>
          runRef
            .collection(
              collectionName
            )
            .get()
      )
    );

  return snapshots.flatMap(
    (snapshot) =>
      snapshot.docs
  );
}

function sourceSetDigest(
  documents: DocumentSnapshot[]
): string {
  const entries =
    documents
      .map(
        (document) => ({
          pathSuffix:
            document.ref.path
              .split("/")
              .slice(-2)
              .join("/"),
          dataDigest:
            digestValue(
              document.data()
            )
        })
      )
      .sort(
        (left, right) =>
          left.pathSuffix.localeCompare(
            right.pathSuffix
          )
      );

  return digestValue(
    entries
  );
}

function verifyCurrentSource(
  documents: DocumentSnapshot[],
  entries: SnapshotEntry[]
): {
  readonly verifiedCount: number;
  readonly failedPaths: string[];
  readonly setDigest: string;
} {
  const expected =
    new Map(
      entries.map(
        (entry) => [
          entry.pathSuffix,
          entry
        ]
      )
    );

  const failedPaths:
    string[] = [];

  let verifiedCount =
    0;

  for (const document of documents) {
    const pathSuffix =
      document.ref.path
        .split("/")
        .slice(-2)
        .join("/");

    const entry =
      expected.get(
        pathSuffix
      );

    if (
      !entry ||
      digestValue(
        document.data()
      ) !==
        entry.dataDigest
    ) {
      failedPaths.push(
        pathSuffix
      );
      continue;
    }

    verifiedCount++;
  }

  for (const entry of entries) {
    const found =
      documents.some(
        (document) =>
          document.ref.path
            .split("/")
            .slice(-2)
            .join("/") ===
          entry.pathSuffix
      );

    if (!found) {
      failedPaths.push(
        entry.pathSuffix
      );
    }
  }

  return {
    verifiedCount,
    failedPaths:
      Array.from(
        new Set(
          failedPaths
        )
      ).sort(),
    setDigest:
      sourceSetDigest(
        documents
      )
  };
}

function buildRefs(
  db: Firestore,
  entries: SnapshotEntry[]
): DocumentReference[] {
  const runRef =
    db.collection(
      "uidV2StagingRuns"
    ).doc(
      REQUEST_ID
    );

  return entries.map(
    (entry) =>
      runRef
        .collection(
          entry.collectionName
        )
        .doc(
          entry.documentId
        )
  );
}

async function commitDelete(
  db: Firestore,
  refs: DocumentReference[]
): Promise<void> {
  const batch:
    WriteBatch =
    db.batch();

  refs.forEach(
    (reference) =>
      batch.delete(
        reference
      )
  );

  await batch.commit();
}

async function commitRestore(
  db: Firestore,
  refs: DocumentReference[],
  entries: SnapshotEntry[]
): Promise<void> {
  const batch:
    WriteBatch =
    db.batch();

  refs.forEach(
    (
      reference,
      index
    ) =>
      batch.set(
        reference,
        entries[index].data
      )
  );

  await batch.commit();
}

async function emergencyRestore(
  db: Firestore,
  refs: DocumentReference[],
  entries: SnapshotEntry[]
): Promise<{
  readonly restored: boolean;
  readonly attempts: number;
  readonly verifiedCount: number;
}> {
  let attempts =
    0;

  for (
    const delay of
    [
      0,
      500,
      1500
    ]
  ) {
    attempts++;

    if (delay > 0) {
      await sleep(
        delay
      );
    }

    try {
      await commitRestore(
        db,
        refs,
        entries
      );

      const documents =
        await readAllSourceDocuments(
          db
        );

      const verified =
        verifyCurrentSource(
          documents,
          entries
        );

      if (
        documents.length ===
          EXPECTED_SOURCE_DOCUMENTS &&
        verified.failedPaths.length ===
          0 &&
        verified.setDigest ===
          EXPECTED_SNAPSHOT_SET_DIGEST
      ) {
        return {
          restored:
            true,
          attempts,
          verifiedCount:
            verified.verifiedCount
        };
      }
    } catch {
      // 다음 복원 시도로 진행합니다.
    }
  }

  return {
    restored:
      false,
    attempts,
    verifiedCount:
      0
  };
}

function publicResult(
  data: GenericRecord,
  duplicate: boolean,
  writeOperations: number
) {
  return {
    ok:
      true,
    version:
      UID_V2_REBASE_REHEARSAL_PHASE4C7R_VERSION,
    mode:
      "rebase156_isolated_delete_restore_rehearsal",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    status:
      text(
        data.status
      ),
    contractDigest:
      text(
        data.contractDigest
      ),
    rehearsalResultDigest:
      text(
        data.rehearsalResultDigest
      ),
    snapshotDigest:
      text(
        data.snapshotDigest
      ),
    snapshotSetDigest:
      text(
        data.snapshotSetDigest
      ),
    restorePlanDigest:
      text(
        data.restorePlanDigest
      ),
    beforeSetDigest:
      text(
        data.beforeSetDigest
      ),
    afterSetDigest:
      text(
        data.afterSetDigest
      ),
    sourceDocumentCount:
      Number(
        data.sourceDocumentCount ||
        0
      ),
    preDeleteVerified:
      data.preDeleteVerified ===
      true,
    postDeleteDocumentCount:
      Number(
        data.postDeleteDocumentCount ??
        -1
      ),
    postDeleteVerified:
      data.postDeleteVerified ===
      true,
    restoredDocumentCount:
      Number(
        data.restoredDocumentCount ||
        0
      ),
    postRestoreVerified:
      data.postRestoreVerified ===
      true,
    deleteWrites:
      Number(
        data.deleteWrites ||
        0
      ),
    restoreWrites:
      Number(
        data.restoreWrites ||
        0
      ),
    targetRehearsalWrites:
      Number(
        data.targetRehearsalWrites ||
        0
      ),
    resultRecordWrites:
      Number(
        data.resultRecordWrites ||
        0
      ),
    totalPhysicalWrites:
      Number(
        data.totalPhysicalWrites ||
        0
      ),
    collectionCounts:
      data.collectionCounts,
    fullRehearsalPassed:
      (
        data.preDeleteVerified ===
          true &&
        Number(
          data.postDeleteDocumentCount ??
          -1
        ) ===
          0 &&
        data.postDeleteVerified ===
          true &&
        Number(
          data.restoredDocumentCount ||
          0
        ) ===
          EXPECTED_SOURCE_DOCUMENTS &&
        data.postRestoreVerified ===
          true &&
        text(
          data.beforeSetDigest
        ) ===
          EXPECTED_SNAPSHOT_SET_DIGEST &&
        text(
          data.afterSetDigest
        ) ===
          EXPECTED_SNAPSHOT_SET_DIGEST
      ),
    safety: {
      isolatedTargetDeleteWrites:
        duplicate
          ? 0
          : EXPECTED_DELETE_WRITES,
      isolatedTargetRestoreWrites:
        duplicate
          ? 0
          : EXPECTED_RESTORE_WRITES,
      isolatedResultRecordWrites:
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
      emergencyRestoreEnabled:
        true,
      isolatedOnly:
        true,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        "Phase 4C-8R post-rehearsal live drift audit",
      allowed:
        data.postRestoreVerified ===
        true,
      actualUidCutoverAllowed:
        false
    }
  };
}

async function loadAndValidateControlDocuments(
  db: Firestore,
  callerUid: string
): Promise<{
  readonly snapshot: GenericRecord;
  readonly plan: GenericRecord;
  readonly entries: SnapshotEntry[];
}> {
  const runRef =
    db.collection(
      "uidV2StagingRuns"
    ).doc(
      REQUEST_ID
    );

  const [
    snapshotResult,
    planResult
  ] =
    await Promise.all([
      runRef
        .collection(
          "rebaseRollbackSnapshots"
        )
        .doc(
          "phase4c6r"
        )
        .get(),
      runRef
        .collection(
          "rebaseRestorePlans"
        )
        .doc(
          "phase4c6r"
        )
        .get()
    ]);

  if (
    !snapshotResult.exists ||
    !planResult.exists
  ) {
    throw new HttpsError(
      "not-found",
      "Phase 4C-6R snapshot or restore plan is missing."
    );
  }

  const snapshot =
    snapshotResult.data() ||
    {};

  const plan =
    planResult.data() ||
    {};

  const computedSnapshotDigest =
    digestValue(
      snapshotCore(
        snapshot
      )
    );

  const computedPlanDigest =
    digestValue(
      planCore(
        plan
      )
    );

  const checks:
    GenericRecord = {
    snapshotContract:
      text(
        snapshot.contractDigest
      ) ===
      EXPECTED_PHASE4C6R_CONTRACT_DIGEST,
    planContract:
      text(
        plan.contractDigest
      ) ===
      EXPECTED_PHASE4C6R_CONTRACT_DIGEST,
    snapshotDigest:
      text(
        snapshot.snapshotDigest
      ) ===
        computedSnapshotDigest &&
      computedSnapshotDigest ===
        EXPECTED_SNAPSHOT_DIGEST,
    planDigest:
      text(
        plan.restorePlanDigest
      ) ===
        computedPlanDigest &&
      computedPlanDigest ===
        EXPECTED_RESTORE_PLAN_DIGEST,
    setDigest:
      text(
        snapshot.snapshotSetDigest
      ) ===
      EXPECTED_SNAPSHOT_SET_DIGEST,
    planSnapshotBinding:
      text(
        plan.snapshotDigest
      ) ===
      EXPECTED_SNAPSHOT_DIGEST,
    planSetBinding:
      text(
        plan.snapshotSetDigest
      ) ===
      EXPECTED_SNAPSHOT_SET_DIGEST,
    sourceDocuments:
      Number(
        snapshot.sourceDocumentCount ||
        0
      ) ===
        EXPECTED_SOURCE_DOCUMENTS &&
      Number(
        plan.sourceDocumentCount ||
        0
      ) ===
        EXPECTED_SOURCE_DOCUMENTS,
    deleteWrites:
      Number(
        plan.plannedDeleteWrites ||
        0
      ) ===
      EXPECTED_DELETE_WRITES,
    restoreWrites:
      Number(
        plan.plannedRestoreWrites ||
        0
      ) ===
      EXPECTED_RESTORE_WRITES,
    targetWrites:
      Number(
        plan.plannedRehearsalTotalWrites ||
        0
      ) ===
      EXPECTED_TARGET_REHEARSAL_WRITES,
    collectionCounts:
      sameJson(
        snapshot.collectionCounts,
        EXPECTED_COLLECTION_COUNTS
      ),
    sameCaller:
      text(
        snapshot.approvedByFirebaseUid
      ) ===
        callerUid &&
      text(
        plan.approvedByFirebaseUid
      ) ===
        callerUid,
    noPriorExecution:
      (
        plan.safety as GenericRecord
      )?.restoreExecutionIncluded ===
      false,
    noCutover:
      (
        plan.safety as GenericRecord
      )?.actualUidCutoverAllowed ===
      false
  };

  if (!allTrue(checks)) {
    const failedChecks =
      Object.entries(checks)
        .filter(
          (
            [
              ,
              passed
            ]
          ) =>
            passed !== true
        )
        .map(
          (
            [
              key
            ]
          ) =>
            key
        );

    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-7R control validation failed: ${failedChecks.join(", ")}`,
      {
        failedChecks
      }
    );
  }

  return {
    snapshot,
    plan,
    entries:
      normalizeEntries(
        snapshot
      )
  };
}

export const executeUidV2RebaseDeleteRestorePhase4c7r =
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
        typeof request.data === "object"
          ? request.data as ExecuteInput
          : {};

      if (
        text(input.requestId) !==
          REQUEST_ID ||
        text(input.contractDigest) !==
          CONTRACT_DIGEST ||
        Number(
          input.confirmDeleteWrites ||
          0
        ) !==
          EXPECTED_DELETE_WRITES ||
        Number(
          input.confirmRestoreWrites ||
          0
        ) !==
          EXPECTED_RESTORE_WRITES ||
        input.confirmIsolatedCollectionsOnly !==
          true ||
        input.confirmEmergencyRestore !==
          true ||
        input.confirmNoOperationalWrites !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-7R execution input gate failed."
        );
      }

      const db =
        getFirestore(
          defaultAdminApp()
        );

      const control =
        await loadAndValidateControlDocuments(
          db,
          callerUid
        );

      const runRef =
        db.collection(
          "uidV2StagingRuns"
        ).doc(
          REQUEST_ID
        );

      const resultRef =
        runRef
          .collection(
            "rebaseRehearsalResults"
          )
          .doc(
            "phase4c7r"
          );

      const resultSnapshot =
        await resultRef.get();

      const refs =
        buildRefs(
          db,
          control.entries
        );

      const beforeDocuments =
        await readAllSourceDocuments(
          db
        );

      const before =
        verifyCurrentSource(
          beforeDocuments,
          control.entries
        );

      if (
        beforeDocuments.length !==
          EXPECTED_SOURCE_DOCUMENTS ||
        before.verifiedCount !==
          EXPECTED_SOURCE_DOCUMENTS ||
        before.failedPaths.length !==
          0 ||
        before.setDigest !==
          EXPECTED_SNAPSHOT_SET_DIGEST
      ) {
        throw new HttpsError(
          "data-loss",
          "Phase 4C-7R pre-delete source verification failed.",
          {
            documentCount:
              beforeDocuments.length,
            verifiedCount:
              before.verifiedCount,
            failedPaths:
              before.failedPaths.slice(
                0,
                20
              ),
            setDigest:
              before.setDigest
          }
        );
      }

      if (resultSnapshot.exists) {
        const existing =
          resultSnapshot.data() ||
          {};

        const computed =
          digestValue(
            resultCore(
              existing
            )
          );

        if (
          text(
            existing.rehearsalResultDigest
          ) !==
            computed ||
          text(
            existing.contractDigest
          ) !==
            CONTRACT_DIGEST ||
          text(
            existing.status
          ) !==
            "rebase_delete_restore_rehearsal_verified" ||
          text(
            existing.afterSetDigest
          ) !==
            EXPECTED_SNAPSHOT_SET_DIGEST
        ) {
          throw new HttpsError(
            "already-exists",
            "A conflicting Phase 4C-7R rehearsal result exists."
          );
        }

        return publicResult(
          existing,
          true,
          0
        );
      }

      let deleteCommitted =
        false;

      try {
        await commitDelete(
          db,
          refs
        );

        deleteCommitted =
          true;

        const afterDelete =
          await readAllSourceDocuments(
            db
          );

        if (
          afterDelete.length !==
          0
        ) {
          throw new HttpsError(
            "data-loss",
            "Phase 4C-7R post-delete verification failed.",
            {
              remainingDocuments:
                afterDelete.length,
              remainingPaths:
                afterDelete
                  .slice(
                    0,
                    20
                  )
                  .map(
                    (document) =>
                      document.ref.path
                  )
            }
          );
        }

        await commitRestore(
          db,
          refs,
          control.entries
        );

        const afterDocuments =
          await readAllSourceDocuments(
            db
          );

        const after =
          verifyCurrentSource(
            afterDocuments,
            control.entries
          );

        if (
          afterDocuments.length !==
            EXPECTED_SOURCE_DOCUMENTS ||
          after.verifiedCount !==
            EXPECTED_SOURCE_DOCUMENTS ||
          after.failedPaths.length !==
            0 ||
          after.setDigest !==
            EXPECTED_SNAPSHOT_SET_DIGEST
        ) {
          throw new HttpsError(
            "data-loss",
            "Phase 4C-7R post-restore verification failed.",
            {
              documentCount:
                afterDocuments.length,
              verifiedCount:
                after.verifiedCount,
              failedPaths:
                after.failedPaths.slice(
                  0,
                  20
                ),
              setDigest:
                after.setDigest
            }
          );
        }

        const core:
          GenericRecord = {
          version:
            UID_V2_REBASE_REHEARSAL_PHASE4C7R_VERSION,
          phase:
            "Phase 4C-7R",
          mode:
            "rebase156_isolated_delete_restore_rehearsal",
          requestId:
            REQUEST_ID,
          approvedByFirebaseUid:
            callerUid,
          contractDigest:
            CONTRACT_DIGEST,
          snapshotDigest:
            EXPECTED_SNAPSHOT_DIGEST,
          snapshotSetDigest:
            EXPECTED_SNAPSHOT_SET_DIGEST,
          restorePlanDigest:
            EXPECTED_RESTORE_PLAN_DIGEST,
          beforeSetDigest:
            before.setDigest,
          afterSetDigest:
            after.setDigest,
          sourceDocumentCount:
            EXPECTED_SOURCE_DOCUMENTS,
          preDeleteVerified:
            true,
          postDeleteDocumentCount:
            0,
          postDeleteVerified:
            true,
          restoredDocumentCount:
            after.verifiedCount,
          postRestoreVerified:
            true,
          deleteWrites:
            EXPECTED_DELETE_WRITES,
          restoreWrites:
            EXPECTED_RESTORE_WRITES,
          targetRehearsalWrites:
            EXPECTED_TARGET_REHEARSAL_WRITES,
          resultRecordWrites:
            EXPECTED_RESULT_WRITES,
          totalPhysicalWrites:
            EXPECTED_TOTAL_PHYSICAL_WRITES,
          collectionCounts:
            EXPECTED_COLLECTION_COUNTS,
          status:
            "rebase_delete_restore_rehearsal_verified",
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
            emergencyRestoreEnabled:
              true,
            isolatedOnly:
              true,
            actualUidCutoverAllowed:
              false
          }
        };

        const rehearsalResultDigest =
          digestValue(
            core
          );

        const stored:
          GenericRecord = {
          ...core,
          rehearsalResultDigest,
          completedAtIso:
            new Date().toISOString()
        };

        await db.runTransaction(
          async (transaction) => {
            const existing =
              await transaction.get(
                resultRef
              );

            if (existing.exists) {
              const data =
                existing.data() ||
                {};

              if (
                text(
                  data.rehearsalResultDigest
                ) !==
                rehearsalResultDigest
              ) {
                throw new HttpsError(
                  "already-exists",
                  "A conflicting Phase 4C-7R result was created concurrently."
                );
              }

              return;
            }

            transaction.set(
              resultRef,
              stored
            );
          }
        );

        return publicResult(
          stored,
          false,
          EXPECTED_RESULT_WRITES
        );
      } catch (error) {
        if (deleteCommitted) {
          const emergency =
            await emergencyRestore(
              db,
              refs,
              control.entries
            );

          if (!emergency.restored) {
            throw new HttpsError(
              "data-loss",
              "Phase 4C-7R failed and emergency restore could not be completed.",
              {
                emergencyRestoreAttempts:
                  emergency.attempts
              }
            );
          }

          throw new HttpsError(
            "aborted",
            "Phase 4C-7R was interrupted after delete; emergency restore completed successfully. Re-run the rehearsal.",
            {
              emergencyRestoreAttempts:
                emergency.attempts,
              emergencyVerifiedDocuments:
                emergency.verifiedCount
            }
          );
        }

        throw error;
      }
    }
  );

export const inspectUidV2RebaseDeleteRestorePhase4c7r =
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
        typeof request.data === "object"
          ? request.data as InspectInput
          : {};

      if (
        text(input.requestId) !==
          REQUEST_ID ||
        text(input.contractDigest) !==
          CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-7R inspect input gate failed."
        );
      }

      const db =
        getFirestore(
          defaultAdminApp()
        );

      const control =
        await loadAndValidateControlDocuments(
          db,
          callerUid
        );

      const runRef =
        db.collection(
          "uidV2StagingRuns"
        ).doc(
          REQUEST_ID
        );

      const resultSnapshot =
        await runRef
          .collection(
            "rebaseRehearsalResults"
          )
          .doc(
            "phase4c7r"
          )
          .get();

      if (!resultSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-7R rehearsal result is missing."
        );
      }

      const result =
        resultSnapshot.data() ||
        {};

      const resultDigest =
        digestValue(
          resultCore(
            result
          )
        );

      const documents =
        await readAllSourceDocuments(
          db
        );

      const verified =
        verifyCurrentSource(
          documents,
          control.entries
        );

      const checks:
        GenericRecord = {
        resultDigest:
          text(
            result.rehearsalResultDigest
          ) ===
          resultDigest,
        contract:
          text(
            result.contractDigest
          ) ===
          CONTRACT_DIGEST,
        snapshot:
          text(
            result.snapshotDigest
          ) ===
          EXPECTED_SNAPSHOT_DIGEST,
        snapshotSet:
          text(
            result.snapshotSetDigest
          ) ===
          EXPECTED_SNAPSHOT_SET_DIGEST,
        restorePlan:
          text(
            result.restorePlanDigest
          ) ===
          EXPECTED_RESTORE_PLAN_DIGEST,
        beforeSet:
          text(
            result.beforeSetDigest
          ) ===
          EXPECTED_SNAPSHOT_SET_DIGEST,
        afterSet:
          text(
            result.afterSetDigest
          ) ===
          EXPECTED_SNAPSHOT_SET_DIGEST,
        sourceDocuments:
          documents.length ===
            EXPECTED_SOURCE_DOCUMENTS &&
          verified.verifiedCount ===
            EXPECTED_SOURCE_DOCUMENTS &&
          verified.failedPaths.length ===
            0,
        sourceSet:
          verified.setDigest ===
          EXPECTED_SNAPSHOT_SET_DIGEST,
        postDelete:
          Number(
            result.postDeleteDocumentCount ??
            -1
          ) ===
            0 &&
          result.postDeleteVerified ===
            true,
        postRestore:
          Number(
            result.restoredDocumentCount ||
            0
          ) ===
            EXPECTED_SOURCE_DOCUMENTS &&
          result.postRestoreVerified ===
            true,
        deleteWrites:
          Number(
            result.deleteWrites ||
            0
          ) ===
          EXPECTED_DELETE_WRITES,
        restoreWrites:
          Number(
            result.restoreWrites ||
            0
          ) ===
          EXPECTED_RESTORE_WRITES,
        targetWrites:
          Number(
            result.targetRehearsalWrites ||
            0
          ) ===
          EXPECTED_TARGET_REHEARSAL_WRITES,
        totalPhysicalWrites:
          Number(
            result.totalPhysicalWrites ||
            0
          ) ===
          EXPECTED_TOTAL_PHYSICAL_WRITES,
        status:
          text(
            result.status
          ) ===
          "rebase_delete_restore_rehearsal_verified",
        noCutover:
          (
            result.safety as GenericRecord
          )?.actualUidCutoverAllowed ===
          false
      };

      if (!allTrue(checks)) {
        const failedChecks =
          Object.entries(checks)
            .filter(
              (
                [
                  ,
                  passed
                ]
              ) =>
                passed !== true
            )
            .map(
              (
                [
                  key
                ]
              ) =>
                key
            );

        throw new HttpsError(
          "data-loss",
          `Phase 4C-7R inspection failed: ${failedChecks.join(", ")}`,
          {
            failedChecks,
            failedPaths:
              verified.failedPaths.slice(
                0,
                20
              )
          }
        );
      }

      return {
        ...publicResult(
          result,
          true,
          0
        ),
        currentSourceDocumentCount:
          documents.length,
        currentSourceMatchesSnapshot:
          true,
        verified:
          true,
        digestMatches:
          true,
        documentsVerified:
          EXPECTED_SOURCE_DOCUMENTS,
        controlDocumentsVerified:
          3
      };
    }
  );
