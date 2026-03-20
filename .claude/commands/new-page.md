---
description: Scaffold a new App Router page with proper auth pattern and generate its test
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

# New Page: $ARGUMENTS

If no arguments provided, ask: page name, which route group (dashboard/auth/public), and what data it needs.

## Step 1: Load Conventions

Read the `new-page` skill at `.claude/skills/new-page/SKILL.md` to load project page conventions.

## Step 2: Determine Route Group

Based on the user's intent:
- **Dashboard page** → `src/app/(dashboard)/<name>/page.tsx` — async server component, `createServerSupabaseClient`
- **Auth page** → `src/app/(auth)/<name>/page.tsx` — client component, `createClient`
- **Public page** → `src/app/<name>/page.tsx` — static or server component

## Step 3: Check for Conflicts

1. Check if the route already exists
2. If it does, warn and ask whether to overwrite or pick a different name

## Step 4: Scaffold Page

Using the correct template from the skill:
1. Create the page file with metadata, proper Supabase import, and data fetching
2. If the page needs a new component, ask whether to also run `/new-component` for it

## Step 5: Middleware Check

If this is a new protected route NOT under `/dashboard/`:
1. Read `middleware.ts`
2. Add the new route to the protection check
3. Warn the user about the middleware update

## Step 6: Generate Test

Read the `gen-test` skill at `.claude/skills/gen-test/SKILL.md`.

Create a test in `src/__tests__/<name>.test.tsx` or `src/app/__tests__/<name>.test.tsx`:
- For server components: test that the component renders with mocked Supabase data
- For client components: test form interactions with `userEvent.setup()`

## Step 7: Verify

1. Run `npx tsc --noEmit` to verify no type errors
2. Run `npx vitest run --reporter=verbose <test-file>` to verify the test passes
3. Report: page path, test path, middleware changes (if any), test result
