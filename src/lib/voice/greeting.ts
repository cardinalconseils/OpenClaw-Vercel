/**
 * Hardcoded greeting constants for Murphy's two-step greeting flow.
 * NEVER LLM-generated — guarantees FCC/TCPA AI disclosure compliance.
 *
 * FCC 2024-2025 rules require AI disclosure at the start of every AI-generated
 * voice call. CA SB-1001 requires clear bot disclosure.
 * The AI disclosure appears before the first question mark.
 */

export const GREETING_TIMEOUT_MS = 2000;

/** Step 1: AI disclosure + name ask */
export const GREETING_STEP_1 =
  "Hi, I'm Murphy — an AI assistant from OpenClaw Service Matchmaker. Who am I speaking with?";

/** Step 2: Personalized service question (uses caller name) */
export function GREETING_STEP_2(callerName: string): string {
  return `Hey ${callerName}, what kind of service are you looking for today?`;
}

/** Fallback when name extraction fails */
export const GREETING_STEP_2_FALLBACK =
  "What kind of service are you looking for today?";

/** TCPA consent question — asked after intent capture, before search */
export const TCPA_CONSENT_ASK =
  "Before I search, mind if I send you a text recap after we're done? It'll have the provider's info handy.";

/** Acknowledgement when caller declines SMS consent */
export const TCPA_CONSENT_DECLINE_ACK =
  "No problem at all. Let me find someone for you.";

/** Silence nudge — spoken after 8s of no caller speech */
export const SILENCE_NUDGE = "Still there?";

/** Graceful hangup after 2 unanswered nudges */
export const GRACEFUL_HANGUP =
  "It seems like you may have stepped away. Feel free to call back whenever you're ready. Take care!";

/** Off-topic redirect — when caller asks for something outside service provider scope */
export const OFF_TOPIC_REDIRECT =
  "I only handle finding service providers — plumbers, electricians, and the like. Is there a service provider I can help you find?";

/** Confused caller explainer — when caller asks "What is this?" or similar */
export const CONFUSED_CALLER_EXPLAINER =
  "I'm an AI that finds local service providers for you — plumbers, electricians, that kind of thing. What do you need help with?";
