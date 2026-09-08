import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onRequest, type Request } from "firebase-functions/v2/https";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { FirestoreIdempotencyStore, type IdempotencyStore } from "../common/idempotency.js";
import { FirestoreIdentityDirectoryRepository, type IdentityDirectoryRepository } from "../directory/firestoreIdentityDirectoryRepository.js";
import { runIdentityDirectoryMirror, UnsafeIdentityDirectoryPlanError } from "../directory/identityDirectoryService.js";
import type { LegacyIdentityDirectorySnapshot } from "../directory/identityDirectory.js";
import {
  LEGACY_GAS_SOURCE_KEY_ID,
  parseLegacyGasSourceHttpBody,
  verifyLegacyGasSourceEnvelope
} from "./legacyGasSourceContract.js";

export const ULIM_GAS_SOURCE_HMAC_SECRET = defineSecret("ULIM_GAS_SOURCE_HMAC_SECRET");

export interface LegacyGasSourceRequestInput {
  method: string;
  body: unknown;
  signature?: unknown;
  keyId?: unknown;
}

export interface LegacyGasSourceHandlerDeps {
  secret: string;
  identityRepository: IdentityDirectoryRepository;
  idempotencyStore: IdempotencyStore;
  now?: () => number;
  commitEnabled?: boolean;
}

export interface LegacyGasSourceResponse {
  status: number;
  body: Record<string, unknown>;
}

export async function handleLegacyGasSourceRequest(
  input: LegacyGasSourceRequestInput,
  deps: LegacyGasSourceHandlerDeps
): Promise<LegacyGasSourceResponse> {
  if (input.method.toUpperCase() !== "POST") return response(405, { ok: false, code: "method_not_allowed" });
  if (String(input.keyId || "") !== LEGACY_GAS_SOURCE_KEY_ID) return response(401, { ok: false, code: "unknown_key_id" });

  let verified;
  try {
    const parsedBody = parseLegacyGasSourceHttpBody(input.body);
    verified = verifyLegacyGasSourceEnvelope<LegacyIdentityDirectorySnapshot>(
      parsedBody,
      input.signature,
      deps.secret,
      deps.now?.() ?? Date.now()
    );
  } catch (error) {
    return response(401, { ok: false, code: "source_auth_rejected", message: safeSourceError(error) });
  }

  const envelope = verified.envelope;
  if (envelope.dataset !== "identity_directory") {
    return response(400, { ok: false, code: "dataset_not_supported" });
  }
  if (envelope.mode === "commit" && deps.commitEnabled !== true) {
    return response(503, { ok: false, code: "commit_disabled", message: "identity directory commit is disabled" });
  }

  const operationName = `gas_source:${envelope.dataset}:${envelope.mode}:${envelope.payloadDigest}`;
  const begin = await deps.idempotencyStore.begin(envelope.requestId, operationName, new Date(deps.now?.() ?? Date.now()));
  if (begin.duplicate) {
    if (begin.operation.operation !== operationName) {
      return response(409, { ok: false, code: "request_id_conflict" });
    }
    return response(200, {
      ok: true,
      duplicate: true,
      requestId: envelope.requestId,
      status: begin.operation.status,
      resultDigest: begin.operation.resultDigest || ""
    });
  }

  try {
    const result = await runIdentityDirectoryMirror({
      snapshot: envelope.payload,
      repository: deps.identityRepository,
      runId: envelope.requestId,
      now: new Date(deps.now?.() ?? Date.now()),
      dryRun: envelope.mode === "dry_run",
      verifyAfterWrite: envelope.mode === "commit"
    });
    const verificationSafe = result.verification ? result.verification.safeToCommit && result.verification.upserts.length === 0 && result.verification.stalePaths.length === 0 : undefined;
    await deps.idempotencyStore.update(envelope.requestId, {
      status: envelope.mode === "dry_run" ? "validated" : "firestore_synced",
      resultDigest: result.plan.sourceDigest,
      lastError: undefined
    });
    return response(200, {
      ok: true,
      duplicate: false,
      requestId: envelope.requestId,
      dataset: envelope.dataset,
      mode: envelope.mode,
      sourceDigest: result.plan.sourceDigest,
      safeToCommit: result.plan.safeToCommit,
      reconciliation: result.plan.reconciliation,
      commit: result.commit || null,
      verificationSafe: verificationSafe ?? null
    });
  } catch (error) {
    const plan = error instanceof UnsafeIdentityDirectoryPlanError ? error.plan : undefined;
    await deps.idempotencyStore.update(envelope.requestId, {
      status: "failed",
      lastError: safeSourceError(error),
      resultDigest: plan?.sourceDigest
    });
    return response(plan ? 422 : 500, {
      ok: false,
      code: plan ? "unsafe_directory_snapshot" : "source_ingest_failed",
      requestId: envelope.requestId,
      errors: plan?.errors || [],
      reconciliation: plan?.reconciliation || null
    });
  }
}

export const ingestLegacyGasSnapshot = onRequest(
  { region: ULIM_FUNCTION_REGION, secrets: [ULIM_GAS_SOURCE_HMAC_SECRET], timeoutSeconds: 60, memory: "512MiB", maxInstances: 2 },
  async (request, responseObject) => {
    const adminApp = getOrInitializeDefaultFirebaseAdminApp();
    const db = getFirestore(adminApp);
    const result = await handleLegacyGasSourceRequest(
      toRequestInput(request),
      {
        secret: ULIM_GAS_SOURCE_HMAC_SECRET.value() || process.env.ULIM_GAS_SOURCE_HMAC_SECRET || "",
        identityRepository: new FirestoreIdentityDirectoryRepository(db),
        idempotencyStore: new FirestoreIdempotencyStore(db),
        commitEnabled: process.env.ULIM_GAS_SOURCE_COMMIT_ENABLED === "true"
      }
    );
    responseObject.status(result.status).json(result.body);
  }
);

function toRequestInput(request: Request): LegacyGasSourceRequestInput {
  return {
    method: request.method,
    body: request.body,
    signature: request.get("x-ulim-signature"),
    keyId: request.get("x-ulim-key-id")
  };
}

function response(status: number, body: Record<string, unknown>): LegacyGasSourceResponse {
  return { status, body };
}

function safeSourceError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/secret is not configured/i.test(message)) return "source adapter is not configured";
  if (/signature|expired|future|audience|key|digest|JSON|body|envelope|requestId|timestamp|ttl|dataset|mode/i.test(message)) {
    return "source request rejected";
  }
  if (error instanceof UnsafeIdentityDirectoryPlanError) return "identity directory snapshot is unsafe";
  return "source ingest failed";
}
