/**
 * Provider search — Google Places API integration.
 *
 * Geocodes the caller's location, queries Google Places Text Search (New),
 * applies haversine distance computation, urgency-aware scoring and ranking,
 * and updates CallState.providers when a callControlId is supplied.
 */

import { updateCall } from '../../voice/call-state.js';
import { openRouterClient } from '../../ai/llm-clients.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Provider {
  name: string;
  phone: string;
  rating: number;
  reviewCount: number;
  address: string;
  distanceKm: number;
  distanceLabel: string;        // e.g. "2.3 km"
  isOpenNow: boolean | undefined;
  openingHoursText: string | undefined;  // e.g. "Monday: 8:00 AM – 6:00 PM"
  placeId: string;
  source: 'google_places' | 'web';
}

export interface SearchProvidersParams {
  service_type: string;
  location: string;
  urgency?: string;
  callControlId?: string;
}

export interface SearchProvidersResult {
  providers: Provider[];
  source: string;
  count: number;
  narrationText?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLACES_FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.currentOpeningHours';

const INITIAL_RADIUS_METERS = 5_000;
const EXPANDED_RADIUS_METERS = 25_000;
const MIN_RESULTS_BEFORE_EXPAND = 3;

// ---------------------------------------------------------------------------
// Haversine distance
// ---------------------------------------------------------------------------

/**
 * Computes straight-line distance between two lat/lng coordinates using the
 * haversine formula.
 *
 * @returns Distance in kilometres.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

/**
 * Converts a human-readable location string to lat/lng using the Google
 * Geocoding API.
 *
 * @throws Error if the location cannot be geocoded.
 */
export async function geocodeLocation(
  location: string,
  apiKey: string
): Promise<{ lat: number; lng: number }> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[search] Geocoding API returned ${response.status}: ${await response.text()}`);
  }
  const json = await response.json() as { results?: Array<{ geometry: { location: { lat: number; lng: number } } }> };

  if (!json.results?.length) {
    throw new Error(`[search] Could not geocode location: "${location}"`);
  }

  const { lat, lng } = json.results[0].geometry.location;
  return { lat, lng };
}

// ---------------------------------------------------------------------------
// Google Places API
// ---------------------------------------------------------------------------

interface PlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  currentOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
}

/**
 * Calls the Google Places Text Search (New) API.
 *
 * @returns Array of place results (may be empty).
 */
async function callPlacesApi(
  textQuery: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  urgency: string | undefined,
  apiKey: string,
  languageCode = 'en'
): Promise<PlaceResult[]> {
  const body = {
    textQuery,
    pageSize: 10,
    rankPreference: urgency === 'emergency' ? 'DISTANCE' : 'RELEVANCE',
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusMeters,
      },
    },
    languageCode,
  };

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': PLACES_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`[search] Places API returned ${response.status}: ${errorBody}`);
  }

  const json = await response.json() as { places?: PlaceResult[] };
  const places = json.places ?? [];

  // Filter out results with no phone number — useless for Phase 4 dispatch
  return places.filter((p) => Boolean(p.nationalPhoneNumber));
}

// ---------------------------------------------------------------------------
// Provider mapping
// ---------------------------------------------------------------------------

function mapPlaceToProvider(place: PlaceResult, callerLat: number, callerLng: number): Provider {
  const placeLat = place.location?.latitude ?? callerLat;
  const placeLng = place.location?.longitude ?? callerLng;
  const distanceKm = haversineKm(callerLat, callerLng, placeLat, placeLng);

  return {
    name: place.displayName?.text ?? 'Unknown',
    phone: place.nationalPhoneNumber ?? '',
    rating: place.rating ?? 0,
    reviewCount: place.userRatingCount ?? 0,
    address: place.formattedAddress ?? '',
    distanceKm,
    distanceLabel: `${distanceKm.toFixed(1)} km`,
    isOpenNow: place.currentOpeningHours?.openNow,
    openingHoursText: place.currentOpeningHours?.weekdayDescriptions?.[0],
    placeId: place.id,
    source: 'google_places',
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Scores a provider 0–100 based on rating, proximity, reviews, and open status.
 * Normal weights:    ratingScore*0.40 + proximityScore*0.35 + reviewScore*0.15 + openBonus*0.5
 * Emergency weights: ratingScore*0.20 + proximityScore*0.40 + reviewScore*0.10 + openBonus*1.5
 * where openBonus = 20 if open now, 0 otherwise
 */
export function scoreProvider(provider: Provider, urgency: string | undefined): number {
  const ratingScore = (provider.rating / 5) * 100;
  const proximityScore = Math.max(0, 100 - provider.distanceKm * 5);
  const reviewScore = Math.min(100, Math.log10(provider.reviewCount + 1) * 50);
  const openScore = provider.isOpenNow ? 20 : 0;

  if (urgency === 'emergency') {
    return (
      proximityScore * 0.40 +
      openScore * 1.5 +
      ratingScore * 0.20 +
      reviewScore * 0.10
    );
  }

  // Normal (default)
  return (
    ratingScore * 0.40 +
    proximityScore * 0.35 +
    reviewScore * 0.15 +
    openScore * 0.5
  );
}

// ---------------------------------------------------------------------------
// OpenRouter web search fallback
// ---------------------------------------------------------------------------

interface WebProviderRaw {
  name?: unknown;
  phone?: unknown;
  rating?: unknown;
  address?: unknown;
}

/**
 * Falls back to OpenRouter web search (gpt-4o-mini:online) when Google Places
 * returns fewer than MIN_RESULTS_BEFORE_EXPAND providers.
 *
 * Returned providers are tagged with source='web' and have unknown distance.
 * JSON parse failures return an empty array (logged, never thrown).
 */
export async function webSearchFallback(
  serviceType: string,
  location: string,
): Promise<Provider[]> {
  try {
    const response = await openRouterClient.chat.completions.create({
      model: 'openai/gpt-4o-mini:online',
      // OpenRouter-specific extension — not in OpenAI SDK types
      ...({ plugins: [{ id: 'web', max_results: 5 }] } as Record<string, unknown>),
      messages: [
        {
          role: 'system',
          content:
            'Return a JSON array of service providers. Each entry must have: name (string), phone (string in format +1XXXXXXXXXX), rating (number 1-5), address (string). Return ONLY the JSON array, no other text.',
        },
        {
          role: 'user',
          content: `Find the top ${serviceType} service providers near ${location}. Return their name, phone number, rating, and address as a JSON array.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? '';

