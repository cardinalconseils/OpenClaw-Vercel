---
phase: 12-migrate-openclaw-instance-to-vercel-with-admin-auth-system
plan: "03"
subsystem: infra
tags: [custom-server, websocket-proxy, http-proxy-middleware, railway, standalone, next.js]

# Dependency graph
requires:
  - phase: 12-migrate-openclaw-instance-to-vercel-with-admin-auth-system
    provides: middleware RBAC guard on /admin routes (Plans 01+02 built auth and route cleanup)
provides:
  - Custom Node.js server (server.ts) that proxies /admin/* HTTP and WebSocket requests to OpenClaw Control UI
  - Next.js configured for Railway standalone output (output: 'standalone')
  - Compiled server.js artifact produced by build pipeline
  - http-proxy-middleware installed as production dependency
affects:
  - Railway deployment — start command must be `node server.js`
  - Any phase adding /admin sub-routes must ensure they proxy correctly through pathRewrite

# Tech tracking
tech-stack:
  added:
    - http-proxy-middleware (HTTP + WebSocket reverse proxy)
  patterns:
    - Custom Next.js server pattern — createServer wraps app.getRequestHandler(), proxy intercepts /admin paths before Next.js sees them
    - server.on('upgrade') pattern — WebSocket upgrades for /admin forwarded to adminProxy.upgrade
    - tsconfig.server.json separate TypeScript config — compiles server.ts to CommonJS server.js independently of Next.js tsconfig

key-files:
  created:
    - server.ts
    - tsconfig.server.json
    - server.js (compiled output, not tracked in git)
  modified:
    - next.config.ts
    - package.json

key-decisions:
  - "pathRewrite: { '^/admin': '' } strips the /admin prefix when forwarding to OpenClaw Control UI (served at root on port 18789)"
  - "turbopack.root removed from next.config.ts — was a Vercel dual-lockfile workaround, unnecessary on Railway"
  - "build script compiles server.ts via tsc --project tsconfig.server.json after next build — Railway runs node server.js as start command"
  - "OPENCLAW_INTERNAL_URL env var controls proxy target; defaults to http://localhost:18789 for local dev"

patterns-established:
  - "WebSocket proxy pattern: server.on('upgrade') delegates to proxy.upgrade for matching path prefix"
  - "Proxy error handler sends 502 with plain text body when OpenClaw gateway is unavailable (dev-safe)"

requirements-completed: [MIGRATE-01, MIGRATE-02, MIGRATE-03]

# Metrics
duration: ~20min (spread over checkpoint verification)
completed: 2026-03-20
---

# Phase 12 Plan 03: Custom Server with WebSocket Proxy Summary

**Custom Node.js server proxies /admin/* (HTTP + WebSocket) to OpenClaw Control UI at OPENCLAW_INTERNAL_URL, with Next.js standalone output for Railway deployment**

## Performance

- **Duration:** ~20 min (including human-verify checkpoint)
- **Started:** 2026-03-20T~19:30:00Z
- **Completed:** 2026-03-20T~20:00:00Z
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 4 (server.ts, tsconfig.server.json, next.config.ts, package.json)

## Accomplishments

- Installed http-proxy-middleware and created server.ts that intercepts /admin/* requests and proxies them to the OpenClaw Control UI
- WebSocket upgrade events on /admin paths forwarded via server.on('upgrade') — required for Control UI real-time features
- Next.js output changed to 'standalone' and turbopack.root workaround removed; build pipeline compiles server.ts to server.js alongside Next.js output
- Human verification confirmed: landing page clean, /admin redirects unauthenticated users to /login, /dashboard returns 404, proxy forwards to gateway

## Task Commits

Each task was committed atomically:

1. **Task 1: Install http-proxy-middleware and update next.config.ts** - `12cf6f4` (chore)
2. **Task 2: Create custom server.ts with WebSocket proxy and tsconfig.server.json** - `0449041` (feat)
3. **Task 3: Verify admin proxy and auth flow** - human-verified (no code commit)

## Files Created/Modified

- `server.ts` - Custom Next.js server with http-proxy-middleware proxying /admin/* to OPENCLAW_INTERNAL_URL; WebSocket upgrade forwarding
- `tsconfig.server.json` - Separate TypeScript config targeting CommonJS for server.ts compilation
- `next.config.ts` - Set output: 'standalone'; removed turbopack.root workaround
- `package.json` - build script appends `tsc --project tsconfig.server.json`; start script changed to `node server.js`

## Decisions Made

- pathRewrite strips `/admin` prefix so Control UI is addressed at its root (port 18789 serves at /)
- turbopack.root was a Vercel dual-lockfile workaround — removed since Railway deployment has no nested lockfile conflict
- OPENCLAW_INTERNAL_URL defaults to `http://localhost:18789` for frictionless local development
- build produces server.js in project root — Railway's start command is simply `node server.js`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all 204 tests passed at verification. Build succeeded and produced server.js on first attempt.

## User Setup Required

None - no external service configuration required beyond setting `OPENCLAW_INTERNAL_URL` in Railway environment variables (documented in phase RESEARCH.md).

## Next Phase Readiness

- Phase 12 is fully complete: admin RBAC (Plan 01), dashboard removal (Plan 02), and WebSocket proxy server (Plan 03) are all done
- Railway deployment can now use `node server.js` as the start command with `OPENCLAW_INTERNAL_URL` pointing to the OpenClaw gateway service
- Future phases adding /admin sub-routes will automatically be proxied without additional configuration

---
*Phase: 12-migrate-openclaw-instance-to-vercel-with-admin-auth-system*
*Completed: 2026-03-20*
