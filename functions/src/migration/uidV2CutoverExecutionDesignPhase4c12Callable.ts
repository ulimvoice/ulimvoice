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

export const UID_V2_CUTOVER_EXECUTION_DESIGN_PHASE4C12_VERSION =
  "2026-07-26.716.35-phase4c12-cutover-execution-design-manifest-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c3-20260724142743-62e47ac1-8e06-4cf7-b379-25d2373fa42d";

const EXPECTED_DRY_RUN_RESULT_DIGEST =
  "4c9cb369d6d427a3c3ffbf584e870a159dca3892d5a3b5a526981b20bd8b608e";

const EXPECTED_DRY_RUN_CONTRACT_DIGEST =
  "923674970eb01b85fdf466dc0d343cbd3b23b97071a951816200a63aa49aadf4";

const EXPECTED_STABLE_SHEET_DIGEST =
  "0ee1961457a16812cf6cf98ba31016be8eaa404d876978b0b4c9cf4b1e3f48e0";

const EXPECTED_RAW_SHEET_DIGEST =
  "c4a159c64a0e502541f3ef596102712992c05f6eb88c9325b90368090b6633d6";

const EXPECTED_APPROVAL_GENERATION =
  2;

const EXPECTED_CONTRACT_DIGEST =
  "8414f285309989a0c0cfb46d215446f691d45195df2f8c4ce8f072b41fa5eb08";

const EXPECTED_FANOUT = Object.freeze(
  {"fanoutStudents":155,"fanoutPrincipals":12,"fanoutStudentAliases":85,"fanoutPrincipalAliases":13,"fanoutAssignmentMappings":14,"fanoutAttendanceMappings":1,"fanoutFirebaseAuthTransitions":1,"fanoutExclusions":1}
);

const EXPECTED_ROLLBACK = Object.freeze(
  {"rollbackStudentRows":155,"rollbackPrincipalRows":12,"rollbackAttendanceDocuments":69,"rollbackAssignmentDocuments":14,"rollbackFirebaseAuthUsers":1,"inPlaceAttendancePlans":68}
);

const PROJECTED_MUTATIONS = Object.freeze(
  {"studentSheetRowMutations":155,"principalSheetRowMutations":12,"studentRegistryDocuments":155,"principalRegistryDocuments":12,"studentAliasDocuments":85,"principalAliasDocuments":13,"assignmentCloneDocuments":14,"attendanceInPlaceDocuments":68,"attendanceCloneDocuments":1,"firebaseAuthUsers":1,"cutoverMetadataDocuments":1}
);

const PROJECTED_TOTALS = Object.freeze(
  {"sheetMutations":167,"firestoreWrites":349,"firebaseAuthWrites":1,"logicalMutations":517}
);

const EXECUTION_ORDER = Object.freeze(
  [{"step":1,"name":"fresh_preflight","system":"read_only","required":["superAdmin","fresh 10-minute approval","fresh stable Sheet attestation","live Firestore/Auth drift audit","rollback coverage complete"]},{"step":2,"name":"sheet_cell_level_uid_patches","system":"Google Sheets","projectedMutations":167,"rules":["Sheet first","patch only UID target cells","full-row overwrite forbidden","관리자인증 9열 보존","each affected row reread immediately after patch","abort before Firestore/Auth on any mismatch"]},{"step":3,"name":"sheet_post_verify","system":"Google Sheets","required":["stable normalized Sheet digest matches","student count 155","principal count 12","관리자인증 9열 unchanged"]},{"step":4,"name":"firestore_cutover_batch","system":"Firestore","projectedWrites":349,"rules":["single batch remains under 500-write limit","preconditions on source/target existence","no source deletion","old UID aliases retained","cutover metadata remains pending until Auth succeeds"]},{"step":5,"name":"firebase_auth_transition","system":"Firebase Auth","projectedWrites":1,"rules":["separate non-atomic operation","new PRN2 UID must not already exist","old account not retired before new account verification","no password material exported"]},{"step":6,"name":"post_cutover_verification","system":"all","required":["student and principal UID registries","aliases","assignments","attendance","Firebase Auth","Sheet reread","login smoke tests"]},{"step":7,"name":"finalize_or_rollback","system":"all","rules":["mark complete only after every verification passes","on failure preserve old identities and execute rollback plan"]}]
);

