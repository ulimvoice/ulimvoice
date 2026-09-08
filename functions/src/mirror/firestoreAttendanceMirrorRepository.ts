import type { Firestore, Query } from "firebase-admin/firestore";
import {
  type AttendanceMirrorPlan,
  type AttendanceMirrorScope,
  type StoredAttendanceMirrorDocument,
  attendanceMirrorScopeKey,
  sha256Canonical
} from "./attendanceMirrorPlan.js";

export interface AttendanceMirrorCommitResult {
  runId: string;
  scopeKey: string;
  written: number;
  staleMarked: number;
  unchanged: number;
  stateDocumentId: string;
}

export interface AttendanceMirrorRepository {
  loadScope(scope: AttendanceMirrorScope): Promise<StoredAttendanceMirrorDocument[]>;
  commit(plan: AttendanceMirrorPlan): Promise<AttendanceMirrorCommitResult>;
}


function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedDeep(item)) as T;
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item !== undefined) output[key] = removeUndefinedDeep(item);
    }
    return output as T;
  }
  return value;
}

export class FirestoreAttendanceMirrorRepository implements AttendanceMirrorRepository {
  constructor(private readonly db: Firestore, private readonly maxWritesPerBatch = 400) {
    if (!Number.isInteger(maxWritesPerBatch) || maxWritesPerBatch < 1 || maxWritesPerBatch > 450) {
      throw new Error("maxWritesPerBatch must be between 1 and 450");
    }
  }

  async loadScope(scope: AttendanceMirrorScope): Promise<StoredAttendanceMirrorDocument[]> {
    let query: Query = this.db.collection("attendance").where("sessionDate", "==", scope.sessionDate);
    if (scope.classId) query = query.where("classId", "==", scope.classId);
    const snapshot = await query.get();
    return snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as StoredAttendanceMirrorDocument));
  }

  async commit(plan: AttendanceMirrorPlan): Promise<AttendanceMirrorCommitResult> {
    if (!plan.safeToCommit) throw new Error(`attendance mirror plan is unsafe: ${plan.errors.length} validation error(s)`);
    const operations: Array<
      | { type: "set"; id: string; data: StoredAttendanceMirrorDocument }
      | { type: "stale"; id: string }
    > = [
      ...plan.upserts.map((data) => ({ type: "set" as const, id: data.id, data })),
      ...plan.staleIds.map((id) => ({ type: "stale" as const, id }))
    ];

    for (let offset = 0; offset < operations.length; offset += this.maxWritesPerBatch) {
      const batch = this.db.batch();
      for (const operation of operations.slice(offset, offset + this.maxWritesPerBatch)) {
        const ref = this.db.collection("attendance").doc(operation.id);
        if (operation.type === "set") {
          batch.set(ref, removeUndefinedDeep(operation.data));
        } else {
          batch.set(ref, {
            active: false,
            mirrorRunId: plan.runId,
            scopeKey: plan.scopeKey,
            syncedAt: new Date().toISOString(),
            staleAt: new Date().toISOString()
          }, { merge: true });
        }
      }
      await batch.commit();
    }

    const stateDocumentId = `attendance__${sha256Canonical(plan.scopeKey).slice(0, 24)}`;
    const completedAt = new Date().toISOString();
    const state = {
      dataset: "attendance",
      scope: plan.scope,
      scopeKey: plan.scopeKey,
      runId: plan.runId,
      status: "ready",
      sourceDigest: plan.sourceDigest,
      sourceCount: plan.sourceCount,
      acceptedCount: plan.acceptedCount,
      rejectedCount: plan.rejectedCount,
      writtenCount: plan.upserts.length,
      unchangedCount: plan.unchangedIds.length,
      staleCount: plan.staleIds.length,
      completedAt
    };
    const stateBatch = this.db.batch();
    stateBatch.set(this.db.collection("mirrorState").doc(stateDocumentId), removeUndefinedDeep(state));
    stateBatch.set(this.db.collection("mirrorState").doc("attendance"), removeUndefinedDeep({
      ...state,
      latestScopeStateId: stateDocumentId
    }), { merge: true });
    await stateBatch.commit();

    return {
      runId: plan.runId,
      scopeKey: attendanceMirrorScopeKey(plan.scope),
      written: plan.upserts.length,
      staleMarked: plan.staleIds.length,
      unchanged: plan.unchangedIds.length,
      stateDocumentId
    };
  }
}
