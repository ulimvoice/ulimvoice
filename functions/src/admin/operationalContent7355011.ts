import { randomUUID } from "node:crypto";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";

export const OPERATIONAL_CONTENT_7355011_VERSION = "2026-08-07.735.05.0.11";

const CALLABLE_OPTIONS = Object.freeze({
  ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  cors: true,
  invoker: "public" as const
});

const CONTENT_COLLECTION = "operationalContent";
const NOTICE_DOC = "appNotice";
const TABLET_ADS_DOC = "tabletAds";
const STUDENT_NOTICE_COLLECTION = "studentLoginNotices";

type PlainObject = Record<string, unknown>;

type AdminCaller = {
  firebaseUid: string;
  role: "admin" | "superAdmin";
  user: DocumentData;
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
function text(value: unknown, max = 2000): string {
  return String(value ?? "").trim().slice(0, max);
}
function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  const key = text(value, 30).toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(key)) return true;
  if (["0", "false", "no", "n", "off"].includes(key)) return false;
  return fallback;
}
function positiveNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
function safeUrl(value: unknown, max = 1500): string {
  const raw = text(value, max);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString().slice(0, max);
  } catch {
    return "";
  }
}
function roleOf(request: CallableRequest<unknown>): string {
  return text(request.auth?.token?.role, 40);
}
async function requireFullAdmin(request: CallableRequest<unknown>): Promise<AdminCaller> {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const role = roleOf(request);
  if (role !== "admin" && role !== "superAdmin") throw new HttpsError("permission-denied", "전체관리자 권한이 필요합니다.");
  const firebaseUid = text(request.auth.uid, 128);
  const snapshot = await db().collection("users").doc(firebaseUid).get();
  if (!snapshot.exists) throw new HttpsError("permission-denied", "활성 관리자 정보가 없습니다.");
  const user = snapshot.data() ?? {};
  if (user.active !== true || text(user.role, 40) !== role) throw new HttpsError("permission-denied", "관리자 권한이 변경되었습니다. 다시 로그인해주세요.");
  return { firebaseUid, role, user } as AdminCaller;
}
function requireStudentUid(request: CallableRequest<unknown>): string {
  if (!request.auth) throw new HttpsError("unauthenticated", "학생 로그인이 필요합니다.");
  const role = roleOf(request);
  if (role !== "student") throw new HttpsError("permission-denied", "학생 계정에서만 사용할 수 있습니다.");
  const studentUid = text(request.auth.token.studentUid, 160);
  if (!studentUid) throw new HttpsError("permission-denied", "학생 연결정보가 없습니다.");
  return studentUid;
}
function requireTablet(request: CallableRequest<unknown>): void {
  if (!request.auth || request.auth.token.tabletKiosk !== true || roleOf(request) !== "tablet") {
    throw new HttpsError("unauthenticated", "태블릿 인증이 필요합니다.");
  }
}
function sanitizeNotice(raw: DocumentData | undefined): PlainObject {
  const row = raw ?? {};
  return {
    enabled: row.enabled !== false,
    title: text(row.title, 160),
    content: text(row.content, 6000),
    target: text(row.target, 300) || "전체",
    imageUrl: safeUrl(row.imageUrl),
    youtubeUrl: safeUrl(row.youtubeUrl),
    videoUrl: safeUrl(row.videoUrl),
    linkUrl: safeUrl(row.linkUrl),
    linkText: text(row.linkText, 120),
    updatedAtMs: Number(row.updatedAtMs || 0)
  };
}
function sanitizeSlides(value: unknown): PlainObject[] {
  const rows = Array.isArray(value) ? value : [];
  return rows.slice(0, 20).map(raw => {
    const row = object(raw);
    return {
      type: text(row.type, 40) || "공지",
      title: text(row.title, 160) || "홍보 영상",
      content: text(row.content, 4000),
      imageUrl: safeUrl(row.imageUrl),
      videoUrl: safeUrl(row.videoUrl),
      seconds: positiveNumber(row.seconds, 10, 5, 120)
    };
  }).filter(row => text(row.title) || text(row.content) || text(row.imageUrl) || text(row.videoUrl));
}

export const getOperationalContentAdmin7355011 = onCall(CALLABLE_OPTIONS, async request => {
  await requireFullAdmin(request);
  const [noticeSnap, adsSnap] = await Promise.all([
    db().collection(CONTENT_COLLECTION).doc(NOTICE_DOC).get(),
    db().collection(CONTENT_COLLECTION).doc(TABLET_ADS_DOC).get()
  ]);
  return {
    ok: true,
    version: OPERATIONAL_CONTENT_7355011_VERSION,
    notice: sanitizeNotice(noticeSnap.data()),
    tabletAds: sanitizeSlides(adsSnap.data()?.slides)
  };
});

export const saveOperationalContentAdmin7355011 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireFullAdmin(request);
  const input = object(request.data);
  const kind = text(input.kind, 40);
  const now = Date.now();
  if (kind === "notice") {
    const notice = sanitizeNotice(object(input.notice));
    await db().collection(CONTENT_COLLECTION).doc(NOTICE_DOC).set({
      ...notice,
      enabled: bool(object(input.notice).enabled, true),
      updatedAtMs: now,
      updatedByUid: caller.firebaseUid,
      updatedAt: FieldValue.serverTimestamp(),
      version: OPERATIONAL_CONTENT_7355011_VERSION
    }, { merge: false });
    return { ok: true, kind, notice: { ...notice, updatedAtMs: now } };
  }
  if (kind === "tabletAds") {
    const slides = sanitizeSlides(input.slides);
    await db().collection(CONTENT_COLLECTION).doc(TABLET_ADS_DOC).set({
      slides,
      updatedAtMs: now,
      updatedByUid: caller.firebaseUid,
      updatedAt: FieldValue.serverTimestamp(),
      version: OPERATIONAL_CONTENT_7355011_VERSION
    }, { merge: false });
    return { ok: true, kind, slides, count: slides.length };
  }
  throw new HttpsError("invalid-argument", "저장 종류가 올바르지 않습니다.");
});

