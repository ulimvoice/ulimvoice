import { FieldValue, getFirestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import type { UlimRole } from "../common/roles.js";
import {
  normalizeRealtimeAuthVersion,
  type RealtimeAuthVersion
} from "./realtimeAuthVersion.js";
import {
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS
} from "./realtimeCallableOptions.js";
import {
  expandClassroomRecordsToHourly,
  type ClassroomRecordLike
} from "./classroomFirestoreFirstCore.js";

const CLASSROOM_ROOMS = new Set([
  "2강의실",
  "3강의실",
  "4강의실",
  "5강의실",
  "녹음실",
  "신체훈련실"
]);

const RESERVATION_ROOMS = new Set([
  "2강의실",
  "3강의실",
  "4강의실",
  "5강의실",
  "녹음실",
  "신체훈련실",
  "개인부스1",
  "개인부스2",
  "개인부스3"
]);

const STAFF_ROLES = new Set<UlimRole>(["teacher", "admin", "superAdmin"]);
const AUTH_ROLES = new Set<UlimRole>(["student", "teacher", "admin", "superAdmin"]);
const MAX_CLASSROOM_RECORDS = 120;
const MAX_ROOM_RESERVATIONS = 1500;
const MAX_TEXT_LENGTH = 200;
const MAX_MEMO_LENGTH = 500;
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;

interface ActiveCaller {
  firebaseUid: string;
  role: UlimRole;
  studentUid?: string;
  teacherUid?: string;
  authVersion: RealtimeAuthVersion;
}

interface ClassroomRecord {
  recordId: string;
  date: string;
  room: string;
  startHour: number;
  endHour: number;
  instructor: string;
  className: string;
  purpose: string;
  status: "사용중";
  memo: string;
  sheetName: string;
}

interface RoomReservationRecord {
  id: string;
  date: string;
  room: string;
  startHour: number;
  endHour: number;
  status: "예약완료";
}

interface SnapshotInput {
  key?: unknown;
  date?: unknown;
  month?: unknown;
  records?: unknown;
  reservations?: unknown;
  observedAtMs?: unknown;
  requestId?: unknown;
  sheetRevision?: unknown;
}

export const syncClassroomRealtimeSnapshot = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const app = getOrInitializeDefaultFirebaseAdminApp();
    const db = getFirestore(app);
    const caller = await requireActiveCaller(request, STAFF_ROLES);
    const input = parseObject(request.data);
    const date = parseDateKey(input.date ?? input.key);
    const month = date.slice(0, 7);
    const records = parseClassroomRecords(input.records, date);
    const observedAtMs = parseObservedAt(input.observedAtMs);
    const requestId = parseRequestId(input.requestId);
    const sheetRevision = cleanOptionalText(input.sheetRevision, 180);

    const dayRef = db.collection("realtimeClassroomDays").doc(date);
    const monthRef = db.collection("realtimeRoomMonths").doc(month);

    const result = await db.runTransaction(async (transaction: Transaction) => {
      const [daySnapshot, monthSnapshot] = await Promise.all([
        transaction.get(dayRef),
        transaction.get(monthRef)
      ]);

      const currentObservedAt = readSafeInteger(daySnapshot.data()?.sourceObservedAtMs, 0);
      if (currentObservedAt > observedAtMs) {
        return {
          accepted: false,
          stale: true,
          currentObservedAtMs: currentObservedAt
        };
      }

      const currentMonthData = monthSnapshot.data() ?? {};
      /*
       * 7.29.5: Google Sheets가 강의실 사용 현황의 단일 기준입니다.
       * 시트에서 읽은 레코드로 해당 날짜 Firestore 스냅샷을 완전히 교체합니다.
       * 이전 Firestore-first 레코드와 tombstone은 보존하지 않습니다.
       */
      const releaseTombstones: Record<string, never> = {};
      const mergedRecords = expandClassroomRecordsToHourly(
        records as ClassroomRecordLike[]
      ) as ClassroomRecord[];
      const classroomByDate = parseExistingClassroomByDate(currentMonthData.classroomByDate);
      classroomByDate[date] = mergedRecords;

      transaction.set(dayRef, {
        date,
        records: mergedRecords,
        recordCount: mergedRecords.length,
        releaseTombstones,
        sourceObservedAtMs: observedAtMs,
        sourceRequestId: requestId,
        sheetRevision,
        updatedByFirebaseUid: caller.firebaseUid,
        updatedByRole: caller.role,
        writeMode: "sheet_authoritative_replace",
        updatedAt: FieldValue.serverTimestamp(),
        schemaVersion: 2,
        version: "2026-07-30.729.06"
      }, { merge: true });

      transaction.set(monthRef, {
        month,
        classroomByDate,
        classroomSourceObservedAtMs: observedAtMs,
        classroomSourceRequestId: requestId,
        classroomSheetRevision: sheetRevision,
        classroomUpdatedByFirebaseUid: caller.firebaseUid,
        classroomUpdatedByRole: caller.role,
        classroomWriteMode: "sheet_authoritative_replace",
        classroomUpdatedAt: FieldValue.serverTimestamp(),
        schemaVersion: 2,
        version: "2026-07-30.729.05"
      }, { merge: true });

      return {
        accepted: true,
        stale: false,
        currentObservedAtMs: observedAtMs
      };
    });

    return {
      ok: true,
      dataset: "classroom",
      date,
      month,
      count: records.length,
      ...result
    };
  }
);

