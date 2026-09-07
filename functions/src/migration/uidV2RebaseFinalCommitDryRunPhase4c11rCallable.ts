import { createHash } from "node:crypto";
import {
  App,
  getApp,
  getApps,
  initializeApp
} from "firebase-admin/app";
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

export const UID_V2_REBASE_FINAL_COMMIT_DRY_RUN_PHASE4C11R_VERSION =
  "2026-07-28.716.56-phase4c11r-mixed-prior-chain-cutover-path-hotfix";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "22d32934d3684a349f4217f1511a20adf2184d5811d1edd68d1fee41e5cb8f7a";

const EXPECTED_PHASE4C10R_CONTRACT_DIGEST =
  "8a3c422d0e79a05b073f33c529e7b9cad214f54a999321c65e300165a1e16948";

const EXPECTED_PHASE4C9R_CONTRACT_DIGEST =
  "12d1fcf5aafe7c4ad453426e5d43e2b9a996dc8bc57be33b22e8d0734eff9f31";

const EXPECTED_PHASE4C8R_CONTRACT_DIGEST =
  "51b2108c9e350471f458f49af5eb06e3a4f304e8798fab87e4dedc67e8f32fa1";

const EXPECTED_PHASE4C7R_CONTRACT_DIGEST =
  "658dc5f19b1b6036c9b995607e1be305d239b74e67e47566e8472efb0be04135";

const EXPECTED_PHASE4C5R_CONTRACT_DIGEST =
  "e3613acc1c03d352df591371aeba2a2ec1cd5a1a40d7c1a1de88ca57aa8d02c5";

const EXPECTED_PAYLOAD_DIGEST =
  "748710b323521e64895d52548cbe1a0680bb02837579dd4079da9cff56f66288";

const EXPECTED_FANOUT_DESIGN_DIGEST =
  "bc11d7b0c94cc2a600d1b4202419f5cef14eadbfc172c2b59bbfc4f61d3eb65e";

const EXPECTED_RECORD_SET_DIGEST =
  "ec3fad78b2d29666497861f567ac38f2e864f34969516a2cda4c58d9102fb28c";

const EXPECTED_FANOUT_METADATA_DIGEST =
  "7afa4fc0804f768ab00e78e4c780b94e50ac34a3e69647bed4d7264aa7085105";

const EXPECTED_SNAPSHOT_SET_DIGEST =
  "6e2cd04e8f7fb82c16b825c373d27efb2abc44dc6356469085f39df2076c1840";

const EXPECTED_ROLLBACK_SNAPSHOT_DIGEST =
  "5c397939a816bf5404ac869ad946a5e2a5308b961341e08fae5f236ceffde98b";

const EXPECTED_REHEARSAL_RESULT_DIGEST =
  "416db13b9958ec54952121ac0c0ee13512d942b6bf4a6ca38e54a56afb182c24";

const EXPECTED_SHEET_SNAPSHOT_DIGEST =
  "f37c0a0b984c9ce5392229acfe359c0cf57ed9e03faef458cb37718ea02c614c";

const EXPECTED_LIVE_AUDIT_DIGEST =
  "7768b791be2d1161bbf3676c23f5263a2f0326123a0f99a0c505c2787c8f3e0c";

const SHEET_ATTESTATION_TTL_SECONDS =
  300;

const EXPECTED_FANOUT = Object.freeze({
  rebaseFanoutStudents: 156,
  rebaseFanoutPrincipals: 12,
  rebaseFanoutStudentAliases: 85,
  rebaseFanoutPrincipalAliases: 13,
  rebaseFanoutAssignmentMappings: 14,
  rebaseFanoutAttendanceMappings: 1,
  rebaseFanoutAuthTransitions: 1,
  rebaseFanoutExclusions: 1
});

const EXPECTED_ROLLBACK = Object.freeze({
  rollbackStudentRows: 156,
  rollbackPrincipalRows: 12,
  rollbackAttendanceDocuments: 69,
  rollbackAssignmentDocuments: 14,
  rollbackFirebaseAuthUsers: 1,
  inPlaceAttendancePlans: 68
});

