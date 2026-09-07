export interface ClassSessionLike735413 {
  classId?: unknown;
  className?: unknown;
  currentClass?: unknown;
  instructor?: unknown;
  instructorName?: unknown;
  teacher?: unknown;
  teacherName?: unknown;
  startHour?: unknown;
  endHour?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  classStartTime?: unknown;
  classEndTime?: unknown;
}

export interface FirestoreClassroomUsageLike735413 {
  recordId?: unknown;
  date?: unknown;
  room?: unknown;
  roomName?: unknown;
  classroom?: unknown;
  startHour?: unknown;
  endHour?: unknown;
  assignedInstructor?: unknown;
  instructor?: unknown;
  instructorName?: unknown;
  teacher?: unknown;
  teacherName?: unknown;
  className?: unknown;
  purpose?: unknown;
  memo?: unknown;
  status?: unknown;
  active?: unknown;
  released?: unknown;
  deleted?: unknown;
  slotKey?: unknown;
}

export interface ClassroomUsageMatch735413 {
  roomName: string;
  recordId: string;
  className: string;
  instructor: string;
  startHour: number;
  endHour: number;
  score: number;
  source: "firestoreClassroomUsageLog";
}

interface ParsedRange735413 {
  start: number;
  end: number;
}

interface NormalizedUsage735413 {
  roomName: string;
  roomKey: string;
  recordId: string;
  className: string;
  classKey: string;
  instructor: string;
  teacherKey: string;
  start: number;
  end: number;
}

function rawText735413(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim();
}

function compact735413(value: unknown): string {
  return rawText735413(value).toLowerCase().replace(/\s+/g, "");
}

export function normalizeTeacherKey735413(value: unknown): string {
  return rawText735413(value)
    .replace(/^name:/i, "")
    .replace(/[\[\](){}<>【】]/g, "")
    .replace(/(?:선생님|강사)$/g, "")
    .replace(/\s*T\s*$/i, "")
    .replace(/[\s._\-–—:：/\\]+/g, "")
    .toLowerCase();
}

function teacherFromClassName735413(value: unknown): string {
  const source = rawText735413(value);
  const bracket = source.match(/^\s*\[\s*([^\]]+?)\s*\]\s*/);
  if (bracket?.[1]) return bracket[1];
  const prefix = source.match(/^\s*([가-힣A-Za-z0-9_]{2,24})\s*T?\s*[-–—:：]\s*/);
  return prefix?.[1] ?? "";
}

export function normalizeClassKey735413(value: unknown): string {
  return rawText735413(value)
    .replace(/^\s*\[\s*[^\]]+?\s*\]\s*[-–—:：]?\s*/i, "")
    .replace(/^\s*[가-힣A-Za-z0-9_]{2,24}\s*T?\s*[-–—:：]\s*/i, "")
    .replace(/\b(?:일요일|월요일|화요일|수요일|목요일|금요일|토요일)\b/g, "")
    .replace(/\d{1,2}\s*[:시]\s*\d{0,2}\s*(?:분)?\s*[~～〜\-–—]\s*\d{1,2}\s*[:시]\s*\d{0,2}\s*(?:분)?/g, "")
    .replace(/[\s._\-–—:：/\\()[\]{}]+/g, "")
    .toLowerCase();
}

function numericHour735413(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 24) return value;
  const source = rawText735413(value);
  if (!source) return null;
  const match = source.match(/(\d{1,2})(?::|시)?\s*(\d{1,2})?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 24 || minute < 0 || minute > 59) return null;
  return hour + minute / 60;
}

