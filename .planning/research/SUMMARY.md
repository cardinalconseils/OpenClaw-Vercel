# Project Research Summary

**Project:** OpenClaw — AI Phone Concierge / Service Matchmaker
**Domain:** Voice AI telephony agent / local service provider matchmaker
**Researched:** 2026-03-14
**Confidence:** MEDIUM-HIGH

## Executive Summary

OpenClaw is a stateful, event-driven voice orchestration system that receives inbound phone calls, extracts service intent from natural speech, searches Google Places for ranked local providers, calls providers sequentially while keeping the user on a warm hold, then bridges the user live to the first confirmed-available provider. The product fills a genuine gap: no consumer-facing product today performs the full loop (intent capture → outbound calling → live transfer) via a single phone call with no app and no registration required. The recommended implementation approach is the OpenClaw gateway running as a persistent daemon inside Vercel Sandbox, with Telnyx Call Control v2 handling all telephony, and a conference bridge pattern for live transfer (not blind transfer or SIP REFER).

The critical architectural insight is that the core value chain is indivisible: a break at any point in the sequence (inbound call → intent extraction → provider search → outbound dialing → live bridge) produces zero user value. This means the entire happy-path loop must be built and validated end-to-end before any ancillary features (dashboard, AMD tuning, urgency detection) are worth implementing. The build order is strictly layered: telephony foundation → voice conversation core → provider discovery → outbound calling → live transfer → post-call SMS → dashboard.

The top risks are infrastructure-level, not product-level. OpenClaw device pairing fails silently inside Vercel Sandbox (must be pre-wired before gateway starts), Vercel Sandbox timeouts will kill active calls without a keep-alive loop, outbound numbers will be flagged as spam without carrier registration, and SMS will be silently blocked without 10DLC registration. All four of these must be addressed in Phase 1 before any real telephony testing begins. The conference bridge pattern for live transfer is the highest-complexity implementation task and must be built to a strict state machine to prevent the user from being dropped mid-transfer.

---

## Key Findings

### Recommended Stack

The stack is constrained by the project's deployment target (Vercel Sandbox as a persistent MicroVM, not serverless functions) and telephony provider (Telnyx). All major technology choices flow from this. The OpenClaw gateway runs on port 18789 as the long-lived process. An Express v5 webhook server runs co-located to receive Telnyx Call Control events. SQLite via better-sqlite3 and drizzle-orm handles session-scoped call history. Google Places API (New) via `@googlemaps/places` 2.3.0 provides provider search. Node.js 20 LTS is required by the Telnyx SDK v6.

The live transfer mechanism is the most consequential stack decision: use Telnyx conference bridge (three-way), not `transfer-call` API or SIP REFER. Blind transfer and SIP REFER drop the user before confirming provider availability. The conference pattern lets the agent remain on the call, confirm the provider, speak to both parties, then exit while both legs remain connected.

**Core technologies:**
- **OpenClaw gateway (latest 2026.2.17+):** AI agent runtime, tool orchestration, plugin architecture — project constraint; runs as persistent daemon on port 18789
- **Telnyx Call Control v2 + `telnyx` npm v6.13.0:** All telephony (inbound/outbound calls, STT, TTS, SMS, bridge, conference) — official SDK with full TypeScript coverage; Node >=20 required
- **Node.js 20 LTS + TypeScript 5.9.3:** Runtime and type safety — EOL versions break Telnyx SDK; strict types prevent mishandled call state
- **`@googlemaps/places` 2.3.0 (Places API New):** Provider search with phone numbers, ratings, hours — use only this, not legacy `@google/maps`; bill per field with explicit field masks
- **better-sqlite3 12.8.0 + drizzle-orm 0.45.1:** Session-scoped call state and history — SQLite correct for v1 (in-sandbox); drizzle supports Neon Postgres swap post-launch without schema changes
- **Express.js 5.2.1:** Webhook receiver and dashboard API — persistent process required; Vercel serverless functions cannot maintain WebSocket connections or handle calls lasting minutes
- **Telnyx built-in STT (Deepgram Flux) + TTS (NaturalHD):** Voice pipeline — no additional API keys; Telnyx-edge-hosted Deepgram gives 100-300ms lower latency than cloud-routed STT
- **zod 4.3.6:** Webhook payload validation — Telnyx sends rich JSON per call event; validate before acting to prevent mishandled call state

### Expected Features

The core loop is non-negotiable: all nine P1 features must ship together because each is a prerequisite for the next. The product has no partial-launch mode.

