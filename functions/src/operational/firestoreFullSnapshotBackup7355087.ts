import { createHmac, randomUUID } from "node:crypto";
import { getFirestore, type DocumentData } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";

export const FULL_FIRESTORE_SNAPSHOT_BACKUP_7355087_VERSION =
  "2026-08-18.735.05.0.87-r29.9.8-dual-bank-full-firestore-snapshot";

const ULIM_LEGACY_PROOF_HMAC_SECRET = defineSecret("ULIM_LEGACY_PROOF_HMAC_SECRET");
const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbyS3QUvrjNbwvaw92_g-QKQyN3Yito8DAdpAjxUzfnsuVf3Ce7ccuaXIv651U7FnYF4/exec";
const GAS_ACTION = "firebaseDataAuthorityBackup735414";
const GAS_MAX_ROWS_PER_REQUEST = 20;
const GAS_MAX_BODY_BYTES = 2_800_000;

// This is intentionally an explicit allow-list.
// Do not silently sweep unknown/system/debug collections into Google Sheets.
const FULL_SNAPSHOT_COLLECTIONS_7355087 = [
  "users",
  "teachers",
  "students",
  "classes",
  "studentEnrollments",
  "classMembers",
  "attendance",
  "attendanceSessionOverrides",
  "classScheduleChanges",
  "realtimeClassroomDays",
  "staffOperationalDays",
  "dailyEvaluations",
  "courseApplications",
  "courseApplicationWindows",
  "roomReservations",
  "messageDeliveries",
  "staffPrivateNotes",
  "tabletAttendanceEvents",
  "tabletDailySnapshots",
  "operationalTemplates",
  "operationalRealtimeRevisions",
  "payments",
  "practiceAnalysisRuns",
  "practiceContent",
  "practiceNotificationJobs",
  "practicePushTokens",
  "practiceRecords",
  "practiceRoomAdminPushTokens",
  "practiceRoomLegacyMonths",
  "practiceRoomMutationRequests",
  "practiceRoomDecisionNotificationJobs",
  "practiceTeacherEvaluations",
  "practiceTrainingSamples"
] as const;

type PlainObject = Record<string, unknown>;
type BackupRow = { documentId: string; data: PlainObject };

