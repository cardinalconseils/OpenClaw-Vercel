---
phase: 1
slug: infrastructure-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (Wave 0 installs) |
| **Config file** | `vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 0 | INFRA-03 | unit | `npx vitest run tests/startup/pair-device.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | INFRA-01 | smoke | `npx vitest run tests/startup/gateway.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | INFRA-02 | unit | `npx vitest run tests/api/webhooks.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | INFRA-04 | unit | `npx vitest run tests/startup/keepalive.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | INFRA-05 | integration | `npx vitest run tests/startup/10dlc-registration.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — test runner configuration
- [ ] `npm install -D vitest @vitest/coverage-v8` — framework install
- [ ] `tests/startup/pair-device.test.ts` — stubs for INFRA-03
- [ ] `tests/startup/gateway.test.ts` — stubs for INFRA-01
- [ ] `tests/api/webhooks.test.ts` — stubs for INFRA-02
- [ ] `tests/startup/keepalive.test.ts` — stubs for INFRA-04
- [ ] `tests/startup/10dlc-registration.test.ts` — stubs for INFRA-05

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Telnyx webhooks reach sandbox after URL update | INFRA-02 | Requires live Telnyx account + running sandbox | Make test call to Telnyx number, verify webhook received in Express logs |
| 10DLC campaign approval | INFRA-05 | 1-7 business day TCR review process | Check Telnyx Mission Control → 10DLC → Campaign status |
| CNAM "Cardinal Conseils" displays on outbound calls | INFRA-05 | 3-5 day carrier propagation | Place outbound test call, check caller ID on receiving phone |
| Free Caller Registry confirmation | INFRA-05 | Manual portal submission | Verify registration at freecallerregistry.com |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
