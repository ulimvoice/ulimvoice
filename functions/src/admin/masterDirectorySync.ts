import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type DocumentReference
} from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_LEGACY_PROOF_HMAC_SECRET } from "../common/firebaseSecrets.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";
import { deriveStaffPasswordLoginEmail } from "../auth/staffFirebasePrimaryAuth.js";

export const MASTER_DIRECTORY_SYNC_VERSION = "2026-08-06.735.05.0.2";

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyS3QUvrjNbwvaw92_g-QKQyN3Yito8DAdpAjxUzfnsuVf3Ce7ccuaXIv651U7FnYF4/exec";
const AUTH_VERSION = "uidv2";
const RUN_COLLECTION = "masterDirectorySyncRuns";
const MAX_STAFF = 500;
const MAX_STUDENTS = 3000;
const STAFF_ROLES = new Set(["teacher", "admin", "superAdmin"] as const);

const MASTER_ADMIN_CALLABLE_OPTIONS_7343 = Object.freeze({
  ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  cors: true,
  invoker: "public" as const
});

type StaffRole = "teacher" | "admin" | "superAdmin";
type PlainObject = Record<string, unknown>;

type StaffSheetRow = {
  rowIndex: number;
  loginId: string;
  name: string;
  phone: string;
  role: StaffRole;
  active: boolean;
  principalUidV2: string;
  firebaseAuthUid: string;
};

type StudentSheetRow = {
  rowNumber: number;
  studentNo: string;
  studentUid: string;
  loginId: string;
  name: string;
  phone: string;
  parentPhone: string;
  status: "active" | "leave" | "withdrawn";
  classNames: string[];
  instructorNames: string[];
  memo: string;
  studentIdentityKey: string;
};

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
  return text(value, 300).normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function normalizeLoginId(value: unknown): string {
  return text(value, 100).normalize("NFKC").toLowerCase();
}

function normalizePhone(value: unknown): string {
  return text(value, 60).replace(/[^0-9]/g, "");
}

function unique(values: unknown): string[] {
  const input = Array.isArray(values)
    ? values
    : text(values, 3000).split(/[\n,;/|]+/g);
  return Array.from(new Set(input.map(value => text(value, 200)).filter(Boolean)));
}

function role(value: unknown): StaffRole {
  const key = normalize(value);
  if (key === "superadmin" || key === normalize("전체관리자") || key === normalize("전체관리") || key === normalize("원장")) {
    return "superAdmin";
  }
  if (key === "admin" || key === normalize("관리자")) return "admin";
  return "teacher";
}

function studentStatus(value: unknown): "active" | "leave" | "withdrawn" {
  const key = normalize(value);
  if (key === "leave" || key === normalize("휴원")) return "leave";
  if (key === "withdrawn" || key === normalize("퇴원")) return "withdrawn";
  return "active";
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  const key = normalize(value);
  if (["true", "1", "y", "yes", normalize("사용"), normalize("활성")].includes(key)) return true;
  if (["false", "0", "n", "no", normalize("중지"), normalize("퇴사")].includes(key)) return false;
  return fallback;
}

function safeAuthVersion(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 1) return value;
  const out = text(value, 120);
  return out || null;
}

async function requireSuperAdmin(request: CallableRequest<unknown>): Promise<{ uid: string; user: DocumentData; authUser: UserRecord }> {
  if (!request.auth) throw new HttpsError("unauthenticated", "Firebase 로그인이 필요합니다.");
  const uid = text(request.auth.uid, 128);
  const tokenRole = text(request.auth.token.role, 30);
  const tokenAuthVersion = safeAuthVersion(request.auth.token.authVersion);
  if (tokenRole !== "superAdmin" || tokenAuthVersion === null) {
    throw new HttpsError("permission-denied", "전체관리자 권한이 필요합니다.");
  }

  const [userSnap, authUser] = await Promise.all([
    db().collection("users").doc(uid).get(),
    auth().getUser(uid)
  ]);
  if (!userSnap.exists) throw new HttpsError("permission-denied", "활성 전체관리자 정보가 없습니다.");
  const user = userSnap.data() ?? {};
  if (
    user.active !== true ||
    user.role !== "superAdmin" ||
    safeAuthVersion(user.authVersion) !== tokenAuthVersion ||
    authUser.disabled
  ) {
    throw new HttpsError("permission-denied", "전체관리자 권한이 변경되었습니다. 다시 로그인해주세요.");
  }
  return { uid, user, authUser };
}

function base64Url(input: Uint8Array): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signGas(action: string, requestId: string, issuedAtMs: number, payloadJson: string): string {
  const secret = ULIM_LEGACY_PROOF_HMAC_SECRET.value() || process.env.ULIM_LEGACY_PROOF_HMAC_SECRET || "";
  if (!secret) throw new Error("ULIM_LEGACY_PROOF_HMAC_SECRET is not configured");
  return base64Url(createHmac("sha256", secret).update(`v1|${action}|${requestId}|${issuedAtMs}|${payloadJson}`, "utf8").digest());
}

