import { createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";
import { ULIM_LEGACY_PROOF_HMAC_SECRET } from "../common/firebaseSecrets.js";
import { FirestoreLegacyProofStore } from "./firestoreLegacyProofStore.js";
import { LEGACY_AUTH_MAX_TTL_MS } from "./legacySessionBridge.js";
import type { UlimRole } from "../common/roles.js";

export const STAFF_FIREBASE_PRIMARY_AUTH_VERSION = "2026-08-01.732.06";

const STAFF_ROLES = new Set<UlimRole>(["teacher", "admin", "superAdmin"]);
const LOGIN_EMAIL_DOMAIN = "auth.ulimvoice.app";
const PASSWORD_MIGRATION_AUDIENCE = "ulimvoice-staff-password-migration";
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;

type AuthVersion = number | string;
type PlainObject = Record<string, unknown>;

function text(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function object(value: unknown): PlainObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as PlainObject;
}

function normalizeLoginId(value: unknown): string {
  return text(value, 100).normalize("NFKC").toLowerCase();
}

function normalizeAuthVersion(value: unknown): AuthVersion | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 1) return value;
  return null;
}

function safeRole(value: unknown): UlimRole {
  const role = text(value, 30) as UlimRole;
  if (!STAFF_ROLES.has(role)) {
    throw new HttpsError("permission-denied", "교직원 권한이 필요합니다.");
  }
  return role;
}

/**
 * The browser uses the exact same deterministic mapping before Firebase Auth.
 * The actual staff ID is not placed in the Firebase Authentication email field.
 */
export function deriveStaffPasswordLoginEmail(loginId: string): string {
  const normalized = normalizeLoginId(loginId);
  if (!normalized) throw new HttpsError("invalid-argument", "교직원 ID가 필요합니다.");
  const digest = createHash("sha256")
    .update(`ulimvoice-staff-password-v1\u001f${normalized}`, "utf8")
    .digest("base64url");
  return `u_${digest}@${LOGIN_EMAIL_DOMAIN}`;
}

function candidateLoginIds(user: DocumentData, token: Record<string, unknown>): string[] {
  return [
    user.adminId,
    user.legacyAdminId,
    user.loginId,
    user.staffId,
    token.adminId,
    token.legacyAdminId,
    token.loginId
  ].map(normalizeLoginId).filter(Boolean);
}

async function requireCurrentActiveStaff(request: CallableRequest<unknown>): Promise<{
  firebaseUid: string;
  role: UlimRole;
  authVersion: AuthVersion;
  user: DocumentData;
}> {
  if (!request.auth) throw new HttpsError("unauthenticated", "Firebase 로그인이 필요합니다.");

  const firebaseUid = text(request.auth.uid, 128);
  const role = safeRole(request.auth.token.role);
  const authVersion = normalizeAuthVersion(request.auth.token.authVersion);
  if (authVersion === null) {
    throw new HttpsError("permission-denied", "인증 버전이 올바르지 않습니다.");
  }

  const app = getOrInitializeDefaultFirebaseAdminApp();
  const db = getFirestore(app);
  const snapshot = await db.collection("users").doc(firebaseUid).get();
  if (!snapshot.exists) {
    throw new HttpsError("permission-denied", "활성 교직원 계정 정보가 없습니다.");
  }

  const user = snapshot.data() ?? {};
  const storedAuthVersion = normalizeAuthVersion(user.authVersion);
  if (user.active !== true || user.role !== role || storedAuthVersion !== authVersion) {
    throw new HttpsError("permission-denied", "계정 또는 권한이 변경되었습니다. 다시 로그인해주세요.");
  }

  if (role === "teacher") {
    const claimTeacherUid = text(request.auth.token.teacherUid, 128);
    const storedTeacherUid = text(user.teacherUid, 128);
    if (!claimTeacherUid || claimTeacherUid !== storedTeacherUid) {
      throw new HttpsError("permission-denied", "강사 계정 정보가 일치하지 않습니다.");
    }
  }

  const authUser = await getAuth(app).getUser(firebaseUid);
  if (authUser.disabled) {
    throw new HttpsError("permission-denied", "사용 중지된 계정입니다.");
  }

  return { firebaseUid, role, authVersion, user };
}

