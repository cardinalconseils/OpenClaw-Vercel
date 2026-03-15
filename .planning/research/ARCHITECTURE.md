# Architecture Patterns

**Domain:** AI Phone Concierge / Service Matchmaker
**Project:** OpenClaw — Service Matchmaker
**Researched:** 2026-03-14
**Confidence:** MEDIUM-HIGH (core telephony and agent patterns HIGH; OpenClaw-specific internals MEDIUM due to limited official docs depth)

## Recommended Architecture

OpenClaw Service Matchmaker is a stateful, event-driven voice orchestration system. The core pattern is: receive inbound call → gather service intent → search and rank providers → sequentially call providers while user waits on soft hold → bridge user to confirmed provider → send SMS recap.

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PUBLIC TELEPHONE NETWORK                     │
│   User Phone ──────────────────────────────── Provider Phones        │
└──────────────────────────┬────────────────────────────┬─────────────┘
                           │ PSTN/SIP                   │ PSTN/SIP
┌──────────────────────────▼────────────────────────────▼─────────────┐
│                        TELNYX CALL CONTROL v2                         │
│                                                                       │
│  Inbound Number ──► Call Router      Outbound Dialer ◄── Commands     │
│  STT Engine ──────► Transcripts      TTS Engine ◄──────── Agent text  │
│  Media Fork ──────► WebSocket        Conference Bridge ──► Live patch  │
│  SMS API ◄────────────────────────────────────────────────────────── │
└──────────────────────────┬────────────────────────────────────────────┘
                           │ Webhooks (HTTPS POST)
                           │ Commands (REST API calls)
                           │ Media streams (WebSocket)
┌──────────────────────────▼────────────────────────────────────────────┐
│                     VERCEL SANDBOX (MicroVM)                           │
│           https://sb-xxxxxxxx-18789.vercel.run                         │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    OPENCLAW GATEWAY (port 18789)                  │  │
│  │                                                                   │  │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │  │
│  │  │ Voice-Call   │   │  AgentRouter │   │  Session Manager     │ │  │
│  │  │   Plugin     │   │  (bindings)  │   │  (call state/ctx)    │ │  │
│  │  └──────┬───────┘   └──────┬───────┘   └──────────────────────┘ │  │
│  │         │                  │                                       │  │
│  │  ┌──────▼──────────────────▼──────────────────────────────────┐  │  │
│  │  │              AGENT LOOP (LLM Orchestration)                  │  │  │
│  │  │  Tools: voice_call, web_search, maps_search, sms_send       │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌────────────────┐  ┌─────────────────┐  ┌────────────────────────┐  │
│  │  Webhook       │  │  Call State     │  │  Web Dashboard         │  │
│  │  Server        │  │  Store (memory/ │  │  (call history UI)     │  │
│  │  (HTTP routes) │  │  external DB)   │  │                        │  │
│  └────────────────┘  └─────────────────┘  └────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼─────────────────┐
          ▼                ▼                 ▼
┌─────────────────┐ ┌────────────┐ ┌──────────────────┐
│ Google Maps /   │ │ Web Search │ │ Provider Directory│
│ Places API      │ │ (Brave/    │ │ (custom DB or     │
│                 │ │  Serper)   │ │  flat file)       │
└─────────────────┘ └────────────┘ └──────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Telnyx Call Control v2 | Owns all telephony: PSTN ingress/egress, STT, TTS, call legs, bridging, SMS | Telnyx platform — REST API + webhook events |
| Telnyx Webhook Receiver | Receives `call.initiated`, `call.answered`, `call.hangup` events and dispatches commands back | Express/Fastify route inside Gateway |
| OpenClaw Gateway | Persistent daemon: session management, event routing, plugin orchestration, agent loop | Node 24 daemon on port 18789 |
| Voice-Call Plugin | Translates Telnyx events ↔ agent tool calls; owns `voice_call` tool actions; runs webhook server on port 3334 (in-process with Gateway) | Telnyx webhooks, LLM agent, Telnyx REST API |
| Agent Loop / LLM | Decides what to do at each turn: search, speak, call provider, transfer, send SMS | Configured LLM (Claude/GPT-4o) via OpenClaw |
| Tool Registry | Registers and enforces access for all tools the agent can invoke | OpenClaw built-in + custom tool plugins |
| Session State Store | Tracks per-call state: user leg call_control_id, provider search results, which providers were tried, current phase | In-memory Map (hot path) + DB on session end |
| Google Maps Tool | Searches for local service providers by query + location, returns ranked list | Google Maps Places API (New) via tool plugin |
| Web Search Tool | Supplements Maps results with web-sourced providers | Brave Search or Serper API tool |
| Provider Directory | Optional curated list of pre-vetted providers | SQLite or JSON file |
| SMS Tool | Sends post-call recap and BuyMeACoffee tip link | Telnyx SMS API |
| Web Dashboard | Call history, provider outcomes, user-facing log | Next.js or plain HTML served from Gateway |
| Vercel Sandbox | Isolated Linux MicroVM hosting the Gateway; exposes HTTPS URL for Telnyx webhooks | Firecracker microVM, 2GB+ RAM, port 18789 |

