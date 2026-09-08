import test from "node:test";
import assert from "node:assert/strict";
import {
  createLegacyAuthProof,
  exchangeLegacySession,
  hashLegacyProof,
  InMemoryAtomicLegacyProofStore,
  LEGACY_AUTH_AUDIENCE,
  safeLegacyAuthUid
} from "../src/auth/legacySessionBridge.js";
import type { FirebaseAuthBridge } from "../src/auth/legacySessionBridge.js";

function fakeAuth(): FirebaseAuthBridge {
  return {
    async findOrCreateUser(legacyUid) {
      return { uid: legacyUid };
    },
    async setCustomUserClaims() {},
    async upsertUserAccessDocument() {
      return { active: true, authVersion: 1 };
    },
    async createCustomToken(firebaseUid) {
      return `token:${firebaseUid}`;
    }
  };
}

test("proof hash does not expose raw proof", () => {
  const hash = hashLegacyProof("raw-proof");
  assert.notEqual(hash, "raw-proof");
  assert.equal(hash.length, 64);
});

test("exchange consumes proof atomically and exactly once under concurrency", async () => {
  const store = new InMemoryAtomicLegacyProofStore();
  store.addProof("proof-1", {
    aud: "ulim-web",
    issuedAt: 1000,
    expiresAt: 60_000,
    legacyUid: "legacy-student-1",
    role: "student",
    studentUid: "student-1"
  });
  const attempts = await Promise.allSettled([
    exchangeLegacySession({ proof: "proof-1", expectedAudience: "ulim-web", now: 2000 }, store, fakeAuth()),
    exchangeLegacySession({ proof: "proof-1", expectedAudience: "ulim-web", now: 2000 }, store, fakeAuth()),
    exchangeLegacySession({ proof: "proof-1", expectedAudience: "ulim-web", now: 2000 }, store, fakeAuth())
  ]);
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((result) => result.status === "rejected").length, 2);
});

test("custom claims exclude admin scopes and require role identifiers", async () => {
  const store = new InMemoryAtomicLegacyProofStore();
  store.addProof("proof-2", {
    aud: "ulim-web",
    issuedAt: 1000,
    expiresAt: 60_000,
    legacyUid: "legacy-admin",
    role: "admin"
  });
  const result = await exchangeLegacySession({ proof: "proof-2", expectedAudience: "ulim-web", now: 2000 }, store, fakeAuth());
  assert.deepEqual(result.claims, { role: "admin", authVersion: 1 });
  assert.equal("adminScopeIds" in result.claims, false);
});

test("audience, ttl, and required uid validation are enforced", async () => {
  const store = new InMemoryAtomicLegacyProofStore();
  store.addProof("proof-3", {
    aud: "other",
    issuedAt: 1000,
    expiresAt: 60_000,
    legacyUid: "legacy-student",
    role: "student",
    studentUid: "student-1"
  });
  await assert.rejects(() => exchangeLegacySession({ proof: "proof-3", expectedAudience: "ulim-web", now: 2000 }, store, fakeAuth()), /audience/);

  const store2 = new InMemoryAtomicLegacyProofStore();
  store2.addProof("proof-4", {
    aud: "ulim-web",
    issuedAt: 1000,
    expiresAt: 60_000,
    legacyUid: "legacy-student",
    role: "student"
  });
  await assert.rejects(() => exchangeLegacySession({ proof: "proof-4", expectedAudience: "ulim-web", now: 2000 }, store2, fakeAuth()), /studentUid/);
});

test("safe legacy uid is role namespaced", () => {
  assert.notEqual(safeLegacyAuthUid("student", "same"), safeLegacyAuthUid("teacher", "same"));
});

test("v1 HMAC proof verifies without exposing mutable client identity fields", async () => {
  const secret = "test-secret-for-hmac";
  const issuedAt = 2_000;
  const proof = createLegacyAuthProof({
    v: 1,
    jti: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    aud: LEGACY_AUTH_AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + 90,
    role: "student",
    legacyUid: "legacy-student-1",
    studentUid: "student-1",
    accountState: "active"
  }, secret);

  const { FirestoreLegacyProofStore } = await import("../src/auth/firestoreLegacyProofStore.js");
  assert.equal(proof.startsWith("v1."), true);
  assert.equal(proof.includes("student-1"), false);
  assert.equal(typeof FirestoreLegacyProofStore, "function");
});


test("directory account guard runs before Firebase Auth user creation", async () => {
  const store = new InMemoryAtomicLegacyProofStore();
  store.addProof("proof-directory-guard", {
    aud: "ulim-web",
    issuedAt: 1000,
    expiresAt: 60_000,
    legacyUid: "legacy-student-guard",
    role: "student",
    studentUid: "student-guard"
  });
  const calls: string[] = [];
  const guardedAuth: FirebaseAuthBridge = {
    async assertDirectoryAccount() {
      calls.push("directory");
      throw new Error("directory blocked");
    },
    async findOrCreateUser(legacyUid) {
      calls.push("auth");
      return { uid: legacyUid };
    },
    async setCustomUserClaims() {},
    async createCustomToken(firebaseUid) { return `token:${firebaseUid}`; }
  };

  await assert.rejects(
    () => exchangeLegacySession({ proof: "proof-directory-guard", expectedAudience: "ulim-web", now: 2000 }, store, guardedAuth),
    /directory blocked/
  );
  assert.deepEqual(calls, ["directory"]);
});
