import { describe, it, expect, vi } from 'vitest';
import { TOOLS, executeTool } from '../../../src/lib/tools/registry';

// Mock searchProviders so registry tests don't require GOOGLE_MAPS_API_KEY.
// The real searchProviders is tested in search.test.ts.
vi.mock('../../../src/lib/tools/handlers/search.js', () => ({
  searchProviders: vi.fn().mockResolvedValue({ providers: [], source: 'google_places', count: 0 }),
}));

describe('TOOLS array', () => {
  it('has exactly 6 entries', () => {
    expect(TOOLS).toHaveLength(6);
  });

  it('each tool has name, description, and input_schema fields', () => {
    for (const tool of TOOLS) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('input_schema');
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.input_schema).toBe('object');
    }
  });

  it('tool names include search_providers, call_provider, transfer_call, send_sms, create_mission, get_mission_status', () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toContain('search_providers');
    expect(names).toContain('call_provider');
    expect(names).toContain('transfer_call');
    expect(names).toContain('send_sms');
    expect(names).toContain('create_mission');
    expect(names).toContain('get_mission_status');
  });
});

describe('executeTool', () => {
  it('resolves without throwing for search_providers', async () => {
    await expect(
      executeTool('search_providers', { service_type: 'plumber', location: 'Austin' })
    ).resolves.toBeDefined();
  });

  it('search_providers returns object with providers array', async () => {
    const result = await executeTool('search_providers', {
      service_type: 'plumber',
      location: 'Austin',
    });
    expect(result).toHaveProperty('providers');
    expect(Array.isArray((result as { providers: unknown[] }).providers)).toBe(true);
  });

  it('call_provider resolves with status field', async () => {
    const result = await executeTool('call_provider', {
      phone_number: '+15550001234',
      provider_name: 'Acme',
    });
    expect(result).toHaveProperty('status');
  });

  it('transfer_call resolves with status field', async () => {
    const result = await executeTool('transfer_call', {
      provider_phone: '+15550001234',
    });
    expect(result).toHaveProperty('status');
  });

  it('send_sms resolves with sent: true', async () => {
    const result = await executeTool('send_sms', {
      to: '+15550001234',
      message: 'test',
    });
    expect(result).toHaveProperty('sent', true);
  });

  it('unknown tool name throws or returns error', async () => {
    await expect(executeTool('nonexistent_tool', {})).rejects.toThrow();
  });
});
