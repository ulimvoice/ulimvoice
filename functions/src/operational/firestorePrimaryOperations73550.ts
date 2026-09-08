import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot
} from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";
import { normalizeRealtimeAuthVersion, type RealtimeAuthVersion } from "../realtime/realtimeAuthVersion.js";
import type { UlimRole } from "../common/roles.js";
import { classAudienceGroup7355034, studentAudienceDetails7355034, type AudienceGroup7355034 } from "../common/audienceSegmentation7355034.js";

export const FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION = "2026-09-05.73550998-firestore-single-source-explicit-authority";
export const TABLET_CANONICAL_ROSTER_VERSION_7355049 = "2026-08-13.tablet-canonical-roster-7355049";
const CANONICAL_CURRENT_ROSTER_CUTOVER_7355015 = "2026-08-01";
const REGISTRATION_SCHEDULE_CHANGE_LOOKBACK_DAYS_7355049 = 90;

export const ULIM_SOLAPI_OPERATIONAL_CONFIG_7355014 = defineSecret("ULIM_SOLAPI_OPERATIONAL_CONFIG");
const ULIM_SOLAPI_OPERATIONAL_CONFIG = ULIM_SOLAPI_OPERATIONAL_CONFIG_7355014;
const STAFF_ROLES = new Set<UlimRole>(["teacher", "admin", "superAdmin"]);
const FULL_ADMIN_ROLES = new Set<UlimRole>(["admin", "superAdmin"]);
const CALLABLE_OPTIONS = Object.freeze({
  ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  cors: true,
  invoker: "public" as const
});
const MESSAGE_OPTIONS = Object.freeze({
  ...CALLABLE_OPTIONS,
  timeoutSeconds: 180,
  memory: "512MiB" as const,
  secrets: [ULIM_SOLAPI_OPERATIONAL_CONFIG]
});
const MAX_STUDENTS = 5000;
const MAX_ENROLLMENTS = 15000;
const MAX_CLASSES = 1000;
const MAX_ATTENDANCE = 6000;
const MAX_OVERRIDES = 3000;
const MAX_MESSAGE_RECIPIENTS = 500;
const MAX_LEDGER_ATTENDANCE_7355033 = 15000;
const MAX_LEDGER_OVERRIDES_7355033 = 6000;
const MAX_LEDGER_SCHEDULE_CHANGES_7355033 = 3000;

type PlainObject = Record<string, unknown>;
type AttendanceStatus = "미체크" | "출석" | "결석" | "지각" | "보강" | "휴원" | "신규" | "반이동" | "일일특강";
type StaffCaller = {
  firebaseUid: string;
  role: UlimRole;
  authVersion: RealtimeAuthVersion;
  teacherUid?: string;
  displayName: string;
  user: DocumentData;
};
type ClassRow = {
  classId: string;
  className: string;
  instructorUid: string;
  instructorName: string;
  teacherScopeKey: string;
  startTime: string;
  endTime: string;
  videoLink: string;
  weekday: string;
  dates: string[];
  active: boolean;
  raw: DocumentData;
};
type EnrollmentRow = {
  id: string;
  studentUid: string;
  classId: string;
  className: string;
  instructorUid: string;
  instructorName: string;
  status: string;
  active: boolean;
  startDate: string;
  endDate: string;
  operationDate: string;
  registrationType: string;
  entryType: string;
  entryStartDate: string;
  entryTypeSource: string;
  raw: DocumentData;
};
type RosterBuild = {
  date: string;
  rows: PlainObject[];
  groups: PlainObject[];
  classes: ClassRow[];
  selectedClass: ClassRow | null;
  allClasses: boolean;
  movedAway?: PlainObject | null;
};

function app() {
  return getOrInitializeDefaultFirebaseAdminApp();
}
function db() {
  return getFirestore(app());
}
function object(value: unknown): PlainObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as PlainObject;
}
function text(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}
function normalize(value: unknown): string {
  return text(value, 500).normalize("NFKC").toLowerCase().replace(/[\s\-–—_()[\]{}~～·:]/g, "");
}
function normalizePhone(value: unknown): string {
  return text(value, 80).replace(/\D/g, "");
}
function canonicalSpecialStatus7355034(value: unknown): string {
  const raw = text(value, 60);
  return normalize(raw) === "existing" ? "" : raw;
}
function unique(values: unknown[], max = 500): string[] {
  return Array.from(new Set(values.map(value => text(value, max)).filter(Boolean)));
}
function hashId(prefix: string, ...parts: unknown[]): string {
  return `${prefix}_${createHash("sha256").update(parts.map(part => text(part, 1000)).join("|"), "utf8").digest("hex").slice(0, 40)}`;
}
function canonicalAttendanceRecordId73550993(date: string, classId: string, studentUid: string): string {
  const digest=createHash("sha256").update([date,classId,studentUid].join(""),"utf8").digest("hex").slice(0,40);
  return `ATT_${digest}`;
}

function safeDate(value: unknown): string {
  const candidate = text(value, 20);
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function requireDate(value: unknown, label: string): string {
  const candidate = text(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) throw new HttpsError("invalid-argument", `${label}을 정확히 선택해주세요.`);
  const [year, month, day] = candidate.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) throw new HttpsError("invalid-argument", `${label}이 올바르지 않습니다.`);
  return candidate;
}
function safeTime(value: unknown): string {
  const match = text(value, 30).match(/(\d{1,2}):?(\d{2})?/);
  if (!match) return "";
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2] || 0)));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function statusValue(value: unknown): AttendanceStatus {
  const raw = normalize(value);
  if (!raw || ["-", "미체크", "미출결"].includes(raw)) return "미체크";
  if (["o", "○", "ㅇ", "출", "출석", "참석", "등원"].includes(raw)) return "출석";
  if (["x", "×", "✕", "결", "결석", "미등원"].includes(raw)) return "결석";
  if (raw.includes("지각") || raw === "△") return "지각";
  if (raw.includes("보강")) return "보강";
  if (raw.includes("휴원")) return "휴원";
  if (raw.includes("신규")) return "신규";
  if (raw.includes("반이동")) return "반이동";
  if (raw.includes("일일특강")) return "일일특강";
  return "미체크";
}
function roleValue(value: unknown): UlimRole {
  const key = text(value, 40);
  if (key === "superAdmin") return "superAdmin";
  if (key === "admin") return "admin";
  if (key === "teacher") return "teacher";
  throw new HttpsError("permission-denied", "교직원 권한이 필요합니다.");
}
function teacherNameKey(value: unknown): string {
  return normalize(text(value, 120).replace(/T$/i, ""));
}
function classTeacherFromName(className: string): string {
  return text(className.match(/\[\s*([^\]]+?)\s*T?\s*\]/i)?.[1], 120).replace(/T$/i, "");
}
function extractTimes(className: string, raw: DocumentData): { startTime: string; endTime: string } {
  const directStart = safeTime(raw.startTime ?? raw.startHour ?? raw.timeStart);
  const directEnd = safeTime(raw.endTime ?? raw.endHour ?? raw.timeEnd);
  if (directStart && directEnd) return { startTime: directStart, endTime: directEnd };
  const match = className.match(/(\d{1,2})\s*:\s*(\d{2})\s*[~～\-–—]\s*(\d{1,2})\s*:\s*(\d{2})/);
  if (match) {
    return {
      startTime: `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`,
      endTime: `${String(Number(match[3])).padStart(2, "0")}:${match[4]}`
    };
  }
  const hourMatch = className.match(/(?:^|\s)(\d{1,2})\s*[~～\-–—]\s*(\d{1,2})(?:\s|$)/);
  if (hourMatch) return { startTime: `${String(Number(hourMatch[1])).padStart(2, "0")}:00`, endTime: `${String(Number(hourMatch[2])).padStart(2, "0")}:00` };
  return { startTime: "", endTime: "" };
}
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
function weekdayForDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  if (!match) return "";
  // YYYY-MM-DD is a calendar date, not an instant. Converting Korean midnight to
  // UTC and then calling getDay() shifts the weekday one day backward.
  const year = Number(match[1]);
  const month = Number(match[2]);
  const dayOfMonth = Number(match[3]);
  const day = new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay();
  return WEEKDAY_KO[day] || "";
}
function extractWeekday(className: string, raw: DocumentData): string {
  const direct = text(raw.weekday ?? raw.dayOfWeek ?? raw.classWeekday, 20).replace(/요일/g, "");
  if (WEEKDAY_KO.includes(direct)) return direct;
  const found = WEEKDAY_KO.find(day => className.includes(`${day}요일`));
  return found || "";
}
function classScheduledOnDate(item: ClassRow, date: string): boolean {
  const weekday = weekdayForDate(date);
  // A class with an explicit weekday is owned by that weekday. Historical/stale
  // staffClassLists snapshots must never make a Wednesday class appear on Thursday.
  if (item.weekday) return item.weekday === weekday;
  const inferred = extractWeekday(item.className, item.raw || {});
  if (inferred) return inferred === weekday;
  // Date-only classes without weekday metadata may use explicit dates.
  return item.dates.includes(date);
}
function enrollmentActiveOnDate(row: EnrollmentRow, date: string, historical = false): boolean {
  // Current/future roster respects the live enrollment state. Historical roster preserves
  // an ended enrollment when the selected date falls inside its recorded start/end range.
  if (!historical && (!row.active || row.status === "ended" || row.status === "withdrawn")) return false;
  if (row.startDate && row.startDate > date) return false;
  if (row.endDate && row.endDate < date) return false;
  if (historical && row.status === "withdrawn" && !row.endDate) return false;
  return true;
}

function currentEnrollmentMetadata7355033(enrollments: EnrollmentRow[], studentUid: string, item: ClassRow): EnrollmentRow | undefined {
  return enrollments
    .filter(row => row.studentUid === studentUid && enrollmentMatchesClass(row, item) && row.active && row.status !== "ended" && row.status !== "withdrawn")
    .sort((a, b) => text(b.startDate).localeCompare(text(a.startDate)))[0];
}
function endedEnrollmentEvidence7355033(enrollments: EnrollmentRow[], studentUid: string, item: ClassRow, date: string): EnrollmentRow | undefined {
  return enrollments
    .filter(row => row.studentUid === studentUid && enrollmentMatchesClass(row, item) && Boolean(row.endDate) && enrollmentActiveOnDate(row, date, true) && (!row.active || row.status === "ended" || row.status === "withdrawn"))
    .sort((a, b) => text(b.endDate).localeCompare(text(a.endDate)) || text(b.startDate).localeCompare(text(a.startDate)))[0];
}
function canonicalRegistrationKind7355048(
  enrollment: Pick<EnrollmentRow, "entryType" | "entryStartDate"> | undefined
): "new" | "class_move" | "" {
  if (!enrollment) return "";
  const kind = normalize(enrollment.entryType);
  const eventDate = safeDate(enrollment.entryStartDate);
  if (!eventDate) return "";
  if (kind === "new" || kind === normalize("신규")) return "new";
  if (kind === "class_move" || kind === normalize("반이동")) return "class_move";
  return "";
}
function registrationEventDate7355048(
  enrollment: Pick<EnrollmentRow, "entryType" | "entryStartDate"> | undefined
): string {
  return canonicalRegistrationKind7355048(enrollment) ? safeDate(enrollment?.entryStartDate) : "";
}
function registrationSpecial7355033(
  enrollment: Pick<EnrollmentRow, "entryType" | "entryStartDate"> | undefined,
  item: ClassRow,
  date: string,
  scheduleChanges: PlainObject[] = [],
  firstSessionCache: Map<string, string> = new Map<string, string>()
): string {
  const kind = canonicalRegistrationKind7355048(enrollment);
  const eventDate = registrationEventDate7355048(enrollment);
  if (!kind || !eventDate) return "";
  const firstSessionDate = firstEffectiveScheduledSession7355049(item, eventDate, date, scheduleChanges, firstSessionCache);
  if (!firstSessionDate || firstSessionDate !== date) return "";
  return kind === "new" ? "신규" : "반이동";
}
function enrollmentNameSpecial7355033(
  enrollment: EnrollmentRow | undefined,
  item: ClassRow,
  date: string,
  scheduleChanges: PlainObject[] = [],
  firstSessionCache: Map<string, string> = new Map<string, string>()
): string {
  return registrationSpecial7355033(enrollment, item, date, scheduleChanges, firstSessionCache);
}
function savedRegistrationSpecial7355049(value: unknown): boolean {
  const kind = normalize(value);
  return kind === "new" || kind === "class_move" || kind === normalize("신규") || kind === normalize("반이동");
}
function explicitSessionKind7355049(data: DocumentData): "makeup" | "daily_special" | "" {
  // Session specials are date-scoped attendance authority. lifecycle registrationType is never read here.
  const kinds = [
    data.attendanceEntryType,
    data.nameSpecialType,
    data.specialType,
    data.kind,
    data.specialStatus
  ].map(value => normalize(value)).filter(Boolean);
  if (kinds.some(kind => kind === "daily_special" || kind === normalize("일일특강"))) return "daily_special";
  if (kinds.some(kind => kind === "makeup" || kind === normalize("보강"))) return "makeup";
  return "";
}
function canonicalSessionSpecialStatus7355049(
  enrollment: Pick<EnrollmentRow, "entryType" | "entryStartDate"> | undefined,
  item: ClassRow,
  date: string,
  attendanceData: DocumentData,
  scheduleChanges: PlainObject[],
  firstSessionCache: Map<string, string>
): string {
  const explicitKind = explicitSessionKind7355049(attendanceData);
  if (explicitKind === "daily_special") return "일일특강";
  if (explicitKind === "makeup") return "보강";
  const registration = registrationSpecial7355033(enrollment, item, date, scheduleChanges, firstSessionCache);
  if (registration) return registration;
  const savedSpecial = text(attendanceData.specialStatus, 40);
  // Stale 신규/반이동 text in an old attendance row is not display authority.
  if (savedRegistrationSpecial7355049(savedSpecial) ||
      [attendanceData.registrationType, attendanceData.kind].some(value => savedRegistrationSpecial7355049(value))) return "";
  return savedSpecial;
}
function canonicalOutputRegistrationType7355049(
  enrollment: Pick<EnrollmentRow, "registrationType"> | undefined,
  _attendanceData: DocumentData
): string {
  // Lifecycle/history metadata only. UI color and notification code must use explicit entry/session fields.
  return text(enrollment?.registrationType, 40) || "existing";
}
// __ULIM_ATTENDANCE_NAME_SCOPE_73550970__
function specialDisplayScope7355033(specialStatus: string, date: string): string {
  const special = normalize(specialStatus);
  void date;
  // 신규/반이동의 실제 표시일은 registrationSpecial7355033가 결정한다.
  // 첫 실제 수업일이 월 8일 이후여도 학생 이름 색상으로 표시한다.
  if (special === normalize("신규") || special === normalize("반이동") || special === "new" || special === "class_move") return "name";
  return specialStatus ? "date" : "";
}
function timeSortValue7355033(value: unknown): number {
  const safe = safeTime(value);
  if (!safe) return 24 * 60 + 1;
  return Number(safe.slice(0, 2)) * 60 + Number(safe.slice(3, 5));
}
function weekdaySortValue7355033(value: unknown): number {
  const day = text(value, 20).replace(/요일/g, "");
  const index = WEEKDAY_KO.indexOf(day);
  if (index < 0) return 8;
  return index === 0 ? 7 : index;
}

function classKey(item: { classId?: unknown; className?: unknown; instructorName?: unknown }): string {
  const id = text(item.classId, 180);
  if (id) return `id:${id}`;
  return `name:${normalize(item.className)}|teacher:${teacherNameKey(item.instructorName ?? classTeacherFromName(text(item.className, 300)))}`;
}
function sessionKey(date: string, classId: string): string {
  return `${date}|${classId}`;
}
function secretEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function requireStaff(request: CallableRequest<unknown>): Promise<StaffCaller> {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const firebaseUid = text(request.auth.uid, 128);
  const role = roleValue(request.auth.token.role);
  if (!STAFF_ROLES.has(role)) throw new HttpsError("permission-denied", "교직원 권한이 필요합니다.");
  const authVersion = normalizeRealtimeAuthVersion(request.auth.token.authVersion);
  if (authVersion === null) throw new HttpsError("permission-denied", "로그인 정보가 올바르지 않습니다.");
  const snapshot = await db().collection("users").doc(firebaseUid).get();
  if (!snapshot.exists) throw new HttpsError("permission-denied", "활성 교직원 정보가 없습니다.");
  const user = snapshot.data() ?? {};
  if (user.active !== true || text(user.role, 40) !== role) throw new HttpsError("permission-denied", "로그인 권한이 변경되었습니다.");
  const teacherUid = role === "teacher" ? text(request.auth.token.teacherUid ?? user.teacherUid, 128) : "";
  if (role === "teacher" && !teacherUid) throw new HttpsError("permission-denied", "강사 연결정보가 없습니다.");
  let displayName = text(user.name ?? user.displayName ?? user.teacherName ?? request.auth.token.name, 120);
  if (!displayName && teacherUid) {
    const teacher = (await db().collection("teachers").doc(teacherUid).get()).data() ?? {};
    displayName = text(teacher.name ?? teacher.teacherName ?? teacher.displayName, 120);
  }
  return { firebaseUid, role, authVersion, teacherUid: teacherUid || undefined, displayName, user };
}
function requireFullAdmin(caller: StaffCaller): void {
  if (!FULL_ADMIN_ROLES.has(caller.role)) throw new HttpsError("permission-denied", "전체관리자 권한이 필요합니다.");
}
function classVisibleToCaller(item: ClassRow, caller: StaffCaller): boolean {
  if (FULL_ADMIN_ROLES.has(caller.role)) return true;
  if (caller.role !== "teacher") return false;
  if (caller.teacherUid && item.instructorUid && caller.teacherUid === item.instructorUid) return true;
  const callerName = teacherNameKey(caller.displayName);
  return Boolean(callerName && callerName === teacherNameKey(item.instructorName || classTeacherFromName(item.className)));
}

const AUDIENCE_NOTIFICATION_POLICY_PATH_7355034 = "operationalSettings/audienceNotificationPolicy7355034";
async function audienceNotificationPolicy7355034(): Promise<{ adultEnabled: boolean; youthEnabled: boolean }> {
  const snap = await db().doc(AUDIENCE_NOTIFICATION_POLICY_PATH_7355034).get();
  const data = snap.data() ?? {};
  return { adultEnabled: data.adultEnabled !== false, youthEnabled: data.youthEnabled !== false };
}
function classAudience7355034(item: ClassRow | null | undefined): "adult" | "youth" {
  return classAudienceGroup7355034(item ? { ...item.raw, className: item.className } : {});
}
async function classAudienceFromContext7355034(classIdInput: unknown, classNameInput: unknown): Promise<"adult" | "youth" | "unclassified"> {
  const classId = text(classIdInput, 180);
  const className = text(classNameInput, 300);
  if (classId) {
    const snap = await db().collection("classes").doc(classId).get();
    if (snap.exists) return classAudienceGroup7355034({ ...(snap.data() ?? {}), className: text(snap.data()?.className, 300) || className });
  }
  if (className) {
    const snap = await db().collection("classes").where("className", "==", className).limit(5).get();
    const exact = snap.docs.find(doc => doc.data()?.active !== false);
    if (exact) return classAudienceGroup7355034(exact.data() ?? {});
    return classAudienceGroup7355034({ className });
  }
  return "unclassified";
}
async function studentAudienceFromUid7355034(studentUidInput: unknown): Promise<AudienceGroup7355034> {
  const studentUid = text(studentUidInput, 160);
  if (!studentUid) return "unclassified";
  const snap = await db().collection("students").doc(studentUid).get();
  return snap.exists ? studentAudienceDetails7355034(snap.data() ?? {}).group : "unclassified";
}
async function audienceFromClassOrStudent7355034(classIdInput: unknown, classNameInput: unknown, studentUidInput: unknown): Promise<AudienceGroup7355034> {
  const classId = text(classIdInput, 180);
  const className = text(classNameInput, 300);
  if (classId || className) return classAudienceFromContext7355034(classId, className);
  return studentAudienceFromUid7355034(studentUidInput);
}
function audiencePolicyAllows7355034(group: AudienceGroup7355034, policy: { adultEnabled: boolean; youthEnabled: boolean }): boolean {
  if (group === "adult") return policy.adultEnabled;
  if (group === "youth") return policy.youthEnabled;
  return true;
}

