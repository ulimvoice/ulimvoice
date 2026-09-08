export interface LegacyGasRequest {
  action: string;
  params: Record<string, unknown>;
}

export interface LegacyGasGateway {
  request<T>(request: LegacyGasRequest): Promise<T>;
}

export interface SheetWriteResult {
  ok: boolean;
  requestId: string;
  updatedRows?: number;
  message?: string;
}

export interface PlannedWrite<TPayload> {
  requestId: string;
  operation: string;
  payload: TPayload;
}

export async function writeThroughGas<TPayload>(
  gateway: LegacyGasGateway,
  action: string,
  plannedWrite: PlannedWrite<TPayload>
): Promise<SheetWriteResult> {
  return gateway.request<SheetWriteResult>({
    action,
    params: {
      requestId: plannedWrite.requestId,
      operation: plannedWrite.operation,
      payload: plannedWrite.payload
    }
  });
}

export function assertSheetSaved(result: SheetWriteResult): void {
  if (!result.ok) {
    throw new Error(result.message || "Google Sheets write failed");
  }
}

