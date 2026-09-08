import { createHmac, timingSafeEqual } from "node:crypto";
import {
  FieldValue,
  getFirestore,
  type DocumentSnapshot,
  type Transaction
} from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_LEGACY_PROOF_HMAC_SECRET } from "../common/firebaseSecrets.js";
import type { UlimRole } from "../common/roles.js";
import {
  normalizeRealtimeAuthVersion,
  type RealtimeAuthVersion
} from "./realtimeAuthVersion.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "./realtimeCallableOptions.js";
import {
  expandClassroomRecordsToHourly,
  makeClassroomSlotKey,
  sortClassroomRecords,
  type ClassroomRecordLike
} from "./classroomFirestoreFirstCore.js";

const VERSION = "2026-07-30.729.06";
const RECEIPT_AUDIENCE = "ulim-classroom-sheet-receipt-7296";
const RECEIPT_MAX_AGE_MS = 5 * 60_000;
const FINALIZE_CALLABLE_OPTIONS = {
  ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  secrets: [ULIM_LEGACY_PROOF_HMAC_SECRET]
};
const STAFF_ROLES = new Set<UlimRole>(["teacher", "admin", "superAdmin"]);
const FULL_ADMIN_ROLES = new Set<UlimRole>(["admin", "superAdmin"]);
const CLASSROOM_ROOMS = new Set([
  "2강의실", "3강의실", "4강의실", "5강의실", "녹음실", "신체훈련실"
]);
const CLAIM_TTL_MS = 60_000;
const MAX_SLOTS = 12;
const MAX_RECORDS = 180;
const MAX_TEXT = 200;
const MAX_MEMO = 500;

type MutationOperation = "save" | "release" | "update";

interface ActiveCaller {
  firebaseUid: string;
  role: UlimRole;
  authVersion: RealtimeAuthVersion;
}

interface MutationSlot {
  room: string;
  startHour: number;
  endHour: number;
  slotKey: string;
}

interface StoredClassroomRecord extends ClassroomRecordLike {
  recordId: string;
  date: string;
  room: string;
  startHour: number;
  endHour: number;
  slotKey: string;
  instructor: string;
  className: string;
  purpose: string;
  status: "사용중";
  memo: string;
  sheetName: string;
  source?: string;
  syncState?: string;
  canonicalMutationId?: string;
}

interface AuthoritativeSlot {
  date: string;
  room: string;
  startHour: number;
  endHour: number;
  slotKey: string;
  occupied: boolean;
  recordId: string;
  instructor: string;
  className: string;
  purpose: string;
  memo: string;
  sheetName: string;
}

interface SignedSheetReceiptPayload {
  v: 1;
  aud: string;
  requestId: string;
  date: string;
  revision: string;
  issuedAtMs: number;
  slots: unknown[];
}

interface ClaimData {
  date: string;
  room: string;
  startHour: number;
  endHour: number;
  slotKey: string;
  mutationId: string;
  operation: MutationOperation;
  requestedInstructor: string;
  className: string;
  memo: string;
  override: boolean;
  createdByFirebaseUid: string;
  createdByRole: UlimRole;
  createdAtMs: number;
  expiresAtMs: number;
}

