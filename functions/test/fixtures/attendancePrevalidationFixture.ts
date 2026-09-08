import type { LegacyAttendanceRecord } from "../../src/mirror/attendanceMirror.js";

function row(
  suffix: string,
  status: string,
  overrides: Partial<LegacyAttendanceRecord> = {}
): LegacyAttendanceRecord {
  return {
    date: "2026-07-04",
    sessionDate: "2026-07-04",
    sessionId: `session-${suffix}`,
    studentName: `학생-${suffix}`,
    studentNo: `10${suffix.padStart(2, "0")}`,
    studentUid: `STU-${suffix}`,
    studentIdentityKey: `UID|STU-${suffix}`,
    studentRowNumber: 10 + Number.parseInt(suffix, 10),
    instructor: "이용우",
    teacherUid: "T-LEE",
    teacherName: "이용우",
    classId: "CLASS-A",
    className: "토요일 연기기초",
    classroom: "2강의실",
    startTime: "10:00",
    endTime: "12:00",
    status,
    attendanceStatus: status,
    enrollmentStatus: "재원",
    studentStatus: "재원",
    sourceSheet: "7월 출석부",
    sourceRow: 10 + Number.parseInt(suffix, 10),
    sourceCol: 4,
    sourceCell: `D${10 + Number.parseInt(suffix, 10)}`,
    sourceKey: `CLASS-A|${suffix}`,
    ...overrides
  };
}

export const attendanceParityFixture: LegacyAttendanceRecord[] = [
  row("1", "출석"),
  row("2", "결석"),
  row("3", "지각"),
  row("4", "미체크"),
  row("5", "휴원", { enrollmentStatus: "휴원", studentStatus: "휴원" }),
  row("6", "출석", { specialStatus: "보강완료" }),
  row("7", "미체크", { specialStatus: "신규" }),
  row("8", "출석", { specialStatus: "반이동" }),
  row("9", "출석", { studentName: "동명이인", studentNo: "1234" }),
  row("10", "결석", { studentName: "동명이인", studentNo: "1234" }),
  row("11", "출석", {
    sessionId: "session-second-class",
    classId: "CLASS-B",
    className: "토요일 성우기초",
    sourceKey: "CLASS-B|11"
  }),
  row("12", "출석", {
    studentUid: "STU-1",
    studentIdentityKey: "UID|STU-1",
    studentName: "학생-1",
    sessionId: "session-STU-1-second-class",
    classId: "CLASS-B",
    className: "토요일 성우기초",
    sourceKey: "CLASS-B|STU-1"
  })
];
