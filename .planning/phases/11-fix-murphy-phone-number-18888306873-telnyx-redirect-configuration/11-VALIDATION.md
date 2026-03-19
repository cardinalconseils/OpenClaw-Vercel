---
phase: 11
slug: fix-murphy-phone-number-18888306873-telnyx-redirect-configuration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
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

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | Diagnostic | manual | `curl https://murphy.help/webhooks/telnyx` | N/A | ⬜ pending |
| 11-01-02 | 01 | 1 | Env var fix | manual | `vercel env ls` | N/A | ⬜ pending |
| 11-01-03 | 01 | 1 | Body parsing | unit | `npm test -- --grep rawBody` | ✅ | ⬜ pending |
| 11-01-04 | 01 | 1 | End-to-end | manual | Test call to +18888306873 | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or stubs needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Calls answered | Core fix | Requires live Telnyx call | Call +18888306873, verify answer within 5s |
| Env var correct | Config fix | Encrypted in Vercel | `vercel env pull`, compare TELNYX_PUBLIC_KEY |
| Webhook 200 | Routing | Requires signed Telnyx payload | Check Vercel runtime logs during test call |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
