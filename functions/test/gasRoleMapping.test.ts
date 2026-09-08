import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type FirebaseProofRole = "teacher" | "admin" | "superAdmin";

interface GasRoleMappingFns {
  mapFirebaseProofAdminRole620_(admin: { role?: string }): FirebaseProofRole;
}

function loadGasRoleMapping(): GasRoleMappingFns {
  const gasPath = join(process.cwd(), "..", "\uc6b8\ub9bc_\ud559\uc0dd\ubd80_GAS_6_20_Firebase\uc778\uc99d\ube0c\ub9ac\uc9c0_\uae30\ub2a5\ube44\ud65c\uc131_\uac80\uc218\ubcf8.txt");
  const source = readFileSync(gasPath, "utf8");
  const functionNames = [
    "normalizeFirebaseProofRoleText620_",
    "isFirebaseProofSuperAdminRole620_",
    "mapFirebaseProofAdminRole620_"
  ];
  const declarations = functionNames.map((name) => extractFunctionDeclaration(source, name)).join("\n");
  return Function(`${declarations}\nreturn { mapFirebaseProofAdminRole620_ };`)() as GasRoleMappingFns;
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

test("GAS Firebase proof role mapping is bound to actual GAS 6.20 source", () => {
  const { mapFirebaseProofAdminRole620_ } = loadGasRoleMapping();
  const cases: Array<[string, FirebaseProofRole]> = [
    ["\uc804\uccb4\uad00\ub9ac", "superAdmin"],
    ["\uc804\uccb4\uad00\ub9ac\uc790", "superAdmin"],
    ["\uad00\ub9ac\uc790", "admin"],
    ["\ubd80\ubd84\uad00\ub9ac", "admin"],
    ["\uc6d0\uc7a5", "admin"],
    ["admin", "admin"],
    ["fullAdmin", "superAdmin"],
    ["superAdmin", "superAdmin"],
    ["\uac15\uc0ac", "teacher"],
    ["teacher", "teacher"],
    ["unknown-role", "admin"]
  ];

  for (const [role, expected] of cases) {
    assert.equal(mapFirebaseProofAdminRole620_({ role }), expected, role);
  }
});
