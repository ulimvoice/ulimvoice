import { createHash } from "node:crypto";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { FieldPath, FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";

export const CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION = "2026-08-15.7355057-r29.4-firestore-single-owner";

const REGION = "asia-northeast3";
const DAY_COLLECTION = "realtimeClassroomDays";
const USER_COLLECTION = "users";
const STAFF_ROLES = new Set(["teacher", "admin", "superAdmin"]);
const FULL_ADMIN_ROLES = new Set(["admin", "superAdmin"]);
const ROOM_NAMES = ["2강의실", "3강의실", "녹음실", "4강의실", "5강의실", "신체훈련실"] as const;
const MAX_RECORDS_PER_DAY = 160;
const MAX_AUDIT_DAYS = 1200;
const CALLABLE_OPTIONS = { region: REGION, cors: true, timeoutSeconds: 60, memory: "256MiB" as const };

type PlainObject = Record<string, unknown>;
type StaffContext = {
  firebaseUid: string;
  role: string;
  name: string;
  loginId: string;
  teacherUid: string;
  user: DocumentData;
  authUser: UserRecord;
};
type ClassroomRecord = {
  recordId: string;
  date: string;
  room: string;
  startHour: number;
  endHour: number;
  instructor: string;
  adminName: string;
  adminId: string;
  className: string;
  purpose: string;
  memo: string;
  status: string;
  ownerFirebaseUid: string;
  createdByFirebaseUid: string;
  updatedByFirebaseUid: string;
  requestId: string;
  createdAtMs: number;
  updatedAtMs: number;
  source: string;
  version: string;
  [key: string]: unknown;
};

type Group = { room: string; startHour: number; endHour: number };

function app() { return getOrInitializeDefaultFirebaseAdminApp(); }
function db() { return getFirestore(app()); }
function auth() { return getAuth(app()); }
function object(value: unknown): PlainObject { return value && typeof value === "object" && !Array.isArray(value) ? value as PlainObject : {}; }
function text(value: unknown, max = 500): string { return String(value ?? "").trim().slice(0, max); }
function compact(value: unknown): string { return text(value, 160).normalize("NFKC").replace(/\s+/g, "").toLowerCase(); }
function authVersion(value: unknown): number | string | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 1) return value;
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 80);
  return null;
}
function sameAuthVersion(a: unknown, b: unknown): boolean {
  const left = authVersion(a), right = authVersion(b);
  return left !== null && right !== null && String(left) === String(right);
}
function dateKey(value: unknown): string {
  const raw = text(value, 20);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new HttpsError("invalid-argument", "사용일을 확인해주세요.");
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new HttpsError("invalid-argument", "사용일을 확인해주세요.");
  }
  return raw;
}
function roomName(value: unknown): string {
  const raw = text(value, 40);
  const normalized = compact(raw);
  const match = ROOM_NAMES.find(room => compact(room) === normalized);
  if (!match) throw new HttpsError("invalid-argument", "강의실을 확인해주세요.");
  return match;
}
function hour(value: unknown, field: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0 || num > 24) throw new HttpsError("invalid-argument", `${field}을 확인해주세요.`);
  return num;
}
function parseGroup(value: unknown): Group {
  const input = object(value);
  const startHour = hour(input.startHour, "시작시간");
  const endHour = hour(input.endHour, "종료시간");
  if (endHour <= startHour) throw new HttpsError("invalid-argument", "종료시간은 시작시간보다 늦어야 합니다.");
  return { room: roomName(input.room), startHour, endHour };
}
function normalizeRole(value: unknown): string {
  const raw = compact(value).replace(/[_-]+/g, "");
  if (["superadmin", "전체관리자", "전체관리", "원장"].includes(raw)) return "superAdmin";
  if (["admin", "관리자"].includes(raw)) return "admin";
  if (["teacher", "강사", "교사"].includes(raw)) return "teacher";
  return "";
}
function displayName(user: DocumentData, claims: PlainObject, fallback: string): string {
  return text(user.name ?? user.displayName ?? user.teacherName ?? user.adminName ?? claims.name ?? claims.displayName ?? fallback, 100);
}
async function requireStaff(request: CallableRequest<unknown>): Promise<StaffContext> {
  if (!request.auth) throw new HttpsError("unauthenticated", "교직원 로그인이 필요합니다.");
  const firebaseUid = text(request.auth.uid, 128);
  const claims = (request.auth.token ?? {}) as PlainObject;
  const role = normalizeRole(claims.role);
  const tokenVersion = authVersion(claims.authVersion);
  if (!STAFF_ROLES.has(role) || tokenVersion === null) throw new HttpsError("permission-denied", "교직원 권한을 확인하지 못했습니다.");
  const [userSnap, authUser] = await Promise.all([
    db().collection(USER_COLLECTION).doc(firebaseUid).get(),
    auth().getUser(firebaseUid)
  ]);
  const user = userSnap.data() ?? {};
  if (!userSnap.exists || user.active !== true || normalizeRole(user.role) !== role || !sameAuthVersion(user.authVersion, tokenVersion) || authUser.disabled) {
    throw new HttpsError("permission-denied", "교직원 계정 또는 권한이 변경되었습니다. 다시 로그인해주세요.");
  }
  const loginId = text(user.loginId ?? user.adminId ?? user.legacyAdminId ?? claims.loginId ?? claims.adminId, 160);
  const name = displayName(user, claims, loginId || firebaseUid);
  const teacherUid = text(user.teacherUid ?? claims.teacherUid, 128);
  if (role === "teacher" && !teacherUid) throw new HttpsError("permission-denied", "강사 계정 정보를 확인하지 못했습니다.");
  return { firebaseUid, role, name, loginId, teacherUid, user, authUser };
}
function legacyHour7355057(value: unknown): number {
  const direct = Number(value);
  if (Number.isInteger(direct)) return direct;
  const match = text(value, 40).match(/(\d{1,2})/);
  return match ? Number(match[1]) : Number.NaN;
}
function asRecord(raw: unknown, date: string, index: number): ClassroomRecord | null {
  const item = object(raw);
  let room = text(item.room ?? item.classroom ?? item.roomName, 40);
  if (room) {
    const canonicalRoom = ROOM_NAMES.find(name => compact(name) === compact(room));
    if (canonicalRoom) room = canonicalRoom;
  }
  const startHour = legacyHour7355057(item.startHour ?? item.startTime ?? item.start);
  const endHour = legacyHour7355057(item.endHour ?? item.endTime ?? item.end);
  if (!room || !Number.isInteger(startHour) || !Number.isInteger(endHour) || endHour <= startHour) return null;
  const instructor = text(item.instructor ?? item.adminName ?? item.teacherName ?? item.staffName, 100);
  const className = text(item.className ?? item.purpose ?? item.classTitle, 200);
  const rawStatus = text(item.status ?? item.state, 40);
  const statusKey = compact(rawStatus);
  const normalizedStatus = !rawStatus || ["active", "used", "사용", "사용중"].includes(statusKey) ? "사용중" : rawStatus;
  const stableId = text(item.recordId, 160) || `LEGACY_${hashId([date, room, startHour, endHour, instructor, className, index].join("\u001f"))}`;
  return {
    ...item,
    recordId: stableId,
    date: text(item.date, 20) || date,
    room,
    startHour,
    endHour,
    instructor,
    adminName: text(item.adminName ?? instructor, 100),
    adminId: text(item.adminId, 160),
    className,
    purpose: text(item.purpose ?? className, 200),
    memo: text(item.memo, 500),
    status: normalizedStatus,
    ownerFirebaseUid: text(item.ownerFirebaseUid ?? item.createdByFirebaseUid, 128),
    createdByFirebaseUid: text(item.createdByFirebaseUid ?? item.ownerFirebaseUid, 128),
    updatedByFirebaseUid: text(item.updatedByFirebaseUid, 128),
    requestId: text(item.requestId, 200),
    createdAtMs: Number(item.createdAtMs || 0),
    updatedAtMs: Number(item.updatedAtMs || 0),
    source: text(item.source, 80),
    version: text(item.version, 120)
  } as ClassroomRecord;
}
function activeRecords(data: DocumentData, date: string): ClassroomRecord[] {
  const rows = Array.isArray(data.records) ? data.records : [];
  return rows.map((row, index) => asRecord(row, date, index)).filter((row): row is ClassroomRecord => !!row);
}
function overlaps(left: Pick<ClassroomRecord, "room"|"startHour"|"endHour"|"status">, right: Group): boolean {
  return compact(left.room) === compact(right.room) && left.status === "사용중" && left.startHour < right.endHour && right.startHour < left.endHour;
}
function hashId(input: string): string { return createHash("sha256").update(input, "utf8").digest("hex").slice(0, 28); }
function recordId(date: string, requestId: string, room: string, startHour: number, endHour: number, suffix = ""): string {
  return `CLR_${hashId([date, requestId, room, startHour, endHour, suffix].join("\u001f"))}`;
}
function sorted(records: ClassroomRecord[]): ClassroomRecord[] {
  return records.slice().sort((a, b) => a.startHour - b.startHour || a.room.localeCompare(b.room, "ko") || a.recordId.localeCompare(b.recordId));
}
function sanitizeReturned(records: ClassroomRecord[]): ClassroomRecord[] { return sorted(records).map(row => ({ ...row })); }
function instructorFor(staff: StaffContext, requested: unknown): string {
  if (staff.role === "teacher") return staff.name;
  return text(requested, 100) || staff.name;
}
function classNameValue(input: PlainObject): string { return text(input.className ?? input.purpose, 200); }
function requestIdValue(input: PlainObject, prefix: string): string {
  const supplied = text(input.requestId, 200);
  return supplied || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function teacherOwns(staff: StaffContext, row: ClassroomRecord): boolean {
  if (row.ownerFirebaseUid && row.ownerFirebaseUid === staff.firebaseUid) return true;
  return !!staff.name && compact(row.instructor || row.adminName) === compact(staff.name);
}
function newRecord(staff: StaffContext, date: string, group: Group, input: PlainObject, requestId: string, idSuffix = ""): ClassroomRecord {
  const now = Date.now();
  const instructor = instructorFor(staff, input.assignedInstructor ?? input.instructor);
  const className = classNameValue(input);
  return {
    recordId: recordId(date, requestId, group.room, group.startHour, group.endHour, idSuffix),
    date,
    room: group.room,
    startHour: group.startHour,
    endHour: group.endHour,
    instructor,
    adminName: instructor,
    adminId: staff.loginId,
    className,
    purpose: className,
    memo: text(input.memo, 500),
    status: "사용중",
    ownerFirebaseUid: staff.firebaseUid,
    createdByFirebaseUid: staff.firebaseUid,
    updatedByFirebaseUid: staff.firebaseUid,
    requestId,
    createdAtMs: now,
    updatedAtMs: now,
    source: "firestore_primary_7355057",
    version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION
  };
}
function splitAroundHour(row: ClassroomRecord, target: Group, requestId: string, staffUid: string): ClassroomRecord[] {
  if (!overlaps(row, target)) return [row];
  const out: ClassroomRecord[] = [];
  if (row.startHour < target.startHour) {
    out.push({ ...row, recordId: recordId(row.date, requestId, row.room, row.startHour, target.startHour, "left"), endHour: target.startHour, updatedAtMs: Date.now(), updatedByFirebaseUid: staffUid, requestId, source: row.source || "firestore_primary_split_7355057", version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION });
  }
  if (target.endHour < row.endHour) {
    out.push({ ...row, recordId: recordId(row.date, requestId, row.room, target.endHour, row.endHour, "right"), startHour: target.endHour, updatedAtMs: Date.now(), updatedByFirebaseUid: staffUid, requestId, source: row.source || "firestore_primary_split_7355057", version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION });
  }
  return out;
}

export const getClassroomUsageDayFirestorePrimary7355058 = onCall(CALLABLE_OPTIONS, async request => {
  await requireStaff(request);
  const input = object(request.data);
  const date = dateKey(input.date);
  const snapshot = await db().collection(DAY_COLLECTION).doc(date).get();
  const data = snapshot.data() ?? {};
  const records = activeRecords(data, date);
  return {
    ok: true,
    status: "success",
    date,
    count: records.length,
    records: sanitizeReturned(records),
    source: "firestore_primary_server_read_7355058",
    version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION
  };
});

export const commitClassroomUsageFirestorePrimary7355057 = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const input = object(request.data);
  const date = dateKey(input.date);
  const groupsRaw = Array.isArray(input.groups) ? input.groups : [];
  if (!groupsRaw.length || groupsRaw.length > 12) throw new HttpsError("invalid-argument", "강의실 사용 시간을 확인해주세요.");
  const groups = groupsRaw.map(parseGroup);
  const requestId = requestIdValue(input, "CLASSROOM-7355057");
  const ref = db().collection(DAY_COLLECTION).doc(date);
  return db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const records = activeRecords(data, date);
    const previousByRequest = records.filter(row => row.requestId === requestId && row.source === "firestore_primary_7355057");
    if (previousByRequest.length) return { ok: true, duplicate: true, version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION, accepted: previousByRequest, records: sanitizeReturned(records) };
    const conflicts = groups.flatMap(group => records.filter(row => overlaps(row, group)).map(row => ({ recordId: row.recordId, room: row.room, startHour: row.startHour, endHour: row.endHour, instructor: row.instructor, className: row.className })));
    if (conflicts.length) return { ok: false, version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION, conflicts, message: "이미 사용 중인 강의실 시간이 있습니다.", records: sanitizeReturned(records) };
    const accepted = groups.map((group, index) => newRecord(staff, date, group, input, requestId, String(index)));
    const next = records.concat(accepted);
    if (next.length > MAX_RECORDS_PER_DAY) throw new HttpsError("resource-exhausted", "해당 날짜의 강의실 기록이 너무 많습니다.");
    tx.set(ref, {
      date,
      records: sorted(next),
      source: "firestore_primary_7355057",
      version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { ok: true, version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION, accepted, conflicts: [], records: sanitizeReturned(next) };
  });
});

