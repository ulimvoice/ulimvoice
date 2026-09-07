import { createHash } from "node:crypto";
import type { Auth } from "firebase-admin/auth";
import { FieldValue, type Firestore, type Timestamp as AdminTimestamp } from "firebase-admin/firestore";
import type { FirebaseAuthBridge, LegacyAuthResolutionContext } from "./legacySessionBridge.js";
import type { UlimClaims, UlimRole } from "../common/roles.js";

interface TimestampCtor {
  now(): AdminTimestamp;
}


const UIDV2_CUTOVER_RUN_ID =
  "phase4c1r-20260727-ae7ef666-46a4-4ba2-b9a0-32c3326cfaca";

const UIDV2_AUTH_TRANSITION_COLLECTION =
  "rebaseFanoutAuthTransitions";


const UIDV2_CUTOVER_EXECUTION_COLLECTION =
  "rebaseProductionCutoverExecutions";

const UIDV2_CUTOVER_EXECUTION_DOCUMENT =
  "phase4c30b-a-71688";

const UIDV2_SUPERADMIN_FIREBASE_UID =
  "PRN2_01KY8PQY00FHMEBRWGJBR1EQJT";

const UIDV2_LEGACY_SUPERADMIN_FIREBASE_UID =
  "legacy:superAdmin:4ab445c8458b4c48da06b780e5beb42fcdea343ab8a4bf0f";

const UIDV2_SUPERADMIN_CUTOVER_EXECUTION_ID =
  "phase4c30b-a-ms4yhg3i-b6b58d155a6b9bfe53bcd12c";

const UIDV2_ACCESS_REPAIR_VERSION =
  "2026-07-31.731.07";

function uidV2AuthTransitionDocumentId(legacyFirebaseUid: string): string {
  return createHash("sha256")
    .update(`authTransition:${legacyFirebaseUid}`, "utf8")
    .digest("hex")
    .slice(0, 40);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}


function normalizeStoredUlimRole(
  value: unknown
): UlimRole | "" {
  const raw =
    stringValue(value);

  const compact =
    raw
      .normalize("NFC")
      .replace(/\s+/g, "")
      .toLowerCase();

  if (
    compact === "superadmin" ||
    compact === "fulladmin" ||
    compact === "전체관리자" ||
    compact === "전체관리" ||
    compact === "원장"
  ) {
    return "superAdmin";
  }

  if (
    compact === "admin" ||
    compact === "관리자"
  ) {
    return "admin";
  }

  if (
    compact === "teacher" ||
    compact === "강사" ||
    compact === "교사"
  ) {
    return "teacher";
  }

  if (
    compact === "student" ||
    compact === "학생"
  ) {
    return "student";
  }

  return "";
}

export class FirebaseAdminAuthBridge implements FirebaseAuthBridge {
  constructor(
    private readonly auth: Auth,
    private readonly db: Firestore,
    private readonly timestamp: TimestampCtor,
    private readonly requireDirectoryAccount = false
  ) {}

  async assertDirectoryAccount(firebaseUid: string, claims: Omit<UlimClaims, "uid">): Promise<void> {
    if (!this.requireDirectoryAccount) return;
    const snapshot = await this.db.collection("legacyAccounts").doc(firebaseUid).get();
    if (!snapshot.exists) {
      // A signed GAS proof already proves that the legacy staff session is active.
      // Some pre-UIDv2 teacher/test accounts were intentionally excluded from the
      // principal directory rollout. Permit only the teacher role in that narrow
      // case; admin/student accounts still require their directory record.
      if (claims.role === "teacher" && claims.teacherUid) {
        console.warn("[ULIM auth bridge 7.31.7 legacy teacher directory fallback]", {
          firebaseUid,
          teacherUid: claims.teacherUid
        });
        return;
      }
      throw new Error("legacy directory account not found");
    }
    const account = snapshot.data();
    if (account?.active !== true) throw new Error("legacy directory account is inactive");
    if (account?.role !== claims.role) throw new Error("legacy directory account role conflicts with proof role");
    if (claims.role === "student") {
      if (account?.studentUid !== claims.studentUid || account?.teacherUid !== undefined) {
        throw new Error("legacy directory account studentUid conflicts with proof studentUid");
      }
      return;
    }
    if (claims.role === "teacher") {
      if (account?.teacherUid !== claims.teacherUid || account?.studentUid !== undefined) {
        throw new Error("legacy directory account teacherUid conflicts with proof teacherUid");
      }
      return;
    }
    if (account?.studentUid !== undefined || account?.teacherUid !== undefined) {
      throw new Error("legacy directory admin account contains stale role uid fields");
    }
  }

