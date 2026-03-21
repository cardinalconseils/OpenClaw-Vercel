---
phase: 06-post-call-sms
plan: "02"
subsystem: voice/webhooks
tags: [sms, post-call, tcpa, buymeacoffee, webhooks]
dependency_graph:
  requires:
    - src/lib/voice/recap-sms.ts
    - src/api/webhooks.ts
  provides:
    - SMS recap triggered from call.hangup handler
  affects:
    - src/api/webhooks.ts
tech_stack:
  added: []
  patterns:
    - Non-fatal async SMS call with await (internally guarded)
    - TCPA strict equality guard (smsConsent === true)
    - Placement: after DB write, before state cleanup
key_files:
  created: []
  modified:
    - src/api/webhooks.ts
    - .env.example
decisions:
  - "sendRecapSms placed after insertCallHistory and before endCall — DB write first, SMS before state cleanup"
  - "smsConsent === true strict equality (not truthy) — TCPA compliance; undefined and false both skip"
  - "await sendRecapSms inside if (state) block — state required, internally non-fatal so cleanup always runs"
metrics:
  duration: 120s
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 06 Plan 02: SMS Wiring into Webhooks Summary

**One-liner:** Wired sendRecapSms() into webhooks.ts call.hangup handler after insertCallHistory, gated by TCPA smsConsent===true and wasDialing, before endCall clears state.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Wire sendRecapSms into call.hangup in webhooks.ts | 3c1a9fc |
| 2 | Add BUYMEACOFFEE_URL to .env.example | 0b9b7dd |

## What Was Built

### `src/api/webhooks.ts` (modified)

Added import at top:
```typescript
import { sendRecapSms } from '../lib/voice/recap-sms.js';
```

Added SMS trigger in `call.hangup` handler inside the `if (state)` block, after `insertCallHistory` try/catch, before provider-leg cleanup and `endCall`:
```typescript
// Send recap SMS if consent given and providers were contacted
if (state.smsConsent === true && wasDialing) {
  await sendRecapSms(state, callStatus);
}
```

**Placement invariants maintained:**
- INSIDE `if (state)` block — state required for SMS composition
- AFTER `insertCallHistory` try/catch — DB write always precedes SMS
- BEFORE `endCall()` calls — SMS needs state; endCall clears memory
- AFTER outgoing leg early-return — inbound caller hangup only
- Uses pre-computed `wasDialing` and `callStatus` variables

### `.env.example` (modified)

Added `BUYMEACOFFEE_URL=` under the `# --- BuyMeACoffee ---` section, after `BUYMEACOFFEE_USERNAME=`. Recap-sms reads `process.env.BUYMEACOFFEE_URL`; when empty, tip line is gracefully omitted from SMS.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/api/webhooks.ts` contains `import { sendRecapSms } from '../lib/voice/recap-sms.js'`
- [x] `src/api/webhooks.ts` contains `if (state.smsConsent === true && wasDialing)`
- [x] `src/api/webhooks.ts` contains `await sendRecapSms(state, callStatus)`
- [x] sendRecapSms call (line 548) is AFTER insertCallHistory (line 526) — CONFIRMED
- [x] sendRecapSms call (line 548) is BEFORE endCall calls (lines 570, 573) — CONFIRMED
- [x] `.env.example` contains `BUYMEACOFFEE_URL=` — CONFIRMED
- [x] `.env.example` still contains `BUYMEACOFFEE_USERNAME=` — CONFIRMED
- [x] Commit 3c1a9fc — FOUND
- [x] Commit 0b9b7dd — FOUND
- [x] All 248 tests passing — CONFIRMED
- [x] `npx tsc --noEmit` exits 0 — CONFIRMED
