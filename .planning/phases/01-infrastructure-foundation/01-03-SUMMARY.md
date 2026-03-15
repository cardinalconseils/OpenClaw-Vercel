---
phase: 01-infrastructure-foundation
plan: "03"
subsystem: infra
tags: [telnyx, 10dlc, webhook, startup-script, bash, vitest, tdd]

# Dependency graph
requires:
  - 01-01 (telnyxClient singleton for callControlApplications.update)
  - 01-02 (startServer/app, GatewayManager, pair-device CLI entrypoint)
provides:
  - updateWebhookUrl(): updates Telnyx Call Control Application webhook URL on startup and self-tests /health
  - register-10dlc.ts: registerBrand(), registerCampaign(), assignPhoneNumber() for one-time 10DLC provisioning
  - bin/sandbox-start.sh: master boot script — pair -> gateway -> Express -> webhook URL update
affects:
  - Phase 2+ (sandbox-start.sh is the single boot command for all future Vercel Sandbox deployments)
  - Phase 5 (10DLC brand/campaign must be registered early; 1-7 day TCR approval window)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CLI entrypoint detection via process.argv[1] endsWith check (works for both .ts and .js extensions)
    - AbortController with 10s timeout for self-test fetch (prevents hung startup)
    - Direct Telnyx API calls via fetch for 10DLC endpoints (Telnyx SDK does not expose 10DLC API)
    - Idempotent registration pattern: registerBrand() always calls API; idempotency enforced by Telnyx TCR

key-files:
  created:
    - src/startup/webhook-url-updater.ts
    - src/startup/register-10dlc.ts
    - bin/sandbox-start.sh
    - tests/startup/webhook-url-updater.test.ts
    - tests/startup/10dlc-registration.test.ts
  modified: []

key-decisions:
  - "CLI entrypoint in webhook-url-updater.ts and register-10dlc.ts detects direct execution via process.argv[1].endsWith() — works for both .ts (tsx) and .js (compiled) invocations"
  - "register-10dlc.ts uses direct fetch() calls to Telnyx API instead of the SDK — the Telnyx Node SDK does not expose 10DLC endpoints"
  - "10DLC registration is NOT part of sandbox-start.sh — it runs once manually during initial provisioning; including it in startup would cause duplicate TCR submissions"
  - "Idempotency for registerBrand() relies on Telnyx/TCR API returning the existing brandId on duplicate submission rather than client-side state"

patterns-established:
  - "Pattern: Self-test with AbortController — any startup check that calls external URLs uses AbortController(10000ms) to prevent hung boots"
  - "Pattern: bash set -euo pipefail — all startup scripts exit immediately on error, undefined variable, or pipe failure"

requirements-completed: [INFRA-02, INFRA-05]

# Metrics
duration: 4min
completed: "2026-03-14"
---

# Phase 1 Plan 03: Infrastructure Foundation — Webhook URL Auto-Updater, 10DLC Registration, and Master Startup Script Summary

**Telnyx webhook URL auto-updater with /health self-test, 10DLC brand/campaign registration via Telnyx API, and bin/sandbox-start.sh master boot script — all 33 tests green across 8 test files**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-14T21:36:42Z
- **Completed:** 2026-03-14T21:40:50Z
- **Tasks:** 2 (+ 1 human-verify checkpoint)
- **Files created:** 5

## Accomplishments

- Implemented `updateWebhookUrl(sandboxUrl?)` that updates the Telnyx Call Control Application's `webhook_event_url` field via `telnyxClient.callControlApplications.update()`, then confirms the server is reachable via a self-test fetch to `/health` with 10s AbortController timeout
- Implemented `registerBrand()`, `registerCampaign()`, and `assignPhoneNumber()` using direct fetch calls to Telnyx 10DLC endpoints (`/v2/10dlc/brand`, `/v2/10dlc/campaignBuilder`, `/v2/10dlc/phoneNumberCampaign`) — SDK doesn't expose these endpoints
- Created `bin/sandbox-start.sh` with `set -euo pipefail`, orchestrating full boot: pair-device -> openclaw gateway (background) -> 30s health poll -> Express server (background, 2s bind) -> webhook URL update
- All 8 test files pass (33 total tests) covering all plans 01-03

## Task Commits

Each task was committed atomically:

1. **Task 1: Webhook URL auto-updater and 10DLC registration script** — `eefb6e2` (feat)
2. **Task 2: Master startup script** — `1e5ee5a` (feat)

_Note: TDD task — tests written first (RED: module not found), implementation added (GREEN), committed together after green_

## Files Created/Modified

