import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
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

const secret = "phase2-1-local-http-transport-secret";
const fixedNow = Date.parse("2026-07-02T10:00:00.000Z");

class MemoryRepository implements IdentityDirectoryRepository {
  documents: StoredIdentityDirectoryDocument[] = [];
  commits = 0;
  async loadAll(): Promise<StoredIdentityDirectoryDocument[]> { return this.documents; }
  async commit(plan: any): Promise<IdentityDirectoryCommitResult> {
    this.commits += 1;
    this.documents = plan.upserts;
    return { runId: plan.runId, written: plan.upserts.length, staleMarked: plan.stalePaths.length, unchanged: plan.unchangedPaths.length, stateDocumentId: "identity_directory" };
  }
}

async function withLocalSourceServer(run: (url: string, repository: MemoryRepository) => Promise<void>): Promise<void> {
  const repository = new MemoryRepository();
  const idempotencyStore = new InMemoryIdempotencyStore();
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString("utf8");
    const result = await handleLegacyGasSourceRequest({
      method: request.method || "",
      body: raw,
      signature: request.headers["x-ulim-signature"],
      keyId: request.headers["x-ulim-key-id"]
    }, { secret, identityRepository: repository, idempotencyStore, now: () => fixedNow, commitEnabled: false });
    response.writeHead(result.status, { "content-type": "application/json" });
    response.end(JSON.stringify(result.body));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("local server address unavailable");
  try {
    await run(`http://127.0.0.1:${address.port}`, repository);
  } finally {
    server.close();
    await once(server, "close");
  }
}

function requestEnvelope(requestId: string) {
  return createLegacyGasSourceEnvelope({
    dataset: "identity_directory",
    mode: "dry_run",
    requestId,
    issuedAt: fixedNow - 1_000,
    expiresAt: fixedNow + 60_000,
    payload: fixtureSnapshot()
  });
}

test("signed source envelope survives an actual local HTTP JSON round trip", async () => {
  await withLocalSourceServer(async (url, repository) => {
    const envelope = requestEnvelope("gas_identity_transport_0001");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-ulim-key-id": LEGACY_GAS_SOURCE_KEY_ID,
        "x-ulim-signature": `v1=${signLegacyGasSourceEnvelope(envelope, secret)}`
      },
      body: JSON.stringify(envelope)
    });
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.mode, "dry_run");
    assert.equal(repository.commits, 0);
  });
});

test("HTTP transport rejects a body changed after signing", async () => {
  await withLocalSourceServer(async (url, repository) => {
    const envelope = requestEnvelope("gas_identity_transport_0002");
    const signature = signLegacyGasSourceEnvelope(envelope, secret);
    envelope.payload.students[0].studentName = "전송 중 변조";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ulim-key-id": LEGACY_GAS_SOURCE_KEY_ID,
        "x-ulim-signature": `v1=${signature}`
      },
      body: JSON.stringify(envelope)
    });
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 401);
    assert.equal(body.code, "source_auth_rejected");
    assert.equal(repository.commits, 0);
  });
});
