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

export const UID_V2_REBASE_APPROVAL_MANIFEST_PHASE4C3R_VERSION =
  "2026-07-27.716.43-phase4c3r-10min-approval-isolated-manifest";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "1feec8113dda6d5cd545d2477f94b708bc1a7ddd638dae7e5144e374272bdfcd";

const EXPECTED_STAGED_PLAN_DIGEST =
  "d4e1c345d7423e73f61cd4cc761e23f86d87b7ae515ddc8f7993b882ce8ffd6a";

const EXPECTED_PHASE4C2R_CONTRACT_DIGEST =
  "53efad2ffad6f4f6488bddd32c1c4b0099eb8d7d88128ed6945feffa560e6600";

const EXPECTED_ALLOCATION_PLAN_DIGEST =
  "106041768420f52fd9090f0e09d7c6a18353371a67b6529e3c87a43a0d71faa9";

const EXPECTED_ELIGIBILITY_DIGEST =
  "407d5d09c0d22d54e86e553e283676e20d2eebe0c861129a9dfbce7ce799117f";

const EXPECTED_REBASE_MANIFEST_DIGEST =
  "d0bccc950c3e17a766e72622e2ad73602b522b55b6b9c5d5fcaeb4fae7be4115";

const EXPECTED_REBASE_CONTRACT_DIGEST =
  "34ce148c8147252d2324f0ee9e5a752b65d231977ed6b1d8aa742d41d875a375";

const APPROVAL_WINDOW_MS =
  600000;

const EXPECTED_COUNTS =
  {"assignmentMappings":14,"attendanceCloneDocuments":1,"attendanceMappings":1,"excludedTestPrincipals":1,"firebaseAuthTransitions":1,"generatedUids":168,"inPlaceAttendanceDocuments":68,"orphanStudentAuthRows":8,"principalAliases":13,"principals":12,"productionAttendanceDocuments":69,"studentAliases":85,"students":156} as const;

const EXPECTED_PROJECTED_WRITES =
  {"assignmentMappings":14,"attendanceMappings":1,"firebaseAuthTransitions":1,"principalAliases":13,"principalUidAllocations":12,"studentAliases":85,"studentUidAllocations":156,"testPrincipalExclusions":1} as const;

const EXPECTED_PROJECTED_TOTAL =
  283;

type GenericRecord =
  Record<string, unknown>;

interface ArmInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmTenMinuteApproval?: unknown;
  readonly confirmNoSourceWrites?: unknown;
  readonly envelope?: unknown;
}

interface StageInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmApprovalBoundManifest?: unknown;
  readonly confirmNoSourceWrites?: unknown;
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

