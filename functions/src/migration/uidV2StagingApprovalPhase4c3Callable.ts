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

export const UID_V2_STAGING_APPROVAL_PHASE4C3_VERSION =
  "2026-07-24.716.13-phase4c3-isolated-staging-approval-only";

const REGION = "asia-northeast3";
const APPROVAL_COLLECTION =
  "uidV2StagingApprovals";
const APPROVAL_WINDOW_SECONDS = 600;
const EXPECTED_ALLOCATION_PLAN_DIGEST =
  "3f84a507ce2e319d4569bdaf09c97b431a81863beb4030415cebb90c7bd15a23";
const EXPECTED_STAGING_PLAN_DIGEST =
  "fb371357ad163def2666707242603cc1b5d93a095048528fbbb4a46dedc92e6d";
const EXPECTED_REFERENCE_AUDIT_DIGEST =
  "42a61f565e4773852aef7e5d0cd9720711e21d667c6f20f9bc9c3a915153d8ff";
const EXPECTED_STAGING_SNAPSHOT_ID =
  "P4C2_fb371357ad163def2666";
const EXPECTED_CONFIRMATION =
  "PHASE4C3_STAGING_APPROVAL_ONLY_NO_UID_CUTOVER";
const EXPECTED_SERVER_CONTRACT_DIGEST =
  "4bde14f0be7b4db491156090a4a52a75c481ce99be869a167e1e318514c998b8";

const EXPECTED_COUNTS = Object.freeze({"students":155,"principals":12,"studentAliases":85,"principalAliases":13,"generatedUids":167,"productionAttendanceDocuments":69,"productionAttendanceInPlace":68,"productionAttendancePathClone":1,"productionAssignments":14,"productionFirebaseAuthTransitions":1});

interface ArmInput {
  readonly requestId?: unknown;
  readonly allocationPlanDigest?: unknown;
  readonly stagingPlanDigest?: unknown;
  readonly referenceAuditDigest?: unknown;
  readonly stagingSnapshotId?: unknown;
  readonly serverContractDigest?: unknown;
  readonly confirmation?: unknown;
  readonly counts?: unknown;
}

interface InspectInput {
  readonly requestId?: unknown;
}

function defaultAdminApp(): App {
  const defaultApp =
    getApps().find(
      (app) =>
        app.name === "[DEFAULT]"
    );

  return defaultApp
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

function stringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(text)
    .filter(Boolean);
}

function isSuperAdmin(
  token: Record<string, unknown>
): boolean {
  const roles =
    stringArray(token.roles);

  return (
    text(token.role) === "superAdmin" ||
    text(token.ulimRole) === "superAdmin" ||
    text(token.accountRole) === "superAdmin" ||
    roles.includes("superAdmin")
  );
}

function requireSuperAdmin(
  auth:
    | {
        uid: string;
        token: Record<string, unknown>;
      }
    | undefined
): {
  uid: string;
  role: "superAdmin";
} {
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "Firebase authentication is required."
    );
  }

  if (!isSuperAdmin(auth.token)) {
    throw new HttpsError(
      "permission-denied",
      "superAdmin claim is required."
    );
  }

  return {
    uid: auth.uid,
    role: "superAdmin"
  };
}

function requireRequestId(
  value: unknown
): string {
  const requestId =
    text(value).toLowerCase();

  if (
    !/^phase4c3-[a-z0-9][a-z0-9-]{15,95}$/.test(
      requestId
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "requestId must start with phase4c3- and contain 16-96 safe characters after normalization."
    );
  }

  return requestId;
}

function stableContract() {
  return {
    phase:
      "Phase 4C-3 isolated staging approval",
    allocationPlanDigest:
      EXPECTED_ALLOCATION_PLAN_DIGEST,
    stagingPlanDigest:
      EXPECTED_STAGING_PLAN_DIGEST,
    referenceAuditDigest:
      EXPECTED_REFERENCE_AUDIT_DIGEST,
    stagingSnapshotId:
      EXPECTED_STAGING_SNAPSHOT_ID,
    counts:
      EXPECTED_COUNTS,
    approvalWindowSeconds:
      APPROVAL_WINDOW_SECONDS,
    scope:
      "isolated_staging_only",
    sourceDataWritesAllowed:
      false,
    actualUidCutoverAllowed:
      false,
    commitCallableIncluded:
      false
  };
}

function sha256(
  value: unknown
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(value),
      "utf8"
    )
    .digest("hex");
}

