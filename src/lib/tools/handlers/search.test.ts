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

import { searchProviders, geocodeLocation, haversineKm, scoreProvider, type Provider } from './search.js';
import { updateCall } from '../../voice/call-state.js';

const mockFetch = vi.mocked(fetch);

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

  it('normal mode: a 4.9-star provider at 15 km ranks above a 4.8-star at 10 km when ratings differ', () => {
    const a = makeProvider({ rating: 4.9, distanceKm: 15 });
    const b = makeProvider({ rating: 4.8, distanceKm: 10 });
    // 4.9-star provider has a notable rating advantage
    expect(scoreProvider(a, 'normal')).toBeGreaterThan(scoreProvider(b, 'normal'));
  });

  it('emergency mode: open-now provider at 2 km ranks above closed 5.0-star at 10 km', () => {
    const open = makeProvider({ rating: 4.0, distanceKm: 2, isOpenNow: true });
    const closed = makeProvider({ rating: 5.0, distanceKm: 10, isOpenNow: false });
    expect(scoreProvider(open, 'emergency')).toBeGreaterThan(scoreProvider(closed, 'emergency'));
  });

  it('normal mode: rating weight is 40%, proximity weight is 35%', () => {
    // High rating, far away vs. low rating, close by — rating should dominate
    const highRating = makeProvider({ rating: 5.0, distanceKm: 20, reviewCount: 1 });
    const closeBy = makeProvider({ rating: 1.0, distanceKm: 0, reviewCount: 1 });
    // 5-star far beats 1-star close in normal mode
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
    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse([makePlaceFixture(), makePlaceFixture({ id: 'place-2', nationalPhoneNumber: '+15125550002' })]) as Response);

    const result = await searchProviders({ service_type: 'plumber', location: 'Austin, TX' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.providers.length).toBeGreaterThan(0);
    expect(result.source).toBe('google_places');
  });

  it('filters out places without a phone number', async () => {
    const withPhone = makePlaceFixture();
    const noPhone = makePlaceFixture({ nationalPhoneNumber: undefined, id: 'no-phone' });

    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse([withPhone, noPhone]) as Response);

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
    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse([makePlaceFixture()]) as Response);

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
    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse([makePlaceFixture()]) as Response);

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
    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse([makePlaceFixture()]) as Response);

    await searchProviders({ service_type: 'plumber', location: 'Austin, TX' });

    expect(updateCall).not.toHaveBeenCalled();
  });

  it('uses urgency=emergency for Places API rankPreference=DISTANCE', async () => {
    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse([makePlaceFixture()]) as Response);

    await searchProviders({ service_type: 'plumber', location: 'Austin, TX', urgency: 'emergency' });

    const placesCall = mockFetch.mock.calls[1];
    const body = JSON.parse((placesCall as unknown[])[1] as { body: string } extends { body: infer B } ? B : string);
    expect(body.rankPreference).toBe('DISTANCE');
  });

  it('Places API field mask includes all 8 required fields', async () => {
    mockFetch
      .mockResolvedValueOnce(makeGeocodingResponse(30.2672, -97.7431) as Response)
      .mockResolvedValueOnce(makePlacesResponse([makePlaceFixture()]) as Response);

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