export const beginClassroomSheetCanonicalMutation = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const caller = await requireActiveStaff(request);
    const input = parseObject(request.data);
    const mutationId = parseRequestId(input.mutationId ?? input.requestId, 150);
    const date = parseDate(input.date);
    const operation = parseOperation(input.operation);
    const slots = parseSlots(input.slots, date);
    const requestedInstructor = cleanOptionalText(
      input.assignedInstructor ?? input.instructor,
      MAX_TEXT
    );
    const className = cleanOptionalText(input.className ?? input.purpose, MAX_TEXT);
    const memo = cleanOptionalText(input.memo, MAX_MEMO);
    const override = parseBoolean(input.override);

    if (operation === "update" || override) {
      if (!FULL_ADMIN_ROLES.has(caller.role)) {
        throw new HttpsError("permission-denied", "관리자 배정/용도변경 권한이 필요합니다.");
      }
    }
    if (operation !== "release" && !requestedInstructor) {
      throw new HttpsError("invalid-argument", "배정 강사명을 확인해주세요.");
    }

    const db = getFirestore(getOrInitializeDefaultFirebaseAdminApp());
    const claimRefs = slots.map(slot => db.collection("classroomSlotClaims").doc(slot.slotKey));
    const nowMs = Date.now();
    const expiresAtMs = nowMs + CLAIM_TTL_MS;

    /*
     * Google Sheets is canonical. The transaction only serializes app-side
     * concurrent mutations. It intentionally does not reject a request from a
     * possibly stale confirmed Firestore snapshot; the locked GAS mutation
     * reads the actual sheet cells and returns the authoritative slot values.
     */
    const result = await db.runTransaction(async (transaction: Transaction) => {
      const claimSnapshots = await Promise.all(
        claimRefs.map(ref => transaction.get(ref))
      );
      const conflicts: Array<Record<string, unknown>> = [];

      slots.forEach((slot, index) => {
        const claimSnapshot = claimSnapshots[index];
        const claim = claimSnapshot.exists ? (claimSnapshot.data() ?? {}) : {};
        const existingMutationId = String(claim.mutationId || "");
        const existingExpiresAtMs = readSafeInteger(claim.expiresAtMs, 0);

        if (
          existingMutationId &&
          existingMutationId !== mutationId &&
          existingExpiresAtMs > nowMs
        ) {
          conflicts.push({
            type: "pending",
            room: slot.room,
            startHour: slot.startHour,
            endHour: slot.endHour,
            slotKey: slot.slotKey,
            occupiedBy: cleanOptionalText(claim.requestedInstructor, MAX_TEXT),
            expiresAtMs: existingExpiresAtMs
          });
        }
      });

      if (conflicts.length) {
        return { accepted: false, conflicts };
      }

      slots.forEach((slot, index) => {
        const claim: ClaimData = {
          date,
          room: slot.room,
          startHour: slot.startHour,
          endHour: slot.endHour,
          slotKey: slot.slotKey,
          mutationId,
          operation,
          requestedInstructor,
          className,
          memo,
          override,
          createdByFirebaseUid: caller.firebaseUid,
          createdByRole: caller.role,
          createdAtMs: nowMs,
          expiresAtMs
        };
        transaction.set(claimRefs[index], {
          ...claim,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          schemaVersion: 1,
          version: VERSION
        }, { merge: false });
      });

      return { accepted: true, conflicts: [] };
    });

    if (!result.accepted) {
      throw new HttpsError(
        "already-exists",
        "다른 사용자 또는 Google Sheets의 기존 기록과 충돌했습니다.",
        { conflicts: result.conflicts }
      );
    }

    return {
      ok: true,
      version: VERSION,
      mutationId,
      date,
      operation,
      expiresAtMs,
      slots
    };
  }
);

