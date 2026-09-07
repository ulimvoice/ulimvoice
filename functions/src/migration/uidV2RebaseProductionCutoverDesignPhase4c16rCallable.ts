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
  Firestore,
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_V2_REBASE_PRODUCTION_CUTOVER_DESIGN_PHASE4C16R_VERSION =
  "2026-07-28.716.67-phase4c16r-production-cutover-execution-design-final-approval-gate-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "3400f1fc9560ebf9a9d18327ad6f024b6c3132218750ad9410a14d3905063a36";

const EXPECTED_PHASE4C15_CONTRACT_DIGEST =
  "1d229a87b3497a3c907ef1541ccaab4c2ca0fadd47c39e105aa6dd3147ba1307";

const EXPECTED_PHASE4C15_MANIFEST_DIGEST =
  "fd226685950cdd5225804d9f086a299d03a8071aad314e47971c330d43677fe7";

const EXPECTED_PHASE4C15_DRY_RUN_DIGEST =
  "ffd2df9d199b68ec1d9d61c83c6bc380c3a405c040ec80a8d51668c46c3327d0";

const APPROVAL_PHRASE_DIGEST =
  "d461f72e989263819d7611e9fe093510af8fc2cfbe23c7b432a88dd152fee96b";

const NEXT_GATE_PHASE =
  "Phase 4C-17R explicit production approval and sealed execution package assembly only";

type GenericRecord =
  Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmDesignOnly?: unknown;
  readonly confirmApprovalGateOnly?: unknown;
  readonly confirmNoOperationalWrites?: unknown;
  readonly confirmNoApprovalIssued?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
}

interface BuiltDesign {
  readonly db: Firestore;
  readonly designRef:
    DocumentReference<DocumentData>;
  readonly designCore:
    GenericRecord;
  readonly designDigest:
    string;
  readonly approvalChallengeDigest:
    string;
  readonly chainChecks:
    GenericRecord;
  readonly blockingReasons:
    string[];
}

function defaultAdminApp(): App {
  const existing =
    getApps().find(
      (app: App) =>
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

function digestValue(
  value: unknown
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        canonicalize(value)
      ),
      "utf8"
    )
    .digest("hex");
}

