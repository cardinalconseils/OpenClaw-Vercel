# Phase 5: Live Call Transfer - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Bridge the user live to a confirmed-available provider via Telnyx conference bridge. Murphy briefs the provider with the user listening, says goodbye to both parties, then exits the conference — leaving user and provider connected. Handles bridge failures by auto-cascading to the next provider.

**Upstream:** Phase 4 produces a confirmed-available provider (provider answered, said "yes" to availability). The `transferCall()` stub in `dispatch.ts:58` is the entry point.
**Downstream:** Phase 6 sends post-call SMS recap after the call ends.

</domain>

<decisions>
## Implementation Decisions

### Transfer Mechanism
- **Conference bridge** — Murphy creates a 3-way Telnyx conference, joins both the user leg and provider leg, then exits after handoff
- Not direct transfer — conference allows warm handoff with briefing before Murphy leaves
- Flow: provider confirms availability → Murphy creates conference → joins both legs → briefs provider → says goodbye → leaves conference → user + provider talk directly

### Provider Briefing
- **Shared briefing** — user hears Murphy brief the provider (transparent, no mute/unmute complexity)
- Content: service type + location + caller name — concise, gives provider enough to start the conversation
- Example: "Hey [Provider], I have [Name] on the line. They need [service] near [location]. Let me connect you."

### Agent Exit Behavior
- **Brief goodbye to both parties** before leaving the conference
- Example: "Alright, you're connected. [Name], meet [Provider]. I'll leave you two to it — good luck!"
- Murphy then leaves the conference; user and provider remain connected

### Failure Recovery
- **Auto-cascade to next provider** if provider drops during bridge (before Murphy exits)
- Murphy tells user: "Looks like we lost them — let me try the next provider."
- Uses existing `tryNextProvider()` cascade logic from Phase 4
- If **user hangs up** during transfer: Murphy sends brief apology to provider ("Sorry, the caller disconnected") then hangs up provider leg and cleans up state

### Claude's Discretion
- Conference creation API specifics (Telnyx conference vs. call.bridge)
- Timing of conference join operations (parallel vs. sequential)
- How to detect "provider dropped during bridge" vs. "normal call end"
- New call state stages needed (e.g., 'transferring', 'bridged')
- Error handling for conference API failures

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Voice Pipeline (Phase 4 — direct upstream)
- `src/lib/voice/outbound-caller.ts` — Cascade loop, provider answer/hangup handlers, narration timer, SMS pre-notification. The `handleProviderAnswer()` function is where transfer logic plugs in after availability is confirmed
- `src/lib/voice/call-state.ts` — CallState interface with `providerCallControlId` field, stage enum (needs new stages for transfer)
- `src/lib/voice/voice-config.ts` — Voice constants, TTS settings, cascade limits

### Tool Stubs
- `src/lib/tools/handlers/dispatch.ts` — `transferCall()` stub at line 58 that needs real implementation

### Webhook Handler
- `src/api/webhooks.ts` — Webhook routing for Telnyx events. Will need handlers for conference events

### Telnyx Call Control
- Telnyx Call Control v2 conference API documentation (researcher should fetch current docs)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `outbound-caller.ts:tryNextProvider()` — Cascade logic reusable for bridge failure recovery
- `outbound-caller.ts:speak()` — TTS helper for speaking on any call leg
- `outbound-caller.ts:stopNarrationTimer()` — Already called when provider answers
- `outbound-caller.ts:decodeClientState()` — Base64 client_state codec for webhook routing
- `call-state.ts:updateCall()` — Patch-based state updates, already tracks `providerCallControlId`
- `voice-config.ts` — Centralized constants (voice, timeouts)

### Established Patterns
- Webhook events routed via `client_state` base64 encoding (stage + metadata)
- `setImmediate()` for async processing after 200 ACK to webhooks
- Module-level Maps for in-memory state (calls, narration timers)
- Non-fatal error handling pattern: try/catch with silent suppression for "call may have ended" cases

### Integration Points
- `outbound-caller.ts:handleProviderAnswer()` — After availability confirmed, trigger transfer flow
- `outbound-caller.ts:parseAvailability()` — Returns 'available' which should trigger transfer
- `dispatch.ts:transferCall()` — Stub to replace with real implementation
- `webhooks.ts` — Needs new event handlers for conference.* events
- `call-state.ts:CallState.stage` — Needs new stages: likely 'transferring' and 'bridged'

</code_context>

<specifics>
## Specific Ideas

- The conference bridge approach matches Murphy's warm Canadian persona — he doesn't just dump people into a call, he introduces them
- Shared briefing keeps everything transparent — user knows exactly what the provider was told
- Auto-cascade on bridge failure is seamless — user doesn't have to make decisions during a stressful moment
- Brief apology to provider on user hangup is polite and professional — providers are potential repeat contacts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-live-call-transfer*
*Context gathered: 2026-03-20*
