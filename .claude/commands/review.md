---
description: Full frontend review — security + UI accessibility + code quality
allowed-tools: Read, Glob, Grep, Bash, Agent
---

# Full Frontend Review

Perform a comprehensive review using all available reviewers in parallel.

## Step 1: Identify Scope

1. Run `git diff --name-only` to find uncommitted changes
2. Run `git diff --name-only HEAD~5` to find recently modified files
3. Combine into a review scope — focus on changed files but note systemic issues

## Step 2: Run Reviews in Parallel

Launch **three** agents simultaneously:

### Agent 1: Security Review
Spawn the `security-reviewer` agent from `.claude/agents/security-reviewer.md`:
- Focus on auth middleware, Supabase client usage, input validation
- Check for hardcoded secrets, XSS vectors, open redirects

### Agent 2: UI/Accessibility Review
Spawn the `ui-reviewer` agent from `.claude/agents/ui-reviewer.md`:
- Focus on WCAG 2.1 AA compliance, keyboard navigation, ARIA
- Check responsive design, touch targets, loading/error states

### Agent 3: Code Quality
Review changed files for:
- Files over 300 lines
- Missing TypeScript types (`any` usage)
- Unused imports/variables
- Component convention violations (missing `data-slot`, wrong export style)
- Missing test coverage for changed components

## Step 3: Consolidated Report

Combine all findings into a single report:

```
## Frontend Review Report

### Security (from security-reviewer)
[findings by severity]

### Accessibility (from ui-reviewer)
[findings by severity]

### Code Quality
[findings by severity]

### Summary
- Total issues: X (critical: N, high: N, medium: N, low: N)
- Recommendation: SHIP / FIX FIRST / BLOCK
```
