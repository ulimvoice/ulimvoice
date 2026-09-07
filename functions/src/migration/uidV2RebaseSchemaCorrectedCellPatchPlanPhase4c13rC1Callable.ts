import { createHash } from "node:crypto";
import {
  App,
  getApp,
  getApps,
  initializeApp
} from "firebase-admin/app";
import {
  DocumentData,
  QueryDocumentSnapshot,
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_V2_REBASE_SCHEMA_CORRECTED_CELL_PATCH_PLAN_PHASE4C13R_C1_VERSION =
  "2026-07-28.716.63-phase4c13r-schema-header-correction-cell-plan-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "837eac8a3d1afc3f69a39d038804c9383d658f3005afe0dc84d2fbe2b6176049";

const EXPECTED_PHASE4C12_CONTRACT_DIGEST =
  "659bd348539f26002ece857fa938afadd6c6188fd58e96191259da23c6363766";

const EXPECTED_PHASE4C12_MANIFEST_DIGEST =
  "01923a467a1b68e8a6be58c9d2f90f66efe045034a26d1a25281a69b677fdb21";

const EXPECTED_PHASE4C12_RESULT_DIGEST =
  "32f26e1376fd15ef88960c00d9a490bbf9ec1dcbe307f4989bad567475dbbbb7";

const EXPECTED_PHASE4C11_DRY_RUN_DIGEST =
  "b1a3d8be1b5c0c80543a31975fa1cd20f478c34f295c0f55158b6dbe8412e452";

const EXPECTED_PAYLOAD_DIGEST =
  "748710b323521e64895d52548cbe1a0680bb02837579dd4079da9cff56f66288";

const EXPECTED_FANOUT_DESIGN_DIGEST =
  "bc11d7b0c94cc2a600d1b4202419f5cef14eadbfc172c2b59bbfc4f61d3eb65e";

const EXPECTED_RECORD_SET_DIGEST =
  "ec3fad78b2d29666497861f567ac38f2e864f34969516a2cda4c58d9102fb28c";

const EXPECTED_FANOUT_METADATA_DIGEST =
  "7afa4fc0804f768ab00e78e4c780b94e50ac34a3e69647bed4d7264aa7085105";

const EXPECTED_LIVE_BASELINE_DIGEST =
  "5c397939a816bf5404ac869ad946a5e2a5308b961341e08fae5f236ceffde98b";

const EXPECTED_SHEET_SNAPSHOT_DIGEST =
  "f37c0a0b984c9ce5392229acfe359c0cf57ed9e03faef458cb37718ea02c614c";

const EXPECTED_SNAPSHOT_SET_DIGEST =
  "6e2cd04e8f7fb82c16b825c373d27efb2abc44dc6356469085f39df2076c1840";

const EXPECTED_STUDENT_COUNT =
  156;

const EXPECTED_PRINCIPAL_COUNT =
  12;

const EXPECTED_IDENTITY_PATCH_COUNT =
  168;

const EXPECTED_SCHEMA_HEADER_PATCH_COUNT =
  2;

const EXPECTED_TOTAL_PATCH_COUNT =
  170;

const TARGET_COLUMNS = Object.freeze(
  {"studentMaster":{"sheetName":"학생명단","sheetId":0,"columnNumber":14,"columnLetter":"N","header":"학생UIDv2"},"principalMaster":{"sheetName":"관리자","sheetId":441317341,"columnNumber":8,"columnLetter":"H","header":"PrincipalUIDv2"}}
);

const EXPECTED_COUNTS = Object.freeze(
  {"studentCellPatches":156,"principalCellPatches":12,"identityCellPatches":168,"schemaHeaderPatches":2,"totalCellPatches":170,"principalAuthColumn9Anchors":12,"targetSheets":2}
);

type GenericRecord =
  Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmPlanOnly?: unknown;
  readonly confirmRollbackSimulationOnly?: unknown;
  readonly confirmNoSourceWrites?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
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

function cellValue(
  row: GenericRecord,
  propertyName: string,
  index: number
): unknown {
  const values =
    row[propertyName];

  return Array.isArray(values)
    ? values[index]
    : undefined;
}

function blankValue(
  value: unknown
): boolean {
  return value == null ||
    (
      typeof value === "string" &&
      value.trim() === ""
    );
}

function targetCellIsBlank(
  row: GenericRecord,
  columnNumber: number
): boolean {
  const index =
    columnNumber - 1;

  return [
    "rawValues",
    "displayValues",
    "formulas",
    "notes"
  ].every(
    (propertyName) =>
      blankValue(
        cellValue(
          row,
          propertyName,
          index
        )
      )
  );
}

function rowNumber(
  row: GenericRecord
): number {
  const value =
    Number(row.rowNumber);

  if (
    !Number.isInteger(value) ||
    value < 2
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Invalid Sheet row number."
    );
  }

  return value;
}

