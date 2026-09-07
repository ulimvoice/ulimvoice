import { createHash } from "node:crypto";
import { FieldValue, getFirestore, type DocumentData, type DocumentReference, type DocumentSnapshot, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";

export const STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION = "2026-08-17.735.05.0.84-r29.9.4.1-cloudrun-canonical-url-iam";
const PRONUNCIATION_ENGINE_7355043_VERSION = "2026-08-12.7355043-ctc-gop-v1";
const PRONUNCIATION_CLOUD_RUN_URL = "https://ulim-pronunciation-ctc-3omp2gwn4q-du.a.run.app";
const MAX_PRONUNCIATION_AUDIO_BYTES = 6 * 1024 * 1024;
const CONSENT_POLICY_VERSION = "2026-08-12.ulim-voice-research-v1";
const TARGET_SPREADSHEET_ID = "1wSWOeKlZYKUYr0AIjDe_bRiE1zaYuZlKKgRglyDxIMQ";
const RECORDS = "practiceRecords";
const ANALYSIS_RUNS = "practiceAnalysisRuns";
const TEACHER_EVALUATIONS = "practiceTeacherEvaluations";
const TRAINING_SAMPLES = "practiceTrainingSamples";
const PUSH_TOKENS = "practicePushTokens";
const NOTIFICATION_JOBS = "practiceNotificationJobs";
const BACKUP_STATE_DOC = "operationalSettings/ulimPracticeBackup7355042";
const CONSENT_DOC = "voiceResearch";
const MAX_STAFF_LIST = 800;
const CALLABLE_OPTIONS = Object.freeze({
  ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  cors: true,
  invoker: "public" as const,
  timeoutSeconds: 60,
  memory: "256MiB" as const
});

type PlainObject = Record<string, unknown>;
type StudentCaller = { firebaseUid: string; studentUid: string; student: DocumentData };
type StaffCaller = { firebaseUid: string; role: string; teacherUid: string; displayName: string; user: DocumentData };
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
function object(value: unknown): PlainObject { return value && typeof value === "object" && !Array.isArray(value) ? value as PlainObject : {}; }
function text(value: unknown, max = 4000): string { return String(value ?? "").trim().slice(0, max); }
function int(value: unknown, fallback = 0): number { const n = Number(value); return Number.isFinite(n) ? Math.trunc(n) : fallback; }
function numberValue(value: unknown, fallback = 0): number { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function bool(value: unknown): boolean { return value === true || ["1","true","yes","y","on"].includes(text(value, 20).toLowerCase()); }
function hash(...parts: unknown[]): string { return createHash("sha256").update(parts.map(v => String(v ?? "")).join("|")).digest("hex"); }
function unique(value: unknown, max = 160): string[] {
  const arr = Array.isArray(value) ? value : value == null ? [] : [value];
  return Array.from(new Set(arr.map(v => text(v, max)).filter(Boolean)));
}
function stringArray(value: unknown, maxItems = 400, maxText = 80): string[] {
  const arr = Array.isArray(value) ? value : [];
  return arr.slice(0,maxItems).map(v => text(v,maxText)).filter(Boolean);
}
function uniqueNames(value: unknown): string[] {
  const arr = Array.isArray(value) ? value : value == null ? [] : [value];
  const names = arr.flatMap(v => text(v, 500).split(/[,/|\n]+/g)).map(v => text(v,120)).filter(Boolean);
  return Array.from(new Set(names));
}
function kstDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(date);
  const map: Record<string,string> = {};
  for (const part of parts) if (part.type !== "literal") map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}`;
}
function requireDate(value: unknown): string {
  const candidate = text(value, 10) || kstDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) throw new HttpsError("invalid-argument", "날짜가 올바르지 않습니다.");
  return candidate;
}
function dateRange(input: PlainObject): { start: string; end: string; scope: string } {
  const scope = text(input.scope, 20) || "day";
  let start = text(input.dateFrom, 10) || text(input.date, 10) || kstDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) start = kstDateKey();
  let end = text(input.dateTo, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    const d = new Date(start + "T12:00:00+09:00");
    d.setDate(d.getDate() + 1);
    end = kstDateKey(d);
  }
  return { start, end, scope };
}
function roleValue(value: unknown): string {
  const raw = text(value, 40).normalize("NFKC").replace(/[\s_-]+/g, "").toLowerCase();
  if (["teacher","강사"].includes(raw)) return "teacher";
  if (["admin","관리자","fulladmin","전체관리","전체관리자","원장"].includes(raw)) return "admin";
  if (["superadmin","superadministrator","최고관리자"].includes(raw)) return "superAdmin";
  if (["student","학생"].includes(raw)) return "student";
  return raw;
}
function fullAdmin(role: string): boolean { return role === "admin" || role === "superAdmin"; }
function teacherNameKey(value: unknown): string { return text(value, 120).normalize("NFKC").replace(/\s+/g, "").replace(/T$/i, "").toLowerCase(); }
function averageScores(scores: PlainObject): number {
  const values = Object.values(scores).map(v => Number(v)).filter(v => Number.isFinite(v) && v >= 1 && v <= 5);
  if (!values.length) return 0;
  return Math.round((values.reduce((a,b)=>a+b,0) / values.length) * 100) / 100;
}
function plainJson(value: unknown, max = 50000): string {
  try { return JSON.stringify(value ?? {}).slice(0, max); } catch { return "{}"; }
}
async function requireStudent(request: CallableRequest<unknown>): Promise<StudentCaller> {
  if (!request.auth) throw new HttpsError("unauthenticated", "학생 로그인이 필요합니다.");
  const firebaseUid = text(request.auth.uid, 160);
  const tokenStudentUid = text(request.auth.token.studentUid, 160);
  const candidates = Array.from(new Set([tokenStudentUid, firebaseUid].filter(Boolean)));
  for (const candidate of candidates) {
    const snap = await db().collection("students").doc(candidate).get();
    if (!snap.exists) continue;
    const student = snap.data() ?? {};
    const status = text(student.enrollmentStatus ?? student.studentStatus ?? student.status, 40).toLowerCase();
    if (["withdrawn","cancelled","퇴원","등록취소"].includes(status) || student.registrationCancelled === true) throw new HttpsError("permission-denied", "현재 사용할 수 없는 학생 계정입니다.");
    return { firebaseUid, studentUid:snap.id, student };
  }
  throw new HttpsError("permission-denied", "학생 계정 연결정보를 확인하지 못했습니다.");
}
async function requireStaff(request: CallableRequest<unknown>): Promise<StaffCaller> {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const firebaseUid = text(request.auth.uid, 160);
  const role = roleValue(request.auth.token.role);
  if (!["teacher","admin","superAdmin"].includes(role)) throw new HttpsError("permission-denied", "교직원 권한이 필요합니다.");
  const userSnap = await db().collection("users").doc(firebaseUid).get();
  if (!userSnap.exists) throw new HttpsError("permission-denied", "활성 교직원 정보가 없습니다.");
  const user = userSnap.data() ?? {};
  if (user.active !== true) throw new HttpsError("permission-denied", "현재 사용할 수 없는 교직원 계정입니다.");
  const teacherUid = role === "teacher" ? text(request.auth.token.teacherUid ?? user.teacherUid, 160) : text(user.teacherUid, 160);
  let displayName = text(user.name ?? user.displayName ?? user.teacherName ?? request.auth.token.name, 120);
  if (!displayName && teacherUid) {
    const teacher = (await db().collection("teachers").doc(teacherUid).get()).data() ?? {};
    displayName = text(teacher.name ?? teacher.teacherName ?? teacher.displayName, 120);
  }
  return { firebaseUid, role, teacherUid, displayName, user };
}
async function actor(request: CallableRequest<unknown>): Promise<PracticeActor7355070> {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const role = roleValue(request.auth.token.role);
  if (role === "student" || request.auth.token.studentUid) {
    const student = await requireStudent(request);
    return {
      kind:"student", firebaseUid:student.firebaseUid, ownerUid:student.studentUid, ownerCollection:"students",
      studentUid:student.studentUid, staffUid:"", teacherUid:"", role:"student",
      displayName:text(student.student.name ?? student.student.studentName,120), profile:student.student
    };
  }
  const staff = await requireStaff(request);
  return {
    kind:"staff", firebaseUid:staff.firebaseUid, ownerUid:staff.firebaseUid, ownerCollection:"users",
    studentUid:"", staffUid:staff.firebaseUid, teacherUid:staff.teacherUid, role:staff.role,
    displayName:staff.displayName, profile:staff.user
  };
}
function ownerDocRef7355070(who: PracticeActor7355070) {
  return db().collection(who.ownerCollection).doc(who.ownerUid);
}
function consentRef7355070(who: PracticeActor7355070) {
  return ownerDocRef7355070(who).collection("consents").doc(CONSENT_DOC);
}

function intelligenceIds7355071(who: PracticeActor7355070, recordId: string): { analysisRunId:string; trainingSampleId:string } {
  return {
    analysisRunId:`AR_${hash(recordId, STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION).slice(0,28)}`,
    trainingSampleId:who.kind === "student" ? `TS_${hash("ULIM_TRAINING", who.studentUid, recordId).slice(0,32)}` : ""
  };
}
async function currentResearchConsent7355071(who: PracticeActor7355070): Promise<{ status:string; accepted:boolean; policyCurrent:boolean }> {
  const snap = await consentRef7355070(who).get();
  const data = snap.data() ?? {};
  const stored = text(data.status,20);
  const policyCurrent = text(data.policyVersion,120) === CONSENT_POLICY_VERSION;
  const status = policyCurrent && (stored === "accepted" || stored === "declined") ? stored : "unset";
  return { status, accepted:status === "accepted", policyCurrent };
}
async function cloudRunIdentityToken7355071(audience: string): Promise<string> {
  const url = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}&format=full`;
  const response = await fetch(url,{ headers:{ "Metadata-Flavor":"Google" } });
  if (!response.ok) throw new Error(`Cloud Run identity token unavailable: ${response.status}`);
  const token = text(await response.text(),10000);
  if (!token) throw new Error("Cloud Run identity token empty");
  return token;
}
async function pronunciationService7355071(path: "/warm"|"/analyze", body?: PlainObject, timeoutMs = 18000): Promise<PlainObject> {
  const token = await cloudRunIdentityToken7355071(PRONUNCIATION_CLOUD_RUN_URL);
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),Math.max(1000,timeoutMs));
  try {
    const response = await fetch(`${PRONUNCIATION_CLOUD_RUN_URL}${path}`,{
      method:body ? "POST" : "GET",
      signal:controller.signal,
      headers:{ Authorization:`Bearer ${token}`, ...(body ? {"Content-Type":"application/json"} : {}) },
      ...(body ? { body:JSON.stringify(body) } : {})
    });
    const raw = await response.text();
    let parsed: unknown = {};
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { raw }; }
    if (!response.ok) throw new Error(`pronunciation service ${response.status}: ${text(object(parsed).detail ?? raw,1000)}`);
    return object(parsed);
  } finally {
    clearTimeout(timer);
  }
}
function nestedPracticeRef(studentUid: string, recordId: string) {
  return db().collection("students").doc(studentUid).collection("practiceLogs").doc(recordId);
}
function nestedPracticeRef7355070(who: PracticeActor7355070, recordId: string) {
  return ownerDocRef7355070(who).collection("practiceLogs").doc(recordId);
}
function nestedPracticeRefFromRecord7355070(record: DocumentData, recordId: string) {
  const ownerKind = text(record.ownerKind,20);
  const ownerUid = text(record.ownerUid,160);
  if (ownerKind === "staff" && ownerUid) return db().collection("users").doc(ownerUid).collection("practiceLogs").doc(recordId);
  const studentUid = text(record.studentUid,160) || (ownerKind === "student" ? ownerUid : "");
  return studentUid ? nestedPracticeRef(studentUid,recordId) : null;
}
function recordOwnedByActor7355070(record: DocumentData, who: PracticeActor7355070): boolean {
  const ownerKind = text(record.ownerKind,20);
  const ownerUid = text(record.ownerUid,160);
  if (ownerKind && ownerUid) return ownerKind === who.kind && ownerUid === who.ownerUid;
  if (who.kind === "student") return text(record.studentUid,160) === who.studentUid;
  return text(record.staffUid ?? record.firebaseUid,160) === who.firebaseUid;
}
function actorInstructorUids7355070(who: PracticeActor7355070, existing?: unknown): string[] {
  if (who.kind === "staff") return unique(existing ?? [who.teacherUid || who.firebaseUid],160).length
    ? unique(existing ?? [who.teacherUid || who.firebaseUid],160)
    : [who.teacherUid || who.firebaseUid].filter(Boolean);
  return unique(existing ?? who.profile.instructorUids ?? who.profile.instructorUid,160);
}
function actorInstructorNames7355070(who: PracticeActor7355070, existing?: unknown): string[] {
  if (who.kind === "staff") return uniqueNames(existing ?? [who.displayName]).length ? uniqueNames(existing ?? [who.displayName]) : [who.displayName].filter(Boolean);
  return uniqueNames(existing ?? who.profile.instructorNames ?? who.profile.instructorName ?? who.profile.instructor);
}
function recordVisibleToStaff(record: DocumentData, caller: StaffCaller): boolean {
  if (fullAdmin(caller.role)) return true;
  if (caller.role !== "teacher") return false;
  const uids = unique(record.instructorUids, 160);
  if (caller.teacherUid && uids.includes(caller.teacherUid)) return true;
  const names = uniqueNames(record.instructorNames).map(teacherNameKey);
  return Boolean(caller.displayName && names.includes(teacherNameKey(caller.displayName)));
}
function publicRecord(data: DocumentData): PlainObject {
  return {
    recordId:text(data.recordId, 160), taskType:text(data.taskType, 60), recordType:text(data.recordType, 80),
    ownerKind:text(data.ownerKind,20) || (text(data.studentUid,160) ? "student" : "staff"), ownerUid:text(data.ownerUid,160) || text(data.studentUid ?? data.staffUid,160),
    studentUid:text(data.studentUid, 160), staffUid:text(data.staffUid,160), studentName:text(data.studentName ?? data.participantName, 120), participantName:text(data.participantName ?? data.studentName,120),
    practiceDate:text(data.practiceDate, 10),
    sentenceId:text(data.sentenceId, 120), vocalId:text(data.sentenceId ?? data.vocalId, 120), sentence:text(data.sentence, 12000),
    standardPronunciation:text(data.standardPronunciation, 12000), recognizedText:text(data.recognizedText,12000),
    fileUrl:text(data.fileUrl ?? data.audioUrl, 3000), audioUrl:text(data.fileUrl ?? data.audioUrl, 3000),
    state:text(data.state, 60), uploadState:text(data.uploadState, 60), sourceAuthority:"firestore", intelligenceVersion:text(data.intelligenceVersion, 120),
    aiComment:text(data.aiComment,16000), analysisText:text(data.analysisText,20000),
    analysisSummary:data.analysisSummary && typeof data.analysisSummary === "object" ? data.analysisSummary : null,
    teacherEvaluations:Array.isArray(data.teacherEvaluations) ? data.teacherEvaluations : [], instructorUids:unique(data.instructorUids,160), instructorNames:uniqueNames(data.instructorNames),
    updatedAtMs:int(data.updatedAtMs,0)
  };
}

