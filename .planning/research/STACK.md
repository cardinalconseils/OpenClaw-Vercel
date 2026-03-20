# Technology Stack

**Project:** OpenClaw — AI Phone Concierge / Service Matchmaker
**Researched:** 2026-03-14
**Overall confidence:** HIGH (telephony and search stack), MEDIUM (OpenClaw internals)

---

## Recommended Stack

### Core Framework / Runtime

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| OpenClaw | latest (2026.2.17+) | AI agent runtime, tool orchestration, LLM routing | Project constraint. Provides the gateway process, plugin architecture, and tool-call system. Runs as a persistent daemon inside Vercel Sandbox on port 18789. All agent logic (search, call management, SMS) is expressed as OpenClaw tools. |
| Node.js | 20 LTS | Runtime for the companion webhook server and everything outside the OpenClaw process | Required by the `telnyx` npm SDK (official requirement: Node >=20, non-EOL). Also required by all supporting libraries. Do not use Node 18 — it is EOL. |
| TypeScript | 5.9.3 | Type safety across all server code | The `telnyx` SDK v6 ships complete TypeScript declarations. Telephony webhook handlers are notoriously hard to debug — strict types prevent mishandled call state. |

### Telephony / Voice

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| telnyx (npm) | 6.13.0 | Telnyx Call Control v2 REST client: outbound calls, SMS, conference, bridge, transfer | Official SDK. v6 is the TypeScript rewrite with full type coverage. Provides `calls.dial()`, `calls.speak()`, `conferences.create()`, `calls.bridge()`, `calls.transfer()`, messaging API, and more. Node.js >=20 required. |
| OpenClaw voice-call plugin | bundled with OpenClaw | Bridges Telnyx Call Control inbound/outbound audio to the OpenClaw agent tool system | Purpose-built integration. Exposes `initiate_call`, `speak_to_user`, `end_call` as agent tools. Handles Telnyx webhook routing and PCM audio routing without requiring a custom media stream bridge. |
| Telnyx Call Control v2 | API v2 | Telephony: inbound/outbound calling, media streaming, conferencing, transfer | Project constraint and correct choice. v2 has richer features than v1 (v1 is deprecated). Key commands used: `answer`, `speak`, `dial` (outbound leg), `create_conference`, `join_conference`, `bridge`, `transfer`, `hangup`. |
| Telnyx STT | Built-in (Deepgram Flux, hosted on Telnyx infrastructure) | Real-time speech-to-text from inbound caller audio | Telnyx hosts Deepgram Flux at the edge. Delivers sub-second transcription with 100–300ms less latency than cloud-routed Deepgram. No separate STT service or API key needed — the Telnyx account covers it. |
| Telnyx TTS (built-in) or OpenAI TTS | via OpenClaw `messages.tts` config | Convert agent text responses to audio for Telnyx | Telnyx now ships NaturalHD voices plus Azure Neural HD voices. Use Telnyx-native TTS as the default — no extra API key, lower latency. Swap to ElevenLabs if voice quality becomes a UX priority (same config shape in OpenClaw). |

**How live call transfer works (critical architecture decision):**

OpenClaw will manage two simultaneous call legs:
1. **Inbound leg** — the user calling the Telnyx DID
2. **Outbound leg** — the agent dialing the provider

The correct mechanism for "user stays on line, agent confirms with provider, then connects them" is the **conference bridge pattern**, not blind transfer or SIP REFER:

- Create a named conference via `POST /v2/conferences`
- Move the inbound user leg into the conference
- Dial the provider as a second outbound call
- When provider answers (not voicemail — use AMD), move provider leg into the same conference
- Agent can speak to both using `speak` targeted at the conference, or to each leg separately
- Agent drops off: both legs remain connected in the conference

SIP REFER is cheaper and appropriate for a **blind transfer** (drop user, redirect to provider) — but this project requires confirmed live transfer, so the conference pattern is correct.

### Provider Search

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @googlemaps/places | 2.3.0 | Google Places API (New) v1 — local business search, ratings, phone numbers | Official Google Node.js client for Places API v1 (New). `searchNearby` returns: business type, phone number, rating, review count, hours of operation, website. This is exactly what is needed for ranking and dialing providers. Use this, not the legacy `@google/maps` or `@googleapis/places`. |
| Google Places API (New) | v1 (Places API New) | Find service providers by type and location | Best coverage for local businesses globally. Returns real phone numbers, star ratings, and open/closed status. The legacy Nearby Search API is being sunset — use Places API (New) exclusively. |

