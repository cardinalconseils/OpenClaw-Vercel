# Phase 10: Add Privacy Policy and Terms and Conditions Pages - Research

**Researched:** 2026-03-18
**Domain:** Next.js App Router static legal pages with sticky ToC sidebar — frontend-only
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Content source:** Claude drafts comprehensive legal content — include disclaimer "This document was generated for informational purposes. Consult an attorney for legal advice."
- **Entity name:** Cardinal Conseils
- **Contact email:** info@cardinalconseils.com
- **Legal scope:** Privacy Policy covers CCPA (California), CAN-SPAM, TCPA (telephony), PIPEDA (Canada)
- **Third-party disclosures:** Telnyx, Supabase, Google Places API, OpenRouter/Anthropic, BuyMeACoffee, Vercel
- **Terms of Service:** Includes prominent AI disclosure section referencing CA SB-1001; Murphy is an AI agent making automated calls on user's behalf
- **Page design:** Clean single-page scroll with sticky ToC sidebar on desktop, collapsible on mobile; matches dark modern theme
- **Typography:** Montserrat (body) + Cormorant Garamond (headings) — existing font system
- **Chrome:** Full navbar and footer on both pages (same as landing page)
- **"Last updated" date:** Displayed prominently at top of each page
- **URLs:** `/privacy` and `/terms`
- **Footer integration:** Add "Privacy Policy | Terms of Service" links inline in the copyright row at the bottom
- **Auth pages:** Login page — add "By signing up, you agree to our Terms and Privacy Policy" text below forms with links (signup page already redirects to login)
- **CA SB-1001 reference:** AI disclosure in Terms must reference it explicitly

### Claude's Discretion

- Exact legal content wording and section ordering
- Table of contents implementation (scroll-spy, anchor links, etc.)
- Mobile ToC collapse behavior
- Typography hierarchy within legal content sections

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

## Summary

This phase is a front-end-only content integration with no new external dependencies. The two legal pages (`/privacy` and `/terms`) are static, server-rendered Next.js App Router pages that reuse the existing Navbar and Footer components. The primary implementation complexity is the sticky Table of Contents sidebar with optional scroll-spy — everything else is Tailwind layout work and content drafting.

The project uses Next.js App Router with shadcn/ui (on top of base-ui), Tailwind CSS v4, and Montserrat + Cormorant Garamond fonts already loaded in the root layout. No new npm packages are required. The sticky ToC can be built entirely with native CSS `position: sticky` and optional vanilla JS `IntersectionObserver` for active-section highlighting — no library needed.

**Primary recommendation:** Build two top-level App Router pages at `frontend/src/app/privacy/page.tsx` and `frontend/src/app/terms/page.tsx`, extract a shared `LegalPageLayout` component for the sidebar + content grid, and draft all legal copy inline as JSX. Modify `footer.tsx` and `login/page.tsx` for the link integrations.

---

## Standard Stack

### Core (already installed — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 15.x | Static page routing at `/privacy` and `/terms` | Already in use; server components render legal text without JS |
| Tailwind CSS v4 | 4.x | `position: sticky`, `grid`, `overflow-y-auto` layout | Already configured with design tokens |
| shadcn/ui (base-ui) | present | Card, Separator available for section dividers | Already installed |
| IntersectionObserver API | Browser native | Scroll-spy active section in ToC — zero import cost | Universal browser support (97%+) |

### No New Packages Required

All required building blocks exist. Do not install `react-scrollspy`, `react-anchor-link`, or any dedicated ToC library — they add bundle weight for a pure-CSS solvable problem.

---

## Architecture Patterns

### Recommended File Structure

```
frontend/src/
├── app/
│   ├── privacy/
│   │   └── page.tsx          # /privacy — Privacy Policy page
│   └── terms/
│       └── page.tsx          # /terms — Terms of Service page
└── components/
    └── legal/
        ├── legal-page-layout.tsx   # Shared sidebar + content grid
        └── legal-toc.tsx           # ToC with scroll-spy (client component)
```

### Pattern 1: Server Page + Client ToC Island

**What:** The page itself (`page.tsx`) is a React Server Component — no `'use client'`. It renders content, imports `LegalPageLayout` (server-safe wrapper) and passes section headings. The `LegalToc` component is the only `'use client'` island — it handles IntersectionObserver scroll-spy.

**When to use:** Always — keeps legal text SEO-indexable and eliminates hydration cost for static copy.

