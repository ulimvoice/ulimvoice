import type { AttendanceMirrorDocument } from "./attendanceMirror.js";

export interface AttendancePrivacyViolation {
  path: string;
  key: string;
  reason: string;
}

const FORBIDDEN_KEY = /(?:phone|telephone|mobile|contact|guardian|parentphone|phoneLast4|sessiontoken|firebaseproof|admintoken|solapi|alimtalk|drivefileid|전화|연락처|휴대폰|학부모번호|보호자번호)/i;

function normalizedKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9가-힣]/g, "").toLowerCase();
}

function visit(value: unknown, path: string, violations: AttendancePrivacyViolation[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, `${path}[${index}]`, violations));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizedKey(key);
    if (FORBIDDEN_KEY.test(normalized)) {
      violations.push({
        path: `${path}.${key}`,
        key,
        reason: "client-readable attendance mirror must not contain phone, token, messaging-secret, or private Drive identifier fields"
      });
      continue;
    }
    visit(child, `${path}.${key}`, violations);
  }
}

export function auditAttendanceMirrorPrivacy(documents: readonly AttendanceMirrorDocument[]): AttendancePrivacyViolation[] {
  const violations: AttendancePrivacyViolation[] = [];
  documents.forEach((document, index) => visit(document, `attendance[${index}]`, violations));
  return violations;
}

export function assertAttendanceMirrorPrivacy(documents: readonly AttendanceMirrorDocument[]): void {
  const violations = auditAttendanceMirrorPrivacy(documents);
  if (violations.length) {
    throw new Error(`attendance mirror privacy audit failed: ${violations.map((item) => item.path).join(", ")}`);
  }
}
