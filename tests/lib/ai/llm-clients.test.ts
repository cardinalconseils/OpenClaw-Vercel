import { describe, it, expect } from 'vitest';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

describe('LLM Clients', () => {
  it('openRouterClient is an OpenAI instance', async () => {
    const { openRouterClient } = await import('../../../src/lib/ai/llm-clients.js');
    expect(openRouterClient).toBeInstanceOf(OpenAI);
  });

  it('openRouterClient baseURL contains openrouter.ai', async () => {
    const { openRouterClient } = await import('../../../src/lib/ai/llm-clients.js');
    expect(openRouterClient.baseURL).toContain('openrouter.ai');
  });

  it('openRouterClient has HTTP-Referer default header', async () => {
    const { openRouterClient } = await import('../../../src/lib/ai/llm-clients.js');
    const headers = openRouterClient['_options']?.defaultHeaders as Record<string, string> | undefined;
    expect(headers?.['HTTP-Referer']).toBeDefined();
  });

  it('openRouterClient has X-Title default header', async () => {
    const { openRouterClient } = await import('../../../src/lib/ai/llm-clients.js');
    const headers = openRouterClient['_options']?.defaultHeaders as Record<string, string> | undefined;
    expect(headers?.['X-Title']).toBeDefined();
  });

  it('anthropicClient is an Anthropic instance', async () => {
    const { anthropicClient } = await import('../../../src/lib/ai/llm-clients.js');
    expect(anthropicClient).toBeInstanceOf(Anthropic);
  });
});
