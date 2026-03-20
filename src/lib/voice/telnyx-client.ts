import Telnyx from 'telnyx';

let _client: InstanceType<typeof Telnyx> | undefined;

/**
 * Singleton Telnyx SDK client.
 * Lazily initialized on first access so the app can start (e.g. /health)
 * even when TELNYX_API_KEY is not yet configured.
 */
export function getTelnyxClient(): InstanceType<typeof Telnyx> {
  if (!_client) {
    const apiKey = process.env.TELNYX_API_KEY;
    if (!apiKey) {
      throw new Error(
        '[telnyx-client] TELNYX_API_KEY environment variable is not set. ' +
          'Set it in your .env file or environment before starting the server.'
      );
    }
    _client = new Telnyx({ apiKey });
  }
  return _client;
}

/**
 * @deprecated Use getTelnyxClient() instead. Kept for backward compatibility
 * with existing imports — will throw if TELNYX_API_KEY is missing.
 */
export const telnyxClient = new Proxy({} as InstanceType<typeof Telnyx>, {
  get(_target, prop) {
    return (getTelnyxClient() as any)[prop];
  },
  has(_target, prop) {
    return prop in getTelnyxClient();
  },
});
