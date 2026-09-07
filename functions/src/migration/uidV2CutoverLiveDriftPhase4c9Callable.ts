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

export const UID_V2_LIVE_DRIFT_AUDIT_PHASE4C9_VERSION =
  "2026-07-25.716.29-phase4c9-live-drift-auth-stable-state-source-recovery";

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
const EXPECTED_ROLLBACK_SNAPSHOT_DIGEST =
  "5f316b9695d04e8b156e2c9e24e7e03329a8e4365edd5e944d3d18aee279e457";
const EXPECTED_SHEET_SNAPSHOT_DIGEST =
  "e6eeb89912b8b96973be17e49e0710ede438691f335033e43349f07f4fc00a67";
const EXPECTED_LIVE_AUDIT_CONTRACT_DIGEST =
  "ec11394a67544ca2fc6abb8b82fe37b4afa17201dbd31f4133f9787803650d7a";

const EXPECTED_COUNTS = Object.freeze(
  {"rollbackStudentRows":155,"rollbackPrincipalRows":12,"rollbackAttendanceDocuments":69,"rollbackAssignmentDocuments":14,"rollbackFirebaseAuthUsers":1,"inPlaceAttendancePlans":68}
);

type GenericRecord =
  Record<string, unknown>;

interface InputData {
  readonly requestId?: unknown;
  readonly rollbackSnapshotDigest?: unknown;
  readonly liveAuditContractDigest?: unknown;
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

function validateInput(
  value: unknown
): void {
  const source =
    value &&
    typeof value === "object"
      ? value as InputData
      : {};

  const checks = {
    requestId:
      text(source.requestId) ===
      REQUEST_ID,
    rollbackSnapshotDigest:
      text(
        source.rollbackSnapshotDigest
      ) ===
      EXPECTED_ROLLBACK_SNAPSHOT_DIGEST,
    liveAuditContractDigest:
      text(
        source.liveAuditContractDigest
      ) ===
      EXPECTED_LIVE_AUDIT_CONTRACT_DIGEST
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
      `Phase 4C-9 input gate failed: ${failed.join(", ")}`
    );
  }
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

function dataDigest(
  value: unknown
): string {
  return sha256(
    JSON.stringify(
      canonicalize(
        serializeFirestoreValue(
          value
        )
      )
    )
  );
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

function stableAuthState(
  value: unknown
): GenericRecord {
  const source =
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? value as GenericRecord
      : {};

  const metadata =
    source.metadata &&
    typeof source.metadata ===
      "object" &&
    !Array.isArray(source.metadata)
      ? source.metadata as
          GenericRecord
      : {};

  const providerData =
    Array.isArray(source.providerData)
      ? source.providerData
          .map(
            (item) => {
              const provider =
                item &&
                typeof item ===
                  "object" &&
                !Array.isArray(item)
                  ? item as
                      GenericRecord
                  : {};

              return {
                uid:
                  text(provider.uid),
                providerId:
                  text(
                    provider.providerId
                  ),
                email:
                  typeof provider.email ===
                    "string"
                    ? provider.email
                    : null,
                displayName:
                  typeof provider.displayName ===
                    "string"
                    ? provider.displayName
                    : null,
                phoneNumber:
                  typeof provider.phoneNumber ===
                    "string"
                    ? provider.phoneNumber
                    : null,
                photoURL:
                  typeof provider.photoURL ===
                    "string"
                    ? provider.photoURL
                    : null
              };
            }
          )
          .sort(
            (
              left,
              right
            ) =>
              (
                left.providerId +
                "|" +
                left.uid
              ).localeCompare(
                right.providerId +
                "|" +
                right.uid
              )
          )
      : [];

  const customClaims =
    source.customClaims &&
    typeof source.customClaims ===
      "object" &&
    !Array.isArray(
      source.customClaims
    )
      ? source.customClaims
      : {};

  return {
    uid:
      text(source.uid),
    disabled:
      source.disabled === true,
    email:
      typeof source.email ===
        "string"
        ? source.email
        : null,
    emailVerified:
      source.emailVerified ===
      true,
    displayName:
      typeof source.displayName ===
        "string"
        ? source.displayName
        : null,
    phoneNumber:
      typeof source.phoneNumber ===
        "string"
        ? source.phoneNumber
        : null,
    photoURL:
      typeof source.photoURL ===
        "string"
        ? source.photoURL
        : null,
    customClaims,
    providerData,
    creationTime:
      typeof metadata.creationTime ===
        "string"
        ? metadata.creationTime
        : null,
    tokensValidAfterTime:
      typeof source.tokensValidAfterTime ===
        "string"
        ? source.tokensValidAfterTime
        : null,
    passwordMaterialIncluded:
      false
  };
}

async function userExists(
  uid: string
): Promise<boolean> {
  try {
    await getAuth(
      defaultAdminApp()
    ).getUser(uid);

    return true;
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
      code ===
      "auth/user-not-found"
    ) {
      return false;
    }

    throw error;
  }
}

export const inspectUidV2CutoverLiveDriftPhase4c9 =
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

