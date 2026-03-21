# Phase 6: Post-Call SMS - Research

**Researched:** 2026-03-21
**Domain:** Post-call SMS delivery, BuyMeACoffee integration, call history persistence
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**SMS content & tone**
- Murphy's voice — casual, warm, first-person ("Hey Sarah! I connected you with...")
- Personalize with caller's name if captured during the call; fall back to "Hey there!" if not
- Always include connected provider's phone number (useful if call drops or they need to call back)
- Single SMS preferred, cap provider list at top 3 contacted
- Telnyx handles segmentation if message exceeds 160 chars — acceptable but aim to stay under

**Failure fallback SMS**
- Include provider names + phone numbers so caller can follow up themselves
- List top 3 providers from the ranked search results
- No BuyMeACoffee tip link on failure recaps — tone-deaf to ask for a tip when service failed
- Encouraging sign-off ("Good luck!")

**Trigger timing**
- Send SMS immediately on agent's call.hangup — same handler that already persists call history
- For successful transfers: SMS fires when Murphy's leg disconnects after bridge (user gets SMS while still talking to provider — they'll see it after)
- For non-transfer calls (no_match, abandoned mid-cascade): SMS fires immediately on hangup
- No SMS without TCPA consent (smsConsent=false → skip SMS entirely)
- No SMS for early abandons — if user hung up during greeting/intake/consent (before any providers were contacted), there's nothing useful to recap

**BuyMeACoffee placement**
- Casual inline at end of message: "If I saved you some time, a coffee's always appreciated [emoji] [link]"
- Success-only — never on failure recaps
- URL sourced from BUYMEACOFFEE_URL environment variable (consistent with NEXT_PUBLIC_BUYMEACOFFEE_URL in frontend footer)

### Claude's Discretion
- Exact SMS character optimization and line breaks
- Error handling strategy for failed SMS sends (non-fatal, log and continue — same pattern as sendProviderSms)
- Whether to replace the stub `sendSms` in tools/handlers/sms.ts or build a new dedicated module
- Call history persistence improvements (POST-04 is ~80% done in webhooks.ts call.hangup already)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POST-01 | Agent sends SMS recap to user after call ends (providers contacted, outcomes, connected provider info) | Telnyx messages.send() already proven in sendProviderSms(); CallState has all required fields; call.hangup is the trigger point |
| POST-02 | Agent includes BuyMeACoffee tip link in SMS recap | BUYMEACOFFEE_URL env var needed (construct from username or add URL var); success-only per locked decisions |
| POST-03 | Agent sends graceful failure SMS with provider contact list if no live transfer was achieved | callStatus='no_match' + stage guards enable this branch; providers array in CallState |
| POST-04 | Call data is persisted for history (caller, providers, outcomes, timestamps) | insertCallHistory() already called in call.hangup; ~80% complete — may need connected_provider phone field enrichment |
</phase_requirements>

---

## Summary

Phase 6 is primarily a **wiring phase**: all infrastructure exists. The Telnyx SMS sending pattern is proven (`sendProviderSms`), the CallState has all required fields (`smsConsent`, `callerName`, `callerPhone`, `providers`, `currentProviderIndex`, `stage`), and `insertCallHistory()` is already called from `call.hangup`. The main work is:

1. Building a `sendRecapSms()` module that composes the correct message variant (success vs. failure vs. no-op) from CallState
2. Wiring it into `webhooks.ts` `call.hangup` after the existing `insertCallHistory()` call
3. Adding the `BUYMEACOFFEE_URL` env var (the root `.env.example` only has `BUYMEACOFFEE_USERNAME` — the SMS sender needs the full URL or derives it)
4. Confirming the `sendSms` stub in `src/lib/tools/handlers/sms.ts` is the right home or creating a dedicated recap module

The key design question that Claude must resolve: whether to implement `sendRecapSms()` as a replacement for the existing stub in `tools/handlers/sms.ts` or as a new sibling module (e.g., `src/lib/voice/recap-sms.ts`). Because the recap fires from `webhooks.ts` (not from a tool call), a dedicated module in `src/lib/voice/` or `src/lib/` is architecturally cleaner — tools/handlers/ is for AI tool invocations.

