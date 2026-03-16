# Phase 3: Provider Discovery - Research

**Researched:** 2026-03-15
**Domain:** Google Places API (New), distance computation, ranking algorithms, OpenRouter web search fallback, bilingual narration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Google Places API** as primary source — `GOOGLE_MAPS_API_KEY` via environment variable (already in .env.example)
- **Fetch top 10** results from API for ranking flexibility
- **Show top 3** to caller — narrate only the best matches
- **Web search via OpenRouter** as fallback when Google Places returns fewer than 3 results — no extra API key needed, OpenRouter already configured
- **Custom provider directory deferred** — Google Places + web fallback is enough for v1
- **Normal requests:** Rating first, then proximity — highest-rated providers surface first; among similar ratings (within 0.3 stars), prefer closer ones
- **Urgent/emergency requests:** Proximity first, open now — closest providers currently open get priority; rating becomes secondary
- **Show all providers, note hours** — include closed providers but Murphy mentions "they open at 8am tomorrow." Caller decides whether to wait
- Urgency detection already built in Phase 2 intent extractor (`urgency` field)
- **Summary + top pick pattern:** "I found 6 plumbers near downtown Austin. The top-rated is Acme Plumbing with 4.8 stars — want me to call them?"
- **Match caller language** — narrate in detected language (EN/FR). Provider names stay in English (business names)
- **If caller declines top pick:** Offer next in ranked list
- **No results found:** Broaden search radius + suggest alternatives
- **Core fields per provider:** name, phone, rating, review count, address, distance, opening hours, place_id
- **Ranked list stored in CallState** — Phase 4 reads from in-memory call state

### Claude's Discretion
- Google Places API query construction (search terms, radius, type filters)
- Web search query formatting for fallback
- Exact narration phrasing in French
- Search radius (initial and broadened)
- How to compute distance from caller location
- Rating similarity threshold for proximity tiebreaker

### Deferred Ideas (OUT OF SCOPE)
- Custom provider directory (local DB of preferred/vetted providers) — future feature
- Provider reviews/sentiment analysis — beyond v1 scope
- Map/directions integration — visual features for dashboard phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SRCH-01 | Agent searches Google Places API for providers matching service type and location | Google Places Text Search (New) POST endpoint fully documented; field mask covers all required Provider fields |
| SRCH-02 | Agent performs web search as fallback when Google Places has gaps | OpenRouter `plugins: [{ id: "web" }]` pattern confirmed; existing `OPENROUTER_API_KEY` and OpenAI-compatible SDK already wired |
| SRCH-03 | Agent queries custom provider directory for curated/vetted providers | **Deferred to v2** per CONTEXT.md locked decision; stub returns empty array |
| SRCH-04 | Agent ranks providers by ratings, reviews, proximity, and hours of operation | Weighted scoring formula from dispatch-process skill; haversine for distance from `places.location` lat/lng |
| SRCH-05 | Agent detects urgency keywords and re-ranks for same-day/emergency availability | `urgency` field already in `IntentResult` from Phase 2; re-rank switches weight formula |
| SRCH-06 | Agent narrates search results to user with ranking transparency | Bilingual narration strings pattern follows greeting.ts/filler.ts convention; spoken via `calls.actions.speak` |
</phase_requirements>

---

## Summary

Phase 3 implements the `searchProviders` function in `src/lib/tools/handlers/search.ts`, replacing the existing stub. The function calls the Google Places Text Search (New) API (`POST https://places.googleapis.com/v1/places:searchText`) using a field-masked request to retrieve name, phone, rating, review count, address, location lat/lng, hours, and place_id. It then geocodes the caller's location string to lat/lng (one Geocoding API call per search), computes haversine distance to each result, applies the urgency-aware weighted scoring formula from the dispatch-process skill, and writes the ranked `Provider[]` list into `CallState`. A narration string is built from the ranked results and spoken via `calls.actions.speak`. If Google Places returns fewer than 3 results, an OpenRouter web search fallback runs using the existing OpenAI-compatible client.

