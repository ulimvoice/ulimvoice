import { createHash, timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, type DocumentData, type DocumentReference, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";

import type { UlimRole } from "../common/roles.js";
import { normalizeRealtimeAuthVersion, type RealtimeAuthVersion } from "../realtime/realtimeAuthVersion.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";
import {
  buildAttendanceRosterInternal7355014,
  buildClassListForDate7355014,
  buildTabletOperationalSnapshot73550,
  sendOperationalSolapiMessages7355014,
  sendTabletAttendanceSolapi7355014,
  ULIM_SOLAPI_OPERATIONAL_CONFIG_7355014,
  TABLET_CANONICAL_ROSTER_VERSION_7355049
} from "./firestorePrimaryOperations73550.js";

const VERSION = "2026-09-05.73550998-firestore-only-type-compatibility";
const TABLET_SNAPSHOT_VERSION = TABLET_CANONICAL_ROSTER_VERSION_7355049;
const ULIM_TABLET_KIOSK_KEY = defineSecret("ULIM_TABLET_KIOSK_KEY");
const TABLET_CALLABLE_OPTIONS = {
  region: ULIM_FUNCTION_REGION,
  cors: true,
  enforceAppCheck: false,
  timeoutSeconds: 45,
  memory: "256MiB" as const
};
const TABLET_DATA_CALLABLE_OPTIONS = {
  ...TABLET_CALLABLE_OPTIONS,
  timeoutSeconds: 90,
  memory: "512MiB" as const
};
const STAFF_ROLES = new Set<UlimRole>(["teacher", "admin", "superAdmin"]);
const FULL_ADMIN_ROLES = new Set<UlimRole>(["admin", "superAdmin"]);
const MAX_ROWS = 120;
const MAX_TEXT = 8000;
const OPERATIONAL_LOOKUP_VERSION = 1;
const TABLET_NOTIFICATION_LEASE_MS = 90_000;
const TABLET_NOTIFICATION_MAX_AGE_MS = 30 * 60 * 1000;
const lookupReadyCache = new Map<string, { ready: boolean; checkedAtMs: number }>();


type PlainObject = Record<string, unknown>;
type JobType = "attendance" | "dailyEvaluations";
type ImportDataset = "attendance" | "dailyEvaluations";

interface StaffCaller {
  firebaseUid: string;
  role: UlimRole;
  authVersion: RealtimeAuthVersion;
  teacherUid?: string;
  displayName: string;
  legacyAdminId: string;
  user: DocumentData;
}


interface TabletCaller {
  firebaseUid: string;
  kioskId: string;
  tabletDate: string;
}

function db() {
  return getFirestore(getOrInitializeDefaultFirebaseAdminApp());
}

function object(value: unknown): PlainObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as PlainObject;
}

function text(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalize(value: unknown): string {
  return text(value, 500)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\[\](){}<>~～\-_/\\:·.,'"`]/g, "");
}

function dateText(value: unknown): string {
  const result = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new HttpsError("invalid-argument", "날짜 형식이 올바르지 않습니다.");
  return result;
}

function requestId(value: unknown): string {
  const result = text(value, 140);
  if (!/^[0-9A-Za-z가-힣_.:-]{8,140}$/.test(result)) throw new HttpsError("invalid-argument", "requestId가 올바르지 않습니다.");
  return result;
}

function hashId(prefix: string, ...parts: unknown[]): string {
  const digest = createHash("sha256").update(parts.map(value => String(value ?? "")).join("\u001f"), "utf8").digest("hex").slice(0, 40);
  return `${prefix}_${digest}`;
}

function safeRole(value: unknown): UlimRole {
  const role = text(value, 30) as UlimRole;
  if (!STAFF_ROLES.has(role)) throw new HttpsError("permission-denied", "교직원 권한이 필요합니다.");
  return role;
}

function secretEquals(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function safeKioskId(value: unknown): string {
  const raw = text(value, 80).replace(/[^0-9A-Za-z_.:-]/g, "");
  return raw || "main-tablet";
}

// 태블릿 날짜는 Asia/Seoul의 실제 달력 날짜(00:00 전환)를 사용합니다.
function tabletSeoulDate(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function requireTablet(request: CallableRequest<unknown>): Promise<TabletCaller> {
  if (!request.auth || request.auth.token.tabletKiosk !== true) {
    throw new HttpsError("unauthenticated", "태블릿 인증이 필요합니다.");
  }
  const tabletDate = text(request.auth.token.tabletDate, 10);
  if (tabletDate !== tabletSeoulDate()) throw new HttpsError("unauthenticated", "태블릿 날짜 인증을 갱신해주세요.");
  return {
    firebaseUid: text(request.auth.uid, 128),
    kioskId: safeKioskId(request.auth.token.kioskId),
    tabletDate
  };
}

async function requireStaff(request: CallableRequest<unknown>): Promise<StaffCaller> {
  if (!request.auth) throw new HttpsError("unauthenticated", "Firebase 로그인이 필요합니다.");
  const firebaseUid = text(request.auth.uid, 128);
  const role = safeRole(request.auth.token.role);
  const authVersion = normalizeRealtimeAuthVersion(request.auth.token.authVersion);
  if (authVersion === null) throw new HttpsError("permission-denied", "인증 버전이 올바르지 않습니다.");
  const snap = await db().collection("users").doc(firebaseUid).get();
  if (!snap.exists) throw new HttpsError("permission-denied", "활성 사용자 문서가 없습니다.");
  const user = snap.data() ?? {};
  const storedAuthVersion = normalizeRealtimeAuthVersion(user.authVersion);
  if (user.active !== true || user.role !== role || storedAuthVersion !== authVersion) {
    throw new HttpsError("permission-denied", "로그인 권한이 변경되었습니다. 다시 로그인해주세요.");
  }
  const teacherUid = role === "teacher" ? text(request.auth.token.teacherUid, 128) : "";
  if (role === "teacher" && (!teacherUid || user.teacherUid !== teacherUid)) {
    throw new HttpsError("permission-denied", "강사 계정 정보가 일치하지 않습니다.");
  }
  let displayName = text(
    user.name ??
    user.displayName ??
    user.adminName ??
    user.teacherName ??
    request.auth.token.name ??
    request.auth.token.displayName ??
    request.auth.token.teacherName,
    100
  );
  if (!displayName && teacherUid) {
    const teacherSnapshot = await db().collection("teachers").doc(teacherUid).get();
    const teacher = teacherSnapshot.data() ?? {};
    displayName = text(teacher.name ?? teacher.teacherName ?? teacher.displayName, 100);
  }
  return {
    firebaseUid,
    role,
    authVersion,
    teacherUid: teacherUid || undefined,
    displayName,
    legacyAdminId: text(user.adminId ?? user.legacyAdminId ?? user.loginId, 100),
    user
  };
}

function extractTeacherName(className: string, instructor: string): string {
  const bracket = className.match(/\[\s*([^\]]+?)\s*T?\s*\]/i);
  if (bracket?.[1]) return bracket[1].replace(/T$/i, "").trim();
  return instructor.replace(/T$/i, "").trim();
}

function teacherIdentityKey(value: unknown): string {
  return normalize(
    text(value, 180)
      .replace(/^name:/i, "")
      .replace(/^\[|\]$/g, "")
      .replace(/(?:선생님|강사)$/g, "")
      .replace(/T$/i, "")
  );
}

function callerTeacherIdentityKeys(caller: StaffCaller): string[] {
  const values = [
    caller.displayName,
    caller.legacyAdminId,
    caller.user?.name,
    caller.user?.displayName,
    caller.user?.teacherName,
    caller.user?.adminName,
    caller.user?.adminId,
    caller.user?.legacyAdminId,
    caller.user?.loginId
  ];
  return Array.from(new Set(values.map(teacherIdentityKey).filter(Boolean)));
}

function recordTeacherIdentityKeys(record: DocumentData): string[] {
  const values = [
    record.instructor,
    record.instructorName,
    record.teacher,
    record.teacherName,
    extractTeacherName(text(record.className, 300), text(record.instructor ?? record.instructorName, 120)),
    text(record.teacherScopeKey, 180).replace(/^name:/i, ""),
    text(record.evaluatorTeacherKey, 180).replace(/^name:/i, "")
  ];
  return Array.from(new Set(values.map(teacherIdentityKey).filter(Boolean)));
}

function teacherKeysMatch(left: string[], right: string[]): boolean {
  return left.some(a => right.some(b => a === b || (a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a)))));
}

function teacherScopeMatches(actual: unknown, expected: unknown): boolean {
  const expectedText = text(expected, 180);
  if (!expectedText) return true;
  const actualText = text(actual, 180);
  if (actualText === expectedText) return true;
  const actualKey = teacherIdentityKey(actualText);
  const expectedKey = teacherIdentityKey(expectedText);
  return Boolean(actualKey && expectedKey && (actualKey === expectedKey || actualKey.includes(expectedKey) || expectedKey.includes(actualKey)));
}

function classCoreKey(value: unknown): string {
  let raw = text(value, 300);
  raw = raw.replace(/^\s*\[\s*[^\]]+?\s*\]\s*[-–—:]?\s*/i, "");
  raw = raw.replace(/^\s*[가-힣A-Za-z0-9_]{2,24}\s*T?\s*[-–—:]\s*/i, "");
  return normalize(raw);
}

function classMatchesFilter(record: DocumentData, filter: ReturnType<typeof filters>, caller: StaffCaller): boolean {
  const requested = normalize(filter.className);
  if (!requested || requested === normalize("전체반")) return true;

  const requestedClassId = text(filter.classId, 160);
  const recordClassId = text(record.classId, 160);
  if (requestedClassId && recordClassId) return requestedClassId === recordClassId;

  const recordName = text(record.className ?? record.currentClass, 300);
  if (normalize(recordName) === requested) return true;

  const requestedCore = classCoreKey(filter.className);
  const recordCore = classCoreKey(recordName);
  if (!requestedCore || !recordCore || requestedCore !== recordCore) return false;

  // 7.31.8: 같은 요일·과목·시간을 여러 강사가 담당하면 반 핵심명은 동일합니다.
  // 관리자 조회에서도 선택 반의 강사 범위를 반드시 비교하여 다른 강사 반이 섞이지 않게 합니다.
  const selectedKeys = Array.from(new Set([
    teacherIdentityKey(extractTeacherName(filter.className, "")),
    teacherIdentityKey(text(filter.teacherScopeKey, 180).replace(/^name:/i, ""))
  ].filter(Boolean)));
  const recordKeys = recordTeacherIdentityKeys(record);

  if (!selectedKeys.length || !recordKeys.length || !teacherKeysMatch(selectedKeys, recordKeys)) return false;

  if (caller.role === "teacher") {
    const callerKeys = callerTeacherIdentityKeys(caller);
    if (!teacherKeysMatch(callerKeys, selectedKeys) || !teacherKeysMatch(callerKeys, recordKeys)) return false;
  }
  return true;
}

function teacherScopeKey(className: string, instructor: string, explicit: unknown): string {
  const direct = text(explicit, 180);
  if (direct) return direct;
  const name = extractTeacherName(className, instructor);
  const key = normalize(name);
  return key ? `name:${key}` : "name:unknown";
}