**Example structure:**
```tsx
// frontend/src/app/privacy/page.tsx  — Server Component, no 'use client'
import { NavBar } from '@/components/landing/navbar'
import { Footer } from '@/components/landing/footer'
import { LegalPageLayout } from '@/components/legal/legal-page-layout'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Murphy',
  description: 'How Cardinal Conseils collects, uses, and protects your data.',
}

const TOC_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'data-collected', label: 'Data We Collect' },
  // ...
]

export default function PrivacyPage() {
  return (
    <>
      <NavBar />
      <LegalPageLayout sections={TOC_SECTIONS} title="Privacy Policy" lastUpdated="March 17, 2026">
        <section id="overview">
          <h2>Overview</h2>
          {/* content */}
        </section>
        {/* ... */}
      </LegalPageLayout>
      <Footer />
    </>
  )
}
```

### Pattern 2: Sticky Sidebar Grid Layout

**What:** CSS Grid with two columns — narrow sticky sidebar (ToC) on left, scrollable content on right. Sidebar becomes collapsible accordion on mobile.

```tsx
// frontend/src/components/legal/legal-page-layout.tsx
// Server component — no 'use client'
import { LegalToc } from './legal-toc'

export function LegalPageLayout({ sections, title, lastUpdated, children }) {
  return (
    <main className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-display font-bold text-4xl md:text-5xl text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          <p className="mt-1 text-xs text-muted-foreground italic">
            This document was generated for informational purposes. Consult an attorney for legal advice.
          </p>
        </div>

        {/* Two-column grid: ToC sidebar + content */}
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
          {/* Sticky ToC — client island */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <LegalToc sections={sections} />
            </div>
          </aside>

          {/* Mobile ToC — collapsible (also LegalToc in accordion mode) */}
          <div className="lg:hidden mb-6">
            <LegalToc sections={sections} mobile />
          </div>

          {/* Legal content */}
          <article className="prose-legal">
            {children}
          </article>
        </div>
      </div>
    </main>
  )
}
```

### Pattern 3: IntersectionObserver Scroll-Spy

**What:** Client component observes section headings with `IntersectionObserver`. When a section enters the viewport, the corresponding ToC link becomes active (highlighted with `text-primary`).

