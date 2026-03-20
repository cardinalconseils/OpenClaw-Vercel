# Voice Pipeline Documentation

Real-time voice processing pipeline for OpenClaw using Telnyx Call Control v2.

## Overview

```
Caller ↔ Telnyx ↔ Call Control v2 ↔ STT → LLM → TTS ↔ Telnyx ↔ Caller
```

## Components

### 1. Telnyx Call Control v2

Telnyx provides call handling via webhooks and commands:

**Inbound Call Webhook:**
```json
{
  "event_type": "call.initiated",
  "payload": {
    "call_control_id": "...",
    "call_leg_id": "...",
    "from": "+15551234567",
    "to": "+15559876543",
    "direction": "incoming"
  }
}
```

**Key Commands:**
- `answer` — Answer inbound call
- `speak` — TTS playback on the call
- `gather_using_speak` — TTS + collect DTMF/speech
- `transfer` — Transfer call to another number
- `bridge` — Bridge two call legs
- `hangup` — End the call
- `send_dtmf` — Send DTMF tones
- `fork_start` — Fork media stream for real-time audio

### 2. Speech-to-Text

Options for STT with Telnyx:

**Telnyx Built-in (Gather):**
```typescript
// Use gather_using_speak for turn-based conversation
await telnyx.calls.gather_using_speak(callControlId, {
  payload: "What service do you need?",
  voice: "female",
  language: "en-US",
  minimum_digits: 0,
  valid_digits: "",
  // Speech recognition enabled automatically
});
```

**External STT (via Media Fork):**
```typescript
// Fork audio stream to external STT
await telnyx.calls.fork_start(callControlId, {
  target: "wss://your-server.com/api/voice/stream",
  rx: "both", // Receive both directions
});
```

### 3. Text-to-Speech

**Telnyx Built-in:**
```typescript
await telnyx.calls.speak(callControlId, {
  payload: "I found 3 plumbers near you. Let me call the best-rated one.",
  voice: "female",
  language: "en-US",
});
```

**External TTS (ElevenLabs):**
```typescript
const config = {
  model_id: 'eleven_turbo_v2',
  output_format: 'ulaw_8000',  // Telephony-compatible
  voice_settings: {
    stability: 0.7,
    similarity_boost: 0.75,
  },
};
```

## Call Flows

### Inbound Call Processing

```
┌─────────────────────────────────────────────────────────────┐
│                    Inbound Call Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Telnyx webhook: call.initiated                          │
│     ↓                                                       │
│  2. Answer call (Call Control: answer)                       │
│     ↓                                                       │
│  3. Greet caller (Call Control: speak)                       │
│     ↓                                                       │
│  4. Gather speech input (Call Control: gather_using_speak)   │
│     ↓                                                       │
│  5. Webhook: call.gather.ended with transcription            │
│     ↓                                                       │
│  6. Process with LLM → extract intent                       │
│     ↓                                                       │
│  7. Respond and continue conversation loop                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Provider Outbound Call

```
┌─────────────────────────────────────────────────────────────┐
│                  Provider Call Flow                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Create outbound call to provider (Call Control: dial)    │
│     ↓                                                       │
│  2. While ringing, update caller: "Calling provider..."      │
│     ↓                                                       │
│  3. Provider answers                                         │
│     ↓                                                       │
│  4. Agent confirms availability with provider                │
│     ↓                                                       │
│  5. Bridge caller and provider (Call Control: bridge)         │
│     ↓                                                       │
│  6. Monitor call until hangup                                │
│     ↓                                                       │
│  7. Send SMS recap to caller                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Live Transfer

```
┌─────────────────────────────────────────────────────────────┐
│                  Transfer Flow                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Option A: Bridge (warm transfer)                            │
│  - Agent stays on call briefly during handoff                │
│  - Uses Call Control: bridge                                 │
│                                                             │
│  Option B: Transfer (cold transfer)                          │
│  - Direct transfer, agent drops off                          │
│  - Uses Call Control: transfer                               │
│                                                             │
│  Option C: Conference                                        │
│  - Three-way call (agent + caller + provider)                │
│  - Agent can drop off after introduction                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Telnyx Webhook Events

| Event | When | Action |
|-------|------|--------|
| `call.initiated` | Inbound call received | Answer and greet |
| `call.answered` | Call answered (inbound or outbound) | Start conversation |
| `call.gather.ended` | Speech/DTMF gathered | Process input |
| `call.speak.ended` | TTS playback finished | Continue flow |
| `call.bridged` | Two legs bridged | Monitor |
| `call.hangup` | Call ended | Send recap, log |
| `call.machine.detection.ended` | Voicemail detected | Handle accordingly |

## Error Handling

### Call Control Errors

```typescript
try {
  await telnyx.calls.speak(callControlId, { payload: text });
} catch (error) {
  if (error.status === 422) {
    // Call no longer active
    logger.warn('Call ended before speak', { callControlId });
  } else if (error.status === 429) {
    // Rate limited
    await sleep(1000);
    await telnyx.calls.speak(callControlId, { payload: text });
  } else {
    logger.error('Telnyx error', { error, callControlId });
    // Attempt graceful hangup
  }
}
```

### Provider Call Failures

```typescript
async function callProviders(providers: Provider[], callerCallId: string) {
  for (const provider of providers) {
    // Update caller
    await speak(callerCallId, `Calling ${provider.name}...`);

    try {
      const answered = await callProvider(provider.phone);
      if (answered && await confirmAvailability(provider)) {
        return provider; // Success
      }
    } catch {
      // Log and try next
      continue;
    }
  }
  // No provider available
  await speak(callerCallId, "I wasn't able to reach any providers. I'll send you the list via text.");
  return null;
}
```

## Configuration

### Environment Variables

```bash
# Telnyx
TELNYX_API_KEY=KEY_...
TELNYX_API_SECRET=...
TELNYX_PUBLIC_KEY=...
TELNYX_APP_ID=...
TELNYX_PHONE_NUMBER=+1...

# External STT (optional — can use Telnyx gather)
DEEPGRAM_API_KEY=...

# External TTS (optional — can use Telnyx speak)
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
```
