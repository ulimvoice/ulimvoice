export type RealtimeAuthVersion = number | "uidv2";

export function normalizeRealtimeAuthVersion(
  value: unknown
): RealtimeAuthVersion | null {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1
  ) {
    return value;
  }

  if (typeof value === "string") {
    const normalized =
      value
        .trim()
        .replace(/\s+/g, "")
        .toLowerCase();

    if (normalized === "uidv2") {
      return "uidv2";
    }
  }

  return null;
}

export function realtimeAuthVersionsEqual(
  left: unknown,
  right: unknown
): boolean {
  const normalizedLeft =
    normalizeRealtimeAuthVersion(left);
  const normalizedRight =
    normalizeRealtimeAuthVersion(right);

  return (
    normalizedLeft !== null &&
    normalizedRight !== null &&
    normalizedLeft === normalizedRight
  );
}
