import { describe, it, expect } from 'vitest';
import {
  MissionInputSchema,
} from './mission.js';
import type {
  Mission,
  MissionStep,
  MissionEventResult,
  MissionProgressEvent,
  MissionStatus,
  MissionChannel,
  MissionStepType,
  MissionStepStatus,
} from './mission.js';

describe('Mission types', () => {
  it('MissionStatus union is correct', () => {
    const valid: MissionStatus[] = [
      'created', 'planning', 'planned', 'executing', 'paused', 'completed', 'failed',
    ];
    expect(valid).toHaveLength(7);
  });

  it('MissionChannel union is correct', () => {
    const valid: MissionChannel[] = ['voice', 'sms', 'chat'];
    expect(valid).toHaveLength(3);
  });

  it('MissionStepType union is correct', () => {
    const valid: MissionStepType[] = ['call', 'sms', 'search'];
    expect(valid).toHaveLength(3);
  });

  it('MissionStepStatus union is correct', () => {
    const valid: MissionStepStatus[] = [
      'pending', 'in-progress', 'completed', 'failed', 'skipped',
    ];
    expect(valid).toHaveLength(5);
  });

  it('Mission interface has required fields', () => {
    const m: Mission = {
      id: 'abc',
      userId: 'user-1',
      channel: 'voice',
      description: 'Test mission',
      status: 'created',
      steps: [],
      results: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(m.id).toBe('abc');
    expect(m.completedAt).toBeUndefined();
  });

  it('MissionStep interface has required fields', () => {
    const step: MissionStep = {
      id: 'step-1',
      missionId: 'mission-1',
      order: 1,
      type: 'call',
      target: '+15551234567',
      context: 'Ask about availability',
      status: 'pending',
    };
    expect(step.callLegId).toBeUndefined();
    expect(step.scheduledAt).toBeUndefined();
  });

  it('MissionEventResult interface has required fields', () => {
    const result: MissionEventResult = {
      stepId: 'step-1',
      outcome: 'completed',
      data: { note: 'Spoke to receptionist' },
      capturedAt: new Date().toISOString(),
    };
    expect(result.data).toEqual({ note: 'Spoke to receptionist' });
  });

  it('MissionProgressEvent interface has required fields', () => {
    const event: MissionProgressEvent = {
      type: 'mission.progress',
      missionId: 'mission-1',
      step: 1,
      totalSteps: 5,
      status: 'executing',
      detail: 'Called provider 1',
      timestamp: new Date().toISOString(),
    };
    expect(event.type).toBe('mission.progress');
  });

  it('MissionInputSchema validates description required', () => {
    const result = MissionInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('MissionInputSchema accepts valid input with channel', () => {
    const result = MissionInputSchema.safeParse({
      description: 'Call top plumbers',
      channel: 'voice',
    });
    expect(result.success).toBe(true);
  });

  it('MissionInputSchema uses voice as default channel when omitted', () => {
    const result = MissionInputSchema.safeParse({ description: 'Call top plumbers' });
    expect(result.success).toBe(true);
  });

  it('MissionInputSchema rejects invalid channel', () => {
    const result = MissionInputSchema.safeParse({
      description: 'Test',
      channel: 'telegram',
    });
    expect(result.success).toBe(false);
  });
});
