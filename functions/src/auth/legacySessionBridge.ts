import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { minimalCustomClaims, type UlimClaims, type UlimRole } from "../common/roles.js";

export const LEGACY_AUTH_AUDIENCE = "ulimvoice-firebase-auth";
export const LEGACY_AUTH_DEFAULT_TTL_MS = 90_000;
export const LEGACY_AUTH_MAX_TTL_MS = 120_000;
export const LEGACY_AUTH_FUTURE_SKEW_MS = 30_000;
export const LEGACY_AUTH_MAX_AUDIENCE_LENGTH = 128;
export const LEGACY_AUTH_MAX_UID_LENGTH = 128;
export const LEGACY_AUTH_ALLOWED_ROLES: readonly UlimRole[] = ["student", "teacher", "admin", "superAdmin", "tablet"];
export const UIDV2_PRINCIPAL_PATTERN = /^PRN2_[0-9A-HJKMNP-TV-Z]{26}$/;


const SEALED_SUPERADMIN_ADMIN_SAFE_UID =
  "legacy:admin:4ab445c8458b4c48da06b780e5beb42fcdea343ab8a4bf0f";

const SEALED_SUPERADMIN_SAFE_UID =
  "legacy:superAdmin:4ab445c8458b4c48da06b780e5beb42fcdea343ab8a4bf0f";

export interface NormalizedLegacyRole {
  proofRole: UlimRole;
  effectiveRole: UlimRole;
  effectiveSafeUid: string;
  normalized: boolean;
  source?: "sealed_superadmin_admin_proof_725";
}

export function normalizeLegacyRoleForSealedSuperAdmin(
  proofRole: UlimRole,
  proofSafeUid: string
): NormalizedLegacyRole {
  if (
    proofRole === "admin" &&
    proofSafeUid ===
      SEALED_SUPERADMIN_ADMIN_SAFE_UID
  ) {
    return {
      proofRole,
      effectiveRole:
        "superAdmin",
      effectiveSafeUid:
        SEALED_SUPERADMIN_SAFE_UID,
      normalized:
        true,
      source:
        "sealed_superadmin_admin_proof_725"
    };
  }

  return {
    proofRole,
    effectiveRole:
      proofRole,
    effectiveSafeUid:
      proofSafeUid,
    normalized:
      false
  };
}

export interface LegacyAuthProofPayload {
  v: 1 | 2;
  jti: string;
  aud: string;
  iat: number;
  exp: number;
  role: UlimRole;
  legacyUid: string;
  studentUid?: string;
  teacherUid?: string;
  displayName?: string;
  legacyAdminId?: string;
  firebaseUid?: string;
  principalUidV2?: string;
  accountState: "active";
}

export interface LegacySessionProof {
  nonceHash: string;
  jti?: string;
  aud: string;
  issuedAt: number;
  expiresAt: number;
  legacyUid: string;
  role: UlimRole;
  studentUid?: string;
  teacherUid?: string;
  displayName?: string;
  legacyAdminId?: string;
  firebaseUid?: string;
  principalUidV2?: string;
  accountState?: "active";
}

export interface ConsumedLegacyProof extends LegacySessionProof {
  consumedAt: number;
}

export interface AtomicLegacyProofVerifier {
  consumeValidProof(proof: string, options: LegacyProofValidationOptions): Promise<ConsumedLegacyProof>;
}

export interface LegacyProofValidationOptions {
  expectedAudience: string;
  now: number;
  maxTtlMs: number;
}

export interface LegacyAuthResolutionContext {
  signedCanonicalFirebaseUid?: string;
  signedPrincipalUidV2?: string;
  signedDisplayName?: string;
  signedLegacyAdminId?: string;
  sourceAccountActive: true;

  /*
   * safeLegacyFirebaseUid is derived from the signed proof role + legacyUid.
   * canonicalResolutionVerified is set only by FirebaseAdminAuthBridge after
   * the exact Firebase Auth user and its UIDv2 custom claims are verified.
   */
  safeLegacyFirebaseUid?: string;
  resolvedCanonicalFirebaseUid?: string;
  canonicalResolutionVerified?: boolean;
  canonicalResolutionSource?:
    | "signed_gas_proof_v2"
    | "sealed_superadmin_cutover_mapping";
}

