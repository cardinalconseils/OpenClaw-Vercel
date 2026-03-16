/**
 * Intent extractor for Murphy's voice concierge.
 *
 * Parses service type, location, and urgency from natural speech transcripts
 * in both English and French. Used to convert free-form caller speech into
 * structured dispatch parameters.
 */

export interface IntentResult {
  serviceType: string | undefined;
  location: string | undefined;
  urgency: 'normal' | 'emergency';
  isComplete: boolean;
}

/**
 * English service type keywords — maps spoken words to canonical service names.
 * Also used as match patterns; the first match wins.
 */
const EN_SERVICE_PATTERNS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\bplumber\b/i, canonical: 'plumber' },
  { pattern: /\belectrician\b/i, canonical: 'electrician' },
  { pattern: /\blocksmith\b/i, canonical: 'locksmith' },
  { pattern: /\bcleaner\b/i, canonical: 'cleaner' },
  { pattern: /\bcleaning\b/i, canonical: 'cleaning' },
  { pattern: /\bhvac\b/i, canonical: 'HVAC' },
  { pattern: /\broofer\b/i, canonical: 'roofer' },
  { pattern: /\bpainter\b/i, canonical: 'painter' },
  { pattern: /\bcarpenter\b/i, canonical: 'carpenter' },
  { pattern: /\bhandyman\b/i, canonical: 'handyman' },
  { pattern: /\bpest control\b/i, canonical: 'pest control' },
  { pattern: /\blawn\b/i, canonical: 'lawn care' },
  { pattern: /\bmovers?\b/i, canonical: 'movers' },
];

/**
 * French service type keywords.
 */
const FR_SERVICE_PATTERNS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\bplombier\b/i, canonical: 'plombier' },
  { pattern: /\b(?:electricien|électricien)\b/i, canonical: 'electricien' },
  { pattern: /\bserrurier\b/i, canonical: 'serrurier' },
  { pattern: /\bnettoyeur\b/i, canonical: 'nettoyeur' },
  { pattern: /\bnettoyage\b/i, canonical: 'nettoyage' },
  { pattern: /\bcouvreur\b/i, canonical: 'couvreur' },
  { pattern: /\bpeintre\b/i, canonical: 'peintre' },
  { pattern: /\bcarpentier\b/i, canonical: 'carpentier' },
];

/**
 * Urgency keywords that flag a request as emergency priority.
 * Case-insensitive match against the full transcript.
 */
const URGENCY_PATTERNS = /\b(emergency|urgent|urgency|urgence|asap|right now|imm[eé]diatement|tout de suite|right away|immediately)\b/i;

/**
 * Location extraction patterns.
 *
 * Covers:
 * - "in <location>" / "near <location>"
 * - "a <location>" (French preposition)
 * - 5-digit US zip codes
 * - Canadian postal codes (A1A 1A1)
 */
const LOCATION_PATTERNS: Array<RegExp> = [
  /\bnear\s+(.+?)(?:\s*$|,)/i,
  /\bin\s+(.+?)(?:\s*$|,)/i,
  /\b[aà]\s+([A-Za-z][A-Za-z\s]{1,25})(?:\s*$|,)/i,
];

const ZIP_CODE_PATTERN = /\b(\d{5})\b/;
const POSTAL_CODE_PATTERN = /\b([A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d)\b/;

/**
 * Extracts a service type from the transcript.
 * Checks English patterns first, then French.
 */
function extractServiceType(transcript: string): string | undefined {
  for (const { pattern, canonical } of EN_SERVICE_PATTERNS) {
    if (pattern.test(transcript)) return canonical;
  }
  for (const { pattern, canonical } of FR_SERVICE_PATTERNS) {
    if (pattern.test(transcript)) return canonical;
  }
  return undefined;
}

/**
 * Extracts a location from the transcript.
 * Tries preposition-based patterns, then zip/postal codes.
 */
function extractLocation(transcript: string): string | undefined {
  // Try zip code first (most precise)
  const zipMatch = ZIP_CODE_PATTERN.exec(transcript);
  if (zipMatch) return zipMatch[1];

  // Try Canadian postal code
  const postalMatch = POSTAL_CODE_PATTERN.exec(transcript);
  if (postalMatch) return postalMatch[1];

  // Try preposition-based extraction
  for (const pattern of LOCATION_PATTERNS) {
    const match = pattern.exec(transcript);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Extracts structured intent from a caller's natural speech transcript.
 *
 * @param transcript - Raw STT transcript from the caller.
 * @returns Structured IntentResult with serviceType, location, urgency, isComplete.
 */
export function extractIntent(transcript: string): IntentResult {
  const serviceType = extractServiceType(transcript);
  const location = extractLocation(transcript);
  const urgency: 'normal' | 'emergency' = URGENCY_PATTERNS.test(transcript) ? 'emergency' : 'normal';
  const complete = serviceType !== undefined && location !== undefined;

  return {
    serviceType,
    location,
    urgency,
    isComplete: complete,
  };
}

/**
 * Checks whether a partial intent object has both serviceType and location.
 *
 * @param intent - Partial intent with optional serviceType and location.
 * @returns true if both fields are present and non-empty.
 */
export function isIntentComplete(
  intent: Partial<{ serviceType: string; location: string }>,
): boolean {
  return (
    typeof intent.serviceType === 'string' &&
    intent.serviceType.length > 0 &&
    typeof intent.location === 'string' &&
    intent.location.length > 0
  );
}

/**
 * Returns a disambiguation prompt for when the caller's service need is unclear.
 *
 * @param language - 'en' for English, 'fr' for French.
 * @returns A short spoken-language prompt asking the caller to clarify.
 */
export function getDisambiguationPrompt(language: 'en' | 'fr'): string {
  if (language === 'fr') {
    return "De quel type d'aide avez-vous besoin — plomberie, electricite, nettoyage, ou autre chose?";
  }
  return 'What kind of help do you need — plumbing, electrical, cleaning, or something else?';
}
