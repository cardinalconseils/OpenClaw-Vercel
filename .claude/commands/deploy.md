---
description: Full CI/CD pipeline — lint, typecheck, test, security review, a11y review, commit, PR, deploy
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, Agent
---

# Frontend Deployment Pipeline

Execute the full deployment pipeline. **Do not skip any gate.** If any gate fails, stop and report.

## Gate 1: Pre-Flight

1. Run `git status` to assess current state
2. Run `git diff --name-only` to list all changes
3. Run `git log --oneline -5` to check recent history
4. Verify we are NOT on `main` branch — if we are, create a feature branch first
5. Check for `.env` files in staging area — BLOCK if found

## Gate 2: Lint

```bash
npx next lint
```

**If lint fails with errors: STOP and report. Warnings are OK.**

## Gate 3: TypeScript Validation

```bash
npx tsc --noEmit
```

**If compilation fails: STOP and report errors.**

## Gate 4: Test Suite

```bash
npm test
```

**If tests fail: STOP and report failures.**

## Gate 5: Security Review

Spawn the `security-reviewer` agent from `.claude/agents/security-reviewer.md` on all changed files.

**If CRITICAL findings: STOP and report.**
**If HIGH findings: WARN and ask user whether to proceed.**

## Gate 6: Accessibility Review

Spawn the `ui-reviewer` agent from `.claude/agents/ui-reviewer.md` on changed component files.

**If CRITICAL a11y issues: WARN and ask user whether to proceed.**

Run Gates 5 and 6 in **parallel**.

## Gate 7: Commit & Push

If all gates pass:
1. Stage relevant files (NOT `.env`, NOT `node_modules/`, NOT `.DS_Store`)
2. Create commit with conventional format
3. Push to feature branch with `-u` flag

## Gate 8: Create Pull Request

Create PR using `gh pr create`:
- Title: concise description under 70 chars
- Body: Summary, Security Checklist, A11y Checklist, Test Plan
- Base branch: `main`

## Gate 9: Report

```
## Deployment Report

| Gate | Status |
|------|--------|
| Lint | PASS/FAIL |
| TypeScript | PASS/FAIL |
| Tests | PASS/FAIL |
| Security Review | PASS/WARN/FAIL |
| A11y Review | PASS/WARN/FAIL |
| Commit | SHA |
| PR | URL |
```

## Arguments

Apply this pipeline to: $ARGUMENTS

If no arguments provided, run on all uncommitted changes.
