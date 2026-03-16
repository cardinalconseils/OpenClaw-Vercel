---
phase: 09-frontend-website
plan: 01
subsystem: ui
tags: [next.js, tailwind-v4, shadcn, vercel, typescript, react, next-themes, supabase]

requires:
  - phase: 04-outbound-provider-calling
    provides: Express backend with /webhooks/telnyx, /health endpoints that vercel.json routes preserve

provides:
  - Next.js 16.1.7 frontend project in frontend/ subdirectory with standalone output
  - Brand design system: Azure Teal primary, #0D0D0D dark background, OKLCH color tokens via shadcn CSS variables
  - 16 shadcn/ui components installed and importable from @/components/ui/
  - Root layout with Montserrat (400, 700) + Cormorant Garamond (700) fonts and ThemeProvider (dark, no system)
  - Frontend type definitions (Mission, CallHistoryRecord, CallStateView) duplicated from backend — no cross-package imports
  - Vercel route splitting: Express handles /webhooks/*, /health, /api/*; Next.js handles all other routes

affects:
  - 09-02-auth
  - 09-03-landing-page
  - 09-04-dashboard
  - 09-05-settings

tech-stack:
  added:
    - next@16.1.7
    - react@19
    - @supabase/supabase-js@2.99.2
    - "@supabase/ssr@0.9.0"
    - next-themes@0.4.6
    - react-hook-form
    - "@hookform/resolvers"
    - zod@3.24
    - lucide-react
    - class-variance-authority
    - clsx
    - tailwind-merge
    - tw-animate-css
    - shadcn@4.0.8
    - tailwindcss@4.2.1
    - "@tailwindcss/postcss"
  patterns:
    - "CSS-first Tailwind v4 configuration via shadcn CSS variables (:root + @theme inline) — no tailwind.config.js"
    - "Always-dark theme: :root and .dark CSS variable blocks identical — brand is permanently dark, ThemeProvider defaultTheme=dark enableSystem=false"
    - "Frontend types duplicated (not imported) from backend to prevent cross-package TypeScript import failures in Vercel isolated builds"
    - "Vercel builds + routes array instead of rewrites catch-all — enables Express + Next.js coexistence on same domain"

key-files:
  created:
    - frontend/package.json
    - frontend/next.config.ts
    - frontend/tsconfig.json
    - frontend/postcss.config.mjs
    - frontend/components.json
    - frontend/src/app/layout.tsx
    - frontend/src/app/globals.css
    - frontend/src/app/page.tsx
    - frontend/src/lib/types.ts
    - frontend/src/lib/utils.ts
    - frontend/src/components/ui/ (16 shadcn components)
  modified:
    - vercel.json
    - package.json

key-decisions:
  - "shadcn v4 uses :root CSS variables + @theme inline instead of plain @theme — brand colors applied by overriding :root values, not the @theme block directly"
  - "toast component deprecated in shadcn v4; used sonner instead"
  - "turbopack.root set in next.config.ts to resolve dual lockfile warning from nested frontend/package-lock.json"
  - "CallStateView (not CallState) in frontend types.ts — omits Node.js runtime types (setTimeout, silenceNudgeTimer) that cannot cross the package boundary"
  - "Always-dark design: :root and .dark CSS variable blocks are identical — brand supports dark mode only per CONTEXT.md locked decision"

patterns-established:
  - "Pattern: frontend/ subdirectory with own package.json — Vercel builds it independently via @vercel/next builder"
  - "Pattern: brand colors in OKLCH — all theme tokens use OKLCH(L C H) format per Tailwind v4 standard"
  - "Pattern: ThemeProvider wraps all children in root layout — required for shadcn dark mode via next-themes"

requirements-completed: [WEB-06, WEB-07]

duration: 6min
completed: 2026-03-16
---

# Phase 09 Plan 01: Frontend Scaffold and Design System Summary

**Next.js 16 frontend with shadcn/ui dark design system, Azure Teal brand colors, Montserrat+Cormorant Garamond fonts, and Vercel route splitting for Express coexistence**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-16T23:27:49Z
- **Completed:** 2026-03-16T23:33:27Z
- **Tasks:** 3
- **Files modified:** 20+

## Accomplishments

- Next.js 16.1.7 project scaffolded in `frontend/` with Tailwind CSS 4, TypeScript, standalone output
- Brand design system installed: Azure Teal (`#00BFFF` / `oklch(0.75 0.14 215)`) as primary, `#0D0D0D` dark background, Montserrat + Cormorant Garamond fonts, 16 shadcn components
- Vercel route splitting configured: Express owns `/webhooks/*`, `/health`, `/api/*`; Next.js catches all other routes — all 379 backend tests still pass

## Task Commits

1. **Task 1: Scaffold Next.js project and install dependencies** - `c2cb2b4` + `eb89717` (feat)
2. **Task 2: Initialize shadcn with brand design system and create root layout** - `daaa0fb` (feat)
3. **Task 3: Configure Vercel route splitting for Express + Next.js coexistence** - `a1c41e3` (feat)

## Files Created/Modified

- `frontend/package.json` — Next.js 16 project with all dependencies
- `frontend/next.config.ts` — standalone output, turbopack.root set for monorepo
- `frontend/tsconfig.json` — TypeScript config for Next.js App Router
- `frontend/postcss.config.mjs` — @tailwindcss/postcss plugin for Tailwind v4
- `frontend/components.json` — shadcn config (base-nova style, CSS variables, @/* alias)
- `frontend/src/app/layout.tsx` — Root layout: Montserrat+Cormorant fonts, ThemeProvider(dark)
- `frontend/src/app/globals.css` — Brand design system: dark surface OKLCH tokens, Azure Teal primary, font mappings
- `frontend/src/app/page.tsx` — Minimal landing placeholder (replaced in Plan 03)
- `frontend/src/lib/types.ts` — Mission, MissionStep, MissionEventResult, CallHistoryRecord, CallStateView types
- `frontend/src/lib/utils.ts` — shadcn `cn()` utility (clsx + tailwind-merge)
- `frontend/src/components/ui/` — 16 shadcn components (button, card, form, input, label, tabs, badge, separator, avatar, dropdown-menu, sheet, dialog, alert-dialog, table, skeleton, sonner, chart)
- `vercel.json` — Replaced single catch-all rewrite with builds + routes for Express + Next.js coexistence
- `package.json` — Added frontend:dev, frontend:build, frontend:install scripts

## Decisions Made

- **shadcn v4 CSS variable pattern:** shadcn init generates `:root` + `.dark` CSS variable blocks + `@theme inline` mapping — brand colors applied by overriding these `:root` values (not a plain `@theme` block as the plan suggested). The plan's `@theme` approach was the Tailwind v4 standalone pattern; shadcn v4 uses a CSS-variables-then-map-to-theme approach.
- **sonner instead of toast:** `toast` component is deprecated in shadcn v4; replaced with `sonner` per CLI guidance.
- **turbopack.root:** Set in `next.config.ts` to resolve "multiple lockfiles" warning from Vercel/Turbopack detecting both root and frontend `package-lock.json`.
- **CallStateView not CallState:** Frontend type avoids Node.js-specific fields (`silenceNudgeTimer`, `silenceNudgeCount`, `consentTimestamp`, `consentMethod`) that either use `ReturnType<typeof setTimeout>` or are backend-internal.
- **Always-dark:** `:root` and `.dark` CSS variable blocks are identical — product is dark-only per CONTEXT.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used CSS variable override pattern instead of bare @theme for shadcn compatibility**

- **Found during:** Task 2 (shadcn init)
- **Issue:** Plan specified `@theme { --color-background: ... }` directly. But shadcn v4 generates its own `@theme inline` block that maps CSS vars to Tailwind tokens. Overwriting with a bare `@theme` block would conflict with shadcn's generated mapping and break component styling.
- **Fix:** Applied brand colors via `:root` CSS variable overrides, keeping shadcn's `@theme inline` mapping structure intact. Both `:root` and `.dark` blocks use brand dark values.
- **Files modified:** `frontend/src/app/globals.css`
- **Verification:** `npx next build` passes; shadcn components importable
- **Committed in:** `daaa0fb` (Task 2 commit)

**2. [Rule 3 - Blocking] Replaced deprecated `toast` with `sonner` in shadcn component list**

- **Found during:** Task 2 (shadcn component installation)
- **Issue:** `npx shadcn@latest add toast --yes` returned exit code 1: "The toast component is deprecated. Use the sonner component instead."
- **Fix:** Replaced `toast` with `sonner` in the component add command.
- **Files modified:** `frontend/src/components/ui/sonner.tsx` (created)
- **Verification:** All 16 components installed successfully
- **Committed in:** `daaa0fb` (Task 2 commit)

**3. [Rule 3 - Blocking] create-next-app could not be used on existing frontend/ directory**

- **Found during:** Task 1 (scaffold)
- **Issue:** `frontend/` already had a stub `package.json` and empty `src/` from a prior planning commit. `create-next-app --yes` fails if target directory has conflicting files.
- **Fix:** Manually created all files that `create-next-app` would generate: `package.json` with exact deps, `tsconfig.json`, `postcss.config.mjs`, `next-env.d.ts`, app directory structure, layout, page.
- **Verification:** `npx next build` passes
- **Committed in:** `c2cb2b4` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for compatibility with shadcn v4 and existing project structure. No scope creep.

## Issues Encountered

- Dual lockfile warning from Next.js Turbopack (detects both root `package-lock.json` and `frontend/package-lock.json`). Resolved by setting `turbopack.root` in `next.config.ts`.

## User Setup Required

None — no external service configuration required for this plan. Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are needed in Plans 02+ for auth.

## Next Phase Readiness

- Design system foundation complete — all subsequent plans can import from `@/components/ui/`
- Root layout with fonts and ThemeProvider ready for all pages
- Frontend types available at `@/lib/types` for all dashboard components
- Vercel routing configured — backend endpoints preserved, Next.js gets all other routes
- Next: Plan 02 (Supabase Auth — login, signup, middleware, OAuth callback)

---
*Phase: 09-frontend-website*
*Completed: 2026-03-16*
