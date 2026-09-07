import { createHash } from "node:crypto";
import { buildStableClassId } from "./attendanceMirror.js";
import { ATTENDANCE_SHADOW_PILOTS } from "./attendanceShadowPilot.js";

export type CleanupDocumentKind = "attendance" | "assignment";

export interface CleanupStoredDocument {
  readonly path: string;
  readonly id: string;
  readonly kind: CleanupDocumentKind;
  readonly data: Record<string, unknown>;
}

export interface CleanupCanonicalScope {
  readonly pilotId: string;
  readonly label: string;
  readonly className: string;
  readonly instructor: string;
  readonly classId: string;
  readonly sessionDates: readonly string[];
  readonly classAliases: readonly string[];
  readonly instructorAliases: readonly string[];
}

export interface CleanupCandidate {
  readonly path: string;
  readonly id: string;
  readonly kind: CleanupDocumentKind;
  readonly currentClassId: string;
  readonly canonicalClassId: string;
  readonly pilotId: string;
  readonly studentName: string;
  readonly studentUid: string;
  readonly sessionDate: string;
  readonly sourceKey: string;
  readonly reasons: readonly string[];
  readonly data: Record<string, unknown>;
}

export interface CleanupCanonicalScopeSummary {
  readonly pilotId: string;
  readonly label: string;
  readonly classId: string;
  readonly activeCount: number;
}

export interface AttendanceLegacyCleanupPlan {
  readonly version: string;
  readonly canonicalScopes: readonly CleanupCanonicalScopeSummary[];

  /*
   * archiveCandidates에는 대체 정식 문서가 이미 존재하는 항목만
   * 포함한다. 대체 문서가 없는 항목은 blockedCandidates로
   * 분리하고 Archive 전체를 차단한다.
   */
  readonly archiveCandidates: readonly CleanupCandidate[];
  readonly blockedCandidates: readonly CleanupCandidate[];

  readonly attendanceCandidateCount: number;
  readonly assignmentCandidateCount: number;
  readonly blockedAttendanceCount: number;
  readonly blockedAssignmentCount: number;

  readonly assignmentRepairCount: number;
  readonly assignmentRepairDigest: string;
  readonly safeToRepairAssignments: boolean;

  readonly activeAttendanceScanned: number;
  readonly activeAssignmentsScanned: number;
  readonly preservedAttendanceCount: number;
  readonly candidateDigest: string;
  readonly safeToArchive: boolean;
  readonly maxArchiveCandidates: number;
  readonly warnings: readonly string[];
}

export const ATTENDANCE_LEGACY_CLEANUP_VERSION =
  "20260715.5-phase3a-cleanup-uid-alias-assignment-repair";

export const MAX_ARCHIVE_CANDIDATES = 180;

function text(value: unknown): string {
  return String(value ?? "").trim().normalize("NFC");
}

function compact(value: unknown): string {
  return text(value).replace(/\s+/g, "").toLowerCase();
}

/*
 * 과거 문서에는 동일한 시트 셀 sourceKey가 다음 두 형태로
 * 혼재한다.
 *
 * 김철수T!M7
 * 김철수T|M7
 *
 * Cleanup의 대체 문서 판정에서만 동일한 키로 정규화한다.
 * Firestore 문서의 실제 sourceKey 값은 변경하지 않는다.
 */
export function normalizeCleanupSourceKey(
  value: unknown
): string {
  return compact(value)
    .replace(/[!｜¦]/gu, "|")
    .replace(/\|+/gu, "|");
}

function normalizedInstructor(value: unknown): string {
  return compact(value)
    .replace(/(?:선생님|강사)$/u, "")
    .replace(/t$/u, "");
}

function recordValue(
  data: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) {
      return data[key];
    }
  }
  return undefined;
}

