---
phase: 12-migrate-openclaw-instance-to-vercel-with-admin-auth-system
plan: 01
subsystem: auth
tags: [supabase, nextjs, middleware, rbac, admin]

requires:
  - phase: 09-frontend-website
    provides: "Next.js middleware with Supabase SSR auth pattern and getUser() usage"

provides:
  - "Admin RBAC gate on /admin/* routes via user_metadata.role='admin' check"
  - "Post-login redirect to / instead of /dashboard"
  - "6 behavioral tests covering admin access scenarios"

affects:
  - 12-02
  - 12-03

tech-stack:
  added: []
  patterns:
    - "Admin role check via user.user_metadata?.role in Next.js middleware"
    - "Silent non-admin redirect to / (no error page, no leakage of /admin existence)"

key-files:
  created:
    - frontend/src/app/__tests__/middleware.test.ts
  modified:
    - frontend/middleware.ts
    - frontend/src/middleware.test.ts

key-decisions:
  - "Admin RBAC uses user_metadata.role per locked decision — note: user_metadata is user-modifiable; migrate to app_metadata in a future hardening phase"
  - "Non-admin authenticated users silently redirected to / (not an error page) — avoids disclosing existence of /admin"
  - "Post-login redirect changed from /dashboard to / — dashboard was removed in Phase 12 pre-work commit 4f09336"
  - "Existing src/middleware.test.ts updated to match new / redirect behavior — kept aligned with middleware changes"

patterns-established:
  - "Admin gate pattern: check startsWith('/admin') before route protection block, unauthenticated to /login, non-admin to /"

requirements-completed:
  - MIGRATE-04

duration: 1min
completed: 2026-03-20
---

# Phase 12 Plan 01: Admin RBAC Middleware Summary

**Next.js middleware updated with /admin/* route protection using Supabase user_metadata.role='admin' check — unauthenticated users to /login, non-admins silently to /, plus 6 behavioral tests**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-20T15:46:25Z
- **Completed:** 2026-03-20T15:50:12Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Added /admin/* RBAC gate to middleware.ts — unauthenticated to /login, non-admin authenticated to /
- Confirmed admin access passes through for user_metadata.role='admin'
- Changed post-login redirect from /dashboard to / (home) — aligns with dashboard removal
- Created 6 behavioral tests in src/app/__tests__/middleware.test.ts covering all redirect scenarios
- Updated legacy src/middleware.test.ts to reflect updated / redirect behavior (previously expected /dashboard)

## Task Commits

1. **Task 1: Add admin RBAC to middleware and write tests** - `24f066e` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/middleware.ts` - Added /admin/* RBAC block before existing route guards; changed /login auth redirect to /
- `frontend/src/app/__tests__/middleware.test.ts` - New: 6 tests covering all admin/auth redirect behaviors
- `frontend/src/middleware.test.ts` - Updated: fixed test expectation from /dashboard to / for post-login redirect

## Decisions Made

- Admin role check uses `user.user_metadata?.role` per the locked decision from Phase 12 context research. Note: user_metadata is user-modifiable — this is a known limitation documented for future hardening.
- Silent redirect to `/` for non-admins (not a 403 page) — avoids disclosing the existence of /admin routes.
- Post-login redirect changed from `/dashboard` to `/` because the dashboard route group was removed in a preparatory commit (4f09336) before this plan ran.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated legacy middleware test to match new redirect target**
- **Found during:** Task 1 (middleware implementation)
- **Issue:** `frontend/src/middleware.test.ts` had a test expecting `location.toContain('/dashboard')` after auth redirect. Since middleware now redirects to `/`, this test would fail.
- **Fix:** Updated the test description and assertion to expect `/` (home) redirect instead of `/dashboard`
- **Files modified:** frontend/src/middleware.test.ts
- **Verification:** `npx vitest run src/middleware.test.ts` — 7/7 pass
- **Committed in:** 24f066e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in existing test)
**Impact on plan:** Essential for test suite consistency. No scope creep.

## Issues Encountered

The plan's `<verify>` directive specifies `npm test -- --run` which runs all tests including backend server tests (`src/server.test.ts`, `src/lib/**`) that fail due to missing env vars. This is a pre-existing condition — the full test suite has never passed via `npm test -- --run` in this repo structure. Verified by running only the frontend-specific test files directly with npx vitest run.

## User Setup Required

**One-time Supabase admin role setup required before Plan 03 checkpoint.**

The middleware checks `user_metadata.role === 'admin'`. Without this, the intended admin user will be silently redirected to `/` when visiting `/admin`.

**Setup steps:**
1. Go to Supabase Dashboard > Authentication > Users
2. Find your admin user, click Edit
3. Under "Raw user_metadata", add: `{"role": "admin"}`
4. Save

Or via Admin API:
```typescript
await supabaseAdmin.auth.admin.updateUserById(ADMIN_USER_ID, {
  user_metadata: { role: 'admin' }
})
```

This is a one-time setup — document it at Plan 03's human-verify checkpoint.

## Next Phase Readiness

- Admin RBAC gate is live — /admin/* routes are protected
- Plan 02 (dashboard route removal) was already executed in pre-work commit 4f09336
- Plan 03 (OpenClaw Control UI proxy at /admin) can be built with confidence the gate exists
- Supabase admin user metadata must be set before Plan 03 human-verify checkpoint

---
*Phase: 12-migrate-openclaw-instance-to-vercel-with-admin-auth-system*
*Completed: 2026-03-20*