      validateInput(
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

      const [
        fanoutMetaSnapshot,
        rollbackMetaSnapshot,
        rollbackStudentRows,
        rollbackPrincipalRows,
        rollbackAttendance,
        rollbackAssignments,
        rollbackAuthUsers,
        inPlacePlans,
        attendanceMappings
      ] = await Promise.all([
        runRef
          .collection("fanoutMeta")
          .doc("allocation")
          .get(),
        runRef
          .collection("rollbackMeta")
          .doc("snapshot")
          .get(),
        runRef
          .collection(
            "rollbackStudentRows"
          )
          .get(),
        runRef
          .collection(
            "rollbackPrincipalRows"
          )
          .get(),
        runRef
          .collection(
            "rollbackAttendanceDocuments"
          )
          .get(),
        runRef
          .collection(
            "rollbackAssignmentDocuments"
          )
          .get(),
        runRef
          .collection(
            "rollbackFirebaseAuthUsers"
          )
          .get(),
        runRef
          .collection(
            "inPlaceAttendancePlans"
          )
          .get(),
        runRef
          .collection(
            "fanoutAttendanceMappings"
          )
          .get()
      ]);

      if (
        !fanoutMetaSnapshot.exists ||
        !rollbackMetaSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-6 or Phase 4C-8 metadata is missing."
        );
      }

      const fanoutMeta =
        fanoutMetaSnapshot.data() || {};

      const rollbackMeta =
        rollbackMetaSnapshot.data() || {};

      const metadataChecks = {
        caller:
          text(
            rollbackMeta.approvedByFirebaseUid
          ) ===
          callerUid,
        fanoutStatus:
          text(fanoutMeta.status) ===
          "fanout_staged",
        rollbackStatus:
          text(rollbackMeta.status) ===
          "rollback_snapshot_staged",
        payloadDigest:
          text(
            rollbackMeta.payloadDigest
          ) ===
          EXPECTED_PAYLOAD_DIGEST,
        fanoutDigest:
          text(
            rollbackMeta.fanoutDigest
          ) ===
          EXPECTED_FANOUT_DIGEST,
        phase4c6ContractDigest:
          text(
            rollbackMeta.phase4c6ContractDigest
          ) ===
          EXPECTED_PHASE4C6_CONTRACT_DIGEST,
        preflightContractDigest:
          text(
            rollbackMeta.preflightContractDigest
          ) ===
          EXPECTED_PREFLIGHT_CONTRACT_DIGEST,
        rollbackContractDigest:
          text(
            rollbackMeta.rollbackContractDigest
          ) ===
          EXPECTED_ROLLBACK_CONTRACT_DIGEST,
        rollbackSnapshotDigest:
          text(
            rollbackMeta.rollbackSnapshotDigest
          ) ===
          EXPECTED_ROLLBACK_SNAPSHOT_DIGEST,
        sheetSnapshotDigest:
          text(
            rollbackMeta.sheetSnapshotDigest
          ) ===
          EXPECTED_SHEET_SNAPSHOT_DIGEST,
        cutoverBlocked:
          rollbackMeta.actualUidCutoverAllowed ===
          false
      };

      const countChecks = {
        rollbackStudentRows:
          rollbackStudentRows.size ===
          EXPECTED_COUNTS
            .rollbackStudentRows,
        rollbackPrincipalRows:
          rollbackPrincipalRows.size ===
          EXPECTED_COUNTS
            .rollbackPrincipalRows,
        rollbackAttendanceDocuments:
          rollbackAttendance.size ===
          EXPECTED_COUNTS
            .rollbackAttendanceDocuments,
        rollbackAssignmentDocuments:
          rollbackAssignments.size ===
          EXPECTED_COUNTS
            .rollbackAssignmentDocuments,
        rollbackFirebaseAuthUsers:
          rollbackAuthUsers.size ===
          EXPECTED_COUNTS
            .rollbackFirebaseAuthUsers,
        inPlaceAttendancePlans:
          inPlacePlans.size ===
          EXPECTED_COUNTS
            .inPlaceAttendancePlans
      };

      const attendanceChecks:
        Array<GenericRecord> = [];

