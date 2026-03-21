# Phase 5: Live Call Transfer - Research

**Researched:** 2026-03-20
**Domain:** Telnyx Call Control v2 — conference bridge, warm transfer, three-leg call architecture
**Confidence:** HIGH (core bridge API verified from official Telnyx docs + existing codebase analysis)

---

## Summary

Phase 5 implements the live warm transfer — the culmination of the OpenClaw call flow. After Phase 4 confirmed provider availability via transcript parsing, the code already has a `// Phase 5 will handle the actual bridge` comment in webhooks.ts at line 205. The stub `transferCall` function in dispatch.ts is also marked "Real implementation in Phase 5."

The Telnyx Call Control v2 bridge API connects two call-control legs directly. When the agent bridges the user leg (`userCallControlId`) with the provider leg (`providerCallControlId`), audio flows directly between the two parties. The agent (which holds neither call leg) can then hang up the provider leg (which it initiated) after the bridge event fires, leaving user and provider connected via the user's inbound call leg. The `call.bridged` event fires for both legs on success.

The bridge failure scenario (provider leg drops during or after bridging) is handled via the existing `call.hangup` event for the outbound provider leg, with `hangup_cause: 'normal_clearing'`. The current code explicitly excludes `normal_clearing` from the cascade — Phase 5 must distinguish a pre-bridge hangup (cascade) from a post-bridge hangup (already transferred, do not cascade) using a `transferred` flag in CallState.

**Primary recommendation:** Use `calls.actions.bridge(providerCallControlId, { call_control_id: userCallControlId })` after the agent speaks the brief to the provider; handle `call.bridged` to confirm the bridge; set `stage: 'transferred'` in CallState; treat post-bridge provider hangup as a transfer failure, not a cascade trigger.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| XFER-01 | Agent performs live warm transfer — patches user through to available provider | Telnyx `calls.actions.bridge` API bridges two call-control legs; existing `providerCallControlId` in CallState is the target leg |
| XFER-02 | Agent briefs provider before merging: service needed, user name, location | Implemented via `speak(providerCallControlId, briefText)` before calling bridge; `speak.ended` event on provider leg signals brief complete, then bridge fires |
| XFER-03 | Agent exits call cleanly after successful transfer | After `call.bridged` event fires, agent hangs up the provider leg (it holds no user leg — user stays connected); agent sets stage='transferred' |
| XFER-04 | Agent handles transfer failure gracefully (provider drops, no answer) and retries next provider | `call.hangup` with `normal_clearing` on provider leg after bridge = transfer failure; agent speaks to user, increments index, calls `tryNextProvider` |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| telnyx (SDK) | installed (v6) | `calls.actions.bridge`, `calls.actions.hangup`, `calls.actions.speak` | Already in use; verified Telnyx Node SDK v6 API shape |

No new dependencies required for Phase 5. All needed APIs are in the existing Telnyx Node SDK.

**Version verification:** `telnyx` package is already installed and in active use throughout the codebase.

---

## Architecture Patterns

### Current Phase 4 Handoff Point

When a provider confirms availability, the current code in `webhooks.ts` (`call.transcription` handler, provider-leg branch) executes:

```typescript
// Phase 5 will handle the actual bridge
stopNarrationTimer(userCcid);
await speak(userCcid, `Great news — ${providerName} is available! I'm going to connect you now.`);
updateCall(userCcid, { stage: 'complete', currentProviderIndex: providerIndex });
```

Phase 5 replaces the `stage: 'complete'` assignment with the warm transfer flow.

### Recommended Project Structure

No new directories needed. Phase 5 adds:
```
src/
├── lib/voice/
│   ├── outbound-caller.ts         # Add: bridgeToUser(), handleTransferFailure()
│   └── outbound-caller.test.ts    # Add: bridge tests, transfer failure tests
└── api/
    └── webhooks.ts                # Update: provider availability branch, call.bridged handler, hangup guard
