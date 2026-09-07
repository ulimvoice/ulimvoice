import test from "node:test";
import assert from "node:assert/strict";
import { deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getOrInitializeDefaultFirebaseAdminApp } from "../src/common/firebaseAdminApp.js";

async function clearAdminApps(): Promise<void> {
  await Promise.all(getApps().map((app) => deleteApp(app)));
}

test("default Admin app is created even when a named app already exists", async () => {
  await clearAdminApps();
  try {
    initializeApp({ projectId: "ulim-admin-app-test" }, "named-only");
    assert.equal(getApps().some((app) => app.name === "[DEFAULT]"), false);

    const defaultApp = getOrInitializeDefaultFirebaseAdminApp();

    assert.equal(defaultApp.name, "[DEFAULT]");
    assert.equal(getApps().some((app) => app.name === "named-only"), true);
    assert.equal(getApps().some((app) => app.name === "[DEFAULT]"), true);
  } finally {
    await clearAdminApps();
  }
});

test("existing default Admin app is reused", async () => {
  await clearAdminApps();
  try {
    const existing = initializeApp({ projectId: "ulim-admin-app-test" });
    const resolved = getOrInitializeDefaultFirebaseAdminApp();
    assert.equal(resolved, existing);
    assert.equal(getApps().length, 1);
  } finally {
    await clearAdminApps();
  }
});
