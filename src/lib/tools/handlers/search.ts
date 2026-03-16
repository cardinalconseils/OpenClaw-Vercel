/**
 * Provider search — Google Places API integration.
 *
 * Geocodes the caller's location, queries Google Places Text Search (New),
 * applies haversine distance computation, urgency-aware scoring and ranking,
 * and updates CallState.providers when a callControlId is supplied.
 */

import { updateCall } from '../../voice/call-state.js';

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
 * Scores a provider using urgency-aware weighted criteria.
 *
 * Normal weights:   rating 40%, proximity 35%, reviews 15%, openNow 10% (scaled 0.5)
 * Emergency weights: proximity 40%, openNow 30% (scaled 1.5), rating 20%, reviews 10%
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
// Main export
// ---------------------------------------------------------------------------

/**
 * Searches for local service providers using the Google Places Text Search API.
 *
 * 1. Geocodes the caller's location.
 * 2. Queries Places API within 5 km; expands to 25 km if < 3 results.
 * 3. Maps, scores, and sorts providers by urgency-aware ranking.
 * 4. Optionally updates CallState if callControlId is provided.
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

  // Step 3: Map, score, and sort
  const providers: Provider[] = places.map((p) => mapPlaceToProvider(p, lat, lng));
  const ranked = providers
    .map((p) => ({ provider: p, score: scoreProvider(p, urgency) }))
    .sort((a, b) => b.score - a.score)
    .map(({ provider }) => provider);

  console.log(`[tools:search] Ranked ${ranked.length} providers`);

  // Step 4: Update CallState if callControlId is provided
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
    source: 'google_places',
    count: ranked.length,
  };
}