**Important Places API (New) usage notes:**
- Billing is per field, not per call. Use field masks (`includedFields`) and request only what you need — `displayName`, `internationalPhoneNumber`, `rating`, `userRatingCount`, `regularOpeningHours`, `formattedAddress`. Fetching all fields (e.g. `reviews`) is expensive.
- Rate limit: 600 QPM per project. For a concierge calling 5–10 providers per call, this is not a concern at launch.

### Data / State

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| better-sqlite3 | 12.8.0 | SQLite embedded database for call history and provider cache within a session | Vercel Sandbox is a long-running MicroVM (not a serverless function). The OpenClaw gateway process is persistent for the lifetime of the sandbox session. SQLite is correct for session-scoped state — zero infrastructure, zero latency, embedded in process. |
| drizzle-orm | 0.45.1 | Type-safe SQL query builder over SQLite (and switchable to Postgres) | Lightest TypeScript ORM in 2025: 7.4KB gzipped, no Rust binary, no codegen step. Supports both SQLite (session-scoped) and Postgres (cross-session persistence) with the same schema API. Switching to Neon Postgres requires only a driver swap. |
| drizzle-kit | 0.31.9 | Schema migrations for drizzle-orm | Must track drizzle-orm minor version. Run `drizzle-kit push` at sandbox startup to apply schema. `drizzle-kit@0.31.x` is compatible with `drizzle-orm@0.45.x`. |

**Session vs cross-session persistence decision:**
- v1 (launch): Use `better-sqlite3` — no external dependency, data persists for the sandbox session lifetime, call history is accessible in the dashboard during the session.
- Post-launch (if dashboard must survive sandbox restart): Swap to Neon (serverless Postgres). Keep `drizzle-orm`; only the driver changes (`@neondatabase/serverless` v1.0.2). Neon is the current official Vercel database integration (Vercel Postgres was migrated to Neon in Q4 2024).

### Web Dashboard

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Express.js | 5.2.1 | Webhook receiver + REST API for dashboard data | Express v5 removes callback-based error gotchas (async errors propagate correctly). All Telnyx official Node.js webhook examples use Express. Serves the dashboard SPA and exposes `/api/calls` history endpoint. Runs as a persistent process inside the Vercel Sandbox. |
| Vite + React | Vite 6.x / React 19 | Call history dashboard SPA | Lightweight SPA served from the same Vercel Sandbox process. React 19 has stable concurrent rendering. Vite serves the build artifacts — no separate frontend deployment. |

**Why Express and not Next.js for the webhook handler:**
Telnyx Call Control sends frequent, potentially long-duration webhooks during call flows. Vercel Serverless Functions (which Next.js API routes deploy to on Vercel) cannot maintain the persistent OpenClaw gateway connection and have a 10-second execution limit. Inside the Vercel Sandbox (a long-running MicroVM), Express as a persistent process is the correct architecture. Next.js is appropriate only if you later build a separate web-facing dashboard on Vercel's serverless infrastructure, separate from the sandbox.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.3.6 | Webhook payload validation and runtime type checking | Telnyx sends rich JSON payloads for every call event (`call.initiated`, `call.answered`, `call.hangup`, `conference.participant.joined`, etc.). Validate before acting on event type. Prevents mishandled call state from malformed payloads. |
| dotenv | 16.x | Secrets management | Load `TELNYX_API_KEY`, `GOOGLE_PLACES_API_KEY`, `OPENAI_API_KEY`, `BUYMEACOFFEE_TOKEN` at startup. Standard. |
| tsx | 4.21.0 | Run TypeScript files directly without compile step | `tsx watch src/server.ts` for development. Faster startup than `ts-node`. No separate `dist/` directory needed in development. |

**BuyMeACoffee tip link:**
BuyMeACoffee does not require API integration for sending tip links. A user's tip link is simply `https://buymeacoffee.com/{username}` — a static URL. Send this as a plain SMS via Telnyx messaging API after a successful connection. No BuyMeACoffee API key or SDK needed at v1. The API (`developers.buymeacoffee.com`) is only needed to read supporter data, which is not a v1 requirement.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ngrok (dev only) | Expose local webhook endpoint during development | Telnyx requires a publicly reachable HTTPS URL for Call Control webhooks. In production the Vercel Sandbox URL (`https://sb-xxx-18789.vercel.run`) is already HTTPS. Update the Telnyx phone number webhook URL in the startup script automatically via the Telnyx management API after each sandbox start. |
| drizzle-kit | Schema migrations | `drizzle-kit push` at sandbox startup to apply schema changes. |
| @vercel/sandbox (optional) | Sandbox lifecycle management from an external orchestrator | Only needed if a separate orchestrating process creates and manages sandbox sessions. Not needed inside the sandbox itself. |

