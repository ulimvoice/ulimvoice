import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalJson, sha256Canonical } from "./canonicalJson.js";

export const LEGACY_GAS_SOURCE_AUDIENCE = "ulimvoice-firebase-source";
export const LEGACY_GAS_SOURCE_MAX_TTL_MS = 120_000;
export const LEGACY_GAS_SOURCE_FUTURE_SKEW_MS = 30_000;
export const LEGACY_GAS_SOURCE_MAX_BODY_BYTES = 2_000_000;
export const LEGACY_GAS_SOURCE_KEY_ID = "legacy-gas-v1";

export type LegacyGasSourceDataset = "identity_directory" | "attendance";
export type LegacyGasSourceMode = "dry_run" | "commit";

export interface LegacyGasSourceEnvelope<T = unknown> {
  v: 1;
  source: "ulim_gas";
  audience: typeof LEGACY_GAS_SOURCE_AUDIENCE;
  dataset: LegacyGasSourceDataset;
  mode: LegacyGasSourceMode;
  requestId: string;
  issuedAt: number;
  expiresAt: number;
  payloadDigest: string;
  payload: T;
}

export interface VerifiedLegacyGasSourceEnvelope<T = unknown> {
  envelope: LegacyGasSourceEnvelope<T>;
  canonicalEnvelope: string;
  signature: string;
}

export function createLegacyGasSourceEnvelope<T>(input: {
  dataset: LegacyGasSourceDataset;
  mode: LegacyGasSourceMode;
  requestId: string;
  issuedAt: number;
  expiresAt: number;
  payload: T;
}): LegacyGasSourceEnvelope<T> {
  return {
    v: 1,
    source: "ulim_gas",
    audience: LEGACY_GAS_SOURCE_AUDIENCE,
    dataset: input.dataset,
    mode: input.mode,
    requestId: input.requestId,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    payloadDigest: sha256Canonical(input.payload),
    payload: input.payload
  };
}

export function signLegacyGasSourceEnvelope(envelope: LegacyGasSourceEnvelope, secret: string): string {
  if (!secret.trim()) throw new Error("legacy GAS source secret is not configured");
  return createHmac("sha256", secret).update(canonicalJson(envelope), "utf8").digest("base64url");
}

export function verifyLegacyGasSourceEnvelope<T>(
  rawEnvelope: unknown,
  rawSignature: unknown,
  secret: string,
  now = Date.now()
): VerifiedLegacyGasSourceEnvelope<T> {
  if (!secret.trim()) throw new Error("legacy GAS source secret is not configured");
  const envelope = parseEnvelope<T>(rawEnvelope);
  const signature = parseSignature(rawSignature);
  validateEnvelope(envelope, now);

  const canonicalEnvelope = canonicalJson(envelope);
  const expected = createHmac("sha256", secret).update(canonicalEnvelope, "utf8").digest("base64url");
  if (!constantTimeTextEqual(expected, signature)) throw new Error("legacy GAS source signature is invalid");
  if (sha256Canonical(envelope.payload) !== envelope.payloadDigest) {
    throw new Error("legacy GAS source payload digest mismatch");
  }
  return { envelope, canonicalEnvelope, signature };
}

export function parseLegacyGasSourceHttpBody(body: unknown): unknown {
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > LEGACY_GAS_SOURCE_MAX_BODY_BYTES) {
      throw new Error("legacy GAS source request body is too large");
    }
    try {
      return JSON.parse(body);
    } catch {
      throw new Error("legacy GAS source request body is not valid JSON");
    }
  }
  const serialized = canonicalJson(body);
  if (Buffer.byteLength(serialized, "utf8") > LEGACY_GAS_SOURCE_MAX_BODY_BYTES) {
    throw new Error("legacy GAS source request body is too large");
  }
  return body;
}

function parseEnvelope<T>(value: unknown): LegacyGasSourceEnvelope<T> {
  if (!isPlainObject(value)) throw new Error("legacy GAS source envelope is required");
  const allowed = [
    "v", "source", "audience", "dataset", "mode", "requestId", "issuedAt", "expiresAt", "payloadDigest", "payload"
  ];
  assertExactKeys(value, allowed);
  return value as unknown as LegacyGasSourceEnvelope<T>;
}

function validateEnvelope(envelope: LegacyGasSourceEnvelope, now: number): void {
  if (envelope.v !== 1) throw new Error("legacy GAS source version is invalid");
  if (envelope.source !== "ulim_gas") throw new Error("legacy GAS source name is invalid");
  if (envelope.audience !== LEGACY_GAS_SOURCE_AUDIENCE) throw new Error("legacy GAS source audience mismatch");
  if (envelope.dataset !== "identity_directory" && envelope.dataset !== "attendance") {
    throw new Error("legacy GAS source dataset is invalid");
  }
  if (envelope.mode !== "dry_run" && envelope.mode !== "commit") throw new Error("legacy GAS source mode is invalid");
  if (typeof envelope.requestId !== "string" || !/^[A-Za-z0-9:_-]{16,128}$/.test(envelope.requestId)) {
    throw new Error("legacy GAS source requestId is invalid");
  }
  if (!Number.isSafeInteger(envelope.issuedAt) || !Number.isSafeInteger(envelope.expiresAt)) {
    throw new Error("legacy GAS source timestamps must be safe integers");
  }
  if (envelope.issuedAt > now + LEGACY_GAS_SOURCE_FUTURE_SKEW_MS) throw new Error("legacy GAS source request is from the future");
  if (envelope.expiresAt <= now) throw new Error("legacy GAS source request expired");
  if (envelope.expiresAt <= envelope.issuedAt) throw new Error("legacy GAS source expiresAt must be after issuedAt");
  if (envelope.expiresAt - envelope.issuedAt > LEGACY_GAS_SOURCE_MAX_TTL_MS) {
    throw new Error("legacy GAS source request ttl exceeds maximum");
  }
  if (typeof envelope.payloadDigest !== "string" || !/^[a-f0-9]{64}$/.test(envelope.payloadDigest)) {
    throw new Error("legacy GAS source payloadDigest is invalid");
  }
  if (!isPlainObject(envelope.payload)) throw new Error("legacy GAS source payload must be an object");
}

function parseSignature(value: unknown): string {
  if (typeof value !== "string") throw new Error("legacy GAS source signature is required");
  const trimmed = value.trim().replace(/^v1=/, "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(trimmed)) throw new Error("legacy GAS source signature format is invalid");
  return trimmed;
}

function constantTimeTextEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function assertExactKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const expected = [...allowed].sort();
  const actual = Object.keys(value).sort();
  if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) {
    throw new Error("legacy GAS source envelope fields are invalid");
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
