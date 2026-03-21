# Phase 6: Post-Call SMS - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

After every call ends, send the user an SMS recap with outcome, provider info, and BuyMeACoffee tip link. Send a graceful failure SMS with provider contact info when no live transfer was achieved. Persist call records to the database. The web dashboard (Phase 7) reads from these records.

</domain>

<decisions>
## Implementation Decisions

### SMS content & tone
- Murphy's voice — casual, warm, first-person ("Hey Sarah! I connected you with...")
- Personalize with caller's name if captured during the call; fall back to "Hey there!" if not
- Always include connected provider's phone number (useful if call drops or they need to call back)
- Single SMS preferred, cap provider list at top 3 contacted
- Telnyx handles segmentation if message exceeds 160 chars — acceptable but aim to stay under

### Failure fallback SMS
- Include provider names + phone numbers so caller can follow up themselves
- List top 3 providers from the ranked search results
- No BuyMeACoffee tip link on failure recaps — tone-deaf to ask for a tip when service failed
- Encouraging sign-off ("Good luck!")

### Trigger timing
- Send SMS immediately on agent's call.hangup — same handler that already persists call history
- For successful transfers: SMS fires when Murphy's leg disconnects after bridge (user gets SMS while still talking to provider — they'll see it after)
- For non-transfer calls (no_match, abandoned mid-cascade): SMS fires immediately on hangup
- No SMS without TCPA consent (smsConsent=false → skip SMS entirely)
- No SMS for early abandons — if user hung up during greeting/intake/consent (before any providers were contacted), there's nothing useful to recap

### BuyMeACoffee placement
- Casual inline at end of message: "If I saved you some time, a coffee's always appreciated [emoji] [link]"
- Success-only — never on failure recaps
- URL sourced from BUYMEACOFFEE_URL environment variable (consistent with NEXT_PUBLIC_BUYMEACOFFEE_URL in frontend footer)

### Claude's Discretion
- Exact SMS character optimization and line breaks
- Error handling strategy for failed SMS sends (non-fatal, log and continue — same pattern as sendProviderSms)
- Whether to replace the stub `sendSms` in tools/handlers/sms.ts or build a new dedicated module
- Call history persistence improvements (POST-04 is ~80% done in webhooks.ts call.hangup already)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — POST-01, POST-02, POST-03, POST-04 define the four success criteria

### Existing implementation
- `src/api/webhooks.ts` — call.hangup handler (lines 474-571) already persists call history and has the integration point for SMS
- `src/lib/voice/call-state.ts` — CallState interface with smsConsent, callerName, providers, currentProviderIndex fields
- `src/lib/voice/outbound-caller.ts` — sendProviderSms() at line 168 is the proven Telnyx messaging pattern to reuse
- `src/lib/tools/handlers/sms.ts` — Current stub awaiting real implementation
- `src/lib/db/call-history-repo.ts` — insertCallHistory() already called from webhooks.ts call.hangup

### Legal/compliance
- `src/app/privacy/page.tsx` — Privacy policy SMS and BuyMeACoffee disclosures (lines 123, 230-241)
- `src/app/terms/page.tsx` — Terms of service SMS recap and tip link disclosures (lines 151, 240-241)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sendProviderSms()` in outbound-caller.ts: Proven Telnyx SMS pattern — `getTelnyxClient().messages.send()` with from/to/text
- `CallState` fields: `smsConsent`, `callerName`, `callerPhone`, `providers`, `currentProviderIndex`, `stage`, `intent`
- `insertCallHistory()` in call-history-repo.ts: Already called from call.hangup, builds contactedProviders array and determines callStatus
- `NEXT_PUBLIC_BUYMEACOFFEE_URL` env var: Already used in frontend footer component

### Established Patterns
- Non-fatal SMS: `sendProviderSms` wraps in try/catch, logs error, continues — same pattern for recap SMS
- Telnyx messaging: `getTelnyxClient().messages.send({ from, to, text })` — standard across the codebase
- Call cleanup: call.hangup handler does persist → cleanup → endCall() sequence — SMS fits between persist and cleanup

### Integration Points
- `webhooks.ts` call.hangup handler: Add SMS sending after call history persist, before endCall() cleanup
- `CallState.smsConsent`: Gate for whether to send SMS at all
- `CallState.stage`: Determines SMS type — 'transferred'/'complete' → success recap, 'calling' with exhausted providers → failure fallback, early stages → no SMS
- `BUYMEACOFFEE_URL` env var: Needs to be added to .env.example and Vercel environment

</code_context>

<specifics>
## Specific Ideas

- Success SMS preview: "Hey Sarah! I connected you with Acme Plumbing (512-555-1234). I also tried: [bullet] Joe's Plumbing — unavailable. If I saved you some time, a coffee's always appreciated [coffee emoji] [link]"
- Failure SMS preview: "Hey Sarah! I wasn't able to connect you live, but here are the top plumbers I found near Austin: [bullet] Acme Plumbing: 512-555-1234 [bullet] Joe's Plumbing: 512-555-5678. Good luck!"
- The tone should feel like Murphy is texting a friend — not a corporate notification

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-post-call-sms*
*Context gathered: 2026-03-21*
