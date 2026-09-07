export type UlimRole = "student" | "teacher" | "admin" | "superAdmin" | "tablet";

export interface UlimClaims {
  uid: string;
  role: UlimRole;
  studentUid?: string;
  teacherUid?: string;
  authVersion?: number | string;
}

export interface ScopedRecord {
  studentUid?: string;
  classId?: string;
}

export interface AssignmentContext {
  teacherClassIds?: readonly string[];
  adminClassIds?: readonly string[];
}

export interface ClassMemberRecord extends ScopedRecord {
  active?: boolean;
  studentName?: string;
  studentIdentityKey?: string;
  instructorUids?: readonly string[];
  enrollmentStatus?: string;
}

export function hasRole(claims: UlimClaims | undefined, role: UlimRole): boolean {
  return claims?.role === role;
}

export function canReadStudentRecord(
  claims: UlimClaims,
  record: ScopedRecord,
  assignments: AssignmentContext = {}
): boolean {
  if (claims.role === "superAdmin") return true;
  if (claims.role === "student") return Boolean(record.studentUid && claims.studentUid === record.studentUid);
  if (!record.classId) return false;
  if (claims.role === "teacher") return Boolean(assignments.teacherClassIds?.includes(record.classId));
  if (claims.role === "admin") return Boolean(assignments.adminClassIds?.includes(record.classId));
  return false;
}

export function canReadClassMember(
  claims: UlimClaims,
  member: ClassMemberRecord,
  assignments: AssignmentContext = {}
): boolean {
  if (claims.role === "superAdmin") return true;
  if (member.active !== true) return false;
  return canReadStudentRecord(claims, member, assignments);
}

export function canReadClass(
  claims: UlimClaims,
  classId: string,
  assignments: AssignmentContext = {}
): boolean {
  if (claims.role === "superAdmin") return true;
  if (claims.role === "teacher") return Boolean(assignments.teacherClassIds?.includes(classId));
  if (claims.role === "admin") return Boolean(assignments.adminClassIds?.includes(classId));
  return false;
}

export function minimalCustomClaims(input: UlimClaims): Omit<UlimClaims, "uid"> {
  const claims: Omit<UlimClaims, "uid"> = { role: input.role };
  if (input.studentUid !== undefined) claims.studentUid = input.studentUid;
  if (input.teacherUid !== undefined) claims.teacherUid = input.teacherUid;
  if (input.authVersion !== undefined) claims.authVersion = input.authVersion;
  return claims;
}
