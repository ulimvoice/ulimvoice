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

export const UID_V2_REBASE_PAYLOAD_DESIGN_PHASE4C4R_VERSION =
  "2026-07-27.716.44-phase4c4r-rebase156-payload-and-fanout-design";

const REGION =
  "asia-northeast3";

const REQUEST_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const CONTRACT_DIGEST =
  "51a7cd5c0b48e808c8b542a675d6c19c3313f5daa19a2201986332825d65ad4d";

const EXPECTED_PHASE4C3R_CONTRACT_DIGEST =
  "1feec8113dda6d5cd545d2477f94b708bc1a7ddd638dae7e5144e374272bdfcd";

const EXPECTED_PHASE4C3R_MANIFEST_DIGEST =
  "bf679cdb11a21622f876c87cb58f6cd5f5fd011b4f0ef3f37b81ec30b5fa4007";

const EXPECTED_PHASE4C3R_APPROVAL_DIGEST =
  "fbf13c9a66dcdb79fdaa40d98c7884263ac8603ac4b07175853bbb7bc407424a";

const EXPECTED_APPROVAL_GENERATION =
  1;

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

const EXPECTED_PAYLOAD_COUNTS =
  {"students":156,"principals":12,"studentAliases":85,"principalAliases":13,"generatedUids":168,"assignmentMappings":14,"attendanceMappings":1,"firebaseAuthTransitions":1,"orphanStudentAuthExclusions":8,"testPrincipalExclusions":1} as const;

const EXPECTED_FANOUT_COUNTS =
  {"students":156,"principals":12,"studentAliases":85,"principalAliases":13,"assignmentMappings":14,"attendanceMappings":1,"firebaseAuthTransitions":1,"exclusions":1} as const;

const EXPECTED_FANOUT_RECORD_WRITES =
  283;

const EXPECTED_FANOUT_METADATA_WRITES =
  1;

const EXPECTED_FUTURE_FANOUT_TOTAL_WRITES =
  284;

type GenericRecord =
  Record<string, unknown>;

interface StagePayloadInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmIsolatedPayloadOnly?: unknown;
  readonly confirmNoSourceWrites?: unknown;
  readonly envelope?: unknown;
}

