# Roadmap: OpenClaw — Service Matchmaker

## Overview

OpenClaw is built on a hard dependency chain: every phase is a prerequisite for the next. Infrastructure must be provisioned before any telephony testing can happen. Voice conversation must work before provider search is wired in. Provider search must be correct before outbound calls are made. Outbound calling must be stable before live transfer is wired. Post-call SMS depends on call outcomes. The dashboard reads from call records written by SMS phase. Phases 1-6 are the indivisible critical path delivering the core loop; Phase 7 is an independent read-only layer that can be built once the data schema is stable.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure Foundation** - Provision and configure Vercel Sandbox, Telnyx number, device pairing, keep-alive, and 10DLC registration (completed 2026-03-14)
- [x] **Phase 1.1: OpenClaw Agent Setup** - Install and configure OpenClaw framework, define agent persona, wire LLM provider, create tool registry, verify agent responds via gateway (INSERTED, completed 2026-03-15)
- [x] **Phase 2: Voice Conversation Core** - Answer inbound calls, capture user intent from natural speech, maintain clean conversational state (completed 2026-03-16)
- [x] **Phase 3: Provider Discovery** - Search Google Places and ranked provider sources, narrate results to user (completed 2026-03-16)
- [x] **Phase 4: Outbound Provider Calling** - Dial providers sequentially with live user narration, handle voicemail and busy signals, cascade through ranked list (completed 2026-03-16)
- [x] **Phase 5: Live Call Transfer** - Warm-transfer user to confirmed-available provider via conference bridge, exit cleanly, handle transfer failures (completed 2026-03-21)
- [x] **Phase 6: Post-Call SMS** - Send SMS recap with outcome, provider info, and tip link; persist call record (completed 2026-03-21)
- [ ] **Phase 7: Web Dashboard** - Serve read-only call history by phone number from Vercel Sandbox
- [x] **Phase 8: Telnyx Missions** - Create and execute batch missions (multi-call campaigns, SMS surveys, provider research) via natural language through any connected channel (completed 2026-03-16)
- [x] **Phase 9: Frontend Website** - Next.js SaaS frontend with dark modern landing page, Supabase Auth, authenticated dashboard (call history, missions, analytics), settings, and billing (completed 2026-03-18)
- [x] **Phase 10: Privacy & Terms Pages** - Privacy Policy and Terms of Service pages with legal compliance content (completed 2026-03-19)
- [x] **Phase 11: Fix Murphy Phone Routing** - Forward +18888306873 → ClawdTalk +18885440160, fix SMS delivery via ClawdTalk sessions_send (completed 2026-03-20)

## Phase Details

### Phase 1: Infrastructure Foundation
**Goal**: Vercel Sandbox is running with the OpenClaw gateway pre-paired and auto-starting, Telnyx number is provisioned and carrier-registered, webhook URL is publicly reachable, keep-alive loop prevents timeout from killing active calls, and 10DLC SMS registration is initiated
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. A test call to the Telnyx number connects to the OpenClaw gateway and receives an answer response without a "pairing required" error
  2. The sandbox stays alive through a 15-minute idle period without the gateway dropping (keep-alive loop working)
  3. Telnyx webhooks reach the Express server at a public HTTPS URL after sandbox restart without manual URL updates
  4. 10DLC brand and campaign registration has been submitted to TCR and an application reference number exists
  5. The outbound Telnyx number passes Free Caller Registry and CNAM registration checks
**Plans:** 4/4 complete

Plans:
- [x] 01-01-PLAN.md — Test infra, Telnyx types/client, device pre-pairing (INFRA-03)
- [x] 01-02-PLAN.md — Gateway manager, keep-alive, Express webhook server (INFRA-01, INFRA-02, INFRA-04)
- [x] 01-03-PLAN.md — Webhook URL updater, 10DLC registration, startup script (INFRA-02, INFRA-05)
- [x] 01-04-PLAN.md — Gap closure: wire server.ts CLI entrypoint, GatewayManager, and keep-alive into runtime (INFRA-01, INFRA-02, INFRA-04)

### Phase 1.1: OpenClaw Agent Setup (INSERTED)

**Goal:** Install and configure the OpenClaw agent framework, define agent persona (Murphy) and system prompt, wire LLM providers (OpenRouter + Anthropic tiered), create tool registry skeleton, and verify the agent responds to a basic prompt via the gateway and to a simulated webhook event
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05
**Depends on:** Phase 1
**Plans:** 3/3 complete

Plans:
- [x] 01.1-01-PLAN.md — LLM clients (OpenRouter + Anthropic), Murphy system prompt, tiered orchestrator (AGENT-01, AGENT-02, AGENT-03)
- [x] 01.1-02-PLAN.md — Tool registry skeleton with 4 stub handlers (AGENT-04)
- [x] 01.1-03-PLAN.md — OpenClaw config generator, workspace persona files, webhook integration test, human verification (AGENT-05)

