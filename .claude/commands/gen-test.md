---
description: Generate Vitest + Testing Library tests for a component or module
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Generate Tests: $ARGUMENTS

If no arguments provided, ask which component or file to test.

## Step 1: Load Conventions

Read the `gen-test` skill at `.claude/skills/gen-test/SKILL.md` to load project test patterns.

## Step 2: Analyze Target

1. Read the target file completely
2. Identify:
   - Component props and their types
   - User interactions (clicks, typing, form submits)
   - External dependencies to mock (Supabase, next/navigation, etc.)
   - Async operations (data fetching, mutations)
   - Error states and edge cases

## Step 3: Check Existing Tests

1. Search for existing test files for this component in `src/__tests__/`
2. If tests exist, ask: replace, extend, or abort?

## Step 4: Write Tests

Following the skill conventions:
1. Use `userEvent.setup()` — never `fireEvent`
2. Use accessibility queries (`getByRole`, `getByLabelText`) — never `getByTestId`
3. Mock Supabase and next/navigation using the standard patterns from the skill
4. Wrap async assertions in `waitFor()`
5. Call `vi.clearAllMocks()` in `beforeEach`

Cover at minimum:
- Renders correctly
- Each user interaction path
- Success state
- Error state
- Edge cases (empty data, loading)

## Step 5: Verify

1. Run `npx vitest run --reporter=verbose <test-file>`
2. If tests fail, fix them — don't leave broken tests
3. Report: test file path, number of tests, pass/fail
