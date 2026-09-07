import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ULIM_FUNCTION_REGION } from "../src/common/firebaseRegion.js";

async function loadWebModules() {
  const authUrl = pathToFileURL(join(process.cwd(), "..", "web", "firebase-auth-bridge.js")).href;
  const runtimeUrl = pathToFileURL(join(process.cwd(), "..", "web", "firebase-runtime.js")).href;
  const authModule = await import(`${authUrl}?v=${Date.now()}-${Math.random()}`) as {
    createFirebaseAuthBridge: (deps: Record<string, unknown>) => Record<string, () => Promise<unknown>>;
  };
  const runtimeModule = await import(`${runtimeUrl}?v=${Date.now()}-${Math.random()}`) as {
    createFirebaseRuntime: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  return { authModule, runtimeModule };
}

test("firebase runtime does not initialize or fetch when auth feature flag is false", async () => {
  const { runtimeModule } = await loadWebModules();
  let initialized = 0;
  let fetched = 0;
  const result = await runtimeModule.createFirebaseRuntime({
    flags: { USE_FIRESTORE_AUTH: false },
    sdk: { initializeApp: () => { initialized += 1; } },
    fetch: async () => { fetched += 1; }
  });
  assert.deepEqual(result, { ok: false, skipped: true, reason: "USE_FIRESTORE_AUTH=false" });
  assert.equal(initialized, 0);
  assert.equal(fetched, 0);
});


test("firebase runtime refuses attendance read when Firebase auth flag is disabled", async () => {
  const { runtimeModule } = await loadWebModules();
  const result = await runtimeModule.createFirebaseRuntime({
    flags: { USE_FIRESTORE_AUTH: false, USE_FIRESTORE_ATTENDANCE_READ: true },
    config: { firebaseConfig: { projectId: "demo" } },
    sdk: fakeSdk()
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "attendance-read-requires-auth");
});

test("firebase runtime wires Firestore attendance reader only when both flags are enabled", async () => {
  const { authModule, runtimeModule } = await loadWebModules();
  (globalThis as unknown as { ULIM_CREATE_FIREBASE_AUTH_BRIDGE: unknown }).ULIM_CREATE_FIREBASE_AUTH_BRIDGE = authModule.createFirebaseAuthBridge;
  const readerUrl = pathToFileURL(join(process.cwd(), "..", "web", "firestore-attendance-reader.js")).href;
  const readerModule = await import(`${readerUrl}?v=${Date.now()}-${Math.random()}`) as { createFirestoreAttendanceReader: unknown };
  (globalThis as unknown as { ULIM_CREATE_FIRESTORE_ATTENDANCE_READER: unknown }).ULIM_CREATE_FIRESTORE_ATTENDANCE_READER = readerModule.createFirestoreAttendanceReader;
  const runtime = await runtimeModule.createFirebaseRuntime({
    flags: { USE_FIRESTORE_AUTH: true, USE_FIRESTORE_ATTENDANCE_READ: true },
    config: { firebaseConfig: { projectId: "demo" }, gasEndpoint: "https://gas.example" },
    sdk: fakeSdk(),
    legacySessionProvider: async () => ({ adminToken: "admin-token" }),
    fetch: async () => ({ json: async () => ({ proof: "proof" }) })
  });
  assert.equal(runtime.ok, true);
  assert.ok(runtime.db);
  assert.ok(runtime.attendanceReader);
});

test("firebase runtime safely disables when config is missing", async () => {
  const { runtimeModule } = await loadWebModules();
  const result = await runtimeModule.createFirebaseRuntime({
    flags: { USE_FIRESTORE_AUTH: true },
    sdk: { initializeApp: () => { throw new Error("should not initialize"); } }
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "firebase-runtime-config-missing");
});

test("firebase runtime posts only allowed legacy session token keys", async () => {
  const { authModule, runtimeModule } = await loadWebModules();
  (globalThis as unknown as { ULIM_CREATE_FIREBASE_AUTH_BRIDGE: unknown }).ULIM_CREATE_FIREBASE_AUTH_BRIDGE = authModule.createFirebaseAuthBridge;
  let postedBody = "";
  const sdk = fakeSdk();
  const runtime = await runtimeModule.createFirebaseRuntime({
    flags: { USE_FIRESTORE_AUTH: true },
    config: { firebaseConfig: { projectId: "demo" }, functionsRegion: ULIM_FUNCTION_REGION, gasEndpoint: "https://gas.example" },
    sdk,
    legacySessionProvider: async () => ({ studentSessionToken: "student-token" }),
    fetch: async (_url: string, init: { body: string }) => {
      postedBody = init.body;
      return { json: async () => ({ proof: "proof-1" }) };
    }
  });
  const bridge = runtime.bridge as { exchangeLegacySession: () => Promise<unknown> };
  await bridge.exchangeLegacySession();
  assert.deepEqual(JSON.parse(postedBody), { action: "issueFirebaseLoginProof", studentSessionToken: "student-token" });
});

test("firebase runtime accepts exactly one token type and trims it", async () => {
  const { authModule, runtimeModule } = await loadWebModules();
  (globalThis as unknown as { ULIM_CREATE_FIREBASE_AUTH_BRIDGE: unknown }).ULIM_CREATE_FIREBASE_AUTH_BRIDGE = authModule.createFirebaseAuthBridge;
  const bodies: unknown[] = [];
  for (const legacySession of [
    { studentSessionToken: "  student-token  " },
    { sessionToken: " session-token " },
    { adminToken: " admin-token " }
  ]) {
    const runtime = await runtimeModule.createFirebaseRuntime({
      flags: { USE_FIRESTORE_AUTH: true },
      config: { firebaseConfig: { projectId: "demo" }, gasEndpoint: "https://gas.example" },
      sdk: fakeSdk(),
      legacySessionProvider: async () => legacySession,
      fetch: async (_url: string, init: { body: string }) => {
        bodies.push(JSON.parse(init.body));
        return { json: async () => ({ proof: `proof-${bodies.length}` }) };
      }
    });
    const bridge = runtime.bridge as { exchangeLegacySession: () => Promise<unknown> };
    await bridge.exchangeLegacySession();
  }
  assert.deepEqual(bodies, [
    { action: "issueFirebaseLoginProof", studentSessionToken: "student-token" },
    { action: "issueFirebaseLoginProof", sessionToken: "session-token" },
    { action: "issueFirebaseLoginProof", adminToken: "admin-token" }
  ]);
});

test("firebase runtime refuses missing, mixed, unknown, blank, and oversized legacy session tokens without fetch", async () => {
  const { authModule, runtimeModule } = await loadWebModules();
  (globalThis as unknown as { ULIM_CREATE_FIREBASE_AUTH_BRIDGE: unknown }).ULIM_CREATE_FIREBASE_AUTH_BRIDGE = authModule.createFirebaseAuthBridge;
  let fetched = 0;
  for (const legacySession of [
    {},
    { studentSessionToken: "s", sessionToken: "alias" },
    { studentSessionToken: "s", adminToken: "a" },
    { sessionToken: "s", adminToken: "a" },
    { unknown: "x" },
    { studentSessionToken: "   " },
    { studentSessionToken: "x".repeat(2049) }
  ]) {
    const runtime = await runtimeModule.createFirebaseRuntime({
      flags: { USE_FIRESTORE_AUTH: true },
      config: { firebaseConfig: { projectId: "demo" }, gasEndpoint: "https://gas.example" },
      sdk: fakeSdk(),
      legacySessionProvider: async () => legacySession,
      fetch: async () => {
        fetched += 1;
        return { json: async () => ({ proof: "proof" }) };
      }
    });
    const bridge = runtime.bridge as { exchangeLegacySession: () => Promise<{ ok: boolean; reason: string }> };
    const result = await bridge.exchangeLegacySession();
    assert.equal(result.ok, false);
    assert.equal(result.reason, "firebase-auth-exchange-failed");
  }
  assert.equal(fetched, 0);
});

test("firebase runtime injects persistence and callable adapter", async () => {
  const { authModule, runtimeModule } = await loadWebModules();
  (globalThis as unknown as { ULIM_CREATE_FIREBASE_AUTH_BRIDGE: unknown }).ULIM_CREATE_FIREBASE_AUTH_BRIDGE = authModule.createFirebaseAuthBridge;
  const calls: string[] = [];
  const sdk = fakeSdk(calls);
  const runtime = await runtimeModule.createFirebaseRuntime({
    flags: { USE_FIRESTORE_AUTH: true },
    config: { firebaseConfig: { projectId: "demo" }, gasEndpoint: "https://gas.example" },
    sdk,
    persistence: "customPersistence",
    legacySessionProvider: async () => ({ adminToken: "admin-token" }),
    fetch: async () => ({ json: async () => ({ proof: "proof-2" }) })
  });
  const bridge = runtime.bridge as { exchangeLegacySession: () => Promise<{ ok: boolean }> };
  const result = await bridge.exchangeLegacySession();
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["initializeApp", "setPersistence:customPersistence", "httpsCallable:exchangeLegacySession", "signIn:token-for-proof-2"]);
});

test("auth bridge retries with a fresh proof once after exchange failure", async () => {
  const { authModule } = await loadWebModules();
  const proofs: string[] = [];
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => {
      const proof = `proof-${proofs.length + 1}`;
      proofs.push(proof);
      return { proof };
    },
    callableExchange: async (proofValue: string) => {
      if (proofValue === "proof-1") throw new Error("temporary");
      return { customToken: `token-for-${proofValue}` };
    },
    authSdk: {
      currentUser: () => ({ uid: "stale" }),
      signOut: async () => undefined,
      signInWithCustomToken: async () => undefined
    }
  }) as { exchangeLegacySession: () => Promise<{ ok: boolean }> };
  const result = await bridge.exchangeLegacySession();
  assert.equal(result.ok, true);
  assert.deepEqual(proofs, ["proof-1", "proof-2"]);
});

