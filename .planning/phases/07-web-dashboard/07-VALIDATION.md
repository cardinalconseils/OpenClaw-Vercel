---
phase: 7
slug: web-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 + @testing-library/react 16.3.2 |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd frontend && npm test -- --reporter=verbose src/` |
| **Full suite command** | `cd frontend && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm test -- --reporter=verbose src/`
- **After every plan wave:** Run `cd frontend && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | DASH-01 | unit | `cd frontend && npm test -- src/app/api/call-history/route.test.ts` | W0 | pending |
| 07-01-02 | 01 | 1 | DASH-01 | unit | `cd frontend && npm test -- src/lib/phone-normalize.test.ts` | W0 | pending |
| 07-02-01a | 02 | 2 | DASH-02 | unit (RTL) | `cd frontend && npm test -- src/components/history/call-history-card.test.tsx` | W0 | pending |
| 07-02-01b | 02 | 2 | DASH-01 | unit (RTL) | `cd frontend && npm test -- src/components/history/history-lookup-form.test.tsx` | W0 | pending |
| 07-02-01c | 02 | 2 | DASH-03 | unit (RTL) | `cd frontend && npm test -- src/app/history/page.test.tsx` | W0 | pending |
| 07-02-01d | 02 | 2 | DASH-03 | unit (RTL) | `cd frontend && npm test -- src/components/landing/navbar.test.tsx` | exists | pending |
| 07-02-02 | 02 | 2 | DASH-03 | grep | `grep -c 'murphy.help/history' src/lib/voice/recap-sms.ts` returns 2 | n/a | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/app/api/call-history/route.test.ts` — stubs for DASH-01 API route (created in Plan 01 Task 2)
- [ ] `frontend/src/lib/phone-normalize.test.ts` — stubs for DASH-01 phone normalization (created in Plan 01 Task 1)
- [ ] `frontend/src/components/history/call-history-card.test.tsx` — stubs for DASH-02 card rendering (created in Plan 02 Task 1)
- [ ] `frontend/src/components/history/history-lookup-form.test.tsx` — stubs for DASH-01 form submission (created in Plan 02 Task 1)
- [ ] `frontend/src/app/history/page.test.tsx` — stubs for DASH-03 page structure (created in Plan 02 Task 1)

*Existing: `frontend/src/components/landing/navbar.test.tsx` — exists but needs History link assertion added (Plan 02 Task 1)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark theme visual consistency | DASH-03 | Visual design check | Visit /history, verify dark theme matches landing page |
| SMS recap includes /history link | DASH-03 | Requires live call test | Make a test call, verify SMS contains murphy.help/history |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
