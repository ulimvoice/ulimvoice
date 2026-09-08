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
  Timestamp,
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_V2_ISOLATED_FANOUT_PHASE4C6_VERSION =
  "2026-07-25.716.18-phase4c6-isolated-payload-fanout-and-full-verification";

const REGION =
  "asia-northeast3";
const STAGING_RUN_COLLECTION =
  "uidV2StagingRuns";

const EXPECTED_REQUEST_ID =
  "phase4c3-20260724142743-62e47ac1-8e06-4cf7-b379-25d2373fa42d";
const EXPECTED_PAYLOAD_DIGEST =
  "a3a7641e934772e39ea8241438517c1643435434c8636fbe00cbe415cc66ceae";
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
const EXPECTED_CONTRACT_DIGEST =
  "88ae754641d3356f605ddd8593e7d3e3f6297286d2df294823833938df6e491e";

const EXPECTED_COUNTS = Object.freeze(
  {"students":155,"principals":12,"studentAliases":85,"principalAliases":13,"assignmentMappings":14,"attendanceMappings":1,"firebaseAuthTransitions":1,"exclusions":1}
);

const EXPECTED_FANOUT_RECORD_WRITES =
  282;
const EXPECTED_TOTAL_ISOLATED_WRITES =
  283;

type GenericRecord =
  Record<string, unknown>;

type FanoutKey =
  | "students"
  | "principals"
  | "studentAliases"
  | "principalAliases"
  | "assignmentMappings"
  | "attendanceMappings"
  | "firebaseAuthTransitions"
  | "exclusions";

interface FanoutEntry {
  readonly id: string;
  readonly data: GenericRecord;
}

type FanoutPlan =
  Record<FanoutKey, FanoutEntry[]>;

interface CallableInput {
  readonly requestId?: unknown;
  readonly payloadDigest?: unknown;
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
) {
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "Firebase authentication is required."
    );
  }

  const roles =
    strings(auth.token.roles);

  const isSuperAdmin =
    text(auth.token.role) ===
      "superAdmin" ||
    text(auth.token.ulimRole) ===
      "superAdmin" ||
    text(auth.token.accountRole) ===
      "superAdmin" ||
    roles.includes("superAdmin");

  if (!isSuperAdmin) {
    throw new HttpsError(
      "permission-denied",
      "superAdmin claim is required."
    );
  }

  return {
    uid: auth.uid
  };
}

function validateInput(
  value: unknown
): void {
  const source =
    value &&
    typeof value === "object"
      ? value as CallableInput
      : {};

  const checks = {
    requestId:
      text(source.requestId) ===
      EXPECTED_REQUEST_ID,
    payloadDigest:
      text(source.payloadDigest) ===
      EXPECTED_PAYLOAD_DIGEST,
    contractDigest:
      text(source.contractDigest) ===
      EXPECTED_CONTRACT_DIGEST
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
      `Phase 4C-6 input gate failed: ${failed.join(", ")}`
    );
  }
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

function stableId(
  value: string
): string {
  return sha256(value)
    .slice(0, 40);
}

function withoutUndefined(
  value: GenericRecord
): GenericRecord {
  const output:
    GenericRecord = {};

  for (
    const [
      key,
      nested
    ] of Object.entries(value)
  ) {
    if (nested !== undefined) {
      output[key] = nested;
    }
  }

  return output;
}

function makeEntries(
  values: unknown[],
  idFactory: (
    source: GenericRecord,
    index: number
  ) => string,
  recordType: string
): FanoutEntry[] {
  return values.map(
    (value, index) => {
      const source =
        asRecord(
          value,
          `${recordType}[${index}]`
        );

      const id =
        idFactory(
          source,
          index
        );

      if (!id || id.includes("/")) {
        throw new HttpsError(
          "failed-precondition",
          `Invalid document id for ${recordType}[${index}].`
        );
      }

      return {
        id,
        data:
          withoutUndefined({
            ...source,
            recordType,
            payloadDigest:
              EXPECTED_PAYLOAD_DIGEST,
            activeRegistry:
              false,
            sourceDataChanged:
              false,
            actualUidCutoverAllowed:
              false
          })
      };
    }
  );
}