test("auth bridge stops safely after one fresh-proof retry", async () => {
  const { authModule } = await loadWebModules();
  const proofs: string[] = [];
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => {
      const proof = `proof-${proofs.length + 1}`;
      proofs.push(proof);
      return { proof };
    },
    callableExchange: async () => { throw new Error("still down"); },
    authSdk: {
      signInWithCustomToken: async () => undefined,
      signOut: async () => undefined
    }
  }) as { exchangeLegacySession: () => Promise<{ ok: boolean; reason: string }> };
  const result = await bridge.exchangeLegacySession();
  assert.equal(result.ok, false);
  assert.equal(result.reason, "firebase-auth-exchange-failed");
  assert.deepEqual(proofs, ["proof-1", "proof-2"]);
});

test("auth bridge recovers queue after signIn rejection and allows next exchange", async () => {
  const { authModule } = await loadWebModules();
  let signInCalls = 0;
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => ({ proof: "proof" }),
    callableExchange: async () => ({ customToken: "token" }),
    authSdk: {
      currentUser: () => null,
      signOut: async () => undefined,
      signInWithCustomToken: async () => {
        signInCalls += 1;
        if (signInCalls <= 2) throw new Error("temporary signIn failure");
      }
    }
  }) as { exchangeLegacySession: () => Promise<{ ok: boolean; reason?: string }> };
  const failed = await bridge.exchangeLegacySession();
  const recovered = await bridge.exchangeLegacySession();
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, "firebase-auth-exchange-failed");
  assert.equal(recovered.ok, true);
  assert.equal(signInCalls, 3);
});

