import express from 'express';
import { webhookRouter } from './api/webhooks.js';

/**
 * Express v5 application instance.
 * Exported for testing with supertest (no listen() needed in tests).
 *
 * IMPORTANT: Do NOT apply express.json() globally — it would break Telnyx
 * webhook signature verification which requires the raw body buffer.
 * Raw body parsing is applied at the route level in webhooks.ts.
 */
export const app = express();

// --- Routes ---

/** Health endpoint — used by keep-alive and webhook URL self-test */
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/** Telnyx Call Control v2 webhook handler */
app.use('/webhooks/telnyx', webhookRouter);

// --- Server startup ---

/**
 * Start the Express server.
 * Defaults to PORT env var or 18790 (gateway occupies 18789).
 *
 * @param port - Optional port override (useful for tests).
 * @returns The http.Server instance.
 */
export function startServer(port?: number): ReturnType<typeof app.listen> {
  const resolvedPort = port ?? Number(process.env.PORT ?? 18790);
  return app.listen(resolvedPort, () => {
    console.log(`[server] Listening on port ${resolvedPort}`);
  });
}
