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

export const UID_V2_ALLOCATION_PAYLOAD_PHASE4C5_VERSION =
  "2026-07-24.716.17-phase4c5-allocation-payload-single-document-staging";

const REGION = "asia-northeast3";
const STAGING_RUN_COLLECTION =
  "uidV2StagingRuns";
const EXPECTED_REQUEST_ID =
  "phase4c3-20260724142743-62e47ac1-8e06-4cf7-b379-25d2373fa42d";
const EXPECTED_MANIFEST_DIGEST =
  "ad016e27f96fddf140b3f2451bf24ea18b476ff55f6185b816b101c1a1ec6e3a";
const EXPECTED_ALLOCATION_PLAN_DIGEST =
  "3f84a507ce2e319d4569bdaf09c97b431a81863beb4030415cebb90c7bd15a23";
const EXPECTED_STAGING_PLAN_DIGEST =
  "fb371357ad163def2666707242603cc1b5d93a095048528fbbb4a46dedc92e6d";
const EXPECTED_REFERENCE_AUDIT_DIGEST =
  "42a61f565e4773852aef7e5d0cd9720711e21d667c6f20f9bc9c3a915153d8ff";
const EXPECTED_STAGING_SNAPSHOT_ID =
  "P4C2_fb371357ad163def2666";
const EXPECTED_COUNTS = Object.freeze(
  {"students":155,"principals":12,"studentAliases":85,"principalAliases":13,"generatedUids":167,"assignmentMappings":14,"attendanceMappings":1,"firebaseAuthTransitions":1,"orphanStudentAuthExclusions":8,"testPrincipalExclusions":1}
);

type GenericRecord =
  Record<string, unknown>;

interface StageInput {
  readonly requestId?: unknown;
  readonly manifestDigest?: unknown;
  readonly payloadDigest?: unknown;
  readonly payload?: unknown;
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

function strings(
  value: unknown
): string[] {
  return Array.isArray(value)
    ? value.map(text).filter(Boolean)
    : [];
}

function requireSuperAdmin(
  auth:
    | {
        uid: string;
        token: GenericRecord;
      }
    | undefined
) {
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

  return {
    uid: auth.uid
  };
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
            value as
              GenericRecord
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
    .update(
      value,
      "utf8"
    )
    .digest("hex");
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
      "invalid-argument",
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
      "invalid-argument",
      `${label} must be an array.`
    );
  }

  return value;
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

  for (
    const [
      key,
      nested
    ] of Object.entries(
      value as GenericRecord
    )
  ) {
    if (
      /^(?:phone|fullPhone|email|password|passwordHash|salt|secret|credential|accessToken|refreshToken)$/i.test(
        key
      )
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Sensitive key is not allowed: ${path}.${key}`
      );
    }

    rejectSensitiveKeys(
      nested,
      `${path}.${key}`
    );
  }
}

function validateCounts(
  payload: GenericRecord
): GenericRecord {
  const counts =
    asRecord(
      payload.counts,
      "payload.counts"
    );

  for (
    const [
      key,
      expected
    ] of Object.entries(
      EXPECTED_COUNTS
    )
  ) {
    const actual =
      Number(counts[key]);

    if (
      !Number.isInteger(actual) ||
      actual !== expected
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Count mismatch for ${key}.`
      );
    }
  }

  return counts;
}

