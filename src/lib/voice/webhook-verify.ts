import type { Request, Response, NextFunction } from 'express';
import { telnyxClient } from './telnyx-client.js';
import type { TelnyxWebhookEvent } from '../../types/telnyx.js';

/**
 * Extend Express Request to carry the parsed and verified Telnyx webhook event.
 */
declare global {
  namespace Express {
    interface Request {
      telnyxEvent?: TelnyxWebhookEvent;
    }
  }
}

/**
 * Express middleware that verifies Telnyx webhook signatures using the SDK's
 * `webhooks.unwrap()` method (Ed25519).
 *
 * IMPORTANT: Must be applied AFTER `express.raw({ type: 'application/json' })`
 * so that `req.body` is a Buffer containing the raw bytes used for signature
 * verification. Calling `express.json()` first would parse the body and break
 * signature verification.
 *
 * On success: attaches parsed event to `req.telnyxEvent` and calls `next()`.
 * On failure: responds 403 with `{ error: 'Invalid webhook signature' }`.
 */
export async function telnyxWebhookVerifier(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body ?? '');
  const publicKey = process.env.TELNYX_PUBLIC_KEY ?? '';

  try {
    const event = await telnyxClient.webhooks.unwrap(rawBody, {
      headers: req.headers as Record<string, string>,
      key: publicKey || undefined,
    });

    req.telnyxEvent = event as unknown as TelnyxWebhookEvent;
    next();
  } catch (_err) {
    res.status(403).json({ error: 'Invalid webhook signature' });
  }
}
