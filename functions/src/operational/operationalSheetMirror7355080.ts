import { createHmac, randomUUID } from "node:crypto";
import { getFirestore, type DocumentData } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";

export const OPERATIONAL_SHEET_MIRROR_7355080_VERSION =
  "2026-08-16.735.05.0.80-r29.9-firestore-to-sheets-only";

const ULIM_LEGACY_PROOF_HMAC_SECRET = defineSecret("ULIM_LEGACY_PROOF_HMAC_SECRET");
const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbyS3QUvrjNbwvaw92_g-QKQyN3Yito8DAdpAjxUzfnsuVf3Ce7ccuaXIv651U7FnYF4/exec";
const ACTION = "firestoreOperationalSheetMirror7355080";
const MAX_ATTENDANCE_ROWS = 1200;
const MAX_CLASSROOM_ROWS = 500;

type PlainObject = Record<string, unknown>;

function db() {
  return getFirestore(getOrInitializeDefaultFirebaseAdminApp());
}
function object(value: unknown): PlainObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as PlainObject : {};
}
function text(value: unknown, max = 1000): string {
  return String(value ?? "").trim().slice(0, max);
}
function dateText(value: unknown): string {
  const v = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new HttpsError("invalid-argument","날짜 형식이 올바르지 않습니다.");
  return v;
}
function kstDateOffset(days: number): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000 + days * 86400000).toISOString().slice(0,10);
}
function base64Url(input: Buffer): string {
  return input.toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}
function sign(action: string, requestId: string, issuedAtMs: number, payloadJson: string): string {
  const secret = ULIM_LEGACY_PROOF_HMAC_SECRET.value();
  if (!secret) throw new Error("ULIM_LEGACY_PROOF_HMAC_SECRET_NOT_CONFIGURED");
  return base64Url(createHmac("sha256",secret).update(`v1|${action}|${requestId}|${issuedAtMs}|${payloadJson}`,"utf8").digest());
}
function sanitizeAttendanceDoc(id: string, data: DocumentData): PlainObject {
  return {
    documentId:id,
    active:data.active !== false,
    date:text(data.sessionDate ?? data.date,10),
    sessionDate:text(data.sessionDate ?? data.date,10),
    classId:text(data.classId,180),
    className:text(data.className,400),
    teacherUid:text(data.teacherUid,180),
    instructor:text(data.instructor ?? data.teacherName,140),
    studentUid:text(data.studentUid,180),
    studentName:text(data.studentName ?? data.name,140),
    studentNo:text(data.studentNo ?? data.attendanceNo,80),
    attendanceStatus:text(data.attendanceStatus ?? data.status,60),
    status:text(data.status ?? data.attendanceStatus,60),
    specialStatus:text(data.specialStatus,100),
    updatedAtMs:Number(data.updatedAtMs || 0)
  };
}
function sanitizeClassroomRecord(value: unknown): PlainObject {
  const data = object(value);
  return {
    recordId:text(data.recordId ?? data.id,180),
    status:text(data.status ?? data.state,60),
    roomName:text(data.roomName ?? data.classroom ?? data.room,140),
    classroom:text(data.classroom ?? data.roomName ?? data.room,140),
    classId:text(data.classId,180),
    className:text(data.className ?? data.purpose ?? data.lessonName ?? data.title,400),
    teacherUid:text(data.teacherUid ?? data.instructorUid,180),
    instructor:text(data.instructor ?? data.instructorName ?? data.teacherName ?? data.teacher,140),
    instructorName:text(data.instructorName ?? data.instructor ?? data.teacherName ?? data.teacher,140),
    startTime:text(data.startTime ?? data.startHour,40),
    endTime:text(data.endTime ?? data.endHour,40),
    startHour:data.startHour ?? "",
    endHour:data.endHour ?? ""
  };
}
async function loadAttendance(date: string): Promise<PlainObject[]> {
  const col = db().collection("attendance");
  const [bySession,byDate] = await Promise.all([
    col.where("sessionDate","==",date).get(),
    col.where("date","==",date).get()
  ]);
  const map = new Map<string,PlainObject>();
  for (const doc of [...bySession.docs,...byDate.docs]) {
    const data = doc.data();
    if (data.active === false) continue;
    map.set(doc.id,sanitizeAttendanceDoc(doc.id,data));
  }
  const rows = Array.from(map.values());
  if (rows.length > MAX_ATTENDANCE_ROWS) throw new Error(`ATTENDANCE_BACKUP_ROW_LIMIT:${rows.length}`);
  return rows;
}
async function loadClassroom(date: string): Promise<PlainObject[]> {
  const snap = await db().collection("realtimeClassroomDays").doc(date).get();
  const data = snap.data() ?? {};
  const raw = Array.isArray(data.records) ? data.records : [];
  const rows = raw.map(sanitizeClassroomRecord);
  if (rows.length > MAX_CLASSROOM_ROWS) throw new Error(`CLASSROOM_BACKUP_ROW_LIMIT:${rows.length}`);
  return rows;
}
async function postMirror(date: string): Promise<PlainObject> {
  const [attendanceRows,classroomRecords] = await Promise.all([loadAttendance(date),loadClassroom(date)]);
  const requestId = `operational-sheet-${date}-${randomUUID()}`;
  const issuedAtMs = Date.now();
  const payload = {
    version:OPERATIONAL_SHEET_MIRROR_7355080_VERSION,
    date,
    attendanceRows,
    classroomRecords,
    sourceOfTruth:"firestore",
    sheetAuthority:"backup_only"
  };
  const payloadJson = JSON.stringify(payload);
  const envelope = {
    action:ACTION,
    requestId,
    issuedAtMs,
    payloadJson,
    signature:sign(ACTION,requestId,issuedAtMs,payloadJson)
  };
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),240_000);
  try {
    const response = await fetch(GAS_WEB_APP_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json; charset=utf-8"},
      body:JSON.stringify(envelope),
      signal:controller.signal,
      redirect:"follow"
    });
    const raw = await response.text();
    let result: PlainObject = {};
    try { result = object(raw ? JSON.parse(raw) : {}); }
    catch { throw new Error(`OPERATIONAL_SHEET_GAS_INVALID_JSON:${raw.slice(0,500)}`); }
    if (!response.ok || result.ok !== true || text(result.status,20) !== "success") {
      throw new Error(`OPERATIONAL_SHEET_GAS_FAILED:${response.status}:${text(result.message ?? raw,1200)}`);
    }
    return {
      date,
      attendanceRows:attendanceRows.length,
      classroomRecords:classroomRecords.length,
      result
    };
  } finally {
    clearTimeout(timer);
  }
}
async function runDates(dates: string[]): Promise<PlainObject[]> {
  const unique = Array.from(new Set(dates.map(dateText)));
  const results: PlainObject[] = [];
  for (const date of unique) results.push(await postMirror(date));
  return results;
}

