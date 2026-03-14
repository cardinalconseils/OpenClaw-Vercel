# Architecture Research

**Domain:** AI Phone Concierge / Service Matchmaker
**Researched:** 2026-03-14
**Confidence:** MEDIUM-HIGH (core telephony and agent patterns HIGH; OpenClaw-specific internals MEDIUM due to limited official docs depth)

## Standard Architecture

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

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Telnyx Call Control v2 | Owns all telephony: PSTN ingress/egress, STT, TTS, call legs, bridging, SMS | Telnyx platform — REST API + webhook events |
| Telnyx Webhook Receiver | Receives `call.initiated`, `call.answered`, `call.hangup` events and dispatches commands back | Express/Fastify route inside Gateway |
| OpenClaw Gateway | Persistent daemon: session management, event routing, plugin orchestration, agent loop | Node 24 daemon on port 18789 |
| Voice-Call Plugin | Translates Telnyx events ↔ agent tool calls; owns `voice_call` tool actions | OpenClaw plugin SDK (TypeScript) |
| Agent Loop / LLM | Decides what to do at each turn: search, speak, call provider, transfer, send SMS | Configured LLM (Claude/GPT-4o) via OpenClaw |
| Tool Registry | Registers and enforces access for all tools the agent can invoke | OpenClaw built-in + custom tool plugins |
| Call State Store | Tracks active calls, which providers were tried, outcomes, current user leg | In-memory during call + persisted to DB after |
| Google Maps Tool | Searches for local service providers by query + location, returns ranked list | Google Maps/Places API via tool plugin |
| Web Search Tool | Supplements Maps results with web-sourced providers | Brave Search or Serper API tool |
| Provider Directory | Optional curated list of pre-vetted providers | SQLite or JSON file |
| SMS Tool | Sends post-call recap and BuyMeACoffee tip link | Telnyx SMS API (already in stack) |
| Web Dashboard | Call history, provider outcomes, user-facing log | Next.js or plain HTML served from Gateway |
| Vercel Sandbox | Isolated Linux MicroVM hosting the Gateway; exposes HTTPS URL for Telnyx webhooks | Firecracker microVM, 2GB+ RAM, port 18789 |

## Recommended Project Structure

```
openclaw-concierge/
├── gateway/                  # OpenClaw gateway configuration
│   ├── extensions/           # Custom plugins (voice-call, tools)
│   │   ├── voice-call/       # Telnyx voice-call plugin (customized)
│   │   │   ├── package.json
│   │   │   └── index.ts      # Plugin entry: registers voice_call tool
│   │   ├── maps-search/      # Google Maps/Places tool plugin
│   │   │   └── index.ts
│   │   ├── web-search/       # Web search tool plugin
│   │   │   └── index.ts
│   │   └── sms-recap/        # Post-call SMS tool plugin
│   │       └── index.ts
│   ├── agents/               # Agent configuration files
│   │   └── concierge.yaml    # System prompt, tool access, LLM model
│   └── config.yaml           # Gateway config (ports, channels, keys)
├── webhook/                  # Telnyx webhook handler (if separate from Gateway)
│   └── telnyx.ts             # Route: POST /webhooks/telnyx
├── dashboard/                # Web call history dashboard
│   ├── app/                  # Next.js app directory
│   └── components/
├── lib/
│   ├── telnyx/               # Telnyx API client wrappers
│   │   ├── calls.ts          # Outbound dial, bridge, hangup
│   │   ├── sms.ts            # Send SMS
│   │   └── webhooks.ts       # Signature verification, event parsing
│   ├── search/               # Provider search logic
│   │   ├── maps.ts           # Google Maps Places search + ranking
│   │   ├── web.ts            # Web search for additional providers
│   │   └── rank.ts           # Provider ranking algorithm
│   └── state/                # Call session state
│       └── callSession.ts    # In-memory store + persistence adapter
├── scripts/
│   ├── sandbox-start.sh      # Vercel Sandbox provisioning script
│   └── pair-device.sh        # OpenClaw device pairing helper
├── .env.example
└── package.json
```

### Structure Rationale

- **gateway/extensions/:** OpenClaw discovers plugins from this directory via workspace scanning — plugins live here to integrate cleanly with the agent loop.
- **lib/telnyx/:** Isolating Telnyx API calls behind a thin wrapper makes it easy to mock for testing and swap providers later.
- **lib/search/:** Provider search and ranking is complex enough to deserve its own module; decoupling it from the agent loop lets it be tested independently.
- **lib/state/:** Call sessions are stateful across multiple Telnyx webhook events; a dedicated store prevents state leaking across calls.
- **dashboard/:** Separating UI from core agent logic avoids coupling; it reads from the same state store via an API endpoint.

