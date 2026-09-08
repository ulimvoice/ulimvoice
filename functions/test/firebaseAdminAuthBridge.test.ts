import test from "node:test";
import assert from "node:assert/strict";
import type { Auth } from "firebase-admin/auth";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { FirebaseAdminAuthBridge } from "../src/auth/firebaseAdminAuthBridge.js";

interface AccountDoc {
  exists: boolean;
  data?: Record<string, unknown>;
}

function fakeFirestore(account: AccountDoc, onRead?: () => void): Firestore {
  return {
    collection(name: string) {
      assert.equal(name, "legacyAccounts");
      return {
        doc() {
          return {
            async get() {
              onRead?.();
              return {
                exists: account.exists,
                data: () => account.data
              };
            }
          };
        }
      };
    }
  } as unknown as Firestore;
}

const timestamp = { now: () => ({}) as Timestamp };
const auth = {} as Auth;

test("directory guard remains inert until the explicit server switch is enabled", async () => {
  let reads = 0;
  const bridge = new FirebaseAdminAuthBridge(auth, fakeFirestore({ exists: false }, () => { reads += 1; }), timestamp, false);
  await bridge.assertDirectoryAccount("uid", { role: "student", studentUid: "S1" });
  assert.equal(reads, 0);
});

test("directory guard accepts an exact active student account", async () => {
  const bridge = new FirebaseAdminAuthBridge(auth, fakeFirestore({
    exists: true,
    data: { role: "student", active: true, studentUid: "S1" }
  }), timestamp, true);
  await bridge.assertDirectoryAccount("uid", { role: "student", studentUid: "S1" });
});

test("directory guard rejects missing, inactive, role-conflicting, and identifier-conflicting accounts", async () => {
  const cases: Array<{ doc: AccountDoc; claims: Parameters<FirebaseAdminAuthBridge["assertDirectoryAccount"]>[1]; pattern: RegExp }> = [
    { doc: { exists: false }, claims: { role: "student", studentUid: "S1" }, pattern: /not found/ },
    { doc: { exists: true, data: { role: "student", active: false, studentUid: "S1" } }, claims: { role: "student", studentUid: "S1" }, pattern: /inactive/ },
    { doc: { exists: true, data: { role: "teacher", active: true, teacherUid: "T1" } }, claims: { role: "student", studentUid: "S1" }, pattern: /role conflicts/ },
    { doc: { exists: true, data: { role: "student", active: true } }, claims: { role: "student", studentUid: "S1" }, pattern: /studentUid conflicts/ },
    { doc: { exists: true, data: { role: "student", active: true, studentUid: "S2" } }, claims: { role: "student", studentUid: "S1" }, pattern: /studentUid conflicts/ },
    { doc: { exists: true, data: { role: "teacher", active: true, teacherUid: "T2" } }, claims: { role: "teacher", teacherUid: "T1" }, pattern: /teacherUid conflicts/ },
    { doc: { exists: true, data: { role: "admin", active: true, studentUid: "S1" } }, claims: { role: "admin" }, pattern: /stale role uid/ }
  ];

  for (const item of cases) {
    const bridge = new FirebaseAdminAuthBridge(auth, fakeFirestore(item.doc), timestamp, true);
    await assert.rejects(() => bridge.assertDirectoryAccount("uid", item.claims), item.pattern);
  }
});