The key complexity points are: (1) Google Places (New) requires explicit field masks — phone numbers and hours trigger the Enterprise SKU and must be requested deliberately; (2) the caller's `location` string must be geocoded before a `locationBias` radius search can run; (3) the narration must be bilingual (EN/FR) following the existing constants-file pattern in `src/lib/voice/`.

**Primary recommendation:** Use the Places Text Search (New) POST endpoint with `locationBias` + `rankPreference: "DISTANCE"` for emergency queries, and `rankPreference: "RELEVANCE"` for normal queries. Geocode the caller location string first with the Geocoding API. Compute haversine distance client-side from `places.location`. Store the ranked `Provider[]` array on `CallState` using `updateCall()`. Keep all narration strings as typed constants in a new `src/lib/voice/narration.ts` file following the `greeting.ts` pattern.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node-fetch` / native `fetch` | Node 20 built-in | HTTP calls to Places and Geocoding APIs | No SDK needed — Places (New) is a plain REST API |
| Google Places Text Search (New) | v1 API | Primary provider search | Official, production-grade; returns all required fields |
| Google Geocoding API | v1 API | Convert location string to lat/lng for `locationBias` | Required step before radius-based search |
| OpenAI SDK (already installed) | existing | OpenRouter fallback web search | Already wired in project; reuse same client pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Haversine formula (inline) | — | Compute km/miles from lat/lng pairs | Faster and cheaper than Distance Matrix API; accuracy sufficient for ranking |
| `src/lib/voice/filler.ts` | existing | `startFillerLoop` during API calls | Always — search takes 1-3 seconds, filler prevents dead air |
| `src/lib/voice/call-state.ts` | existing | `updateCall()` to store providers | Write ranked list + update stage to `searching` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Google Places Text Search (New) | Google Places Nearby Search (New) | Nearby Search requires lat/lng + radius; Text Search accepts free-text + `locationBias` — better for city-name locations like "Austin, TX" |
| Haversine (inline) | Google Distance Matrix API | Distance Matrix is accurate for road distance but adds latency + cost; haversine is instant and sufficient for ranking |
| OpenRouter web plugin | SerpAPI / Bing Search API | OpenRouter already configured; no new API key needed |

**Installation:** No new packages required. Google Places API is called via `fetch()`. OpenRouter already uses the OpenAI SDK.

---

## Architecture Patterns

### Recommended Project Structure

The search handler grows in place; narration strings get their own constants file:

```
src/
├── lib/
│   ├── tools/
│   │   └── handlers/
│   │       └── search.ts          # Replace stub — full implementation here
│   └── voice/
│       └── narration.ts           # NEW: bilingual result narration constants/builders
└── types/
    └── provider.ts                # NEW (or update search.ts inline): expanded Provider interface
```

### Pattern 1: Two-Step Location Resolution

**What:** Caller's `location` string (e.g. "downtown Austin" or "78701") must be resolved to lat/lng before a radius-based `locationBias` can be used.

**When to use:** Always — the Places Text Search `locationBias` parameter requires a lat/lng + radius, not a free-text location.

**Implementation approach:**

Step 1 — Geocode location string:
```typescript
// Source: https://developers.google.com/maps/documentation/geocoding/requests-geocoding
const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_MAPS_API_KEY}`;
const geoRes = await fetch(geoUrl);
const geoJson = await geoRes.json();
const { lat, lng } = geoJson.results[0].geometry.location;
```

Step 2 — Places Text Search with `locationBias`:
```typescript
// Source: https://developers.google.com/maps/documentation/places/web-service/text-search
const body = {
  textQuery: `${service_type} near ${location}`,
  pageSize: 10,
  rankPreference: urgency === 'emergency' ? 'DISTANCE' : 'RELEVANCE',
  locationBias: {
    circle: {
      center: { latitude: lat, longitude: lng },
      radius: 5000.0,  // 5km initial; expand to 25km on fallback
    },
  },
};

const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
    'X-Goog-FieldMask': [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.rating',
      'places.userRatingCount',
      'places.nationalPhoneNumber',
      'places.currentOpeningHours',
    ].join(','),
  },
  body: JSON.stringify(body),
});
```

