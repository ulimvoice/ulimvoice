import { createHash } from "node:crypto";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";
import { safeLegacyAuthUid } from "./legacySessionBridge.js";

export const STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION = "2026-08-15.7355030-r8-alias-canonical-status-fix";

const STUDENT_COLLECTION = "students";
const USER_COLLECTION = "users";
const LOGIN_ALIAS_COLLECTION = "studentLoginAliases";
const CREDENTIAL_KEY_COLLECTION = "studentDirectCredentialKeys";
const MAX_STUDENTS = 5000;
const MAX_ALIAS_CANDIDATES = 8;
const INTERNAL_EMAIL_DOMAIN = "students.ulim.local";
const CALLABLE_OPTIONS = Object.freeze({
  ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  cors: true,
  invoker: "public" as const
});

type PlainObject = Record<string, unknown>;

type DirectStudentRecord = {
  studentUid: string;
  name: string;
  nameNormalized: string;
  attendanceNo: string;
  active: boolean;
  status: string;
  mustChangePassword: boolean;
  directPasswordChanged: boolean;
  firebaseLoginNameNormalized: string;
};

type LoginCandidate = {
  key: string;
  email: string;
  salt: string;
  active: boolean;
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
  return value && typeof value === "object" && !Array.isArray(value) ? value as PlainObject : {};
}

function text(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeName(value: unknown): string {
  return text(value, 120).normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function attendanceNo(value: unknown): string {
  return text(value, 50).replace(/\D/g, "").slice(-4);
}

function isActiveStudent(data: DocumentData): boolean {
  if (data.registrationCancelled === true || data.deleted === true) return false;
  const status = text(data.enrollmentStatus ?? data.status, 40).normalize("NFKC").toLowerCase();
  // Match the canonical student-management contract: only an explicit
  // withdrawn/ended state blocks access.  Active, leave/hold (재원/휴원), and
  // legacy rows with no explicit terminal state remain login-eligible.  This
  // intentionally ignores stale active=false mirror flags left by migration.
  if (["withdrawn", "ended", "퇴원"].includes(status)) return false;
  return true;
}

function safeAuthVersion(value: unknown): number | null {
  const num = Number(value);
  return Number.isSafeInteger(num) && num >= 1 ? num : null;
}

/*
 * Staff Firebase-primary accounts predate the student direct-auth counter and
 * legitimately use string auth versions such as "uidv2".  Keep student auth
 * numeric, but validate staff callers using the same string-or-integer contract
 * already used by the canonical staff runtime.
 */
function safeStaffAuthVersion7355030(value: unknown): number | string | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 1 ? value : null;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized.slice(0, 80) : null;
  }
  return null;
}

function sameStaffAuthVersion7355030(left: unknown, right: unknown): boolean {
  const a = safeStaffAuthVersion7355030(left);
  const b = safeStaffAuthVersion7355030(right);
  return a !== null && b !== null && String(a) === String(b);
}

function digestHex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function base64UrlSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

export function directStudentFirebaseUid7355030(studentUid: string): string {
  return safeLegacyAuthUid("student", `student:${studentUid}`);
}

export function directStudentLoginEmail7355030(studentUid: string): string {
  return `s_${digestHex(`ulimvoice-student-email-v1\u001f${studentUid}`).slice(0, 40)}@${INTERNAL_EMAIL_DOMAIN}`;
}

export function directStudentCredentialSalt7355030(studentUid: string): string {
  return base64UrlSha256(`ulimvoice-student-salt-v1\u001f${studentUid}`).slice(0, 24);
}

export function deriveStudentFirebasePassword7355030(salt: string, rawPassword: string): string {
  const normalizedSalt = text(salt, 80);
  const password = String(rawPassword ?? "");
  if (!normalizedSalt) throw new Error("student credential salt is missing");
  if (password.length < 4 || password.length > 64) throw new Error("student password length is invalid");
  return `U1!${base64UrlSha256(`ulimvoice-student-password-v1\u001f${normalizedSalt}\u001f${password}`)}`;
}

function aliasIdForName(nameNormalized: string): string {
  return `SAL_${digestHex(`ulimvoice-student-login-name-v1\u001f${nameNormalized}`).slice(0, 48)}`;
}