**Must have — table stakes (P1, must all launch together):**
- Natural language intent capture with clarification prompts — service type, location, urgency from a single open-ended question
- Google Places provider search ranked by rating, review count, proximity, open status
- Live verbal status narration — user hears what the agent is doing; silence kills calls
- Outbound availability check calls with AI disclosure (California SB-1001 / FCC rules apply)
- Multi-provider fallback cascade — try next automatically if first is unavailable
- Warm live call transfer to confirmed-available provider, with context briefing before bridge
- Graceful no-answer fallback — verbal report plus SMS provider list
- Post-call SMS recap — providers contacted, outcome, connected provider, BuyMeACoffee tip link
- Call outcome logging — shared data model for SMS recap and dashboard

**Should have — competitive differentiators (P2, add after v1 validation):**
- Call history web dashboard — trigger: users ask "who did you connect me with last time?"
- Answering machine detection (AMD) — trigger: too many provider legs wasted on voicemail
- Urgency detection and provider re-ranking — trigger: enough real calls to tune signals
- Web search fallback for providers — trigger: Places returns too few results in low-coverage areas
- Custom provider directory — trigger: service categories where Google results are consistently poor

**Defer — v2+ only:**
- Proactive monitoring and push suggestions — requires persistent user profiles and scheduled infrastructure; large scope delta from v1
- Provider outcome-based ranking feedback loop — needs statistical call volume to be meaningful
- Multi-language support — validate English-market demand first

**Anti-features — deliberately out of scope:**
- Scheduling or booking on behalf of user (liability, incompatible provider systems)
- Payment processing or job quotes (PCI compliance; 48% provider refusal rate from Google Duplex data)
- Provider-side portal (two-sided marketplace doubles the acquisition problem)
- Mobile app (phone + SMS + web covers 100% of interaction surface)
- AI identity deception (illegal under California SB-1001 and FCC rules)

### Architecture Approach

The system follows a webhook-command loop: Telnyx fires HTTP POST events for every call state transition; the Express server returns 200 immediately and dispatches async processing; the agent issues REST commands back to Telnyx. All call state is tracked in a per-session object keyed by `call_control_id`, indexed by ALL active legs (both user Leg A and each provider Leg B) for O(1) lookup on every webhook. The agent loop runs mid-call with tool calls (maps_search, outbound_dial, bridge) executed while the user hears TTS progress narration.

**Major components:**
1. **Telnyx Call Control v2** — owns all telephony: PSTN ingress/egress, STT, TTS, call legs, conferencing, SMS; communicates via REST commands + webhook events
2. **OpenClaw Gateway (port 18789)** — persistent daemon: session management, event routing, plugin orchestration, agent LLM loop
3. **Voice-Call Plugin** — translates Telnyx events into agent tool calls; owns `voice_call` tool actions; runs webhook server (port 3334, in-process with gateway)
4. **Session State Store** — in-memory Map (hot path) + SQLite write on phase transitions; must index by ALL call_control_ids (Leg A and all Leg Bs)
5. **Google Maps Tool** — `@googlemaps/places` Places API (New) searchNearby; explicit field masks mandatory to control billing
6. **SMS Tool** — Telnyx Messaging API; 10DLC-registered; consent-gated per TCPA
7. **Web Dashboard** — Express-served SPA reading SQLite call records; independent of call flow

**Key architectural patterns to follow:**
- Return 200 from webhook endpoint immediately, then process async — Telnyx retries on slow response, causing duplicate actions
- Gate every Leg B action on received webhook events, never on elapsed time — bridge fires only on confirmed `call.answered` for Leg B
- Speak final TTS to user BEFORE issuing bridge command — TTS after bridge is silently discarded
- Periodic TTS updates on Leg A every 15-20 seconds while CALLING_PROVIDERS — silence exceeding 20 seconds causes hang-ups
- Explicit state machine: GREETING → GATHERING → SEARCHING → CALLING_PROVIDERS → BRIDGING → ENDED

### Critical Pitfalls

1. **OpenClaw device pairing fails silently in Vercel Sandbox** — MicroVM proxy headers break loopback detection; cron jobs and WebSocket features crash with `"pairing required"` (1008) while HTTP chat still works, creating false impression of success. Prevention: pre-pair by writing `paired.json` and clearing `pending.json` before `openclaw start`. Must be solved in Phase 1 before any testing is possible.

