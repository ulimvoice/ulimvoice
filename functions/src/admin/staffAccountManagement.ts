
import { getAuth, type UserRecord } from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type DocumentReference
} from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";


import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";

import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";
import { deriveStaffPasswordLoginEmail } from "../auth/staffFirebasePrimaryAuth.js";

export const STAFF_ACCOUNT_MANAGEMENT_VERSION = "2026-08-12.735.05.0.45-drive-folder-firestore-primary";
export const STAFF_DRIVE_FOLDER_FIRESTORE_PRIMARY_7355045 = true;

const STAFF_ROLES = new Set(["teacher", "admin", "superAdmin"] as const);
const AUTH_VERSION = "uidv2";
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const MAX_STAFF_ACCOUNTS = 200;
const AUDIT_COLLECTION = "staffAccountAudits";

const STAFF_ADMIN_CALLABLE_OPTIONS_7343 = Object.freeze({
  ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  cors: true,
  invoker: "public" as const
});

type StaffRole = "teacher" | "admin" | "superAdmin";
type PlainObject = Record<string, unknown>;

interface SuperAdminCaller {
  firebaseUid: string;
  role: "superAdmin";
  displayName: string;
  loginId: string;
  user: DocumentData;
}

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


function driveFolderId(value: unknown): string {
  const raw = text(value, 700);
  if (!raw) return "";
  const folderUrl = raw.match(/\/folders\/([A-Za-z0-9_-]{10,})/i);
  const candidate = folderUrl ? folderUrl[1] : (/^[A-Za-z0-9_-]{10,}$/.test(raw) ? raw : "");
  if (!candidate) throw new HttpsError("invalid-argument", "Google Drive 폴더 주소 또는 폴더 ID를 확인해주세요.");
  return candidate;
}

function normalizeLoginId(value: unknown): string {
  return text(value, 100).normalize("NFKC").toLowerCase();
}

function loginId(value: unknown): string {
  const raw = text(value, 100);
  if (!raw) throw new HttpsError("invalid-argument", "로그인 ID가 필요합니다.");
  if (raw.length < 2 || raw.length > 50) throw new HttpsError("invalid-argument", "로그인 ID는 2~50자로 입력해주세요.");
  if (!/^[0-9A-Za-z가-힣._-]+$/.test(raw)) {
    throw new HttpsError("invalid-argument", "로그인 ID에는 한글, 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.");
  }
  return raw;
}