test("auth bridge recovers queue after signOut rejection and allows later exchange", async () => {
  const { authModule } = await loadWebModules();
  let current: unknown = { uid: "stale" };
  let signOutCalls = 0;
  let signIns = 0;
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => ({ proof: "proof" }),
    callableExchange: async () => ({ customToken: "token" }),
    authSdk: {
      currentUser: () => current,
      signOut: async () => {
        signOutCalls += 1;
        if (signOutCalls === 1) throw new Error("temporary signOut failure");
        current = null;
      },
      signInWithCustomToken: async () => {
        signIns += 1;
        current = { uid: "fresh" };
      }
    }
  }) as {
    signOutFirebase: () => Promise<unknown>;
    exchangeLegacySession: () => Promise<{ ok: boolean }>;
  };
  await assert.rejects(() => bridge.signOutFirebase(), /temporary signOut failure/);
  const recovered = await bridge.exchangeLegacySession();
  assert.equal(recovered.ok, true);
  assert.equal(signOutCalls, 2);
  assert.equal(signIns, 1);
});

test("restoreOrExchangeLegacySession signs out stale user and exchanges new GAS proof", async () => {
  const { authModule } = await loadWebModules();
  let current: unknown = { uid: "firebase-student-a" };
  let signedOut = 0;
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => ({ proof: "teacher-proof-b" }),
    callableExchange: async () => ({ customToken: "teacher-token-b" }),
    authSdk: {
      currentUser: () => current,
      signOut: async () => {
        signedOut += 1;
        current = null;
      },
      signInWithCustomToken: async () => undefined
    }
  }) as { restoreOrExchangeLegacySession: () => Promise<{ ok: boolean; restored?: boolean }> };
  const result = await bridge.restoreOrExchangeLegacySession();
  assert.equal(result.ok, true);
  assert.equal(result.restored, undefined);
  assert.equal(signedOut, 1);
});

