import {
  FieldValue,
  getFirestore,
  type DocumentReference,
  type DocumentSnapshot,
  type Transaction
} from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import type { UlimRole } from "../common/roles.js";
import {
  normalizeRealtimeAuthVersion,
  type RealtimeAuthVersion
} from "./realtimeAuthVersion.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "./realtimeCallableOptions.js";
import {
  expandClassroomRecordsToHourly,
  makeClassroomSlotKey,
  partitionClassroomCommit,
  sortClassroomRecords,
  type ClassroomRecordLike
} from "./classroomFirestoreFirstCore.js";

const VERSION = "2026-07-30.729.05";
const STAFF_ROLES = new Set<UlimRole>(["teacher", "admin", "superAdmin"]);
const FULL_ADMIN_ROLES = new Set<UlimRole>(["admin", "superAdmin"]);
const CLASSROOM_ROOMS = new Set([
  "2강의실", "3강의실", "4강의실", "5강의실", "녹음실", "신체훈련실"
]);
const MAX_GROUPS = 20;
const MAX_SLOTS = 60;
const MAX_RECORDS = 180;
const MAX_TEXT = 200;
const MAX_MEMO = 500;
const TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1000;

interface ActiveCaller {
  firebaseUid: string;
  role: UlimRole;
  authVersion: RealtimeAuthVersion;
}

interface StoredClassroomRecord extends ClassroomRecordLike {
  recordId: string;
  date: string;
  room: string;
  startHour: number;
  endHour: number;
  instructor: string;
  className: string;
  purpose: string;
  status: "사용중";
  memo: string;
  sheetName: string;
  slotKey: string;
  sheetRecordId?: string;
  syncState?: "pending_sheet" | "sheet_synced";
  sheetSyncJobId?: string;
  source?: string;
  createdByFirebaseUid?: string;
  createdByRole?: string;
  createdAtMs?: number;
}

type SheetOperation = "save" | "release" | "update";

interface CommitGroup { room: string; startHour: number; endHour: number; }
interface CommitSlot { room: string; startHour: number; endHour: number; slotKey: string; }

interface SheetSyncPayload {
  date: string;
  room: string;
  startHour: number;
  endHour: number;
  assignedInstructor?: string;
  className?: string;
  memo?: string;
  override?: "0" | "1";
}

interface SheetSyncJob {
  jobId: string;
  requestId: string;
  operation: SheetOperation;
  date: string;
  slotKey: string;
  dependsOnJobId?: string;
  payload: SheetSyncPayload;
}

interface ReleaseTombstone {
  jobId: string;
  createdAtMs: number;
  releasedByFirebaseUid: string;
}

