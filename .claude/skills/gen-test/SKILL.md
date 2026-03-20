---
name: gen-test
description: Generate Vitest + Testing Library tests matching project test conventions — mocks Supabase and next/navigation, uses userEvent.setup() and accessibility queries
---

# Generate Tests

Create tests matching the project's Vitest + React Testing Library conventions.

## Project Test Setup

- **Framework**: Vitest with jsdom environment
- **Setup file**: `src/test-setup.ts` imports `@testing-library/jest-dom/vitest`
- **User events**: Always use `userEvent.setup()` (not `fireEvent`)
- **Queries**: Prefer accessibility queries (`getByRole`, `getByLabelText`, `getByText`)
- **Test location**: Co-located in `src/__tests__/` or `src/app/__tests__/`

## Common Mocks

### next/navigation

```tsx
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}))
```

### Supabase Client

```tsx
const mockSupabase = {
  auth: {
    updateUser: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
  },
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))
```

## Test Template

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComponentName } from '@/components/path/to/component'

// Mocks go here (see Common Mocks above)

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly', () => {
    render(<ComponentName />)
    expect(screen.getByRole('...')).toBeInTheDocument()
  })

  it('handles user interaction', async () => {
    const user = userEvent.setup()
    render(<ComponentName />)

    await user.click(screen.getByRole('button', { name: /action/i }))

    await waitFor(() => {
      expect(screen.getByText(/result/i)).toBeInTheDocument()
    })
  })

  it('handles error state', async () => {
    // Setup mock to return error
    render(<ComponentName />)
    // Assert error UI
  })
})
```

## Checklist

- [ ] Imports from `vitest` (describe, it, expect, vi, beforeEach)
- [ ] Uses `userEvent.setup()` — never raw `fireEvent`
- [ ] Uses accessibility queries (`getByRole`, `getByLabelText`) — never `getByTestId`
- [ ] Calls `vi.clearAllMocks()` in `beforeEach`
- [ ] Wraps async assertions in `waitFor()`
- [ ] Mocks external dependencies (Supabase, next/navigation)
- [ ] Tests both success and error paths
- [ ] Test file named `*.test.tsx`