export const finalizeClassroomSheetCanonicalMutation = onCall(
  FINALIZE_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const caller = await requireActiveStaff(request);
    const input = parseObject(request.data);
    const mutationId = parseRequestId(input.mutationId ?? input.requestId, 150);
    const date = parseDate(input.date);
    const receipt = cleanText(input.receipt, 32_000, "receipt");
    const receiptPayload = verifySheetReceipt(
      receipt,
      ULIM_LEGACY_PROOF_HMAC_SECRET.value() || process.env.ULIM_LEGACY_PROOF_HMAC_SECRET || "",
      mutationId,
      date
    );
    const month = date.slice(0, 7);
    const revision = cleanOptionalText(receiptPayload.revision, 180);
    const authoritativeSlots = parseAuthoritativeSlots(receiptPayload.slots, date);

    const db = getFirestore(getOrInitializeDefaultFirebaseAdminApp());
    const dayRef = db.collection("realtimeClassroomDays").doc(date);
    const monthRef = db.collection("realtimeRoomMonths").doc(month);
    const claimRefs = authoritativeSlots.map(slot =>
      db.collection("classroomSlotClaims").doc(slot.slotKey)
    );

    const result = await db.runTransaction(async (transaction: Transaction) => {
      const snapshots = await Promise.all([
        transaction.get(dayRef),
        transaction.get(monthRef),
        ...claimRefs.map(ref => transaction.get(ref))
      ]);
      const daySnapshot = snapshots[0] as DocumentSnapshot;
      const monthSnapshot = snapshots[1] as DocumentSnapshot;
      const claimSnapshots = snapshots.slice(2) as DocumentSnapshot[];
      const current = parseStoredRecords(daySnapshot.data()?.records, date);
      const lastMutationBySlot = parseStringMap(daySnapshot.data()?.lastCanonicalMutationBySlot);

      authoritativeSlots.forEach((slot, index) => {
        const claimSnapshot = claimSnapshots[index];
        if (claimSnapshot.exists) {
          const claim = claimSnapshot.data() ?? {};
          if (String(claim.mutationId || "") !== mutationId) {
            throw new HttpsError(
              "aborted",
              "더 최신 강의실 작업이 있어 이전 결과를 반영하지 않았습니다."
            );
          }
          if (String(claim.createdByFirebaseUid || "") !== caller.firebaseUid) {
            throw new HttpsError("permission-denied", "강의실 작업 생성 계정이 일치하지 않습니다.");
          }
          return;
        }
        if (lastMutationBySlot[slot.slotKey] !== mutationId) {
          throw new HttpsError(
            "failed-precondition",
            "강의실 임시 작업이 만료되었습니다. 시트 기준으로 다시 동기화해주세요."
          );
        }
      });

      const targetKeys = new Set(authoritativeSlots.map(slot => slot.slotKey));
      const next: StoredClassroomRecord[] = current.filter(record => !targetKeys.has(record.slotKey));
      authoritativeSlots.forEach(slot => {
        lastMutationBySlot[slot.slotKey] = mutationId;
        if (!slot.occupied) return;
        next.push({
          recordId: slot.recordId || `SHEETFAST|${date}|${slot.room}|${slot.startHour}`,
          date,
          room: slot.room,
          startHour: slot.startHour,
          endHour: slot.endHour,
          slotKey: slot.slotKey,
          instructor: slot.instructor,
          className: slot.className,
          purpose: slot.purpose || slot.className,
          status: "사용중",
          memo: slot.memo,
          sheetName: slot.sheetName,
          source: "sheet_authoritative_fast_7296",
          syncState: "sheet_synced",
          canonicalMutationId: mutationId
        });
      });

      const sorted = sortClassroomRecords(next);
      if (sorted.length > MAX_RECORDS) {
        throw new HttpsError("resource-exhausted", "강의실 기록 개수가 허용 범위를 초과했습니다.");
      }
      const classroomByDate = parseClassroomByDate(monthSnapshot.data()?.classroomByDate);
      classroomByDate[date] = sorted;
      const nowMs = Date.now();

      transaction.set(dayRef, {
        date,
        records: sorted,
        recordCount: sorted.length,
        lastCanonicalMutationBySlot: lastMutationBySlot,
        sourceObservedAtMs: nowMs,
        sourceRequestId: mutationId,
        sheetRevision: revision,
        writeMode: "sheet_canonical_fast_finalize",
        updatedByFirebaseUid: caller.firebaseUid,
        updatedByRole: caller.role,
        updatedAt: FieldValue.serverTimestamp(),
        schemaVersion: 4,
        version: VERSION
      }, { merge: true });

      transaction.set(monthRef, {
        month,
        classroomByDate,
        classroomSourceObservedAtMs: nowMs,
        classroomSourceRequestId: mutationId,
        classroomSheetRevision: revision,
        classroomWriteMode: "sheet_canonical_fast_finalize",
        classroomUpdatedByFirebaseUid: caller.firebaseUid,
        classroomUpdatedByRole: caller.role,
        classroomUpdatedAt: FieldValue.serverTimestamp(),
        schemaVersion: 4,
        version: VERSION
      }, { merge: true });

      claimRefs.forEach(ref => transaction.delete(ref));
      return sorted;
    });

    return {
      ok: true,
      version: VERSION,
      mutationId,
      date,
      month,
      revision,
      count: result.length,
      records: result
    };
  }
);

