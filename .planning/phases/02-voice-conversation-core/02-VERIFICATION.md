---
phase: 02-voice-conversation-core
verified: 2026-03-15T23:00:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Call the Telnyx number and verify the two-step greeting works end-to-end"
    expected: "Hear 'Hi, I'm Murphy — an AI assistant from OpenClaw Service Matchmaker. Who am I speaking with?' within 2 seconds, then after giving a name hear a personalised follow-up question"
    why_human: "Real Telnyx STT/TTS pipeline cannot be exercised in unit tests — KokoroTTS voice, Whisper transcription latency, and actual call audio quality require a live call"
  - test: "Speak an ambiguous need ('I need help with my house') and verify one focused clarification question is asked, then a second open-ended question if still ambiguous"
    expected: "First clarification uses getDisambiguationPrompt output; second clarification says 'Could you tell me a bit more about what you need?' with no category suggestions"
    why_human: "Real STT accuracy and the exact disambiguation prompt text depend on runtime behaviour of extractIntent() against live speech"
  - test: "Let the line go silent for 10+ seconds and verify the nudge fires"
    expected: "After 8s of silence hear 'Still there?'; after two ignored nudges hear the graceful hangup phrase and call disconnects"
    why_human: "setTimeout-based silence detection is mocked in unit tests; real Telnyx call timing and audio-silence detection must be verified on a live call"
  - test: "Speak 'I need a plumber in Austin' and verify sub-second perceived TTS response"
    expected: "No perceptible gap between user's last word and Murphy's confirmation reply"
    why_human: "VOICE-04 streaming TTS latency is a perceptual quality bar that cannot be asserted programmatically"
  - test: "Verify OFF_TOPIC_REDIRECT fires when caller asks an off-topic question (e.g. 'What is the weather?')"
    expected: "Murphy says 'I only handle finding service providers — plumbers, electricians, and the like. Is there a service provider I can help you find?'"
    why_human: "OFF_TOPIC_REDIRECT is imported and available in webhooks.ts but is only void-cast, not yet wired into a dispatch branch. The response will fall through to the default log line rather than speaking the redirect phrase. This is a noted gap against the phase goal but was accepted in Plan 03 acceptance criteria as 'imported and available'. Human should confirm acceptable or flag for a gap-closure plan."
---

# Phase 2: Voice Conversation Core Verification Report

**Phase Goal:** An inbound call is answered with a greeting, user speech is captured and transcribed, service intent (type and location) is extracted within two turns, clarifying questions are asked when intent is ambiguous, and responses use streaming TTS with filler speech to avoid dead air
**Verified:** 2026-03-15T23:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Inbound call answered with greeting within 2s | ✓ VERIFIED | `call.answered` speaks `GREETING_STEP_1` immediately before any await; `startTranscription` follows — `webhooks.ts:132-133` |
| 2 | User speech captured and transcribed via Telnyx STT | ✓ VERIFIED | `startTranscription(callControlId, TELNYX_STT_CONFIG)` called on `call.answered`; Whisper model `openai/whisper-large-v3-turbo` configured in `voice-config.ts:19` |
| 3 | Service intent extracted within two turns | ✓ VERIFIED | `extractIntent()` called on each `call.transcription` in `intake` stage; `isIntentComplete()` gates advancement; two-turn cap enforced via `clarificationTurns` counter — `webhooks.ts:186-224` |
| 4 | Clarifying questions asked when intent is ambiguous | ✓ VERIFIED | `clarificationTurns === 0` fires `getDisambiguationPrompt('en')`; `clarificationTurns === 1` fires open-ended question with no category hints — `webhooks.ts:204-214` |
| 5 | Responses use Telnyx-native streaming TTS | ✓ VERIFIED | All `speak()` calls use `TELNYX_VOICE_STRING = 'Telnyx.KokoroTTS.am_adam'` and `TELNYX_VOICE_SETTINGS = {type:'telnyx', voice_speed:0.95}`; zero ElevenLabs/Deepgram references in `src/` |
| 6 | Filler speech used during tool calls to avoid dead air | ✓ VERIFIED | `startFillerLoop(speakFn, 'en')` called when transitioning to `searching` stage — `webhooks.ts:257`; 18-phrase pool with 10s interval and escalation at 10s/20s — `filler.ts:74-96` |
| 7 | Two-step greeting: name ask then personalised service question | ✓ VERIFIED | `GREETING_STEP_1` asks name; `call.speak.ended` advances to `name_capture`; transcript extracts last word as name; `GREETING_STEP_2(name)` or `GREETING_STEP_2_FALLBACK` spoken — `webhooks.ts:138-183` |
| 8 | Silence detection fires nudge at 8s, hangup after 2 nudges | ✓ VERIFIED | `resetSilenceTimer()` uses `SILENCE_NUDGE_MS = 8000`; counter tracks nudges; `GRACEFUL_HANGUP` then hangup after `silenceNudgeCount >= 2` — `webhooks.ts:73-96` |
| 9 | Max-clarification bypass uses broad search pattern, not best-guess | ✓ VERIFIED | `shouldAdvancePastClarification` (threshold `>= 2`) path speaks "general home repair services near..." with no specific service type and no "if that's not right" hedge — `webhooks.ts:215-222` |