### Phase 2: Voice Conversation Core
**Goal**: An inbound call is answered with a greeting, user speech is captured and transcribed, service intent (type and location) is extracted within two turns, clarifying questions are asked when intent is ambiguous, and responses use streaming TTS with filler speech to avoid dead air
**Depends on**: Phase 1.1
**Requirements**: VOICE-01, VOICE-02, VOICE-03, VOICE-04, VOICE-05
**Success Criteria** (what must be TRUE):
  1. User calls the number and hears a greeting within 2 seconds of the call connecting
  2. User can say "I need a plumber in Austin" in a single utterance and the agent confirms it understood the service type and location without asking the user to repeat themselves
  3. User says something ambiguous ("I need help with my house") and the agent asks one focused clarifying question to extract service type
  4. Agent responses feel immediate — no perceptible silence between user speaking and agent responding (streaming TTS)
  5. Agent speaks a brief filler phrase ("Let me look that up for you") when running a search, so the line never goes silent during tool calls
**Plans:** 3/3 complete

Plans:
- [x] 02-01-PLAN.md — Call state, greeting constants, filler phrases with TDD tests (VOICE-01, VOICE-03, VOICE-05)
- [x] 02-02-PLAN.md — Murphy prompt bilingual update, intent extractor module (VOICE-02, VOICE-03)
- [x] 02-03-PLAN.md — Webhook lifecycle handler, voice config, env setup, human verification (VOICE-01, VOICE-02, VOICE-04, VOICE-05)

### Phase 3: Provider Discovery
**Goal**: Given extracted service type and location, the agent searches Google Places, web, and a custom directory for providers, ranks them by ratings/reviews/proximity/urgency, and narrates a transparent verbal summary to the user before proceeding
**Depends on**: Phase 2
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, SRCH-06
**Success Criteria** (what must be TRUE):
  1. Agent finds and returns a ranked list of providers for any service type and location a user names, using Google Places as primary source
  2. When Google Places returns fewer than 3 results, agent falls back to web search and returns results from that source
  3. Agent narrates its findings aloud: "I found 6 plumbers near downtown Austin. The top-rated one is Acme Plumbing with 4.8 stars — calling them now"
  4. When user says "it's urgent" or "emergency," agent re-ranks for same-day and emergency-available providers ahead of higher-rated ones that are closed
  5. Agent produces a ranked provider list with phone numbers that feeds directly into Phase 4 outbound calling without manual intervention
**Plans:** 3/3 complete

Plans:
- [x] 03-01-PLAN.md — Google Places search, geocoding, haversine distance, ranking algorithm, CallState update (SRCH-01, SRCH-03, SRCH-04, SRCH-05)
- [x] 03-02-PLAN.md — Bilingual narration builder functions (SRCH-06)
- [x] 03-03-PLAN.md — OpenRouter web search fallback, webhook wiring for search+narration flow (SRCH-02, SRCH-06)

### Phase 4: Outbound Provider Calling
**Goal**: Agent dials providers sequentially from the ranked list, announces itself as an AI on each outbound call, gives the user live verbal status updates every 15-20 seconds, handles voicemail and no-answers automatically, sends SMS pre-notification to providers, and cascades through up to four providers before declaring no match
**Depends on**: Phase 3
**Requirements**: CALL-01, CALL-02, CALL-03, CALL-04, CALL-05, CALL-06, CALL-07
**Success Criteria** (what must be TRUE):
  1. User hears "Calling Acme Plumbing now" when the agent dials, then receives a verbal update within 20 seconds regardless of what happens on the provider leg
  2. A provider who answers hears the agent identify itself as an AI concierge before any other information is communicated
  3. When a provider's line goes to voicemail, agent detects this and automatically moves to the next provider — user hears "They weren't available, trying the next one"
  4. Agent confirms with the provider that they are available for the specific job before declaring a match
  5. After four providers have been tried without a live connection, agent stops dialing and tells the user it has exhausted its list
**Plans:** 2/2 complete

Plans:
- [x] 04-01-PLAN.md — Outbound-caller module with cascade loop, AMD, narration timer, SMS pre-notification, availability parsing (CALL-01, CALL-02, CALL-03, CALL-04, CALL-05, CALL-06, CALL-07)
- [x] 04-02-PLAN.md — Webhook wiring for outbound events, dispatch.ts real implementation (CALL-01, CALL-02, CALL-03, CALL-05, CALL-06, CALL-07)

