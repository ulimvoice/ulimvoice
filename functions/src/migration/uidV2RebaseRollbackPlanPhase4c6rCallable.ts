import { createHash } from "node:crypto";
import {
  App,
  getApp,
  getApps,
  initializeApp
} from "firebase-admin/app";
import {
  CollectionReference,
  DocumentSnapshot,
  Firestore,
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_V2_REBASE_ROLLBACK_PLAN_PHASE4C6R_VERSION =
  "2026-07-27.716.46-phase4c6r-isolated-rollback-snapshot-restore-plan";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "07c2862a8a173ba11e592855ba3fe4cf415d0fba9f58f8527bfad83d257127c6";

const EXPECTED_PHASE4C5R_CONTRACT_DIGEST =
  "e3613acc1c03d352df591371aeba2a2ec1cd5a1a40d7c1a1de88ca57aa8d02c5";

const EXPECTED_PAYLOAD_DIGEST =
  "748710b323521e64895d52548cbe1a0680bb02837579dd4079da9cff56f66288";

const EXPECTED_FANOUT_DESIGN_DIGEST =
  "bc11d7b0c94cc2a600d1b4202419f5cef14eadbfc172c2b59bbfc4f61d3eb65e";

const EXPECTED_RECORD_SET_DIGEST =
  "ec3fad78b2d29666497861f567ac38f2e864f34969516a2cda4c58d9102fb28c";

const EXPECTED_METADATA_DIGEST =
  "7afa4fc0804f768ab00e78e4c780b94e50ac34a3e69647bed4d7264aa7085105";

const EXPECTED_COLLECTION_COUNTS =
  {"rebaseFanoutAssignmentMappings":14,"rebaseFanoutAttendanceMappings":1,"rebaseFanoutAuthTransitions":1,"rebaseFanoutExclusions":1,"rebaseFanoutPrincipalAliases":13,"rebaseFanoutPrincipals":12,"rebaseFanoutStudentAliases":85,"rebaseFanoutStudents":156} as const;

const EXPECTED_SOURCE_DOCUMENTS =
  284;

const PLANNED_DELETE_WRITES =
  284;

const PLANNED_RESTORE_WRITES =
  284;

const PLANNED_REHEARSAL_TOTAL_WRITES =
  568;

const FANOUT_COLLECTIONS =
  ["rebaseFanoutStudents","rebaseFanoutPrincipals","rebaseFanoutStudentAliases","rebaseFanoutPrincipalAliases","rebaseFanoutAssignmentMappings","rebaseFanoutAttendanceMappings","rebaseFanoutAuthTransitions","rebaseFanoutExclusions"] as const;

const METADATA_COLLECTION =
  "rebaseFanoutMetadata";

const METADATA_DOCUMENT_ID =
  "phase4c5r";

type GenericRecord =
  Record<string, unknown>;

interface StageSnapshotInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmFullIsolatedSnapshot?: unknown;
  readonly confirmNoSourceMutation?: unknown;
}

interface StagePlanInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmPlanOnly?: unknown;
  readonly confirmNoRollbackExecution?: unknown;
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

function metadataCore(
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
    phase4c4rContractDigest:
      data.phase4c4rContractDigest,
    payloadDigest:
      data.payloadDigest,
    payloadStoredDigest:
      data.payloadStoredDigest,
    fanoutDesignDigest:
      data.fanoutDesignDigest,
    recordSetDigest:
      data.recordSetDigest,
    counts:
      data.counts,
    collectionCounts:
      data.collectionCounts,
    recordWrites:
      data.recordWrites,
    metadataWrites:
      data.metadataWrites,
    totalWrites:
      data.totalWrites,
    status:
      data.status,
    safety:
      data.safety
  };
}

