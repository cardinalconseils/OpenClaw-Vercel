import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

/**
 * OpenRouter LLM client — routes to cost-efficient models for routine tasks.
 * Uses the OpenAI-compatible API surface with OpenRouter's base URL.
 */
export const openRouterClient = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  defaultHeaders: {
    'HTTP-Referer': 'https://openclaw.io',
    'X-Title': 'OpenClaw Service Matchmaker',
  },
});

/**
 * Anthropic client — handles complex reasoning tasks (disambiguation, ranking).
 */
export const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});
