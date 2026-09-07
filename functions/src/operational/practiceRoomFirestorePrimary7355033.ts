import { createHash } from "node:crypto";
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type QueryDocumentSnapshot
} from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";
import { sendOperationalSolapiMessages7355014, ULIM_SOLAPI_OPERATIONAL_CONFIG_7355014 } from "./firestorePrimaryOperations73550.js";

const VERSION = "2026-08-11.7355037-practice-room-popup-push-alimtalk-fix";
const ROOMS = new Set([
  "4강의실", "5강의실", "신체훈련실", "2강의실", "3강의실",
  "개인부스1", "개인부스2", "개인부스3"
]);

// Existing Phase-1 security model. Do not introduce parallel reservation owners.
const RESERVATIONS = "roomReservations";
const AVAILABILITY = "roomAvailability";
const REALTIME_MONTHS = "realtimeRoomMonths";

// Server-only cutover / idempotency / notification helpers.
const LEGACY_MONTHS = "practiceRoomLegacyMonths";
const REQUESTS = "practiceRoomMutationRequests";
const PUSH_TOKENS = "practiceRoomAdminPushTokens";
const DECISION_NOTIFICATION_JOBS = "practiceRoomDecisionNotificationJobs";

type PlainObject = Record<string, unknown>;
type Caller = {
  firebaseUid: string;
  role: "student" | "teacher" | "admin" | "superAdmin";
  studentUid: string;
  teacherUid: string;
  displayName: string;
  classId: string;
  instructorName: string;
  user: DocumentData;
};
type CanonicalReservation = {
  reservationId: string;
  date: string;
  month: string;
  room: string;
  slot: string;
  startHour: number;
  endHour: number;
  status: string;
  canonicalStatus: string;
  active: boolean;
  studentUid: string;
  studentName: string;
  phoneLast4: string;
  studentPhone: string;
  parentPhone: string;
  actorFirebaseUid: string;
  actorType: string;
  instructorName: string;
  classId: string;
  memo: string;
  source: string;
  legacy: boolean;
  raw: DocumentData;
};

function db() {
  return getFirestore(getOrInitializeDefaultFirebaseAdminApp());
}
function object(value: unknown): PlainObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as PlainObject : {};
}
function text(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}
function normalize(value: unknown): string {
  return text(value).normalize("NFKC").toLowerCase().replace(/[\s_-]+/g, "");
}
function digits(value: unknown): string {
  return text(value, 100).replace(/\D/g, "");
}
function hash(...parts: unknown[]): string {
  return createHash("sha256").update(parts.map(v => text(v, 4000)).join("\u001f")).digest("hex");
}
function safeId(value: unknown): string {
  const raw = text(value, 500);
  return raw && !raw.includes("/") ? raw : `ID_${hash(raw).slice(0, 48)}`;
}
function dateText(value: unknown): string {
  const valueText = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueText)) {
    throw new HttpsError("invalid-argument", "예약일을 확인해주세요.");
  }
  return valueText;
}
function monthText(year: unknown, month: unknown): string {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2020 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) {
    throw new HttpsError("invalid-argument", "예약월을 확인해주세요.");
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}
function monthFromDate(date: string): string {
  return date.slice(0, 7);
}
function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function hourValue(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(text(value, 30).match(/\d{1,2}/)?.[0] ?? NaN);
  if (!Number.isInteger(numeric) || numeric < 10 || numeric > 21) {
    throw new HttpsError("invalid-argument", "예약시간을 확인해주세요.");
  }
  return numeric;
}
function optionalHour(value: unknown): number | null {
  try { return hourValue(value); } catch (_ignore) { return null; }
}
function roomValue(value: unknown): string {
  const room = text(value, 80);
  if (!ROOMS.has(room)) throw new HttpsError("invalid-argument", "연습실을 확인해주세요.");
  return room;
}
function roleValue(value: unknown): Caller["role"] | "" {
  const key = normalize(value);
  if (key === "student") return "student";
  if (key === "teacher") return "teacher";
  if (key === "admin") return "admin";
  if (["superadmin", "전체관리자", "전체관리", "원장"].includes(key)) return "superAdmin";
  return "";
}
function authVersion(value: unknown): string {
  return text(value, 120).normalize("NFKC").trim().toLowerCase();
}
function activeStudentStatus(value: unknown): boolean {
  const key = normalize(value);
  return !["withdrawn", "퇴원", "inactive", "disabled", "deleted"].includes(key);
}
function slotText(startHour: number): string {
  return `${String(startHour).padStart(2, "0")}:00~${String(startHour + 1).padStart(2, "0")}:00`;
}
function slotKey(date: string, room: string, startHour: number): string {
  return `ROOM_${date.replace(/-/g, "")}_${startHour}_${hash(room).slice(0, 20)}`;
}
function hourText(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
function parseTimeRange(value: unknown): { startHour: number; endHour: number } {
  const match = text(value, 100).match(/(\d{1,2})(?::\d{2})?\s*[~\-]\s*(\d{1,2})(?::\d{2})?/);
  if (!match) throw new HttpsError("invalid-argument", "변경 시간을 15:00~16:00 형식으로 입력해주세요.");
  const startHour = hourValue(Number(match[1]));
  const endHour = Number(match[2]);
  if (!Number.isInteger(endHour) || endHour <= startHour || endHour > 22) {
    throw new HttpsError("invalid-argument", "변경 종료시간을 확인해주세요.");
  }
  return { startHour, endHour };
}
function statusKey(value: unknown): string {
  return normalize(value);
}
function isCancelled(value: unknown): boolean {
  return ["취소", "cancelled", "canceled"].includes(statusKey(value));
}
function isUnavailable(value: unknown): boolean {
  return ["사용불가", "관리자차단", "unavailable"].includes(statusKey(value));
}
function occupiesReservation(data: Pick<CanonicalReservation, "status" | "canonicalStatus" | "active">): boolean {
  if (isCancelled(data.status) || isUnavailable(data.status)) return false;
  if (["cancelled", "unavailable"].includes(normalize(data.canonicalStatus))) return false;
  return data.active !== false;
}
function firstArrayText(value: unknown): string {
  return Array.isArray(value) ? text(value.find(Boolean), 180) : "";
}

async function requireCaller(request: CallableRequest<unknown>): Promise<Caller> {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인 후 이용해주세요.");
  const firebaseUid = text(request.auth.uid, 128);
  const claimRole = roleValue(request.auth.token.role);
  if (!claimRole) throw new HttpsError("permission-denied", "이용 권한을 확인해주세요.");

  const userSnapshot = await db().collection("users").doc(firebaseUid).get();
  const user = userSnapshot.data() ?? {};
  if (!userSnapshot.exists || user.active === false) throw new HttpsError("permission-denied", "현재 이용 가능한 계정이 아닙니다.");
  const storedRole = roleValue(user.role);
  if (storedRole !== claimRole) throw new HttpsError("permission-denied", "계정 권한을 다시 확인해주세요.");
  const claimVersion = authVersion(request.auth.token.authVersion);
  const storedVersion = authVersion(user.authVersion);
  if (claimVersion && storedVersion && claimVersion !== storedVersion) {
    throw new HttpsError("unauthenticated", "로그인 정보가 갱신되었습니다. 다시 로그인해주세요.");
  }

  const studentUid = text(request.auth.token.studentUid ?? user.studentUid, 128);
  const teacherUid = text(request.auth.token.teacherUid ?? user.teacherUid, 128);
  let displayName = text(user.name ?? user.displayName ?? user.adminName ?? user.instructorName, 120) || "이용자";
  let classId = text(user.classId, 128);
  let instructorName = text(user.instructorName, 120);

  if (claimRole === "student") {
    if (!studentUid) throw new HttpsError("permission-denied", "학생 연결정보를 확인해주세요.");
    const studentSnapshot = await db().collection("students").doc(studentUid).get();
    const student = studentSnapshot.data() ?? {};
    if (!studentSnapshot.exists || student.deleted === true || !activeStudentStatus(student.enrollmentStatus ?? student.status)) {
      throw new HttpsError("permission-denied", "현재 이용 가능한 학생정보가 없습니다.");
    }
    displayName = text(student.name ?? student.studentName, 120) || displayName;
    classId = text(student.classId, 128) || firstArrayText(student.selectedClassIds ?? student.classIds);
    instructorName = text(student.instructorName ?? student.instructor, 120) || firstArrayText(student.instructorNames);
  }

  return { firebaseUid, role: claimRole, studentUid, teacherUid, displayName, classId, instructorName, user };
}
async function requireAdmin(request: CallableRequest<unknown>): Promise<Caller> {
  const caller = await requireCaller(request);
  if (caller.role !== "admin" && caller.role !== "superAdmin") throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
  return caller;
}

function normalizeReservation(raw: DocumentData, docId = ""): CanonicalReservation | null {
  const date = text(raw.date ?? raw.reserveDate, 10);
  const room = text(raw.room ?? raw.roomName ?? raw.practiceRoom, 80);
  const slot = text(raw.slot ?? raw.time ?? raw.timeText ?? raw.reservationTime, 80);
  const startHour = optionalHour(raw.startHour ?? raw.startTime ?? slot);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !ROOMS.has(room) || startHour === null) return null;
  const endHour = optionalHour(raw.endHour ?? raw.endTime) ?? startHour + 1;
  const reservationId = text(docId, 180) || text(raw.reservationId ?? raw.id ?? raw.rowId, 180) || `ROOM_${hash(date, room, startHour).slice(0, 40)}`;
  const status = text(raw.status, 40) || "예약";
  return {
    reservationId,
    date,
    month: text(raw.month, 7) || monthFromDate(date),
    room,
    slot: slot || slotText(startHour),
    startHour,
    endHour,
    status,
    canonicalStatus: text(raw.canonicalStatus, 40) || (isCancelled(status) ? "cancelled" : isUnavailable(status) ? "unavailable" : "pending"),
    active: raw.active !== false && !isCancelled(status),
    studentUid: text(raw.studentUid, 128),
    studentName: text(raw.studentName ?? raw.privateName ?? raw.displayName ?? raw.name, 120),
    phoneLast4: text(raw.phoneLast4 ?? raw.phoneSuffix, 8),
    studentPhone: text(raw.studentPhone ?? raw.phone, 40),
    parentPhone: text(raw.parentPhone ?? raw.guardianPhone, 40),
    actorFirebaseUid: text(raw.actorFirebaseUid ?? raw.firebaseUid, 128),
    actorType: text(raw.actorType, 30),
    instructorName: text(raw.instructorName ?? raw.instructor, 120),
    classId: text(raw.classId, 128),
    memo: text(raw.memo ?? raw.note ?? raw.reason, 500),
    source: text(raw.source, 120),
    legacy: raw.legacy === true,
    raw
  };
}
function normalizeSnapshot(doc: QueryDocumentSnapshot<DocumentData>): CanonicalReservation | null {
  return normalizeReservation(doc.data(), doc.id);
}
function slotIdentity(row: Pick<CanonicalReservation, "date" | "room" | "startHour">): string {
  return `${row.date}|${row.room}|${row.startHour}`;
}
function legacyRow(raw: unknown, index: number): CanonicalReservation | null {
  const row = object(raw);
  const normalized = normalizeReservation({ ...row, legacy: true }, text(row.id ?? row.reservationId ?? row.rowId, 180) || `LEGACY_${index}_${hash(JSON.stringify(row)).slice(0, 30)}`);
  return normalized ? { ...normalized, legacy: true } : null;
}