export const commitClassroomUsageFirestoreFirst = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const caller = await requireActiveStaff(request);
    const input = parseObject(request.data);
    const date = parseDate(input.date);
    const month = date.slice(0, 7);
    const requestId = parseRequestId(input.requestId, 110);
    const groups = parseGroups(input.groups);
    const slots = groupsToHourlySlots(date, groups);
    const instructor = cleanOptionalText(input.assignedInstructor ?? input.instructor, MAX_TEXT);
    const className = cleanOptionalText(input.className ?? input.purpose, MAX_TEXT);
    const memo = cleanOptionalText(input.memo, MAX_MEMO);

    if (String(input.forceOverride ?? input.override ?? "0") === "1") {
      throw new HttpsError("failed-precondition", "관리자 수정은 별도 수정 경로를 사용합니다.");
    }

    const db = getFirestore(getOrInitializeDefaultFirebaseAdminApp());
    const dayRef = db.collection("realtimeClassroomDays").doc(date);
    const monthRef = db.collection("realtimeRoomMonths").doc(month);
    const jobRefs = slots.map((_, index) =>
      db.collection("classroomSheetSyncJobs").doc(makeJobId(requestId, index))
    );

    const result = await db.runTransaction(async transaction => {
      const snapshots = await Promise.all([
        transaction.get(dayRef), transaction.get(monthRef),
        ...jobRefs.map(ref => transaction.get(ref))
      ]);
      const daySnapshot = snapshots[0] as DocumentSnapshot;
      const monthSnapshot = snapshots[1] as DocumentSnapshot;
      const jobSnapshots = snapshots.slice(2) as DocumentSnapshot[];

      if (!daySnapshot.exists) {
        throw new HttpsError("failed-precondition", "강의실 실시간 기준값이 아직 준비되지 않았습니다.");
      }

      const current = parseStoredRecords(daySnapshot.data()?.records, date);
      const tombstones = parseReleaseTombstones(daySnapshot.data()?.releaseTombstones);
      const nowMs = Date.now();
      const requested: StoredClassroomRecord[] = slots.map((slot, index) => {
        const jobId = makeJobId(requestId, index);
        return {
          recordId: `fs:${jobId}`,
          date, room: slot.room, startHour: slot.startHour, endHour: slot.endHour,
          slotKey: slot.slotKey,
          instructor, className, purpose: className, status: "사용중", memo, sheetName: "",
          syncState: "pending_sheet", sheetSyncJobId: jobId,
          source: "firestore_primary_728",
          createdByFirebaseUid: caller.firebaseUid,
          createdByRole: caller.role,
          createdAtMs: nowMs
        };
      });

      const idempotentAccepted: StoredClassroomRecord[] = [];
      const newRequested: StoredClassroomRecord[] = [];
      requested.forEach((record, index) => {
        if (jobSnapshots[index]?.exists) {
          const existing = current.find(item => item.slotKey === record.slotKey);
          if (existing) idempotentAccepted.push(existing);
        } else {
          newRequested.push(record);
        }
      });

      const partition = partitionClassroomCommit(current, newRequested);
      const accepted = [...idempotentAccepted, ...partition.accepted] as StoredClassroomRecord[];
      const acceptedNewKeys = new Set(partition.accepted.map(record => record.slotKey));
      const next = sortClassroomRecords([
        ...current,
        ...(partition.accepted as StoredClassroomRecord[])
      ]);
      if (next.length > MAX_RECORDS) {
        throw new HttpsError("resource-exhausted", "강의실 기록 개수가 허용 범위를 초과했습니다.");
      }

      requested.forEach((record, index) => {
        if (!acceptedNewKeys.has(record.slotKey)) return;
        const jobId = makeJobId(requestId, index);
        const job: SheetSyncJob = {
          jobId, requestId: jobId, operation: "save", date, slotKey: record.slotKey,
          payload: {
            date, room: record.room, startHour: record.startHour, endHour: record.endHour,
            assignedInstructor: instructor, className, memo, override: "0"
          }
        };
        transaction.set(jobRefs[index], {
          ...job,
          status: "pending", attempts: 0, lastError: "",
          createdByFirebaseUid: caller.firebaseUid, createdByRole: caller.role,
          createdAtMs: nowMs, createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(), schemaVersion: 2, version: VERSION
        }, { merge: false });
        delete tombstones[record.slotKey];
      });

      if (partition.accepted.length) {
        writeDayAndMonth(transaction, dayRef, monthRef, daySnapshot, monthSnapshot, {
          date, month, records: next, tombstones, caller,
          requestId, writeMode: "firestore_primary_hourly_save", nowMs
        });
      }

      return {
        records: next,
        accepted: accepted.map(record => ({
          jobId: record.sheetSyncJobId || "", recordId: record.recordId,
          room: record.room, startHour: record.startHour, endHour: record.endHour,
          slotKey: record.slotKey
        })),
        conflicts: partition.conflicts.map(item => ({
          room: item.requested.room,
          startHour: item.requested.startHour,
          endHour: item.requested.endHour,
          slotKey: item.requested.slotKey,
          occupiedBy: {
            recordId: item.occupiedBy.recordId,
            instructor: String(item.occupiedBy.instructor || ""),
            className: String(item.occupiedBy.className || item.occupiedBy.purpose || ""),
            startHour: item.occupiedBy.startHour,
            endHour: item.occupiedBy.endHour
          }
        }))
      };
    });

    console.log("[ULIM classroom 7.28 hourly commit]", {
      firebaseUid: caller.firebaseUid, role: caller.role, date,
      accepted: result.accepted.length, conflicts: result.conflicts.length
    });
    return { ok: true, version: VERSION, date, month, ...result };
  }
);

