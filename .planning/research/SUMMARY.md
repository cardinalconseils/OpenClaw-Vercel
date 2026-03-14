# Project Research Summary

**Project:** OpenClaw AI Phone Concierge (Vercel Sandbox)
**Domain:** AI phone concierge / local service provider matchmaker
**Researched:** 2026-03-14
**Confidence:** MEDIUM-HIGH

## Executive Summary

OpenClaw is an AI phone concierge that accepts inbound calls from users, interprets their service need in natural language, searches Google Maps for local providers, calls those providers on the user's behalf, and bridges the user directly to whoever picks up — all within a single uninterrupted phone call. The product occupies a gap no current consumer tool fills: the full loop from inbound intent to live call transfer, with no app install and no user account required. The technical foundation is constrained by the project: OpenClaw gateway running in a Vercel Sandbox (Firecracker microVM) on port 18789, Telnyx Call Control v2 for all telephony, and ClawdTalk/voice-call plugin as the bridge between the two.

The recommended approach is to build the core call loop in strict dependency order — infrastructure first, then conversation, then outbound dialing and transfer — because the entire product delivers zero user value until all six steps of the loop function end-to-end. The architecture is a webhook-command pattern: Telnyx fires HTTP webhook events, the Express server acknowledges immediately and dispatches asynchronously to the OpenClaw agent loop, which issues REST commands back to Telnyx. A dual-leg conference bridge (not blind transfer) is the correct implementation for live transfer, allowing the agent to narrate progress while the provider leg is being established.

The two most consequential risk categories are infrastructure gotchas that must be resolved before a single real call can work (OpenClaw device pairing failure in the Vercel Sandbox, sandbox timeout killing active calls, and 10DLC registration for SMS) and real-time voice latency that must be actively managed from the start (streaming STT/TTS throughout, filler audio on tool delays, no blocking API calls inside the LLM loop). Shipping the wrong architectural pattern for call state — mutable records instead of event-log — will cause hard-to-diagnose bugs under concurrent webhook load that are expensive to refactor later.

## Key Findings

### Recommended Stack

The stack is tightly constrained by project choices and has well-researched official options for each layer. OpenClaw (latest, 2026.2.17+) runs as a persistent gateway daemon; Telnyx SDK v6.7.0 (TypeScript rewrite, Node.js >= 20 required) handles all telephony; `@googlemaps/places` (not the legacy `@googleapis/places`) wraps the new Places API v1. For data, `better-sqlite3` + `drizzle-orm` is correct for session-scoped state in the sandbox; an external Postgres (Neon/Supabase) would be needed only if call history must survive sandbox restarts. Express v5 handles the webhook receiver and serves the dashboard SPA. The `Vercel Serverless Functions` are explicitly incompatible — they spin down between requests and cannot hold the persistent gateway connection.

**Core technologies:**
- **OpenClaw gateway**: AI agent runtime and orchestration — project constraint; runs persistently on port 18789 inside Vercel Sandbox
- **Telnyx Call Control v2 + telnyx@6.7.0**: All telephony (STT, TTS, SMS, outbound dialing, conference bridge) — v1 is deprecated; v2 required by voice-call plugin
- **ClawdTalk / OpenClaw voice-call plugin**: Telnyx event-to-agent-tool translation — avoids building a custom media stream bridge
- **Telnyx STT (Deepgram Flux at edge)**: Sub-second real-time transcription — 100-300ms faster than cloud-routed Deepgram; no separate STT service needed
- **OpenAI TTS (via OpenClaw messages.tts)**: Agent voice output — streaming PCM compatible with Telnyx; ElevenLabs is the upgrade path for voice quality
- **@googlemaps/places (v1)**: Local business search with phone, rating, hours — Places API v1; the legacy client is being sunset
- **better-sqlite3 + drizzle-orm**: Session-scoped call state and history — zero-infrastructure; drizzle-orm supports Postgres migration with same API
- **Express v5**: Webhook handler + REST API for dashboard — matches Telnyx documentation ecosystem; must run as persistent process, not serverless

