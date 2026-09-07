/* global process, fetch, console, setTimeout */
import { randomBytes } from "node:crypto";
import { deleteApp as deleteAdminApp, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { deleteApp as deleteClientApp, initializeApp as initializeClientApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDocFromServer, getFirestore } from "firebase/firestore";
import {
  createLegacyAuthProof,
  LEGACY_AUTH_AUDIENCE
} from "../lib/src/auth/legacySessionBridge.js";
import { ULIM_FUNCTION_REGION } from "../lib/src/common/firebaseRegion.js";

const secret = process.env.ULIM_LEGACY_PROOF_HMAC_SECRET;
if (!secret) throw new Error("ULIM_LEGACY_PROOF_HMAC_SECRET is required");
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "ulimvoice-phase2-2-test";
const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const endpoint = `http://${functionsHost}/${projectId}/${ULIM_FUNCTION_REGION}/exchangeLegacySession`;

function makeProof(legacyUid = "transport-student", studentUid = "transport-student") {
  const now = Math.floor(Date.now() / 1000);
  return createLegacyAuthProof({
    v: 1,
    jti: randomBytes(32).toString("hex"),
    aud: LEGACY_AUTH_AUDIENCE,
    iat: now,
    exp: now + 90,
    role: "student",
    legacyUid,
    studentUid,
    accountState: "active"
  }, secret);
}

async function callExchange(data, idToken) {
  const headers = { "Content-Type": "application/json" };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ data })
  });
  const text = await response.text();
  return { response, text };
}

const proof = makeProof();
const { response, text } = await withTimeout(callExchange({ proof }), "unauthenticated callable exchange");
console.log("callable unauth status:", response.status);
if (!response.ok) {
  console.log("callable unauth failed");
  process.exit(1);
}
const parsed = JSON.parse(text);
if (!parsed.result?.customToken || parsed.result?.ok !== true) {
  throw new Error("Callable response did not contain ok result and customToken");
}

const clientApp = initializeClientApp({ projectId, apiKey: "demo-key" }, `transport-${Date.now()}`);
const auth = getAuth(clientApp);
connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
const credential = await withTimeout(signInWithCustomToken(auth, parsed.result.customToken), "custom token login");
const idToken = await withTimeout(credential.user.getIdToken(true), "id token fetch");

const malformed = await withTimeout(callExchange({ proof: makeProof("malformed", "malformed"), extra: true }), "malformed callable exchange");
console.log("callable malformed status:", malformed.response.status);
if (malformed.response.ok || !/INVALID_ARGUMENT|invalid-argument/i.test(malformed.text)) {
  throw new Error("Malformed callable input was not rejected as invalid-argument");
}

const authed = await withTimeout(callExchange({ proof: makeProof("authed", "authed") }, idToken), "authenticated callable exchange");
console.log("callable authenticated status:", authed.response.status);
if (authed.response.ok || !/FAILED_PRECONDITION|failed-precondition/i.test(authed.text)) {
  throw new Error("Authenticated callable request was not rejected as failed-precondition");
}

const adminApp = initializeAdminApp({ projectId }, `transport-admin-${Date.now()}`);
const adminDb = getAdminFirestore(adminApp);
await adminDb.collection("attendance").doc("transport-a1").set({
  studentUid: "transport-student",
  classId: "transport-class",
  status: "present",
  active: true
});

const clientDb = getFirestore(clientApp);
const [firestoreHostname, firestorePortText] = firestoreHost.split(":");
const firestorePort = Number(firestorePortText);
if (!firestoreHostname || !Number.isInteger(firestorePort)) throw new Error(`Invalid FIRESTORE_EMULATOR_HOST: ${firestoreHost}`);
connectFirestoreEmulator(clientDb, firestoreHostname, firestorePort);
await withTimeout(getDocFromServer(doc(clientDb, "attendance/transport-a1")), "allowed firestore read");
console.log("firestore allowed read: ok");

await adminDb.collection("users").doc(credential.user.uid).set({
  studentUid: "other-student"
}, { merge: true });
let mismatchDenied = false;
try {
  await withTimeout(getDocFromServer(doc(clientDb, "attendance/transport-a1")), "uid mismatch firestore read");
} catch {
  mismatchDenied = true;
}
if (!mismatchDenied) throw new Error("UID mismatch rules read was not denied");
console.log("firestore uid mismatch denied: ok");
await deleteClientApp(clientApp);
await deleteAdminApp(adminApp);
process.exit(0);

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), 20_000);
    })
  ]);
}
