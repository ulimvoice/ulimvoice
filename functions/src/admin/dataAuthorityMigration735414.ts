import { createHash, createHmac, randomUUID } from "node:crypto";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot
} from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";
import { ULIM_LEGACY_PROOF_HMAC_SECRET } from "../common/firebaseSecrets.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";
import { refreshTabletDailySnapshotsForStudentManagement7352 } from "../operational/staffOperationalFirestore.js";
import { postGasEnvelopeWithRetry7354148 } from "./gasBackupTransport7354148.js";

export const DATA_AUTHORITY_MIGRATION_735414_VERSION = "2026-08-05.735.04.15.0-bounded-backup-continuation";

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyS3QUvrjNbwvaw92_g-QKQyN3Yito8DAdpAjxUzfnsuVf3Ce7ccuaXIv651U7FnYF4/exec";
const RUN_COLLECTION = "dataAuthorityRuns";
const ISSUE_COLLECTION = "reconciliationIssues";
const STATE_PATH = "systemConfig/dataAuthority";
const BACKUP_STATE_PATH = "systemConfig/dataAuthorityBackup";
const MAX_DOCS = 50000;
const ANALYSIS_ITEM_LIMIT = 15000;
const APPLY_ITEM_LIMIT = 5000;
const CLASS_HORIZON_DAYS = 70;

const CALLABLE_OPTIONS = Object.freeze({
  ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  cors: true,
  invoker: "public" as const
});

type PlainObject = Record<string, unknown>;
type Caller = { uid: string; user: DocumentData; authUser: UserRecord };
type MatchState = "matched" | "ambiguous" | "unmatched";
type StudentCandidate = {
  studentUid: string;
  name: string;
  nameKey: string;
  birthDate: string;
  phoneDigits: string;
  attendanceNo: string;
  data: PlainObject;
};
type ClassCandidate = {
  classId: string;
  className: string;
  nameKey: string;
  instructorUid: string;
  instructorName: string;
  instructorKey: string;
  weekday: number;
  startTime: string;
  endTime: string;
  data: PlainObject;
};
type MatchResult = { state: MatchState; id: string; reason: string; confidence: number; candidates: string[] };
type PlanType =
  | "fill_missing_student_fields"
  | "upsert_enrollment_from_sheet"
  | "repair_enrollment_projection"
  | "sync_student_enrollment_summary"
  | "link_subsystem_record"
  | "remove_fixed_room_fields"
  | "manual_review";

type PlanItem = {
  itemId: string;
  runId: string;
  type: PlanType;
  category: string;
  summary: string;
  autoApplicable: boolean;
  blocking: boolean;
  confidence: number;
  reason: string;
  source: PlainObject;
  target: PlainObject;
  patch: PlainObject;
  approvalStatus: "pending" | "approved" | "rejected" | "hold";
  applyStatus: "pending" | "complete" | "failed" | "drifted" | "rolled_back";
  createdAtMs: number;
  version: string;
};

