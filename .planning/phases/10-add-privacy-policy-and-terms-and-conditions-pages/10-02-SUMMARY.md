---
phase: 10-add-privacy-policy-and-terms-and-conditions-pages
plan: 02
subsystem: ui
tags: [next.js, react, footer, legal, links, testing, vitest]

# Dependency graph
requires:
  - phase: 10-add-privacy-policy-and-terms-and-conditions-pages
    provides: privacy and terms pages at /privacy and /terms routes
provides:
  - Footer with Privacy Policy (/privacy) and Terms of Service (/terms) links in copyright row
  - Login page with "By signing in, you agree to our Terms of Service and Privacy Policy" agreement text
  - Vitest assertions for footer legal links in landing test suite
affects: [frontend-website, legal-pages]

# Tech tracking
tech-stack:
  added: []
  patterns: [next/link used for internal legal page navigation, responsive footer copyright row with flex-col sm:flex-row stacking]

key-files:
  created: []
  modified:
    - frontend/src/components/landing/footer.tsx
    - frontend/src/app/(auth)/login/page.tsx
    - frontend/src/app/__tests__/landing.test.tsx

key-decisions:
  - "Footer copyright row uses flex-col sm:flex-row for responsive stacking — legal links inline on desktop, stacked on mobile"
  - "Login CardFooter className changed from justify-center to flex-col gap-2 text-center to stack Admin access only + agreement text"
  - "Footer tests use dynamic import pattern matching existing VoiceWave/NavBar test conventions"

patterns-established:
  - "Footer legal links: next/link with muted-foreground base + hover:text-foreground transition"
  - "Login agreement text: text-xs text-muted-foreground with text-primary hover:underline links"
  - "Landing tests: dynamic import of component, render + screen.getByRole link assertion, href check"

requirements-completed: [LEGAL-05, LEGAL-06]

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 10 Plan 02: Legal Page Integration Summary

**Footer copyright row and login page wired to /privacy and /terms with test coverage — responsive layout, agreement text, 36 tests passing**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-18T21:42:00Z
- **Completed:** 2026-03-18T21:50:00Z
- **Tasks:** 4 of 4 complete
- **Files modified:** 3

## Accomplishments
- Footer copyright row updated with Privacy Policy and Terms of Service links, responsive flex layout stacking vertically on mobile
- Login page CardFooter extended with "By signing in, you agree to our Terms of Service and Privacy Policy" agreement text with clickable links
- Two new Vitest assertions added to landing test suite verifying footer link hrefs; all 36 tests pass
- Visual verification completed: both legal pages render correctly with dark theme, sticky ToC sidebar, mobile collapse behavior confirmed, footer links navigate correctly, login agreement text visible with working links

## Task Commits

Each task was committed atomically:

1. **Task 1: Add legal links to footer copyright row** - `cd280f0` (feat)
2. **Task 2: Add Terms/Privacy agreement text to login page** - `2c2742d` (feat)
3. **Task 3: Add footer legal link tests to landing test suite** - `0ee9a57` (test)
4. **Task 4: Visual verification of legal pages and integrations** - checkpoint approved by user

## Files Created/Modified
- `frontend/src/components/landing/footer.tsx` - Copyright row replaced with responsive flex layout containing copyright text + Privacy Policy + Terms of Service links
- `frontend/src/app/(auth)/login/page.tsx` - Link import added; CardFooter extended with legal agreement paragraph
- `frontend/src/app/__tests__/landing.test.tsx` - New describe('Footer') block with two link assertion tests

## Decisions Made
- Footer uses `flex-col sm:flex-row` pattern to stack legal links below copyright on mobile — consistent with existing Tailwind responsive conventions
- Login agreement text placed below "Admin access only" as second paragraph — keeps the more prominent message first
- Test pattern matches existing dynamic import convention from VoiceWave/NavBar tests — no new test patterns introduced

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - TypeScript type checks passed cleanly after each modification, all 36 tests passed on first run.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 10 is fully complete: legal pages (plan 01) and legal link integration (plan 02) both shipped and visually verified
- Phase 11 can begin: fix Murphy phone number 18888306873 Telnyx redirect configuration
- All existing tests remain green; no regressions introduced

## Self-Check: PASSED

- FOUND: frontend/src/components/landing/footer.tsx
- FOUND: frontend/src/app/(auth)/login/page.tsx
- FOUND: frontend/src/app/__tests__/landing.test.tsx
- FOUND: .planning/phases/10-add-privacy-policy-and-terms-and-conditions-pages/10-02-SUMMARY.md
- FOUND: cd280f0 (Task 1 commit)
- FOUND: 2c2742d (Task 2 commit)
- FOUND: 0ee9a57 (Task 3 commit)
- All 36 frontend tests pass
- Task 4 visual verification: approved by user 2026-03-19

---
*Phase: 10-add-privacy-policy-and-terms-and-conditions-pages*
*Completed: 2026-03-19*