export function parseClassTimeRange735413(value: ClassSessionLike735413): ParsedRange735413 | null {
  const explicitStart = numericHour735413(value.startHour ?? value.startTime ?? value.classStartTime);
  const explicitEnd = numericHour735413(value.endHour ?? value.endTime ?? value.classEndTime);
  if (explicitStart !== null && explicitEnd !== null && explicitEnd > explicitStart) {
    return { start: explicitStart, end: explicitEnd };
  }
  const source = rawText735413(value.className ?? value.currentClass);
  const match = source.match(/(\d{1,2})\s*[:시]\s*(\d{1,2})?\s*(?:분)?\s*[~～〜\-–—]\s*(\d{1,2})\s*[:시]\s*(\d{1,2})?\s*(?:분)?/);
  if (!match) return null;
  const start = Number(match[1]) + Number(match[2] ?? 0) / 60;
  const end = Number(match[3]) + Number(match[4] ?? 0) / 60;
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

function classroomUsageIsActive735413(record: FirestoreClassroomUsageLike735413): boolean {
  if (record.active === false || record.released === true || record.deleted === true) return false;
  const status = compact735413(record.status);
  return !["inactive", "released", "deleted", "cancelled", "canceled", "해제", "삭제", "취소"].includes(status);
}

function normalizeUsage735413(record: FirestoreClassroomUsageLike735413): NormalizedUsage735413 | null {
  if (!classroomUsageIsActive735413(record)) return null;
  const roomName = rawText735413(record.room ?? record.roomName ?? record.classroom);
  const start = numericHour735413(record.startHour);
  const end = numericHour735413(record.endHour);
  if (!roomName || start === null || end === null || end <= start) return null;
  const className = rawText735413(record.className ?? record.purpose);
  const instructor = rawText735413(record.assignedInstructor ?? record.instructor ?? record.instructorName ?? record.teacher ?? record.teacherName) || teacherFromClassName735413(className);
  return {
    roomName,
    roomKey: compact735413(roomName),
    recordId: rawText735413(record.recordId ?? record.slotKey),
    className,
    classKey: normalizeClassKey735413(className),
    instructor,
    teacherKey: normalizeTeacherKey735413(instructor),
    start,
    end
  };
}

function teacherKeysMatch735413(left: string, right: string): boolean {
  if (!left || !right) return false;
  return left === right || (left.length >= 2 && right.length >= 2 && (left.includes(right) || right.includes(left)));
}

function rangesOverlap735413(left: ParsedRange735413, right: ParsedRange735413): boolean {
  return left.start < right.end && right.start < left.end;
}

function classKeysMatch735413(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 45;
  if (left.length >= 3 && right.length >= 3 && (left.includes(right) || right.includes(left))) return 24;
  return 0;
}

/**
 * 반 문서에 저장된 고정 강의실 값은 사용하지 않습니다.
 * 선택한 날짜의 realtimeClassroomDays/{date}.records만을 기준으로
 * 강사 + 수업시간을 필수 축으로 매칭하고 반명은 보조 점수로 사용합니다.
 */
export function resolveClassroomFromUsage735413(
  session: ClassSessionLike735413,
  usageRecords: readonly FirestoreClassroomUsageLike735413[]
): ClassroomUsageMatch735413 | null {
  const className = rawText735413(session.className ?? session.currentClass);
  const instructor = rawText735413(session.instructor ?? session.instructorName ?? session.teacher ?? session.teacherName) || teacherFromClassName735413(className);
  const teacherKey = normalizeTeacherKey735413(instructor);
  const classKey = normalizeClassKey735413(className);
  const classTime = parseClassTimeRange735413(session);

  if (!teacherKey || !classTime) return null;

  const grouped = new Map<string, { roomName: string; best: NormalizedUsage735413; score: number; overlap: number; records: NormalizedUsage735413[] }>();
  for (const raw of usageRecords) {
    const usage = normalizeUsage735413(raw);
    if (!usage || !teacherKeysMatch735413(teacherKey, usage.teacherKey)) continue;
    const usageRange = { start: usage.start, end: usage.end };
    if (!rangesOverlap735413(classTime, usageRange)) continue;

    const overlap = Math.max(0, Math.min(classTime.end, usage.end) - Math.max(classTime.start, usage.start));
    let score = 100;
    score += classKeysMatch735413(classKey, usage.classKey);
    if (Math.floor(classTime.start) === usage.start) score += 32;
    if (classTime.start >= usage.start && classTime.start < usage.end) score += 18;
    score += Math.round(overlap * 10);

    const existing = grouped.get(usage.roomKey);
    if (!existing) {
      grouped.set(usage.roomKey, { roomName: usage.roomName, best: usage, score, overlap, records: [usage] });
    } else {
      existing.records.push(usage);
      existing.overlap += overlap;
      if (score > existing.score) {
        existing.score = score;
        existing.best = usage;
      }
    }
  }

  const candidates = Array.from(grouped.values()).map(item => ({
    ...item,
    aggregateScore: item.score + Math.round(item.overlap * 4) + Math.min(item.records.length, 4)
  })).sort((a, b) => b.aggregateScore - a.aggregateScore || a.roomName.localeCompare(b.roomName, "ko"));

  if (!candidates.length) return null;
  // 동일 강사·수업시간에 서로 다른 강의실이 둘 이상 겹치면
  // 점수로 추측하지 않고 관리자 확인 대상으로 남깁니다.
  if (candidates.length > 1) return null;

  const chosen = candidates[0];
  return {
    roomName: chosen.roomName,
    recordId: chosen.best.recordId,
    className: chosen.best.className,
    instructor: chosen.best.instructor,
    startHour: chosen.best.start,
    endHour: chosen.best.end,
    score: chosen.aggregateScore,
    source: "firestoreClassroomUsageLog"
  };
}

export function classroomUsageSignatureSource735413(records: readonly FirestoreClassroomUsageLike735413[]): string {
  return records
    .map(normalizeUsage735413)
    .filter((item): item is NormalizedUsage735413 => Boolean(item))
    .sort((a, b) => a.roomKey.localeCompare(b.roomKey) || a.start - b.start || a.teacherKey.localeCompare(b.teacherKey) || a.classKey.localeCompare(b.classKey))
    .map(item => [item.roomKey, item.start, item.end, item.teacherKey, item.classKey, item.recordId].join("|"))
    .join("\n");
}
