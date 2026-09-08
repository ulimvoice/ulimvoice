import test from "node:test";
import assert from "node:assert/strict";
import {
  createLegacyAuthProof,
  exchangeLegacySession,
  normalizeLegacyRoleForSealedSuperAdmin,
  verifyLegacyAuthProof,
  type AtomicLegacyProofVerifier,
  type ConsumedLegacyProof,
  type FirebaseAuthBridge,
  type LegacyAuthResolutionContext
} from "../src/auth/legacySessionBridge.js";
import { FirebaseAdminAuthBridge } from "../src/auth/firebaseAdminAuthBridge.js";

const SECRET = "test-secret-722";
const NOW = 1_800_000_000_000;
const CANONICAL = "PRN2_01KY8PQY00FHMEBRWGJBR1EQJT";

function payloadV2() {
  return {
    v: 2 as const,
    jti: "a".repeat(64),
    aud: "ulimvoice-firebase-auth",
    iat: Math.floor(NOW / 1000),
    exp: Math.floor(NOW / 1000) + 90,
    role: "superAdmin" as const,
    legacyUid: "ADM-20260601-1234ABCD",
    firebaseUid: CANONICAL,
    principalUidV2: CANONICAL,
    accountState: "active" as const
  };
}

test("v2 proof preserves signed canonical uid", () => {
  const proof = createLegacyAuthProof(payloadV2(), SECRET);
  const verified = verifyLegacyAuthProof(proof, SECRET, {
    expectedAudience: "ulimvoice-firebase-auth",
    now: NOW,
    maxTtlMs: 120_000
  });
  assert.equal(verified.firebaseUid, CANONICAL);
  assert.equal(verified.principalUidV2, CANONICAL);
});

test("v2 proof rejects mismatched canonical identifiers", () => {
  const bad = payloadV2();
  bad.principalUidV2 = "PRN2_01KY8PQY00S72C95FQYTFZ7XHJ";
  const proof = createLegacyAuthProof(bad, SECRET);
  assert.throws(() => verifyLegacyAuthProof(proof, SECRET, {
    expectedAudience: "ulimvoice-firebase-auth",
    now: NOW,
    maxTtlMs: 120_000
  }), /conflicts/);
});

test("exchange passes signed canonical context to auth bridge", async () => {
  const proof = createLegacyAuthProof(payloadV2(), SECRET);
  const verified = verifyLegacyAuthProof(proof, SECRET, {
    expectedAudience: "ulimvoice-firebase-auth",
    now: NOW,
    maxTtlMs: 120_000
  });
  const verifier: AtomicLegacyProofVerifier = {
    async consumeValidProof(): Promise<ConsumedLegacyProof> {
      return { ...verified, consumedAt: NOW };
    }
  };
  let findContext: LegacyAuthResolutionContext | undefined;
  let upsertContext: LegacyAuthResolutionContext | undefined;
  const auth: FirebaseAuthBridge = {
    async findOrCreateUser(_safe, context) {
      findContext = context;
      return { uid: CANONICAL };
    },
    async upsertUserAccessDocument(_uid, _claims, context) {
      upsertContext = context;
      return { active: true, authVersion: "uidv2" };
    },
    async setCustomUserClaims() {},
    async createCustomToken(uid) { return `token:${uid}`; }
  };
  const result = await exchangeLegacySession({
    proof,
    expectedAudience: "ulimvoice-firebase-auth",
    now: NOW,
    maxTtlMs: 120_000
  }, verifier, auth);
  assert.equal(result.firebaseUid, CANONICAL);
  assert.equal(findContext?.signedCanonicalFirebaseUid, CANONICAL);
  assert.equal(upsertContext?.signedPrincipalUidV2, CANONICAL);
});

