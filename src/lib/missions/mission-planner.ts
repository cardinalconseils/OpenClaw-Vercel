import { chat } from '../ai/orchestrator.js';
import type { MissionStepType } from '../../types/mission.js';

/** Maximum number of steps allowed per mission. */
export const MAX_STEPS_PER_MISSION = 25;

/** Valid step types for filtering LLM output. */
const VALID_STEP_TYPES: MissionStepType[] = ['call', 'sms', 'search'];

/**
 * System prompt for the Anthropic mission planner.
 *
 * Uses two-phase planning to prevent LLM hallucination of phone numbers:
 * (1) search steps come first with real queries
 * (2) call/sms steps reference {search_result_N} placeholders — real numbers
 *     are substituted at execution time from search results.
 */
const MISSION_PLANNER_PROMPT = `You are a mission planner for OpenClaw, an AI phone concierge.

Given a user's request, decompose it into a sequence of concrete steps that an automated agent can execute.

Each step must be one of:
- search: Find providers matching criteria (runs first to collect real contact info)
- call: Call a specific phone number with a script
- sms: Send an SMS to a specific number

Output a JSON array of steps. Each step must have:
- type: "search" | "call" | "sms"
- target: the search query (for search steps) OR a placeholder like {search_result_1}, {search_result_2}, etc. (for call/sms steps — NEVER fabricate real phone numbers)
- context: detailed instructions for what to say, ask, or search for
- order: integer starting at 1 (lower = runs first)

RULES:
1. Search steps ALWAYS come before call/sms steps (lower order numbers)
2. Call and SMS steps MUST use {search_result_N} placeholders as their target — NEVER invent or guess phone numbers
3. Maximum ${MAX_STEPS_PER_MISSION} steps per mission
4. Include what to say or ask in the context field for call/sms steps
5. Include what data to capture (quote, availability, name) in the context field

Output format: wrap the JSON array in a \`\`\`json code fence.

Example for "Call the top 3 plumbers in Austin and get quotes":
\`\`\`json
[
  { "type": "search", "target": "top plumbers in Austin TX", "context": "Find top 3 plumbers with phone numbers, ratings, and reviews", "order": 1 },
  { "type": "call", "target": "{search_result_1}", "context": "Hi, I am calling to get a quote for a leaky faucet repair. What is your availability and estimated cost?", "order": 2 },
  { "type": "call", "target": "{search_result_2}", "context": "Hi, I am calling to get a quote for a leaky faucet repair. What is your availability and estimated cost?", "order": 3 },
  { "type": "call", "target": "{search_result_3}", "context": "Hi, I am calling to get a quote for a leaky faucet repair. What is your availability and estimated cost?", "order": 4 }
]
\`\`\``;

/**
 * Parsed step from LLM output — before ID/missionId assignment.
 */
export interface PlannedStep {
  type: MissionStepType;
  target: string;
  context: string;
  order: number;
}

/**
 * Parse and validate the LLM response into an array of planned steps.
 *
 * Handles JSON wrapped in ```json code fences or raw JSON arrays.
 * Filters out steps with invalid types or missing required fields.
 */
export function parseMissionSteps(raw: string): PlannedStep[] {
  // Extract JSON from ```json ... ``` fences or bare JSON
  const fenceMatch = raw.match(/```json\s*([\s\S]*?)```/);
  const jsonString = fenceMatch ? fenceMatch[1].trim() : raw.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    console.warn('[mission-planner] Failed to parse LLM JSON response:', raw.slice(0, 200));
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.warn('[mission-planner] LLM response was not an array');
    return [];
  }

  const steps: PlannedStep[] = [];

  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;

    const { type, target, context, order } = item as Record<string, unknown>;

    // Validate required fields
    if (
      typeof type !== 'string' ||
      typeof target !== 'string' ||
      typeof context !== 'string' ||
      typeof order !== 'number'
    ) {
      console.warn('[mission-planner] Skipping step with missing/invalid fields:', item);
      continue;
    }

    // Filter out invalid step types
    if (!VALID_STEP_TYPES.includes(type as MissionStepType)) {
      console.warn(`[mission-planner] Skipping step with invalid type: ${type}`);
      continue;
    }

    steps.push({ type: type as MissionStepType, target, context, order });
  }

  return steps;
}

/**
 * Decomposes a natural language mission description into a sequence of
 * executable planned steps via the Anthropic LLM (transfer-logic tier).
 *
 * Two-phase planning prevents hallucination:
 * - Phase 1 (search): LLM emits search queries — real contact info not needed yet
 * - Phase 2 (call/sms): Steps reference {search_result_N} placeholders; execution
 *   fills in real phone numbers from search results
 *
 * @param description - Natural language mission description from the user.
 * @returns Array of planned steps sorted by order (search steps first).
 * @throws Error if description is empty.
 */
export async function planMission(description: string): Promise<PlannedStep[]> {
  if (!description || description.trim().length === 0) {
    throw new Error('Mission description must not be empty');
  }

  console.log('[mission-planner] Planning mission:', description.slice(0, 100));

  const response = await chat(
    [
      { role: 'system', content: MISSION_PLANNER_PROMPT },
      { role: 'user', content: description },
    ],
    'transfer-logic',
  );

  const steps = parseMissionSteps(response);

  // Sort: search steps first, then by order within each type group
  steps.sort((a, b) => {
    if (a.type === 'search' && b.type !== 'search') return -1;
    if (a.type !== 'search' && b.type === 'search') return 1;
    return a.order - b.order;
  });

  // Cap at maximum steps per mission
  const capped = steps.slice(0, MAX_STEPS_PER_MISSION);

  console.log(`[mission-planner] Planned ${capped.length} steps`);
  return capped;
}
