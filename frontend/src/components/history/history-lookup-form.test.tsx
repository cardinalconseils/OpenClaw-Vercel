import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

describe('HistoryLookupForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders phone input and submit button', async () => {
    const { HistoryLookupForm } = await import(
      '@/components/history/history-lookup-form'
    )
    render(<HistoryLookupForm />)
    expect(screen.getByRole('textbox')).toBeTruthy()
    expect(screen.getByRole('button', { name: /look up/i })).toBeTruthy()
  })

  it('calls fetch with correct URL and body on submit', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ records: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { HistoryLookupForm } = await import(
      '@/components/history/history-lookup-form'
    )
    render(<HistoryLookupForm />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '5551234567' } })
    fireEvent.submit(screen.getByRole('button', { name: /look up/i }).closest('form')!)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/call-history',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ phone: '5551234567' }),
        })
      )
    })
  })

  it('shows error on 400 response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid phone number' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { HistoryLookupForm } = await import(
      '@/components/history/history-lookup-form'
    )
    render(<HistoryLookupForm />)

    fireEvent.submit(screen.getByRole('button', { name: /look up/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid phone number/i)).toBeTruthy()
    })
  })

  it('shows error on 429 response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Too many requests' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { HistoryLookupForm } = await import(
      '@/components/history/history-lookup-form'
    )
    render(<HistoryLookupForm />)

    fireEvent.submit(screen.getByRole('button', { name: /look up/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/too many requests/i)).toBeTruthy()
    })
  })
})
