import test from "node:test";
import assert from "node:assert/strict";
import { mirrorWebAttendanceRows, normalizeForCurrentAttendanceUi } from "../src/mirror/attendanceMirror.js";
import { runAttendanceShadowRead } from "../src/mirror/attendanceShadowRead.js";
import { attendanceParityFixture } from "./fixtures/attendancePrevalidationFixture.js";

const gasResponse = { status: "success", records: attendanceParityFixture, marker: "gas-authoritative" };
const firestoreRecords = normalizeForCurrentAttendanceUi(mirrorWebAttendanceRows(attendanceParityFixture).documents);

test("shadow mode is inert unless both enabled and explicit test mode are set", async () => {
  let firestoreCalls = 0;
  const disabled = await runAttendanceShadowRead({
    enabled: false,
    explicitTestMode: false,
    params: {},
    gasReader: async () => gasResponse,
    firestoreReader: async () => { firestoreCalls += 1; return firestoreRecords; }
  });
  assert.equal(disabled.response, gasResponse);
  assert.equal(disabled.diagnostic.code, "disabled");
  assert.equal(firestoreCalls, 0);

  const guarded = await runAttendanceShadowRead({
    enabled: true,
    explicitTestMode: false,
    params: {},
    gasReader: async () => gasResponse,
    firestoreReader: async () => { firestoreCalls += 1; return firestoreRecords; }
  });
  assert.equal(guarded.diagnostic.code, "not_explicit_test_mode");
  assert.equal(firestoreCalls, 0);
});

test("matching shadow result records parity but always returns GAS response", async () => {
  const result = await runAttendanceShadowRead({
    enabled: true,
    explicitTestMode: true,
    params: { date: "2026-07-04" },
    gasReader: async () => gasResponse,
    firestoreReader: async () => [...firestoreRecords].reverse()
  });
  assert.equal(result.response.marker, "gas-authoritative");
  assert.equal(result.diagnostic.code, "match");
  assert.equal(result.diagnostic.parity?.parityPass, true);
});

test("timeout, permission, unavailable, and unauthenticated failures never replace GAS", async () => {
  const cases = [
    { expected: "timeout", reader: () => new Promise<never>(() => {}) },
    { expected: "permission_denied", reader: async () => { throw Object.assign(new Error("denied"), { code: "permission-denied" }); } },
    { expected: "unavailable", reader: async () => { throw Object.assign(new Error("offline"), { code: "unavailable" }); } },
    { expected: "unauthenticated", reader: async () => { throw Object.assign(new Error("login"), { code: "unauthenticated" }); } }
  ];
  for (const item of cases) {
    const result = await runAttendanceShadowRead({
      enabled: true,
      explicitTestMode: true,
      params: {},
      timeoutMs: 100,
      gasReader: async () => gasResponse,
      firestoreReader: item.reader
    });
    assert.equal(result.response, gasResponse);
    assert.equal(result.diagnostic.code, item.expected);
  }
});

test("empty, partial, and malformed Firestore results are diagnosed while GAS remains authoritative", async () => {
  const empty = await runAttendanceShadowRead({
    enabled: true,
    explicitTestMode: true,
    params: {},
    gasReader: async () => gasResponse,
    firestoreReader: async () => []
  });
  assert.equal(empty.diagnostic.code, "empty_firestore_result");

  const partial = await runAttendanceShadowRead({
    enabled: true,
    explicitTestMode: true,
    params: {},
    gasReader: async () => gasResponse,
    firestoreReader: async () => firestoreRecords.slice(0, -1)
  });
  assert.equal(partial.diagnostic.code, "partial_or_mismatched_result");

  const malformed = await runAttendanceShadowRead({
    enabled: true,
    explicitTestMode: true,
    params: {},
    gasReader: async () => gasResponse,
    firestoreReader: async () => [{ studentName: "UID 없음" }]
  });
  assert.equal(malformed.diagnostic.code, "malformed_firestore_result");
  assert.equal(malformed.response, gasResponse);
});