export const abortClassroomSheetCanonicalMutation = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const caller = await requireActiveStaff(request);
    const input = parseObject(request.data);
    const mutationId = parseRequestId(input.mutationId ?? input.requestId, 150);
    const date = parseDate(input.date);
    const slots = parseSlots(input.slots, date);
    const db = getFirestore(getOrInitializeDefaultFirebaseAdminApp());
    const refs = slots.map(slot => db.collection("classroomSlotClaims").doc(slot.slotKey));

    await db.runTransaction(async (transaction: Transaction) => {
      const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
      snapshots.forEach((snapshot: DocumentSnapshot, index: number) => {
        if (!snapshot.exists) return;
        const data = snapshot.data() ?? {};
        if (String(data.mutationId || "") !== mutationId) return;
        if (String(data.createdByFirebaseUid || "") !== caller.firebaseUid) return;
        transaction.delete(refs[index]);
      });
    });

    return { ok: true, version: VERSION, mutationId, date };
  }
);

async function requireActiveStaff(request: CallableRequest<unknown>): Promise<ActiveCaller> {
  if (!request.auth) throw new HttpsError("unauthenticated", "Firebase login is required");
  const firebaseUid = cleanText(request.auth.uid, 128, "firebase uid");
  const role = parseRole(request.auth.token.role);
  if (!STAFF_ROLES.has(role)) throw new HttpsError("permission-denied", "staff role is required");
  const authVersion = normalizeRealtimeAuthVersion(request.auth.token.authVersion);
  if (authVersion === null) throw new HttpsError("permission-denied", "authVersion is invalid");
  const db = getFirestore(getOrInitializeDefaultFirebaseAdminApp());
  const userSnapshot = await db.collection("users").doc(firebaseUid).get();
  if (!userSnapshot.exists) throw new HttpsError("permission-denied", "firebase access document is missing");
  const user = userSnapshot.data() ?? {};
  const storedAuthVersion = normalizeRealtimeAuthVersion(user.authVersion);
  if (user.active !== true || user.role !== role || storedAuthVersion !== authVersion) {
    throw new HttpsError("permission-denied", "firebase access document is stale or inactive");
  }
  if (role === "teacher") {
    const teacherUid = optionalCleanText(request.auth.token.teacherUid, 128, "teacherUid");
    if (!teacherUid || user.teacherUid !== teacherUid || user.studentUid !== undefined) {
      throw new HttpsError("permission-denied", "teacher identity claim mismatch");
    }
  } else if (user.studentUid !== undefined || user.teacherUid !== undefined) {
    throw new HttpsError("permission-denied", "staff identity document contains stale scoped uid");
  }
  return { firebaseUid, role, authVersion };
}

