import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazy singleton Supabase client.
 * Follows the same pattern as llm-clients.ts — only instantiated when first used.
 */
let _client: SupabaseClient | undefined;

/**
 * Returns the shared Supabase client instance.
 * Throws on missing environment variables so misconfiguration is caught early.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        '[supabase] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set',
      );
    }
    _client = createClient(url, key);
  }
  return _client;
}

/**
 * Resets the singleton — for test isolation only.
 */
export function resetSupabaseClient(): void {
  _client = undefined;
}