      for (
        const document of
        rollbackAttendance.docs
      ) {
        const rollback =
          document.data();

        const sourcePath =
          text(rollback.sourcePath);

        const source =
          await db.doc(
            sourcePath
          ).get();

        attendanceChecks.push({
          id:
            document.id,
          sourcePath,
          sourceExists:
            source.exists,
          beforeDigestMatches:
            source.exists &&
            dataDigest(
              source.data() || {}
            ) ===
            text(
              rollback.beforeDigest
            )
        });
      }

      const assignmentChecks:
        Array<GenericRecord> = [];

      for (
        const document of
        rollbackAssignments.docs
      ) {
        const rollback =
          document.data();

        const sourcePath =
          text(rollback.sourcePath);

        const targetPath =
          text(rollback.targetPath);

        const [
          source,
          target
        ] = await Promise.all([
          db.doc(
            sourcePath
          ).get(),
          db.doc(
            targetPath
          ).get()
        ]);

        assignmentChecks.push({
          id:
            document.id,
          sourcePath,
          targetPath,
          sourceExists:
            source.exists,
          targetAbsent:
            !target.exists,
          beforeDigestMatches:
            source.exists &&
            dataDigest(
              source.data() || {}
            ) ===
            text(
              rollback.beforeDigest
            )
        });
      }

      const inPlaceChecks:
        Array<GenericRecord> = [];

      for (
        const document of
        inPlacePlans.docs
      ) {
        const plan =
          document.data();

        const sourcePath =
          text(plan.sourcePath);

        const source =
          await db.doc(
            sourcePath
          ).get();

        const patch =
          plan.patch &&
          typeof plan.patch ===
            "object"
            ? plan.patch as
                GenericRecord
            : {};

        inPlaceChecks.push({
          id:
            document.id,
          sourcePath,
          sourceExists:
            source.exists,
          beforeDigestMatches:
            source.exists &&
            dataDigest(
              source.data() || {}
            ) ===
            text(
              plan.beforeDigest
            ),
          patchPresent:
            Object.keys(patch)
              .length > 0,
          changedFieldCountValid:
            Number(
              plan.changedFieldCount ||
              0
            ) > 0
        });
      }

      const cloneChecks:
        Array<GenericRecord> = [];

      for (
        const document of
        attendanceMappings.docs
      ) {
        const mapping =
          document.data();

        const sourcePath =
          text(mapping.oldPath);

        const targetPath =
          text(mapping.newPath);

        const [
          source,
          target
        ] = await Promise.all([
          db.doc(
            sourcePath
          ).get(),
          db.doc(
            targetPath
          ).get()
        ]);

        cloneChecks.push({
          id:
            document.id,
          sourcePath,
          targetPath,
          sourceExists:
            source.exists,
          targetAbsent:
            !target.exists
        });
      }

      const authChecks:
        Array<GenericRecord> = [];

      for (
        const document of
        rollbackAuthUsers.docs
      ) {
        const rollback =
          document.data();

        const sourceUid =
          text(
            rollback.sourceFirebaseUid
          );

        const targetUid =
          text(
            rollback.targetFirebaseUid
          );

        const sourceUser =
          await auth.getUser(
            sourceUid
          );

        authChecks.push({
          id:
            document.id,
          sourceFirebaseUid:
            sourceUid,
          targetFirebaseUid:
            targetUid,
          sourceExists:
            true,
          targetAbsent:
            !(
              await userExists(
                targetUid
              )
            ),
          beforeDigestMatches:
            dataDigest(
              stableAuthState(
                authSnapshot(
                  sourceUser
                )
              )
            ) ===
            dataDigest(
              stableAuthState(
                rollback.beforeData
              )
            ),
          passwordMaterialExcluded:
            (
              rollback.beforeData as
                GenericRecord
            )?.passwordMaterialIncluded ===
            false
        });
      }

      const attendanceStable =
        attendanceChecks.every(
          (item) =>
            item.sourceExists ===
              true &&
            item.beforeDigestMatches ===
              true
        );

      const assignmentsStable =
        assignmentChecks.every(
          (item) =>
            item.sourceExists ===
              true &&
            item.targetAbsent ===
              true &&
            item.beforeDigestMatches ===
              true
        );

      const inPlaceStable =
        inPlaceChecks.every(
          (item) =>
            item.sourceExists ===
              true &&
            item.beforeDigestMatches ===
              true &&
            item.patchPresent ===
              true &&
            item.changedFieldCountValid ===
              true
        );

      const cloneStable =
        cloneChecks.length === 1 &&
        cloneChecks.every(
          (item) =>
            item.sourceExists ===
              true &&
            item.targetAbsent ===
              true
        );

