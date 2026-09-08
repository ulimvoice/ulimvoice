import type { LegacyAttendanceRecord } from "./attendanceMirror.js";
import {
  buildAttendanceMirrorPlan,
  type AttendanceMirrorPlan,
  type AttendanceMirrorScope
} from "./attendanceMirrorPlan.js";
import type {
  AttendanceMirrorCommitResult,
  AttendanceMirrorRepository
} from "./firestoreAttendanceMirrorRepository.js";

export interface AttendanceMirrorSource {
  fetchAttendance(scope: AttendanceMirrorScope): Promise<LegacyAttendanceRecord[]>;
}

export interface RunAttendanceMirrorOptions {
  source: AttendanceMirrorSource;
  repository: AttendanceMirrorRepository;
  scope: AttendanceMirrorScope;
  runId?: string;
  now?: Date;
  dryRun?: boolean;
  verifyAfterWrite?: boolean;
  /**
   * Required only when an authoritative source intentionally confirms that a
   * previously populated scope is now empty. The default is fail-closed so a
   * transient GAS/Sheets outage cannot mass-deactivate the mirror.
   */
  allowEmptySnapshot?: boolean;
}

export interface AttendanceMirrorRunResult {
  plan: AttendanceMirrorPlan;
  commit?: AttendanceMirrorCommitResult;
  verification?: AttendanceMirrorPlan;
}

export class UnsafeAttendanceMirrorPlanError extends Error {
  constructor(public readonly plan: AttendanceMirrorPlan) {
    super(`attendance mirror rejected ${plan.errors.length} invalid row(s)`);
  }
}

export async function runAttendanceMirror(options: RunAttendanceMirrorOptions): Promise<AttendanceMirrorRunResult> {
  const [rows, existing] = await Promise.all([
    options.source.fetchAttendance(options.scope),
    options.repository.loadScope(options.scope)
  ]);
  const plan = buildAttendanceMirrorPlan(rows, existing, options.scope, {
    runId: options.runId,
    now: options.now,
    allowEmptySnapshot: options.allowEmptySnapshot
  });
  if (!plan.safeToCommit) throw new UnsafeAttendanceMirrorPlanError(plan);
  if (options.dryRun) return { plan };

  const commit = await options.repository.commit(plan);
  if (!options.verifyAfterWrite) return { plan, commit };

  const after = await options.repository.loadScope(options.scope);
  const verification = buildAttendanceMirrorPlan(rows, after, options.scope, {
    runId: `${plan.runId}__verify`,
    now: options.now,
    allowEmptySnapshot: options.allowEmptySnapshot
  });
  return { plan, commit, verification };
}
