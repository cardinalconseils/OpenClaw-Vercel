# OpenClaw — Service Matchmaker

## What This Is

An AI-powered phone concierge that finds and connects callers with local service providers. Users call a phone number, describe what they need (plumber, electrician, etc.), and the agent searches for providers, calls them to check availability, then live-transfers the user to the best match. After the call, it sends an SMS recap with a BuyMeACoffee tip link.

## Core Value

Eliminate the tedious multi-call search for local service providers — one phone call to the agent replaces five calls to providers.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User calls a Telnyx phone number and speaks to the AI agent
- [ ] Agent understands the user's service request (what they need, where, when)
- [ ] Agent searches Google Maps/Places API for matching providers
- [ ] Agent searches the web for additional providers
- [ ] Agent can query a custom provider directory
- [ ] Agent ranks providers by criteria (ratings, reviews, proximity, availability)
- [ ] Agent calls providers starting from the best match
- [ ] User stays on the line with live verbal updates while agent calls providers
- [ ] Agent confirms provider availability before connecting
- [ ] Agent performs live call transfer (patches user through to provider)
- [ ] Agent sends SMS recap after the call (providers contacted, outcomes, who was connected)
- [ ] Agent sends BuyMeACoffee tip link via SMS after the call
- [ ] User can view call history on a web dashboard
- [ ] Agent can proactively monitor for needs and suggest providers

### Out of Scope

- Mobile app — web dashboard + phone/SMS is sufficient for v1
- Payment processing beyond BuyMeACoffee tips
- Provider-side dashboard or portal
- Multi-language support — English only for v1
- Scheduling/booking on behalf of the user — agent connects, user handles the rest

## Context

- **Platform:** OpenClaw AI agent framework deployed on Vercel Sandbox
- **Voice/SMS:** Telnyx Call Control v2 via ClawdTalk or OpenClaw voice-call plugin
- **Deployment:** Vercel Sandbox (isolated Linux MicroVM, port 18789, HTTPS)
- **Search:** Google Maps/Places API for business listings + web search for supplementary results
- **Monetization:** BuyMeACoffee tip link sent via SMS after successful connections
- **Location:** Works for any location the user specifies (not geo-restricted)

## Constraints

- **Voice infrastructure:** Telnyx for telephony (Call Control v2, STT, TTS)
- **Deployment:** Vercel Sandbox with 2GB+ memory, port 18789
- **OpenClaw gateway:** Listens on ws://127.0.0.1:18789, requires device pairing
- **Call transfer:** Depends on Telnyx Call Control API supporting conference/transfer legs
- **Provider data:** Google Maps/Places API rate limits and costs apply

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Telnyx over Twilio | Aligns with OpenClaw ecosystem (ClawdTalk), Call Control v2 | — Pending |
| Vercel Sandbox deployment | Isolated MicroVM, HTTPS ports, snapshot support | — Pending |
| BuyMeACoffee for tips | Simple, no payment integration needed, low friction | — Pending |
| Live updates over hold music | Better UX — user knows what's happening in real-time | — Pending |
| Google Maps as primary search | Best coverage for local service providers with ratings/reviews | — Pending |

---
*Last updated: 2026-03-21 — Phase 05 (live-call-transfer) complete: warm bridge transfer via Telnyx Call Control, provider briefing, clean exit, failure cascade*