async function enrichLegacy(rows: CanonicalReservation[]): Promise<CanonicalReservation[]> {
  if (!rows.length) return rows;
  const [studentsSnapshot, contactsSnapshot] = await Promise.all([
    db().collection("students").limit(3000).get(),
    db().collection("studentPrivateContacts").limit(3000).get()
  ]);
  const contactByUid = new Map<string, DocumentData>();
  contactsSnapshot.docs.forEach(doc => contactByUid.set(doc.id, doc.data()));
  const byVisibleCredential = new Map<string, string[]>();
  studentsSnapshot.docs.forEach(doc => {
    const student = doc.data();
    if (student.deleted === true || !activeStudentStatus(student.enrollmentStatus ?? student.status)) return;
    const contact = contactByUid.get(doc.id) ?? {};
    const name = normalize(student.name ?? student.studentName);
    const phone = digits(contact.phone ?? contact.studentPhone ?? student.studentPhone ?? student.phone).slice(-4);
    if (!name || phone.length !== 4) return;
    const key = `${name}|${phone}`;
    const list = byVisibleCredential.get(key) ?? [];
    list.push(doc.id);
    byVisibleCredential.set(key, list);
  });
  return rows.map(row => {
    if (row.studentUid) return row;
    const key = `${normalize(row.studentName)}|${digits(row.phoneLast4 || row.studentPhone).slice(-4)}`;
    const hits = byVisibleCredential.get(key) ?? [];
    return hits.length === 1 ? { ...row, studentUid: hits[0] } : row;
  });
}

async function ensureLegacyMonth(month: string): Promise<DocumentData> {
  const legacyRef = db().collection(LEGACY_MONTHS).doc(month);
  const existing = await legacyRef.get();
  if (existing.exists) return existing.data() ?? {};

  const realtimeSnapshot = await db().collection(REALTIME_MONTHS).doc(month).get();
  const realtime = realtimeSnapshot.data() ?? {};
  const legacyRows = (Array.isArray(realtime.reservations) ? realtime.reservations : [])
    .map(legacyRow)
    .filter((row): row is CanonicalReservation => !!row && row.month === month);
  const enriched = await enrichLegacy(legacyRows);
  const blockedSlots = (Array.isArray(realtime.blockedSlots) ? realtime.blockedSlots : [])
    .map((raw: unknown) => {
      const row = object(raw);
      const date = text(row.date, 10);
      const room = text(row.room ?? row.roomName, 80);
      const startHour = optionalHour(row.startHour ?? row.startTime ?? row.slot ?? row.time);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !ROOMS.has(room) || startHour === null || monthFromDate(date) !== month) return null;
      return { date, room, startHour, endHour: startHour + 1, reason: text(row.reason ?? row.status, 120) || "수업중" };
    })
    .filter(Boolean);

  const data = {
    month,
    reservations: enriched.map(row => row.raw && Object.keys(row.raw).length ? { ...row.raw, ...row } : row),
    blockedSlots,
    suppressedReservationIds: [],
    capturedAtMs: Date.now(),
    capturedAt: FieldValue.serverTimestamp(),
    source: "realtimeRoomMonths-cutover-7355033",
    version: VERSION
  };
  try {
    await legacyRef.create(data);
    return data;
  } catch (_error) {
    const raced = await legacyRef.get();
    return raced.data() ?? data;
  }
}
function suppressedLegacyIds(legacy: DocumentData): Set<string> {
  return new Set((Array.isArray(legacy.suppressedReservationIds) ? legacy.suppressedReservationIds : []).map(value => text(value, 180)).filter(Boolean));
}
function activeLegacyRows(legacy: DocumentData): CanonicalReservation[] {
  const suppressed = suppressedLegacyIds(legacy);
  return (Array.isArray(legacy.reservations) ? legacy.reservations : [])
    .map(legacyRow)
    .filter((row): row is CanonicalReservation => !!row && !suppressed.has(row.reservationId) && !isCancelled(row.status));
}
function legacyBlockedRows(legacy: DocumentData): PlainObject[] {
  return (Array.isArray(legacy.blockedSlots) ? legacy.blockedSlots : []).map(object);
}
function legacyConflict(legacy: DocumentData, date: string, room: string, startHour: number, excludeReservationId = ""): boolean {
  return activeLegacyRows(legacy).some(row => row.reservationId !== excludeReservationId && row.date === date && row.room === room && row.startHour === startHour && !isUnavailable(row.status));
}
function legacyConflictExcluding7355036(legacy: DocumentData, date: string, room: string, startHour: number, excludeReservationIds: Set<string>): boolean {
  return activeLegacyRows(legacy).some(row => !excludeReservationIds.has(row.reservationId) && row.date === date && row.room === room && row.startHour === startHour && !isUnavailable(row.status));
}
function legacyBlockedConflict(legacy: DocumentData, date: string, room: string, startHour: number): boolean {
  return legacyBlockedRows(legacy).some(row => text(row.date, 10) === date && text(row.room, 80) === room && Number(row.startHour) === startHour);
}

