---
name: learning
description: Codebase deep dives, concept learning, architecture review
---

# Learning

## Codebase Deep Dive

When learning a new part of the codebase:
1. Start with the entry point (API route or main module)
2. Trace the request flow through layers
3. Identify key types and interfaces
4. Map dependencies between modules
5. Find the tests to understand expected behavior

## Concept Learning

For OpenClaw-specific concepts:

### Telnyx Call Control v2
- Call legs, conferences, transfers
- Webhook events and commands
- Media streaming (fork/gather)

### Voice Pipeline
- STT/TTS integration
- Audio encoding (mulaw, 8kHz)
- Latency optimization
- Barge-in handling

### OpenClaw Framework
- Gateway WebSocket protocol
- Device pairing
- Plugin system

## Architecture Review

When reviewing architecture:
1. Draw the data flow (input → processing → output)
2. Identify failure modes at each step
3. Check for single points of failure
4. Assess scalability bottlenecks
5. Document findings in `.planning/codebase/`
