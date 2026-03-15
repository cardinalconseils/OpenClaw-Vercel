---
phase: 01-infrastructure-foundation
verified: 2026-03-14T22:27:30Z
status: human_needed
score: 9/9 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 6/9
  gaps_closed:
    - "Startup script orchestrates the full boot sequence: pair device, start gateway, start Express, update webhook URL, start keep-alive"
    - "Keep-alive pings the gateway health endpoint every 5 minutes and triggers restart on failure"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Live Telnyx call test"
    expected: "Calling the Telnyx number connects to the OpenClaw gateway and receives an answer without a pairing-required error"
    why_human: "Requires live Telnyx account, provisioned number, and running sandbox — cannot verify programmatically"

  - test: "15-minute idle sandbox survival"
    expected: "The sandbox stays alive through a 15-minute idle period without the gateway dropping"
    why_human: "Requires real Vercel Sandbox deployment and wall-clock wait time — cannot verify programmatically"

  - test: "Webhook URL self-heal after restart"
    expected: "Telnyx webhooks reach the Express server at a public HTTPS URL after sandbox restart, without manual URL updates"
    why_human: "Requires live sandbox restart and Telnyx webhook delivery test — cannot verify programmatically"

  - test: "10DLC registration submission"
    expected: "registerBrand() and registerCampaign() have been run manually, and a TCR application reference number exists"
    why_human: "Requires BUSINESS_EIN and other env vars, and actual submission to Telnyx/TCR — must be run manually once"

  - test: "Free Caller Registry and CNAM check"
    expected: "The outbound Telnyx number passes Free Caller Registry check and CNAM is set to Cardinal Conseils"
    why_human: "Requires dashboard action at freecallerregistry.com and Telnyx Mission Control — no code can verify this"
---

# Phase 1: Infrastructure Foundation — Verification Report

