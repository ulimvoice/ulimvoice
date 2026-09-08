import { createHash } from "node:crypto";
import {
  App,
  getApp,
  getApps,
  initializeApp
} from "firebase-admin/app";
import {
  Timestamp,
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_V2_FINAL_COMMIT_DRY_RUN_PHASE4C11_VERSION =
  "2026-07-26.716.30-phase4c11-final-commit-dry-run-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c3-20260724142743-62e47ac1-8e06-4cf7-b379-25d2373fa42d";
const EXPECTED_PAYLOAD_DIGEST =
  "a3a7641e934772e39ea8241438517c1643435434c8636fbe00cbe415cc66ceae";
const EXPECTED_FANOUT_DIGEST =
  "674e6d52c970711f2ad20bce7c5171289a30abd26c85c2f0143eefaeef2f8f47";
const EXPECTED_ROLLBACK_SNAPSHOT_DIGEST =
  "5f316b9695d04e8b156e2c9e24e7e03329a8e4365edd5e944d3d18aee279e457";
const EXPECTED_SHEET_SNAPSHOT_DIGEST =
  "e6eeb89912b8b96973be17e49e0710ede438691f335033e43349f07f4fc00a67";
const EXPECTED_APPROVAL_CONTRACT_DIGEST =
  "133bffe7ac4b93a2b828f6edb1a6d324157e82afdb2f78d527583e96f0e0bf19";
const EXPECTED_DRY_RUN_CONTRACT_DIGEST =
  "2990f01a8a2356dd490273f30a446f593fc468932161fc6b157508ea4a369e62";

const SHEET_ATTESTATION_TTL_SECONDS =
  300;

const EXPECTED_FANOUT = Object.freeze(
  {"fanoutStudents":155,"fanoutPrincipals":12,"fanoutStudentAliases":85,"fanoutPrincipalAliases":13,"fanoutAssignmentMappings":14,"fanoutAttendanceMappings":1,"fanoutFirebaseAuthTransitions":1,"fanoutExclusions":1}
);

const EXPECTED_ROLLBACK = Object.freeze(
  {"rollbackStudentRows":155,"rollbackPrincipalRows":12,"rollbackAttendanceDocuments":69,"rollbackAssignmentDocuments":14,"rollbackFirebaseAuthUsers":1,"inPlaceAttendancePlans":68}
);

const PROJECTED_MUTATIONS = Object.freeze(
  {"studentSheetRowMutations":155,"principalSheetRowMutations":12,"studentRegistryDocuments":155,"principalRegistryDocuments":12,"studentAliasDocuments":85,"principalAliasDocuments":13,"assignmentCloneDocuments":14,"attendanceInPlaceDocuments":68,"attendanceCloneDocuments":1,"firebaseAuthUsers":1,"cutoverMetadataDocuments":1}
);

const PROJECTED_SHEET_MUTATIONS =
  167;
const PROJECTED_FIRESTORE_WRITES =
  349;
const PROJECTED_FIREBASE_AUTH_WRITES =
  1;
const PROJECTED_LOGICAL_MUTATIONS =
  517;

type GenericRecord =
  Record<string, unknown>;

interface InputData {
  readonly requestId?: unknown;
  readonly dryRunContractDigest?: unknown;
  readonly sheetAttestationDigest?: unknown;
  readonly sheetAttestation?: unknown;
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
    .update(value, "utf8")
    .digest("hex");
}

function timestampMillis(
  value: unknown
): number {
  return value instanceof Timestamp
    ? value.toMillis()
    : 0;
}

function allTrue(
  value: unknown
): boolean {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  return Object.values(
    value as GenericRecord
  ).every(
    (item) =>
      item === true
  );
}

export const inspectUidV2FinalCommitDryRunPhase4c11 =
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
              InputData
          : {};

      if (
        text(input.requestId) !==
          REQUEST_ID ||
        text(
          input.dryRunContractDigest
        ) !==
          EXPECTED_DRY_RUN_CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-11 input gate failed."
        );
      }

      const attestation =
        asRecord(
          input.sheetAttestation,
          "sheetAttestation"
        );

      const calculatedAttestationDigest =
        sha256(
          JSON.stringify(
            canonicalize(
              attestation
            )
          )
        );

      const generatedAtMillis =
        Date.parse(
          text(
            attestation.generatedAtIso
          )
        );

      const nowMillis =
        Date.now();

      const sheetChecks = {
        digest:
          calculatedAttestationDigest ===
          text(
            input.sheetAttestationDigest
          ),
        requestId:
          text(
            attestation.requestId
          ) ===
          REQUEST_ID,
        expectedSnapshot:
          text(
            attestation
              .expectedSheetSnapshotDigest
          ) ===
          EXPECTED_SHEET_SNAPSHOT_DIGEST,
        currentSnapshot:
          text(
            attestation
              .currentSheetSnapshotDigest
          ) ===
          EXPECTED_SHEET_SNAPSHOT_DIGEST,
        stable:
          attestation.sheetStable ===
          true,
        studentCount:
          Number(
            (
              attestation.counts as
                GenericRecord
            )?.rollbackStudentRows ||
            0
          ) === 155,
        principalCount:
          Number(
            (
              attestation.counts as
                GenericRecord
            )?.rollbackPrincipalRows ||
            0
          ) === 12,
        generatedAtValid:
          Number.isFinite(
            generatedAtMillis
          ) &&
          generatedAtMillis <=
            nowMillis &&
          nowMillis -
            generatedAtMillis <=
            SHEET_ATTESTATION_TTL_SECONDS *
            1000
      };

      const db =
        getFirestore(
          defaultAdminApp()
        );

      const approvalSnapshot =
        await db.collection(
          "uidV2CutoverApprovals"
        ).doc(
          REQUEST_ID
        ).get();

      if (!approvalSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-10 approval record was not found."
        );
      }

      const approval =
        approvalSnapshot.data() || {};

      const approvalChecks = {
        caller:
          text(
            approval
              .approvedByFirebaseUid
          ) ===
          callerUid,
        status:
          text(approval.status) ===
          "armed",
        unexpired:
          timestampMillis(
            approval.expiresAt
          ) >
          nowMillis,
        approvalContractDigest:
          text(
            approval
              .approvalContractDigest
          ) ===
          EXPECTED_APPROVAL_CONTRACT_DIGEST,
        payloadDigest:
          text(
            approval.payloadDigest
          ) ===
          EXPECTED_PAYLOAD_DIGEST,
        fanoutDigest:
          text(
            approval.fanoutDigest
          ) ===
          EXPECTED_FANOUT_DIGEST,
        rollbackSnapshotDigest:
          text(
            approval
              .rollbackSnapshotDigest
          ) ===
          EXPECTED_ROLLBACK_SNAPSHOT_DIGEST,
        sheetSnapshotDigest:
          text(
            approval
              .sheetSnapshotDigest
          ) ===
          EXPECTED_SHEET_SNAPSHOT_DIGEST,
        metadataStable:
          (
            approval.liveAuditSummary as
              GenericRecord
          )?.metadataStable ===
          true,
        countsStable:
          (
            approval.liveAuditSummary as
              GenericRecord
          )?.countsStable ===
          true,
        attendanceStable:
          (
            approval.liveAuditSummary as
              GenericRecord
          )?.attendanceStable ===
          true,
        assignmentsStable:
          (
            approval.liveAuditSummary as
              GenericRecord
          )?.assignmentsStable ===
          true,
        inPlaceAttendanceStable:
          (
            approval.liveAuditSummary as
              GenericRecord
          )?.inPlaceAttendanceStable ===
          true,
        attendanceCloneStable:
          (
            approval.liveAuditSummary as
              GenericRecord
          )?.attendanceCloneStable ===
          true,
        firebaseAuthStable:
          (
            approval.liveAuditSummary as
              GenericRecord
          )?.firebaseAuthStable ===
          true,
        commitBlocked:
          approval
            .actualUidCutoverAllowed ===
          false
      };

      const runRef =
        db.collection(
          "uidV2StagingRuns"
        ).doc(
          REQUEST_ID
        );

      const fanoutCounts:
        Record<string, number> = {};

      for (
        const key of
        Object.keys(
          EXPECTED_FANOUT
        )
      ) {
        fanoutCounts[key] =
          (
            await runRef
              .collection(key)
              .get()
          ).size;
      }

      const rollbackCounts:
        Record<string, number> = {};

      for (
        const key of
        Object.keys(
          EXPECTED_ROLLBACK
        )
      ) {
        rollbackCounts[key] =
          (
            await runRef
              .collection(key)
              .get()
          ).size;
      }

      const fanoutChecks =
        Object.fromEntries(
          Object.entries(
            EXPECTED_FANOUT
          ).map(
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

      const rollbackChecks =
        Object.fromEntries(
          Object.entries(
            EXPECTED_ROLLBACK
          ).map(
            (
              [
                key,
                expected
              ]
            ) => [
              key,
              rollbackCounts[key] ===
              expected
            ]
          )
        );

      const executionConstraints = {
        firestoreBatchWithin500:
          PROJECTED_FIRESTORE_WRITES <=
          500,
        crossSystemAtomicity:
          false,
        phasedCommitRequired:
          true,
        sheetFirstRequired:
          true,
        sheetRereadRequired:
          true,
        approvalRevalidationRequired:
          true,
        liveDriftRevalidationRequired:
          true,
        rollbackSnapshotRequired:
          true
      };

      const blockingReasons:
        string[] = [];

      if (!allTrue(sheetChecks)) {
        blockingReasons.push(
          "SHEET_ATTESTATION_FAILED_OR_EXPIRED"
        );
      }

      if (!allTrue(approvalChecks)) {
        blockingReasons.push(
          "PHASE4C10_APPROVAL_INVALID_OR_EXPIRED"
        );
      }

      if (!allTrue(fanoutChecks)) {
        blockingReasons.push(
          "FANOUT_COUNT_MISMATCH"
        );
      }

      if (!allTrue(rollbackChecks)) {
        blockingReasons.push(
          "ROLLBACK_COUNT_MISMATCH"
        );
      }

      if (
        !executionConstraints
          .firestoreBatchWithin500
      ) {
        blockingReasons.push(
          "FIRESTORE_BATCH_LIMIT_EXCEEDED"
        );
      }

      const finalCommitDryRunReady =
        blockingReasons.length === 0;

      return {
        ok: true,
        version:
          UID_V2_FINAL_COMMIT_DRY_RUN_PHASE4C11_VERSION,
        mode:
          "final_commit_dry_run_only",
        requestId:
          REQUEST_ID,
        writeOperations:
          0,
        dryRunContractDigest:
          EXPECTED_DRY_RUN_CONTRACT_DIGEST,
        approval: {
          generation:
            Number(
              approval.generation ||
              0
            ),
          approvalDigest:
            text(
              approval.approvalDigest
            ),
          expiresAtIso:
            text(
              approval.expiresAtIso
            ),
          expiresInSeconds:
            Math.max(
              0,
              Math.floor(
                (
                  timestampMillis(
                    approval.expiresAt
                  ) -
                  nowMillis
                ) /
                1000
              )
            ),
          checks:
            approvalChecks,
          valid:
            allTrue(
              approvalChecks
            )
        },
        sheetAttestation: {
          digest:
            calculatedAttestationDigest,
          ageSeconds:
            Math.max(
              0,
              Math.floor(
                (
                  nowMillis -
                  generatedAtMillis
                ) /
                1000
              )
            ),
          checks:
            sheetChecks,
          valid:
            allTrue(
              sheetChecks
            )
        },
        fanoutCounts,
        fanoutChecks,
        rollbackCounts,
        rollbackChecks,
        projectedMutations:
          PROJECTED_MUTATIONS,
        projectedTotals: {
          sheetMutations:
            PROJECTED_SHEET_MUTATIONS,
          firestoreWrites:
            PROJECTED_FIRESTORE_WRITES,
          firebaseAuthWrites:
            PROJECTED_FIREBASE_AUTH_WRITES,
          logicalMutations:
            PROJECTED_LOGICAL_MUTATIONS
        },
        executionConstraints,
        blockingReasons,
        finalCommitDryRunReady,
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
            "Phase 4C-12 cutover execution design and server manifest",
          allowed:
            finalCommitDryRunReady,
          actualUidCutoverAllowed:
            false
        }
      };
    }
  );