---

## Session State Model

Every inbound call gets a session object (keyed by `call_control_id`) that persists across all webhook events. Telnyx Call Control is stateless per webhook — your application provides continuity.

```typescript
interface CallSession {
  // Stable identifiers
  callControlId: string;         // user leg (Leg A)
  callerNumber: string;

  // Current phase
  state: CallPhase;
  // GREETING | GATHERING | SEARCHING | CALLING_PROVIDERS | BRIDGING | ENDED

  // Intent extracted from user speech
  intent: ServiceIntent | null;  // { service_type, location, urgency }

  // Provider pipeline
  providers: RankedProvider[];
  currentProviderIndex: number;

  // Active provider legs (Leg B, Leg C, ...)
  providerLegs: Map<string, ProviderLegState>;
  // ProviderLegState: { provider: RankedProvider, state: 'dialing'|'answered'|'hung_up' }

  // Outcomes
  startedAt: Date;
  endedAt: Date | null;
  outcome: 'connected' | 'no_providers_available' | 'abandoned' | null;
  connectedProvider: RankedProvider | null;
  providersAttempted: ProviderAttempt[];

  // Post-call
  smsRecapSent: boolean;
}
```

The `call_control_id` is the stable handle across ALL Telnyx webhook events for a given leg. Store it immediately on `call.initiated` and use it to route every subsequent event.

---

## Detailed Data Flow

### Phase 1: Inbound Call — Intent Gathering

```
1.  User dials Telnyx DID
2.  Telnyx fires call.initiated (direction=inbound) webhook → Webhook Server
3.  Webhook Server: respond 200 immediately, then async dispatch
4.  Plugin answers call; stores call_control_id as session.callControlId (Leg A)
5.  Plugin speaks greeting via TTS → Telnyx speak command
6.  Telnyx fires call.speak.ended → Plugin issues gather (STT) command
7.  User speaks: "I need a plumber in Austin, Texas"
8.  Telnyx fires call.gather.ended with transcript → Plugin
9.  Plugin passes transcript to Agent Loop
10. LLM extracts: { service_type: "plumber", location: "Austin TX", urgency: "ASAP" }
11. LLM stores ServiceIntent in session; transitions state → SEARCHING
```

### Phase 2: Provider Discovery

```
12. LLM invokes maps_search tool: { service_type: "plumber", location: "Austin TX" }
13. Google Maps Places API (New) — searchNearby or searchText
    Returns: name, phone, rating, user_ratings_total, business_status, distance
14. Optionally: web_search tool for additional leads
15. Optionally: custom provider directory lookup
16. Deduplicate by phone number / business name
17. Rank by: business_status=OPERATIONAL first, then rating desc, then distance asc
18. Store ranked_providers[] in session; transitions state → CALLING_PROVIDERS
19. LLM speaks to user: "Found 6 plumbers near you. Calling the top-rated one now..."
```

### Phase 3: Sequential Provider Outbound Calling (User on Soft Hold)