**Critical:** `nationalPhoneNumber` and `currentOpeningHours` trigger the Enterprise SKU per Google's billing. This is expected and required for the Provider data model.

### Pattern 2: Haversine Distance Computation

**What:** Compute straight-line distance in km between caller's geocoded lat/lng and each provider's `places.location`.

**When to use:** After Places API returns results, before ranking.

```typescript
// Source: https://www.movable-type.co.uk/scripts/latlong.html
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

### Pattern 3: Urgency-Aware Ranking Formula

**What:** Score each provider 0-100 using weighted fields; sort descending.

**When to use:** After distance is computed; before slicing top 3.

```typescript
// Derived from dispatch-process/SKILL.md scoring model
function scoreProvider(p: RawProvider, urgency: string): number {
  const ratingScore = (p.rating / 5) * 100;                     // 0-100
  const proximityScore = Math.max(0, 100 - p.distanceKm * 5);   // 100 at 0km, 0 at 20km
  const reviewScore = Math.min(100, Math.log10(p.reviewCount + 1) * 50); // log scale
  const openScore = p.isOpenNow ? 20 : 0;                       // bonus for open now

  if (urgency === 'emergency') {
    // Proximity (40%) + openNow (30%) + rating (20%) + reviews (10%)
    return proximityScore * 0.40 + openScore * 1.5 + ratingScore * 0.20 + reviewScore * 0.10;
  }
  // Normal: rating (40%) + proximity (35%) + reviews (15%) + openNow (10%)
  return ratingScore * 0.40 + proximityScore * 0.35 + reviewScore * 0.15 + openScore * 0.5;
}
```

**Rating similarity tiebreaker (Claude's discretion — 0.3 stars):** Among providers within 0.3 stars of the top-rated result, sort by `distanceKm` ascending before applying score — this gives the "rating first, then proximity" behavior for normal requests.

### Pattern 4: OpenRouter Web Search Fallback

**What:** When Google Places returns fewer than 3 results, issue an OpenRouter web search request.

**When to use:** Places result count < 3 after radius expansion.

```typescript
// Source: https://openrouter.ai/docs/guides/features/plugins/web-search
// Reuses existing OpenRouter client (same pattern as src/lib/ai/ LLM calls)
const webSearchRes = await openrouterClient.chat.completions.create({
  model: 'openai/gpt-4o-mini:online',
  plugins: [{ id: 'web', max_results: 5 }],
  messages: [{
    role: 'user',
    content: `Find me the top ${service_type} service providers near ${location}. Return their name, phone number, rating, and address. Format as JSON array.`,
  }],
});
// Parse LLM response to extract provider list; treat as LOW confidence (no rating guarantee)
```

**Note:** OpenRouter web search returns LLM-synthesized results, not raw listing data. Phone numbers from this source should be flagged as `source: 'web'` in the Provider object so Phase 4 treats them as lower confidence.

### Pattern 5: Bilingual Narration Constants

**What:** Narration strings follow the `greeting.ts` pattern — hardcoded constants and builder functions in a dedicated file. No LLM generation.

**When to use:** After ranking is complete; before returning from `searchProviders`.

```typescript
// src/lib/voice/narration.ts — follow greeting.ts pattern
export function buildResultNarration(
  count: number,
  serviceType: string,
  location: string,
  topProvider: Provider,
  language: 'en' | 'fr',
): string {
  if (language === 'fr') {
    return `J'ai trouve ${count} ${serviceType} pres de ${location}. Le mieux note est ${topProvider.name} avec ${topProvider.rating} etoiles. Dois-je les appeler?`;
  }
  return `I found ${count} ${serviceType} providers near ${location}. The top-rated is ${topProvider.name} with ${topProvider.rating} stars — want me to call them?`;
}

