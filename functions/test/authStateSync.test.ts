import test from "node:test";
import assert from "node:assert/strict";
import { AuthStateSyncAdapter } from "../src/auth/authStateSync.js";
import { safeLegacyAuthUid } from "../src/auth/legacySessionBridge.js";

class FakeDoc {
  constructor(private readonly store: Map<string, Record<string, unknown>>, private readonly id: string) {}
  async get() {
    return { exists: this.store.has(this.id), data: () => this.store.get(this.id) };
  }
}

class FakeTransaction {
  constructor(private readonly store: Map<string, Record<string, unknown>>) {}
  async get(ref: FakeDoc) {
    return ref.get();
  }
  set(ref: FakeDoc, value: Record<string, unknown>) {
    this.store.set((ref as unknown as { id: string }).id, { ...this.store.get((ref as unknown as { id: string }).id), ...value });
  }
}

class FakeFirestore {
  readonly store = new Map<string, Record<string, unknown>>();
  collection() {
    return { doc: (id: string) => new FakeDoc(this.store, id) };
  }
  async runTransaction<T>(handler: (transaction: FakeTransaction) => Promise<T>): Promise<T> {
    return handler(new FakeTransaction(this.store));
  }
}

test("auth state sync deactivates user, increments authVersion, and revokes refresh tokens", async () => {
  const db = new FakeFirestore();
  const uid = safeLegacyAuthUid("student", "legacy-student");
  db.store.set(uid, { firebaseUid: uid, role: "student", active: true, authVersion: 3, studentUid: "s1" });
  const revoked: string[] = [];
  const adapter = new AuthStateSyncAdapter(
    { revokeRefreshTokens: async (firebaseUid: string) => { revoked.push(firebaseUid); } },
    db as never,
    { now: () => "now" as never }
  );

  const result = await adapter.deactivateLegacyAccount({
    role: "student",
    legacyUid: "legacy-student",
    reason: "student_withdrawn"
  });

  assert.equal(result.authVersion, 4);
  assert.deepEqual(revoked, [uid]);
  assert.equal(db.store.get(uid)?.active, false);
});

test("role change disables old deterministic uid and reports next uid", async () => {
  const db = new FakeFirestore();
  const revoked: string[] = [];
  const adapter = new AuthStateSyncAdapter(
    { revokeRefreshTokens: async (firebaseUid: string) => { revoked.push(firebaseUid); } },
    db as never,
    { now: () => "now" as never }
  );

  const result = await adapter.handleRoleChange({
    role: "admin",
    nextRole: "superAdmin",
    legacyUid: "legacy-admin",
    reason: "role_changed"
  });

  assert.equal(result.disabledUid, safeLegacyAuthUid("admin", "legacy-admin"));
  assert.equal(result.nextUid, safeLegacyAuthUid("superAdmin", "legacy-admin"));
  assert.deepEqual(revoked, [safeLegacyAuthUid("admin", "legacy-admin")]);
});
