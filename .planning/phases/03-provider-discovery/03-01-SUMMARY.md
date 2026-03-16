---
phase: 03-provider-discovery
plan: 01
subsystem: api
tags: [google-places, geocoding, haversine, ranking, call-state]

requires:
  - phase: 02-voice-conversation-core
    provides: CallState, updateCall(), stage machine, intent flow

provides:
  - searchProviders() with real Google Places Text Search (New) integration
  - geocodeLocation() converting location strings to lat/lng via Geocoding API
  - haversineKm() straight-line distance formula
  - scoreProvider() urgency-aware ranking (normal: rating-first, emergency: proximity-first)
  - Provider interface with 11 fields
  - CallState.providers and CallState.currentProviderIndex fields

affects: [03-provider-discovery/02, 03-provider-discovery/03, 04-provider-calling]

tech-stack:
  added: []
  patterns:
    - "TDD: RED test commit → GREEN implementation commit"
    - "Radius expansion: 5km initial, expand to 25km when < 3 filtered results"
    - "Phone number filtering before scoring — useless providers excluded early"
    - "Urgency routing: Places rankPreference=DISTANCE for emergency, RELEVANCE for normal"
    - "CallState update via optional callControlId param — no circular dep"

key-files:
  created:
    - src/lib/tools/handlers/search.test.ts
  modified:
    - src/lib/tools/handlers/search.ts
    - src/lib/voice/call-state.ts
    - tests/lib/tools/registry.test.ts

key-decisions:
  - "scoreProvider normal weights: rating 40%, proximity 35%, reviews 15%, openNow*0.5 — rating-dominant for non-emergency"
  - "scoreProvider emergency weights: proximity 40%, openNow*1.5, rating 20%, reviews 10% — proximity+availability dominant"
  - "Radius expansion threshold: < 3 results after phone filtering triggers 25km expansion"
  - "GOOGLE_MAPS_API_KEY guard throws immediately — fail fast before network calls"
  - "callControlId optional param for CallState update — avoids circular dependency between search.ts and call-state.ts"
  - "Type-only import of Provider in call-state.ts — avoids circular import at runtime"

patterns-established:
  - "Google Places Text Search (New): POST to /v1/places:searchText with X-Goog-FieldMask header"
  - "PLACES_FIELD_MASK constant covers 8 fields: id, displayName, formattedAddress, location, rating, userRatingCount, nationalPhoneNumber, currentOpeningHours"

requirements-completed: [SRCH-01, SRCH-03, SRCH-04, SRCH-05]

duration: 7min
completed: 2026-03-16
---

# Phase 03 Plan 01: Provider Discovery — Google Places Search Summary

**Google Places Text Search with geocoding, haversine distance, urgency-aware scoring (rating-first normal / proximity-first emergency), and CallState.providers population**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-16T03:08:05Z
- **Completed:** 2026-03-16T03:15:10Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments
- Replaced stub `searchProviders()` with real Google Places Text Search (New) integration
- Geocoding via Google Geocoding API; haversine formula for straight-line distance
- Urgency-aware ranking: normal mode weights rating 40%/proximity 35%; emergency flips to proximity 40% with openNow boost
- Auto radius expansion: 5km initial search, expands to 25km if fewer than 3 phone-bearing results
- CallState extended with `providers: Provider[]` and `currentProviderIndex: number` fields
- 21 unit tests passing (100%)

## Task Commits

1. **Task 1 (RED): Failing tests for searchProviders, geocodeLocation, haversineKm, scoreProvider** - `335cbfd` (test)
2. **Task 1 (GREEN): Full implementation + registry test fix** - `8e472c6` (feat)

## Files Created/Modified
- `src/lib/tools/handlers/search.ts` - Full implementation: geocodeLocation, haversineKm, callPlacesApi, mapPlaceToProvider, scoreProvider, searchProviders
- `src/lib/voice/call-state.ts` - Added `providers: Provider[]` and `currentProviderIndex: number` to CallState interface and initCall()
- `src/lib/tools/handlers/search.test.ts` - 21 unit tests covering all exported functions
- `tests/lib/tools/registry.test.ts` - Mocked searchProviders to avoid requiring real API key in registry integration tests

## Decisions Made
- Rating weighted at 40% in normal mode — callers trust ratings more than distance when not in a hurry
- Proximity weighted at 40% in emergency mode — fast response matters most when urgent
- `callControlId` as optional param — avoids circular import between search.ts and call-state.ts
- Type-only import of Provider in call-state.ts — no runtime circular dependency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Registry tests broke when searchProviders became real**
- **Found during:** Task 1 (full suite run)
- **Issue:** `tests/lib/tools/registry.test.ts` called `executeTool('search_providers', ...)` directly; stub always resolved, real impl throws when `GOOGLE_MAPS_API_KEY` missing
- **Fix:** Added `vi.mock` for search handler in registry test — registry tests verify dispatch routing, not search logic
- **Files modified:** `tests/lib/tools/registry.test.ts`
- **Verification:** All 335 tests pass
- **Committed in:** `8e472c6` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary correctness fix for test isolation. No scope creep.

## Issues Encountered
- Initial test fixtures used 1-result mock responses, triggering radius expansion and consuming unmocked fetch calls. Fixed by providing 3-result fixtures for tests not specifically testing expansion behavior.

## User Setup Required
Environment variable needed:

```
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

Required scopes: Geocoding API + Places API (New).

## Next Phase Readiness
- `searchProviders()` returns a ranked `Provider[]` ready for narration (Plan 02)
- `CallState.providers` and `currentProviderIndex` wired and ready for webhook dispatch (Plan 03)
- No blockers for Phase 03 Plan 02

## Self-Check: PASSED

- FOUND: src/lib/tools/handlers/search.ts
- FOUND: src/lib/voice/call-state.ts
- FOUND: src/lib/tools/handlers/search.test.ts
- FOUND: .planning/phases/03-provider-discovery/03-01-SUMMARY.md
- FOUND commit: 335cbfd (TDD RED)
- FOUND commit: 8e472c6 (TDD GREEN + implementation)

---
*Phase: 03-provider-discovery*
*Completed: 2026-03-16*
