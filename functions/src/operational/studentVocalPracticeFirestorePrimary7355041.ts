import { createHash, createHmac } from "node:crypto";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_LEGACY_PROOF_HMAC_SECRET } from "../common/firebaseSecrets.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";
import { ensureActiveVocalSentenceSet7355063, getVocalSentenceFromSet7355063, ULIM_GEMINI_API_KEY_7355063 } from "./practiceContentFirestorePrimary7355063.js";

export const STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION = "2026-08-16.735.05.0.70-r29.7-practice-actor-own-drive";
export const STUDENT_VOCAL_DRIVE_FOLDER_FIRESTORE_PRIMARY_7355045 = true;
export const STUDENT_VOCAL_DRIVE_RESUMABLE_DIRECT_7355047 = false;
export const STUDENT_VOCAL_DRIVE_RESUMABLE_SERVER_PROXY_7355066 = true;

const CALLABLE_OPTIONS = Object.freeze({
  ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  cors: true,
  invoker: "public" as const,
  timeoutSeconds: 60,
  memory: "256MiB" as const
});
const DEFAULT_VOCAL_DAILY_LIMIT = 1;
const MAX_VOCAL_DAILY_LIMIT = 10;
const MAX_LOGS_PER_MONTH = 400;
const MAX_VOCAL_UPLOAD_BYTES_7355047 = 30 * 1024 * 1024;
const DRIVE_PROXY_CHUNK_BYTES_7355066 = 4 * 1024 * 1024;
const DRIVE_CHUNK_ALIGNMENT_7355066 = 256 * 1024;
const GAS_WEB_APP_URL_7355047 = "https://script.google.com/macros/s/AKfycbyS3QUvrjNbwvaw92_g-QKQyN3Yito8DAdpAjxUzfnsuVf3Ce7ccuaXIv651U7FnYF4/exec";

type PlainObject = Record<string, unknown>;
type StudentCaller = {
  firebaseUid: string;
  studentUid: string;
  student: DocumentData;
};
type StaffCaller7355070 = { firebaseUid:string; role:string; teacherUid:string; displayName:string; user:DocumentData };
type PracticeActor7355070 = {
  kind:"student"|"staff";
  firebaseUid:string;
  ownerUid:string;
  ownerCollection:"students"|"users";
  studentUid:string;
  staffUid:string;
  teacherUid:string;
  role:string;
  displayName:string;
  profile:DocumentData;
};