```
20. For each provider in ranked_providers[]:
    a. LLM invokes voice_call.initiate_call({ to: provider.phone })
    b. Telnyx creates Leg B with new call_control_id
       Plugin stores: session.providerLegs.set(legB_id, { provider, state: 'dialing' })
    c. Telnyx fires call.initiated (direction=outgoing) for Leg B
    d. If provider ANSWERS (call.answered on Leg B):
       - LLM speaks to Leg B: "Hi, calling on behalf of a customer who needs
         [service] at [location]—are you available right now?"
       - Gather on Leg B for provider response
       - Provider says yes → proceed to Phase 4 (bridge)
       - Provider says no  → hang up Leg B, speak update to Leg A, try next
    e. If NO ANSWER / BUSY / VOICEMAIL (call.hangup on Leg B):
       - Plugin speaks update to Leg A: "ABC Plumbing didn't answer.
         Trying the next one..."
       - Advance providerIndex, repeat loop
    f. While dialing: speak a status update to Leg A every ~20 seconds
       "Still searching—give me just a moment more..."
    g. If all providers exhausted:
       - Speak to user: "I wasn't able to reach anyone right now.
         I'm sending their numbers via SMS."
       - Transition state → ENDED

CRITICAL: Leg A MUST remain active throughout. Never silence > 20 seconds.
```

### Phase 4: Live Transfer (Bridge)

```
21. Provider confirmed available (Leg B active, agent confirms "yes")
22. LLM speaks to Leg A: "I'm connecting you to [Provider Name] now.
    One moment..."
23. Telnyx Bridge API: POST /calls/{legA_id}/actions/bridge
    body: { call_control_id: legB_id }
    → Both legs hear each other; agent exits the audio path
24. Telnyx fires call.bridged on both legs
25. Plugin marks session.state → BRIDGING
    Records connectedProvider in session

NOTE: Issue any final TTS to Leg A BEFORE the bridge command.
      TTS commands after bridging are ignored — Telnyx discards them.
```

### Phase 5: Post-Call SMS Recap

```
26. call.hangup fires on Leg A or Leg B (either party disconnects)
27. Plugin transitions session.state → ENDED
28. Agent compiles recap from session:
    - providers searched: N
    - providers called: M (with outcomes per provider)
    - connected to: [Provider Name] at [phone] (or "no connection made")
29. sms_send tool: POST Telnyx /v2/messages
    to: session.callerNumber
    body: "We called 3 plumbers for you. You were connected to ABC Plumbing.
           If this helped, buy us a coffee: https://buymeacoffee.com/openclaw"
30. Session written to DB for dashboard (async, non-blocking)
```

---

## Webhook Routing Pattern

Telnyx sends all webhooks (Leg A and Leg B) to the same endpoint. Route by `call_control_id` to determine which leg/handler to invoke:

```typescript
// Immediate 200 response, async dispatch — CRITICAL
app.post('/webhooks/telnyx', async (req, res) => {
  verifyTelnyxSignature(req); // reject if invalid
  res.sendStatus(200);        // respond before any async work

  const event = req.body;
  const { call_control_id, event_type } = event.data.payload;

  const session = sessionStore.findByAnyLeg(call_control_id);
  if (!session) return; // stale or unknown leg

  if (call_control_id === session.callControlId) {
    // User leg (Leg A)
    handleUserLegEvent(session, event_type, event);
  } else if (session.providerLegs.has(call_control_id)) {
    // Provider leg (Leg B, Leg C, ...)
    handleProviderLegEvent(session, call_control_id, event_type, event);
  }
});
```

The Session Store must index sessions by ALL call_control_ids (both Leg A and all provider legs) for O(1) lookup on every webhook.

---

## Recommended Project Structure

