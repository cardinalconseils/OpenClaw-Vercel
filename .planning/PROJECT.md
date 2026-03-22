# OpenClaw — Service Matchmaker

## What This Is

An AI-powered phone concierge that finds and connects callers with local service providers. Users call a phone number, describe what they need (plumber, electrician, etc.), and the agent searches for providers, calls them to check availability, then live-transfers the user to the best match via a warm bridge. Built on the OpenClaw framework with Telnyx Call Control v2 for telephony.

## Core Value

Eliminate the tedious multi-call search for local service providers — one phone call to the agent replaces five calls to providers.

## Requirements

### Validated

- ✓ User calls a Telnyx phone number and speaks to the AI agent — v1.0
- ✓ Agent understands the user's service request (what they need, where, when) — v1.0
- ✓ Agent searches Google Maps/Places API for matching providers — v1.0
- ✓ Agent searches the web for additional providers — v1.0
- ✓ Agent ranks providers by criteria (ratings, reviews, proximity, availability) — v1.0
- ✓ Agent calls providers starting from the best match — v1.0
- ✓ User stays on the line with live verbal updates while agent calls providers — v1.0
- ✓ Agent confirms provider availability before connecting — v1.0
- ✓ Agent performs live call transfer (warm bridge to provider) — v1.0
- ✓ Telnyx Missions for batch operations (multi-call campaigns, SMS surveys) — v1.0
- ✓ Next.js frontend at murphy.help with auth and legal pages — v1.0
- ✓ Admin RBAC with /admin proxy to OpenClaw Control UI — v1.0

### Active

- [ ] Agent sends SMS recap after the call (providers contacted, outcomes, who was connected)
- [ ] Agent sends BuyMeACoffee tip link via SMS after the call
- [ ] Public /history page for call history lookup by phone number
- [ ] sessions_send allowlist in ClawdTalk gateway config

### Out of Scope

- Mobile app — web + phone/SMS is sufficient
- Payment processing beyond BuyMeACoffee tips
- Provider-side dashboard or portal
- Scheduling/booking on behalf of the user — agent connects, user handles the rest
- Custom provider directory — Google Places coverage is sufficient for v1
- Proactive monitoring — deferred to v2

## Context

- **Platform:** OpenClaw AI agent framework with Murphy persona
- **Voice/SMS:** Telnyx Call Control v2 via ClawdTalk (+18885440160) and direct webhook (+18888306873)
- **Frontend:** Next.js 15 at murphy.help, Supabase Auth, Tailwind CSS 4
- **Deployment:** Vercel (frontend + Express backend coexisting)
- **Search:** Google Places Text Search (New) API with geocoding, haversine distance, urgency re-ranking
- **Database:** Supabase PostgreSQL (call_history, missions tables)
- **Monetization:** BuyMeACoffee tip link (planned for SMS recap)
- **Codebase:** 11,439 LOC TypeScript, 209 tests passing

## Constraints

- **Voice:** Telnyx Call Control v2 for telephony (STT, TTS, bridge, AMD)
- **Bridge:** Telnyx `calls.actions.bridge` connects two call-control legs
- **SMS:** Telnyx messages.send for provider pre-notification; caller recap is stub
- **Provider data:** Google Maps/Places API rate limits and costs apply
- **Admin:** app_metadata.role via Supabase Admin API (not user-writable)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Telnyx over Twilio | Aligns with OpenClaw/ClawdTalk ecosystem | ✓ Good — Call Control v2 works well |
| Vercel deployment (not Railway) | Phase 12 planned Railway migration, reverted to Vercel for simplicity | ✓ Good — standalone build + custom server |
| BuyMeACoffee for tips | Simple, no payment integration needed | — Pending (not yet in SMS) |
| Live narration over hold music | Better UX — user knows what's happening | ✓ Good — 17s narration timer |
| Google Places as primary search | Best coverage for local services | ✓ Good — with web search fallback |
| app_metadata for admin RBAC | user_metadata is user-writable — security risk | ✓ Good — fixed from user_metadata in PR #15 |
| Zod at serialization boundary | Eliminates unsafe `as` casts on client_state | ✓ Good — ProviderDialClientState schema |
| Warm bridge (not cold transfer) | Provider hears brief before connecting to caller | ✓ Good — TRANSFER_BRIEF spoken first |

---
*Last updated: 2026-03-22 after v1.0 milestone*