export const releaseClassroomUsageFirestorePrimary7355057 = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  const input = object(request.data);
  const date = dateKey(input.date);
  const room = roomName(input.room);
  const startHour = hour(input.startHour, "시작시간");
  const endHour = hour(input.endHour, "종료시간");
  if (endHour <= startHour) throw new HttpsError("invalid-argument", "해제 시간을 확인해주세요.");
  const requestId = requestIdValue(input, "CLASSROOM-RELEASE-7355057");
  const requestedId = text(input.recordId, 160);
  const target: Group = { room, startHour, endHour };
  const ref = db().collection(DAY_COLLECTION).doc(date);
  return db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const records = activeRecords(data, date);
    let targetRow = requestedId ? records.find(row => row.recordId === requestedId) : undefined;
    if (!targetRow) targetRow = records.find(row => overlaps(row, target));
    if (!targetRow) return { ok: true, duplicate: true, version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION, released: [], records: sanitizeReturned(records) };
    if (!FULL_ADMIN_ROLES.has(staff.role) && !teacherOwns(staff, targetRow)) throw new HttpsError("permission-denied", "본인이 사용한 강의실만 해제할 수 있습니다.");
    const next: ClassroomRecord[] = [];
    for (const row of records) {
      if (row.recordId !== targetRow.recordId) { next.push(row); continue; }
      next.push(...splitAroundHour(row, target, requestId, staff.firebaseUid));
    }
    tx.set(ref, {
      date,
      records: sorted(next),
      source: "firestore_primary_7355057",
      version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { ok: true, version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION, released: [{ recordId: targetRow.recordId, room, startHour, endHour }], records: sanitizeReturned(next) };
  });
});

