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

export const UID_V2_REBASE_EXPLICIT_APPROVAL_PHASE4C17R_VERSION =
  "2026-07-28.716.68-phase4c17r-explicit-production-approval-sealed-execution-package-assembly-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "646159f0e26df2053f2acb1ffa990da2799a7c695a43574a2ed91d0eddd847d7";

const EXPECTED_PHASE4C16_CONTRACT_DIGEST =
  "3400f1fc9560ebf9a9d18327ad6f024b6c3132218750ad9410a14d3905063a36";

const EXPECTED_PHASE4C16_DESIGN_DIGEST =
  "40b8f415edfdcc42459e7992c77e3a60e7bb9c586d203031c4f81e2a48c131d1";

const EXPECTED_PHASE4C16_APPROVAL_CHALLENGE_DIGEST =
  "c7df8c76e857f4cbd65881f397f70b321dbe8d217c793fe47796a42be12bb9cf";

const EXPECTED_APPROVAL_PHRASE_DIGEST =
  "d461f72e989263819d7611e9fe093510af8fc2cfbe23c7b432a88dd152fee96b";

const NEXT_GATE_PHASE =
  "Phase 4C-18R maintenance-window preflight and single-writer execution-lock rehearsal only";

type GenericRecord =
  Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly approvalPhrase?: unknown;
  readonly confirmExplicitProductionApproval?: unknown;
  readonly confirmSealedAssemblyOnly?: unknown;
  readonly confirmNoCutoverExecution?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
}

interface BuiltStaticAssembly {
  readonly db: Firestore;
  readonly packageRef:
    DocumentReference<DocumentData>;
  readonly approverUid:
    string;
  readonly design:
    GenericRecord;
  readonly chainChecks:
    GenericRecord;
  readonly blockingReasons:
    string[];
  readonly staticPackageCore:
    GenericRecord;
  readonly staticPackageDigest:
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

function digestText(
  value: string
): string {
  return createHash("sha256")
    .update(
      value,
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
    approvalAndAssemblyOnly:
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
    commitCallableIncluded:
      false,
    cutoverExecutionCallableIncluded:
      false,
    rollbackExecutionCallableIncluded:
      false,
    approvalCallableIncluded:
      true,
    approvalTokenIssuedByThisPhase:
      true,
    executionPackageAssembledByThisPhase:
      true,
    actualUidCutoverAllowed:
      false
  };
}

async function buildStaticAssembly(
  callerUid: string
): Promise<BuiltStaticAssembly> {
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

  const designRef =
    runRef
      .collection(
        "rebaseProductionCutoverExecutionDesigns"
      )
      .doc(
        "phase4c16r"
      );

  const packageRef =
    runRef
      .collection(
        "rebaseSealedProductionCutoverPackages"
      )
      .doc(
        "phase4c17r"
      );

  const designSnapshot =
    await designRef.get();

  if (!designSnapshot.exists) {
    throw new HttpsError(
      "not-found",
      "Phase 4C-16R execution design was not found."
    );
  }

  const designStored =
    designSnapshot.data() || {};

  const design =
    asRecord(
      designStored.design,
      "phase4c16.design"
    );

  const designTotals =
    asRecord(
      design.correctedProjectedTotals,
      "phase4c16.correctedProjectedTotals"
    );

  const designForwardSequence =
    asArray(
      design.forwardSequence,
      "phase4c16.forwardSequence"
    );

  const designRollbackSequence =
    asArray(
      design.rollbackSequence,
      "phase4c16.rollbackSequence"
    );

  const designApprovalGate =
    asRecord(
      design.approvalGate,
      "phase4c16.approvalGate"
    );

  const designChainChecks =
    asRecord(
      design.chainChecks,
      "phase4c16.chainChecks"
    );

  const designBlockingReasons =
    asArray(
      design.blockingReasons,
      "phase4c16.blockingReasons"
    );

  const designSafety =
    asRecord(
      design.safety,
      "phase4c16.safety"
    );

  const chainChecks:
    GenericRecord = {
    phase4c16Status:
      text(
        designStored.status
      ) ===
      "rebase_production_cutover_execution_design_staged",
    phase4c16Caller:
      text(
        designStored.approvedByFirebaseUid
      ) ===
      callerUid,
    phase4c16Contract:
      text(
        designStored.contractDigest
      ) ===
      EXPECTED_PHASE4C16_CONTRACT_DIGEST,
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
    phase4c16ApprovalChallenge:
      text(
        designStored.approvalChallengeDigest
      ) ===
      EXPECTED_PHASE4C16_APPROVAL_CHALLENGE_DIGEST,
    phase4c16Totals:
      exactJson(
        designTotals,
        correctedTotals()
      ),
    phase4c16ForwardSequence:
      exactJson(
        designForwardSequence,
        expectedForwardSequence()
      ),
    phase4c16RollbackSequence:
      exactJson(
        designRollbackSequence,
        expectedRollbackSequence()
      ),
    phase4c16ChainChecks:
      allTrue(
        designChainChecks
      ),
    phase4c16BlockingReasons:
      designBlockingReasons.length ===
      0,
    phase4c16DesignReady:
      design.designReady ===
      true,
    phase4c16ApprovalReady:
      design.approvalReady ===
      true,
    phase4c16ApprovalState:
      text(
        design.approvalState
      ) ===
      "awaiting_explicit_production_approval",
    phase4c16ApproverUid:
      text(
        designApprovalGate.requiredApproverUid
      ) ===
      callerUid,
    phase4c16PhraseDigest:
      text(
        designApprovalGate.requiredPhraseDigest
      ) ===
      EXPECTED_APPROVAL_PHRASE_DIGEST,
    phase4c16TokenNotIssued:
      designApprovalGate.approvalTokenIssued ===
      false,
    phase4c16PackageBlocked:
      designApprovalGate.executionPackageAllowed ===
      false,
    phase4c16CutoverBlocked:
      designApprovalGate.actualCutoverAllowed ===
      false,
    phase4c16NoExecution:
      designSafety.cutoverExecutionCallableIncluded ===
      false,
    phase4c16NoRollback:
      designSafety.rollbackExecutionCallableIncluded ===
      false,
    phase4c16NoApprovalCallable:
      designSafety.approvalCallableIncluded ===
      false,
    phase4c16NoCutover:
      designSafety.actualUidCutoverAllowed ===
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
      `Phase 4C-17R prior-chain validation failed: ${blockingReasons.join(", ")}`
    );
  }

