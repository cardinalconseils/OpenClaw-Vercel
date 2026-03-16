import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be hoisted before imports
vi.mock('../db/missions-repo.js', () => ({
  createMission: vi.fn(),
  getMission: vi.fn(),
  updateMissionStatus: vi.fn(),
  createMissionEvent: vi.fn(),
}));

vi.mock('./mission-planner.js', () => ({
  planMission: vi.fn(),
}));

import { MissionEngine } from './mission-engine.js';
import { createMission, getMission, updateMissionStatus, createMissionEvent } from '../db/missions-repo.js';
import { planMission } from './mission-planner.js';

const mockCreateMission = vi.mocked(createMission);
const mockGetMission = vi.mocked(getMission);
const mockUpdateMissionStatus = vi.mocked(updateMissionStatus);
const mockCreateMissionEvent = vi.mocked(createMissionEvent);
const mockPlanMission = vi.mocked(planMission);

function makeMission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mission-123',
    userId: 'user-456',
    channel: 'voice' as const,
    description: 'Call plumbers',
    status: 'created' as const,
    steps: [],
    results: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('MissionEngine', () => {
  let engine: MissionEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new MissionEngine();
  });

  describe('create()', () => {
    it('returns mission id', async () => {
      mockCreateMission.mockResolvedValue(makeMission());
      const id = await engine.create('user-456', 'voice', 'Call plumbers');
      expect(id).toBe('mission-123');
      expect(mockCreateMission).toHaveBeenCalledWith({
        userId: 'user-456',
        channel: 'voice',
        description: 'Call plumbers',
      });
    });
  });

  describe('plan()', () => {
    it('transitions created -> planning -> planned', async () => {
      mockGetMission.mockResolvedValue(makeMission({ status: 'created' }));
      mockPlanMission.mockResolvedValue([
        { type: 'search', target: 'plumbers', context: 'Find plumbers', order: 1 },
      ]);
      mockCreateMissionEvent.mockResolvedValue({ id: 'event-1' });
      mockUpdateMissionStatus.mockResolvedValue(undefined);

      await engine.plan('mission-123');

      const calls = mockUpdateMissionStatus.mock.calls;
      expect(calls[0][0]).toBe('mission-123');
      expect(calls[0][1]).toBe('planning');
      expect(calls[1][0]).toBe('mission-123');
      expect(calls[1][1]).toBe('planned');
    });

    it('calls planMission with description', async () => {
      mockGetMission.mockResolvedValue(makeMission({ status: 'created', description: 'Call plumbers' }));
      mockPlanMission.mockResolvedValue([]);
      mockUpdateMissionStatus.mockResolvedValue(undefined);

      await engine.plan('mission-123');
      expect(mockPlanMission).toHaveBeenCalledWith('Call plumbers');
    });

    it('creates events for each step', async () => {
      mockGetMission.mockResolvedValue(makeMission({ status: 'created', description: 'Do something' }));
      mockPlanMission.mockResolvedValue([
        { type: 'search', target: 'query', context: 'find stuff', order: 1 },
        { type: 'call', target: '{search_result_1}', context: 'call them', order: 2 },
        { type: 'sms', target: '{search_result_1}', context: 'text them', order: 3 },
      ]);
      mockCreateMissionEvent.mockResolvedValue({ id: 'event-1' });
      mockUpdateMissionStatus.mockResolvedValue(undefined);

      await engine.plan('mission-123');
      expect(mockCreateMissionEvent).toHaveBeenCalledTimes(3);
    });

    it('throws on non-created mission', async () => {
      mockGetMission.mockResolvedValue(makeMission({ status: 'executing' }));

      await expect(engine.plan('mission-123')).rejects.toThrow('Cannot');
    });

    it('transitions to failed on planMission error', async () => {
      mockGetMission.mockResolvedValue(makeMission({ status: 'created' }));
      mockPlanMission.mockRejectedValue(new Error('LLM error'));
      mockUpdateMissionStatus.mockResolvedValue(undefined);

      await expect(engine.plan('mission-123')).rejects.toThrow('LLM error');
      expect(mockUpdateMissionStatus).toHaveBeenCalledWith('mission-123', 'failed', expect.objectContaining({ summary: expect.any(String) }));
    });
  });

  describe('start()', () => {
    it('transitions planned -> executing', async () => {
      mockGetMission.mockResolvedValue(makeMission({ status: 'planned' }));
      mockUpdateMissionStatus.mockResolvedValue(undefined);

      await engine.start('mission-123');
      expect(mockUpdateMissionStatus).toHaveBeenCalledWith('mission-123', 'executing');
    });

    it('throws on non-planned mission', async () => {
      mockGetMission.mockResolvedValue(makeMission({ status: 'created' }));

      await expect(engine.start('mission-123')).rejects.toThrow('Cannot');
    });
  });

  describe('complete()', () => {
    it('sets completedAt', async () => {
      mockGetMission.mockResolvedValue(makeMission({ status: 'executing' }));
      mockUpdateMissionStatus.mockResolvedValue(undefined);

      await engine.complete('mission-123');
      expect(mockUpdateMissionStatus).toHaveBeenCalledWith(
        'mission-123',
        'completed',
        expect.objectContaining({ completedAt: expect.any(String) }),
      );
    });
  });

  describe('fail()', () => {
    it('can be called from any state', async () => {
      mockGetMission.mockResolvedValue(makeMission({ status: 'executing' }));
      mockUpdateMissionStatus.mockResolvedValue(undefined);

      await expect(engine.fail('mission-123', 'something went wrong')).resolves.not.toThrow();
      expect(mockUpdateMissionStatus).toHaveBeenCalledWith('mission-123', 'failed', expect.objectContaining({ summary: 'something went wrong' }));
    });
  });

  describe('getStatus()', () => {
    it('returns current mission', async () => {
      const mission = makeMission({ status: 'executing' });
      mockGetMission.mockResolvedValue(mission);

      const result = await engine.getStatus('mission-123');
      expect(result).toEqual(mission);
    });

    it('returns null for missing mission', async () => {
      mockGetMission.mockResolvedValue(null);
      const result = await engine.getStatus('nonexistent');
      expect(result).toBeNull();
    });
  });
});
