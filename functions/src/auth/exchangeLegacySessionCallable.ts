import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { FirebaseAdminAuthBridge } from "./firebaseAdminAuthBridge.js";
import { FirestoreLegacyProofStore } from "./firestoreLegacyProofStore.js";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_LEGACY_PROOF_HMAC_SECRET } from "../common/firebaseSecrets.js";
import {
  exchangeLegacySession,
  LEGACY_AUTH_AUDIENCE,
  LEGACY_AUTH_MAX_TTL_MS,
  type FirebaseAuthBridge
} from "./legacySessionBridge.js";
import type { AtomicLegacyProofVerifier } from "./legacySessionBridge.js";

export interface ExchangeLegacySessionCallableDeps {
  verifier: AtomicLegacyProofVerifier;
  auth: FirebaseAuthBridge;
  now?: () => number;
  requestAuth?: unknown;
}

export async function handleExchangeLegacySessionCallable(
  data: unknown,
  deps: ExchangeLegacySessionCallableDeps
): Promise<{ ok: true; firebaseUid: string; customToken: string; expiresInSeconds: number }> {
  if (deps.requestAuth !== null && deps.requestAuth !== undefined) {
    throw new HttpsError("failed-precondition", "sign out before exchanging a legacy proof");
  }
  const proof = parseProofInput(data);
  try {
    const result = await exchangeLegacySession(
      {
        proof,
        expectedAudience: LEGACY_AUTH_AUDIENCE,
        now: deps.now?.() ?? Date.now(),
        maxTtlMs: LEGACY_AUTH_MAX_TTL_MS
      },
      deps.verifier,
      deps.auth
    );
    return {
      ok: true,
      firebaseUid: result.firebaseUid,
      customToken: result.customToken,
      expiresInSeconds: result.expiresInSeconds
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "[ULIM exchangeLegacySession 7.26]",
      {
        errorName:
          error instanceof Error
            ? error.name
            : typeof error,
        message,
        code:
          typeof error === "object" &&
          error !== null &&
          "code" in error
            ? String(
                (error as { code?: unknown }).code ||
                ""
              )
            : ""
      }
    );

    throw toHttpsError(error);
  }
}

export const exchangeLegacySessionCallable = onCall(
  { region: ULIM_FUNCTION_REGION, secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET] },
  async (request: CallableRequest<unknown>) => {
    const adminApp = getOrInitializeDefaultFirebaseAdminApp();
    const secret = ULIM_LEGACY_PROOF_HMAC_SECRET.value() || process.env.ULIM_LEGACY_PROOF_HMAC_SECRET || "";
    const db = getFirestore(adminApp);
    const verifier = new FirestoreLegacyProofStore(db, secret, Timestamp);
    const auth = new FirebaseAdminAuthBridge(
      getAuth(adminApp),
      db,
      Timestamp,
      process.env.ULIM_REQUIRE_LEGACY_DIRECTORY_ACCOUNT === "true"
    );
    return handleExchangeLegacySessionCallable(request.data, { verifier, auth, requestAuth: request.auth });
  }
);

const MAX_CALLABLE_PROOF_LENGTH = 4096;

function parseProofInput(data: unknown): string {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "proof is required");
  }
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length !== 1 || entries[0]?.[0] !== "proof") {
    throw new HttpsError("invalid-argument", "input must be exactly { proof }");
  }
  const proof = entries[0][1];
  if (typeof proof !== "string" || !proof.trim() || proof.length > MAX_CALLABLE_PROOF_LENGTH) {
    throw new HttpsError("invalid-argument", "proof is required");
  }
  return proof;
}

function safeReasonCode(message: string): string {
  if (/canonical.*role/i.test(message)) return "CANONICAL_ROLE_MISMATCH";
  if (/canonical.*principal/i.test(message)) return "CANONICAL_PRINCIPAL_MISMATCH";
  if (/canonical.*authVersion/i.test(message)) return "CANONICAL_AUTH_VERSION";
  if (/canonical.*disabled|firebase user is disabled/i.test(message)) return "CANONICAL_AUTH_DISABLED";
  if (/existing user role conflicts/i.test(message)) return "ACCESS_ROLE_MISMATCH";
  if (/firebase user is inactive|account is inactive/i.test(message)) return "ACCESS_INACTIVE";
  return "AUTH_BRIDGE_PERMISSION";
}

function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/inactive|disabled|role conflicts|conflicts|permission|authVersion|canonical/i.test(message)) {
    return new HttpsError(
      "permission-denied",
      "legacy account is not permitted",
      { bridgeVersion: "2026-07-29.726.01", reason: safeReasonCode(message) }
    );
  }
  if (/required|format|payload|version|jti|must not|must be|role is invalid|legacyUid|studentUid|teacherUid|exp must|tablet/i.test(message)) {
    return new HttpsError("invalid-argument", "invalid legacy proof");
  }
  if (/audience|signature|expired|ttl|future|not found|consumed/i.test(message)) return new HttpsError("unauthenticated", "legacy proof rejected");
  if (/secret is not configured/i.test(message)) return new HttpsError("failed-precondition", "legacy auth bridge is not configured");
  return new HttpsError("internal", "legacy auth exchange failed");
}
