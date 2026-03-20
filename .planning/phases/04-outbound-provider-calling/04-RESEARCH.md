# Phase 4: Outbound Provider Calling - Research

**Researched:** 2026-03-16
**Domain:** Telnyx Call Control v2 — dual-leg outbound calling, AMD, cascading dispatch
**Confidence:** HIGH

## Summary

Phase 4 replaces the stub `callProvider()` in `dispatch.ts` with a real dual-leg telephony implementation. The agent must simultaneously hold the inbound user call and dial providers sequentially, narrating status updates to the user between attempts.

The architecture is a **manual bridge pattern**: (1) user leg stays parked with periodic TTS narration, (2) agent dials provider outbound using `calls.dial()`, (3) on the outbound `call.answered` event the webhook encodes the user's `callControlId` in `client_state` so the bridge command can be issued from Phase 5, (4) on `call.hangup` with `hangup_cause: timeout` or `user_busy`, the cascade loop increments `currentProviderIndex` and retries. AMD (`answering_machine_detection: 'detect_words'`) is the discrete strategy: when the `call.machine.detection.ended` webhook fires with `result: machine`, hang up the provider leg and move to next. SMS pre-notification uses `client.messages.send()` which exists already in the Telnyx SDK used by the project.

**Primary recommendation:** Implement outbound dispatch as a standalone `src/lib/voice/outbound-caller.ts` module that manages the cascade loop, AMD handling, and narration scheduling — keeping `dispatch.ts` as a thin handler that calls into it.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Provider Answer Timeout:** 25 seconds (~5 rings) per provider — CONTEXT.md locks this at 25s, overriding the 30s already in `PROVIDER_RING_TIMEOUT_MS` in `voice-config.ts`. The constant must be updated.
- **AI Identification:** Agent must identify itself as an AI concierge on EVERY outbound call before any other information (legal: CA SB-1001, FCC rules).
- **Cascade Limit:** Maximum 4 providers before declaring no match.
- **User Narration:** Live verbal status updates every 15-20 seconds while calling providers. User hears provider name when dialing starts ("Calling Acme Plumbing now"). User hears outcome narration ("They weren't available, trying the next one").

### Claude's Discretion
- Voicemail detection strategy (AMD vs keyword-based)
- SMS pre-notification message content and timing
- Provider conversation flow (how to check availability)
- Dual-leg call architecture (how to maintain user leg while dialing provider leg)

### Deferred Ideas (OUT OF SCOPE)
- Voicemail message leaving (just skip to next provider for v1)
- Provider callback scheduling
- Multi-language provider conversations
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CALL-01 | Agent calls providers starting from the best-ranked match | `callProvider()` stub in `dispatch.ts` → replaced with `calls.dial()` cascade |
| CALL-02 | Agent identifies itself as AI on outbound calls (legal compliance) | First TTS utterance on provider leg: AI identity before any other content |
| CALL-03 | Agent gives live verbal updates to user while calling providers | Narration loop via `setTimeout` + `speak()` on inbound `callControlId` every 15-20s |
| CALL-04 | Agent sends SMS pre-notification to provider before/during call | `client.messages.send()` Telnyx SDK — fires before `calls.dial()` |
| CALL-05 | Agent handles answering machines and busy signals, moves to next provider | AMD `detect_words` + `call.machine.detection.ended`; `call.hangup` with `hangup_cause: timeout/user_busy` |
| CALL-06 | Agent confirms provider availability before attempting transfer | Provider hears the request and verbally confirms; transcript parsed for yes/no |
| CALL-07 | Agent cascades through ranked providers if first match is unavailable | `currentProviderIndex` incremented in `CallState`, loop retries up to cascade limit 4 |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| telnyx (Node SDK) | ^6.13.0 (already installed) | Outbound dial, AMD, SMS | Already used for inbound; v6 is current |
| vitest | ^4.1.0 (already installed) | Unit + integration tests | Project standard |

No new npm packages are needed. All telephony and SMS capability lives in the existing `telnyx` SDK.

**Verified version:**
```bash
# Already locked in package.json
telnyx: ^6.13.0
```

### Telnyx SDK Method Inventory (v6, verified against codebase)

