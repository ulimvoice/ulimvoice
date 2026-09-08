import { randomUUID } from "node:crypto";
import { sha256Canonical } from "../source/canonicalJson.js";
import {
  convertIdentityDirectorySnapshot,
  type IdentityDirectoryConversionError,
  type IdentityDirectoryDocument,
  type LegacyIdentityDirectorySnapshot
} from "./identityDirectory.js";

export const IDENTITY_DIRECTORY_MIRROR_VERSION = 1;

export interface StoredIdentityDirectoryDocument extends IdentityDirectoryDocument {
  mirrorVersion: number;
  mirrorRunId: string;
  syncedAt: string;
  staleAt?: string;
}

export interface IdentityDirectoryPlanError {
  code: "conversion_error" | "incomplete_snapshot" | "suspicious_empty_snapshot";
  message: string;
}

export interface IdentityDirectoryReconciliation {
  expectedCount: number;
  existingActiveCount: number;
  upsertCount: number;
  unchangedCount: number;
  staleCount: number;
  missingPaths: string[];
  mismatchedPaths: string[];
  extraActivePaths: string[];
  countsByKind: Record<string, number>;
}

export interface IdentityDirectoryMirrorPlan {
  runId: string;
  snapshotAt: string;
  sourceDigest: string;
  sourceCounts: Record<string, number>;
  acceptedCount: number;
  rejectedCount: number;
  upserts: StoredIdentityDirectoryDocument[];
  unchangedPaths: string[];
  stalePaths: string[];
  conversionErrors: IdentityDirectoryConversionError[];
  errors: IdentityDirectoryPlanError[];
  reconciliation: IdentityDirectoryReconciliation;
  safeToCommit: boolean;
}

export interface BuildIdentityDirectoryPlanOptions {
  runId?: string;
  now?: Date;
  allowEmptySnapshot?: boolean;
}

export function buildIdentityDirectoryMirrorPlan(
  snapshot: LegacyIdentityDirectorySnapshot,
  existing: StoredIdentityDirectoryDocument[],
  options: BuildIdentityDirectoryPlanOptions = {}
): IdentityDirectoryMirrorPlan {
  const now = options.now || new Date();
  const runId = options.runId || `identity_${randomUUID()}`;
  const conversion = convertIdentityDirectorySnapshot(snapshot, now);
  const errors: IdentityDirectoryPlanError[] = conversion.errors.map((error) => ({
    code: "conversion_error",
    message: `${error.code}: ${error.message}`
  }));
  if (snapshot.complete !== true) {
    errors.push({ code: "incomplete_snapshot", message: "identity directory commit requires complete=true" });
  }

  const existingActiveCount = existing.filter((document) => document.active === true).length;
  if (conversion.documents.length === 0 && existingActiveCount > 0 && options.allowEmptySnapshot !== true) {
    errors.push({
      code: "suspicious_empty_snapshot",
      message: `identity directory snapshot is empty while ${existingActiveCount} active mirror document(s) exist`
    });
  }

  const expectedByPath = new Map<string, StoredIdentityDirectoryDocument>();
  for (const document of conversion.documents) {
    expectedByPath.set(document.path, {
      ...document,
      mirrorVersion: IDENTITY_DIRECTORY_MIRROR_VERSION,
      mirrorRunId: runId,
      syncedAt: now.toISOString()
    });
  }

  const existingByPath = new Map(existing.map((document) => [document.path, document]));
  const upserts: StoredIdentityDirectoryDocument[] = [];
  const unchangedPaths: string[] = [];
  const missingPaths: string[] = [];
  const mismatchedPaths: string[] = [];

  for (const [path, expected] of expectedByPath) {
    const current = existingByPath.get(path);
    if (!current) {
      missingPaths.push(path);
      upserts.push(expected);
      continue;
    }
    if (current.active !== expected.active || current.payloadDigest !== expected.payloadDigest) {
      mismatchedPaths.push(path);
      upserts.push(expected);
      continue;
    }
    unchangedPaths.push(path);
  }

  const stalePaths = existing
    .filter((document) => document.active === true && !expectedByPath.has(document.path))
    .map((document) => document.path)
    .sort();

  const countsByKind: Record<string, number> = {};
  for (const document of expectedByPath.values()) countsByKind[document.kind] = (countsByKind[document.kind] || 0) + 1;

  const sourceDigest = sha256Canonical(
    [...expectedByPath.values()].map((document) => [document.path, document.payloadDigest]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  );
  const sourceCounts = {
    accounts: snapshot.accounts.length,
    students: snapshot.students.length,
    teachers: snapshot.teachers.length,
    classes: snapshot.classes.length,
    classMembers: snapshot.classMembers.length,
    teacherAssignments: snapshot.teacherAssignments.length,
    adminAssignments: snapshot.adminAssignments.length
  };

  return {
    runId,
    snapshotAt: snapshot.snapshotAt,
    sourceDigest,
    sourceCounts,
    acceptedCount: expectedByPath.size,
    rejectedCount: conversion.errors.length,
    upserts: upserts.sort((a, b) => a.path.localeCompare(b.path)),
    unchangedPaths: unchangedPaths.sort(),
    stalePaths,
    conversionErrors: conversion.errors,
    errors,
    reconciliation: {
      expectedCount: expectedByPath.size,
      existingActiveCount,
      upsertCount: upserts.length,
      unchangedCount: unchangedPaths.length,
      staleCount: stalePaths.length,
      missingPaths: missingPaths.sort(),
      mismatchedPaths: mismatchedPaths.sort(),
      extraActivePaths: stalePaths,
      countsByKind
    },
    safeToCommit: errors.length === 0
  };
}
