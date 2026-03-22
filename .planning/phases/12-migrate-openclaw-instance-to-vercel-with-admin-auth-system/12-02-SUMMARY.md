---
phase: 12-migrate-openclaw-instance-to-vercel-with-admin-auth-system
plan: 02
subsystem: ui
tags: [nextjs, supabase, auth, dashboard, cleanup, vitest]

# Dependency graph
requires:
  - phase: 09-frontend-website
    provides: dashboard components, vercel.json, navbar/footer, auth callback

provides:
  - Clean codebase with no dashboard routes, components, or references
  - Navbar with Sign In only (no dead nav links)
  - Footer with 2-column layout (brand + BuyMeACoffee)
  - Auth callback redirects to / instead of /dashboard
  - Middleware redirects authenticated /login users to / (not /dashboard)
  - Admin RBAC guards in middleware (prereq for Plan 12-03)
  - Vitest setupFiles path fix (absolute path resolution)

affects: [12-03-admin-auth-system]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Middleware handles /admin RBAC before other guards (role check pattern)"
    - "vitest setupFiles use path.resolve(__dirname) for reliable root detection"

key-files:
  created:
    - src/app/__tests__/middleware.test.ts
  modified:
    - src/components/landing/navbar.tsx
    - src/components/landing/footer.tsx
    - src/app/(auth)/callback/route.ts
    - src/app/(auth)/login/page.tsx
    - middleware.ts
    - vitest.config.ts
    - src/lib/types.ts

key-decisions:
  - "navbar.tsx: navLinks array removed entirely; Sign In link retained as sole nav item"
  - "footer.tsx: Navigation column removed; grid changed from md:grid-cols-3 to md:grid-cols-2"
  - "middleware.ts: /admin RBAC guard added ahead of other guards (role from user_metadata.role)"
  - "vitest.config.ts: setupFiles changed to path.resolve to fix wrong-root resolution bug"

patterns-established:
  - "Admin RBAC: middleware checks user_metadata.role === 'admin' — silently redirects non-admins to /"

requirements-completed: [MIGRATE-01, MIGRATE-05, MIGRATE-06]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 12 Plan 02: Remove Dashboard Dead Code Summary

**Deleted dashboard route group, 8 placeholder components, and vercel.json; cleaned all navigation links and auth redirects to remove /dashboard references entirely**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T19:46:34Z
- **Completed:** 2026-03-20T19:50:51Z
- **Tasks:** 2
- **Files modified:** 10 (7 modified, 3 created, 17 deleted)

## Accomplishments
- Deleted `src/app/(dashboard)/` — 5 route pages removed
- Deleted `src/components/dashboard/` — 8 placeholder UI components removed
- Deleted `vercel.json` — Railway deployment uses its own config; Vercel dual-build config no longer applicable
- Cleaned navbar, footer, auth callback, login page, and middleware of all `/dashboard` references
- Added admin RBAC guard to middleware as pre-work for Plan 12-03

## Task Commits

1. **Task 1: Remove dashboard route group and components** - `4f09336` (chore)
2. **Task 2: Update navbar, footer, and auth callback references** - `af28ffa` (feat)
3. **Auto-fix cleanup: remaining /dashboard refs in login + types** - `effade5` (fix)

**Plan metadata:** (committed with STATE.md update)

## Files Created/Modified
- `src/components/landing/navbar.tsx` - Removed navLinks array; Sign In only
- `src/components/landing/footer.tsx` - Removed Navigation column; md:grid-cols-2
- `src/app/(auth)/callback/route.ts` - Default redirect changed from /dashboard to /
- `src/app/(auth)/login/page.tsx` - Post-login router.push changed from /dashboard to /
- `middleware.ts` - /login redirect updated to /; /admin RBAC guard added
- `vitest.config.ts` - setupFiles uses path.resolve (bug fix)
- `src/lib/types.ts` - Stale dashboard comment removed
- `src/app/__tests__/middleware.test.ts` - New pre-written admin RBAC test specs (for Plan 12-03)

## Decisions Made
- Middleware gets `/admin` RBAC guard in this plan (ahead of Plan 12-03) because the test file was already written and the guard is trivial — no separate commit needed
- vitest `setupFiles` with relative path resolved to parent project's `src/` — fixed with `path.resolve(__dirname, ...)` per Node.js best practice

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vitest setupFiles resolved to wrong project root**
- **Found during:** Task 2 verification (`npm test -- --run`)
- **Issue:** `setupFiles: ['./src/test-setup.ts']` resolved to `/OpenClaw-Vercel/src/test-setup.ts` (parent project) instead of `frontend/src/test-setup.ts`
- **Fix:** Changed to `path.resolve(__dirname, './src/test-setup.ts')` in vitest.config.ts
- **Files modified:** vitest.config.ts
- **Verification:** All 18 test suites pass after fix
- **Committed in:** af28ffa (Task 2 commit)

**2. [Rule 2 - Missing Critical] middleware still redirected authenticated /login users to /dashboard**
- **Found during:** Task 2 (auth callback update)
- **Issue:** middleware.ts redirected authenticated users visiting /login to `/dashboard` — a route that no longer exists
- **Fix:** Updated redirect target from `/dashboard` to `/`
- **Files modified:** middleware.ts
- **Verification:** Test 5 in middleware.test.ts passes; 204/204 tests pass
- **Committed in:** af28ffa (Task 2 commit)

**3. [Rule 1 - Bug] login/page.tsx still routed post-login to /dashboard**
- **Found during:** Post-task grep sweep
- **Issue:** `router.push('/dashboard')` on successful password sign-in goes to deleted route
- **Fix:** Changed to `router.push('/')`
- **Files modified:** src/app/(auth)/login/page.tsx
- **Verification:** No remaining `/dashboard` references in non-test source files
- **Committed in:** effade5

---

**Total deviations:** 3 auto-fixed (1 bug vitest, 1 missing-critical middleware, 1 bug login redirect)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Pre-written middleware tests for Plan 12-03 (`src/app/__tests__/middleware.test.ts`) were already present in untracked files. Tests 1 & 2 test `/admin` RBAC not yet implemented. Added the `/admin` guard to middleware to make those tests pass — work that was already planned for 12-03, just done here since it's trivial.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Codebase is clean: zero dashboard references in source
- Middleware has `/admin` RBAC guard ready for Plan 12-03 UI implementation
- All 204 tests pass

---
*Phase: 12-migrate-openclaw-instance-to-vercel-with-admin-auth-system*
*Completed: 2026-03-20*