function verifySheetReceipt(
  receipt: string,
  secret: string,
  expectedMutationId: string,
  expectedDate: string
): SignedSheetReceiptPayload {
  if (!secret.trim()) {
    throw new HttpsError("failed-precondition", "강의실 시트 영수증 검증 비밀키가 설정되지 않았습니다.");
  }
  const parts = receipt.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new HttpsError("invalid-argument", "강의실 시트 영수증 형식이 올바르지 않습니다.");
  }
  const signingInput = `${parts[0]}.${parts[1]}`;
  const expected = createHmac("sha256", secret).update(signingInput, "utf8").digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(parts[2], "base64url");
  } catch {
    throw new HttpsError("permission-denied", "강의실 시트 영수증 서명이 올바르지 않습니다.");
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new HttpsError("permission-denied", "강의실 시트 영수증 서명이 일치하지 않습니다.");
  }
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new HttpsError("invalid-argument", "강의실 시트 영수증 내용을 읽지 못했습니다.");
  }
  const data = parseObject(payload);
  const parsed: SignedSheetReceiptPayload = {
    v: Number(data.v) as 1,
    aud: cleanOptionalText(data.aud, 100),
    requestId: parseRequestId(data.requestId, 150),
    date: parseDate(data.date),
    revision: cleanOptionalText(data.revision, 180),
    issuedAtMs: readSafeInteger(data.issuedAtMs, 0),
    slots: Array.isArray(data.slots) ? data.slots : []
  };
  if (parsed.v !== 1 || parsed.aud !== RECEIPT_AUDIENCE) {
    throw new HttpsError("permission-denied", "강의실 시트 영수증 대상이 올바르지 않습니다.");
  }
  if (parsed.requestId !== expectedMutationId || parsed.date !== expectedDate) {
    throw new HttpsError("permission-denied", "강의실 시트 영수증이 현재 작업과 일치하지 않습니다.");
  }
  const ageMs = Date.now() - parsed.issuedAtMs;
  if (!parsed.issuedAtMs || ageMs < -30_000 || ageMs > RECEIPT_MAX_AGE_MS) {
    throw new HttpsError("deadline-exceeded", "강의실 시트 영수증이 만료되었습니다.");
  }
  if (!parsed.slots.length || parsed.slots.length > MAX_SLOTS) {
    throw new HttpsError("invalid-argument", "강의실 시트 영수증 시간 칸이 올바르지 않습니다.");
  }
  return parsed;
}

function parseSlots(value: unknown, date: string): MutationSlot[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_SLOTS) {
    throw new HttpsError("invalid-argument", "slots are invalid");
  }
  const seen = new Set<string>();
  const slots = value.map((entry, index) => {
    const data = parseObject(entry);
    const room = parseRoom(data.room);
    const startHour = parseHour(data.startHour ?? data.hour, `slots[${index}].startHour`);
    const endHour = parseHour(data.endHour ?? startHour + 1, `slots[${index}].endHour`);
    if (endHour !== startHour + 1) {
      throw new HttpsError("invalid-argument", "강의실 작업은 한 시간 칸 단위로 처리합니다.");
    }
    const slotKey = makeClassroomSlotKey(date, room, startHour);
    if (seen.has(slotKey)) throw new HttpsError("invalid-argument", "중복된 시간 칸이 포함되어 있습니다.");
    seen.add(slotKey);
    return { room, startHour, endHour, slotKey };
  });
  const first = slots[0];
  slots.forEach((slot, index) => {
    if (slot.room !== first.room || slot.startHour !== first.startHour + index) {
      throw new HttpsError("invalid-argument", "강의실 시간 칸은 같은 강의실의 연속된 범위여야 합니다.");
    }
  });
  return slots;
}

function parseAuthoritativeSlots(value: unknown, date: string): AuthoritativeSlot[] {
  const slots = parseSlots(value, date);
  return slots.map((slot, index) => {
    const data = parseObject((value as unknown[])[index]);
    const occupied = parseBoolean(data.occupied);
    return {
      ...slot,
      date,
      occupied,
      recordId: cleanOptionalText(data.recordId, 256),
      instructor: occupied ? cleanOptionalText(data.instructor ?? data.adminName, MAX_TEXT) : "",
      className: occupied ? cleanOptionalText(data.className ?? data.purpose, MAX_TEXT) : "",
      purpose: occupied ? cleanOptionalText(data.purpose ?? data.className, MAX_TEXT) : "",
      memo: occupied ? cleanOptionalText(data.memo, MAX_MEMO) : "",
      sheetName: occupied ? cleanOptionalText(data.sheetName, MAX_TEXT) : ""
    };
  });
}

