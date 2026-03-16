---
phase: 03
slug: provider-discovery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | vitest.config.ts (implicit) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~3 seconds |

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
| 03-01-01 | 01 | 1 | SRCH-01 | unit | `npx vitest run tests/lib/tools/handlers/search.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SRCH-04 | unit | `npx vitest run tests/lib/tools/handlers/search.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | SRCH-02 | unit | `npx vitest run tests/lib/tools/handlers/search.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | SRCH-05 | unit | `npx vitest run tests/lib/voice/narration.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | SRCH-03, SRCH-06 | integration | `npx vitest run tests/api/webhooks.test.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/tools/handlers/search.test.ts` — Google Places search, ranking, fallback, urgency re-ranking
- [ ] `tests/lib/voice/narration.test.ts` — result narration templates, bilingual, no-results handling

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Murphy narrates results aloud naturally | SRCH-03 | Audio quality / natural speech | Call the number, request a plumber, listen to narration |
| Google Places returns real provider data | SRCH-01 | Requires live API call | Set GOOGLE_MAPS_API_KEY, trigger search, verify real results |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
