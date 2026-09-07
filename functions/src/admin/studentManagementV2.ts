import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot
} from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";
import { ULIM_LEGACY_PROOF_HMAC_SECRET } from "../common/firebaseSecrets.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";
import { safeLegacyAuthUid } from "../auth/legacySessionBridge.js";

export const STUDENT_MANAGEMENT_V2_VERSION = "2026-08-02.735.00.0";

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
type JobState = "pending" | "processing" | "complete" | "failed";
type JobType = "student_sheet_create" | "student_sheet_update" | "student_auth_create" | "attendance_roster_apply";

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
};

type EnrollmentWrite = {
  enrollmentId: string;
  studentUid: string;
  classId: string;
  className: string;
  instructorUid: string;
  instructorName: string;
  startDate: string;
  endDate: string;
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
  if (/^CLS_[0-9a-f]{40}$/i.test(explicitClassId)) return explicitClassId;
  const scope = operationalTeacherScopeKey(className, instructorName, explicitScope);
  return sha("CLS", operationalNormalize(className), scope);
}

function teacherNameKey(value: unknown): string {
  return normalize(text(value, 160).replace(/^name:/i, "").replace(/(?:선생님|강사)$/g, "").replace(/T$/i, ""));
}

async function loadTeacherMaps(): Promise<{ byUid: Map<string, string>; byName: Map<string, string> }> {
  const [teacherSnapshot, userSnapshot] = await Promise.all([
    db().collection("teachers").limit(1000).get(),
    db().collection("users").where("role", "==", "teacher").limit(1000).get()
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
  return {
    classId,
    className,
    instructorUid,
    instructorName,
    teacherScopeKey,
    source: text(data.source, 120) || "operating_class",
    selectable: Boolean(instructorUid),
    dates: date ? [date] : []
  };
}

async function loadClassCatalog(): Promise<ClassCatalogItem[]> {
  const teachers = await loadTeacherMaps();
  const dates = Array.from({ length: 29 }, (_, index) => seoulDate(index - 7));
  const [classDocs, dayDocs] = await Promise.all([
    db().collection("classes").limit(2000).get(),
    Promise.all(dates.map(date => db().collection("staffClassLists").doc(date).get()))
  ]);
  const map = new Map<string, ClassCatalogItem>();
  const add = (item: ClassCatalogItem | null) => {
    if (!item) return;
    const current = map.get(item.classId);
    if (!current) {
      map.set(item.classId, item);
      return;
    }
    current.className = current.className || item.className;
    current.instructorUid = current.instructorUid || item.instructorUid;
    current.instructorName = current.instructorName || item.instructorName;
    current.teacherScopeKey = current.teacherScopeKey || item.teacherScopeKey;
    current.selectable = Boolean(current.instructorUid);
    current.dates = Array.from(new Set([...current.dates, ...item.dates])).sort();
  };
  classDocs.docs.forEach(doc => add(classItemFromData(doc.data() ?? {}, doc.id, teachers)));
  dayDocs.forEach((snapshot, index) => {
    if (!snapshot.exists) return;
    const data = snapshot.data() ?? {};
    const classes = Array.isArray(data.classes) ? data.classes : [];
    classes.forEach(raw => add(classItemFromData(object(raw), text(object(raw).classId, 180), teachers, dates[index])));
  });
  return Array.from(map.values()).sort((left, right) => left.className.localeCompare(right.className, "ko") || left.classId.localeCompare(right.classId));
}

function classCatalogMap(catalog: ClassCatalogItem[]): Map<string, ClassCatalogItem> {
  return new Map(catalog.map(item => [item.classId, item]));
}

function validateStudentInput(input: PlainObject, fallbackType: RegistrationType): ValidStudentInput {
  const name = text(input.name ?? input.studentName, 100);
  if (!name) throw new HttpsError("invalid-argument", "학생명을 입력해주세요.");
  const birthDate = dateValue(input.birthDate ?? input.dateOfBirth, "생년월일", true);
  const studentPhone = text(input.studentPhone ?? input.phone, 60);
  const phoneDigits = normalizePhone(studentPhone);
  if (phoneDigits.length < 4) throw new HttpsError("invalid-argument", "학생 전화번호를 숫자 네 자리 이상 입력해주세요.");
  const classIds = uniqueText(input.classIds, 180);
  const enrollmentStatus = statusValue(input.enrollmentStatus ?? input.status);
  if (enrollmentStatus !== "withdrawn" && !classIds.length) throw new HttpsError("invalid-argument", "수강반을 하나 이상 선택해주세요.");
  const initialRegisteredDate = dateValue(input.initialRegisteredDate ?? input.startDate, "수강 시작일", true);
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
    preserveLegacyClassNames: uniqueText(input.preserveLegacyClassNames, 300)
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
    if (name && birthDate && name === candidate.nameNormalized && birthDate === candidate.birthDate) {
      throw new HttpsError("already-exists", "같은 학생명과 생년월일로 등록된 학생이 있습니다.");
    }
  }
}

function enrollmentIdFor(studentUid: string, classId: string): string {
  return sha("ENR", studentUid, classId);
}

function enrollmentWrite(studentUid: string, item: ClassCatalogItem, input: ValidStudentInput, current?: DocumentData): EnrollmentWrite {
  return {
    enrollmentId: enrollmentIdFor(studentUid, item.classId),
    studentUid,
    classId: item.classId,
    className: item.className,
    instructorUid: item.instructorUid,
    instructorName: item.instructorName,
    startDate: safeDate(current?.startDate) || input.initialRegisteredDate,
    endDate: "",
    status: enrollmentStatusForStudent(input.enrollmentStatus),
    registrationType: current ? registrationTypeValue(current.registrationType, "existing") : input.registrationType
  };
}

function jobAction(type: JobType): string {
  if (type === "student_sheet_create") return "firebaseStudentSheetCreate7350";
  if (type === "student_sheet_update") return "firebaseStudentSheetUpdate7350";
  if (type === "student_auth_create") return "firebaseStudentAuthUpsert7350";
  return "firebaseStudentAttendanceApply7350";
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
    version: STUDENT_MANAGEMENT_V2_VERSION
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
    version: STUDENT_MANAGEMENT_V2_VERSION
  };
}