async function readFanoutSource(
  db: Firestore
): Promise<{
  readonly entries: SnapshotEntry[];
  readonly collectionCounts: GenericRecord;
  readonly snapshotSetDigest: string;
  readonly metadata: GenericRecord;
}> {
  const runRef =
    db.collection(
      "uidV2StagingRuns"
    ).doc(
      REQUEST_ID
    );

  const collectionSnapshots =
    await Promise.all(
      FANOUT_COLLECTIONS.map(
        (collectionName) =>
          runRef
            .collection(
              collectionName
            )
            .get()
      )
    );

  const metadataSnapshot =
    await runRef
      .collection(
        METADATA_COLLECTION
      )
      .doc(
        METADATA_DOCUMENT_ID
      )
      .get();

  if (!metadataSnapshot.exists) {
    throw new HttpsError(
      "not-found",
      "Phase 4C-5R fan-out metadata is missing."
    );
  }

  const metadata =
    metadataSnapshot.data() ||
    {};

  const metadataRecomputed =
    digestValue(
      metadataCore(
        metadata
      )
    );

  const metadataChecks:
    GenericRecord = {
    contract:
      text(
        metadata.contractDigest
      ) ===
      EXPECTED_PHASE4C5R_CONTRACT_DIGEST,
    payload:
      text(
        metadata.payloadDigest
      ) ===
      EXPECTED_PAYLOAD_DIGEST,
    design:
      text(
        metadata.fanoutDesignDigest
      ) ===
      EXPECTED_FANOUT_DESIGN_DIGEST,
    recordSet:
      text(
        metadata.recordSetDigest
      ) ===
      EXPECTED_RECORD_SET_DIGEST,
    metadataDigest:
      text(
        metadata.metadataDigest
      ) ===
        metadataRecomputed &&
      metadataRecomputed ===
        EXPECTED_METADATA_DIGEST,
    totalWrites:
      Number(
        metadata.totalWrites ||
        0
      ) ===
      EXPECTED_SOURCE_DOCUMENTS,
    collectionCounts:
      sameJson(
        metadata.collectionCounts,
        EXPECTED_COLLECTION_COUNTS
      ),
    status:
      text(
        metadata.status
      ) ===
      "rebase_isolated_fanout_verified",
    isolatedOnly:
      (
        metadata.safety as GenericRecord
      )?.isolatedOnly ===
      true,
    noCutover:
      (
        metadata.safety as GenericRecord
      )?.actualUidCutoverAllowed ===
      false
  };

  if (!allTrue(metadataChecks)) {
    const failedChecks =
      Object.entries(metadataChecks)
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
      `Phase 4C-6R metadata validation failed: ${failedChecks.join(", ")}`,
      {
        failedChecks
      }
    );
  }

  const entries:
    SnapshotEntry[] = [];

  const collectionCounts:
    GenericRecord = {};

  collectionSnapshots.forEach(
    (
      snapshot,
      index
    ) => {
      const collectionName =
        FANOUT_COLLECTIONS[index];

      collectionCounts[
        collectionName
      ] =
        snapshot.size;

      for (
        const document of
        snapshot.docs
      ) {
        const data =
          canonicalize(
            document.data()
          );

        const record =
          asRecord(
            data,
            "fan-out document"
          );

        const valid =
          text(
            record.requestId
          ) ===
            REQUEST_ID &&
          record.isolated ===
            true &&
          record.active ===
            false &&
          text(
            record.sourcePayloadDigest
          ) ===
            EXPECTED_PAYLOAD_DIGEST &&
          text(
            record.sourceFanoutDesignDigest
          ) ===
            EXPECTED_FANOUT_DESIGN_DIGEST &&
          text(
            record.recordDigest
          ) ===
            digestValue(
              record.data
            );

        if (!valid) {
          throw new HttpsError(
            "data-loss",
            `Invalid isolated fan-out document: ${document.ref.path}`
          );
        }

        entries.push({
          collectionName,
          documentId:
            document.id,
          pathSuffix:
            `${collectionName}/${document.id}`,
          dataDigest:
            digestValue(
              data
            ),
          data
        });
      }
    }
  );

  const metadataData =
    canonicalize(
      metadataSnapshot.data()
    );

  entries.push({
    collectionName:
      METADATA_COLLECTION,
    documentId:
      METADATA_DOCUMENT_ID,
    pathSuffix:
      `${METADATA_COLLECTION}/${METADATA_DOCUMENT_ID}`,
    dataDigest:
      digestValue(
        metadataData
      ),
    data:
      metadataData
  });

  collectionCounts[
    METADATA_COLLECTION
  ] =
    1;

  entries.sort(
    (left, right) =>
      left.pathSuffix.localeCompare(
        right.pathSuffix
      )
  );

  const dataDocumentCount =
    entries.filter(
      (entry) =>
        entry.collectionName !==
        METADATA_COLLECTION
    ).length;

  const checks:
    GenericRecord = {
    dataDocuments:
      dataDocumentCount ===
      EXPECTED_SOURCE_DOCUMENTS -
      1,
    totalDocuments:
      entries.length ===
      EXPECTED_SOURCE_DOCUMENTS,
    collectionCounts:
      Object.entries(
        EXPECTED_COLLECTION_COUNTS
      ).every(
        (
          [
            key,
            value
          ]
        ) =>
          Number(
            collectionCounts[key] ||
            0
          ) ===
          Number(value)
      ),
    metadataCount:
      Number(
        collectionCounts[
          METADATA_COLLECTION
        ] ||
        0
      ) ===
      1
  };

  if (!allTrue(checks)) {
    throw new HttpsError(
      "data-loss",
      "Phase 4C-6R source document count validation failed.",
      {
        checks,
        collectionCounts
      }
    );
  }

  const snapshotSetDigest =
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

  return {
    entries,
    collectionCounts:
      canonicalize(
        collectionCounts
      ) as GenericRecord,
    snapshotSetDigest,
    metadata
  };
}

