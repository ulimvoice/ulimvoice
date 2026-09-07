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

export const UID_V2_REBASE_PREFLIGHT_LOCK_REHEARSAL_PHASE4C18R_VERSION =
  "2026-07-28.716.69-phase4c18r-maintenance-preflight-single-writer-lock-rehearsal-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "f2f35eb4f0793f2c8f7f9fc3e821aca9c32339dde084c78d65a3a398730fdca6";

const EXPECTED_PHASE4C17_CONTRACT_DIGEST =
  "646159f0e26df2053f2acb1ffa990da2799a7c695a43574a2ed91d0eddd847d7";

const EXPECTED_PHASE4C17_STATIC_PACKAGE_DIGEST =
  "1ff54d864f847bf40d060ccd7e88e7e88e883e4ad26518d26a92b9301afe04ea";

const EXPECTED_PHASE4C17_SEALED_PACKAGE_DIGEST =
  "856e80a1f7ff7f8a2bd31d0ac04d42b2c8056c58fd639388d13d3eb0cac4d7f6";

const EXPECTED_PHASE4C17_APPROVAL_TOKEN_DIGEST =
  "9bd8d4c752ef40d0333cc84bb95b19dfb3d1fb0f17aa1d0e2a8fb78a3bce0253";

const EXPECTED_PHASE4C16_DESIGN_DIGEST =
  "40b8f415edfdcc42459e7992c77e3a60e7bb9c586d203031c4f81e2a48c131d1";

const REHEARSAL_LOCK_COLLECTION =
  "rebaseExecutionLockRehearsalLocks";

const REHEARSAL_LOCK_DOCUMENT =
  "phase4c18r";

const RESULT_COLLECTION =
  "rebaseMaintenancePreflightLockRehearsals";

const RESULT_DOCUMENT =
  "phase4c18r";

const PRODUCTION_LOCK_PATH =
  "uidV2CutoverExecutionLocks/phase4c17r-production";

const REHEARSAL_LEASE_MS =
  120000;

const HEARTBEAT_EXTENSION_MS =
  120000;

const NEXT_GATE_PHASE =
  "Phase 4C-19R fresh live baseline and rollback snapshot capture rehearsal only";

type GenericRecord =
  Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmRehearsalOnly?: unknown;
  readonly confirmProductionLockWritesZero?: unknown;
  readonly confirmMaintenanceModeChangesZero?: unknown;
  readonly confirmNoCutoverExecution?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
}

