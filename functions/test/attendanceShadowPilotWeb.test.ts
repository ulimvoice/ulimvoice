import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

async function loadPilotModule() {
  const url = pathToFileURL(join(process.cwd(), "..", "web", "attendance-shadow-pilot.js")).href;
  return await import(`${url}?v=${Date.now()}-${Math.random()}`) as {
    PILOT: { sessionDates: string[] };
    validateRequest(params: Record<string, unknown>): string[];
    validateRecords(records: Array<Record<string, unknown>>, expectedDate: string): string[];
    compare(gas: Array<Record<string, unknown>>, firestore: Array<Record<string, unknown>>): Record<string, unknown>;
    createAttendanceShadowPilot(options: Record<string, unknown>): {
      readAttendanceShadowPilot(params: Record<string, unknown>, gasReader: (params: Record<string, unknown>) => Promise<Record<string, unknown>>): Promise<Record<string, unknown>>;
    };
  };
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-07-06",
    sessionDate: "2026-07-06",
    className: "연기기초반",
    instructor: "이용우T",
    studentUid: "STU-1",
    studentIdentityKey: "uid:STU-1",
    studentName: "학생1",
    status: "출석",
    attendanceStatus: "출석",
    sourceKey: "이용우T 7월|C10",
    classroom: "2강의실",
    startTime: "19:00",
    endTime: "22:00",
    ...overrides
  };
}

test("browser pilot allowlist is fixed to the four July Mondays", async () => {
  const pilot = await loadPilotModule();
  assert.deepEqual(pilot.PILOT.sessionDates, ["2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27"]);
  assert.deepEqual(pilot.validateRequest({ date: "2026-07-06", className: "연기기초반" }), []);
  assert.ok(pilot.validateRequest({ date: "2026-07-07", className: "연기기초반" }).length > 0);
  assert.ok(pilot.validateRecords([record({ instructor: "다른강사" })], "2026-07-06").length > 0);
});

test("browser pilot parity compares operational fields without exposing names", async () => {
  const pilot = await loadPilotModule();
  const matching = pilot.compare([record()], [record()]);
  assert.equal(matching.pass, true);
  const mismatch = pilot.compare([record()], [record({ status: "결석", attendanceStatus: "결석" })]);
  assert.equal(mismatch.pass, false);
  assert.deepEqual(mismatch.mismatchFields, ["status"]);
  assert.equal(JSON.stringify(mismatch).includes("학생1"), false);
});

test("browser shadow pilot always returns GAS and records a matching diagnostic", async () => {
  const module = await loadPilotModule();
  const gas = { status: "success", source: "gas", records: [record()], marker: "authoritative" };
  const runtime = {
    auth: { currentUser: { uid: "teacher" } },
    bridge: { async exchangeLegacySession() { throw new Error("should not exchange"); } },
    attendanceReader: { async getAttendanceSnapshot() { return [record()]; } }
  };
  const pilot = module.createAttendanceShadowPilot({
    flags: { USE_FIRESTORE_ATTENDANCE_SHADOW: true, ATTENDANCE_SHADOW_EXPLICIT_TEST_MODE: true },
    runtimeProvider: () => runtime
  });
  const result = await pilot.readAttendanceShadowPilot(
    { date: "2026-07-06", className: "연기기초반" },
    async () => gas
  );
  assert.equal(result, gas);
  const diagnostic = (globalThis as unknown as { ULIM_ATTENDANCE_SHADOW_PILOT_LAST_RESULT: Record<string, unknown> }).ULIM_ATTENDANCE_SHADOW_PILOT_LAST_RESULT;
  assert.equal(diagnostic.code, "match");
  assert.equal(diagnostic.gasAuthoritative, true);
});

test("browser shadow pilot blocks Firestore outside allowlist", async () => {
  const module = await loadPilotModule();
  let firestoreCalls = 0;
  const gas = { status: "success", source: "gas", records: [record({ date: "2026-07-07", sessionDate: "2026-07-07" })] };
  const pilot = module.createAttendanceShadowPilot({
    flags: { USE_FIRESTORE_ATTENDANCE_SHADOW: true, ATTENDANCE_SHADOW_EXPLICIT_TEST_MODE: true },
    runtimeProvider: () => ({ attendanceReader: { async getAttendanceSnapshot() { firestoreCalls += 1; return []; } } })
  });
  const result = await pilot.readAttendanceShadowPilot(
    { date: "2026-07-07", className: "연기기초반" },
    async () => gas
  );
  assert.equal(result, gas);
  assert.equal(firestoreCalls, 0);
});


test("browser pilot exposes a page-level override contract before first script load", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    join(process.cwd(), "..", "web", "attendance-shadow-pilot.js"),
    "utf8"
  );
  assert.equal(source.includes("ULIM_ATTENDANCE_SHADOW_PILOT_OVERRIDE"), true);
  assert.equal(source.includes("override.sessionDates || DEFAULT_PILOT.sessionDates"), true);
  assert.equal(source.includes("override.classAliases || DEFAULT_PILOT.classAliases"), true);
});


test("third pilot page declares the Choi Hyunsik Thursday scope before the pilot script", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    join(process.cwd(), "..", "index_shadow_pilot_최현식T_2026-07_목요일_연기기초.html"),
    "utf8"
  );
  assert.equal(source.includes("choi-hyunsik-2026-07-thursday-acting-basic"), true);
  assert.equal(source.includes("2026-07-09"), true);
  assert.equal(source.includes("2026-07-30"), true);
  assert.equal(source.indexOf("ULIM_ATTENDANCE_SHADOW_PILOT_OVERRIDE") < source.indexOf("web/attendance-shadow-pilot.js"), true);
});


test("fourth pilot page declares the Kim Cheolsu Thursday scope before the pilot script", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(join(process.cwd(), "..", "index_shadow_pilot_김철수T_2026-07_목요일_연기기초.html"), "utf8");
  assert.equal(source.includes("kim-cheolsu-2026-07-thursday-acting-basic"), true);
  assert.equal(source.includes("2026-07-09"), true);
  assert.equal(source.includes("2026-07-30"), true);
  assert.equal(source.includes("보강"), true);
  assert.equal(source.includes("반이동"), true);
  assert.equal(source.indexOf("ULIM_ATTENDANCE_SHADOW_PILOT_OVERRIDE") < source.indexOf("web/attendance-shadow-pilot.js"), true);
});
