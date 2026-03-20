---
phase: 09-frontend-website
plan: "04"
subsystem: frontend/dashboard
tags: [dashboard, realtime, supabase, recharts, react, next.js]
dependency_graph:
  requires: [09-00, 09-01, 09-03]
  provides: [dashboard-shell, call-history-page, missions-realtime-page, analytics-page]
  affects: [frontend/src/app/(dashboard), frontend/src/components/dashboard]
tech_stack:
  added: []
  patterns:
    - Supabase Realtime postgres_changes subscription with useEffect cleanup
    - Server-side data fetch via createServerSupabaseClient in Next.js Server Components
    - shadcn chart (ChartContainer + Recharts BarChart) for analytics visualization
    - Sheet component (base-ui Dialog) for mobile sidebar drawer
    - render prop pattern for base-ui SheetTrigger (asChild not supported in base-ui 1.x)
key_files:
  created:
    - frontend/src/components/dashboard/dashboard-shell.tsx
    - frontend/src/components/dashboard/status-badge.tsx
    - frontend/src/components/dashboard/call-history-table.tsx
    - frontend/src/components/dashboard/missions-table.tsx
    - frontend/src/components/dashboard/service-type-chart.tsx
    - frontend/src/app/(dashboard)/layout.tsx
    - frontend/src/app/(dashboard)/dashboard/page.tsx
    - frontend/src/app/(dashboard)/missions/page.tsx
    - frontend/src/app/(dashboard)/analytics/page.tsx
  modified:
    - frontend/src/__tests__/call-history.test.tsx
    - frontend/src/__tests__/missions-realtime.test.tsx
decisions:
  - "SheetTrigger uses render prop (not asChild) — base-ui 1.x does not support asChild; linter auto-corrected to render prop pattern"
  - "MissionsTable channels on missions-realtime with user_id=eq.{userId} filter for row-level security alignment"
  - "StatusBadge uses direct className override (not shadcn variant extension) — simpler than defining custom CVA variants for many status colors"
  - "settings.test.tsx pre-existing failure (WEB-05 scope) deferred — not caused by plan 04 changes"
metrics:
  duration: "2246s (~37 min)"
  completed: "2026-03-16"
  tasks_completed: 3
  tasks_total: 3
  files_created: 9
  files_modified: 2
  tests_added: 13
  tests_passing: 13
---

# Phase 09 Plan 04: Dashboard Pages Summary

Dashboard shell with responsive sidebar navigation, call history table with server-side Supabase fetch, missions page with Supabase Realtime subscription, and analytics page with stat cards and Recharts bar chart — all dark-themed with status badges and empty states.

## Tasks Completed

### Task 1: DashboardShell layout and call history page
- `DashboardShell` client component with persistent sidebar on desktop (`lg:w-64`), Sheet drawer with hamburger on mobile
- Active nav item highlighted with `border-l-2 border-primary` left border in Azure Teal
- Sign Out calls `supabase.auth.signOut()` then `router.push('/login')`
- `(dashboard)/layout.tsx` server component fetches user via `getUser()`, redirects to `/login` if not authenticated
- `CallHistoryTable` renders Date/Service Type/Location/Providers/Connected To/Status columns
- `StatusBadge` maps all status values to correct color classes per UI-SPEC
- Empty state: "No calls yet." per copywriting contract
- 7/7 call-history behavioral tests passing

### Task 2: Missions page with realtime and analytics page
- `MissionsTable` client component subscribes to `postgres_changes` on `missions` table filtered by `user_id`
- INSERT/UPDATE/DELETE events update local React state via functional state setter
- `useEffect` returns cleanup function calling `supabase.removeChannel(channel)` to prevent memory leaks
- Mission cards show description (truncated 100 chars), StatusBadge, channel icon, step progress, created date
- `ServiceTypeChart` uses `ChartContainer` + Recharts `BarChart` with Azure Teal fill
- Analytics page computes: total calls, success rate %, most common service type
- Empty states on all pages follow UI-SPEC copywriting contract
- 6/6 missions-realtime behavioral tests passing

### Task 3: Visual verification checkpoint (APPROVED)
- Human reviewed dashboard, missions, and analytics pages
- Visual quality, responsiveness, and functionality approved

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed circular reference in mock initialization for missions-realtime tests**
- **Found during:** Task 2 test run
- **Issue:** `mockSubscribe.mockReturnValue(mockChannel)` inside the `mockChannel` object literal — `mockChannel` not yet defined when expression evaluated, causing `ReferenceError: Cannot access 'mockChannel' before initialization`
- **Fix:** Declared `mockChannel` with `let`, assigned it after `mockSubscribe` was created, then called `mockSubscribe.mockReturnValue(mockChannel)` separately
- **Files modified:** `frontend/src/__tests__/missions-realtime.test.tsx`
- **Commit:** 1985813

**2. [Rule 1 - Bug] Linter auto-corrected SheetTrigger from asChild to render prop pattern**
- **Found during:** Task 1 (lint on commit)
- **Issue:** `<SheetTrigger asChild>` does not work with base-ui 1.x components — auto-corrected to `render={<Button ... />}` pattern consistent with other components in the codebase
- **Files modified:** `frontend/src/components/dashboard/dashboard-shell.tsx`
- **Commit:** 2f03cd1

## Deferred Issues

**Pre-existing test failure: settings.test.tsx (WEB-05)**
- `delete account shows AlertDialog confirmation before action` fails in `settings.test.tsx`
- This is a pre-existing failure in `WEB-05` scope (plan 09-05, not plan 09-04)
- Not caused by any changes in this plan
- Deferred to settings page implementation plan

## Self-Check

### Files exist:
- [x] `frontend/src/components/dashboard/dashboard-shell.tsx`
- [x] `frontend/src/components/dashboard/status-badge.tsx`
- [x] `frontend/src/components/dashboard/call-history-table.tsx`
- [x] `frontend/src/components/dashboard/missions-table.tsx`
- [x] `frontend/src/components/dashboard/service-type-chart.tsx`
- [x] `frontend/src/app/(dashboard)/layout.tsx`
- [x] `frontend/src/app/(dashboard)/dashboard/page.tsx`
- [x] `frontend/src/app/(dashboard)/missions/page.tsx`
- [x] `frontend/src/app/(dashboard)/analytics/page.tsx`

### Commits exist:
- [x] 2f03cd1 — Task 1
- [x] 1985813 — Task 2

## Self-Check: PASSED
