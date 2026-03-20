# Phase 2: Voice Conversation Core - Research

**Researched:** 2026-03-15 (updated — migrated from ClawdTalk/ElevenLabs/Deepgram to Telnyx-native)
**Domain:** Telnyx Call Control v2 native TTS and STT, call state machine, intent extraction, TCPA consent
**Confidence:** HIGH (SDK introspected from installed telnyx@6.13.0; codebase fully read)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Telnyx built-in TTS** — streaming speak commands via Call Control v2, not ElevenLabs
- **Telnyx built-in STT** — `startTranscription` with `Telnyx` engine (Whisper-based), not Deepgram
- **English only** — Canadian persona flavor baked into system prompt; no bilingual voice support in Phase 2
- Greeting flow: "Hi, I'm Murphy — an AI assistant from OpenClaw. Who am I speaking with?" -> [name] -> "Hey [name], what kind of service are you looking for?"
- Ask for caller's name in greeting; use it naturally throughout the call
- **Static filler phrase pool** — 15–20 pre-written phrases, zero LLM latency
- **Concurrent filler + tool calls** — TTS filler fires at same time as the API call
- **TCPA consent capture** — ask after intent capture, before search; store `sms_consent`, `consent_timestamp`, `consent_method`
- **2-turn clarification max** — then transparent best-guess; advance to searching
- Barge-in detection (Telnyx `InterruptionSettings`) — Murphy stops speaking when caller talks over him
- 8-second silence nudge: "Still there?" — two nudges before graceful hangup
- Urgency auto-detection from keywords (emergency, flooding, urgent → urgency=emergency, faster flow)
- Brief empathy + solve for frustrated callers
- Confirm-and-go: echo intent in one phrase ("Plumber in Montreal — searching now"), no "is that right?" wait
- Quick echo + go for intent readback after capture

