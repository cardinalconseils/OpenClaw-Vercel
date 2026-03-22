/**
 * Outbound provider calling module — cascade loop, AMD handling, narration,
 * SMS pre-notification, and availability parsing.
 *
 * Entry point: startOutboundCascade(userCallControlId)
 * Called from webhooks.ts after provider search completes.
 *
 * CALL-01: Sequential cascade dial from ranked provider list
 * CALL-02: AI self-identification as first utterance on provider answer
 * CALL-03: Narration timer speaks status to user every 17s during ring
 * CALL-04: SMS pre-notification sent to provider before dialing
 * CALL-05: AMD voicemail detection and hangup/busy/no-answer cascade
 * CALL-06: Provider availability parsing from transcript
 * CALL-07: Max 4 providers; speak NO_MATCH_MESSAGE if all exhausted
 */

import { getTelnyxClient } from './telnyx-client.js';
import { getCall, updateCall } from './call-state.js';
import {
  TELNYX_VOICE_STRING,
  TELNYX_VOICE_SETTINGS,
  PROVIDER_RING_TIMEOUT_SECS,
  MAX_CASCADE_PROVIDERS,
  NARRATION_INTERVAL_MS,
} from './voice-config.js';
import type { Provider } from '../tools/handlers/search.js';
import { z } from 'zod';

// ─── Provider dial client state (serialization boundary) ─────────────────

const ProviderDialClientStateSchema = z.object({
  stage: z.literal('provider-dial'),
  userCallControlId: z.string(),
  providerName: z.string(),
  providerIndex: z.number(),
});

export type ProviderDialClientState = z.infer<typeof ProviderDialClientStateSchema>;

// ─── Exported constants ────────────────────────────────────────────────────

/**
 * Builds a brief transfer announcement for the provider when the user is being bridged.
 * Used as the spoken intro before the bridge is initiated.
 * Falls back to 'a customer' when callerName is undefined.
 */
export const TRANSFER_BRIEF = (
  callerName: string | undefined,
  serviceType: string,
  location: string
): string => {
  const name = callerName ?? 'a customer';
  return (
    `I have ${name} who needs ${serviceType} near ${location}. ` +
    `I'm connecting them to you now. One moment.`
  );
};

/**
 * Bridges the provider call leg to the user call leg via Telnyx bridge API.
 * After this call, both parties are connected directly; the agent exits the call.
 * XFER-02: Telnyx bridge API call.
 */
export async function bridgeToUser(
  providerCallControlId: string,
  userCallControlId: string
): Promise<void> {
  await getTelnyxClient().calls.actions.bridge(providerCallControlId, {
    call_control_id_to_bridge_with: userCallControlId,
  });
  console.log(
    `[outbound-caller] Bridge initiated: provider ${providerCallControlId} <-> user ${userCallControlId}`
  );
}

/** AI legal disclosure — must be first utterance on outbound calls (CA SB-1001, FCC) */
export const AI_INTRO = (providerName: string, serviceType: string, location: string): string =>
  `Hi, this is an AI concierge calling on behalf of a customer. ` +
  `I'm an automated assistant — not a human. ` +
  `I have a customer who needs ${serviceType} near ${location}. ` +
  `Are you available to take this job today?`;

/** Spoken to user after all providers exhausted without a match */
export const NO_MATCH_MESSAGE =
  "I've tried reaching several providers but wasn't able to connect with anyone available right now. " +
  "I'm sorry I couldn't find a match this time.";

// ─── Availability parsing (CALL-06) ───────────────────────────────────────

