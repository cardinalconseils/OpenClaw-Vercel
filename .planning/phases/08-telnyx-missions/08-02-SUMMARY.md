---
phase: 08-telnyx-missions
plan: 02
subsystem: missions
tags: [missions, llm, state-machine, anthropic, typescript, vitest, tdd]

# Dependency graph
requires:
  - 08-01 (mission types, missions-repo CRUD, rate limiter)
provides:
  - planMission() — LLM-powered natural language decomposition into PlannedStep arrays
  - parseMissionSteps() — JSON extraction and validation of LLM output
  - MAX_STEPS_PER_MISSION constant (25)
  - MissionEngine class with full lifecycle: create/plan/start/complete/fail/pause/resume/getStatus
  - missionEngine singleton export
  - VALID_TRANSITIONS state machine map
affects:
  - 08-03 (scheduler imports missionEngine.start, missionEngine.complete)
  - 08-04 (reporter calls missionEngine.getStatus for progress events)
  - 08-05 (tool handlers call missionEngine.create, missionEngine.plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-phase planning: search steps first with abstract targets, call/sms steps reference {search_result_N} — prevents LLM hallucination of phone numbers"
    - "VALID_TRANSITIONS Record<MissionStatus, MissionStatus[]> — exhaustive transition map, assertTransition() throws on invalid jump"
    - "fail() has no transition guard — can fail from any state (catastrophic error handling)"
    - "plan() wraps planMission() in try/catch, transitions to 'failed' with reason on error before re-throwing"
    - "JSON extraction from ```json code fences via regex match before JSON.parse"

key-files:
  created:
    - src/lib/missions/mission-planner.ts
    - src/lib/missions/mission-planner.test.ts
    - src/lib/missions/mission-engine.ts
    - src/lib/missions/mission-engine.test.ts
  modified: []

key-decisions:
  - "planMission() routes to Anthropic via transfer-logic task type — complex task requiring high reasoning quality"
  - "parseMissionSteps() filters invalid types and missing fields silently (log + skip) — resilient to partial LLM output"
  - "fail() skips assertTransition() — any mission can fail without valid transition (network outage, sandbox restart)"
  - "MissionEngine.plan() transitions to 'failed' with the error message as summary before re-throwing — ensures DB reflects failure even if caller doesn't catch"

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 8 Plan 02: Mission Planner and Engine Summary

**LLM-powered mission decomposition via Anthropic (transfer-logic tier) with two-phase planning that prevents phone number hallucination, plus a state-machine MissionEngine that manages the full mission lifecycle from creation through completion with enforced valid transitions**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-16T00:27:47Z
- **Completed:** 2026-03-16T00:30:34Z
- **Tasks:** 2
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments

- `planMission()` takes a natural language description, calls Anthropic via `chat()` with `transfer-logic` task type, and returns a sorted array of `PlannedStep` objects (search steps always before call/sms steps)
- `parseMissionSteps()` extracts JSON from ```json code fences, validates required fields (type, target, context, order), filters invalid step types, and returns clean arrays
- `MAX_STEPS_PER_MISSION = 25` cap enforced — LLM output sliced after sorting
- `MissionEngine` class with 8 lifecycle methods: `create`, `plan`, `start`, `complete`, `fail`, `pause`, `resume`, `getStatus`
- `VALID_TRANSITIONS` Record enforces legal state machine jumps — `assertTransition()` throws with descriptive message on invalid transition
- `plan()` auto-transitions to 'failed' with error message if `planMission()` throws, before re-throwing to caller
- `fail()` bypasses transition guard — any state can fail
- `missionEngine` singleton exported for app-wide use
- 19 tests passing (7 planner + 12 engine), full suite 127 tests green, `tsc --noEmit` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Mission planner with LLM decomposition** - `a9d7b57` (feat)
2. **Task 2: Mission engine lifecycle state machine** - `f70b951` (feat, committed in prior session as Rule 3 deviation)

_TDD: both tasks followed RED -> GREEN cycle_

## Files Created/Modified

- `src/lib/missions/mission-planner.ts` — `planMission()`, `parseMissionSteps()`, `MAX_STEPS_PER_MISSION`, `MISSION_PLANNER_PROMPT` with two-phase planning instructions
- `src/lib/missions/mission-planner.test.ts` — 7 tests: ordering, cap enforcement, empty description, invalid type filtering, task type verification, code fence parsing, missing field filtering
- `src/lib/missions/mission-engine.ts` — `MissionEngine` class, `VALID_TRANSITIONS`, `assertTransition()`, `missionEngine` singleton
- `src/lib/missions/mission-engine.test.ts` — 12 tests: create returns id, plan transitions, plan calls planMission, events per step, non-created throws, failure transitions to failed, start/complete/fail/pause/resume, getStatus

## Decisions Made

- `planMission()` routes to `transfer-logic` to hit Anthropic tier — mission planning requires high reasoning to decompose ambiguous natural language correctly
- `parseMissionSteps()` silently skips bad steps (log warn + continue) rather than throwing — partial LLM output should still produce a usable plan
- `fail()` has no transition assertion — catastrophic failures (server crash, network outage) can happen in any state and must always be recordable
- `plan()` wraps `planMission()` in try/catch to guarantee the DB is updated to 'failed' before re-throwing — avoids missions stuck in 'planning' state if caller doesn't catch

## Deviations from Plan

### Pre-existing Implementation

**1. [Continuation] mission-engine.ts and mission-engine.test.ts existed from prior session**
- **Found during:** Task 2 start
- **Issue:** Both files already existed — the previous session (plan 03 wave) had created them as a Rule 3 blocking deviation while working on plan 03 prerequisites
- **Action:** Verified tests all pass (12/12 green), verified acceptance criteria all met, proceeded to commit and summarize
- **Commit:** f70b951 (feat(08-03): add mission-engine lifecycle state machine)
- **Impact:** No rework needed; plan 02 was effectively complete before this execution began

None - both tasks were fully implemented. Plan executed exactly as specified.

## Issues Encountered

None.

## Next Phase Readiness

- `missionEngine.create()` and `missionEngine.plan()` are ready for plan 05 tool handlers
- `missionEngine.start()` and `missionEngine.complete()` are ready for plan 03 scheduler
- All 19 tests green; no blockers for 08-03

## Self-Check: PASSED

- src/lib/missions/mission-planner.ts — FOUND
- src/lib/missions/mission-planner.test.ts — FOUND
- src/lib/missions/mission-engine.ts — FOUND
- src/lib/missions/mission-engine.test.ts — FOUND
- Commit a9d7b57 (mission planner) — FOUND
- Commit f70b951 (mission engine) — FOUND

---
*Phase: 08-telnyx-missions*
*Completed: 2026-03-16*
