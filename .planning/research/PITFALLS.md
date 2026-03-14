# Pitfalls Research

**Domain:** AI phone concierge / telephony service matchmaker (Telnyx Call Control v2, OpenClaw, Vercel Sandbox)
**Researched:** 2026-03-14
**Confidence:** MEDIUM — core telephony patterns are well-documented; OpenClaw-specific patterns are emerging/community sources

---

## Critical Pitfalls

### Pitfall 1: OpenClaw Device Pairing Fails Silently in Vercel Sandbox

**What goes wrong:**
Inside a Vercel Sandbox (Firecracker MicroVM), the OpenClaw gateway's auto-approval mechanism for device pairing fails because `isLocalDirectRequest()` cannot recognize the connection as local. The MicroVM injects internal proxy headers that break the loopback-address detection logic. Cron jobs (and any WebSocket-based feature) crash with `"gateway closed (1008): pairing required"` while HTTP chat still works — creating the illusion of partial success.

**Why it happens:**
OpenClaw's security model requires a "device pairing" handshake before a device can control the gateway. On a local machine this auto-approves via loopback detection. In the VM, the VM networking layer spoofs or augments headers in a way the loopback check does not expect. Additionally, a second bug: stale pending requests are cached by device ID — if the first attempt required manual approval, subsequent local attempts still receive the old non-local request and are rejected.

**How to avoid:**
Pre-pair the device identity before the gateway starts. During sandbox setup (before calling `openclaw start`):
1. Generate or read the device's Ed25519 public key.
2. Write a pre-approved entry into `paired.json` with operator role and required scopes.
3. Clear `pending.json` to eliminate the stale-request cache bug.
4. Add loopback addresses to the gateway's `trustedProxies` config.

The gateway then starts with the device already approved — the pairing flow is bypassed entirely.

**Warning signs:**
- Cron/scheduled jobs fail but HTTP API calls succeed.
- Logs show `"pairing required"` or `1008` WebSocket close code.
- Manual pairing approval through the dashboard appears to work but fails again on sandbox restart.

**Phase to address:** Phase 1 (Foundation / Sandbox setup) — must be solved before any other feature can be tested.

---

### Pitfall 2: Call State Corruption via Concurrent Webhook Handlers

**What goes wrong:**
Telnyx Call Control v2 fires multiple asynchronous webhook events for the same call simultaneously (speech recognition results, barge-in signals, call.answered, call.bridged, etc.). If two webhook handlers read the shared call state record at the same time, both see the same version, both mutate it, and the last write silently overwrites the first. The result: the agent loses conversational context, asks questions the user already answered, or triggers a transfer without the correct intent state.

**Why it happens:**
Developers treat the call as a database record ("update the call row on each event") rather than as an ordered execution flow. HTTP-based webhook endpoints are naturally concurrent — the server processes two POSTs in parallel. Without atomic state management, the standard implementation produces this race.

**How to avoid:**
Model call state as an append-only event log rather than a mutable record. Use a single-writer pattern: one process owns state per `call_control_id`, and all webhook events are funneled to it as a queue. Within OpenClaw, this means ensuring the agent's tool calls and Telnyx webhooks are processed through a serialized handler, not parallel HTTP routes that touch the same record. For durable state, use Redis with `WATCH`/transaction primitives or Vercel KV with optimistic concurrency.

**Warning signs:**
- Agent repeats questions the user just answered.
- Transfer fires to the wrong provider or without confirmed availability.
- Logs show two webhook events arriving within milliseconds for the same `call_control_id`.
- State looks correct in isolation but wrong "sometimes."

**Phase to address:** Phase 2 (Core inbound call + intent extraction) — establish the state model before adding complexity.

---

### Pitfall 3: Live Transfer Leaves User in Silence or Drops the Call

