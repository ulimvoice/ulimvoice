import { createHash } from "node:crypto";
import type { LegacyGasGateway } from "../common/sheets.js";

export type AttendanceInternalStatus =
  | "present"
  | "absent"
  | "late"
  | "unchecked"
  | "hold"
  | "makeup"
  | "new"
  | "moved"
  | "unknown";

export type AttendanceUiStatus =
  | "\uCD9C\uC11D"
  | "\uACB0\uC11D"
  | "\uC9C0\uAC01"
  | "\uBBF8\uCCB4\uD06C"
  | "\uD734\uC6D0"
  | "\uBCF4\uAC15"
  | "\uC2E0\uADDC"
  | "\uBC18\uC774\uB3D9";

export interface LegacyAttendanceRecord {
  date?: string;
  sessionId?: string;
  sessionDate?: string;
  studentName?: string;
  studentNo?: string;
  studentUid?: string;
  studentIdentityKey?: string;
  studentRowNumber?: number;
  instructor?: string;
  teacherUid?: string;
  teacherName?: string;
  classId?: string;
  className?: string;
  classroom?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  attendanceStatus?: string;
  specialStatus?: string;
  enrollmentStatus?: string;
  studentStatus?: string;
  memo?: string;
  note?: string;
  sourceSheet?: string;
  sourceRow?: number;
  sourceCol?: number;
  sourceCell?: string;
  sourceKey?: string;
}

export interface AttendanceMirrorError {
  code: "missing_identity" | "unsafe_identity" | "identity_conflict" | "missing_session_key";
  record: LegacyAttendanceRecord;
  message: string;
}

export interface AttendanceMirrorDocument {
  id: string;
  sessionId: string;
  sessionDate: string;
  classId: string;
  className: string;
  sessionStartTime?: string;
  sessionEndTime?: string;
  attendanceBlockId?: string;
  studentUid?: string;
  studentIdentityKey: string;
  studentNo?: string;
  studentRowNumber?: number;
  studentName: string;
  instructor?: string;
  teacherUid?: string;
  teacherName?: string;
  classroom?: string;
  status: AttendanceInternalStatus;
  uiStatus: AttendanceUiStatus;
  specialStatus?: string;
  enrollmentStatus?: string;
  studentStatus?: string;
  memo?: string;
  legacy: {
    sourceSheet?: string;
    sourceRow?: number;
    sourceCol?: number;
    sourceCell?: string;
    sourceKey?: string;
  };
  mirroredAt: string;
}

export interface MirrorConversionResult {
  documents: AttendanceMirrorDocument[];
  errors: AttendanceMirrorError[];
}

export interface AttendanceSnapshot {
  ok: boolean;
  source: "firestore" | "gas";
  records: LegacyAttendanceRecord[];
  message?: string;
}

export interface FirestoreAttendanceGateway {
  getAttendanceSnapshot(params: Record<string, unknown>): Promise<LegacyAttendanceRecord[]>;
}

export interface AttendanceReadAdapterOptions {
  useFirestoreAttendanceRead: boolean;
  firestore: FirestoreAttendanceGateway;
  gas: LegacyGasGateway;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeAttendanceStatus(status: unknown): AttendanceInternalStatus {
  const value = text(status);
  if (["O", "\u25CB", "\u3147", "\uCD9C", "\uCD9C\uC11D", "\uCC38\uC11D", "\uB4F1\uC6D0", "present"].includes(value)) return "present";
  if (["X", "\uACB0", "\uACB0\uC11D", "absent"].includes(value)) return "absent";
  if (value === "\uC9C0\uAC01" || value === "late") return "late";
  if (value === "\uD734\uC6D0" || value === "hold") return "hold";
  if (value.includes("\uBCF4\uAC15") || value === "makeup") return "makeup";
  if (value.includes("\uC2E0\uADDC") || value === "new") return "new";
  if (value.includes("\uBC18\uC774\uB3D9") || value === "moved") return "moved";
  if (!value || value === "\uBBF8\uCCB4\uD06C" || value === "unchecked") return "unchecked";
  return "unknown";
}

export function toUiAttendanceStatus(status: AttendanceInternalStatus): AttendanceUiStatus {
  switch (status) {
    case "present":
      return "\uCD9C\uC11D";
    case "absent":
      return "\uACB0\uC11D";
    case "late":
      return "\uC9C0\uAC01";
    case "hold":
      return "\uD734\uC6D0";
    case "makeup":
      return "\uBCF4\uAC15";
    case "new":
      return "\uC2E0\uADDC";
    case "moved":
      return "\uBC18\uC774\uB3D9";
    case "unchecked":
    case "unknown":
      return "\uBBF8\uCCB4\uD06C";
  }
}

export function buildStableClassId(record: LegacyAttendanceRecord): string | undefined {
  const explicit = text(record.classId);
  if (explicit) return explicit.replace(/[^\w.-]+/g, "_");
  const className = text(record.className);
  if (!className) return undefined;
  const instructor = text(record.teacherUid || record.instructor || record.teacherName);
  const normalized = [className.normalize("NFC").replace(/\s+/g, ""), instructor.normalize("NFC").replace(/\s+/g, "")].join("|");
  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 24);
  return `legacy_${digest}`;
}