export const getPracticeResearchConsent7355042 = onCall(CALLABLE_OPTIONS, async request => {
  const who = await actor(request);
  const snap = await consentRef7355070(who).get();
  const data = snap.data() ?? {};
  const storedPolicyVersion = text(data.policyVersion,120);
  const rawStatus = text(data.status,20);
  const policyCurrent = storedPolicyVersion === CONSENT_POLICY_VERSION;
  const status = policyCurrent && (rawStatus === "accepted" || rawStatus === "declined") ? rawStatus : "unset";
  return { ok:true, status, policyVersion:CONSENT_POLICY_VERSION, storedPolicyVersion, policyCurrent, decidedAtMs:int(data.decidedAtMs,0), actorKind:who.kind };
});

export const setPracticeResearchConsent7355042 = onCall(CALLABLE_OPTIONS, async request => {
  const who = await actor(request);
  const input = object(request.data);
  const status = text(input.status,20);
  if (status !== "accepted" && status !== "declined") throw new HttpsError("invalid-argument", "동의 선택값이 올바르지 않습니다.");
  const now = Date.now();
  await consentRef7355070(who).set({
    status, policyVersion:CONSENT_POLICY_VERSION, actorKind:who.kind, ownerUid:who.ownerUid,
    decidedAtMs:now, updatedAtMs:now, decidedAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp(),
    version:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION
  }, { merge:true });
  return { ok:true, status, policyVersion:CONSENT_POLICY_VERSION, decidedAtMs:now, actorKind:who.kind };
});