export interface FirebaseAuthBridge {
  assertDirectoryAccount?(safeLegacyUid: string, claims: Omit<UlimClaims, "uid">): Promise<void>;
  findOrCreateUser(
    safeLegacyUid: string,
    context?: LegacyAuthResolutionContext,
    claims?: Omit<UlimClaims, "uid">
  ): Promise<{ uid: string }>;
  setCustomUserClaims(firebaseUid: string, claims: Omit<UlimClaims, "uid">): Promise<void>;
  createCustomToken(firebaseUid: string): Promise<string>;
  upsertUserAccessDocument?(
    firebaseUid: string,
    claims: Omit<UlimClaims, "uid">,
    context?: LegacyAuthResolutionContext
  ): Promise<{ active: boolean; authVersion: number | string }>;
}

export interface ExchangeLegacySessionInput {
  proof: string;
  expectedAudience: string;
  now?: number;
  maxTtlMs?: number;
}

export interface ExchangeLegacySessionResult {
  firebaseUid: string;
  customToken: string;
  claims: Omit<UlimClaims, "uid">;
  expiresInSeconds: number;
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function hmacSha256Base64Url(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("base64url");
}

function safeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function hashLegacyProof(proof: string): string {
  return createHash("sha256").update(proof, "utf8").digest("hex");
}

export function hashLegacyIdentifier(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function safeLegacyAuthUid(role: UlimRole, legacyUid: string): string {
  return `legacy:${role}:${createHash("sha256").update(legacyUid, "utf8").digest("hex").slice(0, 48)}`;
}

export function createLegacyAuthProof(payload: LegacyAuthProofPayload, secret: string): string {
  const signingInput = `v1.${base64UrlEncode(JSON.stringify(payload))}`;
  return `${signingInput}.${hmacSha256Base64Url(signingInput, secret)}`;
}

export function verifyLegacyAuthProof(rawProof: string, secret: string, options: LegacyProofValidationOptions): LegacySessionProof {
  if (!secret.trim()) throw new Error("legacy proof secret is not configured");
  const parts = rawProof.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("legacy proof format is invalid");

  const signingInput = `${parts[0]}.${parts[1]}`;
  const expectedSignature = hmacSha256Base64Url(signingInput, secret);
  if (!safeEqualText(expectedSignature, parts[2])) throw new Error("legacy proof signature is invalid");

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(base64UrlDecode(parts[1]).toString("utf8"));
  } catch {
    throw new Error("legacy proof payload is invalid");
  }
  const payload = parseLegacyAuthProofPayload(parsedPayload);

  const proof: LegacySessionProof = {
    nonceHash: hashLegacyIdentifier(payload.jti),
    jti: payload.jti,
    aud: payload.aud,
    issuedAt: payload.iat * 1000,
    expiresAt: payload.exp * 1000,
    legacyUid: payload.legacyUid,
    role: payload.role,
    studentUid: payload.studentUid,
    teacherUid: payload.teacherUid,
    displayName: payload.displayName,
    legacyAdminId: payload.legacyAdminId,
    firebaseUid: payload.firebaseUid,
    principalUidV2: payload.principalUidV2,
    accountState: payload.accountState
  };
  validateLegacyProof(proof, options);
  return proof;
}

export function validateLegacyProof(proof: LegacySessionProof, options: LegacyProofValidationOptions): void {
  if (proof.aud !== options.expectedAudience) throw new Error("legacy proof audience mismatch");
  if (proof.issuedAt > options.now + LEGACY_AUTH_FUTURE_SKEW_MS) throw new Error("legacy proof issued in the future");
  if (proof.expiresAt <= options.now) throw new Error("legacy proof expired");
  if (proof.expiresAt <= proof.issuedAt) throw new Error("legacy proof exp must be after iat");
  if (proof.expiresAt - proof.issuedAt > options.maxTtlMs) throw new Error("legacy proof ttl exceeds maximum");
  if (proof.accountState && proof.accountState !== "active") throw new Error("legacy proof account is inactive");
  if (proof.role === "student" && !proof.studentUid) throw new Error("student proof requires studentUid");
  if (proof.role === "teacher" && !proof.teacherUid) throw new Error("teacher proof requires teacherUid");
  if (proof.role === "tablet") throw new Error("tablet proof exchange is not implemented");
}

function parseLegacyAuthProofPayload(value: unknown): LegacyAuthProofPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("legacy proof payload is invalid");
  const payload = value as Record<string, unknown>;
  const version = requiredSafeInteger(payload.v, "version");
  if (version !== 1 && version !== 2) throw new Error("legacy proof version is invalid");