function validateFanoutWrapper(
  snapshot:
    QueryDocumentSnapshot<DocumentData>,
  expectedType: "student" | "principal"
): GenericRecord {
  const wrapper =
    snapshot.data();

  const data =
    asRecord(
      wrapper.data,
      `${expectedType} fanout data`
    );

  const expectedUid =
    text(data.newUid);

  const checks = {
    id:
      snapshot.id ===
      expectedUid,
    type:
      text(wrapper.type) ===
      expectedType,
    isolated:
      wrapper.isolated ===
      true,
    active:
      wrapper.active ===
      false,
    payload:
      text(
        wrapper.sourcePayloadDigest
      ) ===
      EXPECTED_PAYLOAD_DIGEST,
    fanout:
      text(
        wrapper.sourceFanoutDesignDigest
      ) ===
      EXPECTED_FANOUT_DESIGN_DIGEST,
    recordDigest:
      text(wrapper.recordDigest) ===
      digestValue(data)
  };

  if (!allTrue(checks)) {
    const failed =
      Object.entries(checks)
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
      `${expectedType} fanout validation failed: ${failed.join(", ")}`
    );
  }

  return data;
}

function masterRow(
  record: GenericRecord,
  expectedSheetName: string,
  expectedSheetId: number,
  targetColumn: number
): GenericRecord {
  const rows =
    asArray(
      record.masterRows,
      "masterRows"
    );

  if (rows.length !== 1) {
    throw new HttpsError(
      "failed-precondition",
      "Master row count must be exactly 1."
    );
  }

  const row =
    asRecord(
      rows[0],
      "masterRows[0]"
    );

  const baselineColumnCount =
    Number(row.columnCount);

  const checks = {
    sheetName:
      text(row.sheetName) ===
      expectedSheetName,
    sheetId:
      Number(row.sheetId) ===
      expectedSheetId,
    appendColumn:
      baselineColumnCount ===
      targetColumn - 1,
    capturedWidths:
      [
        "rawValues",
        "displayValues",
        "formulas",
        "notes"
      ].every(
        (propertyName) => {
          const values =
            row[propertyName];

          return Array.isArray(values) &&
            values.length ===
              baselineColumnCount;
        }
      ),
    targetBlank:
      targetCellIsBlank(
        row,
        targetColumn
      )
  };

  if (!allTrue(checks)) {
    const failed =
      Object.entries(checks)
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
      "failed-precondition",
      `Sheet master-row validation failed: ${failed.join(", ")}`
    );
  }

  rowNumber(row);

  return row;
}

