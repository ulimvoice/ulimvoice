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

export const UID_V2_ROLLBACK_SNAPSHOT_PHASE4C8_VERSION =
  "2026-07-25.716.20-phase4c8-rollback-snapshot-isolated-staging";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c3-20260724142743-62e47ac1-8e06-4cf7-b379-25d2373fa42d";
const EXPECTED_PAYLOAD_DIGEST =
  "a3a7641e934772e39ea8241438517c1643435434c8636fbe00cbe415cc66ceae";
const EXPECTED_FANOUT_DIGEST =
  "674e6d52c970711f2ad20bce7c5171289a30abd26c85c2f0143eefaeef2f8f47";
const EXPECTED_PHASE4C6_CONTRACT_DIGEST =
  "88ae754641d3356f605ddd8593e7d3e3f6297286d2df294823833938df6e491e";
const EXPECTED_PREFLIGHT_CONTRACT_DIGEST =
  "de241a819114f7541e7acc832adef80bdbd089b440b2c09676bb56c03afd49db";
const EXPECTED_ROLLBACK_CONTRACT_DIGEST =
  "4adbc23d4312d0cededcee2ae5fb909256545c11ad5df840102fe2de83930983";

const EXPECTED_COUNTS = Object.freeze(
  {"rollbackStudentRows":155,"rollbackPrincipalRows":12,"rollbackAttendanceDocuments":69,"rollbackAssignmentDocuments":14,"rollbackFirebaseAuthUsers":1,"inPlaceAttendancePlans":68}
);

const PRODUCTION_CLASS_IDS =
  new Set<string>(
    ["legacy_be6cdec2e74913ad6a592337","legacy_b6fad49fff01b4faec699a11","legacy_6fc7aa0bea97feab00ededac","legacy_01cf1f6aaba3410040b7c0d6","legacy_223bffbeb57408d77cb6d6bb","legacy_b97e046750e878aec1555d4b","legacy_c62b2b8cfff6d58f937329f9"]
  );

const EXPECTED_DATA_RECORDS =
  319;
const EXPECTED_TOTAL_WRITES =
  320;