**Primary recommendation:** Implement `src/lib/voice/recap-sms.ts` with a single exported `sendRecapSms(state: CallState): Promise<void>` function. Wire it into `webhooks.ts` `call.hangup` immediately after `insertCallHistory()`. Keep non-fatal (log + continue) consistent with `sendProviderSms` pattern.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| telnyx SDK | ^6.13.0 (already installed) | SMS delivery via `getTelnyxClient().messages.send()` | Already used for provider SMS (CALL-04); no additional dependencies needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^4.1.0 (already installed) | Unit tests for SMS composer | All tests in this project use Vitest |
| TypeScript | ^5.9.3 (already installed) | Type safety | Consistent with entire codebase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Telnyx messages API | Twilio or AWS SNS | No reason — Telnyx is the established stack for all telephony and SMS in this project |
| Single dedicated module | Expanding the sms.ts stub | The stub is wired as a tool handler (AI-invokable); recap is infrastructure, not a tool — separate module avoids conceptual confusion |

**Installation:**
No new packages needed. All dependencies are already present.

---

## Architecture Patterns

### Recommended Project Structure

The new module fits cleanly into the existing voice library:

```
src/
├── api/
│   └── webhooks.ts           # MODIFY: wire sendRecapSms() after insertCallHistory()
├── lib/
│   └── voice/
│       ├── outbound-caller.ts # READ: sendProviderSms() is the pattern to copy
│       ├── recap-sms.ts       # NEW: sendRecapSms(), buildSuccessSms(), buildFailureSms()
│       └── recap-sms.test.ts  # NEW: co-located unit tests
```

### Pattern 1: Non-Fatal SMS with try/catch (proven in sendProviderSms)

**What:** All Telnyx SMS calls are wrapped in try/catch. Failure is logged but does not throw. The caller continues regardless.

**When to use:** Always — SMS is a post-call nicety, never a blocking operation.

**Example:**
```typescript
// Source: src/lib/voice/outbound-caller.ts line 168
export async function sendProviderSms(provider: Provider, state: ...): Promise<void> {
  try {
    await getTelnyxClient().messages.send({
      from: process.env.TELNYX_PHONE_NUMBER!,
      to: provider.phone,
      text: `...`,
    });
  } catch (err) {
    console.error(`[outbound-caller] Failed to send SMS to ${provider.name}:`, err);
    // Non-fatal — continue with dial even if SMS fails
  }
}
```

### Pattern 2: Stage + consent gate in call.hangup

**What:** Before sending recap SMS, check both `smsConsent === true` and that the call reached a stage where providers were actually contacted. Early abandons (greeting/name_capture/intake/consent stages) get no SMS.

**When to use:** Always — gates must match exactly what `webhooks.ts` currently uses for `wasDialing`.

**Integration point in webhooks.ts** (line ~544, after `insertCallHistory` try/catch):
```typescript
// After call history persisted — send recap SMS if consent given and providers were contacted
if (state && state.smsConsent === true && wasDialing) {
  await sendRecapSms(state, callStatus);
}
```

Note: `callStatus` is already computed on line ~515 of `webhooks.ts`. Pass it to avoid recomputing.

### Pattern 3: SMS message composition by outcome

**What:** Three paths based on `callStatus` + `state.stage`:
- `callStatus === 'completed'` (stage is 'transferred' or 'complete') → success recap + BuyMeACoffee link
- `callStatus === 'no_match'` → failure fallback with provider contact list
- `callStatus === 'abandoned'` + `wasDialing` → minimal failure recap (providers tried but user hung up mid-cascade)

**Example structure for recap-sms.ts:**
```typescript
// Source: pattern derived from CONTEXT.md decisions
export function buildSuccessSms(state: CallState, buyMeACoffeeUrl: string): string {
  const greeting = state.callerName ? `Hey ${state.callerName}!` : 'Hey there!';
  const connected = state.providers[state.currentProviderIndex];
  const tried = state.providers
    .slice(0, state.currentProviderIndex)
    .filter((_, i) => i < state.currentProviderIndex);

  let msg = `${greeting} I connected you with ${connected.name} (${connected.phone}).`;
  if (tried.length > 0) {
    const triedList = tried.slice(0, 3).map(p => `${p.name} — unavailable`).join(', ');
    msg += ` I also tried: ${triedList}.`;
  }
  msg += ` If I saved you some time, a coffee's always appreciated ☕ ${buyMeACoffeeUrl}`;
  return msg;
}

