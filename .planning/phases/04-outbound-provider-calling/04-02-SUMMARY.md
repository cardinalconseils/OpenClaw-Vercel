---
phase: 04-outbound-provider-calling
plan: 02
subsystem: telephony-webhook
tags: [webhooks, outbound-calling, AMD, cascade, direction-guard, dispatch]
dependency_graph:
  requires: [04-01]
  provides: [CALL-01, CALL-02, CALL-03, CALL-05, CALL-06, CALL-07]
  affects: [src/api/webhooks.ts, src/lib/tools/handlers/dispatch.ts]
tech_stack:
  added: []
  patterns: [direction-guard, client-state-routing, provider-leg-transcription, cascade-wiring]
key_files:
  created: []
  modified:
    - src/api/webhooks.ts
    - src/lib/tools/handlers/dispatch.ts
    - tests/api/webhooks.test.ts
    - tests/lib/ai/agent-integration.test.ts
decisions:
  - "direction === 'incoming' guard on call.initiated prevents outbound legs from being auto-answered"
  - "call.answered direction guard routes outbound legs to handleProviderAnswer + provider-leg transcription"
  - "call.transcription stage gate extended to include 'calling' to prevent user re-triggering during cascade"
  - "Provider-leg transcription uses decodeClientState(client_state).stage === 'provider-dial' for routing"
  - "consent handler calls startOutboundCascade instead of setting stage='complete' after narrating results"
  - "callProvider() in dispatch.ts validates call_control_id then delegates to startOutboundCascade"
  - "transferCall() remains STUB in dispatch.ts — real implementation deferred to Phase 5"
  - "Test fixtures updated: direction='incoming' (not 'inbound') to match Telnyx API values"
metrics:
  duration: 277s
  completed_date: "2026-03-16"
  tasks_completed: 2
  files_modified: 4
---

# Phase 04 Plan 02: Outbound Event Wiring + Dispatch Integration Summary

**One-liner:** Webhook direction guards, AMD handler, provider-leg transcription parsing, and outbound cascade wiring connecting the full calling loop from search results through to live call events.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire outbound event handlers into webhooks.ts | e8fdc28 | src/api/webhooks.ts, tests/api/webhooks.test.ts, tests/lib/ai/agent-integration.test.ts |
| 2 | Replace dispatch.ts stub with real outbound-caller integration | b038c75 | src/lib/tools/handlers/dispatch.ts |

## What Was Built

### webhooks.ts Changes

**Direction guard — call.initiated:**
```
direction === 'incoming' → answer call
direction !== 'incoming' → log only (outbound provider leg, no auto-answer)
```

**Direction guard — call.answered:**
```
direction === 'incoming' || !direction → inbound: initCall + GREETING_STEP_1 + startTranscription
direction === 'outgoing' → outbound: handleProviderAnswer + startTranscription on provider leg
```

**New case — call.machine.detection.ended:**
Routes AMD result to `handleAmdResult()` when `client_state.stage === 'provider-dial'`. Machine detection triggers cascade to next provider.

**Updated case — call.hangup:**
```
direction === 'outgoing' + client_state.stage === 'provider-dial' → handleProviderHangup (cascade)
direction === 'incoming' → existing inbound cleanup + stopNarrationTimer added
```

**Updated case — call.transcription:**
- Stage gate now includes `'calling'` to block user re-triggering during cascade
- Provider-leg transcription detected via `decodeClientState(client_state).stage === 'provider-dial'`
- `parseAvailability()` determines available / unavailable / unclear from provider speech
- Available: narrate success to user, update stage='complete', ready for Phase 5 bridge
- Unavailable: hang up provider leg, narrate to user, cascade via `tryNextProvider`

**Consent handler:**
Success path now calls `startOutboundCascade(callControlId)` instead of `updateCall({ stage: 'complete' })`. The cascade manages stage transitions internally (sets `'calling'` then `'complete'`).

### dispatch.ts Changes

Replaced `callProvider()` stub with real implementation:
1. Validates `call_control_id` present — returns `'error'` if missing
2. Checks providers list not empty via `getCall()` — returns `'no-providers'` if empty
3. Calls `startOutboundCascade(userCallControlId)` — returns `'cascade-started'` on success

`transferCall()` remains STUB for Phase 5 (conference bridge).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test fixtures from direction='inbound' to direction='incoming'**
- **Found during:** Task 1 — direction guard broke 2 tests that sent `call.initiated` without direction
- **Issue:** Existing tests used `direction: 'inbound'` (wrong Telnyx value) or omitted direction; both caused the new direction guard to skip auto-answer
- **Fix:** Added `direction: 'incoming'` to `makePayload('call.initiated', { direction: 'incoming' })` in webhooks.test.ts Test 7; added `direction: 'incoming'` to the agent-integration test's call.initiated payload; updated `VALID_PAYLOAD` and `makePayload` defaults from `'inbound'` to `'incoming'`
- **Files modified:** tests/api/webhooks.test.ts, tests/lib/ai/agent-integration.test.ts
- **Commit:** e8fdc28

**2. [Rule 1 - Bug] Removed unused PROVIDER_RING_TIMEOUT_MS import from dispatch.ts**
- **Found during:** Task 2 — the stub used this constant but the real implementation doesn't
- **Fix:** Removed the import; outbound timing is controlled by PROVIDER_RING_TIMEOUT_SECS in outbound-caller.ts
- **Files modified:** src/lib/tools/handlers/dispatch.ts
- **Commit:** b038c75

## Verification

```
grep "call.machine.detection.ended" src/api/webhooks.ts      → line 392 ✓
grep "direction.*incoming" src/api/webhooks.ts               → lines 134, 149 ✓
grep "startOutboundCascade" src/api/webhooks.ts dispatch.ts  → 4 matches ✓
grep "'calling'" src/api/webhooks.ts                         → line 227 ✓
grep "STUB" src/lib/tools/handlers/dispatch.ts               → transferCall only ✓
npx vitest run                                               → 379/379 passed ✓
```

## Self-Check: PASSED

- src/api/webhooks.ts: FOUND
- src/lib/tools/handlers/dispatch.ts: FOUND
- 04-02-SUMMARY.md: FOUND
- Commit e8fdc28: FOUND (webhooks.ts outbound event wiring)
- Commit b038c75: FOUND (dispatch.ts real implementation)