export const syncRoomRealtimeSnapshot = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const app = getOrInitializeDefaultFirebaseAdminApp();
    const db = getFirestore(app);
    const caller = await requireActiveCaller(request, AUTH_ROLES);
    const input = parseObject(request.data);
    const month = parseMonthKey(input.month ?? input.key);
    const reservations = parseRoomReservations(input.reservations ?? input.records, month);
    const observedAtMs = parseObservedAt(input.observedAtMs);
    const requestId = parseRequestId(input.requestId);

    const monthRef = db.collection("realtimeRoomMonths").doc(month);

    const result = await db.runTransaction(async (transaction: Transaction) => {
      const snapshot = await transaction.get(monthRef);
      const currentObservedAt = readSafeInteger(snapshot.data()?.roomSourceObservedAtMs, 0);
      if (currentObservedAt > observedAtMs) {
        return {
          accepted: false,
          stale: true,
          currentObservedAtMs: currentObservedAt
        };
      }

      transaction.set(monthRef, {
        month,
        reservations,
        reservationCount: reservations.length,
        roomSourceObservedAtMs: observedAtMs,
        roomSourceRequestId: requestId,
        roomUpdatedByFirebaseUid: caller.firebaseUid,
        roomUpdatedByRole: caller.role,
        roomUpdatedAt: FieldValue.serverTimestamp(),
        schemaVersion: 1
      }, { merge: true });

      return {
        accepted: true,
        stale: false,
        currentObservedAtMs: observedAtMs
      };
    });

    return {
      ok: true,
      dataset: "room",
      month,
      count: reservations.length,
      ...result
    };
  }
);

