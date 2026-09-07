import { onSchedule } from "firebase-functions/v2/scheduler";
import { ULIM_FUNCTION_REGION } from "../common/firebaseRegion.js";
import { beginOperation, type IdempotencyStore } from "../common/idempotency.js";
import type { LegacyGasGateway, SheetWriteResult } from "../common/sheets.js";
import { normalizeAttendanceStatus } from "../mirror/attendanceMirror.js";

export interface ClassSessionCandidate {
  sessionId: string;
  sessionDate: string;
  classId: string;
  studentUid: string;
  status: string;
  endedAt: string;
  enrollmentStatus?: string;
  isCanceled?: boolean;
  isMakeupPlanned?: boolean;
  isBeforeFirstClass?: boolean;
  adminExcluded?: boolean;
}

export interface AutoAbsentPlan {
  requestId: string;
  sessionId: string;
  sessionDate: string;
  studentUid: string;
  status: "X";
  reason: "auto_absent_after_60_minutes";
}

export interface AutoAbsentDependencies {
  store: IdempotencyStore;
  gas: LegacyGasGateway;
  listCandidates(): Promise<ClassSessionCandidate[]>;
  updateMirror(plan: AutoAbsentPlan): Promise<void>;
}

export interface AutoAbsentBatchResult {
  planned: AutoAbsentPlan[];
  skipped: number;
  failed: { candidate: ClassSessionCandidate; error: string }[];
}

export function shouldAutoMarkAbsent(candidate: ClassSessionCandidate, now = new Date()): boolean {
  if (normalizeAttendanceStatus(candidate.status) !== "unchecked") return false;
  if (["\uD734\uC6D0", "\uD1F4\uC6D0"].includes(candidate.enrollmentStatus || "")) return false;
  if (candidate.isCanceled || candidate.isMakeupPlanned || candidate.isBeforeFirstClass || candidate.adminExcluded) return false;
  const endedAt = new Date(candidate.endedAt).getTime();
  if (!Number.isFinite(endedAt)) return false;
  return now.getTime() - endedAt >= 60 * 60 * 1000;
}

export function buildAutoAbsentRequestId(candidate: ClassSessionCandidate): string {
  return `autoAbsent:${candidate.sessionDate}:${candidate.sessionId}:${candidate.studentUid}`;
}

export async function planAutoAbsent(
  store: IdempotencyStore,
  candidate: ClassSessionCandidate,
  now = new Date()
): Promise<AutoAbsentPlan | null> {
  if (!shouldAutoMarkAbsent(candidate, now)) return null;
  const requestId = buildAutoAbsentRequestId(candidate);
  await beginOperation(store, requestId, "autoAbsent", now);
  return {
    requestId,
    sessionId: candidate.sessionId,
    sessionDate: candidate.sessionDate,
    studentUid: candidate.studentUid,
    status: "X",
    reason: "auto_absent_after_60_minutes"
  };
}

export async function processAutoAbsentBatch(
  deps: AutoAbsentDependencies,
  now = new Date()
): Promise<AutoAbsentBatchResult> {
  const result: AutoAbsentBatchResult = { planned: [], skipped: 0, failed: [] };
  const candidates = await deps.listCandidates();
  for (const candidate of candidates) {
    try {
      const plan = await planAutoAbsent(deps.store, candidate, now);
      if (!plan) {
        result.skipped += 1;
        continue;
      }
      const sheetResult = await deps.gas.request<SheetWriteResult>({
        action: "adminSaveAttendance",
        params: { requestId: plan.requestId, status: plan.status, sessionId: plan.sessionId, studentUid: plan.studentUid }
      });
      if (!sheetResult.ok) throw new Error(sheetResult.message || "Google Sheets absent write failed");
      await deps.updateMirror(plan);
      result.planned.push(plan);
    } catch (error) {
      result.failed.push({ candidate, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}

export function createAutoAbsentScheduledFunction(depsFactory: () => AutoAbsentDependencies) {
  return onSchedule(
    {
      region: ULIM_FUNCTION_REGION,
      schedule: "every 15 minutes",
      timeZone: "Asia/Seoul"
    },
    async () => {
      await processAutoAbsentBatch(depsFactory());
    }
  );
}

export const autoAbsentScheduleSpec = {
  schedule: "every 15 minutes",
  timeZone: "Asia/Seoul",
  deployed: false,
  description: "Phase 1.1 skeleton only. Do not deploy until reviewed."
};