function authPayload(studentUid: string, input: ValidStudentInput): PlainObject {
  return {
    studentUid,
    attendanceNo: input.attendanceNo,
    loginId: input.attendanceNo,
    studentNo: input.attendanceNo,
    name: input.name,
    studentPhone: input.studentPhone,
    phone: input.studentPhone,
    birthDate: input.birthDate,
    status: input.enrollmentStatus,
    mustChangePassword: true,
    version: STUDENT_MANAGEMENT_V2_VERSION
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
    registrationType: enrollment.registrationType,
    enrollmentStatus: enrollment.status,
    version: STUDENT_MANAGEMENT_V2_VERSION
  };
}

function resultWithoutPassword(result: PlainObject): PlainObject {
  const stored = { ...result };
  delete stored.initialPassword;
  return stored;
}

async function createStudentCore(caller: Caller, rawInput: PlainObject, forcedRequestId?: string): Promise<PlainObject> {
  await requireFeature("studentCoreV2Enabled");
  const input = validateStudentInput(rawInput, "new");
  const rid = forcedRequestId || requestIdValue(rawInput, "student-create-7350");
  const reqRef = requestRef("create", rid);
  const existingRequest = await reqRef.get();
  if (existingRequest.exists && existingRequest.data()?.state === "complete") {
    return { ...object(existingRequest.data()?.result), initialPassword: input.attendanceNo, reused: true };
  }
  await assertNoExistingDuplicate(input);
  const catalog = await loadClassCatalog();
  const selected = resolveSelectedClasses(input.classIds, catalog);
  const studentUid = randomStudentUid();
  const now = Date.now();
  const enrollments = selected.map(item => enrollmentWrite(studentUid, item, input));
  const classNames = [...selected.map(item => item.className), ...input.preserveLegacyClassNames].filter((value, index, array) => array.indexOf(value) === index);
  const instructorNames = selected.map(item => item.instructorName).filter((value, index, array) => value && array.indexOf(value) === index);
  const instructorUids = selected.map(item => item.instructorUid).filter((value, index, array) => value && array.indexOf(value) === index);
  const result: PlainObject = {
    ok: true,
    version: STUDENT_MANAGEMENT_V2_VERSION,
    studentUid,
    attendanceNo: input.attendanceNo,
    initialPassword: input.attendanceNo,
    dataSaveState: "complete",
    sheetSyncState: "pending",
    authSyncState: "pending",
    attendanceSyncState: enrollments.length ? "pending" : "complete"
  };
  const phoneLockRef = db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("phone", input.phoneDigits));
  const nameBirthLockRef = db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("nameBirth", `${input.nameNormalized}|${input.birthDate}`));
  const studentRef = db().collection(STUDENT_COLLECTION).doc(studentUid);
  const legacyAccountRef = db().collection("legacyAccounts").doc(safeLegacyAuthUid("student", studentUid));
  const transactionResult = await db().runTransaction(async transaction => {
    const [requestSnapshot, phoneLock, nameBirthLock] = await Promise.all([
      transaction.get(reqRef),
      transaction.get(phoneLockRef),
      transaction.get(nameBirthLockRef)
    ]);
    if (requestSnapshot.exists && requestSnapshot.data()?.state === "complete") {
      return { reused: true, result: object(requestSnapshot.data()?.result) };
    }
    if (phoneLock.exists) throw new HttpsError("already-exists", "같은 학생 전화번호로 등록된 학생이 있습니다.");
    if (nameBirthLock.exists) throw new HttpsError("already-exists", "같은 학생명과 생년월일로 등록된 학생이 있습니다.");
    transaction.create(phoneLockRef, { kind: "phone", normalizedValue: input.phoneDigits, studentUid, active: true, createdAtMs: now, createdAt: FieldValue.serverTimestamp() });
    transaction.create(nameBirthLockRef, { kind: "nameBirth", normalizedValue: `${input.nameNormalized}|${input.birthDate}`, studentUid, active: true, createdAtMs: now, createdAt: FieldValue.serverTimestamp() });
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
      memo: input.memo,
      sheetSnapshot: {},
      localOverrides: {},
      dataSaveState: "complete",
      sheetSyncState: "pending",
      authSyncState: "pending",
      attendanceSyncState: enrollments.length ? "pending" : "complete",
      source: "student_management_v2",
      schemaVersion: 2,
      createdByFirebaseUid: caller.uid,
      createdAtMs: now,
      createdAt: FieldValue.serverTimestamp(),
      updatedByFirebaseUid: caller.uid,
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      version: STUDENT_MANAGEMENT_V2_VERSION
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
      version: STUDENT_MANAGEMENT_V2_VERSION
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
        version: STUDENT_MANAGEMENT_V2_VERSION
      });
    }
    const sheetJob = jobData(rid, "student_sheet_create", studentUid, studentSheetPayload(studentUid, input, selected), caller.uid);
    transaction.create(db().collection(JOB_COLLECTION).doc(text(sheetJob.jobId, 100)), sheetJob);
    const authJob = jobData(rid, "student_auth_create", studentUid, authPayload(studentUid, input), caller.uid);
    transaction.create(db().collection(JOB_COLLECTION).doc(text(authJob.jobId, 100)), authJob);
    enrollments.forEach(enrollment => {
      const rosterJob = jobData(rid, "attendance_roster_apply", studentUid, attendancePayload(studentUid, input, enrollment), caller.uid, enrollment.classId);
      transaction.create(db().collection(JOB_COLLECTION).doc(text(rosterJob.jobId, 100)), rosterJob);
    });
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
      version: STUDENT_MANAGEMENT_V2_VERSION
    }, { merge: true });
    return { reused: false, result: resultWithoutPassword(result) };
  });
  if (transactionResult.reused) {
    return { ...transactionResult.result, initialPassword: input.attendanceNo, reused: true };
  }
  return result;
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
  const legacyClassNames = uniqueText(data.classNames ?? data.currentClass ?? data.className, 300);
  const selectedClassIds = new Set([
    ...activeEnrollments.map(enrollment => text(enrollment.classId, 180)).filter(Boolean),
    ...uniqueText(data.classUids, 180).filter(classId => catalog.some(item => item.classId === classId))
  ]);
  const legacyUnmappedClassNames: string[] = [];
  legacyClassNames.forEach(className => {
    const matches = catalogByName.get(normalize(className)) || [];
    if (matches.length === 1) selectedClassIds.add(matches[0].classId);
    else if (!activeEnrollments.some(enrollment => normalize(enrollment.className) === normalize(className))) legacyUnmappedClassNames.push(className);
  });
  const sheetState = latestJobState(jobs, "student_sheet_update");
  const createSheetState = latestJobState(jobs, "student_sheet_create");
  const effectiveSheetState = sheetState.state === "complete" && !jobs.some(job => job.jobType === "student_sheet_update") ? createSheetState : sheetState;
  const authState = latestJobState(jobs, "student_auth_create");
  const attendanceState = latestJobState(jobs, "attendance_roster_apply");
  const name = text(data.name ?? data.studentName, 100);
  const attendanceNo = text(data.attendanceNo ?? data.loginId ?? data.studentNo, 50);
  return {
    studentUid: text(data.studentUid, 128) || doc.id,
    name,
    birthDate: safeDate(data.birthDate ?? data.dateOfBirth),
    studentPhone: text(data.studentPhone ?? data.phone, 60),
    parentPhone: text(data.parentPhone, 60),
    attendanceNo,
    enrollmentStatus: statusValue(data.enrollmentStatus ?? data.status),
    initialRegisteredDate: safeDate(data.initialRegisteredDate ?? data.registeredDate ?? data.createdDate),
    privacyConsent: data.privacyConsent === true,
    portraitConsent: data.portraitConsent === true,
    mustChangePassword: data.mustChangePassword !== false && data.initialPasswordChanged !== true,
    memo: text(data.memo, 2000),
    enrollments: activeEnrollments,
    selectedClassIds: Array.from(selectedClassIds),
    legacyUnmappedClassNames,
    classNames: activeEnrollments.length ? activeEnrollments.map(enrollment => text(enrollment.className, 300)).filter(Boolean) : legacyClassNames,
    instructorNames: activeEnrollments.length ? activeEnrollments.map(enrollment => text(enrollment.instructorName, 120)).filter(Boolean) : uniqueText(data.instructorNames ?? data.instructorName ?? data.instructor, 120),
    dataSaveState: "complete",
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
  const rid = forcedRequestId || requestIdValue(rawInput, "student-update-7350");
  const reqRef = requestRef("update", rid);
  const existingRequest = await reqRef.get();
  if (existingRequest.exists && existingRequest.data()?.state === "complete") return { ...object(existingRequest.data()?.result), reused: true };
  const studentRef = db().collection(STUDENT_COLLECTION).doc(studentUid);
  const legacyAccountRef = db().collection("legacyAccounts").doc(safeLegacyAuthUid("student", studentUid));
  const [studentSnapshot, enrollmentSnapshot] = await Promise.all([
    studentRef.get(),
    db().collection(ENROLLMENT_COLLECTION).where("studentUid", "==", studentUid).limit(500).get()
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
    portraitConsent: rawInput.portraitConsent ?? current.portraitConsent
  };
  const input = validateStudentInput(mergedInput, "existing");
  const currentAttendanceNo = text(current.attendanceNo ?? current.loginId ?? current.studentNo, 50);
  // 전화번호 수정은 곧바로 출결번호 변경으로 이어지지 않습니다.
  // 향후 관리자 확인 UI가 명시적으로 changeAttendanceNo=true를 보낼 때만 변경합니다.
  input.attendanceNo = booleanValue(rawInput.changeAttendanceNo, false)
    ? input.phoneDigits.slice(-4)
    : (currentAttendanceNo || input.phoneDigits.slice(-4));
  await assertNoExistingDuplicate(input, studentUid);
  const catalog = await loadClassCatalog();
  const catalogByLegacyName = new Map<string, ClassCatalogItem[]>();
  catalog.forEach(item => {
    const key = normalize(item.className);
    const rows = catalogByLegacyName.get(key) || [];
    rows.push(item);
    catalogByLegacyName.set(key, rows);
  });
  const currentLegacyNames = uniqueText(current.classNames ?? current.currentClass ?? current.className, 300);
  const currentLegacyMappedIds: string[] = [];
  const currentLegacyUnmappedNames: string[] = [];
  currentLegacyNames.forEach(className => {
    const matches = catalogByLegacyName.get(normalize(className)) || [];
    if (matches.length === 1) currentLegacyMappedIds.push(matches[0].classId);
    else currentLegacyUnmappedNames.push(className);
  });
  const requestedClassIdSet = new Set(input.classIds);
  if (currentLegacyMappedIds.some(classId => !requestedClassIdSet.has(classId))) {
    throw new HttpsError("failed-precondition", "기존 수강반 종료와 반이동은 다음 단계의 처리구분 기능에서 진행해주세요.");
  }
  input.preserveLegacyClassNames = Array.from(new Set([
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
  if (removed.length) throw new HttpsError("failed-precondition", "수강반 종료와 반이동은 다음 단계의 처리구분 기능에서 진행해주세요. 현재 단계에서는 기존 반을 유지한 채 반을 추가할 수 있습니다.");
  const currentByClass = new Map(existingDocs.map(doc => [text(doc.data()?.classId, 180), { doc, data: doc.data() ?? {} }]));
  const writes = selected.map(item => enrollmentWrite(studentUid, item, input, currentByClass.get(item.classId)?.data));
  const newClassIds = writes.filter(write => !currentByClass.has(write.classId)).map(write => write.classId);
  const classNames = [...selected.map(item => item.className), ...input.preserveLegacyClassNames].filter((value, index, array) => array.indexOf(value) === index);
  const instructorNames = selected.map(item => item.instructorName).filter((value, index, array) => value && array.indexOf(value) === index);
  const instructorUids = selected.map(item => item.instructorUid).filter((value, index, array) => value && array.indexOf(value) === index);
  const oldPhoneDigits = normalizePhone(current.phoneDigits ?? current.studentPhone ?? current.phone);
  const oldNameNormalized = normalizeName(current.nameNormalized ?? current.name ?? current.studentName);
  const oldBirthDate = safeDate(current.birthDate);
  const oldPhoneRef = oldPhoneDigits ? db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("phone", oldPhoneDigits)) : null;
  const oldNameBirthRef = oldNameNormalized && oldBirthDate ? db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("nameBirth", `${oldNameNormalized}|${oldBirthDate}`)) : null;
  const newPhoneRef = db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("phone", input.phoneDigits));
  const newNameBirthRef = db().collection(UNIQUE_COLLECTION).doc(uniqueLockId("nameBirth", `${input.nameNormalized}|${input.birthDate}`));
  const now = Date.now();
  const result: PlainObject = {
    ok: true,
    version: STUDENT_MANAGEMENT_V2_VERSION,
    studentUid,
    dataSaveState: "complete",
    sheetSyncState: "pending",
    authSyncState: "pending",
    attendanceSyncState: newClassIds.length ? "pending" : text(current.attendanceSyncState, 30) || "complete"
  };
  await db().runTransaction(async transaction => {
    const refsToRead = [reqRef, studentRef, newPhoneRef, newNameBirthRef, legacyAccountRef, ...writes.map(write => db().collection(ENROLLMENT_COLLECTION).doc(write.enrollmentId))];
    if (oldPhoneRef && oldPhoneRef.path !== newPhoneRef.path) refsToRead.push(oldPhoneRef);
    if (oldNameBirthRef && oldNameBirthRef.path !== newNameBirthRef.path) refsToRead.push(oldNameBirthRef);
    const snapshots = await Promise.all(refsToRead.map(ref => transaction.get(ref)));
    const requestSnapshot = snapshots[0];
    const freshStudent = snapshots[1];
    const newPhoneSnapshot = snapshots[2];
    const newNameBirthSnapshot = snapshots[3];
    if (requestSnapshot.exists && requestSnapshot.data()?.state === "complete") return;
    if (!freshStudent.exists) throw new HttpsError("not-found", "학생정보를 찾을 수 없습니다.");
    const phoneOwner = text(newPhoneSnapshot.data()?.studentUid, 128);
    const nameBirthOwner = text(newNameBirthSnapshot.data()?.studentUid, 128);
    if (newPhoneSnapshot.exists && phoneOwner !== studentUid) throw new HttpsError("already-exists", "같은 학생 전화번호로 등록된 학생이 있습니다.");
    if (newNameBirthSnapshot.exists && nameBirthOwner !== studentUid) throw new HttpsError("already-exists", "같은 학생명과 생년월일로 등록된 학생이 있습니다.");
    transaction.set(newPhoneRef, { kind: "phone", normalizedValue: input.phoneDigits, studentUid, active: true, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(newNameBirthRef, { kind: "nameBirth", normalizedValue: `${input.nameNormalized}|${input.birthDate}`, studentUid, active: true, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (oldPhoneRef && oldPhoneRef.path !== newPhoneRef.path) transaction.delete(oldPhoneRef);
    if (oldNameBirthRef && oldNameBirthRef.path !== newNameBirthRef.path) transaction.delete(oldNameBirthRef);
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
      memo: input.memo,
      dataSaveState: "complete",
      sheetSyncState: "pending",
      authSyncState: "pending",
      attendanceSyncState: newClassIds.length ? "pending" : text(current.attendanceSyncState, 30) || "complete",
      source: text(current.source, 60) || "student_management_v2",
      schemaVersion: Math.max(2, Number(current.schemaVersion || 0)),
      updatedByFirebaseUid: caller.uid,
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      version: STUDENT_MANAGEMENT_V2_VERSION
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
      version: STUDENT_MANAGEMENT_V2_VERSION
    }, { merge: true });
    writes.forEach(write => {
      const ref = db().collection(ENROLLMENT_COLLECTION).doc(write.enrollmentId);
      const existed = currentByClass.has(write.classId);
      transaction.set(ref, {
        ...write,
        active: write.status !== "ended",
        source: "student_management_v2",
        schemaVersion: 1,
        ...(existed ? {} : { createdByFirebaseUid: caller.uid, createdAtMs: now, createdAt: FieldValue.serverTimestamp() }),
        updatedByFirebaseUid: caller.uid,
        updatedAtMs: now,
        updatedAt: FieldValue.serverTimestamp(),
        version: STUDENT_MANAGEMENT_V2_VERSION
      }, { merge: true });
    });
    const sheetJob = jobData(rid, "student_sheet_update", studentUid, studentSheetPayload(studentUid, input, selected), caller.uid);
    transaction.create(db().collection(JOB_COLLECTION).doc(text(sheetJob.jobId, 100)), sheetJob);
    const authJob = jobData(rid, "student_auth_create", studentUid, authPayload(studentUid, input), caller.uid);
    transaction.create(db().collection(JOB_COLLECTION).doc(text(authJob.jobId, 100)), authJob);
    writes.filter(write => newClassIds.includes(write.classId)).forEach(write => {
      const rosterJob = jobData(rid, "attendance_roster_apply", studentUid, attendancePayload(studentUid, input, write), caller.uid, write.classId);
      transaction.create(db().collection(JOB_COLLECTION).doc(text(rosterJob.jobId, 100)), rosterJob);
    });
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
      version: STUDENT_MANAGEMENT_V2_VERSION
    }, { merge: true });
  });
  return result;
}

async function updateStudentJobState(studentUid: string, jobType: JobType, state: JobState, message: string, result: PlainObject = {}): Promise<void> {
  const patch: PlainObject = {
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  };
  if (jobType === "student_sheet_create" || jobType === "student_sheet_update") {
    patch.sheetSyncState = state;
    patch.sheetSyncMessage = message;
    if (state === "complete") {
      patch.sheetSyncedAtMs = Date.now();
      patch.sheetSyncedAt = FieldValue.serverTimestamp();
      patch.sheetRow = Number(result.rowNumber || 0);
      patch.sourceSheetRow = Number(result.rowNumber || 0);
      patch.sourceSheet = "학생명단";
    }
  } else if (jobType === "student_auth_create") {
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
  if (!["student_sheet_create", "student_sheet_update", "student_auth_create", "attendance_roster_apply"].includes(jobType)) {
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
  try {
    const result = await callGas(job.action, job.jobId, job.payload);
    const message = text(result.message, 1000) || "연동이 완료되었습니다.";
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

export const getStudentClassCatalogAdmin7350 = onCall(CALLABLE_OPTIONS, async request => {
  await requireSuperAdmin(request);
  const flags = await requireFeature("adminStudentListV2Enabled");
  const classes = await loadClassCatalog();
  return { ok: true, version: STUDENT_MANAGEMENT_V2_VERSION, flags: publicFlags(flags), classes };
});

export const listStudentManagementAdmin7350 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: "512MiB" }, async request => {
  await requireSuperAdmin(request);
  const flags = await requireFeature("adminStudentListV2Enabled");
  const [catalog, studentSnapshot, enrollmentSnapshot, jobSnapshot] = await Promise.all([
    loadClassCatalog(),
    db().collection(STUDENT_COLLECTION).limit(MAX_STUDENTS).get(),
    db().collection(ENROLLMENT_COLLECTION).limit(MAX_ENROLLMENTS).get(),
    db().collection(JOB_COLLECTION).limit(MAX_JOBS).get()
  ]);
  const catalogIds = new Set(catalog.map(item => item.classId));
  enrollmentSnapshot.docs.forEach(doc => {
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
      dates: []
    });
    catalogIds.add(classId);
  });
  catalog.sort((left, right) => left.className.localeCompare(right.className, "ko") || left.classId.localeCompare(right.classId));
  const enrollmentsByStudent = new Map<string, PlainObject[]>();
  enrollmentSnapshot.docs.forEach(doc => {
    const row = enrollmentPublic(doc);
    const studentUid = text(row.studentUid, 128);
    if (!studentUid) return;
    const list = enrollmentsByStudent.get(studentUid) || [];
    list.push(row);
    enrollmentsByStudent.set(studentUid, list);
  });
  const jobsByStudent = new Map<string, PlainObject[]>();
  jobSnapshot.docs.forEach(doc => {
    const row = jobPublic(doc);
    const studentUid = text(row.studentUid, 128);
    if (!studentUid) return;
    const list = jobsByStudent.get(studentUid) || [];
    list.push(row);
    jobsByStudent.set(studentUid, list);
  });
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
    version: STUDENT_MANAGEMENT_V2_VERSION,
    flags: publicFlags(flags),
    students,
    classes: catalog,
    hiddenIncomplete,
    counts: { students: students.length, enrollments: enrollmentSnapshot.size, jobs: jobSnapshot.size }
  };
});