### Claude's Discretion
- Exact Telnyx TTS voice selection (warm male from KokoroTTS or AWS Polly Neural)
- Speaking pace strategy (match caller vs. steady)
- Location detection approach (always ask vs. area code hint)
- Edge-case service request handling
- Multi-request call flow design
- Filler phrase pool content (15–20 phrases in Murphy's voice)
- Call state machine design and state transitions
- STT configuration (language model, silence detection thresholds)

### Deferred Ideas (OUT OF SCOPE)
- Bilingual French + English voice support (LANG-01/LANG-02, v2 requirements)
- Repeat caller recognition by name from call history database (requires POST-04 from Phase 6)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VOICE-01 | User calls Telnyx number and agent answers with a greeting | `call.answered` webhook triggers `calls.actions.speak` with hardcoded greeting; name-capture follow-up on `call.speak.ended` |
| VOICE-02 | Agent captures user intent from natural speech (service type, location, urgency) | `startTranscription` fires `call.transcription` webhooks; regex/keyword extractor parses transcript; TCPA consent captured before search |
| VOICE-03 | Agent asks smart clarifying questions when intent is ambiguous | Disambiguation prompt offered on first incomplete transcript; `clarificationTurns` counter enforces 2-turn max; then best-guess advance |
| VOICE-04 | Agent responds with sub-second perceived latency (streaming TTS) | Telnyx KokoroTTS native; filler fires concurrently with tool calls; no external TTS round-trip |
| VOICE-05 | Agent uses filler speech during tool calls to avoid dead air | Static pool of 15–20 phrases rotated round-robin; speak issued at same time as API call; 3–4s update cadence; 10s/20s escalation |
</phase_requirements>

---

## Summary

Phase 2 builds the live voice conversation pipeline on top of the Telnyx Call Control v2 SDK already installed (v6.13.0). The previous research was based on ClawdTalk + ElevenLabs + Deepgram — that entire stack has been replaced by Telnyx-native capabilities. The codebase already has significant Phase 2 work done: `call-state.ts`, `filler.ts`, `greeting.ts`, `intent-extractor.ts`, and the full webhook handler are implemented and tested (216 tests passing). However, several gaps exist between the current code and the updated CONTEXT.md requirements that the planner must close.

The primary technical change from the old research: `voice-config.ts` currently exports `ELEVENLABS_VOICE_STRING` and `DEEPGRAM_CONFIG`. Both must be replaced with Telnyx-native equivalents. For TTS, the correct format is `Telnyx.KokoroTTS.<voice_id>` with an optional `TelnyxVoiceSettings` for `voice_speed`. For STT, `calls.actions.startTranscription` with `transcription_engine: 'Telnyx'` and `transcription_engine_config: { transcription_model: 'openai/whisper-large-v3-turbo' }` fires `call.transcription` webhooks — exactly the event type the current webhook handler already processes.

The second major gap is conversation completeness: CONTEXT.md requires a two-step greeting (name capture then service question), TCPA consent capture before search, caller name stored in call state, 8-second silence detection, and a 15–20 phrase filler pool (currently only 4 per language). The planner must create tasks that close each of these specific gaps without disrupting the 216 passing tests.

**Primary recommendation:** Migrate `voice-config.ts` to Telnyx-native TTS/STT constants. Extend `CallState` with `callerName`, `smsConsent`, `consentTimestamp`, and `consentMethod`. Update the webhook handler to implement the two-step greeting flow, TCPA consent prompt, silence detection timers, and concurrent filler+tool pattern. Expand the filler pool to 15–20 English phrases. The core machinery (state machine, intent extraction, disambiguation, clarification limit) is already built and tested.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| telnyx | ^6.13.0 (installed) | Call Control v2 — answer, speak, startTranscription, stopTranscription, hangup | Already installed; entire voice stack flows through this SDK |
| Vitest | ^4.1.0 (installed) | Unit and integration tests | Project standard; 216 tests already passing |
| TypeScript | ^5.9.3 (installed) | Type safety | Project standard; strict mode |
| Zod | (installed) | Input validation for webhook payloads | Project standard |

### Telnyx TTS: Recommended Voice
| Option | Voice String | Character | Notes |
|--------|-------------|-----------|-------|
| **Telnyx KokoroTTS am_adam** | `Telnyx.KokoroTTS.am_adam` | General American male, warm, friendly | Zero external cost; confirmed in SDK type comments; best fit for Murphy's contractor-friend persona |
| AWS Polly Matthew Neural | `AWS.Polly.Matthew-Neural` | American male, professional | Fallback if KokoroTTS latency proves insufficient in testing |

**Voice decision (Claude's discretion):** Use `Telnyx.KokoroTTS.am_adam` as the default. It is listed in SDK docs as a valid Telnyx-native voice, carries zero third-party API dependency, and matches the "warm male" persona requirement. Adjust `voice_speed` to 0.95–1.0 via `TelnyxVoiceSettings` for natural pacing.

### Telnyx STT: Recommended Configuration
| Property | Value | Reason |
|----------|-------|--------|
| `transcription_engine` | `'Telnyx'` | Native; no external STT cost; Whisper-based |
| `transcription_model` | `'openai/whisper-large-v3-turbo'` | Multilingual, auto_detect capable; lower latency than whisper-tiny on quality |
| `language` | `'en'` (for Phase 2) | English-only locked; `auto_detect` available for future bilingual |
| `transcription_tracks` | `'inbound'` | Transcribe the caller's leg only |

### No New Packages Required
Phase 2 requires zero new npm dependencies. All Telnyx Call Control capabilities are in the already-installed SDK.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── api/
│   └── webhooks.ts              # Existing — extend with new event handlers and conversation flow
├── lib/
│   ├── voice/
│   │   ├── telnyx-client.ts     # Existing — no changes
│   │   ├── webhook-verify.ts    # Existing — no changes
│   │   ├── call-state.ts        # Existing — add callerName, smsConsent, consentTimestamp, consentMethod
│   │   ├── greeting.ts          # Existing — update to two-step flow (name ask first)
│   │   ├── filler.ts            # Existing — expand pool to 15-20 English phrases
│   │   └── voice-config.ts      # Existing — replace ElevenLabs/Deepgram with Telnyx-native constants
│   └── ai/
│       ├── intent-extractor.ts  # Existing — no changes needed for Phase 2
│       ├── orchestrator.ts      # Existing — no changes needed for Phase 2
│       └── prompts/
│           ├── murphy-system.ts # Existing — update greeting flow, add TCPA consent phrasing
│           └── voice-modifiers.ts # Existing — no changes
tests/
├── lib/voice/
│   ├── call-state.test.ts       # Existing — add tests for new CallState fields
│   ├── filler.test.ts           # Existing — verify >= 15 phrases, round-robin rotation
│   └── greeting.test.ts        # Existing — verify two-step greeting structure
└── api/
    └── webhooks.test.ts         # Existing — add tests for consent flow, silence detection, concurrent filler
```

### Pattern 1: Telnyx Call Lifecycle — Full Event Sequence
**What:** Each Telnyx Call Control webhook event maps to a specific handler action. The webhook handler already processes all key events but needs conversation logic enhancements.

**Current vs Required event handling:**
```
call.initiated  → answer the call [DONE]
call.answered   → initCall() + speak(GREETING_STEP_1: name ask) + startTranscription() [PARTIAL — needs two-step greeting + startTranscription]
call.speak.ended → advance stage (greeting→name_capture) and start listening [PARTIAL — needs stage awareness]
call.transcription → extract intent, track consent, dispatch filler+tool concurrently [PARTIAL — needs TCPA consent, concurrent filler]
call.hangup     → cleanup with session-persist timer [DONE]
```

**Telnyx-native speak call:**
```typescript
// Source: telnyx@6.13.0 SDK — calls.actions.speak signature
// verified from /node_modules/telnyx/resources/calls/actions.d.ts
await getTelnyxClient().calls.actions.speak(callControlId, {
  payload: "Hi, I'm Murphy — an AI assistant from OpenClaw. Who am I speaking with?",
  voice: 'Telnyx.KokoroTTS.am_adam',
  voice_settings: { type: 'telnyx', voice_speed: 0.95 },
  language: 'en-US',
});
```

### Pattern 2: Two-Step Greeting Flow
**What:** CONTEXT.md requires asking the caller's name before the service question. This requires two sequential speak commands and a name-capture stage.

**State machine stages:**
```
greeting → name_capture → intake → consent → searching → complete
```

**Flow:**
1. `call.answered`: Speak GREETING_STEP_1 ("Hi, I'm Murphy... Who am I speaking with?"), start transcription, stage = `greeting`
2. `call.speak.ended` (stage=greeting): advance stage to `name_capture`
3. `call.transcription` (stage=name_capture): extract caller name from transcript, store in state, speak GREETING_STEP_2 ("Hey [name], what kind of service are you looking for?"), stage = `intake`
4. `call.transcription` (stage=intake): extract intent; on complete intent → speak confirmation → ask TCPA consent → stage = `consent`
5. `call.transcription` (stage=consent): parse yes/no → store consent → speak filler → trigger search concurrently → stage = `searching`

**Name extraction (simple):** Take the last word of the first transcript during `name_capture` stage. No LLM call. Fallback: "there" if extraction fails ("Hey there, what kind of service...").

### Pattern 3: Telnyx Native STT — startTranscription
**What:** `calls.actions.startTranscription` begins real-time transcription. The `call.transcription` webhook fires for each recognized utterance. Fires `call.transcription` events that the handler already processes.

**Verified from SDK (telnyx@6.13.0):**
```typescript
// Source: /node_modules/telnyx/resources/calls/actions.d.ts
// ActionStartTranscriptionParams interface
await getTelnyxClient().calls.actions.startTranscription(callControlId, {
  transcription_engine: 'Telnyx',
  transcription_engine_config: {
    transcription_engine: 'Telnyx',
    transcription_model: 'openai/whisper-large-v3-turbo',
    language: 'en',
  },
  transcription_tracks: 'inbound',
});
```

**When to call startTranscription:** Immediately after `calls.actions.speak` on `call.answered`. This ensures transcription is running before the greeting finishes and is ready for the caller's first response.

**Note:** The current webhook handler processes `call.transcription` events with a `transcriptionData.words` structure that includes per-word `language` fields — this was designed for Deepgram Nova-3's multilingual word tagging. The Telnyx Whisper engine does NOT return per-word language tags. The `detectLanguage(words)` function in `call-state.ts` must be updated to handle empty/missing `words` array gracefully — no language detection in Phase 2 (English only). The doc comment referencing "Deepgram Nova-3" must be updated.

### Pattern 4: Concurrent Filler + Tool Call
**What:** CONTEXT.md requires filler TTS fires at the same time as the API call — not before and not after. The current code calls `speak(filler)` then advances stage, but the actual tool call hasn't been triggered yet (it's Phase 3 scope). The pattern must be established correctly for Phase 3 to hook into.

**Implementation pattern:**
```typescript
// Source: CONTEXT.md decision — concurrent filler + tool call
// Both promises launch simultaneously; we don't await the tool call here
const [, /* tool starts async */] = await Promise.allSettled([
  getTelnyxClient().calls.actions.speak(callControlId, {
    payload: getFillerPhrase('en'),
    voice: 'Telnyx.KokoroTTS.am_adam',
    voice_settings: { type: 'telnyx', voice_speed: 0.95 },
  }),
  // Phase 3 will add: executeSearchTool(callControlId, intent)
  Promise.resolve(), // placeholder until Phase 3 wires the actual tool
]);
```

**Why concurrent matters:** A sequential speak-then-tool pattern adds ~300–800ms of TTS transmission delay before the API call starts. Concurrent launch hides that latency entirely.

### Pattern 5: TCPA Consent Capture
**What:** After intent is confirmed, before triggering search, Murphy asks for SMS consent. Response is stored in CallState.

**Consent ask (English):**
> "Before I search, mind if I send you a text recap after we're done? It'll have the provider's info handy."

**Consent response parsing (no LLM — regex/keyword):**
- Yes pattern: `/\b(yes|sure|ok|okay|go ahead|absolutely|please|that's fine|sounds good)\b/i`
- No pattern: `/\b(no|nope|don't|do not|skip|pass|that's okay)\b/i`
- Ambiguous: default to `false` (conservative)

**CallState additions:**
```typescript
export interface CallState {
  // ...existing fields...
  callerName: string | undefined;     // extracted from name_capture stage
  smsConsent: boolean | undefined;    // undefined until consent stage completes
  consentTimestamp: string | undefined; // ISO string when consent captured
  consentMethod: 'verbal' | undefined; // always 'verbal' for Phase 2
}
```

**Storage note:** Stored in-memory CallState only in Phase 2. Phase 6 (post-call) will persist to Supabase when POST-04 is implemented.

### Pattern 6: Silence Detection — 8s Nudge Timer
**What:** CONTEXT.md requires an 8-second nudge ("Still there?") after caller silence. Two nudges before graceful hangup.

**Implementation:** Silence detection cannot rely on a Telnyx webhook — there is no `call.silence` event in the Telnyx SDK (confirmed by inspecting all event_type values in webhooks.d.ts). Use a per-call `setTimeout` timer reset on every `call.transcription` event.

```typescript
// Per-call silence timers — stored in CallState
silenceNudgeTimer: ReturnType<typeof setTimeout> | undefined;
silenceNudgeCount: number; // 0, 1, or 2 (hangup at 2)
```

**Timer logic:**
1. On each `call.transcription`: clear existing `silenceNudgeTimer`, reset `silenceNudgeCount` to 0, start new 8s timer
2. On 8s timer fire: if `nudgeCount < 2` → speak "Still there?" → increment `nudgeCount` → restart 8s timer
3. On 3rd timer fire (nudgeCount=2): speak graceful closing → `calls.actions.hangup` → `endCall()`

**Caveat:** `setTimeout` references must be stored outside the webhook handler closure. The CallState Map is the right place. Timers must be cleared in `endCall()` to avoid dangling callbacks after hangup.

### Pattern 7: Expanded Filler Phrase Pool
**What:** CONTEXT.md requires 15–20 English phrases with round-robin rotation (already chosen in STATE.md). Current pool has only 4 phrases.

**Recommended pool (Murphy's voice, warm contractor-friend energy):**
```typescript
const FILLERS_EN: string[] = [
  "Let me look that up for you.",
  "One moment while I search.",
  "Give me just a second.",
  "Searching for the best options now.",
  "Let me check on that for you.",
  "Hang tight — I'm on it.",
  "Just a moment.",
  "Looking into that right now.",
  "I'll find someone for you.",
  "Bear with me for a second.",
  "Checking that out for you now.",
  "Give me a moment to look.",
  "Almost there — searching now.",
  "Let me track that down for you.",
  "On it — just a sec.",
  "Finding the right people for that.",
  "Searching a few spots now.",
  "Let me see what I can find.",
];
```

**Escalation phrases (after 10s / 20s of waiting):**
```typescript
const FILLER_ESCALATION_10S = "Taking a bit longer than usual — still on it.";
const FILLER_ESCALATION_20S = "Still working on it. If you'd prefer, I can try a different approach.";
```

### Anti-Patterns to Avoid
- **Using ELEVENLABS_VOICE_STRING in speak commands:** The constant exists in voice-config.ts but must be removed. Telnyx does not accept raw ElevenLabs voice IDs without an api_key_ref — and Phase 2 uses Telnyx-native TTS, not ElevenLabs.
- **Awaiting filler before tool call:** The filler and tool call must fire concurrently via `Promise.allSettled` or `Promise.all`. A sequential await pattern defeats the dead-air benefit.
- **Language detection with word.language on Telnyx Whisper transcripts:** Telnyx Whisper does not tag per-word language. `detectLanguage()` must be bypassed or stubbed for Phase 2 (English-only locked).
- **Calling startTranscription more than once per call:** Transcription runs for the entire call lifecycle; calling it again on each speak.ended creates duplicate transcript events.
- **Storing silence timers outside CallState:** If the timer reference is lost, it cannot be cleared on hangup, causing timer callbacks to fire against deleted call state.
- **Generating TCPA consent wording with the LLM:** TCPA requires documented, consistent consent language. Use a hardcoded consent phrase, not LLM output.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| STT streaming | Custom WebSocket to Deepgram | `calls.actions.startTranscription` | Telnyx manages the stream lifecycle, fires `call.transcription` webhooks; already working in webhook handler |
| TTS with telephony codec conversion | Custom PCM pipeline | `calls.actions.speak` with `Telnyx.KokoroTTS.am_adam` | Telnyx handles 8kHz PCMU encoding; no codec work needed |
| Barge-in detection | VAD loop | `InterruptionSettings.enable: true` in Telnyx AI config | SDK provides this natively; confirmed in SDK type definition |
| Silence detection | Poll audio stream | `setTimeout` reset on each `call.transcription` | No Telnyx silence webhook exists; timer-based is the correct pattern |
| Name extraction NLP | LLM call for name parsing | Last word of first `name_capture` transcript | Over-engineering; first utterance to "who am I speaking with?" is almost always just a name |

**Key insight:** Phase 2 is wiring and configuration work, not infrastructure building. The Telnyx SDK handles all telephony complexity below the webhook layer.

---

## Common Pitfalls

### Pitfall 1: voice-config.ts Constants Still Reference ElevenLabs/Deepgram
**What goes wrong:** Webhooks handler still passes `ELEVENLABS_VOICE_STRING` to `calls.actions.speak`. Telnyx rejects the call because no ElevenLabs api_key_ref is configured.
**Why it happens:** voice-config.ts exports `ELEVENLABS_VOICE_STRING` and all speak commands in webhooks.ts reference it. Tests mock the speak call so they pass even though the production value is wrong.
**How to avoid:** Replace with `TELNYX_VOICE_STRING = 'Telnyx.KokoroTTS.am_adam'` in voice-config.ts. Update all 4 speak call sites in webhooks.ts.
**Warning signs:** Real call connects but TTS fails silently; Telnyx API returns 422 on speak command.

### Pitfall 2: call.transcription Words Array Empty on Telnyx Whisper
**What goes wrong:** `detectLanguage(words)` receives an empty array or words without a `language` property — Telnyx Whisper doesn't tag per-word language like Deepgram Nova-3.
**Why it happens:** `call-state.ts` `detectLanguage` was written for Deepgram's word structure. Telnyx `call.transcription` payload structure is `{ transcription_data: { transcript: string } }` — no `words` array.
**How to avoid:** Phase 2 is English-only. Remove the language detection call from the `call.transcription` handler. Update the `detectLanguage` doc comment to remove the Deepgram reference. Keep the function for future use.
**Warning signs:** `detectLanguage` called with empty array; TypeScript errors on `words` access in transcript payload.

### Pitfall 3: Two-Step Greeting Race Condition
**What goes wrong:** `call.transcription` fires during the greeting TTS playback (before the name-capture stage is set). The handler processes a partial STT pickup as intent, bypassing the name-capture flow.
**Why it happens:** Telnyx begins transcription immediately after `startTranscription` is called, including any speech that overlaps with TTS playback.
**How to avoid:** Gate transcript processing by `stage`. On `call.transcription`, if `stage === 'greeting'` → discard transcript. Only process transcripts when `stage === 'name_capture'` or later.
**Warning signs:** Caller's name is never captured; Murphy jumps to "what service are you looking for?" immediately without asking the name.

### Pitfall 4: Dangling Silence Timer After Hangup
**What goes wrong:** Caller hangs up, `endCall()` clears the Map entry, but the 8s silence timer fires 3 seconds later and tries to speak on a dead call. This throws a 400/404 from Telnyx and logs an error on every call.
**Why it happens:** `setTimeout` callback retains a closure reference to `callControlId` and calls `getTelnyxClient().calls.actions.speak()` after the call has ended.
**How to avoid:** Store `silenceNudgeTimer` in `CallState`. In `endCall()`, clear the timer before deleting the Map entry. Pattern: `const state = _calls.get(id); if (state?.silenceNudgeTimer) clearTimeout(state.silenceNudgeTimer); _calls.delete(id);`
**Warning signs:** `[webhooks] Error processing event async` logs appearing ~8 seconds after `call.hangup`; Telnyx 404 errors in log.

### Pitfall 5: Consent Capture Stage Skipped When Intent is Ambiguous
**What goes wrong:** After two clarification attempts, the code forces stage to `searching` without going through `consent` stage first, violating TCPA requirements.
**Why it happens:** The current `shouldAdvancePastClarification` path directly sets `stage: 'searching'` without inserting a `consent` stage.
**How to avoid:** The clarification bypass must set `stage: 'consent'` not `stage: 'searching'`. TCPA consent must always be captured before search, regardless of how intent was obtained.
**Warning signs:** SMS recap sent to callers who never gave consent; `smsConsent` field is `undefined` when Phase 6 post-call code tries to read it.

### Pitfall 6: Greeting Timing — Speak Command Delay
**What goes wrong:** Caller hears silence for 2–3 seconds after call connects. VOICE-01 success criteria requires greeting within 2 seconds.
**Why it happens:** The speak command is issued in `call.answered` handler, which is processed asynchronously via `setImmediate`. The processing delay plus Telnyx speak API call latency can exceed 2 seconds on cold starts.
**How to avoid:** Keep `setImmediate` for non-blocking ACK but ensure no unnecessary awaits before the speak command. The first thing in the `call.answered` branch must be `initCall()` + `speak(greeting)` + `startTranscription()` with no intermediate async operations.
**Warning signs:** Manual testing shows perceptible silence before "Hi, I'm Murphy..."

---

## Code Examples

Verified patterns from telnyx@6.13.0 SDK introspection:

### Telnyx Native TTS — speak with KokoroTTS
```typescript
// Source: /node_modules/telnyx/resources/calls/actions.d.ts — ActionSpeakParams
// voice format: "Telnyx.<model_id>.<voice_id>"
// voice_settings type: 'telnyx' enables voice_speed param (0.1 to 2.0)
await getTelnyxClient().calls.actions.speak(callControlId, {
  payload: "Hi, I'm Murphy — an AI assistant from OpenClaw. Who am I speaking with?",
  voice: 'Telnyx.KokoroTTS.am_adam',
  voice_settings: { type: 'telnyx', voice_speed: 0.95 },
});
```

### Telnyx Native STT — startTranscription
```typescript
// Source: /node_modules/telnyx/resources/calls/actions.d.ts — ActionStartTranscriptionParams
// Fires call.transcription webhooks for each utterance
// transcription_tracks: 'inbound' transcribes caller leg only
await getTelnyxClient().calls.actions.startTranscription(callControlId, {
  transcription_engine: 'Telnyx',
  transcription_engine_config: {
    transcription_engine: 'Telnyx',
    transcription_model: 'openai/whisper-large-v3-turbo',
    language: 'en',
  },
  transcription_tracks: 'inbound',
});
```

### Updated CallState with TCPA Consent Fields
```typescript
// src/lib/voice/call-state.ts — extend existing interface
export interface CallState {
  callControlId: string;
  callerPhone: string;
  callerName: string | undefined;          // NEW — captured in name_capture stage
  language: 'en' | 'fr';
  stage: 'greeting' | 'name_capture' | 'intake' | 'consent' | 'searching' | 'complete'; // NEW stages
  intent: Partial<{ serviceType: string; location: string; urgency: string }>;
  clarificationTurns: number;
  smsConsent: boolean | undefined;         // NEW — TCPA
  consentTimestamp: string | undefined;    // NEW — TCPA
  consentMethod: 'verbal' | undefined;     // NEW — TCPA
  silenceNudgeTimer: ReturnType<typeof setTimeout> | undefined; // NEW — silence detection
  silenceNudgeCount: number;               // NEW — 0, 1, or 2
  startedAt: Date;
}
```

### Updated voice-config.ts — Telnyx Native Constants
```typescript
// src/lib/voice/voice-config.ts — replace ElevenLabs/Deepgram constants
/** Telnyx KokoroTTS voice string — warm American male */
export const TELNYX_VOICE_STRING = 'Telnyx.KokoroTTS.am_adam';

/** Telnyx voice settings — slight slowdown for clarity on phone calls */
export const TELNYX_VOICE_SETTINGS = { type: 'telnyx' as const, voice_speed: 0.95 };

/** Telnyx STT configuration */
export const TELNYX_STT_CONFIG = {
  transcription_engine: 'Telnyx' as const,
  transcription_engine_config: {
    transcription_engine: 'Telnyx' as const,
    transcription_model: 'openai/whisper-large-v3-turbo' as const,
    language: 'en' as const,
  },
  transcription_tracks: 'inbound' as const,
};

/** Silence nudge threshold in milliseconds */
export const SILENCE_NUDGE_MS = 8_000;

/** Session persistence window after disconnect — 30 minutes */
export const SESSION_PERSIST_MS = 30 * 60 * 1000;

/** Call timeout in milliseconds — 10 minutes */
export const CALL_TIMEOUT_MS = 10 * 60 * 1000;
```

### Updated Greeting — Two-Step Flow
```typescript
// src/lib/voice/greeting.ts — replace single greeting with two-step constants
// Hardcoded — never LLM-generated — guarantees FCC/TCPA AI disclosure

export const GREETING_STEP_1 =
  "Hi, I'm Murphy — an AI assistant from OpenClaw Service Matchmaker. Who am I speaking with?";

export function GREETING_STEP_2(callerName: string): string {
  return `Hey ${callerName}, what kind of service are you looking for today?`;
}

export const GREETING_STEP_2_FALLBACK =
  "What kind of service are you looking for today?";

export const TCPA_CONSENT_ASK =
  "Before I search, mind if I send you a text recap after we're done? It'll have the provider's info handy.";

export const TCPA_CONSENT_DECLINE_ACK =
  "No problem at all. Let me find someone for you.";

export const SILENCE_NUDGE = "Still there?";

export const GRACEFUL_HANGUP =
  "It seems like you may have stepped away. Feel free to call back whenever you're ready. Take care!";

export const GREETING_TIMEOUT_MS = 2000;
```

### Concurrent Filler + Tool Call Pattern
```typescript
// src/api/webhooks.ts — fire filler and tool concurrently
// Phase 3 replaces the placeholder with actual executeSearchTool()
async function fireFillerAndSearch(
  callControlId: string,
  _intent: CallState['intent']
): Promise<void> {
  await Promise.allSettled([
    getTelnyxClient().calls.actions.speak(callControlId, {
      payload: getFillerPhrase(),
      voice: TELNYX_VOICE_STRING,
      voice_settings: TELNYX_VOICE_SETTINGS,
    }),
    // Phase 3: executeSearchTool(callControlId, intent)
    Promise.resolve(),
  ]);
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| ElevenLabs TTS via ClawdTalk | Telnyx KokoroTTS native (`Telnyx.KokoroTTS.am_adam`) | Zero external TTS cost; no api_key_ref required; same speak API |
| Deepgram Nova-3 STT via ClawdTalk | Telnyx Whisper STT (`openai/whisper-large-v3-turbo`) | No Deepgram dependency; `call.transcription` webhook already handled |
| ClawdTalk skill-config.json for bridge | Direct Telnyx Call Control v2 commands | Simpler architecture; fewer moving parts; no gateway skill needed |
| Single-step greeting (service question first) | Two-step greeting (name first, then service) | Matches CONTEXT.md conversation design; more personalized flow |
| 4-phrase filler pool | 15–20 phrase filler pool | Callers on multiple calls hear variety; less repetitive |
| No TCPA consent tracking | Consent captured and stored per call | TCPA compliance; required before Phase 6 SMS can ship |

**Deprecated/outdated from previous research:**
- `ELEVENLABS_VOICE_STRING`: Remove from voice-config.ts; replace with `TELNYX_VOICE_STRING`
- `DEEPGRAM_CONFIG`: Remove from voice-config.ts; replace with `TELNYX_STT_CONFIG`
- `ELEVENLABS_CONFIG`: Remove from voice-config.ts; no longer needed
- `ADAM_VOICE_ID`: Remove from voice-config.ts; no longer needed
- Deepgram reference in `detectLanguage` doc comment: Remove or update

---

## Open Questions

1. **Telnyx Whisper `call.transcription` payload — exact shape of `transcription_data`**
   - What we know: The webhook handler already processes `call.transcription` events with `payload.transcription_data.transcript` and `payload.transcription_data.words`. This works in tests with mocked data.
   - What's unclear: Whether Telnyx Whisper provides a `words` array or only a `transcript` string. The current handler's `words ?? []` fallback handles missing arrays, but `detectLanguage(words)` call should be removed for English-only Phase 2.
   - Recommendation: On first real call test, log the full `transcription_data` payload. Remove the `detectLanguage` call until Phase 2 is verified working; language detection is English-only in this phase.

2. **KokoroTTS am_adam actual voice quality on telephone audio (8kHz, G.711)**
   - What we know: KokoroTTS is listed in Telnyx SDK type comments as a valid provider with voice ID `am_adam`. It's a zero-cost Telnyx-hosted TTS.
   - What's unclear: How KokoroTTS sounds specifically on telephone codec (G.711 PCMU, 8kHz). High-quality TTS voices can sound degraded at telephone quality.
   - Recommendation: Run a live call test in Wave 1 to verify voice quality. If KokoroTTS sounds robotic on the actual phone, fallback to `AWS.Polly.Matthew-Neural` which is better-documented for telephony.

3. **`InterruptionSettings.enable` — which commands support it**
   - What we know: `InterruptionSettings` interface exists in the SDK with `enable?: boolean`. It appears in `ActionGatherUsingAIParams` context.
   - What's unclear: Whether `InterruptionSettings` is applicable to `calls.actions.speak` (not just gatherUsingAI). The SDK type for `ActionSpeakParams` does not include `interruption_settings`.
   - Recommendation: Telnyx barge-in for basic speak commands may be handled automatically by the platform (caller speech stops TTS). Do not add `interruption_settings` to speak calls in Phase 2 — test behavior on a live call first. If Murphy continues speaking after caller talks, investigate `stop: 'current'` pattern.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOICE-01 | `call.answered` triggers speak with AI disclosure in payload | unit | `npm test -- tests/api/webhooks.test.ts` | ✅ Test 8 exists — needs update for new voice string |
| VOICE-01 | GREETING_STEP_1 contains "AI" before first question mark | unit | `npm test -- tests/lib/voice/greeting.test.ts` | ✅ Exists — needs update for two-step |
| VOICE-01 | GREETING_STEP_2 includes caller name | unit | `npm test -- tests/lib/voice/greeting.test.ts` | ❌ Wave 0 gap |
| VOICE-02 | `call.transcription` in name_capture stage extracts caller name | unit | `npm test -- tests/api/webhooks.test.ts` | ❌ Wave 0 gap |
| VOICE-02 | `call.transcription` in consent stage stores smsConsent=true on yes | unit | `npm test -- tests/api/webhooks.test.ts` | ❌ Wave 0 gap |
| VOICE-02 | `call.transcription` in consent stage stores smsConsent=false on no | unit | `npm test -- tests/api/webhooks.test.ts` | ❌ Wave 0 gap |
| VOICE-02 | Intent extraction from "I need a plumber in Austin" returns plumber + Austin | unit | `npm test -- tests/lib/ai/intent-extractor.test.ts` | ✅ Existing tests cover this |
| VOICE-03 | After 2 clarification turns, stage advances to consent (not searching) | unit | `npm test -- tests/api/webhooks.test.ts` | ❌ Wave 0 gap — current test advances to searching |
| VOICE-04 | `calls.actions.speak` called with TELNYX_VOICE_STRING (not ELEVENLABS) | unit | `npm test -- tests/api/webhooks.test.ts` | ❌ Wave 0 gap — Test 8 currently checks ELEVENLABS_VOICE_STRING |
| VOICE-05 | `getFillerPhrase()` returns one of 15+ distinct English phrases | unit | `npm test -- tests/lib/voice/filler.test.ts` | ❌ Wave 0 gap — current test only verifies 4 phrases |
| VOICE-05 | Round-robin counter produces >= 3 unique phrases in first 5 calls | unit | `npm test -- tests/lib/voice/filler.test.ts` | ✅ Pattern from STATE.md decision — verify still holds with expanded pool |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (currently 216 tests) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Update `tests/api/webhooks.test.ts` Test 8: change `ELEVENLABS_VOICE_STRING` assertion to `TELNYX_VOICE_STRING`
- [ ] Add `tests/api/webhooks.test.ts` Test for name_capture stage flow
- [ ] Add `tests/api/webhooks.test.ts` Test for consent stage yes/no parsing
- [ ] Add `tests/api/webhooks.test.ts` Test for stage advancing to `consent` (not `searching`) after max clarifications
- [ ] Add `tests/lib/voice/greeting.test.ts`: GREETING_STEP_2 includes callerName
- [ ] Add `tests/lib/voice/filler.test.ts`: pool size >= 15 assertion
- [ ] Update `tests/lib/voice/call-state.test.ts`: add tests for `callerName`, `smsConsent`, `silenceNudgeCount` fields

*(Existing test infrastructure fully covers the rest. No new framework install needed.)*

---

## Sources

### Primary (HIGH confidence)
- `/node_modules/telnyx/resources/calls/actions.d.ts` (telnyx@6.13.0) — `ActionSpeakParams`, `ActionStartTranscriptionParams`, `TranscriptionEngineTelnyxConfig`, `TelnyxVoiceSettings`, `InterruptionSettings` — all introspected directly from installed SDK
- `/node_modules/telnyx/resources/webhooks.d.ts` (telnyx@6.13.0) — complete list of `event_type` values; confirmed no `call.silence` event exists
- Existing codebase: `src/api/webhooks.ts`, `src/lib/voice/call-state.ts`, `src/lib/voice/filler.ts`, `src/lib/voice/greeting.ts`, `src/lib/voice/voice-config.ts`, `src/lib/ai/intent-extractor.ts`, `src/lib/ai/orchestrator.ts` — all read in full
- All 216 tests passing confirmed via `npm test`

### Secondary (MEDIUM confidence)
- SDK type comment: `Telnyx.KokoroTTS.af_heart` and `Telnyx.KokoroTTS.am_adam` named in assistant.d.ts and actions.d.ts type comments — HIGH confidence these are valid voice IDs
- voicerankings.com/voice/kokoro-82M/male/am_adam — confirms `am_adam` is a General American male voice from the Kokoro-82M model, 184 WPM natural pace

### Tertiary (LOW confidence)
- KokoroTTS telephony quality on G.711 codec — not directly verifiable without a live call test; recommend real call test in Wave 1

---

## Metadata

**Confidence breakdown:**
- Standard stack (Telnyx-native TTS/STT): HIGH — verified from installed SDK type definitions
- Architecture patterns: HIGH — derived from existing codebase, SDK introspection, and CONTEXT.md locked decisions
- Voice quality (KokoroTTS am_adam on phone): MEDIUM — voice ID confirmed, telephony codec behavior needs live test
- Pitfalls: HIGH — derived from code analysis of existing implementation gaps

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (Telnyx SDK stable; KokoroTTS voice IDs stable as of telnyx@6.13.0)