function stringArray(
  value: unknown
): string[] {
  return Array.isArray(value)
    ? value
        .map(text)
        .filter(Boolean)
    : [];
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
    stringArray(
      auth.token.roles
    );

  const allowed =
    text(auth.token.role) ===
      "superAdmin" ||
    text(auth.token.ulimRole) ===
      "superAdmin" ||
    text(auth.token.accountRole) ===
      "superAdmin" ||
    roles.includes(
      "superAdmin"
    );

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
    return value.map(
      canonicalize
    );
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
  return createHash(
    "sha256"
  )
    .update(
      value,
      "utf8"
    )
    .digest(
      "hex"
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
  return Object.values(
    value
  ).every(
    (item) =>
      item === true
  );
}

function timestampMillis(
  value: unknown
): number {
  return value instanceof Timestamp
    ? value.toMillis()
    : 0;
}

function timestampIso(
  value: unknown
): string {
  const millis =
    timestampMillis(value);

  return millis > 0
    ? new Date(
        millis
      ).toISOString()
    : "";
}

function validatePlanEnvelope(
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

  const counts =
    asRecord(
      plan.counts,
      "plan.counts"
    );

  const projected =
    asRecord(
      plan.projectedStagedWrites,
      "plan.projectedStagedWrites"
    );

  const safety =
    asRecord(
      plan.safety,
      "plan.safety"
    );

  const calculatedDigest =
    sha256(
      JSON.stringify(
        canonicalize(
          plan
        )
      )
    );

  const checks:
    GenericRecord = {
      envelopeDigest:
        text(
          envelope.stagedPlanDigest
        ) ===
        calculatedDigest,
      stagedPlanDigest:
        calculatedDigest ===
        EXPECTED_STAGED_PLAN_DIGEST,
      requestId:
        text(
          plan.requestId
        ) ===
        REQUEST_ID,
      phase4c2rContract:
        text(
          plan.contractDigest
        ) ===
        EXPECTED_PHASE4C2R_CONTRACT_DIGEST,
      allocationPlan:
        text(
          plan.allocationPlanDigest
        ) ===
        EXPECTED_ALLOCATION_PLAN_DIGEST,
      eligibility:
        text(
          plan.eligibilityDigest
        ) ===
        EXPECTED_ELIGIBILITY_DIGEST,
      rebaseManifest:
        text(
          plan.rebaseManifestDigest
        ) ===
        EXPECTED_REBASE_MANIFEST_DIGEST,
      rebaseContract:
        text(
          plan.rebaseContractDigest
        ) ===
        EXPECTED_REBASE_CONTRACT_DIGEST,
      counts:
        sameJson(
          counts,
          EXPECTED_COUNTS
        ),
      projectedWrites:
        sameJson(
          projected,
          EXPECTED_PROJECTED_WRITES
        ),
      projectedTotal:
        Number(
          plan.projectedStagedWriteTotal ||
          0
        ) ===
        EXPECTED_PROJECTED_TOTAL,
      failedChecks:
        Array.isArray(
          plan.failedChecks
        ) &&
        plan.failedChecks.length ===
        0,
      ready:
        plan.readyForApproval ===
        true,
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
        safety.existingUidChanged ===
          false &&
        safety.existingUidDeleted ===
          false &&
        safety.actualUidCutoverAllowed ===
          false
    };

  if (!allTrue(checks)) {
    const failedChecks =
      Object.entries(
        checks
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
      `Phase 4C-3R plan validation failed: ${failedChecks.join(", ")}`,
      {
        failedChecks
      }
    );
  }

  return {
    envelope,
    plan,
    counts,
    projected,
    calculatedDigest
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
    stagedPlanDigest:
      data.stagedPlanDigest,
    phase4c2rContractDigest:
      data.phase4c2rContractDigest,
    allocationPlanDigest:
      data.allocationPlanDigest,
    eligibilityDigest:
      data.eligibilityDigest,
    rebaseManifestDigest:
      data.rebaseManifestDigest,
    rebaseContractDigest:
      data.rebaseContractDigest,
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
    status:
      data.status,
    safety:
      data.safety
  };
}

function manifestCore(
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
    stagedPlanDigest:
      data.stagedPlanDigest,
    phase4c2rContractDigest:
      data.phase4c2rContractDigest,
    allocationPlanDigest:
      data.allocationPlanDigest,
    eligibilityDigest:
      data.eligibilityDigest,
    rebaseManifestDigest:
      data.rebaseManifestDigest,
    rebaseContractDigest:
      data.rebaseContractDigest,
    counts:
      data.counts,
    projectedStagedWrites:
      data.projectedStagedWrites,
    projectedStagedWriteTotal:
      data.projectedStagedWriteTotal,
    approvalGeneration:
      data.approvalGeneration,
    approvedByFirebaseUid:
      data.approvedByFirebaseUid,
    approvalDigest:
      data.approvalDigest,
    approvalArmedAtIso:
      data.approvalArmedAtIso,
    approvalExpiresAtIso:
      data.approvalExpiresAtIso,
    stagedAtIso:
      data.stagedAtIso,
    approvalValidAtStage:
      data.approvalValidAtStage,
    status:
      data.status,
    safety:
      data.safety
  };
}

