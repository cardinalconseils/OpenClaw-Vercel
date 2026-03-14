import { describe, it, expect, beforeAll } from 'vitest';

describe('telnyx-client', () => {
  beforeAll(() => {
    // Set a dummy API key so the client does not throw on import
    process.env.TELNYX_API_KEY = 'KEY_test_dummy_key_for_tests';
  });

  it('exports a non-null telnyxClient instance', async () => {
    const { telnyxClient } = await import('../../../src/lib/voice/telnyx-client.js');
    expect(telnyxClient).not.toBeNull();
    expect(telnyxClient).not.toBeUndefined();
  });

  it('telnyxClient has a webhooks property', async () => {
    const { telnyxClient } = await import('../../../src/lib/voice/telnyx-client.js');
    expect(telnyxClient).toHaveProperty('webhooks');
  });
});