async function queryCanonicalMonth(month: string): Promise<CanonicalReservation[]> {
  const start = `${month}-01`;
  const end = nextMonthStart(month);
  const snapshot = await db().collection(RESERVATIONS)
    .where("date", ">=", start)
    .where("date", "<", end)
    .limit(3000)
    .get();
  return snapshot.docs.map(normalizeSnapshot).filter((row): row is CanonicalReservation => !!row);
}
async function queryCanonicalSlot(date: string, room: string, startHour: number): Promise<CanonicalReservation[]> {
  // Avoid a new composite-index dependency during the cutover. Date has an automatic
  // single-field index; the small date slice is filtered in memory for room/hour.
  const snapshot = await db().collection(RESERVATIONS)
    .where("date", "==", date)
    .limit(3000)
    .get();
  return snapshot.docs
    .map(normalizeSnapshot)
    .filter((row): row is CanonicalReservation => !!row && row.room === room && row.startHour === startHour);
}
function mergeMonthReservations(canonical: CanonicalReservation[], legacy: CanonicalReservation[]): CanonicalReservation[] {
  const bySlot = new Map<string, CanonicalReservation>();
  legacy.forEach(row => bySlot.set(slotIdentity(row), row));
  canonical.forEach(row => {
    const key = slotIdentity(row);
    const old = bySlot.get(key);
    if (old) {
      bySlot.set(key, {
        ...old,
        ...row,
        studentUid: row.studentUid || old.studentUid,
        studentName: row.studentName || old.studentName,
        phoneLast4: row.phoneLast4 || old.phoneLast4,
        instructorName: row.instructorName || old.instructorName,
        legacy: false
      });
    } else {
      bySlot.set(key, row);
    }
  });
  return Array.from(bySlot.values()).sort((a, b) => `${a.date}|${a.startHour}|${a.room}`.localeCompare(`${b.date}|${b.startHour}|${b.room}`, "ko"));
}
async function readAvailabilityMonth(month: string): Promise<PlainObject[]> {
  const start = `${month}-01`;
  const end = nextMonthStart(month);
  const snapshot = await db().collection(AVAILABILITY)
    .where("date", ">=", start)
    .where("date", "<", end)
    .limit(3000)
    .get();
  return snapshot.docs.map(doc => ({ slotId: doc.id, ...doc.data() }));
}
async function monthState(month: string): Promise<{ legacy: DocumentData; reservations: CanonicalReservation[]; availability: PlainObject[] }> {
  const legacy = await ensureLegacyMonth(month);
  const [canonical, availability] = await Promise.all([queryCanonicalMonth(month), readAvailabilityMonth(month)]);
  return { legacy, reservations: mergeMonthReservations(canonical, activeLegacyRows(legacy)), availability };
}

function isMine(row: CanonicalReservation, caller: Caller): boolean {
  if (caller.role === "student") return !!caller.studentUid && row.studentUid === caller.studentUid;
  return !!row.actorFirebaseUid && row.actorFirebaseUid === caller.firebaseUid;
}
function publicReservation(row: CanonicalReservation, caller: Caller): PlainObject {
  const mine = isMine(row, caller);
  const base: PlainObject = {
    id: row.reservationId,
    reservationId: row.reservationId,
    date: row.date,
    room: row.room,
    startHour: row.startHour,
    endHour: row.endHour,
    status: isUnavailable(row.status) ? "관리자차단" : row.status,
    pending: false,
    mine
  };
  if (mine) {
    base.studentName = row.studentName || caller.displayName;
    base.instructorName = row.instructorName;
    base.actorType = row.actorType || caller.role;
  }
  return base;
}
function adminReservation(row: CanonicalReservation, contacts: Map<string, DocumentData>): PlainObject {
  const contact = row.studentUid ? (contacts.get(row.studentUid) ?? {}) : {};
  const studentPhone = text(row.studentPhone || contact.studentPhone || contact.phone, 40);
  const parentPhone = text(row.parentPhone || contact.parentPhone || contact.guardianPhone, 40);
  const phoneLast4 = text(row.phoneLast4, 8) || digits(studentPhone).slice(-4);
  return {
    id: row.reservationId,
    reservationId: row.reservationId,
    date: row.date,
    room: row.room,
    startHour: row.startHour,
    endHour: row.endHour,
    slot: row.slot,
    time: row.slot,
    status: row.status,
    memo: row.memo,
    studentUid: row.studentUid,
    studentName: row.studentName,
    phoneLast4,
    studentPhone,
    parentPhone,
    instructorName: row.instructorName,
    actorType: row.actorType,
    classId: row.classId,
    source: row.source
  };
}
async function hydrateContacts(rows: CanonicalReservation[]): Promise<Map<string, DocumentData>> {
  const uids = Array.from(new Set(rows.map(row => row.studentUid).filter(Boolean)));
  const map = new Map<string, DocumentData>();
  if (!uids.length) return map;

  const snapshots = await Promise.all(uids.map(async uid => {
    const [privateSnapshot, studentSnapshot] = await Promise.all([
      db().collection("studentPrivateContacts").doc(uid).get(),
      db().collection("students").doc(uid).get()
    ]);
    return {
      uid,
      student: studentSnapshot.exists ? (studentSnapshot.data() ?? {}) : {},
      privateContact: privateSnapshot.exists ? (privateSnapshot.data() ?? {}) : {}
    };
  }));

  snapshots.forEach(item => {
    map.set(item.uid, { ...item.student, ...item.privateContact });
  });
  return map;
}
function blockedSlotsForPublic(state: { legacy: DocumentData; reservations: CanonicalReservation[]; availability: PlainObject[] }): PlainObject[] {
  const map = new Map<string, PlainObject>();
  legacyBlockedRows(state.legacy).forEach(row => {
    const date = text(row.date, 10); const room = text(row.room, 80); const startHour = Number(row.startHour);
    if (!date || !room || !Number.isInteger(startHour)) return;
    map.set(`${date}|${room}|${startHour}`, { date, room, startHour, endHour: startHour + 1, reason: text(row.reason, 120) || "수업중" });
  });
  state.availability.forEach(row => {
    if (row.active !== true || row.blocked !== true) return;
    const date = text(row.date, 10); const room = text(row.room, 80); const startHour = Number(row.startHour);
    if (!date || !room || !Number.isInteger(startHour)) return;
    map.set(`${date}|${room}|${startHour}`, { date, room, startHour, endHour: startHour + 1, reason: text(row.reason, 120) || "사용불가" });
  });
  return Array.from(map.values());
}
function occupancyRealtimeReservation(row: CanonicalReservation): PlainObject {
  return {
    id: row.reservationId,
    reservationId: row.reservationId,
    date: row.date,
    room: row.room,
    startHour: row.startHour,
    endHour: row.endHour,
    status: row.status,
    pending: false
  };
}
async function syncRealtimeMonth(month: string): Promise<void> {
  const state = await monthState(month);
  const reservations = state.reservations.filter(occupiesReservation).map(occupancyRealtimeReservation);
  const blockedSlots = blockedSlotsForPublic(state);
  await db().collection(REALTIME_MONTHS).doc(month).set({
    month,
    reservations,
    blockedSlots,
    revision: Date.now(),
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
    source: "roomReservations-firestore-primary-7355033",
    version: VERSION
  }, { merge: false });
}

