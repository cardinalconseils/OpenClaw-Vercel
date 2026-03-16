import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../missions/mission-engine.js', () => ({
  missionEngine: {
    create: vi.fn(),
    plan: vi.fn(),
    start: vi.fn(),
    getStatus: vi.fn(),
  },
}));

vi.mock('../../missions/mission-scheduler.js', () => ({
  missionScheduler: {
    enqueue: vi.fn(),
  },
}));

vi.mock('../../db/missions-repo.js', () => ({
  getMissionEvents: vi.fn(),
}));

import { createMissionHandler, getMissionStatusHandler } from './missions.js';
import { missionEngine } from '../../missions/mission-engine.js';
import { missionScheduler } from '../../missions/mission-scheduler.js';
import { getMissionEvents } from '../../db/missions-repo.js';

const mockEngine = vi.mocked(missionEngine);
const mockScheduler = vi.mocked(missionScheduler);
const mockGetMissionEvents = vi.mocked(getMissionEvents);

function makePlannedSteps(count = 2) {
  return Array.from({ length: count }, (_, i) => ({
    id: `step-${i + 1}`,
    missionId: 'mission-123',
    order: i + 1,
    type: 'search' as const,
    target: `target-${i + 1}`,
    context: `context-${i + 1}`,
    status: 'pending' as const,
  }));
}

function makeMission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mission-123',
    userId: 'user-1',
    channel: 'voice' as const,
    description: 'Find plumbers',
    status: 'executing' as const,
    steps: [],
    results: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('createMissionHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine.create.mockResolvedValue('mission-123');
    mockEngine.plan.mockResolvedValue(makePlannedSteps());
    mockEngine.start.mockResolvedValue(undefined);
    mockGetMissionEvents.mockResolvedValue(makePlannedSteps());
    mockScheduler.enqueue.mockResolvedValue(undefined);
  });

  it('creates and starts mission via engine in order', async () => {
    await createMissionHandler({ description: 'Find plumbers' });

    expect(mockEngine.create).toHaveBeenCalledBefore(mockEngine.plan as ReturnType<typeof vi.fn>);
    expect(mockEngine.plan).toHaveBeenCalledBefore(mockEngine.start as ReturnType<typeof vi.fn>);
  });

  it('calls engine.create with correct userId and channel', async () => {
    await createMissionHandler({ description: 'Find plumbers', userId: 'user-42', channel: 'sms' });
    expect(mockEngine.create).toHaveBeenCalledWith('user-42', 'sms', 'Find plumbers');
  });

  it('defaults channel to voice when not provided', async () => {
    await createMissionHandler({ description: 'Find plumbers' });
    expect(mockEngine.create).toHaveBeenCalledWith('unknown', 'voice', 'Find plumbers');
  });

  it('enqueues steps in the scheduler', async () => {
    await createMissionHandler({ description: 'Find plumbers' });
    expect(mockScheduler.enqueue).toHaveBeenCalledWith('mission-123', expect.any(Array));
  });

  it('returns step count and step details', async () => {
    const result = await createMissionHandler({ description: 'Find plumbers' });
    expect(result.missionId).toBe('mission-123');
    expect(result.status).toBe('executing');
    expect(result.stepCount).toBe(2);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]).toMatchObject({ order: 1, type: 'search' });
  });

  it('returns failed status on error', async () => {
    mockEngine.create.mockRejectedValue(new Error('DB error'));
    const result = await createMissionHandler({ description: 'Find plumbers' });
    expect(result.status).toBe('failed');
    expect(result.missionId).toBe('');
    expect(result.error).toContain('DB error');
  });
});

describe('getMissionStatusHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns status with event counts', async () => {
    mockEngine.getStatus.mockResolvedValue(makeMission());
    mockGetMissionEvents.mockResolvedValue([
      { ...makePlannedSteps(1)[0], status: 'completed' },
      { ...makePlannedSteps(1)[0], id: 'step-2', status: 'failed' },
      { ...makePlannedSteps(1)[0], id: 'step-3', status: 'pending' },
    ]);

    const result = await getMissionStatusHandler({ mission_id: 'mission-123' });
    expect(result.missionId).toBe('mission-123');
    expect(result.status).toBe('executing');
    expect(result.stepsTotal).toBe(3);
    expect(result.stepsCompleted).toBe(1);
    expect(result.stepsFailed).toBe(1);
  });

  it('returns not_found for missing mission', async () => {
    mockEngine.getStatus.mockResolvedValue(null);
    const result = await getMissionStatusHandler({ mission_id: 'nonexistent' });
    expect(result.status).toBe('not_found');
    expect(result.stepsTotal).toBe(0);
  });
});
