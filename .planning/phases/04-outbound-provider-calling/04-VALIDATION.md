---
phase: 4
slug: outbound-provider-calling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose src/lib/voice/outbound` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose src/lib/voice/outbound`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CALL-01 | unit | `npx vitest run src/lib/voice/outbound` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | CALL-07 | unit | `npx vitest run src/lib/voice/outbound` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | CALL-02, CALL-06 | unit | `npx vitest run src/lib/voice/outbound` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | CALL-05 | unit | `npx vitest run src/lib/voice/outbound` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | CALL-03 | unit | `npx vitest run src/lib/voice` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | CALL-04 | unit | `npx vitest run src/lib/voice` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | CALL-01-07 | integration | `npx vitest run src/lib/voice/webhooks` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/voice/outbound/*.test.ts` — test stubs for outbound dialer, AMD, cascade
- [ ] `src/lib/voice/outbound/` — directory for outbound calling modules

*Existing vitest infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live outbound call connects | CALL-01 | Requires live Telnyx account and phone | Dial a test number, verify ring and answer |
| AMD detects voicemail | CALL-05 | Requires real voicemail system | Call a number with voicemail, verify detection |
| SMS pre-notification received | CALL-04 | Requires live SMS delivery | Check provider phone for SMS after call |
| User hears narration during dial | CALL-03 | Requires active call audio | Call in, verify TTS plays during provider dial |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
