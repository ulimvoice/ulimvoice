export interface ClassroomRecordLike {
  recordId: string;
  date: string;
  room: string;
  startHour: number;
  endHour: number;
  instructor?: string;
  className?: string;
  purpose?: string;
  status?: string;
  memo?: string;
  sheetName?: string;
  slotKey?: string;
  sheetRecordId?: string;
  syncState?: string;
  sheetSyncJobId?: string;
  source?: string;
  createdByFirebaseUid?: string;
  createdByRole?: string;
  createdAtMs?: number;
}

export interface ClassroomCommitPartition<T extends ClassroomRecordLike> {
  accepted: T[];
  conflicts: Array<{
    requested: T;
    occupiedBy: ClassroomRecordLike;
  }>;
}

export interface ClassroomMergeOptions {
  tombstoneSlotKeys?: readonly string[];
}

export function normalizeClassroomRoom(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

export function makeClassroomSlotKey(
  date: unknown,
  room: unknown,
  hour: unknown
): string {
  return [
    String(date ?? "").trim(),
    normalizeClassroomRoom(room),
    String(Number(hour))
  ].join("|");
}

export function classroomRecordsOverlap(
  left: Pick<ClassroomRecordLike, "room" | "startHour" | "endHour">,
  right: Pick<ClassroomRecordLike, "room" | "startHour" | "endHour">
): boolean {
  return normalizeClassroomRoom(left.room) === normalizeClassroomRoom(right.room)
    && Number(left.startHour) < Number(right.endHour)
    && Number(right.startHour) < Number(left.endHour);
}

export function expandClassroomRecordsToHourly<T extends ClassroomRecordLike>(
  records: readonly T[]
): T[] {
  const output: T[] = [];

  for (const record of records) {
    const start = Number(record.startHour);
    const end = Number(record.endHour);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) continue;

    const baseRecordId = String(
      record.recordId ||
      [record.date, normalizeClassroomRoom(record.room), start, end].join("|")
    );
    const originalSheetRecordId = String(record.sheetRecordId || record.recordId || "");

    for (let hour = start; hour < end; hour += 1) {
      const slotKey = makeClassroomSlotKey(record.date, record.room, hour);
      const recordId = end - start === 1
        ? baseRecordId
        : `${baseRecordId}#H${hour}`;

      output.push({
        ...record,
        recordId,
        startHour: hour,
        endHour: hour + 1,
        slotKey,
        ...(originalSheetRecordId ? { sheetRecordId: originalSheetRecordId } : {})
      } as T);
    }
  }

  const bySlot = new Map<string, T>();
  for (const record of output) {
    bySlot.set(
      String(record.slotKey || makeClassroomSlotKey(record.date, record.room, record.startHour)),
      record
    );
  }
  return sortClassroomRecords([...bySlot.values()]);
}

export function partitionClassroomCommit<T extends ClassroomRecordLike>(
  existing: readonly ClassroomRecordLike[],
  requested: readonly T[]
): ClassroomCommitPartition<T> {
  const occupied: ClassroomRecordLike[] = expandClassroomRecordsToHourly(existing);
  const accepted: T[] = [];
  const conflicts: Array<{ requested: T; occupiedBy: ClassroomRecordLike }> = [];

  for (const record of expandClassroomRecordsToHourly(requested)) {
    const collision = occupied.find(current => classroomRecordsOverlap(current, record));
    if (collision) {
      conflicts.push({ requested: record as T, occupiedBy: collision });
      continue;
    }
    accepted.push(record as T);
    occupied.push(record);
  }

  return { accepted, conflicts };
}

export function isFirestorePrimaryClassroomRecord(
  record: ClassroomRecordLike
): boolean {
  const source = String(record.source || "");
  return source.startsWith("firestore_primary")
    || String(record.recordId || "").startsWith("fs:")
    || String(record.syncState || "").includes("sheet");
}

export function mergeAuthoritativeClassroomRecords<T extends ClassroomRecordLike>(
  authoritative: readonly T[],
  current: readonly T[],
  options: ClassroomMergeOptions = {}
): T[] {
  const tombstones = new Set((options.tombstoneSlotKeys || []).map(String));
  const authoritativeHourly = expandClassroomRecordsToHourly(authoritative);
  const currentHourly = expandClassroomRecordsToHourly(current);
  const merged = new Map<string, T>();

  for (const record of authoritativeHourly) {
    const key = String(record.slotKey || makeClassroomSlotKey(record.date, record.room, record.startHour));
    if (tombstones.has(key)) continue;
    merged.set(key, { ...record, slotKey: key } as T);
  }

  // Firestore-first records remain authoritative even when a delayed or cached
  // Google Sheet snapshot does not contain them yet.
  for (const record of currentHourly) {
    const key = String(record.slotKey || makeClassroomSlotKey(record.date, record.room, record.startHour));
    if (tombstones.has(key)) continue;
    if (!isFirestorePrimaryClassroomRecord(record)) continue;
    merged.set(key, { ...record, slotKey: key } as T);
  }

  return sortClassroomRecords([...merged.values()]);
}

export function sortClassroomRecords<T extends ClassroomRecordLike>(records: T[]): T[] {
  return records.sort((left, right) => {
    const roomOrder = String(left.room || "").localeCompare(String(right.room || ""), "ko");
    if (roomOrder) return roomOrder;
    const startOrder = Number(left.startHour) - Number(right.startHour);
    if (startOrder) return startOrder;
    return String(left.recordId || "").localeCompare(String(right.recordId || ""));
  });
}