function validatePayload(
  value: unknown
): GenericRecord {
  const payload =
    asRecord(
      value,
      "payload"
    );

  rejectSensitiveKeys(payload);

  const checks = {
    requestId:
      text(payload.requestId) ===
      EXPECTED_REQUEST_ID,
    manifestDigest:
      text(payload.manifestDigest) ===
      EXPECTED_MANIFEST_DIGEST,
    allocationPlanDigest:
      text(
        payload.allocationPlanDigest
      ) ===
      EXPECTED_ALLOCATION_PLAN_DIGEST,
    stagingPlanDigest:
      text(
        payload.stagingPlanDigest
      ) ===
      EXPECTED_STAGING_PLAN_DIGEST,
    referenceAuditDigest:
      text(
        payload.referenceAuditDigest
      ) ===
      EXPECTED_REFERENCE_AUDIT_DIGEST,
    stagingSnapshotId:
      text(
        payload.stagingSnapshotId
      ) ===
      EXPECTED_STAGING_SNAPSHOT_ID
  };

  const failed =
    Object.entries(checks)
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
      `Payload gate failed: ${failed.join(", ")}`
    );
  }

  validateCounts(payload);

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

  const authTransitions =
    asArray(
      payload.firebaseAuthTransitions,
      "payload.firebaseAuthTransitions"
    );

  const exclusions =
    asRecord(
      payload.exclusions,
      "payload.exclusions"
    );

  const arrayChecks = {
    students:
      students.length ===
      EXPECTED_COUNTS.students,
    principals:
      principals.length ===
      EXPECTED_COUNTS.principals,
    studentAliases:
      studentAliases.length ===
      EXPECTED_COUNTS.studentAliases,
    principalAliases:
      principalAliases.length ===
      EXPECTED_COUNTS.principalAliases,
    assignmentMappings:
      assignmentMappings.length ===
      EXPECTED_COUNTS.assignmentMappings,
    attendanceMappings:
      attendanceMappings.length ===
      EXPECTED_COUNTS.attendanceMappings,
    firebaseAuthTransitions:
      authTransitions.length ===
      EXPECTED_COUNTS.firebaseAuthTransitions,
    orphanStudentAuthExclusions:
      strings(
        exclusions.orphanStudentAuthUids
      ).length ===
      EXPECTED_COUNTS.orphanStudentAuthExclusions,
    testPrincipalExclusions:
      strings(
        exclusions.testPrincipalUids
      ).length ===
      EXPECTED_COUNTS.testPrincipalExclusions
  };

  const failedArrays =
    Object.entries(arrayChecks)
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

  if (failedArrays.length > 0) {
    throw new HttpsError(
      "failed-precondition",
      `Payload array gate failed: ${failedArrays.join(", ")}`
    );
  }

  const studentUids =
    students.map(
      (item, index) => {
        const record =
          asRecord(
            item,
            `students[${index}]`
          );

        const uid =
          text(record.newUid);

        if (
          !/^STU2_[0-9A-HJKMNP-TV-Z]{26}$/.test(
            uid
          )
        ) {
          throw new HttpsError(
            "failed-precondition",
            `Invalid STU2 UID at index ${index}.`
          );
        }

        return uid;
      }
    );

  const principalUids =
    principals.map(
      (item, index) => {
        const record =
          asRecord(
            item,
            `principals[${index}]`
          );

        const uid =
          text(record.newUid);

        if (
          !/^PRN2_[0-9A-HJKMNP-TV-Z]{26}$/.test(
            uid
          )
        ) {
          throw new HttpsError(
            "failed-precondition",
            `Invalid PRN2 UID at index ${index}.`
          );
        }

        return uid;
      }
    );

  if (
    new Set(studentUids).size !==
      studentUids.length ||
    new Set(principalUids).size !==
      principalUids.length
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Duplicate generated UID found."
    );
  }

  const studentUidSet =
    new Set(studentUids);

  for (
    const [
      index,
      item
    ] of studentAliases.entries()
  ) {
    const alias =
      asRecord(
        item,
        `studentAliases[${index}]`
      );

    if (
      !/^STU-\d{8}-[0-9A-F]{8}$/i.test(
        text(alias.oldUid)
      ) ||
      !studentUidSet.has(
        text(alias.newUid)
      )
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Invalid student alias at index ${index}.`
      );
    }
  }

  const principalUidSet =
    new Set(principalUids);

  for (
    const [
      index,
      item
    ] of principalAliases.entries()
  ) {
    const alias =
      asRecord(
        item,
        `principalAliases[${index}]`
      );

    if (
      !/^ADM-\d{8}-[0-9A-F]{8}$/i.test(
        text(alias.oldUid)
      ) ||
      !principalUidSet.has(
        text(alias.newUid)
      ) ||
      text(alias.oldUid) ===
        "ADM-20260706-C094822C"
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Invalid principal alias at index ${index}.`
      );
    }
  }

  return payload;
}

function publicResult(
  data: GenericRecord,
  duplicate: boolean,
  writeOperations: number
) {
  return {
    ok: true,
    version:
      UID_V2_ALLOCATION_PAYLOAD_PHASE4C5_VERSION,
    mode:
      "allocation_payload_single_document_staging",
    requestId:
      text(data.requestId),
    duplicate,
    writeOperations,
    status:
      text(data.status),
    payloadDigest:
      text(data.payloadDigest),
    payloadBytes:
      Number(data.payloadBytes || 0),
    counts:
      data.counts,
    safety: {
      isolatedPayloadWrites:
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
      sessionChanges:
        0,
      actualUidCutoverAllowed:
        false
    },
    nextGate: {
      phase:
        "Phase 4C-6 isolated payload fan-out and verification",
      allowed:
        text(data.status) ===
        "allocation_payload_staged",
      actualUidCutoverAllowed:
        false
    }
  };
}