async function requireActiveCaller(
  request: CallableRequest<unknown>,
  allowedRoles: ReadonlySet<UlimRole>
): Promise<ActiveCaller> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Firebase login is required");
  }

  const firebaseUid = cleanText(request.auth.uid, 128, "firebase uid");
  const role = parseRole(request.auth.token.role);
  if (!allowedRoles.has(role)) {
    throw new HttpsError("permission-denied", "role is not allowed for this realtime dataset");
  }

  const authVersion =
    normalizeRealtimeAuthVersion(
      request.auth.token.authVersion
    );

  if (authVersion === null) {
    throw new HttpsError(
      "permission-denied",
      "authVersion is invalid"
    );
  }
  const app = getOrInitializeDefaultFirebaseAdminApp();
  const db = getFirestore(app);
  const snapshot = await db.collection("users").doc(firebaseUid).get();
  if (!snapshot.exists) {
    throw new HttpsError("permission-denied", "firebase access document is missing");
  }

  const user = snapshot.data() ?? {};
  const storedAuthVersion =
    normalizeRealtimeAuthVersion(
      user.authVersion
    );

  if (
    user.active !== true ||
    user.role !== role ||
    storedAuthVersion === null ||
    storedAuthVersion !== authVersion
  ) {
    console.error(
      "[ULIM realtime auth 7.27.1 mismatch]",
      {
        firebaseUid,
        role,
        claimAuthVersion:
          request.auth.token.authVersion,
        normalizedClaimAuthVersion:
          authVersion,
        storedAuthVersion:
          user.authVersion,
        normalizedStoredAuthVersion:
          storedAuthVersion,
        active:
          user.active === true
      }
    );

    throw new HttpsError(
      "permission-denied",
      "firebase access document is stale or inactive"
    );
  }

  const studentUid = optionalCleanText(request.auth.token.studentUid, 128, "studentUid");
  const teacherUid = optionalCleanText(request.auth.token.teacherUid, 128, "teacherUid");

  if (role === "student") {
    if (!studentUid || user.studentUid !== studentUid || user.teacherUid !== undefined) {
      throw new HttpsError("permission-denied", "student identity claim mismatch");
    }
  } else if (role === "teacher") {
    if (!teacherUid || user.teacherUid !== teacherUid || user.studentUid !== undefined) {
      throw new HttpsError("permission-denied", "teacher identity claim mismatch");
    }
  } else if (user.studentUid !== undefined || user.teacherUid !== undefined) {
    throw new HttpsError("permission-denied", "staff identity document contains stale scoped uid");
  }

  return {
    firebaseUid,
    role,
    studentUid,
    teacherUid,
    authVersion
  };
}

function parseClassroomRecords(value: unknown, date: string): ClassroomRecord[] {
  if (!Array.isArray(value) || value.length > MAX_CLASSROOM_RECORDS) {
    throw new HttpsError("invalid-argument", "classroom records are invalid");
  }

  const records = value.map((entry, index) => {
    const data = parseObject(entry);
    const room = parseRoom(data.room, CLASSROOM_ROOMS);
    const startHour = parseHour(data.startHour, `records[${index}].startHour`);
    const endHour = parseHour(data.endHour, `records[${index}].endHour`);
    if (endHour <= startHour) {
      throw new HttpsError("invalid-argument", `records[${index}] time range is invalid`);
    }

    return {
      recordId: cleanText(data.recordId ?? `${date}|${room}|${startHour}|${endHour}`, 256, `records[${index}].recordId`),
      date,
      room,
      startHour,
      endHour,
      instructor: cleanOptionalText(data.instructor, MAX_TEXT_LENGTH),
      className: cleanOptionalText(data.className, MAX_TEXT_LENGTH),
      purpose: cleanOptionalText(data.purpose ?? data.className, MAX_TEXT_LENGTH),
      status: "사용중" as const,
      memo: cleanOptionalText(data.memo, MAX_MEMO_LENGTH),
      sheetName: cleanOptionalText(data.sheetName, MAX_TEXT_LENGTH)
    };
  });

  assertNoClassroomOverlap(records);
  return records;
}

