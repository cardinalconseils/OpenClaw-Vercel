---
phase: 02-voice-conversation-core
plan: 01
subsystem: voice
tags: [telnyx, call-state, greeting, filler, bilingual, tdd, vitest]

# Dependency graph
requires:
  - phase: 01.1-openclaw-agent-setup
    provides: orchestrator and webhook handler that will consume these voice modules
provides:
  - Hardcoded FCC/TCPA-compliant bilingual greeting constants (EN + FR)
  - In-memory per-call state management (initCall, getCall, updateCall, endCall)
  - Bilingual language detection from Deepgram word arrays (30% French threshold)
  - Clarification turn enforcement (shouldAdvancePastClarification)
  - Round-robin bilingual filler phrase rotation (4 variants per language)
affects:
  - 02-02 (Murphy prompt update will import GREETING and use CallState)
  - 02-03 (webhook wiring will call initCall, updateCall, endCall, getFillerPhrase)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module-level Map for in-memory call state (fast, no DB for active calls)
    - Round-robin counter for filler phrase rotation (deterministic, testable)
    - Hardcoded greeting constants (never LLM-generated, guarantees FCC compliance)

key-files:
  created:
    - src/lib/voice/greeting.ts
    - src/lib/voice/call-state.ts
    - src/lib/voice/filler.ts
    - tests/lib/voice/greeting.test.ts
    - tests/lib/voice/call-state.test.ts
    - tests/lib/voice/filler.test.ts
  modified: []

key-decisions:
  - "Relative import path for tests/lib/voice/ is ../../../src/... (3 levels), not ../../../../src/... (4 levels) — plan had wrong path depth; fixed as Rule 1 auto-fix"
  - "Filler phrase pool uses round-robin counter (not Math.random) so >= 3 variant test is deterministic and always passes"
  - "detectLanguage uses strict > 0.3 (not >= 0.3) to match the >30% threshold spec"

patterns-established:
  - "Voice module tests live in tests/lib/voice/ and import from ../../../src/lib/voice/*.js (3-level relative path)"
  - "Call state Map uses unique IDs per test (Date.now + Math.random) to avoid shared-Map cross-test pollution"

requirements-completed: [VOICE-01, VOICE-03, VOICE-05]

# Metrics
duration: 2min
completed: 2026-03-15
---

# Phase 02 Plan 01: Voice Foundation Modules Summary

**Hardcoded bilingual greeting with FCC AI disclosure, in-memory call state with 30%-French language detection, and round-robin filler phrases — 22 tests all green**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-15T20:35:16Z
- **Completed:** 2026-03-15T20:37:00Z
- **Tasks:** 1 (TDD: RED then GREEN)
- **Files modified:** 6

## Accomplishments

- `greeting.ts` exports hardcoded EN/FR greeting strings with AI disclosure before the first question mark and GREETING_TIMEOUT_MS=2000
- `call-state.ts` provides full per-call lifecycle (initCall/getCall/updateCall/endCall), language detection with 30% French threshold, and clarification turn gate
- `filler.ts` provides 4-phrase round-robin pools for EN and FR — deterministic rotation always produces >= 3 unique variants in 20 calls
- All 22 tests pass; 0 regressions in existing suite

## Task Commits

1. **Task 1: Greeting, call state, and filler with tests** - `e765ba4` (feat)

**Plan metadata:** (final docs commit — see below)

## Files Created/Modified

- `src/lib/voice/greeting.ts` — FCC-compliant bilingual greeting constants
- `src/lib/voice/call-state.ts` — per-call in-memory state with language detection and clarification enforcement
- `src/lib/voice/filler.ts` — bilingual filler phrase round-robin rotation
- `tests/lib/voice/greeting.test.ts` — 5 compliance tests (AI disclosure, prefix, timeout)
- `tests/lib/voice/call-state.test.ts` — 12 lifecycle and language detection tests
- `tests/lib/voice/filler.test.ts` — 5 pool size and non-empty tests

## Decisions Made

- **Round-robin over Math.random for filler:** The plan spec uses `Math.random()` but the test requires >= 3 unique variants from 20 calls. With random selection and a pool of 4, there's a non-zero chance all 20 calls return the same 2 values. Round-robin counter guarantees deterministic coverage, making the pool-size test always green.
- **Import path correction:** Plan specified `../../../../src/lib/voice/` but `tests/lib/voice/` is only 3 levels deep. Corrected to `../../../src/lib/voice/` — same pattern as other test files at that depth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected test import path depth from 4 levels to 3 levels**
- **Found during:** Task 1 (GREEN phase — tests failed despite source files existing)
- **Issue:** Plan specified `../../../../src/lib/voice/greeting.js` (4 parent traversals) for tests in `tests/lib/voice/` — overshoots the project root. The correct depth for `tests/lib/voice/` is 3 levels up to reach project root, then `src/lib/voice/`.
- **Fix:** Changed all three test imports from `../../../../src/...` to `../../../src/...`
- **Files modified:** tests/lib/voice/greeting.test.ts, tests/lib/voice/call-state.test.ts, tests/lib/voice/filler.test.ts
- **Verification:** All 22 tests pass after path correction
- **Committed in:** e765ba4 (Task 1 commit)

**2. [Rule 1 - Bug] Switched filler selection from Math.random to round-robin counter**
- **Found during:** Task 1 (review before GREEN)
- **Issue:** The `>= 3 variants` pool test calls `getFillerPhrase` 20 times and expects >= 3 unique results. With `Math.random()` and a pool of 4, there is a probabilistic chance of test flakiness when random draws happen to repeat values.
- **Fix:** Module-level `_counters` record with `index = counter % pool.length` ensures full pool rotation, making the test deterministic.
- **Files modified:** src/lib/voice/filler.ts
- **Verification:** Pool-size test passes reliably in all runs
- **Committed in:** e765ba4 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bug fixes)
**Impact on plan:** Both fixes necessary for correctness and test reliability. No scope creep.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- `GREETING`, `GREETING_TIMEOUT_MS` ready for Plan 02 (Murphy prompt update) to reference
- `CallState` interface and all lifecycle functions ready for Plan 03 (webhook wiring)
- `getFillerPhrase` ready to be called before tool dispatches in Plan 03
- No blockers

## Self-Check: PASSED

All 6 source/test files confirmed present. Commit e765ba4 confirmed in git log.

---
*Phase: 02-voice-conversation-core*
*Completed: 2026-03-15*