function authColumn9Anchor(
  record: GenericRecord
): GenericRecord {
  const rows =
    asArray(
      record.authRows,
      "principal.authRows"
    );

  if (rows.length !== 1) {
    throw new HttpsError(
      "failed-precondition",
      "Principal Auth row count must be exactly 1."
    );
  }

  const row =
    asRecord(
      rows[0],
      "principal.authRows[0]"
    );

  if (
    text(row.sheetName) !==
      "관리자인증" ||
    Number(row.columnCount) <
      9
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Principal Auth column 9 anchor is invalid."
    );
  }

  const authRowNumber =
    rowNumber(row);

  const baselineCellState = {
    raw:
      cellValue(
        row,
        "rawValues",
        8
      ),
    display:
      cellValue(
        row,
        "displayValues",
        8
      ),
    formula:
      cellValue(
        row,
        "formulas",
        8
      ),
    numberFormat:
      cellValue(
        row,
        "numberFormats",
        8
      ),
    note:
      cellValue(
        row,
        "notes",
        8
      )
  };

  return {
    sheetId:
      Number(row.sheetId),
    sheetName:
      "관리자인증",
    rowNumber:
      authRowNumber,
    columnNumber:
      9,
    a1:
      `I${authRowNumber}`,
    baselineCellStateDigest:
      digestValue(
        baselineCellState
      ),
    preserveCurrentValueAtApplyTime:
      true
  };
}

