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

export const UID_V2_REBASE_CORRECTED_FINAL_DRY_RUN_PHASE4C15R_VERSION =
  "2026-07-28.716.66-phase4c15r-corrected-final-cutover-dry-run-manifest-refresh-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "1d229a87b3497a3c907ef1541ccaab4c2ca0fadd47c39e105aa6dd3147ba1307";

const EXPECTED_PHASE4C13_CONTRACT_DIGEST =
  "837eac8a3d1afc3f69a39d038804c9383d658f3005afe0dc84d2fbe2b6176049";

const EXPECTED_PHASE4C13_PLAN_DIGEST =
  "cdaccca3c1187ee31ff55abb563e3a284c2a70168efac64d9f7e64b3906ed8a9";

const EXPECTED_PHASE4C14_CONTRACT_DIGEST =
  "24cf03b8275749317f813d5f835ddcd16b0e61316a41d03a278426f5ffe2a85d";

const EXPECTED_PHASE4C14_RESULT_DIGEST =
  "a2130c57103adfd8410f3139779effd0ad9b49dbec7ee852539f398aea15e0e2";

const EXPECTED_PHASE4C14_PATCH_DIGEST =
  "55963d5004dccbc1e5f61de688a7566cd26b9721910aa438bd92c11dba2e8ac0";

const NEXT_GATE_PHASE =
  "Phase 4C-16R production cutover execution package design and final approval gate only";

type GenericRecord =
  Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmDryRunOnly?: unknown;
  readonly confirmManifestRefreshOnly?: unknown;
  readonly confirmNoOperationalWrites?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
}