export const releaseClassroomUsageFirestoreFirst = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const caller = await requireActiveStaff(request);
    const input = parseObject(request.data);
    const date = parseDate(input.date);
    const month = date.slice(0, 7);
    const room = parseRoom(input.room);
    const startHour = parseHour(input.startHour, "startHour");
    const endHour = parseHour(input.endHour ?? startHour + 1, "endHour");
    if (endHour !== startHour + 1) {
      throw new HttpsError("invalid-argument", "강의실 해제는 한 시간 칸씩 처리합니다.");
    }
    const slotKey = makeClassroomSlotKey(date, room, startHour);
    const requestId = parseRequestId(input.requestId, 110);
    const jobId = makeJobId(requestId, 0);

    const db = getFirestore(getOrInitializeDefaultFirebaseAdminApp());
    const dayRef = db.collection("realtimeClassroomDays").doc(date);
    const monthRef = db.collection("realtimeRoomMonths").doc(month);
    const jobRef = db.collection("classroomSheetSyncJobs").doc(jobId);

    const result = await db.runTransaction(async transaction => {
      const [daySnapshot, monthSnapshot, jobSnapshot] = await Promise.all([
        transaction.get(dayRef), transaction.get(monthRef), transaction.get(jobRef)
      ]);
      const current = parseStoredRecords(daySnapshot.data()?.records, date);
      const target = current.find(record => record.slotKey === slotKey);
      if (!target) {
        return { alreadyReleased: true, records: current, jobId: "" };
      }
      if (caller.role === "teacher" && target.createdByFirebaseUid !== caller.firebaseUid) {
        throw new HttpsError(
          "failed-precondition",
          "기존 시트 기록은 기존 해제 방식으로 처리해야 합니다."
        );
      }

      const next = current.filter(record => record.slotKey !== slotKey);
      const tombstones = parseReleaseTombstones(daySnapshot.data()?.releaseTombstones);
      const nowMs = Date.now();
      tombstones[slotKey] = {
        jobId, createdAtMs: nowMs, releasedByFirebaseUid: caller.firebaseUid
      };

      if (!jobSnapshot.exists) {
        const dependency = cleanOptionalText(target.sheetSyncJobId, 128);
        const job: SheetSyncJob = {
          jobId, requestId: jobId, operation: "release", date, slotKey,
          ...(dependency ? { dependsOnJobId: dependency } : {}),
          payload: { date, room, startHour, endHour }
        };
        transaction.set(jobRef, {
          ...job, status: "pending", attempts: 0, lastError: "",
          createdByFirebaseUid: caller.firebaseUid, createdByRole: caller.role,
          createdAtMs: nowMs, createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(), schemaVersion: 2, version: VERSION
        }, { merge: false });
      }

      writeDayAndMonth(transaction, dayRef, monthRef, daySnapshot, monthSnapshot, {
        date, month, records: next, tombstones, caller,
        requestId, writeMode: "firestore_primary_hourly_release", nowMs
      });
      return { alreadyReleased: false, records: next, jobId };
    });

    return { ok: true, version: VERSION, date, month, room, startHour, endHour, ...result };
  }
);