export function buildStableSessionId(record: LegacyAttendanceRecord): string | undefined {
  const date = text(record.date || record.sessionDate);
  const classId = buildStableClassId(record);
  const sourceKey = text(record.sourceKey || record.sourceCell);
  const instructor = text(record.teacherUid || record.instructor || record.teacherName);
  if (!date || !classId || !sourceKey) return undefined;
  return [date, classId, sourceKey, instructor].filter(Boolean).join("__").replace(/[^\w.-]+/g, "_");
}

function isUnsafeIdentityKey(value: string): boolean {
  const compact = value.replace(/[^0-9a-zA-Z가-힣|:_-]/g, "");
  if (!compact) return true;
  if (/^\d{4}$/.test(compact) || /^\d{10,11}$/.test(compact)) return true;
  if (/^(?!uid(?:entity)?[|:_-]|stu(?:dent)?[|:_-])[a-zA-Z가-힣]{2,30}[|:_-]\d{4}$/i.test(compact)) return true;
  if (/(?:phone|mobile|tel|전화|휴대폰)/i.test(compact)) return true;
  return false;
}

export function toAttendanceMirrorDocument(record: LegacyAttendanceRecord, mirroredAt = new Date()): AttendanceMirrorDocument {
  const studentUid = text(record.studentUid);
  if (!studentUid) {
    throw new Error("attendance mirror requires verified studentUid");
  }
  const studentIdentityKey = text(record.studentIdentityKey || studentUid);
  if (isUnsafeIdentityKey(studentIdentityKey)) {
    throw new Error("attendance mirror rejects phone-derived or ambiguous studentIdentityKey");
  }
  const sessionId = text(record.sessionId) || buildStableSessionId(record);
  if (!sessionId) {
    throw new Error("attendance mirror requires stable session key: date + classId + sourceKey/sourceCell");
  }
  const classId = buildStableClassId(record);
  if (!classId) {
    throw new Error("attendance mirror requires classId or className");
  }
  const status = normalizeAttendanceStatus(record.attendanceStatus || record.status);
  const id = `${sessionId}_${studentIdentityKey}`.replace(/[^\w.-]+/g, "_");
  return {
    id,
    sessionId,
    sessionDate: text(record.date || record.sessionDate),
    classId,
    className: text(record.className),
    sessionStartTime: text(record.startTime) || undefined,
    sessionEndTime: text(record.endTime) || undefined,
    studentUid,
    studentIdentityKey,
    studentNo: text(record.studentNo) || undefined,
    studentRowNumber: record.studentRowNumber,
    studentName: text(record.studentName),
    instructor: text(record.instructor) || undefined,
    teacherUid: text(record.teacherUid) || undefined,
    teacherName: text(record.teacherName) || undefined,
    classroom: text(record.classroom) || undefined,
    status,
    uiStatus: toUiAttendanceStatus(status),
    specialStatus: text(record.specialStatus) || undefined,
    enrollmentStatus: text(record.enrollmentStatus) || undefined,
    studentStatus: text(record.studentStatus) || undefined,
    memo: text(record.memo || record.note) || undefined,
    legacy: {
      sourceSheet: text(record.sourceSheet) || undefined,
      sourceRow: record.sourceRow,
      sourceCol: record.sourceCol,
      sourceCell: text(record.sourceCell) || undefined,
      sourceKey: text(record.sourceKey) || undefined
    },
    mirroredAt: mirroredAt.toISOString()
  };
}