---

## Installation

```bash
# Core telephony + agent
npm install telnyx @googlemaps/places

# Data layer
npm install better-sqlite3 drizzle-orm
npm install -D drizzle-kit @types/better-sqlite3

# Web server + dashboard
npm install express zod dotenv
npm install -D @types/express

# Dev tooling
npm install -D typescript tsx @types/node

# If/when migrating to cross-session Postgres
npm install @neondatabase/serverless
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Call transfer mechanism | Telnyx conference bridge (three-way) | Telnyx `transfer-call` API (blind) or SIP REFER | Blind transfer and SIP REFER drop the user before confirming provider answered. For this product the agent must confirm availability before patching the user through. Conference is the only mechanism that allows the agent to remain on the call, confirm the provider, then drop off while the two parties stay connected. |
| STT provider | Telnyx built-in (Deepgram Flux) | Separate Deepgram subscription, AssemblyAI | Telnyx now hosts Deepgram Flux at the edge, providing the same accuracy with 100–300ms lower latency and zero additional API keys. Only switch to a separate Deepgram account if you need custom vocabulary training. |
| TTS provider | Telnyx NaturalHD or Azure Neural HD (via Telnyx) | ElevenLabs, OpenAI TTS | Telnyx-native TTS has zero additional cost (included in the Telnyx account) and lower latency. ElevenLabs is the upgrade path if voice naturalness is a UX priority — the OpenClaw `messages.tts` config accepts it with a parameter swap. |
| ORM | drizzle-orm | Prisma | Prisma requires a Rust query engine binary (~50MB), complicates Vercel Sandbox provisioning, has 400–1100ms cold starts in serverless contexts, and is primarily designed for Postgres. drizzle-orm is pure TypeScript, has no native binaries, and supports both SQLite and Postgres with the same API. |
| Database (v1) | better-sqlite3 (SQLite) | Neon Postgres, Supabase | For v1, call history only needs to persist within a sandbox session. SQLite eliminates all external dependencies. Neon/Supabase is the correct upgrade path if cross-session persistence is required — and drizzle-orm supports both without schema changes. |
| Web framework | Express.js v5 | Fastify, Hono | Fastify is faster; Hono is edge-compatible. But all Telnyx official Node.js webhook examples are Express-based, reducing debugging surface when webhook events behave unexpectedly. Hono is a valid future swap for edge compatibility. |
| LLM provider | Claude Haiku 3.5 (via Telnyx AI Assistant) or GPT-4o-mini | GPT-4o, Claude Sonnet | The orchestration for this product (search, rank, call, transfer) runs as tool calls, not open-ended reasoning. Haiku 3.5 and GPT-4o-mini have 82%+ on MMLU and 88%+ tool-call accuracy — sufficient for structured tool use at much lower cost per call. |
| Search (supplementary) | Google Places API (New) | Yelp Fusion API, Foursquare | Google Places has the broadest coverage globally and returns real phone numbers with operational hours — critical for this use case. Yelp is US-centric and doesn't reliably return phone numbers. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Telnyx Call Control v1 API | Officially deprecated. v2 has richer features. Telnyx migration guide exists. | Telnyx Call Control v2 |
| `@googleapis/places` or `@google/maps` (legacy) | These wrap the legacy Nearby Search API which is being sunset. Returns incomplete data for the Places API (New) field set. | `@googlemaps/places` v2.3.0 |
| Vercel Serverless Functions for webhook handling | Cannot maintain the persistent OpenClaw gateway WebSocket connection. 10-second execution limit is incompatible with call flows that can last minutes. | Express.js as a persistent process inside Vercel Sandbox |
| Prisma ORM | Rust binary engine adds 50MB+ to install size; designed for Postgres; cold-start penalty in serverless (1–3 seconds vs 100–400ms for drizzle). | drizzle-orm |
| WebSocket on Vercel Serverless (standard deployment) | As of 2026-03, Vercel serverless functions do not support persistent WebSockets even with Fluid Compute. This is why Vercel Sandbox (persistent MicroVM) is the correct deployment target for this project. | Vercel Sandbox |
| Twilio | Project constraint specifies Telnyx. Twilio has equivalent capabilities but would require rewriting the ClawdTalk / voice-call plugin integration from scratch. | Telnyx |
| SIP REFER or blind transfer for the live connection step | SIP REFER is cheaper but transfers the user away before confirming provider availability. The product promise is "confirmed live transfer" — you cannot fulfill this with a blind transfer. | Telnyx conference bridge pattern |

---

## Key Architecture Patterns

### Pattern 1: Live Confirmed Transfer via Conference Bridge

```
User calls DID → inbound leg (call_control_id_A) created
Agent: welcome user, gather service type + location
Agent: search Places API for providers, rank by rating + availability
Agent: "Let me check availability for [Provider X], please hold"
  → dial provider: outbound leg (call_control_id_B)
  → if provider answers (AMD confirms human):
      create_conference(name: session_id)
      join_conference(call_control_id_A)
      join_conference(call_control_id_B)
      speak to conference: "I have [Provider] on the line..."
      → both confirm: agent hangup, caller + provider remain in conference
  → if voicemail (AMD): hangup_B, dial next provider
  → if no answer: hangup_B, dial next provider