test("canonical signed proof repairs stale access document", async () => {
  const documents = new Map<string, Record<string, unknown>>([
    [`users/${CANONICAL}`, { role: "superAdmin", active: false, authVersion: "uidv2" }]
  ]);
  const auth = {
    async getUser(uid: string) {
      assert.equal(uid, CANONICAL);
      return {
        uid,
        disabled: false,
        customClaims: {
          role: "superAdmin",
          authVersion: "uidv2",
          principalUidV2: CANONICAL,
          uidV2CutoverExecutionId:
            "phase4c30b-a-ms4yhg3i-b6b58d155a6b9bfe53bcd12c"
        }
      };
    },
    async createUser() { throw new Error("not used"); },
    async setCustomUserClaims() {},
    async createCustomToken() { return "token"; }
  };
  const db = {
    collection(name: string) {
      return {
        doc(id: string) { return { path: `${name}/${id}` }; }
      };
    },
    async runTransaction(callback: (tx: any) => Promise<any>) {
      const tx = {
        async get(ref: { path: string }) {
          const value = documents.get(ref.path);
          return { exists: value !== undefined, data: () => value };
        },
        set(ref: { path: string }, value: Record<string, unknown>) {
          const previous = documents.get(ref.path) || {};
          documents.set(ref.path, { ...previous, ...value });
        }
      };
      return callback(tx);
    }
  };
  const timestamp = { now: () => ({ seconds: 1 }) };
  const bridge = new FirebaseAdminAuthBridge(auth as any, db as any, timestamp as any, false);
  const context: LegacyAuthResolutionContext = {
    signedCanonicalFirebaseUid: CANONICAL,
    signedPrincipalUidV2: CANONICAL,
    sourceAccountActive: true
  };
  const user = await bridge.findOrCreateUser("legacy:any", context, { role: "superAdmin" });
  assert.equal(user.uid, CANONICAL);
  const access = await bridge.upsertUserAccessDocument(CANONICAL, { role: "superAdmin" }, context);
  assert.equal(access.active, true);
  assert.equal(documents.get(`users/${CANONICAL}`)?.active, true);
  assert.equal(documents.get(`users/${CANONICAL}`)?.source, "signed_gas_canonical_proof_v2_724_repair");
});


test("sealed superAdmin legacy mapping repairs stale access without proof v2 fields", async () => {
  const LEGACY_SAFE =
    "legacy:superAdmin:4ab445c8458b4c48da06b780e5beb42fcdea343ab8a4bf0f";

  const documents = new Map<string, Record<string, unknown>>([
    [
      `users/${CANONICAL}`,
      {
        role: "superAdmin",
        active: false,
        authVersion: "uidv2"
      }
    ]
  ]);

  const auth = {
    async getUser(uid: string) {
      assert.equal(uid, CANONICAL);
      return {
        uid,
        disabled: false,
        customClaims: {
          role: "superAdmin",
          authVersion: "uidv2",
          principalUidV2: CANONICAL,
          uidV2CutoverExecutionId:
            "phase4c30b-a-ms4yhg3i-b6b58d155a6b9bfe53bcd12c"
        }
      };
    },
    async createUser() {
      throw new Error("not used");
    },
    async setCustomUserClaims() {},
    async createCustomToken() {
      return "token";
    }
  };

  const db = {
    collection(name: string) {
      return {
        doc(id: string) {
          return {
            path: `${name}/${id}`,
            async get() {
              const value =
                documents.get(`${name}/${id}`);
              return {
                exists:
                  value !== undefined,
                data:
                  () => value
              };
            }
          };
        }
      };
    },
    async runTransaction(
      callback: (tx: any) => Promise<any>
    ) {
      const tx = {
        async get(ref: { path: string }) {
          const value =
            documents.get(ref.path);
          return {
            exists:
              value !== undefined,
            data:
              () => value
          };
        },
        set(
          ref: { path: string },
          value: Record<string, unknown>
        ) {
          const previous =
            documents.get(ref.path) || {};
          documents.set(
            ref.path,
            {
              ...previous,
              ...value
            }
          );
        }
      };
      return callback(tx);
    }
  };

  const timestamp = {
    now:
      () => ({ seconds: 2 })
  };

  const bridge =
    new FirebaseAdminAuthBridge(
      auth as any,
      db as any,
      timestamp as any,
      false
    );

  const context: LegacyAuthResolutionContext = {
    sourceAccountActive: true,
    safeLegacyFirebaseUid:
      LEGACY_SAFE
  };

  const user =
    await bridge.findOrCreateUser(
      LEGACY_SAFE,
      context,
      {
        role: "superAdmin"
      }
    );

  assert.equal(
    user.uid,
    CANONICAL
  );
  assert.equal(
    context.canonicalResolutionVerified,
    true
  );
  assert.equal(
    context.canonicalResolutionSource,
    "sealed_superadmin_cutover_mapping"
  );

  const access =
    await bridge.upsertUserAccessDocument(
      CANONICAL,
      {
        role: "superAdmin"
      },
      context
    );

  assert.equal(
    access.active,
    true
  );
  assert.equal(
    documents.get(
      `users/${CANONICAL}`
    )?.active,
    true
  );
  assert.equal(
    documents.get(
      `users/${CANONICAL}`
    )?.source,
    "sealed_superadmin_cutover_mapping_724_repair"
  );
});

