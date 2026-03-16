import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('getSupabaseClient', () => {
  let originalUrl: string | undefined;
  let originalKey: string | undefined;

  beforeEach(async () => {
    originalUrl = process.env.SUPABASE_URL;
    originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    // Reset module to clear singleton
    vi.resetModules();
  });

  afterEach(() => {
    process.env.SUPABASE_URL = originalUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });

  it('throws when SUPABASE_URL is missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getSupabaseClient } = await import('./supabase-client.js');
    expect(() => getSupabaseClient()).toThrow('SUPABASE_URL');
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getSupabaseClient } = await import('./supabase-client.js');
    expect(() => getSupabaseClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('returns same instance on repeated calls (singleton)', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    const { getSupabaseClient } = await import('./supabase-client.js');
    const a = getSupabaseClient();
    const b = getSupabaseClient();
    expect(a).toBe(b);
  });

  it('resetSupabaseClient clears the singleton', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    const { getSupabaseClient, resetSupabaseClient } = await import('./supabase-client.js');
    const a = getSupabaseClient();
    resetSupabaseClient();
    const b = getSupabaseClient();
    // Both valid but created anew — they'll be different instances
    expect(a).not.toBe(b);
  });
});