function publicSnapshotResult(
  data: GenericRecord,
  duplicate: boolean,
  writeOperations: number
) {
  return {
    ok:
      true,
    version:
      UID_V2_REBASE_ROLLBACK_PLAN_PHASE4C6R_VERSION,
    mode:
      "rebase156_isolated_full_rollback_snapshot",
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
    snapshotDigest:
      text(
        data.snapshotDigest
      ),
    snapshotSetDigest:
      text(
        data.snapshotSetDigest
      ),
    sourceDocumentCount:
      Number(
        data.sourceDocumentCount ||
        0
      ),
    snapshotBytes:
      Number(
        data.snapshotBytes ||
        0
      ),
    collectionCounts:
      data.collectionCounts,
    safety: {
      isolatedSnapshotWrites:
        writeOperations,
      isolatedRestorePlanWrites:
        0,
      sourceDocumentWrites:
        0,
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
      restoreExecutionIncluded:
        false,
      actualUidCutoverAllowed:
        false
    }
  };
}

function publicPlanResult(
  data: GenericRecord,
  duplicate: boolean,
  writeOperations: number
) {
  return {
    ok:
      true,
    version:
      UID_V2_REBASE_ROLLBACK_PLAN_PHASE4C6R_VERSION,
    mode:
      "rebase156_isolated_restore_plan_only",
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
    restorePlanDigest:
      text(
        data.restorePlanDigest
      ),
    snapshotDigest:
      text(
        data.snapshotDigest
      ),
    sourceDocumentCount:
      Number(
        data.sourceDocumentCount ||
        0
      ),
    plannedDeleteWrites:
      Number(
        data.plannedDeleteWrites ||
        0
      ),
    plannedRestoreWrites:
      Number(
        data.plannedRestoreWrites ||
        0
      ),
    plannedRehearsalTotalWrites:
      Number(
        data.plannedRehearsalTotalWrites ||
        0
      ),
    safety: {
      isolatedSnapshotWrites:
        0,
      isolatedRestorePlanWrites:
        writeOperations,
      sourceDocumentWrites:
        0,
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
      restoreExecutionIncluded:
        false,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        "Phase 4C-7R isolated delete-and-restore rehearsal",
      allowed:
        true,
      actualUidCutoverAllowed:
        false
    }
  };
}