    let parsed: WebProviderRaw[];
    try {
      parsed = JSON.parse(content) as WebProviderRaw[];
    } catch {
      console.log('[tools:search] Web fallback JSON parse failed');
      return [];
    }

    if (!Array.isArray(parsed)) {
      console.log('[tools:search] Web fallback JSON parse failed');
      return [];
    }

    const results: Provider[] = parsed
      .filter((r) => r && typeof r.name === 'string' && r.name.trim() !== '' &&
                     typeof r.phone === 'string' && r.phone.trim() !== '')
      .map((r) => ({
        name: (r.name as string).trim(),
        phone: (r.phone as string).trim(),
        rating: typeof r.rating === 'number' ? r.rating : 0,
        reviewCount: 0,
        address: typeof r.address === 'string' ? r.address : '',
        distanceKm: 0,
        distanceLabel: 'unknown',
        isOpenNow: undefined,
        openingHoursText: undefined,
        placeId: '',
        source: 'web' as const,
      }));

    console.log(`[tools:search] Web fallback returned ${results.length} providers`);
    return results;
  } catch (err) {
    console.error('[tools:search] Web fallback error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Searches for local service providers using the Google Places Text Search API.
 *
 * 1. Geocodes the caller's location.
 * 2. Queries Places API within 5 km; expands to 25 km if < 3 results.
 * 3. Maps Google Places results to Provider shape.
 * 4. If still < 3 results after radius expansion, falls back to OpenRouter web search.
 * 5. Scores and sorts all providers by urgency-aware ranking.
 * 6. Optionally updates CallState if callControlId is provided.
 *
 * @throws Error if GOOGLE_MAPS_API_KEY is not set.
 */
export async function searchProviders(
  params: SearchProvidersParams
): Promise<SearchProvidersResult> {
  const { service_type, location, urgency, callControlId } = params;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('[search] GOOGLE_MAPS_API_KEY environment variable is not set');
  }

  console.log(`[tools:search] Searching for "${service_type}" near "${location}" (urgency=${urgency ?? 'normal'})`);

  // Step 1: Geocode caller location
  const { lat, lng } = await geocodeLocation(location, apiKey);
  console.log(`[tools:search] Geocoded "${location}" → ${lat}, ${lng}`);

  // Step 2: Query Places API — expand radius if needed
  let places = await callPlacesApi(service_type, lat, lng, INITIAL_RADIUS_METERS, urgency, apiKey);
  console.log(`[tools:search] Initial search (5 km): ${places.length} results with phone`);

  if (places.length < MIN_RESULTS_BEFORE_EXPAND) {
    console.log(`[tools:search] Expanding radius to 25 km (only ${places.length} results)`);
    places = await callPlacesApi(service_type, lat, lng, EXPANDED_RADIUS_METERS, urgency, apiKey);
    console.log(`[tools:search] Expanded search (25 km): ${places.length} results with phone`);
  }

  // Step 3: Map Google Places results
  let providers: Provider[] = places.map((p) => mapPlaceToProvider(p, lat, lng));

  // Step 4: Web fallback if still < MIN_RESULTS
  if (providers.length < MIN_RESULTS_BEFORE_EXPAND) {
    console.log('[tools:search] Falling back to OpenRouter web search');
    const webResults = await webSearchFallback(service_type, location);
    providers = [...providers, ...webResults];
  }

  // Step 5: Score, sort combined results
  const ranked = providers
    .map((p) => ({ provider: p, score: scoreProvider(p, urgency) }))
    .sort((a, b) => b.score - a.score)
    .map(({ provider }) => provider);

  console.log(`[tools:search] Ranked ${ranked.length} providers`);

  // Step 6: Update CallState if callControlId is provided
  if (callControlId) {
    updateCall(callControlId, {
      providers: ranked,
      currentProviderIndex: 0,
      stage: 'searching',
    });
    console.log(`[tools:search] Updated CallState for ${callControlId} with ${ranked.length} providers`);
  }

  return {
    providers: ranked,
    source: providers.length > 0 && providers.every((p) => p.source === 'web') ? 'web' : 'google_places',
    count: ranked.length,
  };
}