function parseCredentialInput(data: unknown): { loginId: string; password: string; migrationProof: string; markPasswordChanged: boolean } {
  const input = object(data);
  const loginId = text(input.loginId, 100);
  const password = typeof input.password === "string" ? input.password : "";
  const migrationProof = text(input.migrationProof, 4096);
  const markPasswordChanged = input.markPasswordChanged === true;

  if (!loginId) throw new HttpsError("invalid-argument", "교직원 ID가 필요합니다.");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError("invalid-argument", `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new HttpsError("invalid-argument", "비밀번호가 너무 깁니다.");
  }
  if (!migrationProof) {
    throw new HttpsError("invalid-argument", "최근 비밀번호 확인 proof가 필요합니다.");
  }
  return { loginId, password, migrationProof, markPasswordChanged };
}

/**
 * One-time legacy-to-Firebase password credential migration and later password synchronization.
 *
 * Security boundary:
 * - the caller must already be authenticated through Firebase Auth;
 * - a separate short-lived, one-time HMAC proof is required after GAS verifies the current password;
 * - the active users/{uid} document and authVersion/role are revalidated server-side;
 * - a caller may only provision the credential for its own Firebase UID and its own stored login ID.
 */
export const migrateCurrentStaffPasswordCredential = onCall(
  { ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS, secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET] },
  async (request: CallableRequest<unknown>) => {
    const { loginId, password, migrationProof, markPasswordChanged } = parseCredentialInput(request.data);
    const caller = await requireCurrentActiveStaff(request);
    const normalizedLoginId = normalizeLoginId(loginId);
    const storedLoginIds = candidateLoginIds(caller.user, (request.auth?.token ?? {}) as Record<string, unknown>);

    if (!storedLoginIds.length || !storedLoginIds.includes(normalizedLoginId)) {
      throw new HttpsError("permission-denied", "현재 로그인 계정의 교직원 ID와 일치하지 않습니다.");
    }

    const app = getOrInitializeDefaultFirebaseAdminApp();
    const db = getFirestore(app);
    const secret = ULIM_LEGACY_PROOF_HMAC_SECRET.value() || process.env.ULIM_LEGACY_PROOF_HMAC_SECRET || "";
    const proofStore = new FirestoreLegacyProofStore(db, secret, Timestamp);
    let verifiedProof;
    try {
      verifiedProof = await proofStore.consumeValidProof(migrationProof, {
        expectedAudience: PASSWORD_MIGRATION_AUDIENCE,
        now: Date.now(),
        maxTtlMs: LEGACY_AUTH_MAX_TTL_MS
      });
    } catch (error) {
      console.warn("[ULIM 7.32.0 password proof rejected]", {
        firebaseUid: caller.firebaseUid,
        message: error instanceof Error ? error.message : String(error)
      });
      throw new HttpsError("unauthenticated", "비밀번호 확인 proof가 만료되었거나 이미 사용되었습니다. 다시 로그인해주세요.");
    }

    if (verifiedProof.role !== caller.role) {
      throw new HttpsError("permission-denied", "비밀번호 확인 proof의 역할이 일치하지 않습니다.");
    }
    if (normalizeLoginId(verifiedProof.legacyAdminId) !== normalizedLoginId) {
      throw new HttpsError("permission-denied", "비밀번호 확인 proof의 교직원 ID가 일치하지 않습니다.");
    }
    if (verifiedProof.firebaseUid && verifiedProof.firebaseUid !== caller.firebaseUid) {
      throw new HttpsError("permission-denied", "비밀번호 확인 proof의 Firebase UID가 일치하지 않습니다.");
    }
    if (verifiedProof.principalUidV2 && verifiedProof.principalUidV2 !== caller.firebaseUid) {
      throw new HttpsError("permission-denied", "비밀번호 확인 proof의 principal UID가 일치하지 않습니다.");
    }
    if (caller.role === "teacher" && text(verifiedProof.teacherUid, 128) !== text(caller.user.teacherUid, 128)) {
      throw new HttpsError("permission-denied", "비밀번호 확인 proof의 강사 UID가 일치하지 않습니다.");
    }

    const auth = getAuth(app);
    const email = deriveStaffPasswordLoginEmail(loginId);
    const displayName = text(
      caller.user.name ??
      caller.user.displayName ??
      caller.user.teacherName ??
      caller.user.adminName ??
      loginId,
      100
    );

    try {
      await auth.updateUser(caller.firebaseUid, {
        email,
        emailVerified: true,
        password,
        displayName: displayName || undefined,
        disabled: false
      });
    } catch (error) {
      const code = text((error as { code?: unknown } | null)?.code, 100);
      if (code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "동일한 교직원 ID가 다른 Firebase 계정에 연결되어 있습니다.");
      }
      if (code === "auth/invalid-password") {
        throw new HttpsError("invalid-argument", "Firebase 비밀번호 조건을 충족하지 않습니다.");
      }
      console.error("[ULIM 7.32.0 password credential migration]", {
        firebaseUid: caller.firebaseUid,
        role: caller.role,
        code,
        message: error instanceof Error ? error.message : String(error)
      });
      throw new HttpsError("internal", "Firebase 로그인 자격 증명을 저장하지 못했습니다.");
    }

    await db.collection("users").doc(caller.firebaseUid).set({
      loginId: loginId.trim(),
      passwordLoginEnabled: true,
      ...(markPasswordChanged ? { mustChangePassword: false } : {}),
      passwordCredentialVersion: 1,
      passwordCredentialEmail: email,
      passwordCredentialUpdatedAt: FieldValue.serverTimestamp(),
      passwordCredentialSource: markPasswordChanged
        ? "staff_self_password_changed_7326"
        : "legacy_authenticated_self_migration_7320",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    console.info("[ULIM 7.32.6 password credential ready]", {
      passwordChanged: markPasswordChanged,
      version: STAFF_FIREBASE_PRIMARY_AUTH_VERSION
    });

    return {
      ok: true,
      version: STAFF_FIREBASE_PRIMARY_AUTH_VERSION,
      firebaseUid: caller.firebaseUid,
      passwordLoginEnabled: true,
      mustChangePassword: markPasswordChanged ? false : caller.user.mustChangePassword === true,
      loginEmail: email
    };
  }
);