export const warmPracticePronunciation7355043 = onCall(
  { ...CALLABLE_OPTIONS, timeoutSeconds:125, memory:"512MiB" },
  async request => {
    const who = await actor(request);
    const consent = await currentResearchConsent7355071(who);
    if (!consent.accepted) return { ok:false, state:"skipped", reason:"consent_not_accepted", actorKind:who.kind };
    try {
      const result = await pronunciationService7355071("/warm",undefined,110000);
      return {
        ok:result.ok === true,
        state:result.ok === true ? "ready" : "deferred",
        actorKind:who.kind,
        engineVersion:text(result.engineVersion ?? result.serviceVersion,200) || PRONUNCIATION_ENGINE_7355043_VERSION
      };
    } catch {
      return { ok:false, state:"deferred", actorKind:who.kind };
    }
  }
);

export const analyzePracticePronunciation7355043 = onCall(
  { ...CALLABLE_OPTIONS, timeoutSeconds:150, memory:"512MiB" },
  async request => {
    const who = await actor(request);
    const input = object(request.data);
    const recordId = text(input.recordId,160);
    const persistToRecord = !!recordId;

    const consent = await currentResearchConsent7355071(who);
    // Pre-upload precision analysis is transient. Consent only gates persisted research/training data.
    if (persistToRecord && !consent.accepted) {
      return { ok:false, state:"skipped", reason:"consent_not_accepted", actorKind:who.kind, preUpload:false };
    }

    let record: PlainObject = {};
    let recordRef: DocumentReference | null = null;
    let nestedRef: DocumentReference | null = null;
    let ids: ReturnType<typeof intelligenceIds7355071> | null = null;

    if (persistToRecord) {
      recordRef = db().collection(RECORDS).doc(recordId);
      const recordSnap = await recordRef.get();
      if (!recordSnap.exists) throw new HttpsError("not-found","연습 기록을 찾지 못했습니다.");
      record = recordSnap.data() ?? {};
      if (!recordOwnedByActor7355070(record,who)) throw new HttpsError("permission-denied","연습 기록 소유자가 다릅니다.");
      ids = intelligenceIds7355071(who,recordId);
      nestedRef = nestedPracticeRef7355070(who,recordId);
    }

    const audioBase64 = text(input.audioBase64,9_000_000).replace(/^data:[^,]+,/i,"");
    if (!audioBase64) throw new HttpsError("invalid-argument","녹음 데이터가 없습니다.");
    const padding = audioBase64.endsWith("==") ? 2 : (audioBase64.endsWith("=") ? 1 : 0);
    const audioBytes = Math.max(0,Math.floor(audioBase64.length * 3 / 4) - padding);
    if (!audioBytes || audioBytes > MAX_PRONUNCIATION_AUDIO_BYTES) {
      throw new HttpsError("invalid-argument","한 문장 녹음 파일의 분석 가능 크기를 초과했습니다.");
    }

    if (persistToRecord && recordRef && nestedRef) {
      const now = Date.now();
      const processingPatch = {
        phonemeAnalysisState:"processing",
        updatedAtMs:now,
        updatedAt:FieldValue.serverTimestamp()
      };
      await Promise.all([
        recordRef.set(processingPatch,{merge:true}),
        nestedRef.set(processingPatch,{merge:true})
      ]);
    }

    let result: PlainObject;
    try {
      result = await pronunciationService7355071("/analyze",{
        audioBase64,
        mimeType:text(input.mimeType,120) || "audio/wav",
        sentence:text(input.sentence ?? record.sentence,12000),
        standardPronunciation:text(input.standardPronunciation ?? record.standardPronunciation,12000)
      },130000);
    } catch (error) {
      if (persistToRecord && recordRef && nestedRef) {
        const failedAt = Date.now();
        const failedPatch = {
          phonemeAnalysisState:"deferred",
          phonemeAnalysisError:text(error instanceof Error ? error.message : error,500),
          updatedAtMs:failedAt,
          updatedAt:FieldValue.serverTimestamp()
        };
        await Promise.all([
          recordRef.set(failedPatch,{merge:true}),
          nestedRef.set(failedPatch,{merge:true})
        ]);
      }
      return {
        ok:false, state:"deferred", actorKind:who.kind, preUpload:!persistToRecord,
        reason:text(error instanceof Error ? error.message : error,700)
      };
    }

    if (result.ok !== true) {
      if (persistToRecord && recordRef && nestedRef) {
        const deferredPatch = {
          phonemeAnalysisState:"deferred",
          updatedAtMs:Date.now(),
          updatedAt:FieldValue.serverTimestamp()
        };
        await Promise.all([
          recordRef.set(deferredPatch,{merge:true}),
          nestedRef.set(deferredPatch,{merge:true})
        ]);
      }
      return {
        ok:false, state:"deferred", actorKind:who.kind, preUpload:!persistToRecord,
        reason:text(result.detail ?? result.message ?? result.error,700) || "pronunciation_service_deferred"
      };
    }

    const completedAt = Date.now();
    const alignment = Array.isArray(result.phonemeAlignment) ? result.phonemeAlignment.slice(0,400) : [];
    const expectedPhonemes = stringArray(result.expectedPhonemes,400,40);
    const recognizedPhonemes = stringArray(result.recognizedPhonemes,400,40);
    const weakRows = Array.isArray(result.weakPhonemes)
      ? result.weakPhonemes.slice(0,40).map(item=>object(item))
      : [];
    const weakLabels = weakRows.map(item=>text(item.phone,40)).filter(Boolean).slice(0,12);

    const phonemeAnalysis = {
      state:"complete",
      ctcPronunciationScore:numberValue(result.ctcPronunciationScore,0),
      phonemeCount:int(result.phonemeCount,0),
      alignmentCoverage:numberValue(result.alignmentCoverage,0),
      expectedPronunciationSource:text(result.expectedPronunciationSource,12000),
      expectedIpa:text(result.expectedIpa,12000),
      expectedPhonemes,
      recognizedPhonemes,
      phonemeAlignment:alignment,
      weakPhonemes:weakRows,
      gopMethod:text(result.gopMethod,120),
      engineVersion:text(result.engineVersion,200) || PRONUNCIATION_ENGINE_7355043_VERSION,
      modelVersion:text(result.modelVersion,300),
      g2pVersion:text(result.g2pVersion,200),
      scoringVersion:text(result.scoringVersion,200),
      analysisMs:int(result.analysisMs,0),
      completedAtMs:completedAt
    };

    // Standard-pronunciation advanced analysis is intentionally allowed before upload.
    // In pre-upload mode we return the CTC/GOP result without writing Firestore.
    if (!persistToRecord || !recordRef || !nestedRef || !ids) {
      return {
        ok:true, state:"complete", actorKind:who.kind, preUpload:true,
        ctcPronunciationScore:numberValue(result.ctcPronunciationScore,0),
        phonemeCount:int(result.phonemeCount,0),
        alignmentCoverage:numberValue(result.alignmentCoverage,0),
        weakPhonemes:weakLabels,
        expectedPhonemes,
        recognizedPhonemes,
        gopMethod:text(result.gopMethod,120),
        engineVersion:text(result.engineVersion,200) || PRONUNCIATION_ENGINE_7355043_VERSION,
        modelVersion:text(result.modelVersion,300),
        g2pVersion:text(result.g2pVersion,200),
        scoringVersion:text(result.scoringVersion,200)
      };
    }

    const runRef = db().collection(ANALYSIS_RUNS).doc(ids.analysisRunId);
    const runSnap = await runRef.get();
    const batch = db().batch();

    batch.set(runRef,{
      analysisRunId:ids.analysisRunId,
      recordId,
      trainingSampleId:ids.trainingSampleId,
      taskType:text(record.taskType,60) || "vocal_training",
      practiceDate:text(record.practiceDate,10),
      ownerKind:who.kind, ownerUid:who.ownerUid,
      studentUid:who.studentUid, staffUid:who.staffUid,
      participantName:who.displayName,
      sentenceId:text(record.sentenceId,120),
      sentence:text(record.sentence,12000),
      standardPronunciation:text(record.standardPronunciation,12000),
      phonemeAnalysis,
      consentPolicyVersion:CONSENT_POLICY_VERSION,
      createdAtMs:int(runSnap.data()?.createdAtMs,completedAt) || completedAt,
      updatedAtMs:completedAt,
      updatedAt:FieldValue.serverTimestamp(),
      version:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION
    },{merge:true});

    if (who.kind === "student" && ids.trainingSampleId) {
      const sampleRef = db().collection(TRAINING_SAMPLES).doc(ids.trainingSampleId);
      const sampleSnap = await sampleRef.get();
      batch.set(sampleRef,{
        trainingSampleId:ids.trainingSampleId,
        recordId,
        latestAnalysisRunId:ids.analysisRunId,
        taskType:text(record.taskType,60) || "vocal_training",
        practiceDate:text(record.practiceDate,10),
        studentUid:who.studentUid,
        sentenceId:text(record.sentenceId,120),
        sentence:text(record.sentence,12000),
        standardPronunciation:text(record.standardPronunciation,12000),
        phonemeFeatures:phonemeAnalysis,
        consentPolicyVersion:CONSENT_POLICY_VERSION,
        learningEligible:true,
        labelState:text(sampleSnap.data()?.labelState,60) || "awaiting_teacher",
        datasetVersion:"ulim-voice-dataset-v1",
        alignmentRefinementState:"pending_ulim_commercial_safe_model",
        createdAtMs:int(sampleSnap.data()?.createdAtMs,completedAt) || completedAt,
        updatedAtMs:completedAt,
        updatedAt:FieldValue.serverTimestamp(),
        version:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION
      },{merge:true});
    }

    const summaryPatch = {
      analysisRunId:ids.analysisRunId,
      trainingSampleId:ids.trainingSampleId,
      phonemeAnalysisState:"complete",
      "analysisSummary.ctcPronunciationScore":numberValue(result.ctcPronunciationScore,0),
      "analysisSummary.alignmentCoverage":numberValue(result.alignmentCoverage,0),
      "analysisSummary.weakPhonemes":weakLabels,
      "analysisSummary.expectedPhonemes":expectedPhonemes,
      "analysisSummary.recognizedPhonemes":recognizedPhonemes,
      "analysisSummary.phonemeAnalysisState":"complete",
      "analysisSummary.phonemeCount":int(result.phonemeCount,0),
      "analysisSummary.gopMethod":text(result.gopMethod,120),
      "analysisSummary.phonemeEngineVersion":text(result.engineVersion,200) || PRONUNCIATION_ENGINE_7355043_VERSION,
      updatedAtMs:completedAt,
      updatedAt:FieldValue.serverTimestamp()
    };
    batch.set(recordRef,summaryPatch,{merge:true});
    batch.set(nestedRef,summaryPatch,{merge:true});
    await batch.commit();

    return {
      ok:true, state:"complete", actorKind:who.kind, preUpload:false,
      ctcPronunciationScore:numberValue(result.ctcPronunciationScore,0),
      phonemeCount:int(result.phonemeCount,0),
      alignmentCoverage:numberValue(result.alignmentCoverage,0),
      weakPhonemes:weakLabels,
      expectedPhonemes,
      recognizedPhonemes,
      gopMethod:text(result.gopMethod,120),
      engineVersion:text(result.engineVersion,200) || PRONUNCIATION_ENGINE_7355043_VERSION,
      modelVersion:text(result.modelVersion,300),
      g2pVersion:text(result.g2pVersion,200),
      scoringVersion:text(result.scoringVersion,200)
    };
  }
);