export const stageUidV2RebaseRollbackSnapshotPhase4c6r =
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
          ? request.data as StageSnapshotInput
          : {};

      if (
        text(input.requestId) !==
          REQUEST_ID ||
        text(input.contractDigest) !==
          CONTRACT_DIGEST ||
        input.confirmFullIsolatedSnapshot !==
          true ||
        input.confirmNoSourceMutation !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-6R snapshot input gate failed."
        );
      }

      const db =
        getFirestore(
          defaultAdminApp()
        );

      const source =
        await readFanoutSource(
          db
        );

      const runRef =
        db.collection(
          "uidV2StagingRuns"
        ).doc(
          REQUEST_ID
        );

      const snapshotRef =
        runRef
          .collection(
            "rebaseRollbackSnapshots"
          )
          .doc(
            "phase4c6r"
          );

      const core:
        GenericRecord = {
        version:
          UID_V2_REBASE_ROLLBACK_PLAN_PHASE4C6R_VERSION,
        phase:
          "Phase 4C-6R",
        mode:
          "rebase156_isolated_full_rollback_snapshot",
        requestId:
          REQUEST_ID,
        approvedByFirebaseUid:
          callerUid,
        contractDigest:
          CONTRACT_DIGEST,
        phase4c5rContractDigest:
          EXPECTED_PHASE4C5R_CONTRACT_DIGEST,
        payloadDigest:
          EXPECTED_PAYLOAD_DIGEST,
        fanoutDesignDigest:
          EXPECTED_FANOUT_DESIGN_DIGEST,
        sourceRecordSetDigest:
          EXPECTED_RECORD_SET_DIGEST,
        sourceMetadataDigest:
          EXPECTED_METADATA_DIGEST,
        sourceDocumentCount:
          source.entries.length,
        collectionCounts:
          source.collectionCounts,
        snapshotEntries:
          source.entries,
        snapshotSetDigest:
          source.snapshotSetDigest,
        status:
          "rebase_rollback_snapshot_staged",
        safety: {
          sourceDocumentWrites:
            0,
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
          restoreExecutionIncluded:
            false,
          actualUidCutoverAllowed:
            false
        }
      };

      const snapshotDigest =
        digestValue(
          core
        );

      const snapshotBytes =
        Buffer.byteLength(
          JSON.stringify(
            canonicalize(
              core
            )
          ),
          "utf8"
        );

      if (
        snapshotBytes >
        900000
      ) {
        throw new HttpsError(
          "resource-exhausted",
          "Phase 4C-6R snapshot exceeds the safe Firestore document size threshold.",
          {
            snapshotBytes
          }
        );
      }

      const stored:
        GenericRecord = {
        ...core,
        snapshotDigest,
        snapshotBytes,
        createdAtIso:
          new Date().toISOString()
      };

      let duplicate =
        false;
      let writeOperations =
        0;
      let output:
        GenericRecord = {};

      await db.runTransaction(
        async (transaction) => {
          const [
            existing,
            metadataSnapshot
          ] =
            await Promise.all([
              transaction.get(
                snapshotRef
              ),
              transaction.get(
                runRef
                  .collection(
                    METADATA_COLLECTION
                  )
                  .doc(
                    METADATA_DOCUMENT_ID
                  )
              )
            ]);

          if (!metadataSnapshot.exists) {
            throw new HttpsError(
              "data-loss",
              "Phase 4C-5R metadata disappeared before snapshot commit."
            );
          }

          const metadata =
            metadataSnapshot.data() ||
            {};

          if (
            text(
              metadata.metadataDigest
            ) !==
            EXPECTED_METADATA_DIGEST
          ) {
            throw new HttpsError(
              "data-loss",
              "Phase 4C-5R metadata drifted before snapshot commit."
            );
          }

          if (existing.exists) {
            const data =
              existing.data() ||
              {};

            if (
              text(
                data.snapshotDigest
              ) !==
                snapshotDigest ||
              text(
                data.snapshotSetDigest
              ) !==
                source.snapshotSetDigest ||
              text(
                data.contractDigest
              ) !==
                CONTRACT_DIGEST
            ) {
              throw new HttpsError(
                "already-exists",
                "A conflicting Phase 4C-6R rollback snapshot exists."
              );
            }

            duplicate = true;
            output = data;
            return;
          }

          transaction.set(
            snapshotRef,
            stored
          );

          output = stored;
          writeOperations = 1;
        }
      );

      return publicSnapshotResult(
        output,
        duplicate,
        writeOperations
      );
    }
  );