function publicApprovalResult(
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
      UID_V2_REBASE_APPROVAL_MANIFEST_PHASE4C3R_VERSION,
    mode:
      "rebase156_ten_minute_approval",
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
    stagedPlanDigest:
      text(
        data.stagedPlanDigest
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
      isolatedApprovalWrites:
        writeOperations,
      isolatedManifestWrites:
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
      executionCallableIncluded:
        false,
      actualUidCutoverAllowed:
        false
    }
  };
}

function publicManifestResult(
  data: GenericRecord,
  duplicate: boolean,
  writeOperations: number
) {
  return {
    ok:
      true,
    version:
      UID_V2_REBASE_APPROVAL_MANIFEST_PHASE4C3R_VERSION,
    mode:
      "rebase156_approval_bound_isolated_manifest",
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
    stagedPlanDigest:
      text(
        data.stagedPlanDigest
      ),
    manifestDigest:
      text(
        data.manifestDigest
      ),
    approvalDigest:
      text(
        data.approvalDigest
      ),
    approvalGeneration:
      Number(
        data.approvalGeneration ||
        0
      ),
    counts:
      data.counts,
    projectedStagedWriteTotal:
      Number(
        data.projectedStagedWriteTotal ||
        0
      ),
    approvalValidAtStage:
      data.approvalValidAtStage ===
      true,
    safety: {
      isolatedApprovalWrites:
        0,
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
      executionCallableIncluded:
        false,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        "Phase 4C-4R isolated allocation payload and fan-out design",
      allowed:
        data.approvalValidAtStage ===
        true,
      actualUidCutoverAllowed:
        false
    }
  };
}

export const armUidV2RebaseApprovalPhase4c3r =
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
        typeof request.data ===
          "object"
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
        input.confirmNoSourceWrites !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-3R approval input gate failed."
        );
      }

      validatePlanEnvelope(
        input.envelope
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

      const approvalRef =
        runRef
          .collection(
            "rebaseApprovals"
          )
          .doc(
            "phase4c3r"
          );

      const manifestRef =
        runRef
          .collection(
            "rebaseManifests"
          )
          .doc(
            "phase4c3r"
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
          const [
            approvalSnapshot,
            manifestSnapshot
          ] =
            await Promise.all([
              transaction.get(
                approvalRef
              ),
              transaction.get(
                manifestRef
              )
            ]);

          if (
            manifestSnapshot.exists
          ) {
            const manifest =
              manifestSnapshot.data() ||
              {};

            if (
              text(
                manifest.contractDigest
              ) !==
                CONTRACT_DIGEST ||
              text(
                manifest.stagedPlanDigest
              ) !==
                EXPECTED_STAGED_PLAN_DIGEST
            ) {
              throw new HttpsError(
                "already-exists",
                "A conflicting Phase 4C-3R manifest exists."
              );
            }

            if (
              approvalSnapshot.exists
            ) {
              output =
                approvalSnapshot.data() ||
                {};
            } else {
              output = {
                status:
                  "manifest_already_staged",
                contractDigest:
                  CONTRACT_DIGEST,
                stagedPlanDigest:
                  EXPECTED_STAGED_PLAN_DIGEST,
                approvalDigest:
                  manifest.approvalDigest,
                generation:
                  manifest.approvalGeneration,
                armedAtIso:
                  manifest.approvalArmedAtIso,
                expiresAtIso:
                  manifest.approvalExpiresAtIso,
                expiresAt:
                  Timestamp.fromMillis(
                    Date.parse(
                      text(
                        manifest.approvalExpiresAtIso
                      )
                    )
                  )
              };
            }

            duplicate = true;
            return;
          }

          if (
            approvalSnapshot.exists
          ) {
            const existing =
              approvalSnapshot.data() ||
              {};

            const stillValid =
              timestampMillis(
                existing.expiresAt
              ) >
              nowMillis;

            const sameApproval =
              text(
                existing.contractDigest
              ) ===
                CONTRACT_DIGEST &&
              text(
                existing.stagedPlanDigest
              ) ===
                EXPECTED_STAGED_PLAN_DIGEST &&
              text(
                existing.approvedByFirebaseUid
              ) ===
                callerUid &&
              text(
                existing.approvalDigest
              ) ===
                sha256(
                  JSON.stringify(
                    canonicalize(
                      approvalCore(
                        existing
                      )
                    )
                  )
                );

            if (
              stillValid &&
              sameApproval
            ) {
              duplicate = true;
              output = existing;
              return;
            }
          }

          const previous =
            approvalSnapshot.exists
              ? approvalSnapshot.data() ||
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
                UID_V2_REBASE_APPROVAL_MANIFEST_PHASE4C3R_VERSION,
              phase:
                "Phase 4C-3R",
              mode:
                "rebase156_ten_minute_approval",
              requestId:
                REQUEST_ID,
              contractDigest:
                CONTRACT_DIGEST,
              stagedPlanDigest:
                EXPECTED_STAGED_PLAN_DIGEST,
              phase4c2rContractDigest:
                EXPECTED_PHASE4C2R_CONTRACT_DIGEST,
              allocationPlanDigest:
                EXPECTED_ALLOCATION_PLAN_DIGEST,
              eligibilityDigest:
                EXPECTED_ELIGIBILITY_DIGEST,
              rebaseManifestDigest:
                EXPECTED_REBASE_MANIFEST_DIGEST,
              rebaseContractDigest:
                EXPECTED_REBASE_CONTRACT_DIGEST,
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
              status:
                "rebase_approval_armed",
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
                executionCallableIncluded:
                  false,
                actualUidCutoverAllowed:
                  false
              }
            };

          const approvalDigest =
            sha256(
              JSON.stringify(
                canonicalize(
                  core
                )
              )
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

      return publicApprovalResult(
        output,
        duplicate,
        writeOperations
      );
    }
  );

