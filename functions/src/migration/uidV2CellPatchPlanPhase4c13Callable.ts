import { createHash } from "node:crypto";
import {
  App,
  getApp,
  getApps,
  initializeApp
} from "firebase-admin/app";
import {
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_V2_CELL_PATCH_PLAN_PHASE4C13_VERSION =
  "2026-07-26.716.38-phase4c13-zero-value-regex-hotfix";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c3-20260724142743-62e47ac1-8e06-4cf7-b379-25d2373fa42d";

const EXPECTED_PHASE4C12_CONTRACT_DIGEST =
  "8414f285309989a0c0cfb46d215446f691d45195df2f8c4ce8f072b41fa5eb08";

const EXPECTED_PHASE4C12_MANIFEST_DIGEST =
  "b5c0dc81d7b303ba58f79dad00d52ee883c3db56e0c1db99f56a9ccf46738883";

const EXPECTED_PHASE4C11B_DRY_RUN_DIGEST =
  "4c9cb369d6d427a3c3ffbf584e870a159dca3892d5a3b5a526981b20bd8b608e";

const EXPECTED_STABLE_SHEET_DIGEST =
  "0ee1961457a16812cf6cf98ba31016be8eaa404d876978b0b4c9cf4b1e3f48e0";

const EXPECTED_PLAN_DIGEST =
  "29c92ee66cb02603bb00770f32e290e30503cde7499a55d552688df92c3c0445";

const EXPECTED_CONTRACT_DIGEST =
  "91ee9e92eec9d4c49b52d3023abecb07749983d9eb313f2b57d246718dedf2d4";

const EXPECTED_PLAN_BYTES =
  74951;

type GenericRecord =
  Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmPlanOnly?: unknown;
  readonly confirmNoSheetWrites?: unknown;
  readonly envelope?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
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

function hasSensitiveKey(
  value: unknown
): boolean {
  if (Array.isArray(value)) {
    return value.some(
      hasSensitiveKey
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    for (
      const [
        key,
        nested
      ] of Object.entries(
        value as GenericRecord
      )
    ) {
      const normalized =
        key.toLowerCase();

      if (
        [
          "name",
          "fullname",
          "phone",
          "phonenumber",
          "password",
          "passwordhash",
          "salt",
          "loginid",
          "rawvalues",
          "displayvalues"
        ].includes(normalized)
      ) {
        return true;
      }

      if (hasSensitiveKey(nested)) {
        return true;
      }
    }
  }

  return false;
}

function validatePlan(
  envelopeValue: unknown
) {
  const envelope =
    asRecord(
      envelopeValue,
      "envelope"
    );

  const plan =
    asRecord(
      envelope.plan,
      "envelope.plan"
    );

  const canonicalPlan =
    canonicalize(plan);

  const planJson =
    JSON.stringify(
      canonicalPlan
    );

  const calculatedDigest =
    sha256(planJson);

  const planBytes =
    Buffer.byteLength(
      planJson,
      "utf8"
    );

  const patches =
    Array.isArray(plan.patches)
      ? plan.patches.map(
          (
            patch,
            index
          ) =>
            asRecord(
              patch,
              `patches[${index}]`
            )
        )
      : [];

  const counts =
    asRecord(
      plan.counts,
      "plan.counts"
    );

  const simulation =
    asRecord(
      plan.simulation,
      "plan.simulation"
    );

  const safety =
    asRecord(
      plan.safety,
      "plan.safety"
    );

  const targetColumns =
    asRecord(
      plan.targetColumns,
      "plan.targetColumns"
    );

  const studentTarget =
    asRecord(
      targetColumns.studentMaster,
      "targetColumns.studentMaster"
    );

  const principalTarget =
    asRecord(
      targetColumns.principalMaster,
      "targetColumns.principalMaster"
    );

  const cells =
    new Set<string>();

  const uids =
    new Set<string>();

  let studentRows =
    0;

  let principalRows =
    0;

  let headerRows =
    0;

  for (
    const patch of
    patches
  ) {
    const sheetId =
      Number(patch.sheetId);

    const rowNumber =
      Number(patch.rowNumber);

    const columnNumber =
      Number(patch.columnNumber);

    const cellKey =
      `${sheetId}|${rowNumber}|${columnNumber}`;

    if (cells.has(cellKey)) {
      throw new HttpsError(
        "failed-precondition",
        `Duplicate Sheet target cell: ${cellKey}`
      );
    }

    cells.add(cellKey);

    if (
      text(patch.expectedBefore) !==
        "" ||
      text(patch.rollbackValue) !==
        "" ||
      text(patch.operation) !==
        "set_value_if_blank" ||
      patch.preserveOtherCells !==
        true
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Invalid patch precondition: ${cellKey}`
      );
    }

    if (
      text(patch.patchType) ===
      "schema_header"
    ) {
      headerRows++;

      const validHeader =
        (
          sheetId === 0 &&
          rowNumber === 1 &&
          columnNumber === 14 &&
          text(patch.a1) === "N1" &&
          text(patch.targetValue) ===
            "학생UIDv2"
        ) ||
        (
          sheetId === 441317341 &&
          rowNumber === 1 &&
          columnNumber === 8 &&
          text(patch.a1) === "H1" &&
          text(patch.targetValue) ===
            "PrincipalUIDv2"
        );

      if (!validHeader) {
        throw new HttpsError(
          "failed-precondition",
          `Invalid schema header patch: ${cellKey}`
        );
      }

      continue;
    }

    if (
      text(patch.patchType) !==
      "identity_uid_cell"
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Unknown patch type: ${cellKey}`
      );
    }

    const entityType =
      text(patch.entityType);

    const newUid =
      text(patch.newUid);

    if (
      text(patch.targetValue) !==
      newUid
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Target UID mismatch: ${cellKey}`
      );
    }

    if (uids.has(newUid)) {
      throw new HttpsError(
        "failed-precondition",
        `Duplicate UID target: ${newUid}`
      );
    }

    uids.add(newUid);

    if (
      entityType === "student"
    ) {
      if (
        sheetId !== 0 ||
        text(patch.sheetName) !==
          "학생명단" ||
        columnNumber !== 14 ||
        text(patch.a1) !==
          `N${rowNumber}` ||
        !/^STU2_[0-9A-HJKMNP-TV-Z]{26}$/.test(
          newUid
        ) ||
        !/^SID_[0-9a-f]{24}$/.test(
          text(patch.identityRef)
        )
      ) {
        throw new HttpsError(
          "failed-precondition",
          `Invalid student patch: ${cellKey}`
        );
      }

      studentRows++;
    } else if (
      entityType === "principal"
    ) {
      if (
        sheetId !== 441317341 ||
        text(patch.sheetName) !==
          "관리자" ||
        columnNumber !== 8 ||
        text(patch.a1) !==
          `H${rowNumber}` ||
        !/^PRN2_[0-9A-HJKMNP-TV-Z]{26}$/.test(
          newUid
        ) ||
        !/^PID_[0-9a-f]{24}$/.test(
          text(patch.identityRef)
        )
      ) {
        throw new HttpsError(
          "failed-precondition",
          `Invalid principal patch: ${cellKey}`
        );
      }

      principalRows++;
    } else {
      throw new HttpsError(
        "failed-precondition",
        `Invalid entity type: ${cellKey}`
      );
    }
  }

  const checks: GenericRecord = {
    envelopeDigest:
      text(envelope.planDigest) ===
      calculatedDigest,
    expectedDigest:
      calculatedDigest ===
      EXPECTED_PLAN_DIGEST,
    requestId:
      text(plan.requestId) ===
      REQUEST_ID,
    phase4c12Contract:
      text(
        plan.phase4c12ContractDigest
      ) ===
      EXPECTED_PHASE4C12_CONTRACT_DIGEST,
    phase4c12Manifest:
      text(
        plan.phase4c12ManifestDigest
      ) ===
      EXPECTED_PHASE4C12_MANIFEST_DIGEST,
    phase4c11bDryRun:
      text(
        plan.phase4c11bDryRunResultDigest
      ) ===
      EXPECTED_PHASE4C11B_DRY_RUN_DIGEST,
    stableSheet:
      text(
        plan.stableSheetSnapshotDigest
      ) ===
      EXPECTED_STABLE_SHEET_DIGEST,
    planBytes:
      planBytes ===
      EXPECTED_PLAN_BYTES &&
      planBytes < 850000,
    studentTarget:
      exactJson(
        studentTarget,
        {
          sheetName:
            "학생명단",
          sheetId:
            0,
          columnNumber:
            14,
          columnLetter:
            "N",
          header:
            "학생UIDv2"
        }
      ),
    principalTarget:
      exactJson(
        principalTarget,
        {
          sheetName:
            "관리자",
          sheetId:
            441317341,
          columnNumber:
            8,
          columnLetter:
            "H",
          header:
            "PrincipalUIDv2"
        }
      ),
    studentRows:
      studentRows === 155,
    principalRows:
      principalRows === 12,
    identityRows:
      studentRows +
      principalRows ===
      167,
    headers:
      headerRows === 2,
    totalCells:
      patches.length === 169 &&
      cells.size === 169,
    declaredCounts:
      exactJson(
        counts,
        {
          studentRowPatches:
            155,
          principalRowPatches:
            12,
          identityRowPatches:
            167,
          schemaHeaderPatches:
            2,
          totalCellPatches:
            169,
          targetSheets:
            2
        }
      ),
    applySimulation:
      simulation.applyWouldSucceed ===
      true,
    rollbackSimulation:
      simulation.rollbackWouldSucceed ===
      true,
    uniqueCells:
      simulation.targetCellsUnique ===
      true,
    blankBefore:
      simulation.allExpectedBeforeBlank ===
      true,
    noNonTargetCells:
      Number(simulation.nonTargetCellsTouched) === 0,
    noFullRowOverwrite:
      simulation.fullRowOverwrite ===
      false,
    preservesPrincipalAuth9:
      simulation
        .principalAuthColumn9Preserved ===
      true,
    safety:
      safety.sourceSheetWrites === 0 &&
      safety.firestoreWrites === 0 &&
      safety.firebaseAuthWrites === 0 &&
      safety.fullRowOverwriteForbidden ===
        true &&
      safety
        .principalAuthColumn9PreserveRequired ===
        true &&
      safety.executionCallableIncluded ===
        false &&
      safety.actualUidCutoverAllowed ===
        false,
    noSensitiveKeys:
      !hasSensitiveKey(plan)
  };

  return {
    envelope,
    plan,
    planJson,
    calculatedDigest,
    planBytes,
    checks
  };
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

function publicResult(
  data: GenericRecord,
  duplicate: boolean,
  writeOperations: number
) {
  return {
    ok:
      true,
    version:
      UID_V2_CELL_PATCH_PLAN_PHASE4C13_VERSION,
    mode:
      "cell_level_sheet_patch_plan_and_rollback_simulation",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    status:
      text(data.status),
    contractDigest:
      text(data.contractDigest),
    planDigest:
      text(data.planDigest),
    planBytes:
      Number(data.planBytes || 0),
    counts:
      data.counts,
    targetColumns:
      data.targetColumns,
    simulation:
      data.simulation,
    safety: {
      isolatedPlanWrites:
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
      executionCallableIncluded:
        false,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        "Phase 4C-14 cell-patch rehearsal against an isolated Sheet copy",
      allowed:
        true,
      actualUidCutoverAllowed:
        false
    }
  };
}

export const stageUidV2CellPatchPlanPhase4c13 =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        300,
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
              StageInput
          : {};

      if (
        text(input.requestId) !==
          REQUEST_ID ||
        text(input.contractDigest) !==
          EXPECTED_CONTRACT_DIGEST ||
        input.confirmPlanOnly !== true ||
        input.confirmNoSheetWrites !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-13 input gate failed."
        );
      }

      const validated =
        validatePlan(
          input.envelope
        );

      if (!allTrue(validated.checks)) {
        const failedChecks =
          Object.entries(
            validated.checks
          )
            .filter(
              (
                [
                  ,
                  passed
                ]
              ) =>
                passed !== true
            )
            .map(
              (
                [
                  key
                ]
              ) =>
                key
            );

        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-13 plan validation failed: ${failedChecks.join(", ")}`,
          {
            failedChecks
          }
        );
      }

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

      const manifestSnapshot =
        await runRef
          .collection(
            "cutoverExecutionManifests"
          )
          .doc(
            "phase4c12"
          )
          .get();

      if (!manifestSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-12 execution design manifest is missing."
        );
      }

      const manifest =
        manifestSnapshot.data() || {};

      const manifestChecks = {
        status:
          text(manifest.status) ===
          "execution_design_manifest_staged",
        contract:
          text(
            manifest.contractDigest
          ) ===
          EXPECTED_PHASE4C12_CONTRACT_DIGEST,
        digest:
          text(
            manifest.manifestDigest
          ) ===
          EXPECTED_PHASE4C12_MANIFEST_DIGEST,
        dryRun:
          text(
            manifest.dryRunResultDigest
          ) ===
          EXPECTED_PHASE4C11B_DRY_RUN_DIGEST,
        stableSheet:
          text(
            manifest.stableSheetDigest
          ) ===
          EXPECTED_STABLE_SHEET_DIGEST,
        noExecution:
          (
            manifest.safety as
              GenericRecord
          )?.executionCallableIncluded ===
          false,
        noCutover:
          (
            manifest.safety as
              GenericRecord
          )?.actualUidCutoverAllowed ===
          false
      };

      if (
        !Object.values(
          manifestChecks
        ).every(
          (item) =>
            item === true
        )
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-12 manifest validation failed."
        );
      }

      const targetRef =
        runRef
          .collection(
            "cellPatchPlans"
          )
          .doc(
            "phase4c13"
          );

      const storedCore = {
        version:
          UID_V2_CELL_PATCH_PLAN_PHASE4C13_VERSION,
        phase:
          "Phase 4C-13",
        mode:
          "cell_level_sheet_patch_plan_and_rollback_simulation",
        requestId:
          REQUEST_ID,
        approvedByFirebaseUid:
          callerUid,
        contractDigest:
          EXPECTED_CONTRACT_DIGEST,
        planDigest:
          validated.calculatedDigest,
        planBytes:
          validated.planBytes,
        counts:
          validated.plan.counts,
        targetColumns:
          validated.plan.targetColumns,
        simulation:
          validated.plan.simulation,
        patches:
          validated.plan.patches,
        safety:
          validated.plan.safety
      };

      const storedDigest =
        sha256(
          JSON.stringify(
            canonicalize(
              storedCore
            )
          )
        );

      let duplicate =
        false;

      let writeOperations =
        0;

      let output:
        GenericRecord = {};

      await db.runTransaction(
        async (transaction) => {
          const existing =
            await transaction.get(
              targetRef
            );

          if (existing.exists) {
            const data =
              existing.data() || {};

            if (
              text(data.planDigest) !==
                validated.calculatedDigest ||
              text(data.contractDigest) !==
                EXPECTED_CONTRACT_DIGEST ||
              text(data.storedDigest) !==
                storedDigest
            ) {
              throw new HttpsError(
                "already-exists",
                "A conflicting Phase 4C-13 plan exists."
              );
            }

            duplicate = true;
            output = data;
            return;
          }

          output = {
            ...storedCore,
            storedDigest,
            status:
              "cell_patch_plan_staged",
            createdAtIso:
              new Date().toISOString()
          };

          transaction.set(
            targetRef,
            output
          );

          writeOperations = 1;
        }
      );

      return publicResult(
        output,
        duplicate,
        writeOperations
      );
    }
  );

