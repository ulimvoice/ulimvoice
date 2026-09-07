import test from "node:test";
import assert from "node:assert/strict";
import {
  ATTENDANCE_SHADOW_PILOT,
  ATTENDANCE_SHADOW_PILOTS,
  isAttendanceShadowPilotClass,
  isAttendanceShadowPilotDate,
  isAttendanceShadowPilotInstructor,
  resolveAttendanceShadowPilotScope,
  runAttendanceShadowPilot,
  validateAttendanceShadowPilotRecords,
  validateAttendanceShadowPilotRequest
} from "../src/mirror/attendanceShadowPilot.js";
import type { LegacyAttendanceRecord } from "../src/mirror/attendanceMirror.js";

function record(overrides: Partial<LegacyAttendanceRecord> = {}): LegacyAttendanceRecord {
  return {
    date: "2026-07-06",
    sessionDate: "2026-07-06",
    sessionId: "session-1",
    classId: "acting-basic-mon",
    className: "연기기초반",
    instructor: "이용우T",
    teacherName: "이용우",
    studentUid: "STU-1",
    studentIdentityKey: "uid:STU-1",
    studentName: "학생1",
    status: "출석",
    attendanceStatus: "출석",
    sourceKey: "sheet:1",
    ...overrides
  };
}

const params = { date: "2026-07-06", className: "연기기초반" };
const gasResponse = { status: "success", records: [record()], marker: "gas" };

test("pilot scope is exactly July 2026 Mondays for Lee Yongwoo acting-basic class", () => {
  assert.deepEqual(ATTENDANCE_SHADOW_PILOT.sessionDates, [
    "2026-07-06",
    "2026-07-13",
    "2026-07-20",
    "2026-07-27"
  ]);
  for (const date of ATTENDANCE_SHADOW_PILOT.sessionDates) assert.equal(isAttendanceShadowPilotDate(date), true);
  assert.equal(isAttendanceShadowPilotDate("2026-07-07"), false);
  assert.equal(isAttendanceShadowPilotDate("2026-08-03"), false);
  assert.equal(isAttendanceShadowPilotClass("연기기초반"), true);
  assert.equal(isAttendanceShadowPilotClass("월요일 연기기초반"), true);
  assert.equal(isAttendanceShadowPilotClass("성우기초반"), false);
  assert.equal(isAttendanceShadowPilotInstructor("이용우T"), true);
  assert.equal(isAttendanceShadowPilotInstructor("이용우 선생님"), true);
  assert.equal(isAttendanceShadowPilotInstructor("다른강사"), false);
});

test("request validation fails closed outside exact date and class allowlist", () => {
  assert.deepEqual(validateAttendanceShadowPilotRequest(params), []);
  assert.ok(validateAttendanceShadowPilotRequest({ date: "2026-07-07", className: "연기기초반" }).length > 0);
  assert.ok(validateAttendanceShadowPilotRequest({ date: "2026-07-06", className: "성우기초반" }).length > 0);
  assert.ok(validateAttendanceShadowPilotRequest({ date: "2026-07-06" }).length > 0);
});

test("record validation rejects cross-class, cross-teacher, and cross-date data", () => {
  assert.deepEqual(validateAttendanceShadowPilotRecords([record()], "2026-07-06"), []);
  assert.ok(validateAttendanceShadowPilotRecords([record({ className: "성우기초반" })], "2026-07-06").length > 0);
  assert.ok(validateAttendanceShadowPilotRecords([record({ instructor: "다른강사", teacherName: "다른강사" })], "2026-07-06").length > 0);
  assert.ok(validateAttendanceShadowPilotRecords([record({ date: "2026-07-13", sessionDate: "2026-07-13" })], "2026-07-06").length > 0);
});

test("outside pilot request never queries Firestore and always returns GAS", async () => {
  let firestoreCalls = 0;
  const result = await runAttendanceShadowPilot({
    enabled: true,
    explicitTestMode: true,
    params: { date: "2026-07-07", className: "연기기초반" },
    gasReader: async () => gasResponse,
    firestoreReader: async () => { firestoreCalls += 1; return [record()]; }
  });
  assert.equal(result.response, gasResponse);
  assert.equal(result.diagnostic.code, "pilot_request_outside_scope");
  assert.equal(firestoreCalls, 0);
});

