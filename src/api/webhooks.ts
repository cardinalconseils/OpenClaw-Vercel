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
import { searchProviders } from '../lib/tools/handlers/search.js';
import { buildResultNarration, buildNoResultsNarration, buildSearchingFiller } from '../lib/voice/narration.js';
import {
  extractIntent,
  isIntentComplete,
  getDisambiguationPrompt,
} from '../lib/ai/intent-extractor.js';

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
            console.log(`[webhooks] Answering call ${callControlId}`);
            await getTelnyxClient().calls.actions.answer(callControlId, {
              client_state: Buffer.from(
                JSON.stringify({ source: 'openclaw' })
              ).toString('base64'),
            });
            break;
          }

          case 'call.answered': {
            const from: string = (payload as any).from ?? 'unknown';
            initCall(callControlId, from);
            // Greeting + transcription must fire immediately — no intermediate awaits
            await speak(callControlId, GREETING_STEP_1);
            await getTelnyxClient().calls.actions.startTranscription(callControlId, TELNYX_STT_CONFIG);
            console.log(`[webhooks] Greeting + transcription started for ${callControlId}`);
            break;
          }

          case 'call.speak.ended': {
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

            const state = getCall(callControlId);
            if (!state) {
              console.warn(`[webhooks] call.transcription: no state for ${callControlId}`);
              break;
            }

            // Gate: ignore transcripts while search is in progress or call is complete
            if (state.stage === 'searching' || state.stage === 'complete') {
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
                  updateCall(callControlId, { stage: 'complete' });
                  console.log(`[webhooks] Narrated ${result.count} results, top: ${top.name}`);
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

          case 'call.hangup': {
            // Stop filler loop if active
            const fillerHandle = _fillerLoops.get(callControlId);
            if (fillerHandle) {
              fillerHandle.stop();
              _fillerLoops.delete(callControlId);
            }

            const state = getCall(callControlId);
            if (state?.silenceNudgeTimer) clearTimeout(state.silenceNudgeTimer);
            if (state && state.stage !== 'complete') {
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