function nestedLegacy(
  data: Record<string, unknown>
): Record<string, unknown> {
  const value = data.legacy;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function canonicalCleanupScopes(): readonly CleanupCanonicalScope[] {
  return ATTENDANCE_SHADOW_PILOTS.map((scope) => {
    const classId = buildStableClassId({
      className: scope.className,
      instructor: scope.instructor,
      teacherName: scope.instructor
    });
    if (!classId) {
      throw new Error(`cleanup scope ${scope.id} has no stable classId`);
    }
    return Object.freeze({
      pilotId: scope.id,
      label: scope.label,
      className: scope.className,
      instructor: scope.instructor,
      classId,
      sessionDates: scope.sessionDates,
      classAliases: scope.classAliases,
      instructorAliases: scope.instructorAliases
    });
  });
}

function classMatches(
  scope: CleanupCanonicalScope,
  value: unknown
): boolean {
  const target = compact(value);
  return !!target && scope.classAliases.some(
    (alias) => compact(alias) === target
  );
}

function instructorMatches(
  scope: CleanupCanonicalScope,
  value: unknown
): boolean {
  const target = normalizedInstructor(value);
  return !!target && scope.instructorAliases.some(
    (alias) => normalizedInstructor(alias) === target
  );
}

function documentDate(data: Record<string, unknown>): string {
  return text(recordValue(data, "sessionDate", "date"));
}

function documentClassId(data: Record<string, unknown>): string {
  return text(data.classId);
}

function documentInstructorSignals(
  data: Record<string, unknown>
): string[] {
  const legacy = nestedLegacy(data);
  return unique([
    text(data.instructor),
    text(data.teacherName),
    text(data.sourceSheet),
    text(legacy.sourceSheet)
  ]);
}

function documentClassSignals(
  data: Record<string, unknown>
): string[] {
  return unique([
    text(data.className),
    text(data.classTitle)
  ]);
}

function inferAttendanceScope(
  data: Record<string, unknown>,
  scopes: readonly CleanupCanonicalScope[]
): CleanupCanonicalScope | undefined {
  const date = documentDate(data);
  const dateScopes = scopes.filter((scope) =>
    scope.sessionDates.includes(date)
  );
  if (dateScopes.length === 0) return undefined;

  const classId = documentClassId(data);
  const owner = dateScopes.find((scope) => scope.classId === classId);
  const instructorSignals = documentInstructorSignals(data);
  const instructorScopes = dateScopes.filter((scope) =>
    instructorSignals.some((value) => instructorMatches(scope, value))
  );

  if (instructorScopes.length === 1) {
    return instructorScopes[0];
  }

  if (owner) return owner;

  const classSignals = documentClassSignals(data);
  const classScopes = dateScopes.filter((scope) =>
    classSignals.some((value) => classMatches(scope, value))
  );
  if (classScopes.length === 1) return classScopes[0];

  return undefined;
}

function candidateIdentity(
  document: CleanupStoredDocument,
  scope: CleanupCanonicalScope,
  reasons: readonly string[]
): CleanupCandidate {
  const data = document.data;
  const legacy = nestedLegacy(data);
  return {
    path: document.path,
    id: document.id,
    kind: document.kind,
    currentClassId: documentClassId(data),
    canonicalClassId: scope.classId,
    pilotId: scope.pilotId,
    studentName: text(data.studentName),
    studentUid: text(data.studentUid),
    sessionDate: documentDate(data),
    sourceKey: text(data.sourceKey || legacy.sourceKey || data.sourceCell || legacy.sourceCell),
    reasons: unique(reasons).sort(),
    data
  };
}

function stableCandidatePayload(
  candidates: readonly CleanupCandidate[]
): readonly Record<string, unknown>[] {
  return candidates.map((candidate) => ({
    path: candidate.path,
    kind: candidate.kind,
    currentClassId: candidate.currentClassId,
    canonicalClassId: candidate.canonicalClassId,
    pilotId: candidate.pilotId,
    studentUid: candidate.studentUid,
    sessionDate: candidate.sessionDate,
    sourceKey: candidate.sourceKey,
    reasons: [...candidate.reasons]
  })).sort((left, right) =>
    String(left.path).localeCompare(String(right.path))
  );
}

export function cleanupCandidateDigest(
  candidates: readonly CleanupCandidate[]
): string {
  return createHash("sha256")
    .update(JSON.stringify(stableCandidatePayload(candidates)))
    .digest("hex");
}

function active(data: Record<string, unknown>): boolean {
  return data.active !== false;
}

function attendanceIdentityKey(
  data: Record<string, unknown>
): string {
  const legacy = nestedLegacy(data);
  const date = documentDate(data);
  const sourceKey =
    normalizeCleanupSourceKey(
      data.sourceKey ||
      legacy.sourceKey ||
      data.sourceCell ||
      legacy.sourceCell
    );
  const studentUid = text(data.studentUid);

  if (!date || !sourceKey || !studentUid) {
    return "";
  }

  return [date, sourceKey, studentUid].join("|");
}

function canonicalAssignmentPath(
  path: string,
  canonicalClassId: string
): string {
  const parts = path.split("/");

  if (
    parts.length !== 4 ||
    parts[2] !== "classes"
  ) {
    return "";
  }

  return [
    parts[0],
    parts[1],
    "classes",
    canonicalClassId
  ].join("/");
}

function assignmentScope(
  data: Record<string, unknown>,
  scopes: readonly CleanupCanonicalScope[],
  wrongClassIdToScope: ReadonlyMap<string, CleanupCanonicalScope>
): CleanupCanonicalScope | undefined {
  const pilotId = text(data.pilotId);
  const byPilot = scopes.find((scope) => scope.pilotId === pilotId);
  if (byPilot) return byPilot;

  const classId = documentClassId(data);
  return wrongClassIdToScope.get(classId);
}

export function buildAttendanceLegacyCleanupPlan(
  attendanceDocuments: readonly CleanupStoredDocument[],
  assignmentDocuments: readonly CleanupStoredDocument[]
): AttendanceLegacyCleanupPlan {
  const scopes = canonicalCleanupScopes();
  const scopeByClassId = new Map(scopes.map((scope) => [scope.classId, scope]));
  const attendanceCandidates: CleanupCandidate[] = [];
  const candidateByPath = new Map<string, CleanupCandidate>();
  const activeAttendance = attendanceDocuments.filter((document) =>
    document.kind === "attendance" && active(document.data)
  );

  for (const document of activeAttendance) {
    const data = document.data;
    const inferred = inferAttendanceScope(data, scopes);
    const currentClassId = documentClassId(data);
    const currentOwner = scopeByClassId.get(currentClassId);
    if (!inferred) continue;

    const reasons: string[] = [];
    if (currentOwner && currentOwner.pilotId !== inferred.pilotId) {
      reasons.push("cross_scope_class_id");
    }
    if (currentClassId !== inferred.classId) {
      reasons.push("noncanonical_class_id");
    }
    if (reasons.length === 0) continue;

    const candidate = candidateIdentity(document, inferred, reasons);
    attendanceCandidates.push(candidate);
    candidateByPath.set(candidate.path, candidate);
  }

  const duplicateGroups = new Map<string, CleanupStoredDocument[]>();
  for (const document of activeAttendance) {
    const data = document.data;
    const legacy = nestedLegacy(data);
    const date = documentDate(data);
    const sourceKey = text(data.sourceKey || legacy.sourceKey || data.sourceCell || legacy.sourceCell);
    const studentUid = text(data.studentUid);
    if (!date || !sourceKey || !studentUid) continue;
    const key = [date, sourceKey, studentUid].join("|");
    const group = duplicateGroups.get(key) || [];
    group.push(document);
    duplicateGroups.set(key, group);
  }

  for (const group of duplicateGroups.values()) {
    if (group.length < 2) continue;
    for (const document of group) {
      const inferred = inferAttendanceScope(document.data, scopes);
      if (!inferred) continue;
      if (documentClassId(document.data) === inferred.classId) continue;
      const existing = candidateByPath.get(document.path);
      if (existing) {
        const updated = candidateIdentity(
          document,
          inferred,
          [...existing.reasons, "duplicate_active_identity"]
        );
        candidateByPath.set(document.path, updated);
      } else {
        candidateByPath.set(
          document.path,
          candidateIdentity(document, inferred, ["duplicate_active_identity"])
        );
      }
    }
  }

  const allAttendanceCandidates =
    [...candidateByPath.values()];

  /*
   * 같은 날짜/sourceKey/studentUid의 active:true 정식 classId
   * 문서가 있어야 비정식 출석 문서를 격리할 수 있다.
   */
  const canonicalAttendanceDocuments =
    activeAttendance
      .map((document) => ({
        document,
        scope: inferAttendanceScope(
          document.data,
          scopes
        )
      }))
      .filter((entry) =>
        !!(
          entry.scope &&
          documentClassId(
            entry.document.data
          ) === entry.scope.classId
        )
      ) as Array<{
        document: CleanupStoredDocument;
        scope: CleanupCanonicalScope;
      }>;

  const canonicalAttendanceIdentityKeys =
    new Set(
      canonicalAttendanceDocuments
        .map((entry) => {
          const identity =
            attendanceIdentityKey(
              entry.document.data
            );

          return identity
            ? [
                entry.scope.pilotId,
                identity
              ].join("|")
            : "";
        })
        .filter(Boolean)
    );

  /*
   * 학생 UID가 교정된 과거 문서를 안전하게 식별하기 위한
   * 보조 인덱스다.
   *
   * 같은 파일럿 + 날짜 + sourceKey + 학생명이 정확히 일치하고
   * 정식 문서가 단 한 건일 때만 UID 변경 이력으로 인정한다.
   */
  const canonicalAttendanceRowNameIndex =
    new Map<
      string,
      CleanupStoredDocument[]
    >();

  for (
    const entry of
      canonicalAttendanceDocuments
  ) {
    const data = entry.document.data;
    const legacy = nestedLegacy(data);
    const date = documentDate(data);
    const sourceKey =
      normalizeCleanupSourceKey(
        data.sourceKey ||
        legacy.sourceKey ||
        data.sourceCell ||
        legacy.sourceCell
      );
    const studentName =
      compact(data.studentName);

    if (
      !date ||
      !sourceKey ||
      !studentName
    ) {
      continue;
    }

    const key = [
      entry.scope.pilotId,
      date,
      sourceKey,
      studentName
    ].join("|");

    const group =
      canonicalAttendanceRowNameIndex
        .get(key) || [];

    group.push(entry.document);

    canonicalAttendanceRowNameIndex
      .set(key, group);
  }

  const readyAttendanceCandidates:
    CleanupCandidate[] = [];

  const blockedAttendanceCandidates:
    CleanupCandidate[] = [];

  for (const candidate of allAttendanceCandidates) {
    const scope = scopes.find(
      (item) =>
        item.pilotId === candidate.pilotId
    );

    if (!scope) continue;

    const normalizedSourceKey =
      normalizeCleanupSourceKey(
        candidate.sourceKey
      );

    const identityKey = [
      scope.pilotId,
      candidate.sessionDate,
      normalizedSourceKey,
      candidate.studentUid
    ].join("|");

    const exactReplacementExists =
      !!identityKey &&
      canonicalAttendanceIdentityKeys.has(
        identityKey
      );

    const rowNameKey = [
      scope.pilotId,
      candidate.sessionDate,
      normalizedSourceKey,
      compact(candidate.studentName)
    ].join("|");

    const rowNameMatches =
      candidate.studentName
        ? (
            canonicalAttendanceRowNameIndex
              .get(rowNameKey) || []
          )
        : [];

    const uidAliasReplacementExists =
      !exactReplacementExists &&
      rowNameMatches.length === 1;

    const hasCanonicalReplacement =
      exactReplacementExists ||
      uidAliasReplacementExists;

    const replacementReasons =
      exactReplacementExists
        ? [
            "canonical_replacement_exists"
          ]
        : uidAliasReplacementExists
          ? [
              "canonical_replacement_exists_by_row_and_name",
              "student_uid_alias_detected"
            ]
          : [
              "canonical_replacement_missing"
            ];

    const classified = candidateIdentity(
      {
        path: candidate.path,
        id: candidate.id,
        kind: candidate.kind,
        data: candidate.data
      },
      scope,
      [
        ...candidate.reasons,
        ...replacementReasons
      ]
    );

    if (hasCanonicalReplacement) {
      readyAttendanceCandidates.push(
        classified
      );
    } else {
      blockedAttendanceCandidates.push(
        classified
      );
    }
  }

  const wrongClassIdToScope =
    new Map<string, CleanupCanonicalScope>();

  for (const candidate of allAttendanceCandidates) {
    const scope = scopes.find(
      (item) =>
        item.pilotId === candidate.pilotId
    );

    if (scope && candidate.currentClassId) {
      wrongClassIdToScope.set(
        candidate.currentClassId,
        scope
      );
    }
  }

  const activeAssignmentPaths = new Set(
    assignmentDocuments
      .filter(
        (document) =>
          document.kind === "assignment" &&
          active(document.data)
      )
      .map((document) => document.path)
  );

  const readyAssignmentCandidates:
    CleanupCandidate[] = [];

  const blockedAssignmentCandidates:
    CleanupCandidate[] = [];

  for (const document of assignmentDocuments) {
    if (
      document.kind !== "assignment" ||
      !active(document.data)
    ) {
      continue;
    }

    const scope = assignmentScope(
      document.data,
      scopes,
      wrongClassIdToScope
    );

    if (!scope) continue;

    const currentClassId =
      documentClassId(document.data);

    if (currentClassId === scope.classId) {
      continue;
    }

    const replacementPath =
      canonicalAssignmentPath(
        document.path,
        scope.classId
      );

    const hasCanonicalReplacement =
      !!replacementPath &&
      activeAssignmentPaths.has(
        replacementPath
      );

    const candidate = candidateIdentity(
      document,
      scope,
      [
        text(document.data.pilotId) &&
        text(document.data.pilotId) !==
          scope.pilotId
          ? "cross_scope_assignment"
          : "noncanonical_assignment_class_id",
        hasCanonicalReplacement
          ? "canonical_assignment_exists"
          : "canonical_assignment_missing"
      ]
    );

    if (hasCanonicalReplacement) {
      readyAssignmentCandidates.push(
        candidate
      );
    } else {
      blockedAssignmentCandidates.push(
        candidate
      );
    }
  }

  const archiveCandidates = [
    ...readyAttendanceCandidates,
    ...readyAssignmentCandidates
  ].sort(
    (left, right) =>
      left.path.localeCompare(right.path)
  );

  const blockedCandidates = [
    ...blockedAttendanceCandidates,
    ...blockedAssignmentCandidates
  ].sort(
    (left, right) =>
      left.path.localeCompare(right.path)
  );

  const canonicalScopes = scopes.map((scope) => ({
    pilotId: scope.pilotId,
    label: scope.label,
    classId: scope.classId,
    activeCount: activeAttendance.filter((document) =>
      documentClassId(document.data) === scope.classId &&
      scope.sessionDates.includes(documentDate(document.data))
    ).length
  }));

  const warnings: string[] = [];

  if (
    archiveCandidates.length >
    MAX_ARCHIVE_CANDIDATES
  ) {
    warnings.push(
      `candidate count ${archiveCandidates.length} exceeds atomic archive limit ${MAX_ARCHIVE_CANDIDATES}`
    );
  }

  if (archiveCandidates.length === 0) {
    warnings.push(
      "no archive-ready legacy candidates were found"
    );
  }

  if (blockedAttendanceCandidates.length > 0) {
    warnings.push(
      `${blockedAttendanceCandidates.length} attendance documents have no active canonical replacement`
    );
  }

  if (blockedAssignmentCandidates.length > 0) {
    warnings.push(
      `${blockedAssignmentCandidates.length} assignments have no active canonical replacement`
    );
  }

  return {
    version: ATTENDANCE_LEGACY_CLEANUP_VERSION,
    canonicalScopes,
    archiveCandidates,
    blockedCandidates,

    attendanceCandidateCount:
      readyAttendanceCandidates.length,

    assignmentCandidateCount:
      readyAssignmentCandidates.length,

    blockedAttendanceCount:
      blockedAttendanceCandidates.length,

    blockedAssignmentCount:
      blockedAssignmentCandidates.length,

    assignmentRepairCount:
      blockedAssignmentCandidates.length,

    assignmentRepairDigest:
      cleanupCandidateDigest(
        blockedAssignmentCandidates
      ),

    safeToRepairAssignments:
      blockedAttendanceCandidates.length === 0 &&
      blockedAssignmentCandidates.length > 0 &&
      blockedAssignmentCandidates.length <= 20,

    activeAttendanceScanned:
      activeAttendance.length,

    activeAssignmentsScanned:
      assignmentDocuments.filter(
        (document) =>
          document.kind === "assignment" &&
          active(document.data)
      ).length,

    preservedAttendanceCount:
      activeAttendance.length -
      readyAttendanceCandidates.length,

    candidateDigest:
      cleanupCandidateDigest(
        archiveCandidates
      ),

    safeToArchive:
      archiveCandidates.length > 0 &&
      archiveCandidates.length <=
        MAX_ARCHIVE_CANDIDATES &&
      blockedCandidates.length === 0,

    maxArchiveCandidates:
      MAX_ARCHIVE_CANDIDATES,

    warnings
  };
}
