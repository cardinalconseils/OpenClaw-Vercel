import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the orchestrator before importing the module under test
vi.mock('../ai/orchestrator.js', () => ({
  chat: vi.fn(),
}));

import { chat } from '../ai/orchestrator.js';
import { planMission } from './mission-planner.js';

const mockChat = vi.mocked(chat);

const makeStepsJson = (steps: Array<{ type: string; target: string; context: string; order: number }>) =>
  `\`\`\`json\n${JSON.stringify(steps)}\n\`\`\``;

describe('planMission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns search step before call steps', async () => {
    const steps = [
      { type: 'call', target: '{search_result_1}', context: 'Ask for quote', order: 2 },
      { type: 'search', target: 'plumbers in Austin', context: 'Find top 5 plumbers', order: 1 },
    ];
    mockChat.mockResolvedValue(makeStepsJson(steps));

    const result = await planMission('Call the top 5 plumbers in Austin and get quotes');

    expect(result.length).toBeGreaterThanOrEqual(2);
    // Search steps must come before call steps in the output ordering
    const searchIndex = result.findIndex((s) => s.type === 'search');
    const callIndex = result.findIndex((s) => s.type === 'call');
    expect(searchIndex).toBeLessThan(callIndex);
  });

  it('caps at MAX_STEPS_PER_MISSION (25)', async () => {
    const steps = Array.from({ length: 30 }, (_, i) => ({
      type: i === 0 ? 'search' : 'call',
      target: i === 0 ? 'query' : `{search_result_${i}}`,
      context: `Step ${i + 1}`,
      order: i + 1,
    }));
    mockChat.mockResolvedValue(makeStepsJson(steps));

    const result = await planMission('Batch call 30 plumbers');
    expect(result.length).toBe(25);
  });

  it('throws on empty description', async () => {
    await expect(planMission('')).rejects.toThrow('description');
    await expect(planMission('   ')).rejects.toThrow('description');
  });

  it('filters out steps with invalid type', async () => {
    const steps = [
      { type: 'search', target: 'plumbers', context: 'Find plumbers', order: 1 },
      { type: 'email', target: 'someone@example.com', context: 'Send email', order: 2 },
      { type: 'call', target: '{search_result_1}', context: 'Call them', order: 3 },
    ];
    mockChat.mockResolvedValue(makeStepsJson(steps));

    const result = await planMission('Find and email plumbers');
    const types = result.map((s) => s.type);
    expect(types).not.toContain('email');
    expect(types).toContain('search');
    expect(types).toContain('call');
  });

  it('uses transfer-logic task type', async () => {
    mockChat.mockResolvedValue(makeStepsJson([
      { type: 'search', target: 'plumbers', context: 'Find plumbers', order: 1 },
    ]));

    await planMission('Find plumbers');
    expect(mockChat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: 'Find plumbers' }),
      ]),
      'transfer-logic',
    );
  });

  it('handles JSON in code fences', async () => {
    const steps = [
      { type: 'search', target: 'electricians', context: 'Find electricians', order: 1 },
    ];
    mockChat.mockResolvedValue(`\`\`\`json\n${JSON.stringify(steps)}\n\`\`\``);

    const result = await planMission('Find electricians');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('search');
  });

  it('filters steps missing required fields', async () => {
    const raw = JSON.stringify([
      { type: 'search', target: 'plumbers', context: 'Find', order: 1 },
      { type: 'call', target: '{search_result_1}' }, // missing context and order
      { type: 'sms', context: 'message', order: 3 },  // missing target
    ]);
    mockChat.mockResolvedValue(`\`\`\`json\n${raw}\n\`\`\``);

    const result = await planMission('Do something');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('search');
  });
});
