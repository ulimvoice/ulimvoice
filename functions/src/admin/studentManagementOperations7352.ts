import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Transaction
} from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";
import { ULIM_LEGACY_PROOF_HMAC_SECRET } from "../common/firebaseSecrets.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";
import { safeLegacyAuthUid } from "../auth/legacySessionBridge.js";
import { upsertStudentFirebaseDirectCredential7355030 } from "../auth/studentFirebaseDirectAuth7355030.js";
import {
  automaticStudentAudience7355034,
  audienceLabel7355034,
  classAudienceGroup7355034,
  normalizeAudienceGroup7355034,
  studentAudienceDetails7355034
} from "../common/audienceSegmentation7355034.js";

export const STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION = "2026-09-02.735.09.37";
export const CLASS_CATALOG_RENAME_7355085_VERSION = "2026-08-18.735.05.0.85";
export const STUDENT_CREATE_INTERNAL_FIX_73550473 = "2026-08-12.735.05.0.47.3";

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyS3QUvrjNbwvaw92_g-QKQyN3Yito8DAdpAjxUzfnsuVf3Ce7ccuaXIv651U7FnYF4/exec";
const STUDENT_COLLECTION = "students";
const ENROLLMENT_COLLECTION = "studentEnrollments";
const JOB_COLLECTION = "studentOperationJobs";
const REQUEST_COLLECTION = "studentManagementRequests";
const UNIQUE_COLLECTION = "studentUniqueKeys";
const FEATURE_FLAG_PATH = "featureFlags/studentManagementV2";
const JOB_LEASE_MS = 90_000;
const JOB_MAX_ATTEMPTS = 8;
const MAX_STUDENTS = 5000;
const MAX_ENROLLMENTS = 15000;
const MAX_JOBS = 15000;
const BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const CALLABLE_OPTIONS = Object.freeze({
  ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  cors: true,
  invoker: "public" as const
});

type PlainObject = Record<string, unknown>;
type StudentStatus = "active" | "leave" | "withdrawn";
type EnrollmentStatus = "active" | "leave" | "ended";
type RegistrationType = "new" | "class_move" | "existing";
type PracticeDailyResetScope7355051 = "vocal" | "standard" | "past";
type JobState = "pending" | "processing" | "complete" | "failed";
type JobType =
  | "student_sheet_create"
  | "student_sheet_update"
  | "student_auth_create"
  | "attendance_roster_apply"
  | "student_sheet_retire"
  | "student_auth_disable"
  | "attendance_roster_remove";

type Caller = {
  uid: string;
  user: DocumentData;
  authUser: UserRecord;
};

type FeatureFlags = {
  studentCoreV2Enabled: boolean;
  adminStudentListV2Enabled: boolean;
  studentSearchEnrollmentV2Enabled: boolean;
  tabletApplicationV2Enabled: boolean;
  autoRegistrationV2Enabled: boolean;
  studentPasswordV2Enabled: boolean;
};

type ClassCatalogItem = {
  classId: string;
  className: string;
  instructorUid: string;
  instructorName: string;
  teacherScopeKey: string;
  source: string;
  selectable: boolean;
  dates: string[];
  roomName: string;
  baseName: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timeSlots: number[];
  audienceGroup: "adult" | "youth";
};

type ValidStudentInput = {
  name: string;
  nameNormalized: string;
  birthDate: string;
  studentPhone: string;
  phoneDigits: string;
  parentPhone: string;
  parentPhoneDigits: string;
  attendanceNo: string;
  enrollmentStatus: StudentStatus;
  initialRegisteredDate: string;
  classIds: string[];
  registrationType: RegistrationType;
  memo: string;
  privacyConsent: boolean;
  portraitConsent: boolean;
  preserveLegacyClassNames: string[];
  audienceGroupOverride: "adult" | "youth" | "";
};

type EnrollmentWrite = {
  entryType?: RegistrationType;
  entryStartDate?: string;
  entryTypeSource?: string;
  enrollmentId: string;
  studentUid: string;
  classId: string;
  className: string;
  instructorUid: string;
  instructorName: string;
  startDate: string;
  endDate: string;
  operationDate: string;
  status: EnrollmentStatus;
  registrationType: RegistrationType;
};

const DEFAULT_FLAGS: FeatureFlags = Object.freeze({
  studentCoreV2Enabled: true,
  adminStudentListV2Enabled: true,
  studentSearchEnrollmentV2Enabled: false,
  tabletApplicationV2Enabled: false,
  autoRegistrationV2Enabled: false,
  studentPasswordV2Enabled: false
});

function app() {
  return getOrInitializeDefaultFirebaseAdminApp();
}

function db() {
  return getFirestore(app());
}

function auth() {
  return getAuth(app());
}

function object(value: unknown): PlainObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as PlainObject;
}

function text(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalize(value: unknown): string {
  return text(value, 500).normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function normalizeName(value: unknown): string {
  return text(value, 120).normalize("NFC").replace(/\s+/g, "").toLowerCase();
}

function normalizePhone(value: unknown): string {
  return text(value, 60).replace(/\D/g, "");
}

function uniqueText(value: unknown, maxItem = 300): string[] {
  const raw = Array.isArray(value) ? value : text(value, 5000).split(/[\n,;/|]+/g);
  return Array.from(new Set(raw.map(item => text(item, maxItem)).filter(Boolean)));
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  const key = normalize(value);
  if (["1", "true", "yes", "y", "동의", "사용"].includes(key)) return true;
  if (["0", "false", "no", "n", "미동의", "미사용"].includes(key)) return false;
  return fallback;
}

function statusValue(value: unknown): StudentStatus {
  const key = normalize(value);
  if (key === "leave" || key === "hold" || key === normalize("휴원")) return "leave";
  if (key === "withdrawn" || key === normalize("퇴원") || key === "ended") return "withdrawn";
  return "active";
}

function enrollmentStatusForStudent(status: StudentStatus): EnrollmentStatus {
  if (status === "leave") return "leave";
  if (status === "withdrawn") return "ended";
  return "active";
}

function registrationTypeValue(value: unknown, fallback: RegistrationType): RegistrationType {
  const key = normalize(value);
  if (key === "class_move" || key === normalize("반이동")) return "class_move";
  if (key === "existing" || key === normalize("기존등록")) return "existing";
  if (key === "new" || key === normalize("신규")) return "new";
  return fallback;
}

function practiceDailyResetScopes7355051(value: unknown): PracticeDailyResetScope7355051[] {
  const raw = Array.isArray(value) ? value : [value];
  const out: PracticeDailyResetScope7355051[] = [];
  const add = (scope: PracticeDailyResetScope7355051) => { if (!out.includes(scope)) out.push(scope); };
  raw.forEach(item => {
    const key = normalize(item);
    if (!key || key === "all" || key === normalize("전체")) {
      add("vocal"); add("standard"); add("past");
    } else if (key === "vocal" || key === "vocal_training" || key === normalize("발성훈련") || key === normalize("발성")) add("vocal");
    else if (key === "standard" || key === "standard_pronunciation" || key === normalize("표준발음")) add("standard");
    else if (key === "past" || key === "past_question" || key === normalize("기출문제") || key === normalize("기출")) add("past");
  });
  return out.length ? out : ["vocal", "standard", "past"];
}


function dateValue(value: unknown, fieldName: string, required: boolean): string {
  const raw = text(value, 30).replace(/[./]/g, "-").replace(/\s+/g, "");
  if (!raw) {
    if (required) throw new HttpsError("invalid-argument", `${fieldName}을 입력해주세요.`);
    return "";
  }
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) throw new HttpsError("invalid-argument", `${fieldName}은 YYYY-MM-DD 형식으로 입력해주세요.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new HttpsError("invalid-argument", `${fieldName}이 올바르지 않습니다.`);
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function safeDate(value: unknown): string {
  try {
    return dateValue(value, "날짜", false);
  } catch {
    return "";
  }
}

function seoulDate(offsetDays = 0): string {
  const shifted = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

function calendarDateOffset7355033(date: string, offsetDays: number): string {
  const safe = dateValue(date, "날짜", true);
  const [year, month, day] = safe.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays, 12));
  return shifted.toISOString().slice(0, 10);
}

function sha(prefix: string, ...parts: unknown[]): string {
  const digest = createHash("sha256").update(parts.map(part => String(part ?? "")).join("\u001f"), "utf8").digest("hex").slice(0, 40);
  return `${prefix}_${digest}`;
}

function randomBase32(length: number): string {
  let out = "";
  while (out.length < length) {
    const bytes = randomBytes(Math.max(16, length - out.length));
    for (const byte of bytes) {
      out += BASE32[byte & 31];
      if (out.length >= length) break;
    }
  }
  return out;
}

function randomStudentUid(): string {
  return `STU2_${randomBase32(26)}`;
}
function randomClassId73550993(): string { return `CLS_${randomBytes(20).toString("hex")}`; }


function base64Url(input: Uint8Array): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signGas(action: string, requestId: string, issuedAtMs: number, payloadJson: string): string {
  const secret = ULIM_LEGACY_PROOF_HMAC_SECRET.value() || process.env.ULIM_LEGACY_PROOF_HMAC_SECRET || "";
  if (!secret) throw new Error("ULIM_LEGACY_PROOF_HMAC_SECRET is not configured");
  return base64Url(createHmac("sha256", secret).update(`v1|${action}|${requestId}|${issuedAtMs}|${payloadJson}`, "utf8").digest());
}

async function callGas(action: string, requestId: string, payload: PlainObject, timeoutMs = 180_000): Promise<PlainObject> {
  const payloadJson = JSON.stringify(payload);
  const issuedAtMs = Date.now();
  const response = await fetch(GAS_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action,
      requestId,
      issuedAtMs,
      payloadJson,
      signature: signGas(action, requestId, issuedAtMs, payloadJson)
    }),
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`GAS_HTTP_${response.status}`);
  const raw = await response.text();
  let parsed: PlainObject;
  try {
    parsed = JSON.parse(raw) as PlainObject;
  } catch {
    throw new Error(`GAS_INVALID_JSON:${raw.slice(0, 200)}`);
  }
  if (text(parsed.status, 30) !== "success") throw new Error(text(parsed.message, 1500) || "명단 연동에 실패했습니다.");
  return parsed;
}

function safeAuthVersion(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 1) return value;
  const result = text(value, 120);
  return result || null;
}

async function requireSuperAdmin(request: CallableRequest<unknown>): Promise<Caller> {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const uid = text(request.auth.uid, 128);
  const tokenRole = text(request.auth.token.role, 30);
  const tokenAuthVersion = safeAuthVersion(request.auth.token.authVersion);
  if (tokenRole !== "superAdmin" || tokenAuthVersion === null) throw new HttpsError("permission-denied", "전체관리자 권한이 필요합니다.");
  const [userSnapshot, authUser] = await Promise.all([
    db().collection("users").doc(uid).get(),
    auth().getUser(uid)
  ]);
  if (!userSnapshot.exists) throw new HttpsError("permission-denied", "활성 전체관리자 정보가 없습니다.");
  const user = userSnapshot.data() ?? {};
  if (user.active !== true || user.role !== "superAdmin" || safeAuthVersion(user.authVersion) !== tokenAuthVersion || authUser.disabled) {
    throw new HttpsError("permission-denied", "전체관리자 권한이 변경되었습니다. 다시 로그인해주세요.");
  }
  return { uid, user, authUser };
}

async function loadFeatureFlags(): Promise<FeatureFlags> {
  const snapshot = await db().doc(FEATURE_FLAG_PATH).get();
  const stored = snapshot.data() ?? {};
  return {
    studentCoreV2Enabled: booleanValue(stored.studentCoreV2Enabled, DEFAULT_FLAGS.studentCoreV2Enabled),
    adminStudentListV2Enabled: booleanValue(stored.adminStudentListV2Enabled, DEFAULT_FLAGS.adminStudentListV2Enabled),
    studentSearchEnrollmentV2Enabled: booleanValue(stored.studentSearchEnrollmentV2Enabled, DEFAULT_FLAGS.studentSearchEnrollmentV2Enabled),
    tabletApplicationV2Enabled: booleanValue(stored.tabletApplicationV2Enabled, DEFAULT_FLAGS.tabletApplicationV2Enabled),
    autoRegistrationV2Enabled: booleanValue(stored.autoRegistrationV2Enabled, DEFAULT_FLAGS.autoRegistrationV2Enabled),
    studentPasswordV2Enabled: booleanValue(stored.studentPasswordV2Enabled, DEFAULT_FLAGS.studentPasswordV2Enabled)
  };
}

async function requireFeature(flag: keyof FeatureFlags): Promise<FeatureFlags> {
  const flags = await loadFeatureFlags();
  if (!flags[flag]) throw new HttpsError("failed-precondition", "현재 이 기능은 운영 전환 준비 중입니다.");
  return flags;
}

function requestIdValue(input: PlainObject, prefix: string): string {
  const supplied = text(input.requestId ?? input.idempotencyKey, 180);
  const raw = supplied || `${prefix}-${Date.now()}-${randomUUID()}`;
  return raw.replace(/[^0-9A-Za-z._-]/g, "_").slice(0, 180);
}

function requestRef(kind: string, requestId: string): DocumentReference {
  return db().collection(REQUEST_COLLECTION).doc(sha("REQ", kind, requestId));
}

function isRetryableTransactionError7355012(error: unknown): boolean {
  const item = object(error);
  const code = Number(item.code ?? -1);
  const message = text(item.message ?? error, 2000);
  return code === 10 || /\bABORTED\b/i.test(message) || /transaction.*(?:expired|no longer valid)/i.test(message);
}

async function runTransactionResilient7355012<T>(handler: (transaction: Transaction) => Promise<T>): Promise<T> {
  let lastError: unknown = new Error("Firestore transaction failed");
  for (let outerAttempt = 0; outerAttempt < 3; outerAttempt += 1) {
    try {
      return await db().runTransaction(handler, { maxAttempts: 10 });
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError7355012(error) || outerAttempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 250 * (outerAttempt + 1)));
    }
  }
  throw lastError;
}

function publicFlags(flags: FeatureFlags): PlainObject {
  return { ...flags };
}

function operationalNormalize(value: unknown): string {
  return text(value, 500)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, "")
    // Keep the operational class-id normalizer byte-compatible with the existing attendance module.
    // eslint-disable-next-line no-useless-escape
    .replace(/[\[\](){}<>~～\-_/\\:·.,'"`]/g, "");
}

function operationalTeacherScopeKey(className: string, instructorName: string, explicit: unknown): string {
  const direct = text(explicit, 180);
  if (direct) return direct;
  const bracket = className.match(/\[\s*([^\]]+?)\s*T?\s*\]/i);
  const name = text(bracket?.[1] || instructorName, 120).replace(/T$/i, "").trim();
  const key = operationalNormalize(name);
  return key ? `name:${key}` : "name:unknown";
}

function operationalClassId(className: string, instructorName: string, explicitClassId: string, explicitScope: unknown): string {
const direct = text(explicitClassId, 180); if (direct) return direct; const scope = operationalTeacherScopeKey(className, instructorName, explicitScope); return sha("LEGCLS", operationalNormalize(className), scope);
}

function teacherNameKey(value: unknown): string {
  return normalize(text(value, 160).replace(/^name:/i, "").replace(/(?:선생님|강사)$/g, "").replace(/T$/i, ""));
}

async function loadTeacherMaps(): Promise<{ byUid: Map<string, string>; byName: Map<string, string> }> {
  const [teacherSnapshot, userSnapshot] = await Promise.all([
    db().collection("teachers").limit(1000).get(),
    db().collection("users").where("role", "in", ["teacher", "admin", "superAdmin"]).limit(2000).get()
  ]);
  const byUid = new Map<string, string>();
  const byName = new Map<string, string>();
  const add = (data: DocumentData, fallbackUid: string) => {
    if (data.active === false) return;
    const uid = text(data.teacherUid, 160) || fallbackUid;
    const name = text(data.name ?? data.teacherName ?? data.displayName ?? data.adminName, 120);
    if (!uid) return;
    if (name) byUid.set(uid, name);
    [name, data.teacherName, data.displayName, data.adminName, data.adminId, data.legacyAdminId, data.loginId]
      .map(teacherNameKey)
      .filter(Boolean)
      .forEach(key => byName.set(key, uid));
  };
  teacherSnapshot.docs.forEach(doc => add(doc.data() ?? {}, doc.id));
  userSnapshot.docs.forEach(doc => add(doc.data() ?? {}, text(doc.data()?.teacherUid, 160) || doc.id));
  return { byUid, byName };
}

function classWeekday(value: unknown): number {
  const raw = text(value, 300);
  const names = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const direct = Number(value);
  if (Number.isInteger(direct) && direct >= 0 && direct <= 6) return direct;
  const index = names.findIndex(name => raw.includes(name));
  return index >= 0 ? index : -1;
}

function calendarWeekday7355015(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return -1;
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function classSemanticKey7355015(item: ClassCatalogItem): string {
  return [
    normalize(item.className),
    teacherNameKey(item.instructorName),
    item.startTime,
    item.endTime
  ].join("|");
}

function classCatalogScore7355015(item: ClassCatalogItem, canonicalIds: Set<string>): number {
  let score = canonicalIds.has(item.classId) ? 1000000 : 0;
  if (item.instructorUid) score += 10000;
  if (item.teacherScopeKey) score += 5000;
  if (item.startTime && item.endTime) score += 1000;
  return score;
}

function dedupeClassCatalog7355015(items: ClassCatalogItem[], canonicalIds: Set<string>): ClassCatalogItem[] {
  const map = new Map<string, ClassCatalogItem>();
  items.forEach(item => {
    const key = classSemanticKey7355015(item);
    const current = map.get(key);
    if (!current) {
      map.set(key, item);
      return;
    }
    const preferred = classCatalogScore7355015(item, canonicalIds) > classCatalogScore7355015(current, canonicalIds) ? item : current;
    const other = preferred === item ? current : item;
    preferred.instructorUid = preferred.instructorUid || other.instructorUid;
    preferred.instructorName = preferred.instructorName || other.instructorName;
    preferred.teacherScopeKey = preferred.teacherScopeKey || other.teacherScopeKey;
    preferred.selectable = Boolean(preferred.instructorUid);
    preferred.roomName = preferred.roomName !== "데스크문의" ? preferred.roomName : other.roomName;
    preferred.dates = Array.from(new Set([...preferred.dates, ...other.dates])).filter(date => {
      return preferred.weekday < 0 || calendarWeekday7355015(date) === preferred.weekday;
    }).sort();
    preferred.baseName = preferred.baseName || other.baseName;
    preferred.weekday = preferred.weekday >= 0 ? preferred.weekday : other.weekday;
    preferred.startTime = preferred.startTime || other.startTime;
    preferred.endTime = preferred.endTime || other.endTime;
    preferred.timeSlots = preferred.timeSlots.length ? preferred.timeSlots : other.timeSlots;
    map.set(key, preferred);
  });
  return Array.from(map.values());
}

function classTimeParts(data: DocumentData, className: string): { startTime: string; endTime: string; timeSlots: number[] } {
  const match = className.match(/(\d{1,2}):00\s*[~～-]\s*(\d{1,2}):00/);
  const startTime = text(data.startTime, 10) || (match ? `${String(Number(match[1])).padStart(2, "0")}:00` : "");
  const endTime = text(data.endTime, 10) || (match ? `${String(Number(match[2])).padStart(2, "0")}:00` : "");
  const explicit: number[] = Array.isArray(data.timeSlots) ? data.timeSlots.map(value => Number(value)).filter((hour): hour is number => Number.isInteger(hour) && hour >= 0 && hour <= 23) : [];
  const startHour = Number(startTime.slice(0, 2));
  const endHour = Number(endTime.slice(0, 2));
  const derived = Number.isInteger(startHour) && Number.isInteger(endHour) && endHour > startHour
    ? Array.from({ length: endHour - startHour }, (_, index) => startHour + index)
    : [];
  return { startTime, endTime, timeSlots: explicit.length ? Array.from(new Set(explicit)).sort((a, b) => a - b) : derived };
}

function classBaseName(data: DocumentData, className: string): string {
  const explicit = text(data.baseName, 300);
  if (explicit) return explicit;
  return className.replace(/^\s*\[[^\]]+\]\s*-?\s*/, "").replace(/\s+\d{1,2}:00\s*[~～-]\s*\d{1,2}:00\s*$/, "").trim();
}

function classItemFromData(data: DocumentData, fallbackClassId: string, teachers: { byUid: Map<string, string>; byName: Map<string, string> }, date = ""): ClassCatalogItem | null {
  const explicitClassId = text(data.classId, 180) || fallbackClassId;
  const className = text(data.className ?? data.name, 300);
  if (!className || data.active === false) return null;
  const directName = text(data.instructorName ?? data.instructor ?? data.teacherName ?? data.teacher, 120).replace(/T$/i, "").trim();
  const bracket = className.match(/\[\s*([^\]]+?)\s*T?\s*\]/i);
  const parsedName = directName || text(bracket?.[1], 120).replace(/T$/i, "").trim();
  const instructorUids = Array.isArray(data.instructorUids) ? data.instructorUids.map(value => text(value, 160)).filter(Boolean) : [];
  const instructorUid = text(data.instructorUid ?? data.teacherUid, 160) || instructorUids[0] || teachers.byName.get(teacherNameKey(parsedName)) || "";
  const instructorName = parsedName || teachers.byUid.get(instructorUid) || "";
  const teacherScopeKey = operationalTeacherScopeKey(className, instructorName, data.teacherScopeKey);
  const classId = operationalClassId(className, instructorName, explicitClassId, teacherScopeKey);
  const time = classTimeParts(data, className);
  const baseName = classBaseName(data, className);
  const weekday = classWeekday(data.weekday ?? baseName ?? className);
  const explicitDates = date && (weekday < 0 || calendarWeekday7355015(date) === weekday) ? [date] : [];
  return {
    classId,
    className,
    instructorUid,
    instructorName,
    teacherScopeKey,
    source: text(data.source, 120) || "operating_class",
    selectable: Boolean(instructorUid),
    dates: explicitDates,
    roomName: text(data.classroom ?? data.roomName ?? data.room, 100) || "데스크문의",
    baseName,
    weekday,
    startTime: time.startTime,
    endTime: time.endTime,
    timeSlots: time.timeSlots,
    audienceGroup: classAudienceGroup7355034(data)
  };
}

