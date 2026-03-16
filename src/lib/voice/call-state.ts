/**
 * Per-call in-memory state management.
 *
 * Uses a module-level Map keyed by call_control_id. Initialized on call.answered,
 * updated on each transcript event, cleaned up on call.hangup.
 *
 * In-memory is intentional — active call state must be fast. Post-call analytics
 * can persist to DB separately.
 */

export interface CallState {
  callControlId: string;
  callerPhone: string;
  language: 'en' | 'fr';
  stage: 'greeting' | 'intake' | 'searching' | 'complete';
  intent: Partial<{ serviceType: string; location: string; urgency: string }>;
  clarificationTurns: number;
  startedAt: Date;
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
  if (existing) {
    _calls.set(id, { ...existing, ...patch });
  }
}

/** Removes the call state — call getCall after to confirm. */
export function endCall(id: string): void {
  _calls.delete(id);
}

/**
 * Detects the dominant language from a Deepgram Nova-3 transcript word list.
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
 * Returns true if the call has already used its one clarification turn.
 *
 * Maximum one clarifying question per call (Phase 2 design decision). If this returns
 * true, the orchestrator must proceed to search with best-available intent
 * rather than asking another question.
 */
export function shouldAdvancePastClarification(state: CallState): boolean {
  return state.clarificationTurns >= 1;
}
