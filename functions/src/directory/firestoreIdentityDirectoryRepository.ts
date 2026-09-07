import type { Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";
import type {
  IdentityDirectoryMirrorPlan,
  StoredIdentityDirectoryDocument
} from "./identityDirectoryPlan.js";

export interface IdentityDirectoryCommitResult {
  runId: string;
  written: number;
  staleMarked: number;
  unchanged: number;
  stateDocumentId: string;
}

export interface IdentityDirectoryRepository {
  loadAll(): Promise<StoredIdentityDirectoryDocument[]>;
  commit(plan: IdentityDirectoryMirrorPlan): Promise<IdentityDirectoryCommitResult>;
}

export class FirestoreIdentityDirectoryRepository implements IdentityDirectoryRepository {
  constructor(private readonly db: Firestore, private readonly maxWritesPerBatch = 400) {
    if (!Number.isInteger(maxWritesPerBatch) || maxWritesPerBatch < 1 || maxWritesPerBatch > 450) {
      throw new Error("maxWritesPerBatch must be between 1 and 450");
    }
  }

  async loadAll(): Promise<StoredIdentityDirectoryDocument[]> {
    const documents: StoredIdentityDirectoryDocument[] = [];
    for (const collectionName of ["legacyAccounts", "students", "teachers", "classes", "classMembers"] as const) {
      const snapshot = await this.db.collection(collectionName).where("source", "==", "legacy_gas").get();
      snapshot.docs.forEach((document) => documents.push(fromSnapshot(document)));
    }
    await this.loadAssignmentCollection("teacherAssignments", documents);
    await this.loadAssignmentCollection("adminAssignments", documents);
    return documents.sort((a, b) => a.path.localeCompare(b.path));
  }

  async commit(plan: IdentityDirectoryMirrorPlan): Promise<IdentityDirectoryCommitResult> {
    if (!plan.safeToCommit) throw new Error(`identity directory plan is unsafe: ${plan.errors.length} validation error(s)`);
    const operations: Array<
      | { type: "set"; document: StoredIdentityDirectoryDocument }
      | { type: "stale"; path: string }
    > = [
      ...plan.upserts.map((document) => ({ type: "set" as const, document })),
      ...plan.stalePaths.map((path) => ({ type: "stale" as const, path }))
    ];

    for (let offset = 0; offset < operations.length; offset += this.maxWritesPerBatch) {
      const batch = this.db.batch();
      for (const operation of operations.slice(offset, offset + this.maxWritesPerBatch)) {
        if (operation.type === "set") {
          const { path, kind, active, payloadDigest, mirrorVersion, mirrorRunId, syncedAt, data } = operation.document;
          const payload = {
            ...data,
            active,
            source: "legacy_gas",
            directoryKind: kind,
            payloadDigest,
            mirrorVersion,
            mirrorRunId,
            syncedAt
          };
          // 학생 기본정보 V2의 전화·생년월일·동의·수강 파생 필드는
          // GAS 식별자 미러가 삭제하면 안 됩니다. 학생 문서만 안전 병합합니다.
          if (kind === "student") batch.set(this.db.doc(path), payload, { merge: true });
          else batch.set(this.db.doc(path), payload);
        } else {
          batch.set(this.db.doc(operation.path), {
            active: false,
            mirrorRunId: plan.runId,
            syncedAt: new Date().toISOString(),
            staleAt: new Date().toISOString()
          }, { merge: true });
        }
      }
      await batch.commit();
    }

    const stateDocumentId = "identity_directory";
    await this.db.collection("mirrorState").doc(stateDocumentId).set({
      dataset: "identity_directory",
      status: "ready",
      runId: plan.runId,
      snapshotAt: plan.snapshotAt,
      sourceDigest: plan.sourceDigest,
      sourceCounts: plan.sourceCounts,
      acceptedCount: plan.acceptedCount,
      rejectedCount: plan.rejectedCount,
      writtenCount: plan.upserts.length,
      unchangedCount: plan.unchangedPaths.length,
      staleCount: plan.stalePaths.length,
      countsByKind: plan.reconciliation.countsByKind,
      completedAt: new Date().toISOString()
    });

    return {
      runId: plan.runId,
      written: plan.upserts.length,
      staleMarked: plan.stalePaths.length,
      unchanged: plan.unchangedPaths.length,
      stateDocumentId
    };
  }

  private async loadAssignmentCollection(
    collectionName: "teacherAssignments" | "adminAssignments",
    target: StoredIdentityDirectoryDocument[]
  ): Promise<void> {
    const parents = await this.db.collection(collectionName).where("source", "==", "legacy_gas").get();
    for (const parent of parents.docs) {
      target.push(fromSnapshot(parent));
      const classes = await parent.ref.collection("classes").where("source", "==", "legacy_gas").get();
      classes.docs.forEach((document) => target.push(fromSnapshot(document)));
    }
  }
}

function fromSnapshot(document: QueryDocumentSnapshot): StoredIdentityDirectoryDocument {
  const data = document.data();
  const path = document.ref.path;
  const kind = String(data.directoryKind || inferKind(path)) as StoredIdentityDirectoryDocument["kind"];
  const publicData = { ...data };
  for (const key of ["directoryKind", "payloadDigest", "mirrorVersion", "mirrorRunId", "syncedAt", "staleAt"]) delete publicData[key];
  return {
    path,
    kind,
    active: data.active === true,
    payloadDigest: String(data.payloadDigest || ""),
    mirrorVersion: Number(data.mirrorVersion || 0),
    mirrorRunId: String(data.mirrorRunId || ""),
    syncedAt: String(data.syncedAt || ""),
    staleAt: data.staleAt ? String(data.staleAt) : undefined,
    data: publicData
  };
}

function inferKind(path: string): StoredIdentityDirectoryDocument["kind"] {
  const segments = path.split("/");
  if (segments[0] === "legacyAccounts") return "legacyAccount";
  if (segments[0] === "students") return "student";
  if (segments[0] === "teachers") return "teacher";
  if (segments[0] === "classes") return "class";
  if (segments[0] === "classMembers") return "classMember";
  if (segments[0] === "teacherAssignments") return segments.length === 2 ? "teacherAssignmentParent" : "teacherAssignment";
  return segments.length === 2 ? "adminAssignmentParent" : "adminAssignment";
}
