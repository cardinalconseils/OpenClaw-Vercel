/**
 * Bilingual filler phrase selection with escalation support.
 *
 * Emitted before tool calls (search_providers, call_provider, etc.) to prevent
 * dead air while the LLM and tool execute. Uses round-robin rotation so callers
 * hear different phrases on repeated tool calls within the same session.
 *
 * startFillerLoop provides a 10-second repeated filler loop with escalation
 * phrases at the 10s and 20s marks for longer operations.
 */

export const FILLERS_EN: string[] = [
  "Let me look that up for you.",
  "One moment while I search.",
  "Give me just a second.",
  "Searching for the best options now.",
  "Let me check on that for you.",
  "Hang tight — I'm on it.",
  "Just a moment.",
  "Looking into that right now.",
  "I'll find someone for you.",
  "Bear with me for a second.",
  "Checking that out for you now.",
  "Give me a moment to look.",
  "Almost there — searching now.",
  "Let me track that down for you.",
  "On it — just a sec.",
  "Finding the right people for that.",
  "Searching a few spots now.",
  "Let me see what I can find.",
];

const FILLERS_FR: string[] = [
  "Laissez-moi chercher ca pour vous.",
  "Un moment, je verifie.",
  "Juste un instant.",
  "Je cherche les meilleures options.",
];

export const FILLER_ESCALATION_10S = "Taking a bit longer than usual — still on it.";
export const FILLER_ESCALATION_20S = "Still working on it. If you'd prefer, I can try a different approach.";

const FILLERS: Record<'en' | 'fr', string[]> = {
  en: FILLERS_EN,
  fr: FILLERS_FR,
};

const _counters: Record<'en' | 'fr', number> = { en: 0, fr: 0 };

/**
 * Returns the next filler phrase for the given language using round-robin rotation.
 * Always returns a non-empty string.
 */
export function getFillerPhrase(language: 'en' | 'fr'): string {
  const pool = FILLERS[language];
  const index = _counters[language] % pool.length;
  _counters[language]++;
  return pool[index];
}

export interface FillerLoopHandle {
  stop: () => void;
}

/**
 * Starts a filler loop that fires a speak callback every 10 seconds.
 * - Immediately speaks an initial filler phrase
 * - At ~10s: speaks FILLER_ESCALATION_10S
 * - At ~20s: speaks FILLER_ESCALATION_20S
 * - At ~30s+: continues with round-robin filler phrases every 10s
 *
 * Returns a handle with stop() to clear the interval.
 */
export function startFillerLoop(
  speakFn: (text: string) => Promise<void>,
  language: 'en' | 'fr' = 'en',
): FillerLoopHandle {
  let tick = 0;
  // Fire immediately with a filler phrase
  speakFn(getFillerPhrase(language));

  const interval = setInterval(() => {
    tick++;
    if (tick === 1) {
      speakFn(FILLER_ESCALATION_10S);
    } else if (tick === 2) {
      speakFn(FILLER_ESCALATION_20S);
    } else {
      speakFn(getFillerPhrase(language));
    }
  }, 10_000);

  return {
    stop: () => clearInterval(interval),
  };
}

/**
 * Stops a filler loop by calling the handle's stop function.
 */
export function stopFillerLoop(handle: FillerLoopHandle): void {
  handle.stop();
}