export const stageUidV2RebaseManifestPhase4c3r =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        240,
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
          ? request.data as StageInput
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
        input.confirmApprovalBoundManifest !==
          true ||
        input.confirmNoSourceWrites !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-3R manifest input gate failed."
        );
      }

      const validated =
        validatePlanEnvelope(
          input.envelope
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

      const approvalRef =
        runRef
          .collection(
            "rebaseApprovals"
          )
          .doc(
            "phase4c3r"
          );

      const manifestRef =
        runRef
          .collection(
            "rebaseManifests"
          )
          .doc(
            "phase4c3r"
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
          const [
            approvalSnapshot,
            manifestSnapshot
          ] =
            await Promise.all([
              transaction.get(
                approvalRef
              ),
              transaction.get(
                manifestRef
              )
            ]);

          if (
            manifestSnapshot.exists
          ) {
            const existing =
              manifestSnapshot.data() ||
              {};

            const recomputed =
              sha256(
                JSON.stringify(
                  canonicalize(
                    manifestCore(
                      existing
                    )
                  )
                )
              );

            if (
              text(
                existing.contractDigest
              ) !==
                CONTRACT_DIGEST ||
              text(
                existing.stagedPlanDigest
              ) !==
                EXPECTED_STAGED_PLAN_DIGEST ||
              text(
                existing.manifestDigest
              ) !==
                recomputed
            ) {
              throw new HttpsError(
                "already-exists",
                "A conflicting Phase 4C-3R manifest exists."
              );
            }

            duplicate = true;
            output = existing;
            return;
          }

          if (
            !approvalSnapshot.exists
          ) {
            throw new HttpsError(
              "not-found",
              "Phase 4C-3R approval record is missing."
            );
          }

          const approval =
            approvalSnapshot.data() ||
            {};

          const approvalDigest =
            sha256(
              JSON.stringify(
                canonicalize(
                  approvalCore(
                    approval
                  )
                )
              )
            );

          const approvalChecks:
            GenericRecord = {
              status:
                text(
                  approval.status
                ) ===
                "rebase_approval_armed",
              contract:
                text(
                  approval.contractDigest
                ) ===
                CONTRACT_DIGEST,
              plan:
                text(
                  approval.stagedPlanDigest
                ) ===
                EXPECTED_STAGED_PLAN_DIGEST,
              caller:
                text(
                  approval.approvedByFirebaseUid
                ) ===
                callerUid,
              digest:
                text(
                  approval.approvalDigest
                ) ===
                approvalDigest,
              notExpired:
                timestampMillis(
                  approval.expiresAt
                ) >
                nowMillis
            };

          if (!allTrue(approvalChecks)) {
            const failedChecks =
              Object.entries(
                approvalChecks
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
              `Phase 4C-3R approval validation failed: ${failedChecks.join(", ")}`,
              {
                failedChecks
              }
            );
          }

          const stagedAtIso =
            new Date(
              nowMillis
            ).toISOString();

          const core:
            GenericRecord = {
              version:
                UID_V2_REBASE_APPROVAL_MANIFEST_PHASE4C3R_VERSION,
              phase:
                "Phase 4C-3R",
              mode:
                "rebase156_approval_bound_isolated_manifest",
              requestId:
                REQUEST_ID,
              contractDigest:
                CONTRACT_DIGEST,
              stagedPlanDigest:
                validated.calculatedDigest,
              phase4c2rContractDigest:
                EXPECTED_PHASE4C2R_CONTRACT_DIGEST,
              allocationPlanDigest:
                EXPECTED_ALLOCATION_PLAN_DIGEST,
              eligibilityDigest:
                EXPECTED_ELIGIBILITY_DIGEST,
              rebaseManifestDigest:
                EXPECTED_REBASE_MANIFEST_DIGEST,
              rebaseContractDigest:
                EXPECTED_REBASE_CONTRACT_DIGEST,
              counts:
                validated.counts,
              projectedStagedWrites:
                validated.projected,
              projectedStagedWriteTotal:
                EXPECTED_PROJECTED_TOTAL,
              approvalGeneration:
                Number(
                  approval.generation ||
                  0
                ),
              approvedByFirebaseUid:
                callerUid,
              approvalDigest:
                text(
                  approval.approvalDigest
                ),
              approvalArmedAtIso:
                timestampIso(
                  approval.armedAt
                ),
              approvalExpiresAtIso:
                timestampIso(
                  approval.expiresAt
                ),
              stagedAtIso,
              approvalValidAtStage:
                true,
              status:
                "rebase_manifest_staged",
              safety: {
                isolatedApprovalWrites:
                  1,
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
                  core
                )
              )
            );

          output = {
            ...core,
            manifestDigest,
            stagedAt:
              Timestamp.fromMillis(
                nowMillis
              )
          };

          transaction.set(
            manifestRef,
            output
          );

          writeOperations = 1;
        }
      );

      return publicManifestResult(
        output,
        duplicate,
        writeOperations
      );
    }
  );