async function loadClassCatalog(existingTeachers?: { byUid: Map<string, string>; byName: Map<string, string> }): Promise<ClassCatalogItem[]> {
  const teachers = existingTeachers || await loadTeacherMaps();
  const today = seoulDate();
  // 7.35.5.0.16: `classes` is the canonical class catalog. Keep only today's old
  // staffClassLists document as a transitional fallback; never scan 29 adjacent days.
  const [classDocs, todayDoc] = await Promise.all([
    db().collection("classes").limit(2000).get(),
    db().collection("staffClassLists").doc(today).get()
  ]);
  const map = new Map<string, ClassCatalogItem>();
  const retiredClassIds = new Set(classDocs.docs.filter(doc => doc.data()?.active === false).map(doc => text(doc.data()?.classId, 180) || doc.id));
  const canonicalIds = new Set(classDocs.docs.filter(doc => doc.data()?.active !== false).map(doc => text(doc.data()?.classId, 180) || doc.id));
  const add = (item: ClassCatalogItem | null) => {
    if (item && retiredClassIds.has(item.classId)) return;
    if (!item) return;
    const current = map.get(item.classId);
    if (!current) { map.set(item.classId, item); return; }
    current.className = current.className || item.className;
    current.instructorUid = current.instructorUid || item.instructorUid;
    current.instructorName = current.instructorName || item.instructorName;
    current.teacherScopeKey = current.teacherScopeKey || item.teacherScopeKey;
    current.selectable = Boolean(current.instructorUid);
    current.roomName = current.roomName !== "데스크문의" ? current.roomName : item.roomName;
    current.dates = Array.from(new Set([...current.dates, ...item.dates])).sort();
    current.baseName = current.baseName || item.baseName;
    current.weekday = current.weekday >= 0 ? current.weekday : item.weekday;
    current.startTime = current.startTime || item.startTime;
    current.endTime = current.endTime || item.endTime;
    current.timeSlots = current.timeSlots.length ? current.timeSlots : item.timeSlots;
    current.audienceGroup = current.audienceGroup || item.audienceGroup;
  };
  classDocs.docs.forEach(doc => add(classItemFromData(doc.data() ?? {}, doc.id, teachers)));
  if (todayDoc.exists) {
    const data = todayDoc.data() ?? {};
    const classes = Array.isArray(data.classes) ? data.classes : [];
    classes.forEach(raw => add(classItemFromData(object(raw), text(object(raw).classId, 180), teachers, today)));
  }
  return dedupeClassCatalog7355015(Array.from(map.values()), canonicalIds)
    .sort((left, right) => left.className.localeCompare(right.className, "ko") || left.classId.localeCompare(right.classId));
}
function classCatalogMap(catalog: ClassCatalogItem[]): Map<string, ClassCatalogItem> {
  return new Map(catalog.map(item => [item.classId, item]));
}

function validateStudentInput(input: PlainObject, fallbackType: RegistrationType): ValidStudentInput {
  const name = text(input.name ?? input.studentName, 100);
  if (!name) throw new HttpsError("invalid-argument", "학생명을 입력해주세요.");
  const birthDate = dateValue(input.birthDate ?? input.dateOfBirth, "생년월일", false);
  const studentPhone = text(input.studentPhone ?? input.phone, 60);
  const phoneDigits = normalizePhone(studentPhone);
  if (phoneDigits.length < 4) throw new HttpsError("invalid-argument", "학생 전화번호를 숫자 네 자리 이상 입력해주세요.");
  const classIds = uniqueText(input.classIds, 180);
  const enrollmentStatus = statusValue(input.enrollmentStatus ?? input.status);
  const initialRegisteredDate = dateValue(input.initialRegisteredDate ?? input.startDate, "수강 시작일", false);
  return {
    name,
    nameNormalized: normalizeName(name),
    birthDate,
    studentPhone,
    phoneDigits,
    parentPhone: text(input.parentPhone, 60),
    parentPhoneDigits: normalizePhone(input.parentPhone),
    attendanceNo: phoneDigits.slice(-4),
    enrollmentStatus,
    initialRegisteredDate,
    classIds,
    registrationType: registrationTypeValue(input.registrationType, fallbackType),
    memo: text(input.memo ?? input.adminMemo, 2000),
    privacyConsent: booleanValue(input.privacyConsent, false),
    portraitConsent: booleanValue(input.portraitConsent, false),
    preserveLegacyClassNames: uniqueText(input.preserveLegacyClassNames, 300),
    audienceGroupOverride: (() => {
      const value = normalizeAudienceGroup7355034(input.audienceGroupOverride ?? input.studentAudienceOverride);
      return value === "adult" || value === "youth" ? value : "";
    })()
  };
}

function resolveSelectedClasses(classIds: string[], catalog: ClassCatalogItem[]): ClassCatalogItem[] {
  const map = classCatalogMap(catalog);
  return classIds.map(classId => {
    const item = map.get(classId);
    if (!item) throw new HttpsError("failed-precondition", "선택한 수강반이 현재 운영 반 목록에 없습니다. 반 목록을 다시 불러와주세요.");
    if (!item.selectable || !item.instructorUid) throw new HttpsError("failed-precondition", `${item.className} 반의 담당강사 계정 연결을 먼저 확인해주세요.`);
    return item;
  });
}
// __ULIM_STUDENT_ASSIGNABLE_SAVED_ENROLLMENT_CATALOG_73550976__
// 학생목록 조회가 노출하는 활성 saved enrollment 반을 저장 경로에서도 동일하게 assignable로 인정합니다.
// 중요: ClassCatalogItem을 수동 object literal로 다시 만들지 않고 canonical classItemFromData()를 사용합니다.
// 따라서 baseName/weekday/startTime/endTime/timeSlots 등 catalog 타입이 확장되어도 누락 필드가 생기지 않습니다.
async function appendAssignableEnrollmentClasses73550976(catalog: ClassCatalogItem[], enrollmentDocs: Array<{ data(): DocumentData }>): Promise<ClassCatalogItem[]> {
  const result = catalog.slice();
  const ids = new Set(result.map(item => item.classId));
  const teachers = await loadTeacherMaps();
  enrollmentDocs.forEach(doc => {
    const data = doc.data() ?? {};
    const classId = text(data.classId, 180);
    const className = text(data.className, 300);
    if (!classId || !className || ids.has(classId) || data.active === false || text(data.status, 30) === "ended") return;
    const item = classItemFromData(data, classId, teachers);
    if (!item) return;
    item.classId = classId;
    item.className = item.className || className;
    item.source = "saved_enrollment_assignable_73550976";
    item.selectable = Boolean(item.instructorUid);
    result.push(item);
    ids.add(classId);
  });
  return result.sort((left, right) => left.className.localeCompare(right.className, "ko") || left.classId.localeCompare(right.classId));
}

async function loadAssignableClassCatalog73550976(): Promise<ClassCatalogItem[]> {
  const [catalog, enrollmentSnapshot] = await Promise.all([
    loadClassCatalog(),
    db().collection(ENROLLMENT_COLLECTION).limit(MAX_ENROLLMENTS).get()
  ]);
  return appendAssignableEnrollmentClasses73550976(catalog, enrollmentSnapshot.docs);
}


function uniqueLockId(kind: "phone" | "nameBirth", value: string): string {
  return sha("UNQ", kind, value);
}

async function assertNoExistingDuplicate(candidate: ValidStudentInput, excludeStudentUid = ""): Promise<void> {
  const snapshot = await db().collection(STUDENT_COLLECTION).limit(MAX_STUDENTS).get();
  for (const doc of snapshot.docs) {
    if (doc.id === excludeStudentUid) continue;
    const data = doc.data() ?? {};
    if (data.deleted === true) continue;
    const phoneDigits = normalizePhone(data.phoneDigits ?? data.studentPhone ?? data.phone);
    if (phoneDigits && phoneDigits === candidate.phoneDigits) throw new HttpsError("already-exists", "같은 학생 전화번호로 등록된 학생이 있습니다.");
    const name = normalizeName(data.nameNormalized ?? data.name ?? data.studentName);
    const birthDate = safeDate(data.birthDate ?? data.dateOfBirth);
    if (candidate.birthDate && name && birthDate && name === candidate.nameNormalized && birthDate === candidate.birthDate) {
      throw new HttpsError("already-exists", "같은 학생명과 생년월일로 등록된 학생이 있습니다.");
    }
  }
}

function enrollmentIdFor(studentUid: string, classId: string): string {
  return sha("ENR", studentUid, classId);
}

function enrollmentWrite(studentUid: string, item: ClassCatalogItem, input: ValidStudentInput, current?: DocumentData): EnrollmentWrite {
const preservedRegistration = current ? registrationTypeValue(current.registrationType, "existing") : input.registrationType;
  const explicitType = current ? text(current.entryType, 30) : ((input.registrationType === "new" || input.registrationType === "class_move") ? input.registrationType : "");
  const explicitStartDate = current ? text(current.entryStartDate, 20) : (explicitType ? input.initialRegisteredDate : "");
  return {
    enrollmentId: enrollmentIdFor(studentUid, item.classId), studentUid, classId: item.classId, className: item.className,
    instructorUid: item.instructorUid, instructorName: item.instructorName,
    startDate: safeDate(current?.startDate) || input.initialRegisteredDate, endDate: "",
    operationDate: current ? text(current.operationDate, 20) : ((input.registrationType === "new" || input.registrationType === "class_move") ? input.initialRegisteredDate : ""),
    status: enrollmentStatusForStudent(input.enrollmentStatus), registrationType: preservedRegistration,
    ...(explicitType ? { entryType: explicitType as RegistrationType, entryStartDate: explicitStartDate, entryTypeSource: current ? (text(current.entryTypeSource, 80) || "explicit_preserved_73550993") : "admin_explicit_73550993" } : {})
  };
}

function jobAction(type: JobType): string {
  if (type === "student_sheet_create") return "firebaseStudentSheetCreate7352";
  if (type === "student_sheet_update") return "firebaseStudentSheetUpdate7352";
  if (type === "student_auth_create") return "firebaseStudentAuthUpsert7352";
  if (type === "student_sheet_retire") return "firebaseStudentSheetRetire7352";
  if (type === "student_auth_disable") return "firebaseStudentAuthDisable7352";
  if (type === "attendance_roster_remove") return "firebaseStudentAttendanceRemove7352";
  return "firebaseStudentAttendanceApply7352";
}

function jobIdFor(requestId: string, type: JobType, suffix = ""): string {
  return sha("JOB", requestId, type, suffix);
}

function jobData(requestId: string, type: JobType, studentUid: string, payload: PlainObject, actorUid: string, suffix = ""): PlainObject {
  const now = Date.now();
  return {
    jobId: jobIdFor(requestId, type, suffix),
    requestId,
    idempotencyKey: requestId,
    jobType: type,
    action: jobAction(type),
    studentUid,
    payload,
    state: "pending" satisfies JobState,
    attempts: 0,
    maxAttempts: JOB_MAX_ATTEMPTS,
    lastError: "",
    nextAttemptAtMs: now,
    leaseUntilMs: 0,
    createdByFirebaseUid: actorUid,
    createdAtMs: now,
    updatedAtMs: now,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  };
}

function studentSheetPayload(studentUid: string, input: ValidStudentInput, classes: ClassCatalogItem[]): PlainObject {
  return {
    studentUid,
    attendanceNo: input.attendanceNo,
    loginId: input.attendanceNo,
    studentNo: input.attendanceNo,
    name: input.name,
    birthDate: input.birthDate,
    studentPhone: input.studentPhone,
    phone: input.studentPhone,
    parentPhone: input.parentPhone,
    enrollmentStatus: input.enrollmentStatus,
    status: input.enrollmentStatus,
    initialRegisteredDate: input.initialRegisteredDate,
    classIds: classes.map(item => item.classId),
    classNames: classes.map(item => item.className),
    instructorUids: classes.map(item => item.instructorUid),
    instructorNames: classes.map(item => item.instructorName),
    memo: input.memo,
    mustChangePassword: true,
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  };
}

function authPayload(studentUid: string, input: ValidStudentInput): PlainObject {
  return {
    studentUid,
    attendanceNo: input.attendanceNo,
    loginId: input.name,
    studentNo: input.attendanceNo,
    name: input.name,
    studentPhone: input.studentPhone,
    phone: input.studentPhone,
    birthDate: input.birthDate,
    status: input.enrollmentStatus,
    mustChangePassword: true,
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  };
}

function attendancePayload(studentUid: string, input: ValidStudentInput, enrollment: EnrollmentWrite): PlainObject {
  return {
    operation: "upsert",
    studentUid,
    studentName: input.name,
    attendanceNo: input.attendanceNo,
    classId: enrollment.classId,
    className: enrollment.className,
    instructorUid: enrollment.instructorUid,
    instructorName: enrollment.instructorName,
    startDate: enrollment.startDate,
    operationDate: enrollment.operationDate,
    registrationType: enrollment.registrationType,
    enrollmentStatus: enrollment.status,
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  };
}

function classMemberIdFor(studentUid: string, classId: string): string {
  return `member_${createHash("sha256").update(`${classId}|${studentUid}`, "utf8").digest("hex").slice(0, 40)}`;
}

function attendanceDocId(date: string, classId: string, studentUid: string): string {
  return sha("ATT", date, classId, studentUid);
}

function meaningfulSpecialStatus(type: RegistrationType): string {
  if (type === "new") return "신규";
  if (type === "class_move") return "반이동";
  return "";
}

function operationalDates(item: ClassCatalogItem, startDate: string): string[] {
  const today = seoulDate();
  return uniqueText(item.dates, 10)
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today && date >= startDate)
    .sort();
}

function operationalAttendanceData(
  studentUid: string,
  input: ValidStudentInput,
  item: ClassCatalogItem,
  date: string,
  actorUid: string
): PlainObject {
  const now = Date.now();
  return {
    sessionId: `${date}|${item.classId}`,
    sessionDate: date,
    date,
    classId: item.classId,
    className: item.className,
    teacherScopeKey: item.teacherScopeKey,
    teacherUid: item.instructorUid,
    instructor: item.instructorName,
    instructorName: item.instructorName,
    classroom: item.roomName || "데스크문의",
    roomName: item.roomName || "데스크문의",
    studentUid,
    studentIdentityKey: studentUid,
    studentKey: studentUid,
    studentName: input.name,
    name: input.name,
    studentNo: input.attendanceNo,
    attendanceNo: input.attendanceNo,
    studentPhone: input.studentPhone,
    parentPhone: input.parentPhone,
    status: "미체크",
    attendanceStatus: "미체크",
    specialStatus: meaningfulSpecialStatus(input.registrationType),
    enrollmentStatus: input.enrollmentStatus,
    registrationType: input.registrationType,
    active: input.enrollmentStatus !== "withdrawn",
    source: "student_management_v2",
    sourceOfTruth: "student_management_v2_firestore",
    sheetSyncState: "backup_0600",
    updatedByFirebaseUid: actorUid,
    updatedByRole: "superAdmin",
    updatedAtMs: now,
    updatedAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
    createdAt: FieldValue.serverTimestamp(),
    schemaVersion: 4,
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  };
}

function classMemberData(
  studentUid: string,
  input: ValidStudentInput,
  item: ClassCatalogItem,
  actorUid: string
): PlainObject {
  const now = Date.now();
  return {
    classId: item.classId,
    className: item.className,
    studentUid,
    studentName: input.name,
    studentIdentityKey: studentUid,
    instructorUids: [item.instructorUid],
    instructorUid: item.instructorUid,
    instructorName: item.instructorName,
    enrollmentStatus: input.enrollmentStatus === "leave" ? "hold" : input.enrollmentStatus,
    active: input.enrollmentStatus !== "withdrawn",
    source: "student_management_v2",
    directoryKind: "classMember",
    updatedByFirebaseUid: actorUid,
    updatedAtMs: now,
    updatedAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
    createdAt: FieldValue.serverTimestamp(),
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  };
}

