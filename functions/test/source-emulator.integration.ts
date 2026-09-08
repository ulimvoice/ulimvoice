import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp, type App as AdminApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  createLegacyGasSourceEnvelope,
  LEGACY_GAS_SOURCE_KEY_ID,
  signLegacyGasSourceEnvelope
} from "../src/source/legacyGasSourceContract.js";
import { fixtureSnapshot } from "./fixtures/identityDirectoryFixture.js";

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "ulimvoice-phase2-2-test";
const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
const secret = process.env.ULIM_GAS_SOURCE_HMAC_SECRET;
const endpoint = `http://${functionsHost}/${projectId}/us-central1/ingestLegacyGasSnapshot`;
let adminApp: AdminApp;

before(async () => {
  if (!secret) throw new Error("ULIM_GAS_SOURCE_HMAC_SECRET is required");
  process.env.GCLOUD_PROJECT = projectId;
  adminApp = initializeAdminApp({ projectId }, `source-admin-${Date.now()}`);
  await waitForEndpoint(endpoint);
});

beforeEach(async () => {
  const db = getFirestore(adminApp);
  for (const name of [
    "syncOperations",
    "legacyAccounts",
    "students",
    "teachers",
    "classes",
    "classMembers",
    "teacherAssignments",
    "adminAssignments",
    "mirrorState"
  ]) {
    await db.recursiveDelete(db.collection(name));
  }
});

after(async () => {
  await deleteAdminApp(adminApp);
});

function makeEnvelope(
  mode: "dry_run" | "commit",
  requestId: string,
  payload = fixtureSnapshot()
) {
  const now = Date.now();
  return createLegacyGasSourceEnvelope({
    dataset: "identity_directory",
    mode,
    requestId,
    issuedAt: now - 1_000,
    expiresAt: now + 90_000,
    payload
  });
}

async function postEnvelope(envelope: ReturnType<typeof makeEnvelope>, signature?: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-ulim-key-id": LEGACY_GAS_SOURCE_KEY_ID,
      "x-ulim-signature": `v1=${signature || signLegacyGasSourceEnvelope(envelope, secret as string)}`
    },
    body: JSON.stringify(envelope)
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Source endpoint returned non-JSON (${response.status}): ${text.slice(0, 500)}`);
  }
  return { response, body };
}

test("signed identity directory dry-run reaches Functions Emulator without directory writes", async () => {
  const requestId = `phase22_dry_${randomBytes(12).toString("hex")}`;
  const result = await postEnvelope(makeEnvelope("dry_run", requestId));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.mode, "dry_run");
  assert.equal(result.body.safeToCommit, true);

  const db = getFirestore(adminApp);
  assert.equal((await db.collection("legacyAccounts").limit(1).get()).empty, true);
  assert.equal((await db.collection("students").limit(1).get()).empty, true);
  assert.equal((await db.collection("mirrorState").doc("identity_directory").get()).exists, false);

  const operationSnapshot = await db.collection("syncOperations").doc(requestId).get();
  assert.equal(operationSnapshot.exists, true);
  const operationData = operationSnapshot.data();
  assert.equal(typeof operationData?.resultDigest, "string");
  assert.ok((operationData?.resultDigest as string).length > 0);
});

test("commit remains blocked while server commit switch is false", async () => {
  const requestId = `phase22_commit_${randomBytes(12).toString("hex")}`;
  const result = await postEnvelope(makeEnvelope("commit", requestId));
  assert.equal(result.response.status, 503);
  assert.equal(result.body.code, "commit_disabled");

  const db = getFirestore(adminApp);
  assert.equal((await db.collection("legacyAccounts").limit(1).get()).empty, true);
  assert.equal((await db.collection("mirrorState").doc("identity_directory").get()).exists, false);
});

test("transport rejects a signed body that was changed after signing", async () => {
  const requestId = `phase22_tamper_${randomBytes(12).toString("hex")}`;
  const envelope = makeEnvelope("dry_run", requestId);
  const signature = signLegacyGasSourceEnvelope(envelope, secret as string);
  envelope.payload.students[0].studentName = "변조된 학생";
  const result = await postEnvelope(envelope, signature);
  assert.equal(result.response.status, 401);
  assert.equal(result.body.code, "source_auth_rejected");
});

test("same signed dry-run request is idempotent and payload reuse conflict is rejected", async () => {
  const requestId = `phase22_idem_${randomBytes(12).toString("hex")}`;
  const envelope = makeEnvelope("dry_run", requestId);
  const first = await postEnvelope(envelope);
  const second = await postEnvelope(envelope);
  assert.equal(first.response.status, 200);
  assert.equal(second.response.status, 200);
  assert.equal(second.body.duplicate, true);

  const operationSnapshot = await getFirestore(adminApp).collection("syncOperations").doc(requestId).get();
  assert.equal(operationSnapshot.exists, true);
  const operationData = operationSnapshot.data();
  assert.equal(typeof operationData?.resultDigest, "string");
  assert.ok((operationData?.resultDigest as string).length > 0);

  const conflictingPayload = fixtureSnapshot();
  conflictingPayload.students[0].studentName = "다른 원본";
  const conflicting = makeEnvelope("dry_run", requestId, conflictingPayload);
  const conflict = await postEnvelope(conflicting);
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.code, "request_id_conflict");
});

async function waitForEndpoint(url: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.status === 405 || response.status === 401 || response.status === 400) return;
      lastError = `unexpected status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Functions Emulator endpoint did not become ready: ${lastError}`);
}
