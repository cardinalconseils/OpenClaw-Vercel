# Phase 9: Frontend Website - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning
**Source:** Interactive discussion

<domain>
## Phase Boundary

Build a full SaaS frontend website at murphy.help using Next.js, deployed to Vercel alongside the existing Express backend. Includes landing page, Supabase Auth, authenticated dashboard, settings, and billing. Dark modern visual style.

</domain>

<decisions>
## Implementation Decisions

### Framework & Deployment
- Next.js as frontend framework (deploys natively to Vercel)
- Must coexist with existing Express backend on same Vercel deployment (route splitting via vercel.json)
- Express handles /webhooks/telnyx and /health; Next.js handles everything else

### Visual Design
- Dark + modern theme: dark backgrounds, accent colors, glassmorphism cards, subtle animations
- Tech-forward SaaS aesthetic (not generic Bootstrap)
- Responsive design, Lighthouse > 90
- No specific brand guidelines exist yet — establish them in this phase

### Authentication
- Supabase Auth with email + Google OAuth
- User accounts tied to phone number for call history lookup

### Landing Page
- Hero section with value proposition ("One call replaces five")
- Features section explaining how OpenClaw works (call → AI finds → connects)
- Social proof / testimonials section
- CTA to call +1-888-830-6873
- BuyMeACoffee tip integration

### Dashboard (Authenticated)
- Call history: dates, service types, providers contacted, outcomes
- Missions: active/completed missions with real-time status
- Analytics: call counts, success rates, common service types

### Settings & Account
- Profile management (name, phone, email)
- Notification preferences
- Account management (delete, export data)

### Claude's Discretion
- Component library choice (shadcn/ui, Radix, etc.)
- State management approach
- CSS framework (Tailwind CSS recommended)
- Dashboard chart library
- Real-time subscription approach for mission updates
- Folder structure within Next.js app

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend API
- `src/server.ts` — Express server entry point, route definitions
- `src/api/webhooks.ts` — Webhook handler (don't conflict with routing)
- `vercel.json` — Current Vercel config (must update for Next.js + Express coexistence)

### Data Layer
- `src/lib/db/supabase-client.ts` — Existing Supabase client setup
- `src/lib/voice/call-state.ts` — CallState type definition (what dashboard displays)
- `src/types/mission.ts` — Mission type definitions

### Deployment
- `.vercel/project.json` — Vercel project configuration
- `package.json` — Current dependencies and build scripts

</canonical_refs>

<specifics>
## Specific Ideas

- The phone number to display prominently: +1-888-830-6873
- Domain: murphy.help (already configured)
- BuyMeACoffee username from env: BUYMEACOFFEE_USERNAME
- The agent persona is named "Murphy" — use this in copy
- Supabase is already configured (SUPABASE_URL, keys in .env)

</specifics>

<deferred>
## Deferred Ideas

- Billing/payment processing (v2)
- Provider-facing portal
- Mobile app
- Multi-language frontend (French)

</deferred>

---

*Phase: 09-frontend-website*
*Context gathered: 2026-03-16 via interactive discussion*