function app() { return getOrInitializeDefaultFirebaseAdminApp(); }
function db() { return getFirestore(app()); }
function object(value: unknown): PlainObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as PlainObject : {};
}
function text(value: unknown, max = 1000): string { return String(value ?? "").trim().slice(0, max); }
function int(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function roleValue7355070(value: unknown): string {
  const raw = text(value,40).normalize("NFKC").replace(/[\s_-]+/g,"").toLowerCase();
  if (["teacher","강사"].includes(raw)) return "teacher";
  if (["admin","관리자","fulladmin","전체관리","전체관리자","원장"].includes(raw)) return "admin";
  if (["superadmin","superadministrator","최고관리자"].includes(raw)) return "superAdmin";
  if (["student","학생"].includes(raw)) return "student";
  return raw;
}
function hash(...parts: unknown[]): string {
  return createHash("sha256").update(parts.map(part => String(part ?? "")).join("|")).digest("hex");
}
function base64Url7355047(input: Buffer): string {
  return input.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function safeMime7355047(value: unknown): string {
  const mime = text(value, 120).split(";")[0].trim().toLowerCase();
  if (!/^(audio|video)\/[a-z0-9.+-]+$/i.test(mime)) throw new HttpsError("invalid-argument", "녹음 파일 형식을 확인하지 못했습니다.");
  return mime;
}
function driveSessionUrl7355066(value: unknown): string {
  const raw = text(value, 6000);
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new HttpsError("invalid-argument", "Google Drive 업로드 세션 주소가 올바르지 않습니다."); }
  if (parsed.protocol !== "https:" || parsed.hostname !== "www.googleapis.com" || parsed.pathname !== "/upload/drive/v3/files") {
    throw new HttpsError("invalid-argument", "Google Drive 업로드 세션 주소가 올바르지 않습니다.");
  }
  if (parsed.searchParams.get("uploadType") !== "resumable" || !parsed.searchParams.get("upload_id")) {
    throw new HttpsError("invalid-argument", "Google Drive 재개 업로드 세션을 확인하지 못했습니다.");
  }
  return raw;
}
function driveSessionHash7355066(sessionUrl: unknown, folderId: unknown, fileSize: unknown): string {
  return hash("drive-session-7355066", text(sessionUrl, 6000), text(folderId, 180), int(fileSize, 0));
}
function archiveSessionHashes7355066(sessions: unknown[], fileSize: number): string[] {
  return sessions.map(item => {
    const row = object(item);
    const sessionUrl = driveSessionUrl7355066(row.sessionUrl);
    const folderId = text(row.folderId, 180);
    return folderId ? driveSessionHash7355066(sessionUrl, folderId, fileSize) : "";
  }).filter(Boolean);
}
function driveNextOffset7355066(rangeHeader: string): number {
  const match = text(rangeHeader, 200).match(/bytes\s*=\s*0-(\d+)/i);
  return match ? Number(match[1]) + 1 : 0;
}
async function driveResponseJson7355066(response: Response): Promise<PlainObject> {
  try {
    const body = await response.text();
    if (!body) return {};
    const parsed = JSON.parse(body);
    return object(parsed);
  } catch { return {}; }
}
function vocalExtension7355047(mime: string): string {
  const map: Record<string, string> = {
    "audio/mp4":"m4a", "video/mp4":"mp4", "audio/webm":"webm", "video/webm":"webm",
    "audio/wav":"wav", "audio/x-wav":"wav", "audio/mpeg":"mp3", "audio/ogg":"ogg", "video/quicktime":"mov"
  };
  return map[mime] || text(mime.split("/")[1], 12).replace(/[^a-z0-9]/gi, "") || "webm";
}
function safeFilePart7355047(value: unknown, fallback: string): string {
  const cleaned = text(value, 160).normalize("NFKC").replace(/[\\/:*?"<>|#%{}~&]/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^[_ .]+|[_ .]+$/g, "");
  return cleaned || fallback;
}
function kstStamp7355047(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }).formatToParts(date);
  const map: Record<string,string> = {};
  for (const part of parts) if (part.type !== "literal") map[part.type] = part.value;
  return `${map.year}${map.month}${map.day}_${map.hour}${map.minute}${map.second}`;
}
function signVocalGasBridge7355047(action: string, requestId: string, issuedAtMs: number, payloadJson: string): string {
  const secret = ULIM_LEGACY_PROOF_HMAC_SECRET.value() || process.env.ULIM_LEGACY_PROOF_HMAC_SECRET || "";
  if (!secret) throw new HttpsError("failed-precondition", "녹음 보관 서버 인증 설정을 확인하지 못했습니다.");
  return base64Url7355047(createHmac("sha256", secret).update(`v1|${action}|${requestId}|${issuedAtMs}|${payloadJson}`, "utf8").digest());
}
class VocalGasBridgeError7355050 extends Error {
  readonly bridgeCode: string;
  readonly httpStatus: number;
  constructor(message: string, bridgeCode = "VOCAL_BRIDGE_ERROR", httpStatus = 0) {
    super(message);
    this.name = "VocalGasBridgeError7355050";
    this.bridgeCode = bridgeCode;
    this.httpStatus = httpStatus;
  }
}
function vocalBridgeErrorCode7355050(value: unknown): string {
  const raw = text(value, 1600);
  if (/INVALID_VOCAL_BRIDGE_SIGNATURE/i.test(raw)) return "SIGNATURE_MISMATCH";
  if (/DRIVE_RESUMABLE_INIT_403|accessNotConfigured|SERVICE_DISABLED|Drive API has not been used|PERMISSION_DENIED/i.test(raw)) return "DRIVE_API_OR_PERMISSION";
  if (/FOLDER|NO_VOCAL_DRIVE_TARGET|File not found|not found/i.test(raw)) return "DRIVE_FOLDER";
  if (/GAS_HTTP_5\d\d|fetch failed|AbortError|TimeoutError|timed out|ECONNRESET|ENOTFOUND/i.test(raw)) return "TRANSIENT_NETWORK";
  return "VOCAL_BRIDGE_ERROR";
}
function vocalBridgeHttpsError7355050(error: unknown): HttpsError {
  const raw = text((error as Error)?.message ?? error, 1600);
  const code = error instanceof VocalGasBridgeError7355050 ? error.bridgeCode : vocalBridgeErrorCode7355050(raw);
  if (code === "SIGNATURE_MISMATCH") {
    return new HttpsError("failed-precondition", "녹음 보관 서버 인증 연결을 확인해야 합니다. 관리자에게 문의해주세요.", { bridgeCode: code });
  }
  if (code === "DRIVE_API_OR_PERMISSION") {
    return new HttpsError("failed-precondition", "Google Drive 업로드 권한 설정을 확인해야 합니다. 관리자에게 문의해주세요.", { bridgeCode: code });
  }
  if (code === "DRIVE_FOLDER") {
    return new HttpsError("failed-precondition", "담당강사의 Google Drive 녹음 보관폴더 연결을 확인해야 합니다. 관리자에게 문의해주세요.", { bridgeCode: code });
  }
  return new HttpsError("unavailable", "Google Drive 업로드 연결이 지연되었습니다. 잠시 후 다시 시도해주세요.", { bridgeCode: code });
}
async function callVocalGasBridge7355047(action: string, payload: PlainObject): Promise<PlainObject> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const requestId = `VOCAL_BRIDGE_${hash(action, payload.recordId, Date.now(), Math.random(), attempt).slice(0, 32)}`;
    const issuedAtMs = Date.now();
    const payloadJson = JSON.stringify(payload);
    const signature = signVocalGasBridge7355047(action, requestId, issuedAtMs, payloadJson);
    try {
      const response = await fetch(GAS_WEB_APP_URL_7355047, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Accept": "application/json" },
        body: JSON.stringify({ action, requestId, issuedAtMs, payloadJson, signature }),
        redirect: "follow",
        signal: AbortSignal.timeout(24_000)
      });
      const body = await response.text();
      let parsed: PlainObject = {};
      if (body) {
        try { parsed = JSON.parse(body) as PlainObject; }
        catch { throw new VocalGasBridgeError7355050(`GAS_INVALID_JSON:${body.slice(0, 240)}`, "INVALID_RESPONSE", response.status); }
      }
      if (!response.ok) {
        const message = text(parsed.message, 1200) || `GAS_HTTP_${response.status}:${body.slice(0, 240)}`;
        const code = vocalBridgeErrorCode7355050(message);
        if (response.status >= 500 && attempt < 2) { lastError = new VocalGasBridgeError7355050(message, code, response.status); continue; }
        throw new VocalGasBridgeError7355050(message, code, response.status);
      }
      if (text(parsed.status, 40) !== "success" || parsed.ok === false) {
        const message = [text(parsed.code, 160), text(parsed.message, 1200)].filter(Boolean).join(":") || "Google Drive 업로드 브리지를 준비하지 못했습니다.";
        const code = vocalBridgeErrorCode7355050(message);
        throw new VocalGasBridgeError7355050(message, code, response.status);
      }
      return parsed;
    } catch (error) {
      lastError = error;
      const code = error instanceof VocalGasBridgeError7355050 ? error.bridgeCode : vocalBridgeErrorCode7355050((error as Error)?.message ?? error);
      if (code === "TRANSIENT_NETWORK" && attempt < 2) continue;
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new VocalGasBridgeError7355050("VOCAL_BRIDGE_RETRY_EXHAUSTED", "TRANSIENT_NETWORK");
}
function kstDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}`;
}
function requireDate(value: unknown): string {
  const candidate = text(value, 10) || kstDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) throw new HttpsError("invalid-argument", "날짜가 올바르지 않습니다.");
  return candidate;
}
function requireMonth(yearValue: unknown, monthValue: unknown): { year: number; month: number; start: string; end: string } {
  const year = int(yearValue);
  const month = int(monthValue);
  if (year < 2020 || year > 2100 || month < 1 || month > 12) throw new HttpsError("invalid-argument", "조회 월이 올바르지 않습니다.");
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { year, month, start, end };
}
async function requireStudent(request: CallableRequest<unknown>): Promise<StudentCaller> {
  if (!request.auth) throw new HttpsError("unauthenticated", "학생 로그인이 필요합니다.");
  const firebaseUid = request.auth.uid;
  const tokenStudentUid = text(request.auth.token.studentUid, 160);
  const candidates = Array.from(new Set([tokenStudentUid, firebaseUid].filter(Boolean)));
  let studentUid = "";
  let student: DocumentData = {};
  for (const candidate of candidates) {
    const snap = await db().collection("students").doc(candidate).get();
    if (!snap.exists) continue;
    studentUid = snap.id;
    student = snap.data() ?? {};
    break;
  }
  if (!studentUid) throw new HttpsError("permission-denied", "학생 계정 연결정보를 확인하지 못했습니다.");
  const status = text(student.enrollmentStatus ?? student.studentStatus ?? student.status, 40).toLowerCase();
  if (["withdrawn", "cancelled", "퇴원", "등록취소"].includes(status) || student.registrationCancelled === true) {
    throw new HttpsError("permission-denied", "현재 사용할 수 없는 학생 계정입니다.");
  }
  return { firebaseUid, studentUid, student };
}


async function requireStaff7355070(request: CallableRequest<unknown>): Promise<StaffCaller7355070> {
  if (!request.auth) throw new HttpsError("unauthenticated","로그인이 필요합니다.");
  const firebaseUid = text(request.auth.uid,160);
  const role = roleValue7355070(request.auth.token.role);
  if (!["teacher","admin","superAdmin"].includes(role)) throw new HttpsError("permission-denied","교직원 권한이 필요합니다.");
  const userSnap = await db().collection("users").doc(firebaseUid).get();
  if (!userSnap.exists) throw new HttpsError("permission-denied","활성 교직원 정보가 없습니다.");
  const user = userSnap.data() ?? {};
  if (user.active !== true) throw new HttpsError("permission-denied","현재 사용할 수 없는 교직원 계정입니다.");
  const teacherUid = role === "teacher" ? text(request.auth.token.teacherUid ?? user.teacherUid,160) : text(user.teacherUid,160);
  let displayName = text(user.name ?? user.displayName ?? user.teacherName ?? user.adminName ?? request.auth.token.name,120);
  if (!displayName && teacherUid) {
    const teacher = (await db().collection("teachers").doc(teacherUid).get()).data() ?? {};
    displayName = text(teacher.name ?? teacher.teacherName ?? teacher.displayName,120);
  }
  return { firebaseUid, role, teacherUid, displayName, user };
}
async function requirePracticeActor7355070(request: CallableRequest<unknown>): Promise<PracticeActor7355070> {
  if (!request.auth) throw new HttpsError("unauthenticated","로그인이 필요합니다.");
  const role = roleValue7355070(request.auth.token.role);
  if (role === "student" || request.auth.token.studentUid) {
    const caller = await requireStudent(request);
    return {
      kind:"student", firebaseUid:caller.firebaseUid, ownerUid:caller.studentUid, ownerCollection:"students",
      studentUid:caller.studentUid, staffUid:"", teacherUid:"", role:"student",
      displayName:text(caller.student.name ?? caller.student.studentName,120), profile:caller.student
    };
  }
  const caller = await requireStaff7355070(request);
  return {
    kind:"staff", firebaseUid:caller.firebaseUid, ownerUid:caller.firebaseUid, ownerCollection:"users",
    studentUid:"", staffUid:caller.firebaseUid, teacherUid:caller.teacherUid, role:caller.role,
    displayName:caller.displayName, profile:caller.user
  };
}
function actorOwnerRef7355070(actor: PracticeActor7355070) {
  return db().collection(actor.ownerCollection).doc(actor.ownerUid);
}
function actorLogsRef7355070(actor: PracticeActor7355070) {
  return actorOwnerRef7355070(actor).collection("practiceLogs");
}
function actorProgressRef7355070(actor: PracticeActor7355070) {
  return actorOwnerRef7355070(actor).collection("practiceState").doc("vocal");
}
function actorDailyRef7355070(actor: PracticeActor7355070,date:string) {
  return actorOwnerRef7355070(actor).collection("practiceDaily").doc(date);
}
function actorOwnsRow7355070(actor: PracticeActor7355070,row: DocumentData): boolean {
  const ownerKind = text(row.ownerKind,20);
  const ownerUid = text(row.ownerUid,160);
  if (ownerKind && ownerUid) return ownerKind === actor.kind && ownerUid === actor.ownerUid;
  return actor.kind === "student"
    ? text(row.studentUid,160) === actor.studentUid
    : text(row.staffUid ?? row.firebaseUid,160) === actor.firebaseUid;
}

function stringList7355045(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : (text(value, 1000) ? [value] : []);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    for (const part of String(item ?? "").split(/[\n,，、;；|｜\/·ㆍ&]+/)) {
      const cleaned = text(part, 160).replace(/\s*(?:선생님|강사님|강사|쌤)\s*$/g, "").trim();
      if (!cleaned || seen.has(cleaned)) continue;
      seen.add(cleaned);
      result.push(cleaned);
    }
  }
  return result;
}
function studentClassSnapshot7355050D(student: DocumentData): { className: string; classNames: string[]; classUids: string[] } {
  const classNames = stringList7355045([
    ...(Array.isArray(student.classNames) ? student.classNames : []),
    student.className,
    student.currentClass,
    student.studentClass
  ]);
  const classUids = stringList7355045([
    ...(Array.isArray(student.classUids) ? student.classUids : []),
    ...(Array.isArray(student.classIds) ? student.classIds : []),
    ...(Array.isArray(student.selectedClassIds) ? student.selectedClassIds : []),
    student.classUid,
    student.classId
  ]);
  return {
    className: classNames.join(", "),
    classNames,
    classUids
  };
}

async function studentClassSnapshotFromAuthority7355052(
  studentUid: string,
  student: DocumentData
): Promise<{ className: string; classNames: string[]; classUids: string[] }> {
  const base = studentClassSnapshot7355050D(student);
  const classNames = [...base.classNames];
  const classUids = [...base.classUids];
  const nameSet = new Set(classNames);
  const uidSet = new Set(classUids);

  try {
    const enrollmentSnap = await db()
      .collection("studentEnrollments")
      .where("studentUid", "==", studentUid)
      .limit(500)
      .get();

    for (const doc of enrollmentSnap.docs) {
      const row = doc.data() ?? {};
      const active = row.active !== false;
      const state = text(row.status ?? row.enrollmentStatus, 40).toLowerCase();
      if (!active || ["ended", "withdrawn", "cancelled", "퇴원", "등록취소"].includes(state)) continue;

      const className = text(row.className ?? row.currentClass, 300);
      const classUid = text(row.classId ?? row.classUid, 180);

      if (className && !nameSet.has(className)) {
        nameSet.add(className);
        classNames.push(className);
      }
      if (classUid && !uidSet.has(classUid)) {
        uidSet.add(classUid);
        classUids.push(classUid);
      }
    }
  } catch (_enrollmentReadError7355052) {}

  return {
    className: classNames.join(", "),
    classNames,
    classUids
  };
}

function archiveFolderId7355045(value: unknown): string {
  const raw = text(value, 700);
  if (!raw) return "";
  const match = raw.match(/\/folders\/([A-Za-z0-9_-]{10,})/i);
  const candidate = match ? match[1] : (/^[A-Za-z0-9_-]{10,}$/.test(raw) ? raw : "");
  return candidate || "";
}
type ArchiveTarget7355045 = { instructorUid: string; instructor: string; folderId: string };

async function resolveArchiveTargets7355045(student: DocumentData): Promise<{ targets: ArchiveTarget7355045[]; missing: string[] }> {
  const uidCandidates = stringList7355045([
    ...(Array.isArray(student.instructorUids) ? student.instructorUids : []),
    student.instructorUid, ...(Array.isArray(student.teacherUids) ? student.teacherUids : []), student.teacherUid
  ]);
  const nameCandidates = stringList7355045([
    ...(Array.isArray(student.instructorNames) ? student.instructorNames : []),
    student.instructorName, student.instructor,
    ...(Array.isArray(student.teacherNames) ? student.teacherNames : []), student.teacherName
  ]);
  const targets: ArchiveTarget7355045[] = [];
  const missing: string[] = [];
  const usedFolders = new Set<string>();
  const matchedNames = new Set<string>();

  const accept = (uid: string, data: DocumentData, fallbackName = "") => {
    if (data.active === false || data.retired === true) return false;
    const folderId = archiveFolderId7355045(data.driveFolderId);
    if (!folderId) return false;
    const instructor = text(data.name ?? data.displayName ?? fallbackName, 120) || fallbackName || uid;
    if (!usedFolders.has(folderId)) {
      usedFolders.add(folderId);
      targets.push({ instructorUid: text(data.firebaseUid ?? data.principalUidV2 ?? uid, 160) || uid, instructor, folderId });
    }
    if (instructor) matchedNames.add(instructor);
    return true;
  };

  for (const uid of uidCandidates) {
    const userSnap = await db().collection("users").doc(uid).get();
    if (userSnap.exists && accept(userSnap.id, userSnap.data() ?? {})) continue;
    const teacherSnap = await db().collection("teachers").doc(uid).get();
    if (teacherSnap.exists) {
      const teacher = teacherSnap.data() ?? {};
      if (accept(uid, teacher)) continue;
      const firebaseUid = text(teacher.firebaseUid ?? teacher.principalUidV2, 160);
      if (firebaseUid && firebaseUid !== uid) {
        const linked = await db().collection("users").doc(firebaseUid).get();
        if (linked.exists && accept(linked.id, linked.data() ?? {}, text(teacher.name ?? teacher.displayName, 120))) continue;
      }
    }
    missing.push(uid);
  }

  for (const name of nameCandidates) {
    if (Array.from(matchedNames).some(found => found === name)) continue;
    let found = false;
    for (const field of ["name", "displayName"] as const) {
      const query = await db().collection("users").where(field, "==", name).limit(5).get();
      for (const doc of query.docs) {
        if (accept(doc.id, doc.data(), name)) { found = true; break; }
      }
      if (found) break;
    }
    if (!found) missing.push(name);
  }
  return { targets, missing: Array.from(new Set(missing)) };
}

async function resolveStaffArchiveTarget7355070(actor: PracticeActor7355070): Promise<{ targets: ArchiveTarget7355045[]; missing: string[] }> {
  if (actor.kind !== "staff") return resolveArchiveTargets7355045(actor.profile);
  const targets: ArchiveTarget7355045[] = [];
  const missing: string[] = [];
  const accept = (uid:string, data:DocumentData, fallbackName="") => {
    if (data.active === false || data.retired === true) return false;
    const folderId = archiveFolderId7355045(data.driveFolderId);
    if (!folderId) return false;
    targets.push({
      instructorUid:text(data.firebaseUid ?? data.principalUidV2 ?? uid,160) || uid,
      instructor:text(data.name ?? data.displayName ?? data.teacherName ?? fallbackName,120) || fallbackName || actor.displayName || uid,
      folderId
    });
    return true;
  };
  if (accept(actor.firebaseUid,actor.profile,actor.displayName)) return { targets, missing };
  if (actor.teacherUid) {
    const teacherSnap = await db().collection("teachers").doc(actor.teacherUid).get();
    if (teacherSnap.exists) {
      const teacher = teacherSnap.data() ?? {};
      if (accept(actor.teacherUid,teacher,actor.displayName)) return { targets, missing };
      const linkedUid = text(teacher.firebaseUid ?? teacher.principalUidV2,160);
      if (linkedUid && linkedUid !== actor.firebaseUid) {
        const linked = await db().collection("users").doc(linkedUid).get();
        if (linked.exists && accept(linked.id,linked.data() ?? {},actor.displayName)) return { targets, missing };
      }
    }
  }
  /*
   * 관리자/전체관리자가 강사 계정과 별도 Firebase UID를 쓰더라도
   * 동일 인물의 teachers 프로필에 설정된 개인 Drive 폴더를 사용할 수 있게 한다.
   * 이름은 정규화 후 정확히 일치하는 1개 프로필만 허용한다.
   */
  const nameKey = text(actor.displayName,120).normalize("NFKC").replace(/\s+/g,"").replace(/T$/i,"").toLowerCase();
  if (nameKey) {
    const teacherList = await db().collection("teachers").limit(300).get();
    const matches = teacherList.docs.filter(doc => {
      const row = doc.data() ?? {};
      const candidate = text(row.name ?? row.teacherName ?? row.displayName,120).normalize("NFKC").replace(/\s+/g,"").replace(/T$/i,"").toLowerCase();
      return candidate === nameKey;
    });
    if (matches.length === 1 && accept(matches[0].id,matches[0].data() ?? {},actor.displayName)) return { targets, missing };
  }
  missing.push(actor.displayName || actor.firebaseUid);
  return { targets, missing };
}
async function resolveArchiveTargetsForActor7355070(actor: PracticeActor7355070) {
  return actor.kind === "student" ? resolveArchiveTargets7355045(actor.profile) : resolveStaffArchiveTarget7355070(actor);
}
function actorClassSnapshot7355070(actor: PracticeActor7355070): { className:string; classNames:string[]; classUids:string[] } {
  return actor.kind === "student" ? studentClassSnapshot7355050D(actor.profile) : { className:"", classNames:[], classUids:[] };
}

async function settings(): Promise<{ vocalDailyLimit: number; aiAnalysisDailyLimit: number }> {
  const snap = await db().collection("practiceSettings").doc("current").get();
  const data = snap.data() ?? {};
  return {
    vocalDailyLimit: clamp(int(data.vocalDailyLimit, DEFAULT_VOCAL_DAILY_LIMIT), 1, MAX_VOCAL_DAILY_LIMIT),
    aiAnalysisDailyLimit: clamp(int(data.aiAnalysisDailyLimit, 10), 1, 100)
  };
}
function progressRef(studentUid: string) {
  return db().collection("students").doc(studentUid).collection("practiceState").doc("vocal");
}
function dailyRef(studentUid: string, date: string) {
  return db().collection("students").doc(studentUid).collection("practiceDaily").doc(date);
}
function logsRef(studentUid: string) {
  return db().collection("students").doc(studentUid).collection("practiceLogs");
}
function ownerProgressRef7355070(ownerCollection:"students"|"users",ownerUid:string) {
  return db().collection(ownerCollection).doc(ownerUid).collection("practiceState").doc("vocal");
}
function ownerDailyRef7355070(ownerCollection:"students"|"users",ownerUid:string,date:string) {
  return db().collection(ownerCollection).doc(ownerUid).collection("practiceDaily").doc(date);
}
function ownerLogsRef7355070(ownerCollection:"students"|"users",ownerUid:string) {
  return db().collection(ownerCollection).doc(ownerUid).collection("practiceLogs");
}
function sentencePoolBounds7355050(completedCount: number): { start: number; end: number } {
  if (completedCount >= 90) return { start: 91, end: 100 };
  if (completedCount >= 60) return { start: 61, end: 90 };
  if (completedCount >= 30) return { start: 31, end: 60 };
  return { start: 1, end: 30 };
}
function chooseSentenceId7355050(studentUid: string, date: string, cycle: number, completedRaw: unknown, excludedRaw: unknown, currentSentenceId = "", salt = 0): string {
  const completed = new Set((Array.isArray(completedRaw) ? completedRaw : []).map(value => text(value, 20)).filter(Boolean));
  if (completed.size >= 100) completed.clear();
  const excluded = new Set((Array.isArray(excludedRaw) ? excludedRaw : []).map(value => text(value, 20)).filter(Boolean));
  const bounds = sentencePoolBounds7355050(completed.size);
  const inBand: string[] = [];
  for (let id = bounds.start; id <= bounds.end; id += 1) if (!completed.has(String(id))) inBand.push(String(id));
  let candidates = inBand.filter(id => !excluded.has(id));
  if (!candidates.length) candidates = inBand.filter(id => id !== currentSentenceId);
  if (!candidates.length) {
    const remaining: string[] = [];
    for (let id = 1; id <= 100; id += 1) if (!completed.has(String(id)) && String(id) !== currentSentenceId) remaining.push(String(id));
    candidates = remaining.filter(id => !excluded.has(id));
    if (!candidates.length) candidates = remaining;
  }
  if (!candidates.length) candidates = Array.from({ length: 100 }, (_, index) => String(index + 1)).filter(id => id !== currentSentenceId);
  const seed = parseInt(hash(studentUid, date, cycle, currentSentenceId, salt).slice(0, 8), 16);
  return candidates[seed % candidates.length] || currentSentenceId || "1";
}
async function getOrAssignToday(
  ownerCollection: "students"|"users",
  ownerUid: string,
  date: string,
  vocalLimit: number,
  options: { reroll?: boolean; activeSetId?: string } = {}
) {
  const daily = ownerDailyRef7355070(ownerCollection,ownerUid,date);
  const progress = ownerProgressRef7355070(ownerCollection,ownerUid);
  const requestedActiveSetId = text(options.activeSetId, 160);
  return db().runTransaction(async tx => {
    const [dailySnap, progressSnap] = await Promise.all([tx.get(daily), tx.get(progress)]);
    const dailyData = dailySnap.data() ?? {};
    const progressData = progressSnap.data() ?? {};
    const completedCount = Math.max(0, int(dailyData.vocalCompletedCount, 0));
    const storedDailySetId = text(dailyData.vocalSentenceSetId, 160);
    const storedProgressSetId = text(progressData.vocalSentenceSetId, 160);
    const currentSetId = storedDailySetId || requestedActiveSetId || storedProgressSetId;
    if (completedCount >= vocalLimit) {
      return {
        completed: true,
        completedCount,
        sentenceId: text(dailyData.vocalLastSentenceId, 20),
        sentenceSetId: currentSetId,
        cycle: int(progressData.vocalCycle, 1) || 1
      };
    }

    let cycle = int(progressData.vocalCycle, 1) || 1;
    let completedIds = Array.isArray(progressData.vocalCompletedSentenceIds) ? progressData.vocalCompletedSentenceIds : [];
    if (requestedActiveSetId && storedProgressSetId && storedProgressSetId !== requestedActiveSetId && !storedDailySetId) {
      cycle += 1;
      completedIds = [];
      tx.set(progress, {
        vocalCycle: cycle,
        vocalCompletedSentenceIds: [],
        vocalSentenceSetId: requestedActiveSetId,
        sentenceSetChangedAt: FieldValue.serverTimestamp(),
        version: STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
      }, { merge: true });
    } else if (requestedActiveSetId && !storedProgressSetId) {
      tx.set(progress, {
        vocalSentenceSetId: requestedActiveSetId,
        version: STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
      }, { merge:true });
    }
    if (completedIds.length >= 100) {
      cycle += 1;
      completedIds = [];
      tx.set(progress, {
        vocalCycle: cycle,
        vocalCompletedSentenceIds: [],
        cycleResetAt: FieldValue.serverTimestamp(),
        vocalSentenceSetId: requestedActiveSetId || storedProgressSetId,
        version: STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
      }, { merge: true });
    }

    let sentenceId = text(dailyData.vocalCurrentSentenceId, 20);
    let sentenceSetId = storedDailySetId || requestedActiveSetId || storedProgressSetId;
    if (!sentenceSetId) throw new HttpsError("failed-precondition", "발성 문장 세트가 아직 준비되지 않았습니다.");
    const recentIds = Array.isArray(dailyData.vocalRecentSentenceIds)
      ? (dailyData.vocalRecentSentenceIds as unknown[]).map(value => text(value, 20)).filter(Boolean).slice(-12)
      : [];
    const rerollCount = Math.max(0, int(dailyData.vocalRerollCount, 0));
    const wantsReroll = options.reroll === true && !!sentenceId;
    if (!sentenceId) {
      sentenceId = chooseSentenceId7355050(ownerUid, date, cycle, completedIds, recentIds, "", rerollCount);
      tx.set(daily, {
        date,
        vocalCurrentSentenceId: sentenceId,
        vocalSentenceSetId: sentenceSetId,
        vocalRecentSentenceIds: [sentenceId],
        vocalRerollCount: rerollCount,
        vocalCycle: cycle,
        vocalDailyLimit: vocalLimit,
        vocalCompletedCount: completedCount,
        updatedAt: FieldValue.serverTimestamp(),
        version: STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
      }, { merge: true });
    } else if (wantsReroll) {
      const previousSentenceId = sentenceId;
      const nextSentenceId = chooseSentenceId7355050(ownerUid, date, cycle, completedIds, [...recentIds, previousSentenceId], previousSentenceId, rerollCount + 1);
      sentenceId = nextSentenceId || previousSentenceId;
      const nextRecent = Array.from(new Set([...recentIds, previousSentenceId, sentenceId])).slice(-12);
      tx.set(daily, {
        date,
        vocalCurrentSentenceId: sentenceId,
        vocalSentenceSetId: sentenceSetId,
        vocalRecentSentenceIds: nextRecent,
        vocalRerollCount: rerollCount + 1,
        vocalCycle: cycle,
        vocalDailyLimit: vocalLimit,
        vocalCompletedCount: completedCount,
        updatedAt: FieldValue.serverTimestamp(),
        version: STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
      }, { merge: true });
    }
    return { completed: false, completedCount, sentenceId, sentenceSetId, cycle, rerollCount: wantsReroll ? rerollCount + 1 : rerollCount };
  });
}
export const getStudentVocalPracticeToday7355041 = onCall(
  { ...CALLABLE_OPTIONS, secrets:[ULIM_GEMINI_API_KEY_7355063], timeoutSeconds:180, memory:"512MiB" },
  async request => {
    const actor = await requirePracticeActor7355070(request);
    const data = object(request.data);
    const date = requireDate(data.date);
    const config = await settings();
    const activeSet = await ensureActiveVocalSentenceSet7355063({ force:false, actor:`${actor.kind}:${actor.ownerUid}` });
    const assigned = await getOrAssignToday(actor.ownerCollection,actor.ownerUid,date,config.vocalDailyLimit,{
      reroll:data.reroll === true,
      activeSetId:activeSet.setId
    });
    let sentence: PlainObject | null = null;
    if (assigned.sentenceId && assigned.sentenceSetId) sentence = await getVocalSentenceFromSet7355063(assigned.sentenceSetId,assigned.sentenceId);
    return {
      ok:true,
      version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION,
      actorKind:actor.kind, ownerUid:actor.ownerUid, studentUid:actor.studentUid, staffUid:actor.staffUid,
      displayName:actor.displayName, date, dailyLimit:config.vocalDailyLimit, aiAnalysisDailyLimit:config.aiAnalysisDailyLimit,
      ...assigned, sentence
    };
  }
);

export const beginStudentVocalPracticeCompletion7355041 = onCall({ ...CALLABLE_OPTIONS, secrets:[ULIM_LEGACY_PROOF_HMAC_SECRET] }, async request => {
  const actor = await requirePracticeActor7355070(request);
  const data = object(request.data);
  const date = requireDate(data.date);
  const sentenceId = text(data.sentenceId,20);
  if (!sentenceId) throw new HttpsError("invalid-argument","연습 문장 정보가 없습니다.");
  const mimeType = safeMime7355047(data.mimeType || "audio/mp4");
  const fileSize = Math.max(0,int(data.fileSize,0));
  if (!fileSize || fileSize > MAX_VOCAL_UPLOAD_BYTES_7355047) throw new HttpsError("invalid-argument","녹음 파일은 30MB 이하만 보관할 수 있습니다.");
  const config = await settings();
  const requestedSentenceSetId = text(data.sentenceSetId,160);
  const assigned = await getOrAssignToday(actor.ownerCollection,actor.ownerUid,date,config.vocalDailyLimit,{ activeSetId:requestedSentenceSetId });
  if (assigned.completed) throw new HttpsError("already-exists","오늘은 연습을 완료했습니다.");
  if (assigned.sentenceId !== sentenceId) throw new HttpsError("failed-precondition","오늘 배정된 문장이 변경되었습니다. 문장을 다시 불러와주세요.");
  if (requestedSentenceSetId && assigned.sentenceSetId && requestedSentenceSetId !== assigned.sentenceSetId) {
    throw new HttpsError("failed-precondition","오늘 배정된 발성 문장 세트가 변경되었습니다. 문장을 다시 불러와주세요.");
  }
  const archiveResolution = await resolveArchiveTargetsForActor7355070(actor);
  if (!archiveResolution.targets.length) {
    throw new HttpsError("failed-precondition",actor.kind === "staff"
      ? "본인 Google Drive 녹음 보관폴더가 등록되지 않았습니다. 관리자 계정 설정에서 Drive 폴더를 확인해주세요."
      : "담당강사의 Google Drive 녹음 보관폴더가 등록되지 않았습니다. 관리자에게 문의해주세요.");
  }
  const recordId = `VOC_${date.replace(/-/g,"")}_${hash(actor.ownerUid,date,sentenceId,assigned.cycle).slice(0,24)}`;
  const participantNameRaw = actor.displayName || (actor.kind === "student" ? "학생" : "교직원");
  const participantName = safeFilePart7355047(participantNameRaw,actor.kind === "student" ? "student" : "staff");
  const classSnapshot = actor.kind === "student"
    ? await studentClassSnapshotFromAuthority7355052(actor.studentUid,actor.profile)
    : { className:"", classNames:[], classUids:[] };
  const fileName = safeFilePart7355047(`울림_발성훈련_녹음_${participantName}_${sentenceId}_${kstStamp7355047()}`,"ulim_vocal") + "." + vocalExtension7355047(mimeType);
  const ref = actorLogsRef7355070(actor).doc(recordId);
  await ref.set({
    recordId, taskType:"vocal", recordType:"발성훈련",
    ownerKind:actor.kind, ownerUid:actor.ownerUid, firebaseUid:actor.firebaseUid,
    studentUid:actor.studentUid, staffUid:actor.staffUid, participantName:participantNameRaw, studentName:participantNameRaw,
    teacherUid:actor.teacherUid, role:actor.role,
    className:classSnapshot.className, classNames:classSnapshot.classNames, classUids:classSnapshot.classUids,
    practiceDate:date, sentenceId, sentenceSetId:text(assigned.sentenceSetId,160), cycleKey:`cycle-${assigned.cycle}`,
    state:"pending_archive", archiveState:"session_pending", archiveTransportMode:"drive_resumable_server_proxy_7355066",
    archiveTargetCount:archiveResolution.targets.length, archiveTargets:archiveResolution.targets,
    archiveTargetUids:archiveResolution.targets.map(target => target.instructorUid),
    archiveTargetFolderIds:archiveResolution.targets.map(target => target.folderId),
    archiveTargetMissing:archiveResolution.missing,
    archiveTargetSource:actor.kind === "staff" ? "firestore_self_drive_folder_7355070" : "firestore_staff_drive_folder_7355045",
    archiveFileName:fileName, mimeType, fileSize, startedAt:FieldValue.serverTimestamp(),
    updatedAt:FieldValue.serverTimestamp(), version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
  },{merge:true});

  let bridge: PlainObject;
  try {
    bridge = await callVocalGasBridge7355047("createVocalDriveUploadSessions7355047",{
      recordId, studentUid:actor.ownerUid, ownerKind:actor.kind, ownerUid:actor.ownerUid,
      date, sentenceId, fileName, mimeType, fileSize, targets:archiveResolution.targets
    });
  } catch (error) {
    const bridgeError = vocalBridgeHttpsError7355050(error);
    await ref.set({
      archiveState:"session_error", archiveError:text((error as Error)?.message,800),
      archiveErrorCode:text((bridgeError.details as PlainObject | undefined)?.bridgeCode,120) || vocalBridgeErrorCode7355050((error as Error)?.message),
      updatedAt:FieldValue.serverTimestamp()
    },{merge:true});
    throw bridgeError;
  }
  const sessions = Array.isArray(bridge.sessions) ? bridge.sessions : [];
  if (!sessions.length) {
    await ref.set({ archiveState:"session_error", archiveError:"NO_RESUMABLE_SESSION", updatedAt:FieldValue.serverTimestamp() },{merge:true});
    throw new HttpsError("unavailable","Google Drive 업로드 세션을 만들지 못했습니다.");
  }
  const sessionHashes = archiveSessionHashes7355066(sessions,fileSize);
  if (sessionHashes.length !== sessions.length) {
    await ref.set({ archiveState:"session_error", archiveError:"INVALID_RESUMABLE_SESSION_7355066", updatedAt:FieldValue.serverTimestamp() },{merge:true});
    throw new HttpsError("unavailable","Google Drive 업로드 세션을 검증하지 못했습니다.");
  }
  await ref.set({
    archiveState:"session_ready", archiveSessionCount:sessions.length, archiveSessionHashes:sessionHashes,
    archiveSessionErrors:Array.isArray(bridge.errors)?bridge.errors:[], archiveTransportMode:"drive_resumable_server_proxy_7355066",
    updatedAt:FieldValue.serverTimestamp()
  },{merge:true});
  return {
    ok:true, actorKind:actor.kind, ownerUid:actor.ownerUid, recordId, date, sentenceId,
    sentenceSetId:text(assigned.sentenceSetId,160), cycle:assigned.cycle, dailyLimit:config.vocalDailyLimit,
    archiveTargets:archiveResolution.targets, archiveTargetMissing:archiveResolution.missing,
    archiveTargetSource:actor.kind === "staff" ? "firestore_self_drive_folder_7355070" : "firestore_staff_drive_folder_7355045",
    archiveTransportMode:"drive_resumable_server_proxy_7355066", archiveFileName:fileName, archiveUploadSessions:sessions
  };
});

export const uploadStudentPracticeDriveChunk7355066 = onCall(
  { ...CALLABLE_OPTIONS, timeoutSeconds:60, memory:"512MiB" },
  async request => {
    const actor = await requirePracticeActor7355070(request);
    const data = object(request.data);
    const recordId = text(data.recordId, 100);
    const folderId = text(data.folderId, 180);
    const sessionUrl = driveSessionUrl7355066(data.sessionUrl);
    const start = int(data.start, -1);
    const total = Math.max(0, int(data.total, 0));
    if (!recordId || !folderId || start < 0 || !total || total > MAX_VOCAL_UPLOAD_BYTES_7355047) {
      throw new HttpsError("invalid-argument", "녹음 업로드 구간 정보가 올바르지 않습니다.");
    }
    const ref = actorLogsRef7355070(actor).doc(recordId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "연습 기록을 찾지 못했습니다.");
    const row = snap.data() ?? {};
    if (!actorOwnsRow7355070(actor,row)) throw new HttpsError("permission-denied","본인의 연습 기록만 업로드할 수 있습니다.");
    if (!["session_ready","uploading_proxy"].includes(text(row.archiveState,50))) {
      throw new HttpsError("failed-precondition", "Google Drive 업로드 세션이 준비되지 않았습니다.");
    }
    const expectedTotal = Math.max(0, int(row.fileSize, 0));
    if (!expectedTotal || expectedTotal !== total) throw new HttpsError("failed-precondition", "업로드 파일 크기가 준비 단계와 일치하지 않습니다.");
    const targetFolders = Array.isArray(row.archiveTargetFolderIds) ? row.archiveTargetFolderIds.map(value => text(value,180)).filter(Boolean) : [];
    if (!targetFolders.includes(folderId)) throw new HttpsError("permission-denied","발급된 본인/담당 보관폴더와 일치하지 않습니다.");
    const allowedHashes = Array.isArray(row.archiveSessionHashes) ? row.archiveSessionHashes.map(value => text(value,100)).filter(Boolean) : [];
    const suppliedHash = driveSessionHash7355066(sessionUrl, folderId, total);
    if (!allowedHashes.length || !allowedHashes.includes(suppliedHash)) throw new HttpsError("permission-denied", "발급된 Google Drive 업로드 세션과 일치하지 않습니다.");

    const rawBase64 = text(data.chunkBase64, 8 * 1024 * 1024).replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
    if (!rawBase64) throw new HttpsError("invalid-argument", "업로드할 녹음 데이터가 없습니다.");
    let chunk: Buffer;
    try { chunk = Buffer.from(rawBase64, "base64"); } catch { throw new HttpsError("invalid-argument", "녹음 데이터 인코딩을 확인하지 못했습니다."); }
    if (!chunk.length || chunk.length > DRIVE_PROXY_CHUNK_BYTES_7355066) throw new HttpsError("invalid-argument", "녹음 업로드 조각 크기가 허용 범위를 벗어났습니다.");
    const end = start + chunk.length - 1;
    if (end >= total) throw new HttpsError("invalid-argument", "녹음 업로드 범위가 전체 파일 크기를 초과합니다.");
    if (end < total - 1 && chunk.length % DRIVE_CHUNK_ALIGNMENT_7355066 !== 0) {
      throw new HttpsError("invalid-argument", "중간 업로드 조각은 256KB 배수여야 합니다.");
    }
    const mimeType = safeMime7355047(data.mimeType || row.mimeType || "audio/mp4");
    if (text(row.mimeType,120) && safeMime7355047(row.mimeType) !== mimeType) throw new HttpsError("failed-precondition", "업로드 파일 형식이 준비 단계와 일치하지 않습니다.");

    try {
      const response = await fetch(sessionUrl, {
        method:"PUT",
        headers:{
          "Content-Type":mimeType,
          "Content-Range":`bytes ${start}-${end}/${total}`
        },
        body:chunk,
        redirect:"manual",
        signal:AbortSignal.timeout(45_000)
      });
      if (response.status === 200 || response.status === 201) {
        const metadata = await driveResponseJson7355066(response);
        return {
          ok:true, complete:true, recordId, folderId, nextOffset:total,
          fileId:text(metadata.id,180),
          webViewLink:text(metadata.webViewLink,3000),
          fileName:text(metadata.name ?? row.archiveFileName,500),
          version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
        };
      }
      if (response.status === 308) {
        const nextOffset = driveNextOffset7355066(response.headers.get("range") || response.headers.get("Range") || "");
        return { ok:true, complete:false, recordId, folderId, nextOffset, version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION };
      }
      const body = text(await response.text(), 600);
      if (response.status === 404) throw new HttpsError("failed-precondition", "Google Drive 업로드 세션이 만료되었습니다. 다시 저장해주세요.");
      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        throw new HttpsError("unavailable", "Google Drive 파일 전송이 지연되었습니다. 잠시 후 다시 시도해주세요.", { status:response.status });
      }
      throw new HttpsError("failed-precondition", `Google Drive 파일 전송에 실패했습니다. (${response.status})`, { status:response.status, detail:body });
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("unavailable", "Google Drive 파일 전송 연결이 지연되었습니다. 잠시 후 다시 시도해주세요.");
    }
  }
);

export const finalizeStudentVocalPractice7355041 = onCall(
  { ...CALLABLE_OPTIONS, timeoutSeconds:30, memory:"256MiB" },
  async request => {
    const actor = await requirePracticeActor7355070(request);
    const data = object(request.data);
    const date = requireDate(data.date);
    const recordId = text(data.recordId,100);
    const sentenceId = text(data.sentenceId,20);
    if (!recordId || !sentenceId) throw new HttpsError("invalid-argument","연습 기록 식별값이 없습니다.");
    const log = actorLogsRef7355070(actor).doc(recordId);
    const preSnap = await log.get();
    if (!preSnap.exists || !actorOwnsRow7355070(actor,preSnap.data() ?? {})) throw new HttpsError("not-found","연습 기록을 찾지 못했습니다.");
    const before = preSnap.data() ?? {};
    if (text(before.practiceDate,10) !== date || text(before.sentenceId,20) !== sentenceId) {
      throw new HttpsError("failed-precondition","업로드 준비 당시의 날짜/문장과 완료 요청이 일치하지 않습니다.");
    }
    if (text(before.state,40) === "complete" || before.vocalCompletionApplied === true) {
      return {
        ok:true, accepted:true, duplicate:true, recordId, state:text(before.state,40) || "processing_archive",
        archiveState:text(before.archiveState,50) || "upload_received",
        fileUrl:text(before.fileUrl ?? before.audioUrl,3000),
        version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
      };
    }
    const driveUploads = Array.isArray(data.driveUploads)
      ? data.driveUploads.map(item => object(item)).filter(item => text(item.fileId,180) || text(item.folderId,180))
      : [];
    if (!driveUploads.length) throw new HttpsError("failed-precondition","Google Drive 업로드 결과가 없습니다.");
    const config = await settings();
    const daily = actorDailyRef7355070(actor,date);
    const progress = actorProgressRef7355070(actor);
    const classSnapshot = actor.kind === "student"
      ? await studentClassSnapshotFromAuthority7355052(actor.studentUid,actor.profile)
      : { className:"", classNames:[], classUids:[] };
    await db().runTransaction(async tx => {
      const [dailySnap,progressSnap,logSnap] = await Promise.all([tx.get(daily),tx.get(progress),tx.get(log)]);
      const dailyData = dailySnap.data() ?? {};
      const progressData = progressSnap.data() ?? {};
      const logData = logSnap.data() ?? {};
      if (logData.vocalCompletionApplied === true || text(logData.state,40) === "complete") return;
      const currentSentenceId = text(dailyData.vocalCurrentSentenceId,20);
      if (currentSentenceId && currentSentenceId !== sentenceId) throw new HttpsError("failed-precondition","오늘 배정된 문장과 완료 문장이 다릅니다.");
      const count = Math.max(0,int(dailyData.vocalCompletedCount,0));
      const cycle = int(dailyData.vocalCycle,int(progressData.vocalCycle,1) || 1) || 1;
      const sentenceSetId = text(logData.sentenceSetId ?? dailyData.vocalSentenceSetId ?? progressData.vocalSentenceSetId,160);
      tx.set(log,{
        ownerKind:actor.kind, ownerUid:actor.ownerUid, firebaseUid:actor.firebaseUid,
        studentUid:actor.studentUid, staffUid:actor.staffUid, participantName:actor.displayName, studentName:actor.displayName,
        taskType:"vocal", recordType:"발성훈련",
        className:classSnapshot.className, classNames:classSnapshot.classNames, classUids:classSnapshot.classUids,
        sentenceId, vocalId:sentenceId, sentenceSetId,
        cycleKey:text(data.cycleKey,80) || `cycle-${cycle}`, sentence:text(data.sentence,5000),
        originalSentence:text(data.originalSentence ?? data.sentence,5000), standardPronunciation:text(data.standardPronunciation,5000),
        recognizedText:text(data.recognizedText ?? data.localWhisperText,8000),
        aiSource:text(data.aiSource,300), aiComment:text(data.aiComment,12000), analysisText:text(data.analysisText,16000),
        driveUploads, mimeType:text(data.mimeType,120) || text(logData.mimeType,120),
        fileSize:Math.max(0,int(data.fileSize,int(logData.fileSize,0))),
        archiveState:"upload_received", state:"processing_archive", archiveError:"", archiveErrorCode:"",
        archiveNextAttemptAtMs:Date.now(), finalizeLeaseUntilMs:0, vocalCompletionApplied:true,
        uploadAcceptedAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp(),
        version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
      },{merge:true});
      tx.set(daily,{
        date, vocalCompletedCount:Math.min(config.vocalDailyLimit,Math.max(count + 1,1)),
        vocalLastSentenceId:sentenceId, vocalCurrentSentenceId:FieldValue.delete(), vocalSentenceSetId:sentenceSetId,
        vocalDailyLimit:config.vocalDailyLimit, updatedAt:FieldValue.serverTimestamp(),
        version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
      },{merge:true});
      tx.set(progress,{
        vocalCycle:cycle, vocalSentenceSetId:sentenceSetId, vocalCompletedSentenceIds:FieldValue.arrayUnion(sentenceId),
        vocalLastCompletedDate:date, vocalLastSentenceId:sentenceId, updatedAt:FieldValue.serverTimestamp(),
        version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
      },{merge:true});
    });
    return {
      ok:true, accepted:true, processing:true, duplicate:false, actorKind:actor.kind, ownerUid:actor.ownerUid,
      recordId, state:"processing_archive", archiveState:"upload_received",
      version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
    };
  }
);

export const getStudentVocalPracticeCompletionStatus7355052 = onCall(
  { ...CALLABLE_OPTIONS, timeoutSeconds:20, memory:"256MiB" },
  async request => {
    const actor = await requirePracticeActor7355070(request);
    const data = object(request.data);
    const recordId = text(data.recordId,100);
    const requestedDate = text(data.date,10);
    if (!recordId) throw new HttpsError("invalid-argument","연습 기록 식별값이 없습니다.");
    const ref = actorLogsRef7355070(actor).doc(recordId);
    const snap = await ref.get();
    if (!snap.exists) return { ok:true, version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION, recordId, completed:false, state:"missing" };
    const row = snap.data() ?? {};
    if (!actorOwnsRow7355070(actor,row)) throw new HttpsError("permission-denied","본인의 연습 기록만 확인할 수 있습니다.");
    if (requestedDate && text(row.practiceDate,10) && text(row.practiceDate,10) !== requestedDate) {
      throw new HttpsError("failed-precondition","연습 기록 날짜가 일치하지 않습니다.");
    }
    let className = text(row.className,300);
    let classNames = Array.isArray(row.classNames) ? row.classNames.map(item => text(item,300)).filter(Boolean) : [];
    let classUids = Array.isArray(row.classUids) ? row.classUids.map(item => text(item,180)).filter(Boolean) : [];
    if (actor.kind === "student" && (!className || !classNames.length)) {
      const repaired = await studentClassSnapshotFromAuthority7355052(actor.studentUid,actor.profile);
      if (repaired.classNames.length) {
        className = className || repaired.className;
        classNames = classNames.length ? classNames : repaired.classNames;
        classUids = classUids.length ? classUids : repaired.classUids;
        await ref.set({ className, classNames, classUids, updatedAt:FieldValue.serverTimestamp() },{merge:true});
      }
    }
    const state = text(row.state,40);
    const fileUrl = text(row.fileUrl ?? row.audioUrl,3000);
    return {
      ok:true, version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION,
      actorKind:actor.kind, ownerUid:actor.ownerUid, recordId, completed:state === "complete" && !!fileUrl,
      state, archiveState:text(row.archiveState,50), archiveError:text(row.archiveError,800),
      archiveErrorCode:text(row.archiveErrorCode,120), fileUrl, audioUrl:fileUrl,
      fileId:text(row.fileId,1000), folderId:text(row.folderId,1000),
      archiveCopies:Array.isArray(row.archiveCopies) ? row.archiveCopies : [], className, classNames, classUids
    };
  }
);

export const attachStudentVocalPracticeArchive7355041 = onCall(CALLABLE_OPTIONS, async request => {
  await requirePracticeActor7355070(request);
  throw new HttpsError(
    "failed-precondition",
    "0.47부터 발성훈련 Drive 링크는 서버 검증 finalize에서만 기록합니다. 기존 archive attach 경로는 폐쇄되었습니다."
  );
});


function normalizePracticeTaskType7355054(value: unknown): "standard_pronunciation" | "past_question" {
  const raw = text(value, 80).toLowerCase().replace(/[\s-]+/g, "_");
  if (["standard_pronunciation", "standard", "pronunciation", "pron", "표준발음"].includes(raw)) return "standard_pronunciation";
  if (["past_question", "past", "pastquestion", "기출", "기출문제"].includes(raw)) return "past_question";
  throw new HttpsError("invalid-argument", "지원하지 않는 연습기록 종류입니다.");
}
function practiceRecordType7355054(taskType: "standard_pronunciation" | "past_question"): string {
  return taskType === "standard_pronunciation" ? "표준발음" : "기출문제";
}
function practiceRecordPrefix7355054(taskType: "standard_pronunciation" | "past_question"): string {
  return taskType === "standard_pronunciation" ? "PRON" : "PAST";
}
function practiceFileLabel7355054(taskType: "standard_pronunciation" | "past_question"): string {
  return taskType === "standard_pronunciation" ? "표준발음" : "기출문제";
}
function sanitizeProvidedRecordId7355054(value: unknown, prefix: string): string {
  const raw = text(value, 100);
  if (!raw) return "";
  if (!new RegExp("^" + prefix + "_[A-Za-z0-9_-]{8,90}$", "i").test(raw)) return "";
  return raw;
}

export const beginStudentPracticeArchive7355054 = onCall(
  { ...CALLABLE_OPTIONS, secrets:[ULIM_LEGACY_PROOF_HMAC_SECRET], timeoutSeconds:60, memory:"256MiB" },
  async request => {
    const actor = await requirePracticeActor7355070(request);
    const data = object(request.data);
    const taskType = normalizePracticeTaskType7355054(data.taskType ?? data.recordCategory ?? data.category);
    const date = requireDate(data.date ?? data.practiceDate);
    const mimeType = safeMime7355047(data.mimeType || "audio/mp4");
    const fileSize = Math.max(0,int(data.fileSize,0));
    if (!fileSize || fileSize > MAX_VOCAL_UPLOAD_BYTES_7355047) throw new HttpsError("invalid-argument","녹음 파일은 30MB 이하만 보관할 수 있습니다.");
    const archiveResolution = await resolveArchiveTargetsForActor7355070(actor);
    if (!archiveResolution.targets.length) {
      throw new HttpsError("failed-precondition",actor.kind === "staff"
        ? "본인 Google Drive 녹음 보관폴더가 등록되지 않았습니다. 관리자 계정 설정에서 Drive 폴더를 확인해주세요."
        : "담당강사의 Google Drive 녹음 보관폴더가 등록되지 않았습니다. 관리자에게 문의해주세요.");
    }
    const prefix = practiceRecordPrefix7355054(taskType);
    const identityPart = text(data.sentenceId ?? data.vocalId ?? data.scriptId ?? data.questionId,120) || "direct";
    const suppliedRecordId = sanitizeProvidedRecordId7355054(data.recordId,prefix);
    const recordId = suppliedRecordId || `${prefix}_${date.replace(/-/g,"")}_${hash(actor.ownerUid,date,taskType,identityPart,Date.now(),Math.random()).slice(0,24)}`;
    const participantNameRaw = actor.displayName || (actor.kind === "student" ? "학생" : "교직원");
    const participantName = safeFilePart7355047(participantNameRaw,actor.kind === "student" ? "student" : "staff");
    const classSnapshot = actor.kind === "student"
      ? await studentClassSnapshotFromAuthority7355052(actor.studentUid,actor.profile)
      : { className:"", classNames:[], classUids:[] };
    const scriptLabel = safeFilePart7355047(identityPart,"record");
    const fileName = safeFilePart7355047(
      `울림_${practiceFileLabel7355054(taskType)}_녹음_${participantName}_${scriptLabel}_${kstStamp7355047()}`,
      `ulim_${taskType}`
    ) + "." + vocalExtension7355047(mimeType);
    const ref = actorLogsRef7355070(actor).doc(recordId);
    await ref.set({
      recordId, taskType, recordType:practiceRecordType7355054(taskType),
      ownerKind:actor.kind, ownerUid:actor.ownerUid, firebaseUid:actor.firebaseUid,
      studentUid:actor.studentUid, staffUid:actor.staffUid, participantName:participantNameRaw, studentName:participantNameRaw,
      teacherUid:actor.teacherUid, role:actor.role,
      className:classSnapshot.className, classNames:classSnapshot.classNames, classUids:classSnapshot.classUids,
      practiceDate:date,
      sentenceId:text(data.sentenceId ?? data.vocalId ?? data.scriptId ?? data.questionId,180),
      vocalId:text(data.vocalId ?? data.sentenceId ?? data.scriptId ?? data.questionId,180),
      sentence:text(data.sentence ?? data.originalSentence,12000),
      originalSentence:text(data.originalSentence ?? data.sentence,12000),
      standardPronunciation:text(data.standardPronunciation,12000),
      scriptSource:text(data.scriptSource ?? data.source,1000), scriptFileId:text(data.scriptFileId,300),
      scriptFileName:text(data.scriptFileName,500), gender:text(data.gender,40), analysisMode:text(data.analysisMode,80),
      state:"pending_archive", archiveState:"session_pending", archiveTransportMode:"drive_resumable_server_proxy_7355066",
      archiveTargetCount:archiveResolution.targets.length, archiveTargets:archiveResolution.targets,
      archiveTargetUids:archiveResolution.targets.map(target => target.instructorUid),
      archiveTargetFolderIds:archiveResolution.targets.map(target => target.folderId),
      archiveTargetMissing:archiveResolution.missing,
      archiveTargetSource:actor.kind === "staff" ? "firestore_self_drive_folder_7355070" : "firestore_staff_drive_folder_7355045",
      archiveFileName:fileName, mimeType, fileSize, startedAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp(), version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
    },{merge:true});
    let bridge: PlainObject;
    try {
      bridge = await callVocalGasBridge7355047("createVocalDriveUploadSessions7355047",{
        recordId, studentUid:actor.ownerUid, ownerKind:actor.kind, ownerUid:actor.ownerUid, date,
        sentenceId:text(data.sentenceId ?? data.vocalId ?? data.scriptId ?? data.questionId,180),
        fileName, mimeType, fileSize, targets:archiveResolution.targets
      });
    } catch (error) {
      const bridgeError = vocalBridgeHttpsError7355050(error);
      await ref.set({
        archiveState:"session_error", archiveError:text((error as Error)?.message,800),
        archiveErrorCode:text((bridgeError.details as PlainObject | undefined)?.bridgeCode,120) || vocalBridgeErrorCode7355050((error as Error)?.message),
        updatedAt:FieldValue.serverTimestamp()
      },{merge:true});
      throw bridgeError;
    }
    const sessions = Array.isArray(bridge.sessions) ? bridge.sessions : [];
    if (!sessions.length) {
      await ref.set({ archiveState:"session_error", archiveError:"NO_RESUMABLE_SESSION", updatedAt:FieldValue.serverTimestamp() },{merge:true});
      throw new HttpsError("unavailable","Google Drive 업로드 세션을 만들지 못했습니다.");
    }
    const sessionHashes = archiveSessionHashes7355066(sessions,fileSize);
    if (sessionHashes.length !== sessions.length) {
      await ref.set({ archiveState:"session_error", archiveError:"INVALID_RESUMABLE_SESSION_7355066", updatedAt:FieldValue.serverTimestamp() },{merge:true});
      throw new HttpsError("unavailable","Google Drive 업로드 세션을 검증하지 못했습니다.");
    }
    await ref.set({
      archiveState:"session_ready", archiveSessionCount:sessions.length, archiveSessionHashes:sessionHashes,
      archiveSessionErrors:Array.isArray(bridge.errors) ? bridge.errors : [],
      archiveTransportMode:"drive_resumable_server_proxy_7355066", updatedAt:FieldValue.serverTimestamp()
    },{merge:true});
    return {
      ok:true, actorKind:actor.kind, ownerUid:actor.ownerUid,
      version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION,
      recordId, taskType, recordType:practiceRecordType7355054(taskType), date,
      archiveTargets:archiveResolution.targets, archiveTargetMissing:archiveResolution.missing,
      archiveTargetSource:actor.kind === "staff" ? "firestore_self_drive_folder_7355070" : "firestore_staff_drive_folder_7355045",
      archiveTransportMode:"drive_resumable_server_proxy_7355066", archiveFileName:fileName, archiveUploadSessions:sessions
    };
  }
);

export const finalizeStudentPracticeArchive7355054 = onCall(
  { ...CALLABLE_OPTIONS, timeoutSeconds:30, memory:"256MiB" },
  async request => {
    const actor = await requirePracticeActor7355070(request);
    const data = object(request.data);
    const recordId = text(data.recordId,100);
    if (!recordId) throw new HttpsError("invalid-argument","연습 기록 식별값이 없습니다.");
    const log = actorLogsRef7355070(actor).doc(recordId);
    const preSnap = await log.get();
    if (!preSnap.exists || !actorOwnsRow7355070(actor,preSnap.data() ?? {})) throw new HttpsError("not-found","연습 기록을 찾지 못했습니다.");
    const before = preSnap.data() ?? {};
    const taskType = normalizePracticeTaskType7355054(before.taskType);
    if (text(before.state,40) === "complete") {
      return {
        ok:true, accepted:true, duplicate:true, processing:false, actorKind:actor.kind, ownerUid:actor.ownerUid,
        recordId, taskType, fileUrl:text(before.fileUrl ?? before.audioUrl,3000),
        fileId:text(before.fileId,1000), folderId:text(before.folderId,1000),
        archiveState:text(before.archiveState,50) || "complete",
        version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
      };
    }
    const driveUploads = Array.isArray(data.driveUploads)
      ? data.driveUploads.map(item => object(item)).filter(item => text(item.fileId,180) || text(item.folderId,180))
      : [];
    if (!driveUploads.length) throw new HttpsError("failed-precondition","Google Drive 업로드 결과가 없습니다.");
    const analysis = object(data.analysis);
    const classSnapshot = actor.kind === "student"
      ? await studentClassSnapshotFromAuthority7355052(actor.studentUid,actor.profile)
      : { className:"", classNames:[], classUids:[] };
    await log.set({
      ownerKind:actor.kind, ownerUid:actor.ownerUid, firebaseUid:actor.firebaseUid,
      studentUid:actor.studentUid, staffUid:actor.staffUid, participantName:actor.displayName, studentName:actor.displayName,
      taskType, recordType:practiceRecordType7355054(taskType),
      className:classSnapshot.className, classNames:classSnapshot.classNames, classUids:classSnapshot.classUids,
      sentence:text(data.sentence ?? before.sentence,12000),
      originalSentence:text(data.originalSentence ?? before.originalSentence ?? data.sentence ?? before.sentence,12000),
      standardPronunciation:text(data.standardPronunciation ?? before.standardPronunciation,12000),
      recognizedText:text(data.recognizedText ?? data.localWhisperText ?? analysis.recognizedText,12000),
      localWhisperText:text(data.localWhisperText ?? data.recognizedText ?? analysis.recognizedText,12000),
      aiSource:text(data.aiSource ?? analysis.provider ?? analysis.model,300),
      aiComment:text(data.aiComment ?? analysis.comment ?? analysis.analysisText,16000),
      analysisText:text(data.analysisText ?? analysis.analysisText ?? analysis.comment,20000),
      analysisSummary:Object.keys(analysis).length ? analysis : (before.analysisSummary ?? null),
      scriptSource:text(data.scriptSource ?? before.scriptSource,1000),
      scriptFileId:text(data.scriptFileId ?? before.scriptFileId,300),
      scriptFileName:text(data.scriptFileName ?? before.scriptFileName,500),
      gender:text(data.gender ?? before.gender,40), analysisMode:text(data.analysisMode ?? before.analysisMode,80),
      driveUploads, mimeType:text(data.mimeType,120) || text(before.mimeType,120),
      fileSize:Math.max(0,int(data.fileSize,int(before.fileSize,0))),
      archiveState:"upload_received", state:"processing_archive", archiveError:"", archiveErrorCode:"",
      archiveNextAttemptAtMs:Date.now(), finalizeLeaseUntilMs:0, uploadAcceptedAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp(), version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
    },{merge:true});
    return {
      ok:true, accepted:true, processing:true, duplicate:false, actorKind:actor.kind, ownerUid:actor.ownerUid,
      recordId, taskType, recordType:practiceRecordType7355054(taskType),
      state:"processing_archive", archiveState:"upload_received",
      version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
    };
  }
);

async function finalizePracticeDriveRecord7355063(ownerCollection:"students"|"users", ownerUid:string, recordId:string): Promise<{ done:boolean; skipped?:boolean }> {
  const ref = ownerLogsRef7355070(ownerCollection,ownerUid).doc(recordId);
  const now = Date.now();
  const claimed = await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const row = snap.data() ?? {};
    if (text(row.state,40) === "complete") return { complete:true, row };
    const archiveState = text(row.archiveState,50);
    if (!["upload_received","finalize_retry","finalize_processing"].includes(archiveState)) return null;
    if (archiveState === "finalize_processing" && int(row.finalizeLeaseUntilMs,0) > now) return null;
    if (int(row.archiveNextAttemptAtMs,0) > now) return null;
    const attempt = Math.max(0,int(row.finalizeAttempt,0)) + 1;
    tx.set(ref, {
      archiveState:"finalize_processing",
      finalizeAttempt:attempt,
      finalizeLeaseUntilMs:now + 120000,
      archiveError:"",
      updatedAt:FieldValue.serverTimestamp()
    }, { merge:true });
    return { complete:false, row:{ ...row, finalizeAttempt:attempt } as PlainObject };
  });
  if (!claimed) return { done:false, skipped:true };
  if (claimed.complete) return { done:true };
  const row = claimed.row as PlainObject;
  const targets: PlainObject[] = Array.isArray(row.archiveTargets)
    ? (row.archiveTargets as unknown[]).map(item => object(item)).filter(item => text(item.folderId,180))
    : (Array.isArray(row.archiveTargetFolderIds) ? (row.archiveTargetFolderIds as unknown[]).map(folderId => ({ folderId:text(folderId,180) })) : []);
  const uploads: PlainObject[] = Array.isArray(row.driveUploads)
    ? (row.driveUploads as unknown[]).map(item => object(item)).filter(item => text(item.fileId,180) || text(item.folderId,180))
    : [];
  try {
    if (!targets.length || !uploads.length) throw new Error("DRIVE_FINALIZE_TARGET_OR_UPLOAD_MISSING");
    const bridge = await callVocalGasBridge7355047("finalizeVocalDriveUploadSessions7355047", {
      recordId,
      studentUid:ownerUid,
      ownerCollection,
      ownerUid,
      fileName:text(row.archiveFileName,240),
      mimeType:text(row.mimeType,120),
      fileSize:int(row.fileSize,0),
      targets,
      uploads
    });
    const archiveCopies = Array.isArray(bridge.files) ? bridge.files.map(item => object(item)) : [];
    if (!archiveCopies.length) throw new Error("NO_FINALIZED_VOCAL_FILE_7355063");
    const first = archiveCopies[0] || {};
    const firstFileId = text(first.fileId,180);
    const fileUrl = text(first.fileUrl ?? first.webViewLink,3000) || (firstFileId ? `https://drive.google.com/file/d/${encodeURIComponent(firstFileId)}/view` : "");
    const fileId = archiveCopies.map(item => text(item.fileId,180)).filter(Boolean).join(",");
    const folderId = archiveCopies.map(item => text(item.folderId,180)).filter(Boolean).join(",");
    if (!fileUrl) throw new Error("DRIVE_FINALIZE_FILE_ID_MISSING_7355065");
    const archiveState = archiveCopies.length < Math.max(1,int(row.archiveTargetCount,1)) ? "partial_success" : "complete";
    const completedPatch7355067 = {
      fileUrl,
      audioUrl:fileUrl,
      fileId,
      folderId,
      archiveCopies,
      archiveWarnings:[...(Array.isArray(bridge.warnings) ? bridge.warnings : []), ...archiveCopies.map(item => text(item.shareWarning,500)).filter(Boolean)],
      archiveState,
      archiveTransportMode:"drive_resumable_server_proxy_async_finalize_7355067",
      state:"complete",
      finalizeLeaseUntilMs:0,
      archiveNextAttemptAtMs:0,
      archiveError:"",
      archiveErrorCode:"",
      completedAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp(),
      version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION
    };
    const practiceRecordRef7355067 = db().collection("practiceRecords").doc(recordId);
    const practiceRecordSnap7355067 = await practiceRecordRef7355067.get();
    const batch7355067 = db().batch();
    batch7355067.set(ref, completedPatch7355067, { merge:true });
    if (practiceRecordSnap7355067.exists) {
      batch7355067.set(practiceRecordRef7355067, {
        fileUrl,
        audioUrl:fileUrl,
        fileId,
        folderId,
        archiveState,
        uploadState:"complete",
        updatedAtMs:Date.now(),
        updatedAt:FieldValue.serverTimestamp()
      }, { merge:true });
    }
    await batch7355067.commit();
    return { done:true };
  } catch (error) {
    const attempt = Math.max(1,int(row.finalizeAttempt,1));
    const delayMs = Math.min(15 * 60_000, Math.max(15_000, Math.pow(2,Math.min(attempt,8)) * 1000));
    await ref.set({
      archiveState:"finalize_retry",
      state:"processing_archive",
      finalizeLeaseUntilMs:0,
      archiveNextAttemptAtMs:Date.now() + delayMs,
      archiveError:text((error as Error)?.message ?? error,1200),
      archiveErrorCode:vocalBridgeErrorCode7355050((error as Error)?.message ?? error),
      updatedAt:FieldValue.serverTimestamp()
    }, { merge:true });
    return { done:false };
  }
}

