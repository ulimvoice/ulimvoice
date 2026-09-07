import { createHash, createHmac } from "node:crypto";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_LEGACY_PROOF_HMAC_SECRET } from "../common/firebaseSecrets.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";

export const PRACTICE_CONTENT_FIRESTORE_PRIMARY_7355063_VERSION = "2026-08-16.735.05.0.64-r29.5.2-vocal-segmented-gemini";
export const ULIM_GEMINI_API_KEY_7355063 = defineSecret("ULIM_GEMINI_API_KEY");

const REGION = "asia-northeast3";
const VOCAL_SET_DAYS = 100;
const VOCAL_SET_SIZE = 100;
const VOCAL_GENERATION_LEASE_MS = 8 * 60 * 1000;
const PAST_SYNC_LEASE_MS = 8 * 60 * 1000;
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyS3QUvrjNbwvaw92_g-QKQyN3Yito8DAdpAjxUzfnsuVf3Ce7ccuaXIv651U7FnYF4/exec";
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const PROMPT_VERSION = "ulim-vocal-100-v114-segmented-7355064";

type PlainObject = Record<string, unknown>;
type AdminCaller = { uid: string; role: "admin" | "superAdmin"; name: string };

type VocalSetInfo = {
  setId: string;
  generationNo: number;
  generatedAtMs: number;
  expiresAtMs: number;
  sentenceCount: number;
  model: string;
  promptVersion: string;
  stale?: boolean;
};

function app() { return getOrInitializeDefaultFirebaseAdminApp(); }
function db() { return getFirestore(app()); }
function object(value: unknown): PlainObject { return value && typeof value === "object" && !Array.isArray(value) ? value as PlainObject : {}; }
function text(value: unknown, max = 2000): string { return String(value ?? "").trim().slice(0, max); }
function integer(value: unknown, fallback = 0): number { const n = Number(value); return Number.isFinite(n) ? Math.trunc(n) : fallback; }
function hash(...parts: unknown[]): string { return createHash("sha256").update(parts.map(v => String(v ?? "")).join("|")).digest("hex"); }
function base64Url(input: Buffer): string { return input.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
function kstDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(date);
  const map: Record<string,string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}
function addDaysMs(ms: number, days: number): number { return ms + days * 24 * 60 * 60 * 1000; }
function normalizeCompactSentence(value: unknown): string {
  return text(value, 200).normalize("NFC").replace(/[\s\p{P}\p{S}]+/gu, "").toLowerCase();
}
function normalizeSentence(value: unknown): string {
  let s = text(value, 160).normalize("NFC").replace(/\s+/g, " ").trim();
  if (s && !/[.!?]$/.test(s)) s += ".";
  return s;
}
function validSentence(value: string): boolean {
  const s = normalizeSentence(value);
  const compactLen = s.replace(/\s/g, "").length;
  if (compactLen < 12 || compactLen > 55) return false;
  if (!s.endsWith(".")) return false;
  if (/[A-Za-z0-9]/.test(s)) return false;
  if (/["'“”‘’`()\[\]{}<>@#$%^&*_+=~|\\/]/.test(s)) return false;
  if (/https?:|www\.|정치|선거운동|종교를 믿|폭력적으로|성적인/.test(s)) return false;
  return true;
}
function parseJsonStringArray(raw: string): string[] {
  const source = text(raw, 200000).replace(/^```(?:json)?/i, "").replace(/```$/g, "").trim();
  const start = source.indexOf("[");
  const end = source.lastIndexOf("]");
  const target = start >= 0 && end > start ? source.slice(start, end + 1) : source;
  try {
    const parsed = JSON.parse(target);
    return Array.isArray(parsed) ? parsed.map(item => String(item ?? "")) : [];
  } catch {
    return [];
  }
}
function validateGeneratedSentences(raw: string[], banned: Set<string>): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const sentence = normalizeSentence(item);
    const key = normalizeCompactSentence(sentence);
    if (!validSentence(sentence) || !key || banned.has(key) || seen.has(key)) continue;
    seen.add(key);
    output.push(sentence);
  }
  if (output.length !== VOCAL_SET_SIZE) {
    throw new Error(`GEMINI_VOCAL_SENTENCE_COUNT_${output.length}`);
  }
  return output;
}

type VocalSegmentSpec = {
  key: "vowel" | "consonant" | "balanced" | "integrated";
  start: number;
  end: number;
  count: number;
  title: string;
  rules: string[];
};