export function buildNextProviderNarration(provider: Provider, language: 'en' | 'fr'): string {
  if (language === 'fr') {
    return `Pas de probleme. L'option suivante est ${provider.name} — ${provider.rating} etoiles, a ${provider.distanceKm.toFixed(1)} km.`;
  }
  return `No problem. Next up is ${provider.name} — ${provider.rating} stars, ${provider.distanceKm.toFixed(1)} km away.`;
}

export function buildNoResultsNarration(language: 'en' | 'fr'): string {
  if (language === 'fr') {
    return `Je n'ai pas trouve de prestataires correspondants. J'ai essaye un rayon plus large. Vous pourriez essayer de chercher ${serviceType} directement sur Google.`;
  }
  return `I couldn't find any matching providers, even with a wider search. You might try searching directly on Google.`;
}
```

### Pattern 6: Expanded Provider Interface and CallState Update

**What:** Expand `Provider` in `search.ts` and add `providers` field to `CallState`.

```typescript
// Expanded Provider interface (replaces stub in search.ts)
export interface Provider {
  name: string;
  phone: string;                    // nationalPhoneNumber from Places API
  rating: number;
  reviewCount: number;              // userRatingCount
  address: string;                  // formattedAddress
  distanceKm: number;               // computed via haversine
  distanceLabel: string;            // "2.3 km" for narration
  isOpenNow: boolean | undefined;   // from currentOpeningHours.openNow
  openingHoursText: string | undefined; // e.g. "Opens at 8am"
  placeId: string;                  // places.id
  source: 'google_places' | 'web'; // for Phase 4 trust level
}