```
openclaw-concierge/
├── gateway/
│   ├── extensions/               # OpenClaw plugin directory
│   │   ├── voice-call/           # Telnyx voice-call plugin (customized)
│   │   │   ├── package.json
│   │   │   └── index.ts          # Plugin entry: registers voice_call tool
│   │   ├── maps-search/          # Google Maps/Places tool plugin
│   │   │   └── index.ts
│   │   ├── web-search/           # Web search tool plugin
│   │   │   └── index.ts
│   │   └── sms-recap/            # Post-call SMS tool plugin
│   │       └── index.ts
│   ├── agents/
│   │   └── concierge.yaml        # System prompt, tool access, LLM model
│   └── config.yaml               # Gateway config (ports, channels, keys)
├── lib/
│   ├── telnyx/
│   │   ├── calls.ts              # Outbound dial, bridge, hangup
│   │   ├── sms.ts                # Send SMS
│   │   └── webhooks.ts           # Signature verification, event parsing
│   ├── search/
│   │   ├── maps.ts               # Google Maps Places API (New)
│   │   ├── web.ts                # Supplemental web search
│   │   └── rank.ts               # Provider ranking algorithm
│   └── state/
│       ├── callSession.ts        # In-memory store + DB adapter interface
│       └── types.ts              # CallSession, CallPhase, ServiceIntent types
├── dashboard/
│   ├── app/                      # Next.js app directory
│   └── components/
├── scripts/
│   ├── sandbox-start.sh          # Vercel Sandbox provisioning
│   └── pair-device.sh            # OpenClaw device pairing helper
├── .env.example
└── package.json
```

---

## Architectural Patterns

### Pattern 1: Webhook-Command Loop (Telnyx Call Control)

**What:** Telnyx sends webhook events (HTTP POST) for each call state transition. Your server responds by issuing REST commands back to Telnyx. State machine driven by webhooks, not polling.

**When to use:** Mandatory — this is the Telnyx Call Control v2 protocol.

**Trade-offs:** Requires a public HTTPS endpoint (Vercel Sandbox provides this). Webhook ordering is not guaranteed under load; commands must be idempotent.

```typescript
// Incoming webhook: call.answered for user leg
app.post('/webhooks/telnyx', async (req, res) => {
  const event = verifyAndParse(req);
  res.sendStatus(200); // acknowledge immediately, before processing

  if (event.data.event_type === 'call.answered') {
    const { call_control_id } = event.data.payload;
    await telnyx.calls.transcriptionStart(call_control_id, {
      language: 'en',
      transcription_engine: 'google',
    });
    gateway.emit('call:answered', { call_control_id });
  }
});
```

### Pattern 2: Dual-Leg Bridge for Live Transfer

**What:** The live transfer is not a blind handoff — it is a conference bridge. User's Leg A stays active throughout. Agent dials provider as Leg B. When Leg B answers and confirms availability, both legs are bridged. Agent exits.

**When to use:** Required for "user stays on line while agent calls providers" UX.

**Trade-offs:** Two simultaneous call legs with independent webhook streams. Conference bridging incurs Telnyx per-minute cost on both legs for the bridged duration.

```
User calls in ──► Leg A (call_control_id_A)
                      │
                      ▼
Agent speaks: "Looking for plumbers near you..."
Agent dials provider ──► Leg B (call_control_id_B)
                              │
                    Provider answers
                              │
                              ▼
Agent speaks to Leg A: "Connecting you now..."  [BEFORE bridge]
Bridge A + B ──► Both hear each other
Agent exits audio path
```

```typescript
// Dial provider as Leg B
const legB = await telnyx.calls.create({
  connection_id: process.env.TELNYX_CONNECTION_ID,
  to: providerPhone,
  from: AGENT_NUMBER,
  webhook_url: `${SANDBOX_URL}/webhooks/telnyx`,
});

// When Leg B answers, bridge to Leg A
if (event.data.event_type === 'call.answered' && isProviderLeg(call_control_id)) {
  await telnyx.calls.bridge(call_control_id, {
    call_control_id: userLegCallControlId,
  });
}
```

### Pattern 3: Agent Tool Calls Mid-Call

**What:** The agent loop runs while the call is active. Tools (maps_search, outbound_dial, bridge) are called mid-conversation. The user hears TTS updates while tools execute.

**When to use:** Core to the concierge UX — agent must search, rank, and dial while keeping the user informed.

**Trade-offs:** Tool latency (Maps API, LLM inference) is felt by the caller. Any tool taking >2 seconds needs a pre-spoken progress update first.

```
User: "I need an electrician in Austin, Texas, within 10 miles"
  → STT transcript → agent loop
  → Agent invokes: maps_search({ query: "electrician", location: "Austin TX" })
  → [While tool runs] speak: "Searching for electricians near you..."
  → Maps returns ranked providers
  → Agent invokes: voice_call({ action: "dial", to: providerA.phone })
  → [While dialing] speak to Leg A: "Calling Austin Electric Co now..."
```

