import { Router } from 'express';
import express from 'express';
import { telnyxWebhookVerifier } from '../lib/voice/webhook-verify.js';
import {
  initCall,
  getCall,
  updateCall,
  endCall,
  detectLanguage,
  shouldAdvancePastClarification,
} from '../lib/voice/call-state.js';
import { GREETING } from '../lib/voice/greeting.js';
import { getFillerPhrase } from '../lib/voice/filler.js';
import { ELEVENLABS_VOICE_STRING, SESSION_PERSIST_MS } from '../lib/voice/voice-config.js';
import { getTelnyxClient } from '../lib/voice/telnyx-client.js';
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
            await getTelnyxClient().calls.actions.speak(callControlId, {
              payload: GREETING.en,  // Always English on first contact — language detected after first transcript
              voice: ELEVENLABS_VOICE_STRING,
            });
            console.log(`[webhooks] Greeting emitted for ${callControlId}`);
            break;
          }

          case 'call.transcription': {
            const transcriptionData = (payload as any).transcription_data ?? {};
            const transcript: string = transcriptionData.transcript ?? '';
            const words: Array<{ word: string; language: string }> =
              transcriptionData.words ?? [];

            const state = getCall(callControlId);
            if (!state) {
              console.warn(
                `[webhooks] call.transcription: no state found for ${callControlId}`
              );
              break;
            }

            // Language detection on first utterance (stage is intake, language still default 'en')
            let currentState = state;
            if (currentState.stage === 'intake' && words.length > 0) {
              const detectedLanguage = detectLanguage(words);
              updateCall(callControlId, { language: detectedLanguage });
              currentState = getCall(callControlId)!;
            }

            // Intent extraction
            const extractedIntent = extractIntent(transcript);

            // Merge extracted intent into state (only overwrite defined fields)
            const mergedIntent: typeof currentState.intent = {
              ...currentState.intent,
              ...(extractedIntent.serviceType !== undefined
                ? { serviceType: extractedIntent.serviceType }
                : {}),
              ...(extractedIntent.location !== undefined
                ? { location: extractedIntent.location }
                : {}),
              ...(extractedIntent.urgency !== undefined
                ? { urgency: extractedIntent.urgency }
                : {}),
            };
            updateCall(callControlId, { intent: mergedIntent });
            currentState = getCall(callControlId)!;

            if (isIntentComplete({ serviceType: mergedIntent.serviceType, location: mergedIntent.location })) {
              // Intent complete — advance to searching
              const lang = currentState.language;
              const confirmationText =
                lang === 'fr'
                  ? `Compris — un ${mergedIntent.serviceType ?? 'service'} à ${mergedIntent.location ?? 'votre emplacement'}. Laissez-moi trouver les meilleures options.`
                  : `Got it — a ${mergedIntent.serviceType ?? 'service'} in ${mergedIntent.location ?? 'your area'}. Let me find the best options.`;
              console.log(`[webhooks] Intent complete, advancing to searching`);
              await getTelnyxClient().calls.actions.speak(callControlId, {
                payload: confirmationText,
                voice: ELEVENLABS_VOICE_STRING,
              });
              updateCall(callControlId, { stage: 'searching' });
            } else if (currentState.clarificationTurns === 0) {
              // First clarification opportunity — ask disambiguation
              const disambig = getDisambiguationPrompt(currentState.language);
              await getTelnyxClient().calls.actions.speak(callControlId, {
                payload: disambig,
                voice: ELEVENLABS_VOICE_STRING,
              });
              updateCall(callControlId, {
                clarificationTurns: currentState.clarificationTurns + 1,
              });
              console.log(`[webhooks] Asking clarification question`);
            } else if (shouldAdvancePastClarification(currentState)) {
              // Max clarifications reached — force advance with partial intent
              const filler = getFillerPhrase(currentState.language);
              await getTelnyxClient().calls.actions.speak(callControlId, {
                payload: filler,
                voice: ELEVENLABS_VOICE_STRING,
              });
              updateCall(callControlId, { stage: 'searching' });
              console.log(
                `[webhooks] Max clarifications reached, advancing with partial intent`
              );
            }

            console.log(
              `[webhooks] Transcription processed for ${callControlId}`
            );
            break;
          }

          case 'call.speak.ended': {
            const state = getCall(callControlId);
            if (state?.stage === 'greeting') {
              updateCall(callControlId, { stage: 'intake' });
            }
            console.log(
              `[webhooks] Speak ended for ${callControlId}, stage: ${state?.stage}`
            );
            break;
          }

          case 'call.hangup': {
            const state = getCall(callControlId);
            if (state && state.stage !== 'complete') {
              // Unexpected disconnect — delay cleanup to allow reconnect
              setTimeout(() => endCall(callControlId), SESSION_PERSIST_MS);
              console.log(
                `[webhooks] Unexpected disconnect for ${callControlId}, session persists for 30 min`
              );
            } else {
              // Normal completion or no state
              endCall(callControlId);
              console.log(
                `[webhooks] Call completed and cleaned up ${callControlId}`
              );
            }
            break;
          }

          default: {
            console.log(`[webhooks] Unhandled event: ${eventType}`);
            break;
          }
        }
      } catch (err) {
        console.error('[webhooks] Error processing event async:', err);
      }
    });
  }
);
