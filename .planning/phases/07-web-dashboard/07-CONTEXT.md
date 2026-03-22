# Phase 7: Web Dashboard - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

A public web page at `/history` where users enter their phone number and see their call history — past searches, providers contacted, and outcomes. No authentication required. Served from the existing Next.js frontend.

</domain>

<decisions>
## Implementation Decisions

### Access model
- Phone number lookup only — no login, no registration, no SMS verification
- User enters phone number, hits "Look Up", sees their calls
- Zero friction — consistent with the "just call, no signup" product philosophy
- Next.js API route queries Supabase `call_history` table by `caller_phone`
- Rate limiting: Claude's discretion (prevent scraping, reasonable limits per IP)

### Where it lives
- Route: `/history` (Next.js page in the frontend)
- Add "History" link to the landing page navbar (next to Sign In)
- Include `murphy.help/history` link in the post-call SMS recap
- Same dark theme as the rest of the site — uses existing shadcn/ui + Tailwind v4 design system

### Call record display
- Card list layout — one card per call, stacked vertically, newest first
- Each card shows: date, service type, location, outcome status (connected/no match/abandoned)
- Cards are expandable — click to reveal full provider list with individual outcomes
- Provider names and outcomes shown in expanded view — NO phone numbers (privacy/scraping on unauthenticated page)
- No sort controls — newest first is the only order
- All call statuses shown including abandoned calls (transparent history)

### Claude's Discretion
- Rate limiting implementation (server-side vs client-side, thresholds)
- Phone number input validation and formatting (E.164 normalization, flexible input acceptance)
- Pagination strategy (likely load-all given low expected volume, or simple pagination)
- Loading skeleton design
- Error state handling (API failures, Supabase connectivity)
- Exact card styling, spacing, typography within the dark theme

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data layer
- `src/lib/db/call-history-repo.ts` — CallHistoryRecord type definition, insertCallHistory function, Supabase table schema
- `src/lib/db/supabase-client.ts` — Lazy-singleton Supabase client pattern

### SMS integration
- `src/api/webhooks.ts` — Where sendRecapSms is called during call.hangup; the SMS template needs the /history link added

### Frontend patterns
- `frontend/src/components/landing/navbar.tsx` — Current navbar (needs "History" link added)
- `frontend/src/components/landing/footer.tsx` — Footer with legal links (reference for styling)
- `frontend/src/app/page.tsx` — Landing page (reference for dark theme, layout patterns)
- `frontend/src/app/privacy/page.tsx` — Legal page (reference for public page patterns outside auth)
- `frontend/src/lib/supabase/server.ts` — Server-side Supabase client for Next.js

### Supabase schema
- `frontend/supabase/` — Migration files, RLS policies for call_history table

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `call-history-repo.ts`: CallHistoryRecord type with all fields needed for display (service_type, location, providers_contacted array, connected_provider, status, timestamps)
- shadcn/ui components: Card, Button, Input already available in the frontend design system
- Dark theme CSS variables already configured in globals.css
- Navbar component: just needs a new Link added to navLinks array

### Established Patterns
- Public pages (privacy, terms) use server components with no auth check — same pattern for /history
- Legal pages use LegalPageLayout wrapper — /history needs its own simple layout
- Frontend types duplicated from backend (frontend/src/lib/types.ts) — no cross-package imports
- getUser() for auth (not getSession()) — but this page doesn't need auth at all

### Integration Points
- Next.js API route at `/api/call-history` to query Supabase by phone number
- Navbar `navLinks` array in navbar.tsx — add { href: '/history', label: 'History' }
- SMS recap template in webhooks.ts — append murphy.help/history link
- Supabase RLS: needs a policy allowing anonymous/unauthenticated SELECT on call_history filtered by caller_phone

</code_context>

<specifics>
## Specific Ideas

- Empty state CTA: "No calls found for this number yet. Need a service provider? Call Murphy: +1 (888) 830-6873" with tap-to-call link
- Card expanded view shows provider outcomes like: "Acme Plumbing (connected)", "Bob's Pipes (voicemail)", "Quick Fix (busy)"
- Status indicators: checkmark for connected, X for no match, dash for abandoned

</specifics>

<deferred>
## Deferred Ideas

- Authenticated user dashboard with saved history, notifications — future monetization phase
- Search/filtering within call history — separate enhancement
- Provider phone numbers in expanded cards — revisit when auth is required

</deferred>

---

*Phase: 07-web-dashboard*
*Context gathered: 2026-03-22*