function candidateKeyForUid(firebaseUid: string): string {
  return digestHex(`ulimvoice-student-login-candidate-v1\u001f${firebaseUid}`).slice(0, 24);
}

function credentialKeyFor(nameNormalized: string, no: string): string {
  return `SCK_${digestHex(`ulimvoice-student-credential-key-v1\u001f${nameNormalized}\u001f${no}`).slice(0, 48)}`;
}

function studentRecord(studentUid: string, data: DocumentData): DirectStudentRecord {
  const name = text(data.name ?? data.studentName, 100);
  const nameNormalized = normalizeName(data.nameNormalized ?? name);
  const no = attendanceNo(data.attendanceNo ?? data.studentNo ?? data.loginId);
  return {
    studentUid,
    name,
    nameNormalized,
    attendanceNo: no,
    active: isActiveStudent(data),
    status: text(data.enrollmentStatus ?? data.status, 40),
    mustChangePassword: data.firebaseDirectPasswordChanged !== true,
    directPasswordChanged: data.firebaseDirectPasswordChanged === true,
    firebaseLoginNameNormalized: normalizeName(data.firebaseLoginNameNormalized)
  };
}

async function requireSuperAdmin(request: CallableRequest<unknown>): Promise<{ uid: string; user: DocumentData; authUser: UserRecord }> {
  if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  const uid = text(request.auth.uid, 128);
  const role = text(request.auth.token.role, 30);
  const tokenVersion = safeStaffAuthVersion7355030(request.auth.token.authVersion);
  if (role !== "superAdmin" || tokenVersion === null) throw new HttpsError("permission-denied", "전체관리자 권한이 필요합니다.");
  const [userSnap, authUser] = await Promise.all([
    db().collection(USER_COLLECTION).doc(uid).get(),
    auth().getUser(uid)
  ]);
  const user = userSnap.data() ?? {};
  if (!userSnap.exists || user.active !== true || text(user.role, 30) !== "superAdmin" || !sameStaffAuthVersion7355030(user.authVersion, tokenVersion) || authUser.disabled) {
    throw new HttpsError("permission-denied", "전체관리자 권한이 변경되었습니다. 다시 로그인해주세요.");
  }
  return { uid, user, authUser };
}

async function requireStudent(request: CallableRequest<unknown>): Promise<{ firebaseUid: string; studentUid: string; user: DocumentData; student: DocumentData }> {
  if (!request.auth) throw new HttpsError("unauthenticated", "학생 로그인이 필요합니다.");
  const firebaseUid = text(request.auth.uid, 128);
  const role = text(request.auth.token.role, 30);
  const studentUid = text(request.auth.token.studentUid, 128);
  const tokenVersion = safeAuthVersion(request.auth.token.authVersion);
  if (role !== "student" || !studentUid || tokenVersion === null) throw new HttpsError("permission-denied", "학생 계정이 아닙니다.");
  const [userSnap, studentSnap, authUser] = await Promise.all([
    db().collection(USER_COLLECTION).doc(firebaseUid).get(),
    db().collection(STUDENT_COLLECTION).doc(studentUid).get(),
    auth().getUser(firebaseUid)
  ]);
  const user = userSnap.data() ?? {};
  const student = studentSnap.data() ?? {};
  if (!userSnap.exists || !studentSnap.exists || authUser.disabled || user.active !== true || text(user.role, 30) !== "student" || text(user.studentUid, 128) !== studentUid || safeAuthVersion(user.authVersion) !== tokenVersion || !isActiveStudent(student)) {
    throw new HttpsError("permission-denied", "학생 계정 상태가 변경되었습니다. 다시 로그인해주세요.");
  }
  return { firebaseUid, studentUid, user, student };
}