```

### Pattern 1: Warm Transfer — Speak Brief, Then Bridge

**What:** Agent speaks a brief to the provider on the provider leg, then bridges the user leg to the provider leg. Both parties hear each other immediately after bridge.

**When to use:** After provider confirms availability via transcript ("yes", "available", etc.)

**Sequence:**
1. Agent speaks brief on provider leg: `"I have a customer named {name} who needs {service} in {location} — connecting you now."`
2. Wait for `call.speak.ended` on provider leg (so brief completes before bridge)
3. Issue `calls.actions.bridge(providerCallControlId, { call_control_id: userCallControlId })`
4. Telnyx fires `call.bridged` on both legs
5. Agent sets `stage: 'transferred'` in CallState
6. Agent does NOT hang up provider leg — Telnyx manages both legs now
7. User and provider talk directly; call ends when either hangs up

**Example:**
```typescript
// Source: Telnyx API reference (api-reference/call-commands/bridge-calls)
await getTelnyxClient().calls.actions.bridge(providerCallControlId, {
  call_control_id: userCallControlId,
});
```

### Pattern 2: Distinguishing Pre-Bridge vs Post-Bridge Hangup (XFER-04)

**What:** The existing `handleProviderHangup` cascades on `normal_clearing`. After a successful bridge, a `normal_clearing` hangup on the provider leg means the provider hung up after the call — this must NOT trigger a cascade to another provider.

**The fix:** Add a `transferredAt` timestamp (or `stage: 'transferred'`) to CallState. In `handleProviderHangup`, check if `state.stage === 'transferred'` before cascading.

**Example:**
```typescript
// In handleProviderHangup:
const state = getCall(userCallControlId);
if (state?.stage === 'transferred') {
  // Post-bridge hangup — provider ended the conversation
  // Log it, do not cascade
  console.log(`[outbound-caller] Post-bridge hangup from ${providerName}`);
  return;
}
// ... existing cascade logic
```

### Pattern 3: Bridge Event Handling in webhooks.ts

**What:** The `call.bridged` event fires for BOTH legs after bridge. Route it to a handler that sets the transferred state and logs success.

**When to use:** Add a new `case 'call.bridged':` block in the webhooks switch.

**Client state routing:** The `call.bridged` event payload includes the `call_control_id` of the leg that received the event. Use `client_state` (decoded) to check `stage === 'provider-dial'` and identify the user/provider mapping.

**Example:**
```typescript
case 'call.bridged': {
  const cs = decodeClientState((payload as any).client_state);
  if (cs.stage === 'provider-dial') {
    const userCcid = cs.userCallControlId as string;
    const providerName = cs.providerName as string;
    updateCall(userCcid, { stage: 'transferred' });
    console.log(`[webhooks] Bridge established: user ${userCcid} <-> provider ${providerName}`);
  }
  break;
}
```

### Pattern 4: CallState Stage Extension

**What:** Add `'transferred'` to the `stage` union type in `CallState`.

**Current stages:** `'greeting' | 'name_capture' | 'intake' | 'consent' | 'searching' | 'calling' | 'complete'`
**New stages:** Add `'transferred'` between `'calling'` and `'complete'`.

**Impact:** The `call.hangup` inbound handler currently checks `state.stage !== 'complete'` for session persistence. `'transferred'` should behave like `'complete'` — call ended successfully, clean up immediately.

### Anti-Patterns to Avoid

- **Bridging user leg first:** Always bridge from `providerCallControlId` — the provider leg has `client_state` encoding the user mapping. Calling `.bridge()` on the user leg would require knowing the provider CCID separately.
- **Hanging up provider leg before bridge:** The bridge must be established before the agent exits. Hanging up provider leg first disconnects the provider before bridge fires.
- **Not waiting for speak.ended:** If the agent speaks the brief and immediately bridges without waiting for `speak.ended`, the bridge fires mid-utterance and the user may hear the tail of the brief. Wait for `call.speak.ended` on the provider leg before bridging.
- **Cascading after transferred stage:** The most common bug: `normal_clearing` hangup cascades to next provider even though user is already talking to the connected provider.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Two-party audio connection | Custom SIP proxy or RTP relay | `calls.actions.bridge` | Telnyx manages all media — bridge is a single API call |
| Bridge completion detection | Poll call status endpoint | `call.bridged` webhook event | Event fires immediately when bridge is established |
| Agent exit from bridge | Custom SIP BYE | Nothing — agent never joined the bridge | Agent holds provider leg; after bridge, agent does not exist in the audio path |

**Key insight:** The "agent" is not an audio participant in the call — it is a server-side controller. The user and provider are the two audio legs. "Agent exits" means the server stops issuing commands on those legs, not that an audio participant leaves.

---

## Common Pitfalls

### Pitfall 1: Cascading After Successful Bridge
**What goes wrong:** After user and provider are bridged, if the provider hangs up (normal call end), `handleProviderHangup` detects `normal_clearing` and currently falls through silently (no cascade for normal_clearing). However, the `call.hangup` inbound handler uses `state.stage !== 'complete'` to decide whether to persist the session. With `stage: 'transferred'`, this logic must also treat transferred as complete.
**Why it happens:** Stage transitions are not yet defined for the transferred state.
**How to avoid:** Add `'transferred'` to the stage type AND update all stage checks (hangup handler, session persistence logic, call history status determination).
**Warning signs:** User hears "I'll try the next provider" after already being connected.

### Pitfall 2: Race Between speak.ended and bridge on Provider Leg
**What goes wrong:** `call.speak.ended` fires on the provider leg when the brief TTS completes. If the implementation triggers bridge directly from the availability transcript (without waiting for speak.ended), the brief may still be playing when the bridge fires — the user hears the end of "connecting you now" which is meant for the provider.
**Why it happens:** The brief is spoken via `speak()` and the transcript-based availability detection fires immediately. The brief takes 3-5 seconds of TTS playback.
**How to avoid:** In the `call.speak.ended` handler, check if the provider leg is in a "ready-to-bridge" sub-state and trigger the bridge there. Use a `pendingBridge: boolean` flag in CallState, set when availability is confirmed, consumed in `call.speak.ended`.
**Warning signs:** Provider hears "connecting you now" while user also hears it.

### Pitfall 3: bridge() Called on Wrong Leg
**What goes wrong:** `calls.actions.bridge(legA, { call_control_id: legB })` connects legA to legB. The provider leg has the `client_state` with routing info. Calling bridge on the user leg requires the user's `client_state` to have the provider CCID, which it does not (user's `client_state` only has `{ source: 'openclaw' }`).
**Why it happens:** Unclear which leg should initiate the bridge command.
**How to avoid:** Always call bridge on the provider leg (`providerCallControlId`), specifying `call_control_id: userCallControlId`. The provider leg has full context in client_state.
**Warning signs:** Bridge API returns 422 or "call not found" errors.

### Pitfall 4: call.bridged Fires on Both Legs — Only Process Once
**What goes wrong:** Two `call.bridged` events fire (one per leg). If the handler updates state on both, `updateCall` is called twice, and if there is any side effect (e.g., speaking to user), it fires twice.
**Why it happens:** Telnyx design — both legs get the event.
**How to avoid:** Guard the `call.bridged` handler with the `client_state.stage === 'provider-dial'` check. Only the provider leg has this client_state. The user leg's `call.bridged` has `{ source: 'openclaw' }` client_state — skip it.
**Warning signs:** Duplicate log entries or doubled state updates.

### Pitfall 5: Session Persistence After Transfer
**What goes wrong:** The inbound hangup handler has `if (state.stage !== 'complete') { setTimeout(() => endCall(), 30min) }`. If stage is `'transferred'`, the session persists 30 minutes unnecessarily.
**Why it happens:** `'transferred'` is a new stage unknown to the existing guard.
**How to avoid:** Update the stage check to treat `'transferred'` the same as `'complete'` in the hangup handler.
**Warning signs:** Memory leak — call states never cleaned up after successful transfers.

---

## Code Examples

### Bridge API Call (XFER-01)
```typescript
// Source: Telnyx API reference (developers.telnyx.com/api-reference/call-commands/bridge-calls)
// Called on provider leg, bridging TO the user leg
await getTelnyxClient().calls.actions.bridge(providerCallControlId, {
  call_control_id: userCallControlId,
});
```

### Provider Brief Script (XFER-02)
```typescript
// Spoken on provider leg BEFORE bridge — agent identification + context
export const TRANSFER_BRIEF = (
  callerName: string | undefined,
  serviceType: string,
  location: string
): string => {
  const name = callerName ?? 'a customer';
  return (
    `I have ${name} who needs ${serviceType} near ${location}. ` +
    `I'm connecting them to you now. One moment.`
  );
};
```

### Triggering Bridge After Brief Completes (XFER-02 + XFER-01)
```typescript
// In call.speak.ended handler — check pendingBridge flag set during availability confirmation
case 'call.speak.ended': {
  const cs = decodeClientState((payload as any).client_state);
  if (cs.stage === 'provider-dial') {
    const userCcid = cs.userCallControlId as string;
    const state = getCall(userCcid);
    if (state?.pendingBridge) {
      updateCall(userCcid, { pendingBridge: false });
      await getTelnyxClient().calls.actions.bridge(callControlId, {
        call_control_id: userCcid,
      });
      console.log(`[webhooks] Bridge initiated: ${callControlId} <-> ${userCcid}`);
    }
  }
  // ... existing greeting stage logic
  break;
}
```

### CallState Extension (Stage + pendingBridge)
```typescript
// call-state.ts changes needed
export interface CallState {
  // ... existing fields ...
  stage: 'greeting' | 'name_capture' | 'intake' | 'consent' | 'searching' | 'calling' | 'transferred' | 'complete';
  pendingBridge: boolean;   // set when provider confirms available; consumed in speak.ended
}
```

### Post-Bridge Hangup Guard (XFER-04)
```typescript
// In handleProviderHangup — guard against cascading after successful transfer
const state = getCall(userCallControlId);
if (state?.stage === 'transferred') {
  console.log(`[outbound-caller] Post-transfer hangup from ${providerName} — call completed normally`);
  return;  // do not cascade
}
// ... existing cascade logic unchanged
```

### Transfer Failure Recovery (XFER-04)
```typescript
// Provider leg hangs up with normal_clearing BEFORE bridge was established
// (stage is still 'calling', not 'transferred')
// Existing handleProviderHangup already handles timeout, user_busy
// Add normal_clearing + pre-transfer guard:
const preBridgeCauses = ['timeout', 'no_answer', 'user_busy', 'normal_clearing'];
if (!state?.stage || state.stage !== 'transferred') {
  if (preBridgeCauses.includes(hangupCause)) {
    await speak(userCcid, `${providerName} was disconnected — trying the next provider.`);
    // ... cascade
  }
}
```

---

## Existing Code Integration Points

The planner must connect to these exact locations in the codebase:

| File | Line/Location | What Phase 5 Does |
|------|---------------|-------------------|
| `src/api/webhooks.ts` | ~line 200-206 (`availability === 'available'` branch) | Replace `stage: 'complete'` with `pendingBridge: true` + speak brief on provider leg |
| `src/api/webhooks.ts` | `call.speak.ended` handler (~line 173) | Add provider-leg check: if `pendingBridge` → bridge |
| `src/api/webhooks.ts` | `switch` statement | Add new `case 'call.bridged':` block |
| `src/api/webhooks.ts` | `call.hangup` handler (~line 403) | Update session persistence: treat `'transferred'` same as `'complete'` |
| `src/api/webhooks.ts` | call history status determination (~line 444) | Add `'transferred'` → `'completed'` mapping |
| `src/lib/voice/call-state.ts` | `CallState` interface (~line 19) | Add `transferred` to stage union, add `pendingBridge: boolean` field |
| `src/lib/voice/call-state.ts` | `initCall` (~line 40) | Initialize `pendingBridge: false` |
| `src/lib/voice/outbound-caller.ts` | `handleProviderHangup` (~line 335) | Add transferred-stage guard before cascade |
| `src/lib/tools/handlers/dispatch.ts` | `transferCall` stub (~line 58) | Remove or implement (transferCall may not be needed if bridge is triggered from webhook flow) |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SIP REFER blind transfer | Telnyx bridge API two-leg connection | Project inception (roadmap decision) | Agent retains control; can detect failure |
| Three-way conference with agent exit | Direct bridge (no agent audio leg) | Project inception | Simpler — agent never participates in audio |

**Clarification on roadmap decision:** The STATE.md records "Telnyx conference bridge pattern chosen for live transfer." After researching the actual Telnyx API, the implementation is a direct two-leg **bridge** (not a conference). The result is identical — user and provider are directly connected — but the API is `calls.actions.bridge` not `conferences.create`. The roadmap decision is implemented via the bridge primitive.

**No deprecated items applicable to this phase.**

---

## Open Questions

1. **Does `call.speak.ended` fire on the provider leg?**
   - What we know: `call.speak.ended` fires when `calls.actions.speak` completes. The provider leg uses speak for AI_INTRO (Phase 4) and the brief (Phase 5). The event fires for the leg the speak was issued on.
   - What's unclear: Whether the existing `call.speak.ended` handler guard (`state?.stage === 'greeting'`) would interfere with provider-leg speak.ended events. The current handler fetches state via `getCall(callControlId)` — for provider calls, `callControlId` is the provider CCID, which has no entry in `_calls` (only user CCIDs are tracked). This means `getCall(providerCcid)` returns undefined and the existing handler is a no-op for provider legs. Safe to add provider-leg logic.
   - Recommendation: Confirmed safe. Add client_state check to distinguish user vs provider speak.ended.

2. **What does Telnyx send in `call.bridged` payload?**
   - What we know: Two `call.bridged` events fire, one per leg. Each contains the `call_control_id` of that leg and the encoded `client_state`.
   - What's unclear: Whether the payload includes the bridged-with leg's CCID (to correlate the two events).
   - Recommendation: Use `client_state` routing to identify the provider leg (has `stage: 'provider-dial'`). The user CCID comes from `client_state.userCallControlId`. No need to correlate the two events — only process the provider-leg event.

3. **transferCall stub in dispatch.ts — remove or implement?**
   - What we know: The warm transfer is triggered automatically from the webhook flow when availability is confirmed, not from an AI tool call. The `transferCall` tool in the registry may be unused.
   - What's unclear: Whether the OpenClaw agent ever explicitly calls `transferCall` as a tool, or whether the bridge is purely a webhook-driven state transition.
   - Recommendation: Implement `transferCall` in dispatch.ts to call `bridgeToUser(userCallControlId)` as a fallback — allows the AI agent to explicitly request transfer if needed, but the primary path is webhook-driven.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `npm test -- --run outbound-caller` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XFER-01 | `bridgeToUser()` calls `calls.actions.bridge(providerCcid, { call_control_id: userCcid })` | unit | `npm test -- --run outbound-caller` | ❌ Wave 0 |
| XFER-02 | `TRANSFER_BRIEF(name, service, location)` returns string containing name, service, location | unit | `npm test -- --run outbound-caller` | ❌ Wave 0 |
| XFER-03 | `call.bridged` handler sets `stage: 'transferred'`; post-bridge hangup does NOT cascade | unit | `npm test -- --run outbound-caller` | ❌ Wave 0 |
| XFER-04 | `handleProviderHangup` with `normal_clearing` + `stage !== 'transferred'` cascades; with `stage === 'transferred'` does not cascade | unit | `npm test -- --run outbound-caller` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --run outbound-caller`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `frontend/src/lib/voice/outbound-caller.test.ts` — covers XFER-01 through XFER-04
- [ ] Mock `calls.actions.bridge` in existing mock factory (currently only `dial`, `hangup`, `speak` are mocked)