### Pattern 4: Keep User Leg Warm

**What:** Periodic TTS updates on Leg A while the agent is dialing providers. Never leave the caller with >15-20 seconds of silence.

**When to use:** Always — dead air equals abandoned calls.

**Implementation:** Schedule a repeating speak command every 15-20 seconds on Leg A whenever state is CALLING_PROVIDERS. Cancel when state transitions.

### Pattern 5: Streaming STT for Low-Latency Turn-Taking

**What:** Telnyx STT streams partial transcripts in real time. The agent loop uses end-of-utterance detection rather than a silence timeout, reducing perceived latency.

**Trade-offs:** Requires handling partial transcript events separately from final transcripts. More complex event parsing.

---

## Data Flow Summary

### Inbound Call Flow

```
User dials Telnyx number
    │
    ▼
Telnyx: call.initiated webhook ──► Webhook Server
    │                                   │
    │                          Acknowledge (200 OK)
    │                          Issue: calls.answer command
    ▼
Telnyx: call.answered webhook ──► Webhook Server
    │                                   │
    │                          Start STT transcription
    │                          Notify Gateway: call:answered
    ▼
Gateway / Voice-Call Plugin
    │
    ▼
Agent Loop receives "call answered" event
    │
    ▼
Agent speaks greeting via TTS
    │
    ▼
Telnyx streams STT transcript chunks
    │
    ▼
Agent Loop processes user utterance
    │
    ├──► maps_search tool (Google Places)
    ├──► web_search tool (supplemental)
    └──► Ranks providers by rating/proximity
         │
         ▼
Agent speaks: "Found 3 electricians. Calling the top-rated one..."
         │
         ▼
Agent invokes: dial(providerPhone) → Leg B created
         │
         ▼
Telnyx: call.answered for Leg B ──► Bridge Leg A + Leg B
         │
         ▼
User and provider speak directly
         │
         ▼
Telnyx: call.hangup for either leg ──► Webhook Server
         │
         ▼
Agent sends SMS recap via sms_send tool
         │
         ▼
Call state persisted to DB for dashboard
```

### Provider Outreach Loop (No Answer Path)

```
Agent dials Provider A
    │
    ├── Provider answers ──► Bridge to user ──► DONE
    │
    └── No answer / busy / declined
            │
            ▼
Agent speaks to Leg A: "Austin Electric didn't answer, trying next..."
            │
            ▼
Agent dials Provider B ──► repeat
            │
            └── All providers tried, none connected
                    │
                    ▼
Agent: "I wasn't able to reach anyone right now.
        Sending their numbers to you via SMS."
                    │
                    ▼
SMS sent with provider list + callback suggestion
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Telnyx Call Control v2 | Webhook (inbound) + REST API (commands) | HTTPS endpoint required; Vercel Sandbox provides. Webhook signature must be verified. |
| Telnyx STT | Enabled per-call via `transcription_start` command | Returns partial + final transcript events via webhook |
| Telnyx TTS | Issued via `speak` command with text payload | Agent drives this; Telnyx synthesizes and plays to caller |
| Telnyx SMS | REST API call to `/v2/messages` | Same API key; send from agent's Telnyx number |
| Google Maps Places API (New) | REST HTTPS GET (searchNearby or searchText) | Requires Places API (New) enabled on GCP project; different endpoint from legacy |
| Web Search (Brave/Serper) | REST | Supplemental provider discovery; lower priority than Maps |
| BuyMeACoffee | Static URL in SMS body | No API integration needed — append static link |
| OpenClaw LLM provider | Configured in Gateway (Claude/GPT-4o) | Agent loop calls this for all reasoning turns |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Telnyx → Webhook Server | HTTPS POST | Stateless per request; call state lives in Session Store |
| Webhook Server → Gateway | In-process event emission (EventEmitter) or local IPC | Co-located in same process for MVP |
| Gateway → Voice-Call Plugin | OpenClaw plugin SDK RPC | Plugin registers tools; Gateway dispatches tool calls |
| Agent Loop → Tool Plugins | Synchronous tool invocation via Tool Registry | Agent awaits tool result before generating next speech |
| Gateway → Call State Store | Direct read/write (in-memory Map + DB adapter) | Index by ALL call_control_ids (Leg A and all Leg Bs) |
| Gateway → Dashboard | Internal REST API (GET /calls, GET /calls/:id) | Dashboard reads from DB via API route |

### Vercel Sandbox Network Topology

The Telnyx webhook URL must be public HTTPS. Vercel Sandbox provides `https://sb-{id}-18789.vercel.run`.