function writeOperationalStudentData(
  transaction: Transaction,
  studentUid: string,
  input: ValidStudentInput,
  selected: ClassCatalogItem[],
  actorUid: string
): string[] {
const touchedDates = new Set<string>();
  for (const item of selected) {
    transaction.set(db().collection("classMembers").doc(classMemberIdFor(studentUid, item.classId)), classMemberData(studentUid, input, item, actorUid), { merge: true });
    for (const date of operationalDates(item, input.initialRegisteredDate)) {
      touchedDates.add(date);
      transaction.set(db().collection("staffOperationalRevisions").doc(date), { date, attendanceRevision: FieldValue.increment(1), reason: "student_membership_change_73550993", updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(db().collection("staffOperationalClassRevisions").doc(`${date}__${item.classId.replace(/\//g,"_")}`), { date, classId: item.classId, attendanceRevision: FieldValue.increment(1), reason: "student_membership_change_73550993", updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
  return Array.from(touchedDates);
}

async function refreshOperationalSnapshots(dates: string[], _requestId: string): Promise<{ refreshed: string[]; failed: string[] }> {
  return { refreshed: Array.from(new Set(dates)), failed: [] };
}

function resultWithoutPassword(result: PlainObject): PlainObject {
  const stored = { ...result };
  delete stored.initialPassword;
  return stored;
}

async function createStudentCore(caller: Caller, rawInput: PlainObject, forcedRequestId?: string): Promise<PlainObject> {
  await requireFeature("studentCoreV2Enabled");
  const input = validateStudentInput(rawInput, "new");
  // 7.35.5.0.27: a classless new student is an exact empty assignment. Never let
  // legacy class-name fallback make the student reappear in a regular roster.
  if (!input.classIds.length) input.preserveLegacyClassNames = [];
  const rid = forcedRequestId || requestIdValue(rawInput, "student-create-7352");
  const reqRef = requestRef("create", rid);
  const existingRequest = await reqRef.get();
  if (existingRequest.exists && existingRequest.data()?.state === "complete") {
    return { ...object(existingRequest.data()?.result), initialPassword: input.attendanceNo, reused: true };
  }
  await assertNoExistingDuplicate(input);
  const catalog = await loadAssignableClassCatalog73550976();
  const selected = resolveSelectedClasses(input.classIds, catalog);
  const studentUid = randomStudentUid();
  const now = Date.now();
  const enrollments = selected.map(item => enrollmentWrite(studentUid, item, input));
  const classNames = [...selected.map(item => item.className), ...input.preserveLegacyClassNames].filter((value, index, array) => array.indexOf(value) === index);
  const instructorNames = selected.map(item => item.instructorName).filter((value, index, array) => value && array.indexOf(value) === index);
  const instructorUids = selected.map(item => item.instructorUid).filter((value, index, array) => value && array.indexOf(value) === index);
  const audienceDetails7355034 = studentAudienceDetails7355034({ birthDate: input.birthDate, audienceGroupOverride: input.audienceGroupOverride });
  const operationalSnapshotDates: string[] = [];
  const result: PlainObject = {
    ok: true,
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION,
    studentUid,
    attendanceNo: input.attendanceNo,
    initialPassword: input.attendanceNo,
    dataSaveState: "complete",
    operationalSyncState: "complete",
    operationalSyncMessage: "앱 출석부와 태블릿 운영자료에 반영되었습니다.",
    sheetSyncState: "backup_0600",
    authSyncState: "pending",
    attendanceSyncState: "complete"
  };
  const phoneLockRef = db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("phone", input.phoneDigits));
  const hasNameBirthLock = Boolean(input.birthDate);
  const nameBirthLockRef = hasNameBirthLock
    ? db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("nameBirth", `${input.nameNormalized}|${input.birthDate}`))
    : null;
  const studentRef = db().collection(STUDENT_COLLECTION).doc(studentUid);
  const legacyAccountRef = db().collection("legacyAccounts").doc(safeLegacyAuthUid("student", studentUid));
  const transactionResult = await runTransactionResilient7355012(async transaction => {
    const refsToRead: DocumentReference[] = [reqRef, phoneLockRef];
    if (nameBirthLockRef) refsToRead.push(nameBirthLockRef);
    const snapshots = await transaction.getAll(...refsToRead);
    const snapshotByPath = new Map(snapshots.map(snapshot => [snapshot.ref.path, snapshot]));
    const requestSnapshot = snapshotByPath.get(reqRef.path);
    const phoneLock = snapshotByPath.get(phoneLockRef.path);
    const nameBirthLock = nameBirthLockRef ? snapshotByPath.get(nameBirthLockRef.path) : undefined;
    if (requestSnapshot?.exists && requestSnapshot.data()?.state === "complete") {
      return { reused: true, result: object(requestSnapshot.data()?.result) };
    }
    if (phoneLock?.exists) throw new HttpsError("already-exists", "같은 학생 전화번호로 등록된 학생이 있습니다.");
    if (nameBirthLock?.exists) throw new HttpsError("already-exists", "같은 학생명과 생년월일로 등록된 학생이 있습니다.");
    transaction.create(phoneLockRef, { kind: "phone", normalizedValue: input.phoneDigits, studentUid, active: true, createdAtMs: now, createdAt: FieldValue.serverTimestamp() });
    if (nameBirthLockRef) transaction.create(nameBirthLockRef, { kind: "nameBirth", normalizedValue: `${input.nameNormalized}|${input.birthDate}`, studentUid, active: true, createdAtMs: now, createdAt: FieldValue.serverTimestamp() });
    transaction.create(studentRef, {
      studentUid,
      name: input.name,
      studentName: input.name,
      nameNormalized: input.nameNormalized,
      birthDate: input.birthDate,
      studentPhone: input.studentPhone,
      phone: input.studentPhone,
      phoneDigits: input.phoneDigits,
      parentPhone: input.parentPhone,
      parentPhoneDigits: input.parentPhoneDigits,
      attendanceNo: input.attendanceNo,
      loginId: input.attendanceNo,
      studentNo: input.attendanceNo,
      enrollmentStatus: input.enrollmentStatus,
      status: input.enrollmentStatus,
      initialRegisteredDate: input.initialRegisteredDate,
      privacyConsent: input.privacyConsent,
      portraitConsent: input.portraitConsent,
      mustChangePassword: true,
      initialPasswordChanged: false,
      classUids: selected.map(item => item.classId),
      classNames,
      instructorUids,
      instructorNames,
      audienceGroup: audienceDetails7355034.group,
      ...(audienceDetails7355034.override ? { audienceGroupOverride: audienceDetails7355034.override } : {}),
      audienceGroupSource: audienceDetails7355034.source,
      memo: input.memo,
      sheetSnapshot: {},
      localOverrides: {},
      dataSaveState: "complete",
      operationalSyncState: "complete",
      operationalSyncMessage: "앱 출석부와 태블릿 운영자료에 반영되었습니다.",
      sheetSyncState: "backup_0600",
      authSyncState: "pending",
      attendanceSyncState: "complete",
      lastRegistrationType: input.classIds.length ? input.registrationType : "existing",
      lastRegistrationOperationDate: input.classIds.length ? input.initialRegisteredDate : "",
      source: "student_management_v2",
      schemaVersion: 2,
      createdByFirebaseUid: caller.uid,
      createdAtMs: now,
      createdAt: FieldValue.serverTimestamp(),
      updatedByFirebaseUid: caller.uid,
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
    });
    transaction.set(legacyAccountRef, {
      legacyUid: studentUid,
      role: "student",
      active: input.enrollmentStatus !== "withdrawn",
      sessionVersion: 1,
      studentUid,
      source: "student_management_v2",
      directoryKind: "legacyAccount",
      createdAtMs: now,
      createdAt: FieldValue.serverTimestamp(),
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
    }, { merge: true });
    for (const enrollment of enrollments) {
      transaction.create(db().collection(ENROLLMENT_COLLECTION).doc(enrollment.enrollmentId), {
        ...enrollment,
        active: enrollment.status !== "ended",
        source: "student_management_v2",
        schemaVersion: 1,
        createdByFirebaseUid: caller.uid,
        createdAtMs: now,
        createdAt: FieldValue.serverTimestamp(),
        updatedByFirebaseUid: caller.uid,
        updatedAtMs: now,
        updatedAt: FieldValue.serverTimestamp(),
        version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
      });
    }
    writeOperationalStudentData(transaction, studentUid, input, selected, caller.uid);
    const authJob = jobData(rid, "student_auth_create", studentUid, authPayload(studentUid, input), caller.uid);
    transaction.create(db().collection(JOB_COLLECTION).doc(text(authJob.jobId, 100)), authJob);
    transaction.set(reqRef, {
      kind: "create",
      requestId: rid,
      idempotencyKey: rid,
      state: "complete",
      studentUid,
      result: resultWithoutPassword(result),
      actorUid: caller.uid,
      createdAtMs: now,
      completedAtMs: now,
      createdAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
      version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
    }, { merge: true });
    return { reused: false, result: resultWithoutPassword(result) };
  });
  if (transactionResult.reused) {
    return { ...transactionResult.result, initialPassword: input.attendanceNo, reused: true };
  }
  const refresh = await refreshOperationalSnapshots(operationalSnapshotDates, rid);
  if (refresh.failed.length) {
    await studentRef.set({
      operationalSyncState: "pending",
      operationalSyncMessage: "운영자료 저장은 완료되었으며 태블릿 목록은 자동 재생성 중입니다.",
      operationalRefreshFailedDates: refresh.failed,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    result.operationalSyncState = "pending";
  }
  return { ...result, operationalRefreshedDates: refresh.refreshed, operationalRefreshFailedDates: refresh.failed };
}

function enrollmentPublic(doc: QueryDocumentSnapshot): PlainObject {
  const data = doc.data() ?? {};
  return {
    enrollmentId: text(data.enrollmentId, 100) || doc.id,
    studentUid: text(data.studentUid, 128),
    classId: text(data.classId, 180),
    className: text(data.className, 300),
    instructorUid: text(data.instructorUid, 160),
    instructorName: text(data.instructorName, 120),
    startDate: safeDate(data.startDate),
    endDate: safeDate(data.endDate),
    status: text(data.status, 30),
    registrationType: text(data.registrationType, 30),
    active: data.active !== false
  };
}

function jobPublic(doc: QueryDocumentSnapshot): PlainObject {
  const data = doc.data() ?? {};
  return {
    jobId: doc.id,
    studentUid: text(data.studentUid, 128),
    jobType: text(data.jobType, 50),
    state: text(data.state, 30),
    attempts: Number(data.attempts || 0),
    maxAttempts: Number(data.maxAttempts || JOB_MAX_ATTEMPTS),
    lastError: text(data.lastError, 1500),
    nextAttemptAtMs: Number(data.nextAttemptAtMs || 0),
    updatedAtMs: Number(data.updatedAtMs || 0)
  };
}

function latestJobState(jobs: PlainObject[], type: JobType): PlainObject {
  const matches = jobs.filter(job => text(job.jobType, 50) === type).sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
  if (!matches.length) return { state: "complete", retryable: false, message: "" };
  if (type === "attendance_roster_apply") {
    if (matches.some(job => job.state === "failed")) return { state: "failed", retryable: true, message: text(matches.find(job => job.state === "failed")?.lastError, 1000) };
    if (matches.some(job => job.state === "pending" || job.state === "processing")) return { state: "pending", retryable: false, message: "" };
    return { state: "complete", retryable: false, message: "" };
  }
  const latest = matches[0];
  return {
    state: text(latest.state, 30) || "complete",
    retryable: latest.state === "failed",
    message: text(latest.lastError, 1000),
    jobId: text(latest.jobId, 100)
  };
}

function studentPublic(doc: QueryDocumentSnapshot, enrollments: PlainObject[], jobs: PlainObject[], catalog: ClassCatalogItem[]): PlainObject {
  const data = doc.data() ?? {};
  const activeEnrollments = enrollments.filter(enrollment => enrollment.active !== false && enrollment.status !== "ended");
  const catalogByName = new Map<string, ClassCatalogItem[]>();
  catalog.forEach(item => {
    const key = normalize(item.className);
    const rows = catalogByName.get(key) || [];
    rows.push(item);
    catalogByName.set(key, rows);
  });
  const explicitCurrentAssignments7355015 =
    Array.isArray(data.classUids) ||
    Array.isArray(data.classIds) ||
    Array.isArray(data.classNames);
  const currentClassIds7355015 = uniqueText(
    Array.isArray(data.classUids) ? data.classUids : data.classIds,
    180
  ).filter(classId => catalog.some(item => item.classId === classId));
  const currentClassNames7355015 = uniqueText(data.classNames ?? data.currentClass ?? data.className, 300);
  const selectedClassIds = new Set(
    explicitCurrentAssignments7355015
      ? currentClassIds7355015
      : activeEnrollments.map(enrollment => text(enrollment.classId, 180)).filter(Boolean)
  );
  const legacyUnmappedClassNames: string[] = [];
  currentClassNames7355015.forEach(className => {
    const matches = catalogByName.get(normalize(className)) || [];
    if (matches.length === 1) selectedClassIds.add(matches[0].classId);
    else if (!explicitCurrentAssignments7355015 && !activeEnrollments.some(enrollment => normalize(enrollment.className) === normalize(className))) {
      legacyUnmappedClassNames.push(className);
    } else if (explicitCurrentAssignments7355015 && matches.length !== 1) {
      legacyUnmappedClassNames.push(className);
    }
  });
  const selectedCatalogItems7355015 = catalog.filter(item => selectedClassIds.has(item.classId));
  const publicClassNames7355015 = explicitCurrentAssignments7355015
    ? Array.from(new Set([
        ...selectedCatalogItems7355015.map(item => item.className),
        ...currentClassNames7355015
      ])).filter(Boolean)
    : activeEnrollments.map(enrollment => text(enrollment.className, 300)).filter(Boolean);
  const publicInstructorNames7355015 = explicitCurrentAssignments7355015
    ? Array.from(new Set([
        ...selectedCatalogItems7355015.map(item => item.instructorName).filter(Boolean),
        ...uniqueText(data.instructorNames ?? data.instructorName ?? data.instructor, 120)
      ]))
    : activeEnrollments.map(enrollment => text(enrollment.instructorName, 120)).filter(Boolean);
  // Sync state is materialized on the student document by updateStudentJobState().
  // Avoid scanning the entire studentOperationJobs collection on every list load.
  const effectiveSheetState = { state: text(data.sheetSyncState, 30) || "backup_0600", retryable: false, message: text(data.sheetSyncMessage, 1000) };
  const authState = { state: text(data.authSyncState, 30) || "complete", retryable: text(data.authSyncState, 30) === "failed", message: text(data.authSyncMessage, 1000) };
  const attendanceState = { state: text(data.attendanceSyncState, 30) || "complete", retryable: text(data.attendanceSyncState, 30) === "failed", message: text(data.attendanceSyncMessage, 1000) };
  const name = text(data.name ?? data.studentName, 100);
  const attendanceNo = text(data.attendanceNo ?? data.loginId ?? data.studentNo, 50);
  return {
    studentUid: text(data.studentUid, 128) || doc.id,
    name,
    birthDate: safeDate(data.birthDate ?? data.dateOfBirth),
    audienceGroup: studentAudienceDetails7355034(data).group,
    audienceGroupAuto: studentAudienceDetails7355034(data).autoGroup,
    audienceGroupOverride: studentAudienceDetails7355034(data).override,
    audienceGroupSource: studentAudienceDetails7355034(data).source,
    studentPhone: text(data.studentPhone ?? data.phone, 60),
    parentPhone: text(data.parentPhone, 60),
    attendanceNo,
    enrollmentStatus: statusValue(data.enrollmentStatus ?? data.status),
    initialRegisteredDate: safeDate(data.initialRegisteredDate ?? data.registeredDate ?? data.createdDate),
    privacyConsent: data.privacyConsent === true,
    portraitConsent: data.portraitConsent === true,
    discoverySource: text(data.discoverySource, 200),
    discoveryEtc: text(data.discoveryEtc, 300),
    paymentMethod: text(data.paymentMethod, 100),
    refundPolicyAccepted: data.refundPolicyAccepted === true,
    rulesAccepted: data.rulesAccepted === true,
    voiceSamplingConsent: data.voiceSamplingConsent === true,
    voiceSocialUploadConsent: data.voiceSocialUploadConsent === true,
    voiceExternalSampleConsent: data.voiceExternalSampleConsent === true,
    registrationApplicationId: text(data.registrationApplicationId, 180),
    registrationSource: text(data.registrationSource, 80),
    mustChangePassword: data.mustChangePassword !== false && data.initialPasswordChanged !== true,
    memo: text(data.memo, 2000),
    enrollments: activeEnrollments,
    selectedClassIds: Array.from(selectedClassIds),
    legacyUnmappedClassNames,
    classNames: publicClassNames7355015,
    instructorNames: publicInstructorNames7355015,
    dataSaveState: "complete",
    operationalSyncState: text(data.operationalSyncState, 30) || "complete",
    operationalSyncMessage: text(data.operationalSyncMessage, 1000),
    sheetSyncState: effectiveSheetState.state,
    sheetSyncMessage: effectiveSheetState.message,
    authSyncState: authState.state,
    authSyncMessage: authState.message,
    attendanceSyncState: attendanceState.state,
    attendanceSyncMessage: attendanceState.message,
    retryable: Boolean(effectiveSheetState.retryable || authState.retryable || attendanceState.retryable),
    source: text(data.source, 60),
    incomplete: !name || !attendanceNo
  };
}

async function updateStudentCore(caller: Caller, rawInput: PlainObject, forcedRequestId?: string): Promise<PlainObject> {
  await requireFeature("studentCoreV2Enabled");
  const studentUid = text(rawInput.studentUid, 128);
  if (!studentUid) throw new HttpsError("invalid-argument", "학생 UID가 필요합니다.");
  const rid = forcedRequestId || requestIdValue(rawInput, "student-update-7352");
  const reqRef = requestRef("update", rid);
  const existingRequest = await reqRef.get();
  if (existingRequest.exists && existingRequest.data()?.state === "complete") return { ...object(existingRequest.data()?.result), reused: true };
  const studentRef = db().collection(STUDENT_COLLECTION).doc(studentUid);
  const legacyAccountRef = db().collection("legacyAccounts").doc(safeLegacyAuthUid("student", studentUid));
  const [studentSnapshot, enrollmentSnapshot, classMemberSnapshot] = await Promise.all([
    studentRef.get(),
    db().collection(ENROLLMENT_COLLECTION).where("studentUid", "==", studentUid).limit(500).get(),
    db().collection("classMembers").where("studentUid", "==", studentUid).limit(500).get()
  ]);
  if (!studentSnapshot.exists) throw new HttpsError("not-found", "학생정보를 찾을 수 없습니다.");
  const current = studentSnapshot.data() ?? {};
  const mergedInput: PlainObject = {
    ...rawInput,
    initialRegisteredDate: rawInput.initialRegisteredDate ?? current.initialRegisteredDate ?? current.registeredDate ?? seoulDate(),
    studentPhone: rawInput.studentPhone ?? rawInput.phone ?? current.studentPhone ?? current.phone,
    parentPhone: rawInput.parentPhone ?? current.parentPhone,
    birthDate: rawInput.birthDate ?? current.birthDate,
    name: rawInput.name ?? current.name ?? current.studentName,
    enrollmentStatus: rawInput.enrollmentStatus ?? rawInput.status ?? current.enrollmentStatus ?? current.status,
    memo: rawInput.memo ?? current.memo,
    privacyConsent: rawInput.privacyConsent ?? current.privacyConsent,
    portraitConsent: rawInput.portraitConsent ?? current.portraitConsent,
    audienceGroupOverride: Object.prototype.hasOwnProperty.call(rawInput, "audienceGroupOverride")
      ? rawInput.audienceGroupOverride
      : current.audienceGroupOverride
  };
  const input = validateStudentInput(mergedInput, "existing");
  const currentAttendanceNo = text(current.attendanceNo ?? current.loginId ?? current.studentNo, 50).replace(/\D/g, "");
  const attendanceNoChangeRequested = booleanValue(rawInput.changeAttendanceNo, false);
  const requestedAttendanceNo = text(rawInput.attendanceNo ?? rawInput.studentNo ?? rawInput.loginId, 50).replace(/\D/g, "");
  // 출결번호는 학생 전화번호와 독립적으로 관리자 화면에서 명시적으로 수정합니다.
  // 전화번호만 수정한 경우 기존 출결번호를 유지합니다.
  if (attendanceNoChangeRequested) {
    if (!/^\d{4}$/.test(requestedAttendanceNo)) {
      throw new HttpsError("invalid-argument", "출결번호는 숫자 4자리로 입력해주세요.");
    }
    input.attendanceNo = requestedAttendanceNo;
  } else {
    input.attendanceNo = currentAttendanceNo || input.phoneDigits.slice(-4);
  }
  const oldPhoneDigits = normalizePhone(current.phoneDigits ?? current.studentPhone ?? current.phone);
  const oldNameNormalized = normalizeName(current.nameNormalized ?? current.name ?? current.studentName);
  const oldBirthDate = safeDate(current.birthDate);
  const currentStatus = statusValue(current.enrollmentStatus ?? current.status);
  const authRelevantChanged = oldPhoneDigits !== input.phoneDigits || oldNameNormalized !== input.nameNormalized ||
    oldBirthDate !== input.birthDate || currentStatus !== input.enrollmentStatus || currentAttendanceNo !== input.attendanceNo;
  if (authRelevantChanged) await assertNoExistingDuplicate(input, studentUid);
  const catalog = await appendAssignableEnrollmentClasses73550976(await loadClassCatalog(), enrollmentSnapshot.docs);
  const catalogByLegacyName = new Map<string, ClassCatalogItem[]>();
  catalog.forEach(item => {
    const key = normalize(item.className);
    const rows = catalogByLegacyName.get(key) || [];
    rows.push(item);
    catalogByLegacyName.set(key, rows);
  });
  const currentLegacyNames = uniqueText(current.classNames ?? current.currentClass ?? current.className, 300);
  const currentLegacyUnmappedNames: string[] = [];
  currentLegacyNames.forEach(className => {
    const matches = catalogByLegacyName.get(normalize(className)) || [];
    if (matches.length !== 1) currentLegacyUnmappedNames.push(className);
  });
  const replaceClassAssignments = booleanValue(rawInput.replaceClassAssignments, false);
  const operationDate = dateValue(rawInput.operationDate, "처리일", false);
  input.preserveLegacyClassNames = replaceClassAssignments
    ? []
    : Array.from(new Set([
        ...input.preserveLegacyClassNames,
        ...currentLegacyUnmappedNames
      ]));
  const selected = resolveSelectedClasses(input.classIds, catalog);
  const existingDocs = enrollmentSnapshot.docs;
  const activeExisting = existingDocs.filter(doc => {
    const data = doc.data() ?? {};
    return data.active !== false && text(data.status, 30) !== "ended";
  });
  const selectedIds = new Set(selected.map(item => item.classId));
  const removed = activeExisting.filter(doc => !selectedIds.has(text(doc.data()?.classId, 180)));
  const removedClassIds = new Set(removed.map(doc => text(doc.data()?.classId, 180)).filter(Boolean));
  let overrideDocs: QueryDocumentSnapshot<DocumentData>[] = [];
  if (removedClassIds.size) {
    const overrideSnapshot = await db().collection("attendanceSessionOverrides").where("studentUid", "==", studentUid).limit(1000).get();
    overrideDocs = overrideSnapshot.docs.filter(doc => removedClassIds.has(text(doc.data()?.classId, 180)));
  }
  if (selected.length > 50 || removed.length > 50 || classMemberSnapshot.docs.length > 100 || overrideDocs.length > 200) {
    throw new HttpsError("failed-precondition", "학생의 수강관계 문서가 비정상적으로 많아 관리자 점검이 필요합니다.");
  }
  const currentByClass = new Map<string, { doc: QueryDocumentSnapshot<DocumentData>; data: DocumentData }>(
    existingDocs.map(doc => [text(doc.data()?.classId, 180), { doc, data: doc.data() ?? {} }])
  );
  const newlyActivatedClassIds7355049 = selected.filter(item => {
    const existing = currentByClass.get(item.classId)?.data;
    return !existing || existing.active === false || text(existing.status, 30) === "ended" || text(existing.status, 30) === "withdrawn";
  }).map(item => item.classId);
  const membershipChanged7355049 = newlyActivatedClassIds7355049.length > 0 || removed.length > 0;
  if (input.registrationType === "new") {
    if (!newlyActivatedClassIds7355049.length) {
      throw new HttpsError("invalid-argument", "신규 추가로 처리할 새 수강반이 없습니다. 일반 수정은 처리구분을 '일반 수정'으로 선택해주세요.");
    }
    if (removed.length) {
      throw new HttpsError("invalid-argument", "신규 추가는 기존 수강반을 유지합니다. 기존 반을 종료하려면 반이동 또는 일반 수정을 사용해주세요.");
    }
    if (!operationDate) throw new HttpsError("invalid-argument", "신규 추가 처리일을 선택해주세요.");
  }
  if (input.registrationType === "class_move") {
    if (!membershipChanged7355049 || !newlyActivatedClassIds7355049.length) {
      throw new HttpsError("invalid-argument", "반이동 처리에는 실제 새 수강반이 필요합니다.");
    }
    if (!operationDate) throw new HttpsError("invalid-argument", "반이동 처리일을 선택해주세요.");
  }
  const writes = selected.map(item => {
    const existing = currentByClass.get(item.classId)?.data;
    const existingActive = Boolean(existing && existing.active !== false && text(existing.status, 30) !== "ended" && text(existing.status, 30) !== "withdrawn");
    const write = enrollmentWrite(studentUid, item, input, existing);
    if (!existingActive) {
      write.startDate = (input.registrationType === "new" || input.registrationType === "class_move")
        ? operationDate
        : (operationDate || seoulDate());
      write.endDate = "";
      write.operationDate = (input.registrationType === "new" || input.registrationType === "class_move") ? operationDate : "";
      write.registrationType = (input.registrationType === "new" || input.registrationType === "class_move") ? input.registrationType : "existing";
    }
    return write;
  });
  // __ULIM_CLASS_MOVE_ENROLLMENT_DATE_73550971__
  // 신규/반이동의 operationDate는 학생의 최초 등록일과 별개인 "해당 반 수강 시작일"이다.
  // 과거에 같은 반을 다닌 enrollment 문서가 남아 있어도, 이번에 새로 추가된 반이면
  // 예전 startDate/registrationType을 재사용하지 않고 이번 처리일과 처리구분으로 갱신한다.
  const operationDate73550971 = dateValue(rawInput.operationDate, "처리일", false);
  const lifecycleOperation73550971 = Boolean(operationDate73550971) && (input.registrationType === "new" || input.registrationType === "class_move");
  // __ULIM_CLASS_MOVE_NAME_METADATA_73550973__
  const lifecycleTargetClassId73550973 = text(rawInput.lifecycleTargetClassId, 180);
  const originalClassIds73550971 = new Set(uniqueText(rawInput.originalClassIds, 180));
  if (!originalClassIds73550971.size) {
    activeExisting.forEach(doc => { const classId73550971 = text(doc.data()?.classId, 180); if (classId73550971) originalClassIds73550971.add(classId73550971); });
  }
  if (lifecycleOperation73550971) {
    writes.forEach(write => {
      const lifecycleDestination73550973 = lifecycleTargetClassId73550973
        ? write.classId === lifecycleTargetClassId73550973
        : !originalClassIds73550971.has(write.classId);
      if (!lifecycleDestination73550973) return;
      write.startDate = operationDate73550971;
      write.registrationType = input.registrationType;
      write.endDate = "";
      write.status = enrollmentStatusForStudent(input.enrollmentStatus);
    });
  }
  const newClassIds = writes.filter(write => lifecycleOperation73550971
    ? !originalClassIds73550971.has(write.classId)
    : !currentByClass.has(write.classId)).map(write => write.classId);
  const newClassIdSet = new Set(newClassIds);
  const removedEndDate = calendarDateOffset7355033(operationDate || seoulDate(), -1);
  const classNames = [...selected.map(item => item.className), ...input.preserveLegacyClassNames].filter((value, index, array) => array.indexOf(value) === index);
  const instructorNames = selected.map(item => item.instructorName).filter((value, index, array) => value && array.indexOf(value) === index);
  const instructorUids = selected.map(item => item.instructorUid).filter((value, index, array) => value && array.indexOf(value) === index);
  const audienceDetails7355034 = studentAudienceDetails7355034({ birthDate: input.birthDate, audienceGroupOverride: input.audienceGroupOverride });
  const operationalSnapshotDates: string[] = [];
  const oldPhoneRef = oldPhoneDigits ? db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("phone", oldPhoneDigits)) : null;
  const oldNameBirthRef = oldNameNormalized && oldBirthDate ? db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("nameBirth", `${oldNameNormalized}|${oldBirthDate}`)) : null;
  const newPhoneRef = db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("phone", input.phoneDigits));
  const hasNewNameBirthLock = Boolean(input.birthDate);
  const newNameBirthRef = hasNewNameBirthLock
    ? db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("nameBirth", `${input.nameNormalized}|${input.birthDate}`))
    : null;
  const now = Date.now();
  const result: PlainObject = {
    ok: true,
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION,
    studentUid,
    dataSaveState: "complete",
    operationalSyncState: "complete",
    operationalSyncMessage: "앱 출석부와 태블릿 운영자료에 반영되었습니다.",
    sheetSyncState: "backup_0600",
    authSyncState: authRelevantChanged ? "pending" : (text(current.authSyncState, 30) || "complete"),
    attendanceSyncState: "complete"
  };
  await runTransactionResilient7355012(async transaction => {
    const refsToRead: DocumentReference[] = [reqRef, studentRef, newPhoneRef, legacyAccountRef, ...writes.map(write => db().collection(ENROLLMENT_COLLECTION).doc(write.enrollmentId))];
    if (newNameBirthRef) refsToRead.push(newNameBirthRef);
    if (oldPhoneRef && oldPhoneRef.path !== newPhoneRef.path) refsToRead.push(oldPhoneRef);
    if (oldNameBirthRef && (!newNameBirthRef || oldNameBirthRef.path !== newNameBirthRef.path)) refsToRead.push(oldNameBirthRef);
    const dedupedRefs = Array.from(new Map(refsToRead.map(ref => [ref.path, ref])).values());
    const snapshots = await transaction.getAll(...dedupedRefs);
    const snapshotByPath = new Map(snapshots.map(snapshot => [snapshot.ref.path, snapshot]));
    const requestSnapshot = snapshotByPath.get(reqRef.path);
    const freshStudent = snapshotByPath.get(studentRef.path);
    const newPhoneSnapshot = snapshotByPath.get(newPhoneRef.path);
    const newNameBirthSnapshot = newNameBirthRef ? snapshotByPath.get(newNameBirthRef.path) : undefined;
    if (requestSnapshot?.exists && requestSnapshot.data()?.state === "complete") return;
    if (!freshStudent?.exists) throw new HttpsError("not-found", "학생정보를 찾을 수 없습니다.");
    const phoneOwner = text(newPhoneSnapshot?.data()?.studentUid, 128);
    const nameBirthOwner = text(newNameBirthSnapshot?.data()?.studentUid, 128);
    if (newPhoneSnapshot?.exists && phoneOwner !== studentUid) throw new HttpsError("already-exists", "같은 학생 전화번호로 등록된 학생이 있습니다.");
    if (newNameBirthSnapshot?.exists && nameBirthOwner !== studentUid) throw new HttpsError("already-exists", "같은 학생명과 생년월일로 등록된 학생이 있습니다.");
    transaction.set(newPhoneRef, { kind: "phone", normalizedValue: input.phoneDigits, studentUid, active: true, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (newNameBirthRef) transaction.set(newNameBirthRef, { kind: "nameBirth", normalizedValue: `${input.nameNormalized}|${input.birthDate}`, studentUid, active: true, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (oldPhoneRef && oldPhoneRef.path !== newPhoneRef.path) transaction.delete(oldPhoneRef);
    if (oldNameBirthRef && (!newNameBirthRef || oldNameBirthRef.path !== newNameBirthRef.path)) transaction.delete(oldNameBirthRef);
    transaction.set(studentRef, {
      name: input.name,
      studentName: input.name,
      nameNormalized: input.nameNormalized,
      birthDate: input.birthDate,
      studentPhone: input.studentPhone,
      phone: input.studentPhone,
      phoneDigits: input.phoneDigits,
      parentPhone: input.parentPhone,
      parentPhoneDigits: input.parentPhoneDigits,
      attendanceNo: input.attendanceNo,
      loginId: input.attendanceNo,
      studentNo: input.attendanceNo,
      enrollmentStatus: input.enrollmentStatus,
      status: input.enrollmentStatus,
      initialRegisteredDate: input.initialRegisteredDate,
      privacyConsent: input.privacyConsent,
      portraitConsent: input.portraitConsent,
      classUids: selected.map(item => item.classId),
      classNames,
      instructorUids,
      instructorNames,
      audienceGroup: audienceDetails7355034.group,
      audienceGroupOverride: audienceDetails7355034.override || FieldValue.delete(),
      audienceGroupSource: audienceDetails7355034.source,
      memo: input.memo,
      dataSaveState: "complete",
      operationalSyncState: "complete",
      operationalSyncMessage: "앱 출석부와 태블릿 운영자료에 반영되었습니다.",
      sheetSyncState: "backup_0600",
      authSyncState: authRelevantChanged ? "pending" : (text(current.authSyncState, 30) || "complete"),
      authSyncMessage: authRelevantChanged ? "학생 로그인 정보 갱신 대기" : text(current.authSyncMessage, 1000),
      attendanceSyncState: "complete",
      lastRegistrationType: input.registrationType,
      lastRegistrationOperationDate: operationDate || text(current.lastRegistrationOperationDate, 20),
      source: text(current.source, 60) || "student_management_v2",
      schemaVersion: Math.max(2, Number(current.schemaVersion || 0)),
      updatedByFirebaseUid: caller.uid,
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
    }, { merge: true });
    transaction.set(legacyAccountRef, {
      legacyUid: studentUid,
      role: "student",
      active: input.enrollmentStatus !== "withdrawn",
      studentUid,
      source: "student_management_v2",
      directoryKind: "legacyAccount",
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
    }, { merge: true });
    removed.forEach(doc => {
      transaction.set(doc.ref, {
        active: false,
        status: "ended",
        endDate: removedEndDate,
        endOperationDate: operationDate || seoulDate(),
        endedBy: "student_management_realtime_7355049",
        updatedByFirebaseUid: caller.uid,
        updatedAtMs: now,
        updatedAt: FieldValue.serverTimestamp(),
        version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
      }, { merge: true });
    });
    classMemberSnapshot.docs.forEach(doc => {
      const classId = text(doc.data()?.classId, 180);
      if (!removedClassIds.has(classId)) return;
      transaction.set(doc.ref, {
        active: false,
        enrollmentStatus: "ended",
        endedBy: "student_management_realtime_7355049",
        endOperationDate: operationDate || seoulDate(),
        updatedAtMs: now,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    overrideDocs.forEach(doc => {
      const classId = text(doc.data()?.classId, 180);
      if (!removedClassIds.has(classId)) return;
      transaction.set(doc.ref, {
        included: false,
        excluded: true,
        active: false,
        reason: "student_class_removed_73550",
        updatedAtMs: now,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    writes.forEach(write => {
      const ref = db().collection(ENROLLMENT_COLLECTION).doc(write.enrollmentId);
      const existed = currentByClass.has(write.classId);
      const membershipStartedNow = !existed || newClassIdSet.has(write.classId);
      transaction.set(ref, {
        ...write,
        active: write.status !== "ended",
        source: "student_management_v2",
        schemaVersion: 1,
        ...(membershipStartedNow ? { createdByFirebaseUid: caller.uid, createdAtMs: now, createdAt: FieldValue.serverTimestamp() } : {}),
        updatedByFirebaseUid: caller.uid,
        updatedAtMs: now,
        updatedAt: FieldValue.serverTimestamp(),
        version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
      }, { merge: true });
    });
    writeOperationalStudentData(transaction, studentUid, input, selected, caller.uid);
    if (authRelevantChanged) {
      const authJob = jobData(rid, "student_auth_create", studentUid, authPayload(studentUid, input), caller.uid);
      transaction.create(db().collection(JOB_COLLECTION).doc(text(authJob.jobId, 100)), authJob);
    }
    transaction.set(reqRef, {
      kind: "update",
      requestId: rid,
      idempotencyKey: rid,
      state: "complete",
      studentUid,
      result,
      actorUid: caller.uid,
      createdAtMs: now,
      completedAtMs: now,
      createdAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
      version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
    }, { merge: true });
  });
  await db().collection("tabletDailySnapshots").doc(seoulDate()).set({
    version: "invalidated-student-update-7355018",
    invalidatedByStudentUid: studentUid,
    invalidatedAtMs: Date.now(),
    invalidatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  const refresh = await refreshOperationalSnapshots(operationalSnapshotDates, rid);
  if (refresh.failed.length) {
    await studentRef.set({
      operationalSyncState: "pending",
      operationalSyncMessage: "운영자료 저장은 완료되었으며 태블릿 목록은 자동 재생성 중입니다.",
      operationalRefreshFailedDates: refresh.failed,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    result.operationalSyncState = "pending";
  }
  return { ...result, operationalRefreshedDates: refresh.refreshed, operationalRefreshFailedDates: refresh.failed };
}

async function updateStudentJobState(studentUid: string, jobType: JobType, state: JobState, message: string, result: PlainObject = {}): Promise<void> {
  const patch: PlainObject = {
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  };
  if (["student_sheet_create", "student_sheet_update", "student_sheet_retire"].includes(jobType)) {
    patch.sheetSyncState = state;
    patch.sheetSyncMessage = message;
    if (state === "complete") {
      patch.sheetSyncedAtMs = Date.now();
      patch.sheetSyncedAt = FieldValue.serverTimestamp();
      patch.sheetRow = Number(result.rowNumber || 0);
      patch.sourceSheetRow = Number(result.rowNumber || 0);
      patch.sourceSheet = "학생명단";
    }
  } else if (["student_auth_create", "student_auth_disable"].includes(jobType)) {
    patch.authSyncState = state;
    patch.authSyncMessage = message;
  } else {
    patch.attendanceSyncState = state;
    patch.attendanceSyncMessage = message;
  }
  await db().collection(STUDENT_COLLECTION).doc(studentUid).set(patch, { merge: true });
}

function parseJob(snapshot: QueryDocumentSnapshot | { id: string; data(): DocumentData }): {
  jobId: string;
  studentUid: string;
  jobType: JobType;
  action: string;
  state: JobState;
  payload: PlainObject;
  attempts: number;
  maxAttempts: number;
  nextAttemptAtMs: number;
  leaseUntilMs: number;
} {
  const data = snapshot.data() ?? {};
  const jobType = text(data.jobType, 50) as JobType;
  if (!["student_sheet_create", "student_sheet_update", "student_auth_create", "attendance_roster_apply", "student_sheet_retire", "student_auth_disable", "attendance_roster_remove"].includes(jobType)) {
    throw new Error("UNKNOWN_STUDENT_JOB_TYPE");
  }
  const state = text(data.state, 30) as JobState;
  return {
    jobId: snapshot.id,
    studentUid: text(data.studentUid, 128),
    jobType,
    action: text(data.action, 100) || jobAction(jobType),
    state,
    payload: object(data.payload),
    attempts: Number(data.attempts || 0),
    maxAttempts: Number(data.maxAttempts || JOB_MAX_ATTEMPTS),
    nextAttemptAtMs: Number(data.nextAttemptAtMs || 0),
    leaseUntilMs: Number(data.leaseUntilMs || 0)
  };
}

async function claimJob(ref: DocumentReference): Promise<ReturnType<typeof parseJob> | null> {
  return db().runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const job = parseJob({ id: snapshot.id, data: () => snapshot.data() ?? {} });
    const now = Date.now();
    if (job.state === "complete" || job.state === "failed") return null;
    if (job.state === "processing" && job.leaseUntilMs > now) return null;
    if (job.nextAttemptAtMs > now) return null;
    transaction.set(ref, {
      state: "processing" satisfies JobState,
      attempts: FieldValue.increment(1),
      leaseUntilMs: now + JOB_LEASE_MS,
      processingStartedAtMs: now,
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { ...job, state: "processing" as JobState, attempts: job.attempts + 1 };
  });
}

async function processJobRef(ref: DocumentReference): Promise<boolean> {
  const job = await claimJob(ref);
  if (!job) return false;
  if (!["student_auth_create", "student_auth_disable"].includes(job.jobType)) {
    const result = { status: "retired", dataAuthority: "firestore", reason: "retired_non_auth_sync_73550993" };
    await Promise.all([ref.set({ state: "complete" satisfies JobState, result, lastError: "", nextAttemptAtMs: 0, leaseUntilMs: 0, completedAtMs: Date.now(), completedAt: FieldValue.serverTimestamp(), updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }), updateStudentJobState(job.studentUid, job.jobType, "complete", "Firestore 원본 전환으로 운영 동기화 작업을 종료했습니다.", result)]);
    return true;
  }
  // FIRESTORE_PRIMARY_JOB_SKIP_73550: Sheets and materialized attendance rosters are replaced by 06:00 backup and derived roster reads.
  if (["student_sheet_create", "student_sheet_update", "student_sheet_retire", "attendance_roster_apply", "attendance_roster_remove"].includes(job.jobType)) {
    await ref.set({ state: "complete", result: { skipped: true, reason: "FIRESTORE_PRIMARY_73550" }, lastError: "", nextAttemptAtMs: 0, leaseUntilMs: 0, completedAtMs: Date.now(), completedAt: FieldValue.serverTimestamp(), updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await updateStudentJobState(job.studentUid, job.jobType, "complete", "매일 오전 6시 백업으로 처리됩니다.", {});
    return true;
  }
  try {
    if (!["student_auth_create", "student_auth_disable"].includes(job.jobType)) {
      throw new Error("NON_AUTH_STUDENT_SYNC_RETIRED_73550998");
    }
    const result = await upsertStudentFirebaseDirectCredential7355030(job.studentUid);
    const message = "Firebase 학생 로그인 계정 동기화 완료";
    await Promise.all([
      ref.set({
        state: "complete" satisfies JobState,
        result,
        lastError: "",
        nextAttemptAtMs: 0,
        leaseUntilMs: 0,
        completedAtMs: Date.now(),
        completedAt: FieldValue.serverTimestamp(),
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true }),
      updateStudentJobState(job.studentUid, job.jobType, "complete", message, result)
    ]);
    return true;
  } catch (error) {
    const message = text(error instanceof Error ? error.message : error, 1500);
    const terminal = job.attempts >= job.maxAttempts;
    const delayMs = Math.min(30 * 60_000, Math.max(15_000, 2 ** Math.min(job.attempts, 10) * 1000));
    const nextState: JobState = terminal ? "failed" : "pending";
    await Promise.all([
      ref.set({
        state: nextState,
        lastError: message,
        leaseUntilMs: 0,
        nextAttemptAtMs: terminal ? 0 : Date.now() + delayMs,
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true }),
      updateStudentJobState(job.studentUid, job.jobType, nextState, message)
    ]);
    if (!terminal) throw error;
    return false;
  }
}

function publicTeachers(maps: { byUid: Map<string, string>; byName: Map<string, string> }): PlainObject[] {
  return Array.from(maps.byUid.entries())
    .map(([instructorUid, instructorName]) => ({ instructorUid, instructorName }))
    .filter(item => item.instructorUid && item.instructorName)
    .sort((left, right) => left.instructorName.localeCompare(right.instructorName, "ko"));
}

function validateClassHours(value: unknown): number[] {
  const hours = Array.isArray(value) ? value.map(Number).filter(hour => Number.isInteger(hour) && hour >= 10 && hour <= 21) : [];
  const unique = Array.from(new Set(hours)).sort((a, b) => a - b);
  if (!unique.length) throw new HttpsError("invalid-argument", "수업시간을 한 칸 이상 선택해주세요.");
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index] !== unique[index - 1] + 1) throw new HttpsError("invalid-argument", "수업시간은 연속으로 선택해주세요.");
  }
  return unique;
}

type ClassRenameWrite7355085 = {
  ref: DocumentReference;
  patch: PlainObject;
};

async function commitClassRenameWrites7355085(writes: ClassRenameWrite7355085[]): Promise<number> {
  let committed = 0;
  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = db().batch();
    const chunk = writes.slice(offset, offset + 400);
    chunk.forEach(item => batch.set(item.ref, item.patch, { merge: true }));
    await batch.commit();
    committed += chunk.length;
  }
  return committed;
}

async function propagateCurrentClassName7355085(
  classId: string,
  oldClassName: string,
  newClassName: string,
  catalog: ClassCatalogItem[]
): Promise<{ students: number; enrollments: number; classMembers: number }> {
  const [studentSnapshot, enrollmentSnapshot, memberSnapshot] = await Promise.all([
    db().collection(STUDENT_COLLECTION).limit(MAX_STUDENTS).get(),
    db().collection(ENROLLMENT_COLLECTION).where("classId", "==", classId).limit(MAX_ENROLLMENTS).get(),
    db().collection("classMembers").where("classId", "==", classId).limit(MAX_ENROLLMENTS).get()
  ]);

  const oldKey = normalize(oldClassName);
  const catalogById = new Map(catalog.map(item => [item.classId, item] as const));
  const catalogNameKeys = new Set(catalog.map(item => normalize(item.className)).filter(Boolean));
  const writes: ClassRenameWrite7355085[] = [];
  let studentCount = 0;

  studentSnapshot.docs.forEach(doc => {
    const data = doc.data() ?? {};
    const classIds = uniqueText([
      ...(Array.isArray(data.classUids) ? data.classUids : []),
      ...(Array.isArray(data.classIds) ? data.classIds : [])
    ], 180);
    const existingNames = uniqueText(data.classNames ?? data.currentClass ?? data.className, 300);
    const hasClassId = classIds.includes(classId);
    const hasOldName = existingNames.some(name => normalize(name) === oldKey);
    const scalarCurrentOld = normalize(data.currentClass) === oldKey;
    const scalarClassOld = normalize(data.className) === oldKey;
    if (!hasClassId && !hasOldName && !scalarCurrentOld && !scalarClassOld) return;

    let classNames: string[];
    if (classIds.length) {
      const managedNames = classIds.map(id => {
        if (id === classId) return newClassName;
        return catalogById.get(id)?.className || "";
      }).filter(Boolean);
      const legacyNames = existingNames.filter(name => {
        const key = normalize(name);
        return key && key !== oldKey && !catalogNameKeys.has(key);
      });
      classNames = Array.from(new Set([...managedNames, ...legacyNames]));
    } else {
      classNames = Array.from(new Set(existingNames.map(name => normalize(name) === oldKey ? newClassName : name).filter(Boolean)));
      if (!classNames.length && (scalarCurrentOld || scalarClassOld)) classNames = [newClassName];
    }

    const patch: PlainObject = {
      classNames,
      classCatalogRenameVersion: CLASS_CATALOG_RENAME_7355085_VERSION,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    };
    if (scalarCurrentOld) patch.currentClass = newClassName;
    if (scalarClassOld) patch.className = newClassName;
    writes.push({ ref: doc.ref, patch });
    studentCount += 1;
  });

  enrollmentSnapshot.docs.forEach(doc => {
    writes.push({
      ref: doc.ref,
      patch: {
        className: newClassName,
        classCatalogRenameVersion: CLASS_CATALOG_RENAME_7355085_VERSION,
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp()
      }
    });
  });

  memberSnapshot.docs.forEach(doc => {
    writes.push({
      ref: doc.ref,
      patch: {
        className: newClassName,
        classCatalogRenameVersion: CLASS_CATALOG_RENAME_7355085_VERSION,
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp()
      }
    });
  });

  await commitClassRenameWrites7355085(writes);
  return {
    students: studentCount,
    enrollments: enrollmentSnapshot.size,
    classMembers: memberSnapshot.size
  };
}


function classUpdateHours73550920(input: PlainObject): number[] {
  const raw = Array.isArray(input.hours) ? input.hours : []; const hours = Array.from(new Set(raw.map(value => Number(value)).filter(value => Number.isInteger(value) && value >= 0 && value <= 23))).sort((a,b)=>a-b);
  if (!hours.length) throw new HttpsError('invalid-argument', '수업시간을 선택해주세요.'); for (let i=1;i<hours.length;i+=1) if(hours[i]!==hours[i-1]+1) throw new HttpsError('invalid-argument','수업시간은 연속으로 선택해주세요.'); return hours;
}
function classUpdateWeekday73550920(baseName: string): string {
  const found = ['월','화','수','목','금','토','일'].find(day => baseName.includes(day+'요일')); if(!found) throw new HttpsError('invalid-argument','반명에 수업 요일을 포함해주세요.'); return found;
}
function classUpdateUnique73550920(values: unknown[]): string[] { return Array.from(new Set(values.map(v=>text(v,300)).filter(Boolean))); }
function classUpdateTeacherScope73550920(instructorName: string): string { const key=text(instructorName,120).normalize('NFC').toLowerCase().replace(/[^0-9a-z가-힣]/g,''); return key ? 'name:'+key : 'name:unknown'; }
async function classUpdateInstructorName73550920(instructorUid: string, supplied: string): Promise<string> {
  if (supplied) return supplied.replace(/T$/i,'').trim();
  const direct = await db().collection('teachers').doc(instructorUid).get(); if(direct.exists){ const d=direct.data()??{}; const n=text(d.name??d.teacherName??d.displayName,120); if(n) return n.replace(/T$/i,'').trim(); }
  const users = await db().collection('users').where('teacherUid','==',instructorUid).limit(3).get(); for(const doc of users.docs){ const d=doc.data()??{}; if(d.active===false) continue; const n=text(d.name??d.teacherName??d.displayName??d.adminName,120); if(n) return n.replace(/T$/i,'').trim(); }
  throw new HttpsError('failed-precondition','선택한 강사 계정 정보를 찾지 못했습니다.');
}
async function updateExistingClassCatalog73550920(input: PlainObject, actorUid: string): Promise<PlainObject> {
  const classId=text(input.classId,180), instructorUid=text(input.instructorUid,160), baseName=text(input.baseName,220);
  if(!classId) throw new HttpsError('invalid-argument','반 ID가 필요합니다.'); if(!instructorUid) throw new HttpsError('invalid-argument','담당강사를 선택해주세요.'); if(!baseName) throw new HttpsError('invalid-argument','반명을 입력해주세요.');
  const hours=classUpdateHours73550920(input), weekday=classUpdateWeekday73550920(baseName), instructorName=await classUpdateInstructorName73550920(instructorUid,text(input.instructorName,120));
  const startTime=String(hours[0]).padStart(2,'0')+':00', endTime=String(hours[hours.length-1]+1).padStart(2,'0')+':00';
  const className='['+instructorName+'T] - '+baseName+' '+startTime+' ~ '+endTime, teacherScopeKey=classUpdateTeacherScope73550920(instructorName);
  let classRef=db().collection('classes').doc(classId), classSnap=await classRef.get();
  if(!classSnap.exists){ const q=await db().collection('classes').where('classId','==',classId).limit(3).get(); if(q.empty) throw new HttpsError('not-found','수정할 반을 찾지 못했습니다.'); classRef=q.docs[0].ref; classSnap=q.docs[0]; }
  const old=classSnap.data()??{}, oldClassName=text(old.className??old.name,300), oldInstructorUid=text(old.instructorUid??old.teacherUid,160), oldInstructorName=text(old.instructorName??old.teacherName??old.instructor,120).replace(/T$/i,'').trim();
  const [enrollmentSnap, memberSnap] = await Promise.all([db().collection('studentEnrollments').where('classId','==',classId).limit(1000).get(), db().collection('classMembers').where('classId','==',classId).limit(1000).get()]);
  const activeEnrollments=enrollmentSnap.docs.filter(doc=>{const d=doc.data()??{};return d.active!==false && text(d.status,30)!=='ended' && text(d.status,30)!=='withdrawn';});
  const affectedUids=classUpdateUnique73550920(activeEnrollments.map(doc=>(doc.data()??{}).studentUid));
  const enrollmentSets = await Promise.all(affectedUids.map(uid=>db().collection('studentEnrollments').where('studentUid','==',uid).limit(100).get()));
  const studentSnaps = await Promise.all(affectedUids.map(uid=>db().collection('students').doc(uid).get()));
  const now=Date.now(), writes=[] as Array<(batch: any)=>void>;
  writes.push(batch=>batch.set(classRef,{classId,className,name:className,baseName,instructorUid,teacherUid:instructorUid,instructorName,teacherName:instructorName,teacherScopeKey,startTime,endTime,weekday,dayOfWeek:weekday,active:true,updatedByFirebaseUid:actorUid,updatedAtMs:now,updatedAt:FieldValue.serverTimestamp(),classEditVersion:'73550920'},{merge:true}));
  writes.push(batch=>batch.set(db().collection('teacherAssignments').doc(instructorUid).collection('classes').doc(classId),{active:true,classId,className,teacherUid:instructorUid,instructorName,teacherScopeKey,updatedByFirebaseUid:actorUid,updatedAtMs:now,updatedAt:FieldValue.serverTimestamp(),classEditVersion:'73550920'},{merge:true}));
  if(oldInstructorUid && oldInstructorUid!==instructorUid) writes.push(batch=>batch.set(db().collection('teacherAssignments').doc(oldInstructorUid).collection('classes').doc(classId),{active:false,classId,className:oldClassName,teacherUid:oldInstructorUid,instructorName:oldInstructorName,archivedByFirebaseUid:actorUid,archivedAtMs:now,archivedAt:FieldValue.serverTimestamp(),classEditVersion:'73550920'},{merge:true}));
  activeEnrollments.forEach(doc=>writes.push(batch=>batch.set(doc.ref,{className,instructorUid,instructorName,updatedByFirebaseUid:actorUid,updatedAtMs:now,updatedAt:FieldValue.serverTimestamp(),classEditVersion:'73550920'},{merge:true})));
  memberSnap.docs.filter(doc=>{const d=doc.data()??{};return d.active!==false;}).forEach(doc=>writes.push(batch=>batch.set(doc.ref,{className,instructorUids:[instructorUid],instructorNames:[instructorName],instructorUid,instructorName,teacherUid:instructorUid,updatedByFirebaseUid:actorUid,updatedAtMs:now,updatedAt:FieldValue.serverTimestamp(),classEditVersion:'73550920'},{merge:true})));
  affectedUids.forEach((uid,index)=>{ const studentSnap=studentSnaps[index]; if(!studentSnap.exists) return; const student=studentSnap.data()??{}; const active=enrollmentSets[index].docs.map(doc=>({id:doc.id,data:doc.data()??{}})).filter(row=>row.data.active!==false && text(row.data.status,30)!=='ended' && text(row.data.status,30)!=='withdrawn').map(row=> row.data.classId===classId ? {...row.data,className,instructorUid,instructorName} : row.data);
    const enrollmentOldNames=classUpdateUnique73550920(enrollmentSets[index].docs.map(doc=>(doc.data()??{}).className)); const legacyNames=classUpdateUnique73550920(Array.isArray(student.classNames)?student.classNames:[]).filter(name=>!enrollmentOldNames.includes(name) && name!==oldClassName);
    const classUids=classUpdateUnique73550920(active.map(row=>row.classId)); const classNames=[...classUpdateUnique73550920(active.map(row=>row.className)),...legacyNames]; const instructorUids=classUpdateUnique73550920(active.map(row=>row.instructorUid)); const instructorNames=classUpdateUnique73550920(active.map(row=>row.instructorName));
    writes.push(batch=>batch.set(db().collection('students').doc(uid),{classUids,classNames,instructorUids,instructorNames,updatedByFirebaseUid:actorUid,updatedAtMs:now,updatedAt:FieldValue.serverTimestamp(),classEditVersion:'73550920'},{merge:true}));
  });
  for(let offset=0;offset<writes.length;offset+=400){ const batch=db().batch(); writes.slice(offset,offset+400).forEach(write=>write(batch)); await batch.commit(); }
  return {ok:true,classId,className,instructorUid,instructorName,teacherScopeKey,startTime,endTime,weekday,affectedStudents:affectedUids.length,message:'반 정보를 수정했습니다.'};
}

export const saveClassCatalogAdmin7354 = onCall(
  { ...CALLABLE_OPTIONS, timeoutSeconds: 180, memory: "512MiB" },
  async request => {
    const caller = await requireSuperAdmin(request);
  const classEditInput73550920 = object(request.data);
  if (text(classEditInput73550920.classId, 180)) {
    return updateExistingClassCatalog73550920(classEditInput73550920, text(request.auth?.uid, 128));
  }
    const input = object(request.data);
    const requestedClassId = text(input.classId, 180);

    // Existing class rename mode: classId is immutable. Teacher/day/time are derived
    // from the current class and cannot be changed through rename.
    if (requestedClassId) {
      const requestedBaseName = text(input.baseName, 300);
      if (!requestedBaseName) throw new HttpsError("invalid-argument", "새 반명을 입력해주세요.");

      const teacherMaps = await loadTeacherMaps();
      const ref = db().collection("classes").doc(requestedClassId);
      const snapshot = await ref.get();
      if (!snapshot.exists || snapshot.data()?.active === false) {
        throw new HttpsError("not-found", "운영 중인 반을 찾지 못했습니다.");
      }

      const current = classItemFromData(snapshot.data() ?? {}, requestedClassId, teacherMaps);
      if (!current || !current.instructorUid || !current.instructorName) {
        throw new HttpsError("failed-precondition", "기존 반의 담당강사 정보를 확인하지 못했습니다.");
      }
      if (!current.startTime || !current.endTime || !current.timeSlots.length) {
        throw new HttpsError("failed-precondition", "기존 반의 수업시간 정보를 확인하지 못했습니다.");
      }

      const requestedWeekday = classWeekday(requestedBaseName);
      if (requestedWeekday < 0) {
        throw new HttpsError("invalid-argument", "반명에 기존 수업 요일을 포함해주세요.");
      }
      if (current.weekday >= 0 && requestedWeekday !== current.weekday) {
        throw new HttpsError("failed-precondition", "반명 수정에서는 수업 요일을 변경할 수 없습니다. 요일 변경은 새 반으로 등록해주세요.");
      }
      const nameOnly = requestedBaseName.replace(/^(월요일|화요일|수요일|목요일|금요일|토요일|일요일)s*/, "").trim();
      if (!nameOnly) throw new HttpsError("invalid-argument", "새 반명을 입력해주세요.");

      const newClassName = `[${current.instructorName}T] - ${requestedBaseName} ${current.startTime} ~ ${current.endTime}`;
      const catalog = await loadClassCatalog(teacherMaps);
      const duplicate = catalog.find(item =>
        item.classId !== requestedClassId && normalize(item.className) === normalize(newClassName)
      );
      if (duplicate) {
        throw new HttpsError("already-exists", "같은 담당강사·요일·시간의 동일 반명이 이미 등록되어 있습니다.");
      }

      const oldClassName = current.className;
      const changed = normalize(oldClassName) !== normalize(newClassName) ||
        normalize(current.baseName) !== normalize(requestedBaseName);
      const classPatch: PlainObject = {
        classId: requestedClassId,
        className: newClassName,
        baseName: requestedBaseName,
        weekday: requestedWeekday,
        startTime: current.startTime,
        endTime: current.endTime,
        timeSlots: current.timeSlots,
        instructorUid: current.instructorUid,
        instructorName: current.instructorName,
        instructorUids: [current.instructorUid],
        teacherScopeKey: current.teacherScopeKey,
        active: true,
        classCatalogRenameVersion: CLASS_CATALOG_RENAME_7355085_VERSION,
        updatedByFirebaseUid: caller.uid,
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp(),
        version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
      };
      if (changed) {
        classPatch.classNameHistory = FieldValue.arrayUnion(oldClassName);
        classPatch.renamedFromClassName = oldClassName;
        classPatch.renamedAtMs = Date.now();
        classPatch.renamedAt = FieldValue.serverTimestamp();
      }
      await ref.set(classPatch, { merge: true });

      // Repair current denormalized membership labels. Historical attendance rows are
      // intentionally not rewritten: Firestore attendance keeps the class-name snapshot
      // that was valid on that attendance date.
      const propagated = await propagateCurrentClassName7355085(
        requestedClassId,
        oldClassName,
        newClassName,
        catalog
      );

      await db().collection("operationalRevisions").doc("studentRoster").set({
        revision: FieldValue.increment(1),
        reason: changed ? "class_catalog_renamed_7355085" : "class_catalog_rename_repaired_7355085",
        classId: requestedClassId,
        oldClassName,
        className: newClassName,
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      return {
        ok: true,
        renamed: changed,
        classId: requestedClassId,
        oldClassName,
        className: newClassName,
        propagated,
        message: changed ? "반명을 수정했습니다." : "반명 연결정보를 확인했습니다."
      };
    }

    // Existing create mode remains the single owner for new classes.
    const instructorUid = text(input.instructorUid, 160);
    const baseName = text(input.baseName, 300);
    const hours = validateClassHours(input.hours);
    if (!instructorUid) throw new HttpsError("invalid-argument", "담당강사를 선택해주세요.");
    if (!baseName) throw new HttpsError("invalid-argument", "반명을 입력해주세요.");
    const weekday = classWeekday(baseName);
    if (weekday < 0) throw new HttpsError("invalid-argument", "반명에 수업 요일을 포함해주세요.");
    const teacherMaps = await loadTeacherMaps();
    const instructorName = text(teacherMaps.byUid.get(instructorUid), 120);
    if (!instructorName) throw new HttpsError("not-found", "선택한 담당강사를 찾을 수 없습니다.");
    const startTime = `${String(hours[0]).padStart(2, "0")}:00`;
    const endTime = `${String(hours[hours.length - 1] + 1).padStart(2, "0")}:00`;
    const className = `[${instructorName}T] - ${baseName} ${startTime} ~ ${endTime}`;
    const audienceGroup = classAudienceGroup7355034({ audienceGroup: input.audienceGroup, className, baseName });
    const teacherScopeKey = operationalTeacherScopeKey(className, instructorName, instructorUid);
    const classId = randomClassId73550993();
    await db().collection("classes").doc(classId).set({
      classId, className, baseName, weekday, startTime, endTime, timeSlots: hours, audienceGroup,
      instructorUid, instructorName, instructorUids: [instructorUid], teacherScopeKey,
      active: true, source: "firestore_admin_class_catalog", roomName: "데스크문의",
      updatedByFirebaseUid: caller.uid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(), createdAt: FieldValue.serverTimestamp(), version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
    }, { merge: true });
    await db().collection("operationalRevisions").doc("studentRoster").set({
      revision: FieldValue.increment(1),
      reason: "class_catalog_saved",
      classId,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { ok: true, classId, className, message: "반을 추가했습니다." };
  }
);


export const getAudienceSegmentationAdmin7355034 = onCall(CALLABLE_OPTIONS, async request => {
  await requireSuperAdmin(request);
  const input = object(request.data);
  const [studentSnap, catalog, policySnap] = await Promise.all([
    db().collection(STUDENT_COLLECTION).limit(MAX_STUDENTS).get(),
    loadClassCatalog(),
    db().collection("operationalSettings").doc("audienceNotificationPolicy7355034").get()
  ]);
  const policy = policySnap.data() ?? {};
  const query = normalize(input.query);
  const audienceFilterRaw = normalizeAudienceGroup7355034(input.audienceGroup);
  const audienceFilter = audienceFilterRaw === "adult" || audienceFilterRaw === "youth" || audienceFilterRaw === "unclassified" ? audienceFilterRaw : "";
  const students = studentSnap.docs
    .map(doc => {
      const data = doc.data() ?? {};
      const audience = studentAudienceDetails7355034(data);
      return {
        studentUid: doc.id,
        studentName: text(data.name ?? data.studentName, 120),
        attendanceNo: text(data.attendanceNo ?? data.loginId ?? data.studentNo, 50),
        birthDate: /^\d{4}-\d{2}-\d{2}$/.test(text(data.birthDate ?? data.dateOfBirth, 20)) ? text(data.birthDate ?? data.dateOfBirth, 20) : "",
        audienceGroup: audience.group,
        audienceGroupAuto: audience.autoGroup,
        audienceGroupOverride: audience.override,
        audienceGroupSource: audience.source
      };
    })
    .filter(row => !audienceFilter || row.audienceGroup === audienceFilter)
    .filter(row => !query || normalize(`${row.studentName} ${row.attendanceNo}`).includes(query))
    .sort((a, b) => a.studentName.localeCompare(b.studentName, "ko") || a.attendanceNo.localeCompare(b.attendanceNo))
    .slice(0, 500);
  return {
    ok: true,
    policy: { adultEnabled: policy.adultEnabled !== false, youthEnabled: policy.youthEnabled !== false },
    classes: catalog.map(item => ({ classId: item.classId, className: item.className, instructorName: item.instructorName, audienceGroup: item.audienceGroup })),
    students,
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  };
});

export const saveClassAudienceAdmin7355034 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data);
  const classId = text(input.classId, 180);
  const audienceGroup = normalizeAudienceGroup7355034(input.audienceGroup);
  if (!classId || (audienceGroup !== "adult" && audienceGroup !== "youth")) throw new HttpsError("invalid-argument", "반과 성인반·청소년반 구분을 선택해주세요.");
  const ref = db().collection("classes").doc(classId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.active === false) throw new HttpsError("not-found", "운영 중인 반을 찾지 못했습니다.");
  await ref.set({ audienceGroup, audienceGroupSource: "admin", updatedByFirebaseUid: caller.uid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION }, { merge: true });
  await db().collection("operationalRevisions").doc("studentRoster").set({ revision: FieldValue.increment(1), reason: "class_audience_saved_7355034", classId, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, classId, audienceGroup, message: `${audienceLabel7355034(audienceGroup)}반으로 저장했습니다.` };
});

export const saveStudentAudienceAdmin7355034 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data);
  const studentUid = text(input.studentUid, 128);
  if (!studentUid) throw new HttpsError("invalid-argument", "학생을 선택해주세요.");
  const ref = db().collection(STUDENT_COLLECTION).doc(studentUid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "학생정보를 찾지 못했습니다.");
  const requested = normalizeAudienceGroup7355034(input.audienceGroupOverride);
  const override = requested === "adult" || requested === "youth" ? requested : "";
  const data = snap.data() ?? {};
  const automatic = automaticStudentAudience7355034(data.birthDate ?? data.dateOfBirth);
  const group = override || automatic;
  await ref.set({
    audienceGroup: group,
    audienceGroupOverride: override || FieldValue.delete(),
    audienceGroupSource: override ? "manual" : (automatic === "unclassified" ? "unclassified" : "auto_birth_year"),
    updatedByFirebaseUid: caller.uid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  }, { merge: true });
  return { ok: true, studentUid, audienceGroup: group, audienceGroupAuto: automatic, audienceGroupOverride: override, audienceGroupSource: override ? "manual" : (automatic === "unclassified" ? "unclassified" : "auto_birth_year"), message: `${audienceLabel7355034(group)}으로 저장했습니다.` };
});

export const saveAudienceNotificationPolicyAdmin7355034 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data);
  const adultEnabled = input.adultEnabled !== false;
  const youthEnabled = input.youthEnabled !== false;
  await db().collection("operationalSettings").doc("audienceNotificationPolicy7355034").set({ adultEnabled, youthEnabled, updatedByFirebaseUid: caller.uid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION }, { merge: true });
  return { ok: true, adultEnabled, youthEnabled, message: "성인반·청소년반 알림톡 발송 기준을 저장했습니다." };
});

export const retireClassCatalogAdmin7354 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data);
  const classId = text(input.classId, 180);
  if (!classId) throw new HttpsError("invalid-argument", "반을 선택해주세요.");
  await db().collection("classes").doc(classId).set({ classId, active: false, retiredByFirebaseUid: caller.uid, retiredAtMs: Date.now(), retiredAt: FieldValue.serverTimestamp(), updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION }, { merge: true });
  await db().collection("operationalRevisions").doc("studentRoster").set({ revision: FieldValue.increment(1), reason: "class_catalog_retired", classId, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, classId, message: "반을 사용중지했습니다." };
});

export const getStudentClassCatalogAdmin7352 = onCall(CALLABLE_OPTIONS, async request => {
  await requireSuperAdmin(request);
  const flags = await requireFeature("adminStudentListV2Enabled");
  const teacherMaps = await loadTeacherMaps();
  const classes = await loadClassCatalog(teacherMaps);
  return { ok: true, version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION, flags: publicFlags(flags), classes, teachers: publicTeachers(teacherMaps) };
});

export const resetStudentPracticeDailyLimitsAdmin7355051 = onCall({
  ...CALLABLE_OPTIONS,
  timeoutSeconds: 120,
  memory: "512MiB",
  secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET]
}, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data);
  const studentUid = text(input.studentUid, 180);
  if (!studentUid) throw new HttpsError("invalid-argument", "학생 정보가 없습니다.");
  const scopes = practiceDailyResetScopes7355051(input.scopes ?? input.scope ?? "all");
  const date = dateValue(input.date || seoulDate(), "초기화 날짜", true);

  const studentRef = db().collection(STUDENT_COLLECTION).doc(studentUid);
  const studentSnap = await studentRef.get();
  if (!studentSnap.exists) throw new HttpsError("not-found", "학생 정보를 찾지 못했습니다.");
  const student = studentSnap.data() ?? {};
  const studentName = text(student.name ?? student.studentName, 120);
  const attendanceNo = text(student.attendanceNo ?? student.loginId ?? student.studentNo, 50);
  const dailyRef7355051 = studentRef.collection("practiceDaily").doc(date);
  const dailySnap7355051 = await dailyRef7355051.get();
  const dailyBefore7355051 = dailySnap7355051.data() ?? {};
  const now = Date.now();
  const firestorePatch7355051: PlainObject = {
    adminPracticeLimitResetAtMs: now,
    adminPracticeLimitResetAt: FieldValue.serverTimestamp(),
    adminPracticeLimitResetByFirebaseUid: caller.uid,
    adminPracticeLimitResetScopes: scopes,
    adminPracticeLimitResetVersion: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  };
  const result7355051: PlainObject = {};

  if (scopes.includes("vocal")) {
    firestorePatch7355051.vocalCompletedCount = 0;
    firestorePatch7355051.vocalCurrentSentenceId = FieldValue.delete();
    firestorePatch7355051.vocalLastSentenceId = FieldValue.delete();
    firestorePatch7355051.vocalRerollCount = 0;
    result7355051.vocal = {
      reset: true,
      beforeCompletedCount: Math.max(0, Number(dailyBefore7355051.vocalCompletedCount || 0) || 0),
      progressHistoryPreserved: true
    };
  }

  if (scopes.includes("past")) {
    const knownPastCountFields = ["pastQuestionCompletedCount", "pastQuestionUsedCount", "pastQuestionDailyUsed"];
    const knownPastIdFields = ["pastQuestionCurrentScriptId", "pastQuestionCurrentQuestionId"];
    const presentFields = [...knownPastCountFields, ...knownPastIdFields].filter(field => Object.prototype.hasOwnProperty.call(dailyBefore7355051, field));
    knownPastCountFields.forEach(field => { if (Object.prototype.hasOwnProperty.call(dailyBefore7355051, field)) firestorePatch7355051[field] = 0; });
    knownPastIdFields.forEach(field => { if (Object.prototype.hasOwnProperty.call(dailyBefore7355051, field)) firestorePatch7355051[field] = FieldValue.delete(); });
    result7355051.past = {
      reset: true,
      activeCounterFound: presentFields.length > 0,
      clearedFields: presentFields,
      practiceLogsPreserved: true
    };
  }

  if (scopes.includes("vocal") || scopes.includes("past")) {
    await dailyRef7355051.set(firestorePatch7355051, { merge: true });
  }

  if (scopes.includes("standard")) {
    const requestId = text(input.requestId, 180) || `practice-limit-reset-${randomUUID()}`;
    const gasResult = await callGas("resetStudentPracticeUsage7355051", requestId, {
      studentUid,
      studentName,
      attendanceNo,
      dateKey: date,
      scopes: ["standard"]
    }, 60_000);
    result7355051.standard = {
      reset: gasResult.ok === true || text(gasResult.status, 30) === "success",
      dateKey: text(gasResult.dateKey, 20) || date,
      resetKeys: Array.isArray(gasResult.resetKeys) ? gasResult.resetKeys : []
    };
  }

  const onlyPast = scopes.length === 1 && scopes[0] === "past";
  const pastResult = object(result7355051.past);
  const message = onlyPast && pastResult.activeCounterFound !== true
    ? "기출문제는 현재 별도 일일 제한 카운터가 없어 초기화 상태로 확인했습니다. 기존 연습기록은 유지됩니다."
    : "선택한 오늘 사용제한을 초기화했습니다. 기존 연습기록과 장기 진도는 유지됩니다.";

  return {
    ok: true,
    studentUid,
    studentName,
    date,
    scopes,
    result: result7355051,
    message,
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  };
});

export const listStudentManagementAdmin7352 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: "512MiB" }, async request => {
  await requireSuperAdmin(request);
  const flags = await requireFeature("adminStudentListV2Enabled");
  const teacherMaps = await loadTeacherMaps();
  const [catalog, studentSnapshot] = await Promise.all([
    loadClassCatalog(teacherMaps),
    db().collection(STUDENT_COLLECTION).limit(MAX_STUDENTS).get()
  ]);

  // Only legacy student documents without an explicit current class array need
  // studentEnrollments as a fallback. Current students never wait for the historical table.
  const needsLegacyEnrollments = studentSnapshot.docs.some(doc => {
    const data = doc.data() ?? {};
    const status = statusValue(data.enrollmentStatus ?? data.status);
    if (status === "withdrawn" || data.registrationCancelled === true) return false;
    return !Array.isArray(data.classUids) && !Array.isArray(data.classIds) && !Array.isArray(data.classNames);
  });
  const enrollmentSnapshot = needsLegacyEnrollments
    ? await db().collection(ENROLLMENT_COLLECTION).limit(MAX_ENROLLMENTS).get()
    : null;
  const catalogIds = new Set(catalog.map(item => item.classId));
  if (enrollmentSnapshot) enrollmentSnapshot.docs.forEach(doc => {
    const data = doc.data() ?? {};
    const classId = text(data.classId, 180);
    const className = text(data.className, 300);
    if (!classId || !className || catalogIds.has(classId) || data.active === false || text(data.status, 30) === "ended") return;
    catalog.push({
      classId,
      className,
      instructorUid: text(data.instructorUid, 160),
      instructorName: text(data.instructorName, 120),
      teacherScopeKey: "",
      source: "saved_enrollment",
      selectable: Boolean(text(data.instructorUid, 160)),
      dates: [],
      roomName: text(data.roomName ?? data.classroom ?? data.room, 100) || "데스크문의",
      baseName: classBaseName(data, className),
      weekday: classWeekday(data.weekday ?? className),
      startTime: classTimeParts(data, className).startTime,
      endTime: classTimeParts(data, className).endTime,
      timeSlots: classTimeParts(data, className).timeSlots,
      audienceGroup: classAudienceGroup7355034(data)
    });
    catalogIds.add(classId);
  });
  catalog.sort((left, right) => left.className.localeCompare(right.className, "ko") || left.classId.localeCompare(right.classId));
  const enrollmentsByStudent = new Map<string, PlainObject[]>();
  if (enrollmentSnapshot) enrollmentSnapshot.docs.forEach(doc => {
    const row = enrollmentPublic(doc);
    const studentUid = text(row.studentUid, 128);
    if (!studentUid) return;
    const list = enrollmentsByStudent.get(studentUid) || [];
    list.push(row);
    enrollmentsByStudent.set(studentUid, list);
  });
  const jobsByStudent = new Map<string, PlainObject[]>();
  let hiddenIncomplete = 0;
  const students = studentSnapshot.docs.map(doc => studentPublic(doc, enrollmentsByStudent.get(doc.id) || [], jobsByStudent.get(doc.id) || [], catalog)).filter(student => {
    if (student.incomplete === true) {
      hiddenIncomplete += 1;
      return false;
    }
    return true;
  });
  students.sort((left, right) => {
    const order: Record<string, number> = { active: 0, leave: 1, withdrawn: 2 };
    const diff = (order[text(left.enrollmentStatus, 30)] ?? 9) - (order[text(right.enrollmentStatus, 30)] ?? 9);
    return diff || text(left.name, 100).localeCompare(text(right.name, 100), "ko");
  });
  return {
    ok: true,
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION,
    flags: publicFlags(flags),
    students,
    classes: catalog,
    teachers: publicTeachers(teacherMaps),
    hiddenIncomplete,
    counts: { students: students.length, enrollments: enrollmentSnapshot ? enrollmentSnapshot.size : 0, jobs: 0 }
  };
});

export const createStudentAdmin7352 = onCall({
  ...CALLABLE_OPTIONS,
  secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET],
  timeoutSeconds: 120,
  memory: "512MiB"
}, async request => {
  const caller = await requireSuperAdmin(request);
  try {
    return await createStudentCore(caller, object(request.data));
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "internal",
      "학생정보 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      { fixVersion: STUDENT_CREATE_INTERNAL_FIX_73550473 }
    );
  }
});

export const updateStudentAdmin7352 = onCall({
  ...CALLABLE_OPTIONS,
  secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET],
  timeoutSeconds: 120,
  memory: "512MiB"
}, async request => {
  const caller = await requireSuperAdmin(request);
  return updateStudentCore(caller, object(request.data));
});

export const updateStudentsBatchAdmin7352 = onCall({
  ...CALLABLE_OPTIONS,
  secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET],
  timeoutSeconds: 300,
  memory: "1GiB"
}, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data);
  const edits = Array.isArray(input.edits) ? input.edits.map(object) : [];
  if (!edits.length) throw new HttpsError("invalid-argument", "저장할 학생정보가 없습니다.");
  if (edits.length > 100) throw new HttpsError("invalid-argument", "한 번에 최대 100명까지 저장할 수 있습니다.");
  const baseRequestId = requestIdValue(input, "student-batch-7352");
  const results: PlainObject[] = [];
  for (let index = 0; index < edits.length; index += 1) {
    const edit = edits[index];
    const studentUid = text(edit.studentUid, 128);
    try {
      const result = await updateStudentCore(caller, edit, `${baseRequestId}-${index}-${studentUid}`);
      results.push({ studentUid, ok: true, ...result });
    } catch (error) {
      results.push({
        studentUid,
        ok: false,
        message: text(error instanceof Error ? error.message : error, 1500)
      });
    }
  }
  return {
    ok: results.every(result => result.ok === true),
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION,
    results
  };
});

