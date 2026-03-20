---
description: Accessibility review using the ui-reviewer agent (WCAG 2.1 AA)
allowed-tools: Read, Glob, Grep, Bash, Agent
---

# Accessibility Review

## Step 1: Scope

Determine review scope from: $ARGUMENTS

If no arguments:
1. Scan all components in `src/components/`
2. Include page components in `src/app/`

## Step 2: Run UI Reviewer

Spawn the `ui-reviewer` agent from `.claude/agents/ui-reviewer.md`.

Direct it to focus on:
1. WCAG 2.1 AA compliance — accessible names, labels, ARIA
2. Keyboard navigation — tab order, focus trapping in modals
3. Responsive design — mobile touch targets, breakpoints
4. Component quality — loading states, error states, empty states

## Step 3: Report

Present findings organized by category.
For each issue, include the WCAG success criterion reference and a concrete fix.
