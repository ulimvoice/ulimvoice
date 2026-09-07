import { createHash } from "node:crypto";
import { App, getApp, getApps, initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

export const UID_V2_STAGING_MANIFEST_PHASE4C4_VERSION = "2026-07-24.716.15-phase4c4-isolated-staging-manifest-only";
const REGION = "asia-northeast3";
const APPROVAL_COLLECTION = "uidV2StagingApprovals";
const RUN_COLLECTION = "uidV2StagingRuns";
const ALLOCATION_DIGEST = "3f84a507ce2e319d4569bdaf09c97b431a81863beb4030415cebb90c7bd15a23";
const STAGING_DIGEST = "fb371357ad163def2666707242603cc1b5d93a095048528fbbb4a46dedc92e6d";
const REFERENCE_DIGEST = "42a61f565e4773852aef7e5d0cd9720711e21d667c6f20f9bc9c3a915153d8ff";
const SNAPSHOT_ID = "P4C2_fb371357ad163def2666";
const PHASE4C3_CONTRACT_DIGEST = "4bde14f0be7b4db491156090a4a52a75c481ce99be869a167e1e318514c998b8";
const MANIFEST_CONTRACT_DIGEST = "ca867834e21bf8d5a716b2ec27fe2d82fae2449faeb490abd4bba63fa322ab06";
const EXPECTED_COUNTS = Object.freeze({"students":155,"principals":12,"studentAliases":85,"principalAliases":13,"generatedUids":167,"productionAttendanceDocuments":69,"productionAttendanceInPlace":68,"productionAttendancePathClone":1,"productionAssignments":14,"productionFirebaseAuthTransitions":1});

type AnyMap = Record<string, unknown>;

function app(): App {
  return getApps().some((item) => item.name === "[DEFAULT]") ? getApp() : initializeApp();
}
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function roles(value: unknown): string[] { return Array.isArray(value) ? value.map(text).filter(Boolean) : []; }
function superAdmin(auth: { uid: string; token: AnyMap } | undefined) {
  if (!auth) throw new HttpsError("unauthenticated", "Firebase authentication is required.");
  const token = auth.token;
  const ok = text(token.role) === "superAdmin" || text(token.ulimRole) === "superAdmin" || text(token.accountRole) === "superAdmin" || roles(token.roles).includes("superAdmin");
  if (!ok) throw new HttpsError("permission-denied", "superAdmin claim is required.");
  return { uid: auth.uid };
}
function requestId(value: unknown): string {
  const id = text(value).toLowerCase();
  if (!/^phase4c3-[a-z0-9][a-z0-9-]{15,95}$/.test(id)) throw new HttpsError("invalid-argument", "Valid Phase 4C-3 requestId required.");
  return id;
}
function sha(value: unknown): string { return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex"); }
function millis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as {toMillis?:unknown}).toMillis === "function") return (value as {toMillis:()=>number}).toMillis();
  return 0;
}
function stableContract() { return {"phase":"Phase 4C-4 isolated staging manifest","allocationPlanDigest":"3f84a507ce2e319d4569bdaf09c97b431a81863beb4030415cebb90c7bd15a23","stagingPlanDigest":"fb371357ad163def2666707242603cc1b5d93a095048528fbbb4a46dedc92e6d","referenceAuditDigest":"42a61f565e4773852aef7e5d0cd9720711e21d667c6f20f9bc9c3a915153d8ff","stagingSnapshotId":"P4C2_fb371357ad163def2666","phase4c3ServerContractDigest":"4bde14f0be7b4db491156090a4a52a75c481ce99be869a167e1e318514c998b8","counts":{"students":155,"principals":12,"studentAliases":85,"principalAliases":13,"generatedUids":167,"productionAttendanceDocuments":69,"productionAttendanceInPlace":68,"productionAttendancePathClone":1,"productionAssignments":14,"productionFirebaseAuthTransitions":1},"scope":"isolated_staging_manifest_only","uidRegistryRecordsIncluded":false,"sourceDataWritesAllowed":false,"actualUidCutoverAllowed":false}; }
function checkedCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpsError("invalid-argument", "counts object required.");
  const input = value as AnyMap;
  const output: Record<string, number> = {};
  for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
    const actual = Number(input[key]);
    if (!Number.isInteger(actual) || actual !== expected) throw new HttpsError("failed-precondition", `Count mismatch: ${key}`);
    output[key] = actual;
  }
  const extras = Object.keys(input).filter((key) => !(key in EXPECTED_COUNTS));
  if (extras.length) throw new HttpsError("invalid-argument", `Unexpected count keys: ${extras.join(", ")}`);
  return output;
}
function publicResult(record: AnyMap, duplicate: boolean, writes: number) {
  return {
    ok: true, version: UID_V2_STAGING_MANIFEST_PHASE4C4_VERSION, mode: "isolated_staging_manifest_only",
    requestId: text(record.requestId), duplicate, writeOperations: writes, status: text(record.status),
    stagedAt: millis(record.stagedAt) ? new Date(millis(record.stagedAt)).toISOString() : null,
    allocationPlanDigest: text(record.allocationPlanDigest), stagingPlanDigest: text(record.stagingPlanDigest),
    referenceAuditDigest: text(record.referenceAuditDigest), stagingSnapshotId: text(record.stagingSnapshotId),
    approvalDigest: text(record.approvalDigest), manifestContractDigest: text(record.manifestContractDigest), manifestDigest: text(record.manifestDigest),
    counts: record.counts,
    safety: { approvalRecordWrites: 0, stagingManifestWrites: writes, uidRegistryRecordWrites: 0, sourceDataWrites: 0, attendanceWrites: 0, assignmentWrites: 0, firebaseAuthWrites: 0, sessionChanges: 0, actualUidCutoverAllowed: false },
    nextGate: { phase: "Phase 4C-5 deterministic allocation payload staging", allowed: text(record.status) === "isolated_manifest_staged", actualUidCutoverAllowed: false }
  };
}

