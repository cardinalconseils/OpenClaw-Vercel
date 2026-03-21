import { Router } from 'express';
import express from 'express';
import { telnyxWebhookVerifier } from '../lib/voice/webhook-verify.js';
import {
  initCall,
  getCall,
  updateCall,
  endCall,
  shouldAdvancePastClarification,
} from '../lib/voice/call-state.js';
import {
  GREETING_STEP_1,
  GREETING_STEP_2,
  GREETING_STEP_2_FALLBACK,
  TCPA_CONSENT_ASK,
  TCPA_CONSENT_DECLINE_ACK,
  SILENCE_NUDGE,
  GRACEFUL_HANGUP,
} from '../lib/voice/greeting.js';
import {
  TELNYX_VOICE_STRING,
  TELNYX_VOICE_SETTINGS,
  TELNYX_STT_CONFIG,
  SILENCE_NUDGE_MS,
  SESSION_PERSIST_MS,
} from '../lib/voice/voice-config.js';
import { startFillerLoop, stopFillerLoop } from '../lib/voice/filler.js';
import { getTelnyxClient } from '../lib/voice/telnyx-client.js';
import {
  startOutboundCascade,
  tryNextProvider,
  handleProviderAnswer,
  handleAmdResult,
  handleProviderHangup,
  decodeClientState,
  parseAvailability,
  stopNarrationTimer,
  bridgeToUser,
  TRANSFER_BRIEF,
} from '../lib/voice/outbound-caller.js';
import { searchProviders } from '../lib/tools/handlers/search.js';
import { buildResultNarration, buildNoResultsNarration, buildSearchingFiller } from '../lib/voice/narration.js';
import {
  extractIntent,
  isIntentComplete,
  getDisambiguationPrompt,
} from '../lib/ai/intent-extractor.js';
import { insertCallHistory } from '../lib/db/call-history-repo.js';
import { sendRecapSms } from '../lib/voice/recap-sms.js';

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

/** Track active filler loops per call so they can be stopped on hangup. */
const _fillerLoops = new Map<string, { stop: () => void }>();

/**
 * Speak helper — avoids repeating voice/voice_settings on every call.
 */
async function speak(callControlId: string, text: string): Promise<void> {
  await getTelnyxClient().calls.actions.speak(callControlId, {
    payload: text,
    voice: TELNYX_VOICE_STRING,
    voice_settings: TELNYX_VOICE_SETTINGS,
  });
}

/**
 * Reset the per-call silence detection timer.
 * Fires SILENCE_NUDGE after SILENCE_NUDGE_MS of no caller speech.
 * After 2 nudges, speaks GRACEFUL_HANGUP and hangs up.
 */
function resetSilenceTimer(callControlId: string): void {
  const state = getCall(callControlId);
  if (!state) return;
  if (state.silenceNudgeTimer) clearTimeout(state.silenceNudgeTimer);
  const timer = setTimeout(async () => {
    try {
      const current = getCall(callControlId);
      if (!current) return;
      if (current.silenceNudgeCount >= 2) {
        await speak(callControlId, GRACEFUL_HANGUP);
        setTimeout(async () => {
          try {
            await getTelnyxClient().calls.actions.hangup(callControlId, {});
          } catch (err) {
            console.error(`[webhooks] Failed to hangup call ${callControlId}:`, err);
          }
          endCall(callControlId);
        }, 3000);
        return;
      }
      await speak(callControlId, SILENCE_NUDGE);
      updateCall(callControlId, { silenceNudgeCount: current.silenceNudgeCount + 1 });
      resetSilenceTimer(callControlId);
    } catch (err) {
      console.error(`[webhooks] Silence timer error for ${callControlId}:`, err);
    }
  }, SILENCE_NUDGE_MS);
  updateCall(callControlId, {
    silenceNudgeTimer: timer,
    silenceNudgeCount: state.silenceNudgeCount === undefined ? 0 : state.silenceNudgeCount,
  });
}