function classIdFor(className: string, instructor: string, explicit: unknown): string {
const direct = text(explicit, 160); return direct || hashId("LEGCLS", normalize(className), teacherScopeKey(className, instructor, ""));
}

function operationalLookupKeys(
  date: string,
  classId: string,
  teacherUid: string,
  scopeKey: string
): string[] {
  const keys = [`date:${date}`];
  if (classId) keys.push(`dateClass:${date}|${classId}`);
  if (teacherUid) keys.push(`dateTeacher:${date}|${teacherUid}`);
  if (scopeKey) keys.push(`dateScope:${date}|${scopeKey}`);
  return Array.from(new Set(keys));
}

function classRevisionDocId(date: string, classId: string): string {
  return `${date}__${text(classId, 160).replace(/\//g, "_")}`;
}

function studentKey(row: PlainObject): string {
  const stable = text(row.studentUid ?? row.studentIdentityKey ?? row.identityKey, 180);
  if (stable) return stable;
  const phone = text(row.studentPhone, 60).replace(/\D/g, "");
  if (phone.length >= 8) return `phone:${phone}`;
  const no = text(row.studentNo ?? row.attendanceNo, 100);
  if (no) return `no:${normalize(no)}`;
  return `name:${normalize(row.studentName ?? row.name)}:${normalize(row.className)}`;
}


function normalizedAttendanceStatus(value: unknown): string {
  const raw = text(value, 60);
  const key = normalize(raw);
  if (/출석|present|^o$/.test(key)) return "출석";
  if (/결석|absent|^x$/.test(key)) return "결석";
  if (/지각|late/.test(key)) return "지각";
  return raw || "미체크";
}

function specialStatusText(...values: unknown[]): string {
  const raw = values.map(value => text(value, 120)).filter(Boolean).join(" ");
  const found: string[] = [];
  for (const word of ["보강", "신규", "반이동", "휴원"]) {
    if (raw.includes(word) && !found.includes(word)) found.push(word);
  }
  return found.join(" / ");
}

function attendanceStatusOnly(value: unknown): string {
  const status = normalizedAttendanceStatus(value);
  return ["출석", "결석", "지각"].includes(status) ? status : "";
}

function isLegacyAutoCurrentStatus(value: unknown): boolean {
  const raw = text(value, 500);
  return /^\d{4}-\d{2}-\d{2}\s+(?:재원|휴원|퇴원)\s+(?:출석|결석|지각)\s*[-–—:]?\s*$/.test(raw);
}

function manualCurrentStatus(value: unknown): string {
  const raw = text(value, 500);
  return isLegacyAutoCurrentStatus(raw) ? "" : raw;
}

function prepareAttendanceRow(raw: unknown, caller: StaffCaller): { docId: string; data: PlainObject; sheet: PlainObject } {
  const row = object(raw);
  const sessionDate = dateText(row.date ?? row.sessionDate ?? row.classDate);
  const className = text(row.className ?? row.currentClass, 300);
  const instructor = text(row.instructor ?? row.instructorName ?? caller.displayName, 120);
  const scopeKey = teacherScopeKey(className, instructor, row.teacherScopeKey);
  const classId = classIdFor(className, instructor, row.classId);
  const key = studentKey(row);
  const studentName = text(row.studentName ?? row.name, 120);
  if (!className || !studentName) throw new HttpsError("invalid-argument", "출석 기록의 반명 또는 학생명이 누락되었습니다.");
  if (caller.role === "teacher") {
    const callerName = normalize(caller.displayName);
    const rowTeacher = normalize(extractTeacherName(className, instructor));
    if (callerName && rowTeacher && callerName !== rowTeacher && !callerName.includes(rowTeacher) && !rowTeacher.includes(callerName)) {
      throw new HttpsError("permission-denied", "본인 담당 수업의 출석만 저장할 수 있습니다.");
    }
  }

  const status = attendanceStatusOnly(row.status ?? row.attendanceStatus) || "미체크";
  const specialStatus = specialStatusText(row.specialStatus, row.specialType, row.special, row.colorStatus);
  const currentStatusDirty = row.currentStatusDirty === true || row.remarkDirty === true || row.sheetRemarkDirty === true || row.__currentStatusDirty734310 === true ||
    [row.currentStatusDirty, row.remarkDirty, row.sheetRemarkDirty, row.__currentStatusDirty734310]
      .some(value => ["1", "true", "y", "yes"].includes(text(value, 10).toLowerCase()));
  const currentStatusValue = manualCurrentStatus(row.currentStatus ?? row.remarkText ?? row.sheetRemark);
  const docId = hashId("ATT", sessionDate, classId, key);
  const studentUid = text(row.studentUid, 160);
  const rowTeacherUid = text(row.teacherUid ?? (caller.role === "teacher" ? caller.teacherUid : ""), 160);

  const data: PlainObject = {
    sessionId: `${sessionDate}|${classId}`,
    sessionDate,
    date: sessionDate,
    classId,
    className,
    teacherScopeKey: scopeKey,
    teacherUid: rowTeacherUid,
    operationalLookupKeys: operationalLookupKeys(sessionDate, classId, rowTeacherUid, scopeKey),
    operationalLookupVersion: OPERATIONAL_LOOKUP_VERSION,
    instructor,
    studentUid,
    studentIdentityKey: text(row.studentIdentityKey, 180) || key,
    studentKey: key,
    studentName,
    studentNo: text(row.studentNo ?? row.attendanceNo, 100),
    studentPhone: text(row.studentPhone, 60),
    parentPhone: text(row.parentPhone, 60),
    status,
    attendanceStatus: status,
    specialStatus,
    currentStatusDirty: false,
    remarkDirty: false,
    sheetRemarkDirty: false,
    memo: text(row.memo, 2000),
    classroom: text(row.classroom ?? row.roomName ?? row.room, 100),
    sourceSheet: text(row.sourceSheet ?? row.sheetName, 200),
    sourceCell: text(row.sourceCell ?? row.cellA1, 100),
    sourceRow: Number(row.rowNumber ?? row.row ?? 0) || 0,
    active: true,
    sourceOfTruth: "firestore_operational",
    sheetSyncState: "backup_0600",
    updatedByFirebaseUid: caller.firebaseUid,
    updatedByRole: caller.role,
    updatedByName: caller.displayName,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
    schemaVersion: 4,
    version: VERSION
  };

  if (currentStatusDirty) {
    data.currentStatus = currentStatusValue;
    data.remarkText = currentStatusValue;
    data.sheetRemark = currentStatusValue;
    data.currentStatusUpdatedByFirebaseUid = caller.firebaseUid;
    data.currentStatusUpdatedByName = caller.displayName;
    data.currentStatusUpdatedAtMs = Date.now();
    data.currentStatusUpdatedAt = FieldValue.serverTimestamp();
  }

  const sheet: PlainObject = {
    ...row,
    date: sessionDate,
    classDate: sessionDate,
    className,
    currentClass: className,
    instructor,
    instructorName: instructor,
    studentName,
    name: studentName,
    status,
    attendanceStatus: status,
    specialStatus,
    specialType: specialStatus,
    special: specialStatus,
    currentStatusDirty,
    remarkDirty: currentStatusDirty,
    sheetRemarkDirty: currentStatusDirty,
    __currentStatusDirty734310: currentStatusDirty,
    studentIdentityKey: data.studentIdentityKey,
    studentUid,
    requestId: ""
  };

  if (currentStatusDirty) {
    sheet.currentStatus = currentStatusValue;
    sheet.remarkText = currentStatusValue;
    sheet.sheetRemark = currentStatusValue;
  } else {
    delete sheet.currentStatus;
    delete sheet.remarkText;
    delete sheet.sheetRemark;
    delete sheet.currentState;
  }

  return { docId, data, sheet };
}


function prepareDailyRow(raw: unknown, caller: StaffCaller): { docId: string; data: PlainObject; sheet: PlainObject } {
  const row = object(raw);
  const sessionDate = dateText(row.date ?? row.sessionDate);
  const className = text(row.className, 300);
  const instructor = text(row.instructor ?? row.instructorName, 120);
  const scopeKey = teacherScopeKey(className, instructor, row.teacherScopeKey);
  const classId = classIdFor(className, instructor, row.classId);
  const key = studentKey(row);
  const studentName = text(row.studentName ?? row.name, 120);
  if (!className || !studentName || scopeKey === "name:unknown") {
    throw new HttpsError("invalid-argument", "일일평가의 반명·담당강사·학생명을 확인해주세요.");
  }
  if (caller.role === "teacher") {
    const callerName = normalize(caller.displayName);
    const rowTeacher = normalize(extractTeacherName(className, instructor));
    if (callerName && rowTeacher && callerName !== rowTeacher && !callerName.includes(rowTeacher) && !rowTeacher.includes(callerName)) {
      throw new HttpsError("permission-denied", "본인 담당 수업의 일일평가만 저장할 수 있습니다.");
    }
  }
  const docId = hashId("DEV", sessionDate, classId, key, scopeKey);
  const studentUid = text(row.studentUid, 160);
  const rowTeacherUid = text(row.teacherUid ?? (caller.role === "teacher" ? caller.teacherUid : ""), 160);
  const clearEvaluation = row.clearEvaluation === true;
  const data: PlainObject = {
    sessionDate,
    date: sessionDate,
    classId,
    className,
    teacherScopeKey: scopeKey,
    evaluatorTeacherKey: scopeKey,
    teacherUid: rowTeacherUid,
    operationalLookupKeys: operationalLookupKeys(sessionDate, classId, rowTeacherUid, scopeKey),
    operationalLookupVersion: OPERATIONAL_LOOKUP_VERSION,
    instructor,
    studentUid,
    studentIdentityKey: text(row.studentIdentityKey, 180) || key,
    studentKey: key,
    studentName,
    studentNo: text(row.studentNo ?? row.attendanceNo, 100),
    studentPhone: text(row.studentPhone, 60),
    parentPhone: text(row.parentPhone, 60),
    attendanceStatus: attendanceStatusOnly(row.attendanceStatus ?? row.status),
    specialStatus: specialStatusText(row.specialStatus, row.specialType, row.enrollmentStatus, row.studentStatus),
    memo: text(row.memo, 2000),
    lessonContent: clearEvaluation ? "" : text(row.lessonContent, MAX_TEXT),
    lessonAttitude: clearEvaluation ? "" : text(row.lessonAttitude, MAX_TEXT),
    teacherComment: clearEvaluation ? "" : text(row.teacherComment, MAX_TEXT),
    videoLink: clearEvaluation ? "" : text(row.videoLink, 2000),
    evaluation: clearEvaluation ? "" : text(row.evaluation, 16000),
    clearEvaluation,
    active: !clearEvaluation,
    clearedAtMs: clearEvaluation ? Date.now() : FieldValue.delete(),
    clearedAt: clearEvaluation ? FieldValue.serverTimestamp() : FieldValue.delete(),
    sourceOfTruth: "firestore_operational",
    sheetSyncState: "backup_0600",
    updatedByFirebaseUid: caller.firebaseUid,
    updatedByRole: caller.role,
    updatedByName: caller.displayName,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
    schemaVersion: 3,
    version: VERSION
  };
  const sheet = {
    ...row,
    date: sessionDate,
    className,
    instructor,
    studentName,
    name: studentName,
    studentIdentityKey: data.studentIdentityKey,
    studentUid,
    attendanceStatus: data.attendanceStatus,
    lessonContent: clearEvaluation ? "" : text(row.lessonContent, MAX_TEXT),
    lessonAttitude: clearEvaluation ? "" : text(row.lessonAttitude, MAX_TEXT),
    teacherComment: clearEvaluation ? "" : text(row.teacherComment, MAX_TEXT),
    videoLink: clearEvaluation ? "" : text(row.videoLink, 2000),
    evaluation: clearEvaluation ? "" : text(row.evaluation, 16000),
    clearEvaluation,
    requestId: ""
  };
  return { docId, data, sheet };
}