export const updateClassroomUsageSlotFirestoreFirst = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const caller = await requireActiveStaff(request);
    if (!FULL_ADMIN_ROLES.has(caller.role)) {
      throw new HttpsError("permission-denied", "관리자 권한이 필요합니다.");
    }
    const input = parseObject(request.data);
    const date = parseDate(input.date);
    const month = date.slice(0, 7);
    const room = parseRoom(input.room);
    const startHour = parseHour(input.startHour, "startHour");
    const endHour = parseHour(input.endHour ?? startHour + 1, "endHour");
    if (endHour !== startHour + 1) {
      throw new HttpsError("invalid-argument", "강의실 수정은 한 시간 칸씩 처리합니다.");
    }
    const slotKey = makeClassroomSlotKey(date, room, startHour);
    const requestId = parseRequestId(input.requestId, 110);
    const jobId = makeJobId(requestId, 0);
    const instructor = cleanOptionalText(input.assignedInstructor ?? input.instructor, MAX_TEXT);
    const className = cleanOptionalText(input.className ?? input.purpose, MAX_TEXT);
    const memo = cleanOptionalText(input.memo, MAX_MEMO);

    const db = getFirestore(getOrInitializeDefaultFirebaseAdminApp());
    const dayRef = db.collection("realtimeClassroomDays").doc(date);
    const monthRef = db.collection("realtimeRoomMonths").doc(month);
    const jobRef = db.collection("classroomSheetSyncJobs").doc(jobId);

    const result = await db.runTransaction(async transaction => {
      const [daySnapshot, monthSnapshot, jobSnapshot] = await Promise.all([
        transaction.get(dayRef), transaction.get(monthRef), transaction.get(jobRef)
      ]);
      const current = parseStoredRecords(daySnapshot.data()?.records, date);
      const index = current.findIndex(record => record.slotKey === slotKey);
      if (index < 0) throw new HttpsError("not-found", "수정할 한 시간 기록을 찾지 못했습니다.");
      const before = current[index];
      const nowMs = Date.now();
      const updated: StoredClassroomRecord = {
        ...before,
        instructor, className, purpose: className, memo,
        syncState: "pending_sheet", sheetSyncJobId: jobId,
        source: "firestore_primary_728_updated",
        createdByFirebaseUid: before.createdByFirebaseUid || caller.firebaseUid,
        createdByRole: before.createdByRole || caller.role,
        createdAtMs: before.createdAtMs || nowMs
      };
      const next = current.slice();
      next[index] = updated;

      if (!jobSnapshot.exists) {
        const dependency = cleanOptionalText(before.sheetSyncJobId, 128);
        const job: SheetSyncJob = {
          jobId, requestId: jobId, operation: "update", date, slotKey,
          ...(dependency ? { dependsOnJobId: dependency } : {}),
          payload: {
            date, room, startHour, endHour,
            assignedInstructor: instructor, className, memo, override: "1"
          }
        };
        transaction.set(jobRef, {
          ...job, status: "pending", attempts: 0, lastError: "",
          createdByFirebaseUid: caller.firebaseUid, createdByRole: caller.role,
          createdAtMs: nowMs, createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(), schemaVersion: 2, version: VERSION
        }, { merge: false });
      }

      const tombstones = parseReleaseTombstones(daySnapshot.data()?.releaseTombstones);
      delete tombstones[slotKey];
      writeDayAndMonth(transaction, dayRef, monthRef, daySnapshot, monthSnapshot, {
        date, month, records: sortClassroomRecords(next), tombstones, caller,
        requestId, writeMode: "firestore_primary_hourly_update", nowMs
      });
      return { records: sortClassroomRecords(next), jobId };
    });

    return { ok: true, version: VERSION, date, month, room, startHour, endHour, ...result };
  }
);

export const listPendingClassroomSheetSyncJobs = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const caller = await requireActiveStaff(request);
    const db = getFirestore(getOrInitializeDefaultFirebaseAdminApp());
    // GAS reliable-write requests are bound to the account that created them.
    // Query only the current caller's pending jobs to prevent owner_mismatch / "다른 계정" errors.
    const snapshot = await db.collection("classroomSheetSyncJobs")
      .where("createdByFirebaseUid", "==", caller.firebaseUid)
      .where("status", "==", "pending")
      .orderBy("createdAtMs", "asc")
      .limit(40)
      .get();

    const rows = snapshot.docs
      .map(doc => ({ ref: doc.ref, id: doc.id, data: doc.data() ?? {} }));
    const dependencyIds = [...new Set(rows.map(row => String(row.data.dependsOnJobId || "")).filter(Boolean))];
    const dependencySnapshots = await Promise.all(
      dependencyIds.map(id => db.collection("classroomSheetSyncJobs").doc(id).get())
    );
    const dependencyStatus = new Map<string, string>();
    dependencySnapshots.forEach(snapshot => dependencyStatus.set(snapshot.id, String(snapshot.data()?.status || "")));

    const jobs: SheetSyncJob[] = [];
    for (const row of rows) {
      const data = row.data;
      const dependsOnJobId = String(data.dependsOnJobId || "");
      if (dependsOnJobId && !["complete", "cancelled"].includes(dependencyStatus.get(dependsOnJobId) || "")) {
        continue;
      }
      const date = parseDate(data.date);
      const operation = parseSheetOperation(data.operation);
      jobs.push({
        jobId: row.id,
        requestId: parseRequestId(data.requestId ?? row.id, 128),
        operation,
        date,
        slotKey: cleanText(data.slotKey, 128, "slotKey"),
        ...(dependsOnJobId ? { dependsOnJobId } : {}),
        payload: parseJobPayload(data.payload, date, operation)
      });
      if (jobs.length >= 8) break;
    }

    return { ok: true, version: VERSION, requestedByFirebaseUid: caller.firebaseUid, jobs };
  }
);