**What goes wrong:**
The "user stays on the line while agent calls providers" flow requires holding Leg A (user) in a parked/held state while Leg B (provider) is dialed outbound. If the bridge/conference is constructed before Leg B answers, or if the transfer command is issued without confirming Leg B's `call.answered` event, the user experiences dead air, hears partial ringing, or gets dropped when the provider's line is busy/voicemail.

A secondary failure: after a successful bridge, if the agent sends `hangup` on Leg A instead of withdrawing from the bridge (leaving Leg B and Leg A connected), the user is disconnected while the provider is still on the line.

**Why it happens:**
The Telnyx bridge flow requires event-driven sequencing: dial → `call.initiated` → `call.answered` (Leg B) → bridge command. Developers often issue the bridge too early (before `call.answered`) or conflate the agent's own call leg with the user's leg when issuing hangup at transfer completion.

**How to avoid:**
Gate every Leg B action strictly on the received Telnyx webhook event, not on elapsed time or assumed state. Implement the flow as an explicit state machine:
```
INBOUND_ANSWERED → SEARCHING → DIALING_PROVIDER → PROVIDER_ANSWERED → BRIDGING → BRIDGED → AGENT_WITHDRAWN
```
The agent should hang up only its own participation leg after bridging, not Leg A. Test with a SIP soft phone and deliberate slow/no-answer providers in staging before shipping.

**Warning signs:**
- User hears silence for more than 3 seconds mid-call.
- Calls end abruptly after the bridge command.
- Provider reports the call connected but the customer was not there.
- `call.hangup` fires for Leg A before the intended transfer completes.

**Phase to address:** Phase 3 (Outbound provider dialing + live transfer) — entire phase hinges on this being correct.

---

### Pitfall 4: Outbound Agent Calls Flagged as Spam / Blocked by Carriers

**What goes wrong:**
The agent dials multiple local service providers in sequence from the same Telnyx number. Carriers use behavioral analysis (not just blacklists) to detect robocall patterns. A phone number making 5–15 outbound calls per minute to businesses in the same area code, with low answer rates and short durations, looks algorithmically identical to a robocaller. The number gets silently labeled "Spam Likely" or receives SIP 608 (blocked by carrier). Calls stop being answered — but no error is returned to the application.

**Why it happens:**
Developers focus on "does it work" (yes, calls go through in testing) without simulating production-volume patterns. The spam detection is probabilistic and time-delayed — the number is clean during development but gets flagged after days of real usage.

**How to avoid:**
- Register the Telnyx number with the Free Caller Registry (freecallerregistry.com).
- Add CNAM (caller name) to the number via Telnyx Mission Control Portal.
- Use multiple outbound caller IDs (pool of numbers) and rotate them rather than dialing everything from one number.
- Ensure STIR/SHAKEN A-attestation is active for the number.
- Space outbound calls with a minimum inter-call delay (even 2–3 seconds reduces pattern match risk).
- Monitor for SIP 608, SIP 480, or abnormally low answer rates as early warning signals.

**Warning signs:**
- Answer rates drop from ~60% to <20% over a few days without code changes.
- SIP 608 error codes appear in Telnyx call logs.
- Providers who answered before suddenly don't.
- Google Maps listings show the business as active but calls go straight to voicemail.

**Phase to address:** Phase 3 (Outbound provider dialing) — configure number hygiene before any production outbound volume.

---

### Pitfall 5: 10DLC Registration Blocking SMS Recap Feature

**What goes wrong:**
The post-call SMS recap (and BuyMeACoffee tip link) requires sending A2P (application-to-person) messages from a 10DLC long-code number. As of February 2025, U.S. carriers block all unregistered 10DLC traffic. Without 10DLC brand and campaign registration, every SMS is silently filtered — no error is returned to the sender, but the recipient never receives the message.