export const stageUidV2RebaseRestorePlanPhase4c6r =
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
        typeof request.data === "object"
          ? request.data as StagePlanInput
          : {};

      if (
        text(input.requestId) !==
          REQUEST_ID ||
        text(input.contractDigest) !==
          CONTRACT_DIGEST ||
        input.confirmPlanOnly !==
          true ||
        input.confirmNoRollbackExecution !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-6R restore-plan input gate failed."
        );
      }

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

      const snapshotRef =
        runRef
          .collection(
            "rebaseRollbackSnapshots"
          )
          .doc(
            "phase4c6r"
          );

      const planRef =
        runRef
          .collection(
            "rebaseRestorePlans"
          )
          .doc(
            "phase4c6r"
          );

      let duplicate =
        false;
      let writeOperations =
        0;
      let output:
        GenericRecord = {};

      await db.runTransaction(
        async (transaction) => {
          const [
            snapshotResult,
            planResult
          ] =
            await Promise.all([
              transaction.get(
                snapshotRef
              ),
              transaction.get(
                planRef
              )
            ]);

          if (!snapshotResult.exists) {
            throw new HttpsError(
              "not-found",
              "Phase 4C-6R rollback snapshot is missing."
            );
          }

          const snapshot =
            snapshotResult.data() ||
            {};

          const recomputedSnapshotDigest =
            digestValue(
              snapshotCore(
                snapshot
              )
            );

          const entries =
            asArray(
              snapshot.snapshotEntries,
              "snapshotEntries"
            );

          const snapshotChecks:
            GenericRecord = {
            digest:
              text(
                snapshot.snapshotDigest
              ) ===
              recomputedSnapshotDigest,
            contract:
              text(
                snapshot.contractDigest
              ) ===
              CONTRACT_DIGEST,
            sourceDocuments:
              Number(
                snapshot.sourceDocumentCount ||
                0
              ) ===
              EXPECTED_SOURCE_DOCUMENTS,
            entries:
              entries.length ===
              EXPECTED_SOURCE_DOCUMENTS,
            payload:
              text(
                snapshot.payloadDigest
              ) ===
              EXPECTED_PAYLOAD_DIGEST,
            design:
              text(
                snapshot.fanoutDesignDigest
              ) ===
              EXPECTED_FANOUT_DESIGN_DIGEST,
            recordSet:
              text(
                snapshot.sourceRecordSetDigest
              ) ===
              EXPECTED_RECORD_SET_DIGEST,
            metadata:
              text(
                snapshot.sourceMetadataDigest
              ) ===
              EXPECTED_METADATA_DIGEST,
            noExecution:
              (
                snapshot.safety as GenericRecord
              )?.restoreExecutionIncluded ===
              false,
            noCutover:
              (
                snapshot.safety as GenericRecord
              )?.actualUidCutoverAllowed ===
              false
          };

          if (!allTrue(snapshotChecks)) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-6R snapshot validation failed."
            );
          }

          const core:
            GenericRecord = {
            version:
              UID_V2_REBASE_ROLLBACK_PLAN_PHASE4C6R_VERSION,
            phase:
              "Phase 4C-6R",
            mode:
              "rebase156_isolated_restore_plan_only",
            requestId:
              REQUEST_ID,
            approvedByFirebaseUid:
              callerUid,
            contractDigest:
              CONTRACT_DIGEST,
            snapshotDigest:
              text(
                snapshot.snapshotDigest
              ),
            snapshotSetDigest:
              text(
                snapshot.snapshotSetDigest
              ),
            sourceDocumentCount:
              EXPECTED_SOURCE_DOCUMENTS,
            plannedDeleteWrites:
              PLANNED_DELETE_WRITES,
            plannedRestoreWrites:
              PLANNED_RESTORE_WRITES,
            plannedRehearsalTotalWrites:
              PLANNED_REHEARSAL_TOTAL_WRITES,
            deleteStrategy: {
              atomicBatch:
                true,
              deleteTargets:
                EXPECTED_SOURCE_DOCUMENTS,
              metadataIncluded:
                true,
              expectedPostDeleteDocuments:
                0
            },
            restoreStrategy: {
              atomicBatch:
                true,
              restoreTargets:
                EXPECTED_SOURCE_DOCUMENTS,
              restoreFromFullSnapshotBodies:
                true,
              metadataIncluded:
                true,
              expectedPostRestoreDocuments:
                EXPECTED_SOURCE_DOCUMENTS
            },
            verificationStrategy: {
              verifyAllDeleted:
                true,
              verifyAllRestored:
                true,
              verifyEveryDocumentDigest:
                true,
              verifySnapshotSetDigest:
                true
            },
            status:
              "rebase_restore_plan_staged",
            safety: {
              sourceDocumentWrites:
                0,
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
              restoreExecutionIncluded:
                false,
              actualUidCutoverAllowed:
                false
            }
          };

          const restorePlanDigest =
            digestValue(
              core
            );

          if (planResult.exists) {
            const data =
              planResult.data() ||
              {};

            if (
              text(
                data.restorePlanDigest
              ) !==
                restorePlanDigest ||
              text(
                data.snapshotDigest
              ) !==
                text(
                  snapshot.snapshotDigest
                )
            ) {
              throw new HttpsError(
                "already-exists",
                "A conflicting Phase 4C-6R restore plan exists."
              );
            }

            duplicate = true;
            output = data;
            return;
          }

          output = {
            ...core,
            restorePlanDigest,
            createdAtIso:
              new Date().toISOString()
          };

          transaction.set(
            planRef,
            output
          );

          writeOperations = 1;
        }
      );

      return publicPlanResult(
        output,
        duplicate,
        writeOperations
      );
    }
  );