export const inspectUidV2CellPatchPlanPhase4c13 =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        120,
      memory:
        "256MiB",
      enforceAppCheck:
        false
    },
    async (request) => {
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
          EXPECTED_CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-13 inspect gate failed."
        );
      }

      const snapshot =
        await getFirestore(
          defaultAdminApp()
        )
          .collection(
            "uidV2StagingRuns"
          )
          .doc(
            REQUEST_ID
          )
          .collection(
            "cellPatchPlans"
          )
          .doc(
            "phase4c13"
          )
          .get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-13 plan was not found."
        );
      }

      const data =
        snapshot.data() || {};

      const storedCore = {
        version:
          data.version,
        phase:
          data.phase,
        mode:
          data.mode,
        requestId:
          data.requestId,
        approvedByFirebaseUid:
          data.approvedByFirebaseUid,
        contractDigest:
          data.contractDigest,
        planDigest:
          data.planDigest,
        planBytes:
          data.planBytes,
        counts:
          data.counts,
        targetColumns:
          data.targetColumns,
        simulation:
          data.simulation,
        patches:
          data.patches,
        safety:
          data.safety
      };

      const recalculatedStoredDigest =
        sha256(
          JSON.stringify(
            canonicalize(
              storedCore
            )
          )
        );

      if (
        text(data.contractDigest) !==
          EXPECTED_CONTRACT_DIGEST ||
        text(data.planDigest) !==
          EXPECTED_PLAN_DIGEST ||
        text(data.storedDigest) !==
          recalculatedStoredDigest
      ) {
        throw new HttpsError(
          "data-loss",
          "Phase 4C-13 stored plan verification failed."
        );
      }

      return {
        ...publicResult(
          data,
          true,
          0
        ),
        verified:
          true,
        digestMatches:
          true
      };
    }
  );