### Phase 5: Live Call Transfer
**Goal**: Agent bridges user live to confirmed-available provider via three-way conference, briefs the provider before merging, exits the call cleanly while both parties remain connected, and handles bridge failures by cascading to the next provider
**Depends on**: Phase 4
**Requirements**: XFER-01, XFER-02, XFER-03, XFER-04
**Success Criteria** (what must be TRUE):
  1. User is connected to a live provider in a single call — no hold music, no IVR, no callback required
  2. Provider hears the agent brief them ("I have a customer named John who needs a plumber in Austin — connecting you now") before being merged with the user
  3. After the bridge is established, the agent exits the call and both user and provider remain connected talking to each other
  4. If the provider leg drops during bridge attempt, user does not hear silence or a dead line — agent detects the failure, tells the user what happened, and attempts the next provider
**Plans:** 3/3 plans complete

Plans:
- [x] 05-01-PLAN.md — CallState extension, bridge primitives (bridgeToUser, TRANSFER_BRIEF), post-bridge hangup guard, dispatch.ts real transferCall (XFER-01, XFER-02, XFER-03, XFER-04)
- [x] 05-02-PLAN.md — Webhook wiring: availability->brief->bridge->bridged->cleanup lifecycle (XFER-01, XFER-02, XFER-03, XFER-04)
- [x] 05-03-PLAN.md — Gap closure: sync frontend mirror files with Phase 5 changes to fix tsc compilation (XFER-01, XFER-02, XFER-03, XFER-04) (completed 2026-03-21)

### Phase 6: Post-Call SMS
**Goal**: After every call ends, the user receives an SMS with who was contacted, what happened, who they were connected to, and a BuyMeACoffee tip link; failed searches get a graceful fallback SMS with provider contact info; all call data is persisted for the dashboard
**Depends on**: Phase 5
**Requirements**: POST-01, POST-02, POST-03, POST-04
**Success Criteria** (what must be TRUE):
  1. User receives an SMS recap within 30 seconds of the call ending, listing providers contacted and the outcome
  2. SMS includes a BuyMeACoffee tip link on every successful connection
  3. When no live transfer was achieved, user receives an SMS with the names and phone numbers of the providers that were tried, so they can follow up themselves
  4. A call record exists in the database after every call, capturing caller number, providers contacted, outcomes, and timestamps — this record is what the dashboard reads
**Plans:** 2/2 plans complete

Plans:
- [ ] 06-01-PLAN.md — TDD: recap-sms module with buildSuccessSms, buildFailureSms, sendRecapSms + tests (POST-01, POST-02, POST-03)
- [ ] 06-02-PLAN.md — Wire sendRecapSms into webhooks.ts call.hangup, add BUYMEACOFFEE_URL env var (POST-01, POST-02, POST-03, POST-04)

### Phase 7: Web Dashboard
**Goal**: A simple web page served from the Vercel Sandbox lets a user enter their phone number and see their call history — past searches, providers contacted, and outcomes
**Depends on**: Phase 6
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. User visits the dashboard URL, enters their phone number, and sees a list of past calls without any login or registration
  2. Each call record shows the date, service type searched, providers contacted with outcomes, and which provider they were connected to
  3. Dashboard is served directly from the Vercel Sandbox at a public HTTPS URL — no separate hosting or deployment needed
**Plans:** 2 plans

Plans:
- [ ] 07-01-PLAN.md — RLS migration, phone normalizer, API route with rate limiting (DASH-01, DASH-03)
- [ ] 07-02-PLAN.md — History page UI, expandable cards, navbar link, SMS history link (DASH-01, DASH-02, DASH-03)

### Phase 8: Telnyx Missions
**Goal**: Users can create multi-step missions via voice, SMS, or any connected chat channel. The agent plans the mission, creates a dedicated AI assistant, schedules and executes events (batch calls, SMS campaigns, provider research), and reports results — all trackable in real-time via the ClawdTalk portal
**Depends on**: Phase 6 (requires outbound calling + SMS), ClawdTalk integration
**Requirements**: MISSION-01, MISSION-02, MISSION-03, MISSION-04, MISSION-05, MISSION-06
**Success Criteria** (what must be TRUE):
  1. User says "Call the top 5 plumbers in Austin and get quotes" and the agent creates a mission plan, dials each provider sequentially, and captures results
  2. User says "Text all my leads and confirm their demo times" and the agent sends personalized SMS to each number with automatic throttling
  3. Mission progress is visible in the ClawdTalk portal in real-time (events scheduled, in-progress, completed)
  4. After mission completes, user receives a summary with all captured results and conversation insights
  5. Agent handles batch operations with rate limiting — no more than N concurrent calls or SMS per minute
**Plans:** 5/5 complete

