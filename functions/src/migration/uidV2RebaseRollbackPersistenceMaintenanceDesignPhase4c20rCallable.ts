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

export const UID_V2_REBASE_ROLLBACK_PERSISTENCE_MAINTENANCE_DESIGN_PHASE4C20R_VERSION =
  "2026-07-28.716.72-phase4c20r-production-rollback-persistence-maintenance-activation-design-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "360fec0965fbf74c89632effde291b3493c67e2256ada84a8beb110a4ac3ef45";

const EXPECTED_PHASE4C19_CONTRACT_DIGEST =
  "0bda4550515b1365ec3f727ad79d597b94cab52a0d1da189098f0367832304d3";

const EXPECTED_PHASE4C19_RESULT_DIGEST =
  "db00be2f2e15a973589b5e7f01e39e6bd853c3decbf3e1b7d1e48fff5179673a";

const EXPECTED_FRESH_SHEET_DIGEST =
  "036afb9f725bc47223c11b039e09331e240ad3d48ce48daf468fe99b912948a7";

const EXPECTED_FRESH_FIRESTORE_DIGEST =
  "8d6ef13dc6326c7f162b1a16cf784d38b9a4cb6a81e69dd721315f8e2522526c";

const EXPECTED_FRESH_AUTH_DIGEST =
  "ac37f1cf4deceda058ffa49eceeeea0cf345c8572c6fdf7744f20f5d5c0e9e43";

const EXPECTED_FRESH_ROLLBACK_DIGEST =
  "5bed375c09f83bad83c62135f5c9a34acc786b8778c86a897564f8d7d6d041f6";

const EXPECTED_PHASE4C18_CONTRACT_DIGEST =
  "f2f35eb4f0793f2c8f7f9fc3e821aca9c32339dde084c78d65a3a398730fdca6";

const EXPECTED_PHASE4C18_RESULT_DIGEST =
  "fe2db6f4e56544e16573fb9b2dedc956f76c72c9d5f176e4c1f13334987cc6bc";

const EXPECTED_PHASE4C17_CONTRACT_DIGEST =
  "646159f0e26df2053f2acb1ffa990da2799a7c695a43574a2ed91d0eddd847d7";

const EXPECTED_PHASE4C17_SEALED_PACKAGE_DIGEST =
  "856e80a1f7ff7f8a2bd31d0ac04d42b2c8056c58fd639388d13d3eb0cac4d7f6";

const EXPECTED_PHASE4C17_APPROVAL_TOKEN_DIGEST =
  "9bd8d4c752ef40d0333cc84bb95b19dfb3d1fb0f17aa1d0e2a8fb78a3bce0253";

const NEXT_GATE_PHASE =
  "Phase 4C-21R isolated rollback-payload persistence and maintenance state-machine rehearsal only";

type GenericRecord =
  Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmDesignOnly?: unknown;
  readonly confirmNoSnapshotPersistence?: unknown;
  readonly confirmNoMaintenanceActivation?: unknown;
  readonly confirmNoCutoverExecution?: unknown;
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

function captureChecksValid(
  value: unknown
): boolean {
  const checks =
    asRecord(
      value,
      "phase4c19.captureChecks"
    );

  return Object.entries(checks)
    .every(
      (
        [key, current]
      ) =>
        key ===
        "rawRollbackPayloadPersisted"
          ? current === false
          : current === true
    );
}