**Score:** 9/9 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/voice/call-state.ts` | Extended CallState with TCPA + silence + name fields | ✓ VERIFIED | All 6 fields present: `callerName`, `smsConsent`, `consentTimestamp`, `consentMethod`, `silenceNudgeTimer`, `silenceNudgeCount`; stage union includes `name_capture` and `consent`; `endCall()` clears timer before delete; `shouldAdvancePastClarification` uses `>= 2` — line 101 |
| `src/lib/voice/greeting.ts` | Two-step greeting constants + TCPA + off-topic + confused caller | ✓ VERIFIED | Exports: `GREETING_STEP_1`, `GREETING_STEP_2` (function), `GREETING_STEP_2_FALLBACK`, `TCPA_CONSENT_ASK`, `TCPA_CONSENT_DECLINE_ACK`, `SILENCE_NUDGE`, `GRACEFUL_HANGUP`, `OFF_TOPIC_REDIRECT`, `CONFUSED_CALLER_EXPLAINER`; old `GREETING` record removed |
| `src/lib/voice/filler.ts` | 18-phrase pool + escalation constants + startFillerLoop | ✓ VERIFIED | `FILLERS_EN` has exactly 18 phrases; `FILLER_ESCALATION_10S` contains "longer than usual"; `FILLER_ESCALATION_20S` contains "different approach"; `startFillerLoop` fires immediately then every 10s with escalation |
| `src/lib/voice/voice-config.ts` | Telnyx-native TTS/STT constants, no ElevenLabs/Deepgram | ✓ VERIFIED | `TELNYX_VOICE_STRING`, `TELNYX_VOICE_SETTINGS`, `TELNYX_STT_CONFIG`, `SILENCE_NUDGE_MS=8000`; zero ElevenLabs/Deepgram/ADAM_VOICE_ID references |
| `src/lib/ai/prompts/murphy-system.ts` | Murphy prompt with two-step greeting, TCPA, 2-turn max, off-topic, confused caller | ✓ VERIFIED | Prompt contains: "Who am I speaking with", "TWO clarifying questions maximum", "general home repair services", "text recap", "8 seconds", "I only handle finding service providers", "I'm an AI that finds local service providers"; does NOT contain "if that's not right" |
| `src/api/webhooks.ts` | Full conversation lifecycle webhook handler | ✓ VERIFIED | Handles: `call.initiated`, `call.answered`, `call.speak.ended`, `call.transcription` (5 stages), `call.hangup`; imports all Phase 2 constants |
| `tests/api/webhooks.test.ts` | Tests for all conversation stages | ✓ VERIFIED | Contains tests for: `name_capture` stage, `GREETING_STEP_1`, `startFillerLoop`, consent parsing, max-clarification bypass, silence timer — 158 tests pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `call-state.ts` | `webhooks.ts` | `initCall` populates new fields (callerName, smsConsent, silenceNudgeTimer) | ✓ WIRED | `initCall` called at `call.answered`; `updateCall` sets `callerName`, `smsConsent`, `consentTimestamp`, `consentMethod` in transcript handlers; `silenceNudgeTimer` managed by `resetSilenceTimer()` |
| `greeting.ts` | `webhooks.ts` | `GREETING_STEP_1` replaces old `GREETING.en` | ✓ WIRED | `GREETING_STEP_1` spoken in `call.answered` handler; `GREETING_STEP_2`/`GREETING_STEP_2_FALLBACK` spoken in `name_capture` handler; `TCPA_CONSENT_ASK` spoken in `intake` and max-clarification handlers |
| `filler.ts` | `webhooks.ts` | `startFillerLoop` called during searching stage | ✓ WIRED | `startFillerLoop(speakFn, 'en')` called in `consent` stage handler; handle stored in `_fillerLoops` map; `fillerHandle.stop()` called on `call.hangup` |
| `voice-config.ts` | `webhooks.ts` | `TELNYX_VOICE_STRING` replaces `ELEVENLABS_VOICE_STRING` | ✓ WIRED | `TELNYX_VOICE_STRING` used in `speak()` helper; `TELNYX_STT_CONFIG` passed to `startTranscription`; `SILENCE_NUDGE_MS` used in `resetSilenceTimer` |
| `voice-config.ts` | `murphy-system.ts` (indirect) | `buildMurphySystemPrompt` called by orchestrator | ✓ WIRED | `buildMurphySystemPrompt` imported and used in `src/lib/ai/orchestrator.ts` (verified via existing test suite) |
| `greeting.ts` `OFF_TOPIC_REDIRECT` | `webhooks.ts` active dispatch | Called when caller goes off-topic | ⚠️ PARTIAL | Imported and `void`-cast in `webhooks.ts:38-39`; not wired into an active dispatch branch. Will not fire during a real call. Plan 03 acceptance criteria only required "imported and available" — this is an architectural stub for Phase 3 wiring. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VOICE-01 | 02-01, 02-03 | User calls Telnyx number and agent answers with a greeting | ✓ SATISFIED | `call.answered` speaks `GREETING_STEP_1` via `TELNYX_VOICE_STRING`; `startTranscription` with Telnyx Whisper STT starts immediately |
| VOICE-02 | 02-02, 02-03 | Agent captures user intent from natural speech (service type, location, urgency) | ✓ SATISFIED | `extractIntent()` in `intake` stage extracts `serviceType`, `location`, `urgency`; `isIntentComplete()` checks completeness; Murphy system prompt instructs intent capture |
| VOICE-03 | 02-01, 02-02, 02-03 | Agent asks smart clarifying questions when intent is ambiguous | ✓ SATISFIED | Clarification turn 0 uses `getDisambiguationPrompt`; turn 1 uses open-ended "Could you tell me a bit more..."; `shouldAdvancePastClarification` threshold `>= 2` enforced |
| VOICE-04 | 02-02, 02-03 | Agent responds with sub-second perceived latency (streaming TTS) | ? NEEDS HUMAN | `TELNYX_VOICE_STRING = 'Telnyx.KokoroTTS.am_adam'` with KokoroTTS is configured for streaming; actual perceived latency requires a live call |
| VOICE-05 | 02-01, 02-03 | Agent uses filler speech during tool calls to avoid dead air | ✓ SATISFIED | `startFillerLoop` fires immediately with a filler, then every 10s; 18-phrase pool; escalation at 10s/20s marks |

**Orphaned requirements:** None. All five VOICE-0x IDs appear in plan frontmatter and are accounted for. No additional Phase 2 requirements exist in REQUIREMENTS.md traceability table.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/api/webhooks.ts` | 37-39 | `void OFF_TOPIC_REDIRECT; void CONFUSED_CALLER_EXPLAINER;` — imported but not dispatched | ⚠️ Warning | Off-topic callers will fall through to the default log line rather than hearing the redirect phrase. Not a blocker per Plan 03 acceptance criteria (required only "imported and available"), but the feature is not live. |
| `src/api/webhooks.ts` | 260 | `// Phase 3: executeSearchTool(callControlId, state.intent)` — comment-only stub | ℹ️ Info | Expected — Phase 3 (provider search) is the next phase. Filler loop starts but search never fires. No impact on Phase 2 goal. |

