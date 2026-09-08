import test from "node:test";
import assert from "node:assert/strict";
import { safeLegacyAuthUid } from "../src/auth/legacySessionBridge.js";
import {
  buildDirectoryClassId,
  convertIdentityDirectorySnapshot,
  type LegacyIdentityDirectorySnapshot
} from "../src/directory/identityDirectory.js";
import {
  buildIdentityDirectoryMirrorPlan,
  type StoredIdentityDirectoryDocument
} from "../src/directory/identityDirectoryPlan.js";
import {
  runIdentityDirectoryMirror,
  UnsafeIdentityDirectoryPlanError
} from "../src/directory/identityDirectoryService.js";
import type {
  IdentityDirectoryCommitResult,
  IdentityDirectoryRepository
} from "../src/directory/firestoreIdentityDirectoryRepository.js";

import { fixtureSnapshot } from "./fixtures/identityDirectoryFixture.js";

test("identity directory converts signed source data into minimal Firestore paths", () => {
  const result = convertIdentityDirectorySnapshot(fixtureSnapshot(), new Date("2026-07-02T10:00:00.000Z"));
  assert.deepEqual(result.errors, []);
  assert.equal(result.documents.length, 11);
  const accountPath = `legacyAccounts/${safeLegacyAuthUid("student", "student:STU-001")}`;
  assert.ok(result.documents.some((document) => document.path === accountPath));
  assert.ok(result.documents.some((document) => document.path === "teacherAssignments/ADM-TEACHER-1/classes/class_a"));
  const serialized = JSON.stringify(result.documents);
  assert.equal(/phone|전화|연락처/i.test(serialized), false);
  assert.equal(serialized.includes("student:STU-001"), false);
});

test("class id derivation is deterministic when explicit id is absent", () => {
  const first = buildDirectoryClassId({ className: " 목요일  연기기초 ", instructorUids: ["T1"] });
  const second = buildDirectoryClassId({ className: "목요일 연기기초", instructorUids: ["T1"] });
  assert.equal(first, second);
  assert.match(first, /^legacy_[a-f0-9]{24}$/);
});

test("directory rejects phone-shaped fields and broken references", () => {
  const sensitive = fixtureSnapshot() as unknown as Record<string, unknown>;
  (sensitive.students as Array<Record<string, unknown>>)[0].studentPhone = "010";
  const sensitiveResult = convertIdentityDirectorySnapshot(sensitive as unknown as LegacyIdentityDirectorySnapshot);
  assert.equal(sensitiveResult.errors[0]?.code, "sensitive_field");

  const broken = fixtureSnapshot();
  broken.classMembers[0].studentUid = "MISSING";
  const brokenResult = convertIdentityDirectorySnapshot(broken);
  assert.ok(brokenResult.errors.some((error) => error.code === "missing_reference"));
});

test("directory plan reports new, changed, stale, and incomplete snapshots", () => {
  const snapshot = fixtureSnapshot();
  const first = buildIdentityDirectoryMirrorPlan(snapshot, [], { runId: "run-1", now: new Date("2026-07-02T10:00:00.000Z") });
  assert.equal(first.safeToCommit, true);
  assert.equal(first.upserts.length, 11);

  const existing = first.upserts.map((document) => ({ ...document }));
  const unchanged = buildIdentityDirectoryMirrorPlan(snapshot, existing, { runId: "run-2", now: new Date("2026-07-02T10:01:00.000Z") });
  assert.equal(unchanged.upserts.length, 0);
  assert.equal(unchanged.unchangedPaths.length, 11);

  const changedSnapshot = fixtureSnapshot();
  changedSnapshot.students[0].studentName = "변경학생";
  const changed = buildIdentityDirectoryMirrorPlan(changedSnapshot, existing, { runId: "run-3" });
  assert.ok(changed.reconciliation.mismatchedPaths.includes("students/STU-001"));

  const staleDoc: StoredIdentityDirectoryDocument = {
    ...existing[0],
    path: "students/OLD",
    active: true,
    data: { studentUid: "OLD", active: true, source: "legacy_gas" }
  };
  const stale = buildIdentityDirectoryMirrorPlan(snapshot, [...existing, staleDoc], { runId: "run-4" });
  assert.deepEqual(stale.stalePaths, ["students/OLD"]);

  const incomplete = fixtureSnapshot();
  incomplete.complete = false;
  assert.equal(buildIdentityDirectoryMirrorPlan(incomplete, [], { runId: "run-5" }).safeToCommit, false);
});

class MemoryDirectoryRepository implements IdentityDirectoryRepository {
  documents: StoredIdentityDirectoryDocument[] = [];
  commits = 0;
  async loadAll(): Promise<StoredIdentityDirectoryDocument[]> {
    return this.documents.map((document) => ({ ...document, data: { ...document.data } }));
  }
  async commit(plan: ReturnType<typeof buildIdentityDirectoryMirrorPlan>): Promise<IdentityDirectoryCommitResult> {
    this.commits += 1;
    const byPath = new Map(this.documents.map((document) => [document.path, document]));
    plan.upserts.forEach((document) => byPath.set(document.path, document));
    plan.stalePaths.forEach((path) => {
      const current = byPath.get(path);
      if (current) byPath.set(path, { ...current, active: false, staleAt: new Date().toISOString() });
    });
    this.documents = [...byPath.values()];
    return { runId: plan.runId, written: plan.upserts.length, staleMarked: plan.stalePaths.length, unchanged: plan.unchangedPaths.length, stateDocumentId: "identity_directory" };
  }
}

test("directory service supports dry-run, commit, and post-write verification", async () => {
  const repository = new MemoryDirectoryRepository();
  const dry = await runIdentityDirectoryMirror({ snapshot: fixtureSnapshot(), repository, dryRun: true, runId: "dry" });
  assert.equal(dry.plan.safeToCommit, true);
  assert.equal(repository.commits, 0);
  const committed = await runIdentityDirectoryMirror({ snapshot: fixtureSnapshot(), repository, verifyAfterWrite: true, runId: "commit" });
  assert.equal(repository.commits, 1);
  assert.equal(committed.verification?.upserts.length, 0);
  assert.equal(committed.verification?.stalePaths.length, 0);
});

test("directory service rejects an unsafe snapshot before commit", async () => {
  const repository = new MemoryDirectoryRepository();
  const snapshot = fixtureSnapshot();
  snapshot.complete = false;
  await assert.rejects(() => runIdentityDirectoryMirror({ snapshot, repository }), UnsafeIdentityDirectoryPlanError);
  assert.equal(repository.commits, 0);
});
