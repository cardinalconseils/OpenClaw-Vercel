---
phase: 6
slug: post-call-sms
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | POST-01 | unit | `npm test -- --run src/lib/voice/recap-sms.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | POST-02 | unit | `npm test -- --run src/lib/voice/recap-sms.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | POST-03 | unit | `npm test -- --run src/lib/voice/recap-sms.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | POST-04 | unit | `npm test -- --run src/api/webhooks.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/voice/recap-sms.test.ts` — stubs for POST-01, POST-02, POST-03
- [ ] `src/api/webhooks.test.ts` — stubs for POST-04 (SMS trigger integration)

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SMS delivered within 30s | POST-01 | Requires live Telnyx call | Make test call, verify SMS arrival time |
| SMS received on real phone | POST-01, POST-03 | End-to-end telephony | Call Murphy, complete flow, check phone |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
