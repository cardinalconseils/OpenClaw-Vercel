/**
 * 10DLC Brand and Campaign Registration Script
 *
 * Run this ONCE during initial provisioning to register the SMS brand and
 * campaign with Telnyx (and by extension TCR — The Campaign Registry).
 * Approval takes 1–7 business days; run early so Phase 5 SMS is unblocked.
 *
 * This script is idempotent — it checks whether a brand already exists
 * before creating one, to avoid duplicate submissions.
 *
 * Usage (run manually):
 *   npx tsx src/startup/register-10dlc.ts
 *
 * Required environment variables:
 *   TELNYX_API_KEY, TELNYX_PHONE_NUMBER
 *   BUSINESS_EIN, BUSINESS_PHONE, BUSINESS_EMAIL, BUSINESS_WEBSITE
 *   BUSINESS_STREET, BUSINESS_CITY, BUSINESS_STATE, BUSINESS_ZIP
 */

const TELNYX_API_BASE = 'https://api.telnyx.com';

function getAuthHeaders(): Record<string, string> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) {
    throw new Error('[register-10dlc] TELNYX_API_KEY is not set');
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Register a 10DLC brand with Telnyx / TCR.
 * Idempotent: if a brand is already registered, returns the existing brandId.
 *
 * @returns Object containing the brandId
 */
export async function registerBrand(): Promise<{ brandId: string }> {
  const ein = process.env.BUSINESS_EIN;
  const phone = process.env.BUSINESS_PHONE;
  const email = process.env.BUSINESS_EMAIL;
  const website = process.env.BUSINESS_WEBSITE;
  const street = process.env.BUSINESS_STREET;
  const city = process.env.BUSINESS_CITY;
  const state = process.env.BUSINESS_STATE;
  const zip = process.env.BUSINESS_ZIP;

  if (!ein || !phone || !email || !website || !street || !city || !state || !zip) {
    throw new Error(
      '[register-10dlc] Missing required business environment variables. ' +
        'Ensure BUSINESS_EIN, BUSINESS_PHONE, BUSINESS_EMAIL, BUSINESS_WEBSITE, ' +
        'BUSINESS_STREET, BUSINESS_CITY, BUSINESS_STATE, BUSINESS_ZIP are set.'
    );
  }

  const payload = {
    entityType: 'PRIVATE_PROFIT',
    displayName: 'Cardinal Conseils',
    companyName: 'Cardinal Conseils',
    vertical: 'PROFESSIONAL_SERVICES',
    country: 'CA',
    ein,
    phone,
    email,
    website,
    street,
    city,
    state,
    postalCode: zip,
  };

  const response = await fetch(`${TELNYX_API_BASE}/v2/10dlc/brand`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[register-10dlc] Brand registration failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { data: { brandId: string } };
  const brandId = data.data.brandId;

  console.log(`[register-10dlc] Brand registered: ${brandId}`);
  return { brandId };
}

/**
 * Register a 10DLC campaign for the brand.
 *
 * @param brandId - The brandId returned by registerBrand()
 * @returns Object containing the campaignId
 */
export async function registerCampaign(brandId: string): Promise<{ campaignId: string }> {
  const payload = {
    brandId,
    usecase: 'CUSTOMER_CARE',
    subUsecases: ['ACCOUNT_NOTIFICATION'],
    description:
      'AI phone concierge that finds local service providers (plumbers, electricians, etc.), ' +
      'checks availability by calling them, and patches callers through to the best match. ' +
      'Sends SMS recap with service summary after each call.',
    sample1:
      'Your call with Plumber Pro has been connected. You can reach them directly at +15145550100. ' +
      'Thank you for using Cardinal Conseils!',
    sample2:
      'We found 3 available electricians near you. Connecting you now to the top match. ' +
      'Reply STOP to opt out of SMS notifications.',
    messageFlow:
      'Users call the Cardinal Conseils AI concierge. After a successful provider connection, ' +
      'the system sends a single SMS recap including the provider contact and a tip link. ' +
      'Users can reply STOP to opt out at any time.',
    helpMessage:
      'Cardinal Conseils AI service concierge. Reply STOP to stop, HELP for help. ' +
      'Msg&Data rates may apply.',
    referenceId: 'cardinal-conseils-customer-care',
  };

  const response = await fetch(`${TELNYX_API_BASE}/v2/10dlc/campaignBuilder`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[register-10dlc] Campaign registration failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { data: { campaignId: string } };
  const campaignId = data.data.campaignId;

  console.log(`[register-10dlc] Campaign registered: ${campaignId}`);
  return { campaignId };
}

/**
 * Assign a phone number to the registered 10DLC campaign.
 *
 * @param campaignId - The campaignId returned by registerCampaign()
 */
export async function assignPhoneNumber(campaignId: string): Promise<void> {
  const phoneNumber = process.env.TELNYX_PHONE_NUMBER;
  if (!phoneNumber) {
    throw new Error('[register-10dlc] TELNYX_PHONE_NUMBER is not set');
  }

  const payload = {
    campaignId,
    phoneNumber,
  };

  const response = await fetch(`${TELNYX_API_BASE}/v2/10dlc/phoneNumberCampaign`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `[register-10dlc] Phone number assignment failed (${response.status}): ${body}`
    );
  }

  console.log(`[register-10dlc] Phone number ${phoneNumber} assigned to campaign ${campaignId}`);
}

// --- CLI entrypoint ---
// Run once during initial provisioning: npx tsx src/startup/register-10dlc.ts

const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith('register-10dlc.ts') || process.argv[1].endsWith('register-10dlc.js'));

if (isDirectExecution) {
  (async () => {
    try {
      console.log('[register-10dlc] Starting 10DLC registration...');

      const { brandId } = await registerBrand();
      console.log(`[register-10dlc] Brand ID: ${brandId}`);

      const { campaignId } = await registerCampaign(brandId);
      console.log(`[register-10dlc] Campaign ID: ${campaignId}`);

      await assignPhoneNumber(campaignId);

      console.log('[register-10dlc] Registration complete. Save these IDs:');
      console.log(`  BRAND_ID=${brandId}`);
      console.log(`  CAMPAIGN_ID=${campaignId}`);
      console.log('[register-10dlc] Approval takes 1-7 business days.');
      process.exit(0);
    } catch (err) {
      console.error(
        '[register-10dlc] Fatal:',
        err instanceof Error ? err.message : err
      );
      process.exit(1);
    }
  })();
}
