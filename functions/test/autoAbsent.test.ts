import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryIdempotencyStore } from "../src/common/idempotency.js";
import { buildAutoAbsentRequestId, planAutoAbsent, processAutoAbsentBatch, shouldAutoMarkAbsent } from "../src/scheduled/autoAbsent.js";

test("auto absent waits 60 minutes after class end", () => {
  const candidate = {
    sessionId: "sess1",
    sessionDate: "2026-06-25",
    classId: "class1",
    studentUid: "student1",
    status: "\uBBF8\uCCB4\uD06C",
    endedAt: "2026-06-25T10:00:00.000Z"
  };
  assert.equal(shouldAutoMarkAbsent(candidate, new Date("2026-06-25T10:59:59.000Z")), false);
  assert.equal(shouldAutoMarkAbsent(candidate, new Date("2026-06-25T11:00:00.000Z")), true);
});

test("auto absent excludes hold, withdrawn, canceled, makeup, first-class-before, and admin excluded cases", () => {
  const base = {
    sessionId: "sess1",
    sessionDate: "2026-06-25",
    classId: "class1",
    studentUid: "student1",
    status: "unchecked",
    endedAt: "2026-06-25T10:00:00.000Z"
  };
  const now = new Date("2026-06-25T12:00:00.000Z");
  assert.equal(shouldAutoMarkAbsent({ ...base, enrollmentStatus: "\uD734\uC6D0" }, now), false);
  assert.equal(shouldAutoMarkAbsent({ ...base, enrollmentStatus: "\uD1F4\uC6D0" }, now), false);
  assert.equal(shouldAutoMarkAbsent({ ...base, isCanceled: true }, now), false);
  assert.equal(shouldAutoMarkAbsent({ ...base, isMakeupPlanned: true }, now), false);
  assert.equal(shouldAutoMarkAbsent({ ...base, isBeforeFirstClass: true }, now), false);
  assert.equal(shouldAutoMarkAbsent({ ...base, adminExcluded: true }, now), false);
});

test("auto absent requestId includes date and prevents duplicate execution", async () => {
  const store = new InMemoryIdempotencyStore();
  const candidate = {
    sessionId: "sess1",
    sessionDate: "2026-06-25",
    classId: "class1",
    studentUid: "student1",
    status: "unchecked",
    endedAt: "2026-06-25T10:00:00.000Z"
  };
  const plan = await planAutoAbsent(store, candidate, new Date("2026-06-25T11:01:00.000Z"));
  assert.equal(plan?.requestId, buildAutoAbsentRequestId(candidate));
  assert.match(plan?.requestId || "", /2026-06-25/);
  await assert.rejects(() => planAutoAbsent(store, candidate, new Date("2026-06-25T11:02:00.000Z")));
});

test("auto absent batch continues after individual failures", async () => {
  const store = new InMemoryIdempotencyStore();
  const candidates = [
    {
      sessionId: "sess1",
      sessionDate: "2026-06-25",
      classId: "class1",
      studentUid: "student1",
      status: "unchecked",
      endedAt: "2026-06-25T10:00:00.000Z"
    },
    {
      sessionId: "sess2",
      sessionDate: "2026-06-25",
      classId: "class1",
      studentUid: "student2",
      status: "unchecked",
      endedAt: "2026-06-25T10:00:00.000Z"
    }
  ];
  const result = await processAutoAbsentBatch(
    {
      store,
      async listCandidates() {
        return candidates;
      },
      gas: {
        async request(request) {
          if (request.params.studentUid === "student2") return { ok: false, requestId: "r", message: "sheet failed" } as never;
          return { ok: true, requestId: "r", updatedRows: 1 } as never;
        }
      },
      async updateMirror() {}
    },
    new Date("2026-06-25T11:01:00.000Z")
  );
  assert.equal(result.planned.length, 1);
  assert.equal(result.failed.length, 1);
});
