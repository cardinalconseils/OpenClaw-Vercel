import { GatewayManager } from './gateway-manager.js';

/** Keep-alive ping interval: 5 minutes */
const KEEPALIVE_INTERVAL_MS = 5 * 60 * 1_000;

/**
 * Start the keep-alive interval loop.
 * Pings the gateway health endpoint every 5 minutes.
 * Triggers a gateway restart if the health check fails or throws.
 *
 * @param gatewayManager - The GatewayManager instance to monitor.
 * @returns The NodeJS.Timeout handle (pass to stopKeepAlive to cancel).
 */
export function startKeepAlive(gatewayManager: GatewayManager): NodeJS.Timeout {
  const timer = setInterval(async () => {
    try {
      const healthy = await gatewayManager.isHealthy();
      if (healthy) {
        console.log('[keepalive] Gateway healthy');
      } else {
        console.warn('[keepalive] Gateway unhealthy — restarting');
        await gatewayManager.restart();
      }
    } catch (err) {
      console.error('[keepalive] Health check threw — restarting', err);
      await gatewayManager.restart();
    }
  }, KEEPALIVE_INTERVAL_MS);

  return timer;
}

/**
 * Stop the keep-alive interval loop.
 *
 * @param timer - The timeout handle returned by startKeepAlive.
 */
export function stopKeepAlive(timer: NodeJS.Timeout): void {
  clearInterval(timer);
}