export const inspectUidV2RebaseApprovalManifestPhase4c3r =
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
          "Phase 4C-3R inspect input gate failed."
        );
      }

      const runRef =
        getFirestore(
          defaultAdminApp()
        )
          .collection(
            "uidV2StagingRuns"
          )
          .doc(
            REQUEST_ID
          );

      const [
        approvalSnapshot,
        manifestSnapshot
      ] =
        await Promise.all([
          runRef
            .collection(
              "rebaseApprovals"
            )
            .doc(
              "phase4c3r"
            )
            .get(),
          runRef
            .collection(
              "rebaseManifests"
            )
            .doc(
              "phase4c3r"
            )
            .get()
        ]);

      if (
        !approvalSnapshot.exists ||
        !manifestSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-3R approval or manifest is missing."
        );
      }

      const approval =
        approvalSnapshot.data() ||
        {};

      const manifest =
        manifestSnapshot.data() ||
        {};

      const approvalRecomputed =
        sha256(
          JSON.stringify(
            canonicalize(
              approvalCore(
                approval
              )
            )
          )
        );

      const manifestRecomputed =
        sha256(
          JSON.stringify(
            canonicalize(
              manifestCore(
                manifest
              )
            )
          )
        );

      const checks:
        GenericRecord = {
        approvalDigest:
          text(
            approval.approvalDigest
          ) ===
          approvalRecomputed,
        manifestDigest:
          text(
            manifest.manifestDigest
          ) ===
          manifestRecomputed,
        approvalContract:
          text(
            approval.contractDigest
          ) ===
          CONTRACT_DIGEST,
        manifestContract:
          text(
            manifest.contractDigest
          ) ===
          CONTRACT_DIGEST,
        approvalPlan:
          text(
            approval.stagedPlanDigest
          ) ===
          EXPECTED_STAGED_PLAN_DIGEST,
        manifestPlan:
          text(
            manifest.stagedPlanDigest
          ) ===
          EXPECTED_STAGED_PLAN_DIGEST,
        generation:
          Number(
            approval.generation ||
            0
          ) ===
          Number(
            manifest.approvalGeneration ||
            -1
          ),
        approvalBinding:
          text(
            approval.approvalDigest
          ) ===
          text(
            manifest.approvalDigest
          ),
        approvalValidAtStage:
          manifest.approvalValidAtStage ===
          true,
        counts:
          sameJson(
            manifest.counts,
            EXPECTED_COUNTS
          ),
        projectedWrites:
          sameJson(
            manifest.projectedStagedWrites,
            EXPECTED_PROJECTED_WRITES
          ),
        projectedTotal:
          Number(
            manifest.projectedStagedWriteTotal ||
            0
          ) ===
          EXPECTED_PROJECTED_TOTAL,
        noCutover:
          (
            manifest.safety as GenericRecord
          )?.actualUidCutoverAllowed ===
          false,
        noExecution:
          (
            manifest.safety as GenericRecord
          )?.executionCallableIncluded ===
          false
      };

      if (!allTrue(checks)) {
        const failedChecks =
          Object.entries(
            checks
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
          "data-loss",
          `Phase 4C-3R stored verification failed: ${failedChecks.join(", ")}`,
          {
            failedChecks
          }
        );
      }

      return {
        ok:
          true,
        version:
          UID_V2_REBASE_APPROVAL_MANIFEST_PHASE4C3R_VERSION,
        mode:
          "rebase156_approval_and_manifest_inspection",
        requestId:
          REQUEST_ID,
        contractDigest:
          CONTRACT_DIGEST,
        stagedPlanDigest:
          EXPECTED_STAGED_PLAN_DIGEST,
        approval: {
          status:
            text(
              approval.status
            ),
          approvalDigest:
            text(
              approval.approvalDigest
            ),
          generation:
            Number(
              approval.generation ||
              0
            ),
          armedAtIso:
            text(
              approval.armedAtIso
            ),
          expiresAtIso:
            text(
              approval.expiresAtIso
            ),
          validNow:
            timestampMillis(
              approval.expiresAt
            ) >
            Date.now()
        },
        manifest: {
          status:
            text(
              manifest.status
            ),
          manifestDigest:
            text(
              manifest.manifestDigest
            ),
          approvalValidAtStage:
            manifest.approvalValidAtStage ===
            true,
          counts:
            manifest.counts,
          projectedStagedWriteTotal:
            Number(
              manifest.projectedStagedWriteTotal ||
              0
            )
        },
        verified:
          true,
        digestMatches:
          true,
        safety: {
          isolatedApprovalRecords:
            1,
          isolatedManifestRecords:
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
          executionCallableIncluded:
            false,
          actualUidCutoverAllowed:
            false
        },
        nextGate: {
          phase:
            "Phase 4C-4R isolated allocation payload and fan-out design",
          allowed:
            true,
          actualUidCutoverAllowed:
            false
        }
      };
    }
  );