  const jti = requiredString(payload.jti, "jti", 64);
  if (!/^[a-f0-9]{64}$/i.test(jti)) throw new Error("legacy proof jti is invalid");
  const aud = requiredString(payload.aud, "audience", LEGACY_AUTH_MAX_AUDIENCE_LENGTH);
  const role = requiredRole(payload.role);
  const legacyUid = requiredString(payload.legacyUid, "legacyUid", LEGACY_AUTH_MAX_UID_LENGTH);
  const studentUid = optionalString(payload.studentUid, "studentUid", LEGACY_AUTH_MAX_UID_LENGTH);
  const teacherUid = optionalString(payload.teacherUid, "teacherUid", LEGACY_AUTH_MAX_UID_LENGTH);
  const displayName = optionalString(payload.displayName, "displayName", 120);
  const legacyAdminId = optionalString(payload.legacyAdminId, "legacyAdminId", 100);
  const firebaseUid = optionalString(payload.firebaseUid, "firebaseUid", LEGACY_AUTH_MAX_UID_LENGTH);
  const principalUidV2 = optionalString(payload.principalUidV2, "principalUidV2", LEGACY_AUTH_MAX_UID_LENGTH);
  const iat = requiredSafeInteger(payload.iat, "iat");
  const exp = requiredSafeInteger(payload.exp, "exp");

  if (payload.accountState !== "active") throw new Error("legacy proof account is inactive");
  if (exp <= iat) throw new Error("legacy proof exp must be after iat");
  if (role === "student" && !studentUid) throw new Error("student proof requires studentUid");
  if (role === "student" && teacherUid) throw new Error("student proof must not include teacherUid");
  if (role === "teacher" && !teacherUid) throw new Error("teacher proof requires teacherUid");
  if (role === "teacher" && studentUid) throw new Error("teacher proof must not include studentUid");
  if ((role === "admin" || role === "superAdmin") && (studentUid || teacherUid)) {
    throw new Error("admin proof must not include studentUid or teacherUid");
  }
  if (role === "tablet") throw new Error("tablet proof exchange is not implemented");

  if (version === 1 && (firebaseUid || principalUidV2)) {
    throw new Error("legacy proof v1 must not include canonical uid fields");
  }

  if (firebaseUid || principalUidV2) {
    if (!firebaseUid || !principalUidV2) {
      throw new Error("canonical firebase uid and principalUidV2 must be provided together");
    }
    if (firebaseUid !== principalUidV2) {
      throw new Error("canonical firebase uid conflicts with principalUidV2");
    }
    if (!UIDV2_PRINCIPAL_PATTERN.test(firebaseUid)) {
      throw new Error("canonical firebase uid is invalid");
    }
    if (role === "student") {
      throw new Error("student proof must not include principal canonical uid");
    }
  }

  return {
    v: version,
    jti,
    aud,
    iat,
    exp,
    role,
    legacyUid,
    studentUid,
    teacherUid,
    displayName,
    legacyAdminId,
    firebaseUid,
    principalUidV2,
    accountState: "active"
  };
}

function requiredString(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`legacy proof ${fieldName} must be a string`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) throw new Error(`legacy proof ${fieldName} is invalid`);
  return trimmed;
}

function optionalString(value: unknown, fieldName: string, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, fieldName, maxLength);
}

function requiredSafeInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`legacy proof ${fieldName} must be an integer`);
  return value;
}

function requiredRole(value: unknown): UlimRole {
  if (typeof value !== "string" || !LEGACY_AUTH_ALLOWED_ROLES.includes(value as UlimRole)) {
    throw new Error("legacy proof role is invalid");
  }
  return value as UlimRole;
}

