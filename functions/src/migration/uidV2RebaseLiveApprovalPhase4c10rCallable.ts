import { createHash } from "node:crypto";
import {
  App,
  getApp,
  getApps,
  initializeApp
} from "firebase-admin/app";
import {
  Timestamp,
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_V2_REBASE_APPROVAL_PHASE4C10R_VERSION =
  "2026-07-27.716.50-phase4c10r-ten-minute-server-approval-record-only";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "8a3c422d0e79a05b073f33c529e7b9cad214f54a999321c65e300165a1e16948";

const EXPECTED_PHASE4C9R_CONTRACT_DIGEST =
  "12d1fcf5aafe7c4ad453426e5d43e2b9a996dc8bc57be33b22e8d0734eff9f31";

const EXPECTED_PHASE4C8R_CONTRACT_DIGEST =
  "51b2108c9e350471f458f49af5eb06e3a4f304e8798fab87e4dedc67e8f32fa1";

const EXPECTED_PHASE4C7R_CONTRACT_DIGEST =
  "658dc5f19b1b6036c9b995607e1be305d239b74e67e47566e8472efb0be04135";

const EXPECTED_LIVE_BASELINE_DIGEST =
  "5c397939a816bf5404ac869ad946a5e2a5308b961341e08fae5f236ceffde98b";

const EXPECTED_LIVE_AUDIT_DIGEST =
  "7768b791be2d1161bbf3676c23f5263a2f0326123a0f99a0c505c2787c8f3e0c";

const EXPECTED_REHEARSAL_RESULT_DIGEST =
  "416db13b9958ec54952121ac0c0ee13512d942b6bf4a6ca38e54a56afb182c24";

const EXPECTED_BASELINE_RAW_SHEET_DIGEST =
  "f37c0a0b984c9ce5392229acfe359c0cf57ed9e03faef458cb37718ea02c614c";

const EXPECTED_CURRENT_RAW_SHEET_DIGEST =
  "f37c0a0b984c9ce5392229acfe359c0cf57ed9e03faef458cb37718ea02c614c";

const APPROVAL_WINDOW_MS =
  600000;

type GenericRecord =
  Record<string, unknown>;

interface ArmInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmTenMinuteApproval?: unknown;
  readonly confirmAuditBoundApproval?: unknown;
  readonly confirmNoSourceWrites?: unknown;
  readonly auditResult?: unknown;
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
  const record =
    asRecord(
      value,
      label
    );

  return allTrue(record);
}

function auditCore(
  data: GenericRecord
) {
  return {
    version:
      data.version,
    phase:
      data.phase,
    mode:
      data.mode,
    requestId:
      data.requestId,
    contractDigest:
      data.contractDigest,
    liveBaselineDigest:
      data.liveBaselineDigest,
    baselineRawSheetSnapshotDigest:
      data.baselineRawSheetSnapshotDigest,
    currentRawSheetSnapshotDigest:
      data.currentRawSheetSnapshotDigest,
    rawSheetSnapshotMatchesBaseline:
      data.rawSheetSnapshotMatchesBaseline,
    baselineStudentStableDigest:
      data.baselineStudentStableDigest,
    currentStudentStableDigest:
      data.currentStudentStableDigest,
    baselinePrincipalStableDigest:
      data.baselinePrincipalStableDigest,
    currentPrincipalStableDigest:
      data.currentPrincipalStableDigest,
    ignoredVolatileSheetFields:
      data.ignoredVolatileSheetFields,
    metadataChecks:
      data.metadataChecks,
    countChecks:
      data.countChecks,
    sheetChecks:
      data.sheetChecks,
    attendance:
      data.attendance,
    inPlaceAttendance:
      data.inPlaceAttendance,
    assignments:
      data.assignments,
    attendanceClone:
      data.attendanceClone,
    firebaseAuth:
      data.firebaseAuth,
    blockingReasons:
      data.blockingReasons,
    readyForServerApproval:
      data.readyForServerApproval
  };
}

