---
phase: 05-live-call-transfer
plan: "02"
subsystem: voice/webhooks
tags: [telnyx, bridge, call-transfer, webhooks, warm-transfer]
dependency_graph:
  requires: [05-01]
  provides: [full-bridge-webhook-flow, call.bridged-handler, transfer-cleanup]
  affects: [src/api/webhooks.ts]
tech_stack:
  added: []
  patterns: [Telnyx bridge webhook flow, pendingBridge flag coordination, provider-leg speak.ended trigger, dual-leg call.bridged routing]
key_files:
  created: []
  modified:
    - src/api/webhooks.ts
decisions:
  - "pendingBridge set BEFORE speaking brief so speak.ended fires after brief completes and triggers bridge"
  - "call.bridged filtered to provider-leg only via client_state.stage=provider-dial — user-leg event ignored (has source=openclaw)"
  - "User-hangup apology checks stage=calling OR pendingBridge (not transferred) — user hangs up before or during bridge initiation"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-21"
  tasks: 1
  files: 1
---

# Phase 05 Plan 02: Warm Transfer Webhook Wiring Summary

Full warm transfer webhook event lifecycle wired into webhooks.ts: availability confirmed -> speak brief on provider leg -> pendingBridge flag -> speak.ended triggers bridge -> call.bridged sets stage='transferred' + goodbye -> hangup cleanup treats transferred as complete.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire bridge flow into webhooks.ts availability and speak.ended handlers | a3e81ad | src/api/webhooks.ts |

## What Was Built

### Imports (webhooks.ts)
- Added `bridgeToUser` and `TRANSFER_BRIEF` to the import from `outbound-caller.js`

### Availability Branch Replacement (call.transcription handler)
- Old behavior: `updateCall(userCcid, { stage: 'complete' })` — Phase 5 placeholder
- New behavior:
  1. Notifies user: "Great news — {provider} is available! I'm going to connect you now."
  2. Builds `TRANSFER_BRIEF(callerName, serviceType, location)` string
  3. Sets `pendingBridge: true` on user call state BEFORE speaking brief
  4. Speaks brief on PROVIDER leg via `getTelnyxClient().calls.actions.speak(callControlId, ...)`

### call.speak.ended Handler (updated)
- New path: checks `speakClientState.stage === 'provider-dial'`
  - If `bridgeState?.pendingBridge`: clears flag, calls `bridgeToUser(callControlId, userCcid)`
  - On bridge API failure: speaks error message to user, increments providerIndex, calls `tryNextProvider`
- Old path (user leg greeting logic) preserved for inbound leg events

### call.bridged Handler (new)
- Filters to provider-leg only: `bridgedClientState.stage === 'provider-dial'`
- Sets `stage: 'transferred'` on user call state
- Speaks goodbye: "Alright, you're connected! I'll leave you two to it — good luck!"
- User-leg bridged event (has `{ source: 'openclaw' }` client_state) is silently ignored

### Transcription Stage Gate
- Added `'transferred'` to the stage gate array: `['searching', 'calling', 'transferred', 'complete']`
- Prevents spurious transcription processing after bridge established

### Inbound call.hangup Handler (multiple updates)
- `wasDialing`: added `'transferred'` — providers contacted during transfer are recorded
- `callStatus`: `stage === 'complete' || stage === 'transferred'` → maps to `'completed'`
- `connected_provider`: same condition — populates connected provider name
- Session persistence: `stage !== 'complete' && stage !== 'transferred'` — both stages clean up immediately
- User-hangup-during-transfer: if `stage === 'calling' || pendingBridge` and `providerCallControlId` exists, speaks apology to provider leg ("Sorry, the caller disconnected. Have a good day!") and schedules hangup after 3s

## Deviations from Plan

None — plan executed exactly as written.

## Test Results

- 223/223 tests passing (no regressions)
- `src/api/webhooks.ts` type-checks cleanly (0 errors in the modified file)

## Self-Check: PASSED

- File exists: `/Users/pmc/Documents/DEV/OpenClaw-Vercel/src/api/webhooks.ts` — FOUND
- Commit exists: a3e81ad — FOUND
- Key patterns verified:
  - `import { bridgeToUser, TRANSFER_BRIEF }` — FOUND
  - `TRANSFER_BRIEF(` in availability branch — FOUND
  - `pendingBridge: true` in availability branch — FOUND
  - `speakClientState.stage === 'provider-dial'` in speak.ended — FOUND
  - `bridgeToUser(callControlId, userCcid)` — FOUND
  - `case 'call.bridged':` — FOUND
  - `stage: 'transferred'` in call.bridged — FOUND
  - `you're connected` in call.bridged — FOUND
  - `'transferred'` in transcription stage gate — FOUND
  - `'transferred'` in wasDialing — FOUND
  - `state.stage === 'transferred'` in callStatus — FOUND
  - `state.stage === 'transferred'` in connected_provider — FOUND
  - `state.stage !== 'transferred'` in session persistence — FOUND
  - `the caller disconnected` in user-hangup guard — FOUND
