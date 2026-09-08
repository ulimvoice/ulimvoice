import test from "node:test";
import assert from "node:assert/strict";
import type { Firestore } from "firebase-admin/firestore";
import type { IdentityDirectoryMirrorPlan, StoredIdentityDirectoryDocument } from "../src/directory/identityDirectoryPlan.js";
import { FirestoreIdentityDirectoryRepository } from "../src/directory/firestoreIdentityDirectoryRepository.js";

interface RecordedWrite {
  path: string;
  data: unknown;
  options?: unknown;
}

class FakeBatch {
  readonly writes: RecordedWrite[] = [];
  committed = false;
  set(ref: { path: string }, data: unknown, options?: unknown): FakeBatch {
    this.writes.push({ path: ref.path, data, options });
    return this;
  }
  async commit(): Promise<void> { this.committed = true; }
}

class FakeFirestore {
  readonly batches: FakeBatch[] = [];
  readonly directWrites: RecordedWrite[] = [];
  doc(path: string): { path: string } { return { path }; }
  collection(name: string) {
    return {
      doc: (id: string) => ({
        path: `${name}/${id}`,
        set: async (data: unknown, options?: unknown) => {
          this.directWrites.push({ path: `${name}/${id}`, data, options });
        }
      })
    };
  }
  batch(): FakeBatch {
    const batch = new FakeBatch();
    this.batches.push(batch);
    return batch;
  }
}

function directoryDoc(index: number): StoredIdentityDirectoryDocument {
  return {
    path: `students/S${index}`,
    kind: "student",
    active: true,
    payloadDigest: String(index).padStart(64, "0").slice(-64),
    mirrorVersion: 1,
    mirrorRunId: "directory-run",
    syncedAt: "2026-07-02T10:00:00.000Z",
    data: {
      studentUid: `S${index}`,
      studentName: `학생${index}`,
      studentIdentityKey: `identity-${index}`,
      enrollmentStatus: "active",
      active: true,
      source: "legacy_gas",
      updatedAt: "2026-07-02T10:00:00.000Z"
    }
  };
}

function plan(): IdentityDirectoryMirrorPlan {
  const upserts = Array.from({ length: 405 }, (_, index) => directoryDoc(index));
  return {
    runId: "directory-batch-run",
    snapshotAt: "2026-07-02T10:00:00.000Z",
    sourceDigest: "a".repeat(64),
    sourceCounts: { accounts: 0, students: 405, teachers: 0, classes: 0, classMembers: 0, teacherAssignments: 0, adminAssignments: 0 },
    acceptedCount: 405,
    rejectedCount: 0,
    upserts,
    unchangedPaths: ["students/UNCHANGED"],
    stalePaths: ["students/OLD1", "students/OLD2"],
    conversionErrors: [],
    errors: [],
    reconciliation: {
      expectedCount: 405,
      existingActiveCount: 3,
      upsertCount: 405,
      unchangedCount: 1,
      staleCount: 2,
      missingPaths: upserts.map((document) => document.path),
      mismatchedPaths: [],
      extraActivePaths: ["students/OLD1", "students/OLD2"],
      countsByKind: { student: 405 }
    },
    safeToCommit: true
  };
}

test("identity repository splits large writes into bounded batches and records mirror state", async () => {
  const fake = new FakeFirestore();
  const repository = new FirestoreIdentityDirectoryRepository(fake as unknown as Firestore, 400);
  const result = await repository.commit(plan());

  assert.equal(fake.batches.length, 2);
  assert.equal(fake.batches[0]?.writes.length, 400);
  assert.equal(fake.batches[1]?.writes.length, 7);
  assert.equal(fake.batches.every((batch) => batch.committed), true);
  assert.equal(fake.directWrites.length, 1);
  assert.equal(fake.directWrites[0]?.path, "mirrorState/identity_directory");
  assert.equal(result.written, 405);
  assert.equal(result.staleMarked, 2);

  const staleWrites = fake.batches.flatMap((batch) => batch.writes)
    .filter((write) => (write.data as { active?: boolean }).active === false);
  assert.equal(staleWrites.length, 2);
});

test("identity repository rejects unsafe plans before writing", async () => {
  const unsafe = { ...plan(), safeToCommit: false, errors: [{ code: "incomplete_snapshot" as const, message: "blocked" }] };
  const fake = new FakeFirestore();
  const repository = new FirestoreIdentityDirectoryRepository(fake as unknown as Firestore);
  await assert.rejects(() => repository.commit(unsafe), /unsafe/);
  assert.equal(fake.batches.length, 0);
  assert.equal(fake.directWrites.length, 0);
});