type GenericRecord =
  Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly payloadDigest?: unknown;
  readonly fanoutDigest?: unknown;
  readonly phase4c6ContractDigest?: unknown;
  readonly preflightContractDigest?: unknown;
  readonly rollbackContractDigest?: unknown;
  readonly sheetSnapshotDigest?: unknown;
  readonly sheetSnapshot?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly rollbackContractDigest?: unknown;
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
    payloadDigest:
      text(source.payloadDigest) ===
      EXPECTED_PAYLOAD_DIGEST,
    fanoutDigest:
      text(source.fanoutDigest) ===
      EXPECTED_FANOUT_DIGEST,
    phase4c6ContractDigest:
      text(
        source.phase4c6ContractDigest
      ) ===
      EXPECTED_PHASE4C6_CONTRACT_DIGEST,
    preflightContractDigest:
      text(
        source.preflightContractDigest
      ) ===
      EXPECTED_PREFLIGHT_CONTRACT_DIGEST,
    rollbackContractDigest:
      text(
        source.rollbackContractDigest
      ) ===
      EXPECTED_ROLLBACK_CONTRACT_DIGEST
  };

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

  if (failed.length > 0) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-8 input gate failed: ${failed.join(", ")}`
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
      "Sheet rollback snapshot digest mismatch."
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
    metadata: {
      creationTime:
        user.metadata.creationTime,
      lastSignInTime:
        user.metadata.lastSignInTime || null,
      lastRefreshTime:
        user.metadata.lastRefreshTime || null
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
      UID_V2_ROLLBACK_SNAPSHOT_PHASE4C8_VERSION,
    mode:
      "rollback_snapshot_isolated_staging",
    requestId:
      text(metadata.requestId),
    duplicate,
    writeOperations,
    status:
      text(metadata.status),
    rollbackSnapshotDigest:
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
        "Repeat Phase 4C-7 read-only cutover preflight",
      allowed:
        text(metadata.status) ===
        "rollback_snapshot_staged",
      actualUidCutoverAllowed:
        false
    }
  };
}

export const stageUidV2RollbackSnapshotPhase4c8 =
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
            metadata.rollbackContractDigest
          ) !==
            EXPECTED_ROLLBACK_CONTRACT_DIGEST
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
          .collection("fanoutMeta")
          .doc("allocation")
          .get(),
        runRef
          .collection(
            "fanoutStudentAliases"
          )
          .get(),
        runRef
          .collection(
            "fanoutPrincipalAliases"
          )
          .get(),
        runRef
          .collection(
            "fanoutStudents"
          )
          .get(),
        runRef
          .collection(
            "fanoutPrincipals"
          )
          .get(),
        runRef
          .collection(
            "fanoutAssignmentMappings"
          )
          .get(),
        runRef
          .collection(
            "fanoutAttendanceMappings"
          )
          .get(),
        runRef
          .collection(
            "fanoutFirebaseAuthTransitions"
          )
          .get(),
        db.collection(
          "attendance"
        ).get()
      ]);

      if (!fanoutMetaSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-6 fan-out metadata is missing."
        );
      }

      const fanoutMeta =
        fanoutMetaSnapshot.data() || {};

      const fanoutChecks = {
        status:
          text(fanoutMeta.status) ===
          "fanout_staged",
        caller:
          text(
            fanoutMeta.approvedByFirebaseUid
          ) ===
          callerUid,
        payloadDigest:
          text(
            fanoutMeta.payloadDigest
          ) ===
          EXPECTED_PAYLOAD_DIGEST,
        fanoutDigest:
          text(
            fanoutMeta.fanoutDigest
          ) ===
          EXPECTED_FANOUT_DIGEST,
        contractDigest:
          text(
            fanoutMeta.contractDigest
          ) ===
          EXPECTED_PHASE4C6_CONTRACT_DIGEST,
        cutoverBlocked:
          fanoutMeta.actualUidCutoverAllowed ===
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
          `Phase 4C-6 fan-out gate failed: ${failedFanout.join(", ")}`
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
            `Student snapshot UID is not in Phase 4C-6 fan-out: ${index}`
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
            `Principal snapshot UID is not in Phase 4C-6 fan-out: ${index}`
          );
        }
      }

      const studentAliases =
        new Map<string, string>(
          studentAliasSnapshot.docs
            .map(
              (document) => {
                const data =
                  document.data();

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
                const data =
                  document.data();

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
                  document.data().oldPath
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
          mappingDocument.data();

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
        authTransitionSnapshot.docs[0]
          .data();

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
          UID_V2_ROLLBACK_SNAPSHOT_PHASE4C8_VERSION,
        phase:
          "Phase 4C-8",
        mode:
          "rollback_snapshot_isolated_staging",
        requestId:
          REQUEST_ID,
        status:
          "rollback_snapshot_staged",
        approvedByFirebaseUid:
          callerUid,
        stagedAt:
          Timestamp.now(),
        payloadDigest:
          EXPECTED_PAYLOAD_DIGEST,
        fanoutDigest:
          EXPECTED_FANOUT_DIGEST,
        phase4c6ContractDigest:
          EXPECTED_PHASE4C6_CONTRACT_DIGEST,
        preflightContractDigest:
          EXPECTED_PREFLIGHT_CONTRACT_DIGEST,
        rollbackContractDigest:
          EXPECTED_ROLLBACK_CONTRACT_DIGEST,
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
          "Phase 4C-8 post-write count verification failed."
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

export const inspectUidV2RollbackSnapshotPhase4c8 =
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
          input.rollbackContractDigest
        ) !==
          EXPECTED_ROLLBACK_CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-8 inspect gate failed."
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
          "Phase 4C-8 rollback metadata was not found."
        );
      }

      const metadata =
        metadataSnapshot.data() || {};

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
  );
