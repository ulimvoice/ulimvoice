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
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_V2_REBASE_CUTOVER_EXECUTION_DESIGN_PHASE4C12R_VERSION =
  "2026-07-28.716.58-phase4c12r-cutover-execution-design-server-manifest-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "659bd348539f26002ece857fa938afadd6c6188fd58e96191259da23c6363766";

const EXPECTED_DRY_RUN_RESULT_DIGEST =
  "b1a3d8be1b5c0c80543a31975fa1cd20f478c34f295c0f55158b6dbe8412e452";

const EXPECTED_DRY_RUN_VERSION =
  "2026-07-28.716.56-phase4c11r-mixed-prior-chain-cutover-path-hotfix";

const EXPECTED_DRY_RUN_CONTRACT_DIGEST =
  "22d32934d3684a349f4217f1511a20adf2184d5811d1edd68d1fee41e5cb8f7a";

const EXPECTED_APPROVAL_GENERATION =
  3;

const EXPECTED_APPROVAL_DIGEST =
  "7f1259ecff234279f792ad7fb37451f2850f28de7a4c8a4d4d7caa4bd92250c8";

const EXPECTED_SHEET_ATTESTATION_DIGEST =
  "025091292f429aee6003c13840ccd9abaa2bf5f8fe04521d8d771b4f08759907";

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

const EXPECTED_PHASE4C8R_CONTRACT_DIGEST =
  "51b2108c9e350471f458f49af5eb06e3a4f304e8798fab87e4dedc67e8f32fa1";

const EXPECTED_LIVE_BASELINE_DIGEST =
  "5c397939a816bf5404ac869ad946a5e2a5308b961341e08fae5f236ceffde98b";

const EXPECTED_SHEET_SNAPSHOT_DIGEST =
  "f37c0a0b984c9ce5392229acfe359c0cf57ed9e03faef458cb37718ea02c614c";

const EXPECTED_SNAPSHOT_SET_DIGEST =
  "6e2cd04e8f7fb82c16b825c373d27efb2abc44dc6356469085f39df2076c1840";

const EXPECTED_PHASE4C7R_CONTRACT_DIGEST =
  "658dc5f19b1b6036c9b995607e1be305d239b74e67e47566e8472efb0be04135";

const EXPECTED_REHEARSAL_RESULT_DIGEST =
  "416db13b9958ec54952121ac0c0ee13512d942b6bf4a6ca38e54a56afb182c24";

const EXPECTED_PHASE4C9R_CONTRACT_DIGEST =
  "12d1fcf5aafe7c4ad453426e5d43e2b9a996dc8bc57be33b22e8d0734eff9f31";

const EXPECTED_LIVE_AUDIT_DIGEST =
  "7768b791be2d1161bbf3676c23f5263a2f0326123a0f99a0c505c2787c8f3e0c";

const EXPECTED_PHASE4C10R_CONTRACT_DIGEST =
  "8a3c422d0e79a05b073f33c529e7b9cad214f54a999321c65e300165a1e16948";

const EXPECTED_FANOUT = Object.freeze(
  {"rebaseFanoutStudents":156,"rebaseFanoutPrincipals":12,"rebaseFanoutStudentAliases":85,"rebaseFanoutPrincipalAliases":13,"rebaseFanoutAssignmentMappings":14,"rebaseFanoutAttendanceMappings":1,"rebaseFanoutAuthTransitions":1,"rebaseFanoutExclusions":1}
);

const EXPECTED_ROLLBACK = Object.freeze(
  {"rollbackStudentRows":156,"rollbackPrincipalRows":12,"rollbackAttendanceDocuments":69,"rollbackAssignmentDocuments":14,"rollbackFirebaseAuthUsers":1,"inPlaceAttendancePlans":68}
);

const PROJECTED_MUTATIONS = Object.freeze(
  {"studentSheetCellMutations":156,"principalSheetCellMutations":12,"studentRegistryDocuments":156,"principalRegistryDocuments":12,"studentAliasDocuments":85,"principalAliasDocuments":13,"assignmentCloneDocuments":14,"attendanceInPlaceDocuments":68,"attendanceCloneDocuments":1,"firebaseAuthUsers":1,"cutoverMetadataDocuments":1}
);

