import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ULIM_FUNCTION_REGION } from "../src/common/firebaseRegion.js";

const EXPECTED_REGION = "asia-northeast3";

test("Firebase Functions use the Seoul region constant", () => {
  assert.equal(ULIM_FUNCTION_REGION, EXPECTED_REGION);

  const files = [
    "src/auth/exchangeLegacySessionCallable.ts",
    "src/source/ingestLegacyGasSnapshot.ts",
    "src/scheduled/autoAbsent.ts"
  ];

  for (const relativePath of files) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    assert.match(source, /region:\s*ULIM_FUNCTION_REGION/);
  }
});

const LEGACY_DEFAULT_REGION = ["us", "central1"].join("-");

test("Functions Emulator transport tests do not hard-code the legacy default region", () => {
  for (const relativePath of [
    "test/callable-transport-smoke.mjs",
    "test/source-emulator.integration.ts"
  ]) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    assert.equal(source.includes(LEGACY_DEFAULT_REGION), false);
    assert.equal(source.includes("ULIM_FUNCTION_REGION"), true);
  }
});