function approvalCore(
  data: GenericRecord
) {
  return {
    version:
      data.version,
    phase:
      data.phase,
    mode:
      data.mode,
    requestId:
      data.requestId,
    contractDigest:
      data.contractDigest,
    phase4c9rContractDigest:
      data.phase4c9rContractDigest,
    phase4c8rContractDigest:
      data.phase4c8rContractDigest,
    phase4c7rContractDigest:
      data.phase4c7rContractDigest,
    liveBaselineDigest:
      data.liveBaselineDigest,
    liveAuditDigest:
      data.liveAuditDigest,
    rehearsalResultDigest:
      data.rehearsalResultDigest,
    baselineRawSheetDigest:
      data.baselineRawSheetDigest,
    currentRawSheetDigest:
      data.currentRawSheetDigest,
    approvedByFirebaseUid:
      data.approvedByFirebaseUid,
    generation:
      data.generation,
    armedAtIso:
      data.armedAtIso,
    expiresAtIso:
      data.expiresAtIso,
    approvalWindowSeconds:
      data.approvalWindowSeconds,
    auditSummary:
      data.auditSummary,
    status:
      data.status,
    safety:
      data.safety
  };
}

function timestampMillis(
  value: unknown
): number {
  return value instanceof Timestamp
    ? value.toMillis()
    : 0;
}

function validateAuditResult(
  value: unknown
): GenericRecord {
  const audit =
    asRecord(
      value,
      "auditResult"
    );

  const metadataChecks =
    asRecord(
      audit.metadataChecks,
      "auditResult.metadataChecks"
    );

  const countChecks =
    asRecord(
      audit.countChecks,
      "auditResult.countChecks"
    );

  const sheetChecks =
    asRecord(
      audit.sheetChecks,
      "auditResult.sheetChecks"
    );

  const attendance =
    asRecord(
      audit.attendance,
      "auditResult.attendance"
    );

  const inPlaceAttendance =
    asRecord(
      audit.inPlaceAttendance,
      "auditResult.inPlaceAttendance"
    );

  const assignments =
    asRecord(
      audit.assignments,
      "auditResult.assignments"
    );

  const attendanceClone =
    asRecord(
      audit.attendanceClone,
      "auditResult.attendanceClone"
    );

  const attendanceCloneChecks =
    asRecord(
      attendanceClone.checks,
      "auditResult.attendanceClone.checks"
    );

  const firebaseAuth =
    asRecord(
      audit.firebaseAuth,
      "auditResult.firebaseAuth"
    );

  const safety =
    asRecord(
      audit.safety,
      "auditResult.safety"
    );

  const calculatedAuditDigest =
    digestValue(
      auditCore(
        audit
      )
    );

  const checks:
    GenericRecord = {
    ok:
      audit.ok === true,
    phase:
      text(
        audit.phase
      ) ===
      "Phase 4C-9R",
    mode:
      text(
        audit.mode
      ) ===
      "rebase156_post_baseline_live_drift_audit_read_only",
    requestId:
      text(
        audit.requestId
      ) ===
      REQUEST_ID,
    contract:
      text(
        audit.contractDigest
      ) ===
      EXPECTED_PHASE4C9R_CONTRACT_DIGEST,
    liveBaseline:
      text(
        audit.liveBaselineDigest
      ) ===
      EXPECTED_LIVE_BASELINE_DIGEST,
    baselineRawSheet:
      text(
        audit.baselineRawSheetSnapshotDigest
      ) ===
      EXPECTED_BASELINE_RAW_SHEET_DIGEST,
    currentRawSheet:
      text(
        audit.currentRawSheetSnapshotDigest
      ) ===
      EXPECTED_CURRENT_RAW_SHEET_DIGEST,
    rawSheetMatch:
      audit.rawSheetSnapshotMatchesBaseline ===
      true,
    auditDigest:
      text(
        audit.liveAuditDigest
      ) ===
        calculatedAuditDigest &&
      calculatedAuditDigest ===
        EXPECTED_LIVE_AUDIT_DIGEST,
    studentStableDigest:
      text(
        audit.baselineStudentStableDigest
      ) ===
      text(
        audit.currentStudentStableDigest
      ),
    principalStableDigest:
      text(
        audit.baselinePrincipalStableDigest
      ) ===
      text(
        audit.currentPrincipalStableDigest
      ),
    metadataChecks:
      allTrue(
        metadataChecks
      ),
    countChecks:
      allTrue(
        countChecks
      ),
    sheetChecks:
      sheetChecks.studentsStable ===
        true &&
      sheetChecks.principalsStable ===
        true,
    attendance:
      Number(
        attendance.count ||
        0
      ) ===
        69 &&
      attendance.stable ===
        true &&
      asArray(
        attendance.failed,
        "attendance.failed"
      ).length ===
        0,
    inPlaceAttendance:
      Number(
        inPlaceAttendance.count ||
        0
      ) ===
        68 &&
      inPlaceAttendance.stable ===
        true &&
      asArray(
        inPlaceAttendance.failed,
        "inPlaceAttendance.failed"
      ).length ===
        0,
    assignments:
      Number(
        assignments.count ||
        0
      ) ===
        14 &&
      assignments.stable ===
        true &&
      asArray(
        assignments.failed,
        "assignments.failed"
      ).length ===
        0,
    attendanceClone:
      Number(
        attendanceClone.count ||
        0
      ) ===
        1 &&
      attendanceClone.stable ===
        true &&
      allTrue(
        attendanceCloneChecks
      ),
    firebaseAuth:
      Number(
        firebaseAuth.count ||
        0
      ) ===
        1 &&
      firebaseAuth.stable ===
        true &&
      asArray(
        firebaseAuth.failed,
        "firebaseAuth.failed"
      ).length ===
        0,
    blockingReasons:
      asArray(
        audit.blockingReasons,
        "blockingReasons"
      ).length ===
      0,
    ready:
      audit.readyForServerApproval ===
      true,
    noWrite:
      Number(
        audit.writeOperations ||
        0
      ) ===
        0 &&
      Number(
        safety.firestoreWrites ||
        0
      ) ===
        0 &&
      Number(
        safety.sourceSheetWrites ||
        0
      ) ===
        0 &&
      Number(
        safety.activeUidRegistryWrites ||
        0
      ) ===
        0 &&
      Number(
        safety.attendanceWrites ||
        0
      ) ===
        0 &&
      Number(
        safety.assignmentWrites ||
        0
      ) ===
        0 &&
      Number(
        safety.firebaseAuthWrites ||
        0
      ) ===
        0 &&
      Number(
        safety.approvalRecordWrites ||
        0
      ) ===
        0,
    noCommit:
      safety.commitCallableIncluded ===
      false,
    noCutover:
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
      `Phase 4C-10R audit validation failed: ${failedChecks.join(", ")}`,
      {
        failedChecks
      }
    );
  }

  return audit;
}