function tabletAttendanceNo(data: DocumentData): string {
  return text(data.studentNo ?? data.attendanceNo, 100).replace(/\D/g, "");
}

function tabletCandidateKey(data: DocumentData): string {
  return text(data.studentUid ?? data.studentIdentityKey ?? data.studentKey, 180) ||
    `${tabletAttendanceNo(data)}|${normalize(data.studentName ?? data.name)}`;
}

function tabletClassEntry(docId: string, data: DocumentData): PlainObject {
  return {
    index: 0,
    recordId: docId,
    classId: text(data.classId, 160),
    className: text(data.className ?? data.currentClass, 300),
    instructor: text(data.instructor ?? data.instructorName, 120),
    roomName: text(data.classroom ?? data.roomName ?? data.room, 100) || "데스크문의",
    status: attendanceStatusOnly(data.status ?? data.attendanceStatus) || "미체크",
    specialStatus: specialStatusText(data.specialStatus, data.specialType, data.enrollmentStatus, data.studentStatus),
    memo: text(data.memo, 500)
  };
}

function buildTabletAttendanceMap(rows: Array<{ id: string; data: DocumentData }>): Record<string, PlainObject[]> {
  const attendanceMap: Record<string, PlainObject[]> = {};
  const candidateMaps = new Map<string, Map<string, PlainObject>>();

  for (const row of rows) {
    const data = row.data ?? {};
    if (data.active === false) continue;
    const attendanceNo = tabletAttendanceNo(data);
    const studentName = text(data.studentName ?? data.name, 120);
    if (!attendanceNo || !studentName) continue;
    if (!candidateMaps.has(attendanceNo)) candidateMaps.set(attendanceNo, new Map());
    const candidateMap = candidateMaps.get(attendanceNo)!;
    const candidateKey = tabletCandidateKey(data);
    let candidate = candidateMap.get(candidateKey);
    if (!candidate) {
      candidate = {
        name: studentName,
        studentName,
        studentUid: text(data.studentUid, 160),
        studentIdentityKey: text(data.studentIdentityKey ?? data.studentKey, 180),
        attendanceNo,
        classes: []
      };
      candidateMap.set(candidateKey, candidate);
    }
    const classes = candidate.classes as PlainObject[];
    if (!classes.some(item => text(item.recordId, 160) === row.id)) {
      classes.push(tabletClassEntry(row.id, data));
    }
  }

  for (const [attendanceNo, candidateMap] of candidateMaps.entries()) {
    const candidates = Array.from(candidateMap.values());
    candidates.forEach(candidate => {
      const classes = (candidate.classes as PlainObject[]).sort((a, b) =>
        text(a.className).localeCompare(text(b.className), "ko") || text(a.instructor).localeCompare(text(b.instructor), "ko")
      );
      classes.forEach((item, index) => { item.index = index; });
      if (classes.length === 1) {
        candidate.className = classes[0].className;
        candidate.instructor = classes[0].instructor;
        candidate.roomName = classes[0].roomName;
      }
    });
    candidates.sort((a, b) => text(a.name).localeCompare(text(b.name), "ko"));
    attendanceMap[attendanceNo] = candidates;
  }
  return attendanceMap;
}

async function rebuildTabletDailySnapshot(
  date: string,
  source: string,
  sourceRequestId: string
): Promise<PlainObject> {
  const canonical = await buildTabletOperationalSnapshot73550(date);
  const attendanceMap = object(canonical.attendanceMap);
  const payload: PlainObject = {
    status: "success",
    date,
    version: TABLET_SNAPSHOT_VERSION,
    attendanceMap,
    studentCount: Number(canonical.studentCount || 0),
    classCount: Number(canonical.classCount || canonical.count || 0),
    source: `canonical:${source}`,
    sourceRequestId,
    canonicalSource: text(canonical.source, 120),
    canonicalDiagnostics: object(canonical.diagnostics),
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await db().collection("tabletDailySnapshots").doc(date).set(payload, { merge: false });
  return payload;
}

export async function refreshTabletDailySnapshotsForStudentManagement7352(dates: string[], requestIdValue: string): Promise<string[]> {
  const refreshed: string[] = [];
  const uniqueDates = Array.from(new Set((dates || []).map(value => text(value, 10)).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value))));
  for (const date of uniqueDates) {
    await rebuildTabletDailySnapshot(date, "student_management_7355014", requestIdValue || hashId("TSR", date, Date.now()));
    refreshed.push(date);
  }
  return refreshed;
}

function cloneTabletAttendanceMap(value: unknown): PlainObject {
  try { return JSON.parse(JSON.stringify(object(value))) as PlainObject; }
  catch { return {}; }
}

function tabletSnapshotCandidateKey(candidate: PlainObject, attendanceNo: string): string {
  return text(candidate.studentUid ?? candidate.studentIdentityKey, 180) ||
    `${attendanceNo}|${normalize(candidate.studentName ?? candidate.name)}`;
}

function normalizeTabletSnapshotCandidates(map: PlainObject, attendanceNo: string): void {
  const raw = map[attendanceNo];
  const candidates = Array.isArray(raw) ? raw.map(object).filter(item => {
    const classes = Array.isArray(item.classes) ? item.classes.map(object) : [];
    classes.sort((a, b) => text(a.className).localeCompare(text(b.className), "ko") || text(a.instructor).localeCompare(text(b.instructor), "ko"));
    classes.forEach((entry, index) => { entry.index = index; });
    item.classes = classes;
    if (classes.length === 1) {
      item.className = classes[0].className;
      item.instructor = classes[0].instructor;
      item.roomName = classes[0].roomName;
    } else {
      delete item.className;
      delete item.instructor;
      delete item.roomName;
    }
    return classes.length > 0;
  }) : [];
  candidates.sort((a, b) => text(a.name ?? a.studentName).localeCompare(text(b.name ?? b.studentName), "ko"));
  if (candidates.length) map[attendanceNo] = candidates;
  else delete map[attendanceNo];
}

function patchTabletAttendanceMap(
  map: PlainObject,
  rows: Array<{ id: string; data: DocumentData }>
): PlainObject {
  const affected = new Set<string>();
  const targetIds = new Set(rows.map(row => row.id));

  Object.keys(map).forEach(attendanceNo => {
    const candidates = Array.isArray(map[attendanceNo]) ? (map[attendanceNo] as unknown[]).map(object) : [];
    candidates.forEach(candidate => {
      const before = Array.isArray(candidate.classes) ? candidate.classes.map(object) : [];
      const after = before.filter(entry => !targetIds.has(text(entry.recordId, 160)));
      if (after.length !== before.length) affected.add(attendanceNo);
      candidate.classes = after;
    });
    map[attendanceNo] = candidates;
  });

  rows.filter(row => row.data.active !== false).forEach(row => {
    const mini = buildTabletAttendanceMap([{ id: row.id, data: row.data }]);
    Object.keys(mini).forEach(attendanceNo => {
      affected.add(attendanceNo);
      const current = Array.isArray(map[attendanceNo]) ? (map[attendanceNo] as unknown[]).map(object) : [];
      const incoming = Array.isArray(mini[attendanceNo]) ? (mini[attendanceNo] as unknown[]).map(object) : [];
      incoming.forEach(candidate => {
        const key = tabletSnapshotCandidateKey(candidate, attendanceNo);
        let target = current.find(item => tabletSnapshotCandidateKey(item, attendanceNo) === key);
        if (!target) {
          target = { ...candidate, classes: [] };
          current.push(target);
        }
        const existingClasses = Array.isArray(target.classes) ? target.classes.map(object) : [];
        const incomingClasses = Array.isArray(candidate.classes) ? candidate.classes.map(object) : [];
        incomingClasses.forEach(entry => {
          if (!existingClasses.some(item => text(item.recordId, 160) === text(entry.recordId, 160))) existingClasses.push(entry);
        });
        target.classes = existingClasses;
      });
      map[attendanceNo] = current;
    });
  });

  affected.forEach(attendanceNo => normalizeTabletSnapshotCandidates(map, attendanceNo));
  return map;
}

