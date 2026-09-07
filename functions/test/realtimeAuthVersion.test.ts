import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRealtimeAuthVersion,
  realtimeAuthVersionsEqual
} from "../src/realtime/realtimeAuthVersion.js";

test("UIDv2 string authVersion is accepted", () => {
  assert.equal(
    normalizeRealtimeAuthVersion("uidv2"),
    "uidv2"
  );
});

test("UIDv2 authVersion is normalized case-insensitively", () => {
  assert.equal(
    normalizeRealtimeAuthVersion(" UIDV2 "),
    "uidv2"
  );
});

test("legacy positive integer authVersion remains accepted", () => {
  assert.equal(
    normalizeRealtimeAuthVersion(3),
    3
  );
});

test("invalid authVersion values are rejected", () => {
  assert.equal(
    normalizeRealtimeAuthVersion(0),
    null
  );
  assert.equal(
    normalizeRealtimeAuthVersion("2"),
    null
  );
  assert.equal(
    normalizeRealtimeAuthVersion(""),
    null
  );
});

test("claim and Firestore UIDv2 authVersion compare equal", () => {
  assert.equal(
    realtimeAuthVersionsEqual(
      "uidv2",
      "UIDV2"
    ),
    true
  );
});
