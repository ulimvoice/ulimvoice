import { createHash } from "node:crypto";
import type { UlimRole } from "../common/roles.js";
import { safeLegacyAuthUid } from "../auth/legacySessionBridge.js";
import { sha256Canonical } from "../source/canonicalJson.js";

export type DirectoryAccountRole = Exclude<UlimRole, "tablet">;
export type DirectoryEnrollmentStatus = "active" | "hold" | "withdrawn";

export interface LegacyDirectoryAccount {
  legacyUid: string;
  role: DirectoryAccountRole;
  active: boolean;
  sessionVersion: number;
  studentUid?: string;
  teacherUid?: string;
}

export interface LegacyDirectoryStudent {
  studentUid: string;
  studentName: string;
  studentIdentityKey: string;
  enrollmentStatus: DirectoryEnrollmentStatus;
  active: boolean;
}

export interface LegacyDirectoryTeacher {
  teacherUid: string;
  teacherName: string;
  active: boolean;
}

export interface LegacyDirectoryClass {
  classId?: string;
  className: string;
  instructorUids: string[];
  active: boolean;
}

export interface LegacyDirectoryClassMember {
  classId?: string;
  className?: string;
  studentUid: string;
  studentName: string;
  studentIdentityKey: string;
  instructorUids: string[];
  enrollmentStatus: DirectoryEnrollmentStatus;
  active: boolean;
}

export interface LegacyDirectoryTeacherAssignment {
  teacherUid: string;
  classId?: string;
  className?: string;
  active: boolean;
}

export interface LegacyDirectoryAdminAssignment {
  adminLegacyUid: string;
  adminRole: "admin" | "superAdmin";
  classId?: string;
  className?: string;
  active: boolean;
}

export interface LegacyIdentityDirectorySnapshot {
  schemaVersion: 1;
  snapshotAt: string;
  complete: boolean;
  accounts: LegacyDirectoryAccount[];
  students: LegacyDirectoryStudent[];
  teachers: LegacyDirectoryTeacher[];
  classes: LegacyDirectoryClass[];
  classMembers: LegacyDirectoryClassMember[];
  teacherAssignments: LegacyDirectoryTeacherAssignment[];
  adminAssignments: LegacyDirectoryAdminAssignment[];
}

export type IdentityDirectoryDocumentKind =
  | "legacyAccount"
  | "student"
  | "teacher"
  | "class"
  | "classMember"
  | "teacherAssignmentParent"
  | "teacherAssignment"
  | "adminAssignmentParent"
  | "adminAssignment";

export interface IdentityDirectoryDocument {
  path: string;
  kind: IdentityDirectoryDocumentKind;
  active: boolean;
  payloadDigest: string;
  data: Record<string, unknown>;
}

export interface IdentityDirectoryConversionError {
  code:
    | "invalid_snapshot"
    | "sensitive_field"
    | "invalid_record"
    | "duplicate_path"
    | "missing_reference"
    | "inactive_reference";
  message: string;
  path?: string;
}

export interface IdentityDirectoryConversionResult {
  documents: IdentityDirectoryDocument[];
  errors: IdentityDirectoryConversionError[];
}

const MAX_COUNTS = {
  accounts: 5_000,
  students: 5_000,
  teachers: 1_000,
  classes: 2_000,
  classMembers: 15_000,
  teacherAssignments: 10_000,
  adminAssignments: 10_000
} as const;

export function buildDirectoryClassId(input: { classId?: string; className?: string; instructorUids?: readonly string[] }): string {
  const explicit = requiredOptionalId(input.classId, "classId");
  if (explicit) return explicit;
  const className = requiredText(input.className, "className", 300);
  const instructors = normalizeStringArray(input.instructorUids || [], "instructorUids", 128).sort();
  const normalized = [className.normalize("NFC").replace(/\s+/g, ""), instructors.join(",")].join("|");
  return `legacy_${createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 24)}`;
}