const PROJECTED_TOTALS = Object.freeze(
  {"sheetMutations":168,"firestoreWrites":350,"firebaseAuthWrites":1,"logicalMutations":519}
);

const EXPECTED_DRY_RUN_EXECUTION_ORDER = Object.freeze(
  ["revalidateApproval","revalidateLiveDrift","applySheetIdentityCellPatch","rereadAndVerifySheetIdentityCells","commitFirestoreUidRegistryAliasAttendanceAssignmentBatch","verifyFirestorePostCommit","transitionFirebaseAuthPrincipal","verifyFirebaseAuthTransition","finalizeCutoverMetadata"]
);

const EXPECTED_DRY_RUN_CONSTRAINTS = Object.freeze(
  {"firestoreBatchWithin500":true,"singleFirestoreBatchPossible":true,"crossSystemAtomicity":false,"phasedCommitRequired":true,"sheetCellPatchOnly":true,"fullSheetRowOverwriteForbidden":true,"sheetFirstRequired":true,"sheetRereadRequired":true,"approvalRevalidationRequired":true,"liveDriftRevalidationRequired":true,"rollbackSnapshotRequired":true,"firebaseAuthLastRequired":true,"commitCallableIncluded":false,"actualUidCutoverAllowed":false}
);

const DESIGN_EXECUTION_ORDER = Object.freeze(
  [{"step":1,"name":"fresh_preflight_revalidation","system":"read_only","required":["superAdmin caller","fresh 10-minute approval before future cutover","fresh stable Sheet attestation before future cutover","live Firestore and Firebase Auth drift audit","rollback snapshot and restore rehearsal coverage complete","Phase 4C-11R dry-run contract still matches"]},{"step":2,"name":"sheet_uid_cell_patch","system":"Google Sheets","projectedMutations":168,"rules":["Sheet first","student UID target cells only","principal UID target cells only","full-row overwrite forbidden","관리자인증 recent-login column 9 preserved","abort before Firestore and Auth on any mismatch"]},{"step":3,"name":"sheet_reread_and_verify","system":"Google Sheets","required":["all 168 UID target cells reread","student count 156","principal count 12","stable normalized Sheet digest verified","관리자인증 recent-login column 9 unchanged"]},{"step":4,"name":"firestore_uid_cutover_batch","system":"Firestore","projectedWrites":350,"rules":["single batch remains under 500-write limit","source and target preconditions checked","no source deletion","old UID aliases retained","cutover metadata remains pending until Auth verification"]},{"step":5,"name":"firestore_post_commit_verification","system":"Firestore","required":["student and principal registries","student and principal aliases","assignment clones","68 in-place attendance documents","1 attendance clone","pending cutover metadata"]},{"step":6,"name":"firebase_auth_transition","system":"Firebase Auth","projectedWrites":1,"rules":["Firebase Auth runs after Sheet and Firestore verification","new principal UID must not already exist","old identity preserved until new identity verification","no password material exported"]},{"step":7,"name":"firebase_auth_and_login_verification","system":"Firebase Auth and application","required":["new principal Auth identity verified","superAdmin claims verified","student login smoke test","instructor login smoke test","administrator login smoke test"]},{"step":8,"name":"finalize_or_rollback","system":"all","rules":["mark complete only after every verification passes","on any failure stop further writes","preserve old identities","execute the approved rollback plan","record immutable completion or rollback outcome"]}]
);

const ROLLBACK_ORDER = Object.freeze(
  ["freeze further cutover operations","preserve or re-enable the old Firebase Auth identity","disable or remove only the incomplete new Firebase Auth identity","restore Firestore target documents from the isolated rollback snapshot","restore only the 168 patched Sheet UID cells","preserve current 관리자인증 recent-login column 9 values","verify stable Sheet digest and old login path","record rollback verification outcome"]
);

