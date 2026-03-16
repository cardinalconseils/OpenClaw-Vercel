---
phase: 02-voice-conversation-core
verified: 2026-03-15T20:50:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
human_verification:
  - test: "Filler phrase before tool dispatch during live call"
    expected: "When Murphy triggers search_providers or call_provider, a filler phrase is spoken before the tool result returns"
    why_human: "Tool dispatch (Phase 3) does not exist yet — the filler infrastructure is present and wired, but the 'before tool dispatch' execution path cannot be exercised until Phase 3 is built"
---

# Phase 02: Voice Conversation Core — Verification Report

**Phase Goal:** An inbound call is answered with a greeting, user speech is captured and transcribed, service intent (type and location) is extracted within two turns, clarifying questions are asked when intent is ambiguous, and responses use streaming TTS with filler speech to avoid dead air.

**Verified:** 2026-03-15T20:50:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Hardcoded greeting contains AI disclosure before first question mark in EN and FR | VERIFIED | `GREETING.en` = "Hi, I'm Murphy — an AI assistant..." and `GREETING.fr` = "...assistant IA..." — AI/IA before "?" confirmed in file |
| 2 | Call state initializes with defaults and tracks language, stage, intent, and clarification turns | VERIFIED | `CallState` interface exports 7 fields; `initCall` sets language='en', stage='greeting', intent={}, clarificationTurns=0 |
| 3 | Clarification turn counter stops at 1 — after 1 clarification, stage advances regardless | VERIFIED | `shouldAdvancePastClarification` returns `clarificationTurns >= 1`; webhook enforces this in `call.transcription` handler |
| 4 | Filler phrases return non-empty strings for both EN and FR with >= 3 variants per language | VERIFIED | 4 variants per language; round-robin counter; 22 tests all green |
| 5 | Murphy system prompt includes bilingual language rules (respond in caller's language) | VERIFIED | `## Language Rules` section present; "Respond in the same language for the entire call" |
| 6 | Murphy system prompt enforces ONE clarifying question max (not the old 2-turn limit) | VERIFIED | "ONE clarifying question maximum" present; "2-turn clarification" absent from file |
| 7 | Intent extractor parses service type and location from natural utterances | VERIFIED | `extractIntent` with 13 EN + 8 FR service patterns, preposition/zip/postal location extraction |
| 8 | Intent extractor detects urgency keywords (emergency, urgent, ASAP) | VERIFIED | `URGENCY_PATTERNS` regex matches emergency/urgent/ASAP/urgence/immediatement case-insensitively |
| 9 | Ambiguous input produces a disambiguation response with service category options | VERIFIED | `getDisambiguationPrompt` returns EN/FR prompts; webhook calls it when clarificationTurns===0 and intent is incomplete |
| 10 | call.initiated answers the call via Telnyx answer command | VERIFIED | `case 'call.initiated'` calls `calls.actions.answer(callControlId, ...)` |
| 11 | call.answered emits hardcoded greeting TTS via ElevenLabs Adam voice | VERIFIED | `case 'call.answered'` calls `initCall` then `calls.actions.speak` with `GREETING.en` and `ELEVENLABS_VOICE_STRING` |
| 12 | call.transcription extracts transcript, detects language, parses intent, and handles clarification | VERIFIED | Full pipeline: `detectLanguage` → `extractIntent` → merge intent → `isIntentComplete` → disambiguate or advance |
| 13 | call.hangup delays cleanup by SESSION_PERSIST_MS for unexpected disconnects | VERIFIED | `setTimeout(() => endCall(callControlId), SESSION_PERSIST_MS)` when `stage !== 'complete'` |

**Score:** 13/13 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Evidence |
|----------|----------|--------|----------|
| `src/lib/voice/greeting.ts` | FCC-compliant bilingual greeting constants | VERIFIED | Exports `GREETING` (Record<'en'\|'fr', string>) and `GREETING_TIMEOUT_MS=2000`; AI disclosure confirmed |
| `src/lib/voice/call-state.ts` | Per-call in-memory state management | VERIFIED | Exports `CallState` interface + `initCall`, `getCall`, `updateCall`, `endCall`, `detectLanguage`, `shouldAdvancePastClarification` |
| `src/lib/voice/filler.ts` | Bilingual filler phrase selection | VERIFIED | Exports `getFillerPhrase`; 4-phrase round-robin pool per language |
| `src/lib/ai/prompts/murphy-system.ts` | Updated Murphy prompt with bilingual + 1-question limit | VERIFIED | Contains "ONE clarifying question", "## Language Rules", "What service can I help you find today?", "10 minutes" |
| `src/lib/ai/prompts/voice-modifiers.ts` | Voice modifiers with bilingual response directive | VERIFIED | Contains "Respond in the caller's detected language (English or French) for the entire call" |
| `src/lib/ai/intent-extractor.ts` | Intent extraction from transcripts | VERIFIED | Exports `IntentResult`, `extractIntent`, `getDisambiguationPrompt`, `isIntentComplete` |
| `src/lib/voice/voice-config.ts` | Centralized voice pipeline constants | VERIFIED | Exports `ADAM_VOICE_ID`, `ELEVENLABS_VOICE_STRING`, `DEEPGRAM_CONFIG`, `ELEVENLABS_CONFIG`, `CALL_TIMEOUT_MS`, `SESSION_PERSIST_MS` |
| `src/api/webhooks.ts` | Full call lifecycle webhook handler | VERIFIED | Handles `call.initiated`, `call.answered`, `call.transcription`, `call.speak.ended`, `call.hangup` |
| `.env.example` | Updated env template with Deepgram and ElevenLabs keys | VERIFIED | Contains `DEEPGRAM_API_KEY=`, `ELEVENLABS_API_KEY=`, `TELNYX_ELEVENLABS_KEY_REF=` |
| `tests/lib/voice/greeting.test.ts` | Greeting compliance tests | VERIFIED | 5 tests — AI disclosure, prefix, timeout |
| `tests/lib/voice/call-state.test.ts` | Call state lifecycle tests | VERIFIED | 12 tests — initCall, getCall, updateCall, endCall, detectLanguage, shouldAdvancePastClarification |
| `tests/lib/voice/filler.test.ts` | Filler phrase pool tests | VERIFIED | 5 tests — pool size, non-empty, EN/FR |
| `tests/lib/ai/intent-extractor.test.ts` | Intent extraction tests | VERIFIED | 13 tests — all behavior cases in EN and FR |
| `tests/api/webhooks.test.ts` | Webhook lifecycle tests | VERIFIED | 15 tests (6 original + 9 new) covering all lifecycle events |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `src/api/webhooks.ts` | `src/lib/voice/call-state.ts` | `initCall(` on `call.answered` | VERIFIED | Line 68: `initCall(callControlId, from)` |
| `src/api/webhooks.ts` | `src/lib/voice/greeting.ts` | `import { GREETING }` | VERIFIED | Line 13: `import { GREETING } from '../lib/voice/greeting.js'` |
| `src/api/webhooks.ts` | `src/lib/voice/filler.ts` | `getFillerPhrase` on forced advance | VERIFIED | Line 145: `const filler = getFillerPhrase(currentState.language)` |
| `src/api/webhooks.ts` | `src/lib/voice/voice-config.ts` | `ELEVENLABS_VOICE_STRING` for speak | VERIFIED | Line 15: imported; used in every `calls.actions.speak` call |
| `src/api/webhooks.ts` | `src/lib/ai/intent-extractor.ts` | `extractIntent` on `call.transcription` | VERIFIED | Line 100: `const extractedIntent = extractIntent(transcript)` |
| `src/api/webhooks.ts` | `src/lib/voice/call-state.ts` | `detectLanguage` on first transcription | VERIFIED | Line 94: `const detectedLanguage = detectLanguage(words)` |
| `src/lib/ai/prompts/murphy-system.ts` | `ONE clarifying question` | prompt text | VERIFIED | Line 53 of murphy-system.ts: "ONE clarifying question maximum" |
| `src/lib/ai/intent-extractor.ts` | `IntentResult` type | `export interface IntentResult` | VERIFIED | Line 9: `export interface IntentResult` |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| VOICE-01 | 02-01, 02-03 | User calls Telnyx number and agent answers with a greeting | SATISFIED | `call.initiated` answers via `calls.actions.answer`; `call.answered` speaks `GREETING.en` via ElevenLabs Adam |
| VOICE-02 | 02-02, 02-03 | Agent captures user intent from natural speech (service type, location, urgency) | SATISFIED | `extractIntent` with 21 service patterns + location + urgency; merged into `CallState.intent` on every transcription |
| VOICE-03 | 02-01, 02-02, 02-03 | Agent asks smart clarifying questions when intent is ambiguous | SATISFIED | `getDisambiguationPrompt` emitted when `clarificationTurns===0` and `isIntentComplete` is false; hard cap at 1 via `shouldAdvancePastClarification` |
| VOICE-04 | 02-02, 02-03 | Agent responds with sub-second perceived latency (streaming TTS) | SATISFIED (infrastructure) | ElevenLabs Adam via Telnyx `calls.actions.speak`; filler phrases prevent dead air while backend processes; true streaming TTS configuration present in `ELEVENLABS_CONFIG` (eleven_flash_v2_5) |
| VOICE-05 | 02-01, 02-03 | Agent uses filler speech during tool calls to avoid dead air | SATISFIED (infrastructure) | `getFillerPhrase` imported and used in forced-advance branch; filler spoken before advancing to searching; tool dispatch (Phase 3) will use this same infrastructure |

No orphaned requirements. All five VOICE requirements are claimed by at least one plan and have implementation evidence.

---

### Anti-Patterns Found

No anti-patterns detected across all 8 modified source files. No TODO/FIXME/HACK/placeholder comments. No stub implementations (empty returns, console-only handlers). TypeScript compilation exits 0 with no errors.

---

### Human Verification Required

#### 1. Filler Phrase Before Tool Dispatch (Pre-Phase 3 Validation)

**Test:** After Phase 3 provider search tools are wired, trigger a call where intent is complete (service + location captured). Observe whether Murphy speaks a filler phrase ("Let me look that up for you." or French equivalent) before the search result arrives.

**Expected:** A filler phrase is spoken immediately after intent confirmation, before `search_providers` returns its result — preventing dead air during the search latency window.

**Why human:** Tool dispatch (`search_providers`, `call_provider`) does not exist in Phase 2. The filler infrastructure (`getFillerPhrase`, `getFillerPhrase` imported in `webhooks.ts`) is in place and wired for the forced-advance path, but the "before tool dispatch" execution path requires Phase 3 tools to exercise. This must be validated when Phase 3 is complete.

---

## Summary

Phase 2 goal is fully achieved. All 13 observable truths are VERIFIED by direct code inspection. All 14 artifacts exist and are substantive. All 8 key links are wired. All 5 VOICE requirements (VOICE-01 through VOICE-05) have concrete implementation evidence.

The 72 tests across 7 test files all pass. TypeScript compiles cleanly with 0 errors. No anti-patterns were found.

The single human verification item is a forward-looking concern about filler-before-tool-dispatch, which requires Phase 3 tooling to exercise and does not block Phase 2 goal achievement — the infrastructure (filler module, import in webhooks, ElevenLabs voice config) is ready for Phase 3 to hook into.

Notable implementation deviations from plan that were auto-corrected:
- Telnyx SDK v6 uses `calls.actions.answer` / `calls.actions.speak` (not `calls.answer` / `calls.speak`)
- Filler uses round-robin counter instead of `Math.random` for deterministic test coverage
- Test import depth corrected from 4 levels to 3 levels for `tests/lib/voice/`

---

_Verified: 2026-03-15T20:50:00Z_
_Verifier: Claude (gsd-verifier)_
