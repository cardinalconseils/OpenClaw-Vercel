---
phase: 07-web-dashboard
plan: 01
subsystem: frontend/api
tags: [api, supabase, rls, rate-limiting, phone-normalization, tdd]
dependency_graph:
  requires: []
  provides: [POST /api/call-history, normalizeToE164, anon RLS policy on call_history]
  affects: [frontend/src/app/(dashboard)/history page (Plan 02)]
tech_stack:
  added: []
  patterns: [in-memory IP rate limiter, E.164 phone normalization, Next.js Route Handler, vi.hoisted mock pattern]
key_files:
  created:
    - frontend/src/lib/phone-normalize.ts
    - frontend/src/lib/phone-normalize.test.ts
    - frontend/src/app/api/call-history/route.ts
    - frontend/src/app/api/call-history/route.test.ts
    - frontend/supabase/migrations/20260322_call_history_anon_lookup.sql
  modified: []
decisions:
  - "vi.hoisted() used for mock variable declarations — avoids hoisting ReferenceError when vi.mock factory references outer variables"
  - "Rate limiter uses Map<ip, {count, resetAt}> with window reset on expiry — simple, stateless across requests in same Node.js process"
  - "Provider phone stripping uses p.status ?? p.outcome for defensive read — handles both backend field names (status from DB, outcome from frontend type)"
metrics:
  duration: 4m
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_created: 5
  files_modified: 0
---

# Phase 07 Plan 01: Call History Data Layer Summary

**One-liner:** Phone-normalized POST /api/call-history endpoint with IP rate limiting, provider phone stripping, and Supabase anon RLS migration.

## What Was Built

- **`frontend/src/lib/phone-normalize.ts`** — Pure function `normalizeToE164()` that strips non-digits and applies E.164 prefix rules (10-digit → +1, 11-digit starting with 1 → +, other → + passthrough for international)
- **`frontend/src/app/api/call-history/route.ts`** — Next.js Route Handler implementing POST /api/call-history with Zod input validation, E.164 normalization, IP-based rate limiting (10 req/60s), Supabase query, provider phone stripping, and structured error responses
- **`frontend/supabase/migrations/20260322_call_history_anon_lookup.sql`** — Adds `TO anon` RLS policy "Anon caller_phone lookup" alongside existing user-scoped policy; adds `idx_call_history_caller_phone` index

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Phone normalizer module (TDD) | 541f761 | phone-normalize.ts, phone-normalize.test.ts |
| 2 | RLS migration + API route + tests | 4308372 | route.ts, route.test.ts, migration .sql |

## Test Results

- 8 normalizer tests: all pass (TDD RED → GREEN)
- 5 API route tests: all pass (200 happy path, 400 invalid phone, 400 no body, provider phone stripped, 429 rate limit)
- Total: 13/13 tests pass

## Decisions Made

1. **`vi.hoisted()` for mock variable declarations** — `vi.mock` factories are hoisted to top of file by Vitest; variables declared outside the factory cause "Cannot access before initialization" ReferenceError. `vi.hoisted()` creates variables in the hoisted scope. Applied as auto-fix (Rule 1 — bug in test pattern).

2. **Rate limiter `Map<ip, {count, resetAt}>`** — Per-IP in-memory map with sliding window. Window resets when `now > resetAt`. Simple and correct for single-process Next.js deployments; acknowledged limitation for multi-replica (not a concern for current Vercel single-instance deployment).

3. **`p.status ?? p.outcome` defensive read** — Backend `src/lib/db/call-history-repo.ts` uses `status` field; frontend `types.ts` CallHistoryRecord uses `outcome` field. Defensive read handles both to future-proof against type drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock hoisting ReferenceError in route.test.ts**
- **Found during:** Task 2 first test run
- **Issue:** `vi.mock` factory referenced `mockFrom`, `mockEq` etc. declared as `const` outside — Vitest hoists `vi.mock` calls above variable declarations, causing "Cannot access 'mockFrom' before initialization"
- **Fix:** Replaced top-level `const mockX = vi.fn()` declarations with `vi.hoisted(() => { ... })` pattern, which runs in the hoisted scope
- **Files modified:** `frontend/src/app/api/call-history/route.test.ts`
- **Commit:** 4308372 (included in Task 2 commit)

## Self-Check: PASSED

All 5 created files found on disk. Both task commits (541f761, 4308372) confirmed in git log.