export const completeClassroomSheetSyncJob = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const caller = await requireActiveStaff(request);
    const input = parseObject(request.data);
    const jobId = parseRequestId(input.jobId, 128);
    const date = parseDate(input.date);
    const month = date.slice(0, 7);
    const observedAtMs = parseObservedAt(input.observedAtMs);
    const authoritative = parseStoredRecords(input.records, date);

    const db = getFirestore(getOrInitializeDefaultFirebaseAdminApp());
    const dayRef = db.collection("realtimeClassroomDays").doc(date);
    const monthRef = db.collection("realtimeRoomMonths").doc(month);
    const jobRef = db.collection("classroomSheetSyncJobs").doc(jobId);

    const result = await db.runTransaction(async transaction => {
      const [daySnapshot, monthSnapshot, jobSnapshot] = await Promise.all([
        transaction.get(dayRef), transaction.get(monthRef), transaction.get(jobRef)
      ]);
      if (!jobSnapshot.exists) throw new HttpsError("not-found", "시트 동기화 작업을 찾지 못했습니다.");
      const job = jobSnapshot.data() ?? {};
      if (String(job.createdByFirebaseUid || "") !== caller.firebaseUid) {
        throw new HttpsError("permission-denied", "시트 동기화 작업 생성 계정과 현재 계정이 다릅니다.");
      }
      if (String(job.date || "") !== date) {
        throw new HttpsError("failed-precondition", "시트 동기화 작업의 날짜가 일치하지 않습니다.");
      }
      const alreadyComplete = String(job.status || "") === "complete";
      const operation = parseSheetOperation(job.operation);

      /*
       * 7.29.5: 시트 동기화 완료 시 Firestore 기록을 부분 보정하지 않고
       * Google Sheets에서 다시 읽은 전체 레코드로 날짜 스냅샷을 교체합니다.
       */
      const next = sortClassroomRecords(
        authoritative.map(record => ({
          ...record,
          syncState: "sheet_synced" as const,
          source: "sheet_authoritative_7295",
          sheetSyncJobId: jobId
        }))
      );
      const tombstones: Record<string, never> = {};
      const nowMs = Date.now();
      writeDayAndMonth(transaction, dayRef, monthRef, daySnapshot, monthSnapshot, {
        date, month, records: next, tombstones, caller,
        requestId: `SHEET-${jobId}`,
        writeMode: `sheet_authoritative_${operation}_replace`,
        nowMs: Math.max(nowMs, observedAtMs)
      });

      transaction.set(jobRef, {
        status: "complete", completedByFirebaseUid: caller.firebaseUid,
        completedByRole: caller.role, completedAtMs: nowMs,
        completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        lastError: "", version: VERSION
      }, { merge: true });

      return { alreadyComplete, records: next, operation };
    });

    return { ok: true, version: VERSION, jobId, date, count: result.records.length, ...result };
  }
);

export const noteClassroomSheetSyncFailure = onCall(
  ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS,
  async (request: CallableRequest<unknown>) => {
    const caller = await requireActiveStaff(request);
    const input = parseObject(request.data);
    const jobId = parseRequestId(input.jobId, 128);
    const message = cleanOptionalText(input.message, 500) || "시트 동기화 실패";
    const db = getFirestore(getOrInitializeDefaultFirebaseAdminApp());
    const jobRef = db.collection("classroomSheetSyncJobs").doc(jobId);
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(jobRef);
      if (!snapshot.exists) return;
      const data = snapshot.data() ?? {};
      if (String(data.createdByFirebaseUid || "") !== caller.firebaseUid) {
        throw new HttpsError("permission-denied", "시트 동기화 작업 생성 계정과 현재 계정이 다릅니다.");
      }
      if (["complete", "cancelled"].includes(String(data.status || ""))) return;
      transaction.set(jobRef, {
        status: "pending", attempts: readSafeInteger(data.attempts, 0) + 1,
        lastError: message, lastFailedByFirebaseUid: caller.firebaseUid,
        lastFailedAtMs: Date.now(), lastFailedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(), version: VERSION
      }, { merge: true });
    });
    return { ok: true, version: VERSION, jobId };
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