webhookRouter.post(
  '/',
  // CRITICAL: raw body parser must come before JSON parsing (Pitfall 7)
  express.raw({ type: 'application/json' }),
  telnyxWebhookVerifier,
  (req, res) => {
    // Acknowledge receipt immediately — Telnyx requires response in < 2s
    res.status(200).json({ received: true });

    // Async processing — ACK returned above; dispatch below
    setImmediate(async () => {
      try {
        const event = req.telnyxEvent;
        const eventType = event?.data?.event_type ?? 'unknown';
        const payload = event?.data?.payload ?? {};
        const callControlId: string = (payload as any).call_control_id ?? '';

        console.log(`[webhooks] Received event: ${eventType}`);

        switch (eventType) {
          case 'call.initiated': {
            const direction = (payload as any).direction;
            if (direction === 'incoming') {
              console.log(`[webhooks] Answering inbound call ${callControlId}`);
              await getTelnyxClient().calls.actions.answer(callControlId, {
                client_state: Buffer.from(
                  JSON.stringify({ source: 'openclaw' })
                ).toString('base64'),
              });
            } else {
              console.log(`[webhooks] Outbound call initiated ${callControlId} — no auto-answer`);
            }
            break;
          }

          case 'call.answered': {
            const direction = (payload as any).direction;
            if (direction === 'incoming' || !direction) {
              // Inbound caller — greet and start transcription
              const from: string = (payload as any).from ?? 'unknown';
              initCall(callControlId, from);
              // Greeting + transcription must fire immediately — no intermediate awaits
              await speak(callControlId, GREETING_STEP_1);
              await getTelnyxClient().calls.actions.startTranscription(callControlId, TELNYX_STT_CONFIG);
              console.log(`[webhooks] Greeting + transcription started for ${callControlId}`);
            } else {
              // Outbound provider leg answered
              const clientState = decodeClientState((payload as any).client_state);
              if (clientState.stage === 'provider-dial') {
                await handleProviderAnswer(callControlId, clientState);
                // Start transcription on provider leg to capture availability response (CALL-06)
                await getTelnyxClient().calls.actions.startTranscription(callControlId, {
                  ...TELNYX_STT_CONFIG,
                  transcription_tracks: 'inbound',  // listen to provider's speech
                });
              }
            }
            break;
          }

          case 'call.speak.ended': {
            // Check if this is a provider-leg speak.ended (bridge trigger)
            const speakClientState = decodeClientState((payload as any).client_state);
            if (speakClientState.stage === 'provider-dial') {
              // Provider leg speak ended — check if bridge is pending (XFER-01)
              const userCcid = speakClientState.userCallControlId as string;
              const bridgeState = getCall(userCcid);
              if (bridgeState?.pendingBridge) {
                updateCall(userCcid, { pendingBridge: false });
                try {
                  await bridgeToUser(callControlId, userCcid);
                  console.log(`[webhooks] Bridge initiated after brief: ${callControlId} <-> ${userCcid}`);
                } catch (err) {
                  // Bridge failed — tell user and cascade to next provider
                  console.error(`[webhooks] Bridge API failed:`, err);
                  const providerName = speakClientState.providerName as string;
                  const providerIndex = speakClientState.providerIndex as number;
                  try {
                    await speak(userCcid, `I had trouble connecting you to ${providerName} — trying the next one.`);
                  } catch { /* user leg may have ended */ }
                  updateCall(userCcid, { currentProviderIndex: providerIndex + 1, providerCallControlId: undefined });
                  await tryNextProvider(userCcid);
                }
              }
              break;
            }

            // Inbound user leg speak.ended — existing greeting logic
            const state = getCall(callControlId);
            if (state?.stage === 'greeting') {
              updateCall(callControlId, { stage: 'name_capture' });
              resetSilenceTimer(callControlId);
            }
            console.log(`[webhooks] Speak ended for ${callControlId}, stage: ${state?.stage}`);
            break;
          }

          case 'call.transcription': {
            const transcriptionData = (payload as any).transcription_data ?? {};
            const transcript: string = transcriptionData.transcript ?? '';
            if (!transcript.trim()) break;

            // Check if this is a provider leg transcription (CALL-06)
            const transcriptionClientState = decodeClientState((payload as any).client_state);
            if (transcriptionClientState.stage === 'provider-dial') {
              const providerTranscript: string = transcriptionData.transcript ?? '';
              if (providerTranscript.trim()) {
                const availability = parseAvailability(providerTranscript);
                const userCcid = transcriptionClientState.userCallControlId as string;
                const providerName = transcriptionClientState.providerName as string;
                const providerIndex = transcriptionClientState.providerIndex as number;

                console.log(`[webhooks] Provider ${providerName} transcript: "${providerTranscript}" → ${availability}`);

                if (availability === 'available') {
                  // XFER-01/XFER-02: Provider confirmed — brief provider, then bridge
                  stopNarrationTimer(userCcid);

                  // Tell user the good news
                  try {
                    await speak(userCcid, `Great news — ${providerName} is available! I'm going to connect you now.`);
                  } catch { /* user leg may have ended */ }

                  // Build and speak brief on PROVIDER leg (XFER-02)
                  const state = getCall(userCcid);
                  const briefText = TRANSFER_BRIEF(
                    state?.callerName,
                    state?.intent?.serviceType ?? 'service',
                    state?.intent?.location ?? 'your area'
                  );

                  // Set pendingBridge BEFORE speaking brief — speak.ended will trigger bridge
                  updateCall(userCcid, { pendingBridge: true, currentProviderIndex: providerIndex });

                  await getTelnyxClient().calls.actions.speak(callControlId, {
                    payload: briefText,
                    voice: TELNYX_VOICE_STRING,
                    voice_settings: TELNYX_VOICE_SETTINGS,
                  });

                  console.log(`[webhooks] Provider ${providerName} available — brief spoken, pendingBridge=true`);
                } else if (availability === 'unavailable') {
                  // Provider declined — cascade
                  try {
                    await getTelnyxClient().calls.actions.hangup(callControlId, {});
                  } catch (_) { /* may already be hung up */ }
                  await speak(userCcid, `${providerName} isn't available right now — trying the next one.`);
                  updateCall(userCcid, { currentProviderIndex: providerIndex + 1, providerCallControlId: undefined });
                  await tryNextProvider(userCcid);
                }
                // 'unclear' — wait for more speech from provider
              }
              break;
            }

            const state = getCall(callControlId);
            if (!state) {
              console.warn(`[webhooks] call.transcription: no state for ${callControlId}`);
              break;
            }

            // Gate: ignore transcripts while search is in progress, calling is active, or call is complete/transferred
            if (['searching', 'calling', 'transferred', 'complete'].includes(state.stage)) {
              console.log(`[webhooks] Ignoring transcription — stage is ${state.stage}`);
              break;
            }

            // Reset silence timer on every transcript
            resetSilenceTimer(callControlId);

            // Gate: discard transcripts during greeting TTS playback
            if (state.stage === 'greeting') {
              console.log(`[webhooks] Discarding transcript during greeting stage`);
              break;
            }

            // STAGE: name_capture
            if (state.stage === 'name_capture') {
              const words = transcript.trim().split(/\s+/);
              const callerName = words.length > 0 ? words[words.length - 1] : undefined;
              const cleanName = callerName?.replace(/[^a-zA-Z'-]/g, '') || undefined;
              updateCall(callControlId, {
                callerName: cleanName,
                stage: 'intake',
              });
              const greetingStep2 = cleanName
                ? GREETING_STEP_2(cleanName)
                : GREETING_STEP_2_FALLBACK;
              await speak(callControlId, greetingStep2);
              console.log(`[webhooks] Name captured: ${cleanName ?? 'fallback'}, advancing to intake`);
              break;
            }

            // STAGE: intake — extract intent
            if (state.stage === 'intake') {
              const extractedIntent = extractIntent(transcript);
              const mergedIntent = {
                ...state.intent,
                ...(extractedIntent.serviceType !== undefined ? { serviceType: extractedIntent.serviceType } : {}),
                ...(extractedIntent.location !== undefined ? { location: extractedIntent.location } : {}),
                ...(extractedIntent.urgency !== undefined ? { urgency: extractedIntent.urgency } : {}),
              };
              updateCall(callControlId, { intent: mergedIntent });

              if (isIntentComplete({ serviceType: mergedIntent.serviceType, location: mergedIntent.location })) {
                // Intent complete — confirm and advance to consent
                const confirmation = `Got it — a ${mergedIntent.serviceType} in ${mergedIntent.location}.`;
                await speak(callControlId, confirmation);
                updateCall(callControlId, { stage: 'consent' });
                // Sequential speaks — Telnyx queues them
                await speak(callControlId, TCPA_CONSENT_ASK);
                console.log(`[webhooks] Intent complete, asking for consent`);
              } else if (state.clarificationTurns === 0) {
                const disambig = getDisambiguationPrompt('en');
                await speak(callControlId, disambig);
                updateCall(callControlId, { clarificationTurns: state.clarificationTurns + 1 });
                console.log(`[webhooks] Asking clarification #1`);
              } else if (state.clarificationTurns === 1) {
                // Second clarification — OPEN-ENDED ONLY per user decision.
                // Do NOT proactively suggest categories (no "For example, plumbing, electrical...").
                await speak(callControlId, "Could you tell me a bit more about what you need?");
                updateCall(callControlId, { clarificationTurns: state.clarificationTurns + 1 });
                console.log(`[webhooks] Asking clarification #2`);
              } else if (shouldAdvancePastClarification(state)) {
                // Max clarifications reached — broad search + narrate per user decision.
                // Do NOT name a specific service type. Do NOT hedge with "if that's not right".
                const location = state.intent.location ?? 'your area';
                await speak(callControlId, `I'll search for general home repair services near ${location} and we'll narrow it down from what I find.`);
                updateCall(callControlId, { stage: 'consent' });
                await speak(callControlId, TCPA_CONSENT_ASK);
                console.log(`[webhooks] Max clarifications, broad search to consent`);
              }
              break;
            }

            // STAGE: consent — parse yes/no
            if (state.stage === 'consent') {
              const CONSENT_YES = /\b(yes|sure|ok|okay|go ahead|absolutely|please|that's fine|sounds good)\b/i;
              const CONSENT_NO = /\b(no|nope|don't|do not|skip|pass)\b/i;

              let consent: boolean;
              if (CONSENT_YES.test(transcript)) {
                consent = true;
              } else if (CONSENT_NO.test(transcript)) {
                consent = false;
              } else {
                consent = false; // ambiguous -> conservative default
              }

              updateCall(callControlId, {
                smsConsent: consent,
                consentTimestamp: new Date().toISOString(),
                consentMethod: 'verbal',
                stage: 'searching',
              });

              if (!consent) {
                await speak(callControlId, TCPA_CONSENT_DECLINE_ACK);
              } else {
                await speak(callControlId, "Great, I'll send that over.");
              }

              const lang = state.language ?? 'en';
              const sType = state.intent?.serviceType ?? 'service';
              const loc = state.intent?.location ?? 'your area';

              // Build speak function for filler loop
              const speakFn = async (text: string) => speak(callControlId, text);

              // Speak context-specific searching filler immediately
              const searchFiller = buildSearchingFiller(sType, loc, lang);
              await speakFn(searchFiller);

              // Start generic filler loop concurrently with search
              const fillerHandle = startFillerLoop(speakFn, lang);
              _fillerLoops.set(callControlId, fillerHandle);
              console.log(`[webhooks] Consent=${consent}, starting filler loop and search`);

              try {
                const result = await searchProviders({
                  service_type: sType,
                  location: loc,
                  urgency: state.intent?.urgency,
                  callControlId,
                });

                // Stop filler BEFORE narrating results
                stopFillerLoop(fillerHandle);
                _fillerLoops.delete(callControlId);

                if (result.providers.length > 0) {
                  const top = result.providers[0];
                  const narration = buildResultNarration(
                    result.count,
                    sType,
                    loc,
                    { name: top.name, rating: top.rating, distanceKm: top.distanceKm },
                    lang,
                  );
                  await speakFn(narration);
                  updateCall(callControlId, { providers: result.providers });
                  // Start outbound cascade — agent will dial providers sequentially
                  await startOutboundCascade(callControlId);
                  console.log(`[webhooks] Narrated ${result.count} results, starting outbound cascade`);
                } else {
                  const noResults = buildNoResultsNarration(sType, loc, lang);
                  await speakFn(noResults);
                  updateCall(callControlId, { stage: 'complete', providers: [] });
                  console.log('[webhooks] No providers found');
                }
              } catch (err) {
                stopFillerLoop(fillerHandle);
                _fillerLoops.delete(callControlId);
                console.error('[webhooks] Search failed:', err);
                const errorMsg = lang === 'fr'
                  ? "Desole, j'ai eu un probleme avec la recherche. Veuillez reessayer plus tard."
                  : "Sorry, I had trouble searching for providers. Please try again.";
                await speakFn(errorMsg);
                updateCall(callControlId, { stage: 'complete' });
              }
              break;
            }

            console.log(`[webhooks] Transcription processed for ${callControlId}, stage=${state.stage}`);
            break;
          }

          case 'call.machine.detection.ended': {
            const result = (payload as any).result;  // 'human' | 'machine' | 'not_sure'
            const clientState = decodeClientState((payload as any).client_state);
            if (clientState.stage === 'provider-dial') {
              await handleAmdResult(callControlId, result, clientState);
            }
            console.log(`[webhooks] AMD result: ${result} for ${callControlId}`);
            break;
          }

          case 'call.bridged': {
            // XFER-03: Bridge established — mark as transferred
            // call.bridged fires on BOTH legs — only process the provider leg (has client_state with stage=provider-dial)
            const bridgedClientState = decodeClientState((payload as any).client_state);
            if (bridgedClientState.stage === 'provider-dial') {
              const userCcid = bridgedClientState.userCallControlId as string;
              const providerName = bridgedClientState.providerName as string;
              updateCall(userCcid, { stage: 'transferred' });

              // XFER-03: Speak goodbye to both parties on the user leg (both hear it via bridge)
              try {
                await speak(userCcid,
                  `Alright, you're connected! I'll leave you two to it — good luck!`
                );
              } catch { /* call may have ended */ }

              console.log(`[webhooks] Bridge established: user ${userCcid} <-> provider ${providerName}, stage=transferred`);
            }
            // Ignore user-leg call.bridged event (client_state has { source: 'openclaw' })
            break;
          }

          case 'call.hangup': {
            const hangupDirection = (payload as any).direction;
            const hangupCause = (payload as any).hangup_cause ?? 'unknown';

            // Handle outbound provider leg hangup
            if (hangupDirection === 'outgoing') {
              const clientState = decodeClientState((payload as any).client_state);
              if (clientState.stage === 'provider-dial') {
                await handleProviderHangup(callControlId, hangupCause, clientState);
              }
              console.log(`[webhooks] Outbound leg hangup: cause=${hangupCause}, id=${callControlId}`);
              break;
            }

            // Inbound caller hangup — stop filler loop if active
            const fillerHandle = _fillerLoops.get(callControlId);
            if (fillerHandle) {
              fillerHandle.stop();
              _fillerLoops.delete(callControlId);
            }
            stopNarrationTimer(callControlId);

            const state = getCall(callControlId);
            if (state?.silenceNudgeTimer) clearTimeout(state.silenceNudgeTimer);

            // Persist call history to Supabase before clearing in-memory state
            if (state) {
              const adminUserId = process.env.ADMIN_USER_ID;
              if (!adminUserId) {
                console.warn(`[webhooks] ADMIN_USER_ID not set — call history for ${callControlId} will have no owner`);
              }

              // Only include providers that were actually contacted (stage must be 'calling', 'transferred', or 'complete')
              const wasDialing = ['calling', 'transferred', 'complete'].includes(state.stage);
              const contactedProviders = wasDialing
                ? state.providers
                    .slice(0, state.currentProviderIndex + 1)
                    .map((p) => ({ name: p.name, phone: p.phone, status: 'contacted' as const }))
                : [];

              // Determine call outcome status
              let callStatus: 'completed' | 'no_match' | 'abandoned';
              if (state.stage === 'complete' || state.stage === 'transferred') {
                callStatus = 'completed';
              } else if (wasDialing && state.currentProviderIndex >= state.providers.length - 1) {
                callStatus = 'no_match';
              } else {
                callStatus = 'abandoned';
              }

              try {
                await insertCallHistory({
                  user_id: adminUserId ?? 'unknown',
                  caller_phone: state.callerPhone,
                  service_type: state.intent.serviceType ?? null,
                  location: state.intent.location ?? null,
                  urgency: state.intent.urgency ?? null,
                  providers_contacted: contactedProviders,
                  connected_provider:
                    (state.stage === 'complete' || state.stage === 'transferred')
                      ? (state.providers[state.currentProviderIndex]?.name ?? null)
                      : null,
                  status: callStatus,
                  started_at: state.startedAt.toISOString(),
                  ended_at: new Date().toISOString(),
                });
                console.log(`[webhooks] Call history persisted for ${callControlId}`);
              } catch (err) {
                console.error(`[webhooks] Failed to write call history for ${callControlId}:`, err);
              }

              // Send recap SMS if consent given and providers were contacted
              if (state.smsConsent === true && wasDialing) {
                await sendRecapSms(state, callStatus);
              }
            }

            // If user hangs up during an active transfer, apologize to provider and hang up their leg
            if (state && (state.stage === 'calling' || state.pendingBridge) && state.providerCallControlId) {
              try {
                await getTelnyxClient().calls.actions.speak(state.providerCallControlId, {
                  payload: 'Sorry, the caller disconnected. Have a good day!',
                  voice: TELNYX_VOICE_STRING,
                  voice_settings: TELNYX_VOICE_SETTINGS,
                });
                // Give TTS time to play before hanging up
                setTimeout(async () => {
                  try {
                    await getTelnyxClient().calls.actions.hangup(state.providerCallControlId!, {});
                  } catch { /* provider may have already hung up */ }
                }, 3000);
              } catch { /* provider leg may have already ended */ }
            }

            if (state && state.stage !== 'complete' && state.stage !== 'transferred') {
              setTimeout(() => endCall(callControlId), SESSION_PERSIST_MS);
              console.log(`[webhooks] Unexpected disconnect, session persists 30 min`);
            } else {
              endCall(callControlId);
              console.log(`[webhooks] Call completed and cleaned up ${callControlId}`);
            }
            break;
          }

          default: {
            console.log(`[webhooks] Unhandled event: ${eventType}`);
            break;
          }
        }
      } catch (err) {
        const event = req.telnyxEvent;
        const eventType = event?.data?.event_type ?? 'unknown';
        const callControlId: string = (event?.data?.payload as any)?.call_control_id ?? '';
        console.error(`[webhooks] Error processing ${eventType} for call ${callControlId}:`, err);
      }
    });
  }
);