const AVAILABLE_YES = /\b(yes|yeah|sure|absolutely|can do|available|of course|go ahead)\b/i;
const AVAILABLE_NO = /\b(no|not|busy|unavailable|can't|cannot|closed|full)\b/i;

/**
 * Parses a provider's verbal response to determine availability.
 * Returns 'available', 'unavailable', or 'unclear'.
 */
export function parseAvailability(transcript: string): 'available' | 'unavailable' | 'unclear' {
  if (AVAILABLE_YES.test(transcript)) return 'available';
  if (AVAILABLE_NO.test(transcript)) return 'unavailable';
  return 'unclear';
}

// ─── Client state codec ───────────────────────────────────────────────────

/**
 * Decodes a Telnyx base64-encoded client_state from a webhook event.
 * Returns {} if the input is undefined or invalid JSON.
 */
export function decodeClientState(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch (err) {
    console.error(`[outbound-caller] Failed to decode client_state: ${(err as Error).message}, raw=${raw?.substring(0, 50)}`);
    return {};
  }
}

/**
 * Decodes and validates a provider-dial client_state with Zod.
 * Returns null if the payload is missing, malformed, or doesn't match the schema.
 */
export function decodeProviderDialState(raw: string | undefined): ProviderDialClientState | null {
  const decoded = decodeClientState(raw);
  const result = ProviderDialClientStateSchema.safeParse(decoded);
  if (!result.success) return null;
  return result.data;
}

// ─── Internal helpers ─────────────────────────────────────────────────────

/** Narration phrases cycled while the provider line rings (CALL-03) */
const NARRATION_PHRASES = [
  (name: string) => `Still waiting for ${name} to pick up...`,
  (name: string) => `Hang tight — still ringing ${name}.`,
  (name: string) => `${name} hasn't answered yet — I'll give them a few more seconds.`,
];

/** Module-level map of narration timer handles, keyed by userCallControlId */
const _narrationTimers = new Map<string, { stop: () => void }>();

/** Speaks text on a call leg using the configured Telnyx TTS voice. */
async function speak(callControlId: string, text: string): Promise<void> {
  await getTelnyxClient().calls.actions.speak(callControlId, {
    payload: text,
    voice: TELNYX_VOICE_STRING,
    voice_settings: TELNYX_VOICE_SETTINGS,
  });
}

// ─── Narration timer (CALL-03) ────────────────────────────────────────────

/**
 * Starts a narration timer that speaks a status update to the user every
 * NARRATION_INTERVAL_MS (17s). Returns a { stop } handle to cancel the timer.
 */
export function startNarrationTimer(
  userCallControlId: string,
  providerName: string
): { stop: () => void } {
  let count = 0;
  const timer = setInterval(async () => {
    const text = NARRATION_PHRASES[count % NARRATION_PHRASES.length](providerName);
    count++;
    try {
      await speak(userCallControlId, text);
    } catch (err) {
      console.warn(`[outbound-caller] Narration speak failed (call may have ended): ${(err as Error).message}`);
    }
  }, NARRATION_INTERVAL_MS);

  const handle = { stop: () => clearInterval(timer) };
  _narrationTimers.set(userCallControlId, handle);
  return handle;
}

/** Stops and removes the narration timer for a call, if one is active. */
export function stopNarrationTimer(userCallControlId: string): void {
  const handle = _narrationTimers.get(userCallControlId);
  if (handle) {
    handle.stop();
    _narrationTimers.delete(userCallControlId);
  }
}

// ─── SMS pre-notification (CALL-04) ───────────────────────────────────────

/**
 * Sends an SMS to the provider before dialing to signal legitimate customer interest.
 * Non-fatal — a failed SMS does not block the outbound dial.
 */
export async function sendProviderSms(
  provider: Provider,
  state: { intent: Partial<{ serviceType: string; location: string }> }
): Promise<void> {
  const serviceType = state.intent?.serviceType ?? 'service';
  const location = state.intent?.location ?? 'your area';
  try {
    await getTelnyxClient().messages.send({
      from: process.env.TELNYX_PHONE_NUMBER!,
      to: provider.phone,
      text:
        `Incoming call from an AI concierge — a customer needs ${serviceType} near ${location}. ` +
        `Answering now connects you directly.`,
    });
    console.log(`[outbound-caller] SMS sent to ${provider.name} at ${provider.phone}`);
  } catch (err) {
    console.error(`[outbound-caller] Failed to send SMS to ${provider.name}:`, err);
    // Non-fatal — continue with dial even if SMS fails
  }
}

// ─── Provider dial (CALL-01) ──────────────────────────────────────────────

/**
 * Dials a single provider via Telnyx calls.dial().
 * Sets timeout_secs=25 (~5 rings) and enables AMD (detect_words).
 * Encodes cascade routing data into client_state for webhook routing.
 */
export async function dialProvider(
  userCallControlId: string,
  provider: Provider,
  index: number
): Promise<void> {
  const clientState = Buffer.from(
    JSON.stringify({
      stage: 'provider-dial',
      userCallControlId,
      providerName: provider.name,
      providerIndex: index,
    })
  ).toString('base64');

  const dialResponse = await getTelnyxClient().calls.dial({
    connection_id: process.env.TELNYX_CONNECTION_ID!,
    from: process.env.TELNYX_PHONE_NUMBER!,
    to: provider.phone,
    timeout_secs: PROVIDER_RING_TIMEOUT_SECS,
    answering_machine_detection: 'detect_words',
    client_state: clientState,
  });

  const providerCcid = (dialResponse as { data?: { call_control_id?: string } })?.data
    ?.call_control_id;
  if (providerCcid) {
    updateCall(userCallControlId, { providerCallControlId: providerCcid });
  }

  console.log(
    `[outbound-caller] Dialing ${provider.name} (index ${index}) for user ${userCallControlId}`
  );
}

// ─── Cascade loop (CALL-07) ───────────────────────────────────────────────

/**
 * Attempts the next provider in the cascade.
 * Increments currentProviderIndex before dialing.
 * Speaks NO_MATCH_MESSAGE and sets stage='complete' if all providers exhausted
 * (index >= MAX_CASCADE_PROVIDERS or no more providers in list).
 */
export async function tryNextProvider(userCallControlId: string): Promise<void> {
  stopNarrationTimer(userCallControlId);

  const state = getCall(userCallControlId);
  if (!state) return;

  const idx = state.currentProviderIndex;

  if (idx >= MAX_CASCADE_PROVIDERS || idx >= state.providers.length) {
    await speak(userCallControlId, NO_MATCH_MESSAGE);
    updateCall(userCallControlId, { stage: 'complete' });
    console.log(
      `[outbound-caller] All providers exhausted (tried ${idx}) for ${userCallControlId}`
    );
    return;
  }

  const provider = state.providers[idx];
  await speak(userCallControlId, `Calling ${provider.name} now — one moment.`);
  updateCall(userCallControlId, { stage: 'calling' });

  // SMS pre-notification (CALL-04) — fire before dial to warm up provider
  await sendProviderSms(provider, state);

  // Start narration timer for user updates during ring (CALL-03)
  startNarrationTimer(userCallControlId, provider.name);

  // Dial provider (CALL-01)
  await dialProvider(userCallControlId, provider, idx);
}

// ─── Cascade entry point (CALL-01) ────────────────────────────────────────

/**
 * Starts the outbound provider cascade. Called from webhooks.ts after
 * searchProviders() resolves with a ranked provider list.
 *
 * Resets currentProviderIndex to 0 and delegates to tryNextProvider().
 * If no providers are found, immediately speaks NO_MATCH_MESSAGE.
 */
export async function startOutboundCascade(userCallControlId: string): Promise<void> {
  const state = getCall(userCallControlId);
  if (!state || state.providers.length === 0) {
    await speak(userCallControlId, NO_MATCH_MESSAGE);
    updateCall(userCallControlId, { stage: 'complete' });
    return;
  }

  updateCall(userCallControlId, { currentProviderIndex: 0, stage: 'calling' });
  await tryNextProvider(userCallControlId);
}

// ─── Provider answer handler (CALL-02) ────────────────────────────────────

/**
 * Called when the provider answers the outbound call.
 * MUST speak AI_INTRO as the first utterance (CA SB-1001, FCC automated call disclosure).
 * Also narrates to the user that the provider answered.
 */
export async function handleProviderAnswer(
  providerCallControlId: string,
  clientState: ProviderDialClientState
): Promise<void> {
  const { userCallControlId, providerName } = clientState;

  stopNarrationTimer(userCallControlId);

  const state = getCall(userCallControlId);
  const serviceType = state?.intent?.serviceType ?? 'service';
  const location = state?.intent?.location ?? 'your area';

  // CALL-02: AI identification MUST be first utterance — legal requirement
  const intro = AI_INTRO(providerName, serviceType, location);
  await getTelnyxClient().calls.actions.speak(providerCallControlId, {
    payload: intro,
    voice: TELNYX_VOICE_STRING,
    voice_settings: TELNYX_VOICE_SETTINGS,
  });

  // Narrate to user that provider answered
  try {
    await speak(userCallControlId, `${providerName} answered — I'm checking if they're available now.`);
  } catch (err) {
    console.warn(`[outbound-caller] Speak to user failed (call may have ended): ${(err as Error).message}`);
  }

  console.log(`[outbound-caller] Provider ${providerName} answered, AI intro spoken`);
}

// ─── AMD voicemail handler (CALL-05) ──────────────────────────────────────

/**
 * Called when Telnyx AMD emits a result event on the provider leg.
 * When result='machine': hang up the provider leg and cascade to next provider.
 * When result='human' or 'not_sure': allow the conversation to continue.
 */
export async function handleAmdResult(
  providerCallControlId: string,
  result: string,
  clientState: ProviderDialClientState
): Promise<void> {
  const { userCallControlId, providerName, providerIndex } = clientState;

  if (result === 'machine') {
    console.log(`[outbound-caller] AMD: machine detected for ${providerName}, cascading`);
    try {
      await getTelnyxClient().calls.actions.hangup(providerCallControlId, {});
    } catch (err) {
      console.warn(`[outbound-caller] Provider hangup failed (may already be hung up): ${(err as Error).message}`);
    }

    await speak(userCallControlId, `${providerName} went to voicemail — trying the next one.`);
    updateCall(userCallControlId, {
      currentProviderIndex: providerIndex + 1,
      providerCallControlId: undefined,
    });
    await tryNextProvider(userCallControlId);
  }
  // 'human' or 'not_sure' — let the provider conversation continue
}

// ─── Provider hangup handler (CALL-05) ────────────────────────────────────

/**
 * Called when the provider leg hangs up (timeout, no-answer, busy, or normal clearing).
 * Cascades to next provider for timeout/no_answer/user_busy causes.
 * Normal clearing and originator_cancel are handled separately.
 */
export async function handleProviderHangup(
  providerCallControlId: string,
  hangupCause: string,
  clientState: ProviderDialClientState
): Promise<void> {
  const { userCallControlId, providerName, providerIndex } = clientState;

  // XFER-04: Do NOT cascade after successful bridge transfer
  const state = getCall(userCallControlId);
  if (state?.stage === 'transferred') {
    console.log(
      `[outbound-caller] Post-transfer hangup from ${providerName} — call completed normally`
    );
    return;
  }

  // Also cascade on normal_clearing if pre-bridge (provider hung up before transfer)
  const cascadeCauses = ['timeout', 'no_answer', 'user_busy', 'normal_clearing'];
  if (cascadeCauses.includes(hangupCause)) {
    console.log(
      `[outbound-caller] Provider ${providerName} hangup: ${hangupCause}, cascading`
    );
    stopNarrationTimer(userCallControlId);

    const causeMessage =
      hangupCause === 'user_busy'
        ? `${providerName}'s line is busy — trying the next one.`
        : `${providerName} didn't answer — trying the next one.`;

    await speak(userCallControlId, causeMessage);
    updateCall(userCallControlId, {
      currentProviderIndex: providerIndex + 1,
      providerCallControlId: undefined,
    });
    await tryNextProvider(userCallControlId);
  }
  // 'normal_clearing' or 'originator_cancel' — handled by transfer/conversation logic
}