---

### Human Verification Required

#### 1. Two-Step Greeting — Live Call

**Test:** Call the configured Telnyx number. Wait for the call to connect.
**Expected:** Within 2 seconds hear "Hi, I'm Murphy — an AI assistant from OpenClaw Service Matchmaker. Who am I speaking with?" — then after answering with a name hear the personalised service question using that name.
**Why human:** KokoroTTS voice quality, actual latency of Telnyx STT/TTS pipeline, and microphone/codec interaction cannot be unit-tested.

#### 2. Intent Capture in Two Turns — Live Call

**Test:** Say something ambiguous ("I need help around the house") and observe the clarification exchange.
**Expected:** Murphy asks one focused clarification question. If still ambiguous after two tries, Murphy says "I'll search for general home repair services near your area and we'll narrow it down from what I find."
**Why human:** `extractIntent()` is a rule-based module but its accuracy against real speech depends on STT transcription quality.

#### 3. Silence Detection — Live Call

**Test:** After giving a name, stay silent for 10+ seconds.
**Expected:** After 8s hear "Still there?". Ignore it. After another 8s hear it again. Ignore again. Murphy speaks the graceful hangup and the call ends.
**Why human:** `setTimeout`-based silence detection is fully mocked in unit tests. Real call timing and audio silence must be verified.