function dateOffset7355014(anchorDate: string, offsetDays: number): string {
  // Calendar-date arithmetic only. Using a KST timestamp and then adding another +09:00
  // could shift the date across UTC boundaries. Noon UTC avoids DST/time-zone ambiguity.
  const base = new Date(`${anchorDate}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}
function classRowFromData7355014(data: DocumentData, fallbackId = "", explicitDate = ""): ClassRow | null {
  if (data.active === false || text(data.status, 30) === "retired") return null;
  const className = text(data.className ?? data.name ?? data.title, 300);
  if (!className) return null;
  const instructorName = text(data.instructorName ?? data.instructor ?? data.teacherName ?? classTeacherFromName(className), 120).replace(/T$/i, "");
  const times = extractTimes(className, data);
  const explicitClassId = text(data.classId, 180) || fallbackId;
  const classId = explicitClassId || hashId("LEGCLS", normalize(className), teacherNameKey(instructorName));
  const rawDates = unique(Array.isArray(data.dates) ? data.dates : [], 20).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date));
  const rowWeekday = extractWeekday(className, data);
  if (
    explicitDate &&
    !rawDates.includes(explicitDate) &&
    (!rowWeekday || rowWeekday === weekdayForDate(explicitDate))
  ) {
    rawDates.push(explicitDate);
  }
  return {
    classId,
    className,
    instructorUid: text(data.instructorUid ?? data.teacherUid, 160),
    instructorName,
    teacherScopeKey: text(data.teacherScopeKey, 180),
    startTime: times.startTime,
    endTime: times.endTime,
    videoLink: text(data.videoLink ?? data.classVideoLink ?? data.lessonVideoLink, 2000),
    weekday: rowWeekday,
    dates: rawDates.sort(),
    active: true,
    raw: data
  };
}
function classSemanticKey7355015(item: ClassRow): string {
  return [
    normalize(item.className),
    teacherNameKey(item.instructorName || classTeacherFromName(item.className)),
    safeTime(item.startTime),
    safeTime(item.endTime)
  ].join("|");
}
function classRichness7355015(item: ClassRow, canonicalIds: Set<string>): number {
  let score = canonicalIds.has(item.classId) ? 1000000 : 0;
  if (item.instructorUid) score += 10000;
  if (item.teacherScopeKey) score += 5000;
  if (item.startTime && item.endTime) score += 1000;
  score += Math.min(999, Math.max(0, Number(item.raw?.updatedAtMs || 0) % 1000));
  return score;
}
function dedupeClassCatalog7355015(rows: ClassRow[], canonicalIds: Set<string>): ClassRow[] {
  const map = new Map<string, ClassRow>();
  rows.forEach(row => {
    const key = classSemanticKey7355015(row);
    const current = map.get(key);
    if (!current) {
      map.set(key, row);
      return;
    }
    const preferred = classRichness7355015(row, canonicalIds) > classRichness7355015(current, canonicalIds) ? row : current;
    const other = preferred === row ? current : row;
    preferred.instructorUid = preferred.instructorUid || other.instructorUid;
    preferred.instructorName = preferred.instructorName || other.instructorName;
    preferred.teacherScopeKey = preferred.teacherScopeKey || other.teacherScopeKey;
    preferred.startTime = preferred.startTime || other.startTime;
    preferred.endTime = preferred.endTime || other.endTime;
    preferred.videoLink = preferred.videoLink || other.videoLink;
    preferred.weekday = preferred.weekday || other.weekday;
    preferred.dates = Array.from(new Set([...preferred.dates, ...other.dates])).filter(date => {
      return !preferred.weekday || preferred.weekday === weekdayForDate(date);
    }).sort();
    map.set(key, preferred);
  });
  return Array.from(map.values());
}

async function loadClassCatalog(anchorDate = safeDate("")): Promise<ClassRow[]> {
  // 7.35.5.0.16: `classes` is the canonical operating class catalog.
  // Read only the selected day's old staffClassLists document as a transitional fallback.
  // The former +/- 21 day scan made every attendance/tablet request fan out to 29 Firestore reads
  // and could re-introduce an adjacent weekday class into the selected date.
  const [classSnapshot, daySnapshot] = await Promise.all([
    db().collection("classes").limit(Math.max(MAX_CLASSES, 2000)).get(),
    db().collection("staffClassLists").doc(anchorDate).get()
  ]);
  const retired = new Set(classSnapshot.docs
    .filter(doc => doc.data()?.active === false || text(doc.data()?.status, 30) === "retired")
    .map(doc => text(doc.data()?.classId, 180) || doc.id));
  const canonicalIds = new Set(classSnapshot.docs
    .filter(doc => doc.data()?.active !== false && text(doc.data()?.status, 30) !== "retired")
    .map(doc => text(doc.data()?.classId, 180) || doc.id));
  const map = new Map<string, ClassRow>();
  const add = (row: ClassRow | null) => {
    if (!row || retired.has(row.classId)) return;
    const current = map.get(row.classId);
    if (!current) { map.set(row.classId, row); return; }
    current.className = current.className || row.className;
    current.instructorUid = current.instructorUid || row.instructorUid;
    current.instructorName = current.instructorName || row.instructorName;
    current.teacherScopeKey = current.teacherScopeKey || row.teacherScopeKey;
    current.startTime = current.startTime || row.startTime;
    current.endTime = current.endTime || row.endTime;
    current.videoLink = current.videoLink || row.videoLink;
    if (!current.weekday && row.weekday) current.weekday = row.weekday;
    current.dates = Array.from(new Set([...current.dates, ...row.dates])).sort();
    current.raw = { ...row.raw, ...current.raw };
  };
  classSnapshot.docs.forEach(doc => add(classRowFromData7355014(doc.data() ?? {}, doc.id)));
  if (daySnapshot.exists) {
    const data = daySnapshot.data() ?? {};
    const classes = Array.isArray(data.classes) ? data.classes.map(object) : [];
    classes.forEach(item => add(classRowFromData7355014(item as DocumentData, text(item.classId, 180), anchorDate)));
  }
  const rows = dedupeClassCatalog7355015(
    Array.from(map.values()).filter(row => row.className && row.active),
    canonicalIds
  );
  rows.sort((a, b) => a.className.localeCompare(b.className, "ko") || a.classId.localeCompare(b.classId));
  return rows;
}
async function loadEnrollments(activeOnly = false): Promise<EnrollmentRow[]> {
  const query = activeOnly
    ? db().collection("studentEnrollments").where("active", "==", true).limit(MAX_ENROLLMENTS)
    : db().collection("studentEnrollments").limit(MAX_ENROLLMENTS);
  const snapshot = await query.get();
  return snapshot.docs.map(doc => {
    const data = doc.data() ?? {};
    return {
      id: doc.id,
      studentUid: text(data.studentUid, 160),
      classId: text(data.classId, 180),
      className: text(data.className, 300),
      instructorUid: text(data.instructorUid ?? data.teacherUid, 160),
      instructorName: text(data.instructorName ?? data.instructor, 120),
      status: text(data.status ?? data.enrollmentStatus, 40),
      active: data.active !== false,
      startDate: text(data.startDate ?? data.initialRegisteredDate, 20),
      endDate: text(data.endDate, 20),
      operationDate: text(data.operationDate, 20),
      registrationType: text(data.registrationType, 40),
      entryType: text(data.entryType ?? data.attendanceEntryType, 40),
      entryStartDate: text(data.entryStartDate ?? ((data.entryType ?? data.attendanceEntryType) ? (data.startDate ?? data.initialRegisteredDate) : ""), 20),
      entryTypeSource: text(data.entryTypeSource, 100),
      raw: data
    };
  }).filter(row => row.studentUid);
}
// __ULIM_ATTENDANCE_EXPLICIT_AUTHORITY_HISTORY_73550978__
function historicalClassCatalog73550978(
  currentCatalog: ClassRow[],
  enrollments: EnrollmentRow[],
  attendanceDocs: Array<{ id: string; data(): DocumentData }>,
  previousStart: string,
  currentStart: string
): ClassRow[] {
  // __ULIM_HISTORICAL_CLASS_SEMANTIC_SPLIT_73550979__
  // Historical-only classes must never be merged by classId alone. A retired/reused
  // classId can represent more than one weekday/time/name in the previous month.
  type HistEvidence73550979 = {
    sourceClassId: string;
    raw: DocumentData;
    dates: Set<string>;
    attendanceDates: Set<string>;
    className: string;
    instructorName: string;
    startTime: string;
    endTime: string;
    weekday: string;
    key: string;
  };
  const currentIds = new Set(currentCatalog.map(item => item.classId));
  const evidence = new Map<string, HistEvidence73550979>();
  const weekdayToken73550979 = /[일월화수목금토]요일/;
  const snapshot73550979 = (rawInput: DocumentData, classId: string, evidenceDate = "") => {
    const raw = rawInput ?? {};
    const className = text(raw.className ?? raw.name ?? raw.title, 300);
    const instructorName = text(raw.instructorName ?? raw.instructor ?? raw.teacherName ?? classTeacherFromName(className), 120).replace(/T$/i, "");
    const times = extractTimes(className, raw);
    // For saved attendance, the actual calendar date is the strongest historical weekday evidence.
    // This intentionally splits a reused classId that contains both Sunday and Monday records.
    const weekday = evidenceDate ? weekdayForDate(evidenceDate) : extractWeekday(className, raw);
    const key = [classId, normalize(className), teacherNameKey(instructorName), safeTime(times.startTime), safeTime(times.endTime), weekday].join("|");
    return { raw, className, instructorName, startTime: safeTime(times.startTime), endTime: safeTime(times.endTime), weekday, key };
  };
  const add73550979 = (classId: string, rawInput: DocumentData, date = "", fromAttendance = false) => {
    if (!classId || currentIds.has(classId)) return;
    const snap = snapshot73550979(rawInput, classId, fromAttendance ? date : "");
    if (!snap.className) return;
    let current = evidence.get(snap.key);
    if (!current) {
      current = {
        sourceClassId: classId,
        raw: {},
        dates: new Set<string>(),
        attendanceDates: new Set<string>(),
        className: snap.className,
        instructorName: snap.instructorName,
        startTime: snap.startTime,
        endTime: snap.endTime,
        weekday: snap.weekday,
        key: snap.key
      };
      evidence.set(snap.key, current);
    }
    current.raw = { ...current.raw, ...snap.raw, classId, className: current.className, active: true, status: "historical" };
    if (date >= previousStart && date < currentStart) {
      current.dates.add(date);
      if (fromAttendance) current.attendanceDates.add(date);
    }
  };
  attendanceDocs.forEach(doc => {
    const data = doc.data() ?? {};
    if (data.active === false) return;
    const date = text(data.sessionDate ?? data.date, 20);
    if (date < previousStart || date >= currentStart) return;
    add73550979(text(data.classId, 180), data, date, true);
  });
  enrollments.forEach(row => {
    if (!row.classId || currentIds.has(row.classId)) return;
    const startsBeforeEnd = !row.startDate || row.startDate < currentStart;
    const endsAfterStart = !row.endDate || row.endDate >= previousStart;
    if (!startsBeforeEnd || !endsAfterStart) return;
    add73550979(row.classId, {
      ...row.raw,
      classId: row.classId,
      className: row.className,
      instructorUid: row.instructorUid,
      instructorName: row.instructorName
    }, "", false);
  });
  const allPreviousDates = calendarDates7355033(previousStart, dateKeyOffset735505(currentStart, -1));
  const result: ClassRow[] = [];
  evidence.forEach(entry => {
    const rawClassName = entry.className;
    let displayClassName = rawClassName;
    const classNameWeekday = extractWeekday(rawClassName, entry.raw);
    if (entry.weekday && classNameWeekday && classNameWeekday !== entry.weekday && weekdayToken73550979.test(displayClassName)) {
      // Display-only repair for reused historical ids whose saved title kept another weekday.
      // No Firestore document is modified.
      displayClassName = displayClassName.replace(weekdayToken73550979, entry.weekday + "요일");
    }
    const seed = {
      ...entry.raw,
      classId: entry.sourceClassId,
      className: displayClassName,
      instructorName: entry.instructorName,
      startTime: entry.startTime,
      endTime: entry.endTime,
      weekday: entry.weekday,
      active: true,
      status: "historical",
      dates: Array.from(entry.attendanceDates)
    };
    const row = classRowFromData7355014(seed, entry.sourceClassId);
    if (!row) return;
    row.className = displayClassName;
    row.weekday = entry.weekday || row.weekday;
    row.startTime = entry.startTime || row.startTime;
    row.endTime = entry.endTime || row.endTime;
    const dates = new Set<string>(entry.attendanceDates);
    // If any saved attendance exists for this semantic class snapshot, those exact dates are
    // the historical session authority. Enrollment must not invent extra dates or merge weekdays.
    if (!dates.size) {
      const related = enrollments.filter(enrollment => {
        if (enrollment.classId !== entry.sourceClassId) return false;
        const snap = snapshot73550979({
          ...enrollment.raw,
          className: enrollment.className,
          instructorName: enrollment.instructorName,
          instructorUid: enrollment.instructorUid
        }, entry.sourceClassId, "");
        if (snap.className && entry.className && normalize(snap.className) !== normalize(entry.className)) return false;
        if (snap.instructorName && entry.instructorName && teacherNameKey(snap.instructorName) !== teacherNameKey(entry.instructorName)) return false;
        if (snap.startTime && entry.startTime && snap.startTime !== entry.startTime) return false;
        if (snap.endTime && entry.endTime && snap.endTime !== entry.endTime) return false;
        if (snap.weekday && entry.weekday && snap.weekday !== entry.weekday) return false;
        return true;
      });
      allPreviousDates.forEach(date => {
        if (!classScheduledOnDate(row, date)) return;
        if (related.some(enrollment => enrollmentActiveOnDate(enrollment, date, true))) dates.add(date);
      });
    }
    row.dates = Array.from(dates).filter(date => date >= previousStart && date < currentStart).sort();
    if (!row.dates.length) return;
    row.raw = {
      ...row.raw,
      __ulimHistoricalOnly73550978: true,
      __ulimHistoricalSemanticSplit73550979: true,
      historicalSourceClassId73550979: entry.sourceClassId,
      historicalGroupKey73550979: entry.key,
      historicalEvidenceDates73550978: row.dates.slice(),
      historicalAttendanceDates73550979: Array.from(entry.attendanceDates).sort()
    };
    result.push(row);
  });
  return result.sort((a, b) =>
    weekdaySortValue7355033(a.weekday) - weekdaySortValue7355033(b.weekday) ||
    timeSortValue7355033(a.startTime) - timeSortValue7355033(b.startTime) ||
    text(a.className, 300).localeCompare(text(b.className, 300), "ko")
  );
}

function studentCurrentClassIds7355014(data: DocumentData): string[] {
  const raw = Array.isArray(data.classUids) ? data.classUids : (Array.isArray(data.classIds) ? data.classIds : []);
  return unique(raw, 180);
}
function studentCurrentClassNames7355014(data: DocumentData): string[] {
  const raw = Array.isArray(data.classNames) ? data.classNames : [];
  return unique(raw, 300);
}
function studentAssignedToClass7355014(data: DocumentData, item: ClassRow): boolean {
  const ids = studentCurrentClassIds7355014(data);
  if (ids.includes(item.classId)) return true;
  const names = studentCurrentClassNames7355014(data);
  if (!names.some(name => normalize(name) === normalize(item.className))) return false;
  const studentTeachers = unique(Array.isArray(data.instructorNames) ? data.instructorNames : [], 120).map(teacherNameKey).filter(Boolean);
  const classTeacher = teacherNameKey(item.instructorName || classTeacherFromName(item.className));
  return !studentTeachers.length || !classTeacher || studentTeachers.includes(classTeacher);
}
function explicitSpecialAttendance7355014(data: DocumentData): boolean {
const kind = normalize(
    data.attendanceEntryType ??
    data.nameSpecialType ??
    data.specialType ??
    data.kind ??
    data.specialStatus
  );
  if (kind === "new" || kind === normalize("신규") || kind === "class_move" || kind === normalize("반이동")) return false;
  return data.temporaryEnrollment === true ||
    data.temporaryStudent === true ||
    kind === "makeup" ||
    kind === normalize("보강") ||
    kind === "daily_special" ||
    kind === normalize("일일특강");
}
function effectiveStudentData7355014(student: DocumentData | undefined, attendance: DocumentData | undefined): DocumentData {
  const current = student ?? {};
  const overlay = attendance ?? {};
  return {
    ...overlay,
    ...current,
    name: current.name ?? current.studentName ?? overlay.studentName ?? overlay.name,
    studentName: current.studentName ?? current.name ?? overlay.studentName ?? overlay.name,
    attendanceNo: current.attendanceNo ?? current.loginId ?? current.studentNo ?? overlay.attendanceNo ?? overlay.studentNo,
    studentPhone: current.studentPhone ?? current.phone ?? overlay.studentPhone ?? overlay.phone,
    parentPhone: current.parentPhone ?? overlay.parentPhone,
    enrollmentStatus: current.enrollmentStatus ?? current.status ?? overlay.enrollmentStatus ?? 'active'
  };
}
function effectiveHistoricalStudentData7355033(student: DocumentData | undefined, attendance: DocumentData | undefined): DocumentData {
  // Previous-month identity prefers the date-scoped attendance snapshot. Current student data is fallback-only.
  // This prevents later class/status changes from becoming the authority for an already-finished month.
  const current = student ?? {};
  const historical = attendance ?? {};
  return {
    ...current,
    ...historical,
    name: historical.studentName ?? historical.name ?? current.name ?? current.studentName,
    studentName: historical.studentName ?? historical.name ?? current.studentName ?? current.name,
    attendanceNo: historical.attendanceNo ?? historical.studentNo ?? current.attendanceNo ?? current.loginId ?? current.studentNo,
    studentPhone: historical.studentPhone ?? historical.phone ?? current.studentPhone ?? current.phone,
    parentPhone: historical.parentPhone ?? current.parentPhone,
    enrollmentStatus: historical.enrollmentStatus ?? current.enrollmentStatus ?? current.status ?? 'active'
  };
}
function resolveClass(catalog: ClassRow[], input: PlainObject): ClassRow | null {
  const classId = text(input.classId, 180);
  if (classId) {
    const exact = catalog.find(item => item.classId === classId);
    if (exact) return exact;
  }
  const wantedName = normalize(input.className);
  if (!wantedName || wantedName === normalize("전체반")) return null;
  const teacher = teacherNameKey(input.instructor ?? input.instructorName ?? classTeacherFromName(text(input.className, 300)));
  let candidates = catalog.filter(item => normalize(item.className) === wantedName || normalize(item.className).includes(wantedName) || wantedName.includes(normalize(item.className)));
  if (teacher) {
    const scoped = candidates.filter(item => teacherNameKey(item.instructorName) === teacher);
    if (scoped.length) candidates = scoped;
  }
  return candidates.length === 1 ? candidates[0] : null;
}
function enrollmentMatchesClass(row: EnrollmentRow, item: ClassRow): boolean {
  if (row.classId && row.classId === item.classId) return true;
  const namesMatch = normalize(row.className) === normalize(item.className);
  if (!namesMatch) return false;
  const rowTeacher = teacherNameKey(row.instructorName || classTeacherFromName(row.className));
  const classTeacher = teacherNameKey(item.instructorName || classTeacherFromName(item.className));
  return !rowTeacher || !classTeacher || rowTeacher === classTeacher;
}
async function loadStudentsByUids(uids: string[]): Promise<Map<string, DocumentData>> {
  const map = new Map<string, DocumentData>();
  const uniqueUids = unique(uids, 160);
  for (let offset = 0; offset < uniqueUids.length; offset += 300) {
    const refs = uniqueUids.slice(offset, offset + 300).map(uid => db().collection("students").doc(uid));
    const snapshots = await db().getAll(...refs);
    snapshots.forEach(snapshot => { if (snapshot.exists) map.set(snapshot.id, snapshot.data() ?? {}); });
  }
  return map;
}
function studentOperational(data: DocumentData): boolean {
  const status = text(data.enrollmentStatus ?? data.status, 40);
  return data.deleted !== true && !["leave", "휴원", "hold", "withdrawn", "퇴원", "cancelled"].includes(status);
}
function updatedAtMs(data: DocumentData): number {
  return Number(data.updatedAtMs ?? data.savedAtMs ?? data.createdAtMs ?? 0);
}
function attendanceMatchesClass(data: DocumentData, item: ClassRow): boolean {
  const cid = text(data.classId, 180);
// 73551005R2BB-strict-attendance-classid-owner: immutable classId wins when attendance already has classId.
  if (cid) return cid === item.classId;
  if (normalize(data.className) !== normalize(item.className)) return false;
  const rowTeacher = teacherNameKey(data.instructorName ?? data.instructor ?? classTeacherFromName(text(data.className, 300)));
  const classTeacher = teacherNameKey(item.instructorName);
  return !rowTeacher || !classTeacher || rowTeacher === classTeacher;
}
async function resolveClassroom(date: string, item: ClassRow): Promise<string> {
  // 7.35.5.0.21: realtimeClassroomDays is the Firestore mirror of 강의실 사용일지.
  // Match the class name/purpose first. Teacher/time are supporting keys, not mandatory gates.
  const snapshot = await db().collection("realtimeClassroomDays").doc(date).get();
  const data = snapshot.data() ?? {};
  const records = Array.isArray(data.records) ? data.records.map(object) : [];
  if (!records.length) return text(item.raw?.roomName ?? item.raw?.classroom ?? item.raw?.room, 100) || "데스크문의";

  const targetClass = normalize(item.className);
  const teacherKey = teacherNameKey(item.instructorName);
  const targetStart = safeTime(item.startTime);
  const targetEnd = safeTime(item.endTime);
  const toMinutes = (value: unknown): number => {
    const safe = safeTime(value);
    if (!safe) return -1;
    const parts = safe.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  };
  const startMinutes = toMinutes(item.startTime);
  const endMinutes = toMinutes(item.endTime);

  const scored = records.map((record, index) => {
    const room = text(record.roomName ?? record.classroom ?? record.room, 100);
    if (!room) return null;
    const status = normalize(record.status);
    if ([normalize("취소"), normalize("해제"), normalize("사용완료")].includes(status)) return null;
    const recordClass = normalize(record.className ?? record.purpose ?? record.lessonName ?? record.title);
    const classExact = Boolean(targetClass && recordClass && targetClass === recordClass);
    const classContains = Boolean(targetClass && recordClass && !classExact && (targetClass.includes(recordClass) || recordClass.includes(targetClass)));
    const recordTeacher = teacherNameKey(record.instructorName ?? record.instructor ?? record.teacherName ?? record.teacher ?? record.adminName);
    const teacherExact = Boolean(teacherKey && recordTeacher && teacherKey === recordTeacher);
    const recordStart = safeTime(record.startTime ?? record.startHour);
    const recordEnd = safeTime(record.endTime ?? record.endHour);
    const startExact = Boolean(targetStart && recordStart && targetStart === recordStart);
    const endExact = Boolean(targetEnd && recordEnd && targetEnd === recordEnd);
    const recordStartMinutes = toMinutes(record.startTime ?? record.startHour);
    const recordEndMinutes = toMinutes(record.endTime ?? record.endHour);
    const overlaps = startMinutes >= 0 && endMinutes > startMinutes && recordStartMinutes >= 0 && recordEndMinutes > recordStartMinutes
      ? Math.max(startMinutes, recordStartMinutes) < Math.min(endMinutes, recordEndMinutes)
      : false;
    let score = 0;
    if (classExact) score += 100;
    else if (classContains) score += 70;
    if (teacherExact) score += 35;
    if (startExact) score += 20;
    if (endExact) score += 10;
    if (overlaps) score += 12;
    return { record, room, score, classExact, classContains, teacherExact, startExact, overlaps, index };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row && row.score > 0));

  scored.sort((a, b) => b.score - a.score || Number(b.classExact) - Number(a.classExact) || Number(b.classContains) - Number(a.classContains) || Number(b.teacherExact) - Number(a.teacherExact) || Number(b.startExact) - Number(a.startExact) || a.index - b.index);
  if (!scored.length) return text(item.raw?.roomName ?? item.raw?.classroom ?? item.raw?.room, 100) || "데스크문의";
  const top = scored[0];
  // Exact/contains class-name matches from 강의실 사용일지 are authoritative even without teacher/time metadata.
  if (top.classExact || top.classContains) return top.room;
  // Otherwise require teacher plus a time key to avoid assigning another class taught by the same instructor.
  if (top.teacherExact && (top.startExact || top.overlaps)) return top.room;
  return text(item.raw?.roomName ?? item.raw?.classroom ?? item.raw?.room, 100) || "데스크문의";
}
async function loadScheduleChanges(date: string): Promise<PlainObject[]> {
  const [target, original] = await Promise.all([
    db().collection("classScheduleChanges").where("targetDate", "==", date).limit(300).get(),
    db().collection("classScheduleChanges").where("originalDate", "==", date).limit(300).get()
  ]);
  return Array.from(new Map<string, PlainObject>(
    [...target.docs, ...original.docs]
      .map(doc => [doc.id, { changeId: doc.id, ...doc.data() }] as [string, PlainObject])
      .filter(([, data]) => data.active !== false)
  ).values());
}
async function loadScheduleChangesRange7355049(startDate: string, endDate: string): Promise<PlainObject[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) return [];
  const [original, target] = await Promise.all([
    db().collection("classScheduleChanges").where("originalDate", ">=", startDate).where("originalDate", "<=", endDate).limit(MAX_LEDGER_SCHEDULE_CHANGES_7355033).get(),
    db().collection("classScheduleChanges").where("targetDate", ">=", startDate).where("targetDate", "<=", endDate).limit(MAX_LEDGER_SCHEDULE_CHANGES_7355033).get()
  ]);
  return Array.from(new Map<string, PlainObject>(
    [...original.docs, ...target.docs]
      .map(doc => [doc.id, { changeId: doc.id, ...object(doc.data() ?? {}) }] as [string, PlainObject])
      .filter(([, data]) => data.active !== false)
  ).values());
}
function classScheduleOperation7355033(change: PlainObject): string {
  const raw = normalize(change.operation ?? change.changeType ?? change.sessionStatus);
  if (raw === 'exclude' || raw === normalize('수업일제외') || raw === 'excluded') return 'exclude';
  if (raw === 'cancel' || raw === normalize('휴강') || raw === 'cancelled') return 'cancel';
  if (raw === 'substitute' || raw === normalize('대강')) return 'substitute';
  return 'move';
}
function effectiveClassesForDate(catalog: ClassRow[], date: string, changes: PlainObject[]): { classes: ClassRow[]; movedAway: Map<string, PlainObject> } {
  const movedAway = new Map<string, PlainObject>();
  changes.forEach(change => {
    const classId = text(change.classId, 180);
    const operation = classScheduleOperation7355033(change);
    if (text(change.originalDate, 20) !== date) return;
    if (operation === 'cancel' || operation === 'exclude') { movedAway.set(classId, change); return; }
    if (operation === 'move' && text(change.targetDate, 20) && text(change.targetDate, 20) !== date) movedAway.set(classId, change);
  });
  const classes = catalog.filter(item => {
    if (movedAway.has(item.classId)) return false;
    if (classScheduledOnDate(item, date)) return true;
    return changes.some(change => text(change.classId, 180) === item.classId && text(change.targetDate, 20) === date && !['cancel','exclude'].includes(classScheduleOperation7355033(change)));
  }).map(item => {
    const change = changes.find(row => text(row.classId, 180) === item.classId && text(row.targetDate, 20) === date && !['cancel','exclude'].includes(classScheduleOperation7355033(row)));
    if (!change) return item;
    return {
      ...item,
      instructorUid: text(change.instructorUid, 160) || item.instructorUid,
      instructorName: text(change.instructorName, 120) || item.instructorName,
      startTime: safeTime(change.startTime) || item.startTime,
      endTime: safeTime(change.endTime) || item.endTime,
      weekday: weekdayForDate(date),
      raw: { ...item.raw, scheduleChange: change }
    };
  });
  return { classes, movedAway };
}
export async function buildClassListForDate7355014(caller: StaffCaller | null, dateInput: string): Promise<ClassRow[]> {
  const date = safeDate(dateInput);
  const [catalog, changes] = await Promise.all([loadClassCatalog(date), loadScheduleChanges(date)]);
  let classes = effectiveClassesForDate(catalog, date, changes).classes;
  if (caller) classes = classes.filter(item => classVisibleToCaller(item, caller));
  return classes.sort((a, b) => timeSortValue7355033(a.startTime) - timeSortValue7355033(b.startTime) || a.className.localeCompare(b.className, "ko") || a.classId.localeCompare(b.classId));
}

export async function buildAttendanceRosterInternal7355014(caller: StaffCaller | null, input: PlainObject): Promise<RosterBuild & { diagnostics: PlainObject }> {
  const date = safeDate(input.date);
  if (date <= safeDate("")) await applyDueCourseApplications7355028();
  const requestedAll = normalize(input.className) === normalize("전체반") || input.allClasses === true;
  const useCurrentStudentRoster7355015 = date >= CANONICAL_CURRENT_ROSTER_CUTOVER_7355015;
  const [catalog, enrollments, studentSnapshot, attendanceSnapshot, overrideSnapshot, changes] = await Promise.all([
    loadClassCatalog(date),
    loadEnrollments(false),
    db().collection("students").limit(MAX_STUDENTS).get(),
    db().collection("attendance").where("sessionDate", "==", date).limit(MAX_ATTENDANCE).get(),
    db().collection("attendanceSessionOverrides").where("date", "==", date).limit(MAX_OVERRIDES).get(),
    loadScheduleChanges(date)
  ]);
  const effective = effectiveClassesForDate(catalog, date, changes);
  const resolved = resolveClass(catalog, input);
  let selectedClasses: ClassRow[];
  let movedAway: PlainObject | null = null;
  if (requestedAll) selectedClasses = effective.classes;
  else if (resolved) {
    movedAway = effective.movedAway.get(resolved.classId) ?? null;
    const effectiveItem = effective.classes.find(item => item.classId === resolved.classId) ?? null;
    // Never render a regular roster on a date where the class is not actually scheduled.
    selectedClasses = movedAway || !effectiveItem ? [] : [effectiveItem];
  } else {
    selectedClasses = [];
  }
  if (caller) selectedClasses = selectedClasses.filter(item => classVisibleToCaller(item, caller));
  const selectedIds = new Set(selectedClasses.map(item => item.classId));

  const students = new Map<string, DocumentData>();
  studentSnapshot.docs.forEach(doc => students.set(doc.id, doc.data() ?? {}));
  const historicalDate = !useCurrentStudentRoster7355015;
  const activeEnrollments = enrollments.filter(row => enrollmentActiveOnDate(row, date, historicalDate) && selectedClasses.some(item => enrollmentMatchesClass(row, item)));
  const endedDateEnrollments7355033 = useCurrentStudentRoster7355015
    ? enrollments.filter(row => Boolean(row.endDate) && enrollmentActiveOnDate(row, date, true) && (!row.active || row.status === "ended" || row.status === "withdrawn") && selectedClasses.some(item => enrollmentMatchesClass(row, item)))
    : [];
  const registrationEventDates7355049: string[] = [];
  const registrationRecentFloor7355049 = dateOffset7355014(date, -REGISTRATION_SCHEDULE_CHANGE_LOOKBACK_DAYS_7355049);
  if (useCurrentStudentRoster7355015) {
    for (const item of selectedClasses) {
      students.forEach((student, studentUid) => {
        if (!studentOperational(student) || !studentAssignedToClass7355014(student, item)) return;
        const metadata = currentEnrollmentMetadata7355033(enrollments, studentUid, item);
        const eventDate = registrationEventDate7355048(metadata);
        // Bound the extra schedule-change query. Old membership events are already past their
        // first practical session and must not create large historical scans on every roster load.
        if (eventDate && eventDate >= registrationRecentFloor7355049 && eventDate <= date) registrationEventDates7355049.push(eventDate);
      });
    }
  }
  const registrationWindowStart7355049 = registrationEventDates7355049.sort()[0] || date;
  const registrationScheduleChanges7355049 = registrationWindowStart7355049 < date
    ? Array.from(new Map<string, PlainObject>(
        [...changes, ...(await loadScheduleChangesRange7355049(registrationWindowStart7355049, date))]
          .map(change => [text(change.changeId, 180) || hashId("SCH", text(change.classId, 180), text(change.originalDate, 20), text(change.targetDate, 20), text(change.operation, 40)), change] as [string, PlainObject])
      ).values())
    : changes;
  const registrationFirstSessionCache7355049 = new Map<string, string>();
  const overrideRows = overrideSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() ?? {} }));
  const excludedBySession = new Set<string>();
  const includedBySession = new Map<string, Set<string>>();
  overrideRows.forEach(({ data }) => {
    if (data.active === false) return;
    const classId = text(data.classId, 180);
    const studentUid = text(data.studentUid, 160);
    if (!studentUid || !selectedIds.has(classId)) return;
    if (data.included === true) {
      const set = includedBySession.get(classId) ?? new Set<string>();
      set.add(studentUid);
      includedBySession.set(classId, set);
    }
    if (data.excluded === true) excludedBySession.add(`${classId}|${studentUid}`);
  });

  const latestAttendance = new Map<string, { id: string; data: DocumentData }>();
  const explicitSpecialByClass = new Map<string, Set<string>>();
  let staleAttendanceIgnoredCount = 0;
  attendanceSnapshot.docs.forEach(doc => {
    const data = doc.data() ?? {};
    if (data.active === false) return;
    const studentUid = text(data.studentUid ?? data.studentIdentityKey ?? data.studentKey, 160);
    const item = selectedClasses.find(cls => attendanceMatchesClass(data, cls));
    if (!studentUid || !item) return;
    const key = `${item.classId}|${studentUid}`;
    const current = latestAttendance.get(key);
    if (!current || updatedAtMs(data) >= updatedAtMs(current.data)) latestAttendance.set(key, { id: doc.id, data });
    if (explicitSpecialAttendance7355014(data)) {
      const set = explicitSpecialByClass.get(item.classId) ?? new Set<string>();
      set.add(studentUid);
      explicitSpecialByClass.set(item.classId, set);
    }
  });

  const roomByClass = new Map<string, string>();
  await Promise.all(selectedClasses.map(async item => { roomByClass.set(item.classId, await resolveClassroom(date, item)); }));
  const rows: PlainObject[] = [];
  let currentAssignmentCount = 0;
  let enrollmentFallbackCount = 0;
  let overrideAddedCount = 0;
  let specialAddedCount = 0;
  let savedOverlayCount = 0;

  for (const item of selectedClasses) {
    const uids = new Set<string>();
    // 2026-08-01 이후 운영 출석부는 학생명단(students.classUids/classNames)만 정규 명단 원본으로 사용합니다.
    // 과거 studentEnrollments/attendance 값이 뒤늦게 현재 명단에 섞여드는 것을 허용하지 않습니다.
    if (useCurrentStudentRoster7355015) {
      students.forEach((student, studentUid) => {
        if (!studentOperational(student)) return;
        if (!studentAssignedToClass7355014(student, item)) return;
        const metadata = currentEnrollmentMetadata7355033(enrollments, studentUid, item);
        const metadataKind = canonicalRegistrationKind7355048(metadata);
        const metadataEventDate = registrationEventDate7355048(metadata);
        if (metadataKind && metadataEventDate && metadataEventDate > date) return;
        uids.add(studentUid);
        currentAssignmentCount += 1;
      });
      endedDateEnrollments7355033.filter(row => enrollmentMatchesClass(row, item)).forEach(row => {
        const student = students.get(row.studentUid);
        if (student && studentOperational(student) && !uids.has(row.studentUid)) {
          uids.add(row.studentUid);
          enrollmentFallbackCount += 1;
        }
      });
    } else {
      activeEnrollments.filter(row => enrollmentMatchesClass(row, item)).forEach(row => {
        if (!uids.has(row.studentUid)) enrollmentFallbackCount += 1;
        uids.add(row.studentUid);
      });
    }
    (includedBySession.get(item.classId) ?? new Set<string>()).forEach(uid => {
      if (!uids.has(uid)) overrideAddedCount += 1;
      uids.add(uid);
    });
    (explicitSpecialByClass.get(item.classId) ?? new Set<string>()).forEach(uid => {
      if (!uids.has(uid)) specialAddedCount += 1;
      uids.add(uid);
    });

    for (const studentUid of uids) {
      if (!studentUid || excludedBySession.has(`${item.classId}|${studentUid}`)) continue;
      const attendance = latestAttendance.get(`${item.classId}|${studentUid}`);
      const student = students.get(studentUid);
      const sessionOverrideIncluded7355015 = (includedBySession.get(item.classId) ?? new Set<string>()).has(studentUid);
      const isExplicitSpecial = explicitSpecialAttendance7355014(attendance?.data ?? {});
      if (!student && !isExplicitSpecial) continue;
      const effectiveStudent = effectiveStudentData7355014(student, attendance?.data);
      if (student && !studentOperational(student)) continue;
      const enrollment = useCurrentStudentRoster7355015
        ? (student && studentAssignedToClass7355014(student, item)
            ? currentEnrollmentMetadata7355033(enrollments, studentUid, item)
            : endedEnrollmentEvidence7355033(enrollments, studentUid, item, date))
        : activeEnrollments.find(row => row.studentUid === studentUid && enrollmentMatchesClass(row, item));
      const studentStatus = text(effectiveStudent.enrollmentStatus ?? effectiveStudent.status, 40);
      const attendanceData = attendance?.data ?? {};
      const special = canonicalSessionSpecialStatus7355049(
        enrollment, item, date, attendanceData, registrationScheduleChanges7355049, registrationFirstSessionCache7355049
      );
      const specialDisplayScope = specialDisplayScope7355033(special, date);
      const outputRegistrationType = canonicalOutputRegistrationType7355049(enrollment, attendanceData);
      const status = ["leave", "휴원"].includes(studentStatus) ? "휴원" : statusValue(attendance?.data.status ?? attendance?.data.attendanceStatus);
      if (attendance) savedOverlayCount += 1;
      rows.push({
        recordId: attendance?.id || canonicalAttendanceRecordId73550993(date, item.classId, studentUid),
        date,
        sessionDate: date,
        sessionId: `${date}|${item.classId}`,
        classId: item.classId,
        className: item.className,
        instructorUid: item.instructorUid,
        teacherUid: item.instructorUid,
        teacherScopeKey: item.teacherScopeKey,
        instructorName: item.instructorName,
        instructor: item.instructorName,
        startTime: item.startTime,
        endTime: item.endTime,
        classroom: roomByClass.get(item.classId) || "데스크문의",
        roomName: roomByClass.get(item.classId) || "데스크문의",
        studentUid,
        studentIdentityKey: studentUid,
        studentName: text(effectiveStudent.name ?? effectiveStudent.studentName, 120),
        name: text(effectiveStudent.name ?? effectiveStudent.studentName, 120),
        attendanceNo: text(effectiveStudent.attendanceNo ?? effectiveStudent.loginId ?? effectiveStudent.studentNo, 60),
        studentNo: text(effectiveStudent.attendanceNo ?? effectiveStudent.loginId ?? effectiveStudent.studentNo, 60),
        studentPhone: text(effectiveStudent.studentPhone ?? effectiveStudent.phone, 60),
        parentPhone: text(effectiveStudent.parentPhone, 60),
        birthDate: text(effectiveStudent.birthDate, 20),
        enrollmentStatus: studentStatus,
        registrationType: outputRegistrationType,
        attendanceEntryType: special === "신규" ? "new" : (special === "반이동" ? "class_move" : (special === "보강" ? "makeup" : (special === "일일특강" ? "daily_special" : ""))),
        entryStartDate: (special === "신규" || special === "반이동")
          ? text(enrollment?.entryStartDate, 20)
          : (special ? text(attendance?.data.entryStartDate ?? date, 20) : ""),
        entryTypeSource: (special === "신규" || special === "반이동")
          ? text(enrollment?.entryTypeSource, 100)
          : (special ? text(attendance?.data.entryTypeSource ?? attendance?.data.nameSpecialSource, 100) : ""),
        attendanceRecordSource: text(attendance?.data.source, 100),
        enrollmentStartDate: registrationEventDate7355048(enrollment) || enrollment?.startDate || "",
        temporaryStudent: attendance?.data.temporaryStudent === true,
        sessionOverrideIncluded: sessionOverrideIncluded7355015,
        temporaryEnrollment: isExplicitSpecial || sessionOverrideIncluded7355015,
        status,
        attendanceStatus: status,
        specialStatus: special,
        specialDisplayScope,
        nameSpecialStatus: specialDisplayScope === "name" ? special : "",
        memo: text(attendance?.data.memo, 2000),
        currentStatus: text(attendance?.data.currentStatus, 100),
        active: true,
        source: "firestore_canonical_roster_7355049",
        updatedAtMs: updatedAtMs(attendance?.data ?? {})
      });
    }
  }

  // 진단용: 선택 반의 과거 attendance-only 행 중 canonical roster에 포함되지 않은 수를 계산합니다.
  const rowKeys = new Set(rows.map(row => `${text(row.classId, 180)}|${text(row.studentUid, 160)}`));
  latestAttendance.forEach((value, key) => {
    if (!rowKeys.has(key) && !explicitSpecialAttendance7355014(value.data)) staleAttendanceIgnoredCount += 1;
  });

  rows.sort((a, b) => {
    const aClass = selectedClasses.find(item => item.classId === text(a.classId, 180));
    const bClass = selectedClasses.find(item => item.classId === text(b.classId, 180));
    const timeDiff = timeSortValue7355033(aClass?.startTime) - timeSortValue7355033(bClass?.startTime);
    if (timeDiff) return timeDiff;
    const classDiff = text(a.className, 300).localeCompare(text(b.className, 300), "ko");
    if (classDiff) return classDiff;
    const aMakeup = normalize(a.specialStatus) === normalize("보강") ? 1 : 0;
    const bMakeup = normalize(b.specialStatus) === normalize("보강") ? 1 : 0;
    return aMakeup - bMakeup || text(a.studentName, 120).localeCompare(text(b.studentName, 120), "ko");
  });
  const groups = selectedClasses.map(item => {
    const groupRows = rows.filter(row => text(row.classId, 180) === item.classId);
    return {
      classId: item.classId,
      className: item.className,
      instructorUid: item.instructorUid,
      instructorName: item.instructorName,
      startTime: item.startTime,
      endTime: item.endTime,
      roomName: roomByClass.get(item.classId) || "데스크문의",
      count: groupRows.length,
      rows: groupRows
    };
  }).filter(group => Number(group.count) > 0 || !requestedAll);
  return {
    date,
    rows,
    groups,
    classes: selectedClasses,
    selectedClass: requestedAll ? null : (selectedClasses[0] ?? resolved),
    allClasses: requestedAll,
    movedAway,
    diagnostics: {
      currentAssignmentCount,
      enrollmentFallbackCount,
      overrideAddedCount,
      specialAddedCount,
      savedOverlayCount,
      staleAttendanceIgnoredCount,
      source: useCurrentStudentRoster7355015
        ? "students_only_after_cutover_attendance_overlay_7355015"
        : "historical_enrollments_before_cutover_7355015",
      currentRosterCutover: CANONICAL_CURRENT_ROSTER_CUTOVER_7355015
    }
  };
}

export async function buildTabletOperationalSnapshot73550(dateInput: string): Promise<PlainObject> {
  const date = safeDate(dateInput);
  const built = await buildAttendanceRosterInternal7355014(null, { date, className: "전체반", allClasses: true });
  const attendanceMap: Record<string, PlainObject[]> = {};
  const candidateMaps = new Map<string, Map<string, PlainObject>>();
  built.rows.forEach(row => {
    const attendanceNo = text(row.attendanceNo, 60).replace(/\D/g, "");
    const studentName = text(row.studentName, 120);
    if (!attendanceNo || !studentName) return;
    if (!candidateMaps.has(attendanceNo)) candidateMaps.set(attendanceNo, new Map());
    const candidateMap = candidateMaps.get(attendanceNo)!;
    const candidateKey = text(row.studentUid, 160) || `${attendanceNo}|${normalize(studentName)}`;
    let candidate = candidateMap.get(candidateKey);
    if (!candidate) {
      candidate = {
        name: studentName,
        studentName,
        studentUid: text(row.studentUid, 160),
        studentIdentityKey: text(row.studentUid, 160),
        attendanceNo,
        classes: []
      };
      candidateMap.set(candidateKey, candidate);
    }
    const classes = candidate.classes as PlainObject[];
    classes.push({
      index: classes.length,
      recordId: row.recordId,
      classId: row.classId,
      className: row.className,
      instructor: row.instructorName,
      instructorName: row.instructorName,
      instructorUid: row.instructorUid,
      teacherUid: row.instructorUid,
      teacherScopeKey: row.teacherScopeKey,
      startTime: row.startTime,
      endTime: row.endTime,
      roomName: row.roomName,
      classroom: row.roomName,
      status: row.status,
      specialStatus: row.specialStatus,
      studentUid: row.studentUid,
      studentName: row.studentName,
      studentNo: row.attendanceNo,
      attendanceNo: row.attendanceNo,
      studentPhone: row.studentPhone,
      parentPhone: row.parentPhone
    });
  });
  candidateMaps.forEach((map, attendanceNo) => {
    const candidates = Array.from(map.values());
    candidates.forEach(candidate => {
      const classes = Array.isArray(candidate.classes) ? candidate.classes.map(object) : [];
      classes.sort((a, b) => text(a.className).localeCompare(text(b.className), "ko"));
      classes.forEach((entry, index) => { entry.index = index; });
      candidate.classes = classes;
      if (classes.length === 1) {
        candidate.className = classes[0].className;
        candidate.instructor = classes[0].instructor;
        candidate.roomName = classes[0].roomName;
      }
    });
    candidates.sort((a, b) => text(a.name).localeCompare(text(b.name), "ko"));
    attendanceMap[attendanceNo] = candidates;
  });
  const studentCount = Object.values(attendanceMap).reduce((sum, value) => sum + value.length, 0);
  return {
    status: "success",
    date,
    operationalDate: date,
    attendanceMap,
    students: Object.entries(attendanceMap).map(([attendanceNo, candidates]) => ({ attendanceNo, studentNo: attendanceNo, candidates })),
    records: built.rows,
    studentCount,
    classCount: built.rows.length,
    count: built.rows.length,
    diagnostics: built.diagnostics,
    source: "firestore_canonical_roster_7355049",
    updatedAtMs: Date.now(),
    version: TABLET_CANONICAL_ROSTER_VERSION_7355049
  };
}

async function touchAttendanceRevision(reason: string, details: PlainObject = {}): Promise<void> {
  await db().collection("operationalRealtimeRevisions").doc("attendance").set({
    revision: FieldValue.increment(1),
    reason,
    details,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
    version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  }, { merge: true });
}
async function refreshTodayTabletSnapshot(reason: string): Promise<void> {
  const date = safeDate("");
  try {
    const snapshot = await buildTabletOperationalSnapshot73550(date);
    await db().collection("tabletDailySnapshots").doc(date).set({
      ...snapshot,
      reason,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: false });
  } catch {
    // 운영 원본 저장은 유지하고 다음 태블릿 조회에서 다시 생성합니다.
  }
}


function monthStart7355033(date: string): string {
  return /^\d{4}-\d{2}/.test(date) ? `${date.slice(0, 7)}-01` : `${safeDate("").slice(0, 7)}-01`;
}
function previousMonthStart7355033(currentStart: string): string {
  const [year, month] = currentStart.slice(0, 7).split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 2, 1, 12));
  return d.toISOString().slice(0, 10);
}
function monthEnd7355033(monthStart: string): string {
  const [year, month] = monthStart.slice(0, 7).split('-').map(Number);
  const d = new Date(Date.UTC(year, month, 0, 12));
  return d.toISOString().slice(0, 10);
}
function calendarDates7355033(start: string, end: string): string[] {
  const out: string[] = [];
  for (let date = start, guard = 0; date <= end && guard < 70; date = dateOffset7355014(date, 1), guard += 1) out.push(date);
  return out;
}
function ledgerMembershipEligible7355033(
  student: DocumentData | undefined,
  studentUid: string,
  item: ClassRow,
  date: string,
  enrollments: EnrollmentRow[],
  historicalOnly = false
): { eligible: boolean; registrationType: string; startDate: string; operationDate: string; entryType: string; entryStartDate: string } {
  const matches = enrollments.filter(row => row.studentUid === studentUid && enrollmentMatchesClass(row, item));
  const historicalMatches = matches.filter(row => enrollmentActiveOnDate(row, date, true));
  const selectedHistorical = historicalMatches.sort((a, b) => text(b.startDate).localeCompare(text(a.startDate)))[0];
  const currentMetadata = currentEnrollmentMetadata7355033(enrollments, studentUid, item);

  if (historicalOnly || date < CANONICAL_CURRENT_ROSTER_CUTOVER_7355015) {
    return {
      eligible: Boolean(selectedHistorical),
      registrationType: selectedHistorical?.registrationType || "existing",
      startDate: selectedHistorical?.startDate || "",
      operationDate: selectedHistorical?.operationDate || "",
      entryType: selectedHistorical?.entryType || "",
      entryStartDate: selectedHistorical?.entryStartDate || ""
    };
  }

  if (student && studentOperational(student) && studentAssignedToClass7355014(student, item)) {
    const currentEntryKind = normalize(currentMetadata?.entryType);
    const dateBoundedEntry = currentEntryKind === "new" || currentEntryKind === "class_move";
    const entryStart = text(currentMetadata?.entryStartDate ?? currentMetadata?.startDate, 20);
    if (dateBoundedEntry && entryStart && entryStart > date) {
      return {
        eligible: false,
        registrationType: currentMetadata?.registrationType || "existing",
        startDate: currentMetadata?.startDate || "",
        operationDate: currentMetadata?.operationDate || "",
        entryType: currentMetadata?.entryType || "",
        entryStartDate: currentMetadata?.entryStartDate || ""
      };
    }
    return {
      eligible: true,
      registrationType: currentMetadata?.registrationType || "existing",
      startDate: currentMetadata?.startDate || "",
      operationDate: currentMetadata?.operationDate || "",
      entryType: currentMetadata?.entryType || "",
      entryStartDate: currentMetadata?.entryStartDate || ""
    };
  }

  const endedEvidence = endedEnrollmentEvidence7355033(enrollments, studentUid, item, date);
  if (student && studentOperational(student) && endedEvidence) {
    return {
      eligible: true,
      registrationType: endedEvidence.registrationType || "existing",
      startDate: endedEvidence.startDate || "",
      operationDate: endedEvidence.operationDate || "",
      entryType: endedEvidence.entryType || "",
      entryStartDate: endedEvidence.entryStartDate || ""
    };
  }
  return { eligible: false, registrationType: "existing", startDate: "", operationDate: "", entryType: "", entryStartDate: "" };
}

function attendanceCellScore73550920(value: unknown): number {
  const cell = object(value); let score = 0;
  const status = text(cell.status ?? cell.attendanceStatus, 60);
  if (status && statusValue(status) !== '미체크') score += 16;
  if (text(cell.specialStatus, 60)) score += 8;
  if (text(cell.memo ?? cell.note ?? cell.remark, 2000)) score += 4;
  if (text(cell.currentStatus, 60)) score += 2;
  if (cell.eligible === true) score += 1;
  return score;
}
function mergeAttendanceCell73550920(left: unknown, right: unknown): PlainObject {
  const a = object(left), b = object(right);
  const at = Number(a.updatedAtMs ?? a.savedAtMs ?? a.modifiedAtMs ?? 0), bt = Number(b.updatedAtMs ?? b.savedAtMs ?? b.modifiedAtMs ?? 0);
  const preferB = bt !== at ? bt > at : attendanceCellScore73550920(b) > attendanceCellScore73550920(a);
  const primary = preferB ? b : a, secondary = preferB ? a : b;
  const merged: PlainObject = { ...secondary, ...primary, eligible: a.eligible === true || b.eligible === true };
  for (const key of ['status','attendanceStatus','specialStatus','specialDisplayScope','registrationType','currentStatus','memo','note','remark']) {
    const p = text(primary[key], 2000), s = text(secondary[key], 2000);
    if (key === 'status' || key === 'attendanceStatus' || key === 'currentStatus') {
      if ((!p || statusValue(p) === '미체크') && s && statusValue(s) !== '미체크') merged[key] = secondary[key];
    } else if (!p && s) merged[key] = secondary[key];
  }
  return merged;
}
function normalizeAttendanceClassGroups73550920(groups: PlainObject[]): PlainObject[] {
  const groupMap = new Map<string, PlainObject>();
  const mergeStudents = (rows: unknown, classId: string): PlainObject[] => {
    const studentMap = new Map<string, PlainObject>();
    (Array.isArray(rows) ? rows : []).forEach((row, studentIndex) => {
      const student: PlainObject = { ...object(row), cells: { ...object(object(row).cells) } };
      const uid = text(student.studentUid, 160); const studentKey = uid ? classId + '|' + uid : classId + '|__NO_UID__' + studentIndex;
      const existing = studentMap.get(studentKey);
      if (!existing) { studentMap.set(studentKey, student); return; }
      if (!text(existing.studentName, 120) && text(student.studentName, 120)) existing.studentName = student.studentName;
      if (!text(existing.attendanceNo, 60) && text(student.attendanceNo, 60)) existing.attendanceNo = student.attendanceNo;
      const cells = object(student.cells); const currentCells = object(existing.cells);
      Object.keys(cells).forEach(date => { currentCells[date] = mergeAttendanceCell73550920(currentCells[date], cells[date]); }); existing.cells = currentCells;
    });
    return Array.from(studentMap.values());
  };
  groups.forEach((raw, groupIndex) => {
    const group = object(raw); const classId = text(group.classId, 180); const key = classId || '__NO_CLASS__' + groupIndex;
    if (!groupMap.has(key)) { groupMap.set(key, { ...group, students: mergeStudents(group.students, classId), sessions: Array.isArray(group.sessions) ? group.sessions.slice() : [], excludedSessions: Array.isArray(group.excludedSessions) ? group.excludedSessions.slice() : [] }); return; }
    const current = groupMap.get(key)!;
    current.students = mergeStudents([...(Array.isArray(current.students) ? current.students : []), ...(Array.isArray(group.students) ? group.students : [])], classId);
    const sessionMap = new Map<string, PlainObject>(); [...(Array.isArray(current.sessions)?current.sessions:[]), ...(Array.isArray(group.sessions)?group.sessions:[])].forEach((row, i) => { const r=object(row), d=text(r.date,20), sk=d||'__'+i; if(!sessionMap.has(sk)) sessionMap.set(sk,r); }); current.sessions = Array.from(sessionMap.values()).sort((a,b)=>text(a.date,20).localeCompare(text(b.date,20)));
    const excludedMap = new Map<string, PlainObject>(); [...(Array.isArray(current.excludedSessions)?current.excludedSessions:[]), ...(Array.isArray(group.excludedSessions)?group.excludedSessions:[])].forEach((row,i)=>{ const r=object(row), sk=(text(r.date,20)+'|'+text(r.changeId,180))||'__'+i; if(!excludedMap.has(sk)) excludedMap.set(sk,r); }); current.excludedSessions = Array.from(excludedMap.values());
  });
  return Array.from(groupMap.values());
}


function attendanceLedgerActionDate73550921(session: PlainObject): string {
  const state = text(session.state, 30), targetDate = text(session.targetDate, 20), slotDate = text(session.date, 20);
  return state === 'moved' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : slotDate;
}

async function buildAttendanceLedger7355033(caller: StaffCaller, input: PlainObject): Promise<PlainObject> {
  const anchorDate = safeDate(input.anchorDate ?? input.date ?? '');
  const currentStart = monthStart7355033(anchorDate);
  const previousStart = previousMonthStart7355033(currentStart);
  const endDate = monthEnd7355033(currentStart);
  const currentParts73550921 = currentStart.split('-').map(Number);
  const movedReadEnd73550921 = new Date(Date.UTC(currentParts73550921[0], currentParts73550921[1] + 1, 0)).toISOString().slice(0, 10);
  const allDates = calendarDates7355033(previousStart, endDate);
  const [catalogRaw, enrollments, studentSnapshot, attendanceSnapshot, overrideSnapshot, changeSnapshot] = await Promise.all([
    loadClassCatalog(anchorDate),
    loadEnrollments(false),
    db().collection('students').limit(MAX_STUDENTS).get(),
    db().collection('attendance').where('sessionDate', '>=', previousStart).where('sessionDate', '<=', movedReadEnd73550921).limit(MAX_LEDGER_ATTENDANCE_7355033).get(),
    db().collection('attendanceSessionOverrides').where('date', '>=', previousStart).where('date', '<=', movedReadEnd73550921).limit(MAX_LEDGER_OVERRIDES_7355033).get(),
    db().collection('classScheduleChanges').limit(MAX_LEDGER_SCHEDULE_CHANGES_7355033).get()
  ]);
  // 73551006R2-ledger-historical-class-alias
  // Previous-month attendance may still carry a retired classId. Normalize only when
  // identity is explicit (known audited alias) or a single strong semantic current-class match exists.
  const currentClassIds73551006 = new Set(catalogRaw.map(item => item.classId));
  const historicalClassAlias73551006 = new Map<string, string>();
  const knownHistoricalAliases73551006: Array<[string, string]> = [
    ["CLS_faef65467612503550977d9c42f1c8fb2fd9d363", "CLS_ec10ae9c767d84593d7375b0c337f8b990429bf6"],
    ["CLS_9a0fac4d72cfd20db0d8d39c811678ca46a81e4f", "CLS_83423794c828d9baae4a8173417227bddb97e4e9"]
  ];
  knownHistoricalAliases73551006.forEach(([sourceClassId, canonicalClassId]) => {
    if (!currentClassIds73551006.has(sourceClassId) && currentClassIds73551006.has(canonicalClassId)) {
      historicalClassAlias73551006.set(sourceClassId, canonicalClassId);
    }
  });
  const inferHistoricalAlias73551006 = (sourceClassId: string, rawInput: DocumentData, evidenceDate = "") => {
    if (!sourceClassId || currentClassIds73551006.has(sourceClassId) || historicalClassAlias73551006.has(sourceClassId)) return;
    const raw = object(rawInput);
    const className = text(raw.className ?? raw.currentClass, 300);
    const instructorName = text(raw.instructorName ?? raw.instructor ?? classTeacherFromName(className), 120);
    const teacherKey = teacherNameKey(instructorName);
    const times = extractTimes(className, raw);
    const startTime = safeTime(raw.startTime ?? times.startTime);
    const endTime = safeTime(raw.endTime ?? times.endTime);
    const weekday = evidenceDate ? weekdayForDate(evidenceDate) : extractWeekday(className, raw);
    if (!className || !teacherKey || !startTime || !endTime || !weekday) return;
    const matches = catalogRaw.filter(item =>
      item.classId !== sourceClassId &&
      normalize(item.className) === normalize(className) &&
      teacherNameKey(item.instructorName) === teacherKey &&
      safeTime(item.startTime) === startTime &&
      safeTime(item.endTime) === endTime &&
      normalize(item.weekday) === normalize(weekday)
    );
    if (matches.length === 1) historicalClassAlias73551006.set(sourceClassId, matches[0].classId);
  };
  attendanceSnapshot.docs.forEach(doc => {
    const data = doc.data() ?? {};
    if (data.active === false) return;
    const date = text(data.sessionDate ?? data.date, 20);
    if (date < previousStart || date >= currentStart) return;
    inferHistoricalAlias73551006(text(data.classId, 180), data, date);
  });
  enrollments.forEach(row => {
    inferHistoricalAlias73551006(row.classId, {
      ...row.raw,
      classId: row.classId,
      className: row.className,
      instructorUid: row.instructorUid,
      instructorName: row.instructorName
    });
  });
  const canonicalLedgerClassId73551006 = (value: unknown): string => {
    const id = text(value, 180);
    return historicalClassAlias73551006.get(id) || id;
  };
  const ledgerEnrollments73551006: EnrollmentRow[] = enrollments.map(row => {
    const canonicalClassId = canonicalLedgerClassId73551006(row.classId);
    if (!canonicalClassId || canonicalClassId === row.classId) return row;
    return {
      ...row,
      classId: canonicalClassId,
      raw: { ...row.raw, classId: canonicalClassId, __ulimHistoricalSourceClassId73551006: row.classId }
    };
  });
  const ledgerAttendanceDocs73551006: Array<{ id: string; data(): DocumentData }> = attendanceSnapshot.docs.map(doc => {
    const data = doc.data() ?? {};
    const sourceClassId = text(data.classId, 180);
    const canonicalClassId = canonicalLedgerClassId73551006(sourceClassId);
    if (!sourceClassId || canonicalClassId === sourceClassId) return doc;
    return {
      id: doc.id,
      data: () => ({ ...data, classId: canonicalClassId, __ulimHistoricalSourceClassId73551006: sourceClassId })
    };
  });
  const historicalCatalog73550978 = historicalClassCatalog73550978(catalogRaw, ledgerEnrollments73551006, ledgerAttendanceDocs73551006, previousStart, currentStart);
  const catalog = [...catalogRaw, ...historicalCatalog73550978].filter(item => classVisibleToCaller(item, caller));
  const students = new Map<string, DocumentData>();
  studentSnapshot.docs.forEach(doc => students.set(doc.id, doc.data() ?? {}));
  const changes: PlainObject[] = changeSnapshot.docs.map<PlainObject>(doc => {
    const raw = object(doc.data() ?? {});
    const sourceClassId = text(raw.classId, 180);
    const canonicalClassId = canonicalLedgerClassId73551006(sourceClassId);
    return {
      changeId: doc.id,
      ...raw,
      classId: canonicalClassId,
      ...(canonicalClassId && sourceClassId && canonicalClassId !== sourceClassId
        ? { __ulimHistoricalSourceClassId73551006: sourceClassId }
        : {})
    };
  }).filter(change => {
    if (change.active === false) return false;
    const originalDate = text(change.originalDate, 20);
    const targetDate = text(change.targetDate, 20);
    return (originalDate >= previousStart && originalDate <= endDate) || (targetDate >= previousStart && targetDate <= endDate);
  });
  const attendanceByKey = new Map<string, { id: string; data: DocumentData }>();
  ledgerAttendanceDocs73551006.forEach(doc => {
    const data = doc.data() ?? {};
    if (data.active === false) return;
    const date = text(data.sessionDate ?? data.date, 20);
    const classId = text(data.classId, 180);
    const studentUid = text(data.studentUid ?? data.studentIdentityKey ?? data.studentKey, 160);
    if (!date || !classId || !studentUid) return;
    const key = `${date}|${classId}|${studentUid}`;
    const current = attendanceByKey.get(key);
    const sourceClassId = text(data.__ulimHistoricalSourceClassId73551006, 180);
    const incomingCanonical = !sourceClassId || sourceClassId === classId;
    const currentSourceClassId = current ? text(current.data.__ulimHistoricalSourceClassId73551006, 180) : "";
    const currentCanonical = current ? (!currentSourceClassId || currentSourceClassId === classId) : false;
    if (
      !current ||
      (incomingCanonical && !currentCanonical) ||
      (incomingCanonical === currentCanonical && updatedAtMs(data) >= updatedAtMs(current.data))
    ) {
      attendanceByKey.set(key, { id: doc.id, data });
    }
  });
  const included = new Map<string, Set<string>>();
  const excluded = new Set<string>();
  overrideSnapshot.docs.forEach(doc => {
    const data = doc.data() ?? {};
    if (data.active === false) return;
    const date = text(data.date, 20), classId = canonicalLedgerClassId73551006(data.classId), studentUid = text(data.studentUid, 160);
    if (!date || !classId || !studentUid) return;
    const key = `${date}|${classId}`;
    if (data.included === true) {
      const set = included.get(key) ?? new Set<string>(); set.add(studentUid); included.set(key, set);
    }
    if (data.excluded === true) excluded.add(`${date}|${classId}|${studentUid}`);
  });
  const registrationFirstSessionCache7355049 = new Map<string, string>();
  const classGroups: PlainObject[] = [];
  for (const item of catalog) {
    const historicalOnlyClass73550978 = object(item.raw).__ulimHistoricalOnly73550978 === true;
    const sessionDates = new Set<string>();
    if (historicalOnlyClass73550978) item.dates.filter(date => date >= previousStart && date < currentStart).forEach(date => sessionDates.add(date));
    else allDates.forEach(date => { if (classScheduledOnDate(item, date)) sessionDates.add(date); });
    changes.filter(change => text(change.classId, 180) === item.classId).forEach(change => {
      const targetDate = text(change.targetDate, 20);
      const originalDate = text(change.originalDate, 20);
      const operation = classScheduleOperation7355033(change);
      if (operation === 'exclude') {
        if (originalDate >= previousStart && originalDate <= endDate) sessionDates.delete(originalDate);
        return;
      }
      if (targetDate >= previousStart && targetDate <= endDate && operation !== 'cancel') sessionDates.add(targetDate);
      if (originalDate >= previousStart && originalDate <= endDate) sessionDates.add(originalDate);
    });
    const sortedDates = Array.from(sessionDates).filter(date => !historicalOnlyClass73550978 || date < currentStart).sort();
    if (!sortedDates.length) continue;
    const sessionMetaAll73550921: PlainObject[] = sortedDates.map(date => {
      const classChanges = changes.filter(change => text(change.classId, 180) === item.classId);
      const originalChange = classChanges.find(change => text(change.originalDate, 20) === date);
      const substituteChange = originalChange && classScheduleOperation7355033(originalChange) === 'substitute' ? originalChange : undefined;
      const targetChange = classChanges.find(change => text(change.targetDate, 20) === date && text(change.originalDate, 20) !== date && !['cancel','exclude'].includes(classScheduleOperation7355033(change)));
      const originalOperation = originalChange ? classScheduleOperation7355033(originalChange) : 'normal';
      const targetOperation = targetChange ? classScheduleOperation7355033(targetChange) : 'normal';
      const operation = substituteChange ? 'substitute' : (originalChange ? originalOperation : targetOperation);
      let state = 'active';
      if (originalChange && originalOperation === 'cancel') state = 'cancelled';
      else if (originalChange && originalOperation === 'move' && text(originalChange.targetDate, 20) !== date) state = 'moved';
      else if (substituteChange) state = 'substitute';
      else if (targetChange && targetOperation === 'move') state = 'moved_in';
      const effectiveChange = substituteChange || targetChange;
      const substituteInstructorUid = substituteChange ? text(substituteChange.instructorUid, 160) : '';
      const substituteInstructorName = substituteChange ? text(substituteChange.instructorName, 120) : '';
      return {
        date, weekday: weekdayForDate(date), state, operation,
        originalDate: text(targetChange?.originalDate ?? originalChange?.originalDate, 20),
        changeId: text((substituteChange || originalChange || targetChange)?.changeId, 180),
        targetDate: text(originalChange?.targetDate, 20),
        reason: text((substituteChange || originalChange || targetChange)?.reason, 1000),
        substituteInstructorUid, substituteInstructorName,
        instructorUid: substituteInstructorUid || text(effectiveChange?.instructorUid, 160) || item.instructorUid,
        instructorName: substituteInstructorName || text(effectiveChange?.instructorName, 120) || item.instructorName,
        startTime: safeTime(effectiveChange?.startTime) || item.startTime,
        endTime: safeTime(effectiveChange?.endTime) || item.endTime
      };
    });
    const sessionMeta = sessionMetaAll73550921.filter(session => {
      if (text(session.state, 30) !== 'moved_in') return true;
      const sourceDate = text(session.originalDate, 20);
      return !sourceDate || sourceDate < previousStart || sourceDate > endDate;
    });
    const studentModels = new Map<string, PlainObject>();
    for (const session of sessionMeta) {
      const date = attendanceLedgerActionDate73550921(session);
      const state = text(session.state, 30);
      const historicalOnly = date < currentStart;
      const eligibleUids = new Set<string>();
      if (state !== 'cancelled') {
        students.forEach((student, studentUid) => {
          const membership = ledgerMembershipEligible7355033(student, studentUid, item, date, ledgerEnrollments73551006, historicalOnly);
          if (membership.eligible) eligibleUids.add(studentUid);
        });
        if (historicalOnly) {
          // Enrollment documents remain valid history evidence even if the current student document was retired.
          ledgerEnrollments73551006.forEach(row => {
            if (row.studentUid && enrollmentMatchesClass(row, item) && enrollmentActiveOnDate(row, date, true)) eligibleUids.add(row.studentUid);
          });
        }
        (included.get(`${date}|${item.classId}`) ?? new Set<string>()).forEach(uid => eligibleUids.add(uid));
        attendanceByKey.forEach((entry, key) => {
          if (!key.startsWith(`${date}|${item.classId}|`)) return;
          const uid = text(entry.data.studentUid ?? entry.data.studentIdentityKey ?? entry.data.studentKey, 160);
          // Date-scoped saved attendance is historical evidence. Current month only accepts explicit special rows outside live roster.
          if (historicalOnly || explicitSpecialAttendance7355014(entry.data)) eligibleUids.add(uid);
        });
      }
      for (const studentUid of eligibleUids) {
        if (!studentUid || excluded.has(`${date}|${item.classId}|${studentUid}`)) continue;
        const attendance = attendanceByKey.get(`${date}|${item.classId}|${studentUid}`);
        const student = students.get(studentUid);
        const isExplicitSpecial = explicitSpecialAttendance7355014(attendance?.data ?? {});
        // Current-month rows must obey the same existence/status gates as the normal attendance
        // roster. Historical month intentionally keeps retired student identity through saved data.
        if (!historicalOnly) {
          if (!student && !isExplicitSpecial) continue;
          if (student && !studentOperational(student)) continue;
        }
        const effectiveStudent = historicalOnly
          ? effectiveHistoricalStudentData7355033(student, attendance?.data)
          : effectiveStudentData7355014(student, attendance?.data);
        const membership = ledgerMembershipEligible7355033(student, studentUid, item, date, ledgerEnrollments73551006, historicalOnly);
        const attendanceData = attendance?.data ?? {};
        const specialStatus = canonicalSessionSpecialStatus7355049(
          membership, item, date, attendanceData, changes, registrationFirstSessionCache7355049
        );
        const specialDisplayScope = specialDisplayScope7355033(specialStatus, date);
        const outputRegistrationType = canonicalOutputRegistrationType7355049(membership, attendanceData);
        let model = studentModels.get(studentUid);
        if (!model) {
          model = {
            studentUid,
            studentName: text(effectiveStudent.name ?? effectiveStudent.studentName, 120),
            attendanceNo: text(effectiveStudent.attendanceNo ?? effectiveStudent.loginId ?? effectiveStudent.studentNo, 60),
            cells: {}
          };
          studentModels.set(studentUid, model);
        }
        const cells = model.cells as PlainObject;
        cells[date] = {
          attendanceEntryType: specialStatus === "신규" ? "new" : (specialStatus === "반이동" ? "class_move" : (specialStatus === "보강" ? "makeup" : (specialStatus === "일일특강" ? "daily_special" : ""))),
          entryStartDate: (specialStatus === "신규" || specialStatus === "반이동")
            ? membership.entryStartDate
            : (specialStatus ? text(attendance?.data.entryStartDate ?? date, 20) : ""),
          entryTypeSource: (specialStatus === "신규" || specialStatus === "반이동")
            ? text(membership.entryType ? "enrollment_explicit_authority" : "", 100)
            : (specialStatus ? text(attendance?.data.entryTypeSource ?? attendance?.data.nameSpecialSource, 100) : ""),
          attendanceRecordSource: text(attendance?.data.source, 100),
          // __ULIM_ATTENDANCE_NAME_MARKER_73550998__
          nameSpecialStatus: specialDisplayScope === "name" ? specialStatus : "",
          nameSpecialStartDate: specialDisplayScope === "name" ? membership.entryStartDate : "",
          // __ULIM_CLASS_MOVE_NAME_METADATA_73550973__
          membershipRegistrationType: membership.registrationType || 'existing',
          membershipStartDate: membership.startDate || '',
          eligible: true,
          recordId: attendance?.id || canonicalAttendanceRecordId73550993(date, item.classId, studentUid),
          status: statusValue(attendance?.data.status ?? attendance?.data.attendanceStatus),
          attendanceStatus: statusValue(attendance?.data.status ?? attendance?.data.attendanceStatus),
          specialStatus,
          specialDisplayScope,
          currentStatus: text(attendance?.data.currentStatus, 100),
          memo: text(attendance?.data.memo, 2000),
          registrationType: outputRegistrationType
        };
      }
    }
    // Cancelled dates stay disabled. Moved slots read/write the target-date cell and remain checkable.
    const studentsOut = Array.from(studentModels.values()).sort((a, b) => text(a.studentName, 120).localeCompare(text(b.studentName, 120), 'ko'));
    studentsOut.forEach(model => {
      const cells = model.cells as PlainObject;
      sessionMeta.forEach(session => {
        const date = attendanceLedgerActionDate73550921(session);
        if (!cells[date]) cells[date] = { eligible: false, status: '미체크', attendanceStatus: '미체크', specialStatus: '', currentStatus: '', memo: '' };
      });
    });
    const excludedSessions = changes
      .filter(change => text(change.classId, 180) === item.classId && classScheduleOperation7355033(change) === 'exclude')
      .map(change => ({ date: text(change.originalDate, 20), changeId: text(change.changeId, 180), reason: text(change.reason, 1000) }))
      .filter(row => row.date >= previousStart && row.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
    classGroups.push({
      classId: item.classId, className: item.className, instructorUid: item.instructorUid, instructorName: item.instructorName,
      startTime: item.startTime, endTime: item.endTime, weekday: item.weekday,
      sessions: sessionMeta, excludedSessions, students: studentsOut, count: studentsOut.length
    });
  }
  const normalizedClassGroups73550920 = normalizeAttendanceClassGroups73550920(classGroups);
  normalizedClassGroups73550920.sort((a, b) => weekdaySortValue7355033(a.weekday) - weekdaySortValue7355033(b.weekday) || timeSortValue7355033(a.startTime) - timeSortValue7355033(b.startTime) || text(a.instructorName, 120).localeCompare(text(b.instructorName, 120), 'ko') || text(a.className, 300).localeCompare(text(b.className, 300), 'ko'));
  return {
    status: 'success', source: 'firestore_attendance_ledger_7355033', anchorDate,
    previousMonth: previousStart.slice(0, 7), currentMonth: currentStart.slice(0, 7), startDate: previousStart, endDate,
    previousMonthRosterAuthority: 'historical_enrollment_saved_attendance_canonical_class_alias_73551006',
    currentMonthRosterAuthority: 'canonical_students_current_assignment_plus_session_exceptions_7355033r13',
    historicalClassAliases73551006: Array.from(historicalClassAlias73551006.entries()).map(([sourceClassId, canonicalClassId]) => ({ sourceClassId, canonicalClassId })),
    groups: normalizedClassGroups73550920,
    teachers: unique(normalizedClassGroups73550920.map(group => text(group.instructorName, 120)), 120),
    count: normalizedClassGroups73550920.reduce((sum, group) => sum + Number(group.count || 0), 0),
    version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  };
}

export const getAttendanceRosterAdmin73550 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: "1GiB" }, async request => {
  const caller = await requireStaff(request);
  const input = object(request.data);
  if (input.ledger === true || normalize(input.view) === 'ledger') return buildAttendanceLedger7355033(caller, input);
  const built = await buildAttendanceRosterInternal7355014(caller, input);
  const keyword = normalize(input.keyword);
  const statusFilter = statusValue(input.statusFilter);
  let rows = built.rows;
  if (keyword) rows = rows.filter(row => normalize([row.studentName, row.attendanceNo, row.studentPhone, row.parentPhone].join(" ")).includes(keyword));
  if (text(input.statusFilter, 30)) rows = rows.filter(row => statusValue(row.status) === statusFilter || statusValue(row.specialStatus) === statusFilter);
  const groupMap = new Map<string, PlainObject>();
  built.groups.forEach(group => groupMap.set(text(group.classId, 180), { ...group, rows: [] }));
  rows.forEach(row => {
    const group = groupMap.get(text(row.classId, 180));
    if (group) (group.rows as PlainObject[]).push(row);
  });
  const groups = Array.from(groupMap.values()).map(group => ({ ...group, count: (group.rows as PlainObject[]).length })).filter(group => Number(group.count) > 0 || !built.allClasses);
  return {
    status: "success",
    date: built.date,
    records: rows,
    rows,
    groups,
    count: rows.length,
    selectedClass: built.selectedClass,
    movedAway: built.movedAway ?? null,
    diagnostics: built.diagnostics,
    source: "firestore_canonical_roster_7355049",
    message: `${rows.length}명`,
    version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  };
});

export const saveAttendanceRowsAdmin73550 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: "512MiB" }, async request => {
  const caller = await requireStaff(request);
  const input = object(request.data);
  const rows = Array.isArray(input.rows) ? input.rows.map(object) : [];
  if (!rows.length || rows.length > 300) throw new HttpsError("invalid-argument", "저장할 출석기록 수가 올바르지 않습니다.");
  const now = Date.now();
  const batch = db().batch();
  const saved: PlainObject[] = [];
  const catalog = await loadClassCatalog();
  const catalogById = new Map(catalog.map(item => [item.classId, item]));
  for (const row of rows) {
    const date = requireDate(row.date ?? row.sessionDate, "수업일");
    const classId = text(row.classId, 180);
    const studentUid = text(row.studentUid, 160);
    if (!classId || !studentUid) throw new HttpsError("invalid-argument", "반 또는 학생 식별값이 없습니다.");
    const item = catalogById.get(classId);
    if (!item || !classVisibleToCaller(item, caller)) throw new HttpsError("permission-denied", "이 수업의 출석을 수정할 권한이 없습니다.");
    const recordId = canonicalAttendanceRecordId73550993(date, classId, studentUid);
    const ref = db().collection("attendance").doc(recordId);
    const status = statusValue(row.status ?? row.attendanceStatus);
    batch.set(ref, {
      recordId,
      sessionId: `${date}|${classId}`,
      sessionDate: date,
      date,
      classId,
      className: item.className,
      instructorUid: item.instructorUid,
      instructorName: item.instructorName,
      instructor: item.instructorName,
      studentUid,
      studentIdentityKey: studentUid,
      studentName: text(row.studentName ?? row.name, 120),
      name: text(row.studentName ?? row.name, 120),
      attendanceNo: text(row.attendanceNo ?? row.studentNo, 60),
      studentNo: text(row.attendanceNo ?? row.studentNo, 60),
      studentPhone: text(row.studentPhone, 60),
      parentPhone: text(row.parentPhone, 60),
      status,
      attendanceStatus: status,
      currentStatus: text(row.currentStatus, 100),
      specialStatus: canonicalSpecialStatus7355034(row.specialStatus),
      memo: text(row.memo, 2000),
      active: true,
      source: "attendance_firestore_primary_73550",
      sheetBackupState: "pending_0600",
      updatedByFirebaseUid: caller.firebaseUid,
      updatedByRole: caller.role,
      updatedByName: caller.displayName,
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
    }, { merge: true });
    saved.push({
      recordId,
      studentUid,
      classId,
      className: item.className,
      date,
      status,
      attendanceStatus: status,
      currentStatus: text(row.currentStatus, 100),
      specialStatus: canonicalSpecialStatus7355034(row.specialStatus),
      memo: text(row.memo, 2000)
    });
  }
  await batch.commit();
  await touchAttendanceRevision("attendance_save", { count: saved.length, actorUid: caller.firebaseUid });
  await refreshTodayTabletSnapshot("attendance_save");
  return { status: "success", count: saved.length, rows: saved, message: `출석 ${saved.length}건 저장 완료`, version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

export const listAttendanceStudentCandidatesAdmin73550 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 60, memory: "512MiB" }, async request => {
  const caller = await requireStaff(request);
  const input = object(request.data);
  const built = await buildAttendanceRosterInternal7355014(caller, input);
  const current = new Set(built.rows.map(row => text(row.studentUid, 160)));
  const keyword = normalize(input.keyword);
  const snapshot = await db().collection("students").limit(MAX_STUDENTS).get();
  const students = snapshot.docs.map(doc => {
    const data = doc.data() ?? {};
    return {
      studentUid: doc.id,
      studentName: text(data.name ?? data.studentName, 120),
      attendanceNo: text(data.attendanceNo ?? data.loginId ?? data.studentNo, 60),
      studentPhone: text(data.studentPhone ?? data.phone, 60),
      parentPhone: text(data.parentPhone, 60),
      enrollmentStatus: text(data.enrollmentStatus ?? data.status, 40)
    };
  }).filter(row => !current.has(row.studentUid) && !["leave", "휴원", "hold", "withdrawn", "cancelled", "퇴원"].includes(row.enrollmentStatus))
    .filter(row => !keyword || normalize([row.studentName, row.attendanceNo, row.studentPhone].join(" ")).includes(keyword))
    .sort((a, b) => a.studentName.localeCompare(b.studentName, "ko"));
  return { status: "success", students: students.slice(0, 500), count: students.length, version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

export const addAttendanceSessionStudentsAdmin73550 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  const input = object(request.data);
  const date = requireDate(input.date, "수업일");
  const classId = text(input.classId, 180);
  const studentUids = unique(Array.isArray(input.studentUids) ? input.studentUids : [], 160);
  const attendanceEntryType73550978 = normalize(text(input.attendanceEntryType, 40));
  const entryStartDate73550978 = text(input.entryStartDate, 20);
  const entryTypeSource73550978 = text(input.entryTypeSource, 100) || "attendance_add_ui_73550978";
  const entryName73550978 = attendanceEntryType73550978 === "new" ? "신규" : (attendanceEntryType73550978 === "class_move" ? "반이동" : "");
  // __ULIM_ATTENDANCE_NAME_MARKER_73550974__
  const lifecycleTypeRaw73550974 = text(input.lifecycleType, 40);
  const lifecycleTypeKey73550974 = normalize(lifecycleTypeRaw73550974);
  const lifecycleStartDate73550974 = text(input.lifecycleStartDate, 20);
  const lifecycleNameSpecial73550974 = lifecycleTypeKey73550974 === normalize("class_move") ? "반이동" : (lifecycleTypeKey73550974 === normalize("new") ? "신규" : "");
  if (!classId || !studentUids.length) throw new HttpsError("invalid-argument", "반과 추가할 학생을 선택해주세요.");
  if (studentUids.length > 400) throw new HttpsError("invalid-argument", "한 번에 추가할 수 있는 학생은 400명까지입니다.");
  const item = (await loadClassCatalog()).find(cls => cls.classId === classId);
  if (!item || !classVisibleToCaller(item, caller)) throw new HttpsError("permission-denied", "이 수업을 수정할 권한이 없습니다.");
  const batch = db().batch();
  studentUids.forEach(studentUid => {
    if (entryName73550978 && entryStartDate73550978 === date) {
  const recordId73550978 = canonicalAttendanceRecordId73550993(date, classId, studentUid);
  batch.set(db().collection("attendance").doc(recordId73550978), {
    recordId: recordId73550978, sessionId: `${date}|${classId}`, sessionDate: date, date,
    classId, className: item.className, instructorUid: item.instructorUid, instructorName: item.instructorName, instructor: item.instructorName,
    studentUid, studentIdentityKey: studentUid,
    status: "미체크", attendanceStatus: "미체크", active: true,
    specialStatus: entryName73550978, nameSpecialStatus: entryName73550978, nameSpecialType: attendanceEntryType73550978,
    nameSpecialStartDate: entryStartDate73550978, nameSpecialMonth: date.slice(0, 7), nameSpecialSource: entryTypeSource73550978,
    attendanceEntryType: attendanceEntryType73550978, entryStartDate: entryStartDate73550978, entryTypeSource: entryTypeSource73550978,
    source: "attendance_explicit_entry_73550978", sourceOfTruth: "firestore_operational", sheetBackupState: "pending_0600",
    updatedByFirebaseUid: caller.firebaseUid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(),
    version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  }, { merge: true });
}
    const id = hashId("AOVR", date, classId, studentUid);
    batch.set(db().collection("attendanceSessionOverrides").doc(id), {
      overrideId: id, date, sessionDate: date, sessionKey: sessionKey(date, classId), classId, className: item.className,
      studentUid, included: true, excluded: false, active: true, source: "attendance_manual_add_73550",
      updatedByFirebaseUid: caller.firebaseUid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
    }, { merge: true });
  });
  await batch.commit();
  let normalizedRegularMembership = 0;
  if (input.normalizeRegularMembership === true) {
    const attendanceRefs = studentUids.map(studentUid => db().collection("attendance").doc(canonicalAttendanceRecordId73550993(date, classId, studentUid)));
    const attendanceSnapshots = attendanceRefs.length ? await db().getAll(...attendanceRefs) : [];
    const normalizeBatch = db().batch();
    attendanceSnapshots.forEach(snapshot => {
      if (!snapshot.exists) return;
      const data = snapshot.data() ?? {};
      const staleKinds7355035 = [data.specialStatus, data.specialType, data.registrationType, data.kind].map(value => normalize(value)).filter(Boolean);
      const staleTemporary7355035 = data.temporaryEnrollment === true || data.temporaryStudent === true || staleKinds7355035.some(kind => kind === 'makeup' || kind === normalize('보강') || kind === 'daily_special' || kind === normalize('일일특강'));
      if (!staleTemporary7355035) return;
      normalizeBatch.set(snapshot.ref, {
        specialStatus: FieldValue.delete(), specialType: FieldValue.delete(), registrationType: FieldValue.delete(), kind: FieldValue.delete(),
        temporaryEnrollment: false, temporaryStudent: false,
        regularizedMembership: true, regularizedAtMs: Date.now(), regularizedAt: FieldValue.serverTimestamp(),
        source: "attendance_regular_membership_normalize_7355035", version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
      }, { merge: true });
      normalizedRegularMembership += 1;
    });
    if (normalizedRegularMembership) await normalizeBatch.commit();
  }
  await touchAttendanceRevision("attendance_student_add", { date, classId, count: studentUids.length, normalizedRegularMembership });
  if (date === safeDate("")) await refreshTodayTabletSnapshot("attendance_student_add");
  return { status: "success", count: studentUids.length, normalizedRegularMembership, message: `${studentUids.length}명 추가 완료`, version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});


async function resolveAttendanceClassForHistoricalEdit73550979(caller: StaffCaller, date: string, classId: string): Promise<ClassRow> {
  const catalog = await loadClassCatalog(date);
  const live = catalog.find(item => item.classId === classId);
  if (live) {
    if (!classVisibleToCaller(live, caller)) throw new HttpsError("permission-denied", "이 수업을 수정할 권한이 없습니다.");
    return live;
  }
  if (!FULL_ADMIN_ROLES.has(caller.role)) throw new HttpsError("permission-denied", "이 수업을 수정할 권한이 없습니다.");
  const attendanceSnapshot = await db().collection("attendance").where("sessionDate", "==", date).limit(MAX_ATTENDANCE).get();
  const attendanceDoc = attendanceSnapshot.docs.find(doc => text(doc.data()?.classId, 180) === classId);
  if (attendanceDoc) {
    const data = attendanceDoc.data() ?? {};
    const recovered = classRowFromData7355014({ ...data, active: true, status: "historical" }, classId, date);
    if (recovered) return recovered;
  }
  const enrollmentSnapshot = await db().collection("studentEnrollments").where("classId", "==", classId).limit(50).get();
  const enrollmentDoc = enrollmentSnapshot.docs[0];
  if (enrollmentDoc) {
    const data = enrollmentDoc.data() ?? {};
    const recovered = classRowFromData7355014({ ...data, active: true, status: "historical" }, classId, date);
    if (recovered) return recovered;
  }
  throw new HttpsError("failed-precondition", "전월 수업의 저장 이력을 찾지 못했습니다. 데이터를 변경하지 않았습니다.");
}
export const removeAttendanceSessionStudentsAdmin73550 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  const input = object(request.data);
  const date = requireDate(input.date, "수업일");
  const classId = text(input.classId, 180);
  const studentUids = unique(Array.isArray(input.studentUids) ? input.studentUids : [], 160);
  if (!classId || !studentUids.length) throw new HttpsError("invalid-argument", "삭제할 학생을 선택해주세요.");
  if (studentUids.length > 400) throw new HttpsError("invalid-argument", "한 번에 삭제할 수 있는 학생은 400명까지입니다.");
  const item = await resolveAttendanceClassForHistoricalEdit73550979(caller, date, classId);
  const batch = db().batch();
  studentUids.forEach(studentUid => {
    const id = hashId("AOVR", date, classId, studentUid);
    batch.set(db().collection("attendanceSessionOverrides").doc(id), {
      overrideId: id, date, sessionDate: date, sessionKey: sessionKey(date, classId), classId, className: item.className,
      studentUid, included: false, excluded: true, active: true, source: "attendance_manual_remove_73550",
      updatedByFirebaseUid: caller.firebaseUid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
    }, { merge: true });
  });
  await batch.commit();
  await touchAttendanceRevision("attendance_student_remove", { date, classId, count: studentUids.length });
  if (date === safeDate("")) await refreshTodayTabletSnapshot("attendance_student_remove");
  return { status: "success", count: studentUids.length, message: `${studentUids.length}명 출석부에서 제외 완료`, version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});


export const addTemporaryAttendanceAdmin7355014 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  requireFullAdmin(caller);
  const input = object(request.data);
  const date = requireDate(input.date, "수업일");
  const classId = text(input.classId, 180);
  const requestedClassName = text(input.className, 300);
  const kindRaw = normalize(input.kind ?? input.registrationType);
  const kind = kindRaw === 'daily_special' || kindRaw === normalize('일일특강') ? 'daily_special'
    : (kindRaw === 'new' || kindRaw === normalize('신규') ? 'new'
      : (kindRaw === 'class_move' || kindRaw === normalize('반이동') ? 'class_move' : 'makeup'));
  const catalog = await loadClassCatalog(date);
  let item = classId ? catalog.find(row => row.classId === classId) : undefined;
  if (!item && requestedClassName) {
    const matches = catalog.filter(row => normalize(row.className) === normalize(requestedClassName));
    if (matches.length === 1) item = matches[0];
  }
  if (!item) throw new HttpsError("failed-precondition", "선택한 반을 현재 Firestore 반 목록에서 찾지 못했습니다.");
  if (!classVisibleToCaller(item, caller)) throw new HttpsError("permission-denied", "이 수업을 수정할 권한이 없습니다.");

  const requestedStudentUid = text(input.studentUid, 160);
  let student: DocumentData = {};
  if (requestedStudentUid) {
    const snap = await db().collection("students").doc(requestedStudentUid).get();
    if (!snap.exists) throw new HttpsError("not-found", "선택한 학생정보를 찾지 못했습니다.");
    student = snap.data() ?? {};
    if (!studentOperational(student)) throw new HttpsError("failed-precondition", "휴원·퇴원 상태의 학생은 출석부에 추가할 수 없습니다.");
  }
  const studentName = text(student.name ?? student.studentName ?? input.studentName ?? input.name, 120);
  if (!studentName) throw new HttpsError("invalid-argument", "학생을 선택하거나 학생명을 입력해주세요.");
  const studentUid = requestedStudentUid || `TMPATT_${createHash("sha256").update(`${date}|${item.classId}|${normalize(studentName)}|${kind}`, "utf8").digest("hex").slice(0, 32)}`;
  const recordId = canonicalAttendanceRecordId73550993(date, item.classId, studentUid);
  const ref = db().collection("attendance").doc(recordId);
  const now = Date.now();
  await ref.set({
    sessionId: `${date}|${item.classId}`,
    sessionDate: date,
    date,
    classId: item.classId,
    className: item.className,
    teacherUid: item.instructorUid,
    instructorUid: item.instructorUid,
    teacherScopeKey: item.teacherScopeKey,
    instructor: item.instructorName,
    instructorName: item.instructorName,
    studentUid,
    studentIdentityKey: studentUid,
    studentKey: studentUid,
    studentName,
    name: studentName,
    studentNo: text(student.attendanceNo ?? student.loginId ?? student.studentNo, 60),
    attendanceNo: text(student.attendanceNo ?? student.loginId ?? student.studentNo, 60),
    studentPhone: text(student.studentPhone ?? student.phone, 60),
    parentPhone: text(student.parentPhone, 60),
    status: "미체크",
    attendanceStatus: "미체크",
    specialStatus: kind === 'daily_special' ? '일일특강' : (kind === 'new' ? '신규' : (kind === 'class_move' ? '반이동' : '보강')),
    registrationType: kind,
    attendanceEntryType: kind,
    entryStartDate: date,
    entryTypeSource: "attendance_add_ui_73550978",
    nameSpecialStatus: kind === 'new' ? '신규' : (kind === 'class_move' ? '반이동' : (kind === 'makeup' ? '보강' : (kind === 'daily_special' ? '일일특강' : ''))),
    temporaryStudent: !requestedStudentUid,
    temporaryEnrollment: true,
    active: true,
    source: "attendance_explicit_session_7355014",
    sourceOfTruth: "firestore_operational",
    sheetSyncState: "backup_0600",
    updatedByFirebaseUid: caller.firebaseUid,
    updatedByRole: caller.role,
    updatedByName: caller.displayName,
    updatedAtMs: now,
    updatedAt: FieldValue.serverTimestamp(),
    createdAtMs: now,
    createdAt: FieldValue.serverTimestamp(),
    version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  }, { merge: true });
  // 이전 제외 override가 있었다면 이 명시적 추가가 다시 보이도록 포함 상태로 복구합니다.
  const overrideId = hashId("AOVR", date, item.classId, studentUid);
  await db().collection("attendanceSessionOverrides").doc(overrideId).set({
    overrideId,
    date,
    sessionDate: date,
    sessionKey: sessionKey(date, item.classId),
    classId: item.classId,
    className: item.className,
    studentUid,
    included: true,
    excluded: false,
    active: true,
    registrationType: kind,
    attendanceEntryType: kind,
    entryStartDate: date,
    entryTypeSource: "attendance_add_ui_73550978",
    source: "attendance_explicit_session_7355014",
    updatedByFirebaseUid: caller.firebaseUid,
    updatedAtMs: now,
    updatedAt: FieldValue.serverTimestamp(),
    version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  }, { merge: true });
  await touchAttendanceRevision("attendance_explicit_session_add_7355014", { date, classId: item.classId, studentUid, kind });
  if (date === safeDate("")) await refreshTodayTabletSnapshot("attendance_explicit_session_add_7355014");
  return { status: "success", ok: true, attendanceRecordId: recordId, recordId, date, classId: item.classId, className: item.className, studentUid, studentName, kind, version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

export const removeAttendanceStudentAdmin7355014 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  requireFullAdmin(caller);
  const input = object(request.data);
  const date = requireDate(input.date, "수업일");
  const classId = text(input.classId, 180);
  const studentUid = text(input.studentUid ?? input.studentIdentityKey ?? input.studentKey, 160);
  if (!classId || !studentUid) throw new HttpsError("invalid-argument", "삭제할 반과 학생정보가 필요합니다.");
  const item = await resolveAttendanceClassForHistoricalEdit73550979(caller, date, classId);
  const overrideId = hashId("AOVR", date, classId, studentUid);
  await db().collection("attendanceSessionOverrides").doc(overrideId).set({
    overrideId,
    date,
    sessionDate: date,
    sessionKey: sessionKey(date, classId),
    classId,
    className: item.className,
    studentUid,
    included: false,
    excluded: true,
    active: true,
    source: "attendance_manual_remove_7355014",
    updatedByFirebaseUid: caller.firebaseUid,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
    version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  }, { merge: true });
  await touchAttendanceRevision("attendance_student_remove_7355014", { date, classId, studentUid });
  if (date === safeDate("")) await refreshTodayTabletSnapshot("attendance_student_remove_7355014");
  return { status: "success", ok: true, count: 1, date, classId, studentUid, message: "현재 수업일 출석부에서 학생을 제외했습니다.", version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

export const getOperationalStudentDetailAdmin73550 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  const input = object(request.data);
  const studentUid = text(input.studentUid, 160);
  if (!studentUid) throw new HttpsError("invalid-argument", "학생을 선택해주세요.");
  const [studentSnap, enrollmentSnap] = await Promise.all([
    db().collection("students").doc(studentUid).get(),
    db().collection("studentEnrollments").where("studentUid", "==", studentUid).limit(500).get()
  ]);
  if (!studentSnap.exists) throw new HttpsError("not-found", "학생정보를 찾지 못했습니다.");
  const enrollments = enrollmentSnap.docs.map(doc => ({ enrollmentId: doc.id, ...doc.data() })).filter(row => object(row).active !== false && text(object(row).status, 40) !== "ended");
  if (caller.role === "teacher") {
    const catalog = await loadClassCatalog();
    const allowed = enrollments.some(row => {
      const classId = text(object(row).classId, 180);
      const item = catalog.find(cls => cls.classId === classId);
      return item ? classVisibleToCaller(item, caller) : false;
    });
    if (!allowed) throw new HttpsError("permission-denied", "담당 학생만 확인할 수 있습니다.");
  }
  return { status: "success", studentUid, student: { studentUid, ...studentSnap.data() }, enrollments, version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

interface OperationalSolapiConfig {
  apiKey: string;
  apiSecret: string;
  sender: string;
  pfId: string;
  disableSms: boolean;
  tabletTargets: string[];
  templates: Record<string, string>;
}
function parseOperationalSolapiConfig(): OperationalSolapiConfig {
  const raw = ULIM_SOLAPI_OPERATIONAL_CONFIG.value() || process.env.ULIM_SOLAPI_OPERATIONAL_CONFIG || "";
  if (!raw) throw new Error("SOLAPI_OPERATIONAL_CONFIG_MISSING");
  let data: PlainObject;
  try { data = object(JSON.parse(raw)); } catch { throw new Error("SOLAPI_OPERATIONAL_CONFIG_INVALID_JSON"); }
  const templatesRaw = object(data.templates);
  const templates: Record<string, string> = {};
  Object.entries(templatesRaw).forEach(([key, value]) => { const id = text(value, 200); if (id) templates[key] = id; });
  ["attendance", "absence", "notice", "classCancel", "classChange", "classSubstitute", "dailyEvaluation", "roomConfirm", "roomUnavailable", "roomChange", "payment", "specialTeacher", "specialMakeupStudent", "specialNewMoveStudent", "checkin", "checkout"].forEach(key => {
    const direct = text(data[`${key}TemplateId`], 200);
    if (direct && !templates[key]) templates[key] = direct;
  });
  // 7.35.5.0.5: one SOLAPI credential pair is shared; each message purpose uses its own approved template ID.
  // Legacy room/special keys remain fallback-only so old local JSON does not break immediately.
  const legacyRoom = text(
    templatesRaw.room ??
    data.roomTemplateId ??
    data.practiceRoomTemplateId ??
    data.roomReservationTemplateId,
    200
  );
  const legacySpecial = text(templatesRaw.special, 200);
  // 7.35.5.0.37: older secret JSON used a single top-level roomTemplateId; accept it as the room fallback.
  if (legacyRoom) {
    if (!templates.roomConfirm) templates.roomConfirm = legacyRoom;
    if (!templates.roomUnavailable) templates.roomUnavailable = legacyRoom;
    if (!templates.roomChange) templates.roomChange = legacyRoom;
  }
  if (legacySpecial) {
    if (!templates.specialTeacher) templates.specialTeacher = legacySpecial;
    if (!templates.specialMakeupStudent) templates.specialMakeupStudent = legacySpecial;
    if (!templates.specialNewMoveStudent) templates.specialNewMoveStudent = legacySpecial;
  }
  const tabletTargets = unique(Array.isArray(data.tabletTargets) ? data.tabletTargets : ["parent"], 20)
    .map(target => target === "학부모" ? "parent" : target === "학생" ? "student" : target)
    .filter(target => target === "student" || target === "parent");
  const config = {
    apiKey: text(data.apiKey, 200), apiSecret: text(data.apiSecret, 300), sender: normalizePhone(data.sender),
    pfId: text(data.pfId, 200), disableSms: data.disableSms !== false, tabletTargets: tabletTargets.length ? tabletTargets : ["parent"], templates
  };
  if (!config.apiKey || !config.apiSecret || !config.sender || !config.pfId) throw new Error("SOLAPI_OPERATIONAL_CONFIG_INCOMPLETE");
  return config;
}
function messageTemplateKey(type: string): string {
  const map: Record<string, string> = {
    attendance: "attendance", absence: "absence", notice: "notice",
    class_cancel: "classCancel", classCancel: "classCancel",
    class_change: "classChange", classChange: "classChange",
    class_substitute: "classSubstitute", classSubstitute: "classSubstitute",
    daily_evaluation: "dailyEvaluation", payment: "payment", checkin: "checkin", checkout: "checkout",
    room_confirm: "roomConfirm", roomConfirm: "roomConfirm",
    room_unavailable: "roomUnavailable", roomUnavailable: "roomUnavailable",
    room_change: "roomChange", roomChange: "roomChange",
    special_teacher: "specialTeacher", specialTeacher: "specialTeacher",
    special_makeup_student: "specialMakeupStudent", specialMakeupStudent: "specialMakeupStudent",
    special_new_move_student: "specialNewMoveStudent", specialNewMoveStudent: "specialNewMoveStudent"
  };
  return map[type] || type;
}
function defaultMessageText(type: string, variables: PlainObject): string {
  const studentName = text(variables.studentName ?? variables["학생명"] ?? variables["#{학생명}"], 120) || "학생";
  const value = (...keys: string[]): string => {
    for (const key of keys) {
      const found = text(variables[key] ?? variables[`#{${key}}`], 1200);
      if (found) return found;
    }
    return "";
  };
  if (type === "class_cancel" || type === "classCancel") {
    return `안녕하세요. 울림연기학원입니다.
${value("수업명", "className")} 수업 휴강 안내드립니다.

수업명: ${value("수업명", "className")}
수업일: ${value("수업일", "date")} ${value("요일", "weekday")}
수업시간: ${value("수업시간", "time")}
휴강사유: ${value("휴강사유", "변경사유", "reason") || "학원 일정 조정"}

문의: 010-3273-5829`;
  }
  if (type === "class_substitute" || type === "classSubstitute") {
    return `안녕하세요. 울림연기학원입니다.
${value("수업명", "className")} 수업은 ${value("기존담당강사", "originalInstructorName")} 강사님의 사정으로 ${value("변경담당강사", "targetInstructorName", "instructorName")} 강사님이 대신 진행하게 되어 안내드립니다.

수업명: ${value("수업명", "className")}
수업일: ${value("수업일", "date")} ${value("요일", "weekday")}
수업시간: ${value("수업시간", "time")}
기존강사: ${value("기존담당강사", "originalInstructorName")}
대강강사: ${value("변경담당강사", "targetInstructorName", "instructorName")}
변경사유: ${value("변경사유", "reason")}

문의: 010-3273-5829`;
  }
  if (type === "class_change" || type === "classChange") {
    return `안녕하세요, 울림연기학원입니다.\n\n${studentName} 학생의 수업 일정이 변경되었습니다.\n\n기존 수업\n수업일: ${value("기존수업일", "originalDate")} (${value("기존요일", "originalWeekday")})\n수업시간: ${value("기존수업시간", "originalTime")}\n담당강사: ${value("기존담당강사", "originalInstructorName")}\n\n변경된 수업\n변경일: ${value("변경수업일", "targetDate")} (${value("변경요일", "targetWeekday", "weekday")})\n변경시간: ${value("변경수업시간", "targetTime")}\n담당강사: ${value("변경담당강사", "targetInstructorName", "instructorName")}\n\n수업명: ${value("수업명", "className")}\n변경사유: ${value("변경사유", "reason") || "학원 일정 조정"}\n\n변경된 일정으로 참석해 주세요.\n\n울림연기학원\n문의전화 : 010-3273-5829`;
  }
  if (type === "room_confirm") return `안녕하세요, 울림연기학원입니다.\n\n${studentName} 학생의 연습실 예약이 확인되었습니다.\n예약일: ${value("예약일", "date")}\n예약시간: ${value("예약시간", "time")}\n연습실: ${value("연습실", "roomName")}\n현관 비밀번호: ${value("현관비밀번호", "doorPassword")}\n\n울림연기학원`;
  if (type === "room_unavailable") return `안녕하세요, 울림연기학원입니다.\n\n${studentName} 학생의 연습실 예약 이용이 어렵습니다.\n예약일: ${value("예약일", "date")}\n예약시간: ${value("예약시간", "time")}\n연습실: ${value("연습실", "roomName")}\n사용불가 사유: ${value("사용불가사유", "reason")}\n\n울림연기학원`;
  if (type === "room_change") return `안녕하세요, 울림연기학원입니다.\n\n${studentName} 학생의 연습실 예약 정보가 변경되었습니다.\n\n기존 예약\n예약일: ${value("예약일", "date")}\n예약시간: ${value("예약시간", "time")}\n연습실: ${value("연습실", "roomName")}\n\n변경된 예약\n변경일: ${value("변경일", "newDate")}\n변경시간: ${value("변경시간", "newTime")}\n변경 연습실: ${value("변경연습실", "newRoom")}\n현관 비밀번호: ${value("현관비밀번호", "doorPassword")}\n\n울림연기학원`;
  if (type === "special_teacher") return `안녕하세요, 울림연기학원입니다.\n\n${value("수업일", "classDate")} 수업에 ${value("구분", "specialType")} 학생 ${studentName} 학생이 참여 예정입니다.\n수업명: ${value("수업명", "className")}\n강의실: ${value("강의실", "classroom")}\n\n수업 진행 시 확인 부탁드립니다.\n\n울림연기학원`;
  if (type === "special_makeup_student") return `안녕하세요, 울림연기학원입니다.\n\n${studentName} 학생의 보강 수업 안내드립니다.\n수업일: ${value("수업일", "classDate")}\n수업명: ${value("수업명", "className")}\n강의실: ${value("강의실", "classroom")}\n\n울림연기학원`;
  if (type === "special_new_move_student") return `안녕하세요, 울림연기학원입니다.\n\n${studentName} 학생의 ${value("구분", "specialType")} 수업 안내드립니다.\n수업일: ${value("수업일", "classDate")}\n수업명: ${value("수업명", "className")}\n강의실: ${value("강의실", "classroom")}\n\n울림연기학원`;
  if (type === "absence") return `안녕하세요, 울림연기학원입니다.\n\n${studentName} 학생의 결석이 확인되었습니다.\n수업일: ${value("수업일", "date")}\n반명: ${value("반명", "className")}`;
  if (type === "attendance") return `안녕하세요, 울림연기학원입니다.\n\n${studentName} 학생 출결 안내입니다.\n수업일: ${value("수업일", "date")}\n반명: ${value("반명", "className")}\n출결상태: ${value("출결상태", "status")}`;
  if (type === "daily_evaluation" || type === "dailyEvaluation") return `안녕하세요, 울림연기학원입니다.\n\n${studentName} 학생의 수업 일일평가가 등록되었습니다.\n수업일: ${value("수업일", "date")}\n수업명: ${value("수업명", "className")}\n담당강사: ${value("담당강사", "instructorName")}`;
  if (type === "checkin") return `안녕하세요, 울림연기학원입니다.\n\n${studentName} 학생이 등원했습니다.\n수업일: ${value("수업일", "date")}\n수업명: ${value("수업명", "className")}\n등원시간: ${value("등원시간", "timeText")}`;
  if (type === "checkout") return `안녕하세요, 울림연기학원입니다.\n\n${studentName} 학생이 하원했습니다.\n수업일: ${value("수업일", "date")}\n하원시간: ${value("하원시간", "timeText")}`;
  return text(variables.messageText ?? variables.text, 3000) || `울림연기학원 안내입니다. ${studentName}`;
}
type AutomatedDispatchClaim7355028 = {
  allowed: boolean;
  ref: DocumentReference;
  state: string;
  data: PlainObject;
};
async function claimAutomatedMessageDispatch7355028(dispatchKeyInput: string, type: string, actor: StaffCaller): Promise<AutomatedDispatchClaim7355028> {
  const dispatchKey = text(dispatchKeyInput, 500);
  const dispatchId = hashId("MDISPATCH", dispatchKey);
  const ref = db().collection("operationalMessageDispatches").doc(dispatchId);
  return db().runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data() ?? {};
    const state = text(current.state, 40);
    if (snapshot.exists) return { allowed: false, ref, state: state || "dispatching", data: current };
    const now = Date.now();
    const initial = {
      dispatchId, dispatchKey, type,
      state: "dispatching",
      actorFirebaseUid: actor.firebaseUid,
      actorRole: actor.role,
      actorName: actor.displayName,
      createdAtMs: now,
      createdAt: FieldValue.serverTimestamp(),
      updatedAtMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
    };
    transaction.set(ref, initial, { merge: false });
    return { allowed: true, ref, state: "dispatching", data: initial };
  });
}
async function patchAutomatedMessageDispatch7355028(ref: DocumentReference | null, patch: PlainObject): Promise<void> {
  if (!ref) return;
  try {
    await ref.set({ ...patch, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  } catch { /* 외부 발송 성공 여부와 감사기록 저장 성공 여부를 분리합니다. */ }
}
function noAutoRetryError7355028(error: unknown): Error {
  const value = error instanceof Error ? error : new Error(String(error));
  (value as Error & { ulimNoAutoRetry?: boolean }).ulimNoAutoRetry = true;
  return value;
}
async function sendSolapiMessages(
  type: string,
  recipients: PlainObject[],
  commonVariables: PlainObject,
  actor: StaffCaller,
  dispatchKeyInput = ""
): Promise<PlainObject> {
  const config = parseOperationalSolapiConfig();
  const key = messageTemplateKey(type);
  const templateId = config.templates[key];
  if (!templateId) throw new Error(`SOLAPI_TEMPLATE_ID_MISSING:${key}`);
  const uniqueRecipients = Array.from(new Map(recipients.map(recipient => [normalizePhone(recipient.phone), recipient])).values())
    .filter(recipient => normalizePhone(recipient.phone)).slice(0, MAX_MESSAGE_RECIPIENTS);
  if (!uniqueRecipients.length) throw new Error("MESSAGE_RECIPIENTS_EMPTY");
  const date = new Date().toISOString();
  const salt = randomUUID().replace(/-/g, "");
  const signature = createHmac("sha256", config.apiSecret).update(date + salt, "utf8").digest("hex");
  const messages = uniqueRecipients.map(recipient => {
    const variables = { ...commonVariables, ...object(recipient.variables) };
    const kakaoVariables: Record<string, string> = {};
    Object.entries(variables).forEach(([name, value]) => {
      const keyName = name.startsWith("#{") ? name : `#{${name}}`;
      kakaoVariables[keyName] = text(value, 1000);
    });
    return {
      to: normalizePhone(recipient.phone),
      from: config.sender,
      text: defaultMessageText(type, variables),
      kakaoOptions: { pfId: config.pfId, templateId, disableSms: config.disableSms, variables: kakaoVariables }
    };
  });

  let dispatchRef: DocumentReference | null = null;
  const dispatchKey = text(dispatchKeyInput, 500);
  if (dispatchKey) {
    const claim = await claimAutomatedMessageDispatch7355028(dispatchKey, type, actor);
    dispatchRef = claim.ref;
    if (!claim.allowed) {
      return {
        skipped: true,
        duplicateSuppressed: true,
        reason: "AUTOMATED_DISPATCH_ALREADY_CLAIMED",
        dispatchState: claim.state,
        deliveryId: text(claim.data.deliveryId, 200),
        sent: 0
      };
    }
  }

  let response: Response;
  try {
    response = await fetch("https://api.solapi.com/messages/v4/send-many/detail", {
      method: "POST",
      headers: {
        Authorization: `HMAC-SHA256 apiKey=${config.apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ messages, allowDuplicates: false, showMessageList: true }),
      signal: AbortSignal.timeout(60_000)
    });
  } catch (error) {
    await patchAutomatedMessageDispatch7355028(dispatchRef, {
      state: "delivery_unknown",
      error: text(error instanceof Error ? error.message : error, 1200)
    });
    if (dispatchRef) throw noAutoRetryError7355028(error);
    throw error;
  }
  const raw = await response.text();
  let result: PlainObject = {};
  try { result = object(JSON.parse(raw)); } catch { result = { raw: raw.slice(0, 1500) }; }
  const failed = Array.isArray(result.failedMessageList) ? result.failedMessageList : [];
  if (!response.ok || failed.length) {
    const first = failed.length ? object(failed[0]) : {};
    const message = !response.ok
      ? `SOLAPI_HTTP_${response.status}:${text(result.message ?? result.errorMessage ?? raw, 1200)}`
      : `SOLAPI_REJECTED:${text(first.statusCode, 60)}:${text(first.statusMessage ?? first.message, 1000)}`;
    await patchAutomatedMessageDispatch7355028(dispatchRef, { state: "rejected", httpStatus: response.status, result, error: message });
    const error = new Error(message);
    if (dispatchRef) throw noAutoRetryError7355028(error);
    throw error;
  }

  const deliveryId = hashId("MSG", type, actor.firebaseUid, Date.now(), randomUUID());
  await patchAutomatedMessageDispatch7355028(dispatchRef, {
    state: "accepted",
    deliveryId,
    httpStatus: response.status,
    result,
    acceptedAtMs: Date.now(),
    acceptedAt: FieldValue.serverTimestamp()
  });

  // 외부 발송은 이미 성공했습니다. 이후 Firestore 감사기록 실패가 재발송의 원인이 되어서는 안 됩니다.
  let auditState = "complete";
  try {
    await db().collection("messageDeliveries").doc(deliveryId).set({
      deliveryId, type, templateKey: key, templateId,
      dispatchKey: dispatchKey || "",
      recipients: uniqueRecipients.map(recipient => ({ phoneTail: normalizePhone(recipient.phone).slice(-4), studentUid: text(recipient.studentUid, 160), target: text(recipient.target, 40) })),
      requestCount: messages.length, httpStatus: response.status, ok: true,
      result, actorFirebaseUid: actor.firebaseUid, actorRole: actor.role, actorName: actor.displayName,
      sheetBackupState: "pending_0600", createdAtMs: Date.now(), createdAt: FieldValue.serverTimestamp(), version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
    }, { merge: false });
  } catch (error) {
    auditState = "audit_write_failed";
    await patchAutomatedMessageDispatch7355028(dispatchRef, {
      auditState,
      auditError: text(error instanceof Error ? error.message : error, 1200)
    });
  }
  return { deliveryId, sent: messages.length, result, dispatchState: dispatchRef ? "accepted" : "", auditState };
}
async function filterOperationalAudienceRecipients7355034(
  type: string,
  recipients: PlainObject[],
  commonVariables: PlainObject
): Promise<{ recipients: PlainObject[]; suppressed: number }> {
  if (type !== "daily_evaluation") return { recipients, suppressed: 0 };
  const policy = await audienceNotificationPolicy7355034();
  const allowed: PlainObject[] = [];
  let suppressed = 0;
  for (const recipient of recipients) {
    const variables = { ...commonVariables, ...object(recipient.variables) };
    const audienceGroup = await audienceFromClassOrStudent7355034(
      recipient.classId ?? variables.classId,
      recipient.className ?? variables.className ?? variables["반명"],
      recipient.studentUid
    );
    if (audiencePolicyAllows7355034(audienceGroup, policy)) allowed.push(recipient);
    else suppressed++;
  }
  return { recipients: allowed, suppressed };
}

export async function sendOperationalSolapiMessages7355014(
  type: string,
  recipients: PlainObject[],
  commonVariables: PlainObject = {},
  actorInput: PlainObject = {}
): Promise<PlainObject> {
  const rawRole = text(actorInput.role, 30);
  const role: UlimRole = rawRole === "teacher" || rawRole === "admin" || rawRole === "superAdmin" ? rawRole : "superAdmin";
  const actor: StaffCaller = {
    firebaseUid: text(actorInput.firebaseUid, 160) || "system-operational-message-7355014",
    role,
    authVersion: "uidv2",
    teacherUid: text(actorInput.teacherUid, 160) || undefined,
    displayName: text(actorInput.displayName, 120) || "운영자동발송",
    user: {}
  };
  const audienceFiltered7355034 = await filterOperationalAudienceRecipients7355034(type, recipients, commonVariables);
  if (recipients.length > 0 && audienceFiltered7355034.recipients.length === 0) {
    return { skipped: true, reason: "AUDIENCE_NOTIFICATIONS_DISABLED", sent: 0, suppressed: audienceFiltered7355034.suppressed };
  }
  return sendSolapiMessages(type, audienceFiltered7355034.recipients, commonVariables, actor, text(actorInput.dispatchKey, 500));
}

export async function sendTabletAttendanceSolapi7355014(payloadInput: PlainObject): Promise<PlainObject> {
  const payload = object(payloadInput);
  const [policy, audienceGroup] = await Promise.all([
    audienceNotificationPolicy7355034(),
    audienceFromClassOrStudent7355034(payload.classId, payload.className, payload.studentUid)
  ]);
  if (!audiencePolicyAllows7355034(audienceGroup, policy)) {
    return { skipped: true, reason: "AUDIENCE_NOTIFICATIONS_DISABLED", audienceGroup, sent: 0 };
  }
  const config = parseOperationalSolapiConfig();
  const mode = text(payload.mode, 20);
  const type = mode === "하원" || mode === "out" ? "checkout" : "checkin";
  const studentUid = text(payload.studentUid, 160);
  const studentName = text(payload.studentName, 120);
  const variables: PlainObject = {
    studentName,
    date: text(payload.date, 20),
    className: text(payload.className, 300),
    instructorName: text(payload.instructor ?? payload.instructorName, 120),
    roomName: text(payload.roomName ?? payload.classroom, 100),
    timeText: text(payload.timeText ?? payload.eventTimeText, 20),
    status: type === "checkin" ? "등원" : "하원",
    "학생명": studentName,
    "수업일": text(payload.date, 20),
    "수업명": text(payload.className, 300),
    "반명": text(payload.className, 300),
    "담당강사": text(payload.instructor ?? payload.instructorName, 120),
    "강의실": text(payload.roomName ?? payload.classroom, 100),
    "등원시간": type === "checkin" ? text(payload.timeText ?? payload.eventTimeText, 20) : "",
    "하원시간": type === "checkout" ? text(payload.timeText ?? payload.eventTimeText, 20) : ""
  };
  const recipients: PlainObject[] = [];
  for (const target of config.tabletTargets) {
    const phone = target === "parent" ? normalizePhone(payload.parentPhone) : normalizePhone(payload.studentPhone);
    if (!phone) continue;
    recipients.push({ phone, studentUid, target, variables });
  }
  if (!recipients.length) return { skipped: true, reason: "TABLET_RECIPIENT_PHONE_MISSING", sent: 0 };
  return sendOperationalSolapiMessages7355014(type, recipients, variables, {
    firebaseUid: "system-tablet-notification-7355014",
    role: "superAdmin",
    displayName: "태블릿자동발송",
    dispatchKey: `tablet-attendance|${text(payload.eventId, 200)}`
  });
}

async function loadRecipients(studentUids: string[], targets: string[]): Promise<PlainObject[]> {
  const students = await loadStudentsByUids(studentUids);
  const recipients: PlainObject[] = [];
  for (const [studentUid, student] of students.entries()) {
    for (const target of targets) {
      const phone = target === "parent" ? normalizePhone(student.parentPhone) : normalizePhone(student.studentPhone ?? student.phone);
      if (!phone) continue;
      const studentName = text(student.name ?? student.studentName, 120);
      recipients.push({ phone, studentUid, target, variables: { studentName, "학생명": studentName } });
    }
  }
  return recipients;
}

export const sendOperationalAlimtalkAdmin73550 = onCall(MESSAGE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  const input = object(request.data);
  const type = text(input.type, 50);
  if (!type) throw new HttpsError("invalid-argument", "발송 유형이 필요합니다.");
  const studentUids = unique(Array.isArray(input.studentUids) ? input.studentUids : [], 160);
  const targets = unique(Array.isArray(input.targets) ? input.targets : ["student", "parent"], 20).map(target => target === "학부모" ? "parent" : target === "학생" ? "student" : target);
  let recipients = Array.isArray(input.recipients) ? input.recipients.map(object) : [];
  if (!recipients.length && studentUids.length) recipients = await loadRecipients(studentUids, targets);
  const variables = object(input.variables);
  const classId = text(input.classId ?? variables.classId, 180);
  const className = text(input.className ?? variables.className ?? variables["수업명"] ?? variables["반명"], 300);
  const policy = await audienceNotificationPolicy7355034();
  if (classId || className) {
    const audienceGroup = await classAudienceFromContext7355034(classId, className);
    if (!audiencePolicyAllows7355034(audienceGroup, policy)) {
      return { status: "success", skipped: true, reason: "AUDIENCE_NOTIFICATIONS_DISABLED", audienceGroup, sent: 0, message: "해당 구분의 알림톡 발송이 비활성화되어 있습니다.", version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
    }
  } else if (recipients.length) {
    const uniqueStudentUids = unique(recipients.map(row => object(row).studentUid), 160);
    const students = await loadStudentsByUids(uniqueStudentUids);
    recipients = recipients.filter(row => {
      const studentUid = text(object(row).studentUid, 160);
      const group = studentUid && students.has(studentUid) ? studentAudienceDetails7355034(students.get(studentUid)).group : "unclassified";
      return audiencePolicyAllows7355034(group, policy);
    });
    if (!recipients.length) return { status: "success", skipped: true, reason: "AUDIENCE_NOTIFICATIONS_DISABLED", sent: 0, message: "선택한 대상의 알림톡 발송이 비활성화되어 있습니다.", version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
  }
  const result = await sendSolapiMessages(type, recipients, variables, caller);
  return { status: "success", ...result, message: `${Number(result.sent || 0)}건 발송 요청 완료`, version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

export const changeClassSessionAdmin73550 = onCall(MESSAGE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  const input = object(request.data);
  const operationRaw = normalize(input.operation ?? input.changeType ?? 'move');
  const operation = operationRaw === 'exclude' || operationRaw === normalize('수업일제외') ? 'exclude'
    : (operationRaw === 'cancel' || operationRaw === normalize('휴강') ? 'cancel'
      : (operationRaw === 'substitute' || operationRaw === normalize('대강') ? 'substitute' : 'move'));
  if (operation !== 'move' && !FULL_ADMIN_ROLES.has(caller.role)) throw new HttpsError('permission-denied', '휴강·대강·수업일 제외 처리는 전체관리자 권한이 필요합니다.');
  const originalDateInput = text(input.originalDate ?? input.date, 20);
  const defaultTarget = operation === 'move' ? text(input.targetDate ?? input.newDate, 20) : originalDateInput;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(originalDateInput) || !/^\d{4}-\d{2}-\d{2}$/.test(defaultTarget)) {
    throw new HttpsError('invalid-argument', '기존 수업일과 변경 수업일을 정확히 선택해주세요.');
  }
  const originalDate = originalDateInput;
  const targetDate = defaultTarget;
  const classId = text(input.classId, 180);
  const catalog = await loadClassCatalog(originalDate);
  const item = catalog.find(cls => cls.classId === classId) ?? resolveClass(catalog, input);
  if (!item) throw new HttpsError('not-found', '수업반을 찾지 못했습니다.');
  if (!classVisibleToCaller(item, caller)) throw new HttpsError('permission-denied', '이 수업일을 변경할 권한이 없습니다.');
  const classAudienceGroup = classAudience7355034(item);
  const audiencePolicy = await audienceNotificationPolicy7355034();
  const audienceNotificationAllowed = audiencePolicyAllows7355034(classAudienceGroup, audiencePolicy);
  let instructorUid = text(input.instructorUid, 160) || item.instructorUid;
  let instructorName = text(input.instructorName, 120) || item.instructorName;
  if (caller.role === 'teacher') { instructorUid = item.instructorUid; instructorName = item.instructorName || caller.displayName; }
  if (operation === 'substitute' && (!instructorUid || teacherNameKey(instructorName) === teacherNameKey(item.instructorName))) {
    throw new HttpsError('invalid-argument', '대강을 진행할 다른 강사를 선택해주세요.');
  }
  const startTime = safeTime(input.startTime) || item.startTime;
  const endTime = safeTime(input.endTime) || item.endTime;
  if (!startTime || !endTime) throw new HttpsError('invalid-argument', '수업 시작·종료 시간을 입력해주세요.');
  const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5));
  const endMinutes = Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3, 5));
  if (endMinutes <= startMinutes) throw new HttpsError('invalid-argument', '수업 종료시간은 시작시간보다 늦어야 합니다.');
  const reasonText = text(input.reason, 1000) || (operation === 'exclude' ? '4주 수업일 조정' : operation === 'cancel' ? '학원 일정 조정' : operation === 'substitute' ? '담당강사 일정 조정' : '학원 일정 조정');
  const stateSignature = hashId('CSOPSTATE', originalDate, item.classId, operation, targetDate, instructorUid, startTime, endTime, reasonText);
  const requestIdValue = text(input.requestId, 200) || hashId('CSREQ', caller.firebaseUid, stateSignature, Date.now());
  const changeId = hashId('CSCH', originalDate, item.classId);
  const ref = db().collection('classScheduleChanges').doc(changeId);
  const existing = await ref.get();
  const current = existing.data() ?? {};
  if ((text(current.lastRequestId, 200) === requestIdValue || text(current.stateSignature, 200) === stateSignature) && ['complete','not_requested'].includes(text(current.notificationState, 30))) {
    return { status: 'success', duplicate: true, changeId, classId: item.classId, originalDate, targetDate: text(current.targetDate, 20) || targetDate, operation, notification: { requested: operation !== 'exclude', ok: true, duplicate: true, deliveryId: text(current.notificationDeliveryId, 200) }, message: '이미 처리된 동일 변경입니다.', version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
  }
  // 휴강은 저장 뒤 명단에서 빠지므로 발송 대상은 변경 전 canonical roster에서 확정합니다.
  const beforeRoster = await buildAttendanceRosterInternal7355014(caller, { date: originalDate, classId: item.classId, className: item.className });
  const beforeStudentUids = unique(beforeRoster.rows.map(row => row.studentUid), 160);
  const notificationRequestedByUser = operation !== 'exclude' && input.sendNotification !== false;
  const sendNotification = notificationRequestedByUser && audienceNotificationAllowed;
  await ref.set({
    changeId, classId: item.classId, className: item.className, originalDate, targetDate,
    operation, sessionStatus: operation === 'exclude' ? 'excluded' : (operation === 'cancel' ? 'cancelled' : (operation === 'substitute' ? 'substitute' : 'moved')),
    originalWeekday: weekdayForDate(originalDate), targetWeekday: weekdayForDate(targetDate),
    originalStartTime: item.startTime, originalEndTime: item.endTime,
    startTime, endTime, instructorUid, instructorName,
    reason: reasonText, stateSignature, active: true, source: 'attendance_schedule_operation_7355033',
    notificationRequested: sendNotification, notificationState: sendNotification ? 'pending' : 'not_requested',
    notificationSuppressedReason: notificationRequestedByUser && !audienceNotificationAllowed ? 'audience_disabled' : FieldValue.delete(),
    audienceGroup: classAudienceGroup,
    lastRequestId: requestIdValue, sheetBackupState: 'pending_0600', updatedByFirebaseUid: caller.firebaseUid, updatedByRole: caller.role,
    updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), createdAtMs: Number(current.createdAtMs || Date.now()), createdAt: current.createdAt || FieldValue.serverTimestamp(),
    version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  }, { merge: true });
  await touchAttendanceRevision('class_schedule_operation_7355033', { classId: item.classId, originalDate, targetDate, operation, requestId: requestIdValue });
  await refreshTodayTabletSnapshot('class_schedule_operation_7355033');
  let notification: PlainObject = notificationRequestedByUser && !audienceNotificationAllowed
    ? { requested: false, skipped: true, reason: 'AUDIENCE_NOTIFICATIONS_DISABLED', audienceGroup: classAudienceGroup }
    : { requested: false };
  if (sendNotification) {
    const jobId = hashId('CLASSOPMSG', changeId, stateSignature);
    const claimed = await claimSpecialMessageJob735505(jobId, { changeId, classId: item.classId, originalDate, targetDate, operation, requestId: requestIdValue, stateSignature, target: 'student_parent' });
    if (!claimed) {
      const job = (await db().collection('operationalMessageJobs').doc(jobId).get()).data() ?? {};
      notification = { requested: true, ok: text(job.state, 30) === 'complete', duplicate: true, deliveryId: text(job.deliveryId, 200), error: text(job.error, 1200) };
    } else {
      try {
        let studentUids = beforeStudentUids;
        if (operation === 'move') {
          const built = await buildAttendanceRosterInternal7355014(caller, { date: targetDate, classId: item.classId, className: item.className });
          studentUids = unique(built.rows.map(row => row.studentUid), 160);
        }
        const targets = unique(Array.isArray(input.targets) ? input.targets : ['student', 'parent'], 20).map(target => target === '학부모' ? 'parent' : target === '학생' ? 'student' : target);
        const recipients = await loadRecipients(studentUids, targets);
        const originalWeekday = weekdayForDate(originalDate) + '요일';
        const targetWeekday = weekdayForDate(targetDate) + '요일';
        const originalTime = `${item.startTime}~${item.endTime}`;
        const targetTime = `${startTime}~${endTime}`;
        const reason = reasonText;
        let result: PlainObject;
        if (operation === 'cancel') {
          result = await sendSolapiMessages('class_cancel', recipients, {
            className: item.className, date: originalDate, weekday: originalWeekday, time: originalTime, reason,
            '수업명': item.className, '수업일': originalDate, '요일': originalWeekday, '수업시간': originalTime,
            '휴강사유': reason, '변경사유': reason
          }, caller);
        } else if (operation === 'substitute') {
          result = await sendSolapiMessages('class_substitute', recipients, {
            className: item.className,
            date: originalDate,
            weekday: originalWeekday,
            time: targetTime,
            originalInstructorName: item.instructorName,
            targetInstructorName: instructorName,
            instructorName,
            reason,
            '수업명': item.className,
            '수업일': originalDate,
            '요일': originalWeekday,
            '수업시간': targetTime,
            '기존담당강사': item.instructorName,
            '변경담당강사': instructorName,
            '변경사유': reason
          }, caller);
        } else {
          result = await sendSolapiMessages('class_change', recipients, {
            className: item.className, originalDate, targetDate, originalTime, targetTime,
            originalWeekday, targetWeekday, originalInstructorName: item.instructorName, targetInstructorName: instructorName,
            instructorName, weekday: targetWeekday, reason,
            '수업명': item.className,
            '기존수업일': originalDate, '기존요일': originalWeekday, '기존수업시간': originalTime, '기존담당강사': item.instructorName,
            '변경수업일': targetDate, '변경요일': targetWeekday, '변경수업시간': targetTime, '변경담당강사': instructorName,
            '변경사유': reason
          }, caller);
        }
        notification = { requested: true, ok: true, ...result };
        await completeSpecialMessageJob735505(jobId, { state: 'complete', deliveryId: result.deliveryId, completedAtMs: Date.now(), completedAt: FieldValue.serverTimestamp() });
        await ref.set({ notificationState: 'complete', notificationDeliveryId: result.deliveryId, notificationCompletedAtMs: Date.now(), notificationCompletedAt: FieldValue.serverTimestamp() }, { merge: true });
      } catch (error) {
        const message = text(error instanceof Error ? error.message : error, 1200);
        notification = { requested: true, ok: false, error: message };
        await completeSpecialMessageJob735505(jobId, { state: 'failed', error: message });
        await ref.set({ notificationState: 'failed', notificationError: message, notificationUpdatedAtMs: Date.now(), notificationUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    }
  }
  const label = operation === 'exclude' ? '수업일 제외' : operation === 'cancel' ? '휴강' : operation === 'substitute' ? '대강' : '수업일 변경';
  return { status: 'success', duplicate: false, changeId, classId: item.classId, originalDate, targetDate, operation, notification, message: `${label} 저장 완료`, version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

function monthlyWeekdayDates7355034(month: string, weekdayIndex: number): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpsError("invalid-argument", "대상월을 YYYY-MM 형식으로 선택해주세요.");
  if (!Number.isInteger(weekdayIndex) || weekdayIndex < 0 || weekdayIndex > 6) throw new HttpsError("invalid-argument", "요일을 선택해주세요.");
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const dates: string[] = [];
  for (let day = 1; day <= last; day += 1) {
    const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const jsDay = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (jsDay === weekdayIndex) dates.push(date);
  }
  return dates;
}
function weekdayLabel7355034(weekdayIndex: number): string {
  return ["일", "월", "화", "수", "목", "금", "토"][weekdayIndex] || "";
}
export const getMonthlyWeekdaySessionPlanAdmin7355034 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  requireFullAdmin(caller);
  const input = object(request.data);
  const month = text(input.month, 20) || safeDate("").slice(0, 7);
  const weekdayIndex = Number(input.weekday);
  const dates = monthlyWeekdayDates7355034(month, weekdayIndex);
  const catalog = await loadClassCatalog(`${month}-01`);
  const weekdayName = weekdayLabel7355034(weekdayIndex);
  const classes = catalog.filter(item => item.active && item.weekday === weekdayName);
  const changeIds = classes.flatMap(item => dates.map(date => hashId("CSCH", date, item.classId)));
  const changes = new Map<string, DocumentData>();
  for (let index = 0; index < changeIds.length; index += 250) {
    const refs = changeIds.slice(index, index + 250).map(id => db().collection("classScheduleChanges").doc(id));
    if (!refs.length) continue;
    const snapshots = await db().getAll(...refs);
    snapshots.forEach(snapshot => { if (snapshot.exists) changes.set(snapshot.id, snapshot.data() ?? {}); });
  }
  const datePlans = dates.map(date => {
    const excludedClassIds = classes.filter(item => {
      const row = changes.get(hashId("CSCH", date, item.classId));
      return row && row.active !== false && text(row.operation, 30) === "exclude";
    }).map(item => item.classId);
    return {
      date,
      checked: excludedClassIds.length === 0,
      partial: excludedClassIds.length > 0 && excludedClassIds.length < classes.length,
      excludedCount: excludedClassIds.length,
      classCount: classes.length
    };
  });
  return { status: "success", month, weekday: weekdayIndex, weekdayLabel: `${weekdayName}요일`, dates: datePlans, classCount: classes.length, version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

export const setMonthlyWeekdaySessionsAdmin7355034 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  requireFullAdmin(caller);
  const input = object(request.data);
  const month = text(input.month, 20) || safeDate("").slice(0, 7);
  const weekdayIndex = Number(input.weekday);
  const allDates = monthlyWeekdayDates7355034(month, weekdayIndex);
  const selectedDates = new Set(unique(Array.isArray(input.selectedDates) ? input.selectedDates : [], 20).filter(date => allDates.includes(date)));
  const catalog = await loadClassCatalog(`${month}-01`);
  const weekdayName = weekdayLabel7355034(weekdayIndex);
  const classes = catalog.filter(item => item.active && item.weekday === weekdayName);
  if (!classes.length) return { status: "success", month, weekday: weekdayIndex, classCount: 0, selectedDates: Array.from(selectedDates).sort(), excludedDates: allDates.filter(date => !selectedDates.has(date)), changed: 0, message: "해당 요일의 운영 반이 없습니다.", version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };

  const refs: DocumentReference[] = [];
  const refMeta = new Map<string, { item: ClassRow; date: string }>();
  for (const item of classes) {
    for (const date of allDates) {
      const ref = db().collection("classScheduleChanges").doc(hashId("CSCH", date, item.classId));
      refs.push(ref);
      refMeta.set(ref.path, { item, date });
    }
  }
  const currentByPath = new Map<string, { exists: boolean; data: DocumentData }>();
  for (let index = 0; index < refs.length; index += 250) {
    const chunk = refs.slice(index, index + 250);
    const snapshots = await db().getAll(...chunk);
    snapshots.forEach(snapshot => currentByPath.set(snapshot.ref.path, { exists: snapshot.exists, data: snapshot.data() ?? {} }));
  }

  type SessionPlanWrite7355034 = { kind: "delete" | "set"; ref: DocumentReference; data?: DocumentData };
  const writes: SessionPlanWrite7355034[] = [];
  const now = Date.now();
  const requestIdValue = text(input.requestId, 200) || hashId("CSREQ", caller.firebaseUid, month, weekdayIndex, now);
  for (const ref of refs) {
    const meta = refMeta.get(ref.path);
    if (!meta) continue;
    const { item, date } = meta;
    const currentState = currentByPath.get(ref.path) || { exists: false, data: {} };
    const current = currentState.data;
    const currentOperation = text(current.operation, 30);
    if (selectedDates.has(date)) {
      if (currentState.exists && currentOperation === "exclude") writes.push({ kind: "delete", ref });
      continue;
    }
    // 휴강·대강·수업일변경 등 명시적 운영 변경은 일괄 4주 설정으로 덮어쓰지 않습니다.
    if (currentState.exists && currentOperation && currentOperation !== "exclude") continue;
    const stateSignature = hashId("CSOPSTATE", date, item.classId, "exclude", date, item.instructorUid, item.startTime, item.endTime, "4주 수업일 조정");
    writes.push({ kind: "set", ref, data: {
      changeId: ref.id, classId: item.classId, className: item.className, originalDate: date, targetDate: date,
      operation: "exclude", sessionStatus: "excluded", originalWeekday: weekdayForDate(date), targetWeekday: weekdayForDate(date),
      originalStartTime: item.startTime, originalEndTime: item.endTime, startTime: item.startTime, endTime: item.endTime,
      instructorUid: item.instructorUid, instructorName: item.instructorName, reason: "4주 수업일 조정", stateSignature, active: true,
      source: "monthly_weekday_session_plan_7355034", notificationRequested: false, notificationState: "not_requested",
      lastRequestId: requestIdValue, sheetBackupState: "pending_0600",
      updatedByFirebaseUid: caller.firebaseUid, updatedByRole: caller.role, updatedAtMs: now, updatedAt: FieldValue.serverTimestamp(),
      createdAtMs: Number(current.createdAtMs || now), createdAt: current.createdAt || FieldValue.serverTimestamp(), version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
    } });
  }

  for (let index = 0; index < writes.length; index += 400) {
    const batch = db().batch();
    for (const write of writes.slice(index, index + 400)) {
      if (write.kind === "delete") batch.delete(write.ref);
      else batch.set(write.ref, write.data || {}, { merge: true });
    }
    await batch.commit();
  }
  await touchAttendanceRevision("monthly_weekday_session_plan_7355034", { month, weekday: weekdayIndex, selectedDates: Array.from(selectedDates).sort(), classCount: classes.length });
  await refreshTodayTabletSnapshot("monthly_weekday_session_plan_7355034");
  return { status: "success", month, weekday: weekdayIndex, weekdayLabel: `${weekdayName}요일`, classCount: classes.length, selectedDates: Array.from(selectedDates).sort(), excludedDates: allDates.filter(date => !selectedDates.has(date)), changed: writes.length, message: `${weekdayName}요일 전체 반 수업일을 저장했습니다.`, version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

export const listStaffPrivateNotesAdmin73550 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  requireFullAdmin(caller);
  const [users, notes] = await Promise.all([
    db().collection("users").limit(1000).get(),
    db().collection("staffPrivateNotes").limit(1000).get()
  ]);
  const noteMap = new Map<string, DocumentData>(notes.docs.map(doc => [doc.id, doc.data() ?? {}]));
  const staff = users.docs.map(doc => {
    const data = doc.data() ?? {};
    const role = text(data.role, 40);
    if (!STAFF_ROLES.has(role as UlimRole)) return null;
    const note = noteMap.get(doc.id) ?? {};
    return {
      firebaseUid: doc.id, loginId: text(data.loginId ?? data.adminId ?? data.legacyAdminId, 160), name: text(data.name ?? data.displayName ?? data.teacherName, 120), role,
      active: data.active === true, memo: text(note.memo, 5000), updatedAtMs: Number(note.updatedAtMs || 0), updatedByName: text(note.updatedByName, 120)
    };
  }).filter(Boolean).sort((a, b) => text(a?.name, 120).localeCompare(text(b?.name, 120), "ko"));
  return { status: "success", staff, count: staff.length, version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

export const saveStaffPrivateNoteAdmin73550 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  requireFullAdmin(caller);
  const input = object(request.data);
  const firebaseUid = text(input.firebaseUid, 160);
  if (!firebaseUid) throw new HttpsError("invalid-argument", "교직원을 선택해주세요.");
  await db().collection("staffPrivateNotes").doc(firebaseUid).set({
    firebaseUid, memo: text(input.memo, 5000), sheetBackupState: "pending_0600",
    updatedByFirebaseUid: caller.firebaseUid, updatedByName: caller.displayName,
    updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  }, { merge: true });
  return { status: "success", message: "교직원 메모 저장 완료", version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});



export const listRoomReservationsAdmin73550 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  requireFullAdmin(caller);
  const input = object(request.data);
  const date = safeDate(input.date);
  const snapshot = await db().collection("roomReservations").where("date", "==", date).limit(1000).get();
  const reservations = snapshot.docs.map(doc => {
    const data = doc.data() ?? {};
    return {
      reservationId: doc.id,
      id: doc.id,
      date: text(data.date ?? data.reserveDate, 20),
      studentUid: text(data.studentUid, 160),
      studentName: text(data.studentName ?? data.name, 120),
      attendanceNo: text(data.attendanceNo ?? data.studentNo, 60),
      studentPhone: text(data.studentPhone ?? data.phone, 60),
      parentPhone: text(data.parentPhone, 60),
      room: text(data.room ?? data.roomName ?? data.practiceRoom, 120),
      roomName: text(data.roomName ?? data.room ?? data.practiceRoom, 120),
      startHour: text(data.startHour ?? data.startTime, 30),
      endHour: text(data.endHour ?? data.endTime, 30),
      time: text(data.time ?? data.timeText ?? data.reservationTime, 80),
      status: text(data.status, 40) || "예약",
      memo: text(data.memo ?? data.note ?? data.reason, 1000),
      updatedAtMs: updatedAtMs(data)
    };
  }).filter(row => normalize(row.status) !== normalize("취소"));
  reservations.sort((a, b) => text(a.startHour, 30).localeCompare(text(b.startHour, 30), "ko") || text(a.studentName, 120).localeCompare(text(b.studentName, 120), "ko"));
  return { status: "success", date, reservations, count: reservations.length, source: "firestore_room_reservations_73550", version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

export const savePaymentAdmin73550 = onCall(MESSAGE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  requireFullAdmin(caller);
  const input = object(request.data);
  const studentUid = text(input.studentUid, 160);
  let student: DocumentData = {};
  if (studentUid) student = (await db().collection("students").doc(studentUid).get()).data() ?? {};
  if (!studentUid && text(input.studentName, 120)) {
    const matches = await db().collection("students").where("name", "==", text(input.studentName, 120)).limit(3).get();
    if (matches.size !== 1) throw new HttpsError("failed-precondition", "학생을 정확히 선택해주세요.");
    student = matches.docs[0].data() ?? {};
  }
  const resolvedUid = studentUid || text(student.studentUid, 160);
  const studentName = text(student.name ?? student.studentName ?? input.studentName, 120);
  const month = text(input.month, 30);
  const amount = Number(String(input.amount ?? "").replace(/[^0-9.-]/g, ""));
  const date = safeDate(input.date);
  if (!resolvedUid || !studentName || !month || !Number.isFinite(amount) || amount <= 0) throw new HttpsError("invalid-argument", "학생·수강월·결제금액을 확인해주세요.");
  const paymentId = hashId("PAY", resolvedUid, month, date, input.method, amount, randomUUID());
  const ref = db().collection("payments").doc(paymentId);
  await ref.set({
    paymentId, studentUid: resolvedUid, studentName, month, amount,
    method: text(input.method, 60), date, memo: text(input.memo, 2000),
    studentPhone: text(student.studentPhone ?? student.phone ?? input.studentPhone, 60),
    parentPhone: text(student.parentPhone ?? input.parentPhone, 60),
    source: "firestore_payment_73550", sheetBackupState: "pending_0600",
    createdByFirebaseUid: caller.firebaseUid, createdByRole: caller.role,
    createdAtMs: Date.now(), createdAt: FieldValue.serverTimestamp(),
    updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(),
    version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  }, { merge: false });
  let notification: PlainObject = { requested: false };
  if (input.sendNotification === true) {
    const [policy, audienceGroup] = await Promise.all([audienceNotificationPolicy7355034(), Promise.resolve(studentAudienceDetails7355034(student).group)]);
    if (!audiencePolicyAllows7355034(audienceGroup, policy)) {
      notification = { requested: false, skipped: true, reason: "AUDIENCE_NOTIFICATIONS_DISABLED", audienceGroup };
      await ref.set({ notificationState: "not_requested", notificationSuppressedReason: "audience_disabled", audienceGroup }, { merge: true });
    } else try {
      const targets = unique(Array.isArray(input.targets) ? input.targets : ["student", "parent"], 20).map(target => target === "학부모" ? "parent" : target === "학생" ? "student" : target);
      const recipients = await loadRecipients([resolvedUid], targets);
      const result = await sendSolapiMessages("payment", recipients, { studentName, month, amount: String(amount), method: text(input.method, 60), date, memo: text(input.memo, 1000), messageText: text(input.messageText, 3000) }, caller);
      notification = { requested: true, ok: true, ...result };
      await ref.set({ notificationState: "complete", notificationDeliveryId: result.deliveryId }, { merge: true });
    } catch (error) {
      const message = text(error instanceof Error ? error.message : error, 1200);
      notification = { requested: true, ok: false, error: message };
      await ref.set({ notificationState: "failed", notificationError: message }, { merge: true });
    }
  }
  return { status: "success", paymentId, notification, message: "결제 등록이 완료되었습니다.", version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

const DEFAULT_DAILY_EVALUATION_TEMPLATE_73550 = `[반명] / [수업일]
구분:
이번주 수업:
수업활동 및 태도:
전달사항:
영상링크:`;

export const getDailyEvaluationTemplateAdmin73550 = onCall(CALLABLE_OPTIONS, async request => {
  await requireStaff(request);
  const snapshot = await db().collection("operationalTemplates").doc("dailyEvaluation").get();
  const data = snapshot.data() ?? {};
  return {
    status: "success",
    template: text(data.template, 12000) || DEFAULT_DAILY_EVALUATION_TEMPLATE_73550,
    updatedAtMs: Number(data.updatedAtMs || 0),
    version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  };
});

export const saveDailyEvaluationTemplateAdmin73550 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  requireFullAdmin(caller);
  const input = object(request.data);
  const template = text(input.template, 12000);
  if (!template) throw new HttpsError("invalid-argument", "저장할 기본 문구를 입력해주세요.");
  await db().collection("operationalTemplates").doc("dailyEvaluation").set({
    template,
    source: "firestore_primary_73550",
    sheetBackupState: "pending_0600",
    updatedByFirebaseUid: caller.firebaseUid,
    updatedByRole: caller.role,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
    version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  }, { merge: true });
  return { status: "success", template, message: "기본 문구를 저장했습니다.", version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

export const getAttendanceRevisionAdmin73550 = onCall(CALLABLE_OPTIONS, async request => {
  await requireStaff(request);
  const snapshot = await db().collection("operationalRealtimeRevisions").doc("attendance").get();
  const data = snapshot.data() ?? {};
  return {
    status: "success",
    revision: Number(data.revision || 0),
    updatedAtMs: Number(data.updatedAtMs || 0),
    reason: text(data.reason, 120),
    version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  };
});

export const listCourseApplicationsAdmin73550 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: "512MiB" }, async request => {
  const caller = await requireStaff(request);
  requireFullAdmin(caller);
  const input = object(request.data);
  const month = text(input.month, 20);
  let query = db().collection("courseApplications").orderBy("submittedAtMs", "desc").limit(1000);
  const snapshot = await query.get();
  const rows = snapshot.docs.map(doc => ({ applicationId: doc.id, ...doc.data() }))
    .filter(row => !month || text(object(row).month, 20) === month || text(object(row).applicationMonth, 20) === month);
  const studentUids = unique(rows.map(row => object(row).studentUid), 160);
  const students = await loadStudentsByUids(studentUids);
  const applications = rows.map(row => {
    const data = object(row);
    const studentUid = text(data.studentUid, 160);
    const student = students.get(studentUid) ?? {};
    return { ...data, applicationId: text(data.applicationId, 180), studentUid, studentName: text(data.studentName ?? student.name ?? student.studentName, 120), attendanceNo: text(student.attendanceNo ?? student.loginId ?? student.studentNo, 60) };
  });
  return { status: "success", applications, count: applications.length, source: "firestore_course_applications_73550", version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

function courseApplicationAction7355028(data: PlainObject): string {
  const action = text(data.registrationDecision ?? data.decision ?? data.type, 40) || "continue";
  return ["continue", "class_move", "leave", "withdrawn"].includes(action) ? action : "continue";
}
function courseApplicationEffectiveDate7355028(data: PlainObject): string {
  const stored = text(data.effectiveStartDate, 20);
  if (/^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
  const month = text(data.month ?? data.applicationMonth, 20);
  return /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : safeDate("");
}
async function applyApprovedCourseApplication7355028(
  appRef: DocumentReference,
  appDataInput: PlainObject,
  catalogMap: Map<string, ClassRow>,
  actor: StaffCaller
): Promise<PlainObject> {
  const appData = object(appDataInput);
  const studentUid = text(appData.studentUid, 160);
  if (!studentUid) throw new Error("학생 UID 없음");
  const action = courseApplicationAction7355028(appData);
  const requestedClassIds = unique(Array.isArray(appData.requestedClassIds) ? appData.requestedClassIds : [], 180).filter(id => catalogMap.has(id));
  if (action === "class_move" && !requestedClassIds.length) throw new Error("반이동 신청반이 없습니다.");
  const effectiveStartDate = courseApplicationEffectiveDate7355028(appData);
  if (effectiveStartDate > safeDate("")) return { ok: true, applied: false, scheduled: true, effectiveStartDate, studentUid, action };

  const studentRef = db().collection("students").doc(studentUid);
  let enrollmentDocs: QueryDocumentSnapshot<DocumentData>[] = [];
  let memberDocs: QueryDocumentSnapshot<DocumentData>[] = [];
  if (["class_move", "withdrawn"].includes(action)) {
    const [enrollments, members] = await Promise.all([
      db().collection("studentEnrollments").where("studentUid", "==", studentUid).limit(500).get(),
      db().collection("classMembers").where("studentUid", "==", studentUid).limit(500).get()
    ]);
    enrollmentDocs = enrollments.docs;
    memberDocs = members.docs;
  }
  const projectedWrites = 2 + enrollmentDocs.length + memberDocs.length + requestedClassIds.length * 2;
  if (projectedWrites > 450) throw new Error("수강관계 문서가 비정상적으로 많아 관리자 점검이 필요합니다.");

  const now = Date.now();
  const selectedSet = new Set(requestedClassIds);
  const batch = db().batch();
  if (action === "continue") {
    batch.set(studentRef, {
      enrollmentStatus: "active", status: "active",
      courseApplicationAppliedMonth: effectiveStartDate.slice(0, 7),
      courseApplicationAppliedAtMs: now, courseApplicationAppliedAt: FieldValue.serverTimestamp(),
      updatedAtMs: now, updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } else if (action === "class_move") {
    enrollmentDocs.forEach(doc => {
      const classId = text(doc.data()?.classId, 180);
      if (selectedSet.has(classId) && doc.data()?.active !== false && text(doc.data()?.status, 40) !== "ended") return;
      batch.set(doc.ref, { active: false, status: "ended", endDate: dateOffset7355014(effectiveStartDate, -1), endOperationDate: effectiveStartDate, endedBy: "course_application_firestore_7355049", updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    memberDocs.forEach(doc => {
      const classId = text(doc.data()?.classId, 180);
      if (selectedSet.has(classId) && doc.data()?.active !== false) return;
      batch.set(doc.ref, { active: false, enrollmentStatus: "ended", endedBy: "course_application_firestore_7355028", updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    const classNames = requestedClassIds.map(id => catalogMap.get(id)?.className).filter(Boolean);
    const instructorUids = unique(requestedClassIds.map(id => catalogMap.get(id)?.instructorUid), 160);
    const instructorNames = unique(requestedClassIds.map(id => catalogMap.get(id)?.instructorName), 120);
    batch.set(studentRef, {
      classUids: requestedClassIds, classNames, instructorUids, instructorNames,
      enrollmentStatus: "active", status: "active",
      lastRegistrationType: "class_move",
      lastRegistrationOperationDate: effectiveStartDate,
      courseApplicationAppliedMonth: effectiveStartDate.slice(0, 7),
      courseApplicationAppliedAtMs: now, courseApplicationAppliedAt: FieldValue.serverTimestamp(),
      updatedAtMs: now, updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    requestedClassIds.forEach(classId => {
      const item = catalogMap.get(classId)!;
      const enrollmentId = hashId("ENR", studentUid, classId);
      batch.set(db().collection("studentEnrollments").doc(enrollmentId), {
        enrollmentId, studentUid, classId, className: item.className, instructorUid: item.instructorUid, instructorName: item.instructorName,
        active: true, status: "active",
        registrationType: "class_move", startDate: effectiveStartDate, operationDate: effectiveStartDate,
        entryType: "class_move", entryStartDate: effectiveStartDate, entryTypeSource: "course_application_explicit_73550998",
        source: "course_application_firestore_7355048", updatedAtMs: now, updatedAt: FieldValue.serverTimestamp(), version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
      }, { merge: true });
      const memberId = hashId("CM", classId, studentUid);
      batch.set(db().collection("classMembers").doc(memberId), {
        classMemberId: memberId, studentUid, studentIdentityKey: studentUid, classId, className: item.className,
        instructorUid: item.instructorUid, instructorName: item.instructorName, active: true, enrollmentStatus: "active",
        source: "course_application_firestore_7355028", updatedAtMs: now, updatedAt: FieldValue.serverTimestamp(), version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
      }, { merge: true });
    });
  } else if (action === "leave") {
    batch.set(studentRef, {
      enrollmentStatus: "leave", status: "leave",
      courseApplicationAppliedMonth: effectiveStartDate.slice(0, 7),
      courseApplicationAppliedAtMs: now, courseApplicationAppliedAt: FieldValue.serverTimestamp(),
      updatedAtMs: now, updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } else if (action === "withdrawn") {
    batch.set(studentRef, {
      enrollmentStatus: "withdrawn", status: "withdrawn", classUids: [], classNames: [], instructorUids: [], instructorNames: [],
      courseApplicationAppliedMonth: effectiveStartDate.slice(0, 7),
      courseApplicationAppliedAtMs: now, courseApplicationAppliedAt: FieldValue.serverTimestamp(),
      updatedAtMs: now, updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    enrollmentDocs.forEach(doc => batch.set(doc.ref, { active: false, status: "ended", endDate: effectiveStartDate, endedBy: "course_application_firestore_7355028", updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
    memberDocs.forEach(doc => batch.set(doc.ref, { active: false, enrollmentStatus: "withdrawn", endedBy: "course_application_firestore_7355028", updatedAtMs: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
  }
  batch.set(appRef, {
    state: "applied", decisionState: "approved", applyState: "applied",
    effectiveStartDate,
    appliedByFirebaseUid: actor.firebaseUid, appliedByName: actor.displayName,
    appliedAtMs: now, appliedAt: FieldValue.serverTimestamp(),
    sheetBackupState: "pending_0600", updatedAtMs: now, updatedAt: FieldValue.serverTimestamp(),
    version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
  }, { merge: true });
  await batch.commit();
  return { ok: true, applied: true, scheduled: false, effectiveStartDate, studentUid, action, requestedClassIds };
}

async function applyDueCourseApplications7355028(): Promise<PlainObject[]> {
  const today = safeDate("");
  const snapshot = await db().collection("courseApplications").where("state", "==", "approved").limit(500).get();
  const due = snapshot.docs.filter(doc => courseApplicationEffectiveDate7355028(object(doc.data())) <= today);
  if (!due.length) return [];
  const catalog = await loadClassCatalog(today);
  const catalogMap = new Map(catalog.map(item => [item.classId, item]));
  const actor: StaffCaller = { firebaseUid: "system-course-application-7355028", role: "superAdmin", authVersion: "uidv2", displayName: "수강신청자동반영", user: {} };
  const results: PlainObject[] = [];
  for (const doc of due) {
    try { results.push({ applicationId: doc.id, ...(await applyApprovedCourseApplication7355028(doc.ref, object(doc.data()), catalogMap, actor)) }); }
    catch (error) {
      const message = text(error instanceof Error ? error.message : error, 1200);
      await doc.ref.set({ applyState: "failed", applyError: message, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      results.push({ applicationId: doc.id, ok: false, applied: false, error: message });
    }
  }
  return results;
}

export const decideCourseApplicationsAdmin73550 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 180, memory: "1GiB" }, async request => {
  const caller = await requireStaff(request);
  requireFullAdmin(caller);
  const input = object(request.data);
  const decisions = Array.isArray(input.decisions) ? input.decisions.map(object) : [];
  if (!decisions.length || decisions.length > 200) throw new HttpsError("invalid-argument", "처리할 수강신청을 선택해주세요.");
  const catalog = await loadClassCatalog();
  const catalogMap = new Map(catalog.map(item => [item.classId, item]));
  const results: PlainObject[] = [];
  for (const decision of decisions) {
    const applicationId = text(decision.applicationId, 180);
    const approvalState = text(decision.state ?? decision.decisionState, 40);
    if (!applicationId || !["approved", "rejected"].includes(approvalState)) {
      results.push({ applicationId, ok: false, message: "승인 또는 반려 상태가 올바르지 않습니다." });
      continue;
    }
    const appRef = db().collection("courseApplications").doc(applicationId);
    try {
      const appSnap = await appRef.get();
      if (!appSnap.exists) throw new Error("수강신청 없음");
      const appData = appSnap.data() ?? {};
      const action = courseApplicationAction7355028(object(appData));
      const requestedClassIds = unique(Array.isArray(appData.requestedClassIds) ? appData.requestedClassIds : [], 180).filter(id => catalogMap.has(id));
      if (approvalState === "approved" && action === "class_move" && !requestedClassIds.length) throw new Error("반이동 신청반이 없습니다.");
      const now = Date.now();
      const effectiveStartDate = courseApplicationEffectiveDate7355028(object(appData));
      await appRef.set({
        state: approvalState,
        decisionState: approvalState,
        applyState: approvalState === "approved" ? "scheduled" : "rejected",
        registrationDecision: action,
        requestedClassIds,
        effectiveStartDate,
        decidedByFirebaseUid: caller.firebaseUid,
        decidedByName: caller.displayName,
        decidedAtMs: now,
        decidedAt: FieldValue.serverTimestamp(),
        sheetBackupState: "pending_0600",
        updatedAtMs: now,
        updatedAt: FieldValue.serverTimestamp(),
        version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
      }, { merge: true });
      if (approvalState === "rejected") {
        results.push({ applicationId, ok: true, state: "rejected", registrationDecision: action, effectiveStartDate });
        continue;
      }
      const current = { ...appData, registrationDecision: action, requestedClassIds, effectiveStartDate, state: "approved" };
      const applied = effectiveStartDate <= safeDate("")
        ? await applyApprovedCourseApplication7355028(appRef, current, catalogMap, caller)
        : { ok: true, applied: false, scheduled: true, effectiveStartDate };
      results.push({ applicationId, ok: true, state: applied.applied === true ? "applied" : "approved", registrationDecision: action, ...applied });
    } catch (error) {
      results.push({ applicationId, ok: false, message: text(error instanceof Error ? error.message : error, 1000) });
    }
  }
  const appliedCount = results.filter(row => row.applied === true).length;
  if (appliedCount) {
    await touchAttendanceRevision("course_application_due_apply", { count: appliedCount });
    await refreshTodayTabletSnapshot("course_application_due_apply");
  }
  return { status: "success", ok: results.every(row => row.ok === true), results, version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
});

function dateKeyOffset735505(baseDate: string, days: number): string {
  const ms = new Date(`${baseDate}T00:00:00+09:00`).getTime() + days * 86_400_000;
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function tomorrowSeoul735505(): string {
  return dateKeyOffset735505(safeDate(""), 1);
}
function firstEffectiveScheduledSession7355049(
  item: ClassRow,
  startDate: string,
  targetDate: string,
  scheduleChanges: PlainObject[],
  cache: Map<string, string>
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || startDate > targetDate) return "";
  const cacheKey = `${item.classId}|${startDate}|${targetDate}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) || "";
  const classChanges = scheduleChanges.filter(change => text(change.classId, 180) === item.classId && change.active !== false);
  const candidates = new Set<string>();
  const explicitWeekday = item.weekday || extractWeekday(item.className, item.raw || {});
  if (explicitWeekday) {
    let firstBase = "";
    for (let offset = 0; offset < 7; offset += 1) {
      const date = dateKeyOffset735505(startDate, offset);
      if (weekdayForDate(date) === explicitWeekday) { firstBase = date; break; }
    }
    if (firstBase) {
      for (let date = firstBase, guard = 0; date <= targetDate && guard < 600; date = dateKeyOffset735505(date, 7), guard += 1) candidates.add(date);
    }
  } else {
    item.dates.filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= startDate && date <= targetDate).forEach(date => candidates.add(date));
  }
  classChanges.forEach(change => {
    const originalDate = text(change.originalDate, 20);
    const movedDate = text(change.targetDate, 20);
    if (originalDate >= startDate && originalDate <= targetDate) candidates.add(originalDate);
    if (movedDate >= startDate && movedDate <= targetDate) candidates.add(movedDate);
  });
  const sorted = Array.from(candidates).sort();
  let first = "";
  for (const date of sorted) {
    const dateChanges = classChanges.filter(change => text(change.originalDate, 20) === date || text(change.targetDate, 20) === date);
    const effective = effectiveClassesForDate([item], date, dateChanges).classes.some(row => row.classId === item.classId);
    if (effective) { first = date; break; }
  }
  cache.set(cacheKey, first);
  return first;
}
function firstScheduledSessionOnOrAfter735505(item: ClassRow, startDate: string, targetDate: string): boolean {
  // Compatibility wrapper for older tests only. Production registration display uses
  // firstEffectiveScheduledSession7355049 with classScheduleChanges.
  return firstEffectiveScheduledSession7355049(item, startDate, targetDate, [], new Map<string, string>()) === targetDate;
}
async function instructorPhones735505(item: ClassRow): Promise<string[]> {
  const phones: string[] = [];
  if (item.instructorUid) {
    const direct = await db().collection("users").doc(item.instructorUid).get();
    if (direct.exists) {
      const data = direct.data() ?? {};
      phones.push(normalizePhone(data.phone ?? data.mobile ?? data.phoneNumber ?? data.staffPhone));
    }
  }
  if (!phones.filter(Boolean).length && item.instructorName) {
    const users = await db().collection("users").limit(1000).get();
    users.docs.forEach(doc => {
      const data = doc.data() ?? {};
      const role = text(data.firebaseRole ?? data.role, 40);
      const name = text(data.name ?? data.displayName ?? data.instructorName, 120);
      if (!["teacher", "admin", "superAdmin"].includes(role) || teacherNameKey(name) !== teacherNameKey(item.instructorName)) return;
      phones.push(normalizePhone(data.phone ?? data.mobile ?? data.phoneNumber ?? data.staffPhone));
    });
  }
  return unique(phones.filter(Boolean), 80);
}
async function claimSpecialMessageJob735505(jobId: string, data: PlainObject): Promise<boolean> {
  const ref = db().collection("operationalMessageJobs").doc(jobId);
  return db().runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data() ?? {};
    const state = text(current.state, 30);
    const updated = Number(current.updatedAtMs || 0);
    if (["complete", "delivery_unknown", "permanent_failed"].includes(state)) return false;
    if (state === "processing" && Date.now() - updated < 10 * 60 * 1000) return false;
    transaction.set(ref, {
      ...data, jobId, state: "processing", attempts: Number(current.attempts || 0) + 1,
      sheetBackupState: "pending_0600", updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(),
      createdAtMs: Number(current.createdAtMs || Date.now()), createdAt: current.createdAt || FieldValue.serverTimestamp(),
      version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION
    }, { merge: true });
    return true;
  });
}
function explicitSpecialType73550978(row: PlainObject): string {
  const key = normalize(text(row.attendanceEntryType, 40));
  if (key === "new") return "신규";
  if (key === "class_move") return "반이동";
  if (key === "makeup") return "보강";
  if (key === "daily_special") return "일일특강";
  // 73550974의 durable name marker는 명시적 UI 처리 증거다.
  const named = statusValue(row.nameSpecialStatus);
  if (["신규","반이동","보강","일일특강"].includes(named)) return named;
  // 계산된 roster 특이상태는 알림 authority로 절대 사용하지 않는다.
  return "";
}
function specialMessageJobId73550978(targetDate: string, classId: string, studentUid: string, specialType: string, target: string, phoneTail = ""): string {
  const registration = specialType === "신규" || specialType === "반이동";
  const scope = registration ? targetDate.slice(0, 7) : targetDate;
  const kindScope = registration ? "registration" : specialType;
  return hashId("SPMSG", scope, classId, studentUid, kindScope, target, phoneTail);
}
async function legacySpecialMessageAlreadyHandled73550978(targetDate: string, classId: string, studentUid: string, specialType: string, target: string, phoneTail = ""): Promise<boolean> {
  if (specialType !== "신규" && specialType !== "반이동") return false;
  const legacyTypes = ["신규", "반이동"];
  for (const legacyType of legacyTypes) {
    const legacyId = hashId("SPMSG", targetDate, classId, studentUid, legacyType, target, phoneTail);
    const snap = await db().collection("operationalMessageJobs").doc(legacyId).get();
    if (!snap.exists) continue;
    const state = text(snap.data()?.state, 30);
    if (["processing","complete","delivery_unknown","permanent_failed"].includes(state)) return true;
  }
  return false;
}

async function completeSpecialMessageJob735505(jobId: string, patch: PlainObject): Promise<void> {
  await db().collection("operationalMessageJobs").doc(jobId).set({
    ...patch, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), sheetBackupState: "pending_0600"
  }, { merge: true });
}
// R29.9.12 R2 / 7.35.5.0.91.2
// Durable second guard for NEW-student notifications. Existing SPMSG locks include targetDate,
// so they prevent same-date retries but cannot by themselves stop a stale NEW state one week later.
async function priorNewStudentSpecialJob7355091(
  studentUid: string,
  classId: string,
  targetDate: string
): Promise<PlainObject | null> {
  if (!studentUid || !classId || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return null;

  // Single-field query only: no composite Firestore index is required.
  // Explicit map<PlainObject> is required under the project's strict TypeScript typecheck;
  // otherwise TypeScript narrows the mapped element to { jobId: string } and rejects
  // targetDate/classId/specialType/updatedAtMs property access below.
  const snapshot = await db().collection("operationalMessageJobs")
    .where("studentUid", "==", studentUid)
    .limit(500)
    .get();

  const prior: PlainObject[] = snapshot.docs
    .map<PlainObject>(doc => ({ jobId: doc.id, ...object(doc.data() ?? {}) }))
    .filter(job => {
      const jobId = text(job.jobId, 200);
      const jobTargetDate = text(job.targetDate, 20);
      return jobId.startsWith("SPMSG_")
        && text(job.classId, 180) === classId
        && statusValue(job.specialType) === "신규"
        && /^\d{4}-\d{2}-\d{2}$/.test(jobTargetDate)
        && jobTargetDate < targetDate;
    })
    .sort((a, b) =>
      text(b.targetDate, 20).localeCompare(text(a.targetDate, 20))
      || Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0)
    );

  return prior[0] || null;
}

async function processSpecialAttendanceForDate735505(targetDateInput: string, actor: StaffCaller): Promise<PlainObject> {
  const targetDate = requireDate(targetDateInput, "발송 대상 수업일");
  const today = safeDate("");
  if (targetDate <= today) throw new HttpsError("failed-precondition", "신규·보강·반이동 알림톡은 오늘 이후의 미래 수업일에만 발송할 수 있습니다.");
  const catalog = await loadClassCatalog(targetDate);
  const catalogMap = new Map(catalog.map(item => [item.classId, item]));
  const audiencePolicy = await audienceNotificationPolicy7355034();
  const built = await buildAttendanceRosterInternal7355014(actor, { date: targetDate, className: "전체반" });
  const results: PlainObject[] = [];
  for (const row of built.rows) {
    const specialType = explicitSpecialType73550978(row);
    if (!["신규", "보강", "반이동", "일일특강"].includes(specialType)) continue;
    const classId = text(row.classId, 180), studentUid = text(row.studentUid, 160);
    const item = catalogMap.get(classId);
    if (!item || !studentUid) continue;
    if (specialType === "신규" || specialType === "반이동") {
      const entryStartDate = text(row.entryStartDate ?? row.enrollmentStartDate, 20);
      if (!entryStartDate || entryStartDate.slice(0, 7) !== targetDate.slice(0, 7) || !firstScheduledSessionOnOrAfter735505(item, entryStartDate, targetDate)) {
        results.push({ studentUid, classId, specialType, state: "skipped_not_month_first_session" });
        continue;
      }
    }
    const studentName = text(row.studentName, 120);
    const classroom = text(row.roomName ?? row.classroom, 100) || "데스크문의";
    const monthText = String(Number(targetDate.slice(5, 7))) + "월";
    const common = { studentName, specialType, classDate: targetDate, className: item.className, classroom, instructorName: item.instructorName, month: monthText,
      "학생명": studentName, "구분": specialType, "출결구분": specialType, "월": monthText, "수업일": targetDate,
      "반명": item.className, "수업명": item.className, "강의실": classroom, "담당강사": item.instructorName, "수신대상": "" };
    const studentPhone = normalizePhone(row.studentPhone);
    const classAudienceGroup = classAudience7355034(item);
    const studentNotificationAllowed = audiencePolicyAllows7355034(classAudienceGroup, audiencePolicy);
    if (!studentNotificationAllowed) results.push({ studentUid, classId, specialType, target: "student", state: "skipped_audience_disabled", audienceGroup: classAudienceGroup });
    else if (studentPhone) {
      const studentType = specialType === "보강" ? "special_makeup_student" : "special_new_move_student";
      const jobId = specialMessageJobId73550978(targetDate, classId, studentUid, specialType, "student");
      const legacyDone = await legacySpecialMessageAlreadyHandled73550978(targetDate, classId, studentUid, specialType, "student");
      if (!legacyDone && await claimSpecialMessageJob735505(jobId, { targetDate, classId, studentUid, specialType, target: "student", notificationScope: specialType === "신규" || specialType === "반이동" ? "month_first_session" : "selected_date" })) {
        try {
          const sent = await sendSolapiMessages(studentType, [{ phone: studentPhone, studentUid, target: "student", variables: { ...common, "수신대상": "학생" } }], { ...common, "수신대상": "학생" }, actor, jobId);
          await completeSpecialMessageJob735505(jobId, { state: "complete", deliveryId: sent.deliveryId, completedAtMs: Date.now(), completedAt: FieldValue.serverTimestamp() });
          results.push({ jobId, target: "student", state: "complete", deliveryId: sent.deliveryId });
        } catch (error) {
          const message = text(error instanceof Error ? error.message : error, 1200);
          const noRetry = Boolean((error as Error & { ulimNoAutoRetry?: boolean })?.ulimNoAutoRetry);
          const state = noRetry ? "delivery_unknown" : "failed";
          await completeSpecialMessageJob735505(jobId, { state, error: message }); results.push({ jobId, target: "student", state, error: message });
        }
      } else if (legacyDone) results.push({ studentUid, classId, specialType, target: "student", state: "skipped_legacy_already_handled" });
    } else results.push({ studentUid, classId, specialType, target: "student", state: "skipped_phone_missing" });

    const teacherPhones = await instructorPhones735505(item);
    for (const teacherPhone of teacherPhones) {
      const tail = teacherPhone.slice(-4);
      const jobId = specialMessageJobId73550978(targetDate, classId, studentUid, specialType, "teacher", tail);
      const legacyDone = await legacySpecialMessageAlreadyHandled73550978(targetDate, classId, studentUid, specialType, "teacher", tail);
      if (legacyDone || !(await claimSpecialMessageJob735505(jobId, { targetDate, classId, studentUid, specialType, target: "teacher", instructorUid: item.instructorUid, notificationScope: specialType === "신규" || specialType === "반이동" ? "month_first_session" : "selected_date" }))) continue;
      try {
        const sent = await sendSolapiMessages("special_teacher", [{ phone: teacherPhone, studentUid, target: "teacher", variables: { ...common, "수신대상": "강사" } }], { ...common, "수신대상": "강사" }, actor, jobId);
        await completeSpecialMessageJob735505(jobId, { state: "complete", deliveryId: sent.deliveryId, completedAtMs: Date.now(), completedAt: FieldValue.serverTimestamp() });
        results.push({ jobId, target: "teacher", state: "complete", deliveryId: sent.deliveryId });
      } catch (error) {
        const message = text(error instanceof Error ? error.message : error, 1200);
        const noRetry = Boolean((error as Error & { ulimNoAutoRetry?: boolean })?.ulimNoAutoRetry);
        const state = noRetry ? "delivery_unknown" : "failed";
        await completeSpecialMessageJob735505(jobId, { state, error: message }); results.push({ jobId, target: "teacher", state, error: message });
      }
    }
    if (!teacherPhones.length) results.push({ studentUid, classId, specialType, target: "teacher", state: "skipped_phone_missing" });
  }
  return { status: "success", targetDate, processed: results.length, complete: results.filter(row => row.state === "complete").length,
    failed: results.filter(row => row.state === "failed").length, results, version: FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION };
}

export const runSpecialAttendanceNotificationsAdmin735505 = onCall(MESSAGE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  requireFullAdmin(caller);
  const input = object(request.data);
  return processSpecialAttendanceForDate735505(text(input.targetDate, 20) || tomorrowSeoul735505(), caller);
});

