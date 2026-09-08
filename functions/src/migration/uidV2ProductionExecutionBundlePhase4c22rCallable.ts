import { createHash } from "node:crypto";
import { App, getApp, getApps, initializeApp } from "firebase-admin/app";
import {
  DocumentData,
  DocumentReference,
  Firestore,
  getFirestore
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

export const UID_V2_PRODUCTION_EXECUTION_BUNDLE_PHASE4C22R_VERSION =
  "2026-07-28.716.76-phase4c22r-production-maintenance-rollback-snapshot-execution-bundle-assembly-only";

const REGION = "asia-northeast3";
const REQUEST_ID = "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";
const CONTRACT_DIGEST = "c81b6c846a8daf61e9222a01cf43e257fc7c0656abb4e4b5ecdf79bd400d5c37";
const NEXT_GATE_PHASE =
  "Phase 4C-23R production maintenance activation and fresh rollback-snapshot persistence execution only";

const EXPECTED = {
  phase4c17ContractDigest:
    "646159f0e26df2053f2acb1ffa990da2799a7c695a43574a2ed91d0eddd847d7",
  phase4c17StaticPackageDigest:
    "1ff54d864f847bf40d060ccd7e88e7e88e883e4ad26518d26a92b9301afe04ea",
  phase4c17SealedPackageDigest:
    "856e80a1f7ff7f8a2bd31d0ac04d42b2c8056c58fd639388d13d3eb0cac4d7f6",
  phase4c17ApprovalTokenDigest:
    "9bd8d4c752ef40d0333cc84bb95b19dfb3d1fb0f17aa1d0e2a8fb78a3bce0253",
  phase4c18ContractDigest:
    "f2f35eb4f0793f2c8f7f9fc3e821aca9c32339dde084c78d65a3a398730fdca6",
  phase4c18ResultDigest:
    "fe2db6f4e56544e16573fb9b2dedc956f76c72c9d5f176e4c1f13334987cc6bc",
  phase4c19ContractDigest:
    "0bda4550515b1365ec3f727ad79d597b94cab52a0d1da189098f0367832304d3",
  phase4c19ResultDigest:
    "db00be2f2e15a973589b5e7f01e39e6bd853c3decbf3e1b7d1e48fff5179673a",
  phase4c19FreshRollbackSnapshotDigest:
    "5bed375c09f83bad83c62135f5c9a34acc786b8778c86a897564f8d7d6d041f6",
  phase4c20ContractDigest:
    "360fec0965fbf74c89632effde291b3493c67e2256ada84a8beb110a4ac3ef45",
  phase4c20DesignDigest:
    "48d2aeae006fb1f86fabf8501a53030d5ed9616a5663eb049ab9cb1da52d6939",
  phase4c21ContractDigest:
    "cfce476628ac743dea914e8b69e6d31beab043e13abbea32e484972fdfe2dad6",
  phase4c21ResultDigest:
    "1ff1fd7c838d4266b25a91c9e6c78416a7ef1ccec30fe381f8d5d02a25c478f4"
} as const;

type GenericRecord = Record<string, unknown>;

interface InputData {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmAssemblyOnly?: unknown;
  readonly confirmNoProductionExecution?: unknown;
  readonly confirmNoUidMutation?: unknown;
}

interface Context {
  readonly db: Firestore;
  readonly callerUid: string;
  readonly runRef: DocumentReference<DocumentData>;
  readonly resultRef: DocumentReference<DocumentData>;
  readonly chainChecks: GenericRecord;
  readonly blockingReasons: string[];
  readonly sealedPackage: GenericRecord;
  readonly phase4c20Design: GenericRecord;
  readonly phase4c21Result: GenericRecord;
}

function defaultAdminApp(): App {
  const current = getApps().find((app: App) => app.name === "[DEFAULT]");
  return current ? getApp() : initializeApp();
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function asRecord(value: unknown, label: string): GenericRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("failed-precondition", `${label} must be an object.`);
  }
  return value as GenericRecord;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new HttpsError("failed-precondition", `${label} must be an array.`);
  }
  return value;
}

function requireSuperAdmin(
  auth: { uid: string; token: GenericRecord } | undefined
): string {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Firebase authentication is required.");
  }

  const roles = strings(auth.token.roles);
  const allowed =
    text(auth.token.role) === "superAdmin" ||
    text(auth.token.ulimRole) === "superAdmin" ||
    text(auth.token.accountRole) === "superAdmin" ||
    roles.includes("superAdmin");

  if (!allowed) {
    throw new HttpsError("permission-denied", "superAdmin claim is required.");
  }

  return auth.uid;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);

  if (value && typeof value === "object") {
    const output: GenericRecord = {};
    for (const key of Object.keys(value as GenericRecord).sort()) {
      output[key] = canonicalize((value as GenericRecord)[key]);
    }
    return output;
  }

  return value;
}