async function callGas(action: string, requestId: string, payload: PlainObject, timeoutMs = 60_000): Promise<PlainObject> {
  const payloadJson = JSON.stringify(payload);
  const issuedAtMs = Date.now();
  const signature = signGas(action, requestId, issuedAtMs, payloadJson);
  const response = await fetch(GAS_WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, requestId, issuedAtMs, payloadJson, signature }),
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`GAS_HTTP_${response.status}`);
  const raw = await response.text();
  let parsed: PlainObject;
  try { parsed = JSON.parse(raw) as PlainObject; }
  catch { throw new Error(`GAS_INVALID_JSON:${raw.slice(0, 200)}`); }
  if (text(parsed.status, 30) !== "success") {
    throw new Error(text(parsed.message, 1200) || "Google Sheets 연동에 실패했습니다.");
  }
  return parsed;
}

function requestId(input: PlainObject, prefix: string): string {
  const raw = text(input.requestId, 180) || `${prefix}-${Date.now()}-${randomUUID()}`;
  return raw.replace(/[^0-9A-Za-z._-]/g, "_").slice(0, 180);
}

async function beginRun(kind: string, id: string, actorUid: string): Promise<{ ref: DocumentReference; reused: boolean; result?: PlainObject }> {
  const ref = db().collection(RUN_COLLECTION).doc(id);
  return db().runTransaction(async (transaction: any) => {
    const snap = await transaction.get(ref);
    if (snap.exists) {
      const data = snap.data() ?? {};
      if (data.kind !== kind) throw new HttpsError("already-exists", "동일 요청번호가 다른 작업에 사용되었습니다.");
      if (data.state === "complete") return { ref, reused: true, result: object(data.result) };
      if (data.state === "processing" && Date.now() - Number(data.startedAtMs || 0) < 180_000) {
        throw new HttpsError("aborted", "같은 동기화 작업이 이미 진행 중입니다.");
      }
    }
    transaction.set(ref, {
      kind,
      state: "processing",
      actorUid,
      startedAtMs: Date.now(),
      startedAt: FieldValue.serverTimestamp(),
      version: MASTER_DIRECTORY_SYNC_VERSION
    }, { merge: true });
    return { ref, reused: false };
  });
}

