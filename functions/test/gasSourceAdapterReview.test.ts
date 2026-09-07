import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { createHash, createHmac } from "node:crypto";
import { canonicalJson } from "../src/source/canonicalJson.js";
import { buildDirectoryClassId } from "../src/directory/identityDirectory.js";

const baselinePath = resolve(process.cwd(), "../baselines/current/gas_7_02_운영기준.txt");
const reviewPath = resolve(process.cwd(), "../review/gas_7_02_Phase2_1_SourceAdapter_검수본.txt");
const baseline = readFileSync(baselinePath);
const review = readFileSync(reviewPath);
const marker = Buffer.from("/****************************************************\r\n * 7.02 Phase 2.1 Firebase 단방향 원본 전달 검수본", "utf8");
const markerOffset = review.indexOf(marker);

function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function not found: ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated function: ${name}`);
}

test("review GAS preserves the current operating baseline byte-for-byte and only appends Phase 2.1", () => {
  assert.ok(markerOffset >= baseline.length);
  assert.deepEqual(review.subarray(0, baseline.length), baseline);
  assert.equal(review.subarray(baseline.length, markerOffset).toString("utf8").trim(), "");
});

test("review adapter has no trigger/router injection, hard-coded endpoint, or embedded source secret", () => {
  const appended = review.subarray(markerOffset).toString("utf8");
  assert.doesNotMatch(appended, /ScriptApp\.newTrigger/);
  assert.doesNotMatch(appended, /function\s+do(?:Get|Post)\s*\(/);
  assert.doesNotMatch(appended, /['"]https:\/\/[^'"]+['"]/);
  assert.match(appended, /getProperty\('FIREBASE_SOURCE_ENDPOINT'\)/);
  assert.match(appended, /getProperty\('FIREBASE_SOURCE_HMAC_SECRET'\)/);
  assert.match(appended, /getProperty\('FIREBASE_SOURCE_COMMIT_ENABLED'\)/);
  assert.match(appended, /function firebaseSourceDryRun621\(/);
  assert.match(appended, /active: \(existingAssignment621 && existingAssignment621\.active === true\) \|\| active/);
});

test("GAS canonical JSON, SHA-256, HMAC, and class IDs match the server implementation", () => {
  const source = review.subarray(markerOffset).toString("utf8");
  const names = [
    "firebaseSourceCanonicalJson621_",
    "firebaseSourceSha256Hex621_",
    "firebaseSourceHmacBase64Url621_",
    "firebaseSourceBytesToHex621_",
    "firebaseSourceClassId621_"
  ];
  const sandbox = {
    Utilities: {
      DigestAlgorithm: { SHA_256: "SHA_256" },
      Charset: { UTF_8: "UTF_8" },
      computeDigest(_algorithm: string, text: string) {
        return [...createHash("sha256").update(text, "utf8").digest()];
      },
      computeHmacSha256Signature(text: string, secret: string) {
        return [...createHmac("sha256", secret).update(text, "utf8").digest()];
      },
      base64EncodeWebSafe(bytes: number[]) {
        return Buffer.from(bytes).toString("base64url");
      }
    },
    isFinite
  };
  vm.runInNewContext(names.map((name) => extractFunction(source, name)).join("\n"), sandbox);
  const functions = sandbox as unknown as {
    firebaseSourceCanonicalJson621_: (value: unknown) => string;
    firebaseSourceSha256Hex621_: (value: string) => string;
    firebaseSourceHmacBase64Url621_: (value: string, secret: string) => string;
    firebaseSourceClassId621_: (className: string, instructorUids: string[]) => string;
  };

  const value = { z: [3, { b: true, a: "한글" }], a: 1 };
  const expectedCanonical = canonicalJson(value);
  assert.equal(functions.firebaseSourceCanonicalJson621_(value), expectedCanonical);
  assert.equal(functions.firebaseSourceSha256Hex621_(expectedCanonical), createHash("sha256").update(expectedCanonical).digest("hex"));
  assert.equal(
    functions.firebaseSourceHmacBase64Url621_(expectedCanonical, "review-secret"),
    createHmac("sha256", "review-secret").update(expectedCanonical).digest("base64url")
  );
  assert.equal(
    functions.firebaseSourceClassId621_(" 목요일  연기기초 ", ["T2", "T1"]),
    buildDirectoryClassId({ className: " 목요일  연기기초 ", instructorUids: ["T2", "T1"] })
  );
});

test("GAS snapshot aggregation keeps a class and teacher assignment active when any member is active", () => {
  const source = review.subarray(markerOffset).toString("utf8");
  const sandbox = {
    firebaseSourceReadStudentAuth621_: () => [
      { uid: "S1", studentNo: "1001", studentName: "재원생", active: true, sessionVersion: 1 },
      { uid: "S2", studentNo: "1002", studentName: "퇴원생", active: true, sessionVersion: 1 }
    ],
    firebaseSourceReadAdminAuth621_: () => [
      { uid: "T1", id: "teacher1", name: "강사1", role: "강사", active: true, sessionVersion: 1 }
    ],
    getStudentsForAdmin_: () => [
      { rowNumber: 2, studentUid: "S1", studentNo: "1001", studentName: "재원생", studentIdentityKey: "UID|S1", enrollmentStatus: "재원", currentClass: "목요일 연기", instructor: "강사1" },
      { rowNumber: 3, studentUid: "S2", studentNo: "1002", studentName: "퇴원생", studentIdentityKey: "UID|S2", enrollmentStatus: "퇴원", currentClass: "목요일 연기", instructor: "강사1" }
    ],
    firebaseSourceMapAdminRole621_: () => "teacher",
    firebaseSourceCleanObject621_: (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)),
    normalizeAdminTeacherKey_: (value: unknown) => String(value || "").replace(/\s+/g, ""),
    normalizeName: (value: unknown) => String(value || "").replace(/\s+/g, ""),
    firebaseSourceEnrollmentStatus621_: (value: unknown) => String(value) === "퇴원" ? "withdrawn" : "active",
    firebaseSourceSplitClasses621_: (value: unknown) => [String(value)],
    splitTeacherKeys604_: (value: unknown) => [String(value).replace(/\s+/g, "")],
    firebaseSourceClassId621_: () => "class-one",
    firebaseSourceSortBy621_: (rows: unknown[]) => rows.slice(),
    Date
  };
  vm.runInNewContext(extractFunction(source, "firebaseSourceBuildIdentityDirectorySnapshot621_"), sandbox);
  const snapshot = (sandbox as unknown as { firebaseSourceBuildIdentityDirectorySnapshot621_: () => {
    classes: Array<{ active: boolean }>;
    teacherAssignments: Array<{ active: boolean }>;
  } }).firebaseSourceBuildIdentityDirectorySnapshot621_();
  assert.equal(snapshot.classes[0]?.active, true);
  assert.equal(snapshot.teacherAssignments[0]?.active, true);
});