## Architectural Patterns

### Pattern 1: Webhook-Command Loop (Telnyx Call Control)

**What:** Telnyx sends webhook events (HTTP POST) for each call state transition; your server responds by issuing REST commands back to Telnyx. State machine driven by webhooks, not polling.

**When to use:** Mandatory for Telnyx Call Control v2 — it is the protocol. All call logic flows through this loop.

**Trade-offs:** Requires a publicly reachable HTTPS endpoint (Vercel Sandbox provides this). Webhook ordering is not guaranteed under load; commands must be idempotent.

**Example:**
```typescript
// Incoming webhook: call.answered for user leg
app.post('/webhooks/telnyx', async (req, res) => {
  const event = verifyAndParse(req); // signature check
  res.sendStatus(200); // acknowledge immediately, before processing

  if (event.data.event_type === 'call.answered') {
    const { call_control_id } = event.data.payload;
    // Tell Telnyx to start STT transcription
    await telnyx.calls.transcriptionStart(call_control_id, {
      language: 'en',
      transcription_engine: 'google',
    });
    // Notify agent loop that user is connected
    gateway.emit('call:answered', { call_control_id });
  }
});
```

### Pattern 2: Dual-Leg Conference Bridge for Live Transfer

**What:** The "live transfer" is not a blind handoff — it is a conference bridge. The user's leg (Leg A) stays active. The agent dials the provider (Leg B). Once Leg B answers, both legs are bridged into a conference. The agent then exits or stays as a silent monitor.

**When to use:** Required for "user stays on the line while agent calls providers" UX. The user hears live updates via TTS while the agent is dialing.

**Trade-offs:** Requires managing two simultaneous call legs and their webhook streams. Conference bridging costs apply for duration on both legs.

**Example:**
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
Bridge A + B ──► Conference (both hear each other)
Agent: "Connecting you now" ──► then exits conference
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

### Pattern 3: Agent Tool Calls Mid-Call (OpenClaw Voice-Call Plugin)

**What:** The agent loop runs normally during an active call. When the agent invokes a tool (e.g., `maps_search`), the plugin pauses TTS output, executes the tool, then has the agent speak the result to the user. The user stays on the line throughout.

**When to use:** Core to the concierge's value — the agent must search, rank, and dial while keeping the user informed.

**Trade-offs:** Tool latency is felt by the caller. Search calls (Maps API, web search) must complete in under 2-3 seconds or the agent should speak a progress update first ("Give me a moment while I search...").

**Example flow:**
```
User: "I need an electrician in Austin, Texas, within 10 miles"
  → STT transcribes → agent loop receives text
  → Agent invokes: maps_search({ query: "electrician", location: "Austin TX", radius: 10 })
  → [While tool runs] Agent speaks: "Searching for electricians near you..."
  → Maps returns: [Provider A, Provider B, Provider C]
  → Agent invokes: voice_call({ action: "initiate_call", to: providerA.phone })
  → [While dialing] Agent speaks to user: "Calling Austin Electric Co now..."
```

### Pattern 4: Streaming STT for Natural Turn-Taking

**What:** Telnyx STT streams partial transcripts in real time. The agent loop listens for end-of-utterance detection rather than waiting for silence timeout. This reduces perceived latency.

**When to use:** Always — sequential (wait for full transcript) introduces 500-2000ms lag that makes the conversation feel robotic.

**Trade-offs:** Requires handling partial transcript events and ignoring interim results until the final transcript arrives. More complex webhook event parsing.

## Data Flow

### Inbound Call Flow (User Calls Agent)

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
    │                          Start transcription
    │                          Notify Gateway: call:answered
    ▼
Gateway: Voice-Call Plugin
    │
    ▼
Agent Loop: receives "call answered" event
    │
    ▼
Agent speaks greeting via TTS (voice_call.speak_to_user)
    │
    ▼
Telnyx streams STT transcript chunks back
    │
    ▼
Agent Loop: processes user utterance
    │
    ├──► maps_search tool (Google Places)
    ├──► web_search tool (supplemental)
    └──► Ranks providers by rating/proximity
         │
         ▼
Agent speaks: "I found 3 electricians. Calling the top-rated one..."
         │
         ▼
Agent invokes: voice_call.initiate_call(providerPhone) [Leg B]
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
    (providers contacted, who connected, BuyMeACoffee link)
         │
         ▼
Call state persisted to DB for dashboard
```

### Provider Outreach Loop (When Provider Doesn't Answer)

```
Agent dials Provider A
    │
    ├── Provider answers ──► Bridge to user ──► DONE
    │
    └── No answer / busy / declined
            │
            ▼