function db() {
  return getFirestore(getOrInitializeDefaultFirebaseAdminApp());
}
function object(value: unknown): PlainObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as PlainObject : {};
}
function text(value: unknown, max = 1200): string {
  return String(value ?? "").trim().slice(0, max);
}
function kstDateKey(now = Date.now()): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function activeBank7355087(dateKey: string): "A" | "B" {
  const digit = Number(dateKey.replace(/\D/g, "").slice(-1) || "0");
  return digit % 2 === 0 ? "A" : "B";
}
function base64Url(input: Buffer): string {
  return input.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function sign(requestId: string, issuedAtMs: number, payloadJson: string): string {
  const secret = ULIM_LEGACY_PROOF_HMAC_SECRET.value();
  if (!secret) throw new Error("ULIM_LEGACY_PROOF_HMAC_SECRET_NOT_CONFIGURED");
  return base64Url(
    createHmac("sha256", secret)
      .update(`v1|${GAS_ACTION}|${requestId}|${issuedAtMs}|${payloadJson}`, "utf8")
      .digest()
  );
}
function normalizeFirestoreValue7355087(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue7355087);
  if (typeof value !== "object") return value;

  const candidate = value as Record<string, unknown> & {
    toDate?: () => Date;
    path?: string;
    latitude?: number;
    longitude?: number;
  };
  if (typeof candidate.toDate === "function") {
    try {
      const date = candidate.toDate();
      if (date instanceof Date && Number.isFinite(date.getTime())) {
        return { __firestoreType: "timestamp", iso: date.toISOString(), ms: date.getTime() };
      }
    } catch {}
  }
  if (typeof candidate.path === "string" && candidate.path) {
    const keys = Object.keys(candidate);
    if (keys.length <= 8) return { __firestoreType: "documentReference", path: candidate.path };
  }
  if (typeof candidate.latitude === "number" && typeof candidate.longitude === "number") {
    return {
      __firestoreType: "geoPoint",
      latitude: candidate.latitude,
      longitude: candidate.longitude
    };
  }

  const out: PlainObject = {};
  for (const [key, item] of Object.entries(candidate)) {
    if (typeof item === "function" || typeof item === "undefined") continue;
    out[key] = normalizeFirestoreValue7355087(item);
  }
  return out;
}
function normalizeDoc7355087(id: string, data: DocumentData): BackupRow {
  return {
    documentId: id,
    data: object(normalizeFirestoreValue7355087(data))
  };
}
function bodyBytes7355087(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
function chunkRows7355087(rows: BackupRow[]): BackupRow[][] {
  if (!rows.length) return [[]];
  const chunks: BackupRow[][] = [];
  let current: BackupRow[] = [];

  for (const row of rows) {
    const candidate = [...current, row];
    if (
      current.length > 0 &&
      (candidate.length > GAS_MAX_ROWS_PER_REQUEST || bodyBytes7355087(candidate) > GAS_MAX_BODY_BYTES)
    ) {
      chunks.push(current);
      current = [row];
    } else {
      current = candidate;
    }
    if (bodyBytes7355087(current) > GAS_MAX_BODY_BYTES) {
      throw new Error(`BACKUP_ROW_TOO_LARGE:${row.documentId}`);
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}
async function postGas7355087(payload: PlainObject, requestId: string): Promise<PlainObject> {
  const issuedAtMs = Date.now();
  const payloadJson = JSON.stringify(payload);
  const envelope = {
    action: GAS_ACTION,
    requestId,
    issuedAtMs,
    payloadJson,
    signature: sign(requestId, issuedAtMs, payloadJson)
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 240_000);
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(envelope),
      signal: controller.signal,
      redirect: "follow"
    });
    const raw = await response.text();
    let result: PlainObject = {};
    try { result = object(raw ? JSON.parse(raw) : {}); }
    catch { throw new Error(`FULL_BACKUP_GAS_INVALID_JSON:${raw.slice(0, 500)}`); }
    if (!response.ok || text(result.status, 30) !== "success") {
      throw new Error(`FULL_BACKUP_GAS_FAILED:${response.status}:${text(result.message ?? raw, 1600)}`);
    }
    return result;
  } finally {
    clearTimeout(timer);
  }
}
async function readCollection7355087(collectionName: string): Promise<BackupRow[]> {
  const snapshot = await db().collection(collectionName).get();
  return snapshot.docs.map(doc => normalizeDoc7355087(doc.id, doc.data()));
}
async function replaceDataset7355087(
  logicalDataset: string,
  sheetDataset: string,
  rows: BackupRow[],
  backupId: string
): Promise<{ dataset: string; sheetDataset: string; rows: number; chunks: number }> {
  const chunks = chunkRows7355087(rows);
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const requestId =
      `full-snapshot-${backupId}-${sheetDataset}-${String(chunkIndex).padStart(5, "0")}-${randomUUID()}`;
    await postGas7355087({
      version: FULL_FIRESTORE_SNAPSHOT_BACKUP_7355087_VERSION,
      sourceOfTruth: "firestore",
      sheetAuthority: "backup_only",
      logicalDataset,
      dataset: sheetDataset,
      backupId,
      mode: "full",
      replaceDataset: true,
      firstChunk: chunkIndex === 0,
      chunkIndex,
      chunkCount: chunks.length,
      rows: chunks[chunkIndex]
    }, requestId);
  }
  return { dataset: logicalDataset, sheetDataset, rows: rows.length, chunks: chunks.length };
}
async function writeManifest7355087(
  dateKey: string,
  bank: "A" | "B",
  backupId: string,
  results: Array<{ dataset: string; sheetDataset: string; rows: number; chunks: number }>
): Promise<void> {
  const rowCounts = Object.fromEntries(results.map(item => [item.dataset, item.rows]));
  const manifestRow: BackupRow = {
    documentId: "current",
    data: {
      version: FULL_FIRESTORE_SNAPSHOT_BACKUP_7355087_VERSION,
      snapshotDate: dateKey,
      completedAt: new Date().toISOString(),
      completedAtMs: Date.now(),
      bank,
      backupId,
      datasetCount: results.length,
      rowCounts,
      datasets: results.map(item => item.dataset),
      sourceOfTruth: "firestore",
      sheetAuthority: "backup_only",
      restoreRule: `FS백업_full${bank}_* 탭만 사용`
    }
  };
  await replaceDataset7355087(
    "fullSnapshotManifest",
    "fullSnapshotManifest",
    [manifestRow],
    backupId
  );
}
async function runFullSnapshot7355087(): Promise<PlainObject> {
  const dateKey = kstDateKey();
  const bank = activeBank7355087(dateKey);
  const backupId = `full-${dateKey}-bank${bank}`;
  const results: Array<{ dataset: string; sheetDataset: string; rows: number; chunks: number }> = [];

  // Dual-bank rule:
  // - today's bank is fully rewritten collection-by-collection.
  // - the manifest is changed only AFTER every collection succeeds.
  // Therefore a failed run cannot invalidate the previous completed bank.
  for (const collectionName of FULL_SNAPSHOT_COLLECTIONS_7355087) {
    const rows = await readCollection7355087(collectionName);
    const sheetDataset = `full${bank}_${collectionName}`;
    results.push(await replaceDataset7355087(collectionName, sheetDataset, rows, backupId));
  }

  await writeManifest7355087(dateKey, bank, backupId, results);

  return {
    ok: true,
    version: FULL_FIRESTORE_SNAPSHOT_BACKUP_7355087_VERSION,
    snapshotDate: dateKey,
    bank,
    backupId,
    datasetCount: results.length,
    totalRows: results.reduce((sum, item) => sum + item.rows, 0),
    results,
    sourceOfTruth: "firestore",
    sheetAuthority: "backup_only"
  };
}

// Runs after the 06:00 attendance/classroom mirror and after the legacy 06:15 backup.
// It writes only the isolated fullA/fullB snapshot namespace, so it cannot race with
// the existing FS백업_* tabs and does not affect any app read/write path.
export const exportFirestoreFullSnapshotDaily06257355087 = onSchedule(
  {
    schedule: "25 6 * * *",
    timeZone: "Asia/Seoul",
    region: ULIM_FUNCTION_REGION,
    secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET],
    timeoutSeconds: 1800,
    memory: "1GiB",
    retryCount: 1
  },
  async () => {
    const result = await runFullSnapshot7355087();
    console.log("[ULIM 7355087 full Firestore snapshot]", JSON.stringify({
      snapshotDate: result.snapshotDate,
      bank: result.bank,
      datasetCount: result.datasetCount,
      totalRows: result.totalRows
    }));
  }
);

export const runFirestoreFullSnapshotAdmin7355087 = onCall(
  {
    region: ULIM_FUNCTION_REGION,
    cors: true,
    enforceAppCheck: false,
    timeoutSeconds: 1800,
    memory: "1GiB",
    secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET]
  },
  async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Firebase 로그인이 필요합니다.");
    const role = text(request.auth.token.role, 40);
    if (role !== "admin" && role !== "superAdmin") {
      throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }
    try {
      return await runFullSnapshot7355087();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HttpsError("internal", message.slice(0, 1800));
    }
  }
);