async function getOrCreateAuthUser(firebaseUid: string, email: string, password: string, disabled: boolean, displayName: string): Promise<{ user: UserRecord; created: boolean }> {
  try {
    const existing = await auth().getUser(firebaseUid);
    const updates: { email?: string; password?: string; disabled?: boolean; displayName?: string } = {};
    if (text(existing.email, 320).toLowerCase() !== email.toLowerCase()) updates.email = email;
    if (existing.disabled !== disabled) updates.disabled = disabled;
    if (displayName && existing.displayName !== displayName) updates.displayName = displayName;
    if (!existing.email) updates.password = password;
    const user = Object.keys(updates).length ? await auth().updateUser(firebaseUid, updates) : existing;
    return { user, created: false };
  } catch (error) {
    const code = text(object(error).code, 100);
    if (code !== "auth/user-not-found") throw error;
    const user = await auth().createUser({ uid: firebaseUid, email, password, disabled, displayName: displayName || undefined });
    return { user, created: true };
  }
}

async function removeAliasCandidate(nameNormalized: string, candidateKey: string): Promise<void> {
  if (!nameNormalized) return;
  const ref = db().collection(LOGIN_ALIAS_COLLECTION).doc(aliasIdForName(nameNormalized));
  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() ?? {};
    const candidates = { ...object(data.candidates) };
    if (!Object.prototype.hasOwnProperty.call(candidates, candidateKey)) return;
    delete candidates[candidateKey];
    if (!Object.keys(candidates).length) tx.delete(ref);
    else tx.set(ref, { candidates, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION }, { merge: true });
  });
}

async function upsertAliasCandidate(nameNormalized: string, candidate: LoginCandidate): Promise<void> {
  const ref = db().collection(LOGIN_ALIAS_COLLECTION).doc(aliasIdForName(nameNormalized));
  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const candidates = { ...object(data.candidates) };
    candidates[candidate.key] = { email: candidate.email, salt: candidate.salt, active: candidate.active };
    tx.set(ref, {
      nameKeyVersion: 1,
      candidates,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
      version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION
    }, { merge: true });
  });
}