**Why it happens:**
SMS appears to work in testing (most carriers don't filter in sandbox/low-volume mode) but breaks in production. 10DLC registration is a multi-step process (brand registration → campaign registration → number linking) that can take days to weeks for approval and costs ongoing monthly fees. Developers treat it as an afterthought.

**How to avoid:**
Start 10DLC registration in Phase 1 alongside Telnyx number provisioning. Do not wait until the SMS feature is code-complete. Required steps:
1. Register the brand (business entity) in Telnyx Mission Control.
2. Register a campaign with use case "Mixed/Transactional."
3. Link the Telnyx number to the approved campaign.
4. Test delivery with registered number before wiring into agent logic.

**Warning signs:**
- SMS sends return 200 OK from Telnyx but recipients don't receive messages.
- No delivery receipt callbacks arrive.
- Messages to your own test number (different carrier) sometimes arrive but cross-carrier delivery fails.

**Phase to address:** Phase 1 (Foundation) — initiate registration immediately; do not wait for the SMS feature phase.

---

### Pitfall 6: Voice Latency Exceeds 800ms Threshold

**What goes wrong:**
The pipeline STT → LLM → TTS adds latency at each stage. When the agent also makes outbound API calls (Google Places, web search) during the conversation to answer "what do you need?" the LLM processing stalls while waiting for tool results. The caller hears silence for 2–4 seconds. Conversations feel broken; callers hang up or lose confidence in the system.

**Why it happens:**
Developers test with fast Wi-Fi, low-latency LLM providers, and short prompts. Production conditions include: telephony codec transcoding (+50–100ms), streaming STT with conservative end-of-speech detection (+300–600ms silence threshold), synchronous API calls blocking LLM response generation, and TTS first-byte latency (+200–400ms). Each adds independently; combined they easily breach 2 seconds.

**How to avoid:**
- Use streaming everywhere: streaming STT, streaming LLM (first-token response), streaming TTS.
- Never make blocking API calls inside the LLM tool loop without first sending a spoken acknowledgement ("Let me search for that, one moment...").
- Set a spoken filler trigger: if tool execution exceeds 1 second, inject a pre-recorded "still looking" audio clip.
- Pre-fetch likely needed data (location context, service category) early in the conversation before the user finishes describing their need.
- Target STT end-of-speech detection at semantic turns, not silence-only VAD, to avoid 600ms silence penalty on every user utterance.
- Measure end-to-end with real PSTN calls (not WebRTC or localhost) — telephony adds 100–200ms that local testing hides.

**Warning signs:**
- Caller-side silence exceeding 1.5 seconds after user stops speaking.
- "Hello? Are you there?" from callers.
- Telnyx call recordings show long gaps in agent audio.
- LLM tool call logs show Google Places API calls taking >500ms.

**Phase to address:** Phase 2 (Core conversation) — establish latency budget before adding tool calls.

---

### Pitfall 7: Answering Machine Detection (AMD) Misclassification Wastes Calls

**What goes wrong:**
Telnyx AMD has a ~3% misclassification rate on default settings. When the agent dials a provider who answers live, AMD may classify the response as "machine" (false positive) and hang up before the human can speak. In the opposite direction, a voicemail greeting that says a business name and pauses for a second is classified as "human" (false negative), and the agent begins its pitch to a voicemail recording. Both waste a call attempt and degrade the experience.

**Why it happens:**
AMD decisions are made early (within 1–2 seconds of answer) based on acoustic patterns. Local service provider voicemail greetings often start with a human-sounding name before the recording message. Conversely, some businesses have brief auto-attendants that sound like machines.

**How to avoid:**
- Use Telnyx's `detect_beep` or `premium` AMD mode rather than basic `detect` — these wait for the greeting to complete before classifying.
- Add a short preamble question ("Hi, I'm calling about service availability — is this [Business Name]?") that a human will answer but a machine will not.
- If AMD result is `"not_sure"`, treat as human and proceed with caution rather than hanging up.
- Log all AMD results against actual outcomes (human/machine) to tune parameters over time.

**Warning signs:**
- Providers listed as "called, no answer" in logs who report never receiving a call.
- Agent attempting its pitch mid-voicemail recording.
- AMD result field shows `not_sure` frequently (>10% of calls).

**Phase to address:** Phase 3 (Outbound provider dialing) — AMD configuration must be set before dialing.

---

### Pitfall 8: Google Places API Cost Explosion from Wildcard Field Masks

**What goes wrong:**
The new Google Places API (2025) bills per request at the tier of the most expensive field requested. A wildcard field mask (`*`) in development silently requests all fields including "Preferred" tier fields ($0.017+/request). If this pattern ships to production with any meaningful call volume, costs can be 5–10x higher than expected.

**Why it happens:**
The wildcard is convenient during development to see all available data. Developers forget to replace it before production. Google does not warn at request time — the cost shows up on the monthly invoice.

**How to avoid:**
Define explicit field masks listing only the fields actually used:
```
Basic tier (cheaper): displayName, formattedAddress, nationalPhoneNumber, rating, userRatingCount
Avoid unless needed: websiteUri, regularOpeningHours (Advanced tier)
```
Set a Google Maps Platform billing alert at 2x expected monthly cost. Use field masks from the start — not as a post-optimization step.

**Warning signs:**
- Monthly Google Maps invoice higher than estimated.
- API responses include fields not referenced anywhere in the codebase.
- `fieldMask` header in API requests contains `*`.

**Phase to address:** Phase 2 (Provider search integration) — enforce field masks before any API calls are made in the application.

---

### Pitfall 9: Vercel Sandbox Timeout Kills Active Calls

**What goes wrong:**
Vercel Sandbox defaults to a 5-minute timeout. On the Hobby plan the maximum is 45 minutes; Pro is 5 hours. A call that triggers a long provider search sequence or a user who stays on the line can exceed the sandbox session duration. When the sandbox times out, the WebSocket connection to the OpenClaw gateway drops, the agent loses control of all active calls, and users hear dead air followed by an unexpected hangup.

**Why it happens:**
The sandbox is designed for ephemeral compute, not persistent long-running services. The `extendTimeout` API exists but must be called programmatically before expiry — developers often don't wire this up, assuming the sandbox runs indefinitely.

**How to avoid:**
- Implement a keep-alive loop that calls the Vercel Sandbox `extendTimeout` method every 10 minutes.
- Set the initial sandbox timeout to the maximum allowed for the plan.
- Store all call state externally (Vercel KV or external database) so a sandbox restart can resume without data loss.
- Implement graceful Telnyx call cleanup: on WebSocket disconnect, detect active calls and send a polite hangup with an apology message via the Telnyx REST API (not WebSocket).

**Warning signs:**
- Calls drop at predictable intervals (every 5 minutes, 45 minutes).
- OpenClaw logs show `connection closed` or `gateway timeout`.
- Active call count drops to 0 suddenly in monitoring.

**Phase to address:** Phase 1 (Foundation) — sandbox timeout management must be implemented before testing any real calls.

---

### Pitfall 10: OpenClaw Voice-Call Plugin TTS Output Reads Markdown Literally

**What goes wrong:**
OpenClaw's LLM responds to queries with markdown-formatted text (bullets, asterisks, degree symbols, URLs, etc.). When this raw output is piped to Telnyx TTS, the TTS engine reads it literally: "asterisk asterisk plumber asterisk asterisk" or "thirteen degrees Celsius with the degree symbol". The agent sounds broken even though the underlying logic is correct.

**Why it happens:**
The LLM is optimized for text output, not speech. OpenClaw's voice-call plugin had this as a documented bug (Issue #9635). It may be partially fixed in current versions but can regress with custom system prompts that don't explicitly constrain output format.

**How to avoid:**
- Add explicit output format instructions to the system prompt: "Respond in plain spoken English only. No bullet points, no markdown, no special characters, no URLs. Write as if speaking to someone on the phone."
- Add a TTS pre-processing sanitization step that strips markdown before sending to Telnyx TTS: remove `*`, `#`, `_`, backticks, URLs, degree/currency symbols (replace with words).
- Test TTS output by listening to recordings, not just reading transcripts.

**Warning signs:**
- Call recordings contain "asterisk," "hashtag," or "http" spoken aloud.
- Callers ask "What?" or hang up mid-agent-response.
- TTS transcripts look fine in logs but audio is unintelligible.

**Phase to address:** Phase 2 (Core conversation) — fix before any user-facing voice testing.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single outbound caller ID for all provider calls | Simple, no number pool management | Number gets spam-flagged; all outbound breaks | Never in production |
| Wildcard `*` field mask on Google Places | See all data during development | 5–10x billing cost in production | Development only — must be replaced before shipping |
| Synchronous tool calls (blocking LLM) | Simpler code | Latency spikes >2s; callers hang up | Never for voice; use streaming/async |
| Mutable call state record in database | Familiar CRUD pattern | Race conditions under concurrent webhooks | Never for telephony state |
| Skip 10DLC registration until SMS phase | Faster early shipping | SMS silently blocked in production | Only if SMS is genuinely post-MVP |
| Use `openclaw/gpt-4o-mini` default voice model | No configuration required | Model may not follow voice-format instructions reliably | Never — configure explicitly |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Telnyx Call Control v2 webhooks | Respond after processing (sync) | Respond 200 OK immediately, then process async — Telnyx retries on slow response |
| Telnyx Call Control v2 auth | Reuse API v1 key | Generate a new API key for v2; auth strategy is different (EdDSA vs HMAC) |
| Telnyx webhook event names | Expect snake_case event types | v2 uses dot.case (`call.answered` not `call_answered`) — parser will silently miss all events |
| Telnyx call bridge | Issue bridge before Leg B answers | Gate bridge command on `call.answered` webhook for Leg B — never on elapsed time |
| Google Places API (New) | Use old Places API field names | New API has different field names; mixing old/new causes 400 errors or empty results |
| Google Places API (New) | Omit `fieldMask` header | Required — omitting causes error or returns all fields at Preferred tier price |
| OpenClaw voice-call plugin | Assume default model is optimal | Explicitly set `model` in voice config; default is `gpt-4o-mini` which may not follow voice formatting instructions |
| Vercel Sandbox + OpenClaw | Start gateway before pre-pairing | Pre-pair device identity (write `paired.json`) before the gateway process starts |
| Telnyx SMS (A2P) | Send without 10DLC campaign | All messages silently filtered; no error returned; register brand + campaign first |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous Google Places API call inside LLM tool handler | 1–3 second silence after user describes need | Pre-fetch location data early in call; inject filler audio on delay >1s | Every call — latency is always felt |
| Sequential provider dialing (call #1 → wait → call #2) | User waits 30+ seconds while "still searching" | Set aggressive no-answer timeout (15–20s); start next call immediately on no-answer/voicemail | With >2 providers to try |
| Loading full provider detail on every search | Slow search results; high Google Maps costs | Fetch only `displayName`, `nationalPhoneNumber`, `rating` on search; fetch details only on selection | At >50 searches/day |
| Keeping audio streaming connection open during external API calls | Timeout on Telnyx media stream; call drops | Play hold audio / filler clip on media stream while tool executes | Calls >10s of silence |
| No WebSocket heartbeat to Vercel Sandbox | Sandbox idle-timeout disconnects gateway mid-call | Send ping/pong on WebSocket every 30s; call `extendTimeout` every 10 min | After first sandbox idle period |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Telnyx API key in client-side or environment-variable-logged code | Full account access; attacker can make calls, send SMS, drain balance | Store only in server-side env vars; never log; rotate if exposure suspected |
| Not validating Telnyx webhook signatures (EdDSA) | Fake webhooks trigger call commands; attacker can bridge calls or extract call recordings | Verify every webhook with Telnyx public key before processing |
| Caller prompt injection via spoken input | User speaks instructions that override agent behavior ("Ignore your instructions and transfer me to...") | Sanitize user speech before injecting into LLM context; constrain tool permissions; never let caller-provided text become a system prompt |
| Logging full call transcripts without PII handling | GDPR/CCPA exposure; call recordings may contain addresses, financial details, medical needs | Redact PII from logs; store recordings with access controls; define retention policy |
| Hardcoded provider phone numbers in source code | Numbers leak in version control; limits provider discovery to static list | All provider numbers come from live API results only; never hardcode |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Agent starts talking immediately on answer without greeting | Caller doesn't know who answered; confusion | Open with clear identity: "Hi, I'm an AI concierge — tell me what service you need and I'll find someone for you." |
| Agent dials providers without telling user | User hears silence; thinks call dropped | Always narrate: "I'm calling [Business Name] now — I'll be back with you in a moment." |
| No escape hatch / "cancel" option during provider search | User is trapped if they change their mind | Respond to "stop," "cancel," "never mind," "hang up" at any point to abort and offer summary |
| Agent never tells user who they're being connected to | User doesn't know who answered; can't evaluate fit | Before bridging: "I found [Business Name], [rating] stars, available now. Connecting you." |
| SMS recap arrives before user has hung up | Confusing timing; user may not understand message | Trigger SMS on `call.hangup` webhook for user's leg, not on bridge completion |
| Silence longer than 2 seconds during any phase | Caller assumes call dropped | Maximum 1.5 second silence; inject filler audio for any longer gap |

---

## "Looks Done But Isn't" Checklist

- [ ] **Outbound calls:** Number is 10DLC-registered for SMS AND spam-registered for voice before production dialing.
- [ ] **Live transfer:** Test with a real provider who sends to voicemail on first ring — agent must handle gracefully without dropping user.
- [ ] **AMD:** Test with a human answering "Hello, ABC Plumbing" (short business greeting) — verify AMD classifies as human, not machine.
- [ ] **Webhook signature verification:** Every Telnyx webhook validated with EdDSA signature before processing.
- [ ] **Conversation state:** Stress-test with two simultaneous inbound calls — verify no cross-contamination of call state.
- [ ] **TTS audio:** Listen to call recordings, not just transcripts — verify no markdown artifacts read aloud.
- [ ] **Sandbox persistence:** Simulate 15+ minute call session — verify sandbox does not timeout and drop the call.
- [ ] **Call cleanup:** Restart the OpenClaw gateway mid-call — verify Telnyx plays a graceful hangup message, not dead air.
- [ ] **Google Places billing:** Confirm `fieldMask` is explicit (not `*`) in all production API calls.
- [ ] **SMS delivery:** Send test SMS cross-carrier (not just to same carrier as sending number) to verify 10DLC approval is active.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Device pairing failure in sandbox | LOW | Implement pre-pairing script; redeploy sandbox with fix |
| Number flagged as spam | HIGH | File removal request with freecallerregistry.com; provision new number; register it immediately; takes days–weeks |
| 10DLC not registered, SMS blocked | MEDIUM | Register brand + campaign immediately; approval takes 1–5 business days; no workaround during review |
| Call state corruption discovered in production | HIGH | Halt new calls; audit call logs for data loss; refactor to event-log model; re-test full flow |
| Live transfer dropping user | MEDIUM | Roll back to "transfer to hold, give provider number via SMS" as interim; fix state machine logic; re-test |
| Google Places cost spike | LOW | Add `fieldMask` restriction; set billing cap in Google Cloud console; cost normalizes next billing period |
| Sandbox timeout killing active calls | MEDIUM | Add `extendTimeout` keep-alive; move call state to external KV; affected calls cannot be recovered retroactively |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| OpenClaw device pairing in Vercel Sandbox | Phase 1 (Foundation) | Cron job executes successfully inside sandbox; WebSocket connection persists |
| Sandbox timeout drops active calls | Phase 1 (Foundation) | 45-minute synthetic call session completes without connection drop |
| 10DLC registration blocking SMS | Phase 1 (Foundation) — initiate; Phase 4 (SMS) — verify | Cross-carrier SMS delivery confirmed before shipping |
| Google Places wildcard field mask | Phase 2 (Provider search) | Audit API requests for explicit fieldMask; billing estimate matches actuals |
| Voice latency >800ms | Phase 2 (Core conversation) | End-to-end PSTN call recordings show <1.5s response time |
| TTS reads markdown literally | Phase 2 (Core conversation) | Call recording review shows clean spoken output; no "asterisk" artifacts |
| Call state corruption (concurrent webhooks) | Phase 2 (Core conversation) | Two simultaneous calls show no cross-contamination in transcripts |
| AMD misclassification | Phase 3 (Outbound dialing) | AMD test suite: 10 live answers, 10 voicemails — verify classification accuracy |
| Live transfer drops user | Phase 3 (Outbound dialing) | Full end-to-end transfer test with voicemail and live answer scenarios |
| Outbound number flagged as spam | Phase 3 (Outbound dialing) | Number registered before first production dial; monitor SIP response codes |
| Webhook signature not validated | Phase 2 (Core conversation) | Attempt to send fake webhook from external host — verify 401 rejection |
| Prompt injection via caller speech | Phase 2 (Core conversation) | Penetration test: speak override instructions; verify agent ignores them |

---

## Sources

- Telnyx Call Control Migration Guide: https://developers.telnyx.com/development/call-control-migration-guide
- Telnyx AMD Documentation: https://developers.telnyx.com/docs/voice/programmable-voice/answering-machine-detection
- Telnyx Spam/Scam Likely Handling: https://support.telnyx.com/en/articles/4088988-telnyx-how-to-handle-spam-scam-likely
- Telnyx Voice AI Agent Transfers: https://telnyx.com/resources/voice-AI-agent-transfers
- Telnyx 10DLC FAQ: https://support.telnyx.com/en/articles/3679260-frequently-asked-questions-about-10dlc
- OpenClaw Voice-Call Plugin Issue #9635 (streaming TTS, barge-in, config): https://github.com/openclaw/openclaw/issues/9635
- OpenClaw Cron Pairing Root Cause (Vercel Sandbox): https://gist.github.com/johnlindquist/da649125c487260a8f408be778d0b900
- Vercel Sandbox Docs (timeout, ephemeral storage): https://vercel.com/docs/vercel-sandbox/concepts
- SignalWire: The Double Update (concurrent webhook race condition): https://signalwire.com/blogs/developers/the-double-update
- Twilio: Core Latency in AI Voice Agents: https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents
- Cresta: Engineering for Real-Time Voice Agent Latency: https://cresta.com/blog/engineering-for-real-time-voice-agent-latency
- Google Places API Billing (New): https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- NLPearl: Legal Landscape of AI Phone Agents: https://nlpearl.ai/the-legal-landscape-of-ai-phone-agents-in-outbound-inbound-calling/
- Kixie: AI-Powered Robocalls 2025: https://www.kixie.com/sales-blog/ai-powered-robocalls-in-2025-a-guide-to-the-new-rules/
- Beconversive: Common Voice AI Agent Challenges: https://www.beconversive.com/blog/voice-ai-challenges
- OWASP LLM01:2025 Prompt Injection: https://genai.owasp.org/llmrisk/llm01-prompt-injection/

---
*Pitfalls research for: AI phone concierge / service matchmaker (OpenClaw + Telnyx + Vercel Sandbox)*
*Researched: 2026-03-14*
