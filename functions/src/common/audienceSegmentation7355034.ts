export type AudienceGroup7355034 = "adult" | "youth" | "unclassified";

function text7355034(value: unknown): string {
  return String(value == null ? "" : value).trim();
}

export function normalizeAudienceGroup7355034(value: unknown): AudienceGroup7355034 | "" {
  const key = text7355034(value).normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  if (["adult", "성인", "성인반"].includes(key)) return "adult";
  if (["youth", "juvenile", "청소년", "청소년반"].includes(key)) return "youth";
  if (["unclassified", "미분류"].includes(key)) return "unclassified";
  return "";
}

export function seoulCalendarYear7355034(now = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric" }).formatToParts(now);
    const year = Number(parts.find(part => part.type === "year")?.value || 0);
    if (Number.isInteger(year) && year >= 2000 && year <= 2200) return year;
  } catch {}
  return now.getUTCFullYear();
}

export function automaticStudentAudience7355034(birthDate: unknown, referenceYear = seoulCalendarYear7355034()): AudienceGroup7355034 {
  const raw = text7355034(birthDate);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return "unclassified";
  const birthYear = Number(match[1]);
  if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > referenceYear) return "unclassified";
  return referenceYear - birthYear >= 20 ? "adult" : "youth";
}

export function studentAudienceDetails7355034(source: Record<string, unknown> | null | undefined, referenceYear = seoulCalendarYear7355034()): {
  group: AudienceGroup7355034;
  autoGroup: AudienceGroup7355034;
  override: "adult" | "youth" | "";
  source: "manual" | "auto_birth_year" | "unclassified";
} {
  const row = source || {};
  const overrideRaw = normalizeAudienceGroup7355034(row.audienceGroupOverride ?? row.studentAudienceOverride);
  const override = overrideRaw === "adult" || overrideRaw === "youth" ? overrideRaw : "";
  const autoGroup = automaticStudentAudience7355034(row.birthDate ?? row.dateOfBirth, referenceYear);
  if (override) return { group: override, autoGroup, override, source: "manual" };
  if (autoGroup !== "unclassified") return { group: autoGroup, autoGroup, override: "", source: "auto_birth_year" };
  const stored = normalizeAudienceGroup7355034(row.audienceGroup ?? row.studentAudienceGroup);
  if (stored === "adult" || stored === "youth") return { group: stored, autoGroup, override: "", source: "manual" };
  return { group: "unclassified", autoGroup, override: "", source: "unclassified" };
}

export function classAudienceGroup7355034(source: Record<string, unknown> | null | undefined): "adult" | "youth" {
  const row = source || {};
  const explicit = normalizeAudienceGroup7355034(row.audienceGroup ?? row.classAudienceGroup ?? row.targetAudience);
  const explicitSource = text7355034(row.audienceGroupSource ?? row.classAudienceGroupSource ?? row.targetAudienceSource).normalize("NFKC").toLowerCase();

  // 관리자 수동 지정은 반명 자동추론보다 항상 우선합니다.
  if ((explicit === "adult" || explicit === "youth") && ["admin", "manual", "관리자", "수동"].includes(explicitSource)) return explicit;

  // 운영 반명에서 청소년 계열을 자동 판별합니다. '초급'처럼 단순히 '초'가 들어간
  // 성인 반이 오분류되지 않도록 실제 연령대 키워드만 사용합니다.
  const className = text7355034(row.className ?? row.name ?? row.baseName).normalize("NFKC");
  if (/(청소년|초등(?:부|학생)?|중등(?:부|학생)?|중학생|중고등|고등(?:부|학생)?)/.test(className)) return "youth";
  if (/성인/.test(className)) return "adult";

  // 기존 저장값은 명시적인 반명 단서가 없을 때만 호환값으로 사용합니다.
  if (explicit === "adult" || explicit === "youth") return explicit;
  return "adult";
}

export function audienceLabel7355034(group: unknown): string {
  const normalized = normalizeAudienceGroup7355034(group);
  if (normalized === "adult") return "성인";
  if (normalized === "youth") return "청소년";
  return "미분류";
}
