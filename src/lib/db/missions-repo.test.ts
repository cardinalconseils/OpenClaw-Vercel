import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase-client before importing the repo
vi.mock('./supabase-client.js', () => ({
  getSupabaseClient: vi.fn(),
}));

import { getSupabaseClient } from './supabase-client.js';
import {
  createMission,
  getMission,
  updateMissionStatus,
  createMissionEvent,
  getMissionEvents,
  updateMissionEvent,
} from './missions-repo.js';

function makeChain(returnValue: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ['from', 'insert', 'select', 'single', 'eq', 'update', 'order'];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  // Terminal call returns data
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: returnValue, error: null });
  (chain.select as ReturnType<typeof vi.fn>).mockImplementation((fields?: string) => {
    if (fields === undefined || fields === '*') {
      // When used as terminal (e.g. getMissionEvents), return array
      return {
        ...chain,
        eq: vi.fn(() => ({
          ...chain,
          order: vi.fn().mockResolvedValue({ data: returnValue, error: null }),
          single: vi.fn().mockResolvedValue({ data: returnValue, error: null }),
        })),
      };
    }
    return chain;
  });
  return chain;
}

describe('createMission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls supabase.from("missions") with correct snake_case columns', async () => {
    const mockMission = {
      id: 'mission-1',
      user_id: 'user-1',
      channel: 'voice',
      description: 'test',
      status: 'created',
      plan: null,
      summary: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      completed_at: null,
    };

    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockMission, error: null }),
      }),
    });
    const fromFn = vi.fn().mockReturnValue({ insert: insertFn });
    (getSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromFn });

    const result = await createMission({
      userId: 'user-1',
      channel: 'voice',
      description: 'test',
    });

    expect(fromFn).toHaveBeenCalledWith('missions');
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        channel: 'voice',
        description: 'test',
        status: 'created',
      }),
    );
    expect(result.id).toBe('mission-1');
  });
});

describe('getMission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when record not found', async () => {
    const singleFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqFn = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });
    (getSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromFn });

    const result = await getMission('does-not-exist');

    expect(fromFn).toHaveBeenCalledWith('missions');
    expect(result).toBeNull();
  });

  it('returns mission when found', async () => {
    const mockMission = {
      id: 'mission-1',
      user_id: 'user-1',
      channel: 'voice',
      description: 'test',
      status: 'created',
      plan: null,
      summary: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      completed_at: null,
    };

    const singleFn = vi.fn().mockResolvedValue({ data: mockMission, error: null });
    const eqFn = vi.fn().mockReturnValue({ single: singleFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });
    (getSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromFn });

    const result = await getMission('mission-1');

    expect(eqFn).toHaveBeenCalledWith('id', 'mission-1');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('mission-1');
  });
});

describe('updateMissionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates status and updated_at', async () => {
    const eqFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ update: updateFn });
    (getSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromFn });

    await updateMissionStatus('mission-1', 'completed');

    expect(fromFn).toHaveBeenCalledWith('missions');
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        updated_at: expect.any(String),
      }),
    );
    expect(eqFn).toHaveBeenCalledWith('id', 'mission-1');
  });
});

describe('getMissionEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('orders events by step_order ascending', async () => {
    const orderFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });
    (getSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromFn });

    await getMissionEvents('mission-1');

    expect(fromFn).toHaveBeenCalledWith('mission_events');
    expect(eqFn).toHaveBeenCalledWith('mission_id', 'mission-1');
    expect(orderFn).toHaveBeenCalledWith('step_order', { ascending: true });
  });
});

describe('createMissionEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts into mission_events with snake_case columns and returns id', async () => {
    const singleFn = vi.fn().mockResolvedValue({ data: { id: 'event-1' }, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const insertFn = vi.fn().mockReturnValue({ select: selectFn });
    const fromFn = vi.fn().mockReturnValue({ insert: insertFn });
    (getSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromFn });

    const result = await createMissionEvent({
      missionId: 'mission-1',
      stepOrder: 1,
      type: 'call',
      target: '+15551234567',
      context: 'Ask about pricing',
    });

    expect(fromFn).toHaveBeenCalledWith('mission_events');
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        mission_id: 'mission-1',
        step_order: 1,
        type: 'call',
        target: '+15551234567',
      }),
    );
    expect(result.id).toBe('event-1');
  });
});

describe('updateMissionEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates specified event fields', async () => {
    const eqFn = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ update: updateFn });
    (getSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromFn });

    await updateMissionEvent('event-1', { status: 'completed', callLegId: 'leg-1' });

    expect(fromFn).toHaveBeenCalledWith('mission_events');
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        call_leg_id: 'leg-1',
      }),
    );
    expect(eqFn).toHaveBeenCalledWith('id', 'event-1');
  });
});