async function canonicalConflict(date: string, room: string, startHour: number, excludeReservationId = ""): Promise<boolean> {
  const rows = await queryCanonicalSlot(date, room, startHour);
  return rows.some(row => row.reservationId !== excludeReservationId && occupiesReservation(row));
}
async function canonicalConflictExcluding7355036(date: string, room: string, startHour: number, excludeReservationIds: Set<string>): Promise<boolean> {
  const rows = await queryCanonicalSlot(date, room, startHour);
  return rows.some(row => !excludeReservationIds.has(row.reservationId) && occupiesReservation(row));
}
function availabilityRef(date: string, room: string, startHour: number) {
  return db().collection(AVAILABILITY).doc(slotKey(date, room, startHour));
}
function requestRef(requestId: string) {
  return db().collection(REQUESTS).doc(safeId(requestId));
}
function requestId(input: PlainObject, prefix: string, caller: Caller): string {
  const supplied = text(input.requestId, 180);
  return supplied || `${prefix}_${hash(caller.firebaseUid, Date.now(), Math.random()).slice(0, 40)}`;
}

async function findLegacyReservation(reservationId: string, preferredDate = ""): Promise<{ month: string; row: CanonicalReservation } | null> {
  const now = new Date();
  const candidates = new Set<string>();
  if (/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) candidates.add(monthFromDate(preferredDate));
  const offsets = [-1, 0, 1, 2];
  offsets.forEach(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    candidates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  });
  for (const month of candidates) {
    const legacy = await ensureLegacyMonth(month);
    const row = activeLegacyRows(legacy).find(item => item.reservationId === reservationId);
    if (row) return { month, row };
  }
  return null;
}
async function suppressLegacy(month: string, reservationId: string): Promise<void> {
  if (!month || !reservationId) return;
  await db().collection(LEGACY_MONTHS).doc(month).set({
    suppressedReservationIds: FieldValue.arrayUnion(reservationId),
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
    version: VERSION
  }, { merge: true });
}

export const getPracticeRoomMonth7355033 = onCall(ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS, async request => {
  const caller = await requireCaller(request);
  const input = object(request.data);
  const month = monthText(input.year, input.month);
  const state = await monthState(month);
  const reservations = state.reservations.filter(occupiesReservation).map(row => publicReservation(row, caller));
  return {
    status: "success",
    ok: true,
    month,
    reservations,
    blockedSlots: blockedSlotsForPublic(state),
    source: "roomReservations-firestore-primary-7355033",
    version: VERSION
  };
});

export const createPracticeRoomReservation7355033 = onCall(ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS, async request => {
  const caller = await requireCaller(request);
  const input = object(request.data);
  const date = dateText(input.date);
  const room = roomValue(input.room);
  const startHour = hourValue(input.startHour);
  const endHour = startHour + 1;
  const month = monthFromDate(date);
  const legacy = await ensureLegacyMonth(month);
  if (legacyBlockedConflict(legacy, date, room, startHour) || legacyConflict(legacy, date, room, startHour)) {
    throw new HttpsError("already-exists", "해당 시간은 이미 사용 중입니다.");
  }
  if (await canonicalConflict(date, room, startHour)) {
    throw new HttpsError("already-exists", "해당 시간은 이미 예약되어 있습니다.");
  }

  const rid = requestId(input, "room-create", caller);
  const reqRef = requestRef(rid);
  const reservationId = `ROOM_${hash(caller.firebaseUid, rid, date, room, startHour).slice(0, 48)}`;
  const reservationRef = db().collection(RESERVATIONS).doc(reservationId);
  const claimRef = availabilityRef(date, room, startHour);
  const now = Date.now();
  const actorType = caller.role === "student" ? "student" : "staff";
  const reservation: DocumentData = {
    reservationId,
    id: reservationId,
    date,
    month,
    room,
    slot: slotText(startHour),
    startHour,
    endHour,
    status: "예약",
    canonicalStatus: "pending",
    active: true,
    actorFirebaseUid: caller.firebaseUid,
    actorType,
    studentUid: caller.role === "student" ? caller.studentUid : "",
    studentName: caller.displayName,
    instructorName: caller.role === "student" ? caller.instructorName : caller.displayName,
    classId: caller.classId,
    memo: "",
    notifyAdminOnCreate: true,
    source: "practice_room_firestore_primary_7355033",
    createdAtMs: now,
    createdAt: FieldValue.serverTimestamp(),
    updatedAtMs: now,
    updatedAt: FieldValue.serverTimestamp(),
    version: VERSION
  };

  const existingResult = await db().runTransaction(async transaction => {
    const reqSnapshot = await transaction.get(reqRef);
    if (reqSnapshot.exists && reqSnapshot.data()?.state === "complete") return object(reqSnapshot.data()?.result);
    const claimSnapshot = await transaction.get(claimRef);
    if (claimSnapshot.exists && claimSnapshot.data()?.active === true) {
      throw new HttpsError("already-exists", "해당 시간은 이미 예약되어 있습니다.");
    }
    transaction.create(reservationRef, reservation);
    transaction.set(claimRef, {
      slotId: claimRef.id,
      date,
      month,
      room,
      slot: slotText(startHour),
      startHour,
      endHour,
      active: true,
      occupied: true,
      blocked: false,
      status: "reserved",
      reservationId,
      source: "practice_room_firestore_primary_7355033",
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      version: VERSION
    }, { merge: false });
    const result = { status: "success", ok: true, reservation: publicReservation(normalizeReservation(reservation, reservationId) as CanonicalReservation, caller), version: VERSION };
    transaction.set(reqRef, {
      requestId: rid,
      state: "complete",
      kind: "create",
      actorFirebaseUid: caller.firebaseUid,
      result,
      completedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      version: VERSION
    }, { merge: false });
    return result;
  });

  await syncRealtimeMonth(month);
  return existingResult;
});


