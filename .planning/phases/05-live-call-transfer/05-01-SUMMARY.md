---
phase: 05-live-call-transfer
plan: "01"
subsystem: voice/dispatch
tags: [telnyx, bridge, call-transfer, call-state, tdd]
dependency_graph:
  requires: [04-outbound-provider-calling]
  provides: [bridgeToUser, TRANSFER_BRIEF, transferred-stage, pendingBridge]
  affects: [src/lib/voice/call-state.ts, src/lib/voice/outbound-caller.ts, src/lib/tools/handlers/dispatch.ts]
tech_stack:
  added: []
  patterns: [Telnyx calls.actions.bridge, post-transfer hangup guard, cascade cause expansion]
key_files:
  created: []
  modified:
    - src/lib/voice/call-state.ts
    - src/lib/voice/outbound-caller.ts
    - src/lib/voice/outbound-caller.test.ts
    - src/lib/tools/handlers/dispatch.ts
    - tests/api/webhooks.test.ts
    - frontend/tests/api/webhooks.test.ts
decisions:
  - "Telnyx bridge API uses call_control_id_to_bridge_with (not call_control_id) — SDK ActionBridgeParams verified at implementation time"
  - "normal_clearing added to cascadeCauses — provider may hang up before transfer; must cascade when stage is not transferred"
  - "pendingBridge field added to CallState as boolean — reserved for Plan 02 webhook wiring (set to false until bridge initiates)"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-21"
  tasks: 2
  files: 6
---

# Phase 05 Plan 01: Bridge Transfer Primitives Summary

Telnyx bridge primitives with post-transfer hangup guard and real transferCall implementation replacing Phase 4 stub.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend CallState and implement bridge transfer primitives (TDD) | fab5eff | call-state.ts, outbound-caller.ts, outbound-caller.test.ts, webhooks tests |
| 2 | Replace transferCall stub in dispatch.ts | 57dc88a | dispatch.ts |

## What Was Built

### CallState Extensions (call-state.ts)
- Added `'transferred'` stage to the stage union between `'calling'` and `'complete'`
- Added `pendingBridge: boolean` field to the `CallState` interface
- Initialized `pendingBridge: false` in `initCall()`

### Bridge Primitives (outbound-caller.ts)
- `TRANSFER_BRIEF(callerName, serviceType, location)` — builds spoken briefing string for the provider when user is being bridged; falls back to 'a customer' when callerName is undefined
- `bridgeToUser(providerCallControlId, userCallControlId)` — calls Telnyx `calls.actions.bridge` with `call_control_id_to_bridge_with` parameter
- `handleProviderHangup` updated with transferred-stage guard at the top of the function — returns early without cascading when stage is `'transferred'`
- `'normal_clearing'` added to `cascadeCauses` — provider hanging up before bridge should cascade to next provider

### dispatch.ts Real Implementation
- `transferCall` stub replaced with real implementation
- Validates `call_control_id` presence and active `providerCallControlId` in state
- Calls `bridgeToUser(state.providerCallControlId, userCallControlId)` on success
- Returns typed results: `bridge-initiated`, `error` (with specific notes)
- `TransferCallParams` extended with `call_control_id?: string`

### Tests (38 passing)
- `describe('TRANSFER_BRIEF')` — 2 tests: named caller, anonymous fallback
- `describe('bridgeToUser')` — 1 test: verifies `mockBridge` called with `call_control_id_to_bridge_with`
- `handleProviderHangup` — 2 new tests: cascades on normal_clearing when stage='calling', does NOT cascade when stage='transferred'
- All 38 tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Telnyx bridge API uses `call_control_id_to_bridge_with` not `call_control_id`**
- **Found during:** Task 1 — TypeScript compilation check
- **Issue:** Plan spec showed `{ call_control_id: userCallControlId }` but `ActionBridgeParams` SDK type requires `call_control_id_to_bridge_with`
- **Fix:** Updated both `bridgeToUser` implementation and the corresponding test assertion
- **Files modified:** src/lib/voice/outbound-caller.ts, src/lib/voice/outbound-caller.test.ts
- **Commit:** fab5eff

**2. [Rule 2 - Missing field] webhooks.test.ts mock CallState objects missing pendingBridge**
- **Found during:** Task 2 — TypeScript compilation check
- **Issue:** 19 instances in tests/api/webhooks.test.ts and 19 in frontend/tests/api/webhooks.test.ts missing required `pendingBridge` field
- **Fix:** Added `pendingBridge: false` after each `providerCallControlId: undefined,` in both test files
- **Files modified:** tests/api/webhooks.test.ts, frontend/tests/api/webhooks.test.ts
- **Commit:** fab5eff

## Pre-existing Issues (Out of Scope)

- `tests/api/webhooks.test.ts(1018)` and `frontend/tests/api/webhooks.test.ts(1018)`: Pre-existing setTimeout type mismatch in vitest `mockImplementationOnce` — not caused by this plan, logged in deferred items

## Self-Check: PASSED
