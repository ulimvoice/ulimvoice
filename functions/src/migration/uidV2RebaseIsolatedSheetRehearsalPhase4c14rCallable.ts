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

export const UID_V2_REBASE_ISOLATED_SHEET_REHEARSAL_PHASE4C14R_VERSION =
  "2026-07-28.716.64-phase4c14r-isolated-sheet-copy-schema-cell-rehearsal";

const REGION = "asia-northeast3";
const REQUEST_ID = "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";
const CONTRACT_DIGEST = "24cf03b8275749317f813d5f835ddcd16b0e61316a41d03a278426f5ffe2a85d";
const EXPECTED_PHASE4C13_CONTRACT_DIGEST = "837eac8a3d1afc3f69a39d038804c9383d658f3005afe0dc84d2fbe2b6176049";
const EXPECTED_PHASE4C13_PLAN_DIGEST = "cdaccca3c1187ee31ff55abb563e3a284c2a70168efac64d9f7e64b3906ed8a9";
const EXPECTED_TOTAL_PATCH_CELLS = 170;
const EXPECTED_IDENTITY_CELLS = 168;
const EXPECTED_SCHEMA_HEADER_CELLS = 2;
const EXPECTED_PRINCIPAL_AUTH_ANCHORS = 12;
const MODE = "rebase156_isolated_sheet_copy_schema_and_cell_patch_apply_restore_rehearsal";
const NEXT_GATE_PHASE = "Phase 4C-15R corrected final cutover dry-run and manifest refresh only";

type GenericRecord = Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmIsolatedCopyOnly?: unknown;
  readonly confirmSourceSheetWritesZero?: unknown;
  readonly resultEnvelope?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
}

interface ExpectedPlan {
  readonly db: Firestore;
  readonly resultRef: DocumentReference<DocumentData>;
  readonly expectedPatchResults: GenericRecord[];
  readonly patchVerificationDigest: string;
  readonly planChecks: GenericRecord;
}

function defaultAdminApp(): App {
  const existing = getApps().find(
    (app: App) => app.name === "[DEFAULT]"
  );

  return existing ? getApp() : initializeApp();
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(text).filter(Boolean)
    : [];
}

function asRecord(value: unknown, label: string): GenericRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError(
      "failed-precondition",
      `${label} must be an object.`
    );
  }

  return value as GenericRecord;
}

function asArray(value: unknown, label: string): unknown[] {
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

  const roles = strings(auth.token.roles);

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

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    const output: GenericRecord = {};

    for (const key of Object.keys(value as GenericRecord).sort()) {
      output[key] = canonicalize((value as GenericRecord)[key]);
    }

    return output;
  }

  return value;
}

function digestValue(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)), "utf8")
    .digest("hex");
}

function digestText(value: string): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function exactJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) ===
    JSON.stringify(canonicalize(right));
}

function allTrue(value: GenericRecord): boolean {
  return Object.values(value).every((item) => item === true);
}

function equalText(
  record: GenericRecord,
  leftKey: string,
  rightKey: string
): boolean {
  const left = text(record[leftKey]);
  const right = text(record[rightKey]);

  return left !== "" && left === right;
}

function expectedCounts(): GenericRecord {
  return {
    studentIdentityCells: 156,
    principalIdentityCells: 12,
    identityCells: EXPECTED_IDENTITY_CELLS,
    schemaHeaderCells: EXPECTED_SCHEMA_HEADER_CELLS,
    totalPatchCells: EXPECTED_TOTAL_PATCH_CELLS,
    principalAuthColumn9Anchors: EXPECTED_PRINCIPAL_AUTH_ANCHORS,
    isolatedApplyCellWrites: EXPECTED_TOTAL_PATCH_CELLS,
    isolatedRollbackCellWrites: EXPECTED_TOTAL_PATCH_CELLS,
    isolatedTotalCellWrites: EXPECTED_TOTAL_PATCH_CELLS * 2
  };
}