function exactJson(
  left: unknown,
  right: unknown
): boolean {
  return JSON.stringify(
    canonicalize(left)
  ) ===
  JSON.stringify(
    canonicalize(right)
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

function correctedTotals():
  GenericRecord {
  return {
    sheetMutations:
      170,
    firestoreWrites:
      350,
    firebaseAuthWrites:
      1,
    logicalMutations:
      521
  };
}

function expectedForwardSequence():
  GenericRecord[] {
  return [
    {
      sequence:
        1,
      operation:
        "source_sheet_cell_patch",
      projectedMutations:
        170,
      verificationCheckpoint:
        "verify_170_target_cells_and_non_target_digest",
      failureAction:
        "stop_and_restore_sheet_170"
    },
    {
      sequence:
        2,
      operation:
        "firestore_uid_fanout_and_registry",
      projectedMutations:
        350,
      verificationCheckpoint:
        "verify_350_firestore_writes_and_registry_bindings",
      failureAction:
        "stop_restore_firestore_then_restore_sheet"
    },
    {
      sequence:
        3,
      operation:
        "firebase_auth_uid_transition",
      projectedMutations:
        1,
      verificationCheckpoint:
        "verify_auth_transition_and_superadmin_login",
      failureAction:
        "stop_restore_auth_then_firestore_then_sheet"
    }
  ];
}

function expectedRollbackSequence():
  GenericRecord[] {
  return [
    {
      sequence:
        1,
      operation:
        "firebase_auth_uid_transition_rollback",
      projectedMutations:
        1
    },
    {
      sequence:
        2,
      operation:
        "firestore_uid_fanout_and_registry_rollback",
      projectedMutations:
        350
    },
    {
      sequence:
        3,
      operation:
        "source_sheet_cell_patch_rollback",
      projectedMutations:
        170
    }
  ];
}

function safetyContract():
  GenericRecord {
  return {
    designOnly:
      true,
    finalApprovalGateOnly:
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
    sessionChanges:
      0,
    maintenanceModeChanges:
      0,
    executionLockWrites:
      0,
    approvalWrites:
      0,
    commitCallableIncluded:
      false,
    cutoverExecutionCallableIncluded:
      false,
    rollbackExecutionCallableIncluded:
      false,
    approvalCallableIncluded:
      false,
    approvalTokenIssued:
      false,
    actualUidCutoverAllowed:
      false
  };
}

async function buildDesign(
  callerUid: string
): Promise<BuiltDesign> {
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

  const dryRunRef =
    runRef
      .collection(
        "rebaseCorrectedFinalCutoverManifests"
      )
      .doc(
        "phase4c15r"
      );

  const designRef =
    runRef
      .collection(
        "rebaseProductionCutoverExecutionDesigns"
      )
      .doc(
        "phase4c16r"
      );

  const dryRunSnapshot =
    await dryRunRef.get();

  if (!dryRunSnapshot.exists) {
    throw new HttpsError(
      "not-found",
      "Phase 4C-15R corrected final dry-run manifest was not found."
    );
  }

  const dryRunStored =
    dryRunSnapshot.data() || {};

  const dryRunManifest =
    asRecord(
      dryRunStored.manifest,
      "phase4c15.manifest"
    );

  const dryRunTotals =
    asRecord(
      dryRunManifest.correctedProjectedTotals,
      "phase4c15.correctedProjectedTotals"
    );

  const dryRunChainChecks =
    asRecord(
      dryRunManifest.chainChecks,
      "phase4c15.chainChecks"
    );

  const dryRunBlockingReasons =
    asArray(
      dryRunManifest.blockingReasons,
      "phase4c15.blockingReasons"
    );

  const dryRunSafety =
    asRecord(
      dryRunManifest.safety,
      "phase4c15.safety"
    );

  const dryRunOperations =
    asArray(
      dryRunManifest.operationOrder,
      "phase4c15.operationOrder"
    );

  const chainChecks:
    GenericRecord = {
    phase4c15Status:
      text(
        dryRunStored.status
      ) ===
      "rebase_corrected_final_cutover_dry_run_manifest_staged",
    phase4c15Caller:
      text(
        dryRunStored.approvedByFirebaseUid
      ) ===
      callerUid,
    phase4c15Contract:
      text(
        dryRunStored.contractDigest
      ) ===
      EXPECTED_PHASE4C15_CONTRACT_DIGEST,
    phase4c15ManifestDigest:
      text(
        dryRunStored.manifestDigest
      ) ===
      EXPECTED_PHASE4C15_MANIFEST_DIGEST,
    phase4c15StoredManifestDigest:
      digestValue(
        dryRunManifest
      ) ===
      EXPECTED_PHASE4C15_MANIFEST_DIGEST,
    phase4c15DryRunDigest:
      text(
        dryRunStored.dryRunDigest
      ) ===
      EXPECTED_PHASE4C15_DRY_RUN_DIGEST,
    phase4c15Totals:
      exactJson(
        dryRunTotals,
        correctedTotals()
      ),
    phase4c15OperationOrder:
      exactJson(
        dryRunOperations,
        [
          {
            sequence:
              1,
            operation:
              "source_sheet_cell_patch",
            projectedMutations:
              170,
            executedMutations:
              0
          },
          {
            sequence:
              2,
            operation:
              "firestore_uid_fanout_and_registry",
            projectedMutations:
              350,
            executedMutations:
              0
          },
          {
            sequence:
              3,
            operation:
              "firebase_auth_uid_transition",
            projectedMutations:
              1,
            executedMutations:
              0
          }
        ]
      ),
    phase4c15ChainChecks:
      allTrue(
        dryRunChainChecks
      ),
    phase4c15BlockingReasons:
      dryRunBlockingReasons.length ===
      0,
    phase4c15Ready:
      dryRunManifest.finalDryRunReady ===
      true,
    phase4c15SourceWrites:
      Number(
        dryRunSafety.sourceSheetWrites
      ) ===
      0,
    phase4c15RegistryWrites:
      Number(
        dryRunSafety.activeUidRegistryWrites
      ) ===
      0,
    phase4c15AuthWrites:
      Number(
        dryRunSafety.firebaseAuthWrites
      ) ===
      0,
    phase4c15NoCommit:
      dryRunSafety.commitCallableIncluded ===
      false,
    phase4c15NoExecution:
      dryRunSafety.cutoverExecutionCallableIncluded ===
      false,
    phase4c15NoCutover:
      dryRunSafety.actualUidCutoverAllowed ===
      false
  };

  const blockingReasons =
    Object.entries(
      chainChecks
    )
      .filter(
        (
          [, passed]
        ) =>
          passed !== true
      )
      .map(
        (
          [key]
        ) =>
          key
      );

  if (blockingReasons.length > 0) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-16R prior-chain validation failed: ${blockingReasons.join(", ")}`
    );
  }

  const projectedTotals =
    correctedTotals();

  const forwardSequence =
    expectedForwardSequence();

  const rollbackSequence =
    expectedRollbackSequence();

  const safety =
    safetyContract();

  const approvalChallengeDigest =
    digestValue({
      requestId:
        REQUEST_ID,
      contractDigest:
        CONTRACT_DIGEST,
      phase4c15ManifestDigest:
        EXPECTED_PHASE4C15_MANIFEST_DIGEST,
      phase4c15DryRunDigest:
        EXPECTED_PHASE4C15_DRY_RUN_DIGEST,
      requiredApproverUid:
        callerUid,
      approvalPhraseDigest:
        APPROVAL_PHRASE_DIGEST,
      projectedTotals
    });

  const designCore:
    GenericRecord = {
    version:
      UID_V2_REBASE_PRODUCTION_CUTOVER_DESIGN_PHASE4C16R_VERSION,
    phase:
      "Phase 4C-16R",
    mode:
      "rebase156_production_cutover_execution_design_and_final_approval_gate_only",
    requestId:
      REQUEST_ID,
    approvedByFirebaseUid:
      callerUid,
    contractDigest:
      CONTRACT_DIGEST,
    priorEvidence: {
      phase4c15ContractDigest:
        EXPECTED_PHASE4C15_CONTRACT_DIGEST,
      phase4c15ManifestDigest:
        EXPECTED_PHASE4C15_MANIFEST_DIGEST,
      phase4c15DryRunDigest:
        EXPECTED_PHASE4C15_DRY_RUN_DIGEST
    },
    correctedProjectedTotals:
      projectedTotals,
    executionLock: {
      required:
        true,
      lockDocument:
        "uidV2CutoverExecutionLocks/phase4c17r-production",
      singleWriterRequired:
        true,
      leaseSeconds:
        1800,
      heartbeatSeconds:
        300,
      staleLockExecutionForbidden:
        true,
      lockWriteIncludedInThisPhase:
        false
    },
    maintenanceWindow: {
      required:
        true,
      studentLoginWriteFreezeRequired:
        true,
      staffWriteFreezeRequired:
        true,
      attendanceWriteFreezeRequired:
        true,
      reservationWriteFreezeRequired:
        true,
      evaluationWriteFreezeRequired:
        true,
      freezeActivationIncludedInThisPhase:
        false
    },
    preflight: {
      requiredChecks: [
        "superAdmin_identity_matches_manifest_approver",
        "phase4c15_manifest_digest_matches",
        "phase4c15_dry_run_digest_matches",
        "all_prior_chain_checks_true",
        "blocking_reasons_empty",
        "fresh_live_baseline_digest_matches",
        "fresh_rollback_snapshot_exists",
        "source_sheet_target_cells_match_expected_before",
        "non_target_sheet_digest_matches",
        "principal_auth_column9_anchors_match",
        "firestore_fanout_source_digests_match",
        "firebase_auth_transition_target_exists",
        "maintenance_write_freeze_confirmed",
        "single_execution_lock_acquired"
      ],
      anyFailureBlocksExecution:
        true,
      preflightWriteIncludedInThisPhase:
        false
    },
    forwardSequence,
    rollbackSequence,
    postCutoverVerification: {
      requiredChecks: [
        "sheet_170_values_exact",
        "sheet_non_target_digest_unchanged",
        "principal_auth_column9_preserved",
        "firestore_350_bindings_exact",
        "active_uid_registry_exact",
        "firebase_auth_transition_exact",
        "superadmin_login_success",
        "student_login_sample_success",
        "staff_login_sample_success",
        "attendance_read_write_smoke_test",
        "reservation_read_write_smoke_test",
        "evaluation_read_write_smoke_test",
        "legacy_uid_reference_scan_clean"
      ],
      allChecksRequired:
        true,
      verificationWritesIncludedInThisPhase:
        false
    },
    approvalGate: {
      state:
        "awaiting_explicit_production_approval",
      requiredApproverRole:
        "superAdmin",
      requiredApproverUid:
        callerUid,
      requiredApproverUidBoundAtStage:
        true,
      requiredPhraseDigest:
        APPROVAL_PHRASE_DIGEST,
      approvalPhraseStoredPlaintext:
        false,
      approvalChallengeDigest,
      approvalTokenIssued:
        false,
      approvalWriteIncludedInThisPhase:
        false,
      executionPackageAllowed:
        false,
      actualCutoverAllowed:
        false
    },
    chainChecks,
    blockingReasons,
    designReady:
      blockingReasons.length ===
      0,
    approvalReady:
      blockingReasons.length ===
      0,
    approvalState:
      "awaiting_explicit_production_approval",
    safety,
    nextGate: {
      phase:
        NEXT_GATE_PHASE,
      allowed:
        true,
      actualUidCutoverAllowed:
        false
    }
  };

  const designDigest =
    digestValue(
      designCore
    );

  return {
    db,
    designRef,
    designCore,
    designDigest,
    approvalChallengeDigest,
    chainChecks,
    blockingReasons
  };
}

function publicResult(
  stored: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean
) {
  const design =
    asRecord(
      stored.design,
      "stored.design"
    );

  return {
    ok:
      true,
    version:
      UID_V2_REBASE_PRODUCTION_CUTOVER_DESIGN_PHASE4C16R_VERSION,
    phase:
      "Phase 4C-16R",
    mode:
      "rebase156_production_cutover_execution_design_and_final_approval_gate_only",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    status:
      text(
        stored.status
      ),
    contractDigest:
      CONTRACT_DIGEST,
    designDigest:
      text(
        stored.designDigest
      ),
    approvalChallengeDigest:
      text(
        stored.approvalChallengeDigest
      ),
    priorEvidence:
      design.priorEvidence,
    correctedProjectedTotals:
      design.correctedProjectedTotals,
    executionLock:
      design.executionLock,
    maintenanceWindow:
      design.maintenanceWindow,
    preflight:
      design.preflight,
    forwardSequence:
      design.forwardSequence,
    rollbackSequence:
      design.rollbackSequence,
    postCutoverVerification:
      design.postCutoverVerification,
    approvalGate:
      design.approvalGate,
    chainChecks:
      design.chainChecks,
    blockingReasons:
      design.blockingReasons,
    designReady:
      design.designReady,
    approvalReady:
      design.approvalReady,
    approvalState:
      design.approvalState,
    verified,
    digestMatches:
      verified,
    safety: {
      isolatedDesignWrites:
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
      sessionChanges:
        0,
      maintenanceModeChanges:
        0,
      executionLockWrites:
        0,
      approvalWrites:
        0,
      commitCallableIncluded:
        false,
      cutoverExecutionCallableIncluded:
        false,
      rollbackExecutionCallableIncluded:
        false,
      approvalCallableIncluded:
        false,
      approvalTokenIssued:
        false,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        NEXT_GATE_PHASE,
      allowed:
        true,
      actualUidCutoverAllowed:
        false
    }
  };
}

export const stageUidV2RebaseProductionCutoverDesignPhase4c16r =
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
              StageInput
          : {};

      if (
        text(input.requestId) !==
          REQUEST_ID ||
        text(input.contractDigest) !==
          CONTRACT_DIGEST ||
        input.confirmDesignOnly !==
          true ||
        input.confirmApprovalGateOnly !==
          true ||
        input.confirmNoOperationalWrites !==
          true ||
        input.confirmNoApprovalIssued !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-16R input gate failed."
        );
      }

      const built =
        await buildDesign(
          callerUid
        );

      let duplicate =
        false;

      let writeOperations =
        0;

      let stored:
        GenericRecord = {};

      await built.db.runTransaction(
        async (transaction) => {
          const existing =
            await transaction.get(
              built.designRef
            );

          if (existing.exists) {
            const data =
              existing.data() || {};

            if (
              text(
                data.designDigest
              ) !==
                built.designDigest ||
              text(
                data.approvalChallengeDigest
              ) !==
                built.approvalChallengeDigest
            ) {
              throw new HttpsError(
                "already-exists",
                "A conflicting Phase 4C-16R design exists."
              );
            }

            duplicate =
              true;

            stored =
              data;

            return;
          }

          stored = {
            version:
              UID_V2_REBASE_PRODUCTION_CUTOVER_DESIGN_PHASE4C16R_VERSION,
            phase:
              "Phase 4C-16R",
            mode:
              "rebase156_production_cutover_execution_design_and_final_approval_gate_only",
            requestId:
              REQUEST_ID,
            approvedByFirebaseUid:
              callerUid,
            contractDigest:
              CONTRACT_DIGEST,
            designDigest:
              built.designDigest,
            approvalChallengeDigest:
              built.approvalChallengeDigest,
            design:
              built.designCore,
            status:
              "rebase_production_cutover_execution_design_staged",
            createdAtIso:
              new Date().toISOString()
          };

          transaction.set(
            built.designRef,
            stored
          );

          writeOperations =
            1;
        }
      );

      return publicResult(
        stored,
        duplicate,
        writeOperations,
        false
      );
    }
  );

export const inspectUidV2RebaseProductionCutoverDesignPhase4c16r =
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
        text(input.requestId) !==
          REQUEST_ID ||
        text(input.contractDigest) !==
          CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-16R inspect gate failed."
        );
      }

      const built =
        await buildDesign(
          callerUid
        );

      const snapshot =
        await built.designRef.get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-16R design was not found."
        );
      }

      const stored =
        snapshot.data() || {};

      const storedDesign =
        asRecord(
          stored.design,
          "stored.design"
        );

      const storedChainChecks =
        asRecord(
          storedDesign.chainChecks,
          "stored.design.chainChecks"
        );

      const storedBlockingReasons =
        asArray(
          storedDesign.blockingReasons,
          "stored.design.blockingReasons"
        );

      const storedApprovalGate =
        asRecord(
          storedDesign.approvalGate,
          "stored.design.approvalGate"
        );

      const storedSafety =
        asRecord(
          storedDesign.safety,
          "stored.design.safety"
        );

      const checks:
        GenericRecord = {
        status:
          text(
            stored.status
          ) ===
          "rebase_production_cutover_execution_design_staged",
        caller:
          text(
            stored.approvedByFirebaseUid
          ) ===
          callerUid,
        contract:
          text(
            stored.contractDigest
          ) ===
          CONTRACT_DIGEST,
        designDigest:
          text(
            stored.designDigest
          ) ===
          built.designDigest,
        storedDesignDigest:
          digestValue(
            storedDesign
          ) ===
          built.designDigest,
        approvalChallengeDigest:
          text(
            stored.approvalChallengeDigest
          ) ===
          built.approvalChallengeDigest,
        currentDesign:
          exactJson(
            storedDesign,
            built.designCore
          ),
        chainChecks:
          allTrue(
            storedChainChecks
          ),
        blockingReasons:
          storedBlockingReasons.length ===
          0,
        designReady:
          storedDesign.designReady ===
          true,
        approvalReady:
          storedDesign.approvalReady ===
          true,
        approvalState:
          text(
            storedDesign.approvalState
          ) ===
          "awaiting_explicit_production_approval",
        approvalNotIssued:
          storedApprovalGate.approvalTokenIssued ===
          false,
        executionStillBlocked:
          storedApprovalGate.executionPackageAllowed ===
            false &&
          storedApprovalGate.actualCutoverAllowed ===
            false,
        noExecutionCallable:
          storedSafety.cutoverExecutionCallableIncluded ===
          false,
        noRollbackCallable:
          storedSafety.rollbackExecutionCallableIncluded ===
          false,
        noApprovalCallable:
          storedSafety.approvalCallableIncluded ===
          false,
        noCutover:
          storedSafety.actualUidCutoverAllowed ===
          false
      };

      if (!allTrue(checks)) {
        const failed =
          Object.entries(
            checks
          )
            .filter(
              (
                [, passed]
              ) =>
                passed !== true
            )
            .map(
              (
                [key]
              ) =>
                key
            );

        throw new HttpsError(
          "data-loss",
          `Phase 4C-16R stored design verification failed: ${failed.join(", ")}`
        );
      }

      return publicResult(
        stored,
        true,
        0,
        true
      );
    }
  );