function normalizedCounts(
  value: unknown
): Record<string, number> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "counts object is required."
    );
  }

  const source =
    value as Record<string, unknown>;

  const result:
    Record<string, number> = {};

  for (
    const [
      key,
      expected
    ] of Object.entries(
      EXPECTED_COUNTS
    )
  ) {
    const actual =
      Number(source[key]);

    if (
      !Number.isInteger(actual) ||
      actual !== expected
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Count mismatch for ${key}.`
      );
    }

    result[key] =
      actual;
  }

  const extraKeys =
    Object.keys(source)
      .filter(
        (key) =>
          !(key in EXPECTED_COUNTS)
      );

  if (extraKeys.length > 0) {
    throw new HttpsError(
      "invalid-argument",
      `Unexpected count keys: ${extraKeys.join(", ")}`
    );
  }

  return result;
}

function validateArmInput(
  value: unknown
) {
  const input =
    value &&
    typeof value === "object"
      ? value as ArmInput
      : {};

  const requestId =
    requireRequestId(
      input.requestId
    );

  const allocationPlanDigest =
    text(
      input.allocationPlanDigest
    );

  const stagingPlanDigest =
    text(
      input.stagingPlanDigest
    );

  const referenceAuditDigest =
    text(
      input.referenceAuditDigest
    );

  const stagingSnapshotId =
    text(
      input.stagingSnapshotId
    );

  const serverContractDigest =
    text(
      input.serverContractDigest
    );

  const confirmation =
    text(
      input.confirmation
    );

  const counts =
    normalizedCounts(
      input.counts
    );

  const comparisons = {
    allocationPlanDigest:
      allocationPlanDigest ===
      EXPECTED_ALLOCATION_PLAN_DIGEST,
    stagingPlanDigest:
      stagingPlanDigest ===
      EXPECTED_STAGING_PLAN_DIGEST,
    referenceAuditDigest:
      referenceAuditDigest ===
      EXPECTED_REFERENCE_AUDIT_DIGEST,
    stagingSnapshotId:
      stagingSnapshotId ===
      EXPECTED_STAGING_SNAPSHOT_ID,
    serverContractDigest:
      serverContractDigest ===
      EXPECTED_SERVER_CONTRACT_DIGEST,
    confirmation:
      confirmation ===
      EXPECTED_CONFIRMATION,
    serverRecalculation:
      sha256(
        stableContract()
      ) ===
      EXPECTED_SERVER_CONTRACT_DIGEST
  };

  const failed =
    Object.entries(comparisons)
      .filter(
        (
          [, passed]
        ) =>
          !passed
      )
      .map(
        (
          [key]
        ) =>
          key
      );

  if (failed.length > 0) {
    throw new HttpsError(
      "failed-precondition",
      `Phase 4C-3 approval gate failed: ${failed.join(", ")}`
    );
  }

  return {
    requestId,
    allocationPlanDigest,
    stagingPlanDigest,
    referenceAuditDigest,
    stagingSnapshotId,
    serverContractDigest,
    confirmation,
    counts,
    comparisons
  };
}

function approvalDigest(
  value: {
    requestId: string;
    approvedByFirebaseUid: string;
    createdAtMs: number;
    expiresAtMs: number;
  }
): string {
  return sha256({
    version:
      UID_V2_STAGING_APPROVAL_PHASE4C3_VERSION,
    requestId:
      value.requestId,
    approvedByFirebaseUid:
      value.approvedByFirebaseUid,
    createdAtMs:
      value.createdAtMs,
    expiresAtMs:
      value.expiresAtMs,
    serverContractDigest:
      EXPECTED_SERVER_CONTRACT_DIGEST,
    allocationPlanDigest:
      EXPECTED_ALLOCATION_PLAN_DIGEST,
    stagingPlanDigest:
      EXPECTED_STAGING_PLAN_DIGEST
  });
}

function timestampMillis(
  value: unknown
): number {
  if (
    value instanceof Timestamp
  ) {
    return value.toMillis();
  }

  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (
      value as {
        toMillis?: unknown;
      }
    ).toMillis === "function"
  ) {
    return (
      value as {
        toMillis: () => number;
      }
    ).toMillis();
  }

  return 0;
}

function publicApproval(
  record:
    Record<string, unknown>,
  duplicate: boolean,
  writeOperations: number
) {
  const createdAtMs =
    timestampMillis(
      record.createdAt
    );

  const expiresAtMs =
    timestampMillis(
      record.expiresAt
    );

  const nowMs =
    Date.now();

  return {
    ok: true,
    version:
      UID_V2_STAGING_APPROVAL_PHASE4C3_VERSION,
    mode:
      "isolated_staging_approval_only",
    requestId:
      text(record.requestId),
    duplicate,
    writeOperations,
    status:
      text(record.status),
    valid:
      expiresAtMs > nowMs &&
      text(record.status) ===
        "approved_for_isolated_staging",
    expired:
      expiresAtMs <= nowMs,
    createdAt:
      createdAtMs > 0
        ? new Date(
            createdAtMs
          ).toISOString()
        : null,
    expiresAt:
      expiresAtMs > 0
        ? new Date(
            expiresAtMs
          ).toISOString()
        : null,
    remainingSeconds:
      Math.max(
        0,
        Math.floor(
          (
            expiresAtMs -
            nowMs
          ) / 1000
        )
      ),
    approvalWindowSeconds:
      APPROVAL_WINDOW_SECONDS,
    allocationPlanDigest:
      text(
        record.allocationPlanDigest
      ),
    stagingPlanDigest:
      text(
        record.stagingPlanDigest
      ),
    referenceAuditDigest:
      text(
        record.referenceAuditDigest
      ),
    stagingSnapshotId:
      text(
        record.stagingSnapshotId
      ),
    serverContractDigest:
      text(
        record.serverContractDigest
      ),
    approvalDigest:
      text(
        record.approvalDigest
      ),
    counts:
      record.counts,
    safety: {
      sourceDataWrites:
        0,
      uidWrites:
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
        writeOperations,
      actualUidCutoverAllowed:
        false,
      commitCallableIncluded:
        false
    },
    nextGate: {
      phase:
        "Phase 4C-4 isolated UID registry staging",
      allowed:
        expiresAtMs > nowMs &&
        text(record.status) ===
          "approved_for_isolated_staging",
      actualUidCutoverAllowed:
        false,
      requirement:
        "The next staging callable must verify requestId, approvalDigest, expiry, caller UID, allocation digest and staging digest."
    }
  };
}

export const armUidV2StagingApprovalPhase4c3 =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        60,
      memory:
        "256MiB",
      enforceAppCheck:
        false
    },
    async (request) => {
      const caller =
        requireSuperAdmin(
          request.auth as
            | {
                uid: string;
                token:
                  Record<
                    string,
                    unknown
                  >;
              }
            | undefined
        );

      const input =
        validateArmInput(
          request.data
        );

      const app =
        defaultAdminApp();

      const db =
        getFirestore(app);

      const reference =
        db
          .collection(
            APPROVAL_COLLECTION
          )
          .doc(
            input.requestId
          );

      let duplicate =
        false;

      let writeOperations =
        0;

      let finalRecord:
        Record<string, unknown>
        | undefined;

      await db.runTransaction(
        async (transaction) => {
          const existing =
            await transaction.get(
              reference
            );

          if (existing.exists) {
            const record =
              existing.data() || {};

            const same =
              text(record.requestId) ===
                input.requestId &&
              text(record.approvedByFirebaseUid) ===
                caller.uid &&
              text(record.allocationPlanDigest) ===
                EXPECTED_ALLOCATION_PLAN_DIGEST &&
              text(record.stagingPlanDigest) ===
                EXPECTED_STAGING_PLAN_DIGEST &&
              text(record.referenceAuditDigest) ===
                EXPECTED_REFERENCE_AUDIT_DIGEST &&
              text(record.stagingSnapshotId) ===
                EXPECTED_STAGING_SNAPSHOT_ID &&
              text(record.serverContractDigest) ===
                EXPECTED_SERVER_CONTRACT_DIGEST;

            if (!same) {
              throw new HttpsError(
                "already-exists",
                "requestId already exists with different approval data."
              );
            }

            duplicate = true;
            finalRecord = record;
            return;
          }

          const createdAtMs =
            Date.now();

          const expiresAtMs =
            createdAtMs +
            (
              APPROVAL_WINDOW_SECONDS *
              1000
            );

          const digest =
            approvalDigest({
              requestId:
                input.requestId,
              approvedByFirebaseUid:
                caller.uid,
              createdAtMs,
              expiresAtMs
            });

          const record:
            Record<string, unknown> = {
              version:
                UID_V2_STAGING_APPROVAL_PHASE4C3_VERSION,
              phase:
                "Phase 4C-3",
              mode:
                "isolated_staging_approval_only",
              requestId:
                input.requestId,
              status:
                "approved_for_isolated_staging",
              approvedByFirebaseUid:
                caller.uid,
              approvedByRole:
                caller.role,
              createdAt:
                Timestamp.fromMillis(
                  createdAtMs
                ),
              expiresAt:
                Timestamp.fromMillis(
                  expiresAtMs
                ),
              approvalWindowSeconds:
                APPROVAL_WINDOW_SECONDS,
              allocationPlanDigest:
                input.allocationPlanDigest,
              stagingPlanDigest:
                input.stagingPlanDigest,
              referenceAuditDigest:
                input.referenceAuditDigest,
              stagingSnapshotId:
                input.stagingSnapshotId,
              serverContractDigest:
                input.serverContractDigest,
              approvalDigest:
                digest,
              counts:
                input.counts,
              serverGateChecks:
                input.comparisons,
              browserIdentityTrusted:
                false,
              serverRecalculationPassed:
                true,
              sourceDataWritesAllowed:
                false,
              actualUidCutoverAllowed:
                false,
              commitCallableIncluded:
                false,
              maxApprovalRecordWrites:
                1
            };

          transaction.create(
            reference,
            record
          );

          writeOperations = 1;
          finalRecord = record;
        }
      );

      if (!finalRecord) {
        throw new HttpsError(
          "internal",
          "Approval record was not resolved."
        );
      }

      return publicApproval(
        finalRecord,
        duplicate,
        writeOperations
      );
    }
  );

export const inspectUidV2StagingApprovalPhase4c3 =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        30,
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
              token:
                Record<
                  string,
                  unknown
                >;
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

      const requestId =
        requireRequestId(
          input.requestId
        );

      const app =
        defaultAdminApp();

      const snapshot =
        await getFirestore(app)
          .collection(
            APPROVAL_COLLECTION
          )
          .doc(requestId)
          .get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-3 approval record was not found."
        );
      }

      return publicApproval(
        snapshot.data() || {},
        true,
        0
      );
    }
  );
