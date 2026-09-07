import test from "node:test";
import assert from "node:assert/strict";
import {
  createLegacyGasSourceEnvelope,
  parseLegacyGasSourceHttpBody,
  signLegacyGasSourceEnvelope,
  verifyLegacyGasSourceEnvelope
} from "../src/source/legacyGasSourceContract.js";

const secret = "phase2-1-test-secret-that-is-long-and-not-production";
const now = Date.parse("2026-07-02T10:00:00.000Z");

function envelope() {
  return createLegacyGasSourceEnvelope({
    dataset: "identity_directory",
    mode: "dry_run",
    requestId: "gas_identity_20260702_0001",
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    payload: { schemaVersion: 1, complete: true }
  });
}

test("signed GAS source envelope verifies with canonical key ordering", () => {
  const value = envelope();
  const signature = signLegacyGasSourceEnvelope(value, secret);
  const reordered = {
    payload: value.payload,
    payloadDigest: value.payloadDigest,
    expiresAt: value.expiresAt,
    issuedAt: value.issuedAt,
    requestId: value.requestId,
    mode: value.mode,
    dataset: value.dataset,
    audience: value.audience,
    source: value.source,
    v: value.v
  };
  const verified = verifyLegacyGasSourceEnvelope(reordered, `v1=${signature}`, secret, now);
  assert.equal(verified.envelope.requestId, value.requestId);
});

test("tampered payload, bad signature, expired request, and extra fields fail closed", () => {
  const value = envelope();
  const signature = signLegacyGasSourceEnvelope(value, secret);
  assert.throws(() => verifyLegacyGasSourceEnvelope({ ...value, payload: { schemaVersion: 2 } }, signature, secret, now), /signature|digest/i);
  assert.throws(() => verifyLegacyGasSourceEnvelope(value, `${signature.slice(0, -1)}A`, secret, now), /signature/i);
  assert.throws(() => verifyLegacyGasSourceEnvelope({ ...value, issuedAt: now - 130_000, expiresAt: now - 1 }, signature, secret, now), /expired/i);
  assert.throws(() => verifyLegacyGasSourceEnvelope({ ...value, extra: true }, signature, secret, now), /fields/i);
});

test("body parser accepts JSON text and rejects malformed or oversized bodies", () => {
  const value = envelope();
  assert.deepEqual(parseLegacyGasSourceHttpBody(JSON.stringify(value)), value);
  assert.throws(() => parseLegacyGasSourceHttpBody("{"), /valid JSON/i);
  assert.throws(() => parseLegacyGasSourceHttpBody("x".repeat(2_000_001)), /too large/i);
});
