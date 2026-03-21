import { startOutboundCascade, bridgeToUser } from '../../voice/outbound-caller.js';
import { getCall } from '../../voice/call-state.js';

interface CallProviderParams {
  phone_number: string;
  provider_name: string;
  ring_timeout_ms?: number;
  call_control_id?: string;  // user's callControlId to start cascade on
}

interface CallProviderResult {
  status: string;
  provider: string;
  note: string;
}

interface TransferCallParams {
  provider_phone: string;
  caller_context?: string;
  call_control_id?: string;
}

interface TransferCallResult {
  status: string;
  note: string;
}

export async function callProvider(params: CallProviderParams): Promise<CallProviderResult> {
  const userCallControlId = params.call_control_id;
  if (!userCallControlId) {
    console.log(`[tools:dispatch] callProvider called without call_control_id — cannot start cascade`);
    return {
      status: 'error',
      provider: params.provider_name,
      note: 'Missing call_control_id — cannot initiate outbound cascade',
    };
  }

  const state = getCall(userCallControlId);
  if (!state || state.providers.length === 0) {
    console.log(`[tools:dispatch] No providers in state for ${userCallControlId}`);
    return {
      status: 'no-providers',
      provider: params.provider_name,
      note: 'No providers available in call state',
    };
  }

  console.log(`[tools:dispatch] Starting outbound cascade for ${userCallControlId}`);
  await startOutboundCascade(userCallControlId);

  return {
    status: 'cascade-started',
    provider: params.provider_name,
    note: `Outbound cascade initiated — dialing up to ${state.providers.length} providers`,
  };
}

export async function transferCall(params: TransferCallParams): Promise<TransferCallResult> {
  const userCallControlId = params.call_control_id;
  if (!userCallControlId) {
    console.log(`[tools:dispatch] transferCall called without call_control_id`);
    return { status: 'error', note: 'Missing call_control_id' };
  }

  const state = getCall(userCallControlId);
  if (!state?.providerCallControlId) {
    console.log(`[tools:dispatch] No active provider leg for ${userCallControlId}`);
    return { status: 'error', note: 'No active provider call to bridge' };
  }

  try {
    await bridgeToUser(state.providerCallControlId, userCallControlId);
    return { status: 'bridge-initiated', note: 'Bridge command sent to Telnyx' };
  } catch (err) {
    console.error(`[tools:dispatch] Bridge failed for ${userCallControlId}:`, err);
    return { status: 'error', note: 'Bridge API call failed' };
  }
}