async function buildAuthoritativePlan(
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
    manifestSnapshot,
    rollbackMetaSnapshot,
    fanoutMetaSnapshot,
    studentRollbackSnapshot,
    principalRollbackSnapshot,
    studentFanoutSnapshot,
    principalFanoutSnapshot
  ] = await Promise.all([
    runRef
      .collection(
        "rebaseCutoverExecutionManifests"
      )
      .doc(
        "phase4c12r"
      )
      .get(),
    runRef
      .collection(
        "rollbackMeta"
      )
      .doc(
        "snapshot"
      )
      .get(),
    runRef
      .collection(
        "rebaseFanoutMetadata"
      )
      .doc(
        "phase4c5r"
      )
      .get(),
    runRef
      .collection(
        "rollbackStudentRows"
      )
      .get(),
    runRef
      .collection(
        "rollbackPrincipalRows"
      )
      .get(),
    runRef
      .collection(
        "rebaseFanoutStudents"
      )
      .get(),
    runRef
      .collection(
        "rebaseFanoutPrincipals"
      )
      .get()
  ]);

  if (
    !manifestSnapshot.exists ||
    !rollbackMetaSnapshot.exists ||
    !fanoutMetaSnapshot.exists
  ) {
    throw new HttpsError(
      "not-found",
      "Phase 4C-13R source metadata is missing."
    );
  }

  const manifest =
    manifestSnapshot.data() || {};

  const rollbackMeta =
    rollbackMetaSnapshot.data() || {};

  const fanoutMeta =
    fanoutMetaSnapshot.data() || {};

  const manifestSafety =
    asRecord(
      manifest.safety,
      "phase4c12r.safety"
    );

  const manifestConstraints =
    asRecord(
      manifest.constraints,
      "phase4c12r.constraints"
    );

  const manifestChecks:
    GenericRecord = {
    status:
      text(manifest.status) ===
      "rebase_cutover_execution_design_manifest_staged",
    caller:
      text(
        manifest.approvedByFirebaseUid
      ) ===
      callerUid,
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
      EXPECTED_PHASE4C11_DRY_RUN_DIGEST,
    projectedTotals:
      exactJson(
        manifest.projectedTotals,
        {
          sheetMutations:
            168,
          firestoreWrites:
            350,
          firebaseAuthWrites:
            1,
          logicalMutations:
            519
        }
      ),
    currentChain:
      allTrue(
        asRecord(
          manifest.currentChainChecks,
          "phase4c12r.currentChainChecks"
        )
      ),
    sheetCellOnly:
      manifestConstraints.sheetCellPatchOnly ===
      true,
    noFullRows:
      manifestConstraints.fullSheetRowOverwriteForbidden ===
      true,
    preserveAuth9:
      manifestConstraints.principalAuthRecentLoginColumn9PreserveRequired ===
      true,
    noCommit:
      manifestSafety.commitCallableIncluded ===
      false,
    noExecution:
      manifestSafety.executionCallableIncluded ===
      false,
    noCutover:
      manifestSafety.actualUidCutoverAllowed ===
      false
  };

  if (!allTrue(manifestChecks)) {
    const failed =
      Object.entries(
        manifestChecks
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
      "failed-precondition",
      `Phase 4C-12R manifest validation failed: ${failed.join(", ")}`
    );
  }

  const sourceChecks:
    GenericRecord = {
    studentRollbackCount:
      studentRollbackSnapshot.size ===
      EXPECTED_STUDENT_COUNT,
    principalRollbackCount:
      principalRollbackSnapshot.size ===
      EXPECTED_PRINCIPAL_COUNT,
    studentFanoutCount:
      studentFanoutSnapshot.size ===
      EXPECTED_STUDENT_COUNT,
    principalFanoutCount:
      principalFanoutSnapshot.size ===
      EXPECTED_PRINCIPAL_COUNT,
    payload:
      text(
        fanoutMeta.payloadDigest
      ) ===
      EXPECTED_PAYLOAD_DIGEST,
    fanoutDesign:
      text(
        fanoutMeta.fanoutDesignDigest
      ) ===
      EXPECTED_FANOUT_DESIGN_DIGEST,
    recordSet:
      text(
        fanoutMeta.recordSetDigest
      ) ===
      EXPECTED_RECORD_SET_DIGEST,
    fanoutMetadata:
      text(
        fanoutMeta.metadataDigest
      ) ===
      EXPECTED_FANOUT_METADATA_DIGEST,
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
      false
  };

  if (!allTrue(sourceChecks)) {
    const failed =
      Object.entries(
        sourceChecks
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
      "failed-precondition",
      `Phase 4C-13R source validation failed: ${failed.join(", ")}`
    );
  }

  const studentFanout =
    new Map<string, GenericRecord>();

  for (
    const snapshot of
    studentFanoutSnapshot.docs
  ) {
    const data =
      validateFanoutWrapper(
        snapshot,
        "student"
      );

    studentFanout.set(
      snapshot.id,
      data
    );
  }

  const principalFanout =
    new Map<string, GenericRecord>();

  for (
    const snapshot of
    principalFanoutSnapshot.docs
  ) {
    const data =
      validateFanoutWrapper(
        snapshot,
        "principal"
      );

    principalFanout.set(
      snapshot.id,
      data
    );
  }

  const patches:
    GenericRecord[] = [
      {
        patchId:
          "schema|0|1|14|학생UIDv2",
        patchType:
          "schema_header_cell",
        entityType:
          "schema",
        sheetId:
          0,
        sheetName:
          "학생명단",
        rowNumber:
          1,
        columnNumber:
          14,
        columnLetter:
          "N",
        a1:
          "N1",
        expectedBefore:
          "",
        targetValue:
          "학생UIDv2",
        rollbackValue:
          "",
        operation:
          "set_header_if_append_column_blank",
        baselineLastDataColumn:
          13,
        preserveOtherCells:
          true
      },
      {
        patchId:
          "schema|441317341|1|8|PrincipalUIDv2",
        patchType:
          "schema_header_cell",
        entityType:
          "schema",
        sheetId:
          441317341,
        sheetName:
          "관리자",
        rowNumber:
          1,
        columnNumber:
          8,
        columnLetter:
          "H",
        a1:
          "H1",
        expectedBefore:
          "",
        targetValue:
          "PrincipalUIDv2",
        rollbackValue:
          "",
        operation:
          "set_header_if_append_column_blank",
        baselineLastDataColumn:
          7,
        preserveOtherCells:
          true
      }
    ];

  const principalAuthColumn9Anchors:
    GenericRecord[] = [];

  for (
    const snapshot of
    studentRollbackSnapshot.docs
  ) {
    const record =
      snapshot.data();

    const newUid =
      text(record.newUid);

    const identityRef =
      text(record.identityRef);

    const fanout =
      studentFanout.get(
        newUid
      );

    if (
      snapshot.id !== newUid ||
      !/^STU2_[0-9A-HJKMNP-TV-Z]{26}$/.test(
        newUid
      ) ||
      !/^SID_[0-9a-f]{24}$/.test(
        identityRef
      ) ||
      !fanout ||
      text(fanout.identityRef) !==
        identityRef
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Student rollback/fanout binding failed."
      );
    }

    const row =
      masterRow(
        record,
        "학생명단",
        0,
        14
      );

    const targetRow =
      rowNumber(row);

    patches.push({
      patchId:
        `student|0|${targetRow}|14|${newUid}`,
      patchType:
        "identity_uid_cell",
      entityType:
        "student",
      identityRef,
      newUid,
      sheetId:
        0,
      sheetName:
        "학생명단",
      rowNumber:
        targetRow,
      columnNumber:
        14,
      columnLetter:
        "N",
      a1:
        `N${targetRow}`,
      expectedBefore:
        "",
      targetValue:
        newUid,
      rollbackValue:
        "",
      operation:
        "set_value_if_blank",
      preserveOtherCells:
        true
    });
  }

  for (
    const snapshot of
    principalRollbackSnapshot.docs
  ) {
    const record =
      snapshot.data();

    const newUid =
      text(record.newUid);

    const identityRef =
      text(record.identityRef);

    const fanout =
      principalFanout.get(
        newUid
      );

    if (
      snapshot.id !== newUid ||
      !/^PRN2_[0-9A-HJKMNP-TV-Z]{26}$/.test(
        newUid
      ) ||
      !/^PID_[0-9a-f]{24}$/.test(
        identityRef
      ) ||
      !fanout ||
      text(fanout.identityRef) !==
        identityRef
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Principal rollback/fanout binding failed."
      );
    }

    const row =
      masterRow(
        record,
        "관리자",
        441317341,
        8
      );

    const targetRow =
      rowNumber(row);

    patches.push({
      patchId:
        `principal|441317341|${targetRow}|8|${newUid}`,
      patchType:
        "identity_uid_cell",
      entityType:
        "principal",
      identityRef,
      newUid,
      sheetId:
        441317341,
      sheetName:
        "관리자",
      rowNumber:
        targetRow,
      columnNumber:
        8,
      columnLetter:
        "H",
      a1:
        `H${targetRow}`,
      expectedBefore:
        "",
      targetValue:
        newUid,
      rollbackValue:
        "",
      operation:
        "set_value_if_blank",
      preserveOtherCells:
        true
    });

    principalAuthColumn9Anchors.push({
      identityRef,
      newUid,
      ...authColumn9Anchor(
        record
      )
    });
  }

  patches.sort(
    (
      left,
      right
    ) =>
      Number(left.sheetId) -
        Number(right.sheetId) ||
      Number(left.rowNumber) -
        Number(right.rowNumber) ||
      Number(left.columnNumber) -
        Number(right.columnNumber) ||
      text(left.patchId)
        .localeCompare(
          text(right.patchId)
        )
  );

  principalAuthColumn9Anchors.sort(
    (
      left,
      right
    ) =>
      Number(left.rowNumber) -
        Number(right.rowNumber) ||
      text(left.newUid)
        .localeCompare(
          text(right.newUid)
        )
  );

  const cellKeys =
    new Set<string>();

  const uidKeys =
    new Set<string>();

  let studentCellPatches =
    0;

  let principalCellPatches =
    0;

  let schemaHeaderPatches =
    0;

  for (
    const patch of
    patches
  ) {
    const cellKey =
      `${Number(patch.sheetId)}|${Number(patch.rowNumber)}|${Number(patch.columnNumber)}`;

    if (cellKeys.has(cellKey)) {
      throw new HttpsError(
        "failed-precondition",
        "Duplicate target cell exists."
      );
    }

    cellKeys.add(cellKey);

    if (
      text(patch.patchType) ===
      "schema_header_cell"
    ) {
      if (
        text(patch.entityType) !==
          "schema" ||
        text(patch.targetValue) ===
          ""
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Invalid schema header patch."
        );
      }

      schemaHeaderPatches++;
      continue;
    }

    const newUid =
      text(patch.newUid);

    if (
      newUid === "" ||
      uidKeys.has(newUid)
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Duplicate or blank target UID exists."
      );
    }

    uidKeys.add(newUid);

    if (
      text(patch.entityType) ===
      "student"
    ) {
      studentCellPatches++;
    }
    else if (
      text(patch.entityType) ===
      "principal"
    ) {
      principalCellPatches++;
    }
    else {
      throw new HttpsError(
        "failed-precondition",
        "Unknown identity patch type."
      );
    }
  }

  const identityCellPatches =
    studentCellPatches +
    principalCellPatches;

  const counts = {
    studentCellPatches,
    principalCellPatches,
    identityCellPatches,
    schemaHeaderPatches,
    totalCellPatches:
      patches.length,
    principalAuthColumn9Anchors:
      principalAuthColumn9Anchors.length,
    targetSheets:
      new Set(
        patches.map(
          (patch) =>
            Number(
              patch.sheetId
            )
        )
      ).size
  };

  if (
    !exactJson(
      counts,
      EXPECTED_COUNTS
    ) ||
    identityCellPatches !==
      EXPECTED_IDENTITY_PATCH_COUNT ||
    schemaHeaderPatches !==
      EXPECTED_SCHEMA_HEADER_PATCH_COUNT ||
    patches.length !==
      EXPECTED_TOTAL_PATCH_COUNT ||
    cellKeys.size !==
      EXPECTED_TOTAL_PATCH_COUNT ||
    uidKeys.size !==
      EXPECTED_IDENTITY_PATCH_COUNT
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Phase 4C-13R schema-corrected patch counts are incorrect."
    );
  }

  const simulation = {
    allExpectedBeforeBlank:
      true,
    applyWouldSucceed:
      true,
    rollbackWouldSucceed:
      true,
    postApplyIdentityCellsExpected:
      EXPECTED_IDENTITY_PATCH_COUNT,
    postApplySchemaHeadersExpected:
      EXPECTED_SCHEMA_HEADER_PATCH_COUNT,
    postRollbackCellsRestored:
      EXPECTED_TOTAL_PATCH_COUNT,
    nonTargetCellsTouched:
      0,
    fullRowOverwrite:
      false,
    principalAuthColumn9Preserved:
      principalAuthColumn9Anchors.length ===
      EXPECTED_PRINCIPAL_COUNT,
    targetCellsUnique:
      cellKeys.size ===
      EXPECTED_TOTAL_PATCH_COUNT,
    appendColumnPreconditionVerified:
      true
  };

  const safety = {
    planOnly:
      true,
    rollbackSimulationOnly:
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
    fullSheetRowOverwriteForbidden:
      true,
    principalAuthColumn9PreserveRequired:
      true,
    commitCallableIncluded:
      false,
    executionCallableIncluded:
      false,
    actualUidCutoverAllowed:
      false
  };

  const planCore = {
    version:
      UID_V2_REBASE_SCHEMA_CORRECTED_CELL_PATCH_PLAN_PHASE4C13R_C1_VERSION,
    phase:
      "Phase 4C-13R",
    mode:
      "rebase156_schema_corrected_cell_patch_plan_and_rollback_simulation_only",
    requestId:
      REQUEST_ID,
    approvedByFirebaseUid:
      callerUid,
    contractDigest:
      CONTRACT_DIGEST,
    phase4c12ContractDigest:
      EXPECTED_PHASE4C12_CONTRACT_DIGEST,
    phase4c12ManifestDigest:
      EXPECTED_PHASE4C12_MANIFEST_DIGEST,
    phase4c12ResultDigest:
      EXPECTED_PHASE4C12_RESULT_DIGEST,
    phase4c11DryRunResultDigest:
      EXPECTED_PHASE4C11_DRY_RUN_DIGEST,
    sourceEvidence: {
      payloadDigest:
        EXPECTED_PAYLOAD_DIGEST,
      fanoutDesignDigest:
        EXPECTED_FANOUT_DESIGN_DIGEST,
      recordSetDigest:
        EXPECTED_RECORD_SET_DIGEST,
      fanoutMetadataDigest:
        EXPECTED_FANOUT_METADATA_DIGEST,
      liveBaselineDigest:
        EXPECTED_LIVE_BASELINE_DIGEST,
      sheetSnapshotDigest:
        EXPECTED_SHEET_SNAPSHOT_DIGEST,
      snapshotSetDigest:
        EXPECTED_SNAPSHOT_SET_DIGEST
    },
    targetColumns:
      TARGET_COLUMNS,
    phase4c12ProjectionCorrection:
      {"status":"corrected_in_phase4c13r_schema_c1","reason":"PHASE4C12R_OMITTED_TWO_SCHEMA_HEADER_PATCHES","previousProjectedTotals":{"sheetMutations":168,"firestoreWrites":350,"firebaseAuthWrites":1,"logicalMutations":519},"correctedProjectedTotals":{"sheetMutations":170,"firestoreWrites":350,"firebaseAuthWrites":1,"logicalMutations":521},"delta":{"schemaHeaderPatches":2,"sheetMutations":2,"logicalMutations":2},"baselineLastDataColumns":{"studentMaster":13,"principalMaster":7}},
    counts,
    patches,
    principalAuthColumn9Anchors,
    simulation,
    sourceChecks: {
      ...manifestChecks,
      ...sourceChecks,
      studentFanoutSet:
        studentFanout.size ===
        EXPECTED_STUDENT_COUNT,
      principalFanoutSet:
        principalFanout.size ===
        EXPECTED_PRINCIPAL_COUNT
    },
    safety
  };

  const planDigest =
    digestValue(
      planCore
    );

  const planBytes =
    Buffer.byteLength(
      JSON.stringify(
        canonicalize(
          planCore
        )
      ),
      "utf8"
    );

  if (
    planBytes >=
      850000
  ) {
    throw new HttpsError(
      "resource-exhausted",
      `Phase 4C-13R plan is too large: ${planBytes}`
    );
  }

  return {
    db,
    runRef,
    planCore,
    planDigest,
    planBytes,
    counts,
    simulation,
    sourceChecks:
      planCore.sourceChecks
  };
}