*(Existing test infrastructure covers all other requirements — only new bridge-specific behaviors need new tests)*

---

## Sources

### Primary (HIGH confidence)
- Telnyx API Reference (`developers.telnyx.com/api-reference/call-commands/bridge-calls`) — bridge parameters, `call.bridged` events, `park_after_unbridge` behavior
- Existing codebase (`frontend/src/lib/voice/outbound-caller.ts`, `frontend/src/api/webhooks.ts`) — Phase 4 handoff points, CallState shape, client_state routing pattern, test mock patterns

### Secondary (MEDIUM confidence)
- Telnyx `demo-findme-ivr` GitHub demo — confirmed two-stage bridge pattern: speak to provider, then bridge on acceptance
- Telnyx search results confirming `calls.actions.bridge(callControlId, { call_control_id: targetCcid })` SDK method signature

### Tertiary (LOW confidence)
- Roadmap decision in STATE.md: "Telnyx conference bridge pattern" — interpreted as `calls.actions.bridge` primitive (not conferences API). Needs runtime validation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; bridge API verified from official reference
- Architecture: HIGH — existing codebase handoff points identified; bridge API parameters confirmed
- Pitfalls: HIGH — speak.ended race condition and normal_clearing cascade guard derived from direct code analysis
- Webhook events: MEDIUM — `call.bridged` event structure not fully verified (payload fields); routing via client_state is the proven pattern from Phase 4

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (Telnyx v2 Call Control API is stable)