test("auth bridge keeps latest exchange when older callable resolves later", async () => {
  const { authModule } = await loadWebModules();
  const deferredA = deferred<{ customToken: string; firebaseUid: string }>();
  const callableAStarted = deferred<void>();
  const signIns: string[] = [];
  let proofCalls = 0;
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => {
      proofCalls += 1;
      return { proof: proofCalls === 1 ? "proof-a" : "proof-b" };
    },
    callableExchange: async (proofValue: string) => {
      if (proofValue === "proof-a") {
        callableAStarted.resolve();
        return deferredA.promise;
      }
      return { customToken: "token-b", firebaseUid: "B" };
    },
    authSdk: {
      currentUser: () => null,
      signOut: async () => undefined,
      signInWithCustomToken: async (token: string) => { signIns.push(token); }
    }
  }) as { exchangeLegacySession: () => Promise<{ ok?: boolean; superseded?: boolean }> };
  const first = bridge.exchangeLegacySession();
  await callableAStarted.promise;
  const second = await bridge.exchangeLegacySession();
  deferredA.resolve({ customToken: "token-a", firebaseUid: "A" });
  const firstResult = await first;
  assert.equal(second.ok, true);
  assert.equal(firstResult.superseded, true);
  assert.deepEqual(signIns, ["token-b"]);
});

test("auth bridge fail-closes when latest exchange fails while older signIn is in progress", async () => {
  const { authModule } = await loadWebModules();
  const signInA = deferred<void>();
  const signInStarted = deferred<void>();
  let current: unknown = null;
  let proofCalls = 0;
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => {
      proofCalls += 1;
      return { proof: proofCalls === 1 ? "proof-a" : "proof-b" };
    },
    callableExchange: async (proofValue: string) => {
      if (proofValue === "proof-b") throw new Error("latest failed");
      return { customToken: "token-a", firebaseUid: "A" };
    },
    authSdk: {
      currentUser: () => current,
      signOut: async () => { current = null; },
      signInWithCustomToken: async (token: string) => {
        signInStarted.resolve();
        await signInA.promise;
        current = { uid: token };
      }
    }
  }) as { exchangeLegacySession: () => Promise<{ ok?: boolean; superseded?: boolean; reason?: string }> };
  const first = bridge.exchangeLegacySession();
  await signInStarted.promise;
  const second = bridge.exchangeLegacySession();
  signInA.resolve();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.superseded, true);
  assert.equal(secondResult.ok, false);
  assert.equal(secondResult.reason, "firebase-auth-exchange-failed");
  assert.equal(current, null);
});

