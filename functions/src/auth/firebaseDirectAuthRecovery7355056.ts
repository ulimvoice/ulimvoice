import { createHash, timingSafeEqual } from "node:crypto";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import {
  upsertStudentFirebaseDirectCredential7355030,
  repairStudentFirebaseDirectCredentialAndAlias7355057
} from "./studentFirebaseDirectAuth7355030.js";

export const FIREBASE_DIRECT_AUTH_RECOVERY_7355056_VERSION = "2026-08-15.7355057-r29.4-student-alias-classroom-audit";

const RECOVERY_TOKEN_SHA256 = "d117e51108bf757133cc70dc0a26bb547c114af5b935034f757e323d8fe61cba";
const PROJECT_ID = "ulim-7b09a";
const STAFF_EMAIL_DOMAIN = "auth.ulimvoice.app";
const USER_COLLECTION = "users";
const STUDENT_COLLECTION = "students";
const RECOVERY_AUDIT_COLLECTION = "systemRecoveryAudit";
const RECOVERY_AUDIT_DOC = "firebaseDirectAuth7355056";
const MAX_USERS = 5000;
const UIDV2_CUTOVER_RUN_ID = "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";
const UIDV2_AUTH_TRANSITION_COLLECTION = "rebaseFanoutAuthTransitions";
const UIDV2_SUPERADMIN_FIREBASE_UID = "PRN2_01KY8PQY00FHMEBRWGJBR1EQJT";
const UIDV2_LEGACY_SUPERADMIN_FIREBASE_UID = "legacy:superAdmin:4ab445c8458b4c48da06b780e5beb42fcdea343ab8a4bf0f";
const STAFF_ROLES = new Set(["teacher", "admin", "superAdmin"]);

type PlainObject = Record<string, unknown>;
type StaffAccount = { uid: string; data: DocumentData; role: string; loginId: string; active: boolean };