export function tryToAttendanceMirrorDocument(
  record: LegacyAttendanceRecord,
  mirroredAt = new Date()
): { document?: AttendanceMirrorDocument; error?: AttendanceMirrorError } {
  try {
    return { document: toAttendanceMirrorDocument(record, mirroredAt) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: {
        code: message.includes("studentUid")
          ? "missing_identity"
          : message.includes("studentIdentityKey")
            ? "unsafe_identity"
            : "missing_session_key",
        record,
        message
      }
    };
  }
}

export function mirrorWebAttendanceRows(rows: LegacyAttendanceRecord[], mirroredAt = new Date()): MirrorConversionResult {
  const result: MirrorConversionResult = { documents: [], errors: [] };
  const identityKeyByUid = new Map<string, string>();
  const uidByIdentityKey = new Map<string, string>();

  for (const row of rows) {
    const converted = tryToAttendanceMirrorDocument(row, mirroredAt);
    if (converted.error) {
      result.errors.push(converted.error);
      continue;
    }
    const document = converted.document;
    if (!document || !document.studentUid) continue;

    const knownIdentityKey = identityKeyByUid.get(document.studentUid);
    const knownUid = uidByIdentityKey.get(document.studentIdentityKey);
    if ((knownIdentityKey && knownIdentityKey !== document.studentIdentityKey) || (knownUid && knownUid !== document.studentUid)) {
      result.errors.push({
        code: "identity_conflict",
        record: row,
        message: `attendance identity conflict for studentUid=${document.studentUid} studentIdentityKey=${document.studentIdentityKey}`
      });
      continue;
    }

    identityKeyByUid.set(document.studentUid, document.studentIdentityKey);
    uidByIdentityKey.set(document.studentIdentityKey, document.studentUid);
    result.documents.push(document);
  }

  return result;
}

export function normalizeForCurrentAttendanceUi(records: AttendanceMirrorDocument[]): LegacyAttendanceRecord[] {
  return records.map((record) => ({
    date: record.sessionDate,
    sessionId: record.sessionId,
    sessionDate: record.sessionDate,
    studentName: record.studentName,
    studentNo: record.studentNo,
    studentUid: record.studentUid,
    studentIdentityKey: record.studentIdentityKey,
    studentRowNumber: record.studentRowNumber,
    instructor: record.instructor || record.teacherName,
    teacherUid: record.teacherUid,
    teacherName: record.teacherName,
    classId: record.classId,
    className: record.className,
    classroom: record.classroom,
    startTime: record.sessionStartTime,
    endTime: record.sessionEndTime,
    status: record.uiStatus,
    attendanceStatus: record.uiStatus,
    specialStatus: record.specialStatus,
    enrollmentStatus: record.enrollmentStatus,
    studentStatus: record.studentStatus,
    memo: record.memo,
    note: record.memo,
    sourceSheet: record.legacy.sourceSheet,
    sourceRow: record.legacy.sourceRow,
    sourceCol: record.legacy.sourceCol,
    sourceCell: record.legacy.sourceCell,
    sourceKey: record.legacy.sourceKey
  }));
}

export async function readAttendanceSnapshot(
  options: AttendanceReadAdapterOptions,
  params: Record<string, unknown>
): Promise<AttendanceSnapshot> {
  if (!options.useFirestoreAttendanceRead) {
    const fallback = await options.gas.request<AttendanceSnapshot>({ action: "adminGetAttendanceSnapshot", params });
    return { ...fallback, source: "gas" };
  }

  try {
    const records = await options.firestore.getAttendanceSnapshot(params);
    if (!Array.isArray(records)) throw new Error("Firestore attendance result must be an array");
    const mirrored = mirrorWebAttendanceRows(records);
    if (mirrored.errors.length > 0) {
      throw new Error(`Firestore attendance result contains ${mirrored.errors.length} invalid identity/session record(s)`);
    }
    const normalized = normalizeForCurrentAttendanceUi(mirrored.documents);
    return {
      ok: true,
      source: "firestore",
      records: normalized
    };
  } catch (error) {
    const fallback = await options.gas.request<AttendanceSnapshot>({ action: "adminGetAttendanceSnapshot", params });
    return {
      ...fallback,
      source: "gas",
      message: fallback.message || `Firestore read failed; GAS fallback used: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
