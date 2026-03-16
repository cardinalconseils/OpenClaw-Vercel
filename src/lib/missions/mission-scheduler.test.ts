import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be hoisted before any imports
vi.mock('../tools/registry.js', () => ({
  executeTool: vi.fn(),
}));

vi.mock('../db/missions-repo.js', () => ({
  updateMissionEvent: vi.fn(),
  getMissionEvents: vi.fn(),
}));

vi.mock('./rate-limiter.js', () => ({
  smsLimiter: { acquire: vi.fn().mockResolvedValue(undefined) },
  callLimiter: { acquire: vi.fn().mockResolvedValue(undefined) },
}));

import { MissionScheduler } from './mission-scheduler.js';
import { executeTool } from '../tools/registry.js';
import { updateMissionEvent } from '../db/missions-repo.js';
import { smsLimiter, callLimiter } from './rate-limiter.js';

const mockExecuteTool = vi.mocked(executeTool);
const mockUpdateMissionEvent = vi.mocked(updateMissionEvent);
const mockSmsAcquire = vi.mocked(smsLimiter.acquire);
const mockCallAcquire = vi.mocked(callLimiter.acquire);

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
    missionId: 'mission-1',
    order: 1,
    type: 'search' as const,
    target: 'plumbers in Austin',
    context: 'Find top 5 plumbers',
    status: 'pending' as const,
    ...overrides,
  };
}

describe('MissionScheduler', () => {
  let scheduler: MissionScheduler;

  beforeEach(() => {
    vi.clearAllMocks();
    scheduler = new MissionScheduler();
    mockExecuteTool.mockResolvedValue({ result: 'ok' });
    mockUpdateMissionEvent.mockResolvedValue(undefined);
  });

  it('processes steps sequentially', async () => {
    const steps = [
      makeStep({ id: 'step-1', order: 1, type: 'search' }),
      makeStep({ id: 'step-2', order: 2, type: 'search' }),
      makeStep({ id: 'step-3', order: 3, type: 'search' }),
    ];

    await scheduler.enqueue('mission-1', steps);

    expect(mockExecuteTool).toHaveBeenCalledTimes(3);
    const callOrder = mockExecuteTool.mock.invocationCallOrder;
    expect(callOrder[0]).toBeLessThan(callOrder[1]);
    expect(callOrder[1]).toBeLessThan(callOrder[2]);
  });

  it('acquires sms rate limiter before sms step', async () => {
    const step = makeStep({ type: 'sms', target: '+15550001234', context: 'Hello!' });
    await scheduler.enqueue('mission-1', [step]);

    expect(mockSmsAcquire).toHaveBeenCalledOnce();
    // Limiter acquire must happen before executeTool
    const acquireOrder = mockSmsAcquire.mock.invocationCallOrder[0];
    const executeOrder = mockExecuteTool.mock.invocationCallOrder[0];
    expect(acquireOrder).toBeLessThan(executeOrder);
  });

  it('acquires call rate limiter before call step', async () => {
    const step = makeStep({ type: 'call', target: '+15550001234', context: 'Ask for quote' });
    await scheduler.enqueue('mission-1', [step]);

    expect(mockCallAcquire).toHaveBeenCalledOnce();
    const acquireOrder = mockCallAcquire.mock.invocationCallOrder[0];
    const executeOrder = mockExecuteTool.mock.invocationCallOrder[0];
    expect(acquireOrder).toBeLessThan(executeOrder);
  });

  it('does not acquire rate limiter for search step', async () => {
    const step = makeStep({ type: 'search' });
    await scheduler.enqueue('mission-1', [step]);

    expect(mockSmsAcquire).not.toHaveBeenCalled();
    expect(mockCallAcquire).not.toHaveBeenCalled();
  });

  it('marks step in-progress then completed', async () => {
    const step = makeStep({ id: 'step-1' });
    await scheduler.enqueue('mission-1', [step]);

    const calls = mockUpdateMissionEvent.mock.calls;
    // First call: in-progress
    expect(calls[0][0]).toBe('step-1');
    expect(calls[0][1]).toMatchObject({ status: 'in-progress' });
    // Second call: completed
    expect(calls[1][0]).toBe('step-1');
    expect(calls[1][1]).toMatchObject({ status: 'completed' });
  });

  it('marks failed step and continues to next step', async () => {
    mockExecuteTool
      .mockRejectedValueOnce(new Error('Tool failed'))
      .mockResolvedValueOnce({ result: 'ok' });

    const steps = [
      makeStep({ id: 'step-1', order: 1 }),
      makeStep({ id: 'step-2', order: 2 }),
    ];

    await scheduler.enqueue('mission-1', steps);

    expect(mockExecuteTool).toHaveBeenCalledTimes(2);
    // First step marked failed
    const calls = mockUpdateMissionEvent.mock.calls;
    const failedCall = calls.find((c) => c[0] === 'step-1' && (c[1] as { status?: string }).status === 'failed');
    expect(failedCall).toBeDefined();
    // Second step still processed
    const step2Calls = calls.filter((c) => c[0] === 'step-2');
    expect(step2Calls.length).toBeGreaterThan(0);
  });

  it('calls onStepComplete callback after each step', async () => {
    const onStepComplete = vi.fn();
    scheduler.onStepComplete = onStepComplete;

    const step = makeStep({ id: 'step-1' });
    await scheduler.enqueue('mission-1', [step]);

    expect(onStepComplete).toHaveBeenCalledWith('step-1', expect.any(Object));
  });

  it('calls onMissionComplete when all steps for a mission are done', async () => {
    const onMissionComplete = vi.fn();
    scheduler.onMissionComplete = onMissionComplete;

    const steps = [
      makeStep({ id: 'step-1', missionId: 'mission-1', order: 1 }),
      makeStep({ id: 'step-2', missionId: 'mission-1', order: 2 }),
    ];

    await scheduler.enqueue('mission-1', steps);

    expect(onMissionComplete).toHaveBeenCalledWith('mission-1');
  });

  it('isProcessing returns true while processing, false after', async () => {
    let processingDuring = false;

    mockExecuteTool.mockImplementation(async () => {
      processingDuring = scheduler.isProcessing();
      return { result: 'ok' };
    });

    const step = makeStep();
    await scheduler.enqueue('mission-1', [step]);

    expect(processingDuring).toBe(true);
    expect(scheduler.isProcessing()).toBe(false);
  });
});