export const inspectUidV2RebaseRollbackPlanPhase4c6r =
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
          "Phase 4C-6R inspect input gate failed."
        );
      }

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

      const currentSource =
        await readFanoutSource(
          db
        );

      const snapshotEntries =
        asArray(
          snapshot.snapshotEntries,
          "snapshotEntries"
        );

      const currentSourceDigest =
        currentSource.snapshotSetDigest;

      const snapshotDigest =
        digestValue(
          snapshotCore(
            snapshot
          )
        );

      const restorePlanDigest =
        digestValue(
          planCore(
            plan
          )
        );

      const checks:
        GenericRecord = {
        snapshotDigest:
          text(
            snapshot.snapshotDigest
          ) ===
          snapshotDigest,
        restorePlanDigest:
          text(
            plan.restorePlanDigest
          ) ===
          restorePlanDigest,
        planSnapshotBinding:
          text(
            plan.snapshotDigest
          ) ===
          text(
            snapshot.snapshotDigest
          ),
        snapshotSetBinding:
          text(
            plan.snapshotSetDigest
          ) ===
          text(
            snapshot.snapshotSetDigest
          ),
        currentSourceMatchesSnapshot:
          currentSourceDigest ===
          text(
            snapshot.snapshotSetDigest
          ),
        sourceDocuments:
          Number(
            snapshot.sourceDocumentCount ||
            0
          ) ===
            EXPECTED_SOURCE_DOCUMENTS &&
          snapshotEntries.length ===
            EXPECTED_SOURCE_DOCUMENTS &&
          currentSource.entries.length ===
            EXPECTED_SOURCE_DOCUMENTS,
        deleteWrites:
          Number(
            plan.plannedDeleteWrites ||
            0
          ) ===
          PLANNED_DELETE_WRITES,
        restoreWrites:
          Number(
            plan.plannedRestoreWrites ||
            0
          ) ===
          PLANNED_RESTORE_WRITES,
        totalWrites:
          Number(
            plan.plannedRehearsalTotalWrites ||
            0
          ) ===
          PLANNED_REHEARSAL_TOTAL_WRITES,
        noExecution:
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
          "data-loss",
          `Phase 4C-6R full verification failed: ${failedChecks.join(", ")}`,
          {
            failedChecks
          }
        );
      }

      return {
        ok:
          true,
        version:
          UID_V2_REBASE_ROLLBACK_PLAN_PHASE4C6R_VERSION,
        mode:
          "rebase156_rollback_snapshot_restore_plan_inspection",
        requestId:
          REQUEST_ID,
        contractDigest:
          CONTRACT_DIGEST,
        snapshot: {
          status:
            text(
              snapshot.status
            ),
          snapshotDigest:
            text(
              snapshot.snapshotDigest
            ),
          snapshotSetDigest:
            text(
              snapshot.snapshotSetDigest
            ),
          sourceDocumentCount:
            Number(
              snapshot.sourceDocumentCount ||
              0
            ),
          snapshotBytes:
            Number(
              snapshot.snapshotBytes ||
              0
            ),
          collectionCounts:
            snapshot.collectionCounts
        },
        restorePlan: {
          status:
            text(
              plan.status
            ),
          restorePlanDigest:
            text(
              plan.restorePlanDigest
            ),
          plannedDeleteWrites:
            Number(
              plan.plannedDeleteWrites ||
              0
            ),
          plannedRestoreWrites:
            Number(
              plan.plannedRestoreWrites ||
              0
            ),
          plannedRehearsalTotalWrites:
            Number(
              plan.plannedRehearsalTotalWrites ||
              0
            )
        },
        currentSourceDocumentCount:
          currentSource.entries.length,
        currentSourceMatchesSnapshot:
          true,
        verified:
          true,
        digestMatches:
          true,
        safety: {
          isolatedSnapshotRecords:
            1,
          isolatedRestorePlanRecords:
            1,
          sourceDocumentWrites:
            0,
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
          restoreExecutionIncluded:
            false,
          actualUidCutoverAllowed:
            false
        },
        nextGate: {
          phase:
            "Phase 4C-7R isolated delete-and-restore rehearsal",
          allowed:
            true,
          actualUidCutoverAllowed:
            false
        }
      };
    }
  );