interface BuiltContext {
  readonly db: Firestore;
  readonly lockRef:
    DocumentReference<DocumentData>;
  readonly resultRef:
    DocumentReference<DocumentData>;
  readonly callerUid:
    string;
  readonly approvalTokenDigest:
    string;
  readonly sealedPackageDigest:
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

function requiredPreflightChecks():
  string[] {
  return [
    "superAdmin_identity_matches_approval_approver",
    "phase4c17_sealed_package_digest_matches",
    "phase4c17_approval_token_digest_matches",
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
  ];
}

function scenarioMatrix():
  GenericRecord[] {
  return [
    {
      scenario:
        "all_preflight_inputs_valid",
      maintenanceFreezeConfirmed:
        true,
      freshBaselineMatches:
        true,
      rollbackSnapshotExists:
        true,
      sourceSheetExpectedBeforeMatches:
        true,
      nonTargetDigestMatches:
        true,
      principalAuthColumn9Matches:
        true,
      firestoreSourceDigestsMatch:
        true,
      firebaseAuthTargetExists:
        true,
      singleWriterLockAcquired:
        true,
      wouldPassPreflight:
        true
    },
    {
      scenario:
        "maintenance_freeze_missing",
      maintenanceFreezeConfirmed:
        false,
      freshBaselineMatches:
        true,
      rollbackSnapshotExists:
        true,
      sourceSheetExpectedBeforeMatches:
        true,
      nonTargetDigestMatches:
        true,
      principalAuthColumn9Matches:
        true,
      firestoreSourceDigestsMatch:
        true,
      firebaseAuthTargetExists:
        true,
      singleWriterLockAcquired:
        true,
      wouldPassPreflight:
        false
    },
    {
      scenario:
        "fresh_baseline_mismatch",
      maintenanceFreezeConfirmed:
        true,
      freshBaselineMatches:
        false,
      rollbackSnapshotExists:
        true,
      sourceSheetExpectedBeforeMatches:
        true,
      nonTargetDigestMatches:
        true,
      principalAuthColumn9Matches:
        true,
      firestoreSourceDigestsMatch:
        true,
      firebaseAuthTargetExists:
        true,
      singleWriterLockAcquired:
        true,
      wouldPassPreflight:
        false
    },
    {
      scenario:
        "rollback_snapshot_missing",
      maintenanceFreezeConfirmed:
        true,
      freshBaselineMatches:
        true,
      rollbackSnapshotExists:
        false,
      sourceSheetExpectedBeforeMatches:
        true,
      nonTargetDigestMatches:
        true,
      principalAuthColumn9Matches:
        true,
      firestoreSourceDigestsMatch:
        true,
      firebaseAuthTargetExists:
        true,
      singleWriterLockAcquired:
        true,
      wouldPassPreflight:
        false
    },
    {
      scenario:
        "single_writer_lock_conflict",
      maintenanceFreezeConfirmed:
        true,
      freshBaselineMatches:
        true,
      rollbackSnapshotExists:
        true,
      sourceSheetExpectedBeforeMatches:
        true,
      nonTargetDigestMatches:
        true,
      principalAuthColumn9Matches:
        true,
      firestoreSourceDigestsMatch:
        true,
      firebaseAuthTargetExists:
        true,
      singleWriterLockAcquired:
        false,
      wouldPassPreflight:
        false
    }
  ];
}

function safetyContract():
  GenericRecord {
  return {
    preflightAndLockRehearsalOnly:
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
    productionExecutionLockWrites:
      0,
    isolatedLockWrites:
      3,
    isolatedResultWrites:
      1,
    maximumTotalIsolatedWrites:
      4,
    commitCallableIncluded:
      false,
    cutoverExecutionCallableIncluded:
      false,
    rollbackExecutionCallableIncluded:
      false,
    actualUidCutoverAllowed:
      false
  };
}

async function buildContext(
  callerUid: string
): Promise<BuiltContext> {
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

  const packageRef =
    runRef
      .collection(
        "rebaseSealedProductionCutoverPackages"
      )
      .doc(
        "phase4c17r"
      );

  const designRef =
    runRef
      .collection(
        "rebaseProductionCutoverExecutionDesigns"
      )
      .doc(
        "phase4c16r"
      );

  const lockRef =
    runRef
      .collection(
        REHEARSAL_LOCK_COLLECTION
      )
      .doc(
        REHEARSAL_LOCK_DOCUMENT
      );

  const resultRef =
    runRef
      .collection(
        RESULT_COLLECTION
      )
      .doc(
        RESULT_DOCUMENT
      );

  const [
    packageSnapshot,
    designSnapshot
  ] = await Promise.all([
    packageRef.get(),
    designRef.get()
  ]);

  if (
    !packageSnapshot.exists ||
    !designSnapshot.exists
  ) {
    throw new HttpsError(
      "not-found",
      "Phase 4C-17R package or Phase 4C-16R design is missing."
    );
  }

  const packageStored =
    packageSnapshot.data() || {};

  const sealedPackage =
    asRecord(
      packageStored.sealedPackage,
      "phase4c17.sealedPackage"
    );

  const approval =
    asRecord(
      packageStored.approval,
      "phase4c17.approval"
    );

  const packageTotals =
    asRecord(
      sealedPackage.correctedProjectedTotals,
      "phase4c17.correctedProjectedTotals"
    );

  const packageForward =
    asArray(
      sealedPackage.forwardSequence,
      "phase4c17.forwardSequence"
    );

  const packageRollback =
    asArray(
      sealedPackage.rollbackSequence,
      "phase4c17.rollbackSequence"
    );

  const packageChainChecks =
    asRecord(
      sealedPackage.chainChecks,
      "phase4c17.chainChecks"
    );

  const packageBlockingReasons =
    asArray(
      sealedPackage.blockingReasons,
      "phase4c17.blockingReasons"
    );

  const packageSafety =
    asRecord(
      sealedPackage.safety,
      "phase4c17.safety"
    );

  const designStored =
    designSnapshot.data() || {};

  const design =
    asRecord(
      designStored.design,
      "phase4c16.design"
    );

  const designPreflight =
    asRecord(
      design.preflight,
      "phase4c16.preflight"
    );

  const designExecutionLock =
    asRecord(
      design.executionLock,
      "phase4c16.executionLock"
    );

  const designMaintenance =
    asRecord(
      design.maintenanceWindow,
      "phase4c16.maintenanceWindow"
    );

  const chainChecks:
    GenericRecord = {
    phase4c17Status:
      text(
        packageStored.status
      ) ===
      "rebase_explicit_production_approval_and_sealed_package_staged",
    phase4c17Caller:
      text(
        packageStored.approvedByFirebaseUid
      ) ===
      callerUid,
    phase4c17Contract:
      text(
        packageStored.contractDigest
      ) ===
      EXPECTED_PHASE4C17_CONTRACT_DIGEST,
    phase4c17StaticDigest:
      text(
        packageStored.staticPackageDigest
      ) ===
      EXPECTED_PHASE4C17_STATIC_PACKAGE_DIGEST,
    phase4c17SealedDigest:
      text(
        packageStored.sealedPackageDigest
      ) ===
      EXPECTED_PHASE4C17_SEALED_PACKAGE_DIGEST,
    phase4c17StoredSealedDigest:
      digestValue(
        sealedPackage
      ) ===
      EXPECTED_PHASE4C17_SEALED_PACKAGE_DIGEST,
    phase4c17ApprovalToken:
      text(
        approval.approvalTokenDigest
      ) ===
      EXPECTED_PHASE4C17_APPROVAL_TOKEN_DIGEST,
    phase4c17ApprovalState:
      text(
        approval.state
      ) ===
      "explicit_production_approval_recorded",
    phase4c17Approver:
      text(
        approval.approverUid
      ) ===
      callerUid,
    phase4c17TokenIssued:
      approval.approvalTokenIssued ===
      true,
    phase4c17Totals:
      exactJson(
        packageTotals,
        correctedTotals()
      ),
    phase4c17Forward:
      exactJson(
        packageForward,
        expectedForwardSequence()
      ),
    phase4c17Rollback:
      exactJson(
        packageRollback,
        expectedRollbackSequence()
      ),
    phase4c17Chain:
      allTrue(
        packageChainChecks
      ),
    phase4c17BlockingReasons:
      packageBlockingReasons.length ===
      0,
    phase4c17Ready:
      sealedPackage.sealedPackageReady ===
      true,
    phase4c17ExecutionPackageAllowed:
      sealedPackage.executionPackageAllowed ===
      true,
    phase4c17CutoverBlocked:
      sealedPackage.actualCutoverAllowed ===
      false,
    phase4c17DigestReferencesOnly:
      text(
        sealedPackage.payloadMode
      ) ===
      "digest_references_only",
    phase4c17NoOperationalPayload:
      sealedPackage.containsOperationalMutationPayloads ===
      false,
    phase4c17NoCutoverCallable:
      sealedPackage.containsCutoverCallable ===
      false,
    phase4c17NoRollbackCallable:
      sealedPackage.containsRollbackCallable ===
      false,
    phase4c17SafetyNoCutover:
      packageSafety.actualUidCutoverAllowed ===
      false,

    phase4c16DesignDigest:
      text(
        designStored.designDigest
      ) ===
      EXPECTED_PHASE4C16_DESIGN_DIGEST,
    phase4c16StoredDesignDigest:
      digestValue(
        design
      ) ===
      EXPECTED_PHASE4C16_DESIGN_DIGEST,
    phase4c16PreflightChecks:
      exactJson(
        asArray(
          designPreflight.requiredChecks,
          "phase4c16.preflight.requiredChecks"
        ),
        [
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
        ]
      ),
    phase4c16AnyFailureBlocks:
      designPreflight.anyFailureBlocksExecution ===
      true,
    phase4c16SingleWriter:
      designExecutionLock.singleWriterRequired ===
      true,
    phase4c16ProductionLockPath:
      text(
        designExecutionLock.lockDocument
      ) ===
      PRODUCTION_LOCK_PATH,
    phase4c16MaintenanceRequired:
      designMaintenance.required ===
      true,
    phase4c16FreezeNotActivated:
      designMaintenance.freezeActivationIncludedInThisPhase ===
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
      `Phase 4C-18R prior-chain validation failed: ${blockingReasons.join(", ")}`
    );
  }