export function convertIdentityDirectorySnapshot(
  rawSnapshot: LegacyIdentityDirectorySnapshot,
  now = new Date()
): IdentityDirectoryConversionResult {
  const errors: IdentityDirectoryConversionError[] = [];
  try {
    assertNoSensitiveKeys(rawSnapshot);
    validateSnapshotShape(rawSnapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push({ code: /sensitive/i.test(message) ? "sensitive_field" : "invalid_snapshot", message });
    return { documents: [], errors };
  }

  const updatedAt = now.toISOString();
  const documents = new Map<string, IdentityDirectoryDocument>();
  const studentActive = new Map<string, boolean>();
  const teacherActive = new Map<string, boolean>();
  const classActive = new Map<string, boolean>();
  const accountByAdmin = new Map<string, LegacyDirectoryAccount>();

  const add = (path: string, kind: IdentityDirectoryDocumentKind, active: boolean, data: Record<string, unknown>) => {
    if (documents.has(path)) {
      errors.push({ code: "duplicate_path", path, message: `duplicate identity directory path: ${path}` });
      return;
    }
    const cleanData = removeUndefined(data);
    const digestData = { ...cleanData };
    delete digestData.updatedAt;
    documents.set(path, {
      path,
      kind,
      active,
      payloadDigest: sha256Canonical(digestData),
      data: cleanData
    });
  };

  for (const [index, account] of rawSnapshot.accounts.entries()) {
    try {
      const role = requiredRole(account.role);
      const legacyUid = requiredText(account.legacyUid, `accounts[${index}].legacyUid`, 128);
      const sessionVersion = requiredPositiveInteger(account.sessionVersion, `accounts[${index}].sessionVersion`);
      const studentUid = account.studentUid === undefined ? undefined : requiredId(account.studentUid, `accounts[${index}].studentUid`);
      const teacherUid = account.teacherUid === undefined ? undefined : requiredId(account.teacherUid, `accounts[${index}].teacherUid`);
      if (role === "student" && (!studentUid || teacherUid)) throw new Error("student account requires only studentUid");
      if (role === "teacher" && (!teacherUid || studentUid)) throw new Error("teacher account requires only teacherUid");
      if ((role === "admin" || role === "superAdmin") && (studentUid || teacherUid)) {
        throw new Error("admin account must not include studentUid or teacherUid");
      }
      const firebaseUid = safeLegacyAuthUid(role, legacyUid);
      add(`legacyAccounts/${firebaseUid}`, "legacyAccount", account.active === true, {
        firebaseUid,
        role,
        studentUid,
        teacherUid,
        active: account.active === true,
        sessionVersion,
        source: "legacy_gas",
        updatedAt
      });
      if (role === "admin" || role === "superAdmin") accountByAdmin.set(`${role}|${legacyUid}`, account);
    } catch (error) {
      errors.push({ code: "invalid_record", message: `accounts[${index}]: ${errorMessage(error)}` });
    }
  }

  for (const [index, student] of rawSnapshot.students.entries()) {
    try {
      const studentUid = requiredId(student.studentUid, `students[${index}].studentUid`);
      const active = student.active === true;
      studentActive.set(studentUid, active);
      add(`students/${studentUid}`, "student", active, {
        studentUid,
        studentName: requiredText(student.studentName, `students[${index}].studentName`, 100),
        studentIdentityKey: requiredText(student.studentIdentityKey, `students[${index}].studentIdentityKey`, 200),
        enrollmentStatus: requiredEnrollmentStatus(student.enrollmentStatus),
        active,
        source: "legacy_gas",
        updatedAt
      });
    } catch (error) {
      errors.push({ code: "invalid_record", message: `students[${index}]: ${errorMessage(error)}` });
    }
  }

  for (const [index, teacher] of rawSnapshot.teachers.entries()) {
    try {
      const teacherUid = requiredId(teacher.teacherUid, `teachers[${index}].teacherUid`);
      const active = teacher.active === true;
      teacherActive.set(teacherUid, active);
      add(`teachers/${teacherUid}`, "teacher", active, {
        teacherUid,
        teacherName: requiredText(teacher.teacherName, `teachers[${index}].teacherName`, 100),
        active,
        source: "legacy_gas",
        updatedAt
      });
    } catch (error) {
      errors.push({ code: "invalid_record", message: `teachers[${index}]: ${errorMessage(error)}` });
    }
  }

  for (const [index, classRecord] of rawSnapshot.classes.entries()) {
    try {
      const instructorUids = normalizeStringArray(classRecord.instructorUids, `classes[${index}].instructorUids`, 128).sort();
      const classId = buildDirectoryClassId({ ...classRecord, instructorUids });
      const active = classRecord.active === true;
      classActive.set(classId, active);
      for (const teacherUid of instructorUids) {
        if (!teacherActive.has(teacherUid)) {
          errors.push({ code: "missing_reference", path: `classes/${classId}`, message: `class references missing teacher ${teacherUid}` });
        } else if (active && teacherActive.get(teacherUid) !== true) {
          errors.push({ code: "inactive_reference", path: `classes/${classId}`, message: `active class references inactive teacher ${teacherUid}` });
        }
      }
      add(`classes/${classId}`, "class", active, {
        classId,
        className: requiredText(classRecord.className, `classes[${index}].className`, 300),
        instructorUids,
        active,
        source: "legacy_gas",
        updatedAt
      });
    } catch (error) {
      errors.push({ code: "invalid_record", message: `classes[${index}]: ${errorMessage(error)}` });
    }
  }

  for (const [index, member] of rawSnapshot.classMembers.entries()) {
    try {
      const instructorUids = normalizeStringArray(member.instructorUids, `classMembers[${index}].instructorUids`, 128).sort();
      const classId = buildDirectoryClassId({ classId: member.classId, className: member.className, instructorUids });
      const studentUid = requiredId(member.studentUid, `classMembers[${index}].studentUid`);
      const active = member.active === true;
      validateActiveReferences(active, classId, studentUid, classActive, studentActive, `classMembers[${index}]`, errors);
      const memberId = `member_${hashId(`${classId}|${studentUid}`)}`;
      add(`classMembers/${memberId}`, "classMember", active, {
        classId,
        studentUid,
        active,
        studentName: requiredText(member.studentName, `classMembers[${index}].studentName`, 100),
        studentIdentityKey: requiredText(member.studentIdentityKey, `classMembers[${index}].studentIdentityKey`, 200),
        instructorUids,
        enrollmentStatus: requiredEnrollmentStatus(member.enrollmentStatus),
        source: "legacy_gas",
        updatedAt
      });
    } catch (error) {
      errors.push({ code: "invalid_record", message: `classMembers[${index}]: ${errorMessage(error)}` });
    }
  }

  const teacherParents = new Map<string, boolean>();
  for (const [index, assignment] of rawSnapshot.teacherAssignments.entries()) {
    try {
      const teacherUid = requiredId(assignment.teacherUid, `teacherAssignments[${index}].teacherUid`);
      const classId = buildDirectoryClassId({ classId: assignment.classId, className: assignment.className, instructorUids: [teacherUid] });
      const active = assignment.active === true;
      if (!teacherActive.has(teacherUid)) {
        errors.push({ code: "missing_reference", message: `teacher assignment references missing teacher ${teacherUid}` });
      } else if (active && teacherActive.get(teacherUid) !== true) {
        errors.push({ code: "inactive_reference", message: `active teacher assignment references inactive teacher ${teacherUid}` });
      }
      if (!classActive.has(classId)) {
        errors.push({ code: "missing_reference", message: `teacher assignment references missing class ${classId}` });
      } else if (active && classActive.get(classId) !== true) {
        errors.push({ code: "inactive_reference", message: `active teacher assignment references inactive class ${classId}` });
      }
      teacherParents.set(teacherUid, (teacherParents.get(teacherUid) === true) || active);
      add(`teacherAssignments/${teacherUid}/classes/${classId}`, "teacherAssignment", active, {
        teacherUid,
        classId,
        active,
        source: "legacy_gas",
        updatedAt
      });
    } catch (error) {
      errors.push({ code: "invalid_record", message: `teacherAssignments[${index}]: ${errorMessage(error)}` });
    }
  }
  for (const [teacherUid, active] of teacherParents) {
    add(`teacherAssignments/${teacherUid}`, "teacherAssignmentParent", active, {
      teacherUid,
      active,
      source: "legacy_gas",
      updatedAt
    });
  }

  const adminParents = new Map<string, { active: boolean; role: "admin" | "superAdmin" }>();
  for (const [index, assignment] of rawSnapshot.adminAssignments.entries()) {
    try {
      const role = assignment.adminRole;
      if (role !== "admin" && role !== "superAdmin") throw new Error("adminRole is invalid");
      const legacyUid = requiredText(assignment.adminLegacyUid, `adminAssignments[${index}].adminLegacyUid`, 128);
      const account = accountByAdmin.get(`${role}|${legacyUid}`);
      if (!account) errors.push({ code: "missing_reference", message: `admin assignment references missing ${role} account` });
      const firebaseUid = safeLegacyAuthUid(role, legacyUid);
      const classId = buildDirectoryClassId({ classId: assignment.classId, className: assignment.className, instructorUids: [] });
      const active = assignment.active === true;
      if (!classActive.has(classId)) {
        errors.push({ code: "missing_reference", message: `admin assignment references missing class ${classId}` });
      } else if (active && classActive.get(classId) !== true) {
        errors.push({ code: "inactive_reference", message: `active admin assignment references inactive class ${classId}` });
      }
      if (active && account?.active !== true) {
        errors.push({ code: "inactive_reference", message: `active admin assignment references inactive ${role} account` });
      }
      const current = adminParents.get(firebaseUid);
      adminParents.set(firebaseUid, { active: current?.active === true || active, role });
      add(`adminAssignments/${firebaseUid}/classes/${classId}`, "adminAssignment", active, {
        adminUid: firebaseUid,
        classId,
        active,
        source: "legacy_gas",
        updatedAt
      });
    } catch (error) {
      errors.push({ code: "invalid_record", message: `adminAssignments[${index}]: ${errorMessage(error)}` });
    }
  }
  for (const [firebaseUid, parent] of adminParents) {
    add(`adminAssignments/${firebaseUid}`, "adminAssignmentParent", parent.active, {
      adminUid: firebaseUid,
      role: parent.role,
      active: parent.active,
      source: "legacy_gas",
      updatedAt
    });
  }

  return { documents: [...documents.values()].sort((a, b) => a.path.localeCompare(b.path)), errors };
}

function validateSnapshotShape(snapshot: LegacyIdentityDirectorySnapshot): void {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error("identity directory snapshot is required");
  const expected = [
    "schemaVersion", "snapshotAt", "complete", "accounts", "students", "teachers", "classes", "classMembers",
    "teacherAssignments", "adminAssignments"
  ].sort();
  const actual = Object.keys(snapshot).sort();
  if (actual.length !== expected.length || expected.some((key, index) => key !== actual[index])) {
    throw new Error("identity directory snapshot fields are invalid");
  }
  if (snapshot.schemaVersion !== 1) throw new Error("identity directory schemaVersion is invalid");
  if (typeof snapshot.complete !== "boolean") throw new Error("identity directory complete must be boolean");
  const parsed = Date.parse(snapshot.snapshotAt);
  if (!Number.isFinite(parsed)) throw new Error("identity directory snapshotAt is invalid");
  for (const [key, max] of Object.entries(MAX_COUNTS)) {
    const value = snapshot[key as keyof LegacyIdentityDirectorySnapshot];
    if (!Array.isArray(value)) throw new Error(`identity directory ${key} must be an array`);
    if (value.length > max) throw new Error(`identity directory ${key} exceeds maximum count`);
  }
}

function assertNoSensitiveKeys(value: unknown, path = "payload"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[^a-zA-Z가-힣]/g, "").toLowerCase();
    if (/phone|telephone|mobile|contact|parentphone|guardianphone|전화|연락처|휴대폰/.test(normalized)) {
      throw new Error(`sensitive field is forbidden at ${path}.${key}`);
    }
    assertNoSensitiveKeys(item, `${path}.${key}`);
  }
}

