# Roadmap: OpenClaw — Service Matchmaker

## Overview

OpenClaw is built on a hard dependency chain: every phase is a prerequisite for the next. Infrastructure must be provisioned before any telephony testing can happen. Voice conversation must work before provider search is wired in. Provider search must be correct before outbound calls are made. Outbound calling must be stable before live transfer is wired. Post-call SMS depends on call outcomes. The dashboard reads from call records written by SMS phase. Phases 1-6 are the indivisible critical path delivering the core loop; Phase 7 is an independent read-only layer that can be built once the data schema is stable.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure Foundation** - Provision and configure Vercel Sandbox, Telnyx number, device pairing, keep-alive, and 10DLC registration (completed 2026-03-14)
- [ ] **Phase 1.1: OpenClaw Agent Setup** - Install and configure OpenClaw framework, define agent persona, wire LLM provider, create tool registry, verify agent responds via gateway (INSERTED)
- [ ] **Phase 2: Voice Conversation Core** - Answer inbound calls, capture user intent from natural speech, maintain clean conversational state
- [ ] **Phase 3: Provider Discovery** - Search Google Places and ranked provider sources, narrate results to user
- [ ] **Phase 4: Outbound Provider Calling** - Dial providers sequentially with live user narration, handle voicemail and busy signals, cascade through ranked list
- [ ] **Phase 5: Live Call Transfer** - Warm-transfer user to confirmed-available provider via conference bridge, exit cleanly, handle transfer failures
- [ ] **Phase 6: Post-Call SMS** - Send SMS recap with outcome, provider info, and tip link; persist call record
- [ ] **Phase 7: Web Dashboard** - Serve read-only call history by phone number from Vercel Sandbox

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
**Plans:** 4 plans (3 complete, 1 gap closure)

Plans:
- [x] 01-01-PLAN.md — Test infra, Telnyx types/client, device pre-pairing (INFRA-03)
- [x] 01-02-PLAN.md — Gateway manager, keep-alive, Express webhook server (INFRA-01, INFRA-02, INFRA-04)
- [x] 01-03-PLAN.md — Webhook URL updater, 10DLC registration, startup script (INFRA-02, INFRA-05)
- [ ] 01-04-PLAN.md — Gap closure: wire server.ts CLI entrypoint, GatewayManager, and keep-alive into runtime (INFRA-01, INFRA-02, INFRA-04)

### Phase 1.1: OpenClaw Agent Setup (INSERTED)

**Goal:** Install and configure the OpenClaw agent framework, define agent persona and system prompt, wire LLM provider, create tool registry skeleton, and verify the agent responds to a basic prompt via the gateway
**Requirements**: TBD
**Depends on:** Phase 1
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 01.1 to break down)

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
**Plans**: TBD

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
**Plans**: TBD

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
**Plans**: TBD

### Phase 5: Live Call Transfer
**Goal**: Agent bridges user live to confirmed-available provider via three-way conference, briefs the provider before merging, exits the call cleanly while both parties remain connected, and handles bridge failures by cascading to the next provider
**Depends on**: Phase 4
**Requirements**: XFER-01, XFER-02, XFER-03, XFER-04
**Success Criteria** (what must be TRUE):
  1. User is connected to a live provider in a single call — no hold music, no IVR, no callback required
  2. Provider hears the agent brief them ("I have a customer named John who needs a plumber in Austin — connecting you now") before being merged with the user
  3. After the bridge is established, the agent exits the call and both user and provider remain connected talking to each other
  4. If the provider leg drops during bridge attempt, user does not hear silence or a dead line — agent detects the failure, tells the user what happened, and attempts the next provider
**Plans**: TBD

### Phase 6: Post-Call SMS
**Goal**: After every call ends, the user receives an SMS with who was contacted, what happened, who they were connected to, and a BuyMeACoffee tip link; failed searches get a graceful fallback SMS with provider contact info; all call data is persisted for the dashboard
**Depends on**: Phase 5
**Requirements**: POST-01, POST-02, POST-03, POST-04
**Success Criteria** (what must be TRUE):
  1. User receives an SMS recap within 30 seconds of the call ending, listing providers contacted and the outcome
  2. SMS includes a BuyMeACoffee tip link on every successful connection
  3. When no live transfer was achieved, user receives an SMS with the names and phone numbers of the providers that were tried, so they can follow up themselves
  4. A call record exists in the database after every call, capturing caller number, providers contacted, outcomes, and timestamps — this record is what the dashboard reads
**Plans**: TBD

### Phase 7: Web Dashboard
**Goal**: A simple web page served from the Vercel Sandbox lets a user enter their phone number and see their call history — past searches, providers contacted, and outcomes
**Depends on**: Phase 6
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. User visits the dashboard URL, enters their phone number, and sees a list of past calls without any login or registration
  2. Each call record shows the date, service type searched, providers contacted with outcomes, and which provider they were connected to
  3. Dashboard is served directly from the Vercel Sandbox at a public HTTPS URL — no separate hosting or deployment needed
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 1.1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure Foundation | 3/4 | Gap closure | 2026-03-14 |
| 1.1. OpenClaw Agent Setup (INSERTED) | 0/TBD | Not started | - |
| 2. Voice Conversation Core | 0/TBD | Not started | - |
| 3. Provider Discovery | 0/TBD | Not started | - |
| 4. Outbound Provider Calling | 0/TBD | Not started | - |
| 5. Live Call Transfer | 0/TBD | Not started | - |
| 6. Post-Call SMS | 0/TBD | Not started | - |
| 7. Web Dashboard | 0/TBD | Not started | - |