Agent speaks to user: "Austin Electric didn't answer, trying next..."
            │
            ▼
Agent dials Provider B ──► repeat
            │
            └── All providers tried without answer
                    │
                    ▼
Agent: "I wasn't able to reach anyone right now.
        I'm sending you their numbers via SMS."
            │
            ▼
SMS sent with provider list + callback suggestion
```

### Post-Call SMS Flow

```
Call ends (hangup webhook)
    │
    ▼
Agent Loop compiles call summary from session state:
    - Providers searched
    - Providers called + outcomes
    - Who was connected (if any)
    │
    ▼
sms_send tool invoked:
    POST /v2/messages (Telnyx SMS API)
    to: user_phone
    body: "OpenClaw called 3 electricians for you.
           Connected: Austin Electric (512-555-0100)
           Buy us a coffee: buymeacoffee.com/openclaw"
```

### Key Data Flows

1. **Call state across webhooks:** `call_control_id` is the stable handle. Each webhook carries it; the Call State Store maps it to session context (user phone, providers list, current phase).

2. **User leg ↔ provider leg correlation:** When Leg B is created, its `call_control_id` must be stored alongside Leg A's so the bridge command can reference both.

3. **Tool results into agent context:** Maps/web search results are injected into the agent's message context as tool output, then summarized in the agent's verbal response to the user.

4. **Persistent call log:** After call.hangup, session state is written to an external store (SQLite or Postgres) so the dashboard can show history without depending on in-memory state.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-50 concurrent calls | Single Gateway instance in Vercel Sandbox; in-memory call state; SQLite for history |
| 50-500 concurrent calls | Vercel Sandbox pool or move to VM; Redis for shared call state; Postgres for history |
| 500+ concurrent calls | Multiple Gateway replicas behind load balancer; message queue (BullMQ) for webhook fan-out; dedicated STT/TTS microservices |

### Scaling Priorities

1. **First bottleneck: Vercel Sandbox timeout.** Default sandbox timeout is 5 minutes — a call can easily run longer. Set a long timeout (or use snapshot/restore) and keep the gateway process alive with a heartbeat. Switch to a persistent VM for production.

2. **Second bottleneck: In-memory call state.** If the Gateway restarts mid-call, state is lost. Move to Redis or an external store early if uptime matters.

3. **Third bottleneck: Google Maps API rate limits.** Places API has per-second and per-day quotas. Cache provider lookups by (query, location) with a short TTL (30 min) to avoid redundant API calls.

## Anti-Patterns

### Anti-Pattern 1: Blocking the Webhook Handler

**What people do:** Await a slow tool call (Maps API, LLM inference) inside the webhook POST handler before returning 200.

**Why it's wrong:** Telnyx expects a 200 response within ~5 seconds or it retries the webhook, causing duplicate events and double-dialing.

**Do this instead:** Return 200 immediately, then process the event asynchronously (emit to event bus or push to a queue). The agent loop runs on a separate async path.

### Anti-Pattern 2: Blind Transfer Instead of Bridge

**What people do:** Use Telnyx's `transfer` command to hand the user off to the provider and end the agent's involvement entirely.

**Why it's wrong:** The user loses the "live update" experience if the transfer fails (busy signal, no answer) — they get dead air or a voicemail. The agent can't try the next provider.

**Do this instead:** Use conference `bridge` to connect both legs. Monitor Leg B's `call.hangup` event — if the provider hangs up without a real conversation, re-enter the loop and try the next provider.

### Anti-Pattern 3: Storing Call State Only in Memory

**What people do:** Use a `Map<callControlId, CallSession>` in the Gateway process and nothing else.

**Why it's wrong:** Gateway restart (sandbox timeout, crash) loses all active call state. Dashboard has no data. Debugging impossible.

**Do this instead:** Write session events to an external store (SQLite in the sandbox for MVP, Postgres for production) after each significant transition.

### Anti-Pattern 4: Speaking to the User After Bridge

**What people do:** Try to inject TTS to the user after both legs are bridged.

**Why it's wrong:** Once bridged, the agent is no longer the audio path — TTS commands are ignored or cause confusion.

**Do this instead:** Speak any final message to the user *before* issuing the bridge command ("Connecting you now..."), then bridge.

### Anti-Pattern 5: Using Vercel Sandbox as a Permanent Host

**What people do:** Treat the Sandbox URL as a stable production endpoint.

**Why it's wrong:** Sandboxes are ephemeral. Default timeout is 5 minutes. URL changes each time. Telnyx webhook URL configuration would need updating on every restart.

**Do this instead:** For MVP, extend sandbox timeout significantly and use a stable DNS alias or URL-forwarding layer. For production, move to a persistent VM or serverless edge with a fixed URL.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Telnyx Call Control v2 | Webhook (inbound) + REST API (outbound commands) | HTTPS endpoint required; sandbox URL serves this. Webhook signature must be verified. |
| Telnyx STT | Enabled per-call via `transcription_start` command | Returns partial + final transcript events via webhook |
| Telnyx TTS | Issued via `speak` command with text payload | Agent drives this; Telnyx synthesizes and plays to caller |
| Telnyx SMS | REST API call to `/v2/messages` | Same API key; send from agent's Telnyx number |
| Google Maps/Places API | REST (HTTPS GET to Places API) | API key in env; respect rate limits; cache results |
| Web Search (Brave/Serper) | REST | Supplemental provider discovery; lower priority than Maps |
| BuyMeACoffee | Static URL in SMS body | No API integration needed — just append the link |
| OpenClaw LLM provider | Configured in Gateway (Claude/GPT-4o/etc.) | Agent loop calls this for all reasoning |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Telnyx ↔ Webhook Server | HTTPS POST (webhooks) + REST (commands) | Stateless per request; call state in external store |
| Webhook Server ↔ Gateway | In-process event emission (EventEmitter) or local IPC | If co-located in same process (likely for MVP) |
| Gateway ↔ Voice-Call Plugin | OpenClaw plugin SDK RPC | Plugin registers tools; gateway dispatches tool calls |
| Agent Loop ↔ Tool Plugins | Synchronous tool invocation via Tool Registry | Agent awaits tool result before speaking |
| Gateway ↔ Call State Store | Direct read/write | Must be externalized for any multi-process deployment |
| Gateway ↔ Dashboard | Internal REST API (GET /calls, GET /calls/:id) | Dashboard reads from state store via API route |

## Build Order Implications

Components have hard dependencies that dictate build sequence:

```
1. Vercel Sandbox setup + Gateway running
        │
        └──► Required before any Telnyx webhooks can arrive

