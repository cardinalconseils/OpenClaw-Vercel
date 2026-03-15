import { Router } from 'express';
import express from 'express';
import { telnyxWebhookVerifier } from '../lib/voice/webhook-verify.js';
import { chat } from '../lib/ai/orchestrator.js';

/**
 * Express router for Telnyx webhook events.
 *
 * Route-level middleware stack:
 * 1. `express.raw({ type: 'application/json' })` — captures raw bytes for
 *    Ed25519 signature verification. MUST NOT use express.json() here.
 * 2. `telnyxWebhookVerifier` — verifies signature, attaches event to req.
 *
 * Handler responds 200 immediately (Telnyx requires response within 2 seconds),
 * then processes the event asynchronously.
 */
export const webhookRouter = Router();

webhookRouter.post(
  '/',
  // CRITICAL: raw body parser must come before JSON parsing (Pitfall 7)
  express.raw({ type: 'application/json' }),
  telnyxWebhookVerifier,
  (req, res) => {
    // Acknowledge receipt immediately — Telnyx requires response in < 2s
    res.status(200).json({ received: true });

    // Async processing — ACK returned above; dispatch to orchestrator below
    setImmediate(() => {
      try {
        const event = req.telnyxEvent;
        const eventType = event?.data?.event_type ?? 'unknown';
        console.log(`[webhooks] Received event: ${eventType}`);

        if (eventType === 'call.initiated') {
          const from = event?.data?.payload?.from ?? 'unknown';
          console.log(`[webhooks] Processing call.initiated from ${from}`);
          chat(
            [{ role: 'user', content: `Incoming call from ${from}. Greet the caller.` }],
            'greeting'
          )
            .then((response) => {
              console.log(`[webhooks] Orchestrator response: ${response}`);
            })
            .catch((err) => {
              console.error('[webhooks] Orchestrator error:', err);
            });
        }
      } catch (err) {
        console.error('[webhooks] Error processing event async:', err);
      }
    });
  }
);