export const beginPracticeIntelligence7355042 = onCall(CALLABLE_OPTIONS, async request => {
  const who = await actor(request);
  const input = object(request.data);
  const recordId = text(input.recordId,160);
  if (!recordId) throw new HttpsError("invalid-argument", "연습 기록 식별값이 없습니다.");
  const practiceDate = requireDate(input.practiceDate);
  const taskType = text(input.taskType,60) || "vocal_training";
  const now = Date.now();
  const instructorUids = actorInstructorUids7355070(who);
  const instructorNames = actorInstructorNames7355070(who);
  const participantName = who.displayName || (who.kind === "student" ? "학생" : "교직원");
  const record = {
    recordId, taskType, recordType:taskType === "vocal_training" ? "발성훈련" : taskType,
    ownerKind:who.kind, ownerUid:who.ownerUid, firebaseUid:who.firebaseUid,
    studentUid:who.studentUid, staffUid:who.staffUid, participantName, studentName:participantName,
    practiceDate, sentenceId:text(input.sentenceId,120), sentence:text(input.sentence,12000),
    standardPronunciation:text(input.standardPronunciation,12000), instructorUids, instructorNames,
    state:"uploading", uploadState:"uploading", intelligenceVersion:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION,
    createdAtMs:now, updatedAtMs:now, createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp()
  };
  const ref = db().collection(RECORDS).doc(recordId);
  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const existing = snap.data() ?? {};
    if (snap.exists && !recordOwnedByActor7355070(existing,who)) throw new HttpsError("permission-denied", "연습 기록 소유자가 다릅니다.");
    if (text(existing.state,40) === "complete") return;
    tx.set(ref, record, { merge:true });
  });
  return { ok:true, recordId, state:"uploading", actorKind:who.kind, ownerUid:who.ownerUid };
});

