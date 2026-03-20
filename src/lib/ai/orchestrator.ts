import { openRouterClient, anthropicClient } from './llm-clients.js';

/** All supported task types for LLM routing decisions. */
export type TaskType =
  | 'greeting'
  | 'intent-capture'
  | 'filler'
  | 'status-update'
  | 'disambiguation'
  | 'provider-ranking'
  | 'transfer-logic'
  | 'unknown';

/** Routine tasks routed to OpenRouter (cost-efficient, fast). */
export const ROUTINE_TASKS: TaskType[] = [
  'greeting',
  'intent-capture',
  'filler',
  'status-update',
];

/** Complex tasks routed to Anthropic (high reasoning quality). */
export const COMPLEX_TASKS: TaskType[] = [
  'disambiguation',
  'provider-ranking',
  'transfer-logic',
];

const OPENROUTER_MODEL = 'google/gemini-2.5-flash-lite';
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20251022';

/**
 * Sends a chat request to the appropriate LLM based on task type.
 *
 * Routing:
 * - ROUTINE_TASKS → OpenRouter (cheap, fast, Gemini Flash)
 * - COMPLEX_TASKS or unknown → Anthropic (high quality, Claude Sonnet)
 *
 * @param messages - Conversation history in {role, content} format.
 * @param task - Task type that determines routing tier.
 * @returns The LLM's text response.
 */
export async function chat(
  messages: Array<{ role: string; content: string }>,
  task: TaskType = 'unknown',
): Promise<string> {
  const isRoutine = ROUTINE_TASKS.includes(task);
  const tier = isRoutine ? 'openrouter' : 'anthropic';

  console.log(`[orchestrator] Routing "${task}" to ${tier}`);

  if (isRoutine) {
    const maxTokens = task === 'filler' ? 100 : 200;
    const response = await openRouterClient.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
      max_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content ?? '';
  }

  // Complex or unknown — use Anthropic
  const systemMessage = messages.find((m) => m.role === 'system');
  const conversationMessages = messages.filter((m) => m.role !== 'system');

  const response = await anthropicClient.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 500,
    ...(systemMessage ? { system: systemMessage.content } : {}),
    messages: conversationMessages as Array<{ role: 'user' | 'assistant'; content: string }>,
  });

  const block = response.content[0];
  return block?.type === 'text' ? block.text : '';
}