test("unverified canonical route cannot repair active false", async () => {
  const documents = new Map<string, Record<string, unknown>>([
    [
      `users/${CANONICAL}`,
      {
        role: "superAdmin",
        active: false,
        authVersion: "uidv2"
      }
    ]
  ]);

  const auth = {
    async getUser(uid: string) {
      return {
        uid,
        disabled: false,
        customClaims: {
          role: "superAdmin",
          authVersion: "uidv2",
          principalUidV2: uid,
          uidV2CutoverExecutionId:
            "phase4c30b-a-ms4yhg3i-b6b58d155a6b9bfe53bcd12c"
        }
      };
    },
    async createUser() {
      throw new Error("not used");
    },
    async setCustomUserClaims() {},
    async createCustomToken() {
      return "token";
    }
  };

  const db = {
    collection(name: string) {
      return {
        doc(id: string) {
          return {
            path: `${name}/${id}`
          };
        }
      };
    },
    async runTransaction(
      callback: (tx: any) => Promise<any>
    ) {
      return callback({
        async get(ref: { path: string }) {
          const value =
            documents.get(ref.path);
          return {
            exists:
              value !== undefined,
            data:
              () => value
          };
        },
        set() {
          throw new Error(
            "inactive document must not be written"
          );
        }
      });
    }
  };

  const bridge =
    new FirebaseAdminAuthBridge(
      auth as any,
      db as any,
      {
        now:
          () => ({ seconds: 3 })
      } as any,
      false
    );

  const access =
    await bridge.upsertUserAccessDocument(
      CANONICAL,
      {
        role: "superAdmin"
      },
      {
        sourceAccountActive: true,
        safeLegacyFirebaseUid:
          "legacy:superAdmin:not-the-sealed-account"
      }
    );

  assert.equal(
    access.active,
    false
  );
});


