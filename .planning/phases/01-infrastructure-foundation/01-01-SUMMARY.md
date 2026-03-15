---
phase: 01-infrastructure-foundation
plan: "01"
subsystem: infra
tags: [telnyx, vitest, zod, typescript, ed25519, crypto, test-infrastructure]

# Dependency graph
requires: []
provides:
  - Vitest test runner configured and running (vitest.config.ts)
  - Telnyx webhook payload Zod schemas and TypeScript types (src/types/telnyx.ts)
  - Telnyx SDK singleton for reuse across modules (src/lib/voice/telnyx-client.ts)
  - OpenClaw device pre-pairing module with CLI entrypoint (src/startup/pair-device.ts)
  - tsconfig.json with NodeNext module resolution and strict mode
affects:
  - 01-02 (webhook handler uses TelnyxWebhookEvent schema and telnyxClient)
  - 01-03 (sandbox-start.sh calls src/startup/pair-device.ts via npx tsx)
  - all future plans (Vitest test runner is the foundation for all tests)

# Tech tracking
tech-stack:
  added:
    - telnyx (SDK for Call Control v2 REST + webhook signature verification)
    - express (HTTP server for webhook handler)
    - zod (schema validation for webhook payloads)
    - dotenv (environment variable loading)
    - ws (required peer dep for telnyx SDK speech-to-text resource)
    - vitest + @vitest/coverage-v8 (test runner)
    - typescript + tsx (type safety + direct TS execution)
    - "@types/node + @types/express" (type declarations)
  patterns:
    - TDD red-green: write failing tests, then implement, then verify
    - Singleton pattern for Telnyx client (imported once, reused everywhere)
    - Accept optional stateDir param in functions to enable isolated unit testing without env var hacks
    - NodeNext module resolution with .js extensions in imports

key-files:
  created:
    - vitest.config.ts
    - tsconfig.json
    - package.json
    - src/types/telnyx.ts
    - src/lib/voice/telnyx-client.ts
    - src/startup/pair-device.ts
    - tests/lib/voice/telnyx-client.test.ts
    - tests/types/telnyx.test.ts
    - tests/startup/pair-device.test.ts
  modified:
    - .env.example (added TELNYX_CONNECTION_ID)

key-decisions:
  - "prePairDevice() accepts an optional stateDir parameter rather than relying solely on OPENCLAW_STATE_DIR env var — enables clean isolated tests without module cache invalidation"
  - "ws package added as explicit production dep (telnyx SDK has it as optional peer dep for speech-to-text; fails at import time without it)"
  - "Ed25519 keypair public key encoding is DER/SPKI for deviceId computation and paired.json; private key is PEM/PKCS8 for runtime authentication"
  - "operator.write and operator.read scopes included per OpenClaw issue #23006 (required for tool connections)"

patterns-established:
  - "Pattern: Telnyx singleton — import telnyxClient from src/lib/voice/telnyx-client.ts; never instantiate Telnyx directly elsewhere"
  - "Pattern: Zod webhook validation — all inbound Telnyx events must be validated against TelnyxWebhookEventSchema before processing"
  - "Pattern: Test isolation via parameter injection — pass state dir / config as function parameter, not via env vars that pollute module cache"

requirements-completed: [INFRA-03]

# Metrics
duration: 3min
completed: "2026-03-14"
---

# Phase 1 Plan 01: Infrastructure Foundation — Test Setup, Telnyx Types, and Device Pre-Pairing Summary

**Vitest test runner, Telnyx Call Control Zod schemas, SDK singleton, and Ed25519 device pre-pairing module with CLI entrypoint — all 11 tests green**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T21:24:25Z
- **Completed:** 2026-03-14T21:27:19Z
- **Tasks:** 2
- **Files modified:** 9 created, 1 modified

## Accomplishments

