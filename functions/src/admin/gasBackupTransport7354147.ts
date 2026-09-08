export interface GasSignedEnvelope7354147 {
  action: string;
  requestId: string;
  issuedAtMs: number;
  payloadJson: string;
  signature: string;
}

export interface GasTransportOptions7354147 {
  timeoutMs: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (delayMs: number) => Promise<void>;
}

const RETRYABLE_HTTP_STATUS_7354147 = new Set([404, 408, 425, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS_7354147 = [1000, 3000, 7000, 15000];

function text7354147(value: unknown, max = 1800): string {
  return String(value ?? "").trim().slice(0, max);
}

function defaultSleep7354147(delayMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function isRetryableBodyMessage7354147(message: string): boolean {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized === "SIGNED_ENVELOPE_REQUIRED" ||
    normalized === "INVALID_ACTION" ||
    normalized.includes("인증 파라미터가 누락되었습니다");
}

function isRetryableTransportError7354147(error: unknown): boolean {
  const message = text7354147(error instanceof Error ? error.message : error, 2200);
  if (/^GAS_HTTP_(404|408|425|429|500|502|503|504)$/.test(message)) return true;
  if (/AbortError|TimeoutError|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(message)) return true;
  if (/^GAS_RETRYABLE_BODY:/.test(message)) return true;
  return false;
}

export function encodeGasEnvelopeForm7354147(envelope: GasSignedEnvelope7354147): string {
  return new URLSearchParams({
    action: text7354147(envelope.action, 200),
    requestId: text7354147(envelope.requestId, 300),
    issuedAtMs: String(Number(envelope.issuedAtMs || 0)),
    payloadJson: String(envelope.payloadJson || ""),
    signature: text7354147(envelope.signature, 500)
  }).toString();
}

export async function postGasEnvelopeWithRetry7354147(
  url: string,
  envelope: GasSignedEnvelope7354147,
  options: GasTransportOptions7354147
): Promise<Record<string, unknown>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? defaultSleep7354147;
  const timeoutMs = Math.max(1000, Math.floor(Number(options.timeoutMs || 0)));
  const maxAttempts = Math.min(5, Math.max(1, Math.floor(Number(options.maxAttempts || 4))));
  const body = encodeGasEnvelopeForm7354147(envelope);
  let lastError: unknown = new Error("GAS_TRANSPORT_FAILED");

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "Accept": "application/json,text/plain,*/*"
        },
        body,
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs)
      });
      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`GAS_HTTP_${response.status}`);
      }
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        throw new Error(`GAS_INVALID_JSON:${raw.slice(0, 200)}`);
      }
      const status = text7354147(parsed.status, 40);
      const ok = parsed.ok === true || status === "success";
      if (ok) return parsed;
      const message = text7354147(parsed.message, 1800) || `${envelope.action} 실패`;
      if (isRetryableBodyMessage7354147(message)) {
        throw new Error(`GAS_RETRYABLE_BODY:${message}`);
      }
      throw new Error(message);
    } catch (error) {
      lastError = error;
      const canRetry = attempt + 1 < maxAttempts && isRetryableTransportError7354147(error);
      if (!canRetry) throw error;
      const delayMs = RETRY_DELAYS_MS_7354147[Math.min(attempt, RETRY_DELAYS_MS_7354147.length - 1)];
      await sleepImpl(delayMs);
    }
  }
  throw lastError;
}
