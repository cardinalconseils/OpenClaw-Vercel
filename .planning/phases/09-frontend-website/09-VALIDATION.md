---
phase: 9
slug: frontend-website
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) + Playwright (new — E2E) |
| **Config file** | `vitest.config.ts` (existing), `playwright.config.ts` (Wave 0) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npx playwright test` |
| **Estimated runtime** | ~30 seconds (unit) + ~60 seconds (E2E) |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | WEB-06 | integration | `npm test -- vercel-config` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | WEB-01 | E2E | `npx playwright test landing` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 2 | WEB-02 | integration | `npm test -- supabase-auth` | ❌ W0 | ⬜ pending |
| 09-04-01 | 04 | 2 | WEB-03, WEB-04 | E2E | `npx playwright test dashboard` | ❌ W0 | ⬜ pending |
| 09-05-01 | 05 | 3 | WEB-05 | E2E | `npx playwright test settings` | ❌ W0 | ⬜ pending |
| 09-06-01 | 06 | 3 | WEB-07 | lighthouse | `npx lighthouse --quiet` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `playwright.config.ts` — Playwright configuration for E2E tests
- [ ] `tests/e2e/` — E2E test directory structure
- [ ] `npm i -D @playwright/test` — Playwright installation

*Existing vitest infrastructure covers unit/integration tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark theme visual quality | WEB-01 | Subjective visual assessment | Open landing page, verify dark backgrounds, glassmorphism cards, accent colors |
| Responsive layout | WEB-07 | Visual breakpoint verification | Resize browser to 320px, 768px, 1024px, 1440px — verify no layout breaks |
| Google OAuth flow | WEB-02 | Requires real Google credentials | Click "Sign in with Google", complete OAuth flow, verify redirect to dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