export async function upsertStudentFirebaseDirectCredential7355030(studentUid: string, options: { forceResetToAttendanceNo?: boolean } = {}): Promise<PlainObject> {
  const studentRef = db().collection(STUDENT_COLLECTION).doc(studentUid);
  const studentSnap = await studentRef.get();
  if (!studentSnap.exists) throw new Error("student not found");
  const data = studentSnap.data() ?? {};
  const student = studentRecord(studentUid, data);
  if (!student.name || !student.nameNormalized) throw new Error("student name is missing");
  const active = student.active;
  const hasValidAttendanceNo = /^\d{4}$/.test(student.attendanceNo);
  if (active && !hasValidAttendanceNo) throw new Error("attendance number must be 4 digits");

  const directCredentialKey = hasValidAttendanceNo ? credentialKeyFor(student.nameNormalized, student.attendanceNo) : "";
  if (active) {
    const credentialKeySnap = await db().collection(CREDENTIAL_KEY_COLLECTION).doc(directCredentialKey).get();
    const credentialOwner = text(credentialKeySnap.data()?.studentUid, 128);
    if (credentialKeySnap.exists && credentialOwner && credentialOwner !== studentUid && credentialKeySnap.data()?.active !== false) {
      throw new Error("동일한 학생명과 출결번호를 사용하는 다른 학생이 있습니다. 출결번호를 고유하게 수정해주세요.");
    }
  }

  const firebaseUid = directStudentFirebaseUid7355030(studentUid);
  const email = directStudentLoginEmail7355030(studentUid);
  const salt = directStudentCredentialSalt7355030(studentUid);
  const initialFirebasePassword = deriveStudentFirebasePassword7355030(salt, hasValidAttendanceNo ? student.attendanceNo : "0000");
  const userRef = db().collection(USER_COLLECTION).doc(firebaseUid);
  const userSnap = await userRef.get();
  const currentUser = userSnap.data() ?? {};
  const authVersion = safeAuthVersion(currentUser.authVersion) ?? 1;

  const authResult = await getOrCreateAuthUser(firebaseUid, email, initialFirebasePassword, !active, student.name);
  const previousInitialAttendanceNo = attendanceNo(data.firebaseInitialAttendanceNo);
  const directPasswordAlreadyChanged = student.directPasswordChanged === true || currentUser.directPasswordChanged === true;
  const shouldResetPassword = options.forceResetToAttendanceNo === true ||
    authResult.created ||
    (!directPasswordAlreadyChanged && previousInitialAttendanceNo !== student.attendanceNo);
  if (shouldResetPassword) {
    await auth().updateUser(firebaseUid, { password: initialFirebasePassword, email, disabled: !active, displayName: student.name });
  }

  await auth().setCustomUserClaims(firebaseUid, { role: "student", studentUid, authVersion });
  await userRef.set({
    firebaseUid,
    role: "student",
    studentUid,
    active,
    authVersion,
    source: "firebase_direct_student_7355030",
    loginCredentialSalt: salt,
    loginEmail: email,
    directPasswordLoginEnabled: true,
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
    version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION
  }, { merge: true });

  const candidateKey = candidateKeyForUid(firebaseUid);
  const oldNameNormalized = student.firebaseLoginNameNormalized;
  if (oldNameNormalized && oldNameNormalized !== student.nameNormalized) {
    await removeAliasCandidate(oldNameNormalized, candidateKey);
  }
  if (active) {
    await upsertAliasCandidate(student.nameNormalized, { key: candidateKey, email, salt, active: true });
  } else {
    await removeAliasCandidate(student.nameNormalized, candidateKey);
  }

  const oldCredentialKey = text(data.firebaseDirectCredentialKey, 80);
  const credentialBatch = db().batch();
  if (active) {
    if (oldCredentialKey && oldCredentialKey !== directCredentialKey) {
      const oldRef = db().collection(CREDENTIAL_KEY_COLLECTION).doc(oldCredentialKey);
      const oldSnap = await oldRef.get();
      if (oldSnap.exists && text(oldSnap.data()?.studentUid, 128) === studentUid) credentialBatch.delete(oldRef);
    }
    credentialBatch.set(db().collection(CREDENTIAL_KEY_COLLECTION).doc(directCredentialKey), {
      studentUid, active: true, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION
    }, { merge: true });
  } else if (oldCredentialKey) {
    credentialBatch.set(db().collection(CREDENTIAL_KEY_COLLECTION).doc(oldCredentialKey), {
      active: false, updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp(), version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION
    }, { merge: true });
  }
  await credentialBatch.commit();

  await studentRef.set({
    firebaseAuthUid: firebaseUid,
    firebaseLoginEmail: email,
    firebaseLoginCredentialReady: active,
    firebaseLoginNameNormalized: student.nameNormalized,
    firebaseDirectCredentialKey: directCredentialKey || FieldValue.delete(),
    firebaseInitialAttendanceNo: directPasswordAlreadyChanged || !hasValidAttendanceNo ? FieldValue.delete() : student.attendanceNo,
    firebaseDirectPasswordChanged: directPasswordAlreadyChanged,
    firebaseDirectMustChangePassword: !directPasswordAlreadyChanged,
    authSyncState: active ? "complete" : "disabled",
    authSyncMessage: active ? "Firebase 학생 로그인 계정 연결 완료" : "퇴원/중지 학생 로그인 차단",
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
    version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION
  }, { merge: true });

  return { ok: true, studentUid, firebaseUid, active, created: authResult.created, resetToAttendanceNo: shouldResetPassword };
}

type VerifiedLoginCandidate7355057 = {
  key: string;
  email: string;
  salt: string;
  valid: boolean;
  remove: boolean;
  firebaseUid?: string;
  studentUid?: string;
  reason?: string;
};

async function getAuthUserByEmail7355057(email: string): Promise<UserRecord | null> {
  try {
    return await auth().getUserByEmail(email);
  } catch (error) {
    const code = text(object(error).code, 100);
    if (code === "auth/user-not-found") return null;
    throw error;
  }
}