export class InMemoryAtomicLegacyProofStore implements AtomicLegacyProofVerifier {
  private readonly proofs = new Map<string, LegacySessionProof>();
  private readonly consumed = new Set<string>();

  addProof(rawProof: string, proof: Omit<LegacySessionProof, "nonceHash">): void {
    this.proofs.set(hashLegacyProof(rawProof), { ...proof, nonceHash: hashLegacyProof(rawProof) });
  }

  async consumeValidProof(rawProof: string, options: LegacyProofValidationOptions): Promise<ConsumedLegacyProof> {
    const nonceHash = hashLegacyProof(rawProof);
    if (this.consumed.has(nonceHash)) throw new Error("legacy proof already consumed");
    const proof = this.proofs.get(nonceHash);
    if (!proof) throw new Error("legacy proof not found");
    validateLegacyProof(proof, options);
    this.consumed.add(nonceHash);
    this.proofs.delete(nonceHash);
    return { ...proof, consumedAt: options.now };
  }
}

export async function exchangeLegacySession(
  input: ExchangeLegacySessionInput,
  verifier: AtomicLegacyProofVerifier,
  auth: FirebaseAuthBridge
): Promise<ExchangeLegacySessionResult> {
  if (!input.proof || !input.proof.trim()) throw new Error("legacy proof is required");
  const now = input.now ?? Date.now();
  const verified = await verifier.consumeValidProof(input.proof, {
    expectedAudience: input.expectedAudience,
    now,
    maxTtlMs: input.maxTtlMs ?? LEGACY_AUTH_MAX_TTL_MS
  });

  const proofSafeUid =
    safeLegacyAuthUid(
      verified.role,
      verified.legacyUid
    );

  const normalizedRole =
    normalizeLegacyRoleForSealedSuperAdmin(
      verified.role,
      proofSafeUid
    );

  const safeUid =
    normalizedRole.effectiveSafeUid;

  const effectiveRole =
    normalizedRole.effectiveRole;

  if (normalizedRole.normalized) {
    console.warn(
      "[ULIM auth bridge 7.25 proof role normalization]",
      {
        proofRole:
          normalizedRole.proofRole,
        effectiveRole,
        proofSafeUid,
        effectiveSafeUid:
          safeUid,
        source:
          normalizedRole.source || ""
      }
    );
  }

  const baseClaims =
    minimalCustomClaims({
      uid:
        safeUid,
      role:
        effectiveRole,
      studentUid:
        verified.studentUid,
      teacherUid:
        verified.teacherUid
    });

  const resolutionContext:
    LegacyAuthResolutionContext = {
      signedCanonicalFirebaseUid:
        verified.firebaseUid,
      signedPrincipalUidV2:
        verified.principalUidV2,
      signedDisplayName:
        verified.displayName,
      signedLegacyAdminId:
        verified.legacyAdminId,
      sourceAccountActive:
        true,
      safeLegacyFirebaseUid:
        safeUid
    };
  if (auth.assertDirectoryAccount) await auth.assertDirectoryAccount(safeUid, baseClaims);
  const user = await auth.findOrCreateUser(safeUid, resolutionContext, baseClaims);

  const access = auth.upsertUserAccessDocument
    ? await auth.upsertUserAccessDocument(user.uid, baseClaims, resolutionContext)
    : { active: true, authVersion: 1 };
  if (access.active !== true) throw new Error("legacy firebase user is inactive");

  const claims = minimalCustomClaims({
    uid: user.uid,
    ...baseClaims,
    authVersion: access.authVersion
  });
  await auth.setCustomUserClaims(user.uid, claims);

  try {
    return {
      firebaseUid: user.uid,
      customToken: await auth.createCustomToken(user.uid),
      claims,
      expiresInSeconds: Math.max(0, Math.floor((verified.expiresAt - now) / 1000))
    };
  } catch (error) {
    throw new Error(`custom token creation failed after proof consumption; client may request one fresh proof retry: ${error instanceof Error ? error.message : String(error)}`);
  }
}