  private verifyCanonicalUidV2User(
    user: Awaited<ReturnType<Auth["getUser"]>>,
    expectedUid: string,
    expectedRole: string | undefined
  ): void {
    if (user.uid !== expectedUid) {
      throw new Error("canonical firebase user uid mismatch");
    }
    if (user.disabled) {
      throw new Error("canonical firebase user is disabled");
    }

    const canonicalClaims = user.customClaims || {};

    if (
      expectedRole &&
      stringValue(canonicalClaims.role) !== expectedRole
    ) {
      throw new Error(
        "canonical firebase user role conflicts with proof role"
      );
    }

    if (
      stringValue(canonicalClaims.principalUidV2) !==
      expectedUid
    ) {
      throw new Error(
        "canonical firebase user principal claim mismatch"
      );
    }

    if (
      stringValue(canonicalClaims.authVersion) !==
      "uidv2"
    ) {
      throw new Error(
        "canonical firebase user authVersion is invalid"
      );
    }

    if (
      expectedUid === UIDV2_SUPERADMIN_FIREBASE_UID &&
      stringValue(
        canonicalClaims.uidV2CutoverExecutionId
      ) !== UIDV2_SUPERADMIN_CUTOVER_EXECUTION_ID
    ) {
      throw new Error(
        "canonical firebase user cutover execution claim mismatch"
      );
    }
  }

  private markCanonicalResolution(
    context: LegacyAuthResolutionContext | undefined,
    firebaseUid: string,
    source:
      | "signed_gas_proof_v2"
      | "sealed_superadmin_cutover_mapping"
  ): void {
    if (!context) return;

    context.resolvedCanonicalFirebaseUid =
      firebaseUid;
    context.canonicalResolutionVerified =
      true;
    context.canonicalResolutionSource =
      source;
  }

  async findOrCreateUser(
    safeLegacyUid: string,
    context?: LegacyAuthResolutionContext,
    claims?: Omit<UlimClaims, "uid">
  ): Promise<{ uid: string }> {
    const signedCanonicalUid = stringValue(
      context?.signedCanonicalFirebaseUid
    );
    const signedPrincipalUidV2 = stringValue(
      context?.signedPrincipalUidV2
    );

    if (signedCanonicalUid || signedPrincipalUidV2) {
      if (
        !signedCanonicalUid ||
        !signedPrincipalUidV2 ||
        signedCanonicalUid !== signedPrincipalUidV2
      ) {
        throw new Error(
          "signed canonical firebase uid conflicts with principalUidV2"
        );
      }

      const canonicalUser =
        await this.auth.getUser(
          signedCanonicalUid
        );

      this.verifyCanonicalUidV2User(
        canonicalUser,
        signedCanonicalUid,
        claims?.role
      );

      this.markCanonicalResolution(
        context,
        canonicalUser.uid,
        "signed_gas_proof_v2"
      );

      console.info(
        "[ULIM auth bridge 7.23 canonical]",
        {
          firebaseUid:
            canonicalUser.uid,
          role:
            claims?.role || "",
          source:
            "signed_gas_proof_v2"
        }
      );

      return {
        uid:
          canonicalUser.uid
      };
    }

    /*
     * Deterministic production mapping for the one sealed superAdmin Cutover.
     *
     * This branch makes the login independent from:
     * - whether the GAS administrator row exposes the new UIDv2 columns;
     * - whether a cached/persistent admin session contains those fields;
     * - identity_directory or staging-document shape;
     * - proof v1 versus proof v2.
     *
     * It is reachable only after a valid HMAC proof produced an exact
     * safeLegacyUid for the exact superAdmin role.
     */
    if (
      safeLegacyUid ===
        UIDV2_LEGACY_SUPERADMIN_FIREBASE_UID &&
      claims?.role ===
        "superAdmin"
    ) {
      const canonicalUser =
        await this.auth.getUser(
          UIDV2_SUPERADMIN_FIREBASE_UID
        );

      this.verifyCanonicalUidV2User(
        canonicalUser,
        UIDV2_SUPERADMIN_FIREBASE_UID,
        "superAdmin"
      );

      this.markCanonicalResolution(
        context,
        canonicalUser.uid,
        "sealed_superadmin_cutover_mapping"
      );

      console.warn(
        "[ULIM auth bridge 7.23 sealed mapping]",
        {
          legacyFirebaseUid:
            safeLegacyUid,
          firebaseUid:
            canonicalUser.uid,
          role:
            "superAdmin",
          executionId:
            UIDV2_SUPERADMIN_CUTOVER_EXECUTION_ID
        }
      );

      return {
        uid:
          canonicalUser.uid
      };
    }

    const legacyUser = await this.getUserIfExists(safeLegacyUid);
    const canonicalUid = await this.resolveCanonicalUidV2(
      safeLegacyUid,
      legacyUser?.customClaims
    );

    if (canonicalUid) {
      const canonicalUser =
        await this.auth.getUser(
          canonicalUid
        );

      this.verifyCanonicalUidV2User(
        canonicalUser,
        canonicalUid,
        claims?.role
      );

      return {
        uid:
          canonicalUser.uid
      };
    }

    if (legacyUser) {
      if (legacyUser.disabled) {
        throw new Error(
          "legacy firebase user is disabled and no uidv2 alias was resolved"
        );
      }
      return { uid: legacyUser.uid };
    }

    try {
      const created = await this.auth.createUser({
        uid: safeLegacyUid,
        disabled: false
      });
      return { uid: created.uid };
    } catch (createError) {
      if (!isAuthUidAlreadyExists(createError)) throw createError;
      const user = await this.auth.getUser(safeLegacyUid);
      if (user.disabled) {
        throw new Error(
          "legacy firebase user is disabled and no uidv2 alias was resolved"
        );
      }
      return { uid: user.uid };
    }
  }

