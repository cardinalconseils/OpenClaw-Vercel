---
phase: 02-voice-conversation-core
plan: 02
subsystem: ai-prompts-and-intent
tags: [murphy, bilingual, intent-extraction, tdd, voice]
dependency_graph:
  requires: []
  provides: [intent-extractor, bilingual-murphy-prompt]
  affects: [voice-pipeline, disambiguation-flow, call-state]
tech_stack:
  added: []
  patterns: [regex-keyword-extraction, tdd-red-green, bilingual-pattern-matching]
key_files:
  created:
    - src/lib/ai/intent-extractor.ts
    - tests/lib/ai/intent-extractor.test.ts
  modified:
    - src/lib/ai/prompts/murphy-system.ts
    - src/lib/ai/prompts/voice-modifiers.ts
    - tests/lib/ai/prompts/murphy-system.test.ts
decisions:
  - "Regex/keyword extraction for intent (no LLM call) — deterministic, zero latency, testable in isolation"
  - "EN and FR service patterns maintained as separate arrays — clean separation, easy to extend"
  - "Location extraction: zip code matched first (most precise), then preposition-based, then postal code"
  - "Urgency threshold: any single urgency keyword triggers emergency (intentionally sensitive for safety)"
  - "language?: 'en' | 'fr' added to MurphyContext as optional — backward compatible"
metrics:
  duration: 141s
  completed: "2026-03-16"
  tasks_completed: 2
  files_modified: 5
  tests_added: 19
---

# Phase 02 Plan 02: Murphy Prompt + Intent Extractor Summary

**One-liner:** Bilingual Murphy prompt with 1-question limit and regex-based intent extractor for EN/FR service dispatch.

## What Was Built

### Task 1: Updated Murphy System Prompt

- Changed greeting from "Who am I speaking with?" to "What service can I help you find today?" (per CONTEXT.md locked decision)
- Replaced `2-turn clarification maximum` with `ONE clarifying question maximum` — one attempt then best-guess and proceed
- Added `## Language Rules` section: detect caller language from first utterance, respond in same language (EN/FR), default to EN
- Added `## Confirmation Pattern` section: confirm service + location before searching (bilingual)
- Added `## Call Timeout` section: 10-minute rule
- Added `language?: 'en' | 'fr'` to `MurphyContext` interface
- Added bilingual response directive to `voice-modifiers.ts`

**Test count:** 14 original + 6 new = 20 tests, all passing.

### Task 2: Intent Extractor (TDD)

Created `src/lib/ai/intent-extractor.ts` with:

- `IntentResult` interface: `{ serviceType, location, urgency, isComplete }`
- `extractIntent(transcript)`: regex/keyword extraction for EN + FR natural speech
  - 13 EN service patterns (plumber, electrician, locksmith, cleaner, HVAC, roofer, painter, carpenter, handyman, pest control, lawn care, movers)
  - 8 FR service patterns (plombier, electricien, serrurier, nettoyeur, couvreur, peintre, carpentier)
  - Location: `in/near/a` prepositions, 5-digit zip codes, Canadian postal codes
  - Urgency: emergency/urgent/ASAP/urgence/immediatement keywords (case-insensitive)
- `isIntentComplete(intent)`: validates both serviceType and location are present
- `getDisambiguationPrompt(language)`: EN/FR clarification prompts

**Test count:** 13 tests covering all behavior cases, all passing.

## Deviations from Plan

None — plan executed exactly as written.

## Test Results

```
Test Files: 28 passed
Tests:      202 passed
Duration:   1.21s
```

All AI module tests pass. Zero regressions.

## Self-Check: PASSED
- [x] `src/lib/ai/intent-extractor.ts` — exists and exports IntentResult, extractIntent, isIntentComplete, getDisambiguationPrompt
- [x] `src/lib/ai/prompts/murphy-system.ts` — contains ONE clarifying question, Language Rules, What service, 10 minutes
- [x] `src/lib/ai/prompts/voice-modifiers.ts` — contains caller's detected language
- [x] `tests/lib/ai/intent-extractor.test.ts` — 13 tests passing
- [x] `tests/lib/ai/prompts/murphy-system.test.ts` — 20 tests passing
- [x] Commits: d48c7a7 (Task 1), 321a49f (TDD RED), 56e97b6 (TDD GREEN)