const PROJECTED_MUTATIONS = Object.freeze({
  studentSheetCellMutations: 156,
  principalSheetCellMutations: 12,
  studentRegistryDocuments: 156,
  principalRegistryDocuments: 12,
  studentAliasDocuments: 85,
  principalAliasDocuments: 13,
  assignmentCloneDocuments: 14,
  attendanceInPlaceDocuments: 68,
  attendanceCloneDocuments: 1,
  firebaseAuthUsers: 1,
  cutoverMetadataDocuments: 1
});

const EXECUTION_ORDER = Object.freeze([
  "revalidateApproval",
  "revalidateLiveDrift",
  "applySheetIdentityCellPatch",
  "rereadAndVerifySheetIdentityCells",
  "commitFirestoreUidRegistryAliasAttendanceAssignmentBatch",
  "verifyFirestorePostCommit",
  "transitionFirebaseAuthPrincipal",
  "verifyFirebaseAuthTransition",
  "finalizeCutoverMetadata"
]);

const PROJECTED_SHEET_MUTATIONS =
  168;
const PROJECTED_FIRESTORE_WRITES =
  350;
const PROJECTED_FIREBASE_AUTH_WRITES =
  1;
const PROJECTED_LOGICAL_MUTATIONS =
  519;

type GenericRecord =
  Record<string, unknown>;

interface InputData {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly sheetAttestationDigest?: unknown;
  readonly sheetAttestation?: unknown;
  readonly confirmDryRunOnly?: unknown;
  readonly confirmNoCommitCallable?: unknown;
  readonly confirmNoSourceWrites?: unknown;
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

function allTrue(
  value: GenericRecord
): boolean {
  return Object.values(value)
    .every(
      (item) =>
        item === true
    );
}

function timestampMillis(
  value: unknown
): number {
  return value instanceof Timestamp
    ? value.toMillis()
    : 0;
}

function approvalCore(
  data: GenericRecord
) {
  return {
    version: data.version,
    phase: data.phase,
    mode: data.mode,
    requestId: data.requestId,
    contractDigest: data.contractDigest,
    phase4c9rContractDigest:
      data.phase4c9rContractDigest,
    phase4c8rContractDigest:
      data.phase4c8rContractDigest,
    phase4c7rContractDigest:
      data.phase4c7rContractDigest,
    liveBaselineDigest:
      data.liveBaselineDigest,
    liveAuditDigest:
      data.liveAuditDigest,
    rehearsalResultDigest:
      data.rehearsalResultDigest,
    baselineRawSheetDigest:
      data.baselineRawSheetDigest,
    currentRawSheetDigest:
      data.currentRawSheetDigest,
    approvedByFirebaseUid:
      data.approvedByFirebaseUid,
    generation: data.generation,
    armedAtIso: data.armedAtIso,
    expiresAtIso: data.expiresAtIso,
    approvalWindowSeconds:
      data.approvalWindowSeconds,
    auditSummary: data.auditSummary,
    status: data.status,
    safety: data.safety
  };
}

async function readCollectionCounts(
  runRef: DocumentReference<DocumentData>,
  expected: Readonly<Record<string, number>>
) {
  const counts:
    Record<string, number> = {};

  for (
    const name of Object.keys(expected)
  ) {
    counts[name] =
      (
        await runRef
          .collection(name)
          .get()
      ).size;
  }

  const checks =
    Object.fromEntries(
      Object.entries(expected)
        .map(
          ([name, count]) => [
            name,
            counts[name] === count
          ]
        )
    ) as GenericRecord;

  return {
    counts,
    checks,
    valid: allTrue(checks)
  };
}

export const inspectUidV2RebaseFinalCommitDryRunPhase4c11r =
  onCall(
    {
      region: REGION,
      timeoutSeconds: 240,
      memory: "512MiB",
      enforceAppCheck: false
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
          ? request.data as InputData
          : {};

      if (
        text(input.requestId) !== REQUEST_ID ||
        text(input.contractDigest) !== CONTRACT_DIGEST ||
        input.confirmDryRunOnly !== true ||
        input.confirmNoCommitCallable !== true ||
        input.confirmNoSourceWrites !== true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-11R input gate failed."
        );
      }

      const attestation =
        asRecord(
          input.sheetAttestation,
          "sheetAttestation"
        );

      const attestationSafety =
        asRecord(
          attestation.safety,
          "sheetAttestation.safety"
        );

      const attestationCounts =
        asRecord(
          attestation.counts,
          "sheetAttestation.counts"
        );

      const calculatedAttestationDigest =
        digestValue(attestation);

      const generatedAtMillis =
        Date.parse(
          text(attestation.generatedAtIso)
        );

      const nowMillis =
        Date.now();

      const sheetChecks:
        GenericRecord = {
        digest:
          calculatedAttestationDigest ===
          text(input.sheetAttestationDigest),
        requestId:
          text(attestation.requestId) ===
          REQUEST_ID,
        contract:
          text(attestation.contractDigest) ===
          CONTRACT_DIGEST,
        expectedSnapshot:
          text(
            attestation.expectedSheetSnapshotDigest
          ) ===
          EXPECTED_SHEET_SNAPSHOT_DIGEST,
        currentSnapshot:
          text(
            attestation.currentSheetSnapshotDigest
          ) ===
          EXPECTED_SHEET_SNAPSHOT_DIGEST,
        stable:
          attestation.sheetStable === true,
        studentCount:
          Number(
            attestationCounts.rollbackStudentRows ||
            0
          ) === 156,
        principalCount:
          Number(
            attestationCounts.rollbackPrincipalRows ||
            0
          ) === 12,
        noSensitiveRows:
          attestationSafety.containsSensitiveRowData ===
          false,
        noWrites:
          Number(
            attestationSafety.sourceSheetWrites ||
            0
          ) === 0 &&
          Number(
            attestationSafety.firestoreWrites ||
            0
          ) === 0 &&
          Number(
            attestationSafety.firebaseAuthWrites ||
            0
          ) === 0,
        noCutover:
          attestationSafety.actualUidCutoverAllowed ===
          false,
        generatedAtValid:
          Number.isFinite(generatedAtMillis) &&
          generatedAtMillis <= nowMillis &&
          nowMillis - generatedAtMillis <=
            SHEET_ATTESTATION_TTL_SECONDS *
            1000
      };

      const db =
        getFirestore(
          defaultAdminApp()
        );

      const runRef =
        db.collection(
          "uidV2StagingRuns"
        ).doc(REQUEST_ID);

      const [
        approvalSnapshot,
        fanoutMetaSnapshot,
        rollbackMetaSnapshot,
        rehearsalSnapshot
      ] = await Promise.all([
        runRef
          .collection("rebaseLiveApprovals")
          .doc("phase4c10r")
          .get(),
        runRef
          .collection("rebaseFanoutMetadata")
          .doc("phase4c5r")
          .get(),
        runRef
          .collection("rollbackMeta")
          .doc("snapshot")
          .get(),
        runRef
          .collection("rebaseRehearsalResults")
          .doc("phase4c7r")
          .get()
      ]);

      if (
        !approvalSnapshot.exists ||
        !fanoutMetaSnapshot.exists ||
        !rollbackMetaSnapshot.exists ||
        !rehearsalSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-11R prior-chain metadata is missing."
        );
      }

