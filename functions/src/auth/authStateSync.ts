import { FieldValue, type Firestore, type Timestamp as AdminTimestamp } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import type { UlimRole } from "../common/roles.js";
import { safeLegacyAuthUid } from "./legacySessionBridge.js";

interface TimestampCtor {
  now(): AdminTimestamp;
}

export interface AuthStateSyncInput {
  role: UlimRole;
  legacyUid: string;
  reason: "student_withdrawn" | "staff_disabled" | "role_changed" | "session_version_revoked";
  nextRole?: UlimRole;
}

export class AuthStateSyncAdapter {
  constructor(
    private readonly auth: Pick<Auth, "revokeRefreshTokens">,
    private readonly db: Firestore,
    private readonly timestamp: TimestampCtor
  ) {}

  async deactivateLegacyAccount(input: AuthStateSyncInput): Promise<{ firebaseUid: string; authVersion: number }> {
    validateAuthStateSyncInput(input);
    const firebaseUid = safeLegacyAuthUid(input.role, input.legacyUid);
    const docRef = this.db.collection("users").doc(firebaseUid);
    const result = await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      const current = snapshot.exists ? snapshot.data() : undefined;
      const currentVersion = typeof current?.authVersion === "number" && Number.isSafeInteger(current.authVersion)
        ? current.authVersion
        : 0;
      const authVersion = currentVersion + 1;
      if (!Number.isSafeInteger(authVersion)) throw new Error("next authVersion is invalid");
      transaction.set(docRef, {
        firebaseUid,
        role: input.role,
        studentUid: FieldValue.delete(),
        teacherUid: FieldValue.delete(),
        active: false,
        authVersion,
        source: "legacy_gas",
        disabledReason: input.reason,
        updatedAt: this.timestamp.now()
      }, { merge: true });
      return { firebaseUid, authVersion };
    });
    try {
      await this.auth.revokeRefreshTokens(firebaseUid);
    } catch (error) {
      if (!isAuthUserNotFound(error)) throw error;
    }
    return result;
  }

  async handleRoleChange(input: AuthStateSyncInput): Promise<{ disabledUid: string; nextUid?: string }> {
    validateAuthStateSyncInput({ ...input, reason: "role_changed" });
    if (input.nextRole !== undefined && !isAllowedRole(input.nextRole)) throw new Error("nextRole is not allowed");
    const disabled = await this.deactivateLegacyAccount({ ...input, reason: "role_changed" });
    if (!input.nextRole) return { disabledUid: disabled.firebaseUid };
    return {
      disabledUid: disabled.firebaseUid,
      nextUid: safeLegacyAuthUid(input.nextRole, input.legacyUid)
    };
  }
}

const allowedRoles: readonly UlimRole[] = ["student", "teacher", "admin", "superAdmin", "tablet"];
const allowedReasons: readonly AuthStateSyncInput["reason"][] = [
  "student_withdrawn",
  "staff_disabled",
  "role_changed",
  "session_version_revoked"
];

function validateAuthStateSyncInput(input: AuthStateSyncInput): void {
  if (!isAllowedRole(input.role)) throw new Error("role is not allowed");
  if (!allowedReasons.includes(input.reason)) throw new Error("reason is not allowed");
  if (typeof input.legacyUid !== "string" || !input.legacyUid.trim() || input.legacyUid.length > 128) {
    throw new Error("legacyUid is invalid");
  }
}

function isAllowedRole(value: unknown): value is UlimRole {
  return typeof value === "string" && allowedRoles.includes(value as UlimRole);
}

function isAuthUserNotFound(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && String((error as { code?: unknown }).code) === "auth/user-not-found";
}