```

### Pattern 2: Dynamic Webhook URL Update at Sandbox Start

```
Sandbox starts → OpenClaw gateway starts on port 18789
Startup script reads VERCEL_SANDBOX_URL env var
  → calls Telnyx management API to update phone number webhook URL
  → sets primary URL to: https://{sandbox_url}/webhooks/telnyx
  → sets failover URL to prior sandbox URL (optional)
Express webhook handler is now ready to receive events
```

### Pattern 3: Dynamic Variables for Caller Context

```
Telnyx inbound call → fires dynamic_variables_webhook to our server
Server has 1 second to respond with caller context:
  { "caller_number": "+1...", "call_id": "...", "region": "..." }
Telnyx AI Assistant injects these into the system prompt via {{variable_name}} templates
Agent immediately knows caller's number without asking
```

---

## Version Compatibility Matrix

| Package | Version | Node.js | Notes |
|---------|---------|---------|-------|
| telnyx | 6.13.0 | >=20 | TypeScript rewrite; v5 and below have incomplete types |
| @googlemaps/places | 2.3.0 | >=18 | Use `includedFields` to avoid billing for unused fields |
| drizzle-orm | 0.45.1 | >=18 | Pair with drizzle-kit@0.31.9 |
| drizzle-kit | 0.31.9 | >=18 | Must stay in sync with drizzle-orm minor version |
| better-sqlite3 | 12.8.0 | >=20 | Native Node addon; do not use `sql.js` (browser variant) |
| express | 5.2.1 | >=18 | v5 fixes async error propagation; don't use v4 |
| zod | 4.3.6 | >=18 | v4 has breaking changes from v3; use `z.object` API unchanged |
| tsx | 4.21.0 | >=20 | Replaces ts-node; no `dist/` step needed in development |
| typescript | 5.9.3 | — | Strict mode recommended for telephony code |
| openai (if needed) | 6.29.0 | >=18 | Only needed if bypassing Telnyx-hosted LLM; prefer Telnyx AI Assistants |

---

## Vercel Sandbox Architecture Notes

The Vercel Sandbox is a Firecracker MicroVM — a persistent, isolated Linux environment, NOT a serverless function. This distinction is fundamental to the entire stack:

1. **OpenClaw gateway is the long-running process.** It starts on port 18789, listens for WebSocket connections from device pairings, and must remain running for the full call session. Default sandbox timeout is 5 minutes; must be extended to cover expected call durations (typically 10–30 minutes). Use the `extendTimeout()` API call at session start.

2. **Webhook URL is sandbox-specific and changes on restart.** The public HTTPS URL (`https://sb-{id}-18789.vercel.run`) is allocated per sandbox instance. Automate Telnyx phone number webhook URL updates in the sandbox startup script via the Telnyx management API.

3. **SQLite call data is session-scoped.** Data is lost when the sandbox terminates unless written to an external store (Neon Postgres) or the sandbox takes a snapshot. For v1, session-scoped is acceptable — the dashboard is only used during an active session.

