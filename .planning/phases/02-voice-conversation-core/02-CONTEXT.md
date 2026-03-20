# Phase 2: Voice Conversation Core - Context

**Gathered:** 2026-03-15 (updated x2)
**Status:** Ready for planning

<domain>
## Phase Boundary

Answer inbound calls with a greeting, capture user intent from natural speech (service type + location), ask smart clarifying questions when intent is ambiguous, and respond with streaming TTS using filler speech to avoid dead air. This is the first real phone conversation experience — Murphy goes from silent webhook processing to a live voice agent.

</domain>

<decisions>
## Implementation Decisions

### Murphy's Voice
- Warm male voice — matches Murphy's "he/him" persona and "friendly contractor" energy
- Telnyx built-in TTS — zero extra latency, no additional cost, streaming speak commands
- Telnyx built-in STT — part of Call Control v2 gather command, lowest latency
- Canadian persona flavor — baked into system prompt, not slang or stereotypes. Canadian warmth and politeness, knows Canadian geography
- Speaking pace: Claude's discretion — pick what sounds most natural for the Telnyx voice selected

### Conversation Pacing
- Straight to business after greeting — AI disclosure + name ask + "what do you need?" in the opening. No small talk
- Greeting flow: "Hi, I'm Murphy — an AI assistant from OpenClaw. Who am I speaking with?" -> [name] -> "Hey [name], what kind of service are you looking for?"
- Ask for caller's name in greeting — use it naturally throughout the call
- Confirm-and-go for complete requests — echo intent in one phrase, immediately search. "Plumber in Montreal — searching now." No explicit "is that right?" wait
- Open-ended clarification only for vague requests — "What kind of help do you need with your house?" No phone-menu-style guided options. Murphy asks and lets the caller lead, never proactively suggests
- 2-turn clarification max (carried from Phase 1.1) — then broad search + narrate: "I'll search for general home repair services near you and we'll narrow it down from what I find." Transparent, keeps moving
- Stop and listen on interruptions — Murphy stops speaking immediately when caller talks over him. Uses Telnyx barge-in detection
- Gentle nudge after 8s silence — "Still there?" Two nudges before graceful hangup
- Urgency auto-detection — keywords like "emergency", "flooding", "urgent" trigger faster flow (fewer questions, immediate search with urgency=emergency)
- Brief empathy + solve for frustrated callers — "That sounds really stressful. Let me find an emergency plumber near you right now."
- Off-topic requests: polite redirect — "I only handle finding service providers — plumbers, electricians, and the like. Is there a service provider I can help you find?"
- Confused callers ("What is this?"): one-sentence explainer — "I'm an AI that finds local service providers for you — plumbers, electricians, that kind of thing. What do you need help with?"
- Quick echo + go for intent readback — "Electrician in Laval — let me find someone for you." Caller corrects only if wrong
- Location: always ask explicitly — "Where are you located?" No area code inference (unreliable with VoIP numbers, people who've moved)
- Unknown/edge-case service types: search as-is using caller's exact words — if no results, ask caller to describe differently
- Multi-request handling: Claude's discretion — handle one at a time or queue, whichever feels natural

### TCPA Consent
- Ask after intent capture, before searching — natural transition point. "Before I search, mind if I send you a text recap after we're done? It'll have the provider's info handy."
- Casual but complete phrasing — covers opt-in, purpose, and content without sounding like a lawyer
- No problem on decline — "No problem at all" and move on immediately. SMS is a bonus, not required
- Flag + timestamp logging — store `sms_consent: boolean`, `consent_timestamp: ISO string`, `consent_method: "verbal"` in call state
- Ask every call — even repeat callers. TCPA best practice, consent is per-interaction. Acknowledge repeat callers though: "good to hear from you again"

### Dead Air & Filler Speech
- Personality-driven static pool — pre-written 15-20 varied filler phrases. "Let me check on that." "Searching a few spots now." "Give me just a moment." Zero LLM latency
- Voice only — no artificial audio effects, typing sounds, or hold music. Pure Murphy voice or brief natural silence
- Updates every 10 seconds during waits — no silence > 10 seconds (matches success criteria). Varied filler phrases from pool, no repetition back-to-back
- Concurrent filler + tool calls — TTS filler fires at the same time as the API call. Minimizes perceived latency
- Action statement before search — "Electrician in Laval — let me find someone for you." Sets caller expectations
- 10-second escalation threshold — after 10s of filler, escalate: "Taking a bit longer than usual." After 20s, offer alternatives
- Transparent + retry on errors — "Hmm, that didn't come through. Let me try again." One retry, then graceful fallback with options

### Claude's Discretion
- Exact Telnyx TTS voice selection (warm male, best available)
- Speaking pace strategy (match caller vs. steady)
- Multi-request call flow design (handle one at a time or queue)
- Filler phrase pool content (15-20 phrases in Murphy's brief/functional voice)
- Call state machine design and state transitions
- STT configuration (language model, silence detection thresholds)
- When service type is captured but location is missing, ask for location only — one question per turn, no bundling

</decisions>

<specifics>
## Specific Ideas

- Murphy should feel like calling a really helpful friend who happens to know every service provider in town (carried from Phase 1.1)
- The dispatch-process skill defines the full pipeline (INTAKE -> SEARCH -> RANK -> DIAL -> CONNECT -> FOLLOW-UP) — Phase 2 implements only INTAKE (greeting + intent capture). Search tool call is triggered but results narration is Phase 3 scope
- The discussion-builder skill defines conversation architecture (4 stages on caller side) — Phase 2 covers Stage 1 (intake/greeting) and the transition to Stage 2 (search)
- Canadian warmth in persona — not stereotypes, just naturally Canadian politeness and geography awareness
- The orchestrator already has task types for 'greeting', 'intent-capture', and 'filler' routed to OpenRouter, and 'disambiguation' routed to Anthropic — these map directly to Phase 2 conversation needs

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/ai/orchestrator.ts`: Chat function with tiered routing (OpenRouter for routine, Anthropic for complex). Task types already defined for greeting, intent-capture, filler, disambiguation
- `src/lib/ai/prompts/murphy-system.ts`: Murphy persona with AI disclosure, dispatch pipeline, conversation rules, and 2-turn clarification max
- `src/lib/ai/prompts/voice-modifiers.ts`: Voice mode constraints (no markdown, short sentences, natural speech)
- `src/lib/tools/registry.ts`: Tool definitions with search_providers, call_provider, transfer_call, send_sms — all stubs ready to be wired
- `src/lib/voice/telnyx-client.ts`: Singleton Telnyx SDK client, lazy-initialized
- `src/api/webhooks.ts`: Webhook handler with call.initiated dispatch to orchestrator

### Established Patterns
- Express v5 with route-level middleware
- Vitest + supertest for testing
- TypeScript strict mode, zod for validation
- Structured logging with `[component]` prefix
- Raw body parsing for webhook signature verification
- `setImmediate()` for async event processing after 200 ACK

### Integration Points
- `src/api/webhooks.ts` line 35 — call.initiated handler currently only sends greeting prompt. Needs to become a full conversation manager
- `src/lib/state/` — empty directory, ready for call state machine
- `src/lib/voice/` — needs Telnyx Call Control commands (answer, speak, gather)
- Orchestrator needs conversation history management (currently stateless single-turn)

</code_context>

<deferred>
## Deferred Ideas

- Bilingual French + English voice support — user wants Murphy to eventually handle both languages. Maps to LANG-01/LANG-02 in v2 requirements. Canadian French specifically (Quebec context)
- Repeat caller recognition — acknowledge returning callers by name from call history database. Requires POST-04 (call data persistence) from Phase 6

</deferred>

---

*Phase: 02-voice-conversation-core*
*Context gathered: 2026-03-15*