#### 4. Streaming TTS Latency — VOICE-04

**Test:** Say a clear intent ("I need a plumber in Austin"). Time from end of utterance to Murphy's confirmation reply.
**Expected:** No perceptible gap — feels immediate to the caller (sub-second perceived latency).
**Why human:** VOICE-04 is a perceptual quality bar. Automated tests assert the speak call fires but cannot measure human-perceptible latency.

#### 5. Off-Topic Redirect — Currently Not Active

**Test:** After the greeting, say "What is the weather in Paris?"
**Expected per phase goal:** Murphy says "I only handle finding service providers — plumbers, electricians, and the like. Is there a service provider I can help you find?"
**Actual current behaviour:** Murphy will log "Transcription processed" and stay silent (falls through to the default log line). `OFF_TOPIC_REDIRECT` is imported but not dispatched in any branch.
**Why human:** This gap requires human confirmation of acceptable scope — Plan 03 acceptance criteria only required the constant to be imported. If the phase goal requires active off-topic dispatch, a gap-closure plan is needed.

---

### Summary

Phase 2 automated implementation is solid: all foundational state, constants, voice config, Murphy system prompt, and webhook lifecycle are correctly implemented and tested (158 tests, 0 TypeScript errors). The conversation flow from greeting through name capture, intent extraction, two-turn clarification, TCPA consent, and filler loop is fully wired and substantive.

Two items require human validation before the phase is fully closed:

1. **VOICE-04 streaming latency** — cannot be measured programmatically. Architecture (KokoroTTS via Telnyx native) is correct but live call quality is the real test.

2. **OFF_TOPIC_REDIRECT active dispatch** — the constant is imported and defined correctly, but `webhooks.ts` does not dispatch to it in any branch. The Plan 03 acceptance criteria only required "imported and available," so this was within scope. However, the phase goal states "clarifying questions are asked when intent is ambiguous" which implies graceful off-topic handling. Human confirmation is needed on whether the void-cast constitutes acceptable deferred wiring or requires a gap-closure plan.

---

_Verified: 2026-03-15T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