```
Telnyx → HTTPS POST → https://sb-{id}-18789.vercel.run/webhooks/telnyx
                               │
                       Vercel Sandbox MicroVM
                               │
                       OpenClaw Gateway :18789
                               │
                       Voice-Call Plugin (in-process, port 3334 internal)
```

Egress from Vercel Sandbox must allowlist:
- `api.telnyx.com` — Call Control commands + SMS
- `maps.googleapis.com` — Provider search
- `api.anthropic.com` or `api.openai.com` — LLM
- `buymeacoffee.com` — Tip link validation (or just embed static URL, no outbound needed)

---

## Build Order (Phase Dependencies)

Components have hard dependencies. Each layer gates the next.

```
Layer 1 — Telephony Foundation (prerequisite for everything)
  [A] Telnyx account + DID provisioned + webhook URL configured
  [B] Vercel Sandbox running with public HTTPS URL
  [C] Webhook receiver: answer call, speak greeting, handle hangup

Layer 2 — Voice Conversation Core (requires Layer 1)
  [D] STT pipeline: Telnyx gather → transcript → Agent Loop
  [E] TTS pipeline: Agent Loop response → Telnyx speak command
  [F] Session state store: per-call object with phase tracking + leg indexing

Layer 3 — Provider Discovery (requires Layer 2 for intent extraction)
  [G] Google Maps Places API (New) integration + ranking
  [H] Web search tool (supplemental, can stub initially)
  [I] Custom provider directory (optional stub for v1)

Layer 4 — Outbound Calling (requires Layers 2 + 3)
  [J] Outbound dial tool (creates Leg B with own call_control_id)
  [K] Provider leg event handling (answer, speak, gather, hangup)
  [L] User leg keep-warm TTS updates during provider call loop

Layer 5 — Live Transfer (requires Layer 4)
  [M] Bridge Leg A + Leg B on provider confirmation
  [N] Post-bridge cleanup, session outcome recording

Layer 6 — Post-Call (requires Layer 5)
  [O] SMS recap + BuyMeACoffee tip link (Telnyx Messaging API)
  [P] Session persistence to Vercel KV / SQLite / Postgres

Layer 7 — Dashboard (requires Layer 6)
  [Q] Next.js read-only call history UI
  [R] Basic auth
```

**Critical path:** A/B → C → D/E/F → G → J/K/L → M/N → O/P → Q/R

Each layer produces a testable milestone before the next layer begins.

---

## Anti-Patterns

### Anti-Pattern 1: Blocking the Webhook Handler

**What people do:** Await a slow tool call (Maps API, LLM inference) inside the webhook POST handler before returning 200.

**Why it breaks:** Telnyx expects a 200 response within ~5 seconds or retries the webhook, causing duplicate events and double-dialing.

**Prevention:** Return 200 immediately, then process the event asynchronously via event emission or an internal queue.

### Anti-Pattern 2: Blind Transfer Instead of Bridge

**What people do:** Use Telnyx's `transfer` command to hand the user off to the provider entirely.

**Why it breaks:** The user gets dead air or voicemail if the provider doesn't answer. The agent cannot retry the next provider.

**Prevention:** Use conference `bridge` to connect both legs. Monitor Leg B's `call.hangup` — if the provider disconnects without a real conversation, re-enter the provider loop.

### Anti-Pattern 3: Storing Call State Only in Memory

**What people do:** Use an in-memory `Map<callControlId, CallSession>` with no persistence.

**Why it breaks:** Gateway restart (sandbox timeout, crash) loses all active call state. Dashboard has no data.