export const finalizeStudentPracticeDriveUpload7355063 = onDocumentUpdated(
  {
    document:"students/{studentUid}/practiceLogs/{recordId}",
    region:"asia-northeast3",
    secrets:[ULIM_LEGACY_PROOF_HMAC_SECRET]
  },
  async event => {
    if (!event.data) return;
    const before = event.data.before.data() ?? {};
    const after = event.data.after.data() ?? {};
    if (text(after.archiveState,50) !== "upload_received" || text(before.archiveState,50) === "upload_received") return;
    await finalizePracticeDriveRecord7355063("students",text(event.params.studentUid,160),text(event.params.recordId,100));
  }
);

export const finalizeStaffPracticeDriveUpload7355070 = onDocumentUpdated(
  {
    document:"users/{staffUid}/practiceLogs/{recordId}",
    region:"asia-northeast3",
    secrets:[ULIM_LEGACY_PROOF_HMAC_SECRET]
  },
  async event => {
    if (!event.data) return;
    const before = event.data.before.data() ?? {};
    const after = event.data.after.data() ?? {};
    if (text(after.archiveState,50) !== "upload_received" || text(before.archiveState,50) === "upload_received") return;
    await finalizePracticeDriveRecord7355063("users",text(event.params.staffUid,160),text(event.params.recordId,100));
  }
);