interface BuiltManifest {
  readonly db: Firestore;
  readonly manifestRef:
    DocumentReference<DocumentData>;
  readonly manifestCore:
    GenericRecord;
  readonly manifestDigest:
    string;
  readonly dryRunDigest:
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

function operationOrder():
  GenericRecord[] {
  return [
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
  ];
}

function safetyContract():
  GenericRecord {
  return {
    dryRunOnly:
      true,
    manifestRefreshOnly:
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
    commitCallableIncluded:
      false,
    cutoverExecutionCallableIncluded:
      false,
    actualUidCutoverAllowed:
      false
  };
}

async function buildCorrectedManifest(
  callerUid: string
): Promise<BuiltManifest> {
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

  const planRef =
    runRef
      .collection(
        "rebaseCellPatchPlans"
      )
      .doc(
        "phase4c13r-schema-c1"
      );

  const rehearsalRef =
    runRef
      .collection(
        "rebaseIsolatedSheetRehearsals"
      )
      .doc(
        "phase4c14r"
      );

  const manifestRef =
    runRef
      .collection(
        "rebaseCorrectedFinalCutoverManifests"
      )
      .doc(
        "phase4c15r"
      );

  const [
    planSnapshot,
    rehearsalSnapshot
  ] = await Promise.all([
    planRef.get(),
    rehearsalRef.get()
  ]);

  if (
    !planSnapshot.exists ||
    !rehearsalSnapshot.exists
  ) {
    throw new HttpsError(
      "not-found",
      "Phase 4C-13R plan or Phase 4C-14R rehearsal result is missing."
    );
  }

  const plan =
    planSnapshot.data() || {};

  const rehearsalStored =
    rehearsalSnapshot.data() || {};

  const planCounts =
    asRecord(
      plan.counts,
      "phase4c13.counts"
    );

  const planSimulation =
    asRecord(
      plan.simulation,
      "phase4c13.simulation"
    );

  const planSafety =
    asRecord(
      plan.safety,
      "phase4c13.safety"
    );

  const planSourceChecks =
    asRecord(
      plan.sourceChecks,
      "phase4c13.sourceChecks"
    );

  const planPatches =
    asArray(
      plan.patches,
      "phase4c13.patches"
    );

  const rehearsal =
    asRecord(
      rehearsalStored.rehearsal,
      "phase4c14.rehearsal"
    );

  const rehearsalCounts =
    asRecord(
      rehearsal.counts,
      "phase4c14.rehearsal.counts"
    );

  const rehearsalVerification =
    asRecord(
      rehearsal.verification,
      "phase4c14.rehearsal.verification"
    );

  const rehearsalDrive =
    asRecord(
      rehearsal.drive,
      "phase4c14.rehearsal.drive"
    );

  const rehearsalSafety =
    asRecord(
      rehearsal.safety,
      "phase4c14.rehearsal.safety"
    );

  const rehearsalValidationChecks =
    asRecord(
      rehearsalStored.validationChecks,
      "phase4c14.validationChecks"
    );

  const rehearsalPatchResults =
    asArray(
      rehearsal.patchResults,
      "phase4c14.rehearsal.patchResults"
    );

  const chainChecks:
    GenericRecord = {
    phase4c13Status:
      text(plan.status) ===
      "rebase_schema_corrected_cell_patch_plan_staged",
    phase4c13Caller:
      text(
        plan.approvedByFirebaseUid
      ) ===
      callerUid,
    phase4c13Contract:
      text(
        plan.contractDigest
      ) ===
      EXPECTED_PHASE4C13_CONTRACT_DIGEST,
    phase4c13PlanDigest:
      text(
        plan.planDigest
      ) ===
      EXPECTED_PHASE4C13_PLAN_DIGEST,
    phase4c13Counts:
      exactJson(
        planCounts,
        {
          studentCellPatches:
            156,
          principalCellPatches:
            12,
          identityCellPatches:
            168,
          schemaHeaderPatches:
            2,
          totalCellPatches:
            170,
          principalAuthColumn9Anchors:
            12,
          targetSheets:
            2
        }
      ),
    phase4c13PatchCount:
      planPatches.length ===
      170,
    phase4c13ApplySimulation:
      planSimulation.applyWouldSucceed ===
      true,
    phase4c13RollbackSimulation:
      planSimulation.rollbackWouldSucceed ===
      true,
    phase4c13RollbackCells:
      Number(
        planSimulation.postRollbackCellsRestored
      ) ===
      170,
    phase4c13NonTarget:
      Number(
        planSimulation.nonTargetCellsTouched
      ) ===
      0,
    phase4c13Auth9:
      planSimulation.principalAuthColumn9Preserved ===
      true,
    phase4c13AppendColumn:
      planSimulation.appendColumnPreconditionVerified ===
      true,
    phase4c13SourceChecks:
      allTrue(
        planSourceChecks
      ),
    phase4c13SourceWrites:
      Number(
        planSafety.sourceSheetWrites
      ) ===
      0,
    phase4c13NoExecution:
      planSafety.executionCallableIncluded ===
      false,
    phase4c13NoCutover:
      planSafety.actualUidCutoverAllowed ===
      false,

    phase4c14Status:
      text(
        rehearsalStored.status
      ) ===
      "rebase_isolated_sheet_copy_rehearsal_staged",
    phase4c14Caller:
      text(
        rehearsalStored.approvedByFirebaseUid
      ) ===
      callerUid,
    phase4c14Contract:
      text(
        rehearsalStored.contractDigest
      ) ===
      EXPECTED_PHASE4C14_CONTRACT_DIGEST,
    phase4c14PlanBinding:
      text(
        rehearsalStored.phase4c13PlanDigest
      ) ===
      EXPECTED_PHASE4C13_PLAN_DIGEST,
    phase4c14ResultDigest:
      text(
        rehearsalStored.resultDigest
      ) ===
      EXPECTED_PHASE4C14_RESULT_DIGEST,
    phase4c14StoredDigest:
      digestValue(
        rehearsal
      ) ===
      EXPECTED_PHASE4C14_RESULT_DIGEST,
    phase4c14PatchDigest:
      text(
        rehearsal.patchVerificationDigest
      ) ===
      EXPECTED_PHASE4C14_PATCH_DIGEST,
    phase4c14Counts:
      exactJson(
        rehearsalCounts,
        {
          studentIdentityCells:
            156,
          principalIdentityCells:
            12,
          identityCells:
            168,
          schemaHeaderCells:
            2,
          totalPatchCells:
            170,
          principalAuthColumn9Anchors:
            12,
          isolatedApplyCellWrites:
            170,
          isolatedRollbackCellWrites:
            170,
          isolatedTotalCellWrites:
            340
        }
      ),
    phase4c14PatchResultCount:
      rehearsalPatchResults.length ===
      170,
    phase4c14ValidationChecks:
      allTrue(
        rehearsalValidationChecks
      ),
    phase4c14ApplyVerified:
      rehearsalVerification.applyVerified ===
      true,
    phase4c14RollbackVerified:
      rehearsalVerification.rollbackVerified ===
      true,
    phase4c14SourceUnchanged:
      rehearsalVerification.sourceSheetUnchanged ===
      true,
    phase4c14RollbackExact:
      rehearsalVerification.copyRollbackExact ===
      true,
    phase4c14NonTarget:
      rehearsalVerification.copyNonTargetUnchanged ===
      true,
    phase4c14Auth9:
      rehearsalVerification.principalAuthColumn9Preserved ===
      true,
    phase4c14AppendColumn:
      rehearsalVerification.appendColumnPreconditionVerified ===
      true,
    phase4c14CopyTrashed:
      rehearsalDrive.copyTrashedVerified ===
      true &&
      Number(
        rehearsalDrive.isolatedSpreadsheetCopiesCreated
      ) ===
      1 &&
      Number(
        rehearsalDrive.isolatedSpreadsheetCopiesTrashed
      ) ===
      1,
    phase4c14SourceWrites:
      Number(
        rehearsalSafety.sourceSheetWrites
      ) ===
      0,
    phase4c14AuthWrites:
      Number(
        rehearsalSafety.firebaseAuthWrites
      ) ===
      0,
    phase4c14NoExecution:
      rehearsalSafety.cutoverExecutionCallableIncluded ===
      false,
    phase4c14NoCutover:
      rehearsalSafety.actualUidCutoverAllowed ===
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
      `Phase 4C-15R prior-chain validation failed: ${blockingReasons.join(", ")}`
    );
  }

