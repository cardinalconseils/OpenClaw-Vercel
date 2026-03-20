# Phase 4: Outbound Provider Calling - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning
**Source:** Conversation discussion

<domain>
## Phase Boundary

This phase implements outbound calling from the agent to providers on the ranked list. The agent dials providers sequentially, announces itself as AI, gives the user live verbal status updates, handles voicemail/no-answer/busy signals, sends SMS pre-notification to providers, and cascades through up to four providers before declaring no match.

**Upstream:** Phase 3 produces a ranked provider list with phone numbers.
**Downstream:** Phase 5 takes a confirmed-available provider and performs live warm transfer.

</domain>

<decisions>
## Implementation Decisions

### Provider Answer Timeout
- **25 seconds (~5 rings)** per provider before moving to next — standard phone etiquette, enough time to grab the phone without caller impatience

### AI Identification
- Agent must identify itself as an AI concierge on every outbound call before communicating any other information (legal compliance: CA SB-1001, FCC rules)

### Cascade Limit
- Maximum 4 providers tried before declaring no match (per roadmap success criteria)

### User Narration
- Live verbal status updates every 15-20 seconds while calling providers
- User hears provider name when dialing starts ("Calling Acme Plumbing now")
- User hears outcome narration ("They weren't available, trying the next one")

### Claude's Discretion
- Voicemail detection strategy (AMD vs keyword-based)
- SMS pre-notification message content and timing
- Provider conversation flow (how to check availability)
- Dual-leg call architecture (how to maintain user leg while dialing provider leg)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Voice Pipeline
- `src/lib/voice/webhooks.ts` — Current webhook handler (call lifecycle, TTS speak wrapper)
- `src/lib/voice/call-state.ts` — Call state machine (stages, provider list, current provider index)
- `src/lib/voice/greeting-constants.ts` — Filler phrases and greeting constants

### Provider Discovery
- `src/lib/tools/search.ts` — Provider search and ranking (produces ranked provider list)
- `src/lib/voice/narration.ts` — Narration builder functions

### Infrastructure
- `src/lib/voice/telnyx-client.ts` — Telnyx SDK client wrapper
- `src/server.ts` — Express server and webhook routing

</canonical_refs>

<specifics>
## Specific Ideas

- Telnyx Call Control v2 `call_dial` for outbound legs
- Use `call.hangup` event to detect no-answer after timeout
- Answering machine detection (AMD) via Telnyx if available, else keyword heuristics
- SMS pre-notification via Telnyx messaging API to provider's number before/during call
- Provider conversation should be brief: identify as AI, state the service need, ask if available now

</specifics>

<deferred>
## Deferred Ideas

- Voicemail message leaving (just skip to next provider for v1)
- Provider callback scheduling
- Multi-language provider conversations

</deferred>

---

*Phase: 04-outbound-provider-calling*
*Context gathered: 2026-03-16 via conversation discussion*