2. **Vercel Sandbox timeout kills active calls** — Default 5-minute sandbox timeout; maximum is 45 min (Hobby) or 5 hours (Pro). On timeout, the gateway WebSocket drops and all active calls go dead with no graceful cleanup. Prevention: implement a keep-alive loop calling `extendTimeout` every 10 minutes; store call state externally; implement graceful Telnyx call cleanup on gateway disconnect.

3. **10DLC registration silently blocks all SMS** — As of February 2025, U.S. carriers silently filter all unregistered A2P SMS; no error is returned to sender. Prevention: start 10DLC brand + campaign registration in Phase 1 alongside number provisioning. Approval takes 1-5 business days and cannot be done last-minute.

4. **Live transfer drops user due to bridge sequencing errors** — Issuing bridge before Leg B's `call.answered` event, or sending `hangup` on Leg A instead of agent-only exit, disconnects the user. Prevention: implement as explicit state machine; gate every action on webhook confirmation; test with voicemail and slow-answer scenarios before production.

5. **Outbound number flagged as spam by carriers** — Sequential calls to local businesses from the same number with low answer rates match robocaller behavioral patterns; number gets silently labeled "Spam Likely" with no error returned. Prevention: register with Free Caller Registry, add CNAM, enable STIR/SHAKEN A-attestation, rotate caller IDs, add minimum inter-call delay. Must be configured before first production volume.

6. **Google Places wildcard field mask causes 5-10x cost explosion** — `*` field mask bills at Preferred tier rate. Prevention: use explicit field masks from day one (`displayName`, `nationalPhoneNumber`, `rating`, `userRatingCount`); set Google Maps Platform billing alerts.

7. **Call state corruption from concurrent webhook handlers** — Two Telnyx webhooks for the same call arriving in parallel cause last-write-wins corruption; agent loses context, asks repeated questions, or transfers to wrong provider. Prevention: single-writer pattern per `call_control_id`; serialize event processing per session.

8. **TTS reads LLM markdown output literally** — LLM produces asterisks, bullet points, URLs; TTS reads them aloud. Prevention: explicit system prompt instructions (plain spoken English only, no markdown) plus a TTS sanitization preprocessing step.

---

## Implications for Roadmap

Based on the layered architecture dependency chain from ARCHITECTURE.md and the pitfall-to-phase mapping from PITFALLS.md, a 7-phase structure is recommended. Phases 1-5 are the indivisible critical path. Phases 6-7 are independent enhancements that can be deferred.

### Phase 1: Infrastructure Foundation
**Rationale:** Four blocking pitfalls (device pairing, sandbox timeout, 10DLC registration, number spam registration) must be resolved before any telephony testing is possible. These are not code features — they are provisioning and configuration steps that have multi-day lead times. Doing them last forces late-stage rework that delays everything downstream.
**Delivers:** Working Vercel Sandbox with OpenClaw gateway pre-paired and auto-starting, public HTTPS webhook URL with dynamic update on restart, Telnyx number provisioned and carrier-registered, sandbox keep-alive loop, and 10DLC registration initiated.
**Addresses:** Sandbox provisioning, webhook URL management, telephony account setup
**Avoids:** Device pairing failure (Pitfall 1), sandbox timeout killing calls (Pitfall 9), 10DLC blocking SMS (Pitfall 5), spam flagging (Pitfall 4)
**Research flag:** NEEDS RESEARCH — OpenClaw-specific `paired.json` pre-pairing schema has limited official documentation; verify exact format and startup sequence against current OpenClaw release before writing the startup script.

### Phase 2: Inbound Call + Voice Conversation Core
**Rationale:** The webhook-command loop, session state model, STT/TTS pipeline, and call state machine are foundational to every subsequent phase. Building these correctly — especially async webhook handling, single-writer state management, and latency controls — prevents the most expensive bugs (call state corruption, duplicate actions, caller hang-ups from silence). Establish the latency budget and TTS sanitation here, not during Phase 4 when the full dual-leg complexity is in play.
**Delivers:** An inbound call that is answered, speaks a greeting, captures user speech, extracts service intent (service type + location) within 2 turns, and maintains correct conversational context across multiple turns without state corruption or latency spikes.
**Uses:** Telnyx STT/TTS, OpenClaw voice-call plugin, Express webhook server, zod validation, in-memory session store with phase tracking
**Implements:** Webhook-command loop, explicit call state machine, async 200-first webhook pattern, TTS sanitization pipeline
**Avoids:** Call state corruption (Pitfall 2), voice latency >800ms (Pitfall 6), TTS markdown artifacts (Pitfall 10), webhook slow response causing duplicate actions (Pitfall 20), over-interrogating callers (Pitfall 13), VAD end-of-turn issues (Pitfall 12), multi-turn context rot (Pitfall 11)
**Research flag:** STANDARD PATTERNS — Telnyx webhook integration is fully documented; Express async webhook pattern is established.