| Method | Purpose |
|--------|---------|
| `client.calls.dial(params)` | Initiate outbound provider leg |
| `client.calls.actions.speak(callControlId, params)` | TTS to user or provider leg |
| `client.calls.actions.hangup(callControlId, {})` | Hang up provider leg on no-match |
| `client.calls.actions.bridge(callControlId, params)` | Bridge user ↔ provider (Phase 5) |
| `client.messages.send(params)` | SMS pre-notification to provider |

Note: The project already uses `calls.actions.speak` and `calls.actions.hangup` in `webhooks.ts`. The `calls.dial()` method is at the top level (not under `calls.actions`), consistent with the Telnyx Node SDK v6 API structure.

---

## Architecture Patterns

### Recommended Project Structure Addition

```
src/lib/voice/
├── outbound-caller.ts   # NEW — cascade loop, narration timer, AMD handling
└── dispatch.ts          # REPLACE stub — thin wrapper calling outbound-caller
```

No structural changes to `webhooks.ts` beyond adding new stage values and hooking `startOutboundCascade()` after `stage: 'complete'` (when providers narrated and user confirms).

### Pattern 1: Dual-Leg Call Architecture (Manual Bridge)

**What:** Inbound user leg stays alive with periodic TTS narration while the agent dials provider legs sequentially. Each provider leg gets its own `callControlId`. The inbound `callControlId` is encoded into the outbound leg's `client_state` for retrieval in Phase 5 bridge.

**When to use:** Anytime the agent needs to call a third party while keeping the original caller connected.

**Pattern (verified from Telnyx demo-findme-ivr and official docs):**

```typescript
// Source: Telnyx demo-findme-ivr + developers.telnyx.com/api/call-control/dial-call

// Step 1 — Encode user's callControlId into provider leg client_state
const clientState = Buffer.from(JSON.stringify({
  stage: 'provider-dial',
  userCallControlId: userCallControlId,   // inbound user leg
  providerName: provider.name,
  providerIndex: index,
})).toString('base64');

// Step 2 — Dial the provider
const dialResponse = await getTelnyxClient().calls.dial({
  connection_id: process.env.TELNYX_CONNECTION_ID!,
  from: process.env.TELNYX_PHONE_NUMBER!,
  to: provider.phone,
  timeout_secs: 25,                        // Locked: 25s per CONTEXT.md
  answering_machine_detection: 'detect_words',
  client_state: clientState,
});

// The provider leg gets its own callControlId in dialResponse.data.call_control_id
```

### Pattern 2: Cascade Loop with State Machine Extension

**What:** `CallState.stage` gains new values: `'calling'` for the dispatch phase, with `currentProviderIndex` tracking which provider is being attempted.

**New stage values to add to `call-state.ts`:**
```typescript
stage: 'greeting' | 'name_capture' | 'intake' | 'consent' | 'searching' | 'calling' | 'complete'
```

**Cascade logic:**
```typescript
// Source: project pattern established in call-state.ts
async function tryNextProvider(userCallControlId: string): Promise<void> {
  const state = getCall(userCallControlId);
  if (!state) return;

  const idx = state.currentProviderIndex;
  if (idx >= MAX_CASCADE_PROVIDERS || idx >= state.providers.length) {
    // All providers exhausted
    await speak(userCallControlId, NO_MATCH_MESSAGE);
    updateCall(userCallControlId, { stage: 'complete' });
    return;
  }

  const provider = state.providers[idx];
  await speak(userCallControlId, `Calling ${provider.name} now — one moment.`);

  // Optional: SMS pre-notification
  await sendProviderSms(provider, state);

  // Dial outbound leg
  await dialProvider(userCallControlId, provider, idx);
}
```

### Pattern 3: AMD Strategy — detect_words

**What:** `answering_machine_detection: 'detect_words'` instructs Telnyx's algorithm to classify the answer as human or machine based on word count from the callee's opening utterance.

**Webhook events received:**
- `call.machine.detection.ended` — fired when Telnyx classifies the answer; payload includes `result: 'human' | 'machine' | 'not_sure'`
- No separate event for voicemail greeting end unless `'greeting_end'` mode is used (unnecessary for v1 — just move to next provider)