function app() { return getOrInitializeDefaultFirebaseAdminApp(); }
function db() { return getFirestore(app()); }
function auth() { return getAuth(app()); }
function object(value: unknown): PlainObject { return value && typeof value === "object" && !Array.isArray(value) ? value as PlainObject : {}; }
function text(value: unknown, max = 500): string { return String(value ?? "").trim().slice(0, max); }
function normalize(value: unknown): string { return text(value, 500).normalize("NFKC").toLowerCase().replace(/\s+/g, ""); }
function normalizeName(value: unknown): string { return text(value, 160).normalize("NFC").toLowerCase().replace(/\s+/g, ""); }
function phone(value: unknown): string { return text(value, 80).replace(/\D/g, ""); }
function dateValue(value: unknown): string {
  const raw = text(value, 40);
  const match = raw.match(/^(\d{4})[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[3])).padStart(2, "0")}`;
}
function unique(values: unknown[]): string[] { return Array.from(new Set(values.map(value => text(value, 300)).filter(Boolean))); }
function sameTextSet(left: unknown, right: unknown): boolean {
  const a = unique(Array.isArray(left) ? left : []).sort();
  const b = unique(Array.isArray(right) ? right : []).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function hash(prefix: string, ...parts: unknown[]): string {
  const digest = createHash("sha256").update(parts.map(part => stableString(part)).join("\u001f"), "utf8").digest("hex").slice(0, 40);
  return `${prefix}_${digest}`;
}
function operationalSha(prefix: string, ...parts: unknown[]): string {
  const digest = createHash("sha256").update(parts.map(part => String(part ?? "")).join("\u001f"), "utf8").digest("hex").slice(0, 40);
  return `${prefix}_${digest}`;
}
function enrollmentDocumentId(studentUid: string, classId: string): string { return operationalSha("ENR", studentUid, classId); }
function attendanceDocumentId(date: string, classId: string, studentUid: string): string { return operationalSha("ATT", date, classId, studentUid); }
function classMemberDocumentId(studentUid: string, classId: string): string {
  const digest = createHash("sha256").update(`${classId}|${studentUid}`, "utf8").digest("hex").slice(0, 40);
  return `member_${digest}`;
}
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  Object.keys(source).sort().forEach(key => { if (source[key] !== undefined) out[key] = stableValue(source[key]); });
  return out;
}
function stableString(value: unknown): string { return JSON.stringify(stableValue(value)); }
function base64Url(input: Uint8Array): string { return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
function nowSeoulDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = new Map(parts.map(part => [part.type, part.value]));
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`;
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
  const [userSnapshot, authUser] = await Promise.all([db().collection("users").doc(uid).get(), auth().getUser(uid)]);
  if (!userSnapshot.exists) throw new HttpsError("permission-denied", "활성 전체관리자 정보가 없습니다.");
  const user = userSnapshot.data() ?? {};
  if (user.active !== true || user.role !== "superAdmin" || safeAuthVersion(user.authVersion) !== tokenAuthVersion || authUser.disabled) {
    throw new HttpsError("permission-denied", "전체관리자 권한이 변경되었습니다. 다시 로그인해주세요.");
  }
  return { uid, user, authUser };
}
function signGas(action: string, requestId: string, issuedAtMs: number, payloadJson: string): string {
  const secret = ULIM_LEGACY_PROOF_HMAC_SECRET.value() || process.env.ULIM_LEGACY_PROOF_HMAC_SECRET || "";
  if (!secret) throw new Error("ULIM_LEGACY_PROOF_HMAC_SECRET is not configured");
  return base64Url(createHmac("sha256", secret).update(`v1|${action}|${requestId}|${issuedAtMs}|${payloadJson}`, "utf8").digest());
}
async function callGas(action: string, requestId: string, payload: PlainObject, timeoutMs = 300_000): Promise<PlainObject> {
  const payloadJson = JSON.stringify(payload);
  const issuedAtMs = Date.now();
  return postGasEnvelopeWithRetry7354148(
    GAS_WEB_APP_URL,
    {
      action,
      requestId,
      issuedAtMs,
      payloadJson,
      signature: signGas(action, requestId, issuedAtMs, payloadJson)
    },
    { timeoutMs, maxAttempts: 4 }
  );
}
async function loadCollection(name: string, limit = MAX_DOCS): Promise<QueryDocumentSnapshot[]> {
  const snapshot = await db().collection(name).limit(Math.min(MAX_DOCS, Math.max(1, limit))).get();
  return snapshot.docs;
}
function toPlain(doc: QueryDocumentSnapshot): PlainObject { return { documentId: doc.id, ...doc.data() } as PlainObject; }
function studentCandidate(doc: QueryDocumentSnapshot): StudentCandidate {
  const data = object(doc.data());
  return {
    studentUid: doc.id,
    name: text(data.name ?? data.studentName, 160),
    nameKey: normalizeName(data.nameNormalized ?? data.name ?? data.studentName),
    birthDate: dateValue(data.birthDate ?? data.dateOfBirth),
    phoneDigits: phone(data.phoneDigits ?? data.studentPhone ?? data.phone),
    attendanceNo: text(data.attendanceNo ?? data.studentNo ?? data.loginId, 40),
    data: { documentId: doc.id, ...data }
  };
}
function classCandidate(doc: QueryDocumentSnapshot): ClassCandidate {
  const data = object(doc.data());
  const className = text(data.className ?? data.name, 300);
  const instructorName = text(data.instructorName ?? data.teacherName ?? data.teacher, 160);
  return {
    classId: doc.id,
    className,
    nameKey: normalize(className),
    instructorUid: text(data.instructorUid ?? data.teacherUid, 160),
    instructorName,
    instructorKey: normalizeName(instructorName.replace(/T$/i, "")),
    weekday: Number(data.weekday ?? -1),
    startTime: text(data.startTime, 20),
    endTime: text(data.endTime, 20),
    data: { documentId: doc.id, ...data }
  };
}
function candidateIds<T>(items: T[], id: (item: T) => string): string[] { return unique(items.map(id)); }
function matchStudent(candidates: StudentCandidate[], raw: PlainObject): MatchResult {
  const uid = text(raw.studentUid ?? raw.uid, 160);
  if (uid) {
    const exact = candidates.filter(item => item.studentUid === uid);
    if (exact.length === 1) return { state: "matched", id: uid, reason: "studentUid exact", confidence: 100, candidates: [uid] };
  }
  const rowPhone = phone(raw.studentPhone ?? raw.phone);
  if (rowPhone.length >= 8) {
    const exact = candidates.filter(item => item.phoneDigits === rowPhone);
    if (exact.length === 1) return { state: "matched", id: exact[0].studentUid, reason: "unique phone", confidence: 98, candidates: [exact[0].studentUid] };
    if (exact.length > 1) return { state: "ambiguous", id: "", reason: "duplicate phone", confidence: 0, candidates: candidateIds(exact, item => item.studentUid) };
  }
  const nameKey = normalizeName(raw.name ?? raw.studentName);
  const birth = dateValue(raw.birthDate ?? raw.dateOfBirth);
  if (nameKey && birth) {
    const exact = candidates.filter(item => item.nameKey === nameKey && item.birthDate === birth);
    if (exact.length === 1) return { state: "matched", id: exact[0].studentUid, reason: "unique name+birth", confidence: 96, candidates: [exact[0].studentUid] };
    if (exact.length > 1) return { state: "ambiguous", id: "", reason: "duplicate name+birth", confidence: 0, candidates: candidateIds(exact, item => item.studentUid) };
  }
  const attendanceNo = text(raw.attendanceNo ?? raw.studentNo ?? raw.loginId, 40);
  if (nameKey && attendanceNo) {
    const exact = candidates.filter(item => item.nameKey === nameKey && item.attendanceNo === attendanceNo);
    if (exact.length === 1) return { state: "matched", id: exact[0].studentUid, reason: "unique name+attendanceNo", confidence: 92, candidates: [exact[0].studentUid] };
    if (exact.length > 1) return { state: "ambiguous", id: "", reason: "duplicate name+attendanceNo", confidence: 0, candidates: candidateIds(exact, item => item.studentUid) };
  }
  if (nameKey) {
    const sameName = candidates.filter(item => item.nameKey === nameKey);
    if (sameName.length > 1) return { state: "ambiguous", id: "", reason: "homonym requires review", confidence: 0, candidates: candidateIds(sameName, item => item.studentUid) };
  }
  return { state: "unmatched", id: "", reason: "insufficient unique identity", confidence: 0, candidates: [] };
}
function matchClass(candidates: ClassCandidate[], raw: PlainObject): MatchResult {
  const classId = text(raw.classId, 180);
  if (classId && candidates.some(item => item.classId === classId)) return { state: "matched", id: classId, reason: "classId exact", confidence: 100, candidates: [classId] };
  const nameKey = normalize(raw.className ?? raw.currentClass ?? raw.class);
  const teacherKey = normalizeName(text(raw.instructorName ?? raw.teacherName ?? raw.instructor ?? raw.teacher, 160).replace(/T$/i, ""));
  if (nameKey && teacherKey) {
    const exact = candidates.filter(item => item.nameKey === nameKey && item.instructorKey === teacherKey);
    if (exact.length === 1) return { state: "matched", id: exact[0].classId, reason: "unique class+teacher", confidence: 98, candidates: [exact[0].classId] };
    if (exact.length > 1) return { state: "ambiguous", id: "", reason: "duplicate class+teacher", confidence: 0, candidates: candidateIds(exact, item => item.classId) };
  }
  if (nameKey) {
    const exact = candidates.filter(item => item.nameKey === nameKey);
    if (exact.length === 1) return { state: "matched", id: exact[0].classId, reason: "unique class name", confidence: 90, candidates: [exact[0].classId] };
    if (exact.length > 1) return { state: "ambiguous", id: "", reason: "class name ambiguous", confidence: 0, candidates: candidateIds(exact, item => item.classId) };
  }
  return { state: "unmatched", id: "", reason: "class not found", confidence: 0, candidates: [] };
}
function itemId(runId: string, type: PlanType, ...parts: unknown[]): string { return hash("DAP", runId, type, ...parts); }
function makeItem(runId: string, type: PlanType, input: Omit<PlanItem, "itemId" | "runId" | "type" | "approvalStatus" | "applyStatus" | "createdAtMs" | "version">): PlanItem {
  const id = itemId(runId, type, input.category, input.source, input.target, input.patch);
  return { itemId: id, runId, type, ...input, approvalStatus: "pending", applyStatus: "pending", createdAtMs: Date.now(), version: DATA_AUTHORITY_MIGRATION_735414_VERSION };
}
function fixedRoomFields(data: PlainObject): string[] { return ["roomName", "classroom", "room"].filter(key => Object.prototype.hasOwnProperty.call(data, key)); }
function subsystemNames(all: string[]): string[] {
  const explicit = ["attendance", "dailyEvaluations", "practiceLogs", "vocalPracticeLogs", "pronunciationPracticeLogs", "pastExamPracticeLogs", "roomReservations", "practiceRoomReservations", "courseApplications"];
  const discovered = all.filter(name => /(practice|reservation|courseapplication|dailyEvaluation)/i.test(name));
  return unique([...explicit, ...discovered]);
}
function issueTypeFor(studentMatch: MatchResult, classMatch?: MatchResult): string {
  if (studentMatch.state === "ambiguous") return "homonym_or_identity_ambiguous";
  if (studentMatch.state === "unmatched") return "student_missing_or_identity_insufficient";
  if (classMatch?.state === "ambiguous") return "class_ambiguous";
  if (classMatch?.state === "unmatched") return "class_missing_from_catalog";
  return "manual_review";
}
function planDigest(items: PlanItem[]): string {
  return createHash("sha256").update(stableString(items.map(item => ({ itemId: item.itemId, type: item.type, source: item.source, target: item.target, patch: item.patch, autoApplicable: item.autoApplicable, blocking: item.blocking })).sort((a, b) => a.itemId.localeCompare(b.itemId))), "utf8").digest("hex");
}
async function writeItems(runId: string, items: PlanItem[]): Promise<void> {
  for (let offset = 0; offset < items.length; offset += 350) {
    const batch = db().batch();
    items.slice(offset, offset + 350).forEach(item => batch.set(db().collection(RUN_COLLECTION).doc(runId).collection("items").doc(item.itemId), item, { merge: false }));
    await batch.commit();
  }
}
async function writeIssues(runId: string, callerUid: string, items: PlanItem[]): Promise<number> {
  const issues = items.filter(item => item.type === "manual_review");
  for (let offset = 0; offset < issues.length; offset += 350) {
    const batch = db().batch();
    issues.slice(offset, offset + 350).forEach(item => {
      const issueId = hash("RECON", item.category, item.source, item.reason);
      batch.set(db().collection(ISSUE_COLLECTION).doc(issueId), {
        issueId,
        runId,
        issueType: text(item.patch.issueType, 100) || "manual_review",
        source: "data_authority_analysis_735414",
        status: "open",
        requiresAdminReview: true,
        summary: item.summary,
        reason: item.reason,
        sourceData: item.source,
        candidates: item.target,
        lastSeenAtMs: Date.now(),
        lastSeenAt: FieldValue.serverTimestamp(),
        actorFirebaseUid: callerUid,
        version: DATA_AUTHORITY_MIGRATION_735414_VERSION
      }, { merge: true });
    });
    await batch.commit();
  }
  return issues.length;
}
function duplicateItems(runId: string, candidates: StudentCandidate[]): PlanItem[] {
  const groups = [
    { key: "phone", getter: (item: StudentCandidate) => item.phoneDigits.length >= 8 ? item.phoneDigits : "", issueType: "duplicate_phone" },
    { key: "attendanceNo", getter: (item: StudentCandidate) => item.attendanceNo, issueType: "duplicate_attendance_no" },
    { key: "nameBirth", getter: (item: StudentCandidate) => item.nameKey && item.birthDate ? `${item.nameKey}|${item.birthDate}` : "", issueType: "duplicate_name_birth" }
  ];
  const result: PlanItem[] = [];
  groups.forEach(group => {
    const map = new Map<string, StudentCandidate[]>();
    candidates.forEach(candidate => {
      const value = group.getter(candidate);
      if (!value) return;
      const list = map.get(value) || [];
      list.push(candidate);
      map.set(value, list);
    });
    map.forEach((items, value) => {
      if (items.length < 2) return;
      result.push(makeItem(runId, "manual_review", {
        category: "student_identity_duplicate",
        summary: `${group.key} 중복 ${items.length}명`,
        autoApplicable: false,
        blocking: true,
        confidence: 0,
        reason: `${group.issueType}:${value}`,
        source: { value, studentUids: items.map(item => item.studentUid), names: items.map(item => item.name) },
        target: {},
        patch: { issueType: group.issueType }
      }));
    });
  });
  return result;
}
async function referenceRows(action: string, callerUid: string): Promise<{ rows: PlainObject[]; error: string }> {
  try {
    const result = await callGas(action, `${action}-735414-${Date.now()}-${randomUUID()}`, { version: DATA_AUTHORITY_MIGRATION_735414_VERSION, actorFirebaseUid: callerUid });
    return { rows: Array.isArray(result.rows) ? result.rows.map(object) : [], error: "" };
  } catch (error) {
    return { rows: [], error: text(error instanceof Error ? error.message : error, 1500) };
  }
}
async function buildAnalysis(caller: Caller, runId: string): Promise<{ items: PlanItem[]; summary: PlainObject; sourceFingerprints: PlainObject }> {
  const [studentsDocs, classDocs, enrollmentDocs, classMemberDocs, attendanceDocs, allCollections, studentSheet, attendanceSheet] = await Promise.all([
    loadCollection("students", 7000),
    loadCollection("classes", 4000),
    loadCollection("studentEnrollments", 25000),
    loadCollection("classMembers", 25000),
    loadCollection("attendance", 50000),
    db().listCollections(),
    referenceRows("firebaseStudentDirectoryPull7342", caller.uid),
    referenceRows("firebaseAttendanceRosterDirectoryPull7352", caller.uid)
  ]);
  const students = studentsDocs.map(studentCandidate);
  const classes = classDocs.map(classCandidate);
  const activeEnrollmentDocs = enrollmentDocs.filter(doc => doc.data()?.active !== false && text(doc.data()?.status, 30) !== "ended");
  const enrollmentKey = new Set(activeEnrollmentDocs.map(doc => `${text(doc.data()?.studentUid, 160)}|${text(doc.data()?.classId, 180)}`));
  const items: PlanItem[] = duplicateItems(runId, students);
  const studentMap = new Map(students.map(item => [item.studentUid, item]));
  const classMap = new Map(classes.map(item => [item.classId, item]));
  const memberMap = new Map(classMemberDocs.map(doc => [doc.id, doc]));
  const attendanceKey = new Set(attendanceDocs.map(doc => {
    const data = doc.data() ?? {};
    return `${dateValue(data.sessionDate ?? data.date)}|${text(data.classId, 180)}|${text(data.studentUid, 160)}`;
  }));
  const enrollmentsByStudent = new Map<string, QueryDocumentSnapshot[]>();
  activeEnrollmentDocs.forEach(doc => {
    const studentUid = text(doc.data()?.studentUid, 160);
    const list = enrollmentsByStudent.get(studentUid) || [];
    list.push(doc); enrollmentsByStudent.set(studentUid, list);
  });

  activeEnrollmentDocs.forEach(doc => {
    const data = object(doc.data());
    const studentUid = text(data.studentUid, 160);
    const classId = text(data.classId, 180);
    const student = studentMap.get(studentUid);
    const cls = classMap.get(classId);
    if (!student || !cls) {
      const studentMatch: MatchResult = student ? { state: "matched", id: studentUid, reason: "existing studentUid", confidence: 100, candidates: [studentUid] } : { state: "unmatched", id: "", reason: "enrollment student missing", confidence: 0, candidates: [] };
      const classMatch: MatchResult = cls ? { state: "matched", id: classId, reason: "existing classId", confidence: 100, candidates: [classId] } : { state: "unmatched", id: "", reason: "enrollment class missing", confidence: 0, candidates: [] };
      items.push(makeItem(runId, "manual_review", {
        category: "enrollment_reference_broken", summary: `수강관계 ${doc.id} 학생·반 확인 필요`, autoApplicable: false, blocking: true, confidence: 0,
        reason: `${studentMatch.reason}; ${classMatch.reason}`, source: { collection: "studentEnrollments", documentId: doc.id, studentUid, classId },
        target: { candidateStudentUids: studentMatch.candidates, candidateClassIds: classMatch.candidates }, patch: { issueType: issueTypeFor(studentMatch, classMatch) }
      }));
      return;
    }
    const startDate = dateValue(data.startDate) || nowSeoulDate();
    const dates = classOperationalDates(cls.data, startDate);
    const missingAttendanceDates = dates.filter(date => !attendanceKey.has(`${date}|${classId}|${studentUid}`));
    const memberId = classMemberDocumentId(studentUid, classId);
    const member = memberMap.get(memberId);
    const memberData = member ? object(member.data()) : {};
    const memberNeedsRepair = !member || memberData.active === false || text(memberData.enrollmentStatus, 30) === "ended" || text(memberData.classId, 180) !== classId || text(memberData.studentUid, 160) !== studentUid;
    if (memberNeedsRepair || missingAttendanceDates.length) {
      items.push(makeItem(runId, "repair_enrollment_projection", {
        category: "enrollment_projection", summary: `${student.name} → ${cls.className} 운영명단·출석 연결 보완`, autoApplicable: true, blocking: false, confidence: 100,
        reason: `active enrollment projection; member=${memberNeedsRepair ? "repair" : "ok"}; missingAttendance=${missingAttendanceDates.length}`,
        source: { collection: "studentEnrollments", documentId: doc.id, updatedAtMs: Number(data.updatedAtMs || 0), missingAttendanceDates },
        target: { studentUid, classId, enrollmentDocumentId: doc.id, studentUpdatedAtMs: Number(student.data.updatedAtMs || 0), classUpdatedAtMs: Number(cls.data.updatedAtMs || 0) },
        patch: { registrationType: text(data.registrationType, 30) || "existing", startDate, missingAttendanceDates }
      }));
    }
  });

  students.forEach(student => {
    const related = (enrollmentsByStudent.get(student.studentUid) || []).map(doc => classMap.get(text(doc.data()?.classId, 180))).filter((value): value is ClassCandidate => Boolean(value));
    const sorted = related.slice().sort((left, right) => left.className.localeCompare(right.className, "ko") || left.classId.localeCompare(right.classId));
    const classUids = unique(sorted.map(item => item.classId));
    const classNames = unique(sorted.map(item => item.className));
    const instructorUids = unique(sorted.map(item => item.instructorUid));
    const instructorNames = unique(sorted.map(item => item.instructorName));
    if (!sameTextSet(student.data.classUids, classUids) || !sameTextSet(student.data.classNames, classNames) || !sameTextSet(student.data.instructorUids, instructorUids) || !sameTextSet(student.data.instructorNames, instructorNames)) {
      items.push(makeItem(runId, "sync_student_enrollment_summary", {
        category: "student_enrollment_summary", summary: `${student.name} 학생 수강반·담당강사 요약 정리`, autoApplicable: true, blocking: false, confidence: 100,
        reason: "student summary must equal active studentEnrollments", source: { collection: "students", documentId: student.studentUid, updatedAtMs: Number(student.data.updatedAtMs || 0) },
        target: { collection: "students", documentId: student.studentUid }, patch: { classUids, classNames, instructorUids, instructorNames }
      }));
    }
  });

  studentSheet.rows.forEach((row, index) => {
    const match = matchStudent(students, row);
    if (match.state !== "matched") {
      items.push(makeItem(runId, "manual_review", {
        category: "student_sheet_identity",
        summary: `학생명단 시트 ${Number(row.rowNumber || index + 2)}행 확인 필요`,
        autoApplicable: false,
        blocking: match.state === "ambiguous",
        confidence: 0,
        reason: match.reason,
        source: { rowNumber: Number(row.rowNumber || index + 2), row },
        target: { candidateStudentUids: match.candidates },
        patch: { issueType: issueTypeFor(match) }
      }));
      return;
    }
    const current = students.find(student => student.studentUid === match.id);
    if (!current) return;
    const patch: PlainObject = {};
    const rowBirth = dateValue(row.birthDate ?? row.dateOfBirth);
    const rowPhone = text(row.studentPhone ?? row.phone, 60);
    const rowParent = text(row.parentPhone, 60);
    if (!current.birthDate && rowBirth) patch.birthDate = rowBirth;
    if (!current.phoneDigits && phone(rowPhone).length >= 8) { patch.studentPhone = rowPhone; patch.phone = rowPhone; patch.phoneDigits = phone(rowPhone); }
    if (!text(current.data.parentPhone, 60) && rowParent) { patch.parentPhone = rowParent; patch.parentPhoneDigits = phone(rowParent); }
    if (Object.keys(patch).length) {
      items.push(makeItem(runId, "fill_missing_student_fields", {
        category: "student_master_fill_missing",
        summary: `${current.name} 학생의 비어 있는 기본정보 보완`,
        autoApplicable: true,
        blocking: false,
        confidence: match.confidence,
        reason: match.reason,
        source: { sheetRowNumber: Number(row.rowNumber || index + 2), matchedBy: match.reason },
        target: { collection: "students", documentId: current.studentUid, updatedAtMs: Number(current.data.updatedAtMs || 0) },
        patch
      }));
    }
  });

  attendanceSheet.rows.forEach((row, index) => {
    const studentMatch = matchStudent(students, row);
    const classMatch = matchClass(classes, row);
    if (studentMatch.state !== "matched" || classMatch.state !== "matched") {
      items.push(makeItem(runId, "manual_review", {
        category: "attendance_roster_reference",
        summary: `출석부 ${Number(row.rowNumber || index + 1)}행 확인 필요`,
        autoApplicable: false,
        blocking: studentMatch.state === "ambiguous" || classMatch.state === "ambiguous",
        confidence: 0,
        reason: `${studentMatch.reason}; ${classMatch.reason}`,
        source: { rowNumber: Number(row.rowNumber || index + 1), row },
        target: { candidateStudentUids: studentMatch.candidates, candidateClassIds: classMatch.candidates },
        patch: { issueType: issueTypeFor(studentMatch, classMatch) }
      }));
      return;
    }
    const key = `${studentMatch.id}|${classMatch.id}`;
    if (!enrollmentKey.has(key)) {
      const student = students.find(item => item.studentUid === studentMatch.id);
      const cls = classes.find(item => item.classId === classMatch.id);
      if (!student || !cls) return;
      items.push(makeItem(runId, "upsert_enrollment_from_sheet", {
        category: "attendance_roster_enrollment",
        summary: `${student.name} → ${cls.className} 수강관계 생성`,
        autoApplicable: true,
        blocking: false,
        confidence: Math.min(studentMatch.confidence, classMatch.confidence),
        reason: `${studentMatch.reason}; ${classMatch.reason}`,
        source: { sheetRowNumber: Number(row.rowNumber || index + 1), row },
        target: { studentUid: student.studentUid, classId: cls.classId, studentUpdatedAtMs: Number(student.data.updatedAtMs || 0), classUpdatedAtMs: Number(cls.data.updatedAtMs || 0) },
        patch: { registrationType: "existing", startDate: dateValue(row.startDate ?? row.registrationDate) || nowSeoulDate() }
      }));
    }
  });

  const collectionNames = allCollections.map(collection => collection.id);
  const subsystemDocs: Record<string, QueryDocumentSnapshot[]> = { attendance: attendanceDocs };
  for (const name of subsystemNames(collectionNames)) {
    if (["students", "classes", "studentEnrollments"].includes(name) || name === "attendance") continue;
    try { subsystemDocs[name] = await loadCollection(name, 15000); } catch { subsystemDocs[name] = []; }
  }
  Object.entries(subsystemDocs).forEach(([collection, docs]) => {
    docs.forEach(doc => {
      const data = object(doc.data());
      const currentStudentUid = text(data.studentUid, 160);
      const currentClassId = text(data.classId, 180);
      if (currentStudentUid && (currentClassId || !text(data.className ?? data.currentClass, 300))) return;
      const studentMatch = currentStudentUid
        ? (students.some(student => student.studentUid === currentStudentUid)
          ? { state: "matched", id: currentStudentUid, reason: "existing studentUid", confidence: 100, candidates: [currentStudentUid] } as MatchResult
          : { state: "unmatched", id: "", reason: "studentUid not found", confidence: 0, candidates: [] } as MatchResult)
        : matchStudent(students, data);
      const needsClass = !currentClassId && Boolean(text(data.className ?? data.currentClass, 300));
      const classMatch = needsClass ? matchClass(classes, data) : { state: "matched", id: currentClassId, reason: currentClassId ? "existing classId" : "class not required", confidence: 100, candidates: currentClassId ? [currentClassId] : [] } as MatchResult;
      if (studentMatch.state === "matched" && classMatch.state === "matched") {
        const patch: PlainObject = {};
        if (!currentStudentUid) patch.studentUid = studentMatch.id;
        if (!currentClassId && classMatch.id) patch.classId = classMatch.id;
        if (Object.keys(patch).length) {
          items.push(makeItem(runId, "link_subsystem_record", {
            category: collection,
            summary: `${collection}/${doc.id} 식별자 연결`,
            autoApplicable: true,
            blocking: false,
            confidence: Math.min(studentMatch.confidence, classMatch.confidence),
            reason: `${studentMatch.reason}; ${classMatch.reason}`,
            source: { collection, documentId: doc.id, updatedAtMs: Number(data.updatedAtMs || 0) },
            target: { collection, documentId: doc.id },
            patch
          }));
        }
      } else {
        items.push(makeItem(runId, "manual_review", {
          category: collection,
          summary: `${collection}/${doc.id} 학생·반 식별 확인 필요`,
          autoApplicable: false,
          blocking: studentMatch.state === "ambiguous" || classMatch.state === "ambiguous",
          confidence: 0,
          reason: `${studentMatch.reason}; ${classMatch.reason}`,
          source: { collection, documentId: doc.id, studentName: text(data.studentName ?? data.name, 160), className: text(data.className ?? data.currentClass, 300) },
          target: { candidateStudentUids: studentMatch.candidates, candidateClassIds: classMatch.candidates },
          patch: { issueType: issueTypeFor(studentMatch, classMatch) }
        }));
      }
    });
  });

  for (const collection of ["classes", "studentEnrollments", "classMembers"]) {
    const docs = collection === "classes" ? classDocs : (collection === "studentEnrollments" ? enrollmentDocs : classMemberDocs);
    docs.forEach(doc => {
      const data = object(doc.data());
      const fields = fixedRoomFields(data);
      if (!fields.length) return;
      items.push(makeItem(runId, "remove_fixed_room_fields", {
        category: collection,
        summary: `${collection}/${doc.id} 고정 강의실 필드 제거`,
        autoApplicable: true,
        blocking: false,
        confidence: 100,
        reason: "강의실은 realtimeClassroomDays 날짜별 사용일지만 사용",
        source: { collection, documentId: doc.id, fields, values: Object.fromEntries(fields.map(field => [field, data[field]])), updatedAtMs: Number(data.updatedAtMs || 0) },
        target: { collection, documentId: doc.id },
        patch: { deleteFields: fields, classroomPolicy: "dynamic_from_realtimeClassroomDays" }
      }));
    });
  }

  if (items.length > ANALYSIS_ITEM_LIMIT) throw new HttpsError("resource-exhausted", `분석 항목이 ${ANALYSIS_ITEM_LIMIT}건을 초과했습니다. 기간 또는 데이터 범위를 나눠주세요.`);
  const countsByType: Record<string, number> = {};
  items.forEach(item => { countsByType[item.type] = (countsByType[item.type] || 0) + 1; });
  const summary: PlainObject = {
    students: students.length,
    classes: classes.length,
    enrollments: enrollmentDocs.length,
    studentSheetRows: studentSheet.rows.length,
    attendanceSheetRows: attendanceSheet.rows.length,
    studentSheetError: studentSheet.error,
    attendanceSheetError: attendanceSheet.error,
    planItems: items.length,
    safeItems: items.filter(item => item.autoApplicable).length,
    manualReviewItems: items.filter(item => item.type === "manual_review").length,
    blockingItems: items.filter(item => item.blocking).length,
    countsByType,
    auditedCollections: Object.fromEntries(Object.entries(subsystemDocs).map(([name, docs]) => [name, docs.length]))
  };
  const sourceFingerprints: PlainObject = {
    students: hash("FP", students.map(item => [item.studentUid, Number(item.data.updatedAtMs || 0)])),
    classes: hash("FP", classes.map(item => [item.classId, Number(item.data.updatedAtMs || 0)])),
    enrollments: hash("FP", enrollmentDocs.map(doc => [doc.id, Number(doc.data()?.updatedAtMs || 0)])),
    studentSheet: hash("FP", studentSheet.rows),
    attendanceSheet: hash("FP", attendanceSheet.rows)
  };
  return { items, summary, sourceFingerprints };
}

