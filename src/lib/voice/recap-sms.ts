/**
 * Post-call SMS recap module.
 *
 * Composes and sends an SMS recap to the caller after a call ends.
 * Two variants:
 *   - buildSuccessSms: caller was connected to a provider
 *   - buildFailureSms: no provider was available
 *
 * POST-01: SMS recap sent after call
 * POST-02: BuyMeACoffee tip link included on successful connections
 * POST-03: Failure fallback SMS with top provider list
 */

import { getTelnyxClient } from './telnyx-client.js';
import type { CallState } from './call-state.js';

// ─── Message builders ─────────────────────────────────────────────────────

/**
 * Builds the success SMS sent after a live transfer.
 * Includes the connected provider's name and phone, a list of tried
 * providers (up to 3), and an optional BuyMeACoffee tip link.
 *
 * @param state - Current call state after transfer
 * @param buyMeACoffeeUrl - Tip link URL; tip line omitted when empty
 */
export function buildSuccessSms(state: CallState, buyMeACoffeeUrl: string): string {
  const greeting = state.callerName ? `Hey ${state.callerName}!` : 'Hey there!';

  const connected = state.providers[state.currentProviderIndex];
  const connectedLine = connected
    ? `I connected you with ${connected.name} (${connected.phone}).`
    : 'I found you a provider.';

  // Providers tried before the connected one, capped at 3
  const triedProviders = state.providers
    .slice(0, state.currentProviderIndex)
    .slice(0, 3);

  const triedLine =
    triedProviders.length > 0
      ? `I also tried: ${triedProviders.map((p) => `${p.name} — unavailable`).join(', ')}.`
      : '';

  const tipLine = buyMeACoffeeUrl
    ? `If I saved you some time, a coffee's always appreciated ☕ ${buyMeACoffeeUrl}`
    : '';

  return [greeting, connectedLine, triedLine, tipLine]
    .filter((part) => part.length > 0)
    .join(' ');
}

/**
 * Builds the failure SMS sent when no provider could be connected.
 * Lists up to 3 top providers from the search results so the caller
 * can follow up themselves.
 *
 * No tip link is included — the caller did not receive a successful match.
 *
 * @param state - Current call state after all providers were exhausted
 */
export function buildFailureSms(state: CallState): string {
  const greeting = state.callerName ? `Hey ${state.callerName}!` : 'Hey there!';
  const serviceType = state.intent.serviceType ?? 'a provider';

  const topProviders = state.providers.slice(0, 3);
  const providerList = topProviders.map((p) => `${p.name}: ${p.phone}`).join(', ');

  return (
    `${greeting} I wasn't able to connect you live, but here are the top ${serviceType} providers I found: ` +
    `${providerList}. Good luck!`
  );
}

// ─── Sender ───────────────────────────────────────────────────────────────

/**
 * Sends a post-call SMS recap to the caller.
 *
 * Guards:
 *   - Skips if smsConsent !== true (strict equality — TCPA compliance)
 *   - Skips if callerPhone is missing/empty
 *
 * Non-fatal: errors are logged and swallowed — SMS failure must not crash call teardown.
 *
 * @param state - Current call state
 * @param callStatus - Outcome of the call
 */
export async function sendRecapSms(
  state: CallState,
  callStatus: 'completed' | 'no_match' | 'abandoned'
): Promise<void> {
  // TCPA strict equality — smsConsent must be exactly true
  if (state.smsConsent !== true) return;
  if (!state.callerPhone) return;

  const buyMeACoffeeUrl = process.env.BUYMEACOFFEE_URL ?? '';
  const text =
    callStatus === 'completed'
      ? buildSuccessSms(state, buyMeACoffeeUrl)
      : buildFailureSms(state);

  try {
    await getTelnyxClient().messages.send({
      from: process.env.TELNYX_PHONE_NUMBER!,
      to: state.callerPhone,
      text,
    });
    console.log(`[recap-sms] Recap SMS sent to ${state.callerPhone} (status: ${callStatus})`);
  } catch (err) {
    console.error(`[recap-sms] Failed to send recap SMS to ${state.callerPhone}:`, err);
    // Non-fatal — do not rethrow
  }
}
