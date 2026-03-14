import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the telnyx-client module before any imports that depend on it
vi.mock('../../src/lib/voice/telnyx-client.js', () => ({
  telnyxClient: {
    callControlApplications: {
      update: vi.fn(),
    },
  },
}));

import { telnyxClient } from '../../src/lib/voice/telnyx-client.js';
import { updateWebhookUrl } from '../../src/startup/webhook-url-updater.js';

const mockUpdate = vi.mocked(telnyxClient.callControlApplications.update);

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('updateWebhookUrl', () => {
  const SANDBOX_URL = 'https://abc123.sandbox.example.com';
  const CONNECTION_ID = 'conn-test-123';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELNYX_CONNECTION_ID = CONNECTION_ID;

    // Default: successful Telnyx API call
    mockUpdate.mockResolvedValue({} as any);

    // Default: healthy self-test response
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    delete process.env.TELNYX_CONNECTION_ID;
  });

  it('Test 1: calls telnyx callControlApplications.update with correct connection ID and webhook URL', async () => {
    await updateWebhookUrl(SANDBOX_URL);

    expect(mockUpdate).toHaveBeenCalledWith(
      CONNECTION_ID,
      { webhook_event_url: `${SANDBOX_URL}/webhooks/telnyx` }
    );
  });

  it('Test 2: performs a self-test fetch to /health after updating the URL', async () => {
    await updateWebhookUrl(SANDBOX_URL);

    expect(mockFetch).toHaveBeenCalledWith(
      `${SANDBOX_URL}/health`,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('Test 3: throws if self-test returns non-200', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    await expect(updateWebhookUrl(SANDBOX_URL)).rejects.toThrow();
  });

  it('Test 4: constructs webhook URL as {sandboxUrl}/webhooks/telnyx', async () => {
    const customUrl = 'https://custom.sandbox.test.io';

    await updateWebhookUrl(customUrl);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.any(String),
      { webhook_event_url: 'https://custom.sandbox.test.io/webhooks/telnyx' }
    );
  });
});