function parseStoredRecords(value: unknown, date: string): StoredClassroomRecord[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_RECORDS) {
    throw new HttpsError("failed-precondition", "stored classroom records are invalid");
  }
  const records = value.map((entry, index) => {
    const data = parseObject(entry);
    const room = parseRoom(data.room);
    const startHour = parseHour(data.startHour, `records[${index}].startHour`);
    const endHour = parseHour(data.endHour, `records[${index}].endHour`);
    if (endHour <= startHour) {
      throw new HttpsError("failed-precondition", `records[${index}] time range is invalid`);
    }
    return {
      recordId: cleanText(
        data.recordId ?? `${date}|${room}|${startHour}|${endHour}`,
        256,
        `records[${index}].recordId`
      ),
      date,
      room,
      startHour,
      endHour,
      slotKey: cleanOptionalText(data.slotKey, 128) || makeClassroomSlotKey(date, room, startHour),
      instructor: cleanOptionalText(data.instructor ?? data.adminName, MAX_TEXT),
      className: cleanOptionalText(data.className ?? data.purpose, MAX_TEXT),
      purpose: cleanOptionalText(data.purpose ?? data.className, MAX_TEXT),
      status: "사용중" as const,
      memo: cleanOptionalText(data.memo, MAX_MEMO),
      sheetName: cleanOptionalText(data.sheetName, MAX_TEXT),
      source: cleanOptionalText(data.source, 100),
      syncState: cleanOptionalText(data.syncState, 40),
      canonicalMutationId: cleanOptionalText(data.canonicalMutationId, 150)
    };
  });
  return expandClassroomRecordsToHourly(records) as StoredClassroomRecord[];
}

function parseClassroomByDate(value: unknown): Record<string, StoredClassroomRecord[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const output: Record<string, StoredClassroomRecord[]> = {};
  for (const [date, records] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(records)) continue;
    output[date] = (records as StoredClassroomRecord[]).slice(0, MAX_RECORDS);
  }
  return output;
}

function parseStringMap(value: unknown): Record<string, string> {
  const output: Record<string, string> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return output;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const text = cleanOptionalText(raw, 150);
    if (text) output[key] = text;
  }
  return output;
}

function parseObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "input must be an object");
  }
  return value as Record<string, unknown>;
}

function parseDate(value: unknown): string {
  const date = cleanText(value, 10, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError("invalid-argument", "date must be YYYY-MM-DD");
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpsError("invalid-argument", "date is invalid");
  }
  return date;
}

function parseRoom(value: unknown): string {
  const normalized = cleanText(value, 40, "room").replace(/\s+/g, "");
  const matched = [...CLASSROOM_ROOMS].find(room => room.replace(/\s+/g, "") === normalized);
  if (!matched) throw new HttpsError("invalid-argument", "room is invalid");
  return matched;
}

function parseHour(value: unknown, fieldName: string): number {
  const hour = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 24) {
    throw new HttpsError("invalid-argument", `${fieldName} is invalid`);
  }
  return hour;
}

function parseOperation(value: unknown): MutationOperation {
  const operation = String(value || "save");
  if (operation === "save" || operation === "release" || operation === "update") return operation;
  throw new HttpsError("invalid-argument", "operation is invalid");
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || String(value || "").toLowerCase() === "true";
}

function parseRequestId(value: unknown, maxLength: number): string {
  const requestId = cleanText(value, maxLength, "requestId");
  if (!/^[A-Za-z0-9._:-]+$/.test(requestId)) {
    throw new HttpsError("invalid-argument", "requestId is invalid");
  }
  return requestId;
}

function parseRole(value: unknown): UlimRole {
  if (typeof value !== "string" || !STAFF_ROLES.has(value as UlimRole)) {
    throw new HttpsError("permission-denied", "firebase role is invalid");
  }
  return value as UlimRole;
}

function cleanText(value: unknown, maxLength: number, fieldName: string): string {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `${fieldName} must be a string`);
  }
  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new HttpsError("invalid-argument", `${fieldName} is invalid`);
  }
  return text;
}

function cleanOptionalText(value: unknown, maxLength: number): string {
  if (value === undefined || value === null) return "";
  return String(value).trim().slice(0, maxLength);
}

function optionalCleanText(value: unknown, maxLength: number, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return cleanText(value, maxLength, fieldName);
}

function readSafeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : fallback;
}
