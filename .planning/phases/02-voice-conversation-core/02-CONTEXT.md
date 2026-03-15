# Phase 2: Voice Conversation Core - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Answer inbound calls, capture user intent from natural speech, maintain conversational state, and respond with streaming TTS and filler speech. This phase delivers the real-time voice pipeline — Murphy answers calls, understands what the caller needs (service type + location), and confirms before handing off to provider search (Phase 3).

</domain>

<decisions>
## Implementation Decisions

### Voice Channel Integration
- **ClawdTalk** handles the voice layer — STT/TTS, Telnyx Call Control, and OpenClaw gateway connection
- Murphy responds via OpenClaw chat; ClawdTalk bridges that to voice
- **Telnyx MCP** used for portal configuration (Call Control apps, webhook URLs, number management)
- Existing Telnyx phone number already provisioned — just needs to be pointed at ClawdTalk
- **Deepgram** for STT (fast, accurate transcription)
- **ElevenLabs** for TTS (natural voice synthesis)
- API keys for both services added to `.env.example` — user fills in values

### Conversation Flow & Intent Capture
- **Instant short greeting**: "Hi, this is Murphy from OpenClaw — I'm an AI assistant. What service do you need today?" — under 2 seconds
- **Bilingual: English + French** — auto-detect language from first utterance via Deepgram, respond in that language for entire call
- **One focused clarifying question** max for ambiguous requests — "What kind of help — plumbing, electrical, cleaning, or something else?" Never more than one question
- **Confirm then act**: "Got it — a plumber in Montreal. Let me find the best options." Quick confirmation + filler, then search
- **Brief natural filler** during tool calls: "Let me look that up for you" / "One moment while I search" — short, natural, then silence until results

### Call State Management
- **OpenClaw sessions** for state management — each call = a session, state tracked automatically by gateway
- **SMS follow-up on call drop**: "Looks like we got disconnected. Call back anytime to pick up where we left off." Session persists for 30 minutes
- **10-minute call timeout**: Murphy says "I want to be respectful of your time — let me wrap up what we've found"

### Voice Personality & TTS
- **Professional male, warm** voice — like a friendly customer service rep. Clear, medium pace, slight warmth
- ElevenLabs voices like "Adam" or "Josh" as reference
- **Same voice for both English and French** — ElevenLabs multilingual voice, consistent Murphy identity
- **Medium pace, natural** — ~150 words/min, conversational speed

### Claude's Discretion
- Exact ElevenLabs voice ID selection (within "professional male, warm" parameters)
- Deepgram model and configuration (language detection settings, punctuation, endpointing)
- ClawdTalk skill configuration details
- Filler phrase variety and rotation
- Error handling for STT failures or TTS timeouts
- Exact greeting wording in French

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Voice pipeline
- `.claude/skills/discussion-builder/SKILL.md` — Conversation architecture (4 caller stages, 4 provider stages)
- `.claude/skills/dispatch-process/SKILL.md` — Full dispatch pipeline (INTAKE → SEARCH → RANK → DIAL → CONNECT → FOLLOW-UP)

### Existing code
- `src/lib/voice/telnyx-client.ts` — Telnyx SDK client (lazy-initialized)
- `src/lib/voice/webhook-verify.ts` — Webhook signature verification
- `src/lib/ai/orchestrator.ts` — LLM orchestrator with task-based routing
- `src/lib/ai/prompts/murphy-system.ts` — Murphy system prompt and persona
- `src/lib/tools/registry.ts` — Tool registry with stub handlers

### ClawdTalk
- ClawdTalk skill installed at `~/.openclaw/workspace/skills/clawdtalk-client/` in sandbox
- `skill-config.json` has API key configured

### Environment
- `.env.example` — Template for API keys (add DEEPGRAM_API_KEY, ELEVENLABS_API_KEY)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/ai/orchestrator.ts`: Tiered LLM routing — currently routes by task type (greeting→cheap, disambiguation→Anthropic). Voice tasks will use similar routing
- `src/lib/ai/prompts/murphy-system.ts`: Murphy persona system prompt — needs voice-specific directives added
- `src/lib/tools/registry.ts`: Tool registry with stub handlers for search_providers, call_provider, transfer_call, send_sms
- `src/api/webhooks.ts`: Telnyx webhook handler — processes call.initiated events

### Established Patterns
- Express v5 with route-level middleware
- Structured logging with `[component]` prefix
- Vitest for testing, supertest for HTTP tests
- TypeScript strict mode, Zod for validation

### Integration Points
- OpenClaw gateway at `ws://127.0.0.1:18789` — ClawdTalk connects here
- ClawdTalk skill bridges voice calls to OpenClaw chat sessions
- Telnyx MCP for programmatic portal configuration
- Sandbox URL changes on each create — allowed origins must be updated

</code_context>

<specifics>
## Specific Ideas

- Murphy should feel like calling a really helpful friend who happens to know every service provider in town
- Greeting must comply with FCC/CA SB-1001 AI disclosure requirements
- Montreal is home base — French support is essential for local callers
- Secrets (Deepgram, ElevenLabs keys) to be stored in Supabase rather than .env files

</specifics>

<deferred>
## Deferred Ideas

- Storing secrets in Supabase instead of .env — infrastructure concern, separate from voice core
- Custom voice cloning for Murphy — future optimization after v1 works

</deferred>

---

*Phase: 02-voice-conversation-core*
*Context gathered: 2026-03-15*
