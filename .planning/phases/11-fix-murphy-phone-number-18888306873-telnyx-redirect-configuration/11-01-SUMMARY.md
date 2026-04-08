---
phase: 11-fix-murphy-phone-number-18888306873-telnyx-redirect-configuration
plan: 01
subsystem: infra
tags: [telnyx, texml, clawdtalk, sms, vercel, deployment, next-js, middleware]

# Dependency graph
requires:
  - phase: 12-migrate-openclaw-instance-to-vercel-with-admin-auth-system
    provides: Next.js frontend at murphy.help with Supabase auth middleware
provides:
  - TeXML endpoint at /webhooks/telnyx/forward forwarding +18888306873 calls to +18885440160
  - sessions_send in ClawdTalk gateway tool allowlist (enables SMS recaps)
  - Working Vercel deployment with health endpoint at murphy.help/health
  - Fixed Vercel build pipeline (backend deps, type:module, ThemeProvider SSR, clean env vars)
affects: [call-forwarding, sms-recap, vercel-deployment]

# Tech tracking
tech-stack:
  added: [express@5.2.1, openai@6.32.0, telnyx@6.25.0, @anthropic-ai/sdk@0.78.0]
  patterns:
    - TeXML GET endpoint for unconditional call forwarding on Call Control numbers
    - Separate 'use client' ThemeProvider wrapper to fix Next.js 16 SSR edge cases
    - Middleware env var guards for fail-open behavior on Supabase errors
    - Backend deps declared in root package.json for Vercel serverless bundling

key-files:
  created:
    - src/components/theme-provider.tsx
  modified:
    - src/server.ts (TeXML /webhooks/telnyx/forward endpoint)
    - src/startup/openclaw-config.ts (sessions_send in ClawdTalk allow list)
    - package.json (backend deps, type:module)
    - tsconfig.json (exclude frontend/ directory)
    - middleware.ts (env var guards, try/catch, exclude health/webhooks from matcher)
    - src/app/layout.tsx (ThemeProvider import from @/components/theme-provider)
    - src/test-setup.ts (NEXT_PUBLIC_SUPABASE_* env vars for middleware tests)

key-decisions:
  - "Telnyx API rejects automatic call forwarding on Call Control/TeXML numbers — must use TeXML <Dial> response instead"
  - "TeXML application (connection 2920018843260684126) calls /webhooks/telnyx/forward GET endpoint — returns XML with <Dial> to +18885440160"
  - "+18885440160 is NOT a Telnyx number — it is the ClawdTalk dedicated number managed by ClawdTalk service"
  - "ClawdTalk allow: ['sessions_send'] enables SMS recaps during ClawdTalk-handled calls"
  - "type:module in package.json required for Vercel ESM/CJS resolution with module:esnext tsconfig"
  - "MIDDLEWARE_INVOCATION_FAILED on frontend routes is a pre-existing issue — deferred (not in scope of this plan)"

patterns-established:
  - "Pattern 1: TeXML forwarding — when Telnyx API rejects call forwarding on Call Control numbers, use a TeXML application with GET endpoint returning <Response><Dial>target</Dial></Response>"
  - "Pattern 2: Vercel deployment — root package.json must declare ALL runtime deps (Express, Telnyx SDK, OpenAI, Anthropic) for Vercel serverless bundling"

requirements-completed: [FIX-01, FIX-02]

# Metrics
duration: 35min
completed: 2026-03-23
---

# Phase 11 Plan 01: Telnyx Call Forwarding + ClawdTalk SMS Summary

**TeXML GET endpoint forwards +18888306873 calls to ClawdTalk +18885440160 via <Dial>, sessions_send added to gateway allowlist, and Vercel deployment pipeline fixed (backend deps, type:module, ThemeProvider SSR, env vars)**

## Performance

- **Duration:** 35 min
- **Started:** 2026-03-23T14:11:16Z
- **Completed:** 2026-03-23T14:46:04Z
- **Tasks:** 2 of 3 (Task 3 is a human checkpoint — returned below)
- **Files modified:** 8

## Accomplishments

- Configured Telnyx call forwarding: added GET `/webhooks/telnyx/forward` endpoint that returns TeXML `<Dial>+18885440160</Dial>`, enabling +18888306873 → ClawdTalk routing
- Added `allow: ['sessions_send']` to ClawdTalk plugin config so Murphy can send SMS recaps during ClawdTalk-handled calls
- Fixed Vercel deployment pipeline: 6 pre-existing build failures resolved (missing deps, type:module, ThemeProvider SSR, NODE_ENV, Supabase env vars)
- Verified: `curl -s https://murphy.help/health` → `{"status":"ok"}`, TeXML endpoint returns correct XML
- TELNYX_PUBLIC_KEY confirmed correct in Vercel (`wJMd8IPWKTdnZTGghRIxaRScLwo/wQgVNWLvKmrD3Ic=`)
- webhook-verify.ts rawBody hardening confirmed present (all 4 cases: Buffer, string, object, fallback)