      const approval =
        approvalSnapshot.data() || {};
      const approvalSafety =
        asRecord(
          approval.safety,
          "approval.safety"
        );
      const approvalSummary =
        asRecord(
          approval.auditSummary,
          "approval.auditSummary"
        );

      const recomputedApprovalDigest =
        digestValue(
          approvalCore(approval)
        );

      const approvalChecks:
        GenericRecord = {
        caller:
          text(
            approval.approvedByFirebaseUid
          ) === callerUid,
        status:
          text(approval.status) ===
          "rebase_live_approval_armed",
        unexpired:
          timestampMillis(
            approval.expiresAt
          ) > nowMillis,
        contract:
          text(approval.contractDigest) ===
          EXPECTED_PHASE4C10R_CONTRACT_DIGEST,
        phase4c9r:
          text(
            approval.phase4c9rContractDigest
          ) ===
          EXPECTED_PHASE4C9R_CONTRACT_DIGEST,
        phase4c8r:
          text(
            approval.phase4c8rContractDigest
          ) ===
          EXPECTED_PHASE4C8R_CONTRACT_DIGEST,
        phase4c7r:
          text(
            approval.phase4c7rContractDigest
          ) ===
          EXPECTED_PHASE4C7R_CONTRACT_DIGEST,
        baseline:
          text(
            approval.liveBaselineDigest
          ) ===
          EXPECTED_ROLLBACK_SNAPSHOT_DIGEST,
        audit:
          text(
            approval.liveAuditDigest
          ) ===
          EXPECTED_LIVE_AUDIT_DIGEST,
        rehearsal:
          text(
            approval.rehearsalResultDigest
          ) ===
          EXPECTED_REHEARSAL_RESULT_DIGEST,
        baselineSheet:
          text(
            approval.baselineRawSheetDigest
          ) ===
          EXPECTED_SHEET_SNAPSHOT_DIGEST,
        currentSheet:
          text(
            approval.currentRawSheetDigest
          ) ===
          EXPECTED_SHEET_SNAPSHOT_DIGEST,
        digest:
          text(approval.approvalDigest) ===
          recomputedApprovalDigest,
        summary:
          approvalSummary.rawSheetSnapshotMatchesBaseline ===
            true &&
          approvalSummary.studentsStable === true &&
          approvalSummary.principalsStable === true &&
          approvalSummary.attendanceStable === true &&
          approvalSummary.inPlaceAttendanceStable === true &&
          approvalSummary.assignmentsStable === true &&
          approvalSummary.attendanceCloneStable === true &&
          approvalSummary.firebaseAuthStable === true &&
          Number(
            approvalSummary.blockingReasonCount ||
            0
          ) === 0,
        noWrites:
          Number(
            approvalSafety.sourceSheetWrites ||
            0
          ) === 0 &&
          Number(
            approvalSafety.activeUidRegistryWrites ||
            0
          ) === 0 &&
          Number(
            approvalSafety.attendanceWrites ||
            0
          ) === 0 &&
          Number(
            approvalSafety.assignmentWrites ||
            0
          ) === 0 &&
          Number(
            approvalSafety.firebaseAuthWrites ||
            0
          ) === 0,
        noCommit:
          approvalSafety.commitCallableIncluded ===
          false,
        noCutover:
          approvalSafety.actualUidCutoverAllowed ===
          false
      };