test("auth bridge fail-closes when latest proof is unavailable while older signIn is in progress", async () => {
  const { authModule } = await loadWebModules();
  const signInA = deferred<void>();
  const signInStarted = deferred<void>();
  let current: unknown = null;
  let proofCalls = 0;
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => {
      proofCalls += 1;
      return proofCalls === 1 ? { proof: "proof-a" } : {};
    },
    callableExchange: async () => ({ customToken: "token-a", firebaseUid: "A" }),
    authSdk: {
      currentUser: () => current,
      signOut: async () => { current = null; },
      signInWithCustomToken: async (token: string) => {
        signInStarted.resolve();
        await signInA.promise;
        current = { uid: token };
      }
    }
  }) as { exchangeLegacySession: () => Promise<{ ok?: boolean; reason?: string; superseded?: boolean }> };
  const first = bridge.exchangeLegacySession();
  await signInStarted.promise;
  const second = bridge.exchangeLegacySession();
  signInA.resolve();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.superseded, true);
  assert.equal(secondResult.ok, false);
  assert.equal(secondResult.reason, "firebase-auth-exchange-failed");
  assert.equal(current, null);
});

test("auth bridge logout supersedes delayed exchange and prevents later signIn", async () => {
  const { authModule } = await loadWebModules();
  const proofWait = deferred<{ proof: string }>();
  const signIns: string[] = [];
  let current: unknown = { uid: "existing" };
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => proofWait.promise,
    callableExchange: async () => ({ customToken: "token-after-logout" }),
    authSdk: {
      currentUser: () => current,
      signOut: async () => { current = null; },
      signInWithCustomToken: async (token: string) => { signIns.push(token); current = { uid: token }; }
    }
  }) as {
    exchangeLegacySession: () => Promise<{ superseded?: boolean }>;
    signOutFirebase: () => Promise<unknown>;
  };
  const exchange = bridge.exchangeLegacySession();
  await bridge.signOutFirebase();
  proofWait.resolve({ proof: "late-proof" });
  const result = await exchange;
  assert.equal(result.superseded, true);
  assert.equal(current, null);
  assert.deepEqual(signIns, []);
});

test("auth bridge logout queued during signIn leaves final user null", async () => {
  const { authModule } = await loadWebModules();
  const signInWait = deferred<void>();
  const signInStarted = deferred<void>();
  let current: unknown = null;
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => ({ proof: "proof" }),
    callableExchange: async () => ({ customToken: "token" }),
    authSdk: {
      currentUser: () => current,
      signOut: async () => { current = null; },
      signInWithCustomToken: async (token: string) => {
        signInStarted.resolve();
        await signInWait.promise;
        current = { uid: token };
      }
    }
  }) as {
    exchangeLegacySession: () => Promise<{ superseded?: boolean }>;
    signOutFirebase: () => Promise<unknown>;
  };
  const exchange = bridge.exchangeLegacySession();
  await signInStarted.promise;
  const logout = bridge.signOutFirebase();
  signInWait.resolve();
  const [exchangeResult] = await Promise.all([exchange, logout]);
  assert.equal(exchangeResult.superseded, true);
  assert.equal(current, null);
});

test("auth bridge superseded failure cleanup does not sign out latest account", async () => {
  const { authModule } = await loadWebModules();
  const proofA = deferred<{ proof: string }>();
  const proofAStarted = deferred<void>();
  let proofCalls = 0;
  let current: unknown = null;
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => {
      proofCalls += 1;
      if (proofCalls === 1) {
        proofAStarted.resolve();
        return proofA.promise;
      }
      return { proof: "proof-b" };
    },
    callableExchange: async () => ({ customToken: "token-b", firebaseUid: "B" }),
    authSdk: {
      currentUser: () => current,
      signOut: async () => { current = null; },
      signInWithCustomToken: async (token: string) => { current = { uid: token }; }
    }
  }) as { exchangeLegacySession: () => Promise<{ ok?: boolean; superseded?: boolean }> };
  const first = bridge.exchangeLegacySession();
  await proofAStarted.promise;
  const second = await bridge.exchangeLegacySession();
  proofA.resolve({ proof: "" });
  const firstResult = await first;
  assert.equal(second.ok, true);
  assert.equal(firstResult.superseded, true);
  assert.deepEqual(current, { uid: "token-b" });
});

