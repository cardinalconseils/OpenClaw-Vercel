---
phase: 04-outbound-provider-calling
plan: 01
subsystem: voice/outbound
tags: [outbound-calling, cascade, amd, tts, sms, telnyx, tdd]
dependency_graph:
  requires:
    - src/lib/voice/voice-config.ts
    - src/lib/voice/call-state.ts
    - src/lib/voice/telnyx-client.ts
    - src/lib/tools/handlers/search.ts
  provides:
    - src/lib/voice/outbound-caller.ts
  affects:
    - src/api/webhooks.ts (cascade entry point wiring in next plan)
tech_stack:
  added: []
  patterns:
    - "setInterval narration timer with {stop} handle (mirrors filler.ts FillerLoopHandle)"
    - "base64 JSON client_state for Telnyx webhook routing"
    - "TDD: RED commit (failing tests) then GREEN commit (implementation)"
key_files:
  created:
    - src/lib/voice/outbound-caller.ts
    - src/lib/voice/outbound-caller.test.ts
  modified:
    - src/lib/voice/voice-config.ts
    - src/lib/voice/call-state.ts
decisions:
  - "PROVIDER_RING_TIMEOUT_MS = 25_000 — 25s (~5 rings) is the locked cascade timeout per plan spec"
  - "NARRATION_INTERVAL_MS = 17_000 — 17s falls within the 15-20s user update window"
  - "MAX_CASCADE_PROVIDERS = 4 — max providers before NO_MATCH_MESSAGE per plan spec"
  - "AI_INTRO required as first utterance on provider answer — CA SB-1001 / FCC automated call disclosure"
  - "sendProviderSms is non-fatal — SMS failure logs and continues to dial"
  - "decodeClientState returns {} for invalid input — safe no-op for malformed webhooks"
  - "mockReset() required in tryNextProvider test to clear prior mockReturnValueOnce chains from earlier tests in same file"
metrics:
  duration: "291s (~5 min)"
  completed_date: "2026-03-16"
  tasks_completed: 2
  files_changed: 4
---

# Phase 04 Plan 01: Outbound Provider Calling Module Summary

**One-liner:** Sequential provider cascade with AMD voicemail detection, 17s narration timer, SMS pre-notification, and AI legal disclosure intro — all driven from a single `startOutboundCascade()` entry point.

## What Was Built

- `src/lib/voice/outbound-caller.ts` — full cascade engine (340 lines)
  - `startOutboundCascade(userCallControlId)` — entry point, resets index, delegates to `tryNextProvider`
  - `tryNextProvider(userCallControlId)` — reads state, checks MAX_CASCADE_PROVIDERS, dials next or exhausts
  - `dialProvider(userCallControlId, provider, index)` — Telnyx `calls.dial()` with timeout_secs=25, AMD=detect_words, base64 client_state
  - `handleProviderAnswer(providerCallControlId, clientState)` — AI_INTRO as first utterance (legal compliance)
  - `handleAmdResult(providerCallControlId, result, clientState)` — hangs up on voicemail, cascades
  - `handleProviderHangup(providerCallControlId, cause, clientState)` — cascades on timeout/no_answer/user_busy
  - `sendProviderSms(provider, state)` — pre-dial SMS via `messages.send()` (non-fatal)
  - `startNarrationTimer(userCallControlId, providerName)` — 17s interval user status updates
  - `stopNarrationTimer(userCallControlId)` — clears timer and removes from module map
  - `parseAvailability(transcript)` — regex-based 'available'|'unavailable'|'unclear'
  - `decodeClientState(raw)` — base64 JSON decode with safe fallback

- `src/lib/voice/outbound-caller.test.ts` — 34 unit tests, all passing
  - Full coverage of CALL-01 through CALL-07 behaviors
  - Mocks: getTelnyxClient (calls.dial, calls.actions.speak/hangup, messages.send), getCall, updateCall

- `src/lib/voice/voice-config.ts` updates:
  - `PROVIDER_RING_TIMEOUT_MS` changed from 30_000 to 25_000
  - Added `PROVIDER_RING_TIMEOUT_SECS = 25` (integer for Telnyx timeout_secs param)
  - Added `MAX_CASCADE_PROVIDERS = 4`
  - Added `NARRATION_INTERVAL_MS = 17_000`

- `src/lib/voice/call-state.ts` updates:
  - Added `'calling'` to stage union
  - Added `providerCallControlId: string | undefined` field to CallState
  - Added `providerCallControlId: undefined` to initCall defaults

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test assertions to match actual Telnyx speak() call signature**

- **Found during:** Task 2, GREEN phase (test run)
- **Issue:** `mockSpeak` is `getTelnyxClient().calls.actions.speak(callControlId, { payload, voice, voice_settings })` — test assertions initially used `toHaveBeenCalledWith('user-ccid', NO_MATCH_MESSAGE)` (plain string), not the actual `{ payload: text, ... }` object shape
- **Fix:** Changed assertions to `expect.objectContaining({ payload: NO_MATCH_MESSAGE })`
- **Files modified:** src/lib/voice/outbound-caller.test.ts
- **Commit:** 5a23fff (included in GREEN commit)

**2. [Rule 1 - Bug] Added mockReset() for tryNextProvider exhaustion test**

- **Found during:** Task 2, GREEN phase (test run)
- **Issue:** `mockReturnValueOnce` chains from earlier tests in the same file were being consumed during the `tryNextProvider` exhaustion test, causing it to return the wrong state (index=1 instead of index=4)
- **Fix:** Added `mockGetCall.mockReset()` at the start of that specific test before setting the correct `mockReturnValue`
- **Files modified:** src/lib/voice/outbound-caller.test.ts
- **Commit:** 5a23fff

## Test Results

- **outbound-caller.test.ts:** 34/34 tests passing
- **Full suite:** 379/379 tests passing — no regressions

## Commits

| Hash | Type | Description |
|------|------|-------------|
| c1d2d8f | chore | Update voice-config and call-state for outbound calling stage |
| 5806d27 | test | Add failing tests for outbound-caller module (TDD RED) |
| 5a23fff | feat | Implement outbound-caller module with cascade, AMD, narration, SMS, availability parsing |

## Self-Check: PASSED