  return {
    db,
    lockRef,
    resultRef,
    callerUid,
    approvalTokenDigest:
      EXPECTED_PHASE4C17_APPROVAL_TOKEN_DIGEST,
    sealedPackageDigest:
      EXPECTED_PHASE4C17_SEALED_PACKAGE_DIGEST,
    chainChecks,
    blockingReasons
  };
}

function verifyScenarioMatrix(
  matrixValue: unknown
): boolean {
  const matrix =
    asArray(
      matrixValue,
      "rehearsal.scenarioMatrix"
    );

  return exactJson(
    matrix,
    scenarioMatrix()
  );
}

function verifyStoredResult(
  stored: GenericRecord,
  context:
    BuiltContext
): GenericRecord {
  const rehearsal =
    asRecord(
      stored.rehearsal,
      "stored.rehearsal"
    );

  const lockRehearsal =
    asRecord(
      rehearsal.lockRehearsal,
      "stored.rehearsal.lockRehearsal"
    );

  const preflight =
    asRecord(
      rehearsal.preflightRehearsal,
      "stored.rehearsal.preflightRehearsal"
    );

  const storedChainChecks =
    asRecord(
      rehearsal.chainChecks,
      "stored.rehearsal.chainChecks"
    );

  const storedBlockingReasons =
    asArray(
      rehearsal.blockingReasons,
      "stored.rehearsal.blockingReasons"
    );

  const safety =
    asRecord(
      rehearsal.safety,
      "stored.rehearsal.safety"
    );

  const resultDigest =
    digestValue(
      rehearsal
    );

  const checks:
    GenericRecord = {
    resultDigest:
      text(
        stored.resultDigest
      ) ===
      resultDigest,
    caller:
      text(
        rehearsal.approvedByFirebaseUid
      ) ===
      context.callerUid,
    contract:
      text(
        rehearsal.contractDigest
      ) ===
      CONTRACT_DIGEST,
    sealedPackage:
      text(
        asRecord(
          rehearsal.priorEvidence,
          "rehearsal.priorEvidence"
        ).phase4c17SealedPackageDigest
      ) ===
      EXPECTED_PHASE4C17_SEALED_PACKAGE_DIGEST,
    approvalToken:
      text(
        asRecord(
          rehearsal.priorEvidence,
          "rehearsal.priorEvidence"
        ).phase4c17ApprovalTokenDigest
      ) ===
      EXPECTED_PHASE4C17_APPROVAL_TOKEN_DIGEST,
    totals:
      exactJson(
        rehearsal.correctedProjectedTotals,
        correctedTotals()
      ),
    requiredChecks:
      exactJson(
        preflight.requiredChecks,
        requiredPreflightChecks()
      ),
    scenarios:
      verifyScenarioMatrix(
        preflight.scenarioMatrix
      ),
    productionPreflightNotExecuted:
      preflight.productionPreflightExecuted ===
      false,
    productionPreflightNotPassed:
      preflight.productionPreflightPassed ===
      false,
    maintenanceNotActivated:
      preflight.maintenanceWindowActivated ===
      false,
    baselineNotCaptured:
      preflight.freshBaselineCaptured ===
      false,
    rollbackNotCaptured:
      preflight.rollbackSnapshotCaptured ===
      false,
    lockPath:
      text(
        lockRehearsal.productionLockPath
      ) ===
      PRODUCTION_LOCK_PATH,
    isolatedLockPath:
      text(
        lockRehearsal.isolatedLockPath
      ).endsWith(
        `/${REHEARSAL_LOCK_COLLECTION}/${REHEARSAL_LOCK_DOCUMENT}`
      ),
    acquire:
      lockRehearsal.acquireSucceeded ===
      true,
    competitor:
      lockRehearsal.competitorBlocked ===
      true,
    heartbeat:
      lockRehearsal.heartbeatSucceeded ===
      true,
    nonOwnerHeartbeat:
      lockRehearsal.nonOwnerHeartbeatBlocked ===
      true,
    nonOwnerRelease:
      lockRehearsal.nonOwnerReleaseBlocked ===
      true,
    release:
      lockRehearsal.ownerReleaseSucceeded ===
      true,
    finalAbsent:
      lockRehearsal.finalLockAbsent ===
      true,
    lockWrites:
      Number(
        lockRehearsal.isolatedLockWrites
      ) ===
      3,
    productionLockWrites:
      Number(
        lockRehearsal.productionLockWrites
      ) ===
      0,
    chainChecks:
      allTrue(
        storedChainChecks
      ),
    blockingReasons:
      storedBlockingReasons.length ===
      0,
    preflightRehearsalPassed:
      rehearsal.preflightRehearsalPassed ===
      true,
    lockRehearsalPassed:
      rehearsal.executionLockRehearsalPassed ===
      true,
    productionLockNotAcquired:
      rehearsal.productionExecutionLockAcquired ===
      false,
    safety:
      exactJson(
        safety,
        safetyContract()
      ),
    actualCutoverBlocked:
      rehearsal.actualUidCutoverAllowed ===
      false
  };

  return checks;
}

