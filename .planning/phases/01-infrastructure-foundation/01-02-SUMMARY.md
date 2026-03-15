---
phase: 01-infrastructure-foundation
plan: "02"
subsystem: infra
tags: [express, telnyx, webhook, gateway, keepalive, ed25519, tdd, vitest]

# Dependency graph
requires:
  - 01-01 (telnyxClient singleton, TelnyxWebhookEvent type, Vitest runner)
provides:
  - GatewayManager: spawns/monitors/restarts openclaw process with exponential backoff
  - startKeepAlive/stopKeepAlive: 5-minute health-check loop with auto-restart
  - telnyxWebhookVerifier: Express middleware with Ed25519 signature verification
  - webhookRouter: Express router for POST /webhooks/telnyx with raw body parsing
  - app: Express v5 app with /health and /webhooks/telnyx routes
  - startServer(): server startup on port 18790
  - openclaw.yaml: gateway config with trustedProxies for Vercel Sandbox
affects:
  - 01-03 (sandbox-start.sh calls startServer and GatewayManager.start)
  - all future phases (inbound Telnyx events flow through webhookRouter)

# Tech tracking
tech-stack:
  added:
    - supertest + @types/supertest (HTTP integration testing for Express routes)
  patterns:
    - Register exit listener BEFORE kill() to avoid race on synchronous mock exits
    - Route-level express.raw() — never express.json() on webhook routes (preserves Ed25519 body)
    - Respond 200 immediately, process async with setImmediate (Telnyx 2s requirement)
    - Exponential backoff: BASE_DELAY * 2^attempt, capped at MAX_DELAY

key-files:
  created:
    - openclaw.yaml
    - src/startup/gateway-manager.ts
    - src/startup/keepalive.ts
    - src/lib/voice/webhook-verify.ts
    - src/api/webhooks.ts
    - src/server.ts
    - tests/startup/gateway.test.ts
    - tests/startup/keepalive.test.ts
    - tests/api/webhooks.test.ts
  modified:
    - package.json (supertest, @types/supertest added)

key-decisions:
  - "Register exit listener before kill() in restart()/stop() to prevent missing synchronous exit event in tests and fast-exit production scenarios"
  - "Use telnyxClient.webhooks.unwrap() (not constructEvent) — this is the current Telnyx SDK v6 API for Ed25519 webhook verification"
  - "express.raw({ type: 'application/json' }) applied at route level, not app level — prevents accidentally breaking other routes"
  - "GatewayManager falls back to root URL (/) for health check since /health may not exist on OpenClaw gateway"

# Metrics
duration: 5min
completed: "2026-03-14"
---

# Phase 1 Plan 02: Infrastructure Foundation — Gateway Manager, Keep-Alive, and Express Webhook Server Summary

**Express webhook server with Ed25519 Telnyx signature verification, GatewayManager with exponential backoff auto-restart, and 5-minute keep-alive loop — all 25 tests green across 6 test files**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T21:29:46Z
- **Completed:** 2026-03-14T21:34:34Z
- **Tasks:** 2
- **Files created:** 9 created, 1 modified

## Accomplishments

- Implemented `GatewayManager` that spawns `openclaw start`, health-checks root URL with 5s timeout, auto-restarts on crash with exponential backoff (1s → 2s → 4s → 8s → capped at 30s), resets backoff counter on successful health check
- Implemented `startKeepAlive`/`stopKeepAlive` with 5-minute `setInterval`, triggers `gatewayManager.restart()` on health failure or timeout
- Created `openclaw.yaml` with `gateway.port: 18789`, `bind: loopback`, `trustedProxies` for all Vercel Sandbox private CIDRs, `allowRealIpFallback: false`
- Implemented `telnyxWebhookVerifier` middleware using `telnyxClient.webhooks.unwrap()` (Telnyx SDK v6 Ed25519 API), returns 403 on bad/missing signatures, attaches `req.telnyxEvent`
- Created `webhookRouter` with route-level `express.raw({ type: 'application/json' })`, acknowledges with 200 immediately, processes event type asynchronously via `setImmediate`
- Created Express v5 `app` with `/health` (returns `{ status: 'ok' }`) and `/webhooks/telnyx` routes, `startServer()` on port 18790