export const stageUidV2ManifestPhase4c4 = onCall({ region: REGION, timeoutSeconds: 60, memory: "256MiB", enforceAppCheck: false }, async (request) => {
  const caller = superAdmin(request.auth as {uid:string;token:AnyMap} | undefined);
  const input = (request.data && typeof request.data === "object" ? request.data : {}) as AnyMap;
  const id = requestId(input.requestId);
  const approvalDigest = text(input.approvalDigest);
  if (!/^[0-9a-f]{64}$/.test(approvalDigest)) throw new HttpsError("invalid-argument", "approvalDigest must be SHA-256 hex.");
  const counts = checkedCounts(input.counts);
  const gates = {
    allocationPlanDigest: text(input.allocationPlanDigest) === ALLOCATION_DIGEST,
    stagingPlanDigest: text(input.stagingPlanDigest) === STAGING_DIGEST,
    referenceAuditDigest: text(input.referenceAuditDigest) === REFERENCE_DIGEST,
    stagingSnapshotId: text(input.stagingSnapshotId) === SNAPSHOT_ID,
    phase4c3ServerContractDigest: text(input.phase4c3ServerContractDigest) === PHASE4C3_CONTRACT_DIGEST,
    manifestContractDigest: text(input.manifestContractDigest) === MANIFEST_CONTRACT_DIGEST,
    serverManifestRecalculation: sha(stableContract()) === MANIFEST_CONTRACT_DIGEST
  };
  const failed = Object.entries(gates).filter(([,ok]) => !ok).map(([key]) => key);
  if (failed.length) throw new HttpsError("failed-precondition", `Phase 4C-4 gate failed: ${failed.join(", ")}`);

  const db = getFirestore(app());
  const approvalRef = db.collection(APPROVAL_COLLECTION).doc(id);
  const runRef = db.collection(RUN_COLLECTION).doc(id);
  let duplicate = false;
  let writes = 0;
  let finalRecord: AnyMap | undefined;

  await db.runTransaction(async (tx) => {
    const approvalSnap = await tx.get(approvalRef);
    if (!approvalSnap.exists) throw new HttpsError("not-found", "Phase 4C-3 approval not found.");
    const approval = approvalSnap.data() || {};
    const approvalGates = {
      status: text(approval.status) === "approved_for_isolated_staging",
      notExpired: millis(approval.expiresAt) > Date.now(),
      sameCaller: text(approval.approvedByFirebaseUid) === caller.uid,
      approvalDigest: text(approval.approvalDigest) === approvalDigest,
      allocation: text(approval.allocationPlanDigest) === ALLOCATION_DIGEST,
      staging: text(approval.stagingPlanDigest) === STAGING_DIGEST,
      reference: text(approval.referenceAuditDigest) === REFERENCE_DIGEST,
      snapshot: text(approval.stagingSnapshotId) === SNAPSHOT_ID,
      contract: text(approval.serverContractDigest) === PHASE4C3_CONTRACT_DIGEST,
      cutoverBlocked: approval.actualUidCutoverAllowed === false
    };
    const approvalFailed = Object.entries(approvalGates).filter(([,ok]) => !ok).map(([key]) => key);
    if (approvalFailed.length) throw new HttpsError("failed-precondition", `Approval validation failed: ${approvalFailed.join(", ")}`);

    const existing = await tx.get(runRef);
    if (existing.exists) {
      const record = existing.data() || {};
      const same = text(record.approvalDigest) === approvalDigest && text(record.allocationPlanDigest) === ALLOCATION_DIGEST && text(record.stagingPlanDigest) === STAGING_DIGEST && text(record.manifestContractDigest) === MANIFEST_CONTRACT_DIGEST;
      if (!same) throw new HttpsError("already-exists", "Different staging manifest exists for requestId.");
      duplicate = true; finalRecord = record; return;
    }

    const stagedAtMs = Date.now();
    const record: AnyMap = {
      version: UID_V2_STAGING_MANIFEST_PHASE4C4_VERSION, phase: "Phase 4C-4", mode: "isolated_staging_manifest_only",
      requestId: id, status: "isolated_manifest_staged", approvedByFirebaseUid: caller.uid,
      stagedAt: Timestamp.fromMillis(stagedAtMs), allocationPlanDigest: ALLOCATION_DIGEST, stagingPlanDigest: STAGING_DIGEST,
      referenceAuditDigest: REFERENCE_DIGEST, stagingSnapshotId: SNAPSHOT_ID, phase4c3ServerContractDigest: PHASE4C3_CONTRACT_DIGEST,
      approvalDigest, manifestContractDigest: MANIFEST_CONTRACT_DIGEST,
      manifestDigest: sha({version:UID_V2_STAGING_MANIFEST_PHASE4C4_VERSION,requestId:id,approvedByFirebaseUid:caller.uid,approvalDigest,stagedAtMs,manifestContractDigest:MANIFEST_CONTRACT_DIGEST}),
      counts, approvalValidation: approvalGates, manifestValidation: gates,
      uidRegistryRecordsIncluded: false, sourceDataWritesAllowed: false, actualUidCutoverAllowed: false
    };
    tx.create(runRef, record); writes = 1; finalRecord = record;
  });

  if (!finalRecord) throw new HttpsError("internal", "Staging manifest unresolved.");
  return publicResult(finalRecord, duplicate, writes);
});

export const inspectUidV2ManifestPhase4c4 = onCall({ region: REGION, timeoutSeconds: 30, memory: "256MiB", enforceAppCheck: false }, async (request) => {
  superAdmin(request.auth as {uid:string;token:AnyMap} | undefined);
  const input = (request.data && typeof request.data === "object" ? request.data : {}) as AnyMap;
  const id = requestId(input.requestId);
  const snap = await getFirestore(app()).collection(RUN_COLLECTION).doc(id).get();
  if (!snap.exists) throw new HttpsError("not-found", "Phase 4C-4 staging manifest not found.");
  return publicResult(snap.data() || {}, true, 0);
});