const DESIGN_CONSTRAINTS = Object.freeze(
  {"designManifestOnly":true,"serverManifestIsolatedOnly":true,"sheetCellPatchOnly":true,"fullSheetRowOverwriteForbidden":true,"principalAuthRecentLoginColumn9PreserveRequired":true,"sheetFirstRequired":true,"sheetRereadRequired":true,"firestoreBatchWithin500":true,"singleFirestoreBatchPossible":true,"sourceDeletionForbidden":true,"oldUidAliasesRetained":true,"crossSystemAtomicity":false,"phasedCommitRequired":true,"approvalRevalidationRequired":true,"liveDriftRevalidationRequired":true,"freshSheetAttestationRequired":true,"rollbackSnapshotRequired":true,"firebaseAuthLastRequired":true,"commitCallableIncluded":false,"executionCallableIncluded":false,"actualUidCutoverAllowed":false}
);

type GenericRecord =
  Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmDesignManifestOnly?: unknown;
  readonly confirmNoExecutionCallable?: unknown;
  readonly confirmNoSourceWrites?: unknown;
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

function digestValue(
  value: unknown
): string {
  return sha256(
    JSON.stringify(
      canonicalize(value)
    )
  );
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

function allRecordValuesTrue(
  value: unknown,
  label: string
): boolean {
  return allTrue(
    asRecord(value, label)
  );
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

function validateDryRunResult(
  value: unknown
): {
  result: GenericRecord;
  digest: string;
  checks: GenericRecord;
} {
  const result =
    asRecord(
      value,
      "dryRunResult"
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

  const chainChecks =
    asRecord(
      result.chainChecks,
      "dryRunResult.chainChecks"
    );

  const safety =
    asRecord(
      result.safety,
      "dryRunResult.safety"
    );

  const nextGate =
    asRecord(
      result.nextGate,
      "dryRunResult.nextGate"
    );

  const digest =
    digestValue(result);

  const checks:
    GenericRecord = {
    resultDigest:
      digest ===
      EXPECTED_DRY_RUN_RESULT_DIGEST,
    ok:
      result.ok === true,
    version:
      text(result.version) ===
      EXPECTED_DRY_RUN_VERSION,
    phase:
      text(result.phase) ===
      "Phase 4C-11R",
    mode:
      text(result.mode) ===
      "rebase156_final_commit_dry_run_contract_only",
    requestId:
      text(result.requestId) ===
      REQUEST_ID,
    contract:
      text(result.contractDigest) ===
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
    approvalDigest:
      text(approval.approvalDigest) ===
      EXPECTED_APPROVAL_DIGEST,
    approvalValid:
      approval.valid === true &&
      allRecordValuesTrue(
        approval.checks,
        "dryRunResult.approval.checks"
      ),
    sheetDigest:
      text(sheet.digest) ===
      EXPECTED_SHEET_ATTESTATION_DIGEST,
    sheetValid:
      sheet.valid === true &&
      allRecordValuesTrue(
        sheet.checks,
        "dryRunResult.sheetAttestation.checks"
      ),
    chainChecks:
      allTrue(chainChecks) &&
      chainChecks.cutoverBlocked === true,
    fanoutCounts:
      exactJson(
        result.fanoutCounts,
        EXPECTED_FANOUT
      ),
    fanoutChecks:
      allRecordValuesTrue(
        result.fanoutChecks,
        "dryRunResult.fanoutChecks"
      ),
    rollbackCounts:
      exactJson(
        result.rollbackCounts,
        EXPECTED_ROLLBACK
      ),
    rollbackChecks:
      allRecordValuesTrue(
        result.rollbackChecks,
        "dryRunResult.rollbackChecks"
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
    executionOrder:
      exactJson(
        result.executionOrder,
        EXPECTED_DRY_RUN_EXECUTION_ORDER
      ),
    executionConstraints:
      exactJson(
        result.executionConstraints,
        EXPECTED_DRY_RUN_CONSTRAINTS
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
    noWrites:
      Number(
        safety.firestoreWrites ||
        0
      ) === 0 &&
      Number(
        safety.sourceSheetWrites ||
        0
      ) === 0 &&
      Number(
        safety.activeUidRegistryWrites ||
        0
      ) === 0 &&
      Number(
        safety.attendanceWrites ||
        0
      ) === 0 &&
      Number(
        safety.assignmentWrites ||
        0
      ) === 0 &&
      Number(
        safety.firebaseAuthWrites ||
        0
      ) === 0 &&
      Number(
        safety.sessionChanges ||
        0
      ) === 0 &&
      Number(
        safety.approvalRecordWrites ||
        0
      ) === 0,
    noCommit:
      safety.commitCallableIncluded ===
      false,
    noCutover:
      safety.actualUidCutoverAllowed ===
      false,
    nextGate:
      text(nextGate.phase) ===
      "Phase 4C-12R cutover execution design and server manifest only" &&
      nextGate.allowed === true &&
      nextGate.actualUidCutoverAllowed ===
      false
  };

  return {
    result,
    digest,
    checks
  };
}

async function currentChainChecks(
  callerUid: string
) {
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
    approvalSnapshot,
    fanoutMetaSnapshot,
    rollbackMetaSnapshot,
    rehearsalSnapshot,
    fanout,
    rollback
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
      .get(),
    readCollectionCounts(
      runRef,
      EXPECTED_FANOUT
    ),
    readCollectionCounts(
      runRef,
      EXPECTED_ROLLBACK
    )
  ]);

  if (
    !approvalSnapshot.exists ||
    !fanoutMetaSnapshot.exists ||
    !rollbackMetaSnapshot.exists ||
    !rehearsalSnapshot.exists
  ) {
    throw new HttpsError(
      "not-found",
      "Phase 4C-12R prior-chain metadata is missing."
    );
  }

  const approval =
    approvalSnapshot.data() || {};
  const fanoutMeta =
    fanoutMetaSnapshot.data() || {};
  const rollbackMeta =
    rollbackMetaSnapshot.data() || {};
  const rehearsal =
    rehearsalSnapshot.data() || {};

  const approvalSafety =
    asRecord(
      approval.safety,
      "approval.safety"
    );

  const fanoutSafety =
    asRecord(
      fanoutMeta.safety,
      "fanoutMeta.safety"
    );

  const rehearsalSafety =
    asRecord(
      rehearsal.safety,
      "rehearsal.safety"
    );

  const checks:
    GenericRecord = {
    caller:
      text(
        approval.approvedByFirebaseUid
      ) === callerUid,
    approvalStatus:
      text(approval.status) ===
      "rebase_live_approval_armed",
    approvalGeneration:
      Number(
        approval.generation ||
        0
      ) >=
      EXPECTED_APPROVAL_GENERATION,
    approvalContract:
      text(approval.contractDigest) ===
      EXPECTED_PHASE4C10R_CONTRACT_DIGEST,
    liveAudit:
      text(approval.liveAuditDigest) ===
      EXPECTED_LIVE_AUDIT_DIGEST,
    approvalCutoverBlocked:
      approvalSafety.actualUidCutoverAllowed ===
      false,
    fanoutStatus:
      text(fanoutMeta.status) ===
      "rebase_isolated_fanout_verified",
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
    fanoutCutoverBlocked:
      fanoutSafety.actualUidCutoverAllowed ===
      false,
    rollbackStatus:
      text(rollbackMeta.status) ===
      "rebase_live_baseline_staged",
    rollbackContract:
      text(
        rollbackMeta.liveBaselineContractDigest
      ) ===
      EXPECTED_PHASE4C8R_CONTRACT_DIGEST,
    liveBaseline:
      text(
        rollbackMeta.rollbackSnapshotDigest
      ) ===
      EXPECTED_LIVE_BASELINE_DIGEST,
    sheetSnapshot:
      text(
        rollbackMeta.sheetSnapshotDigest
      ) ===
      EXPECTED_SHEET_SNAPSHOT_DIGEST,
    snapshotSet:
      text(
        rollbackMeta.snapshotSetDigest
      ) ===
      EXPECTED_SNAPSHOT_SET_DIGEST,
    rollbackCutoverBlocked:
      rollbackMeta.actualUidCutoverAllowed ===
      false,
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
    rehearsalCutoverBlocked:
      rehearsalSafety.actualUidCutoverAllowed ===
      false,
    fanoutCounts:
      fanout.valid,
    rollbackCounts:
      rollback.valid
  };

  return {
    db,
    runRef,
    fanout,
    rollback,
    checks,
    valid:
      allTrue(checks)
  };
}

function publicResult(
  data: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  currentChecks?: GenericRecord,
  fanoutCounts?: unknown,
  rollbackCounts?: unknown
) {
  return {
    ok: true,
    version:
      UID_V2_REBASE_CUTOVER_EXECUTION_DESIGN_PHASE4C12R_VERSION,
    phase:
      "Phase 4C-12R",
    mode:
      "rebase156_cutover_execution_design_server_manifest_only",
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
    phase4c11rEvidence:
      data.phase4c11rEvidence,
    currentChainChecks:
      currentChecks ||
      data.currentChainChecks,
    fanoutCounts:
      fanoutCounts ||
      data.fanoutCounts,
    rollbackCounts:
      rollbackCounts ||
      data.rollbackCounts,
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
      executionCallableIncluded:
        false,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        "Phase 4C-13R cell-level Sheet patch plan and rollback simulation only",
      allowed:
        true,
      actualUidCutoverAllowed:
        false
    }
  };
}

export const stageUidV2RebaseCutoverExecutionDesignPhase4c12r =
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
          CONTRACT_DIGEST ||
        input.confirmDesignManifestOnly !==
          true ||
        input.confirmNoExecutionCallable !==
          true ||
        input.confirmNoSourceWrites !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-12R input gate failed."
        );
      }

      const dryRun =
        validateDryRunResult(
          input.dryRunResult
        );

      if (!allTrue(dryRun.checks)) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-11R dry-run result validation failed."
        );
      }

      const current =
        await currentChainChecks(
          callerUid
        );

      if (!current.valid) {
        throw new HttpsError(
          "failed-precondition",
          "Current server chain no longer matches the Phase 4C-12R design contract."
        );
      }

      const manifestCore = {
        version:
          UID_V2_REBASE_CUTOVER_EXECUTION_DESIGN_PHASE4C12R_VERSION,
        phase:
          "Phase 4C-12R",
        mode:
          "rebase156_cutover_execution_design_server_manifest_only",
        requestId:
          REQUEST_ID,
        approvedByFirebaseUid:
          callerUid,
        contractDigest:
          CONTRACT_DIGEST,
        dryRunResultDigest:
          dryRun.digest,
        phase4c11rEvidence:
          {"version":"2026-07-28.716.56-phase4c11r-mixed-prior-chain-cutover-path-hotfix","mode":"rebase156_final_commit_dry_run_contract_only","resultDigest":"b1a3d8be1b5c0c80543a31975fa1cd20f478c34f295c0f55158b6dbe8412e452","contractDigest":"22d32934d3684a349f4217f1511a20adf2184d5811d1edd68d1fee41e5cb8f7a","approvalGenerationAtDryRun":3,"approvalDigestAtDryRun":"7f1259ecff234279f792ad7fb37451f2850f28de7a4c8a4d4d7caa4bd92250c8","sheetAttestationDigestAtDryRun":"025091292f429aee6003c13840ccd9abaa2bf5f8fe04521d8d771b4f08759907"},
        expectedChain:
          {"phase4c5rContractDigest":"e3613acc1c03d352df591371aeba2a2ec1cd5a1a40d7c1a1de88ca57aa8d02c5","payloadDigest":"748710b323521e64895d52548cbe1a0680bb02837579dd4079da9cff56f66288","fanoutDesignDigest":"bc11d7b0c94cc2a600d1b4202419f5cef14eadbfc172c2b59bbfc4f61d3eb65e","recordSetDigest":"ec3fad78b2d29666497861f567ac38f2e864f34969516a2cda4c58d9102fb28c","fanoutMetadataDigest":"7afa4fc0804f768ab00e78e4c780b94e50ac34a3e69647bed4d7264aa7085105","phase4c8rContractDigest":"51b2108c9e350471f458f49af5eb06e3a4f304e8798fab87e4dedc67e8f32fa1","liveBaselineDigest":"5c397939a816bf5404ac869ad946a5e2a5308b961341e08fae5f236ceffde98b","sheetSnapshotDigest":"f37c0a0b984c9ce5392229acfe359c0cf57ed9e03faef458cb37718ea02c614c","snapshotSetDigest":"6e2cd04e8f7fb82c16b825c373d27efb2abc44dc6356469085f39df2076c1840","phase4c7rContractDigest":"658dc5f19b1b6036c9b995607e1be305d239b74e67e47566e8472efb0be04135","rehearsalResultDigest":"416db13b9958ec54952121ac0c0ee13512d942b6bf4a6ca38e54a56afb182c24","phase4c9rContractDigest":"12d1fcf5aafe7c4ad453426e5d43e2b9a996dc8bc57be33b22e8d0734eff9f31","liveAuditDigest":"7768b791be2d1161bbf3676c23f5263a2f0326123a0f99a0c505c2787c8f3e0c","phase4c10rContractDigest":"8a3c422d0e79a05b073f33c529e7b9cad214f54a999321c65e300165a1e16948"},
        fanoutCounts:
          current.fanout.counts,
        rollbackCounts:
          current.rollback.counts,
        projectedMutations:
          PROJECTED_MUTATIONS,
        projectedTotals:
          PROJECTED_TOTALS,
        executionOrder:
          DESIGN_EXECUTION_ORDER,
        rollbackOrder:
          ROLLBACK_ORDER,
        constraints:
          DESIGN_CONSTRAINTS,
        currentChainChecks:
          current.checks,
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
          sessionChanges:
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
        digestValue(
          manifestCore
        );

      const manifestRef =
        current.runRef
          .collection(
            "rebaseCutoverExecutionManifests"
          )
          .doc(
            "phase4c12r"
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
                CONTRACT_DIGEST
            ) {
              throw new HttpsError(
                "already-exists",
                "A conflicting Phase 4C-12R design manifest exists."
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
              "rebase_cutover_execution_design_manifest_staged",
            createdAtIso:
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
        writeOperations,
        current.checks,
        current.fanout.counts,
        current.rollback.counts
      );
    }
  );

