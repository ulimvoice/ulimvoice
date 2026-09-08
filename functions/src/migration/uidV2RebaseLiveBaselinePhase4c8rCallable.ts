import { createHash } from "node:crypto";
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
  Timestamp,
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_V2_REBASE_LIVE_BASELINE_PHASE4C8R_VERSION =
  "2026-07-27.716.48-phase4c8r-operational-live-baseline-rollback-coverage";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";
const EXPECTED_PAYLOAD_DIGEST =
  "748710b323521e64895d52548cbe1a0680bb02837579dd4079da9cff56f66288";
const EXPECTED_FANOUT_DIGEST =
  "bc11d7b0c94cc2a600d1b4202419f5cef14eadbfc172c2b59bbfc4f61d3eb65e";
const EXPECTED_PHASE4C5R_CONTRACT_DIGEST =
  "e3613acc1c03d352df591371aeba2a2ec1cd5a1a40d7c1a1de88ca57aa8d02c5";
const EXPECTED_PHASE4C7R_CONTRACT_DIGEST =
  "658dc5f19b1b6036c9b995607e1be305d239b74e67e47566e8472efb0be04135";
const EXPECTED_REHEARSAL_RESULT_DIGEST =
  "416db13b9958ec54952121ac0c0ee13512d942b6bf4a6ca38e54a56afb182c24";
const EXPECTED_RECORD_SET_DIGEST =
  "ec3fad78b2d29666497861f567ac38f2e864f34969516a2cda4c58d9102fb28c";
const EXPECTED_METADATA_DIGEST =
  "7afa4fc0804f768ab00e78e4c780b94e50ac34a3e69647bed4d7264aa7085105";
const EXPECTED_SNAPSHOT_SET_DIGEST =
  "6e2cd04e8f7fb82c16b825c373d27efb2abc44dc6356469085f39df2076c1840";
const EXPECTED_LIVE_BASELINE_CONTRACT_DIGEST =
  "51b2108c9e350471f458f49af5eb06e3a4f304e8798fab87e4dedc67e8f32fa1";

const EXPECTED_COUNTS = Object.freeze(
  {"rollbackStudentRows":156,"rollbackPrincipalRows":12,"rollbackAttendanceDocuments":69,"rollbackAssignmentDocuments":14,"rollbackFirebaseAuthUsers":1,"inPlaceAttendancePlans":68}
);

const PRODUCTION_CLASS_IDS =
  new Set<string>(
    ["legacy_be6cdec2e74913ad6a592337","legacy_b6fad49fff01b4faec699a11","legacy_6fc7aa0bea97feab00ededac","legacy_01cf1f6aaba3410040b7c0d6","legacy_223bffbeb57408d77cb6d6bb","legacy_b97e046750e878aec1555d4b","legacy_c62b2b8cfff6d58f937329f9"]
  );

const EXPECTED_DATA_RECORDS =
  320;
const EXPECTED_TOTAL_WRITES =
  321;

type GenericRecord =
  Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly sheetSnapshotDigest?: unknown;
  readonly sheetSnapshot?: unknown;
  readonly confirmOperationalBaselineSnapshot?: unknown;
  readonly confirmExpectedWriteCount?: unknown;
  readonly confirmNoSourceWrites?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
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
    return value.map(
      canonicalize
    );
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
            value as
              GenericRecord
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
    .update(
      value,
      "utf8"
    )
    .digest("hex");
}

function stableId(
  value: string
): string {
  return sha256(value)
    .slice(0, 40);
}