test("GAS scope mismatch blocks Firestore before any query", async () => {
  let firestoreCalls = 0;
  const unsafeGas = { ...gasResponse, records: [record({ instructor: "다른강사", teacherName: "다른강사" })] };
  const result = await runAttendanceShadowPilot({
    enabled: true,
    explicitTestMode: true,
    params,
    gasReader: async () => unsafeGas,
    firestoreReader: async () => { firestoreCalls += 1; return [record()]; }
  });
  assert.equal(result.response, unsafeGas);
  assert.equal(result.diagnostic.code, "gas_scope_mismatch");
  assert.equal(firestoreCalls, 0);
});

test("matching pilot records compare successfully while GAS remains authoritative", async () => {
  const result = await runAttendanceShadowPilot({
    enabled: true,
    explicitTestMode: true,
    params,
    gasReader: async () => gasResponse,
    firestoreReader: async () => [record()]
  });
  assert.equal(result.response, gasResponse);
  assert.equal(result.diagnostic.code, "match");
  assert.equal(result.diagnostic.parity?.parityPass, true);
  assert.equal(result.diagnostic.pilotId, ATTENDANCE_SHADOW_PILOT.id);
});

test("Firestore records crossing pilot boundary are rejected and GAS stays authoritative", async () => {
  const result = await runAttendanceShadowPilot({
    enabled: true,
    explicitTestMode: true,
    params,
    gasReader: async () => gasResponse,
    firestoreReader: async () => [record({ className: "성우기초반" })]
  });
  assert.equal(result.response, gasResponse);
  assert.equal(result.diagnostic.code, "firestore_scope_mismatch");
  assert.ok((result.diagnostic.scopeViolations || []).length > 0);
});


test("second pilot scope is exactly July 2026 Sundays for youth intermediate C", () => {
  const scope = resolveAttendanceShadowPilotScope({
    date: "2026-07-05",
    className: "청소년 중급C"
  });
  assert.equal(scope?.id, "lee-yongwoo-2026-07-sunday-youth-intermediate-c");
  assert.deepEqual(scope?.sessionDates, [
    "2026-07-05",
    "2026-07-12",
    "2026-07-19",
    "2026-07-26"
  ]);
  assert.equal(ATTENDANCE_SHADOW_PILOTS.length, 4);
  assert.deepEqual(validateAttendanceShadowPilotRequest({
    date: "2026-07-12",
    className: "[이용우T] - 일요일 청소년 중급C 13:00 ~ 15:00"
  }), []);
});

test("date and class are validated as an exact pair, never as independent unions", () => {
  assert.ok(validateAttendanceShadowPilotRequest({
    date: "2026-07-05",
    className: "연기기초반"
  }).length > 0);
  assert.ok(validateAttendanceShadowPilotRequest({
    date: "2026-07-06",
    className: "청소년 중급C"
  }).length > 0);
});

test("second scope records pass while cross-scope records fail closed", () => {
  const sunday = record({
    date: "2026-07-05",
    sessionDate: "2026-07-05",
    classId: "youth-intermediate-c-sun",
    className: "청소년 중급C",
    startTime: "13:00",
    endTime: "15:00"
  });
  assert.deepEqual(
    validateAttendanceShadowPilotRecords([sunday], "2026-07-05", "청소년 중급C"),
    []
  );
  assert.ok(
    validateAttendanceShadowPilotRecords([sunday], "2026-07-05", "연기기초반").length > 0
  );
});