  const staticPackageCore:
    GenericRecord = {
    version:
      UID_V2_REBASE_EXPLICIT_APPROVAL_PHASE4C17R_VERSION,
    phase:
      "Phase 4C-17R",
    mode:
      "rebase156_explicit_production_approval_and_sealed_execution_package_assembly_only",
    requestId:
      REQUEST_ID,
    contractDigest:
      CONTRACT_DIGEST,
    priorEvidence: {
      phase4c16ContractDigest:
        EXPECTED_PHASE4C16_CONTRACT_DIGEST,
      phase4c16DesignDigest:
        EXPECTED_PHASE4C16_DESIGN_DIGEST,
      phase4c16ApprovalChallengeDigest:
        EXPECTED_PHASE4C16_APPROVAL_CHALLENGE_DIGEST
    },
    correctedProjectedTotals:
      correctedTotals(),
    payloadMode:
      "digest_references_only",
    containsOperationalMutationPayloads:
      false,
    containsCutoverCallable:
      false,
    containsRollbackCallable:
      false,
    forwardSequence:
      expectedForwardSequence(),
    rollbackSequence:
      expectedRollbackSequence(),
    approvalPolicy: {
      requiredApproverRole:
        "superAdmin",
      requiredApproverUid:
        callerUid,
      requiredPhraseDigest:
        EXPECTED_APPROVAL_PHRASE_DIGEST,
      approvalPhraseStoredPlaintext:
        false
    },
    executionPolicy: {
      approvalTokenRequired:
        true,
      maintenanceWindowRequired:
        true,
      freshPreflightRequired:
        true,
      singleWriterExecutionLockRequired:
        true,
      executionPackageAllowedAfterApproval:
        true,
      actualCutoverAllowed:
        false
    },
    chainChecks,
    blockingReasons,
    safety:
      safetyContract(),
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
    packageRef,
    approverUid:
      callerUid,
    design,
    chainChecks,
    blockingReasons,
    staticPackageCore,
    staticPackageDigest:
      digestValue(
        staticPackageCore
      )
  };
}