### Expected Features

The entire v1 feature set is a single value delivery chain: breaking any link in the chain produces zero user value. All must ship together.

**Must have (table stakes):**
- Natural-language intent capture with clarification — users describe needs in plain speech; no scripted prompts
- Sub-800ms perceived response latency — streaming STT + LLM + TTS throughout; silence feels broken
- Live verbal status narration — user hears agent narrating search and dialing; silence causes hang-ups
- Google Maps provider search with ranking — rating, proximity, open status via Places API v1
- Outbound availability check calls with AI disclosure — legally and ethically mandatory
- Multi-provider fallback cascade — try next provider automatically on no-answer
- Live warm call transfer with context briefing — agent briefs provider before bridging user
- Post-call SMS recap with BuyMeACoffee link — providers tried, outcome, connected provider number
- Graceful failure fallback — verbal report + SMS provider list when no one answers

**Should have (competitive differentiators, add at v1.x):**
- Call history web dashboard — trigger: users ask "who did you connect me with last time?"
- Answering machine detection (AMD) tuning — trigger: too many call legs wasted on voicemail
- Urgency detection and re-ranking — trigger: enough calls to tune signals
- Custom provider directory — trigger: Google results poor in specific categories

**Defer (v2+):**
- Proactive monitoring and push suggestions — requires persistent user profiles, scheduled jobs, outbound-initiated contact; large scope delta
- Provider outcome-based ranking feedback loop — needs call volume to be statistically significant
- Multi-language support — validate English-market demand first

### Architecture Approach

The system has three runtime boundaries: the Telnyx platform (owns all telephony), the Vercel Sandbox MicroVM (hosts the OpenClaw gateway, webhook server, call state store, and dashboard), and external APIs (Google Maps, web search, BuyMeACoffee). The gateway is the only persistent process; everything else is either stateless (webhook handler) or external. Call state must be tracked by `call_control_id` as an event log — not a mutable record — and flushed to an external store after each significant transition. The dashboard reads the same store via an internal REST API and is fully decoupled from the call flow.

**Major components:**
1. **Telnyx Webhook Receiver (Express)** — receives all call state transition events; must return 200 OK immediately and dispatch async
2. **OpenClaw Gateway + Voice-Call Plugin** — persistent daemon; routes Telnyx events to the agent loop; issues STT/TTS/dial commands back
3. **Agent Loop (LLM)** — decides what to do at each turn; invokes tools (maps_search, voice_call, sms_send); runs streaming inference
4. **Call State Store** — event-log keyed by `call_control_id`; in-memory during call, persisted to SQLite/Postgres after hangup
5. **Google Maps Tool Plugin** — `searchNearby` via Places API v1; explicit field mask (name, phone, rating, hours); ranked by rating + proximity + open status
6. **Dual-Leg Conference Bridge** — Leg A (user) stays active while Leg B (provider) is dialed; bridge issued only on `call.answered` for Leg B; agent speaks final message before bridging
7. **SMS Tool** — post-call summary via Telnyx SMS API; requires 10DLC registration before production
8. **Web Dashboard** — reads call log via internal REST; decoupled from call flow; can be built in parallel

### Critical Pitfalls