async function buildExpectedPlan(callerUid: string): Promise<ExpectedPlan> {
  const db = getFirestore(defaultAdminApp());

  const runRef = db
    .collection("uidV2StagingRuns")
    .doc(REQUEST_ID);

  const planRef = runRef
    .collection("rebaseCellPatchPlans")
    .doc("phase4c13r-schema-c1");

  const resultRef = runRef
    .collection("rebaseIsolatedSheetRehearsals")
    .doc("phase4c14r");

  const planSnapshot = await planRef.get();

  if (!planSnapshot.exists) {
    throw new HttpsError(
      "not-found",
      "Phase 4C-13R schema-corrected plan was not found."
    );
  }

  const plan = planSnapshot.data() || {};
  const counts = asRecord(plan.counts, "phase4c13r.counts");
  const simulation = asRecord(plan.simulation, "phase4c13r.simulation");
  const safety = asRecord(plan.safety, "phase4c13r.safety");
  const sourceChecks = asRecord(plan.sourceChecks, "phase4c13r.sourceChecks");
  const patches = asArray(plan.patches, "phase4c13r.patches");

  const planChecks: GenericRecord = {
    status:
      text(plan.status) ===
      "rebase_schema_corrected_cell_patch_plan_staged",
    caller:
      text(plan.approvedByFirebaseUid) === callerUid,
    contract:
      text(plan.contractDigest) ===
      EXPECTED_PHASE4C13_CONTRACT_DIGEST,
    planDigest:
      text(plan.planDigest) === EXPECTED_PHASE4C13_PLAN_DIGEST,
    counts:
      exactJson(counts, {
        studentCellPatches: 156,
        principalCellPatches: 12,
        identityCellPatches: EXPECTED_IDENTITY_CELLS,
        schemaHeaderPatches: EXPECTED_SCHEMA_HEADER_CELLS,
        totalCellPatches: EXPECTED_TOTAL_PATCH_CELLS,
        principalAuthColumn9Anchors: EXPECTED_PRINCIPAL_AUTH_ANCHORS,
        targetSheets: 2
      }),
    patchCount:
      patches.length === EXPECTED_TOTAL_PATCH_CELLS,
    applySimulation:
      simulation.applyWouldSucceed === true,
    rollbackSimulation:
      simulation.rollbackWouldSucceed === true,
    nonTarget:
      Number(simulation.nonTargetCellsTouched) === 0,
    auth9:
      simulation.principalAuthColumn9Preserved === true,
    appendColumn:
      simulation.appendColumnPreconditionVerified === true,
    sourceChecks:
      allTrue(sourceChecks),
    sourceWrites:
      Number(safety.sourceSheetWrites) === 0,
    noExecution:
      safety.executionCallableIncluded === false,
    noCutover:
      safety.actualUidCutoverAllowed === false
  };

  if (!allTrue(planChecks)) {
    const failed = Object.entries(planChecks)
      .filter(([, passed]) => passed !== true)
      .map(([key]) => key);

    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-13R plan validation failed: ${failed.join(", ")}`
    );
  }

  const expectedPatchResults = patches
    .map((item, index) => {
      const patch = asRecord(item, `phase4c13r.patches[${index}]`);
      const patchId = text(patch.patchId);
      const targetValue = text(patch.targetValue);

      if (patchId === "" || targetValue === "") {
        throw new HttpsError(
          "data-loss",
          "Phase 4C-13R patch contains a blank identifier or target value."
        );
      }

      return {
        patchId,
        targetValueDigest: digestText(targetValue),
        applied: true,
        rolledBack: true
      };
    })
    .sort((left, right) =>
      text(left.patchId).localeCompare(text(right.patchId))
    );

  const patchIds = new Set(
    expectedPatchResults.map((item) => text(item.patchId))
  );

  if (patchIds.size !== EXPECTED_TOTAL_PATCH_CELLS) {
    throw new HttpsError(
      "data-loss",
      "Phase 4C-13R patch identifiers are not unique."
    );
  }

  return {
    db,
    resultRef,
    expectedPatchResults,
    patchVerificationDigest: digestValue(expectedPatchResults),
    planChecks
  };
}

function validateRehearsal(
  envelopeValue: unknown,
  expected: ExpectedPlan
): {
  readonly rehearsal: GenericRecord;
  readonly resultDigest: string;
  readonly checks: GenericRecord;
} {
  const envelope = asRecord(envelopeValue, "resultEnvelope");
  const rehearsal = asRecord(
    envelope.rehearsal,
    "resultEnvelope.rehearsal"
  );
  const resultDigest = text(envelope.resultDigest);
  const counts = asRecord(rehearsal.counts, "rehearsal.counts");
  const verification = asRecord(
    rehearsal.verification,
    "rehearsal.verification"
  );
  const safety = asRecord(rehearsal.safety, "rehearsal.safety");
  const drive = asRecord(rehearsal.drive, "rehearsal.drive");
  const digests = asRecord(rehearsal.digests, "rehearsal.digests");

  const patchResults = asArray(
    rehearsal.patchResults,
    "rehearsal.patchResults"
  )
    .map((item, index) =>
      asRecord(item, `rehearsal.patchResults[${index}]`)
    )
    .sort((left, right) =>
      text(left.patchId).localeCompare(text(right.patchId))
    );

  const checks: GenericRecord = {
    resultDigest:
      resultDigest !== "" &&
      resultDigest === digestValue(rehearsal),
    version:
      text(rehearsal.version) ===
      UID_V2_REBASE_ISOLATED_SHEET_REHEARSAL_PHASE4C14R_VERSION,
    phase:
      text(rehearsal.phase) === "Phase 4C-14R",
    mode:
      text(rehearsal.mode) === MODE,
    requestId:
      text(rehearsal.requestId) === REQUEST_ID,
    contract:
      text(rehearsal.contractDigest) === CONTRACT_DIGEST,
    planContract:
      text(rehearsal.phase4c13ContractDigest) ===
      EXPECTED_PHASE4C13_CONTRACT_DIGEST,
    planDigest:
      text(rehearsal.phase4c13PlanDigest) ===
      EXPECTED_PHASE4C13_PLAN_DIGEST,
    counts:
      exactJson(counts, expectedCounts()),
    patchCount:
      patchResults.length === EXPECTED_TOTAL_PATCH_CELLS,
    patchResults:
      exactJson(patchResults, expected.expectedPatchResults),
    patchVerificationDigest:
      text(rehearsal.patchVerificationDigest) ===
      expected.patchVerificationDigest,
    sourceTargetUnchanged:
      equalText(digests, "sourceTargetBefore", "sourceTargetAfter"),
    sourceFileUnchanged:
      text(verification.sourceFileLastUpdatedBeforeIso) !== "" &&
      text(verification.sourceFileLastUpdatedBeforeIso) ===
      text(verification.sourceFileLastUpdatedAfterIso),
    sourceSheetUnchanged:
      verification.sourceSheetUnchanged === true,
    copyBaselineRestored:
      equalText(digests, "copyBaseline", "copyRollback"),
    copyTargetRestored:
      equalText(digests, "copyTargetBefore", "copyTargetRollback"),
    nonTargetApply:
      equalText(digests, "copyNonTargetBefore", "copyNonTargetApply"),
    nonTargetRollback:
      equalText(digests, "copyNonTargetBefore", "copyNonTargetRollback"),
    auth9Apply:
      equalText(
        digests,
        "principalAuthColumn9Before",
        "principalAuthColumn9Apply"
      ),
    auth9Rollback:
      equalText(
        digests,
        "principalAuthColumn9Before",
        "principalAuthColumn9Rollback"
      ),
    applyVerified:
      verification.applyVerified === true,
    rollbackVerified:
      verification.rollbackVerified === true,
    nonTargetUnchanged:
      verification.copyNonTargetUnchanged === true,
    rollbackExact:
      verification.copyRollbackExact === true,
    auth9Preserved:
      verification.principalAuthColumn9Preserved === true,
    appendColumn:
      verification.appendColumnPreconditionVerified === true,
    targetUnique:
      verification.targetCellsUnique === true,
    copyCreated:
      Number(drive.isolatedSpreadsheetCopiesCreated) === 1,
    copyTrashed:
      Number(drive.isolatedSpreadsheetCopiesTrashed) === 1 &&
      drive.copyTrashedVerified === true,
    copyIdHidden:
      drive.copySpreadsheetIdIncluded === false &&
      /^[0-9a-f]{64}$/.test(text(drive.copySpreadsheetIdDigest)),
    copyUrlHidden:
      drive.copySpreadsheetUrlIncluded === false,
    applyWrites:
      Number(safety.isolatedApplyCellWrites) ===
      EXPECTED_TOTAL_PATCH_CELLS,
    rollbackWrites:
      Number(safety.isolatedRollbackCellWrites) ===
      EXPECTED_TOTAL_PATCH_CELLS,
    isolatedWrites:
      Number(safety.isolatedTotalCellWrites) ===
      EXPECTED_TOTAL_PATCH_CELLS * 2,
    sourceWrites:
      Number(safety.sourceSheetWrites) === 0,
    registryWrites:
      Number(safety.activeUidRegistryWrites) === 0,
    attendanceWrites:
      Number(safety.attendanceWrites) === 0,
    assignmentWrites:
      Number(safety.assignmentWrites) === 0,
    authWrites:
      Number(safety.firebaseAuthWrites) === 0,
    noCommit:
      safety.commitCallableIncluded === false,
    noExecution:
      safety.cutoverExecutionCallableIncluded === false,
    noCutover:
      safety.actualUidCutoverAllowed === false,
    emergencyCleanup:
      verification.emergencyCleanupRequired === false
  };

  if (!allTrue(checks)) {
    const failed = Object.entries(checks)
      .filter(([, passed]) => passed !== true)
      .map(([key]) => key);

    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-14R rehearsal validation failed: ${failed.join(", ")}`
    );
  }

  return {
    rehearsal,
    resultDigest,
    checks
  };
}