**Handling:**
```typescript
// Source: Telnyx AMD docs + demo-amd GitHub
case 'call.machine.detection.ended': {
  const result = payload.result; // 'human' | 'machine' | 'not_sure'
  const clientState = JSON.parse(Buffer.from(payload.client_state, 'base64').toString());

  if (result === 'machine') {
    // Hang up provider leg, cascade to next
    await getTelnyxClient().calls.actions.hangup(callControlId, {});
    await incrementAndRetry(clientState.userCallControlId);
  }
  // If 'human' or 'not_sure' — agent script continues on provider leg
  break;
}
```

### Pattern 4: No-Answer and Busy Handling

**What:** `call.hangup` fires on the provider leg with `hangup_cause` indicating why the call ended.

**Verified `hangup_cause` values:**
| Value | Meaning | Action |
|-------|---------|--------|
| `timeout` | Ring timeout exceeded (25s) | Cascade to next |
| `no_answer` | No answer variant | Cascade to next |
| `user_busy` | Line busy | Cascade to next |
| `normal_clearing` | Provider or user hung up intentionally | Depends on stage |
| `originator_cancel` | Agent hung up the provider leg | Normal after AMD machine |

**Handling in webhook switch:**
```typescript
case 'call.hangup': {
  const direction = payload.direction;  // 'outgoing' = provider leg
  if (direction === 'outgoing') {
    const cause = payload.hangup_cause;
    const clientState = decodeClientState(payload.client_state);
    if (['timeout', 'no_answer', 'user_busy'].includes(cause)) {
      await incrementAndRetry(clientState.userCallControlId);
    }
  }
  // inbound hangup handled as before
}
```

### Pattern 5: User Narration Timer

**What:** While provider leg is ringing, a `setTimeout`-based loop speaks status updates to the user every 15-20 seconds (per locked decision). Stops when provider answers or cascade exhausts.

```typescript
// Source: project pattern from filler.ts
function startNarrationTimer(userCallControlId: string, providerName: string): { stop: () => void } {
  let count = 0;
  const NARRATION_INTERVAL_MS = 17_000; // 17s — within 15-20s window

  const phrases = [
    `Still waiting for ${providerName} to pick up...`,
    `Hang tight — still ringing ${providerName}.`,
  ];

  const timer = setInterval(async () => {
    const text = phrases[count % phrases.length];
    count++;
    try {
      await speak(userCallControlId, text);
    } catch (_) { /* call may have ended */ }
  }, NARRATION_INTERVAL_MS);

  return { stop: () => clearInterval(timer) };
}
```

### Pattern 6: SMS Pre-Notification

**What:** SMS to provider phone before/during dial to signal legitimate customer interest and prime them to answer. Sent via `client.messages.send()`.

```typescript
// Source: Telnyx Node SDK docs — developers.telnyx.com/docs/messaging/messages/send-message
await getTelnyxClient().messages.send({
  from: process.env.TELNYX_PHONE_NUMBER!,
  to: provider.phone,
  text: `Incoming call from an AI concierge on behalf of a customer needing ${serviceType} in ${location}. Please answer — we're calling now.`,
});
```

**Timing:** Fire SMS immediately before `calls.dial()`. The SMS arrives seconds before the ring, priming the provider to answer.

### Anti-Patterns to Avoid

- **Re-entering the cascade from transcript events:** Stage gate `if (state.stage === 'calling') break;` must be added to `call.transcription` handler in `webhooks.ts` — without it, late transcriptions from the user will re-trigger logic.
- **Using `bridge_on_answer` for Phase 4:** The `bridge_on_answer`/`link_to` Telnyx dial parameter auto-bridges immediately on answer — this bypasses the provider availability confirmation conversation (CALL-06 requires Murphy to confirm availability before transferring). Use the manual bridge pattern instead.
- **Assuming `hangup_cause` is always present:** When the agent explicitly hangs up via `calls.actions.hangup()`, `normal_clearing` fires. Guard against treating agent-initiated hangups as cascade triggers.
- **Sharing a narration timer handle globally:** Store narration timer handles in a module-level `Map<string, { stop: () => void }>` keyed by `userCallControlId`, same pattern as `_fillerLoops` in `webhooks.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Voicemail/machine detection | Keyword regex on transcriptions | `answering_machine_detection: 'detect_words'` in `calls.dial()` | Telnyx AMD is trained on millions of calls; keyword detection misses hold music, IVR, accent variation |
| SMS delivery | Direct HTTP to carrier | `getTelnyxClient().messages.send()` | 10DLC registration already done (Phase 1); carrier routing, delivery receipts handled by Telnyx |
| Call timeout enforcement | `setTimeout` + hangup in application | `timeout_secs: 25` in `calls.dial()` | Telnyx enforces timeout server-side even if Node process is slow; no timer cleanup needed |
| Outbound call leg identity | Separate state store | `client_state` (base64 JSON) on the dial request | Telnyx passes `client_state` back on every webhook for the leg — no Redis/DB needed |

