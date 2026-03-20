---
phase: 10-add-privacy-policy-and-terms-and-conditions-pages
plan: "01"
subsystem: frontend-legal
tags: [legal, compliance, privacy, terms, next-js, react]
dependency_graph:
  requires: [frontend/src/components/landing/navbar.tsx, frontend/src/components/landing/footer.tsx]
  provides: [frontend/src/app/privacy/page.tsx, frontend/src/app/terms/page.tsx, frontend/src/components/legal/]
  affects: [frontend routing at /privacy and /terms]
tech_stack:
  added: []
  patterns: [React Server Components, IntersectionObserver scroll-spy, Next.js App Router static pages]
key_files:
  created:
    - frontend/src/components/legal/legal-toc.tsx
    - frontend/src/components/legal/legal-page-layout.tsx
    - frontend/src/app/privacy/page.tsx
    - frontend/src/app/terms/page.tsx
  modified: []
decisions:
  - "LegalToc uses IntersectionObserver with rootMargin: '-80px 0px -60% 0px' — top -80px accounts for fixed navbar height (64px + buffer)"
  - "LegalPageLayout is a server component wrapping the client LegalToc — avoids unnecessary client bundles for static legal content"
  - "Mobile ToC uses native HTML details/summary element — no JS required for expand/collapse, accessible by default"
  - "Duplicate id attributes on section + h2 elements omitted on h2 (section id alone is sufficient for anchor navigation)"
metrics:
  duration: "219s"
  completed_date: "2026-03-19"
  tasks_completed: 3
  files_created: 4
  files_modified: 0
---

# Phase 10 Plan 01: Legal Pages (Privacy Policy and Terms of Service) Summary

**One-liner:** Four-file legal page system with scroll-spy ToC sidebar, full CCPA/PIPEDA/TCPA/CAN-SPAM coverage, and CA SB-1001 AI disclosure for Cardinal Conseils' Murphy service.

## What Was Built

Created a complete legal pages subsystem for murphy.help comprising four new files:

1. **`legal-toc.tsx`** — Client component implementing a sticky table-of-contents sidebar with IntersectionObserver scroll-spy. Supports both desktop (nav list) and mobile (details/summary collapsible) modes.

2. **`legal-page-layout.tsx`** — Server component providing the shared two-column grid layout (240px sidebar + 1fr content on lg+). Wraps NavBar, sticky ToC, content area, and Footer. Displays "Last updated" date and attorney disclaimer at top.

3. **`/privacy/page.tsx`** — Privacy Policy page at `/privacy` covering 10 sections: overview, data collected, how we use data, third-party services (Telnyx, Supabase, Google Places, OpenRouter/Anthropic, BuyMeACoffee, Vercel), data retention, CCPA/PIPEDA rights, TCPA telephone/SMS consent, CAN-SPAM email, data security, and contact.

4. **`/terms/page.tsx`** — Terms of Service page at `/terms` covering 10 sections: about Murphy, AI disclosure (CA SB-1001), eligibility (18+, US/Canada), service workflow (7-step), acceptable use, third-party disclaimers, "as is" disclaimers, standard SaaS liability limitation, changes policy, and contact.

## Commits

| Hash | Task | Description |
|------|------|-------------|
| f33d5f0 | Task 1 | feat(10-01): add shared legal page layout and scroll-spy ToC components |
| 13e9ac0 | Task 2 | feat(10-01): create Privacy Policy page at /privacy |
| 2c8f4c3 | Task 3 | feat(10-01): create Terms of Service page at /terms |

## Verification

- TypeScript: `npx tsc --noEmit` passes with zero errors after each task
- Tests: 36 existing frontend tests pass (all unaffected)
- All acceptance criteria met for all 3 tasks

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files confirmed present:
- FOUND: frontend/src/components/legal/legal-toc.tsx
- FOUND: frontend/src/components/legal/legal-page-layout.tsx
- FOUND: frontend/src/app/privacy/page.tsx
- FOUND: frontend/src/app/terms/page.tsx

Commits confirmed:
- FOUND: f33d5f0 (legal-toc + legal-page-layout)
- FOUND: 13e9ac0 (privacy page)
- FOUND: 2c8f4c3 (terms page)