export const createStudentCourseNoticeAdmin7355011 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireFullAdmin(request);
  const input = object(request.data);
  const studentUid = text(input.studentUid, 160);
  if (!studentUid) throw new HttpsError("invalid-argument", "학생을 선택해주세요.");
  const studentSnap = await db().collection("students").doc(studentUid).get();
  if (!studentSnap.exists) throw new HttpsError("not-found", "학생정보를 찾을 수 없습니다.");
  const student = studentSnap.data() ?? {};
  const classNames = (Array.isArray(input.classNames) ? input.classNames : []).map(value => text(value, 300)).filter(Boolean).slice(0, 30);
  const title = text(input.title, 160) || "수강 등록 안내";
  const content = text(input.content, 6000) || (classNames.length ? `수강 등록이 완료되었습니다.\n${classNames.join("\n")}` : "수강 등록이 완료되었습니다.");
  const noticeId = `COURSE_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const now = Date.now();
  await db().collection(STUDENT_NOTICE_COLLECTION).doc(noticeId).set({
    noticeId,
    studentUid,
    studentName: text(student.name ?? student.studentName, 120),
    type: "course_registration",
    title,
    content,
    classNames,
    active: true,
    createdAtMs: now,
    createdByUid: caller.firebaseUid,
    createdAt: FieldValue.serverTimestamp(),
    version: OPERATIONAL_CONTENT_7355011_VERSION
  });
  return { ok: true, noticeId, studentUid, studentName: text(student.name ?? student.studentName, 120), title, content, classNames };
});

export const getStudentLoginContent7355011 = onCall(CALLABLE_OPTIONS, async request => {
  const studentUid = requireStudentUid(request);
  const [studentSnap, noticeSnap, courseSnap] = await Promise.all([
    db().collection("students").doc(studentUid).get(),
    db().collection(CONTENT_COLLECTION).doc(NOTICE_DOC).get(),
    db().collection(STUDENT_NOTICE_COLLECTION).where("studentUid", "==", studentUid).limit(100).get()
  ]);
  if (!studentSnap.exists) throw new HttpsError("permission-denied", "학생정보가 없습니다.");
  const student = studentSnap.data() ?? {};
  const noticeRows: PlainObject[] = courseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlainObject));
  const notices = noticeRows
    .filter(row => row.active !== false)
    .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
    .slice(0, 20)
    .map(row => ({
      id: text(row.id ?? row.noticeId, 180),
      type: text(row.type, 60),
      title: text(row.title, 160),
      content: text(row.content, 6000),
      classNames: Array.isArray(row.classNames) ? row.classNames.map((value: unknown) => text(value, 300)).filter(Boolean) : [],
      createdAtMs: Number(row.createdAtMs || 0)
    }));
  return {
    ok: true,
    version: OPERATIONAL_CONTENT_7355011_VERSION,
    student: {
      studentUid,
      name: text(student.name ?? student.studentName, 120),
      instructorNames: Array.isArray(student.instructorNames) ? student.instructorNames.map(value => text(value, 120)).filter(Boolean) : []
    },
    appNotice: sanitizeNotice(noticeSnap.data()),
    studentNotices: notices
  };
});

export const ackStudentLoginNotices7355011 = onCall(CALLABLE_OPTIONS, async request => {
  const studentUid = requireStudentUid(request);
  const input = object(request.data);
  const noticeIds = (Array.isArray(input.noticeIds) ? input.noticeIds : [])
    .map(value => text(value, 180))
    .filter(Boolean)
    .slice(0, 20);
  if (!noticeIds.length) return { ok: true, count: 0 };

  const refs = noticeIds.map(id => db().collection(STUDENT_NOTICE_COLLECTION).doc(id));
  const snapshots = await db().getAll(...refs);
  const batch = db().batch();
  const now = Date.now();
  let count = 0;
  snapshots.forEach(snapshot => {
    if (!snapshot.exists) return;
    const row = snapshot.data() ?? {};
    if (text(row.studentUid, 160) !== studentUid) return;
    batch.set(snapshot.ref, {
      active: false,
      seenAtMs: now,
      seenAt: FieldValue.serverTimestamp(),
      version: OPERATIONAL_CONTENT_7355011_VERSION
    }, { merge: true });
    count += 1;
  });
  if (count) await batch.commit();
  return { ok: true, count };
});

export const getTabletOperationalContent7355011 = onCall(CALLABLE_OPTIONS, async request => {
  requireTablet(request);
  const snapshot = await db().collection(CONTENT_COLLECTION).doc(TABLET_ADS_DOC).get();
  return {
    ok: true,
    version: OPERATIONAL_CONTENT_7355011_VERSION,
    slides: sanitizeSlides(snapshot.data()?.slides),
    updatedAtMs: Number(snapshot.data()?.updatedAtMs || 0)
  };
});