export const completePracticeIntelligence7355042 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds:90, memory:"512MiB" }, async request => {
  const who = await actor(request);
  const input = object(request.data);
  const recordId = text(input.recordId,160);
  if (!recordId) throw new HttpsError("invalid-argument", "연습 기록 식별값이 없습니다.");
  const practiceDate = requireDate(input.practiceDate);
  const consentSnap = await consentRef7355070(who).get();
  const consent = consentSnap.data() ?? {};
  const storedConsentStatus = text(consent.status,20);
  const consentPolicyCurrent = text(consent.policyVersion,120) === CONSENT_POLICY_VERSION;
  const effectiveConsentStatus = consentPolicyCurrent && (storedConsentStatus === "accepted" || storedConsentStatus === "declined") ? storedConsentStatus : "unset";
  const consentAccepted = effectiveConsentStatus === "accepted";
  const inputConsent = text(input.consentStatus,20);
  if (inputConsent && inputConsent !== effectiveConsentStatus) throw new HttpsError("failed-precondition", "데이터 활용 선택 상태가 변경되었습니다. 다시 시도해주세요.");
  const taskType = text(input.taskType,60) || "vocal_training";
  const analysis = object(input.analysis);
  const features = object(analysis.features);
  const now = Date.now();
  const recordRef = db().collection(RECORDS).doc(recordId);
  const existing = await recordRef.get();
  const base = existing.data() ?? {};
  if (existing.exists && !recordOwnedByActor7355070(base,who)) throw new HttpsError("permission-denied", "연습 기록 소유자가 다릅니다.");
  const instructorUids = actorInstructorUids7355070(who, base.instructorUids);
  const instructorNames = actorInstructorNames7355070(who, base.instructorNames);
  const analysisRunId = consentAccepted ? `AR_${hash(recordId, STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION).slice(0,28)}` : "";
  const trainingSampleId = consentAccepted && who.kind === "student" ? `TS_${hash("ULIM_TRAINING", who.studentUid, recordId).slice(0,32)}` : "";
  if (text(base.state,40) === "complete" && text(base.intelligenceVersion,120) === STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION) {
    return { ok:true, duplicate:true, recordId, analysisEnabled:base.analysisEnabled === true, analysisRunId:text(base.analysisRunId,160), trainingSampleId:text(base.trainingSampleId,160) };
  }
  const weakPhonemes = Array.isArray(features.weakPhonemes) ? features.weakPhonemes.map(v => text(v,40)).filter(Boolean).slice(0,12) : [];
  const expectedPhonemes = stringArray(features.expectedPhonemes,60,40);
  const recognizedPhonemes = stringArray(features.recognizedPhonemes,60,40);
  const analysisSummary = consentAccepted ? {
    ctcPronunciationScore:features.ctcPronunciationScore ?? null,
    pronunciationMatchScore:features.pronunciationMatchScore ?? null,
    alignmentCoverage:features.alignmentCoverage ?? null,
    phonemeCount:int(features.phonemeCount,0),
    gopMethod:text(features.gopMethod,120),
    phonemeEngineVersion:text(features.phonemeEngineVersion,200),
    expectedPhonemes,
    recognizedPhonemes,
    breathContinuityScore:numberValue(features.breathContinuityScore,0),
    soundSustainScore:numberValue(features.soundSustainScore,0),
    sentenceEndingSustainScore:numberValue(features.sentenceEndingSustainScore,0),
    durationSec:numberValue(features.durationSec,0),
    silenceRatio:numberValue(features.silenceRatio,0),
    pauseCount:int(features.pauseCount,0),
    weakPhonemes
  } : null;
  const fileUrl = text(input.fileUrl,3000);
  const participantName = who.displayName || (who.kind === "student" ? "학생" : "교직원");
  const recordData: PlainObject = {
    recordId, taskType, recordType:taskType === "vocal_training" ? "발성훈련" : taskType,
    ownerKind:who.kind, ownerUid:who.ownerUid, firebaseUid:who.firebaseUid,
    studentUid:who.studentUid, staffUid:who.staffUid, participantName, studentName:participantName,
    practiceDate, sentenceId:text(input.sentenceId,120), sentence:text(input.sentence,12000),
    standardPronunciation:text(input.standardPronunciation,12000), recognizedText:text(analysis.recognizedText,12000),
    fileUrl, audioUrl:fileUrl, fileId:text(input.fileId,300), folderId:text(input.folderId,300),
    mimeType:text(input.mimeType,120), fileSize:Math.max(0,int(input.fileSize,0)),
    instructorUids, instructorNames, consentStatus:effectiveConsentStatus, analysisEnabled:consentAccepted,
    analysisRunId, trainingSampleId, analysisSummary, aiComment:text(input.aiComment,16000), analysisText:text(input.analysisText,20000),
    archiveRequestId:text(input.archiveRequestId,300), state:"complete", uploadState:"complete",
    intelligenceVersion:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION,
    completedAtMs:now, updatedAtMs:now, completedAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp()
  };
  const batch = db().batch();
  batch.set(recordRef, recordData, { merge:true });
  batch.set(nestedPracticeRef7355070(who,recordId), {
    ownerKind:who.kind, ownerUid:who.ownerUid, firebaseUid:who.firebaseUid, studentUid:who.studentUid, staffUid:who.staffUid,
    participantName, studentName:participantName, instructorUids, instructorNames,
    intelligenceVersion:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION, analysisEnabled:consentAccepted,
    analysisRunId, trainingSampleId, analysisSummary, consentStatus:effectiveConsentStatus,
    archiveRequestId:text(input.archiveRequestId,300), updatedAtMs:now, updatedAt:FieldValue.serverTimestamp()
  }, { merge:true });
  if (consentAccepted) {
    const runRef = db().collection(ANALYSIS_RUNS).doc(analysisRunId);
    batch.set(runRef, {
      analysisRunId, recordId, trainingSampleId, taskType, practiceDate, ownerKind:who.kind, ownerUid:who.ownerUid,
      studentUid:who.studentUid, staffUid:who.staffUid, participantName,
      sentenceId:text(input.sentenceId,120), sentence:text(input.sentence,12000), standardPronunciation:text(input.standardPronunciation,12000),
      recognizedText:text(analysis.recognizedText,12000), features, provider:text(analysis.provider,200) || "client-dsp",
      model:text(analysis.model,300), engineVersion:text(features.analysisVersion,200) || "acoustic-v1", consentPolicyVersion:CONSENT_POLICY_VERSION,
      fileUrl, archiveRequestId:text(input.archiveRequestId,300), createdAtMs:now, updatedAtMs:now,
      createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp(), version:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION
    }, { merge:true });
    if (who.kind === "student" && trainingSampleId) {
      const sampleRef = db().collection(TRAINING_SAMPLES).doc(trainingSampleId);
      batch.set(sampleRef, {
        trainingSampleId, recordId, latestAnalysisRunId:analysisRunId, taskType, practiceDate, studentUid:who.studentUid,
        sentenceId:text(input.sentenceId,120), sentence:text(input.sentence,12000), standardPronunciation:text(input.standardPronunciation,12000),
        recognizedText:text(analysis.recognizedText,12000), acousticFeatures:features, fileReference:fileUrl,
        archiveRequestId:text(input.archiveRequestId,300), consentPolicyVersion:CONSENT_POLICY_VERSION,
        learningEligible:true, labelState:"awaiting_teacher", datasetVersion:"ulim-voice-dataset-v1", teacherLabels:[],
        createdAtMs:now, updatedAtMs:now, updatedAt:FieldValue.serverTimestamp(), version:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION
      }, { merge:true });
    }
  }
  if (who.kind === "student") {
    const jobId = `UPLOAD_${hash(recordId,now).slice(0,30)}`;
    batch.set(db().collection(NOTIFICATION_JOBS).doc(jobId), {
      jobId, kind:"practice_upload", recordId, ownerKind:"student", ownerUid:who.studentUid,
      studentUid:who.studentUid, studentName:participantName, practiceDate, taskType,
      instructorUids, instructorNames, state:"pending", createdAtMs:now, updatedAtMs:now,
      createdAt:FieldValue.serverTimestamp(), version:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION
    });
  }
  await batch.commit();
  return { ok:true, recordId, actorKind:who.kind, analysisEnabled:consentAccepted, analysisRunId, trainingSampleId };
});

export const attachPracticeArchive7355042 = onCall(CALLABLE_OPTIONS, async request => {
  const who = await actor(request);
  const input = object(request.data);
  const recordId = text(input.recordId,160);
  const fileUrl = text(input.fileUrl,3000);
  if (!recordId || !fileUrl) throw new HttpsError("invalid-argument", "보관 파일 정보가 없습니다.");
  const recordRef = db().collection(RECORDS).doc(recordId);
  const recordSnap = await recordRef.get();
  if (!recordSnap.exists) throw new HttpsError("not-found", "연습 기록을 찾지 못했습니다.");
  const record = recordSnap.data() ?? {};
  if (!recordOwnedByActor7355070(record,who)) throw new HttpsError("permission-denied", "연습 기록 소유자가 다릅니다.");
  const now = Date.now();
  const batch = db().batch();
  batch.set(recordRef, {
    fileUrl, audioUrl:fileUrl, fileId:text(input.fileId,300), folderId:text(input.folderId,300),
    archiveRequestId:text(input.archiveRequestId,300), archiveState:"complete", updatedAtMs:now, updatedAt:FieldValue.serverTimestamp()
  }, { merge:true });
  batch.set(nestedPracticeRef7355070(who,recordId), {
    fileUrl, audioUrl:fileUrl, fileId:text(input.fileId,300), folderId:text(input.folderId,300),
    archiveState:"complete", updatedAtMs:now, updatedAt:FieldValue.serverTimestamp()
  }, { merge:true });
  const analysisRunId = text(record.analysisRunId,160);
  if (analysisRunId) batch.set(db().collection(ANALYSIS_RUNS).doc(analysisRunId), {
    fileUrl, archiveRequestId:text(input.archiveRequestId,300), updatedAtMs:now, updatedAt:FieldValue.serverTimestamp()
  }, { merge:true });
  const trainingSampleId = text(record.trainingSampleId,160);
  if (trainingSampleId) batch.set(db().collection(TRAINING_SAMPLES).doc(trainingSampleId), {
    fileReference:fileUrl, archiveRequestId:text(input.archiveRequestId,300), updatedAtMs:now, updatedAt:FieldValue.serverTimestamp()
  }, { merge:true });
  await batch.commit();
  return { ok:true, recordId, fileUrl };
});

async function repairMissingPracticeFileLinks7355067(rows: Array<{ ref: FirebaseFirestore.DocumentReference; data: DocumentData }>): Promise<void> {
  const missing = rows.filter(item => !text(item.data.fileUrl ?? item.data.audioUrl,3000) && text(item.data.recordId,160)).slice(0,200);
  if (!missing.length) return;
  const refs: FirebaseFirestore.DocumentReference[] = [];
  const indexes: number[] = [];
  for (let i=0;i<missing.length;i++) {
    const nested = nestedPracticeRefFromRecord7355070(missing[i].data,text(missing[i].data.recordId,160));
    if (!nested) continue;
    refs.push(nested);
    indexes.push(i);
  }
  if (!refs.length) return;
  const nestedSnaps = await db().getAll(...refs);
  let batch = db().batch();
  let writes = 0;
  for (let j=0;j<nestedSnaps.length;j++) {
    const i = indexes[j];
    const nested = nestedSnaps[j].data() ?? {};
    const fileUrl = text(nested.fileUrl ?? nested.audioUrl,3000);
    if (!fileUrl) continue;
    const patch = {
      fileUrl, audioUrl:fileUrl, fileId:text(nested.fileId,1000), folderId:text(nested.folderId,1000),
      archiveState:text(nested.archiveState,60) || "complete", uploadState:"complete",
      updatedAtMs:Date.now(), updatedAt:FieldValue.serverTimestamp()
    };
    Object.assign(missing[i].data,patch);
    batch.set(missing[i].ref,patch,{merge:true});
    writes++;
    if (writes % 400 === 0) { await batch.commit(); batch=db().batch(); }
  }
  if (writes % 400) await batch.commit();
}

