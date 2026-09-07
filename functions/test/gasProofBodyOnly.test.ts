import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface GasProofHarness {
  doPost(e: Record<string, unknown>): unknown;
  issuerCalls(): number;
}

function loadGasProofHarness(): GasProofHarness {
  const gasPath = join(process.cwd(), "..", "\uc6b8\ub9bc_\ud559\uc0dd\ubd80_GAS_6_20_Firebase\uc778\uc99d\ube0c\ub9ac\uc9c0_\uae30\ub2a5\ube44\ud65c\uc131_\uac80\uc218\ubcf8.txt");
  const source = readFileSync(gasPath, "utf8");
  const declarations = [
    "doPost",
    "parseFirebaseProofPostBody620_",
    "isFirebaseProofPostAttempt620_",
    "getSingleFirebaseProofSessionToken620_",
    "cleanFirebaseProofToken620_"
  ].map((name) => extractFunctionDeclaration(source, name)).join("\n");

  return Function(`
    let calls = 0;
    let adminReliableWriteCalls = 0;
    function issueFirebaseLoginProof620_(params, e) {
      calls += 1;
      return { status: "issued", params: params, e: e || null };
    }
    function handleAdminReliableWritePost614_(params) {
      adminReliableWriteCalls += 1;
      return { status: "adminReliableWrite", params: params };
    }
    function isVocalTrainingUploadAction_() { return false; }
    function jsonOutput_(obj) { return obj; }
    ${declarations}
    return {
      doPost,
      issuerCalls: function () { return calls; },
      adminReliableWriteCalls: function () { return adminReliableWriteCalls; }
    };
  `)() as GasProofHarness;
}

function readGasSource(): string {
  return readFileSync(join(process.cwd(), "..", "\uc6b8\ub9bc_\ud559\uc0dd\ubd80_GAS_6_20_Firebase\uc778\uc99d\ube0c\ub9ac\uc9c0_\uae30\ub2a5\ube44\ud65c\uc131_\uac80\uc218\ubcf8.txt"), "utf8");
}

function extractFunctionDeclaration(source: string, name: string): string {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`Missing GAS function ${name}`);
  let depth = 0;
  let seenBody = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
      seenBody = true;
    } else if (char === "}") {
      depth -= 1;
      if (seenBody && depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not parse GAS function ${name}`);
}

function proofBody(body: Record<string, unknown>) {
  return {
    parameter: {},
    postData: { contents: JSON.stringify(body) }
  };
}

test("GAS 6.20 doGet has no Firebase proof route", () => {
  const doGet = extractFunctionDeclaration(readGasSource(), "doGet");
  assert.equal(doGet.includes("issueFirebaseLoginProof"), false);
});

test("GAS 6.20 proof issuer rejects query-only and malformed POST attempts", () => {
  const harness = loadGasProofHarness();
  const attempts = [
    { parameter: { action: "issueFirebaseLoginProof", studentSessionToken: "query-token" } },
    { parameter: { action: "issueFirebaseLoginProof", adminToken: "query-admin" }, postData: { contents: "" } },
    { parameter: { action: "issueFirebaseLoginProof", studentSessionToken: "query-token" }, postData: { contents: "{not-json" } },
    { parameter: { action: "issueFirebaseLoginProof", sessionToken: "form-token" }, postData: undefined }
  ];

  for (const attempt of attempts) {
    const result = harness.doPost(attempt) as { status: string };
    assert.equal(result.status, "error");
  }
  assert.equal(harness.issuerCalls(), 0);
});

test("GAS 6.20 proof issuer accepts only valid JSON body tokens", () => {
  const harness = loadGasProofHarness();
  const studentResult = harness.doPost({
    parameter: { studentSessionToken: "query-token-must-not-merge" },
    postData: { contents: JSON.stringify({ action: "issueFirebaseLoginProof", studentSessionToken: " body-student " }) }
  }) as { status: string; params: { studentSessionToken: string; adminToken?: string } };
  const adminResult = harness.doPost(proofBody({ action: "issueFirebaseLoginProof", adminToken: "admin-token" })) as { status: string };

  assert.equal(studentResult.status, "issued");
  assert.equal(studentResult.params.studentSessionToken, " body-student ");
  assert.equal(studentResult.params.adminToken, undefined);
  assert.equal(adminResult.status, "issued");
  assert.equal(harness.issuerCalls(), 2);
});

test("GAS 6.20 ordinary action body containing proof text routes to original handler", () => {
  const harness = loadGasProofHarness() as GasProofHarness & { adminReliableWriteCalls(): number };
  const result = harness.doPost(proofBody({
    action: "adminReliableWrite",
    message: "issueFirebaseLoginProof"
  })) as { status: string; params: { message: string } };

  assert.equal(result.status, "adminReliableWrite");
  assert.equal(result.params.message, "issueFirebaseLoginProof");
  assert.equal(harness.issuerCalls(), 0);
  assert.equal(harness.adminReliableWriteCalls(), 1);
});

test("GAS 6.20 proof issuer rejects mixed, unknown, blank, and oversized body tokens", () => {
  const harness = loadGasProofHarness();
  for (const body of [
    { action: "issueFirebaseLoginProof", studentSessionToken: "s", sessionToken: "alias" },
    { action: "issueFirebaseLoginProof", studentSessionToken: "s", adminToken: "a" },
    { action: "issueFirebaseLoginProof", unknown: "x", studentSessionToken: "s" },
    { action: "issueFirebaseLoginProof", studentSessionToken: "   " },
    { action: "issueFirebaseLoginProof", adminToken: "x".repeat(2049) },
    ["issueFirebaseLoginProof"]
  ]) {
    const result = harness.doPost({
      parameter: {},
      postData: { contents: JSON.stringify(body) }
    }) as { status: string };
    assert.equal(result.status, "error");
  }
  assert.equal(harness.issuerCalls(), 0);
});

test("GAS 6.20 proof issuer rejects prototype-looking keys as unknown own keys", () => {
  for (const key of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
    const harness = loadGasProofHarness();
    const result = harness.doPost({
      parameter: {},
      postData: {
        contents: `{"action":"issueFirebaseLoginProof","studentSessionToken":"student-token","${key}":"x"}`
      }
    }) as { status: string };

    assert.equal(result.status, "error", key);
    assert.equal(harness.issuerCalls(), 0, key);
  }
});