// CallState addition (call-state.ts)
// Add to CallState interface:
providers: Provider[];              // ranked list; empty array until search completes
currentProviderIndex: number;       // which provider Phase 4 is currently dialing
```

### Anti-Patterns to Avoid

- **Wildcard field mask (`*`):** Never use `X-Goog-FieldMask: *` — bills for all SKUs. Request only the 8 fields listed above.
- **Storing Places API results to DB:** Google Maps ToS explicitly prohibits caching/storing Places API results. `CallState` is in-memory only — this is correct.
- **Using location string directly in `textQuery` only:** The query "plumber in Austin TX" without `locationBias` may return nationwide results if Austin is ambiguous. Always geocode and pass `locationBias`.
- **Blocking the webhook handler:** `searchProviders` is async — the `call.transcription` handler must fire it with `startFillerLoop` concurrently, not `await` before responding.
- **LLM-generated narration strings:** Murphy's narration must be hardcoded constants, not LLM output. Predictable phrasing, no hallucinated provider data.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distance computation | Google Distance Matrix integration | Haversine formula (7 lines) | Matrix API adds latency + cost; straight-line is sufficient for provider ranking |
| Provider search | Custom web scraping / provider DB | Google Places Text Search (New) | Comprehensive business data, ratings, hours, phone — updated continuously |
| Geocoding | Manual city→lat/lng lookup table | Google Geocoding API | Handles zip codes, city names, intersections, Canadian postal codes |
| Web fallback parsing | Custom HTML scraper | OpenRouter web plugin | LLM extracts structured data from search results; zero scraping infrastructure |
| Language detection | Phase 3 code | `CallState.language` (Phase 2) | Already detected and stored on the call state |

**Key insight:** The Google Places (New) API already handles the hardest parts — business hours computation, rating aggregation, and multi-language business data. The only custom logic needed is the scoring formula and narration string construction.

---

## Common Pitfalls

### Pitfall 1: Missing Phone Numbers — Wrong SKU / Field Mask

**What goes wrong:** `nationalPhoneNumber` returns undefined for all results despite being in the field mask.
**Why it happens:** The field mask must be prefixed with `places.` for Text Search: `places.nationalPhoneNumber` not `nationalPhoneNumber`.
**How to avoid:** Use the exact field path: `places.nationalPhoneNumber`. Test with a known business (e.g., "McDonald's in Austin TX") and assert phone is non-null.
**Warning signs:** All providers have empty phone in unit test mock vs. real API call discrepancy.

### Pitfall 2: Geocoding Failure Crashes Search

**What goes wrong:** If the caller says a partial location ("downtown" with no city), the Geocoding API returns zero results, and `geoJson.results[0]` throws.
**Why it happens:** No null check on geocoding response before accessing `.geometry.location`.
**How to avoid:** Guard with `if (!geoJson.results?.length) throw new Error('Location not found')`. The webhook handler should catch this and speak a clarification prompt.
**Warning signs:** Uncaught TypeError in production logs for partial locations.

### Pitfall 3: rankPreference DISTANCE Requires locationBias/locationRestriction

**What goes wrong:** `rankPreference: "DISTANCE"` with no `locationBias` causes an API error.
**Why it happens:** Google Places requires a geographic anchor to compute distance ranking.
**How to avoid:** Always set `locationBias` when using `rankPreference: "DISTANCE"`. The geocoding step (Pattern 1) must run first.
**Warning signs:** API returns 400 with "INVALID_ARGUMENT" on emergency queries.

### Pitfall 4: Places API Response Has No `places` Key on Zero Results

**What goes wrong:** `response.places` is `undefined` (not an empty array) when no results match.
**Why it happens:** The API omits the `places` key entirely rather than returning `[]`.
**How to avoid:** Always default: `const places = response.places ?? []`.
**Warning signs:** `places.length` TypeError in logs.

### Pitfall 5: Filler Loop Not Stopped After Search Returns

**What goes wrong:** Filler loop keeps speaking after search completes, overlapping with result narration.
**Why it happens:** `startFillerLoop` returns a handle that must be explicitly `.stop()`-ed.
**How to avoid:** `const fillerHandle = startFillerLoop(speakFn, lang); try { ... } finally { stopFillerLoop(fillerHandle); }` pattern.
**Warning signs:** Caller hears "One moment..." after result narration starts.

### Pitfall 6: OpenRouter Web Search Returns Hallucinated Phone Numbers

**What goes wrong:** OpenRouter fallback returns plausible but incorrect phone numbers for providers.
**Why it happens:** LLM synthesizes results from web context and may hallucinate digits.
**How to avoid:** Tag all web-fallback providers with `source: 'web'`. Phase 4 should verbally warn caller: "I found this through web search, so please verify the number." Do not treat web results as authoritative for phone dialing without caller confirmation.
**Warning signs:** Phase 4 dials a number that connects to the wrong business.

### Pitfall 7: CallState Stage Not Advanced After Search

**What goes wrong:** Webhook handler re-triggers search on the next transcription event because stage is still `'searching'`.
**Why it happens:** `updateCall()` not called after search completes to advance stage.
**How to avoid:** After `searchProviders` resolves and narration is spoken, call `updateCall(callControlId, { stage: 'complete', providers: ranked, currentProviderIndex: 0 })`. Phase 4 checks `stage === 'complete'` before dialing.

---

## Code Examples

### Full Field Mask for Required Provider Data

```typescript
// Source: https://developers.google.com/maps/documentation/places/web-service/text-search
// Enterprise SKU fields (phone + hours) are intentionally included — required for Phase 4
const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',           // lat/lng for haversine
  'places.rating',
  'places.userRatingCount',
  'places.nationalPhoneNumber', // Enterprise SKU — required for outbound calling
  'places.currentOpeningHours', // Enterprise SKU — required for hours display
].join(',');
```

### Geocoding Helper

```typescript
// Source: https://developers.google.com/maps/documentation/geocoding/requests-geocoding
export async function geocodeLocation(
  location: string,
  apiKey: string,
): Promise<{ lat: number; lng: number }> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json() as { results: Array<{ geometry: { location: { lat: number; lng: number } } }> };
  if (!json.results?.length) {
    throw new Error(`[search] Could not geocode location: "${location}"`);
  }
  return json.results[0].geometry.location;
}
```

### Radius Expansion on Sparse Results

```typescript
// Source: dispatch-process/SKILL.md — "start 5km → expand to 25km if < 3 results"
const INITIAL_RADIUS_M = 5_000;
const EXPANDED_RADIUS_M = 25_000;
const MIN_RESULTS = 3;