Plans:
- [x] 08-01-PLAN.md — Mission types, Supabase client, rate limiter, DB repository, migration SQL (MISSION-06)
- [x] 08-02-PLAN.md — Mission planner (LLM decomposition) and lifecycle engine (MISSION-01, MISSION-02)
- [x] 08-03-PLAN.md — Mission scheduler (rate-limited queue) and tool handler registration (MISSION-03, MISSION-06)
- [x] 08-04-PLAN.md — Mission reporter (progress events, summaries) and orchestrator wiring (MISSION-04, MISSION-05)
- [x] 08-05-PLAN.md — Gap closure: wire initMissions() into server.ts startup sequence (MISSION-04, MISSION-05, MISSION-06)

### Phase 9: Frontend Website
**Goal**: A polished Next.js frontend at murphy.help with a dark, modern SaaS landing page explaining the service, Supabase Auth for user accounts, an authenticated dashboard showing call history/missions/analytics, and settings/billing pages — deployed to Vercel alongside the existing Express backend
**Depends on**: Phase 1 (backend running), Supabase configured
**Requirements**: WEB-01, WEB-02, WEB-03, WEB-04, WEB-05, WEB-06, WEB-07
**Success Criteria** (what must be TRUE):
  1. Visiting murphy.help shows a beautiful dark-themed landing page with hero, features, social proof, and a CTA to call the number
  2. User can sign up / log in via Supabase Auth (email + Google OAuth) and land on their personal dashboard
  3. Dashboard shows the user's call history with dates, service types, providers contacted, and outcomes — pulled from Supabase
  4. Dashboard shows active and completed missions with real-time status updates
  5. Settings page allows users to update profile, notification preferences, and manage their account
  6. The frontend and Express backend coexist on the same Vercel deployment without routing conflicts
  7. All pages are responsive and performant (Lighthouse score > 90)
**Plans:** 6/6 complete

Plans:
- [x] 09-00-PLAN.md — Wave 0: test scaffolds, vitest config, call_history migration (WEB-01, WEB-02, WEB-03, WEB-04, WEB-05)
- [x] 09-01-PLAN.md — Next.js scaffold, shadcn/ui + Tailwind v4 design system, vercel.json route splitting (WEB-06, WEB-07)
- [x] 09-02-PLAN.md — Landing page: hero, features, social proof, navbar, footer (WEB-01, WEB-07)
- [x] 09-03-PLAN.md — Supabase Auth: SSR clients, middleware, login/signup, OAuth callback (WEB-02)
- [x] 09-04-PLAN.md — Dashboard: call history, missions realtime, analytics charts (WEB-03, WEB-04)
- [x] 09-05-PLAN.md — Settings: profile form, notification prefs, account management (WEB-05)

### Phase 10: Add privacy policy and terms and conditions pages

**Goal:** Privacy Policy and Terms of Service pages at /privacy and /terms with comprehensive legal content covering CCPA, PIPEDA, TCPA, CAN-SPAM, and AI disclosure (CA SB-1001), integrated into the footer and login page navigation
**Requirements**: LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05, LEGAL-06
**Depends on:** Phase 9
**Plans:** 2/2 complete

Plans:
- [x] 10-01-PLAN.md — Legal page layout components, Privacy Policy page, Terms of Service page (LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04)
- [x] 10-02-PLAN.md — Footer legal links, login agreement text, tests, visual verification (LEGAL-05, LEGAL-06)

### Phase 11: Fix Murphy Phone Routing — ClawdTalk Integration

**Goal:** Route Canadian callers to Murphy through ClawdTalk by forwarding +18888306873 → +18885440160, and fix SMS delivery through the ClawdTalk path (sessions_send tool + gateway allowlist)
**Requirements**: FIX-01, FIX-02
**Depends on:** Phase 10
**Plans:** 1/1 plans complete

Plans:
- [ ] 11-01-PLAN.md — Telnyx call forwarding, ClawdTalk SMS allowlist, env var verification, webhook hardening (FIX-01, FIX-02)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 1.1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure Foundation | 4/4 | Complete | 2026-03-14 |
| 1.1. OpenClaw Agent Setup (INSERTED) | 3/3 | Complete | 2026-03-15 |
| 2. Voice Conversation Core | 3/3 | Complete | 2026-03-16 |
| 3. Provider Discovery | 3/3 | Complete | 2026-03-16 |
| 4. Outbound Provider Calling | 2/2 | Complete | 2026-03-16 |
| 5. Live Call Transfer | 3/3 | Complete   | 2026-03-21 |
| 6. Post-Call SMS | 2/2 | Complete   | 2026-03-21 |
| 7. Web Dashboard | 0/2 | Planning complete | - |
| 8. Telnyx Missions | 5/5 | Complete | 2026-03-16 |
| 9. Frontend Website | 6/6 | Complete | 2026-03-18 |
| 10. Privacy & Terms Pages | 2/2 | Complete | 2026-03-19 |
| 11. Fix Murphy Phone Routing | 1/1 | Complete   | 2026-03-20 |