export const sweepStudentPracticeDriveFinalize7355063 = onSchedule(
  {
    schedule:"every 5 minutes",
    timeZone:"Asia/Seoul",
    region:"asia-northeast3",
    secrets:[ULIM_LEGACY_PROOF_HMAC_SECRET],
    retryCount:0
  },
  async () => {
    const now = Date.now();
    const snap = await db().collectionGroup("practiceLogs")
      .where("archiveState","in",["upload_received","finalize_retry","finalize_processing"])
      .limit(60)
      .get();
    for (const doc of snap.docs) {
      const row = doc.data() ?? {};
      if (int(row.archiveNextAttemptAtMs,0) > now) continue;
      if (text(row.archiveState,50) === "finalize_processing" && int(row.finalizeLeaseUntilMs,0) > now) continue;
      const ownerUid = text(doc.ref.parent.parent?.id,160);
      const ownerCollection = text(doc.ref.parent.parent?.parent?.id,40);
      if (!ownerUid || !["students","users"].includes(ownerCollection)) continue;
      await finalizePracticeDriveRecord7355063(ownerCollection as "students"|"users",ownerUid,doc.id);
    }
  }
);


export const markStudentPracticeLogsViewed7355054 = onCall(CALLABLE_OPTIONS, async request => {
  const actor = await requirePracticeActor7355070(request);
  const data = object(request.data);
  const raw = Array.isArray(data.recordIds) ? data.recordIds : [];
  const ids = Array.from(new Set(raw.map(value => text(value,100)).filter(Boolean))).slice(0,100);
  if (!ids.length) return { ok:true, updated:0, version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION };
  const batch = db().batch();
  let updated = 0;
  for (const recordId of ids) {
    const ref = actorLogsRef7355070(actor).doc(recordId);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const row = snap.data() ?? {};
    if (!actorOwnsRow7355070(actor,row)) continue;
    batch.set(ref,{
      studentViewed:actor.kind === "student" ? "열람" : text(row.studentViewed,40),
      hasUnreadTeacherEvaluation:actor.kind === "student" ? false : row.hasUnreadTeacherEvaluation,
      studentViewedAt:actor.kind === "student" ? FieldValue.serverTimestamp() : row.studentViewedAt,
      updatedAt:FieldValue.serverTimestamp()
    },{merge:true});
    updated += 1;
  }
  if (updated) await batch.commit();
  return { ok:true, updated, actorKind:actor.kind, version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION };
});

export const listStudentPracticeLogs7355041 = onCall(CALLABLE_OPTIONS, async request => {
  const actor = await requirePracticeActor7355070(request);
  const data = object(request.data);
  const range = requireMonth(data.year,data.month);
  const snap = await actorLogsRef7355070(actor)
    .where("practiceDate",">=",range.start)
    .where("practiceDate","<",range.end)
    .limit(MAX_LOGS_PER_MONTH)
    .get();
  const logs = snap.docs
    .map(doc => ({ recordId:doc.id, ...doc.data() }))
    .filter(row => text((row as PlainObject).state,40) !== "deleted")
    .sort((a,b) => text((a as PlainObject).practiceDate,20).localeCompare(text((b as PlainObject).practiceDate,20)));
  return {
    ok:true, status:"success", version:STUDENT_VOCAL_PRACTICE_FIRESTORE_PRIMARY_7355041_VERSION,
    actorKind:actor.kind, ownerUid:actor.ownerUid, year:range.year, month:range.month, logs, count:logs.length
  };
});