export const listPracticeRecordsForStaff7355042 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  const input = object(request.data);
  const range = dateRange(input);
  const snap = await db().collection(RECORDS).where("practiceDate", ">=", range.start).where("practiceDate", "<", range.end).limit(MAX_STAFF_LIST).get();
  const instructorFilter = teacherNameKey(input.instructor);
  const keyword = text(input.keyword,160).toLowerCase();
  const visible = snap.docs.map(doc => ({ ref:doc.ref, data:doc.data() })).filter(item => recordVisibleToStaff(item.data, caller)).filter(item => {
    const row = item.data;
    if (instructorFilter) {
      const names = uniqueNames(row.instructorNames).map(teacherNameKey);
      if (!names.includes(instructorFilter)) return false;
    }
    if (keyword) {
      const hay = [row.studentName,row.sentence,row.recordType,row.taskType,...uniqueNames(row.instructorNames)].map(v => text(v,12000).toLowerCase()).join(" ");
      if (!hay.includes(keyword)) return false;
    }
    return true;
  });
  await repairMissingPracticeFileLinks7355067(visible);
  const logs = visible.map(item => publicRecord(item.data)).sort((a,b) => text(b.practiceDate,20).localeCompare(text(a.practiceDate,20)) || int(b.updatedAtMs,0)-int(a.updatedAtMs,0));
  return { ok:true, status:"success", version:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION, scope:range.scope, dateFrom:range.start, dateTo:range.end, logs, count:logs.length };
});

type PracticeRubric7355083 = {
  keys: string[];
  version: string;
};

function rubricForScores7355083(taskType: string, raw: PlainObject): PracticeRubric7355083 {
  const vocalR21 = [
    "pronunciationAccuracy","breathStability","soundSustain",
    "sentenceEndingSustain","sentenceConnection","overall"
  ];
  const vocalLegacy = [
    "pronunciationClarity","breathStability","speedControl",
    "volumeStability","intonationRhythm","sentenceEnding"
  ];
  const standard = [
    "standardAccuracy","consonantAccuracy","vowelAccuracy",
    "finalConsonantLinking","phonologicalRules","clarity"
  ];
  // Canonical 6.00+ past-question teacher Ground Truth rubric.
  const past = [
    "situationUnderstanding","characterObjective","emotionFlow","emotionTransition",
    "emphasisBreath","characterConsistency","naturalness","delivery"
  ];
  if (taskType === "past_question") {
    return { keys:past, version:"past-question-teacher-8-v2" };
  }
  if (taskType === "standard_pronunciation") {
    return { keys:standard, version:"standard-pronunciation-6-v2" };
  }
  // Old vocal records still render the legacy 6-field editor. New VOC/R21 records
  // render the R21 rubric, so select the schema by the keys the current editor sent.
  const hasR21Key = vocalR21.some(key => raw[key] != null && raw[key] !== "");
  return hasR21Key
    ? { keys:vocalR21, version:"vocal-r21a-v1" }
    : { keys:vocalLegacy, version:"vocal-legacy-6-v1" };
}

function validateScores7355083(taskType: string, raw: PlainObject): {
  scores: PlainObject;
  rubric: PracticeRubric7355083;
} {
  const rubric = rubricForScores7355083(taskType,raw);
  const out: PlainObject = {};
  for (const key of rubric.keys) {
    if (raw[key] == null || raw[key] === "") continue;
    const n = Number(raw[key]);
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      throw new HttpsError("invalid-argument", "평가 점수는 1~5점이어야 합니다.");
    }
    out[key] = Math.round(n);
  }
  return { scores:out, rubric };
}

export const savePracticeTeacherEvaluation7355042 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  const input = object(request.data);
  const recordId = text(input.recordId,160);
  if (!recordId) throw new HttpsError("invalid-argument", "연습 기록 식별값이 없습니다.");
  const recordRef = db().collection(RECORDS).doc(recordId);
  const recordSnap = await recordRef.get();
  if (!recordSnap.exists) throw new HttpsError("not-found", "Firebase 연습 기록을 찾지 못했습니다.");
  const record = recordSnap.data() ?? {};
  if (!recordVisibleToStaff(record,caller)) throw new HttpsError("permission-denied", "담당 학생 또는 본인의 연습기록만 평가할 수 있습니다.");
  const taskType = text(record.taskType,60) || text(input.taskType,60) || "vocal_training";
  let rawScores: PlainObject = {};
  try { rawScores = typeof input.scoreJson === "string" ? object(JSON.parse(text(input.scoreJson,50000) || "{}")) : object(input.scoreJson ?? input.scores); }
  catch { throw new HttpsError("invalid-argument", "평가 점수 형식이 올바르지 않습니다."); }
  const validated = validateScores7355083(taskType,rawScores);
  const scores = validated.scores;
  const rubric = validated.rubric;
  const finalize = bool(input.finalize);
  const comment = text(input.comment,12000);
  if (finalize && Object.keys(scores).length !== rubric.keys.length) {
    throw new HttpsError(
      "invalid-argument",
      `최종 평가에는 ${rubric.keys.length}개 평가항목을 모두 입력해야 합니다.`
    );
  }
  const evaluatorKey = caller.teacherUid || caller.firebaseUid;
  const evaluationId = `EV_${hash(recordId,evaluatorKey).slice(0,32)}`;
  const now = Date.now();
  const ownerKind = text(record.ownerKind,20) || (text(record.studentUid,160) ? "student" : "staff");
  const ownerUid = text(record.ownerUid,160) || text(record.studentUid ?? record.staffUid,160);
  const evaluation = {
    evaluationId, recordId, taskType, ownerKind, ownerUid, studentUid:text(record.studentUid,160), staffUid:text(record.staffUid,160),
    teacherUid:caller.teacherUid, evaluatorKey, teacherName:caller.displayName || "선생님",
    scoreJson:plainJson(scores,20000), scores, scoreAverage:averageScores(scores), comment,
    finalized:finalize, evaluationStatus:finalize ? "평가완료" : "임시저장",
    rubricVersion:rubric.version,
    createdAtMs:now, updatedAtMs:now, updatedAt:FieldValue.serverTimestamp(), version:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION
  };
  const evaluationRef = db().collection(TEACHER_EVALUATIONS).doc(evaluationId);
  await db().runTransaction(async tx => {
    const freshRecordSnap = await tx.get(recordRef);
    const freshRecord = freshRecordSnap.data() ?? {};
    const current = Array.isArray(freshRecord.teacherEvaluations)
      ? freshRecord.teacherEvaluations.filter((ev: unknown) => text(object(ev).evaluatorKey,160) !== evaluatorKey)
      : [];
    const publicEvaluation = {
      evaluationId, evaluatorKey, teacherUid:caller.teacherUid, teacherName:caller.displayName || "선생님",
      scoreJson:plainJson(scores,20000), scoreAverage:averageScores(scores), comment,
      savedAt:new Date(now).toISOString(), finalized:finalize, rubricVersion:evaluation.rubricVersion
    };
    const next = finalize ? [...current,publicEvaluation] : current;
    tx.set(evaluationRef,evaluation,{merge:true});
    tx.set(recordRef,{ teacherEvaluations:next, updatedAtMs:now, updatedAt:FieldValue.serverTimestamp() },{merge:true});
    const nestedRef = nestedPracticeRefFromRecord7355070(freshRecord,recordId);
    if (nestedRef) tx.set(nestedRef,{
      teacherEvaluations:next, teacherComment:finalize ? comment : text(freshRecord.teacherComment,12000),
      hasUnreadTeacherEvaluation:finalize && ownerKind === "student",
      updatedAtMs:now, updatedAt:FieldValue.serverTimestamp()
    },{merge:true});
    const trainingSampleId = text(freshRecord.trainingSampleId,160);
    if (finalize && trainingSampleId) {
      tx.set(db().collection(TRAINING_SAMPLES).doc(trainingSampleId),{
        teacherLabels:next, labelState:"teacher_labeled", latestTeacherEvaluationId:evaluationId,
        updatedAtMs:now, updatedAt:FieldValue.serverTimestamp()
      },{merge:true});
    }
    const studentUid = text(freshRecord.studentUid,160);
    if (finalize && ownerKind === "student" && studentUid) {
      const jobId = `FEEDBACK_${hash(evaluationId,now).slice(0,30)}`;
      tx.set(db().collection(NOTIFICATION_JOBS).doc(jobId),{
        jobId, kind:"practice_feedback", recordId, evaluationId, evaluatorKey,
        teacherUid:caller.teacherUid, teacherName:caller.displayName || "선생님",
        studentUid, studentName:text(freshRecord.studentName ?? freshRecord.participantName,120),
        taskType, practiceDate:text(freshRecord.practiceDate,10), state:"pending",
        createdAtMs:now, updatedAtMs:now, createdAt:FieldValue.serverTimestamp(),
        version:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION
      });
    }
  });
  return { ok:true, status:"success", evaluationId, evaluatorKey, finalized:finalize, scoreAverage:averageScores(scores) };
});

