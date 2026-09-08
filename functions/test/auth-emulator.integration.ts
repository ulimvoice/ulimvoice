import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp, type App as AdminApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth as getClientAuth, signInWithCustomToken, signOut } from "firebase/auth";
import {
  createLegacyAuthProof,
  LEGACY_AUTH_AUDIENCE,
  safeLegacyAuthUid,
  type LegacyAuthProofPayload
} from "../src/auth/legacySessionBridge.js";
import { FirebaseAdminAuthBridge } from "../src/auth/firebaseAdminAuthBridge.js";
import { FirestoreLegacyProofStore } from "../src/auth/firestoreLegacyProofStore.js";
import { handleExchangeLegacySessionCallable } from "../src/auth/exchangeLegacySessionCallable.js";
import { AuthStateSyncAdapter } from "../src/auth/authStateSync.js";

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "ulimvoice-phase2-2-test";
const secret = "local-auth-emulator-hmac-secret";
const nowMs = 2_000_000;
let adminApp: AdminApp;
let clientApp: FirebaseApp;

before(async () => {
  process.env.GCLOUD_PROJECT = projectId;
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  adminApp = initializeAdminApp({ projectId }, `admin-${Date.now()}`);
  clientApp = initializeClientApp({ projectId, apiKey: "demo-key" }, `client-${Date.now()}`);
  connectAuthEmulator(getClientAuth(clientApp), `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
});

beforeEach(async () => {
  await getFirestore(adminApp).recursiveDelete(getFirestore(adminApp).collection("users"));
  await getFirestore(adminApp).recursiveDelete(getFirestore(adminApp).collection("legacyAuthProofs"));
});

after(async () => {
  await signOut(getClientAuth(clientApp)).catch(() => undefined);
  await deleteClientApp(clientApp);
  await deleteAdminApp(adminApp);
});

function payload(overrides: Partial<LegacyAuthProofPayload> = {}): LegacyAuthProofPayload {
  return {
    v: 1,
    jti: randomBytes(32).toString("hex"),
    aud: LEGACY_AUTH_AUDIENCE,
    iat: Math.floor(nowMs / 1000),
    exp: Math.floor(nowMs / 1000) + 90,
    role: "student",
    legacyUid: "legacy-student-1",
    studentUid: "student-1",
    accountState: "active",
    ...overrides
  };
}

function proof(overrides: Partial<LegacyAuthProofPayload> = {}): string {
  return createLegacyAuthProof(payload(overrides), secret);
}

async function exchange(rawProof: string, now = nowMs) {
  const verifier = new FirestoreLegacyProofStore(getFirestore(adminApp), secret, Timestamp);
  const auth = new FirebaseAdminAuthBridge(getAuth(adminApp), getFirestore(adminApp), Timestamp);
  return handleExchangeLegacySessionCallable({ proof: rawProof }, { verifier, auth, now: () => now });
}

async function handle(data: unknown, requestAuth?: unknown) {
  const verifier = new FirestoreLegacyProofStore(getFirestore(adminApp), secret, Timestamp);
  const auth = new FirebaseAdminAuthBridge(getAuth(adminApp), getFirestore(adminApp), Timestamp);
  return handleExchangeLegacySessionCallable(data, { verifier, auth, now: () => nowMs, requestAuth });
}

async function assertRejectsCode(action: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.equal((error as { code?: unknown }).code, code);
    return true;
  });
}

test("student proof exchanges to custom token and Auth Emulator login carries claims", async () => {
  const result = await exchange(proof());
  const credential = await signInWithCustomToken(getClientAuth(clientApp), result.customToken);
  const token = await credential.user.getIdTokenResult(true);

  assert.equal(result.ok, true);
  assert.equal(result.firebaseUid, safeLegacyAuthUid("student", "legacy-student-1"));
  assert.equal(token.claims.role, "student");
  assert.equal(token.claims.studentUid, "student-1");
  assert.equal(token.claims.authVersion, 1);
});

test("teacher, admin, and superAdmin proofs receive minimal claims", async () => {
  const teacher = await exchange(proof({ role: "teacher", legacyUid: "legacy-teacher-1", teacherUid: "teacher-1", studentUid: undefined }));
  const admin = await exchange(proof({ role: "admin", legacyUid: "legacy-admin-1", studentUid: undefined }));
  const superAdmin = await exchange(proof({ role: "superAdmin", legacyUid: "legacy-super-1", studentUid: undefined }));

  assert.equal(teacher.firebaseUid, safeLegacyAuthUid("teacher", "legacy-teacher-1"));
  assert.equal(admin.firebaseUid, safeLegacyAuthUid("admin", "legacy-admin-1"));
  assert.equal(superAdmin.firebaseUid, safeLegacyAuthUid("superAdmin", "legacy-super-1"));
});

test("audience, expiry, ttl, future iat, and tampered HMAC are rejected", async () => {
  await assertRejectsCode(() => exchange(proof({ aud: "other" })), "unauthenticated");
  await assertRejectsCode(() => exchange(proof({ iat: Math.floor(nowMs / 1000) - 100, exp: Math.floor(nowMs / 1000) - 1 })), "unauthenticated");
  await assertRejectsCode(() => exchange(proof({ exp: Math.floor(nowMs / 1000) + 121 })), "unauthenticated");
  await assertRejectsCode(() => exchange(proof({ iat: Math.floor(nowMs / 1000) + 31 })), "unauthenticated");
  const tampered = `${proof().slice(0, -1)}x`;
  await assertRejectsCode(() => exchange(tampered), "unauthenticated");
});

test("malformed callable input is rejected as invalid-argument", async () => {
  await assertRejectsCode(() => handle(null), "invalid-argument");
  await assertRejectsCode(() => handle([]), "invalid-argument");
  await assertRejectsCode(() => handle({}), "invalid-argument");
  await assertRejectsCode(() => handle({ proof: proof(), extra: true }), "invalid-argument");
  await assertRejectsCode(() => handle({ proof: "" }), "invalid-argument");
  await assertRejectsCode(() => handle({ proof: "x".repeat(4097) }), "invalid-argument");
});

test("authenticated callable requests are rejected before proof exchange", async () => {
  await assertRejectsCode(() => handle({ proof: proof() }, { uid: "alreadySignedIn" }), "failed-precondition");
});

test("proof payload runtime validation rejects malformed fields and role uid conflicts", async () => {
  await assertRejectsCode(() => exchange(createLegacyAuthProof(payload({ jti: "not-hex" }), secret)), "invalid-argument");
  await assertRejectsCode(() => exchange(createLegacyAuthProof(payload({ role: "student", teacherUid: "teacher-1" }), secret)), "invalid-argument");
  await assertRejectsCode(() => exchange(createLegacyAuthProof(payload({ role: "teacher", teacherUid: "teacher-1", studentUid: "student-1" }), secret)), "invalid-argument");
  await assertRejectsCode(() => exchange(createLegacyAuthProof(payload({ role: "admin", studentUid: "student-1" }), secret)), "invalid-argument");
  await assertRejectsCode(() => exchange(createLegacyAuthProof(payload({ role: "tablet", studentUid: undefined, legacyUid: "tablet-1" }), secret)), "invalid-argument");
  await assertRejectsCode(() => exchange(createLegacyAuthProof({ ...payload(), iat: 1.5 } as LegacyAuthProofPayload, secret)), "invalid-argument");
});

test("same proof succeeds exactly once under concurrency and replay is rejected", async () => {
  const rawProof = proof({ legacyUid: "legacy-once", studentUid: "student-once" });
  const attempts = await Promise.allSettled([
    exchange(rawProof),
    exchange(rawProof),
    exchange(rawProof)
  ]);

  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((result) => result.status === "rejected").length, 2);
  await assertRejectsCode(() => exchange(rawProof), "unauthenticated");
});

test("inactive account document blocks exchange and authVersion mismatch blocks rules access", async () => {
  const rawProof = proof({ legacyUid: "legacy-inactive", studentUid: "student-inactive" });
  const uid = safeLegacyAuthUid("student", "legacy-inactive");
  await getFirestore(adminApp).collection("users").doc(uid).set({
    firebaseUid: uid,
    role: "student",
    studentUid: "student-inactive",
    active: false,
    authVersion: 2,
    source: "legacy_gas",
    updatedAt: Timestamp.now()
  });
  await assertRejectsCode(() => exchange(rawProof), "permission-denied");
});

test("existing Firebase user document conflicts are rejected", async () => {
  const rawProof = proof({ legacyUid: "legacy-conflict", studentUid: "student-conflict" });
  const uid = safeLegacyAuthUid("student", "legacy-conflict");
  await getFirestore(adminApp).collection("users").doc(uid).set({
    firebaseUid: uid,
    role: "teacher",
    active: true,
    authVersion: 1,
    source: "legacy_gas",
    updatedAt: Timestamp.now()
  });
  await assertRejectsCode(() => exchange(rawProof), "permission-denied");
});

test("existing user active must be exactly true and authVersion must be valid", async () => {
  const inactiveProof = proof({ legacyUid: "legacy-string-inactive", studentUid: "student-string-inactive" });
  const inactiveUid = safeLegacyAuthUid("student", "legacy-string-inactive");
  await getFirestore(adminApp).collection("users").doc(inactiveUid).set({
    firebaseUid: inactiveUid,
    role: "student",
    studentUid: "student-string-inactive",
    active: "false",
    authVersion: 1
  });
  await assertRejectsCode(() => exchange(inactiveProof), "permission-denied");

  const invalidVersionProof = proof({ legacyUid: "legacy-invalid-version", studentUid: "student-invalid-version" });
  const invalidVersionUid = safeLegacyAuthUid("student", "legacy-invalid-version");
  await getFirestore(adminApp).collection("users").doc(invalidVersionUid).set({
    firebaseUid: invalidVersionUid,
    role: "student",
    studentUid: "student-invalid-version",
    active: true,
    authVersion: 0
  });
  await assertRejectsCode(() => exchange(invalidVersionProof), "permission-denied");
});

test("existing studentUid and teacherUid conflicts are rejected", async () => {
  const studentProof = proof({ legacyUid: "legacy-student-conflict", studentUid: "student-new" });
  const studentUid = safeLegacyAuthUid("student", "legacy-student-conflict");
  await getFirestore(adminApp).collection("users").doc(studentUid).set({
    firebaseUid: studentUid,
    role: "student",
    studentUid: "student-old",
    active: true,
    authVersion: 1
  });
  await assertRejectsCode(() => exchange(studentProof), "permission-denied");

  const teacherProof = proof({ role: "teacher", legacyUid: "legacy-teacher-conflict", teacherUid: "teacher-new", studentUid: undefined });
  const teacherUid = safeLegacyAuthUid("teacher", "legacy-teacher-conflict");
  await getFirestore(adminApp).collection("users").doc(teacherUid).set({
    firebaseUid: teacherUid,
    role: "teacher",
    teacherUid: "teacher-old",
    active: true,
    authVersion: 1
  });
  await assertRejectsCode(() => exchange(teacherProof), "permission-denied");
});

test("stale role uid fields are removed when access document is refreshed", async () => {
  const rawProof = proof({ legacyUid: "legacy-stale-field", studentUid: "student-stale-field" });
  const uid = safeLegacyAuthUid("student", "legacy-stale-field");
  await getFirestore(adminApp).collection("users").doc(uid).set({
    firebaseUid: uid,
    role: "student",
    studentUid: "student-stale-field",
    teacherUid: "stale-teacher",
    active: true,
    authVersion: 1
  });
  await exchange(rawProof);
  const snapshot = await getFirestore(adminApp).collection("users").doc(uid).get();
  assert.equal(snapshot.data()?.studentUid, "student-stale-field");
  assert.equal("teacherUid" in (snapshot.data() ?? {}), false);
});

test("concurrent valid proofs for the same new legacy account recover uid-already-exists race", async () => {
  const firstProof = proof({ legacyUid: "legacy-race", studentUid: "student-race" });
  const secondProof = proof({ legacyUid: "legacy-race", studentUid: "student-race" });
  const attempts = await Promise.allSettled([exchange(firstProof), exchange(secondProof)]);
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 2);
  const uids = attempts
    .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof exchange>>> => result.status === "fulfilled")
    .map((result) => result.value.firebaseUid);
  assert.deepEqual([...new Set(uids)], [safeLegacyAuthUid("student", "legacy-race")]);
});

test("auth state sync handles missing Auth user as idempotent success in emulators", async () => {
  const adapter = new AuthStateSyncAdapter(getAuth(adminApp), getFirestore(adminApp), Timestamp);
  const result = await adapter.deactivateLegacyAccount({
    role: "student",
    legacyUid: "missing-auth-student",
    reason: "student_withdrawn"
  });
  const snapshot = await getFirestore(adminApp).collection("users").doc(result.firebaseUid).get();
  assert.equal(snapshot.data()?.active, false);
  assert.equal(snapshot.data()?.authVersion, 1);
});

test("auth state sync revokes existing student Auth user in emulators", async () => {
  const legacyUid = "existing-auth-student";
  const firebaseUid = safeLegacyAuthUid("student", legacyUid);
  await getAuth(adminApp).createUser({ uid: firebaseUid });
  await getFirestore(adminApp).collection("users").doc(firebaseUid).set({
    firebaseUid,
    role: "student",
    active: true,
    authVersion: 2,
    studentUid: "student-existing"
  });
  const adapter = new AuthStateSyncAdapter(getAuth(adminApp), getFirestore(adminApp), Timestamp);
  const result = await adapter.deactivateLegacyAccount({
    role: "student",
    legacyUid,
    reason: "student_withdrawn"
  });
  const snapshot = await getFirestore(adminApp).collection("users").doc(firebaseUid).get();
  assert.equal(result.authVersion, 3);
  assert.equal(snapshot.data()?.active, false);
});

test("auth state sync supports staff disable and session version revocation in emulators", async () => {
  const adapter = new AuthStateSyncAdapter(getAuth(adminApp), getFirestore(adminApp), Timestamp);
  const teacher = await adapter.deactivateLegacyAccount({
    role: "teacher",
    legacyUid: "disabled-teacher",
    reason: "staff_disabled"
  });
  const admin = await adapter.deactivateLegacyAccount({
    role: "admin",
    legacyUid: "session-admin",
    reason: "session_version_revoked"
  });
  assert.equal((await getFirestore(adminApp).collection("users").doc(teacher.firebaseUid).get()).data()?.disabledReason, "staff_disabled");
  assert.equal((await getFirestore(adminApp).collection("users").doc(admin.firebaseUid).get()).data()?.disabledReason, "session_version_revoked");
});

test("auth state sync role change disables old role uid and reports next uid in emulators", async () => {
  const adapter = new AuthStateSyncAdapter(getAuth(adminApp), getFirestore(adminApp), Timestamp);
  const result = await adapter.handleRoleChange({
    role: "admin",
    nextRole: "superAdmin",
    legacyUid: "role-change-admin",
    reason: "role_changed"
  });
  assert.equal(result.disabledUid, safeLegacyAuthUid("admin", "role-change-admin"));
  assert.equal(result.nextUid, safeLegacyAuthUid("superAdmin", "role-change-admin"));
  assert.equal((await getFirestore(adminApp).collection("users").doc(result.disabledUid).get()).data()?.active, false);
});

test("auth state sync propagates non-not-found revoke errors", async () => {
  const adapter = new AuthStateSyncAdapter(
    {
      revokeRefreshTokens: async () => {
        const error = new Error("boom") as Error & { code?: string };
        error.code = "auth/internal-error";
        throw error;
      }
    } as never,
    getFirestore(adminApp),
    Timestamp
  );
  await assert.rejects(() => adapter.deactivateLegacyAccount({
    role: "student",
    legacyUid: "revoke-error-student",
    reason: "student_withdrawn"
  }), /boom/);
});

test("client bridge keeps GAS login when feature flag is false and calls signOut on logout", async () => {
  const moduleUrl = pathToFileURL(join(process.cwd(), "..", "web", "firebase-auth-bridge.js")).href;
  const { createFirebaseAuthBridge } = await import(moduleUrl) as {
    createFirebaseAuthBridge: (deps: {
      flags: { USE_FIRESTORE_AUTH: boolean };
      gasProofIssuer: () => Promise<{ proof: string }>;
      callableExchange: (proof: string) => Promise<{ customToken: string }>;
      authSdk: { signInWithCustomToken: (token: string) => Promise<unknown>; signOut: () => Promise<void> };
    }) => {
      exchangeLegacySession: () => Promise<unknown>;
      signOutFirebase: () => Promise<void>;
    };
  };
  let gasCalled = 0;
  let signedOut = 0;
  const bridge = createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: false },
    gasProofIssuer: async () => {
      gasCalled += 1;
      return { proof: "unused" };
    },
    callableExchange: async () => ({ customToken: "unused" }),
    authSdk: {
      signInWithCustomToken: async () => undefined,
      signOut: async () => {
        signedOut += 1;
      }
    }
  });

  assert.deepEqual(await bridge.exchangeLegacySession(), { ok: false, skipped: true, reason: "USE_FIRESTORE_AUTH=false" });
  await bridge.signOutFirebase();
  assert.equal(gasCalled, 0);
  assert.equal(signedOut, 0);
});

test("client bridge signs out existing Firebase user before proof exchange", async () => {
  const moduleUrl = pathToFileURL(join(process.cwd(), "..", "web", "firebase-auth-bridge.js")).href;
  const { createFirebaseAuthBridge } = await import(moduleUrl) as {
    createFirebaseAuthBridge: (deps: {
      flags: { USE_FIRESTORE_AUTH: boolean };
      gasProofIssuer: () => Promise<{ proof: string }>;
      callableExchange: (proof: string) => Promise<{ customToken: string; firebaseUid?: string; expiresInSeconds?: number }>;
      authSdk: { currentUser: () => unknown; signInWithCustomToken: (token: string) => Promise<unknown>; signOut: () => Promise<void> };
    }) => {
      exchangeLegacySession: () => Promise<{ ok?: boolean }>;
    };
  };
  let current: unknown = { uid: "old-user" };
  let signedOut = 0;
  let signedInToken = "";
  const bridge = createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => ({ proof: "proof-for-new-user" }),
    callableExchange: async () => ({ customToken: "new-custom-token", firebaseUid: "new-user", expiresInSeconds: 90 }),
    authSdk: {
      currentUser: () => current,
      signOut: async () => {
        signedOut += 1;
        current = null;
      },
      signInWithCustomToken: async (token) => {
        signedInToken = token;
      }
    }
  });

  const result = await bridge.exchangeLegacySession();
  assert.equal(result.ok, true);
  assert.equal(signedOut, 1);
  assert.equal(signedInToken, "new-custom-token");
});
