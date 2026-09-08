import type { LegacyIdentityDirectorySnapshot } from "../../src/directory/identityDirectory.js";

export function fixtureSnapshot(): LegacyIdentityDirectorySnapshot {
  return {
    schemaVersion: 1,
    snapshotAt: "2026-07-02T09:00:00.000Z",
    complete: true,
    accounts: [
      { legacyUid: "student:STU-001", role: "student", studentUid: "STU-001", active: true, sessionVersion: 2 },
      { legacyUid: "ADM-TEACHER-1", role: "teacher", teacherUid: "ADM-TEACHER-1", active: true, sessionVersion: 3 },
      { legacyUid: "ADM-SUPER-1", role: "superAdmin", active: true, sessionVersion: 1 }
    ],
    students: [
      { studentUid: "STU-001", studentName: "테스트학생", studentIdentityKey: "UID|abc", enrollmentStatus: "active", active: true }
    ],
    teachers: [
      { teacherUid: "ADM-TEACHER-1", teacherName: "이용우", active: true }
    ],
    classes: [
      { classId: "class_a", className: "목요일 연기기초", instructorUids: ["ADM-TEACHER-1"], active: true }
    ],
    classMembers: [
      {
        classId: "class_a",
        studentUid: "STU-001",
        studentName: "테스트학생",
        studentIdentityKey: "UID|abc",
        instructorUids: ["ADM-TEACHER-1"],
        enrollmentStatus: "active",
        active: true
      }
    ],
    teacherAssignments: [
      { teacherUid: "ADM-TEACHER-1", classId: "class_a", active: true }
    ],
    adminAssignments: [
      { adminLegacyUid: "ADM-SUPER-1", adminRole: "superAdmin", classId: "class_a", active: true }
    ]
  };
}