**Prevention:** Write session events to an external store (SQLite in the sandbox for MVP) after each significant phase transition.

### Anti-Pattern 4: Speaking to User After Bridge

**What people do:** Try to inject TTS to Leg A after both legs are bridged.

**Why it breaks:** Once bridged, the agent is no longer in the audio path — TTS commands are ignored or cause audio artifacts.

**Prevention:** Speak any final message to Leg A *before* issuing the bridge command ("Connecting you now..."), then immediately bridge.

### Anti-Pattern 5: Silent Hold During Provider Calls

**What people do:** Dial providers and wait without speaking to the user.

**Why it breaks:** Callers hear silence and hang up within 15-30 seconds.

**Prevention:** Schedule periodic TTS updates on Leg A (~every 15-20 seconds) while state is CALLING_PROVIDERS.

### Anti-Pattern 6: Single Index for Multi-Leg Sessions

**What people do:** Index sessions only by the user leg's call_control_id.

**Why it breaks:** When Telnyx fires webhooks for Leg B (provider), the handler cannot find the session and drops the event.

**Prevention:** Maintain a reverse index mapping ALL call_control_ids (Leg A and every Leg B) to the same session. Update this index when each new leg is created.

### Anti-Pattern 7: Using Vercel Sandbox as Permanent Production Host

**What people do:** Treat the sandbox URL as a stable production endpoint.

**Why it breaks:** Sandboxes are ephemeral with a default 5-minute timeout. URL changes on restart. Telnyx webhook URL configuration breaks.

**Prevention:** For MVP, extend sandbox timeout significantly and use a stable DNS alias. For production, move to a persistent VM or container host.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-50 concurrent calls | Single Gateway instance; in-memory call state; SQLite for history |
| 50-500 concurrent calls | Vercel Sandbox pool or dedicated VM; Redis for shared call state; Postgres |
| 500+ concurrent calls | Multiple Gateway replicas + load balancer; message queue (BullMQ) for webhook fan-out; dedicated STT/TTS microservices |

**First bottleneck:** Vercel Sandbox timeout. Default is 5 minutes — a call easily runs longer. Extend timeout aggressively; switch to a persistent host before production.

**Second bottleneck:** In-memory call state. Gateway restart mid-call loses context. Move to Redis or external store if uptime is important.

**Third bottleneck:** Google Maps API rate limits. Places API has per-second and per-day quotas. Cache provider lookups by (query + location) with a 30-60 minute TTL.

---

## Sources

- [Telnyx Call Control Overview](https://telnyx.com/resources/what-is-call-control) — HIGH confidence
- [Telnyx Bridge Call API](https://developers.telnyx.com/api/call-control/bridge-call) — MEDIUM confidence (official reference, URL inaccessible during fetch)
- [Telnyx Transfer Call API](https://developers.telnyx.com/api/call-control/transfer-call) — MEDIUM confidence
- [Telnyx SIP REFER Transfer](https://telnyx.com/release-notes/transfer-calls-with-sip-refer-live) — MEDIUM confidence
- [Telnyx Media Streaming WebSocket](https://developers.telnyx.com/docs/voice/programmable-voice/media-streaming) — HIGH confidence (page verified)
- [Telnyx Voice API Fundamentals](https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-fundamentals) — MEDIUM confidence
- [OpenClaw Voice-Call Plugin](https://docs.openclaw.ai/plugins/voice-call) — HIGH confidence (page verified)
- [Running OpenClaw in Vercel Sandbox](https://vercel.com/kb/guide/running-openclaw-in-vercel-sandbox) — HIGH confidence (page verified)
- [AI Voice Agent Architecture (VideoSDK)](https://videosdk.live/blog/ai-telephony-agent-inbound-outbound-calls) — MEDIUM confidence
- [AI Voice Agents 2025 Overview](https://dev.to/kaymen99/ai-voice-agents-in-2025-a-comprehensive-guide-3kl) — MEDIUM confidence
- [Google Maps Places API (New) Overview](https://developers.google.com/maps/documentation/places/web-service/overview) — HIGH confidence

---
*Architecture research for: AI Phone Concierge (OpenClaw + Telnyx + Vercel Sandbox)*
*Researched: 2026-03-14*
