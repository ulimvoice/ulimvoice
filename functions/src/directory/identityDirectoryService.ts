import { buildIdentityDirectoryMirrorPlan, type IdentityDirectoryMirrorPlan } from "./identityDirectoryPlan.js";
import type { LegacyIdentityDirectorySnapshot } from "./identityDirectory.js";
import type { IdentityDirectoryCommitResult, IdentityDirectoryRepository } from "./firestoreIdentityDirectoryRepository.js";

export interface RunIdentityDirectoryMirrorOptions {
  snapshot: LegacyIdentityDirectorySnapshot;
  repository: IdentityDirectoryRepository;
  runId?: string;
  now?: Date;
  dryRun?: boolean;
  verifyAfterWrite?: boolean;
  allowEmptySnapshot?: boolean;
}

export interface IdentityDirectoryRunResult {
  plan: IdentityDirectoryMirrorPlan;
  commit?: IdentityDirectoryCommitResult;
  verification?: IdentityDirectoryMirrorPlan;
}

export class UnsafeIdentityDirectoryPlanError extends Error {
  constructor(public readonly plan: IdentityDirectoryMirrorPlan) {
    super(`identity directory rejected ${plan.errors.length} validation error(s)`);
  }
}

export async function runIdentityDirectoryMirror(options: RunIdentityDirectoryMirrorOptions): Promise<IdentityDirectoryRunResult> {
  const existing = await options.repository.loadAll();
  const plan = buildIdentityDirectoryMirrorPlan(options.snapshot, existing, {
    runId: options.runId,
    now: options.now,
    allowEmptySnapshot: options.allowEmptySnapshot
  });
  if (!plan.safeToCommit) throw new UnsafeIdentityDirectoryPlanError(plan);
  if (options.dryRun) return { plan };
  const commit = await options.repository.commit(plan);
  if (!options.verifyAfterWrite) return { plan, commit };
  const after = await options.repository.loadAll();
  const verification = buildIdentityDirectoryMirrorPlan(options.snapshot, after, {
    runId: `${plan.runId}__verify`,
    now: options.now,
    allowEmptySnapshot: options.allowEmptySnapshot
  });
  return { plan, commit, verification };
}