1. **OpenClaw device pairing fails silently in Vercel Sandbox** — pre-pair by writing `paired.json` with Ed25519 public key and clearing `pending.json` before the gateway starts; add loopback addresses to `trustedProxies`; must be resolved in Phase 1 before any feature testing
2. **Sandbox timeout kills active calls** — implement `extendTimeout` keep-alive every 10 minutes; set sandbox timeout to plan maximum; store all call state externally so restart can recover; must be wired in Phase 1
3. **10DLC registration blocks SMS silently** — register brand + campaign in Telnyx Mission Control immediately in Phase 1; approval takes days to weeks; no workaround during review; do not wait for SMS feature phase
4. **Live transfer drops user or produces silence** — implement as an explicit state machine; gate every Leg B action strictly on received `call.answered` webhook (never elapsed time); speak final message to user before issuing bridge; hang up agent's own participation, never Leg A
5. **Call state corruption under concurrent webhooks** — model call state as append-only event log, not a mutable record; use single-writer pattern per `call_control_id`; establish this before adding any complexity
6. **Voice latency exceeds 800ms** — use streaming everywhere (STT, LLM, TTS); inject spoken filler audio if tool execution exceeds 1 second; never block the LLM loop on synchronous API calls; test with real PSTN calls, not localhost
7. **Outbound calls flagged as spam** — register number with Free Caller Registry and add CNAM before first production dial; enable STIR/SHAKEN A-attestation; use a pool of caller IDs for rotation; recovery takes days to weeks

## Implications for Roadmap

The architecture's build order is deterministic — each component depends on the prior one and has a clear testable end state. The FEATURES.md dependency graph and ARCHITECTURE.md build sequence both point to the same four-phase structure.

### Phase 1: Foundation and Infrastructure

**Rationale:** Nothing else can be tested without a running sandbox, a connected Telnyx number, and working webhook delivery. Three critical pitfalls (device pairing, sandbox timeout, 10DLC registration) must be addressed here — if deferred, they block later phases.

**Delivers:** Vercel Sandbox running OpenClaw gateway with device pre-paired; Telnyx number provisioned with webhook URL configured; Express webhook receiver answering and acknowledging calls; sandbox timeout keep-alive wired; 10DLC brand + campaign registration initiated.

**Addresses:** Sandbox setup, Telnyx number provisioning, webhook infrastructure
**Avoids:** OpenClaw device pairing failure (Pitfall 1), Sandbox timeout drops calls (Pitfall 9), 10DLC blocking SMS (Pitfall 5)
**Research flag:** Needs phase research — OpenClaw device pre-pairing procedure has limited official documentation; Vercel Sandbox provisioning script is project-specific

### Phase 2: Core Inbound Conversation

**Rationale:** The agent cannot search or dial until it can hold a conversation. Latency and TTS format problems must be caught here — before outbound calls add complexity. Call state model must be established correctly before concurrent webhooks create corruption bugs.

**Delivers:** Inbound call answered; agent greeting spoken; streaming STT capturing user utterance; LLM processing intent with clarification; agent response via streaming TTS in spoken plain English (no markdown artifacts); call state written as event log keyed by `call_control_id`; webhook signature verification enforced.

**Addresses:** Natural language intent capture, clarification prompts, sub-800ms response latency, live verbal status narration
**Avoids:** Voice latency (Pitfall 6), TTS reads markdown literally (Pitfall 10), Call state corruption (Pitfall 2), Webhook signature bypass (Security)
**Research flag:** Standard patterns for streaming TTS and STT are well-documented; OpenClaw voice-call plugin system prompt constraints may need experimentation

### Phase 3: Provider Search and Outbound Dialing

**Rationale:** Provider search feeds outbound dialing, which requires the dual-leg bridge. All three must work together. Number hygiene (spam registration, AMD config) must be configured before any production dialing volume. This is the most complex phase and the one where the most pitfalls cluster.

**Delivers:** Google Maps Places API search with explicit field mask and ranked results; agent verbal announcement of top provider; outbound Leg B dial with AI disclosure; answering machine detection in `premium` mode; multi-provider fallback cascade on no-answer; dual-leg conference bridge triggered strictly on Leg B `call.answered`; agent speaks final context briefing before bridging; agent exits bridge leaving user and provider connected.