function publicApproval(
  data: GenericRecord,
  duplicate: boolean,
  writeOperations: number
) {
  const expiresAtMillis =
    timestampMillis(
      data.expiresAt
    );

  return {
    ok:
      true,
    version:
      UID_V2_REBASE_APPROVAL_PHASE4C10R_VERSION,
    mode:
      "rebase156_ten_minute_server_approval_record_only",
    requestId:
      REQUEST_ID,
    duplicate,
    writeOperations,
    status:
      text(
        data.status
      ),
    contractDigest:
      text(
        data.contractDigest
      ),
    liveAuditDigest:
      text(
        data.liveAuditDigest
      ),
    approvalDigest:
      text(
        data.approvalDigest
      ),
    generation:
      Number(
        data.generation ||
        0
      ),
    armedAtIso:
      text(
        data.armedAtIso
      ),
    expiresAtIso:
      text(
        data.expiresAtIso
      ),
    secondsRemaining:
      Math.max(
        0,
        Math.floor(
          (
            expiresAtMillis -
            Date.now()
          ) /
          1000
        )
      ),
    approvalValidNow:
      expiresAtMillis >
      Date.now(),
    safety: {
      approvalRecordWrites:
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
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        "Phase 4C-11R final commit dry-run contract only",
      allowed:
        expiresAtMillis >
        Date.now(),
      actualUidCutoverAllowed:
        false
    }
  };
}

