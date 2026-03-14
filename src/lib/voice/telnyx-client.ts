import Telnyx from 'telnyx';

const apiKey = process.env.TELNYX_API_KEY;

if (!apiKey) {
  throw new Error(
    '[telnyx-client] TELNYX_API_KEY environment variable is not set. ' +
      'Set it in your .env file or environment before starting the server.'
  );
}

/**
 * Singleton Telnyx SDK client.
 * Import this module anywhere that needs to interact with the Telnyx API
 * or verify webhook signatures.
 */
export const telnyxClient = new Telnyx(apiKey);