function buildFanoutPlan(
  payload: GenericRecord
): FanoutPlan {
  const students =
    makeEntries(
      asArray(
        payload.students,
        "payload.students"
      ),
      (source, index) => {
        const uid =
          text(source.newUid);

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
      },
      "student_uid_allocation"
    );

  const principals =
    makeEntries(
      asArray(
        payload.principals,
        "payload.principals"
      ),
      (source, index) => {
        const uid =
          text(source.newUid);

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
      },
      "principal_uid_allocation"
    );

  const studentAliases =
    makeEntries(
      asArray(
        payload.studentAliases,
        "payload.studentAliases"
      ),
      (source) =>
        text(source.oldUid),
      "student_uid_alias"
    );

  const principalAliases =
    makeEntries(
      asArray(
        payload.principalAliases,
        "payload.principalAliases"
      ),
      (source) =>
        text(source.oldUid),
      "principal_uid_alias"
    );

  const assignmentMappings =
    makeEntries(
      asArray(
        payload.assignmentMappings,
        "payload.assignmentMappings"
      ),
      (source) =>
        stableId(
          text(source.oldPath)
        ),
      "assignment_path_mapping"
    );

  const attendanceMappings =
    makeEntries(
      asArray(
        payload.attendanceMappings,
        "payload.attendanceMappings"
      ),
      (source) =>
        stableId(
          text(source.oldPath)
        ),
      "attendance_path_mapping"
    );

  const firebaseAuthTransitions =
    makeEntries(
      asArray(
        payload.firebaseAuthTransitions,
        "payload.firebaseAuthTransitions"
      ),
      (source) =>
        stableId(
          text(source.oldFirebaseUid)
        ),
      "firebase_auth_transition_plan"
    );

  const exclusions: FanoutEntry[] = [
    {
      id:
        "summary",
      data:
        withoutUndefined({
          ...asRecord(
            payload.exclusions,
            "payload.exclusions"
          ),
          recordType:
            "uid_v2_exclusions",
          payloadDigest:
            EXPECTED_PAYLOAD_DIGEST,
          activeRegistry:
            false,
          sourceDataChanged:
            false,
          actualUidCutoverAllowed:
            false
        })
    }
  ];

  const plan: FanoutPlan = {
    students,
    principals,
    studentAliases,
    principalAliases,
    assignmentMappings,
    attendanceMappings,
    firebaseAuthTransitions,
    exclusions
  };

  const actualCounts =
    Object.fromEntries(
      (
        Object.keys(plan) as
          FanoutKey[]
      ).map(
        (key) => [
          key,
          plan[key].length
        ]
      )
    ) as
      Record<FanoutKey, number>;

  const failed =
    Object.entries(
      EXPECTED_COUNTS
    )
      .filter(
        (
          [
            key,
            expected
          ]
        ) =>
          actualCounts[
            key as FanoutKey
          ] !== expected
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
      `Fan-out count gate failed: ${failed.join(", ")}`
    );
  }

  const total =
    Object.values(plan)
      .reduce(
        (
          sum,
          entries
        ) =>
          sum +
          entries.length,
        0
      );

  if (
    total !==
    EXPECTED_FANOUT_RECORD_WRITES
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Unexpected fan-out record total."
    );
  }

  return plan;
}

function fanoutDigest(
  plan: FanoutPlan
): string {
  const stable =
    Object.fromEntries(
      (
        Object.keys(plan) as
          FanoutKey[]
      ).map(
        (key) => [
          key,
          plan[key]
            .map(
              (entry) => ({
                id:
                  entry.id,
                data:
                  canonicalize(
                    entry.data
                  )
              })
            )
            .sort(
              (
                left,
                right
              ) =>
                left.id.localeCompare(
                  right.id
                )
            )
        ]
      )
    );

  return sha256(
    JSON.stringify(
      canonicalize(stable)
    )
  );
}

function fanoutCollections(
  runRef:
    DocumentReference<DocumentData>
) {
  return {
    students:
      runRef.collection(
        "fanoutStudents"
      ),
    principals:
      runRef.collection(
        "fanoutPrincipals"
      ),
    studentAliases:
      runRef.collection(
        "fanoutStudentAliases"
      ),
    principalAliases:
      runRef.collection(
        "fanoutPrincipalAliases"
      ),
    assignmentMappings:
      runRef.collection(
        "fanoutAssignmentMappings"
      ),
    attendanceMappings:
      runRef.collection(
        "fanoutAttendanceMappings"
      ),
    firebaseAuthTransitions:
      runRef.collection(
        "fanoutFirebaseAuthTransitions"
      ),
    exclusions:
      runRef.collection(
        "fanoutExclusions"
      )
  };
}

async function readFanout(
  runRef:
    DocumentReference<DocumentData>
): Promise<FanoutPlan> {
  const collections =
    fanoutCollections(runRef);

  const output =
    {} as FanoutPlan;

  for (
    const key of
    Object.keys(
      collections
    ) as FanoutKey[]
  ) {
    const snapshot =
      await collections[key].get();

    output[key] =
      snapshot.docs.map(
        (document) => ({
          id:
            document.id,
          data:
            document.data()
        })
      );
  }

  return output;
}

