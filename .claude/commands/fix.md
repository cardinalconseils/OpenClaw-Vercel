---
description: Quick targeted fix with auto-verification (typecheck + tests)
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Fix: $ARGUMENTS

If no arguments provided, ask what needs to be fixed.

## Step 1: Understand the Issue

1. Read the relevant file(s) mentioned or implied
2. If the issue is unclear, search the codebase for context
3. Identify the root cause — don't just patch symptoms

## Step 2: Apply the Fix

1. Make the minimal change needed to fix the issue
2. Don't refactor surrounding code — keep the diff small
3. Don't add features — only fix the reported problem

## Step 3: Auto-Verify

Run these checks — all must pass before reporting success:

```bash
# TypeScript must compile
npx tsc --noEmit

# Tests must pass
npm test

# Lint must pass
npx next lint
```

## Step 4: Report

```
## Fix Applied

**File(s)**: path/to/file.tsx:line
**Change**: Brief description of what was changed and why
**Verification**:
- TypeScript: PASS/FAIL
- Tests: PASS/FAIL
- Lint: PASS/FAIL
```

If any verification fails, fix the issue and re-verify. Don't report success until all checks pass.