function publicResult(
  stored: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified: boolean
) {
  const rehearsal = asRecord(stored.rehearsal, "stored.rehearsal");

  return {
    ok: true,
    version:
      UID_V2_REBASE_ISOLATED_SHEET_REHEARSAL_PHASE4C14R_VERSION,
    phase: "Phase 4C-14R",
    mode: MODE,
    requestId: REQUEST_ID,
    duplicate,
    writeOperations,
    status: text(stored.status),
    contractDigest: CONTRACT_DIGEST,
    phase4c13PlanDigest: EXPECTED_PHASE4C13_PLAN_DIGEST,
    resultDigest: text(stored.resultDigest),
    patchVerificationDigest: text(rehearsal.patchVerificationDigest),
    counts: rehearsal.counts,
    verification: rehearsal.verification,
    drive: rehearsal.drive,
    verified,
    digestMatches: verified,
    safety: {
      isolatedResultWrites: writeOperations,
      sourceSheetWrites: 0,
      activeUidRegistryWrites: 0,
      attendanceWrites: 0,
      assignmentWrites: 0,
      firebaseAuthWrites: 0,
      sessionChanges: 0,
      commitCallableIncluded: false,
      cutoverExecutionCallableIncluded: false,
      actualUidCutoverAllowed: false
    },
    nextGate: {
      phase: NEXT_GATE_PHASE,
      allowed: true,
      actualUidCutoverAllowed: false
    }
  };
}

