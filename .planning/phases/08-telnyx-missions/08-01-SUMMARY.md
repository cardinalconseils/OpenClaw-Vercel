---
phase: 08-telnyx-missions
plan: 01
subsystem: database
tags: [supabase, typescript, zod, rate-limiter, token-bucket, missions, postgresql]

# Dependency graph
requires: []
provides:
  - Mission, MissionStep, MissionEventResult, MissionProgressEvent, MissionStatus, MissionChannel, MissionStepType, MissionStepStatus type definitions
  - MissionInputSchema Zod validator for tool call input
  - Lazy singleton Supabase client with env var guard and test reset
  - Full CRUD repo for missions and mission_events tables (camelCase <-> snake_case mapping)
  - Token bucket rate limiter: smsLimiter (1/sec), callLimiter (1/5sec)
  - SQL DDL migration for missions and mission_events tables with indexes
affects:
  - 08-02 (mission engine uses these types and repo)
  - 08-03 (mission planner uses Mission types)
  - 08-04 (scheduler uses rate limiter)
  - 08-05 (reporter uses MissionProgressEvent)

# Tech tracking
tech-stack:
  added:
    - "@supabase/supabase-js ^2.99.1"
  patterns:
    - "Lazy singleton client: let _client; export function getClient() { if (!_client) { validate env; _client = createClient(...) } return _client }"
    - "Test isolation: export resetXxxClient() that sets _client = undefined"
    - "DB mapping: rowToMission() and rowToStep() functions translate snake_case DB rows to camelCase TS interfaces"
    - "Token bucket: refill on every acquire(), calculate wait as (1 - tokens) / refillRatePerMs"

key-files:
  created:
    - src/types/mission.ts
    - src/types/mission.test.ts
    - src/lib/db/supabase-client.ts
    - src/lib/db/supabase-client.test.ts
    - src/lib/db/missions-repo.ts
    - src/lib/db/missions-repo.test.ts
    - src/lib/missions/rate-limiter.ts
    - src/lib/missions/rate-limiter.test.ts
    - bin/migrations/001-missions.sql
  modified:
    - vitest.config.ts (added src/**/*.test.ts to include pattern)
    - package.json (added @supabase/supabase-js)

key-decisions:
  - "vitest.config.ts updated to include src/**/*.test.ts alongside tests/**/*.test.ts — enables co-located test files per project convention"
  - "Supabase client follows same lazy-singleton pattern as llm-clients.ts — resetSupabaseClient() exported for test isolation"
  - "DB row mapping via dedicated rowToMission() and rowToStep() functions — keeps repo functions clean and camelCase throughout"
  - "TokenBucketRateLimiter pre-configured instances exported as module-level singletons — smsLimiter and callLimiter reused across the codebase"

patterns-established:
  - "Pattern: Co-located test files (*.test.ts next to *.ts) — vitest.config.ts now scans src/**/*.test.ts"
  - "Pattern: Lazy Supabase singleton with resetXxx() for test isolation"
  - "Pattern: rowToXxx() mapping functions for DB <-> TS interface translation"

requirements-completed:
  - MISSION-06

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 8 Plan 01: Mission Foundation Summary

**Supabase client singleton, Mission type system with Zod schemas, CRUD repository with camelCase/snake_case mapping, token bucket rate limiter (smsLimiter 1/sec, callLimiter 1/5sec), and SQL DDL for missions/mission_events tables**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-16T00:21:59Z
- **Completed:** 2026-03-16T00:25:12Z
- **Tasks:** 2
- **Files modified:** 11 (9 created, 2 modified)

## Accomplishments

- Full mission type system: MissionStatus, MissionChannel, MissionStepType, MissionStepStatus unions plus Mission, MissionStep, MissionEventResult, MissionProgressEvent interfaces and MissionInputSchema Zod validator
- Lazy Supabase client singleton with env var validation (throws with '[supabase] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set') and resetSupabaseClient() for test isolation
- Full missions CRUD repository with snake_case DB column mapping: createMission, getMission, updateMissionStatus, createMissionEvent, getMissionEvents, updateMissionEvent
- Token bucket rate limiter with smsLimiter (1/sec) and callLimiter (1/5sec) singletons
- SQL migration script for missions and mission_events tables with indexes on user_id, status, mission_id, and call_leg_id
- 27 new tests passing across 4 test files; full suite 108 tests green; tsc --noEmit clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Mission types, Supabase client, and DB migration** - `35bc786` (feat)
2. **Task 2: Missions CRUD repo and token bucket rate limiter** - `b934586` (feat)

_TDD: both tasks followed RED -> GREEN cycle_

## Files Created/Modified

- `src/types/mission.ts` - Mission, MissionStep, MissionEventResult, MissionProgressEvent interfaces; MissionStatus, MissionChannel, MissionStepType, MissionStepStatus union types; MissionInputSchema Zod validator
- `src/types/mission.test.ts` - Type shape and Zod schema validation tests (12 tests)
- `src/lib/db/supabase-client.ts` - Lazy singleton getSupabaseClient() with env validation, resetSupabaseClient() for test isolation
- `src/lib/db/supabase-client.test.ts` - Singleton behavior and env var guard tests (4 tests)
- `src/lib/db/missions-repo.ts` - createMission, getMission, updateMissionStatus, createMissionEvent, getMissionEvents, updateMissionEvent with rowToMission/rowToStep mapping
- `src/lib/db/missions-repo.test.ts` - Mocked Supabase chain tests verifying table names, column mapping, ordering (7 tests)
- `src/lib/missions/rate-limiter.ts` - TokenBucketRateLimiter class, smsLimiter and callLimiter singleton exports
- `src/lib/missions/rate-limiter.test.ts` - Immediate first acquire and ~1000ms delay tests (4 tests)
- `bin/migrations/001-missions.sql` - DDL for missions and mission_events with IF NOT EXISTS and indexes
- `vitest.config.ts` - Added src/**/*.test.ts include pattern
- `package.json` - Added @supabase/supabase-js ^2.99.1

## Decisions Made

- vitest.config.ts updated to include `src/**/*.test.ts` so co-located test files work (plan places tests next to source, config only had `tests/**/*.test.ts`)
- Supabase client follows the llm-clients.ts lazy init pattern — consistent codebase-wide singleton approach
- Row mapping via rowToMission()/rowToStep() functions — cleaner than inline destructuring in each repo function
- Rate limiter singletons exported at module level — downstream code imports smsLimiter/callLimiter directly without constructing instances

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended vitest.config.ts include pattern**
- **Found during:** Task 1 (running test files)
- **Issue:** vitest.config.ts only included `tests/**/*.test.ts`; plan specified co-located test files in `src/`; tests would not be discovered
- **Fix:** Added `src/**/*.test.ts` to the `include` array in vitest.config.ts
- **Files modified:** vitest.config.ts
- **Verification:** `npx vitest run src/types/mission.test.ts` discovered and ran successfully
- **Committed in:** 35bc786 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required to discover and run co-located test files as specified in the plan. No scope creep.

## Issues Encountered

None beyond the vitest config deviation above.

## User Setup Required

Database migration must be applied manually to Supabase:
- Run `bin/migrations/001-missions.sql` in the Supabase dashboard SQL editor (or via psql)
- Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables set in .env

## Next Phase Readiness

- All downstream mission plans (08-02 through 08-05) can import from src/types/mission.ts and src/lib/db/
- smsLimiter and callLimiter ready for use in mission scheduler
- No blockers for 08-02 (mission engine)

---
*Phase: 08-telnyx-missions*
*Completed: 2026-03-16*
