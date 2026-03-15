import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock both LLM clients before importing orchestrator
vi.mock('../../../src/lib/ai/llm-clients.js', () => {
  const openRouterCreate = vi.fn().mockResolvedValue({
    choices: [{ message: { content: 'openrouter response' } }],
  });
  const anthropicCreate = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'anthropic response' }],
  });

  return {
    openRouterClient: {
      chat: {
        completions: {
          create: openRouterCreate,
        },
      },
    },
    anthropicClient: {
      messages: {
        create: anthropicCreate,
      },
    },
  };
});

describe('Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports ROUTINE_TASKS array', async () => {
    const { ROUTINE_TASKS } = await import('../../../src/lib/ai/orchestrator.js');
    expect(Array.isArray(ROUTINE_TASKS)).toBe(true);
    expect(ROUTINE_TASKS.length).toBeGreaterThan(0);
  });

  it('exports COMPLEX_TASKS array', async () => {
    const { COMPLEX_TASKS } = await import('../../../src/lib/ai/orchestrator.js');
    expect(Array.isArray(COMPLEX_TASKS)).toBe(true);
    expect(COMPLEX_TASKS.length).toBeGreaterThan(0);
  });

  it('chat() with task="greeting" routes to OpenRouter', async () => {
    const { chat } = await import('../../../src/lib/ai/orchestrator.js');
    const { openRouterClient, anthropicClient } = await import('../../../src/lib/ai/llm-clients.js');

    await chat([{ role: 'user', content: 'hello' }], 'greeting');

    expect(openRouterClient.chat.completions.create).toHaveBeenCalledOnce();
    expect(anthropicClient.messages.create).not.toHaveBeenCalled();
  });

  it('chat() with task="intent-capture" routes to OpenRouter', async () => {
    const { chat } = await import('../../../src/lib/ai/orchestrator.js');
    const { openRouterClient, anthropicClient } = await import('../../../src/lib/ai/llm-clients.js');

    await chat([{ role: 'user', content: 'I need a plumber' }], 'intent-capture');

    expect(openRouterClient.chat.completions.create).toHaveBeenCalledOnce();
    expect(anthropicClient.messages.create).not.toHaveBeenCalled();
  });

  it('chat() with task="filler" routes to OpenRouter with max_tokens <= 200', async () => {
    const { chat } = await import('../../../src/lib/ai/orchestrator.js');
    const { openRouterClient } = await import('../../../src/lib/ai/llm-clients.js');

    await chat([{ role: 'user', content: 'ok' }], 'filler');

    expect(openRouterClient.chat.completions.create).toHaveBeenCalledOnce();
    const callArgs = (openRouterClient.chat.completions.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.max_tokens).toBeLessThanOrEqual(200);
  });

  it('chat() with task="disambiguation" routes to Anthropic', async () => {
    const { chat } = await import('../../../src/lib/ai/orchestrator.js');
    const { openRouterClient, anthropicClient } = await import('../../../src/lib/ai/llm-clients.js');

    await chat([{ role: 'user', content: 'what do you mean?' }], 'disambiguation');

    expect(anthropicClient.messages.create).toHaveBeenCalledOnce();
    expect(openRouterClient.chat.completions.create).not.toHaveBeenCalled();
  });

  it('chat() with task="provider-ranking" routes to Anthropic', async () => {
    const { chat } = await import('../../../src/lib/ai/orchestrator.js');
    const { openRouterClient, anthropicClient } = await import('../../../src/lib/ai/llm-clients.js');

    await chat([{ role: 'user', content: 'rank these providers' }], 'provider-ranking');

    expect(anthropicClient.messages.create).toHaveBeenCalledOnce();
    expect(openRouterClient.chat.completions.create).not.toHaveBeenCalled();
  });

  it('chat() with task="unknown" routes to Anthropic (safe fallback)', async () => {
    const { chat } = await import('../../../src/lib/ai/orchestrator.js');
    const { openRouterClient, anthropicClient } = await import('../../../src/lib/ai/llm-clients.js');

    await chat([{ role: 'user', content: 'something unusual' }], 'unknown');

    expect(anthropicClient.messages.create).toHaveBeenCalledOnce();
    expect(openRouterClient.chat.completions.create).not.toHaveBeenCalled();
  });

  it('chat() returns a string', async () => {
    const { chat } = await import('../../../src/lib/ai/orchestrator.js');

    const result = await chat([{ role: 'user', content: 'hello' }], 'greeting');
    expect(typeof result).toBe('string');
  });
});