export const updateClassroomUsageSlotFirestorePrimary7355057 = onCall(CALLABLE_OPTIONS, async request => {
  const staff = await requireStaff(request);
  if (!FULL_ADMIN_ROLES.has(staff.role)) throw new HttpsError("permission-denied", "관리자만 강의실 배정을 수정할 수 있습니다.");
  const input = object(request.data);
  const date = dateKey(input.date);
  const target = parseGroup(input);
  if (target.endHour !== target.startHour + 1) throw new HttpsError("invalid-argument", "관리자 배정 수정은 한 시간 칸씩 처리해주세요.");
  const requestId = requestIdValue(input, "CLASSROOM-UPDATE-7355057");
  const ref = db().collection(DAY_COLLECTION).doc(date);
  return db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const records = activeRecords(data, date);
    const previous = records.find(row => row.requestId === requestId && row.source === "firestore_primary_7355057");
    if (previous) return { ok: true, duplicate: true, version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION, accepted: [previous], records: sanitizeReturned(records) };
    const next: ClassroomRecord[] = [];
    for (const row of records) {
      if (overlaps(row, target)) next.push(...splitAroundHour(row, target, requestId, staff.firebaseUid));
      else next.push(row);
    }
    const accepted = newRecord(staff, date, target, input, requestId, "admin");
    next.push(accepted);
    if (next.length > MAX_RECORDS_PER_DAY) throw new HttpsError("resource-exhausted", "해당 날짜의 강의실 기록이 너무 많습니다.");
    tx.set(ref, {
      date,
      records: sorted(next),
      source: "firestore_primary_7355057",
      version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { ok: true, version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION, accepted: [accepted], records: sanitizeReturned(next) };
  });
});

export const auditClassroomUsageFirestorePrimary7355057 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: "512MiB" }, async request => {
  const staff = await requireStaff(request);
  if (staff.role !== "superAdmin") throw new HttpsError("permission-denied", "전체관리자 권한이 필요합니다.");
  const snapshot = await db().collection(DAY_COLLECTION).orderBy(FieldPath.documentId()).limit(MAX_AUDIT_DAYS).get();
  const days = snapshot.docs.map(doc => {
    const data = doc.data() ?? {};
    const rows = activeRecords(data, doc.id);
    return { date: doc.id, recordCount: rows.length, activeCount: rows.filter(row => row.status === "사용중").length };
  });
  const nonEmpty = days.filter(day => day.recordCount > 0);
  return {
    ok: true,
    version: CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION,
    documentCount: snapshot.size,
    nonEmptyDayCount: nonEmpty.length,
    totalRecordCount: days.reduce((sum, day) => sum + day.recordCount, 0),
    firstDate: nonEmpty.length ? nonEmpty[0].date : "",
    lastDate: nonEmpty.length ? nonEmpty[nonEmpty.length - 1].date : "",
    recentDays: nonEmpty.slice(-60)
  };
});