export const armUidV2RebaseLiveApprovalPhase4c10r =
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
          ? request.data as ArmInput
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
        input.confirmTenMinuteApproval !==
          true ||
        input.confirmAuditBoundApproval !==
          true ||
        input.confirmNoSourceWrites !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-10R input gate failed."
        );
      }

      const audit =
        validateAuditResult(
          input.auditResult
        );

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
        baselineMetaSnapshot,
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
              "rebaseRehearsalResults"
            )
            .doc(
              "phase4c7r"
            )
            .get()
        ]);

      if (
        !baselineMetaSnapshot.exists ||
        !rehearsalResultSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-8R baseline or Phase 4C-7R rehearsal result is missing."
        );
      }

      const baselineMeta =
        baselineMetaSnapshot.data() ||
        {};

      const rehearsalResult =
        rehearsalResultSnapshot.data() ||
        {};

      const chainChecks:
        GenericRecord = {
        baselineStatus:
          text(
            baselineMeta.status
          ) ===
          "rebase_live_baseline_staged",
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
        rehearsalContract:
          text(
            rehearsalResult.contractDigest
          ) ===
          EXPECTED_PHASE4C7R_CONTRACT_DIGEST,
        rehearsalDigest:
          text(
            rehearsalResult.rehearsalResultDigest
          ) ===
          EXPECTED_REHEARSAL_RESULT_DIGEST,
        rehearsalVerified:
          rehearsalResult.postRestoreVerified ===
          true,
        noCutover:
          baselineMeta.actualUidCutoverAllowed ===
            false &&
          (
            rehearsalResult.safety as GenericRecord
          )?.actualUidCutoverAllowed ===
            false
      };

      if (!allTrue(chainChecks)) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-10R prior-chain binding failed."
        );
      }

      const approvalRef =
        runRef
          .collection(
            "rebaseLiveApprovals"
          )
          .doc(
            "phase4c10r"
          );

      const nowMillis =
        Date.now();

      let duplicate =
        false;
      let writeOperations =
        0;
      let output:
        GenericRecord = {};

      await db.runTransaction(
        async (transaction) => {
          const existingSnapshot =
            await transaction.get(
              approvalRef
            );

          if (existingSnapshot.exists) {
            const existing =
              existingSnapshot.data() ||
              {};

            const recomputed =
              digestValue(
                approvalCore(
                  existing
                )
              );

            const sameApproval =
              text(
                existing.contractDigest
              ) ===
                CONTRACT_DIGEST &&
              text(
                existing.liveAuditDigest
              ) ===
                EXPECTED_LIVE_AUDIT_DIGEST &&
              text(
                existing.approvedByFirebaseUid
              ) ===
                callerUid &&
              text(
                existing.approvalDigest
              ) ===
                recomputed;

            const stillValid =
              timestampMillis(
                existing.expiresAt
              ) >
              nowMillis;

            if (
              sameApproval &&
              stillValid
            ) {
              duplicate = true;
              output = existing;
              return;
            }
          }

          const previous =
            existingSnapshot.exists
              ? existingSnapshot.data() ||
                {}
              : {};

          const generation =
            Number(
              previous.generation ||
              0
            ) + 1;

          const armedAt =
            Timestamp.fromMillis(
              nowMillis
            );

          const expiresAt =
            Timestamp.fromMillis(
              nowMillis +
              APPROVAL_WINDOW_MS
            );

          const core:
            GenericRecord = {
            version:
              UID_V2_REBASE_APPROVAL_PHASE4C10R_VERSION,
            phase:
              "Phase 4C-10R",
            mode:
              "rebase156_ten_minute_server_approval_record_only",
            requestId:
              REQUEST_ID,
            contractDigest:
              CONTRACT_DIGEST,
            phase4c9rContractDigest:
              EXPECTED_PHASE4C9R_CONTRACT_DIGEST,
            phase4c8rContractDigest:
              EXPECTED_PHASE4C8R_CONTRACT_DIGEST,
            phase4c7rContractDigest:
              EXPECTED_PHASE4C7R_CONTRACT_DIGEST,
            liveBaselineDigest:
              EXPECTED_LIVE_BASELINE_DIGEST,
            liveAuditDigest:
              EXPECTED_LIVE_AUDIT_DIGEST,
            rehearsalResultDigest:
              EXPECTED_REHEARSAL_RESULT_DIGEST,
            baselineRawSheetDigest:
              EXPECTED_BASELINE_RAW_SHEET_DIGEST,
            currentRawSheetDigest:
              EXPECTED_CURRENT_RAW_SHEET_DIGEST,
            approvedByFirebaseUid:
              callerUid,
            generation,
            armedAtIso:
              new Date(
                nowMillis
              ).toISOString(),
            expiresAtIso:
              new Date(
                nowMillis +
                APPROVAL_WINDOW_MS
              ).toISOString(),
            approvalWindowSeconds:
              600,
            auditSummary: {
              rawSheetSnapshotMatchesBaseline:
                audit.rawSheetSnapshotMatchesBaseline ===
                true,
              studentsStable:
                (
                  audit.sheetChecks as GenericRecord
                ).studentsStable ===
                true,
              principalsStable:
                (
                  audit.sheetChecks as GenericRecord
                ).principalsStable ===
                true,
              attendanceStable:
                (
                  audit.attendance as GenericRecord
                ).stable ===
                true,
              inPlaceAttendanceStable:
                (
                  audit.inPlaceAttendance as GenericRecord
                ).stable ===
                true,
              assignmentsStable:
                (
                  audit.assignments as GenericRecord
                ).stable ===
                true,
              attendanceCloneStable:
                (
                  audit.attendanceClone as GenericRecord
                ).stable ===
                true,
              firebaseAuthStable:
                (
                  audit.firebaseAuth as GenericRecord
                ).stable ===
                true,
              blockingReasonCount:
                (
                  audit.blockingReasons as unknown[]
                ).length
            },
            status:
              "rebase_live_approval_armed",
            safety: {
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
              actualUidCutoverAllowed:
                false
            }
          };

          const approvalDigest =
            digestValue(
              core
            );

          output = {
            ...core,
            approvalDigest,
            armedAt,
            expiresAt
          };

          transaction.set(
            approvalRef,
            output
          );

          writeOperations = 1;
        }
      );

      return publicApproval(
        output,
        duplicate,
        writeOperations
      );
    }
  );