function reservationIds7355036(input: PlainObject): string[] {
  const ids = Array.isArray(input.reservationIds)
    ? input.reservationIds.map(value => text(value, 180)).filter(Boolean)
    : [];
  const single = text(input.reservationId, 180);
  if (single) ids.unshift(single);
  return Array.from(new Set(ids)).slice(0, 12);
}

async function loadReservationForMutation7355036(reservationId: string, preferredDate = ""): Promise<{
  row: CanonicalReservation;
  directRef: DocumentReference<DocumentData>;
  directExists: boolean;
  legacyMonth: string;
  legacyReservationId: string;
}> {
  const directRef = db().collection(RESERVATIONS).doc(safeId(reservationId));
  const directSnapshot = await directRef.get();
  if (directSnapshot.exists) {
    const row = normalizeReservation(directSnapshot.data() ?? {}, directSnapshot.id);
    if (!row) throw new HttpsError("failed-precondition", "예약정보를 확인해주세요.");
    return { row, directRef, directExists: true, legacyMonth: "", legacyReservationId: "" };
  }
  const legacyFound = await findLegacyReservation(reservationId, preferredDate);
  if (!legacyFound) throw new HttpsError("not-found", "예약정보를 찾지 못했습니다.");
  return {
    row: legacyFound.row,
    directRef,
    directExists: false,
    legacyMonth: legacyFound.month,
    legacyReservationId: legacyFound.row.reservationId
  };
}

async function ensureReservationOwnedForCancel7355036(
  caller: Caller,
  loaded: Awaited<ReturnType<typeof loadReservationForMutation7355036>>
): Promise<CanonicalReservation> {
  let row = loaded.row;
  if (caller.role === "student" && row.studentUid !== caller.studentUid) {
    if (!row.studentUid) {
      const legacy = await ensureLegacyMonth(row.month);
      const match = activeLegacyRows(legacy).find(item => slotIdentity(item) === slotIdentity(row));
      if (match?.studentUid) {
        row = {
          ...row,
          studentUid: match.studentUid,
          studentName: row.studentName || match.studentName
        };
      }
    }
    if (!caller.studentUid || row.studentUid !== caller.studentUid) {
      throw new HttpsError("permission-denied", "본인 예약만 취소할 수 있습니다.");
    }
  }
  if (caller.role !== "student" && row.actorFirebaseUid !== caller.firebaseUid) {
    throw new HttpsError("permission-denied", "본인 예약만 취소할 수 있습니다.");
  }
  return row;
}

export const cancelPracticeRoomReservation7355033 = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async request => {
    const caller = await requireCaller(request);
    const input = object(request.data);
    const ids = reservationIds7355036(input);
    if (!ids.length) throw new HttpsError("invalid-argument", "예약정보를 확인해주세요.");

    const preferredDate = text(input.date, 10);
    const months = new Set<string>();
    const cancelled: PlainObject[] = [];

    for (let index = 0; index < ids.length; index += 1) {
      const reservationId = ids[index];
      const loaded = await loadReservationForMutation7355036(reservationId, preferredDate);
      const row = await ensureReservationOwnedForCancel7355036(caller, loaded);
      months.add(row.month);

      if (isCancelled(row.status)) {
        cancelled.push({ reservationId, alreadyCancelled: true });
        continue;
      }

      if (!loaded.directExists) {
        await suppressLegacy(loaded.legacyMonth, loaded.legacyReservationId || reservationId);
        cancelled.push({ reservationId, legacy: true });
        continue;
      }

      const ridBase = text(input.requestId, 180);
      const rid = ridBase
        ? `${ridBase}_${index}_${hash(reservationId).slice(0, 8)}`
        : requestId({}, "room-cancel", caller);
      const reqRef = requestRef(rid);
      const claimRef = availabilityRef(row.date, row.room, row.startHour);
      const now = Date.now();

      await db().runTransaction(async transaction => {
        const reqSnapshot = await transaction.get(reqRef);
        if (reqSnapshot.exists && reqSnapshot.data()?.state === "complete") return;

        const reservationSnapshot = await transaction.get(loaded.directRef);
        const claimSnapshot = await transaction.get(claimRef);

        if (reservationSnapshot.exists) {
          transaction.set(loaded.directRef, {
            studentUid: row.studentUid,
            status: "취소",
            canonicalStatus: "cancelled",
            active: false,
            notifyAdminOnCreate: false,
            cancelledByFirebaseUid: caller.firebaseUid,
            cancelledAtMs: now,
            cancelledAt: FieldValue.serverTimestamp(),
            updatedAtMs: now,
            updatedAt: FieldValue.serverTimestamp(),
            version: VERSION
          }, { merge: true });
        }

        if (
          claimSnapshot.exists &&
          text(claimSnapshot.data()?.reservationId, 180) === reservationId
        ) {
          transaction.delete(claimRef);
        }

        transaction.set(reqRef, {
          requestId: rid,
          state: "complete",
          kind: ids.length > 1 ? "cancel-group" : "cancel",
          actorFirebaseUid: caller.firebaseUid,
          reservationId,
          completedAtMs: now,
          updatedAt: FieldValue.serverTimestamp(),
          version: VERSION
        }, { merge: false });
      });

      await suppressLegacy(row.month, reservationId);
      cancelled.push({ reservationId });
    }

    for (const month of months) await syncRealtimeMonth(month);

    return {
      status: "success",
      ok: true,
      reservationId: ids[0],
      reservationIds: ids,
      cancelled,
      count: cancelled.length,
      grouped: ids.length > 1,
      version: VERSION
    };
  }
);

export const listPracticeRoomReservationsAdmin7355033 = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async request => {
    await requireAdmin(request);
    const input = object(request.data);
    const rawDate = text(input.date, 10);
    let date = "";
    let month = "";

    if (rawDate) {
      date = dateText(rawDate);
      month = monthFromDate(date);
    } else {
      const rawMonth = text(input.month, 7);
      if (/^\d{4}-\d{2}$/.test(rawMonth)) {
        month = rawMonth;
      } else {
        month = monthText(input.year, input.monthNumber ?? input.month);
      }
    }

    const state = await monthState(month);
    const rows = state.reservations.filter(
      row => (!date || row.date === date) && !isCancelled(row.status)
    );
    const contacts = await hydrateContacts(rows);
    const reservations = rows.map(row => adminReservation(row, contacts));

    return {
      status: "success",
      ok: true,
      date,
      month,
      reservations,
      records: reservations,
      count: reservations.length,
      source: "roomReservations-firestore-primary-7355036-admin-month",
      version: VERSION
    };
  }
);

function sameReservationGroup7355036(rows: CanonicalReservation[]): boolean {
  if (rows.length < 2) return true;
  const sorted = rows.slice().sort((a, b) => a.startHour - b.startHour);
  const first = sorted[0];
  const identity = first.studentUid || `${first.studentName}|${first.actorFirebaseUid}`;

  return sorted.every((row, index) => {
    const rowIdentity = row.studentUid || `${row.studentName}|${row.actorFirebaseUid}`;
    if (
      rowIdentity !== identity ||
      row.date !== first.date ||
      row.room !== first.room
    ) {
      return false;
    }
    if (index === 0) return true;
    return row.startHour === sorted[index - 1].endHour;
  });
}

