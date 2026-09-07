export type SyncStatus = "pending" | "validated" | "sheet_saved" | "firestore_synced" | "notified" | "retrying" | "failed";

export interface SyncOperation {
  requestId: string;
  operation: string;
  status: SyncStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  resultDigest?: string;
}

export interface BeginOperationResult {
  operation: SyncOperation;
  duplicate: boolean;
}

export interface IdempotencyStore {
  get(requestId: string): Promise<SyncOperation | undefined>;
  begin(requestId: string, operation: string, now?: Date): Promise<BeginOperationResult>;
  update(requestId: string, patch: Partial<SyncOperation>): Promise<SyncOperation>;
}

export class DuplicateRequestError extends Error {
  constructor(public readonly operation: SyncOperation) {
    super(`Duplicate requestId: ${operation.requestId}`);
  }
}

function omitUndefinedOptionalFields(operation: SyncOperation): SyncOperation {
  const normalized = { ...operation };
  if (normalized.lastError === undefined) delete normalized.lastError;
  if (normalized.resultDigest === undefined) delete normalized.resultDigest;
  return normalized;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly operations = new Map<string, SyncOperation>();

  async get(requestId: string): Promise<SyncOperation | undefined> {
    return this.operations.get(requestId);
  }

  async begin(requestId: string, operation: string, now = new Date()): Promise<BeginOperationResult> {
    if (!requestId || !requestId.trim()) throw new Error("requestId is required");
    const existing = this.operations.get(requestId);
    if (existing) return { operation: existing, duplicate: true };
    const timestamp = now.toISOString();
    const syncOperation: SyncOperation = {
      requestId,
      operation,
      status: "pending",
      attempts: 1,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.operations.set(requestId, syncOperation);
    return { operation: syncOperation, duplicate: false };
  }

  async update(requestId: string, patch: Partial<SyncOperation>): Promise<SyncOperation> {
    const current = this.operations.get(requestId);
    if (!current) throw new Error(`Missing sync operation: ${requestId}`);
    const next = omitUndefinedOptionalFields({
      ...current,
      ...patch,
      requestId,
      updatedAt: new Date().toISOString()
    });
    this.operations.set(requestId, next);
    return next;
  }
}

export interface FirestoreTransactionLike {
  get(ref: unknown): Promise<{ exists: boolean; data(): unknown }>;
  create(ref: unknown, data: SyncOperation): void;
  set(ref: unknown, data: SyncOperation): void;
}

export interface FirestoreIdempotencyDb {
  doc(path: string): unknown;
  runTransaction<T>(callback: (transaction: FirestoreTransactionLike) => Promise<T>): Promise<T>;
}

export class FirestoreIdempotencyStore implements IdempotencyStore {
  constructor(private readonly db: FirestoreIdempotencyDb) {}

  async get(requestId: string): Promise<SyncOperation | undefined> {
    if (!requestId || !requestId.trim()) throw new Error("requestId is required");
    const ref = this.db.doc(`syncOperations/${requestId}`);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      return snapshot.exists ? snapshot.data() as SyncOperation : undefined;
    });
  }

  async begin(requestId: string, operation: string, now = new Date()): Promise<BeginOperationResult> {
    if (!requestId || !requestId.trim()) throw new Error("requestId is required");
    const ref = this.db.doc(`syncOperations/${requestId}`);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) {
        return { operation: snapshot.data() as SyncOperation, duplicate: true };
      }
      const timestamp = now.toISOString();
      const syncOperation: SyncOperation = {
        requestId,
        operation,
        status: "pending",
        attempts: 1,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      transaction.create(ref, syncOperation);
      return { operation: syncOperation, duplicate: false };
    });
  }

  async update(requestId: string, patch: Partial<SyncOperation>): Promise<SyncOperation> {
    if (!requestId || !requestId.trim()) throw new Error("requestId is required");
    const ref = this.db.doc(`syncOperations/${requestId}`);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error(`Missing sync operation: ${requestId}`);
      const current = snapshot.data() as SyncOperation;
      const next = omitUndefinedOptionalFields({
        ...current,
        ...patch,
        requestId: current.requestId,
        operation: current.operation,
        updatedAt: new Date().toISOString()
      });
      if (!Number.isSafeInteger(next.attempts) || next.attempts < 1) throw new Error("attempts must be a positive safe integer");
      transaction.set(ref, next);
      return next;
    });
  }
}

export async function beginOperation(
  store: IdempotencyStore,
  requestId: string,
  operation: string,
  now = new Date()
): Promise<SyncOperation> {
  const result = await store.begin(requestId, operation, now);
  if (result.duplicate) throw new DuplicateRequestError(result.operation);
  return result.operation;
}

export function isTerminalStatus(status: SyncStatus): boolean {
  return status === "validated" || status === "firestore_synced" || status === "notified" || status === "failed";
}

export function shouldSkipSideEffects(result: BeginOperationResult): boolean {
  return result.duplicate && isTerminalStatus(result.operation.status);
}

export function nextRetry(operation: SyncOperation, error: unknown): Partial<SyncOperation> {
  return {
    attempts: operation.attempts + 1,
    status: "retrying",
    lastError: error instanceof Error ? error.message : String(error)
  };
}