const ROLLBACK_ORDER = Object.freeze(
  ["re-enable or preserve old Firebase Auth identity","remove or disable incomplete new Firebase Auth identity","revert Firestore target documents using rollback snapshot","restore only patched Sheet UID cells","preserve current 관리자인증 9열 values","verify stable normalized Sheet digest and old login path"]
);

type GenericRecord =
  Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmDesignManifestOnly?: unknown;
  readonly confirmNoExecutionCallable?: unknown;
  readonly dryRunResult?: unknown;
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

function validateDryRunResult(
  value: unknown
): {
  result:
    GenericRecord;
  digest:
    string;
  checks:
    GenericRecord;
} {
  const result =
    asRecord(
      value,
      "dryRunResult"
    );

  const digest =
    sha256(
      JSON.stringify(
        canonicalize(result)
      )
    );

  const approval =
    asRecord(
      result.approval,
      "dryRunResult.approval"
    );

  const sheet =
    asRecord(
      result.sheetAttestation,
      "dryRunResult.sheetAttestation"
    );

  const safety =
    asRecord(
      result.safety,
      "dryRunResult.safety"
    );

  const constraints =
    asRecord(
      result.executionConstraints,
      "dryRunResult.executionConstraints"
    );

  const checks: GenericRecord = {
    resultDigest:
      digest ===
      EXPECTED_DRY_RUN_RESULT_DIGEST,
    requestId:
      text(result.requestId) ===
      REQUEST_ID,
    dryRunContract:
      text(
        result.dryRunContractDigest
      ) ===
      EXPECTED_DRY_RUN_CONTRACT_DIGEST,
    writeOperations:
      Number(
        result.writeOperations ||
        0
      ) === 0,
    approvalGeneration:
      Number(
        approval.generation ||
        0
      ) ===
      EXPECTED_APPROVAL_GENERATION,
    approvalValid:
      approval.valid === true,
    sheetValid:
      sheet.valid === true,
    stableSheetDigest:
      text(
        sheet.stableSnapshotDigest
      ) ===
      EXPECTED_STABLE_SHEET_DIGEST,
    rawSheetDigest:
      text(
        sheet.rawSnapshotDigest
      ) ===
      EXPECTED_RAW_SHEET_DIGEST,
    fanoutCounts:
      exactJson(
        result.fanoutCounts,
        EXPECTED_FANOUT
      ),
    fanoutChecks:
      Object.values(
        asRecord(
          result.fanoutChecks,
          "fanoutChecks"
        )
      ).every(
        (item) =>
          item === true
      ),
    rollbackCounts:
      exactJson(
        result.rollbackCounts,
        EXPECTED_ROLLBACK
      ),
    rollbackChecks:
      Object.values(
        asRecord(
          result.rollbackChecks,
          "rollbackChecks"
        )
      ).every(
        (item) =>
          item === true
      ),
    projectedMutations:
      exactJson(
        result.projectedMutations,
        PROJECTED_MUTATIONS
      ),
    projectedTotals:
      exactJson(
        result.projectedTotals,
        PROJECTED_TOTALS
      ),
    blockingReasons:
      Array.isArray(
        result.blockingReasons
      ) &&
      result.blockingReasons.length ===
      0,
    ready:
      result.finalCommitDryRunReady ===
      true,
    cellLevelPatch:
      constraints
        .cellLevelSheetPatchRequired ===
      true,
    fullRowOverwriteForbidden:
      constraints
        .fullRowOverwriteForbidden ===
      true,
    preservePrincipalAuthColumn9:
      constraints
        .principalAuthColumn9PreserveRequired ===
      true,
    noCommitCallable:
      safety.commitCallableIncluded ===
      false,
    noCutover:
      safety.actualUidCutoverAllowed ===
      false
  };

  return {
    result,
    digest,
    checks
  };
}