function publicResult(
  stored: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean
) {
  const rehearsal =
    asRecord(
      stored.rehearsal,
      "stored.rehearsal"
    );

  return {
    ok:
      true,
    version:
      UID_V2_REBASE_PREFLIGHT_LOCK_REHEARSAL_PHASE4C18R_VERSION,
    phase:
      "Phase 4C-18R",
    mode:
      "rebase156_maintenance_window_preflight_and_single_writer_execution_lock_rehearsal_only",
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
    resultDigest:
      text(
        stored.resultDigest
      ),
    priorEvidence:
      rehearsal.priorEvidence,
    correctedProjectedTotals:
      rehearsal.correctedProjectedTotals,
    preflightRehearsal:
      rehearsal.preflightRehearsal,
    lockRehearsal:
      rehearsal.lockRehearsal,
    chainChecks:
      rehearsal.chainChecks,
    blockingReasons:
      rehearsal.blockingReasons,
    preflightRehearsalPassed:
      rehearsal.preflightRehearsalPassed,
    executionLockRehearsalPassed:
      rehearsal.executionLockRehearsalPassed,
    productionExecutionLockAcquired:
      rehearsal.productionExecutionLockAcquired,
    verified,
    digestMatches:
      verified,
    safety: {
      isolatedWrites:
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
      productionExecutionLockWrites:
        0,
      isolatedLockWrites:
        duplicate
          ? 0
          : 3,
      isolatedResultWrites:
        duplicate
          ? 0
          : 1,
      maximumTotalIsolatedWrites:
        4,
      commitCallableIncluded:
        false,
      cutoverExecutionCallableIncluded:
        false,
      rollbackExecutionCallableIncluded:
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

export const stageUidV2RebaseMaintenancePreflightLockRehearsalPhase4c18r =
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
        input.confirmRehearsalOnly !==
          true ||
        input.confirmProductionLockWritesZero !==
          true ||
        input.confirmMaintenanceModeChangesZero !==
          true ||
        input.confirmNoCutoverExecution !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-18R input gate failed."
        );
      }

      const context =
        await buildContext(
          callerUid
        );

      const existingResult =
        await context.resultRef.get();

      if (existingResult.exists) {
        const stored =
          existingResult.data() || {};

        const checks =
          verifyStoredResult(
            stored,
            context
          );

        if (!allTrue(checks)) {
          throw new HttpsError(
            "data-loss",
            "Existing Phase 4C-18R result is invalid."
          );
        }

        const lockSnapshot =
          await context.lockRef.get();

        if (lockSnapshot.exists) {
          throw new HttpsError(
            "failed-precondition",
            "An isolated rehearsal lock remains after the completed result."
          );
        }

        return publicResult(
          stored,
          true,
          0,
          false
        );
      }

      const rehearsalId =
        digestValue({
          requestId:
            REQUEST_ID,
          contractDigest:
            CONTRACT_DIGEST,
          callerUid,
          approvedTokenDigest:
            context.approvalTokenDigest,
          startedAtIso:
            new Date().toISOString()
        });

      const competitorOwner =
        `competitor:${rehearsalId}`;

      let acquiredAtMs =
        0;

      let firstLeaseUntilMs =
        0;

      let heartbeatAtMs =
        0;

      let heartbeatLeaseUntilMs =
        0;

      let lockAcquired =
        false;

      let lockReleased =
        false;

      try {
        await context.db.runTransaction(
          async (transaction) => {
            const snapshot =
              await transaction.get(
                context.lockRef
              );

            if (snapshot.exists) {
              throw new HttpsError(
                "aborted",
                "The isolated rehearsal lock is already held."
              );
            }

            acquiredAtMs =
              Date.now();

            firstLeaseUntilMs =
              acquiredAtMs +
              REHEARSAL_LEASE_MS;

            transaction.set(
              context.lockRef,
              {
                isolated:
                  true,
                phase:
                  "Phase 4C-18R",
                rehearsalId,
                ownerUid:
                  callerUid,
                acquiredAtMs,
                leaseUntilMs:
                  firstLeaseUntilMs,
                heartbeatCount:
                  0,
                productionLockPath:
                  PRODUCTION_LOCK_PATH
              }
            );
          }
        );

        lockAcquired =
          true;

        let competitorBlocked =
          false;

        await context.db.runTransaction(
          async (transaction) => {
            const snapshot =
              await transaction.get(
                context.lockRef
              );

            if (!snapshot.exists) {
              throw new HttpsError(
                "data-loss",
                "The isolated lock disappeared before conflict verification."
              );
            }

            const lock =
              snapshot.data() || {};

            competitorBlocked =
              text(
                lock.ownerUid
              ) !==
                competitorOwner &&
              Number(
                lock.leaseUntilMs
              ) >
                Date.now();

            if (!competitorBlocked) {
              throw new HttpsError(
                "data-loss",
                "The competing owner was not blocked."
              );
            }
          }
        );

        let nonOwnerHeartbeatBlocked =
          false;

        await context.db.runTransaction(
          async (transaction) => {
            const snapshot =
              await transaction.get(
                context.lockRef
              );

            if (!snapshot.exists) {
              throw new HttpsError(
                "data-loss",
                "The isolated lock disappeared before non-owner heartbeat verification."
              );
            }

            const lock =
              snapshot.data() || {};

            nonOwnerHeartbeatBlocked =
              text(
                lock.ownerUid
              ) !==
              competitorOwner;

            if (!nonOwnerHeartbeatBlocked) {
              throw new HttpsError(
                "data-loss",
                "A non-owner heartbeat would not have been blocked."
              );
            }
          }
        );

        await context.db.runTransaction(
          async (transaction) => {
            const snapshot =
              await transaction.get(
                context.lockRef
              );

            if (!snapshot.exists) {
              throw new HttpsError(
                "data-loss",
                "The isolated lock disappeared before heartbeat."
              );
            }

            const lock =
              snapshot.data() || {};

            if (
              text(
                lock.ownerUid
              ) !==
                callerUid ||
              text(
                lock.rehearsalId
              ) !==
                rehearsalId
            ) {
              throw new HttpsError(
                "permission-denied",
                "Only the rehearsal lock owner can heartbeat."
              );
            }

            heartbeatAtMs =
              Date.now();

            heartbeatLeaseUntilMs =
              Math.max(
                Number(
                  lock.leaseUntilMs
                ),
                heartbeatAtMs
              ) +
              HEARTBEAT_EXTENSION_MS;

            transaction.update(
              context.lockRef,
              {
                heartbeatAtMs,
                heartbeatCount:
                  Number(
                    lock.heartbeatCount
                  ) + 1,
                leaseUntilMs:
                  heartbeatLeaseUntilMs
              }
            );
          }
        );

        let nonOwnerReleaseBlocked =
          false;

        await context.db.runTransaction(
          async (transaction) => {
            const snapshot =
              await transaction.get(
                context.lockRef
              );

            if (!snapshot.exists) {
              throw new HttpsError(
                "data-loss",
                "The isolated lock disappeared before non-owner release verification."
              );
            }

            const lock =
              snapshot.data() || {};

            nonOwnerReleaseBlocked =
              text(
                lock.ownerUid
              ) !==
              competitorOwner;

            if (!nonOwnerReleaseBlocked) {
              throw new HttpsError(
                "data-loss",
                "A non-owner release would not have been blocked."
              );
            }
          }
        );

        await context.db.runTransaction(
          async (transaction) => {
            const snapshot =
              await transaction.get(
                context.lockRef
              );

            if (!snapshot.exists) {
              throw new HttpsError(
                "data-loss",
                "The isolated lock disappeared before owner release."
              );
            }

            const lock =
              snapshot.data() || {};

            if (
              text(
                lock.ownerUid
              ) !==
                callerUid ||
              text(
                lock.rehearsalId
              ) !==
                rehearsalId
            ) {
              throw new HttpsError(
                "permission-denied",
                "Only the rehearsal lock owner can release."
              );
            }

            transaction.delete(
              context.lockRef
            );
          }
        );

        lockReleased =
          true;

        const finalLockSnapshot =
          await context.lockRef.get();

        if (finalLockSnapshot.exists) {
          throw new HttpsError(
            "data-loss",
            "The isolated rehearsal lock still exists after release."
          );
        }

        const rehearsal:
          GenericRecord = {
          version:
            UID_V2_REBASE_PREFLIGHT_LOCK_REHEARSAL_PHASE4C18R_VERSION,
          phase:
            "Phase 4C-18R",
          mode:
            "rebase156_maintenance_window_preflight_and_single_writer_execution_lock_rehearsal_only",
          requestId:
            REQUEST_ID,
          approvedByFirebaseUid:
            callerUid,
          contractDigest:
            CONTRACT_DIGEST,
          generatedAtIso:
            new Date().toISOString(),
          priorEvidence: {
            phase4c17ContractDigest:
              EXPECTED_PHASE4C17_CONTRACT_DIGEST,
            phase4c17StaticPackageDigest:
              EXPECTED_PHASE4C17_STATIC_PACKAGE_DIGEST,
            phase4c17SealedPackageDigest:
              EXPECTED_PHASE4C17_SEALED_PACKAGE_DIGEST,
            phase4c17ApprovalTokenDigest:
              EXPECTED_PHASE4C17_APPROVAL_TOKEN_DIGEST,
            phase4c16DesignDigest:
              EXPECTED_PHASE4C16_DESIGN_DIGEST
          },
          correctedProjectedTotals:
            correctedTotals(),
          preflightRehearsal: {
            requiredChecks:
              requiredPreflightChecks(),
            scenarioMatrix:
              scenarioMatrix(),
            productionPreflightExecuted:
              false,
            productionPreflightPassed:
              false,
            maintenanceWindowActivated:
              false,
            maintenanceModeWrites:
              0,
            freshBaselineCaptured:
              false,
            rollbackSnapshotCaptured:
              false
          },
          lockRehearsal: {
            isolatedLockPath:
              context.lockRef.path,
            productionLockPath:
              PRODUCTION_LOCK_PATH,
            rehearsalIdDigest:
              digestValue(
                rehearsalId
              ),
            leaseSeconds:
              REHEARSAL_LEASE_MS /
              1000,
            heartbeatExtensionSeconds:
              HEARTBEAT_EXTENSION_MS /
              1000,
            acquiredAtMs,
            firstLeaseUntilMs,
            heartbeatAtMs,
            heartbeatLeaseUntilMs,
            acquireSucceeded:
              true,
            competitorBlocked:
              competitorBlocked,
            heartbeatSucceeded:
              heartbeatLeaseUntilMs >
              firstLeaseUntilMs,
            nonOwnerHeartbeatBlocked:
              nonOwnerHeartbeatBlocked,
            nonOwnerReleaseBlocked:
              nonOwnerReleaseBlocked,
            ownerReleaseSucceeded:
              true,
            finalLockAbsent:
              true,
            acquireWrites:
              1,
            heartbeatWrites:
              1,
            releaseDeletes:
              1,
            isolatedLockWrites:
              3,
            productionLockWrites:
              0
          },
          chainChecks:
            context.chainChecks,
          blockingReasons:
            context.blockingReasons,
          preflightRehearsalPassed:
            true,
          executionLockRehearsalPassed:
            true,
          productionExecutionLockAcquired:
            false,
          safety:
            safetyContract(),
          actualUidCutoverAllowed:
            false,
          nextGate: {
            phase:
              NEXT_GATE_PHASE,
            allowed:
              true,
            actualUidCutoverAllowed:
              false
          }
        };

        const resultDigest =
          digestValue(
            rehearsal
          );

        const stored:
          GenericRecord = {
          version:
            UID_V2_REBASE_PREFLIGHT_LOCK_REHEARSAL_PHASE4C18R_VERSION,
          phase:
            "Phase 4C-18R",
          mode:
            "rebase156_maintenance_window_preflight_and_single_writer_execution_lock_rehearsal_only",
          requestId:
            REQUEST_ID,
          approvedByFirebaseUid:
            callerUid,
          contractDigest:
            CONTRACT_DIGEST,
          resultDigest,
          rehearsal,
          status:
            "rebase_maintenance_preflight_and_lock_rehearsal_staged",
          createdAtIso:
            new Date().toISOString()
        };

        await context.db.runTransaction(
          async (transaction) => {
            const existing =
              await transaction.get(
                context.resultRef
              );

            if (existing.exists) {
              throw new HttpsError(
                "already-exists",
                "A Phase 4C-18R result was created concurrently."
              );
            }

            transaction.set(
              context.resultRef,
              stored
            );
          }
        );

        return publicResult(
          stored,
          false,
          4,
          false
        );
      }
      finally {
        if (
          lockAcquired &&
          !lockReleased
        ) {
          try {
            await context.db.runTransaction(
              async (transaction) => {
                const snapshot =
                  await transaction.get(
                    context.lockRef
                  );

                if (!snapshot.exists) {
                  return;
                }

                const lock =
                  snapshot.data() || {};

                if (
                  text(
                    lock.ownerUid
                  ) ===
                    callerUid &&
                  text(
                    lock.rehearsalId
                  ) ===
                    rehearsalId
                ) {
                  transaction.delete(
                    context.lockRef
                  );
                }
              }
            );
          }
          catch (cleanupError) {
            console.error(
              "Phase 4C-18R isolated lock cleanup failed.",
              cleanupError
            );
          }
        }
      }
    }
  );

export const inspectUidV2RebaseMaintenancePreflightLockRehearsalPhase4c18r =
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
          "Phase 4C-18R inspect gate failed."
        );
      }

      const context =
        await buildContext(
          callerUid
        );

      const [
        resultSnapshot,
        lockSnapshot
      ] = await Promise.all([
        context.resultRef.get(),
        context.lockRef.get()
      ]);

      if (!resultSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-18R rehearsal result was not found."
        );
      }

      if (lockSnapshot.exists) {
        throw new HttpsError(
          "data-loss",
          "The isolated rehearsal lock remains after completion."
        );
      }

      const stored =
        resultSnapshot.data() || {};

      const checks =
        verifyStoredResult(
          stored,
          context
        );

      const finalChecks:
        GenericRecord = {
        status:
          text(
            stored.status
          ) ===
          "rebase_maintenance_preflight_and_lock_rehearsal_staged",
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
        storedResult:
          allTrue(
            checks
          ),
        finalLockAbsent:
          !lockSnapshot.exists
      };

      if (!allTrue(finalChecks)) {
        const failed =
          Object.entries(
            {
              ...checks,
              ...finalChecks
            }
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
          `Phase 4C-18R stored result verification failed: ${failed.join(", ")}`
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