### Phase 3: Provider Discovery
**Rationale:** Intent extraction from Phase 2 feeds provider search. This phase can be built and tested independently against Phase 2 output without live outbound calling. Google Places API integration with correct field masks and ranking logic must be validated in isolation — wrong field masks cause billing explosions; wrong ranking produces poor matches that waste the outbound calls in Phase 4.
**Delivers:** Given a service type and location, the system searches Google Places API (New), deduplicates results, ranks by business_status/rating/distance, and returns an ordered provider list. Agent speaks a verbal preview to the user ("Found 6 plumbers near you, calling the top-rated one now").
**Uses:** `@googlemaps/places` 2.3.0, Places API (New) searchNearby, explicit field masks, ranking algorithm in `lib/search/rank.ts`
**Implements:** Maps search tool plugin, provider ranking, result summarization for LLM context injection
**Avoids:** Google Places wildcard field mask cost explosion (Pitfall 8), 20-result limit requiring multi-query strategy (Pitfall 17), Google Places data storage ToS violation (Pitfall 18)
**Research flag:** STANDARD PATTERNS — Google Places API (New) is well-documented with official SDK; field mask billing model is explicitly documented.

### Phase 4: Outbound Provider Calling + Live Transfer
**Rationale:** This is the highest-complexity phase and the core product differentiator. It requires correct dual-leg state management, keep-warm TTS on the user leg, AMD configuration, and a precisely sequenced bridge operation. All prior phases must be stable before starting. The conference bridge pattern must be implemented from the beginning — retrofitting it after building around blind transfer is expensive.
**Delivers:** The full core loop working end-to-end: agent dials providers sequentially while user hears narrated status updates, skips voicemails/no-answers, and bridges user to the first confirmed-available provider without the user ever dropping.
**Uses:** Telnyx outbound dial, bridge API, AMD in `detect_beep`/`premium` mode, session state multi-leg indexing
**Implements:** Dual-leg bridge pattern, provider outreach loop with fallback cascade, keep-warm TTS scheduler (every 15-20s), multi-leg session indexing, AI disclosure on outbound calls, max-dial circuit breaker (hard limit: 4 providers per call)
**Avoids:** Live transfer dropping user (Pitfall 3), outbound number spam flagging (Pitfall 4), AMD misclassification (Pitfall 7), stale Google Places phone numbers (Pitfall 14), cost runaway from unthrottled dials (Pitfall 16), TTS after bridge being discarded (Architecture anti-pattern)
**Research flag:** NEEDS RESEARCH — dual-leg bridge state machine with OpenClaw tool call integration has limited documented examples; conference bridge vs. bridge API choice for the specific "agent drops off, two parties stay" use case needs verification before implementation begins.

### Phase 5: Post-Call SMS Recap
**Rationale:** SMS depends on completed call outcomes from Phase 4. 10DLC registration initiated in Phase 1 should be approved by now. TCPA verbal consent capture must be built into the Phase 2 conversation flow — it cannot be retrofitted without re-testing the entire intake flow.
**Delivers:** After call ends, user receives SMS with providers attempted, outcome, connected provider name and number, and BuyMeACoffee tip link. Verbal consent captured on call before SMS is sent. Call record written to SQLite for dashboard.
**Uses:** Telnyx Messaging API, better-sqlite3, drizzle-orm, BuyMeACoffee static URL (no API integration needed)
**Implements:** SMS tool plugin, consent capture step in Phase 2 conversation flow, call record persistence schema (shared with Phase 6 dashboard)
**Avoids:** TCPA consent exposure (Pitfall 15), 10DLC blocking (Pitfall 5)
**Research flag:** STANDARD PATTERNS — Telnyx SMS API is straightforward; TCPA consent capture is a UX flow decision, not a technical research gap.

### Phase 6: Call History Dashboard
**Rationale:** Dashboard reads from the SQLite call records written in Phase 5 and is independent of the call flow. Can be developed in parallel with Phase 5 once the data schema is defined. Lower priority than the core loop; add when users ask "who did you connect me with last time?"
**Delivers:** Read-only web UI showing call history: date, service type, providers attempted, outcome, connected provider. Served from the Vercel Sandbox by Express.
**Uses:** Vite + React 19 or plain HTML/JS served by Express; SQLite via drizzle-orm; `/api/calls` endpoint
**Implements:** Call history SPA, basic authentication
**Avoids:** No specific pitfall; standard web development patterns apply
**Research flag:** STANDARD PATTERNS — read-only dashboard with Express + SQLite is well-understood; no research needed.

