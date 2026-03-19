---
status: testing
phase: 04-outbound-provider-calling
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md]
started: 2026-03-16T22:00:00Z
updated: 2026-03-16T22:00:00Z
---

## Current Test

number: 1
name: Search Results Trigger Outbound Cascade
expected: |
  After the agent narrates search results ("I found 3 plumbers near Austin..."), it immediately starts calling the top-ranked provider. You hear something like "Calling Acme Plumbing now — one moment." The agent does NOT say "call complete" or end the conversation after search results.
awaiting: user response

## Tests

### 1. Search Results Trigger Outbound Cascade
expected: After the agent narrates search results, it immediately starts calling the top-ranked provider. You hear "Calling [provider name] now — one moment." The call does NOT end after search narration.
result: [pending]

### 2. Live Narration During Provider Ring
expected: While the provider's phone is ringing, the agent speaks status updates to you every ~17 seconds. You hear phrases like "Still waiting for Acme Plumbing to pick up..." and "Hang tight — still ringing Acme Plumbing." The line never goes silent for more than 20 seconds.
result: [pending]

### 3. AI Identification on Provider Answer
expected: When a provider answers, the first thing they hear is the AI identifying itself: "Hi, this is an AI concierge calling on behalf of a customer. I'm an automated assistant — not a human." It then asks about availability for your service type and location.
result: [pending]

### 4. SMS Pre-Notification to Provider
expected: Before dialing a provider, the agent sends an SMS to their phone number saying something like "Incoming call from an AI concierge — a customer needs [service] near [location]." Check the provider's phone for the text message.
result: [pending]

### 5. Voicemail Detection and Cascade
expected: If a provider's phone goes to voicemail, the agent detects it automatically, hangs up that call, and tells you "They went to voicemail — trying the next one." It then dials the next provider without you needing to do anything.
result: [pending]

### 6. Provider Busy/No-Answer Cascade
expected: If a provider doesn't answer within ~25 seconds or their line is busy, the agent tells you "[Provider] didn't answer — trying the next one" (or "line is busy") and automatically dials the next provider in the ranked list.
result: [pending]

### 7. Provider Confirms Availability
expected: When a provider answers and says something like "Yes, we're available" or "Sure, we can do that," the agent tells you "Great news — [provider name] is available! I'm going to connect you now." (Note: actual transfer is Phase 5 — for now it should recognize availability.)
result: [pending]

### 8. Provider Declines — Cascade Continues
expected: When a provider answers but says something like "No, we're booked" or "Sorry, we can't," the agent hangs up on that provider, tells you they aren't available, and automatically tries the next provider.
result: [pending]

### 9. All Providers Exhausted
expected: If the agent tries 4 providers and none are available (busy, voicemail, declined), you hear a message like "I've tried reaching several providers but wasn't able to connect with anyone available right now. I'm sorry I couldn't find a match this time."
result: [pending]

### 10. Outbound Call Doesn't Auto-Answer
expected: When the agent dials a provider, that outbound call leg is NOT auto-answered by the system. Only your original inbound call was auto-answered. (Verify in logs: outbound call.initiated events show "no auto-answer" log.)
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0

## Gaps

[none yet]