test("auth bridge returns superseded when newer exchange starts during failure cleanup", async () => {
  const { authModule } = await loadWebModules();
  const cleanupWait = deferred<void>();
  const cleanupStarted = deferred<void>();
  let proofCalls = 0;
  let current: unknown = null;
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => {
      proofCalls += 1;
      if (proofCalls === 1) return { proof: "proof-a" };
      if (proofCalls === 2) return { proof: "proof-a-retry" };
      return { proof: "proof-b" };
    },
    callableExchange: async (proofValue: string) => {
      if (proofValue !== "proof-b") {
        current = { uid: "partial-a" };
        throw new Error("proof-a failed");
      }
      return { customToken: "token-b", firebaseUid: "B" };
    },
    authSdk: {
      currentUser: () => current,
      signOut: async () => {
        cleanupStarted.resolve();
        await cleanupWait.promise;
        current = null;
      },
      signInWithCustomToken: async (token: string) => { current = { uid: token }; }
    }
  }) as { exchangeLegacySession: () => Promise<{ ok?: boolean; superseded?: boolean; reason?: string }> };

  const first = bridge.exchangeLegacySession();
  await cleanupStarted.promise;
  const second = bridge.exchangeLegacySession();
  cleanupWait.resolve();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.superseded, true);
  assert.equal(firstResult.reason, "auth-exchange-superseded");
  assert.equal(secondResult.ok, true);
  assert.deepEqual(current, { uid: "token-b" });
});

test("auth bridge normalizes repeated cleanup signOut failures into safe result and recovers queue", async () => {
  const { authModule } = await loadWebModules();
  let current: unknown = { uid: "stale" };
  let signOutFailures = 0;
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => ({ proof: "proof" }),
    callableExchange: async () => ({ customToken: "token" }),
    authSdk: {
      currentUser: () => current,
      signOut: async () => {
        if (signOutFailures < 2) {
          signOutFailures += 1;
          throw new Error("raw signOut failure");
        }
        current = null;
      },
      signInWithCustomToken: async (token: string) => { current = { uid: token }; }
    }
  }) as { exchangeLegacySession: () => Promise<{ ok?: boolean; firebaseDisabled?: boolean; firebaseSessionCleared?: boolean; reason?: string; safeMessage?: string }> };

  const failed = await bridge.exchangeLegacySession();
  current = null;
  const recovered = await bridge.exchangeLegacySession();
  assert.equal(failed.ok, false);
  assert.equal(failed.firebaseDisabled, true);
  assert.equal(failed.firebaseSessionCleared, false);
  assert.equal(failed.reason, "firebase-auth-exchange-failed");
  assert.equal(failed.safeMessage?.includes("raw signOut failure"), false);
  assert.equal(recovered.ok, true);
  assert.equal(signOutFailures, 2);
});

test("auth bridge logout during retry prevents retry signIn", async () => {
  const { authModule } = await loadWebModules();
  const retryWait = deferred<{ proof: string }>();
  const signIns: string[] = [];
  let proofCalls = 0;
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => {
      proofCalls += 1;
      return proofCalls === 1 ? { proof: "proof-1" } : retryWait.promise;
    },
    callableExchange: async () => { throw new Error("force retry"); },
    authSdk: {
      currentUser: () => null,
      signOut: async () => undefined,
      signInWithCustomToken: async (token: string) => { signIns.push(token); }
    }
  }) as {
    exchangeLegacySession: () => Promise<{ ok?: boolean; superseded?: boolean }>;
    signOutFirebase: () => Promise<unknown>;
  };
  const exchange = bridge.exchangeLegacySession();
  await bridge.signOutFirebase();
  retryWait.resolve({ proof: "proof-2" });
  const result = await exchange;
  assert.equal(result.superseded, true);
  assert.deepEqual(signIns, []);
});

