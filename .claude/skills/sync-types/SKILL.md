---
name: sync-types
description: Check and sync frontend types with backend type definitions — identifies drift between frontend/backend Mission, CallHistory, and CallState types
user-invocable: false
---

# Type Sync Checker

The frontend duplicates types from the backend to avoid cross-package imports that break Vercel's isolated Next.js build.

## Source of Truth

- **Frontend types**: `src/lib/types.ts`
- **Backend types**: `../src/types/mission.ts` and `../src/lib/voice/call-state.ts`

## Types to Keep in Sync

| Frontend Type | Backend Source |
|---------------|---------------|
| `MissionStatus` | `src/types/mission.ts` |
| `MissionChannel` | `src/types/mission.ts` |
| `MissionStepType` | `src/types/mission.ts` |
| `MissionStepStatus` | `src/types/mission.ts` |
| `MissionStep` | `src/types/mission.ts` |
| `MissionEventResult` | `src/types/mission.ts` |
| `Mission` | `src/types/mission.ts` |
| `CallHistoryRecord` | Frontend-only (DB shape) |
| `CallStage` | `src/lib/voice/call-state.ts` |
| `CallStateView` | `src/lib/voice/call-state.ts` (subset) |

## Sync Process

1. Read the backend source files
2. Compare each type definition field-by-field
3. Report any differences (added fields, removed fields, type changes)
4. If differences found, update `src/lib/types.ts` — preserve the file header comment and `CallHistoryRecord` (frontend-only)

## Rules

- **Never add Node.js-specific types** to the frontend version (setTimeout handles, Buffer, etc.)
- **Keep the `CallStateView` as a subset** — it intentionally excludes runtime types
- **Preserve the file header comment** explaining why types are duplicated
- **`CallHistoryRecord` is frontend-only** — it maps to DB column names (snake_case), not backend types