      const fanoutMeta =
        fanoutMetaSnapshot.data() || {};
      const rollbackMeta =
        rollbackMetaSnapshot.data() || {};
      const rehearsal =
        rehearsalSnapshot.data() || {};

      const chainChecks:
        GenericRecord = {
        fanoutStatus:
          text(fanoutMeta.status) ===
          "rebase_isolated_fanout_verified",
        fanoutCaller:
          text(
            fanoutMeta.approvedByFirebaseUid
          ) === callerUid,
        fanoutContract:
          text(fanoutMeta.contractDigest) ===
          EXPECTED_PHASE4C5R_CONTRACT_DIGEST,
        payload:
          text(fanoutMeta.payloadDigest) ===
          EXPECTED_PAYLOAD_DIGEST,
        fanoutDesign:
          text(fanoutMeta.fanoutDesignDigest) ===
          EXPECTED_FANOUT_DESIGN_DIGEST,
        recordSet:
          text(fanoutMeta.recordSetDigest) ===
          EXPECTED_RECORD_SET_DIGEST,
        fanoutMetadata:
          text(fanoutMeta.metadataDigest) ===
          EXPECTED_FANOUT_METADATA_DIGEST,
        rollbackStatus:
          text(rollbackMeta.status) ===
          "rebase_live_baseline_staged",
        rollbackCaller:
          text(
            rollbackMeta.approvedByFirebaseUid
          ) === callerUid,
        rollbackContract:
          text(
            rollbackMeta.liveBaselineContractDigest
          ) ===
          EXPECTED_PHASE4C8R_CONTRACT_DIGEST,
        rollbackDigest:
          text(
            rollbackMeta.rollbackSnapshotDigest
          ) ===
          EXPECTED_ROLLBACK_SNAPSHOT_DIGEST,
        sheetDigest:
          text(
            rollbackMeta.sheetSnapshotDigest
          ) ===
          EXPECTED_SHEET_SNAPSHOT_DIGEST,
        snapshotSet:
          text(
            rollbackMeta.snapshotSetDigest
          ) ===
          EXPECTED_SNAPSHOT_SET_DIGEST,
        rollbackCounts:
          Object.entries(
            EXPECTED_ROLLBACK
          ).every(
            ([name, count]) =>
              Number(
                (
                  rollbackMeta.counts as
                    GenericRecord
                )?.[name] ||
                0
              ) === count
          ),
        rehearsalStatus:
          text(rehearsal.status) ===
          "rebase_delete_restore_rehearsal_verified",
        rehearsalContract:
          text(rehearsal.contractDigest) ===
          EXPECTED_PHASE4C7R_CONTRACT_DIGEST,
        rehearsalDigest:
          text(
            rehearsal.rehearsalResultDigest
          ) ===
          EXPECTED_REHEARSAL_RESULT_DIGEST,
        rehearsalVerified:
          rehearsal.postRestoreVerified ===
            true &&
          Number(
            rehearsal.restoredDocumentCount ||
            0
          ) === 284 &&
          text(rehearsal.afterSetDigest) ===
          EXPECTED_SNAPSHOT_SET_DIGEST,
        cutoverBlocked:
          (
            fanoutMeta.safety as GenericRecord
          )?.actualUidCutoverAllowed ===
            false &&
          rollbackMeta.actualUidCutoverAllowed ===
            false &&
          (
            rehearsal.safety as GenericRecord
          )?.actualUidCutoverAllowed ===
            false
      };

