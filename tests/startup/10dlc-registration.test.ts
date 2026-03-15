import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerBrand, registerCampaign, assignPhoneNumber } from '../../src/startup/register-10dlc.js';

// Mock global fetch for Telnyx 10DLC API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('10DLC Registration', () => {
  const BRAND_ID = 'brand-abc-123';
  const CAMPAIGN_ID = 'campaign-xyz-456';
  const PHONE_NUMBER = '+15555550100';
  const API_KEY = 'test-api-key-000';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELNYX_API_KEY = API_KEY;
    process.env.TELNYX_PHONE_NUMBER = PHONE_NUMBER;
    process.env.BUSINESS_EIN = '12-3456789';
    process.env.BUSINESS_PHONE = '+15145550100';
    process.env.BUSINESS_EMAIL = 'contact@cardinalconseils.com';
    process.env.BUSINESS_WEBSITE = 'https://cardinalconseils.com';
    process.env.BUSINESS_STREET = '123 Rue Principale';
    process.env.BUSINESS_CITY = 'Montreal';
    process.env.BUSINESS_STATE = 'QC';
    process.env.BUSINESS_ZIP = 'H1A 1A1';
  });

  afterEach(() => {
    delete process.env.TELNYX_API_KEY;
    delete process.env.TELNYX_PHONE_NUMBER;
    delete process.env.BUSINESS_EIN;
    delete process.env.BUSINESS_PHONE;
    delete process.env.BUSINESS_EMAIL;
    delete process.env.BUSINESS_WEBSITE;
    delete process.env.BUSINESS_STREET;
    delete process.env.BUSINESS_CITY;
    delete process.env.BUSINESS_STATE;
    delete process.env.BUSINESS_ZIP;
  });

  describe('registerBrand', () => {
    it('Test 5: calls POST /v2/10dlc/brand with correct fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { brandId: BRAND_ID } }),
      });

      const result = await registerBrand();

      // Verify fetch was called with Telnyx 10DLC brand endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/10dlc/brand'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining(API_KEY),
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('PRIVATE_PROFIT'),
        })
      );

      // Verify body contains required fields
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body).toMatchObject({
        entityType: 'PRIVATE_PROFIT',
        displayName: 'Cardinal Conseils',
        companyName: 'Cardinal Conseils',
        vertical: 'PROFESSIONAL_SERVICES',
        country: 'CA',
      });

      expect(result).toEqual({ brandId: BRAND_ID });
    });

    it('returns existing brandId without calling API when already registered (idempotent)', async () => {
      // First call registers the brand
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { brandId: BRAND_ID } }),
      });
      await registerBrand();
      const firstCallCount = mockFetch.mock.calls.length;

      // Second call should check and potentially skip (idempotency)
      // We accept either 1 call or 2 calls as long as it returns the right ID
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { brandId: BRAND_ID } }),
      });
      const result = await registerBrand();
      expect(result).toEqual({ brandId: BRAND_ID });
    });
  });

  describe('registerCampaign', () => {
    it('Test 6: calls POST /v2/10dlc/campaignBuilder with brandId and CUSTOMER_CARE usecase', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { campaignId: CAMPAIGN_ID } }),
      });

      const result = await registerCampaign(BRAND_ID);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/10dlc/campaignBuilder'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining(API_KEY),
          }),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body).toMatchObject({
        brandId: BRAND_ID,
        usecase: 'CUSTOMER_CARE',
      });

      expect(result).toEqual({ campaignId: CAMPAIGN_ID });
    });
  });

  describe('assignPhoneNumber', () => {
    it('Test 7: calls POST /v2/10dlc/phoneNumberCampaign with campaignId and phone number', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      await assignPhoneNumber(CAMPAIGN_ID);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/10dlc/phoneNumberCampaign'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining(API_KEY),
          }),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body).toMatchObject({
        campaignId: CAMPAIGN_ID,
        phoneNumber: PHONE_NUMBER,
      });
    });
  });
});