- Installed all Phase 1 dependencies: telnyx, express, zod, dotenv, ws, vitest, typescript, tsx
- Created Telnyx webhook Zod schemas that validate real Call Control v2 event structure
- Created Telnyx SDK singleton with API key guard, shared across all future modules
- Implemented `prePairDevice()` that generates Ed25519 keypair, writes paired.json with operator role + 5 scopes, clears pending.json, writes device-key.pem
- CLI entrypoint confirmed working via `npx tsx src/startup/pair-device.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, configure Vitest, create Telnyx types and client** — `d9254db` (feat)
2. **Task 2: Implement OpenClaw device pre-pairing module with CLI entrypoint** — `fc22324` (feat)

_Note: TDD tasks had combined test+implementation commits (tests written first, then implementation, committed together after green)_

## Files Created/Modified

- `vitest.config.ts` — Test runner configuration (tests/**/*.test.ts, verbose reporter, no watch)
- `tsconfig.json` — TypeScript config with NodeNext module resolution, strict mode, ES2022 target
- `package.json` — All dependencies including telnyx, express, zod, vitest, tsx
- `src/types/telnyx.ts` — TelnyxWebhookEventSchema (Zod) and TelnyxCallControlEvent union type
- `src/lib/voice/telnyx-client.ts` — Telnyx SDK singleton with API key guard
- `src/startup/pair-device.ts` — prePairDevice(stateDir?) function + CLI entrypoint
- `tests/lib/voice/telnyx-client.test.ts` — 2 tests: non-null export, webhooks property
- `tests/types/telnyx.test.ts` — 3 tests: valid event, missing event_type, missing call_control_id
- `tests/startup/pair-device.test.ts` — 6 tests covering all behavioral requirements
- `.env.example` — Added TELNYX_CONNECTION_ID (needed for webhook URL update in Plan 03)

## Decisions Made

- `prePairDevice()` accepts optional `stateDir` parameter for test isolation instead of relying on env var mutations — avoids module cache invalidation complexity with Vitest ESM
- `ws` package added as explicit production dependency — telnyx SDK imports it at module load time for speech-to-text; without it, the entire telnyx module fails to load even if speech-to-text is never used
- Ed25519 public key in DER/SPKI format for SHA-256 deviceId computation and paired.json storage; private key in PEM/PKCS8 format for file-based runtime auth
- Included `operator.write` and `operator.read` scopes per OpenClaw issue #23006 (required for tool connections, missing in 2026.2.19 upgrade)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing `ws` peer dependency for telnyx SDK**
- **Found during:** Task 1 (GREEN phase — first test run after creating telnyx-client.ts)
- **Issue:** `telnyx` SDK imports `ws` package in `node_modules/telnyx/resources/speech-to-text/ws.mjs` at module load time. Even though this project doesn't use speech-to-text, the import fails with `ERR_MODULE_NOT_FOUND` preventing the entire telnyx module from loading.
- **Fix:** `npm install ws`
- **Files modified:** package.json, package-lock.json
- **Verification:** All 5 Task 1 tests pass after install
- **Committed in:** d9254db (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking missing dependency)
**Impact on plan:** Essential fix; telnyx SDK is unusable without ws. No scope creep.

## Issues Encountered

- Dynamic import with cache-busting query string (`?t=${Date.now()}`) does not work in Vitest ESM — rewrote tests to pass `stateDir` as a function parameter instead, which is actually a cleaner design pattern for testability.

## User Setup Required

None — no external service configuration required for this plan. Environment variables are defined in `.env.example` and filled in during live deployment.

## Next Phase Readiness

- Vitest is installed and all 11 tests pass — subsequent plans can add tests immediately
- `telnyxClient` singleton is ready for use in webhook handler (Plan 02) and URL updater (Plan 03)
- `TelnyxWebhookEvent` and `TelnyxCallControlEvent` types are ready for webhook handler (Plan 02)
- `prePairDevice()` is ready to be called from `bin/sandbox-start.sh` (Plan 03)
- No blockers for Plan 02

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-03-14*