test("verified canonical superAdmin upgrades Firestore admin role", async () => {
  const LEGACY_SAFE =
    "legacy:superAdmin:4ab445c8458b4c48da06b780e5beb42fcdea343ab8a4bf0f";

  const documents =
    new Map<string, Record<string, unknown>>([
      [
        `users/${CANONICAL}`,
        {
          role: "admin",
          active: true,
          authVersion: "uidv2"
        }
      ]
    ]);

  const auth = {
    async getUser(uid: string) {
      assert.equal(uid, CANONICAL);
      return {
        uid,
        disabled: false,
        customClaims: {
          role: "superAdmin",
          authVersion: "uidv2",
          principalUidV2: CANONICAL,
          uidV2CutoverExecutionId:
            "phase4c30b-a-ms4yhg3i-b6b58d155a6b9bfe53bcd12c"
        }
      };
    },
    async createUser() {
      throw new Error("not used");
    },
    async setCustomUserClaims() {},
    async createCustomToken() {
      return "token";
    }
  };

  const db = {
    collection(name: string) {
      return {
        doc(id: string) {
          return {
            path: `${name}/${id}`
          };
        }
      };
    },
    async runTransaction(
      callback: (tx: any) => Promise<any>
    ) {
      return callback({
        async get(ref: { path: string }) {
          const value =
            documents.get(ref.path);
          return {
            exists:
              value !== undefined,
            data:
              () => value
          };
        },
        set(
          ref: { path: string },
          value: Record<string, unknown>
        ) {
          const previous =
            documents.get(ref.path) || {};
          documents.set(
            ref.path,
            {
              ...previous,
              ...value
            }
          );
        }
      });
    }
  };

  const bridge =
    new FirebaseAdminAuthBridge(
      auth as any,
      db as any,
      {
        now:
          () => ({ seconds: 4 })
      } as any,
      false
    );

  const context: LegacyAuthResolutionContext = {
    sourceAccountActive: true,
    safeLegacyFirebaseUid:
      LEGACY_SAFE,
    resolvedCanonicalFirebaseUid:
      CANONICAL,
    canonicalResolutionVerified:
      true,
    canonicalResolutionSource:
      "sealed_superadmin_cutover_mapping"
  };

  const access =
    await bridge.upsertUserAccessDocument(
      CANONICAL,
      {
        role: "superAdmin"
      },
      context
    );

  assert.equal(
    access.active,
    true
  );
  assert.equal(
    documents.get(
      `users/${CANONICAL}`
    )?.role,
    "superAdmin"
  );
  assert.equal(
    documents.get(
      `users/${CANONICAL}`
    )?.source,
    "superadmin_role_alignment_726"
  );
});

test("verified canonical route never converts teacher to superAdmin", async () => {
  const documents =
    new Map<string, Record<string, unknown>>([
      [
        `users/${CANONICAL}`,
        {
          role: "teacher",
          active: true,
          authVersion: "uidv2"
        }
      ]
    ]);

  const auth = {
    async getUser(uid: string) {
      return {
        uid,
        disabled: false,
        customClaims: {
          role: "superAdmin",
          authVersion: "uidv2",
          principalUidV2: CANONICAL,
          uidV2CutoverExecutionId:
            "phase4c30b-a-ms4yhg3i-b6b58d155a6b9bfe53bcd12c"
        }
      };
    }
  };

  const db = {
    collection(name: string) {
      return {
        doc(id: string) {
          return {
            path: `${name}/${id}`
          };
        }
      };
    },
    async runTransaction(
      callback: (tx: any) => Promise<any>
    ) {
      return callback({
        async get(ref: { path: string }) {
          const value =
            documents.get(ref.path);
          return {
            exists:
              value !== undefined,
            data:
              () => value
          };
        },
        set() {
          throw new Error(
            "teacher role must not be overwritten"
          );
        }
      });
    }
  };

  const bridge =
    new FirebaseAdminAuthBridge(
      auth as any,
      db as any,
      {
        now:
          () => ({ seconds: 5 })
      } as any,
      false
    );

  await assert.rejects(
    () =>
      bridge.upsertUserAccessDocument(
        CANONICAL,
        {
          role: "superAdmin"
        },
        {
          sourceAccountActive: true,
          safeLegacyFirebaseUid:
            "legacy:superAdmin:4ab445c8458b4c48da06b780e5beb42fcdea343ab8a4bf0f",
          resolvedCanonicalFirebaseUid:
            CANONICAL,
          canonicalResolutionVerified:
            true,
          canonicalResolutionSource:
            "sealed_superadmin_cutover_mapping"
        }
      ),
    /role conflicts/
  );
});