export const inspectUidV2RebaseLiveApprovalPhase4c10r =
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
        text(
          input.requestId
        ) !==
          REQUEST_ID ||
        text(
          input.contractDigest
        ) !==
          CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-10R inspect input gate failed."
        );
      }

      const approvalSnapshot =
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
            "rebaseLiveApprovals"
          )
          .doc(
            "phase4c10r"
          )
          .get();

      if (!approvalSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-10R approval record is missing."
        );
      }

      const approval =
        approvalSnapshot.data() ||
        {};

      const recomputedDigest =
        digestValue(
          approvalCore(
            approval
          )
        );

      const safety =
        asRecord(
          approval.safety,
          "approval.safety"
        );

      const summary =
        asRecord(
          approval.auditSummary,
          "approval.auditSummary"
        );

      const checks:
        GenericRecord = {
        status:
          text(
            approval.status
          ) ===
          "rebase_live_approval_armed",
        contract:
          text(
            approval.contractDigest
          ) ===
          CONTRACT_DIGEST,
        audit:
          text(
            approval.liveAuditDigest
          ) ===
          EXPECTED_LIVE_AUDIT_DIGEST,
        baseline:
          text(
            approval.liveBaselineDigest
          ) ===
          EXPECTED_LIVE_BASELINE_DIGEST,
        approvalDigest:
          text(
            approval.approvalDigest
          ) ===
          recomputedDigest,
        summary:
          summary.rawSheetSnapshotMatchesBaseline ===
            true &&
          summary.studentsStable ===
            true &&
          summary.principalsStable ===
            true &&
          summary.attendanceStable ===
            true &&
          summary.inPlaceAttendanceStable ===
            true &&
          summary.assignmentsStable ===
            true &&
          summary.attendanceCloneStable ===
            true &&
          summary.firebaseAuthStable ===
            true &&
          Number(
            summary.blockingReasonCount ||
            0
          ) ===
            0,
        noWrites:
          Number(
            safety.sourceSheetWrites ||
            0
          ) ===
            0 &&
          Number(
            safety.activeUidRegistryWrites ||
            0
          ) ===
            0 &&
          Number(
            safety.attendanceWrites ||
            0
          ) ===
            0 &&
          Number(
            safety.assignmentWrites ||
            0
          ) ===
            0 &&
          Number(
            safety.firebaseAuthWrites ||
            0
          ) ===
            0,
        noCommit:
          safety.commitCallableIncluded ===
          false,
        noCutover:
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
          "data-loss",
          `Phase 4C-10R approval inspection failed: ${failedChecks.join(", ")}`,
          {
            failedChecks
          }
        );
      }

      return {
        ...publicApproval(
          approval,
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
