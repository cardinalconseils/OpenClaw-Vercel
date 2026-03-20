---
phase: 11
slug: fix-murphy-phone-number-18888306873-telnyx-redirect-configuration
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-19
updated: 2026-03-20
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Nyquist Compliance Rationale

This phase is `nyquist_compliant: true` with the following rationale:

- **Changes are external system configuration:** The primary deliverable (Telnyx call forwarding) is configured via API/MCP tools, not code. The only code change is adding `allow: ['sessions_send']` to `openclaw-config.ts`.
- **`npm test` provides regression guard:** The full test suite (379 tests) runs after each task to confirm no regressions from the config change.
- **Live call is the acceptance gate:** The critical validation (call forwarding works, SMS arrives) is inherently manual — it requires a real phone call through the PSTN. This is documented as a `checkpoint:human-verify` task in the plan.
- **No Wave 0 gaps:** Existing test infrastructure covers all automated aspects. The external configuration changes (Telnyx forwarding, Vercel env var) are verified via API GET responses, not unit tests.

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | Call forwarding + env var | API verify | `get_phone_number` MCP tool or `curl GET /v2/phone_numbers/{id}` confirms forwarding to +18885440160; `npm test` for regression | N/A (external config) | pending |
| 11-01-02 | 01 | 1 | sessions_send allowlist | unit + deploy | `npm test`; `curl -s https://murphy.help/health` returns ok | Yes | pending |
| 11-01-03 | 01 | 1 | End-to-end | manual | Live call to +18888306873 + SMS verification | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or stubs needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Calls forwarded to ClawdTalk | Core goal | Requires live PSTN call through Telnyx forwarding | Call +18888306873, verify Murphy answers via ClawdTalk within 5s |
| SMS recap arrives | SMS fix | Requires live call flow to trigger SMS | Complete a service request during call, verify SMS arrives after hangup |
| Env var correct | FIX-01 (secondary) | Encrypted in Vercel | `vercel env pull`, compare TELNYX_PUBLIC_KEY |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (2026-03-20)
**Rationale:** Changes are external system configuration; npm test provides regression guard; live call is the acceptance gate.