function validateActiveReferences(
  active: boolean,
  classId: string,
  studentUid: string,
  classActive: Map<string, boolean>,
  studentActive: Map<string, boolean>,
  label: string,
  errors: IdentityDirectoryConversionError[]
): void {
  if (!classActive.has(classId)) errors.push({ code: "missing_reference", message: `${label} references missing class ${classId}` });
  if (!studentActive.has(studentUid)) errors.push({ code: "missing_reference", message: `${label} references missing student ${studentUid}` });
  if (active && classActive.get(classId) !== true) errors.push({ code: "inactive_reference", message: `${label} references inactive class ${classId}` });
  if (active && studentActive.get(studentUid) !== true) errors.push({ code: "inactive_reference", message: `${label} references inactive student ${studentUid}` });
}

function requiredRole(value: unknown): DirectoryAccountRole {
  if (value === "student" || value === "teacher" || value === "admin" || value === "superAdmin") return value;
  throw new Error("role is invalid");
}

function requiredEnrollmentStatus(value: unknown): DirectoryEnrollmentStatus {
  if (value === "active" || value === "hold" || value === "withdrawn") return value;
  throw new Error("enrollmentStatus is invalid");
}

function requiredId(value: unknown, field: string): string {
  const text = requiredText(value, field, 128);
  if (text === "." || text === ".." || text.includes("/") || [...text].some((char) => char.charCodeAt(0) < 32)) throw new Error(`${field} is invalid`);
  return text;
}

function requiredOptionalId(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredId(value, field);
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const result = value.trim();
  if (!result || result.length > maxLength) throw new Error(`${field} is invalid`);
  return result;
}

function requiredPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new Error(`${field} is invalid`);
  return value;
}

function normalizeStringArray(value: unknown, field: string, maxItemLength: number): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const unique = new Set<string>();
  for (const item of value) unique.add(requiredId(item, field).slice(0, maxItemLength));
  return [...unique];
}

function removeUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function hashId(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 32);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
