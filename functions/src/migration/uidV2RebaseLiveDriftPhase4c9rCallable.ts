import { createHash } from "node:crypto";
import {
  App,
  getApp,
  getApps,
  initializeApp
} from "firebase-admin/app";
import {
  UserRecord,
  getAuth
} from "firebase-admin/auth";
import {
  DocumentReference,
  DocumentSnapshot,
  Timestamp,
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_V2_REBASE_LIVE_DRIFT_PHASE4C9R_VERSION =
  "2026-07-27.716.49-phase4c9r-post-baseline-live-drift-audit-read-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "12d1fcf5aafe7c4ad453426e5d43e2b9a996dc8bc57be33b22e8d0734eff9f31";

const EXPECTED_PHASE4C8R_CONTRACT_DIGEST =
  "51b2108c9e350471f458f49af5eb06e3a4f304e8798fab87e4dedc67e8f32fa1";

const EXPECTED_LIVE_BASELINE_DIGEST =
  "5c397939a816bf5404ac869ad946a5e2a5308b961341e08fae5f236ceffde98b";

const EXPECTED_BASELINE_RAW_SHEET_DIGEST =
  "f37c0a0b984c9ce5392229acfe359c0cf57ed9e03faef458cb37718ea02c614c";

const EXPECTED_PAYLOAD_DIGEST =
  "748710b323521e64895d52548cbe1a0680bb02837579dd4079da9cff56f66288";

const EXPECTED_FANOUT_DESIGN_DIGEST =
  "bc11d7b0c94cc2a600d1b4202419f5cef14eadbfc172c2b59bbfc4f61d3eb65e";

const EXPECTED_PHASE4C5R_CONTRACT_DIGEST =
  "e3613acc1c03d352df591371aeba2a2ec1cd5a1a40d7c1a1de88ca57aa8d02c5";

const EXPECTED_PHASE4C7R_CONTRACT_DIGEST =
  "658dc5f19b1b6036c9b995607e1be305d239b74e67e47566e8472efb0be04135";

const EXPECTED_REHEARSAL_RESULT_DIGEST =
  "416db13b9958ec54952121ac0c0ee13512d942b6bf4a6ca38e54a56afb182c24";

const EXPECTED_RECORD_SET_DIGEST =
  "ec3fad78b2d29666497861f567ac38f2e864f34969516a2cda4c58d9102fb28c";

const EXPECTED_FANOUT_METADATA_DIGEST =
  "7afa4fc0804f768ab00e78e4c780b94e50ac34a3e69647bed4d7264aa7085105";

const EXPECTED_SNAPSHOT_SET_DIGEST =
  "6e2cd04e8f7fb82c16b825c373d27efb2abc44dc6356469085f39df2076c1840";

const EXPECTED_ALLOCATION_PLAN_DIGEST =
  "106041768420f52fd9090f0e09d7c6a18353371a67b6529e3c87a43a0d71faa9";

const EXPECTED_ELIGIBILITY_DIGEST =
  "407d5d09c0d22d54e86e553e283676e20d2eebe0c861129a9dfbce7ce799117f";

const EXPECTED_COUNTS =
  {"rollbackStudentRows":156,"rollbackPrincipalRows":12,"rollbackAttendanceDocuments":69,"rollbackAssignmentDocuments":14,"rollbackFirebaseAuthUsers":1,"inPlaceAttendancePlans":68} as const;

type GenericRecord =
  Record<string, unknown>;

interface InputData {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly currentSheetSnapshotDigest?: unknown;
  readonly currentSheetSnapshot?: unknown;
  readonly confirmReadOnlyAudit?: unknown;
  readonly confirmNoSourceWrites?: unknown;
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

function sameJson(
  left: unknown,
  right: unknown
): boolean {
  return (
    JSON.stringify(
      canonicalize(left)
    ) ===
    JSON.stringify(
      canonicalize(right)
    )
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

function serializeFirestoreValue(
  value: unknown
): unknown {
  if (
    value instanceof Timestamp
  ) {
    return {
      __type:
        "Timestamp",
      seconds:
        value.seconds,
      nanoseconds:
        value.nanoseconds
    };
  }

  if (
    value instanceof DocumentReference
  ) {
    return {
      __type:
        "DocumentReference",
      path:
        value.path
    };
  }

  if (Buffer.isBuffer(value)) {
    return {
      __type:
        "Bytes",
      base64:
        value.toString("base64")
    };
  }

  if (Array.isArray(value)) {
    return value.map(
      serializeFirestoreValue
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const candidate =
      value as GenericRecord;

    if (
      typeof candidate.latitude ===
        "number" &&
      typeof candidate.longitude ===
        "number"
    ) {
      return {
        __type:
          "GeoPoint",
        latitude:
          candidate.latitude,
        longitude:
          candidate.longitude
      };
    }

    const output:
      GenericRecord = {};

    for (
      const [
        key,
        nested
      ] of
      Object.entries(candidate)
    ) {
      output[key] =
        serializeFirestoreValue(
          nested
        );
    }

    return output;
  }

  return value;
}

function dataDigest(
  value: unknown
): string {
  return digestValue(
    serializeFirestoreValue(
      value
    )
  );
}

function authSnapshot(
  user: UserRecord
): GenericRecord {
  return {
    uid:
      user.uid,
    disabled:
      user.disabled,
    email:
      user.email || null,
    emailVerified:
      user.emailVerified,
    displayName:
      user.displayName || null,
    phoneNumber:
      user.phoneNumber || null,
    photoURL:
      user.photoURL || null,
    customClaims:
      user.customClaims || {},
    providerData:
      user.providerData.map(
        (provider) => ({
          uid:
            provider.uid,
          providerId:
            provider.providerId,
          email:
            provider.email || null,
          displayName:
            provider.displayName || null,
          phoneNumber:
            provider.phoneNumber || null,
          photoURL:
            provider.photoURL || null
        })
      ),
    stableMetadata: {
      creationTime:
        user.metadata.creationTime
    },
    tokensValidAfterTime:
      user.tokensValidAfterTime,
    passwordMaterialIncluded:
      false,
    rollbackPolicy:
      "re_enable_existing_old_user_restore_claims_before_retiring_new_user"
  };
}

async function userExists(
  uid: string
): Promise<boolean> {
  try {
    await getAuth(
      defaultAdminApp()
    ).getUser(uid);

    return true;
  } catch (error) {
    const code =
      text(
        (
          error as {
            code?: unknown;
          }
        ).code
      );

    if (
      code === "auth/user-not-found"
    ) {
      return false;
    }

    throw error;
  }
}

function omitStoredSheetFields(
  value: GenericRecord
): GenericRecord {
  const output:
    GenericRecord = {};

  for (
    const [
      key,
      nested
    ] of
    Object.entries(value)
  ) {
    if (
      key === "sheetSnapshotDigest" ||
      key === "rollbackSnapshotDigest" ||
      key === "actualUidCutoverAllowed"
    ) {
      continue;
    }

    output[key] =
      nested;
  }

  return output;
}

function normalizeVolatileRow(
  value: unknown
): unknown {
  const row =
    asRecord(
      value,
      "sheet row snapshot"
    );

  const output:
    GenericRecord = {
      ...row
    };

  const sheetName =
    text(
      row.sheetName
    ).replace(
      /\s+/g,
      ""
    );

  if (
    sheetName.includes(
      "관리자인증"
    )
  ) {
    for (
      const fieldName of
      [
        "rawValues",
        "displayValues",
        "formulas",
        "notes"
      ]
    ) {
      const current =
        row[fieldName];

      if (Array.isArray(current)) {
        const cloned =
          current.slice();

        if (cloned.length >= 9) {
          cloned[8] =
            "__VOLATILE_RECENT_LOGIN_VALUE__";
        }

        output[fieldName] =
          cloned;
      }
    }
  }

  return canonicalize(
    output
  );
}

function normalizeSheetIdentityRecord(
  value: unknown
): unknown {
  const record =
    asRecord(
      value,
      "sheet identity record"
    );

  const output:
    GenericRecord = {
      ...record
    };

  for (
    const fieldName of
    [
      "masterRows",
      "authRows"
    ]
  ) {
    const rows =
      record[fieldName];

    output[fieldName] =
      Array.isArray(rows)
        ? rows
            .map(
              normalizeVolatileRow
            )
            .sort(
              (
                left,
                right
              ) =>
                Number(
                  asRecord(
                    left,
                    "row"
                  ).rowNumber ||
                  0
                ) -
                Number(
                  asRecord(
                    right,
                    "row"
                  ).rowNumber ||
                  0
                )
            )
        : [];
  }

  return canonicalize(
    output
  );
}

function stableSheetSetDigest(
  values: unknown[]
): string {
  const normalized =
    values
      .map(
        normalizeSheetIdentityRecord
      )
      .sort(
        (
          left,
          right
        ) =>
          text(
            asRecord(
              left,
              "identity"
            ).newUid
          ).localeCompare(
            text(
              asRecord(
                right,
                "identity"
              ).newUid
            )
          )
      );

  return digestValue(
    normalized
  );
}

function validateCurrentSheetSnapshot(
  value: unknown,
  digestText: unknown
): {
  readonly snapshot: GenericRecord;
  readonly currentDigest: string;
  readonly students: unknown[];
  readonly principals: unknown[];
} {
  const snapshot =
    asRecord(
      value,
      "currentSheetSnapshot"
    );

  const currentDigest =
    digestValue(
      snapshot
    );

  const students =
    asArray(
      snapshot.students,
      "currentSheetSnapshot.students"
    );

  const principals =
    asArray(
      snapshot.principals,
      "currentSheetSnapshot.principals"
    );

  const counts =
    asRecord(
      snapshot.counts,
      "currentSheetSnapshot.counts"
    );

  const safety =
    asRecord(
      snapshot.safety,
      "currentSheetSnapshot.safety"
    );

  const checks:
    GenericRecord = {
    envelopeDigest:
      currentDigest ===
      text(digestText),
    requestId:
      text(
        snapshot.requestId
      ) ===
      REQUEST_ID,
    contract:
      text(
        snapshot.contractDigest
      ) ===
      EXPECTED_PHASE4C8R_CONTRACT_DIGEST,
    allocationPlan:
      text(
        snapshot.allocationPlanDigest
      ) ===
      EXPECTED_ALLOCATION_PLAN_DIGEST,
    eligibility:
      text(
        snapshot.eligibilityDigest
      ) ===
      EXPECTED_ELIGIBILITY_DIGEST,
    rehearsal:
      text(
        snapshot.phase4c7rRehearsalResultDigest
      ) ===
      EXPECTED_REHEARSAL_RESULT_DIGEST,
    studentCount:
      students.length ===
        EXPECTED_COUNTS
          .rollbackStudentRows &&
      Number(
        counts.rollbackStudentRows ||
        0
      ) ===
        EXPECTED_COUNTS
          .rollbackStudentRows,
    principalCount:
      principals.length ===
        EXPECTED_COUNTS
          .rollbackPrincipalRows &&
      Number(
        counts.rollbackPrincipalRows ||
        0
      ) ===
        EXPECTED_COUNTS
          .rollbackPrincipalRows,
    safety:
      Number(
        safety.sourceSheetWrites ||
        0
      ) ===
        0 &&
      Number(
        safety.firestoreWrites ||
        0
      ) ===
        0 &&
      Number(
        safety.firebaseAuthWrites ||
        0
      ) ===
        0 &&
      safety.actualUidCutoverAllowed ===
        false
  };

  if (!allTrue(checks)) {
    const failedChecks =
      Object.entries(checks)
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
      `Phase 4C-9R current Sheet snapshot validation failed: ${failedChecks.join(", ")}`,
      {
        failedChecks
      }
    );
  }

  return {
    snapshot,
    currentDigest,
    students,
    principals
  };
}

export const auditUidV2RebaseLiveDriftPhase4c9r =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        540,
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
        typeof request.data === "object"
          ? request.data as InputData
          : {};

      if (
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          CONTRACT_DIGEST ||
        input.confirmReadOnlyAudit !==
          true ||
        input.confirmNoSourceWrites !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-9R input gate failed."
        );
      }

      const currentSheet =
        validateCurrentSheetSnapshot(
          input.currentSheetSnapshot,
          input.currentSheetSnapshotDigest
        );

      const app =
        defaultAdminApp();

      const db =
        getFirestore(app);

      const auth =
        getAuth(app);

      const runRef =
        db.collection(
          "uidV2StagingRuns"
        ).doc(
          REQUEST_ID
        );

      const [
        baselineMetaSnapshot,
        rollbackStudentRows,
        rollbackPrincipalRows,
        rollbackAttendance,
        rollbackAssignments,
        rollbackAuthUsers,
        inPlacePlans,
        attendanceMappings,
        fanoutMetadataSnapshot,
        rehearsalResultSnapshot
      ] =
        await Promise.all([
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
              "rollbackAttendanceDocuments"
            )
            .get(),
          runRef
            .collection(
              "rollbackAssignmentDocuments"
            )
            .get(),
          runRef
            .collection(
              "rollbackFirebaseAuthUsers"
            )
            .get(),
          runRef
            .collection(
              "inPlaceAttendancePlans"
            )
            .get(),
          runRef
            .collection(
              "rebaseFanoutAttendanceMappings"
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
              "rebaseRehearsalResults"
            )
            .doc(
              "phase4c7r"
            )
            .get()
        ]);

      if (
        !baselineMetaSnapshot.exists ||
        !fanoutMetadataSnapshot.exists ||
        !rehearsalResultSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-8R baseline or prior chain metadata is missing."
        );
      }

      const baselineMeta =
        baselineMetaSnapshot.data() ||
        {};

      const fanoutMetadata =
        fanoutMetadataSnapshot.data() ||
        {};

      const rehearsalResult =
        rehearsalResultSnapshot.data() ||
        {};

      const metadataChecks:
        GenericRecord = {
        baselineStatus:
          text(
            baselineMeta.status
          ) ===
          "rebase_live_baseline_staged",
        baselineCaller:
          text(
            baselineMeta.approvedByFirebaseUid
          ) ===
          callerUid,
        baselineContract:
          text(
            baselineMeta.liveBaselineContractDigest
          ) ===
          EXPECTED_PHASE4C8R_CONTRACT_DIGEST,
        baselineDigest:
          text(
            baselineMeta.rollbackSnapshotDigest
          ) ===
          EXPECTED_LIVE_BASELINE_DIGEST,
        baselineRawSheetDigest:
          text(
            baselineMeta.sheetSnapshotDigest
          ) ===
          EXPECTED_BASELINE_RAW_SHEET_DIGEST,
        payload:
          text(
            baselineMeta.payloadDigest
          ) ===
          EXPECTED_PAYLOAD_DIGEST,
        fanoutDesign:
          text(
            baselineMeta.fanoutDesignDigest
          ) ===
          EXPECTED_FANOUT_DESIGN_DIGEST,
        phase4c5rContract:
          text(
            baselineMeta.phase4c5rContractDigest
          ) ===
          EXPECTED_PHASE4C5R_CONTRACT_DIGEST,
        phase4c7rContract:
          text(
            baselineMeta.phase4c7rContractDigest
          ) ===
          EXPECTED_PHASE4C7R_CONTRACT_DIGEST,
        rehearsal:
          text(
            baselineMeta.rehearsalResultDigest
          ) ===
          EXPECTED_REHEARSAL_RESULT_DIGEST,
        recordSet:
          text(
            baselineMeta.sourceRecordSetDigest
          ) ===
          EXPECTED_RECORD_SET_DIGEST,
        fanoutMetadata:
          text(
            baselineMeta.sourceMetadataDigest
          ) ===
          EXPECTED_FANOUT_METADATA_DIGEST,
        snapshotSet:
          text(
            baselineMeta.snapshotSetDigest
          ) ===
          EXPECTED_SNAPSHOT_SET_DIGEST,
        counts:
          sameJson(
            baselineMeta.counts,
            EXPECTED_COUNTS
          ),
        writes:
          Number(
            baselineMeta.dataRecordWrites ||
            0
          ) ===
            320 &&
          Number(
            baselineMeta.totalIsolatedWrites ||
            0
          ) ===
            321 &&
          Number(
            baselineMeta.sourceDataWrites ||
            0
          ) ===
            0,
        cutoverBlocked:
          baselineMeta.actualUidCutoverAllowed ===
          false,
        fanoutChain:
          text(
            fanoutMetadata.contractDigest
          ) ===
            EXPECTED_PHASE4C5R_CONTRACT_DIGEST &&
          text(
            fanoutMetadata.metadataDigest
          ) ===
            EXPECTED_FANOUT_METADATA_DIGEST &&
          text(
            fanoutMetadata.recordSetDigest
          ) ===
            EXPECTED_RECORD_SET_DIGEST &&
          text(
            fanoutMetadata.status
          ) ===
            "rebase_isolated_fanout_verified",
        rehearsalChain:
          text(
            rehearsalResult.contractDigest
          ) ===
            EXPECTED_PHASE4C7R_CONTRACT_DIGEST &&
          text(
            rehearsalResult.rehearsalResultDigest
          ) ===
            EXPECTED_REHEARSAL_RESULT_DIGEST &&
          text(
            rehearsalResult.afterSetDigest
          ) ===
            EXPECTED_SNAPSHOT_SET_DIGEST &&
          rehearsalResult.postRestoreVerified ===
            true
      };

      const countChecks:
        GenericRecord = {
        rollbackStudentRows:
          rollbackStudentRows.size ===
          EXPECTED_COUNTS
            .rollbackStudentRows,
        rollbackPrincipalRows:
          rollbackPrincipalRows.size ===
          EXPECTED_COUNTS
            .rollbackPrincipalRows,
        rollbackAttendanceDocuments:
          rollbackAttendance.size ===
          EXPECTED_COUNTS
            .rollbackAttendanceDocuments,
        rollbackAssignmentDocuments:
          rollbackAssignments.size ===
          EXPECTED_COUNTS
            .rollbackAssignmentDocuments,
        rollbackFirebaseAuthUsers:
          rollbackAuthUsers.size ===
          EXPECTED_COUNTS
            .rollbackFirebaseAuthUsers,
        inPlaceAttendancePlans:
          inPlacePlans.size ===
          EXPECTED_COUNTS
            .inPlaceAttendancePlans,
        attendanceMappings:
          attendanceMappings.size ===
          1
      };

      const baselineStudentRecords =
        rollbackStudentRows.docs
          .map(
            (document) => {
              const data =
                document.data();

              const valid =
                text(
                  data.sheetSnapshotDigest
                ) ===
                  EXPECTED_BASELINE_RAW_SHEET_DIGEST &&
                text(
                  data.rollbackSnapshotDigest
                ) ===
                  EXPECTED_LIVE_BASELINE_DIGEST &&
                data.actualUidCutoverAllowed ===
                  false;

              if (!valid) {
                throw new HttpsError(
                  "data-loss",
                  `Invalid student baseline record: ${document.id}`
                );
              }

              return omitStoredSheetFields(
                data
              );
            }
          );

      const baselinePrincipalRecords =
        rollbackPrincipalRows.docs
          .map(
            (document) => {
              const data =
                document.data();

              const valid =
                text(
                  data.sheetSnapshotDigest
                ) ===
                  EXPECTED_BASELINE_RAW_SHEET_DIGEST &&
                text(
                  data.rollbackSnapshotDigest
                ) ===
                  EXPECTED_LIVE_BASELINE_DIGEST &&
                data.actualUidCutoverAllowed ===
                  false;

              if (!valid) {
                throw new HttpsError(
                  "data-loss",
                  `Invalid Principal baseline record: ${document.id}`
                );
              }

              return omitStoredSheetFields(
                data
              );
            }
          );

      const baselineStudentStableDigest =
        stableSheetSetDigest(
          baselineStudentRecords
        );

      const currentStudentStableDigest =
        stableSheetSetDigest(
          currentSheet.students
        );

      const baselinePrincipalStableDigest =
        stableSheetSetDigest(
          baselinePrincipalRecords
        );

      const currentPrincipalStableDigest =
        stableSheetSetDigest(
          currentSheet.principals
        );

      const sheetChecks:
        GenericRecord = {
        studentsStable:
          baselineStudentStableDigest ===
          currentStudentStableDigest,
        principalsStable:
          baselinePrincipalStableDigest ===
          currentPrincipalStableDigest
      };

      const attendanceSourceRefs =
        rollbackAttendance.docs.map(
          (document) =>
            db.doc(
              text(
                document.data().sourcePath
              )
            )
        );

      const attendanceSourceSnapshots =
        attendanceSourceRefs.length > 0
          ? await db.getAll(
              ...attendanceSourceRefs
            )
          : [];

      const attendanceByPath =
        new Map<string, DocumentSnapshot>(
          attendanceSourceSnapshots.map(
            (snapshot) => [
              snapshot.ref.path,
              snapshot
            ]
          )
        );

      const attendanceChecks:
        GenericRecord[] = [];

      for (
        const document of
        rollbackAttendance.docs
      ) {
        const rollback =
          document.data();

        const sourcePath =
          text(
            rollback.sourcePath
          );

        const source =
          attendanceByPath.get(
            sourcePath
          );

        attendanceChecks.push({
          id:
            document.id,
          sourceExists:
            source?.exists ===
            true,
          beforeDigestMatches:
            source?.exists ===
              true &&
            dataDigest(
              source.data() || {}
            ) ===
            text(
              rollback.beforeDigest
            ),
          baselineBound:
            text(
              rollback.rollbackSnapshotDigest
            ) ===
            EXPECTED_LIVE_BASELINE_DIGEST
        });
      }

      const inPlaceChecks:
        GenericRecord[] = [];

      for (
        const document of
        inPlacePlans.docs
      ) {
        const plan =
          document.data();

        const source =
          attendanceByPath.get(
            text(
              plan.sourcePath
            )
          );

        const patch =
          plan.patch &&
          typeof plan.patch ===
            "object" &&
          !Array.isArray(plan.patch)
            ? plan.patch as GenericRecord
            : {};

        inPlaceChecks.push({
          id:
            document.id,
          sourceExists:
            source?.exists ===
            true,
          beforeDigestMatches:
            source?.exists ===
              true &&
            dataDigest(
              source.data() || {}
            ) ===
            text(
              plan.beforeDigest
            ),
          patchPresent:
            Object.keys(patch)
              .length > 0,
          changedFieldCountValid:
            Number(
              plan.changedFieldCount ||
              0
            ) > 0,
          baselineBound:
            text(
              plan.rollbackSnapshotDigest
            ) ===
            EXPECTED_LIVE_BASELINE_DIGEST
        });
      }

      const assignmentChecks:
        GenericRecord[] = [];

      const assignmentRefs:
        DocumentReference[] = [];

      for (
        const document of
        rollbackAssignments.docs
      ) {
        const data =
          document.data();

        assignmentRefs.push(
          db.doc(
            text(
              data.sourcePath
            )
          ),
          db.doc(
            text(
              data.targetPath
            )
          )
        );
      }

      const assignmentSnapshots =
        assignmentRefs.length > 0
          ? await db.getAll(
              ...assignmentRefs
            )
          : [];

      const assignmentByPath =
        new Map<string, DocumentSnapshot>(
          assignmentSnapshots.map(
            (snapshot) => [
              snapshot.ref.path,
              snapshot
            ]
          )
        );

      for (
        const document of
        rollbackAssignments.docs
      ) {
        const rollback =
          document.data();

        const source =
          assignmentByPath.get(
            text(
              rollback.sourcePath
            )
          );

        const target =
          assignmentByPath.get(
            text(
              rollback.targetPath
            )
          );

        assignmentChecks.push({
          id:
            document.id,
          sourceExists:
            source?.exists ===
            true,
          targetAbsent:
            target?.exists ===
            false,
          beforeDigestMatches:
            source?.exists ===
              true &&
            dataDigest(
              source.data() || {}
            ) ===
            text(
              rollback.beforeDigest
            ),
          baselineBound:
            text(
              rollback.rollbackSnapshotDigest
            ) ===
            EXPECTED_LIVE_BASELINE_DIGEST
        });
      }

      const mappingDocument =
        attendanceMappings.docs[0];

      const mappingWrapper =
        mappingDocument
          ? mappingDocument.data()
          : {};

      const mapping =
        asRecord(
          mappingWrapper.data,
          "attendance mapping"
        );

      const cloneSourcePath =
        text(
          mapping.oldPath
        );

      const cloneTargetPath =
        text(
          mapping.newPath
        );

      const cloneSource =
        attendanceByPath.get(
          cloneSourcePath
        );

      const cloneTarget =
        cloneTargetPath
          ? await db.doc(
              cloneTargetPath
            ).get()
          : null;

      const cloneChecks:
        GenericRecord = {
        mappingPresent:
          attendanceMappings.size ===
          1,
        sourceExists:
          cloneSource?.exists ===
          true,
        targetAbsent:
          cloneTarget?.exists ===
          false
      };

      const authChecks:
        GenericRecord[] = [];

      for (
        const document of
        rollbackAuthUsers.docs
      ) {
        const rollback =
          document.data();

        const sourceUid =
          text(
            rollback.sourceFirebaseUid
          );

        const targetUid =
          text(
            rollback.targetFirebaseUid
          );

        const sourceUser =
          await auth.getUser(
            sourceUid
          );

        authChecks.push({
          id:
            document.id,
          sourceExists:
            true,
          targetAbsent:
            !(
              await userExists(
                targetUid
              )
            ),
          beforeDigestMatches:
            dataDigest(
              authSnapshot(
                sourceUser
              )
            ) ===
            dataDigest(
              rollback.beforeData
            ),
          passwordMaterialExcluded:
            (
              rollback.beforeData as GenericRecord
            )?.passwordMaterialIncluded ===
            false,
          baselineBound:
            text(
              rollback.rollbackSnapshotDigest
            ) ===
            EXPECTED_LIVE_BASELINE_DIGEST
        });
      }

      const attendanceStable =
        attendanceChecks.every(
          (item) =>
            item.sourceExists ===
              true &&
            item.beforeDigestMatches ===
              true &&
            item.baselineBound ===
              true
        );

      const inPlaceStable =
        inPlaceChecks.every(
          (item) =>
            item.sourceExists ===
              true &&
            item.beforeDigestMatches ===
              true &&
            item.patchPresent ===
              true &&
            item.changedFieldCountValid ===
              true &&
            item.baselineBound ===
              true
        );

      const assignmentStable =
        assignmentChecks.every(
          (item) =>
            item.sourceExists ===
              true &&
            item.targetAbsent ===
              true &&
            item.beforeDigestMatches ===
              true &&
            item.baselineBound ===
              true
        );

      const authStable =
        authChecks.length ===
          1 &&
        authChecks.every(
          (item) =>
            item.sourceExists ===
              true &&
            item.targetAbsent ===
              true &&
            item.beforeDigestMatches ===
              true &&
            item.passwordMaterialExcluded ===
              true &&
            item.baselineBound ===
              true
        );

      const failedMetadata =
        Object.entries(
          metadataChecks
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

      const failedCounts =
        Object.entries(
          countChecks
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

      const failedSheet =
        Object.entries(
          sheetChecks
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

      const blockingReasons:
        string[] = [];

      if (
        failedMetadata.length > 0
      ) {
        blockingReasons.push(
          "BASELINE_METADATA_DRIFT"
        );
      }

      if (
        failedCounts.length > 0
      ) {
        blockingReasons.push(
          "BASELINE_COUNT_DRIFT"
        );
      }

      if (
        failedSheet.length > 0
      ) {
        blockingReasons.push(
          "SHEET_STABLE_FIELD_DRIFT"
        );
      }

      if (!attendanceStable) {
        blockingReasons.push(
          "ATTENDANCE_SOURCE_DRIFT"
        );
      }

      if (!inPlaceStable) {
        blockingReasons.push(
          "IN_PLACE_ATTENDANCE_PLAN_DRIFT"
        );
      }

      if (!assignmentStable) {
        blockingReasons.push(
          "ASSIGNMENT_SOURCE_DRIFT_OR_TARGET_COLLISION"
        );
      }

      if (!allTrue(cloneChecks)) {
        blockingReasons.push(
          "ATTENDANCE_CLONE_TARGET_COLLISION"
        );
      }

      if (!authStable) {
        blockingReasons.push(
          "FIREBASE_AUTH_SOURCE_DRIFT_OR_TARGET_COLLISION"
        );
      }

      const readyForServerApproval =
        blockingReasons.length ===
        0;

      const auditCore:
        GenericRecord = {
        version:
          UID_V2_REBASE_LIVE_DRIFT_PHASE4C9R_VERSION,
        phase:
          "Phase 4C-9R",
        mode:
          "rebase156_post_baseline_live_drift_audit_read_only",
        requestId:
          REQUEST_ID,
        contractDigest:
          CONTRACT_DIGEST,
        liveBaselineDigest:
          EXPECTED_LIVE_BASELINE_DIGEST,
        baselineRawSheetSnapshotDigest:
          EXPECTED_BASELINE_RAW_SHEET_DIGEST,
        currentRawSheetSnapshotDigest:
          currentSheet.currentDigest,
        rawSheetSnapshotMatchesBaseline:
          currentSheet.currentDigest ===
          EXPECTED_BASELINE_RAW_SHEET_DIGEST,
        baselineStudentStableDigest,
        currentStudentStableDigest,
        baselinePrincipalStableDigest,
        currentPrincipalStableDigest,
        ignoredVolatileSheetFields: [
          "관리자인증 column 9 recent-login value"
        ],
        metadataChecks,
        countChecks,
        sheetChecks,
        attendance: {
          count:
            attendanceChecks.length,
          stable:
            attendanceStable,
          failed:
            attendanceChecks
              .filter(
                (item) =>
                  item.sourceExists !==
                    true ||
                  item.beforeDigestMatches !==
                    true ||
                  item.baselineBound !==
                    true
              )
              .map(
                (item) =>
                  item.id
              )
        },
        inPlaceAttendance: {
          count:
            inPlaceChecks.length,
          stable:
            inPlaceStable,
          failed:
            inPlaceChecks
              .filter(
                (item) =>
                  item.sourceExists !==
                    true ||
                  item.beforeDigestMatches !==
                    true ||
                  item.patchPresent !==
                    true ||
                  item.changedFieldCountValid !==
                    true ||
                  item.baselineBound !==
                    true
              )
              .map(
                (item) =>
                  item.id
              )
        },
        assignments: {
          count:
            assignmentChecks.length,
          stable:
            assignmentStable,
          failed:
            assignmentChecks
              .filter(
                (item) =>
                  item.sourceExists !==
                    true ||
                  item.targetAbsent !==
                    true ||
                  item.beforeDigestMatches !==
                    true ||
                  item.baselineBound !==
                    true
              )
              .map(
                (item) =>
                  item.id
              )
        },
        attendanceClone: {
          count:
            attendanceMappings.size,
          stable:
            allTrue(
              cloneChecks
            ),
          checks:
            cloneChecks
        },
        firebaseAuth: {
          count:
            authChecks.length,
          stable:
            authStable,
          failed:
            authChecks
              .filter(
                (item) =>
                  item.sourceExists !==
                    true ||
                  item.targetAbsent !==
                    true ||
                  item.beforeDigestMatches !==
                    true ||
                  item.passwordMaterialExcluded !==
                    true ||
                  item.baselineBound !==
                    true
              )
              .map(
                (item) =>
                  item.id
              )
        },
        blockingReasons,
        readyForServerApproval
      };

      const liveAuditDigest =
        digestValue(
          auditCore
        );

      return {
        ok:
          true,
        ...auditCore,
        liveAuditDigest,
        writeOperations:
          0,
        failedMetadata,
        failedCounts,
        failedSheet,
        safety: {
          firestoreWrites:
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
          approvalRecordWrites:
            0,
          commitCallableIncluded:
            false,
          sheetStableDigestUsed:
            true,
          ignoredVolatileRecentLoginValue:
            true,
          actualUidCutoverAllowed:
            false
        },
        nextGate: {
          phase:
            "Phase 4C-10R ten-minute server approval record only",
          allowed:
            readyForServerApproval,
          actualUidCutoverAllowed:
            false
        }
      };
    }
  );
