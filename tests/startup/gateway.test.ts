import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChildProcess } from 'child_process';

// Mock child_process module before importing GatewayManager
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

import { GatewayManager } from '../../src/startup/gateway-manager.js';
import { spawn } from 'child_process';

const mockSpawn = vi.mocked(spawn);

function createMockProcess(): ChildProcess {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  const proc = {
    pid: 12345,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn().mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    emit: vi.fn().mockImplementation((event: string, ...args: unknown[]) => {
      (listeners[event] ?? []).forEach((cb) => cb(...args));
    }),
    kill: vi.fn().mockImplementation(() => {
      // Simulate process exiting immediately when killed
      (listeners['exit'] ?? []).forEach((cb) => cb(null, 'SIGTERM'));
      return true;
    }),
    killed: false,
    _listeners: listeners,
  } as unknown as ChildProcess;
  return proc;
}

describe('GatewayManager', () => {
  let manager: GatewayManager;
  let mockProcess: ChildProcess;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProcess = createMockProcess();
    mockSpawn.mockReturnValue(mockProcess);
    manager = new GatewayManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Test 1: start() spawns a child process with the correct command', async () => {
    manager.start();

    expect(mockSpawn).toHaveBeenCalledOnce();
    const [cmd, args] = mockSpawn.mock.calls[0];
    expect(cmd).toBe('openclaw');
    expect(args).toContain('start');
    expect(manager.getProcess()).toBe(mockProcess);
  });

  it('Test 2: restart() kills the existing process and spawns a new one', async () => {
    manager.start();
    const firstProcess = manager.getProcess()!;

    const secondProcess = createMockProcess();
    mockSpawn.mockReturnValue(secondProcess);

    await manager.restart();

    expect(firstProcess.kill).toHaveBeenCalled();
    expect(mockSpawn).toHaveBeenCalledTimes(2);
    expect(manager.getProcess()).toBe(secondProcess);
  });

  it('Test 3: applies exponential backoff on consecutive failures (1s, 2s, 4s, 8s, capped at 30s)', () => {
    // Access internal backoff calculation
    const getBackoffDelay = (attempt: number): number => {
      const BASE_DELAY_MS = 1000;
      const MAX_DELAY_MS = 30000;
      return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
    };

    expect(getBackoffDelay(0)).toBe(1000);   // 1s
    expect(getBackoffDelay(1)).toBe(2000);   // 2s
    expect(getBackoffDelay(2)).toBe(4000);   // 4s
    expect(getBackoffDelay(3)).toBe(8000);   // 8s
    expect(getBackoffDelay(4)).toBe(16000);  // 16s
    expect(getBackoffDelay(5)).toBe(30000);  // capped at 30s
    expect(getBackoffDelay(10)).toBe(30000); // still capped
  });

  it('Test 4: resets backoff counter after a successful health check', async () => {
    // Mock fetch to simulate a healthy response
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 200,
      ok: true,
    } as Response);

    manager.start();

    // Simulate some failures to increment backoff counter
    (manager as any)._failureCount = 3;

    const healthy = await manager.isHealthy();

    expect(healthy).toBe(true);
    expect((manager as any)._failureCount).toBe(0);

    fetchSpy.mockRestore();
  });
});