## Task Commits

Each task was committed atomically:

1. **Task 1: Gateway manager and keep-alive modules** — `5f11050` (feat)
2. **Task 2: Express server with Telnyx webhook signature verification** — `8b19e5d` (feat)

_Note: TDD tasks — tests written first (RED), implementation added (GREEN), committed together after green_

## Files Created/Modified

- `openclaw.yaml` — OpenClaw gateway config: port 18789, loopback bind, trustedProxies CIDRs
- `src/startup/gateway-manager.ts` — GatewayManager class: spawn, stop, restart, isHealthy, getProcess
- `src/startup/keepalive.ts` — startKeepAlive(manager)/stopKeepAlive(timer) with 5-minute interval
- `src/lib/voice/webhook-verify.ts` — telnyxWebhookVerifier Express middleware (Ed25519 via SDK unwrap)
- `src/api/webhooks.ts` — webhookRouter: raw body parsing + verification + immediate 200 response
- `src/server.ts` — Express app, /health route, webhook mount, startServer()
- `tests/startup/gateway.test.ts` — 4 tests: spawn command, restart, backoff formula, health reset
- `tests/startup/keepalive.test.ts` — 4 tests: 5-min interval, restart on unhealthy, restart on timeout, stop clears interval
- `tests/api/webhooks.test.ts` — 6 tests: valid/invalid/missing signature, event logging, health endpoint, raw body type check
- `package.json` — Added supertest, @types/supertest

## Decisions Made

- Register exit listener before calling `kill()` in `restart()` and `stop()` — prevents race condition where mock processes exit synchronously before the listener is registered
- Use `telnyxClient.webhooks.unwrap()` instead of `constructEvent()` — the SDK v6 API uses `unwrap()` for Ed25519 webhook verification; constructEvent does not exist in this version
- Apply `express.raw({ type: 'application/json' })` at route level only — avoids accidentally parsing JSON globally and breaking signature verification on other routes
- Gateway health check falls back to root URL `/` since OpenClaw gateway `/health` endpoint is not guaranteed by documentation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed exit-listener race condition in GatewayManager.restart()**
- **Found during:** Task 1 (GREEN phase — Test 2 timed out at 5000ms)
- **Issue:** `restart()` called `proc.kill()` then registered `proc.on('exit', ...)`. In test mocks (and fast real exits), the exit event fires synchronously during `kill()`, before the listener is registered, so the promise never resolves.
- **Fix:** Restructured `restart()` and `stop()` to register the exit listener BEFORE calling `kill()`.
- **Files modified:** `src/startup/gateway-manager.ts`
- **Verification:** Test 2 passes (was timing out at 5000ms)

---

**2. [Rule 1 - Bug] Used correct SDK API: unwrap() instead of constructEvent()**
- **Found during:** Task 2 planning — checking Telnyx SDK types
- **Issue:** Plan specified `telnyxClient.webhooks.constructEvent()` but Telnyx SDK v6 uses `telnyxClient.webhooks.unwrap()`. `constructEvent` does not exist.
- **Fix:** Implemented `webhook-verify.ts` using `unwrap(rawBody, { headers, key })`.
- **Files modified:** `src/lib/voice/webhook-verify.ts`
- **Verification:** All 6 webhook tests pass

---

**Total deviations:** 2 auto-fixed (Rule 1 — bugs)
**Impact on plan:** Both fixes were essential for correctness. No scope creep.

## Issues Encountered

None beyond the two auto-fixed bugs above.

## User Setup Required

None — all runtime environment variables (`TELNYX_PUBLIC_KEY`, `TELNYX_API_KEY`) are already defined in `.env.example` from Plan 01.

## Next Phase Readiness

- `app` and `startServer()` ready for Plan 03 (sandbox-start.sh will call startServer)
- `GatewayManager` ready to be wired into sandbox startup script
- `telnyxWebhookVerifier` ready to receive live Telnyx webhooks once connection is provisioned
- All 25 tests pass — Plan 03 can add tests immediately
- No blockers for Plan 03

## Self-Check: PASSED

All 9 files verified present. Both task commits verified (5f11050, 8b19e5d). All 25 tests passing.

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-03-14*