function app() { return getOrInitializeDefaultFirebaseAdminApp(); }
function db() { return getFirestore(app()); }
function auth() { return getAuth(app()); }
function object(value: unknown): PlainObject { return value && typeof value === "object" && !Array.isArray(value) ? value as PlainObject : {}; }
function text(value: unknown, max = 500): string { return String(value ?? "").trim().slice(0, max); }
function normalizeLoginId(value: unknown): string { return text(value, 160).normalize("NFKC").toLowerCase(); }
function normalizeStudentName7355057(value: unknown): string { return text(value, 120).normalize("NFKC").replace(/\s+/g, "").toLowerCase(); }
function studentAttendanceNo7355057(value: unknown): string { return text(value, 50).replace(/\D/g, "").slice(-4); }
function digestHex(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function deriveStaffPasswordLoginEmail(loginId: string): string {
  const normalized = normalizeLoginId(loginId);
  if (!normalized) throw new Error("staff login id is missing");
  return `u_${createHash("sha256").update(`ulimvoice-staff-password-v1\u001f${normalized}`, "utf8").digest("base64url")}@${STAFF_EMAIL_DOMAIN}`;
}
function authErrorCode(error: unknown): string { return text(object(error).code, 120); }
function isAuthUserNotFound(error: unknown): boolean { return authErrorCode(error) === "auth/user-not-found"; }
function isAuthEmailNotFound(error: unknown): boolean { return authErrorCode(error) === "auth/user-not-found"; }
function authVersion(value: unknown): number | string | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 1) return value;
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 80);
  return null;
}
function role(value: unknown): string {
  const raw = text(value, 40).normalize("NFKC").replace(/[\s_-]+/g, "").toLowerCase();
  if (["superadmin", "fulladmin", "전체관리자", "전체관리", "원장"].includes(raw)) return "superAdmin";
  if (["admin", "관리자"].includes(raw)) return "admin";
  if (["teacher", "강사", "교사"].includes(raw)) return "teacher";
  return "";
}
function staffLoginId(data: DocumentData): string { return text(data.loginId ?? data.adminId ?? data.legacyAdminId ?? data.id, 160); }
function displayName(data: DocumentData, fallback: string): string { return text(data.name ?? data.displayName ?? data.teacherName ?? data.adminName ?? fallback, 100); }
function uidV2AuthTransitionDocumentId(legacyFirebaseUid: string): string {
  return createHash("sha256").update(`authTransition:${legacyFirebaseUid}`, "utf8").digest("hex").slice(0, 40);
}
function tokenFromRequest(req: any): string {
  const header = text(req.headers?.authorization, 500);
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match) return text(match[1], 500);
  return text(object(req.body).recoveryToken, 500);
}
function assertRecoveryToken(req: any): void {
  const supplied = tokenFromRequest(req);
  const suppliedHash = createHash("sha256").update(supplied, "utf8").digest();
  const expectedHash = Buffer.from(RECOVERY_TOKEN_SHA256, "hex");
  if (!supplied || suppliedHash.length !== expectedHash.length || !timingSafeEqual(suppliedHash, expectedHash)) throw new Error("RECOVERY_TOKEN_INVALID");
}
async function getAuthUser(uid: string): Promise<UserRecord | null> {
  try { return await auth().getUser(uid); } catch (error) { if (isAuthUserNotFound(error)) return null; throw error; }
}
async function getAuthUserByEmail(email: string): Promise<UserRecord | null> {
  try { return await auth().getUserByEmail(email); } catch (error) { if (isAuthEmailNotFound(error)) return null; throw error; }
}
async function proveLegacyMapsToCanonical(legacy: UserRecord, canonicalUid: string): Promise<string> {
  if (legacy.uid === canonicalUid) return "same_uid";
  const alias = await db().collection("identity_directory").doc(legacy.uid).get();
  if (alias.exists && text(alias.data()?.canonicalUid, 128) === canonicalUid) return "identity_directory";
  if (text(legacy.customClaims?.principalUidV2, 128) === canonicalUid) return "legacy_principalUidV2_claim";
  if (legacy.uid === UIDV2_LEGACY_SUPERADMIN_FIREBASE_UID && canonicalUid === UIDV2_SUPERADMIN_FIREBASE_UID) return "sealed_superadmin_cutover";
  const transition = await db().collection("uidV2StagingRuns").doc(UIDV2_CUTOVER_RUN_ID)
    .collection(UIDV2_AUTH_TRANSITION_COLLECTION).doc(uidV2AuthTransitionDocumentId(legacy.uid)).get();
  if (transition.exists) {
    const wrapper = transition.data() ?? {};
    const data = object(wrapper.data);
    if (text(data.oldFirebaseUid, 128) === legacy.uid && text(data.newFirebaseUid, 128) === canonicalUid) return "phase4c_transition";
  }
  throw new Error("LEGACY_CANONICAL_MAPPING_NOT_PROVEN");
}
async function freeCredentialEmailIfNeeded(email: string, canonicalUid: string): Promise<{ movedLegacyUid: string; mappingSource: string } | null> {
  const owner = await getAuthUserByEmail(email);
  if (!owner || owner.uid === canonicalUid) return null;
  const mappingSource = await proveLegacyMapsToCanonical(owner, canonicalUid);
  const tombstone = `legacy_${digestHex(owner.uid).slice(0, 32)}@disabled.ulim.local`;
  const tombstoneOwner = await getAuthUserByEmail(tombstone);
  if (tombstoneOwner && tombstoneOwner.uid !== owner.uid) throw new Error("LEGACY_TOMBSTONE_EMAIL_COLLISION");
  await auth().updateUser(owner.uid, { email: tombstone, emailVerified: false, disabled: true });
  await auth().revokeRefreshTokens(owner.uid);
  return { movedLegacyUid: owner.uid, mappingSource };
}
async function readStaffAccounts(): Promise<StaffAccount[]> {
  const snapshot = await db().collection(USER_COLLECTION).limit(MAX_USERS).get();
  return snapshot.docs.map(doc => {
    const data = doc.data() ?? {};
    return { uid: doc.id, data, role: role(data.role), loginId: staffLoginId(data), active: data.active === true };
  }).filter(item => STAFF_ROLES.has(item.role));
}
async function canonicalizeStaffAccount(source: StaffAccount): Promise<StaffAccount> {
  let targetUid = source.uid;
  const principal = text(source.data.principalUidV2, 128);
  if (principal && principal !== source.uid) targetUid = principal;
  else if (source.uid === UIDV2_LEGACY_SUPERADMIN_FIREBASE_UID && source.role === "superAdmin") targetUid = UIDV2_SUPERADMIN_FIREBASE_UID;
  if (targetUid === source.uid) return source;
  const targetSnap = await db().collection(USER_COLLECTION).doc(targetUid).get();
  if (!targetSnap.exists) throw new Error("CANONICAL_STAFF_USER_DOCUMENT_MISSING");
  const targetData = targetSnap.data() ?? {};
  const targetRole = role(targetData.role) || source.role;
  return {
    uid: targetUid,
    data: { ...source.data, ...targetData, loginId: staffLoginId(targetData) || source.loginId },
    role: targetRole,
    loginId: staffLoginId(targetData) || source.loginId,
    active: targetData.active === true
  };
}
async function chooseStaffAccount(accounts: StaffAccount[], loginId: string, requiredRole?: string): Promise<StaffAccount> {
  const wanted = normalizeLoginId(loginId);
  const raw = accounts.filter(item => item.active && normalizeLoginId(item.loginId) === wanted && (!requiredRole || item.role === requiredRole));
  if (!raw.length) throw new Error("ACTIVE_STAFF_NOT_FOUND");
  const resolved: StaffAccount[] = [];
  for (const source of raw) {
    try {
      const canonical = await canonicalizeStaffAccount(source);
      if (canonical.active && (!requiredRole || canonical.role === requiredRole)) resolved.push(canonical);
    } catch (_) {}
  }
  const byUid = new Map<string, StaffAccount>();
  resolved.forEach(item => byUid.set(item.uid, item));
  const unique = [...byUid.values()];
  if (requiredRole === "superAdmin") {
    const sealed = unique.find(item => item.uid === UIDV2_SUPERADMIN_FIREBASE_UID);
    if (sealed) return sealed;
  }
  if (unique.length !== 1) throw new Error(unique.length ? "STAFF_LOGIN_ID_AMBIGUOUS" : "ACTIVE_CANONICAL_STAFF_NOT_FOUND");
  const selected = unique[0];
  if (authVersion(selected.data.authVersion) === null) throw new Error("STAFF_AUTH_VERSION_INVALID");
  return selected;
}
async function canonicalizeStaffAccounts(accounts: StaffAccount[]): Promise<StaffAccount[]> {
  const map = new Map<string, StaffAccount>();
  for (const source of accounts) {
    try {
      const canonical = await canonicalizeStaffAccount(source);
      const previous = map.get(canonical.uid);
      if (!previous || (!previous.loginId && canonical.loginId)) map.set(canonical.uid, canonical);
    } catch (_) {}
  }
  return [...map.values()];
}
async function syncStaffClaimsAndCredentialState(account: StaffAccount, canonical: UserRecord, email: string, source: string): Promise<void> {
  const version = authVersion(account.data.authVersion);
  if (version === null) throw new Error("STAFF_AUTH_VERSION_INVALID");
  const claims: Record<string, unknown> = { ...(canonical.customClaims ?? {}), role: account.role, authVersion: version, principalUidV2: account.uid };
  const teacherUid = text(account.data.teacherUid, 128);
  if (account.role === "teacher") {
    if (!teacherUid) throw new Error("TEACHER_UID_MISSING");
    claims.teacherUid = teacherUid;
  } else {
    delete claims.teacherUid;
  }
  await auth().setCustomUserClaims(account.uid, claims);
  await db().collection(USER_COLLECTION).doc(account.uid).set({
    loginId: account.loginId,
    passwordLoginEnabled: true,
    passwordCredentialVersion: 1,
    passwordCredentialEmail: email,
    credentialState: "ready",
    passwordCredentialSource: source,
    passwordCredentialUpdatedAt: FieldValue.serverTimestamp(),
    authRecovery7355056At: FieldValue.serverTimestamp(),
    authRecovery7355056Version: FIREBASE_DIRECT_AUTH_RECOVERY_7355056_VERSION,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

async function setCanonicalStaffCredential(account: StaffAccount, password: string): Promise<PlainObject> {
  if (!account.active || !STAFF_ROLES.has(account.role)) throw new Error("ACTIVE_STAFF_REQUIRED");
  if (password.length < 6 || password.length > 128) throw new Error("PASSWORD_LENGTH_INVALID");
  if (authVersion(account.data.authVersion) === null) throw new Error("STAFF_AUTH_VERSION_INVALID");
  const canonical = await getAuthUser(account.uid);
  if (!canonical) throw new Error("CANONICAL_AUTH_USER_MISSING");
  const email = deriveStaffPasswordLoginEmail(account.loginId);
  const moved = await freeCredentialEmailIfNeeded(email, account.uid);
  const updatedCanonical = await auth().updateUser(account.uid, {
    email,
    emailVerified: true,
    password,
    displayName: displayName(account.data, account.loginId) || undefined,
    disabled: false
  });
  await syncStaffClaimsAndCredentialState(account, updatedCanonical, email, "firebase_only_recovery_7355056");
  await auth().revokeRefreshTokens(account.uid);
  return { ok: true, uid: account.uid, loginId: account.loginId, role: account.role, email, movedLegacyUid: moved?.movedLegacyUid ?? "", mappingSource: moved?.mappingSource ?? "" };
}
async function repairSafeStaffCredentials(accounts: StaffAccount[], skipUid: string): Promise<PlainObject> {
  const repaired: PlainObject[] = [];
  const needsPasswordReset: PlainObject[] = [];
  const inactive: PlainObject[] = [];
  for (const account of accounts) {
    if (!account.active) { inactive.push({ loginId: account.loginId, role: account.role }); continue; }
    if (account.uid === skipUid) continue;
    if (!account.loginId) { needsPasswordReset.push({ uid: account.uid, reason: "login_id_missing" }); continue; }
    const canonical = await getAuthUser(account.uid);
    if (!canonical) { needsPasswordReset.push({ loginId: account.loginId, role: account.role, reason: "canonical_auth_missing" }); continue; }
    const email = deriveStaffPasswordLoginEmail(account.loginId);
    const owner = await getAuthUserByEmail(email);
    const credentialReady = account.data.passwordLoginEnabled === true;
    try {
      if (owner && owner.uid === account.uid) {
        if (!credentialReady) {
          needsPasswordReset.push({ loginId: account.loginId, role: account.role, reason: "password_credential_not_ready" });
          continue;
        }
        const updated = canonical.disabled ? await auth().updateUser(account.uid, { disabled: false }) : canonical;
        await syncStaffClaimsAndCredentialState(account, updated, email, "firebase_only_safe_repair_7355056");
        repaired.push({ loginId: account.loginId, role: account.role, mode: "same_owner_enabled" });
        continue;
      }
      if (credentialReady && (!owner || owner.uid !== account.uid)) {
        let moved: { movedLegacyUid: string; mappingSource: string } | null = null;
        if (owner) moved = await freeCredentialEmailIfNeeded(email, account.uid);
        const updated = await auth().updateUser(account.uid, { email, emailVerified: true, disabled: false, displayName: displayName(account.data, account.loginId) || undefined });
        await syncStaffClaimsAndCredentialState(account, updated, email, "firebase_only_safe_repair_7355056");
        repaired.push({ loginId: account.loginId, role: account.role, mode: "credential_email_rebound", mappingSource: moved?.mappingSource ?? "" });
        continue;
      }
      needsPasswordReset.push({ loginId: account.loginId, role: account.role, reason: owner ? "legacy_email_owner_password_not_migrated" : "password_credential_not_ready" });
    } catch (error) {
      needsPasswordReset.push({ loginId: account.loginId, role: account.role, reason: text(error instanceof Error ? error.message : error, 240) });
    }
  }
  return { repaired, needsPasswordReset, inactiveCount: inactive.length };
}
async function repairStudents(): Promise<PlainObject> {
  const snapshot = await db().collection(STUDENT_COLLECTION).limit(MAX_USERS).get();
  const results: PlainObject[] = new Array(snapshot.docs.length);
  let next = 0;
  const concurrency = Math.min(6, Math.max(1, snapshot.docs.length));
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= snapshot.docs.length) return;
      const doc = snapshot.docs[i];
      const data = doc.data() ?? {};
      const name = text(data.name ?? data.studentName, 100);
      const attendance = text(data.attendanceNo ?? data.studentNo ?? data.loginId, 50).replace(/\D/g, "").slice(-4);
      if (!name || !attendance) { results[i] = { ok: true, skipped: true, studentUid: doc.id, reason: "incomplete" }; continue; }
      try { results[i] = await upsertStudentFirebaseDirectCredential7355030(doc.id); }
      catch (error) { results[i] = { ok: false, studentUid: doc.id, name, message: text(error instanceof Error ? error.message : error, 400) }; }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const failed = results.filter(item => item && item.ok !== true);
  const skipped = results.filter(item => item && item.skipped === true);
  return { total: results.length, succeeded: results.length - failed.length - skipped.length, skipped: skipped.length, failed: failed.length, failures: failed.slice(0, 50) };
}
async function chooseStudent7355057(name: string, requestedAttendanceNo: string): Promise<{ uid: string; data: DocumentData }> {
  const wantedName = normalizeStudentName7355057(name);
  const wantedNo = studentAttendanceNo7355057(requestedAttendanceNo);
  if (!wantedName) throw new Error("STUDENT_NAME_REQUIRED");
  const snapshot = await db().collection(STUDENT_COLLECTION).limit(MAX_USERS).get();
  let matches = snapshot.docs.filter(doc => normalizeStudentName7355057(doc.data()?.name ?? doc.data()?.studentName) === wantedName);
  if (wantedNo) matches = matches.filter(doc => studentAttendanceNo7355057(doc.data()?.attendanceNo ?? doc.data()?.studentNo ?? doc.data()?.loginId) === wantedNo);
  if (!matches.length) throw new Error("STUDENT_NOT_FOUND");
  if (matches.length > 1) {
    const preview = matches.slice(0, 10).map(doc => ({
      studentUid: doc.id,
      attendanceNo: studentAttendanceNo7355057(doc.data()?.attendanceNo ?? doc.data()?.studentNo ?? doc.data()?.loginId),
      status: text(doc.data()?.enrollmentStatus ?? doc.data()?.status, 40),
      active: doc.data()?.active
    }));
    throw new Error("STUDENT_AMBIGUOUS:" + JSON.stringify(preview));
  }
  return { uid: matches[0].id, data: matches[0].data() ?? {} };
}

async function repairStudent7355057(name: string, requestedAttendanceNo: string): Promise<PlainObject> {
  const selected = await chooseStudent7355057(name, requestedAttendanceNo);
  const result = await repairStudentFirebaseDirectCredentialAndAlias7355057(selected.uid);
  return {
    ...result,
    requestedName: name,
    selectedStudentUid: selected.uid,
    selectedStatus: text(selected.data.enrollmentStatus ?? selected.data.status, 40),
    selectedActiveFlag: selected.data.active === true ? true : selected.data.active === false ? false : null
  };
}

async function auditClassroom7355057(): Promise<PlainObject> {
  const snapshot = await db().collection("realtimeClassroomDays").limit(1200).get();
  const days = snapshot.docs.map(doc => {
    const data = doc.data() ?? {};
    const records = Array.isArray(data.records) ? data.records : [];
    return { date: doc.id, recordCount: records.length };
  }).sort((a, b) => a.date.localeCompare(b.date));
  const nonEmpty = days.filter(day => day.recordCount > 0);
  return {
    documentCount: snapshot.size,
    nonEmptyDayCount: nonEmpty.length,
    totalRecordCount: days.reduce((sum, day) => sum + day.recordCount, 0),
    firstDate: nonEmpty.length ? nonEmpty[0].date : "",
    lastDate: nonEmpty.length ? nonEmpty[nonEmpty.length - 1].date : "",
    recentDays: nonEmpty.slice(-90)
  };
}

async function auditState(): Promise<PlainObject> {
  const rawAccounts = await readStaffAccounts();
  const accounts = await canonicalizeStaffAccounts(rawAccounts);
  const items: PlainObject[] = [];
  for (const account of accounts) {
    const canonical = await getAuthUser(account.uid);
    const email = account.loginId ? deriveStaffPasswordLoginEmail(account.loginId) : "";
    const owner = email ? await getAuthUserByEmail(email) : null;
    let mapping = "";
    if (owner && owner.uid !== account.uid) { try { mapping = await proveLegacyMapsToCanonical(owner, account.uid); } catch (_) { mapping = "unproven"; } }
    items.push({
      loginId: account.loginId,
      role: account.role,
      active: account.active,
      canonicalUid: account.uid,
      canonicalAuthExists: !!canonical,
      canonicalDisabled: canonical ? canonical.disabled : null,
      passwordLoginEnabled: account.data.passwordLoginEnabled === true,
      credentialEmailOwnerUid: owner?.uid ?? "",
      credentialOwnerIsCanonical: !!owner && owner.uid === account.uid,
      legacyMappingSource: mapping
    });
  }
  return { staffCount: items.length, staff: items };
}
async function writeAudit(action: string, payload: PlainObject): Promise<void> {
  await db().collection(RECOVERY_AUDIT_COLLECTION).doc(RECOVERY_AUDIT_DOC).set({
    version: FIREBASE_DIRECT_AUTH_RECOVERY_7355056_VERSION,
    projectId: PROJECT_ID,
    lastAction: action,
    lastResult: payload,
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: Date.now()
  }, { merge: true });
}

export const firebaseDirectAuthRecovery7355056 = onRequest({
  region: "asia-northeast3",
  invoker: "public",
  cors: false,
  timeoutSeconds: 540,
  memory: "1GiB",
  maxInstances: 1
}, async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" }); return; }
  try {
    assertRecoveryToken(req);
    const body = object(req.body);
    const action = text(body.action, 80);
    if (action === "audit") {
      const result = await auditState();
      await writeAudit(action, { ok: true, staffCount: result.staffCount });
      res.status(200).json({ ok: true, version: FIREBASE_DIRECT_AUTH_RECOVERY_7355056_VERSION, ...result }); return;
    }
    if (action === "recoverBootstrap") {
      const loginId = text(body.loginId, 160);
      const password = String(body.password ?? "");
      const accounts = await readStaffAccounts();
      const bootstrap = await chooseStaffAccount(accounts, loginId, "superAdmin");
      const bootstrapResult = await setCanonicalStaffCredential(bootstrap, password);
      const students = await repairStudents();
      const canonicalAccounts = await canonicalizeStaffAccounts(accounts);
      const staff = await repairSafeStaffCredentials(canonicalAccounts, bootstrap.uid);
      const result = { bootstrap: bootstrapResult, students, staff };
      await writeAudit(action, { ok: true, bootstrapLoginId: bootstrap.loginId, students: { total: students.total, failed: students.failed }, staff: { repaired: (staff.repaired as unknown[]).length, needsPasswordReset: (staff.needsPasswordReset as unknown[]).length } });
      res.status(200).json({ ok: true, version: FIREBASE_DIRECT_AUTH_RECOVERY_7355056_VERSION, ...result }); return;
    }
    if (action === "repairStudent") {
      const studentName = text(body.studentName ?? body.name, 120);
      const attendance = studentAttendanceNo7355057(body.attendanceNo);
      const repaired = await repairStudent7355057(studentName, attendance);
      await writeAudit(action, { ok: true, studentName, studentUid: repaired.selectedStudentUid, authDisabled: repaired.authDisabled, validAliasCount: repaired.validAliasCount });
      res.status(200).json({ ok: true, version: FIREBASE_DIRECT_AUTH_RECOVERY_7355056_VERSION, repaired }); return;
    }
    if (action === "auditClassroom") {
      const classroom = await auditClassroom7355057();
      await writeAudit(action, { ok: true, documentCount: classroom.documentCount, totalRecordCount: classroom.totalRecordCount, firstDate: classroom.firstDate, lastDate: classroom.lastDate });
      res.status(200).json({ ok: true, version: FIREBASE_DIRECT_AUTH_RECOVERY_7355056_VERSION, classroom }); return;
    }
    if (action === "repairStaff") {
      const loginId = text(body.loginId, 160);
      const password = String(body.password ?? "");
      const accounts = await readStaffAccounts();
      const account = await chooseStaffAccount(accounts, loginId);
      const repaired = await setCanonicalStaffCredential(account, password);
      await writeAudit(action, { ok: true, loginId: account.loginId, role: account.role });
      res.status(200).json({ ok: true, version: FIREBASE_DIRECT_AUTH_RECOVERY_7355056_VERSION, repaired }); return;
    }
    res.status(400).json({ ok: false, error: "UNKNOWN_ACTION" });
  } catch (error) {
    const message = text(error instanceof Error ? error.message : error, 500);
    try { await writeAudit("error", { ok: false, message }); } catch (_) {}
    const status = message === "RECOVERY_TOKEN_INVALID" ? 401 : 400;
    res.status(status).json({ ok: false, version: FIREBASE_DIRECT_AUTH_RECOVERY_7355056_VERSION, error: message });
  }
});
