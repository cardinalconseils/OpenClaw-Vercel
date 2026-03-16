import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Structural tests for src/server.ts — verify mission system wiring exists.
 *
 * These tests read the source file directly and assert the required import
 * and call are present. This avoids spinning up the full server/gateway.
 */

const serverSource = readFileSync(join(import.meta.dirname, 'server.ts'), 'utf-8');

describe('server.ts — mission system wiring', () => {
  it('imports initMissions from mission-orchestrator', () => {
    expect(serverSource).toMatch(/import\s*\{\s*initMissions\s*\}.*mission-orchestrator/);
  });

  it('awaits initMissions() inside the isDirectExecution IIFE', () => {
    expect(serverSource).toContain('await initMissions()');
  });

  it('logs mission system initialized after the call', () => {
    expect(serverSource).toContain("'[server] Mission system initialized'");
  });

  it('initMissions() call appears after the gatewayReady guard', () => {
    const guardIndex = serverSource.indexOf('process.exit(1)');
    const initIndex = serverSource.indexOf('await initMissions()');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(initIndex).toBeGreaterThan(-1);
    expect(initIndex).toBeGreaterThan(guardIndex);
  });

  it('initMissions() call appears before Infrastructure ready log', () => {
    const initIndex = serverSource.indexOf('await initMissions()');
    const readyIndex = serverSource.indexOf('Infrastructure ready');
    expect(initIndex).toBeGreaterThan(-1);
    expect(readyIndex).toBeGreaterThan(-1);
    expect(initIndex).toBeLessThan(readyIndex);
  });
});
