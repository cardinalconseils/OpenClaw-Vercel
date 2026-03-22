/**
 * Per-call in-memory state management.
 *
 * Uses a module-level Map keyed by call_control_id. Initialized on call.answered,
 * updated on each transcript event, cleaned up on call.hangup.
 *
 * In-memory is intentional — active call state must be fast. Post-call analytics
 * can persist to DB separately.
 */

// Type-only import to avoid circular dependency with search.ts
import type { Provider } from '../tools/handlers/search.js';
export type { Provider };

export interface CallState {
  callControlId: string;
  callerPhone: string;
  language: 'en' | 'fr';
  stage: 'greeting' | 'name_capture' | 'intake' | 'consent' | 'searching' | 'calling' | 'transferred' | 'complete';
  pendingBridge: boolean;
  intent: Partial<{ serviceType: string; location: string; urgency: string }>;
  clarificationTurns: number;
  startedAt: Date;
  callerName: string | undefined;
  smsConsent: boolean | undefined;
  consentTimestamp: string | undefined;
  consentMethod: 'verbal' | undefined;
  silenceNudgeTimer: ReturnType<typeof setTimeout> | undefined;
  silenceNudgeCount: number;
  providers: Provider[];
  currentProviderIndex: number;
  providerCallControlId: string | undefined;
}

const _calls = new Map<string, CallState>();

/**
 * Initialize a new call state with defaults.
 * Language defaults to 'en'; updated after first transcript via detectLanguage().
 */
export function initCall(callControlId: string, callerPhone: string): CallState {
  const state: CallState = {
    callControlId,
    callerPhone,
    language: 'en',
    stage: 'greeting',
    intent: {},
    clarificationTurns: 0,
    startedAt: new Date(),
    callerName: undefined,
    smsConsent: undefined,
    consentTimestamp: undefined,
    consentMethod: undefined,
    silenceNudgeTimer: undefined,
    silenceNudgeCount: 0,
    providers: [],
    currentProviderIndex: 0,
    providerCallControlId: undefined,
    pendingBridge: false,
  };
  _calls.set(callControlId, state);
  return state;
}

/** Returns the current state for a call, or undefined if not found. */
export function getCall(id: string): CallState | undefined {
  return _calls.get(id);
}

/**
 * Merges a partial patch into the existing call state.
 * No-op if the call ID is not found.
 */
export function updateCall(id: string, patch: Partial<CallState>): void {
  const existing = _calls.get(id);
  if (!existing) {
    console.warn(`[call-state] updateCall for unknown call ${id} — state may have been cleaned up`);
    return;
  }
  _calls.set(id, { ...existing, ...patch });
}

/** Clears silence nudge timer and removes the call state. */
export function endCall(id: string): void {
  const state = _calls.get(id);
  if (state?.silenceNudgeTimer) clearTimeout(state.silenceNudgeTimer);
  _calls.delete(id);
}

/**
 * Detects the dominant language from a transcript word list.
 *
 * Returns 'fr' if more than 30% of words are tagged with language='fr',
 * otherwise returns 'en'. Empty arrays always return 'en'.
 *
 * Uses the >30% threshold to avoid classifying English calls as French when
 * the caller says a single French word (e.g. "bon").
 */
export function detectLanguage(
  words: Array<{ word: string; language: string }>
): 'en' | 'fr' {
  if (words.length === 0) return 'en';
  const frCount = words.filter((w) => w.language === 'fr').length;
  return frCount > words.length * 0.3 ? 'fr' : 'en';
}

/**
 * Returns true if the call has already used its maximum clarification turns (>= 2).
 *
 * Maximum two clarifying questions per call (Phase 2 design decision). If this returns
 * true, the orchestrator must proceed to search with best-available intent
 * rather than asking another question.
 */
export function shouldAdvancePastClarification(state: CallState): boolean {
  return state.clarificationTurns >= 2;
}
