---
phase: 02-voice-conversation-core
plan: "01"
subsystem: voice
tags: [call-state, greeting, filler, tcpa, tdd]
dependency_graph:
  requires: []
  provides: [extended-call-state, two-step-greeting, filler-loop]
  affects: [src/api/webhooks.ts]
tech_stack:
  added: []
  patterns: [TDD red-green, round-robin filler rotation, timer handle pattern]
key_files:
  created: []
  modified:
    - src/lib/voice/call-state.ts
    - src/lib/voice/greeting.ts
    - src/lib/voice/filler.ts
    - tests/lib/voice/call-state.test.ts
    - tests/lib/voice/greeting.test.ts
    - tests/lib/voice/filler.test.ts
    - src/api/webhooks.ts
    - tests/api/webhooks.test.ts
decisions:
  - "shouldAdvancePastClarification threshold raised from >= 1 to >= 2 per CONTEXT.md 2-turn clarification max design"
  - "GREETING record (bilingual) removed entirely — French deferred to LANG-02; GREETING_STEP_1 replaces GREETING.en in webhooks.ts"
  - "FILLERS_EN exported for test assertions — makes pool count verifiable without internal implementation access"
  - "stopFillerLoop() added as named function wrapping handle.stop() — consistent API, easier to mock in tests"
metrics:
  duration: 212s
  completed: "2026-03-16"
  tasks_completed: 1
  files_changed: 8
---

# Phase 02 Plan 01: Extend CallState, Greeting Constants, and Filler Pool Summary

Extended call-state, greeting constants, and filler pool to support two-step greeting flow, TCPA consent tracking, silence detection, off-topic redirect, confused caller explainer, 18-phrase filler rotation, and 10-second filler loop with escalation — all via TDD (RED then GREEN).

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Extend CallState, greeting constants, and filler pool with TDD | 87e1075 | 8 files |

## Decisions Made

1. **shouldAdvancePastClarification threshold >= 2** — CONTEXT.md specifies "2-turn clarification max". Changed from `>= 1` to `>= 2` so the first clarification question can still be asked at turn 1.

2. **GREETING bilingual record removed** — French greeting deferred to LANG-02 (v2 requirements). `GREETING_STEP_1` replaces `GREETING.en` in `webhooks.ts`. Plan 03 will wire the full two-step flow.

3. **FILLERS_EN exported** — Makes pool size verifiable from tests without accessing private FILLERS map. Follows the "test behavior via public API" pattern.

4. **stopFillerLoop() as named function** — Wraps `handle.stop()` for a consistent API surface. Easy to mock and stub in integration tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken import in webhooks.ts after removing GREETING export**
- **Found during:** Task 1 implementation (after replacing greeting.ts)
- **Issue:** `webhooks.ts` imported `GREETING` which was removed; `GREETING.en` reference would cause runtime crash
- **Fix:** Updated import to `GREETING_STEP_1`; updated speak payload reference
- **Files modified:** `src/api/webhooks.ts`
- **Commit:** 87e1075

**2. [Rule 1 - Bug] Fixed incomplete CallState objects in webhooks integration test**
- **Found during:** TypeScript typecheck after implementing new CallState fields
- **Issue:** `tests/api/webhooks.test.ts` mock `getCall` return values missing 6 new required fields, causing TS errors
- **Fix:** Added all 6 new fields (callerName, smsConsent, consentTimestamp, consentMethod, silenceNudgeTimer, silenceNudgeCount) to all mock state objects
- **Files modified:** `tests/api/webhooks.test.ts`
- **Commit:** 87e1075

### Out-of-Scope Items Noted

- `ELEVENLABS_VOICE_STRING` not exported from `voice-config.ts` — pre-existing TS error, unrelated to this plan. Deferred.

## Verification Results

- `npx vitest run tests/lib/voice/` — 68 tests passed (5 test files)
- `grep 'callerName' src/lib/voice/call-state.ts` — match found
- `grep 'GREETING_STEP_1' src/lib/voice/greeting.ts` — match found
- `grep 'FILLER_ESCALATION_10S' src/lib/voice/filler.ts` — match found
- `grep -c 'GREETING:' src/lib/voice/greeting.ts` — 0 (old export removed)
- `grep 'OFF_TOPIC_REDIRECT' src/lib/voice/greeting.ts` — match found
- `grep 'CONFUSED_CALLER_EXPLAINER' src/lib/voice/greeting.ts` — match found
- `grep 'startFillerLoop' src/lib/voice/filler.ts` — match found

## Self-Check: PASSED
