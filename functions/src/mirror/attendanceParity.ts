import {
  buildStableClassId,
  buildStableSessionId,
  normalizeAttendanceStatus,
  type LegacyAttendanceRecord
} from "./attendanceMirror.js";

export interface AttendanceParityProjection {
  key: string;
  studentUid: string;
  studentIdentityKey: string;
  sessionId: string;
  sessionDate: string;
  classId: string;
  className: string;
  teacherUid: string;
  instructor: string;
  status: string;
  specialStatus: string;
  enrollmentStatus: string;
  studentStatus: string;
  sourceSheet: string;
  sourceRow: number | null;
  sourceCol: number | null;
  sourceCell: string;
  sourceKey: string;
}

export interface AttendanceParityInvalidRecord {
  side: "gas" | "firestore";
  index: number;
  reason: string;
  record: LegacyAttendanceRecord;
}

export interface AttendanceParityMismatch {
  key: string;
  fields: string[];
  gas: AttendanceParityProjection;
  firestore: AttendanceParityProjection;
}

export interface AttendanceParityResult {
  parityPass: boolean;
  gasCount: number;
  firestoreCount: number;
  comparableGasCount: number;
  comparableFirestoreCount: number;
  missingInFirestore: AttendanceParityProjection[];
  extraInFirestore: AttendanceParityProjection[];
  mismatches: AttendanceParityMismatch[];
  duplicateGasKeys: string[];
  duplicateFirestoreKeys: string[];
  invalidRecords: AttendanceParityInvalidRecord[];
}

function text(value: unknown): string {
  return String(value ?? "").trim().normalize("NFC");
}

function normalizedText(value: unknown): string {
  return text(value).replace(/\s+/g, " ");
}

function finiteInteger(value: unknown): number | null {
  return Number.isInteger(value) ? Number(value) : null;
}

export function projectAttendanceForParity(record: LegacyAttendanceRecord): AttendanceParityProjection {
  const studentUid = text(record.studentUid);
  if (!studentUid) throw new Error("studentUid is required for attendance parity");
  const studentIdentityKey = text(record.studentIdentityKey || studentUid);
  const sessionDate = text(record.sessionDate || record.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) throw new Error("sessionDate must be YYYY-MM-DD");
  const classId = text(record.classId) || buildStableClassId(record) || "";
  if (!classId) throw new Error("classId or stable class identity is required for attendance parity");
  const sessionId = text(record.sessionId) || buildStableSessionId({ ...record, classId, sessionDate });
  if (!sessionId) throw new Error("sessionId or stable session source key is required for attendance parity");
  const key = `${sessionId}__${studentUid}`;

  return {
    key,
    studentUid,
    studentIdentityKey,
    sessionId,
    sessionDate,
    classId,
    className: normalizedText(record.className),
    teacherUid: text(record.teacherUid),
    instructor: normalizedText(record.instructor || record.teacherName),
    status: normalizeAttendanceStatus(record.attendanceStatus || record.status),
    specialStatus: normalizedText(record.specialStatus),
    enrollmentStatus: normalizedText(record.enrollmentStatus),
    studentStatus: normalizedText(record.studentStatus),
    sourceSheet: normalizedText(record.sourceSheet),
    sourceRow: finiteInteger(record.sourceRow),
    sourceCol: finiteInteger(record.sourceCol),
    sourceCell: text(record.sourceCell),
    sourceKey: text(record.sourceKey)
  };
}

function indexSide(
  records: readonly LegacyAttendanceRecord[],
  side: "gas" | "firestore",
  invalidRecords: AttendanceParityInvalidRecord[]
): { map: Map<string, AttendanceParityProjection>; duplicateKeys: string[] } {
  const map = new Map<string, AttendanceParityProjection>();
  const duplicateKeys = new Set<string>();
  records.forEach((record, index) => {
    try {
      const projected = projectAttendanceForParity(record);
      if (map.has(projected.key)) duplicateKeys.add(projected.key);
      else map.set(projected.key, projected);
    } catch (error) {
      invalidRecords.push({
        side,
        index,
        reason: error instanceof Error ? error.message : String(error),
        record
      });
    }
  });
  return { map, duplicateKeys: [...duplicateKeys].sort() };
}

const COMPARED_FIELDS: Array<Exclude<keyof AttendanceParityProjection, "key">> = [
  "studentUid",
  "studentIdentityKey",
  "sessionId",
  "sessionDate",
  "classId",
  "className",
  "teacherUid",
  "instructor",
  "status",
  "specialStatus",
  "enrollmentStatus",
  "studentStatus",
  "sourceSheet",
  "sourceRow",
  "sourceCol",
  "sourceCell",
  "sourceKey"
];

export function compareAttendanceParity(
  gasRecords: readonly LegacyAttendanceRecord[],
  firestoreRecords: readonly LegacyAttendanceRecord[]
): AttendanceParityResult {
  const invalidRecords: AttendanceParityInvalidRecord[] = [];
  const gas = indexSide(gasRecords, "gas", invalidRecords);
  const firestore = indexSide(firestoreRecords, "firestore", invalidRecords);
  const missingInFirestore: AttendanceParityProjection[] = [];
  const extraInFirestore: AttendanceParityProjection[] = [];
  const mismatches: AttendanceParityMismatch[] = [];

  for (const [key, gasRecord] of gas.map) {
    const firestoreRecord = firestore.map.get(key);
    if (!firestoreRecord) {
      missingInFirestore.push(gasRecord);
      continue;
    }
    const fields = COMPARED_FIELDS.filter((field) => gasRecord[field] !== firestoreRecord[field]);
    if (fields.length) mismatches.push({ key, fields, gas: gasRecord, firestore: firestoreRecord });
  }

  for (const [key, firestoreRecord] of firestore.map) {
    if (!gas.map.has(key)) extraInFirestore.push(firestoreRecord);
  }

  missingInFirestore.sort((a, b) => a.key.localeCompare(b.key));
  extraInFirestore.sort((a, b) => a.key.localeCompare(b.key));
  mismatches.sort((a, b) => a.key.localeCompare(b.key));

  const parityPass = invalidRecords.length === 0
    && gas.duplicateKeys.length === 0
    && firestore.duplicateKeys.length === 0
    && missingInFirestore.length === 0
    && extraInFirestore.length === 0
    && mismatches.length === 0;

  return {
    parityPass,
    gasCount: gasRecords.length,
    firestoreCount: firestoreRecords.length,
    comparableGasCount: gas.map.size,
    comparableFirestoreCount: firestore.map.size,
    missingInFirestore,
    extraInFirestore,
    mismatches,
    duplicateGasKeys: gas.duplicateKeys,
    duplicateFirestoreKeys: firestore.duplicateKeys,
    invalidRecords
  };
}
