import { telnyxClient } from '../lib/voice/telnyx-client.js';

/**
 * Updates the Telnyx Call Control Application webhook URL to point to this
 * sandbox instance, then performs a self-test to confirm the URL is reachable.
 *
 * Called on every startup after Express is bound — ensures Telnyx can reach
 * this sandbox even after a VM restart changes the public URL.
 *
 * @param sandboxUrl - The publicly reachable base URL of this sandbox instance
 *   (e.g. https://abc123.sandbox.example.com). Defaults to VERCEL_URL or
 *   SANDBOX_URL environment variables if not provided explicitly.
 */
export async function updateWebhookUrl(sandboxUrl?: string): Promise<void> {
  const resolvedUrl = sandboxUrl ?? process.env.VERCEL_URL ?? process.env.SANDBOX_URL;

  if (!resolvedUrl) {
    throw new Error(
      '[webhook-url-updater] Cannot determine sandbox URL. ' +
        'Set VERCEL_URL or SANDBOX_URL environment variable, ' +
        'or pass the URL explicitly to updateWebhookUrl().'
    );
  }

  const connectionId = process.env.TELNYX_CONNECTION_ID;
  if (!connectionId) {
    throw new Error(
      '[webhook-url-updater] TELNYX_CONNECTION_ID environment variable is not set. ' +
        'Set it to the ID of your Telnyx Call Control Application.'
    );
  }

  const webhookUrl = `${resolvedUrl}/webhooks/telnyx`;

  // Update the Telnyx Call Control Application webhook URL
  await telnyxClient.callControlApplications.update(connectionId, {
    webhook_event_url: webhookUrl,
  });

  console.log(`[webhook-url-updater] Updated Telnyx webhook URL to: ${webhookUrl}`);

  // Self-test: confirm the health endpoint is reachable
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch(`${resolvedUrl}/health`, { signal: controller.signal });
  } catch (err) {
    throw new Error(
      `[webhook-url-updater] Self-test failed — could not reach ${resolvedUrl}/health: ${String(err)}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(
      `[webhook-url-updater] Self-test failed — health endpoint returned ${response.status}. ` +
        `Ensure the Express server is running and ${resolvedUrl}/health is unreachable.`
    );
  }

  console.log('[webhook-url-updater] Self-test passed — health endpoint is reachable');
}

// --- CLI entrypoint ---
// Invoked directly by bin/sandbox-start.sh via: npx tsx src/startup/webhook-url-updater.ts

const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith('webhook-url-updater.ts') ||
    process.argv[1].endsWith('webhook-url-updater.js'));

if (isDirectExecution) {
  updateWebhookUrl()
    .then(() => {
      console.log('[webhook-url-updater] Done');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[webhook-url-updater] Fatal:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
