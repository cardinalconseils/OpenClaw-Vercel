---
phase: 02
slug: voice-conversation-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | VOICE-01 | unit | `npx vitest run src/lib/state` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | VOICE-05 | unit | `npx vitest run src/lib/voice/filler` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | VOICE-02 | unit | `npx vitest run src/lib/ai` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 1 | VOICE-03 | unit | `npx vitest run src/lib/ai` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | VOICE-04 | integration | `npx vitest run src/api` | ✅ | ⬜ pending |
| 02-03-02 | 03 | 2 | VOICE-01 | manual | live call test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/state/call-state.test.ts` — stubs for call state machine tests
- [ ] `src/lib/voice/filler.test.ts` — stubs for filler phrase pool tests

*Existing test infrastructure (vitest, supertest) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Greeting within 2s | VOICE-01 | Requires live Telnyx call | Call the number, time from ring to greeting |
| Streaming TTS feels immediate | VOICE-04 | Requires live Telnyx call | Call and verify no perceptible delay |
| Filler speech during tool calls | VOICE-05 | Requires live Telnyx call | Trigger search, verify filler plays |
| Telnyx KokoroTTS voice quality | VOICE-04 | Subjective audio quality | Call and assess voice naturalness |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