function groupsToHourlySlots(date: string, groups: CommitGroup[]): CommitSlot[] {
  const output: CommitSlot[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (let hour = group.startHour; hour < group.endHour; hour += 1) {
      const slotKey = makeClassroomSlotKey(date, group.room, hour);
      if (seen.has(slotKey)) continue;
      seen.add(slotKey);
      output.push({ room: group.room, startHour: hour, endHour: hour + 1, slotKey });
    }
  }
  if (!output.length || output.length > MAX_SLOTS) {
    throw new HttpsError("invalid-argument", "선택한 시간 칸 수가 허용 범위를 초과했습니다.");
  }
  return output;
}

function parseGroups(value: unknown): CommitGroup[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_GROUPS) {
    throw new HttpsError("invalid-argument", "groups are invalid");
  }
  return value.map((entry, index) => {
    const data = parseObject(entry);
    const room = parseRoom(data.room);
    const startHour = parseHour(data.startHour, `groups[${index}].startHour`);
    const endHour = parseHour(data.endHour, `groups[${index}].endHour`);
    if (endHour <= startHour) throw new HttpsError("invalid-argument", `groups[${index}] time range is invalid`);
    return { room, startHour, endHour };
  });
}

function parseStoredRecords(value: unknown, date: string): StoredClassroomRecord[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_RECORDS) {
    throw new HttpsError("failed-precondition", "stored classroom records are invalid");
  }
  const base = value.map((entry, index) => {
    const data = parseObject(entry);
    const room = parseRoom(data.room);
    const startHour = parseHour(data.startHour, `records[${index}].startHour`);
    const endHour = parseHour(data.endHour, `records[${index}].endHour`);
    if (endHour <= startHour) throw new HttpsError("failed-precondition", `records[${index}] time range is invalid`);
    const record: StoredClassroomRecord = {
      recordId: cleanText(data.recordId ?? `${date}|${room}|${startHour}|${endHour}`, 256, `records[${index}].recordId`),
      date, room, startHour, endHour,
      slotKey: cleanOptionalText(data.slotKey, 128) || makeClassroomSlotKey(date, room, startHour),
      instructor: cleanOptionalText(data.instructor ?? data.adminName, MAX_TEXT),
      className: cleanOptionalText(data.className ?? data.purpose, MAX_TEXT),
      purpose: cleanOptionalText(data.purpose ?? data.className, MAX_TEXT),
      status: "사용중", memo: cleanOptionalText(data.memo, MAX_MEMO),
      sheetName: cleanOptionalText(data.sheetName, MAX_TEXT)
    };
    const sheetRecordId = cleanOptionalText(data.sheetRecordId, 256);
    if (sheetRecordId) record.sheetRecordId = sheetRecordId;
    const syncState = String(data.syncState || "");
    if (syncState === "pending_sheet" || syncState === "sheet_synced") record.syncState = syncState;
    const sheetSyncJobId = cleanOptionalText(data.sheetSyncJobId, 128);
    if (sheetSyncJobId) record.sheetSyncJobId = sheetSyncJobId;
    const source = cleanOptionalText(data.source, 100);
    if (source) record.source = source;
    const createdByFirebaseUid = cleanOptionalText(data.createdByFirebaseUid, 128);
    if (createdByFirebaseUid) record.createdByFirebaseUid = createdByFirebaseUid;
    const createdByRole = cleanOptionalText(data.createdByRole, 40);
    if (createdByRole) record.createdByRole = createdByRole;
    const createdAtMs = optionalSafeInteger(data.createdAtMs);
    if (createdAtMs !== undefined) record.createdAtMs = createdAtMs;
    return record;
  });
  return expandClassroomRecordsToHourly(base) as StoredClassroomRecord[];
}