- `src/startup/webhook-url-updater.ts` — updateWebhookUrl() with Telnyx API update + self-test + CLI entrypoint
- `src/startup/register-10dlc.ts` — registerBrand(), registerCampaign(), assignPhoneNumber() + CLI entrypoint
- `bin/sandbox-start.sh` — Master boot script (chmod +x, set -euo pipefail, 5-phase startup)
- `tests/startup/webhook-url-updater.test.ts` — 4 tests: API call args, self-test fetch, non-200 throw, URL construction
- `tests/startup/10dlc-registration.test.ts` — 4 tests: brand fields, idempotency, campaign usecase, phone number assignment

## Decisions Made

- CLI entrypoint detection uses `process.argv[1].endsWith('webhook-url-updater.ts')` (also `.js`) — handles both `npx tsx` (`.ts`) and compiled (`.js`) execution
- 10DLC endpoints accessed via direct `fetch()` calls with Bearer auth — the Telnyx SDK v6 does not expose `telnyxClient.brands` or `telnyxClient.campaigns`; SDK is only used for Call Control v2
- `registerBrand()` always calls the Telnyx API; idempotency handled by TCR (returns existing brandId on duplicate EIN submission rather than creating duplicate)
- `bin/sandbox-start.sh` omits keep-alive as a separate process — it runs inside `server.ts` Express startup (established in Plan 02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed test mock pattern (require vs import in ESM)**
- **Found during:** Task 1 (RED phase — initial test file written with `require()` in `beforeEach`)
- **Issue:** First test draft used `const { telnyxClient } = require(...)` inside `beforeEach` to access the mock. This pattern doesn't work in Vitest ESM — `require` is not available in ESM modules.
- **Fix:** Rewrote test to use `vi.mock()` at top-level + `vi.mocked()` on the imported mock, consistent with the pattern established in `tests/api/webhooks.test.ts`
- **Files modified:** `tests/startup/webhook-url-updater.test.ts`
- **Verification:** All 4 webhook URL updater tests pass after fix

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking ESM pattern issue)
**Impact on plan:** Minor test infrastructure fix. No scope changes.

## Issues Encountered

None beyond the auto-fixed ESM mock pattern above.

## User Setup Required

**External services require manual configuration.** The following must be done before running:

**Telnyx Call Control Application:**
- `TELNYX_API_KEY` — Telnyx Mission Control -> Account Settings -> Keys & Credentials -> API Key
- `TELNYX_PUBLIC_KEY` — Telnyx Mission Control -> Account Settings -> Keys & Credentials -> Public Key
- `TELNYX_CONNECTION_ID` — Telnyx Mission Control -> Voice -> Call Control Applications -> Create one -> Copy ID
- `TELNYX_PHONE_NUMBER` — Telnyx Mission Control -> Numbers -> Buy a number -> E.164 format
- Assign phone number to Call Control Application in Telnyx dashboard

**10DLC Registration (one-time, run manually):**
- `BUSINESS_EIN`, `BUSINESS_PHONE`, `BUSINESS_EMAIL`, `BUSINESS_WEBSITE`
- `BUSINESS_STREET`, `BUSINESS_CITY`, `BUSINESS_STATE`, `BUSINESS_ZIP`
- Run: `npx tsx src/startup/register-10dlc.ts` — save the returned BRAND_ID and CAMPAIGN_ID
- Register for Free Caller Registry: https://freecallerregistry.com
- Enable CNAM: Telnyx Mission Control -> Numbers -> Select number -> CNAM Listing -> Set to 'Cardinal Conseils'

## Next Phase Readiness

- `bin/sandbox-start.sh` is the single boot command for Vercel Sandbox — Phase 2+ deployments use this
- All 33 infrastructure tests green — Phase 2 can begin immediately
- 10DLC registration should be run early (1-7 day TCR approval; blocks Phase 5 SMS)
- No blockers for Phase 2 (conversation flow design)

## Self-Check: PASSED

Files verified present:
- `/Users/pmc/Downloads/OpenClaw-Vercel/src/startup/webhook-url-updater.ts` — FOUND
- `/Users/pmc/Downloads/OpenClaw-Vercel/src/startup/register-10dlc.ts` — FOUND
- `/Users/pmc/Downloads/OpenClaw-Vercel/bin/sandbox-start.sh` — FOUND
- `/Users/pmc/Downloads/OpenClaw-Vercel/tests/startup/webhook-url-updater.test.ts` — FOUND
- `/Users/pmc/Downloads/OpenClaw-Vercel/tests/startup/10dlc-registration.test.ts` — FOUND

Commits verified: eefb6e2 (Task 1), 1e5ee5a (Task 2) — both confirmed in git log.
All 33 tests passing: `npx vitest run` — PASSED.

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-03-14*