async function patchTabletDailySnapshotRows(
  date: string,
  rows: Array<{ id: string; data: DocumentData }>,
  source: string,
  sourceRequestId: string
): Promise<boolean> {
  if (!date || !rows.length) return true;
  const ref = db().collection("tabletDailySnapshots").doc(date);
  return db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const map = patchTabletAttendanceMap(cloneTabletAttendanceMap(snap.data()?.attendanceMap), rows);
    const studentCount = Object.values(map).reduce<number>((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
    const classCount = Object.values(map).reduce<number>((sum, value) => sum + (Array.isArray(value)
      ? value.reduce((candidateSum, candidate) => candidateSum + (Array.isArray(object(candidate).classes) ? (object(candidate).classes as unknown[]).length : 0), 0)
      : 0), 0);
    tx.set(ref, {
      status: "success",
      date,
      version: TABLET_SNAPSHOT_VERSION,
      attendanceMap: map,
      studentCount,
      classCount,
      source,
      sourceRequestId,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return true;
  });
}

function publicTabletSnapshot(data: DocumentData, date: string): PlainObject {
  return {
    status: "success",
    date,
    version: TABLET_SNAPSHOT_VERSION,
    attendanceMap: object(data.attendanceMap),
    studentCount: Number(data.studentCount || 0),
    classCount: Number(data.classCount || 0),
    updatedAtMs: Number(data.updatedAtMs || 0),
    source: text(data.source, 100)
  };
}

function tabletSheetRow(current: DocumentData, date: string, status: string, requestIdValue: string): PlainObject {
  const className = text(current.className ?? current.currentClass, 300);
  const instructor = text(current.instructor ?? current.instructorName, 120);
  const studentName = text(current.studentName ?? current.name, 120);
  return {
    date,
    classDate: date,
    sessionDate: date,
    className,
    currentClass: className,
    classId: text(current.classId, 160),
    teacherScopeKey: text(current.teacherScopeKey, 180),
    teacherUid: text(current.teacherUid, 160),
    instructor,
    instructorName: instructor,
    studentUid: text(current.studentUid, 160),
    studentIdentityKey: text(current.studentIdentityKey ?? current.studentKey, 180),
    studentName,
    name: studentName,
    studentNo: text(current.studentNo ?? current.attendanceNo, 100),
    attendanceNo: text(current.studentNo ?? current.attendanceNo, 100),
    studentPhone: text(current.studentPhone, 60),
    parentPhone: text(current.parentPhone, 60),
    status,
    attendanceStatus: status,
    specialStatus: specialStatusText(current.specialStatus, current.specialType, current.enrollmentStatus, current.studentStatus),
    specialType: specialStatusText(current.specialStatus, current.specialType, current.enrollmentStatus, current.studentStatus),
    memo: text(current.memo, 2000),
    classroom: text(current.classroom ?? current.roomName ?? current.room, 100),
    roomName: text(current.classroom ?? current.roomName ?? current.room, 100),
    sourceSheet: text(current.sourceSheet ?? current.sheetName, 200),
    sheetName: text(current.sourceSheet ?? current.sheetName, 200),
    sourceCell: text(current.sourceCell ?? current.cellA1, 100),
    cellA1: text(current.sourceCell ?? current.cellA1, 100),
    rowNumber: Number(current.sourceRow ?? current.rowNumber ?? current.row ?? 0) || 0,
    currentStatusDirty: false,
    remarkDirty: false,
    sheetRemarkDirty: false,
    __currentStatusDirty734310: false,
    requestId: requestIdValue
  };
}

function resolveTabletSnapshotClass(
  snapshotData: DocumentData,
  attendanceNo: string,
  studentName: string,
  recordId: string,
  className: string,
  classIndex: number
): PlainObject | null {
  const map = object(snapshotData.attendanceMap);
  const candidatesRaw = map[attendanceNo];
  const candidates = Array.isArray(candidatesRaw) ? candidatesRaw.map(object) : [];
  const normalizedStudent = normalize(studentName);
  const candidate = candidates.find(item => !normalizedStudent || normalize(item.studentName ?? item.name) === normalizedStudent) ||
    (candidates.length === 1 ? candidates[0] : null);
  if (!candidate) return null;
  const classesRaw = candidate.classes;
  const classes = Array.isArray(classesRaw) ? classesRaw.map(object) : [];
  const normalizedClass = normalize(className);
  let selected = classes.find(item => recordId && text(item.recordId, 160) === recordId) || null;
  if (!selected && normalizedClass) selected = classes.find(item => normalize(item.className) === normalizedClass) || null;
  if (!selected && Number.isInteger(classIndex) && classIndex >= 0 && classIndex < classes.length) selected = classes[classIndex];
  if (!selected && classes.length === 1) selected = classes[0];
  if (!selected) return null;
  return { candidate, selected };
}

function revisionField(type: JobType): "attendanceRevision" | "dailyRevision" {
  return type === "attendance" ? "attendanceRevision" : "dailyRevision";
}

function revisionChangedAtField(type: JobType): "attendanceChangedAtMs" | "dailyChangedAtMs" {
  return type === "attendance" ? "attendanceChangedAtMs" : "dailyChangedAtMs";
}

function revisionPatch(
  date: string,
  type: JobType,
  nowMs: number,
  source: string,
  requestIdValue: string,
  actor?: StaffCaller
): PlainObject {
  return {
    date,
    [revisionField(type)]: FieldValue.increment(1),
    [revisionChangedAtField(type)]: nowMs,
    lastMutationType: type,
    lastMutationSource: source,
    lastMutationRequestId: requestIdValue,
    lastMutationFirebaseUid: actor?.firebaseUid ?? "",
    lastMutationRole: actor?.role ?? "system",
    lastMutationName: actor?.displayName ?? "",
    updatedAtMs: nowMs,
    updatedAt: FieldValue.serverTimestamp(),
    version: VERSION
  };
}

function classRevisionPatch(
  date: string,
  classId: string,
  type: JobType,
  nowMs: number,
  source: string,
  requestIdValue: string,
  actor?: StaffCaller
): PlainObject {
  return {
    ...revisionPatch(date, type, nowMs, source, requestIdValue, actor),
    classId,
    revisionScope: "class"
  };
}

async function touchClassOperationalRevisions(
  date: string,
  classIds: string[],
  datasets: ImportDataset[],
  source: string,
  requestIdValue: string
): Promise<void> {
  const unique = Array.from(new Set(classIds.map(value => text(value, 160)).filter(Boolean)));
  if (!unique.length) return;
  const nowMs = Date.now();
  for (let offset = 0; offset < unique.length; offset += 400) {
    const batch = db().batch();
    unique.slice(offset, offset + 400).forEach(classId => {
      const patch: PlainObject = {
        date,
        classId,
        revisionScope: "class",
        lastMutationSource: source,
        lastMutationRequestId: requestIdValue,
        updatedAtMs: nowMs,
        updatedAt: FieldValue.serverTimestamp(),
        version: VERSION
      };
      if (datasets.includes("attendance")) {
        patch.attendanceRevision = FieldValue.increment(1);
        patch.attendanceChangedAtMs = nowMs;
      }
      if (datasets.includes("dailyEvaluations")) {
        patch.dailyRevision = FieldValue.increment(1);
        patch.dailyChangedAtMs = nowMs;
      }
      batch.set(db().collection("staffOperationalClassRevisions").doc(classRevisionDocId(date, classId)), patch, { merge: true });
    });
    await batch.commit();
  }
}

async function touchOperationalRevisions(
  date: string,
  datasets: ImportDataset[],
  source: string,
  requestIdValue: string,
  classIds: string[] = []
): Promise<void> {
  const nowMs = Date.now();
  const patch: PlainObject = {
    date,
    lastMutationSource: source,
    lastMutationRequestId: requestIdValue,
    updatedAtMs: nowMs,
    updatedAt: FieldValue.serverTimestamp(),
    version: VERSION
  };
  if (datasets.includes("attendance")) {
    patch.attendanceRevision = FieldValue.increment(1);
    patch.attendanceChangedAtMs = nowMs;
  }
  if (datasets.includes("dailyEvaluations")) {
    patch.dailyRevision = FieldValue.increment(1);
    patch.dailyChangedAtMs = nowMs;
  }
  await db().collection("staffOperationalRevisions").doc(date).set(patch, { merge: true });
  await touchClassOperationalRevisions(date, classIds, datasets, source, requestIdValue);
}

const CLASS_OPERATIONAL_SETTINGS_COLLECTION_7355024 = "classOperationalSettings";

async function readClassVideoLinkSetting7355024(classId: string): Promise<string> {
  const id = text(classId, 180);
  if (!id) return "";
  const snap = await db().collection(CLASS_OPERATIONAL_SETTINGS_COLLECTION_7355024).doc(id).get();
  return snap.exists ? text(snap.data()?.videoLink, 2000) : "";
}

async function writeClassVideoLinkSetting7355024(
  classId: string,
  className: string,
  videoLink: string,
  caller: StaffCaller,
  requestIdValue: string
): Promise<void> {
  const id = text(classId, 180);
  if (!id) throw new HttpsError("invalid-argument", "수업영상 링크를 저장할 반 ID가 없습니다.");
  const nowMs = Date.now();
  await db().collection(CLASS_OPERATIONAL_SETTINGS_COLLECTION_7355024).doc(id).set({
    classId: id,
    className: text(className, 300),
    videoLink: text(videoLink, 2000),
    lastMutationRequestId: requestIdValue,
    updatedByFirebaseUid: caller.firebaseUid,
    updatedByName: caller.displayName,
    updatedAtMs: nowMs,
    updatedAt: FieldValue.serverTimestamp(),
    version: VERSION
  }, { merge: true });
}

async function overlayClassVideoLinks7355024(rows: PlainObject[]): Promise<PlainObject[]> {
  const source = Array.isArray(rows) ? rows : [];
  const pairs = await Promise.all(source.map(async row => {
    const id = text(row.classId, 180);
    if (!id) return { ...row };
    const persistent = await readClassVideoLinkSetting7355024(id);
    return { ...row, videoLink: persistent || text(row.videoLink, 2000) };
  }));
  return pairs;
}

async function saveOperational(
  request: CallableRequest<unknown>,
  type: JobType
): Promise<PlainObject> {
const caller = await requireStaff(request);
  const input = object(request.data);
  const rid = requestId(input.requestId);

  // 73551006R2-daily-eval-link-alimtalk: class video link is a class-level setting, not a zero-row daily evaluation.
  if (type === "dailyEvaluations" && input.classVideoLinkOnly === true) {
    const date = dateText(input.date);
    const classId = text(input.classId, 180);
    const requestedClassName = text(input.className, 300);
    const videoLink = text(input.videoLink, 2000);
    if (!classId) throw new HttpsError("invalid-argument", "수업영상 링크를 저장할 반 ID가 없습니다.");
    const visibleClasses = await buildClassListForDate7355014(caller, date);
    const selectedClass = visibleClasses.find(item => text(item.classId, 180) === classId);
    if (!selectedClass) throw new HttpsError("permission-denied", "해당 반의 수업영상 링크를 변경할 권한이 없습니다.");
    const className = text(selectedClass.className, 300) || requestedClassName;
    await writeClassVideoLinkSetting7355024(classId, className, videoLink, caller, rid);
    await touchOperationalRevisions(date, ["dailyEvaluations"], "class_video_link_only_73551006", rid, [classId]);
    return {
      status: "success",
      requestId: rid,
      classVideoLinkOnly: true,
      count: 0,
      classId,
      className,
      videoLink,
      dataAuthority: "firestore",
      message: "수업영상 링크를 저장했습니다."
    };
  }

  const rowsRaw = Array.isArray(input.rows) ? input.rows : [];
  if (!rowsRaw.length || rowsRaw.length > MAX_ROWS) throw new HttpsError("invalid-argument", "저장할 기록 수가 올바르지 않습니다.");
  const prepared = rowsRaw.map(row => type === "attendance" ? prepareAttendanceRow(row, caller) : prepareDailyRow(row, caller));
  const targetCollection = type === "attendance" ? "attendance" : "dailyEvaluations";
  const requestRef = db().collection("staffOperationalWriteRequests").doc(rid);
  const targetRefs = prepared.map(row => db().collection(targetCollection).doc(row.docId));
  const nowMs = Date.now();
  let reused = false;
  await db().runTransaction(async tx => {
    const existing = await tx.get(requestRef);
    if (existing.exists) {
      const old = existing.data() ?? {};
      if (old.createdByFirebaseUid !== caller.firebaseUid) throw new HttpsError("already-exists", "다른 계정이 사용한 저장 요청ID입니다.");
      // 73551007R2-daily-notification-resume-audit: request replay is allowed only for the exact same target set.
      const oldTargetDocIds = Array.isArray(old.targetDocIds) ? old.targetDocIds.map((value: unknown) => text(value, 220)).filter(Boolean).sort() : [];
      const incomingTargetDocIds = prepared.map(row => row.docId).slice().sort();
      if (
        oldTargetDocIds.length !== incomingTargetDocIds.length ||
        oldTargetDocIds.some((value: string, index: number) => value !== incomingTargetDocIds[index])
      ) {
        throw new HttpsError("already-exists", "같은 저장 요청ID에 다른 일일평가 대상을 사용할 수 없습니다.");
      }
      reused = true; return;
    }
    prepared.forEach((row,index)=>tx.set(targetRefs[index], { ...row.data, sourceOfTruth: "firestore_operational", sheetSyncState: "backup_only", sheetSyncRequestId: FieldValue.delete(), dataAuthority: "firestore" }, { merge: true }));
    tx.create(requestRef,{ requestId: rid, type, state: "complete", dataAuthority: "firestore", notificationRequested: type === "dailyEvaluations" && input.sendSms === true, targetCollection, targetDocIds: prepared.map(row=>row.docId), createdByFirebaseUid: caller.firebaseUid, createdByRole: caller.role, createdAtMs: nowMs, updatedAtMs: nowMs, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), version: VERSION });
    const dates = Array.from(new Set(prepared.map(row => text(row.data.sessionDate,10)).filter(Boolean)));
    dates.forEach(date=>tx.set(db().collection("staffOperationalRevisions").doc(date), revisionPatch(date,type,nowMs,"firestore_operational_save_73550993",rid,caller), { merge:true }));
    const scopes=new Map<string,{date:string;classId:string}>();prepared.forEach(row=>{const date=text(row.data.sessionDate,10),classId=text(row.data.classId,160);if(date&&classId)scopes.set(`${date}|${classId}`,{date,classId})});
    scopes.forEach(scope=>tx.set(db().collection("staffOperationalClassRevisions").doc(classRevisionDocId(scope.date,scope.classId)), classRevisionPatch(scope.date,scope.classId,type,nowMs,"firestore_operational_save_73550993",rid,caller), { merge:true }));
  });
  if (type === "attendance") {
    const byDate = new Map<string, Array<{ id: string; data: DocumentData }>>(); prepared.forEach(row=>{const date=text(row.data.sessionDate,10);if(!date)return;if(!byDate.has(date))byDate.set(date,[]);byDate.get(date)!.push({id:row.docId,data:row.data})});
    for (const [date,rows] of byDate.entries()) try { const patched=await patchTabletDailySnapshotRows(date,rows,"staff_firestore_save",rid); if(!patched) await rebuildTabletDailySnapshot(date,"staff_firestore_save_missing_snapshot",rid); } catch {}
  }
  // 73551007 R2A installer fix: keep notification metadata in saveOperational function scope.
  let notificationRecipientTypes73551007: string[] = [];
  let notificationTargets73551007: Array<"student" | "parent" | "teacher" | "admin"> = [];
  const notificationResults: PlainObject[] = [];
  if (type === "dailyEvaluations" && input.sendSms === true) {
    notificationRecipientTypes73551007 = Array.isArray(input.recipientTypes) ? input.recipientTypes.map(v=>text(v,60)).filter(Boolean) : [];
    // 73551009R1A-daily-teacher-admin-recipients
    const normalizeRecipientTarget73551007 = (value: string): "student" | "parent" | "teacher" | "admin" | "" => {
      const key = normalize(value);
      if (key === "student" || key === normalize("학생") || key.includes("student") || key.includes(normalize("학생"))) return "student";
      if (key === "parent" || key === normalize("학부모") || key === normalize("부모") || key.includes("parent") || key.includes(normalize("학부모")) || key.includes(normalize("부모"))) return "parent";
      if (key === "teacher" || key === normalize("담당강사") || key === normalize("강사") || key.includes("teacher") || key.includes(normalize("담당강사"))) return "teacher";
      if (key === "admin" || key === normalize("관리자") || key.includes("admin") || key.includes(normalize("관리자"))) return "admin";
      return "";
    };
    notificationTargets73551007 = Array.from(new Set(
      (notificationRecipientTypes73551007.length ? notificationRecipientTypes73551007 : ["student","parent"])
        .map(normalizeRecipientTarget73551007)
        .filter((value): value is "student" | "parent" | "teacher" | "admin" =>
          value === "student" || value === "parent" || value === "teacher" || value === "admin")
    ));
    if (!notificationTargets73551007.length) {
      throw new HttpsError("invalid-argument", "일일평가 알림톡 수신대상을 선택해주세요.");
    }

    const staffDirectory73551009: PlainObject[] = [];
    if (notificationTargets73551007.includes("teacher") || notificationTargets73551007.includes("admin")) {
      const staffSnapshot73551009 = await db().collection("users").limit(500).get();
      staffSnapshot73551009.docs.forEach(doc => {
        const user = object(doc.data() ?? {});
        if (user.active === false) return;
        const phone = text(user.phone ?? user.phoneNumber ?? user.mobile ?? user.tel, 60);
        if (!phone) return;
        staffDirectory73551009.push({
          docId: doc.id,
          firebaseUid: text(user.firebaseUid ?? user.uid, 160) || doc.id,
          teacherUid: text(user.teacherUid, 160),
          name: text(user.name ?? user.displayName ?? user.teacherName, 120),
          role: text(user.role ?? user.firebaseRole, 40),
          phone
        });
      });
    }
    const activeAdminRecipients73551009 = staffDirectory73551009.filter(user => {
      const role = normalize(user.role);
      return role === "admin" ||
        role === "superadmin" ||
        role === normalize("관리자") ||
        role === normalize("전체관리자") ||
        role === normalize("전체관리") ||
        role === normalize("원장");
    });
    for (const row of prepared) {
      const data=object(row.data), studentUid=text(data.studentUid,160), studentName=text(data.studentName,120), classId=text(data.classId,160), className=text(data.className,300), instructorName=text(data.instructor ?? data.instructorName,120), date=text(data.sessionDate ?? data.date,20);
      const lessonContent = text(data.lessonContent, 8000);
      const lessonAttitude = text(data.lessonAttitude, 8000);
      const teacherComment = text(data.teacherComment, 8000);
      const evaluation = text(data.evaluation, 16000);
      const attendanceType73551010 =
        attendanceStatusOnly(data.attendanceStatus ?? data.status) ||
        text(data.attendanceStatus ?? data.status, 60) ||
        "미체크";
      const specialType = text(data.specialStatus, 60);
      const persistentVideoLink = classId ? await readClassVideoLinkSetting7355024(classId) : "";
      const videoLink = text(data.videoLink, 2000) || persistentVideoLink;
      if (!lessonContent && !lessonAttitude && !teacherComment && !videoLink && !evaluation) {
        notificationResults.push({studentUid,classId,state:"skipped_empty_daily_payload"});
        continue;
      }
      const common: PlainObject={
        studentName,date,classId,className,instructorName,evaluation,lessonContent,lessonAttitude,teacherComment,videoLink,
        messageText:evaluation,
        "학생명":studentName,
        "수업일":date,
        "반명":className,
        "수업명":className,
        "담당강사":instructorName,
        // 73551011R1-daily-attendance-template-alias
        "구분":attendanceType73551010,
        "출결상태":attendanceType73551010,
        "출석여부":attendanceType73551010,
        "출결여부":attendanceType73551010,
        "출결구분":attendanceType73551010,
        // 73551008R1-daily-approved-template-variable-aliases
        "이번주 수업":lessonContent,
        "이번주수업":lessonContent,
        "수업내용":lessonContent,
        "수업 활동 및 태도":lessonAttitude,
        "수업활동 및 태도":lessonAttitude,
        "수업태도":lessonAttitude,
        "선생님 전달 사항":teacherComment,
        "선생님 전달사항":teacherComment,
        "전달사항":teacherComment,
        "수업영상 확인 링크":videoLink,
        "수업영상링크":videoLink,
        "영상링크":videoLink,
        "평가내용":evaluation
      };
      const recipients: PlainObject[] = [];
      const pushRecipient73551009 = (phoneInput: unknown, target: string) => {
        const phone = text(phoneInput, 60);
        if (!phone) return;
        recipients.push({ phone, studentUid, target, classId, className, variables: common });
      };
      for (const target of notificationTargets73551007) {
        if (target === "student") {
          pushRecipient73551009(data.studentPhone, "student");
          continue;
        }
        if (target === "parent") {
          pushRecipient73551009(data.parentPhone, "parent");
          continue;
        }
        if (target === "admin") {
          activeAdminRecipients73551009.forEach(user => pushRecipient73551009(user.phone, "admin"));
          continue;
        }
        if (target === "teacher") {
          const rowTeacherUid = text(data.teacherUid ?? data.instructorUid, 160);
          let teacherRecipients: PlainObject[] = rowTeacherUid
            ? staffDirectory73551009.filter(user => {
                const ids = [user.docId, user.firebaseUid, user.teacherUid]
                  .map(value => text(value, 160))
                  .filter(Boolean);
                return ids.includes(rowTeacherUid);
              })
            : [];
          if (!teacherRecipients.length && instructorName) {
            const exactNameMatches = staffDirectory73551009.filter(user =>
              normalize(user.name) === normalize(instructorName)
            );
            if (exactNameMatches.length === 1) teacherRecipients = exactNameMatches;
          }
          const seenTeacherPhones = new Set<string>();
          teacherRecipients.forEach(user => {
            const normalizedPhone = text(user.phone, 60).replace(/\D/g, "");
            if (!normalizedPhone || seenTeacherPhones.has(normalizedPhone)) return;
            seenTeacherPhones.add(normalizedPhone);
            pushRecipient73551009(user.phone, "teacher");
          });
        }
      }
      if(!recipients.length){notificationResults.push({studentUid,classId,state:"skipped_phone_missing"});continue}
      try {
        const sent=await sendOperationalSolapiMessages7355014("daily_evaluation",recipients,common,{firebaseUid:caller.firebaseUid,role:caller.role,teacherUid:caller.teacherUid,displayName:caller.displayName,dispatchKey:`daily-evaluation|${rid}|${row.docId}`});
        const sentData=object(sent);
        const sentCount=Number(sentData.sent||0);
        const reason=text(sentData.reason,120);
        const duplicateSuppressed=sentData.duplicateSuppressed === true;
        const skipped=sentData.skipped === true;
        const state=duplicateSuppressed
          ? "duplicate_suppressed"
          : skipped && reason === "AUDIENCE_NOTIFICATIONS_DISABLED"
            ? "skipped_audience_policy"
            : skipped
              ? "skipped"
              : "complete";
        notificationResults.push({
          studentUid,classId,state,sent:sentCount,
          reason,
          suppressed:Number(sentData.suppressed||0),
          deliveryId:text(sentData.deliveryId,180)
        });
      }
      catch(error){ notificationResults.push({studentUid,classId,state:"failed",error:text(error instanceof Error?error.message:error,1200)}); }
    }
  }
  let notificationSummary: PlainObject = {};
  if (type === "dailyEvaluations" && input.sendSms === true) {
    const sentCount = notificationResults.reduce((sum,row)=>sum+Number(object(row).sent||0),0);
    const failedCount = notificationResults.filter(row=>text(object(row).state,60)==="failed").length;
    const skippedCount = notificationResults.filter(row=>text(object(row).state,60).startsWith("skipped")).length;
    const duplicateCount = notificationResults.filter(row=>text(object(row).state,60)==="duplicate_suppressed").length;
    const notificationState = failedCount > 0 ? "partial_failed" : sentCount > 0 ? "complete" : duplicateCount > 0 && skippedCount === 0 ? "duplicate_suppressed" : "skipped";
    notificationSummary = { sentCount, failedCount, skippedCount, duplicateCount, state: notificationState };
    try {
      await requestRef.set({
        notificationState,
        notificationResults,
        notificationSentCount: sentCount,
        notificationFailedCount: failedCount,
        notificationSkippedCount: skippedCount,
        notificationDuplicateCount: duplicateCount,
        notificationRecipientTypes: notificationRecipientTypes73551007,
        notificationTargets: notificationTargets73551007,
        notificationUpdatedAtMs: Date.now(),
        notificationUpdatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch {}
  }
  const dailyMessage = input.sendSms === true
    ? `일일평가 ${prepared.length}건 저장 완료 / 알림톡 ${Number(notificationSummary.sentCount||0)}건 접수${Number(notificationSummary.failedCount||0) ? ` / 실패 ${Number(notificationSummary.failedCount||0)}건` : ""}${Number(notificationSummary.skippedCount||0) ? ` / 차단-건너뜀 ${Number(notificationSummary.skippedCount||0)}건` : ""}`
    : `일일평가 ${prepared.length}건 저장 완료`;
  return { status:"success",requestId:rid,count:prepared.length,reused,dataAuthority:"firestore",sheetSyncState:"backup_only",notificationResults,notificationSummary,message:type === "attendance" ? `출석 ${prepared.length}건 저장 완료` : dailyMessage };
}

export const saveStaffAttendanceOperational = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  request => saveOperational(request, "attendance")
);

export const saveStaffDailyEvaluationsOperational = onCall(
  { ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS, timeoutSeconds: 180, memory: "512MiB", secrets: [ULIM_SOLAPI_OPERATIONAL_CONFIG_7355014] },
  request => saveOperational(request, "dailyEvaluations")
);

function recordVisibleToCaller(record: DocumentData, caller: StaffCaller): boolean {
  if (FULL_ADMIN_ROLES.has(caller.role)) return true;
  if (caller.role !== "teacher") return false;

  const teacherUid = text(record.teacherUid, 160);
  if (teacherUid && caller.teacherUid && teacherUid === caller.teacherUid) return true;

  const callerKeys = callerTeacherIdentityKeys(caller);
  const recordKeys = recordTeacherIdentityKeys(record);
  return Boolean(callerKeys.length && recordKeys.length && teacherKeysMatch(callerKeys, recordKeys));
}

async function backfillVisibleTeacherUid(
  refs: DocumentReference[],
  caller: StaffCaller
): Promise<void> {
  if (caller.role !== "teacher" || !caller.teacherUid || !refs.length) return;
  const uniqueRefs = Array.from(new Map(refs.map(ref => [ref.path, ref])).values()).slice(0, 400);
  const batch = db().batch();
  uniqueRefs.forEach(ref => {
    batch.set(ref, {
      teacherUid: caller.teacherUid,
      teacherBindingSource: "verified_teacher_read_73107",
      teacherBindingUpdatedAtMs: Date.now(),
      teacherBindingUpdatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  try {
    await batch.commit();
  } catch (error) {
    console.warn("[ULIM staff 7.31.7 teacherUid backfill]", error);
  }
}


function mapAttendanceDoc(data: DocumentData): PlainObject {
  const currentStatus = manualCurrentStatus(data.currentStatus ?? data.remarkText ?? data.sheetRemark);
  return {
    ...data,
    date: text(data.sessionDate ?? data.date, 10),
    classDate: text(data.sessionDate ?? data.date, 10),
    studentName: text(data.studentName, 120),
    name: text(data.studentName, 120),
    status: attendanceStatusOnly(data.status ?? data.attendanceStatus) || "미체크",
    attendanceStatus: attendanceStatusOnly(data.attendanceStatus ?? data.status) || "미체크",
    specialStatus: specialStatusText(data.specialStatus, data.specialType, data.special, data.colorStatus),
    currentStatus,
    remarkText: currentStatus,
    sheetRemark: currentStatus,
    currentStatusDirty: false,
    remarkDirty: false,
    sheetRemarkDirty: false,
    rowNumber: data.sourceRow ?? data.rowNumber ?? 0,
    row: data.sourceRow ?? data.row ?? 0,
    sheetName: text(data.sourceSheet ?? data.sheetName, 200),
    cellA1: text(data.sourceCell ?? data.cellA1, 100)
  };
}

function filters(input: PlainObject) {
  return {
    date: dateText(input.date),
    className: text(input.className, 300),
    classId: text(input.classId, 160),
    keyword: normalize(input.keyword),
    status: normalize(input.statusFilter),
    teacherScopeKey: text(input.teacherScopeKey, 180)
  };
}

async function operationalLookupReady(date: string, type: JobType): Promise<boolean> {
  const cacheKey = `${date}|${type}`;
  const cached = lookupReadyCache.get(cacheKey);
  if (cached && Date.now() - cached.checkedAtMs < 5 * 60 * 1000) return cached.ready;
  const snap = await db().collection("staffOperationalIndexes").doc(date).get();
  const data = snap.data() ?? {};
  const field = type === "attendance" ? "attendanceLookupReady" : "dailyLookupReady";
  const ready = data[field] === true && Number(data.lookupVersion || 0) >= OPERATIONAL_LOOKUP_VERSION;
  lookupReadyCache.set(cacheKey, { ready, checkedAtMs: Date.now() });
  return ready;
}

function selectedOperationalLookupKey(f: ReturnType<typeof filters>, caller: StaffCaller): string {
  if (f.classId) return `dateClass:${f.date}|${f.classId}`;
  if (caller.role === "teacher" && caller.teacherUid) return `dateTeacher:${f.date}|${caller.teacherUid}`;
  if (f.teacherScopeKey) return `dateScope:${f.date}|${f.teacherScopeKey}`;
  return `date:${f.date}`;
}

async function backfillOperationalLookupKeys(
  collection: "attendance" | "dailyEvaluations",
  type: JobType,
  date: string,
  docs: QueryDocumentSnapshot<DocumentData>[]
): Promise<void> {
  for (let offset = 0; offset < docs.length; offset += 400) {
    const batch = db().batch();
    docs.slice(offset, offset + 400).forEach(doc => {
      const data = doc.data() ?? {};
      batch.set(doc.ref, {
        operationalLookupKeys: operationalLookupKeys(
          date,
          text(data.classId, 160),
          text(data.teacherUid, 160),
          text(data.teacherScopeKey ?? data.evaluatorTeacherKey, 180)
        ),
        operationalLookupVersion: OPERATIONAL_LOOKUP_VERSION
      }, { merge: true });
    });
    await batch.commit();
  }
  await markOperationalLookupReady(
    date,
    [type === "attendance" ? "attendance" : "dailyEvaluations"],
    hashId("LOOKUP-BACKFILL", date, type, Date.now())
  );
}

async function queryOperationalDocuments(
  collection: "attendance" | "dailyEvaluations",
  type: JobType,
  f: ReturnType<typeof filters>,
  caller: StaffCaller
): Promise<{ docs: QueryDocumentSnapshot<DocumentData>[]; optimized: boolean; lookupKey: string }> {
  const lookupKey = selectedOperationalLookupKey(f, caller);
  if (await operationalLookupReady(f.date, type)) {
    const optimized = await db().collection(collection)
      .where("operationalLookupKeys", "array-contains", lookupKey)
      .get();
    return { docs: optimized.docs, optimized: true, lookupKey };
  }
  const legacy = await db().collection(collection).where("sessionDate", "==", f.date).get();
  try { await backfillOperationalLookupKeys(collection, type, f.date, legacy.docs); }
  catch { /* 첫 조회 결과는 그대로 반환하고 다음 조회에서 다시 인덱스 준비를 시도합니다. */ }
  return { docs: legacy.docs, optimized: false, lookupKey };
}

async function markOperationalLookupReady(
  date: string,
  datasets: ImportDataset[],
  requestIdValue: string
): Promise<void> {
  const patch: PlainObject = {
    date,
    lookupVersion: OPERATIONAL_LOOKUP_VERSION,
    lookupRequestId: requestIdValue,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
    version: VERSION
  };
  if (datasets.includes("attendance")) patch.attendanceLookupReady = true;
  if (datasets.includes("dailyEvaluations")) patch.dailyLookupReady = true;
  await db().collection("staffOperationalIndexes").doc(date).set(patch, { merge: true });
  datasets.forEach(dataset => {
    const type: JobType = dataset === "attendance" ? "attendance" : "dailyEvaluations";
    lookupReadyCache.set(`${date}|${type}`, { ready: true, checkedAtMs: Date.now() });
  });
}

export const getStaffAttendanceOperationalSnapshot = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async request => {
    const caller = await requireStaff(request);
    const input = object(request.data);
    const f = filters(input);
    const built = await buildAttendanceRosterInternal7355014(caller, {
      date: f.date,
      className: f.className,
      classId: f.classId,
      keyword: text(input.keyword, 300),
      statusFilter: text(input.statusFilter, 60),
      teacherScopeKey: f.teacherScopeKey,
      allClasses: normalize(f.className) === normalize("전체반")
    });
    let rows = built.rows.map(row => mapAttendanceDoc(row as DocumentData));
    if (f.keyword) rows = rows.filter(row => normalize([row.studentName, row.studentNo, row.studentPhone].join(" ")).includes(f.keyword));
    if (f.status) rows = rows.filter(row => normalize(row.status).includes(f.status) || normalize(row.specialStatus).includes(f.status));
    return {
      status: "success",
      records: rows,
      rows,
      groups: built.groups,
      count: rows.length,
      source: "firestore_canonical_roster_7355049",
      queryOptimized: false,
      lookupKey: "",
      canonicalDiagnostics: built.diagnostics,
      message: `Firestore 현재 학생명단 출석부 ${rows.length}명`
    };
  }
);

export const getStaffClassListOperationalSnapshot = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async request => {
    const caller = await requireStaff(request);
    const input = object(request.data);
    const date = dateText(input.date);
    const rows = await buildClassListForDate7355014(caller, date);
    const classes = await overlayClassVideoLinks7355024(rows.map(item => ({
      classId: item.classId,
      className: item.className,
      instructorUid: item.instructorUid,
      teacherUid: item.instructorUid,
      instructorName: item.instructorName,
      teacher: item.instructorName,
      teacherScopeKey: item.teacherScopeKey,
      startTime: item.startTime,
      endTime: item.endTime,
      videoLink: text(item.videoLink, 2000),
      weekday: item.weekday,
      dates: item.dates,
      selectable: true,
      active: item.active
    })));
    return {
      status: "success",
      date,
      classes,
      count: classes.length,
      source: "firestore_canonical_class_catalog_7355016",
      updatedAtMs: Date.now(),
      message: `Firestore 현재 수업 ${classes.length}개`
    };
  }
);

function mapDailyDoc(data: DocumentData): PlainObject {
  return {
    ...data,
    date: text(data.sessionDate ?? data.date, 10),
    studentName: text(data.studentName, 120),
    name: text(data.studentName, 120),
    savedAt: data.updatedAtMs ? new Date(Number(data.updatedAtMs)).toISOString() : "",
    savedBy: text(data.updatedByName, 120)
  };
}

export const getStaffDailyEvaluationOperationalSnapshot = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async request => {
    const caller = await requireStaff(request);
    const input = object(request.data);
    const f = filters(input);
    const scope = f.teacherScopeKey || teacherScopeKey(f.className, text(input.instructor, 120), "");
    const [canonical, dailyQuery] = await Promise.all([
      buildAttendanceRosterInternal7355014(caller, { date: f.date, className: f.className, classId: f.classId, allClasses: false }),
      queryOperationalDocuments("dailyEvaluations", "dailyEvaluations", f, caller)
    ]);
    let roster = canonical.rows.map(row => mapAttendanceDoc(row as DocumentData)).filter(row => {
      if (!teacherScopeMatches(row.teacherScopeKey, scope)) return false;
      if (f.keyword && !normalize([row.studentName, row.studentNo, row.studentPhone].join(" ")).includes(f.keyword)) return false;
      return true;
    });
    const savedDocs = dailyQuery.docs.filter(doc => {
      const row = mapDailyDoc(doc.data());
      if (row.active === false) return false;
      if (!recordVisibleToCaller(row, caller)) return false;
      if (!classMatchesFilter(row, f, caller)) return false;
      if (!teacherScopeMatches(row.teacherScopeKey ?? row.evaluatorTeacherKey, scope)) return false;
      if (f.keyword && !normalize([row.studentName, row.studentNo, row.studentPhone].join(" ")).includes(f.keyword)) return false;
      return true;
    });
    await backfillVisibleTeacherUid(
      savedDocs.filter(doc => !text(doc.data().teacherUid, 160)).map(doc => doc.ref),
      caller
    );
    const savedRows = savedDocs.map(doc => mapDailyDoc({ ...doc.data(), teacherUid: text(doc.data().teacherUid, 160) || caller.teacherUid || "" }));
    // 73551010R1C-daily-attendance-category-authority: current canonical attendance is authoritative for daily evaluation status.
    const currentAttendanceByIdentity73551010 = new Map<string, PlainObject>();
    roster.forEach(row => {
      const classId73551010 = text(row.classId, 180);
      const studentUid73551010 = text(row.studentUid, 180);
      if (!classId73551010 || !studentUid73551010) return;
      currentAttendanceByIdentity73551010.set(`${classId73551010}|${studentUid73551010}`, row);
    });
    savedRows.forEach(row => {
      const classId73551010 = text(row.classId, 180);
      const studentUid73551010 = text(row.studentUid, 180);
      if (!classId73551010 || !studentUid73551010) return;
      const current73551010 = currentAttendanceByIdentity73551010.get(`${classId73551010}|${studentUid73551010}`);
      if (!current73551010) return;
      const status73551010 = attendanceStatusOnly(current73551010.attendanceStatus ?? current73551010.status) || "미체크";
      row.attendanceStatus = status73551010;
      row.status = status73551010;
    });
    const resolvedClassId = text(f.classId, 180) || text(roster[0]?.classId, 180) || text(savedRows[0]?.classId, 180);
    const classVideoLink = resolvedClassId ? await readClassVideoLinkSetting7355024(resolvedClassId) : "";
    return {
      status: "success",
      roster,
      rows: savedRows,
      count: savedRows.length,
      classId: resolvedClassId,
      classVideoLink,
      teacherScopeKey: scope,
      source: "firestore_canonical_roster_daily_7355049",
      queryOptimized: dailyQuery.optimized,
      lookupKey: dailyQuery.optimized ? dailyQuery.lookupKey : "",
      canonicalDiagnostics: canonical.diagnostics,
      message: `Firestore 현재 학생 ${roster.length}명 · 일일평가 ${savedRows.length}건`
    };
  }
);

// GAS operational import/write pipeline retired in 73550993. Firestore is the sole operational authority.

export const issueTabletKioskToken = onCall(
  {
    ...TABLET_CALLABLE_OPTIONS,
    secrets: [ULIM_TABLET_KIOSK_KEY]
  },
  async request => {
    const input = object(request.data);
    const supplied = text(input.kioskKey, 300);
    const expected = ULIM_TABLET_KIOSK_KEY.value();
    if (!supplied || !expected || !secretEquals(supplied, expected)) {
      throw new HttpsError("permission-denied", "태블릿 인증키가 올바르지 않습니다.");
    }
    const kioskId = safeKioskId(input.kioskId);
    const uid = hashId("tabletKiosk", kioskId).slice(0, 120);
    const tabletDate = tabletSeoulDate();
    const customToken = await getAuth(getOrInitializeDefaultFirebaseAdminApp()).createCustomToken(uid, {
      tabletKiosk: true,
      role: "tablet",
      kioskId,
      tabletDate
    });
    return { status: "success", customToken, kioskId, tabletDate, version: VERSION };
  }
);

export const getTabletOperationalSnapshot = onCall(
  TABLET_DATA_CALLABLE_OPTIONS,
  async request => {
    const caller = await requireTablet(request);
    const input = object(request.data);
    const date = dateText(input.date ?? caller.tabletDate);
    if (date !== caller.tabletDate || date !== tabletSeoulDate()) {
      throw new HttpsError("permission-denied", "현재 태블릿 운영일 자료만 조회할 수 있습니다.");
    }
    let snap = await db().collection("tabletDailySnapshots").doc(date).get();
    const stored = snap.data() ?? {};
    const snapshotDate = text(stored.date, 10);
    if (
      !snap.exists ||
      text(stored.version, 120) !== TABLET_SNAPSHOT_VERSION ||
      snapshotDate !== date
    ) {
      await rebuildTabletDailySnapshot(
        date,
        snap.exists ? "tablet_snapshot_calendar_refresh_7355019" : "tablet_missing_snapshot_7355019",
        hashId("TSNAP", date, Date.now())
      );
      snap = await db().collection("tabletDailySnapshots").doc(date).get();
    }
    const result = publicTabletSnapshot(snap.data() ?? {}, date);
    if (text(result.date, 10) !== date) throw new HttpsError("data-loss", "태블릿 날짜 자료가 일치하지 않습니다.");
    return result;
  }
);

export const saveTabletAttendanceOperational = onCall(
  TABLET_DATA_CALLABLE_OPTIONS,
  async request => {
    const caller = await requireTablet(request);
    const input = object(request.data);
    const date = dateText(input.date ?? caller.tabletDate);
    if (date !== caller.tabletDate || date !== tabletSeoulDate()) {
      throw new HttpsError("failed-precondition", "현재 태블릿 운영일 출결만 처리할 수 있습니다.");
    }
    const attendanceNo = text(input.attendanceNo, 100).replace(/\D/g, "");
    const studentName = text(input.studentName ?? input.selectedStudentName, 120);
    const className = text(input.className, 300);
    const recordId = text(input.recordId, 160);
    const classIndex = Number(input.classIndex ?? input.selectedClassIndex ?? -1);
    const mode = ["out", "하원"].includes(text(input.mode, 20)) ? "하원" : "등원";
    if (!attendanceNo) throw new HttpsError("invalid-argument", "출결번호가 필요합니다.");

    const snapshotRef = db().collection("tabletDailySnapshots").doc(date);
    let snapshot = await snapshotRef.get();
    const snapshotData = snapshot.data() ?? {};
    if (
      !snapshot.exists ||
      text(snapshotData.version, 120) !== TABLET_SNAPSHOT_VERSION ||
      text(snapshotData.date, 10) !== date
    ) {
      await rebuildTabletDailySnapshot(
        date,
        snapshot.exists ? "tablet_save_calendar_refresh_7355019" : "tablet_save_missing_snapshot_7355019",
        hashId("TSNAP", date, Date.now())
      );
      snapshot = await snapshotRef.get();
    }
    const resolved = resolveTabletSnapshotClass(snapshot.data() ?? {}, attendanceNo, studentName, recordId, className, classIndex);
    if (!resolved) throw new HttpsError("not-found", "오늘 수업 정보를 찾지 못했습니다. 데스크에 문의해주세요.");
    const candidate = object(resolved.candidate);
    const selected = object(resolved.selected);
    const targetRecordId = text(selected.recordId, 160);
    if (!targetRecordId) throw new HttpsError("failed-precondition", "출석 기록 식별값이 없습니다.");

    const targetRef = db().collection("attendance").doc(targetRecordId);
    const eventId = hashId(
      "TEVT",
      date,
      attendanceNo,
      text(candidate.studentUid ?? candidate.studentIdentityKey ?? candidate.studentName, 180),
      mode,
      targetRecordId
    );
    const eventRef = db().collection("tabletAttendanceEvents").doc(eventId);
    const mutationRequestId = hashId("TATT", eventId);
    const nowMs = Date.now();

    const transactionResult = await db().runTransaction(async tx => {
      const [eventSnap, attendanceSnap] = await Promise.all([tx.get(eventRef), tx.get(targetRef)]);
      if (eventSnap.exists) {
        return { duplicate: true, event: eventSnap.data() ?? {} };
      }
      const current = attendanceSnap.exists ? (attendanceSnap.data() ?? {}) : {
        sessionId: `${date}|${text(selected.classId, 160)}`,
        sessionDate: date,
        date,
        classId: text(selected.classId, 160),
        className: text(selected.className, 300),
        teacherUid: text(selected.teacherUid ?? selected.instructorUid, 160),
        teacherScopeKey: text(selected.teacherScopeKey, 180),
        instructor: text(selected.instructor ?? selected.instructorName, 120),
        instructorName: text(selected.instructorName ?? selected.instructor, 120),
        classroom: text(selected.roomName ?? selected.classroom, 100) || "데스크문의",
        roomName: text(selected.roomName ?? selected.classroom, 100) || "데스크문의",
        studentUid: text(candidate.studentUid ?? selected.studentUid, 160),
        studentIdentityKey: text(candidate.studentIdentityKey ?? candidate.studentUid ?? selected.studentUid, 180),
        studentName: text(candidate.studentName ?? candidate.name ?? selected.studentName, 120),
        name: text(candidate.studentName ?? candidate.name ?? selected.studentName, 120),
        studentNo: text(candidate.attendanceNo ?? selected.attendanceNo, 100),
        attendanceNo: text(candidate.attendanceNo ?? selected.attendanceNo, 100),
        studentPhone: text(selected.studentPhone, 60),
        parentPhone: text(selected.parentPhone, 60),
        status: "미체크",
        attendanceStatus: "미체크",
        specialStatus: text(selected.specialStatus, 60),
        active: true,
        source: "tablet_canonical_roster_materialize_7355015",
        sourceOfTruth: "firestore_operational",
        sheetSyncState: "backup_0600",
        createdAtMs: nowMs,
        createdAt: FieldValue.serverTimestamp(),
        updatedAtMs: nowMs,
        updatedAt: FieldValue.serverTimestamp(),
        version: VERSION
      };
      if (current.active === false || text(current.sessionDate ?? current.date, 10) !== date) {
        throw new HttpsError("failed-precondition", "오늘 사용 가능한 출석 기록이 아닙니다.");
      }
      const eventData: PlainObject = {
        eventId,
        date,
        mode,
        kioskId: caller.kioskId,
        kioskFirebaseUid: caller.firebaseUid,
        attendanceNo,
        studentName: text(current.studentName ?? candidate.studentName, 120),
        studentUid: text(current.studentUid ?? candidate.studentUid, 160),
        studentIdentityKey: text(current.studentIdentityKey ?? candidate.studentIdentityKey, 180),
        studentPhone: text(current.studentPhone, 60),
        parentPhone: text(current.parentPhone, 60),
        recordId: targetRecordId,
        classId: text(current.classId ?? selected.classId, 160),
        className: text(current.className ?? selected.className, 300),
        instructor: text(current.instructor ?? selected.instructor, 120),
        roomName: text(current.classroom ?? selected.roomName, 100) || "데스크문의",
        eventTimeText: new Date(nowMs + 9 * 60 * 60 * 1000).toISOString().slice(11, 16),
        notificationState: "pending",
        notificationAttempts: 0,
        notificationNextAttemptAtMs: nowMs,
        createdAtMs: nowMs,
        createdAt: FieldValue.serverTimestamp(),
        version: VERSION
      };
      tx.create(eventRef, eventData);

      if (mode === "등원") {
        const status = "출석";
        tx.set(targetRef, {
          ...(attendanceSnap.exists ? {} : current),
          status,
          attendanceStatus: status,
          active: true,
          sourceOfTruth: "firestore_operational",
          sheetSyncState: "backup_0600",
          lastMutationRequestId: mutationRequestId,
          updatedByFirebaseUid: caller.firebaseUid,
          updatedByRole: "tablet",
          updatedByName: caller.kioskId,
          updatedAtMs: nowMs,
          updatedAt: FieldValue.serverTimestamp(),
          version: VERSION
        }, { merge: true });
        tx.set(
          db().collection("staffOperationalRevisions").doc(date),
          revisionPatch(date, "attendance", nowMs, "tablet_firestore_checkin", mutationRequestId),
          { merge: true }
        );
        const eventClassId = text(current.classId ?? selected.classId, 160);
        if (eventClassId) {
          tx.set(
            db().collection("staffOperationalClassRevisions").doc(classRevisionDocId(date, eventClassId)),
            classRevisionPatch(date, eventClassId, "attendance", nowMs, "tablet_firestore_checkin", mutationRequestId),
            { merge: true }
          );
        }
      }
      return {
        duplicate: false,
        event: eventData,
        attendanceData: mode === "등원" ? { ...current, status: "출석", attendanceStatus: "출석", active: true } : current
      };
    });

    if (!transactionResult.duplicate && mode === "등원") {
      try {
        const patched = await patchTabletDailySnapshotRows(
          date,
          [{ id: targetRecordId, data: object(transactionResult.attendanceData) }],
          "tablet_firestore_checkin",
          mutationRequestId
        );
        if (!patched) await rebuildTabletDailySnapshot(date, "tablet_firestore_checkin_missing_snapshot", mutationRequestId);
      } catch { /* 다음 예약 적재에서 복구 */ }
    }

    // 알림톡은 tabletAttendanceEvents onCreate/sweeper가 Firebase Functions 안에서 SOLAPI로 처리합니다.
    // 태블릿 저장 경로에서는 GAS 또는 Google Sheets를 호출하지 않습니다.
    const initialEvent = object(transactionResult.event);
    let latestEvent = initialEvent;
    try {
      const latestEventSnap = await eventRef.get();
      if (latestEventSnap.exists) latestEvent = latestEventSnap.data() ?? initialEvent;
    } catch { /* 응답에는 최초 이벤트 정보를 사용합니다. */ }

    return {
      status: transactionResult.duplicate ? "duplicate" : "success",
      duplicate: transactionResult.duplicate,
      eventId,
      mode,
      date,
      studentName: text(latestEvent.studentName, 120),
      className: text(latestEvent.className, 300),
      instructor: text(latestEvent.instructor, 120),
      roomName: text(latestEvent.roomName, 100) || "데스크문의",
      recordId: targetRecordId,
      sheetSyncRequestId: "",
      sheetSyncState: "backup_0600",
      notificationState: text(latestEvent.notificationState, 30) || "pending",
      notificationResult: text(latestEvent.notificationResult, 1000),
      notificationError: text(latestEvent.notificationError, 1000),
      version: VERSION
    };
  }
);

function tabletNotificationPayload(data: DocumentData, eventId: string): PlainObject {
  return {
    eventId,
    date: text(data.date, 10),
    mode: text(data.mode, 20),
    attendanceNo: text(data.attendanceNo, 100),
    studentName: text(data.studentName, 120),
    studentUid: text(data.studentUid, 160),
    studentIdentityKey: text(data.studentIdentityKey, 180),
    studentPhone: text(data.studentPhone, 60),
    parentPhone: text(data.parentPhone, 60),
    recordId: text(data.recordId, 160),
    classId: text(data.classId, 160),
    className: text(data.className, 300),
    instructor: text(data.instructor, 120),
    roomName: text(data.roomName, 100) || "데스크문의",
    timeText: text(data.eventTimeText, 10),
    createdAtMs: Number(data.createdAtMs || 0),
    kioskId: text(data.kioskId, 120),
    version: VERSION
  };
}

async function processTabletNotificationRef(ref: DocumentReference, dataInput?: DocumentData): Promise<void> {
  const nowMs = Date.now();
  let data = dataInput ?? (await ref.get()).data() ?? {};
  const createdAtMs = Number(data.createdAtMs || 0);
  const existingAttempts = Number(data.notificationAttempts || 0);
  const existingState = text(data.notificationState, 30);
  // 0.28 rollout guard: an old event that has already been retried repeatedly must not send again after deploy.
  if (text(data.version, 120) !== VERSION && existingAttempts >= 1 && ["retry", "processing", "pending"].includes(existingState)) {
    await ref.set({
      notificationState: "delivery_unknown",
      notificationError: "기존 버전에서 이미 1회 이상 발송을 시도한 이벤트의 추가 재발송을 0.28에서 차단했습니다.",
      notificationLeaseUntilMs: 0,
      notificationNextAttemptAtMs: 0,
      notificationUpdatedAtMs: nowMs,
      notificationUpdatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return;
  }
  if (createdAtMs && nowMs - createdAtMs > TABLET_NOTIFICATION_MAX_AGE_MS) {
    await ref.set({
      notificationState: "expired",
      notificationError: "알림 재처리 가능 시간(30분)이 지났습니다.",
      notificationUpdatedAtMs: nowMs,
      notificationUpdatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return;
  }

  const claimed = await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const current = snap.data() ?? {};
    const state = text(current.notificationState, 30);
    const nextAttemptAtMs = Number(current.notificationNextAttemptAtMs || 0);
    const leaseUntilMs = Number(current.notificationLeaseUntilMs || 0);
    if (["complete", "duplicate", "permanent_failed", "expired", "delivery_unknown"].includes(state)) return false;
    if (nextAttemptAtMs > nowMs || (state === "processing" && leaseUntilMs > nowMs)) return false;
    tx.set(ref, {
      notificationState: "processing",
      notificationAttempts: Number(current.notificationAttempts || 0) + 1,
      notificationLeaseUntilMs: nowMs + TABLET_NOTIFICATION_LEASE_MS,
      notificationUpdatedAtMs: nowMs,
      notificationUpdatedAt: FieldValue.serverTimestamp(),
      notificationError: FieldValue.delete()
    }, { merge: true });
    data = current;
    return true;
  });
  if (!claimed) return;

  const eventId = ref.id;
  try {
    const result = await sendTabletAttendanceSolapi7355014(tabletNotificationPayload(data, eventId));
    const duplicateSuppressed = result.duplicateSuppressed === true;
    const dispatchState = text(result.dispatchState, 40);
    const terminalState = duplicateSuppressed && dispatchState !== "accepted" && dispatchState !== "complete" ? "delivery_unknown" : "complete";
    await ref.set({
      notificationState: terminalState,
      notificationResult: duplicateSuppressed
        ? (terminalState === "complete" ? "이미 처리된 동일 알림의 재발송을 차단했습니다." : "이전 발송 여부가 불확실하여 중복 재발송을 차단했습니다.")
        : result.skipped === true
          ? text(result.reason, 1000) || "수신번호가 없어 발송을 건너뛰었습니다."
          : `SOLAPI ${Number(result.sent || 0)}건 발송 완료`,
      notificationDeliveryId: text(result.deliveryId, 200),
      notificationCompletedAtMs: Date.now(),
      notificationCompletedAt: FieldValue.serverTimestamp(),
      notificationLeaseUntilMs: 0,
      notificationNextAttemptAtMs: 0,
      notificationUpdatedAtMs: Date.now(),
      notificationUpdatedAt: FieldValue.serverTimestamp(),
      notificationError: FieldValue.delete()
    }, { merge: true });
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const noAutoRetry = Boolean((error as Error & { ulimNoAutoRetry?: boolean })?.ulimNoAutoRetry);
    await ref.set({
      notificationState: noAutoRetry ? "delivery_unknown" : "retry",
      notificationError: message.slice(0, 1200),
      notificationLeaseUntilMs: 0,
      notificationNextAttemptAtMs: noAutoRetry ? 0 : Date.now() + 60_000,
      notificationUpdatedAtMs: Date.now(),
      notificationUpdatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    if (!noAutoRetry) throw error;
  }
}

export const processTabletAttendanceNotification = onDocumentCreated(
  {
    document: "tabletAttendanceEvents/{eventId}",
    region: ULIM_FUNCTION_REGION,
    retry: true,
    timeoutSeconds: 240,
    memory: "256MiB",
    secrets: [ULIM_SOLAPI_OPERATIONAL_CONFIG_7355014]
  },
  async event => {
    if (!event.data) return;
    await processTabletNotificationRef(event.data.ref, event.data.data() ?? {});
  }
);

export const sweepTabletAttendanceNotifications = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Asia/Seoul",
    region: ULIM_FUNCTION_REGION,
    retryCount: 1,
    timeoutSeconds: 240,
    memory: "256MiB",
    secrets: [ULIM_SOLAPI_OPERATIONAL_CONFIG_7355014]
  },
  async () => {
    const snapshots = await Promise.all([
      db().collection("tabletAttendanceEvents").where("notificationState", "==", "pending").limit(50).get(),
      db().collection("tabletAttendanceEvents").where("notificationState", "==", "retry").limit(50).get(),
      db().collection("tabletAttendanceEvents").where("notificationState", "==", "processing").limit(50).get()
    ]);
    const docs = Array.from(new Map<string, QueryDocumentSnapshot<DocumentData>>(
      snapshots.flatMap(snapshot => snapshot.docs).map(doc => [doc.id, doc] as [string, QueryDocumentSnapshot<DocumentData>])
    ).values()).slice(0, 50);
    for (const doc of docs) {
      try { await processTabletNotificationRef(doc.ref, doc.data() ?? {}); }
      catch { /* 다음 이벤트 재시도 또는 5분 복구 작업이 이어서 처리합니다. */ }
    }
  }
);

function kstDate(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}





