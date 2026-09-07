import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryIdempotencyStore } from "../src/common/idempotency.js";
import type { StoredIdentityDirectoryDocument } from "../src/directory/identityDirectoryPlan.js";
import type { IdentityDirectoryCommitResult, IdentityDirectoryRepository } from "../src/directory/firestoreIdentityDirectoryRepository.js";
import {
  createLegacyGasSourceEnvelope,
  LEGACY_GAS_SOURCE_KEY_ID,
  signLegacyGasSourceEnvelope
} from "../src/source/legacyGasSourceContract.js";
import { handleLegacyGasSourceRequest } from "../src/source/ingestLegacyGasSnapshot.js";
import { fixtureSnapshot } from "./fixtures/identityDirectoryFixture.js";

const secret = "phase2-1-handler-test-secret-that-is-long";
const now = Date.parse("2026-07-02T10:00:00.000Z");

class MemoryDirectoryRepository implements IdentityDirectoryRepository {
  documents: StoredIdentityDirectoryDocument[] = [];
  commits = 0;
  async loadAll(): Promise<StoredIdentityDirectoryDocument[]> { return this.documents; }
  async commit(plan: any): Promise<IdentityDirectoryCommitResult> {
    this.commits += 1;
    this.documents = plan.upserts;
    return { runId: plan.runId, written: plan.upserts.length, staleMarked: plan.stalePaths.length, unchanged: plan.unchangedPaths.length, stateDocumentId: "identity_directory" };
  }
}

function signed(mode: "dry_run" | "commit", requestId: string) {
  const envelope = createLegacyGasSourceEnvelope({
    dataset: "identity_directory",
    mode,
    requestId,
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    payload: fixtureSnapshot()
  });
  return { envelope, signature: signLegacyGasSourceEnvelope(envelope, secret) };
}

test("source handler accepts authenticated dry-run and records idempotency", async () => {
  const repository = new MemoryDirectoryRepository();
  const idempotencyStore = new InMemoryIdempotencyStore();
  const request = signed("dry_run", "gas_identity_handler_0001");
  const result = await handleLegacyGasSourceRequest({
    method: "POST",
    body: request.envelope,
    signature: request.signature,
    keyId: LEGACY_GAS_SOURCE_KEY_ID
  }, { secret, identityRepository: repository, idempotencyStore, now: () => now, commitEnabled: false });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.safeToCommit, true);
  assert.equal(repository.commits, 0);
  assert.equal((await idempotencyStore.get("gas_identity_handler_0001"))?.status, "validated");
});

test("source handler rejects bad auth and keeps commit disabled by default", async () => {
  const repository = new MemoryDirectoryRepository();
  const idempotencyStore = new InMemoryIdempotencyStore();
  const dry = signed("dry_run", "gas_identity_handler_0002");
  const bad = await handleLegacyGasSourceRequest({ method: "POST", body: dry.envelope, signature: "x", keyId: LEGACY_GAS_SOURCE_KEY_ID }, {
    secret, identityRepository: repository, idempotencyStore, now: () => now
  });
  assert.equal(bad.status, 401);

  const commit = signed("commit", "gas_identity_handler_0003");
  const disabled = await handleLegacyGasSourceRequest({ method: "POST", body: commit.envelope, signature: commit.signature, keyId: LEGACY_GAS_SOURCE_KEY_ID }, {
    secret, identityRepository: repository, idempotencyStore, now: () => now, commitEnabled: false
  });
  assert.equal(disabled.status, 503);
  assert.equal(repository.commits, 0);
});

test("source handler performs commit only when explicit server switch is enabled", async () => {
  const repository = new MemoryDirectoryRepository();
  const idempotencyStore = new InMemoryIdempotencyStore();
  const commit = signed("commit", "gas_identity_handler_0004");
  const result = await handleLegacyGasSourceRequest({ method: "POST", body: commit.envelope, signature: commit.signature, keyId: LEGACY_GAS_SOURCE_KEY_ID }, {
    secret, identityRepository: repository, idempotencyStore, now: () => now, commitEnabled: true
  });
  assert.equal(result.status, 200);
  assert.equal(repository.commits, 1);
  assert.equal(result.body.verificationSafe, true);
});

test("same requestId is idempotent and conflicting reuse is rejected", async () => {
  const repository = new MemoryDirectoryRepository();
  const idempotencyStore = new InMemoryIdempotencyStore();
  const first = signed("dry_run", "gas_identity_handler_0005");
  const args = { method: "POST", body: first.envelope, signature: first.signature, keyId: LEGACY_GAS_SOURCE_KEY_ID };
  const deps = { secret, identityRepository: repository, idempotencyStore, now: () => now, commitEnabled: false };
  assert.equal((await handleLegacyGasSourceRequest(args, deps)).body.duplicate, false);
  assert.equal((await handleLegacyGasSourceRequest(args, deps)).body.duplicate, true);

  const conflictPayload = fixtureSnapshot();
  conflictPayload.students[0].studentName = "변조";
  const conflictEnvelope = createLegacyGasSourceEnvelope({
    dataset: "identity_directory",
    mode: "dry_run",
    requestId: "gas_identity_handler_0005",
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    payload: conflictPayload
  });
  const conflictSignature = signLegacyGasSourceEnvelope(conflictEnvelope, secret);
  const result = await handleLegacyGasSourceRequest({ method: "POST", body: conflictEnvelope, signature: conflictSignature, keyId: LEGACY_GAS_SOURCE_KEY_ID }, deps);
  assert.equal(result.status, 409);
  assert.equal(result.body.code, "request_id_conflict");
});