function parseReleaseTombstones(value: unknown): Record<string, ReleaseTombstone> {
  const output: Record<string, ReleaseTombstone> = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return output;
  const now = Date.now();
  for (const [slotKey, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    const data = raw as Record<string, unknown>;
    const createdAtMs = readSafeInteger(data.createdAtMs, 0);
    if (!createdAtMs || now - createdAtMs > TOMBSTONE_TTL_MS) continue;
    output[slotKey] = {
      jobId: cleanOptionalText(data.jobId, 128),
      createdAtMs,
      releasedByFirebaseUid: cleanOptionalText(data.releasedByFirebaseUid, 128)
    };
  }
  return output;
}

function writeDayAndMonth(
  transaction: Transaction,
  dayRef: DocumentReference,
  monthRef: DocumentReference,
  daySnapshot: DocumentSnapshot,
  monthSnapshot: DocumentSnapshot,
  input: {
    date: string; month: string; records: StoredClassroomRecord[];
    tombstones: Record<string, ReleaseTombstone>; caller: ActiveCaller;
    requestId: string; writeMode: string; nowMs: number;
  }
): void {
  const classroomByDate = parseClassroomByDate(monthSnapshot.data()?.classroomByDate);
  classroomByDate[input.date] = input.records;
  const sourceObservedAtMs = Math.max(
    readSafeInteger(daySnapshot.data()?.sourceObservedAtMs, 0), input.nowMs
  );
  transaction.set(dayRef, {
    date: input.date, records: input.records, recordCount: input.records.length,
    releaseTombstones: input.tombstones,
    primaryRevision: readSafeInteger(daySnapshot.data()?.primaryRevision, 0) + 1,
    sourceObservedAtMs, sourceRequestId: input.requestId,
    writeMode: input.writeMode,
    updatedByFirebaseUid: input.caller.firebaseUid, updatedByRole: input.caller.role,
    updatedAt: FieldValue.serverTimestamp(), schemaVersion: 3, version: VERSION
  }, { merge: true });
  transaction.set(monthRef, {
    month: input.month, classroomByDate,
    classroomSourceObservedAtMs: sourceObservedAtMs,
    classroomSourceRequestId: input.requestId,
    classroomWriteMode: input.writeMode,
    classroomUpdatedByFirebaseUid: input.caller.firebaseUid,
    classroomUpdatedByRole: input.caller.role,
    classroomUpdatedAt: FieldValue.serverTimestamp(), schemaVersion: 3, version: VERSION
  }, { merge: true });
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

function parseSheetOperation(value: unknown): SheetOperation {
  const op = String(value || "save");
  if (op === "save" || op === "release" || op === "update") return op;
  return "save";
}

function parseJobPayload(value: unknown, date: string, operation: SheetOperation): SheetSyncPayload {
  const data = parseObject(value);
  const room = parseRoom(data.room);
  const startHour = parseHour(data.startHour, "payload.startHour");
  const endHour = parseHour(data.endHour, "payload.endHour");
  if (endHour !== startHour + 1) throw new HttpsError("failed-precondition", "sheet sync payload must be hourly");
  const payload: SheetSyncPayload = { date, room, startHour, endHour };
  if (operation !== "release") {
    payload.assignedInstructor = cleanOptionalText(data.assignedInstructor, MAX_TEXT);
    payload.className = cleanOptionalText(data.className, MAX_TEXT);
    payload.memo = cleanOptionalText(data.memo, MAX_MEMO);
    payload.override = operation === "update" ? "1" : "0";
  }
  return payload;
}

function makeJobId(requestId: string, index: number): string { return `${requestId}-${index + 1}`; }
function parseObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "input must be an object");
  }
  return value as Record<string, unknown>;
}
function parseDate(value: unknown): string {
  const date = cleanText(value, 10, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpsError("invalid-argument", "date must be YYYY-MM-DD");
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
function parseRequestId(value: unknown, maxLength: number): string {
  const requestId = cleanText(value, maxLength, "requestId");
  if (!/^[A-Za-z0-9._:-]+$/.test(requestId)) throw new HttpsError("invalid-argument", "requestId is invalid");
  return requestId;
}
function parseObservedAt(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new HttpsError("invalid-argument", "observedAtMs is invalid");
  return number;
}
function parseRole(value: unknown): UlimRole {
  if (typeof value !== "string" || !STAFF_ROLES.has(value as UlimRole)) {
    throw new HttpsError("permission-denied", "firebase role is invalid");
  }
  return value as UlimRole;
}
function cleanText(value: unknown, maxLength: number, fieldName: string): string {
  if (typeof value !== "string") throw new HttpsError("invalid-argument", `${fieldName} must be a string`);
  const text = value.trim();
  if (!text || text.length > maxLength) throw new HttpsError("invalid-argument", `${fieldName} is invalid`);
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
function optionalSafeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
}
