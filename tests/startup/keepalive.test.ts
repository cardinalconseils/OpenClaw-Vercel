import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChildProcess } from 'child_process';

// Mock child_process before importing GatewayManager
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'child_process';
import { GatewayManager } from '../../src/startup/gateway-manager.js';
import { startKeepAlive, stopKeepAlive } from '../../src/startup/keepalive.js';

const mockSpawn = vi.mocked(spawn);

function createMockProcess(): ChildProcess {
  return {
    pid: 12345,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn().mockReturnValue(true),
    killed: false,
  } as unknown as ChildProcess;
}

describe('Keep-alive', () => {
  let manager: GatewayManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockSpawn.mockReturnValue(createMockProcess());

    manager = new GatewayManager();
    manager.start();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 5: startKeepAlive() calls health check at ~5-minute intervals', async () => {
    const isHealthySpy = vi.spyOn(manager, 'isHealthy').mockResolvedValue(true);

    const timer = startKeepAlive(manager);

    // Advance by 5 minutes (300_000ms)
    await vi.advanceTimersByTimeAsync(300_000);
    expect(isHealthySpy).toHaveBeenCalledTimes(1);

    // Advance another 5 minutes
    await vi.advanceTimersByTimeAsync(300_000);
    expect(isHealthySpy).toHaveBeenCalledTimes(2);

    stopKeepAlive(timer);
  });

  it('Test 6: keep-alive triggers gateway restart when health check returns non-200', async () => {
    const isHealthySpy = vi.spyOn(manager, 'isHealthy').mockResolvedValue(false);
    const restartSpy = vi.spyOn(manager, 'restart').mockResolvedValue(undefined);

    const timer = startKeepAlive(manager);

    await vi.advanceTimersByTimeAsync(300_000);

    expect(isHealthySpy).toHaveBeenCalledTimes(1);
    expect(restartSpy).toHaveBeenCalledTimes(1);

    stopKeepAlive(timer);
  });

  it('Test 7: keep-alive triggers gateway restart when health check request times out', async () => {
    vi.spyOn(manager, 'isHealthy').mockRejectedValue(new Error('Request timed out'));
    const restartSpy = vi.spyOn(manager, 'restart').mockResolvedValue(undefined);

    const timer = startKeepAlive(manager);

    await vi.advanceTimersByTimeAsync(300_000);

    expect(restartSpy).toHaveBeenCalledTimes(1);

    stopKeepAlive(timer);
  });

  it('Test 8: stopKeepAlive() clears the interval', async () => {
    const isHealthySpy = vi.spyOn(manager, 'isHealthy').mockResolvedValue(true);

    const timer = startKeepAlive(manager);

    // Stop immediately
    stopKeepAlive(timer);

    // Advance by 10 minutes — health check should NOT be called
    await vi.advanceTimersByTimeAsync(600_000);

    expect(isHealthySpy).not.toHaveBeenCalled();
  });
});