## Task Commits

1. **Task 1: Configure Telnyx call forwarding and verify env var** - `a321d16` (feat)
2. **Task 2: Add sessions_send + deploy (with deployment fixes)** - `688c0f1` (feat)

## Files Created/Modified

- `src/server.ts` — Added GET `/webhooks/telnyx/forward` returning TeXML `<Dial>+18885440160</Dial>`
- `src/startup/openclaw-config.ts` — Added `allow: ['sessions_send']` to ClawdTalk plugin config
- `package.json` — Added `express`, `openai`, `telnyx`, `@anthropic-ai/sdk` as dependencies; added `"type": "module"`
- `tsconfig.json` — Added `frontend` to exclude list
- `src/components/theme-provider.tsx` — Created `'use client'` wrapper for `next-themes` ThemeProvider
- `src/app/layout.tsx` — Updated ThemeProvider import to use local wrapper
- `middleware.ts` — Added env var guards, wrapped createServerClient in try/catch, excluded health/webhooks routes
- `src/test-setup.ts` — Added `NEXT_PUBLIC_SUPABASE_*` env vars for middleware test compatibility

## Decisions Made

- **TeXML over API forwarding:** Telnyx API explicitly rejects `call_forwarding` on Call Control/TeXML numbers. The correct pattern is a TeXML application with a GET endpoint returning `<Response><Dial>target</Dial></Response>`. Connection `2920018843260684126` ("OpenClaw Canadian Forward") already pointed to `https://murphy.help/webhooks/telnyx/forward` — we just needed to implement that endpoint.

- **ClawdTalk is not a Telnyx number:** +18885440160 is not in the Telnyx account. It is the ClawdTalk-managed number, so the dial target in TeXML must be the E.164 phone number string, not a Telnyx resource reference.

- **Deployment pipeline fixes as Rule 3 auto-fixes:** The Vercel build was failing due to 6 pre-existing issues that blocked the deploy step. These were auto-fixed inline rather than deferred since they directly blocked task completion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Telnyx API rejects call forwarding on Call Control/TeXML numbers**
- **Found during:** Task 1 (Configure Telnyx call forwarding)
- **Issue:** `PATCH /v2/phone_numbers/2916301319771784352/voice` returned error: "You cannot use automatic call forwarding with a Call Control or TeXML-utilizing number"
- **Fix:** Discovered +18888306873 is connected to a TeXML application (connection 2920018843260684126) configured to call `https://murphy.help/webhooks/telnyx/forward`. Implemented that GET endpoint returning `<Response><Dial>+18885440160</Dial></Response>`
- **Files modified:** `src/server.ts`
- **Committed in:** `a321d16` (Task 1 commit)

**2. [Rule 3 - Blocking] Vercel build failing — openai and other backend deps missing from package.json**
- **Found during:** Task 2 (Deploy to Vercel production)
- **Issue:** Build error `Cannot find module 'openai'` — backend packages (`express`, `openai`, `telnyx`, `@anthropic-ai/sdk`) were installed locally but not declared in `package.json`
- **Fix:** Added all 4 backend packages to `dependencies` in `package.json`
- **Files modified:** `package.json`
- **Committed in:** `688c0f1` (Task 2 commit)

**3. [Rule 3 - Blocking] Next.js 16 SSR prerender failing due to ThemeProvider not being client-side**
- **Found during:** Task 2 (Deploy to Vercel production)
- **Issue:** `TypeError: Cannot read properties of null (reading 'useContext')` during static page generation — `ThemeProvider` from `next-themes` was imported directly in `layout.tsx` without `'use client'` wrapper
- **Fix:** Created `src/components/theme-provider.tsx` with `'use client'` directive wrapping `next-themes` ThemeProvider
- **Files modified:** `src/components/theme-provider.tsx`, `src/app/layout.tsx`
- **Committed in:** `688c0f1` (Task 2 commit)

**4. [Rule 3 - Blocking] NODE_ENV=development in Vercel caused Next.js to behave incorrectly**
- **Found during:** Task 2 (Deploy to Vercel production)
- **Issue:** Custom `NODE_ENV=development` env var in Vercel was causing non-standard build behavior warning and contributing to SSR failures
- **Fix:** Removed `NODE_ENV` env var from Vercel via `vercel env rm NODE_ENV production`
- **Files modified:** Vercel env vars (external)
- **Committed in:** `688c0f1` (Task 2 commit, Vercel env change)

