---
description: Quick review of recent changes for code quality
allowed-tools: Read, Glob, Grep, Bash
---

# Quick Code Review

Review recently changed files for code quality:

## Step 1: Find Changes

1. Run `git diff --name-only` for uncommitted changes
2. Run `git diff --name-only HEAD~3` for recent commits
3. Focus on `.ts` and `.tsx` files

## Step 2: Review Each File

For each changed file, check:
1. **Component conventions** — `data-slot` attributes, `cn()` usage, named exports, function declarations (not arrow)
2. **TypeScript** — no `any` types, proper typing on props
3. **Error handling** — async operations have try/catch or error states
4. **File size** — warn if over 300 lines
5. **Imports** — no unused imports, no circular dependencies
6. **Test coverage** — check if a test file exists for the component

## Step 3: Report

For each issue, include file path, line number, and fix suggestion.
End with a summary: total issues found and overall quality rating.