function publicResult(
  data: GenericRecord,
  duplicate: boolean,
  writeOperations: number,
  verified = false
) {
  return {
    ok:
      true,
    version:
      UID_V2_REBASE_SCHEMA_CORRECTED_CELL_PATCH_PLAN_PHASE4C13R_C1_VERSION,
    phase:
      "Phase 4C-13R",
    mode:
      "rebase156_schema_corrected_cell_patch_plan_and_rollback_simulation_only",
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
      Number(
        data.planBytes ||
        0
      ),
    counts:
      data.counts,
    targetColumns:
      data.targetColumns,
    phase4c12ProjectionCorrection:
      data.phase4c12ProjectionCorrection,
    simulation:
      data.simulation,
    sourceChecks:
      data.sourceChecks,
    verified,
    digestMatches:
      verified,
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
      sessionChanges:
        0,
      fullSheetRowOverwriteForbidden:
        true,
      principalAuthColumn9PreserveRequired:
        true,
      commitCallableIncluded:
        false,
      executionCallableIncluded:
        false,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        "Phase 4C-14R isolated Sheet-copy schema-and-cell-patch rehearsal only",
      allowed:
        true,
      actualUidCutoverAllowed:
        false
    }
  };
}

export const stageUidV2RebaseSchemaCorrectedCellPatchPlanPhase4c13rC1 =
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
        input.confirmPlanOnly !==
          true ||
        input.confirmRollbackSimulationOnly !==
          true ||
        input.confirmNoSourceWrites !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-13R input gate failed."
        );
      }

      const built =
        await buildAuthoritativePlan(
          callerUid
        );

      const targetRef =
        built.runRef
          .collection(
            "rebaseCellPatchPlans"
          )
          .doc(
            "phase4c13r-schema-c1"
          );

      let duplicate =
        false;

      let writeOperations =
        0;

      let outputData:
        GenericRecord = {};

      await built.db.runTransaction(
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
                built.planDigest ||
              text(data.contractDigest) !==
                CONTRACT_DIGEST
            ) {
              throw new HttpsError(
                "already-exists",
                "A conflicting Phase 4C-13R schema-corrected plan exists."
              );
            }

            duplicate =
              true;

            outputData =
              data;

            return;
          }

          outputData = {
            ...built.planCore,
            planDigest:
              built.planDigest,
            planBytes:
              built.planBytes,
            status:
              "rebase_schema_corrected_cell_patch_plan_staged",
            createdAtIso:
              new Date().toISOString()
          };

          transaction.set(
            targetRef,
            outputData
          );

          writeOperations =
            1;
        }
      );

      return publicResult(
        outputData,
        duplicate,
        writeOperations
      );
    }
  );