**Phase Goal:** Vercel Sandbox is running with the OpenClaw gateway pre-paired and auto-starting, Telnyx number is provisioned and carrier-registered, webhook URL is publicly reachable, keep-alive loop prevents timeout from killing active calls, and 10DLC SMS registration is initiated
**Verified:** 2026-03-14T22:27:30Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (01-04-PLAN.md executed)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | pair-device.ts generates Ed25519 keypair, writes paired.json with correct schema, and clears pending.json | VERIFIED | prePairDevice() fully implemented — 6 unit tests pass |
| 2 | pair-device.ts can be run as a standalone CLI script via npx tsx src/startup/pair-device.ts | VERIFIED | import.meta.url CLI entrypoint block at line 80; wired in sandbox-start.sh Phase 1 |
| 3 | Telnyx client singleton is configured and exported for reuse across modules | VERIFIED | telnyxClient exported from telnyx-client.ts with API key guard; imported by webhook-verify.ts and webhook-url-updater.ts |
| 4 | Gateway manager spawns the OpenClaw process, detects health, and auto-restarts with exponential backoff on crash | VERIFIED | GatewayManager fully implemented (4 tests pass); wired into server.ts CLI entrypoint at line 55 |
| 5 | Keep-alive pings the gateway health endpoint every 5 minutes and triggers restart on failure | VERIFIED | startKeepAlive called at server.ts line 87 inside CLI entrypoint block; 4 tests pass; stopKeepAlive wired to SIGTERM/SIGINT handlers |
| 6 | Express webhook handler validates Telnyx signatures and returns 200 on valid requests, 403 on invalid | VERIFIED | telnyxWebhookVerifier middleware + webhookRouter wired in server.ts; 6 tests pass |
| 7 | Webhook handler responds within 2 seconds (acknowledge first, process async) | VERIFIED | Immediate res.status(200) then setImmediate for async processing |
| 8 | Webhook URL is automatically updated in the Telnyx Call Control Application on every startup | VERIFIED | updateWebhookUrl() calls callControlApplications.update(); invoked in sandbox-start.sh Phase 4 |
| 9 | Startup script orchestrates the full boot sequence: pair device, start gateway, start Express, update webhook URL, start keep-alive | VERIFIED | bin/sandbox-start.sh: pair-device -> server.ts (which starts GatewayManager + Express + keep-alive) -> poll /health 45s -> webhook-url-updater |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/startup/pair-device.ts` | OpenClaw device pre-pairing automation | VERIFIED | 84 lines, exports prePairDevice, CLI entrypoint present |
| `src/lib/voice/telnyx-client.ts` | Telnyx SDK singleton | VERIFIED | 17 lines, exports telnyxClient with API key guard |
| `src/types/telnyx.ts` | Telnyx webhook Zod schemas and types | VERIFIED | 42 lines, exports TelnyxWebhookEventSchema, TelnyxWebhookEvent, TelnyxCallControlEvent |
| `vitest.config.ts` | Test runner configuration | VERIFIED | Correct test include, verbose reporter, no watch |
| `tests/startup/pair-device.test.ts` | Unit tests for device pre-pairing | VERIFIED | 6 tests, all pass |
| `src/startup/gateway-manager.ts` | Gateway lifecycle management | VERIFIED | 178 lines, exports GatewayManager with full backoff logic; wired into server.ts |
| `src/startup/keepalive.ts` | Keep-alive interval loop | VERIFIED | 40 lines, exports startKeepAlive/stopKeepAlive; called in server.ts CLI block |
| `src/api/webhooks.ts` | Express route handler for Telnyx webhooks | VERIFIED | 39 lines, exports webhookRouter with raw body and immediate 200 |
| `src/lib/voice/webhook-verify.ts` | Telnyx webhook signature verification middleware | VERIFIED | 47 lines, exports telnyxWebhookVerifier using SDK unwrap() |
| `src/server.ts` | Express server entrypoint with CLI | VERIFIED | 106 lines; CLI entrypoint at lines 47-105; starts GatewayManager, polls health, starts Express, starts keep-alive, registers SIGTERM/SIGINT handlers |
| `openclaw.yaml` | OpenClaw gateway configuration | VERIFIED | Contains trustedProxies with all required CIDRs, port 18789, loopback bind |
| `src/startup/webhook-url-updater.ts` | Auto-update Telnyx webhook URL and self-test | VERIFIED | 85 lines, exports updateWebhookUrl, CLI entrypoint present |
| `src/startup/register-10dlc.ts` | 10DLC brand and campaign registration | VERIFIED | 205 lines, exports registerBrand, registerCampaign, assignPhoneNumber; CLI entrypoint present; idempotent |
| `bin/sandbox-start.sh` | Master startup script for Vercel Sandbox | VERIFIED | 29 lines; valid bash syntax confirmed; single managed process (server.ts); 45s health poll; webhook URL update |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/server.ts` | `src/api/webhooks.ts` | `app.use('/webhooks/telnyx', webhookRouter)` | WIRED | Line 24 of server.ts |
| `src/api/webhooks.ts` | `src/lib/voice/webhook-verify.ts` | middleware | WIRED | telnyxWebhookVerifier imported and applied |
| `src/server.ts` | `src/startup/gateway-manager.ts` | `new GatewayManager(); gatewayManager.start()` | WIRED | Lines 3, 55, 59 of server.ts — Gap 2 closed |
| `src/server.ts` | `src/startup/keepalive.ts` | `startKeepAlive(gatewayManager)` | WIRED | Lines 4, 87 of server.ts — Gap 1+2 closed |
| `src/startup/webhook-url-updater.ts` | Telnyx Call Control Applications API | `telnyxClient.callControlApplications.update()` | WIRED | Line 36 of webhook-url-updater.ts |
| `src/startup/webhook-url-updater.ts` | `src/server.ts /health` | fetch self-test | WIRED | Lines 48-55 of webhook-url-updater.ts |
| `bin/sandbox-start.sh` | `src/startup/pair-device.ts` | `npx tsx src/startup/pair-device.ts` | WIRED | Line 5 of sandbox-start.sh |
| `bin/sandbox-start.sh` | `src/server.ts` | `npx tsx src/server.ts &` | WIRED | Line 8 of sandbox-start.sh — Gap 1 closed; server.ts now has CLI entrypoint |
| `bin/sandbox-start.sh` | `src/startup/webhook-url-updater.ts` | `npx tsx src/startup/webhook-url-updater.ts` | WIRED | Line 25 of sandbox-start.sh |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INFRA-01 | 01-02-PLAN.md, 01-04-PLAN.md | OpenClaw gateway runs on Vercel Sandbox with Telnyx number configured | SATISFIED | GatewayManager implemented, tested, and wired in server.ts CLI entrypoint; auto-restarts with exponential backoff |
| INFRA-02 | 01-02-PLAN.md, 01-03-PLAN.md | Telnyx webhook receives inbound calls and routes to OpenClaw voice-call plugin | SATISFIED | Webhook handler (webhooks.ts + webhook-verify.ts) implemented and tested; Express starts via server.ts CLI entrypoint; webhook URL auto-updated on startup |
| INFRA-03 | 01-01-PLAN.md | Device pre-pairing is automated (sandbox pairing bug workaround) | SATISFIED | prePairDevice() fully implemented, tested, and wired in sandbox-start.sh Phase 1 |
| INFRA-04 | 01-02-PLAN.md, 01-04-PLAN.md | Sandbox timeout is extended and kept alive during active calls | SATISFIED | startKeepAlive called at server.ts line 87 with GatewayManager instance; 5-minute health check loop active on runtime |
| INFRA-05 | 01-03-PLAN.md | 10DLC SMS registration is initiated for outbound SMS compliance | NEEDS HUMAN | register-10dlc.ts is ready to run; registration requires manual execution with real business env vars and live Telnyx/TCR API call |