export const createDataAuthorityAnalysisAdmin735414 = onCall({ ...CALLABLE_OPTIONS, secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET], timeoutSeconds: 540, memory: "2GiB" }, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data);
  const runId = text(input.runId ?? input.requestId, 160) || `DAR_${Date.now()}_${randomUUID()}`;
  const runRef = db().collection(RUN_COLLECTION).doc(runId);
  const existing = await runRef.get();
  if (existing.exists && text(existing.data()?.state, 40) === "analysis_complete") return { ok: true, reused: true, runId, ...existing.data() };
  await runRef.set({ runId, state: "analyzing", stage: 1, readOnly: true, actorFirebaseUid: caller.uid, startedAtMs: Date.now(), startedAt: FieldValue.serverTimestamp(), version: DATA_AUTHORITY_MIGRATION_735414_VERSION }, { merge: true });
  try {
    const built = await buildAnalysis(caller, runId);
    const digest = planDigest(built.items);
    await writeItems(runId, built.items);
    const issueCount = await writeIssues(runId, caller.uid, built.items);
    const runData = {
      state: "analysis_complete",
      stage: 2,
      readOnly: true,
      planDigest: digest,
      summary: built.summary,
      sourceFingerprints: built.sourceFingerprints,
      issueCount,
      completedAtMs: Date.now(),
      completedAt: FieldValue.serverTimestamp(),
      version: DATA_AUTHORITY_MIGRATION_735414_VERSION
    };
    await runRef.set(runData, { merge: true });
    return { ok: true, runId, ...runData };
  } catch (error) {
    await runRef.set({ state: "analysis_failed", error: text(error instanceof Error ? error.message : error, 1500), failedAtMs: Date.now(), failedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
});

export const getDataAuthorityRunAdmin735414 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: "512MiB" }, async request => {
  await requireSuperAdmin(request);
  const input = object(request.data);
  const runId = text(input.runId, 160);
  if (!runId) throw new HttpsError("invalid-argument", "분석 실행번호가 필요합니다.");
  const run = await db().collection(RUN_COLLECTION).doc(runId).get();
  if (!run.exists) throw new HttpsError("not-found", "분석 실행내역을 찾지 못했습니다.");
  const limit = Math.min(3000, Math.max(1, Number(input.limit || 1000)));
  const itemsSnapshot = await run.ref.collection("items").limit(limit).get();
  const items: PlainObject[] = itemsSnapshot.docs.map(doc => ({ itemId: doc.id, ...doc.data() } as PlainObject));
  items.sort((left, right) => Number(right.blocking === true) - Number(left.blocking === true) || text(left.category).localeCompare(text(right.category), "ko"));
  return { ok: true, runId, run: run.data(), items, returned: items.length, truncated: itemsSnapshot.size >= limit, version: DATA_AUTHORITY_MIGRATION_735414_VERSION };
});

