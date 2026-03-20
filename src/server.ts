import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { webhookRouter } from './api/webhooks.js';
import { GatewayManager } from './startup/gateway-manager.js';
import { startKeepAlive, stopKeepAlive } from './startup/keepalive.js';
import { initMissions } from './lib/missions/mission-orchestrator.js';

/**
 * Express v5 application instance.
 * Exported for testing with supertest (no listen() needed in tests).
 *
 * IMPORTANT: Do NOT apply express.json() globally — it would break Telnyx
 * webhook signature verification which requires the raw body buffer.
 * Raw body parsing is applied at the route level in webhooks.ts.
 */
export const app = express();
export default app;

// --- Routes ---

/** Health endpoint — used by keep-alive and webhook URL self-test */
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/** Telnyx Call Control v2 webhook handler */
app.use('/webhooks/telnyx', webhookRouter);

/**
 * Proxy all remaining requests to the Next.js frontend (port 3000).
 * Only active in Sandbox mode where both Express and Next.js run on the same VM.
 * In Vercel serverless mode, routing is handled by vercel.json.
 */
if (process.env.SANDBOX_URL) {
  app.use(
    '/',
    createProxyMiddleware({
      target: 'http://127.0.0.1:3000',
      changeOrigin: true,
      on: {
        error: (err, _req, res) => {
          console.error('[server] Frontend proxy error:', (err as Error).message);
          if ('writeHead' in res && typeof res.writeHead === 'function') {
            (res as any).writeHead(502, { 'Content-Type': 'application/json' });
            (res as any).end(JSON.stringify({ error: 'Frontend unavailable' }));
          }
        },
      },
    }),
  );
}

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

// --- CLI entrypoint ---
// Executed only when the module is run directly:
//   npx tsx src/server.ts      (argv[1] ends with .ts)
//   node dist/server.js        (argv[1] ends with .js)

const isDirectExecution =
  process.argv[1]?.endsWith('server.ts') ||
  process.argv[1]?.endsWith('server.js');

if (isDirectExecution) {
  const MAX_GATEWAY_ATTEMPTS = 30;

  (async () => {
    const gatewayManager = new GatewayManager();

    // Start gateway with auto-restart / exponential backoff
    console.log('[server] Starting OpenClaw gateway via GatewayManager...');
    gatewayManager.start();

    // Wait up to 30s for gateway to become healthy
    let gatewayReady = false;
    for (let attempt = 1; attempt <= MAX_GATEWAY_ATTEMPTS; attempt++) {
      try {
        const healthy = await gatewayManager.isHealthy();
        if (healthy) {
          console.log(`[server] Gateway healthy after ${attempt}s`);
          gatewayReady = true;
          break;
        }
      } catch {
        // Not yet reachable — keep polling
      }
      console.log(`[server] Waiting for gateway... (${attempt}/${MAX_GATEWAY_ATTEMPTS})`);
      await new Promise<void>((resolve) => setTimeout(resolve, 1_000));
    }

    if (!gatewayReady) {
      console.error('[server] ERROR: Gateway failed to become healthy after 30s — exiting');
      process.exit(1);
    }

    // Initialize mission system — wire callbacks and recover incomplete missions
    try {
      await initMissions();
      console.log('[server] Mission system initialized');
    } catch (err) {
      console.error('[server] FATAL: Mission system initialization failed:', err);
      process.exit(1);
    }

    // Bind Express on port 18790
    const server = startServer();

    // Start 5-minute keep-alive health check loop
    const keepAliveTimer = startKeepAlive(gatewayManager);

    console.log('[server] Infrastructure ready — Express + GatewayManager + keep-alive active');

    // Graceful shutdown on SIGTERM or SIGINT
    const shutdown = async (signal: string) => {
      console.log(`[server] Received ${signal} — shutting down gracefully`);
      stopKeepAlive(keepAliveTimer);
      await gatewayManager.stop();
      server.close(() => {
        console.log('[server] Express closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  })();
}