**Key insight:** Telnyx Call Control v2 was purpose-built for exactly this dispatch pattern. Every feature needed (AMD, per-leg state, timeout, SMS) is a first-class API parameter.

---

## Common Pitfalls

### Pitfall 1: `PROVIDER_RING_TIMEOUT_MS` vs Locked 25s Decision

**What goes wrong:** `voice-config.ts` currently has `PROVIDER_RING_TIMEOUT_MS = 30_000` (30 seconds). CONTEXT.md locks the timeout at 25 seconds.

**Why it happens:** The constant was added as a stub placeholder in an earlier phase.

**How to avoid:** Update `PROVIDER_RING_TIMEOUT_MS` to `25_000` in Wave 0. This is a single-line change but must happen before any outbound dial code ships, or the timeout will be wrong.

**Warning signs:** Tests using `PROVIDER_RING_TIMEOUT_MS` will pass at wrong value.

### Pitfall 2: Inbound vs Outbound `call.hangup` Disambiguation

**What goes wrong:** The webhook handler has one `case 'call.hangup'` block. Provider leg hangups will fire the same event as inbound user hangups. Without disambiguation, the cascade loop will run when the user hangs up, causing null-state errors.

**Why it happens:** Telnyx sends `call.hangup` for every leg.

**How to avoid:** Check `payload.direction`:
- `direction === 'outgoing'` + `client_state` has `stage: 'provider-dial'` → provider leg cascade logic
- `direction === 'incoming'` → existing inbound hangup cleanup logic

**Warning signs:** `getCall(callControlId)` returns `undefined` on provider leg hangup (because the inbound `callControlId` is different from the outbound one).

### Pitfall 3: `call.initiated` Firing for Provider Outbound Leg

**What goes wrong:** The outbound dial fires `call.initiated` with `direction: 'outgoing'`. The existing handler answers it like an inbound call.

**Why it happens:** The current `case 'call.initiated'` in `webhooks.ts` calls `calls.actions.answer()` unconditionally.

**How to avoid:** Add direction guard:
```typescript
case 'call.initiated': {
  const direction = (payload as any).direction;
  if (direction === 'incoming') {
    await getTelnyxClient().calls.actions.answer(callControlId, { ... });
  }
  // outgoing legs: no auto-answer needed
  break;
}
```

### Pitfall 4: Speaking on a Hung-Up Provider Leg

**What goes wrong:** After AMD detects a machine and the agent hangs up the provider leg, a race condition can cause `calls.actions.speak()` to be called on the now-dead provider `callControlId`, throwing an error.

**Why it happens:** The `call.machine.detection.ended` and `call.hangup` events may arrive close together, and async handlers can interleave.

**How to avoid:** Wrap all `speak()` calls on the provider leg in try/catch. Log and discard errors from dead legs — do not re-throw.

### Pitfall 5: Stage Gate Missing for `calling` Stage

**What goes wrong:** User speaks while provider leg is ringing; the transcription event re-triggers the consent or intake logic.

**How to avoid:** Add `'calling'` to the stage gate at the top of `call.transcription`:
```typescript
if (['searching', 'calling', 'complete'].includes(state.stage)) {
  console.log(`[webhooks] Ignoring transcript — stage is ${state.stage}`);
  break;
}
```

### Pitfall 6: Telnyx `calls.dial()` Requires `connection_id`

**What goes wrong:** Missing `connection_id` causes a Telnyx API 422 error.

**Why it happens:** `connection_id` is the Telnyx Call Control Application ID (not the call control ID of the inbound leg). It is the same connection configured for inbound webhooks.

**How to avoid:** Store `TELNYX_CONNECTION_ID` as an environment variable (should be added to `.env.example`). Retrieve in `outbound-caller.ts`.

---

## Code Examples

### Full `calls.dial()` with AMD