async function currentStagingChecks() {
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

  const fanoutCounts:
    Record<string, number> = {};

  for (
    const key of
    Object.keys(EXPECTED_FANOUT)
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
    Object.keys(EXPECTED_ROLLBACK)
  ) {
    rollbackCounts[key] =
      (
        await runRef
          .collection(key)
          .get()
      ).size;
  }

  const approvalSnapshot =
    await db.collection(
      "uidV2CutoverApprovals"
    ).doc(
      REQUEST_ID
    ).get();

  const approval =
    approvalSnapshot.exists
      ? approvalSnapshot.data() || {}
      : {};

  const checks: GenericRecord = {
    fanoutCounts:
      exactJson(
        fanoutCounts,
        EXPECTED_FANOUT
      ),
    rollbackCounts:
      exactJson(
        rollbackCounts,
        EXPECTED_ROLLBACK
      ),
    approvalExists:
      approvalSnapshot.exists,
    approvalGenerationAtLeastDryRun:
      Number(
        approval.generation ||
        0
      ) >=
      EXPECTED_APPROVAL_GENERATION,
    approvalContractPresent:
      /^[0-9a-f]{64}$/.test(
        text(
          approval.approvalContractDigest
        )
      ),
    cutoverStillBlocked:
      approval.actualUidCutoverAllowed ===
      false
  };

  return {
    db,
    runRef,
    fanoutCounts,
    rollbackCounts,
    approval,
    checks
  };
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
      UID_V2_CUTOVER_EXECUTION_DESIGN_PHASE4C12_VERSION,
    mode:
      "cutover_execution_design_manifest_only",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    status:
      text(data.status),
    contractDigest:
      text(data.contractDigest),
    manifestDigest:
      text(data.manifestDigest),
    dryRunResultDigest:
      text(data.dryRunResultDigest),
    projectedTotals:
      data.projectedTotals,
    executionOrder:
      data.executionOrder,
    rollbackOrder:
      data.rollbackOrder,
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
      commitCallableIncluded:
        false,
      executionCallableIncluded:
        false,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        "Phase 4C-13 cell-level Sheet patch plan and rollback simulation",
      allowed:
        true,
      actualUidCutoverAllowed:
        false
    }
  };
}

