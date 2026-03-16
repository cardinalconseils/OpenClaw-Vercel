/**
 * Bilingual filler phrase selection.
 *
 * Emitted before tool calls (search_providers, call_provider, etc.) to prevent
 * dead air while the LLM and tool execute. Uses round-robin rotation so callers
 * hear different phrases on repeated tool calls within the same session.
 */

const FILLERS: Record<'en' | 'fr', string[]> = {
  en: [
    "Let me look that up for you.",
    "One moment while I search.",
    "Give me just a second.",
    "Searching for the best options now.",
  ],
  fr: [
    "Laissez-moi chercher ca pour vous.",
    "Un moment, je verifie.",
    "Juste un instant.",
    "Je cherche les meilleures options.",
  ],
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