4. **Snapshots save installed-state.** Take a snapshot after first `npm install` and OpenClaw initialization to avoid re-provisioning on every sandbox start.

5. **Port 18789 is already HTTPS.** No reverse proxy or certificate management needed. Telnyx webhook URLs can point directly to the sandbox HTTPS URL.

---

## Sources

- [telnyx npm package](https://www.npmjs.com/package/telnyx) — v6.13.0, TypeScript support, Node.js >=20 requirement (HIGH — npm registry, verified 2026-03-14)
- [Telnyx Node SDK v2 release notes](https://telnyx.com/release-notes/node-sdk-v2) — TypeScript rewrite, enhanced functionality (HIGH — official Telnyx)
- [Telnyx Voice API Fundamentals](https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-fundamentals) — webhook flow, call events, command reference (HIGH — official Telnyx docs)
- [Telnyx AI Assistants — Dynamic Variables](https://developers.telnyx.com/docs/inference/ai-assistants/dynamic-variables) — five resolution mechanisms, built-in variables, 1-second webhook timeout (HIGH — official Telnyx docs, fetched directly)
- [Telnyx AI Assistant no-code quickstart](https://developers.telnyx.com/docs/inference/ai-assistants/no-code-voice-assistant) — outbound calls, transfer tool, SIP Refer tool, Webhook tool, MCP support, LLM providers (HIGH — official Telnyx docs, fetched directly)
- [Warm Transfers for Voice AI Agents — Telnyx](https://telnyx.com/release-notes/warm-transfers-voice-ai) — conversation context passed on transfer (HIGH — Telnyx release notes)
- [Voice AI Assistants AMD on Transfer — Telnyx](https://telnyx.com/release-notes/voice-ai-assistants-amd-on-transfer) — voicemail detection during transfer (HIGH — Telnyx release notes)
- [SIP Refer transfers for AI Assistants — Telnyx](https://telnyx.com/release-notes/sip-refer-transfer-ai-assistant) — lower-cost blind transfer option (HIGH — Telnyx release notes)
- [Telnyx Conference demo (Node.js)](https://github.com/team-telnyx/demo-conference-node) — conference creation, participant management, Node.js example (HIGH — official Telnyx GitHub)
- [Telnyx Bridge calls API](https://developers.telnyx.com/api/call-control/bridge-call) — bridging two call legs (HIGH — official API reference)
- [Telnyx Create conference API](https://developers.telnyx.com/api/call-control/create-conference) — conference creation from call leg (HIGH — official API reference)
- [Telnyx Transfer call API](https://developers.telnyx.com/api/call-control/transfer-call) — blind/warm transfer (HIGH — official API reference)
- [@googlemaps/places npm](https://www.npmjs.com/package/@googlemaps/places) — v2.3.0, Places API (New) Node.js client (HIGH — npm registry, verified 2026-03-14)
- [Google Places API (New) Overview](https://developers.google.com/maps/documentation/places/web-service/overview) — field masks, billing model, searchNearby endpoint (HIGH — official Google docs)
- [drizzle-orm npm](https://www.npmjs.com/package/drizzle-orm) — v0.45.1 (HIGH — npm registry, verified 2026-03-14)
- [Drizzle vs Prisma serverless performance](https://dev.to/jsgurujobs/6-prisma-vs-drizzle-patterns-that-cut-serverless-cold-starts-by-700ms-5dl5) — 400ms vs 1100ms cold starts (MEDIUM — DEV community, multiple sources corroborate)
- [How to build an on-demand voice agent with Vercel Sandbox](https://vercel.com/kb/guide/how-to-build-an-on-demand-voice-agent-with-vercel-sandbox) — Sandbox architecture, ephemeral sessions, 4 vCPU per instance (HIGH — official Vercel KB)
- [Vercel WebSocket limitations](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections) — serverless functions do not support WebSockets (HIGH — official Vercel KB)
- [OpenAI Realtime API gpt-realtime](https://openai.com/index/introducing-gpt-realtime/) — production voice agents, no session limits since Feb 2025 (HIGH — official OpenAI)
- [Neon for Vercel](https://vercel.com/marketplace/neon) — Neon replaced Vercel Postgres (Q4 2024), official integration (HIGH — official Vercel marketplace)

---

*Stack research for: OpenClaw — AI Phone Concierge (Telnyx + Vercel Sandbox + Google Places)*
*Researched: 2026-03-14*
