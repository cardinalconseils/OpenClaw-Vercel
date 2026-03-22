---
phase: 07-web-dashboard
plan: 02
subsystem: frontend/ui
tags: [history-page, call-history, components, navbar, sms-recap, tdd]
dependency_graph:
  requires: [07-01]
  provides: [/history page UI, CallHistoryCard, CallHistoryList, HistoryLookupForm, history link in navbar, murphy.help/history in SMS]
  affects: [frontend/src/app/history/page.tsx, frontend/src/components/history/*, frontend/src/components/landing/navbar.tsx, src/lib/voice/recap-sms.ts]
tech_stack:
  added: []
  patterns: [details/summary expandable cards, client fetch with error states, loading skeletons, empty state CTA]
key_files:
  created:
    - frontend/src/app/history/page.tsx
    - frontend/src/app/history/page.test.tsx
    - frontend/src/components/history/history-lookup-form.tsx
    - frontend/src/components/history/history-lookup-form.test.tsx
    - frontend/src/components/history/call-history-card.tsx
    - frontend/src/components/history/call-history-card.test.tsx
    - frontend/src/components/history/call-history-list.tsx
    - frontend/src/components/landing/navbar.test.tsx
  modified:
    - frontend/src/components/landing/navbar.tsx
    - src/lib/voice/recap-sms.ts
decisions:
  - "CallHistoryCard uses native <details>/<summary> for expand/collapse — no JS required, accessible by default, consistent with legal page pattern"
  - "Provider phone field stripped at API layer (Plan 01) — CallHistoryCard never receives phone values in providers_contacted, no additional masking needed in UI"
  - "p.outcome ?? p.status defensive read in card — handles field name drift between backend (status) and frontend type (outcome)"
metrics:
  duration: 2m
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_created: 8
  files_modified: 2
---

# Phase 07 Plan 02: History Page UI Summary

**One-liner:** /history page with phone lookup form, expandable call history cards (no provider phones), navbar History link, and murphy.help/history appended to both SMS recap variants.

## What Was Built

- **`frontend/src/app/history/page.tsx`** — Server component page at /history with NavBar, Footer, h1 heading, and HistoryLookupForm. No auth required (public page).
- **`frontend/src/components/history/history-lookup-form.tsx`** — Client component with phone `<Input>`, "Look Up" `<Button>`, fetch to POST /api/call-history, 400/429/generic error states, passes results to CallHistoryList.
- **`frontend/src/components/history/call-history-list.tsx`** — Client component rendering 3 Skeleton placeholders during load, empty state with tap-to-call +1 (888) 830-6873 CTA, or CallHistoryCard list.
- **`frontend/src/components/history/call-history-card.tsx`** — Expandable `<details>/<summary>` card showing service type, location, date, status Badge; expands to provider names + outcomes (no phone numbers). ConnectedProvider shown with CheckCircle2 icon.
- **`frontend/src/components/landing/navbar.tsx`** — History link added before Sign In in both desktop and mobile nav.
- **`src/lib/voice/recap-sms.ts`** — Both `buildSuccessSms` and `buildFailureSms` now append `https://murphy.help/history` link.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | History page, form, card components, tests, navbar link | 2491c2a | 9 files |
| 2 | Add murphy.help/history link to SMS recap messages | 2a0d4ed | recap-sms.ts |

## Test Results

- 17 component tests: all pass
  - navbar.test.tsx: 3 tests (Sign In link, History link, Murphy logo)
  - call-history-card.test.tsx: 6 tests (service/location render, 3 badge variants, provider names, no phone numbers, connected-to line)
  - history-lookup-form.test.tsx: 4 tests (renders, fetch call, 400 error, 429 error)
  - page.test.tsx: 3 tests (heading, form, navbar+footer)

## Decisions Made

1. **Native `<details>/<summary>` for expandable cards** — No JS required for expand/collapse, accessible by default, consistent with legal page ToC pattern already in use.
2. **`p.outcome ?? p.status` defensive read** — Backend `providers_contacted` uses `status`; frontend type uses `outcome`. Defensive read future-proofs against type drift (same decision as Plan 01 API layer).
3. **Provider phone never rendered in card** — API layer strips phone from `providers_contacted` before returning (Plan 01). Card never receives phone values; no masking needed in UI.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All 8 created files found on disk. Both task commits (2491c2a, 2a0d4ed) confirmed in git log. 17/17 tests pass.
