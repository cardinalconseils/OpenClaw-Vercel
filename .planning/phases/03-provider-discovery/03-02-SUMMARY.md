---
phase: 03-provider-discovery
plan: 02
subsystem: voice
tags: [narration, tts, bilingual, tdd, vitest]

# Dependency graph
requires:
  - phase: 02-voice-conversation-core
    provides: greeting.ts/filler.ts pattern for hardcoded TTS string builders
provides:
  - Bilingual narration builder functions (EN/FR) for search result delivery
  - NarrationProvider interface (standalone, no search.ts dependency)
affects:
  - 03-provider-discovery (plans 03+): webhook handler calls these functions after searchProviders returns
  - phase-04: outbound calling narration may extend this module

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Hardcoded template string builders (not LLM-generated) for deterministic TTS output
    - Standalone interface (NarrationProvider) to avoid cross-plan import coupling during parallel execution
    - TDD red-green: failing tests committed before implementation

key-files:
  created:
    - src/lib/voice/narration.ts
    - src/lib/voice/narration.test.ts
  modified: []

key-decisions:
  - "NarrationProvider interface defined inline in narration.ts — avoids importing from search.ts which may not exist during parallel plan execution"
  - "distanceKm.toFixed(1) applied in buildNextProviderNarration — consistent 1dp formatting for spoken distance"
  - "buildSearchingFiller fires alongside generic filler loop as context-specific initial filler before results arrive"

patterns-established:
  - "Narration builders: pure functions accepting typed params, returning interpolated template strings, no side effects"
  - "Language switch: if (language === 'fr') { return FR_template; } return EN_template — matches filler.ts record pattern"

requirements-completed: [SRCH-06]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 03 Plan 02: Bilingual Narration Builders Summary

**Four deterministic EN/FR spoken-language template functions (buildResultNarration, buildNextProviderNarration, buildNoResultsNarration, buildSearchingFiller) for Murphy's search result delivery — 29 tests, zero LLM calls**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-16T03:08:07Z
- **Completed:** 2026-03-16T03:09:47Z
- **Tasks:** 1 (TDD: 2 commits — test + feat)
- **Files modified:** 2

## Accomplishments

- Four bilingual narration builder functions covering all search result scenarios
- NarrationProvider interface avoids premature coupling to search.ts (parallel plan safety)
- 29 unit tests covering EN and FR variants, distance formatting, no-template-literal assertions
- Full TDD flow: RED commit → GREEN commit, all tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing narration tests** - `b728e93` (test)
2. **Task 1 GREEN: Narration builder implementation** - `466142b` (feat)

## Files Created/Modified

- `/Users/pmc/Downloads/OpenClaw-Vercel/src/lib/voice/narration.ts` — Four narration builder functions + NarrationProvider interface
- `/Users/pmc/Downloads/OpenClaw-Vercel/src/lib/voice/narration.test.ts` — 29 vitest unit tests (EN + FR, all functions)

## Decisions Made

- `NarrationProvider` defined locally — search.ts (Plan 01) may not exist during parallel plan execution; avoids import error
- `distanceKm.toFixed(1)` applied in `buildNextProviderNarration` — consistent 1-decimal-place formatting for spoken distance (e.g., "1.5 km" not "1.5333333 km")
- `buildSearchingFiller` provides a context-specific first phrase alongside the generic `startFillerLoop` — caller hears "Searching for plumbers near Austin now" while results load

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing `search.test.ts` failures (20 tests) noted in full suite run — these failures predate this plan and are caused by the search.ts stub lacking a real Google Maps implementation. Out of scope for this plan; logged for awareness.

## Next Phase Readiness

- All 4 narration builder functions exported and tested — Plan 03 (searchProviders implementation) and the webhook handler can import these immediately
- `NarrationProvider` interface ready; when Plan 01 ships the `Provider` interface, the webhook handler can use it directly (compatible shape)
- No blockers for Phase 3 Plan 03

---
*Phase: 03-provider-discovery*
*Completed: 2026-03-16*