export const savePracticePushToken7355042 = onCall(CALLABLE_OPTIONS, async request => {
  const who = await actor(request);
  const input = object(request.data);
  const token = text(input.token,5000);
  if (!token) throw new HttpsError("invalid-argument", "푸시 토큰이 없습니다.");
  const tokenId = hash(token).slice(0,40);
  const now = Date.now();
  await db().collection(PUSH_TOKENS).doc(tokenId).set({
    token, actorKind:who.kind, firebaseUid:who.firebaseUid, studentUid:who.studentUid, teacherUid:who.teacherUid, role:who.role, displayName:who.displayName,
    deviceInfo:text(input.deviceInfo,500), active:true, updatedAtMs:now, updatedAt:FieldValue.serverTimestamp(), version:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION
  }, { merge:true });
  return { ok:true, status:"success" };
});

async function resolveTeacherTargets(job: DocumentData): Promise<Set<string>> {
  const targetKeys = new Set<string>();
  unique(job.instructorUids,160).forEach(uid => targetKeys.add(`uid:${uid}`));
  uniqueNames(job.instructorNames).forEach(name => targetKeys.add(`name:${teacherNameKey(name)}`));
  return targetKeys;
}
async function deliverNotification(jobDoc: DocumentSnapshot<DocumentData>): Promise<void> {
  const job = jobDoc.data() ?? {};
  if (text(job.state,30) === "complete") return;
  const kind = text(job.kind,40);
  let tokenDocs: QueryDocumentSnapshot<DocumentData>[] = [];
  if (kind === "practice_feedback") {
    const studentUid = text(job.studentUid,160);
    if (!studentUid) return;
    const snap = await db().collection(PUSH_TOKENS).where("studentUid","==",studentUid).where("active","==",true).limit(30).get();
    tokenDocs = snap.docs;
  } else if (kind === "practice_upload") {
    const targets = await resolveTeacherTargets(job);
    if (!targets.size) { await jobDoc.ref.set({ state:"complete", result:"no_assigned_teacher", updatedAtMs:Date.now(), updatedAt:FieldValue.serverTimestamp() }, { merge:true }); return; }
    const snap = await db().collection(PUSH_TOKENS).where("actorKind","==","staff").where("active","==",true).limit(200).get();
    tokenDocs = snap.docs.filter(doc => {
      const data = doc.data() ?? {};
      const byUid = text(data.teacherUid,160) && targets.has(`uid:${text(data.teacherUid,160)}`);
      const byName = text(data.displayName,120) && targets.has(`name:${teacherNameKey(data.displayName)}`);
      return byUid || byName;
    });
  }
  const tokens = Array.from(new Set(tokenDocs.map(doc => text(doc.data().token,5000)).filter(Boolean)));
  if (!tokens.length) { await jobDoc.ref.set({ state:"complete", result:"no_token", updatedAtMs:Date.now(), updatedAt:FieldValue.serverTimestamp() }, { merge:true }); return; }
  const recordId = text(job.recordId,160);
  const isFeedback = kind === "practice_feedback";
  const practiceDate = text(job.practiceDate,10);
  const taskType = text(job.taskType,60);
  const teacherName = text(job.teacherName,120) || "담당강사";
  const studentName = text(job.studentName,120) || "학생";
  const evaluationId = text(job.evaluationId,160);
  const evaluatorKey = text(job.evaluatorKey,160);
  const teacherUid = text(job.teacherUid,160);
  const studentUid = text(job.studentUid,160);
  const title = isFeedback ? `${teacherName}T의 코멘트 도착!` : `${studentName} 학생 연습 완료`;
  const body = isFeedback
    ? `${practiceDate || "오늘"} 연습일지에서 ${teacherName}T의 평가를 확인해보세요.`
    : `${studentName} 학생의 ${taskType === "past_question" ? "기출문제" : taskType === "standard_pronunciation" ? "표준발음" : "발성훈련"} 기록을 확인해보세요.`;
  const url = isFeedback
    ? `https://ulimvoice.github.io/ulimvoice/?open=practice-feedback&recordId=${encodeURIComponent(recordId)}&date=${encodeURIComponent(practiceDate)}&evaluationId=${encodeURIComponent(evaluationId)}&evaluatorKey=${encodeURIComponent(evaluatorKey)}&teacherUid=${encodeURIComponent(teacherUid)}`
    : `https://ulimvoice.github.io/ulimvoice/?open=admin-practice&recordId=${encodeURIComponent(recordId)}&date=${encodeURIComponent(practiceDate)}&studentUid=${encodeURIComponent(studentUid)}&taskType=${encodeURIComponent(taskType)}`;
  const response = await getMessaging(app()).sendEachForMulticast({
    tokens,
    data:{
      title, body, kind, recordId, url, practiceDate, taskType,
      evaluationId, evaluatorKey, teacherUid, teacherName, studentUid, studentName
    }
  });
  const invalid = new Set<string>();
  response.responses.forEach((item,index) => {
    if (item.success) return;
    const code = text((item.error as { code?:string } | undefined)?.code,160);
    if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) invalid.add(tokens[index]);
  });
  if (invalid.size) {
    const batch = db().batch();
    tokenDocs.forEach(doc => { if (invalid.has(text(doc.data().token,5000))) batch.set(doc.ref,{ active:false, disabledAtMs:Date.now(), updatedAt:FieldValue.serverTimestamp() },{merge:true}); });
    await batch.commit();
  }
  await jobDoc.ref.set({ state:"complete", sentCount:response.successCount, failedCount:response.failureCount, completedAtMs:Date.now(), updatedAtMs:Date.now(), updatedAt:FieldValue.serverTimestamp() }, { merge:true });
}

export const deliverPracticeNotificationJob7355042 = onDocumentCreated({
  document:`${NOTIFICATION_JOBS}/{jobId}`, region:ULIM_FUNCTION_REGION, retry:false, timeoutSeconds:90, memory:"256MiB"
}, async event => { if (event.data) await deliverNotification(event.data); });

const ANALYSIS_HEADERS = ["backupEventId","backupAt","analysisRunId","recordId","trainingSampleId","기능구분","연습날짜","studentUid","문장ID","원문/대본","표준발음","인식결과","음성특징JSON","분석출처","모델","엔진버전","음성파일URL","데이터활용동의버전","createdAtMs","updatedAtMs","데이터버전"];
const TEACHER_HEADERS = ["backupEventId","backupAt","평가ID","기록ID","기능구분","studentUid","강사UID","강사명","점수JSON","평균점수","개인코멘트","상태","평가표버전","createdAtMs","updatedAtMs","데이터버전"];
const TRAINING_HEADERS = ["backupEventId","backupAt","trainingSampleId","기록ID","기능구분","연습날짜","문장ID","원문/대본","표준발음","인식결과","음성특징JSON","강사정답JSON","라벨상태","학습사용가능여부","데이터셋버전","음성참조URL","동의정책버전","createdAtMs","updatedAtMs","데이터버전"];
const STATUS_HEADERS = ["백업ID","시작시각","종료시각","이전cursorMs","새cursorMs","분석건수","강사평가건수","학습샘플건수","상태","메시지","백업버전"];
const SHEETS = Object.freeze({ analysis:"ULIM_분석데이터_백업", teacher:"ULIM_강사평가_백업", training:"ULIM_AI학습데이터_백업", status:"ULIM_백업상태" });

