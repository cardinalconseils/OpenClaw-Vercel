---
description: Scaffold a new React component following shadcn/ui conventions, then generate its test
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

# New Component: $ARGUMENTS

If no arguments provided, ask: component name, whether it's a UI primitive or feature component, and whether it needs CVA variants.

## Step 1: Load Conventions

Read the `new-component` skill at `.claude/skills/new-component/SKILL.md` to load project component conventions.

## Step 2: Check for Conflicts

1. Search for existing components with the same or similar name in `src/components/`
2. If a conflict exists, warn and ask whether to proceed or rename

## Step 3: Scaffold Component

Using the skill conventions:
1. Create the component file in the correct location:
   - UI primitives → `src/components/ui/<name>.tsx`
   - Feature components → `src/components/<feature>/<name>.tsx`
2. Follow the exact template from the skill (function declarations, `data-slot`, `cn()`, named exports)
3. If variants are needed, use the CVA template

## Step 4: Generate Test

Read the `gen-test` skill at `.claude/skills/gen-test/SKILL.md` to load test conventions.

Create a test file:
- For UI primitives → `src/__tests__/<name>.test.tsx`
- For feature components → `src/__tests__/<name>.test.tsx`

The test must cover:
1. Renders correctly (basic render + snapshot)
2. Applies custom className via `cn()`
3. Passes through props via `{...props}`
4. If interactive: user interaction with `userEvent.setup()`

## Step 5: Verify

1. Run `npx vitest run --reporter=verbose <test-file>` to verify the test passes
2. Run `npx tsc --noEmit` to verify no type errors
3. Report: component path, test path, test result