export const retryStudentOperationAdmin7352 = onCall({ ...CALLABLE_OPTIONS, secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET] }, async request => {
  await requireSuperAdmin(request);
  const input = object(request.data);
  const studentUid = text(input.studentUid, 128);
  const jobId = text(input.jobId, 100);
  if (!studentUid && !jobId) throw new HttpsError("invalid-argument", "재시도할 학생 또는 작업을 선택해주세요.");
  const snapshots = jobId
    ? [await db().collection(JOB_COLLECTION).doc(jobId).get()]
    : (await db().collection(JOB_COLLECTION).where("studentUid", "==", studentUid).limit(100).get()).docs;
  const retryable = snapshots.filter(snapshot => snapshot.exists && snapshot.data()?.state === "failed");
  if (!retryable.length) return { ok: true, retried: 0, message: "재시도가 필요한 작업이 없습니다." };
  const batch = db().batch();
  retryable.forEach(snapshot => {
    batch.set(snapshot.ref, {
      state: "pending" satisfies JobState,
      attempts: 0,
      lastError: "",
      nextAttemptAtMs: Date.now(),
      leaseUntilMs: 0,
      retriedAtMs: Date.now(),
      retriedAt: FieldValue.serverTimestamp(),
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  await batch.commit();
  for (const snapshot of retryable) {
    try {
      await processJobRef(snapshot.ref);
    } catch {
      // 예약 재시도 상태는 유지됩니다.
    }
  }
  return { ok: true, retried: retryable.length, message: "연동 작업을 다시 요청했습니다." };
});

type MatchResult7352 = {
  studentUid: string;
  state: "matched" | "unmatched" | "ambiguous";
  reason: string;
};

function studentCandidate7352(doc: QueryDocumentSnapshot): PlainObject {
  const data = doc.data() ?? {};
  return {
    studentUid: doc.id,
    name: text(data.name ?? data.studentName, 120),
    nameKey: normalizeName(data.nameNormalized ?? data.name ?? data.studentName),
    phoneDigits: normalizePhone(data.phoneDigits ?? data.studentPhone ?? data.phone),
    attendanceNo: text(data.attendanceNo ?? data.loginId ?? data.studentNo, 50).replace(/\D/g, ""),
    birthDate: safeDate(data.birthDate ?? data.dateOfBirth),
    data
  };
}

function matchStudent7352(candidates: PlainObject[], row: PlainObject): MatchResult7352 {
  const uid = text(row.studentUid, 128);
  if (uid) {
    const exact = candidates.find(item => item.studentUid === uid);
    if (exact) return { studentUid: uid, state: "matched", reason: "studentUid" };
  }
  const phone = normalizePhone(row.studentPhone ?? row.phone);
  if (phone.length >= 8) {
    const matches = candidates.filter(item => item.phoneDigits === phone);
    if (matches.length === 1) return { studentUid: text(matches[0].studentUid, 128), state: "matched", reason: "phone" };
    if (matches.length > 1) return { studentUid: "", state: "ambiguous", reason: "phone" };
  }
  const nameKey = normalizeName(row.studentName ?? row.name);
  const birthDate = safeDate(row.birthDate ?? row.dateOfBirth);
  if (nameKey && birthDate) {
    const matches = candidates.filter(item => item.nameKey === nameKey && item.birthDate === birthDate);
    if (matches.length === 1) return { studentUid: text(matches[0].studentUid, 128), state: "matched", reason: "name_birth" };
    if (matches.length > 1) return { studentUid: "", state: "ambiguous", reason: "name_birth" };
  }
  const attendanceNo = text(row.attendanceNo ?? row.studentNo ?? row.loginId ?? row.phoneLast4, 50).replace(/\D/g, "");
  if (nameKey && attendanceNo) {
    const matches = candidates.filter(item => item.nameKey === nameKey && item.attendanceNo === attendanceNo);
    if (matches.length === 1) return { studentUid: text(matches[0].studentUid, 128), state: "matched", reason: "name_attendance" };
    if (matches.length > 1) return { studentUid: "", state: "ambiguous", reason: "name_attendance" };
  }
  if (nameKey) {
    const matches = candidates.filter(item => item.nameKey === nameKey);
    if (matches.length === 1) return { studentUid: text(matches[0].studentUid, 128), state: "matched", reason: "unique_name" };
    if (matches.length > 1) return { studentUid: "", state: "ambiguous", reason: "name" };
  }
  return { studentUid: "", state: "unmatched", reason: "no_match" };
}

function matchClass7352(catalog: ClassCatalogItem[], row: PlainObject): { item: ClassCatalogItem | null; state: "matched" | "unmatched" | "ambiguous"; reason: string } {
  const classId = text(row.classId, 180);
  if (classId) {
    const exact = catalog.find(item => item.classId === classId);
    if (exact) return { item: exact, state: "matched", reason: "classId" };
  }
  const className = text(row.className ?? row.currentClass ?? row.requestedClassName, 300);
  const instructorName = text(row.instructorName ?? row.instructor ?? row.teacher, 120);
  const classKey = operationalNormalize(className);
  const teacherKey = teacherNameKey(instructorName || className.match(/\[\s*([^\]]+?)\s*T?\s*\]/i)?.[1]);
  let matches = catalog.filter(item => operationalNormalize(item.className) === classKey);
  if (teacherKey) {
    const scoped = matches.filter(item => teacherNameKey(item.instructorName) === teacherKey || teacherNameKey(item.teacherScopeKey) === teacherKey);
    if (scoped.length) matches = scoped;
  }
  if (matches.length === 1) return { item: matches[0], state: "matched", reason: teacherKey ? "class_teacher" : "class_name" };
  if (matches.length > 1) return { item: null, state: "ambiguous", reason: "class_name" };
  return { item: null, state: "unmatched", reason: "class_name" };
}

function validInputFromStored7352(data: DocumentData, classIds: string[], fallbackDate = seoulDate()): ValidStudentInput {
  const studentPhone = text(data.studentPhone ?? data.phone, 60);
  const phoneDigits = normalizePhone(data.phoneDigits ?? studentPhone);
  return {
    name: text(data.name ?? data.studentName, 100),
    nameNormalized: normalizeName(data.nameNormalized ?? data.name ?? data.studentName),
    birthDate: safeDate(data.birthDate ?? data.dateOfBirth),
    studentPhone,
    phoneDigits,
    parentPhone: text(data.parentPhone, 60),
    parentPhoneDigits: normalizePhone(data.parentPhoneDigits ?? data.parentPhone),
    attendanceNo: text(data.attendanceNo ?? data.loginId ?? data.studentNo, 50) || phoneDigits.slice(-4),
    enrollmentStatus: statusValue(data.enrollmentStatus ?? data.status),
    initialRegisteredDate: safeDate(data.initialRegisteredDate ?? data.registeredDate) || fallbackDate,
    classIds,
    registrationType: "existing",
    memo: text(data.memo, 2000),
    privacyConsent: data.privacyConsent === true,
    portraitConsent: data.portraitConsent === true,
    preserveLegacyClassNames: uniqueText(data.classNames, 300),
    audienceGroupOverride: studentAudienceDetails7355034(data).override
  };
}

async function enqueueAndRunJobs7352(caller: Caller, studentUid: string, reason: string, includeRoster = true): Promise<{ created: number; completed: number; failed: number }> {
const studentSnap = await db().collection(STUDENT_COLLECTION).doc(studentUid).get();
  if (!studentSnap.exists) throw new HttpsError("not-found", "학생정보를 찾을 수 없습니다.");
  const enrollmentSnap = await db().collection(ENROLLMENT_COLLECTION).where("studentUid", "==", studentUid).limit(500).get();
  const classIds = enrollmentSnap.docs.filter(doc => doc.data()?.active !== false && text(doc.data()?.status, 30) !== "ended").map(doc => text(doc.data()?.classId, 180)).filter(Boolean);
  const input = validInputFromStored7352(studentSnap.data() ?? {}, classIds);
  const rid = `${reason}-${Date.now()}-${randomUUID()}`;
  const withdrawn = studentSnap.data()?.deleted === true || statusValue(studentSnap.data()?.enrollmentStatus ?? studentSnap.data()?.status) === "withdrawn";
  const authType: JobType = withdrawn ? "student_auth_disable" : "student_auth_create";
  const authJob = jobData(rid, authType, studentUid, authPayload(studentUid, input), caller.uid);
  const ref = db().collection(JOB_COLLECTION).doc(text(authJob.jobId, 100));
  await ref.set(authJob, { merge: true });
  let completed = 0, failed = 0;
  try { if (await processJobRef(ref)) completed += 1; } catch { failed += 1; }
  return { created: 1, completed, failed };
}









// 7.35.5.0.28: legacy Google Form/GAS course-application preview/apply owner removed.
// In-app Firestore courseApplications + decideCourseApplicationsAdmin73550 is the only application path.

export const retireStudentAdmin7352 = onCall({ ...CALLABLE_OPTIONS, secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET], timeoutSeconds: 300, memory: "1GiB" }, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data);
  const studentUid = text(input.studentUid, 128);
  const mode = text(input.mode, 30) === "cancel" ? "cancel" : "withdraw";
  if (!studentUid) throw new HttpsError("invalid-argument", "학생을 선택해주세요.");
  const [studentSnap, enrollmentSnap, classMemberSnap] = await Promise.all([
    db().collection(STUDENT_COLLECTION).doc(studentUid).get(),
    db().collection(ENROLLMENT_COLLECTION).where("studentUid", "==", studentUid).limit(200).get(),
    db().collection("classMembers").where("studentUid", "==", studentUid).limit(200).get()
  ]);
  if (!studentSnap.exists) throw new HttpsError("not-found", "학생정보를 찾을 수 없습니다.");
  const now = Date.now();
  const today = seoulDate();
  const batch = db().batch();
  batch.set(studentSnap.ref, {
    enrollmentStatus: "withdrawn",
    status: "withdrawn",
    active: false,
    deleted: mode === "cancel",
    registrationCancelled: mode === "cancel",
    withdrawnAtMs: now,
    withdrawnAt: FieldValue.serverTimestamp(),
    updatedByFirebaseUid: caller.uid,
    updatedAtMs: now,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  enrollmentSnap.docs.forEach(doc => batch.set(doc.ref, { active: false, status: "ended", endDate: today, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
  classMemberSnap.docs.forEach(doc => batch.set(doc.ref, { active: false, enrollmentStatus: "withdrawn", updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
  // Attendance documents remain historical state records. The live roster is derived from students and studentEnrollments,
  // so ending those relationships removes the student from future attendance and tablet rosters without rewriting history.
  batch.set(db().collection("legacyAccounts").doc(safeLegacyAuthUid("student", studentUid)), { active: false, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const stored = studentSnap.data() ?? {};
  if (mode === "cancel") {
    const phoneDigits = normalizePhone(stored.phoneDigits ?? stored.studentPhone ?? stored.phone);
    const nameKey = normalizeName(stored.nameNormalized ?? stored.name ?? stored.studentName);
    const birthDate = safeDate(stored.birthDate ?? stored.dateOfBirth);
    if (phoneDigits) batch.delete(db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("phone", phoneDigits)));
    if (nameKey && birthDate) batch.delete(db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("nameBirth", `${nameKey}|${birthDate}`)));
  }
  const storedInput = validInputFromStored7352(stored, []);
  storedInput.enrollmentStatus = "withdrawn";
  const rid = `student-retire-${mode}-${Date.now()}-${randomUUID()}`;
  const authDisableJob = jobData(rid, "student_auth_disable", studentUid, authPayload(studentUid, storedInput), caller.uid);
  batch.set(db().collection(JOB_COLLECTION).doc(text(authDisableJob.jobId, 100)), authDisableJob, { merge: true });
  await batch.commit();
  return { ok: true, studentUid, mode, message: mode === "cancel" ? "신규 등록을 취소했습니다." : "퇴원 처리했습니다." };
});


const NEW_STUDENT_REGISTRATION_SETTINGS_COLLECTION_73550937 = "newStudentRegistrationSettings";
const NEW_STUDENT_REGISTRATION_SETTINGS_DOC_73550937 = "public";
const NEW_STUDENT_REGISTRATION_COLLECTION_73550937 = "newStudentRegistrations";
const NEW_STUDENT_REGISTRATION_RATE_COLLECTION_73550937 = "newStudentRegistrationRateLimits";

function defaultNewStudentRegistrationSettings73550937(): PlainObject {
  return {
    active: false,
    publicTitle: "울림 성우·스피치·연기학원",
    recruitingClassIds: [],
    academyPages: [
      { id: "academy-intro", title: "학원소개", body: "울림 성우·스피치·연기학원에 오신 것을 환영합니다.\n수업 방향과 학원 이용 안내를 확인해주세요.", imageUrl: "" },
      { id: "academy-teachers", title: "강사소개", body: "강사 소개 내용을 입력해주세요.", imageUrl: "" },
      { id: "academy-curriculum", title: "반별 커리큘럼", body: "반별 교육과정과 커리큘럼을 입력해주세요.", imageUrl: "" },
      { id: "academy-timetable", title: "반 시간표", body: "현재 모집 중인 반 시간표를 입력해주세요.", imageUrl: "" }
    ],
    applicationContent: {
      discoveryOptions: ["인스타그램", "네이버 검색", "카카오채널", "블로그", "울림 유튜브", "지인소개", "기타"],
      paymentOptions: ["카드결제", "계좌이체", "기타"],
      refundPolicy: "교습 시작 전에는 납부한 교습비 전액을 반환합니다.\n교습기간이 1개월 이내인 경우 총 교습시간의 1/3 경과 전에는 2/3, 1/2 경과 전에는 1/2을 반환하며, 1/2 경과 후에는 반환하지 않습니다.\n1개월을 초과하는 과정은 반환사유가 발생한 해당 월의 반환 대상 금액과 나머지 월의 교습비 전액을 합산하여 반환합니다.\n구체적인 반환금액은 관련 법령과 실제 수강 진행 상황을 기준으로 산정합니다.",
      privacyPolicy: "수강 등록과 교육과정 운영을 위해 성명, 생년월일, 본인·보호자 연락처, 수강반, 결제방법, 동의 여부 및 서명 정보를 수집·이용합니다.\n수집한 정보는 수강생 관리, 교육과정 운영, 수업 및 일정 안내, 울림앱 계정 운영에 사용합니다. 필수 개인정보 수집에 동의하지 않을 경우 온라인 수강등록을 완료할 수 없습니다.",
      portraitPolicy: "교육과정 중 촬영되는 사진 및 영상은 동의한 경우에 한하여 학원 홍보물, 홈페이지, 유튜브, 인스타그램 등 학원 공식 채널에 활용할 수 있습니다. 동의하지 않아도 수강신청은 가능합니다.",
      voicePolicy: "수업·연습 과정에서 생성되는 음성파일의 활용 범위를 아래 항목별로 선택할 수 있습니다.\n① 발성·연기 샘플링 및 내부 교육자료 활용\n② 울림 유튜브·인스타그램 등 공식 SNS 업로드\n③ 오디션·캐스팅 등 외부 업체에 샘플 전달\n각 항목은 별도로 동의하거나 거부할 수 있으며, 거부해도 수강신청은 가능합니다.",
      academyRules: "하나. 울림 수강생들은 서로 존중하고 배려합니다.\n하나. 학원 공간과 시설물은 소중히 사용합니다.\n타인에게 위해를 가하거나 수업 및 학원 운영을 지속적으로 방해하는 경우 학원 운영규정에 따라 안내 및 조치가 이루어질 수 있습니다.\n고의 또는 과실로 시설물에 손해를 발생시킨 경우 실제 손해에 대한 배상 책임이 발생할 수 있습니다.\n담당 강사의 사정에 따라 대체 강사가 수업하거나 수업 시간이 조정될 수 있습니다.\n개인 사정에 따른 결석·보강 운영은 해당 반의 안내 기준을 따릅니다."
    }
  };
}

function safePublicImageUrl73550937(value: unknown): string {
  const raw = text(value, 1000);
  return /^https:\/\//i.test(raw) ? raw : "";
}

function stringList73550937(value: unknown, maxItems: number, maxLength: number): string[] {
  const rows = Array.isArray(value) ? value : [];
  const out: string[] = [];
  rows.forEach(item => {
    const v = text(item, maxLength);
    if (v && !out.includes(v) && out.length < maxItems) out.push(v);
  });
  return out;
}

function sanitizeAcademyPages73550937(value: unknown): PlainObject[] {
  const rows = Array.isArray(value) ? value.slice(0, 30) : [];
  const out = rows.map((item, index) => {
    const row = object(item);
    return {
      id: text(row.id, 100).replace(/[^0-9A-Za-z_-]/g, "") || `page-${index + 1}`,
      title: text(row.title, 120) || `안내 ${index + 1}`,
      body: text(row.body, 12000),
      imageUrl: safePublicImageUrl73550937(row.imageUrl),
      imageStoragePath: safeNewStudentStoragePath73550956(row.imageStoragePath),};
  });
  return out.length ? out : (defaultNewStudentRegistrationSettings73550937().academyPages as PlainObject[]);
}

function sanitizeApplicationContent73550937(value: unknown): PlainObject {
  const input = object(value);
  const defaults = object(defaultNewStudentRegistrationSettings73550937().applicationContent);
  return {
    discoveryOptions: stringList73550937(input.discoveryOptions, 30, 100).length ? stringList73550937(input.discoveryOptions, 30, 100) : defaults.discoveryOptions,
    paymentOptions: stringList73550937(input.paymentOptions, 20, 100).length ? stringList73550937(input.paymentOptions, 20, 100) : defaults.paymentOptions,
    refundPolicy: text(input.refundPolicy, 15000) || text(defaults.refundPolicy, 15000),
    privacyPolicy: text(input.privacyPolicy, 15000) || text(defaults.privacyPolicy, 15000),
    portraitPolicy: text(input.portraitPolicy, 15000) || text(defaults.portraitPolicy, 15000),
    voicePolicy: text(input.voicePolicy, 15000) || text(defaults.voicePolicy, 15000),
    academyRules: text(input.academyRules, 15000) || text(defaults.academyRules, 15000)
  };
}

function sanitizeNewStudentRegistrationSettings73550937(value: unknown): PlainObject {
  const input = object(value);
  const defaults = defaultNewStudentRegistrationSettings73550937();
  return {
    active: input.active === true,
    publicTitle: text(input.publicTitle, 200) || text(defaults.publicTitle, 200),
    recruitingClassIds: stringList73550937(input.recruitingClassIds, 300, 180),
    academyPages: sanitizeAcademyPages73550937(input.academyPages),
    applicationContent: sanitizeApplicationContent73550937(input.applicationContent),
    contentVersion: text(input.contentVersion, 100)
  };
}

async function readNewStudentRegistrationSettings73550937(): Promise<PlainObject> {
  const snap = await db().collection(NEW_STUDENT_REGISTRATION_SETTINGS_COLLECTION_73550937).doc(NEW_STUDENT_REGISTRATION_SETTINGS_DOC_73550937).get();
  return sanitizeNewStudentRegistrationSettings73550937(snap.exists ? snap.data() : defaultNewStudentRegistrationSettings73550937());
}

function publicClass73550937(item: ClassCatalogItem): PlainObject {
  return {
    classId: item.classId,
    className: item.className,
    instructorName: item.instructorName,
    selectable: item.selectable === true
  };
}

function isMinorBirthDate73550937(value: string): boolean {
  const raw = safeDate(value);
  if (!raw) return false;
  const [year, month, day] = raw.split("-").map(Number);
  const [nowYear, nowMonth, nowDay] = seoulDate().split("-").map(Number);
  let age = nowYear - year;
  if (nowMonth * 100 + nowDay < month * 100 + day) age -= 1;
  return age < 19;
}

function explicitOptionalConsent73550937(value: unknown, label: string): boolean {
  if (value !== true && value !== false) throw new HttpsError("invalid-argument", `${label} 동의 여부를 선택해주세요.`);
  return value === true;
}

function requestIp73550937(request: CallableRequest<unknown>): string {
  const rawRequest = (request as CallableRequest<unknown> & { rawRequest?: { ip?: string; headers?: Record<string, unknown> } }).rawRequest;
  const forwarded = text(rawRequest?.headers?.["x-forwarded-for"], 300).split(",")[0].trim();
  return text(rawRequest?.ip, 200) || forwarded || "unknown";
}

async function enforceNewStudentRegistrationRate73550937(request: CallableRequest<unknown>): Promise<void> {
  const ip = requestIp73550937(request);
  const key = sha("NEWREG_RATE", ip);
  const ref = db().collection(NEW_STUDENT_REGISTRATION_RATE_COLLECTION_73550937).doc(key);
  const now = Date.now();
  const windowMs = 30 * 60 * 1000;
  await db().runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    const current = snap.data() ?? {};
    const start = Number(current.windowStartMs || 0);
    const count = Number(current.count || 0);
    if (start && now - start < windowMs && count >= 5) throw new HttpsError("resource-exhausted", "신청 요청이 많습니다. 잠시 후 다시 시도해주세요.");
    const nextStart = !start || now - start >= windowMs ? now : start;
    const nextCount = !start || now - start >= windowMs ? 1 : count + 1;
    transaction.set(ref, { windowStartMs: nextStart, count: nextCount, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

function safeSignature73550937(value: unknown): string {
  const raw = String(value == null ? "" : value).trim();
  if (!raw.startsWith("data:image/png;base64,")) throw new HttpsError("invalid-argument", "최종 서명을 작성해주세요.");
  if (raw.length > 180000) throw new HttpsError("invalid-argument", "서명 데이터가 너무 큽니다. 서명을 지운 후 다시 작성해주세요.");
  return raw;
}

function newRegistrationAdminRow73550937(doc: QueryDocumentSnapshot): PlainObject {
  const d = doc.data() ?? {};
  return {
    applicationId: doc.id,
    state: text(d.state, 40),
    studentUid: text(d.studentUid, 128),
    attendanceNo: text(d.attendanceNo, 50),
    studentName: text(d.studentName ?? d.name, 120),
    birthDate: safeDate(d.birthDate),
    studentPhone: text(d.studentPhone, 60),
    parentPhone: text(d.parentPhone, 60),
    classIds: uniqueText(d.classIds, 180),
    classNames: uniqueText(d.classNames, 300),
    discoverySource: text(d.discoverySource, 200),
    discoveryEtc: text(d.discoveryEtc, 300),
    paymentMethod: text(d.paymentMethod, 100),
    refundPolicyAccepted: d.refundPolicyAccepted === true,
    privacyConsent: d.privacyConsent === true,
    portraitConsent: d.portraitConsent === true,
    voiceSamplingConsent: d.voiceSamplingConsent === true,
    voiceSocialUploadConsent: d.voiceSocialUploadConsent === true,
    voiceExternalSampleConsent: d.voiceExternalSampleConsent === true,
    rulesAccepted: d.rulesAccepted === true,
    signerName: text(d.signerName, 120),
    submittedAtMs: Number(d.submittedAtMs || 0),
    appliedAtMs: Number(d.appliedAtMs || 0),
    errorMessage: text(d.errorMessage, 1000)
  };
}

const NEW_STUDENT_IMAGE_BUCKET_73550956 = "ulim-7b09a.firebasestorage.app";
const NEW_STUDENT_IMAGE_PREFIX_73550956 = "new-student-assets/";

function safeNewStudentStoragePath73550956(value: unknown): string {
  const raw = text(value, 800).replace(/^\/+/, "");
  return raw.startsWith(NEW_STUDENT_IMAGE_PREFIX_73550956) && !raw.includes("..") ? raw : "";
}

function storageImageMime73550956(value: unknown): { mimeType: string; extension: string } {
  const mime = text(value, 80).toLowerCase();
  if (mime === "image/webp") return { mimeType: mime, extension: "webp" };
  if (mime === "image/jpeg" || mime === "image/jpg") return { mimeType: "image/jpeg", extension: "jpg" };
  if (mime === "image/png") return { mimeType: mime, extension: "png" };
  throw new HttpsError("invalid-argument", "WEBP, JPG, PNG 이미지만 업로드할 수 있습니다.");
}

function storageAssetPurpose73550956(value: unknown): "academy" | "teacher" | "curriculum" {
  const raw = text(value, 40).toLowerCase();
  if (raw === "academy" || raw === "teacher" || raw === "curriculum") return raw;
  throw new HttpsError("invalid-argument", "이미지 종류를 확인해주세요.");
}

function storageAssetOwner73550956(value: unknown): string {
  const raw = text(value, 120).normalize("NFKC").replace(/[^0-9A-Za-z가-힣_-]+/g, "-").replace(/^-+|-+$/g, "");
  return raw.slice(0, 80) || "image";
}

function firebaseStorageDownloadUrl73550956(bucketName: string, objectPath: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(token)}`;
}

async function deleteStorageObject73550956(storagePath: string): Promise<boolean> {
  const safe = safeNewStudentStoragePath73550956(storagePath);
  if (!safe) return false;
  const { getStorage } = await import("firebase-admin/storage");
  const file = getStorage().bucket(NEW_STUDENT_IMAGE_BUCKET_73550956).file(safe);
  try {
    await file.delete();
    return true;
  } catch (error) {
    if (Number((error as { code?: unknown })?.code) === 404) return false;
    throw error;
  }
}

export const uploadNewStudentRegistrationImageStorage73550956 = onCall(
  { ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: "512MiB" },
  async request => {
    const caller = await requireSuperAdmin(request);
    const input = object(request.data);
    const purpose = storageAssetPurpose73550956(input.purpose);
    const owner = storageAssetOwner73550956(input.ownerKey);
    const imageType = storageImageMime73550956(input.mimeType);
    const rawBase64 = text(input.dataBase64, 12000000).replace(/^data:image\/[A-Za-z0-9.+-]+;base64,/, "");
    if (!rawBase64 || !/^[A-Za-z0-9+/=\r\n]+$/.test(rawBase64)) throw new HttpsError("invalid-argument", "이미지 데이터를 확인해주세요.");
    const buffer = Buffer.from(rawBase64, "base64");
    if (!buffer.length || buffer.length > 6 * 1024 * 1024) throw new HttpsError("invalid-argument", "최적화된 이미지는 6MB 이하만 업로드할 수 있습니다.");

    const { randomUUID } = await import("node:crypto");
    const { getStorage } = await import("firebase-admin/storage");
    const token = randomUUID();
    const objectPath = `${NEW_STUDENT_IMAGE_PREFIX_73550956}${purpose}/${owner}-${Date.now()}-${randomUUID()}.${imageType.extension}`;
    const bucket = getStorage().bucket(NEW_STUDENT_IMAGE_BUCKET_73550956);
    const file = bucket.file(objectPath);

    try {
      await file.save(buffer, {
        resumable: false,
        metadata: {
          contentType: imageType.mimeType,
          cacheControl: "public,max-age=31536000,immutable",
          contentDisposition: "inline",
          metadata: {
            firebaseStorageDownloadTokens: token,
            ulimOwnerUid: caller.uid,
            ulimPurpose: purpose,
            ulimVersion: "73550956"
          }
        }
      });
    } catch (error) {
      const code = Number((error as { code?: unknown })?.code);
      if (code === 404) throw new HttpsError("failed-precondition", "Firebase Storage 버킷이 아직 준비되지 않았습니다. Firebase Console의 Storage에서 시작하기를 1회 완료해주세요.");
      throw new HttpsError("internal", "이미지를 Firebase Storage에 저장하지 못했습니다.");
    }

    const oldStoragePath = safeNewStudentStoragePath73550956(input.oldStoragePath);
    if (oldStoragePath && oldStoragePath !== objectPath) {
      try { await deleteStorageObject73550956(oldStoragePath); } catch (_ignore) {}
    }

    return {
      ok: true,
      imageUrl: firebaseStorageDownloadUrl73550956(bucket.name, objectPath, token),
      storagePath: objectPath,
      size: buffer.length,
      mimeType: imageType.mimeType,
      version: "73550956"
    };
  }
);

export const deleteNewStudentRegistrationImageStorage73550956 = onCall(CALLABLE_OPTIONS, async request => {
  await requireSuperAdmin(request);
  const storagePath = safeNewStudentStoragePath73550956(object(request.data).storagePath);
  if (!storagePath) throw new HttpsError("invalid-argument", "삭제할 이미지 경로를 확인해주세요.");
  try {
    const deleted = await deleteStorageObject73550956(storagePath);
    return { ok: true, deleted, storagePath, version: "73550956" };
  } catch (_error) {
    throw new HttpsError("internal", "Firebase Storage 이미지 삭제에 실패했습니다.");
  }
});

export const getPublicNewStudentRegistration73550937 = onCall(CALLABLE_OPTIONS, async _request => {
  const [settings, catalog] = await Promise.all([readNewStudentRegistrationSettings73550937(), loadClassCatalog()]);
  const selectedIds = new Set(uniqueText(settings.recruitingClassIds, 180));
  const classes = selectedIds.size ? catalog.filter(item => item.selectable && selectedIds.has(item.classId)).map(publicClass73550937) : [];
  return {
    ok: true,
    active: settings.active === true,
    publicTitle: text(settings.publicTitle, 200),
    academyPages: sanitizeAcademyPages73550937(settings.academyPages),
    applicationContent: sanitizeApplicationContent73550937(settings.applicationContent),
    classes,
    version: "73550937"
  };
});

export const getNewStudentRegistrationAdmin73550937 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: "512MiB" }, async request => {
  await requireSuperAdmin(request);
  const [settings, catalog, applications] = await Promise.all([
    readNewStudentRegistrationSettings73550937(),
    loadClassCatalog(),
    db().collection(NEW_STUDENT_REGISTRATION_COLLECTION_73550937).orderBy("submittedAtMs", "desc").limit(250).get()
  ]);
  return {
    ok: true,
    settings,
    classes: catalog.filter(item => item.selectable).map(publicClass73550937),
    submissions: applications.docs.map(newRegistrationAdminRow73550937),
    version: "73550937"
  };
});

export const saveNewStudentRegistrationSettingsAdmin73550937 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data);
  const next = sanitizeNewStudentRegistrationSettings73550937(input.settings);
  const catalog = await loadClassCatalog();
  const validIds = new Set(catalog.filter(item => item.selectable).map(item => item.classId));
  next.recruitingClassIds = uniqueText(next.recruitingClassIds, 180).filter(id => validIds.has(id));
  if (next.active === true && !(next.recruitingClassIds as string[]).length) throw new HttpsError("invalid-argument", "신규 수강신청을 열려면 모집반을 하나 이상 선택해주세요.");
  const now = Date.now();
  await db().collection(NEW_STUDENT_REGISTRATION_SETTINGS_COLLECTION_73550937).doc(NEW_STUDENT_REGISTRATION_SETTINGS_DOC_73550937).set({
    ...next,
    contentVersion: `73550937-${now}`,
    updatedByFirebaseUid: caller.uid,
    updatedAtMs: now,
    updatedAt: FieldValue.serverTimestamp(),
    version: "73550937"
  }, { merge: true });
  return { ok: true, settings: next };
});

export const submitNewStudentRegistration73550937 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 180, memory: "512MiB" }, async request => {
  await enforceNewStudentRegistrationRate73550937(request);
  const input = object(request.data);
  const settings = await readNewStudentRegistrationSettings73550937();
  if (settings.active !== true) throw new HttpsError("failed-precondition", "현재 온라인 신규 수강신청 접수 기간이 아닙니다.");

  const name = text(input.name, 100);
  const birthDate = dateValue(input.birthDate, "생년월일", true);
  const studentPhone = text(input.studentPhone, 60);
  const phoneDigits = normalizePhone(studentPhone);
  const parentPhone = text(input.parentPhone, 60);
  const classIds = uniqueText(input.classIds, 180);
  const discoverySource = text(input.discoverySource, 200);
  const discoveryEtc = text(input.discoveryEtc, 300);
  const paymentMethod = text(input.paymentMethod, 100);
  const signerName = text(input.signerName, 100);
  const signatureDataUrl = safeSignature73550937(input.signatureDataUrl);
  if (!name) throw new HttpsError("invalid-argument", "이름을 입력해주세요.");
  if (phoneDigits.length < 10) throw new HttpsError("invalid-argument", "본인 전화번호를 정확히 입력해주세요.");
  if (isMinorBirthDate73550937(birthDate) && normalizePhone(parentPhone).length < 10) throw new HttpsError("invalid-argument", "미성년 수강생은 보호자 전화번호가 필요합니다.");
  if (!discoverySource) throw new HttpsError("invalid-argument", "학원을 알게 된 경로를 선택해주세요.");
  if (discoverySource === "기타" && !discoveryEtc) throw new HttpsError("invalid-argument", "기타 경로를 입력해주세요.");
  if (!paymentMethod) throw new HttpsError("invalid-argument", "결제 방법을 선택해주세요.");
  if (input.refundPolicyAccepted !== true) throw new HttpsError("invalid-argument", "환불 규정 확인이 필요합니다.");
  if (input.privacyConsent !== true) throw new HttpsError("invalid-argument", "개인정보 수집 및 이용 동의가 필요합니다.");
  if (input.rulesAccepted !== true) throw new HttpsError("invalid-argument", "학원 이용 주의사항 확인이 필요합니다.");
  if (!signerName) throw new HttpsError("invalid-argument", "서명자 성명을 입력해주세요.");
  const portraitConsent = explicitOptionalConsent73550937(input.portraitConsent, "초상권");
  const voiceSamplingConsent = explicitOptionalConsent73550937(input.voiceSamplingConsent, "음성 샘플링");
  const voiceSocialUploadConsent = explicitOptionalConsent73550937(input.voiceSocialUploadConsent, "음성 SNS 활용");
  const voiceExternalSampleConsent = explicitOptionalConsent73550937(input.voiceExternalSampleConsent, "음성 외부업체 샘플 전달");
  if (!classIds.length) throw new HttpsError("invalid-argument", "수강할 반을 하나 이상 선택해주세요.");

  const catalog = await loadClassCatalog();
  const allowedIds = new Set(uniqueText(settings.recruitingClassIds, 180));
  if (!allowedIds.size) throw new HttpsError("failed-precondition", "현재 온라인 신규 수강신청 모집반이 설정되지 않았습니다.");
  const selected = resolveSelectedClasses(classIds, catalog);
  if (selected.some(item => !allowedIds.has(item.classId))) throw new HttpsError("failed-precondition", "현재 온라인 신청 대상이 아닌 반이 포함되어 있습니다.");
  const applicationContent = sanitizeApplicationContent73550937(settings.applicationContent);
  const applicationId = sha("NEWAPP73550937", normalizeName(name), birthDate, phoneDigits);
  const appRef = db().collection(NEW_STUDENT_REGISTRATION_COLLECTION_73550937).doc(applicationId);
  const existing = await appRef.get();
  if (existing.exists && existing.data()?.state === "applied" && text(existing.data()?.studentUid, 128)) {
    return { ok: true, reused: true, applicationId, studentUid: text(existing.data()?.studentUid, 128), attendanceNo: text(existing.data()?.attendanceNo, 50), initialPassword: text(existing.data()?.attendanceNo, 50), classNames: uniqueText(existing.data()?.classNames, 300), message: "이미 수강등록이 완료되었습니다." };
  }

  const now = Date.now();
  const classNames = selected.map(item => item.className);
  const commonApplication: PlainObject = {
    applicationId,
    state: "submitted",
    studentName: name,
    name,
    birthDate,
    studentPhone,
    parentPhone,
    classIds: selected.map(item => item.classId),
    classNames,
    discoverySource,
    discoveryEtc,
    paymentMethod,
    refundPolicyAccepted: true,
    privacyConsent: true,
    portraitConsent,
    voiceSamplingConsent,
    voiceSocialUploadConsent,
    voiceExternalSampleConsent,
    rulesAccepted: true,
    signerName,
    signatureDataUrl,
    minor: isMinorBirthDate73550937(birthDate),
    agreementSnapshot: applicationContent,
    settingsContentVersion: text(settings.contentVersion, 100),
    source: "public_new_student_page",
    submissionId: text(input.submissionId, 180) || applicationId,
    submittedAtMs: Number(existing.data()?.submittedAtMs || 0) || now,
    updatedAtMs: now,
    submittedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    version: "73550937"
  };
  await appRef.set(commonApplication, { merge: true });

  try {
    const createRequestId = `public-new-registration-${applicationId}`;
    const syntheticCaller = { uid: "public-new-student-registration-73550937", user: {}, authUser: {} as UserRecord };
    const created = await createStudentCore(syntheticCaller, {
      name,
      birthDate,
      studentPhone,
      parentPhone,
      classIds: selected.map(item => item.classId),
      initialRegisteredDate: seoulDate(),
      enrollmentStatus: "active",
      registrationType: "new",
      privacyConsent: true,
      portraitConsent,
      memo: ""
    }, createRequestId);
    const studentUid = text(created.studentUid, 128);
    const attendanceNo = text(created.attendanceNo, 50);
    if (!studentUid) throw new HttpsError("internal", "학생 등록 결과를 확인하지 못했습니다.");
    await db().collection(STUDENT_COLLECTION).doc(studentUid).set({
      registrationApplicationId: applicationId,
      registrationSource: "public_new_student_page",
      discoverySource,
      discoveryEtc,
      paymentMethod,
      refundPolicyAccepted: true,
      rulesAccepted: true,
      privacyConsent: true,
      portraitConsent,
      voiceSamplingConsent,
      voiceSocialUploadConsent,
      voiceExternalSampleConsent,
      registrationSignerName: signerName,
      registrationSubmittedAtMs: now,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await appRef.set({
      state: "applied",
      studentUid,
      attendanceNo,
      appliedAtMs: Date.now(),
      appliedAt: FieldValue.serverTimestamp(),
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
      errorMessage: ""
    }, { merge: true });
    return { ok: true, applicationId, studentUid, attendanceNo, initialPassword: attendanceNo, classNames, message: "수강등록이 완료되었습니다." };
  } catch (error) {
    const message = error instanceof Error ? text(error.message, 1000) : "신규 학생 자동등록을 완료하지 못했습니다.";
    await appRef.set({ state: "needs_review", errorMessage: message, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "신규 학생 자동등록을 완료하지 못했습니다. 학원 데스크로 문의해주세요.");
  }
});

async function requireStudent7352(request: CallableRequest<unknown>): Promise<{ firebaseUid: string; studentUid: string; student: DocumentData }> {
  if (!request.auth || text(request.auth.token.role, 30) !== "student") throw new HttpsError("unauthenticated", "학생 로그인이 필요합니다.");
  const studentUid = text(request.auth.token.studentUid, 128);
  if (!studentUid) throw new HttpsError("permission-denied", "학생 연결정보가 없습니다.");
  const snapshot = await db().collection(STUDENT_COLLECTION).doc(studentUid).get();
  if (!snapshot.exists || snapshot.data()?.deleted === true || statusValue(snapshot.data()?.enrollmentStatus ?? snapshot.data()?.status) === "withdrawn") throw new HttpsError("permission-denied", "현재 이용 가능한 학생정보가 없습니다.");
  return { firebaseUid: text(request.auth.uid, 128), studentUid, student: snapshot.data() ?? {} };
}

function validCourseMonth7355031(value: unknown): string {
  const month = text(value, 20);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpsError("invalid-argument", "신청월을 YYYY-MM 형식으로 입력해주세요.");
  return month;
}

function courseWindowPublic7355031(month: string, source: DocumentData): PlainObject {
  return {
    month,
    active: source.active === true,
    title: text(source.title, 200) || `${month} 수강신청`,
    notice: text(source.notice, 3000),
    openAtMs: Number(source.openAtMs || 0),
    closeAtMs: Number(source.closeAtMs || 0),
    recruitingClassIds: uniqueText(source.recruitingClassIds, 180),
    updatedAtMs: Number(source.updatedAtMs || 0)
  };
}

function courseApplicationStatus7355031(source: DocumentData | null): string {
  if (!source) return "not_submitted";
  const state = text(source.state ?? source.decisionState, 40).toLowerCase();
  const applyState = text(source.applyState, 40).toLowerCase();
  if (state === "rejected" || applyState === "rejected") return "rejected";
  if (state === "applied" || applyState === "applied" || Number(source.appliedAtMs || 0) > 0) return "applied";
  if (state === "approved") {
    if (applyState === "scheduled" || applyState === "pending_effective_date" || applyState === "pending") return "scheduled";
    return "approved";
  }
  return "submitted";
}

async function buildStudentCourseApplicationConfig7355031(
  caller: { firebaseUid: string; studentUid: string; student: DocumentData },
  input: PlainObject
): Promise<PlainObject> {
  let month = text(input.month, 20);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    const activeWindows = await db().collection("courseApplicationWindows").where("active", "==", true).limit(24).get();
    const now = Date.now();
    const available = activeWindows.docs
      .map(doc => ({ month: doc.id, data: doc.data() ?? {} }))
      .filter(item => (!Number(item.data.openAtMs || 0) || Number(item.data.openAtMs || 0) <= now) && (!Number(item.data.closeAtMs || 0) || Number(item.data.closeAtMs || 0) >= now))
      .sort((left, right) => left.month.localeCompare(right.month));
    month = available[0]?.month || seoulDate().slice(0, 7);
  }
  const [windowSnap, enrollmentSnap, catalog, existingSnap] = await Promise.all([
    db().collection("courseApplicationWindows").doc(month).get(),
    db().collection(ENROLLMENT_COLLECTION).where("studentUid", "==", caller.studentUid).limit(500).get(),
    loadClassCatalog(),
    db().collection("courseApplications").doc(sha("APP", month, caller.studentUid)).get()
  ]);
  const window = windowSnap.data() ?? {};
  const now = Date.now();
  const active = window.active === true && (!Number(window.openAtMs || 0) || Number(window.openAtMs || 0) <= now) && (!Number(window.closeAtMs || 0) || Number(window.closeAtMs || 0) >= now);
  const recruitingIds = uniqueText(window.recruitingClassIds, 180);
  const audience = studentAudienceDetails7355034(caller.student);
  const currentEnrollments = enrollmentSnap.docs.filter(doc => doc.data()?.active !== false && text(doc.data()?.status, 30) !== "ended").map(enrollmentPublic);
  const existingApplication = existingSnap.exists ? { applicationId: existingSnap.id, ...existingSnap.data() } : null;
  const existingState = text(object(existingApplication).state ?? object(existingApplication).decisionState, 40);
  const completed = existingSnap.exists && ["submitted", "approved", "applied"].includes(existingState);
  return {
    ok: true,
    studentUid: caller.studentUid,
    month,
    active,
    completed,
    needsApplication: active && !completed,
    title: text(window.title, 200) || `${month} 수강신청`,
    notice: text(window.notice, 3000),
    openAtMs: Number(window.openAtMs || 0),
    closeAtMs: Number(window.closeAtMs || 0),
    currentEnrollments,
    audienceGroup: audience.group,
    audienceGroupSource: audience.source,
    classes: audience.group === "unclassified" ? [] : catalog.filter(item =>
      (recruitingIds.length ? recruitingIds.includes(item.classId) : item.selectable) && item.audienceGroup === audience.group
    ),
    existingApplication
  };
}

export const saveCourseApplicationWindowAdmin7352 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data);
  const month = validCourseMonth7355031(input.month);
  const openAtMs = Math.max(0, Number(input.openAtMs || 0));
  const closeAtMs = Math.max(0, Number(input.closeAtMs || 0));
  if (openAtMs > 0 && closeAtMs > 0 && closeAtMs <= openAtMs) throw new HttpsError("invalid-argument", "신청 종료시간은 시작시간보다 뒤여야 합니다.");
  const catalog = await loadClassCatalog();
  const validIds = new Set(catalog.map(item => item.classId));
  const requestedIds = uniqueText(input.recruitingClassIds, 180);
  const invalidIds = requestedIds.filter(id => !validIds.has(id));
  if (invalidIds.length) throw new HttpsError("invalid-argument", "현재 운영 반목록에 없는 반이 포함되어 있습니다.");
  const recruitingClassIds = requestedIds;
  const now = Date.now();
  const record = {
    month,
    active: booleanValue(input.active, false),
    title: text(input.title, 200) || `${month} 수강신청`,
    notice: text(input.notice, 3000),
    openAtMs,
    closeAtMs,
    recruitingClassIds,
    updatedByFirebaseUid: caller.uid,
    updatedAtMs: now,
    updatedAt: FieldValue.serverTimestamp(),
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  };
  const windowRef = db().collection("courseApplicationWindows").doc(month);
  const deactivatedMonths: string[] = [];
  if (record.active === true) {
    const activeWindows = await db().collection("courseApplicationWindows").where("active", "==", true).limit(24).get();
    const batch = db().batch();
    for (const doc of activeWindows.docs) {
      if (doc.id === month) continue;
      deactivatedMonths.push(doc.id);
      batch.set(doc.ref, { active: false, updatedByFirebaseUid: caller.uid, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp(), version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION }, { merge: true });
    }
    batch.set(windowRef, record, { merge: true });
    await batch.commit();
  } else {
    await windowRef.set(record, { merge: true });
  }
  return { ok: true, window: courseWindowPublic7355031(month, record), recruitingClassIds, deactivatedMonths };
});

export const getStudentCourseApplicationConfig7352 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStudent7352(request);
  return buildStudentCourseApplicationConfig7355031(caller, object(request.data));
});

export const getStudentHomeBootstrap7355031 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStudent7352(request);
  const [courseApplication, noticeSnap] = await Promise.all([
    buildStudentCourseApplicationConfig7355031(caller, object(request.data)),
    db().collection("operationalContent").doc("appNotice").get()
  ]);
  const appNotice = noticeSnap.data() ?? {};
  const course = object(courseApplication);
  const enrollments = Array.isArray(course.currentEnrollments) ? course.currentEnrollments.map(object) : [];
  const instructorNames = Array.from(new Set([
    ...uniqueText(caller.student.instructorNames, 120),
    ...enrollments.map(row => text(row.instructorName, 120)).filter(Boolean)
  ]));
  return {
    ok: true,
    studentUid: caller.studentUid,
    student: {
      name: text(caller.student.name ?? caller.student.studentName, 120),
      enrollmentStatus: statusValue(caller.student.enrollmentStatus ?? caller.student.status),
      audienceGroup: studentAudienceDetails7355034(caller.student).group,
      instructorNames
    },
    appNotice: {
      enabled: appNotice.enabled !== false,
      title: text(appNotice.title, 300),
      content: text(appNotice.content, 6000),
      target: text(appNotice.target, 500) || "전체",
      imageUrl: text(appNotice.imageUrl, 2000),
      youtubeUrl: text(appNotice.youtubeUrl, 2000),
      videoUrl: text(appNotice.videoUrl, 2000),
      linkUrl: text(appNotice.linkUrl, 2000),
      linkText: text(appNotice.linkText, 300),
      updatedAtMs: Number(appNotice.updatedAtMs || 0)
    },
    courseApplication,
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  };
});

export const getCourseApplicationAdminDashboard7355031 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: "512MiB" }, async request => {
  await requireSuperAdmin(request);
  const input = object(request.data);
  const month = validCourseMonth7355031(input.month || seoulDate().slice(0, 7));
  const [windowSnap, applicationSnap, studentSnap, enrollmentSnap, catalog] = await Promise.all([
    db().collection("courseApplicationWindows").doc(month).get(),
    db().collection("courseApplications").where("month", "==", month).limit(3000).get(),
    db().collection(STUDENT_COLLECTION).limit(MAX_STUDENTS).get(),
    db().collection(ENROLLMENT_COLLECTION).limit(MAX_ENROLLMENTS).get(),
    loadClassCatalog()
  ]);
  const windowData = windowSnap.data() ?? {};
  const classById = new Map(catalog.map(item => [item.classId, item] as const));
  const enrollmentsByStudent = new Map<string, DocumentData[]>();
  for (const doc of enrollmentSnap.docs) {
    const row = doc.data() ?? {};
    if (row.active === false || text(row.status, 30) === "ended") continue;
    const studentUid = text(row.studentUid, 128);
    if (!studentUid) continue;
    const list = enrollmentsByStudent.get(studentUid) || [];
    list.push(row);
    enrollmentsByStudent.set(studentUid, list);
  }
  const applicationsByStudent = new Map<string, { id: string; data: DocumentData }>();
  for (const doc of applicationSnap.docs) {
    const row = doc.data() ?? {};
    const studentUid = text(row.studentUid, 128);
    if (studentUid) applicationsByStudent.set(studentUid, { id: doc.id, data: row });
  }
  const rows = studentSnap.docs
    .map(doc => ({ studentUid: doc.id, data: doc.data() ?? {} }))
    .filter(item => item.data.deleted !== true && statusValue(item.data.enrollmentStatus ?? item.data.status) !== "withdrawn")
    .filter(item => text(item.data.name ?? item.data.studentName, 120) && text(item.data.attendanceNo ?? item.data.loginId ?? item.data.studentNo, 50))
    .map(item => {
      const application = applicationsByStudent.get(item.studentUid) || null;
      const source = application?.data ?? null;
      const enrollmentRows = enrollmentsByStudent.get(item.studentUid) || [];
      const currentClassNames = Array.from(new Set([
        ...enrollmentRows.map(row => text(row.className, 300)).filter(Boolean),
        ...uniqueText(item.data.classNames, 300)
      ]));
      const instructorNames = Array.from(new Set([
        ...enrollmentRows.map(row => text(row.instructorName, 120)).filter(Boolean),
        ...uniqueText(item.data.instructorNames, 120)
      ]));
      const requestedClassIds = source ? uniqueText(source.requestedClassIds, 180) : [];
      return {
        studentUid: item.studentUid,
        studentName: text(item.data.name ?? item.data.studentName, 120),
        attendanceNo: text(item.data.attendanceNo ?? item.data.loginId ?? item.data.studentNo, 50),
        audienceGroup: studentAudienceDetails7355034(item.data).group,
        audienceGroupSource: studentAudienceDetails7355034(item.data).source,
        enrollmentStatus: statusValue(item.data.enrollmentStatus ?? item.data.status),
        currentClassNames,
        instructorNames,
        applicationId: application?.id || "",
        status: courseApplicationStatus7355031(source),
        state: source ? text(source.state ?? source.decisionState, 40) : "not_submitted",
        registrationDecision: source ? text(source.registrationDecision, 40) : "",
        requestedClassIds,
        requestedClassNames: requestedClassIds.map(id => classById.get(id)?.className || id),
        submittedAtMs: source ? Number(source.submittedAtMs || 0) : 0,
        decidedAtMs: source ? Number(source.decidedAtMs || 0) : 0,
        effectiveStartDate: source ? text(source.effectiveStartDate, 20) : `${month}-01`,
        applyState: source ? text(source.applyState, 40) : ""
      };
    })
    .sort((left, right) => left.studentName.localeCompare(right.studentName, "ko") || left.attendanceNo.localeCompare(right.attendanceNo));
  const summary: Record<string, number> = { eligible: rows.length, notSubmitted: 0, submitted: 0, approved: 0, rejected: 0, applied: 0, scheduled: 0 };
  for (const row of rows) {
    if (row.status === "not_submitted") summary.notSubmitted += 1;
    else if (row.status === "rejected") summary.rejected += 1;
    else if (row.status === "applied") summary.applied += 1;
    else if (row.status === "scheduled") summary.scheduled += 1;
    else if (row.status === "approved") summary.approved += 1;
    else summary.submitted += 1;
  }
  return {
    ok: true,
    month,
    window: courseWindowPublic7355031(month, windowData),
    classes: catalog.filter(item => item.selectable).map(item => ({ classId: item.classId, className: item.className, instructorName: item.instructorName, selectable: item.selectable, audienceGroup: item.audienceGroup })),
    summary,
    rows,
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  };
});

export const submitStudentCourseApplication7352 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStudent7352(request);
  const input = object(request.data);
  const month = text(input.month, 20) || seoulDate().slice(0, 7);
  const configSnap = await db().collection("courseApplicationWindows").doc(month).get();
  const config = configSnap.data() ?? {};
  const now = Date.now();
  if (config.active !== true || (Number(config.openAtMs || 0) && Number(config.openAtMs || 0) > now) || (Number(config.closeAtMs || 0) && Number(config.closeAtMs || 0) < now)) throw new HttpsError("failed-precondition", "현재 수강신청 기간이 아닙니다.");
  const decisionKey = normalize(input.registrationDecision);
  const decision = decisionKey === "class_move" || decisionKey === normalize("반이동") ? "class_move" : decisionKey === "leave" || decisionKey === normalize("휴원") ? "leave" : "continue";
  const requestedInput = uniqueText(input.requestedClassIds, 180);
  const requestedClassIds = decision === "class_move" ? requestedInput : [];
  const allowed = new Set(uniqueText(config.recruitingClassIds, 180));
  if (decision === "class_move" && !requestedClassIds.length) throw new HttpsError("invalid-argument", "신청할 반을 선택해주세요.");
  if (allowed.size && requestedClassIds.some(id => !allowed.has(id))) throw new HttpsError("failed-precondition", "현재 신청할 수 없는 반이 포함되어 있습니다.");
  if (decision === "class_move") {
    const audience = studentAudienceDetails7355034(caller.student);
    if (audience.group === "unclassified") throw new HttpsError("failed-precondition", "생년월일 또는 성인·청소년 구분을 먼저 확인해주세요.");
    const catalog = await loadClassCatalog();
    const catalogById = new Map(catalog.map(item => [item.classId, item] as const));
    const invalidAudience = requestedClassIds.map(id => catalogById.get(id)).filter((item): item is ClassCatalogItem => Boolean(item)).some(item => item.audienceGroup !== audience.group);
    if (invalidAudience) throw new HttpsError("failed-precondition", `${audienceLabel7355034(audience.group)} 학생은 ${audienceLabel7355034(audience.group)}반만 신청할 수 있습니다.`);
  }
  const applicationId = sha("APP", month, caller.studentUid);
  await db().collection("courseApplications").doc(applicationId).set({
    applicationId,
    submissionId: text(input.submissionId, 180) || applicationId,
    idempotencyKey: text(input.idempotencyKey, 180) || applicationId,
    month,
    studentUid: caller.studentUid,
    studentName: text(caller.student.name ?? caller.student.studentName, 120),
    attendanceNo: text(caller.student.attendanceNo ?? caller.student.loginId ?? caller.student.studentNo, 50),
    audienceGroup: studentAudienceDetails7355034(caller.student).group,
    registrationDecision: decision,
    requestedClassIds,
    memo: text(input.memo, 3000),
    source: "in_app",
    state: "submitted",
    decisionState: "submitted",
    applyState: "pending_admin_approval",
    effectiveStartDate: `${month}-01`,
    appliedAtMs: FieldValue.delete(),
    appliedAt: FieldValue.delete(),
    decidedAtMs: FieldValue.delete(),
    decidedAt: FieldValue.delete(),
    submittedByFirebaseUid: caller.firebaseUid,
    submittedAtMs: now,
    submittedAt: FieldValue.serverTimestamp(),
    updatedAtMs: now,
    updatedAt: FieldValue.serverTimestamp(),
    version: STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION
  }, { merge: true });
  return { ok: true, applicationId, message: "수강신청이 접수되었습니다." };
});

export const processStudentOperationJob7352 = onDocumentCreated({
  document: `${JOB_COLLECTION}/{jobId}`,
  region: ULIM_FUNCTION_REGION,
  retry: true,
  secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET]
}, async event => {
  if (!event.data) return;
  await processJobRef(event.data.ref);
});

export const sweepStudentOperationJobs7352 = onSchedule({
  schedule: "every 5 minutes",
  timeZone: "Asia/Seoul",
  region: ULIM_FUNCTION_REGION,
  secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET],
  retryCount: 0
}, async () => {
  const snapshot = await db().collection(JOB_COLLECTION)
    .where("state", "in", ["pending", "processing"])
    .limit(100)
    .get();
  const now = Date.now();
  const due = snapshot.docs
    .filter(doc => Number(doc.data().nextAttemptAtMs || 0) <= now)
    .sort((left, right) => Number(left.data().nextAttemptAtMs || 0) - Number(right.data().nextAttemptAtMs || 0))
    .slice(0, 20);
  for (const doc of due) {
    try {
      await processJobRef(doc.ref);
    } catch {
      // 다음 예약 실행에서 재처리합니다.
    }
  }
});

// 테스트에서 사용하는 순수 함수만 노출합니다.
export const __test7352 = { validateStudentInput, resolveSelectedClasses };
