interface CallProviderParams {
  phone_number: string;
  provider_name: string;
}

interface CallProviderResult {
  status: string;
  provider: string;
  note: string;
}

interface TransferCallParams {
  provider_phone: string;
  caller_context?: string;
}

interface TransferCallResult {
  status: string;
  note: string;
}

export async function callProvider(params: CallProviderParams): Promise<CallProviderResult> {
  console.log(`[tools:dispatch] STUB — callProvider("${params.provider_name}", "${params.phone_number}")`);

  return {
    status: 'stub-unavailable',
    provider: params.provider_name,
    note: 'Real implementation in Phase 4',
  };
}

export async function transferCall(params: TransferCallParams): Promise<TransferCallResult> {
  console.log(`[tools:dispatch] STUB — transferCall to "${params.provider_phone}"`);

  return {
    status: 'stub-transfer-pending',
    note: 'Real implementation in Phase 5',
  };
}