function validateStageInput(
  value: unknown
) {
  const source =
    value &&
    typeof value === "object"
      ? value as StageInput
      : {};

  const checks = {
    requestId:
      text(source.requestId) ===
      REQUEST_ID,
    contractDigest:
      text(source.contractDigest) ===
      EXPECTED_LIVE_BASELINE_CONTRACT_DIGEST,
    confirmOperationalBaselineSnapshot:
      source.confirmOperationalBaselineSnapshot ===
      true,
    confirmExpectedWriteCount:
      Number(
        source.confirmExpectedWriteCount ||
        0
      ) ===
      EXPECTED_TOTAL_WRITES,
    confirmNoSourceWrites:
      source.confirmNoSourceWrites ===
      true
  };

  const failed =
    Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([key]) => key);

  if (failed.length > 0) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-8R input gate failed: ${failed.join(", ")}`
    );
  }

  const sheetSnapshot =
    asRecord(
      source.sheetSnapshot,
      "sheetSnapshot"
    );

  const calculatedSheetSnapshotDigest =
    sha256(
      JSON.stringify(
        canonicalize(
          sheetSnapshot
        )
      )
    );

  if (
    calculatedSheetSnapshotDigest !==
    text(source.sheetSnapshotDigest)
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Sheet live baseline snapshot digest mismatch."
    );
  }

  return {
    sheetSnapshot,
    sheetSnapshotDigest:
      calculatedSheetSnapshotDigest
  };
}

function serializeFirestoreValue(
  value: unknown
): unknown {
  if (
    value instanceof Timestamp
  ) {
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
        value.toString("base64")
    };
  }

  if (Array.isArray(value)) {
    return value.map(
      serializeFirestoreValue
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const candidate =
      value as GenericRecord;

    if (
      typeof candidate.latitude ===
        "number" &&
      typeof candidate.longitude ===
        "number"
    ) {
      return {
        __type:
          "GeoPoint",
        latitude:
          candidate.latitude,
        longitude:
          candidate.longitude
      };
    }

    const output:
      GenericRecord = {};

    for (
      const [
        key,
        nested
      ] of Object.entries(candidate)
    ) {
      output[key] =
        serializeFirestoreValue(
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
      user.email || null,
    emailVerified:
      user.emailVerified,
    displayName:
      user.displayName || null,
    phoneNumber:
      user.phoneNumber || null,
    photoURL:
      user.photoURL || null,
    customClaims:
      user.customClaims || {},
    providerData:
      user.providerData.map(
        (provider) => ({
          uid:
            provider.uid,
          providerId:
            provider.providerId,
          email:
            provider.email || null,
          displayName:
            provider.displayName || null,
          phoneNumber:
            provider.phoneNumber || null,
          photoURL:
            provider.photoURL || null
        })
      ),
    stableMetadata: {
      creationTime:
        user.metadata.creationTime
    },
    tokensValidAfterTime:
      user.tokensValidAfterTime,
    passwordMaterialIncluded:
      false,
    rollbackPolicy:
      "re_enable_existing_old_user_restore_claims_before_retiring_new_user"
  };
}

function rewriteUidString(
  value: string,
  studentAliases:
    Map<string, string>,
  principalAliases:
    Map<string, string>
): string {
  if (studentAliases.has(value)) {
    return (
      studentAliases.get(value) ||
      value
    );
  }

  if (principalAliases.has(value)) {
    return (
      principalAliases.get(value) ||
      value
    );
  }

  if (value.startsWith("UID|")) {
    const oldUid =
      value.slice(4);

    if (studentAliases.has(oldUid)) {
      return (
        "UID|" +
        studentAliases.get(oldUid)
      );
    }
  }

  return value;
}

function buildUidPatch(
  value: unknown,
  fieldPath: string,
  studentAliases:
    Map<string, string>,
  principalAliases:
    Map<string, string>,
  patch:
    GenericRecord
): unknown {
  if (typeof value === "string") {
    const rewritten =
      rewriteUidString(
        value,
        studentAliases,
        principalAliases
      );

    if (rewritten !== value) {
      patch[fieldPath] =
        rewritten;
    }

    return rewritten;
  }

  if (Array.isArray(value)) {
    const rewritten =
      value.map(
        (item, index) =>
          buildUidPatch(
            item,
            `${fieldPath}.${index}`,
            studentAliases,
            principalAliases,
            patch
          )
      );

    if (
      JSON.stringify(
        serializeFirestoreValue(
          rewritten
        )
      ) !==
      JSON.stringify(
        serializeFirestoreValue(
          value
        )
      )
    ) {
      patch[fieldPath] =
        rewritten;
    }

    return rewritten;
  }

  if (
    value &&
    typeof value === "object" &&
    !(value instanceof Timestamp) &&
    !(value instanceof DocumentReference) &&
    !Buffer.isBuffer(value)
  ) {
    const output:
      GenericRecord = {};

    for (
      const [
        key,
        nested
      ] of Object.entries(
        value as GenericRecord
      )
    ) {
      const nestedPath =
        fieldPath
          ? `${fieldPath}.${key}`
          : key;

      output[key] =
        buildUidPatch(
          nested,
          nestedPath,
          studentAliases,
          principalAliases,
          patch
        );
    }

    return output;
  }

  return value;
}

function classIdFromAttendance(
  path: string,
  data: GenericRecord
): string {
  const direct =
    text(data.classId);

  if (direct) {
    return direct;
  }

  for (
    const classId of
    PRODUCTION_CLASS_IDS
  ) {
    if (path.includes(classId)) {
      return classId;
    }
  }

  return "";
}

async function verifyCounts(
  runRef:
    DocumentReference<DocumentData>
) {
  const names =
    Object.keys(
      EXPECTED_COUNTS
    );

  const counts:
    Record<string, number> = {};

  for (const name of names) {
    counts[name] =
      (
        await runRef
          .collection(name)
          .get()
      ).size;
  }

  const checks =
    Object.fromEntries(
      Object.entries(
        EXPECTED_COUNTS
      )
        .map(
          (
            [
              key,
              expected
            ]
          ) => [
            key,
            counts[key] ===
            expected
          ]
        )
    );

  const failed =
    Object.entries(checks)
      .filter(
        (
          [, passed]
        ) =>
          !passed
      )
      .map(
        (
          [key]
        ) =>
          key
      );

  return {
    verified:
      failed.length === 0,
    counts,
    checks,
    failed,
    readOperations:
      EXPECTED_DATA_RECORDS +
      1
  };
}

function publicResult(
  metadata: GenericRecord,
  duplicate: boolean,
  writeOperations: number
) {
  return {
    ok: true,
    version:
      UID_V2_REBASE_LIVE_BASELINE_PHASE4C8R_VERSION,
    mode:
      "rebase156_operational_live_baseline_staging",
    requestId:
      text(metadata.requestId),
    duplicate,
    writeOperations,
    status:
      text(metadata.status),
    liveBaselineDigest:
      text(
        metadata.rollbackSnapshotDigest
      ),
    sheetSnapshotDigest:
      text(
        metadata.sheetSnapshotDigest
      ),
    counts:
      metadata.counts,
    expectedDataRecords:
      EXPECTED_DATA_RECORDS,
    expectedTotalWrites:
      EXPECTED_TOTAL_WRITES,
    safety: {
      isolatedRollbackWrites:
        writeOperations,
      activeUidRegistryWrites:
        0,
      sourceSheetWrites:
        0,
      attendanceWrites:
        0,
      assignmentWrites:
        0,
      firebaseAuthWrites:
        0,
      sessionChanges:
        0,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        "Phase 4C-9R post-baseline live drift audit",
      allowed:
        text(metadata.status) ===
        "rebase_live_baseline_staged",
      actualUidCutoverAllowed:
        false
    }
  };
}

export const stageUidV2RebaseLiveBaselinePhase4c8r =
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
        validateStageInput(
          request.data
        );

      const app =
        defaultAdminApp();

      const db =
        getFirestore(app);

      const auth =
        getAuth(app);

      const runRef =
        db.collection(
          "uidV2StagingRuns"
        ).doc(
          REQUEST_ID
        );

      const metaRef =
        runRef
          .collection("rollbackMeta")
          .doc("snapshot");

      const existingMeta =
        await metaRef.get();

      if (existingMeta.exists) {
        const metadata =
          existingMeta.data() || {};

        if (
          text(
            metadata.sheetSnapshotDigest
          ) !==
            input.sheetSnapshotDigest ||
          text(
            metadata.approvedByFirebaseUid
          ) !==
            callerUid ||
          text(
            metadata.liveBaselineContractDigest
          ) !==
            EXPECTED_LIVE_BASELINE_CONTRACT_DIGEST
        ) {
          throw new HttpsError(
            "already-exists",
            "A different rollback snapshot already exists."
          );
        }

        const verification =
          await verifyCounts(
            runRef
          );

        return {
          ...publicResult(
            metadata,
            true,
            0
          ),
          verification
        };
      }

      const [
        fanoutMetaSnapshot,
        rehearsalResultSnapshot,
        studentAliasSnapshot,
        principalAliasSnapshot,
        fanoutStudentSnapshot,
        fanoutPrincipalSnapshot,
        assignmentMappingSnapshot,
        attendanceMappingSnapshot,
        authTransitionSnapshot,
        attendanceSourceSnapshot
      ] = await Promise.all([
        runRef
          .collection("rebaseFanoutMetadata")
          .doc("phase4c5r")
          .get(),
        runRef
          .collection("rebaseRehearsalResults")
          .doc("phase4c7r")
          .get(),
        runRef
          .collection(
            "rebaseFanoutStudentAliases"
          )
          .get(),
        runRef
          .collection(
            "rebaseFanoutPrincipalAliases"
          )
          .get(),
        runRef
          .collection(
            "rebaseFanoutStudents"
          )
          .get(),
        runRef
          .collection(
            "rebaseFanoutPrincipals"
          )
          .get(),
        runRef
          .collection(
            "rebaseFanoutAssignmentMappings"
          )
          .get(),
        runRef
          .collection(
            "rebaseFanoutAttendanceMappings"
          )
          .get(),
        runRef
          .collection(
            "rebaseFanoutAuthTransitions"
          )
          .get(),
        db.collection(
          "attendance"
        ).get()
      ]);

      if (
        !fanoutMetaSnapshot.exists ||
        !rehearsalResultSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-5R metadata or Phase 4C-7R rehearsal result is missing."
        );
      }

      const fanoutMeta =
        fanoutMetaSnapshot.data() || {};

      const rehearsalResult =
        rehearsalResultSnapshot.data() || {};

      const fanoutChecks = {
        fanoutStatus:
          text(fanoutMeta.status) ===
          "rebase_isolated_fanout_verified",
        fanoutCaller:
          text(
            fanoutMeta.approvedByFirebaseUid
          ) ===
          callerUid,
        payloadDigest:
          text(
            fanoutMeta.payloadDigest
          ) ===
          EXPECTED_PAYLOAD_DIGEST,
        fanoutDesignDigest:
          text(
            fanoutMeta.fanoutDesignDigest
          ) ===
          EXPECTED_FANOUT_DIGEST,
        fanoutContract:
          text(
            fanoutMeta.contractDigest
          ) ===
          EXPECTED_PHASE4C5R_CONTRACT_DIGEST,
        recordSetDigest:
          text(
            fanoutMeta.recordSetDigest
          ) ===
          EXPECTED_RECORD_SET_DIGEST,
        metadataDigest:
          text(
            fanoutMeta.metadataDigest
          ) ===
          EXPECTED_METADATA_DIGEST,
        fanoutCount:
          Number(
            fanoutMeta.totalWrites ||
            0
          ) ===
          284,
        rehearsalStatus:
          text(
            rehearsalResult.status
          ) ===
          "rebase_delete_restore_rehearsal_verified",
        rehearsalCaller:
          text(
            rehearsalResult.approvedByFirebaseUid
          ) ===
          callerUid,
        rehearsalContract:
          text(
            rehearsalResult.contractDigest
          ) ===
          EXPECTED_PHASE4C7R_CONTRACT_DIGEST,
        rehearsalDigest:
          text(
            rehearsalResult.rehearsalResultDigest
          ) ===
          EXPECTED_REHEARSAL_RESULT_DIGEST,
        rehearsalRestored:
          rehearsalResult.postRestoreVerified ===
            true &&
          Number(
            rehearsalResult.restoredDocumentCount ||
            0
          ) ===
            284 &&
          text(
            rehearsalResult.afterSetDigest
          ) ===
            EXPECTED_SNAPSHOT_SET_DIGEST,
        cutoverBlocked:
          (
            fanoutMeta.safety as GenericRecord
          )?.actualUidCutoverAllowed ===
            false &&
          (
            rehearsalResult.safety as GenericRecord
          )?.actualUidCutoverAllowed ===
            false
      };
      const failedFanout =
        Object.entries(
          fanoutChecks
        )
          .filter(
            (
              [, passed]
            ) =>
              !passed
          )
          .map(
            (
              [key]
            ) =>
              key
          );

      if (failedFanout.length > 0) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-8R source-chain gate failed: ${failedFanout.join(", ")}`
        );
      }

      const sheetStudents =
        asArray(
          input.sheetSnapshot.students,
          "sheetSnapshot.students"
        );

      const sheetPrincipals =
        asArray(
          input.sheetSnapshot.principals,
          "sheetSnapshot.principals"
        );

      if (
        sheetStudents.length !==
          EXPECTED_COUNTS
            .rollbackStudentRows ||
        sheetPrincipals.length !==
          EXPECTED_COUNTS
            .rollbackPrincipalRows
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Sheet rollback snapshot counts are incorrect."
        );
      }

      const stagedStudentUidSet =
        new Set(
          fanoutStudentSnapshot.docs
            .map(
              (document) =>
                document.id
            )
        );

      const stagedPrincipalUidSet =
        new Set(
          fanoutPrincipalSnapshot.docs
            .map(
              (document) =>
                document.id
            )
        );

      for (
        const [
          index,
          item
        ] of sheetStudents.entries()
      ) {
        const record =
          asRecord(
            item,
            `sheetSnapshot.students[${index}]`
          );

        if (
          !stagedStudentUidSet.has(
            text(record.newUid)
          )
        ) {
          throw new HttpsError(
            "failed-precondition",
            `Student snapshot UID is not in Phase 4C-5R isolated fan-out: ${index}`
          );
        }
      }

      for (
        const [
          index,
          item
        ] of sheetPrincipals.entries()
      ) {
        const record =
          asRecord(
            item,
            `sheetSnapshot.principals[${index}]`
          );

        if (
          !stagedPrincipalUidSet.has(
            text(record.newUid)
          )
        ) {
          throw new HttpsError(
            "failed-precondition",
            `Principal snapshot UID is not in Phase 4C-5R isolated fan-out: ${index}`
          );
        }
      }

      const studentAliases =
        new Map<string, string>(
          studentAliasSnapshot.docs
            .map(
              (document) => {
                const wrapper =
                  document.data();

                const data =
                  asRecord(
                    wrapper.data,
                    "student alias"
                  );

                return [
                  text(data.oldUid),
                  text(data.newUid)
                ] as [
                  string,
                  string
                ];
              }
            )
        );

      const principalAliases =
        new Map<string, string>(
          principalAliasSnapshot.docs
            .map(
              (document) => {
                const wrapper =
                  document.data();

                const data =
                  asRecord(
                    wrapper.data,
                    "principal alias"
                  );

                return [
                  text(data.oldUid),
                  text(data.newUid)
                ] as [
                  string,
                  string
                ];
              }
            )
        );

      const attendanceDocuments =
        attendanceSourceSnapshot.docs
          .filter(
            (document) => {
              const data =
                document.data();

              const classId =
                classIdFromAttendance(
                  document.ref.path,
                  data
                );

              return (
                !!classId &&
                PRODUCTION_CLASS_IDS.has(
                  classId
                )
              );
            }
          );

      if (
        attendanceDocuments.length !==
        EXPECTED_COUNTS
          .rollbackAttendanceDocuments
      ) {
        throw new HttpsError(
          "failed-precondition",
          `Production attendance count mismatch: ${attendanceDocuments.length}`
        );
      }

      const cloneSourcePaths =
        new Set(
          attendanceMappingSnapshot.docs
            .map(
              (document) =>
                text(
                  asRecord(
                    document.data().data,
                    "attendance mapping"
                  ).oldPath
                )
            )
        );

      if (cloneSourcePaths.size !== 1) {
        throw new HttpsError(
          "failed-precondition",
          "Exactly one path-clone attendance mapping is required."
        );
      }

      const rollbackAttendance:
        Array<{
          id: string;
          data: GenericRecord;
        }> = [];

      const inPlacePlans:
        Array<{
          id: string;
          data: GenericRecord;
        }> = [];

      for (
        const document of
        attendanceDocuments
      ) {
        const path =
          document.ref.path;

        const rawData =
          document.data();

        const serializedBefore =
          serializeFirestoreValue(
            rawData
          );

        rollbackAttendance.push({
          id:
            stableId(path),
          data: {
            sourcePath:
              path,
            sourceExistsAtSnapshot:
              true,
            beforeData:
              serializedBefore,
            beforeDigest:
              sha256(
                JSON.stringify(
                  canonicalize(
                    serializedBefore
                  )
                )
              ),
            payloadDigest:
              EXPECTED_PAYLOAD_DIGEST,
            fanoutDigest:
              EXPECTED_FANOUT_DIGEST,
            snapshotType:
              "attendance_document",
            actualUidCutoverAllowed:
              false
          }
        });

        if (!cloneSourcePaths.has(path)) {
          const patch:
            GenericRecord = {};

          buildUidPatch(
            rawData,
            "",
            studentAliases,
            principalAliases,
            patch
          );

          const normalizedPatch =
            Object.fromEntries(
              Object.entries(patch)
                .filter(
                  (
                    [
                      key
                    ]
                  ) =>
                    !!key &&
                    !/\.([0-9]+)$/.test(
                      key
                    )
                )
            );

          if (
            Object.keys(
              normalizedPatch
            ).length === 0
          ) {
            throw new HttpsError(
              "failed-precondition",
              `No UID patch was derived for in-place attendance: ${path}`
            );
          }

          inPlacePlans.push({
            id:
              stableId(path),
            data: {
              sourcePath:
                path,
              beforeDigest:
                rollbackAttendance[
                  rollbackAttendance.length -
                  1
                ].data.beforeDigest,
              patch:
                serializeFirestoreValue(
                  normalizedPatch
                ),
              patchDigest:
                sha256(
                  JSON.stringify(
                    canonicalize(
                      serializeFirestoreValue(
                        normalizedPatch
                      )
                    )
                  )
                ),
              changedFieldCount:
                Object.keys(
                  normalizedPatch
                ).length,
              planType:
                "in_place_uid_reference_update",
              payloadDigest:
                EXPECTED_PAYLOAD_DIGEST,
              actualUidCutoverAllowed:
                false
            }
          });
        }
      }

      if (
        inPlacePlans.length !==
        EXPECTED_COUNTS
          .inPlaceAttendancePlans
      ) {
        throw new HttpsError(
          "failed-precondition",
          `In-place attendance plan count mismatch: ${inPlacePlans.length}`
        );
      }

      const rollbackAssignments:
        Array<{
          id: string;
          data: GenericRecord;
        }> = [];

      for (
        const mappingDocument of
        assignmentMappingSnapshot.docs
      ) {
        const mapping =
          asRecord(
            mappingDocument.data().data,
            "assignment mapping"
          );

        const oldPath =
          text(mapping.oldPath);

        const newPath =
          text(mapping.newPath);

        const [
          sourceSnapshot,
          targetSnapshot
        ] = await Promise.all([
          db.doc(oldPath).get(),
          db.doc(newPath).get()
        ]);

        if (
          !sourceSnapshot.exists ||
          targetSnapshot.exists
        ) {
          throw new HttpsError(
            "failed-precondition",
            `Assignment source/target gate failed: ${oldPath}`
          );
        }

        const serialized =
          serializeFirestoreValue(
            sourceSnapshot.data() || {}
          );

        rollbackAssignments.push({
          id:
            stableId(oldPath),
          data: {
            sourcePath:
              oldPath,
            targetPath:
              newPath,
            sourceExistsAtSnapshot:
              true,
            targetAbsentAtSnapshot:
              true,
            beforeData:
              serialized,
            beforeDigest:
              sha256(
                JSON.stringify(
                  canonicalize(
                    serialized
                  )
                )
              ),
            payloadDigest:
              EXPECTED_PAYLOAD_DIGEST,
            snapshotType:
              "assignment_document",
            actualUidCutoverAllowed:
              false
          }
        });
      }

      if (
        rollbackAssignments.length !==
        EXPECTED_COUNTS
          .rollbackAssignmentDocuments
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Assignment rollback count mismatch."
        );
      }

      if (
        authTransitionSnapshot.size !==
        EXPECTED_COUNTS
          .rollbackFirebaseAuthUsers
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Firebase Auth transition count mismatch."
        );
      }

      const transition =
        asRecord(
          authTransitionSnapshot.docs[0]
            .data().data,
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

      const oldUser =
        await auth.getUser(
          oldFirebaseUid
        );

      let newUserExists =
        false;

      try {
        await auth.getUser(
          newFirebaseUid
        );

        newUserExists = true;
      } catch (error) {
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

      if (newUserExists) {
        throw new HttpsError(
          "failed-precondition",
          "Target PRN2 Firebase Auth user already exists."
        );
      }

      const authRollback = {
        sourceFirebaseUid:
          oldFirebaseUid,
        targetFirebaseUid:
          newFirebaseUid,
        sourceExistsAtSnapshot:
          true,
        targetAbsentAtSnapshot:
          true,
        beforeData:
          authSnapshot(oldUser),
        payloadDigest:
          EXPECTED_PAYLOAD_DIGEST,
        snapshotType:
          "firebase_auth_user",
        actualUidCutoverAllowed:
          false
      };

      const allForDigest = {
        sheetSnapshotDigest:
          input.sheetSnapshotDigest,
        students:
          sheetStudents,
        principals:
          sheetPrincipals,
        attendance:
          rollbackAttendance,
        assignments:
          rollbackAssignments,
        firebaseAuth:
          authRollback,
        inPlaceAttendancePlans:
          inPlacePlans
      };

      const rollbackSnapshotDigest =
        sha256(
          JSON.stringify(
            canonicalize(
              allForDigest
            )
          )
        );

      const estimatedBytes =
        Buffer.byteLength(
          JSON.stringify(
            serializeFirestoreValue(
              allForDigest
            )
          ),
          "utf8"
        );

      if (estimatedBytes > 8_000_000) {
        throw new HttpsError(
          "resource-exhausted",
          `Rollback batch estimate is too large: ${estimatedBytes}`
        );
      }

      const batch =
        db.batch();

      for (
        const item of sheetStudents
      ) {
        const record =
          asRecord(
            item,
            "student rollback row"
          );

        batch.create(
          runRef
            .collection(
              "rollbackStudentRows"
            )
            .doc(
              text(record.newUid)
            ),
          {
            ...record,
            sheetSnapshotDigest:
              input.sheetSnapshotDigest,
            rollbackSnapshotDigest,
            actualUidCutoverAllowed:
              false
          }
        );
      }

      for (
        const item of sheetPrincipals
      ) {
        const record =
          asRecord(
            item,
            "principal rollback row"
          );

        batch.create(
          runRef
            .collection(
              "rollbackPrincipalRows"
            )
            .doc(
              text(record.newUid)
            ),
          {
            ...record,
            sheetSnapshotDigest:
              input.sheetSnapshotDigest,
            rollbackSnapshotDigest,
            actualUidCutoverAllowed:
              false
          }
        );
      }

      for (
        const item of
        rollbackAttendance
      ) {
        batch.create(
          runRef
            .collection(
              "rollbackAttendanceDocuments"
            )
            .doc(item.id),
          {
            ...item.data,
            rollbackSnapshotDigest
          }
        );
      }

      for (
        const item of
        rollbackAssignments
      ) {
        batch.create(
          runRef
            .collection(
              "rollbackAssignmentDocuments"
            )
            .doc(item.id),
          {
            ...item.data,
            rollbackSnapshotDigest
          }
        );
      }

      batch.create(
        runRef
          .collection(
            "rollbackFirebaseAuthUsers"
          )
          .doc(
            stableId(
              oldFirebaseUid
            )
          ),
        {
          ...authRollback,
          rollbackSnapshotDigest
        }
      );

      for (
        const item of
        inPlacePlans
      ) {
        batch.create(
          runRef
            .collection(
              "inPlaceAttendancePlans"
            )
            .doc(item.id),
          {
            ...item.data,
            rollbackSnapshotDigest
          }
        );
      }

      const metadata: GenericRecord = {
        version:
          UID_V2_REBASE_LIVE_BASELINE_PHASE4C8R_VERSION,
        phase:
          "Phase 4C-8R",
        mode:
          "rebase156_operational_live_baseline_staging",
        requestId:
          REQUEST_ID,
        status:
          "rebase_live_baseline_staged",
        approvedByFirebaseUid:
          callerUid,
        stagedAt:
          Timestamp.now(),
        payloadDigest:
          EXPECTED_PAYLOAD_DIGEST,
        fanoutDesignDigest:
          EXPECTED_FANOUT_DIGEST,
        phase4c5rContractDigest:
          EXPECTED_PHASE4C5R_CONTRACT_DIGEST,
        phase4c7rContractDigest:
          EXPECTED_PHASE4C7R_CONTRACT_DIGEST,
        rehearsalResultDigest:
          EXPECTED_REHEARSAL_RESULT_DIGEST,
        sourceRecordSetDigest:
          EXPECTED_RECORD_SET_DIGEST,
        sourceMetadataDigest:
          EXPECTED_METADATA_DIGEST,
        snapshotSetDigest:
          EXPECTED_SNAPSHOT_SET_DIGEST,
        liveBaselineContractDigest:
          EXPECTED_LIVE_BASELINE_CONTRACT_DIGEST,
        sheetSnapshotDigest:
          input.sheetSnapshotDigest,
        rollbackSnapshotDigest,
        estimatedBytes,
        counts:
          EXPECTED_COUNTS,
        dataRecordWrites:
          EXPECTED_DATA_RECORDS,
        totalIsolatedWrites:
          EXPECTED_TOTAL_WRITES,
        activeUidRegistryWrites:
          0,
        sourceDataWrites:
          0,
        actualUidCutoverAllowed:
          false
      };

      batch.create(
        metaRef,
        metadata
      );

      await batch.commit();

      const verification =
        await verifyCounts(
          runRef
        );

      if (!verification.verified) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-8R post-write count verification failed."
        );
      }

      return {
        ...publicResult(
          metadata,
          false,
          EXPECTED_TOTAL_WRITES
        ),
        verification
      };
    }
  );

