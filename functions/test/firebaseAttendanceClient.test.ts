import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

async function loadClient(flags: Record<string, boolean>) {
  const url = pathToFileURL(join(process.cwd(), "..", "web", "firebase-client.js")).href;
  const module = await import(`${url}?v=${Date.now()}-${Math.random()}`) as {
    createFirebaseClient(flags: Record<string, boolean>): {
      attachRuntime(runtime: unknown): void;
      readAttendanceWithFallback(params: Record<string, unknown>, fallback: (params: Record<string, unknown>) => Promise<Record<string, unknown>>): Promise<Record<string, unknown>>;
    };
  };
  return module.createFirebaseClient(flags);
}

test("attendance flag false uses GAS without touching runtime", async () => {
  const client = await loadClient({ USE_FIRESTORE_AUTH: false, USE_FIRESTORE_ATTENDANCE_READ: false });
  let fallbackCalls = 0;
  const result = await client.readAttendanceWithFallback({ date: "2026-07-02" }, async () => {
    fallbackCalls += 1;
    return { status: "success", source: "gas", records: [{ studentUid: "gas" }] };
  });
  assert.equal(fallbackCalls, 1);
  assert.equal(result.source, "gas");
});

test("attendance flag true returns Firestore records when reader succeeds", async () => {
  const client = await loadClient({ USE_FIRESTORE_AUTH: true, USE_FIRESTORE_ATTENDANCE_READ: true });
  client.attachRuntime({ attendanceReader: { async getAttendanceSnapshot() { return [{ studentUid: "firestore" }]; } } });
  const result = await client.readAttendanceWithFallback({ date: "2026-07-02" }, async () => {
    throw new Error("fallback should not run");
  });
  assert.equal(result.source, "firestore");
  assert.equal((result.records as Array<Record<string, unknown>>)[0]?.studentUid, "firestore");
});

test("attendance reader failure falls back to GAS with a diagnostic reason", async () => {
  const client = await loadClient({ USE_FIRESTORE_AUTH: true, USE_FIRESTORE_ATTENDANCE_READ: true });
  client.attachRuntime({ attendanceReader: { async getAttendanceSnapshot() { throw new Error("mirror unavailable"); } } });
  const result = await client.readAttendanceWithFallback({}, async () => ({ status: "success", records: [{ studentUid: "gas" }] }));
  assert.equal(result.source, "gas");
  assert.equal(result.firestoreFallbackReason, "mirror unavailable");
});


test("shadow attendance route invokes the pilot and always preserves its GAS result", async () => {
  const globalRecord = globalThis as unknown as {
    ULIM_CREATE_ATTENDANCE_SHADOW_PILOT?: (options: Record<string, unknown>) => {
      readAttendanceShadowPilot(params: Record<string, unknown>, fallback: (params: Record<string, unknown>) => Promise<Record<string, unknown>>): Promise<Record<string, unknown>>;
    };
  };
  const previous = globalRecord.ULIM_CREATE_ATTENDANCE_SHADOW_PILOT;
  let pilotCalls = 0;
  let receivedRuntime: unknown = null;
  try {
    globalRecord.ULIM_CREATE_ATTENDANCE_SHADOW_PILOT = (options) => ({
      async readAttendanceShadowPilot(params, fallback) {
        pilotCalls += 1;
        const provider = options.runtimeProvider as (() => unknown) | undefined;
        receivedRuntime = provider ? provider() : null;
        const gas = await fallback(params);
        return gas;
      }
    });
    const client = await loadClient({
      USE_FIRESTORE_AUTH: true,
      USE_FIRESTORE_ATTENDANCE_READ: false,
      USE_FIRESTORE_ATTENDANCE_SHADOW: true,
      ATTENDANCE_SHADOW_EXPLICIT_TEST_MODE: true
    });
    const runtime = { attendanceReader: { async getAttendanceSnapshot() { return []; } } };
    client.attachRuntime(runtime);
    const gas = { status: "success", source: "gas", records: [{ studentUid: "gas-authoritative" }] };
    const result = await client.readAttendanceWithFallback(
      { date: "2026-07-06", className: "연기기초반" },
      async () => gas
    );
    assert.equal(result, gas);
    assert.equal(pilotCalls, 1);
    assert.equal(receivedRuntime, runtime);
  } finally {
    if (previous) globalRecord.ULIM_CREATE_ATTENDANCE_SHADOW_PILOT = previous;
    else delete globalRecord.ULIM_CREATE_ATTENDANCE_SHADOW_PILOT;
  }
});
