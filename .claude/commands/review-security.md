---
description: Security-focused scan using the security-reviewer agent
allowed-tools: Read, Glob, Grep, Bash, Agent
---

# Security Review

## Step 1: Scope

Determine review scope from: $ARGUMENTS

If no arguments:
1. Run `git diff --name-only` for uncommitted changes
2. If no changes, scan the full `src/` directory

## Step 2: Run Security Reviewer

Spawn the `security-reviewer` agent from `.claude/agents/security-reviewer.md`.

Direct it to focus on the scoped files, covering:
1. Authentication & authorization (middleware, Supabase auth)
2. Supabase security (RLS, client vs server usage, exposed keys)
3. Input validation (Zod schemas, XSS, injection)
4. Middleware route protection
5. Environment & secrets

## Step 3: Report

Present the agent's findings organized by severity.
If CRITICAL issues found, recommend immediate action items.