export const inspectUidV2RebaseCutoverExecutionDesignPhase4c12r =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        180,
      memory:
        "256MiB",
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
          ? request.data as InspectInput
          : {};

      if (
        text(input.requestId) !==
          REQUEST_ID ||
        text(input.contractDigest) !==
          CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-12R inspect gate failed."
        );
      }

      const current =
        await currentChainChecks(
          callerUid
        );

      if (!current.valid) {
        throw new HttpsError(
          "failed-precondition",
          "Current server chain no longer matches the Phase 4C-12R design contract."
        );
      }

      const snapshot =
        await current.runRef
          .collection(
            "rebaseCutoverExecutionManifests"
          )
          .doc(
            "phase4c12r"
          )
          .get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-12R design manifest was not found."
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
        phase4c11rEvidence:
          data.phase4c11rEvidence,
        expectedChain:
          data.expectedChain,
        fanoutCounts:
          data.fanoutCounts,
        rollbackCounts:
          data.rollbackCounts,
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
        currentChainChecks:
          data.currentChainChecks,
        safety:
          data.safety
      };

      const recalculated =
        digestValue(
          manifestCore
        );

      const storedChecks =
        asRecord(
          data.currentChainChecks,
          "manifest.currentChainChecks"
        );

      if (
        recalculated !==
          text(data.manifestDigest) ||
        text(data.contractDigest) !==
          CONTRACT_DIGEST ||
        text(data.dryRunResultDigest) !==
          EXPECTED_DRY_RUN_RESULT_DIGEST ||
        text(data.approvedByFirebaseUid) !==
          callerUid ||
        !allTrue(storedChecks) ||
        !exactJson(
          data.fanoutCounts,
          EXPECTED_FANOUT
        ) ||
        !exactJson(
          data.rollbackCounts,
          EXPECTED_ROLLBACK
        ) ||
        !exactJson(
          data.projectedMutations,
          PROJECTED_MUTATIONS
        ) ||
        !exactJson(
          data.projectedTotals,
          PROJECTED_TOTALS
        ) ||
        !exactJson(
          data.executionOrder,
          DESIGN_EXECUTION_ORDER
        ) ||
        !exactJson(
          data.rollbackOrder,
          ROLLBACK_ORDER
        ) ||
        !exactJson(
          data.constraints,
          DESIGN_CONSTRAINTS
        )
      ) {
        throw new HttpsError(
          "data-loss",
          "Phase 4C-12R manifest verification failed."
        );
      }

      return {
        ...publicResult(
          data,
          true,
          0,
          current.checks,
          current.fanout.counts,
          current.rollback.counts
        ),
        verified:
          true,
        digestMatches:
          true,
        currentChainStillValid:
          true
      };
    }
  );
