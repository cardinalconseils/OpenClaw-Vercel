---
phase: 01-infrastructure-foundation
plan: "04"
subsystem: runtime-wiring
tags: [server, gateway-manager, keep-alive, startup, cli-entrypoint]
dependency_graph:
  requires: [01-02, 01-03]
  provides: [runtime-entrypoint, managed-gateway-startup]
  affects: [all-phases]
tech_stack:
  added: []
  patterns: [cli-entrypoint-detection, graceful-shutdown, health-poll-loop]
key_files:
  created: []
  modified:
    - src/server.ts
    - bin/sandbox-start.sh
decisions:
  - "CLI entrypoint detection uses process.argv[1].endsWith() for both .ts and .js — handles npx tsx and compiled execution"
  - "Gateway health poll in server.ts uses catch-and-continue (not re-throw) to handle transient network errors before gateway is up"
  - "sandbox-start.sh polls Express /health for 45s (not 30s) to account for server.ts 30s gateway wait before binding Express"
metrics:
  duration: "53s"
  completed: "2026-03-14"
  tasks_completed: 2
  files_modified: 2
---

# Phase 01 Plan 04: Runtime Wiring Summary

**One-liner:** CLI entrypoint in server.ts now starts Express, GatewayManager, and keep-alive as a single managed process replacing two unmanaged nohup/raw processes.

## What Was Built

Two verification gaps from the Phase 1 gap analysis were closed:

**Gap 1 — server.ts CLI entrypoint (src/server.ts)**
- Added top-level imports for `GatewayManager` and `startKeepAlive`/`stopKeepAlive`
- Added `isDirectExecution` check using `process.argv[1]?.endsWith('server.ts|.js')`
- CLI block starts `GatewayManager`, polls `isHealthy()` up to 30 attempts (1s each), exits with code 1 if gateway never becomes healthy
- After gateway is healthy, calls `startServer()` to bind Express on port 18790
- Calls `startKeepAlive(gatewayManager)` to start the 5-minute health check loop
- Registers `SIGTERM`/`SIGINT` handlers for graceful shutdown: `stopKeepAlive` + `gatewayManager.stop()` + `server.close()`
- All existing `app` and `startServer` exports preserved — zero test impact

**Gap 2 — sandbox-start.sh (bin/sandbox-start.sh)**
- Removed raw `nohup openclaw start`, manual gateway health-check loop, and separate `EXPRESS_PID` tracking
- New sequence: pair-device → `npx tsx src/server.ts &` (single managed process) → poll `/health` for 45s → webhook-url-updater → `wait $SERVER_PID`
- Timeout extended to 45s because `server.ts` itself waits up to 30s for gateway health before binding Express

## Verification Results

- `npx vitest run` — 33/33 tests pass across 8 test files (no regressions)
- `bash -n bin/sandbox-start.sh` — Syntax OK
- `grep -q "startKeepAlive" src/server.ts` — FOUND
- `grep -q "GatewayManager" src/server.ts` — FOUND
- `grep -q "startServer" src/server.ts` — FOUND

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Created/Modified

- [ ] src/server.ts modified
- [ ] bin/sandbox-start.sh modified

### Commits

- b8135a0: feat(01-04): wire CLI entrypoint in server.ts — GatewayManager + keep-alive
- 731d6c8: feat(01-04): update sandbox-start.sh to delegate gateway lifecycle to server.ts

## Self-Check: PASSED