### Anti-Patterns Found

None found in modified files (src/server.ts, bin/sandbox-start.sh). Both are clean.

### Human Verification Required

All automated checks pass. The following items require human action against live external services and cannot be verified programmatically.

#### 1. Live Telnyx Call Test (Success Criterion 1)

**Test:** Provision Telnyx account, set all TELNYX_* env vars, run `bin/sandbox-start.sh`, call the provisioned number
**Expected:** Call connects to OpenClaw gateway and receives an answer response without a "pairing required" error
**Why human:** Requires live Telnyx credentials, provisioned phone number, and running Vercel Sandbox

#### 2. 15-Minute Idle Sandbox Survival (Success Criterion 2)

**Test:** After `bin/sandbox-start.sh` runs, leave the sandbox idle for 15 minutes and confirm the gateway is still alive
**Expected:** Gateway responds to health check at http://127.0.0.1:18789/ after the idle period; keep-alive loop prevented sandbox timeout
**Why human:** Requires real Vercel Sandbox deployment and wall-clock wait

#### 3. Webhook URL Self-Heal After Restart (Success Criterion 3)

**Test:** Restart the sandbox VM; verify that `webhook-url-updater.ts` runs and Telnyx receives webhooks at the new URL without manual intervention
**Expected:** First inbound call after restart reaches the Express webhook handler at the correct URL
**Why human:** Requires live sandbox restart and Telnyx webhook delivery confirmation

#### 4. 10DLC Registration Submission (Success Criterion 4)

**Test:** Set all BUSINESS_* env vars; run `npx tsx src/startup/register-10dlc.ts`; save the returned BRAND_ID and CAMPAIGN_ID
**Expected:** Telnyx API returns a brand ID and campaign ID, confirming the submission was received by TCR
**Why human:** Requires real business credentials and makes live API calls to Telnyx/TCR

#### 5. Free Caller Registry and CNAM Registration (Success Criterion 5)

**Test:** Register phone number at freecallerregistry.com; set CNAM to "Cardinal Conseils" in Telnyx Mission Control
**Expected:** Caller ID shows "Cardinal Conseils" on outbound calls; number is not flagged as spam
**Why human:** Requires manual dashboard actions on external services — no code path covers this

### Gaps Summary

No code gaps remain. Both gaps from the initial verification were closed by Plan 01-04:

**Gap 1 — server.ts CLI entrypoint (CLOSED)**

`src/server.ts` now contains an `isDirectExecution` block (lines 47-105) that detects when the module is run directly via `npx tsx src/server.ts` or `node server.js`. When run directly it: instantiates `GatewayManager`, polls gateway health up to 30s, calls `startServer()` to bind Express on port 18790, calls `startKeepAlive(gatewayManager)`, and registers SIGTERM/SIGINT graceful shutdown handlers.

**Gap 2 — Keep-alive and GatewayManager wiring (CLOSED)**

Both `GatewayManager` and `startKeepAlive` are now imported at the top of `src/server.ts` (lines 3-4) and instantiated/called inside the CLI entrypoint block. The gateway runs as a managed process with auto-restart rather than an unmonitored nohup process.

**Remaining work:** Five live integration tests (listed above) require a deployed Vercel Sandbox and live Telnyx credentials. These are environment/provisioning steps, not code gaps.

**Test suite:** 33/33 tests pass across 8 test files — zero regressions introduced by Plan 01-04.

---

_Verified: 2026-03-14T22:27:30Z_
_Verifier: Claude (gsd-verifier)_
