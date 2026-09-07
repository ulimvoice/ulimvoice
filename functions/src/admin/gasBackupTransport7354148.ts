export interface GasSignedEnvelope7354148 {
  action: string;
  requestId: string;
  issuedAtMs: number;
  payloadJson: string;
  signature: string;
}

export interface GasTransportOptions7354148 {
  timeoutMs: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (delayMs: number) => Promise<void>;
}

export const GAS_BACKUP_TRANSPORT_VERSION_7354149 = "2026-08-05.735.04.14.9-route-first-small-resume";
const RETRY_DELAYS_MS_7354148 = [1000, 3000, 7000, 15000, 30000];

function text7354148(value: unknown, max = 1800): string {
  return String(value ?? "").trim().slice(0, max);
}

function defaultSleep7354148(delayMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function isRetryableBodyMessage7354148(message: string): boolean {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized === "SIGNED_ENVELOPE_REQUIRED" ||
    normalized === "INVALID_ACTION" ||
    normalized.includes("인증 파라미터가 누락되었습니다") ||
    normalized === "BACKUP_POST_REQUIRED_7354149";
}

function isRetryableTransportError7354148(error: unknown): boolean {
  const message = text7354148(error instanceof Error ? error.message : error, 2200);
  if (/^GAS_HTTP_(404|408|425|429|500|502|503|504)$/.test(message)) return true;
  if (/AbortError|TimeoutError|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(message)) return true;
  if (/^GAS_RETRYABLE_BODY:/.test(message)) return true;
  if (/^GAS_INVALID_JSON:</.test(message)) return true;
  return false;
}

export function encodeGasEnvelopeJson7354148(envelope: GasSignedEnvelope7354148): string {
  return JSON.stringify({
    action: text7354148(envelope.action, 200),
    requestId: text7354148(envelope.requestId, 300),
    issuedAtMs: Number(envelope.issuedAtMs || 0),
    payloadJson: String(envelope.payloadJson || ""),
    signature: text7354148(envelope.signature, 500)
  });
}

export function buildGasBackupEndpoint7354148(url: string, action: string): string {
  const endpoint = new URL(url);
  endpoint.searchParams.set("action", text7354148(action, 200));
  endpoint.searchParams.set("ulimBackupTransport", "7354149");
  return endpoint.toString();
}

export async function postGasEnvelopeWithRetry7354148(
  url: string,
  envelope: GasSignedEnvelope7354148,
  options: GasTransportOptions7354148
): Promise<Record<string, unknown>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? defaultSleep7354148;
  const timeoutMs = Math.max(1000, Math.floor(Number(options.timeoutMs || 0)));
  const maxAttempts = Math.min(6, Math.max(1, Math.floor(Number(options.maxAttempts || 5))));
  const body = encodeGasEnvelopeJson7354148(envelope);
  const endpoint = buildGasBackupEndpoint7354148(url, envelope.action);
  let lastError: unknown = new Error("GAS_TRANSPORT_FAILED");

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
          "Accept": "application/json,text/plain,*/*",
          "Cache-Control": "no-store",
          "X-Ulim-Backup-Transport": "7354149"
        },
        body,
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs)
      });
      const raw = await response.text();
      if (!response.ok) throw new Error(`GAS_HTTP_${response.status}`);
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        throw new Error(`GAS_INVALID_JSON:${raw.slice(0, 200)}`);
      }
      const status = text7354148(parsed.status, 40);
      const ok = parsed.ok === true || status === "success";
      if (ok) return parsed;
      const message = text7354148(parsed.message, 1800) || `${envelope.action} 실패`;
      if (isRetryableBodyMessage7354148(message)) {
        throw new Error(`GAS_RETRYABLE_BODY:${message}`);
      }
      throw new Error(message);
    } catch (error) {
      lastError = error;
      const canRetry = attempt + 1 < maxAttempts && isRetryableTransportError7354148(error);
      if (!canRetry) throw error;
      const delayMs = RETRY_DELAYS_MS_7354148[Math.min(attempt, RETRY_DELAYS_MS_7354148.length - 1)];
      await sleepImpl(delayMs);
    }
  }
  throw lastError;
}