export function buildFailureSms(state: CallState): string {
  const greeting = state.callerName ? `Hey ${state.callerName}!` : 'Hey there!';
  const topProviders = state.providers.slice(0, 3);
  const list = topProviders.map(p => `${p.name}: ${p.phone}`).join(', ');
  const serviceType = state.intent.serviceType ?? 'a provider';
  return `${greeting} I wasn't able to connect you live, but here are the top ${serviceType} providers I found: ${list}. Good luck!`;
}

export async function sendRecapSms(state: CallState, callStatus: 'completed' | 'no_match' | 'abandoned'): Promise<void> {
  if (!state.smsConsent) return;
  if (!state.callerPhone) return;

  const buyMeACoffeeUrl = process.env.BUYMEACOFFEE_URL ?? '';

  let text: string;
  if (callStatus === 'completed') {
    text = buildSuccessSms(state, buyMeACoffeeUrl);
  } else {
    text = buildFailureSms(state);
  }

  try {
    await getTelnyxClient().messages.send({
      from: process.env.TELNYX_PHONE_NUMBER!,
      to: state.callerPhone,
      text,
    });
    console.log(`[recap-sms] Sent ${callStatus} recap to ${state.callerPhone}`);
  } catch (err) {
    console.error(`[recap-sms] Failed to send recap SMS to ${state.callerPhone}:`, err);
  }
}
```

### Anti-Patterns to Avoid

- **Sending SMS before call history persisted:** The SMS fires *after* `insertCallHistory()` in the `call.hangup` handler — not before. The DB write must happen first so the record exists before Murphy "signs off."
- **Sending SMS on early abandons:** If `wasDialing === false` (user hung up before any provider was contacted), skip SMS entirely. There is nothing useful to say.
- **Throwing from sendRecapSms:** Must be non-fatal. Call cleanup (`endCall()`) must always run even if SMS fails.
- **Using NEXT_PUBLIC_BUYMEACOFFEE_URL in backend:** That var is frontend-only (Next.js public). The backend needs `BUYMEACOFFEE_URL` (no `NEXT_PUBLIC_` prefix, not exposed to browser).
- **Putting recap logic in tools/handlers/sms.ts:** That stub is the AI-invokable tool. Recap is infrastructure triggered by a webhook event, not an AI tool call. Keep them separate.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMS delivery | Custom HTTP fetch to Telnyx REST | `getTelnyxClient().messages.send()` | Already proven in sendProviderSms; handles auth, retries, response parsing |
| Message segmentation | Manual 160-char splitting | Telnyx automatic segmentation | Telnyx handles multi-part SMS transparently; locked decision says this is acceptable |
| TCPA consent tracking | New consent field | `state.smsConsent` already in CallState | Designed for this in Phase 2 |

**Key insight:** Phase 6 is a composition task, not a platform integration task. The infrastructure (Telnyx client, CallState, call.hangup trigger point) is complete. The only new code is the message composition logic and the wiring.

---

## Common Pitfalls

### Pitfall 1: BUYMEACOFFEE_URL env var mismatch

**What goes wrong:** The root `.env.example` has `BUYMEACOFFEE_USERNAME` (not URL). The frontend uses `NEXT_PUBLIC_BUYMEACOFFEE_URL`. The CONTEXT.md calls for `BUYMEACOFFEE_URL`. These are three different things. If the SMS module reads the wrong var, it sends a broken link or empty string.

**Why it happens:** Env var naming drifted across frontend and backend without a canonical backend SMS var.

**How to avoid:** Add `BUYMEACOFFEE_URL=` to root `.env.example`. Construct value as `https://buymeacoffee.com/{username}`. The SMS module reads `process.env.BUYMEACOFFEE_URL`. If empty, omit the tip line rather than sending a broken link.

**Warning signs:** SMS contains `undefined` or bare `https://buymeacoffee.com` without a username path.

### Pitfall 2: wasDialing flag not passed to sendRecapSms