// Every day at 06:00 KST, re-mirror yesterday + previous 2 days.
// The 3-day rolling window makes a transient previous backup failure self-healing.
// It NEVER reads Google Sheets back into Firestore.
export const exportAttendanceClassroomToSheetsDaily06007355080 = onSchedule(
  {
    schedule:"0 6 * * *",
    timeZone:"Asia/Seoul",
    region:ULIM_FUNCTION_REGION,
    secrets:[ULIM_LEGACY_PROOF_HMAC_SECRET],
    timeoutSeconds:540,
    memory:"512MiB",
    retryCount:2
  },
  async () => {
    const dates = [kstDateOffset(-1),kstDateOffset(-2),kstDateOffset(-3)];
    const results = await runDates(dates);
    console.log("[ULIM 7355080 Firestore->Sheets backup]",JSON.stringify(results.map(row=>({
      date:row.date,
      attendanceRows:row.attendanceRows,
      classroomRecords:row.classroomRecords
    }))));
  }
);

export const runAttendanceClassroomSheetBackupAdmin7355080 = onCall(
  {
    region:ULIM_FUNCTION_REGION,
    cors:true,
    enforceAppCheck:false,
    timeoutSeconds:540,
    memory:"512MiB",
    secrets:[ULIM_LEGACY_PROOF_HMAC_SECRET]
  },
  async request => {
    if (!request.auth) throw new HttpsError("unauthenticated","Firebase 로그인이 필요합니다.");
    const role = text(request.auth.token.role,30);
    if (role !== "admin" && role !== "superAdmin") {
      throw new HttpsError("permission-denied","관리자 권한이 필요합니다.");
    }
    const input = object(request.data);
    const dates = Array.isArray(input.dates)
      ? input.dates.slice(0,7).map(dateText)
      : [dateText(input.date || kstDateOffset(-1))];
    try {
      return {
        ok:true,
        version:OPERATIONAL_SHEET_MIRROR_7355080_VERSION,
        sourceOfTruth:"firestore",
        sheetAuthority:"backup_only",
        results:await runDates(dates)
      };
    } catch(error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpsError("internal",message.slice(0,1800));
    }
  }
);