### Phase 7: Post-Validation Enhancements (v1.x)
**Rationale:** Add after v1 is validated with real users. Each enhancement addresses a specific gap observed in production data, not a speculative improvement.
**Delivers (as a group):** AMD tuning against real voicemail patterns, urgency detection and provider re-ranking, web search fallback for low-coverage areas, custom vetted provider directory for consistently poor-performing categories
**Trigger criteria:** AMD when >15% of call attempts are wasted on voicemail; urgency detection when enough real calls exist to tune signals; web search when Places returns <3 results in a market; custom directory when a service category consistently underperforms.
**Research flag:** NEEDS RESEARCH when scoped — AMD parameter tuning and urgency classification prompt engineering both benefit from phase-level research against real call data.

### Phase Ordering Rationale

- Phases 1-5 follow a hard dependency chain derived from the build-order diagram in ARCHITECTURE.md: infrastructure gates voice conversation, which gates provider search, which gates outbound calling, which gates post-call SMS.
- Phase 1 is unusually heavy on non-code provisioning because four pitfalls have multi-day lead times (10DLC approval: 1-5 days; spam label removal: days to weeks) that cannot be parallelized with code development at the last minute.
- Phase 4 is the longest and riskiest phase. It should be time-boxed and validated with synthetic test calls (SIP softphone as the "provider") before testing with real local businesses.
- The TCPA consent step that Phase 5 requires must be designed and implemented in Phase 2 when the conversation flow is built. Note this cross-phase dependency in Phase 2 planning.
- Phase 6 deliberately defers until Phase 5 because the data schema must be stable before building a UI over it.
- The core loop (Phases 2-5) must be validated end-to-end before Phase 7 features are designed — product-market fit signals will determine which v1.x enhancements matter most.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1:** OpenClaw `paired.json` pre-pairing format and exact sandbox startup sequence — limited official documentation depth; verify against current OpenClaw release before writing the startup script.
- **Phase 4:** Dual-leg bridge state machine implementation with OpenClaw tool calls — the conference bridge vs. bridge API for "agent drops off, two parties stay" needs confirmation; no official OpenClaw + Telnyx conference example was found during research.
- **Phase 7 (when scoped):** AMD parameter tuning for small-business voicemail patterns; urgency classification prompt design — require real call data and iterative engineering.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Telnyx webhook loop + Express async handling — fully documented in official Telnyx Node.js examples.
- **Phase 3:** Google Places API (New) integration — official Google SDK and billing model are well-documented.
- **Phase 5:** Telnyx SMS API + consent UX flow — straightforward.
- **Phase 6:** Read-only dashboard with Express + SQLite — standard patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technology choices verified against official npm registry, official Telnyx docs, and official Vercel KB. Version compatibility matrix is explicit. OpenClaw internals are MEDIUM due to limited official docs depth beyond plugin API. |
| Features | MEDIUM-HIGH | Table stakes and P1 features are HIGH (Telnyx API capabilities confirmed). Competitive differentiation analysis is MEDIUM (competitor features from secondary sources). Anti-feature rationale is HIGH (Google Duplex data, legal citations confirmed). |
| Architecture | MEDIUM-HIGH | Core telephony patterns (webhook-command loop, bridge pattern, session state model) are HIGH (official Telnyx docs). OpenClaw plugin integration is MEDIUM — plugin architecture is documented but deep multi-leg implementation examples are sparse. |
| Pitfalls | MEDIUM | Telephony pitfalls (bridge sequencing, spam flagging, 10DLC) are HIGH — official Telnyx docs and carrier compliance resources. OpenClaw-specific pitfalls (device pairing in Vercel Sandbox) are MEDIUM — community/emerging sources, not official documentation. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **OpenClaw `paired.json` schema for Vercel Sandbox pre-pairing:** The workaround is documented in community sources but not in official OpenClaw docs. Validate the exact schema against the current OpenClaw version before writing Phase 1 startup scripts.
- **Conference bridge vs. bridge API for "agent exits, parties stay":** ARCHITECTURE.md describes both Telnyx `bridge` and `conference` APIs. The exact mechanism for the agent exiting while both parties remain connected needs confirmation during Phase 4 planning. STACK.md research favors conference bridge for warm transfer, but the exact OpenClaw tool call shape is unverified.
- **Vercel Sandbox plan limits vs. expected call durations:** The sandbox timeout maximum (45 min Hobby, 5 hours Pro) needs confirmation against the current plan before committing to deployment architecture. A complex provider search with a talkative user can run longer than 45 minutes.
- **Google Places ToS cache limits and call record data model:** The prohibition on storing Places API results beyond ephemeral session cache affects the schema design — call records must store only derived data (provider name and phone at time of call), not raw Places objects. Validate the exact ToS language before finalizing the data model in Phase 5.
- **10DLC approval timeline risk:** The 1-5 business day estimate may be optimistic given TCR (The Campaign Registry) backlog fluctuations. Start registration on day one and monitor actively; have a plan for launching without SMS if approval is delayed.