test("third pilot scope is exactly July 2026 Thursdays for Choi Hyunsik acting-basic", () => {
  const scope = resolveAttendanceShadowPilotScope({
    date: "2026-07-09",
    className: "[최현식T] - 목요일 연기기초 19:00 ~ 22:00"
  });
  assert.equal(scope?.id, "choi-hyunsik-2026-07-thursday-acting-basic");
  assert.deepEqual(scope?.sessionDates, [
    "2026-07-09",
    "2026-07-16",
    "2026-07-23",
    "2026-07-30"
  ]);
  assert.equal(scope?.instructor, "최현식T");
  assert.equal(ATTENDANCE_SHADOW_PILOTS.length, 4);
  assert.deepEqual(validateAttendanceShadowPilotRequest({
    date: "2026-07-16",
    className: "목요일 연기기초"
  }), []);
});

test("third scope records pass and other instructor or date pairs fail closed", () => {
  const thursday = record({
    date: "2026-07-09",
    sessionDate: "2026-07-09",
    classId: "choi-acting-basic-thu",
    className: "[최현식T] - 목요일 연기기초 19:00 ~ 22:00",
    instructor: "최현식T",
    teacherName: "최현식",
    startTime: "19:00",
    endTime: "22:00"
  });

  assert.deepEqual(
    validateAttendanceShadowPilotRecords(
      [thursday],
      "2026-07-09",
      "[최현식T] - 목요일 연기기초 19:00 ~ 22:00"
    ),
    []
  );

  assert.ok(validateAttendanceShadowPilotRequest({
    date: "2026-07-09",
    className: "청소년 중급C"
  }).length > 0);

  assert.ok(validateAttendanceShadowPilotRequest({
    date: "2026-07-05",
    className: "[최현식T] - 목요일 연기기초 19:00 ~ 22:00"
  }).length > 0);

  assert.ok(validateAttendanceShadowPilotRecords(
    [thursday],
    "2026-07-09",
    "청소년 중급C"
  ).length > 0);

  assert.ok(validateAttendanceShadowPilotRecords(
    [{ ...thursday, instructor: "이용우T", teacherName: "이용우" }],
    "2026-07-09",
    "목요일 연기기초"
  ).length > 0);
});


test("fourth pilot scope is exactly July 2026 Thursdays for Kim Cheolsu acting-basic", () => {
  const scope = resolveAttendanceShadowPilotScope({
    date: "2026-07-09",
    className: "[김철수T] - 목요일 연기기초 19:00 ~ 22:00"
  });
  assert.equal(scope?.id, "kim-cheolsu-2026-07-thursday-acting-basic");
  assert.deepEqual(scope?.sessionDates, [
    "2026-07-09",
    "2026-07-16",
    "2026-07-23",
    "2026-07-30"
  ]);
  assert.equal(scope?.instructor, "김철수T");
  assert.equal(ATTENDANCE_SHADOW_PILOTS.length, 4);
  assert.deepEqual(validateAttendanceShadowPilotRequest({
    date: "2026-07-23",
    className: "[김철수T] - 목요일 연기기초 19:00 ~ 22:00"
  }), []);
});

test("fourth pilot rejects cross-paired dates and other instructor rows", () => {
  const thursday = record({
    date: "2026-07-09",
    sessionDate: "2026-07-09",
    classId: "kim-acting-basic-thu",
    className: "[김철수T] - 목요일 연기기초 19:00 ~ 22:00",
    instructor: "김철수T",
    teacherName: "김철수",
    startTime: "19:00",
    endTime: "22:00"
  });

  assert.deepEqual(validateAttendanceShadowPilotRecords([thursday], "2026-07-09", "[김철수T] - 목요일 연기기초 19:00 ~ 22:00"), []);
  assert.ok(validateAttendanceShadowPilotRequest({ date: "2026-07-09", className: "청소년 중급C" }).length > 0);
  assert.ok(validateAttendanceShadowPilotRequest({ date: "2026-07-05", className: "[김철수T] - 목요일 연기기초 19:00 ~ 22:00" }).length > 0);
  assert.ok(validateAttendanceShadowPilotRecords([{ ...thursday, instructor: "최현식T", teacherName: "최현식" }], "2026-07-09", "[김철수T] - 목요일 연기기초 19:00 ~ 22:00").length > 0);
});