async function verifyLoginAliasCandidate7355057(key: string, raw: unknown): Promise<VerifiedLoginCandidate7355057> {
  const item = object(raw);
  const email = text(item.email, 320);
  const salt = text(item.salt, 80);
  if (item.active !== true || !email || !salt) {
    return { key, email, salt, valid: false, remove: true, reason: "inactive_or_malformed" };
  }
  try {
    const authUser = await getAuthUserByEmail7355057(email);
    if (!authUser) return { key, email, salt, valid: false, remove: true, reason: "auth_missing" };
    if (authUser.disabled) return { key, email, salt, valid: false, remove: true, firebaseUid: authUser.uid, reason: "auth_disabled" };
    const claims = authUser.customClaims ?? {};
    const studentUid = text(claims.studentUid, 128);
    const claimVersion = safeAuthVersion(claims.authVersion);
    if (text(claims.role, 30) !== "student" || !studentUid || claimVersion === null) {
      return { key, email, salt, valid: false, remove: true, firebaseUid: authUser.uid, studentUid, reason: "claims_invalid" };
    }
    const expectedUid = directStudentFirebaseUid7355030(studentUid);
    const expectedEmail = directStudentLoginEmail7355030(studentUid);
    const expectedSalt = directStudentCredentialSalt7355030(studentUid);
    const expectedKey = candidateKeyForUid(expectedUid);
    if (authUser.uid !== expectedUid || email.toLowerCase() !== expectedEmail.toLowerCase() || salt !== expectedSalt || key !== expectedKey) {
      return { key, email, salt, valid: false, remove: true, firebaseUid: authUser.uid, studentUid, reason: "canonical_identity_mismatch" };
    }
    const [userSnap, studentSnap] = await Promise.all([
      db().collection(USER_COLLECTION).doc(authUser.uid).get(),
      db().collection(STUDENT_COLLECTION).doc(studentUid).get()
    ]);
    const user = userSnap.data() ?? {};
    const student = studentSnap.data() ?? {};
    if (!userSnap.exists || !studentSnap.exists || user.active !== true || text(user.role, 30) !== "student" ||
        text(user.studentUid, 128) !== studentUid || safeAuthVersion(user.authVersion) !== claimVersion || !isActiveStudent(student)) {
      return { key, email, salt, valid: false, remove: true, firebaseUid: authUser.uid, studentUid, reason: "firestore_identity_inactive" };
    }
    return { key, email, salt, valid: true, remove: false, firebaseUid: authUser.uid, studentUid };
  } catch (error) {
    // A transient Admin/Firestore failure must not mutate the alias directory.
    return { key, email, salt, valid: false, remove: false, reason: text(error instanceof Error ? error.message : error, 240) || "verification_error" };
  }
}

async function validateAndPruneLoginAlias7355057(nameNormalized: string): Promise<{ candidates: Array<{ key: string; email: string; salt: string }>; removed: string[]; uncertain: string[] }> {
  const ref = db().collection(LOGIN_ALIAS_COLLECTION).doc(aliasIdForName(nameNormalized));
  const snap = await ref.get();
  const candidatesObject = snap.exists ? object(snap.data()?.candidates) : {};
  const entries = Object.entries(candidatesObject).slice(0, MAX_ALIAS_CANDIDATES);
  const checked = await Promise.all(entries.map(([key, raw]) => verifyLoginAliasCandidate7355057(key, raw)));
  const valid = checked.filter(item => item.valid).map(item => ({ key: item.key, email: item.email, salt: item.salt }));
  const removed = checked.filter(item => !item.valid && item.remove).map(item => item.key);
  const uncertain = checked.filter(item => !item.valid && !item.remove).map(item => item.key);
  if (removed.length && snap.exists) {
    await db().runTransaction(async tx => {
      const fresh = await tx.get(ref);
      if (!fresh.exists) return;
      const next = { ...object(fresh.data()?.candidates) };
      removed.forEach(key => { delete next[key]; });
      if (!Object.keys(next).length) tx.delete(ref);
      else tx.set(ref, {
        candidates: next,
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp(),
        version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION
      }, { merge: true });
    });
  }
  return { candidates: valid, removed, uncertain };
}

export async function repairStudentFirebaseDirectCredentialAndAlias7355057(studentUid: string): Promise<PlainObject> {
  const repaired = await upsertStudentFirebaseDirectCredential7355030(studentUid);
  const studentSnap = await db().collection(STUDENT_COLLECTION).doc(studentUid).get();
  if (!studentSnap.exists) throw new Error("student not found after repair");
  const student = studentRecord(studentUid, studentSnap.data() ?? {});
  const firebaseUid = directStudentFirebaseUid7355030(studentUid);
  const authUser = await auth().getUser(firebaseUid);
  const alias = await validateAndPruneLoginAlias7355057(student.nameNormalized);
  const canonicalKey = candidateKeyForUid(firebaseUid);
  const canonicalPresent = alias.candidates.some(item => item.key === canonicalKey);
  return {
    ...repaired,
    name: student.name,
    attendanceNo: student.attendanceNo,
    status: student.status,
    active: student.active,
    firebaseUid,
    authDisabled: authUser.disabled,
    canonicalAliasPresent: canonicalPresent,
    validAliasCount: alias.candidates.length,
    removedAliasCount: alias.removed.length,
    uncertainAliasCount: alias.uncertain.length
  };
}