interface StageDesignInput {
  readonly requestId?: unknown;
  readonly contractDigest?: unknown;
  readonly confirmDesignOnly?: unknown;
  readonly confirmNoFanoutExecution?: unknown;
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

function rejectSensitiveKeys(
  value: unknown,
  path = "payload"
): void {
  if (Array.isArray(value)) {
    value.forEach(
      (entry, index) =>
        rejectSensitiveKeys(
          entry,
          `${path}[${index}]`
        )
    );
    return;
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return;
  }

  const forbidden =
    new Set([
      "phone",
      "phonenumber",
      "fullphone",
      "password",
      "passwordhash",
      "salt",
      "secret",
      "idtoken",
      "refreshtoken",
      "accesstoken"
    ]);

  for (
    const [
      key,
      child
    ] of
    Object.entries(
      value as GenericRecord
    )
  ) {
    const normalized =
      key
        .replace(
          /[^a-z0-9]/gi,
          ""
        )
        .toLowerCase();

    if (
      forbidden.has(
        normalized
      )
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Sensitive key is forbidden: ${path}.${key}`
      );
    }

    rejectSensitiveKeys(
      child,
      `${path}.${key}`
    );
  }
}

function validatePayload(
  envelopeValue: unknown
) {
  const envelope =
    asRecord(
      envelopeValue,
      "envelope"
    );

  const payload =
    asRecord(
      envelope.payload,
      "envelope.payload"
    );

  rejectSensitiveKeys(
    payload
  );

  const counts =
    asRecord(
      payload.counts,
      "payload.counts"
    );

  const fanoutDesign =
    asRecord(
      payload.fanoutDesign,
      "payload.fanoutDesign"
    );

  const safety =
    asRecord(
      payload.safety,
      "payload.safety"
    );

  const students =
    asArray(
      payload.students,
      "payload.students"
    );

  const principals =
    asArray(
      payload.principals,
      "payload.principals"
    );

  const studentAliases =
    asArray(
      payload.studentAliases,
      "payload.studentAliases"
    );

  const principalAliases =
    asArray(
      payload.principalAliases,
      "payload.principalAliases"
    );

  const assignmentMappings =
    asArray(
      payload.assignmentMappings,
      "payload.assignmentMappings"
    );

  const attendanceMappings =
    asArray(
      payload.attendanceMappings,
      "payload.attendanceMappings"
    );

  const firebaseAuthTransitions =
    asArray(
      payload.firebaseAuthTransitions,
      "payload.firebaseAuthTransitions"
    );

  const exclusions =
    asRecord(
      payload.exclusions,
      "payload.exclusions"
    );

  const calculatedPayloadDigest =
    sha256(
      JSON.stringify(
        canonicalize(
          payload
        )
      )
    );

  const addedStudentFound =
    students.some(
      (item) => {
        const record =
          asRecord(
            item,
            "student"
          );

        return (
          text(record.identityRef) ===
            "SID_45547cd720aecc006641af29" &&
          text(record.newUid) ===
            "STU2_01KY8PQY008NA7SNS0NV600SJ1"
        );
      }
    );

  const studentUidFormats =
    students.every(
      (item) =>
        /^STU2_[0-9A-HJKMNP-TV-Z]{26}$/.test(
          text(
            asRecord(
              item,
              "student"
            ).newUid
          )
        )
    );

  const principalUidFormats =
    principals.every(
      (item) =>
        /^PRN2_[0-9A-HJKMNP-TV-Z]{26}$/.test(
          text(
            asRecord(
              item,
              "principal"
            ).newUid
          )
        )
    );

  const checks:
    GenericRecord = {
      envelopeDigest:
        text(
          envelope.payloadDigest
        ) ===
        calculatedPayloadDigest,
      requestId:
        text(
          payload.requestId
        ) ===
        REQUEST_ID,
      contract:
        text(
          payload.contractDigest
        ) ===
        CONTRACT_DIGEST,
      phase4c3rManifest:
        text(
          payload.phase4c3rManifestDigest
        ) ===
        EXPECTED_PHASE4C3R_MANIFEST_DIGEST,
      phase4c3rApproval:
        text(
          payload.phase4c3rApprovalDigest
        ) ===
        EXPECTED_PHASE4C3R_APPROVAL_DIGEST,
      stagedPlan:
        text(
          payload.stagedPlanDigest
        ) ===
        EXPECTED_STAGED_PLAN_DIGEST,
      allocationPlan:
        text(
          payload.allocationPlanDigest
        ) ===
        EXPECTED_ALLOCATION_PLAN_DIGEST,
      eligibility:
        text(
          payload.eligibilityDigest
        ) ===
        EXPECTED_ELIGIBILITY_DIGEST,
      rebaseManifest:
        text(
          payload.rebaseManifestDigest
        ) ===
        EXPECTED_REBASE_MANIFEST_DIGEST,
      counts:
        sameJson(
          counts,
          EXPECTED_PAYLOAD_COUNTS
        ),
      students:
        students.length ===
        156,
      principals:
        principals.length ===
        12,
      studentAliases:
        studentAliases.length ===
        85,
      principalAliases:
        principalAliases.length ===
        13,
      assignmentMappings:
        assignmentMappings.length ===
        14,
      attendanceMappings:
        attendanceMappings.length ===
        1,
      firebaseAuthTransitions:
        firebaseAuthTransitions.length ===
        1,
      orphanExclusions:
        asArray(
          exclusions.orphanStudentAuthUids,
          "orphanStudentAuthUids"
        ).length ===
        8,
      testPrincipalExclusions:
        asArray(
          exclusions.testPrincipalUids,
          "testPrincipalUids"
        ).length ===
        1,
      ambiguousExclusions:
        asArray(
          exclusions.ambiguousStudentAuthUids,
          "ambiguousStudentAuthUids"
        ).length ===
        0,
      addedStudent:
        addedStudentFound,
      studentUidFormats,
      principalUidFormats,
      fanoutDesign:
        Number(
          fanoutDesign.expectedFanoutRecordWrites ||
          0
        ) ===
          EXPECTED_FANOUT_RECORD_WRITES &&
        Number(
          fanoutDesign.expectedMetadataWrites ||
          0
        ) ===
          EXPECTED_FANOUT_METADATA_WRITES &&
        Number(
          fanoutDesign.expectedFutureTotalWrites ||
          0
        ) ===
          EXPECTED_FUTURE_FANOUT_TOTAL_WRITES,
      safety:
        safety.fullPhoneIncluded ===
          false &&
        safety.passwordMaterialIncluded ===
          false &&
        safety.sourceDataWritesAllowed ===
          false &&
        safety.fanoutExecutionIncluded ===
          false &&
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
      `Phase 4C-4R payload validation failed: ${failedChecks.join(", ")}`,
      {
        failedChecks
      }
    );
  }

  return {
    payload,
    counts,
    calculatedPayloadDigest,
    payloadBytes:
      Buffer.byteLength(
        JSON.stringify(
          canonicalize(
            payload
          )
        ),
        "utf8"
      )
  };
}

function payloadCore(
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
    approvedByFirebaseUid:
      data.approvedByFirebaseUid,
    contractDigest:
      data.contractDigest,
    phase4c3rManifestDigest:
      data.phase4c3rManifestDigest,
    phase4c3rApprovalDigest:
      data.phase4c3rApprovalDigest,
    stagedPlanDigest:
      data.stagedPlanDigest,
    allocationPlanDigest:
      data.allocationPlanDigest,
    eligibilityDigest:
      data.eligibilityDigest,
    rebaseManifestDigest:
      data.rebaseManifestDigest,
    payloadDigest:
      data.payloadDigest,
    payloadBytes:
      data.payloadBytes,
    counts:
      data.counts,
    payload:
      data.payload,
    status:
      data.status,
    safety:
      data.safety
  };
}

function designCore(
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
    approvedByFirebaseUid:
      data.approvedByFirebaseUid,
    contractDigest:
      data.contractDigest,
    phase4c3rManifestDigest:
      data.phase4c3rManifestDigest,
    payloadDigest:
      data.payloadDigest,
    payloadStoredDigest:
      data.payloadStoredDigest,
    counts:
      data.counts,
    collectionLayout:
      data.collectionLayout,
    expectedFanoutRecordWrites:
      data.expectedFanoutRecordWrites,
    expectedFanoutMetadataWrites:
      data.expectedFanoutMetadataWrites,
    expectedFutureFanoutTotalWrites:
      data.expectedFutureFanoutTotalWrites,
    fanoutExecutionIncluded:
      data.fanoutExecutionIncluded,
    status:
      data.status,
    safety:
      data.safety
  };
}

function publicPayload(
  data: GenericRecord,
  duplicate: boolean,
  writeOperations: number
) {
  return {
    ok:
      true,
    version:
      UID_V2_REBASE_PAYLOAD_DESIGN_PHASE4C4R_VERSION,
    mode:
      "rebase156_allocation_payload_single_document_staging",
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
    payloadDigest:
      text(
        data.payloadDigest
      ),
    payloadBytes:
      Number(
        data.payloadBytes ||
        0
      ),
    counts:
      data.counts,
    safety: {
      isolatedPayloadWrites:
        writeOperations,
      isolatedFanoutDesignWrites:
        0,
      activeUidRegistryWrites:
        0,
      sourceSheetWrites:
        0,
      attendanceWrites:
        0,
      assignmentWrites:
        0,
      firebaseAuthWrites:
        0,
      fanoutExecutionIncluded:
        false,
      actualUidCutoverAllowed:
        false
    }
  };
}

function publicDesign(
  data: GenericRecord,
  duplicate: boolean,
  writeOperations: number
) {
  return {
    ok:
      true,
    version:
      UID_V2_REBASE_PAYLOAD_DESIGN_PHASE4C4R_VERSION,
    mode:
      "rebase156_isolated_fanout_design_only",
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
    payloadDigest:
      text(
        data.payloadDigest
      ),
    fanoutDesignDigest:
      text(
        data.fanoutDesignDigest
      ),
    counts:
      data.counts,
    expectedFanoutRecordWrites:
      Number(
        data.expectedFanoutRecordWrites ||
        0
      ),
    expectedFanoutMetadataWrites:
      Number(
        data.expectedFanoutMetadataWrites ||
        0
      ),
    expectedFutureFanoutTotalWrites:
      Number(
        data.expectedFutureFanoutTotalWrites ||
        0
      ),
    fanoutExecutionIncluded:
      data.fanoutExecutionIncluded ===
      true,
    safety: {
      isolatedPayloadWrites:
        0,
      isolatedFanoutDesignWrites:
        writeOperations,
      activeUidRegistryWrites:
        0,
      sourceSheetWrites:
        0,
      attendanceWrites:
        0,
      assignmentWrites:
        0,
      firebaseAuthWrites:
        0,
      fanoutExecutionIncluded:
        false,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        "Phase 4C-5R isolated fan-out execution and full verification",
      allowed:
        true,
      actualUidCutoverAllowed:
        false
    }
  };
}

export const stageUidV2RebasePayloadPhase4c4r =
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
          ? request.data as StagePayloadInput
          : {};

      if (
        text(input.requestId) !==
          REQUEST_ID ||
        text(input.contractDigest) !==
          CONTRACT_DIGEST ||
        input.confirmIsolatedPayloadOnly !==
          true ||
        input.confirmNoSourceWrites !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-4R payload input gate failed."
        );
      }

      const validated =
        validatePayload(
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

      const manifestSnapshot =
        await runRef
          .collection(
            "rebaseManifests"
          )
          .doc(
            "phase4c3r"
          )
          .get();

      if (!manifestSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-3R manifest is missing."
        );
      }

      const manifest =
        manifestSnapshot.data() ||
        {};

      const manifestChecks:
        GenericRecord = {
        contract:
          text(
            manifest.contractDigest
          ) ===
          EXPECTED_PHASE4C3R_CONTRACT_DIGEST,
        manifestDigest:
          text(
            manifest.manifestDigest
          ) ===
          EXPECTED_PHASE4C3R_MANIFEST_DIGEST,
        approvalDigest:
          text(
            manifest.approvalDigest
          ) ===
          EXPECTED_PHASE4C3R_APPROVAL_DIGEST,
        approvalGeneration:
          Number(
            manifest.approvalGeneration ||
            0
          ) ===
          EXPECTED_APPROVAL_GENERATION,
        stagedPlanDigest:
          text(
            manifest.stagedPlanDigest
          ) ===
          EXPECTED_STAGED_PLAN_DIGEST,
        approvalValidAtStage:
          manifest.approvalValidAtStage ===
          true,
        noExecution:
          (
            manifest.safety as GenericRecord
          )?.executionCallableIncluded ===
          false,
        noCutover:
          (
            manifest.safety as GenericRecord
          )?.actualUidCutoverAllowed ===
          false
      };

      if (!allTrue(manifestChecks)) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-3R manifest binding failed."
        );
      }

      const targetRef =
        runRef
          .collection(
            "rebasePayloads"
          )
          .doc(
            "phase4c4r"
          );

      const core:
        GenericRecord = {
        version:
          UID_V2_REBASE_PAYLOAD_DESIGN_PHASE4C4R_VERSION,
        phase:
          "Phase 4C-4R",
        mode:
          "rebase156_allocation_payload_single_document_staging",
        requestId:
          REQUEST_ID,
        approvedByFirebaseUid:
          callerUid,
        contractDigest:
          CONTRACT_DIGEST,
        phase4c3rManifestDigest:
          EXPECTED_PHASE4C3R_MANIFEST_DIGEST,
        phase4c3rApprovalDigest:
          EXPECTED_PHASE4C3R_APPROVAL_DIGEST,
        stagedPlanDigest:
          EXPECTED_STAGED_PLAN_DIGEST,
        allocationPlanDigest:
          EXPECTED_ALLOCATION_PLAN_DIGEST,
        eligibilityDigest:
          EXPECTED_ELIGIBILITY_DIGEST,
        rebaseManifestDigest:
          EXPECTED_REBASE_MANIFEST_DIGEST,
        payloadDigest:
          validated.calculatedPayloadDigest,
        payloadBytes:
          validated.payloadBytes,
        counts:
          validated.counts,
        payload:
          validated.payload,
        status:
          "rebase_allocation_payload_staged",
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
          fanoutExecutionIncluded:
            false,
          actualUidCutoverAllowed:
            false
        }
      };

      const storedDigest =
        sha256(
          JSON.stringify(
            canonicalize(
              core
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
              existing.data() ||
              {};

            if (
              text(
                data.payloadDigest
              ) !==
                validated.calculatedPayloadDigest ||
              text(
                data.contractDigest
              ) !==
                CONTRACT_DIGEST ||
              text(
                data.storedDigest
              ) !==
                storedDigest
            ) {
              throw new HttpsError(
                "already-exists",
                "A conflicting Phase 4C-4R payload exists."
              );
            }

            duplicate = true;
            output = data;
            return;
          }

          output = {
            ...core,
            storedDigest,
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

      return publicPayload(
        output,
        duplicate,
        writeOperations
      );
    }
  );

export const stageUidV2RebaseFanoutDesignPhase4c4r =
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
          ? request.data as StageDesignInput
          : {};

      if (
        text(input.requestId) !==
          REQUEST_ID ||
        text(input.contractDigest) !==
          CONTRACT_DIGEST ||
        input.confirmDesignOnly !==
          true ||
        input.confirmNoFanoutExecution !==
          true
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-4R fan-out design input gate failed."
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

      const payloadRef =
        runRef
          .collection(
            "rebasePayloads"
          )
          .doc(
            "phase4c4r"
          );

      const designRef =
        runRef
          .collection(
            "rebaseFanoutDesigns"
          )
          .doc(
            "phase4c4r"
          );

      let duplicate =
        false;
      let writeOperations =
        0;
      let output:
        GenericRecord = {};

      await db.runTransaction(
        async (transaction) => {
          const [
            payloadSnapshot,
            designSnapshot
          ] =
            await Promise.all([
              transaction.get(
                payloadRef
              ),
              transaction.get(
                designRef
              )
            ]);

          if (!payloadSnapshot.exists) {
            throw new HttpsError(
              "not-found",
              "Phase 4C-4R payload is missing."
            );
          }

          const payload =
            payloadSnapshot.data() ||
            {};

          const payloadStoredDigest =
            sha256(
              JSON.stringify(
                canonicalize(
                  payloadCore(
                    payload
                  )
                )
              )
            );

          const payloadChecks:
            GenericRecord = {
            contract:
              text(
                payload.contractDigest
              ) ===
              CONTRACT_DIGEST,
            storedDigest:
              text(
                payload.storedDigest
              ) ===
              payloadStoredDigest,
            counts:
              sameJson(
                payload.counts,
                EXPECTED_PAYLOAD_COUNTS
              ),
            status:
              text(
                payload.status
              ) ===
              "rebase_allocation_payload_staged",
            noFanout:
              (
                payload.safety as GenericRecord
              )?.fanoutExecutionIncluded ===
              false,
            noCutover:
              (
                payload.safety as GenericRecord
              )?.actualUidCutoverAllowed ===
              false
          };

          if (!allTrue(payloadChecks)) {
            throw new HttpsError(
              "failed-precondition",
              "Phase 4C-4R stored payload verification failed."
            );
          }

          const core:
            GenericRecord = {
            version:
              UID_V2_REBASE_PAYLOAD_DESIGN_PHASE4C4R_VERSION,
            phase:
              "Phase 4C-4R",
            mode:
              "rebase156_isolated_fanout_design_only",
            requestId:
              REQUEST_ID,
            approvedByFirebaseUid:
              callerUid,
            contractDigest:
              CONTRACT_DIGEST,
            phase4c3rManifestDigest:
              EXPECTED_PHASE4C3R_MANIFEST_DIGEST,
            payloadDigest:
              payload.payloadDigest,
            payloadStoredDigest:
              payload.storedDigest,
            counts:
              EXPECTED_FANOUT_COUNTS,
            collectionLayout: {
              students:
                "rebaseFanoutStudents",
              principals:
                "rebaseFanoutPrincipals",
              studentAliases:
                "rebaseFanoutStudentAliases",
              principalAliases:
                "rebaseFanoutPrincipalAliases",
              assignmentMappings:
                "rebaseFanoutAssignmentMappings",
              attendanceMappings:
                "rebaseFanoutAttendanceMappings",
              firebaseAuthTransitions:
                "rebaseFanoutAuthTransitions",
              exclusions:
                "rebaseFanoutExclusions",
              metadata:
                "rebaseFanoutMetadata/phase4c5r"
            },
            expectedFanoutRecordWrites:
              EXPECTED_FANOUT_RECORD_WRITES,
            expectedFanoutMetadataWrites:
              EXPECTED_FANOUT_METADATA_WRITES,
            expectedFutureFanoutTotalWrites:
              EXPECTED_FUTURE_FANOUT_TOTAL_WRITES,
            fanoutExecutionIncluded:
              false,
            status:
              "rebase_fanout_design_staged",
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
              fanoutExecutionIncluded:
                false,
              actualUidCutoverAllowed:
                false
            }
          };

          const fanoutDesignDigest =
            sha256(
              JSON.stringify(
                canonicalize(
                  core
                )
              )
            );

          if (designSnapshot.exists) {
            const data =
              designSnapshot.data() ||
              {};

            if (
              text(
                data.fanoutDesignDigest
              ) !==
                fanoutDesignDigest ||
              text(
                data.payloadDigest
              ) !==
                text(
                  payload.payloadDigest
                )
            ) {
              throw new HttpsError(
                "already-exists",
                "A conflicting Phase 4C-4R fan-out design exists."
              );
            }

            duplicate = true;
            output = data;
            return;
          }

          output = {
            ...core,
            fanoutDesignDigest,
            createdAtIso:
              new Date().toISOString()
          };

          transaction.set(
            designRef,
            output
          );

          writeOperations = 1;
        }
      );

      return publicDesign(
        output,
        duplicate,
        writeOperations
      );
    }
  );

export const inspectUidV2RebasePayloadDesignPhase4c4r =
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
          CONTRACT_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-4R inspect input gate failed."
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
        payloadSnapshot,
        designSnapshot
      ] =
        await Promise.all([
          runRef
            .collection(
              "rebasePayloads"
            )
            .doc(
              "phase4c4r"
            )
            .get(),
          runRef
            .collection(
              "rebaseFanoutDesigns"
            )
            .doc(
              "phase4c4r"
            )
            .get()
        ]);

      if (
        !payloadSnapshot.exists ||
        !designSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-4R payload or design is missing."
        );
      }

      const payload =
        payloadSnapshot.data() ||
        {};

      const design =
        designSnapshot.data() ||
        {};

      const payloadRecomputed =
        sha256(
          JSON.stringify(
            canonicalize(
              payloadCore(
                payload
              )
            )
          )
        );

      const designRecomputed =
        sha256(
          JSON.stringify(
            canonicalize(
              designCore(
                design
              )
            )
          )
        );

      const checks:
        GenericRecord = {
        payloadStoredDigest:
          text(
            payload.storedDigest
          ) ===
          payloadRecomputed,
        fanoutDesignDigest:
          text(
            design.fanoutDesignDigest
          ) ===
          designRecomputed,
        payloadBinding:
          text(
            payload.payloadDigest
          ) ===
          text(
            design.payloadDigest
          ),
        contract:
          text(
            payload.contractDigest
          ) ===
            CONTRACT_DIGEST &&
          text(
            design.contractDigest
          ) ===
            CONTRACT_DIGEST,
        payloadCounts:
          sameJson(
            payload.counts,
            EXPECTED_PAYLOAD_COUNTS
          ),
        fanoutCounts:
          sameJson(
            design.counts,
            EXPECTED_FANOUT_COUNTS
          ),
        recordWrites:
          Number(
            design.expectedFanoutRecordWrites ||
            0
          ) ===
          EXPECTED_FANOUT_RECORD_WRITES,
        metadataWrites:
          Number(
            design.expectedFanoutMetadataWrites ||
            0
          ) ===
          EXPECTED_FANOUT_METADATA_WRITES,
        futureTotal:
          Number(
            design.expectedFutureFanoutTotalWrites ||
            0
          ) ===
          EXPECTED_FUTURE_FANOUT_TOTAL_WRITES,
        noExecution:
          design.fanoutExecutionIncluded ===
            false &&
          (
            design.safety as GenericRecord
          )?.fanoutExecutionIncluded ===
            false,
        noCutover:
          (
            design.safety as GenericRecord
          )?.actualUidCutoverAllowed ===
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
          `Phase 4C-4R stored verification failed: ${failedChecks.join(", ")}`,
          {
            failedChecks
          }
        );
      }

      return {
        ok:
          true,
        version:
          UID_V2_REBASE_PAYLOAD_DESIGN_PHASE4C4R_VERSION,
        mode:
          "rebase156_payload_and_fanout_design_inspection",
        requestId:
          REQUEST_ID,
        contractDigest:
          CONTRACT_DIGEST,
        payload: {
          status:
            text(
              payload.status
            ),
          payloadDigest:
            text(
              payload.payloadDigest
            ),
          payloadBytes:
            Number(
              payload.payloadBytes ||
              0
            ),
          counts:
            payload.counts
        },
        fanoutDesign: {
          status:
            text(
              design.status
            ),
          fanoutDesignDigest:
            text(
              design.fanoutDesignDigest
            ),
          counts:
            design.counts,
          expectedFanoutRecordWrites:
            Number(
              design.expectedFanoutRecordWrites ||
              0
            ),
          expectedFanoutMetadataWrites:
            Number(
              design.expectedFanoutMetadataWrites ||
              0
            ),
          expectedFutureFanoutTotalWrites:
            Number(
              design.expectedFutureFanoutTotalWrites ||
              0
            )
        },
        verified:
          true,
        digestMatches:
          true,
        safety: {
          isolatedPayloadRecords:
            1,
          isolatedFanoutDesignRecords:
            1,
          activeUidRegistryWrites:
            0,
          sourceSheetWrites:
            0,
          attendanceWrites:
            0,
          assignmentWrites:
            0,
          firebaseAuthWrites:
            0,
          fanoutExecutionIncluded:
            false,
          executionCallableIncluded:
            false,
          actualUidCutoverAllowed:
            false
        },
        nextGate: {
          phase:
            "Phase 4C-5R isolated fan-out execution and full verification",
          allowed:
            true,
          actualUidCutoverAllowed:
            false
        }
      };
    }
  );
