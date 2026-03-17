# Phase 10: Add Privacy Policy and Terms and Conditions Pages - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning
**Source:** Interactive discussion

<domain>
## Phase Boundary

Add Privacy Policy and Terms of Service pages to the murphy.help frontend. Static legal content pages with proper navigation links from footer and auth pages. No new capabilities — just legal compliance pages integrated into the existing Next.js site.

</domain>

<decisions>
## Implementation Decisions

### Content Source
- Claude drafts comprehensive legal content based on actual tech stack and services
- Include disclaimer: "This document was generated for informational purposes. Consult an attorney for legal advice."
- Entity name: Cardinal Conseils
- Contact email for privacy/legal inquiries: info@cardinalconseils.com

### Legal Scope
- Privacy Policy covers: CCPA (California), CAN-SPAM, TCPA (telephony), PIPEDA (Canada)
- All third-party services disclosed: Telnyx (voice/SMS), Supabase (database/auth), Google Places API (provider search), OpenRouter/Anthropic (AI processing), BuyMeACoffee (tips), Vercel (hosting)
- Terms of Service includes prominent AI disclosure section — Murphy is an AI agent making automated calls on user's behalf, CA SB-1001 compliance, consistent with Phase 4 verbal AI disclosure

### Page Design & Layout
- Clean single-page scroll with sticky table of contents sidebar on desktop, collapsible on mobile
- Matches existing dark modern theme (Montserrat + Cormorant Garamond, dark backgrounds, accent colors)
- Full navbar and footer on both pages (same chrome as landing page)
- "Last updated" date displayed prominently at top of each page

### URL Structure
- Privacy Policy at `/privacy`
- Terms of Service at `/terms`

### Footer & Navigation Integration
- Footer: add "Privacy Policy | Terms of Service" links inline in the copyright row at the bottom
- Auth pages (login/signup): add "By signing up, you agree to our Terms and Privacy Policy" text below forms with links

### Claude's Discretion
- Exact legal content wording and section ordering
- Table of contents implementation (scroll-spy, anchor links, etc.)
- Mobile ToC collapse behavior
- Typography hierarchy within legal content sections

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend Structure
- `frontend/src/components/landing/footer.tsx` — Footer component to modify (add legal links to copyright row)
- `frontend/src/components/landing/navbar.tsx` — Navbar component (reuse on legal pages)
- `frontend/src/app/layout.tsx` — Root layout with fonts and theme provider
- `frontend/src/app/(auth)/login/page.tsx` — Login page (add Terms/Privacy agreement text)
- `frontend/src/app/(auth)/signup/page.tsx` — Signup page (add Terms/Privacy agreement text)

### Design System
- `frontend/src/app/globals.css` — Global styles and CSS variables
- `frontend/src/components/ui/` — shadcn/ui components available for reuse

### Phase 9 Context
- `.planning/phases/09-frontend-website/09-CONTEXT.md` — Visual design decisions, framework choices, established patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `footer.tsx`: Footer component with 3-column grid + copyright row — legal links add to copyright row
- `navbar.tsx`: Navbar component — reuse as-is on legal pages
- shadcn/ui components: Card, Separator, Tabs, ScrollArea available for ToC/layout
- Tailwind CSS with dark theme variables already configured

### Established Patterns
- Next.js App Router with route groups: `(auth)`, `(dashboard)` — legal pages can be top-level routes
- Dark theme with `bg-background`, `text-foreground`, `text-muted-foreground` classes
- Fonts: Montserrat (body) and Cormorant Garamond (headings)
- Component co-location: components in `src/components/` grouped by domain

### Integration Points
- Footer copyright div (`border-t border-border pt-6`) — add legal links alongside copyright text
- Auth layout (`(auth)/layout.tsx`) — add legal agreement text to auth forms
- App Router: create `frontend/src/app/privacy/page.tsx` and `frontend/src/app/terms/page.tsx`

</code_context>

<specifics>
## Specific Ideas

- Entity operating the service is "Cardinal Conseils" (not Murphy or OpenClaw)
- Contact email: info@cardinalconseils.com
- AI disclosure in Terms should reference CA SB-1001 specifically — aligns with Phase 4's verbal AI identity requirement on outbound calls
- TCPA section should reference the verbal consent capture designed in Phase 2

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-add-privacy-policy-and-terms-and-conditions-pages*
*Context gathered: 2026-03-17 via interactive discussion*
