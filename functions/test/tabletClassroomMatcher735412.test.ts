import test from "node:test";
import assert from "node:assert/strict";
import { resolveTabletClassroom735412 } from "../src/operational/tabletClassroomMatcher735412.js";

const baseAttendance = {
  className: "[박소연T] - 토요일 청소년 초급A 11:00 ~ 13:00",
  instructor: "박소연"
};

const records = [
  { recordId: "wrong-teacher", room: "2강의실", startHour: 11, endHour: 12, assignedInstructor: "김하은", className: "청소년 초급A" },
  { recordId: "correct-11", room: "4강의실", startHour: 11, endHour: 12, assignedInstructor: "박소연T", className: "청소년 초급A" },
  { recordId: "correct-12", room: "4강의실", startHour: 12, endHour: 13, assignedInstructor: "박소연", className: "청소년 초급A" },
  { recordId: "later", room: "5강의실", startHour: 14, endHour: 16, assignedInstructor: "박소연", className: "청소년 초급B" }
];

test("same date, teacher and time selects Firestore classroom", () => {
  const result = resolveTabletClassroom735412(baseAttendance, records);
  assert.equal(result?.roomName, "4강의실");
  assert.equal(result?.source, "firestoreClassroomUsage");
});

test("teacher T suffix and brackets are normalized", () => {
  const result = resolveTabletClassroom735412({ ...baseAttendance, instructor: "[ 박소연 T ]" }, records);
  assert.equal(result?.roomName, "4강의실");
});

test("same teacher but different time does not match", () => {
  const result = resolveTabletClassroom735412({ className: "[박소연T] - 토요일 청소년 초급B 14:00 ~ 16:00", instructor: "박소연" }, records);
  assert.equal(result?.roomName, "5강의실");
});

test("same time but different teacher does not match", () => {
  const result = resolveTabletClassroom735412({ className: "[김하은T] - 토요일 청소년 초급A 11:00 ~ 13:00", instructor: "김하은" }, records);
  assert.equal(result?.roomName, "2강의실");
});

test("half-hour class matches containing hourly slot", () => {
  const result = resolveTabletClassroom735412({ className: "[김하은T] - 토요일 초등 더빙반 10:30 ~ 12:00", instructor: "김하은" }, [
    { recordId: "a", room: "3강의실", startHour: 10, endHour: 11, assignedInstructor: "김하은" },
    { recordId: "b", room: "3강의실", startHour: 11, endHour: 12, assignedInstructor: "김하은" }
  ]);
  assert.equal(result?.roomName, "3강의실");
});

test("multiple overlapping room candidates return null instead of scoring a guess", () => {
  const result = resolveTabletClassroom735412(baseAttendance, [
    { recordId: "a", room: "2강의실", startHour: 11, endHour: 12, assignedInstructor: "박소연", className: "청소년 초급A" },
    { recordId: "b", room: "3강의실", startHour: 11, endHour: 12, assignedInstructor: "박소연", className: "청소년 초급A" }
  ]);
  assert.equal(result, null);
});

test("missing teacher or time refuses unsafe guessing", () => {
  assert.equal(resolveTabletClassroom735412({ className: "청소년 초급A" }, records), null);
  assert.equal(resolveTabletClassroom735412({ className: "[박소연T] - 청소년 초급A", instructor: "박소연" }, records), null);
});

test("fixed room value on class data is ignored", () => {
  const result = resolveTabletClassroom735412({ ...baseAttendance, roomName: "잘못된고정강의실" } as typeof baseAttendance & { roomName: string }, records);
  assert.equal(result?.roomName, "4강의실");
});