**Addresses:** Provider search with ranking, outbound availability check calls, warm call transfer, multi-provider fallback, graceful failure fallback
**Avoids:** Live transfer drops user (Pitfall 3), Outbound calls flagged as spam (Pitfall 4), AMD misclassification (Pitfall 7), Google Places wildcard field mask cost (Pitfall 8)
**Research flag:** Needs phase research — dual-leg conference bridge state machine has limited OpenClaw-specific examples; AMD tuning parameters need real PSTN testing data

### Phase 4: Post-Call Wrap-Up and Persistence

**Rationale:** SMS recap and call logging share a data model; build them together. Dashboard reads the same records and can be built in parallel once the schema is defined. 10DLC approval (started in Phase 1) should be approved by now.

**Delivers:** Post-call SMS recap triggered on Leg A `call.hangup` (providers tried, outcome, connected provider, BuyMeACoffee link); call outcome persisted to SQLite with full event log; web dashboard serving call history by caller phone number; graceful sandbox restart recovery (external call state survives restart).

**Addresses:** Post-call SMS recap, BuyMeACoffee tip link, call outcome logging, call history web dashboard
**Avoids:** SMS sent before user hangs up (UX pitfall), SMS blocked by unregistered 10DLC
**Research flag:** Standard patterns — SMS API and SQLite persistence are well-documented; dashboard is standard React/Express

### Phase Ordering Rationale

- **Foundation must precede everything** because Telnyx cannot deliver webhooks without a publicly reachable HTTPS endpoint, and the OpenClaw gateway cannot be tested without device pairing resolved.
- **Conversation before outbound** because latency, TTS format, and call state model bugs are much easier to diagnose in a simple two-party call than in a three-leg concurrent state machine.
- **Outbound and transfer together** because they are inseparable: the conference bridge requires an active outbound leg; testing them separately is impossible.
- **Post-call after core loop** because SMS and logging depend on call outcome data that the core loop produces; the dashboard is read-only and has no blocking dependencies.
- **The core loop is a single value chain.** A broken link at any point produces zero user value. Do not ship partial phases.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** OpenClaw device pre-pairing in Vercel Sandbox is documented in a community gist (not official docs); provisioning script must be validated against current OpenClaw and Vercel Sandbox versions
- **Phase 3:** Dual-leg conference bridge with fallback cascade and state machine transitions has no official OpenClaw example; Telnyx bridge/conference APIs are well-documented but the orchestration layer is custom

Phases with standard patterns (skip research-phase):
- **Phase 2:** Streaming STT/TTS patterns, webhook signature verification, and Express async dispatch are well-documented across Telnyx docs and industry sources
- **Phase 4:** Telnyx SMS API, SQLite with drizzle-orm, and Express-served React dashboard are standard patterns with high-quality official documentation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Telnyx, Google Maps, and Node ecosystem choices are HIGH (official docs, npm registry confirmed); OpenClaw internals MEDIUM (official docs exist but limited depth) |
| Features | MEDIUM-HIGH | Telnyx API capabilities HIGH; industry UX patterns MEDIUM (competitor analysis, multiple sources); competitive gap analysis is well-supported |
| Architecture | MEDIUM-HIGH | Webhook-command loop, conference bridge, and Vercel Sandbox patterns are HIGH; OpenClaw plugin orchestration internals MEDIUM |
| Pitfalls | MEDIUM | Core telephony pitfalls well-documented (Telnyx official, SignalWire equivalent); OpenClaw sandbox pairing sourced from community gist (not official docs) |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **OpenClaw voice-call plugin system prompt constraints**: The exact configuration knobs for constraining LLM output to plain spoken English are not fully documented; will need experimentation in Phase 2. Mitigation: the TTS sanitization pre-processing step (strip markdown before sending to Telnyx) is a safe fallback regardless.
- **Conference bridge and agent exit pattern**: How OpenClaw's agent loop behaves after issuing a bridge command (can it still issue TTS? does it auto-exit?) needs validation against actual plugin behavior, not just Telnyx API docs. Mitigation: design the state machine to speak the final message before bridging and treat post-bridge as a terminal state.
- **Vercel Sandbox URL stability**: The sandbox URL changes on each restart; automating Telnyx webhook URL update via the Telnyx API at startup is documented as needed but no official script example exists. Mitigation: implement startup script that calls Telnyx API to update the phone number's webhook URL on every sandbox boot.
- **AMD tuning**: Default AMD settings have ~3% misclassification; `premium` mode is recommended but actual performance with local service provider voicemail patterns requires real PSTN call data. Mitigation: start with `premium` + `detect_beep`; log all AMD results against actual outcomes for iterative tuning.

