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
| **Framework** | vitest 4.x |
| **Config file** | vitest.config.ts (implicit — uses tsconfig) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | VOICE-01 | unit | `npx vitest run tests/lib/voice/greeting.test.ts` | :x: W0 | :white_large_square: pending |
| 02-01-02 | 01 | 1 | VOICE-01 | unit | `npx vitest run tests/lib/voice/call-state.test.ts` | :x: W0 | :white_large_square: pending |
| 02-02-01 | 02 | 1 | VOICE-02 | unit | `npx vitest run tests/lib/ai/intent-extractor.test.ts` | :x: W0 | :white_large_square: pending |
| 02-02-02 | 02 | 1 | VOICE-03 | unit | `npx vitest run tests/lib/ai/intent-extractor.test.ts` | :x: W0 | :white_large_square: pending |
| 02-03-01 | 03 | 2 | VOICE-04 | manual | N/A — requires live call | :x: | :white_large_square: pending |
| 02-03-02 | 03 | 2 | VOICE-05 | unit | `npx vitest run tests/lib/voice/filler.test.ts` | :x: W0 | :white_large_square: pending |

*Status: :white_large_square: pending · :white_check_mark: green · :x: red · :warning: flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/voice/greeting.test.ts` — greeting template, AI disclosure, bilingual
- [ ] `tests/lib/voice/call-state.test.ts` — call state lifecycle
- [ ] `tests/lib/ai/intent-extractor.test.ts` — service+location extraction, clarifying question generation (getDisambiguationPrompt)
- [ ] `tests/lib/voice/filler.test.ts` — filler phrase pool, bilingual

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Greeting within 2s of call connect | VOICE-01 | Requires live Telnyx call | Call the number, time from ring to greeting |
| No perceptible silence between speech and response | VOICE-04 | Subjective latency perception | Call and have a conversation, note any dead air |
| Streaming TTS sounds natural | VOICE-04 | Audio quality assessment | Listen to Murphy's responses for naturalness |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