function parseRoomReservations(value: unknown, month: string): RoomReservationRecord[] {
  if (!Array.isArray(value) || value.length > MAX_ROOM_RESERVATIONS) {
    throw new HttpsError("invalid-argument", "room reservations are invalid");
  }

  const result: RoomReservationRecord[] = [];
  const seen = new Set<string>();

  value.forEach((entry, index) => {
    const data = parseObject(entry);
    const statusText = cleanOptionalText(data.status, 40).replace(/\s+/g, "");
    if (statusText === "취소" || statusText === "사용완료") return;

    const date = parseDateKey(data.date);
    if (!date.startsWith(`${month}-`)) {
      throw new HttpsError("invalid-argument", `reservations[${index}].date is outside month`);
    }

    const room = parseRoom(data.room, RESERVATION_ROOMS);
    const startHour = parseHour(data.startHour, `reservations[${index}].startHour`);
    const endHour = parseHour(data.endHour, `reservations[${index}].endHour`);
    if (endHour <= startHour) {
      throw new HttpsError("invalid-argument", `reservations[${index}] time range is invalid`);
    }

    const id = cleanText(data.id ?? data.reservationId ?? `${date}|${room}|${startHour}|${endHour}`, 256, `reservations[${index}].id`);
    const dedupeKey = `${date}|${room}|${startHour}|${endHour}|${id}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    result.push({
      id,
      date,
      room,
      startHour,
      endHour,
      status: "예약완료"
    });
  });

  return result;
}

function assertNoClassroomOverlap(records: ClassroomRecord[]): void {
  const occupied = new Set<string>();
  for (const record of records) {
    for (let hour = record.startHour; hour < record.endHour; hour += 1) {
      const key = `${record.room}|${hour}`;
      if (occupied.has(key)) {
        throw new HttpsError("invalid-argument", `classroom records overlap at ${key}`);
      }
      occupied.add(key);
    }
  }
}

function parseExistingClassroomByDate(value: unknown): Record<string, ClassroomRecord[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const output: Record<string, ClassroomRecord[]> = {};
  for (const [date, records] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(records)) continue;
    output[date] = records.slice(0, MAX_CLASSROOM_RECORDS) as ClassroomRecord[];
  }
  return output;
}

function parseObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "input must be an object");
  }
  return value as Record<string, unknown>;
}

function parseDateKey(value: unknown): string {
  const date = cleanText(value, 10, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError("invalid-argument", "date must be YYYY-MM-DD");
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpsError("invalid-argument", "date is invalid");
  }
  return date;
}

function parseMonthKey(value: unknown): string {
  const month = cleanText(value, 7, "month");
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new HttpsError("invalid-argument", "month must be YYYY-MM");
  }
  const number = Number(month.slice(5, 7));
  if (number < 1 || number > 12) {
    throw new HttpsError("invalid-argument", "month is invalid");
  }
  return month;
}

function parseRoom(value: unknown, allowed: ReadonlySet<string>): string {
  const room = cleanText(value, 40, "room").replace(/\s+/g, "");
  const matched = Array.from(allowed).find(candidate => candidate.replace(/\s+/g, "") === room);
  if (!matched) throw new HttpsError("invalid-argument", "room is invalid");
  return matched;
}

function parseHour(value: unknown, fieldName: string): number {
  const hour = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 24) {
    throw new HttpsError("invalid-argument", `${fieldName} is invalid`);
  }
  return hour;
}

function parseObservedAt(value: unknown): number {
  const observedAtMs = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(observedAtMs) || observedAtMs <= 0) {
    throw new HttpsError("invalid-argument", "observedAtMs is invalid");
  }
  if (Math.abs(Date.now() - observedAtMs) > MAX_CLOCK_SKEW_MS) {
    throw new HttpsError("invalid-argument", "observedAtMs is outside the allowed clock window");
  }
  return observedAtMs;
}

function parseRequestId(value: unknown): string {
  const requestId = cleanText(value, 128, "requestId");
  if (!/^[A-Za-z0-9._:-]+$/.test(requestId)) {
    throw new HttpsError("invalid-argument", "requestId is invalid");
  }
  return requestId;
}

function parseRole(value: unknown): UlimRole {
  if (typeof value !== "string" || !AUTH_ROLES.has(value as UlimRole)) {
    throw new HttpsError("permission-denied", "firebase role is invalid");
  }
  return value as UlimRole;
}

function parsePositiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new HttpsError("permission-denied", `${fieldName} is invalid`);
  }
  return value;
}

function cleanText(value: unknown, maxLength: number, fieldName: string): string {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${fieldName} must be a string`);
  }
  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new HttpsError("invalid-argument", `${fieldName} is invalid`);
  }
  return text;
}

function optionalCleanText(value: unknown, maxLength: number, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return cleanText(value, maxLength, fieldName);
}

function cleanOptionalText(value: unknown, maxLength: number): string {
  if (value === undefined || value === null) return "";
  const text = String(value).trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function pruneReleaseTombstones728_(value: unknown): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return output;
  const now = Date.now();
  const ttl = 24 * 60 * 60 * 1000;
  for (const [slotKey, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    const createdAtMs = readSafeInteger((raw as Record<string, unknown>).createdAtMs, 0);
    if (!createdAtMs || now - createdAtMs > ttl) continue;
    output[slotKey] = raw;
  }
  return output;
}

function readSafeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : fallback;
}
