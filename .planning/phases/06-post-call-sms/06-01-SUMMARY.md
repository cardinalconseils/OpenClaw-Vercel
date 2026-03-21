---
phase: 06-post-call-sms
plan: "01"
subsystem: voice/sms
tags: [sms, tdd, post-call, tcpa, buymeacoffee]
dependency_graph:
  requires:
    - src/lib/voice/telnyx-client.ts
    - src/lib/voice/call-state.ts
  provides:
    - src/lib/voice/recap-sms.ts
  affects: []
tech_stack:
  added: []
  patterns:
    - TDD red-green with module-level vi.mock for telnyx-client
    - Pure-function SMS composition with conditional sections
    - Non-fatal async error handling (catch + log, no rethrow)
    - TCPA strict equality guard (smsConsent !== true)
key_files:
  created:
    - src/lib/voice/recap-sms.ts
    - src/lib/voice/recap-sms.test.ts
  modified: []
decisions:
  - "buildSuccessSms tried-providers list capped at 3 via .slice(0, currentProviderIndex).slice(0, 3)"
  - "vi.mock hoisted to module top-level with module-level mockMessagesSend variable — vi.clearAllMocks() per test for isolation"
  - "buildFailureSms service type falls back to 'a provider' (not 'provider') to match plan spec"
metrics:
  duration: 171s
  completed_date: "2026-03-21"
  tasks_completed: 1
  files_created: 2
  files_modified: 0
---

# Phase 06 Plan 01: Post-Call SMS Recap Module Summary

**One-liner:** TDD implementation of recap-sms module — personalized success/failure SMS variants with TCPA consent guard, BuyMeACoffee tip link, and non-fatal Telnyx delivery.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| RED | Failing tests for buildSuccessSms, buildFailureSms, sendRecapSms (25 tests) | 49aa7d3 |
| GREEN | Production recap-sms.ts implementation, all 25 tests passing | 7ede460 |

## What Was Built

### `src/lib/voice/recap-sms.ts`

Three exported functions:

**`buildSuccessSms(state, buyMeACoffeeUrl)`**
- Greeting: `Hey {name}!` or `Hey there!` fallback
- Connected provider line: name and phone from `state.providers[currentProviderIndex]`
- Tried providers list: `state.providers.slice(0, currentProviderIndex).slice(0, 3)` — each marked `— unavailable`
- Tip line: only included when `buyMeACoffeeUrl` is non-empty
- Parts joined with spaces, empty parts filtered out

**`buildFailureSms(state)`**
- Same greeting pattern
- Service type from `state.intent.serviceType ?? 'a provider'`
- Top 3 providers: `state.providers.slice(0, 3)` — formatted as `{name}: {phone}`
- Ends with `Good luck!`
- No tip link (locked per POST-02 decision)

**`sendRecapSms(state, callStatus)`**
- Guard: `smsConsent !== true` → skip (strict TCPA compliance)
- Guard: `!callerPhone` → skip
- Routes to `buildSuccessSms` for `callStatus === 'completed'`, `buildFailureSms` for all others
- `BUYMEACOFFEE_URL` read from `process.env`
- Try/catch around `getTelnyxClient().messages.send()` — non-fatal

### `src/lib/voice/recap-sms.test.ts`

25 tests covering:
- `buildSuccessSms`: 9 tests (greeting, fallback, provider info, tip link, tried list, 3-cap, no-tried edge case, full format)
- `buildFailureSms`: 8 tests (greeting, fallback, service type, fallback, top-3, under-3, sign-off, no tip link)
- `sendRecapSms`: 8 tests (consent undefined, consent false, empty phone, all 3 status values, from/to fields, non-fatal error)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.mock hoisting incompatible with per-test mockImplementation setup**
- **Found during:** GREEN task (first test run)
- **Issue:** `vi.mock('./telnyx-client.js')` inside `beforeEach` is hoisted to module top by Vitest, causing `mockMessagesSend` variable to be `undefined` at factory execution time
- **Fix:** Moved `mockMessagesSend = vi.fn()` and `vi.mock(...)` to module top level; use `vi.clearAllMocks()` in `beforeEach`/`afterEach` for test isolation
- **Files modified:** `src/lib/voice/recap-sms.test.ts`
- **Commit:** 7ede460 (part of GREEN commit — fix applied before GREEN commit)

## Self-Check: PASSED

- [x] `src/lib/voice/recap-sms.ts` — FOUND
- [x] `src/lib/voice/recap-sms.test.ts` — FOUND
- [x] RED commit 49aa7d3 — FOUND
- [x] GREEN commit 7ede460 — FOUND
- [x] All 25 tests passing: `npx vitest run src/lib/voice/recap-sms.test.ts` exits 0