      const fanout =
        await readCollectionCounts(
          runRef,
          EXPECTED_FANOUT
        );

      const rollback =
        await readCollectionCounts(
          runRef,
          EXPECTED_ROLLBACK
        );

      const executionConstraints = {
        firestoreBatchWithin500:
          PROJECTED_FIRESTORE_WRITES <= 500,
        singleFirestoreBatchPossible:
          PROJECTED_FIRESTORE_WRITES <= 500,
        crossSystemAtomicity: false,
        phasedCommitRequired: true,
        sheetCellPatchOnly: true,
        fullSheetRowOverwriteForbidden: true,
        sheetFirstRequired: true,
        sheetRereadRequired: true,
        approvalRevalidationRequired: true,
        liveDriftRevalidationRequired: true,
        rollbackSnapshotRequired: true,
        firebaseAuthLastRequired: true,
        commitCallableIncluded: false,
        actualUidCutoverAllowed: false
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
          "PHASE4C10R_APPROVAL_INVALID_OR_EXPIRED"
        );
      }

      if (!allTrue(chainChecks)) {
        blockingReasons.push(
          "PRIOR_CHAIN_METADATA_MISMATCH"
        );
      }

      if (!fanout.valid) {
        blockingReasons.push(
          "FANOUT_COUNT_MISMATCH"
        );
      }

      if (!rollback.valid) {
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
          UID_V2_REBASE_FINAL_COMMIT_DRY_RUN_PHASE4C11R_VERSION,
        phase: "Phase 4C-11R",
        mode:
          "rebase156_final_commit_dry_run_contract_only",
        requestId: REQUEST_ID,
        contractDigest: CONTRACT_DIGEST,
        writeOperations: 0,
        approval: {
          generation:
            Number(
              approval.generation ||
              0
            ),
          approvalDigest:
            text(approval.approvalDigest),
          expiresAtIso:
            text(approval.expiresAtIso),
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
          checks: approvalChecks,
          valid:
            allTrue(approvalChecks)
        },
        sheetAttestation: {
          digest:
            calculatedAttestationDigest,
          ageSeconds:
            Number.isFinite(
              generatedAtMillis
            )
              ? Math.max(
                  0,
                  Math.floor(
                    (
                      nowMillis -
                      generatedAtMillis
                    ) /
                    1000
                  )
                )
              : -1,
          checks: sheetChecks,
          valid:
            allTrue(sheetChecks)
        },
        chainChecks,
        fanoutCounts:
          fanout.counts,
        fanoutChecks:
          fanout.checks,
        rollbackCounts:
          rollback.counts,
        rollbackChecks:
          rollback.checks,
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
        executionOrder:
          EXECUTION_ORDER,
        executionConstraints,
        blockingReasons,
        finalCommitDryRunReady,
        safety: {
          firestoreWrites: 0,
          sourceSheetWrites: 0,
          activeUidRegistryWrites: 0,
          attendanceWrites: 0,
          assignmentWrites: 0,
          firebaseAuthWrites: 0,
          sessionChanges: 0,
          approvalRecordWrites: 0,
          commitCallableIncluded: false,
          actualUidCutoverAllowed: false
        },
        nextGate: {
          phase:
            "Phase 4C-12R cutover execution design and server manifest only",
          allowed:
            finalCommitDryRunReady,
          actualUidCutoverAllowed: false
        }
      };
    }
  );