function password(value: unknown): string {
  if (typeof value !== "string") throw new HttpsError("invalid-argument", "비밀번호가 필요합니다.");
  if (value.length < MIN_PASSWORD_LENGTH) throw new HttpsError("invalid-argument", `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  if (value.length > MAX_PASSWORD_LENGTH) throw new HttpsError("invalid-argument", "비밀번호가 너무 깁니다.");
  return value;
}

function staffRole(value: unknown): StaffRole {
  const role = text(value, 30) as StaffRole;
  if (!STAFF_ROLES.has(role)) throw new HttpsError("invalid-argument", "교직원 역할이 올바르지 않습니다.");
  return role;
}

function displayName(value: unknown): string {
  const name = text(value, 100);
  if (!name) throw new HttpsError("invalid-argument", "교직원 이름이 필요합니다.");
  return name;
}

function firebaseUid(value: unknown): string {
  const uid = text(value, 128);
  if (!uid) throw new HttpsError("invalid-argument", "교직원 Firebase UID가 필요합니다.");
  return uid;
}

function authErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  return text((error as { code?: unknown }).code, 100);
}

function isAuthUserNotFound(error: unknown): boolean {
  return authErrorCode(error) === "auth/user-not-found";
}

function incompleteStaffIdentity(user: DocumentData): boolean {
  const currentLoginId = text(user.loginId ?? user.adminId ?? user.legacyAdminId, 100);
  const currentName = text(user.name ?? user.displayName ?? user.teacherName ?? user.adminName, 100);
  return !currentLoginId && !currentName;
}

function normalizedUidSuffix(value: unknown): string {
  return text(value, 16).replace(/[^0-9A-Za-z_-]/g, "").toLowerCase();
}

function roleLabel(role: StaffRole): string {
  if (role === "teacher") return "강사";
  if (role === "admin") return "관리자";
  return "전체관리";
}

function safeAuthVersion(value: unknown): string {
  return text(value, 120);
}

async function requireSuperAdmin(request: CallableRequest<unknown>): Promise<SuperAdminCaller> {
  if (!request.auth) throw new HttpsError("unauthenticated", "Firebase 로그인이 필요합니다.");
  const uid = text(request.auth.uid, 128);
  const tokenRole = text(request.auth.token.role, 30);
  const tokenAuthVersion = safeAuthVersion(request.auth.token.authVersion);
  if (tokenRole !== "superAdmin") throw new HttpsError("permission-denied", "전체관리자 권한이 필요합니다.");
  if (!tokenAuthVersion) throw new HttpsError("permission-denied", "인증 버전이 올바르지 않습니다.");

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
  const principalUidV2 = text(request.auth.token.principalUidV2, 128);
  if (principalUidV2 && principalUidV2 !== uid) {
    throw new HttpsError("permission-denied", "전체관리자 계정 식별정보가 일치하지 않습니다.");
  }
  return {
    firebaseUid: uid,
    role: "superAdmin",
    displayName: text(user.name ?? user.displayName ?? authUser.displayName, 100) || "전체관리자",
    loginId: text(user.loginId ?? user.adminId ?? user.legacyAdminId, 100),
    user
  };
}

async function loadStaffUserDocs(): Promise<Array<{ id: string; data: DocumentData }>> {
  const snapshots = await Promise.all(
    (["teacher", "admin", "superAdmin"] as StaffRole[]).map(role =>
      db().collection("users").where("role", "==", role).limit(MAX_STAFF_ACCOUNTS).get()
    )
  );
  const found = new Map<string, DocumentData>();
  snapshots.forEach(snapshot => snapshot.docs.forEach(doc => found.set(doc.id, doc.data() ?? {})));
  return Array.from(found.entries()).map(([id, data]) => ({ id, data }));
}

async function assertUniqueLoginId(nextLoginId: string, exceptUid = ""): Promise<void> {
  const normalized = normalizeLoginId(nextLoginId);
  const rows = await loadStaffUserDocs();
  const conflict = rows.find(row => row.id !== exceptUid && normalizeLoginId(
    row.data.loginId ?? row.data.adminId ?? row.data.legacyAdminId ?? row.data.staffId
  ) === normalized);
  if (conflict) throw new HttpsError("already-exists", "이미 사용 중인 교직원 로그인 ID입니다.");

  try {
    const emailUser = await auth().getUserByEmail(deriveStaffPasswordLoginEmail(nextLoginId));
    if (emailUser.uid !== exceptUid) throw new HttpsError("already-exists", "이미 사용 중인 교직원 로그인 ID입니다.");
  } catch (error) {
    const code = text((error as { code?: unknown } | null)?.code, 100);
    if (error instanceof HttpsError) throw error;
    if (code && code !== "auth/user-not-found") throw error;
  }
}
async function assertUniqueActiveStaffPhone73550993(nextPhone: string, exceptUid = ""): Promise<void> {
  const digits = text(nextPhone, 60).replace(/\D/g, ""); if (!digits) return;
  const rows = await loadStaffUserDocs();
  const conflict = rows.find(row => row.id !== exceptUid && row.data.active === true && row.data.retired !== true && text(row.data.phone ?? row.data.phoneNumber, 60).replace(/\D/g, "") === digits);
  if (conflict) throw new HttpsError("already-exists", "같은 전화번호를 사용하는 활성 교직원 계정이 이미 있습니다.");
}


async function activeSuperAdminCount(exceptUid = ""): Promise<number> {
  // 역할 단일 필드 조회 후 active를 메모리에서 확인하여 별도 복합 색인이 필요하지 않게 합니다.
  const snapshot = await db().collection("users").where("role", "==", "superAdmin").get();
  return snapshot.docs.filter(doc => doc.id !== exceptUid && doc.data().active === true).length;
}




function auditPayload(caller: SuperAdminCaller, action: string, targetUid: string, before: PlainObject, after: PlainObject): PlainObject {
  return {
    version: STAFF_ACCOUNT_MANAGEMENT_VERSION,
    action,
    actorFirebaseUid: caller.firebaseUid,
    actorName: caller.displayName,
    actorLoginId: caller.loginId,
    targetFirebaseUid: targetUid,
    before,
    after,
    createdAtMs: Date.now(),
    createdAt: FieldValue.serverTimestamp()
  };
}

async function writeAudit(caller: SuperAdminCaller, action: string, targetUid: string, before: PlainObject, after: PlainObject): Promise<void> {
  await db().collection(AUDIT_COLLECTION).add(auditPayload(caller, action, targetUid, before, after));
}

async function safeWriteAudit(caller: SuperAdminCaller, action: string, targetUid: string, before: PlainObject, after: PlainObject): Promise<void> {
  try {
    await writeAudit(caller, action, targetUid, before, after);
  } catch (error) {
    console.error("[ULIM 7.33.0 staff account audit]", {
      action,
      targetUid,
      actorUid: caller.firebaseUid,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

function publicAccount(uid: string, user: DocumentData, authUser?: UserRecord): PlainObject {
  const currentLoginId = text(user.loginId ?? user.adminId ?? user.legacyAdminId, 100);
  const currentName = text(user.name ?? user.displayName ?? user.teacherName ?? user.adminName ?? authUser?.displayName, 100);
  return {
    firebaseUid: uid,
    loginId: currentLoginId,
    name: currentName,
    phone: text(user.phone ?? user.phoneNumber, 60),
    driveFolderId: text(user.driveFolderId, 180),
    role: text(user.role, 30),
    active: user.active === true && authUser?.disabled !== true,
    mustChangePassword: user.mustChangePassword === true,
    passwordLoginEnabled: user.passwordLoginEnabled === true,
    teacherUid: text(user.teacherUid, 128),
    legacySyncState: text(user.legacySyncState, 30),
    legacySyncMessage: text(user.legacySyncMessage, 500),
    legacySyncedAtMs: Number(user.legacySyncedAtMs || 0),
    updatedAtMs: Number(user.updatedAtMs || 0),
    incomplete: !currentLoginId && !currentName,
    authRecordExists: authUser !== undefined
  };
}

function claimsFor(authUser: UserRecord, uid: string, role: StaffRole, teacherUid: string): PlainObject {
  const claims: PlainObject = { ...(authUser.customClaims ?? {}) };
  delete claims.studentUid;
  delete claims.teacherUid;
  claims.role = role;
  claims.authVersion = AUTH_VERSION;
  claims.principalUidV2 = uid;
  if (role === "teacher") claims.teacherUid = teacherUid;
  return claims;
}

function userPatch(input: {
  uid: string;
  loginId: string;
  name: string;
  phone: string;
  driveFolderId: string;
  role: StaffRole;
  active: boolean;
  mustChangePassword: boolean;
  teacherUid: string;
  source: string;
}): PlainObject {
  const now = Date.now();
  return {
    firebaseUid: input.uid,
    uid: input.uid,
    loginId: input.loginId,
    loginIdNormalized: normalizeLoginId(input.loginId),
    adminId: input.loginId,
    legacyAdminId: input.loginId,
    name: input.name,
    displayName: input.name,
    phone: input.phone,
    driveFolderId: input.driveFolderId || FieldValue.delete(),
    driveFolderSource: input.driveFolderId ? "staff_management_firestore_7355045" : FieldValue.delete(),
    role: input.role,
    active: input.active,
    authVersion: AUTH_VERSION,
    principalUidV2: input.uid,
    teacherUid: input.role === "teacher" ? input.teacherUid : FieldValue.delete(),
    mustChangePassword: input.mustChangePassword,
    passwordCredentialEmail: deriveStaffPasswordLoginEmail(input.loginId),
    passwordCredentialVersion: 1,
    passwordLoginEnabled: true,
    accountManagementSource: input.source,
    updatedAtMs: now,
    updatedAt: FieldValue.serverTimestamp()
  };
}

function legacyAccountPatch(uid: string, role: StaffRole, active: boolean, teacherUid: string): PlainObject {
  return {
    firebaseUid: uid,
    principalUidV2: uid,
    role,
    active,
    authVersion: AUTH_VERSION,
    teacherUid: role === "teacher" ? teacherUid : FieldValue.delete(),
    studentUid: FieldValue.delete(),
    updatedAtMs: Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
    source: "staff_account_management_7330"
  };
}

async function writeTeacherProfile(previousTeacherUid: string, nextTeacherUid: string, input: {
  firebaseUid: string;
  loginId: string;
  name: string;
  phone: string;
  driveFolderId: string;
  active: boolean;
  role: StaffRole;
}): Promise<void> {
  const batch = db().batch();
  if (previousTeacherUid && (input.role !== "teacher" || previousTeacherUid !== nextTeacherUid)) {
    batch.set(db().collection("teachers").doc(previousTeacherUid), {
      active: false,
      accountActive: false,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
      accountManagementSource: "staff_role_changed_7330"
    }, { merge: true });
  }
  if (input.role === "teacher") {
    batch.set(db().collection("teachers").doc(nextTeacherUid), {
      teacherUid: nextTeacherUid,
      firebaseUid: input.firebaseUid,
      principalUidV2: input.firebaseUid,
      loginId: input.loginId,
      name: input.name,
      displayName: input.name,
      phone: input.phone,
      driveFolderId: input.driveFolderId || FieldValue.delete(),
      driveFolderSource: input.driveFolderId ? "staff_management_firestore_7355045" : FieldValue.delete(),
      role: "teacher",
      active: input.active,
      accountActive: input.active,
      authVersion: AUTH_VERSION,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
      accountManagementSource: "staff_account_management_7330"
    }, { merge: true });
  }
  await batch.commit();
}

export const listStaffAccountsAdmin = onCall(
  STAFF_ADMIN_CALLABLE_OPTIONS_7343,
  async request => {
    await requireSuperAdmin(request);
    const rows = await loadStaffUserDocs();
    const identifiers = rows.slice(0, MAX_STAFF_ACCOUNTS).map(row => ({ uid: row.id }));
    const authResult = identifiers.length ? await auth().getUsers(identifiers) : { users: [], notFound: [] };
    const authMap = new Map(authResult.users.map(user => [user.uid, user]));
    const accounts = rows.map(row => publicAccount(row.id, row.data, authMap.get(row.id)))
      .sort((a, b) => {
        const activeDiff = Number(b.active === true) - Number(a.active === true);
        if (activeDiff) return activeDiff;
        return text(a.name, 100).localeCompare(text(b.name, 100), "ko");
      });
    return { ok: true, version: STAFF_ACCOUNT_MANAGEMENT_VERSION, accounts, count: accounts.length };
  }
);

export const createStaffAccountAdmin = onCall(
  { ...STAFF_ADMIN_CALLABLE_OPTIONS_7343, timeoutSeconds: 180 },
  async request => {
    const caller = await requireSuperAdmin(request);
    const input = object(request.data);
    const nextLoginId = loginId(input.loginId);
    const nextName = displayName(input.name);
    const nextPhone = text(input.phone, 60);
    const nextDriveFolderId = driveFolderId(input.driveFolderId ?? input.driveFolderUrl);
    const nextRole = staffRole(input.role);
    const nextPassword = password(input.password);
    const mustChangePassword = input.mustChangePassword !== false;
    await assertUniqueLoginId(nextLoginId);
    await assertUniqueActiveStaffPhone73550993(nextPhone);

    let createdUid = "";
    try {
      const authUser = await auth().createUser({
        email: deriveStaffPasswordLoginEmail(nextLoginId),
        emailVerified: true,
        password: nextPassword,
        displayName: nextName,
        disabled: false
      });
      createdUid = authUser.uid;
      const teacherUid = nextRole === "teacher" ? createdUid : "";
      await auth().setCustomUserClaims(createdUid, claimsFor(authUser, createdUid, nextRole, teacherUid));

      const batch = db().batch();
      batch.set(db().collection("users").doc(createdUid), {
        ...userPatch({
          uid: createdUid,
          loginId: nextLoginId,
          name: nextName,
          phone: nextPhone,
          driveFolderId: nextDriveFolderId,
          role: nextRole,
          active: true,
          mustChangePassword,
          teacherUid,
          source: "staff_account_created_7330"
        }),
        createdAtMs: Date.now(),
        createdAt: FieldValue.serverTimestamp()
      }, { merge: true });
      batch.set(db().collection("legacyAccounts").doc(createdUid), legacyAccountPatch(createdUid, nextRole, true, teacherUid), { merge: true });
      await batch.commit();
      await writeTeacherProfile("", teacherUid, {
        firebaseUid: createdUid,
        loginId: nextLoginId,
        name: nextName,
        phone: nextPhone,
        driveFolderId: nextDriveFolderId,
        active: true,
        role: nextRole
      });
      await safeWriteAudit(caller, "create", createdUid, {}, {
        loginId: nextLoginId,
        name: nextName,
        phone: nextPhone,
        driveFolderId: nextDriveFolderId,
        role: nextRole,
        active: true,
        mustChangePassword
      });
      return { ok: true, version: STAFF_ACCOUNT_MANAGEMENT_VERSION, firebaseUid: createdUid, dataAuthority: "firebase_firestore" };
    } catch (error) {
      if (createdUid) {
        try { await auth().deleteUser(createdUid); } catch (_ignore) {}
        try { await db().collection("users").doc(createdUid).delete(); } catch (_ignore) {}
        try { await db().collection("legacyAccounts").doc(createdUid).delete(); } catch (_ignore) {}
        try { await db().collection("teachers").doc(createdUid).delete(); } catch (_ignore) {}
      }
      if (error instanceof HttpsError) throw error;
      const code = text((error as { code?: unknown } | null)?.code, 100);
      if (code === "auth/email-already-exists") throw new HttpsError("already-exists", "이미 사용 중인 교직원 로그인 ID입니다.");
      console.error("[ULIM 7.33.0 create staff]", { message: error instanceof Error ? error.message : String(error) });
      throw new HttpsError("internal", "교직원 계정을 생성하지 못했습니다. Firebase 계정과 Firestore 프로필의 불완전 생성을 방지하기 위해 생성 작업을 취소했습니다.");
    }
  }
);

export const updateStaffAccountAdmin = onCall(
  { ...STAFF_ADMIN_CALLABLE_OPTIONS_7343, timeoutSeconds: 180 },
  async request => {
    const caller = await requireSuperAdmin(request);
    const input = object(request.data);
    const uid = firebaseUid(input.firebaseUid);
    const nextLoginId = loginId(input.loginId);
    const nextName = displayName(input.name);
    const nextPhone = text(input.phone, 60);
    const nextDriveFolderId = driveFolderId(input.driveFolderId ?? input.driveFolderUrl);
    const nextRole = staffRole(input.role);
    const nextActive = input.active === true;
    const mustChangePassword = input.mustChangePassword === true;
    const repairIncomplete = input.repairIncomplete === true;
    const repairPassword = repairIncomplete ? password(input.repairPassword) : "";

    const targetSnap = await db().collection("users").doc(uid).get();
    if (!targetSnap.exists) throw new HttpsError("not-found", "교직원 계정을 찾지 못했습니다.");
    const before = targetSnap.data() ?? {};
    const wasIncomplete = incompleteStaffIdentity(before);
    if (repairIncomplete && !wasIncomplete) {
      throw new HttpsError("failed-precondition", "이 계정은 불완전 계정이 아니므로 일반 저장을 사용해주세요.");
    }
    if (!repairIncomplete && wasIncomplete) {
      throw new HttpsError("failed-precondition", "공백 계정은 임시 비밀번호를 포함한 복구 저장이 필요합니다.");
    }

    let targetAuth: UserRecord | null = null;
    try {
      targetAuth = await auth().getUser(uid);
    } catch (error) {
      if (!isAuthUserNotFound(error)) throw error;
      if (!repairIncomplete) throw new HttpsError("not-found", "Firebase Authentication 계정을 찾지 못했습니다.");
    }

    const previousRole = staffRole(before.role);
    const previousLoginId = text(before.loginId ?? before.adminId ?? before.legacyAdminId, 100);
    const previousTeacherUid = text(before.teacherUid, 128);

    if (uid === caller.firebaseUid && (!nextActive || nextRole !== "superAdmin")) {
      throw new HttpsError("failed-precondition", "현재 로그인한 전체관리자 계정은 사용 중지하거나 일반 권한으로 변경할 수 없습니다.");
    }
    if (previousRole === "superAdmin" && (nextRole !== "superAdmin" || !nextActive) && await activeSuperAdminCount(uid) < 1) {
      throw new HttpsError("failed-precondition", "활성 전체관리자 계정은 최소 1개 이상 유지해야 합니다.");
    }
    await assertUniqueLoginId(nextLoginId, uid);
    await assertUniqueActiveStaffPhone73550993(nextPhone, uid);

    const nextTeacherUid = nextRole === "teacher" ? (previousTeacherUid || uid) : "";
    let updatedAuth: UserRecord;
    if (repairIncomplete) {
      if (targetAuth) {
        updatedAuth = await auth().updateUser(uid, {
          email: deriveStaffPasswordLoginEmail(nextLoginId),
          emailVerified: true,
          displayName: nextName,
          password: repairPassword,
          disabled: !nextActive
        });
      } else {
        updatedAuth = await auth().createUser({
          uid,
          email: deriveStaffPasswordLoginEmail(nextLoginId),
          emailVerified: true,
          displayName: nextName,
          password: repairPassword,
          disabled: !nextActive
        });
      }
    } else {
      updatedAuth = await auth().updateUser(uid, {
        email: deriveStaffPasswordLoginEmail(nextLoginId),
        emailVerified: true,
        displayName: nextName,
        disabled: !nextActive
      });
    }
    await auth().setCustomUserClaims(uid, claimsFor(updatedAuth, uid, nextRole, nextTeacherUid));
    await auth().revokeRefreshTokens(uid);

    const batch = db().batch();
    batch.set(db().collection("users").doc(uid), userPatch({
      uid,
      loginId: nextLoginId,
      name: nextName,
      phone: nextPhone,
      driveFolderId: nextDriveFolderId,
      role: nextRole,
      active: nextActive,
      mustChangePassword,
      teacherUid: nextTeacherUid,
      source: repairIncomplete ? "staff_incomplete_account_repaired_73435" : "staff_account_updated_7330"
    }), { merge: true });
    batch.set(db().collection("legacyAccounts").doc(uid), legacyAccountPatch(uid, nextRole, nextActive, nextTeacherUid), { merge: true });
    await batch.commit();
    await writeTeacherProfile(previousTeacherUid, nextTeacherUid, {
      firebaseUid: uid,
      loginId: nextLoginId,
      name: nextName,
      phone: nextPhone,
      driveFolderId: nextDriveFolderId,
      active: nextActive,
      role: nextRole
    });
    await safeWriteAudit(caller, repairIncomplete ? "repairIncomplete" : "update", uid, {
      loginId: previousLoginId,
      name: text(before.name ?? before.displayName, 100),
      phone: text(before.phone, 60),
      driveFolderId: text(before.driveFolderId, 180),
      role: previousRole,
      active: before.active === true,
      mustChangePassword: before.mustChangePassword === true,
      incomplete: wasIncomplete
    }, {
      loginId: nextLoginId,
      name: nextName,
      phone: nextPhone,
      driveFolderId: nextDriveFolderId,
      role: nextRole,
      active: nextActive,
      mustChangePassword,
      incomplete: false
    });
    return {
      ok: true,
      version: STAFF_ACCOUNT_MANAGEMENT_VERSION,
      firebaseUid: uid,
      dataAuthority: "firebase_firestore",
      repairedIncomplete: repairIncomplete,
      requiresRelogin: true
    };
  }
);

export const resetStaffPasswordAdmin = onCall(
  { ...STAFF_ADMIN_CALLABLE_OPTIONS_7343, timeoutSeconds: 180 },
  async request => {
    const caller = await requireSuperAdmin(request);
    const input = object(request.data);
    const uid = firebaseUid(input.firebaseUid);
    const nextPassword = password(input.password);
    const mustChangePassword = input.mustChangePassword !== false;
    const targetSnap = await db().collection("users").doc(uid).get();
    if (!targetSnap.exists) throw new HttpsError("not-found", "교직원 계정을 찾지 못했습니다.");
    const target = targetSnap.data() ?? {};
    const targetRole = staffRole(target.role);
    const targetLoginId = loginId(target.loginId ?? target.adminId ?? target.legacyAdminId);
    const targetName = displayName(target.name ?? target.displayName ?? targetLoginId);
    const targetPhone = text(target.phone, 60);

    await auth().updateUser(uid, { password: nextPassword, disabled: target.active !== true });
    await auth().revokeRefreshTokens(uid);
    await targetSnap.ref.set({
      mustChangePassword,
      passwordLoginEnabled: true,
      passwordCredentialEmail: deriveStaffPasswordLoginEmail(targetLoginId),
      passwordCredentialUpdatedAtMs: Date.now(),
      passwordCredentialUpdatedAt: FieldValue.serverTimestamp(),
      passwordCredentialSource: "superadmin_reset_7330",
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await safeWriteAudit(caller, "resetPassword", uid, { mustChangePassword: target.mustChangePassword === true }, { mustChangePassword });
    return {
      ok: true,
      version: STAFF_ACCOUNT_MANAGEMENT_VERSION,
      firebaseUid: uid,
      dataAuthority: "firebase_firestore",
      allSessionsRevoked: true
    };
  }
);

export const deleteStaffAccountAdmin = onCall(
  { ...STAFF_ADMIN_CALLABLE_OPTIONS_7343, timeoutSeconds: 180 },
  async request => {
    const caller = await requireSuperAdmin(request);
    const input = object(request.data);
    const uid = firebaseUid(input.firebaseUid);
    if (uid === caller.firebaseUid) throw new HttpsError("failed-precondition", "현재 로그인한 전체관리자 계정은 퇴사 처리할 수 없습니다.");
    const targetSnap = await db().collection("users").doc(uid).get();
    if (!targetSnap.exists) throw new HttpsError("not-found", "교직원 계정을 찾지 못했습니다.");
    const target = targetSnap.data() ?? {};
    const targetRole = staffRole(target.role);
    const targetLoginIdRaw = text(target.loginId ?? target.adminId ?? target.legacyAdminId, 100);
    const targetNameRaw = text(target.name ?? target.displayName ?? target.teacherName ?? target.adminName, 100);
    const targetPhone = text(target.phone, 60);
    const teacherUid = text(target.teacherUid, 128);
    const purgeIncomplete = input.purgeIncomplete === true;

    if (purgeIncomplete) {
      if (!incompleteStaffIdentity(target)) {
        throw new HttpsError("failed-precondition", "이 계정은 공백 불완전 계정이 아니므로 퇴사 처리를 사용해주세요.");
      }
      const expectedSuffix = normalizedUidSuffix(uid.slice(-6));
      const suppliedSuffix = normalizedUidSuffix(input.confirmUidSuffix);
      if (!expectedSuffix || suppliedSuffix !== expectedSuffix) {
        throw new HttpsError("invalid-argument", "확인을 위해 입력한 UID 끝 6자리가 일치하지 않습니다.");
      }
      if (targetRole === "superAdmin" && target.active === true && await activeSuperAdminCount(uid) < 1) {
        throw new HttpsError("failed-precondition", "활성 전체관리자 계정은 최소 1개 이상 유지해야 합니다.");
      }

      try {
        await auth().deleteUser(uid);
      } catch (error) {
        if (!isAuthUserNotFound(error)) throw error;
      }

      const batch = db().batch();
      batch.delete(targetSnap.ref);
      batch.delete(db().collection("legacyAccounts").doc(uid));
      batch.delete(db().collection("teachers").doc(uid));
      if (teacherUid && teacherUid !== uid) batch.delete(db().collection("teachers").doc(teacherUid));
      await batch.commit();

      await safeWriteAudit(caller, "purgeIncomplete", uid, {
        loginId: targetLoginIdRaw,
        name: targetNameRaw,
        phone: targetPhone,
        role: targetRole,
        active: target.active === true,
        incomplete: true
      }, {
        purged: true,
        authDeleted: true,
        profileDocumentsDeleted: true
      });
      return {
        ok: true,
        version: STAFF_ACCOUNT_MANAGEMENT_VERSION,
        firebaseUid: uid,
        purgedIncomplete: true,
        recordsPreserved: true
      };
    }

    const targetLoginId = loginId(targetLoginIdRaw);
    if (normalizeLoginId(input.confirmLoginId) !== normalizeLoginId(targetLoginId)) {
      throw new HttpsError("invalid-argument", "확인을 위해 입력한 로그인 ID가 일치하지 않습니다.");
    }
    if (targetRole === "superAdmin" && await activeSuperAdminCount(uid) < 1) {
      throw new HttpsError("failed-precondition", "활성 전체관리자 계정은 최소 1개 이상 유지해야 합니다.");
    }
    const targetName = displayName(targetNameRaw || targetLoginId);

    await auth().updateUser(uid, { disabled: true });
    await auth().revokeRefreshTokens(uid);
    const batch = db().batch();
    batch.set(targetSnap.ref, {
      active: false,
      retired: true,
      retiredAtMs: Date.now(),
      retiredAt: FieldValue.serverTimestamp(),
      retiredByFirebaseUid: caller.firebaseUid,
      accountManagementSource: "staff_account_retired_7330",
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    batch.set(db().collection("legacyAccounts").doc(uid), {
      active: false,
      retired: true,
      updatedAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    if (teacherUid) {
      batch.set(db().collection("teachers").doc(teacherUid), {
        active: false,
        accountActive: false,
        retired: true,
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    await batch.commit();
    await safeWriteAudit(caller, "retire", uid, {
      loginId: targetLoginId,
      name: targetName,
      role: targetRole,
      active: target.active === true
    }, {
      loginId: targetLoginId,
      name: targetName,
      role: targetRole,
      active: false,
      retired: true
    });
    return { ok: true, version: STAFF_ACCOUNT_MANAGEMENT_VERSION, firebaseUid: uid, dataAuthority: "firebase_firestore", recordsPreserved: true };
  }
);