export const approveDataAuthorityPlanAdmin735414 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 300, memory: "1GiB" }, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data);
  const runId = text(input.runId, 160);
  const expectedDigest = text(input.planDigest, 100);
  if (!runId || !expectedDigest) throw new HttpsError("invalid-argument", "실행번호와 계획 검증값이 필요합니다.");
  const runRef = db().collection(RUN_COLLECTION).doc(runId);
  const run = await runRef.get();
  if (!run.exists || text(run.data()?.planDigest, 100) !== expectedDigest) throw new HttpsError("failed-precondition", "분석 계획이 변경되었습니다. 다시 분석해주세요.");
  if (!["analysis_complete", "approval_complete"].includes(text(run.data()?.state, 50))) throw new HttpsError("failed-precondition", "승인할 수 없는 실행 상태입니다.");
  const snapshot = await runRef.collection("items").limit(ANALYSIS_ITEM_LIMIT).get();
  const decisionRows = Array.isArray(input.decisions) ? input.decisions.map(object) : [];
  const decisionMap = new Map(decisionRows.map(row => [text(row.itemId, 160), row]));
  const approveSafe = input.approveSafe === true;
  let approved = 0; let held = 0; let rejected = 0; let unchanged = 0;
  for (let offset = 0; offset < snapshot.docs.length; offset += 350) {
    const batch = db().batch();
    snapshot.docs.slice(offset, offset + 350).forEach(doc => {
      const data = object(doc.data());
      const explicit = decisionMap.get(doc.id);
      let decision = text(explicit?.decision, 20);
      if (!decision && approveSafe && data.autoApplicable === true && data.blocking !== true) decision = "approve";
      if (!decision) { unchanged += 1; return; }
      if (!["approve", "hold", "reject"].includes(decision)) return;
      if (decision === "approve" && (data.autoApplicable !== true || data.blocking === true) && explicit?.manualConfirmation !== "ADMIN_VERIFIED") {
        decision = "hold";
      }
      const approvalStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "hold";
      if (approvalStatus === "approved") approved += 1; else if (approvalStatus === "rejected") rejected += 1; else held += 1;
      batch.set(doc.ref, {
        approvalStatus,
        approvalNote: text(explicit?.note, 1000),
        approvedOverride: object(explicit?.override),
        approvedByFirebaseUid: caller.uid,
        approvedAtMs: Date.now(),
        approvedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  }
  await runRef.set({ state: "approval_complete", stage: 3, approved, held, rejected, approvalActorFirebaseUid: caller.uid, approvedAtMs: Date.now(), approvedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, runId, approved, held, rejected, unchanged, version: DATA_AUTHORITY_MIGRATION_735414_VERSION };
});

function affectedSnapshot(data: PlainObject, keys: string[]): PlainObject {
  return Object.fromEntries(keys.map(key => [key, Object.prototype.hasOwnProperty.call(data, key) ? data[key] : { __missing: true }]));
}
function fieldRestorePatch(snapshot: PlainObject): PlainObject {
  const patch: PlainObject = {};
  Object.entries(snapshot).forEach(([key, value]) => { patch[key] = object(value).__missing === true ? FieldValue.delete() : value; });
  return patch;
}
function parseTimeMinutes(value: unknown): number {
  const match = text(value, 20).match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function sameRunMutation7354143(data: PlainObject, runId: string, actorUid: string): boolean {
  const markers = [
    text(data.dataAuthorityRunId, 160),
    text(data.enrollmentSummaryRunId, 160),
    text(data.identityLinkedByRunId, 160)
  ];
  const markedByRun = markers.includes(runId);
  const actor = text(data.updatedByFirebaseUid, 160);
  return markedByRun && (!actor || actor === actorUid);
}
function assertUnchangedOrSameRun7354143(
  data: PlainObject,
  expectedUpdatedAtMs: number,
  runId: string,
  actorUid: string,
  message: string
): void {
  if (!expectedUpdatedAtMs) return;
  const actualUpdatedAtMs = Number(data.updatedAtMs || 0);
  if (actualUpdatedAtMs === expectedUpdatedAtMs) return;
  if (sameRunMutation7354143(data, runId, actorUid)) return;
  throw new Error(message);
}
function futureDates(weekday: number, startDate: string, days = CLASS_HORIZON_DAYS): string[] {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return [];
  const start = new Date(`${startDate || nowSeoulDate()}T00:00:00+09:00`);
  const result: string[] = [];
  for (let offset = 0; offset <= days; offset += 1) {
    const date = new Date(start.getTime() + offset * 86400000);
    if (date.getDay() !== weekday) continue;
    result.push(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date));
  }
  return result;
}
function classOperationalDates(classData: PlainObject, startDate: string): string[] {
  const today = nowSeoulDate();
  const effectiveStart = dateValue(startDate) || today;
  const explicit = unique(Array.isArray(classData.dates) ? classData.dates : [])
    .map(dateValue)
    .filter(date => Boolean(date) && date >= today && date >= effectiveStart)
    .sort();
  return explicit.length ? explicit : futureDates(Number(classData.weekday ?? -1), effectiveStart);
}
async function applyPlanItem(runId: string, itemDoc: QueryDocumentSnapshot, caller: Caller): Promise<{ ok: boolean; affectedDates: string[]; message: string }> {
  const item = object(itemDoc.data()) as PlanItem;
  const type = text(item.type, 80) as PlanType;
  const target = object(item.target);
  const patch = object(item.patch);
  const snapshotRef = db().collection(RUN_COLLECTION).doc(runId).collection("rollback").doc(itemDoc.id);
  const affectedDates: string[] = [];
  if (type === "fill_missing_student_fields") {
    const ref = db().collection("students").doc(text(target.documentId, 160));
    const current = await ref.get();
    if (!current.exists) throw new Error("학생 문서가 없어 적용할 수 없습니다.");
    const currentData = object(current.data());
    const keys = Object.keys(patch);
    const safePatch: PlainObject = {};
    keys.forEach(key => { if (!text(currentData[key], 5000) && text(patch[key], 5000)) safePatch[key] = patch[key]; });
    await snapshotRef.set({ itemId: itemDoc.id, type, targetPath: ref.path, before: affectedSnapshot(currentData, Object.keys(safePatch)), createdTarget: false, createdAtMs: Date.now(), version: DATA_AUTHORITY_MIGRATION_735414_VERSION });
    if (Object.keys(safePatch).length) await ref.set({ ...safePatch, updatedByFirebaseUid: caller.uid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), dataAuthorityRunId: runId }, { merge: true });
    return { ok: true, affectedDates, message: `학생 필드 ${Object.keys(safePatch).length}개 보완` };
  }
  if (type === "remove_fixed_room_fields") {
    const collection = text(target.collection, 120); const documentId = text(target.documentId, 200);
    const ref = db().collection(collection).doc(documentId); const current = await ref.get();
    if (!current.exists) return { ok: true, affectedDates, message: "이미 삭제된 문서" };
    const fields = Array.isArray(patch.deleteFields) ? patch.deleteFields.map(value => text(value, 50)).filter(Boolean) : [];
    const currentData = object(current.data());
    const sourceUpdatedAt = Number(object(item.source).updatedAtMs || 0);
    assertUnchangedOrSameRun7354143(currentData, sourceUpdatedAt, runId, caller.uid, "강의실 대상 문서가 분석 후 변경되었습니다.");
    const before = affectedSnapshot(currentData, [...fields, "classroomPolicy"]);
    await snapshotRef.set({ itemId: itemDoc.id, type, targetPath: ref.path, before, createdTarget: false, createdAtMs: Date.now(), version: DATA_AUTHORITY_MIGRATION_735414_VERSION });
    const update: PlainObject = { classroomPolicy: "dynamic_from_realtimeClassroomDays", updatedByFirebaseUid: caller.uid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), dataAuthorityRunId: runId };
    fields.forEach(field => { update[field] = FieldValue.delete(); });
    await ref.set(update, { merge: true });
    return { ok: true, affectedDates, message: `고정 강의실 필드 ${fields.length}개 제거` };
  }
  if (type === "sync_student_enrollment_summary") {
    const collection = text(target.collection, 120); const documentId = text(target.documentId, 200);
    if (collection !== "students" || !documentId) throw new Error("학생 수강요약 대상이 올바르지 않습니다.");
    const ref = db().collection(collection).doc(documentId); const current = await ref.get();
    if (!current.exists) throw new Error("학생 문서가 없습니다.");
    const currentData = object(current.data());
    const sourceUpdatedAt = Number(object(item.source).updatedAtMs || 0);
    assertUnchangedOrSameRun7354143(currentData, sourceUpdatedAt, runId, caller.uid, "학생정보가 분석 후 변경되었습니다.");
    await snapshotRef.set({ itemId: itemDoc.id, type, targetPath: ref.path, before: affectedSnapshot(currentData, Object.keys(patch)), createdTarget: false, createdAtMs: Date.now(), version: DATA_AUTHORITY_MIGRATION_735414_VERSION });
    await ref.set({ ...patch, sourceOfTruth: "firestore", enrollmentSummaryRunId: runId, updatedByFirebaseUid: caller.uid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, affectedDates, message: "학생 수강반·담당강사 요약 정리" };
  }
  if (type === "link_subsystem_record") {
    const collection = text(target.collection, 120); const documentId = text(target.documentId, 200);
    const ref = db().collection(collection).doc(documentId); const current = await ref.get();
    if (!current.exists) throw new Error("연결할 운영기록이 없습니다.");
    const currentData = object(current.data());
    const sourceUpdatedAt = Number(object(item.source).updatedAtMs || 0);
    assertUnchangedOrSameRun7354143(currentData, sourceUpdatedAt, runId, caller.uid, "운영기록이 분석 후 변경되었습니다.");
    await snapshotRef.set({ itemId: itemDoc.id, type, targetPath: ref.path, before: affectedSnapshot(currentData, Object.keys(patch)), createdTarget: false, createdAtMs: Date.now(), version: DATA_AUTHORITY_MIGRATION_735414_VERSION });
    await ref.set({ ...patch, sourceOfTruth: "firestore", identityLinkedByRunId: runId, updatedByFirebaseUid: caller.uid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const date = dateValue(currentData.sessionDate ?? currentData.date);
    if (date) affectedDates.push(date);
    return { ok: true, affectedDates, message: "운영기록 UID/classId 연결" };
  }
  if (type === "upsert_enrollment_from_sheet" || type === "repair_enrollment_projection") {
    const studentUid = text(target.studentUid, 160); const classId = text(target.classId, 180);
    const [studentSnap, classSnap] = await Promise.all([db().collection("students").doc(studentUid).get(), db().collection("classes").doc(classId).get()]);
    if (!studentSnap.exists || !classSnap.exists) throw new Error("학생 또는 반 문서가 없어 적용할 수 없습니다.");
    const student = object(studentSnap.data()); const cls = object(classSnap.data());
    const expectedStudentUpdatedAt = Number(target.studentUpdatedAtMs || 0);
    const expectedClassUpdatedAt = Number(target.classUpdatedAtMs || 0);
    assertUnchangedOrSameRun7354143(student, expectedStudentUpdatedAt, runId, caller.uid, "학생정보가 분석 후 변경되었습니다.");
    assertUnchangedOrSameRun7354143(cls, expectedClassUpdatedAt, runId, caller.uid, "반정보가 분석 후 변경되었습니다.");
    const enrollmentId = text(target.enrollmentDocumentId, 200) || enrollmentDocumentId(studentUid, classId); const memberId = classMemberDocumentId(studentUid, classId);
    const enrollmentRef = db().collection("studentEnrollments").doc(enrollmentId); const memberRef = db().collection("classMembers").doc(memberId);
    const [enrollmentSnap, memberSnap] = await Promise.all([enrollmentRef.get(), memberRef.get()]);
    const classIds = unique([...(Array.isArray(student.classUids) ? student.classUids : []), classId]);
    const classNames = unique([...(Array.isArray(student.classNames) ? student.classNames : []), text(cls.className ?? cls.name, 300)]);
    const instructorUids = unique([...(Array.isArray(student.instructorUids) ? student.instructorUids : []), text(cls.instructorUid, 160)]);
    const instructorNames = unique([...(Array.isArray(student.instructorNames) ? student.instructorNames : []), text(cls.instructorName, 160)]);
    const startDate = dateValue(patch.startDate) || nowSeoulDate();
    const requestedMissingDates = Array.isArray(patch.missingAttendanceDates) ? unique(patch.missingAttendanceDates).map(dateValue).filter(Boolean) : [];
    const dates = type === "repair_enrollment_projection" ? requestedMissingDates : classOperationalDates(cls, startDate);
    const attendanceRefs = dates.map(date => db().collection("attendance").doc(attendanceDocumentId(date, classId, studentUid)));
    const attendanceSnaps = attendanceRefs.length ? await db().getAll(...attendanceRefs) : [];
    const createdAttendancePaths = attendanceSnaps.filter(snap => !snap.exists).map(snap => snap.ref.path);
    await snapshotRef.set({
      itemId: itemDoc.id, type,
      targets: [
        { path: enrollmentRef.path, existed: enrollmentSnap.exists, before: enrollmentSnap.exists ? enrollmentSnap.data() : {} },
        { path: memberRef.path, existed: memberSnap.exists, before: memberSnap.exists ? memberSnap.data() : {} },
        { path: studentSnap.ref.path, existed: true, before: affectedSnapshot(student, ["classUids", "classNames", "instructorUids", "instructorNames"]) }
      ],
      createdAttendancePaths,
      createdAtMs: Date.now(), version: DATA_AUTHORITY_MIGRATION_735414_VERSION
    });
    const batch = db().batch();
    const common = {
      studentUid, classId,
      studentName: text(student.name ?? student.studentName, 160),
      className: text(cls.className ?? cls.name, 300),
      instructorUid: text(cls.instructorUid, 160),
      instructorName: text(cls.instructorName, 160),
      startDate, endDate: "", active: true, status: "active", registrationType: text(patch.registrationType, 30) || "existing",
      source: "data_authority_reconciliation_735414", sourceOfTruth: "firestore", dataAuthorityRunId: runId,
      updatedByFirebaseUid: caller.uid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: DATA_AUTHORITY_MIGRATION_735414_VERSION
    };
    batch.set(enrollmentRef, { enrollmentId, ...common, classroomPolicy: "dynamic_from_realtimeClassroomDays" }, { merge: true });
    batch.set(memberRef, { classMemberId: memberId, ...common, enrollmentStatus: "active", classroomPolicy: "dynamic_from_realtimeClassroomDays" }, { merge: true });
    batch.set(studentSnap.ref, { classUids: classIds, classNames, instructorUids, instructorNames, sourceOfTruth: "firestore", dataAuthorityRunId: runId, updatedByFirebaseUid: caller.uid, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    attendanceSnaps.forEach(snap => {
      if (snap.exists) return;
      const date = snap.ref.path.split("/").pop() ? dates[attendanceRefs.findIndex(ref => ref.path === snap.ref.path)] : "";
      if (!date) return;
      affectedDates.push(date);
      batch.create(snap.ref, {
        sessionDate: date, date, studentUid, classId,
        studentName: common.studentName, studentNameSnapshot: common.studentName,
        attendanceNo: text(student.attendanceNo ?? student.studentNo, 40),
        className: common.className, classNameSnapshot: common.className,
        instructorUid: common.instructorUid, instructorName: common.instructorName, instructorNameSnapshot: common.instructorName,
        startTime: text(cls.startTime, 20), endTime: text(cls.endTime, 20), startMinutes: parseTimeMinutes(cls.startTime), endMinutes: parseTimeMinutes(cls.endTime),
        present: false, attendanceStatus: "", remark: "", active: true, enrollmentStatus: "active",
        classroomPolicy: "dynamic_from_realtimeClassroomDays", roomResolutionSource: "pending_classroom_usage_lookup",
        source: "data_authority_reconciliation_735414", sourceOfTruth: "firestore", dataAuthorityRunId: runId,
        createdAtMs: Date.now(), createdAt: FieldValue.serverTimestamp(), updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: DATA_AUTHORITY_MIGRATION_735414_VERSION
      });
    });
    await batch.commit();
    return { ok: true, affectedDates, message: `${type === "repair_enrollment_projection" ? "기존 수강관계 운영연결 보완" : "수강관계 생성"} 및 향후 출석 ${createdAttendancePaths.length}건 준비` };
  }
  throw new Error(`지원하지 않는 계획 유형: ${type}`);
}

export const applyApprovedDataAuthorityPlanAdmin735414 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 540, memory: "2GiB" }, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data); const runId = text(input.runId, 160); const expectedDigest = text(input.planDigest, 100);
  if (!runId || !expectedDigest) throw new HttpsError("invalid-argument", "실행번호와 계획 검증값이 필요합니다.");
  const runRef = db().collection(RUN_COLLECTION).doc(runId); const run = await runRef.get();
  if (!run.exists || text(run.data()?.planDigest, 100) !== expectedDigest) throw new HttpsError("failed-precondition", "계획이 변경되었습니다. 다시 분석해주세요.");
  if (!["approval_complete", "apply_partial"].includes(text(run.data()?.state, 50))) throw new HttpsError("failed-precondition", "관리자 승인 또는 부분 적용 상태에서만 실행할 수 있습니다.");
  const approvedSnapshot = await runRef.collection("items").where("approvalStatus", "==", "approved").limit(APPLY_ITEM_LIMIT).get();
  if (approvedSnapshot.empty) {
    await runRef.set({ state: "apply_complete", stage: 4, applied: 0, applyFailed: 0, affectedDates: [], refreshedDates: [], applyActorFirebaseUid: caller.uid, applyCompletedAtMs: Date.now(), applyCompletedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, runId, applied: 0, failed: 0, results: [], affectedDates: [], refreshedDates: [], message: "적용할 승인 항목이 없어 변경 없이 완료했습니다.", version: DATA_AUTHORITY_MIGRATION_735414_VERSION };
  }
  await runRef.set({ state: "applying", stage: 4, applyStartedAtMs: Date.now(), applyStartedAt: FieldValue.serverTimestamp(), applyActorFirebaseUid: caller.uid }, { merge: true });
  const results: PlainObject[] = [];
  const priorAffectedDates = Array.isArray(run.data()?.affectedDates)
    ? (run.data()?.affectedDates as unknown[]).map(dateValue).filter(Boolean)
    : [];
  const dates = new Set<string>(priorAffectedDates);
  for (const doc of approvedSnapshot.docs) {
    const current = object(doc.data());
    if (text(current.applyStatus, 30) === "complete") { results.push({ itemId: doc.id, ok: true, reused: true }); continue; }
    try {
      const result = await applyPlanItem(runId, doc, caller);
      result.affectedDates.forEach(date => dates.add(date));
      await doc.ref.set({
        applyStatus: "complete",
        applyMessage: result.message,
        applyFailedAtMs: FieldValue.delete(),
        applyFailedAt: FieldValue.delete(),
        appliedByFirebaseUid: caller.uid,
        appliedAtMs: Date.now(),
        appliedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      results.push({ itemId: doc.id, ok: true, message: result.message });
    } catch (error) {
      const message = text(error instanceof Error ? error.message : error, 1500);
      const drifted = /변경되었습니다/.test(message);
      await doc.ref.set({ applyStatus: drifted ? "drifted" : "failed", applyMessage: message, applyFailedAtMs: Date.now(), applyFailedAt: FieldValue.serverTimestamp() }, { merge: true });
      results.push({ itemId: doc.id, ok: false, drifted, message });
    }
  }
  const refreshedNow = dates.size ? await refreshTabletDailySnapshotsForStudentManagement7352(Array.from(dates), `data-authority-${runId}`) : [];
  const priorRefreshedDates = Array.isArray(run.data()?.refreshedDates)
    ? (run.data()?.refreshedDates as unknown[]).map(dateValue).filter(Boolean)
    : [];
  const refreshedDates = unique([...priorRefreshedDates, ...refreshedNow]);
  const success = results.filter(result => result.ok === true).length; const failed = results.length - success;
  await runRef.set({
    state: failed ? "apply_partial" : "apply_complete",
    stage: 4,
    applied: success,
    applyFailed: failed,
    affectedDates: Array.from(dates),
    refreshedDates,
    applyAttemptCount: Number(run.data()?.applyAttemptCount || 0) + 1,
    partialResumeEnabled7354143: true,
    applyCompletedAtMs: Date.now(),
    applyCompletedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: failed === 0, runId, applied: success, failed, results, affectedDates: Array.from(dates), refreshedDates, version: DATA_AUTHORITY_MIGRATION_735414_VERSION };
});

export const rollbackDataAuthorityRunAdmin735414 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 540, memory: "2GiB" }, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data); const runId = text(input.runId, 160);
  if (!runId || text(input.confirmation, 100) !== "ROLLBACK_DATA_AUTHORITY_RUN") throw new HttpsError("invalid-argument", "복구 확인문구가 올바르지 않습니다.");
  const runRef = db().collection(RUN_COLLECTION).doc(runId); const run = await runRef.get();
  if (!run.exists) throw new HttpsError("not-found", "실행내역을 찾지 못했습니다.");
  const currentState = await db().doc(STATE_PATH).get();
  const wasActiveRun = text(currentState.data()?.activatedRunId, 160) === runId && currentState.data()?.firestorePrimary === true;
  if (wasActiveRun) {
    const batch = db().batch();
    batch.set(db().doc(STATE_PATH), {
      firestorePrimary: false, migrationState: "rollback_in_progress", sheetsReadMode: "manual_reconciliation_only", sheetsWriteMode: "backup_only",
      rolledBackRunId: runId, authorityDisabledByFirebaseUid: caller.uid, authorityDisabledAtMs: Date.now(), authorityDisabledAt: FieldValue.serverTimestamp(),
      version: DATA_AUTHORITY_MIGRATION_735414_VERSION
    }, { merge: true });
    batch.set(db().doc("featureFlags/studentManagementV2"), {
      firestoreAuthorityEnabled: false, sheetsImportApplyDisabled: false, sheetsBackupOnly: true, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: DATA_AUTHORITY_MIGRATION_735414_VERSION
    }, { merge: true });
    batch.set(runRef, { authorityDisabledForRollback: true, authorityDisabledAtMs: Date.now(), authorityDisabledAt: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
  }
  const snapshots = await runRef.collection("rollback").limit(APPLY_ITEM_LIMIT).get();
  let restored = 0; let failed = 0;
  for (const snapshot of snapshots.docs.reverse()) {
    try {
      const data = object(snapshot.data());
      const targets = Array.isArray(data.targets) ? data.targets.map(object) : [];
      if (targets.length) {
        for (const target of targets) {
          const path = text(target.path, 500); if (!path) continue;
          const ref = db().doc(path);
          if (target.existed === true) await ref.set(object(target.before), { merge: false }); else await ref.delete();
        }
        const createdPaths = Array.isArray(data.createdAttendancePaths) ? data.createdAttendancePaths.map(value => text(value, 500)).filter(Boolean) : [];
        for (let offset = 0; offset < createdPaths.length; offset += 400) {
          const batch = db().batch(); createdPaths.slice(offset, offset + 400).forEach(path => batch.delete(db().doc(path))); await batch.commit();
        }
      } else {
        const path = text(data.targetPath, 500); if (path) await db().doc(path).set(fieldRestorePatch(object(data.before)), { merge: true });
      }
      const itemRef = runRef.collection("items").doc(snapshot.id);
      await itemRef.set({ applyStatus: "rolled_back", rolledBackByFirebaseUid: caller.uid, rolledBackAtMs: Date.now(), rolledBackAt: FieldValue.serverTimestamp() }, { merge: true });
      restored += 1;
    } catch { failed += 1; }
  }
  await runRef.set({ state: failed ? "rollback_partial" : "rolled_back", rollbackRestored: restored, rollbackFailed: failed, rolledBackByFirebaseUid: caller.uid, rolledBackAtMs: Date.now(), rolledBackAt: FieldValue.serverTimestamp() }, { merge: true });
  if (wasActiveRun) await db().doc(STATE_PATH).set({ migrationState: failed ? "rollback_partial" : "rolled_back", updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: failed === 0, runId, restored, failed, authorityDisabled: wasActiveRun, version: DATA_AUTHORITY_MIGRATION_735414_VERSION };
});

export const activateFirestoreAuthorityAdmin735414 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 180, memory: "512MiB" }, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data); const runId = text(input.runId, 160);
  if (!runId || text(input.confirmation, 100) !== "ACTIVATE_FIRESTORE_AUTHORITY") throw new HttpsError("invalid-argument", "원본 전환 확인문구가 올바르지 않습니다.");
  const run = await db().collection(RUN_COLLECTION).doc(runId).get();
  if (!run.exists || text(run.data()?.state, 50) !== "apply_complete") throw new HttpsError("failed-precondition", "모든 승인 항목이 적용 완료된 뒤 원본 전환을 진행해주세요.");
  const failedItems = await run.ref.collection("items").where("applyStatus", "in", ["failed", "drifted"]).limit(20).get();
  if (!failedItems.empty && input.allowFailedItems !== true) throw new HttpsError("failed-precondition", "적용 실패 또는 분석 후 변경된 항목이 있습니다. 다시 분석하거나 명시적으로 보류 승인해주세요.");
  const openIssues = await db().collection(ISSUE_COLLECTION).where("status", "==", "open").limit(5000).get();
  const config = {
    firestorePrimary: true,
    students: "firestore_primary",
    classes: "firestore_primary",
    studentEnrollments: "firestore_primary",
    attendance: "firestore_primary",
    dailyEvaluations: "firestore_primary",
    tablet: "firestore_primary_derived_snapshot",
    practiceLogs: "firestore_primary",
    roomReservations: "firestore_primary",
    courseApplications: "firestore_primary",
    classroomUsage: "realtimeClassroomDays_dynamic_only",
    classroomFixedInClass: false,
    sheetsReadMode: "reconciliation_reference_only",
    sheetsWriteMode: "backup_only",
    sheetsImportApplyDisabled: true,
    unresolvedIssuesRemainVisible: true,
    activatedRunId: runId,
    openIssueCount: openIssues.size,
    activatedByFirebaseUid: caller.uid,
    activatedAtMs: Date.now(),
    activatedAt: FieldValue.serverTimestamp(),
    version: DATA_AUTHORITY_MIGRATION_735414_VERSION
  };
  const batch = db().batch();
  batch.set(db().doc(STATE_PATH), config, { merge: false });
  batch.set(db().collection("dataAuthorityHistory").doc(`${Date.now()}_${runId}`), config, { merge: false });
  batch.set(db().doc("featureFlags/studentManagementV2"), {
    studentCoreV2Enabled: true,
    adminStudentListV2Enabled: true,
    studentSearchEnrollmentV2Enabled: true,
    tabletApplicationV2Enabled: true,
    autoRegistrationV2Enabled: true,
    firestoreAuthorityEnabled: true,
    sheetsImportApplyDisabled: true,
    sheetsBackupOnly: true,
    updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: DATA_AUTHORITY_MIGRATION_735414_VERSION
  }, { merge: true });
  batch.set(run.ref, { state: "activated", stage: 5, openIssueCountAtActivation: openIssues.size, activatedAtMs: Date.now(), activatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  return { ok: true, runId, openIssueCount: openIssues.size, config, version: DATA_AUTHORITY_MIGRATION_735414_VERSION };
});

function jsonSafe(value: unknown, seen?: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return { __type: "bytes", base64: Buffer.from(value).toString("base64") };
  if (value instanceof Uint8Array) return { __type: "bytes", base64: Buffer.from(value).toString("base64") };
  const source = value as Record<string, unknown>;
  if (typeof source.toDate === "function") {
    try { return (source.toDate as () => Date)().toISOString(); } catch { return text(value, 500); }
  }
  if (typeof source.path === "string" && typeof source.id === "string" && source.firestore) {
    return { __type: "DocumentReference", path: source.path };
  }
  if (typeof source.latitude === "number" && typeof source.longitude === "number") {
    return { __type: "GeoPoint", latitude: source.latitude, longitude: source.longitude };
  }
  const visited = seen ?? new WeakSet<object>();
  if (visited.has(value as object)) return "[Circular]";
  visited.add(value as object);
  if (Array.isArray(value)) {
    const out = value.map(item => jsonSafe(item, visited));
    visited.delete(value as object);
    return out;
  }
  const out: Record<string, unknown> = {};
  Object.entries(source).forEach(([key, item]) => { out[key] = jsonSafe(item, visited); });
  visited.delete(value as object);
  return out;
}

const BACKUP_MAX_ROWS_PER_GAS_REQUEST_7354148 = 20;
const BACKUP_MAX_REQUEST_BYTES_7354148 = 350_000;
const BACKUP_RESUME_ROWS_PER_REQUEST_7354149 = 8;
const BACKUP_RESUME_REQUEST_BYTES_7354149 = 90_000;
const BACKUP_FRAGMENT_THRESHOLD_BYTES_7354149 = 65_000;
const BACKUP_FRAGMENT_CHARS_7354149 = 30_000;
const BACKUP_CALLABLE_TIMEOUT_SECONDS_7354144 = 1800;
const BACKUP_SLICE_MAX_TRANSPORT_REQUESTS_7354150 = 8;
const BACKUP_SLICE_SOFT_LIMIT_MS_7354150 = 8 * 60 * 1000;
const BACKUP_GAS_REQUEST_TIMEOUT_MS_7354150 = 120_000;

function backupErrorMessage7354144(error: unknown): string {
  if (error instanceof Error) return text(error.message || error.name, 1800);
  return text(error, 1800) || "UNKNOWN_BACKUP_ERROR";
}
function backupCollectionKey7354144(collection: string): string {
  return createHash("sha256").update(collection, "utf8").digest("hex").slice(0, 20);
}
function backupIdFromRequest7354144(value: unknown): string {
  const clean = text(value, 180).replace(/[^0-9A-Za-z._:-]/g, "_");
  return clean || `DAB_${Date.now()}_${randomUUID()}`;
}
function splitBackupRows7354148(rows: PlainObject[]): PlainObject[][] {
  if (!rows.length) return [[]];
  const chunks: PlainObject[][] = [];
  let current: PlainObject[] = [];
  let currentBytes = 2;
  rows.forEach(row => {
    const rowBytes = Buffer.byteLength(JSON.stringify(row), "utf8") + 1;
    if (current.length && (
      current.length >= BACKUP_MAX_ROWS_PER_GAS_REQUEST_7354148 ||
      currentBytes + rowBytes > BACKUP_MAX_REQUEST_BYTES_7354148
    )) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(row);
    currentBytes += rowBytes;
  });
  if (current.length) chunks.push(current);
  return chunks;
}
function backupChunkRequestId7354148(backupId: string, collection: string, chunkIndex: number, rows: PlainObject[]): string {
  const digest = createHash("sha256").update(JSON.stringify(rows), "utf8").digest("hex").slice(0, 20);
  return `${backupId}-${backupCollectionKey7354144(collection)}-j8-${String(chunkIndex).padStart(5, "0")}-${digest}`;
}
function backupFailedCollectionNames7354148(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return unique(value.map(item => {
    if (typeof item === "string") return item;
    return text(object(item).collection, 200);
  }));
}
function backupStoredResults7354148(value: unknown): PlainObject[] {
  return Array.isArray(value) ? value.map(object).filter(item => text(item.collection, 200)) : [];
}

function backupFailedCollectionEntry7354149(value: unknown, collection: string): PlainObject {
  if (!Array.isArray(value)) return {};
  const found = value.map(object).find(item => text(item.collection, 200) === collection);
  return found ?? {};
}
function backupResumeSentOffset7354149(stateData: PlainObject, collection: string, maxRows: number): number {
  const failed = backupFailedCollectionEntry7354149(stateData.failedCollections, collection);
  const progress = object(stateData.resumeSentByCollection7354149);
  const candidate = Math.max(Number(failed.sent || 0), Number(progress[collection] || 0));
  if (!Number.isFinite(candidate) || candidate <= 0) return 0;
  return Math.min(maxRows, Math.floor(candidate));
}
function backupResumeBatchRequestId7354149(
  backupId: string,
  collection: string,
  absoluteStart: number,
  rows: PlainObject[]
): string {
  const digest = createHash("sha256").update(JSON.stringify(rows), "utf8").digest("hex").slice(0, 20);
  return `${backupId}-${backupCollectionKey7354144(collection)}-u9-${String(absoluteStart).padStart(6, "0")}-${digest}`;
}
function backupFragmentRequestId7354149(
  backupId: string,
  collection: string,
  absoluteIndex: number,
  documentId: string,
  partIndex: number,
  part: string
): string {
  const digest = createHash("sha256").update(`${documentId}|${partIndex}|${part}`, "utf8").digest("hex").slice(0, 20);
  return `${backupId}-${backupCollectionKey7354144(collection)}-f9-${String(absoluteIndex).padStart(6, "0")}-${String(partIndex).padStart(3, "0")}-${digest}`;
}
function backupStringParts7354149(value: string): string[] {
  const parts: string[] = [];
  for (let offset = 0; offset < value.length; offset += BACKUP_FRAGMENT_CHARS_7354149) {
    parts.push(value.slice(offset, offset + BACKUP_FRAGMENT_CHARS_7354149));
  }
  return parts.length ? parts : [""];
}
function backupContinuationEntry7354150(collection: string, found: number, sent: number): PlainObject {
  return {
    collection,
    found,
    sent,
    ok: false,
    pending: true,
    error: "CONTINUATION_REQUIRED"
  };
}

async function persistBackupContinuation7354150(args: {
  stateRef: DocumentReference;
  runRef: DocumentReference;
  backupId: string;
  full: boolean;
  sinceMs: number;
  allCollections: string[];
  processingCollections: string[];
  preservedResults: PlainObject[];
  completedResults: PlainObject[];
  collection: string;
  found: number;
  sent: number;
  totalSent: number;
  actorUid: string;
  startedAtMs: number;
}): Promise<PlainObject> {
  const pending = backupContinuationEntry7354150(args.collection, args.found, args.sent);
  const combinedResults = [...args.preservedResults, ...args.completedResults, pending];
  const nowMs = Date.now();
  const patch: PlainObject = {
    state: "running",
    incompleteBackupId: args.backupId,
    currentCollection: args.collection,
    results: combinedResults,
    failedCollections: [pending],
    totalSent: args.totalSent,
    continuationRequired: true,
    continuationReason: "BOUNDED_SLICE_COMPLETE",
    updatedAtMs: nowMs,
    updatedAt: FieldValue.serverTimestamp(),
    version: DATA_AUTHORITY_MIGRATION_735414_VERSION,
    boundedBackupContinuation7354150: true
  };
  await Promise.all([
    args.stateRef.set(patch, { merge: true }),
    args.runRef.set({
      ...patch,
      backupId: args.backupId,
      mode: args.full ? "full" : "incremental",
      sinceMs: args.sinceMs,
      collections: args.allCollections,
      processingCollections: args.processingCollections,
      actorFirebaseUid: args.actorUid,
      startedAtMs: args.startedAtMs
    }, { merge: true })
  ]);
  return {
    ok: true,
    complete: false,
    continuationRequired: true,
    continuationReason: "BOUNDED_SLICE_COMPLETE",
    backupId: args.backupId,
    mode: args.full ? "full" : "incremental",
    sinceMs: args.sinceMs,
    results: combinedResults,
    processedResults: args.completedResults,
    failedCollections: [],
    failedCount: 0,
    totalSent: args.totalSent,
    currentCollection: args.collection,
    currentSent: args.sent,
    currentFound: args.found,
    resumed: true,
    processingCollections: args.processingCollections,
    version: DATA_AUTHORITY_MIGRATION_735414_VERSION,
    boundedBackupContinuation7354150: true
  };
}

async function discoverBackupCollections(): Promise<string[]> {
  const names = (await db().listCollections()).map(collection => collection.id);
  return unique([
    "students", "classes", "studentEnrollments", "attendance", "dailyEvaluations", "courseApplications", "courseApplicationWindows", "roomReservations", "attendanceSessionOverrides", "classScheduleChanges", "messageDeliveries", "staffPrivateNotes", "tabletAttendanceEvents", "operationalTemplates", "tabletDailySnapshots", "operationalRealtimeRevisions", "payments",
    ...names.filter(name => /(practice|reservation|courseapplication)/i.test(name))
  ]).filter(name => ![RUN_COLLECTION, ISSUE_COLLECTION, "dataAuthorityBackupRuns"].includes(name));
}
async function runBackup(actorUid: string, full: boolean, requestedBackupId?: unknown): Promise<PlainObject> {
  const stateRef = db().doc(BACKUP_STATE_PATH);
  const state = await stateRef.get();
  const stateData = state.data() ?? {};
  const sinceMs = full ? 0 : Number(stateData.lastSuccessfulBackupAtMs || 0);
  const previousIncompleteId = full && ["running", "partial"].includes(text(stateData.state, 30))
    ? text(stateData.incompleteBackupId, 180)
    : "";
  const backupId = previousIncompleteId || backupIdFromRequest7354144(requestedBackupId);
  const resumed = !!previousIncompleteId;
  const allCollections = await discoverBackupCollections();
  const failedNames = resumed ? backupFailedCollectionNames7354148(stateData.failedCollections) : [];
  const failedNameSet = new Set(failedNames);
  const collections = failedNames.length
    ? allCollections.filter(name => failedNameSet.has(name))
    : allCollections;
  const targetSet = new Set(collections);
  const previousResults = backupStoredResults7354148(stateData.results);
  const preservedResults = resumed
    ? previousResults.filter(result => !targetSet.has(text(result.collection, 200)))
    : [];
  const runRef = db().collection("dataAuthorityBackupRuns").doc(backupId);
  const startedAtMs = Date.now();
  let totalSent = preservedResults.reduce((sum, result) => sum + Number(result.sent || 0), 0);
  await stateRef.set({
    state: "running", incompleteBackupId: backupId, mode: full ? "full" : "incremental", sinceMs,
    collections: allCollections, processingCollections: collections, actorFirebaseUid: actorUid,
    startedAtMs, updatedAtMs: startedAtMs, updatedAt: FieldValue.serverTimestamp(),
    version: DATA_AUTHORITY_MIGRATION_735414_VERSION,
    resumableBackup7354144: true, attendanceResumeJson7354148: true, attendanceOffsetResume7354149: true,
    boundedBackupContinuation7354150: true, continuationRequired: false
  }, { merge: true });
  await runRef.set({
    backupId, mode: full ? "full" : "incremental", sinceMs, collections: allCollections,
    processingCollections: collections, actorFirebaseUid: actorUid,
    state: "running", resumed, startedAtMs, startedAt: FieldValue.serverTimestamp(),
    updatedAtMs: startedAtMs, updatedAt: FieldValue.serverTimestamp(),
    version: DATA_AUTHORITY_MIGRATION_735414_VERSION,
    attendanceResumeJson7354148: true, attendanceOffsetResume7354149: true,
    boundedBackupContinuation7354150: true, continuationRequired: false
  }, { merge: true });

  const results: PlainObject[] = [];
  const failedCollections: PlainObject[] = [];
  let sliceTransportRequests = 0;
  const sliceStartedAtMs = Date.now();
  for (let collectionIndex = 0; collectionIndex < collections.length; collectionIndex += 1) {
    const collection = collections[collectionIndex];
    let docs: QueryDocumentSnapshot[] = [];
    let sent = 0;
    let transportRequests = 0;
    try {
      try {
        const query = sinceMs
          ? db().collection(collection).where("updatedAtMs", ">", sinceMs).limit(MAX_DOCS)
          : db().collection(collection).limit(MAX_DOCS);
        docs = (await query.get()).docs;
      } catch {
        docs = (await db().collection(collection).limit(MAX_DOCS).get()).docs
          .filter(doc => full || Number(doc.data()?.updatedAtMs || 0) > sinceMs);
      }
      const rows = docs.map(doc => ({ documentId: doc.id, data: jsonSafe(doc.data()) })) as PlainObject[];
      const useAttendanceResume7354149 = resumed && collection === "attendance";
      if (useAttendanceResume7354149) {
        const resumeOffset = backupResumeSentOffset7354149(stateData, collection, rows.length);
        sent = resumeOffset;
        totalSent += resumeOffset;
        let cursor = resumeOffset;
        while (cursor < rows.length) {
          const firstRow = rows[cursor];
          const firstData = object(firstRow.data);
          const firstJson = JSON.stringify(firstData);
          const firstBytes = Buffer.byteLength(firstJson, "utf8");
          if (firstBytes > BACKUP_FRAGMENT_THRESHOLD_BYTES_7354149) {
            const documentId = text(firstRow.documentId, 1500);
            const parts = backupStringParts7354149(firstJson);
            if (parts.length > 40) throw new Error(`ATTENDANCE_DOCUMENT_TOO_LARGE_FOR_SHEETS|${documentId}|${parts.length}`);
            for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
              const requestId = backupFragmentRequestId7354149(
                backupId, collection, cursor, documentId, partIndex, parts[partIndex]
              );
              await callGas("firebaseDataAuthorityBackup735414", requestId, {
                backupId, dataset: collection, mode: full ? "full" : "incremental", sinceMs,
                fragmentedRow7354149: true,
                documentId,
                updatedAtMs: Number(firstData.updatedAtMs || firstData.createdAtMs || 0),
                dataJsonPart: parts[partIndex], partIndex, partCount: parts.length,
                absoluteIndex: cursor,
                sourceOfTruth: "firestore", actorFirebaseUid: actorUid,
                version: DATA_AUTHORITY_MIGRATION_735414_VERSION,
                splitCellBackup7354144: true, attendanceOffsetResume7354149: true
              }, BACKUP_GAS_REQUEST_TIMEOUT_MS_7354150);
              transportRequests += 1;
              sliceTransportRequests += 1;
              if (
                sliceTransportRequests >= BACKUP_SLICE_MAX_TRANSPORT_REQUESTS_7354150 ||
                Date.now() - sliceStartedAtMs >= BACKUP_SLICE_SOFT_LIMIT_MS_7354150
              ) {
                return persistBackupContinuation7354150({
                  stateRef,
                  runRef,
                  backupId,
                  full,
                  sinceMs,
                  allCollections,
                  processingCollections: collections,
                  preservedResults,
                  completedResults: results,
                  collection,
                  found: rows.length,
                  sent,
                  totalSent,
                  actorUid,
                  startedAtMs
                });
              }
            }
            cursor += 1;
            sent += 1;
            totalSent += 1;
          } else {
            const batchStart = cursor;
            const batch: PlainObject[] = [];
            let batchBytes = 2;
            while (cursor < rows.length && batch.length < BACKUP_RESUME_ROWS_PER_REQUEST_7354149) {
              const candidate = rows[cursor];
              const candidateJson = JSON.stringify(object(candidate.data));
              const candidateBytes = Buffer.byteLength(candidateJson, "utf8") + 512;
              if (candidateBytes > BACKUP_FRAGMENT_THRESHOLD_BYTES_7354149) break;
              if (batch.length && batchBytes + candidateBytes > BACKUP_RESUME_REQUEST_BYTES_7354149) break;
              batch.push(candidate);
              batchBytes += candidateBytes;
              cursor += 1;
            }
            if (!batch.length) continue;
            const requestId = backupResumeBatchRequestId7354149(backupId, collection, batchStart, batch);
            await callGas("firebaseDataAuthorityBackup735414", requestId, {
              backupId, dataset: collection, mode: full ? "full" : "incremental", sinceMs,
              rows: batch, resumeUpsertRows7354149: true,
              absoluteStart: batchStart,
              sourceOfTruth: "firestore", actorFirebaseUid: actorUid,
              version: DATA_AUTHORITY_MIGRATION_735414_VERSION,
              splitCellBackup7354144: true, attendanceOffsetResume7354149: true
            }, BACKUP_GAS_REQUEST_TIMEOUT_MS_7354150);
            transportRequests += 1;
            sliceTransportRequests += 1;
            sent += batch.length;
            totalSent += batch.length;
          }
          const progressMap = { ...object(stateData.resumeSentByCollection7354149), [collection]: sent };
          const progressPatch = {
            state: "running", currentCollection: collection, currentCollectionIndex: collectionIndex,
            currentSent: sent, currentFound: rows.length, totalSent,
            resumeSentByCollection7354149: progressMap,
            updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp()
          };
          await Promise.all([
            runRef.set(progressPatch, { merge: true }),
            stateRef.set(progressPatch, { merge: true })
          ]);
          if (
            sliceTransportRequests >= BACKUP_SLICE_MAX_TRANSPORT_REQUESTS_7354150 ||
            Date.now() - sliceStartedAtMs >= BACKUP_SLICE_SOFT_LIMIT_MS_7354150
          ) {
            return persistBackupContinuation7354150({
              stateRef,
              runRef,
              backupId,
              full,
              sinceMs,
              allCollections,
              processingCollections: collections,
              preservedResults,
              completedResults: results,
              collection,
              found: rows.length,
              sent,
              totalSent,
              actorUid,
              startedAtMs
            });
          }
        }
      } else {
        const chunks = splitBackupRows7354148(rows);
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
          const requestId = backupChunkRequestId7354148(backupId, collection, chunkIndex, chunks[chunkIndex]);
          await callGas("firebaseDataAuthorityBackup735414", requestId, {
            backupId, dataset: collection, mode: full ? "full" : "incremental", sinceMs,
            rows: chunks[chunkIndex], chunkIndex, chunkCount: chunks.length,
            replaceDataset: full, firstChunk: chunkIndex === 0, lastChunk: chunkIndex === chunks.length - 1,
            sourceOfTruth: "firestore", actorFirebaseUid: actorUid, version: DATA_AUTHORITY_MIGRATION_735414_VERSION,
            splitCellBackup7354144: true, attendanceResumeJson7354148: true
          }, BACKUP_GAS_REQUEST_TIMEOUT_MS_7354150);
          transportRequests += 1;
          sliceTransportRequests += 1;
          sent += chunks[chunkIndex].length;
          totalSent += chunks[chunkIndex].length;
          await runRef.set({
            state: "running", currentCollection: collection, currentCollectionIndex: collectionIndex,
            currentChunk: chunkIndex + 1, currentChunkCount: chunks.length, totalSent,
            updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
        }
      }
      results.push({ collection, found: docs.length, sent, chunks: transportRequests, ok: true });
    } catch (error) {
      const message = backupErrorMessage7354144(error);
      const failed = { collection, found: docs.length, sent, ok: false, error: message };
      results.push(failed);
      failedCollections.push(failed);
      const partialResults = [...preservedResults, ...results];
      await runRef.set({
        state: "partial", currentCollection: collection, lastError: message,
        failedCollections, results: partialResults, totalSent,
        updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  const completedAtMs = Date.now();
  const complete = failedCollections.length === 0;
  const finalState = complete ? "complete" : "partial";
  const combinedResults = [...preservedResults, ...results];
  const logicalTotalSent = combinedResults.reduce((sum, result) => sum + Number(result.sent || 0), 0);
  const statePatch: PlainObject = {
    state: finalState, lastBackupId: backupId, mode: full ? "full" : "incremental", sinceMs,
    collections: allCollections, processingCollections: collections,
    results: combinedResults, failedCollections, totalSent: logicalTotalSent, completedAtMs,
    updatedAtMs: completedAtMs, updatedAt: FieldValue.serverTimestamp(),
    version: DATA_AUTHORITY_MIGRATION_735414_VERSION,
    resumableBackup7354144: true, attendanceResumeJson7354148: true, attendanceOffsetResume7354149: true,
    boundedBackupContinuation7354150: true, continuationRequired: false, complete
  };
  if (complete) {
    statePatch.lastSuccessfulBackupAtMs = completedAtMs;
    statePatch.incompleteBackupId = FieldValue.delete();
  } else {
    statePatch.incompleteBackupId = backupId;
  }
  await stateRef.set(statePatch, { merge: true });
  await runRef.set({
    backupId, mode: full ? "full" : "incremental", sinceMs, collections: allCollections,
    processingCollections: collections, results: combinedResults, failedCollections,
    totalSent: logicalTotalSent, actorFirebaseUid: actorUid, state: finalState, completedAtMs,
    completedAt: FieldValue.serverTimestamp(), updatedAtMs: completedAtMs,
    updatedAt: FieldValue.serverTimestamp(), version: DATA_AUTHORITY_MIGRATION_735414_VERSION,
    resumed, resumableBackup7354144: true, attendanceResumeJson7354148: true, attendanceOffsetResume7354149: true,
    boundedBackupContinuation7354150: true, continuationRequired: false, complete
  }, { merge: true });
  return {
    ok: complete, backupId, mode: full ? "full" : "incremental", sinceMs,
    results: combinedResults, processedResults: results,
    failedCollections, failedCount: failedCollections.length,
    totalSent: logicalTotalSent, completedAtMs, resumed,
    processingCollections: collections,
    resumableBackup7354144: true, attendanceResumeJson7354148: true, attendanceOffsetResume7354149: true,
    boundedBackupContinuation7354150: true, continuationRequired: false, complete
  };
}

export const runFirestoreBackupAdmin735414 = onCall({
  ...CALLABLE_OPTIONS,
  secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET],
  timeoutSeconds: BACKUP_CALLABLE_TIMEOUT_SECONDS_7354144,
  memory: "2GiB"
}, async request => {
  const caller = await requireSuperAdmin(request);
  const input = object(request.data);
  try {
    return {
      ...(await runBackup(caller.uid, input.full === true, input.requestId)),
      version: DATA_AUTHORITY_MIGRATION_735414_VERSION
    };
  } catch (error) {
    const message = backupErrorMessage7354144(error);
    await db().doc(BACKUP_STATE_PATH).set({
      state: "partial", lastError: message, updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(), version: DATA_AUTHORITY_MIGRATION_735414_VERSION
    }, { merge: true });
    throw new HttpsError("internal", `Sheets 백업 처리 실패: ${message}`);
  }
});

export const exportFirestoreBackupsDaily0615Admin735414 = onSchedule({
  schedule: "0 6 * * *", timeZone: "Asia/Seoul", region: ULIM_FUNCTION_REGION,
  secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET], retryCount: 2,
  timeoutSeconds: BACKUP_CALLABLE_TIMEOUT_SECONDS_7354144, memory: "2GiB"
}, async () => { await runBackup("system:daily-0615", false, `daily-${nowSeoulDate()}`); });

export function matchStudentIdentityForTest735414(rawCandidates: PlainObject[], row: PlainObject): MatchResult {
  const candidates: StudentCandidate[] = rawCandidates.map((data, index) => ({
    studentUid: text(data.studentUid ?? data.documentId ?? `S${index}`, 160),
    name: text(data.name ?? data.studentName, 160),
    nameKey: normalizeName(data.name ?? data.studentName),
    birthDate: dateValue(data.birthDate),
    phoneDigits: phone(data.studentPhone ?? data.phone),
    attendanceNo: text(data.attendanceNo ?? data.studentNo, 40),
    data
  }));
  return matchStudent(candidates, row);
}

export function matchClassIdentityForTest735414(rawCandidates: PlainObject[], row: PlainObject): MatchResult {
  const candidates: ClassCandidate[] = rawCandidates.map((data, index) => ({
    classId: text(data.classId ?? data.documentId ?? `C${index}`, 180),
    className: text(data.className ?? data.name, 300),
    nameKey: normalize(data.className ?? data.name),
    instructorUid: text(data.instructorUid, 160),
    instructorName: text(data.instructorName ?? data.teacherName, 160),
    instructorKey: normalizeName(text(data.instructorName ?? data.teacherName, 160).replace(/T$/i, "")),
    weekday: Number(data.weekday ?? -1),
    startTime: text(data.startTime, 20),
    endTime: text(data.endTime, 20),
    data
  }));
  return matchClass(candidates, row);
}
export function operationalDocumentIdsForTest735414(date: string, classId: string, studentUid: string): PlainObject {
  return {
    enrollmentId: enrollmentDocumentId(studentUid, classId),
    classMemberId: classMemberDocumentId(studentUid, classId),
    attendanceId: attendanceDocumentId(date, classId, studentUid)
  };
}

export function classOperationalDatesForTest735414(classData: PlainObject, startDate: string): string[] {
  return classOperationalDates(classData, startDate);
}
