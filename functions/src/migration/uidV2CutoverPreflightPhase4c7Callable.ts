import {
  App,
  getApp,
  getApps,
  initializeApp
} from "firebase-admin/app";
import {
  CollectionReference,
  DocumentData,
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_V2_CUTOVER_PREFLIGHT_PHASE4C7_VERSION =
  "2026-07-25.716.19-phase4c7-cutover-preflight-read-only";

const REGION = "asia-northeast3";
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

const EXPECTED_FANOUT = Object.freeze(
  {"fanoutStudents":155,"fanoutPrincipals":12,"fanoutStudentAliases":85,"fanoutPrincipalAliases":13,"fanoutAssignmentMappings":14,"fanoutAttendanceMappings":1,"fanoutFirebaseAuthTransitions":1,"fanoutExclusions":1}
);

const EXPECTED_ROLLBACK = Object.freeze(
  {"rollbackStudentRows":155,"rollbackPrincipalRows":12,"rollbackAttendanceDocuments":69,"rollbackAssignmentDocuments":14,"rollbackFirebaseAuthUsers":1,"inPlaceAttendancePlans":68}
);

type GenericRecord =
  Record<string, unknown>;

interface InputData {
  readonly requestId?: unknown;
  readonly payloadDigest?: unknown;
  readonly fanoutDigest?: unknown;
  readonly contractDigest?: unknown;
  readonly preflightContractDigest?: unknown;
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
    payloadDigest:
      text(source.payloadDigest) ===
      EXPECTED_PAYLOAD_DIGEST,
    fanoutDigest:
      text(source.fanoutDigest) ===
      EXPECTED_FANOUT_DIGEST,
    contractDigest:
      text(source.contractDigest) ===
      EXPECTED_PHASE4C6_CONTRACT_DIGEST,
    preflightContractDigest:
      text(
        source.preflightContractDigest
      ) ===
      EXPECTED_PREFLIGHT_CONTRACT_DIGEST
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
      `Phase 4C-7 input gate failed: ${failed.join(", ")}`
    );
  }
}

async function collectionSize(
  collection:
    CollectionReference<DocumentData>
): Promise<number> {
  const snapshot =
    await collection.get();

  return snapshot.size;
}

