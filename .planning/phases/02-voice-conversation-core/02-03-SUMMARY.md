---
phase: 02-voice-conversation-core
plan: "03"
subsystem: voice-pipeline-integration
tags:
  - telnyx
  - webhooks
  - voice-config
  - elevenlabs
  - deepgram
  - call-lifecycle
dependency_graph:
  requires:
    - 02-01  # greeting, call-state, filler modules
    - 02-02  # intent-extractor, murphy-system prompt
  provides:
    - Full Telnyx call lifecycle webhook handler
    - Centralized voice pipeline constants
  affects:
    - src/api/webhooks.ts
    - src/lib/voice/voice-config.ts
    - tests/api/webhooks.test.ts
    - tests/lib/ai/agent-integration.test.ts
tech_stack:
  added:
    - ElevenLabs Adam voice (pNInz6obpgDQGcFmaJgB) via Telnyx speak API
    - Deepgram Nova-3 multi-language STT config
  patterns:
    - setImmediate async processing with try/catch for webhook handler
    - SESSION_PERSIST_MS delayed cleanup for unexpected disconnects
    - calls.actions.answer / calls.actions.speak (Telnyx SDK v6 API)
    - Switch-case event dispatch in async IIFE
key_files:
  created:
    - src/lib/voice/voice-config.ts
  modified:
    - src/api/webhooks.ts
    - .env.example
    - tests/api/webhooks.test.ts
    - tests/lib/ai/agent-integration.test.ts
decisions:
  - "Telnyx SDK v6 uses calls.actions.answer / calls.actions.speak (not calls.answer / calls.speak) — discovered via TypeScript type check, corrected automatically"
  - "setTimeout spy approach used for session persistence test — vi.useFakeTimers can't control timers registered before the switch"
  - "agent-integration test updated to reflect new call.initiated behavior (answers call via Telnyx, no chat() call)"
metrics:
  duration: 308s
  completed: "2026-03-15"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 5
---

# Phase 02 Plan 03: Webhook Lifecycle Integration Summary

**One-liner:** Full Telnyx call lifecycle wired (answer, greet, transcribe, disambiguate, force-advance, session-persist) with centralized ElevenLabs Adam + Deepgram Nova-3 voice constants.

## What Was Built

### Task 1: Voice Config Module + .env.example Update

Created `src/lib/voice/voice-config.ts` with centralized constants:

- `ADAM_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'` — ElevenLabs Adam voice
- `ELEVENLABS_VOICE_STRING = 'ElevenLabs.Default.<voice_id>'` — Telnyx speak API format
- `DEEPGRAM_CONFIG` — nova-3, multi-language, 100ms endpointing, punctuate
- `ELEVENLABS_CONFIG` — eleven_flash_v2_5 model
- `CALL_TIMEOUT_MS = 10 * 60 * 1000` — 10-minute call cap
- `SESSION_PERSIST_MS = 30 * 60 * 1000` — 30-minute reconnect window

Updated `.env.example` with `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `TELNYX_ELEVENLABS_KEY_REF`.

### Task 2: Full Lifecycle Webhook Handler + Tests

Rewrote `src/api/webhooks.ts` from single-event to full switch/case lifecycle:

| Event | Action |
|-------|--------|
| `call.initiated` | `calls.actions.answer()` with base64 client_state |
| `call.answered` | `initCall()` + speak GREETING.en via ElevenLabs Adam |
| `call.transcription` | detectLanguage → extractIntent → merge intent → disambiguate or advance |
| `call.speak.ended` | Transition greeting → intake stage |
| `call.hangup` | Delay `endCall()` by SESSION_PERSIST_MS on unexpected disconnect; immediate on complete |

Transcription handler logic:
1. Language detection on first utterance (>30% French words = FR)
2. Intent extraction (regex-based, no LLM)
3. Merge extracted fields into state intent
4. Complete intent → advance to 'searching' + confirmation TTS
5. Incomplete, 0 clarifications → disambiguation prompt + increment turn
6. Incomplete, 1+ clarification → force advance to 'searching' + filler phrase

Added 9 new tests (Tests 7-15) covering all lifecycle events including:
- `call.hangup` session persistence (setTimeout spy approach)
- Language detection call verification
- Clarification turn logic (0 turns vs forced advance)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Telnyx SDK v6 API uses `calls.actions.answer/speak` not `calls.answer/speak`**
- **Found during:** TypeScript type check after Task 2
- **Issue:** Plan specified `calls.answer()` and `calls.speak()` but Telnyx SDK v6 exposes these under `calls.actions.answer()` and `calls.actions.speak()`
- **Fix:** Updated webhooks.ts to use correct `calls.actions.*` path; updated test mocks to match
- **Files modified:** `src/api/webhooks.ts`, `tests/api/webhooks.test.ts`, `tests/lib/ai/agent-integration.test.ts`
- **Commits:** 36ca5f1

**2. [Rule 1 - Bug] `vi.runAllImmediatesAsync` does not exist in Vitest 4.1**
- **Found during:** Task 2 test run
- **Issue:** Plan suggested using `vi.runAllImmediatesAsync()` to flush setImmediate in hangup test — not a real Vitest API
- **Fix:** Used `setTimeout` spy to capture and manually invoke the SESSION_PERSIST_MS callback, allowing precise verification without timer manipulation issues
- **Files modified:** `tests/api/webhooks.test.ts`

**3. [Rule 1 - Bug] Pre-existing agent-integration test expected old call.initiated → chat() behavior**
- **Found during:** Full test suite run after Task 2
- **Issue:** `tests/lib/ai/agent-integration.test.ts` expected `chat()` to be called on `call.initiated`, but the new handler answers the call via Telnyx SDK instead
- **Fix:** Updated integration test to verify `calls.actions.answer()` is called and `chat()` is NOT called
- **Files modified:** `tests/lib/ai/agent-integration.test.ts`

## Self-Check: PASSED

- src/lib/voice/voice-config.ts: FOUND
- src/api/webhooks.ts: FOUND
- .planning/phases/02-voice-conversation-core/02-03-SUMMARY.md: FOUND
- Commit cf44da3 (voice-config + env): FOUND
- Commit 36ca5f1 (webhook lifecycle + tests): FOUND
- 211/211 tests passing
- TypeScript compiles cleanly (0 errors)