async function queuePracticeRoomDecisionNotification7355036(
  caller: Caller,
  rows: CanonicalReservation[],
  action: string,
  input: PlainObject,
  rid: string,
  oldDate: string,
  oldRoom: string,
  oldStartHour: number,
  oldEndHour: number,
  nextDate: string,
  nextRoom: string,
  nextStartHour: number,
  nextEndHour: number
): Promise<PlainObject> {
  const rawTargets = Array.isArray(input.targets) ? input.targets : [];
  const targets = Array.from(new Set(
    rawTargets.map(value => {
      const key = text(value, 30).toLowerCase();
      if (key === "학부모" || key === "parent") return "parent";
      if (key === "학생" || key === "student") return "student";
      return "";
    }).filter(Boolean)
  ));

  if (!targets.length || !rows.length) {
    return { requested: false, ok: true, queued: false, sent: 0 };
  }

  const contacts = await hydrateContacts(rows);
  const firstPublic = adminReservation(rows[0], contacts);
  const oldTime = `${hourText(oldStartHour)}~${hourText(oldEndHour)}`;
  const newTime = `${hourText(nextStartHour)}~${hourText(nextEndHour)}`;
  const variables: PlainObject = {
    studentName: rows[0].studentName,
    date: oldDate,
    time: oldTime,
    roomName: oldRoom,
    reason: text(input.reason, 500),
    doorPassword: text(input.doorPassword, 100),
    newDate: nextDate,
    newTime,
    newRoom: nextRoom,
    "학생명": rows[0].studentName,
    "예약일": oldDate,
    "예약시간": oldTime,
    "연습실": oldRoom,
    "사용불가사유": text(input.reason, 500),
    "현관비밀번호": text(input.doorPassword, 100),
    "변경일": nextDate,
    "변경시간": newTime,
    "변경연습실": nextRoom
  };

  const messageType =
    action === "confirm"
      ? "room_confirm"
      : action === "change"
        ? "room_change"
        : "room_unavailable";

  const reservationIds = rows.map(row => row.reservationId);
  const jobId =
    `ROOMMSG_${hash(
      messageType,
      rid,
      reservationIds.join("|"),
      nextDate,
      nextRoom,
      nextStartHour
    ).slice(0, 56)}`;

  const ref = db().collection(DECISION_NOTIFICATION_JOBS).doc(jobId);
  const now = Date.now();

  await db().runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data() ?? {};
    const currentState = text(current.state, 30);
    if (
      ["pending", "processing", "complete", "permanent_failed", "delivery_unknown"]
        .includes(currentState)
    ) {
      return;
    }

    transaction.set(ref, {
      jobId,
      state: "pending",
      attempts: Number(current.attempts || 0),
      messageType,
      actionType: action,
      reservationIds,
      studentUid: rows[0].studentUid,
      studentName: rows[0].studentName,
      studentPhone: text(firstPublic.studentPhone, 60),
      parentPhone: text(firstPublic.parentPhone, 60),
      targets,
      variables,
      actorFirebaseUid: caller.firebaseUid,
      actorRole: caller.role,
      actorTeacherUid: caller.teacherUid,
      actorName: caller.displayName,
      decisionRequestId: rid,
      sheetBackupState: "pending_0600",
      createdAtMs: Number(current.createdAtMs || now),
      createdAt: current.createdAt || FieldValue.serverTimestamp(),
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      version: VERSION
    }, { merge: true });
  });

  return {
    requested: true,
    ok: true,
    queued: true,
    sent: 0,
    jobId
  };
}

