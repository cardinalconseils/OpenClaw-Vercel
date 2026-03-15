---
description: Full CI/CD deployment pipeline — commit, PR, security review, code quality, merge, and Vercel deploy
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, Agent
---

# CI/CD Deployment Pipeline

You are executing the full deployment pipeline. Load the CI/CD deployment agent and skill for context:

- **Agent**: `.claude/agents/cicd-deployment.md`
- **Skill**: `.claude/skills/cicd-deployment/SKILL.md`

## Execution Protocol

Execute the following stages in order. **Do not skip any stage.** If any gate fails, stop and report the failure.

### Gate 1: Pre-Flight Checks

```
1. Run `git status` to assess current state
2. Run `git diff` to review all changes (staged + unstaged)
3. Run `git log --oneline -10` to check recent history
4. Verify we are NOT on `main` branch — if we are, create a feature branch first
5. Check for .env files in staging area — BLOCK if found
```

### Gate 2: Secret Scan

Scan ALL changed files for secrets:
- API keys (TELNYX, OPENAI, ANTHROPIC, SUPABASE, GOOGLE)
- Private keys, Bearer tokens, passwords
- Connection strings with embedded credentials

**If any secrets found: STOP IMMEDIATELY and report.**

### Gate 3: TypeScript Validation

```bash
npx tsc --noEmit
```

**If compilation fails: STOP and report errors.**

### Gate 4: Test Suite

```bash
npm test
```

**If tests fail: STOP and report failures.**

### Gate 5: Dependency Audit

```bash
npm audit --audit-level=high
```

**If critical/high vulnerabilities found: WARN and ask user whether to proceed.**

### Gate 6: Code Quality Review

Invoke the `code-reviewer` agent:

1. Spawn Agent with `subagent_type: general-purpose` to run `/review-security` on changed files
2. Spawn Agent with `subagent_type: general-purpose` to run `/review-code` on changed files
3. Collect findings and report

### Gate 7: Commit & Push

If all gates pass:
1. Stage relevant files (NOT `.env`, NOT `node_modules/`)
2. Create commit with conventional format
3. Push to feature branch with `-u` flag

### Gate 8: Create Pull Request

Create PR using `gh pr create`:
- Title: concise description under 70 chars
- Body: Full PR template from skill (Summary, Security Checklist, Test Plan, Deployment)
- Base branch: `main`
- Request review if team members available

### Gate 9: Monitor Deployment

After PR is created:
1. Report PR URL to user
2. If user approves merge: `gh pr merge <number> --squash`
3. Monitor GitHub Actions: `gh run list --workflow=deploy.yml --limit=1`
4. Report deployment status

### Gate 10: Post-Deploy Verification

After deployment completes:
1. Check Vercel deployment status
2. Verify health endpoint
3. Report final status with deployment URL

## Output Format

After pipeline completion, report:

```
## Deployment Report

| Gate | Status |
|------|--------|
| Secret Scan | PASS/FAIL |
| TypeScript | PASS/FAIL |
| Tests | PASS/FAIL |
| Dep Audit | PASS/WARN/FAIL |
| Security Review | PASS/WARN/FAIL |
| Code Quality | PASS/WARN/FAIL |
| Commit | SHA |
| PR | URL |
| Deploy | URL |
| Health Check | PASS/FAIL |
```

## Arguments

Apply this pipeline to: $ARGUMENTS

If no arguments provided, run on all uncommitted changes in the working directory.
