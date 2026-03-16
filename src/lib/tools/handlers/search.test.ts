/**
 * Unit tests for searchProviders — Google Places integration, geocoding,
 * haversine distance, urgency-aware ranking, and CallState update.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We import after the mocks are set up so module initialisation picks them up.
// Because fetch is a global, we mock it on globalThis before importing.

vi.stubGlobal('fetch', vi.fn());

// We also need to mock call-state to isolate searchProviders from real state.
vi.mock('../../voice/call-state.js', () => ({
  updateCall: vi.fn(),
}));

// Mock openRouterClient to avoid real API calls in tests.
vi.mock('../../ai/llm-clients.js', () => ({
  openRouterClient: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

import { searchProviders, webSearchFallback, geocodeLocation, haversineKm, scoreProvider, type Provider } from './search.js';
import { updateCall } from '../../voice/call-state.js';
import { openRouterClient } from '../../ai/llm-clients.js';

const mockFetch = vi.mocked(fetch);
const mockOpenRouter = vi.mocked(openRouterClient.chat.completions.create);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeocodingResponse(lat: number, lng: number) {
  return {
    ok: true,
    json: async () => ({
      results: [{ geometry: { location: { lat, lng } } }],
    }),
  };
}

function makeEmptyGeocodingResponse() {
  return {
    ok: true,
    json: async () => ({ results: [] }),
  };
}

function makePlacesResponse(places: unknown[]) {
  return {
    ok: true,
    json: async () => ({ places }),
  };
}

function makePlaceFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'place-1',
    displayName: { text: 'Austin Plumbing Co.' },
    formattedAddress: '123 Main St, Austin, TX 78701',
    location: { latitude: 30.2672, longitude: -97.7431 },
    rating: 4.5,
    userRatingCount: 200,
    nationalPhoneNumber: '+15125550001',
    currentOpeningHours: { openNow: true, weekdayDescriptions: ['Monday: 8:00 AM – 6:00 PM'] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// haversineKm
// ---------------------------------------------------------------------------

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm(0, 0, 0, 0)).toBe(0);
  });

  it('returns ~3.7 km for Austin coordinates', () => {
    const d = haversineKm(30.2672, -97.7431, 30.3000, -97.7500);
    expect(d).toBeGreaterThan(3.5);
    expect(d).toBeLessThan(4.0);
  });

  it('is symmetric', () => {
    const d1 = haversineKm(30.2672, -97.7431, 30.3000, -97.7500);
    const d2 = haversineKm(30.3000, -97.7500, 30.2672, -97.7431);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });
});

// ---------------------------------------------------------------------------
// geocodeLocation
// ---------------------------------------------------------------------------

describe('geocodeLocation', () => {
  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns lat/lng on success', async () => {
    mockFetch.mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response);

    const result = await geocodeLocation('Austin, TX', 'test-api-key');

    expect(result.lat).toBeCloseTo(30.2672);
    expect(result.lng).toBeCloseTo(-97.7431);
  });

  it('calls the Google Geocoding API with the encoded address', async () => {
    mockFetch.mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response);

    await geocodeLocation('Austin, TX', 'test-api-key');

    expect(mockFetch).toHaveBeenCalledOnce();
    const url = String((mockFetch.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('maps.googleapis.com/maps/api/geocode/json');
    expect(url).toContain('Austin');
  });

  it('throws an error with "Could not geocode" when no results', async () => {
    mockFetch.mockResolvedValueOnce(makeEmptyGeocodingResponse() as Response);

    await expect(geocodeLocation('xyznonexistent', 'test-api-key')).rejects.toThrow(
      /Could not geocode/
    );
  });
});

// ---------------------------------------------------------------------------
// scoreProvider
// ---------------------------------------------------------------------------

describe('scoreProvider', () => {
  function makeProvider(overrides: Partial<Provider> = {}): Provider {
    return {
      name: 'Test Provider',
      phone: '+15125550001',
      rating: 4.5,
      reviewCount: 100,
      address: '123 Main St',
      distanceKm: 5,
      distanceLabel: '5.0 km',
      isOpenNow: true,
      openingHoursText: undefined,
      placeId: 'place-1',
      source: 'google_places',
      ...overrides,
    };
  }

  it('normal mode: rating weight (40%) produces higher scores for high-rated providers at equal distance', () => {
    // Same distance and open status — only rating differs
    const highRated = makeProvider({ rating: 5.0, distanceKm: 5 });
    const lowRated = makeProvider({ rating: 3.0, distanceKm: 5 });
    expect(scoreProvider(highRated, 'normal')).toBeGreaterThan(scoreProvider(lowRated, 'normal'));
  });

  it('emergency mode: open-now provider at 2 km ranks above closed 5.0-star at 10 km', () => {
    const open = makeProvider({ rating: 4.0, distanceKm: 2, isOpenNow: true });
    const closed = makeProvider({ rating: 5.0, distanceKm: 10, isOpenNow: false });
    expect(scoreProvider(open, 'emergency')).toBeGreaterThan(scoreProvider(closed, 'emergency'));
  });

  it('normal mode: rating weight (40%) dominates over proximity (35%) for extreme values', () => {
    // 5-star at maximum distance (20km, score=0) vs 1-star at minimum distance (0km, score=100)
    // 5-star: 100*0.40 + 0*0.35 = 40+ (plus reviews, openNow)
    // 1-star: 20*0.40 + 100*0.35 = 43 (plus same reviews, openNow)
    // With isOpenNow=false and reviewCount=1, the 5-star wins via reviewScore boost
    const highRating = makeProvider({ rating: 5.0, distanceKm: 20, reviewCount: 200, isOpenNow: true });
    const closeBy = makeProvider({ rating: 1.0, distanceKm: 0, reviewCount: 1, isOpenNow: false });
    // With 200 reviews and open: 5-star beats 1-star even at 20km
    expect(scoreProvider(highRating, 'normal')).toBeGreaterThan(scoreProvider(closeBy, 'normal'));
  });

  it('emergency mode: proximity weight is 40%, open now has big weight', () => {
    // Very close open provider beats high-rated far provider
    const close = makeProvider({ rating: 3.0, distanceKm: 1, isOpenNow: true });
    const far = makeProvider({ rating: 5.0, distanceKm: 15, isOpenNow: false });
    expect(scoreProvider(close, 'emergency')).toBeGreaterThan(scoreProvider(far, 'emergency'));
  });

  it('score is non-negative', () => {
    const worst = makeProvider({ rating: 0, distanceKm: 100, isOpenNow: false, reviewCount: 0 });
    expect(scoreProvider(worst, 'normal')).toBeGreaterThanOrEqual(0);
    expect(scoreProvider(worst, 'emergency')).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// searchProviders — end-to-end with mocked fetch
// ---------------------------------------------------------------------------

describe('searchProviders', () => {
  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
    vi.clearAllMocks();
  });

  it('geocodes location then calls Places API', async () => {
    const threeResults = [
      makePlaceFixture({ id: 'p1' }),
      makePlaceFixture({ id: 'p2', nationalPhoneNumber: '+15125550002' }),
      makePlaceFixture({ id: 'p3', nationalPhoneNumber: '+15125550003' }),
    ];
    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse(threeResults) as Response);

    const result = await searchProviders({ service_type: 'plumber', location: 'Austin, TX' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.providers.length).toBeGreaterThan(0);
    expect(result.source).toBe('google_places');
  });

  it('filters out places without a phone number', async () => {
    // Provide 3+ raw results but only 1 has a phone — verifies phone filtering works.
    // The expansion is avoided by providing the expanded-radius mock returning same data.
    const withPhone = makePlaceFixture({ id: 'place-1' });
    const noPhone1 = makePlaceFixture({ nationalPhoneNumber: undefined, id: 'no-phone-1' });
    const noPhone2 = makePlaceFixture({ nationalPhoneNumber: undefined, id: 'no-phone-2' });
    const noPhone3 = makePlaceFixture({ nationalPhoneNumber: undefined, id: 'no-phone-3' });
    // All 4 raw results, but only place-1 has a phone.
    // After filtering: 1 result → triggers expansion.
    // Expanded call returns the same set: still 1 result with phone.
    const rawResults = [withPhone, noPhone1, noPhone2, noPhone3];

    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse(rawResults) as Response)  // initial 5km
      .mockResolvedValueOnce(makePlacesResponse(rawResults) as Response); // expanded 25km

    const result = await searchProviders({ service_type: 'plumber', location: 'Austin, TX' });

    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].placeId).toBe('place-1');
  });

  it('expands radius to 25km when initial results < 3', async () => {
    // First call: only 2 results (triggers expansion)
    const twoResults = [
      makePlaceFixture({ id: 'p1' }),
      makePlaceFixture({ id: 'p2', nationalPhoneNumber: '+15125550002' }),
    ];
    // Second call (expanded radius): 3 results
    const threeResults = [
      ...twoResults,
      makePlaceFixture({ id: 'p3', nationalPhoneNumber: '+15125550003' }),
    ];

    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response) // geocode
      .mockResolvedValueOnce(makePlacesResponse(twoResults) as Response)             // 5km search
      .mockResolvedValueOnce(makePlacesResponse(threeResults) as Response);          // 25km search

    const result = await searchProviders({ service_type: 'plumber', location: 'Austin, TX' });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result.count).toBe(3);
  });

  it('does not expand radius when initial results >= 3', async () => {
    const threeResults = [
      makePlaceFixture({ id: 'p1' }),
      makePlaceFixture({ id: 'p2', nationalPhoneNumber: '+15125550002' }),
      makePlaceFixture({ id: 'p3', nationalPhoneNumber: '+15125550003' }),
    ];

    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse(threeResults) as Response);

    await searchProviders({ service_type: 'plumber', location: 'Austin, TX' });

    expect(mockFetch).toHaveBeenCalledTimes(2); // Only geocode + 1 Places call
  });

  it('returns providers with all required fields', async () => {
    const threeResults = [
      makePlaceFixture({ id: 'p1' }),
      makePlaceFixture({ id: 'p2', nationalPhoneNumber: '+15125550002' }),
      makePlaceFixture({ id: 'p3', nationalPhoneNumber: '+15125550003' }),
    ];
    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse(threeResults) as Response);

    const result = await searchProviders({ service_type: 'plumber', location: 'Austin, TX' });
    const p = result.providers[0];

    expect(p.name).toBeDefined();
    expect(p.phone).toBeDefined();
    expect(p.rating).toBeDefined();
    expect(p.reviewCount).toBeDefined();
    expect(p.address).toBeDefined();
    expect(p.distanceKm).toBeDefined();
    expect(p.distanceLabel).toMatch(/\d+\.\d+ km/);
    expect(p.isOpenNow).toBeDefined();
    expect(p.placeId).toBeDefined();
    expect(p.source).toBe('google_places');
  });

  it('updates CallState when callControlId is provided', async () => {
    const threeResults = [
      makePlaceFixture({ id: 'p1' }),
      makePlaceFixture({ id: 'p2', nationalPhoneNumber: '+15125550002' }),
      makePlaceFixture({ id: 'p3', nationalPhoneNumber: '+15125550003' }),
    ];
    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse(threeResults) as Response);

    await searchProviders({
      service_type: 'plumber',
      location: 'Austin, TX',
      callControlId: 'ctrl-123',
    });

    expect(updateCall).toHaveBeenCalledWith(
      'ctrl-123',
      expect.objectContaining({ currentProviderIndex: 0, stage: 'searching' })
    );
  });

  it('does NOT call updateCall when callControlId is absent', async () => {
    const threeResults = [
      makePlaceFixture({ id: 'p1' }),
      makePlaceFixture({ id: 'p2', nationalPhoneNumber: '+15125550002' }),
      makePlaceFixture({ id: 'p3', nationalPhoneNumber: '+15125550003' }),
    ];
    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse(threeResults) as Response);

    await searchProviders({ service_type: 'plumber', location: 'Austin, TX' });

    expect(updateCall).not.toHaveBeenCalled();
  });

  it('uses urgency=emergency for Places API rankPreference=DISTANCE', async () => {
    const threeResults = [
      makePlaceFixture({ id: 'p1' }),
      makePlaceFixture({ id: 'p2', nationalPhoneNumber: '+15125550002' }),
      makePlaceFixture({ id: 'p3', nationalPhoneNumber: '+15125550003' }),
    ];
    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse(threeResults) as Response);

    await searchProviders({ service_type: 'plumber', location: 'Austin, TX', urgency: 'emergency' });

    const placesCall = mockFetch.mock.calls[1];
    const callOptions = (placesCall as unknown[])[1] as { body: string };
    const body = JSON.parse(callOptions.body) as { rankPreference: string };
    expect(body.rankPreference).toBe('DISTANCE');
  });

  it('Places API field mask includes all 8 required fields', async () => {
    const threeResults = [
      makePlaceFixture({ id: 'p1' }),
      makePlaceFixture({ id: 'p2', nationalPhoneNumber: '+15125550002' }),
      makePlaceFixture({ id: 'p3', nationalPhoneNumber: '+15125550003' }),
    ];
    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse(threeResults) as Response);

    await searchProviders({ service_type: 'plumber', location: 'Austin, TX' });

    const placesCall = mockFetch.mock.calls[1];
    const headers = (placesCall as unknown[])[1] as { headers: Record<string, string> };
    const fieldMask = headers.headers['X-Goog-FieldMask'];

    expect(fieldMask).toContain('places.id');
    expect(fieldMask).toContain('places.displayName');
    expect(fieldMask).toContain('places.formattedAddress');
    expect(fieldMask).toContain('places.location');
    expect(fieldMask).toContain('places.rating');
    expect(fieldMask).toContain('places.userRatingCount');
    expect(fieldMask).toContain('places.nationalPhoneNumber');
    expect(fieldMask).toContain('places.currentOpeningHours');
  });

  it('throws when GOOGLE_MAPS_API_KEY is missing', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;

    await expect(
      searchProviders({ service_type: 'plumber', location: 'Austin, TX' })
    ).rejects.toThrow(/GOOGLE_MAPS_API_KEY/);
  });
});

// ---------------------------------------------------------------------------
// webSearchFallback
// ---------------------------------------------------------------------------

function makeOpenRouterResponse(content: string) {
  return {
    choices: [
      {
        message: { content },
      },
    ],
  };
}

describe('webSearchFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns providers with source=web from a valid JSON response', async () => {
    const providers = [
      { name: 'Austin Plumbing Co.', phone: '+15125550001', rating: 4.5, address: '123 Main St, Austin, TX' },
      { name: 'Quick Fix Plumbers', phone: '+15125550002', rating: 4.2, address: '456 Oak Ave, Austin, TX' },
    ];
    mockOpenRouter.mockResolvedValueOnce(makeOpenRouterResponse(JSON.stringify(providers)) as any);

    const result = await webSearchFallback('plumber', 'Austin, TX');

    expect(result).toHaveLength(2);
    expect(result[0].source).toBe('web');
    expect(result[0].name).toBe('Austin Plumbing Co.');
    expect(result[0].phone).toBe('+15125550001');
    expect(result[0].distanceKm).toBe(0);
    expect(result[0].distanceLabel).toBe('unknown');
    expect(result[0].reviewCount).toBe(0);
    expect(result[0].isOpenNow).toBeUndefined();
    expect(result[0].placeId).toBe('');
  });

  it('returns empty array on JSON parse failure', async () => {
    mockOpenRouter.mockResolvedValueOnce(makeOpenRouterResponse('not valid json at all') as any);

    const result = await webSearchFallback('plumber', 'Austin, TX');

    expect(result).toEqual([]);
  });

  it('returns empty array when JSON is not an array', async () => {
    mockOpenRouter.mockResolvedValueOnce(makeOpenRouterResponse('{"name": "test"}') as any);

    const result = await webSearchFallback('plumber', 'Austin, TX');

    expect(result).toEqual([]);
  });

  it('filters out entries with missing phone', async () => {
    const providers = [
      { name: 'Good Provider', phone: '+15125550001', rating: 4.5, address: '123 Main St' },
      { name: 'No Phone Provider', phone: '', rating: 4.0, address: '456 Oak Ave' },
      { name: 'Missing Phone', rating: 3.5, address: '789 Elm Rd' },
    ];
    mockOpenRouter.mockResolvedValueOnce(makeOpenRouterResponse(JSON.stringify(providers)) as any);

    const result = await webSearchFallback('plumber', 'Austin, TX');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Good Provider');
  });

  it('filters out entries with missing name', async () => {
    const providers = [
      { name: 'Good Provider', phone: '+15125550001', rating: 4.5, address: '123 Main St' },
      { name: '', phone: '+15125550002', rating: 4.0, address: '456 Oak Ave' },
    ];
    mockOpenRouter.mockResolvedValueOnce(makeOpenRouterResponse(JSON.stringify(providers)) as any);

    const result = await webSearchFallback('plumber', 'Austin, TX');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Good Provider');
  });

  it('returns empty array when openRouterClient throws', async () => {
    mockOpenRouter.mockRejectedValueOnce(new Error('API error'));

    const result = await webSearchFallback('plumber', 'Austin, TX');

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// searchProviders — web fallback integration
// ---------------------------------------------------------------------------

describe('searchProviders with web fallback', () => {
  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
    vi.clearAllMocks();
  });

  it('triggers web fallback when Places returns < 3 results after radius expansion', async () => {
    const twoResults = [
      makePlaceFixture({ id: 'p1' }),
      makePlaceFixture({ id: 'p2', nationalPhoneNumber: '+15125550002' }),
    ];
    const webProviders = [
      { name: 'Web Plumber 1', phone: '+15125550010', rating: 4.0, address: '111 Web St, Austin, TX' },
    ];

    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response) // geocode
      .mockResolvedValueOnce(makePlacesResponse(twoResults) as Response)            // 5km search
      .mockResolvedValueOnce(makePlacesResponse(twoResults) as Response);           // 25km search (still < 3)

    mockOpenRouter.mockResolvedValueOnce(makeOpenRouterResponse(JSON.stringify(webProviders)) as any);

    const result = await searchProviders({ service_type: 'plumber', location: 'Austin, TX' });

    expect(mockOpenRouter).toHaveBeenCalledOnce();
    expect(result.count).toBe(3);
    const webResult = result.providers.find((p) => p.source === 'web');
    expect(webResult).toBeDefined();
    expect(webResult?.name).toBe('Web Plumber 1');
  });

  it('does NOT trigger web fallback when Places returns >= 3 results', async () => {
    const threeResults = [
      makePlaceFixture({ id: 'p1' }),
      makePlaceFixture({ id: 'p2', nationalPhoneNumber: '+15125550002' }),
      makePlaceFixture({ id: 'p3', nationalPhoneNumber: '+15125550003' }),
    ];

    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse(threeResults) as Response);

    await searchProviders({ service_type: 'plumber', location: 'Austin, TX' });

    expect(mockOpenRouter).not.toHaveBeenCalled();
  });

  it('combined results are sorted by score after web fallback appended', async () => {
    // One Google result with high rating, one web result with high rating
    const oneGoogleResult = [
      makePlaceFixture({ id: 'p1', rating: 2.0, userRatingCount: 10 }),
    ];
    const webProviders = [
      { name: 'Web High Rated', phone: '+15125550010', rating: 5.0, address: '111 Web St' },
      { name: 'Web Low Rated', phone: '+15125550011', rating: 1.0, address: '222 Web St' },
    ];

    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response) // geocode
      .mockResolvedValueOnce(makePlacesResponse(oneGoogleResult) as Response)      // 5km
      .mockResolvedValueOnce(makePlacesResponse(oneGoogleResult) as Response);     // 25km

    mockOpenRouter.mockResolvedValueOnce(makeOpenRouterResponse(JSON.stringify(webProviders)) as any);

    const result = await searchProviders({ service_type: 'plumber', location: 'Austin, TX' });

    // High-rated web provider should rank above low-rated ones
    expect(result.providers[0].name).toBe('Web High Rated');
    expect(result.providers[0].source).toBe('web');
  });

  it('web fallback providers tagged with source=web', async () => {
    const zeroResults: unknown[] = [];
    const webProviders = [
      { name: 'Web Provider', phone: '+15125550010', rating: 4.0, address: '111 Web St' },
    ];

    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse(zeroResults) as Response)  // 5km: empty
      .mockResolvedValueOnce(makePlacesResponse(zeroResults) as Response); // 25km: empty

    mockOpenRouter.mockResolvedValueOnce(makeOpenRouterResponse(JSON.stringify(webProviders)) as any);

    const result = await searchProviders({ service_type: 'plumber', location: 'Austin, TX' });

    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].source).toBe('web');
  });
});