function verifyStoredPackage(
  stored: GenericRecord,
  built:
    BuiltStaticAssembly
): GenericRecord {
  const sealedPackage =
    asRecord(
      stored.sealedPackage,
      "stored.sealedPackage"
    );

  const approval =
    asRecord(
      stored.approval,
      "stored.approval"
    );

  const approvedAtIso =
    text(
      approval.approvedAtIso
    );

  const expectedApprovalTokenDigest =
    digestValue({
      requestId:
        REQUEST_ID,
      contractDigest:
        CONTRACT_DIGEST,
      phase4c16DesignDigest:
        EXPECTED_PHASE4C16_DESIGN_DIGEST,
      approvalChallengeDigest:
        EXPECTED_PHASE4C16_APPROVAL_CHALLENGE_DIGEST,
      approverUid:
        built.approverUid,
      approvalPhraseDigest:
        EXPECTED_APPROVAL_PHRASE_DIGEST,
      approvedAtIso
    });

  const expectedSealedPackageDigest =
    digestValue(
      sealedPackage
    );

  const storedChainChecks =
    asRecord(
      sealedPackage.chainChecks,
      "stored.sealedPackage.chainChecks"
    );

  const storedBlockingReasons =
    asArray(
      sealedPackage.blockingReasons,
      "stored.sealedPackage.blockingReasons"
    );

  const packageSafety =
    asRecord(
      sealedPackage.safety,
      "stored.sealedPackage.safety"
    );

  const checks:
    GenericRecord = {
    approvedAt:
      approvedAtIso !== "",
    approverUid:
      text(
        approval.approverUid
      ) ===
      built.approverUid,
    approverRole:
      text(
        approval.approverRole
      ) ===
      "superAdmin",
    phraseDigest:
      text(
        approval.approvalPhraseDigest
      ) ===
      EXPECTED_APPROVAL_PHRASE_DIGEST,
    phraseNotStored:
      approval.approvalPhraseStoredPlaintext ===
      false,
    approvalToken:
      text(
        approval.approvalTokenDigest
      ) ===
      expectedApprovalTokenDigest,
    approvalTokenIssued:
      approval.approvalTokenIssued ===
      true,
    staticPackageDigest:
      text(
        stored.staticPackageDigest
      ) ===
      built.staticPackageDigest,
    sealedPackageDigest:
      text(
        stored.sealedPackageDigest
      ) ===
      expectedSealedPackageDigest,
    packageContract:
      text(
        sealedPackage.contractDigest
      ) ===
      CONTRACT_DIGEST,
    packageDesign:
      text(
        asRecord(
          sealedPackage.priorEvidence,
          "sealedPackage.priorEvidence"
        ).phase4c16DesignDigest
      ) ===
      EXPECTED_PHASE4C16_DESIGN_DIGEST,
    packageTokenBinding:
      text(
        sealedPackage.approvalTokenDigest
      ) ===
      expectedApprovalTokenDigest,
    packageApprovedAt:
      text(
        sealedPackage.approvedAtIso
      ) ===
      approvedAtIso,
    packageApprover:
      text(
        sealedPackage.approvedByFirebaseUid
      ) ===
      built.approverUid,
    packageReady:
      sealedPackage.sealedPackageReady ===
      true,
    packageAllowed:
      sealedPackage.executionPackageAllowed ===
      true,
    actualCutoverBlocked:
      sealedPackage.actualCutoverAllowed ===
      false,
    chainChecks:
      allTrue(
        storedChainChecks
      ),
    blockingReasons:
      storedBlockingReasons.length ===
      0,
    noOperationalPayloads:
      sealedPackage.containsOperationalMutationPayloads ===
      false,
    noCutoverCallable:
      sealedPackage.containsCutoverCallable ===
      false,
    noRollbackCallable:
      sealedPackage.containsRollbackCallable ===
      false,
    safetyNoCutover:
      packageSafety.actualUidCutoverAllowed ===
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
  const sealedPackage =
    asRecord(
      stored.sealedPackage,
      "stored.sealedPackage"
    );

  const approval =
    asRecord(
      stored.approval,
      "stored.approval"
    );

  return {
    ok:
      true,
    version:
      UID_V2_REBASE_EXPLICIT_APPROVAL_PHASE4C17R_VERSION,
    phase:
      "Phase 4C-17R",
    mode:
      "rebase156_explicit_production_approval_and_sealed_execution_package_assembly_only",
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
    staticPackageDigest:
      text(
        stored.staticPackageDigest
      ),
    sealedPackageDigest:
      text(
        stored.sealedPackageDigest
      ),
    approvalTokenDigest:
      text(
        approval.approvalTokenDigest
      ),
    approval: {
      state:
        text(
          approval.state
        ),
      approverRole:
        text(
          approval.approverRole
        ),
      approverUid:
        text(
          approval.approverUid
        ),
      approvedAtIso:
        text(
          approval.approvedAtIso
        ),
      approvalPhraseStoredPlaintext:
        false,
      approvalTokenIssued:
        true
    },
    correctedProjectedTotals:
      sealedPackage.correctedProjectedTotals,
    forwardSequence:
      sealedPackage.forwardSequence,
    rollbackSequence:
      sealedPackage.rollbackSequence,
    payloadMode:
      sealedPackage.payloadMode,
    containsOperationalMutationPayloads:
      sealedPackage.containsOperationalMutationPayloads,
    containsCutoverCallable:
      sealedPackage.containsCutoverCallable,
    containsRollbackCallable:
      sealedPackage.containsRollbackCallable,
    chainChecks:
      sealedPackage.chainChecks,
    blockingReasons:
      sealedPackage.blockingReasons,
    sealedPackageReady:
      sealedPackage.sealedPackageReady,
    executionPackageAllowed:
      sealedPackage.executionPackageAllowed,
    actualCutoverAllowed:
      sealedPackage.actualCutoverAllowed,
    verified,
    digestMatches:
      verified,
    safety: {
      isolatedApprovalPackageWrites:
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
      commitCallableIncluded:
        false,
      cutoverExecutionCallableIncluded:
        false,
      rollbackExecutionCallableIncluded:
        false,
      approvalCallableIncluded:
        true,
      approvalTokenIssued:
        true,
      executionPackageAssembled:
        true,
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

export const stageUidV2RebaseExplicitProductionApprovalPhase4c17r =
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
        input.confirmExplicitProductionApproval !==
          true ||
        input.confirmSealedAssemblyOnly !==
          true ||
        input.confirmNoCutoverExecution !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-17R input gate failed."
        );
      }

      const approvalPhrase =
        text(
          input.approvalPhrase
        );

      if (
        digestText(
          approvalPhrase
        ) !==
        EXPECTED_APPROVAL_PHRASE_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "The explicit production approval phrase is incorrect."
        );
      }

      const built =
        await buildStaticAssembly(
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
              built.packageRef
            );

          if (existing.exists) {
            const data =
              existing.data() || {};

            const existingChecks =
              verifyStoredPackage(
                data,
                built
              );

            if (!allTrue(existingChecks)) {
              throw new HttpsError(
                "already-exists",
                "A conflicting or invalid Phase 4C-17R package exists."
              );
            }

            duplicate =
              true;

            stored =
              data;

            return;
          }

          const approvedAtIso =
            new Date().toISOString();

          const approvalTokenDigest =
            digestValue({
              requestId:
                REQUEST_ID,
              contractDigest:
                CONTRACT_DIGEST,
              phase4c16DesignDigest:
                EXPECTED_PHASE4C16_DESIGN_DIGEST,
              approvalChallengeDigest:
                EXPECTED_PHASE4C16_APPROVAL_CHALLENGE_DIGEST,
              approverUid:
                callerUid,
              approvalPhraseDigest:
                EXPECTED_APPROVAL_PHRASE_DIGEST,
              approvedAtIso
            });

          const sealedPackage:
            GenericRecord = {
            ...built.staticPackageCore,
            approvedByFirebaseUid:
              callerUid,
            approvedAtIso,
            approvalTokenDigest,
            sealedPackageReady:
              true,
            executionPackageAllowed:
              true,
            actualCutoverAllowed:
              false
          };

          const sealedPackageDigest =
            digestValue(
              sealedPackage
            );

          stored = {
            version:
              UID_V2_REBASE_EXPLICIT_APPROVAL_PHASE4C17R_VERSION,
            phase:
              "Phase 4C-17R",
            mode:
              "rebase156_explicit_production_approval_and_sealed_execution_package_assembly_only",
            requestId:
              REQUEST_ID,
            approvedByFirebaseUid:
              callerUid,
            contractDigest:
              CONTRACT_DIGEST,
            staticPackageDigest:
              built.staticPackageDigest,
            sealedPackageDigest,
            approval: {
              state:
                "explicit_production_approval_recorded",
              approverRole:
                "superAdmin",
              approverUid:
                callerUid,
              approvedAtIso,
              approvalPhraseDigest:
                EXPECTED_APPROVAL_PHRASE_DIGEST,
              approvalPhraseStoredPlaintext:
                false,
              approvalTokenDigest,
              approvalTokenIssued:
                true
            },
            sealedPackage,
            status:
              "rebase_explicit_production_approval_and_sealed_package_staged",
            createdAtIso:
              approvedAtIso
          };

          transaction.set(
            built.packageRef,
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

export const inspectUidV2RebaseExplicitProductionApprovalPhase4c17r =
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
          "Phase 4C-17R inspect gate failed."
        );
      }

      const built =
        await buildStaticAssembly(
          callerUid
        );

      const snapshot =
        await built.packageRef.get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-17R approval package was not found."
        );
      }

      const stored =
        snapshot.data() || {};

      const checks =
        verifyStoredPackage(
          stored,
          built
        );

      const approval =
        asRecord(
          stored.approval,
          "stored.approval"
        );

      const finalChecks:
        GenericRecord = {
        status:
          text(
            stored.status
          ) ===
          "rebase_explicit_production_approval_and_sealed_package_staged",
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
        approvalState:
          text(
            approval.state
          ) ===
          "explicit_production_approval_recorded",
        approvalPackage:
          allTrue(
            checks
          )
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
          `Phase 4C-17R stored package verification failed: ${failed.join(", ")}`
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
