---
name: cicd-deployment
description: CI/CD pipeline orchestration — commit, PR, security review, code quality, Vercel deployment, and post-deploy verification
---

# CI/CD Deployment Skill

## When to Use

Invoke this skill when:
- Deploying changes to production or preview environments
- Creating pull requests with security and quality gates
- Running the full deployment pipeline (commit → PR → review → merge → deploy)
- Performing pre-merge security validation
- Monitoring or troubleshooting Vercel deployments

## Pipeline Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Pre-Commit  │───▶│  Commit &   │───▶│  Create PR  │───▶│  Security   │
│  Validation  │    │    Push     │    │  w/ Checks  │    │    Gate     │
└─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘
                                                                │
                   ┌─────────────┐    ┌─────────────┐    ┌──────▼──────┐
                   │ Post-Deploy  │◀───│   Merge &   │◀───│   Code      │
                   │ Verification │    │   Deploy    │    │  Quality    │
                   └─────────────┘    └─────────────┘    └─────────────┘
```

## Stage 1: Pre-Commit Security Scan

### Secret Detection Patterns

Scan all staged files for these patterns — **block commit if found**:

| Pattern | Description |
|---------|-------------|
| `TELNYX_API_KEY=` | Telnyx API key |
| `OPENAI_API_KEY=` | OpenAI key |
| `ANTHROPIC_API_KEY=` | Anthropic key |
| `SUPABASE_SERVICE_ROLE_KEY=` | Supabase service key |
| `GOOGLE_MAPS_API_KEY=` | Google Maps key |
| `sk-[a-zA-Z0-9]{20,}` | Generic secret key pattern |
| `-----BEGIN.*PRIVATE KEY-----` | Private key block |
| `password\s*=\s*['"][^'"]+['"]` | Hardcoded passwords |
| `Bearer [a-zA-Z0-9\-._~+/]+=*` | Bearer tokens |

### Pre-Commit Checks

```bash
# 1. Run existing pre-commit hook
bash bin/hooks/pre-commit.sh

# 2. TypeScript compilation
npx tsc --noEmit

# 3. Run tests
npm test

# 4. Check for .env files in staging
git diff --cached --name-only | grep -E '\.env' && echo "BLOCKED: .env file staged" && exit 1

# 5. Dependency audit
npm audit --audit-level=critical
```

## Stage 2: Commit Standards

### Conventional Commits

Format: `type(scope): description`

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `security` | Security patch |
| `refactor` | Code restructuring |
| `test` | Test additions/changes |
| `docs` | Documentation |
| `ci` | CI/CD changes |
| `chore` | Maintenance |

### Commit Message Template

```
type(scope): concise description of change

- Detail 1
- Detail 2

Security: [none|patched CVE-XXXX|updated dependency]
Breaking: [none|description of breaking change]

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Stage 3: Pull Request Template

### PR Body Structure

```markdown
## Summary
<1-3 bullet points describing the change>

## Changes
- [ ] List of specific changes

## Security Checklist
- [ ] No hardcoded secrets or API keys
- [ ] All user inputs validated (Zod schemas)
- [ ] Webhook signatures verified on all inbound requests
- [ ] SQL queries parameterized (no string concatenation)
- [ ] Rate limiting on public endpoints
- [ ] No sensitive data in logs or error messages
- [ ] Dependencies audited (`npm audit`)
- [ ] CORS configured correctly

## Test Plan
- [ ] Unit tests pass (`npm test`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Integration tests pass (if applicable)
- [ ] Manual verification: <steps>

## Deployment
- [ ] Preview deployment verified on Vercel
- [ ] Environment variables confirmed in Vercel dashboard
- [ ] No new env vars needed / New env vars documented

## Rollback Plan
- Revert commit: `git revert <sha>`
- Previous working deployment: <vercel-url>
```

## Stage 4: Security Review Checklist

### OWASP Top 10 for This Project

