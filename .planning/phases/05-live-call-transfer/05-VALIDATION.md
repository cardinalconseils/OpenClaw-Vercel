---
phase: 5
slug: live-call-transfer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | XFER-01 | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | XFER-02 | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | XFER-03 | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | XFER-04 | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/call-transfer.test.ts` — stubs for XFER-01 through XFER-04
- [ ] Telnyx SDK mock helpers for conference/bridge events

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live 3-way call with real phones | XFER-01 | Requires real Telnyx telephony | Place test call, verify user+provider hear each other after Murphy exits |
| Provider hears briefing before merge | XFER-02 | Audio content verification | Listen on provider phone for briefing before user is bridged |
| Murphy exits cleanly | XFER-03 | Real call leg behavior | Verify call continues after Murphy leaves conference |
| Bridge failure cascade | XFER-04 | Requires simulating provider drop | Hang up provider phone during bridge, verify user hears recovery message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