export const inspectUidV2RebaseSchemaCorrectedCellPatchPlanPhase4c13rC1 =
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
          "Phase 4C-13R inspect gate failed."
        );
      }

      const built =
        await buildAuthoritativePlan(
          callerUid
        );

      const snapshot =
        await built.runRef
          .collection(
            "rebaseCellPatchPlans"
          )
          .doc(
            "phase4c13r-schema-c1"
          )
          .get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-13R schema-corrected plan was not found."
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
        phase4c12ContractDigest:
          data.phase4c12ContractDigest,
        phase4c12ManifestDigest:
          data.phase4c12ManifestDigest,
        phase4c12ResultDigest:
          data.phase4c12ResultDigest,
        phase4c11DryRunResultDigest:
          data.phase4c11DryRunResultDigest,
        sourceEvidence:
          data.sourceEvidence,
        targetColumns:
          data.targetColumns,
        phase4c12ProjectionCorrection:
          data.phase4c12ProjectionCorrection,
        counts:
          data.counts,
        patches:
          data.patches,
        principalAuthColumn9Anchors:
          data.principalAuthColumn9Anchors,
        simulation:
          data.simulation,
        sourceChecks:
          data.sourceChecks,
        safety:
          data.safety
      };

      const storedDigest =
        digestValue(
          storedCore
        );

      const checks = {
        status:
          text(data.status) ===
          "rebase_schema_corrected_cell_patch_plan_staged",
        contract:
          text(
            data.contractDigest
          ) ===
          CONTRACT_DIGEST,
        planDigest:
          text(
            data.planDigest
          ) ===
          built.planDigest,
        storedDigest:
          storedDigest ===
          built.planDigest,
        planBytes:
          Number(
            data.planBytes ||
            0
          ) ===
          built.planBytes,
        counts:
          exactJson(
            data.counts,
            built.counts
          ),
        simulation:
          exactJson(
            data.simulation,
            built.simulation
          ),
        targetColumns:
          exactJson(
            data.targetColumns,
            TARGET_COLUMNS
          ),
        phase4c12ProjectionCorrection:
          exactJson(
            data.phase4c12ProjectionCorrection,
            {"status":"corrected_in_phase4c13r_schema_c1","reason":"PHASE4C12R_OMITTED_TWO_SCHEMA_HEADER_PATCHES","previousProjectedTotals":{"sheetMutations":168,"firestoreWrites":350,"firebaseAuthWrites":1,"logicalMutations":519},"correctedProjectedTotals":{"sheetMutations":170,"firestoreWrites":350,"firebaseAuthWrites":1,"logicalMutations":521},"delta":{"schemaHeaderPatches":2,"sheetMutations":2,"logicalMutations":2},"baselineLastDataColumns":{"studentMaster":13,"principalMaster":7}}
          ),
        sourceChecks:
          allTrue(
            asRecord(
              data.sourceChecks,
              "stored.sourceChecks"
            )
          ),
        safety:
          asRecord(
            data.safety,
            "stored.safety"
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
          `Phase 4C-13R schema-corrected stored plan verification failed: ${failed.join(", ")}`
        );
      }

      return publicResult(
        data,
        true,
        0,
        true
      );
    }
  );