| Risk | Check | How to Verify |
|------|-------|---------------|
| **Injection** | SQL injection, command injection | Parameterized queries, no `exec()` with user input |
| **Broken Auth** | Webhook validation | Telnyx signature verification on all webhooks |
| **Sensitive Data** | Secrets exposure | No keys in code, `.env` not committed |
| **XXE** | XML parsing | Not applicable (JSON-only API) |
| **Broken Access** | Endpoint authorization | Rate limiting, no admin endpoints exposed |
| **Misconfiguration** | Server setup | Strict CORS, no debug mode in prod |
| **XSS** | Output encoding | Not applicable (API-only, no HTML rendering) |
| **Deserialization** | Object parsing | Zod validation on all inbound data |
| **Components** | Dependencies | `npm audit`, no known CVEs |
| **Logging** | Security events | Auth failures and webhook errors logged |

### Telnyx-Specific Security

- **Webhook Signature Validation**: Every inbound webhook MUST verify the Telnyx signature header
- **Call Control Authentication**: All outbound Call Control API calls use authenticated SDK
- **Phone Number Validation**: Validate E.164 format on all phone numbers
- **DTMF Input Sanitization**: Sanitize any DTMF input before processing
- **Recording Consent**: Ensure recording compliance per jurisdiction

### Dependency Security

```bash
# Critical and high vulnerabilities block deployment
npm audit --audit-level=high

# Generate full report for PR comment
npm audit --json > /tmp/audit-report.json
```

## Stage 5: Code Quality Gates

### Automated Checks

| Check | Tool | Threshold |
|-------|------|-----------|
| TypeScript compilation | `tsc --noEmit` | Zero errors |
| Test suite | `npm test` | All pass |
| File size | Custom check | Max 300 lines |
| No `any` types | grep/tsc strict | Zero occurrences |
| Dependency audit | `npm audit` | No critical/high |

### Agent-Driven Reviews

Invoke these agents/commands for deeper analysis:

```
# Full security + quality review
/review

# Security-focused scan
/review-security

# Check recently changed files
/review-recent

# Complexity analysis
/review-complexity
```

## Stage 6: Deployment to Vercel

### GitHub Actions Trigger

Merging to `main` triggers the deploy workflow:

1. **Build** — `npm run build` in GitHub Actions
2. **Test** — Full test suite execution
3. **Security** — `npm audit` + secret scan
4. **Deploy** — Vercel CLI deployment
5. **Verify** — Health check on deployed URL

### Vercel Configuration

- **Framework**: Node.js
- **Build Command**: `npm run build`
- **Output Directory**: `dist/`
- **Node Version**: 20.x
- **Environment**: Variables managed in Vercel dashboard (never in code)

### Deployment Monitoring

```bash
# Check deployment status
gh run list --workflow=deploy.yml --limit=5

# View deployment logs
gh run view <run-id> --log

# Check Vercel deployment
vercel ls --limit=5
```

## Stage 7: Post-Deploy Verification

### Health Checks

After deployment, verify:

1. **HTTP 200** on base URL
2. **Webhook endpoint** responds to POST
3. **No 5xx errors** in Vercel runtime logs
4. **Environment variables** loaded correctly (check logs for missing vars)

### Rollback Procedure

If post-deploy verification fails:

```bash
# Option 1: Revert the merge commit
git revert <merge-sha> --no-edit
git push origin main

# Option 2: Promote previous deployment in Vercel
vercel promote <previous-deployment-url>
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Pre-commit hook fails | Fix the issue, re-stage, create NEW commit |
| TypeScript won't compile | Fix type errors before proceeding |
| Tests fail | Fix tests — never skip with `--no-verify` |
| npm audit critical | Update the dependency before merge |
| PR review requested changes | Address all comments, push fix commit |
| Deploy fails | Check build logs, fix, re-deploy |
| Health check fails | Rollback immediately, investigate |

## Integration with Other Agents

| Agent | Integration Point |
|-------|-------------------|
| `code-reviewer` | Invoked at Stage 4 (security) and Stage 5 (quality) |
| `e2e-test-specialist` | Invoked at Stage 5 for test validation |
| `documentation-specialist` | Invoked post-merge if docs need updating |
| `agent-orchestrator` | Coordinates multi-agent review when needed |