let results = await callPlacesApi(query, lat, lng, INITIAL_RADIUS_M, urgency);
if (results.length < MIN_RESULTS) {
  console.log(`[tools:search] Expanding radius to ${EXPANDED_RADIUS_M}m — only ${results.length} results`);
  results = await callPlacesApi(query, lat, lng, EXPANDED_RADIUS_M, urgency);
}
if (results.length < MIN_RESULTS) {
  console.log(`[tools:search] Falling back to OpenRouter web search`);
  const webResults = await webSearchFallback(service_type, location);
  results = [...results, ...webResults];
}
```

### CallState Update After Search

```typescript
// Source: src/lib/voice/call-state.ts — updateCall() pattern
import { updateCall } from '../voice/call-state.js';

// After ranking is complete and narration text is built:
updateCall(callControlId, {
  stage: 'complete',        // advances past 'searching' — prevents re-trigger
  providers: rankedProviders,
  currentProviderIndex: 0,
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Places Legacy API (GET with `key` param) | Places API (New) — POST with `X-Goog-Api-Key` header | 2023; legacy deprecated 2024 | New API supports field masking, better billing control |
| Places `nearby` endpoint for local search | `searchText` endpoint with `locationBias` | Places (New) | Text Search handles city-name inputs without pre-geocoding as a fallback |
| `$200/month` Maps credit | Per-SKU free tiers (10k geocoding/month free) | March 2025 | Geocoding API is effectively free at low volume |

**Deprecated/outdated:**
- Legacy Places API `https://maps.googleapis.com/maps/api/place/textsearch/json`: Still functional but being phased out; do not use for new code — the (New) API is the target.
- `radius` as a top-level query param (legacy only): Use `locationBias.circle.radius` in the new API.

---

## Open Questions

1. **SRCH-03 stub behavior**
   - What we know: CONTEXT.md locks custom provider directory as deferred/out-of-scope
   - What's unclear: Should `searchProviders` return a stub empty array for this source, or skip entirely?
   - Recommendation: Skip entirely — no code path for custom directory in v1. The `source` field on `Provider` distinguishes `google_places` vs. `web` which is sufficient.

2. **French narration — hours phrasing**
   - What we know: Hours text from Google Places returns in the `languageCode` specified in the request (default: English)
   - What's unclear: Should `languageCode: 'fr'` be sent when `CallState.language === 'fr'`?
   - Recommendation: Pass `languageCode: 'fr'` in the Places request when language is detected as French. The `currentOpeningHours.weekdayDescriptions` array returns localized strings automatically. Flag as Claude's discretion.

3. **OpenRouter web fallback — structured extraction reliability**
   - What we know: LLM returns free-text synthesized from web results; phone numbers may be hallucinated
   - What's unclear: How reliably can a JSON extraction prompt recover 3+ providers with valid phones?
   - Recommendation: Use `gpt-4o-mini:online` with a strict JSON system prompt. If parse fails or returns < 1 provider, log and return empty. Phase 4 must handle empty provider list gracefully.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured) |
| Config file | `vitest.config.ts` — includes `src/**/*.test.ts` and `tests/**/*.test.ts` |
| Quick run command | `npx vitest run src/lib/tools/handlers/search.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-01 | Places API called with correct field mask, returns Provider[] | unit | `npx vitest run src/lib/tools/handlers/search.test.ts` | Wave 0 |
| SRCH-01 | Geocoding called before Places API | unit | same | Wave 0 |
| SRCH-02 | OpenRouter fallback triggered when Places returns < 3 | unit | same | Wave 0 |
| SRCH-03 | Custom directory returns empty (stub) | unit | same | Wave 0 (trivial) |
| SRCH-04 | Normal ranking: rating-first, proximity tiebreaker at 0.3 stars | unit | same | Wave 0 |
| SRCH-04 | Hours text populated; closed provider included with note | unit | same | Wave 0 |
| SRCH-05 | Emergency ranking: proximity-first, open-now bonus applied | unit | same | Wave 0 |
| SRCH-06 | Narration string built correctly in EN for top 3 | unit | `npx vitest run src/lib/voice/narration.test.ts` | Wave 0 |
| SRCH-06 | Narration string built correctly in FR for top 3 | unit | same | Wave 0 |
| SRCH-06 | CallState updated with ranked providers after search | unit | `npx vitest run src/lib/tools/handlers/search.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/tools/handlers/search.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/tools/handlers/search.test.ts` — covers SRCH-01 through SRCH-05 (replace stub test with real tests; mock `fetch` for Places and Geocoding)
- [ ] `src/lib/voice/narration.test.ts` — covers SRCH-06 EN/FR narration builders
- [ ] No framework gaps — Vitest and co-located test convention already established

*(Wave 0 gap note: `src/lib/tools/handlers/search.ts` already exists as a stub — the test file should also exist as a stub Wave 0 task. There is currently no `search.test.ts` in the handlers directory.)*

---

## Sources

### Primary (HIGH confidence)
- [Google Places Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search) — endpoint, field masks, request body, response structure, ranking options
- [Google Places Data Fields (New)](https://developers.google.com/maps/documentation/places/web-service/data-fields) — `nationalPhoneNumber`, `currentOpeningHours` field names and SKU tiers
- [Google Geocoding API](https://developers.google.com/maps/documentation/geocoding/requests-geocoding) — address-to-lat/lng request structure
- [OpenRouter Web Search Plugin Docs](https://openrouter.ai/docs/guides/features/plugins/web-search) — plugin request format, pricing, response annotation schema
- `src/lib/tools/handlers/search.ts` — existing stub with `Provider` interface and `SearchProvidersParams`
- `src/lib/voice/call-state.ts` — `CallState` interface; confirmed `providers` field is missing and must be added
- `src/lib/ai/intent-extractor.ts` — `IntentResult.urgency` field confirmed as `'normal' | 'emergency'`
- `.claude/skills/dispatch-process/SKILL.md` — SEARCH/RANK stage design, 5km/25km radius pattern, scoring weights
- `vitest.config.ts` — test include paths confirmed

### Secondary (MEDIUM confidence)
- [Movable Type Haversine Formula](https://www.movable-type.co.uk/scripts/latlong.html) — standard haversine implementation pattern (multiple sources agree)
- [Google Places FAQ](https://developers.google.com/maps/documentation/places/web-service/faq) — ToS restrictions on storing results confirmed (corroborates REQUIREMENTS.md Out of Scope entry)
- [Google Maps Platform Pricing March 2025](https://mapsplatform.google.com/pricing/) — 10k free geocoding requests/month; Enterprise SKU required for phone + hours

### Tertiary (LOW confidence)
- OpenRouter web search phone number reliability — inferred from LLM behavior; no official accuracy benchmarks

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Google Places (New) REST API fully documented; field masks and response shape verified against official docs
- Architecture: HIGH — patterns match existing project conventions (constants files, updateCall pattern, filler loop usage)
- Pitfalls: HIGH — most pitfalls verified from official API docs (field mask syntax, zero-results response shape, rankPreference constraints)
- Narration strings: HIGH — pattern follows established `greeting.ts` convention; content follows CONTEXT.md examples verbatim

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (Google Places API is stable; OpenRouter plugin format could change sooner)