export const inspectUidV2RebaseLiveBaselinePhase4c8r =
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
        text(input.requestId) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          EXPECTED_LIVE_BASELINE_CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-8R inspect gate failed."
        );
      }

      const runRef =
        getFirestore(
          defaultAdminApp()
        )
          .collection(
            "uidV2StagingRuns"
          )
          .doc(
            REQUEST_ID
          );

      const metadataSnapshot =
        await runRef
          .collection("rollbackMeta")
          .doc("snapshot")
          .get();

      if (!metadataSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-8R live baseline metadata was not found."
        );
      }

      const metadata =
        metadataSnapshot.data() || {};

      const verification =
        await verifyCounts(
          runRef
        );

      const metadataChecks = {
        status:
          text(metadata.status) ===
          "rebase_live_baseline_staged",
        contract:
          text(
            metadata.liveBaselineContractDigest
          ) ===
          EXPECTED_LIVE_BASELINE_CONTRACT_DIGEST,
        payload:
          text(
            metadata.payloadDigest
          ) ===
          EXPECTED_PAYLOAD_DIGEST,
        fanoutDesign:
          text(
            metadata.fanoutDesignDigest
          ) ===
          EXPECTED_FANOUT_DIGEST,
        rehearsal:
          text(
            metadata.rehearsalResultDigest
          ) ===
          EXPECTED_REHEARSAL_RESULT_DIGEST,
        snapshotSet:
          text(
            metadata.snapshotSetDigest
          ) ===
          EXPECTED_SNAPSHOT_SET_DIGEST,
        counts:
          JSON.stringify(
            canonicalize(
              metadata.counts
            )
          ) ===
          JSON.stringify(
            canonicalize(
              EXPECTED_COUNTS
            )
          ),
        totalWrites:
          Number(
            metadata.totalIsolatedWrites ||
            0
          ) ===
          EXPECTED_TOTAL_WRITES,
        sourceWritesBlocked:
          Number(
            metadata.sourceDataWrites ||
            0
          ) ===
            0 &&
          Number(
            metadata.activeUidRegistryWrites ||
            0
          ) ===
            0 &&
          metadata.actualUidCutoverAllowed ===
            false,
        collectionCounts:
          verification.verified ===
          true
      };

      const failedMetadataChecks =
        Object.entries(metadataChecks)
          .filter(([, passed]) => !passed)
          .map(([key]) => key);

      if (failedMetadataChecks.length > 0) {
        throw new HttpsError(
          "data-loss",
          `Phase 4C-8R stored baseline verification failed: ${failedMetadataChecks.join(", ")}`,
          {
            failedMetadataChecks,
            verification
          }
        );
      }

      return {
        ...publicResult(
          metadata,
          true,
          0
        ),
        verification,
        metadataChecks,
        failedMetadataChecks,
        verified:
          true,
        digestMatches:
          true,
        rollbackCoverageComplete:
          true,
        inPlaceAttendancePlanCount:
          EXPECTED_COUNTS
            .inPlaceAttendancePlans
      };
    }
  );