**What goes wrong:** The `wasDialing` boolean is computed inside the `call.hangup` handler scope. If `sendRecapSms` tries to recompute it independently, it may use stale state (after `endCall()` clears it).

**Why it happens:** `endCall()` clears the in-memory state. If SMS fires after cleanup, `getCall()` returns undefined.

**How to avoid:** Send the SMS (and determine the message type) *before* `endCall()` — in the same sequence as `insertCallHistory`. Pass the already-computed `callStatus` and `wasDialing` to avoid recomputation.

**Warning signs:** `state` is undefined inside `sendRecapSms`.

### Pitfall 3: SMS sent on smsConsent=undefined (ambiguous consent)

**What goes wrong:** A three-state field (`true | false | undefined`). Only `true` should send. `undefined` (user never answered the consent question) must be treated as `false` per Phase 2 TCPA decision: "Ambiguous consent defaults to smsConsent=false."

**Why it happens:** `state.smsConsent === true` is the correct check (strict equality), not `!!state.smsConsent` or `state.smsConsent != false`.

**How to avoid:** Always use `state.smsConsent === true` (strict). Document this in the module.

### Pitfall 4: Recap SMS fires for outbound provider leg hangup

**What goes wrong:** Telnyx fires `call.hangup` for both inbound (user) and outbound (provider) legs. Provider leg hangup is already handled separately and breaks early. If the recap SMS logic is placed outside the `hangupDirection === 'incoming'` block, it fires on provider disconnects too.

**Why it happens:** The `call.hangup` handler has a direction guard at line 479. The recap SMS integration point is in the inbound-only section (line 544+). Must stay there.

**How to avoid:** Verify SMS wiring is placed after the `hangupDirection === 'outgoing'` early-return block, not before it.

---

## Code Examples

### Telnyx messages.send (proven pattern)
```typescript
// Source: src/lib/voice/outbound-caller.ts line 175
await getTelnyxClient().messages.send({
  from: process.env.TELNYX_PHONE_NUMBER!,
  to: provider.phone,
  text: `Your message here`,
});
```

### callStatus already computed in webhooks.ts call.hangup
```typescript
// Source: src/api/webhooks.ts lines 515-522
let callStatus: 'completed' | 'no_match' | 'abandoned';
if (state.stage === 'complete' || state.stage === 'transferred') {
  callStatus = 'completed';
} else if (wasDialing && state.currentProviderIndex >= state.providers.length - 1) {
  callStatus = 'no_match';
} else {
  callStatus = 'abandoned';
}
```

### Correct integration point in call.hangup
```typescript
// After line 543 (after insertCallHistory try/catch closes), before line 547 (provider hangup logic)
// SMS recap: fire if consent given and providers were contacted
if (state && state.smsConsent === true && wasDialing) {
  await sendRecapSms(state, callStatus);
}
```

### ConnectedProvider phone retrieval
```typescript
// state.providers[state.currentProviderIndex] gives the connected provider
// Provider type (from search.ts): { name, phone, rating, reviewCount, address, distanceKm, ... }
const connected = state.providers[state.currentProviderIndex];
// connected.name and connected.phone are available for success SMS
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stub sendSms in tools/handlers/sms.ts | Real Telnyx implementation in new recap-sms.ts | Phase 6 (now) | AI tool stub remains; recap is separate infrastructure |
| BUYMEACOFFEE_USERNAME env var | BUYMEACOFFEE_URL env var | Phase 6 (now) | Backend SMS needs full URL, not just username |

**Deprecated/outdated:**
- `sendSms` stub note "Real implementation in Phase 6": The stub can be updated to call `sendRecapSms` or remain a thin AI tool wrapper — Phase 6 decides the boundary.

---

## Open Questions

1. **Should the sendSms AI tool stub delegate to sendRecapSms or remain separate?**
   - What we know: The stub is an AI-invokable tool (registered in tool registry). The recap is infrastructure triggered by webhooks.
   - What's unclear: Whether Murphy's AI ever needs to send an ad-hoc SMS mid-call (tool use) vs. the automated recap post-call.
   - Recommendation: Keep them separate. The stub can evolve independently for potential future AI tool use. The recap module is infrastructure.

2. **POST-04 connected_provider phone — is it stored in call_history?**
   - What we know: `insertCallHistory()` stores `connected_provider` as the provider's *name* (string), not their phone number.
   - What's unclear: Whether the dashboard (Phase 7) needs the phone number. The SMS already includes it.
   - Recommendation: For Phase 6, this is a non-issue — the SMS reads the phone from `state.providers[]` directly before `endCall()` clears state. No DB schema change needed for Phase 6. Flag for Phase 7 if dashboard needs the phone.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.ts` (root) — includes `src/**/*.test.{ts,tsx}` |