export const resolveStudentFirebaseLogin7355030 = onCall(CALLABLE_OPTIONS, async request => {
  const nameNormalized = normalizeName(object(request.data).name);
  if (!nameNormalized) throw new HttpsError("invalid-argument", "학생 이름을 입력해주세요.");
  const alias = await validateAndPruneLoginAlias7355057(nameNormalized);
  return {
    ok: true,
    version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION,
    candidates: alias.candidates,
    removedInvalidCandidates: alias.removed.length
  };
});

export const getStudentFirebaseProfile7355030 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStudent(request);
  const student = caller.student;
  return {
    ok: true,
    version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION,
    firebaseAuthUid: caller.firebaseUid,
    studentUid: caller.studentUid,
    name: text(student.name ?? student.studentName, 100),
    attendanceNo: attendanceNo(student.attendanceNo ?? student.studentNo ?? student.loginId),
    instructorNames: Array.isArray(student.instructorNames) ? student.instructorNames.map(value => text(value, 120)).filter(Boolean) : [],
    enrollmentStatus: text(student.enrollmentStatus ?? student.status, 40),
    mustChangePassword: student.firebaseDirectPasswordChanged !== true,
    loginCredentialSalt: text(caller.user.loginCredentialSalt, 80),
    loginEmail: text(caller.user.loginEmail, 320),
    authVersion: safeAuthVersion(caller.user.authVersion)
  };
});

export const confirmStudentFirebasePasswordChanged7355030 = onCall(CALLABLE_OPTIONS, async request => {
  const caller = await requireStudent(request);
  await Promise.all([
    db().collection(STUDENT_COLLECTION).doc(caller.studentUid).set({
      mustChangePassword: false,
      initialPasswordChanged: true,
      firebaseDirectPasswordChanged: true,
      firebaseDirectMustChangePassword: false,
      firebaseInitialAttendanceNo: FieldValue.delete(),
      passwordChangedAtMs: Date.now(),
      passwordChangedAt: FieldValue.serverTimestamp(),
      authSyncState: "complete",
      authSyncMessage: "Firebase 학생 비밀번호 변경 완료",
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
      version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION
    }, { merge: true }),
    db().collection(USER_COLLECTION).doc(caller.firebaseUid).set({
      directPasswordChanged: true,
      directPasswordChangedAtMs: Date.now(),
      directPasswordChangedAt: FieldValue.serverTimestamp(),
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
      version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION
    }, { merge: true })
  ]);
  return { ok: true, version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION };
});