const VOCAL_SEGMENTS_7355064: VocalSegmentSpec[] = [
  {
    key:"vowel", start:1, end:30, count:30, title:"모음 집중 훈련",
    rules:[
      "ㅏ, ㅓ, ㅗ, ㅜ, ㅡ, ㅣ, ㅐ, ㅔ, ㅑ, ㅕ, ㅛ, ㅠ, ㅘ, ㅝ, ㅢ 등 모음 구분이 잘 드러나게 하라.",
      "받침이 과하게 많은 문장은 피하고 입 모양과 모음 이동을 연습하기 쉬운 개방음절을 충분히 넣어라.",
      "예시 방향: 아이가 어머니 옆에서 오래 이어지는 이야기를 읽었다."
    ]
  },
  {
    key:"consonant", start:31, end:60, count:30, title:"자음 집중 훈련",
    rules:[
      "평음, 경음, 격음, 받침, 겹받침, 파열음, 마찰음, 비음, 유음을 균형 있게 포함하라.",
      "된소리되기, 비음화, 유음화, 구개음화, ㅎ 축약과 탈락이 자연스럽게 들어가도 좋다.",
      "표준발음 변환 기준이 모호한 신조어, 외래어, 고유명사 남발은 피하라.",
      "예시 방향: 국밥 한 그릇을 먹고 닫힌 문 앞에서 또렷하게 읽었다."
    ]
  },
  {
    key:"balanced", start:61, end:90, count:30, title:"모음과 자음 균형 훈련",
    rules:[
      "개방음절과 폐음절이 모두 섞인 자연스러운 한 문장으로 구성하라.",
      "실제 낭독 수업에서 바로 읽기 좋은 정보 전달형 문장을 우선하라.",
      "예시 방향: 오래된 시장 골목에서 학생들이 정확한 발음으로 문장을 읽었다."
    ]
  },
  {
    key:"integrated", start:91, end:100, count:10, title:"실전 종합 훈련",
    rules:[
      "직접 인용은 저작권 보호기간이 만료된 공개영역 문구, 공공문구, 고전 문헌에 한정하라.",
      "현대 칼럼, 최근 문학작품, 출처가 불명확한 문구는 직접 인용하지 말고 새로 창작하라.",
      "인용문도 발성훈련용 한 문장으로 자연스럽게 다듬고 과도하게 감상적인 문장은 피하라.",
      "예시 방향: 하늘을 우러러 마음을 바르게 세우고 오늘의 말을 고르게 읽었다."
    ]
  }
];

function vocalSegmentPrompt(cycleKey: string, segment: VocalSegmentSpec, bannedCompactKeys: string[]): string {
  const lines = [
    `발성훈련용 한국어 문장 ${segment.count}개를 새로 창작하라.`,
    `현재 100일 주기: ${cycleKey}`,
    `담당 구간: ${segment.start}~${segment.end}번 / ${segment.title}`,
    "",
    "## 절대 출력 형식",
    "- 반드시 JSON 문자열 배열 하나만 출력하라.",
    `- 배열 길이는 정확히 ${segment.count}개여야 한다.`,
    "- 설명, 제목, 코드블록, 번호, 주석, 객체, 마크다운을 절대 쓰지 마라.",
    "- 예: [\"문장입니다.\", \"다음 문장입니다.\"]",
    "",
    `## ${segment.title} 기준`,
    ...segment.rules.map(rule => `- ${rule}`),
    "",
    "## 문체 기준",
    "- 대부분의 문장은 NA 나레이션처럼 감정이 거의 없는 중립 문장으로 작성하라.",
    "- 정보 전달형, 관찰형, 설명형 문장을 우선하라.",
    "- 대사체, 감탄문, 과장된 감정 표현, 눈물·사랑·이별·분노 같은 멜로드라마식 소재는 피하라.",
    "",
    "## 표준발음 변환 기준과 충돌하지 않게 할 것",
    "- 조사 의와 단어 내부 ㅢ가 섞인 문장은 만들 수 있지만 과하게 반복하지 마라.",
    "- 우리의, 민주주의의, 회의의, 문의의, 태양의, 집의, 숲의, 물의 같은 표현은 표준발음 변환 점검용으로 일부만 사용하라.",
    "- 밭 아래, 꽃 위, 닭 앞에, 흙 위, 겉옷, 맛없다, 멋있다, 값어치, 값있는 같은 실질 형태소 연결 예시는 일부만 사용하라.",
    "- 싫어도, 많아도, 넓은, 밝은, 같이, 굳이, 닫히다, 묻히다, 굳히다, 꽂히다, 앉히다, 닦히다 같은 훈련어를 적절히 분산하라.",
    "- 색연필, 한여름, 신라, 설날, 신을 신고, 혼인 신고처럼 ㄴ 첨가·유음화·품사 차이가 드러나는 표현은 과하지 않게 넣어라.",
    "",
    "## 공통 생성 규칙",
    "- 이전 주기 문장과 완전히 다른 새 문장만 작성하라.",
    "- 각 문장은 15~40글자 정도의 자연스러운 한 문장으로 작성하라.",
    "- 문장은 반드시 마침표로 끝내라.",
    "- 같은 주어, 같은 동사 패턴, 같은 배경이 반복되지 않도록 다양하게 구성하라.",
    "- 외래어, 영어, 숫자, 괄호, 따옴표, 이모지, 특수기호를 쓰지 마라.",
    "- 학생이 읽기 불편한 폭력적·선정적·정치적·종교 선전성 문장은 만들지 마라.",
    "",
    "## 금지 압축문장키",
    "아래 압축키와 같거나 거의 같은 문장은 절대 만들지 마라.",
    bannedCompactKeys.length ? bannedCompactKeys.slice(0, 240).join("\n") : "없음"
  ];
  return lines.join("\n");
}