| Quick run command | `npx vitest run src/lib/voice/recap-sms.test.ts` |
| Full suite command | `npx vitest run` |

**Note on test location:** The vitest config at root includes `src/**/*.test.{ts,tsx}`. The test for `recap-sms.ts` should be co-located at `src/lib/voice/recap-sms.test.ts`. Tests in `tests/` are also picked up via the existing config. Either location works; co-located is the Phase 4-5 pattern for `outbound-caller.test.ts`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POST-01 | buildSuccessSms() composes correct message with provider name/phone, caller name, and tried providers | unit | `npx vitest run src/lib/voice/recap-sms.test.ts` | ❌ Wave 0 |
| POST-01 | sendRecapSms() calls getTelnyxClient().messages.send with correct from/to/text | unit | `npx vitest run src/lib/voice/recap-sms.test.ts` | ❌ Wave 0 |
| POST-01 | sendRecapSms() skips send when smsConsent !== true | unit | `npx vitest run src/lib/voice/recap-sms.test.ts` | ❌ Wave 0 |
| POST-02 | buildSuccessSms() includes BUYMEACOFFEE_URL in message | unit | `npx vitest run src/lib/voice/recap-sms.test.ts` | ❌ Wave 0 |
| POST-02 | buildSuccessSms() omits tip line when BUYMEACOFFEE_URL is empty | unit | `npx vitest run src/lib/voice/recap-sms.test.ts` | ❌ Wave 0 |
| POST-03 | buildFailureSms() composes correct message with top-3 provider list and no tip link | unit | `npx vitest run src/lib/voice/recap-sms.test.ts` | ❌ Wave 0 |
| POST-03 | sendRecapSms() sends failure SMS when callStatus='no_match' | unit | `npx vitest run src/lib/voice/recap-sms.test.ts` | ❌ Wave 0 |
| POST-04 | insertCallHistory() persists correct record (already tested) | unit | `npx vitest run src/lib/db/call-history-repo.test.ts` | ✅ exists |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/voice/recap-sms.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/voice/recap-sms.ts` — production module (new file)
- [ ] `src/lib/voice/recap-sms.test.ts` — covers POST-01, POST-02, POST-03

*(POST-04 infrastructure already tested in `src/lib/db/call-history-repo.test.ts`)*

---

## Sources

### Primary (HIGH confidence)
- `src/api/webhooks.ts` lines 474-571 — complete call.hangup handler, exact integration points
- `src/lib/voice/call-state.ts` — CallState interface with all required fields
- `src/lib/voice/outbound-caller.ts` lines 162-187 — sendProviderSms() as the canonical Telnyx SMS pattern
- `src/lib/tools/handlers/sms.ts` — stub awaiting implementation
- `src/lib/db/call-history-repo.ts` — insertCallHistory() and CallHistoryRecord interface
- `src/lib/db/call-history-repo.test.ts` — test pattern for DB module
- `.env.example` — confirms BUYMEACOFFEE_USERNAME (not URL) is current env var name
- `vitest.config.ts` — test include patterns and framework configuration
- `.planning/phases/06-post-call-sms/06-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- `tests/api/webhooks.test.ts` — mock patterns for Telnyx client and call-state (reference for recap-sms test mocking)
- `.planning/STATE.md` — confirmed Phase 5 complete; TCPA consent design decisions locked in Phase 2

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; reusing proven Telnyx pattern
- Architecture: HIGH — integration point precisely identified; CallState has all required fields; existing test patterns directly applicable
- Pitfalls: HIGH — derived from reading actual code, not speculation; env var mismatch is a real discovered gap

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable domain — no external API changes expected)