  private async getUserIfExists(
    firebaseUid: string
  ): Promise<Awaited<ReturnType<Auth["getUser"]>> | undefined> {
    try {
      return await this.auth.getUser(firebaseUid);
    } catch (error) {
      if (isAuthUserNotFound(error)) return undefined;
      throw error;
    }
  }

  private async resolveCanonicalUidV2(
    safeLegacyUid: string,
    legacyClaims: Readonly<Record<string, unknown>> | undefined
  ): Promise<string | undefined> {
    /*
     * Resolution order:
     * 1. identity_directory alias
     * 2. principalUidV2 already present in legacy custom claims
     * 3. sealed Phase 4C Firebase Auth transition record
     */
    const directAlias = await this.db
      .collection("identity_directory")
      .doc(safeLegacyUid)
      .get();

    if (directAlias.exists) {
      const alias = directAlias.data();
      const aliasUid = stringValue(alias?.aliasUid || safeLegacyUid);
      const canonicalUid = stringValue(alias?.canonicalUid);

      if (aliasUid && aliasUid !== safeLegacyUid) {
        throw new Error("uidv2 identity alias source uid mismatch");
      }
      if (!canonicalUid || canonicalUid.length > 128) {
        throw new Error("uidv2 identity alias canonicalUid is invalid");
      }
      if (canonicalUid === safeLegacyUid) {
        throw new Error("uidv2 identity alias must point to a different uid");
      }
      return canonicalUid;
    }

    const claimedPrincipalUidV2 = stringValue(
      legacyClaims?.principalUidV2
    );

    if (claimedPrincipalUidV2) {
      if (claimedPrincipalUidV2.length > 128) {
        throw new Error("legacy principalUidV2 claim is invalid");
      }
      if (claimedPrincipalUidV2 === safeLegacyUid) {
        throw new Error("legacy principalUidV2 claim points to legacy uid");
      }
      return claimedPrincipalUidV2;
    }

    const transitionDocumentId =
      uidV2AuthTransitionDocumentId(safeLegacyUid);

    const transitionSnapshot = await this.db
      .collection("uidV2StagingRuns")
      .doc(UIDV2_CUTOVER_RUN_ID)
      .collection(UIDV2_AUTH_TRANSITION_COLLECTION)
      .doc(transitionDocumentId)
      .get();

    if (!transitionSnapshot.exists) {
      return undefined;
    }

    const wrapper = transitionSnapshot.data();
    const transition =
      wrapper?.data &&
      typeof wrapper.data === "object" &&
      !Array.isArray(wrapper.data)
        ? wrapper.data as Record<string, unknown>
        : undefined;

    const oldFirebaseUid = stringValue(
      transition?.oldFirebaseUid
    );
    const newFirebaseUid = stringValue(
      transition?.newFirebaseUid
    );

    if (oldFirebaseUid !== safeLegacyUid) {
      throw new Error("uidv2 auth transition source uid mismatch");
    }
    if (!newFirebaseUid || newFirebaseUid.length > 128) {
      throw new Error("uidv2 auth transition target uid is invalid");
    }
    if (newFirebaseUid === safeLegacyUid) {
      throw new Error("uidv2 auth transition target equals legacy uid");
    }

    return newFirebaseUid;
  }