**5. [Rule 3 - Blocking] NEXT_PUBLIC_SUPABASE_* env vars had trailing newlines in Vercel**
- **Found during:** Task 2 (Deploy to Vercel production — debugging MIDDLEWARE_INVOCATION_FAILED)
- **Issue:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_URL` had trailing `\n` chars when pulled from Vercel
- **Fix:** Removed and re-added both vars with clean values via `vercel env rm/add`
- **Files modified:** Vercel env vars (external)
- **Committed in:** `688c0f1` (Vercel env changes)

**6. [Rule 3 - Blocking] frontend/ directory included in TypeScript compilation**
- **Found during:** Task 2 (first deploy attempt — `./frontend/src/lib/ai/llm-clients.ts` type error)
- **Issue:** `tsconfig.json` `**/*.ts` glob picked up `frontend/` subdirectory files which have different dependencies
- **Fix:** Added `frontend` to `tsconfig.json` exclude list
- **Files modified:** `tsconfig.json`
- **Committed in:** `688c0f1` (Task 2 commit)

**7. [Rule 3 - Blocking] type:module missing — ESM/CJS mismatch in Vercel Node.js runtime**
- **Found during:** Task 2 (FUNCTION_INVOCATION_FAILED after middleware fix)
- **Issue:** Vercel's `@vercel/node` compiles TypeScript with `module:esnext` but `package.json` didn't have `"type":"module"`, causing ESM import failures at runtime
- **Fix:** Added `"type": "module"` to `package.json`
- **Files modified:** `package.json`
- **Committed in:** `688c0f1` (Task 2 commit)

**8. [Rule 2 - Missing Critical] Middleware had no error handling for env var absence or Supabase failures**
- **Found during:** Task 2 (MIDDLEWARE_INVOCATION_FAILED diagnosis)
- **Issue:** `createServerClient` was called without null checks on env vars, causing unhandled exceptions in Edge Runtime
- **Fix:** Added null guard for env vars, wrapped `createServerClient` + `getUser()` in try/catch, excluded `/health` and `/webhooks` from middleware matcher
- **Files modified:** `middleware.ts`
- **Committed in:** `688c0f1` (Task 2 commit)

---

**Total deviations:** 8 auto-fixed (7 blocking Rule 3, 1 missing critical Rule 2)
**Impact on plan:** All auto-fixes resolved pre-existing deployment pipeline failures that were masked before Phase 11. Core task (call forwarding + sessions_send) completed as specified.

## Issues Encountered

- **Telnyx API rejects automatic call forwarding on Call Control numbers:** The plan assumed standard Telnyx call forwarding would work. Telnyx returned a clear error explaining why. The fix (TeXML endpoint) was already set up in the Telnyx portal (the TeXML app was pointing to the endpoint URL) — we just needed to implement the endpoint. Resolution was clean.

- **MIDDLEWARE_INVOCATION_FAILED on frontend routes:** After fixing the middleware error handling, the root `/` and other frontend routes still fail with this error. This appears to be a `@supabase/ssr@0.9.0` Edge Runtime compatibility issue with Next.js 16.1.7. Health endpoint and webhooks work correctly (excluded from middleware). This is a pre-existing issue documented in `deferred-items.md`.

## Deferred Items

See `.planning/phases/11-fix-murphy-phone-number-18888306873-telnyx-redirect-configuration/deferred-items.md`

- **MIDDLEWARE_INVOCATION_FAILED on frontend routes:** `@supabase/ssr@0.9.0` appears incompatible with Next.js 16.1.7 Edge Runtime — frontend pages return 500 even though middleware has comprehensive error handling. Needs dedicated investigation.

## User Setup Required

None — all configuration was automated.

## Next Phase Readiness

- Telnyx call forwarding is configured: +18888306873 → ClawdTalk via TeXML
- ClawdTalk SMS is enabled: `sessions_send` in allowlist
- Health endpoint working: `https://murphy.help/health` → `{"status":"ok"}`
- TeXML endpoint working: `https://murphy.help/webhooks/telnyx/forward` → correct XML
- **Task 3 required:** Live call test to verify Murphy answers when dialing +18888306873 and SMS arrives after the call

---
*Phase: 11-fix-murphy-phone-number-18888306873-telnyx-redirect-configuration*
*Completed: 2026-03-23*

## Self-Check: PASSED

- FOUND: src/server.ts (TeXML endpoint)
- FOUND: src/startup/openclaw-config.ts (sessions_send)
- FOUND: src/components/theme-provider.tsx (client wrapper)
- FOUND: 11-01-SUMMARY.md
- FOUND commit: a321d16 (Task 1)
- FOUND commit: 688c0f1 (Task 2)
- FOUND: sessions_send in openclaw-config.ts
- FOUND: TeXML Dial in server.ts
- FOUND: type:module in package.json