---

## Sources

### Primary (HIGH confidence)
- [Telnyx Voice API Fundamentals](https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-fundamentals) — webhook flow, call events, command reference
- [Telnyx AI Assistants — Dynamic Variables](https://developers.telnyx.com/docs/inference/ai-assistants/dynamic-variables) — five resolution mechanisms, 1-second webhook timeout
- [Telnyx Warm Transfers release notes](https://telnyx.com/release-notes/warm-transfers-voice-ai) — confirmed warm transfer with conversation context passing
- [Telnyx Conference API](https://developers.telnyx.com/api/call-control/create-conference) — conference creation from call leg
- [Telnyx Bridge API](https://developers.telnyx.com/api/call-control/bridge-call) — bridging two call legs
- [telnyx npm v6.13.0](https://www.npmjs.com/package/telnyx) — TypeScript rewrite; Node >=20 confirmed
- [@googlemaps/places v2.3.0](https://www.npmjs.com/package/@googlemaps/places) — Places API (New) Node.js client
- [Google Places API (New) Overview](https://developers.google.com/maps/documentation/places/web-service/overview) — field masks, billing model, searchNearby endpoint
- [How to build an on-demand voice agent with Vercel Sandbox](https://vercel.com/kb/guide/how-to-build-an-on-demand-voice-agent-with-vercel-sandbox) — Sandbox architecture, ephemeral sessions, 4 vCPU per instance
- [Vercel WebSocket limitations](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections) — serverless functions do not support persistent WebSockets
- [OpenClaw Voice-Call Plugin](https://docs.openclaw.ai/plugins/voice-call) — plugin API, tool registration
- [Telnyx AMD Documentation](https://telnyx.com/resources/answering-machine-detection-explained) — AMD modes, misclassification rates
- [Telnyx Spam/Scam Likely Handling](https://support.telnyx.com/en/articles/4088988-telnyx-how-to-handle-spam-scam-likely) — number spam flagging prevention

### Secondary (MEDIUM confidence)
- [Bland AI: Warm Transfers](https://www.bland.ai/blogs/warm-transfers) — warm transfer UX patterns, hold management, context briefing
- [Retell AI: Warm Transfer vs Cold Transfer](https://www.retellai.com/blog/effortless-handoffs-with-retell-ais-warm-transfer-feature) — transfer pattern comparison and rationale
- [Sterling Sky: Is Google's AI Calling Your Business?](https://www.sterlingsky.ca/is-googles-ai-calling-your-business/) — 48% provider refusal rate for pricing; validates live transfer over AI negotiation
- [Drizzle vs Prisma serverless performance](https://dev.to/jsgurujobs/6-prisma-vs-drizzle-patterns-that-cut-serverless-cold-starts-by-700ms-5dl5) — 400ms vs 1100ms cold starts; corroborated by multiple sources
- [Workiz: HomeAdvisor vs Thumbtack vs Angi Comparison](https://www.workiz.com/blog/featured/homeadvisor-vs-angieslist-vs-thumbtack-the-complete-comparison/) — competitor feature mapping
- [Leaping AI: Voice AI Agents for Home Services 2026](https://leapingai.com/blog/implementing-voice-ai-agents-for-home-services-complete-guide-2025) — home services vertical patterns

### Tertiary (LOW confidence — monitor for changes)
- OpenClaw device pairing pre-approval workaround for Vercel Sandbox — community-sourced; verify against current OpenClaw release before implementing
- [Decagon: Proactive Agents with User Memory](https://decagon.ai/blog/spring26-product-launch) — proactive monitoring architecture; v2+ feature complexity estimate

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*
