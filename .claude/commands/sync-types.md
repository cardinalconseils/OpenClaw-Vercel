---
description: Check if frontend types are in sync with backend type definitions
allowed-tools: Read, Glob, Grep, Bash
---

# Type Sync Check

## Step 1: Load Skill

Read the `sync-types` skill at `.claude/skills/sync-types/SKILL.md` for the type mapping.

## Step 2: Read Both Sides

1. Read `src/lib/types.ts` (frontend)
2. Read `../src/types/mission.ts` (backend) — if it exists
3. Read `../src/lib/voice/call-state.ts` (backend) — if it exists

If backend files don't exist (e.g., running in frontend-only context), report that sync cannot be verified.

## Step 3: Compare

For each type in the mapping:
1. Compare fields, field types, and union values
2. Flag any differences

## Step 4: Report

```
## Type Sync Report

| Type | Status | Details |
|------|--------|---------|
| MissionStatus | IN SYNC / DRIFTED | field differences |
| ... | ... | ... |

### Action Needed
- List specific changes to apply (or "All types in sync")
```

If drift is found, ask the user whether to apply the updates automatically.