export const provisionStudentsFirebaseDirectAuthAdmin7355030 = onCall({ ...CALLABLE_OPTIONS, timeoutSeconds: 540, memory: "1GiB" }, async request => {
  await requireSuperAdmin(request);
  const snapshot = await db().collection(STUDENT_COLLECTION).limit(MAX_STUDENTS).get();
  const rows = snapshot.docs.map(doc => studentRecord(doc.id, doc.data() ?? {}));

  // Keep the same canonical population as listStudentManagementAdmin7352.
  // The student-management screen intentionally hides legacy/incomplete student
  // documents that have no usable name or attendance number. Those documents
  // must not block Firebase Auth provisioning for the visible canonical roster.
  const incompleteRows = rows.filter(row => !row.name || !row.nameNormalized || !row.attendanceNo);
  const canonicalRows = rows.filter(row => row.name && row.nameNormalized && row.attendanceNo);
  const invalid = canonicalRows.filter(row => row.active && !/^\d{4}$/.test(row.attendanceNo));
  if (invalid.length) {
    const preview = invalid.slice(0, 10).map(row => `${row.name || "이름없음"}(${row.attendanceNo || "출결번호없음"})`).join(", ");
    throw new HttpsError("failed-precondition", `로그인 가능한 학생 중 출결번호가 4자리가 아닌 학생 ${invalid.length}명이 있습니다: ${preview}. 출결번호를 수정해주세요.`);
  }
  const pairOwners = new Map<string, DirectStudentRecord[]>();
  canonicalRows.filter(row => row.active).forEach(row => {
    const key = `${row.nameNormalized}\u001f${row.attendanceNo}`;
    const list = pairOwners.get(key) ?? [];
    list.push(row);
    pairOwners.set(key, list);
  });
  const duplicates = [...pairOwners.values()].filter(list => list.length > 1);
  if (duplicates.length) {
    const preview = duplicates.slice(0, 5).map(list => `${list[0].name}(${list[0].attendanceNo}) ${list.length}명`).join(", ");
    throw new HttpsError("failed-precondition", `동일한 학생명+출결번호 로그인 조합이 있습니다: ${preview}. 출결번호를 고유하게 수정해주세요.`);
  }
  // Provisioning one student performs several Firebase Auth + Firestore round trips.
  // Processing the whole roster serially exceeded the callable deadline at ~135
  // students. Keep one canonical owner, but use a small bounded worker pool so the
  // operation stays idempotent and comfortably inside the 540-second deadline.
  const provisionConcurrency = 6;
  const results: PlainObject[] = new Array(canonicalRows.length);
  let nextIndex = 0;
  const startedAtMs = Date.now();
  async function provisionWorker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= canonicalRows.length) return;
      const row = canonicalRows[index];
      try {
        results[index] = await upsertStudentFirebaseDirectCredential7355030(row.studentUid);
      } catch (error) {
        results[index] = { ok: false, studentUid: row.studentUid, message: text(error instanceof Error ? error.message : error, 500) };
      }
    }
  }
  const workerCount = Math.min(provisionConcurrency, Math.max(1, canonicalRows.length));
  await Promise.all(Array.from({ length: workerCount }, () => provisionWorker()));
  const failed = results.filter(item => item && item.ok !== true);
  return {
    ok: failed.length === 0,
    version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION,
    total: canonicalRows.length,
    active: canonicalRows.filter(row => row.active).length,
    skippedIncomplete: incompleteRows.length,
    succeeded: results.length - failed.length,
    failed: failed.length,
    concurrency: workerCount,
    elapsedMs: Date.now() - startedAtMs,
    failures: failed.slice(0, 50)
  };
});

export const resetStudentFirebasePasswordAdmin7355030 = onCall(CALLABLE_OPTIONS, async request => {
  await requireSuperAdmin(request);
  const studentUid = text(object(request.data).studentUid, 128);
  if (!studentUid) throw new HttpsError("invalid-argument", "학생을 선택해주세요.");
  const result = await upsertStudentFirebaseDirectCredential7355030(studentUid, { forceResetToAttendanceNo: true });
  const resetStudentSnap = await db().collection(STUDENT_COLLECTION).doc(studentUid).get();
  const resetAttendanceNo = attendanceNo(resetStudentSnap.data()?.attendanceNo);
  await Promise.all([
    db().collection(STUDENT_COLLECTION).doc(studentUid).set({
    mustChangePassword: true,
    initialPasswordChanged: false,
    firebaseDirectPasswordChanged: false,
    firebaseDirectMustChangePassword: true,
    firebaseInitialAttendanceNo: resetAttendanceNo,
    passwordResetAtMs: Date.now(),
    passwordResetAt: FieldValue.serverTimestamp(),
    authSyncState: "complete",
    authSyncMessage: "출결번호로 Firebase 비밀번호 초기화 완료",
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true }),
    db().collection(USER_COLLECTION).doc(text(result.firebaseUid, 128)).set({
      directPasswordChanged: false,
      directPasswordResetAtMs: Date.now(),
      directPasswordResetAt: FieldValue.serverTimestamp(),
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
      version: STUDENT_FIREBASE_DIRECT_AUTH_7355030_VERSION
    }, { merge: true })
  ]);
  return { ...result, message: "학생 비밀번호를 현재 출결번호로 초기화했습니다." };
});
