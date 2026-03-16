import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be hoisted before any imports
vi.mock('./mission-engine.js', () => ({
  missionEngine: {
    complete: vi.fn(),
    fail: vi.fn(),
  },
}));

vi.mock('./mission-scheduler.js', () => ({
  missionScheduler: {
    onStepComplete: undefined,
    onMissionComplete: undefined,
    enqueue: vi.fn(),
  },
}));

vi.mock('./mission-reporter.js', () => ({
  missionReporter: {
    generateSummary: vi.fn(),
    reportStepProgress: vi.fn(),
  },
}));

vi.mock('../db/missions-repo.js', () => ({
  getMissionEvents: vi.fn(),
}));

vi.mock('../db/supabase-client.js', () => ({
  getSupabaseClient: vi.fn(),
}));

import { initMissions, recoverIncompleteMissions } from './mission-orchestrator.js';
import { missionEngine } from './mission-engine.js';
import { missionScheduler } from './mission-scheduler.js';
import { missionReporter } from './mission-reporter.js';
import { getMissionEvents } from '../db/missions-repo.js';
import { getSupabaseClient } from '../db/supabase-client.js';

const mockMissionEngine = vi.mocked(missionEngine);
const mockMissionScheduler = vi.mocked(missionScheduler);
const mockMissionReporter = vi.mocked(missionReporter);
const mockGetMissionEvents = vi.mocked(getMissionEvents);
const mockGetSupabaseClient = vi.mocked(getSupabaseClient);

function makeSupabaseClient(missions: Array<{ id: string }> = []) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: missions, error: null }),
      }),
    }),
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
    status: 'pending' as const,
    ...overrides,
  };
}

describe('MissionOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset scheduler callbacks
    mockMissionScheduler.onStepComplete = undefined;
    mockMissionScheduler.onMissionComplete = undefined;
    mockGetSupabaseClient.mockReturnValue(makeSupabaseClient([]) as unknown as ReturnType<typeof getSupabaseClient>);
  });

  describe('initMissions()', () => {
    it('wires onStepComplete callback on missionScheduler', async () => {
      await initMissions();
      expect(typeof mockMissionScheduler.onStepComplete).toBe('function');
    });

    it('wires onMissionComplete callback on missionScheduler', async () => {
      await initMissions();
      expect(typeof mockMissionScheduler.onMissionComplete).toBe('function');
    });

    it('calls recoverIncompleteMissions during init (queries Supabase)', async () => {
      await initMissions();
      expect(mockGetSupabaseClient).toHaveBeenCalled();
    });
  });

  describe('onMissionComplete callback', () => {
    it('generates summary and completes mission', async () => {
      mockMissionReporter.generateSummary.mockResolvedValue('Mission complete: 3 calls made.');
      mockMissionEngine.complete.mockResolvedValue(undefined);

      await initMissions();
      // Invoke the wired callback
      await mockMissionScheduler.onMissionComplete?.('mission-123');

      expect(mockMissionReporter.generateSummary).toHaveBeenCalledWith('mission-123');
      expect(mockMissionEngine.complete).toHaveBeenCalledWith('mission-123', 'Mission complete: 3 calls made.');
    });

    it('fails mission when summary generation throws', async () => {
      mockMissionReporter.generateSummary.mockRejectedValue(new Error('LLM timeout'));
      mockMissionEngine.fail.mockResolvedValue(undefined);

      await initMissions();
      await mockMissionScheduler.onMissionComplete?.('mission-123');

      expect(mockMissionEngine.fail).toHaveBeenCalledWith(
        'mission-123',
        expect.stringContaining('LLM timeout'),
      );
      expect(mockMissionEngine.complete).not.toHaveBeenCalled();
    });
  });

  describe('recoverIncompleteMissions()', () => {
    it('re-enqueues pending events for executing missions', async () => {
      const pendingStep = makeStep({ status: 'pending' });
      const inProgressStep = makeStep({ id: 'step-2', status: 'in-progress' });

      mockGetSupabaseClient.mockReturnValue(
        makeSupabaseClient([{ id: 'mission-123' }]) as unknown as ReturnType<typeof getSupabaseClient>,
      );
      mockGetMissionEvents.mockResolvedValue([pendingStep, inProgressStep]);
      mockMissionScheduler.enqueue.mockResolvedValue(undefined);

      const count = await recoverIncompleteMissions();

      expect(mockMissionScheduler.enqueue).toHaveBeenCalledWith(
        'mission-123',
        expect.arrayContaining([pendingStep, inProgressStep]),
      );
      expect(count).toBe(1);
    });

    it('returns 0 when no incomplete missions exist', async () => {
      mockGetSupabaseClient.mockReturnValue(
        makeSupabaseClient([]) as unknown as ReturnType<typeof getSupabaseClient>,
      );

      const count = await recoverIncompleteMissions();

      expect(count).toBe(0);
      expect(mockMissionScheduler.enqueue).not.toHaveBeenCalled();
    });

    it('returns 0 when Supabase returns null data', async () => {
      mockGetSupabaseClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      } as unknown as ReturnType<typeof getSupabaseClient>);

      const count = await recoverIncompleteMissions();
      expect(count).toBe(0);
    });
  });
});
