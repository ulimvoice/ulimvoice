import test from "node:test";
import assert from "node:assert/strict";
import {
  beginOperation,
  DuplicateRequestError,
  FirestoreIdempotencyStore,
  InMemoryIdempotencyStore,
  shouldSkipSideEffects,
  type FirestoreTransactionLike,
  type SyncOperation
} from "../src/common/idempotency.js";

test("beginOperation records pending operation once", async () => {
  const store = new InMemoryIdempotencyStore();
  const op = await beginOperation(store, "req-1", "adminSaveAttendance", new Date("2026-06-25T00:00:00.000Z"));
  assert.equal(op.status, "pending");
  assert.equal(op.attempts, 1);
  assert.equal((await store.get("req-1"))?.operation, "adminSaveAttendance");
});

test("beginOperation rejects duplicate requestId", async () => {
  const store = new InMemoryIdempotencyStore();
  await beginOperation(store, "req-1", "adminSaveAttendance");
  await assert.rejects(() => beginOperation(store, "req-1", "adminSaveAttendance"), DuplicateRequestError);
});

test("completed duplicate request skips side effects", async () => {
  const store = new InMemoryIdempotencyStore();
  await beginOperation(store, "req-2", "adminReliableWrite");
  await store.update("req-2", { status: "notified", resultDigest: "sha256:ok" });
  const duplicate = await store.begin("req-2", "adminReliableWrite");
  assert.equal(duplicate.duplicate, true);
  assert.equal(shouldSkipSideEffects(duplicate), true);
});

class FakeFirestoreDb {
  readonly data = new Map<string, SyncOperation>();

  doc(path: string): string {
    return path;
  }

  async runTransaction<T>(callback: (transaction: FirestoreTransactionLike) => Promise<T>): Promise<T> {
    const tx: FirestoreTransactionLike = {
      get: async (ref) => ({
        exists: this.data.has(String(ref)),
        data: () => this.data.get(String(ref))
      }),
      create: (ref, data) => {
        if (this.data.has(String(ref))) throw new Error("already exists");
        this.data.set(String(ref), data);
      },
      set: (ref, data) => {
        this.data.set(String(ref), data);
      }
    };
    return callback(tx);
  }
}

test("FirestoreIdempotencyStore create-if-absent returns existing operation on duplicate", async () => {
  const db = new FakeFirestoreDb();
  const store = new FirestoreIdempotencyStore(db);
  const first = await store.begin("req-3", "adminSaveAttendance", new Date("2026-06-25T00:00:00.000Z"));
  const second = await store.begin("req-3", "adminSaveAttendance", new Date("2026-06-25T00:01:00.000Z"));
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.operation.createdAt, "2026-06-25T00:00:00.000Z");
});

test("concurrent duplicate idempotency calls produce one new operation", async () => {
  const store = new InMemoryIdempotencyStore();
  const results = await Promise.all([
    store.begin("req-4", "autoAbsent"),
    store.begin("req-4", "autoAbsent"),
    store.begin("req-4", "autoAbsent")
  ]);
  assert.equal(results.filter((result) => !result.duplicate).length, 1);
  assert.equal(results.filter((result) => result.duplicate).length, 2);
});


test("FirestoreIdempotencyStore get and update persist transactionally", async () => {
  const db = new FakeFirestoreDb();
  const store = new FirestoreIdempotencyStore(db);
  await store.begin("req-5", "attendanceMirror", new Date("2026-07-02T00:00:00.000Z"));
  const updated = await store.update("req-5", { status: "firestore_synced", resultDigest: "sha256:done" });
  assert.equal(updated.status, "firestore_synced");
  assert.equal(updated.operation, "attendanceMirror");
  assert.equal((await store.get("req-5"))?.resultDigest, "sha256:done");
});

test("FirestoreIdempotencyStore update cannot rewrite request identity", async () => {
  const db = new FakeFirestoreDb();
  const store = new FirestoreIdempotencyStore(db);
  await store.begin("req-6", "attendanceMirror");
  const updated = await store.update("req-6", { requestId: "other", operation: "other", status: "retrying" });
  assert.equal(updated.requestId, "req-6");
  assert.equal(updated.operation, "attendanceMirror");
});
