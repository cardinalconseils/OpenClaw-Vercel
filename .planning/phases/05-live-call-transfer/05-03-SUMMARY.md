---
phase: 05-live-call-transfer
plan: "03"
subsystem: typecheck
tags: [gap-closure, tsc, mirror-sync, webhooks, call-state]
dependency_graph:
  requires: [05-01, 05-02]
  provides: [clean-typecheck]
  affects: [ci-gate, root-tsc]
tech_stack:
  added: []
  patterns: [mirror-sync, gitignored-backend-files]
key_files:
  created: []
  modified:
    - frontend/src/lib/voice/call-state.ts
    - frontend/src/lib/voice/outbound-caller.ts
    - frontend/src/lib/tools/handlers/dispatch.ts
    - frontend/src/api/webhooks.ts
    - tests/api/webhooks.test.ts
    - frontend/tests/api/webhooks.test.ts
decisions:
  - "Pre-existing setTimeout spy type error in test files fixed inline — same line/same pattern in both root and frontend test copies"
  - "frontend/src backend mirror files are gitignored by design (frontend/.gitignore) — updates exist on disk only, for root tsc --noEmit typecheck"
metrics:
  duration: 357s
  completed: "2026-03-21"
  tasks_completed: 2
  files_changed: 6
requirements: [XFER-01, XFER-02, XFER-03, XFER-04]
---

# Phase 05 Plan 03: Frontend Mirror Sync — TypeScript Gap Closure Summary

Synced 4 stale Phase 4 frontend mirror files to their canonical Phase 5 root src/ counterparts, reducing tsc --noEmit errors from 2 pre-existing to zero.

## Objective

Root `tsconfig.json` glob `**/*.ts` includes `frontend/src/` directory. Phase 5 updated only root `src/` files, leaving the `frontend/src/` copies at Phase 4 state. This blocked the CI typecheck gate. Plan 03 syncs all 4 affected files to restore a clean compile.

## Tasks Completed

### Task 1: Sync call-state.ts, outbound-caller.ts, dispatch.ts

Updated three backend mirror files in `frontend/src/lib/`:

- **call-state.ts**: Added `'transferred'` to stage union, added `pendingBridge: boolean` field and `pendingBridge: false` default in `initCall()`
- **outbound-caller.ts**: Added `TRANSFER_BRIEF` and `bridgeToUser` exports; added transferred-stage guard in `handleProviderHangup`; added `'normal_clearing'` to `cascadeCauses` array
- **dispatch.ts**: Added `bridgeToUser` to import; added `call_control_id?` to `TransferCallParams`; replaced STUB `transferCall` body with real `bridgeToUser` implementation

All three files verified byte-identical to root src/ counterparts via `diff`.

### Task 2: Sync webhooks.ts and verify tsc passes

Updated `frontend/src/api/webhooks.ts` to match root `src/api/webhooks.ts`:

- Added `bridgeToUser` and `TRANSFER_BRIEF` to outbound-caller import
- Replaced simple `call.speak.ended` handler with bridge-trigger logic (checks `pendingBridge` flag, calls `bridgeToUser`)
- Updated provider-available branch in `call.transcription` to speak brief on provider leg and set `pendingBridge=true`
- Added `'transferred'` to `call.transcription` stage gate
- Added `case 'call.bridged'` handler: marks stage as `'transferred'`, speaks goodbye on user leg
- Updated `call.hangup` wasDialing, callStatus, connected_provider, and cleanup condition to include `'transferred'` stage
- Added user-hangup-during-transfer apology block to speak to provider leg

File verified byte-identical to root src/api/webhooks.ts via `diff`.

**tsc --noEmit result: exit 0, zero errors**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing setTimeout spy type error in test files**

- **Found during:** Task 2 verification — tsc returned 2 errors after file sync
- **Issue:** `vi.spyOn(global, 'setTimeout').mockImplementationOnce((fn: (...args: unknown[]) => void, ...)` did not match the expected `setTimeout` overload signature. TypeScript 5.x requires explicit cast for this pattern.
- **Root cause:** Pre-existing in both `tests/api/webhooks.test.ts` and `frontend/tests/api/webhooks.test.ts` before this plan's changes (confirmed via `git stash` test).
- **Fix:** Wrapped mock function with `as typeof setTimeout` cast in both files
- **Files modified:** `tests/api/webhooks.test.ts`, `frontend/tests/api/webhooks.test.ts`
- **Commit:** 793f095

## Context Note

The `frontend/src/` backend mirror files are excluded from git tracking via `frontend/.gitignore` (lines 25-32: `src/api/`, `src/lib/ai/`, `src/lib/db/`, `src/lib/missions/`, `src/lib/tools/`, `src/lib/voice/`, `src/server.ts`, etc.). This is intentional — these files exist on disk for the root-level `tsc --noEmit` typecheck but are not part of the Next.js frontend build. The git commit for Task 2 captures only the tracked test file fixes; the 4 mirror files are local-disk-only updates.

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/phases/05-live-call-transfer/05-03-SUMMARY.md`
- All 4 frontend mirror files exist on disk and match root src/ counterparts
- Commit 793f095 exists: feat(05-03) webhooks sync + tsc fix
- tsc --noEmit exits 0 (zero errors)