function verifySafety(
  plan: FanoutPlan
) {
  const entries =
    Object.values(plan)
      .flat();

  return {
    payloadDigestMatches:
      entries.every(
        (entry) =>
          text(
            entry.data.payloadDigest
          ) ===
          EXPECTED_PAYLOAD_DIGEST
      ),
    activeRegistryBlocked:
      entries.every(
        (entry) =>
          entry.data.activeRegistry ===
          false
      ),
    sourceDataUnchanged:
      entries.every(
        (entry) =>
          entry.data.sourceDataChanged ===
          false
      ),
    cutoverBlocked:
      entries.every(
        (entry) =>
          entry.data.actualUidCutoverAllowed ===
          false
      )
  };
}

async function verifyFanout(
  runRef:
    DocumentReference<DocumentData>,
  metadata:
    GenericRecord
) {
  const plan =
    await readFanout(
      runRef
    );

  const counts =
    Object.fromEntries(
      (
        Object.keys(plan) as
          FanoutKey[]
      ).map(
        (key) => [
          key,
          plan[key].length
        ]
      )
    ) as
      Record<FanoutKey, number>;

  const countChecks =
    Object.fromEntries(
      Object.entries(
        EXPECTED_COUNTS
      )
        .map(
          (
            [
              key,
              expected
            ]
          ) => [
            key,
            counts[
              key as FanoutKey
            ] === expected
          ]
        )
    );

  const failedCounts =
    Object.entries(
      countChecks
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

  const calculatedFanoutDigest =
    fanoutDigest(plan);

  const digestMatches =
    calculatedFanoutDigest ===
    text(metadata.fanoutDigest);

  const safetyChecks =
    verifySafety(plan);

  const failedSafety =
    Object.entries(
      safetyChecks
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

  return {
    verified:
      failedCounts.length === 0 &&
      failedSafety.length === 0 &&
      digestMatches,
    counts,
    countChecks,
    failedCounts,
    calculatedFanoutDigest,
    digestMatches,
    safetyChecks,
    failedSafety,
    readOperations:
      EXPECTED_FANOUT_RECORD_WRITES +
      1
  };
}

function publicResult(
  metadata: GenericRecord,
  duplicate: boolean,
  writeOperations: number
) {
  return {
    ok: true,
    version:
      UID_V2_ISOLATED_FANOUT_PHASE4C6_VERSION,
    mode:
      "isolated_payload_fanout_and_full_verification",
    requestId:
      text(metadata.requestId),
    duplicate,
    writeOperations,
    status:
      text(metadata.status),
    payloadDigest:
      text(metadata.payloadDigest),
    fanoutDigest:
      text(metadata.fanoutDigest),
    contractDigest:
      text(metadata.contractDigest),
    counts:
      metadata.counts,
    expectedFanoutRecordWrites:
      EXPECTED_FANOUT_RECORD_WRITES,
    expectedTotalIsolatedWrites:
      EXPECTED_TOTAL_ISOLATED_WRITES,
    safety: {
      isolatedFanoutWrites:
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
        "Phase 4C-7 cutover preflight only",
      allowed:
        text(metadata.status) ===
        "fanout_staged",
      actualUidCutoverAllowed:
        false
    }
  };
}

export const stageUidV2IsolatedFanoutPhase4c6 =
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

      validateInput(
        request.data
      );

      const db =
        getFirestore(
          defaultAdminApp()
        );

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

      const metadataRef =
        runRef
          .collection("fanoutMeta")
          .doc("allocation");

      const [
        runSnapshot,
        payloadSnapshot,
        existingMetadata
      ] = await Promise.all([
        runRef.get(),
        payloadRef.get(),
        metadataRef.get()
      ]);

      if (
        !runSnapshot.exists ||
        !payloadSnapshot.exists
      ) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-4 manifest or Phase 4C-5 payload is missing."
        );
      }

      const run =
        runSnapshot.data() || {};

      const payloadDocument =
        payloadSnapshot.data() || {};

      const sourceChecks = {
        runStatus:
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
        payloadStatus:
          text(
            payloadDocument.status
          ) ===
          "allocation_payload_staged",
        payloadDigest:
          text(
            payloadDocument.payloadDigest
          ) ===
          EXPECTED_PAYLOAD_DIGEST,
        sourceWritesZero:
          Number(
            payloadDocument.sourceDataWrites ||
            0
          ) === 0,
        cutoverBlocked:
          payloadDocument.actualUidCutoverAllowed ===
          false
      };

      const failedSourceChecks =
        Object.entries(
          sourceChecks
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

      if (
        failedSourceChecks.length >
        0
      ) {
        throw new HttpsError(
          "failed-precondition",
          `Phase 4C-6 source gate failed: ${failedSourceChecks.join(", ")}`
        );
      }

      const payload =
        asRecord(
          payloadDocument.payload,
          "stored allocation payload"
        );

      const recalculatedPayloadDigest =
        sha256(
          JSON.stringify(
            canonicalize(payload)
          )
        );

      if (
        recalculatedPayloadDigest !==
        EXPECTED_PAYLOAD_DIGEST
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Stored payload digest recalculation failed."
        );
      }

      const plan =
        buildFanoutPlan(
          payload
        );

      const expectedFanoutDigest =
        fanoutDigest(plan);

      let duplicate =
        false;
      let writeOperations =
        0;
      let metadata:
        GenericRecord;

      if (existingMetadata.exists) {
        metadata =
          existingMetadata.data() || {};

        const same =
          text(metadata.payloadDigest) ===
            EXPECTED_PAYLOAD_DIGEST &&
          text(metadata.fanoutDigest) ===
            expectedFanoutDigest &&
          text(metadata.contractDigest) ===
            EXPECTED_CONTRACT_DIGEST &&
          text(metadata.approvedByFirebaseUid) ===
            caller.uid;

        if (!same) {
          throw new HttpsError(
            "already-exists",
            "A different Phase 4C-6 fan-out already exists."
          );
        }

        duplicate = true;
      } else {
        const batch =
          db.batch();

        const collections =
          fanoutCollections(runRef);

        for (
          const key of
          Object.keys(plan) as
            FanoutKey[]
        ) {
          for (
            const entry of
            plan[key]
          ) {
            batch.create(
              collections[key].doc(
                entry.id
              ),
              entry.data
            );

            writeOperations += 1;
          }
        }

        metadata = {
          version:
            UID_V2_ISOLATED_FANOUT_PHASE4C6_VERSION,
          phase:
            "Phase 4C-6",
          mode:
            "isolated_payload_fanout_and_full_verification",
          requestId:
            EXPECTED_REQUEST_ID,
          status:
            "fanout_staged",
          approvedByFirebaseUid:
            caller.uid,
          stagedAt:
            Timestamp.now(),
          payloadDigest:
            EXPECTED_PAYLOAD_DIGEST,
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
          contractDigest:
            EXPECTED_CONTRACT_DIGEST,
          fanoutDigest:
            expectedFanoutDigest,
          counts:
            EXPECTED_COUNTS,
          fanoutRecordWrites:
            EXPECTED_FANOUT_RECORD_WRITES,
          totalIsolatedWrites:
            EXPECTED_TOTAL_ISOLATED_WRITES,
          activeUidRegistryWrites:
            0,
          sourceDataWrites:
            0,
          actualUidCutoverAllowed:
            false
        };

        batch.create(
          metadataRef,
          metadata
        );

        writeOperations += 1;

        if (
          writeOperations !==
          EXPECTED_TOTAL_ISOLATED_WRITES
        ) {
          throw new HttpsError(
            "internal",
            "Unexpected Phase 4C-6 write count."
          );
        }

        await batch.commit();
      }

      const verification =
        await verifyFanout(
          runRef,
          metadata
        );

      if (!verification.verified) {
        throw new HttpsError(
          "failed-precondition",
          "Phase 4C-6 post-write verification failed."
        );
      }

      return {
        ...publicResult(
          metadata,
          duplicate,
          writeOperations
        ),
        verification
      };
    }
  );

export const inspectUidV2IsolatedFanoutPhase4c6 =
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
      requireSuperAdmin(
        request.auth as
          | {
              uid: string;
              token:
                GenericRecord;
            }
          | undefined
      );

      validateInput(
        request.data
      );

      const db =
        getFirestore(
          defaultAdminApp()
        );

      const runRef =
        db.collection(
          STAGING_RUN_COLLECTION
        ).doc(
          EXPECTED_REQUEST_ID
        );

      const metadataSnapshot =
        await runRef
          .collection("fanoutMeta")
          .doc("allocation")
          .get();

      if (!metadataSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Phase 4C-6 fan-out metadata was not found."
        );
      }

      const metadata =
        metadataSnapshot.data() || {};

      const verification =
        await verifyFanout(
          runRef,
          metadata
        );

      return {
        ...publicResult(
          metadata,
          true,
          0
        ),
        verification
      };
    }
  );