function expectedCounts():
  GenericRecord {
  return {
    sheetStudentRows:
      156,
    sheetPrincipalRows:
      12,
    sheetHeaderCells:
      2,
    sheetIdentityCells:
      168,
    sheetTotalTargetCells:
      170,
    principalAuthColumn9Anchors:
      12,
    attendanceDocuments:
      69,
    assignmentDocuments:
      14,
    firebaseAuthUsers:
      1,
    inPlaceAttendancePlans:
      68
  };
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

function rollbackPersistenceDesign():
  GenericRecord {
  return {"strategy":"server_side_fresh_recapture_after_maintenance_write_freeze","phase4c19DigestIsDesignEvidenceOnly":true,"phase4c19RawPayloadReusableForProduction":false,"freshCaptureRequiredAfterMaintenanceActive":true,"expectedPayloadBytesFromRehearsal":230370,"maximumAllowedPayloadBytes":8000000,"storageModel":{"metadataDocumentTemplate":"uidV2ProductionRollbackSnapshots/{cutoverRunId}","payloadChunkCollectionTemplate":"uidV2ProductionRollbackSnapshots/{cutoverRunId}/payloadChunks","verificationEventCollectionTemplate":"uidV2ProductionRollbackSnapshots/{cutoverRunId}/verificationEvents","payloadEncoding":"canonical_json_gzip_base64","maximumChunkPayloadBytes":700000,"expectedChunkCountAtRehearsalEstimate":1,"perChunkSha256Required":true,"wholeSnapshotSha256Required":true,"createOnly":true,"overwriteForbidden":true,"plaintextPayloadLoggingForbidden":true,"browserPayloadDownloadForbidden":true},"requiredPayloadSections":[{"section":"sheet","targetCells":170,"principalAuthColumn9Anchors":12},{"section":"attendance","documents":69},{"section":"assignments","documents":14},{"section":"firebaseAuth","users":1,"passwordMaterialIncluded":false},{"section":"inPlaceAttendancePlans","plans":68}],"stateMachine":["absent","capturing","captured","sealing","sealed","verified","retained","released"],"sealRequirements":["maintenance_window_active","production_execution_lock_owned","all_expected_counts_match","all_source_documents_exist","all_target_documents_absent","sheet_target_cells_match_expected_before","source_state_unchanged_during_capture","chunk_digests_match","whole_snapshot_digest_matches","approver_uid_bound","approval_token_digest_bound"],"retentionPolicy":{"minimumRetentionDays":30,"manualReleaseRequired":true,"releaseRequiresPostCutoverSignoff":true,"releaseBeforeSignoffForbidden":true},"actualPersistenceIncludedInThisPhase":false};
}

function maintenanceActivationDesign():
  GenericRecord {
  return {"controlDocument":"uidV2MaintenanceWindows/phase4c-production-cutover","productionLockDocument":"uidV2CutoverExecutionLocks/phase4c17r-production","stateMachine":["inactive","arming","active","releasing","inactive"],"failureState":"failed_closed","writeFreezeScopes":["student_profile_writes","student_login_state_writes","staff_profile_writes","attendance_writes","practice_room_reservation_writes","daily_evaluation_writes","training_upload_writes","uid_registry_writes","assignment_writes"],"readAvailabilityDuringMaintenance":true,"allowedWriter":"bound_superAdmin_cutover_executor_only","productionLockMustBeOwnedBeforeArming":true,"drainSeconds":60,"leaseSeconds":1800,"heartbeatSeconds":300,"failClosedOnLeaseExpiry":true,"automaticDeactivationOnLeaseExpiry":false,"releaseRequiresNoUnresolvedOperationalMutation":true,"activationIncludedInThisPhase":false};
}

function orchestrationOrder():
  GenericRecord[] {
  return [{"sequence":1,"operation":"validate_approval_and_all_prior_digests"},{"sequence":2,"operation":"acquire_production_single_writer_lock"},{"sequence":3,"operation":"set_maintenance_window_arming"},{"sequence":4,"operation":"confirm_write_freeze_and_wait_for_drain"},{"sequence":5,"operation":"set_maintenance_window_active"},{"sequence":6,"operation":"fresh_recapture_and_persist_rollback_snapshot"},{"sequence":7,"operation":"seal_and_verify_rollback_snapshot"},{"sequence":8,"operation":"rerun_final_live_preflight"},{"sequence":9,"operation":"require_separate_final_cutover_arm_confirmation"}];
}

function abortPolicy():
  GenericRecord {
  return {"beforeMaintenanceActive":["release_production_lock","record_aborted_before_freeze"],"afterMaintenanceActiveBeforeSnapshotSealed":["confirm_zero_operational_mutations","release_maintenance_window","release_production_lock","record_aborted_before_snapshot_seal"],"afterSnapshotSealedBeforeCutover":["retain_sealed_snapshot","confirm_zero_operational_mutations","release_maintenance_window","release_production_lock","record_aborted_with_snapshot_retained"],"automaticCutoverOnAnyFailure":false,"automaticSnapshotDeletionOnAbort":false};
}

function finalArmGate():
  GenericRecord {
  return {"existingApprovalTokenRequired":true,"sealedRollbackSnapshotRequired":true,"maintenanceWindowActiveRequired":true,"productionExecutionLockOwnedRequired":true,"finalLivePreflightRequired":true,"freshSnapshotAgeLimitSeconds":600,"separateFinalArmConfirmationRequired":true,"finalArmTokenIssued":false,"actualCutoverAllowed":false};
}

function safetyContract():
  GenericRecord {
  return {
    designOnly:
      true,
    productionRollbackSnapshotWrites:
      0,
    rawRollbackPayloadWrites:
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
    maintenanceModeChanges:
      0,
    productionExecutionLockWrites:
      0,
    finalArmTokenWrites:
      0,
    isolatedDesignWrites:
      1,
    commitCallableIncluded:
      false,
    cutoverExecutionCallableIncluded:
      false,
    rollbackExecutionCallableIncluded:
      false,
    snapshotPersistenceCallableIncluded:
      false,
    maintenanceActivationCallableIncluded:
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

  const [
    phase4c19Snapshot,
    phase4c18Snapshot,
    phase4c17Snapshot
  ] = await Promise.all([
    runRef
      .collection(
        "rebaseFreshRollbackCaptureRehearsals"
      )
      .doc(
        "phase4c19r"
      )
      .get(),
    runRef
      .collection(
        "rebaseMaintenancePreflightLockRehearsals"
      )
      .doc(
        "phase4c18r"
      )
      .get(),
    runRef
      .collection(
        "rebaseSealedProductionCutoverPackages"
      )
      .doc(
        "phase4c17r"
      )
      .get()
  ]);

  if (
    !phase4c19Snapshot.exists ||
    !phase4c18Snapshot.exists ||
    !phase4c17Snapshot.exists
  ) {
    throw new HttpsError(
      "not-found",
      "Phase 4C-19R, 4C-18R, or 4C-17R evidence is missing."
    );
  }

  const phase4c19Stored =
    phase4c19Snapshot.data() || {};

  const phase4c19 =
    asRecord(
      phase4c19Stored.result,
      "phase4c19.result"
    );

  const phase4c19Counts =
    asRecord(
      phase4c19.counts,
      "phase4c19.counts"
    );

  const phase4c19Safety =
    asRecord(
      phase4c19.safety,
      "phase4c19.safety"
    );

  const phase4c19Blocking =
    asArray(
      phase4c19.blockingReasons,
      "phase4c19.blockingReasons"
    );

  const phase4c19Chain =
    asRecord(
      phase4c19.chainChecks,
      "phase4c19.chainChecks"
    );

  const phase4c18Stored =
    phase4c18Snapshot.data() || {};

  const phase4c18 =
    asRecord(
      phase4c18Stored.rehearsal,
      "phase4c18.rehearsal"
    );

  const phase4c18Lock =
    asRecord(
      phase4c18.lockRehearsal,
      "phase4c18.lockRehearsal"
    );

  const phase4c18Safety =
    asRecord(
      phase4c18.safety,
      "phase4c18.safety"
    );

  const phase4c17Stored =
    phase4c17Snapshot.data() || {};

  const phase4c17Package =
    asRecord(
      phase4c17Stored.sealedPackage,
      "phase4c17.sealedPackage"
    );

  const phase4c17Approval =
    asRecord(
      phase4c17Stored.approval,
      "phase4c17.approval"
    );

  const chainChecks:
    GenericRecord = {
    phase4c19Status:
      text(
        phase4c19Stored.status
      ) ===
      "rebase_fresh_live_baseline_rollback_capture_rehearsal_staged",
    phase4c19Caller:
      text(
        phase4c19Stored.approvedByFirebaseUid
      ) ===
      callerUid,
    phase4c19Contract:
      text(
        phase4c19Stored.contractDigest
      ) ===
      EXPECTED_PHASE4C19_CONTRACT_DIGEST,
    phase4c19Result:
      text(
        phase4c19Stored.resultDigest
      ) ===
      EXPECTED_PHASE4C19_RESULT_DIGEST,
    phase4c19StoredResult:
      digestValue(
        phase4c19
      ) ===
      EXPECTED_PHASE4C19_RESULT_DIGEST,
    phase4c19FreshSheet:
      text(
        phase4c19.freshSheetSnapshotDigest
      ) ===
      EXPECTED_FRESH_SHEET_DIGEST,
    phase4c19FreshFirestore:
      text(
        phase4c19.freshFirestoreSnapshotDigest
      ) ===
      EXPECTED_FRESH_FIRESTORE_DIGEST,
    phase4c19FreshAuth:
      text(
        phase4c19.freshFirebaseAuthSnapshotDigest
      ) ===
      EXPECTED_FRESH_AUTH_DIGEST,
    phase4c19FreshRollback:
      text(
        phase4c19.freshRollbackSnapshotDigest
      ) ===
      EXPECTED_FRESH_ROLLBACK_DIGEST,
    phase4c19PayloadEstimate:
      Number(
        phase4c19.estimatedBytes
      ) ===
      230370,
    phase4c19Counts:
      exactJson(
        phase4c19Counts,
        expectedCounts()
      ),
    phase4c19CaptureChecks:
      captureChecksValid(
        phase4c19.captureChecks
      ),
    phase4c19ChainChecks:
      allTrue(
        phase4c19Chain
      ),
    phase4c19BlockingReasons:
      phase4c19Blocking.length ===
      0,
    phase4c19CapturePassed:
      phase4c19.captureRehearsalPassed ===
      true,
    phase4c19InMemory:
      phase4c19.freshBaselineCapturedInMemory ===
        true &&
      phase4c19.rollbackSnapshotCapturedInMemory ===
        true,
    phase4c19RawNotPersisted:
      phase4c19.rawRollbackPayloadPersisted ===
      false,
    phase4c19Discarded:
      phase4c19.snapshotDiscardedAfterDigest ===
      true,
    phase4c19NoCutover:
      phase4c19Safety.actualUidCutoverAllowed ===
      false,

    phase4c18Status:
      text(
        phase4c18Stored.status
      ) ===
      "rebase_maintenance_preflight_and_lock_rehearsal_staged",
    phase4c18Caller:
      text(
        phase4c18Stored.approvedByFirebaseUid
      ) ===
      callerUid,
    phase4c18Contract:
      text(
        phase4c18Stored.contractDigest
      ) ===
      EXPECTED_PHASE4C18_CONTRACT_DIGEST,
    phase4c18Result:
      text(
        phase4c18Stored.resultDigest
      ) ===
      EXPECTED_PHASE4C18_RESULT_DIGEST,
    phase4c18StoredResult:
      digestValue(
        phase4c18
      ) ===
      EXPECTED_PHASE4C18_RESULT_DIGEST,
    phase4c18LockPassed:
      phase4c18.executionLockRehearsalPassed ===
      true,
    phase4c18FinalLockAbsent:
      phase4c18Lock.finalLockAbsent ===
      true,
    phase4c18ProductionLockWrites:
      Number(
        phase4c18Lock.productionLockWrites
      ) ===
      0,
    phase4c18NoCutover:
      phase4c18Safety.actualUidCutoverAllowed ===
      false,

    phase4c17Status:
      text(
        phase4c17Stored.status
      ) ===
      "rebase_explicit_production_approval_and_sealed_package_staged",
    phase4c17Caller:
      text(
        phase4c17Stored.approvedByFirebaseUid
      ) ===
      callerUid,
    phase4c17Contract:
      text(
        phase4c17Stored.contractDigest
      ) ===
      EXPECTED_PHASE4C17_CONTRACT_DIGEST,
    phase4c17Package:
      text(
        phase4c17Stored.sealedPackageDigest
      ) ===
      EXPECTED_PHASE4C17_SEALED_PACKAGE_DIGEST,
    phase4c17Approval:
      text(
        phase4c17Approval.approvalTokenDigest
      ) ===
      EXPECTED_PHASE4C17_APPROVAL_TOKEN_DIGEST,
    phase4c17TokenIssued:
      phase4c17Approval.approvalTokenIssued ===
      true,
    phase4c17Ready:
      phase4c17Package.sealedPackageReady ===
        true &&
      phase4c17Package.executionPackageAllowed ===
        true,
    phase4c17NoCutover:
      phase4c17Package.actualCutoverAllowed ===
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
      `Phase 4C-20R prior-chain validation failed: ${blockingReasons.join(", ")}`
    );
  }

  const designCore:
    GenericRecord = {
    version:
      UID_V2_REBASE_ROLLBACK_PERSISTENCE_MAINTENANCE_DESIGN_PHASE4C20R_VERSION,
    phase:
      "Phase 4C-20R",
    mode:
      "rebase156_production_rollback_snapshot_persistence_and_maintenance_window_activation_design_only",
    requestId:
      REQUEST_ID,
    approvedByFirebaseUid:
      callerUid,
    contractDigest:
      CONTRACT_DIGEST,
    generatedAtIso:
      new Date().toISOString(),
    priorEvidence: {
      phase4c19ContractDigest:
        EXPECTED_PHASE4C19_CONTRACT_DIGEST,
      phase4c19ResultDigest:
        EXPECTED_PHASE4C19_RESULT_DIGEST,
      freshSheetSnapshotDigest:
        EXPECTED_FRESH_SHEET_DIGEST,
      freshFirestoreSnapshotDigest:
        EXPECTED_FRESH_FIRESTORE_DIGEST,
      freshFirebaseAuthSnapshotDigest:
        EXPECTED_FRESH_AUTH_DIGEST,
      freshRollbackSnapshotDigest:
        EXPECTED_FRESH_ROLLBACK_DIGEST,
      phase4c18ContractDigest:
        EXPECTED_PHASE4C18_CONTRACT_DIGEST,
      phase4c18ResultDigest:
        EXPECTED_PHASE4C18_RESULT_DIGEST,
      phase4c17ContractDigest:
        EXPECTED_PHASE4C17_CONTRACT_DIGEST,
      phase4c17SealedPackageDigest:
        EXPECTED_PHASE4C17_SEALED_PACKAGE_DIGEST,
      phase4c17ApprovalTokenDigest:
        EXPECTED_PHASE4C17_APPROVAL_TOKEN_DIGEST
    },
    expectedCounts:
      expectedCounts(),
    correctedProjectedTotals:
      correctedTotals(),
    rollbackSnapshotPersistenceDesign:
      rollbackPersistenceDesign(),
    maintenanceWindowActivationDesign:
      maintenanceActivationDesign(),
    orchestrationOrder:
      orchestrationOrder(),
    abortPolicy:
      abortPolicy(),
    finalArmGate:
      finalArmGate(),
    chainChecks,
    blockingReasons,
    designReady:
      true,
    rollbackPersistenceDesignReady:
      true,
    maintenanceActivationDesignReady:
      true,
    productionRollbackSnapshotPersisted:
      false,
    maintenanceWindowActivated:
      false,
    productionExecutionLockAcquired:
      false,
    finalArmTokenIssued:
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

  return {
    db,
    designRef:
      runRef
        .collection(
          "rebaseProductionRollbackPersistenceMaintenanceDesigns"
        )
        .doc(
          "phase4c20r"
        ),
    designCore,
    designDigest:
      digestValue(
        designCore
      )
  };
}

function verifyStoredDesign(
  stored: GenericRecord,
  built:
    BuiltDesign
): GenericRecord {
  const design =
    asRecord(
      stored.design,
      "stored.design"
    );

  const chainChecks =
    asRecord(
      design.chainChecks,
      "stored.design.chainChecks"
    );

  const blockingReasons =
    asArray(
      design.blockingReasons,
      "stored.design.blockingReasons"
    );

  const persistence =
    asRecord(
      design.rollbackSnapshotPersistenceDesign,
      "stored.design.rollbackSnapshotPersistenceDesign"
    );

  const maintenance =
    asRecord(
      design.maintenanceWindowActivationDesign,
      "stored.design.maintenanceWindowActivationDesign"
    );

  const arm =
    asRecord(
      design.finalArmGate,
      "stored.design.finalArmGate"
    );

  const safety =
    asRecord(
      design.safety,
      "stored.design.safety"
    );

  const storedGeneratedAtIso =
    text(
      design.generatedAtIso
    );

  const expectedDesign:
    GenericRecord = {
    ...built.designCore,
    generatedAtIso:
      storedGeneratedAtIso
  };

  return {
    status:
      text(
        stored.status
      ) ===
      "rebase_production_rollback_persistence_maintenance_design_staged",
    caller:
      text(
        stored.approvedByFirebaseUid
      ) ===
      text(
        built.designCore.approvedByFirebaseUid
      ),
    contract:
      text(
        stored.contractDigest
      ) ===
      CONTRACT_DIGEST,
    designDigest:
      text(
        stored.designDigest
      ) ===
      digestValue(
        design
      ),
    storedGeneratedAtIso:
      storedGeneratedAtIso !==
      "",
    currentDesign:
      exactJson(
        design,
        expectedDesign
      ),
    chainChecks:
      allTrue(
        chainChecks
      ),
    blockingReasons:
      blockingReasons.length ===
      0,
    designReady:
      design.designReady ===
      true,
    persistenceReady:
      design.rollbackPersistenceDesignReady ===
      true,
    maintenanceReady:
      design.maintenanceActivationDesignReady ===
      true,
    rawPhase4c19NotReusable:
      persistence.phase4c19RawPayloadReusableForProduction ===
      false,
    freshCaptureRequired:
      persistence.freshCaptureRequiredAfterMaintenanceActive ===
      true,
    noPersistence:
      persistence.actualPersistenceIncludedInThisPhase ===
        false &&
      design.productionRollbackSnapshotPersisted ===
        false,
    noMaintenanceActivation:
      maintenance.activationIncludedInThisPhase ===
        false &&
      design.maintenanceWindowActivated ===
        false,
    noProductionLock:
      design.productionExecutionLockAcquired ===
      false,
    noArmToken:
      arm.finalArmTokenIssued ===
        false &&
      design.finalArmTokenIssued ===
        false,
    noSnapshotWrites:
      Number(
        safety.productionRollbackSnapshotWrites
      ) ===
      0,
    noMaintenanceWrites:
      Number(
        safety.maintenanceModeChanges
      ) ===
      0,
    noProductionLockWrites:
      Number(
        safety.productionExecutionLockWrites
      ) ===
      0,
    noCutoverCallable:
      safety.cutoverExecutionCallableIncluded ===
      false,
    noRollbackCallable:
      safety.rollbackExecutionCallableIncluded ===
      false,
    noPersistenceCallable:
      safety.snapshotPersistenceCallableIncluded ===
      false,
    noMaintenanceCallable:
      safety.maintenanceActivationCallableIncluded ===
      false,
    noCutover:
      safety.actualUidCutoverAllowed ===
        false &&
      design.actualUidCutoverAllowed ===
        false
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
      UID_V2_REBASE_ROLLBACK_PERSISTENCE_MAINTENANCE_DESIGN_PHASE4C20R_VERSION,
    phase:
      "Phase 4C-20R",
    mode:
      "rebase156_production_rollback_snapshot_persistence_and_maintenance_window_activation_design_only",
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
    priorEvidence:
      design.priorEvidence,
    expectedCounts:
      design.expectedCounts,
    correctedProjectedTotals:
      design.correctedProjectedTotals,
    rollbackSnapshotPersistenceDesign:
      design.rollbackSnapshotPersistenceDesign,
    maintenanceWindowActivationDesign:
      design.maintenanceWindowActivationDesign,
    orchestrationOrder:
      design.orchestrationOrder,
    abortPolicy:
      design.abortPolicy,
    finalArmGate:
      design.finalArmGate,
    chainChecks:
      design.chainChecks,
    blockingReasons:
      design.blockingReasons,
    designReady:
      design.designReady,
    rollbackPersistenceDesignReady:
      design.rollbackPersistenceDesignReady,
    maintenanceActivationDesignReady:
      design.maintenanceActivationDesignReady,
    productionRollbackSnapshotPersisted:
      design.productionRollbackSnapshotPersisted,
    maintenanceWindowActivated:
      design.maintenanceWindowActivated,
    productionExecutionLockAcquired:
      design.productionExecutionLockAcquired,
    finalArmTokenIssued:
      design.finalArmTokenIssued,
    verified,
    digestMatches:
      verified,
    safety: {
      isolatedDesignWrites:
        writeOperations,
      productionRollbackSnapshotWrites:
        0,
      rawRollbackPayloadWrites:
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
      maintenanceModeChanges:
        0,
      productionExecutionLockWrites:
        0,
      finalArmTokenWrites:
        0,
      commitCallableIncluded:
        false,
      cutoverExecutionCallableIncluded:
        false,
      rollbackExecutionCallableIncluded:
        false,
      snapshotPersistenceCallableIncluded:
        false,
      maintenanceActivationCallableIncluded:
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

export const stageUidV2RollbackMaintenanceDesignPhase4c20r =
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
        input.confirmNoSnapshotPersistence !==
          true ||
        input.confirmNoMaintenanceActivation !==
          true ||
        input.confirmNoCutoverExecution !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-20R input gate failed."
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

            const checks =
              verifyStoredDesign(
                data,
                built
              );

            if (!allTrue(checks)) {
              throw new HttpsError(
                "already-exists",
                "A conflicting or invalid Phase 4C-20R design exists."
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
              UID_V2_REBASE_ROLLBACK_PERSISTENCE_MAINTENANCE_DESIGN_PHASE4C20R_VERSION,
            phase:
              "Phase 4C-20R",
            mode:
              "rebase156_production_rollback_snapshot_persistence_and_maintenance_window_activation_design_only",
            requestId:
              REQUEST_ID,
            approvedByFirebaseUid:
              callerUid,
            contractDigest:
              CONTRACT_DIGEST,
            designDigest:
              built.designDigest,
            design:
              built.designCore,
            status:
              "rebase_production_rollback_persistence_maintenance_design_staged",
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

export const inspectUidV2RollbackMaintenanceDesignPhase4c20r =
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
          "Phase 4C-20R inspect gate failed."
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
          "Phase 4C-20R design was not found."
        );
      }

      const stored =
        snapshot.data() || {};

      const checks =
        verifyStoredDesign(
          stored,
          built
        );

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
          `Phase 4C-20R design verification failed: ${failed.join(", ")}`
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