function canonicalText(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function digestValue(value: unknown): string {
  return createHash("sha256")
    .update(canonicalText(value), "utf8")
    .digest("hex");
}

function exactJson(left: unknown, right: unknown): boolean {
  return canonicalText(left) === canonicalText(right);
}

function allTrue(value: GenericRecord): boolean {
  return Object.values(value).every((item) => item === true);
}

function expectedCounts(): GenericRecord {
  return {
    sheetStudentRows: 156,
    sheetPrincipalRows: 12,
    sheetHeaderCells: 2,
    sheetIdentityCells: 168,
    sheetTotalTargetCells: 170,
    principalAuthColumn9Anchors: 12,
    attendanceDocuments: 69,
    assignmentDocuments: 14,
    firebaseAuthUsers: 1,
    inPlaceAttendancePlans: 68
  };
}

function correctedTotals(): GenericRecord {
  return {
    sheetMutations: 170,
    firestoreWrites: 350,
    firebaseAuthWrites: 1,
    logicalMutations: 521
  };
}

function forwardSequence(): unknown[] {
  return [
    {
      sequence: 1,
      operation: "source_sheet_cell_patch",
      projectedMutations: 170,
      verificationCheckpoint:
        "verify_170_target_cells_and_non_target_digest",
      failureAction: "stop_and_restore_sheet_170"
    },
    {
      sequence: 2,
      operation: "firestore_uid_fanout_and_registry",
      projectedMutations: 350,
      verificationCheckpoint:
        "verify_350_firestore_writes_and_registry_bindings",
      failureAction:
        "stop_restore_firestore_then_restore_sheet"
    },
    {
      sequence: 3,
      operation: "firebase_auth_uid_transition",
      projectedMutations: 1,
      verificationCheckpoint:
        "verify_auth_transition_and_superadmin_login",
      failureAction:
        "stop_restore_auth_then_firestore_then_sheet"
    }
  ];
}

function rollbackSequence(): unknown[] {
  return [
    {
      sequence: 1,
      operation: "firebase_auth_uid_transition_rollback",
      projectedMutations: 1
    },
    {
      sequence: 2,
      operation: "firestore_uid_fanout_and_registry_rollback",
      projectedMutations: 350
    },
    {
      sequence: 3,
      operation: "source_sheet_cell_patch_rollback",
      projectedMutations: 170
    }
  ];
}

function postCutoverChecks(): string[] {
  return [
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
  ];
}

function orchestrationOrder(): unknown[] {
  return [
    { sequence: 1, operation: "validate_sealed_approval_and_all_prior_digests" },
    { sequence: 2, operation: "acquire_production_single_writer_lock" },
    { sequence: 3, operation: "set_maintenance_window_arming" },
    {
      sequence: 4,
      operation: "confirm_write_freeze_and_wait_60_second_drain"
    },
    { sequence: 5, operation: "set_maintenance_window_active" },
    {
      sequence: 6,
      operation: "fresh_recapture_and_create_only_persist_rollback_snapshot"
    },
    {
      sequence: 7,
      operation: "verify_chunk_and_whole_snapshot_digests_then_seal"
    },
    { sequence: 8, operation: "rerun_final_live_preflight" },
    {
      sequence: 9,
      operation: "await_new_explicit_phase4c23_execution_confirmation"
    }
  ];
}

function abortPolicy(): GenericRecord {
  return {
    beforeMaintenanceActive: [
      "release_production_lock",
      "record_aborted_before_freeze"
    ],
    afterMaintenanceActiveBeforeSnapshotSealed: [
      "confirm_zero_operational_mutations",
      "release_maintenance_window",
      "release_production_lock",
      "record_aborted_before_snapshot_seal"
    ],
    afterSnapshotSealedBeforeUidMutation: [
      "retain_sealed_snapshot",
      "confirm_zero_operational_mutations",
      "release_maintenance_window",
      "release_production_lock",
      "record_aborted_with_snapshot_retained"
    ],
    automaticUidMutationOnAnyFailure: false,
    automaticSnapshotDeletionOnAbort: false,
    automaticMaintenanceReleaseOnLeaseExpiry: false,
    leaseExpiryState: "failed_closed"
  };
}

function safetyContract(): GenericRecord {
  return {
    assemblyOnly: true,
    digestReferencesOnly: true,
    executionPackageAssembled: true,
    executionPackageExecutable: false,
    operationalMutationPayloadsIncluded: false,
    productionRawPayloadIncluded: false,
    commitCallableIncluded: false,
    cutoverExecutionCallableIncluded: false,
    rollbackExecutionCallableIncluded: false,
    productionSnapshotPersistenceCallableIncluded: false,
    productionMaintenanceActivationCallableIncluded: false,
    productionPreflightCallableIncluded: false,
    phase4c23ExecutionConfirmationIssued: false,
    finalArmTokenIssued: false,
    actualUidCutoverAllowed: false
  };
}

async function buildContext(callerUid: string): Promise<Context> {
  const db = getFirestore(defaultAdminApp());
  const runRef = db.collection("uidV2StagingRuns").doc(REQUEST_ID);

  const [
    p17Snap,
    p18Snap,
    p19Snap,
    p20Snap,
    p21Snap
  ] = await Promise.all([
    runRef.collection("rebaseSealedProductionCutoverPackages")
      .doc("phase4c17r").get(),
    runRef.collection("rebaseMaintenancePreflightLockRehearsals")
      .doc("phase4c18r").get(),
    runRef.collection("rebaseFreshRollbackCaptureRehearsals")
      .doc("phase4c19r").get(),
    runRef.collection("rebaseProductionRollbackPersistenceMaintenanceDesigns")
      .doc("phase4c20r").get(),
    runRef.collection("rebaseIsolatedRollbackMaintenanceRehearsals")
      .doc("phase4c21r").get()
  ]);

  if (
    !p17Snap.exists ||
    !p18Snap.exists ||
    !p19Snap.exists ||
    !p20Snap.exists ||
    !p21Snap.exists
  ) {
    throw new HttpsError(
      "not-found",
      "Phase 4C-17R through 4C-21R evidence is incomplete."
    );
  }

  const p17Stored = p17Snap.data() || {};
  const p17Package = asRecord(p17Stored.sealedPackage, "phase4c17.sealedPackage");
  const p17Approval = asRecord(p17Stored.approval, "phase4c17.approval");

  const p18Stored = p18Snap.data() || {};
  const p18Result = asRecord(p18Stored.rehearsal, "phase4c18.rehearsal");
  const p18Chain = asRecord(p18Result.chainChecks, "phase4c18.chainChecks");
  const p18Blocking = asArray(
    p18Result.blockingReasons,
    "phase4c18.blockingReasons"
  );

  const p19Stored = p19Snap.data() || {};
  const p19Result = asRecord(p19Stored.result, "phase4c19.result");
  const p19Chain = asRecord(p19Result.chainChecks, "phase4c19.chainChecks");
  const p19Blocking = asArray(
    p19Result.blockingReasons,
    "phase4c19.blockingReasons"
  );

  const p20Stored = p20Snap.data() || {};
  const p20Design = asRecord(p20Stored.design, "phase4c20.design");
  const p20Chain = asRecord(p20Design.chainChecks, "phase4c20.chainChecks");
  const p20Blocking = asArray(
    p20Design.blockingReasons,
    "phase4c20.blockingReasons"
  );

  const p21Stored = p21Snap.data() || {};
  const p21Result = asRecord(p21Stored.result, "phase4c21.result");
  const p21Chain = asRecord(p21Result.chainChecks, "phase4c21.chainChecks");
  const p21Blocked = asRecord(
    p21Result.blockedScenarioChecks,
    "phase4c21.blockedScenarioChecks"
  );
  const p21Blocking = asArray(
    p21Result.blockingReasons,
    "phase4c21.blockingReasons"
  );
  const p21Writes = asRecord(p21Result.actualWrites, "phase4c21.actualWrites");

  const p17Forward = asArray(
    p17Package.forwardSequence,
    "phase4c17.forwardSequence"
  );
  const p17Rollback = asArray(
    p17Package.rollbackSequence,
    "phase4c17.rollbackSequence"
  );

  const chainChecks: GenericRecord = {
    phase4c17Status:
      text(p17Stored.status) ===
      "rebase_explicit_production_approval_and_sealed_package_staged",
    phase4c17Caller:
      text(p17Stored.approvedByFirebaseUid) === callerUid,
    phase4c17Contract:
      text(p17Stored.contractDigest) === EXPECTED.phase4c17ContractDigest,
    phase4c17StaticPackage:
      text(p17Stored.staticPackageDigest) ===
      EXPECTED.phase4c17StaticPackageDigest,
    phase4c17SealedPackage:
      text(p17Stored.sealedPackageDigest) ===
      EXPECTED.phase4c17SealedPackageDigest,
    phase4c17StoredSealedPackage:
      digestValue(p17Package) === EXPECTED.phase4c17SealedPackageDigest,
    phase4c17ApprovalToken:
      text(p17Approval.approvalTokenDigest) ===
      EXPECTED.phase4c17ApprovalTokenDigest,
    phase4c17Approved:
      p17Approval.approvalTokenIssued === true &&
      text(p17Approval.state) === "explicit_production_approval_recorded",
    phase4c17Ready:
      p17Package.sealedPackageReady === true &&
      p17Package.executionPackageAllowed === true &&
      p17Package.actualCutoverAllowed === false,
    phase4c17DigestReferencesOnly:
      text(p17Package.payloadMode) === "digest_references_only" &&
      p17Package.containsOperationalMutationPayloads === false &&
      p17Package.containsCutoverCallable === false &&
      p17Package.containsRollbackCallable === false,
    phase4c17ForwardSequence:
      exactJson(p17Forward, forwardSequence()),
    phase4c17RollbackSequence:
      exactJson(p17Rollback, rollbackSequence()),

    phase4c18Status:
      text(p18Stored.status) ===
      "rebase_maintenance_preflight_and_lock_rehearsal_staged",
    phase4c18Caller:
      text(p18Stored.approvedByFirebaseUid) === callerUid,
    phase4c18Contract:
      text(p18Stored.contractDigest) === EXPECTED.phase4c18ContractDigest,
    phase4c18Result:
      text(p18Stored.resultDigest) === EXPECTED.phase4c18ResultDigest,
    phase4c18StoredResult:
      digestValue(p18Result) === EXPECTED.phase4c18ResultDigest,
    phase4c18Passed:
      p18Result.preflightRehearsalPassed === true &&
      p18Result.executionLockRehearsalPassed === true,
    phase4c18Chain:
      allTrue(p18Chain),
    phase4c18Blocking:
      p18Blocking.length === 0,
    phase4c18NoProductionLock:
      p18Result.productionExecutionLockAcquired === false,

    phase4c19Status:
      text(p19Stored.status) ===
      "rebase_fresh_live_baseline_rollback_capture_rehearsal_staged",
    phase4c19Caller:
      text(p19Stored.approvedByFirebaseUid) === callerUid,
    phase4c19Contract:
      text(p19Stored.contractDigest) === EXPECTED.phase4c19ContractDigest,
    phase4c19Result:
      text(p19Stored.resultDigest) === EXPECTED.phase4c19ResultDigest,
    phase4c19StoredResult:
      digestValue(p19Result) === EXPECTED.phase4c19ResultDigest,
    phase4c19FreshRollback:
      text(p19Result.freshRollbackSnapshotDigest) ===
      EXPECTED.phase4c19FreshRollbackSnapshotDigest,
    phase4c19Passed:
      p19Result.captureRehearsalPassed === true &&
      p19Result.freshBaselineCapturedInMemory === true &&
      p19Result.rollbackSnapshotCapturedInMemory === true,
    phase4c19RawNotPersisted:
      p19Result.rawRollbackPayloadPersisted === false &&
      p19Result.snapshotDiscardedAfterDigest === true,
    phase4c19Chain:
      allTrue(p19Chain),
    phase4c19Blocking:
      p19Blocking.length === 0,

    phase4c20Status:
      text(p20Stored.status) ===
      "rebase_production_rollback_persistence_maintenance_design_staged",
    phase4c20Caller:
      text(p20Stored.approvedByFirebaseUid) === callerUid,
    phase4c20Contract:
      text(p20Stored.contractDigest) === EXPECTED.phase4c20ContractDigest,
    phase4c20Design:
      text(p20Stored.designDigest) === EXPECTED.phase4c20DesignDigest,
    phase4c20StoredDesign:
      digestValue(p20Design) === EXPECTED.phase4c20DesignDigest,
    phase4c20Ready:
      p20Design.designReady === true &&
      p20Design.rollbackPersistenceDesignReady === true &&
      p20Design.maintenanceActivationDesignReady === true,
    phase4c20Chain:
      allTrue(p20Chain),
    phase4c20Blocking:
      p20Blocking.length === 0,
    phase4c20NoExecution:
      p20Design.productionRollbackSnapshotPersisted === false &&
      p20Design.maintenanceWindowActivated === false &&
      p20Design.productionExecutionLockAcquired === false &&
      p20Design.finalArmTokenIssued === false &&
      p20Design.actualUidCutoverAllowed === false,

    phase4c21Status:
      text(p21Stored.status) ===
      "rebase_isolated_rollback_maintenance_rehearsal_staged",
    phase4c21Caller:
      text(p21Stored.approvedByFirebaseUid) === callerUid,
    phase4c21Contract:
      text(p21Stored.contractDigest) === EXPECTED.phase4c21ContractDigest,
    phase4c21Result:
      text(p21Stored.resultDigest) === EXPECTED.phase4c21ResultDigest,
    phase4c21StoredResult:
      digestValue(p21Result) === EXPECTED.phase4c21ResultDigest,
    phase4c21Passed:
      p21Result.rehearsalPassed === true &&
      p21Result.isolatedRollbackPersistencePassed === true &&
      p21Result.maintenanceStateMachinePassed === true &&
      p21Result.isolatedArtifactsCleaned === true,
    phase4c21Chain:
      allTrue(p21Chain),
    phase4c21BlockedScenarios:
      allTrue(p21Blocked),
    phase4c21Blocking:
      p21Blocking.length === 0,
    phase4c21Writes:
      Number(p21Writes.totalIsolatedWrites) === 22,
    phase4c21ProductionUntouched:
      p21Result.productionRollbackSnapshotPersisted === false &&
      p21Result.productionMaintenanceWindowActivated === false &&
      p21Result.productionExecutionLockAcquired === false &&
      p21Result.finalArmTokenIssued === false &&
      p21Result.actualUidCutoverAllowed === false
  };

  const blockingReasons = Object.entries(chainChecks)
    .filter(([, passed]) => passed !== true)
    .map(([key]) => key);

  if (blockingReasons.length > 0) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-22R chain validation failed: ${blockingReasons.join(", ")}`
    );
  }

  return {
    db,
    callerUid,
    runRef,
    resultRef:
      runRef.collection("rebaseProductionExecutionBundleAssemblies")
        .doc("phase4c22r"),
    chainChecks,
    blockingReasons,
    sealedPackage: p17Package,
    phase4c20Design: p20Design,
    phase4c21Result: p21Result
  };
}

function buildAssemblyCore(context: Context): GenericRecord {
  return {
    version: UID_V2_PRODUCTION_EXECUTION_BUNDLE_PHASE4C22R_VERSION,
    phase: "Phase 4C-22R",
    mode: "rebase156_production_maintenance_rollback_snapshot_execution_bundle_assembly_digest_references_only",
    requestId: REQUEST_ID,
    callerUidDigest: digestValue(context.callerUid),
    contractDigest: CONTRACT_DIGEST,
    payloadMode: "digest_references_and_resource_templates_only",
    priorEvidenceDigests: {
      ...EXPECTED
    },
    expectedCounts: expectedCounts(),
    correctedProjectedTotals: correctedTotals(),
    operationalResourceTemplates: {
      productionExecutionLockDocument:
        "uidV2CutoverExecutionLocks/phase4c17r-production",
      maintenanceControlDocument:
        "uidV2MaintenanceWindows/phase4c-production-cutover",
      rollbackSnapshotMetadataTemplate:
        "uidV2ProductionRollbackSnapshots/{cutoverRunId}",
      rollbackSnapshotChunkCollectionTemplate:
        "uidV2ProductionRollbackSnapshots/{cutoverRunId}/payloadChunks",
      rollbackSnapshotVerificationCollectionTemplate:
        "uidV2ProductionRollbackSnapshots/{cutoverRunId}/verificationEvents"
    },
    rollbackSnapshotPlan: {
      freshCaptureRequiredAfterMaintenanceActive: true,
      phase4c19RawPayloadReusableForProduction: false,
      expectedPayloadBytesFromRehearsal: 230370,
      maximumAllowedCanonicalBytes: 8000000,
      encoding: "canonical_json_gzip_base64",
      maximumChunkPayloadBytes: 700000,
      expectedCurrentChunkCount: 1,
      absoluteMaximumChunkCount: 16,
      perChunkSha256Required: true,
      wholeCompressedSha256Required: true,
      wholeCanonicalSha256Required: true,
      createOnly: true,
      overwriteForbidden: true,
      plaintextPayloadLoggingForbidden: true,
      browserPayloadDownloadForbidden: true,
      minimumRetentionDays: 30,
      manualReleaseRequired: true,
      releaseRequiresPostCutoverSignoff: true
    },
    maintenancePlan: {
      stateMachine: ["inactive", "arming", "active", "releasing", "inactive"],
      failureState: "failed_closed",
      productionLockMustBeOwnedBeforeArming: true,
      drainSeconds: 60,
      leaseSeconds: 1800,
      heartbeatSeconds: 300,
      failClosedOnLeaseExpiry: true,
      automaticDeactivationOnLeaseExpiry: false,
      readAvailabilityDuringMaintenance: true,
      releaseRequiresNoUnresolvedOperationalMutation: true,
      writeFreezeScopes: [
        "student_profile_writes",
        "student_login_state_writes",
        "staff_profile_writes",
        "attendance_writes",
        "practice_room_reservation_writes",
        "daily_evaluation_writes",
        "training_upload_writes",
        "uid_registry_writes",
        "assignment_writes"
      ]
    },
    forwardSequence: forwardSequence(),
    rollbackSequence: rollbackSequence(),
    postCutoverVerification: {
      requiredChecks: postCutoverChecks(),
      allChecksRequired: true
    },
    orchestrationOrder: orchestrationOrder(),
    abortPolicy: abortPolicy(),
    componentInventory: {
      productionLockControllerIncluded: false,
      maintenanceActivationControllerIncluded: false,
      freshCaptureExecutorIncluded: false,
      productionSnapshotPersistenceExecutorIncluded: false,
      finalLivePreflightExecutorIncluded: false,
      uidCutoverExecutorIncluded: false,
      rollbackExecutorIncluded: false,
      finalArmIssuerIncluded: false,
      stageAndInspectAssemblyCallablesOnly: true
    },
    executionGate: {
      existingPhase4c17ApprovalTokenRequired: true,
      sealedExecutionPackageRequired: true,
      phase4c21RehearsalPassedRequired: true,
      productionExecutionLockOwnedRequired: true,
      maintenanceWindowActiveRequired: true,
      sealedFreshRollbackSnapshotRequired: true,
      finalLivePreflightRequired: true,
      freshSnapshotAgeLimitSeconds: 600,
      newPhase4c23ExplicitExecutionConfirmationRequired: true,
      phase4c23ExecutionConfirmationIssued: false,
      finalArmTokenIssued: false,
      productionMaintenanceActivationAllowedNow: false,
      productionSnapshotPersistenceAllowedNow: false,
      uidMutationAllowedNow: false,
      actualUidCutoverAllowed: false
    },
    assemblyWriteBudget: {
      isolatedAssemblyManifestWritesMaximum: 1,
      productionExecutionLockWrites: 0,
      productionMaintenanceModeChanges: 0,
      productionRollbackSnapshotWrites: 0,
      sourceSheetWrites: 0,
      activeUidRegistryWrites: 0,
      attendanceWrites: 0,
      assignmentWrites: 0,
      firebaseAuthWrites: 0,
      sessionChanges: 0,
      finalArmTokenWrites: 0
    },
    chainChecks: context.chainChecks,
    blockingReasons: context.blockingReasons,
    assemblyReady: true,
    productionExecutionPackageAssembled: true,
    productionExecutionPackageExecutable: false,
    productionMaintenanceActivationAllowed: false,
    productionSnapshotPersistenceAllowed: false,
    finalArmTokenIssued: false,
    actualUidCutoverAllowed: false,
    safety: safetyContract(),
    nextGate: {
      phase: NEXT_GATE_PHASE,
      allowed: true,
      requiresNewExplicitExecutionConfirmation: true,
      uidMutationAllowed: false,
      actualUidCutoverAllowed: false
    }
  };
}

function verifyStored(
  stored: GenericRecord,
  callerUid: string,
  expectedCore: GenericRecord
): GenericRecord {
  const core = asRecord(stored.assemblyCore, "stored.assemblyCore");
  const safety = asRecord(core.safety, "stored.assemblyCore.safety");
  const componentInventory = asRecord(
    core.componentInventory,
    "stored.assemblyCore.componentInventory"
  );
  const executionGate = asRecord(
    core.executionGate,
    "stored.assemblyCore.executionGate"
  );
  const blockingReasons = asArray(
    core.blockingReasons,
    "stored.assemblyCore.blockingReasons"
  );
  const chainChecks = asRecord(
    core.chainChecks,
    "stored.assemblyCore.chainChecks"
  );

  return {
    status:
      text(stored.status) ===
      "rebase_production_execution_bundle_assembly_staged",
    caller:
      text(stored.approvedByFirebaseUid) === callerUid,
    contract:
      text(stored.contractDigest) === CONTRACT_DIGEST,
    coreExact:
      exactJson(core, expectedCore),
    coreDigest:
      text(stored.assemblyCoreDigest) === digestValue(core),
    packageDigest:
      text(stored.assemblyPackageDigest) ===
      digestValue({
        assemblyCore: core,
        assembledAtIso: text(stored.assembledAtIso)
      }),
    assembledAt:
      text(stored.assembledAtIso) !== "",
    chainChecks:
      allTrue(chainChecks),
    blockingReasons:
      blockingReasons.length === 0,
    ready:
      core.assemblyReady === true &&
      core.productionExecutionPackageAssembled === true &&
      core.productionExecutionPackageExecutable === false,
    componentsAbsent:
      componentInventory.productionLockControllerIncluded === false &&
      componentInventory.maintenanceActivationControllerIncluded === false &&
      componentInventory.freshCaptureExecutorIncluded === false &&
      componentInventory.productionSnapshotPersistenceExecutorIncluded === false &&
      componentInventory.finalLivePreflightExecutorIncluded === false &&
      componentInventory.uidCutoverExecutorIncluded === false &&
      componentInventory.rollbackExecutorIncluded === false &&
      componentInventory.finalArmIssuerIncluded === false &&
      componentInventory.stageAndInspectAssemblyCallablesOnly === true,
    executionBlocked:
      executionGate.phase4c23ExecutionConfirmationIssued === false &&
      executionGate.finalArmTokenIssued === false &&
      executionGate.productionMaintenanceActivationAllowedNow === false &&
      executionGate.productionSnapshotPersistenceAllowedNow === false &&
      executionGate.uidMutationAllowedNow === false &&
      executionGate.actualUidCutoverAllowed === false,
    safety:
      exactJson(safety, safetyContract()),
    noExecution:
      core.productionMaintenanceActivationAllowed === false &&
      core.productionSnapshotPersistenceAllowed === false &&
      core.finalArmTokenIssued === false &&
      core.actualUidCutoverAllowed === false
  };
}

function publicResult(
  stored: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean
): GenericRecord {
  const core = asRecord(stored.assemblyCore, "stored.assemblyCore");

  return {
    ok: true,
    version: UID_V2_PRODUCTION_EXECUTION_BUNDLE_PHASE4C22R_VERSION,
    phase: "Phase 4C-22R",
    mode: "rebase156_production_maintenance_rollback_snapshot_execution_bundle_assembly_digest_references_only",
    requestId: REQUEST_ID,
    duplicate,
    writeOperations,
    status: text(stored.status),
    contractDigest: CONTRACT_DIGEST,
    assemblyCoreDigest: text(stored.assemblyCoreDigest),
    assemblyPackageDigest: text(stored.assemblyPackageDigest),
    priorEvidenceDigests: core.priorEvidenceDigests,
    expectedCounts: core.expectedCounts,
    correctedProjectedTotals: core.correctedProjectedTotals,
    payloadMode: core.payloadMode,
    operationalResourceTemplates: core.operationalResourceTemplates,
    rollbackSnapshotPlan: core.rollbackSnapshotPlan,
    maintenancePlan: core.maintenancePlan,
    forwardSequence: core.forwardSequence,
    rollbackSequence: core.rollbackSequence,
    postCutoverVerification: core.postCutoverVerification,
    orchestrationOrder: core.orchestrationOrder,
    abortPolicy: core.abortPolicy,
    componentInventory: core.componentInventory,
    executionGate: core.executionGate,
    assemblyWriteBudget: core.assemblyWriteBudget,
    chainChecks: core.chainChecks,
    blockingReasons: core.blockingReasons,
    assemblyReady: core.assemblyReady,
    productionExecutionPackageAssembled:
      core.productionExecutionPackageAssembled,
    productionExecutionPackageExecutable:
      core.productionExecutionPackageExecutable,
    productionMaintenanceActivationAllowed:
      core.productionMaintenanceActivationAllowed,
    productionSnapshotPersistenceAllowed:
      core.productionSnapshotPersistenceAllowed,
    finalArmTokenIssued: core.finalArmTokenIssued,
    actualUidCutoverAllowed: core.actualUidCutoverAllowed,
    verified,
    digestMatches: verified,
    safety: {
      isolatedAssemblyWrites: writeOperations,
      productionExecutionLockWrites: 0,
      productionMaintenanceModeChanges: 0,
      productionRollbackSnapshotWrites: 0,
      sourceSheetWrites: 0,
      activeUidRegistryWrites: 0,
      attendanceWrites: 0,
      assignmentWrites: 0,
      firebaseAuthWrites: 0,
      sessionChanges: 0,
      finalArmTokenWrites: 0,
      commitCallableIncluded: false,
      cutoverExecutionCallableIncluded: false,
      rollbackExecutionCallableIncluded: false,
      productionSnapshotPersistenceCallableIncluded: false,
      productionMaintenanceActivationCallableIncluded: false,
      productionPreflightCallableIncluded: false,
      actualUidCutoverAllowed: false
    },
    nextGate: core.nextGate
  };
}

export const stageUidV2ProductionExecutionBundlePhase4c22r = onCall(
  {
    region: REGION,
    timeoutSeconds: 300,
    memory: "512MiB",
    enforceAppCheck: false
  },
  async (request) => {
    const callerUid = requireSuperAdmin(
      request.auth as { uid: string; token: GenericRecord } | undefined
    );

    const input =
      request.data && typeof request.data === "object"
        ? (request.data as InputData)
        : {};

    if (
      text(input.requestId) !== REQUEST_ID ||
      text(input.contractDigest) !== CONTRACT_DIGEST ||
      input.confirmAssemblyOnly !== true ||
      input.confirmNoProductionExecution !== true ||
      input.confirmNoUidMutation !== true
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Phase 4C-22R assembly input gate failed."
      );
    }

    const context = await buildContext(callerUid);
    const assemblyCore = buildAssemblyCore(context);
    const existing = await context.resultRef.get();

    if (existing.exists) {
      const stored = existing.data() || {};
      const checks = verifyStored(stored, callerUid, assemblyCore);

      if (!allTrue(checks)) {
        throw new HttpsError(
          "data-loss",
          "Existing Phase 4C-22R assembly is invalid."
        );
      }

      return publicResult(stored, true, 0, false);
    }

    const assembledAtIso = new Date().toISOString();

    const stored: GenericRecord = {
      version: UID_V2_PRODUCTION_EXECUTION_BUNDLE_PHASE4C22R_VERSION,
      phase: "Phase 4C-22R",
      mode: "rebase156_production_maintenance_rollback_snapshot_execution_bundle_assembly_digest_references_only",
      requestId: REQUEST_ID,
      approvedByFirebaseUid: callerUid,
      contractDigest: CONTRACT_DIGEST,
      assemblyCoreDigest: digestValue(assemblyCore),
      assemblyPackageDigest: digestValue({
        assemblyCore,
        assembledAtIso
      }),
      assemblyCore,
      assembledAtIso,
      status: "rebase_production_execution_bundle_assembly_staged",
      createdAtIso: assembledAtIso
    };

    await context.db.runTransaction(async (transaction) => {
      const current = await transaction.get(context.resultRef);

      if (current.exists) {
        throw new HttpsError(
          "already-exists",
          "A Phase 4C-22R assembly was created concurrently."
        );
      }

      transaction.set(context.resultRef, stored);
    });

    return publicResult(stored, false, 1, false);
  }
);

export const inspectUidV2ProductionExecutionBundlePhase4c22r = onCall(
  {
    region: REGION,
    timeoutSeconds: 300,
    memory: "512MiB",
    enforceAppCheck: false
  },
  async (request) => {
    const callerUid = requireSuperAdmin(
      request.auth as { uid: string; token: GenericRecord } | undefined
    );

    const input =
      request.data && typeof request.data === "object"
        ? (request.data as InputData)
        : {};

    if (
      text(input.requestId) !== REQUEST_ID ||
      text(input.contractDigest) !== CONTRACT_DIGEST
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Phase 4C-22R inspect gate failed."
      );
    }

    const context = await buildContext(callerUid);
    const assemblyCore = buildAssemblyCore(context);
    const snapshot = await context.resultRef.get();

    if (!snapshot.exists) {
      throw new HttpsError(
        "not-found",
        "Phase 4C-22R assembly was not found."
      );
    }

    const stored = snapshot.data() || {};
    const checks = verifyStored(stored, callerUid, assemblyCore);

    if (!allTrue(checks)) {
      const failed = Object.entries(checks)
        .filter(([, passed]) => passed !== true)
        .map(([key]) => key);

      throw new HttpsError(
        "data-loss",
        `Phase 4C-22R assembly verification failed: ${failed.join(", ")}`
      );
    }

    return publicResult(stored, true, 0, true);
  }
);