test("exact sealed administrator proof role normalizes to superAdmin", () => {
  const normalized =
    normalizeLegacyRoleForSealedSuperAdmin(
      "admin",
      "legacy:admin:4ab445c8458b4c48da06b780e5beb42fcdea343ab8a4bf0f"
    );

  assert.equal(
    normalized.normalized,
    true
  );
  assert.equal(
    normalized.effectiveRole,
    "superAdmin"
  );
  assert.equal(
    normalized.effectiveSafeUid,
    "legacy:superAdmin:4ab445c8458b4c48da06b780e5beb42fcdea343ab8a4bf0f"
  );
});

test("other administrator proof cannot normalize to superAdmin", () => {
  const normalized =
    normalizeLegacyRoleForSealedSuperAdmin(
      "admin",
      "legacy:admin:000000000000000000000000000000000000000000000000"
    );

  assert.equal(
    normalized.normalized,
    false
  );
  assert.equal(
    normalized.effectiveRole,
    "admin"
  );
});

test("teacher proof cannot normalize even with sealed hash suffix", () => {
  const normalized =
    normalizeLegacyRoleForSealedSuperAdmin(
      "teacher",
      "legacy:teacher:4ab445c8458b4c48da06b780e5beb42fcdea343ab8a4bf0f"
    );

  assert.equal(
    normalized.normalized,
    false
  );
  assert.equal(
    normalized.effectiveRole,
    "teacher"
  );
});


test("localized 전체관리자 Firestore role aligns to canonical superAdmin", async () => {
  const documents =
    new Map<string, Record<string, unknown>>([
      [
        `users/${CANONICAL}`,
        {
          role: "전체관리자",
          active: true,
          authVersion: "uidv2"
        }
      ]
    ]);

  const auth = {
    async getUser(uid: string) {
      assert.equal(uid, CANONICAL);
      return {
        uid,
        disabled: false,
        customClaims: {
          role: "superAdmin",
          authVersion: "uidv2",
          principalUidV2: CANONICAL,
          uidV2CutoverExecutionId:
            "phase4c30b-a-ms4yhg3i-b6b58d155a6b9bfe53bcd12c"
        }
      };
    },
    async createUser() {
      throw new Error("not used");
    },
    async setCustomUserClaims() {},
    async createCustomToken() {
      return "token";
    }
  };

  const db = {
    collection(name: string) {
      return {
        doc(id: string) {
          return {
            path: `${name}/${id}`
          };
        }
      };
    },
    async runTransaction(
      callback: (tx: any) => Promise<any>
    ) {
      return callback({
        async get(ref: { path: string }) {
          const value =
            documents.get(ref.path);
          return {
            exists:
              value !== undefined,
            data:
              () => value
          };
        },
        set(
          ref: { path: string },
          value: Record<string, unknown>
        ) {
          const previous =
            documents.get(ref.path) || {};
          documents.set(
            ref.path,
            {
              ...previous,
              ...value
            }
          );
        }
      });
    }
  };

  const bridge =
    new FirebaseAdminAuthBridge(
      auth as any,
      db as any,
      {
        now:
          () => ({ seconds: 6 })
      } as any,
      false
    );

  const access =
    await bridge.upsertUserAccessDocument(
      CANONICAL,
      {
        role: "superAdmin"
      },
      {
        sourceAccountActive: true,
        signedCanonicalFirebaseUid:
          CANONICAL,
        signedPrincipalUidV2:
          CANONICAL,
        resolvedCanonicalFirebaseUid:
          CANONICAL,
        canonicalResolutionVerified:
          true,
        canonicalResolutionSource:
          "signed_gas_proof_v2"
      }
    );

  assert.equal(
    access.active,
    true
  );

  const updated =
    documents.get(
      `users/${CANONICAL}`
    );

  assert.equal(
    updated?.role,
    "superAdmin"
  );
  assert.equal(
    updated?.source,
    "superadmin_role_alignment_726"
  );
  assert.equal(
    updated?.roleAlignmentVersion,
    "2026-07-29.726.01"
  );
});