export const inspectUidV2CutoverPreflightPhase4c7 =
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

      const metadataSnapshot =
        await runRef
          .collection("fanoutMeta")
          .doc("allocation")
          .get();

      if (!metadataSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-6 fan-out metadata was not found."
        );
      }

      const metadata =
        metadataSnapshot.data() || {};

      const metadataChecks = {
        status:
          text(metadata.status) ===
          "fanout_staged",
        caller:
          text(
            metadata.approvedByFirebaseUid
          ) ===
          callerUid,
        payloadDigest:
          text(
            metadata.payloadDigest
          ) ===
          EXPECTED_PAYLOAD_DIGEST,
        fanoutDigest:
          text(
            metadata.fanoutDigest
          ) ===
          EXPECTED_FANOUT_DIGEST,
        contractDigest:
          text(
            metadata.contractDigest
          ) ===
          EXPECTED_PHASE4C6_CONTRACT_DIGEST,
        activeRegistryBlocked:
          Number(
            metadata.activeUidRegistryWrites ||
            0
          ) === 0,
        sourceDataBlocked:
          Number(
            metadata.sourceDataWrites ||
            0
          ) === 0,
        cutoverBlocked:
          metadata.actualUidCutoverAllowed ===
          false
      };

      const fanoutCollections = {
        fanoutStudents:
          runRef.collection(
            "fanoutStudents"
          ),
        fanoutPrincipals:
          runRef.collection(
            "fanoutPrincipals"
          ),
        fanoutStudentAliases:
          runRef.collection(
            "fanoutStudentAliases"
          ),
        fanoutPrincipalAliases:
          runRef.collection(
            "fanoutPrincipalAliases"
          ),
        fanoutAssignmentMappings:
          runRef.collection(
            "fanoutAssignmentMappings"
          ),
        fanoutAttendanceMappings:
          runRef.collection(
            "fanoutAttendanceMappings"
          ),
        fanoutFirebaseAuthTransitions:
          runRef.collection(
            "fanoutFirebaseAuthTransitions"
          ),
        fanoutExclusions:
          runRef.collection(
            "fanoutExclusions"
          )
      };

      const fanoutCounts:
        Record<string, number> = {};

      for (
        const [
          key,
          collection
        ] of Object.entries(
          fanoutCollections
        )
      ) {
        fanoutCounts[key] =
          await collectionSize(
            collection
          );
      }

      const fanoutCountChecks =
        Object.fromEntries(
          Object.entries(
            EXPECTED_FANOUT
          )
            .map(
              (
                [
                  key,
                  expected
                ]
              ) => [
                key,
                fanoutCounts[key] ===
                expected
              ]
            )
        );

      const rollbackCollections = {
        rollbackStudentRows:
          runRef.collection(
            "rollbackStudentRows"
          ),
        rollbackPrincipalRows:
          runRef.collection(
            "rollbackPrincipalRows"
          ),
        rollbackAttendanceDocuments:
          runRef.collection(
            "rollbackAttendanceDocuments"
          ),
        rollbackAssignmentDocuments:
          runRef.collection(
            "rollbackAssignmentDocuments"
          ),
        rollbackFirebaseAuthUsers:
          runRef.collection(
            "rollbackFirebaseAuthUsers"
          ),
        inPlaceAttendancePlans:
          runRef.collection(
            "inPlaceAttendancePlans"
          )
      };

      const rollbackCounts:
        Record<string, number> = {};

      for (
        const [
          key,
          collection
        ] of Object.entries(
          rollbackCollections
        )
      ) {
        rollbackCounts[key] =
          await collectionSize(
            collection
          );
      }

      const coverageMissing =
        Object.fromEntries(
          Object.entries(
            EXPECTED_ROLLBACK
          )
            .map(
              (
                [
                  key,
                  expected
                ]
              ) => [
                key,
                Math.max(
                  0,
                  expected -
                  Number(
                    rollbackCounts[key] ||
                    0
                  )
                )
              ]
            )
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

      const failedFanoutCounts =
        Object.entries(
          fanoutCountChecks
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

      const rollbackCoverageComplete =
        Object.values(
          coverageMissing
        )
          .every(
            (count) =>
              Number(count) === 0
          );

      const blockingReasons:
        string[] = [];

      if (
        failedMetadata.length > 0
      ) {
        blockingReasons.push(
          "PHASE4C6_METADATA_MISMATCH"
        );
      }

      if (
        failedFanoutCounts.length > 0
      ) {
        blockingReasons.push(
          "FANOUT_COUNT_MISMATCH"
        );
      }

      if (!rollbackCoverageComplete) {
        blockingReasons.push(
          "ROLLBACK_COVERAGE_INCOMPLETE"
        );
      }

      if (
        rollbackCounts
          .inPlaceAttendancePlans !==
        EXPECTED_ROLLBACK
          .inPlaceAttendancePlans
      ) {
        blockingReasons.push(
          "IN_PLACE_ATTENDANCE_PLAN_MISSING"
        );
      }

      const readyForCutoverApproval =
        blockingReasons.length === 0;

      return {
        ok: true,
        version:
          UID_V2_CUTOVER_PREFLIGHT_PHASE4C7_VERSION,
        mode:
          "cutover_preflight_read_only",
        requestId:
          REQUEST_ID,
        writeOperations:
          0,
        preflightContractDigest:
          EXPECTED_PREFLIGHT_CONTRACT_DIGEST,
        metadataChecks,
        failedMetadata,
        fanoutCounts,
        fanoutCountChecks,
        failedFanoutCounts,
        rollbackCounts,
        expectedRollbackCoverage:
          EXPECTED_ROLLBACK,
        coverageMissing,
        rollbackCoverageComplete,
        blockingReasons,
        readyForCutoverApproval,
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
          actualUidCutoverAllowed:
            false
        },
        nextGate: {
          phase:
            "Phase 4C-8 rollback snapshot staging",
          allowed:
            !readyForCutoverApproval,
          actualUidCutoverAllowed:
            false
        }
      };
    }
  );