test("auth bridge same account repeated restore finishes with latest account and no stale signIn", async () => {
  const { authModule } = await loadWebModules();
  const signIns: string[] = [];
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => ({ proof: "same-account-proof" }),
    callableExchange: async () => ({ customToken: "same-account-token", firebaseUid: "same" }),
    authSdk: {
      currentUser: () => null,
      signOut: async () => undefined,
      signInWithCustomToken: async (token: string) => { signIns.push(token); }
    }
  }) as { restoreOrExchangeLegacySession: () => Promise<{ ok?: boolean }> };
  await bridge.restoreOrExchangeLegacySession();
  const second = await bridge.restoreOrExchangeLegacySession();
  assert.equal(second.ok, true);
  assert.deepEqual(signIns, ["same-account-token", "same-account-token"]);
});

test("auth bridge does not call signOut when current Firebase user is null", async () => {
  const { authModule } = await loadWebModules();
  let signOuts = 0;
  const bridge = authModule.createFirebaseAuthBridge({
    flags: { USE_FIRESTORE_AUTH: true },
    gasProofIssuer: async () => ({ proof: "proof" }),
    callableExchange: async () => ({ customToken: "token" }),
    authSdk: {
      currentUser: () => null,
      signOut: async () => { signOuts += 1; },
      signInWithCustomToken: async () => undefined
    }
  }) as { exchangeLegacySession: () => Promise<{ ok?: boolean }> };
  const result = await bridge.exchangeLegacySession();
  assert.equal(result.ok, true);
  assert.equal(signOuts, 0);
});

function fakeSdk(calls: string[] = []) {
  const auth = { currentUser: null };
  return {
    browserLocalPersistence: "local",
    initializeApp: () => {
      calls.push("initializeApp");
      return {};
    },
    getAuth: () => auth,
    setPersistence: async (_auth: unknown, persistence: string) => {
      calls.push(`setPersistence:${persistence}`);
    },
    getFunctions: () => ({}),
    getFirestore: () => ({}),
    collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join("/") }),
    where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    query: (ref: unknown, ...constraints: unknown[]) => ({ ref, constraints }),
    getDocs: async () => ({ docs: [] }),
    getIdTokenResult: async () => ({ claims: {} }),
    httpsCallable: (_functions: unknown, name: string) => {
      calls.push(`httpsCallable:${name}`);
      return async (data: { proof: string }) => ({ data: { ok: true, customToken: `token-for-${data.proof}` } });
    },
    signInWithCustomToken: async (_auth: unknown, token: string) => {
      calls.push(`signIn:${token}`);
    },
    signOut: async () => undefined,
    onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
      callback(null);
      return () => undefined;
    }
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

test("firebase runtime prepares Firestore reader for shadow-only pilot while direct attendance read remains off", async () => {
  const { authModule, runtimeModule } = await loadWebModules();
  (globalThis as unknown as { ULIM_CREATE_FIREBASE_AUTH_BRIDGE: unknown }).ULIM_CREATE_FIREBASE_AUTH_BRIDGE = authModule.createFirebaseAuthBridge;
  const readerUrl = pathToFileURL(join(process.cwd(), "..", "web", "firestore-attendance-reader.js")).href;
  const readerModule = await import(`${readerUrl}?v=${Date.now()}-${Math.random()}`) as { createFirestoreAttendanceReader: unknown };
  (globalThis as unknown as { ULIM_CREATE_FIREBASE_ATTENDANCE_READER: unknown }).ULIM_CREATE_FIREBASE_ATTENDANCE_READER = readerModule.createFirestoreAttendanceReader;
  const runtime = await runtimeModule.createFirebaseRuntime({
    flags: {
      USE_FIRESTORE_AUTH: true,
      USE_FIRESTORE_ATTENDANCE_READ: false,
      USE_FIRESTORE_ATTENDANCE_SHADOW: true
    },
    config: { firebaseConfig: { projectId: "demo" }, gasEndpoint: "https://gas.example" },
    sdk: fakeSdk(),
    legacySessionProvider: async () => ({ adminToken: "admin-token" }),
    fetch: async () => ({ json: async () => ({ proof: "proof" }) })
  });
  assert.equal(runtime.ok, true);
  assert.ok(runtime.attendanceReader);
});
