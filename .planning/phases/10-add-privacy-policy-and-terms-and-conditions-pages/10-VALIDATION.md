---
phase: 10
slug: add-privacy-policy-and-terms-and-conditions-pages
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `frontend/vitest.config.ts` |
| **Quick run command** | `cd frontend && npm test -- --run` |
| **Full suite command** | `cd frontend && npm test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npm test -- --run`
- **After every plan wave:** Run `cd frontend && npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | Footer legal links | unit (render) | `cd frontend && npm test -- --run` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | Login agreement text | unit (render) | `cd frontend && npm test -- --run` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | /privacy page renders | smoke (manual) | Lighthouse | N/A | ⬜ pending |
| 10-01-04 | 01 | 1 | /terms page renders | smoke (manual) | Lighthouse | N/A | ⬜ pending |
| 10-01-05 | 01 | 1 | ToC scroll-spy | manual | Visual inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/__tests__/footer-legal-links.test.tsx` — smoke render test for footer legal links (check if existing test covers this first)
- [ ] `frontend/src/__tests__/login-agreement.test.tsx` — smoke render test for login agreement text (check if existing test covers this first)

*Check existing Phase 9 test files before creating new ones.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ToC scroll-spy highlighting | Active section highlights on scroll | IntersectionObserver behavior requires browser scroll context | Open /privacy, scroll through sections, verify ToC highlights active section |
| Mobile ToC collapse | ToC collapses into details/summary on mobile | Viewport-dependent layout | Resize browser to <1024px, verify ToC collapses, tap to expand |
| Visual theme consistency | Pages match dark modern theme | Visual design judgment | Compare /privacy and /terms against landing page styling |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