export const processSpecialAttendanceNotificationsDaily735505 = onSchedule({
  schedule: "0,15,30,45 17-23 * * *", timeZone: "Asia/Seoul", region: ULIM_FUNCTION_REGION,
  retryCount: 0, timeoutSeconds: 540, memory: "1GiB", secrets: [ULIM_SOLAPI_OPERATIONAL_CONFIG]
}, async () => {
  const actor: StaffCaller = { firebaseUid: "system-special-message-735505", role: "superAdmin", authVersion: "uidv2", displayName: "자동발송", user: {} };
  await processSpecialAttendanceForDate735505(tomorrowSeoul735505(), actor);
});

async function revisionTrigger(reason: string, data: PlainObject): Promise<void> {
  await touchAttendanceRevision(reason, data);
  await refreshTodayTabletSnapshot(reason);
}
export const onStudentRosterRevision73550 = onDocumentWritten({ document: "students/{studentUid}", region: ULIM_FUNCTION_REGION }, async event => {
  await revisionTrigger("student_change", { studentUid: event.params.studentUid });
});
export const onEnrollmentRosterRevision73550 = onDocumentWritten({ document: "studentEnrollments/{enrollmentId}", region: ULIM_FUNCTION_REGION }, async event => {
  const data = event.data?.after.data() ?? event.data?.before.data() ?? {};
  await revisionTrigger("enrollment_change", { enrollmentId: event.params.enrollmentId, classId: text(data.classId, 180), studentUid: text(data.studentUid, 160) });
});
export const onAttendanceRevision73550 = onDocumentWritten({ document: "attendance/{recordId}", region: ULIM_FUNCTION_REGION }, async event => {
  const data = event.data?.after.data() ?? event.data?.before.data() ?? {};
  const date = text(data.sessionDate ?? data.date, 20);
  await touchAttendanceRevision("attendance_document_change", { recordId: event.params.recordId, classId: text(data.classId, 180), date });
  // Tablet-originated check-in patches its snapshot in the same operation path.
  // Other attendance mutations invalidate only that date; the next tablet callable/poll rebuilds
  // from the same canonical roster instead of serving a stale status snapshot.
  if (date && normalize(data.updatedByRole) !== "tablet") {
    await db().collection("tabletDailySnapshots").doc(date).set({
      version: "invalidated-attendance-7355049",
      invalidatedByAttendanceRecordId: event.params.recordId,
      invalidatedAtMs: Date.now(),
      invalidatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
});
export const onAttendanceOverrideRevision73550 = onDocumentWritten({ document: "attendanceSessionOverrides/{overrideId}", region: ULIM_FUNCTION_REGION }, async event => {
  const data = event.data?.after.data() ?? event.data?.before.data() ?? {};
  await revisionTrigger("attendance_override_change", { overrideId: event.params.overrideId, classId: text(data.classId, 180), date: text(data.date, 20) });
});
export const onClassScheduleRevision73550 = onDocumentWritten({ document: "classScheduleChanges/{changeId}", region: ULIM_FUNCTION_REGION }, async event => {
  const data = event.data?.after.data() ?? event.data?.before.data() ?? {};
  await revisionTrigger("class_schedule_document_change", { changeId: event.params.changeId, classId: text(data.classId, 180) });
});

export const rebuildTodayTabletRosterHourly73550 = onSchedule({
  schedule: "0 * * * *", timeZone: "Asia/Seoul", region: ULIM_FUNCTION_REGION, retryCount: 0, timeoutSeconds: 300, memory: "1GiB"
}, async () => {
  await applyDueCourseApplications7355028();
  await refreshTodayTabletSnapshot("hourly_roster_safety_refresh");
});

// 테스트에서 사용하는 순수 함수만 노출합니다.
export const __test73550 = { normalize, statusValue, weekdayForDate, hashId, secretEqual, classScheduledOnDate, effectiveClassesForDate, studentOperational };