export const decidePracticeRoomReservationAdmin7355033 = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async request => {
    const caller = await requireAdmin(request);
    const input = object(request.data);
    const action = text(input.actionType, 30);
    const ids = reservationIds7355036(input);

    if (!ids.length || !["confirm", "unavailable", "change"].includes(action)) {
      throw new HttpsError("invalid-argument", "예약 처리정보를 확인해주세요.");
    }

    const preferredDate = text(input.newDate, 10) || text(input.date, 10);
    const loadedRows = await Promise.all(
      ids.map(id => loadReservationForMutation7355036(id, preferredDate))
    );
    const sortedLoaded = loadedRows.slice().sort((a, b) => {
      const ak =
        `${a.row.date}|${a.row.room}|${String(a.row.startHour).padStart(2, "0")}`;
      const bk =
        `${b.row.date}|${b.row.room}|${String(b.row.startHour).padStart(2, "0")}`;
      return ak.localeCompare(bk, "ko");
    });
    const rows = sortedLoaded.map(item => item.row);

    if (!sameReservationGroup7355036(rows)) {
      throw new HttpsError(
        "invalid-argument",
        "연속된 동일 학생·동일 연습실 예약만 한 번에 처리할 수 있습니다."
      );
    }

    const first = rows[0];
    const last = rows[rows.length - 1];
    const oldDate = first.date;
    const oldRoom = first.room;
    const oldStartHour = first.startHour;
    const oldEndHour = last.endHour;

    let nextDate = oldDate;
    let nextRoom = oldRoom;
    let nextStartHour = oldStartHour;
    let nextEndHour = oldEndHour;

    if (action === "change") {
      nextDate = dateText(input.newDate);
      nextRoom = roomValue(input.newRoom);
      const range = parseTimeRange(input.newTime);
      if (range.endHour - range.startHour !== rows.length) {
        throw new HttpsError(
          "invalid-argument",
          `연속 ${rows.length}시간 예약은 변경 시간도 ${rows.length}시간으로 입력해주세요.`
        );
      }
      nextStartHour = range.startHour;
      nextEndHour = range.endHour;
    }

    const excludeIds = new Set(rows.map(row => row.reservationId));
    if (action === "change") {
      const nextLegacy = await ensureLegacyMonth(monthFromDate(nextDate));
      for (let offset = 0; offset < rows.length; offset += 1) {
        const nextHour = nextStartHour + offset;
        if (
          legacyBlockedConflict(nextLegacy, nextDate, nextRoom, nextHour) ||
          legacyConflictExcluding7355036(
            nextLegacy,
            nextDate,
            nextRoom,
            nextHour,
            excludeIds
          )
        ) {
          throw new HttpsError(
            "already-exists",
            "변경하려는 시간 중 이미 사용 중인 시간이 있습니다."
          );
        }
        if (
          await canonicalConflictExcluding7355036(
            nextDate,
            nextRoom,
            nextHour,
            excludeIds
          )
        ) {
          throw new HttpsError(
            "already-exists",
            "변경하려는 시간 중 이미 예약된 시간이 있습니다."
          );
        }
      }
    }

    const rid = requestId(input, "room-admin-decision-group", caller);
    const reqRef = requestRef(rid);
    const now = Date.now();
    const status =
      action === "confirm"
        ? "예약확정"
        : action === "change"
          ? "변경확정"
          : "사용불가";
    const canonicalStatus =
      action === "confirm"
        ? "confirmed"
        : action === "change"
          ? "changed"
          : "unavailable";
    const touchedMonths = new Set<string>();

    const transactionResult = await db().runTransaction(async transaction => {
      const reqSnapshot = await transaction.get(reqRef);
      if (reqSnapshot.exists && reqSnapshot.data()?.state === "complete") {
        return {
          duplicate: true,
          result: object(reqSnapshot.data()?.result)
        };
      }

      const snapshots: Array<{
        loaded: typeof sortedLoaded[number];
        oldClaimRef: DocumentReference<DocumentData>;
        nextClaimRef: DocumentReference<DocumentData>;
        directSnapshot: DocumentSnapshot<DocumentData>;
        oldClaimSnapshot: DocumentSnapshot<DocumentData>;
        nextClaimSnapshot: DocumentSnapshot<DocumentData>;
        nextHour: number;
        nextMonth: string;
      }> = [];

      for (let index = 0; index < sortedLoaded.length; index += 1) {
        const loaded = sortedLoaded[index];
        const row = loaded.row;
        const nextHour =
          action === "change" ? nextStartHour + index : row.startHour;
        const rowNextDate = action === "change" ? nextDate : row.date;
        const rowNextRoom = action === "change" ? nextRoom : row.room;
        const nextMonth = monthFromDate(rowNextDate);
        const oldClaimRef = availabilityRef(
          row.date,
          row.room,
          row.startHour
        );
        const nextClaimRef = availabilityRef(
          rowNextDate,
          rowNextRoom,
          nextHour
        );

        const directSnapshot = await transaction.get(loaded.directRef);
        const oldClaimSnapshot = await transaction.get(oldClaimRef);
        const nextClaimSnapshot =
          oldClaimRef.path === nextClaimRef.path
            ? oldClaimSnapshot
            : await transaction.get(nextClaimRef);

        if (
          nextClaimSnapshot.exists &&
          nextClaimSnapshot.data()?.active === true
        ) {
          const existingId = text(
            nextClaimSnapshot.data()?.reservationId,
            180
          );
          if (!existingId || !excludeIds.has(existingId)) {
            throw new HttpsError(
              "already-exists",
              "해당 시간은 이미 예약되어 있습니다."
            );
          }
        }

        snapshots.push({
          loaded,
          oldClaimRef,
          nextClaimRef,
          directSnapshot,
          oldClaimSnapshot,
          nextClaimSnapshot,
          nextHour,
          nextMonth
        });
      }

      // Reservation documents first. Claim moves are handled in two phases below so
      // overlapping moves such as 10~12 -> 11~13 cannot delete a newly written claim.
      for (const item of snapshots) {
        const row = item.loaded.row;
        const rowNextDate = action === "change" ? nextDate : row.date;
        const rowNextRoom = action === "change" ? nextRoom : row.room;
        const baseDocument: DocumentData = {
          ...row.raw,
          reservationId: row.reservationId,
          id: row.reservationId,
          date: rowNextDate,
          month: item.nextMonth,
          room: rowNextRoom,
          slot: slotText(item.nextHour),
          startHour: item.nextHour,
          endHour: item.nextHour + 1,
          status,
          canonicalStatus,
          active: action !== "unavailable",
          actorFirebaseUid: row.actorFirebaseUid,
          actorType:
            row.actorType || (row.studentUid ? "student" : "staff"),
          studentUid: row.studentUid,
          studentName: row.studentName,
          instructorName: row.instructorName,
          classId: row.classId,
          reason: text(input.reason, 500),
          memo: text(input.reason, 500) || row.memo,
          doorPasswordProvided: !!text(input.doorPassword, 100),
          notifyAdminOnCreate: false,
          decisionByFirebaseUid: caller.firebaseUid,
          decisionByName: caller.displayName,
          decisionAtMs: now,
          decisionAt: FieldValue.serverTimestamp(),
          updatedAtMs: now,
          updatedAt: FieldValue.serverTimestamp(),
          source:
            row.source || "practice_room_firestore_primary_7355033",
          version: VERSION
        };

        if (!item.directSnapshot.exists) {
          transaction.create(item.loaded.directRef, baseDocument);
        } else {
          transaction.set(
            item.loaded.directRef,
            baseDocument,
            { merge: true }
          );
        }
      }

      // Delete every old claim before writing any destination claim.
      for (const item of snapshots) {
        const row = item.loaded.row;
        if (
          item.oldClaimRef.path !== item.nextClaimRef.path &&
          item.oldClaimSnapshot.exists &&
          text(item.oldClaimSnapshot.data()?.reservationId, 180) ===
            row.reservationId
        ) {
          transaction.delete(item.oldClaimRef);
        }
      }

      // Write destination claims only after all old claims have been removed.
      for (const item of snapshots) {
        const row = item.loaded.row;
        const rowNextDate = action === "change" ? nextDate : row.date;
        const rowNextRoom = action === "change" ? nextRoom : row.room;
        if (action === "unavailable") {
          transaction.set(item.nextClaimRef, {
            slotId: item.nextClaimRef.id,
            date: rowNextDate,
            month: item.nextMonth,
            room: rowNextRoom,
            slot: slotText(item.nextHour),
            startHour: item.nextHour,
            endHour: item.nextHour + 1,
            active: true,
            occupied: false,
            blocked: true,
            status: "unavailable",
            reason: text(input.reason, 120) || "사용불가",
            reservationId: row.reservationId,
            source: "practice_room_firestore_primary_7355033",
            updatedAtMs: now,
            updatedAt: FieldValue.serverTimestamp(),
            version: VERSION
          }, { merge: false });
        } else {
          transaction.set(item.nextClaimRef, {
            slotId: item.nextClaimRef.id,
            date: rowNextDate,
            month: item.nextMonth,
            room: rowNextRoom,
            slot: slotText(item.nextHour),
            startHour: item.nextHour,
            endHour: item.nextHour + 1,
            active: true,
            occupied: true,
            blocked: false,
            status: canonicalStatus,
            reservationId: row.reservationId,
            source: "practice_room_firestore_primary_7355033",
            updatedAtMs: now,
            updatedAt: FieldValue.serverTimestamp(),
            version: VERSION
          }, { merge: false });
        }
        touchedMonths.add(row.month);
        touchedMonths.add(item.nextMonth);
      }

      const result: PlainObject = {
        status: "success",
        ok: true,
        reservationId: rows[0].reservationId,
        reservationIds: rows.map(row => row.reservationId),
        actionType: action,
        grouped: rows.length > 1,
        count: rows.length,
        version: VERSION
      };

      transaction.set(reqRef, {
        requestId: rid,
        state: "complete",
        kind:
          rows.length > 1
            ? "admin-decision-group"
            : "admin-decision",
        actionType: action,
        actorFirebaseUid: caller.firebaseUid,
        reservationIds: rows.map(row => row.reservationId),
        result,
        completedAtMs: now,
        updatedAt: FieldValue.serverTimestamp(),
        version: VERSION
      }, { merge: false });

      return {
        duplicate: false,
        result
      };
    });

    for (const item of sortedLoaded) {
      if (item.legacyMonth && item.legacyReservationId) {
        await suppressLegacy(
          item.legacyMonth,
          item.legacyReservationId
        );
        touchedMonths.add(item.legacyMonth);
      }
    }

    for (const month of touchedMonths) {
      await syncRealtimeMonth(month);
    }

    const finalSnapshots = await Promise.all(
      sortedLoaded.map(item => item.directRef.get())
    );
    const finalRows = finalSnapshots
      .map(snapshot =>
        normalizeReservation(snapshot.data() ?? {}, snapshot.id)
      )
      .filter((row): row is CanonicalReservation => !!row)
      .sort((a, b) => a.startHour - b.startHour);

    const notification = transactionResult.duplicate
      ? {
          requested:
            Array.isArray(input.targets) &&
            input.targets.length > 0,
          ok: true,
          queued: false,
          duplicate: true,
          sent: 0
        }
      : await queuePracticeRoomDecisionNotification7355036(
          caller,
          finalRows,
          action,
          input,
          rid,
          oldDate,
          oldRoom,
          oldStartHour,
          oldEndHour,
          nextDate,
          nextRoom,
          nextStartHour,
          nextEndHour
        );

    const contacts = await hydrateContacts(finalRows);
    const publicRows = finalRows.map(row =>
      adminReservation(row, contacts)
    );

    return {
      ...transactionResult.result,
      reservations: publicRows,
      reservation:
        publicRows[0] || { reservationId: ids[0] },
      notification,
      version: VERSION
    };
  }
);

