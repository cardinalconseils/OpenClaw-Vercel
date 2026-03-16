# Phase 2: Voice Conversation Core - Research

**Researched:** 2026-03-15
**Domain:** Voice telephony pipeline — Telnyx Call Control v2, ClawdTalk, Deepgram STT, ElevenLabs TTS, OpenClaw sessions
**Confidence:** HIGH (core stack verified via official docs and Telnyx/Deepgram/ElevenLabs sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **ClawdTalk** handles the voice layer — STT/TTS, Telnyx Call Control, and OpenClaw gateway connection
- Murphy responds via OpenClaw chat; ClawdTalk bridges that to voice
- **Telnyx MCP** used for portal configuration (Call Control apps, webhook URLs, number management)
- Existing Telnyx phone number already provisioned — just needs to be pointed at ClawdTalk
- **Deepgram** for STT (fast, accurate transcription)
- **ElevenLabs** for TTS (natural voice synthesis)
- API keys for both services added to `.env.example` — user fills in values
- **Instant short greeting**: "Hi, this is Murphy from OpenClaw — I'm an AI assistant. What service do you need today?" — under 2 seconds
- **Bilingual: English + French** — auto-detect language from first utterance via Deepgram, respond in that language for entire call
- **One focused clarifying question** max for ambiguous requests. Never more than one question
- **Confirm then act**: "Got it — a plumber in Montreal. Let me find the best options." Quick confirmation + filler, then search
- **Brief natural filler** during tool calls: "Let me look that up for you" / "One moment while I search" — short, natural, then silence until results
- **OpenClaw sessions** for state management — each call = a session, state tracked automatically by gateway
- **SMS follow-up on call drop**: "Looks like we got disconnected. Call back anytime to pick up where we left off." Session persists for 30 minutes
- **10-minute call timeout**: Murphy says "I want to be respectful of your time — let me wrap up what we've found"
- **Professional male, warm** voice — ElevenLabs voices like "Adam" or "Josh" as reference
- **Same voice for both English and French** — ElevenLabs multilingual voice, consistent Murphy identity
- **Medium pace, natural** — ~150 words/min, conversational speed

### Claude's Discretion
- Exact ElevenLabs voice ID selection (within "professional male, warm" parameters)
- Deepgram model and configuration (language detection settings, punctuation, endpointing)
- ClawdTalk skill configuration details
- Filler phrase variety and rotation
- Error handling for STT failures or TTS timeouts
- Exact greeting wording in French

### Deferred Ideas (OUT OF SCOPE)
- Storing secrets in Supabase instead of .env — infrastructure concern, separate from voice core
- Custom voice cloning for Murphy — future optimization after v1 works
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VOICE-01 | User calls Telnyx number and agent answers with a greeting | ClawdTalk handles call.initiated → triggers greeting via OpenClaw session; Telnyx speak command delivers TTS within 2s |
| VOICE-02 | Agent captures user intent from natural speech (service type, location, urgency) | Deepgram Nova-3 `language=multi` streams transcription; Murphy system prompt + intent-capture task in orchestrator extracts structured intent |
| VOICE-03 | Agent asks smart clarifying questions when intent is ambiguous | Existing orchestrator disambiguation task (routes to Anthropic); one-question limit enforced in Murphy system prompt |
| VOICE-04 | Agent responds with sub-second perceived latency (streaming TTS) | ElevenLabs Flash v2.5 (~75ms latency) via ClawdTalk TTS bridge; filler phrase queued immediately while LLM generates |
| VOICE-05 | Agent uses filler speech during tool calls to avoid dead air | Filler phrases emitted to ClawdTalk before dispatching tool call; silence-fill strategy enforced in voice-modifiers.ts |
</phase_requirements>

---

## Summary

Phase 2 wires together the existing stub infrastructure (webhook handler, orchestrator, Murphy prompt) into a functional real-time voice pipeline. The primary integration surface is ClawdTalk, which handles the Telnyx telephony layer and bridges inbound speech to the OpenClaw gateway session where Murphy already lives. This phase does not re-implement telephony from scratch — it configures ClawdTalk correctly, extends the webhook handler to react to the full call event lifecycle, adds bilingual intent capture logic, and ensures zero dead air through streaming TTS and filler phrases.

The Deepgram decision is clear: use Nova-3 with `language=multi` and `endpointing=100` for real-time English+French codeswitching detection in a single WebSocket stream. This is the correct 2025 approach — language detection is not supported for streaming, but `language=multi` with Nova-3 handles mixed-language input natively and returns per-word language tags. ClawdTalk is expected to configure the Deepgram model as part of its skill-config, so the main implementation work is testing that the `language=multi` config reaches ClawdTalk's Deepgram invocation.

ElevenLabs Flash v2.5 (`eleven_flash_v2_5`) is the model for TTS — ~75ms latency vs Multilingual v2's higher latency makes it the correct choice for perceived-immediacy requirement. Adam (voice ID: `pNInz6obpgDQGcFmaJgB`) is the recommended voice — professionally male, narration-grade, documented French language support. Murphy's system prompt needs three Phase 2 additions: bilingual response instructions, one-question-max clarification rule (already partially present), and TCPA/FCC-compliant greeting disclosure.

**Primary recommendation:** Configure ClawdTalk skill with Deepgram Nova-3 + `language=multi` and ElevenLabs Flash v2.5 + Adam voice. Extend the webhook handler to respond to the full call lifecycle (call.answered, call.hangup, call.transcription). Add bilingual session-language tracking in a new call-state module. Emit filler TTS before any tool call in the orchestrator.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ClawdTalk client skill | beta (installed in `~/.openclaw/workspace/skills/clawdtalk-client/`) | Bridges Telnyx calls to OpenClaw sessions via WebSocket | Locked — handles STT/TTS/Call Control abstraction |
| Deepgram Node.js SDK | `@deepgram/sdk` (latest) | STT streaming with Nova-3 | Locked; Nova-3 is 2025 flagship with real-time multilingual |
| ElevenLabs Node.js SDK | `elevenlabs` (latest) | Streaming TTS output | Locked; Flash v2.5 has ~75ms latency needed for VOICE-04 |
| Telnyx SDK v6 | `telnyx` (already installed) | Call Control commands (speak, hangup, answer) | Already installed; used for speak commands |
| Vitest | (already configured) | Unit and integration tests | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@deepgram/sdk` | latest | Nova-3 streaming transcription | Install if not already present; ClawdTalk may use it internally |
| `elevenlabs` | latest | Flash v2.5 TTS for direct streaming | Install for any TTS outside ClawdTalk bridge (e.g. test harness) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deepgram Nova-3 | Nova-2 | Nova-2 supports `language=multi` but Nova-3 has 54% lower WER and real-time multilingual — use Nova-3 |
| ElevenLabs Flash v2.5 | Multilingual v2 | Multilingual v2 is higher quality but higher latency — Flash v2.5 wins for VOICE-04 |
| ElevenLabs Flash v2.5 | Telnyx native TTS | Telnyx native TTS works but voice consistency across EN/FR and Murphy persona requires ElevenLabs |

**Installation:**
```bash
npm install @deepgram/sdk elevenlabs
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── voice/
│   │   ├── telnyx-client.ts         # Existing — singleton Telnyx SDK
│   │   ├── webhook-verify.ts        # Existing — Ed25519 signature check
│   │   ├── call-state.ts            # NEW — per-call session state (language, intent, stage)
│   │   └── filler.ts                # NEW — filler phrase selection and emission
│   ├── ai/
│   │   ├── orchestrator.ts          # Existing — extend with language-aware routing
│   │   └── prompts/
│   │       ├── murphy-system.ts     # Existing — add bilingual + clarification rules
│   │       └── voice-modifiers.ts   # Existing — already enforces spoken-language format
├── api/
│   └── webhooks.ts                  # Existing — extend to handle full call lifecycle
tests/
├── lib/
│   ├── voice/
│   │   ├── call-state.test.ts       # NEW — Wave 0 gap
│   │   └── filler.test.ts           # NEW — Wave 0 gap
│   ├── ai/
│   │   └── prompts/
│   │       └── murphy-system.test.ts  # NEW — bilingual prompt tests
```

### Pattern 1: Call Lifecycle Event Handling
**What:** Each Telnyx webhook event maps to a specific handler action. The current webhook handler only reacts to `call.initiated`. Phase 2 needs the full lifecycle.

**When to use:** Every inbound call goes through this sequence.

**Event sequence:**
```
call.initiated  → answer the call (Telnyx answer command)
call.answered   → emit greeting TTS via ClawdTalk / Telnyx speak
call.transcription → pass transcript to orchestrator, get Murphy response, emit TTS
call.speak.ended → signal ready for next user utterance
call.hangup     → clean up session state, trigger SMS if needed
```

**Current state:** `webhooks.ts` only handles `call.initiated` and calls `chat()` without actually answering the call or speaking. Phase 2 must close that gap.

**Example pattern (extending webhooks.ts):**
```typescript
// Source: Telnyx Call Control v2 docs
if (eventType === 'call.answered') {
  const callControlId = event?.data?.payload?.call_control_id;
  await getTelnyxClient().calls.speak(callControlId, {
    payload: greetingText(detectedLanguage),
    voice: `ElevenLabs.Default.${ADAM_VOICE_ID}`,
    voice_settings: { api_key_ref: process.env.ELEVENLABS_API_KEY_REF },
    language: 'en-US',
  });
}
```

### Pattern 2: Bilingual Language Detection via Deepgram Nova-3
**What:** Use `language=multi` with Nova-3 model for real-time French+English codeswitching. Set `endpointing=100` for language transition detection.

**When to use:** ClawdTalk configures Deepgram — the language-detect flag must be in the ClawdTalk skill-config.json. The first transcription response includes per-word language tags. Extract the dominant language from the first utterance and store it in call state.

**Language tag extraction:**
```typescript
// Source: Deepgram multilingual codeswitching docs
// Each word in transcript includes { word: string, language: 'en' | 'fr' }
function detectLanguage(transcript: DeepgramTranscript): 'en' | 'fr' {
  const words = transcript.channel.alternatives[0].words;
  const frWords = words.filter(w => w.language === 'fr').length;
  return frWords > words.length * 0.3 ? 'fr' : 'en'; // >30% French words = FR call
}
```

**ClawdTalk skill-config.json additions** (to be verified against ClawdTalk beta docs):
```json
{
  "api_key": "${CLAWDTALK_API_KEY}",
  "server": "https://clawdtalk.com",
  "stt": {
    "provider": "deepgram",
    "model": "nova-3",
    "language": "multi",
    "endpointing": 100,
    "punctuate": true,
    "interim_results": false
  },
  "tts": {
    "provider": "elevenlabs",
    "model": "eleven_flash_v2_5",
    "voice_id": "pNInz6obpgDQGcFmaJgB",
    "api_key": "${ELEVENLABS_API_KEY}"
  },
  "gateway": {
    "tools": {
      "allow": ["sessions_send"]
    }
  }
}
```

### Pattern 3: Call State Per Session
**What:** A lightweight in-memory Map keyed by `call_control_id` tracks per-call state: detected language, current pipeline stage, intent extracted (service type, location, urgency), turn count for clarification limit.

**When to use:** Initialized on `call.answered`, read on every `call.transcription`, cleaned up on `call.hangup`.

```typescript
interface CallState {
  callControlId: string;
  callLegId: string;
  callerPhone: string;
  language: 'en' | 'fr';
  stage: 'greeting' | 'intake' | 'searching' | 'complete';
  intent: Partial<{ serviceType: string; location: string; urgency: string }>;
  clarificationTurns: number;    // max 1 per CONTEXT.md decision
  startedAt: Date;
}

const activeCalls = new Map<string, CallState>();
```

### Pattern 4: Filler Phrases Before Tool Calls
**What:** Before invoking `search_providers` or any tool with latency, emit a short TTS filler phrase so the line never goes silent. The filler is queued immediately; the LLM-generated response follows when ready.

**Implementation:** `filler.ts` exports `getFillerPhrase(language: 'en' | 'fr'): string` with a small rotating set. The webhook handler calls this before dispatching the tool.

```typescript
// src/lib/voice/filler.ts
const FILLERS: Record<'en' | 'fr', string[]> = {
  en: [
    "Let me look that up for you.",
    "One moment while I search.",
    "Give me just a second.",
  ],
  fr: [
    "Laissez-moi chercher ça pour vous.",
    "Un moment, je vérifie.",
    "Juste un instant.",
  ],
};

export function getFillerPhrase(language: 'en' | 'fr'): string {
  const pool = FILLERS[language];
  return pool[Math.floor(Math.random() * pool.length)];
}
```

### Pattern 5: TCPA/FCC-Compliant Greeting Disclosure
**What:** FCC 2024/2025 rules require AI disclosure at the beginning of every AI-generated voice call. CA SB-1001 requires clear bot disclosure. Murphy's greeting must lead with AI identity — already present in `murphy-system.ts` but must be the literal first spoken words on call answer.

**Compliant greeting (English):**
> "Hi, I'm Murphy — an AI assistant from OpenClaw Service Matchmaker. What service can I help you find today?"

**Compliant greeting (French):**
> "Bonjour, je suis Murphy — un assistant IA d'OpenClaw. Quel service puis-je vous aider à trouver?"

**Rule:** Greeting text must be hardcoded (not LLM-generated for the initial answer) to guarantee the disclosure is always present and never accidentally omitted by the model.

### Anti-Patterns to Avoid
- **Generating the greeting with the LLM:** LLMs may omit the AI disclosure on the greeting. The greeting must be a hardcoded template with disclosure at position 0.
- **Using `detect_language=true` for streaming:** Language detection is not supported for streaming in Deepgram. Use `language=multi` with Nova-3 instead.
- **Using ElevenLabs Multilingual v2 for real-time:** Multilingual v2 has higher latency than Flash v2.5 — this breaks VOICE-04. Use `eleven_flash_v2_5`.
- **Global JSON body parsing on webhook route:** Already solved in Phase 1 — `express.raw()` is route-scoped, not global. Do not move it.
- **Calling `chat()` synchronously inside webhook handler:** Already async via `setImmediate` — maintain this pattern to keep 200ms ACK to Telnyx.
- **Storing call state in DB for in-call operations:** In-memory Map is fast enough for active calls. DB persistence for post-call analytics only.
- **Using ElevenLabs free tier:** Telnyx ElevenLabs integration requires a premium ElevenLabs account — freemium is not supported.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time speech transcription with language detection | Custom WebSocket to Deepgram | ClawdTalk's STT bridge + `language=multi` config | ClawdTalk manages the stream lifecycle, endpointing, VAD; building it from scratch is 500+ lines of error-prone WebSocket state management |
| TTS with phone codec conversion | Custom PCM conversion pipeline | ClawdTalk's TTS bridge + ElevenLabs config | Telephony requires specific audio encoding (PCMU/PCMA, 8kHz); ElevenLabs + Telnyx integration handles codec negotiation |
| Session management per call | Custom session store | OpenClaw's built-in session system (already configured) | Gateway handles session lifecycle, persistence, and cleanup automatically |
| AI disclosure compliance | Custom disclaimer injection system | Hardcoded greeting template | Simpler and more reliable than any LLM-based approach |

**Key insight:** ClawdTalk is the abstraction layer — the implementation work in Phase 2 is configuration and wiring, not building voice infrastructure. Every component below the `sessions_send` tool call is managed by ClawdTalk.

---

## Common Pitfalls

### Pitfall 1: Deepgram Language Detection vs Code-Switching
**What goes wrong:** Developer uses `detect_language=true` for streaming, gets an error or silent failure (language detection is pre-recorded only).
**Why it happens:** Deepgram has two separate features: `detect_language` (pre-recorded) and `language=multi` codeswitching (streaming). The names are confusing.
**How to avoid:** Use `language=multi` with `model=nova-3` for all streaming transcription. Set `endpointing=100` for proper turn detection.
**Warning signs:** Transcripts return in English-only even when caller speaks French; `language` field missing from word objects.

### Pitfall 2: Greeting Delay Exceeding 2 Seconds
**What goes wrong:** Murphy greets the caller 3-5 seconds after call connects because greeting is LLM-generated and awaits the full model response.
**Why it happens:** LLM calls take 300-800ms; combined with Telnyx event delivery and TTS synthesis, the chain exceeds the 2-second target.
**How to avoid:** Hardcode the greeting as a constant. On `call.answered`, emit TTS immediately with the hardcoded text — no LLM call needed for the greeting.
**Warning signs:** Success criteria 1 fails in test: "hears greeting within 2 seconds" — time the call.answered → speak command latency.

### Pitfall 3: Dead Air on Tool Calls
**What goes wrong:** Murphy finishes the intake conversation, starts `search_providers`, and the line goes silent for 2-4 seconds.
**Why it happens:** Tool execution and LLM summarization take real time; TTS of the result only emits after both complete.
**How to avoid:** Always call `emitFiller(callControlId, language)` before `executeTool()`. The filler is a speak command that queues in Telnyx and plays immediately; the next speak command queues after it.
**Warning signs:** Success criteria 5 fails — "line never goes silent during tool calls."

### Pitfall 4: ElevenLabs Voice Fallback to Default
**What goes wrong:** Telnyx ElevenLabs integration uses a generic default voice instead of Adam, or falls back when the voice ID is invalid.
**Why it happens:** Voice ID format for the Telnyx speak API is `"ElevenLabs.Default.<voice_id>"` not just the raw voice ID. Using the raw ID produces a 400 error.
**How to avoid:** Format: `voice: "ElevenLabs.Default.pNInz6obpgDQGcFmaJgB"`. Store the voice ID as a constant in a config file.
**Warning signs:** TTS plays but sounds wrong (default robot voice); Telnyx speak API returns 400 or 422.

### Pitfall 5: Clarification Loop Exceeds One Turn
**What goes wrong:** Murphy asks multiple clarifying questions when intent is ambiguous, violating the one-question-max rule.
**Why it happens:** The LLM may generate a second question if the first answer is still ambiguous, unless the system prompt and call state enforce the one-turn limit.
**How to avoid:** Track `clarificationTurns` in call state. If `clarificationTurns >= 1` and intent is still incomplete, force best-guess search with whatever was captured and proceed to SEARCH stage.
**Warning signs:** Integration test shows two sequential clarifying questions before the search trigger.

### Pitfall 6: French Response After English Caller
**What goes wrong:** Language is set to French for the entire session even when the caller spoke English, because the first utterance contained one French word ("bon").
**Why it happens:** Language detection threshold is too sensitive.
**How to avoid:** The 30% threshold rule: only classify as French if >30% of words in the first utterance are tagged `language: 'fr'` by Nova-3.
**Warning signs:** Integration test with English-only caller gets French responses.

### Pitfall 7: TCPA Disclosure Not First in Greeting
**What goes wrong:** Murphy says something like "How can I help you today?" before identifying itself as AI.
**Why it happens:** LLM may reorder the greeting if not constrained. Also, the current `murphy-system.ts` greeting asks for the caller's name first (not the service need), which differs from the CONTEXT.md decision.
**How to avoid:** Hardcode the greeting. The disclosure "I'm an AI assistant" must be in the first sentence. Update `murphy-system.ts` to align with the locked greeting from CONTEXT.md.
**Warning signs:** The spoken greeting does not contain "AI" or "artificial intelligence" before the first question.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Telnyx Speak with ElevenLabs Voice
```typescript
// Source: Telnyx TTS docs — ElevenLabs integration
// Voice format: "ElevenLabs.Default.<voice_id>"
// Requires premium ElevenLabs account; api_key_ref from Telnyx integration_secrets
const ADAM_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

await getTelnyxClient().calls.speak(callControlId, {
  payload: greetingText,
  voice: `ElevenLabs.Default.${ADAM_VOICE_ID}`,
  voice_settings: { api_key_ref: process.env.TELNYX_ELEVENLABS_KEY_REF },
});
```

### Deepgram Nova-3 Streaming with Language=Multi
```typescript
// Source: Deepgram multilingual codeswitching docs
// Use language=multi + model=nova-3 for real-time EN/FR codeswitching
// endpointing=100 is recommended for language-switching audio
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const connection = deepgram.listen.live({
  model: 'nova-3',
  language: 'multi',
  endpointing: 100,
  punctuate: true,
  interim_results: false,
});
```

### Call State Management
```typescript
// src/lib/voice/call-state.ts — in-memory call state
export interface CallState {
  callControlId: string;
  callerPhone: string;
  language: 'en' | 'fr';
  stage: 'greeting' | 'intake' | 'searching' | 'complete';
  intent: Partial<{ serviceType: string; location: string; urgency: string }>;
  clarificationTurns: number;
  startedAt: Date;
}

const _calls = new Map<string, CallState>();

export function initCall(callControlId: string, callerPhone: string): CallState {
  const state: CallState = {
    callControlId,
    callerPhone,
    language: 'en',     // default; updated after first transcript
    stage: 'greeting',
    intent: {},
    clarificationTurns: 0,
    startedAt: new Date(),
  };
  _calls.set(callControlId, state);
  return state;
}

export function getCall(id: string): CallState | undefined {
  return _calls.get(id);
}

export function updateCall(id: string, patch: Partial<CallState>): void {
  const existing = _calls.get(id);
  if (existing) _calls.set(id, { ...existing, ...patch });
}

export function endCall(id: string): void {
  _calls.delete(id);
}
```

### Hardcoded Greeting Templates
```typescript
// src/lib/voice/greeting.ts
// Hardcoded — never LLM-generated — to guarantee FCC/TCPA compliance
export const GREETING: Record<'en' | 'fr', string> = {
  en: "Hi, I'm Murphy — an AI assistant from OpenClaw Service Matchmaker. What service can I help you find today?",
  fr: "Bonjour, je suis Murphy — un assistant IA d'OpenClaw Service Matchmaker. Quel service puis-je vous aider à trouver aujourd'hui?",
};
```

### Murphy System Prompt — Bilingual Addition
```typescript
// Additions to src/lib/ai/prompts/murphy-system.ts
// Add to base prompt after ## Conversation Rules:

`## Language Rules
- Detect the caller's language from their first utterance.
- Respond in the same language for the entire call — English or French.
- Do not mix languages within a single response.
- If unclear, default to English and offer: "I can also help you in French — just let me know."

## Clarification Limit
- You may ask ONE clarifying question to resolve ambiguous intent.
- After one clarification attempt, proceed with the best available information.
- Never ask more than one clarifying question in a single call.`
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nova-2 for multilingual | Nova-3 with `language=multi` | 2025 (Nova-3 GA) | 54% lower WER, real-time multilingual in single stream |
| ElevenLabs Turbo v2 | Flash v2.5 (`eleven_flash_v2_5`) | 2025 (Flash GA) | ~75ms latency vs higher Turbo latency |
| `detect_language=true` for streaming | `language=multi` | Nova-3 launch | Language detection only works pre-recorded; `language=multi` is the streaming answer |
| Generating greeting with LLM | Hardcoded greeting templates | FCC 2024-2025 rules | Required for TCPA/FCC compliance; also faster |

**Deprecated/outdated:**
- `detect_language=true` for streaming Deepgram: Not supported in streaming mode. Replaced by `language=multi`.
- ElevenLabs Turbo v2: Replaced by Flash v2.5 for low-latency use cases.
- Nova-2 for new projects: Nova-3 is the 2025 flagship with better multilingual support; use Nova-3.

---

## Open Questions

1. **ClawdTalk beta skill-config.json exact schema for STT/TTS override**
   - What we know: ClawdTalk uses Deepgram + ElevenLabs; `skill-config.json` accepts `api_key` and `server`; ClawdTalk routes speech through the gateway's `/v1/chat/completions` endpoint
   - What's unclear: Whether `stt.model`, `stt.language`, `tts.model`, and `tts.voice_id` are top-level config fields in skill-config.json, or whether ClawdTalk reads those from environment variables
   - Recommendation: Check `~/.openclaw/workspace/skills/clawdtalk-client/` at plan execution time; read the actual skill README or SKILL.md to confirm the config schema. If ClawdTalk manages Deepgram directly and doesn't expose model/language settings, fall back to Telnyx's native STT (Deepgram-backed) configured via Telnyx MCP and use the Telnyx speak API for TTS directly.

2. **Telnyx ElevenLabs integration_secrets setup**
   - What we know: Telnyx requires an `api_key_ref` for ElevenLabs (stored via `POST /v2/integration_secrets`); freemium ElevenLabs account is not supported
   - What's unclear: Whether this secret can be set programmatically via Telnyx SDK v6 or requires Telnyx MCP portal action
   - Recommendation: Use Telnyx MCP for the one-time secret registration; document the step in the plan.

3. **ClawdTalk session correlation — does ClawdTalk create the OpenClaw session, or does the webhook handler?**
   - What we know: ClawdTalk routes transcription to gateway's `/v1/chat/completions` (session_send tool); Murphy's response goes back as TTS
   - What's unclear: Whether the existing `call.initiated` webhook handler's `chat()` call conflicts with ClawdTalk's session management
   - Recommendation: Once ClawdTalk is active, it owns the session for that call. The webhook handler's `call.initiated` `chat()` call (currently a stub response) should be removed or converted to a pre-ClawdTalk fallback; ClawdTalk takes over after `call.answered`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` (all tests in `tests/**/*.test.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOICE-01 | Greeting emitted within 2s of call.answered | unit | `npm test -- --reporter=verbose tests/lib/voice/call-state.test.ts` | Wave 0 gap |
| VOICE-01 | Greeting always contains AI disclosure | unit | `npm test -- tests/lib/voice/greeting.test.ts` | Wave 0 gap |
| VOICE-02 | Intent extraction returns serviceType + location from natural utterance | unit | `npm test -- tests/lib/ai/prompts/murphy-system.test.ts` | Wave 0 gap |
| VOICE-02 | Language detection assigns 'en' for English, 'fr' for French-dominant utterance | unit | `npm test -- tests/lib/voice/call-state.test.ts` | Wave 0 gap |
| VOICE-03 | Clarification turn counter increments; stops at 1 | unit | `npm test -- tests/lib/voice/call-state.test.ts` | Wave 0 gap |
| VOICE-03 | After 1 clarification, stage advances to 'searching' regardless of intent completeness | unit | `npm test -- tests/lib/voice/call-state.test.ts` | Wave 0 gap |
| VOICE-04 | Filler phrase emitted before tool call (latency contract) | unit | `npm test -- tests/lib/voice/filler.test.ts` | Wave 0 gap |
| VOICE-05 | getFillerPhrase returns non-empty string for both 'en' and 'fr' | unit | `npm test -- tests/lib/voice/filler.test.ts` | Wave 0 gap |
| VOICE-05 | Filler pool has >= 3 variants per language (rotation check) | unit | `npm test -- tests/lib/voice/filler.test.ts` | Wave 0 gap |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/voice/call-state.test.ts` — covers VOICE-01 (greeting timing contract), VOICE-02 (language detection threshold), VOICE-03 (clarification turn limit)
- [ ] `tests/lib/voice/filler.test.ts` — covers VOICE-04 (filler emission), VOICE-05 (phrase pool)
- [ ] `tests/lib/voice/greeting.test.ts` — covers VOICE-01 (disclosure compliance)
- [ ] `src/lib/voice/call-state.ts` — implementation needed (Wave 0 creates the file structure)
- [ ] `src/lib/voice/filler.ts` — implementation needed
- [ ] `src/lib/voice/greeting.ts` — hardcoded greeting constants
- [ ] `npm install @deepgram/sdk elevenlabs` — new dependencies

---

## Sources

### Primary (HIGH confidence)
- Telnyx Call Control v2 webhook docs — event types (`call.initiated`, `call.answered`, `call.hangup`, `call.transcription`, `call.speak.ended`), payload structure with `call_control_id`
- Telnyx TTS docs — ElevenLabs integration format `"ElevenLabs.Default.<voice_id>"`, `api_key_ref` requirement, premium-only constraint
- Deepgram multilingual codeswitching docs — `language=multi` + Nova-3 for streaming English+French, `endpointing=100` recommendation
- ElevenLabs Flash v2.5 — model ID `eleven_flash_v2_5`, ~75ms latency, 32 language support including French
- ElevenLabs premade voices docs — Adam voice ID `pNInz6obpgDQGcFmaJgB`, Josh voice ID `TxGEqnHWrfWFTfGW9XjX`
- FCC 2024-2025 TCPA rules — AI disclosure required at beginning of every AI-generated voice call
- Existing codebase: `src/lib/ai/orchestrator.ts`, `src/lib/ai/prompts/murphy-system.ts`, `src/api/webhooks.ts`, `src/lib/tools/registry.ts`

### Secondary (MEDIUM confidence)
- ClawdTalk GitHub README (`github.com/team-telnyx/clawdtalk-client`) — `skill-config.json` structure, `sessions_send` tool requirement for gateway integration, `api_key` + `server` fields
- WebSearch: ClawdTalk routes speech through gateway `/v1/chat/completions` endpoint (multiple sources agree)
- Deepgram Nova-3 announcement — "first STT model with real-time multilingual transcription, sub-300ms latency"

### Tertiary (LOW confidence)
- ClawdTalk `stt` and `tts` sub-config schema in `skill-config.json` — inferred from ClawdTalk architecture description; actual field names must be confirmed by reading the installed skill at execution time
- French greeting text — drafted from English; should be reviewed by a French speaker or tested via Deepgram round-trip before shipping

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Deepgram Nova-3, ElevenLabs Flash v2.5, Telnyx speak API all verified via official docs
- Architecture: HIGH — call lifecycle, call state pattern, filler strategy all derive from verified Telnyx event schema and existing codebase patterns
- ClawdTalk config schema: MEDIUM — confirmed skill-config.json exists with api_key/server; STT/TTS sub-config inferred, not directly read from ClawdTalk source
- Pitfalls: HIGH — Deepgram streaming language detection limitation verified from official docs; other pitfalls derive from architecture analysis

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (ElevenLabs and Deepgram model IDs stable; ClawdTalk is beta — re-verify if more than 30 days pass)