async function completeRun(ref: DocumentReference, result: PlainObject): Promise<void> {
  await ref.set({
    state: "complete",
    result,
    completedAtMs: Date.now(),
    completedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

async function failRun(ref: DocumentReference, error: unknown): Promise<void> {
  await ref.set({
    state: "failed",
    error: text(error instanceof Error ? error.message : error, 1500),
    failedAtMs: Date.now(),
    failedAt: FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => undefined);
}

function stableUid(prefix: string, seed: string): string {
  return `${prefix}_${createHash("sha256").update(seed, "utf8").digest("base64url").slice(0, 38)}`;
}

async function getAuthUserQuiet(uid: string, email: string): Promise<UserRecord | null> {
  if (uid) {
    try { return await auth().getUser(uid); }
    catch (error) {
      if (text((error as { code?: unknown }).code, 100) !== "auth/user-not-found") throw error;
    }
  }
  if (email) {
    try { return await auth().getUserByEmail(email); }
    catch (error) {
      if (text((error as { code?: unknown }).code, 100) !== "auth/user-not-found") throw error;
    }
  }
  return null;
}

function claimsFor(authUser: UserRecord, uid: string, nextRole: StaffRole, authVersion: string | number, teacherUid: string): PlainObject {
  const claims: PlainObject = { ...(authUser.customClaims ?? {}) };
  delete claims.studentUid;
  delete claims.teacherUid;
  delete claims.superAdmin;
  claims.role = nextRole;
  claims.authVersion = authVersion;
  claims.principalUidV2 = uid;
  claims.accountUid = uid;
  if (nextRole === "teacher") claims.teacherUid = teacherUid;
  if (nextRole === "superAdmin") claims.superAdmin = true;
  return claims;
}

async function loadStaffDocs(): Promise<Array<{ id: string; data: DocumentData }>> {
  const snapshots = await Promise.all(
    (["teacher", "admin", "superAdmin"] as StaffRole[]).map(nextRole =>
      db().collection("users").where("role", "==", nextRole).limit(MAX_STAFF).get()
    )
  );
  const found = new Map<string, DocumentData>();
  snapshots.forEach((snapshot: any) => snapshot.docs.forEach((doc: any) => found.set(doc.id, doc.data() ?? {})));
  return Array.from(found, ([id, data]) => ({ id, data }));
}

async function loadTeacherMaps(): Promise<{
  byFirebaseUid: Map<string, string>;
  byLogin: Map<string, string>;
  byName: Map<string, string>;
}> {
  const snapshot = await db().collection("teachers").limit(MAX_STAFF).get();
  const byFirebaseUid = new Map<string, string>();
  const byLogin = new Map<string, string>();
  const byName = new Map<string, string>();
  snapshot.docs.forEach((doc: any) => {
    const data = doc.data() ?? {};
    const firebaseUid = text(data.firebaseUid, 128);
    const login = normalizeLoginId(data.loginId);
    const name = normalize(data.name ?? data.displayName);
    if (firebaseUid && !byFirebaseUid.has(firebaseUid)) byFirebaseUid.set(firebaseUid, doc.id);
    if (login && !byLogin.has(login)) byLogin.set(login, doc.id);
    if (name && !byName.has(name)) byName.set(name, doc.id);
  });
  return { byFirebaseUid, byLogin, byName };
}

function parseStaffRows(value: unknown): StaffSheetRow[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_STAFF).map(raw => {
    const row = object(raw);
    return {
      rowIndex: Number(row.rowIndex || 0),
      loginId: text(row.loginId ?? row.id, 100),
      name: text(row.name, 100),
      phone: text(row.phone, 60),
      role: role(row.role),
      active: bool(row.active, true),
      principalUidV2: text(row.principalUidV2, 128),
      firebaseAuthUid: text(row.firebaseAuthUid, 128)
    };
  }).filter(row => row.loginId && row.name);
}

function parseStudentRows(value: unknown): StudentSheetRow[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_STUDENTS).map(raw => {
    const row = object(raw);
    const studentNo = text(row.studentNo ?? row.loginId, 100);
    return {
      rowNumber: Number(row.rowNumber || 0),
      studentNo,
      studentUid: text(row.studentUid, 128),
      loginId: studentNo,
      name: text(row.name ?? row.studentName, 100),
      phone: text(row.phone ?? row.studentPhone, 60),
      parentPhone: text(row.parentPhone, 60),
      status: studentStatus(row.status ?? row.enrollmentStatus),
      classNames: unique(row.classNames ?? row.className ?? row.currentClass),
      instructorNames: unique(row.instructorNames ?? row.instructor ?? row.instructorName),
      memo: text(row.memo, 1000),
      studentIdentityKey: text(row.studentIdentityKey, 200)
    };
  }).filter(row => row.name && row.loginId);
}

export const syncStaffDirectoryFromSheetsAdmin7342 = onCall(
  { ...MASTER_ADMIN_CALLABLE_OPTIONS_7343, secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET], timeoutSeconds: 180, memory: "512MiB" },
  async request => {
    const caller = await requireSuperAdmin(request);
    const input = object(request.data);
    const id = requestId(input, "staff-directory-7342");
    const run = await beginRun("staff-directory-7342", id, caller.uid);
    if (run.reused) return run.result;

    try {
      const gas = await callGas("firebaseStaffDirectoryPull7342", id, {
        version: MASTER_DIRECTORY_SYNC_VERSION,
        actorFirebaseUid: caller.uid,
        explicitAdminSheetOperation: "Y"
      }, 60_000);
      const rows = parseStaffRows(gas.rows);
      const [staffDocs, teacherMaps] = await Promise.all([loadStaffDocs(), loadTeacherMaps()]);
      const byUid = new Map(staffDocs.map(item => [item.id, item.data]));
      const byLogin = new Map<string, { id: string; data: DocumentData }>();
      staffDocs.forEach((item: { id: string; data: DocumentData }) => {
        const key = normalizeLoginId(item.data.loginId ?? item.data.adminId ?? item.data.legacyAdminId);
        if (key && !byLogin.has(key)) byLogin.set(key, item);
      });

      const bindings: PlainObject[] = [];
      let created = 0;
      let repaired = 0;
      let preserved = 0;
      let resetRequired = 0;
      let roleReviewRequired = 0;
      let failed = 0;
      const failures: PlainObject[] = [];

      for (const row of rows) {
        try {
          const loginKey = normalizeLoginId(row.loginId);
          const existingByLogin = byLogin.get(loginKey);
          const candidateUid = existingByLogin?.id || row.firebaseAuthUid || row.principalUidV2;
          const email = deriveStaffPasswordLoginEmail(row.loginId);
          let authUser = await getAuthUserQuiet(candidateUid, email);
          let wasCreated = false;

          if (!authUser) {
            const preferredUid = candidateUid || stableUid("PRN2", `staff|${loginKey}`);
            authUser = await auth().createUser({
              uid: preferredUid,
              email,
              emailVerified: true,
              password: `${randomBytes(36).toString("base64url")}Aa1!`,
              displayName: row.name,
              disabled: !row.active
            });
            wasCreated = true;
          }

          if (!authUser) throw new Error("Firebase Auth 계정을 준비하지 못했습니다.");
          const currentAuthUser: UserRecord = authUser;
          const uid = currentAuthUser.uid;
          if (existingByLogin && existingByLogin.id !== uid) {
            throw new Error(`동일 로그인 ID가 서로 다른 Firebase UID에 연결되어 있습니다: ${existingByLogin.id} / ${uid}`);
          }
          const existing = byUid.get(uid) ?? existingByLogin?.data ?? {};
          const existingRole = STAFF_ROLES.has(existing.role as StaffRole) ? existing.role as StaffRole : null;
          /* Sheets is not an authority for privileged roles. Existing Firebase roles are preserved;
             a sheet-only account always starts as teacher and must be promoted in the app. */
          const nextRole: StaffRole = existingRole ?? "teacher";
          const needsRoleReview = existingRole === null && row.role !== "teacher";
          const nextActive = typeof existing.active === "boolean" ? existing.active === true : row.active;
          const nextLoginId = text(existing.loginId ?? existing.adminId ?? existing.legacyAdminId, 100) || row.loginId;
          const nextName = text(existing.name ?? existing.displayName, 100) || row.name;
          const nextPhone = text(existing.phone, 60) || row.phone;
          const nextAuthVersion = safeAuthVersion(existing.authVersion) ?? AUTH_VERSION;
          const nextTeacherUid = nextRole === "teacher"
            ? text(existing.teacherUid, 128) ||
              teacherMaps.byFirebaseUid.get(uid) ||
              teacherMaps.byLogin.get(normalizeLoginId(nextLoginId)) ||
              teacherMaps.byName.get(normalize(nextName)) ||
              uid
            : "";
          const passwordLoginEnabled = existing.passwordLoginEnabled === true && !wasCreated;
          const mustChangePassword = passwordLoginEnabled ? existing.mustChangePassword === true : true;

          if (currentAuthUser.email !== email || currentAuthUser.displayName !== nextName || currentAuthUser.disabled === nextActive) {
            authUser = await auth().updateUser(uid, {
              email,
              emailVerified: true,
              displayName: nextName,
              disabled: !nextActive
            });
          }
          await auth().setCustomUserClaims(uid, claimsFor((authUser || currentAuthUser) as UserRecord, uid, nextRole, nextAuthVersion, nextTeacherUid));
          if (!nextActive) await auth().revokeRefreshTokens(uid);

          const userPatch: PlainObject = {
            firebaseUid: uid,
            uid,
            principalUidV2: uid,
            legacyPrincipalUidV2: row.principalUidV2 && row.principalUidV2 !== uid ? row.principalUidV2 : FieldValue.delete(),
            loginId: nextLoginId,
            loginIdNormalized: normalizeLoginId(nextLoginId),
            adminId: nextLoginId,
            legacyAdminId: nextLoginId,
            name: nextName,
            displayName: nextName,
            phone: nextPhone,
            role: nextRole,
            active: nextActive,
            authVersion: nextAuthVersion,
            teacherUid: nextRole === "teacher" ? nextTeacherUid : FieldValue.delete(),
            passwordCredentialEmail: email,
            passwordLoginEnabled,
            mustChangePassword,
            credentialState: passwordLoginEnabled ? "ready" : "admin_reset_required",
            sheetDirectoryRow: row.rowIndex,
            sheetDirectorySeenAtMs: Date.now(),
            sheetDirectorySeenAt: FieldValue.serverTimestamp(),
            directorySyncSource: "sanitized_sheet_binding_7342",
            sheetSuggestedRole: row.role,
            roleReviewRequired: needsRoleReview,
            updatedAtMs: Date.now(),
            updatedAt: FieldValue.serverTimestamp()
          };

          const batch = db().batch();
          batch.set(db().collection("users").doc(uid), userPatch, { merge: true });
          batch.set(db().collection("legacyAccounts").doc(uid), {
            firebaseUid: uid,
            principalUidV2: uid,
            role: nextRole,
            active: nextActive,
            authVersion: nextAuthVersion,
            teacherUid: nextRole === "teacher" ? nextTeacherUid : FieldValue.delete(),
            updatedAtMs: Date.now(),
            updatedAt: FieldValue.serverTimestamp(),
            source: "master_directory_sync_7342"
          }, { merge: true });
          if (nextRole === "teacher") {
            batch.set(db().collection("teachers").doc(nextTeacherUid), {
              teacherUid: nextTeacherUid,
              firebaseUid: uid,
              principalUidV2: uid,
              loginId: nextLoginId,
              name: nextName,
              displayName: nextName,
              phone: nextPhone,
              role: "teacher",
              active: nextActive,
              accountActive: nextActive,
              authVersion: nextAuthVersion,
              updatedAtMs: Date.now(),
              updatedAt: FieldValue.serverTimestamp(),
              accountManagementSource: "master_directory_sync_7342"
            }, { merge: true });
          }
          await batch.commit();

          bindings.push({
            rowIndex: row.rowIndex,
            loginId: row.loginId,
            principalUidV2: uid,
            firebaseAuthUid: uid
          });

          if (wasCreated) created++;
          else if (!existingByLogin || row.firebaseAuthUid !== uid || row.principalUidV2 !== uid) repaired++;
          else preserved++;
          if (!passwordLoginEnabled) resetRequired++;
          if (needsRoleReview) roleReviewRequired++;

          byUid.set(uid, { ...existing, ...userPatch });
          byLogin.set(loginKey, { id: uid, data: { ...existing, ...userPatch } });
        } catch (error) {
          failed++;
          failures.push({
            loginId: row.loginId,
            name: row.name,
            message: text(error instanceof Error ? error.message : error, 500)
          });
        }
      }

      let bindingFailed = 0;
      if (bindings.length) {
        try {
          const bindingResult = await callGas("firebaseStaffDirectoryBindingBatch7342", `${id}-bindings`, {
            version: MASTER_DIRECTORY_SYNC_VERSION,
            actorFirebaseUid: caller.uid,
            explicitAdminSheetOperation: "Y",
            bindings
          }, 45_000);
          bindingFailed = Number(bindingResult.failed || 0);
          if (bindingFailed) failures.push({ message: `UID 시트 반영 실패 ${bindingFailed}건` });
        } catch (error) {
          bindingFailed = bindings.length;
          failures.push({ message: `UID 시트 반영 실패: ${text(error instanceof Error ? error.message : error, 500)}` });
        }
      }

      const result: PlainObject = {
        ok: failed === 0 && bindingFailed === 0,
        version: MASTER_DIRECTORY_SYNC_VERSION,
        total: rows.length,
        created,
        repaired,
        preserved,
        resetRequired,
        roleReviewRequired,
        failed,
        bindingFailed,
        failures: failures.slice(0, 20)
      };
      await completeRun(run.ref, result);
      return result;
    } catch (error) {
      await failRun(run.ref, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", text(error instanceof Error ? error.message : error, 1200));
    }
  }
);

function publicStudent(id: string, data: DocumentData): PlainObject {
  return {
    studentUid: id,
    loginId: text(data.loginId ?? data.studentNo, 100),
    name: text(data.name ?? data.studentName, 100),
    phone: text(data.phone ?? data.studentPhone, 60),
    parentPhone: text(data.parentPhone, 60),
    status: studentStatus(data.status ?? data.enrollmentStatus),
    classNames: unique(data.classNames ?? data.className),
    instructorNames: unique(data.instructorNames ?? data.instructorName),
    classUids: unique(data.classUids),
    instructorUids: unique(data.instructorUids),
    memo: text(data.memo, 1000),
    sheetRow: Number(data.sheetRow || data.sourceSheetRow || 0),
    sheetSyncState: text(data.sheetSyncState, 40),
    sheetSyncMessage: text(data.sheetSyncMessage, 500),
    unresolved: data.unresolved === true
  };
}

export const listStudentsAdmin7342 = onCall(
  MASTER_ADMIN_CALLABLE_OPTIONS_7343,
  async request => {
    await requireSuperAdmin(request);
    const input = object(request.data);
    const limit = Math.min(Math.max(Number(input.limit || 1000), 1), MAX_STUDENTS);
    const snapshot = await db().collection("students").limit(limit).get();
    const students = snapshot.docs.map((doc: any) => publicStudent(doc.id, doc.data() ?? {})).sort((left: PlainObject, right: PlainObject) => {
      const statusOrder: Record<string, number> = { active: 0, leave: 1, withdrawn: 2 };
      const statusDiff = (statusOrder[text(left.status)] ?? 9) - (statusOrder[text(right.status)] ?? 9);
      if (statusDiff) return statusDiff;
      return text(left.name).localeCompare(text(right.name), "ko");
    });
    return { ok: true, version: MASTER_DIRECTORY_SYNC_VERSION, students, count: students.length };
  }
);

export const syncStudentsFromSheetsAdmin7342 = onCall(
  { ...MASTER_ADMIN_CALLABLE_OPTIONS_7343, secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET], timeoutSeconds: 300, memory: "512MiB" },
  async request => {
    const caller = await requireSuperAdmin(request);
    const input = object(request.data);
    const id = requestId(input, "student-directory-7342");
    const run = await beginRun("student-directory-7342", id, caller.uid);
    if (run.reused) return run.result;

    try {
      const gas = await callGas("firebaseStudentDirectoryPull7342", id, {
        version: MASTER_DIRECTORY_SYNC_VERSION,
        actorFirebaseUid: caller.uid,
        explicitAdminSheetOperation: "Y"
      });
      const rows = parseStudentRows(gas.rows);
      const [existingSnapshot, staffDocs] = await Promise.all([
        db().collection("students").limit(MAX_STUDENTS).get(),
        loadStaffDocs()
      ]);
      const existingByUid = new Map<string, DocumentData>(existingSnapshot.docs.map((doc: any) => [doc.id, doc.data() ?? {}]));
      const instructorByName = new Map<string, string>();
      staffDocs.forEach((item: { id: string; data: DocumentData }) => {
        const data = item.data;
        const teacherUid = text(data.teacherUid, 128);
        if (data.role !== "teacher" || !teacherUid) return;
        [data.name, data.displayName, data.loginId].forEach(value => {
          const key = normalize(value);
          if (key && !instructorByName.has(key)) instructorByName.set(key, teacherUid);
        });
      });

      let created = 0;
      let updated = 0;
      let preserved = 0;
      let unresolved = 0;
      let failed = 0;
      const failures: PlainObject[] = [];
      const writes: Array<{ ref: DocumentReference; data: PlainObject }> = [];

      for (const row of rows) {
        try {
          if (!row.studentUid) {
            unresolved++;
            failures.push({ rowNumber: row.rowNumber, name: row.name, message: "학생인증 UID가 없어 자동 이관하지 않았습니다." });
            continue;
          }
          const old: DocumentData = existingByUid.get(row.studentUid) ?? {};
          const localOverrides = object(old.localOverrides);
          const sheetSnapshot: PlainObject = {
            loginId: row.loginId,
            name: row.name,
            phone: row.phone,
            parentPhone: row.parentPhone,
            status: row.status,
            classNames: row.classNames,
            instructorNames: row.instructorNames,
            memo: row.memo,
            studentIdentityKey: row.studentIdentityKey
          };
          const effective = {
            loginId: text(localOverrides.loginId ?? row.loginId, 100),
            name: text(localOverrides.name ?? row.name, 100),
            phone: text(localOverrides.phone ?? row.phone, 60),
            parentPhone: text(localOverrides.parentPhone ?? row.parentPhone, 60),
            status: studentStatus(localOverrides.status ?? row.status),
            memo: text(localOverrides.memo ?? row.memo, 1000)
          };
          const instructorUids = unique(old.instructorUids).length
            ? unique(old.instructorUids)
            : row.instructorNames.map(name => instructorByName.get(normalize(name)) || "").filter(Boolean);

          const payload: PlainObject = {
            studentUid: row.studentUid,
            principalUidV2: row.studentUid,
            firebaseUid: row.studentUid,
            loginId: effective.loginId,
            loginIdNormalized: normalizeLoginId(effective.loginId),
            name: effective.name,
            nameNormalized: normalize(effective.name),
            phone: effective.phone,
            phoneDigits: normalizePhone(effective.phone),
            parentPhone: effective.parentPhone,
            parentPhoneDigits: normalizePhone(effective.parentPhone),
            status: effective.status,
            memo: effective.memo,
            classNames: row.classNames,
            instructorNames: row.instructorNames,
            classUids: unique(old.classUids),
            instructorUids,
            sheetSnapshot,
            localOverrides,
            sheetRow: row.rowNumber,
            sourceSheetRow: row.rowNumber,
            sourceSheet: "학생명단",
            sheetSyncState: Object.keys(localOverrides).length ? "firestore-only" : "complete",
            sheetSyncMessage: Object.keys(localOverrides).length
              ? "시트 원본 위에 Firestore 전용 수정값을 유지했습니다."
              : "학생명단에서 안전하게 이관했습니다.",
            unresolved: false,
            sheetImportedAtMs: Date.now(),
            sheetImportedAt: FieldValue.serverTimestamp(),
            updatedBy: caller.uid,
            updatedAtMs: Date.now(),
            updatedAt: FieldValue.serverTimestamp(),
            masterDirectorySource: "sanitized_sheet_student_sync_7342"
          };
          writes.push({ ref: db().collection("students").doc(row.studentUid), data: payload });
          if (!Object.keys(old).length) created++;
          else if (
            text(old.name) !== effective.name ||
            text(old.phone) !== effective.phone ||
            text(old.parentPhone) !== effective.parentPhone ||
            studentStatus(old.status) !== effective.status ||
            JSON.stringify(unique(old.classNames)) !== JSON.stringify(row.classNames) ||
            JSON.stringify(unique(old.instructorNames)) !== JSON.stringify(row.instructorNames)
          ) updated++;
          else preserved++;
        } catch (error) {
          failed++;
          failures.push({ rowNumber: row.rowNumber, name: row.name, message: text(error instanceof Error ? error.message : error, 500) });
        }
      }

      for (let offset = 0; offset < writes.length; offset += 400) {
        const batch = db().batch();
        writes.slice(offset, offset + 400).forEach(item => batch.set(item.ref, item.data, { merge: true }));
        await batch.commit();
      }

      const result: PlainObject = {
        ok: failed === 0,
        version: MASTER_DIRECTORY_SYNC_VERSION,
        total: rows.length,
        created,
        updated,
        preserved,
        unresolved,
        failed,
        failures: failures.slice(0, 30)
      };
      await completeRun(run.ref, result);
      return result;
    } catch (error) {
      await failRun(run.ref, error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", text(error instanceof Error ? error.message : error, 1200));
    }
  }
);

export const updateStudentMetadataAdmin7342 = onCall(
  { ...MASTER_ADMIN_CALLABLE_OPTIONS_7343, secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET], timeoutSeconds: 180 },
  async request => {
    const caller = await requireSuperAdmin(request);
    const input = object(request.data);
    const studentUid = text(input.studentUid, 128);
    if (!studentUid) throw new HttpsError("invalid-argument", "학생 UID가 필요합니다.");

    const ref = db().collection("students").doc(studentUid);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new HttpsError("not-found", "학생정보를 찾지 못했습니다.");
    const before = snapshot.data() ?? {};
    const fields: PlainObject = {
      name: text(input.name, 100),
      phone: text(input.phone, 60),
      parentPhone: text(input.parentPhone, 60),
      status: studentStatus(input.status),
      memo: text(input.memo, 1000)
    };
    if (!fields.name) throw new HttpsError("invalid-argument", "학생명이 필요합니다.");

    const localOverrides: PlainObject = { ...object(before.localOverrides), ...fields };
    let sheetSyncState = "firestore-only";
    let sheetSyncMessage = "Firestore 저장 완료 · 시트는 오전 6시 백업";
    let sheetSnapshot = object(before.sheetSnapshot);

    if (input.explicitAdminSheetWrite === true) {
      try {
        await callGas("firebaseStudentMetadataSync7342", requestId(input, "student-metadata-7342"), {
          version: MASTER_DIRECTORY_SYNC_VERSION,
          actorFirebaseUid: caller.uid,
          explicitAdminSheetOperation: "Y",
          studentUid,
          sheetRow: Number(before.sheetRow || before.sourceSheetRow || 0),
          loginId: text(before.loginId ?? before.studentNo, 100),
          previousName: text(object(before.sheetSnapshot).name ?? before.name ?? before.studentName, 100),
          ...fields
        });
        sheetSnapshot = { ...sheetSnapshot, ...fields };
        ["name", "phone", "parentPhone", "status", "memo"].forEach(key => delete localOverrides[key]);
        sheetSyncState = "complete";
        sheetSyncMessage = "Firestore와 Google Sheets에 저장했습니다.";
      } catch (error) {
        sheetSyncState = "failed";
        sheetSyncMessage = text(error instanceof Error ? error.message : error, 1000);
      }
    }

    await ref.set({
      ...fields,
      nameNormalized: normalize(fields.name),
      phoneDigits: normalizePhone(fields.phone),
      parentPhoneDigits: normalizePhone(fields.parentPhone),
      localOverrides,
      sheetSnapshot,
      sheetSyncState,
      sheetSyncMessage,
      updatedBy: caller.uid,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
      metadataUpdateSource: "student_metadata_admin_7342"
    }, { merge: true });

    return {
      ok: sheetSyncState !== "failed",
      version: MASTER_DIRECTORY_SYNC_VERSION,
      studentUid,
      sheetSyncState,
      sheetSyncMessage
    };
  }
);


function editableStudentFields7343(input: PlainObject): PlainObject {
  const loginIdValue = text(input.loginId ?? input.studentNo, 100);
  const nameValue = text(input.name ?? input.studentName, 100);
  if (!loginIdValue) throw new HttpsError("invalid-argument", "학생 출결번호가 필요합니다.");
  if (!nameValue) throw new HttpsError("invalid-argument", "학생명이 필요합니다.");
  return {
    loginId: loginIdValue,
    studentNo: loginIdValue,
    name: nameValue,
    phone: text(input.phone ?? input.studentPhone, 60),
    parentPhone: text(input.parentPhone, 60),
    status: studentStatus(input.status),
    classNames: unique(input.classNames),
    instructorNames: unique(input.instructorNames),
    memo: text(input.memo, 1000)
  };
}

export const updateStudentsMetadataBatchAdmin7343 = onCall(
  {
    ...MASTER_ADMIN_CALLABLE_OPTIONS_7343,
    secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET],
    timeoutSeconds: 300,
    memory: "512MiB"
  },
  async request => {
    const caller = await requireSuperAdmin(request);
    const input = object(request.data);
    const rawEdits = Array.isArray(input.edits) ? input.edits : [];
    if (!rawEdits.length) throw new HttpsError("invalid-argument", "저장할 학생정보가 없습니다.");
    if (rawEdits.length > 250) throw new HttpsError("invalid-argument", "한 번에 최대 250명까지 저장할 수 있습니다.");

    const uniqueEdits = new Map<string, PlainObject>();
    for (const raw of rawEdits) {
      const edit = object(raw);
      const studentUid = text(edit.studentUid, 128);
      if (!studentUid) throw new HttpsError("invalid-argument", "학생 UID가 없는 행이 있습니다.");
      uniqueEdits.set(studentUid, edit);
    }

    const prepared: Array<{
      studentUid: string;
      ref: DocumentReference;
      before: DocumentData;
      fields: PlainObject;
    }> = [];
    const missing: PlainObject[] = [];

    for (const [studentUid, edit] of uniqueEdits.entries()) {
      const ref = db().collection("students").doc(studentUid);
      const snapshot = await ref.get();
      if (!snapshot.exists) {
        missing.push({ studentUid, ok: false, sheetSyncState: "failed", sheetSyncMessage: "학생정보를 찾지 못했습니다." });
        continue;
      }
      prepared.push({
        studentUid,
        ref,
        before: snapshot.data() ?? {},
        fields: editableStudentFields7343(edit)
      });
    }

    let sheetResults = new Map<string, PlainObject>();
    let sheetCallError = "";
    const syncSheet = input.explicitAdminSheetWrite === true;
    if (syncSheet && prepared.length) {
      try {
        const gas = await callGas(
          "firebaseStudentMetadataBatchSync7343",
          requestId(input, "student-metadata-batch-7343"),
          {
            version: MASTER_DIRECTORY_SYNC_VERSION,
            actorFirebaseUid: caller.uid,
            explicitAdminSheetOperation: "Y",
            updates: prepared.map(item => ({
              studentUid: item.studentUid,
              sheetRow: Number(item.before.sheetRow || item.before.sourceSheetRow || 0),
              previousLoginId: text(item.before.loginId ?? item.before.studentNo, 100),
              previousName: text(object(item.before.sheetSnapshot).name ?? item.before.name ?? item.before.studentName, 100),
              ...item.fields
            }))
          }
        );
        const rows = Array.isArray(gas.results) ? gas.results : [];
        sheetResults = new Map(rows.map(value => {
          const row = object(value);
          return [text(row.studentUid, 128), row] as [string, PlainObject];
        }));
      } catch (error) {
        sheetCallError = text(error instanceof Error ? error.message : error, 1000) || "Google Sheets 일괄 반영에 실패했습니다.";
      }
    }

    const writeItems: Array<{ ref: DocumentReference; data: PlainObject }> = [];
    const results: PlainObject[] = [...missing];
    for (const item of prepared) {
      const sheetResult = sheetResults.get(item.studentUid);
      const sheetOk = !syncSheet || (!!sheetResult && sheetResult.ok === true);
      const sheetMessage = !syncSheet
        ? "Firestore 저장 완료 · 시트는 오전 6시 백업"
        : sheetCallError || text(sheetResult?.message, 1000) || (sheetOk ? "Firestore와 Google Sheets에 저장했습니다." : "Google Sheets 반영에 실패했습니다.");
      const sheetSyncState = !syncSheet ? "firestore-only" : (sheetOk ? "complete" : "failed");
      const localOverrides: PlainObject = { ...object(item.before.localOverrides), ...item.fields };
      let sheetSnapshot: PlainObject = { ...object(item.before.sheetSnapshot) };
      if (sheetOk && syncSheet) {
        sheetSnapshot = { ...sheetSnapshot, ...item.fields };
        ["loginId", "studentNo", "name", "phone", "parentPhone", "status", "classNames", "instructorNames", "memo"].forEach(key => {
          delete localOverrides[key];
        });
      }

      writeItems.push({
        ref: item.ref,
        data: {
          ...item.fields,
          nameNormalized: normalize(item.fields.name),
          phoneDigits: normalizePhone(item.fields.phone),
          parentPhoneDigits: normalizePhone(item.fields.parentPhone),
          localOverrides,
          sheetSnapshot,
          sheetSyncState,
          sheetSyncMessage: sheetMessage,
          updatedBy: caller.uid,
          updatedAtMs: Date.now(),
          updatedAt: FieldValue.serverTimestamp(),
          metadataUpdateSource: "student_metadata_batch_admin_7343"
        }
      });
      results.push({
        studentUid: item.studentUid,
        name: item.fields.name,
        ok: sheetSyncState !== "failed",
        sheetSyncState,
        sheetSyncMessage: sheetMessage
      });
    }

    for (let offset = 0; offset < writeItems.length; offset += 400) {
      const batch = db().batch();
      writeItems.slice(offset, offset + 400).forEach(item => batch.set(item.ref, item.data, { merge: true }));
      await batch.commit();
    }

    const failed = results.filter(result => result.ok !== true).length;
    return {
      ok: failed === 0,
      version: MASTER_DIRECTORY_SYNC_VERSION,
      saved: results.length - failed,
      failed,
      results
    };
  }
);
