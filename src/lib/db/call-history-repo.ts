import { getSupabaseClient } from './supabase-client.js';

export interface CallHistoryRecord {
  user_id: string;
  caller_phone: string;
  service_type: string | null;
  location: string | null;
  urgency: string | null;
  providers_contacted: Array<{ name: string; phone: string; status: string }>;
  connected_provider: string | null;
  status: 'completed' | 'no_match' | 'abandoned';
  started_at: string;
  ended_at: string | null;
}

/**
 * Persist a completed call to the call_history table.
 *
 * Called during call.hangup processing — MUST be wrapped in try/catch
 * by the caller so DB failures never block call cleanup.
 */
export async function insertCallHistory(params: CallHistoryRecord): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('call_history').insert({
    user_id: params.user_id,
    caller_phone: params.caller_phone,
    service_type: params.service_type,
    location: params.location,
    urgency: params.urgency,
    providers_contacted: params.providers_contacted,
    connected_provider: params.connected_provider,
    status: params.status,
    started_at: params.started_at,
    ended_at: params.ended_at,
  });

  if (error) {
    throw new Error(`[call-history-repo] insertCallHistory failed: ${error.message}`);
  }
}