  const projectedTotals =
    correctedTotals();

  const operations =
    operationOrder();

  const safety =
    safetyContract();

  const manifestCore:
    GenericRecord = {
    version:
      UID_V2_REBASE_CORRECTED_FINAL_DRY_RUN_PHASE4C15R_VERSION,
    phase:
      "Phase 4C-15R",
    mode:
      "rebase156_corrected_final_cutover_dry_run_and_manifest_refresh_only",
    requestId:
      REQUEST_ID,
    approvedByFirebaseUid:
      callerUid,
    contractDigest:
      CONTRACT_DIGEST,
    priorEvidence: {
      phase4c13ContractDigest:
        EXPECTED_PHASE4C13_CONTRACT_DIGEST,
      phase4c13PlanDigest:
        EXPECTED_PHASE4C13_PLAN_DIGEST,
      phase4c14ContractDigest:
        EXPECTED_PHASE4C14_CONTRACT_DIGEST,
      phase4c14ResultDigest:
        EXPECTED_PHASE4C14_RESULT_DIGEST,
      phase4c14PatchVerificationDigest:
        EXPECTED_PHASE4C14_PATCH_DIGEST
    },
    projectionCorrection: {
      reason:
        "PHASE4C12R_OMITTED_TWO_SCHEMA_HEADER_PATCHES",
      supersededProjectedTotals: {
        sheetMutations:
          168,
        firestoreWrites:
          350,
        firebaseAuthWrites:
          1,
        logicalMutations:
          519
      },
      correctedProjectedTotals:
        projectedTotals,
      delta: {
        schemaHeaderPatches:
          2,
        sheetMutations:
          2,
        logicalMutations:
          2
      }
    },
    sheetPlan: {
      studentIdentityCells:
        156,
      principalIdentityCells:
        12,
      identityCells:
        168,
      schemaHeaderCells:
        2,
      totalSheetCells:
        170,
      principalAuthColumn9Anchors:
        12,
      targetSheets:
        2
    },
    correctedProjectedTotals:
      projectedTotals,
    operationOrder:
      operations,
    chainChecks,
    blockingReasons,
    finalDryRunReady:
      blockingReasons.length ===
      0,
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

  const manifestDigest =
    digestValue(
      manifestCore
    );

  const dryRunDigest =
    digestValue({
      requestId:
        REQUEST_ID,
      contractDigest:
        CONTRACT_DIGEST,
      phase4c13PlanDigest:
        EXPECTED_PHASE4C13_PLAN_DIGEST,
      phase4c14ResultDigest:
        EXPECTED_PHASE4C14_RESULT_DIGEST,
      manifestDigest,
      correctedProjectedTotals:
        projectedTotals,
      operationOrder:
        operations,
      safety
    });

  return {
    db,
    manifestRef,
    manifestCore,
    manifestDigest,
    dryRunDigest,
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
  const manifest =
    asRecord(
      stored.manifest,
      "stored.manifest"
    );

  return {
    ok:
      true,
    version:
      UID_V2_REBASE_CORRECTED_FINAL_DRY_RUN_PHASE4C15R_VERSION,
    phase:
      "Phase 4C-15R",
    mode:
      "rebase156_corrected_final_cutover_dry_run_and_manifest_refresh_only",
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
    manifestDigest:
      text(
        stored.manifestDigest
      ),
    dryRunDigest:
      text(
        stored.dryRunDigest
      ),
    priorEvidence:
      manifest.priorEvidence,
    projectionCorrection:
      manifest.projectionCorrection,
    sheetPlan:
      manifest.sheetPlan,
    correctedProjectedTotals:
      manifest.correctedProjectedTotals,
    operationOrder:
      manifest.operationOrder,
    chainChecks:
      manifest.chainChecks,
    blockingReasons:
      manifest.blockingReasons,
    finalDryRunReady:
      manifest.finalDryRunReady,
    verified,
    digestMatches:
      verified,
    safety: {
      isolatedManifestWrites:
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
      commitCallableIncluded:
        false,
      cutoverExecutionCallableIncluded:
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

export const stageUidV2RebaseCorrectedFinalCutoverDryRunPhase4c15r =
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
        input.confirmDryRunOnly !==
          true ||
        input.confirmManifestRefreshOnly !==
          true ||
        input.confirmNoOperationalWrites !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-15R input gate failed."
        );
      }

      const built =
        await buildCorrectedManifest(
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
              built.manifestRef
            );

          if (existing.exists) {
            const data =
              existing.data() || {};

            if (
              text(
                data.manifestDigest
              ) !==
                built.manifestDigest ||
              text(
                data.dryRunDigest
              ) !==
                built.dryRunDigest
            ) {
              throw new HttpsError(
                "already-exists",
                "A conflicting Phase 4C-15R corrected manifest exists."
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
              UID_V2_REBASE_CORRECTED_FINAL_DRY_RUN_PHASE4C15R_VERSION,
            phase:
              "Phase 4C-15R",
            mode:
              "rebase156_corrected_final_cutover_dry_run_and_manifest_refresh_only",
            requestId:
              REQUEST_ID,
            approvedByFirebaseUid:
              callerUid,
            contractDigest:
              CONTRACT_DIGEST,
            manifestDigest:
              built.manifestDigest,
            dryRunDigest:
              built.dryRunDigest,
            manifest:
              built.manifestCore,
            status:
              "rebase_corrected_final_cutover_dry_run_manifest_staged",
            createdAtIso:
              new Date().toISOString()
          };

          transaction.set(
            built.manifestRef,
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

export const inspectUidV2RebaseCorrectedFinalCutoverDryRunPhase4c15r =
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
          "Phase 4C-15R inspect gate failed."
        );
      }

      const built =
        await buildCorrectedManifest(
          callerUid
        );

      const snapshot =
        await built.manifestRef.get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-15R corrected manifest was not found."
        );
      }

      const stored =
        snapshot.data() || {};

      const storedManifest =
        asRecord(
          stored.manifest,
          "stored.manifest"
        );

      const storedChainChecks =
        asRecord(
          storedManifest.chainChecks,
          "stored.manifest.chainChecks"
        );

      const storedBlockingReasons =
        asArray(
          storedManifest.blockingReasons,
          "stored.manifest.blockingReasons"
        );

      const checks:
        GenericRecord = {
        status:
          text(
            stored.status
          ) ===
          "rebase_corrected_final_cutover_dry_run_manifest_staged",
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
        manifestDigest:
          text(
            stored.manifestDigest
          ) ===
          built.manifestDigest,
        storedManifestDigest:
          digestValue(
            storedManifest
          ) ===
          built.manifestDigest,
        dryRunDigest:
          text(
            stored.dryRunDigest
          ) ===
          built.dryRunDigest,
        currentManifest:
          exactJson(
            storedManifest,
            built.manifestCore
          ),
        chainChecks:
          allTrue(
            storedChainChecks
          ),
        blockingReasons:
          storedBlockingReasons.length ===
          0,
        ready:
          storedManifest.finalDryRunReady ===
          true,
        safety:
          asRecord(
            storedManifest.safety,
            "stored.manifest.safety"
          ).actualUidCutoverAllowed ===
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
          `Phase 4C-15R stored manifest verification failed: ${failed.join(", ")}`
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
