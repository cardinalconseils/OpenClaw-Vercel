/**
 * Bilingual narration builder functions for search result delivery.
 *
 * Hardcoded deterministic templates — NEVER LLM-generated.
 * Follows the greeting.ts/filler.ts pattern of typed constants and builder functions.
 *
 * Called by the webhook handler after search_providers returns results,
 * to produce spoken-language strings for Murphy to say to the caller.
 */

/**
 * Minimal provider shape needed for narration.
 * Avoids importing from search.ts which may not exist during parallel plan execution.
 */
export interface NarrationProvider {
  name: string;
  rating: number;
  distanceKm: number;
}

/**
 * Narrates the search result summary and offers to call the top-rated provider.
 *
 * EN: "I found 6 plumber providers near downtown Austin. The top-rated is Acme Plumbing
 *     with 4.8 stars — want me to call them?"
 * FR: "J'ai trouve 6 plombier pres de Montreal. Le mieux note est PlombPro avec
 *     4.5 etoiles. Dois-je les appeler?"
 *
 * Per CONTEXT.md locked decision: "Summary + top pick pattern"
 */
export function buildResultNarration(
  count: number,
  serviceType: string,
  location: string,
  topProvider: NarrationProvider,
  language: 'en' | 'fr',
): string {
  if (language === 'fr') {
    return (
      `J'ai trouve ${count} ${serviceType} pres de ${location}. ` +
      `Le mieux note est ${topProvider.name} avec ${topProvider.rating} etoiles. ` +
      `Dois-je les appeler?`
    );
  }

  return (
    `I found ${count} ${serviceType} providers near ${location}. ` +
    `The top-rated is ${topProvider.name} with ${topProvider.rating} stars — ` +
    `want me to call them?`
  );
}

/**
 * Narrates the next provider option when the caller declines the top pick.
 *
 * EN: "No problem. Next up is Bob's Plumbing — 4.6 stars, 1.5 km away."
 * FR: "Pas de probleme. L'option suivante est PlombMax — 4.2 etoiles, a 3.0 km."
 *
 * Per CONTEXT.md: "If caller declines top pick: Offer next in ranked list"
 */
export function buildNextProviderNarration(
  provider: NarrationProvider,
  language: 'en' | 'fr',
): string {
  const distanceFormatted = provider.distanceKm.toFixed(1);

  if (language === 'fr') {
    return (
      `Pas de probleme. L'option suivante est ${provider.name} — ` +
      `${provider.rating} etoiles, a ${distanceFormatted} km.`
    );
  }

  return (
    `No problem. Next up is ${provider.name} — ` +
    `${provider.rating} stars, ${distanceFormatted} km away.`
  );
}

/**
 * Narrates a no-results message and suggests the caller try Google.
 *
 * EN: "I couldn't find any matching plumber providers near Austin, even with a wider
 *     search. I'd suggest trying plumber Austin on Google. Sorry I couldn't help more!"
 * FR: "Je n'ai pas trouve de plombier pres de Montreal, meme avec un rayon plus large.
 *     Vous pourriez essayer de chercher plombier Montreal sur Google.
 *     Desole de ne pas pouvoir aider davantage!"
 *
 * Per CONTEXT.md: "No results found: suggest alternatives"
 */
export function buildNoResultsNarration(
  serviceType: string,
  location: string,
  language: 'en' | 'fr',
): string {
  if (language === 'fr') {
    return (
      `Je n'ai pas trouve de ${serviceType} pres de ${location}, meme avec un rayon plus large. ` +
      `Vous pourriez essayer de chercher ${serviceType} ${location} sur Google. ` +
      `Desole de ne pas pouvoir aider davantage!`
    );
  }

  return (
    `I couldn't find any matching ${serviceType} providers near ${location}, even with a wider search. ` +
    `I'd suggest trying ${serviceType} ${location} on Google. ` +
    `Sorry I couldn't help more!`
  );
}

/**
 * Context-specific searching filler — fires alongside the generic filler loop
 * as the initial context-aware phrase before search results arrive.
 *
 * EN: "Searching for plumber providers near Austin now."
 * FR: "Je cherche des plombier pres de Montreal maintenant."
 */
export function buildSearchingFiller(
  serviceType: string,
  location: string,
  language: 'en' | 'fr',
): string {
  if (language === 'fr') {
    return `Je cherche des ${serviceType} pres de ${location} maintenant.`;
  }

  return `Searching for ${serviceType} providers near ${location} now.`;
}
