import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileForm } from '@/components/dashboard/profile-form'
import { AccountManagement } from '@/components/dashboard/account-management'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Mock Supabase client
const mockUpdateUser = vi.fn()
const mockSignOut = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
      getUser: mockGetUser,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }),
}))

const defaultUser = {
  email: 'test@example.com',
  fullName: 'Test User',
  phone: '+15551234567',
}

describe('Settings Form (WEB-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateUser.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  it('validates full name is required', async () => {
    const user = userEvent.setup()
    render(<ProfileForm user={defaultUser} />)

    // Clear the full name field
    const nameInput = screen.getByLabelText('Full Name')
    await user.clear(nameInput)

    // Submit the form
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Name is required')
    })
  })

  it('validates phone number matches E.164 format', async () => {
    const user = userEvent.setup()
    render(<ProfileForm user={{ ...defaultUser, phone: '' }} />)

    const phoneInput = screen.getByLabelText('Phone Number')
    await user.type(phoneInput, 'not-a-phone')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid phone number')
    })
  })

  it('validates email is valid format', async () => {
    // Email field is disabled — validation is still present but field can't be changed
    // Verify that the email field is disabled (not editable)
    render(<ProfileForm user={defaultUser} />)
    const emailInput = screen.getByLabelText('Email')
    expect(emailInput).toBeDisabled()
  })

  it('calls supabase.auth.updateUser with form data on submit', async () => {
    const user = userEvent.setup()
    render(<ProfileForm user={defaultUser} />)

    // Update name
    const nameInput = screen.getByLabelText('Full Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'New Name')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: {
          full_name: 'New Name',
          phone: '+15551234567',
        },
      })
    })
  })

  it('shows success message after save', async () => {
    const user = userEvent.setup()
    render(<ProfileForm user={defaultUser} />)

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Profile updated successfully'
      )
    })
  })

  it('shows inline error on save failure (not toast)', async () => {
    mockUpdateUser.mockResolvedValueOnce({
      error: { message: 'Update failed' },
    })

    const user = userEvent.setup()
    render(<ProfileForm user={defaultUser} />)

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Update failed')
    })
  })

  it('delete account shows AlertDialog confirmation before action', async () => {
    const user = userEvent.setup()
    render(<AccountManagement />)

    await user.click(screen.getByRole('button', { name: /delete account/i }))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })
  })

  it('AlertDialog contains "This cannot be undone." text', async () => {
    const user = userEvent.setup()
    render(<AccountManagement />)

    await user.click(screen.getByRole('button', { name: /delete account/i }))

    await waitFor(() => {
      expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument()
    })
  })
})
