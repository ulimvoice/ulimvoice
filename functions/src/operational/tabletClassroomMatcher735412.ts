import {
  classroomUsageSignatureSource735413,
  normalizeClassKey735413,
  normalizeTeacherKey735413,
  parseClassTimeRange735413,
  resolveClassroomFromUsage735413,
  type ClassSessionLike735413,
  type FirestoreClassroomUsageLike735413
} from "./classroomUsageResolver735413.js";

export type TabletAttendanceClassLike = ClassSessionLike735413;
export type FirestoreClassroomUsageLike = FirestoreClassroomUsageLike735413;

export interface TabletClassroomMatch735412 {
  roomName: string;
  recordId: string;
  className: string;
  instructor: string;
  startHour: number;
  endHour: number;
  score: number;
  source: "firestoreClassroomUsage";
}

export const normalizeTeacherKey735412 = normalizeTeacherKey735413;
export const normalizeClassKey735412 = normalizeClassKey735413;
export const parseClassTimeRange735412 = parseClassTimeRange735413;

export function resolveTabletClassroom735412(
  attendance: TabletAttendanceClassLike,
  usageRecords: readonly FirestoreClassroomUsageLike[]
): TabletClassroomMatch735412 | null {
  const match = resolveClassroomFromUsage735413(attendance, usageRecords);
  return match ? { ...match, source: "firestoreClassroomUsage" } : null;
}

export function classroomUsageSignatureSource735412(records: readonly FirestoreClassroomUsageLike[]): string {
  return classroomUsageSignatureSource735413(records);
}
