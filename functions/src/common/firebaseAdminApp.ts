import { getApp, initializeApp, type App } from "firebase-admin/app";

/**
 * Returns the Firebase Admin default app, creating it when it does not exist.
 *
 * Do not use getApps().length for this check: a process may contain only a
 * named app, in which case getApps() is non-empty while getFirestore() still
 * fails because the [DEFAULT] app is missing.
 */
export function getOrInitializeDefaultFirebaseAdminApp(): App {
  try {
    return getApp();
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "app/no-app") {
      return initializeApp();
    }
    throw error;
  }
}