export const stageUidV2CutoverExecutionDesignPhase4c12 =
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
        typeof request.data === "object"
          ? request.data as StageInput
          : {};

      if (
        text(input.requestId) !==
          REQUEST_ID ||
        text(input.contractDigest) !==
          EXPECTED_CONTRACT_DIGEST ||
        input.confirmDesignManifestOnly !==
          true ||
        input.confirmNoExecutionCallable !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-12 input gate failed."
        );
      }

      const dryRun =
        validateDryRunResult(
          input.dryRunResult
        );

      if (!allTrue(dryRun.checks)) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-11B dry-run result validation failed."
        );
      }

      const current =
        await currentStagingChecks();

      if (!allTrue(current.checks)) {
        throw new HttpsError(
          "failed-precondition",
          "Current staging data no longer matches the Phase 4C-12 design contract."
        );
      }

      const manifestCore = {
        version:
          UID_V2_CUTOVER_EXECUTION_DESIGN_PHASE4C12_VERSION,
        phase:
          "Phase 4C-12",
        mode:
          "cutover_execution_design_manifest_only",
        requestId:
          REQUEST_ID,
        approvedByFirebaseUid:
          callerUid,
        contractDigest:
          EXPECTED_CONTRACT_DIGEST,
        dryRunResultDigest:
          dryRun.digest,
        dryRunContractDigest:
          EXPECTED_DRY_RUN_CONTRACT_DIGEST,
        stableSheetDigest:
          EXPECTED_STABLE_SHEET_DIGEST,
        rawSheetDigestAtDryRun:
          EXPECTED_RAW_SHEET_DIGEST,
        approvalGenerationAtDryRun:
          EXPECTED_APPROVAL_GENERATION,
        expectedFanout:
          EXPECTED_FANOUT,
        expectedRollback:
          EXPECTED_ROLLBACK,
        projectedMutations:
          PROJECTED_MUTATIONS,
        projectedTotals:
          PROJECTED_TOTALS,
        executionOrder:
          EXECUTION_ORDER,
        rollbackOrder:
          ROLLBACK_ORDER,
        constraints: {
          sheetFirstRequired:
            true,
          sheetRereadRequired:
            true,
          cellLevelSheetPatchRequired:
            true,
          fullRowOverwriteForbidden:
            true,
          principalAuthColumn9PreserveRequired:
            true,
          firestoreBatchWithin500:
            Number(
              (
                PROJECTED_TOTALS as
                  GenericRecord
              ).firestoreWrites ||
              0
            ) <= 500,
          crossSystemAtomicity:
            false,
          phasedCommitRequired:
            true,
          actualUidCutoverAllowed:
            false
        },
        safety: {
          isolatedManifestWrites:
            1,
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
          commitCallableIncluded:
            false,
          executionCallableIncluded:
            false,
          actualUidCutoverAllowed:
            false
        }
      };

      const manifestDigest =
        sha256(
          JSON.stringify(
            canonicalize(
              manifestCore
            )
          )
        );

      const manifestRef =
        current.runRef
          .collection(
            "cutoverExecutionManifests"
          )
          .doc(
            "phase4c12"
          );

      let duplicate =
        false;
      let writeOperations =
        0;
      let outputData:
        GenericRecord = {};

      await current.db.runTransaction(
        async (transaction) => {
          const existing =
            await transaction.get(
              manifestRef
            );

          if (existing.exists) {
            const data =
              existing.data() || {};

            if (
              text(data.manifestDigest) !==
                manifestDigest ||
              text(data.contractDigest) !==
                EXPECTED_CONTRACT_DIGEST
            ) {
              throw new HttpsError(
                "already-exists",
                "A conflicting Phase 4C-12 execution design manifest exists."
              );
            }

            duplicate = true;
            outputData = data;
            return;
          }

          outputData = {
            ...manifestCore,
            manifestDigest,
            status:
              "execution_design_manifest_staged",
            createdAt:
              new Date().toISOString()
          };

          transaction.set(
            manifestRef,
            outputData
          );

          writeOperations = 1;
        }
      );

      return publicResult(
        outputData,
        duplicate,
        writeOperations
      );
    }
  );

export const inspectUidV2CutoverExecutionDesignPhase4c12 =
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
        typeof request.data === "object"
          ? request.data as InspectInput
          : {};

      if (
        text(input.requestId) !==
          REQUEST_ID ||
        text(input.contractDigest) !==
          EXPECTED_CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-12 inspect gate failed."
        );
      }

      const db =
        getFirestore(
          defaultAdminApp()
        );

      const snapshot =
        await db.collection(
          "uidV2StagingRuns"
        ).doc(
          REQUEST_ID
        ).collection(
          "cutoverExecutionManifests"
        ).doc(
          "phase4c12"
        ).get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-12 execution design manifest was not found."
        );
      }

      const data =
        snapshot.data() || {};

      const manifestCore = {
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
        dryRunResultDigest:
          data.dryRunResultDigest,
        dryRunContractDigest:
          data.dryRunContractDigest,
        stableSheetDigest:
          data.stableSheetDigest,
        rawSheetDigestAtDryRun:
          data.rawSheetDigestAtDryRun,
        approvalGenerationAtDryRun:
          data.approvalGenerationAtDryRun,
        expectedFanout:
          data.expectedFanout,
        expectedRollback:
          data.expectedRollback,
        projectedMutations:
          data.projectedMutations,
        projectedTotals:
          data.projectedTotals,
        executionOrder:
          data.executionOrder,
        rollbackOrder:
          data.rollbackOrder,
        constraints:
          data.constraints,
        safety:
          data.safety
      };

      const recalculated =
        sha256(
          JSON.stringify(
            canonicalize(
              manifestCore
            )
          )
        );

      if (
        recalculated !==
          text(data.manifestDigest) ||
        text(data.contractDigest) !==
          EXPECTED_CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "data-loss",
          "Phase 4C-12 manifest digest verification failed."
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