```typescript
// Source: developers.telnyx.com/api-reference/call-commands/dial + Telnyx Node SDK

const dialResponse = await getTelnyxClient().calls.dial({
  connection_id: process.env.TELNYX_CONNECTION_ID!,
  from: process.env.TELNYX_PHONE_NUMBER!,
  to: provider.phone,                         // E.164 format from Provider.phone
  timeout_secs: 25,                           // CONTEXT.md locked: 25s
  answering_machine_detection: 'detect_words',
  client_state: Buffer.from(JSON.stringify({
    stage: 'provider-dial',
    userCallControlId,
    providerName: provider.name,
    providerIndex,
  })).toString('base64'),
});
```

### Decode `client_state` in Webhook Handler

```typescript
// Source: project pattern — base64 JSON client_state established in webhooks.ts

function decodeClientState(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return {};
  }
}
```

### SMS Pre-Notification

```typescript
// Source: developers.telnyx.com/docs/messaging/messages/send-message?lang=node

await getTelnyxClient().messages.send({
  from: process.env.TELNYX_PHONE_NUMBER!,
  to: provider.phone,
  text: `Incoming call from an AI concierge — a customer needs ${serviceType} near ${location}. Answering now connects you directly.`,
});
```

### Provider Identification Script (AI Disclosure — CA SB-1001 / FCC)

```typescript
// Legal requirement: must be FIRST utterance before any service request
const AI_INTRO = (providerName: string, serviceType: string, location: string) =>
  `Hi, this is an AI concierge calling on behalf of a customer. ` +
  `I'm an automated assistant — not a human. ` +
  `I have a customer who needs ${serviceType} near ${location}. ` +
  `Are you available to take this job today?`;