async function accessToken(): Promise<string> {
  const scope = encodeURIComponent("https://www.googleapis.com/auth/spreadsheets");
  const response = await fetch(`http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token?scopes=${scope}`, {
    headers:{ "Metadata-Flavor":"Google" }
  });
  if (!response.ok) throw new Error(`Functions service account scoped token unavailable: ${response.status}`);
  const payload = object(await response.json());
  const token = text(payload.access_token,5000);
  if (!token) throw new Error("Functions service account scoped token empty");
  return token;
}
async function sheetsFetch(path: string, token: string, init?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<unknown> {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${TARGET_SPREADSHEET_ID}${path}`, {
    ...(init ?? {}), headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json", ...((init && init.headers) || {}) }
  });
  const raw = await response.text();
  let parsed: unknown = {};
  try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { raw }; }
  if (!response.ok) throw new Error(`Sheets API ${response.status}: ${text((object(parsed).error as PlainObject | undefined)?.message ?? raw,1000)}`);
  return parsed;
}
async function ensureBackupSheets(token: string): Promise<void> {
  const meta = object(await sheetsFetch("?fields=sheets.properties.title",token));
  const existing = new Set((Array.isArray(meta.sheets) ? meta.sheets : []).map(item => text(object(object(item).properties).title,200)));
  const missing = Object.values(SHEETS).filter(title => !existing.has(title));
  if (missing.length) await sheetsFetch(":batchUpdate",token,{ method:"POST", body:JSON.stringify({ requests:missing.map(title => ({ addSheet:{ properties:{ title } } })) }) });
}
async function ensureHeader(token: string, sheet: string, headers: string[]): Promise<void> {
  const range = encodeURIComponent(`'${sheet}'!1:1`);
  const data = object(await sheetsFetch(`/values/${range}?majorDimension=ROWS`,token));
  const values = Array.isArray(data.values) ? data.values : [];
  if (values.length && Array.isArray(values[0]) && values[0].length) return;
  await sheetsFetch(`/values/${range}?valueInputOption=RAW`,token,{ method:"PUT", body:JSON.stringify({ range:`'${sheet}'!1:1`, majorDimension:"ROWS", values:[headers] }) });
}
async function appendRows(token: string, sheet: string, rows: unknown[][]): Promise<void> {
  if (!rows.length) return;
  const range = encodeURIComponent(`'${sheet}'!A:ZZ`);
  for (let i=0;i<rows.length;i+=400) {
    const chunk = rows.slice(i,i+400);
    await sheetsFetch(`/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,token,{ method:"POST", body:JSON.stringify({ values:chunk }) });
  }
}
async function fetchChanged(collection: string, cursorMs: number): Promise<DocumentData[]> {
  const out: DocumentData[] = [];
  let last: QueryDocumentSnapshot<DocumentData> | null = null;
  for (let guard=0;guard<30;guard+=1) {
    let query = db().collection(collection).where("updatedAtMs", ">", cursorMs).orderBy("updatedAtMs","asc").limit(1000);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;
    out.push(...snap.docs.map(doc => ({ __id:doc.id, ...doc.data() })));
    last = snap.docs[snap.docs.length-1];
    if (snap.size < 1000) break;
  }
  return out;
}
function backupEventId(prefix: string, row: DocumentData): string { return `${prefix}|${text(row.__id ?? row.analysisRunId ?? row.evaluationId ?? row.trainingSampleId,200)}|${int(row.updatedAtMs,0)}`; }
function nowIso(): string { return new Date().toISOString(); }
async function executeBackup(): Promise<{ analysis:number; teacher:number; training:number; cursorMs:number }> {
  const stateRef = db().doc(BACKUP_STATE_DOC);
  const stateSnap = await stateRef.get();
  const oldCursor = Math.max(0,int(stateSnap.data()?.cursorMs,0));
  const startedAt = nowIso();
  const [analysis, teacher, training] = await Promise.all([fetchChanged(ANALYSIS_RUNS,oldCursor),fetchChanged(TEACHER_EVALUATIONS,oldCursor),fetchChanged(TRAINING_SAMPLES,oldCursor)]);
  const maxCursor = Math.max(oldCursor,...analysis.map(r=>int(r.updatedAtMs,0)),...teacher.map(r=>int(r.updatedAtMs,0)),...training.map(r=>int(r.updatedAtMs,0)));
  const token = await accessToken();
  await ensureBackupSheets(token);
  await ensureHeader(token,SHEETS.analysis,ANALYSIS_HEADERS);
  await ensureHeader(token,SHEETS.teacher,TEACHER_HEADERS);
  await ensureHeader(token,SHEETS.training,TRAINING_HEADERS);
  await ensureHeader(token,SHEETS.status,STATUS_HEADERS);
  const backupAt = nowIso();
  await appendRows(token,SHEETS.analysis,analysis.map(r => [
    backupEventId("ANALYSIS",r),backupAt,text(r.analysisRunId),text(r.recordId),text(r.trainingSampleId),text(r.taskType),text(r.practiceDate),text(r.studentUid),text(r.sentenceId),text(r.sentence),text(r.standardPronunciation),text(r.recognizedText),plainJson(r.features),text(r.provider),text(r.model),text(r.engineVersion),text(r.fileUrl),text(r.consentPolicyVersion),int(r.createdAtMs,0),int(r.updatedAtMs,0),text(r.version)
  ]));
  await appendRows(token,SHEETS.teacher,teacher.map(r => [
    backupEventId("TEACHER",r),backupAt,text(r.evaluationId),text(r.recordId),text(r.taskType),text(r.studentUid),text(r.teacherUid),text(r.teacherName),plainJson(r.scores ?? r.scoreJson),numberValue(r.scoreAverage,0),text(r.comment),text(r.evaluationStatus),text(r.rubricVersion),int(r.createdAtMs,0),int(r.updatedAtMs,0),text(r.version)
  ]));
  await appendRows(token,SHEETS.training,training.map(r => [
    backupEventId("TRAINING",r),backupAt,text(r.trainingSampleId),text(r.recordId),text(r.taskType),text(r.practiceDate),text(r.sentenceId),text(r.sentence),text(r.standardPronunciation),text(r.recognizedText),plainJson(r.acousticFeatures),plainJson(r.teacherLabels),text(r.labelState),r.learningEligible === true ? "Y":"N",text(r.datasetVersion),text(r.fileReference),text(r.consentPolicyVersion),int(r.createdAtMs,0),int(r.updatedAtMs,0),text(r.version)
  ]));
  const endedAt = nowIso();
  await appendRows(token,SHEETS.status,[[`BACKUP_${Date.now()}`,startedAt,endedAt,oldCursor,maxCursor,analysis.length,teacher.length,training.length,"success","",STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION]]);
  await stateRef.set({ cursorMs:maxCursor, lastSuccessAtMs:Date.now(), lastSuccessAt:FieldValue.serverTimestamp(), lastCounts:{analysis:analysis.length,teacher:teacher.length,training:training.length}, spreadsheetId:TARGET_SPREADSHEET_ID, version:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION },{merge:true});
  return { analysis:analysis.length, teacher:teacher.length, training:training.length, cursorMs:maxCursor };
}

export const backupUlimPracticeIntelligenceToSheets7355042 = onSchedule({
  schedule:"0 6 * * *", timeZone:"Asia/Seoul", region:ULIM_FUNCTION_REGION, retryCount:0, timeoutSeconds:300, memory:"512MiB"
}, async () => {
  try { await executeBackup(); }
  catch (error) {
    await db().doc(BACKUP_STATE_DOC).set({ lastFailureAtMs:Date.now(), lastFailureAt:FieldValue.serverTimestamp(), lastError:text(error instanceof Error ? error.message : error,2000), version:STUDENT_PRACTICE_INTELLIGENCE_7355042_VERSION },{merge:true});
    throw error;
  }
});

async function runtimeServiceAccountEmail(): Promise<string> {
  try {
    const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email", { headers:{ "Metadata-Flavor":"Google" } });
    if (response.ok) return text(await response.text(),300);
  } catch {}
  return "";
}
export const getPracticeBackupStatusAdmin7355042 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStaff(request);
  if (!fullAdmin(caller.role)) throw new HttpsError("permission-denied", "전체관리자 권한이 필요합니다.");
  const snap = await db().doc(BACKUP_STATE_DOC).get();
  return { ok:true, status:snap.data() ?? {}, spreadsheetId:TARGET_SPREADSHEET_ID, serviceAccountEmail:await runtimeServiceAccountEmail(), requiredSheets:Object.values(SHEETS) };
});