2. Telnyx webhook receiver + basic call answer/hangup
        │
        └──► Required before any voice interaction is possible

3. STT pipeline (transcription_start) + TTS (speak command)
        │
        └──► Required before agent can hold a conversation

4. Agent loop connected to voice-call plugin
        │
        └──► Required before any tool calls during calls

5. Maps search + web search tools
        │
        └──► Required before provider discovery works

6. Outbound dialing (Leg B) + conference bridge
        │
        └──► Required for live transfer feature

7. SMS recap tool
        │
        └──► Can be added after core call flow works

8. Call state persistence + web dashboard
        │
        └──► Can be added after core flow is stable
```

This order ensures each phase has a testable end state before the next phase begins.

## Sources

- [Telnyx Voice API Fundamentals](https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-fundamentals) — MEDIUM confidence (official docs, some depth limits from fetch)
- [Telnyx Bridge Call API](https://developers.telnyx.com/api/call-control/bridge-call) — HIGH confidence (official API reference)
- [Telnyx Transfer Call API](https://developers.telnyx.com/api/call-control/transfer-call) — HIGH confidence (official API reference)
- [Telnyx Media Streaming WebSocket](https://telnyx.com/resources/media-streaming-websocket) — MEDIUM confidence (marketing page with architectural details)
- [Telnyx Call Control Overview](https://telnyx.com/resources/what-is-call-control) — HIGH confidence (official resource)
- [OpenClaw Docs: Voice Call Plugin](https://docs.openclaw.ai/plugins/voice-call) — MEDIUM confidence (official docs, limited depth)
- [OpenClaw Plugin Architecture (DeepWiki)](https://deepwiki.com/openclaw/openclaw/9.1-plugin-architecture) — MEDIUM confidence (community-generated docs from source)
- [ClawdTalk by Telnyx](https://telnyx.com/resources/openclaw-phone-calls) — MEDIUM confidence (official Telnyx resource for OpenClaw integration)
- [Vercel Sandbox Concepts](https://vercel.com/docs/vercel-sandbox/concepts) — HIGH confidence (official Vercel docs, fully fetched)
- [Running OpenClaw in Vercel Sandbox](https://vercel.com/kb/guide/running-openclaw-in-vercel-sandbox) — HIGH confidence (official Vercel KB)
- [Voice AI Stack for Building Agents (AssemblyAI)](https://www.assemblyai.com/blog/the-voice-ai-stack-for-building-agents) — HIGH confidence (fully fetched, current 2026)
- [AI Voice Agents: What They Are and How They Work](https://www.assemblyai.com/blog/ai-voice-agents) — MEDIUM confidence (industry overview)

---
*Architecture research for: AI Phone Concierge (OpenClaw + Telnyx + Vercel Sandbox)*
*Researched: 2026-03-14*
