---
phase: 09-frontend-website
plan: "02"
subsystem: frontend/landing
tags: [landing-page, nextjs, react, tailwind, shadcn, voice-wave, responsive]
dependency_graph:
  requires: [09-00, 09-01]
  provides: [landing-page, hero-section, features-section, social-proof, navbar, footer, voice-wave]
  affects: [frontend/src/app/page.tsx]
tech_stack:
  added: []
  patterns:
    - "Server components for static sections (HeroSection, FeaturesSection, SocialProofSection, Footer)"
    - "Client component for NavBar (useState for mobile Sheet) and VoiceWave (CSS animation)"
    - "CSS keyframe animation with prefers-reduced-motion via inline <style> tag"
    - "Glassmorphism cards using oklch color with transparency and backdrop-filter"
    - "Base UI sheet/button pattern via @base-ui/react (no asChild prop — render prop pattern instead)"
key_files:
  created:
    - frontend/src/components/landing/navbar.tsx
    - frontend/src/components/landing/hero-section.tsx
    - frontend/src/components/landing/voice-wave.tsx
    - frontend/src/components/landing/features-section.tsx
    - frontend/src/components/landing/social-proof-section.tsx
    - frontend/src/components/landing/footer.tsx
  modified:
    - frontend/src/app/page.tsx
    - frontend/src/app/__tests__/landing.test.tsx
decisions:
  - "NavBar uses plain Next.js Link for Sign In (not Button asChild) — @base-ui/react Button does not support asChild prop"
  - "VoiceWave uses inline <style> tag with @media (prefers-reduced-motion: reduce) — ensures CSS disables animation at browser level"
  - "HeroSection is server component — no interactivity needed; VoiceWave imported as client component for animation"
metrics:
  duration: "135s"
  completed_date: "2026-03-16"
  tasks_completed: 2
  tasks_total: 3
  files_created: 6
  files_modified: 2
---

# Phase 09 Plan 02: Landing Page — Summary

**One-liner:** Dark-themed landing page at `/` with Cormorant Garamond hero headline, Azure Teal voice wave animation, glassmorphism feature cards, testimonials, and fixed navigation — 6 behavioral tests passing.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build landing page components | 35cef5a | navbar.tsx, hero-section.tsx, voice-wave.tsx, features-section.tsx, social-proof-section.tsx, footer.tsx |
| 2 | Compose landing page and tests | 2f09489 | page.tsx, landing.test.tsx |

## Task Pending (Checkpoint)

| Task | Name | Status |
|------|------|--------|
| 3 | Visual verification of landing page | Awaiting human review |

---

## What Was Built

### NavBar (`navbar.tsx`)
Fixed top navigation bar (`bg-background/80 backdrop-blur-sm border-b border-border`). Left: "Murphy" text logo. Right: Desktop nav links (Dashboard, Missions, Analytics) + "Sign In" link to `/login`. Mobile: hamburger button with Sheet drawer containing the same links.

### HeroSection (`hero-section.tsx`)
Server component with `pt-32 pb-16` vertical spacing. Display headline "One call replaces five." in `font-display text-6xl font-bold`. Sub-headline in Montserrat Regular. VoiceWave animation below sub-headline. "Call Murphy Now" CTA button as `<a href="tel:+18888306873">` with Azure Teal background, rounded-full, uppercase Montserrat Bold. Phone number "+1-888-830-6873" in muted text below.

### VoiceWave (`voice-wave.tsx`)
Client component. 7 animated SVG bars in Azure Teal (`bg-primary`) with staggered delays for wave effect. 2-second CSS keyframe loop. Inline `<style>` tag includes `@media (prefers-reduced-motion: reduce)` to disable animation.

### FeaturesSection (`features-section.tsx`)
Server component. "How It Works" heading. 3-column glassmorphism grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`). Cards with `backdrop-filter: blur(12px)`, semi-transparent dark fill. Lucide icons: Phone, Search, Zap. Three steps: Call Murphy → AI Finds Providers → Live Connection.

### SocialProofSection (`social-proof-section.tsx`)
Server component. "What People Are Saying" heading. 3 testimonial cards (`bg-card border border-border rounded-xl`) with quotes and attribution (Sarah K./Austin TX, James R./Denver CO, Maria L./Portland OR).

### Footer (`footer.tsx`)
Server component. 3-column grid: Murphy brand + tagline "One call replaces five.", nav links, BuyMeACoffee link (`NEXT_PUBLIC_BUYMEACOFFEE_URL`). Copyright line.

### page.tsx
Composes all sections: `<NavBar />`, `<main>` with HeroSection + FeaturesSection + SocialProofSection, `<Footer />`.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] NavBar Button asChild incompatibility with @base-ui/react**
- **Found during:** Task 1, `npx next build` TypeScript check
- **Issue:** `@base-ui/react` Button does not expose `asChild` prop (not Radix UI). Using `<Button asChild><Link>...</Link></Button>` caused TS error.
- **Fix:** Replaced with plain `<Link>` element styled directly with Tailwind text-primary classes. Mobile Sheet trigger uses the `render` prop pattern (`<SheetTrigger render={<Button .../>}>`) as the @base-ui/react pattern for polymorphic rendering.
- **Files modified:** `frontend/src/components/landing/navbar.tsx` (linter auto-applied fix)
- **Commit:** 35cef5a

---

## Tests

All 6 behavioral tests pass:
- HeroSection renders hero headline "One call replaces five."
- HeroSection displays phone number +1-888-830-6873 as clickable tel: link
- FeaturesSection renders "How It Works" heading and 3 feature cards
- SocialProofSection renders "What People Are Saying" heading
- NavBar renders "Sign In" link to /login
- VoiceWave includes prefers-reduced-motion media query

Run: `cd frontend && npx vitest run src/app/__tests__/landing.test.tsx`

---

## Self-Check

### Files Created
- [x] frontend/src/components/landing/navbar.tsx
- [x] frontend/src/components/landing/hero-section.tsx
- [x] frontend/src/components/landing/voice-wave.tsx
- [x] frontend/src/components/landing/features-section.tsx
- [x] frontend/src/components/landing/social-proof-section.tsx
- [x] frontend/src/components/landing/footer.tsx
- [x] frontend/src/app/page.tsx (modified)
- [x] frontend/src/app/__tests__/landing.test.tsx (modified)

### Commits
- [x] 35cef5a — feat(09-02): build landing page components
- [x] 2f09489 — feat(09-02): compose landing page and add behavioral tests

## Self-Check: PASSED
