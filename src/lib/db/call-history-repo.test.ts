import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabase-client.js', () => ({
  getSupabaseClient: vi.fn(),
}));

import { insertCallHistory } from './call-history-repo.js';
import { getSupabaseClient } from './supabase-client.js';

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mocked(getSupabaseClient).mockReturnValue({ from: mockFrom } as any);

describe('insertCallHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    vi.mocked(getSupabaseClient).mockReturnValue({ from: mockFrom } as any);
  });

  const validParams = {
    user_id: 'admin-uuid-123',
    caller_phone: '+15551234567',
    service_type: 'plumbing',
    location: 'Montreal',
    urgency: 'urgent',
    providers_contacted: [
      { name: 'Plumb Pro', phone: '+15559876543', status: 'contacted' },
    ],
    connected_provider: 'Plumb Pro',
    status: 'completed' as const,
    started_at: '2026-03-19T12:00:00.000Z',
    ended_at: '2026-03-19T12:05:00.000Z',
  };

  it('inserts a complete call history record', async () => {
    await insertCallHistory(validParams);

    expect(mockFrom).toHaveBeenCalledWith('call_history');
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: 'admin-uuid-123',
      caller_phone: '+15551234567',
      service_type: 'plumbing',
      location: 'Montreal',
      urgency: 'urgent',
      providers_contacted: [
        { name: 'Plumb Pro', phone: '+15559876543', status: 'contacted' },
      ],
      connected_provider: 'Plumb Pro',
      status: 'completed',
      started_at: '2026-03-19T12:00:00.000Z',
      ended_at: '2026-03-19T12:05:00.000Z',
    });
  });

  it('handles null optional fields', async () => {
    const params = {
      ...validParams,
      service_type: null,
      location: null,
      urgency: null,
      connected_provider: null,
      ended_at: null,
    };

    await insertCallHistory(params);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        service_type: null,
        location: null,
        urgency: null,
        connected_provider: null,
        ended_at: null,
      }),
    );
  });

  it('throws on Supabase error', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'RLS violation' } });

    await expect(insertCallHistory(validParams)).rejects.toThrow(
      '[call-history-repo] insertCallHistory failed: RLS violation',
    );
  });
});
