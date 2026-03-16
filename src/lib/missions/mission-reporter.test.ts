import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be hoisted before any imports
vi.mock('../db/missions-repo.js', () => ({
  getMission: vi.fn(),
  getMissionEvents: vi.fn(),
}));

vi.mock('../ai/orchestrator.js', () => ({
  chat: vi.fn(),
}));

import { MissionReporter } from './mission-reporter.js';
import { getMission, getMissionEvents } from '../db/missions-repo.js';
import { chat } from '../ai/orchestrator.js';

const mockGetMission = vi.mocked(getMission);
const mockGetMissionEvents = vi.mocked(getMissionEvents);
const mockChat = vi.mocked(chat);

function makeMission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mission-123',
    userId: 'user-456',
    channel: 'voice' as const,
    description: 'Call the top 5 plumbers in Austin',
    status: 'executing' as const,
    steps: [],
    results: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeStep(overrides: Partial<{
  id: string;
  missionId: string;
  order: number;
  type: 'call' | 'sms' | 'search';
  target: string;
  context: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
}> = {}) {
  return {
    id: 'step-1',
    missionId: 'mission-123',
    order: 1,
    type: 'call' as const,
    target: '+15550001234',
    context: 'Call plumber',
    status: 'completed' as const,
    ...overrides,
  };
}

describe('MissionReporter', () => {
  let reporter: MissionReporter;

  beforeEach(() => {
    vi.clearAllMocks();
    reporter = new MissionReporter();
  });

  describe('reportStepProgress()', () => {
    it('emits MissionProgressEvent with correct fields', () => {
      const callback = vi.fn();
      reporter.onProgressEvent = callback;

      reporter.reportStepProgress('mission-123', 2, 5, 'completed', 'Called plumber ABC');

      expect(callback).toHaveBeenCalledOnce();
      const event = callback.mock.calls[0][0];
      expect(event.missionId).toBe('mission-123');
      expect(event.step).toBe(2);
      expect(event.totalSteps).toBe(5);
      expect(event.status).toBe('completed');
      expect(event.detail).toBe('Called plumber ABC');
    });

    it('event has type mission.progress', () => {
      const callback = vi.fn();
      reporter.onProgressEvent = callback;

      reporter.reportStepProgress('mission-123', 1, 3, 'in-progress', 'Calling...');

      const event = callback.mock.calls[0][0];
      expect(event.type).toBe('mission.progress');
    });

    it('event includes timestamp', () => {
      const callback = vi.fn();
      reporter.onProgressEvent = callback;

      reporter.reportStepProgress('mission-123', 1, 3, 'completed', 'Done');

      const event = callback.mock.calls[0][0];
      expect(event.timestamp).toBeDefined();
      expect(typeof event.timestamp).toBe('string');
      expect(event.timestamp.length).toBeGreaterThan(0);
    });

    it('does not throw if onProgressEvent is not set', () => {
      expect(() =>
        reporter.reportStepProgress('mission-123', 1, 3, 'completed', 'Done'),
      ).not.toThrow();
    });
  });

  describe('generateSummary()', () => {
    it('fetches mission and events by missionId', async () => {
      mockGetMission.mockResolvedValue(makeMission());
      mockGetMissionEvents.mockResolvedValue([]);
      mockChat.mockResolvedValue('Summary text');

      await reporter.generateSummary('mission-123');

      expect(mockGetMission).toHaveBeenCalledWith('mission-123');
      expect(mockGetMissionEvents).toHaveBeenCalledWith('mission-123');
    });

    it('calls chat with status-update task type', async () => {
      mockGetMission.mockResolvedValue(makeMission());
      mockGetMissionEvents.mockResolvedValue([makeStep()]);
      mockChat.mockResolvedValue('Summary text');

      await reporter.generateSummary('mission-123');

      expect(mockChat).toHaveBeenCalledWith(
        expect.any(Array),
        'status-update',
      );
    });

    it('includes completed/failed counts in chat prompt', async () => {
      mockGetMission.mockResolvedValue(makeMission());
      mockGetMissionEvents.mockResolvedValue([
        makeStep({ id: 'step-1', status: 'completed' }),
        makeStep({ id: 'step-2', status: 'completed' }),
        makeStep({ id: 'step-3', status: 'failed' }),
      ]);
      mockChat.mockResolvedValue('Summary text');

      await reporter.generateSummary('mission-123');

      const messages = mockChat.mock.calls[0][0];
      const userMessage = messages.find((m: { role: string; content: string }) => m.role === 'user');
      expect(userMessage.content).toContain('2');  // completed count
      expect(userMessage.content).toContain('1');  // failed count
      expect(userMessage.content).toContain('3');  // total count
    });

    it("returns 'Mission not found' for missing mission", async () => {
      mockGetMission.mockResolvedValue(null);

      const result = await reporter.generateSummary('nonexistent');

      expect(result).toBe('Mission not found');
      expect(mockChat).not.toHaveBeenCalled();
    });

    it('returns LLM response as summary', async () => {
      mockGetMission.mockResolvedValue(makeMission());
      mockGetMissionEvents.mockResolvedValue([makeStep()]);
      mockChat.mockResolvedValue('Called 3 plumbers. 2 available, 1 unavailable.');

      const result = await reporter.generateSummary('mission-123');

      expect(result).toBe('Called 3 plumbers. 2 available, 1 unavailable.');
    });
  });
});