async function callGeminiForVocalSegment(model: string, prompt: string, expectedCount: number): Promise<string[]> {
  const apiKey = ULIM_GEMINI_API_KEY_7355063.value() || process.env.ULIM_GEMINI_API_KEY || "";
  if (!apiKey) throw new HttpsError("failed-precondition", "발성 문장 생성 설정이 완료되지 않았습니다.");
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-goog-api-key":apiKey },
        body:JSON.stringify({
          contents:[{ role:"user", parts:[{ text:prompt }] }],
          generationConfig:{ responseMimeType:"application/json", maxOutputTokens:expectedCount <= 10 ? 2600 : 5200 }
        }),
        signal:AbortSignal.timeout(55_000)
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}:${body.slice(0, 800)}`);
      const parsed = JSON.parse(body) as PlainObject;
      const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
      const first = object(candidates[0]);
      const content = object(first.content);
      const parts = Array.isArray(content.parts) ? content.parts : [];
      const output = parts.map(part => text(object(part).text, 80000)).join("\n").trim();
      const list = parseJsonStringArray(output);
      if (list.length === expectedCount) return list;
      lastError = `GEMINI_RETURNED_${list.length}_EXPECTED_${expectedCount}`;
    } catch (error) {
      const message = text((error as Error)?.message ?? error, 1200);
      lastError = message.includes("aborted due to timeout") || message.includes("TimeoutError")
        ? `GEMINI_SEGMENT_TIMEOUT_ATTEMPT_${attempt}`
        : message;
    }
  }
  throw new Error(lastError || "GEMINI_VOCAL_SEGMENT_GENERATION_FAILED");
}

async function callGeminiForVocalSentences(model: string, cycleKey: string, bannedCompactKeys: string[]): Promise<string[]> {
  const segmentResults = await Promise.all(
    VOCAL_SEGMENTS_7355064.map(segment =>
      callGeminiForVocalSegment(model, vocalSegmentPrompt(cycleKey, segment, bannedCompactKeys), segment.count)
    )
  );
  return segmentResults.flat();
}

async function recentVocalSentenceKeys(limitSets = 4): Promise<Set<string>> {
  const set = new Set<string>();
  const snaps = await db().collection("vocalSentenceSets").orderBy("generatedAtMs", "desc").limit(limitSets).get();
  for (const setDoc of snaps.docs) {
    const sentences = await setDoc.ref.collection("sentences").limit(VOCAL_SET_SIZE).get();
    for (const doc of sentences.docs) {
      const key = normalizeCompactSentence(doc.data()?.text);
      if (key) set.add(key);
    }
  }
  return set;
}

async function readSetInfo(setId: string): Promise<VocalSetInfo | null> {
  if (!setId) return null;
  const snap = await db().collection("vocalSentenceSets").doc(setId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  if (integer(data.sentenceCount, 0) !== VOCAL_SET_SIZE || text(data.status, 40) === "failed") return null;
  return {
    setId:snap.id,
    generationNo:integer(data.generationNo,1),
    generatedAtMs:integer(data.generatedAtMs,0),
    expiresAtMs:integer(data.expiresAtMs,0),
    sentenceCount:integer(data.sentenceCount,VOCAL_SET_SIZE),
    model:text(data.model,120) || DEFAULT_GEMINI_MODEL,
    promptVersion:text(data.promptVersion,160) || PROMPT_VERSION
  };
}

export async function ensureActiveVocalSentenceSet7355063(options: { force?: boolean; actor?: string } = {}): Promise<VocalSetInfo> {
  const pointerRef = db().collection("practiceContent").doc("vocal");
  const now = Date.now();
  const pointerSnap = await pointerRef.get();
  const pointer = pointerSnap.data() ?? {};
  const activeSetId = text(pointer.activeSetId, 160);
  const existing = await readSetInfo(activeSetId);
  if (existing && options.force !== true && existing.expiresAtMs > now) return existing;

  const leaseId = `VOCAL_GEN_${hash(now, Math.random()).slice(0,20)}`;
  const lease = await db().runTransaction(async tx => {
    const snap = await tx.get(pointerRef);
    const data = snap.data() ?? {};
    const leaseUntil = integer(data.generationLeaseUntilMs, 0);
    const currentActiveId = text(data.activeSetId, 160);
    if (leaseUntil > now) return { acquired:false, currentActiveId };
    tx.set(pointerRef, {
      generationLeaseId:leaseId,
      generationLeaseUntilMs:now + VOCAL_GENERATION_LEASE_MS,
      generationState:"generating",
      generationRequestedBy:text(options.actor,120) || "system",
      updatedAtMs:now,
      updatedAt:FieldValue.serverTimestamp()
    }, { merge:true });
    return { acquired:true, currentActiveId };
  });

  if (!lease.acquired) {
    const current = await readSetInfo(lease.currentActiveId);
    if (current) return { ...current, stale:true };
    throw new HttpsError("unavailable", "새 발성 문장 세트를 준비하고 있습니다. 잠시 후 다시 시도해주세요.");
  }

  try {
    const freshPointer = (await pointerRef.get()).data() ?? {};
    const previousId = text(freshPointer.activeSetId,160);
    const previous = await readSetInfo(previousId);
    if (previous && options.force !== true && previous.expiresAtMs > Date.now()) {
      await pointerRef.set({ generationLeaseUntilMs:0, generationState:"ready", updatedAtMs:Date.now(), updatedAt:FieldValue.serverTimestamp() }, { merge:true });
      return previous;
    }

    const banned = await recentVocalSentenceKeys(4);
    const generationNo = Math.max(1, integer(freshPointer.generationNo,0) + 1);
    const cycleKey = `${kstDateKey()}-G${generationNo}`;
    const model = text(freshPointer.geminiModel,120) || DEFAULT_GEMINI_MODEL;
    const raw = await callGeminiForVocalSentences(model, cycleKey, Array.from(banned));
    const sentences = validateGeneratedSentences(raw, banned);
    const generatedAtMs = Date.now();
    const expiresAtMs = addDaysMs(generatedAtMs, VOCAL_SET_DAYS);
    const setId = `VOCALSET_${kstDateKey().replace(/-/g,"")}_${String(generationNo).padStart(4,"0")}_${hash(generatedAtMs, sentences.join("|")).slice(0,10)}`;
    const setRef = db().collection("vocalSentenceSets").doc(setId);
    const batch = db().batch();
    batch.set(setRef, {
      setId,
      generationNo,
      generatedAtMs,
      expiresAtMs,
      generatedAt:FieldValue.serverTimestamp(),
      status:"active",
      sentenceCount:VOCAL_SET_SIZE,
      model,
      promptVersion:PROMPT_VERSION,
      cycleKey,
      previousSetId:previousId,
      version:PRACTICE_CONTENT_FIRESTORE_PRIMARY_7355063_VERSION
    });
    sentences.forEach((sentence,index) => {
      const id = String(index + 1);
      const group = index < 30 ? "vowel" : index < 60 ? "consonant" : index < 90 ? "balanced" : "integrated";
      batch.set(setRef.collection("sentences").doc(id.padStart(3,"0")), {
        id,
        order:index + 1,
        group,
        text:sentence,
        pron:"",
        audio:"",
        setId,
        active:true,
        createdAtMs:generatedAtMs,
        version:PRACTICE_CONTENT_FIRESTORE_PRIMARY_7355063_VERSION
      });
    });
    if (previousId && previousId !== setId) {
      batch.set(db().collection("vocalSentenceSets").doc(previousId), { status:"archived", archivedAtMs:generatedAtMs, archivedAt:FieldValue.serverTimestamp() }, { merge:true });
    }
    batch.set(pointerRef, {
      activeSetId:setId,
      generationNo,
      generatedAtMs,
      expiresAtMs,
      sentenceCount:VOCAL_SET_SIZE,
      geminiModel:model,
      promptVersion:PROMPT_VERSION,
      generationState:"ready",
      generationLeaseId:"",
      generationLeaseUntilMs:0,
      lastGenerationError:"",
      updatedAtMs:generatedAtMs,
      updatedAt:FieldValue.serverTimestamp(),
      version:PRACTICE_CONTENT_FIRESTORE_PRIMARY_7355063_VERSION
    }, { merge:true });
    await batch.commit();
    return { setId, generationNo, generatedAtMs, expiresAtMs, sentenceCount:VOCAL_SET_SIZE, model, promptVersion:PROMPT_VERSION };
  } catch (error) {
    await pointerRef.set({
      generationState:"error",
      generationLeaseId:"",
      generationLeaseUntilMs:0,
      lastGenerationError:text((error as Error)?.message ?? error,1200),
      lastGenerationErrorAtMs:Date.now(),
      updatedAt:FieldValue.serverTimestamp()
    }, { merge:true });
    if (existing) return { ...existing, stale:true };
    throw error;
  }
}

export async function getVocalSentenceFromSet7355063(setId: string, sentenceId: string): Promise<PlainObject> {
  const cleanSetId = text(setId,160);
  const numericId = integer(sentenceId,0);
  if (!cleanSetId || numericId < 1 || numericId > 100) throw new HttpsError("failed-precondition", "발성 문장 배정정보를 확인하지 못했습니다.");
  const ref = db().collection("vocalSentenceSets").doc(cleanSetId).collection("sentences").doc(String(numericId).padStart(3,"0"));
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "배정된 발성 문장을 찾지 못했습니다.");
  const row = snap.data() ?? {};
  const sentence = text(row.text,1000);
  if (!sentence) throw new HttpsError("failed-precondition", "배정된 발성 문장이 비어 있습니다.");
  return {
    id:String(numericId),
    text:sentence,
    pron:text(row.pron,2000),
    audio:text(row.audio,3000),
    group:text(row.group,60),
    order:integer(row.order,numericId),
    setId:cleanSetId,
    source:"firestore-vocal-sentence-set"
  };
}

async function requireAdmin(request: CallableRequest<unknown>): Promise<AdminCaller> {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const uid = request.auth.uid;
  const snap = await db().collection("users").doc(uid).get();
  const user = snap.data() ?? {};
  const roleRaw = text(request.auth.token.role ?? user.role,40);
  if (roleRaw !== "admin" && roleRaw !== "superAdmin") throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
  if (user.active === false) throw new HttpsError("permission-denied", "사용 중지된 관리자 계정입니다.");
  return { uid, role:roleRaw, name:text(user.name ?? request.auth.token.name,120) || uid };
}
async function requireStudentUid(request: CallableRequest<unknown>): Promise<string> {
  if (!request.auth) throw new HttpsError("unauthenticated", "학생 로그인이 필요합니다.");
  const candidates = Array.from(new Set([text(request.auth.token.studentUid,160), request.auth.uid].filter(Boolean)));
  for (const uid of candidates) {
    const snap = await db().collection("students").doc(uid).get();
    if (!snap.exists) continue;
    const row = snap.data() ?? {};
    const status = text(row.enrollmentStatus ?? row.studentStatus ?? row.status,40).toLowerCase();
    if (["withdrawn","cancelled","퇴원","등록취소"].includes(status) || row.registrationCancelled === true) break;
    return uid;
  }
  throw new HttpsError("permission-denied", "학생 계정 연결정보를 확인하지 못했습니다.");
}
function driveFolderIdFromUrl(value: unknown): string {
  const raw = text(value,2000);
  const direct = raw.match(/^[A-Za-z0-9_-]{15,}$/)?.[0] || "";
  if (direct) return direct;
  const folder = raw.match(/\/folders\/([A-Za-z0-9_-]{15,})/i)?.[1] || "";
  const idParam = raw.match(/[?&]id=([A-Za-z0-9_-]{15,})/i)?.[1] || "";
  return folder || idParam;
}
function signGas(action: string, requestId: string, issuedAtMs: number, payloadJson: string): string {
  const secret = ULIM_LEGACY_PROOF_HMAC_SECRET.value() || process.env.ULIM_LEGACY_PROOF_HMAC_SECRET || "";
  if (!secret) throw new HttpsError("failed-precondition", "Drive 연결 인증 설정을 확인하지 못했습니다.");
  return base64Url(createHmac("sha256", secret).update(`v1|${action}|${requestId}|${issuedAtMs}|${payloadJson}`,"utf8").digest());
}
async function callGas(action: string, payload: PlainObject): Promise<PlainObject> {
  const requestId = `PRACTICE_CONTENT_${hash(action,Date.now(),Math.random()).slice(0,28)}`;
  const issuedAtMs = Date.now();
  const payloadJson = JSON.stringify(payload);
  const signature = signGas(action,requestId,issuedAtMs,payloadJson);
  const response = await fetch(GAS_WEB_APP_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json; charset=utf-8", "Accept":"application/json" },
    body:JSON.stringify({ action, requestId, issuedAtMs, payloadJson, signature }),
    redirect:"follow",
    signal:AbortSignal.timeout(60_000)
  });
  const body = await response.text();
  let parsed: PlainObject = {};
  try { parsed = body ? JSON.parse(body) as PlainObject : {}; } catch { throw new Error(`GAS_INVALID_JSON:${body.slice(0,300)}`); }
  if (!response.ok || text(parsed.status,30) !== "success" || parsed.ok === false) {
    throw new Error(text(parsed.message,1200) || text(parsed.code,300) || `GAS_HTTP_${response.status}`);
  }
  return parsed;
}

async function syncPastQuestionCatalogInternal(actor: string, force = false): Promise<PlainObject> {
  const settingRef = db().collection("practiceContent").doc("pastQuestion");
  const now = Date.now();
  const leaseId = `PAST_SYNC_${hash(now,Math.random()).slice(0,20)}`;
  const acquired = await db().runTransaction(async tx => {
    const snap = await tx.get(settingRef);
    const data = snap.data() ?? {};
    const folderId = text(data.driveFolderId,180);
    if (!folderId) throw new HttpsError("failed-precondition", "기출 대본 Google Drive 폴더 링크를 먼저 저장해주세요.");
    if (!force && text(data.lastSyncedMonth,7) === kstDateKey().slice(0,7) && integer(data.lastSyncCount,0) > 0) {
      return { acquired:false, duplicate:true, folderId, current:data };
    }
    if (integer(data.syncLeaseUntilMs,0) > now) return { acquired:false, duplicate:false, folderId, current:data };
    tx.set(settingRef, { syncLeaseId:leaseId, syncLeaseUntilMs:now + PAST_SYNC_LEASE_MS, syncState:"syncing", lastSyncRequestedBy:actor, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    return { acquired:true, duplicate:false, folderId, current:data };
  });
  if (!acquired.acquired) {
    if (acquired.duplicate) return { ok:true, duplicate:true, status:"success", count:integer((acquired.current as PlainObject).lastSyncCount,0) };
    throw new HttpsError("aborted", "기출 대본 갱신이 이미 진행 중입니다.");
  }

  try {
    const listed = await callGas("readPastQuestionDriveCatalog7355063", { mode:"list", folderId:acquired.folderId });
    const items = (Array.isArray(listed.items) ? listed.items : []).map(item => object(item))
      .filter(item => ["male","female"].includes(text(item.gender,20)) && integer(item.scriptNo,0) >= 1 && integer(item.scriptNo,0) <= 100 && text(item.fileId,180));
    if (!items.length) throw new Error("DRIVE_PAST_QUESTION_CATALOG_EMPTY");

    const contentMap = new Map<string,PlainObject>();
    for (let i = 0; i < items.length; i += 20) {
      const fileIds = items.slice(i,i+20).map(item => text(item.fileId,180));
      const chunk = await callGas("readPastQuestionDriveCatalog7355063", { mode:"content", folderId:acquired.folderId, fileIds });
      for (const item of Array.isArray(chunk.items) ? chunk.items : []) {
        const row = object(item);
        const fileId = text(row.fileId,180);
        if (fileId) contentMap.set(fileId,row);
      }
    }

    const existing = await db().collection("pastQuestionCatalog").get();
    const batch = db().batch();
    for (const doc of existing.docs) batch.set(doc.ref, { active:false, updatedAtMs:now, updatedAt:FieldValue.serverTimestamp() }, { merge:true });
    let maleCount = 0;
    let femaleCount = 0;
    let stored = 0;
    const seen = new Set<string>();
    for (const meta of items) {
      const gender = text(meta.gender,20) === "female" ? "female" : "male";
      const scriptNo = integer(meta.scriptNo,0);
      const key = `${gender}_${String(scriptNo).padStart(3,"0")}`;
      if (seen.has(key)) continue;
      const contentRow = contentMap.get(text(meta.fileId,180)) ?? {};
      const content = text(contentRow.content,90000);
      if (!content) continue;
      seen.add(key);
      stored += 1;
      if (gender === "female") femaleCount += 1; else maleCount += 1;
      batch.set(db().collection("pastQuestionCatalog").doc(key), {
        catalogId:key,
        gender,
        genderLabel:gender === "female" ? "여자" : "남자",
        scriptNo,
        fileId:text(meta.fileId,180),
        fileName:text(meta.fileName ?? meta.name,500),
        mimeType:text(meta.mimeType,160),
        sourceUpdatedAt:text(meta.updatedAt,80),
        sourceUrl:text(meta.url,3000),
        content,
        active:true,
        syncedAtMs:now,
        syncedAt:FieldValue.serverTimestamp(),
        version:PRACTICE_CONTENT_FIRESTORE_PRIMARY_7355063_VERSION
      }, { merge:true });
    }
    if (!stored) throw new Error("DRIVE_PAST_QUESTION_CONTENT_EMPTY");
    batch.set(settingRef, {
      syncState:"ready",
      syncLeaseId:"",
      syncLeaseUntilMs:0,
      lastSyncedAtMs:now,
      lastSyncedAt:FieldValue.serverTimestamp(),
      lastSyncedMonth:kstDateKey().slice(0,7),
      lastSyncCount:stored,
      maleCount,
      femaleCount,
      lastSyncError:"",
      updatedAt:FieldValue.serverTimestamp(),
      version:PRACTICE_CONTENT_FIRESTORE_PRIMARY_7355063_VERSION
    }, { merge:true });
    await batch.commit();
    return { ok:true, status:"success", count:stored, maleCount, femaleCount, folderId:acquired.folderId };
  } catch (error) {
    await settingRef.set({
      syncState:"error",
      syncLeaseId:"",
      syncLeaseUntilMs:0,
      lastSyncError:text((error as Error)?.message ?? error,1600),
      lastSyncErrorAtMs:Date.now(),
      updatedAt:FieldValue.serverTimestamp()
    }, { merge:true });
    throw error;
  }
}

export const getPracticeContentAdminStatus7355063 = onCall(ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS, async request => {
  await requireAdmin(request);
  const [vocalSnap,pastSnap] = await Promise.all([
    db().collection("practiceContent").doc("vocal").get(),
    db().collection("practiceContent").doc("pastQuestion").get()
  ]);
  const vocal = vocalSnap.data() ?? {};
  const past = pastSnap.data() ?? {};
  return {
    ok:true,
    version:PRACTICE_CONTENT_FIRESTORE_PRIMARY_7355063_VERSION,
    vocal:{
      activeSetId:text(vocal.activeSetId,160), generationNo:integer(vocal.generationNo,0), generatedAtMs:integer(vocal.generatedAtMs,0), expiresAtMs:integer(vocal.expiresAtMs,0),
      sentenceCount:integer(vocal.sentenceCount,0), model:text(vocal.geminiModel,120) || DEFAULT_GEMINI_MODEL, generationState:text(vocal.generationState,40), lastError:text(vocal.lastGenerationError,1000)
    },
    pastQuestion:{
      driveFolderUrl:text(past.driveFolderUrl,3000), lastSyncedAtMs:integer(past.lastSyncedAtMs,0), lastSyncCount:integer(past.lastSyncCount,0), maleCount:integer(past.maleCount,0), femaleCount:integer(past.femaleCount,0), syncState:text(past.syncState,40), lastError:text(past.lastSyncError,1000)
    }
  };
});

export const refreshVocalSentenceSetAdmin7355063 = onCall(
  { ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS, secrets:[ULIM_GEMINI_API_KEY_7355063], timeoutSeconds:180, memory:"512MiB" },
  async request => {
    const caller = await requireAdmin(request);
    const result = await ensureActiveVocalSentenceSet7355063({ force:true, actor:`admin:${caller.uid}` });
    return { ok:true, ...result, version:PRACTICE_CONTENT_FIRESTORE_PRIMARY_7355063_VERSION };
  }
);

export const savePastQuestionDriveLinkAdmin7355063 = onCall(ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS, async request => {
  const caller = await requireAdmin(request);
  const input = object(request.data);
  const driveFolderUrl = text(input.driveFolderUrl ?? input.url,3000);
  const driveFolderId = driveFolderIdFromUrl(driveFolderUrl);
  if (!driveFolderId) throw new HttpsError("invalid-argument", "Google Drive 폴더 링크를 확인해주세요.");
  await db().collection("practiceContent").doc("pastQuestion").set({
    driveFolderUrl,
    driveFolderId,
    configuredByUid:caller.uid,
    configuredByName:caller.name,
    configuredAtMs:Date.now(),
    configuredAt:FieldValue.serverTimestamp(),
    syncState:"configured",
    updatedAt:FieldValue.serverTimestamp(),
    version:PRACTICE_CONTENT_FIRESTORE_PRIMARY_7355063_VERSION
  }, { merge:true });
  return { ok:true, driveFolderUrl, version:PRACTICE_CONTENT_FIRESTORE_PRIMARY_7355063_VERSION };
});

export const syncPastQuestionCatalogAdmin7355063 = onCall(
  { ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS, secrets:[ULIM_LEGACY_PROOF_HMAC_SECRET], timeoutSeconds:540, memory:"1GiB" },
  async request => {
    const caller = await requireAdmin(request);
    return { ...(await syncPastQuestionCatalogInternal(`admin:${caller.uid}`, true)), version:PRACTICE_CONTENT_FIRESTORE_PRIMARY_7355063_VERSION };
  }
);


function pastAuthVersion73550920(value: unknown): string | number | null { if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=1)return value; const v=text(value,120); return v||null; }
async function requirePastQuestionReader73550920(request: CallableRequest<unknown>): Promise<void> {
  if(!request.auth) throw new HttpsError('unauthenticated','로그인이 필요합니다.');
  const firebaseUid=text(request.auth.uid,128), role=text(request.auth.token.role,30), tokenVersion=pastAuthVersion73550920(request.auth.token.authVersion);
  if(!['student','teacher','admin','superAdmin'].includes(role)||tokenVersion===null) throw new HttpsError('permission-denied','기출문제 이용 권한이 없습니다.');
  const snap=await db().collection('users').doc(firebaseUid).get(); if(!snap.exists) throw new HttpsError('permission-denied','활성 사용자 정보가 없습니다.'); const user=snap.data()??{};
  if(user.active!==true || text(user.role,30)!==role || pastAuthVersion73550920(user.authVersion)!==tokenVersion) throw new HttpsError('permission-denied','로그인 권한이 변경되었습니다. 다시 로그인해주세요.');
  if(role==='student'){ const studentUid=text(request.auth.token.studentUid,128); if(!studentUid||text(user.studentUid,128)!==studentUid||text(user.teacherUid,128)) throw new HttpsError('permission-denied','학생 연결정보가 일치하지 않습니다.'); return; }
  if(role==='teacher'){ const teacherUid=text(request.auth.token.teacherUid,128); if(!teacherUid||text(user.teacherUid,128)!==teacherUid||text(user.studentUid,128)) throw new HttpsError('permission-denied','강사 연결정보가 일치하지 않습니다.'); return; }
  if(text(user.studentUid,128)||text(user.teacherUid,128)) throw new HttpsError('permission-denied','관리자 계정 연결정보가 올바르지 않습니다.');
}

export const getRandomPastQuestionFirestore7355063 = onCall(ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS, async request => {
  await requirePastQuestionReader73550920(request);
  const input = object(request.data);
  const raw = text(input.gender,30).toLowerCase();
  const gender = ["female","f","여","여자"].includes(raw) ? "female" : "male";
  const snap = await db().collection("pastQuestionCatalog").where("gender","==",gender).get();
  const items: PlainObject[] = snap.docs.map(doc => ({ catalogId:doc.id, ...doc.data() } as PlainObject)).filter(row => row.active !== false && !!text(row.content,90000));
  if (!items.length) throw new HttpsError("failed-precondition", "기출 대본이 아직 준비되지 않았습니다. 학원에 문의해주세요.");
  const picked = items[Math.floor(Math.random() * items.length)] as PlainObject;
  const scriptNo = integer(picked.scriptNo,0);
  return {
    ok:true,
    status:"success",
    gender,
    genderLabel:gender === "female" ? "여자" : "남자",
    scriptNo,
    number:scriptNo,
    fileId:text(picked.fileId,180),
    fileName:text(picked.fileName,500),
    title:text(picked.fileName,500),
    role:(gender === "female" ? "여자" : "남자") + " 기출 " + (scriptNo ? `${scriptNo}번` : "대본"),
    content:text(picked.content,90000),
    source:"firestore-past-question-catalog",
    version:PRACTICE_CONTENT_FIRESTORE_PRIMARY_7355063_VERSION
  };
});

export const maintainVocalSentenceSetDaily7355063 = onSchedule(
  { schedule:"20 5 * * *", timeZone:"Asia/Seoul", region:REGION, secrets:[ULIM_GEMINI_API_KEY_7355063], retryCount:0, timeoutSeconds:240, memory:"512MiB" },
  async () => { await ensureActiveVocalSentenceSet7355063({ force:false, actor:"scheduler" }); }
);

export const syncPastQuestionCatalogMonthly7355063 = onSchedule(
  { schedule:"40 5 * * *", timeZone:"Asia/Seoul", region:REGION, secrets:[ULIM_LEGACY_PROOF_HMAC_SECRET], retryCount:0, timeoutSeconds:540, memory:"1GiB" },
  async () => {
    const snap = await db().collection("practiceContent").doc("pastQuestion").get();
    const data = snap.data() ?? {};
    if (!text(data.driveFolderId,180)) return;
    if (text(data.lastSyncedMonth,7) === kstDateKey().slice(0,7) && integer(data.lastSyncCount,0) > 0) return;
    try { await syncPastQuestionCatalogInternal("scheduler", false); } catch { /* next daily run retries */ }
  }
);
