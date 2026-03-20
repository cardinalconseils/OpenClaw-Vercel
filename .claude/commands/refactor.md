---
description: Refactor with safety net — restructure code then run full verification suite
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

# Refactor: $ARGUMENTS

If no arguments provided, ask what to refactor and the desired outcome.

## Step 1: Analyze Current State

1. Read all files involved in the refactor
2. Map dependencies — what imports the code being refactored?
3. Check for existing tests that cover the code
4. Run the test suite to establish a green baseline:
   ```bash
   npm test
   ```
   **If tests already fail: WARN the user and ask whether to proceed.**

## Step 2: Plan the Refactor

Before making changes, explain:
- What will change and why
- Which files will be affected
- What the risk areas are

Wait for user confirmation before proceeding.

## Step 3: Apply Changes

1. Make the refactor changes
2. Update all import paths if files moved
3. Update tests to match new structure

## Step 4: Full Verification

Run the complete verification suite:

```bash
# TypeScript
npx tsc --noEmit

# Tests
npm test

# Lint
npx next lint
```

## Step 5: Review

Spawn the `security-reviewer` agent if the refactor touches:
- Auth code (middleware, Supabase client/server)
- Form validation
- Data fetching

Spawn the `ui-reviewer` agent if the refactor touches:
- Component structure or props
- Accessibility-related markup
- Layout or responsive code

## Step 6: Report

```
## Refactor Complete

**Scope**: What was refactored
**Files changed**: List with brief description per file
**Files moved/renamed**: Old path → New path

**Verification**:
- TypeScript: PASS/FAIL
- Tests: PASS/FAIL (X passing)
- Lint: PASS/FAIL
- Security review: PASS/N/A
- A11y review: PASS/N/A

**Breaking changes**: None / List any
```