  async upsertUserAccessDocument(
    firebaseUid: string,
    claims: Omit<UlimClaims, "uid">,
    context?: LegacyAuthResolutionContext
  ): Promise<{
    active: boolean;
    authVersion: number | string;
  }> {
    const docRef =
      this.db
        .collection("users")
        .doc(firebaseUid);

    const verifiedCanonicalResolution =
      context?.sourceAccountActive === true &&
      context?.canonicalResolutionVerified === true &&
      stringValue(
        context?.resolvedCanonicalFirebaseUid
      ) === firebaseUid &&
      (
        (
          context?.canonicalResolutionSource ===
            "signed_gas_proof_v2" &&
          stringValue(
            context?.signedCanonicalFirebaseUid
          ) === firebaseUid &&
          stringValue(
            context?.signedPrincipalUidV2
          ) === firebaseUid
        ) ||
        (
          context?.canonicalResolutionSource ===
            "sealed_superadmin_cutover_mapping" &&
          stringValue(
            context?.safeLegacyFirebaseUid
          ) ===
            UIDV2_LEGACY_SUPERADMIN_FIREBASE_UID &&
          firebaseUid ===
            UIDV2_SUPERADMIN_FIREBASE_UID &&
          claims.role ===
            "superAdmin"
        )
      );

    const authUser = await this.auth.getUser(firebaseUid);
    if (authUser.disabled) {
      throw new Error("firebase user is disabled");
    }

    const authClaims = authUser.customClaims || {};
    const authClaimVersion = authClaims.authVersion;

    return this.db.runTransaction(async transaction => {
      const snapshot = await transaction.get(docRef);
      const current = snapshot.exists ? snapshot.data() : undefined;

      const currentRoleRaw =
        stringValue(
          current?.role
        );

      const currentRole =
        normalizeStoredUlimRole(
          current?.role
        );

      const authRole =
        normalizeStoredUlimRole(
          authClaims.role
        );

      /*
       * The migrated superAdmin users document can contain the localized
       * role label "전체관리자". It is semantically identical to
       * "superAdmin" but must be rewritten to the canonical enum so future
       * Security Rules and server checks remain deterministic.
       */
      const exactSuperAdminRoleAlignment =
        verifiedCanonicalResolution &&
        firebaseUid ===
          UIDV2_SUPERADMIN_FIREBASE_UID &&
        claims.role ===
          "superAdmin" &&
        authRole ===
          "superAdmin" &&
        (
          !currentRoleRaw ||
          currentRole ===
            "admin" ||
          currentRole ===
            "superAdmin"
        );

      if (
        currentRoleRaw &&
        currentRole !==
          claims.role &&
        !exactSuperAdminRoleAlignment
      ) {
        console.error(
          "[ULIM auth bridge 7.26 role mismatch]",
          {
            firebaseUid,
            proofRole:
              claims.role,
            authRole,
            firestoreRoleRaw:
              currentRoleRaw,
            firestoreRoleCanonical:
              currentRole,
            canonicalSource:
              context?.canonicalResolutionSource ||
              ""
          }
        );

        throw new Error(
          "existing user role conflicts with proof role"
        );
      }
      if (conflicts(current?.studentUid, claims.studentUid)) {
        throw new Error("existing user studentUid conflicts with proof studentUid");
      }
      if (conflicts(current?.teacherUid, claims.teacherUid)) {
        throw new Error("existing user teacherUid conflicts with proof teacherUid");
      }

      let authVersion: number | string;
      if (
        typeof authClaimVersion === "string" &&
        authClaimVersion.trim()
      ) {
        authVersion = authClaimVersion.trim();
      } else if (
        typeof authClaimVersion === "number" &&
        Number.isSafeInteger(authClaimVersion) &&
        authClaimVersion >= 1
      ) {
        authVersion = authClaimVersion;
      } else if (
        typeof current?.authVersion === "string" &&
        current.authVersion.trim()
      ) {
        authVersion = current.authVersion.trim();
      } else if (
        typeof current?.authVersion === "number" &&
        Number.isSafeInteger(current.authVersion) &&
        current.authVersion >= 1
      ) {
        authVersion = current.authVersion;
      } else {
        authVersion = verifiedCanonicalResolution ? "uidv2" : 1;
      }

      /*
       * A fresh signed GAS proof is the current account-status source of truth.
       * Only an explicitly signed canonical UID may repair a stale active:false
       * document. Legacy/fallback identities keep the previous inactive gate.
       */
      if (current?.active === false && !verifiedCanonicalResolution) {
        return { active: false, authVersion };
      }

      const now = this.timestamp.now();
      const repaired =
        current?.active !== true &&
        verifiedCanonicalResolution;

      const roleRepaired =
        exactSuperAdminRoleAlignment &&
        currentRoleRaw !==
          "superAdmin";

      transaction.set(
        docRef,
        removeUndefined({
          firebaseUid,
          role: claims.role,
          studentUid:
            claims.role === "student"
              ? claims.studentUid
              : FieldValue.delete(),
          teacherUid:
            claims.role === "teacher"
              ? claims.teacherUid
              : FieldValue.delete(),
          name:
            stringValue(context?.signedDisplayName) ||
            stringValue(current?.name) ||
            undefined,
          displayName:
            stringValue(context?.signedDisplayName) ||
            stringValue(current?.displayName) ||
            undefined,
          teacherName:
            claims.role === "teacher"
              ? (
                  stringValue(context?.signedDisplayName) ||
                  stringValue(current?.teacherName) ||
                  undefined
                )
              : undefined,
          adminId:
            stringValue(context?.signedLegacyAdminId) ||
            stringValue(current?.adminId) ||
            undefined,
          legacyAdminId:
            stringValue(context?.signedLegacyAdminId) ||
            stringValue(current?.legacyAdminId) ||
            undefined,
          active: true,
          authVersion,
          source:
            roleRepaired
              ? "superadmin_role_alignment_726"
              : (
                  repaired
                    ? (
                        context?.canonicalResolutionSource ===
                          "sealed_superadmin_cutover_mapping"
                          ? "sealed_superadmin_cutover_mapping_724_repair"
                          : "signed_gas_canonical_proof_v2_724_repair"
                      )
                    : "legacy_gas"
                ),
          roleAlignmentVersion:
            roleRepaired
              ? "2026-07-29.726.01"
              : undefined,
          roleAlignedAt:
            roleRepaired
              ? now
              : undefined,
          canonicalProofVersion:
            context?.canonicalResolutionSource ===
              "signed_gas_proof_v2"
              ? 2
              : undefined,
          canonicalResolutionSource:
            verifiedCanonicalResolution
              ? context?.canonicalResolutionSource
              : undefined,
          canonicalAccessRepairedAt: repaired ? now : undefined,
          updatedAt: now
        }),
        { merge: true }
      );

      if (repaired || roleRepaired) {
        console.warn(
          "[ULIM auth bridge 7.26 access alignment]",
          {
            firebaseUid,
            proofRole:
              claims.role,
            authRole,
            previousFirestoreRole:
              currentRoleRaw,
            previousFirestoreRoleCanonical:
              currentRole,
            resultingRole:
              claims.role,
            activeRepaired:
              repaired,
            roleRepaired,
            authVersion,
            source:
              context?.canonicalResolutionSource ||
              ""
          }
        );
      }

      return { active: true, authVersion };
    });
  }

  async setCustomUserClaims(firebaseUid: string, claims: Omit<UlimClaims, "uid">): Promise<void> {
    /*
     * Preserve UIDv2 Cutover claims such as principalUidV2 and
     * uidV2CutoverExecutionId. The legacy bridge only refreshes its scoped
     * role/authVersion fields.
     */
    const currentUser = await this.auth.getUser(firebaseUid);
    const mergedClaims = {
      ...(currentUser.customClaims || {}),
      ...removeUndefined(claims)
    };
    await this.auth.setCustomUserClaims(firebaseUid, mergedClaims);
  }

  async createCustomToken(firebaseUid: string): Promise<string> {
    return this.auth.createCustomToken(firebaseUid);
  }
}

function isAuthUserNotFound(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && String((error as { code?: unknown }).code) === "auth/user-not-found";
}

function isAuthUidAlreadyExists(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && String((error as { code?: unknown }).code) === "auth/uid-already-exists";
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function conflicts(existing: unknown, incoming: unknown): boolean {
  return existing !== undefined && incoming !== undefined && existing !== incoming;
}