```

### Provider Availability Confirmation Parsing

```typescript
// Parse provider's verbal response for availability confirmation (CALL-06)
const AVAILABLE_YES = /\b(yes|yeah|sure|absolutely|can do|available|of course|go ahead)\b/i;
const AVAILABLE_NO  = /\b(no|not|busy|unavailable|can't|cannot|closed|full)\b/i;

function parseAvailability(transcript: string): 'available' | 'unavailable' | 'unclear' {
  if (AVAILABLE_YES.test(transcript)) return 'available';
  if (AVAILABLE_NO.test(transcript)) return 'unavailable';
  return 'unclear'; // treat as unavailable, cascade
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `callProvider()` stub returns fake status | Real `calls.dial()` with AMD and cascade | Phase 4 | End-to-end dispatch becomes live |
| `PROVIDER_RING_TIMEOUT_MS = 30_000` | Must change to `25_000` per locked decision | Phase 4 Wave 0 | Consistent with UX decision |
| No outbound call handling in webhooks.ts | New cases: `call.machine.detection.ended`, outbound `call.initiated`, outbound `call.hangup` | Phase 4 | Webhook handler grows by ~80 lines |

**Deprecated/outdated:**
- `dispatch.ts` stub implementation: replaced entirely in Phase 4
- `sms.ts` stub: partially real-ified for SMS pre-notification; full implementation in Phase 6

---

## Open Questions

1. **`TELNYX_CONNECTION_ID` env var availability**
   - What we know: `calls.dial()` requires `connection_id` = the Call Control App ID
   - What's unclear: Whether this env var is already set in the project or needs to be added
   - Recommendation: Wave 0 task must verify `.env.example` has `TELNYX_CONNECTION_ID` and add if missing

2. **Provider STT on outbound leg**
   - What we know: The agent needs to hear the provider's verbal availability confirmation (CALL-06)
   - What's unclear: Whether `calls.actions.startTranscription()` must be called on the outbound leg after provider answers, or if there is a simpler approach (short DTMF or timeout)
   - Recommendation: Start transcription on the outbound provider leg after `call.answered` fires; use the same `TELNYX_STT_CONFIG` already in `voice-config.ts`. Use the `call.transcription` event with direction check to parse provider response.

3. **From number for outbound dial**
   - What we know: `from` in `calls.dial()` must be the Telnyx number associated with the connection
   - What's unclear: Whether using the same `TELNYX_PHONE_NUMBER` for both inbound and outbound causes issues with two simultaneous active calls on one DID
   - Recommendation: Telnyx Call Control supports multiple concurrent calls per number — this is expected behavior; verify with a live test in Wave 1.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run src/lib/voice/outbound-caller.test.ts tests/lib/tools/registry.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CALL-01 | `dialProvider()` calls `calls.dial()` with correct params | unit | `npx vitest run src/lib/voice/outbound-caller.test.ts` | ❌ Wave 0 |
| CALL-02 | Provider TTS first utterance contains AI disclosure text | unit | `npx vitest run src/lib/voice/outbound-caller.test.ts` | ❌ Wave 0 |
| CALL-03 | Narration timer fires between 15-20s interval | unit | `npx vitest run src/lib/voice/outbound-caller.test.ts` | ❌ Wave 0 |
| CALL-04 | `messages.send()` called with correct to/from/text before dial | unit | `npx vitest run src/lib/voice/outbound-caller.test.ts` | ❌ Wave 0 |
| CALL-05 | `call.machine.detection.ended` with result=machine triggers cascade | unit | `npx vitest run src/lib/voice/outbound-caller.test.ts` | ❌ Wave 0 |
| CALL-05 | `call.hangup` with `hangup_cause: timeout` triggers cascade | unit | `npx vitest run src/lib/voice/outbound-caller.test.ts` | ❌ Wave 0 |
| CALL-06 | Provider transcript "yes" → `'available'`, "no" → `'unavailable'` | unit | `npx vitest run src/lib/voice/outbound-caller.test.ts` | ❌ Wave 0 |
| CALL-07 | Cascade stops after 4 providers with no-match message | unit | `npx vitest run src/lib/voice/outbound-caller.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/voice/outbound-caller.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/voice/outbound-caller.test.ts` — covers CALL-01 through CALL-07
- [ ] `TELNYX_CONNECTION_ID` added to `.env.example`
- [ ] `PROVIDER_RING_TIMEOUT_MS` updated to `25_000` in `voice-config.ts`
- [ ] New stage `'calling'` added to `CallState.stage` union in `call-state.ts`

---

## Sources

### Primary (HIGH confidence)
- Telnyx Call Control Dial API — `developers.telnyx.com/api-reference/call-commands/dial` — dial params, AMD options, timeout_secs, client_state
- Telnyx Bridge API — `developers.telnyx.com/api-reference/call-commands/bridge-calls` — bridge params, `call.bridged` events
- Telnyx Node SDK docs — `developers.telnyx.com/docs/messaging/messages/send-message?lang=node` — `client.messages.send()` signature
- Existing codebase — `src/api/webhooks.ts`, `src/lib/voice/call-state.ts`, `src/lib/voice/voice-config.ts`, `src/lib/tools/handlers/dispatch.ts` — patterns and constants verified by reading files directly

### Secondary (MEDIUM confidence)
- Telnyx demo-findme-ivr — `github.com/team-telnyx/demo-findme-ivr` — bridge pattern via `client_state` (manual bridge, not `bridge_on_answer`)
- Telnyx Call Webhooks docs — `preview.redoc.ly/.../call-webhooks/` — `hangup_cause` values: `timeout`, `no_answer`, `user_busy`, `normal_clearing`
- Telnyx AMD announcement + docs — `telnyx.com/release-notes/amd-is-live-on-telnyx`, `developers.telnyx.com/docs/voice/programmable-voice/texml-answering-machine` — AMD strategy `detect_words`, `call.machine.detection.ended` event

### Tertiary (LOW confidence)
- WebSearch synthesis on `bridge_on_answer` / `link_to` parameters — described in search results but not directly verified in official API spec; confirmed NOT to use this for Phase 4 (bypasses CALL-06 availability confirmation)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — telnyx SDK v6 already in project, `calls.dial()` verified against official docs
- Architecture: HIGH — dual-leg bridge pattern verified from official demo + bridge API docs
- AMD strategy: MEDIUM-HIGH — `detect_words` and `call.machine.detection.ended` confirmed from AMD docs and release notes
- Pitfalls: HIGH — direction disambiguation, stage gate, and `connection_id` requirement all verified against real code and API docs
- `hangup_cause` values: MEDIUM — multiple sources confirm `timeout`, `user_busy`; `no_answer` confirmed from webhooks docs

**Research date:** 2026-03-16
**Valid until:** 2026-04-15 (Telnyx Call Control v2 API is stable; AMD feature confirmed shipping)