export const stageUidV2RebaseIsolatedSheetRehearsalPhase4c14r =
  onCall(
    {
      region: REGION,
      timeoutSeconds: 300,
      memory: "1GiB",
      enforceAppCheck: false
    },
    async (request) => {
      const callerUid = requireSuperAdmin(
        request.auth as
          | {
              uid: string;
              token: GenericRecord;
            }
          | undefined
      );

      const input =
        request.data && typeof request.data === "object"
          ? (request.data as StageInput)
          : {};

      if (
        text(input.requestId) !== REQUEST_ID ||
        text(input.contractDigest) !== CONTRACT_DIGEST ||
        input.confirmIsolatedCopyOnly !== true ||
        input.confirmSourceSheetWritesZero !== true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-14R input gate failed."
        );
      }

      const expected = await buildExpectedPlan(callerUid);
      const validated = validateRehearsal(
        input.resultEnvelope,
        expected
      );

      let duplicate = false;
      let writeOperations = 0;
      let stored: GenericRecord = {};

      await expected.db.runTransaction(async (transaction) => {
        const existing = await transaction.get(expected.resultRef);

        if (existing.exists) {
          const data = existing.data() || {};

          if (text(data.resultDigest) !== validated.resultDigest) {
            throw new HttpsError(
              "already-exists",
              "A conflicting Phase 4C-14R rehearsal result exists."
            );
          }

          duplicate = true;
          stored = data;
          return;
        }

        stored = {
          version:
            UID_V2_REBASE_ISOLATED_SHEET_REHEARSAL_PHASE4C14R_VERSION,
          phase: "Phase 4C-14R",
          mode: MODE,
          requestId: REQUEST_ID,
          approvedByFirebaseUid: callerUid,
          contractDigest: CONTRACT_DIGEST,
          phase4c13ContractDigest:
            EXPECTED_PHASE4C13_CONTRACT_DIGEST,
          phase4c13PlanDigest: EXPECTED_PHASE4C13_PLAN_DIGEST,
          resultDigest: validated.resultDigest,
          rehearsal: validated.rehearsal,
          validationChecks: validated.checks,
          status: "rebase_isolated_sheet_copy_rehearsal_staged",
          createdAtIso: new Date().toISOString()
        };

        transaction.set(expected.resultRef, stored);
        writeOperations = 1;
      });

      return publicResult(
        stored,
        duplicate,
        writeOperations,
        false
      );
    }
  );

