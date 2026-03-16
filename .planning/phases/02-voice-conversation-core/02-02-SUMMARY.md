---
phase: 02-voice-conversation-core
plan: "02"
subsystem: voice
tags: [telnyx, tts, stt, murphy, prompt-engineering, tcpa, voice-config]

# Dependency graph
requires:
  - phase: 01.1-openclaw-agent-setup
    provides: applyVoiceModifiers and buildMurphySystemPrompt function signatures
provides:
  - Telnyx-native voice constants (TELNYX_VOICE_STRING, TELNYX_VOICE_SETTINGS, TELNYX_STT_CONFIG, SILENCE_NUDGE_MS)
  - Updated Murphy system prompt with two-step greeting, TCPA consent, 2-turn clarification with broad search bypass, off-topic redirect, confused caller explainer
affects: [02-03, webhooks, orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns: [Telnyx-native TTS using KokoroTTS, Whisper-based STT via Telnyx transcription engine]

key-files:
  created:
    - tests/lib/voice/voice-config.test.ts
    - tests/lib/ai/murphy-system.test.ts
  modified:
    - src/lib/voice/voice-config.ts
    - src/lib/ai/prompts/murphy-system.ts

key-decisions:
  - "TELNYX_VOICE_STRING = 'Telnyx.KokoroTTS.am_adam' — Telnyx-native KokoroTTS replaces ElevenLabs for telephony TTS"
  - "TWO clarifying questions maximum with broad search + narrate bypass — 'I'll search for general home repair services near you and we'll narrow it down from what I find.' No hedge phrase."
  - "Two-step greeting: AI identity first ('Who am I speaking with?'), then name-addressed service question"
  - "TCPA consent requested via SMS recap question before searching — optional, never pressured"
  - "SILENCE_NUDGE_MS = 8000 — 8s silence fires 'Still there?' nudge"
  - "webhooks.ts ELEVENLABS_VOICE_STRING import NOT updated in this plan — Plan 03 switches the import"

patterns-established:
  - "Voice constants centralized in voice-config.ts — single source of truth for Telnyx TTS/STT params"
  - "Murphy prompt sections named with ## headers — Off-Topic Requests, Confused Callers, Silence Handling, Urgency Detection, TCPA Consent"

requirements-completed: [VOICE-02, VOICE-03]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 02 Plan 02: Voice Config & Murphy Prompt Summary

**Telnyx-native TTS/STT constants replacing ElevenLabs/Deepgram, Murphy prompt upgraded with two-step greeting, TCPA consent, 2-turn clarification with broad search bypass, off-topic redirect, and confused caller explainer**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T02:42:03Z
- **Completed:** 2026-03-16T02:44:01Z
- **Tasks:** 1
- **Files modified:** 4 (2 source, 2 tests created)

## Accomplishments
- Replaced all ElevenLabs/Deepgram exports with Telnyx-native constants (TELNYX_VOICE_STRING, TELNYX_VOICE_SETTINGS, TELNYX_STT_CONFIG, SILENCE_NUDGE_MS)
- Updated Murphy system prompt with two-step greeting flow (name capture first), TWO clarification max with broad search + narrate bypass, TCPA SMS consent, silence handling, urgency detection, off-topic redirect, and confused caller explainer
- Added 24 tests covering all new behavior (12 voice-config, 12 murphy-system), all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate voice-config to Telnyx-native and update Murphy prompt** - `6b30f2f` (feat)

**Plan metadata:** (docs commit follows)

_Note: This was a TDD task — tests written first (RED: 19 failures), then implementation (GREEN: 24 passing)_

## Files Created/Modified
- `src/lib/voice/voice-config.ts` - Complete rewrite: ElevenLabs/Deepgram constants replaced with TELNYX_VOICE_STRING, TELNYX_VOICE_SETTINGS, TELNYX_STT_CONFIG, SILENCE_NUDGE_MS
- `src/lib/ai/prompts/murphy-system.ts` - Updated Murphy system prompt with 7 new sections
- `tests/lib/voice/voice-config.test.ts` - Created: 12 tests for Telnyx-native constants and removed ElevenLabs/Deepgram exports
- `tests/lib/ai/murphy-system.test.ts` - Created: 12 tests for Murphy prompt behavior

## Decisions Made
- TELNYX_VOICE_STRING uses KokoroTTS am_adam — Telnyx-native warm male voice matching Murphy persona
- webhooks.ts still imports ELEVENLABS_VOICE_STRING — Plan 03 will migrate that import (as specified in plan)
- Broad search bypass phrase is exact: "I'll search for general home repair services near you and we'll narrow it down from what I find." — No hedge per user decision

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- voice-config.ts exports Telnyx-native constants ready for Plan 03 to wire into webhooks.ts
- Murphy prompt reflects full conversation design — ready for integration testing
- Plan 03 must update webhooks.ts import from ELEVENLABS_VOICE_STRING to TELNYX_VOICE_STRING

---
*Phase: 02-voice-conversation-core*
*Completed: 2026-03-16*