export const stageUidV2AllocationPayloadPhase4c5 =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        180,
      memory:
        "512MiB",
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
                  GenericRecord;
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
          EXPECTED_REQUEST_ID ||
        text(input.manifestDigest) !==
          EXPECTED_MANIFEST_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-4 manifest identity mismatch."
        );
      }

      const payload =
        validatePayload(
          input.payload
        );

      const canonicalPayload =
        canonicalize(
          payload
        ) as GenericRecord;

      const payloadJson =
        JSON.stringify(
          canonicalPayload
        );

      const calculatedDigest =
        sha256(payloadJson);

      if (
        text(input.payloadDigest) !==
        calculatedDigest
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Payload SHA-256 digest mismatch."
        );
      }

      const payloadBytes =
        Buffer.byteLength(
          payloadJson,
          "utf8"
        );

      if (payloadBytes > 850000) {
        throw new HttpsError(
          "resource-exhausted",
          "Payload is too large for isolated single-document staging."
        );
      }

      const app =
        defaultAdminApp();

      const db =
        getFirestore(app);

      const runRef =
        db.collection(
          STAGING_RUN_COLLECTION
        ).doc(
          EXPECTED_REQUEST_ID
        );

      const payloadRef =
        runRef
          .collection("payloads")
          .doc("allocation");

      let duplicate =
        false;

      let writeOperations =
        0;

      let finalData:
        GenericRecord
        | undefined;

      await db.runTransaction(
        async (transaction) => {
          const runSnapshot =
            await transaction.get(
              runRef
            );

          if (!runSnapshot.exists) {
            throw new HttpsError(
              "not-found",
              "Phase 4C-4 staging manifest was not found."
            );
          }

          const run =
            runSnapshot.data() || {};

          const manifestChecks = {
            status:
              text(run.status) ===
              "isolated_manifest_staged",
            sameCaller:
              text(
                run.approvedByFirebaseUid
              ) ===
              caller.uid,
            manifestDigest:
              text(run.manifestDigest) ===
              EXPECTED_MANIFEST_DIGEST,
            allocationPlanDigest:
              text(
                run.allocationPlanDigest
              ) ===
              EXPECTED_ALLOCATION_PLAN_DIGEST,
            stagingPlanDigest:
              text(
                run.stagingPlanDigest
              ) ===
              EXPECTED_STAGING_PLAN_DIGEST,
            referenceAuditDigest:
              text(
                run.referenceAuditDigest
              ) ===
              EXPECTED_REFERENCE_AUDIT_DIGEST,
            stagingSnapshotId:
              text(
                run.stagingSnapshotId
              ) ===
              EXPECTED_STAGING_SNAPSHOT_ID,
            cutoverBlocked:
              run.actualUidCutoverAllowed ===
              false
          };

          const failed =
            Object.entries(
              manifestChecks
            )
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
              `Manifest validation failed: ${failed.join(", ")}`
            );
          }

          const existing =
            await transaction.get(
              payloadRef
            );

          if (existing.exists) {
            const data =
              existing.data() || {};

            const same =
              text(data.payloadDigest) ===
                calculatedDigest &&
              text(data.approvedByFirebaseUid) ===
                caller.uid;

            if (!same) {
              throw new HttpsError(
                "already-exists",
                "A different allocation payload is already staged."
              );
            }

            duplicate = true;
            finalData = data;
            return;
          }

          const data:
            GenericRecord = {
              version:
                UID_V2_ALLOCATION_PAYLOAD_PHASE4C5_VERSION,
              phase:
                "Phase 4C-5",
              mode:
                "allocation_payload_single_document_staging",
              requestId:
                EXPECTED_REQUEST_ID,
              status:
                "allocation_payload_staged",
              approvedByFirebaseUid:
                caller.uid,
              stagedAt:
                Timestamp.now(),
              manifestDigest:
                EXPECTED_MANIFEST_DIGEST,
              allocationPlanDigest:
                EXPECTED_ALLOCATION_PLAN_DIGEST,
              stagingPlanDigest:
                EXPECTED_STAGING_PLAN_DIGEST,
              referenceAuditDigest:
                EXPECTED_REFERENCE_AUDIT_DIGEST,
              stagingSnapshotId:
                EXPECTED_STAGING_SNAPSHOT_ID,
              payloadDigest:
                calculatedDigest,
              payloadBytes,
              counts:
                canonicalPayload.counts,
              payload:
                canonicalPayload,
              activeUidRegistryWrites:
                0,
              sourceDataWrites:
                0,
              actualUidCutoverAllowed:
                false
            };

          transaction.create(
            payloadRef,
            data
          );

          writeOperations = 1;
          finalData = data;
        }
      );

      if (!finalData) {
        throw new HttpsError(
          "internal",
          "Staged payload was not resolved."
        );
      }

      return publicResult(
        finalData,
        duplicate,
        writeOperations
      );
    }
  );

export const inspectUidV2AllocationPayloadPhase4c5 =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        60,
      memory:
        "512MiB",
      enforceAppCheck:
        false
    },
    async (request) => {
      requireSuperAdmin(
        request.auth as
          | {
              uid: string;
              token:
                GenericRecord;
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
        EXPECTED_REQUEST_ID
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Unexpected requestId."
        );
      }

      const app =
        defaultAdminApp();

      const snapshot =
        await getFirestore(app)
          .collection(
            STAGING_RUN_COLLECTION
          )
          .doc(
            EXPECTED_REQUEST_ID
          )
          .collection("payloads")
          .doc("allocation")
          .get();

      if (!snapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-5 allocation payload was not found."
        );
      }

      const data =
        snapshot.data() || {};

      const payload =
        validatePayload(
          data.payload
        );

      const calculatedDigest =
        sha256(
          JSON.stringify(
            canonicalize(
              payload
            )
          )
        );

      const digestMatches =
        calculatedDigest ===
        text(data.payloadDigest);

      const result =
        publicResult(
          data,
          true,
          0
        );

      return {
        ...result,
        verified:
          digestMatches,
        calculatedPayloadDigest:
          calculatedDigest,
        digestMatches,
        readOperations:
          1
      };
    }
  );