async function claimPracticeRoomDecisionNotificationJob7355036(
  ref: DocumentReference<DocumentData>
): Promise<DocumentData | null> {
  return db().runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;

    const data = snapshot.data() ?? {};
    const state = text(data.state, 30);
    const attempts = Number(data.attempts || 0);
    const updatedAtMs = Number(data.updatedAtMs || 0);

    if (
      state === "complete" ||
      state === "permanent_failed" ||
      state === "delivery_unknown"
    ) {
      return null;
    }

    if (
      state === "processing" &&
      Date.now() - updatedAtMs < 5 * 60 * 1000
    ) {
      return null;
    }

    transaction.set(ref, {
      state: "processing",
      attempts: attempts + 1,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
      version: VERSION
    }, { merge: true });

    return {
      ...data,
      attempts: attempts + 1
    };
  });
}

async function processPracticeRoomDecisionNotificationJob7355037(
  ref: DocumentReference<DocumentData>
): Promise<void> {
  const job = await claimPracticeRoomDecisionNotificationJob7355036(ref);
  if (!job) return;

  const attempts = Number(job.attempts || 1);
  try {
    const targets = Array.isArray(job.targets)
      ? job.targets.map(value => text(value, 20)).filter(Boolean)
      : [];
    const studentPhone = text(job.studentPhone, 60);
    const parentPhone = text(job.parentPhone, 60);
    const variables = object(job.variables);

    const recipients: PlainObject[] = targets.map(target => ({
      phone: target === "parent" ? parentPhone : studentPhone,
      studentUid: text(job.studentUid, 160),
      target,
      variables
    })).filter(recipient => digits(recipient.phone).length >= 10);

    if (!recipients.length) {
      await ref.set({
        state: "permanent_failed",
        error: "예약 학생/학부모 연락처를 찾지 못했습니다.",
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp(),
        version: VERSION
      }, { merge: true });
      return;
    }

    const sent = await sendOperationalSolapiMessages7355014(
      text(job.messageType, 40),
      recipients,
      variables,
      {
        firebaseUid:
          text(job.actorFirebaseUid, 160) ||
          "system-practice-room-notification-7355037",
        role: text(job.actorRole, 30) || "superAdmin",
        teacherUid: text(job.actorTeacherUid, 160),
        displayName: text(job.actorName, 120) || "연습실예약관리",
        dispatchKey: `practice-room-decision-job|${ref.id}`
      }
    );

    await ref.set({
      state: "complete",
      sent: Number(sent.sent || 0),
      deliveryId: text(sent.deliveryId, 200),
      result: sent,
      completedAtMs: Date.now(),
      completedAt: FieldValue.serverTimestamp(),
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
      version: VERSION
    }, { merge: true });
  } catch (error) {
    const message = text(error instanceof Error ? error.message : error, 1200);
    const noRetry = Boolean(
      (error as Error & { ulimNoAutoRetry?: boolean })?.ulimNoAutoRetry
    );
    const state = noRetry
      ? "delivery_unknown"
      : attempts >= 3
        ? "permanent_failed"
        : "pending";

    await ref.set({
      state,
      error: message,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
      version: VERSION
    }, { merge: true });
  }
}

export const deliverPracticeRoomDecisionNotificationJob7355037 = onDocumentCreated({
  document: `${DECISION_NOTIFICATION_JOBS}/{jobId}`,
  region: ULIM_FUNCTION_REGION,
  retry: false,
  timeoutSeconds: 120,
  memory: "512MiB",
  secrets: [ULIM_SOLAPI_OPERATIONAL_CONFIG_7355014]
}, async event => {
  if (!event.data) return;
  await processPracticeRoomDecisionNotificationJob7355037(event.data.ref);
});

export const sweepPracticeRoomDecisionNotificationJobs7355036 = onSchedule({
  schedule: "* * * * *",
  timeZone: "Asia/Seoul",
  region: ULIM_FUNCTION_REGION,
  retryCount: 0,
  timeoutSeconds: 240,
  memory: "512MiB",
  secrets: [ULIM_SOLAPI_OPERATIONAL_CONFIG_7355014]
}, async () => {
  const snapshot = await db()
    .collection(DECISION_NOTIFICATION_JOBS)
    .where("state", "in", ["pending", "processing"])
    .limit(40)
    .get();

  for (const doc of snapshot.docs) {
    await processPracticeRoomDecisionNotificationJob7355037(doc.ref);
  }
});

export const savePracticeRoomAdminPushToken7355033 = onCall(ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS, async request => {
  const caller = await requireAdmin(request);
  const input = object(request.data);
  const token = text(input.token, 5000);
  if (token.length < 40) throw new HttpsError("invalid-argument", "푸시 알림 정보를 확인해주세요.");
  const tokenId = `TOKEN_${hash(token).slice(0, 48)}`;
  await db().collection(PUSH_TOKENS).doc(tokenId).set({
    token,
    firebaseUid: caller.firebaseUid,
    role: caller.role,
    adminName: caller.displayName,
    deviceInfo: text(input.deviceInfo, 500),
    active: true,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
    version: VERSION
  }, { merge: true });
  return { status: "success", ok: true, version: VERSION };
});

export const notifyPracticeRoomReservationAdmin7355033 = onDocumentCreated({
  document: `${RESERVATIONS}/{reservationId}`,
  region: ULIM_FUNCTION_REGION,
  retry: false
}, async event => {
  if (!event.data) return;
  const data = event.data.data() ?? {};
  if (data.notifyAdminOnCreate !== true || isCancelled(data.status)) return;
  const tokenSnapshot = await db().collection(PUSH_TOKENS).where("active", "==", true).limit(500).get();
  const tokens = Array.from(new Set(tokenSnapshot.docs.map(doc => text(doc.data().token, 5000)).filter(Boolean)));
  if (!tokens.length) return;

  const startHour = Number(data.startHour);
  const endHour = Number(data.endHour);
  const response = await getMessaging(getOrInitializeDefaultFirebaseAdminApp()).sendEachForMulticast({
    tokens,
    data: {
      title: "📢 연습실 예약 신청",
      body: `${text(data.studentName, 120) || "학생"} 학생이 ${text(data.room, 80)} ${hourText(startHour)}~${hourText(endHour)}에 연습실 예약을 신청했습니다.`,
      reservationId: text(data.reservationId ?? event.params.reservationId, 180),
      studentName: text(data.studentName, 120),
      date: text(data.date, 10),
      room: text(data.room, 80),
      startTime: hourText(startHour),
      endTime: hourText(endHour),
      url: `https://ulimvoice.github.io/ulimvoice/?open=admin-room&date=${encodeURIComponent(text(data.date, 10))}&reservationId=${encodeURIComponent(text(data.reservationId ?? event.params.reservationId, 180))}`
    }
  });

  const invalidTokens = new Set<string>();
  response.responses.forEach((item, index) => {
    if (item.success) return;
    const code = text((item.error as { code?: string } | undefined)?.code, 120);
    if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) invalidTokens.add(tokens[index]);
  });
  if (!invalidTokens.size) return;
  const batch = db().batch();
  tokenSnapshot.docs.forEach(doc => {
    if (invalidTokens.has(text(doc.data().token, 5000))) {
      batch.set(doc.ref, { active: false, disabledAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: VERSION }, { merge: true });
    }
  });
  await batch.commit();
});
