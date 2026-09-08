import assert from "node:assert/strict";
import test from "node:test";
import {
  classroomRecordsOverlap,
  expandClassroomRecordsToHourly,
  makeClassroomSlotKey,
  mergeAuthoritativeClassroomRecords,
  partitionClassroomCommit,
  type ClassroomRecordLike
} from "../src/realtime/classroomFirestoreFirstCore.js";

function record(
  recordId: string,
  room: string,
  startHour: number,
  endHour: number,
  extra: Partial<ClassroomRecordLike> = {}
): ClassroomRecordLike {
  return {
    recordId, date: "2026-08-03", room, startHour, endHour,
    status: "사용중", ...extra
  };
}

test("same room overlapping hours conflict", () => {
  assert.equal(classroomRecordsOverlap(
    record("a", "2강의실", 10, 12),
    record("b", "2 강의실", 11, 13)
  ), true);
});

test("grouped record expands into independent hourly slots", () => {
  const expanded = expandClassroomRecordsToHourly([
    record("GRID|A|10|11|3", "신체훈련실", 11, 13)
  ]);
  assert.deepEqual(expanded.map(item => [item.startHour, item.endHour]), [[11, 12], [12, 13]]);
  assert.notEqual(expanded[0].recordId, expanded[1].recordId);
  assert.equal(expanded[0].slotKey, makeClassroomSlotKey("2026-08-03", "신체훈련실", 11));
});

test("partial conflict accepts the free hour", () => {
  const requested = expandClassroomRecordsToHourly([
    record("request", "2강의실", 11, 13, { source: "firestore_primary_728" })
  ]);
  const result = partitionClassroomCommit(
    [record("existing", "2강의실", 11, 12)],
    requested
  );
  assert.deepEqual(result.conflicts.map(item => item.requested.startHour), [11]);
  assert.deepEqual(result.accepted.map(item => item.startHour), [12]);
});

test("stale sheet snapshot cannot delete Firestore-primary slot", () => {
  const merged = mergeAuthoritativeClassroomRecords(
    [],
    [record("fs:a", "3강의실", 12, 13, {
      source: "firestore_primary_728_sheet_synced",
      syncState: "sheet_synced"
    })]
  );
  assert.deepEqual(merged.map(item => item.recordId), ["fs:a"]);
});

test("release tombstone blocks delayed sheet snapshot", () => {
  const slotKey = makeClassroomSlotKey("2026-08-03", "4강의실", 15);
  const merged = mergeAuthoritativeClassroomRecords(
    [record("sheet", "4강의실", 15, 16)],
    [],
    { tombstoneSlotKeys: [slotKey] }
  );
  assert.equal(merged.length, 0);
});

test("sheet-only records still follow authoritative snapshot", () => {
  const merged = mergeAuthoritativeClassroomRecords(
    [record("sheet-new", "녹음실", 16, 17)],
    [record("sheet-old", "녹음실", 15, 16, { source: "sheet_authoritative_727" })]
  );
  assert.deepEqual(merged.map(item => item.recordId), ["sheet-new"]);
});