## Sources

### Primary (HIGH confidence)
- [Telnyx Call Control API](https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-fundamentals) — webhook flow, call events, command model
- [Telnyx Bridge Call API](https://developers.telnyx.com/api/call-control/bridge-call) — dual-leg bridge implementation
- [Telnyx Conference API](https://developers.telnyx.com/api/call-control/create-conference) — conference-based transfer
- [Telnyx Transfer Call API](https://developers.telnyx.com/api/call-control/transfer-call) — blind vs warm transfer patterns
- [Deepgram Flux on Telnyx release notes](https://telnyx.com/release-notes/deepgram-flux-voice-ai-release) — STT latency improvements
- [telnyx npm package](https://www.npmjs.com/package/telnyx) — v6.7.0, Node.js >= 20, TypeScript support
- [Running OpenClaw in Vercel Sandbox](https://vercel.com/kb/guide/running-openclaw-in-vercel-sandbox) — port 18789, snapshot workflow
- [Vercel Sandbox Concepts](https://vercel.com/docs/vercel-sandbox/concepts) — ephemerality, timeout, network isolation
- [Google Places API (New) — Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search) — v1 API, field mask, billing tiers
- [@googlemaps/places npm](https://www.npmjs.com/package/@googlemaps/places) — recommended client
- [Drizzle ORM](https://orm.drizzle.team/) — SQLite support, no native binaries

### Secondary (MEDIUM confidence)
- [OpenClaw Voice Call Plugin docs](https://docs.openclaw.ai/plugins/voice-call) — STT/TTS config, agent tool actions
- [ClawdTalk / OpenClaw + Telnyx](https://telnyx.com/resources/openclaw-phone-calls) — integration architecture overview
- [Voice AI Agent Transfers — Telnyx](https://telnyx.com/resources/voice-AI-agent-transfers) — warm transfer patterns
- [Bland AI: Warm Transfers](https://www.bland.ai/blogs/warm-transfers) — transfer UX patterns and context briefing
- [Retell AI: Warm Transfer vs Cold Transfer](https://www.retellai.com/blog/effortless-handoffs-with-retell-ais-warm-transfer-feature) — transfer UX rationale
- [Sterling Sky: Google AI Calling Study](https://www.sterlingsky.ca/is-googles-ai-calling-your-business/) — 48% provider refusal for pricing; validates live transfer approach
- [SignalWire: The Double Update](https://signalwire.com/blogs/developers/the-double-update) — concurrent webhook race condition
- [AssemblyAI: Voice AI Stack for Building Agents](https://www.assemblyai.com/blog/the-voice-ai-stack-for-building-agents) — industry latency and architecture patterns
- [OpenClaw Plugin Architecture (DeepWiki)](https://deepwiki.com/openclaw/openclaw/9.1-plugin-architecture) — community-generated docs from source

### Tertiary (LOW confidence / community sources)
- [OpenClaw Cron Pairing Root Cause (Vercel Sandbox)](https://gist.github.com/johnlindquist/da649125c487260a8f408be778d0b900) — device pairing pre-approval workaround; needs validation against current versions
- [OpenClaw Voice-Call Plugin Issue #9635](https://github.com/openclaw/openclaw/issues/9635) — TTS markdown bug; may be partially fixed; validate in Phase 2

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*