      const authStable =
        authChecks.length === 1 &&
        authChecks.every(
          (item) =>
            item.sourceExists ===
              true &&
            item.targetAbsent ===
              true &&
            item.beforeDigestMatches ===
              true &&
            item.passwordMaterialExcluded ===
              true
        );

      const failedMetadata =
        Object.entries(
          metadataChecks
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

      const failedCounts =
        Object.entries(
          countChecks
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

      const blockingReasons:
        string[] = [];

      if (
        failedMetadata.length > 0
      ) {
        blockingReasons.push(
          "METADATA_DIGEST_MISMATCH"
        );
      }

      if (
        failedCounts.length > 0
      ) {
        blockingReasons.push(
          "ROLLBACK_COUNT_MISMATCH"
        );
      }

      if (!attendanceStable) {
        blockingReasons.push(
          "ATTENDANCE_SOURCE_DRIFT"
        );
      }

      if (!assignmentsStable) {
        blockingReasons.push(
          "ASSIGNMENT_SOURCE_DRIFT_OR_TARGET_COLLISION"
        );
      }

      if (!inPlaceStable) {
        blockingReasons.push(
          "IN_PLACE_ATTENDANCE_PLAN_DRIFT"
        );
      }

      if (!cloneStable) {
        blockingReasons.push(
          "ATTENDANCE_CLONE_SOURCE_DRIFT_OR_TARGET_COLLISION"
        );
      }

      if (!authStable) {
        blockingReasons.push(
          "FIREBASE_AUTH_SOURCE_DRIFT_OR_TARGET_COLLISION"
        );
      }

      const readyForServerApproval =
        blockingReasons.length === 0;

      return {
        ok: true,
        version:
          UID_V2_LIVE_DRIFT_AUDIT_PHASE4C9_VERSION,
        mode:
          "live_source_drift_audit_read_only",
        requestId:
          REQUEST_ID,
        writeOperations:
          0,
        liveAuditContractDigest:
          EXPECTED_LIVE_AUDIT_CONTRACT_DIGEST,
        metadataChecks,
        failedMetadata,
        countChecks,
        failedCounts,
        attendance: {
          count:
            attendanceChecks.length,
          stable:
            attendanceStable,
          failed:
            attendanceChecks
              .filter(
                (item) =>
                  item.sourceExists !==
                    true ||
                  item.beforeDigestMatches !==
                    true
              )
              .map(
                (item) =>
                  item.id
              )
        },
        assignments: {
          count:
            assignmentChecks.length,
          stable:
            assignmentsStable,
          failed:
            assignmentChecks
              .filter(
                (item) =>
                  item.sourceExists !==
                    true ||
                  item.targetAbsent !==
                    true ||
                  item.beforeDigestMatches !==
                    true
              )
              .map(
                (item) =>
                  item.id
              )
        },
        inPlaceAttendance: {
          count:
            inPlaceChecks.length,
          stable:
            inPlaceStable,
          failed:
            inPlaceChecks
              .filter(
                (item) =>
                  item.sourceExists !==
                    true ||
                  item.beforeDigestMatches !==
                    true ||
                  item.patchPresent !==
                    true ||
                  item.changedFieldCountValid !==
                    true
              )
              .map(
                (item) =>
                  item.id
              )
        },
        attendanceClone: {
          count:
            cloneChecks.length,
          stable:
            cloneStable,
          failed:
            cloneChecks
              .filter(
                (item) =>
                  item.sourceExists !==
                    true ||
                  item.targetAbsent !==
                    true
              )
              .map(
                (item) =>
                  item.id
              )
        },
        firebaseAuth: {
          count:
            authChecks.length,
          stable:
            authStable,
          failed:
            authChecks
              .filter(
                (item) =>
                  item.sourceExists !==
                    true ||
                  item.targetAbsent !==
                    true ||
                  item.beforeDigestMatches !==
                    true ||
                  item.passwordMaterialExcluded !==
                    true
              )
              .map(
                (item) =>
                  item.id
              )
        },
        blockingReasons,
        readyForServerApproval,
        safety: {
          firestoreWrites:
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
          sessionChanges:
            0,
          approvalRecordWrites:
            0,
          commitCallableIncluded:
            false,
          sheetDriftCheckRequiredAtCommit:
            true,
          actualUidCutoverAllowed:
            false
        },
        nextGate: {
          phase:
            "Phase 4C-10 ten-minute approval record only",
          allowed:
            readyForServerApproval,
          actualUidCutoverAllowed:
            false
        }
      };
    }
  );