export const createStudentAdmin7350 = onCall({
  ...CALLABLE_OPTIONS,
  secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET],
  timeoutSeconds: 120,
  memory: "512MiB"
}, async request => {
  const caller = await requireSuperAdmin(request);
  return createStudentCore(caller, object(request.data));
});

export const updateStudentAdmin7350 = onCall({
  ...CALLABLE_OPTIONS,
  secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET],
  timeoutSeconds: 120,
  memory: "512MiB"
}, async request => {
  const caller = await requireSuperAdmin(request);
  return updateStudentCore(caller, object(request.data));
});

export const updateStudentsBatchAdmin7350 = onCall({
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
  const baseRequestId = requestIdValue(input, "student-batch-7350");
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
    version: STUDENT_MANAGEMENT_V2_VERSION,
    results
  };
});

export const retryStudentOperationAdmin7350 = onCall({ ...CALLABLE_OPTIONS, secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET] }, async request => {
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

export const processStudentOperationJob7350 = onDocumentCreated({
  document: `${JOB_COLLECTION}/{jobId}`,
  region: ULIM_FUNCTION_REGION,
  retry: true,
  secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET]
}, async event => {
  if (!event.data) return;
  await processJobRef(event.data.ref);
});

export const sweepStudentOperationJobs7350 = onSchedule({
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