export const inspectUidV2RebaseIsolatedSheetRehearsalPhase4c14r =
  onCall(
    {
      region: REGION,
      timeoutSeconds: 300,
      memory: "1GiB",
      enforceAppCheck: false
    },
    async (request) => {
      const callerUid = requireSuperAdmin(
        request.auth as
          | {
              uid: string;
              token: GenericRecord;
            }
          | undefined
      );

      const input =
        request.data && typeof request.data === "object"
          ? (request.data as InspectInput)
          : {};

      if (
        text(input.requestId) !== REQUEST_ID ||
        text(input.contractDigest) !== CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-14R inspect gate failed."
        );
      }

      const expected = await buildExpectedPlan(callerUid);
      const snapshot = await expected.resultRef.get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-14R rehearsal result was not found."
        );
      }

      const stored = snapshot.data() || {};
      const validated = validateRehearsal(
        {
          resultDigest: stored.resultDigest,
          rehearsal: stored.rehearsal
        },
        expected
      );

      const storedChecks = asRecord(
        stored.validationChecks,
        "stored.validationChecks"
      );

      const checks: GenericRecord = {
        status:
          text(stored.status) ===
          "rebase_isolated_sheet_copy_rehearsal_staged",
        caller:
          text(stored.approvedByFirebaseUid) === callerUid,
        contract:
          text(stored.contractDigest) === CONTRACT_DIGEST,
        planContract:
          text(stored.phase4c13ContractDigest) ===
          EXPECTED_PHASE4C13_CONTRACT_DIGEST,
        planDigest:
          text(stored.phase4c13PlanDigest) ===
          EXPECTED_PHASE4C13_PLAN_DIGEST,
        resultDigest:
          text(stored.resultDigest) === validated.resultDigest,
        storedChecks:
          allTrue(storedChecks),
        currentPlan:
          allTrue(expected.planChecks)
      };

      if (!allTrue(checks)) {
        const failed = Object.entries(checks)
          .filter(([, passed]) => passed !== true)
          .map(([key]) => key);

        throw new HttpsError(
          "data-loss",
          `Phase 4C-14R stored result verification failed: ${failed.join(", ")}`
        );
      }

      return publicResult(stored, true, 0, true);
    }
  );