```tsx
'use client'
// frontend/src/components/legal/legal-toc.tsx

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Section = { id: string; label: string }

export function LegalToc({ sections, mobile = false }: { sections: Section[], mobile?: boolean }) {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost intersecting entry
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [sections])

  // Desktop list / mobile collapsible details
  if (mobile) {
    return (
      <details className="border border-border rounded-lg p-4">
        <summary className="font-sans font-bold text-sm text-foreground cursor-pointer">
          Contents
        </summary>
        <TocList sections={sections} activeId={activeId} />
      </details>
    )
  }

  return (
    <nav aria-label="Table of contents">
      <p className="font-sans font-bold text-xs uppercase tracking-widest text-muted-foreground mb-3">
        Contents
      </p>
      <TocList sections={sections} activeId={activeId} />
    </nav>
  )
}

function TocList({ sections, activeId }: { sections: Section[], activeId: string }) {
  return (
    <ul className="space-y-2 mt-3">
      {sections.map(({ id, label }) => (
        <li key={id}>
          <a
            href={`#${id}`}
            className={`block text-sm transition-colors font-sans ${
              activeId === id
                ? 'text-primary font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  )
}
```

### Pattern 4: Legal Typography Utility Classes

**What:** Tailwind utility classes applied directly to legal content elements. No `@tailwindcss/typography` plugin — consistent with project's zero-plugin approach.

```tsx
// Heading within legal content
<h2 className="font-display font-bold text-2xl text-foreground mt-10 mb-4" id="data-collected">
  Data We Collect
</h2>

// Body paragraph
<p className="font-sans text-sm leading-7 text-muted-foreground mb-4">
  ...
</p>

// Sub-heading
<h3 className="font-sans font-bold text-base text-foreground mt-6 mb-2">
  Information You Provide
</h3>

// Inline link within legal text
<a href="mailto:info@cardinalconseils.com" className="text-primary hover:underline">
  info@cardinalconseils.com
</a>
```

### Pattern 5: Footer Link Integration

**What:** Modify the copyright row in `footer.tsx` to add links inline, separated by a pipe character. Keep the existing `<p>` structure, convert to `<div>` with flex for alignment.

**Exact change location:** `footer.tsx` line 58–62 — the `border-t border-border pt-6` div.

```tsx
{/* Copyright — replace <p> with flex div */}
<div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
  <p className="font-sans text-sm font-normal text-muted-foreground">
    &copy; {year} Murphy. All rights reserved.
  </p>
  <span className="hidden sm:block text-muted-foreground/40">|</span>
  <div className="flex gap-4">
    <Link href="/privacy" className="font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">
      Privacy Policy
    </Link>
    <Link href="/terms" className="font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">
      Terms of Service
    </Link>
  </div>
</div>
```

### Pattern 6: Login Page Agreement Text

**What:** Add legal agreement text below the submit button in `login/page.tsx`. The signup page already redirects to login so only login needs this.

**Exact change location:** Inside `<CardFooter>` — replace the "Admin access only" paragraph or add below it.

```tsx
<CardFooter className="flex-col gap-2 text-center">
  <p className="text-sm text-muted-foreground">Admin access only</p>
  <p className="text-xs text-muted-foreground">
    By signing in, you agree to our{' '}
    <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
    {' '}and{' '}
    <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
  </p>
</CardFooter>
```

### Anti-Patterns to Avoid

- **`'use client'` on the whole page:** Legal content is static — putting the entire page in a client component forces unnecessary JS hydration and hurts Lighthouse score.
- **Installing `react-scrollspy` or `react-scroll`:** Pure CSS sticky + IntersectionObserver achieves the same result with zero bundle cost.
- **`@tailwindcss/typography` plugin:** Not installed in this project; apply utility classes directly to match existing style conventions.
- **Importing `Link` from Next.js in `CardFooter` without also importing it at the top of the file:** `login/page.tsx` does not currently import `Link` — must add the import.
- **Using `ScrollArea` from shadcn for the sidebar:** The sidebar doesn't need its own scroll container; `position: sticky` with `top-24` (to clear the fixed navbar height) is sufficient.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll-spy highlighting | Custom scroll event listener with `getBoundingClientRect` polling | `IntersectionObserver` | IntersectionObserver is async, non-blocking, and battery-efficient; scroll listeners on the main thread cause jank |
| Mobile ToC collapse | Custom JS show/hide toggle | Native HTML `<details>/<summary>` | Zero JS, accessible by default, works with CSS-only |
| Sticky sidebar | `position: fixed` with manual JS offset calculation | CSS `position: sticky` + `top-24` | Sticky respects document flow; fixed requires manual offset math |
| Legal page metadata | No description meta | Next.js `export const metadata` | Affects SEO and link previews |

---

## Common Pitfalls

### Pitfall 1: Navbar Height Offset for Sticky Sidebar

**What goes wrong:** The sticky sidebar gets obscured behind the fixed navbar (64px / `h-16`) when scrolling.
**Why it happens:** `position: sticky; top: 0` doesn't account for the fixed nav overlay.
**How to avoid:** Use `top-24` (96px = 16px padding above `h-16` nav) on the sticky sidebar wrapper. The page content also needs `pt-24` top padding to clear the nav.
**Warning signs:** ToC appears behind the navbar on first load or after scroll.

### Pitfall 2: IntersectionObserver rootMargin Must Account for Fixed Nav

**What goes wrong:** Active ToC item lags or highlights wrong section because section enters viewport obscured by the fixed navbar.
**Why it happens:** `rootMargin: '0px'` treats the full viewport as observation area including the nav-obscured region.
**How to avoid:** Use `rootMargin: '-80px 0px -60% 0px'` — the negative top margin excludes the top 80px (nav + buffer), the negative bottom margin biases selection to the top-of-content section.

### Pitfall 3: Section IDs with Spaces or Special Characters

**What goes wrong:** Anchor links like `href="#data-we-collect"` 404 or don't scroll if the `id` attribute doesn't match exactly.
**Why it happens:** IDs are case-sensitive in HTML and spaces break anchor navigation.
**How to avoid:** Use kebab-case IDs consistently (`id="data-we-collect"`, not `id="Data We Collect"` or `id="dataWeCollect"`). Define the `TOC_SECTIONS` array as the single source of truth — derive `id` from it, don't hand-write IDs in JSX separately.

### Pitfall 4: Missing `Link` Import in Login Page

**What goes wrong:** Build error when adding Terms/Privacy links to `login/page.tsx`.
**Why it happens:** `login/page.tsx` currently uses no `Link` components — the import is absent.
**How to avoid:** Add `import Link from 'next/link'` at the top of the file alongside existing imports.

### Pitfall 5: `CardFooter` Flex Direction

**What goes wrong:** The "Admin access only" text and the new agreement text stack horizontally instead of vertically.
**Why it happens:** `CardFooter` uses `justify-center` which is horizontal by default.
**How to avoid:** Add `flex-col gap-2 text-center` to `CardFooter` className when adding the second line.

### Pitfall 6: Legal Content Date Hardcoding

**What goes wrong:** "Last updated" date is hardcoded as a string and becomes stale when content is updated in the future.
**Why it happens:** Convenience during initial build.
**How to avoid:** Still acceptable for static legal pages — but document the date as a named constant at the top of each page file (e.g., `const LAST_UPDATED = 'March 17, 2026'`) so it's easy to find and update.

---

## Legal Content Structure

### Privacy Policy Sections (ordered)

| Section ID | Section Title | Key Content |
|------------|--------------|-------------|
| `overview` | Overview | Who we are (Cardinal Conseils), what Murphy does, scope of policy |
| `data-collected` | Data We Collect | Phone number, name (spoken), service requests, call recordings, account email, location |
| `how-we-use` | How We Use Your Data | Matching providers, executing calls, SMS recap, improving service |
| `third-parties` | Third-Party Services | Telnyx (voice/SMS), Supabase (database/auth), Google Places API, OpenRouter/Anthropic (AI), BuyMeACoffee, Vercel |
| `data-retention` | Data Retention | Call history retention period, account data, right to deletion |
| `your-rights` | Your Rights | CCPA (California), PIPEDA (Canada), access, deletion, opt-out |
| `tcpa` | Telephone and SMS Consent | TCPA compliance, how consent is captured verbally, SMS opt-out |
| `can-spam` | Email Communications | CAN-SPAM compliance, unsubscribe mechanism |
| `security` | Data Security | Encryption at rest (Supabase), transport security (TLS), access controls |
| `contact` | Contact Us | info@cardinalconseils.com, Cardinal Conseils |

### Terms of Service Sections (ordered)

| Section ID | Section Title | Key Content |
|------------|--------------|-------------|
| `overview` | About Murphy | Service description, Cardinal Conseils operator, AI agent nature |
| `ai-disclosure` | AI Disclosure (CA SB-1001) | Murphy is an AI agent; automated calls on user's behalf; no deception of providers; verbal AI identity disclosure on outbound calls |
| `eligibility` | Eligibility | Age requirement (18+), jurisdiction |
| `service-description` | How the Service Works | Inbound call flow, provider search, outbound cascade, live transfer, SMS recap |
| `acceptable-use` | Acceptable Use | Prohibited uses, no fraudulent service requests, no abuse of outbound calling |
| `third-party` | Third-Party Services | Provider independence, Google Places results, BuyMeACoffee tips |
| `disclaimers` | Disclaimers | No guarantee of provider availability, no scheduling/booking, AI output accuracy |
| `liability` | Limitation of Liability | Standard SaaS liability limitation |
| `changes` | Changes to Terms | Notification mechanism, continued use = acceptance |
| `contact` | Contact Us | info@cardinalconseils.com, Cardinal Conseils |

---

## Code Examples

### Complete Footer Copyright Row Replacement

```tsx
// Source: existing footer.tsx line 57-62 (current) → replacement
{/* Copyright row */}
<div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6">
  <p className="font-sans text-sm font-normal text-muted-foreground">
    &copy; {year} Murphy. All rights reserved.
  </p>
  <div className="flex items-center gap-4">
    <Link
      href="/privacy"
      className="font-sans text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
    >
      Privacy Policy
    </Link>
    <span className="text-muted-foreground/40 text-sm">|</span>
    <Link
      href="/terms"
      className="font-sans text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
    >
      Terms of Service
    </Link>
  </div>
</div>
```

### Page Metadata Pattern (App Router)

```tsx
// Source: Next.js App Router — next/server metadata API
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Murphy',
  description: 'How Cardinal Conseils collects, uses, and protects your personal data when you use Murphy.',
}
```

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (frontend workspace) |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npm test -- --run` |
| Full suite command | `cd frontend && npm test -- --run` |

### Phase Requirements → Test Map

This phase has no formal requirement IDs (TBD from requirements file). The deliverables are UI integration points — best validated with Lighthouse and manual visual inspection rather than unit tests. However, the footer and login page modifications touch tested or testable code.

| Deliverable | Behavior | Test Type | Automated Command | File Exists? |
|------------|----------|-----------|-------------------|-------------|
| Footer legal links | Footer renders Privacy Policy and Terms of Service links | Unit (render) | `cd frontend && npm test -- --run src/__tests__` | Check wave 0 |
| `/privacy` page route | Page renders without error, has correct heading | Smoke (manual) | Lighthouse in browser | N/A — static |
| `/terms` page route | Page renders without error, has correct heading | Smoke (manual) | Lighthouse in browser | N/A — static |
| Login agreement text | Login card footer contains Terms and Privacy links | Unit (render) | `cd frontend && npm test -- --run src/__tests__` | Check wave 0 |
| ToC scroll-spy | Active section highlights on scroll | Manual | Visual inspection | N/A |

### Sampling Rate

- **Per task commit:** `cd frontend && npm test -- --run` (existing test suite must stay green)
- **Per wave merge:** Full suite green
- **Phase gate:** All existing tests pass + manual visual check of `/privacy` and `/terms` before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/app/__tests__/footer.test.tsx` — smoke render test for footer legal links (if not already present)
- [ ] `frontend/src/app/__tests__/login.test.tsx` — smoke render test for login agreement text (if not already present)

Check existing test files before creating new ones — Phase 9 may have scaffolded these already.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-scroll` or `react-scrollspy` npm packages | Native `IntersectionObserver` + CSS sticky | 2020+ (browser support matured) | Zero bundle cost, no dependency |
| `@tailwindcss/typography` prose plugin | Direct utility classes | Project-specific (not installed here) | Must hand-apply text styles |
| `window.addEventListener('scroll', ...)` | `IntersectionObserver` | 2018+ | Non-blocking, no main thread jank |
| Pages Router `getStaticProps` | App Router `export const metadata` + Server Component | Next.js 13+ | SEO metadata colocated with page |

---

## Open Questions

1. **Existing test files for footer/login**
   - What we know: Phase 9 scaffolded `frontend/src/app/__tests__/` directory
   - What's unclear: Whether footer.test.tsx and login page tests already exist
   - Recommendation: Wave 0 task should check and create only what's missing; don't overwrite existing tests

2. **`last_updated` date to display**
   - What we know: Context was gathered 2026-03-17; implementation happens 2026-03-18
   - What's unclear: Whether user wants the legal-effective date to match the discussion date or implementation date
   - Recommendation: Use `March 17, 2026` (discussion/decision date) as it reflects when the policy was authored; constant at top of file for easy future updates

3. **NavBar on legal pages — authenticated state**
   - What we know: NavBar is a client component that always shows the same links; it doesn't check auth state dynamically
   - What's unclear: Legal pages are public (`/privacy`, `/terms`) — the NavBar will show "Dashboard / Missions / Sign In" which implies auth-gated features to unauthenticated visitors
   - Recommendation: Acceptable as-is; legal pages are public and the nav context mismatch is minor; no change needed to NavBar

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `frontend/src/components/landing/footer.tsx` — copyright row structure confirmed
- Direct code inspection: `frontend/src/app/(auth)/login/page.tsx` — CardFooter structure and missing Link import confirmed
- Direct code inspection: `frontend/src/app/globals.css` — design tokens (oklch colors, font variables) confirmed
- Direct code inspection: `frontend/src/app/layout.tsx` — Montserrat + Cormorant Garamond font loading confirmed
- Direct code inspection: `frontend/src/components/ui/` — available components inventory (separator, card, sheet, tabs) confirmed
- Direct code inspection: `frontend/src/components/landing/navbar.tsx` — NavBar is client component, reusable as-is
- MDN Web Docs: `IntersectionObserver` — universal browser support (97%+), non-blocking scroll detection

### Secondary (MEDIUM confidence)

- Next.js App Router docs: `export const metadata` for per-page SEO metadata — standard pattern since Next.js 13
- CA SB-1001 (2019): Bot disclosure law requiring AI agents to identify as automated on request — relevant for Terms AI section

### Tertiary (LOW confidence)

- None — all findings verified against actual codebase or well-established web APIs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; confirmed by direct file inspection
- Architecture patterns: HIGH — Next.js App Router patterns confirmed; IntersectionObserver is mature API
- Pitfalls: HIGH — identified from direct code reading (missing Link import, CardFooter structure, nav height offset)
- Legal content structure: MEDIUM — sections are standard for this type of SaaS + AI telephony product; not reviewed by attorney

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain — legal page layouts do not change rapidly)
